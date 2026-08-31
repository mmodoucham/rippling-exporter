import { beforeAll, describe, expect, it } from 'vitest'

// capture-main.ts patches window.fetch as a module-level side effect, since
// it must be installed the instant the content script is injected into the
// host page. This test file runs under Node, which has no `window`, so a
// minimal stand-in is installed before the module is imported. The stand-in
// is narrowed to the one property (`fetch`) the module reads at import time.
let requestUrl: (request: RequestInfo | URL) => string | null

beforeAll(async () => {
  ;(globalThis as unknown as { window: { fetch: typeof fetch } }).window = {
    fetch: globalThis.fetch,
  }
  const mod = await import('../../src/extension/capture-main.js')
  requestUrl = mod.requestUrl
})

describe('requestUrl', () => {
  it('returns a string request unchanged', () => {
    expect(requestUrl('https://app.rippling.com/api/x')).toBe('https://app.rippling.com/api/x')
  })

  it('returns the href of a URL instance', () => {
    const url = new URL('https://app.rippling.com/api/y?z=1')
    expect(requestUrl(url)).toBe(url.href)
  })

  it('returns the url of a Request instance', () => {
    const request = new Request('https://app.rippling.com/api/z')
    expect(requestUrl(request)).toBe('https://app.rippling.com/api/z')
  })

  it('returns null for an unrecognised value', () => {
    // Not reachable through a well-typed caller: forced past the RequestInfo
    // | URL parameter type to exercise the fallback branch.
    expect(requestUrl(42 as unknown as string)).toBeNull()
  })
})
