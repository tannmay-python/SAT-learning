import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { getEvidence, hasReport, saveAnalysis, saveLearnerModel, saveReport } from './store.mjs'

const execFileAsync = promisify(execFile)
const serverDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(serverDirectory, '..')
const schemaDirectory = resolve(serverDirectory, 'schemas')
const agyBinary = process.env.ANTIGRAVITY_CLI || resolve(homedir(), '.local/bin/agy')
const observerModel = process.env.SATLAS_OBSERVER_MODEL || 'gemini-3.6-flash-high'
const sessionModel = process.env.SATLAS_SESSION_MODEL || 'gemini-3.6-flash-high'
const reportModel = process.env.SATLAS_REPORT_MODEL || 'gemini-3.6-flash-high'
const promptVersion = 'satlas-analyst-v3'

const runtime = {
  state: existsSync(agyBinary) ? 'idle' : 'offline',
  queued: 0,
  activeTask: undefined,
  lastCompletedAt: undefined,
  lastError: existsSync(agyBinary) ? undefined : `Antigravity CLI was not found at ${agyBinary}`,
}
let workChain = Promise.resolve()
let resetRevision = 0
const queuedAttemptIds = new Set()
const queuedReportIds = new Set()

export function invalidateAiWork() {
  resetRevision += 1
}

export function getAiStatus() {
  return {
    available: existsSync(agyBinary),
    provider: 'Google Antigravity',
    access: 'Google AI Pro subscription via local OAuth',
    observerModel,
    reportModel,
    ...runtime,
  }
}

function enqueue(label, work) {
  runtime.queued += 1
  const task = workChain.catch(() => undefined).then(async () => {
    runtime.queued -= 1
    runtime.state = 'working'
    runtime.activeTask = label
    runtime.lastError = undefined
    try {
      const value = await work()
      runtime.lastCompletedAt = new Date().toISOString()
      runtime.state = 'idle'
      return value
    } catch (error) {
      runtime.state = 'error'
      runtime.lastError = error instanceof Error ? error.message : String(error)
      console.error(`Antigravity task failed (${label}):`, error)
      throw error
    } finally {
      runtime.activeTask = undefined
    }
  })
  workChain = task
  return task
}

async function runStructured({ prompt, schema, model, effort = 'low', timeout = '2m' }) {
  if (!existsSync(agyBinary)) throw new Error('Antigravity CLI is not installed.')
  const args = [
    '--print', prompt,
    '--output-format', 'json',
    '--json-schema', resolve(schemaDirectory, schema),
    '--model', model,
    '--effort', effort,
    '--mode', 'plan',
    '--sandbox',
    '--disable-slash-commands',
    '--print-timeout', timeout,
  ]
  const { stdout } = await execFileAsync(agyBinary, args, {
    cwd: projectRoot,
    timeout: 180_000,
    maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  })
  const envelope = JSON.parse(stdout.trim())
  if (envelope.status && String(envelope.status).toLowerCase() !== 'success') throw new Error(envelope.error || `Antigravity returned ${envelope.status}.`)
  const structured = envelope.structured_output ?? envelope.structuredOutput
  if (!structured) throw new Error('Antigravity returned no structured analysis.')
  return typeof structured === 'string' ? JSON.parse(structured) : structured
}

function compactAttempt(record) {
  const question = record.questionSnapshot
  return {
    id: record.id,
    sessionId: record.sessionId,
    createdAt: record.createdAt,
    section: record.section,
    domain: record.domain,
    skillId: record.skillId,
    difficulty: record.difficulty,
    response: record.response,
    correct: record.correct,
    ...(record.confidence ? { confidence: record.confidence } : {}),
    elapsedSeconds: Math.round(record.elapsedMs / 1000),
    usedHint: record.usedHint,
    reasoningNote: record.reasoningNote || null,
    likelyTrap: record.mistakeType || null,
    question: question ? {
      prompt: question.prompt,
      stimulus: question.stimulus,
      choices: question.choices,
      answer: question.answer,
      explanation: question.explanation,
      concept: question.concept,
      estimatedSeconds: question.estimatedSeconds,
    } : undefined,
  }
}

function withTimestamp(model) {
  return { ...model, updatedAt: new Date().toISOString() }
}

export function queueAttemptAnalysis(attempt, question, learnerJustification) {
  if (queuedAttemptIds.has(attempt.id)) return Promise.resolve(null)
  queuedAttemptIds.add(attempt.id)
  const revision = resetRevision
  return enqueue(`answer ${attempt.id}`, async () => {
    const evidence = await getEvidence()
    const current = { ...attempt, reasoningNote: learnerJustification, questionSnapshot: question }
    const recentSameSkill = evidence.attempts.filter((item) => item.skillId === attempt.skillId && item.id !== attempt.id).slice(-8).map(compactAttempt)
    const prompt = `Analyze one SAT answer as a rigorous SAT tutor. The learner explicitly requested this review after answering.

CURRENT ANSWER EVENT
${JSON.stringify(compactAttempt(current), null, 2)}

RECENT SAME-SKILL EVIDENCE
${JSON.stringify(recentSameSkill, null, 2)}

CURRENT LEARNER MODEL
${JSON.stringify(evidence.learnerModel, null, 2)}

Requirements:
- Evaluate the learner's written justification directly: identify valid moves, missing warrants, unsupported leaps, misread wording, and any mismatch between the justification and selected answer.
- Separate answer correctness from reasoning quality. A correct answer can have weak reasoning; an incorrect answer can contain useful partial reasoning.
- Reconstruct the shortest reliable SAT method step by step, using the exact text, quantities, or grammar rule in the item.
- Teach the underlying concept, explain why the chosen option works or fails, and include one concise transfer question the learner can answer mentally.
- Compare elapsed time with the supplied estimated time, but never equate speed with mastery.
- Confidence is voluntary. If CURRENT ANSWER EVENT omits confidence, do not invent or infer a rating and do not discuss calibration. If it includes confidence, treat that explicit selection as one signal and compare it with the reasoning and outcome.
- The next move must name a concrete skill, difficulty, or review action.
- Be specific and comprehensive without padding. Do not use generic encouragement.
- Never call a skill mastered from one answer. A single item can demonstrate a method on that item, but learner-model claims based on it must remain tentative until repeated or transferred.
- Every analytical claim must cite real IDs from the evidence above.
- Return the full updated learner model, retaining earlier claims that remain supported.`
    const result = await runStructured({ prompt, schema: 'attempt-analysis.json', model: observerModel, effort: 'high', timeout: '3m' })
    if (revision !== resetRevision) return null
    const createdAt = new Date().toISOString()
    const analysis = {
      id: `analysis-${attempt.id}`,
      attemptId: attempt.id,
      createdAt,
      model: observerModel,
      promptVersion,
      learnerJustification,
      ...result.analysis,
    }
    await Promise.all([
      saveAnalysis(analysis),
      saveLearnerModel(withTimestamp(result.learnerModel)),
    ])
    return analysis
  }).finally(() => queuedAttemptIds.delete(attempt.id))
}

function reportMarkdown(report, meta) {
  const claims = (items) => items.length ? items.map((item) => `- ${item.claim}  \n  Evidence: ${item.evidenceIds.join(', ') || 'insufficient'} (${item.confidence})`).join('\n') : '- No defensible claim yet.'
  const priorities = report.studyPriorities.length ? report.studyPriorities.map((item) => `- **${item.skillId}:** ${item.action} — ${item.reason}  \n  Evidence: ${item.evidenceIds.join(', ')}`).join('\n') : '- Continue mixed calibration.'
  const days = report.sevenDayPlan.map((item) => `- **${item.day} · ${item.minutes} min:** ${item.work}  \n  Success check: ${item.successCheck}`).join('\n')
  const sections = report.sectionBreakdown.map((item) => `### ${item.section}\n\n**Accuracy:** ${item.accuracySummary}\n\n**Pacing:** ${item.pacingSummary}\n\n${claims(item.findings)}\n\n**Recommended focus:** ${item.recommendedFocus}`).join('\n\n')
  const skills = report.skillBreakdown.length ? report.skillBreakdown.map((item) => `- **${item.skillId} · ${item.correct}/${item.total}, ${item.averageSeconds}s average:** ${item.diagnosis}  \n  Next: difficulty ${item.nextDifficulty}; ${item.action}  \n  Evidence: ${item.evidenceIds.join(', ') || 'insufficient'} (${item.confidence})`).join('\n') : '- No skill has enough evidence for a defensible breakdown.'
  const errors = report.errorTaxonomy.length ? report.errorTaxonomy.map((item) => `- **${item.label} (${item.count}):** ${item.mechanism}  \n  Evidence: ${item.evidenceIds.join(', ') || 'insufficient'}`).join('\n') : '- No error class is defensible yet.'
  return `# ${report.title}

_Generated ${meta.createdAt} by ${meta.model}. Period: ${meta.period}._

## Executive summary

${report.executiveSummary}

## What changed

${claims(report.whatChanged)}

## Strengths

${claims(report.strengths)}

## Weaknesses and misconception patterns

${claims([...report.weaknesses, ...report.misconceptionPatterns])}

## Section breakdown

${sections}

## Skill-by-skill breakdown

${skills}

## Error taxonomy

${errors}

## Pacing and decisions

${claims(report.pacingAndDecisions)}

## Confidence calibration

${claims(report.confidenceCalibration)}

## Transfer and retention

${claims(report.transferAndRetention)}

## Study priorities

${priorities}

## Seven-day plan

${days}

## Recommended question mix

${report.recommendedMix}

## Limits of this analysis

${report.limitations.map((item) => `- ${item}`).join('\n') || '- None stated.'}
`
}

function isoWeek(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utc - yearStart) / 86_400_000) + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function intervalFacts(attempts) {
  const summarize = (items) => ({
    total: items.length,
    correct: items.filter((item) => item.correct).length,
    averageSeconds: Math.round(items.reduce((sum, item) => sum + item.elapsedMs / 1000, 0) / Math.max(1, items.length)),
    averageTargetSeconds: Math.round(items.reduce((sum, item) => sum + (item.questionSnapshot?.estimatedSeconds ?? 0), 0) / Math.max(1, items.length)),
    evidenceIds: items.map((item) => item.id),
  })
  return {
    overall: summarize(attempts),
    sections: Object.fromEntries(['rw', 'math'].map((section) => [section, summarize(attempts.filter((item) => item.section === section))]).filter(([, facts]) => facts.total > 0)),
    skills: Object.fromEntries([...new Set(attempts.map((item) => item.skillId))].map((skillId) => [skillId, summarize(attempts.filter((item) => item.skillId === skillId))])),
    confidence: Object.fromEntries([...new Set(attempts.map((item) => item.confidence).filter(Boolean))].map((level) => [level, summarize(attempts.filter((item) => item.confidence === level))])),
  }
}

export function normalizeReport(report, attempts, facts) {
  const sectionNames = { rw: 'Reading and Writing', math: 'Math' }
  const allowedAttemptIds = new Set(attempts.map((item) => item.id))
  const sectionBreakdown = Object.entries(facts.sections).map(([section, computed]) => {
    const generated = report.sectionBreakdown.find((item) => item.section === sectionNames[section])
    return {
      section: sectionNames[section],
      accuracySummary: `${computed.correct}/${computed.total} correct (${Math.round(computed.correct / computed.total * 100)}%)`,
      pacingSummary: `${computed.averageSeconds}s average against a ${computed.averageTargetSeconds}s authored target`,
      findings: generated?.findings ?? [],
      recommendedFocus: generated?.recommendedFocus ?? 'Collect more evidence in this section before changing the plan.',
    }
  })
  const skillBreakdown = Object.entries(facts.skills).map(([skillId, computed]) => {
    const generated = report.skillBreakdown.find((item) => item.skillId === skillId)
    return {
      skillId,
      correct: computed.correct,
      total: computed.total,
      averageSeconds: computed.averageSeconds,
      diagnosis: generated?.diagnosis ?? 'Insufficient evidence for a mechanism-level diagnosis.',
      nextDifficulty: generated?.nextDifficulty ?? Math.max(1, Math.min(5, Math.round(attempts.find((item) => item.skillId === skillId)?.difficulty ?? 3))),
      action: generated?.action ?? 'Collect another varied item before changing difficulty.',
      evidenceIds: computed.evidenceIds,
      confidence: generated?.confidence ?? 'tentative',
    }
  })
  const errorTaxonomy = report.errorTaxonomy.map((item) => {
    const evidenceIds = [...new Set(item.evidenceIds)].filter((id) => allowedAttemptIds.has(id) && !attempts.find((attempt) => attempt.id === id)?.correct)
    return { ...item, evidenceIds, count: evidenceIds.length }
  }).filter((item) => item.count > 0)
  return { ...report, sectionBreakdown, skillBreakdown, errorTaxonomy }
}

async function createReport({ id, type, period, attempts, sessions, model, effort }) {
  const revision = resetRevision
  const evidence = await getEvidence()
  const facts = intervalFacts(attempts)
  const prompt = `Write an evidence-bound ${type} SAT learning report and update the learner model.

PERIOD: ${period}
RAW ANSWER EVENTS
${JSON.stringify(attempts.map(compactAttempt), null, 2)}

SESSION RECORDS
${JSON.stringify(sessions, null, 2)}

COMPUTED INTERVAL FACTS (authoritative; do not recalculate or contradict)
${JSON.stringify(facts, null, 2)}

PRIOR AI OBSERVATIONS
${JSON.stringify(evidence.analyses.slice(-30), null, 2)}

CURRENT LEARNER MODEL
${JSON.stringify(evidence.learnerModel, null, 2)}

Requirements:
- Start with exact computed counts from the raw evidence. Give separate Reading and Writing and Math breakdowns whenever both appear.
- sectionBreakdown must include only sections with at least one answer in COMPUTED INTERVAL FACTS. Never add a 0/0 section.
- For every represented skill, report correct/total, average elapsed seconds, the most defensible mechanism, target difficulty, and a concrete action.
- Classify errors into evidence-supported mechanisms such as concept gap, text/condition misread, setup/model selection, execution, pacing, or confidence miscalibration. Do not force an error into a category without evidence.
- Go beyond accuracy summaries: infer decision habits, confidence calibration, transfer, retention, pacing, and the likely highest-leverage work.
- Confidence is voluntary. An omitted confidence field means no rating was supplied: do not infer a default, include it in calibration, or treat it as evidence. Analyze confidence only for attempts that contain an explicit rating.
- Separate evidence from hypothesis. Every claim cites exact attempt or session IDs.
- Do not call a one-off error a pattern. State limitations and missing evidence explicitly.
- Never call a skill mastered, firm, fluent, or retained unless at least three successful attempts span at least two materially different forms and there is retention or transfer evidence. With less evidence, say exactly what was demonstrated and keep the inference tentative.
- Transfer requires success on a materially different form; retention requires evidence from a later session. Do not infer either from one item or from a written intention to check work.
- Distinguish a calibration, practice-set, review-set, section, or full-mock report and calibrate the depth to the evidence volume.
- Create a realistic seven-day plan using targeted lessons, mixed practice, spaced recall, and timed work only when justified.
- Recommendations must include skill IDs and target difficulty in the learner model.
- Return a complete updated learner model.`
  const generatedReport = await runStructured({ prompt, schema: 'report.json', model, effort, timeout: '3m' })
  const report = normalizeReport(generatedReport, attempts, facts)
  if (revision !== resetRevision) return null
  const createdAt = new Date().toISOString()
  const summary = {
    id, type, title: report.title, period, createdAt, executiveSummary: report.executiveSummary, model,
    sectionBreakdown: report.sectionBreakdown,
    skillBreakdown: report.skillBreakdown,
    errorTaxonomy: report.errorTaxonomy,
    studyPriorities: report.studyPriorities,
    sevenDayPlan: report.sevenDayPlan,
    recommendedMix: report.recommendedMix,
    limitations: report.limitations,
  }
  await Promise.all([
    saveLearnerModel(withTimestamp(report.learnerModel)),
    saveReport(summary, reportMarkdown(report, summary), { ...summary, ...report }),
  ])
  return summary
}

export function queueSessionReport(session) {
  if (queuedReportIds.has(session.id)) return Promise.resolve(null)
  queuedReportIds.add(session.id)
  return enqueue(`session report ${session.id}`, async () => {
    if (await hasReport(session.id)) return null
    const evidence = await getEvidence()
    const attempts = evidence.attempts.filter((item) => item.sessionId === session.id)
    if (!attempts.length) throw new Error('No answer evidence was recorded for this session.')
    const period = `${session.startedAt} to ${session.completedAt || session.startedAt}`
    return createReport({ id: session.id, type: 'session', period, attempts, sessions: [session], model: sessionModel, effort: 'high' })
  }).finally(() => queuedReportIds.delete(session.id))
}

export function queueWeeklyReport(force = false) {
  const week = isoWeek()
  return enqueue(`weekly report ${week}`, async () => {
    if (!force && await hasReport(week)) return null
    const evidence = await getEvidence()
    const cutoff = Date.now() - 7 * 86_400_000
    const attempts = evidence.attempts.filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    const sessions = evidence.sessions.filter((item) => new Date(item.completedAt || item.startedAt).getTime() >= cutoff)
    if (attempts.length < 3) throw new Error('At least three answers are needed for a weekly report.')
    return createReport({ id: week, type: 'weekly', period: `Seven days ending ${new Date().toISOString().slice(0, 10)}`, attempts, sessions, model: reportModel, effort: 'high' })
  })
}

export async function recoverPendingReports(limit = Number.POSITIVE_INFINITY) {
  if (!existsSync(agyBinary)) return 0
  const evidence = await getEvidence()
  const pending = []
  for (const session of evidence.sessions.filter((item) => item.completedAt).slice(-limit)) {
    if (!await hasReport(session.id)) pending.push(session)
  }
  for (const session of pending) queueSessionReport(session).catch(() => undefined)
  return pending.length
}
