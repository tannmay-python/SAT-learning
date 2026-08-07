import { useEffect, useState } from 'react'
import { CheckCircle, Copy, Database, ShieldCheck, Trash, WarningCircle } from '@phosphor-icons/react'
import { useAppState } from '../state/AppState'

export function SettingsPage() {
  const { settings, updateSettings, attempts, sessions, aiStatus, dataDirectory } = useAppState()
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => setDraft(settings), [settings])

  const save = async () => {
    await updateSettings(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1800)
  }
  const copyPath = async () => {
    await navigator.clipboard.writeText(dataDirectory); setCopied(true); window.setTimeout(() => setCopied(false), 1600)
  }
  const reset = async () => {
    if (!confirm('Erase every SATLAS answer, report, learner model, and setting from the project data folder?')) return
    if (!confirm('Final check: this deletes the local learning record. Continue?')) return
    const response = await fetch('/api/reset', { method: 'POST' })
    if (!response.ok) return alert('SATLAS could not reset the local data folder.')
    location.reload()
  }

  return (
    <div className="settings-page">
      <header className="page-heading"><div><p className="eyebrow">Settings</p><h1>Local, private, inspectable.</h1><p>Your learning record is ordinary files inside this project. No browser database and no API key.</p></div></header>

      <section className="settings-section"><div className="section-heading"><div><h2>Learner profile</h2><p>Used to shape session length and study plans.</p></div>{saved && <span className="saved-label"><CheckCircle size={16} weight="fill" /> Saved</span>}</div><div className="settings-grid"><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Optional" /></label><label><span>Target score</span><input type="number" min="400" max="1600" step="10" value={draft.targetScore} onChange={(event) => setDraft({ ...draft, targetScore: Number(event.target.value) })} /></label><label><span>Test date</span><input type="date" value={draft.testDate ?? ''} onChange={(event) => setDraft({ ...draft, testDate: event.target.value || undefined })} /></label><label><span>Daily minutes</span><select value={draft.dailyMinutes} onChange={(event) => setDraft({ ...draft, dailyMinutes: Number(event.target.value) })}><option value="20">20</option><option value="30">30</option><option value="45">45</option><option value="60">60</option></select></label><label><span>Theme</span><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as typeof draft.theme })}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><button className="primary-button" onClick={() => void save()}>Save profile</button></section>

      <section className="settings-section"><div className="section-heading"><div><h2>Antigravity analyst</h2><p>Authenticated through your installed Google AI Pro subscription.</p></div>{aiStatus.available ? <CheckCircle size={21} weight="fill" /> : <WarningCircle size={21} weight="fill" />}</div><div className={`ai-connection ${aiStatus.state}`}><span className="analyst-dot" /><div><strong>{aiStatus.available ? `${aiStatus.provider} connected` : 'Antigravity CLI unavailable'}</strong><p>{aiStatus.access}</p><small>Answer reviews and reports: {aiStatus.reportModel}{aiStatus.generationModel ? ` · Fresh R&W: ${aiStatus.generationModel}` : ''}</small>{aiStatus.lastError && <small className="error-copy">{aiStatus.lastError}</small>}</div></div><div className="privacy-note"><ShieldCheck size={19} /><p>No key is embedded in the app. The local server invokes <code>agy</code>, which uses your existing Google OAuth session. Gemini can prepare fresh Reading and Writing questions, review requested answers, analyse completed sets, and build a complete learning report when you ask. Raw evidence is saved first.</p></div></section>

      <section className="settings-section"><div className="section-heading"><div><h2>Project-owned memory</h2><p>{attempts.length} attempts and {sessions.length} sessions are stored on disk.</p></div><Database size={21} /></div><div className="path-field"><code>{dataDirectory || 'Starting local data store…'}</code><button className="secondary-button" disabled={!dataDirectory} onClick={() => void copyPath()}><Copy size={16} /> {copied ? 'Copied' : 'Copy path'}</button></div><p className="data-footnote">The folder contains append-only JSONL evidence, readable reports, the learner model, and an active mock snapshot. You can hand the whole folder to ChatGPT or Claude later.</p><button className="danger-button" onClick={() => void reset()}><Trash size={17} /> Erase local learning record</button></section>
    </div>
  )
}
