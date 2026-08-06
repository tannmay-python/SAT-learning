import { useMemo, useState } from 'react'
import { BookOpen, CaretDown, CheckCircle, MagnifyingGlass, Target, Warning } from '@phosphor-icons/react'
import { curriculum, domains } from '../data/curriculum'
import { masteryPercent } from '../engine/adaptive'
import { useAppState } from '../state/AppState'
import type { SectionId } from '../types'

export function LearnPage() {
  const { stateMap } = useAppState()
  const params = new URLSearchParams(window.location.search)
  const [section, setSection] = useState<'all' | SectionId>('all')
  const [query, setQuery] = useState('')
  const selectedDomain = params.get('domain')
  const selectedSkill = params.get('skill')

  const filtered = useMemo(() => curriculum.filter((topic) => {
    if (section !== 'all' && topic.section !== section) return false
    if (selectedDomain && topic.domain !== selectedDomain) return false
    const haystack = `${topic.title} ${topic.description} ${topic.coreIdeas.join(' ')} ${topic.tells.join(' ')}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  }), [section, selectedDomain, query])

  return (
    <div className="learn-layout">
      <section className="library-intro">
        <div><p className="eyebrow">Complete content map</p><h2>Know the method, then drill it.</h2><p>Thirty-one compact lessons cover every official domain and testing point, with the pattern tells and traps surfaced first.</p></div>
        <div className="library-stats"><strong>{curriculum.length}</strong><span>skill lessons</span><strong>8</strong><span>official domains</span></div>
      </section>

      <div className="library-toolbar">
        <div className="segmented" role="group" aria-label="Filter by section">
          {([['all', 'All'], ['rw', 'Reading and Writing'], ['math', 'Math']] as const).map(([value, label]) => <button key={value} className={section === value ? 'active' : ''} onClick={() => setSection(value)}>{label}</button>)}
        </div>
        <label className="search-field"><MagnifyingGlass size={18} /><span className="sr-only">Search revision notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a skill, tell, or formula" /></label>
      </div>

      <div className="lesson-groups">
        {domains.filter((domain) => (section === 'all' || domain.section === section) && (!selectedDomain || domain.id === selectedDomain)).map((domain) => {
          const topics = filtered.filter((topic) => topic.domain === domain.id)
          if (!topics.length) return null
          return (
            <section key={domain.id} className="lesson-domain">
              <header><div><h3>{domain.title}</h3><p>{domain.description}</p></div><span>{domain.weight}% <small>{domain.questionRange}</small></span></header>
              <div className="lesson-list">
                {topics.map((topic) => {
                  const state = stateMap.get(topic.id)
                  return (
                    <details key={topic.id} className="lesson" open={selectedSkill === topic.id}>
                      <summary>
                        <span className="lesson-icon"><BookOpen size={19} weight="duotone" /></span>
                        <span><strong>{topic.title}</strong><small>{topic.description}</small></span>
                        <span className="lesson-score">{state ? `${masteryPercent(state)}%` : 'Not tested'}</span>
                        <CaretDown size={17} className="summary-caret" />
                      </summary>
                      <div className="lesson-body">
                        <div className="lesson-column"><h4>The core idea</h4>{topic.coreIdeas.map((item) => <p key={item}><CheckCircle size={16} weight="fill" />{item}</p>)}</div>
                        <div className="lesson-column"><h4>Fast method</h4><ol>{topic.method.map((item) => <li key={item}>{item}</li>)}</ol></div>
                        <div className="lesson-column accent"><h4>Pattern tells</h4>{topic.tells.map((item) => <p key={item}><Target size={16} />{item}</p>)}</div>
                        <div className="lesson-column warning"><h4>Common traps</h4>{topic.traps.map((item) => <p key={item}><Warning size={16} />{item}</p>)}</div>
                        {topic.formulae && <div className="formula-strip">{topic.formulae.map((formula) => <code key={formula}>{formula}</code>)}</div>}
                        <div className="worked-example"><span>Worked example</span><strong>{topic.example.prompt}</strong><p><b>{topic.example.answer}</b> {topic.example.walkthrough}</p></div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>
          )
        })}
        {!filtered.length && <div className="empty-state"><MagnifyingGlass size={28} /><h3>No lesson matches that search.</h3><p>Try a broader term such as slope, inference, or punctuation.</p></div>}
      </div>
    </div>
  )
}
