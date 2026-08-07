import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AiStatus,
  Attempt,
  AttemptAnalysis,
  GeneratedQuestionRecord,
  LearnerModel,
  LearnerSettings,
  LearningStateSnapshot,
  Question,
  QuestionBlueprint,
  ReportSummary,
  SessionRecord,
  SkillState,
} from '../types'

const defaultSettings: LearnerSettings = {
  id: 'learner', name: '', targetScore: 1400, dailyMinutes: 30, theme: 'light',
  aiModel: 'gemini-3.6-flash-high', onboardingComplete: false,
}

const defaultLearnerModel: LearnerModel = {
  summary: 'The analyst is waiting for enough answer evidence to form a defensible learning model.',
  strengths: [], hypotheses: [], priorities: [], skillDirectives: [],
  coachingStyle: 'Explain the shortest reliable method, then verify it on a fresh item.',
  nextSession: 'Begin with a mixed calibration set.',
}

const defaultAiStatus: AiStatus = {
  available: false, provider: 'Google Antigravity', access: 'Local subscription',
  observerModel: 'gemini-3.6-flash-high', reportModel: 'gemini-3.6-flash-high', state: 'offline', queued: 0,
}

interface AppStateValue {
  loading: boolean
  error?: string
  settings: LearnerSettings
  skillStates: SkillState[]
  attempts: Attempt[]
  sessions: SessionRecord[]
  generatedQuestions: GeneratedQuestionRecord[]
  officialQuestions: Question[]
  analyses: AttemptAnalysis[]
  learnerModel: LearnerModel
  reports: ReportSummary[]
  aiStatus: AiStatus
  activeMock: unknown | null
  dataDirectory: string
  stateMap: Map<string, SkillState>
  refresh: () => Promise<void>
  recordAttempt: (attempt: Attempt, question?: Question) => Promise<void>
  analyzeAttempt: (attemptId: string, justification: string) => Promise<AttemptAnalysis>
  saveSession: (session: SessionRecord) => Promise<void>
  saveGeneratedQuestions: (questions: GeneratedQuestionRecord[]) => Promise<void>
  prepareFreshQuestions: (blueprint: QuestionBlueprint[]) => Promise<GeneratedQuestionRecord[]>
  updateSettings: (patch: Partial<LearnerSettings>) => Promise<void>
  saveActiveMock: (mock: unknown | null) => Promise<void>
  generateComprehensiveReport: () => Promise<void>
}

const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<LearningStateSnapshot | null>(null)
  const [error, setError] = useState<string>()
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' })
      if (!response.ok) throw new Error('The local SATLAS server did not return learning state.')
      const next = await response.json() as LearningStateSnapshot
      if (mounted.current) { setSnapshot(next); setError(undefined) }
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Could not read local learning memory.')
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const poll = window.setInterval(() => void refresh(), 4000)
    return () => { mounted.current = false; window.clearInterval(poll) }
  }, [refresh])

  const settings = snapshot?.settings ?? defaultSettings
  useEffect(() => { document.documentElement.dataset.theme = settings.theme }, [settings.theme])

  const recordAttempt = useCallback(async (attempt: Attempt, question?: Question) => {
    const response = await fetch('/api/attempts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attempt, question }),
    })
    if (!response.ok) throw new Error('SATLAS could not write this answer to disk.')
    await refresh()
  }, [refresh])

  const analyzeAttempt = useCallback(async (attemptId: string, justification: string) => {
    const response = await fetch('/api/analyses/attempt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, justification }),
    })
    const payload = await response.json() as { analysis?: AttemptAnalysis; error?: string }
    if (!response.ok || !payload.analysis) throw new Error(payload.error || 'Gemini could not analyse this justification.')
    await refresh()
    return payload.analysis
  }, [refresh])

  const saveSession = useCallback(async (session: SessionRecord) => {
    const response = await fetch('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session }),
    })
    if (!response.ok) throw new Error('SATLAS could not write this session to disk.')
    await refresh()
  }, [refresh])

  const saveGeneratedQuestions = useCallback(async (questions: GeneratedQuestionRecord[]) => {
    const response = await fetch('/api/generated-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions }),
    })
    if (!response.ok) throw new Error('SATLAS could not save generated questions.')
    await refresh()
  }, [refresh])

  const prepareFreshQuestions = useCallback(async (blueprint: QuestionBlueprint[]) => {
    const response = await fetch('/api/practice/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blueprint }),
    })
    const payload = await response.json() as { questions?: GeneratedQuestionRecord[]; error?: string }
    if (!response.ok || !payload.questions?.length) throw new Error(payload.error || 'Gemini could not prepare fresh questions.')
    await refresh()
    return payload.questions
  }, [refresh])

  const updateSettings = useCallback(async (patch: Partial<LearnerSettings>) => {
    const response = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!response.ok) throw new Error('SATLAS could not save settings.')
    await refresh()
  }, [refresh])

  const saveActiveMock = useCallback(async (mock: unknown | null) => {
    await fetch('/api/active-mock', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mock }),
    })
    setSnapshot((current) => current ? { ...current, activeMock: mock } : current)
  }, [])

  const generateComprehensiveReport = useCallback(async () => {
    const response = await fetch('/api/reports/comprehensive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    })
    const payload = await response.json() as { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Complete learning report failed.')
    await refresh()
  }, [refresh])

  const skillStates = snapshot?.skillStates ?? []
  const stateMap = useMemo(() => new Map(skillStates.map((state) => [state.skillId, state])), [skillStates])
  const value = useMemo<AppStateValue>(() => ({
    loading: !snapshot && !error,
    error,
    settings,
    skillStates,
    attempts: snapshot?.attempts ?? [],
    sessions: snapshot?.sessions ?? [],
    generatedQuestions: snapshot?.generatedQuestions ?? [],
    officialQuestions: snapshot?.officialQuestions ?? [],
    analyses: snapshot?.analyses ?? [],
    learnerModel: snapshot?.learnerModel ?? defaultLearnerModel,
    reports: snapshot?.reports ?? [],
    aiStatus: snapshot?.aiStatus ?? defaultAiStatus,
    activeMock: snapshot?.activeMock ?? null,
    dataDirectory: snapshot?.dataDirectory ?? '',
    stateMap,
    refresh,
    recordAttempt,
    analyzeAttempt,
    saveSession,
    saveGeneratedQuestions,
    prepareFreshQuestions,
    updateSettings,
    saveActiveMock,
    generateComprehensiveReport,
  }), [snapshot, error, settings, skillStates, stateMap, refresh, recordAttempt, analyzeAttempt, saveSession, saveGeneratedQuestions, prepareFreshQuestions, updateSettings, saveActiveMock, generateComprehensiveReport])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}
