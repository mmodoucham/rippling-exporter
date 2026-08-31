import type { InvoiceRecord, PaystubRecord } from '../schema.js'

export type DocumentKind = 'invoice' | 'invoice-attachment' | 'paystub'

export interface DocumentRef {
  readonly kind: DocumentKind
  readonly id: string
  readonly date: string
  readonly label: string
  readonly url: string
  readonly extension: string
}

function toIsoDay(value: string): string {
  return value.slice(0, 10)
}

export function refsFromInvoice(
  record: InvoiceRecord,
  includeAttachments: boolean,
): readonly DocumentRef[] {
  const date = toIsoDay(record.invoiceDate)
  const primary: readonly DocumentRef[] =
    record.invoice === null
      ? []
      : [
          {
            kind: 'invoice',
            id: record.id,
            date,
            label: record.invoiceNumber,
            url: record.invoice,
            extension: 'pdf',
          },
        ]
  if (!includeAttachments) return primary
  const attachments = record.attachments.map(
    (att, index): DocumentRef => ({
      kind: 'invoice-attachment',
      id: `${record.id}_att${index + 1}`,
      date,
      label: record.invoiceNumber,
      url: att.url,
      extension: att.type.toLowerCase(),
    }),
  )
  return [...primary, ...attachments]
}

export function refFromPaystub(record: PaystubRecord): DocumentRef {
  return {
    kind: 'paystub',
    id: record.id,
    date: record.checkDate,
    label: record.stubName,
    url: record.pdfFileForEE,
    extension: 'pdf',
  }
}
