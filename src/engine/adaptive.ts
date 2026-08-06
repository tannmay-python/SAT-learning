import type { Attempt, Confidence, Difficulty, Question, SkillDirective, SkillState } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export const defaultSkillState = (skillId: string): SkillState => ({
  skillId,
  theta: 0,
  alpha: 1,
  beta: 1,
  attempts: 0,
  correct: 0,
  streak: 0,
  lapses: 0,
  avgTimeMs: 0,
  intervalDays: 0,
  ease: 2.3,
})

export const difficultyToTheta = (difficulty: Difficulty) => (difficulty - 3) * 0.72
export const expectedSuccess = (theta: number, difficulty: Difficulty) => 1 / (1 + Math.exp(-(theta - difficultyToTheta(difficulty))))
export const masteryPercent = (state?: SkillState) => {
  if (!state || state.attempts === 0) return 0
  const observed = state.alpha / (state.alpha + state.beta)
  const ability = 1 / (1 + Math.exp(-state.theta))
  return Math.round((observed * 0.55 + ability * 0.45) * 100)
}

export function updateSkillState(previous: SkillState | undefined, attempt: Attempt): SkillState {
  const state = previous ?? defaultSkillState(attempt.skillId)
  const expected = expectedSuccess(state.theta, attempt.difficulty)
  const confidenceWeight: Record<Confidence, number> = { guessing: 0.82, unsure: 0.94, confident: 1.08 }
  const evidenceWeight = confidenceWeight[attempt.confidence] * (attempt.usedHint ? 0.72 : 1)
  const outcome = attempt.correct ? 1 : 0
  const learningRate = Math.max(0.12, 0.46 / Math.sqrt(1 + state.attempts / 4))
  const theta = Math.max(-3, Math.min(3, state.theta + learningRate * evidenceWeight * (outcome - expected)))
  const alpha = state.alpha + (attempt.correct ? evidenceWeight : 0)
  const beta = state.beta + (attempt.correct ? 0 : evidenceWeight)
  const streak = attempt.correct ? state.streak + 1 : 0
  const ease = Math.max(1.3, Math.min(3, state.ease + (attempt.correct ? 0.04 : -0.22) + (attempt.confidence === 'confident' && !attempt.correct ? -0.08 : 0)))

  let intervalDays: number
  if (!attempt.correct) intervalDays = 0.01
  else if (state.intervalDays < 1) intervalDays = 1
  else if (streak === 2) intervalDays = Math.max(3, state.intervalDays * 2)
  else intervalDays = Math.min(60, Math.max(1, state.intervalDays * ease * (0.86 + attempt.difficulty * 0.05)))

  const lastSeen = attempt.createdAt
  const dueAt = new Date(new Date(lastSeen).getTime() + intervalDays * DAY_MS).toISOString()
  const avgTimeMs = state.attempts === 0 ? attempt.elapsedMs : Math.round(state.avgTimeMs * 0.72 + attempt.elapsedMs * 0.28)

  return {
    ...state,
    theta,
    alpha,
    beta,
    attempts: state.attempts + 1,
    correct: state.correct + (attempt.correct ? 1 : 0),
    streak,
    lapses: state.lapses + (attempt.correct ? 0 : 1),
    avgTimeMs,
    lastSeen,
    dueAt,
    intervalDays,
    ease,
  }
}

export function targetDifficulty(state?: SkillState): Difficulty {
  if (!state || state.attempts < 2) return 2
  const targetSuccess = 0.74
  return ([1, 2, 3, 4, 5] as Difficulty[]).sort((a, b) => Math.abs(expectedSuccess(state.theta, a) - targetSuccess) - Math.abs(expectedSuccess(state.theta, b) - targetSuccess))[0]
}

export function isDue(state?: SkillState, now = new Date()): boolean {
  if (!state?.dueAt) return true
  return new Date(state.dueAt).getTime() <= now.getTime()
}

export function selectionPriority(
  question: Question,
  states: Map<string, SkillState>,
  seenQuestionIds: Set<string>,
  now = new Date(),
  directives: SkillDirective[] = [],
): number {
  const state = states.get(question.skillId)
  const masteryGap = 1 - masteryPercent(state) / 100
  const due = isDue(state, now) ? 1 : 0
  const uncertainty = state ? 1 / Math.sqrt(state.attempts + 1) : 1
  const challengeGap = Math.abs(question.difficulty - targetDifficulty(state)) / 4
  const novelty = seenQuestionIds.has(question.id) ? 0 : 1
  const lowEvidence = state ? Math.max(0, 1 - state.attempts / 5) : 1
  const directive = directives.find((item) => item.skillId === question.skillId)
  const analyticPriority = directive?.priority ?? 0
  const analyticDifficultyFit = directive ? 1 - Math.abs(question.difficulty - directive.targetDifficulty) / 4 : 0
  return masteryGap * 0.27 + due * 0.16 + uncertainty * 0.1 + (1 - challengeGap) * 0.12 + novelty * 0.1 + lowEvidence * 0.05 + analyticPriority * 0.14 + analyticDifficultyFit * 0.06
}

export function selectNextQuestion(
  questions: Question[],
  states: Map<string, SkillState>,
  seenQuestionIds: Set<string>,
  forcedSkillId?: string,
  directives: SkillDirective[] = [],
): Question | undefined {
  const candidates = forcedSkillId ? questions.filter((question) => question.skillId === forcedSkillId) : questions
  return [...candidates].sort((a, b) => selectionPriority(b, states, seenQuestionIds, new Date(), directives) - selectionPriority(a, states, seenQuestionIds, new Date(), directives))[0]
}

export function practiceScoreEstimate(rwTheta: number, mathTheta: number) {
  const section = (theta: number) => Math.round((200 + 600 / (1 + Math.exp(-1.12 * theta))) / 10) * 10
  const rw = Math.max(200, Math.min(800, section(rwTheta)))
  const math = Math.max(200, Math.min(800, section(mathTheta)))
  const evidence = Math.max(40, Math.round(95 - 10 * Math.min(5, Math.abs(rwTheta) + Math.abs(mathTheta))))
  return { rw, math, total: rw + math, confidenceRadius: evidence }
}

export function sectionTheta(states: SkillState[], skillIds: string[]) {
  const selected = states.filter((state) => skillIds.includes(state.skillId) && state.attempts > 0)
  if (selected.length === 0) return 0
  const totalWeight = selected.reduce((sum, state) => sum + Math.sqrt(state.attempts), 0)
  return selected.reduce((sum, state) => sum + state.theta * Math.sqrt(state.attempts), 0) / totalWeight
}
