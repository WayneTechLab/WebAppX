import assert from 'node:assert/strict'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const node = realpathSync(process.execPath)
const cli = fileURLToPath(new URL('../../.SYSTEMX/swarm/cli.mjs', import.meta.url))
const hostExecution = { skip: process.platform === 'win32' && 'Native worker process groups are not qualified on Windows.', timeout: 60_000 }

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'systemx-run-wave-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'coordinator'), markers = join(root, 'started'), stateDir = join(root, 'private-state')
  mkdirSync(repo)
  mkdirSync(markers)
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'empty.gitconfig'), GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'file' }
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key]
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 'fixture@example.invalid')
  git(repo, 'config', 'user.name', 'Fixture')
  git(repo, 'commit', '--allow-empty', '-qm', 'Local baseline')
  const head = git(repo, 'rev-parse', 'HEAD')
  const manifest = join(root, 'manifest.json')
  writeFileSync(manifest, JSON.stringify({
    schemaVersion: 1, runId: 'local-run', repository: 'example/synthetic', baseBranch: 'main', baseRevision: head,
    maxWorkers: 3, externalWorkers: 1, tasks: ['A', 'B', 'C'].map(id => ({
      id, title: id, acceptance: ['Fixture change verified'], allowedPaths: [id + '.txt'],
      checks: [{ executable: node, args: ['--version'] }],
    })),
  }))
  const worker = join(root, 'worker.mjs')
  writeFileSync(worker, `import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const { task, syncPoint } = JSON.parse(readFileSync(0, 'utf8'))
const [markers, release, failTask] = process.argv.slice(2)
appendFileSync(join(markers, task.id), JSON.stringify({ pid: process.pid, cwd: process.cwd(), slot: syncPoint.slot, generation: syncPoint.generation }) + '\\n')
const deadline = Date.now() + 15_000
while (!existsSync(release) && Date.now() < deadline) await delay(15)
process.exitCode = !existsSync(release) ? 8 : task.id === failTask ? 7 : 0
`)
  const release = join(root, 'release')
  const args = ['--repo', repo, '--state-dir', stateDir, '--manifest', manifest]
  const invoke = (command, ...flags) => new Promise((resolve, reject) => {
    execFile(node, [cli, command, ...args, ...flags], { cwd: root, env, encoding: 'utf8', timeout: 30_000 }, (error, stdout, stderr) => {
      if (error && !Number.isInteger(error.code)) { reject(error); return }
      try {
        resolve({ code: error?.code ?? 0, result: stdout.trim() ? JSON.parse(stdout) : null, error: stderr.trim() ? JSON.parse(stderr) : null })
      } catch (parseError) { reject(parseError) }
    })
  })
  const ok = async (command, ...flags) => {
    const out = await invoke(command, ...flags)
    assert.equal(out.code, 0, JSON.stringify(out))
    return out.result
  }
  const prepare = async (failTask = 'none') => {
    const wave = await ok('wave')
    assert.deepEqual(wave.assignments.map(a => a.taskId), ['A', 'B'])
    await ok('prepare-wave', '--wave-digest', wave.waveDigest, '--executable', node,
      '--arg', worker, '--arg', markers, '--arg', release, '--arg', failTask, '--apply')
    return ok('status')
  }
  const apply = runDigest => invoke('run-wave', '--apply', '--run-digest', runDigest)
  const startController = runDigest => spawn(node, [cli, 'run-wave', ...args, '--apply', '--run-digest', runDigest], { cwd: root, env, stdio: 'ignore' })
  const started = id => readFileSync(join(markers, id), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  return { root, repo, head, markers, stateDir, git, invoke, ok, prepare, apply, started, startController, release: () => writeFileSync(release, 'finish') }
}

// Hash the complete disposable tree, including ignored state, Git objects, index and refs.
function snapshot(root) {
  const hash = createHash('sha256')
  function walk(path, name) {
    const stat = statSync(path, { bigint: true })
    hash.update(JSON.stringify([name, String(stat.mode), String(stat.mtimeNs)]))
    if (stat.isDirectory()) {
      for (const child of readdirSync(path).sort()) walk(join(path, child), name + '/' + child)
    } else hash.update(createHash('sha256').update(readFileSync(path)).digest())
  }
  walk(root, '.')
  return hash.digest('hex')
}

async function waitForWorkers(f, ids = ['A', 'B']) {
  const deadline = Date.now() + 10_000
  while (!ids.every(id => existsSync(join(f.markers, id)))) {
    assert.ok(Date.now() < deadline, 'Both worker processes must start before either one is released')
    await delay(20)
  }
}

test('run-wave preview is read-only, stable, and binds the two prepared slots to their ordinary sync receipts', async t => {
  const f = fixture(t)
  await f.prepare()
  const before = snapshot(f.root)
  const plan = await f.ok('run-wave')
  assert.equal(plan.applied, false)
  assert.match(plan.runDigest, /^[0-9a-f]{64}$/)
  assert.deepEqual(plan.workers.map(w => [w.slot, w.generation, w.taskId, w.headRevision]), [[1, 1, 'A', f.head], [2, 1, 'B', f.head]])
  for (const worker of plan.workers) {
    const sync = await f.ok('sync', '--slot', String(worker.slot))
    assert.equal(worker.syncDigest, sync.syncDigest)
  }
  assert.equal((await f.ok('run-wave')).runDigest, plan.runDigest)
  assert.equal(snapshot(f.root), before)
  assert.equal((await f.apply('f'.repeat(64))).error.code, 'RUN_WAVE_STALE')
  assert.equal((await f.invoke('run-wave', '--apply')).error.code, 'RUN_DIGEST_INVALID')
  assert.equal((await f.invoke('run-wave', '--run-digest', plan.runDigest)).error.code, 'OPTION_INVALID')
  assert.deepEqual(readdirSync(f.markers), [])
})

test('competing fresh CLI processes start each prepared generation once and hold both process leases concurrently', hostExecution, async t => {
  const f = fixture(t)
  const prepared = await f.prepare()
  const plan = await f.ok('run-wave')
  const competing = Promise.all([f.apply(plan.runDigest), f.apply(plan.runDigest)])
  let results
  try {
    await waitForWorkers(f)
    const running = await f.ok('status')
    assert.equal(running.executions.length, 2)
    assert.equal(new Set(running.executions.map(owner => owner.pid)).size, 2)
    for (const worker of plan.workers) {
      const markers = f.started(worker.taskId)
      assert.equal(markers.length, 1)
      const [marker] = markers
      const slot = running.slots[worker.slot]
      assert.equal(slot.phase, 'running')
      assert.equal(marker.cwd, prepared.slots[worker.slot].worktree)
      assert.equal(marker.slot, worker.slot)
      assert.equal(marker.generation, worker.generation)
      assert.equal(running.executions.find(owner => owner.lease === slot.lease)?.pid, marker.pid)
    }
    const inFlight = await f.ok('run-wave')
    assert.deepEqual(inFlight.workers, [])
  } finally {
    f.release()
    results = await competing
  }
  const winner = results.find(out => out.code === 0), loser = results.find(out => out.code !== 0)
  assert.ok(winner && loser, JSON.stringify(results))
  assert.equal(loser.error?.code, 'RUN_WAVE_STALE')
  assert.equal(winner.result.applied, true)
  assert.equal(winner.result.status, 'completed')
  assert.deepEqual(winner.result.workers.map(w => [w.taskId, w.phase]), [['A', 'review'], ['B', 'review']])
  const after = await f.ok('status')
  assert.deepEqual(after.executions, [])
  assert.deepEqual(after.acceptedTaskIds, [])
  assert.ok(Object.values(after.slots).every(s => s.phase === 'review' && !s.checks && !s.review && !s.pr))
  assert.equal(after.events.filter(e => e.event === 'provider-launch-requested').length, 2)
  assert.deepEqual(readdirSync(f.markers).sort(), ['A', 'B'])
  assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), f.head)
  assert.equal(f.git(f.repo, 'status', '--porcelain'), '')
  assert.equal(f.git(f.repo, 'remote'), '')
  assert.equal((await f.apply(plan.runDigest)).error.code, 'RUN_WAVE_STALE')
  const resumed = await f.ok('run-wave')
  assert.deepEqual(resumed.workers, [])
  assert.equal((await f.apply(resumed.runDigest)).error.code, 'RUN_WAVE_EMPTY')
  assert.equal(f.started('A').length, 1)
  assert.equal(f.started('B').length, 1)
})

test('a fresh batch can start the remaining ready slot beside an independently running worker', hostExecution, async t => {
  const f = fixture(t)
  await f.prepare()
  const before = await f.ok('run-wave')
  const sync = await f.ok('sync', '--slot', '1')
  const jobs = [f.invoke('run', '--slot', '1', '--sync-digest', sync.syncDigest, '--apply')]
  let results
  try {
    await waitForWorkers(f, ['A'])
    assert.equal((await f.apply(before.runDigest)).error.code, 'RUN_WAVE_STALE')
    const remaining = await f.ok('run-wave')
    assert.deepEqual(remaining.workers.map(w => w.taskId), ['B'])
    jobs.push(f.apply(remaining.runDigest))
    await waitForWorkers(f)
    const running = await f.ok('status')
    assert.equal(running.executions.length, 2)
    assert.equal(f.started('A').length, 1)
  } finally {
    f.release()
    results = await Promise.all(jobs)
  }
  assert.equal(results[0].code, 0)
  assert.equal(results[1].code, 0)
  assert.deepEqual(results[1].result.workers.map(w => w.taskId), ['B'])
  assert.equal(f.started('A').length, 1)
  assert.equal(f.started('B').length, 1)
})

test('restarting after controller loss preserves uncertain leases and does not launch replacement workers', hostExecution, async t => {
  const f = fixture(t)
  await f.prepare()
  const plan = await f.ok('run-wave')
  const child = f.startController(plan.runDigest)
  const terminal = new Promise((resolve, reject) => {
    child.once('close', (code, signal) => resolve({ code, signal }))
    child.once('error', reject)
  })
  try {
    await waitForWorkers(f)
    assert.equal(child.kill('SIGTERM'), true)
    assert.equal((await terminal).signal, 'SIGTERM')
    const current = await f.ok('status')
    assert.ok(Object.values(current.slots).every(slot => slot.phase === 'running' && slot.lease))
    assert.equal((await f.apply(plan.runDigest)).error.code, 'RUN_WAVE_STALE')
    const restarted = await f.ok('run-wave')
    assert.deepEqual(restarted.workers, [])
    assert.equal((await f.apply(restarted.runDigest)).error.code, 'RUN_WAVE_EMPTY')
    assert.equal(f.started('A').length, 1)
    assert.equal(f.started('B').length, 1)
  } finally {
    f.release()
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await terminal
    const pids = readdirSync(f.markers).flatMap(id => f.started(id).map(marker => marker.pid))
    // These are the two fixture PIDs. Observer-only signal 0 confirms their
    // natural exit after release, even though their controller was interrupted.
    const alive = pid => {
      try { process.kill(pid, 0); return true }
      catch (error) { if (error.code === 'ESRCH') return false; throw error }
    }
    const deadline = Date.now() + 5_000
    while (pids.some(alive) && Date.now() < deadline) await delay(25)
    assert.ok(pids.every(pid => !alive(pid)), 'A released fixture worker did not exit')
  }
})

test('a provider failure returns nonzero with both terminal results and restart does not rerun either slot', hostExecution, async t => {
  const f = fixture(t)
  await f.prepare('B')
  const plan = await f.ok('run-wave')
  f.release()
  const out = await f.apply(plan.runDigest)
  assert.equal(out.code, 1, JSON.stringify(out))
  assert.equal(out.result.status, 'partial')
  assert.equal(out.result.applied, true)
  assert.deepEqual(out.result.workers.map(w => [w.taskId, w.phase]), [['A', 'review'], ['B', 'failed']])
  const current = await f.ok('status')
  assert.equal(current.slots[1].providerResult.exitCode, 0)
  assert.equal(current.slots[2].providerResult.exitCode, 7)
  assert.ok(Object.values(current.slots).every(slot => slot.providerResult.ownedGroupStopped))
  assert.deepEqual(current.executions, [])
  const next = await f.ok('run-wave')
  assert.deepEqual(next.workers, [])
  assert.equal((await f.apply(next.runDigest)).error.code, 'RUN_WAVE_EMPTY')
  assert.equal(f.started('A').length, 1)
  assert.equal(f.started('B').length, 1)
})

for (const drift of ['dirty worktree', 'advanced HEAD']) {
  test('a stale reviewed digest after ' + drift + ' launches no members of the wave', async t => {
    const f = fixture(t)
    const prepared = await f.prepare()
    const plan = await f.ok('run-wave')
    const worker = prepared.slots[2].worktree
    if (drift === 'dirty worktree') writeFileSync(join(worker, 'B.txt'), 'local change')
    else f.git(worker, 'commit', '--allow-empty', '-qm', 'Worker advanced after review')
    const out = await f.apply(plan.runDigest)
    assert.equal(out.code, 1, JSON.stringify(out))
    assert.equal(out.error?.code, 'RUN_WAVE_STALE', JSON.stringify(out))
    assert.deepEqual(readdirSync(f.markers), [])
    const latest = await f.ok('status')
    assert.equal(latest.revision, prepared.revision)
    assert.ok(Object.values(latest.slots).every(slot => slot.phase === 'ready'))
    assert.equal(latest.events.filter(e => e.event === 'provider-launch-requested').length, 0)
  })
}
