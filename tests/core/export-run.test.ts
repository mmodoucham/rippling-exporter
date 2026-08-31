import { describe, expect, it, vi } from 'vitest'
import type { ExportOptions } from '../../src/core/export-options.js'
import { runExport } from '../../src/core/export-run.js'
import type { InvoiceRecord, PaystubRecord } from '../../src/schema.js'

const PDF = new TextEncoder().encode('%PDF-1.7')

const invoices: readonly InvoiceRecord[] = [
  {
    id: 'inv-in-range',
    invoiceNumber: 'INV_03/10/2026_3',
    invoiceDate: '2026-03-10T00:00:00Z',
    invoice: 'https://x.test/in.pdf',
    attachments: [{ url: 'https://x.test/att.pdf', type: 'pdf' }],
  },
  {
    id: 'inv-old',
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

const lister = {
  listInvoices: async () => invoices,
  listPaystubs: async () => paystubs,
}

const options = (over: Partial<ExportOptions> = {}): ExportOptions => ({
  range: { from: '2026-01-01', to: '2026-08-31' },
  types: ['invoices', 'paystubs'],
  attachments: true,
  concurrency: 2,
  ...over,
})

describe('runExport', () => {
  it('sends every in-range document to the sink', async () => {
    const paths: string[] = []
    const result = await runExport(
      options(),
      lister,
      async () => PDF,
      (path) => paths.push(path),
    )
    expect(result.downloaded).toBe(3)
    expect(result.failed).toBe(0)
    expect(paths).toHaveLength(3)
  })

  it('keys sink entries by the archive-relative path', async () => {
    const paths: string[] = []
    await runExport(options(), lister, async () => PDF, (path) => paths.push(path))
    expect(paths.some((p) => p.startsWith('invoices/'))).toBe(true)
    expect(paths.some((p) => p.startsWith('invoices/attachments/'))).toBe(true)
    expect(paths.some((p) => p.startsWith('paystubs/'))).toBe(true)
  })

  it('excludes documents outside the range', async () => {
    const download = vi.fn().mockResolvedValue(PDF)
    await runExport(options(), lister, download, () => {})
    expect(download.mock.calls.map((c) => c[0])).not.toContain('https://x.test/old.pdf')
  })

  it('excludes attachments when they are disabled', async () => {
    const result = await runExport(
      options({ attachments: false }),
      lister,
      async () => PDF,
      () => {},
    )
    expect(result.downloaded).toBe(2)
  })

  it('only lists the requested types', async () => {
    const spy = {
      listInvoices: vi.fn(async () => invoices),
      listPaystubs: vi.fn(async () => paystubs),
    }
    await runExport(options({ types: ['paystubs'] }), spy, async () => PDF, () => {})
    expect(spy.listInvoices).not.toHaveBeenCalled()
    expect(spy.listPaystubs).toHaveBeenCalled()
  })

  it('records a failure, keeps going, and never sinks the failed document', async () => {
    const paths: string[] = []
    const download = vi.fn(async (url: string) => {
      if (url === 'https://x.test/in.pdf') throw new Error('HTTP 500')
      return PDF
    })
    const result = await runExport(options(), lister, download, (path) => paths.push(path))
    expect(result.failed).toBe(1)
    expect(result.downloaded).toBe(2)
    expect(result.failures[0]?.reason).toContain('HTTP 500')
    expect(paths).toHaveLength(2)
  })

  it('passes the expected extension to the downloader', async () => {
    const download = vi.fn().mockResolvedValue(PDF)
    await runExport(options(), lister, download, () => {})
    for (const call of download.mock.calls) {
      expect(call[1]).toBe('pdf')
    }
  })

  it('reports progress up to the selected total', async () => {
    const seen: Array<[number, number]> = []
    await runExport(options(), lister, async () => PDF, () => {}, (done, total) =>
      seen.push([done, total]),
    )
    expect(seen[seen.length - 1]).toEqual([3, 3])
  })

  it('runs downloads concurrently up to the configured limit', async () => {
    let inFlight = 0
    let peak = 0
    const download = async (): Promise<Uint8Array> => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight -= 1
      return PDF
    }
    await runExport(options({ concurrency: 3 }), lister, download, () => {})
    expect(peak).toBeGreaterThan(1)
  })

  it('stays serial at concurrency 1', async () => {
    let inFlight = 0
    let peak = 0
    const download = async (): Promise<Uint8Array> => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight -= 1
      return PDF
    }
    await runExport(options({ concurrency: 1 }), lister, download, () => {})
    expect(peak).toBe(1)
  })

  it('returns an empty result when nothing is in range', async () => {
    const result = await runExport(
      options({ range: { from: '2020-01-01', to: '2020-12-31' } }),
      lister,
      async () => PDF,
      () => {},
    )
    expect(result).toEqual({ downloaded: 0, failed: 0, failures: [] })
  })
})
