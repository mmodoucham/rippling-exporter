declare const chrome: {
  action: { onClicked: { addListener(fn: () => void): void } }
  tabs: { create(options: { url: string }): Promise<unknown> }
  runtime: { getURL(path: string): string; onInstalled: { addListener(fn: () => void): void } }
  storage: {
    session: {
      setAccessLevel(options: { accessLevel: string }): Promise<void>
    }
  }
}

// The worker only opens the export page. The export itself runs in that page,
// because MV3 terminates idle service workers and a long download batch would
// be cut off partway through.
chrome.action.onClicked.addListener((): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('export.html') })
})

// chrome.storage.session defaults to accessLevel TRUSTED_CONTEXTS, which
// excludes content scripts entirely. capture-bridge.ts runs as a content
// script and must be able to write to it, so this must be widened to
// TRUSTED_AND_UNTRUSTED_CONTEXTS. Only a trusted context (this service
// worker) can call setAccessLevel. A service worker can be torn down and
// respawned by the browser at any time, and the setting does not persist
// across an extension install/update on its own, so this is called both at
// worker startup (covers every respawn) and from onInstalled (covers first
// install and updates). A rejection here must not crash the worker -- the
// action-click handler above still has to work even if this fails.
function allowUntrustedSessionAccess(): void {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {
    // Swallow: a worker crash here would break the extension entirely, and
    // there is no user-facing surface to report the failure to from here.
  })
}

allowUntrustedSessionAccess()
chrome.runtime.onInstalled.addListener(allowUntrustedSessionAccess)
