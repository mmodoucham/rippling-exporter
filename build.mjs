import { build } from 'esbuild'

const outdir = process.env.BUILD_OUTDIR ?? 'extension/dist'

const shared = {
  bundle: true,
  target: 'chrome120',
  outdir,
  logLevel: 'info',
}

// Content scripts are injected as CLASSIC scripts. Emitting ESM here produces
// a file whose top-level `export`/`import` is a SyntaxError, and Chrome then
// silently refuses to run the entire script -- so the fetch hook never
// installs and no session is ever captured. IIFE keeps every binding local
// and emits no module syntax, so a module may still export freely for tests.
await build({
  ...shared,
  entryPoints: ['src/extension/capture-main.ts', 'src/extension/capture-bridge.ts'],
  format: 'iife',
})

// The service worker is declared "type": "module" in the manifest, and the
// export page is loaded with <script type="module">. ESM is correct for both.
await build({
  ...shared,
  entryPoints: ['src/extension/background.ts', 'src/extension/export-page.ts'],
  format: 'esm',
})
