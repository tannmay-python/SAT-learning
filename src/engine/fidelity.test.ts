import { describe, expect, it } from 'vitest'
import { readingQuestionBank } from '../data/readingBank'
import { officialStimulusDensity } from '../data/officialDensity'
import { generateMathQuestion, mathSkillIds } from './mathGenerators'
import { createMathModule, createReadingModule } from './mock'

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const stimulusWords = (question: (typeof readingQuestionBank)[number]) => words([question.stimulus, question.secondaryStimulus].filter(Boolean).join(' '))
const percentile = (values: number[], proportion: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * proportion)]
}
const medianStimulusWords = (skillId: string) => percentile(
  readingQuestionBank.filter((question) => question.skillId === skillId).map(stimulusWords),
  0.5,
)

const normalizedMathText = (text = '') => text
  .toLowerCase()
  .replace(/\$?-?\d+(?:\.\d+)?(?:\/\d+)?%?/g, '#')
  .replace(/\s+/g, ' ')
  .trim()
const numericTokens = (text = '') => text.match(/-?\d+(?:\.\d+)?/g) ?? []

const mathStructureSignature = (question: ReturnType<typeof generateMathQuestion>) => JSON.stringify({
  format: question.format,
  stimulus: normalizedMathText(question.stimulus),
  prompt: normalizedMathText(question.prompt),
  choices: question.choices?.map((choice) => normalizedMathText(choice.text)),
  table: question.table && {
    headers: question.table.headers.map(normalizedMathText),
    dimensions: [question.table.rows.length, question.table.headers.length],
  },
  plot: question.plot && {
    kind: question.plot.kind,
    xLabel: normalizedMathText(question.plot.xLabel),
    yLabel: normalizedMathText(question.plot.yLabel),
    points: question.plot.points.length,
  },
})

describe('official-mock fidelity guardrails', () => {
  it('keeps Reading and Writing modules in official domain order', () => {
    const module = createReadingModule(1, 814, 'routing')
    const secondModule = createReadingModule(2, 815, 'higher', new Set(module.map((question) => question.id)))
    expect(module).toHaveLength(27)
    expect(secondModule).toHaveLength(27)
    const domainOrder = ['craft-structure', 'information-ideas', 'standard-english', 'expression-ideas']
    const positions = module.map((question) => domainOrder.indexOf(question.domain))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const secondPositions = secondModule.map((question) => domainOrder.indexOf(question.domain))
    expect(secondPositions).toEqual([...secondPositions].sort((a, b) => a - b))

    const quantitativeEvidence = [...module, ...secondModule].filter((question) => question.skillId === 'command-evidence-quantitative')
    expect(quantitativeEvidence).toHaveLength(3)
    expect(new Set(quantitativeEvidence.map((question) => question.id)).size).toBe(3)
    expect(quantitativeEvidence.every((question) => question.table || question.plot)).toBe(true)

    const answerPositions = readingQuestionBank.reduce<Record<string, number>>((counts, question) => ({ ...counts, [question.answer]: (counts[question.answer] ?? 0) + 1 }), {})
    expect(Object.values(answerPositions).every((count) => count >= 15)).toBe(true)
    expect(readingQuestionBank.every((question) => question.misconceptionByChoice?.[question.answer]?.toLowerCase().startsWith('supported'))).toBe(true)
  })

  it('matches official stimulus density measured from the seven released forms', () => {
    expect(readingQuestionBank).toHaveLength(88)
    expect(new Set(readingQuestionBank.map((question) => question.id)).size).toBe(88)

    // Guardrails are the measured official bands, not hand-set numbers. A bank
    // whose passages sit below the official 25th percentile reads lighter than
    // the real form, which is exactly the failure this check exists to catch.
    for (const [skillId, band] of Object.entries(officialStimulusDensity)) {
      const lengths = readingQuestionBank.filter((question) => question.skillId === skillId).map(stimulusWords)
      expect(lengths.length, `${skillId} has no authored items`).toBeGreaterThan(0)

      // Typical item must reach the official median for its type.
      expect(medianStimulusWords(skillId), `${skillId} median`).toBeGreaterThanOrEqual(band.median)
      // No item may fall below the official 25th percentile.
      expect(Math.min(...lengths), `${skillId} shortest item`).toBeGreaterThanOrEqual(band.p25)
      // Nor may any item run past the official long tail.
      expect(Math.max(...lengths), `${skillId} longest item`).toBeLessThanOrEqual(Math.round(band.p95 * 1.12))
    }

    // The official form has a genuine long tail: some Information and Ideas
    // items run past 110 words. A bank clustered at one length is a tell.
    const informationIdeas = readingQuestionBank
      .filter((question) => question.domain === 'information-ideas')
      .map(stimulusWords)
    expect(percentile(informationIdeas, 0.9)).toBeGreaterThanOrEqual(110)
    expect(Math.max(...informationIdeas)).toBeGreaterThanOrEqual(120)

    const discursiveSkills = new Set([
      'text-structure-purpose',
      'cross-text-connections',
      'central-ideas-details',
      'command-evidence-textual',
      'command-evidence-quantitative',
      'inferences',
      'rhetorical-synthesis',
    ])
    const discursiveChoiceLengths = readingQuestionBank
      .filter((question) => discursiveSkills.has(question.skillId))
      .flatMap((question) => question.choices?.map((choice) => words(choice.text)) ?? [])
    expect(percentile(discursiveChoiceLengths, 0.75)).toBeGreaterThanOrEqual(18)
    expect(percentile(discursiveChoiceLengths, 0.9)).toBeGreaterThanOrEqual(21)

    const visualQuestions = readingQuestionBank.filter((question) => question.table || question.plot)
    expect(visualQuestions.filter((question) => question.table)).toHaveLength(3)
    expect(visualQuestions.filter((question) => question.plot)).toHaveLength(3)
    expect(visualQuestions.every((question) => question.skillId === 'command-evidence-quantitative')).toBe(true)
    expect(visualQuestions.every((question) => /data from the (table|graph)/i.test(question.prompt))).toBe(true)
    expect(visualQuestions.every((question) => (question.choices?.filter((choice) => /\d/.test(choice.text)).length ?? 0) >= 2)).toBe(true)
    expect(visualQuestions.every((question) => (question.table?.rows.length ?? question.plot?.points.length ?? 0) >= 3)).toBe(true)
    expect(visualQuestions.every((question) => {
      const stimulusNumbers = new Set(numericTokens(question.stimulus))
      const outcomeNumbers = question.table
        ? question.table.rows.flatMap((row) => row.slice(1).flatMap(numericTokens))
        : question.plot?.points.flatMap((point) => numericTokens(String(point.y))) ?? []
      return outcomeNumbers.length >= 3 && outcomeNumbers.every((value) => !stimulusNumbers.has(value))
    })).toBe(true)
    expect(visualQuestions.length / readingQuestionBank.length * 27).toBeGreaterThanOrEqual(1.8)
  })

  it('uses distinct structures at every adjacent Math difficulty level for every skill', () => {
    for (const [index, skillId] of mathSkillIds.entries()) {
      const seed = 70_000 + index
      const levels = ([1, 2, 3, 4, 5] as const).map((difficulty) => generateMathQuestion(skillId, difficulty, seed))
      for (let difficultyIndex = 1; difficultyIndex < levels.length; difficultyIndex += 1) {
        expect(
          mathStructureSignature(levels[difficultyIndex]),
          `${skillId}: D${difficultyIndex} and D${difficultyIndex + 1}`,
        ).not.toBe(mathStructureSignature(levels[difficultyIndex - 1]))
      }
    }
  })

  it('makes hard Math structurally richer rather than merely changing numbers', () => {
    const easy = mathSkillIds.map((skillId, index) => generateMathQuestion(skillId, 1, 70_000 + index))
    const hard = mathSkillIds.map((skillId, index) => generateMathQuestion(skillId, 5, 70_000 + index))
    const informationSize = (question: (typeof hard)[number]) => words(`${question.stimulus ?? ''} ${question.prompt}`) + (question.table?.rows.flat().length ?? 0)
    const richer = hard.filter((question, index) => informationSize(question) > informationSize(easy[index]) || Boolean(question.table && !easy[index].table))
    expect(richer.length).toBeGreaterThanOrEqual(15)
    expect(hard.filter((question) => question.table || question.plot).length).toBeGreaterThanOrEqual(4)
    expect(hard.reduce((sum, question) => sum + question.estimatedSeconds, 0)).toBeGreaterThan(easy.reduce((sum, question) => sum + question.estimatedSeconds, 0))
  })

  it('keeps a realistic mixture of multiple-choice and student-produced responses', () => {
    const routing = createMathModule(1, 932, 'routing')
    const higher = createMathModule(2, 933, 'higher')
    for (const module of [routing, higher]) {
      expect(module).toHaveLength(22)
      const studentProduced = module.filter((question) => question.format === 'student-produced').length
      expect(studentProduced).toBeGreaterThanOrEqual(3)
      expect(studentProduced).toBeLessThanOrEqual(7)
    }
  })
})

describe('blank convention in the authored bank', () => {
  // Mirrors blankConventionFault in server/antigravity.mjs. A generated item
  // once shipped as "...for decades ____ their design..." with a choice of
  // "decades;", which reads back as "for decades decades;". The authored bank
  // is held to the same rule.
  const blankSkills = new Set(['boundaries', 'form-structure-sense', 'transitions', 'words-in-context', 'inferences'])

  it('gives every blank-format item exactly one blank', () => {
    for (const question of readingQuestionBank) {
      const blanks = (question.stimulus?.match(/_{2,}/g) ?? []).length
      if (blankSkills.has(question.skillId)) expect(blanks, `${question.id} should have one blank`).toBe(1)
      else expect(blanks, `${question.id} should have no blank`).toBe(0)
    }
  })

  it('never leaves the word a choice supplies sitting beside the blank', () => {
    for (const question of readingQuestionBank) {
      if (!/_{2,}/.test(question.stimulus ?? '')) continue
      for (const choice of question.choices ?? []) {
        const filled = question.stimulus!.replace(/_{2,}/, choice.text).replace(/\s+/g, ' ')
        const repeat = filled.match(/\b([A-Za-z]{3,})\b[\s,;:]+\1\b/i)
        expect(repeat?.[1], `${question.id} choice ${choice.id} repeats "${repeat?.[1]}"`).toBeUndefined()
      }
    }
  })

  it('asks each skill its official question stem', () => {
    const stems: Record<string, RegExp> = {
      'words-in-context': /most logical and precise word or phrase|most nearly mean/i,
      transitions: /most logical transition/i,
      boundaries: /conforms to the conventions of Standard English/i,
      'form-structure-sense': /conforms to the conventions of Standard English/i,
      inferences: /most logically completes the text/i,
      'rhetorical-synthesis': /most effectively uses relevant information from the notes/i,
    }
    for (const question of readingQuestionBank) {
      const stem = stems[question.skillId]
      if (stem) expect(question.prompt, `${question.id} stem`).toMatch(stem)
    }
  })
})
