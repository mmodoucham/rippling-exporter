import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, storeSession } from '../../src/extension/session-store.js'
import type { RipplingSession } from '../../src/api/client.js'

const session: RipplingSession = {
  headers: { authorization: 'Bearer test', role: 'role-1' },
  roleId: 'role-1',
}

interface FakeArea {
  get(keys: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

function installFakeChrome(): { store: Record<string, unknown> } {
  const store: Record<string, unknown> = {}
  const area: FakeArea = {
    get: async (key) => (key in store ? { [key]: store[key] } : {}),
    set: async (items) => {
      Object.assign(store, items)
    },
    remove: async (key) => {
      delete store[key]
    },
  }
  // The Chrome extension APIs are supplied by the browser at runtime; this
  // fake stands in for them and is narrowed to the shape the module uses.
  ;(globalThis as unknown as { chrome: { storage: { session: FakeArea } } }).chrome = {
    storage: { session: area },
  }
  return { store }
}

describe('session-store', () => {
  beforeEach(() => {
    installFakeChrome()
  })

  it('returns null when nothing has been captured', async () => {
    expect(await readSession()).toBeNull()
  })

  it('round-trips a stored session', async () => {
    await storeSession(session)
    expect(await readSession()).toEqual(session)
  })

  it('clears a stored session', async () => {
    await storeSession(session)
    await clearSession()
    expect(await readSession()).toBeNull()
  })

  it('returns null rather than throwing when the stored value is malformed', async () => {
    const { store } = installFakeChrome()
    store['rippling-session'] = { nonsense: true }
    expect(await readSession()).toBeNull()
  })

  it('returns null when the stored value is not an object at all', async () => {
    const { store } = installFakeChrome()
    store['rippling-session'] = 'a string'
    expect(await readSession()).toBeNull()
  })
})
