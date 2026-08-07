import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Flag, ListNumbers, Sparkle, X } from '@phosphor-icons/react'
import { QuestionCard } from '../components/QuestionCard'
import { MathTools } from '../components/MathTools'
import { readingQuestionBank } from '../data/readingBank'
import { planReadingBlueprint, sectionTargetDifficulty } from '../engine/adaptive'
import { buildInitialMock, buildMathModuleTwo, buildRemainingMock, routeModuleOne, scoreMockSection } from '../engine/mock'
import { isCorrectResponse } from '../engine/questions'
import { useAppState } from '../state/AppState'
import type { MockModule, Question, SessionRecord } from '../types'

type RunnerStage = 'prepare' | 'intro' | 'question' | 'review' | 'break' | 'complete'

/** Fresh items written for this sitting, on top of everything generated before. */
const FRESH_ITEMS_PER_MOCK = 12

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
}

function newMock(freshPool: Question[], stage: RunnerStage): ActiveMock {
  const seed = Math.floor(Date.now() / 1000)
  const modules = buildInitialMock(seed, freshPool)
  return { id: crypto.randomUUID(), seed, modules, moduleIndex: 0, questionIndex: 0, answers: {}, elapsedMsByQuestion: {}, flags: [], remaining: modules[0].durationSeconds, stage, startedAt: new Date().toISOString() }
}

export function MockRunner() {
  const [, navigate] = useLocation()
  const { recordAttempt, saveSession, activeMock, saveActiveMock, attempts, stateMap, learnerModel, generatedQuestions, prepareFreshQuestions, aiStatus } = useAppState()
  // Every item Gemini has written before is free to reuse and needs no waiting,
  // so a mock always draws on the accumulated pool even when it writes none.
  const [freshPool, setFreshPool] = useState<Question[]>(generatedQuestions)
  const [prepareNotice, setPrepareNotice] = useState('')
  const [mock, setMock] = useState<ActiveMock>(() => activeMock
    ? activeMock as ActiveMock
    : newMock(generatedQuestions, aiStatus.available ? 'prepare' : 'intro'))
  const questionStarted = useRef(Date.now())
  const preparationStarted = useRef(false)

  useEffect(() => {
    if (mock.stage !== 'prepare' || preparationStarted.current) return
    preparationStarted.current = true
    const prepare = async () => {
      let prepared: Question[] = []
      try {
        const blueprint = planReadingBlueprint(
          readingQuestionBank,
          FRESH_ITEMS_PER_MOCK,
          stateMap,
          new Set(attempts.map((attempt) => attempt.questionId)),
          learnerModel.skillDirectives,
          sectionTargetDifficulty(attempts, 'rw'),
        )
        prepared = await prepareFreshQuestions(blueprint)
      } catch (error) {
        setPrepareNotice(error instanceof Error
          ? `${error.message} This mock uses the authored bank and your previously generated questions.`
          : 'Fresh questions were unavailable, so this mock uses the authored bank.')
      }
      const pool = [...prepared, ...generatedQuestions]
      setFreshPool(pool)
      setMock((state) => {
        // A mock already under way must never have its questions swapped.
        if (state.stage !== 'prepare') return state
        const modules = buildInitialMock(state.seed, pool)
        return { ...state, modules, remaining: modules[0].durationSeconds, stage: 'intro' }
      })
    }
    void prepare()
    // Preparation runs once per sitting, before the first module is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.stage])
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
      const route = routeModuleOne(module.questions, mock.answers)
      const remaining = buildRemainingMock(mock.seed, route, module.questions, freshPool)
      setMock((state) => ({ ...state, modules: [...state.modules, ...remaining], moduleIndex: 1, questionIndex: 0, remaining: remaining[0].durationSeconds, stage: 'intro', rwRoute: route }))
      return
    }
    if (module.id === 'rw-2') {
      setMock((state) => ({ ...state, moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: state.modules[state.moduleIndex + 1].durationSeconds, stage: 'break' }))
      return
    }
    if (module.id === 'math-1') {
      const route = routeModuleOne(module.questions, mock.answers)
      const math2 = buildMathModuleTwo(mock.seed, route)
      setMock((state) => ({ ...state, modules: [...state.modules, math2], moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: math2.durationSeconds, stage: 'intro', mathRoute: route }))
      return
    }
    if (module.id === 'math-2') {
      const rwQuestions = mock.modules.filter((item) => item.section === 'rw').flatMap((item) => item.questions)
      const mathQuestions = mock.modules.filter((item) => item.section === 'math').flatMap((item) => item.questions)
      const rw = scoreMockSection(rwQuestions, mock.answers, mock.rwRoute ?? 'lower')
      const math = scoreMockSection(mathQuestions, mock.answers, mock.mathRoute ?? 'lower')
      const session: SessionRecord = {
        id: mock.id, type: 'mock', startedAt: mock.startedAt, completedAt: new Date().toISOString(),
        questionIds: [...rwQuestions, ...mathQuestions].map((item) => item.id), answers: mock.answers, flags: mock.flags,
        route: { rw: mock.rwRoute, math: mock.mathRoute }, correct: rw.correct + math.correct, total: rw.total + math.total,
        estimatedScore: rw.score + math.score,
      }
      await saveSession(session)
      await saveActiveMock(null)
      setMock((state) => ({ ...state, stage: 'complete' }))
    }
  }

  const skipBreak = () => {
    setMock((state) => ({ ...state, moduleIndex: state.moduleIndex + 1, questionIndex: 0, remaining: state.modules[state.moduleIndex + 1].durationSeconds, stage: 'intro' }))
  }

  if (mock.stage === 'prepare') {
    return <main className="set-preparing" role="status" aria-live="polite"><div className="preparing-mark"><Sparkle size={19} weight="fill" /></div><p className="eyebrow">Preparing your mock</p><h1>Writing this form.</h1><p>Gemini is writing {FRESH_ITEMS_PER_MOCK} original Reading and Writing questions against your skill history and current difficulty targets, at official passage length. They join every question written for you before, so no two sittings repeat the same form. Math is generated procedurally and stays independently checkable.</p><div className="preparing-lines"><span /><span /><span /></div><button className="text-button" onClick={() => setMock((state) => state.stage === 'prepare' ? { ...state, stage: 'intro' } : state)}>Start now with the authored bank</button></main>
  }

  if (mock.stage === 'break') {
    return <main className="break-screen"><div className="break-clock"><Clock size={33} weight="duotone" /><strong>{time}</strong></div><p className="eyebrow">10-minute break</p><h1>Reading and Writing is done.</h1><p>Stand up, drink water, and reset. Math begins when the timer ends, or when you choose to return.</p><button className="primary-button" onClick={skipBreak}>Begin Math <ArrowRight size={18} /></button></main>
  }

  if (mock.stage === 'complete') {
    const rwQuestions = mock.modules.filter((item) => item.section === 'rw').flatMap((item) => item.questions)
    const mathQuestions = mock.modules.filter((item) => item.section === 'math').flatMap((item) => item.questions)
    const rw = scoreMockSection(rwQuestions, mock.answers, mock.rwRoute ?? 'lower')
    const math = scoreMockSection(mathQuestions, mock.answers, mock.mathRoute ?? 'lower')
    return <main className="mock-complete"><div className="summary-icon"><CheckCircle size={36} weight="fill" /></div><p className="eyebrow">Simulation complete</p><h1>{rw.score + math.score}</h1><span className="estimate-label">Practice estimate, about ±50 points</span><div className="section-scores"><div><span>Reading and Writing</span><strong>{rw.score}</strong><small>{rw.correct}/{rw.total} correct</small></div><div><span>Math</span><strong>{math.score}</strong><small>{math.correct}/{math.total} correct</small></div></div><p>Your complete item-level evidence has been added to Insights and the Mistake Log.</p><button className="primary-button" onClick={() => navigate('/insights')}>Read the diagnosis <ArrowRight size={18} /></button><button className="text-button" onClick={() => navigate('/mocks')}>Back to mock history</button></main>
  }

  if (mock.stage === 'intro') {
    const label = module.section === 'rw' ? 'Reading and Writing' : 'Math'
    return <main className="module-intro">{prepareNotice && <div className="practice-notice" role="status">{prepareNotice}</div>}<button className="close-runner" onClick={() => navigate('/mocks')}><X size={20} /> Save and exit</button><div className="module-number">{module.module}</div><p className="eyebrow">{label}</p><h1>Module {module.module}</h1><div className="module-facts"><span><Clock size={21} />{module.durationSeconds / 60} minutes</span><span><ListNumbers size={21} />{module.questions.length} questions</span></div><p>You may move freely within this module. Answers autosave. Once you submit, you cannot return to it.</p><button className="primary-button" onClick={startModule}>Start module <ArrowRight size={18} /></button></main>
  }

  if (mock.stage === 'review') {
    return <main className="review-screen"><header><div><p className="eyebrow">Review module</p><h1>Check your work.</h1><p>{answeredCount} answered, {module.questions.length - answeredCount} unanswered, {module.questions.filter((item) => mock.flags.includes(item.id)).length} flagged.</p></div><Clock size={24} /><strong>{time}</strong></header><div className="review-grid">{module.questions.map((item, index) => <button key={item.id} className={`${mock.answers[item.id] ? 'answered' : ''} ${mock.flags.includes(item.id) ? 'flagged' : ''}`} onClick={() => goQuestion(index)}><span>{index + 1}</span>{mock.flags.includes(item.id) && <Flag size={14} weight="fill" />}<small>{mock.answers[item.id] ? 'Answered' : 'Unanswered'}</small></button>)}</div><div className="review-actions"><button className="text-button" onClick={() => goQuestion(mock.questionIndex)}>Return to questions</button><button className="primary-button" onClick={() => void finishModule()}>Submit module <ArrowRight size={18} /></button></div></main>
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
        <QuestionCard question={question} response={response} onResponse={setResponse} confidence={undefined} onConfidence={() => undefined} submitted={false} showConfidence={false} showMeta={false} compact />
      </main>
      <footer className="mock-footer"><button className="ghost-button" disabled={mock.questionIndex === 0} onClick={() => goQuestion(mock.questionIndex - 1)}><ArrowLeft size={18} />Back</button><button className="question-number-button" onClick={openReview}>{answeredCount}/{module.questions.length} answered</button>{mock.questionIndex === module.questions.length - 1 ? <button className="primary-button" onClick={openReview}>Review module <ArrowRight size={18} /></button> : <button className="primary-button" onClick={() => goQuestion(mock.questionIndex + 1)}>Next <ArrowRight size={18} /></button>}</footer>
    </div>
  ) : null
}
