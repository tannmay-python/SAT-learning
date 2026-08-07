import measurement from '../../server/official-density.json'

/**
 * Measured stimulus density of the official College Board digital SAT practice
 * forms in `SAT Mocks`, produced by `scripts/measure-official-density.py`.
 *
 * The script extracts each form, separates the two printed columns, cuts the
 * stream into numbered questions, and counts the words that precede each
 * question stem. Counts cover prose only: table bodies extract unreliably and
 * are excluded, so the quantitative-evidence numbers are a floor rather than a
 * full measure.
 *
 * These numbers exist so the fidelity guardrails in `fidelity.test.ts` and the
 * generator bounds in `server/antigravity.mjs` are calibrated against the real
 * form instead of being guessed. Both read the same JSON. Regenerate with the
 * script rather than hand-editing.
 */
export interface DensityBand {
  /** Official questions of this type that parsed cleanly. */
  sample: number
  p05: number
  p25: number
  median: number
  p75: number
  p95: number
}

/** Keyed by SATLAS skill id. The two Standard English skills share one measurement. */
export const officialStimulusDensity: Record<string, DensityBand> = measurement.bands

/** Total official questions measured across all seven forms. */
export const officialDensitySample = measurement._sample

/**
 * The floor a passage must clear for its skill, set at the official 25th
 * percentile. Below this a passage is shorter than three quarters of the real
 * items of its type, which is the gap that made SATLAS practice read lighter
 * than the test.
 */
export const densityFloor = (skillId: string) => officialStimulusDensity[skillId]?.p25 ?? 45

/** Generation ceiling, set just above the official 95th percentile. */
export const densityCeiling = (skillId: string) => Math.round((officialStimulusDensity[skillId]?.p95 ?? 120) * 1.12)
