import { describe, expect, it } from 'vitest'
import { readingQuestionBank } from '../data/readingBank'
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

  it('matches the official Reading and Writing skill order and scarcity of paired texts', () => {
    const first = createReadingModule(1, 42)
    const second = createReadingModule(2, 43, 'higher', new Set(first.map((question) => question.id)))
    const skillOrder = ['words-in-context', 'text-structure-purpose', 'cross-text-connections', 'central-ideas-details', 'command-evidence-textual', 'command-evidence-quantitative', 'inferences', 'boundaries', 'form-structure-sense', 'transitions', 'rhetorical-synthesis']
    for (const module of [first, second]) {
      const positions = module.map((question) => skillOrder.indexOf(question.skillId))
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    }
    expect(first.filter((question) => question.skillId === 'command-evidence-quantitative')).toHaveLength(1)
    expect(second.filter((question) => question.skillId === 'command-evidence-quantitative')).toHaveLength(2)
    expect([...first, ...second].filter((question) => question.skillId === 'cross-text-connections')).toHaveLength(1)
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

  it('prefers freshly generated items over the authored bank without leaving gaps', () => {
    const fresh = readingQuestionBank.slice(0, 20).map((question, index) => ({
      ...question,
      id: `ai-rw-fixture-${index}`,
      source: 'ai-generated' as const,
    }))
    const module = createReadingModule(1, 512, 'routing', new Set(), fresh)
    expect(module).toHaveLength(27)
    const freshUsed = module.filter((question) => question.id.startsWith('ai-rw-fixture-'))
    expect(freshUsed.length).toBeGreaterThan(0)
    expect(new Set(module.map((question) => question.id)).size).toBe(27)
  })

  it('still builds a complete module when no generated items exist', () => {
    expect(createReadingModule(1, 512, 'routing', new Set(), [])).toHaveLength(27)
  })
})
