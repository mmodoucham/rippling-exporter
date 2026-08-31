import { sessionFromHeaders } from '../auth/capture-headers.js'
import { CAPTURE_MESSAGE } from './protocol.js'
import { storeSession } from './session-store.js'

// Runs in the extension's isolated world, where chrome.* is available.
// Accepts only same-window messages carrying our own message type.
window.addEventListener('message', (event: MessageEvent): void => {
  if (event.source !== window) return
  const data: unknown = event.data
  if (typeof data !== 'object' || data === null) return
  const payload = data as { type?: unknown; headers?: unknown }
  if (payload.type !== CAPTURE_MESSAGE) return
  if (typeof payload.headers !== 'object' || payload.headers === null) return

  try {
    // sessionFromHeaders validates that every required header is present and
    // non-empty, and throws otherwise.
    const session = sessionFromHeaders(payload.headers as Record<string, string>)
    void storeSession(session)
  } catch {
    // An incomplete header set simply means this was not the request we want.
  }
})
