import { skillById } from '../data/curriculum'
import { defaultSkillState, practiceScoreEstimate, sectionTheta, updateSkillState } from './adaptive'
import type { Attempt, LearnerSettings, SessionRecord, SkillState } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ScorePoint {
  date: string
  total: number
  /** Section split, when the mock recorded one. Older sessions may lack these. */
  rw?: number
  math?: number
}

export interface PredictionPoint extends ScorePoint {
  kind: 'mock' | 'current' | 'projection' | 'target'
}

export interface GoalEvidenceSummary {
  totalAttempts: number
  rwAttempts: number
  mathAttempts: number
  practiceAttempts: number
  mockAttempts: number
  practiceSessions: number
  fullMocks: number
}

export interface GoalProgress {
  targetScore?: number
  testDate?: string
  daysRemaining?: number
  /** Live estimate from current skill calibration, not just the last mock. */
  currentEstimate: { rw: number; math: number; total: number; confidenceRadius: number }
  /** Human-readable basis shown next to the estimate, with no hidden score source. */
  estimateJustification: string
  evidence: GoalEvidenceSummary
  gapToGoal?: number
  /** Completed full mocks in order, each a real checkpoint rather than a rolling estimate. */
  mockHistory: ScorePoint[]
  /** Points per week between the first and most recent mock. Null until there are two. */
  weeklyTrend: number | null
  /** Linear extrapolation of the trend to the test date. Null without a trend or a date. */
  projectedScore: number | null
  onTrackMargin: number | null
  /** The points shown in the learner-facing predicted-score chart. */
  predictionTrack: {
    actual: PredictionPoint[]
    current: PredictionPoint
    projection: PredictionPoint | null
    target: PredictionPoint | null
  }
}

/**
 * Pace math is intentionally modest. Current calibration is skill-weighted,
 * with completed full mocks used as a small calibration anchor. The trend is
 * a least-squares line through all completed mock checkpoints, not just the
 * first and last values. `null` fields mean "not enough evidence yet," which
 * is itself the correct thing to show a learner with one or zero mocks rather
 * than a confident-looking number.
 */
export function computeGoalProgress(
  settings: LearnerSettings,
  skillStates: SkillState[],
  sessions: SessionRecord[],
  attemptsOrNow: Attempt[] | Date = [],
  maybeNow: Date = new Date(),
): GoalProgress {
  const attempts = attemptsOrNow instanceof Date ? [] : attemptsOrNow
  const now = attemptsOrNow instanceof Date ? attemptsOrNow : maybeNow
  const rwSkills = [...skillById.values()].filter((skill) => skill.section === 'rw').map((skill) => skill.id)
  const mathSkills = [...skillById.values()].filter((skill) => skill.section === 'math').map((skill) => skill.id)

  const mockHistory: ScorePoint[] = sessions
    .filter((session): session is SessionRecord & { completedAt: string; estimatedScore: number } =>
      session.type === 'mock' && Boolean(session.completedAt) && typeof session.estimatedScore === 'number')
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((session) => ({ date: session.completedAt, total: session.estimatedScore, rw: session.rwScore, math: session.mathScore }))

  // Mock pretest items are useful for learning, but they are not scored by the
  // SAT and should not move the score estimate. Rebuild the calibration view
  // from the complete answer history when it is available, leaving the stored
  // skill states untouched for spaced-repetition selection.
  const pretestQuestionIds = new Set(sessions.flatMap((session) => session.pretestQuestionIds ?? []))
  const scoredAttempts = attempts.filter((attempt) => !pretestQuestionIds.has(attempt.questionId))
  const estimateStates = scoredAttempts.length
    ? [...scoredAttempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).reduce<SkillState[]>((states, attempt) => {
      const index = states.findIndex((state) => state.skillId === attempt.skillId)
      const next = updateSkillState(index >= 0 ? states[index] : defaultSkillState(attempt.skillId), attempt)
      if (index >= 0) states[index] = next
      else states.push(next)
      return states
    }, [])
    : skillStates
  const liveEstimate = practiceScoreEstimate(sectionTheta(estimateStates, rwSkills), sectionTheta(estimateStates, mathSkills))

  const mockSessionIds = new Set(sessions.filter((session) => session.type === 'mock').map((session) => session.id))
  const mockAttempts = scoredAttempts.filter((attempt) => mockSessionIds.has(attempt.sessionId))
  const practiceAttempts = scoredAttempts.filter((attempt) => !mockSessionIds.has(attempt.sessionId))
  const evidence: GoalEvidenceSummary = {
    totalAttempts: scoredAttempts.length,
    rwAttempts: scoredAttempts.filter((attempt) => attempt.section === 'rw').length,
    mathAttempts: scoredAttempts.filter((attempt) => attempt.section === 'math').length,
    practiceAttempts: practiceAttempts.length,
    mockAttempts: mockAttempts.length,
    practiceSessions: sessions.filter((session) => session.type !== 'mock' && Boolean(session.completedAt) && session.questionIds.length > 0).length,
    fullMocks: mockHistory.length,
  }

  const nearestTen = (value: number) => Math.round(value / 10) * 10
  const latestMock = mockHistory[mockHistory.length - 1]
  const mockWeight = mockHistory.length ? Math.min(0.42, 0.2 + Math.max(0, mockHistory.length - 1) * 0.08) : 0
  const blendWithCheckpoint = (live: number, checkpoint: number | undefined) => checkpoint === undefined ? live : nearestTen(live * (1 - mockWeight) + checkpoint * mockWeight)
  const currentEstimate = {
    ...liveEstimate,
    rw: blendWithCheckpoint(liveEstimate.rw, latestMock?.rw),
    math: blendWithCheckpoint(liveEstimate.math, latestMock?.math),
  }
  currentEstimate.total = currentEstimate.rw + currentEstimate.math

  const evidenceRadius = (skillIds: string[]) => {
    const selected = skillStates.filter((state) => skillIds.includes(state.skillId) && state.attempts > 0)
    const attemptsObserved = selected.reduce((sum, state) => sum + state.attempts, 0)
    const coverage = selected.length / Math.max(1, skillIds.length)
    const checkpointConfidence = Math.min(18, mockHistory.length * 6)
    return Math.max(42, Math.min(120, Math.round(128 - Math.sqrt(attemptsObserved) * 6 - coverage * 24 - checkpointConfidence)))
  }
  currentEstimate.confidenceRadius = Math.round((evidenceRadius(rwSkills) + evidenceRadius(mathSkills)) / 2)

  const responseLabel = (count: number) => `${count} answered response${count === 1 ? '' : 's'}`
  const estimateJustification = evidence.totalAttempts
    ? `Based on ${responseLabel(evidence.totalAttempts)} across ${evidence.practiceSessions} completed practice set${evidence.practiceSessions === 1 ? '' : 's'} and ${evidence.fullMocks} full mock${evidence.fullMocks === 1 ? '' : 's'}. Reading and Writing uses ${evidence.rwAttempts} response${evidence.rwAttempts === 1 ? '' : 's'}; Math uses ${evidence.mathAttempts} response${evidence.mathAttempts === 1 ? '' : 's'}. Practice is included in the live calibration, while completed mocks provide a modest full-test checkpoint. The ±${currentEstimate.confidenceRadius} range reflects evidence volume and skill coverage.`
    : 'No answered questions are available yet. Complete practice in both sections to establish a score estimate; the range will narrow as the evidence grows.'

  let weeklyTrend: number | null = null
  if (mockHistory.length >= 2) {
    const firstDate = new Date(mockHistory[0].date).getTime()
    const points = mockHistory.map((point) => ({ x: (new Date(point.date).getTime() - firstDate) / DAY_MS, y: point.total }))
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length
    const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0)
    const slopePerDay = denominator ? points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator : 0
    weeklyTrend = Math.round(slopePerDay * 7)
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

  const actual = mockHistory.map((point) => ({ ...point, kind: 'mock' as const }))
  const currentPoint: PredictionPoint = { date: now.toISOString(), total: currentEstimate.total, rw: currentEstimate.rw, math: currentEstimate.math, kind: 'current' }
  const projection = projectedScore !== null && settings.testDate
    ? { date: new Date(settings.testDate).toISOString(), total: projectedScore, kind: 'projection' as const }
    : null
  const target = settings.targetScore
    ? { date: settings.testDate ? new Date(settings.testDate).toISOString() : now.toISOString(), total: settings.targetScore, kind: 'target' as const }
    : null

  return { targetScore: settings.targetScore, testDate: settings.testDate, daysRemaining, currentEstimate, estimateJustification, evidence, gapToGoal, mockHistory, weeklyTrend, projectedScore, onTrackMargin, predictionTrack: { actual, current: currentPoint, projection, target } }
}
