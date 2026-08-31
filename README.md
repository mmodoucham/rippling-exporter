# rippling-exporter

A Chrome extension that downloads your Rippling contractor invoices, invoice
attachments and pay stubs as a single ZIP.

## Install

```bash
npm install
npm run build
```

Then in Chrome: open `chrome://extensions`, turn on Developer mode, choose
"Load unpacked", and select the `extension/` directory.

## Use

1. Open and log in to `app.rippling.com` in a tab. The extension reads the
   session from the app's own requests, so this tab must exist.
2. Click the Rippling Exporter toolbar button. It opens an export page.
3. Pick a start and end date, choose which document types you want, and press
   Export.
4. The archive is saved to your Downloads folder as
   `rippling-export-<from>-to-<to>.zip`, laid out as `invoices/`,
   `invoices/attachments/` and `paystubs/`.

Each run downloads its whole date range — there is no resume state, because a
run produces one complete archive. A run with failures still saves a ZIP of
everything that succeeded and lists what failed.

## Privacy

Your Rippling bearer token is held in `chrome.storage.session`, which is
memory-only and cleared when Chrome closes. It is never written to disk and
never logged. The extension requests access to exactly three hosts:
`app.rippling.com` and the two CDN hosts that serve the PDFs.

The extension never asks for, stores, or types your password — you log in to
Rippling yourself, as normal.

## Tax documents

Not supported. Rippling's Taxes tab exposes no documents for this account type;
see `docs/recon-notes.md`.

## Development

```bash
npm test        # unit tests, no network, no browser
npm run test:cov
npm run typecheck
```

`src/extension/` is excluded from coverage: it is DOM and Chrome-API wiring,
verified by the manual check below rather than by unit tests.

## Manual smoke test

With a logged-in Rippling tab open, run an export over a range you know has
documents. Confirm the ZIP contains one PDF per invoice, the attachments
subfolder is populated, pay stubs are present, and the failure list is empty.
Then run it again with no Rippling tab open and confirm the page says the
session is missing rather than failing silently.
