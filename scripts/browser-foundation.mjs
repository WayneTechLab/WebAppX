import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-smoke.mjs'
import { runPortalFoundation } from '../tests/browser/portal-foundation.mjs'

export async function main(args = process.argv.slice(2)) {
  return runBrowserSuite({ args, suite: 'foundation', runChecks: runPortalFoundation })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
