import { describe, expect, it } from 'vitest'
import { intervalFacts, normalizeReport } from './antigravity.mjs'

describe('interval report evidence guardrails', () => {
  const attempts = [
    { id: 'a1', section: 'math', skillId: 'linear-equations-one-variable', correct: true, elapsedMs: 71_000, difficulty: 4, confidence: 'high', questionSnapshot: { estimatedSeconds: 105 } },
    { id: 'a2', section: 'rw', skillId: 'inferences', correct: false, elapsedMs: 98_000, difficulty: 4, confidence: 'certain', questionSnapshot: { estimatedSeconds: 80 } },
    { id: 'a3', section: 'rw', skillId: 'boundaries', correct: true, elapsedMs: 52_000, difficulty: 3, questionSnapshot: { estimatedSeconds: 55 } },
  ]

  it('computes authoritative section and skill counts', () => {
    const facts = intervalFacts(attempts)
    expect(facts.sections.rw).toMatchObject({ total: 2, correct: 1, averageSeconds: 75 })
    expect(facts.sections.math).toMatchObject({ total: 1, correct: 1, averageSeconds: 71 })
    expect(facts.skills.inferences).toMatchObject({ total: 1, correct: 0, averageSeconds: 98 })
    expect(facts.confidence).toEqual({
      high: expect.objectContaining({ total: 1, correct: 1 }),
      certain: expect.objectContaining({ total: 1, correct: 0 }),
    })
  })

  it('overrides model arithmetic and removes invented and unsupported categories', () => {
    const generated = {
      sectionBreakdown: [
        { section: 'Reading and Writing', accuracySummary: 'wrong', pacingSummary: 'wrong', findings: [], recommendedFocus: 'Review.' },
        { section: 'Math', accuracySummary: '1/2', pacingSummary: 'wrong', findings: [], recommendedFocus: 'Advance.' },
      ],
      skillBreakdown: [
        { skillId: 'linear-equations-one-variable', correct: 0, total: 99, averageSeconds: 1, diagnosis: 'Observed.', nextDifficulty: 5, action: 'Advance.', evidenceIds: [], confidence: 'tentative' },
        { skillId: 'inferences', correct: 1, total: 9, averageSeconds: 2, diagnosis: 'Observed.', nextDifficulty: 3, action: 'Review.', evidenceIds: [], confidence: 'tentative' },
        { skillId: 'boundaries', correct: 0, total: 7, averageSeconds: 3, diagnosis: 'Observed.', nextDifficulty: 4, action: 'Advance.', evidenceIds: [], confidence: 'tentative' },
      ],
      errorTaxonomy: [
        { label: 'Supported error', count: 9, mechanism: 'Overgeneralized.', evidenceIds: ['a2', 'a1', 'invented'] },
        { label: 'Invented error', count: 1, mechanism: 'None.', evidenceIds: ['invented'] },
      ],
    }
    const normalized = normalizeReport(generated, attempts, intervalFacts(attempts))
    expect(normalized.sectionBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'Math', accuracySummary: '1/1 correct (100%)' }),
      expect.objectContaining({ section: 'Reading and Writing', accuracySummary: '1/2 correct (50%)' }),
    ]))
    expect(normalized.skillBreakdown.find((item) => item.skillId === 'linear-equations-one-variable')).toMatchObject({ correct: 1, total: 1, averageSeconds: 71, evidenceIds: ['a1'] })
    expect(normalized.errorTaxonomy).toEqual([{ label: 'Supported error', count: 1, mechanism: 'Overgeneralized.', evidenceIds: ['a2'] }])
  })
})
