import { skillById } from '../data/curriculum'
import type { ReportSummary } from '../types'

export function readerText(value: string) {
  return value
    .replace(/\(\s*session\s+[0-9a-f-]{20,}\s*\)/gi, '')
    .replace(/\bsession\s+[0-9a-f-]{20,}\b/gi, 'this set')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, 'the recorded answer')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, 'the recorded date')
    .replace(/during the period/gi, 'Across this work')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function reportTotals(report: ReportSummary) {
  return report.skillBreakdown.reduce((result, skill) => ({ correct: result.correct + skill.correct, total: result.total + skill.total }), { correct: 0, total: 0 })
}

export function friendlyReportTitle(report: ReportSummary) {
  if (report.type === 'comprehensive') return 'Your complete SAT learning report'
  const totals = reportTotals(report)
  return totals.total ? `Set review: ${totals.correct} of ${totals.total} correct` : 'Completed set review'
}

export function friendlyReportSummary(report: ReportSummary) {
  const totals = reportTotals(report)
  if (!totals.total) return 'This review is ready when you want the detail.'
  const accuracy = Math.round(totals.correct / totals.total * 100)
  const misses = report.skillBreakdown.filter((skill) => skill.correct < skill.total)
  const next = report.studyPriorities[0]
  const result = report.type === 'comprehensive'
    ? `Across everything recorded so far, you have answered ${totals.correct} of ${totals.total} questions correctly (${accuracy}%).`
    : `You answered ${totals.correct} of ${totals.total} questions correctly (${accuracy}%).`
  const missText = misses.length === 1
    ? ` The miss was in ${skillById.get(misses[0].skillId)?.title ?? misses[0].skillId}.`
    : misses.length > 1 ? ` The review found ${misses.length} skills worth revisiting.` : ' No errors were recorded in this set.'
  const nextText = next ? ` Next: ${readerText(next.action)}` : ''
  return `${result}${missText}${nextText}`
}
