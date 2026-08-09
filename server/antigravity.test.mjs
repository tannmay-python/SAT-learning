import { describe, expect, it } from 'vitest'
import { applyGenerationReviews, generatedStimulusFault, hasSuspiciousReadingOverlap, intervalFacts, normalizeReport, blankConventionFault, computeGoalFacts, normalizeMockAssessment, plainProse, rebalanceAnswerPositions, remapChoiceReferences, validateGeneratedReadingQuestion } from './antigravity.mjs'

describe('mock assessment guardrails', () => {
  it('keeps expected total internally consistent and clamps model output', () => {
    expect(normalizeMockAssessment({ difficulty: 7, expectedRwScore: 873, expectedMathScore: 421, expectedScore: 100, confidence: 'strong', rationale: 'Prior evidence is mixed, so the expected score is provisional.' }, 'mock-1', 'test-model')).toMatchObject({
      sessionId: 'mock-1',
      difficulty: 5,
      expectedRwScore: 800,
      expectedMathScore: 420,
      expectedScore: 1220,
      confidence: 'strong',
      model: 'test-model',
    })
  })
})

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

  it('rejects Gemini teaching commentary inside a stimulus', () => {
    const contaminated = { ...valid, stimulus: `${valid.stimulus} The example is useful because it connects the specific observation to the broader conclusion.` }
    expect(generatedStimulusFault(contaminated)).toMatch(/instructional commentary/)
    expect(validateGeneratedReadingQuestion(contaminated, blueprint)).toBeNull()
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

describe('blank convention', () => {
  const item = (stimulus, choices, skillId = 'boundaries') => ({
    skillId,
    stimulus,
    choices: ['A', 'B', 'C', 'D'].map((id, index) => ({ id, text: choices[index] })),
  })

  it('rejects a passage that already supplies the word every choice repeats', () => {
    const fault = blankConventionFault(item(
      'The pipes provided freshwater to urban neighborhoods for decades ____ their subterranean design protected the supply from contamination.',
      ['decades;', 'decades,', 'decades', 'decades, and which'],
    ))
    expect(fault).toMatch(/repeats "decades"/)
  })

  it('accepts the same item once the blank replaces that word', () => {
    expect(blankConventionFault(item(
      'The pipes provided freshwater to urban neighborhoods for ____ their subterranean design protected the supply from contamination.',
      ['decades;', 'decades,', 'decades', 'decades, and which'],
    ))).toBeNull()
  })

  it('requires a blank for the skills whose official form has one', () => {
    expect(blankConventionFault(item('A passage with no blank at all.', ['a', 'b', 'c', 'd']))).toMatch(/no ____ blank/)
    expect(blankConventionFault(item('A passage with no blank at all.', ['a', 'b', 'c', 'd'], 'inferences'))).toMatch(/no ____ blank/)
  })

  it('leaves skills that have no blank alone', () => {
    expect(blankConventionFault(item('A passage with no blank at all.', ['a', 'b', 'c', 'd'], 'central-ideas-details'))).toBeNull()
  })

  it('rejects more than one blank', () => {
    expect(blankConventionFault(item('One ____ and then another ____ blank.', ['a', 'b', 'c', 'd']))).toMatch(/more than one blank/)
  })
})

describe('explanation text stays consistent with the rebalanced letters', () => {
  it('remaps every Choice mention using the old-to-new letter table', () => {
    const oldToNew = { C: 'A', A: 'B', B: 'C', D: 'D' }
    const explanation = 'Choice C is correct because the passage supports it. Choice A is incorrect because it misreads the claim. Choice B misinterprets the evidence. Choice D is incorrect because it is unsupported.'
    expect(remapChoiceReferences(explanation, oldToNew)).toBe(
      'Choice A is correct because the passage supports it. Choice B is incorrect because it misreads the claim. Choice C misinterprets the evidence. Choice D is incorrect because it is unsupported.'
    )
  })

  it('rewrites the explanation so it names the same letter rebalanceAnswerPositions assigns as the answer', () => {
    const question = {
      choices: [
        { id: 'A', text: 'weaving techniques choice' },
        { id: 'B', text: 'sunlight damage choice' },
        { id: 'C', text: 'chemical evidence choice, the correct one' },
        { id: 'D', text: 'thermal insulation choice' },
      ],
      answer: 'C',
      explanation: 'Choice C is correct because it presents the chemical evidence. Choice A is incorrect because it discusses weaving techniques. Choice B is incorrect because it misreads sunlight damage. Choice D is incorrect because it compares thermal insulation.',
      concept: 'Choice C names the main purpose correctly.',
      whyWrong: { A: 'Choice A wrongly focuses on technique.', B: 'Choice B misreads the evidence.', D: 'Choice D is off topic.' },
      misconceptionByChoice: { A: 'Discusses technique, not purpose.', B: 'Misreads sunlight evidence.', D: 'Off topic.' },
    }
    const [balanced] = rebalanceAnswerPositions([question])
    const correctChoice = balanced.choices.find((choice) => choice.id === balanced.answer)
    expect(correctChoice.text).toBe('chemical evidence choice, the correct one')
    expect(balanced.explanation).toMatch(new RegExp(`Choice ${balanced.answer} is correct because it presents the chemical evidence`))
    // Every other choice's explanation sentence must now cite its own new letter, not a stale one.
    for (const choice of balanced.choices) {
      if (choice.id === balanced.answer) continue
      expect(balanced.whyWrong[choice.id], choice.id).toBeTruthy()
    }
  })
})

describe('goal facts for the report prompt', () => {
  const settings = { targetScore: 1600, testDate: '2026-09-01' }

  it('returns nulls for trend and gap without a target score or enough mocks', () => {
    const goal = computeGoalFacts({}, [], [])
    expect(goal.targetScore).toBeNull()
    expect(goal.gapToGoal).toBeNull()
    expect(goal.weeklyTrend).toBeNull()
    expect(goal.mockHistory).toEqual([])
  })

  it('computes a weekly trend from two or more completed mocks', () => {
    const sessions = [
      { type: 'mock', completedAt: '2026-07-01T00:00:00Z', estimatedScore: 1200, rwScore: 600, mathScore: 600 },
      { type: 'mock', completedAt: '2026-07-15T00:00:00Z', estimatedScore: 1300, rwScore: 650, mathScore: 650 },
    ]
    const goal = computeGoalFacts(settings, [], sessions)
    expect(goal.mockHistory).toHaveLength(2)
    expect(goal.weeklyTrend).toBe(50)
    expect(goal.gapToGoal).toBe(1600 - goal.currentEstimate.total)
  })

  it('ignores incomplete or non-mock sessions', () => {
    const sessions = [
      { type: 'adaptive', completedAt: '2026-07-01T00:00:00Z', estimatedScore: 900 },
      { type: 'mock', estimatedScore: 1000 },
    ]
    const goal = computeGoalFacts(settings, [], sessions)
    expect(goal.mockHistory).toEqual([])
    expect(goal.weeklyTrend).toBeNull()
  })
})
