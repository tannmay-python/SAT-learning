import express from 'express'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  dataDirectory,
  getState,
  initializeStore,
  recordAttempt,
  resetStore,
  saveGeneratedQuestions,
  saveSession,
  setActiveMock,
  updateSettings,
} from './server/store.mjs'
import {
  getAiStatus,
  invalidateAiWork,
  queueAttemptAnalysis,
  queueAdaptiveQuestionGeneration,
  queueComprehensiveReport,
  queueSessionReport,
  recoverPendingReports,
} from './server/antigravity.mjs'

for (const file of ['.env', '.env.local']) {
  try { process.loadEnvFile(file) } catch { /* Local overrides are optional. */ }
}

await initializeStore()

const app = express()
const port = Number(process.env.PORT || 4174)
app.use(express.json({ limit: '3mb' }))

const attemptSchema = z.object({
  id: z.string().min(4),
  sessionId: z.string().min(4),
  questionId: z.string().min(1),
  section: z.enum(['rw', 'math']),
  domain: z.string().min(2),
  skillId: z.string().min(2),
  difficulty: z.number().int().min(1).max(5),
  response: z.string(),
  correct: z.boolean(),
  confidence: z.enum(['guess', 'low', 'medium', 'high', 'certain']).optional(),
  elapsedMs: z.number().int().nonnegative(),
  usedHint: z.boolean(),
  mistakeType: z.string().optional(),
  reasoningNote: z.string().max(1600).optional(),
  createdAt: z.string(),
}).passthrough()

const settingsSchema = z.object({
  name: z.string().max(80).optional(),
  targetScore: z.number().int().min(400).max(1600).optional(),
  testDate: z.string().optional(),
  dailyMinutes: z.number().int().min(5).max(180).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  aiModel: z.string().max(100).optional(),
  onboardingComplete: z.boolean().optional(),
}).strict()

const generatedBlueprintSchema = z.array(z.object({
  section: z.literal('rw'),
  domain: z.enum(['craft-structure', 'information-ideas', 'standard-english', 'expression-ideas']),
  skillId: z.enum(['words-in-context', 'text-structure-purpose', 'cross-text-connections', 'central-ideas-details', 'command-evidence-textual', 'command-evidence-quantitative', 'inferences', 'boundaries', 'form-structure-sense', 'rhetorical-synthesis', 'transitions']),
  difficulty: z.number().int().min(1).max(5),
})).min(1).max(12)

app.get('/api/state', async (_request, response) => {
  response.json(await getState(getAiStatus()))
})

app.get('/api/ai/status', (_request, response) => response.json(getAiStatus()))

app.post('/api/attempts', async (request, response) => {
  const parsed = attemptSchema.safeParse(request.body?.attempt)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid answer record.', details: parsed.error.flatten() })
  const result = await recordAttempt(parsed.data, request.body?.question, 'interval')
  response.status(result.saved ? 201 : 200).json({ ...result, analysisQueued: false })
})

app.post('/api/analyses/attempt', async (request, response) => {
  const attemptId = String(request.body?.attemptId || '')
  const justification = String(request.body?.justification || '').trim()
  if (attemptId.length < 4 || justification.length < 8 || justification.length > 2400) {
    return response.status(400).json({ error: 'Add a short justification (8–2,400 characters) before requesting analysis.' })
  }
  const state = await getState(getAiStatus())
  const existing = state.analyses.find((item) => item.attemptId === attemptId)
  if (existing) return response.json({ analysis: existing, existing: true })
  const attempt = state.attempts.find((item) => item.id === attemptId)
  if (!attempt?.questionSnapshot) return response.status(404).json({ error: 'The answer evidence or question snapshot was not found.' })
  try {
    const analysis = await queueAttemptAnalysis(attempt, attempt.questionSnapshot, justification)
    response.status(201).json({ analysis })
  } catch (error) {
    response.status(409).json({ error: error instanceof Error ? error.message : 'Gemini analysis failed.' })
  }
})

app.post('/api/sessions', async (request, response) => {
  const session = request.body?.session
  if (!session?.id || !session?.startedAt || !Array.isArray(session.questionIds)) return response.status(400).json({ error: 'Invalid session record.' })
  const saved = await saveSession(session)
  if (saved && session.completedAt) {
    queueSessionReport(session)
      .catch(() => undefined)
  }
  response.status(saved ? 201 : 200).json({ saved, reportQueued: saved && Boolean(session.completedAt) })
})

app.patch('/api/settings', async (request, response) => {
  const parsed = settingsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid settings.', details: parsed.error.flatten() })
  response.json(await updateSettings(parsed.data))
})

app.post('/api/generated-questions', async (request, response) => {
  if (!Array.isArray(request.body?.questions)) return response.status(400).json({ error: 'Questions must be an array.' })
  await saveGeneratedQuestions(request.body.questions)
  response.status(201).json({ saved: request.body.questions.length })
})

app.post('/api/practice/generate', async (request, response) => {
  const parsed = generatedBlueprintSchema.safeParse(request.body?.blueprint)
  if (!parsed.success) return response.status(400).json({ error: 'The fresh-question plan was invalid.', details: parsed.error.flatten() })
  try {
    const questions = await queueAdaptiveQuestionGeneration(parsed.data)
    response.status(201).json({ questions })
  } catch (error) {
    response.status(409).json({ error: error instanceof Error ? error.message : 'Fresh-question generation failed.' })
  }
})

app.put('/api/active-mock', async (request, response) => {
  await setActiveMock(request.body?.mock ?? null)
  response.status(204).end()
})

app.delete('/api/active-mock', async (_request, response) => {
  await setActiveMock(null)
  response.status(204).end()
})

app.post('/api/reports/comprehensive', async (_request, response) => {
  try {
    const report = await queueComprehensiveReport()
    response.json({ report })
  } catch (error) {
    response.status(409).json({ error: error instanceof Error ? error.message : 'Complete learning report failed.' })
  }
})

app.get('/api/reports/:id/markdown', async (request, response) => {
  const state = await getState(getAiStatus())
  const report = state.reports.find((item) => item.id === request.params.id)
  if (!report?.path || !report.path.startsWith(dataDirectory)) return response.status(404).send('Report not found.')
  response.type('text/markdown').send(await readFile(report.path, 'utf8'))
})

app.get('/api/reports/:id/json', async (request, response) => {
  const state = await getState(getAiStatus())
  const report = state.reports.find((item) => item.id === request.params.id)
  if (!report?.jsonPath || !report.jsonPath.startsWith(dataDirectory)) return response.status(404).json({ error: 'Report not found.' })
  response.type('application/json').send(await readFile(report.jsonPath, 'utf8'))
})

app.post('/api/reset', async (_request, response) => {
  invalidateAiWork()
  await resetStore()
  response.status(204).end()
})

const dist = resolve('dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*path', (_request, response) => response.sendFile(resolve(dist, 'index.html')))
}

app.listen(port, '127.0.0.1', async () => {
  console.log(`SATLAS local server listening on http://127.0.0.1:${port}`)
  console.log(`Learning memory: ${dataDirectory}`)
  const status = getAiStatus()
  console.log(status.available ? `Antigravity analyst ready: ${status.observerModel}` : status.lastError)
  await recoverPendingReports()
})

const recoveryTimer = setInterval(() => recoverPendingReports().catch(() => undefined), 60_000)
recoveryTimer.unref()
