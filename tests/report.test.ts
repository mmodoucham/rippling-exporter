import { describe, expect, it } from 'vitest'
import { formatReport, type RunResult } from '../src/report.js'

describe('formatReport', () => {
  it('renders each count and the output path for a run with no failures', () => {
    const result: RunResult = { downloaded: 5, skipped: 2, failed: 0 }
    const report = formatReport(result, './exports')
    expect(report).toContain('5')
    expect(report).toContain('2')
    expect(report).toContain('0')
    expect(report).toContain('./exports')
  })

  it('renders each count and the output path for a run with failures', () => {
    const result: RunResult = { downloaded: 1, skipped: 0, failed: 3 }
    const report = formatReport(result, '/tmp/out')
    expect(report).toContain('1')
    expect(report).toContain('0')
    expect(report).toContain('3')
    expect(report).toContain('/tmp/out')
  })

  it('labels the downloaded, skipped, failed, and output lines', () => {
    const result: RunResult = { downloaded: 0, skipped: 0, failed: 0 }
    const report = formatReport(result, './exports')
    expect(report).toMatch(/Downloaded/)
    expect(report).toMatch(/Skipped/)
    expect(report).toMatch(/Failed/)
    expect(report).toMatch(/Output/)
  })
})
