import { describe, expect, it } from 'vitest'
import { applyGenerationReviews, hasSuspiciousReadingOverlap, intervalFacts, normalizeReport, plainProse, rebalanceAnswerPositions, validateGeneratedReadingQuestion } from './antigravity.mjs'

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
      executiveSummary: 'During the period 2026-08-06T21:20:00.060Z to 2026-08-06T21:25:35.734Z (Session f54585d8-b881-433e-ab98-c6a4d24be003), accuracy was high.',
      whatChanged: [{ claim: 'Session f54585d8-b881-433e-ab98-c6a4d24be003 was fast.', evidenceIds: ['a1', 'invented'], confidence: 'tentative' }],
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
    expect(normalized.executiveSummary).not.toMatch(/f54585d8|2026-08-06T|during the period/i)
    expect(normalized.whatChanged[0]).toMatchObject({ evidenceIds: ['a1'] })
  })
})

describe('fresh Reading and Writing validation', () => {
  const blueprint = { section: 'rw', domain: 'information-ideas', skillId: 'central-ideas-details', difficulty: 3 }
  const valid = {
    ...blueprint,
    stimulus: 'Marine ecologist Imani Shah compared tidal pools that were sheltered from strong waves with pools exposed to them. Sheltered pools contained more juvenile snails, but they also held more algae and stayed submerged longer between tides. The team photographed and counted each pool at the same point in the tidal cycle, repeating the survey every two weeks across four months so that seasonal changes in the snail population would be visible. Because the design did not isolate any one of the differing conditions, Shah concluded that wave exposure alone could not yet explain the difference in snail abundance.',
    prompt: 'Which choice best states the main idea of the text?',
    choices: [
      { id: 'A', text: 'Several linked conditions may explain why sheltered pools held more juvenile snails.' },
      { id: 'B', text: 'Wave exposure was proven to be the only cause of snail abundance.' },
      { id: 'C', text: 'Algae cannot grow in pools exposed to strong waves.' },
      { id: 'D', text: 'Juvenile snails remain in tidal pools only while the pools are submerged.' },
    ],
    answer: 'A',
    explanation: 'The study found several differences between the pool groups, so it could not isolate wave exposure as the sole explanation.',
    concept: 'Choose the option that captures the conclusion without adding certainty.',
    estimatedSeconds: 70,
  }

  it('accepts an original item that matches the requested blueprint and density', () => {
    expect(validateGeneratedReadingQuestion(valid, blueprint)).toMatchObject({ ...blueprint, source: 'ai-generated', validationStatus: 'accepted' })
  })

  it('rejects short or blueprint-mismatched items before they reach practice', () => {
    expect(validateGeneratedReadingQuestion({ ...valid, stimulus: 'Too short.' }, blueprint)).toBeNull()
    expect(validateGeneratedReadingQuestion({ ...valid, skillId: 'inferences' }, blueprint)).toBeNull()
  })

  it('rejects near-duplicate passages and answer keys the reviewer cannot reproduce', () => {
    const accepted = validateGeneratedReadingQuestion(valid, blueprint)
    expect(hasSuspiciousReadingOverlap(accepted, [{ stimulus: valid.stimulus.replace('four months', 'five months') }])).toBe(true)
    expect(hasSuspiciousReadingOverlap(accepted, [{ stimulus: 'A completely different passage about ceramic glazes and kiln temperatures.' }])).toBe(false)
    expect(applyGenerationReviews([accepted], [{ index: 0, verdict: 'accept', uniqueAnswer: true, solvedAnswer: 'A' }])).toHaveLength(1)
    expect(applyGenerationReviews([accepted], [{ index: 0, verdict: 'accept', uniqueAnswer: true, solvedAnswer: 'B' }])).toHaveLength(0)
  })
})

describe('generated item presentation guardrails', () => {
  const item = (answer) => ({
    choices: [
      { id: 'A', text: 'correct text' },
      { id: 'B', text: 'wrong b' },
      { id: 'C', text: 'wrong c' },
      { id: 'D', text: 'wrong d' },
    ],
    answer,
    whyWrong: { B: 'because b', C: 'because c', D: 'because d' },
    misconceptionByChoice: { B: 'because b', C: 'because c', D: 'because d' },
  })

  it('strips markdown emphasis the model adds to prose', () => {
    expect(plainProse('the coral *Lophelia pertusa* is **fragile** and _slow_ to grow'))
      .toBe('the coral Lophelia pertusa is fragile and slow to grow')
  })

  it('spreads the key across letters while keeping the correct text correct', () => {
    const balanced = rebalanceAnswerPositions([item('A'), item('A'), item('A'), item('A')])
    expect(balanced.map((question) => question.answer)).toEqual(['A', 'B', 'C', 'D'])
    for (const question of balanced) {
      expect(question.choices.find((choice) => choice.id === question.answer).text).toBe('correct text')
      expect(question.choices.map((choice) => choice.id)).toEqual(['A', 'B', 'C', 'D'])
      expect(new Set(question.choices.map((choice) => choice.text)).size).toBe(4)
    }
  })

  it('moves each distractor diagnosis to the letter its text landed on', () => {
    const [, moved] = rebalanceAnswerPositions([item('A'), item('A')])
    for (const choice of moved.choices) {
      if (choice.id === moved.answer) continue
      expect(moved.misconceptionByChoice[choice.id]).toBe(`because ${choice.text.split(' ')[1]}`)
    }
  })
})
