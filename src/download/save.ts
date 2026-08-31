import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DocumentRef } from '../core/document.js'
import { relativePathFor } from '../core/filename.js'

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function absolutePathFor(outRoot: string, ref: DocumentRef): string {
  return join(outRoot, ...relativePathFor(ref).split('/'))
}

export async function saveDocument(
  outRoot: string,
  ref: DocumentRef,
  bytes: Uint8Array,
): Promise<string> {
  const path = absolutePathFor(outRoot, ref)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return path
}
