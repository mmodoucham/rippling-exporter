import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { SessionExpiredError } from '../../src/api/client.js'
import { listInvoices } from '../../src/api/invoices.js'
import type { RipplingSession } from '../../src/api/client.js'

const session: RipplingSession = {
  headers: { authorization: 'Bearer test', company: 'c', role: 'r' },
  roleId: 'r',
}

const fixture = async (name: string): Promise<string> =>
  readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8')

const jsonResponse = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })

describe('listInvoices', () => {
  it('follows the cursor across pages and concatenates records', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(await fixture('invoices-page1')))
      .mockResolvedValueOnce(jsonResponse(await fixture('invoices-page2')))
    const records = await listInvoices(session, impl)
    expect(records.map((r) => r.invoiceNumber)).toEqual([
      'INV_03/10/2026_3',
      'INV_03/23/2026_5',
      'INV_08/25/2026_33',
    ])
    expect(impl).toHaveBeenCalledTimes(2)
  })

  it('requests a page size of 100, the documented server maximum', async () => {
    const impl = vi.fn().mockResolvedValue(jsonResponse(await fixture('invoices-page2')))
    await listInvoices(session, impl)
    const init = impl.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body)).pageSize).toBe(100)
  })

  it('sends the session auth headers', async () => {
    const impl = vi.fn().mockResolvedValue(jsonResponse(await fixture('invoices-page2')))
    await listInvoices(session, impl)
    const init = impl.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test')
  })

  it('preserves attachments on records that have them', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(await fixture('invoices-page1')))
      .mockResolvedValueOnce(jsonResponse(await fixture('invoices-page2')))
    const records = await listInvoices(session, impl)
    expect(records[1]?.attachments).toHaveLength(1)
  })

  it('handles an empty result set', async () => {
    const impl = vi.fn().mockResolvedValue(jsonResponse('{"data":[],"cursor":null}'))
    expect(await listInvoices(session, impl)).toEqual([])
  })

  it('throws SessionExpiredError on 401', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }))
    await expect(listInvoices(session, impl)).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('throws when the response does not match the schema, without retrying', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse('{"data":[{"id":1}],"cursor":null}'))
    await expect(listInvoices(session, impl)).rejects.toThrow(/schema|invalid/i)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('stops at the page cap rather than looping forever on a server that never returns a null cursor', async () => {
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          JSON.stringify({
            cursor: 'always-more',
            data: [
              {
                id: '68c1a2b3d4e5f60718293a01',
                invoiceNumber: 'INV_1',
                invoiceDate: '2026-01-01T00:00:00Z',
                invoice: null,
                attachments: [],
              },
            ],
          }),
        ),
      ),
    )
    const records = await listInvoices(session, impl)
    expect(impl).toHaveBeenCalledTimes(100)
    expect(records).toHaveLength(100)
  })
})
