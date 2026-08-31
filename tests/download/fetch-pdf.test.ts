import { describe, expect, it, vi } from 'vitest'
import { ExpiredUrlError, fetchDocument } from '../../src/download/fetch-pdf.js'

const PDF = new TextEncoder().encode('%PDF-1.7\nbody')

const ok = (): Response =>
  new Response(PDF, { status: 200, headers: { 'content-type': 'application/pdf' } })

describe('fetchDocument', () => {
  it('returns the bytes for a valid PDF', async () => {
    const bytes = await fetchDocument('https://x.test/a.pdf', vi.fn().mockResolvedValue(ok()))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('throws ExpiredUrlError on 403 without retrying', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('denied', { status: 403 }))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toBeInstanceOf(ExpiredUrlError)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('retries a 500 and succeeds on a later attempt', async () => {
    const impl = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(ok())
    const bytes = await fetchDocument('https://x.test/a.pdf', impl)
    expect(bytes.length).toBeGreaterThan(0)
    expect(impl).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts on persistent 500s', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/500/)
    expect(impl).toHaveBeenCalledTimes(3)
  })

  it('retries a thrown network error', async () => {
    const impl = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(ok())
    await expect(fetchDocument('https://x.test/a.pdf', impl)).resolves.toBeDefined()
  })

  it('rejects a response that is not a PDF', async () => {
    const impl = vi.fn().mockResolvedValue(new Response(new TextEncoder().encode('<html>')))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/not a PDF/)
  })

  it('rejects an empty response body', async () => {
    const impl = vi.fn().mockResolvedValue(new Response(new Uint8Array()))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/empty/)
  })

  it('does not leak the signed query string in the error message', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(
      fetchDocument('https://x.test/a.pdf?Signature=SECRET', impl),
    ).rejects.not.toThrow(/SECRET/)
  })
})
