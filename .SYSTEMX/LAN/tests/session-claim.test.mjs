import assert from 'node:assert/strict'
import { fork, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { claimSession, clearExitedSession, readSession, sessionPath, writeSession } from '../Builder/runtime/port-utils.mjs'
import { startDevSession } from '../dev-session.mjs'
import { createSessionStartPreview } from '../session-start-preview.mjs'
import { readSessionClaim } from '../session-claim.mjs'
import { executeSessionStopPlan } from '../session-restart-preview.mjs'
import { parseSessionOptions } from '../session-supervisor.mjs'

const generation = () => 'systemx-' + randomUUID()
const digest = value => createHash('sha256').update(value).digest('hex')
const launcherModule = new URL('../dev-session.mjs', import.meta.url).href

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-session-claim-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.SYSTEMX', 'LAN'), { recursive: true })
  mkdirSync(join(root, 'node_modules', 'vite', 'bin'), { recursive: true })
  writeFileSync(join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '// Fixture Vite entry.\n')
  writeFileSync(join(root, 'firebase.json'), '{}')
  return root
}

function oldRecord(root) {
  const pid = 321
  const command = 'node ' + join(root, '.SYSTEMX', 'LAN', 'dev-session.mjs')
  const observed = { pid, parentPid: 42, exists: true, startedAt: 'fixture process birth', command, cwd: root }
  const identity = { pid, parentPid: 42, startedAt: observed.startedAt, commandHash: digest(command), workingDirectory: root }
  const session = {
    sessionId: generation(), mode: 'combined', ownerPid: pid, processes: { session: pid },
    processIdentities: { session: identity }, origin: { url: 'http://localhost:5191' },
  }
  mkdirSync(join(root, '.SYSTEMX', 'state'), { recursive: true })
  writeFileSync(sessionPath(root), JSON.stringify(session))
  return { session, observed }
}

function message(child) {
  return once(child, 'message', { signal: AbortSignal.timeout(10_000) }).then(([value]) => value)
}

test('two OS launchers pass the same port planning barrier and only one claims and spawns', { timeout: 20_000 }, async t => {
  const root = workspace(t)
  // Both fixture launchers execute the real supervisor and filesystem claim. The
  // injected process table and service handles avoid Firebase, Vite or any listener.
  const source = `
    import { once, EventEmitter } from 'node:events'
    import { PassThrough } from 'node:stream'
    import { createHash } from 'node:crypto'
    import { startDevSession } from ${JSON.stringify(launcherModule)}
    const root = process.cwd(), command = 'node ' + process.argv[1]
    const identity = pid => ({ pid, parentPid: process.ppid, startedAt: 'fixture birth ' + pid,
      commandHash: createHash('sha256').update(command).digest('hex'), workingDirectory: root })
    let arrivals = 0, launches = 0, stops = 0
    const options = { host: 'localhost', fixedOrigin: true, generation: process.argv[2],
      ports: { app: 5188, lan: 7331, auth: 9099, firestore: 8080, storage: 9199 } }
    const deps = {
      repoRoot: root, environment: {}, captureIdentity: identity,
      inspectProcess: pid => ({ pid, exists: true, cwd: root, parentPid: process.ppid, command, startedAt: identity(pid).startedAt }),
      async available() {
        if (arrivals++ === 0) { const go = once(process, 'message'); process.send('planning'); await go }
        return true
      },
      readinessIntervalMs: 0, command: { executable: 'fixture', args: [] }, output: { write() {} }, errors: { write() {} },
      spawnChild() {
        launches++
        return Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null,
          kill() { stops++; this.killed = true } })
      },
    }
    try {
      const owned = await startDevSession(options, deps)
      const release = once(process, 'message')
      process.send({ outcome: 'claimed', pid: process.pid, launches, stops, sessionId: owned.session.sessionId })
      await release
      owned.close()
      process.send({ outcome: 'closed', stops })
    } catch (error) {
      process.send({ outcome: 'refused', pid: process.pid, launches, stops, code: error.code, claim: error.claim })
    }
  `
  const launcher = join(root, '.SYSTEMX', 'LAN', 'dev-session.mjs')
  writeFileSync(launcher, source)
  // Deliberately choose the same preview generation in both clients: the loser
  // must never run cleanup for the owner that did acquire this generation.
  const id = generation()
  const children = [0, 1].map(() => fork(launcher, [id], { cwd: root, execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }))
  const exits = children.map(child => once(child, 'exit'))
  try {
    assert.deepEqual(await Promise.all(children.map(message)), ['planning', 'planning'])
    const results = Promise.all(children.map(message))
    for (const child of children) child.send('proceed')
    const outcomes = await results
    const winnerIndex = outcomes.findIndex(value => value.outcome === 'claimed')
    assert.notEqual(winnerIndex, -1)
    const winner = outcomes[winnerIndex], loser = outcomes[1 - winnerIndex]
    assert.deepEqual(winner, { outcome: 'claimed', pid: children[winnerIndex].pid, launches: 3, stops: 0, sessionId: id })
    assert.equal(loser.outcome, 'refused')
    assert.equal(loser.code, 'SESSION_CLAIM_UNAVAILABLE')
    assert.equal(loser.launches, 0)
    assert.equal(loser.stops, 0)
    assert.deepEqual(loser.claim, { status: 'owned', sessionId: id, ownerPid: winner.pid, origin: 'http://localhost:5188', reasons: [] })
    const record = readSession(root)
    assert.equal(record.ownerPid, winner.pid)
    assert.equal(record.sessionId, id)
    assert.ok(existsSync(record.runtime.firebaseConfig))
    const closed = message(children[winnerIndex])
    children[winnerIndex].send('release')
    assert.deepEqual(await closed, { outcome: 'closed', stops: 3 })
    assert.deepEqual(await Promise.all(exits), [[0, null], [0, null]])
    assert.equal(existsSync(sessionPath(root)), false)
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await Promise.all(exits)
  }
})

test('a reused PID, unknown process table or malformed claim is preserved byte-for-byte', t => {
  const root = workspace(t)
  const { session, observed } = oldRecord(root)
  const before = readFileSync(sessionPath(root))
  for (const inspectProcess of [() => ({ ...observed, startedAt: 'replacement process birth' }), () => ({ exists: null })]) {
    const claim = readSessionClaim(root, { inspectProcess })
    assert.equal(claim.status, 'unverified')
    assert.equal(claim.sessionId, session.sessionId)
    assert.equal(claim.ownerPid, session.ownerPid)
    assert.deepEqual(readFileSync(sessionPath(root)), before)
  }
  assert.throws(() => writeSession(root, { ...session, ownerPid: process.pid, sessionId: generation() }))
  assert.deepEqual(readFileSync(sessionPath(root)), before)
  writeFileSync(sessionPath(root), '{incomplete')
  assert.equal(readSessionClaim(root).status, 'unverified')
  assert.throws(() => claimSession(root, { ...session, ownerPid: process.pid }), { code: 'EEXIST' })
  assert.equal(readFileSync(sessionPath(root), 'utf8'), '{incomplete')
})

test('verified exited records can be cleared before a fresh preview, while orphaned children and unsupported stop stay protected', async t => {
  const root = workspace(t)
  const { session, observed } = oldRecord(root)
  const notPresent = pid => ({ pid, exists: false })
  const seen = readSessionClaim(root, { inspectProcess: notPresent, platform: 'darwin' })
  assert.equal(seen.status, 'exited')
  assert.equal(seen.sessionId, session.sessionId)
  const before = readFileSync(sessionPath(root))
  const windows = readSessionClaim(root, { inspectProcess: notPresent, platform: 'win32' })
  assert.equal(windows.status, 'unverified')
  assert.ok(windows.reasons.includes('windows-combined-stop-requires-owning-terminal'))
  assert.deepEqual(readFileSync(sessionPath(root)), before)
  const recordWithChild = { ...session, processes: { ...session.processes, lan: 322 } }
  writeFileSync(sessionPath(root), JSON.stringify(recordWithChild))
  const orphan = readSessionClaim(root, { inspectProcess: pid => pid === 322 ? { ...observed, pid, parentPid: 1 } : notPresent(pid) })
  assert.equal(orphan.status, 'unverified')
  assert.deepEqual(readSession(root), recordWithChild)
  const result = executeSessionStopPlan({ repoRoot: root, session: recordWithChild, inspectProcess: notPresent, platform: 'darwin',
    signalProcess: () => assert.fail('Exited-session cleanup must not signal any process'),
    cleanupSession: () => assert.equal(clearExitedSession(root, recordWithChild), true),
  })
  assert.equal(result.status, 'cleared-exited-session')
  const preview = await createSessionStartPreview({ repoRoot: root, options: parseSessionOptions(),
    inspectListeners: () => ({ complete: true, listeners: [] }),
  })
  assert.equal(preview.canStart, true)
  assert.notEqual(preview.generation, session.sessionId)
  assert.equal(existsSync(sessionPath(root)), false)
})

test('a port becoming unavailable during planning reports the competing owner; a repeated generation preserves its existing config', async t => {
  const root = workspace(t)
  const options = parseSessionOptions(['--fixed-origin', '--generation', generation()])
  const refuseSpawn = () => assert.fail('This attempt must stop before launching children')
  let existing
  await assert.rejects(startDevSession(options, {
    repoRoot: root, spawnChild: refuseSpawn, inspectProcess: () => existing.observed,
    available: async () => { existing = oldRecord(root); return false },
  }), error => {
    assert.equal(error.code, 'SESSION_CLAIM_UNAVAILABLE')
    assert.equal(error.claim.status, 'owned')
    assert.equal(error.claim.sessionId, existing.session.sessionId)
    return true
  })
  assert.deepEqual(readSession(root), existing.session)
  // A separate workspace contains a leftover same-generation config, without a session claim.
  const second = workspace(t)
  const state = join(second, '.SYSTEMX', 'state')
  mkdirSync(state, { recursive: true })
  const path = join(state, 'firebase-' + options.generation + '.json')
  writeFileSync(path, 'preserve earlier runtime configuration')
  await assert.rejects(startDevSession(options, {
    repoRoot: second, available: async () => true, spawnChild: refuseSpawn, captureIdentity: () => null,
  }), { code: 'EEXIST' })
  assert.equal(readFileSync(path, 'utf8'), 'preserve earlier runtime configuration')
  assert.equal(existsSync(sessionPath(second)), false)
})

test('supervisor loss during first child launch leaves a durable uncertainty marker and prevents cleanup', t => {
  const root = workspace(t)
  const program = `
    import { startDevSession } from ${JSON.stringify(launcherModule)}
    await startDevSession({
      host: 'localhost', fixedOrigin: true, ports: { app: 5100, lan: 7300, auth: 9100, firestore: 8100, storage: 9200 }
    }, {
      repoRoot: process.cwd(), available: async () => true, captureIdentity: () => null,
      spawnChild() { process.exit(23) }
    })
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { cwd: root, timeout: 5000 })
  assert.equal(result.status, 23)
  const session = readSession(root)
  assert.equal(session.startingRole, 'firebase')
  const inspectProcess = pid => ({ pid, exists: false })
  const claim = readSessionClaim(root, { inspectProcess, platform: 'darwin' })
  assert.equal(claim.status, 'unverified')
  assert.ok(claim.reasons.includes('child-launch-outcome-unverified'))
  const plan = executeSessionStopPlan({ repoRoot: root, session, inspectProcess, platform: 'darwin',
    signalProcess: () => assert.fail('Unknown startup must not trigger a signal'),
    cleanupSession: () => assert.fail('Unknown startup must preserve records'),
  })
  assert.equal(plan.canStop, false)
  assert.equal(existsSync(session.runtime.firebaseConfig), true)
})
