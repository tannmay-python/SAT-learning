import { describe, expect, it } from 'vitest'
import { createMathModule, createReadingModule, routeModuleOne } from './mock'

describe('mock blueprint', () => {
  it('builds official-length routing modules', () => {
    const rw = createReadingModule(1, 42)
    const math = createMathModule(1, 42)
    expect(rw).toHaveLength(27)
    expect(math).toHaveLength(22)
    expect(new Set(rw.map((question) => question.id)).size).toBe(27)
    expect(new Set(math.map((question) => question.id)).size).toBe(22)
  })

  it('contains all four domains in each module', () => {
    const rw = createReadingModule(2, 42, 'higher')
    const math = createMathModule(2, 42, 'higher')
    expect(new Set(rw.map((question) => question.domain)).size).toBe(4)
    expect(new Set(math.map((question) => question.domain)).size).toBe(4)
  })

  it('routes strong performance higher and blank performance lower', () => {
    const questions = createReadingModule(1, 42)
    expect(routeModuleOne(questions, {})).toBe('lower')
    expect(routeModuleOne(questions, Object.fromEntries(questions.map((question) => [question.id, question.answer])))).toBe('higher')
  })

  it('makes the higher route harder on average', () => {
    const lower = createMathModule(2, 7, 'lower')
    const higher = createMathModule(2, 7, 'higher')
    const average = (values: typeof lower) => values.reduce((sum, question) => sum + question.difficulty, 0) / values.length
    expect(average(higher)).toBeGreaterThan(average(lower))
  })
})

