import { describe, expect, it, afterEach, vi } from 'vitest'
import { redactUrl, logger, safeMessage } from '../src/log.js'

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

describe('safeMessage', () => {
  it('swaps the literal URL in an Error message for its redacted form', () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const message = safeMessage(new Error(`fetch failed for ${url}`), url)
    expect(message).toContain('https://x.test/a.pdf')
    expect(message).not.toContain('SECRET')
  })

  it('scrubs a percent-encoded signature value that survives the literal-URL swap', () => {
    // The percent-encoded parameter here is not part of the `url` argument,
    // so the literal-URL swap does not remove it first — this isolates the
    // regex scrub's %3D-separator branch.
    const message = safeMessage(
      new Error('upstream said Signature%3DSECRET while fetching https://x.test/a.pdf'),
      'https://x.test/a.pdf',
    )
    expect(message).not.toContain('SECRET')
  })

  it('scrubs a bare Signature parameter with no origin in the message', () => {
    const message = safeMessage(
      new Error('error: Signature=SECRET&Key-Pair-Id=K1'),
      'https://x.test/a.pdf',
    )
    expect(message).not.toContain('SECRET')
  })

  it('scrubs signature parameters regardless of their order', () => {
    const url = 'https://x.test/a.pdf?Key-Pair-Id=K1&Signature=SECRET&Expires=1'
    const message = safeMessage(new Error(`failed for ${url}`), url)
    expect(message).not.toContain('SECRET')
  })

  it('handles a non-Error thrown value', () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const message = safeMessage(`fetch failed for ${url}`, url)
    expect(message).not.toContain('SECRET')
  })

  it('keeps the redacted host and path so the message stays diagnosable', () => {
    const url = 'https://x.test/a.pdf?Expires=1&Signature=SECRET&Key-Pair-Id=K1'
    const message = safeMessage(new Error(`fetch failed for ${url}`), url)
    expect(message).toMatch(/https:\/\/x\.test\/a\.pdf/)
  })
})

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logger.info writes valid JSON to stderr with correct level and msg', () => {
    const spy = vi.spyOn(process.stderr, 'write')
    logger.info('test message')

    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0]?.[0]
    expect(typeof output).toBe('string')
    const parsed = JSON.parse(output as string)
    expect(parsed).toEqual({
      level: 'info',
      msg: 'test message',
    })
  })

  it('logger.warn writes valid JSON to stderr with correct level and msg', () => {
    const spy = vi.spyOn(process.stderr, 'write')
    logger.warn('warning message')

    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0]?.[0]
    const parsed = JSON.parse(output as string)
    expect(parsed.level).toBe('warn')
    expect(parsed.msg).toBe('warning message')
  })

  it('logger.error writes valid JSON to stderr with correct level and msg', () => {
    const spy = vi.spyOn(process.stderr, 'write')
    logger.error('error message')

    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0]?.[0]
    const parsed = JSON.parse(output as string)
    expect(parsed.level).toBe('error')
    expect(parsed.msg).toBe('error message')
  })

  it('logger methods include optional fields in output', () => {
    const spy = vi.spyOn(process.stderr, 'write')
    logger.info('test', { userId: 123, action: 'login' })

    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0]?.[0]
    const parsed = JSON.parse(output as string)
    expect(parsed).toEqual({
      level: 'info',
      msg: 'test',
      userId: 123,
      action: 'login',
    })
  })

  it('logger writes to stderr not stdout', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write')
    const stdoutSpy = vi.spyOn(process.stdout, 'write')

    logger.info('test')

    expect(stderrSpy).toHaveBeenCalledOnce()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })
})
