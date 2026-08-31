import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DocumentRef } from '../src/core/document.js'
import { saveDocument, sha256 } from '../src/download/save.js'
import {
  emptyManifest,
  isAlreadyDownloaded,
  loadManifest,
  saveManifest,
  withEntry,
  withFailure,
} from '../src/manifest.js'

const ref: DocumentRef = {
  kind: 'invoice',
  id: 'abc123',
  date: '2026-03-10',
  label: 'INV-1',
  url: 'https://x.test/a.pdf',
  extension: 'pdf',
}
const bytes = new TextEncoder().encode('%PDF-1.7\nhello')

const entryFor = (path: string) => ({
  id: ref.id,
  kind: ref.kind,
  date: ref.date,
  path,
  sha256: sha256(bytes),
  bytes: bytes.length,
  downloadedAt: '2026-08-31T00:00:00.000Z',
})

describe('manifest', () => {
  it('returns an empty manifest when none exists on disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    expect(await loadManifest(root)).toEqual(emptyManifest())
  })

  it('round-trips through disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const m = withEntry(emptyManifest(), entryFor('invoices/x.pdf'))
    await saveManifest(root, m)
    expect(await loadManifest(root)).toEqual(m)
  })

  it('returns an empty manifest when the file on disk is corrupt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    await writeFile(join(root, 'manifest.json'), 'not json')
    expect(await loadManifest(root)).toEqual(emptyManifest())
  })

  it('does not mutate the manifest when adding an entry', () => {
    const base = emptyManifest()
    withEntry(base, entryFor('invoices/x.pdf'))
    expect(base.entries).toHaveLength(0)
  })

  it('drops an earlier failure for the same id once an entry is added', () => {
    const withFailureManifest = withFailure(emptyManifest(), ref.id, 'HTTP 500')
    const result = withEntry(withFailureManifest, entryFor('invoices/x.pdf'))
    expect(result.failures).toEqual([])
    expect(result.entries).toHaveLength(1)
  })

  it('keeps a failure for a different id when an entry is added', () => {
    const withFailureManifest = withFailure(emptyManifest(), 'other-id', 'HTTP 500')
    const result = withEntry(withFailureManifest, entryFor('invoices/x.pdf'))
    expect(result.failures).toEqual([{ id: 'other-id', reason: 'HTTP 500' }])
    expect(result.entries).toHaveLength(1)
  })

  it('does not mutate the original manifest when pruning a failure via withEntry', () => {
    const withFailureManifest = withFailure(emptyManifest(), ref.id, 'HTTP 500')
    withEntry(withFailureManifest, entryFor('invoices/x.pdf'))
    expect(withFailureManifest.failures).toEqual([{ id: ref.id, reason: 'HTTP 500' }])
  })

  it('records failures separately from entries', () => {
    const m = withFailure(emptyManifest(), 'abc123', 'HTTP 500')
    expect(m.failures).toEqual([{ id: 'abc123', reason: 'HTTP 500' }])
    expect(m.entries).toHaveLength(0)
  })

  it('reports a document as already downloaded when file and hash match', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const path = await saveDocument(root, ref, bytes)
    const m = withEntry(emptyManifest(), entryFor(path))
    expect(await isAlreadyDownloaded(m, root, ref)).toBe(true)
  })

  it('reports not-downloaded when the manifest has no entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    await saveDocument(root, ref, bytes)
    expect(await isAlreadyDownloaded(emptyManifest(), root, ref)).toBe(false)
  })

  it('reports not-downloaded when the file is missing despite a manifest entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const m = withEntry(emptyManifest(), entryFor(join(root, 'invoices', 'gone.pdf')))
    expect(await isAlreadyDownloaded(m, root, ref)).toBe(false)
  })

  it('reports not-downloaded when the file contents no longer match the hash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const path = await saveDocument(root, ref, bytes)
    const m = withEntry(emptyManifest(), { ...entryFor(path), sha256: 'deadbeef' })
    expect(await isAlreadyDownloaded(m, root, ref)).toBe(false)
  })
})
