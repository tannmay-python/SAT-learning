import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readOfficialQuestions } from './official-bank.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const dataDirectory = resolve(projectRoot, 'data')

const paths = {
  settings: resolve(dataDirectory, 'profile/settings.json'),
  skills: resolve(dataDirectory, 'profile/skill-state.json'),
  learnerModel: resolve(dataDirectory, 'profile/learner-model.json'),
  attempts: resolve(dataDirectory, 'events/attempts.jsonl'),
  sessions: resolve(dataDirectory, 'events/sessions.jsonl'),
  analyses: resolve(dataDirectory, 'events/ai-observations.jsonl'),
  questions: resolve(dataDirectory, 'questions/generated.jsonl'),
  reportsIndex: resolve(dataDirectory, 'reports/index.json'),
  activeMock: resolve(dataDirectory, 'active/mock.json'),
}

const defaultSettings = {
  id: 'learner',
  name: '',
  targetScore: 1400,
  dailyMinutes: 30,
  theme: 'light',
  aiModel: 'gemini-3.6-flash-high',
  onboardingComplete: false,
}

const defaultLearnerModel = {
  summary: 'The analyst is waiting for enough answer evidence to form a defensible learning model.',
  strengths: [],
  hypotheses: [],
  priorities: [],
  skillDirectives: [],
  coachingStyle: 'Explain the shortest reliable method, then verify it on a fresh item.',
  nextSession: 'Begin with a mixed calibration set.',
}

async function ensureParent(file) {
  await mkdir(dirname(file), { recursive: true })
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn(`Could not read ${file}:`, error.message)
    return structuredClone(fallback)
  }
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, 'utf8')
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn(`Could not read ${file}:`, error.message)
    return []
  }
}

async function atomicJson(file, value) {
  await ensureParent(file)
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, file)
}

async function appendJsonl(file, value) {
  await ensureParent(file)
  await appendFile(file, `${JSON.stringify(value)}\n`, 'utf8')
}

function defaultSkillState(skillId) {
  return { skillId, theta: 0, alpha: 1, beta: 1, attempts: 0, correct: 0, streak: 0, lapses: 0, avgTimeMs: 0, intervalDays: 0, ease: 2.3 }
}

function expectedSuccess(theta, difficulty) {
  const difficultyTheta = (difficulty - 3) * 0.72
  return 1 / (1 + Math.exp(-(theta - difficultyTheta)))
}

function updateSkillState(previous, attempt) {
  const state = previous ?? defaultSkillState(attempt.skillId)
  const confidenceWeight = { guess: 0.82, low: 0.91, medium: 1, high: 1.07, certain: 1.13 }
  const evidenceWeight = (attempt.confidence ? confidenceWeight[attempt.confidence] ?? 1 : 1) * (attempt.usedHint ? 0.72 : 1)
  const expected = expectedSuccess(state.theta, attempt.difficulty)
  const learningRate = Math.max(0.12, 0.46 / Math.sqrt(1 + state.attempts / 4))
  const theta = Math.max(-3, Math.min(3, state.theta + learningRate * evidenceWeight * ((attempt.correct ? 1 : 0) - expected)))
  const streak = attempt.correct ? state.streak + 1 : 0
  const highConfidenceMiss = !attempt.correct && (attempt.confidence === 'high' || attempt.confidence === 'certain')
  const ease = Math.max(1.3, Math.min(3, state.ease + (attempt.correct ? 0.04 : -0.22) + (highConfidenceMiss ? -0.08 : 0)))
  let intervalDays
  if (!attempt.correct) intervalDays = 0.01
  else if (state.intervalDays < 1) intervalDays = 1
  else if (streak === 2) intervalDays = Math.max(3, state.intervalDays * 2)
  else intervalDays = Math.min(60, Math.max(1, state.intervalDays * ease * (0.86 + attempt.difficulty * 0.05)))
  const lastSeen = attempt.createdAt
  return {
    ...state,
    theta,
    alpha: state.alpha + (attempt.correct ? evidenceWeight : 0),
    beta: state.beta + (attempt.correct ? 0 : evidenceWeight),
    attempts: state.attempts + 1,
    correct: state.correct + (attempt.correct ? 1 : 0),
    streak,
    lapses: state.lapses + (attempt.correct ? 0 : 1),
    avgTimeMs: state.attempts === 0 ? attempt.elapsedMs : Math.round(state.avgTimeMs * 0.72 + attempt.elapsedMs * 0.28),
    lastSeen,
    dueAt: new Date(new Date(lastSeen).getTime() + intervalDays * 86_400_000).toISOString(),
    intervalDays,
    ease,
  }
}

export async function initializeStore() {
  await Promise.all([
    mkdir(resolve(dataDirectory, 'profile'), { recursive: true }),
    mkdir(resolve(dataDirectory, 'events'), { recursive: true }),
    mkdir(resolve(dataDirectory, 'questions'), { recursive: true }),
    mkdir(resolve(dataDirectory, 'reports/session'), { recursive: true }),
    mkdir(resolve(dataDirectory, 'reports/comprehensive'), { recursive: true }),
    mkdir(resolve(dataDirectory, 'active'), { recursive: true }),
  ])
  const [settings, skills, learnerModel, reports] = await Promise.all([
    readJson(paths.settings, defaultSettings),
    readJson(paths.skills, []),
    readJson(paths.learnerModel, defaultLearnerModel),
    readJson(paths.reportsIndex, []),
  ])
  await Promise.all([
    atomicJson(paths.settings, settings),
    atomicJson(paths.skills, skills),
    atomicJson(paths.learnerModel, learnerModel),
    atomicJson(paths.reportsIndex, reports),
  ])
}

export async function getState(aiStatus) {
  const [settings, skillStates, learnerModel, attempts, sessions, analyses, generatedQuestions, reports, activeMock, officialQuestions] = await Promise.all([
    readJson(paths.settings, defaultSettings),
    readJson(paths.skills, []),
    readJson(paths.learnerModel, defaultLearnerModel),
    readJsonl(paths.attempts),
    readJsonl(paths.sessions),
    readJsonl(paths.analyses),
    readJsonl(paths.questions),
    readJson(paths.reportsIndex, []),
    readJson(paths.activeMock, null),
    readOfficialQuestions(),
  ])
  return {
    settings,
    skillStates,
    learnerModel,
    attempts: attempts.toReversed(),
    sessions: sessions.toReversed(),
    analyses: analyses.toReversed(),
    generatedQuestions: generatedQuestions.filter((question) => question.validationStatus === 'accepted'),
    officialQuestions,
    reports: reports.toReversed().map((report) => report.type === 'weekly' ? { ...report, type: 'comprehensive' } : report),
    activeMock,
    aiStatus,
    dataDirectory,
  }
}

export async function recordAttempt(attempt, question, analysisMode = 'interval') {
  const existing = await readJsonl(paths.attempts)
  if (existing.some((item) => item.id === attempt.id)) return { saved: false, skillStates: await readJson(paths.skills, []) }
  const record = { ...attempt, analysisMode, questionSnapshot: question ? { ...question } : undefined }
  await appendJsonl(paths.attempts, record)
  const skillStates = await readJson(paths.skills, [])
  const index = skillStates.findIndex((state) => state.skillId === attempt.skillId)
  const next = updateSkillState(index >= 0 ? skillStates[index] : undefined, attempt)
  if (index >= 0) skillStates[index] = next
  else skillStates.push(next)
  await atomicJson(paths.skills, skillStates)
  return { saved: true, skillStates }
}

export async function saveSession(session) {
  const existing = await readJsonl(paths.sessions)
  if (existing.some((item) => item.id === session.id)) return false
  await appendJsonl(paths.sessions, session)
  return true
}

export async function saveGeneratedQuestions(questions) {
  const existing = await readJsonl(paths.questions)
  const ids = new Set(existing.map((item) => item.id))
  for (const question of questions) if (!ids.has(question.id)) await appendJsonl(paths.questions, question)
}

export async function updateSettings(patch) {
  const settings = await readJson(paths.settings, defaultSettings)
  const next = { ...settings, ...patch, id: 'learner' }
  await atomicJson(paths.settings, next)
  return next
}

export async function saveAnalysis(analysis) {
  const existing = await readJsonl(paths.analyses)
  if (existing.some((item) => item.attemptId === analysis.attemptId)) return false
  await appendJsonl(paths.analyses, analysis)
  return true
}

export async function saveLearnerModel(model) {
  await atomicJson(paths.learnerModel, model)
}

export async function saveReport(report, markdown, json) {
  const folder = report.type === 'comprehensive' ? 'comprehensive' : 'session'
  const jsonPath = resolve(dataDirectory, `reports/${folder}/${report.id}.json`)
  const markdownPath = resolve(dataDirectory, `reports/${folder}/${report.id}.md`)
  await atomicJson(jsonPath, json)
  await ensureParent(markdownPath)
  await writeFile(markdownPath, `${markdown.trim()}\n`, 'utf8')
  const reports = await readJson(paths.reportsIndex, [])
  const next = reports.filter((item) => item.id !== report.id)
  next.push({ ...report, path: markdownPath, jsonPath })
  await atomicJson(paths.reportsIndex, next)
  return markdownPath
}

export async function hasReport(id) {
  const reports = await readJson(paths.reportsIndex, [])
  return reports.some((report) => report.id === id)
}

export async function getEvidence() {
  const [attempts, sessions, analyses, skillStates, learnerModel, generatedQuestions, settings] = await Promise.all([
    readJsonl(paths.attempts), readJsonl(paths.sessions), readJsonl(paths.analyses), readJson(paths.skills, []), readJson(paths.learnerModel, defaultLearnerModel), readJsonl(paths.questions),
    readJson(paths.settings, defaultSettings),
  ])
  return { attempts, sessions, analyses, skillStates, learnerModel, generatedQuestions, settings }
}

export async function setActiveMock(mock) {
  if (mock === null) {
    await rm(paths.activeMock, { force: true })
    return
  }
  await atomicJson(paths.activeMock, mock)
}

export async function resetStore() {
  for (const folder of ['profile', 'events', 'questions', 'reports', 'active']) {
    await rm(resolve(dataDirectory, folder), { recursive: true, force: true })
  }
  await initializeStore()
}
