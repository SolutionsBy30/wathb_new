/**
 * SIM-003 — §4 form assembly, as a pure function over candidate items.
 *
 * Kept free of Prisma so the rules that decide what a student actually sits —
 * quotas, the difficulty ramp, passage atomicity, experimental slots — are
 * testable without a database. The service fetches candidates and persists the
 * result; every decision lives here.
 *
 * Seeded throughout: §4 requires a form to be reproducible and auditable, and
 * acceptance criterion 3 requires two students taking نموذج ٣ to receive
 * byte-identical item sets in identical order. Math.random cannot do that.
 */

export interface CandidateItem {
  questionId: string;
  questionVersionId: string;
  areaId: string;
  difficulty: number;
  /** Reading-comprehension items share a passage and move as a block (§4.3). */
  passageId: string | null;
}

export interface AreaQuota {
  areaId: string;
  count: number;
  difficultyCurve: 'ascending' | 'none';
}

export interface SectionPlan {
  orderIndex: number;
  questionCount: number;
  quotas: AreaQuota[];
  experimentalSlots: number[];
}

export interface AssembledItem {
  sectionIndex: number;
  position: number;
  questionId: string;
  questionVersionId: string;
  isScored: boolean;
}

export interface AssemblyFailure {
  sectionIndex: number;
  areaId: string;
  required: number;
  available: number;
}

export type AssemblyResult =
  | { ok: true; items: AssembledItem[]; seed: string }
  | { ok: false; shortfalls: AssemblyFailure[] };

/**
 * Deterministic PRNG (mulberry32) seeded from a string.
 *
 * Not for anything security-bearing — it decides which practice questions land
 * in a form, and being reproducible from the stored seed is the whole point.
 */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates against the seeded generator, so shuffles are reproducible. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Group passage-bearing items so a passage's dependent questions are picked
 * together. A passage split across sections would show a student questions
 * about a text they cannot see — §4.3 requires the block to be atomic, and §10
 * requires assembly to fail rather than split it.
 */
function groupByPassage(items: CandidateItem[]): CandidateItem[][] {
  const standalone: CandidateItem[][] = [];
  const byPassage = new Map<string, CandidateItem[]>();
  for (const item of items) {
    if (!item.passageId) {
      standalone.push([item]);
      continue;
    }
    const group = byPassage.get(item.passageId) ?? [];
    group.push(item);
    byPassage.set(item.passageId, group);
  }
  return [...standalone, ...byPassage.values()];
}

/** Mean difficulty, so a passage block sorts as one unit on the ramp. */
function groupDifficulty(group: CandidateItem[]): number {
  return group.reduce((sum, i) => sum + i.difficulty, 0) / group.length;
}

/**
 * Assemble one form.
 *
 * @param sections   the blueprint's section templates, in order
 * @param candidates published, eligible items — the caller has already applied
 *                   exposure control (§4.4), since that needs the student's
 *                   history and the DB
 * @param seed       stored on the form; the same seed and candidates always
 *                   produce the same form
 */
export function assembleForm(sections: SectionPlan[], candidates: CandidateItem[], seed: string): AssemblyResult {
  const rng = seededRandom(seed);
  const used = new Set<string>();
  const shortfalls: AssemblyFailure[] = [];
  const items: AssembledItem[] = [];

  for (const section of sections) {
    const chosen: CandidateItem[] = [];

    for (const quota of section.quotas) {
      const pool = candidates.filter((c) => c.areaId === quota.areaId && !used.has(c.questionId));
      // Shuffle whole groups, not items: picking items independently would
      // pull three questions from one passage and leave the fourth behind.
      const groups = shuffle(groupByPassage(pool), rng);

      const picked: CandidateItem[] = [];
      for (const group of groups) {
        if (picked.length + group.length > quota.count) continue; // never split a block
        picked.push(...group);
        if (picked.length === quota.count) break;
      }

      if (picked.length < quota.count) {
        // Report every shortfall rather than the first, so the readiness check
        // (§9) can tell an admin everything the bank is missing in one pass.
        shortfalls.push({
          sectionIndex: section.orderIndex,
          areaId: quota.areaId,
          required: quota.count,
          available: picked.length,
        });
        continue;
      }

      for (const item of picked) used.add(item.questionId);

      if (quota.difficultyCurve === 'ascending') {
        const groupsPicked = groupByPassage(picked).sort((a, b) => groupDifficulty(a) - groupDifficulty(b));
        chosen.push(...groupsPicked.flat());
      } else {
        chosen.push(...picked);
      }
    }

    // §3.1 — easy → hard across the whole section, with passage blocks kept
    // together and placed by their mean difficulty.
    const ordered = groupByPassage(chosen).sort((a, b) => groupDifficulty(a) - groupDifficulty(b)).flat();

    ordered.forEach((item, position) => {
      items.push({
        sectionIndex: section.orderIndex,
        position,
        questionId: item.questionId,
        questionVersionId: item.questionVersionId,
        // §7.1 — experimental items are excluded from every score surface but
        // still gather statistics.
        isScored: !section.experimentalSlots.includes(position),
      });
    });
  }

  if (shortfalls.length > 0) return { ok: false, shortfalls };
  return { ok: true, items, seed };
}

/**
 * §9 — bank readiness, without assembling anything.
 *
 * Answers "can this blueprint be published?" per area, so the admin sees
 * "الهندسة: مطلوب ١٢، متوفر ٧" before a student ever hits a broken form.
 */
export function checkBankReadiness(
  sections: SectionPlan[],
  candidates: CandidateItem[],
): { ready: boolean; shortfalls: AssemblyFailure[] } {
  const shortfalls: AssemblyFailure[] = [];
  // Demand is summed across sections first: the same area quota may appear in
  // several sections, and each needs its own items.
  const demand = new Map<string, { sectionIndex: number; required: number }[]>();
  for (const section of sections) {
    for (const quota of section.quotas) {
      const list = demand.get(quota.areaId) ?? [];
      list.push({ sectionIndex: section.orderIndex, required: quota.count });
      demand.set(quota.areaId, list);
    }
  }

  for (const [areaId, needs] of demand) {
    const available = candidates.filter((c) => c.areaId === areaId).length;
    const required = needs.reduce((sum, n) => sum + n.required, 0);
    if (available < required) {
      shortfalls.push({ sectionIndex: needs[0].sectionIndex, areaId, required, available });
    }
  }

  return { ready: shortfalls.length === 0, shortfalls };
}
