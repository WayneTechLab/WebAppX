import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { firebaseCommand, startDevSession } from '../dev-session.mjs'
import { createReadinessTracker, formatSessionSummary, parseSessionOptions, probeReadiness, readinessComponents, resolveSessionPorts, sessionUrls } from '../session-supervisor.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const planned = { app: 5173, lan: 7331, firebase: { auth: 9099, firestore: 8080, storage: 9199 } }

async function listening(server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: 0 }, resolveListen)
  })
  return server.address().port
}

async function closeServer(server) {
  server.closeAllConnections?.()
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
}

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'webappx-session-supervisor-'))
  await mkdir(join(root, 'node_modules/vite/bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/vite/bin/vite.js'), '// injected process only\n')
  await writeFile(join(root, 'firebase.json'), JSON.stringify({ firestore: { rules: 'firestore.rules' }, storage: { rules: 'storage.rules' } }))
  return root
}

function runtimeFixtures(root, overrides = {}) {
  const spawned = []
  let stdout = ''
  let stderr = ''
  const deps = {
    repoRoot: root,
    environment: {},
    available: async () => true,
    captureIdentity: pid => ({ pid, parentPid: process.pid, startedAt: 'synthetic birth', commandHash: 'synthetic command' }),
    output: { write: text => { stdout += text } },
    errors: { write: text => { stderr += text } },
    probe: async () => ({ ok: true }),
    readinessIntervalMs: 0,
    command: { executable: 'synthetic-firebase', args: ['synthetic-cli.js'] },
    spawnChild(executable, args, options) {
      const child = new EventEmitter()
      Object.assign(child, { pid: 800_000 + spawned.length, killed: false, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), signals: [] })
      child.kill = signal => { child.killed = true; child.signals.push(signal); return true }
      spawned.push({ executable, args, options, child })
      return child
    },
    ...overrides,
  }
  return { deps, spawned, stdout: () => stdout, stderr: () => stderr }
}

test('origin arguments and environment distinguish default discovery from fixed intent', () => {
  assert.equal(parseSessionOptions().fixedOrigin, false)
  assert.deepEqual(parseSessionOptions(['--host', 'localhost', '--port', '5184']), { host: 'localhost', fixedOrigin: true, ports: { app: 5184, lan: 7331, auth: 9099, firestore: 8080, storage: 9199 }, help: false })
  assert.equal(parseSessionOptions(['--fixed-origin']).fixedOrigin, true)
  assert.equal(parseSessionOptions([], { SYSTEMX_APP_PORT: '5185' }).fixedOrigin, true)
  assert.equal(parseSessionOptions([], { SYSTEMX_DEV_HOST: 'localhost' }).fixedOrigin, true)
  assert.equal(parseSessionOptions([], { SYSTEMX_FIXED_ORIGIN: 'true' }).fixedOrigin, true)
  assert.equal(parseSessionOptions([], { SYSTEMX_FIXED_ORIGIN: 'false' }).fixedOrigin, false)
  assert.equal(parseSessionOptions(['--help']).help, true)
})

test('origin validation rejects wildcard hosts, unknown flags and partially numeric ports', () => {
  for (const args of [['--host', '0.0.0.0'], ['--host', '192.168.1.1'], ['--host', '::1'], ['--host'], ['--port'], ['--port', '5173junk'], ['--port', '0'], ['--port', '65536'], ['--port', '5173.5'], ['--port', '5180;echo injected'], ['--app-port', '5173']]) assert.throws(() => parseSessionOptions(args))
  assert.throws(() => parseSessionOptions([], { SYSTEMX_LAN_PORT: '7331junk' }), /integer/)
  assert.throws(() => parseSessionOptions([], { SYSTEMX_FIXED_ORIGIN: 'yes' }), /true or false/)
})

test('a busy fixed loopback port fails with the exact origin and preserves the listener', async () => {
  const sentinel = createTcpServer()
  const port = await listening(sentinel)
  try {
    await assert.rejects(resolveSessionPorts(parseSessionOptions(['--host', 'localhost', '--port', String(port)])), error => {
      assert.equal(error.code, 'EADDRINUSE')
      assert.match(error.message, new RegExp(`http://localhost:${port}`))
      assert.match(error.message, /choose another --port/)
      assert.match(error.message, /session has not started/)
      return true
    })
    assert.equal(sentinel.listening, true)
  } finally { await closeServer(sentinel) }
})

test('automatic discovery respects occupied ports and excludes every already-selected component', async () => {
  const options = parseSessionOptions()
  options.ports = { app: 5173, lan: 5173, auth: 5173, firestore: 5173, storage: 5173 }
  const ports = await resolveSessionPorts(options, { available: async port => port !== 5173 })
  assert.deepEqual(ports, { app: 5174, lan: 5175, firebase: { auth: 5176, firestore: 5177, storage: 5178 } })
})

test('port discovery never probes past 65535', async () => {
  const seen = []
  const options = parseSessionOptions()
  options.ports.app = 65535
  await assert.rejects(resolveSessionPorts(options, { available: async port => { seen.push(port); return false } }), /65535 to 65535/)
  assert.deepEqual(seen, [65535])
})

test('summary prints exact save origin, scheme, host, port and portal directory', () => {
  const session = { origin: { scheme: 'http', host: 'localhost', port: 5184, url: 'http://localhost:5184', fixed: true }, urls: sessionUrls('localhost', { ...planned, app: 5184 }), readiness: createReadinessTracker(readinessComponents('localhost', planned)).readiness }
  const summary = formatSessionSummary(session)
  assert.match(summary, /Mock save origin: http:\/\/localhost:5184 \(scheme http, host localhost, port 5184\)/)
  assert.match(summary, /Portal directory: http:\/\/localhost:5184\/portals/)
  assert.match(summary, /exact origin and browser profile/)
  assert.match(summary, /LAN direct: +http:\/\/127\.0\.0\.1:7331\//)
  assert.equal(summary.includes('127.0.0.1:5184'), false)
})

test('HTTP probes reject unrelated 200 pages and validate each component contract', async () => {
  const replies = {
    '/vite': { body: '<html><script type="module" src="/@vite/client"></script></html>' },
    '/lan': { body: JSON.stringify({ status: 'online', mode: 'local-only' }) },
    '/auth': { body: JSON.stringify({ authEmulator: { ready: true } }) },
    '/firestore': { body: 'Ok\n' },
    '/other': { body: '<html>unrelated server</html>' },
    '/not-ready': { body: JSON.stringify({ authEmulator: { ready: false } }) },
    '/failure': { status: 503, body: 'temporarily unavailable' },
  }
  const server = createHttpServer((incoming, outgoing) => { const reply = replies[incoming.url]; outgoing.writeHead(reply.status ?? 200); outgoing.end(reply.body) })
  const port = await listening(server)
  const probeAt = (kind, path) => probeReadiness({ kind, url: `http://127.0.0.1:${port}${path}` })
  try {
    for (const kind of ['vite', 'lan', 'auth', 'firestore']) assert.equal((await probeAt(kind, `/${kind}`)).ok, true, kind)
    for (const kind of ['vite', 'lan', 'auth', 'firestore']) assert.equal((await probeAt(kind, '/other')).ok, false, kind)
    assert.equal((await probeAt('auth', '/not-ready')).ok, false)
    assert.deepEqual(await probeAt('vite', '/failure'), { ok: false, reason: 'HTTP 503' })
  } finally { await closeServer(server) }
})

test('HTTP readiness has a bounded deadline and does not follow redirects', async () => {
  const server = createHttpServer((incoming, outgoing) => { if (incoming.url === '/redirect') { outgoing.writeHead(302, { Location: 'https://example.invalid/' }); outgoing.end() } })
  const port = await listening(server)
  try {
    assert.deepEqual(await probeReadiness({ kind: 'vite', url: `http://127.0.0.1:${port}/redirect` }), { ok: false, reason: 'HTTP 302' })
    const result = await probeReadiness({ kind: 'vite', url: `http://127.0.0.1:${port}/hang` }, { timeoutMs: 25 })
    assert.equal(result.ok, false)
    assert.match(result.reason, /timed out/)
  } finally { await closeServer(server) }
})

test('a response that keeps sending bytes still reaches the absolute probe deadline', async () => {
  let writes = 0
  const server = createHttpServer((incoming, outgoing) => {
    outgoing.writeHead(200)
    outgoing.write('a')
    const trickle = setInterval(() => { writes += 1; outgoing.write('a') }, 5)
    outgoing.once('close', () => clearInterval(trickle))
  })
  const port = await listening(server)
  try {
    const result = await probeReadiness({ kind: 'vite', url: `http://127.0.0.1:${port}/` }, { timeoutMs: 35 })
    assert.equal(result.ok, false)
    assert.ok(writes > 0)
  } finally { await closeServer(server) }
})

test('Storage listener probe opens no application request and distinguishes a closed socket', async () => {
  const server = createTcpServer(socket => socket.once('data', () => assert.fail('The storage readiness probe must not send a bucket request')))
  const port = await listening(server)
  const component = { kind: 'tcp', url: `http://127.0.0.1:${port}/` }
  assert.deepEqual(await probeReadiness(component), { ok: true })
  await closeServer(server)
  assert.equal((await probeReadiness(component)).ok, false)
})

test('app and each emulator transition independently, with named endpoint-specific timeout errors', async () => {
  let time = 0
  const ready = new Set(['Vite app', 'LAN service'])
  const transitions = []
  const tracker = createReadinessTracker(readinessComponents('127.0.0.1', planned), { now: () => time, timeoutMs: 1000, probe: async component => ({ ok: ready.has(component.label), reason: 'ECONNREFUSED' }), onChange: (name, state) => transitions.push([name, state.status]) })
  await tracker.check()
  assert.equal(tracker.readiness.app.status, 'ready')
  assert.match(tracker.readiness.app.message, /Usable app.*emulator readiness is reported separately/)
  for (const name of ['auth', 'firestore', 'storage']) assert.equal(tracker.readiness[name].status, 'starting')
  ready.add('Firebase Auth emulator')
  await tracker.check()
  assert.equal(tracker.readiness.auth.status, 'ready')
  assert.equal(tracker.readiness.firestore.status, 'starting')
  ready.add('Firestore emulator')
  await tracker.check()
  assert.equal(tracker.readiness.firestore.status, 'ready')
  time = 1001
  await tracker.check()
  assert.equal(tracker.readiness.storage.status, 'failed')
  assert.match(tracker.readiness.storage.message, /1000ms.*127\.0\.0\.1:9199.*ECONNREFUSED.*\[FIREBASE\]/)
  assert.equal(tracker.readiness.app.status, 'ready')
  assert.equal(tracker.settled(), true)
  assert.deepEqual(transitions, [['app', 'ready'], ['lan', 'ready'], ['auth', 'ready'], ['firestore', 'ready'], ['storage', 'failed']])
})

test('a slow emulator probe does not hold back app readiness', async () => {
  let finishEmulator
  let appChanged
  const appReady = new Promise(resolveReady => { appChanged = resolveReady })
  const tracker = createReadinessTracker({ app: { label: 'Vite app', process: 'vite', kind: 'vite', url: 'http://127.0.0.1:5173/portals' }, storage: { label: 'Storage emulator', process: 'firebase', kind: 'tcp', url: 'http://127.0.0.1:9199/' } }, {
    probe: component => component.kind === 'vite' ? Promise.resolve({ ok: true }) : new Promise(resolveProbe => { finishEmulator = resolveProbe }),
    onChange: name => { if (name === 'app') appChanged() },
  })
  const checking = tracker.check()
  await appReady
  assert.equal(tracker.readiness.app.status, 'ready')
  assert.equal(tracker.readiness.storage.status, 'starting')
  finishEmulator({ ok: true })
  await checking
  assert.match(tracker.readiness.storage.message, /listener reachable.*workflows have not been tested/)
})

test('child exit wins over in-flight readiness and invalidates formerly ready components', async () => {
  let finishProbe
  const tracker = createReadinessTracker({ app: { label: 'Vite app', process: 'vite', kind: 'vite', url: 'http://127.0.0.1:5173/portals' } }, { probe: () => new Promise(resolveProbe => { finishProbe = resolveProbe }) })
  const checking = tracker.check()
  tracker.processFailed('vite', 'vite exited with code 1 after strict bind failed')
  finishProbe({ ok: true })
  await checking
  assert.equal(tracker.readiness.app.status, 'failed')
  assert.match(tracker.readiness.app.message, /strict bind failed/)

  const readyTracker = createReadinessTracker(readinessComponents('127.0.0.1', planned), { probe: async () => ({ ok: true }) })
  await readyTracker.check()
  readyTracker.processFailed('firebase', 'firebase exited with code 1')
  for (const name of ['auth', 'firestore', 'storage']) { assert.equal(readyTracker.readiness[name].status, 'failed'); assert.match(readyTracker.readiness[name].message, /exited with code 1/) }
  assert.equal(readyTracker.readiness.app.status, 'ready')
  assert.equal(readyTracker.readiness.lan.status, 'ready')
})

test('shutdown prevents late probes from recreating ready state', async () => {
  let finishProbe
  const changes = []
  const tracker = createReadinessTracker({ app: { label: 'Vite app', process: 'vite', kind: 'vite', url: 'http://127.0.0.1:5173/' } }, { probe: () => new Promise(resolveProbe => { finishProbe = resolveProbe }), onChange: name => changes.push(name) })
  const checking = tracker.check()
  tracker.stop()
  finishProbe({ ok: true })
  await checking
  assert.deepEqual(changes, [])
  assert.equal(tracker.readiness.app.status, 'starting')
})

test('busy fixed origin starts no process and writes no runtime state', async () => {
  const root = await fixtureRoot()
  const sentinel = createTcpServer()
  const port = await listening(sentinel)
  const fixture = runtimeFixtures(root, { available: undefined })
  try {
    await assert.rejects(startDevSession(parseSessionOptions(['--port', String(port)]), fixture.deps), /Fixed app origin.*unavailable/)
    assert.equal(fixture.spawned.length, 0)
    assert.equal(existsSync(join(root, '.SYSTEMX/state')), false)
    assert.equal(sentinel.listening, true)
  } finally { await closeServer(sentinel); await rm(root, { recursive: true, force: true }) }
})

test('supervisor launches argument arrays with strict Vite port and saves usable app apart from Firebase failure', async () => {
  const root = await fixtureRoot()
  const fixture = runtimeFixtures(root)
  let owned
  try {
    owned = await startDevSession(parseSessionOptions(['--host', 'localhost', '--port', '5184']), fixture.deps)
    const [firebase, lan, vite] = fixture.spawned
    assert.equal(vite.options.shell, false)
    assert.deepEqual(vite.args.slice(1), ['--host', 'localhost', '--port', '5184', '--strictPort'])
    assert.ok(firebase.args.includes('demo-systemx'))
    assert.equal(firebase.args.includes('--yes'), false)
    assert.equal(lan.options.env.SYSTEMX_SESSION_OWNER_PID, String(process.pid))
    assert.equal(vite.options.env.VITE_FIREBASE_EMULATOR_HOST, '127.0.0.1')
    const config = JSON.parse(readFileSync(owned.session.runtime.firebaseConfig, 'utf8'))
    assert.equal(config.emulators.auth.host, '127.0.0.1')
    assert.equal(config.emulators.firestore.host, '127.0.0.1')
    assert.equal(config.emulators.storage.host, '127.0.0.1')
    await owned.pollReadiness()
    firebase.child.exitCode = 1
    firebase.child.emit('exit', 1, null)
    const recorded = JSON.parse(readFileSync(join(root, '.SYSTEMX/state/local-session.json'), 'utf8'))
    assert.equal(recorded.readiness.app.status, 'ready')
    assert.equal(recorded.readiness.lan.status, 'ready')
    for (const name of ['auth', 'firestore', 'storage']) assert.equal(recorded.readiness[name].status, 'failed')
    assert.deepEqual(recorded.origin, { scheme: 'http', host: 'localhost', port: 5184, url: 'http://localhost:5184', fixed: true })
    assert.equal(recorded.urls.portals, 'http://localhost:5184/portals')
    assert.match(fixture.stdout(), /Mock save origin: http:\/\/localhost:5184/)
    assert.match(fixture.stdout(), /Usable app/)
    assert.match(fixture.stderr(), /Firebase Auth emulator.*exited with code 1/)
    owned.close()
    assert.deepEqual(firebase.child.signals, [], 'Do not signal an already-exited child')
    assert.deepEqual(lan.child.signals, ['SIGTERM'])
    assert.deepEqual(vite.child.signals, ['SIGTERM'])
    assert.equal(existsSync(owned.session.runtime.firebaseConfig), false)
    assert.equal(existsSync(join(root, '.SYSTEMX/state/local-session.json')), false)
    owned.close()
    assert.deepEqual(vite.child.signals, ['SIGTERM'])
  } finally { owned?.close(); await rm(root, { recursive: true, force: true }) }
})

test('missing Firebase executable becomes three named component failures without suppressing usable Vite', async () => {
  const root = await fixtureRoot()
  const fixture = runtimeFixtures(root)
  let owned
  try {
    owned = await startDevSession(parseSessionOptions(), fixture.deps)
    const firebase = fixture.spawned[0].child
    firebase.emit('error', Object.assign(new Error('synthetic missing executable'), { code: 'ENOENT' }))
    await owned.pollReadiness()
    for (const name of ['auth', 'firestore', 'storage']) { assert.equal(owned.session.readiness[name].status, 'failed'); assert.match(owned.session.readiness[name].message, /ENOENT/) }
    assert.equal(owned.session.readiness.app.status, 'ready')
    assert.equal(owned.session.readiness.lan.status, 'ready')
  } finally { owned?.close(); await rm(root, { recursive: true, force: true }) }
})

test('existing live recorded processes prevent replacement and remain untouched', async () => {
  const root = await fixtureRoot()
  await mkdir(join(root, '.SYSTEMX/state'), { recursive: true })
  const path = join(root, '.SYSTEMX/state/local-session.json')
  const bytes = JSON.stringify({ sessionId: 'earlier-session', ownerPid: process.pid, processes: {} })
  await writeFile(path, bytes)
  const fixture = runtimeFixtures(root)
  try {
    await assert.rejects(startDevSession(parseSessionOptions(), fixture.deps), /existing local session.*live recorded processes/)
    assert.equal(fixture.spawned.length, 0)
    assert.equal(await readFile(path, 'utf8'), bytes)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('readiness refresh accepts a changed title only for the original process birth and parent', async () => {
  const root = await fixtureRoot()
  const captures = new Map()
  const fixture = runtimeFixtures(root, { captureIdentity(pid, { workingDirectory }) {
    const count = captures.get(pid) ?? 0
    captures.set(pid, count + 1)
    const identity = { pid, parentPid: process.pid, startedAt: 'original birth', commandHash: count ? 'settled title' : 'startup title', workingDirectory }
    // The Vite fixture's PID was reused before its probe returned.
    if (pid === 800_002 && count) identity.startedAt = 'replacement birth'
    return identity
  } })
  let owned
  try {
    owned = await startDevSession(parseSessionOptions(), fixture.deps)
    await owned.pollReadiness()
    assert.equal(owned.session.processIdentities.firebase.commandHash, 'settled title')
    assert.equal(owned.session.processIdentities.firebase.workingDirectory, root)
    assert.equal(owned.session.processIdentities.vite.commandHash, 'startup title')
    assert.equal(owned.session.processIdentities.vite.startedAt, 'original birth')
    assert.equal(captures.get(800_000), 2, 'Firebase birth is refreshed once despite three readiness components')
  } finally { owned?.close(); await rm(root, { recursive: true, force: true }) }
})

test('a replaced session record survives old supervisor cleanup and readiness updates', async () => {
  const root = await fixtureRoot()
  const fixture = runtimeFixtures(root)
  let owned
  try {
    owned = await startDevSession(parseSessionOptions(), fixture.deps)
    const path = join(root, '.SYSTEMX/state/local-session.json')
    const bytes = JSON.stringify({ sessionId: 'replacement-owner', custom: 'preserve' })
    writeFileSync(path, bytes)
    await owned.pollReadiness()
    assert.equal(readFileSync(path, 'utf8'), bytes)
    owned.close()
    assert.equal(readFileSync(path, 'utf8'), bytes)
  } finally { owned?.close(); await rm(root, { recursive: true, force: true }) }
})

test('Windows Firebase command uses Node and npm argument arrays without a command shell', () => {
  assert.deepEqual(firebaseCommand({ platform: 'win32', executable: 'C:\\Node\\node.exe', environment: { npm_execpath: 'C:\\Node\\node_modules\\npm\\bin\\npm-cli.js' } }), { executable: 'C:\\Node\\node.exe', args: ['C:\\Node\\node_modules\\npm\\bin\\npm-cli.js', 'exec', '--no', '--', 'firebase-tools'] })
  assert.throws(() => firebaseCommand({ platform: 'win32', environment: {} }), /npm run dev:systemx/)
  assert.deepEqual(firebaseCommand({ platform: 'darwin', environment: {} }), { executable: 'npx', args: ['--no-install', 'firebase-tools'] })
})

test('combined LAN child cannot overwrite or clear supervisor record; standalone retains ownership', { timeout: 15_000 }, async () => {
  const root = await fixtureRoot()
  const files = ['server.mjs', 'work-status.mjs', 'session-restart-preview.mjs', 'Builder/importer/current-repo.mjs', 'Builder/source-revision.mjs', 'Builder/source-history.mjs', 'Builder/source-policy.mjs', 'Builder/source-identity-http.mjs', 'Builder/runtime/port-utils.mjs', 'Builder/runtime/file-boundary.mjs']
  for (const file of files) {
    const target = join(root, '.SYSTEMX/LAN', file)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(repository, '.SYSTEMX/LAN', file), target)
  }
  await mkdir(join(root, '.SYSTEMX/state'), { recursive: true })
  const recordPath = join(root, '.SYSTEMX/state/local-session.json')
  const original = JSON.stringify({ schemaVersion: 1, sessionId: 'synthetic-combined', ownerPid: process.pid, origin: { url: 'http://localhost:5184' }, readiness: { app: { status: 'ready' } }, custom: 'preserve every byte' })
  await writeFile(recordPath, original)
  let child
  let exited
  async function launch(extraEnvironment) {
    const allocator = createTcpServer()
    const port = await listening(allocator)
    await closeServer(allocator)
    child = spawn(process.execPath, [join(root, '.SYSTEMX/LAN/server.mjs')], { cwd: root, env: { ...process.env, SYSTEMX_LAN_TEST_MODE: 'false', SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_PORT: String(port), SYSTEMX_SESSION_ID: 'synthetic-combined', SYSTEMX_SESSION_OWNER_PID: '', ...extraEnvironment }, stdio: ['ignore', 'pipe', 'pipe'] })
    exited = once(child, 'exit')
    let output = ''
    child.stderr.on('data', chunk => { output += chunk.toString() })
    await new Promise((resolveReady, reject) => {
      const deadline = setTimeout(() => reject(new Error(`Synthetic LAN fixture did not bind: ${output}`)), 5000)
      child.once('error', error => { clearTimeout(deadline); reject(error) })
      child.once('exit', () => { clearTimeout(deadline); reject(new Error(`Synthetic LAN fixture exited: ${output}`)) })
      child.stdout.on('data', chunk => { output += chunk.toString(); if (output.includes('Loopback-only local builder shell')) { clearTimeout(deadline); resolveReady() } })
    })
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Connection: 'close' } })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).status, 'online')
  }
  async function stop() {
    child.kill('SIGTERM')
    const deadline = setTimeout(() => child.kill('SIGKILL'), 3000)
    try { assert.deepEqual(await exited, [0, null]) } finally { clearTimeout(deadline); child = null }
  }
  try {
    await launch({ SYSTEMX_SESSION_OWNER_PID: String(process.pid) })
    assert.equal(await readFile(recordPath, 'utf8'), original)
    await stop()
    assert.equal(await readFile(recordPath, 'utf8'), original)
    await launch({})
    assert.equal(JSON.parse(await readFile(recordPath, 'utf8')).processes.lan, child.pid)
    await stop()
    assert.equal(existsSync(recordPath), false)
  } finally {
    if (child) { child.kill('SIGKILL'); await exited }
    await rm(root, { recursive: true, force: true })
  }
})
