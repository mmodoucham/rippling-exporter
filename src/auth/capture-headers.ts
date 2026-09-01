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
