import type { DocumentKind, DocumentRef } from './document.js'

const MAX_LABEL = 80

const DIRECTORIES: Readonly<Record<DocumentKind, string>> = {
  invoice: 'invoices',
  'invoice-attachment': 'invoices/attachments',
  paystub: 'paystubs',
}

export function sanitizeLabel(label: string): string {
  const cleaned = label
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
  return cleaned.slice(0, MAX_LABEL)
}

export function relativePathFor(ref: DocumentRef): string {
  const directory = DIRECTORIES[ref.kind]
  const label = sanitizeLabel(ref.label)
  const extension = sanitizeLabel(ref.extension) || 'pdf'
  return `${directory}/${sanitizeLabel(ref.date)}_${label}_${sanitizeLabel(ref.id)}.${extension}`
}
