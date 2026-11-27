import assert from 'node:assert/strict'
import { spawnSync, fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { captureSessionProcessIdentity, inspectSessionProcess } from '../session-restart-preview.mjs'
import { describeShutdownPlan, reviewRestartOrigin } from '../Builder/runtime/session-transition-plan.mjs'

const lanSource = fileURLToPath(new URL('../', import.meta.url))
const appSession = (host, port = 5174) => {
  const url = 'http://' + host + ':' + port
  return { mode: 'combined', host, ports: { app: port },
    origin: { scheme: 'http', host, port, url, fixed: false },
    urls: { app: url + '/', portals: url + '/portals', bridge: url + '/__systemx/', lan: 'http://127.0.0.1:7331/' } }
}

test('restart pins the declared origin across both supported host spellings and legacy record shapes', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const session = appSession(host, 65535)
    for (const entry of [session, { ports: session.ports, host }, { ports: session.ports, urls: session.urls }]) {
      const review = reviewRestartOrigin(entry)
      assert.deepEqual([review.valid, review.host, review.port, review.origin], [true, host, 65535, 'http://' + host + ':65535'])
      assert.match(review.guidance, /separate browser storage/)
      assert.match(review.guidance, /export.*restore/i)
    }
  }
})

test('conflicting or malformed saved URLs and declarations refuse restart without copying untrusted values', () => {
  for (const change of [
    s => { s.origin.scheme = 'https' }, s => { s.host = 'LOCALHOST' }, s => { s.origin.port = 4000 },
    s => { s.urls.app = 'http://127.0.0.1:5174/' }, s => { s.urls.portals = 'http://localhost:4200/portals' },
    s => { s.urls.bridge = 'http://localhost:5174/path' }, s => { s.origin.url += '#PRIVATE' },
    s => { s.urls.app = 'http://localhost:5174/?q=PRIVATE' }, s => { s.urls.app = 'http://PRIVATE@localhost:5174' },
    s => { s.urls.app = 'http://localhost:5174.PRIVATE' }, s => { s.origin.url = 'http://localhost:05174' },
    s => { s.ports.app = '5174' }, s => { s.origin = null }, s => { s.urls = [] }, s => { s.mode = 'lan-only' },
  ]) {
    const entry = appSession('localhost')
    change(entry)
    const before = JSON.stringify(entry)
    const review = reviewRestartOrigin(entry)
    assert.equal(review.valid, false)
    assert.equal(review.origin, null)
    assert.equal(review.host, null)
    assert.ok(review.reason)
    assert.ok(!JSON.stringify(review).includes('PRIVATE'))
    assert.equal(JSON.stringify(entry), before)
  }
})

test('stop preview describes direct child requests, independent readiness loss, refused and manual paths', () => {
  const owner = { role: 'session', pid: 20, state: 'owned' }
  const plan = { canStop: true, targets: [{ role: 'session', pid: 20 }], processes: [
    { role: 'vite', pid: 21, state: 'owned' }, owner, { role: 'lan', pid: 22, state: 'owned' },
    { role: 'firebase', pid: 23, state: 'owned' }, { role: 'private', pid: 24, state: 'owned' },
  ] }
  const session = { mode: 'combined', readiness: { app: { status: 'ready', detail: 'PRIVATE' }, lan: { status: 'PRIVATE' }, auth: { status: 'failed' } } }
  const preview = describeShutdownPlan(session, plan)
  assert.equal(preview.strategy, 'supervisor-request')
  const childSteps = preview.steps.filter(step => step.action === 'supervisor-requests-child-exit')
  assert.deepEqual(childSteps.map(step => step.role), ['firebase', 'lan', 'vite'])
  assert.deepEqual(childSteps.map(step => step.readinessMayBecomeUnavailable), [['auth','firestore','storage'], ['lan'], ['app']])
  assert.deepEqual(preview.components.find(c => c.role === 'vite').readiness, [{ component: 'app', recordedStatus: 'ready' }])
  assert.deepEqual(preview.components.find(c => c.role === 'lan').readiness, [{ component: 'lan', recordedStatus: 'unverified' }])
  assert.doesNotMatch(JSON.stringify(preview), /private/i)
  assert.equal(preview.steps.at(-1).action, 'verify-shutdown')
  const manual = describeShutdownPlan(session, { ...plan, canStop: false, termination: 'owning-terminal', targets: [] })
  assert.equal(manual.strategy, 'manual')
  assert.deepEqual(manual.steps.map(x => x.action), ['use-owning-terminal'])
  assert.match(manual.cleanupGate, /Preserve/)
  const refused = describeShutdownPlan(session, { ...plan, canStop: false, targets: [] })
  assert.equal(refused.strategy, 'blocked')
  assert.deepEqual(refused.steps.map(x => x.action), ['inspect-ownership'])
  const exited = describeShutdownPlan(session, { canStop: true, cleanup: true, targets: [], processes: [] })
  assert.equal(exited.strategy, 'exited-record-cleanup')
  const standalone = describeShutdownPlan({ mode: 'lan-only' }, { canStop: true,
    processes: [{ role: 'lan', pid: 30, state: 'owned' }], targets: [{ role: 'lan', pid: 30 }] })
  assert.deepEqual(standalone.steps.map(x => x.action), ['request-owner-stop', 'lan-may-become-unavailable', 'verify-shutdown'])
})

// Controlled OS processes with the launcher's real role commands, working
// directory and bound ports. Neither real Vite nor Firebase is necessary.
const childProgram = `
(async () => {
  const { createServer } = await import('node:net')
  const { once } = await import('node:events')
  const sockets = []
  process.on('disconnect', () => { for (const server of sockets) server.close() })
  for (let i = 0; i < Number(process.argv[2]); i++) {
    const server = createServer(socket => socket.end())
    sockets.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
  }
  process.send(sockets.map(server => server.address().port))
})().catch(() => process.exit(1))
`
const supervisorProgram = `
import { fork } from 'node:child_process'
import { once } from 'node:events'
const children = new Map()
const shutdown = () => { for (const child of children.values()) if (child.connected) child.disconnect() }
process.on('disconnect', shutdown)
const paths = { firebase: 'fixture-firebase.cjs', lan: '.SYSTEMX/LAN/server.mjs', vite: 'node_modules/vite/bin/vite.js' }
const result = {}
await Promise.all(Object.entries(paths).map(async ([role, path]) => {
  const args = role === 'firebase' ? ['3', 'emulators:start', '--config', process.argv[2]] : ['1']
  const child = fork(path, args, { execArgv: [], stdio: ['ignore','ignore','ignore','ipc'] })
  children.set(role, child)
  const [ports] = await once(child, 'message')
  result[role] = { pid: child.pid, ports }
}))
process.on('message', async msg => {
  if (msg !== 'release-vite') return
  const child = children.get('vite')
  const exited = once(child, 'exit')
  child.disconnect()
  await exited
  process.send('released')
})
process.send(result)
`

test('normal stop and restart previews preserve an owned running fixture, an available original port and an unrelated collision', {
  skip: !['darwin', 'linux'].includes(process.platform) || !inspectSessionProcess(process.pid).cwd
    ? 'Requires POSIX process birth/command, cwd and listener inspection' : false,
  timeout: 90_000,
}, async t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-transition-')))
  const lan = join(root, '.SYSTEMX', 'LAN'), state = join(root, '.SYSTEMX', 'state')
  const vite = join(root, 'node_modules', 'vite', 'bin')
  for (const dir of [lan, state, vite]) mkdirSync(dir, { recursive: true })
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const name of readdirSync(lanSource).filter(name => name.endsWith('.mjs'))) cpSync(join(lanSource, name), join(lan, name))
  cpSync(join(lanSource, 'Builder/runtime'), join(lan, 'Builder/runtime'), { recursive: true })
  const sessionId = 'systemx-' + randomUUID()
  const config = join(state, 'firebase-' + sessionId + '.json')
  writeFileSync(config, '{}\n')
  writeFileSync(join(state, 'operator-note'), 'preserve this unrelated file\n')
  writeFileSync(join(root, 'fixture-firebase.cjs'), childProgram)
  writeFileSync(join(vite, 'vite.js'), childProgram)
  writeFileSync(join(lan, 'server.mjs'), childProgram)
  writeFileSync(join(lan, 'dev-session.mjs'), supervisorProgram)
  const child = fork(join(lan, 'dev-session.mjs'), [config], { cwd: root, execArgv: [], stdio: ['ignore','ignore','ignore','ipc'] })
  const exited = once(child, 'exit')
  t.after(async () => { if (child.connected) child.disconnect(); await exited })
  const [components] = await once(child, 'message', { signal: AbortSignal.timeout(7000) })
  const [app] = components.vite.ports, [lanPort] = components.lan.ports
  const [auth, firestore, storage] = components.firebase.ports
  const session = appSession('localhost', app)
  session.sessionId = sessionId
  session.ownerPid = child.pid
  session.ports = { app, lan: lanPort, firebase: { auth, firestore, storage } }
  session.processes = { session: child.pid, firebase: components.firebase.pid, lan: components.lan.pid, vite: components.vite.pid }
  session.processIdentities = Object.fromEntries(Object.entries(session.processes)
    .map(([role, pid]) => [role, captureSessionProcessIdentity(pid, { workingDirectory: root })]))
  session.runtime = { firebaseConfig: config }
  session.readiness = { app: { status: 'ready' }, lan: { status: 'ready' } }
  const sessionFile = join(state, 'local-session.json')
  const save = () => writeFileSync(sessionFile, JSON.stringify(session) + '\n')
  const bytes = () => Object.fromEntries(readdirSync(state).map(name => [name, readFileSync(join(state, name)).toString('base64')]))
  const cli = (action, expectedExit) => {
    const before = bytes()
    const result = spawnSync(process.execPath, [join(lan, 'session-control.mjs'), action, '--preview'], {
      cwd: root, encoding: 'utf8', timeout: 20_000,
    })
    assert.equal(result.status, expectedExit, result.stderr || result.stdout)
    assert.deepEqual(bytes(), before)
    return JSON.parse(result.stdout || result.stderr)
  }
  save()
  const stop = cli('stop', 0)
  assert.equal(stop.action, 'stop-preview')
  assert.equal(stop.readOnly, true)
  assert.deepEqual(stop.shutdown.steps.filter(step => step.action === 'supervisor-requests-child-exit').map(step => step.role),
    ['firebase', 'lan', 'vite'])
  assert.equal(stop.shutdown.components.find(component => component.role === 'vite').readiness[0].recordedStatus, 'ready')
  const first = cli('restart', 0)
  assert.equal(first.browserStorage.origin, session.origin.url)
  assert.equal(first.browserStorage.listenerState, 'release-required')
  assert.deepEqual(first.proposedLaunch.args.slice(1), ['--fixed-origin','--host','localhost','--port',String(app)])
  for (const identity of Object.values(session.processIdentities)) {
    assert.deepEqual(captureSessionProcessIdentity(identity.pid, { workingDirectory: root }), identity)
  }

  const release = once(child, 'message', { signal: AbortSignal.timeout(5000) })
  child.send('release-vite')
  assert.equal((await release)[0], 'released')
  const available = cli('restart', 0)
  assert.equal(available.browserStorage.listenerState, 'available')
  assert.equal(available.browserStorage.origin, first.browserStorage.origin)
  assert.deepEqual(available.proposedLaunch, first.proposedLaunch)

  // Bind the just-released port with a process the fixture supervisor does not
  // own. A fresh preview must preserve the selected origin and decline launch.
  const unrelated = createServer(socket => socket.end())
  unrelated.listen(app, '127.0.0.1')
  await once(unrelated, 'listening')
  try {
    const blocked = cli('restart', 1)
    assert.equal(blocked.canRestart, false)
    assert.equal(blocked.browserStorage.origin, first.browserStorage.origin)
    assert.equal(blocked.browserStorage.listenerState, 'blocked')
    assert.equal(blocked.proposedLaunch, undefined)
    assert.equal(unrelated.listening, true)
  } finally { await new Promise(resolve => unrelated.close(resolve)) }

  session.urls.app = 'http://127.0.0.1:' + app + '/'
  save()
  const inconsistent = cli('restart', 1)
  assert.equal(inconsistent.browserStorage.valid, false)
  assert.equal(inconsistent.proposedLaunch, undefined)
  assert.equal(existsSync(config), true)
})
