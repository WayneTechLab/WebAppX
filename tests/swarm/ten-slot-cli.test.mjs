// Run: node --test --test-reporter=tap tests/swarm/ten-slot-cli.test.mjs
// The SWARM_TEN_SLOT_SMOKE diagnostic is a JSON receipt containing observed
// slot, commit, scope and check evidence. A fresh CLI resumes persisted checkpoints.
// The fixture ends at Agent Z review and leaves its bare origin at the starting SHA.
import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const node = realpathSync(process.execPath)
const self = fileURLToPath(import.meta.url)
const cli = fileURLToPath(new URL('../../.SYSTEMX/swarm/cli.mjs', import.meta.url))
const execute = promisify(execFile)
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

async function waitFor(path, milliseconds) {
  const end = Date.now() + milliseconds
  while (!existsSync(path) && Date.now() < end) await delay(25)
  assert.ok(existsSync(path), 'The owned synthetic worker did not reach its synchronization point.')
}

async function syntheticWorker(markers, release) {
  const { task, syncPoint } = readJson(0)
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  assert.equal(branch, syncPoint.branch)
  writeFileSync(join(markers, task.id), JSON.stringify({ pid: process.pid, branch, slot: syncPoint.slot }))
  await waitFor(release, 60_000)
  const [path] = task.allowedPaths
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, task.id + '\n')
  execFileSync('git', ['add', '--', path])
  execFileSync('git', ['commit', '-qm', 'Synthetic change for ' + task.id])
}

const [mode, first, second] = process.argv.slice(2)
if (mode === 'fixture-worker') {
  await syntheticWorker(first, second)
} else if (mode === 'fixture-check') {
  assert.equal(readFileSync(first, 'utf8'), second + '\n')
  assert.equal(execFileSync('git', ['show', 'HEAD:' + first], { encoding: 'utf8' }), second + '\n')
} else {
  test('ten CLI workers resume a prepared wave and pass their assigned checks before independent review', {
    skip: process.platform === 'win32' && 'Native Windows provider process-group execution is unqualified.',
    timeout: 120_000,
  }, async t => {
    const temp = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-ten-slot-cli-')))
    t.after(() => rmSync(temp, { recursive: true, force: true }))
    const repo = join(temp, 'coordinator'), remote = join(temp, 'origin.git'), state = join(temp, 'private-state')
    const manifestFile = join(temp, 'manifest.json'), markers = join(temp, 'markers'), release = join(temp, 'release')
    mkdirSync(repo); mkdirSync(markers)
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(temp, 'empty.gitconfig'), GIT_TERMINAL_PROMPT: '0' }
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
    git(temp, 'init', '-q', '--bare', '-b', 'main', remote)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.name', 'Synthetic worker'); git(repo, 'config', 'user.email', 'fixture@example.invalid')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'Fixture baseline')
    git(repo, 'remote', 'add', 'origin', remote); git(repo, 'push', '-q', 'origin', 'main')
    const baseline = git(repo, 'rev-parse', 'HEAD')
    const remoteBefore = git(repo, 'ls-remote', '--heads', 'origin')
    const workers = Array.from({ length: 10 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0'), id = 'WORK-' + number, path = 'workers/item-' + number + '.txt'
      return { id, title: 'Synthetic worker ' + number, acceptance: ['The assigned fixture file matches the worker ID in the committed tree.'],
        allowedPaths: [path], checks: [{ executable: node, args: [self, 'fixture-check', path, id] }], dependsOn: [] }
    })
    const overlap = { ...workers[0], id: 'OVERLAP', allowedPaths: [workers[0].allowedPaths[0].toUpperCase()] }
    const dependent = { ...workers[0], id: 'AFTER', allowedPaths: ['next.txt'], dependsOn: [workers[0].id] }
    const tasks = [workers[0], overlap, ...workers.slice(1), dependent]
    writeFileSync(manifestFile, JSON.stringify({ schemaVersion: 1, runId: 'ten-slot', repository: 'example/synthetic',
      baseBranch: 'main', baseRevision: baseline, maxWorkers: 10, autoMerge: false, tasks }))
    const call = async (command, ...args) => {
      const result = await execute(node, [cli, command, '--repo', repo, '--manifest', manifestFile, '--state-dir', state, ...args], { cwd: temp, env })
      return JSON.parse(result.stdout)
    }
    const wave = await call('wave')
    assert.deepEqual(wave.assignments.map(a => [a.slot, a.generation, a.taskId]), workers.map((worker, i) => [i + 1, 1, worker.id]))
    assert.ok(wave.readyTasks.some(task => task.id === overlap.id))
    assert.ok(!wave.readyTasks.some(task => task.id === dependent.id))
    const prepared = await call('prepare-wave', '--wave-digest', wave.waveDigest, '--executable', node,
      '--arg', self, '--arg', 'fixture-worker', '--arg', markers, '--arg', release, '--apply')
    assert.equal(prepared.status, 'prepared')
    assert.equal(prepared.prepared.length, workers.length)
    const retained = await call('status')
    assert.equal(new Set(Object.values(retained.slots).map(slot => slot.branch)).size, 10)
    assert.equal(new Set(Object.values(retained.slots).map(slot => slot.worktree)).size, 10)
    assert.ok(Object.values(retained.slots).every(slot => slot.phase === 'ready' && existsSync(slot.worktree)))
    const points = await Promise.all(prepared.prepared.map(({ slot }) => call('sync', '--slot', String(slot))))
    const handoff = await call('sync', '--slot', String(points[0].slot), '--sync-digest', points[0].syncDigest)
    assert.equal(handoff.syncDigest, points[0].syncDigest)
    assert.equal(handoff.assignmentDigest, points[0].assignmentDigest)
    const jobs = []
    let running, settled
    try {
      for (const point of points) {
        // Launch separate CLI/controller processes. Each synthetic provider waits
        // at the same gate so all ten must hold live leases at one instant.
        jobs.push(call('run', '--slot', String(point.slot), '--sync-digest', point.syncDigest, '--apply')
          .then(value => ({ value }), error => ({ error })))
        await waitFor(join(markers, point.taskId), 10_000)
      }
      running = await call('status')
      assert.equal(running.executions.length, 10)
      for (const point of points) {
        const slot = running.slots[point.slot], marker = readJson(join(markers, point.taskId))
        const owner = running.executions.find(execution => execution.lease === slot.lease)
        assert.equal(slot.phase, 'running'); assert.equal(owner.pid, marker.pid)
        assert.equal(marker.slot, point.slot); assert.equal(marker.branch, slot.branch)
      }
      assert.equal(new Set(running.executions.map(owner => owner.pid)).size, 10)
    } finally {
      writeFileSync(release, 'finish')
      settled = await Promise.all(jobs)
    }
    for (const result of settled) {
      if (result.error) throw result.error
      assert.equal(result.value.phase, 'review')
      assert.equal(result.value.result.ownedGroupStopped, true)
    }
    const afterWorkers = await call('status')
    assert.equal(afterWorkers.executions.length, 0)
    await assert.rejects(call('sync', '--slot', String(handoff.slot), '--sync-digest', handoff.syncDigest),
      error => JSON.parse(error.stderr).code === 'SYNC_STALE')
    const fresh = await call('sync', '--slot', String(handoff.slot))
    assert.equal(fresh.headRevision, afterWorkers.slots[handoff.slot].headRevision)
    assert.notEqual(fresh.syncDigest, handoff.syncDigest)
    assert.equal(new Set(Object.values(afterWorkers.slots).map(slot => slot.headRevision)).size, 10)
    assert.ok(Object.values(afterWorkers.slots).every(slot => slot.phase === 'review' && slot.headRevision !== baseline))
    const receipts = []
    for (const point of points) {
      const checked = await call('verify', '--slot', String(point.slot), '--apply')
      const expectedPath = workers[point.slot - 1].allowedPaths[0]
      assert.equal(checked.phase, 'checks'); assert.equal(checked.passed, true)
      assert.equal(checked.acceptanceGranted, false)
      assert.equal(checked.headRevision, afterWorkers.slots[point.slot].headRevision)
      assert.equal(checked.assignmentDigest, point.assignmentDigest)
      assert.deepEqual(checked.paths, [expectedPath])
      assert.equal(checked.results.length, 1); assert.equal(checked.results[0].exitCode, 0)
      assert.equal(checked.results[0].ownedGroupStopped, true)
      receipts.push({ slot: point.slot, generation: point.generation, taskId: point.taskId, branch: point.branch,
        headRevision: checked.headRevision, changedPath: expectedPath, checkExitCode: checked.results[0].exitCode })
    }
    const final = await call('status'), resumed = await call('wave')
    assert.deepEqual(final.acceptedTaskIds, []); assert.deepEqual(final.executions, [])
    assert.ok(Object.values(final.slots).every(slot => slot.phase === 'checks' && !slot.review && !slot.pr && !slot.acceptance))
    assert.equal(resumed.progress.activeGenerations, 10); assert.equal(resumed.progress.complete, false)
    assert.equal(resumed.blockedBy, 'CAPACITY_EXCEEDED'); assert.deepEqual(resumed.assignments, [])
    assert.equal(git(repo, 'rev-parse', 'HEAD'), baseline); assert.equal(git(repo, 'status', '--porcelain'), '')
    assert.equal(git(repo, 'ls-remote', '--heads', 'origin'), remoteBefore)
    t.diagnostic('SWARM_TEN_SLOT_SMOKE ' + JSON.stringify({
      schemaVersion: 1, kind: 'local-ten-slot-cli-smoke', baseline, simultaneousProviderLeases: running.executions.length,
      excludedOverlap: overlap.id, unacceptedDependency: dependent.id, acceptedTasks: final.acceptedTaskIds.length,
      readyForIndependentReview: receipts.length, activeProcessesAtEnd: final.executions.length,
      terminalPhase: 'checks', resumedBy: 'fresh-cli-at-persisted-checkpoint', staleHandoffRefused: true,
      resumedStateRevision: resumed.stateRevision, coordinatorClean: true, disposableOriginRefsPreserved: true,
      workerType: 'synthetic-node-cli', receipts,
    }))
  })
}
