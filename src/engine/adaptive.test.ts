import { describe, expect, it } from 'vitest'
import { defaultSkillState, expectedSuccess, masteryPercent, mixedSectionPlan, planReadingBlueprint, recommendedDifficulty, sectionTargetDifficulty, selectNextQuestion, targetDifficulty, updateSkillState, weakerSection } from './adaptive'
import type { Attempt } from '../types'

const attempt = (correct: boolean, difficulty = 3): Attempt => ({
  id: crypto.randomUUID(), sessionId: 'test', questionId: 'q', section: 'math', domain: 'algebra',
  skillId: 'linear-functions', difficulty: difficulty as 1 | 2 | 3 | 4 | 5, response: 'A', correct,
  confidence: 'high', elapsedMs: 60_000, usedHint: false, createdAt: '2026-08-06T00:00:00.000Z',
})

describe('adaptive learner model', () => {
  it('raises ability and mastery after correct evidence', () => {
    const initial = defaultSkillState('linear-functions')
    const updated = updateSkillState(initial, attempt(true))
    expect(updated.theta).toBeGreaterThan(initial.theta)
    expect(masteryPercent(updated)).toBeGreaterThan(50)
    expect(updated.dueAt).toBeTruthy()
  })

  it('lowers ability and schedules a rapid retry after an error', () => {
    const initial = defaultSkillState('linear-functions')
    const updated = updateSkillState(initial, attempt(false, 2))
    expect(updated.theta).toBeLessThan(initial.theta)
    expect(updated.intervalDays).toBeLessThan(1)
    expect(updated.lapses).toBe(1)
  })

  it('targets harder questions as ability grows', () => {
    const state = { ...defaultSkillState('linear-functions'), theta: 1.5, attempts: 12 }
    expect(targetDifficulty(state)).toBeGreaterThanOrEqual(4)
    expect(expectedSuccess(state.theta, targetDifficulty(state))).toBeGreaterThan(0.65)
  })

  it('treats an omitted confidence rating as neutral evidence', () => {
    const initial = defaultSkillState('linear-functions')
    const rated = updateSkillState(initial, { ...attempt(true), confidence: 'medium' })
    const unrated = updateSkillState(initial, { ...attempt(true), confidence: undefined })
    expect(unrated.theta).toBeCloseTo(rated.theta, 10)
    expect(unrated.alpha).toBeCloseTo(rated.alpha, 10)
  })

  it('raises a section baseline after sustained success at one level', () => {
    const evidence = Array.from({ length: 10 }, (_, index) => ({ ...attempt(index !== 9, 2), id: `a-${index}` }))
    expect(sectionTargetDifficulty(evidence, 'math')).toBe(3)
  })

  it('uses an analyst difficulty directive instead of silently falling back to level 2', () => {
    const state = { ...defaultSkillState('linear-functions'), attempts: 1, correct: 1, streak: 1 }
    const directive = { skillId: 'linear-functions', priority: 0.8, targetDifficulty: 3 as const, reason: 'Advance.', evidenceIds: ['a-1'] }
    expect(recommendedDifficulty(state, directive, 3)).toBe(3)
  })

  it('builds a genuinely balanced mixed section plan', () => {
    const plan = mixedSectionPlan(15, 'math')
    expect(plan.filter((section) => section === 'math')).toHaveLength(8)
    expect(plan.filter((section) => section === 'rw')).toHaveLength(7)
    expect(plan.every((section, index) => index === 0 || section !== plan[index - 1])).toBe(true)
  })

  it('selects inside the requested subject and at the calibrated difficulty', () => {
    const questions = [
      { id: 'rw-2', section: 'rw', skillId: 'words-in-context', difficulty: 2 },
      { id: 'rw-3', section: 'rw', skillId: 'words-in-context', difficulty: 3 },
      { id: 'math-3', section: 'math', skillId: 'linear-functions', difficulty: 3 },
    ] as never[]
    const next = selectNextQuestion(questions, new Map(), new Set(), undefined, [], 'rw', 3)
    expect(next?.id).toBe('rw-3')
  })

  it('treats target difficulty as a constraint when an exact fit exists', () => {
    const questions = [
      { id: 'weak-easy', section: 'math', skillId: 'weak', difficulty: 1 },
      { id: 'steady-target', section: 'math', skillId: 'steady', difficulty: 3 },
    ] as never[]
    const states = new Map([['weak', { skillId: 'weak', theta: -2, alpha: 1, beta: 4, attempts: 8, correct: 2, streak: 0, lapses: 3 }]]) as never
    const next = selectNextQuestion(questions, states, new Set(), undefined, [], 'math', 3)
    expect(next?.id).toBe('steady-target')
  })

  it('starts mixed work with the section that needs more evidence', () => {
    const rw = Array.from({ length: 10 }, (_, index) => ({ ...attempt(true, 2), id: `rw-${index}`, section: 'rw' as const }))
    const math = Array.from({ length: 10 }, (_, index) => ({ ...attempt(index < 6, 2), id: `math-${index}` }))
    expect(weakerSection([...rw, ...math])).toBe('math')
  })

  it('plans a varied set of fresh Reading and Writing requests at the current section level', () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: `rw-${index}`, section: 'rw', domain: 'information-ideas', skillId: `skill-${index}`, difficulty: 3,
    })) as never[]
    const blueprint = planReadingBlueprint(questions, 4, new Map(), new Set(), [], 3)
    expect(blueprint).toHaveLength(4)
    expect(new Set(blueprint.map((item) => item.skillId)).size).toBe(4)
    expect(blueprint.every((item) => item.section === 'rw' && item.difficulty === 3)).toBe(true)
  })

  it('can plan an exact mock quota so every generated slot maps to a form slot', () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({
      id: `rw-${index}`, section: 'rw', domain: 'information-ideas', skillId: `skill-${index % 2}`, difficulty: 3,
    })) as never[]
    const blueprint = planReadingBlueprint(questions, 54, new Map(), new Set(), [], 3, { 'skill-0': 4, 'skill-1': 2 })
    expect(blueprint).toHaveLength(6)
    expect(blueprint.filter((item) => item.skillId === 'skill-0')).toHaveLength(4)
    expect(blueprint.filter((item) => item.skillId === 'skill-1')).toHaveLength(2)
  })
})
