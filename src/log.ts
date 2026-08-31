type Fields = Readonly<Record<string, string | number>>

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return '<unparseable-url>'
  }
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
