import { describe, expect, it } from 'vitest'
import { buildLearningInsights } from './insights'
import type { Attempt } from '../types'

const makeAttempt = (id: string, section: 'rw' | 'math', skillId: string, correct: boolean, elapsedMs: number, createdAt: string, difficulty = 2): Attempt => ({
  id,
  sessionId: 'session-1',
  questionId: `q-${id}`,
  section,
  domain: section === 'rw' ? 'information-ideas' : 'algebra',
  skillId,
  difficulty: difficulty as Attempt['difficulty'],
  response: 'A',
  correct,
  elapsedMs,
  usedHint: false,
  createdAt,
  questionSnapshot: {
    id: `q-${id}`, section, domain: section === 'rw' ? 'information-ideas' : 'algebra', skillId,
    difficulty: difficulty as Attempt['difficulty'], format: 'multiple-choice', prompt: 'A complete prompt?',
    choices: [{ id: 'A', text: 'Yes' }, { id: 'B', text: 'No' }, { id: 'C', text: 'Maybe' }, { id: 'D', text: 'Never' }],
    answer: 'A', explanation: 'Because the evidence supports this choice.', concept: 'Read the evidence.', estimatedSeconds: 60, source: 'local-original',
  },
})

describe('historical learning insights', () => {
  it('aggregates activity, accuracy, pace, section, skill, and difficulty history', () => {
    const attempts = [
      makeAttempt('1', 'rw', 'inferences', true, 30_000, '2026-08-05T10:00:00.000Z', 2),
      makeAttempt('2', 'rw', 'inferences', false, 90_000, '2026-08-06T10:00:00.000Z', 3),
      makeAttempt('3', 'math', 'linear-functions', true, 60_000, '2026-08-06T11:00:00.000Z', 3),
    ]
    const result = buildLearningInsights(attempts, [{ id: 'session-1', type: 'adaptive', startedAt: '2026-08-06T10:00:00.000Z', completedAt: '2026-08-06T11:10:00.000Z', questionIds: [], answers: {}, flags: [] }], new Date('2026-08-06T12:00:00.000Z'))
    expect(result.overall).toMatchObject({ total: 3, correct: 2, accuracy: 67, averageSeconds: 60, averageTargetSeconds: 60 })
    expect(result.bySection.rw).toMatchObject({ total: 2, correct: 1 })
    expect(result.byDifficulty[3]).toMatchObject({ total: 2, correct: 1 })
    expect(result.bySkill[0]).toMatchObject({ skillId: 'inferences', total: 2 })
    expect(result.activeDays).toBe(2)
    expect(result.totalMinutes).toBe(3)
    expect(result.daily.at(-1)).toMatchObject({ date: '2026-08-06', total: 2 })
  })
})

