import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Content scripts are injected as CLASSIC scripts. A top-level `export` or
// `import` in one is a SyntaxError, and Chrome then refuses to run the whole
// file -- silently, from the extension's point of view. That is not something
// any unit test of the source can catch, so this test builds the real bundles
// and checks the emitted artifacts.
const CONTENT_SCRIPTS = ['capture-main.js', 'capture-bridge.js']

// These are declared as modules (background via "type": "module" in the
// manifest, the export page via <script type="module">), so ESM syntax is
// correct for them.
const MODULE_SCRIPTS = ['background.js', 'export-page.js']

const ESM_STATEMENT = /^\s*(?:export|import)[\s{*]/m

let outdir = ''
const read = (name: string): Promise<string> => readFile(join(outdir, name), 'utf8')

describe('built extension bundles', () => {
  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), 'rex-build-'))
    execFileSync('node', ['build.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, BUILD_OUTDIR: outdir },
      stdio: 'pipe',
    })
  }, 60_000)

  it.each(CONTENT_SCRIPTS)('%s contains no top-level ESM statement', async (name) => {
    const source = await read(name)
    expect(source).not.toMatch(ESM_STATEMENT)
  })

  it.each(CONTENT_SCRIPTS)('%s parses as a classic script', (name) => {
    // `node --check` parses the file as a classic script without running it,
    // which is the same acceptance Chrome applies to an injected content
    // script. An ESM statement makes it exit non-zero.
    expect(() =>
      execFileSync('node', ['--check', join(outdir, name)], { stdio: 'pipe' }),
    ).not.toThrow()
  })

  it('capture-main still installs the fetch hook after bundling', async () => {
    const source = await read('capture-main.js')
    expect(source).toContain('window.fetch')
    expect(source).toContain('rippling-exporter/headers')
  })

  it('capture-bridge still listens for the capture message', async () => {
    const source = await read('capture-bridge.js')
    expect(source).toContain('addEventListener')
    expect(source).toContain('rippling-exporter/headers')
  })

  it.each(MODULE_SCRIPTS)('%s is emitted', async (name) => {
    expect((await read(name)).length).toBeGreaterThan(0)
  })
})
