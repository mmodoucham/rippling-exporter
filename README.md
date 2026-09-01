# Rippling Exporter

A Chrome extension that downloads **your own** Rippling contractor invoices, invoice
attachments and pay stubs as a single ZIP.

Rippling lets you view these documents one at a time. If you need them all — for an
accountant, a mortgage application, a tax return, or just a backup you control — the
alternative is clicking through them individually. This does it in one pass.

> **Unofficial.** Not affiliated with, endorsed by, or supported by Rippling. It works by
> calling the same internal API Rippling's own web app calls, using the session you are
> already logged in with. Those endpoints are undocumented and can change without notice,
> which will break this until it is updated.

---

## What you get

A single `rippling-export-<from>-to-<to>.zip`, laid out like this:

```
invoices/
  2026-03-10_INV_03-10-2026_3_<id>.pdf
invoices/attachments/
  2026-03-23_INV_03-23-2026_5_<id>_att1.pdf
paystubs/
  2026-03-13_Mar-1-2026-Mar-15-2026_<id>.pdf
```

Filenames lead with the document date so they sort chronologically, and end with
Rippling's own document id so nothing can collide.

## Requirements

- Google Chrome (or another Chromium browser supporting Manifest V3)
- A Rippling **contractor** account — see [Limitations](#limitations)

## Install

### Option A — download the release (no tooling needed)

1. Download `rippling-exporter-v1.0.0.zip` from the
   [Releases](../../releases) page
2. Unzip it somewhere you'll keep it — Chrome loads the extension from this folder
   every time it starts, so don't unzip it into Downloads and delete it later
3. Open `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked** and select the unzipped folder (the one containing
   `manifest.json`)

> Chrome will not install this by double-clicking the zip. Unsigned extensions can only
> be added through **Load unpacked**. That is a Chrome policy, not a limitation of this
> extension.

### Option B — build from source

```bash
git clone https://github.com/mmodoucham/rippling-exporter.git
cd rippling-exporter
npm install
npm run build
```

Then load the `extension/` directory via **Load unpacked**, as above.

## Use

1. **Open and log in to Rippling** at `app.rippling.com`, and leave that tab open.
   This step is required — see [How it works](#how-it-works).
2. Click the **Rippling Exporter** icon in your toolbar. An export page opens.
3. Pick a start and end date, choose which document types you want, and press
   **Export**.
4. The ZIP lands in your Downloads folder.

### If it says "No Rippling session found"

The extension has not seen your session yet. In order:

1. Make sure a logged-in `app.rippling.com` tab is open
2. **Refresh that tab** — this is the step that matters, and it is easy to skip
3. Reload the export page

The extension reads your credentials from the requests Rippling's own app makes. Until
that app makes a request with the extension running, there is nothing to read. Refreshing
the tab is what triggers it. The export page checks once when it loads, so it needs a
reload afterwards.

## Privacy

This is your payroll data, so it is worth being precise about where it goes.

- **Nothing leaves your machine.** There is no server, no analytics, no telemetry. The
  extension talks to Rippling and to Rippling's CDN, and nowhere else.
- **Your password is never involved.** You log in to Rippling yourself, in the normal
  way. The extension never sees, asks for, or stores it.
- **Your session token is held in memory only.** It lives in `chrome.storage.session`,
  which Chrome clears when the browser closes. It is never written to disk, never logged,
  and never shown on screen.
- **Document URLs are redacted in any error message.** The download links are signed URLs
  whose query string is itself a credential, so it is stripped before any message is
  displayed.

### Permissions, and why each is needed

| Permission | Why |
|---|---|
| `app.rippling.com` | Read your session from the app's own requests, and list your documents |
| `secured-assets.ripplingcdn.com` | Download invoice and pay stub PDFs |
| `prod-images.rippling.com` | Download invoice attachments |
| `downloads` | Save the finished ZIP |
| `storage` | Hold the session in memory-only session storage |

There is no broad host permission. The extension cannot read any site other than the
three listed above.

## How it works

Rippling has no public API, and logging in involves MFA, so this does not try to log in
at all. A content script watches the requests Rippling's own web app makes and captures
the authorization headers it sends. Those headers then drive direct calls to the two JSON
endpoints that list your documents, each of which returns a signed PDF link.

That design is why a logged-in tab must be open, and why refreshing it is what makes the
extension notice you.

Downloads run a few at a time, and a document that fails does not abort the run — you
still get a ZIP of everything that succeeded, with the failures listed on the page.

## Limitations

- **Contractor accounts only.** It reads the contractor invoice and pay stub endpoints.
  If you are a salaried employee, your documents live elsewhere and this will not find
  them.
- **No tax documents.** Rippling's Taxes tab exposed no downloadable documents on the
  account this was built against. If yours does, the endpoint is not implemented.
- **No unattended runs.** It needs your browser and your session. It cannot be scheduled.
- **Each run downloads its full range.** There is no resume state, because a run produces
  one complete archive. At typical volumes this is a few dozen small PDFs.
- **Undocumented endpoints.** Rippling can change them at any time.

## Development

```bash
npm install
npm test          # unit tests: no network, no browser
npm run test:cov  # with coverage
npm run typecheck
npm run build     # bundles into extension/dist
npm run package   # builds and zips a release artifact
```

`src/extension/export-page.ts` and `src/extension/background.ts` are excluded from
coverage — they are DOM and Chrome API wiring, verified by hand rather than by unit
tests. Everything else is covered.

One test is worth knowing about: `tests/build-output.test.ts` builds the real bundles and
checks the content scripts contain no ES module syntax. Content scripts are injected as
classic scripts, so a stray `export` makes Chrome silently refuse to run the entire file —
which produces an extension that installs, looks healthy, and does nothing. No test of
the source can catch that; only a test of the built artifact can.

`docs/recon-notes.md` documents the endpoint shapes, captured from a live account. Start
there if Rippling changes something and this breaks.

## Contributing

Issues and pull requests are welcome. If you are reporting a break, the most useful thing
you can include is what the export page said and anything logged in the service worker
console (`chrome://extensions` → the extension → **service worker**). Please do not paste
tokens, signed URLs or your own documents into an issue.

## License

[MIT](LICENSE)
