import { describe, expect, it, afterEach, vi } from 'vitest'
import { redactUrl, logger } from '../src/log.js'

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
