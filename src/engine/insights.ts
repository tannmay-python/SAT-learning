import type { Attempt, Difficulty, SectionId, SessionRecord } from '../types'

export interface AggregateStats {
  total: number
  correct: number
  accuracy: number
  averageSeconds: number
  averageTargetSeconds: number
}

export interface DailyStats extends AggregateStats {
  date: string
}

export interface SkillStats extends AggregateStats {
  skillId: string
}

const summarize = (attempts: Attempt[]): AggregateStats => {
  const total = attempts.length
  const correct = attempts.filter((attempt) => attempt.correct).length
  const targetAttempts = attempts.filter((attempt) => attempt.questionSnapshot?.estimatedSeconds)
  return {
    total,
    correct,
    accuracy: total ? Math.round(correct / total * 100) : 0,
    averageSeconds: total ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / total / 1000) : 0,
    averageTargetSeconds: targetAttempts.length
      ? Math.round(targetAttempts.reduce((sum, attempt) => sum + (attempt.questionSnapshot?.estimatedSeconds ?? 0), 0) / targetAttempts.length)
      : 0,
  }
}

const utcDay = (value: Date | string) => new Date(value).toISOString().slice(0, 10)

export function buildLearningInsights(attempts: Attempt[], sessions: SessionRecord[], now = new Date()) {
  const chronological = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const endDate = new Date(Math.max(now.getTime(), ...chronological.map((attempt) => new Date(attempt.createdAt).getTime())))
  const daily: DailyStats[] = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(endDate)
    date.setUTCDate(endDate.getUTCDate() - (13 - offset))
    const key = utcDay(date)
    return { date: key, ...summarize(chronological.filter((attempt) => utcDay(attempt.createdAt) === key)) }
  })

  const bySection = Object.fromEntries((['rw', 'math'] as SectionId[]).map((section) => [
    section,
    summarize(chronological.filter((attempt) => attempt.section === section)),
  ])) as Record<SectionId, AggregateStats>

  const byDifficulty = Object.fromEntries(([1, 2, 3, 4, 5] as Difficulty[]).map((difficulty) => [
    difficulty,
    summarize(chronological.filter((attempt) => attempt.difficulty === difficulty)),
  ])) as Record<Difficulty, AggregateStats>

  const bySkill: SkillStats[] = [...new Set(chronological.map((attempt) => attempt.skillId))]
    .map((skillId) => ({ skillId, ...summarize(chronological.filter((attempt) => attempt.skillId === skillId)) }))
    .sort((a, b) => b.total - a.total || a.accuracy - b.accuracy || a.skillId.localeCompare(b.skillId))

  const completedSessions = sessions.filter((session) => session.completedAt)
  const activeDays = new Set(chronological.map((attempt) => utcDay(attempt.createdAt))).size
  const totalMinutes = Math.round(chronological.reduce((sum, attempt) => sum + attempt.elapsedMs, 0) / 60_000)

  return {
    overall: summarize(chronological),
    totalMinutes,
    activeDays,
    completedSessions: completedSessions.length,
    daily,
    bySection,
    byDifficulty,
    bySkill,
  }
}

