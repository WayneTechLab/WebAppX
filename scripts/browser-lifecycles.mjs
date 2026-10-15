import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-smoke.mjs'
import { runCmsCrmLifecycles } from '../tests/browser/cms-crm-lifecycles.mjs'

export async function main(args = process.argv.slice(2)) {
  return runBrowserSuite({ args, suite: 'lifecycles', runChecks: runCmsCrmLifecycles })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
