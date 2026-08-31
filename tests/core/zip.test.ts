import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildZip } from '../../src/core/zip.js'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('buildZip', () => {
  it('produces an archive containing every entry at its given path', () => {
    const archive = buildZip([
      { path: 'invoices/a.pdf', bytes: bytes('%PDF-a') },
      { path: 'paystubs/b.pdf', bytes: bytes('%PDF-b') },
    ])
    const unpacked = unzipSync(archive)
    expect(Object.keys(unpacked).sort()).toEqual(['invoices/a.pdf', 'paystubs/b.pdf'])
  })

  it('round-trips the exact bytes', () => {
    const archive = buildZip([{ path: 'invoices/a.pdf', bytes: bytes('%PDF-hello') }])
    const unpacked = unzipSync(archive)
    expect(new TextDecoder().decode(unpacked['invoices/a.pdf'])).toBe('%PDF-hello')
  })

  it('preserves nested directory paths', () => {
    const archive = buildZip([
      { path: 'invoices/attachments/x.pdf', bytes: bytes('%PDF-x') },
    ])
    expect(Object.keys(unzipSync(archive))).toContain('invoices/attachments/x.pdf')
  })

  it('produces a non-empty archive for an empty entry list', () => {
    const archive = buildZip([])
    expect(archive.length).toBeGreaterThan(0)
    expect(Object.keys(unzipSync(archive))).toEqual([])
  })

  it('throws on a duplicate path rather than silently dropping one', () => {
    expect(() =>
      buildZip([
        { path: 'invoices/a.pdf', bytes: bytes('one') },
        { path: 'invoices/a.pdf', bytes: bytes('two') },
      ]),
    ).toThrow(/duplicate/i)
  })
})
