import { readingQuestionBank } from '../data/readingBank'
import { readingExpansionQuestionBank } from '../data/readingExpansion'
import { skillById } from '../data/curriculum'
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

export const readingMockSkillQuotas: Record<string, number> = Object.fromEntries(
  [...new Set([...Object.keys(rwQuotasModule1), ...Object.keys(rwQuotasModule2)])]
    .map((skillId) => [skillId, (rwQuotasModule1[skillId] ?? 0) + (rwQuotasModule2[skillId] ?? 0)]),
)

export const readingModuleSkillQuotas: Record<1 | 2, Record<string, number>> = {
  1: rwQuotasModule1,
  2: rwQuotasModule2,
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
 * preferred over every fallback item for the same skill so that repeat mocks
 * are not simply the existing bank reshuffled. `fallbackPool` is the released
 * and previously accepted pool used only when fresh generation cannot cover a
 * slot.
 */
export function createReadingModule(module: 1 | 2, seed: number, route: Route = 'routing', excludeIds = new Set<string>(), freshPool: Question[] = [], fallbackPool: Question[] = []): Question[] {
  const quotas = module === 1 ? rwQuotasModule1 : rwQuotasModule2
  const freshReadingPool = freshPool.filter((question) => question.section === 'rw')
  const bank = [...freshReadingPool, ...fallbackPool.filter((question) => question.section === 'rw'), ...readingQuestionBank, ...readingExpansionQuestionBank]
  const chosen: Question[] = []
  for (const [skillId, count] of Object.entries(quotas)) {
    const candidates = bank.filter((question) => question.skillId === skillId && !excludeIds.has(question.id))
    const targets = desiredDifficulties(route, count)
    const freshIds = new Set(freshReadingPool.map((question) => question.id))
    targets.forEach((target) => {
      const available = candidates.filter((question) => !chosen.some((selected) => selected.id === question.id))
      const freshAvailable = available.filter((question) => freshIds.has(question.id))
      const eligible = freshAvailable.length ? freshAvailable : available
      const score = (question: Question) => Math.abs(question.difficulty - target) + seededNoise(question.id, seed) * 0.35
      const selected = [...eligible].sort((a, b) => score(a) - score(b))[0]
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

const mathFormats = [
  'multiple-choice', 'multiple-choice', 'multiple-choice', 'student-produced',
  'multiple-choice', 'multiple-choice', 'student-produced', 'multiple-choice',
  'multiple-choice', 'multiple-choice', 'multiple-choice', 'student-produced',
] as const
const mathFormatAt = (index: number): QuestionFormat => mathFormats[index % mathFormats.length]

const mathSlots = (module: 1 | 2, seed: number) => (module === 1 ? mathModule1Skills : mathModule2Skills)
  .map((skillId, index) => ({ skillId, index }))
  .sort((a, b) => seededNoise(`${a.skillId}-${a.index}`, seed) - seededNoise(`${b.skillId}-${b.index}`, seed))
  .map((slot) => slot.skillId)

const mathDifficultyProfile = (route: Route, count: number, seed: number): Difficulty[] => Array.from({ length: count }, (_, index) => {
  const progress = index / Math.max(1, count - 1)
  const base = route === 'higher' ? 2.2 + progress * 2.35 : route === 'lower' ? 1.05 + progress * 1.8 : 1.15 + progress * 3.45
  const jitter = seededNoise(`math-difficulty-${index}`, seed) > 0.72 ? 0.7 : seededNoise(`math-difficulty-${index}`, seed) < 0.18 ? -0.45 : 0
  return Math.max(1, Math.min(5, Math.round(base + jitter))) as Difficulty
})

export const mathMockSkillQuotas: Record<string, number> = Object.fromEntries(
  [...new Set([...mathModule1Skills, ...mathModule2Skills])]
    .map((skillId) => [skillId, [...mathModule1Skills, ...mathModule2Skills].filter((item) => item === skillId).length]),
)

/**
 * The released forms mix all four Math domains in each module and move from
 * easier to harder items without repeating one narrow template. These are the
 * exact skill slots SATLAS uses for the form; Gemini receives the same slots so
 * its questions are varied in both domain and representation.
 */
export function mathModuleBlueprints(module: 1 | 2, seed: number, route: Route = 'routing') {
  const skills = mathSlots(module, seed + module * 19)
  const difficulties = mathDifficultyProfile(route, skills.length, seed + module * 19)
  return skills.map((skillId, index) => ({
    section: 'math' as const,
    domain: skillById.get(skillId)?.domain ?? 'algebra' as DomainId,
    skillId,
    difficulty: difficulties[index],
    format: mathFormatAt(index),
  }))
}

export function mathMockBlueprints(seed: number, route: Route = 'routing') {
  return ([1, 2] as const).flatMap((module) => mathModuleBlueprints(module, seed, route))
}

export function createMathModule(module: 1 | 2, seed: number, route: Route = 'routing', freshPool: Question[] = [], fallbackPool: Question[] = [], excludeIds = new Set<string>()): Question[] {
  const skills = mathSlots(module, seed + module * 19)
  const difficulties = mathDifficultyProfile(route, skills.length, seed)
  const freshMathPool = freshPool.filter((question) => question.section === 'math' && !excludeIds.has(question.id))
  const fallbackMathPool = fallbackPool.filter((question) => question.section === 'math' && !excludeIds.has(question.id))
  const chosen: Question[] = []
  const questions = skills.map((skillId, index) => {
    const format = mathFormatAt(index)
    const target = difficulties[index]
    const score = (question: Question) => Math.abs(question.difficulty - target) + (question.format === format ? 0 : 0.8) + seededNoise(question.id, seed) * 0.2
    const available = (pool: Question[]) => pool.filter((question) => question.skillId === skillId && !chosen.some((selected) => selected.id === question.id))
    const fresh = [...available(freshMathPool)].sort((a, b) => score(a) - score(b))[0]
    if (fresh) { chosen.push(fresh); return fresh }
    const fallback = [...available(fallbackMathPool)].sort((a, b) => score(a) - score(b))[0]
    const question = fallback ?? generateMathQuestion(skillId, target, seed * 100 + module * 30 + index, format)
    chosen.push(question)
    return question
  })
  return questions.sort((a, b) => a.difficulty - b.difficulty || seededNoise(a.id, seed) - seededNoise(b.id, seed))
}

export function routeModuleOne(questions: Question[], answers: Record<string, string>, pretestQuestionIds = new Set<string>()): 'lower' | 'higher' {
  const scoredQuestions = questions.filter((question) => !pretestQuestionIds.has(question.id))
  const answered = scoredQuestions.filter((question) => answers[question.id] !== undefined)
  if (answered.length === 0) return 'lower'
  const earned = answered.reduce((sum, question) => sum + (isCorrectResponse(question, answers[question.id]) ? 0.75 + question.difficulty * 0.1 : 0), 0)
  const possible = scoredQuestions.reduce((sum, question) => sum + 0.75 + question.difficulty * 0.1, 0)
  return earned / possible >= 0.62 ? 'higher' : 'lower'
}

export function buildInitialMock(seed = Date.now(), freshPool: Question[] = [], fallbackPool: Question[] = []): MockModule[] {
  return [
    { id: 'rw-1', section: 'rw', module: 1, durationSeconds: 32 * 60, questions: createReadingModule(1, seed, 'routing', new Set(), freshPool, fallbackPool), route: 'routing' },
  ]
}

export function buildReadingModuleTwo(seed: number, rwRoute: 'lower' | 'higher', rwModule1: Question[], freshPool: Question[] = [], fallbackPool: Question[] = []): MockModule {
  return { id: 'rw-2', section: 'rw', module: 2, durationSeconds: 32 * 60, questions: createReadingModule(2, seed + 1, rwRoute, new Set(rwModule1.map((question) => question.id)), freshPool, fallbackPool), route: rwRoute }
}

export function buildMathModuleOne(seed: number, freshPool: Question[] = [], fallbackPool: Question[] = []): MockModule {
  return { id: 'math-1', section: 'math', module: 1, durationSeconds: 35 * 60, questions: createMathModule(1, seed + 2, 'routing', freshPool, fallbackPool), route: 'routing' }
}

export function buildRemainingMock(seed: number, rwRoute: 'lower' | 'higher', rwModule1: Question[], freshPool: Question[] = [], fallbackPool: Question[] = []): MockModule[] {
  const rw2 = buildReadingModuleTwo(seed, rwRoute, rwModule1, freshPool, fallbackPool)
  const math1 = buildMathModuleOne(seed, freshPool, fallbackPool)
  return [
    rw2,
    { id: 'break', durationSeconds: 10 * 60, questions: [] },
    math1,
  ]
}

export function buildMathModuleTwo(seed: number, route: 'lower' | 'higher', freshPool: Question[] = [], fallbackPool: Question[] = [], mathModuleOne: Question[] = []): MockModule {
  return { id: 'math-2', section: 'math', module: 2, durationSeconds: 35 * 60, questions: createMathModule(2, seed + 3, route, freshPool, fallbackPool, new Set(mathModuleOne.map((question) => question.id))), route }
}

export function markMockPretestQuestions(modules: MockModule[], seed: number): MockModule[] {
  return modules.map((module, moduleIndex) => {
    if (!module.section || module.questions.length === 0) return module
    const pretestQuestionIds = [...module.questions]
      .sort((a, b) => seededNoise(a.id, seed + moduleIndex * 17) - seededNoise(b.id, seed + moduleIndex * 17))
      .slice(0, Math.min(2, module.questions.length))
      .map((question) => question.id)
    return { ...module, pretestQuestionIds }
  })
}

export function scoreMockSection(questions: Question[], answers: Record<string, string>, route: 'lower' | 'higher', pretestQuestionIds = new Set<string>()) {
  const scoredQuestions = questions.filter((question) => !pretestQuestionIds.has(question.id))
  const correct = scoredQuestions.filter((question) => isCorrectResponse(question, answers[question.id] ?? '')).length
  const proportion = (correct + 1) / (scoredQuestions.length + 2)
  const logit = Math.log(proportion / (1 - proportion)) + (route === 'higher' ? 0.24 : -0.24)
  const score = Math.round((200 + 600 / (1 + Math.exp(-0.92 * logit))) / 10) * 10
  return { correct, total: scoredQuestions.length, presentedTotal: questions.length, pretest: questions.length - scoredQuestions.length, score: Math.max(200, Math.min(800, score)) }
}
