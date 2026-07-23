// Pure types for the §6.4 selection engine — no DB/Nest dependency so this
// module can be unit tested against fixtures in isolation.

export interface LabelState {
  labelId: string;
  /** Which section this label belongs to — SEL-001: a bundle draws from one section only. */
  sectionId: string;
  /** accuracy(label), 0..1. Pass 0.5 (neutral) when nAnswered is 0. */
  accuracy: number;
  nAnswered: number;
  /** Days since this label was last served to the student; null = never served. */
  lastServedDaysAgo: number | null;
  /** label_curriculum_weight — inherited section/area weight, default 1. */
  curriculumWeight: number;
  /** Student's difficulty-ladder position for this label, 1..5. */
  difficultyLevel: number;
}

// SEL-001 — one section is chosen per Wathb, favoring the student's weakest
// while rotating over time so no section goes unmeasured. Aggregated the
// same way as label state, just one level up the taxonomy.
export interface SectionState {
  sectionId: string;
  accuracy: number;
  nAnswered: number;
  lastServedDaysAgo: number | null;
}

export interface SelectionConfig {
  bundleSize: number;
  /** Confidence saturates at this many answered questions. */
  minSample: number;
  /** Below this many answers, a label counts as "under-sampled" for the exploration guarantee. */
  underSampledThreshold: number;
  /** Minimum confidence + accuracy for a label to count as a "strength" for the morale guarantee. */
  strengthAccuracyThreshold: number;
  strengthConfidenceThreshold: number;
  /** Max questions drawn from any single label per bundle. */
  maxPerLabel: number;
  /** Random source, injectable for deterministic tests. */
  rng: () => number;
}

export const DEFAULT_SELECTION_CONFIG: Omit<SelectionConfig, 'rng'> = {
  bundleSize: 5,
  minSample: 20,
  underSampledThreshold: 5,
  strengthAccuracyThreshold: 0.7,
  strengthConfidenceThreshold: 0.5,
  maxPerLabel: 3,
};

export interface LabelPick {
  labelId: string;
  targetDifficulty: number;
  /** True if this slot exists specifically to satisfy the strength or exploration guarantee. */
  reason: 'weighted' | 'strength_guarantee' | 'exploration_guarantee';
}
