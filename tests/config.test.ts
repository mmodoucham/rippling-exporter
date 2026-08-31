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

  it('rejects non-existent calendar dates', () => {
    expect(() => parseConfig({ ...base, from: '2026-02-30' })).toThrow(/not a real calendar date/)
    expect(() => parseConfig({ ...base, from: '2026-04-31' })).toThrow(/not a real calendar date/)
  })

  it('accepts a real leap day', () => {
    const cfg = parseConfig({ ...base, from: '2024-02-29' })
    expect(cfg.from).toBe('2024-02-29')
  })

  it('rejects fractional and partially-numeric concurrency values', () => {
    expect(() => parseConfig({ ...base, concurrency: '2.5' })).toThrow(/concurrency/)
    expect(() => parseConfig({ ...base, concurrency: '4abc' })).toThrow(/concurrency/)
  })

  it('accepts a valid concurrency string and returns it as a number', () => {
    expect(parseConfig({ ...base, concurrency: '8' }).concurrency).toBe(8)
  })

  it('rejects empty and whitespace-only types values', () => {
    expect(() => parseConfig({ ...base, types: '' })).toThrow(/must name at least one/)
    expect(() => parseConfig({ ...base, types: '   ' })).toThrow(/must name at least one/)
  })
})
