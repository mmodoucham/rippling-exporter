import { describe, expect, it } from 'vitest'
import type { DocumentRef } from '../../src/core/document.js'
import { filterByRange, inRange } from '../../src/core/date-range.js'

const ref = (date: string): DocumentRef => ({
  kind: 'invoice',
  id: `id-${date}`,
  date,
  label: 'L',
  url: 'https://example.test/a.pdf',
  extension: 'pdf',
})

describe('inRange', () => {
  it('includes the from boundary', () => {
    expect(inRange(ref('2026-01-01'), '2026-01-01', '2026-08-31')).toBe(true)
  })

  it('includes the to boundary', () => {
    expect(inRange(ref('2026-08-31'), '2026-01-01', '2026-08-31')).toBe(true)
  })

  it('excludes a date before the range', () => {
    expect(inRange(ref('2025-12-31'), '2026-01-01', '2026-08-31')).toBe(false)
  })

  it('excludes a date after the range', () => {
    expect(inRange(ref('2026-09-01'), '2026-01-01', '2026-08-31')).toBe(false)
  })
})

describe('filterByRange', () => {
  it('keeps only refs inside the range and preserves order', () => {
    const refs = [ref('2025-12-31'), ref('2026-03-10'), ref('2026-09-01'), ref('2026-01-01')]
    expect(filterByRange(refs, '2026-01-01', '2026-08-31').map((r) => r.date)).toEqual([
      '2026-03-10',
      '2026-01-01',
    ])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterByRange([ref('2024-01-01')], '2026-01-01', '2026-08-31')).toEqual([])
  })

  it('does not mutate its input', () => {
    const refs = [ref('2026-03-10')]
    filterByRange(refs, '2026-01-01', '2026-08-31')
    expect(refs).toHaveLength(1)
  })
})
