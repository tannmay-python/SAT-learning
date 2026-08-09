import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Flag, ListNumbers, Sparkle, X } from '@phosphor-icons/react'
import { QuestionCard } from '../components/QuestionCard'
import { MathTools } from '../components/MathTools'
import { readingQuestionBank } from '../data/readingBank'
import { readingExpansionQuestionBank } from '../data/readingExpansion'
import { planReadingBlueprint, sectionTargetDifficulty } from '../engine/adaptive'
import { buildInitialMock, buildMathModuleOne, buildMathModuleTwo, buildReadingModuleTwo, markMockPretestQuestions, mathModuleBlueprints, readingModuleSkillQuotas, routeModuleOne, scoreMockSection } from '../engine/mock'
import { isCorrectResponse } from '../engine/questions'
import { useAppState } from '../state/AppState'
import type { MockModule, Question, QuestionBlueprint, SessionRecord } from '../types'

type RunnerStage = 'prepare' | 'intro' | 'question' | 'review' | 'break' | 'complete'
type GenerationTarget = 'rw-1' | 'rw-2' | 'math-1' | 'math-2'

const authoredReadingPool = [...readingQuestionBank, ...readingExpansionQuestionBank]

/** Fresh items written for this sitting, one module at a time. */
const RW_QUESTIONS_PER_MODULE = 27
const MATH_QUESTIONS_PER_MODULE = 22
const GENERATION_BATCH_SIZE = 10

interface PreparationProgress {
  target: GenerationTarget
  total: number
  ready: number
  generated: number
  fallback: number
  batch: number
  batches: number
  status: string
}

interface BackgroundPreparation {
  status: 'idle' | 'running' | 'ready' | 'failed'
  generated: number
  fallback: number
  total: number
}

interface ActiveMock {
  id: string
  seed: number
  modules: MockModule[]
  moduleIndex: number
  questionIndex: number
  answers: Record<string, string>
  elapsedMsByQuestion?: Record<string, number>
  flags: string[]
  remaining: number
  stage: RunnerStage
  startedAt: string
  rwRoute?: 'lower' | 'higher'
  mathRoute?: 'lower' | 'higher'
  preparationTarget?: GenerationTarget
}

function newMock(freshPool: Question[], stage: RunnerStage, fallbackPool: Question[], preparationTarget?: GenerationTarget): ActiveMock {
  const seed = Math.floor(Date.now() / 1000)
  const modules = markMockPretestQuestions(buildInitialMock(seed, freshPool, fallbackPool), seed)
  return { id: crypto.randomUUID(), seed, modules, moduleIndex: 0, questionIndex: 0, answers: {}, elapsedMsByQuestion: {}, flags: [], remaining: modules[0].durationSeconds, stage, startedAt: new Date().toISOString(), preparationTarget }
}

const readingDifficultyPattern = (route: 'routing' | 'lower' | 'higher') => route === 'higher' ? [3, 4, 5, 4, 5] : route === 'lower' ? [1, 2, 2, 3, 1] : [1, 3, 5, 2, 4]

const withReadingDifficultyMix = (blueprint: QuestionBlueprint[], route: 'routing' | 'lower' | 'higher') => {
  const pattern = readingDifficultyPattern(route)
  return blueprint.map((item, index) => ({ ...item, difficulty: pattern[index % pattern.length] as Question['difficulty'] }))
}

function normalizeActiveMock(value: ActiveMock): ActiveMock {
  const needsPretestMetadata = value.modules.some((module) => module.section && (!module.pretestQuestionIds || module.pretestQuestionIds.length < 2))
  const preparationTarget = value.stage === 'prepare' ? value.preparationTarget ?? 'rw-1' : value.preparationTarget
  const normalized = preparationTarget === value.preparationTarget ? value : { ...value, preparationTarget }
  return needsPretestMetadata ? { ...normalized, modules: markMockPretestQuestions(normalized.modules, normalized.seed) } : normalized
}

export function MockRunner() {
  const [, navigate] = useLocation()
  const { recordAttempt, saveSession, activeMock, saveActiveMock, attempts, stateMap, learnerModel, generatedQuestions, officialQuestions, prepareFreshQuestions, aiStatus } = useAppState()
  // Released official items and everything Gemini has written before are free
  // to reuse and need no waiting, so a mock always draws on that accumulated
  // pool even when it writes nothing new.
  const carriedPool = useMemo(() => [...officialQuestions, ...generatedQuestions], [officialQuestions, generatedQuestions])
  const [freshPool, setFreshPool] = useState<Question[]>(() => activeMock ? generatedQuestions : [])
  const [prepareNotice, setPrepareNotice] = useState('')
  const [math1Preparation, setMath1Preparation] = useState<BackgroundPreparation>({ status: 'idle', generated: 0, fallback: 0, total: MATH_QUESTIONS_PER_MODULE })
  const [mock, setMock] = useState<ActiveMock>(() => activeMock
    ? normalizeActiveMock(activeMock as ActiveMock)
    : newMock([], aiStatus.available ? 'prepare' : 'intro', carriedPool, aiStatus.available ? 'rw-1' : undefined))
  const initialPreparationTarget = (activeMock as ActiveMock | null)?.preparationTarget ?? 'rw-1'
  const [prepareProgress, setPrepareProgress] = useState<PreparationProgress>({ target: initialPreparationTarget, total: initialPreparationTarget === 'math-2' ? MATH_QUESTIONS_PER_MODULE : RW_QUESTIONS_PER_MODULE, ready: 0, generated: 0, fallback: 0, batch: 0, batches: Math.ceil((initialPreparationTarget === 'math-2' ? MATH_QUESTIONS_PER_MODULE : RW_QUESTIONS_PER_MODULE) / GENERATION_BATCH_SIZE), status: 'Waiting for Gemini' })
  const questionStarted = useRef(Date.now())
  const preparationStarted = useRef<GenerationTarget | undefined>(undefined)
  const math1BackgroundStarted = useRef(false)

  const blueprintFor = (target: GenerationTarget, seed: number, route?: 'routing' | 'lower' | 'higher'): QuestionBlueprint[] => {
    if (target === 'rw-1' || target === 'rw-2') {
      const moduleNumber = target === 'rw-1' ? 1 : 2
      const readingBlueprint = planReadingBlueprint(
        authoredReadingPool,
        RW_QUESTIONS_PER_MODULE,
        stateMap,
        new Set(attempts.map((attempt) => attempt.questionId)),
        learnerModel.skillDirectives,
        sectionTargetDifficulty(attempts, 'rw'),
        readingModuleSkillQuotas[moduleNumber],
      )
      return withReadingDifficultyMix(readingBlueprint, target === 'rw-1' ? 'routing' : route ?? 'lower')
    }
    return mathModuleBlueprints(target === 'math-1' ? 1 : 2, seed, target === 'math-1' ? 'routing' : route ?? 'lower')
  }

  const generateBatches = async (target: GenerationTarget, blueprint: QuestionBlueprint[], background = false) => {
    const batches = Array.from({ length: Math.ceil(blueprint.length / GENERATION_BATCH_SIZE) }, (_, index) => blueprint.slice(index * GENERATION_BATCH_SIZE, (index + 1) * GENERATION_BATCH_SIZE))
    let prepared: Question[] = []
    let generatedCount = 0
    let fallbackCount = 0
    let errors = 0
    if (!background) setPrepareProgress({ target, total: blueprint.length, ready: 0, generated: 0, fallback: 0, batch: 0, batches: batches.length, status: `Starting ${batches.length} Gemini batches` })
    else setMath1Preparation({ status: 'running', generated: 0, fallback: 0, total: blueprint.length })
    for (const [index, batch] of batches.entries()) {
      let generated: Question[] = []
      try {
        generated = await prepareFreshQuestions(batch)
      } catch {
        errors += 1
      }
      prepared = [...prepared, ...generated]
      generatedCount += generated.length
      fallbackCount += Math.max(0, batch.length - generated.length)
      if (!background) setPrepareProgress({ target, total: blueprint.length, ready: generatedCount + fallbackCount, generated: generatedCount, fallback: fallbackCount, batch: index + 1, batches: batches.length, status: index + 1 === batches.length ? 'Module ready' : `Batch ${index + 1} complete` })
      else setMath1Preparation({ status: 'running', generated: generatedCount, fallback: fallbackCount, total: blueprint.length })
    }
    return { prepared, generatedCount, fallbackCount, errors }
  }

  useEffect(() => {
    if (mock.stage !== 'prepare') return
    const target = mock.preparationTarget ?? 'rw-1'
    if (preparationStarted.current === target) return
    preparationStarted.current = target
    const prepare = async () => {
      const blueprint = blueprintFor(target, mock.seed, mock.rwRoute ?? mock.mathRoute)
      const result = await generateBatches(target, blueprint)
      const nextFreshPool = [...freshPool, ...result.prepared]
      setFreshPool(nextFreshPool)
      const completionNotice = result.errors || result.generatedCount < blueprint.length
        ? `${result.generatedCount} of ${blueprint.length} questions were written by Gemini. ${blueprint.length - result.generatedCount} slot${blueprint.length - result.generatedCount === 1 ? '' : 's'} will use the independently checkable fallback pool.`
        : `Gemini wrote all ${result.generatedCount} questions for this module.`
      setPrepareNotice(completionNotice)
      setMock((state) => {
        if (state.stage !== 'prepare') return state
        if (target === 'rw-1') {
          const modules = markMockPretestQuestions(buildInitialMock(state.seed, result.prepared, carriedPool), state.seed)
          return { ...state, modules, remaining: modules[0].durationSeconds, stage: 'intro', preparationTarget: undefined }
        }
        if (target === 'rw-2') {
          const rwModuleOne = state.modules.find((item) => item.id === 'rw-1')?.questions ?? []
          const rwModuleTwo = markMockPretestQuestions([buildReadingModuleTwo(state.seed, state.rwRoute ?? 'lower', rwModuleOne, result.prepared, carriedPool)], state.seed + 11)[0]
          return { ...state, modules: [...state.modules, rwModuleTwo, { id: 'break', durationSeconds: 10 * 60, questions: [] }], moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: rwModuleTwo.durationSeconds, stage: 'intro', preparationTarget: undefined }
        }
        const mathModuleOne = state.modules.find((item) => item.id === 'math-1')?.questions ?? []
        const mathModuleTwo = markMockPretestQuestions([buildMathModuleTwo(state.seed, state.mathRoute ?? 'lower', result.prepared, carriedPool, mathModuleOne)], state.seed + 23)[0]
        return { ...state, modules: [...state.modules, mathModuleTwo], moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: mathModuleTwo.durationSeconds, stage: 'intro', preparationTarget: undefined }
      })
    }
    void prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.stage])

  useEffect(() => {
    const currentModule = mock.modules[mock.moduleIndex]
    if (!currentModule || (currentModule.id !== 'rw-2' && currentModule.id !== 'break') || (mock.stage !== 'intro' && mock.stage !== 'question' && mock.stage !== 'break') || math1BackgroundStarted.current || mock.modules.some((item) => item.id === 'math-1')) return
    math1BackgroundStarted.current = true
    const prepareMathOne = async () => {
      const blueprint = blueprintFor('math-1', mock.seed, 'routing')
      const result = await generateBatches('math-1', blueprint, true)
      const nextFreshPool = [...freshPool, ...result.prepared]
      setFreshPool(nextFreshPool)
      math1BackgroundStarted.current = true
      setMath1Preparation({ status: result.generatedCount ? 'ready' : 'failed', generated: result.generatedCount, fallback: result.fallbackCount, total: blueprint.length })
      setMock((state) => {
        if (state.modules.some((item) => item.id === 'math-1')) return state
        const mathModuleOne = markMockPretestQuestions([buildMathModuleOne(state.seed, result.prepared, carriedPool)], state.seed + 19)[0]
        return { ...state, modules: [...state.modules, mathModuleOne] }
      })
    }
    void prepareMathOne()
    // Background Math Module 1 generation begins as soon as R&W Module 2 is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.moduleIndex, mock.stage])
  const module = mock.modules[mock.moduleIndex]
  const question = module?.questions[mock.questionIndex]
  const response = question ? mock.answers[question.id] ?? '' : ''

  useEffect(() => {
    // A mock is only resumable once its questions are settled, so nothing is
    // persisted while Gemini is still writing the form.
    if (mock.stage === 'prepare') return
    const timer = window.setTimeout(() => void saveActiveMock(mock.stage === 'complete' ? null : mock), 250)
    return () => window.clearTimeout(timer)
  }, [mock, saveActiveMock])

  useEffect(() => {
    if (mock.stage !== 'question' && mock.stage !== 'break') return
    const timer = window.setInterval(() => {
      setMock((value) => {
        if (value.remaining <= 1) {
          if (value.stage === 'break') {
            const nextIndex = value.moduleIndex + 1
            if (!value.modules[nextIndex]) return { ...value, remaining: 0 }
            return { ...value, moduleIndex: nextIndex, questionIndex: 0, remaining: value.modules[nextIndex].durationSeconds, stage: 'intro' }
          }
          const currentModule = value.modules[value.moduleIndex]
          const currentQuestion = currentModule?.questions[value.questionIndex]
          const elapsedMsByQuestion = currentQuestion
            ? { ...value.elapsedMsByQuestion, [currentQuestion.id]: (value.elapsedMsByQuestion?.[currentQuestion.id] ?? 0) + (Date.now() - questionStarted.current) }
            : value.elapsedMsByQuestion
          return { ...value, elapsedMsByQuestion, remaining: 0, stage: 'review' }
        }
        return { ...value, remaining: value.remaining - 1 }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [mock.stage, mock.moduleIndex])

  const time = useMemo(() => `${Math.floor(mock.remaining / 60)}:${String(mock.remaining % 60).padStart(2, '0')}`, [mock.remaining])
  const answeredCount = module?.questions.filter((item) => mock.answers[item.id]?.trim()).length ?? 0
  const unansweredCount = Math.max(0, (module?.questions.length ?? 0) - answeredCount)
  const canFinishModule = unansweredCount === 0 || mock.remaining === 0

  const setResponse = (value: string) => {
    if (!question) return
    setMock((state) => ({ ...state, answers: { ...state.answers, [question.id]: value } }))
  }

  const toggleFlag = () => {
    if (!question) return
    setMock((state) => ({ ...state, flags: state.flags.includes(question.id) ? state.flags.filter((id) => id !== question.id) : [...state.flags, question.id] }))
  }

  const goQuestion = (index: number) => {
    const now = Date.now()
    setMock((state) => {
      const currentModule = state.modules[state.moduleIndex]
      const currentQuestion = currentModule?.questions[state.questionIndex]
      const elapsedMsByQuestion = state.stage === 'question' && currentQuestion
        ? { ...state.elapsedMsByQuestion, [currentQuestion.id]: (state.elapsedMsByQuestion?.[currentQuestion.id] ?? 0) + (now - questionStarted.current) }
        : state.elapsedMsByQuestion
      return { ...state, elapsedMsByQuestion, questionIndex: Math.max(0, Math.min(currentModule.questions.length - 1, index)), stage: 'question' }
    })
    questionStarted.current = now
  }

  const openReview = () => {
    const now = Date.now()
    setMock((state) => {
      const currentModule = state.modules[state.moduleIndex]
      const currentQuestion = currentModule?.questions[state.questionIndex]
      const elapsedMsByQuestion = state.stage === 'question' && currentQuestion
        ? { ...state.elapsedMsByQuestion, [currentQuestion.id]: (state.elapsedMsByQuestion?.[currentQuestion.id] ?? 0) + (now - questionStarted.current) }
        : state.elapsedMsByQuestion
      return { ...state, elapsedMsByQuestion, stage: 'review' }
    })
  }

  const startModule = () => {
    questionStarted.current = Date.now()
    setMock((state) => ({ ...state, stage: 'question' }))
  }

  const recordModuleAttempts = async (questions: Question[]) => {
    const averageTime = Math.round((module.durationSeconds - mock.remaining) * 1000 / Math.max(1, answeredCount))
    for (const item of questions) {
      const itemResponse = mock.answers[item.id]
      if (!itemResponse) continue
      await recordAttempt({
        id: `${mock.id}-${item.id}`, sessionId: mock.id, questionId: item.id, section: item.section, domain: item.domain,
        skillId: item.skillId, difficulty: item.difficulty, response: itemResponse, correct: isCorrectResponse(item, itemResponse),
        elapsedMs: mock.elapsedMsByQuestion?.[item.id] ?? averageTime, usedHint: false,
        mistakeType: isCorrectResponse(item, itemResponse) ? undefined : item.misconceptionByChoice?.[itemResponse] ?? 'Timed execution error', createdAt: new Date().toISOString(),
      }, item)
    }
  }

  const finishModule = async () => {
    await recordModuleAttempts(module.questions)
    if (module.id === 'rw-1') {
      const route = routeModuleOne(module.questions, mock.answers, new Set(module.pretestQuestionIds ?? []))
      if (!aiStatus.available) {
        setMock((state) => {
          const rwModuleOne = state.modules.find((item) => item.id === 'rw-1')?.questions ?? []
          const rwModuleTwo = markMockPretestQuestions([buildReadingModuleTwo(state.seed, route, rwModuleOne, freshPool, carriedPool)], state.seed + 11)[0]
          const mathModuleOne = markMockPretestQuestions([buildMathModuleOne(state.seed, freshPool, carriedPool)], state.seed + 19)[0]
          return { ...state, modules: [...state.modules, rwModuleTwo, { id: 'break', durationSeconds: 10 * 60, questions: [] }, mathModuleOne], moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: rwModuleTwo.durationSeconds, stage: 'intro', rwRoute: route }
        })
        return
      }
      setPrepareNotice('')
      setMock((state) => ({ ...state, preparationTarget: 'rw-2', questionIndex: 0, stage: 'prepare', rwRoute: route }))
      return
    }
    if (module.id === 'rw-2') {
      setMock((state) => ({ ...state, moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: state.modules[state.moduleIndex + 1].durationSeconds, stage: 'break' }))
      return
    }
    if (module.id === 'math-1') {
      const route = routeModuleOne(module.questions, mock.answers, new Set(module.pretestQuestionIds ?? []))
      if (!aiStatus.available) {
        setMock((state) => {
          const mathModuleTwo = markMockPretestQuestions([buildMathModuleTwo(state.seed, route, freshPool, carriedPool, module.questions)], state.seed + 23)[0]
          return { ...state, modules: [...state.modules, mathModuleTwo], moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: mathModuleTwo.durationSeconds, stage: 'intro', mathRoute: route }
        })
        return
      }
      setPrepareNotice('')
      setMock((state) => ({ ...state, preparationTarget: 'math-2', questionIndex: 0, stage: 'prepare', mathRoute: route }))
      return
    }
    if (module.id === 'math-2') {
      const rwQuestions = mock.modules.filter((item) => item.section === 'rw').flatMap((item) => item.questions)
      const mathQuestions = mock.modules.filter((item) => item.section === 'math').flatMap((item) => item.questions)
      const pretestQuestionIds = new Set(mock.modules.flatMap((item) => item.pretestQuestionIds ?? []))
      const rw = scoreMockSection(rwQuestions, mock.answers, mock.rwRoute ?? 'lower', pretestQuestionIds)
      const math = scoreMockSection(mathQuestions, mock.answers, mock.mathRoute ?? 'lower', pretestQuestionIds)
      const allQuestions = [...rwQuestions, ...mathQuestions]
      const session: SessionRecord = {
        id: mock.id, type: 'mock', startedAt: mock.startedAt, completedAt: new Date().toISOString(),
        questionIds: allQuestions.map((item) => item.id), answers: mock.answers, flags: mock.flags,
        route: { rw: mock.rwRoute, math: mock.mathRoute }, correct: rw.correct + math.correct, total: rw.total + math.total,
        estimatedScore: rw.score + math.score, rwScore: rw.score, mathScore: math.score,
        questionSources: Object.fromEntries(allQuestions.map((item) => [item.id, item.source])),
        questionDifficulties: Object.fromEntries(allQuestions.map((item) => [item.id, item.difficulty])),
        pretestQuestionIds: [...pretestQuestionIds],
      }
      await saveSession(session)
      await saveActiveMock(null)
      setMock((state) => ({ ...state, stage: 'complete' }))
    }
  }

  const skipBreak = () => {
    setPrepareNotice('')
    setMock((state) => {
      const nextIndex = state.moduleIndex + 1
      const nextModule = state.modules[nextIndex]
      return nextModule ? { ...state, moduleIndex: nextIndex, questionIndex: 0, remaining: nextModule.durationSeconds, stage: 'intro' } : state
    })
  }

  if (mock.stage === 'prepare') {
    const percent = Math.round(prepareProgress.ready / Math.max(1, prepareProgress.total) * 100)
    const section = prepareProgress.target.startsWith('rw') ? 'Reading and Writing' : 'Math'
    const moduleNumber = prepareProgress.target.endsWith('1') ? 1 : 2
    return <main className="set-preparing" role="status" aria-live="polite"><div className="preparing-mark"><Sparkle size={19} weight="fill" /></div><p className="eyebrow">Preparing {section}</p><h1>Loading Module {moduleNumber}.</h1><p>Gemini is preparing the {section} questions for this module in small batches. The form is checked against the released SAT structure before you continue.</p><div className="preparing-progress" aria-label={`${percent}% of ${section} Module ${moduleNumber} is ready`}><div className="preparing-progress-heading"><strong>{percent}% ready</strong><span>{prepareProgress.ready} of {prepareProgress.total} questions resolved</span></div><div className="preparing-progress-track"><i style={{ width: `${percent}%` }} /></div><div className="preparing-progress-meta"><span>{prepareProgress.status}</span><span>{prepareProgress.generated} Gemini · {prepareProgress.fallback} fallback</span></div></div><div className="preparing-lines"><span /><span /><span /></div></main>
  }

  if (mock.stage === 'break') {
    const mathReady = mock.modules.some((item) => item.id === 'math-1')
    const mathPercent = Math.round((math1Preparation.generated + math1Preparation.fallback) / Math.max(1, math1Preparation.total) * 100)
    return <main className="break-screen"><div className="break-clock"><Clock size={33} weight="duotone" /><strong>{time}</strong></div><p className="eyebrow">10-minute break</p><h1>Reading and Writing is done.</h1><p>Stand up, drink water, and reset. Math begins when the timer ends, or whenever you choose to continue.</p>{!mathReady && <div className="break-preparation" role="status"><strong>Preparing Math Module 1</strong><span>{mathPercent}% ready · {math1Preparation.generated} Gemini · {math1Preparation.fallback} fallback</span><i><b style={{ width: `${mathPercent}%` }} /></i></div>}<button className="primary-button" disabled={!mathReady} onClick={skipBreak}>{mathReady ? 'Begin Math now' : 'Preparing Math Module 1…'} <ArrowRight size={18} /></button></main>
  }

  if (mock.stage === 'complete') {
    const rwQuestions = mock.modules.filter((item) => item.section === 'rw').flatMap((item) => item.questions)
    const mathQuestions = mock.modules.filter((item) => item.section === 'math').flatMap((item) => item.questions)
    const pretestQuestionIds = new Set(mock.modules.flatMap((item) => item.pretestQuestionIds ?? []))
    const rw = scoreMockSection(rwQuestions, mock.answers, mock.rwRoute ?? 'lower', pretestQuestionIds)
    const math = scoreMockSection(mathQuestions, mock.answers, mock.mathRoute ?? 'lower', pretestQuestionIds)
    return <main className="mock-complete"><div className="summary-icon"><CheckCircle size={36} weight="fill" /></div><p className="eyebrow">Simulation complete</p><h1>{rw.score + math.score}</h1><span className="estimate-label">Practice estimate, about ±50 points · two pretest questions per module excluded</span><div className="section-scores"><div><span>Reading and Writing</span><strong>{rw.score}</strong><small>{rw.correct}/{rw.total} scored correct</small></div><div><span>Math</span><strong>{math.score}</strong><small>{math.correct}/{math.total} scored correct</small></div></div><p>Your complete item-level evidence has been added to Insights and the Mistake Log. Gemini will add the form difficulty and expected-score comparison to Mock history.</p><button className="primary-button" onClick={() => navigate('/insights')}>Read the diagnosis <ArrowRight size={18} /></button><button className="text-button" onClick={() => navigate('/mocks')}>Back to mock history</button></main>
  }

  if (mock.stage === 'intro') {
    const label = module.section === 'rw' ? 'Reading and Writing' : 'Math'
    const mathPercent = Math.round((math1Preparation.generated + math1Preparation.fallback) / Math.max(1, math1Preparation.total) * 100)
    return <main className="module-intro">{prepareNotice && <div className="practice-notice" role="status">{prepareNotice}</div>}{module.id === 'rw-2' && math1Preparation.status === 'running' && <div className="practice-notice" role="status">Math Module 1 is preparing in the background: {mathPercent}% ready.</div>}<button className="close-runner" onClick={() => navigate('/mocks')}><X size={20} /> Save and exit</button><div className="module-number">{module.module}</div><p className="eyebrow">{label}</p><h1>Module {module.module}</h1><div className="module-facts"><span><Clock size={21} />{module.durationSeconds / 60} minutes</span><span><ListNumbers size={21} />{module.questions.length} questions</span></div><p>You may move freely within this module. Answers autosave. Once you submit, you cannot return to it.</p><button className="primary-button" onClick={startModule}>Start module <ArrowRight size={18} /></button></main>
  }

  if (mock.stage === 'review') {
    return <main className="review-screen"><header><div><p className="eyebrow">Review module</p><h1>Check your work.</h1><p>{answeredCount} answered, {unansweredCount} unanswered, {module.questions.filter((item) => mock.flags.includes(item.id)).length} flagged.</p></div><Clock size={24} /><strong>{time}</strong></header><div className="review-grid">{module.questions.map((item, index) => <button key={item.id} className={`${mock.answers[item.id] ? 'answered' : ''} ${mock.flags.includes(item.id) ? 'flagged' : ''}`} onClick={() => goQuestion(index)}><span>{index + 1}</span>{mock.flags.includes(item.id) && <Flag size={14} weight="fill" />}<small>{mock.answers[item.id] ? 'Answered' : 'Unanswered'}</small></button>)}</div><div className="review-actions"><button className="text-button" onClick={() => goQuestion(mock.questionIndex)}>Return to questions</button><button className="primary-button" disabled={!canFinishModule} onClick={() => void finishModule()}>{canFinishModule ? (module.id === 'math-2' ? 'Finish mock' : 'Continue to next module') : `Answer ${unansweredCount} more`} {canFinishModule && <ArrowRight size={18} />}</button></div></main>
  }

  return question ? (
    <div className="mock-runner">
      <header className="mock-topbar">
        <button className="mock-logo" onClick={() => navigate('/mocks')}>SATLAS</button>
        <div><span>{module.section === 'rw' ? 'Reading and Writing' : 'Math'}</span><strong>Module {module.module}</strong></div>
        <button className="timer-button" aria-label={`Time remaining ${time}`}><Clock size={18} />{time}</button>
        {module.section === 'math' && <MathTools className="mock-tools" />}
      </header>
      <div className="mock-progress"><i style={{ width: `${(mock.questionIndex + 1) / module.questions.length * 100}%` }} /></div>
      <main className="mock-question-wrap">
        <div className="mock-question-heading"><span>Question {mock.questionIndex + 1} of {module.questions.length}</span><button className={mock.flags.includes(question.id) ? 'active' : ''} onClick={toggleFlag}><Flag size={17} weight={mock.flags.includes(question.id) ? 'fill' : 'regular'} />Mark for review</button></div>
        <QuestionCard key={question.id} question={question} response={response} onResponse={setResponse} confidence={undefined} onConfidence={() => undefined} submitted={false} showConfidence={false} showMeta={false} compact />
      </main>
      <footer className="mock-footer"><button className="ghost-button" disabled={mock.questionIndex === 0} onClick={() => goQuestion(mock.questionIndex - 1)}><ArrowLeft size={18} />Back</button><button className="question-number-button" onClick={openReview}>{answeredCount}/{module.questions.length} answered</button>{mock.questionIndex === module.questions.length - 1 ? <button className="primary-button" onClick={openReview}>Review module <ArrowRight size={18} /></button> : <button className="primary-button" onClick={() => goQuestion(mock.questionIndex + 1)}>Next <ArrowRight size={18} /></button>}</footer>
    </div>
  ) : null
}
