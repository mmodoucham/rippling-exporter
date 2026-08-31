import { z } from 'zod'

export const DOCUMENT_TYPES = ['invoices', 'paystubs'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be in YYYY-MM-DD format')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'not a real calendar date')

const rawSchema = z.object({
  from: isoDate,
  to: isoDate,
  out: z.string().min(1),
  types: z.string().optional(),
  attachments: z.boolean().optional(),
  concurrency: z.union([z.string(), z.number()]).optional(),
})

export interface ExportConfig {
  readonly from: string
  readonly to: string
  readonly types: readonly DocumentType[]
  readonly out: string
  readonly attachments: boolean
  readonly concurrency: number
}

function parseTypes(value: string | undefined): readonly DocumentType[] {
  if (value === undefined) return DOCUMENT_TYPES
  const parts = value.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
  if (parts.length === 0) throw new Error('--types must name at least one document type')
  const invalid = parts.filter((p): p is string => !DOCUMENT_TYPES.includes(p as DocumentType))
  if (invalid.length > 0) {
    throw new Error(
      `unknown document type(s): ${invalid.join(', ')}. Valid types: ${DOCUMENT_TYPES.join(', ')}`,
    )
  }
  return parts as readonly DocumentType[]
}

function parseConcurrency(value: string | number | undefined): number {
  if (value === undefined) return 4
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isInteger(n) || n < 1 || n > 16) {
    throw new Error('--concurrency must be an integer between 1 and 16')
  }
  return n
}

export function parseConfig(
  raw: Readonly<Record<string, string | boolean | undefined>>,
): ExportConfig {
  const parsed = rawSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join('; '))
  }
  const { from, to, out, types, attachments, concurrency } = parsed.data
  if (from > to) throw new Error(`--from (${from}) must not be later than --to (${to})`)
  return {
    from,
    to,
    out,
    types: parseTypes(types),
    attachments: attachments ?? true,
    concurrency: parseConcurrency(concurrency),
  }
}
