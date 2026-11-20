import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSessionStartPreview } from '../session-start-preview.mjs'
import { parseSessionOptions, resolveSessionPorts } from '../session-supervisor.mjs'

const lan = fileURLToPath(new URL('../', import.meta.url))
const absent = { status: 'absent', sessionId: null, ownerPid: null, origin: null, reasons: [] }

function preview(options = parseSessionOptions(), { owner = absent, listeners = [] } = {}) {
  return createSessionStartPreview({
    repoRoot: '/fixture', options, inspectOwnership: () => owner,
    inspectListeners: () => ({ complete: true, listeners }),
  })
}

test('automatic preview allocates a distinct proposal with five disjoint ports, separate from readiness', async () => {
  const options = parseSessionOptions()
  for (const name of Object.keys(options.ports)) options.ports[name] = 48000
  const listeners = [{ host: '127.0.0.1', pid: 10, port: 48000 }]
  const result = await preview(options, { listeners })
  assert.equal(result.canStart, true)
  assert.equal(result.readOnly, true)
  assert.equal(result.previousSession.status, 'absent')
  assert.equal(result.readiness, 'not-started')
  assert.equal(result.selection, 'automatic')
  assert.match(result.generation, /^systemx-[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  assert.notEqual((await preview(options, { listeners })).generation, result.generation)
  assert.deepEqual(result.ports, { app: 48001, lan: 48002, firebase: { auth: 48003, firestore: 48004, storage: 48005 } })
  assert.equal(result.origin, 'http://127.0.0.1:48001')
  const launch = parseSessionOptions(result.proposedLaunch.args.slice(1), result.proposedLaunch.environment)
  assert.equal(launch.generation, result.generation)
  assert.equal(launch.fixedOrigin, true)
  assert.deepEqual(await resolveSessionPorts(launch, { available: () => true }), result.ports)
  // Simulate a new listener appearing between the preview and launch.
  await assert.rejects(resolveSessionPorts(launch, { available: port => port !== 48001 }), { code: 'EADDRINUSE' })
  assert.deepEqual(listeners, [{ host: '127.0.0.1', pid: 10, port: 48000 }])
})

test('fixed origin is explicit on refusal and incomplete observations cannot propose a start', async () => {
  const options = parseSessionOptions(['--host', 'localhost', '--port', '48100'])
  const occupied = await preview(options, { listeners: [{ port: 48100, pid: 87, host: '*' }] })
  assert.equal(occupied.canStart, false)
  assert.equal(occupied.selection, 'fixed')
  assert.equal(occupied.origin, 'http://localhost:48100')
  assert.deepEqual(occupied.reasons, ['fixed-app-port-unavailable'])
  assert.equal(occupied.proposedLaunch, null)
  const unavailable = await createSessionStartPreview({
    repoRoot: '/fixture', options, inspectOwnership: () => absent,
    inspectListeners: () => ({ complete: false, listeners: [] }),
  })
  assert.equal(unavailable.canStart, false)
  assert.equal(unavailable.ports, null)
  assert.deepEqual(unavailable.reasons, ['listener-snapshot-unavailable'])
  const malformed = await preview(options, { listeners: [null] })
  assert.deepEqual(malformed.reasons, ['listener-snapshot-unavailable'])
})

test('owned, exited and unverified sessions retain their distinct recovery steps and readiness', async () => {
  const options = parseSessionOptions(['--port', '48200'])
  const originalGeneration = 'systemx-owned-fixture'
  for (const [status, reason] of [
    ['owned', 'session-already-owned'], ['unverified', 'session-ownership-unverified'], ['exited', 'exited-session-needs-cleanup'],
  ]) {
    const owner = { status, sessionId: originalGeneration, ownerPid: 99, origin: 'http://localhost:48250', reasons: [] }
    const result = await preview(options, { owner })
    assert.equal(result.canStart, false)
    assert.equal(result.proposedLaunch, null)
    assert.deepEqual(result.previousSession, owner)
    assert.notEqual(result.generation, originalGeneration)
    assert.equal(result.origin, 'http://127.0.0.1:48200')
    assert.equal(result.readiness, 'not-started')
    assert.deepEqual(result.reasons, [reason])
    if (status === 'exited') assert.match(result.nextAction, /stop.*exited record.*preview/)
  }
})

test('operator CLI previews a fresh fixture with a read-only listener inventory and no state writes', {
  skip: process.platform === 'win32' ? 'POSIX lsof fixture; platform-independent planner cases run on Windows' : false,
}, t => {
  const root = mkdtempSync(join(tmpdir(), 'webappx-session-start-view-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const fixtureLan = join(root, '.SYSTEMX', 'LAN'), bin = join(root, 'bin')
  mkdirSync(fixtureLan, { recursive: true })
  mkdirSync(bin)
  for (const name of readdirSync(lan)) {
    if (name.endsWith('.mjs')) cpSync(join(lan, name), join(fixtureLan, name))
  }
  cpSync(join(lan, 'Builder', 'runtime'), join(fixtureLan, 'Builder', 'runtime'), { recursive: true })
  writeFileSync(join(bin, 'lsof'), [
    '#!/bin/sh',
    'case "$*" in',
    '  *"-d cwd"*) printf "n%s\\n" "$PWD" ;;',
    '  *) printf "p907\\nn127.0.0.1:48300\\n" ;;',
    'esac', '',
  ].join('\n'), { mode: 0o755 })
  const state = resolve(root, '.SYSTEMX', 'state')
  const cli = (args) => spawnSync(process.execPath, [join(fixtureLan, 'session-control.mjs'), ...args], {
    cwd: root, timeout: 8000, encoding: 'utf8', env: { PATH: bin, SYSTEMX_DEV_HOST: 'localhost' },
  })
  assert.equal(existsSync(state), false)
  const busy = cli(['start', '--preview', '--port', '48300'])
  assert.equal(busy.status, 1, busy.stderr)
  assert.deepEqual(JSON.parse(busy.stdout).reasons, ['fixed-app-port-unavailable'])
  const open = cli(['start', '--preview', '--port', '48301'])
  assert.equal(open.status, 0, open.stderr)
  const proposal = JSON.parse(open.stdout)
  assert.equal(proposal.origin, 'http://localhost:48301')
  assert.equal(proposal.canStart, true)
  assert.equal(proposal.previousSession.status, 'absent')
  assert.equal(existsSync(state), false)
  mkdirSync(state)
  const record = join(state, 'local-session.json')
  writeFileSync(record, '{damaged-record')
  const damaged = cli(['start', '--preview', '--port', '48301'])
  assert.equal(damaged.status, 1, damaged.stderr)
  assert.equal(JSON.parse(damaged.stdout).previousSession.status, 'unverified')
  assert.deepEqual(readdirSync(state), ['local-session.json'])
  assert.equal(readFileSync(record, 'utf8'), '{damaged-record')

  const command = 'node .SYSTEMX/LAN/dev-session.mjs'
  const birth = 'Mon Oct 12 12:00:00 2026'
  const session = {
    sessionId: 'fixture-existing-generation', mode: 'combined', ownerPid: 905, processes: { session: 905 },
    processIdentities: { session: { pid: 905, parentPid: 501, startedAt: birth,
      commandHash: createHash('sha256').update(command).digest('hex') } },
    origin: { url: 'http://localhost:48401' },
  }
  const recordBytes = JSON.stringify(session)
  writeFileSync(record, recordBytes)
  const ps = join(bin, 'ps')
  writeFileSync(ps, `#!/bin/sh\nprintf '%s\\n' '501 ${birth} ${command}'\n`, { mode: 0o755 })
  function refusedOwner() {
    const result = cli(['start', '--preview', '--port', '48301'])
    assert.equal(result.status, 1, result.stderr)
    assert.equal(readFileSync(record, 'utf8'), recordBytes)
    return JSON.parse(result.stdout)
  }
  const owned = refusedOwner()
  assert.equal(owned.previousSession.status, 'owned')
  assert.equal(owned.previousSession.origin, 'http://localhost:48401')
  assert.equal(owned.previousSession.sessionId, session.sessionId)
  writeFileSync(ps, `#!/bin/sh\nprintf '%s\\n' '501 Tue Oct 13 12:00:00 2026 ${command}'\n`)
  assert.equal(refusedOwner().previousSession.status, 'unverified', 'Reused PID must not authorize a new launch')
  writeFileSync(ps, '#!/bin/sh\nexit 1\n')
  const orphan = refusedOwner()
  assert.equal(orphan.previousSession.status, 'exited')
  assert.match(orphan.nextAction, /stop.*clear.*preview/)
  assert.deepEqual(readdirSync(state), ['local-session.json'])
})

test('a fixed-origin conflict reports selected-workspace ownership only for an exact live origin and unique PID', async () => {
  const options = parseSessionOptions(['--port', '48200'])
  const origin = 'http://127.0.0.1:48200'
  const verified = { ownership: 'owned', activeOrigin: origin, listener: { state: 'owned', pid: 441 } }
  for (const [row, listeners, expected] of [
    [verified, [{ port: 48200, pid: 441 }], 'verified-workspace-listener'],
    [{ ...verified, activeOrigin: 'http://localhost:48200' }, [{ port: 48200, pid: 441 }], 'unverified-listener'],
    [verified, [{ port: 48200, pid: 442 }], 'unverified-listener'],
    [verified, [{ port: 48200, pid: 441 }, { port: 48200, pid: 442 }], 'unverified-listener'],
    [{ ownership: 'absent', listener: { state: 'unverified', pid: null } }, [{ port: 48200, pid: 441 }], 'outside-verified-workspace-session'],
  ]) {
    const snapshot = { complete: true, listeners }
    const result = await createSessionStartPreview({ repoRoot: '/not-output', options, inspectOwnership: () => absent,
      inspectListeners: () => snapshot, inspectWorkspace: (_root, deps) => { assert.equal(deps.inspectListeners(), snapshot); return row } })
    assert.equal(result.canStart, false)
    assert.equal(result.proposedLaunch, null)
    assert.equal(result.origin, origin)
    assert.equal(result.ports, null)
    assert.equal(result.recovery.ownership, expected)
    assert.equal(result.recovery.choices[0].action, expected === 'verified-workspace-listener' ? 'inspect-current-session' : 'inspect-listener')
    assert.deepEqual(result.recovery.choices.slice(1).map(choice => choice.action), ['retry-same-origin', 'choose-different-origin'])
    assert.ok(!JSON.stringify(result.recovery).includes('/not-output'))
  }
})
