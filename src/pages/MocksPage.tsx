import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, Calculator, Clock, Flag, ListChecks, Trash, WarningCircle } from '@phosphor-icons/react'
import { DifficultyStars } from '../components/DifficultyStars'
import { useAppState } from '../state/AppState'

export function MocksPage() {
  const { sessions, attempts, mockAssessments, activeMock, saveActiveMock } = useAppState()
  const [, navigate] = useLocation()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const mocks = sessions.filter((session) => session.type === 'mock' && session.completedAt)
  const hasActive = Boolean(activeMock)

  const clearAndRestart = async () => {
    setClearing(true)
    try {
      await saveActiveMock(null)
      navigate('/mock/run')
    } finally {
      setClearing(false)
      setConfirmClear(false)
    }
  }

  const provenanceFor = (mock: (typeof mocks)[number]) => {
    const fromSession = mock.questionSources
      ? Object.values(mock.questionSources)
      : attempts
        .filter((attempt) => attempt.sessionId === mock.id)
        .map((attempt) => attempt.questionSnapshot?.source)
        .filter((source): source is NonNullable<typeof source> => Boolean(source))
    const counts = fromSession.reduce<Record<string, number>>((result, source) => ({ ...result, [source]: (result[source] || 0) + 1 }), {})
    const labels = [
      counts['official-practice'] ? `${counts['official-practice']} official` : '',
      counts['ai-generated'] ? `${counts['ai-generated']} Gemini` : '',
      counts['local-original'] ? `${counts['local-original']} authored` : '',
    ].filter(Boolean)
    return labels.length ? labels.join(' · ') : 'Question provenance unavailable for this older mock'
  }

  return (
    <div className="mocks-page">
      <section className="mock-hero">
        <div><p className="eyebrow">Full digital simulation</p><h2>Two hours. Four modules. One honest read.</h2><p>Use a full mock when you can protect the whole sitting. The result updates your learning map, pacing profile, and review queue.</p><div className="hero-actions"><Link href="/mock/run" className="primary-button">{hasActive ? 'Resume mock' : 'Start full mock'} <ArrowRight size={18} weight="light" /></Link>{hasActive && !confirmClear && <button className="ghost-button" onClick={() => setConfirmClear(true)}><Trash size={16} weight="light" /> Clear and restart</button>}{hasActive && confirmClear && <div className="mock-clear-confirm" role="alert"><span>Discard this saved mock?</span><button className="text-button" disabled={clearing} onClick={() => setConfirmClear(false)}>Cancel</button><button className="danger-button" disabled={clearing} onClick={() => void clearAndRestart()}>{clearing ? 'Clearing…' : 'Clear mock'}</button></div>}<Link href="/practice" className="text-button">Take a shorter set</Link></div></div>
        <div className="mock-blueprint" aria-label="Mock test structure">
          <div><span>Reading and Writing</span><strong>64 min</strong><small>27 + 27 questions</small></div>
          <i />
          <div><span>Break</span><strong>10 min</strong><small>Optional early return</small></div>
          <i />
          <div><span>Math</span><strong>70 min</strong><small>22 + 22 questions</small></div>
        </div>
      </section>

      <section className="mock-feature-grid">
        <div><Clock size={23} weight="light" /><strong>True module clocks</strong><p>32 minutes for each Reading and Writing module, 35 for each Math module.</p></div>
        <div><ListChecks size={23} weight="light" /><strong>Two-stage routing</strong><p>Module 1 is broad. Your result selects a lower- or higher-difficulty second module.</p></div>
        <div><Calculator size={23} weight="light" /><strong>Math tools</strong><p>The official College Board Desmos scientific and graphing configurations plus the complete SAT formula reference are available throughout Math.</p></div>
        <div><Flag size={23} weight="light" /><strong>Bluebook-like review</strong><p>Move freely inside a module, flag items, and review unanswered questions before submitting.</p></div>
      </section>

      <section className="score-caveat"><WarningCircle size={22} weight="light" /><div><strong>A practice estimate, never a fake official score.</strong><p>Each module includes two SAT-style pretest questions that do not count toward the score; SATLAS still records them for learning but excludes them from the mock estimate. College Board does not publish enough operational item parameters to reproduce adaptive scoring, so SATLAS reports a transparent estimate with uncertainty.</p></div></section>

      <section className="panel history-panel">
        <div className="section-heading"><div><h3>Mock history</h3><p>Full sittings appear here when completed.</p></div><span>{mocks.length} complete</span></div>
        {mocks.length ? <div className="history-list">{mocks.map((mock) => {
          const assessment = mockAssessments.find((item) => item.sessionId === mock.id)
          const expectedGap = assessment && typeof mock.estimatedScore === 'number' ? mock.estimatedScore - assessment.expectedScore : null
          return <article className="history-row mock-history-row" key={mock.id}>
            <div className="history-row-intro"><strong>{new Date(mock.completedAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</strong><small>{mock.correct} of {mock.total} scored questions correct · {mock.questionIds.length} presented</small><small>{provenanceFor(mock)}</small></div>
            <div className="mock-history-metrics">
              <span><small>Actual</small><strong>{mock.estimatedScore ?? '—'}</strong></span>
              <span><small>Gemini expected</small><strong>{assessment?.expectedScore ?? 'Analyzing…'}</strong>{expectedGap !== null && <em className={expectedGap >= 0 ? 'positive' : 'negative'}>{expectedGap >= 0 ? '+' : ''}{expectedGap} vs expected</em>}</span>
              <span><small>Form difficulty</small>{assessment ? <DifficultyStars difficulty={assessment.difficulty} size={10} /> : <em>Pending Gemini</em>}</span>
            </div>
            {assessment && <p className="mock-assessment-rationale">{assessment.rationale}</p>}
          </article>
        })}</div> : <div className="empty-state small"><ListChecks size={27} /><h3>No full mock yet.</h3><p>Your first completed simulation will establish a pacing and endurance baseline.</p></div>}
      </section>
    </div>
  )
}
