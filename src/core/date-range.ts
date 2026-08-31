import type { DocumentRef } from './document.js'

export function inRange(ref: DocumentRef, from: string, to: string): boolean {
  return ref.date >= from && ref.date <= to
}

export function filterByRange(
  refs: readonly DocumentRef[],
  from: string,
  to: string,
): readonly DocumentRef[] {
  return refs.filter((ref) => inRange(ref, from, to))
}
