import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DocumentRef } from '../../src/core/document.js'
import { saveDocument } from '../../src/download/save.js'

const ref: DocumentRef = {
  kind: 'invoice',
  id: 'abc123',
  date: '2026-03-10',
  label: 'INV_03/10/2026_3',
  url: 'https://x.test/a.pdf',
  extension: 'pdf',
}

const bytes = new TextEncoder().encode('%PDF-1.7\nhello')

describe('saveDocument', () => {
  it('creates nested directories and writes the bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const path = await saveDocument(root, ref, bytes)
    expect(path.startsWith(root)).toBe(true)
    expect(new Uint8Array(await readFile(path))).toEqual(bytes)
  })

  it('is idempotent when called twice', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const first = await saveDocument(root, ref, bytes)
    const second = await saveDocument(root, ref, bytes)
    expect(second).toBe(first)
  })

  it('writes attachments into the attachments subdirectory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const path = await saveDocument(root, { ...ref, kind: 'invoice-attachment' }, bytes)
    expect(path).toContain(join('invoices', 'attachments'))
  })
})
