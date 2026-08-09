import { describe, expect, it } from 'vitest'
import { readingQuestionBank } from '../data/readingBank'
import { readingExpansionQuestionBank } from '../data/readingExpansion'
import { buildInitialMock, buildMathModuleOne, buildReadingModuleTwo, createMathModule, createReadingModule, markMockPretestQuestions, readingMockSkillQuotas, routeModuleOne, scoreMockSection } from './mock'

describe('mock blueprint', () => {
  it('starts with only Reading and Writing Module 1', () => {
    const initial = buildInitialMock(42)
    expect(initial).toHaveLength(1)
    expect(initial[0]).toMatchObject({ id: 'rw-1', section: 'rw', module: 1 })
    expect(initial[0].questions).toHaveLength(27)
  })

  it('builds adaptive follow-on modules only when requested', () => {
    const first = buildInitialMock(42)[0]
    const rwHigher = buildReadingModuleTwo(42, 'higher', first.questions)
    const mathOne = buildMathModuleOne(42)
    expect(rwHigher).toMatchObject({ id: 'rw-2', route: 'higher' })
    expect(rwHigher.questions).toHaveLength(27)
    expect(mathOne).toMatchObject({ id: 'math-1', route: 'routing' })
    expect(mathOne.questions).toHaveLength(22)
    expect(rwHigher.questions.some((question) => question.difficulty >= 4)).toBe(true)
  })

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

  it('uses fallback items only when fresh generation has no matching skill slot', () => {
    const fresh = readingQuestionBank.slice(0, 4).map((question, index) => ({
      ...question,
      id: `fresh-rw-${index}`,
      source: 'ai-generated' as const,
    }))
    const fallback = readingQuestionBank.map((question) => ({ ...question, id: `fallback-${question.id}` }))
    const module = createReadingModule(1, 512, 'routing', new Set(), fresh, fallback)
    expect(module.filter((question) => question.id.startsWith('fresh-rw-')).length).toBeGreaterThan(0)
    expect(module).toHaveLength(27)
  })

  it('can fill both R&W modules from a quota-aligned fresh pool', () => {
    const source = [...readingQuestionBank, ...readingExpansionQuestionBank]
    const fresh = Object.entries(readingMockSkillQuotas).flatMap(([skillId, quota]) => source.filter((question) => question.skillId === skillId).slice(0, quota).map((question, index) => ({ ...question, id: `fresh-${skillId}-${index}`, source: 'ai-generated' as const })))
    const first = createReadingModule(1, 512, 'routing', new Set(), fresh)
    const second = createReadingModule(2, 512, 'higher', new Set(first.map((question) => question.id)), fresh)
    expect([...first, ...second]).toHaveLength(54)
    expect([...first, ...second].every((question) => question.source === 'ai-generated')).toBe(true)
  })

  it('still builds a complete module when no generated items exist', () => {
    expect(createReadingModule(1, 512, 'routing', new Set(), [])).toHaveLength(27)
  })

  it('marks two pretest questions per scored module and excludes them from scoring', () => {
    const modules = markMockPretestQuestions([
      { id: 'rw-1', section: 'rw', module: 1, durationSeconds: 1, questions: createReadingModule(1, 512), route: 'routing' },
      { id: 'math-1', section: 'math', module: 1, durationSeconds: 1, questions: createMathModule(1, 512), route: 'routing' },
    ], 512)
    expect(modules.every((module) => module.pretestQuestionIds?.length === 2)).toBe(true)
    const questions = modules[0].questions
    const answers = Object.fromEntries(questions.map((question) => [question.id, question.answer]))
    const score = scoreMockSection(questions, answers, 'lower', new Set(modules[0].pretestQuestionIds))
    expect(score).toMatchObject({ correct: 25, total: 25, presentedTotal: 27, pretest: 2 })
  })

  it('does not let pretest answers influence adaptive routing', () => {
    const questions = createReadingModule(1, 512)
    const pretestIds = new Set(questions.slice(0, 2).map((question) => question.id))
    const answers = Object.fromEntries(questions.map((question) => [question.id, question.answer]))
    const wrongPretestAnswers = { ...answers, [questions[0].id]: '__wrong__', [questions[1].id]: '__wrong__' }
    expect(routeModuleOne(questions, answers, pretestIds)).toBe(routeModuleOne(questions, wrongPretestAnswers, pretestIds))
  })
})
