import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { ArrowRight, Brain, CheckCircle, Clock, Repeat, Sparkle, Target, XCircle } from '@phosphor-icons/react'
import { readingQuestionBank } from '../data/readingBank'
import { generateMathQuestion, mathSkillIds } from '../engine/mathGenerators'
import { mixedSectionPlan, planReadingBlueprint, sectionTargetDifficulty, selectNextQuestion, weakerSection } from '../engine/adaptive'
import { isCorrectResponse } from '../engine/questions'
import { DifficultyStars } from '../components/DifficultyStars'
import { QuestionCard } from '../components/QuestionCard'
import { MathTools } from '../components/MathTools'
import { useAppState } from '../state/AppState'
import type { Confidence, GeneratedQuestionRecord, Question, SectionId, SessionRecord } from '../types'

type PracticeMode = 'mixed' | SectionId
type QuestionSource = 'fresh' | 'authored'

export function PracticePage() {
  const { stateMap, attempts, recordAttempt, analyzeAttempt, saveSession, prepareFreshQuestions, generatedQuestions, officialQuestions, learnerModel, analyses, aiStatus } = useAppState()
  const params = new URLSearchParams(window.location.search)
  const diagnostic = params.get('mode') === 'diagnostic'
  const reviewOnly = params.get('mode') === 'review'
  const [started, setStarted] = useState(diagnostic || reviewOnly)
  const [mode, setMode] = useState<PracticeMode>('mixed')
  const [length, setLength] = useState(diagnostic ? 12 : reviewOnly ? 8 : 10)
  const [questionSource, setQuestionSource] = useState<QuestionSource>('fresh')
  const [preparing, setPreparing] = useState(false)
  const [preparationNotice, setPreparationNotice] = useState('')
  const [sessionQuestions, setSessionQuestions] = useState<GeneratedQuestionRecord[]>([])
  const [current, setCurrent] = useState<Question | null>(null)
  const [response, setResponse] = useState('')
  const [confidence, setConfidence] = useState<Confidence>()
  const [submitted, setSubmitted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [seen, setSeen] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [correctCount, setCorrectCount] = useState(0)
  const [complete, setComplete] = useState(false)
  const [sectionPlan, setSectionPlan] = useState<SectionId[]>([])
  const [retrySkill, setRetrySkill] = useState<string | undefined>()
  const [currentAttemptId, setCurrentAttemptId] = useState<string>()
  const sessionId = useRef(crypto.randomUUID())
  const sessionStarted = useRef(new Date().toISOString())
  const questionStarted = useRef(Date.now())

  const questionBank = useMemo(() => {
    const math = mathSkillIds.flatMap((skillId, skillIndex) => ([1, 2, 3, 4, 5] as const).flatMap((difficulty) => [0, 1].map((variant) => generateMathQuestion(skillId, difficulty, 10_000 + skillIndex * 100 + difficulty * 10 + variant))))
    // Real released items outrank anything written for this app, so they sit
    // first in the pool and win ties during selection.
    return [...officialQuestions, ...readingQuestionBank, ...math, ...generatedQuestions]
  }, [generatedQuestions, officialQuestions])

  const sectionTargets = useMemo(() => ({
    rw: sectionTargetDifficulty(attempts, 'rw'),
    math: sectionTargetDifficulty(attempts, 'math'),
  }), [attempts])

  const previewPlan = useMemo(() => mode === 'mixed'
    ? mixedSectionPlan(length, weakerSection(attempts))
    : Array.from({ length }, () => mode), [attempts, length, mode])
  const previewCounts = useMemo(() => ({
    rw: previewPlan.filter((section) => section === 'rw').length,
    math: previewPlan.filter((section) => section === 'math').length,
  }), [previewPlan])

  const chooseNext = (forcedSkill?: string, seenIds = seen, plan = sectionPlan, bank = [...sessionQuestions, ...questionBank]) => {
    const slot = seenIds.length
    const nextPlan = [...plan]
    const forcedSection = forcedSkill ? bank.find((question) => question.skillId === forcedSkill)?.section : undefined
    if (forcedSection && nextPlan[slot] !== forcedSection) {
      const swapIndex = nextPlan.findIndex((section, index) => index > slot && section === forcedSection)
      if (swapIndex > slot) [nextPlan[slot], nextPlan[swapIndex]] = [nextPlan[swapIndex], nextPlan[slot]]
    }
    if (nextPlan.some((section, index) => section !== plan[index])) setSectionPlan(nextPlan)
    const preferredSection = nextPlan[slot] ?? (mode === 'mixed' ? weakerSection(attempts) : mode)
    const pool = bank.filter((question) => question.section === preferredSection)
    const available = pool.filter((question) => !seenIds.includes(question.id))
    const historicalSeen = new Set([...attempts.map((attempt) => attempt.questionId), ...seenIds])
    const next = selectNextQuestion(
      available.length ? available : pool,
      stateMap,
      historicalSeen,
      forcedSection === preferredSection ? forcedSkill : undefined,
      learnerModel.skillDirectives,
      preferredSection,
      sectionTargets[preferredSection],
    )
    setCurrent(next ?? null); setResponse(''); setConfidence(undefined); setSubmitted(false); setCurrentAttemptId(undefined); setElapsedSeconds(0)
    questionStarted.current = Date.now()
  }
  const begin = async () => {
    const plan = [...previewPlan]
    let prepared: GeneratedQuestionRecord[] = []
    setPreparationNotice('')
    if (questionSource === 'fresh' && aiStatus.available && previewCounts.rw > 0) {
      setPreparing(true)
      const blueprint = planReadingBlueprint(readingQuestionBank, previewCounts.rw, stateMap, new Set(attempts.map((attempt) => attempt.questionId)), learnerModel.skillDirectives, sectionTargets.rw)
      try {
        prepared = await prepareFreshQuestions(blueprint)
        // Generation now keeps whatever passes rather than discarding a whole
        // batch over one bad item, so a short batch is a normal outcome to
        // report rather than a failure to hide.
        if (prepared.length < previewCounts.rw) {
          setPreparationNotice(`${prepared.length} of ${previewCounts.rw} Reading and Writing questions were written fresh for you. The rest come from the authored bank.`)
        }
      } catch (error) {
        setPreparationNotice(error instanceof Error ? `${error.message} The authored bank is being used for this set.` : 'Fresh questions were unavailable, so the authored bank is being used.')
      } finally {
        setPreparing(false)
      }
    }
    setSessionQuestions(prepared)
    setSectionPlan(plan)
    setStarted(true)
    chooseNext(undefined, [], plan, [...prepared, ...questionBank])
  }

  useEffect(() => {
    if (started && !current && !complete && seen.length === 0) {
      const plan = previewPlan
      setSectionPlan(plan)
      chooseNext(undefined, [], plan, questionBank)
    }
    // Seed auto-start diagnostic and review sessions once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  useEffect(() => {
    if (!current || submitted || complete) return
    setElapsedSeconds(Math.floor((Date.now() - questionStarted.current) / 1000))
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - questionStarted.current) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [current, submitted, complete])

  const submit = async () => {
    if (!current || !response.trim()) return
    const correct = isCorrectResponse(current, response)
    const id = crypto.randomUUID()
    await recordAttempt({
      id, sessionId: sessionId.current, questionId: current.id, section: current.section, domain: current.domain,
      skillId: current.skillId, difficulty: current.difficulty, response, correct, confidence, elapsedMs: Date.now() - questionStarted.current,
      usedHint: false, mistakeType: correct ? undefined : current.misconceptionByChoice?.[response] ?? 'Concept or execution error',
      createdAt: new Date().toISOString(),
    }, current)
    setCurrentAttemptId(id); setSubmitted(true); setSeen((items) => [...items, current.id]); setAnswers((items) => ({ ...items, [current.id]: response }))
    if (correct) setCorrectCount((value) => value + 1)
    setRetrySkill(correct ? undefined : current.skillId)
  }

  const advance = async () => {
    if (seen.length >= length) {
      const session: SessionRecord = {
        id: sessionId.current, type: diagnostic ? 'diagnostic' : reviewOnly ? 'review' : 'adaptive', startedAt: sessionStarted.current,
        completedAt: new Date().toISOString(), questionIds: seen, answers, flags: [], correct: correctCount, total: seen.length,
      }
      await saveSession(session); setComplete(true); return
    }
    chooseNext(retrySkill)
  }

  const restart = () => {
    sessionId.current = crypto.randomUUID(); sessionStarted.current = new Date().toISOString()
    setSeen([]); setAnswers({}); setCorrectCount(0); setComplete(false); setCurrent(null); setStarted(false); setSectionPlan([]); setSessionQuestions([]); setPreparationNotice(''); setRetrySkill(undefined); setCurrentAttemptId(undefined)
  }

  if (preparing) return <section className="set-preparing" role="status" aria-live="polite"><div className="preparing-mark"><Sparkle size={19} weight="fill" /></div><p className="eyebrow">Preparing your set</p><h1>Writing fresh questions.</h1><p>Gemini is using your skill history and current difficulty targets to create {previewCounts.rw} original Reading and Writing question{previewCounts.rw === 1 ? '' : 's'}. Math remains deterministic and independently checkable.</p><div className="preparing-lines"><span /><span /><span /></div></section>

  if (!started) return (
    <div className="practice-setup">
      <header className="page-heading"><div><p className="eyebrow">Adaptive practice</p><h1>Work at the edge of your ability.</h1><p>The next item blends calibrated difficulty with the latest completed-set analysis.</p></div><span className={`analyst-pill ${aiStatus.state}`}><i />{aiStatus.available ? 'Gemini available' : 'Calibration only'}</span></header>
      <section className="setup-panel">
        <div className="setup-row"><span>Focus</span><div className="segmented">{([['mixed', 'Adaptive mix'], ['rw', 'Reading + Writing'], ['math', 'Math']] as const).map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}</div></div>
        <div className="setup-row"><span>Length</span><div className="segmented">{[5, 10, 15, 20].map((value) => <button key={value} className={length === value ? 'active' : ''} onClick={() => setLength(value)}>{value}</button>)}</div></div>
        {mode !== 'math' && <div className="setup-row"><span>R&amp;W source</span><div className="segmented"><button className={questionSource === 'fresh' ? 'active' : ''} disabled={!aiStatus.available} onClick={() => setQuestionSource('fresh')}>Fresh + adaptive</button><button className={questionSource === 'authored' || !aiStatus.available ? 'active' : ''} onClick={() => setQuestionSource('authored')}>Authored + instant</button></div></div>}
        <div className="setup-intelligence"><Brain size={20} /><div><strong>{mode === 'mixed' ? `${previewCounts.rw} Reading and Writing + ${previewCounts.math} Math` : `${length} ${mode === 'rw' ? 'Reading and Writing' : 'Math'} questions`}</strong><p>Current target: {mode !== 'math' && `R&W D${sectionTargets.rw}`}{mode === 'mixed' && ' / '}{mode !== 'rw' && `Math D${sectionTargets.math}`}. Skill-level evidence and analyst directives refine each question.</p></div></div>
        <button className="primary-button" onClick={() => void begin()}>Start set <ArrowRight size={17} /></button>
      </section>
      <div className="practice-principles"><span><Clock size={17} /> Pace is recorded</span><span><Repeat size={17} /> Misses trigger repair</span><span><Target size={17} /> Mixed means both sections</span></div>
    </div>
  )

  if (complete) {
    const accuracy = seen.length ? Math.round(correctCount / seen.length * 100) : 0
    return <section className="session-summary"><CheckCircle size={31} weight="fill" /><p className="eyebrow">Set complete</p><h1>{accuracy}%</h1><p>{correctCount} of {seen.length} correct. Your calibration is updated.{aiStatus.available ? ' Gemini is preparing a concise set review.' : ' The set remains available in your history.'}</p><div className="button-row"><button className="primary-button" onClick={restart}>Practice again</button><Link className="quiet-link" href="/insights">See your insights</Link></div></section>
  }

  const analysis = currentAttemptId ? analyses.find((item) => item.attemptId === currentAttemptId) : undefined
  const timeLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`
  return current ? <div className="practice-runner">
    <header className="runner-header"><div><span>{current.section === 'rw' ? 'Reading and Writing' : 'Math'}<DifficultyStars difficulty={current.difficulty} size={11} /></span><strong>Question {Math.min(seen.length + (submitted ? 0 : 1), length)} of {length}</strong></div><div className="inline-progress"><i style={{ width: `${seen.length / length * 100}%` }} /></div>{current.section === 'math' && <MathTools className="practice-math-tools" />}<div className={`question-timer ${elapsedSeconds > current.estimatedSeconds ? 'over' : ''}`}><Clock size={20} weight="duotone" /><span><small>Question time</small><strong>{timeLabel}</strong></span><em>target {Math.round(current.estimatedSeconds / 5) * 5}s</em></div><button className="ghost-button" onClick={() => { if (confirm('End this set? Answered questions are already on disk.')) setComplete(true) }}>End</button></header>
    {preparationNotice && <div className="practice-notice" role="status">{preparationNotice}</div>}
    <QuestionCard key={current.id} question={current} response={response} onResponse={setResponse} confidence={confidence} onConfidence={setConfidence} submitted={submitted} analysis={analysis} aiAvailable={aiStatus.available} onAnalyzeRequest={currentAttemptId ? (justification) => analyzeAttempt(currentAttemptId, justification).then(() => undefined) : undefined} />
    <footer className="question-actions">{!submitted ? <button className="primary-button" disabled={!response.trim()} onClick={() => void submit()}>Check answer <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => void advance()}>{seen.length >= length ? 'Finish set' : retrySkill ? 'Try one like it' : 'Next question'} <ArrowRight size={17} /></button>}{submitted && <span className={isCorrectResponse(current, response) ? 'correct-label' : 'incorrect-label'}>{isCorrectResponse(current, response) ? <CheckCircle size={17} /> : <XCircle size={17} />}{isCorrectResponse(current, response) ? 'Correct' : 'Review, then retry'}</span>}</footer>
  </div> : null
}
