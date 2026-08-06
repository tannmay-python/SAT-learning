import { Link } from 'wouter'
import { ArrowRight, Brain, CheckCircle, Funnel, WarningCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { domainById, skillById } from '../data/curriculum'
import { useAppState } from '../state/AppState'

export function MistakesPage() {
  const { attempts } = useAppState()
  const [section, setSection] = useState<'all' | 'rw' | 'math'>('all')
  const mistakes = useMemo(() => attempts.filter((attempt) => !attempt.correct && (section === 'all' || attempt.section === section)), [attempts, section])
  const patterns = Object.entries(mistakes.reduce<Record<string, number>>((acc, attempt) => { const key = attempt.mistakeType ?? 'Concept or execution error'; acc[key] = (acc[key] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])

  return (
    <div className="mistakes-page">
      <section className="mistake-hero"><div><p className="eyebrow">Turn every miss into a rule</p><h2>Your mistakes are a curriculum.</h2><p>SATLAS stores the skill, difficulty, confidence, pace, and likely trap behind each wrong answer.</p></div><div className="mistake-count"><strong>{mistakes.length}</strong><span>miss{mistakes.length === 1 ? '' : 'es'} logged</span></div></section>
      <div className="library-toolbar"><div className="segmented"><button className={section === 'all' ? 'active' : ''} onClick={() => setSection('all')}>All</button><button className={section === 'rw' ? 'active' : ''} onClick={() => setSection('rw')}>Reading and Writing</button><button className={section === 'math' ? 'active' : ''} onClick={() => setSection('math')}>Math</button></div><span className="filter-label"><Funnel size={17} />Newest first</span></div>
      {mistakes.length ? <div className="mistake-layout"><section className="panel mistake-list"><div className="section-heading"><div><h3>Item log</h3><p>Revisit the rule, then ask for a fresh version.</p></div></div>{mistakes.map((attempt) => <article className="mistake-row" key={attempt.id}><span className="mistake-icon"><WarningCircle size={20} weight="fill" /></span><div><span className="meta-line">{domainById.get(attempt.domain)?.shortTitle} / Difficulty {attempt.difficulty}</span><strong>{skillById.get(attempt.skillId)?.title}</strong><p>{attempt.mistakeType ?? 'Concept or execution error'}</p><small>{new Date(attempt.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} / {attempt.confidence} / {Math.round(attempt.elapsedMs / 1000)}s</small></div><Link href={`/learn?skill=${attempt.skillId}`} aria-label={`Review ${skillById.get(attempt.skillId)?.title}`}><ArrowRight size={18} /></Link></article>)}</section><aside className="panel pattern-panel"><div className="section-heading"><div><h3>Recurring patterns</h3><p>Most common first.</p></div><Brain size={21} /></div><div className="pattern-list">{patterns.slice(0, 8).map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div><Link className="primary-button" href="/practice?mode=review">Repair due skills <ArrowRight size={18} /></Link></aside></div> : <div className="empty-state large"><CheckCircle size={36} weight="duotone" /><h3>No mistakes logged yet.</h3><p>That means there is no evidence yet, not that there are no weak spots. Start a calibration set.</p><Link className="primary-button" href="/practice?mode=diagnostic">Begin calibration</Link></div>}
    </div>
  )
}
