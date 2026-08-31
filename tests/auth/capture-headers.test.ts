import { describe, expect, it } from 'vitest'
import { REQUIRED_HEADERS, sessionFromHeaders } from '../../src/auth/capture-headers.js'

const captured = {
  authorization: 'Bearer abc',
  company: 'company-id',
  role: 'role-id',
  requestedaccesslevel: 'EE',
  'device-fingerprint': 'fp',
  'login-agent': 'rippling-web',
  'x-amzn-trace-id': 'should-be-dropped',
}

describe('sessionFromHeaders', () => {
  it('extracts the roleId from the role header', () => {
    expect(sessionFromHeaders(captured).roleId).toBe('role-id')
  })

  it('keeps every required header', () => {
    const { headers } = sessionFromHeaders(captured)
    for (const name of REQUIRED_HEADERS) expect(headers[name]).toBeDefined()
  })

  it('drops per-request tracing headers', () => {
    expect(sessionFromHeaders(captured).headers['x-amzn-trace-id']).toBeUndefined()
  })

  it('throws a named error when the authorization header is missing', () => {
    const { authorization, ...rest } = captured
    expect(() => sessionFromHeaders(rest)).toThrow(/authorization/)
  })

  it('throws when the role header is missing', () => {
    const { role, ...rest } = captured
    expect(() => sessionFromHeaders(rest)).toThrow(/role/)
  })
})
