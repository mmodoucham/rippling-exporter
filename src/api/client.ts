import type { z } from 'zod'
import { logger, redactUrl } from '../log.js'

export interface RipplingSession {
  readonly headers: Readonly<Record<string, string>>
  readonly roleId: string
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Rippling session expired. Re-run the command to sign in again.')
    this.name = 'SessionExpiredError'
  }
}

// A schema mismatch is deterministic for a given response body: retrying it
// can never succeed, so (like SessionExpiredError) it is not retried.
class SchemaMismatchError extends Error {}

const ATTEMPTS = 3
const BASE_DELAY_MS = 250

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export async function apiRequest<T>(
  session: RipplingSession,
  url: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  let lastError: Error = new Error(`no attempt completed for ${redactUrl(url)}`)
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...session.headers, ...(init.headers ?? {}) },
      })
      if (response.status === 401 || response.status === 403) throw new SessionExpiredError()
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${redactUrl(url)}`)
      // The API response is untyped JSON; the schema below narrows it immediately.
      const body = (await response.json()) as unknown
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        throw new SchemaMismatchError(
          `response did not match schema for ${redactUrl(url)}: ${parsed.error.issues
            .map((i) => `${i.path.join('.')} ${i.message}`)
            .join('; ')}`,
        )
      }
      return parsed.data
    } catch (error) {
      if (error instanceof SessionExpiredError || error instanceof SchemaMismatchError)
        throw error
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < ATTEMPTS) {
        logger.warn('API request failed, retrying', {
          url: redactUrl(url),
          attempt,
          error: lastError.message,
        })
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
  }
  throw lastError
}
