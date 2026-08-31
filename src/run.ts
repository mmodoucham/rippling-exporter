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

type Descriptor =
  | { readonly ref: DocumentRef; readonly outcome: 'skipped' }
  | { readonly ref: DocumentRef; readonly outcome: 'downloaded'; readonly bytes: Uint8Array }
  | { readonly ref: DocumentRef; readonly outcome: 'failed'; readonly reason: string }

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

// Concurrent phase: touches only the network and the filesystem (the
// already-downloaded check, the download, and the file write). Never
// touches the manifest, so many of these can run at once with no risk of
// concurrent manifest mutation.
async function fetchOne(
  ref: DocumentRef,
  config: ExportConfig,
  download: Downloader,
  manifest: Manifest,
): Promise<Descriptor> {
  if (await isAlreadyDownloaded(manifest, config.out, ref)) {
    return { ref, outcome: 'skipped' }
  }
  try {
    const bytes = await download(ref.url)
    await saveDocument(config.out, ref, bytes)
    logger.info('saved', { path: relativePathFor(ref), bytes: bytes.length })
    return { ref, outcome: 'downloaded', bytes }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.error('download failed', { id: ref.id, url: redactUrl(ref.url), reason })
    return { ref, outcome: 'failed', reason }
  }
}

// Serial phase: folds one batch's descriptors into the manifest one at a
// time, in the batch's original order. A document's file is always written
// (in the concurrent phase above) before its manifest entry exists here.
function foldDescriptor(manifest: Manifest, descriptor: Descriptor): Manifest {
  if (descriptor.outcome === 'downloaded') {
    return withEntry(manifest, {
      id: descriptor.ref.id,
      kind: descriptor.ref.kind,
      date: descriptor.ref.date,
      path: relativePathFor(descriptor.ref),
      sha256: sha256(descriptor.bytes),
      bytes: descriptor.bytes.length,
      downloadedAt: new Date().toISOString(),
    })
  }
  if (descriptor.outcome === 'failed') {
    return withFailure(manifest, descriptor.ref.id, descriptor.reason)
  }
  return manifest
}

// Each batch runs its downloads concurrently (bounded by config.concurrency)
// and then folds the results into the manifest serially, persisting once
// per batch. This makes --concurrency real while keeping the durability
// property that matters: a document's file is always on disk before its
// manifest entry exists. The window this widens is that a crash mid-batch
// can leave up to `concurrency` files on disk without entries yet — safe,
// since those are simply re-downloaded next run rather than wrongly skipped.
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
    const descriptors = await Promise.all(
      batch.map((ref) => fetchOne(ref, config, download, manifest)),
    )
    for (const descriptor of descriptors) {
      manifest = foldDescriptor(manifest, descriptor)
      tally[descriptor.outcome] += 1
    }
    await saveManifest(config.out, manifest)
  }

  // Covers the zero-document case, where the loop above never runs.
  await saveManifest(config.out, manifest)
  return { downloaded: tally.downloaded, skipped: tally.skipped, failed: tally.failed }
}
