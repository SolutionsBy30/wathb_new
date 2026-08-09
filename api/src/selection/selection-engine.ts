// Wathb question-selection engine — spec §6.4.
// Deterministic and debuggable, not ML, per the product spec's explicit instruction.
//
//   weakness_weight = 1 - accuracy(label)
//   confidence      = min(1, n_answered(label) / MIN_SAMPLE)
//   coverage_weight = 1 / (1 + n_answered(label))
//   recency_penalty = decay if seen today/yesterday
//   score = (weakness_weight * confidence + coverage_weight * (1 - confidence))
//           * recency_penalty * label_curriculum_weight
//
// Then sample labels proportional to score, enforcing:
//   - >= 1 question from a STRENGTH label per bundle   (morale)
//   - >= 1 question from an under-sampled label        (exploration)
//   - <= 3 questions from any single label              (variety)
//   - difficulty within +-1 of the student's ladder position for that label

import { DEFAULT_SELECTION_CONFIG, LabelPick, LabelState, SectionState, SelectionConfig } from './selection-engine.types';

export function recencyPenalty(daysAgo: number | null): number {
  if (daysAgo === null) return 1;
  if (daysAgo === 0) return 0.15;
  if (daysAgo === 1) return 0.4;
  return 1;
}

/** Shared weakness/confidence/coverage shape — used for both section and label scoring (SEL-001/SEL-002). */
function weaknessCoverageScore(accuracy: number, nAnswered: number, minSample: number): number {
  const weaknessWeight = 1 - accuracy;
  const confidence = Math.min(1, nAnswered / minSample);
  const coverageWeight = 1 / (1 + nAnswered);
  return weaknessWeight * confidence + coverageWeight * (1 - confidence);
}

export function labelScore(label: LabelState, minSample: number): number {
  const base = weaknessCoverageScore(label.accuracy, label.nAnswered, minSample);
  return base * recencyPenalty(label.lastServedDaysAgo) * label.curriculumWeight;
}

export function sectionScore(section: SectionState, minSample: number): number {
  const base = weaknessCoverageScore(section.accuracy, section.nAnswered, minSample);
  return base * recencyPenalty(section.lastServedDaysAgo);
}

/**
 * SEL-001 — pick the one section today's Wathb draws from: favors the
 * student's weakest section while a stronger recency penalty than the
 * label-level one (0 days ago counts for almost nothing) pushes rotation
 * across sections so none goes unmeasured for long. Weighted-random, same
 * technique as label selection, not a hard round-robin.
 */
export function selectSectionForDay(sections: SectionState[], configOverrides: Partial<SelectionConfig> = {}): string | null {
  if (sections.length === 0) return null;
  if (sections.length === 1) return sections[0].sectionId;
  const cfg: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, rng: Math.random, ...configOverrides };
  const weights = sections.map((s) => Math.max(sectionScore(s, cfg.minSample), 1e-6));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = cfg.rng() * total;
  for (let i = 0; i < sections.length; i++) {
    r -= weights[i];
    if (r <= 0) return sections[i].sectionId;
  }
  return sections[sections.length - 1].sectionId;
}

export function isStrength(label: LabelState, cfg: SelectionConfig): boolean {
  const confidence = Math.min(1, label.nAnswered / cfg.minSample);
  return label.accuracy >= cfg.strengthAccuracyThreshold && confidence >= cfg.strengthConfidenceThreshold;
}

export function isUnderSampled(label: LabelState, cfg: SelectionConfig): boolean {
  return label.nAnswered < cfg.underSampledThreshold;
}

/** Weighted sample of one label, respecting the per-label cap already spent. */
function drawOne(
  candidates: LabelState[],
  weights: Map<string, number>,
  counts: Map<string, number>,
  cfg: SelectionConfig,
): LabelState | null {
  const pool = candidates.filter((l) => (counts.get(l.labelId) ?? 0) < cfg.maxPerLabel);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, l) => sum + Math.max(weights.get(l.labelId) ?? 0, 1e-6), 0);
  let r = cfg.rng() * total;
  for (const l of pool) {
    r -= Math.max(weights.get(l.labelId) ?? 0, 1e-6);
    if (r <= 0) return l;
  }
  return pool[pool.length - 1];
}

function clampDifficulty(studentLevel: number): number {
  return Math.min(5, Math.max(1, Math.round(studentLevel)));
}

/**
 * Pick which labels to draw questions from for one bundle. Does not touch the
 * question bank — the caller resolves each LabelPick to an actual unseen
 * question at (or near) targetDifficulty.
 */
export function selectLabelsForBundle(
  labels: LabelState[],
  configOverrides: Partial<SelectionConfig> = {},
): LabelPick[] {
  const cfg: SelectionConfig = {
    ...DEFAULT_SELECTION_CONFIG,
    rng: Math.random,
    ...configOverrides,
  };
  if (labels.length === 0) return [];

  const weights = new Map(labels.map((l) => [l.labelId, labelScore(l, cfg.minSample)]));
  const counts = new Map<string, number>();
  const picks: LabelPick[] = [];

  const size = Math.min(cfg.bundleSize, labels.length * cfg.maxPerLabel);
  for (let i = 0; i < size; i++) {
    const drawn = drawOne(labels, weights, counts, cfg);
    if (!drawn) break;
    counts.set(drawn.labelId, (counts.get(drawn.labelId) ?? 0) + 1);
    picks.push({ labelId: drawn.labelId, targetDifficulty: clampDifficulty(drawn.difficultyLevel), reason: 'weighted' });
  }

  const strengthLabels = labels.filter((l) => isStrength(l, cfg));
  const hasStrength = picks.some((p) => strengthLabels.some((l) => l.labelId === p.labelId));
  if (!hasStrength && strengthLabels.length > 0 && picks.length > 0) {
    const swapIdx = pickReplaceableIndex(picks, counts, cfg);
    if (swapIdx !== -1) {
      const chosen = strengthLabels[Math.floor(cfg.rng() * strengthLabels.length)];
      applySwap(picks, counts, swapIdx, chosen, 'strength_guarantee');
    }
  }

  const underSampledLabels = labels.filter((l) => isUnderSampled(l, cfg));
  const hasUnderSampled = picks.some((p) => underSampledLabels.some((l) => l.labelId === p.labelId));
  if (!hasUnderSampled && underSampledLabels.length > 0 && picks.length > 0) {
    const swapIdx = pickReplaceableIndex(picks, counts, cfg);
    if (swapIdx !== -1) {
      const chosen = underSampledLabels[Math.floor(cfg.rng() * underSampledLabels.length)];
      applySwap(picks, counts, swapIdx, chosen, 'exploration_guarantee');
    }
  }

  applyWeaknessFloor(labels, picks, counts, cfg);

  return picks;
}

/**
 * SEL-007 — the weakest band, by accuracy ascending.
 *
 * Only *measured* labels are eligible. An unanswered label has no accuracy to
 * rank on (generateDaily passes a neutral 0.5), so including it would let the
 * floor be satisfied by labels nobody has shown to be weak — the exploration
 * guarantee already covers those, and conflating the two would hide genuine
 * weak areas behind unmeasured ones.
 */
export function weakestBand(labels: LabelState[], cfg: SelectionConfig): LabelState[] {
  const measured = labels.filter((l) => l.nAnswered > 0);
  if (measured.length === 0) return [];
  const ranked = [...measured].sort((a, b) => a.accuracy - b.accuracy);
  const size = Math.max(1, Math.ceil(ranked.length * cfg.weaknessBandFraction));
  return ranked.slice(0, size);
}

/**
 * Top the bundle up until the agreed share of it comes from the weakest band.
 *
 * Runs last, and deliberately will not cannibalise the strength or exploration
 * guarantees: those two slots are the product's promise that a bundle is never
 * pure grinding and never stops exploring. So the floor is capped at
 * `bundleSize - (guaranteed slots present)`, which is why a 5-question bundle
 * tops out at 3 weak + 1 strength + 1 under-sampled rather than 4 weak.
 */
function applyWeaknessFloor(
  labels: LabelState[],
  picks: LabelPick[],
  counts: Map<string, number>,
  cfg: SelectionConfig,
): void {
  if (cfg.weaknessFloorFraction <= 0 || picks.length === 0) return;
  const band = weakestBand(labels, cfg);
  if (band.length === 0) return;
  const bandIds = new Set(band.map((l) => l.labelId));

  const guaranteed = picks.filter(
    (p) => p.reason === 'strength_guarantee' || p.reason === 'exploration_guarantee',
  ).length;
  const target = Math.min(
    Math.ceil(picks.length * cfg.weaknessFloorFraction),
    Math.max(0, picks.length - guaranteed),
    // Never demand more slots than the per-label cap can legitimately supply.
    band.length * cfg.maxPerLabel,
  );

  let have = picks.filter((p) => bandIds.has(p.labelId)).length;
  let safety = picks.length * 2;
  while (have < target && safety-- > 0) {
    const swapIdx = pickFloorVictim(labels, picks, bandIds, counts, cfg);
    if (swapIdx === -1) break; // every remaining slot is spoken for
    const candidates = band.filter((l) => (counts.get(l.labelId) ?? 0) < cfg.maxPerLabel);
    if (candidates.length === 0) break;
    const chosen = candidates[Math.floor(cfg.rng() * candidates.length)];
    applySwap(picks, counts, swapIdx, chosen, 'weakness_floor');
    have += 1;
  }
}

/**
 * Which slot the weakness floor may take over.
 *
 * Checking the `reason` tag is not enough. The strength and exploration
 * guarantees only *tag* a slot when they had to swap one in — if the weighted
 * draw already happened to land on the sole strength or sole under-sampled
 * label, that slot reads as plain 'weighted' while still being the only thing
 * upholding the invariant. Evicting it silently broke both guarantees.
 *
 * So the test is the invariant itself: a slot is off-limits if removing it
 * would leave the bundle with no strength label, or no under-sampled one,
 * while such a label exists to be had.
 */
function pickFloorVictim(
  labels: LabelState[],
  picks: LabelPick[],
  bandIds: Set<string>,
  counts: Map<string, number>,
  cfg: SelectionConfig,
): number {
  const byId = new Map(labels.map((l) => [l.labelId, l]));
  const anyStrength = labels.some((l) => isStrength(l, cfg));
  const anyUnderSampled = labels.some((l) => isUnderSampled(l, cfg));

  const holds = (pick: LabelPick, predicate: (l: LabelState) => boolean) => {
    const state = byId.get(pick.labelId);
    return state ? predicate(state) : false;
  };
  const countIf = (list: LabelPick[], predicate: (l: LabelState) => boolean) =>
    list.filter((p) => holds(p, predicate)).length;

  const replaceable = picks
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => {
      if (p.reason === 'strength_guarantee' || p.reason === 'exploration_guarantee') return false;
      if (bandIds.has(p.labelId)) return false;
      const remaining = picks.filter((_, j) => j !== i);
      if (anyStrength && countIf(remaining, (l) => isStrength(l, cfg)) === 0) return false;
      if (anyUnderSampled && countIf(remaining, (l) => isUnderSampled(l, cfg)) === 0) return false;
      return true;
    });

  if (replaceable.length === 0) return -1;
  const duplicated = replaceable.filter(({ p }) => (counts.get(p.labelId) ?? 0) > 1);
  const pool = duplicated.length > 0 ? duplicated : replaceable;
  return pool[pool.length - 1].i;
}

function pickReplaceableIndex(picks: LabelPick[], counts: Map<string, number>, cfg: SelectionConfig): number {
  // A slot already inserted to satisfy a guarantee is off-limits, or the
  // guarantees cannibalise each other: the strength swap lands on the last
  // index, and the exploration swap that runs next picks that same index and
  // overwrites it, leaving a bundle with no strength label at all. (Only
  // reproducible on some seeds, which is why the original fixture missed it.)
  const eligible = picks
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.reason === 'weighted');
  if (eligible.length === 0) return -1;
  // Prefer to replace a slot from a label that has more than one slot in this
  // bundle already, so we don't zero out a label's only representation.
  for (let k = eligible.length - 1; k >= 0; k--) {
    if ((counts.get(eligible[k].p.labelId) ?? 0) > 1) return eligible[k].i;
  }
  return eligible[eligible.length - 1].i;
}

function applySwap(
  picks: LabelPick[],
  counts: Map<string, number>,
  idx: number,
  replacement: LabelState,
  reason: LabelPick['reason'],
) {
  const removed = picks[idx];
  counts.set(removed.labelId, Math.max(0, (counts.get(removed.labelId) ?? 1) - 1));
  counts.set(replacement.labelId, (counts.get(replacement.labelId) ?? 0) + 1);
  picks[idx] = {
    labelId: replacement.labelId,
    targetDifficulty: clampDifficulty(replacement.difficultyLevel),
    reason,
  };
}
