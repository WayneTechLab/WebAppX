import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../session-portable.mjs', import.meta.url))
const privateMarker = 'fixture-private-field-must-stay-local'

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-portable-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.SYSTEMX', 'LAN'), { recursive: true })
  const state = join(root, '.SYSTEMX', 'state')
  mkdirSync(state)
  return { root, state, record: join(state, 'local-session.json') }
}

function run(fixture, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: fixture.root, encoding: 'utf8', timeout: 8_000,
    env: { ...process.env, SESSION_PORTABLE_TEST_SENTINEL: privateMarker },
  })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  for (const marker of [privateMarker, fixture.root]) {
    assert.ok(!result.stdout.includes(marker) && !result.stderr.includes(marker), 'portable CLI omitted private values and paths')
  }
  return result
}

function success(fixture, ...args) {
  const { status, stdout, stderr } = run(fixture, ...args)
  assert.equal(status, 0, stderr)
  return JSON.parse(stdout)
}

test('preferences round trip across CLI processes, stay workspace-local, and clear without touching the session', t => {
  const a = workspace(t), b = workspace(t)
  const previous = JSON.stringify({ token: privateMarker, ownerPid: process.pid, mode: 'legacy' })
  writeFileSync(a.record, previous)
  assert.equal(success(a, 'preferences', 'get').status, 'absent')
  const saved = success(a, 'preferences', 'set', '--port', '47221', '--layout', 'tablet-820')
  assert.equal(saved.status, 'saved')
  assert.deepEqual(saved.preferences, { port: 47221, layout: 'tablet-820' })
  const loaded = success(a, 'preferences', 'get')
  assert.equal(loaded.status, 'available')
  assert.deepEqual(loaded.preferences, saved.preferences)
  const updated = success(a, 'preferences', 'set', '--layout', 'ios-393')
  assert.deepEqual(updated.preferences, { port: 47221, layout: 'ios-393' })
  const portableRecord = JSON.parse(readFileSync(join(a.state, 'local-session-preferences.json'), 'utf8'))
  assert.deepEqual(portableRecord, { schemaVersion: 1, port: 47221, layout: 'ios-393' })
  assert.equal(success(b, 'preferences', 'get').status, 'absent')
  assert.equal(success(a, 'preferences', 'clear').status, 'cleared')
  assert.equal(success(a, 'preferences', 'get').status, 'absent')
  assert.equal(readFileSync(a.record, 'utf8'), previous)
  assert.equal(existsSync(b.record), false)
})

test('unrecognized preference fields and invalid values refuse without replacing a saved choice', t => {
  const a = workspace(t)
  const previous = success(a, 'preferences', 'set', '--port', '47222').preferences
  for (const options of [
    ['--port', '99999'], ['--port', '47223', '--port', '47224'],
    ['--layout', privateMarker], ['--token', privateMarker], ['--owner-pid', String(process.pid)],
    ['--generation', 'systemx-' + randomUUID()], ['--port', '47223', '--session', privateMarker],
  ]) {
    assert.notEqual(run(a, 'preferences', 'set', ...options).status, 0)
  }
  assert.deepEqual(success(a, 'preferences', 'get').preferences, previous)
  assert.equal(existsSync(a.record), false)
})

test('diagnostics export distinguishes recorded, active, and service readiness for an unowned process', t => {
  const a = workspace(t)
  const generation = 'systemx-' + randomUUID(), port = 47223, origin = 'http://127.0.0.1:' + port
  const record = {
    schemaVersion: 1, mode: 'combined', sessionId: generation, ownerPid: process.pid,
    processes: { session: process.pid }, processIdentities: { session: {
      pid: process.pid, startedAt: 'previous-session-birth', parentPid: 1, commandHash: 'a'.repeat(64), workingDirectory: a.root,
    } },
    host: '127.0.0.1', origin: { url: origin, port, scheme: 'http', host: '127.0.0.1' },
    ports: { app: port, lan: 47224, firebase: { auth: 47225, firestore: 47226, storage: 47227 }, [privateMarker]: 47228 },
    urls: { app: origin + '/', private: 'http://example.invalid/' + privateMarker },
    token: privateMarker, environment: { EXAMPLE: privateMarker }, command: [privateMarker], workspace: a.root,
    readiness: { app: { status: 'ready', message: privateMarker, url: 'http://example.invalid/' + privateMarker },
      auth: { status: 'failed', message: privateMarker }, [privateMarker]: { status: 'ready' } },
    privateApplicationData: { fixture: privateMarker.repeat(800) },
  }
  const bytes = JSON.stringify(record)
  writeFileSync(a.record, bytes)
  const exported = success(a, 'diagnostics', 'export')
  assert.equal(exported.schemaVersion, 1)
  assert.equal(exported.kind, 'systemx-session-diagnostics')
  assert.equal(exported.session.generation, generation)
  assert.notEqual(exported.session.ownership, 'owned')
  assert.equal(exported.session.recordedOrigin, origin)
  assert.equal(exported.session.activeOrigin, null)
  assert.equal(exported.ports.app, port)
  assert.ok(exported.processes.some(item => item.role === 'session' && item.pid === process.pid && item.ownership !== 'owned'))
  assert.equal(exported.readiness.app, 'ready')
  assert.equal(exported.readiness.auth, 'failed')
  assert.ok(Object.hasOwn(exported, 'nextAction'))
  assert.equal(Object.hasOwn(exported.ports, privateMarker), false)
  assert.equal(Object.hasOwn(exported.readiness, privateMarker), false)
  assert.ok(Buffer.byteLength(JSON.stringify(exported)) < 8192)
  assert.equal(readFileSync(a.record, 'utf8'), bytes)
  assert.deepEqual(readdirSync(a.state), ['local-session.json'])
})

test('a workspace with no record exports an offline observation even with saved preferences', t => {
  const a = workspace(t)
  success(a, 'preferences', 'set', '--port', '47229')
  const result = success(a, 'diagnostics', 'export')
  assert.equal(result.session.ownership, 'absent')
  assert.equal(result.session.generation, null)
  assert.equal(result.session.activeOrigin, null)
  assert.equal(result.session.recordedOrigin, null)
  assert.deepEqual(result.processes, [])
  assert.ok(!JSON.stringify(result).includes('47229'))
  assert.equal(existsSync(a.record), false)
})

test('a linked runtime directory cannot redirect preference writes to another workspace', t => {
  const a = workspace(t), b = workspace(t)
  const kept = success(b, 'preferences', 'set', '--port', '47230').preferences
  rmSync(a.state, { recursive: true })
  symlinkSync(b.state, a.state, process.platform === 'win32' ? 'junction' : 'dir')
  const result = run(a, 'preferences', 'set', '--port', '47231')
  assert.notEqual(result.status, 0)
  assert.deepEqual(success(b, 'preferences', 'get').preferences, kept)
})

test('malformed and oversized preference records return bounded private-field-free refusals', t => {
  const a = workspace(t)
  const path = join(a.state, 'local-session-preferences.json')
  for (const contents of ['{' + privateMarker, JSON.stringify({ schemaVersion: 1, layout: privateMarker.repeat(6000) })]) {
    writeFileSync(path, contents)
    const result = run(a, 'preferences', 'get')
    assert.notEqual(result.status, 0)
    assert.ok(Buffer.byteLength(result.stdout + result.stderr) < 8192)
    assert.equal(readFileSync(path, 'utf8'), contents)
  }
  assert.equal(success(a, 'preferences', 'clear').status, 'cleared')
  assert.equal(success(a, 'preferences', 'get').status, 'absent')
})

test('linked and oversized session records keep diagnostics bounded and leave the source intact', t => {
  const a = workspace(t), b = workspace(t)
  const bytes = JSON.stringify({ token: privateMarker, readiness: { app: { status: 'ready' } } })
  writeFileSync(b.record, bytes)
  symlinkSync(b.record, a.record)
  function inspectUnverified() {
    const result = run(a, 'diagnostics', 'export')
    assert.ok(Buffer.byteLength(result.stdout + result.stderr) < 8192)
    if (result.status === 0) {
      const report = JSON.parse(result.stdout)
      assert.equal(report.session.generation, null)
      assert.equal(report.session.activeOrigin, null)
      assert.equal(report.session.ownership, 'unverified')
      assert.notEqual(report.readiness.app, 'ready')
    } else {
      assert.equal(JSON.parse(result.stdout || result.stderr).status, 'refused')
    }
  }
  inspectUnverified()
  assert.equal(readFileSync(b.record, 'utf8'), bytes)
  rmSync(a.record)
  const oversized = privateMarker.repeat(40_000)
  writeFileSync(a.record, oversized)
  inspectUnverified()
  assert.equal(readFileSync(a.record, 'utf8'), oversized)
})
