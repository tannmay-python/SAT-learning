import { describe, expect, it } from 'vitest'
import { readingQuestionBank } from '../data/readingBank'
import { generateMathQuestion, mathSkillIds } from './mathGenerators'
import { createMathModule, createReadingModule } from './mock'

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const stimulusWords = (question: (typeof readingQuestionBank)[number]) => words([question.stimulus, question.secondaryStimulus].filter(Boolean).join(' '))

describe('official-mock fidelity guardrails', () => {
  it('keeps Reading and Writing modules in official domain order with dense hard passages', () => {
    const module = createReadingModule(1, 814, 'routing')
    expect(module).toHaveLength(27)
    const domainOrder = ['craft-structure', 'information-ideas', 'standard-english', 'expression-ideas']
    const positions = module.map((question) => domainOrder.indexOf(question.domain))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))

    const hardReading = readingQuestionBank.filter((question) => question.difficulty >= 4 && ['craft-structure', 'information-ideas'].includes(question.domain))
    const lengths = hardReading.map(stimulusWords).sort((a, b) => a - b)
    const median = lengths[Math.floor(lengths.length / 2)]
    expect(hardReading.length).toBeGreaterThanOrEqual(20)
    expect(median).toBeGreaterThanOrEqual(25)
    expect(readingQuestionBank.filter((question) => question.table).length).toBeGreaterThanOrEqual(3)
    const answerPositions = readingQuestionBank.reduce<Record<string, number>>((counts, question) => ({ ...counts, [question.answer]: (counts[question.answer] ?? 0) + 1 }), {})
    expect(Object.values(answerPositions).every((count) => count >= 15)).toBe(true)
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
