type Fields = Readonly<Record<string, string | number>>

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return '<unparseable-url>'
  }
}

// An upstream error message can embed the full request URL (including any
// signed query string), possibly re-encoded, reordered, or without the
// origin at all (e.g. a proxy or CDN error body). Swap the literal URL for
// its redacted form, then scrub any Expires/Signature/Key-Pair-Id parameter
// value wherever it appears in the message so nothing sensitive leaks into
// logs or rejections.
export function safeMessage(error: unknown, url: string): string {
  const raw = error instanceof Error ? error.message : String(error)
  let msg = raw.split(url).join(redactUrl(url))
  msg = msg.replace(/(?:Expires|Signature|Key-Pair-Id)(?:%3D|=)[^&\s"'`]*/gi, (match) => {
    const eqIdx = match.indexOf('=') > -1 ? match.indexOf('=') : match.indexOf('%3D') + 2
    return match.substring(0, eqIdx + 1) + 'REDACTED'
  })
  return msg
}

function emit(level: 'info' | 'warn' | 'error', msg: string, fields?: Fields): void {
  const line = JSON.stringify({ level, msg, ...(fields ?? {}) })
  process.stderr.write(`${line}\n`)
}

export const logger = {
  info: (msg: string, fields?: Fields): void => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields): void => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields): void => emit('error', msg, fields),
}
