import { invoicePageSchema, type InvoiceRecord } from '../schema.js'
import { apiRequest, type RipplingSession } from './client.js'

const URL_INVOICES =
  'https://app.rippling.com/api/global_contractors/api/v2/invoice/find_paginated?state__ne=DRAFT'

const PAGE_SIZE = 100

function requestBody(page: number): string {
  return JSON.stringify({
    paginationParams: {
      page,
      perPage: PAGE_SIZE,
      sortingMetadata: {
        columnIndex: 0,
        order: 'DESC',
        columnId: 'invoiceDate',
        column: { id: 'invoiceDate', data: 'invoiceDate', type: 'date', sort: true },
      },
    },
    pageSize: PAGE_SIZE,
    readPreference: 'SECONDARY_PREFERRED',
    access_level_override: 'EE',
  })
}

export async function listInvoices(
  session: RipplingSession,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly InvoiceRecord[]> {
  const collected: InvoiceRecord[] = []
  let page = 1
  for (;;) {
    const result = await apiRequest(
      session,
      URL_INVOICES,
      invoicePageSchema,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody(page),
      },
      fetchImpl,
    )
    collected.push(...result.data)
    if (result.cursor === null || result.data.length === 0) break
    page += 1
  }
  return collected
}
