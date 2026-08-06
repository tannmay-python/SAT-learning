import { useState } from 'react'
import { Brain, FileText, Lightning, WarningCircle } from '@phosphor-icons/react'
import { curriculum, skillById } from '../data/curriculum'
import { masteryPercent } from '../engine/adaptive'
import { useAppState } from '../state/AppState'
import type { EvidenceClaim, ReportSummary } from '../types'

function ClaimList({ claims, empty }: { claims: EvidenceClaim[]; empty: string }) {
  return claims.length ? <div className="claim-list">{claims.map((item, index) => <article key={`${item.claim}-${index}`}><p>{item.claim}</p><span>{item.confidence} · {item.evidenceIds.length} evidence link{item.evidenceIds.length === 1 ? '' : 's'}</span></article>)}</div> : <p className="muted-copy">{empty}</p>
}

function IntervalReport({ report }: { report: ReportSummary }) {
  return <section className="analysis-section interval-report">
    <header className="interval-report-header"><div><span>{report.type === 'weekly' ? 'Weekly synthesis' : 'Completed-set analysis'} · {new Date(report.createdAt).toLocaleString()}</span><h2>{report.title}</h2><p>{report.executiveSummary}</p></div><div className="report-links"><a href={`/api/reports/${report.id}/markdown`} target="_blank" rel="noreferrer">Readable report</a><a href={`/api/reports/${report.id}/json`} target="_blank" rel="noreferrer">Raw JSON</a></div></header>

    <div className="report-section-grid">{report.sectionBreakdown?.map((section) => <article key={section.section}><span>{section.section}</span><strong>{section.accuracySummary}</strong><small>{section.pacingSummary}</small>{section.findings.slice(0, 3).map((finding) => <p key={finding.claim}>{finding.claim}</p>)}<em>{section.recommendedFocus}</em></article>)}</div>

    {report.skillBreakdown?.length > 0 && <div className="report-detail-block"><div className="section-heading"><div><h3>Skill diagnosis</h3><p>Performance, mechanism, and prescribed next difficulty.</p></div></div><div className="skill-diagnosis-table">{report.skillBreakdown.map((skill) => <div key={skill.skillId}><span><strong>{skillById.get(skill.skillId)?.title ?? skill.skillId}</strong><small>{skill.diagnosis}</small></span><b>{skill.correct}/{skill.total}</b><em>{skill.averageSeconds}s avg</em><span className="next-prescription">D{skill.nextDifficulty} · {skill.action}</span></div>)}</div></div>}

    <div className="report-lower-grid">
      <div className="report-detail-block"><h3>Error mechanisms</h3>{report.errorTaxonomy?.length ? report.errorTaxonomy.map((item) => <article className="error-class" key={item.label}><span>{item.count}</span><div><strong>{item.label}</strong><p>{item.mechanism}</p></div></article>) : <p className="muted-copy">No repeatable error mechanism was defensible in this interval.</p>}</div>
      <div className="report-detail-block"><h3>Next work</h3>{report.studyPriorities?.length ? <ol className="priority-list">{report.studyPriorities.slice(0, 5).map((item) => <li key={`${item.skillId}-${item.action}`}><strong>{skillById.get(item.skillId)?.shortTitle ?? item.skillId}</strong><p>{item.action}</p><small>{item.reason}</small></li>)}</ol> : <p className="muted-copy">Continue mixed calibration.</p>}<div className="recommended-mix"><strong>Next-set composition</strong><p>{report.recommendedMix}</p></div></div>
    </div>
  </section>
}

export function InsightsPage() {
  const { attempts, skillStates, learnerModel, analyses, reports, aiStatus, generateWeeklyReport } = useAppState()
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const latestReport = reports[0]

  const generate = async () => {
    setGenerating(true); setMessage('')
    try { await generateWeeklyReport(); setMessage('Weekly report written to disk.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Report failed.') }
    finally { setGenerating(false) }
  }

  return <div className="analysis-page">
    <header className="page-heading analysis-heading"><div><p className="eyebrow">Learning analysis</p><h1>What the evidence says.</h1><p>{learnerModel.summary}</p></div><div className="analyst-card"><span className={`analyst-dot ${aiStatus.state}`} /><div><strong>{aiStatus.state === 'working' ? 'Gemini is analysing an interval' : aiStatus.available ? 'Gemini Flash 3.6 is ready' : 'Analyst unavailable'}</strong><small>{aiStatus.activeTask ?? `${aiStatus.queued} queued`}</small></div></div></header>

    {latestReport ? <IntervalReport report={latestReport} /> : <section className="analysis-section empty-report"><FileText size={24} /><div><h2>Your first interval report will appear here.</h2><p>Finish calibration, a practice set, or a mock. Gemini does not run after each answer unless you explicitly request it.</p></div></section>}

    <div className="analysis-grid">
      <section className="analysis-section primary-analysis"><div className="section-heading"><div><h2>Current learner model</h2><p>Claims must have evidence and confidence.</p></div><Brain size={20} /></div><h3>Highest-leverage priorities</h3><ClaimList claims={learnerModel.priorities} empty="Complete a set to form the first priority." /><h3>Working hypotheses</h3><ClaimList claims={learnerModel.hypotheses} empty="No reasoning pattern is defensible yet." /></section>
      <section className="analysis-section"><div className="section-heading"><div><h2>Strengths to preserve</h2><p>Repeated, transferable successes—not isolated correct answers.</p></div></div><ClaimList claims={learnerModel.strengths} empty="Strength claims need repeated evidence across difficulty or context." /></section>
    </div>

    <section className="analysis-section directives-section"><div className="section-heading"><div><h2>Adaptive directives</h2><p>These change the skill mix and difficulty of the next practice set.</p></div><Lightning size={20} /></div>{learnerModel.skillDirectives.length ? <div className="directive-table">{learnerModel.skillDirectives.map((item) => <div key={item.skillId}><span><strong>{skillById.get(item.skillId)?.title ?? item.skillId}</strong><small>{item.reason}</small></span><b>Priority {Math.round(item.priority * 100)}</b><em>Difficulty {item.targetDifficulty}</em></div>)}</div> : <p className="muted-copy">Deterministic calibration remains active until a completed interval gives Gemini enough evidence to issue a directive.</p>}</section>

    <div className="analysis-grid">
      <section className="analysis-section"><div className="section-heading"><div><h2>Requested answer reviews</h2><p>Only the questions where you chose “Analyze with Gemini.”</p></div><span>{analyses.length}</span></div>{analyses.length ? <div className="observation-list">{analyses.slice(0, 8).map((item) => <article key={item.id}><span>{item.justificationQuality} · {new Date(item.createdAt).toLocaleDateString()}</span><h3>{item.verdict}</h3><p>{item.justificationAssessment}</p><details><summary>Reasoning review</summary><p>{item.answerAssessment}</p><p>{item.conceptLesson}</p><ol>{item.betterApproach.map((step) => <li key={step}>{step}</li>)}</ol><strong>{item.nextMove}</strong></details></article>)}</div> : <p className="muted-copy">No optional answer reviews yet.</p>}</section>
      <section className="analysis-section reports-section"><div className="section-heading"><div><h2>Report archive</h2><p>Every completed interval writes Markdown and JSON into the project.</p></div><FileText size={20} /></div><button className="secondary-button" disabled={generating || attempts.length < 3} onClick={() => void generate()}>{generating ? 'Gemini is writing…' : 'Generate weekly synthesis'}</button>{message && <p className="status-message">{message}</p>}{reports.length ? <div className="report-list">{reports.map((report) => <a key={report.id} href={`/api/reports/${report.id}/markdown`} target="_blank" rel="noreferrer"><span>{report.type} · {new Date(report.createdAt).toLocaleDateString()}</span><strong>{report.title}</strong><p>{report.executiveSummary}</p></a>)}</div> : <div className="empty-line"><WarningCircle size={20} /><p>Finish a set to produce the first report.</p></div>}</section>
    </div>

    <section className="analysis-section calibration-section"><div className="section-heading"><div><h2>Measurement layer</h2><p>Calibration signals that shape selection and give Gemini grounded evidence.</p></div><span>{attempts.length} raw answers</span></div><div className="calibration-list">{[...skillStates].filter((item) => item.attempts).sort((a, b) => masteryPercent(a) - masteryPercent(b)).slice(0, 10).map((state) => <div key={state.skillId}><span>{skillById.get(state.skillId)?.shortTitle ?? state.skillId}</span><progress max="100" value={masteryPercent(state)} /><strong>{masteryPercent(state)}%</strong><small>{state.attempts} attempts</small></div>)}</div>{!skillStates.length && <p className="muted-copy">No calibration measurements yet. SATLAS has {curriculum.length} skills ready to map.</p>}</section>
  </div>
}
