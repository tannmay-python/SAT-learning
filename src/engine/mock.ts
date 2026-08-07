import { readingQuestionBank } from '../data/readingBank'
import type { Difficulty, DomainId, MockModule, Question, QuestionFormat } from '../types'
import { generateMathQuestion } from './mathGenerators'
import { isCorrectResponse } from './questions'

type Route = 'routing' | 'lower' | 'higher'

const rwDomainOrder: DomainId[] = ['craft-structure', 'information-ideas', 'standard-english', 'expression-ideas']
const rwSkillOrder = [
  'words-in-context', 'text-structure-purpose', 'cross-text-connections',
  'central-ideas-details', 'command-evidence-textual', 'command-evidence-quantitative', 'inferences',
  'boundaries', 'form-structure-sense',
  'transitions', 'rhetorical-synthesis',
]

const rwQuotasModule1: Record<string, number> = {
  'words-in-context': 4,
  'text-structure-purpose': 3,
  'cross-text-connections': 1,
  'central-ideas-details': 2,
  'command-evidence-textual': 2,
  'command-evidence-quantitative': 1,
  inferences: 2,
  boundaries: 4,
  'form-structure-sense': 3,
  'rhetorical-synthesis': 2,
  transitions: 3,
}

const rwQuotasModule2: Record<string, number> = {
  'words-in-context': 4,
  'text-structure-purpose': 3,
  'cross-text-connections': 0,
  'central-ideas-details': 2,
  'command-evidence-textual': 1,
  'command-evidence-quantitative': 2,
  inferences: 2,
  boundaries: 3,
  'form-structure-sense': 4,
  'rhetorical-synthesis': 3,
  transitions: 3,
}

const desiredDifficulties = (route: Route, count: number): Difficulty[] => {
  const patterns: Record<Route, Difficulty[]> = {
    routing: [1, 3, 5, 2, 4],
    lower: [1, 2, 2, 3, 1],
    higher: [3, 4, 5, 4, 5],
  }
  return Array.from({ length: count }, (_, index) => patterns[route][index % patterns[route].length])
}

const seededNoise = (id: string, seed: number) => {
  let hash = seed | 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  return ((hash >>> 0) % 1000) / 1000
}

/**
 * `freshPool` holds Gemini-written items prepared for this sitting. They are
 * preferred over authored items for the same skill so that repeat mocks are not
 * simply the 88-item bank reshuffled; the bank still fills every slot the pool
 * cannot cover, so a failed or skipped generation degrades to the old behaviour.
 */
export function createReadingModule(module: 1 | 2, seed: number, route: Route = 'routing', excludeIds = new Set<string>(), freshPool: Question[] = []): Question[] {
  const quotas = module === 1 ? rwQuotasModule1 : rwQuotasModule2
  const bank = [...freshPool.filter((question) => question.section === 'rw'), ...readingQuestionBank]
  const chosen: Question[] = []
  for (const [skillId, count] of Object.entries(quotas)) {
    const candidates = bank.filter((question) => question.skillId === skillId && !excludeIds.has(question.id))
    const targets = desiredDifficulties(route, count)
    const freshIds = new Set(freshPool.map((question) => question.id))
    targets.forEach((target) => {
      const available = candidates.filter((question) => !chosen.some((selected) => selected.id === question.id))
      const score = (question: Question) =>
        Math.abs(question.difficulty - target) + seededNoise(question.id, seed) * 0.35 - (freshIds.has(question.id) ? 0.5 : 0)
      const selected = [...available].sort((a, b) => score(a) - score(b))[0]
      if (selected) chosen.push(selected)
    })
  }
  return chosen.sort((a, b) => {
    const domain = rwDomainOrder.indexOf(a.domain) - rwDomainOrder.indexOf(b.domain)
    if (domain !== 0) return domain
    if (a.skillId !== b.skillId) return rwSkillOrder.indexOf(a.skillId) - rwSkillOrder.indexOf(b.skillId)
    return a.difficulty - b.difficulty
  })
}

const mathModule1Skills = [
  'linear-equations-one-variable', 'linear-equations-two-variables', 'linear-functions', 'systems-linear-equations', 'linear-inequalities', 'linear-equations-one-variable', 'linear-functions', 'systems-linear-equations',
  'equivalent-expressions', 'nonlinear-equations', 'nonlinear-functions', 'systems-nonlinear', 'equivalent-expressions', 'nonlinear-equations', 'nonlinear-functions',
  'ratios-rates-units', 'percentages', 'one-variable-data', 'probability',
  'area-volume', 'lines-angles-triangles', 'right-triangle-trig',
]

const mathModule2Skills = [
  'linear-equations-one-variable', 'linear-equations-two-variables', 'linear-functions', 'systems-linear-equations', 'linear-inequalities', 'linear-equations-two-variables', 'systems-linear-equations',
  'equivalent-expressions', 'nonlinear-equations', 'nonlinear-functions', 'systems-nonlinear', 'equivalent-expressions', 'nonlinear-equations', 'nonlinear-functions', 'systems-nonlinear',
  'two-variable-data', 'sampling-margin-error', 'statistical-claims',
  'area-volume', 'lines-angles-triangles', 'right-triangle-trig', 'circles',
]

export function createMathModule(module: 1 | 2, seed: number, route: Route = 'routing'): Question[] {
  const skills = module === 1 ? mathModule1Skills : mathModule2Skills
  const difficulties = desiredDifficulties(route, skills.length)
  const questions = skills.map((skillId, index) => {
    const format: QuestionFormat = index % 4 === 3 ? 'student-produced' : 'multiple-choice'
    return generateMathQuestion(skillId, difficulties[index], seed * 100 + module * 30 + index, format)
  })
  return questions.sort((a, b) => a.difficulty - b.difficulty || seededNoise(a.id, seed) - seededNoise(b.id, seed))
}

export function routeModuleOne(questions: Question[], answers: Record<string, string>): 'lower' | 'higher' {
  const answered = questions.filter((question) => answers[question.id] !== undefined)
  if (answered.length === 0) return 'lower'
  const earned = answered.reduce((sum, question) => sum + (isCorrectResponse(question, answers[question.id]) ? 0.75 + question.difficulty * 0.1 : 0), 0)
  const possible = questions.reduce((sum, question) => sum + 0.75 + question.difficulty * 0.1, 0)
  return earned / possible >= 0.62 ? 'higher' : 'lower'
}

export function buildInitialMock(seed = Date.now(), freshPool: Question[] = []): MockModule[] {
  return [
    { id: 'rw-1', section: 'rw', module: 1, durationSeconds: 32 * 60, questions: createReadingModule(1, seed, 'routing', new Set(), freshPool), route: 'routing' },
  ]
}

export function buildRemainingMock(seed: number, rwRoute: 'lower' | 'higher', rwModule1: Question[], freshPool: Question[] = []): MockModule[] {
  const rw2 = createReadingModule(2, seed + 1, rwRoute, new Set(rwModule1.map((question) => question.id)), freshPool)
  return [
    { id: 'rw-2', section: 'rw', module: 2, durationSeconds: 32 * 60, questions: rw2, route: rwRoute },
    { id: 'break', durationSeconds: 10 * 60, questions: [] },
    { id: 'math-1', section: 'math', module: 1, durationSeconds: 35 * 60, questions: createMathModule(1, seed + 2, 'routing'), route: 'routing' },
  ]
}

export function buildMathModuleTwo(seed: number, route: 'lower' | 'higher'): MockModule {
  return { id: 'math-2', section: 'math', module: 2, durationSeconds: 35 * 60, questions: createMathModule(2, seed + 3, route), route }
}

export function scoreMockSection(questions: Question[], answers: Record<string, string>, route: 'lower' | 'higher') {
  const correct = questions.filter((question) => isCorrectResponse(question, answers[question.id] ?? '')).length
  const proportion = (correct + 1) / (questions.length + 2)
  const logit = Math.log(proportion / (1 - proportion)) + (route === 'higher' ? 0.24 : -0.24)
  const score = Math.round((200 + 600 / (1 + Math.exp(-0.92 * logit))) / 10) * 10
  return { correct, total: questions.length, score: Math.max(200, Math.min(800, score)) }
}
