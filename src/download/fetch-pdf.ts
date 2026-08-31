import { logger, redactUrl, safeMessage } from '../log.js'

const MAGIC = '%PDF-'
const ATTEMPTS = 3
const BASE_DELAY_MS = 250

export class ExpiredUrlError extends Error {
  constructor(url: string) {
    super(`signed URL expired or forbidden: ${redactUrl(url)}`)
    this.name = 'ExpiredUrlError'
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

function assertPdf(
  bytes: Uint8Array,
  url: string,
  contentLength?: number,
  contentEncoding?: string,
): void {
  if (bytes.length === 0) throw new Error(`empty response body for ${redactUrl(url)}`)
  // Only check content-length if no encoding or identity encoding (not gzip, br, etc.)
  const shouldCheckLength =
    !contentEncoding || contentEncoding.toLowerCase() === 'identity'
  if (shouldCheckLength && contentLength !== undefined && contentLength !== bytes.length) {
    throw new Error(`content-length mismatch for ${redactUrl(url)}`)
  }
  const head = new TextDecoder().decode(bytes.slice(0, MAGIC.length))
  if (head !== MAGIC) {
    throw new Error(`response is not a PDF (magic bytes were "${head}") for ${redactUrl(url)}`)
  }
}

export async function fetchDocument(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  let lastError: Error = new Error(`no attempt completed for ${redactUrl(url)}`)
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url)
      if (response.status === 403) throw new ExpiredUrlError(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${redactUrl(url)}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const contentLength = response.headers.get('content-length')
      const contentEncoding = response.headers.get('content-encoding')
      assertPdf(
        bytes,
        url,
        contentLength ? parseInt(contentLength, 10) : undefined,
        contentEncoding ?? undefined,
      )
      return bytes
    } catch (error) {
      if (error instanceof ExpiredUrlError) throw error
      const message = safeMessage(error, url)
      lastError = new Error(message)
      if (attempt < ATTEMPTS) {
        logger.warn('download attempt failed, retrying', {
          url: redactUrl(url),
          attempt,
          error: message,
        })
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
  }
  throw lastError
}
