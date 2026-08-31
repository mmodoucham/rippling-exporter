import { mkdir } from 'node:fs/promises'
import type { ExportConfig } from './config.js'
import { refFromPaystub, refsFromInvoice, type DocumentRef } from './core/document.js'
import { filterByRange } from './core/date-range.js'
import { saveDocument, sha256 } from './download/save.js'
import { logger, redactUrl } from './log.js'
import {
  isAlreadyDownloaded,
  loadManifest,
  saveManifest,
  withEntry,
  withFailure,
  type Manifest,
} from './manifest.js'
import { relativePathFor } from './core/filename.js'
import type { RunResult } from './report.js'
import type { InvoiceRecord, PaystubRecord } from './schema.js'

export interface Lister {
  listInvoices(): Promise<readonly InvoiceRecord[]>
  listPaystubs(): Promise<readonly PaystubRecord[]>
}

export type Downloader = (url: string) => Promise<Uint8Array>

async function collectRefs(
  config: ExportConfig,
  lister: Lister,
): Promise<readonly DocumentRef[]> {
  const groups: DocumentRef[][] = []
  if (config.types.includes('invoices')) {
    const invoices = await lister.listInvoices()
    groups.push(invoices.flatMap((rec) => [...refsFromInvoice(rec, config.attachments)]))
  }
  if (config.types.includes('paystubs')) {
    const paystubs = await lister.listPaystubs()
    groups.push(paystubs.map(refFromPaystub))
  }
  return groups.flat()
}

// Writes the file to disk FIRST, then records the manifest entry, then
// persists the manifest immediately. This ordering makes a crash mid-run
// safe: an interruption between the file write and the manifest write
// simply leaves no entry, so the document is re-downloaded next run rather
// than being wrongly skipped. Failures are persisted the same way so a
// failed document is visible after a crash too. Documents are processed
// serially (see runExport), so there is only ever one manifest write in
// flight at a time.
async function processOne(
  ref: DocumentRef,
  config: ExportConfig,
  download: Downloader,
  manifest: Manifest,
): Promise<{ readonly outcome: 'downloaded' | 'skipped' | 'failed'; readonly manifest: Manifest }> {
  if (await isAlreadyDownloaded(manifest, config.out, ref)) {
    return { outcome: 'skipped', manifest }
  }
  try {
    const bytes = await download(ref.url)
    await saveDocument(config.out, ref, bytes)
    logger.info('saved', { path: relativePathFor(ref), bytes: bytes.length })
    const updated = withEntry(manifest, {
      id: ref.id,
      kind: ref.kind,
      date: ref.date,
      path: relativePathFor(ref),
      sha256: sha256(bytes),
      bytes: bytes.length,
      downloadedAt: new Date().toISOString(),
    })
    await saveManifest(config.out, updated)
    return { outcome: 'downloaded', manifest: updated }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.error('download failed', { id: ref.id, url: redactUrl(ref.url), reason })
    const updated = withFailure(manifest, ref.id, reason)
    await saveManifest(config.out, updated)
    return { outcome: 'failed', manifest: updated }
  }
}

export async function runExport(
  config: ExportConfig,
  lister: Lister,
  download: Downloader,
): Promise<RunResult> {
  await mkdir(config.out, { recursive: true })
  const refs = filterByRange(await collectRefs(config, lister), config.from, config.to)
  logger.info('documents selected', { count: refs.length })

  let manifest = await loadManifest(config.out)
  const tally = { downloaded: 0, skipped: 0, failed: 0 }

  for (let i = 0; i < refs.length; i += config.concurrency) {
    const batch = refs.slice(i, i + config.concurrency)
    for (const ref of batch) {
      const step = await processOne(ref, config, download, manifest)
      manifest = step.manifest
      tally[step.outcome] += 1
    }
  }

  await saveManifest(config.out, manifest)
  return { downloaded: tally.downloaded, skipped: tally.skipped, failed: tally.failed }
}
