import { describe, expect, it, afterEach, vi } from 'vitest'
import { redactUrl, logger, safeMessage, setLogSink, type LogLine } from '../src/log.js'

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

describe('log sink', () => {
  afterEach(() => {
    setLogSink(() => {})
  })

  it('delivers level, message and fields to the installed sink', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.info('hello', { count: 3 })
    expect(lines).toEqual([{ level: 'info', msg: 'hello', fields: { count: 3 } }])
  })

  it('defaults fields to an empty object', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.warn('bare')
    expect(lines[0]?.fields).toEqual({})
  })

  it('routes each level correctly', () => {
    const levels: string[] = []
    setLogSink((line) => levels.push(line.level))
    logger.info('a')
    logger.warn('b')
    logger.error('c')
    expect(levels).toEqual(['info', 'warn', 'error'])
  })

  it('swallows a throwing sink so logging can never break a run', () => {
    setLogSink(() => {
      throw new Error('sink exploded')
    })
    expect(() => logger.info('still fine')).not.toThrow()
  })

  it('discards output when no sink is installed', () => {
    setLogSink(() => {})
    expect(() => logger.error('nobody listening')).not.toThrow()
  })
})

describe('logger', () => {
  afterEach(() => {
    setLogSink(() => {})
    vi.restoreAllMocks()
  })

  it('logger.info delivers correct level and msg to sink', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.info('test message')

    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({
      level: 'info',
      msg: 'test message',
      fields: {},
    })
  })

  it('logger.warn delivers correct level and msg to sink', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.warn('warning message')

    expect(lines).toHaveLength(1)
    expect(lines[0]?.level).toBe('warn')
    expect(lines[0]?.msg).toBe('warning message')
  })

  it('logger.error delivers correct level and msg to sink', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.error('error message')

    expect(lines).toHaveLength(1)
    expect(lines[0]?.level).toBe('error')
    expect(lines[0]?.msg).toBe('error message')
  })

  it('logger methods include optional fields in output', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))
    logger.info('test', { userId: 123, action: 'login' })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({
      level: 'info',
      msg: 'test',
      fields: { userId: 123, action: 'login' },
    })
  })

  it('logger delivers each line to the installed sink', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))

    logger.info('first')
    logger.warn('second')
    logger.error('third')

    expect(lines).toHaveLength(3)
    expect(lines[0]?.msg).toBe('first')
    expect(lines[1]?.msg).toBe('second')
    expect(lines[2]?.msg).toBe('third')
  })

  it('logger output reaches installed sink and nothing else', () => {
    const lines: LogLine[] = []
    setLogSink((line) => lines.push(line))

    const stderrSpy = vi.spyOn(process.stderr, 'write')
    const stdoutSpy = vi.spyOn(process.stdout, 'write')
    const consoleLogSpy = vi.spyOn(console, 'log')
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const consoleErrorSpy = vi.spyOn(console, 'error')

    logger.info('info message')
    logger.warn('warn message')
    logger.error('error message')

    expect(lines).toHaveLength(3)
    expect(lines[0]).toEqual({ level: 'info', msg: 'info message', fields: {} })
    expect(lines[1]).toEqual({ level: 'warn', msg: 'warn message', fields: {} })
    expect(lines[2]).toEqual({ level: 'error', msg: 'error message', fields: {} })

    expect(stderrSpy).not.toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
