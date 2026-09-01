// Packages the built extension into a zip for a GitHub release, so people can
// use it without installing Node. Chrome will not install an unsigned zip by
// double-clicking it -- the zip is unpacked and loaded via "Load unpacked".
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const out = `dist-release/rippling-exporter-v${version}.zip`

rmSync('dist-release', { recursive: true, force: true })
mkdirSync('dist-release', { recursive: true })

// -r recurse, -q quiet. Paths are relative to extension/ so the zip unpacks
// to a single directory the user selects in Load unpacked.
execFileSync('zip', ['-r', '-q', `../${out}`, '.'], { cwd: 'extension', stdio: 'inherit' })
process.stdout.write(`${out}\n`)
