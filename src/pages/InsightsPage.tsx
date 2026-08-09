import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Brain, ChartBar, Clock, FileText, FlagCheckered, Lightning, Target, TrendUp, WarningCircle } from '@phosphor-icons/react'
import { curriculum, skillById } from '../data/curriculum'
import { masteryPercent } from '../engine/adaptive'
import { computeGoalProgress, type GoalProgress } from '../engine/goal'
import { buildLearningInsights } from '../engine/insights'
import { friendlyReportSummary, friendlyReportTitle, readerText } from '../engine/reportCopy'
import { useAppState } from '../state/AppState'
import type { EvidenceClaim, ReportSummary } from '../types'

type InsightsView = 'history' | 'coach'

/**
 * The headline question ("how am I doing for my goal") sits above both tabs
 * rather than inside either one, since it's the answer a learner with a
 * target score actually opens Insights to check.
 */
function GoalPanel({ progress }: { progress: GoalProgress }) {
  if (!progress.targetScore) {
    return <section className="analysis-section goal-panel goal-panel-empty"><FlagCheckered size={22} weight="duotone" /><div><h2>Set a target score to track progress toward it.</h2><p>Add a target score and test date in Settings to see your current gap, weekly pace, and a projected score here.</p><Link className="text-button" href="/settings">Go to Settings</Link></div></section>
  }
  const scale = (value: number) => Math.max(0, Math.min(100, (value - 400) / 12))
  const gap = progress.gapToGoal ?? 0
  return <section className="analysis-section goal-panel">
    <div className="section-heading"><div><h2>Your goal</h2><p>{progress.testDate ? (progress.daysRemaining! >= 0 ? `${progress.daysRemaining} days until test day, ${new Date(progress.testDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Test date has passed. Update it in Settings.') : 'No test date set. Add one in Settings for a pace projection.'}</p></div><FlagCheckered size={20} weight="duotone" /></div>
    <div className="goal-headline">
      <div><span>Current estimate</span><strong>{progress.currentEstimate.total}</strong><small>±{progress.currentEstimate.confidenceRadius} · R&amp;W {progress.currentEstimate.rw} / Math {progress.currentEstimate.math}</small></div>
      <div className={gap > 0 ? 'goal-gap behind' : 'goal-gap ahead'}><span>{gap > 0 ? 'Gap to close' : 'At or above target'}</span><strong>{gap > 0 ? `${gap}` : `+${-gap}`}</strong></div>
      <div><span>Target</span><strong>{progress.targetScore}</strong></div>
    </div>
    <div className="goal-track"><i className="goal-track-fill" style={{ width: `${scale(progress.currentEstimate.total)}%` }} /><b className="goal-track-mark" style={{ left: `${scale(progress.targetScore)}%` }} title={`Target: ${progress.targetScore}`} /></div>
    {progress.weeklyTrend !== null ? <p className="goal-trend">{progress.weeklyTrend >= 0 ? 'Trending up' : 'Trending down'} about {Math.abs(progress.weeklyTrend)} point{Math.abs(progress.weeklyTrend) === 1 ? '' : 's'} a week across {progress.mockHistory.length} full mocks. {progress.projectedScore !== null && progress.testDate && progress.daysRemaining! >= 0 && <>At this rate, test-day estimate is near <strong>{progress.projectedScore}</strong>{progress.onTrackMargin !== null && (progress.onTrackMargin >= 0 ? `, ${progress.onTrackMargin} above target.` : `, ${Math.abs(progress.onTrackMargin)} short. Increase weekly volume or focus on the section with the bigger gap.`)}</>}</p>
      : <p className="muted-copy">Complete a second full mock to see a trend and a projected test-day score. One mock is a snapshot; two show direction.</p>}
    <PredictionChart progress={progress} />
    <details className="estimate-method"><summary>How this estimate is calculated</summary><p>The current estimate starts with skill-level calibration, then uses completed full mocks as a small checkpoint anchor. The uncertainty range shrinks as more skills, answers, and mock checkpoints are recorded. The test-day line uses every completed mock checkpoint, not just the most recent two.</p></details>
    {progress.mockHistory.length > 0 && <div className="goal-mock-history">{progress.mockHistory.map((point) => <div key={point.date}><span>{new Date(point.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><strong>{point.total}</strong>{point.rw !== undefined && point.math !== undefined && <small>R&amp;W {point.rw} / Math {point.math}</small>}</div>)}</div>}
  </section>
}

function PredictionChart({ progress }: { progress: GoalProgress }) {
  const track = progress.predictionTrack
  const points = [...track.actual, track.current, track.projection, track.target].filter((point): point is NonNullable<typeof point> => Boolean(point))
  const times = points.map((point) => new Date(point.date).getTime())
  const scores = points.map((point) => point.total)
  const minTime = Math.min(...times)
  const maxTime = Math.max(minTime + 7 * 24 * 60 * 60 * 1000, ...times)
  const minScore = Math.max(200, Math.floor((Math.min(...scores) - 100) / 100) * 100)
  const maxScore = Math.min(1600, Math.ceil((Math.max(...scores) + 100) / 100) * 100)
  const x = (date: string) => 48 + (new Date(date).getTime() - minTime) / Math.max(1, maxTime - minTime) * 350
  const y = (score: number) => 166 - (score - minScore) / Math.max(1, maxScore - minScore) * 126
  const tickStep = Math.max(100, Math.ceil((maxScore - minScore) / 5 / 100) * 100)
  const yTicks = Array.from({ length: Math.floor((maxScore - minScore) / tickStep) + 1 }, (_, index) => minScore + index * tickStep)
  if (yTicks[yTicks.length - 1] !== maxScore) yTicks.push(maxScore)
  const actualPoints = track.actual.map((point) => `${x(point.date)},${y(point.total)}`).join(' ')
  const forecastStart = track.actual.at(-1) ?? track.current
  const forecastPoints = track.projection ? `${x(forecastStart.date)},${y(forecastStart.total)} ${x(track.projection.date)},${y(track.projection.total)}` : ''
  const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return <div className="prediction-chart-wrap">
    <div className="prediction-chart-heading"><div><strong>Predicted score tracking</strong><small>{track.projection ? 'Checkpoint history plus a test-day projection' : 'Current estimate and target; complete another mock to establish direction'}</small></div><TrendUp size={18} /></div>
    <svg className="prediction-chart" viewBox="0 0 420 210" role="img" aria-label="Predicted SAT score tracking chart">
      <g className="prediction-grid" aria-hidden="true">{yTicks.map((tick) => <line key={tick} x1="48" y1={y(tick)} x2="398" y2={y(tick)} />)}</g>
      <g className="prediction-axis" aria-hidden="true"><line x1="48" y1="166" x2="398" y2="166" /><line x1="48" y1="166" x2="48" y2="40" /></g>
      {yTicks.map((tick) => <text className="prediction-y-label" key={`label-${tick}`} x="40" y={y(tick) + 3} textAnchor="end">{Math.round(tick)}</text>)}
      {track.target && <line className="prediction-target" x1="48" y1={y(track.target.total)} x2="398" y2={y(track.target.total)} />}
      {track.actual.length > 1 && <polyline className="prediction-actual" points={actualPoints} />}
      {track.projection && <polyline className="prediction-forecast" points={forecastPoints} />}
      {track.actual.map((point) => <circle className="prediction-point mock" key={`mock-${point.date}`} cx={x(point.date)} cy={y(point.total)} r="4" />)}
      <circle className="prediction-point current" cx={x(track.current.date)} cy={y(track.current.total)} r="5" />
      {track.projection && <circle className="prediction-point projection" cx={x(track.projection.date)} cy={y(track.projection.total)} r="4" />}
      <text className="prediction-x-label" x="48" y="188">{dateLabel(points[0].date)}</text><text className="prediction-x-label" x="398" y="188" textAnchor="end">{dateLabel(points.at(-1)!.date)}</text>
    </svg>
    <div className="prediction-legend"><span><i className="legend-dot mock" />Full mock</span><span><i className="legend-dot current" />Current estimate</span>{track.projection && <span><i className="legend-dot projection" />Projection</span>}<span><i className="legend-line target" />Target</span></div>
  </div>
}

function ClaimList({ claims, empty }: { claims: EvidenceClaim[]; empty: string }) {
  return claims.length ? <div className="claim-list">{claims.map((item, index) => <article key={`${item.claim}-${index}`}><p>{readerText(item.claim)}</p><span>{item.confidence} confidence, based on {item.evidenceIds.length} answer{item.evidenceIds.length === 1 ? '' : 's'}</span></article>)}</div> : <p className="muted-copy">{empty}</p>
}

function IntervalReport({ report }: { report: ReportSummary }) {
  return <section className="analysis-section interval-report">
    <header className="interval-report-header"><div><span>{report.type === 'comprehensive' ? 'Complete history' : 'Completed set'} · {new Date(report.createdAt).toLocaleString()}</span><h2>{friendlyReportTitle(report)}</h2><p>{friendlyReportSummary(report)}</p></div><div className="report-links"><a href={`/api/reports/${report.id}/markdown`} target="_blank" rel="noreferrer">Readable report</a><a href={`/api/reports/${report.id}/json`} target="_blank" rel="noreferrer">Raw data</a></div></header>

    <div className={`report-section-grid ${report.sectionBreakdown.length === 1 ? 'single' : ''}`}>{report.sectionBreakdown.map((section) => <article key={section.section}><span>{section.section}</span><strong>{readerText(section.accuracySummary)}</strong><small>{readerText(section.pacingSummary)}</small>{section.findings.slice(0, 2).map((finding) => <p key={finding.claim}>{readerText(finding.claim)}</p>)}<em>{readerText(section.recommendedFocus)}</em></article>)}</div>

    {report.skillBreakdown.length > 0 && <div className="report-detail-block"><div className="section-heading"><div><h3>Skill diagnosis</h3><p>What happened, plus the next useful level.</p></div></div><div className="skill-diagnosis-table">{report.skillBreakdown.map((skill) => <div key={skill.skillId}><span><strong>{skillById.get(skill.skillId)?.title ?? skill.skillId}</strong><small>{readerText(skill.diagnosis)}</small></span><b>{skill.correct}/{skill.total}</b><em>{skill.averageSeconds}s avg</em><span className="next-prescription">D{skill.nextDifficulty}: {readerText(skill.action)}</span></div>)}</div></div>}

    <div className="report-lower-grid">
      <div className="report-detail-block"><h3>Error mechanisms</h3>{report.errorTaxonomy.length ? report.errorTaxonomy.map((item) => <article className="error-class" key={item.label}><span>{item.count}</span><div><strong>{readerText(item.label)}</strong><p>{readerText(item.mechanism)}</p></div></article>) : <p className="muted-copy">No repeatable error pattern showed up here.</p>}</div>
      <div className="report-detail-block"><h3>Next work</h3>{report.studyPriorities.length ? <ol className="priority-list">{report.studyPriorities.slice(0, 5).map((item) => <li key={`${item.skillId}-${item.action}`}><strong>{skillById.get(item.skillId)?.shortTitle ?? item.skillId}</strong><p>{readerText(item.action)}</p><small>{readerText(item.reason)}</small></li>)}</ol> : <p className="muted-copy">Continue with a mixed set at the current target difficulty.</p>}<div className="recommended-mix"><strong>Next set</strong><p>{readerText(report.recommendedMix)}</p></div></div>
    </div>
  </section>
}

function ActivityChart({ daily }: { daily: ReturnType<typeof buildLearningInsights>['daily'] }) {
  const peak = Math.max(1, ...daily.map((day) => day.total))
  return <div className="activity-chart" role="img" aria-label="Questions answered on each of the last fourteen days">
    {daily.map((day) => <div className="activity-day" key={day.date} title={`${new Date(`${day.date}T00:00:00`).toLocaleDateString()}: ${day.total} questions, ${day.accuracy}% correct`}><span>{day.total || ''}</span><i style={{ height: `${Math.max(day.total ? 10 : 2, day.total / peak * 100)}%` }} className={day.total ? 'active' : ''} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small></div>)}
  </div>
}

function HistoryView({ insights }: { insights: ReturnType<typeof buildLearningInsights> }) {
  const [showAllSkills, setShowAllSkills] = useState(false)
  const visibleSkills = showAllSkills ? insights.bySkill : insights.bySkill.slice(0, 10)
  return <div className="history-view">
    <section className="insight-metrics" aria-label="Learning history summary">
      <div><span>Questions solved</span><strong>{insights.overall.total}</strong><small>across all saved work</small></div>
      <div><span>Overall accuracy</span><strong>{insights.overall.total ? `${insights.overall.accuracy}%` : 'No data'}</strong><small>{insights.overall.correct} correct</small></div>
      <div><span>Time in questions</span><strong>{insights.totalMinutes} min</strong><small>{insights.activeDays} active day{insights.activeDays === 1 ? '' : 's'}</small></div>
      <div><span>Completed work</span><strong>{insights.completedSessions}</strong><small>sets and mocks</small></div>
    </section>

    <section className="analysis-section history-activity"><div className="section-heading"><div><h2>Questions solved</h2><p>Your last 14 days of recorded activity.</p></div><ChartBar size={20} /></div>{insights.overall.total ? <ActivityChart daily={insights.daily} /> : <p className="muted-copy">Complete a practice question to start the chart.</p>}</section>

    <div className="history-split">
      <section className="analysis-section"><div className="section-heading"><div><h2>By section</h2><p>Accuracy and average question time.</p></div><Target size={20} /></div><div className="section-comparison">{([['rw', 'Reading and Writing'], ['math', 'Math']] as const).map(([id, label]) => { const stats = insights.bySection[id]; return <div key={id}><span><strong>{label}</strong><small>{stats.total} questions · {stats.averageSeconds}s average</small></span><b>{stats.total ? `${stats.accuracy}%` : 'No data'}</b><i><span style={{ width: `${stats.accuracy}%` }} /></i></div> })}</div></section>
      <section className="analysis-section"><div className="section-heading"><div><h2>Difficulty reached</h2><p>Volume and accuracy at each level.</p></div></div><div className="difficulty-history">{([1, 2, 3, 4, 5] as const).map((level) => { const stats = insights.byDifficulty[level]; const peak = Math.max(1, ...Object.values(insights.byDifficulty).map((item) => item.total)); return <div key={level}><span>{stats.total || ''}</span><i style={{ height: `${Math.max(stats.total ? 10 : 2, stats.total / peak * 100)}%` }} className={stats.total ? 'active' : ''} /><strong>D{level}</strong><small>{stats.total ? `${stats.accuracy}%` : 'No data'}</small></div> })}</div></section>
    </div>

    <section className="analysis-section topic-history"><div className="section-heading"><div><h2>Topic history</h2><p>Questions solved, accuracy, and average time for every practiced skill.</p></div><Clock size={20} /></div>{visibleSkills.length ? <div className="topic-history-table">{visibleSkills.map((skill) => <div key={skill.skillId}><span><strong>{skillById.get(skill.skillId)?.title ?? skill.skillId}</strong><small>{skill.total} question{skill.total === 1 ? '' : 's'}</small></span><b>{skill.accuracy}%</b><em>{skill.averageSeconds}s avg</em><i title={`${skill.accuracy}% accuracy`}><span style={{ width: `${skill.accuracy}%` }} /></i></div>)}</div> : <p className="muted-copy">Skill-level history will appear after your first set.</p>}{insights.bySkill.length > 10 && <button className="text-button history-more" onClick={() => setShowAllSkills((value) => !value)}>{showAllSkills ? 'Show fewer topics' : `Show all ${insights.bySkill.length} topics`}</button>}</section>
  </div>
}

export function InsightsPage() {
  const { attempts, sessions, skillStates, settings, learnerModel, analyses, reports, aiStatus, generateComprehensiveReport } = useAppState()
  const [view, setView] = useState<InsightsView>('history')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const latestReport = reports[0]
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(latestReport?.id)
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? latestReport
  const insights = useMemo(() => buildLearningInsights(attempts, sessions), [attempts, sessions])
  const goalProgress = useMemo(() => computeGoalProgress(settings, skillStates, sessions), [settings, skillStates, sessions])

  const generate = async () => {
    setGenerating(true); setMessage('')
    try { await generateComprehensiveReport(); setMessage('Your complete learning report is ready.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Report failed.') }
    finally { setGenerating(false) }
  }

  return <div className="analysis-page">
    <header className="page-heading analysis-heading"><div><p className="eyebrow">Insights</p><h1>Your work, made useful.</h1><p>See what you have practiced, how your pace is changing, and what deserves attention next.</p></div><div className="analyst-card"><span className={`analyst-dot ${aiStatus.state}`} /><div><strong>{aiStatus.state === 'working' ? 'Gemini is working' : aiStatus.available ? 'Gemini is ready' : 'Analyst unavailable'}</strong><small>{aiStatus.activeTask ?? `${aiStatus.queued} queued`}</small></div></div></header>

    <GoalPanel progress={goalProgress} />

    <div className="insights-toolbar"><div className="insights-tabs" role="tablist" aria-label="Insights view"><button role="tab" aria-selected={view === 'history'} className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>History</button><button role="tab" aria-selected={view === 'coach'} className={view === 'coach' ? 'active' : ''} onClick={() => setView('coach')}>Coach</button></div><button className="secondary-button" disabled={generating || attempts.length < 3 || !aiStatus.available} onClick={() => void generate()}>{generating ? 'Building your report…' : 'Build complete report'}</button></div>
    {message && <p className="status-message report-status" role="status">{message}</p>}

    {view === 'history' ? <HistoryView insights={insights} /> : <div className="coach-view">
      {selectedReport ? <><div className="coach-report-picker"><label htmlFor="coach-report-select">Report to read</label><select id="coach-report-select" value={selectedReport.id} onChange={(event) => setSelectedReportId(event.target.value)}>{reports.map((report) => <option key={report.id} value={report.id}>{report.type === 'comprehensive' ? 'Complete history' : 'Completed set'} · {new Date(report.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {friendlyReportTitle(report)}</option>)}</select></div><IntervalReport report={selectedReport} /></> : <section className="analysis-section empty-report"><FileText size={24} /><div><h2>Your first set review will appear here.</h2><p>Finish a practice set or mock. Gemini reviews the completed set while your raw evidence remains unchanged.</p></div></section>}

      <div className="analysis-grid">
        <section className="analysis-section primary-analysis"><div className="section-heading"><div><h2>Current learner model</h2><p>Only evidence-backed claims shape the plan.</p></div><Brain size={20} /></div><h3>Highest-leverage priorities</h3><ClaimList claims={learnerModel.priorities} empty="Complete a set to form the first priority." /><h3>Working hypotheses</h3><ClaimList claims={learnerModel.hypotheses} empty="No reasoning pattern is defensible yet." /></section>
        <section className="analysis-section"><div className="section-heading"><div><h2>Strengths to preserve</h2><p>Repeated successes that should survive harder questions.</p></div></div><ClaimList claims={learnerModel.strengths} empty="Strength claims need repeated evidence across difficulty or context." /></section>
      </div>

      <section className="analysis-section directives-section"><div className="section-heading"><div><h2>Adaptive directives</h2><p>These now change both the skill mix and the actual target difficulty.</p></div><Lightning size={20} /></div>{learnerModel.skillDirectives.length ? <div className="directive-table">{learnerModel.skillDirectives.map((item) => <div key={item.skillId}><span><strong>{skillById.get(item.skillId)?.title ?? item.skillId}</strong><small>{readerText(item.reason)}</small></span><b>Priority {Math.round(item.priority * 100)}</b><em>Difficulty {item.targetDifficulty}</em></div>)}</div> : <p className="muted-copy">Deterministic calibration remains active until a completed set gives Gemini enough evidence to issue a directive.</p>}</section>

      <div className="analysis-grid">
        <section className="analysis-section"><div className="section-heading"><div><h2>Requested answer reviews</h2><p>Only questions where you asked Gemini to review your reasoning.</p></div><span>{analyses.length}</span></div>{analyses.length ? <div className="observation-list">{analyses.slice(0, 8).map((item) => <article key={item.id}><span>{item.justificationQuality} · {new Date(item.createdAt).toLocaleDateString()}</span><h3>{item.verdict}</h3><p>{item.justificationAssessment}</p><details><summary>Read reasoning review</summary><p>{item.answerAssessment}</p><p>{item.conceptLesson}</p><ol>{item.betterApproach.map((step) => <li key={step}>{step}</li>)}</ol><strong>{item.nextMove}</strong></details></article>)}</div> : <p className="muted-copy">No optional answer reviews yet.</p>}</section>
        <section className="analysis-section reports-section"><div className="section-heading"><div><h2>Report archive</h2><p>Set reviews are automatic. Complete-history reports are created only when you click the button above.</p></div><FileText size={20} /></div>{reports.length ? <div className="report-list">{reports.map((report) => <a key={report.id} href={`/api/reports/${report.id}/markdown`} target="_blank" rel="noreferrer"><span>{report.type === 'comprehensive' ? 'Complete history' : 'Completed set'} · {new Date(report.createdAt).toLocaleDateString()}</span><strong>{friendlyReportTitle(report)}</strong><p>{friendlyReportSummary(report)}</p></a>)}</div> : <div className="empty-line"><WarningCircle size={20} /><p>Finish a set to produce the first review.</p></div>}</section>
      </div>

      <section className="analysis-section calibration-section"><div className="section-heading"><div><h2>Measurement layer</h2><p>Calibration signals that shape selection and ground Gemini’s advice.</p></div><span>{attempts.length} raw answers</span></div><div className="calibration-list">{[...skillStates].filter((item) => item.attempts).sort((a, b) => masteryPercent(a) - masteryPercent(b)).slice(0, 10).map((state) => <div key={state.skillId}><span>{skillById.get(state.skillId)?.shortTitle ?? state.skillId}</span><progress max="100" value={masteryPercent(state)} /><strong>{masteryPercent(state)}%</strong><small>{state.attempts} attempts</small></div>)}</div>{!skillStates.length && <p className="muted-copy">No calibration measurements yet. SATLAS has {curriculum.length} skills ready to map.</p>}</section>
    </div>}
  </div>
}
