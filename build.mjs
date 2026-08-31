import { build } from 'esbuild'

await build({
  entryPoints: [
    'src/extension/background.ts',
    'src/extension/capture-main.ts',
    'src/extension/capture-bridge.ts',
    'src/extension/export-page.ts',
  ],
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  outdir: 'extension/dist',
  logLevel: 'info',
})
