# rippling-exporter

Downloads contractor invoices, their attachments, and pay stubs from a personal
Rippling account as PDFs.

## Install

```bash
npm install
npx playwright install chromium
npm run build
```

## Use

```bash
node dist/cli.js --from 2026-01-01 --to 2026-08-31 --out ./exports
```

The first run opens a browser window. Sign in yourself, including any MFA step.
The session is saved to `~/.rippling-exporter/profile`, so later runs need no
interaction. The tool never asks for, stores, or types your password.

Reruns are safe and resumable: the manifest is written to disk after each
batch of downloads (not just at the end), so if a run is interrupted the next
run picks up where it left off. Documents already recorded in `manifest.json`
with a matching hash are skipped, so at most one in-flight batch of documents
is re-fetched on the next run.

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--from`, `--to` | required | Inclusive ISO date range |
| `--types` | `invoices,paystubs` | Which document types to pull |
| `--out` | `./exports` | Output directory |
| `--no-attachments` | off | Skip invoice attachments |
| `--concurrency` | `4` | Parallel downloads, 1-16 |

Exit code is 1 if any document failed.

## Tax documents

Not supported. The account has no completed tax year and Rippling's Taxes tab
exposes no documents. See `docs/recon-notes.md`.

## Manual smoke test

Automated tests never touch the network. To verify against the live account:

```bash
npm run build
node dist/cli.js --from 2026-01-01 --to 2026-12-31 --out /tmp/rex-smoke
ls -R /tmp/rex-smoke
```

Expect invoice PDFs, an `invoices/attachments/` directory, pay stub PDFs, and a
`manifest.json` with no failures. Run it a second time and confirm every
document reports as skipped.
