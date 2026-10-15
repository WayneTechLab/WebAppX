import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createTcpServer } from 'node:net'
import { ownedPreviewProcess } from './browser-preview-process.mjs'
import { chromium } from '@playwright/test'
import { loadValidatedSeed } from '../tests/browser/seed-contract.mjs'
import { runPortalSmoke, smokeHmrPath } from '../tests/browser/portals-smoke.mjs'

const repository = fileURLToPath(new URL('../', import.meta.url))

/** Vite 8 treats a configured port of zero as its default 5173. Let the OS
 * allocate a real free loopback port first, then pass that positive port with
 * strictPort. If another process wins the short handoff race, fail safely.
 */
export function allocateSmokePort() {
  return new Promise((resolvePort, reject) => {
    const allocator = createTcpServer()
    allocator.once('error', reject)
    allocator.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = allocator.address()
      if (!address || typeof address === 'string') {
        allocator.close(() => reject(new Error('Could not allocate a free loopback smoke port')))
        return
      }
      allocator.close(error => error ? reject(error) : resolvePort(address.port))
    })
  })
}

export function parseSmokeArguments(args) {
  const options = { headed: false, output: undefined }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--headed') options.headed = true
    else if (args[index] === '--output' && args[index + 1] && !args[index + 1].startsWith('--')) options.output = resolve(args[++index])
    else throw new Error(`Unknown or incomplete browser smoke option: ${args[index]}. Supported options: --headed, --output <artifact-directory>.`)
  }
  return options
}

/** Ignore .env files completely and shadow every inherited client variable.
 * This command owns its process; no real account configuration reaches Vite.
 */
export function isolateSmokeEnvironment(environment) {
  const variables = Object.keys(environment).filter(key => key.startsWith('VITE_'))
  for (const key of [...variables, 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FUNCTIONS_BASE_URL', 'VITE_SENTRY_DSN']) environment[key] = ''
  environment.VITE_FIREBASE_USE_EMULATORS = 'false'
  environment.VITE_SYSTEMX_LOCAL_SESSION = 'false'
}

/** Close only resources created by this invocation, even when creation,
 * browser launch or a check fails. No existing listener or browser is reused.
 */
export async function withOwnedSmokeResources({ startServer, launchBrowser, runChecks, signal }) {
  let server
  let browser
  const cleanup = { browserClosed: false, serverClosed: false }
  let primaryFailure
  let origin
  let previewProcess
  try {
    signal?.throwIfAborted()
    server = await startServer()
    signal?.throwIfAborted()
    await server.listen()
    previewProcess = server.processHandle
    signal?.throwIfAborted()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') throw new Error('Smoke Vite server did not bind its owned loopback listener')
    origin = `http://127.0.0.1:${address.port}`
    browser = await launchBrowser()
    signal?.throwIfAborted()
    return { ...(await runChecks({ browser, origin })), origin, cleanup, ...(previewProcess ? { previewProcess } : {}) }
  } catch (error) {
    primaryFailure = error
    error.smokeCleanup = cleanup
    error.smokeOrigin = origin
    error.smokePreviewProcess = server?.processHandle
    throw error
  } finally {
    const failures = []
    if (browser) {
      try { await browser.close(); cleanup.browserClosed = true } catch (error) { failures.push(error) }
    }
    if (server) {
      try { await server.close(); cleanup.serverClosed = true } catch (error) { failures.push(error) }
    }
    if (signal?.aborted && !primaryFailure) {
      const error = signal.reason instanceof Error ? signal.reason : new Error('Browser verification was interrupted during cleanup')
      error.smokeCleanup = cleanup
      error.smokeOrigin = origin
      error.smokePreviewProcess = server?.processHandle
      if (failures.length) error.smokeCleanupErrors = failures.map(failure => failure.message)
      throw error
    }
    if (failures.length && !primaryFailure) {
      const error = new AggregateError(failures, 'Smoke resource cleanup failed')
      error.smokeCleanup = cleanup
      error.smokeOrigin = origin
      error.smokePreviewProcess = server?.processHandle
      throw error
    }
    if (failures.length && primaryFailure) primaryFailure.smokeCleanupErrors = failures.map(error => error.message)
  }
}

export async function runBrowserSuite({ args = process.argv.slice(2), runChecks = runPortalSmoke, suite = 'smoke' } = {}) {
  const options = parseSmokeArguments(args)
  const parent = options.output ?? tmpdir()
  await mkdir(parent, { recursive: true })
  const artifactDir = await mkdtemp(join(parent, `webappx-browser-${suite}-`))
  const startedAt = new Date().toISOString()
  let report
  let timeout
  let interrupted
  const controller = new AbortController()
  const abort = new Promise((_, reject) => { controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }) })
  // Signals can arrive during fixture/server setup, before the race attaches.
  // Retain the rejection for that race without an unhandled-rejection exit.
  abort.catch(() => {})
  const onInterrupt = signal => {
    interrupted = signal
    controller.abort(new Error(`Browser ${suite} interrupted by ${signal}`))
  }
  const onSigint = () => onInterrupt('SIGINT')
  const onSigterm = () => onInterrupt('SIGTERM')
  process.once('SIGINT', onSigint)
  process.once('SIGTERM', onSigterm)
  console.log(`Browser ${suite} artifacts: ${artifactDir}`)
  timeout = setTimeout(() => controller.abort(new Error(`Browser ${suite} exceeded its 180-second limit`)), 180_000)
  try {
    const seed = await loadValidatedSeed() // Reject fixture drift before opening a listener/browser.
    controller.signal.throwIfAborted()
    isolateSmokeEnvironment(process.env)
    const result = await withOwnedSmokeResources({
      startServer: async () => {
        const port = await allocateSmokePort()
        controller.signal.throwIfAborted()
        return ownedPreviewProcess({ root: repository, cacheDir: join(artifactDir, 'vite-cache'), port, hmrPath: smokeHmrPath })
      },
      launchBrowser: async () => {
        try { return await chromium.launch({ headless: !options.headed, timeout: 30_000 }) }
        catch (error) {
          if (/Executable doesn't exist|playwright install/i.test(error.message)) throw new Error(`Chromium is unavailable. Run npm run browser:install, then retry npm run browser:${suite}. The runner does not download browsers automatically.`, { cause: error })
          throw error
        }
      },
      runChecks: async resources => {
        return Promise.race([runChecks({ ...resources, artifactDir, seed }), abort])
      },
      signal: controller.signal,
    })
    report = { schemaVersion: 1, status: 'passed', seedName: seed.name, startedAt, completedAt: new Date().toISOString(), ...result }
    console.log(`PASS: ${result.checks.length} browser ${suite} checks; own browser and Vite server closed.`)
  } catch (error) {
    report = { schemaVersion: 1, status: 'failed', startedAt, completedAt: new Date().toISOString(), error: error.message, origin: error.smokeOrigin, evidence: error.smokeEvidence, cleanup: error.smokeCleanup, cleanupErrors: error.smokeCleanupErrors, previewProcess: error.smokePreviewProcess, ...(interrupted ? { interrupted } : {}) }
    console.error(`FAIL: ${error.message}`)
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
    await writeFile(join(artifactDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(`Browser ${suite} report: ${join(artifactDir, 'report.json')}`)
  }
  return report
}

export async function main(args = process.argv.slice(2)) { return runBrowserSuite({ args }) }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
