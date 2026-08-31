import { listInvoices } from '../api/invoices.js'
import { listPaystubs } from '../api/paystubs.js'
import { buildZip, type ZipEntry } from '../core/zip.js'
import { runExport } from '../core/export-run.js'
import { parseDateRange, type DocumentType, type ExportOptions } from '../core/export-options.js'
import { fetchDocument } from '../download/fetch-pdf.js'
import { setLogSink } from '../log.js'
import type { RipplingSession } from '../api/client.js'
import { readSession } from './session-store.js'

declare const chrome: {
  downloads: { download(options: { url: string; filename: string }): Promise<number> }
}

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`missing element: ${id}`)
  return el
}

const input = (id: string): HTMLInputElement => {
  const el = $(id)
  if (!(el instanceof HTMLInputElement)) throw new Error(`not an input: ${id}`)
  return el
}

const startButton = (): HTMLButtonElement => {
  const el = $('start')
  if (!(el instanceof HTMLButtonElement)) throw new Error('start is not a button')
  return el
}

function setStatus(text: string): void {
  $('status').textContent = text
}

async function main(): Promise<void> {
  setLogSink((line) => {
    if (line.level === 'error') setStatus(line.msg)
  })

  const session = await readSession()
  if (session === null) {
    $('session-state').textContent =
      'No Rippling session found. Open or refresh a logged-in app.rippling.com tab, then reload this page.'
    return
  }
  $('session-state').textContent = 'Rippling session found.'
  startButton().disabled = false

  $('start').addEventListener('click', () => {
    void run(session)
  })
}

async function run(session: RipplingSession): Promise<void> {
  startButton().disabled = true
  $('failures').textContent = ''

  try {
    const range = parseDateRange(input('from').value, input('to').value)
    const types: DocumentType[] = []
    if (input('invoices').checked) types.push('invoices')
    if (input('paystubs').checked) types.push('paystubs')
    if (types.length === 0) {
      setStatus('Select at least one document type.')
      return
    }

    const options: ExportOptions = {
      range,
      types,
      attachments: input('attachments').checked,
      concurrency: 4,
    }

    const entries: ZipEntry[] = []
    setStatus('Listing documents…')

    const result = await runExport(
      options,
      {
        listInvoices: () => listInvoices(session),
        listPaystubs: () => listPaystubs(session),
      },
      (url, extension) => fetchDocument(url, fetch, extension),
      (path, bytes) => entries.push({ path, bytes }),
      (done, total) => setStatus(`Downloaded ${done} of ${total}…`),
    )

    if (entries.length === 0) {
      setStatus('Nothing to download in that date range.')
      renderFailures(result.failures)
      return
    }

    const archive = buildZip(entries)
    const blob = new Blob([new Uint8Array(archive)], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    await chrome.downloads.download({
      url,
      filename: `rippling-export-${range.from}-to-${range.to}.zip`,
    })
    URL.revokeObjectURL(url)

    setStatus(`Saved ${result.downloaded} document(s). ${result.failed} failed.`)
    renderFailures(result.failures)
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error))
  } finally {
    startButton().disabled = false
  }
}

function renderFailures(failures: readonly { label: string; reason: string }[]): void {
  if (failures.length === 0) return
  const list = document.createElement('ul')
  for (const failure of failures) {
    const item = document.createElement('li')
    item.textContent = `${failure.label}: ${failure.reason}`
    list.appendChild(item)
  }
  $('failures').appendChild(list)
}

void main()
