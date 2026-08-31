export interface RunResult {
  readonly downloaded: number
  readonly skipped: number
  readonly failed: number
}

export function formatReport(result: RunResult, outRoot: string): string {
  const lines = [
    `Downloaded : ${result.downloaded}`,
    `Skipped    : ${result.skipped} (already present)`,
    `Failed     : ${result.failed}`,
    `Output     : ${outRoot}`,
  ]
  return lines.join('\n')
}
