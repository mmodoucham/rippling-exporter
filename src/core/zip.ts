import { zipSync } from 'fflate'

export interface ZipEntry {
  readonly path: string
  readonly bytes: Uint8Array
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  for (const entry of entries) {
    if (files[entry.path] !== undefined) {
      throw new Error(`duplicate path in archive: ${entry.path}`)
    }
    files[entry.path] = entry.bytes
  }
  // PDFs are already compressed, so storing them uncompressed is faster and
  // produces an archive of practically the same size.
  return zipSync(files, { level: 0 })
}
