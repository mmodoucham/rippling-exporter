import { describe, expect, it } from 'vitest'
import { parseConfig } from '../src/config.js'

const base = { from: '2026-01-01', to: '2026-08-31', out: './exports' }

describe('parseConfig', () => {
  it('applies defaults for types, attachments and concurrency', () => {
    const cfg = parseConfig(base)
    expect(cfg.types).toEqual(['invoices', 'paystubs'])
    expect(cfg.attachments).toBe(true)
    expect(cfg.concurrency).toBe(4)
  })

  it('parses a comma-separated types list', () => {
    expect(parseConfig({ ...base, types: 'paystubs' }).types).toEqual(['paystubs'])
  })

  it('rejects an unknown document type', () => {
    expect(() => parseConfig({ ...base, types: 'bananas' })).toThrow(/bananas/)
  })

  it('rejects a from date later than the to date', () => {
    expect(() => parseConfig({ ...base, from: '2026-09-01' })).toThrow(/from/i)
  })

  it('rejects a malformed date', () => {
    expect(() => parseConfig({ ...base, from: '01/01/2026' })).toThrow(/YYYY-MM-DD/)
  })

  it('rejects concurrency outside 1-16', () => {
    expect(() => parseConfig({ ...base, concurrency: '0' })).toThrow(/concurrency/i)
    expect(() => parseConfig({ ...base, concurrency: '99' })).toThrow(/concurrency/i)
  })

  it('honours attachments:false', () => {
    expect(parseConfig({ ...base, attachments: false }).attachments).toBe(false)
  })
})
