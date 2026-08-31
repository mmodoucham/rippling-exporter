import { logger, redactUrl } from '../log.js'
import { invoicePageSchema, type InvoiceRecord } from '../schema.js'
import { apiRequest, type RipplingSession } from './client.js'

const URL_INVOICES =
  'https://app.rippling.com/api/global_contractors/api/v2/invoice/find_paginated?state__ne=DRAFT'

const PAGE_SIZE = 100
// At PAGE_SIZE 100 this is 10,000 invoices, far beyond any real account.
// Without a cap, a server that never returns a null cursor would make this
// loop hammer Rippling's production API forever.
const MAX_PAGES = 100

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
  while (page <= MAX_PAGES) {
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
    if (result.cursor === null || result.data.length === 0) return collected
    page += 1
  }
  logger.warn('invoice pagination stopped at the page cap; results may be incomplete', {
    url: redactUrl(URL_INVOICES),
    pages: MAX_PAGES,
  })
  return collected
}
