import { chmod, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, type BrowserContext } from 'playwright'
import type { RipplingSession } from '../api/client.js'
import { logger } from '../log.js'
import { installCapture, readCaptured, sessionFromHeaders } from './capture-headers.js'

const PROFILE_ROOT = join(homedir(), '.rippling-exporter')
const PROFILE_DIR = join(PROFILE_ROOT, 'profile')
const INVOICES_URL = 'https://app.rippling.com/contractor/my-invoices/overview'
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const CAPTURE_TIMEOUT_MS = 30 * 1000
const PROFILE_DIR_MODE = 0o700

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

// mode is masked by the process umask on creation, and is a no-op if the
// directory already exists, so an explicit chmod tightens both a freshly
// created directory and one left behind by an earlier, less careful
// version of this tool. Both the profile directory and its parent (which
// this tool owns) hold live Rippling session cookies and local storage,
// as sensitive as the bearer token itself.
async function ensureProfileDir(): Promise<void> {
  await mkdir(PROFILE_ROOT, { recursive: true, mode: PROFILE_DIR_MODE })
  await chmod(PROFILE_ROOT, PROFILE_DIR_MODE)
  await mkdir(PROFILE_DIR, { recursive: true, mode: PROFILE_DIR_MODE })
  await chmod(PROFILE_DIR, PROFILE_DIR_MODE)
}

export async function openSession(): Promise<OpenSession> {
  await ensureProfileDir()
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await installCapture(page)
    await page.goto(INVOICES_URL)

    if (!page.url().includes('/contractor/')) {
      logger.info('sign in to Rippling in the browser window that just opened')
      await page.waitForURL(/\/contractor\//, { timeout: LOGIN_TIMEOUT_MS })
    }
    await page.goto(INVOICES_URL)

    const session = sessionFromHeaders(await waitForHeaders(context))
    logger.info('session captured')
    return { session, close: () => context.close() }
  } catch (error) {
    await context.close()
    throw error
  }
}
