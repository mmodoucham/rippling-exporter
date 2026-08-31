import { describe, expect, it } from 'vitest'
import { redactUrl } from '../src/log.js'

describe('redactUrl', () => {
  it('strips the query string from a signed asset URL', () => {
    const signed =
      'https://secured-assets.ripplingcdn.com/us1/a/b-sensitive.pdf?Expires=1&Signature=abc&Key-Pair-Id=K1'
    expect(redactUrl(signed)).toBe(
      'https://secured-assets.ripplingcdn.com/us1/a/b-sensitive.pdf',
    )
  })

  it('leaves a URL without a query string unchanged', () => {
    expect(redactUrl('https://app.rippling.com/api/x/')).toBe(
      'https://app.rippling.com/api/x/',
    )
  })

  it('returns a placeholder for an unparseable value', () => {
    expect(redactUrl('not a url')).toBe('<unparseable-url>')
  })
})
