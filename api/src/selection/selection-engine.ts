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

import { DEFAULT_SELECTION_CONFIG, LabelPick, LabelState, SelectionConfig } from './selection-engine.types';

export function recencyPenalty(daysAgo: number | null): number {
  if (daysAgo === null) return 1;
  if (daysAgo === 0) return 0.15;
  if (daysAgo === 1) return 0.4;
  return 1;
}

export function labelScore(label: LabelState, minSample: number): number {
  const weaknessWeight = 1 - label.accuracy;
  const confidence = Math.min(1, label.nAnswered / minSample);
  const coverageWeight = 1 / (1 + label.nAnswered);
  const base = weaknessWeight * confidence + coverageWeight * (1 - confidence);
  return base * recencyPenalty(label.lastServedDaysAgo) * label.curriculumWeight;
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
    const chosen = strengthLabels[Math.floor(cfg.rng() * strengthLabels.length)];
    applySwap(picks, counts, swapIdx, chosen, 'strength_guarantee');
  }

  const underSampledLabels = labels.filter((l) => isUnderSampled(l, cfg));
  const hasUnderSampled = picks.some((p) => underSampledLabels.some((l) => l.labelId === p.labelId));
  if (!hasUnderSampled && underSampledLabels.length > 0 && picks.length > 0) {
    const swapIdx = pickReplaceableIndex(picks, counts, cfg);
    const chosen = underSampledLabels[Math.floor(cfg.rng() * underSampledLabels.length)];
    applySwap(picks, counts, swapIdx, chosen, 'exploration_guarantee');
  }

  return picks;
}

function pickReplaceableIndex(picks: LabelPick[], counts: Map<string, number>, cfg: SelectionConfig): number {
  // Prefer to replace a slot from a label that has more than one slot in this
  // bundle already, so we don't zero out a label's only representation.
  for (let i = picks.length - 1; i >= 0; i--) {
    if ((counts.get(picks[i].labelId) ?? 0) > 1) return i;
  }
  return picks.length - 1;
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
