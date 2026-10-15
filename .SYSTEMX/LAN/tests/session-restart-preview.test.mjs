import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { captureSessionProcessIdentity, createSessionRestartPreview, createSessionStopPlan, executeSessionStopPlan, inspectSessionListeners, inspectSessionProcess, sessionRuntimeCleanupTarget } from '../session-restart-preview.mjs'

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const fixtureRoot = resolve(tmpdir(), 'systemx-preview-unit')
const hash = (value) => createHash('sha256').update(value).digest('hex')

function fixture() {
  const session = {
    ownerPid: 100, sessionId: 'PRIVATE_SESSION_TOKEN', token: 'PRIVATE_TOKEN',
    ports: { app: 5173, lan: 7331, firebase: { auth: 9099, firestore: 8080, storage: 9199 } },
    urls: { app: 'http://127.0.0.1:5173/?token=PRIVATE_URL_TOKEN' },
    runtime: { firebaseConfig: join(fixtureRoot, '.SYSTEMX/state/firebase-private.json'), token: 'PRIVATE_RUNTIME_TOKEN' },
    processes: { session: 100, firebase: 101, lan: 102, vite: 103 },
  }
  const commands = {
    session: `node ${fixtureRoot}/.SYSTEMX/LAN/dev-session.mjs`,
    firebase: `node npm-cli.js firebase-tools emulators:start --config ${session.runtime.firebaseConfig} --project demo-systemx`,
    lan: `node ${fixtureRoot}/.SYSTEMX/LAN/server.mjs`, vite: `node ${fixtureRoot}/node_modules/vite/bin/vite.js --port 5173`,
  }
  const observations = new Map(Object.entries(session.processes).map(([role, pid]) => [pid, {
    pid, exists: true, parentPid: role === 'session' ? 50 : 100, startedAt: `start-${pid}`, command: commands[role], cwd: fixtureRoot,
  }]))
  session.processIdentities = Object.fromEntries(Object.entries(session.processes).map(([role, pid]) => [role, {
    pid, parentPid: observations.get(pid).parentPid, startedAt: `start-${pid}`, commandHash: hash(commands[role]),
  }]))
  const listeners = [
    { host: '127.0.0.1', port: 5173, pid: 103 }, { host: '*', port: 7331, pid: 102 },
    { host: '127.0.0.1', port: 9099, pid: 104 },
  ]
  observations.set(104, { pid: 104, exists: true, parentPid: 101, command: 'java emulator.jar', startedAt: 'start-104', cwd: fixtureRoot })
  const options = {
    repoRoot: fixtureRoot, session, platform: 'darwin',
    inspectProcess: (pid) => observations.get(pid) ?? { pid, exists: false },
    inspectListeners: () => ({ complete: true, listeners }),
  }
  return { session, observations, listeners, options }
}

test('preview identifies owned processes, emulator descendants, and exact replacement listener intent', () => {
  const { options } = fixture()
  const preview = createSessionRestartPreview(options)
  assert.equal(preview.readOnly, true)
  assert.equal(preview.status, 'ready-for-review')
  assert.equal(preview.canRestart, true)
  assert.ok(preview.processes.every((entry) => entry.state === 'owned'))
  assert.deepEqual(preview.replacementListeners.map(({ component, state }) => [component, state]), [
    ['app', 'release-required'], ['lan', 'release-required'], ['auth', 'release-required'], ['firestore', 'available'], ['storage', 'available'],
  ])
  assert.deepEqual(preview.replacementListeners[2].current[0].ownership, { role: 'firebase', relationship: 'descendant', recordedPid: 101 })
  assert.deepEqual(preview.proposedLaunch.args, ['.SYSTEMX/LAN/dev-session.mjs', '--fixed-origin', '--host', '127.0.0.1', '--port', '5173'])
  assert.equal(preview.proposedLaunch.environment.SYSTEMX_FIREBASE_AUTH_PORT, '9099')
  assert.doesNotMatch(JSON.stringify(preview), /PRIVATE_|firebase-private|emulator\.jar|npm-cli/)
})

test('PID reuse, a repository path in an unrelated command, or a mismatched CWD refuses ownership', () => {
  for (const mutate of [
    ({ observations }) => { observations.get(103).startedAt = 'different-start' },
    ({ observations }) => { observations.get(103).command = `node other-project.mjs --notes ${fixtureRoot}` },
    ({ observations }) => { observations.get(103).cwd = resolve(tmpdir(), 'another-project') },
    ({ observations }) => { observations.get(103).parentPid = 999 },
  ]) {
    const data = fixture()
    mutate(data)
    const preview = createSessionRestartPreview(data.options)
    assert.equal(preview.canRestart, false)
    assert.ok(preview.reasons.includes('vite-ownership-unverified'))
  }
})

test('a recorded owner PID and relative launcher cannot establish ownership without the repository CWD', () => {
  const { session, observations, options } = fixture()
  delete session.processIdentities
  observations.get(100).command = 'node .SYSTEMX/LAN/dev-session.mjs'
  observations.get(100).cwd = '/unrelated/repository'
  const preview = createSessionRestartPreview(options)
  assert.equal(preview.canRestart, false)
  assert.ok(preview.reasons.includes('supervisor-ownership-unverified'))
  assert.ok(preview.processes.every(({ state }) => state !== 'owned'))
})

test('legacy records require live command, CWD, and supervisor relationship evidence', () => {
  const { session, options } = fixture()
  delete session.processIdentities
  const preview = createSessionRestartPreview(options)
  assert.equal(preview.canRestart, true)
  assert.ok(preview.processes.every(({ identity }) => identity === 'legacy-no-start-fingerprint'))
})

test('unrelated listeners remain visible and block the proposal without exposing their command', () => {
  const { listeners, observations, options } = fixture()
  listeners.push({ host: '::1', port: 8080, pid: 500 })
  observations.set(500, { pid: 500, exists: true, parentPid: 1, command: 'PRIVATE_PROCESS_COMMAND', cwd: '/other-project' })
  const preview = createSessionRestartPreview(options)
  assert.equal(preview.status, 'refused')
  assert.ok(preview.reasons.includes('firestore-listener-owned-by-unverified-process'))
  assert.deepEqual(preview.replacementListeners[3].current, [{ pid: 500, address: '::1', ownership: { role: 'unverified' } }])
  assert.doesNotMatch(JSON.stringify(preview), /PRIVATE_PROCESS_COMMAND|other-project/)
})

test('invalid records, unknown identities and unavailable listener snapshots refuse the plan', () => {
  const noSession = createSessionRestartPreview({ repoRoot: fixtureRoot, session: null })
  assert.equal(noSession.canRestart, false)
  assert.deepEqual(noSession.reasons, ['no-owned-session-record'])
  for (const mutate of [
    (data) => { data.session.processes.vite = '103; arbitrary command' },
    (data) => { data.session.processes.vite = data.session.processes.lan },
    (data) => { data.session.processes.additional = 999 },
    (data) => { data.session.ports.firebase.auth = data.session.ports.app },
    (data) => { data.session.ports.app = 70000 },
    (data) => { data.session.host = '0.0.0.0' },
    (data) => { data.options.inspectProcess = () => null },
    (data) => { data.options.inspectListeners = () => ({ complete: false, listeners: [] }) },
    (data) => { data.options.inspectListeners = () => ({ complete: true, listeners: 'invalid' }) },
  ]) {
    const data = fixture()
    mutate(data)
    assert.equal(createSessionRestartPreview(data.options).canRestart, false)
  }
})

test('query adapters use argument arrays, parse macOS metadata, and never return raw commands in captured identity', () => {
  const calls = []
  const run = (executable, args) => {
    calls.push({ executable, args })
    return executable === 'ps' ? ' 50 Thu Oct 15 09:44:33 2026 node /repo/.SYSTEMX/LAN/dev-session.mjs --token=PRIVATE' : 'p100\nn/repo'
  }
  const observed = inspectSessionProcess(100, { platform: 'darwin', run })
  assert.equal(observed.cwd, '/repo')
  assert.equal(observed.parentPid, 50)
  const identity = captureSessionProcessIdentity(100, { platform: 'darwin', run })
  assert.equal(identity.commandHash, hash(observed.command))
  assert.doesNotMatch(JSON.stringify(identity), /PRIVATE|node|repo/)
  assert.ok(calls.every(({ args }) => Array.isArray(args)))
  const callsBefore = calls.length
  assert.equal(inspectSessionProcess('100; bad', { run }).issue, 'invalid-pid')
  assert.equal(calls.length, callsBefore)
})

test('Windows adapters parse CIM identities and Get-NetTCPConnection listeners with argument arrays', () => {
  const calls = []
  const options = { platform: 'win32', run: (executable, args) => {
    calls.push({ executable, args })
    return args.at(-1).includes('Get-CimInstance')
      ? JSON.stringify({ pid: 100, parentPid: 50, startedAt: '2026-10-15T00:00:00Z', command: 'node C:\\repo\\.SYSTEMX\\LAN\\dev-session.mjs' })
      : JSON.stringify([{ LocalAddress: '127.0.0.1', LocalPort: 5173, OwningProcess: 100 }])
  } }
  const identity = captureSessionProcessIdentity(100, options)
  assert.equal(identity.pid, 100)
  assert.equal(identity.commandHash.length, 64)
  assert.deepEqual(inspectSessionListeners(options), { complete: true, listeners: [{ host: '127.0.0.1', port: 5173, pid: 100 }] })
  assert.ok(calls.every(({ executable, args }) => executable === 'powershell.exe' && Array.isArray(args) && args.includes('-NonInteractive')))
})

test('Windows preview requires a matching captured identity when CWD cannot be queried', () => {
  const data = fixture()
  const windowsRoot = 'C:\\repo'
  data.options.repoRoot = windowsRoot
  data.options.platform = 'win32'
  data.session.runtime.firebaseConfig = 'C:\\repo\\.SYSTEMX\\state\\firebase-private.json'
  for (const [role, pid] of Object.entries(data.session.processes)) {
    const observed = data.observations.get(pid)
    observed.cwd = null
    observed.command = role === 'firebase'
      ? 'node firebase-tools emulators:start --config C:\\repo\\.SYSTEMX\\state\\firebase-private.json'
      : `node C:\\repo\\${role === 'session' ? '.SYSTEMX\\LAN\\dev-session.mjs' : role === 'lan' ? '.SYSTEMX\\LAN\\server.mjs' : 'node_modules\\vite\\bin\\vite.js'}`
    data.session.processIdentities[role].commandHash = hash(observed.command)
  }
  assert.equal(createSessionRestartPreview(data.options).canRestart, true)
  delete data.session.processIdentities
  assert.equal(createSessionRestartPreview(data.options).canRestart, false)
})

test('Windows npm relative launcher uses recorded startup CWD only with its matching birth and command fingerprint', () => {
  const data = fixture()
  data.options.repoRoot = 'C:\\repo'
  data.options.platform = 'win32'
  data.session.runtime.firebaseConfig = 'C:\\repo\\.SYSTEMX\\state\\firebase-private.json'
  for (const [role, pid] of Object.entries(data.session.processes)) {
    const observed = data.observations.get(pid)
    observed.cwd = null
    observed.command = role === 'session' ? 'node .SYSTEMX/LAN/dev-session.mjs'
      : role === 'firebase' ? 'node C:\\npm\\npm-cli.js exec --no -- firebase-tools emulators:start --config C:\\repo\\.SYSTEMX\\state\\firebase-private.json'
        : `node C:\\repo\\${role === 'lan' ? '.SYSTEMX\\LAN\\server.mjs' : 'node_modules\\vite\\bin\\vite.js'}`
    data.session.processIdentities[role] = captureSessionProcessIdentity(pid, {
      platform: 'win32', workingDirectory: 'C:\\repo', run: () => JSON.stringify(observed),
    })
  }
  const preview = createSessionRestartPreview(data.options)
  assert.equal(preview.canRestart, true)
  assert.equal(preview.processes[0].workingDirectory, 'recorded-startup-repository')
  data.session.processIdentities.session.workingDirectory = 'C:\\different-repo'
  assert.equal(createSessionRestartPreview(data.options).canRestart, false)
  data.session.processIdentities.session.workingDirectory = 'C:\\repo'
  data.observations.get(100).startedAt = 'reused-pid-start'
  assert.equal(createSessionRestartPreview(data.options).canRestart, false)
  delete data.session.processIdentities
  assert.equal(createSessionRestartPreview(data.options).canRestart, false)
})

test('listener query failures remain unknown and empty successful snapshots are supported', () => {
  const run = () => { throw Object.assign(new Error('missing tool'), { code: 'ENOENT' }) }
  assert.equal(inspectSessionListeners({ platform: 'darwin', run }).complete, false)
  assert.deepEqual(inspectSessionListeners({ platform: 'darwin', run: () => { throw { status: 1, stdout: '', stderr: '' } } }), { complete: true, listeners: [] })
  assert.deepEqual(inspectSessionListeners({ platform: 'darwin', run: () => 'p100\nn127.0.0.1:5173\np200\nn[::1]:7331' }).listeners, [
    { host: '127.0.0.1', port: 5173, pid: 100 }, { host: '[::1]', port: 7331, pid: 200 },
  ])
})

test('query errors with empty stdout and access-denied stderr remain unknown on macOS and Windows', () => {
  for (const platform of ['darwin', 'win32']) {
    for (const stderr of ['Access denied', '']) {
      const observed = inspectSessionProcess(100, { platform, run: () => { throw { status: 1, stdout: '', stderr } } })
      assert.equal(observed.exists, platform === 'darwin' && !stderr ? false : null)
    }
  }
  assert.equal(inspectSessionProcess(100, { platform: 'win32', run: () => 'null' }).exists, false)
})

test('stop plans signal only a verified supervisor and retain cleanup for its lifecycle', () => {
  const { options } = fixture()
  const signals = []
  let cleanups = 0
  const stop = executeSessionStopPlan({ ...options, signalProcess: (...args) => signals.push(args), cleanupSession: () => { cleanups += 1 } })
  assert.equal(stop.canStop, true)
  assert.equal(stop.status, 'stop-requested')
  assert.deepEqual(signals, [[100, 'SIGTERM']])
  assert.equal(cleanups, 0)
})

test('unverified members, PID reuse, and denied metadata refuse all stop signals and cleanup', () => {
  for (const mutate of [
    ({ observations }) => { observations.get(103).command = `node unrelated.mjs --notes ${fixtureRoot}` },
    ({ session, observations }) => {
      observations.get(103).command = `node unrelated.mjs --notes ${fixtureRoot}/node_modules/vite/bin/vite.js`
      session.processIdentities.vite.commandHash = hash(observations.get(103).command)
    },
    ({ observations }) => { observations.get(103).startedAt = 'reused-pid' },
    ({ observations }) => { observations.get(100).cwd = '/another-project' },
    ({ options }) => { options.inspectProcess = () => ({ exists: null, issue: 'access-denied' }) },
  ]) {
    const data = fixture()
    mutate(data)
    let signals = 0
    let cleanups = 0
    const stop = executeSessionStopPlan({ ...data.options, signalProcess: () => { signals += 1 }, cleanupSession: () => { cleanups += 1 } })
    assert.equal(stop.canStop, false)
    assert.equal(signals, 0)
    assert.equal(cleanups, 0)
  }
})

test('failed supervisor signals preserve state and fully exited sessions permit bounded cleanup', () => {
  const { options } = fixture()
  let cleanups = 0
  const failed = executeSessionStopPlan({ ...options, signalProcess: () => { throw new Error('access denied') }, cleanupSession: () => { cleanups += 1 } })
  assert.equal(failed.canStop, false)
  assert.equal(cleanups, 0)
  const stopped = executeSessionStopPlan({ ...options, inspectProcess: (pid) => ({ pid, exists: false }), signalProcess: () => assert.fail('must not signal exited processes'), cleanupSession: () => { cleanups += 1 } })
  assert.equal(stopped.canStop, true)
  assert.equal(stopped.status, 'cleared-exited-session')
  assert.equal(cleanups, 1)
})

test('standalone LAN stop requires its own server command, repository CWD, and self-owned PID', () => {
  const { session, options, observations } = fixture()
  session.mode = 'lan-only'
  session.ownerPid = 102
  session.processes = { lan: 102 }
  assert.deepEqual(createSessionStopPlan(options).targets, [{ role: 'lan', pid: 102 }])
  delete session.processIdentities
  assert.equal(createSessionStopPlan(options).canStop, true)
  observations.get(102).cwd = '/another-project'
  assert.equal(createSessionStopPlan(options).canStop, false)
  observations.get(102).cwd = fixtureRoot
  session.ownerPid = 999
  assert.equal(createSessionStopPlan(options).canStop, false)
})

test('Windows standalone LAN schema uses its captured startup CWD and refuses legacy missing identity', () => {
  const data = fixture()
  data.options.platform = 'win32'
  data.options.repoRoot = 'C:\\repo'
  data.session.mode = 'lan-only'
  data.session.ownerPid = 102
  data.session.processes = { lan: 102 }
  const observed = { pid: 102, exists: true, parentPid: 80, startedAt: 'start-102', cwd: null, command: 'node .SYSTEMX/LAN/server.mjs' }
  data.observations.set(102, observed)
  data.session.processIdentities = { lan: captureSessionProcessIdentity(102, {
    platform: 'win32', workingDirectory: 'C:\\repo', run: () => JSON.stringify(observed),
  }) }
  assert.deepEqual(createSessionStopPlan(data.options).targets, [{ role: 'lan', pid: 102 }])
  delete data.session.processIdentities
  assert.equal(createSessionStopPlan(data.options).canStop, false)
})

test('Windows combined stop refuses forced termination and cleanup with owning-terminal guidance', () => {
  const data = fixture()
  data.options.platform = 'win32'
  for (const inspectProcess of [data.options.inspectProcess, (pid) => ({ pid, exists: false })]) {
    let signals = 0
    let cleanups = 0
    const plan = executeSessionStopPlan({
      ...data.options, inspectProcess, signalProcess: () => { signals += 1 }, cleanupSession: () => { cleanups += 1 },
    })
    assert.equal(plan.canStop, false)
    assert.match(plan.guidance, /Ctrl\+C/)
    assert.deepEqual(plan.reasons, ['windows-combined-stop-requires-owning-terminal'])
    assert.equal(signals, 0)
    assert.equal(cleanups, 0)
  }
})

test('runtime cleanup refuses symlink escapes before changing the config or session record', () => {
  const root = mkdtempSync(join(tmpdir(), 'systemx-cleanup-'))
  const state = join(root, '.SYSTEMX/state')
  const external = join(root, 'external')
  mkdirSync(state, { recursive: true })
  mkdirSync(external)
  const externalConfig = join(external, 'firebase-external.json')
  const record = join(state, 'local-session.json')
  writeFileSync(externalConfig, 'PRIVATE_EXTERNAL_CONFIG')
  writeFileSync(record, 'PRIVATE_SESSION_RECORD')
  symlinkSync(external, join(state, 'escaped'), process.platform === 'win32' ? 'junction' : 'dir')
  try {
    const escaped = { runtime: { firebaseConfig: join(state, 'escaped/firebase-external.json') } }
    assert.equal(sessionRuntimeCleanupTarget(root, escaped).allowed, false)
    assert.equal(readFileSync(externalConfig, 'utf8'), 'PRIVATE_EXTERNAL_CONFIG')
    assert.equal(readFileSync(record, 'utf8'), 'PRIVATE_SESSION_RECORD')
    const ownedConfig = join(state, 'firebase-owned.json')
    writeFileSync(ownedConfig, '{}')
    assert.deepEqual(sessionRuntimeCleanupTarget(root, { runtime: { firebaseConfig: ownedConfig } }), { allowed: true, path: ownedConfig })
    // Directory junctions need no Windows developer-mode privileges; the
    // additional file-symlink case runs on platforms that allow ordinary links.
    if (process.platform !== 'win32') {
      symlinkSync(externalConfig, join(state, 'firebase-linked.json'))
      assert.equal(sessionRuntimeCleanupTarget(root, { runtime: { firebaseConfig: join(state, 'firebase-linked.json') } }).allowed, false)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI preview preserves a live fixture process, bound listener, session, token and runtime config byte for byte', { skip: process.platform === 'win32', timeout: 15000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'systemx-preview-'))
  const lanRoot = join(root, '.SYSTEMX/LAN')
  const stateRoot = join(root, '.SYSTEMX/state')
  mkdirSync(join(lanRoot, 'Builder/runtime'), { recursive: true })
  mkdirSync(stateRoot, { recursive: true })
  for (const name of ['session-control.mjs', 'session-restart-preview.mjs', 'Builder/runtime/port-utils.mjs']) copyFileSync(join(repoRoot, '.SYSTEMX/LAN', name), join(lanRoot, name))
  writeFileSync(join(lanRoot, 'dev-session.mjs'), "import net from 'node:net'; const server=net.createServer(); server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));\n")
  const child = spawn(process.execPath, [join(lanRoot, 'dev-session.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const port = await new Promise((resolvePort, rejectPort) => {
      const timer = setTimeout(() => rejectPort(new Error('fixture startup timed out')), 3000)
      child.stdout.once('data', (value) => { clearTimeout(timer); resolvePort(JSON.parse(String(value)).port) })
      child.once('error', rejectPort)
    })
    const identity = captureSessionProcessIdentity(child.pid)
    assert.ok(identity)
    const absentPids = []
    for (let candidate = 99990; absentPids.length < 3 && candidate > 99890; candidate -= 1) {
      if (inspectSessionProcess(candidate).exists === false) absentPids.push(candidate)
    }
    assert.equal(absentPids.length, 3, 'fixture needs three confirmed absent PIDs')
    const session = {
      ownerPid: child.pid, processes: { session: child.pid, firebase: absentPids[0], lan: absentPids[1], vite: absentPids[2] },
      processIdentities: { session: identity }, host: '127.0.0.1',
      ports: { app: port, lan: 63541, firebase: { auth: 63542, firestore: 63543, storage: 63544 } },
      runtime: { firebaseConfig: join(stateRoot, 'firebase-fixture.json') }, token: 'PRIVATE_TOKEN_SENTINEL',
    }
    writeFileSync(join(stateRoot, 'local-session.json'), JSON.stringify(session))
    writeFileSync(session.runtime.firebaseConfig, '{"PRIVATE_CONFIG_SENTINEL":true}')
    writeFileSync(join(stateRoot, 'session-token'), 'PRIVATE_TOKEN_FILE_SENTINEL')
    const snapshot = () => Object.fromEntries(readdirSync(stateRoot).map((name) => [name, readFileSync(join(stateRoot, name), 'utf8')]))
    const before = snapshot()
    const stdout = execFileSync(process.execPath, [join(lanRoot, 'session-control.mjs'), 'restart', '--preview'], { cwd: root, encoding: 'utf8', timeout: 10000 })
    const preview = JSON.parse(stdout)
    assert.equal(preview.status, 'ready-for-review')
    assert.equal(preview.replacementListeners[0].state, 'release-required')
    assert.equal(preview.processes[0].state, 'owned')
    assert.doesNotMatch(stdout, /PRIVATE_|firebase-fixture/)
    assert.deepEqual(snapshot(), before)
    assert.equal(inspectSessionProcess(child.pid).exists, true)
    assert.ok(inspectSessionListeners().listeners.some((entry) => entry.pid === child.pid && entry.port === port))
    session.processIdentities.session.commandHash = 'not-the-live-command-fingerprint'
    writeFileSync(join(stateRoot, 'local-session.json'), JSON.stringify(session))
    const beforeRefusedStop = snapshot()
    try {
      execFileSync(process.execPath, [join(lanRoot, 'session-control.mjs'), 'stop'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
      assert.fail('stop must refuse a mismatched live identity')
    } catch (error) {
      assert.equal(error.status, 1)
      assert.equal(JSON.parse(error.stderr).status, 'refused')
    }
    assert.deepEqual(snapshot(), beforeRefusedStop)
    assert.equal(inspectSessionProcess(child.pid).exists, true)
    assert.ok(inspectSessionListeners().listeners.some((entry) => entry.pid === child.pid && entry.port === port))
    try {
      execFileSync(process.execPath, [join(lanRoot, 'session-control.mjs'), 'restart'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
      assert.fail('a restart without --preview must fail')
    } catch (error) { assert.equal(error.status, 2) }
    assert.deepEqual(snapshot(), beforeRefusedStop)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolveExit) => child.exitCode !== null ? resolveExit() : child.once('exit', resolveExit))
    rmSync(root, { recursive: true, force: true })
  }
})
