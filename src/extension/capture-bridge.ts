import { sessionFromHeaders } from '../auth/capture-headers.js'
import { CAPTURE_MESSAGE } from './protocol.js'
import { storeSession } from './session-write.js'

// Runs in the extension's isolated world, where chrome.* is available.
// Accepts only same-window messages carrying our own message type.
//
// Threat model: the `event.source === window` check only excludes messages
// from other frames or windows. It cannot distinguish capture-main.ts from
// any other script already executing in this page's own MAIN world -- no
// nonce or shared secret could either, since MAIN-world code can read
// anything capture-main.ts holds. This is accepted rather than solved: a
// script already running on app.rippling.com could hook fetch and read the
// real bearer token directly, so forging this message grants an attacker
// nothing they do not already have.
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
    storeSession(session).catch(() => {
      // A storage failure (e.g. the access level was never widened) must not
      // throw into the host page. There is no in-page surface to report it
      // to -- the export page is what reports "no session found" -- so this
      // is swallowed the same way an incomplete header set is below.
    })
  } catch {
    // An incomplete header set simply means this was not the request we want.
  }
})
