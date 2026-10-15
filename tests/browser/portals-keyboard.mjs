import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createKeyboardDriver } from './keyboard-driver.mjs'
import { newIsolatedContext } from './portals-smoke.mjs'
import { runKeyboardOnboarding } from './keyboard-onboarding.mjs'
import { runKeyboardRestore } from './keyboard-restore.mjs'

/** Each journey owns a fresh context with the same account/backend/network
 * isolation as the portal smoke suite. The shared runner owns Vite/Chromium. */
export async function runKeyboardPortals({ browser, origin, artifactDir, seed }) {
  const checks = []
  const journeys = []
  for (const [name, run] of [['onboarding', runKeyboardOnboarding], ['restore', runKeyboardRestore]]) {
    const directory = join(artifactDir, name)
    await mkdir(directory, { recursive: true })
    const problems = []
    const warnings = []
    const observations = []
    const { context, page } = await newIsolatedContext(browser, origin, problems, warnings)
    let traceStarted = false
    let primaryFailure
    try {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
      traceStarted = true
      const keyboard = createKeyboardDriver(page, observations)
      const result = await run({ page, context, origin, artifactDir: directory, seed, keyboard })
      assert.deepEqual(problems, [], `${name} must finish without browser, backend or network errors`)
      checks.push(...result.checks)
      journeys.push({ name, status: 'passed', focusObservations: observations.length, warnings: [...new Set(warnings)], ...result })
    } catch (error) {
      primaryFailure = error
      await page.screenshot({ path: join(directory, 'failure.png'), fullPage: true }).catch(() => {})
      error.smokeEvidence = { journey: name, artifactDir: directory, problems, warnings: [...new Set(warnings)], focusObservations: observations.length }
      throw error
    } finally {
      const cleanupFailures = []
      try { await writeFile(join(directory, 'focus-observations.json'), JSON.stringify(observations, null, 2) + '\n') } catch (error) { cleanupFailures.push(error) }
      try { if (traceStarted) await context.tracing.stop({ path: join(directory, 'trace.zip') }) } catch (error) { cleanupFailures.push(error) }
      try { await context.close() } catch (error) { cleanupFailures.push(error) }
      if (cleanupFailures.length && primaryFailure) primaryFailure.smokeEvidence.artifactErrors = cleanupFailures.map(error => error.message)
      else if (cleanupFailures.length) throw new AggregateError(cleanupFailures, `${name} evidence/context cleanup failed`)
    }
  }
  return { checks, journeys }
}
