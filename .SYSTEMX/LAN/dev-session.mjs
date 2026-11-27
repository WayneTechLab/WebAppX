#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, readSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, win32 } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createSessionArtifact, removeSessionArtifacts, sessionWorkspaceId } from './Builder/runtime/session-artifacts.mjs'
import { confinedDirectory } from './Builder/runtime/file-boundary.mjs'
import { claimSession, clearSession, readSession, writeSession } from './Builder/runtime/port-utils.mjs'
import { readSessionClaim, sessionClaimError } from './session-claim.mjs'
import { captureSessionProcessIdentity, inspectSessionListeners, manualSessionTermination } from './session-restart-preview.mjs'
import { createReadinessTracker, formatSessionSummary, parseSessionOptions, readinessComponents, resolveSessionPorts, sessionUrls, validSessionGeneration } from './session-supervisor.mjs'

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

/** Validate only local file structure; never read or print emulator dataset values. */
export function validateEmulatorImport(directory) {
  if (directory === undefined) return undefined
  const fail = message => { throw new Error(`Emulator import refused: ${message}`) }
  if (typeof directory !== 'string' || !directory.trim() || directory.includes('\0')) fail('select an existing Firebase export directory.')
  const requested = resolve(directory)
  let root
  try {
    const entry = lstatSync(requested)
    if (entry.isSymbolicLink() || !entry.isDirectory()) fail('the export directory must be a real directory, not a link.')
    // Canonicalize ordinary OS aliases in ancestor paths (for example macOS tmp).
    root = realpathSync(requested)
  } catch (error) {
    if (error.message.startsWith('Emulator import refused:')) throw error
    fail('the export directory is missing or unreadable.')
  }
  const inside = path => {
    const suffix = relative(root, path)
    return !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${win32.sep}`) && !suffix.startsWith('../')
  }
  const inspect = (path, label) => {
    try {
      const entry = lstatSync(path)
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile()) || !inside(realpathSync(path))) fail(`${label} must contain only regular files and directories inside the export.`)
      return entry
    } catch (error) {
      if (error.message.startsWith('Emulator import refused:')) throw error
      fail(`${label} is missing or unreadable.`)
    }
  }
  const metadataPath = join(root, 'firebase-export-metadata.json')
  const metadataEntry = inspect(metadataPath, 'firebase-export-metadata.json')
  const metadataLimit = 64 * 1024
  if (!metadataEntry.isFile() || metadataEntry.size < 1 || metadataEntry.size > metadataLimit) fail('firebase-export-metadata.json must be a regular JSON file of at most 64 KiB.')
  let metadata
  let descriptor
  try {
    descriptor = openSync(metadataPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const opened = fstatSync(descriptor)
    if (!opened.isFile() || opened.dev !== metadataEntry.dev || opened.ino !== metadataEntry.ino || opened.size < 1 || opened.size > metadataLimit) fail('firebase-export-metadata.json changed during validation.')
    const bytes = Buffer.alloc(metadataLimit + 1)
    let length = 0
    let read
    do { read = readSync(descriptor, bytes, length, bytes.length - length, null); length += read } while (read && length < bytes.length)
    if (length > metadataLimit) fail('firebase-export-metadata.json exceeds 64 KiB.')
    metadata = JSON.parse(bytes.subarray(0, length).toString('utf8'))
  } catch (error) {
    if (error.message.startsWith('Emulator import refused:')) throw error
    fail('firebase-export-metadata.json is unreadable or malformed JSON.')
  } finally { if (descriptor !== undefined) closeSync(descriptor) }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object' || typeof metadata.version !== 'string' || !metadata.version.trim()) fail('Firebase export metadata must contain a version and supported emulator sections.')
  let visited = 0
  const checkTree = (path, label, depth = 0) => {
    if (++visited > 100_000 || depth > 128) fail('the referenced export tree exceeds the local validation limit.')
    const entry = inspect(path, label)
    if (entry.isDirectory()) {
      let names
      try { names = readdirSync(path) } catch { fail(`${label} is unreadable.`) }
      for (const name of names) checkTree(join(path, name), label, depth + 1)
    }
  }
  const referenced = (value, label, kind) => {
    if (typeof value !== 'string' || !value || value.includes(':') || [...value].some(character => character.charCodeAt(0) < 32) || isAbsolute(value) || win32.isAbsolute(value)) fail(`${label} must be a relative path inside the export.`)
    const segments = value.split(/[\\/]/)
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) fail(`${label} must not traverse outside the export.`)
    let path = root
    for (const segment of segments) { path = join(path, segment); inspect(path, label) }
    if (!inside(path)) fail(`${label} must remain inside the export.`)
    const entry = inspect(path, label)
    if (kind === 'directory' ? !entry.isDirectory() : !entry.isFile()) fail(`${label} must reference a regular ${kind}.`)
    checkTree(path, label)
  }
  let supported = 0
  for (const name of ['auth', 'firestore', 'storage']) {
    if (metadata[name] === undefined) continue
    const section = metadata[name]
    if (!section || Array.isArray(section) || typeof section !== 'object') fail(`${name} metadata must be an object.`)
    referenced(section.path, `${name}.path`, 'directory')
    if (name === 'firestore') referenced(section.metadata_file, 'firestore.metadata_file', 'file')
    supported += 1
  }
  if (!supported) fail('metadata must reference auth, firestore or storage export data.')
  return root
}

/** Dependencies let tests exercise supervision without running Firebase or Vite. */
export async function startDevSession(options, {
  repoRoot = repository,
  platform = process.platform,
  inspectListeners = inspectSessionListeners,
  environment = process.env,
  spawnChild = spawn,
  available,
  inspectProcess,
  captureIdentity = captureSessionProcessIdentity,
  output = process.stdout,
  errors = process.stderr,
  now = Date.now,
  probe,
  readinessTimeoutMs = 60_000,
  readinessIntervalMs = 500,
  command = firebaseCommand({ environment }),
} = {}) {
  const emulatorImport = validateEmulatorImport(options.emulatorImport)
  const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) throw new Error('Missing local Vite dependency. Run npm ci first.')
  if (options.generation !== undefined && !validSessionGeneration(options.generation)) throw new Error('Invalid proposed session generation.')
  const observeClaim = () => readSessionClaim(repoRoot, { inspectProcess })
  let existing = observeClaim()
  // A different process may be publishing its first receipt. Allow the short
  // transaction to finish so the loser can report the actual generation.
  for (let attempt = 0; attempt < 20 && existing.reasons.includes('session-update-in-progress-or-interrupted'); attempt++) {
    await delay(10)
    existing = observeClaim()
  }
  const explainRefusal = async error => {
    if (options.fixedOrigin) {
      const { fixedOriginRecovery } = await import('./session-origin-recovery.mjs')
      const recovery = await fixedOriginRecovery({ repoRoot, options, inspectListeners, inspectProcess, platform, bindFailed: error.code === 'EADDRINUSE' })
      if (recovery) {
        error.recovery = recovery
        error.message += ' Fixed origin ' + recovery.origin + ' (' + recovery.ownership + '). ' +
          recovery.choices.map(choice => choice.guidance).join(' ')
      }
    }
    return error
  }
  if (existing.status !== 'absent') throw await explainRefusal(sessionClaimError(existing))

  // Plan every listener before spawning children or writing runtime state.
  let ports
  try { ports = await resolveSessionPorts(options, { available }) }
  catch (error) {
    const concurrent = observeClaim()
    if (concurrent.status !== 'absent') throw await explainRefusal(sessionClaimError(concurrent))
    throw await explainRefusal(error)
  }
  const sessionId = options.generation ?? `systemx-${randomUUID()}`
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
    workspaceId: sessionWorkspaceId(repoRoot),
    sessionId,
    ownerPid: process.pid,
    processes: { session: process.pid },
    processIdentities: { session: captureIdentity(process.pid, { workingDirectory: process.cwd() }) },
    host: options.host,
    ports,
    origin: { scheme: 'http', host: options.host, port: ports.app, url: `http://${options.host}:${ports.app}`, fixed: options.fixedOrigin },
    urls: sessionUrls(options.host, ports),
    artifactReceipts: {},
    runtime: { firebaseConfig: firebaseConfigFile, ...(emulatorImport ? { emulatorImport } : {}) },
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
    if (!published) return
    const manual = manualSessionTermination(platform, session.mode)
    if (manual) {
      errors.write('[SYSTEMX] ' + manual.guidance + '\n')
      return
    }
    for (const { child } of children) {
      if (!child.killed && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    }
    const currentRecord = readSession(repoRoot)
    if (currentRecord?.sessionId === sessionId && currentRecord.ownerPid === process.pid) {
      try { removeSessionArtifacts(repoRoot, session, { createdOnly: true }) }
      catch { errors.write('[SYSTEMX] Runtime artifact ownership changed. Inspect recovery before clearing this session.\n'); return }
    }
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
    // A crash between spawn and PID capture must remain visible to recovery.
    session.startingRole = name
    persist()
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
      delete session.startingRole
      persist()
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
      if (name === 'lan' || name === 'vite') {
        const marker = join(stateRoot, `local-${name}-${ports[name === 'vite' ? 'app' : 'lan']}.pid`)
        try { session.artifactReceipts[name + 'Pid'] = createSessionArtifact(marker, String(child.pid) + '\n') }
        catch (error) {
          if (error.code !== 'EEXIST') throw error
          session.preservedPidMarkers ??= []
          session.preservedPidMarkers.push(name + 'Pid')
        }
      }
    }
    delete session.startingRole
    persist()
  }

  try {
    confinedDirectory(repoRoot, stateRoot)
    try { claimSession(repoRoot, session) }
    catch (error) {
      if (error.code === 'EEXIST') throw await explainRefusal(sessionClaimError(observeClaim()))
      throw error
    }
    published = true
    session.artifactReceipts.firebaseConfig = createSessionArtifact(firebaseConfigFile, JSON.stringify(firebaseConfig, null, 2) + '\n')
    persist()
    start('firebase', command.executable, [...command.args, 'emulators:start', '--config', firebaseConfigFile, '--project', 'demo-systemx', '--only', 'auth,firestore,storage', ...(emulatorImport ? ['--import', emulatorImport] : [])])
    start('lan', process.execPath, [join(repoRoot, '.SYSTEMX', 'LAN', 'server.mjs')])
    start('vite', process.execPath, [viteBin, '--host', options.host, '--port', String(ports.app), '--strictPort'])
    persist()
    output.write(formatSessionSummary(session))
    if (emulatorImport) output.write('[SYSTEMX] Firebase will import the explicitly selected local export. Keep that export unchanged until emulator startup completes; readiness does not verify imported workflows.\n')
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
    console.log('Usage: npm run dev:systemx -- [--host <127.0.0.1|localhost>] [--port <1024-65535>] [--fixed-origin] [--generation <proposed-systemx-UUIDv4>] [--emulator-import <exportdir>]\nDefault: select free loopback ports. Supplying --host, --port, SYSTEMX_DEV_HOST or SYSTEMX_APP_PORT fixes the app origin; SYSTEMX_FIXED_ORIGIN=true also fixes the default origin. A busy fixed app port fails before any child starts. Vite always uses --strictPort. Mock saves belong to the printed HTTP origin and browser profile. App/LAN HTTP readiness and individual emulator readiness are reported separately. Emulator import occurs only with --emulator-import and requires an existing local Firebase export directory; quote paths containing spaces as one argument. Keep the export unchanged during startup.')
    return
  }
  const owned = await startDevSession(options, { environment })
  process.once('exit', owned.close)
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.once(signal, () => { owned.close(); process.exit(code) })
}

if (process.argv[1] && resolve(process.argv[1]) === scriptFile) {
  try { await main() } catch (error) { console.error(`[SYSTEMX] ${error.message}`); process.exitCode = 1 }
}
