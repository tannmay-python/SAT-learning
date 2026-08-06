import type { Question } from '../types'

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

