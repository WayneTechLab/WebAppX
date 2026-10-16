import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { execFile, fork } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { loadMockModel } from '../browser/model-loader.mjs'
import { main } from '../../scripts/rehearse-hr-disabled.mjs'

let fixture, codec, workspaces, backup
const timestamp = '2026-10-15T12:00:00.000Z'
before(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'webappx-adopted-codec-'))
  const files = ['cms/model.ts', 'cms/persistence.ts', 'crm/model.ts', 'crm/persistence.ts', 'crm/types.ts', 'crm/kernel.ts', 'crm/legacy-validation.ts', 'crm/merge-types.ts', 'crm/merge-value.ts', 'crm/merge-history.ts', 'crm/merge-projection.ts', 'crm/merge-public-types.ts', 'crm/merge-report.ts', 'portals/backup.ts', 'portals/persistence.ts', 'portals/registry.ts', 'portals/workspaces.ts', 'portals/combined-backup.ts']
  for (const file of files) {
    const overridden = ['portals/registry.ts', 'portals/workspaces.ts', 'portals/combined-backup.ts'].includes(file)
    await mkdir(join(fixture, 'src', file, '..'), { recursive: true })
    await copyFile(new URL(overridden ? `./hr-disabled-overrides/src/${file}` : `../../src/${file}`, import.meta.url), join(fixture, 'src', file))
  }
  codec = await loadMockModel(pathToFileURL(join(fixture, 'src/portals/combined-backup.ts')))
  workspaces = await loadMockModel(pathToFileURL(join(fixture, 'src/portals/workspaces.ts')))
  backup = await loadMockModel(pathToFileURL(join(fixture, 'src/portals/backup.ts')))
})
after(async () => { if (fixture) await rm(fixture, { recursive: true, force: true }) })

test('adopted kind contains exactly two complete workspaces and retains individual v1 formats', () => {
  const states = workspaces.createDemoWorkspaces()
  const text = codec.createCombinedBackup(states, timestamp)
  const envelope = JSON.parse(text)
  assert.equal(envelope.format, 'webappx-adopted-cms-crm-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  assert.deepEqual(Object.keys(envelope.workspaces).sort(), ['cms', 'crm'])
  assert.deepEqual(codec.parseCombinedBackup(text).states, states)
  for (const module of ['cms', 'crm']) {
    const individual = backup.createDemoBackup(module, states[module], workspaces.demoWorkspaceValidators[module], timestamp)
    assert.equal(JSON.parse(individual).format, 'webappx-mock-workspace')
    assert.equal(JSON.parse(individual).schemaVersion, 1)
    assert.deepEqual(backup.parseDemoBackup(individual, module, workspaces.demoWorkspaceValidators[module]).state, states[module])
  }
})

test('legacy combined formats, recovery envelopes, extra HR, wrong versions and incomplete graphs reject before writes', () => {
  const states = workspaces.createDemoWorkspaces()
  const envelope = JSON.parse(codec.createCombinedBackup(states, timestamp))
  const variants = [
    { ...envelope, format: 'webappx-mock-workspaces', workspaces: { ...states, hr: {} } },
    { schemaVersion: 1, points: [] },
    { ...envelope, workspaces: { ...states, hr: {} } },
    { ...envelope, schemaVersion: 2 },
    { ...envelope, workspaces: { cms: states.cms } },
    { ...envelope, workspaces: { ...states, crm: { ...states.crm, contacts: [] } } },
  ]
  for (const value of variants) assert.throws(() => codec.parseCombinedBackup(JSON.stringify(value)))
  let reads = 0, writes = 0
  const storage = { getItem() { reads += 1 }, setItem() { writes += 1 }, removeItem() { writes += 1 } }
  assert.equal(codec.restoreAdoptedBundle({ ...states, hr: {} }, storage).ok, false)
  assert.equal(reads, 0); assert.equal(writes, 0)
  for (const module of ['cms', 'crm']) assert.throws(() => backup.parseDemoBackup(JSON.stringify({ format: 'webappx-mock-workspace', schemaVersion: 1, module: 'hr', exportedAt: timestamp, data: {} }), module, workspaces.demoWorkspaceValidators[module]), /does not belong/)
})

test('two-slot restore preserves old HR/history and rolls back a storage write that changes its key before throwing', () => {
  const states = workspaces.createDemoWorkspaces()
  const initial = [['webappx.demo.cms', 'old-cms'], ['webappx.demo.crm', 'old-crm'], ['webappx.demo.hr', 'retained-hr'], ['webappx.demo.restore-points', 'retained-history']]
  const values = new Map(initial)
  let fail = true
  const accessed = []
  const storage = {
    getItem(key) { accessed.push(key); return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value); if (key === 'webappx.demo.crm' && fail) { fail = false; throw new Error('injected-after-write-failure') } },
    removeItem(key) { values.delete(key) },
  }
  assert.equal(codec.restoreAdoptedBundle(states, storage).ok, false)
  assert.deepEqual([...values], initial)
  assert.deepEqual(accessed, ['webappx.demo.cms', 'webappx.demo.crm'])
  assert.equal(codec.restoreAdoptedBundle(states, storage).ok, true)
  assert.deepEqual(JSON.parse(values.get('webappx.demo.cms')), { schemaVersion: 1, module: 'cms', data: states.cms })
  assert.deepEqual(JSON.parse(values.get('webappx.demo.crm')), { schemaVersion: 1, module: 'crm', data: states.crm })
  assert.equal(values.get('webappx.demo.hr'), 'retained-hr')
  assert.equal(values.get('webappx.demo.restore-points'), 'retained-history')
})

test('rehearsal refuses arbitrary app or output target arguments', async () => {
  await assert.rejects(main(['--target', '/unrelated/app']), /accepts no paths/)
})

const command = promisify(execFile)
function alive(pid) {
  try { process.kill(pid, 0); return true } catch (error) { if (error.code === 'ESRCH') return false; throw error }
}
async function descendants(parent) {
  const { stdout } = await command('ps', ['-axo', 'pid=,ppid=,command='], { timeout: 5000, maxBuffer: 2 * 1024 * 1024 })
  const rows = stdout.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }] : []
  })
  const owned = new Set([parent])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) if (owned.has(row.parent) && !owned.has(row.pid)) { owned.add(row.pid); changed = true }
  }
  return rows.filter(row => row.pid !== parent && owned.has(row.pid))
}

for (const [phase, signal, expectedExit] of [['typecheck', 'SIGTERM', 143], ['browser', 'SIGINT', 130]]) {
  test(`${signal} during real ${phase} stops owned child processes and removes its temporary fixture`, { skip: process.platform === 'win32', timeout: 45000 }, async t => {
    const script = fileURLToPath(new URL('../../scripts/rehearse-hr-disabled.mjs', import.meta.url))
    const child = fork(script, [], { silent: true, execArgv: [] })
    let stderr = '', directory, origin, observedPids = []
    child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-16000) })
    child.stdout.resume()
    const exited = new Promise((done, fail) => { child.once('error', fail); child.once('exit', (code, cause) => done({ code, cause })) })
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        await Promise.race([exited, delay(10000, undefined, { ref: false })])
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
      }
      // Failure cleanup remains restricted to the fixture this child reported.
      if (directory) await rm(directory, { recursive: true, force: true })
    })
    let timeout
    const ready = await Promise.race([
      new Promise(done => child.on('message', message => { if (message.kind === 'webappx-owned-rehearsal-phase' && message.phase === phase) done(message) })),
      exited.then(result => { throw new Error(`Rehearsal exited before ${phase}: ${JSON.stringify(result)} ${stderr}`) }),
      new Promise((_, fail) => { timeout = setTimeout(() => fail(new Error(`Rehearsal did not reach ${phase}: ${stderr}`)), 30000) }),
    ]).finally(() => clearTimeout(timeout))
    directory = ready.fixture; origin = ready.origin
    assert.match(directory.replaceAll('\\', '/'), /\/webappx-hr-disabled-[A-Za-z0-9]+$/)
    await access(directory)
    if (phase === 'typecheck') {
      assert.ok(Number.isSafeInteger(ready.childPid) && alive(ready.childPid), 'The actual typecheck child must still be running when interrupted')
      observedPids = [ready.childPid]
    } else {
      const processes = await descendants(child.pid)
      assert.ok(processes.some(row => /chromium|chrome.*headless|headless.*shell/i.test(row.command)), 'The actual owned Chromium child must exist before interruption')
      observedPids = processes.map(row => row.pid)
      const response = await fetch(origin, { signal: AbortSignal.timeout(3000) })
      assert.equal(response.status, 200, 'The owned Vite listener must be serving before interruption')
    }
    child.kill(signal)
    const result = await Promise.race([exited, delay(12000, undefined, { ref: false }).then(() => { throw new Error('Interrupted rehearsal exceeded its cleanup bound: ' + stderr) })])
    assert.deepEqual(result, { code: expectedExit, cause: null }, stderr)
    await assert.rejects(access(directory), error => error.code === 'ENOENT')
    for (let attempt = 0; attempt < 40 && observedPids.some(alive); attempt += 1) await delay(100)
    assert.deepEqual(observedPids.filter(alive), [], 'Every observed owned child process must have exited')
    if (origin) await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }), 'The owned preview listener must be closed')
  })
}
