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
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(new TextEncoder().encode('<html>'))),
    )
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/not a PDF/)
  })

  it('rejects an empty response body', async () => {
    const impl = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array())))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/empty/)
  })

  it('does not leak the signed query string in the error message', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(
      fetchDocument('https://x.test/a.pdf?Signature=SECRET', impl),
    ).rejects.not.toThrow(/SECRET/)
  })

  it('sanitizes error messages from fetchImpl that contain the signed URL', async () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const impl = vi
      .fn()
      .mockRejectedValueOnce(new Error(`fetch failed for ${url}`))
      .mockResolvedValueOnce(ok())
    const bytes = await fetchDocument(url, impl)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('does not leak Signature= query parameter from error messages', async () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const impl = vi.fn().mockRejectedValue(new Error(`fetch failed for ${url}`))
    await expect(fetchDocument(url, impl)).rejects.not.toThrow(/Signature=/)
  })

  it('does not leak SECRET from error messages when error is plain string', async () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const impl = vi.fn().mockRejectedValue(`fetch failed for ${url}`)
    await expect(fetchDocument(url, impl)).rejects.not.toThrow(/SECRET/)
  })

  it('keeps the redacted host and path in error messages', async () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const impl = vi.fn().mockRejectedValue(new Error(`fetch failed for ${url}`))
    await expect(fetchDocument(url, impl)).rejects.toThrow(/https:\/\/x\.test\/a\.pdf/)
  })

  it('rejects a response with mismatched content-length', async () => {
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(PDF, { headers: { 'content-length': '999' } })),
    )
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/content-length/)
  })

  it('accepts a response with matching content-length', async () => {
    const impl = vi.fn().mockResolvedValue(
      new Response(PDF, { headers: { 'content-length': String(PDF.length) } }),
    )
    const bytes = await fetchDocument('https://x.test/a.pdf', impl)
    expect(bytes.length).toBe(PDF.length)
  })

  it('accepts a response with no content-length header', async () => {
    const bytes = await fetchDocument('https://x.test/a.pdf', vi.fn().mockResolvedValue(ok()))
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('accepts gzip-encoded response with mismatched content-length', async () => {
    const impl = vi.fn().mockResolvedValue(
      new Response(PDF, {
        headers: { 'content-encoding': 'gzip', 'content-length': '999' },
      }),
    )
    const bytes = await fetchDocument('https://x.test/a.pdf', impl)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('rejects identity-encoded response with mismatched content-length', async () => {
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(PDF, {
          headers: { 'content-encoding': 'identity', 'content-length': '999' },
        }),
      ),
    )
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/content-length/)
  })

  it('does not leak percent-encoded signature value in errors', async () => {
    const encoded = 'https://x.test/a.pdf?Signature%3DSECRET'
    const impl = vi.fn().mockRejectedValue(new Error(`failed for ${encoded}`))
    await expect(fetchDocument(encoded, impl)).rejects.not.toThrow(/SECRET/)
  })

  it('does not leak bare query string signature in errors', async () => {
    const impl = vi.fn().mockRejectedValue(new Error('error: Signature=SECRET&Key-Pair-Id=K1'))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.not.toThrow(/SECRET/)
  })

  it('does not leak signature with reordered query parameters', async () => {
    const url = 'https://x.test/a.pdf?Key-Pair-Id=K1&Signature=SECRET&Expires=1'
    const impl = vi.fn().mockRejectedValue(new Error(`failed for ${url}`))
    await expect(fetchDocument(url, impl)).rejects.not.toThrow(/SECRET/)
  })

  it('keeps diagnosable context when scrubbing signatures', async () => {
    const impl = vi.fn().mockRejectedValue(new Error('download from https://x.test/a.pdf failed, Signature=SECRET'))
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/x\.test/)
  })

  it('downloads a non-PDF body successfully when the expected extension is not pdf', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const impl = vi.fn().mockResolvedValue(new Response(png))
    const bytes = await fetchDocument('https://x.test/a.png', impl, 'png')
    expect(bytes).toEqual(png)
  })

  it('still rejects non-PDF bytes when the expected extension is pdf', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const impl = vi.fn().mockImplementation(() => Promise.resolve(new Response(png)))
    await expect(fetchDocument('https://x.test/a.pdf', impl, 'pdf')).rejects.toThrow(/not a PDF/)
  })

  it('still rejects an empty body regardless of the expected extension', async () => {
    const impl = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array())))
    await expect(fetchDocument('https://x.test/a.png', impl, 'png')).rejects.toThrow(/empty/)
  })

  it('defaults the expected extension to pdf when omitted', async () => {
    const impl = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(new TextEncoder().encode('<html>'))),
    )
    await expect(fetchDocument('https://x.test/a.pdf', impl)).rejects.toThrow(/not a PDF/)
  })
})
