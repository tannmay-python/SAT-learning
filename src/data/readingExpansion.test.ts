import { describe, expect, it } from 'vitest'
import { densityCeiling, densityFloor, officialStimulusDensity } from './officialDensity'
import { readingExpansionQuestionBank } from './readingExpansion'

const blankSkills = new Set(['boundaries', 'form-structure-sense', 'transitions', 'words-in-context', 'inferences'])
const expectedSkills = [
  'words-in-context', 'text-structure-purpose', 'cross-text-connections',
  'central-ideas-details', 'command-evidence-textual', 'command-evidence-quantitative', 'inferences',
  'boundaries', 'form-structure-sense', 'transitions', 'rhetorical-synthesis',
]

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length

describe('Reading and Writing expansion bank', () => {
  it('contains two complete, disjoint authored batches', () => {
    expect(readingExpansionQuestionBank).toHaveLength(500)
    expect(new Set(readingExpansionQuestionBank.map((question) => question.id)).size).toBe(500)
    expect(readingExpansionQuestionBank.every((question) => question.source === 'local-original')).toBe(true)
    expect(readingExpansionQuestionBank.every((question) => question.section === 'rw')).toBe(true)
    expect(readingExpansionQuestionBank.every((question) => question.choices?.length === 4)).toBe(true)
    expect(readingExpansionQuestionBank.every((question) => question.choices?.every((choice) => choice.text.trim().length > 0))).toBe(true)
  })

  it('covers the curriculum with valid stems, answers, explanations, and distractor diagnoses', () => {
    const skills = new Set(readingExpansionQuestionBank.map((question) => question.skillId))
    expect(expectedSkills.every((skillId) => skills.has(skillId))).toBe(true)
    const blankErrors: string[] = []
    const answerErrors: string[] = []
    for (const question of readingExpansionQuestionBank) {
      expect(question.answer, `${question.id} answer`).toMatch(/^[ABCD]$/)
      expect(words(question.explanation), `${question.id} explanation`).toBeGreaterThanOrEqual(12)
      expect(Object.keys(question.misconceptionByChoice ?? {}), `${question.id} misconceptions`).toHaveLength(4)
      if (!question.misconceptionByChoice?.[question.answer]?.toLowerCase().startsWith('supported')) answerErrors.push(`${question.id}: ${question.misconceptionByChoice?.[question.answer] ?? 'missing'}`)
      const blanks = (question.stimulus?.match(/_{2,}/g) ?? []).length
      if (blankSkills.has(question.skillId) && blanks !== 1) blankErrors.push(`${question.id}: expected 1 blank, found ${blanks}`)
      if (!blankSkills.has(question.skillId) && blanks !== 0) blankErrors.push(`${question.id}: expected 0 blanks, found ${blanks}`)
      if (question.skillId === 'words-in-context') expect(question.prompt).toMatch(/logical and precise word or phrase/i)
      if (question.skillId === 'transitions') expect(question.prompt).toMatch(/logical transition/i)
      if (question.skillId === 'boundaries' || question.skillId === 'form-structure-sense') expect(question.prompt).toMatch(/conventions of Standard English/i)
      if (question.skillId === 'inferences') expect(question.prompt).toMatch(/most logically completes the text/i)
      if (question.skillId === 'rhetorical-synthesis') expect(question.prompt).toMatch(/most effectively uses (relevant information from the notes|the notes)/i)
      if (question.skillId === 'cross-text-connections') expect(question.secondaryStimulus, `${question.id} paired text`).toBeTruthy()
      if (question.skillId === 'command-evidence-quantitative') expect(question.table || question.plot, `${question.id} data display`).toBeTruthy()
    }
    expect(blankErrors).toEqual([])
    expect(answerErrors).toEqual([])
  })

  it('has SAT-like passage and choice density rather than 500 short placeholders', () => {
    const discursive = new Set(['text-structure-purpose', 'cross-text-connections', 'central-ideas-details', 'command-evidence-textual', 'command-evidence-quantitative', 'inferences', 'rhetorical-synthesis'])
    const lengths = readingExpansionQuestionBank.map((question) => words(`${question.stimulus ?? ''} ${question.secondaryStimulus ?? ''}`))
    const discursiveChoices = readingExpansionQuestionBank
      .filter((question) => discursive.has(question.skillId))
      .flatMap((question) => question.choices?.map((choice) => words(choice.text)) ?? [])
    for (const skillId of Object.keys(officialStimulusDensity)) {
      const skillLengths = readingExpansionQuestionBank
        .filter((question) => question.skillId === skillId)
        .map((question) => words(`${question.stimulus ?? ''} ${question.secondaryStimulus ?? ''}`))
      expect(Math.min(...skillLengths), `${skillId} floor`).toBeGreaterThanOrEqual(densityFloor(skillId))
      expect(Math.max(...skillLengths), `${skillId} ceiling`).toBeLessThanOrEqual(densityCeiling(skillId))
    }
    expect(discursiveChoices.filter((length) => length >= 12).length).toBeGreaterThanOrEqual(120)
  })
})
