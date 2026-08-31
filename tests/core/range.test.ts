import { describe, expect, it } from 'vitest'
import { isRealCalendarDate, parseDateRange } from '../../src/core/range.js'

describe('isRealCalendarDate', () => {
  it('accepts a real date', () => {
    expect(isRealCalendarDate('2026-03-10')).toBe(true)
  })

  it('accepts a genuine leap day', () => {
    expect(isRealCalendarDate('2024-02-29')).toBe(true)
    expect(isRealCalendarDate('2000-02-29')).toBe(true)
  })

  it('rejects a rolled-over day', () => {
    expect(isRealCalendarDate('2026-02-30')).toBe(false)
    expect(isRealCalendarDate('2026-04-31')).toBe(false)
  })

  it('rejects a leap day in a non-leap year', () => {
    expect(isRealCalendarDate('2026-02-29')).toBe(false)
  })

  it('rejects an out-of-range month', () => {
    expect(isRealCalendarDate('2026-13-01')).toBe(false)
  })
})

describe('parseDateRange', () => {
  it('returns the range for valid inputs', () => {
    expect(parseDateRange('2026-01-01', '2026-08-31')).toEqual({
      from: '2026-01-01',
      to: '2026-08-31',
    })
  })

  it('accepts a single-day range', () => {
    expect(parseDateRange('2026-03-10', '2026-03-10').from).toBe('2026-03-10')
  })

  it('rejects a malformed date with a message naming the format', () => {
    expect(() => parseDateRange('01/01/2026', '2026-08-31')).toThrow(/YYYY-MM-DD/)
  })

  it('rejects a non-existent date', () => {
    expect(() => parseDateRange('2026-02-30', '2026-08-31')).toThrow(/not a real calendar date/)
  })

  it('rejects from later than to', () => {
    expect(() => parseDateRange('2026-09-01', '2026-08-31')).toThrow(/must not be later/)
  })

  it('rejects an empty value', () => {
    expect(() => parseDateRange('', '2026-08-31')).toThrow(/YYYY-MM-DD/)
  })
})
