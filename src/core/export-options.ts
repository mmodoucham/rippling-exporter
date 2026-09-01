export const DOCUMENT_TYPES = ['invoices', 'paystubs'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export interface DateRange {
  readonly from: string
  readonly to: string
}

export interface ExportOptions {
  readonly range: DateRange
  readonly types: readonly DocumentType[]
  readonly attachments: boolean
  readonly concurrency: number
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isRealCalendarDate(value: string): boolean {
  const match = ISO_DAY.exec(value)
  if (match === null) return false
  // Safe to index: ISO_DAY has three mandatory capture groups with no alternation.
  // A non-null match guarantees all three are defined strings.
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  )
}

function assertDay(value: string, label: string): void {
  if (!ISO_DAY.test(value)) {
    throw new Error(`${label} must be a date in YYYY-MM-DD format`)
  }
  if (!isRealCalendarDate(value)) {
    throw new Error(`${label} is not a real calendar date`)
  }
}

export function parseDateRange(from: string, to: string): DateRange {
  assertDay(from, 'Start date')
  assertDay(to, 'End date')
  if (from > to) {
    throw new Error(`Start date (${from}) must not be later than end date (${to})`)
  }
  return { from, to }
}
