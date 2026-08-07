import { describe, expect, it } from 'vitest'
import { friendlyReportSummary, friendlyReportTitle, readerText } from './reportCopy'
import type { ReportSummary } from '../types'

describe('learner-facing report copy', () => {
  const report: ReportSummary = {
    id: 'session-id', type: 'session', title: 'Raw title', period: 'raw', createdAt: '2026-08-06T21:25:35.734Z', executiveSummary: 'raw', path: '', jsonPath: '', model: 'test',
    sectionBreakdown: [], skillBreakdown: [{ skillId: 'statistical-claims', correct: 0, total: 1, averageSeconds: 19, diagnosis: '', nextDifficulty: 2, action: '', evidenceIds: [], confidence: 'tentative' }], errorTaxonomy: [], studyPriorities: [], sevenDayPlan: [], recommendedMix: '', limitations: [],
  }

  it('derives human titles and summaries from structured counts', () => {
    expect(friendlyReportTitle(report)).toBe('Set review: 0 of 1 correct')
    expect(friendlyReportSummary(report)).toContain('The miss was in Evaluating Statistical Claims.')
  })

  it('removes raw database identifiers and timestamps from legacy prose', () => {
    const legacy = 'During the period 2026-08-06T21:20:00.060Z (Session f54585d8-b881-433e-ab98-c6a4d24be003), the learner worked.'
    expect(readerText(legacy)).not.toMatch(/during the period|2026-08-06T|f54585d8/i)
  })
})
