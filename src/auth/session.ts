import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, type BrowserContext } from 'playwright'
import type { RipplingSession } from '../api/client.js'
import { logger } from '../log.js'
import { installCapture, readCaptured, sessionFromHeaders } from './capture-headers.js'

const PROFILE_DIR = join(homedir(), '.rippling-exporter', 'profile')
const INVOICES_URL = 'https://app.rippling.com/contractor/my-invoices/overview'
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const CAPTURE_TIMEOUT_MS = 30 * 1000

export interface OpenSession {
  readonly session: RipplingSession
  readonly close: () => Promise<void>
}

async function waitForHeaders(
  context: BrowserContext,
): Promise<Readonly<Record<string, string>>> {
  const page = context.pages()[0] ?? (await context.newPage())
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS
  for (;;) {
    const captured = await readCaptured(page)
    if (captured['authorization'] !== undefined) return captured
    if (Date.now() > deadline) throw new Error('timed out waiting for session headers')
    await page.waitForTimeout(500)
  }
}

export async function openSession(): Promise<OpenSession> {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false })
  await installCapture(context.pages()[0] ?? (await context.newPage()))
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(INVOICES_URL)

  if (!page.url().includes('/contractor/')) {
    logger.info('sign in to Rippling in the browser window that just opened')
    await page.waitForURL(/\/contractor\//, { timeout: LOGIN_TIMEOUT_MS })
  }
  await page.goto(INVOICES_URL)

  const session = sessionFromHeaders(await waitForHeaders(context))
  logger.info('session captured')
  return { session, close: () => context.close() }
}
