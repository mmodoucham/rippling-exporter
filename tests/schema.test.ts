import { describe, expect, it } from 'vitest'
import {
  invoicePageSchema,
  invoiceRecordSchema,
  paystubRecordSchema,
} from '../src/schema.js'

describe('invoiceRecordSchema', () => {
  it('parses a record and strips extra fields from the live API', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4b',
      invoiceNumber: 'INV_03/10/2026_3',
      invoiceDate: '2026-03-10T00:00:00Z',
      invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
      attachments: [],
      state: 'approved',
      dueDate: '2026-04-10',
      invoiceAmount: 5000.0,
      contractName: 'Development Services',
      clientName: 'Acme Corp',
    }
    const result = invoiceRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        id: input.id,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        invoice: input.invoice,
        attachments: [],
      })
      expect('state' in result.data).toBe(false)
      expect('dueDate' in result.data).toBe(false)
      expect('invoiceAmount' in result.data).toBe(false)
      expect('contractName' in result.data).toBe(false)
      expect('clientName' in result.data).toBe(false)
    }
  })

  it('rejects a record missing a required field', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4b',
      invoiceDate: '2026-03-10T00:00:00Z',
      invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
      attachments: [],
    }
    const result = invoiceRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('accepts invoice: null', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4b',
      invoiceNumber: 'INV_03/10/2026_3',
      invoiceDate: '2026-03-10T00:00:00Z',
      invoice: null,
      attachments: [],
    }
    const result = invoiceRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.invoice).toBeNull()
    }
  })

  it('rejects a non-URL string in invoice', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4b',
      invoiceNumber: 'INV_03/10/2026_3',
      invoiceDate: '2026-03-10T00:00:00Z',
      invoice: 'not-a-url',
      attachments: [],
    }
    const result = invoiceRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('defaults attachments to [] when absent', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4b',
      invoiceNumber: 'INV_03/10/2026_3',
      invoiceDate: '2026-03-10T00:00:00Z',
      invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
    }
    const result = invoiceRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attachments).toEqual([])
    }
  })
})

describe('paystubRecordSchema', () => {
  it('parses a record and strips extra fields from the live API', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4c',
      stubName: 'Mar 1, 2026 – Mar 15, 2026 - Acme Payroll Inc',
      checkDate: '2026-03-13',
      pdfFileForEE: 'https://secured-assets.ripplingcdn.com/us1/b/y-sensitive.pdf?Signature=s',
      entityName: 'Acme Payroll Inc',
      netPay: 2500.0,
      isCorrected: false,
      sourceApplication: 'rippling',
    }
    const result = paystubRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        id: input.id,
        stubName: input.stubName,
        checkDate: input.checkDate,
        pdfFileForEE: input.pdfFileForEE,
      })
      expect('entityName' in result.data).toBe(false)
      expect('netPay' in result.data).toBe(false)
      expect('isCorrected' in result.data).toBe(false)
      expect('sourceApplication' in result.data).toBe(false)
    }
  })

  it('rejects a checkDate that is not YYYY-MM-DD', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4c',
      stubName: 'Mar 1, 2026 – Mar 15, 2026 - Acme Payroll Inc',
      checkDate: '03/13/2026',
      pdfFileForEE: 'https://secured-assets.ripplingcdn.com/us1/b/y-sensitive.pdf?Signature=s',
    }
    const result = paystubRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects a record missing pdfFileForEE', () => {
    const input = {
      id: '68c1a2b3d4e5f60718293a4c',
      stubName: 'Mar 1, 2026 – Mar 15, 2026 - Acme Payroll Inc',
      checkDate: '2026-03-13',
    }
    const result = paystubRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('invoicePageSchema', () => {
  it('parses a page with cursor: null', () => {
    const input = {
      data: [
        {
          id: '68c1a2b3d4e5f60718293a4b',
          invoiceNumber: 'INV_03/10/2026_3',
          invoiceDate: '2026-03-10T00:00:00Z',
          invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
          attachments: [],
        },
      ],
      cursor: null,
    }
    const result = invoicePageSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBeNull()
    }
  })

  it('parses a page with a string cursor', () => {
    const input = {
      data: [
        {
          id: '68c1a2b3d4e5f60718293a4b',
          invoiceNumber: 'INV_03/10/2026_3',
          invoiceDate: '2026-03-10T00:00:00Z',
          invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
          attachments: [],
        },
      ],
      cursor: 'next-page-token-xyz',
    }
    const result = invoicePageSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBe('next-page-token-xyz')
    }
  })

  it('rejects a page whose data entries are malformed', () => {
    const input = {
      data: [
        {
          id: '68c1a2b3d4e5f60718293a4b',
          invoiceNumber: 'INV_03/10/2026_3',
          invoiceDate: '2026-03-10T00:00:00Z',
          invoice: 'not-a-url',
          attachments: [],
        },
      ],
      cursor: null,
    }
    const result = invoicePageSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
