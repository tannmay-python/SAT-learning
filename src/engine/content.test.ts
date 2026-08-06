import { describe, expect, it } from 'vitest'
import { curriculum, skillById } from '../data/curriculum'
import { readingQuestionBank } from '../data/readingBank'
import type { Question } from '../types'
import { generateMathQuestion, mathSkillIds } from './mathGenerators'
import { createMathModule, createReadingModule } from './mock'

function expectValidQuestion(question: Question) {
  expect(skillById.has(question.skillId), `${question.id} has an unknown skill`).toBe(true)
  expect(question.prompt.trim().length, `${question.id} has no prompt`).toBeGreaterThan(7)
  expect(question.explanation.trim().length, `${question.id} has no explanation`).toBeGreaterThan(20)
  expect(question.concept.trim().length, `${question.id} has no concept reset`).toBeGreaterThan(8)
  expect(question.difficulty).toBeGreaterThanOrEqual(1)
  expect(question.difficulty).toBeLessThanOrEqual(5)
  if (question.format === 'multiple-choice') {
    expect(question.choices, `${question.id} has no choices`).toHaveLength(4)
    expect(new Set(question.choices?.map((choice) => choice.text.trim().toLowerCase())).size, `${question.id} repeats a choice`).toBe(4)
    expect(question.choices?.some((choice) => choice.id === question.answer), `${question.id} has an invalid answer key`).toBe(true)
  } else {
    expect((question.acceptedAnswers ?? [question.answer]).length, `${question.id} has no accepted response`).toBeGreaterThan(0)
  }
}

describe('SAT content system', () => {
  it('maps every generated skill to a complete lesson', () => {
    expect(curriculum.length).toBeGreaterThanOrEqual(30)
    expect(new Set(curriculum.map((topic) => topic.id)).size).toBe(curriculum.length)
    expect(mathSkillIds.every((skillId) => skillById.has(skillId))).toBe(true)
    expect(new Set(readingQuestionBank.map((question) => question.skillId)).size).toBe(11)
  })

  it('keeps the original reading bank structurally valid and unique', () => {
    expect(readingQuestionBank.length).toBeGreaterThanOrEqual(81)
    expect(new Set(readingQuestionBank.map((question) => question.id)).size).toBe(readingQuestionBank.length)
    readingQuestionBank.forEach(expectValidQuestion)
  })

  it('generates valid math items for every skill, difficulty, and response format', () => {
    const questions = mathSkillIds.flatMap((skillId, skillIndex) => ([1, 2, 3, 4, 5] as const).flatMap((difficulty) => [
      generateMathQuestion(skillId, difficulty, 50_000 + skillIndex * 100 + difficulty * 2, 'multiple-choice'),
      generateMathQuestion(skillId, difficulty, 50_001 + skillIndex * 100 + difficulty * 2, 'student-produced'),
    ]))
    expect(questions).toHaveLength(mathSkillIds.length * 10)
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    questions.forEach(expectValidQuestion)
  })

  it('builds a 98-question adaptive mock with the official domain totals', () => {
    const rw1 = createReadingModule(1, 20260806, 'routing')
    const rw2 = createReadingModule(2, 20260807, 'higher', new Set(rw1.map((question) => question.id)))
    const math1 = createMathModule(1, 20260808, 'routing')
    const math2 = createMathModule(2, 20260809, 'higher')
    const all = [...rw1, ...rw2, ...math1, ...math2]
    expect(all).toHaveLength(98)
    expect(new Set(all.map((question) => question.id)).size).toBe(98)
    const counts = all.reduce<Record<string, number>>((result, question) => {
      result[question.domain] = (result[question.domain] ?? 0) + 1
      return result
    }, {})
    expect(counts).toMatchObject({
      'craft-structure': 15,
      'information-ideas': 14,
      'standard-english': 14,
      'expression-ideas': 11,
      algebra: 15,
      'advanced-math': 15,
      'problem-solving-data': 7,
      'geometry-trigonometry': 7,
    })
  })
})
