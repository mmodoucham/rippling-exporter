declare const chrome: {
  action: { onClicked: { addListener(fn: () => void): void } }
  tabs: { create(options: { url: string }): Promise<unknown> }
  runtime: { getURL(path: string): string }
}

// The worker only opens the export page. The export itself runs in that page,
// because MV3 terminates idle service workers and a long download batch would
// be cut off partway through.
chrome.action.onClicked.addListener((): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('export.html') })
})
