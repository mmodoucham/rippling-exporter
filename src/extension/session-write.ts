import type { RipplingSession } from '../api/client.js'
import { SESSION_KEY } from './protocol.js'

declare const chrome: {
  storage: {
    session: {
      set(items: Record<string, unknown>): Promise<void>
    }
  }
}

// Write-only: deliberately has no Zod import. This module is bundled into
// the content script injected on every app.rippling.com page load, so it
// must stay small. Validation only matters when reading the stored value
// back (see session-store.ts), which happens solely on the export page.
export async function storeSession(session: RipplingSession): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: session })
}
