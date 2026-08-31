import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { apiRequest, SessionExpiredError, type RipplingSession } from '../../src/api/client.js'

const session: RipplingSession = {
  headers: { authorization: 'Bearer test' },
  roleId: 'r',
}

const schema = z.object({ ok: z.boolean() })

const ok = (): Response =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('apiRequest', () => {
  it('succeeds after a 500 on the first attempt, calling fetchImpl twice', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(ok())
    const result = await apiRequest(session, 'https://x.test/a', schema, {}, impl)
    expect(result).toEqual({ ok: true })
    expect(impl).toHaveBeenCalledTimes(2)
  })

  it('rejects after three consecutive 500s, calling fetchImpl exactly three times', async () => {
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    )
    await expect(apiRequest(session, 'https://x.test/a', schema, {}, impl)).rejects.toThrow()
    expect(impl).toHaveBeenCalledTimes(3)
  })

  it('retries a thrown network error and can then succeed', async () => {
    const impl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok())
    const result = await apiRequest(session, 'https://x.test/a', schema, {}, impl)
    expect(result).toEqual({ ok: true })
    expect(impl).toHaveBeenCalledTimes(2)
  })

  it('rejects with SessionExpiredError on 401 after exactly one call', async () => {
    const impl = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 401 }))
    await expect(
      apiRequest(session, 'https://x.test/a', schema, {}, impl),
    ).rejects.toBeInstanceOf(SessionExpiredError)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('rejects with SessionExpiredError on 403 after exactly one call', async () => {
    const impl = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 403 }))
    await expect(
      apiRequest(session, 'https://x.test/a', schema, {}, impl),
    ).rejects.toBeInstanceOf(SessionExpiredError)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('does not leak the request query string when an upstream error embeds the URL', async () => {
    const url = 'https://x.test/a?Signature=super-secret-token'
    const impl = vi.fn().mockImplementation(() =>
      Promise.reject(new Error(`connection failed for ${url}`)),
    )
    let caught: Error | undefined
    try {
      await apiRequest(session, url, schema, {}, impl)
    } catch (error) {
      caught = error as Error
    }
    expect(caught?.message).not.toContain('super-secret-token')
    expect(caught?.message).not.toContain('Signature=')
    expect(impl).toHaveBeenCalledTimes(3)
  })
})
