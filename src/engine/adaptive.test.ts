import { describe, expect, it } from 'vitest'
import { defaultSkillState, expectedSuccess, masteryPercent, targetDifficulty, updateSkillState } from './adaptive'
import type { Attempt } from '../types'

const attempt = (correct: boolean, difficulty = 3): Attempt => ({
  id: crypto.randomUUID(), sessionId: 'test', questionId: 'q', section: 'math', domain: 'algebra',
  skillId: 'linear-functions', difficulty: difficulty as 1 | 2 | 3 | 4 | 5, response: 'A', correct,
  confidence: 'confident', elapsedMs: 60_000, usedHint: false, createdAt: '2026-08-06T00:00:00.000Z',
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
})
