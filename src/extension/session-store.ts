import { z } from 'zod'
import type { RipplingSession } from '../api/client.js'

import { SESSION_KEY } from './protocol.js'

const sessionSchema = z.object({
  headers: z.record(z.string()),
  roleId: z.string().min(1),
})

declare const chrome: {
  storage: {
    session: {
      get(keys: string): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(key: string): Promise<void>
    }
  }
}

export async function storeSession(session: RipplingSession): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: session })
}

export async function readSession(): Promise<RipplingSession | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY)
  // The stored value is untyped until the schema below narrows it.
  const parsed = sessionSchema.safeParse(bag[SESSION_KEY] as unknown)
  return parsed.success ? parsed.data : null
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY)
}
