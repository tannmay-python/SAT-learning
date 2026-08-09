import type { Attempt, Confidence, Difficulty, Question, QuestionBlueprint, SkillDirective, SkillState } from '../types'

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

const finiteOr = (value: number | undefined, fallback: number): number => Number.isFinite(value) ? value as number : fallback
const clampDifficulty = (value: number | undefined): Difficulty => Math.max(1, Math.min(5, Math.round(finiteOr(value, 3)))) as Difficulty

export const difficultyToTheta = (difficulty: Difficulty) => (clampDifficulty(difficulty) - 3) * 0.72
export const expectedSuccess = (theta: number, difficulty: Difficulty) => {
  const safeTheta = finiteOr(theta, 0)
  return 1 / (1 + Math.exp(-(safeTheta - difficultyToTheta(difficulty))))
}
export const masteryPercent = (state?: SkillState) => {
  const attempts = finiteOr(state?.attempts, 0)
  if (!state || attempts <= 0) return 0
  const alpha = Math.max(0, finiteOr(state.alpha, 1))
  const beta = Math.max(0, finiteOr(state.beta, 1))
  const observed = alpha / Math.max(1, alpha + beta)
  const ability = 1 / (1 + Math.exp(-finiteOr(state.theta, 0)))
  return Math.round((observed * 0.55 + ability * 0.45) * 100)
}

export function updateSkillState(previous: SkillState | undefined, attempt: Attempt): SkillState {
  const base = defaultSkillState(attempt.skillId)
  const state: SkillState = previous ? {
    ...base,
    ...previous,
    theta: finiteOr(previous.theta, base.theta),
    alpha: Math.max(0, finiteOr(previous.alpha, base.alpha)),
    beta: Math.max(0, finiteOr(previous.beta, base.beta)),
    attempts: Math.max(0, Math.floor(finiteOr(previous.attempts, base.attempts))),
    correct: Math.max(0, Math.floor(finiteOr(previous.correct, base.correct))),
    streak: Math.max(0, Math.floor(finiteOr(previous.streak, base.streak))),
    lapses: Math.max(0, Math.floor(finiteOr(previous.lapses, base.lapses))),
    avgTimeMs: Math.max(0, finiteOr(previous.avgTimeMs, base.avgTimeMs)),
    intervalDays: Math.max(0, finiteOr(previous.intervalDays, base.intervalDays)),
    ease: Math.max(1.3, Math.min(3, finiteOr(previous.ease, base.ease))),
  } : base
  const difficulty = clampDifficulty(attempt.difficulty)
  const expected = expectedSuccess(state.theta, difficulty)
  const confidenceWeight: Record<Confidence, number> = { guess: 0.82, low: 0.91, medium: 1, high: 1.07, certain: 1.13 }
  const evidenceWeight = (attempt.confidence ? confidenceWeight[attempt.confidence] ?? 1 : 1) * (attempt.usedHint === true ? 0.72 : 1)
  const outcome = attempt.correct === true ? 1 : 0
  const learningRate = Math.max(0.12, 0.46 / Math.sqrt(1 + state.attempts / 4))
  const theta = Math.max(-3, Math.min(3, state.theta + learningRate * evidenceWeight * (outcome - expected)))
  const alpha = state.alpha + (outcome ? evidenceWeight : 0)
  const beta = state.beta + (outcome ? 0 : evidenceWeight)
  const streak = outcome ? state.streak + 1 : 0
  const highConfidenceMiss = !outcome && (attempt.confidence === 'high' || attempt.confidence === 'certain')
  const ease = Math.max(1.3, Math.min(3, state.ease + (outcome ? 0.04 : -0.22) + (highConfidenceMiss ? -0.08 : 0)))

  let intervalDays: number
  if (!outcome) intervalDays = 0.01
  else if (state.intervalDays < 1) intervalDays = 1
  else if (streak === 2) intervalDays = Math.max(3, state.intervalDays * 2)
  else intervalDays = Math.min(60, Math.max(1, state.intervalDays * ease * (0.86 + difficulty * 0.05)))

  const lastSeen = typeof attempt.createdAt === 'string' && !Number.isNaN(Date.parse(attempt.createdAt)) ? attempt.createdAt : new Date().toISOString()
  const dueAt = new Date(new Date(lastSeen).getTime() + intervalDays * DAY_MS).toISOString()
  const elapsedMs = Math.max(0, finiteOr(attempt.elapsedMs, 0))
  const avgTimeMs = state.attempts === 0 ? elapsedMs : Math.round(state.avgTimeMs * 0.72 + elapsedMs * 0.28)

  return {
    ...state,
    theta,
    alpha,
    beta,
    attempts: state.attempts + 1,
    correct: state.correct + (outcome ? 1 : 0),
    streak,
    lapses: state.lapses + (outcome ? 0 : 1),
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

/**
 * A section-wide calibration prevents sparse per-skill histories from pinning an
 * otherwise strong learner to Difficulty 2. It moves only one level at a time
 * and needs a meaningful run of recent evidence before changing the baseline.
 */
export function sectionTargetDifficulty(attempts: Attempt[], section: Question['section']): Difficulty {
  const recent = attempts.filter((attempt) => attempt.section === section && Number.isFinite(attempt.difficulty)).slice(0, 24)
  if (!recent.length) return 2
  const averageDifficulty = recent.reduce((sum, attempt) => sum + attempt.difficulty, 0) / recent.length
  const accuracy = recent.filter((attempt) => attempt.correct).length / recent.length
  let target = Math.round(averageDifficulty)
  if (recent.length >= 8 && accuracy >= 0.84) target += 1
  else if (recent.length >= 6 && accuracy < 0.55) target -= 1
  return clampDifficulty(target)
}

export function recommendedDifficulty(
  state: SkillState | undefined,
  directive: SkillDirective | undefined,
  sectionTarget: Difficulty,
): Difficulty {
  const measured = targetDifficulty(state)
  if (directive) {
    const directiveWeight = Math.max(0, Math.min(1, directive.priority))
    return clampDifficulty(directive.targetDifficulty * (0.65 + directiveWeight * 0.35) + Math.max(measured, sectionTarget) * (0.35 - directiveWeight * 0.35))
  }
  return clampDifficulty(Math.max(measured, sectionTarget))
}

export function mixedSectionPlan(length: number, first: Question['section'] = 'rw'): Question['section'][] {
  const safeLength = Math.max(1, Math.floor(length))
  const second: Question['section'] = first === 'rw' ? 'math' : 'rw'
  return Array.from({ length: safeLength }, (_, index) => index % 2 === 0 ? first : second)
}

export function weakerSection(attempts: Attempt[]): Question['section'] {
  const need = (section: Question['section']) => {
    const recent = attempts.filter((attempt) => attempt.section === section).slice(0, 24)
    if (!recent.length) return 2
    const accuracy = recent.filter((attempt) => attempt.correct).length / recent.length
    return (1 - accuracy) + 1 / Math.sqrt(recent.length + 1)
  }
  return need('rw') >= need('math') ? 'rw' : 'math'
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
  sectionTarget?: Difficulty,
): number {
  const state = states.get(question.skillId)
  const masteryGap = 1 - masteryPercent(state) / 100
  const due = isDue(state, now) ? 1 : 0
  const uncertainty = state ? 1 / Math.sqrt(state.attempts + 1) : 1
  const directive = directives.find((item) => item.skillId === question.skillId)
  const desiredDifficulty = recommendedDifficulty(state, directive, sectionTarget ?? targetDifficulty(state))
  const challengeGap = Math.abs(question.difficulty - desiredDifficulty) / 4
  const novelty = seenQuestionIds.has(question.id) ? 0 : 1
  const lowEvidence = state ? Math.max(0, 1 - state.attempts / 5) : 1
  const analyticPriority = directive?.priority ?? 0
  return masteryGap * 0.25 + due * 0.14 + uncertainty * 0.09 + (1 - challengeGap) * 0.22 + novelty * 0.1 + lowEvidence * 0.05 + analyticPriority * 0.15
}

export function selectNextQuestion(
  questions: Question[],
  states: Map<string, SkillState>,
  seenQuestionIds: Set<string>,
  forcedSkillId?: string,
  directives: SkillDirective[] = [],
  preferredSection?: Question['section'],
  sectionTarget?: Difficulty,
): Question | undefined {
  const sectionCandidates = preferredSection ? questions.filter((question) => question.section === preferredSection) : questions
  const skillCandidates = forcedSkillId ? sectionCandidates.filter((question) => question.skillId === forcedSkillId) : sectionCandidates
  const candidates = skillCandidates.length ? skillCandidates : sectionCandidates.length ? sectionCandidates : questions
  const exactDifficultyFits = candidates.filter((question) => {
    const directive = directives.find((item) => item.skillId === question.skillId)
    const desired = recommendedDifficulty(states.get(question.skillId), directive, sectionTarget ?? targetDifficulty(states.get(question.skillId)))
    return question.difficulty === desired
  })
  const ranked = exactDifficultyFits.length ? exactDifficultyFits : candidates
  return [...ranked].sort((a, b) => selectionPriority(b, states, seenQuestionIds, new Date(), directives, sectionTarget) - selectionPriority(a, states, seenQuestionIds, new Date(), directives, sectionTarget))[0]
}

export function planReadingBlueprint(
  questions: Question[],
  count: number,
  states: Map<string, SkillState>,
  seenQuestionIds: Set<string>,
  directives: SkillDirective[],
  sectionTarget: Difficulty,
  skillQuota?: Record<string, number>,
): QuestionBlueprint[] {
  const reading = questions.filter((question) => question.section === 'rw')
  const skillUses = new Map<string, number>()
  const chosenIds = new Set<string>()
  const result: QuestionBlueprint[] = []
  const forcedSkills = skillQuota
    ? Object.entries(skillQuota).flatMap(([skillId, quota]) => Array.from({ length: quota }, () => skillId))
    : []
  const total = forcedSkills.length || count
  for (let index = 0; index < total; index += 1) {
    const forcedSkillId = forcedSkills[index]
    const candidates = reading.filter((question) => !chosenIds.has(question.id) && (!forcedSkillId || question.skillId === forcedSkillId))
    const next = [...candidates].sort((a, b) => {
      const score = (question: Question) => selectionPriority(question, states, seenQuestionIds, new Date(), directives, sectionTarget) - (skillUses.get(question.skillId) ?? 0) * 0.18
      return score(b) - score(a)
    })[0]
    if (!next) break
    const directive = directives.find((item) => item.skillId === next.skillId)
    result.push({ section: 'rw', domain: next.domain, skillId: next.skillId, difficulty: recommendedDifficulty(states.get(next.skillId), directive, sectionTarget) })
    chosenIds.add(next.id)
    skillUses.set(next.skillId, (skillUses.get(next.skillId) ?? 0) + 1)
  }
  return result
}

/**
 * Build a fresh Math request from the broad local skill pool. The local pool
 * supplies the requested skill, domain, and calibration level; Gemini then
 * supplies the actual wording and representation. Penalizing repeated skills
 * here prevents Practice from asking for a row of the same template before
 * the model has a chance to vary the surface form.
 */
export function planMathBlueprint(
  questions: Question[],
  count: number,
  states: Map<string, SkillState>,
  seenQuestionIds: Set<string>,
  directives: SkillDirective[],
  sectionTarget: Difficulty,
): QuestionBlueprint[] {
  const math = questions.filter((question) => question.section === 'math')
  const chosenIds = new Set<string>()
  const skillUses = new Map<string, number>()
  const result: QuestionBlueprint[] = []
  for (let index = 0; index < count; index += 1) {
    const candidates = math.filter((question) => !chosenIds.has(question.id))
    const next = [...candidates].sort((a, b) => {
      const score = (question: Question) => selectionPriority(question, states, seenQuestionIds, new Date(), directives, sectionTarget) - (skillUses.get(question.skillId) ?? 0) * 0.2
      return score(b) - score(a)
    })[0]
    if (!next) break
    const directive = directives.find((item) => item.skillId === next.skillId)
    result.push({
      section: 'math',
      domain: next.domain,
      skillId: next.skillId,
      difficulty: recommendedDifficulty(states.get(next.skillId), directive, sectionTarget),
      // Match the broad SAT response-format mix: mostly multiple choice with
      // regular student-produced-response slots.
      format: index % 4 === 3 ? 'student-produced' : 'multiple-choice',
    })
    chosenIds.add(next.id)
    skillUses.set(next.skillId, (skillUses.get(next.skillId) ?? 0) + 1)
  }
  return result
}

export function practiceScoreEstimate(rwTheta: number, mathTheta: number) {
  const section = (theta: number) => Math.round((200 + 600 / (1 + Math.exp(-1.12 * finiteOr(theta, 0)))) / 10) * 10
  const rw = Math.max(200, Math.min(800, section(rwTheta)))
  const math = Math.max(200, Math.min(800, section(mathTheta)))
  const evidence = Math.max(40, Math.round(95 - 10 * Math.min(5, Math.abs(rwTheta) + Math.abs(mathTheta))))
  return { rw, math, total: rw + math, confidenceRadius: evidence }
}

export function sectionTheta(states: SkillState[], skillIds: string[]) {
  const selected = states.filter((state) => skillIds.includes(state.skillId) && Number.isFinite(state.attempts) && state.attempts > 0 && Number.isFinite(state.theta))
  if (selected.length === 0) return 0
  const totalWeight = selected.reduce((sum, state) => sum + Math.sqrt(state.attempts), 0)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return 0
  const theta = selected.reduce((sum, state) => sum + state.theta * Math.sqrt(state.attempts), 0) / totalWeight
  return finiteOr(theta, 0)
}
