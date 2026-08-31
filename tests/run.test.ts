import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ExportConfig } from '../src/config.js'
import { loadManifest } from '../src/manifest.js'
import { runExport } from '../src/run.js'
import type { InvoiceRecord, PaystubRecord } from '../src/schema.js'

const PDF = new TextEncoder().encode('%PDF-1.7\nbody')

const invoices: readonly InvoiceRecord[] = [
  {
    id: 'inv-in-range',
    invoiceNumber: 'INV_03/10/2026_3',
    invoiceDate: '2026-03-10T00:00:00Z',
    invoice: 'https://x.test/in.pdf',
    attachments: [{ url: 'https://x.test/att.pdf', type: 'pdf' }],
  },
  {
    id: 'inv-out-of-range',
    invoiceNumber: 'INV_12/01/2025_1',
    invoiceDate: '2025-12-01T00:00:00Z',
    invoice: 'https://x.test/old.pdf',
    attachments: [],
  },
]

const paystubs: readonly PaystubRecord[] = [
  {
    id: 'stub-1',
    stubName: 'Mar 1 - Mar 15',
    checkDate: '2026-03-13',
    pdfFileForEE: 'https://x.test/stub.pdf',
  },
]

const lister = { listInvoices: async () => invoices, listPaystubs: async () => paystubs }

const configFor = (out: string, over: Partial<ExportConfig> = {}): ExportConfig => ({
  from: '2026-01-01',
  to: '2026-08-31',
  types: ['invoices', 'paystubs'],
  out,
  attachments: true,
  concurrency: 2,
  ...over,
})

describe('runExport', () => {
  it('downloads in-range invoices, their attachments, and pay stubs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const result = await runExport(configFor(root), lister, async () => PDF)
    expect(result).toEqual({ downloaded: 3, skipped: 0, failed: 0 })
  })

  it('excludes documents outside the date range', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const download = vi.fn().mockResolvedValue(PDF)
    await runExport(configFor(root), lister, download)
    expect(download.mock.calls.map((c) => c[0])).not.toContain('https://x.test/old.pdf')
  })

  it('skips attachments when attachments are disabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const result = await runExport(
      configFor(root, { attachments: false }),
      lister,
      async () => PDF,
    )
    expect(result.downloaded).toBe(2)
  })

  it('only lists the requested types', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const spy = { listInvoices: vi.fn(async () => invoices), listPaystubs: vi.fn(async () => paystubs) }
    await runExport(configFor(root, { types: ['paystubs'] }), spy, async () => PDF)
    expect(spy.listInvoices).not.toHaveBeenCalled()
    expect(spy.listPaystubs).toHaveBeenCalled()
  })

  it('skips documents already recorded in the manifest on a second run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    await runExport(configFor(root), lister, async () => PDF)
    const second = await runExport(configFor(root), lister, async () => PDF)
    expect(second).toEqual({ downloaded: 0, skipped: 3, failed: 0 })
  })

  it('records a failure and continues with the remaining documents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const download = vi
      .fn()
      .mockImplementation(async (url: string) => {
        if (url === 'https://x.test/in.pdf') throw new Error('HTTP 500')
        return PDF
      })
    const result = await runExport(configFor(root), lister, download)
    expect(result.failed).toBe(1)
    expect(result.downloaded).toBe(2)
    const manifest = await loadManifest(root)
    expect(manifest.failures).toHaveLength(1)
  })

  it('writes a manifest recording every downloaded document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    await runExport(configFor(root), lister, async () => PDF)
    expect((await loadManifest(root)).entries).toHaveLength(3)
  })

  it('persists successful entries to disk even when a later document fails mid-run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    // Only one paystub, one invoice with an attachment: process invoice successfully
    // first, then fail the attachment, to prove the invoice entry survived to disk
    // before the crash-causing failure was even handled.
    const single: readonly InvoiceRecord[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV_03/10/2026_1',
        invoiceDate: '2026-03-10T00:00:00Z',
        invoice: 'https://x.test/ok.pdf',
        attachments: [{ url: 'https://x.test/boom.pdf', type: 'pdf' }],
      },
    ]
    const oneLister = { listInvoices: async () => single, listPaystubs: async () => [] }
    let sawSuccessOnDiskDuringRun = false
    const download = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://x.test/boom.pdf') {
        // Read the manifest as it exists on disk right now, before this failure
        // is recorded, to prove the earlier success was already persisted.
        const onDisk = await loadManifest(root)
        sawSuccessOnDiskDuringRun = onDisk.entries.some((e) => e.id === 'inv-1')
        throw new Error('network error')
      }
      return PDF
    })
    const result = await runExport(configFor(root, { concurrency: 1 }), oneLister, download)
    expect(result.downloaded).toBe(1)
    expect(result.failed).toBe(1)
    expect(sawSuccessOnDiskDuringRun).toBe(true)

    const manifest = await loadManifest(root)
    expect(manifest.entries.some((e) => e.id === 'inv-1')).toBe(true)
  })

  it('skips already-saved documents on a second run after a partial first run failed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rex-'))
    const single: readonly InvoiceRecord[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV_03/10/2026_1',
        invoiceDate: '2026-03-10T00:00:00Z',
        invoice: 'https://x.test/ok.pdf',
        attachments: [{ url: 'https://x.test/boom.pdf', type: 'pdf' }],
      },
    ]
    const oneLister = { listInvoices: async () => single, listPaystubs: async () => [] }
    const failingDownload = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://x.test/boom.pdf') throw new Error('network error')
      return PDF
    })
    const first = await runExport(configFor(root, { concurrency: 1 }), oneLister, failingDownload)
    expect(first).toEqual({ downloaded: 1, skipped: 0, failed: 1 })

    const secondDownload = vi.fn().mockResolvedValue(PDF)
    const second = await runExport(configFor(root, { concurrency: 1 }), oneLister, secondDownload)
    expect(second.skipped).toBe(1)
    expect(secondDownload.mock.calls.map((c) => c[0])).not.toContain('https://x.test/ok.pdf')
  })
})
