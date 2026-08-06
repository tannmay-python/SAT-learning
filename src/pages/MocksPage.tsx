import { Link } from 'wouter'
import { ArrowRight, Calculator, Clock, Flag, ListChecks, WarningCircle } from '@phosphor-icons/react'
import { useAppState } from '../state/AppState'

export function MocksPage() {
  const { sessions, activeMock } = useAppState()
  const mocks = sessions.filter((session) => session.type === 'mock' && session.completedAt)
  const hasActive = Boolean(activeMock)

  return (
    <div className="mocks-page">
      <section className="mock-hero">
        <div><p className="eyebrow">Full digital simulation</p><h2>Two hours. Four modules. One honest read.</h2><p>Use a full mock when you can protect the whole sitting. The result updates your learning map, pacing profile, and review queue.</p><div className="hero-actions"><Link href="/mock/run" className="primary-button">{hasActive ? 'Resume mock' : 'Start full mock'} <ArrowRight size={18} weight="bold" /></Link><Link href="/practice" className="text-button">Take a shorter set</Link></div></div>
        <div className="mock-blueprint" aria-label="Mock test structure">
          <div><span>Reading and Writing</span><strong>64 min</strong><small>27 + 27 questions</small></div>
          <i />
          <div><span>Break</span><strong>10 min</strong><small>Optional early return</small></div>
          <i />
          <div><span>Math</span><strong>70 min</strong><small>22 + 22 questions</small></div>
        </div>
      </section>

      <section className="mock-feature-grid">
        <div><Clock size={23} weight="duotone" /><strong>True module clocks</strong><p>32 minutes for each Reading and Writing module, 35 for each Math module.</p></div>
        <div><ListChecks size={23} weight="duotone" /><strong>Two-stage routing</strong><p>Module 1 is broad. Your result selects a lower- or higher-difficulty second module.</p></div>
        <div><Calculator size={23} weight="duotone" /><strong>Math tools</strong><p>The official College Board Desmos scientific and graphing configurations plus the complete SAT formula reference are available throughout Math.</p></div>
        <div><Flag size={23} weight="duotone" /><strong>Bluebook-like review</strong><p>Move freely inside a module, flag items, and review unanswered questions before submitting.</p></div>
      </section>

      <section className="score-caveat"><WarningCircle size={22} weight="fill" /><div><strong>A practice estimate, never a fake official score.</strong><p>College Board does not publish enough operational item parameters to reproduce adaptive scoring. SATLAS reports a transparent estimate with uncertainty and preserves raw module results.</p></div></section>

      <section className="panel history-panel">
        <div className="section-heading"><div><h3>Mock history</h3><p>Full sittings appear here when completed.</p></div><span>{mocks.length} complete</span></div>
        {mocks.length ? <div className="history-list">{mocks.map((mock) => <div className="history-row" key={mock.id}><span><strong>{new Date(mock.completedAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</strong><small>{mock.correct} of {mock.total} correct</small></span><strong>{mock.estimatedScore ?? 'Estimated'}</strong></div>)}</div> : <div className="empty-state small"><ListChecks size={27} /><h3>No full mock yet.</h3><p>Your first completed simulation will establish a pacing and endurance baseline.</p></div>}
      </section>
    </div>
  )
}
