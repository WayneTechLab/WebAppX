import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  claimSession, cleanStalePidFiles, clearExitedSession, clearSession,
  readSession, sessionPath, writeSession,
} from '../Builder/runtime/port-utils.mjs'

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-session-cleanup-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.SYSTEMX', 'state'), { recursive: true })
  return root
}

test('ordinary record updates and clears require the live writer and its locally acquired generation', t => {
  const root = fixture(t)
  const recorded = { ownerPid: process.pid, sessionId: 'previous-process-with-this-pid' }
  writeFileSync(sessionPath(root), JSON.stringify(recorded))
  assert.throws(() => writeSession(root, recorded), /another generation/)
  assert.equal(clearSession(root, recorded.sessionId), false)
  assert.deepEqual(readSession(root), recorded)
  assert.equal(clearExitedSession(root, recorded, () => {}), true)
  const current = { ownerPid: process.pid, sessionId: 'fixture-current' }
  claimSession(root, current)
  writeSession(root, { ...current, readiness: 'recorded' })
  assert.equal(readSession(root).readiness, 'recorded')
  assert.equal(clearSession(root, recorded.sessionId), false)
  assert.equal(clearSession(root, current.sessionId), true)
})

test('a competing launcher waits for exited cleanup and a later stale cleanup preserves its new generation', { timeout: 12_000 }, async t => {
  const root = fixture(t)
  const old = { sessionId: 'exited-fixture', ownerPid: 84 }
  writeFileSync(sessionPath(root), JSON.stringify(old))
  const moduleUrl = new URL('../Builder/runtime/port-utils.mjs', import.meta.url).href
  const file = join(root, 'new-launcher.mjs')
  const start = join(root, 'cleanup-in-progress')
  const attempted = join(root, 'attempting')
  writeFileSync(file, `
    import { once } from 'node:events'
    import { existsSync, writeFileSync } from 'node:fs'
    import { setTimeout as delay } from 'node:timers/promises'
    import { claimSession, clearSession } from ${JSON.stringify(moduleUrl)}
    const [root, start, attempting] = process.argv.slice(2)
    process.send('ready')
    while (!existsSync(start)) await delay(5)
    writeFileSync(attempting, '')
    try {
      claimSession(root, { sessionId: 'fresh-fixture', ownerPid: process.pid })
      const release = once(process, 'message')
      process.send('claimed')
      await release
      process.exitCode = clearSession(root, 'fresh-fixture') ? 0 : 1
    } catch (error) { process.send(error.code ?? error.message); process.exitCode = 1 }
    process.disconnect()
  `)
  const child = fork(file, [root, start, attempted], { cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  const exited = once(child, 'exit')
  try {
    assert.equal((await once(child, 'message', { signal: AbortSignal.timeout(5000) }))[0], 'ready')
    const claimResult = once(child, 'message', { signal: AbortSignal.timeout(5000) })
    assert.equal(clearExitedSession(root, old, () => {
      writeFileSync(start, '')
      const deadline = performance.now() + 900
      const sleep = new Int32Array(new SharedArrayBuffer(4))
      while (!existsSync(attempted) && performance.now() < deadline) Atomics.wait(sleep, 0, 0, 5)
      assert.ok(existsSync(attempted), 'The new launcher attempted a claim during the cleanup callback')
      Atomics.wait(sleep, 0, 0, 50)
      assert.deepEqual(readSession(root), old)
    }), true)
    assert.equal((await claimResult)[0], 'claimed')
    const fresh = { ownerPid: child.pid, sessionId: 'fresh-fixture' }
    assert.deepEqual(readSession(root), fresh)
    assert.equal(clearExitedSession(root, old, () => assert.fail('Stale cleanup cannot touch a new generation’s configuration')), false)
    assert.equal(clearSession(root, fresh.sessionId), false)
    assert.deepEqual(readSession(root), fresh)
    child.send('release')
    assert.deepEqual(await exited, [0, null])
    assert.equal(existsSync(sessionPath(root)), false)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await exited
  }
})

test('interrupted mutation and failed cleanup preserve the original record and expose the blocker', t => {
  const root = fixture(t)
  const old = { sessionId: 'old-fixture', ownerPid: 44 }
  const target = sessionPath(root), guard = target + '.lock'
  writeFileSync(target, JSON.stringify(old))
  assert.throws(() => clearExitedSession(root, old, () => { throw new Error('configuration unavailable') }), /configuration unavailable/)
  assert.equal(existsSync(guard), false)
  writeFileSync(guard, '11\n')
  assert.throws(() => clearExitedSession(root, old), { code: 'SESSION_RECORD_BUSY' })
  assert.equal(readFileSync(guard, 'utf8'), '11\n')
  assert.deepEqual(readSession(root), old)
})

test('stale PID sweep preserves unrelated names, denied probes, malformed values and links', t => {
  const root = fixture(t)
  const state = join(root, '.SYSTEMX', 'state')
  const files = {
    'local-vite-5701.pid': '9121\n', 'local-lan-5702.pid': '9122\r\n',
    'unrelated.pid': '9123\n', 'local-vite-70000.pid': '9124\n',
    'local-vite-5703.pid': '9125other\n', 'local-vite-5704.pid': '9126\n',
  }
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(state, name), bytes)
  if (process.platform !== 'win32') symlinkSync(join(state, 'unrelated.pid'), join(state, 'local-lan-5705.pid'))
  const probes = []
  const removed = cleanStalePidFiles(root, pid => {
    probes.push(pid)
    if (pid !== 9126) throw Object.assign(new Error('fixture probe'), { code: pid === 9122 ? 'EPERM' : 'ESRCH' })
  })
  assert.deepEqual(probes.sort(), [9121, 9122, 9126])
  assert.deepEqual(removed, ['local-vite-5701.pid'])
  assert.equal(existsSync(join(state, removed[0])), false)
  for (const [name, bytes] of Object.entries(files)) {
    if (name !== removed[0]) assert.equal(readFileSync(join(state, name), 'utf8'), bytes)
  }
  if (process.platform !== 'win32') assert.equal(readFileSync(join(state, 'local-lan-5705.pid'), 'utf8'), files['unrelated.pid'])
})
