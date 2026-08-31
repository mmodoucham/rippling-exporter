#!/usr/bin/env node
import { Command } from 'commander'
import { listInvoices } from './api/invoices.js'
import { listPaystubs } from './api/paystubs.js'
import { openSession } from './auth/session.js'
import { parseConfig } from './config.js'
import { fetchDocument } from './download/fetch-pdf.js'
import { logger } from './log.js'
import { formatReport } from './report.js'
import { runExport } from './run.js'

const program = new Command()
  .name('rippling-exporter')
  .description('Download Rippling contractor invoices and pay stubs as PDFs')
  .requiredOption('--from <date>', 'start of the range, inclusive (YYYY-MM-DD)')
  .requiredOption('--to <date>', 'end of the range, inclusive (YYYY-MM-DD)')
  .option('--types <list>', 'comma-separated: invoices,paystubs', undefined)
  .option('--out <dir>', 'output directory', './exports')
  .option('--no-attachments', 'skip invoice attachments')
  .option('--concurrency <n>', 'parallel downloads, 1-16', '4')

async function main(): Promise<number> {
  const config = parseConfig(program.parse().opts())
  let close: (() => Promise<void>) | undefined
  try {
    const { session, close: closeSession } = await openSession()
    close = closeSession
    const result = await runExport(
      config,
      {
        listInvoices: () => listInvoices(session),
        listPaystubs: () => listPaystubs(session),
      },
      (url) => fetchDocument(url),
    )
    process.stdout.write(`${formatReport(result, config.out)}\n`)
    return result.failed > 0 ? 1 : 0
  } finally {
    if (close) await close()
  }
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
