import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { ArrowRight, Brain, CheckCircle, Clock, Lightning, Repeat, Target, XCircle } from '@phosphor-icons/react'
import { readingQuestionBank } from '../data/readingBank'
import { generateMathQuestion, mathSkillIds } from '../engine/mathGenerators'
import { selectNextQuestion } from '../engine/adaptive'
import { isCorrectResponse } from '../engine/questions'
import { QuestionCard } from '../components/QuestionCard'
import { useAppState } from '../state/AppState'
import type { Confidence, Question, SectionId, SessionRecord } from '../types'

type PracticeMode = 'mixed' | SectionId

export function PracticePage() {
  const { stateMap, recordAttempt, analyzeAttempt, saveSession, generatedQuestions, learnerModel, analyses, aiStatus } = useAppState()
  const params = new URLSearchParams(window.location.search)
  const diagnostic = params.get('mode') === 'diagnostic'
  const reviewOnly = params.get('mode') === 'review'
  const [started, setStarted] = useState(diagnostic || reviewOnly)
  const [mode, setMode] = useState<PracticeMode>('mixed')
  const [length, setLength] = useState(diagnostic ? 12 : reviewOnly ? 8 : 10)
  const [current, setCurrent] = useState<Question | null>(null)
  const [response, setResponse] = useState('')
  const [confidence, setConfidence] = useState<Confidence>('unsure')
  const [submitted, setSubmitted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [seen, setSeen] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [correctCount, setCorrectCount] = useState(0)
  const [complete, setComplete] = useState(false)
  const [retrySkill, setRetrySkill] = useState<string | undefined>()
  const [currentAttemptId, setCurrentAttemptId] = useState<string>()
  const sessionId = useRef(crypto.randomUUID())
  const sessionStarted = useRef(new Date().toISOString())
  const questionStarted = useRef(Date.now())

  const questionBank = useMemo(() => {
    const math = mathSkillIds.flatMap((skillId, skillIndex) => ([1, 2, 3, 4, 5] as const).flatMap((difficulty) => [0, 1].map((variant) => generateMathQuestion(skillId, difficulty, 10_000 + skillIndex * 100 + difficulty * 10 + variant))))
    return [...readingQuestionBank, ...math, ...generatedQuestions]
  }, [generatedQuestions])

  const getPool = () => mode === 'mixed' ? questionBank : questionBank.filter((question) => question.section === mode)
  const chooseNext = (forcedSkill?: string) => {
    const available = getPool().filter((question) => !seen.includes(question.id))
    const next = selectNextQuestion(available.length ? available : getPool(), stateMap, new Set(seen), forcedSkill, learnerModel.skillDirectives)
    setCurrent(next ?? null); setResponse(''); setConfidence('unsure'); setSubmitted(false); setCurrentAttemptId(undefined); setElapsedSeconds(0)
    questionStarted.current = Date.now()
  }
  const begin = () => { setStarted(true); chooseNext() }

  useEffect(() => {
    if (started && !current && !complete && seen.length === 0) chooseNext()
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
    setSeen([]); setAnswers({}); setCorrectCount(0); setComplete(false); setCurrent(null); setStarted(false); setRetrySkill(undefined); setCurrentAttemptId(undefined)
  }

  if (!started) return (
    <div className="practice-setup">
      <header className="page-heading"><div><p className="eyebrow">Adaptive practice</p><h1>Work at the edge of your ability.</h1><p>The next item blends calibrated difficulty with the latest completed-set analysis.</p></div><span className={`analyst-pill ${aiStatus.state}`}><i />{aiStatus.available ? 'Gemini available' : 'Calibration only'}</span></header>
      <section className="setup-panel">
        <div className="setup-row"><span>Focus</span><div className="segmented">{([['mixed', 'Adaptive mix'], ['rw', 'Reading + Writing'], ['math', 'Math']] as const).map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}</div></div>
        <div className="setup-row"><span>Length</span><div className="segmented">{[5, 10, 15, 20].map((value) => <button key={value} className={length === value ? 'active' : ''} onClick={() => setLength(value)}>{value}</button>)}</div></div>
        <div className="setup-intelligence"><Brain size={20} /><div><strong>{learnerModel.nextSession}</strong><p>{learnerModel.skillDirectives.length ? `${learnerModel.skillDirectives.length} AI directives will influence selection.` : 'Initial questions will build the evidence needed for AI directives.'}</p></div></div>
        <button className="primary-button" onClick={begin}>Start set <ArrowRight size={17} /></button>
      </section>
      <div className="practice-principles"><span><Clock size={17} /> Pace is recorded</span><span><Repeat size={17} /> Misses trigger repair</span><span><Target size={17} /> Gemini review is optional</span></div>
    </div>
  )

  if (complete) {
    const accuracy = seen.length ? Math.round(correctCount / seen.length * 100) : 0
    return <section className="session-summary"><CheckCircle size={31} weight="fill" /><p className="eyebrow">Set complete</p><h1>{accuracy}%</h1><p>{correctCount} of {seen.length} correct. The raw set is saved, and Gemini Flash 3.6 is now producing the full set diagnosis and next-session prescription.</p><div className="button-row"><button className="primary-button" onClick={restart}>Practice again</button><Link className="quiet-link" href="/insights">Open set analysis</Link></div></section>
  }

  const analysis = currentAttemptId ? analyses.find((item) => item.attemptId === currentAttemptId) : undefined
  const timeLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`
  return current ? <div className="practice-runner">
    <header className="runner-header"><div><span>Adaptive set</span><strong>Question {Math.min(seen.length + (submitted ? 0 : 1), length)} of {length}</strong></div><div className="inline-progress"><i style={{ width: `${seen.length / length * 100}%` }} /></div><div className={`question-timer ${elapsedSeconds > current.estimatedSeconds ? 'over' : ''}`}><Clock size={20} weight="duotone" /><span><small>Question time</small><strong>{timeLabel}</strong></span><em>target {Math.round(current.estimatedSeconds / 5) * 5}s</em></div><button className="ghost-button" onClick={() => { if (confirm('End this set? Answered questions are already on disk.')) setComplete(true) }}>End</button></header>
    <QuestionCard key={current.id} question={current} response={response} onResponse={setResponse} confidence={confidence} onConfidence={setConfidence} submitted={submitted} analysis={analysis} aiAvailable={aiStatus.available} onAnalyzeRequest={currentAttemptId ? (justification) => analyzeAttempt(currentAttemptId, justification).then(() => undefined) : undefined} />
    <footer className="question-actions">{!submitted ? <button className="primary-button" disabled={!response.trim()} onClick={() => void submit()}>Check answer <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => void advance()}>{seen.length >= length ? 'Finish set' : retrySkill ? 'Try one like it' : 'Next question'} <ArrowRight size={17} /></button>}{submitted && <span className={isCorrectResponse(current, response) ? 'correct-label' : 'incorrect-label'}>{isCorrectResponse(current, response) ? <CheckCircle size={17} /> : <XCircle size={17} />}{isCorrectResponse(current, response) ? 'Correct' : 'Review, then retry'}</span>}</footer>
  </div> : null
}
