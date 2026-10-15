#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanStalePidFiles, clearSession, readSession, removePidFile, writePidFile, writeSession } from './Builder/runtime/port-utils.mjs'
import { captureSessionProcessIdentity } from './session-restart-preview.mjs'
import { createReadinessTracker, formatSessionSummary, parseSessionOptions, readinessComponents, resolveSessionPorts, sessionUrls } from './session-supervisor.mjs'

const scriptFile = fileURLToPath(import.meta.url)
const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repository = resolve(lanRoot, '..', '..')

export function firebaseCommand({ platform = process.platform, environment = process.env, executable = process.execPath } = {}) {
  if (platform !== 'win32') return { executable: 'npx', args: ['--no-install', 'firebase-tools'] }
  // Windows cannot execute npx.cmd with shell:false. npm run supplies this
  // JavaScript entry point, which Node can run with an ordinary argument array.
  if (!environment.npm_execpath || !/\.[cm]?js$/i.test(environment.npm_execpath)) throw new Error('Start the Windows session with npm run dev:systemx so Node can invoke npm without a command shell.')
  return { executable, args: [environment.npm_execpath, 'exec', '--no', '--', 'firebase-tools'] }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

/** Dependencies let tests exercise supervision without running Firebase or Vite. */
export async function startDevSession(options, {
  repoRoot = repository,
  environment = process.env,
  spawnChild = spawn,
  available,
  alive = processAlive,
  captureIdentity = captureSessionProcessIdentity,
  output = process.stdout,
  errors = process.stderr,
  now = Date.now,
  probe,
  readinessTimeoutMs = 60_000,
  readinessIntervalMs = 500,
  command = firebaseCommand({ environment }),
} = {}) {
  const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) throw new Error('Missing local Vite dependency. Run npm ci first.')
  const existing = readSession(repoRoot)
  if (existing && [existing.ownerPid, ...Object.values(existing.processes ?? {})].some(alive)) throw new Error('An existing local session still has live recorded processes. Inspect npm run systemx:session:status and use its owned stop controls before starting another session.')

  // Plan every listener before spawning children or writing runtime state.
  const ports = await resolveSessionPorts(options, { available })
  const sessionId = `systemx-${now()}-${process.pid}`
  const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
  const firebaseConfigFile = join(stateRoot, `firebase-${sessionId}.json`)
  const firebaseConfig = JSON.parse(readFileSync(join(repoRoot, 'firebase.json'), 'utf8'))
  firebaseConfig.firestore = {
    ...firebaseConfig.firestore,
    rules: resolve(repoRoot, firebaseConfig.firestore?.rules ?? 'firestore.rules'),
    indexes: resolve(repoRoot, firebaseConfig.firestore?.indexes ?? 'firestore.indexes.json'),
  }
  firebaseConfig.storage = { ...firebaseConfig.storage, rules: resolve(repoRoot, firebaseConfig.storage?.rules ?? 'storage.rules') }
  firebaseConfig.emulators = {
    auth: { host: '127.0.0.1', port: ports.firebase.auth },
    firestore: { host: '127.0.0.1', port: ports.firebase.firestore },
    storage: { host: '127.0.0.1', port: ports.firebase.storage },
    singleProjectMode: true,
  }

  const children = []
  let closed = false
  let published = false
  let interval
  const session = {
    schemaVersion: 1,
    sessionId,
    ownerPid: process.pid,
    processes: { session: process.pid },
    processIdentities: { session: captureIdentity(process.pid, { workingDirectory: process.cwd() }) },
    host: options.host,
    ports,
    origin: { scheme: 'http', host: options.host, port: ports.app, url: `http://${options.host}:${ports.app}`, fixed: options.fixedOrigin },
    urls: sessionUrls(options.host, ports),
    runtime: { firebaseConfig: firebaseConfigFile },
    mode: 'combined',
    startedAt: new Date(now()).toISOString(),
  }
  const persist = () => {
    if (published && !closed && readSession(repoRoot)?.sessionId === sessionId) writeSession(repoRoot, session)
  }
  const components = readinessComponents(options.host, ports)
  const refreshedIdentities = new Set()
  const tracker = createReadinessTracker(components, {
    now, timeoutMs: readinessTimeoutMs, probe,
    onChange(name, component) {
      session.readiness = tracker.readiness
      const processName = components[name].process
      if (component.status === 'ready' && !refreshedIdentities.has(processName)) {
        refreshedIdentities.add(processName)
        const birth = session.processIdentities[processName]
        const observed = birth && captureIdentity(birth.pid, { workingDirectory: birth.workingDirectory ?? repoRoot })
        // npm/Vite may change their displayed process title during startup.
        // Refresh its command hash only after the original process birth and
        // parent still match; a reused PID never becomes the recorded child.
        if (observed && birth.pid === observed.pid && birth.parentPid === observed.parentPid && birth.startedAt === observed.startedAt && observed.commandHash) session.processIdentities[processName] = observed
      }
      persist()
      const destination = component.status === 'failed' ? errors : output
      destination.write(`[SYSTEMX ${component.status.toUpperCase()}] ${component.label}: ${component.message}\n`)
      if (name === 'app' && component.status === 'ready') output.write(`[SYSTEMX] Active mock save origin: ${session.origin.url}\n[SYSTEMX] Portal directory: ${session.urls.portals}\n`)
    },
  })
  session.readiness = tracker.readiness

  function close() {
    if (closed) return
    closed = true
    tracker.stop()
    clearInterval(interval)
    for (const { child } of children) {
      if (!child.killed && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    }
    for (const name of ['lan', 'vite']) {
      const pid = session.processes[name]
      if (pid) removePidFile(repoRoot, `local-${name}-${ports[name === 'vite' ? 'app' : 'lan']}.pid`, pid)
    }
    if (existsSync(firebaseConfigFile)) unlinkSync(firebaseConfigFile)
    clearSession(repoRoot, sessionId)
  }

  const firebaseEnv = {
    SYSTEMX_FIREBASE_AUTH_PORT: String(ports.firebase.auth),
    SYSTEMX_FIREBASE_FIRESTORE_PORT: String(ports.firebase.firestore),
    SYSTEMX_FIREBASE_STORAGE_PORT: String(ports.firebase.storage),
    VITE_SYSTEMX_LOCAL_SESSION: 'true',
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1',
    VITE_FIREBASE_AUTH_EMULATOR_PORT: String(ports.firebase.auth),
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: String(ports.firebase.firestore),
    VITE_FIREBASE_STORAGE_EMULATOR_PORT: String(ports.firebase.storage),
  }
  function start(name, executable, args) {
    let child
    try {
      child = spawnChild(executable, args, {
        cwd: repoRoot,
        env: {
          ...environment,
          SYSTEMX_APP_PORT: String(ports.app),
          SYSTEMX_LAN_PORT: String(ports.lan),
          SYSTEMX_STRICT_PORT: 'true',
          SYSTEMX_SESSION_ID: sessionId,
          SYSTEMX_SESSION_OWNER_PID: String(process.pid),
          ...firebaseEnv,
        },
        shell: false,
        stdio: ['inherit', 'pipe', 'pipe'],
      })
    } catch (error) {
      tracker.processFailed(name, `Could not start ${name}: ${error.code ?? error.message}`)
      return
    }
    children.push({ name, child })
    child.stdout.on('data', chunk => output.write(`[${name.toUpperCase()}] ${chunk}`))
    child.stderr.on('data', chunk => errors.write(`[${name.toUpperCase()}] ${chunk}`))
    child.once('error', error => tracker.processFailed(name, `Could not start ${name}: ${error.code ?? error.message}`))
    child.once('exit', (code, signal) => {
      if (!closed) tracker.processFailed(name, signal ? `${name} stopped by ${signal}` : `${name} exited with code ${code ?? 'unknown'}`)
    })
    if (Number.isInteger(child.pid) && child.pid > 0) {
      session.processes[name] = child.pid
      session.processIdentities[name] = captureIdentity(child.pid, { workingDirectory: repoRoot })
      if (name === 'lan' || name === 'vite') writePidFile(repoRoot, `local-${name}-${ports[name === 'vite' ? 'app' : 'lan']}.pid`, child.pid)
    }
  }

  try {
    mkdirSync(stateRoot, { recursive: true, mode: 0o700 })
    cleanStalePidFiles(repoRoot)
    writeFileSync(firebaseConfigFile, `${JSON.stringify(firebaseConfig, null, 2)}\n`, { mode: 0o600 })
    start('firebase', command.executable, [...command.args, 'emulators:start', '--config', firebaseConfigFile, '--project', 'demo-systemx', '--only', 'auth,firestore,storage'])
    start('lan', process.execPath, [join(repoRoot, '.SYSTEMX', 'LAN', 'server.mjs')])
    start('vite', process.execPath, [viteBin, '--host', options.host, '--port', String(ports.app), '--strictPort'])
    writeSession(repoRoot, session)
    published = true
    output.write(formatSessionSummary(session))
    const pollReadiness = async () => {
      await tracker.check()
      if (tracker.settled()) clearInterval(interval)
      return session.readiness
    }
    if (readinessIntervalMs > 0) {
      interval = setInterval(() => { void pollReadiness().catch(error => errors.write(`[SYSTEMX] Readiness reporting failed: ${error.message}\n`)) }, readinessIntervalMs)
      void pollReadiness().catch(error => errors.write(`[SYSTEMX] Readiness reporting failed: ${error.message}\n`))
    }
    return { session, children, close, pollReadiness }
  } catch (error) { close(); throw error }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const options = parseSessionOptions(args, environment)
  if (options.help) {
    console.log('Usage: npm run dev:systemx -- [--host <127.0.0.1|localhost>] [--port <1024-65535>] [--fixed-origin]\nDefault: select free loopback ports. Supplying --host, --port, SYSTEMX_DEV_HOST or SYSTEMX_APP_PORT fixes the app origin; SYSTEMX_FIXED_ORIGIN=true also fixes the default origin. A busy fixed app port fails before any child starts. Vite always uses --strictPort. Mock saves belong to the printed HTTP origin and browser profile. App/LAN HTTP readiness and individual emulator readiness are reported separately.')
    return
  }
  const owned = await startDevSession(options, { environment })
  process.once('exit', owned.close)
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.once(signal, () => { owned.close(); process.exit(code) })
}

if (process.argv[1] && resolve(process.argv[1]) === scriptFile) {
  try { await main() } catch (error) { console.error(`[SYSTEMX] ${error.message}`); process.exitCode = 1 }
}
