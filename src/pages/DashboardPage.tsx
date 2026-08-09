import { Link } from 'wouter'
import { ArrowRight } from '@phosphor-icons/react'
import { curriculum, skillById } from '../data/curriculum'
import { isDue, masteryPercent } from '../engine/adaptive'
import { friendlyReportSummary, friendlyReportTitle } from '../engine/reportCopy'
import { useAppState } from '../state/AppState'

export function DashboardPage() {
  const { settings, attempts, sessions, skillStates, learnerModel, analyses, reports } = useAppState()
  const due = skillStates.filter((state) => isDue(state)).length
  const recent = attempts.slice(0, 20)
  const accuracy = recent.length ? Math.round(recent.filter((item) => item.correct).length / recent.length * 100) : null
  const weak = [...skillStates].filter((state) => state.attempts).sort((a, b) => masteryPercent(a) - masteryPercent(b))[0]
  const latestAnalysis = analyses[0]
  const completedSessions = sessions.filter((session) => session.completedAt)
  const priority = learnerModel.priorities[0]
  const ready = attempts.length > 0

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div><p className="eyebrow">{ready ? `Today${settings.name ? ` · ${settings.name}` : ''}` : 'Private SAT workspace'}</p><h1>{ready ? 'Here is the next best move.' : 'Build an honest baseline.'}</h1></div>
        <span className="date-label">Target {settings.targetScore} · {settings.dailyMinutes} min/day</span>
      </header>

      <section className="recommendation">
        <div className="recommendation-main">
          <p className="section-kicker">Analyst recommendation</p>
          <h2>{ready ? learnerModel.nextSession : 'Take a 12-question mixed calibration.'}</h2>
          <p>{priority?.claim ?? (ready ? learnerModel.summary : 'This gives Gemini enough evidence to begin separating content gaps from pacing, confidence, and decision errors.')}</p>
          <div className="button-row"><Link className="primary-button" href={ready ? '/practice' : '/practice?mode=diagnostic'}>{ready ? 'Start recommended set' : 'Begin calibration'} <ArrowRight size={17} weight="light" /></Link><Link className="quiet-link" href="/insights">Why this plan?</Link><span className="recommendation-evidence">{priority ? `${priority.confidence.charAt(0).toUpperCase()}${priority.confidence.slice(1)} confidence · ${priority.evidenceIds.length} linked answer${priority.evidenceIds.length === 1 ? '' : 's'}` : `${attempts.length} answers logged · ${attempts.length < 3 ? 'More evidence needed' : 'Model update pending'}`}</span></div>
        </div>
      </section>

      <section className="stat-strip" aria-label="Current evidence">
        <div><span>Recent accuracy</span><strong>{accuracy === null ? '—' : `${accuracy}%`}</strong><small>last {recent.length} answers</small></div>
        <div><span>Review queue</span><strong>{due}</strong><small>skills due now</small></div>
        <div><span>Lowest signal</span><strong>{weak ? `${masteryPercent(weak)}%` : '—'}</strong><small>{weak ? skillById.get(weak.skillId)?.shortTitle : 'not mapped'}</small></div>
        <div><span>Completed work</span><strong>{completedSessions.length}</strong><small>sets and mocks</small></div>
      </section>

      <div className="dashboard-columns">
        <section className="plain-section">
          <div className="section-heading"><div><h2>Latest requested review</h2></div><span>{latestAnalysis ? new Date(latestAnalysis.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</span></div>
          {latestAnalysis ? <article className="observation"><h3>{latestAnalysis.verdict}</h3><p>{latestAnalysis.justificationAssessment}</p><Link href="/insights">Read full analysis <ArrowRight size={15} weight="light" /></Link></article> : <div className="empty-line"><p>After an answer, choose “Analyze with Gemini” and add your justification.</p></div>}
          <p className="section-footnote">A Gemini critique appears only when you ask for one after answering.</p>
        </section>

        <section className="plain-section today-list">
          <div className="section-heading"><div><h2>Today&apos;s sequence</h2></div><span>30 min</span></div>
          <Link href="/practice?mode=review"><span>Recall</span><strong>{due ? `Review ${due} due skill${due === 1 ? '' : 's'}` : 'Short mixed warm-up'}</strong><em>8 min</em></Link>
          <Link href="/practice"><span>Train</span><strong>{learnerModel.skillDirectives[0] ? skillById.get(learnerModel.skillDirectives[0].skillId)?.title ?? learnerModel.skillDirectives[0].skillId : 'Adaptive mixed set'}</strong><em>15 min</em></Link>
          <Link href="/learn"><span>Consolidate</span><strong>{weak ? `Review ${skillById.get(weak.skillId)?.shortTitle}` : `${curriculum.length} revision lessons`}</strong><em>7 min</em></Link>
          <p className="section-footnote">A compact plan, revised after each set.</p>
        </section>
      </div>

      {reports[0] && <Link href="/insights" className="report-ribbon"><span>Latest report</span><strong>{friendlyReportTitle(reports[0])}</strong><p>{friendlyReportSummary(reports[0])}</p><ArrowRight size={17} weight="light" /></Link>}
    </div>
  )
}
