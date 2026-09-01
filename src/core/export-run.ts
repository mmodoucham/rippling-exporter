import { filterByRange } from './date-range.js'
import { refFromPaystub, refsFromInvoice, type DocumentRef } from './document.js'
import { relativePathFor } from './filename.js'
import { logger, redactUrl } from '../log.js'
import type { ExportOptions } from './export-options.js'
import type { InvoiceRecord, PaystubRecord } from '../schema.js'

export interface Lister {
  listInvoices(): Promise<readonly InvoiceRecord[]>
  listPaystubs(): Promise<readonly PaystubRecord[]>
}

export type Downloader = (url: string, extension: string) => Promise<Uint8Array>
export type Sink = (path: string, bytes: Uint8Array) => void
export type ProgressFn = (done: number, total: number) => void

export interface RunFailure {
  readonly id: string
  readonly label: string
  readonly reason: string
}

export interface RunResult {
  readonly downloaded: number
  readonly failed: number
  readonly failures: readonly RunFailure[]
}

type Descriptor =
  | { readonly ref: DocumentRef; readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ref: DocumentRef; readonly ok: false; readonly reason: string }

async function collectRefs(
  options: ExportOptions,
  lister: Lister,
): Promise<readonly DocumentRef[]> {
  const groups: DocumentRef[][] = []
  if (options.types.includes('invoices')) {
    const records = await lister.listInvoices()
    groups.push(records.flatMap((r) => [...refsFromInvoice(r, options.attachments)]))
  }
  if (options.types.includes('paystubs')) {
    const records = await lister.listPaystubs()
    groups.push(records.map(refFromPaystub))
  }
  return groups.flat()
}

// listInvoices paginates by page number over a server-side sort; if the
// underlying set shifts between pages, the same record can be returned
// twice, producing two DocumentRefs with an identical relativePathFor. If
// that reaches buildZip it throws and discards every already-paid-for
// download, so de-duplicate here -- before any network cost is paid -- and
// keep the first occurrence of each path. buildZip's throw stays in place
// as a backstop for any other source of collisions.
function dedupeRefs(refs: readonly DocumentRef[]): readonly DocumentRef[] {
  const seen = new Set<string>()
  const kept: DocumentRef[] = []
  let dropped = 0
  for (const ref of refs) {
    const path = relativePathFor(ref)
    if (seen.has(path)) {
      dropped += 1
      continue
    }
    seen.add(path)
    kept.push(ref)
  }
  if (dropped > 0) {
    logger.warn('dropped duplicate documents before download', { count: dropped })
  }
  return kept
}

async function fetchOne(ref: DocumentRef, download: Downloader): Promise<Descriptor> {
  try {
    const bytes = await download(ref.url, ref.extension)
    return { ref, ok: true, bytes }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.error('download failed', { id: ref.id, url: redactUrl(ref.url), reason })
    return { ref, ok: false, reason }
  }
}

export async function runExport(
  options: ExportOptions,
  lister: Lister,
  download: Downloader,
  sink: Sink,
  onProgress?: ProgressFn,
): Promise<RunResult> {
  const refs = dedupeRefs(
    filterByRange(await collectRefs(options, lister), options.range.from, options.range.to),
  )
  logger.info('documents selected', { count: refs.length })

  const failures: RunFailure[] = []
  let downloaded = 0
  let done = 0

  for (let i = 0; i < refs.length; i += options.concurrency) {
    const batch = refs.slice(i, i + options.concurrency)
    const results = await Promise.all(batch.map((ref) => fetchOne(ref, download)))
    for (const result of results) {
      if (result.ok) {
        sink(relativePathFor(result.ref), result.bytes)
        downloaded += 1
      } else {
        failures.push({
          id: result.ref.id,
          label: result.ref.label,
          reason: result.reason,
        })
      }
      done += 1
      onProgress?.(done, refs.length)
    }
  }

  return { downloaded, failed: failures.length, failures }
}
