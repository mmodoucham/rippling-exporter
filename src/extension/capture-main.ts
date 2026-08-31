import { CAPTURE_MESSAGE } from './protocol.js'

// Runs in the page's own JavaScript context so it sees the fetch calls
// Rippling's app makes. It has no access to chrome.* APIs, so it posts what
// it captures to the isolated-world bridge instead.
const original = window.fetch

window.fetch = async function patched(
  this: typeof globalThis,
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  try {
    const request = args[0]
    const url = typeof request === 'string' ? request : (request as Request).url
    if (url.includes('/api/')) {
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
      if (collected['authorization'] !== undefined) {
        window.postMessage({ type: CAPTURE_MESSAGE, headers: collected }, window.origin)
      }
    }
  } catch {
    // Capture must never break the host page.
  }
  return original.apply(this, args)
}
