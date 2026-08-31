import { describe, expect, it } from 'vitest'
import { refFromPaystub, refsFromInvoice } from '../../src/core/document.js'
import type { InvoiceRecord, PaystubRecord } from '../../src/schema.js'

const invoice: InvoiceRecord = {
  id: '68c1a2b3d4e5f60718293a4b',
  invoiceNumber: 'INV_03/10/2026_3',
  invoiceDate: '2026-03-10T00:00:00Z',
  invoice: 'https://secured-assets.ripplingcdn.com/us1/a/x-sensitive.pdf?Signature=s',
  attachments: [{ url: 'https://prod-images.rippling.com/abc.pdf?Signature=s', type: 'pdf' }],
}

const paystub: PaystubRecord = {
  id: '68c1a2b3d4e5f60718293a4c',
  stubName: 'Mar 1, 2026 – Mar 15, 2026 - Acme Payroll Inc',
  checkDate: '2026-03-13',
  pdfFileForEE: 'https://secured-assets.ripplingcdn.com/us1/b/y-sensitive.pdf?Signature=s',
}

describe('refsFromInvoice', () => {
  it('produces an invoice ref with the date normalised to YYYY-MM-DD', () => {
    const [ref] = refsFromInvoice(invoice, false)
    expect(ref).toMatchObject({
      kind: 'invoice',
      id: invoice.id,
      date: '2026-03-10',
      label: 'INV_03/10/2026_3',
      extension: 'pdf',
    })
  })

  it('omits attachments when they are not requested', () => {
    expect(refsFromInvoice(invoice, false)).toHaveLength(1)
  })

  it('appends an attachment ref with an index-suffixed id', () => {
    const refs = refsFromInvoice(invoice, true)
    expect(refs).toHaveLength(2)
    expect(refs[1]).toMatchObject({
      kind: 'invoice-attachment',
      id: `${invoice.id}_att1`,
      date: '2026-03-10',
      extension: 'pdf',
    })
  })

  it('takes the attachment extension from the type field', () => {
    const withPng: InvoiceRecord = {
      ...invoice,
      attachments: [{ url: 'https://prod-images.rippling.com/abc.png?Signature=s', type: 'png' }],
    }
    expect(refsFromInvoice(withPng, true)[1]?.extension).toBe('png')
  })

  it('returns no refs when the invoice has no PDF', () => {
    expect(refsFromInvoice({ ...invoice, invoice: null, attachments: [] }, true)).toHaveLength(0)
  })
})

describe('refFromPaystub', () => {
  it('maps checkDate to the ref date and stubName to the label', () => {
    expect(refFromPaystub(paystub)).toMatchObject({
      kind: 'paystub',
      id: paystub.id,
      date: '2026-03-13',
      label: paystub.stubName,
      extension: 'pdf',
    })
  })
})
