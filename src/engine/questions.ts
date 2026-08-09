import type { Question } from '../types'

// Generated and expanded Reading and Writing items occasionally inherit a
// sentence that explains the item's teaching purpose instead of belonging to
// the source-like passage. Keep this guard in the browser as well as on the
// server so older saved items cannot leak that commentary into the learner's
// view while the data file is being refreshed.
const stimulusMetaLeak = /the (?:sentence|question) is part of|the punctuation decision depends on|the surrounding information clarifies|readers can test the choice|the clause relationship remains clear|recheck the exact claim|the example is useful because|the (?:example|finding|observation) (?:is|helps|serves as) useful because|it also preserves the uncertainty in the evidence|the passage distinguishes a supported possibility from a claim|this finding matters beyond the individual case because|the passage (?:connects|links) the specific observation to the broader conclusion|the distinction matters because|the order of the sentences is consequential|taken together, the sentences show|the relevant evidence is the detail|a careful reader must distinguish evidence|the comparison is informative because|nothing in the passage establishes an absolute rule|the transition is determined by the relationship|the final sentence extends the local reasoning|the notes include both background and evidence|the strongest sentence is concise/i

export function cleanQuestionStimulus(value?: string) {
  if (!value) return value
  const match = value.search(stimulusMetaLeak)
  return match < 0 ? value : value.slice(0, match).trim()
}

export function sanitizeQuestion(question: Question): Question {
  const stimulus = cleanQuestionStimulus(question.stimulus)
  const secondaryStimulus = cleanQuestionStimulus(question.secondaryStimulus)
  return { ...question, ...(stimulus !== undefined ? { stimulus } : {}), ...(secondaryStimulus !== undefined ? { secondaryStimulus } : {}) }
}

export function normalizeResponse(value: string) {
  const trimmed = value.trim().replace(/,/g, '')
  if (!trimmed) return ''
  const fractionMatch = trimmed.match(/^(-?\d+)\s*\/\s*(-?\d+)$/)
  if (fractionMatch && Number(fractionMatch[2]) !== 0) return String(Number(fractionMatch[1]) / Number(fractionMatch[2]))
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? String(numeric) : trimmed.toLowerCase()
}

export function isCorrectResponse(question: Question, response: string) {
  if (question.format === 'multiple-choice') return response === question.answer
  const normalized = normalizeResponse(response)
  const accepted = [question.answer, ...(question.acceptedAnswers ?? [])].map(normalizeResponse)
  return accepted.some((answer) => {
    const numericAnswer = Number(answer)
    const numericResponse = Number(normalized)
    if (Number.isFinite(numericAnswer) && Number.isFinite(numericResponse)) return Math.abs(numericAnswer - numericResponse) < 0.000001
    return answer === normalized
  })
}

export function displayAnswer(question: Question) {
  if (question.format === 'student-produced') return question.answer
  return question.choices?.find((choice) => choice.id === question.answer)?.text ?? question.answer
}
