import { REQUIRED_HEADERS } from '../auth/capture-headers.js'
import { CAPTURE_MESSAGE } from './protocol.js'

// Runs in the page's own JavaScript context so it sees the fetch calls
// Rippling's app makes. It has no access to chrome.* APIs, so it posts what
// it captures to the isolated-world bridge instead.
const original = window.fetch

// The SPA issues dozens of /api/ calls per navigation, all carrying the same
// bearer token. Posting on every one would broadcast the token to any
// passive in-page listener (analytics, breadcrumb-collecting error
// reporters) dozens of times over. Track the last authorization value
// actually posted and skip re-posting an unchanged one.
let lastSent: string | undefined

export function requestUrl(request: RequestInfo | URL): string | null {
  if (typeof request === 'string') return request
  if (request instanceof URL) return request.href
  if (request instanceof Request) return request.url
  return null
}

window.fetch = async function patched(
  this: typeof globalThis,
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  try {
    const request = args[0]
    const url = requestUrl(request)
    if (url !== null && url.includes('/api/')) {
      const collected: Record<string, string> = {}
      if (request instanceof Request) {
        request.headers.forEach((value, key) => {
          collected[key] = value
        })
      }
      const init = args[1]
      if (init?.headers !== undefined) {
        new Headers(init.headers).forEach((value, key) => {
          collected[key] = value
        })
      }
      const narrowed: Record<string, string> = {}
      for (const name of REQUIRED_HEADERS) {
        const value = collected[name]
        if (value !== undefined) narrowed[name] = value
      }
      const authorization = narrowed['authorization']
      if (authorization !== undefined && authorization !== lastSent) {
        lastSent = authorization
        window.postMessage({ type: CAPTURE_MESSAGE, headers: narrowed }, window.origin)
      }
    }
  } catch {
    // Capture must never break the host page.
  }
  // The genuine fetch must always run. Native fetch requires its receiver to
  // be window (or another Window/WorkerGlobalScope) rather than whatever
  // `this` the caller happened to use, so bind explicitly rather than
  // forwarding the caller's `this`.
  return original.apply(window, args)
}
