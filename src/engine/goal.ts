import { skillById } from '../data/curriculum'
import { practiceScoreEstimate, sectionTheta } from './adaptive'
import type { LearnerSettings, SessionRecord, SkillState } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ScorePoint {
  date: string
  total: number
  /** Section split, when the mock recorded one. Older sessions may lack these. */
  rw?: number
  math?: number
}

export interface GoalProgress {
  targetScore?: number
  testDate?: string
  daysRemaining?: number
  /** Live estimate from current skill calibration, not just the last mock. */
  currentEstimate: { rw: number; math: number; total: number; confidenceRadius: number }
  gapToGoal?: number
  /** Completed full mocks in order, each a real checkpoint rather than a rolling estimate. */
  mockHistory: ScorePoint[]
  /** Points per week between the first and most recent mock. Null until there are two. */
  weeklyTrend: number | null
  /** Linear extrapolation of the trend to the test date. Null without a trend or a date. */
  projectedScore: number | null
  onTrackMargin: number | null
}

/**
 * Pace math is intentionally simple and linear -- extrapolating two or three
 * mock scores is a rough signal, not a model. It exists to answer one
 * question honestly: at the current rate of change, does the gap to target
 * close before the test date, or not. `null` fields mean "not enough
 * evidence yet," which is itself the correct thing to show a learner with
 * one or zero mocks rather than a confident-looking number.
 */
export function computeGoalProgress(
  settings: LearnerSettings,
  skillStates: SkillState[],
  sessions: SessionRecord[],
  now: Date = new Date(),
): GoalProgress {
  const rwSkills = [...skillById.values()].filter((skill) => skill.section === 'rw').map((skill) => skill.id)
  const mathSkills = [...skillById.values()].filter((skill) => skill.section === 'math').map((skill) => skill.id)
  const currentEstimate = practiceScoreEstimate(sectionTheta(skillStates, rwSkills), sectionTheta(skillStates, mathSkills))

  const mockHistory: ScorePoint[] = sessions
    .filter((session): session is SessionRecord & { completedAt: string; estimatedScore: number } =>
      session.type === 'mock' && Boolean(session.completedAt) && typeof session.estimatedScore === 'number')
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((session) => ({ date: session.completedAt, total: session.estimatedScore, rw: session.rwScore, math: session.mathScore }))

  let weeklyTrend: number | null = null
  if (mockHistory.length >= 2) {
    const first = mockHistory[0]
    const last = mockHistory[mockHistory.length - 1]
    const weeks = Math.max(1 / 7, (new Date(last.date).getTime() - new Date(first.date).getTime()) / (7 * DAY_MS))
    weeklyTrend = Math.round((last.total - first.total) / weeks)
  }

  const daysRemaining = settings.testDate
    ? Math.ceil((new Date(settings.testDate).getTime() - now.getTime()) / DAY_MS)
    : undefined

  let projectedScore: number | null = null
  if (weeklyTrend !== null && daysRemaining !== undefined && mockHistory.length) {
    const latest = mockHistory[mockHistory.length - 1]
    const weeksRemaining = Math.max(0, daysRemaining / 7)
    projectedScore = Math.max(400, Math.min(1600, Math.round(latest.total + weeklyTrend * weeksRemaining)))
  }

  const gapToGoal = settings.targetScore ? settings.targetScore - currentEstimate.total : undefined
  const onTrackMargin = projectedScore !== null && settings.targetScore ? projectedScore - settings.targetScore : null

  return { targetScore: settings.targetScore, testDate: settings.testDate, daysRemaining, currentEstimate, gapToGoal, mockHistory, weeklyTrend, projectedScore, onTrackMargin }
}
