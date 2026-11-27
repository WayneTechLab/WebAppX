import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-smoke.mjs'
import { runPortalFoundation } from '../tests/browser/portal-foundation.mjs'
import { runFoundationNavigation } from '../tests/browser/foundation-navigation.mjs'

export async function runFoundationSuite(resources) {
  const existing = await runPortalFoundation(resources)
  try {
    const added = await runFoundationNavigation(resources)
    return { ...added, checks: [...existing.checks, ...added.checks], warnings: [...existing.warnings, ...added.warnings], focusObservations: existing.focusObservations + added.focusObservations }
  } catch (error) {
    error.smokeEvidence = { ...error.smokeEvidence, checks: [...existing.checks, ...(error.smokeEvidence?.checks ?? [])], warnings: [...existing.warnings, ...(error.smokeEvidence?.warnings ?? [])] }
    throw error
  }
}

export async function main(args = process.argv.slice(2)) {
  return runBrowserSuite({ args, suite: 'foundation', runChecks: runFoundationSuite })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
