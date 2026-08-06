export type SectionId = 'rw' | 'math'

export type DomainId =
  | 'craft-structure'
  | 'information-ideas'
  | 'standard-english'
  | 'expression-ideas'
  | 'algebra'
  | 'advanced-math'
  | 'problem-solving-data'
  | 'geometry-trigonometry'

export type Difficulty = 1 | 2 | 3 | 4 | 5
export type QuestionFormat = 'multiple-choice' | 'student-produced'
export type Confidence = 'guessing' | 'unsure' | 'confident'
export type SessionType = 'adaptive' | 'diagnostic' | 'review' | 'section' | 'mock'

export interface Choice {
  id: string
  text: string
}

export interface DataTable {
  caption: string
  headers: string[]
  rows: string[][]
}

export interface DataPlot {
  kind: 'scatter' | 'line' | 'dot'
  caption: string
  xLabel?: string
  yLabel?: string
  points: Array<{ x: number; y: number }>
}

export interface Question {
  id: string
  section: SectionId
  domain: DomainId
  skillId: string
  difficulty: Difficulty
  format: QuestionFormat
  stimulus?: string
  secondaryStimulus?: string
  table?: DataTable
  plot?: DataPlot
  prompt: string
  choices?: Choice[]
  answer: string
  acceptedAnswers?: string[]
  explanation: string
  concept: string
  whyWrong?: Record<string, string>
  misconceptionByChoice?: Record<string, string>
  estimatedSeconds: number
  source: 'local-original' | 'ai-generated'
}

export interface LessonExample {
  prompt: string
  answer: string
  walkthrough: string
}

export interface SkillTopic {
  id: string
  section: SectionId
  domain: DomainId
  title: string
  shortTitle: string
  description: string
  frequency: string
  coreIdeas: string[]
  method: string[]
  tells: string[]
  traps: string[]
  formulae?: string[]
  example: LessonExample
}

export interface DomainMeta {
  id: DomainId
  section: SectionId
  title: string
  shortTitle: string
  weight: number
  questionRange: string
  description: string
}

export interface Attempt {
  id: string
  sessionId: string
  questionId: string
  section: SectionId
  domain: DomainId
  skillId: string
  difficulty: Difficulty
  response: string
  correct: boolean
  confidence: Confidence
  elapsedMs: number
  usedHint: boolean
  mistakeType?: string
  reasoningNote?: string
  createdAt: string
}

export interface SkillState {
  skillId: string
  theta: number
  alpha: number
  beta: number
  attempts: number
  correct: number
  streak: number
  lapses: number
  avgTimeMs: number
  lastSeen?: string
  dueAt?: string
  intervalDays: number
  ease: number
}

export interface SessionRecord {
  id: string
  type: SessionType
  section?: SectionId
  startedAt: string
  completedAt?: string
  questionIds: string[]
  answers: Record<string, string>
  flags: string[]
  route?: { rw?: 'lower' | 'higher'; math?: 'lower' | 'higher' }
  correct?: number
  total?: number
  estimatedScore?: number
}

export interface LearnerSettings {
  id: 'learner'
  name: string
  targetScore: number
  testDate?: string
  dailyMinutes: number
  theme: 'system' | 'light' | 'dark'
  aiModel: string
  onboardingComplete: boolean
}

export interface GeneratedQuestionRecord extends Question {
  createdAt: string
  validationStatus: 'accepted' | 'quarantined'
}

export interface EvidenceClaim {
  claim: string
  evidenceIds: string[]
  confidence: 'tentative' | 'moderate' | 'strong'
}

export interface SkillDirective {
  skillId: string
  priority: number
  targetDifficulty: Difficulty
  reason: string
  evidenceIds: string[]
}

export interface LearnerModel {
  updatedAt?: string
  summary: string
  strengths: EvidenceClaim[]
  hypotheses: EvidenceClaim[]
  priorities: EvidenceClaim[]
  skillDirectives: SkillDirective[]
  coachingStyle: string
  nextSession: string
}

export interface AttemptAnalysis {
  id: string
  attemptId: string
  createdAt: string
  model: string
  promptVersion: string
  learnerJustification: string
  verdict: string
  answerAssessment: string
  justificationQuality: 'thin' | 'partial' | 'sound' | 'excellent'
  justificationAssessment: string
  soundMoves: string[]
  gaps: string[]
  conceptLesson: string
  betterApproach: string[]
  transferCheck: string
  nextMove: string
  evidenceIds: string[]
  confidence: 'tentative' | 'moderate' | 'strong'
}

export interface ReportSectionBreakdown {
  section: 'Reading and Writing' | 'Math'
  accuracySummary: string
  pacingSummary: string
  findings: EvidenceClaim[]
  recommendedFocus: string
}

export interface ReportSkillBreakdown {
  skillId: string
  correct: number
  total: number
  averageSeconds: number
  diagnosis: string
  nextDifficulty: Difficulty
  action: string
  evidenceIds: string[]
  confidence: 'tentative' | 'moderate' | 'strong'
}

export interface ReportErrorClass {
  label: string
  count: number
  mechanism: string
  evidenceIds: string[]
}

export interface StudyPriority {
  skillId: string
  action: string
  reason: string
  evidenceIds: string[]
}

export interface StudyDay {
  day: string
  minutes: number
  work: string
  successCheck: string
}

export interface ReportSummary {
  id: string
  type: 'session' | 'weekly'
  title: string
  period: string
  createdAt: string
  executiveSummary: string
  path: string
  jsonPath: string
  model: string
  sectionBreakdown: ReportSectionBreakdown[]
  skillBreakdown: ReportSkillBreakdown[]
  errorTaxonomy: ReportErrorClass[]
  studyPriorities: StudyPriority[]
  sevenDayPlan: StudyDay[]
  recommendedMix: string
  limitations: string[]
}

export interface AiStatus {
  available: boolean
  provider: string
  access: string
  observerModel: string
  reportModel: string
  state: 'idle' | 'working' | 'offline' | 'error'
  queued: number
  activeTask?: string
  lastCompletedAt?: string
  lastError?: string
}

export interface LearningStateSnapshot {
  settings: LearnerSettings
  attempts: Attempt[]
  sessions: SessionRecord[]
  skillStates: SkillState[]
  generatedQuestions: GeneratedQuestionRecord[]
  analyses: AttemptAnalysis[]
  learnerModel: LearnerModel
  reports: ReportSummary[]
  aiStatus: AiStatus
  activeMock: unknown | null
  dataDirectory: string
}

export interface MockModule {
  id: 'rw-1' | 'rw-2' | 'break' | 'math-1' | 'math-2'
  section?: SectionId
  module?: 1 | 2
  durationSeconds: number
  questions: Question[]
  route?: 'routing' | 'lower' | 'higher'
}
