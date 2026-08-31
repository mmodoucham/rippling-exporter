import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { DocumentRef } from './core/document.js'
import { absolutePathFor, sha256 } from './download/save.js'

const MANIFEST_FILE = 'manifest.json'

const entrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  date: z.string(),
  path: z.string(),
  sha256: z.string(),
  bytes: z.number(),
  downloadedAt: z.string(),
})

const manifestSchema = z.object({
  version: z.literal(1),
  entries: z.array(entrySchema),
  failures: z.array(z.object({ id: z.string(), reason: z.string() })),
})

export type ManifestEntry = z.infer<typeof entrySchema>
export type Manifest = z.infer<typeof manifestSchema>

export function emptyManifest(): Manifest {
  return { version: 1, entries: [], failures: [] }
}

export async function loadManifest(outRoot: string): Promise<Manifest> {
  try {
    const text = await readFile(join(outRoot, MANIFEST_FILE), 'utf8')
    // JSON.parse is inherently untyped; manifestSchema narrows it on the next line.
    const parsed = manifestSchema.safeParse(JSON.parse(text) as unknown)
    return parsed.success ? parsed.data : emptyManifest()
  } catch {
    return emptyManifest()
  }
}

export async function saveManifest(outRoot: string, manifest: Manifest): Promise<void> {
  await writeFile(join(outRoot, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export function withEntry(manifest: Manifest, entry: ManifestEntry): Manifest {
  return {
    ...manifest,
    entries: [...manifest.entries.filter((e) => e.id !== entry.id), entry],
    failures: manifest.failures.filter((f) => f.id !== entry.id),
  }
}

export function withFailure(manifest: Manifest, id: string, reason: string): Manifest {
  return {
    ...manifest,
    failures: [...manifest.failures.filter((f) => f.id !== id), { id, reason }],
  }
}

export async function isAlreadyDownloaded(
  manifest: Manifest,
  outRoot: string,
  ref: DocumentRef,
): Promise<boolean> {
  const entry = manifest.entries.find((e) => e.id === ref.id)
  if (entry === undefined) return false
  try {
    const bytes = new Uint8Array(await readFile(absolutePathFor(outRoot, ref)))
    return sha256(bytes) === entry.sha256
  } catch {
    return false
  }
}
