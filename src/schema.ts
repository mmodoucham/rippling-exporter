import { z } from 'zod'

export const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.string().min(1),
})

export const invoiceRecordSchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  invoice: z.string().url().nullable(),
  attachments: z.array(attachmentSchema).default([]),
})

export const invoicePageSchema = z.object({
  data: z.array(invoiceRecordSchema),
  cursor: z.string().nullable(),
})

export const paystubRecordSchema = z.object({
  id: z.string().min(1),
  stubName: z.string().min(1),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pdfFileForEE: z.string().url(),
})

export const paystubListSchema = z.array(paystubRecordSchema)

export type Attachment = z.infer<typeof attachmentSchema>
export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>
export type InvoicePage = z.infer<typeof invoicePageSchema>
export type PaystubRecord = z.infer<typeof paystubRecordSchema>
