import assert from 'node:assert/strict'
import { execFile, execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createController } from '../../.SYSTEMX/swarm/runtime.mjs'

const cli = fileURLToPath(new URL('../../.SYSTEMX/swarm/cli.mjs', import.meta.url))
const node = realpathSync(process.execPath)
const runAsync = promisify(execFile)
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function fixture(t, externalWorkers = 1) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'systemx-prepare-wave-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo'), manifestFile = join(root, 'manifest.json'), stateDir = join(root, 'private', 'swarm')
  mkdirSync(repo)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.email', 'worker@example.invalid')
  git(repo, 'config', 'user.name', 'Synthetic fixture')
  git(repo, 'commit', '--allow-empty', '-m', 'Synthetic baseline')
  const manifest = { schemaVersion: 1, runId: 'batch', repository: 'example/batch', baseBranch: 'main',
    baseRevision: git(repo, 'rev-parse', 'HEAD'), maxWorkers: 3, externalWorkers, tasks: ['A', 'B', 'C', 'D'].map(id => ({
      id, title: id, acceptance: ['Reviewed fixture'], allowedPaths: [id === 'C' ? 'a' : id],
      checks: [{ executable: node, args: ['--version'] }], dependsOn: id === 'D' ? ['A'] : [],
    })) }
  writeFileSync(manifestFile, JSON.stringify(manifest))
  const marker = join(root, 'provider-ran')
  const flags = ['--repo', repo, '--manifest', manifestFile, '--state-dir', stateDir]
  const args = waveDigest => [cli, 'prepare-wave', ...flags, '--wave-digest', waveDigest, '--executable', node,
    '--arg', '-e', '--arg', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`, '--apply']
  const invoke = argv => spawnSync(node, argv, { encoding: 'utf8' })
  const controller = createController({ repo, manifest, stateDir })
  return { repo, flags, marker, args, invoke, controller, stateDir, manifest, manifestFile }
}

test('only the reviewed wave is prepared, with ordinary durable receipts and zero provider runs', t => {
  const f = fixture(t), wave = f.controller.wave()
  assert.match(wave.waveDigest, /^[a-f0-9]{64}$/)
  assert.equal(f.controller.wave().waveDigest, wave.waveDigest)
  assert.deepEqual(wave.assignments.map(x => x.taskId), ['A', 'B'])
  const denied = f.invoke(f.args(wave.waveDigest).filter(arg => arg !== '--apply'))
  assert.equal(JSON.parse(denied.stderr).code, 'APPLY_REQUIRED')
  assert.equal(existsSync(f.stateDir), false)
  const out = f.invoke(f.args(wave.waveDigest))
  assert.equal(out.status, 0, out.stderr)
  const result = JSON.parse(out.stdout)
  assert.equal(result.status, 'prepared')
  assert.equal(result.executionAuthority, false)
  assert.deepEqual(result.prepared.map(({ slot, taskId, generation, phase }) => [slot, taskId, generation, phase]), [[1, 'A', 1, 'ready'], [2, 'B', 1, 'ready']])
  assert.deepEqual(result.prepared.map(receipt => receipt.stateRevision), [1, 2])
  assert.deepEqual(result.unprepared, [])
  const state = f.controller.status()
  assert.equal(state.revision, 2)
  assert.deepEqual(state.events.map(({ event, taskId }) => [event, taskId]), [['worker-prepared', 'A'], ['worker-prepared', 'B']])
  assert.deepEqual(state.acceptedTaskIds, [])
  assert.deepEqual(state.executions, [])
  assert.equal(existsSync(f.marker), false)
  assert.equal(git(f.repo, 'rev-parse', 'HEAD'), f.manifest.baseRevision)
  assert.equal(git(f.repo, 'status', '--porcelain'), '')
  const replay = f.invoke(f.args(wave.waveDigest))
  assert.equal(replay.status, 1)
  assert.equal(JSON.parse(replay.stderr).code, 'WAVE_STALE')
  assert.equal(f.controller.status().revision, 2)
})

test('digest binds workspace, manifest and local readiness, and empty waves refuse', t => {
  const f = fixture(t), wave = f.controller.wave(), second = fixture(t)
  assert.notEqual(second.controller.wave().waveDigest, wave.waveDigest)
  wave.assignments[0].allowedPaths.push('unreviewed/')
  wave.readyTasks[0].allowedPaths.push('other/')
  f.controller.manifest.tasks[0].checks[0].args.push('--different')
  assert.equal(f.controller.wave().waveDigest, wave.waveDigest)
  assert.deepEqual(f.controller.manifest.tasks[0].allowedPaths, ['A'])
  assert.deepEqual(f.controller.manifest.tasks[0].checks[0].args, ['--version'])
  const before = f.manifest.tasks[0].title
  f.manifest.tasks[0].title = 'Different assignment text'
  assert.notEqual(createController({ repo: f.repo, manifest: f.manifest, stateDir: f.stateDir }).wave().waveDigest, wave.waveDigest)
  f.manifest.tasks[0].title = before
  writeFileSync(join(f.repo, 'dirty'), 'local change')
  const stale = f.invoke(f.args(wave.waveDigest)); assert.equal(JSON.parse(stale.stderr).code, 'WAVE_STALE')
  assert.equal(Object.keys(f.controller.status().slots).length, 0)
  const blocked = f.controller.wave()
  assert.equal(blocked.blockedBy, 'BASE_STALE')
  assert.equal(JSON.parse(f.invoke(f.args(blocked.waveDigest)).stderr).code, 'WAVE_BLOCKED')
  assert.equal(JSON.parse(f.invoke(f.args('bad')).stderr).code, 'WAVE_DIGEST_INVALID')
  assert.equal(JSON.parse(f.invoke([...f.args(wave.waveDigest), '--task', 'D']).stderr).code, 'OPTION_INVALID')
  assert.equal(existsSync(f.marker), false)
})

test('single preparation invalidates prior proposals and the digest also covers state at an unchanged revision', async t => {
  const f = fixture(t), initial = f.controller.wave()
  await f.controller.prepare({ slot: 1, taskId: 'A', executable: node, args: ['--version'], apply: true })
  assert.equal(JSON.parse(f.invoke(f.args(initial.waveDigest)).stderr).code, 'WAVE_STALE')
  const current = f.controller.wave()
  assert.deepEqual(current.assignments.map(x => x.taskId), ['B'])
  const file = join(f.stateDir, 'state.json'), state = JSON.parse(readFileSync(file))
  state.events[0].at = '2000-01-01T00:00:00.000Z'
  writeFileSync(file, JSON.stringify(state))
  const changed = f.controller.wave()
  assert.deepEqual(changed.assignments, current.assignments)
  assert.equal(changed.stateRevision, current.stateRevision)
  assert.notEqual(changed.waveDigest, current.waveDigest)
  assert.equal(JSON.parse(f.invoke(f.args(current.waveDigest)).stderr).code, 'WAVE_STALE')
  assert.equal(existsSync(f.marker), false)
})

test('a second-slot collision leaves the first receipt intact and a fresh digest prepares only remaining work', t => {
  const f = fixture(t), wave = f.controller.wave(), occupied = 'codex/swarm/batch/y02-g001-b'
  git(f.repo, 'branch', occupied)
  const out = f.invoke(f.args(wave.waveDigest))
  assert.equal(out.status, 1, out.stderr)
  const result = JSON.parse(out.stdout)
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.prepared.map(x => x.taskId), ['A'])
  assert.deepEqual(result.unprepared.map(x => x.taskId), ['B'])
  assert.deepEqual(result.failure, { slot: 2, taskId: 'B', code: 'WORKER_COLLISION' })
  assert.equal(result.stateRevision, 1)
  assert.match(result.nextStep, /fresh wave/)
  const persisted = JSON.parse(readFileSync(join(f.stateDir, 'state.json')))
  assert.equal(persisted.events.length, 1)
  assert.equal(persisted.slots['1'].phase, 'ready')
  assert.equal(existsSync(persisted.slots['1'].worktree), true)
  assert.equal(git(f.repo, 'rev-parse', occupied), f.manifest.baseRevision)
  assert.equal(JSON.parse(f.invoke(f.args(wave.waveDigest)).stderr).code, 'WAVE_STALE')
  git(f.repo, 'branch', '-d', occupied)
  const remaining = f.controller.wave()
  assert.deepEqual(remaining.assignments.map(x => [x.slot, x.taskId]), [[2, 'B']])
  const done = f.invoke(f.args(remaining.waveDigest))
  assert.equal(done.status, 0, done.stderr)
  assert.deepEqual(JSON.parse(done.stdout).prepared.map(x => x.taskId), ['B'])
  assert.equal(existsSync(f.marker), false)
})

test('concurrent CLI preparation with the same digest creates each reviewed generation once', async t => {
  const f = fixture(t), args = f.args(f.controller.wave().waveDigest)
  const runs = await Promise.allSettled([runAsync(node, args), runAsync(node, args)])
  assert.deepEqual(runs.map(r => r.status).sort(), ['fulfilled', 'rejected'])
  assert.equal(JSON.parse(runs.find(r => r.status === 'rejected').reason.stderr).code, 'WAVE_STALE')
  assert.equal(f.controller.status().revision, 2)
  assert.deepEqual(f.controller.status().events.map(x => x.taskId), ['A', 'B'])
  assert.equal(existsSync(f.marker), false)
})
