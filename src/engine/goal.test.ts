import { describe, expect, it } from 'vitest'
import { computeGoalProgress } from './goal'
import type { Attempt, LearnerSettings, SessionRecord, SkillState } from '../types'

const settings: LearnerSettings = {
  id: 'learner', name: '', targetScore: 1600, dailyMinutes: 30, theme: 'light', aiModel: 'gemini-3.6-flash-high',
  onboardingComplete: true, testDate: '2026-09-01',
}

const mockSession = (date: string, estimatedScore: number, rwScore?: number, mathScore?: number): SessionRecord => ({
  id: date, type: 'mock', startedAt: date, completedAt: date, questionIds: [], answers: {}, flags: [],
  correct: 80, total: 98, estimatedScore, rwScore, mathScore,
})

describe('goal progress', () => {
  it('reports no trend or projection with fewer than two mocks', () => {
    const progress = computeGoalProgress(settings, [], [], new Date('2026-08-01'))
    expect(progress.mockHistory).toHaveLength(0)
    expect(progress.weeklyTrend).toBeNull()
    expect(progress.projectedScore).toBeNull()
    expect(progress.predictionTrack.actual).toHaveLength(0)
    expect(progress.predictionTrack.current.total).toBe(progress.currentEstimate.total)
    expect(progress.predictionTrack.target?.total).toBe(1600)
    expect(progress.daysRemaining).toBe(31)
    expect(progress.gapToGoal).toBe(1600 - progress.currentEstimate.total)
  })

  it('computes a weekly trend and a bounded linear projection from two or more mocks', () => {
    const sessions = [mockSession('2026-07-01T00:00:00Z', 1200, 610, 590), mockSession('2026-07-15T00:00:00Z', 1300, 660, 640)]
    const progress = computeGoalProgress(settings, [], sessions, new Date('2026-08-01'))
    expect(progress.mockHistory).toEqual([
      { date: '2026-07-01T00:00:00Z', total: 1200, rw: 610, math: 590 },
      { date: '2026-07-15T00:00:00Z', total: 1300, rw: 660, math: 640 },
    ])
    // 100 points over two weeks is 50 points/week.
    expect(progress.weeklyTrend).toBe(50)
    expect(progress.projectedScore).not.toBeNull()
    expect(progress.projectedScore!).toBeGreaterThanOrEqual(1300)
    expect(progress.projectedScore!).toBeLessThanOrEqual(1600)
    expect(progress.onTrackMargin).toBe(progress.projectedScore! - 1600)
    expect(progress.predictionTrack.actual).toHaveLength(2)
    expect(progress.predictionTrack.projection?.total).toBe(progress.projectedScore)
  })

  it('ignores non-mock and incomplete sessions when building history', () => {
    const sessions: SessionRecord[] = [
      { id: 'a', type: 'adaptive', startedAt: 'x', completedAt: 'x', questionIds: [], answers: {}, flags: [], estimatedScore: 900 },
      { id: 'b', type: 'mock', startedAt: 'x', questionIds: [], answers: {}, flags: [], estimatedScore: 1000 },
      mockSession('2026-07-01T00:00:00Z', 1400),
    ]
    const progress = computeGoalProgress(settings, [], sessions)
    expect(progress.mockHistory).toEqual([{ date: '2026-07-01T00:00:00Z', total: 1400, rw: undefined, math: undefined }])
  })

  it('leaves goal fields undefined without a target score or test date, without crashing', () => {
    const bare: LearnerSettings = { id: 'learner', name: '', targetScore: 0, dailyMinutes: 30, theme: 'light', aiModel: 'x', onboardingComplete: true }
    const progress = computeGoalProgress(bare, [], [])
    expect(progress.daysRemaining).toBeUndefined()
    expect(progress.gapToGoal).toBeUndefined()
    expect(progress.projectedScore).toBeNull()
  })

  it('weights the current estimate toward skills with more recorded attempts', () => {
    const states: SkillState[] = [
      { skillId: 'words-in-context', theta: 1.2, alpha: 5, beta: 1, attempts: 10, correct: 9, streak: 3, lapses: 1, avgTimeMs: 40_000, intervalDays: 4, ease: 2.3 },
      { skillId: 'linear-functions', theta: -0.5, alpha: 2, beta: 3, attempts: 3, correct: 1, streak: 0, lapses: 2, avgTimeMs: 60_000, intervalDays: 1, ease: 2.1 },
    ]
    const progress = computeGoalProgress(settings, states, [])
    expect(progress.currentEstimate.rw).toBeGreaterThan(progress.currentEstimate.math)
  })

  it('explains that the live estimate includes practice and mock evidence', () => {
    const attempts: Attempt[] = [
      { id: 'p1', sessionId: 'practice-1', questionId: 'q1', section: 'rw', domain: 'information-ideas', skillId: 'words-in-context', difficulty: 3, response: 'A', correct: true, elapsedMs: 45_000, usedHint: false, createdAt: '2026-08-01T00:00:00Z' },
      { id: 'p2', sessionId: 'practice-1', questionId: 'q2', section: 'math', domain: 'algebra', skillId: 'linear-functions', difficulty: 3, response: 'A', correct: false, elapsedMs: 55_000, usedHint: false, createdAt: '2026-08-01T00:01:00Z' },
    ]
    const sessions: SessionRecord[] = [{ id: 'practice-1', type: 'adaptive', startedAt: '2026-08-01T00:00:00Z', completedAt: '2026-08-01T00:02:00Z', questionIds: ['q1', 'q2'], answers: { q1: 'A', q2: 'A' }, flags: [] }]
    const progress = computeGoalProgress(settings, [], sessions, attempts)
    expect(progress.evidence).toMatchObject({ totalAttempts: 2, rwAttempts: 1, mathAttempts: 1, practiceAttempts: 2, mockAttempts: 0, practiceSessions: 1, fullMocks: 0 })
    expect(progress.estimateJustification).toMatch(/includes|Based on 2 answered responses/)
  })
})
