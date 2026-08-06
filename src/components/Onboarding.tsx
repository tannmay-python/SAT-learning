import { useState } from 'react'
import { ArrowRight, Check, Target } from '@phosphor-icons/react'
import { useAppState } from '../state/AppState'

export function Onboarding() {
  const { settings, updateSettings } = useAppState()
  const [name, setName] = useState(settings.name)
  const [targetScore, setTargetScore] = useState(settings.targetScore)
  const [dailyMinutes, setDailyMinutes] = useState(settings.dailyMinutes)
  const [testDate, setTestDate] = useState(settings.testDate ?? '')

  const finish = async () => {
    await updateSettings({ name: name.trim(), targetScore, dailyMinutes, testDate: testDate || undefined, onboardingComplete: true })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <span className="brand-mark large"><Target size={25} weight="bold" /></span>
          <p className="eyebrow">Your private SAT workspace</p>
          <h2 id="onboarding-title">Let the system learn you.</h2>
          <p>Every answer changes what comes next. Set a target now, then begin with a short calibration set.</p>
          <div className="onboarding-points">
            <span><Check size={17} weight="bold" /> Written to readable project files</span>
            <span><Check size={17} weight="bold" /> Interval reports through Google Antigravity</span>
            <span><Check size={17} weight="bold" /> Raw evidence stays separate from AI claims</span>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void finish() }} className="onboarding-form">
          <label><span>Your name <small>optional</small></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="What should SATLAS call you?" /></label>
          <label><span>Target score</span><output>{targetScore}</output><input type="range" min="1000" max="1600" step="10" value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value))} /></label>
          <label><span>Daily study time</span><select value={dailyMinutes} onChange={(event) => setDailyMinutes(Number(event.target.value))}><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
          <label><span>Test date <small>optional</small></span><input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} /></label>
          <button className="primary-button" type="submit">Build my plan <ArrowRight size={18} weight="bold" /></button>
        </form>
      </section>
    </div>
  )
}
