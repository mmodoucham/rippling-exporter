import type { Page } from 'playwright'
import type { RipplingSession } from '../api/client.js'

export const REQUIRED_HEADERS = [
  'authorization',
  'company',
  'role',
  'requestedaccesslevel',
  'device-fingerprint',
  'login-agent',
] as const

export function sessionFromHeaders(
  captured: Readonly<Record<string, string>>,
): RipplingSession {
  const missing = REQUIRED_HEADERS.filter((name) => {
    const value = captured[name]
    return value === undefined || value.trim().length === 0
  })
  if (missing.length > 0) {
    throw new Error(`session capture incomplete, missing header(s): ${missing.join(', ')}`)
  }
  const headers = Object.fromEntries(
    REQUIRED_HEADERS.map((name) => [name, captured[name] as string]),
  )
  return { headers, roleId: headers['role'] as string }
}

const CAPTURE_SCRIPT = `
  window.__rexHeaders = {};
  const original = window.fetch;
  window.fetch = async function (...args) {
    try {
      const request = args[0];
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('/api/')) {
        const collected = {};
        if (request instanceof Request) request.headers.forEach((v, k) => { collected[k] = v; });
        const init = args[1];
        if (init && init.headers) new Headers(init.headers).forEach((v, k) => { collected[k] = v; });
        if (collected.authorization) window.__rexHeaders = collected;
      }
    } catch (e) { /* capture must never break the page */ }
    return original.apply(this, args);
  };
`

export async function installCapture(page: Page): Promise<void> {
  await page.addInitScript(CAPTURE_SCRIPT)
}

export async function readCaptured(page: Page): Promise<Readonly<Record<string, string>>> {
  return page.evaluate(
    // The page returns a plain header bag; sessionFromHeaders validates it.
    () => (window as unknown as { __rexHeaders: Record<string, string> }).__rexHeaders ?? {},
  )
}
