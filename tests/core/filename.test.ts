import { describe, expect, it } from 'vitest'
import type { DocumentRef } from '../../src/core/document.js'
import { relativePathFor } from '../../src/core/filename.js'

const base: DocumentRef = {
  kind: 'invoice',
  id: '68c1a2b3d4e5f60718293a4b',
  date: '2026-03-10',
  label: 'INV_03/10/2026_3',
  url: 'https://example.test/a.pdf',
  extension: 'pdf',
}

describe('relativePathFor', () => {
  it('replaces slashes in the label so the label cannot create directories', () => {
    const path = relativePathFor(base)
    expect(path).toBe('invoices/2026-03-10_INV_03-10-2026_3_68c1a2b3d4e5f60718293a4b.pdf')
    expect(path.split('/')).toHaveLength(2)
  })

  it('nests attachments under invoices/attachments', () => {
    const path = relativePathFor({ ...base, kind: 'invoice-attachment', id: `${base.id}_att1` })
    expect(path.startsWith('invoices/attachments/')).toBe(true)
    expect(path.endsWith('_68c1a2b3d4e5f60718293a4b_att1.pdf')).toBe(true)
  })

  it('places pay stubs in their own directory', () => {
    const path = relativePathFor({
      ...base,
      kind: 'paystub',
      label: 'Mar 1, 2026 – Mar 15, 2026 - Acme Payroll Inc',
    })
    expect(path.startsWith('paystubs/2026-03-10_Mar-1-2026')).toBe(true)
  })

  it('strips path traversal sequences from the label', () => {
    expect(relativePathFor({ ...base, label: '../../etc/passwd' })).not.toContain('..')
  })

  it('collapses runs of separators and trims them from the ends', () => {
    expect(relativePathFor({ ...base, label: '  a // b  ' })).toContain('_a-b_')
  })

  it('truncates a very long label', () => {
    const path = relativePathFor({ ...base, label: 'x'.repeat(300) })
    expect(path.length).toBeLessThan(200)
  })

  it('honours a non-pdf extension', () => {
    expect(relativePathFor({ ...base, extension: 'png' }).endsWith('.png')).toBe(true)
  })
})
