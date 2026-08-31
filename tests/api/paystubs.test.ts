import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import type { RipplingSession } from '../../src/api/client.js'
import { listPaystubs } from '../../src/api/paystubs.js'

const session: RipplingSession = {
  headers: { authorization: 'Bearer test' },
  roleId: 'role-123',
}

const body = async (): Promise<string> =>
  readFile(new URL('../fixtures/paystubs.json', import.meta.url), 'utf8')

describe('listPaystubs', () => {
  it('returns every stub the endpoint provides', async () => {
    const impl = vi.fn().mockResolvedValue(new Response(await body(), { status: 200 }))
    expect(await listPaystubs(session, impl)).toHaveLength(2)
  })

  it('passes the roleId as a query parameter', async () => {
    const impl = vi.fn().mockResolvedValue(new Response(await body(), { status: 200 }))
    await listPaystubs(session, impl)
    expect(String(impl.mock.calls[0]?.[0])).toContain('roleId=role-123')
  })

  it('handles an empty array', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    expect(await listPaystubs(session, impl)).toEqual([])
  })
})
