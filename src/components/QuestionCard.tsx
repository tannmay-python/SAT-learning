import { useId, useState } from 'react'
import { ArrowRight, Brain, CheckCircle, Lightbulb, XCircle } from '@phosphor-icons/react'
import { Link } from 'wouter'
import type { AttemptAnalysis, Confidence, DataPlot, Question } from '../types'
import { displayAnswer, isCorrectResponse } from '../engine/questions'
import { domainById, skillById } from '../data/curriculum'

interface Props {
  question: Question
  response: string
  onResponse: (value: string) => void
  confidence: Confidence
  onConfidence: (value: Confidence) => void
  submitted: boolean
  analysis?: AttemptAnalysis
  aiAvailable?: boolean
  onAnalyzeRequest?: (justification: string) => Promise<void>
  compact?: boolean
  showConfidence?: boolean
  showMeta?: boolean
}

function QuestionPlot({ plot }: { plot: DataPlot }) {
  const xs = plot.points.map((point) => point.x)
  const ys = plot.points.map((point) => point.y)
  const minX = Math.min(...xs); const maxX = Math.max(...xs)
  const minY = Math.min(0, ...ys); const maxY = Math.max(...ys)
  const x = (value: number) => 48 + (value - minX) / Math.max(1, maxX - minX) * 330
  const y = (value: number) => 172 - (value - minY) / Math.max(1, maxY - minY) * 138
  const linePoints = [...plot.points].sort((a, b) => a.x - b.x).map((point) => `${x(point.x)},${y(point.y)}`).join(' ')
  const ticks = [...new Set(xs)].sort((a, b) => a - b)
  return <figure className="question-plot"><figcaption>{plot.caption}</figcaption><svg viewBox="0 0 420 210" role="img" aria-label={plot.caption}><line x1="48" y1="172" x2="390" y2="172" /><line x1="48" y1="172" x2="48" y2="18" />{plot.kind === 'line' && <polyline points={linePoints} />}{plot.points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={x(point.x)} cy={y(point.y)} r="4" />)}{ticks.length <= 8 && ticks.map((tick) => <g key={tick}><line x1={x(tick)} y1="172" x2={x(tick)} y2="177" /><text x={x(tick)} y="191" textAnchor="middle">{tick}</text></g>)}{plot.xLabel && <text x="220" y="207" textAnchor="middle">{plot.xLabel}</text>}{plot.yLabel && <text x="13" y="95" textAnchor="middle" transform="rotate(-90 13 95)">{plot.yLabel}</text>}</svg></figure>
}

export function QuestionCard({ question, response, onResponse, confidence, onConfidence, submitted, analysis, aiAvailable = false, onAnalyzeRequest, compact = false, showConfidence = true, showMeta = true }: Props) {
  const inputId = useId()
  const correct = submitted && isCorrectResponse(question, response)
  const selectedTrap = question.whyWrong?.[response]
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [justification, setJustification] = useState('')
  const [analysisPending, setAnalysisPending] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  const requestAnalysis = async () => {
    if (!onAnalyzeRequest || justification.trim().length < 8) return
    setAnalysisPending(true); setAnalysisError('')
    try { await onAnalyzeRequest(justification.trim()) }
    catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Gemini could not analyse this answer.') }
    finally { setAnalysisPending(false) }
  }

  return (
    <article className={`question-card ${compact ? 'compact' : ''}`}>
      {showMeta && <header className="question-meta">
        <span>{domainById.get(question.domain)?.shortTitle}</span>
        <span>{skillById.get(question.skillId)?.shortTitle}</span>
        <span className="difficulty-mark" aria-label={`Difficulty ${question.difficulty} of 5`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < question.difficulty ? 'filled' : ''} />)}</span>
      </header>}

      <div className="question-content">
        {question.stimulus && <div className="stimulus">{question.stimulus.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>}
        {question.secondaryStimulus && <div className="stimulus secondary"><strong>Text 2</strong>{question.secondaryStimulus.replace(/^Text 2:\s*/, '')}</div>}
        {question.table && (
          <div className="table-wrap"><table><caption>{question.table.caption}</caption><thead><tr>{question.table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{question.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
        )}
        {question.plot && <QuestionPlot plot={question.plot} />}
        <h2 className="question-prompt">{question.prompt}</h2>
      </div>

      {question.format === 'multiple-choice' ? (
        <div className="choice-list" role="radiogroup" aria-label="Answer choices">
          {question.choices?.map((choice) => {
            const selected = response === choice.id
            const isAnswer = submitted && choice.id === question.answer
            const isWrong = submitted && selected && choice.id !== question.answer
            return <button key={choice.id} role="radio" aria-checked={selected} disabled={submitted} className={`choice ${selected ? 'selected' : ''} ${isAnswer ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => onResponse(choice.id)}><span>{choice.id}</span><p>{choice.text}</p>{isAnswer && <CheckCircle size={20} weight="fill" />}{isWrong && <XCircle size={20} weight="fill" />}</button>
          })}
        </div>
      ) : (
        <label className="spr-field" htmlFor={inputId}><span>Your answer</span><input id={inputId} inputMode="decimal" value={response} disabled={submitted} onChange={(event) => onResponse(event.target.value)} placeholder="Enter an integer, decimal, or fraction" /><small>For example: 7, 2.5, or 3/4</small></label>
      )}

      {!submitted && showConfidence && (
        <fieldset className="confidence-picker"><legend>How sure are you?</legend>{(['guessing', 'unsure', 'confident'] as Confidence[]).map((value) => <button type="button" key={value} className={confidence === value ? 'active' : ''} onClick={() => onConfidence(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</fieldset>
      )}

      {submitted && (
        <section className={`answer-feedback ${correct ? 'success' : 'error'}`} aria-live="polite">
          <div className="feedback-title">{correct ? <CheckCircle size={23} weight="fill" /> : <Lightbulb size={23} weight="fill" />}<div><span>{correct ? 'Locked in' : 'Reset the idea'}</span><strong>{correct ? 'Your reasoning landed.' : `Correct answer: ${displayAnswer(question)}`}</strong></div></div>
          {!correct && selectedTrap && <p className="trap-callout"><b>Your answer:</b> {selectedTrap}</p>}
          <p>{question.explanation}</p>
          <div className="concept-reset"><span>Concept reset</span><p>{question.concept}</p><Link href={`/learn?skill=${question.skillId}`}>Open the full lesson</Link></div>
        </section>
      )}

      {submitted && !analysis && onAnalyzeRequest && <section className={`analysis-request ${analysisOpen ? 'open' : ''}`}>
        {!analysisOpen ? <div><span><Brain size={21} weight="duotone" /><span><strong>Want feedback on your reasoning?</strong><small>Optional. Gemini runs only if you ask.</small></span></span><button className="secondary-button" disabled={!aiAvailable} onClick={() => setAnalysisOpen(true)}>Analyze with Gemini</button></div> : <div className="analysis-request-form"><header><Brain size={21} weight="duotone" /><div><strong>Explain why you chose that answer.</strong><p>State the rule, evidence, setup, or calculation you relied on. Gemini will judge the reasoning separately from whether the answer was correct.</p></div></header><label><span>Your justification</span><textarea value={justification} onChange={(event) => setJustification(event.target.value)} rows={4} maxLength={2400} placeholder="I chose this because…" autoFocus /></label>{analysisError && <p className="analysis-error">{analysisError}</p>}<div className="analysis-request-actions"><button className="text-button" disabled={analysisPending} onClick={() => setAnalysisOpen(false)}>Cancel</button><button className="primary-button" disabled={analysisPending || justification.trim().length < 8} onClick={() => void requestAnalysis()}>{analysisPending ? 'Gemini is thinking…' : 'Analyze my reasoning'} {!analysisPending && <ArrowRight size={16} />}</button></div></div>}
      </section>}

      {submitted && analysis && <section className="ai-feedback ready" aria-live="polite"><header><Brain size={20} weight="duotone" /><span><strong>Gemini reasoning review</strong><small>{analysis.model} · {analysis.confidence} confidence</small></span><em>{analysis.justificationQuality} justification</em></header><h3>{analysis.verdict}</h3><p>{analysis.answerAssessment}</p><div className="justification-review"><strong>Your justification</strong><blockquote>{analysis.learnerJustification}</blockquote><p>{analysis.justificationAssessment}</p></div>{analysis.soundMoves.length > 0 && <div><strong>What was sound</strong><ul>{analysis.soundMoves.map((move) => <li key={move}>{move}</li>)}</ul></div>}{analysis.gaps.length > 0 && <div><strong>What needs repair</strong><ul>{analysis.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div>}<div><strong>Concept lesson</strong><p>{analysis.conceptLesson}</p></div><div><strong>A stronger SAT approach</strong><ol>{analysis.betterApproach.map((step) => <li key={step}>{step}</li>)}</ol></div><div className="transfer-check"><strong>Transfer check</strong><p>{analysis.transferCheck}</p></div><p className="next-move"><strong>Next move:</strong> {analysis.nextMove}</p></section>}
    </article>
  )
}
