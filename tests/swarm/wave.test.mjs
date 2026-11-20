import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../.SYSTEMX/swarm/cli.mjs', import.meta.url))
const node = realpathSync(process.execPath)

function task(id, allowedPaths = [`owned/${id}.txt`], dependsOn = []) {
  return { id, title: id, allowedPaths, dependsOn, acceptance: ['The assigned file is reviewed.'], checks: [{ executable: 'node', args: ['--version'] }] }
}

function fixture(t, tasks, { maxWorkers = 10, externalWorkers = 0 } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-wave-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo'), manifestPath = join(root, 'manifest.json')
  const privateState = join(repo, '.SYSTEMX', 'state', 'swarm', 'wave')
  const stateFile = join(privateState, 'state.json')
  const env = {
    ...process.env, GIT_ALLOW_PROTOCOL: 'file', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'empty.gitconfig'), GIT_TERMINAL_PROMPT: '0',
    GH_CONFIG_DIR: join(root, 'gh'), GH_PROMPT_DISABLED: '1',
  }
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OPTIONAL_LOCKS']) delete env[key]
  mkdirSync(repo)
  writeFileSync(env.GIT_CONFIG_GLOBAL, '')
  function git(...args) {
    const r = spawnSync('git', args, { cwd: repo, env, encoding: 'utf8', timeout: 15_000 })
    assert.equal(r.status, 0, r.error?.message ?? r.stderr)
    return r.stdout.trim()
  }
  git('init', '-b', 'main')
  git('config', 'user.name', 'Wave fixture')
  git('config', 'user.email', 'wave@example.invalid')
  writeFileSync(join(repo, '.gitignore'), '.SYSTEMX/state/\n')
  writeFileSync(join(repo, 'README.md'), 'Fixture\n')
  git('add', '.')
  git('commit', '-m', 'Fixture baseline')
  const base = git('rev-parse', 'HEAD')
  writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, runId: 'wave', repository: 'example/wave', baseBranch: 'main', baseRevision: base, maxWorkers, externalWorkers, tasks }))
  function invoke(command, args = [], expectedError = null) {
    const r = spawnSync(node, [cli, command, '--repo', repo, '--manifest', manifestPath, '--state-dir', privateState, ...args], { cwd: root, env, encoding: 'utf8', timeout: 20_000 })
    assert.equal(r.status, expectedError ? 1 : 0, r.error?.message ?? r.stderr)
    if (expectedError) assert.equal(JSON.parse(r.stderr).code, expectedError)
    else return JSON.parse(r.stdout)
  }
  // Register an isolated local worker. None of these tests starts its executable.
  const prepare = (slot, id) => invoke('prepare', ['--slot', String(slot), '--task', id, '--executable', node, '--apply'])
  // Seed observations of previous lifecycle stages without creating a PR or calling a provider.
  function editState(change) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'))
    change(state)
    state.revision++
    writeFileSync(stateFile, JSON.stringify(state))
    return state
  }
  function observeWave() {
    const wave = invoke('wave')
    assert.equal(wave.applied, false)
    assert.equal(wave.executionAuthority, false)
    return wave
  }
  return { root, repo, base, git, privateState, prepare, editState, invoke, observeWave }
}

// Include ignored private state, worktrees, Git index, refs and objects. Do not follow links.
function fingerprint(root) {
  const files = []
  function walk(path, relative) {
    const stat = lstatSync(path, { bigint: true })
    const content = stat.isDirectory() ? null : stat.isSymbolicLink() ? readlinkSync(path) : createHash('sha256').update(readFileSync(path)).digest('hex')
    files.push([relative, String(stat.mode), String(stat.mtimeNs), content])
    if (stat.isDirectory()) for (const entry of readdirSync(path).sort()) walk(join(path, entry), `${relative}/${entry}`)
  }
  walk(root, '.')
  return files
}

const assignment = (slot, generation, taskId, allowedPaths) => ({ slot, generation, taskId, allowedPaths })
const assignments = wave => wave.assignments.map(({ slot, generation, taskId, allowedPaths }) => assignment(slot, generation, taskId, allowedPaths))
function blocked(wave, code) {
  assert.deepEqual(wave.assignments, [])
  assert.equal(wave.blockedBy, code)
}

test('wave proposes deterministic, mutually exclusive scopes in manifest order and writes nothing', t => {
  const f = fixture(t, [
    task('DEPENDENT', ['later/'], ['FIRST']),
    task('FIRST', ['src/ui/', 'shared/theme.css']),
    task('NESTED', ['SRC/UI/menu.ts']),
    task('ALIAS', ['Shared/Theme.css']),
    task('CHILD_OF_FILE', ['Shared/Theme.css/v2']),
    task('SIBLING', ['src/ui-kit/']),
    task('OTHER', ['docs/']),
  ])
  // Git status normally refreshes index stat data after a timestamp-only change.
  utimesSync(join(f.repo, 'README.md'), new Date(0), new Date(0))
  const before = fingerprint(f.root)
  const wave = f.observeWave()
  assert.equal(wave.stateRevision, 0)
  assert.equal(wave.blockedBy, null)
  assert.deepEqual(assignments(wave), [
    assignment(1, 1, 'FIRST', ['src/ui/', 'shared/theme.css']),
    assignment(2, 1, 'SIBLING', ['src/ui-kit/']),
    assignment(3, 1, 'OTHER', ['docs/']),
  ])
  assert.deepEqual(f.observeWave(), wave)
  assert.equal(existsSync(f.privateState), false)
  assert.deepEqual(fingerprint(f.root), before)
})

test('wave accounts for app workers and noncontiguous active slots, including cross-platform path conflicts', t => {
  const f = fixture(t, [task('FIRST', ['src/menu.ts']), task('CONFLICT', ['SRC/']), task('SECOND'), task('THIRD')], { maxWorkers: 4, externalWorkers: 2 })
  f.prepare(3, 'FIRST')
  const before = fingerprint(f.root)
  const wave = f.observeWave()
  assert.equal(wave.externalWorkers, 2)
  assert.equal(wave.availableSlots, 1)
  assert.equal(wave.progress.activeGenerations, 1)
  assert.equal(wave.stateRevision, 1)
  assert.deepEqual(assignments(wave), [assignment(1, 1, 'SECOND', ['owned/SECOND.txt'])])
  assert.deepEqual(f.observeWave(), wave)
  assert.deepEqual(fingerprint(f.root), before)

  f.prepare(1, 'SECOND')
  const afterPrepare = fingerprint(f.root)
  blocked(f.observeWave(), 'CAPACITY_EXCEEDED')
  assert.equal(f.invoke('next', ['--slot', '2']).nextTask, null)
  f.invoke('next', ['--slot', '3'], 'SLOT_BUSY')
  assert.deepEqual(fingerprint(f.root), afterPrepare)
})

test('a ten-worker wave assigns slots numerically and leaves excess ready work queued', t => {
  const tasks = Array.from({ length: 12 }, (_, i) => task(`T${i + 1}`))
  const f = fixture(t, tasks)
  const wave = f.observeWave()
  assert.deepEqual(assignments(wave), tasks.slice(0, 10).map((item, i) => assignment(i + 1, 1, item.id, item.allowedPaths)))
  assert.equal(wave.progress.remainingTasks, 12)
  assert.equal(wave.progress.activeGenerations, 0)
  assert.equal(existsSync(f.privateState), false)
})

test('external clients can consume the entire worker budget before the first dispatch', t => {
  const f = fixture(t, [task('WAIT')], { maxWorkers: 10, externalWorkers: 10 })
  const before = fingerprint(f.root)
  blocked(f.observeWave(), 'CAPACITY_EXCEEDED')
  assert.equal(f.invoke('next').nextTask, null)
  assert.deepEqual(fingerprint(f.root), before)
})

test('an active lease blocks all overlapping work while dependent tasks wait for acceptance', t => {
  const f = fixture(t, [task('HELD', ['src/Tabs/']), task('OVERLAP', ['src/tabs/view.ts']), task('LATER', ['docs/'], ['HELD'])])
  f.prepare(1, 'HELD')
  blocked(f.observeWave(), 'SCOPE_LEASE_CONFLICT')
  const waiting = fixture(t, [task('PARENT'), task('CHILD', ['docs/'], ['PARENT'])])
  waiting.prepare(1, 'PARENT')
  blocked(waiting.observeWave(), 'NO_READY_TASKS')
})

test('dirty coordinator, moved HEAD and divergent named base individually stop dispatch', t => {
  const f = fixture(t, [task('A')])
  writeFileSync(join(f.repo, 'README.md'), 'Dirty draft\n')
  blocked(f.observeWave(), 'BASE_STALE')
  assert.equal(f.invoke('next').nextTask, null)
  f.git('commit', '-am', 'Local target moved')
  blocked(f.observeWave(), 'BASE_STALE')
  f.git('checkout', '--detach', f.base)
  blocked(f.observeWave(), 'BASE_STALE')
})

test('a locally recorded target advance holds all new dispatch until the barrier is advanced', t => {
  const f = fixture(t, [task('BASE'), task('NEXT', ['docs/'], ['BASE'])])
  f.prepare(1, 'BASE')
  const merge = f.git('commit-tree', 'HEAD^{tree}', '-p', f.base, '-m', 'Synthetic merge')
  f.editState(state => {
    const slot = state.slots['1']
    slot.phase = 'merged'
    slot.pr = { mergeCommit: merge }
    slot.targetObservation = { targetRevision: merge, mergeCommit: merge }
    state.events.push({ event: 'merge-verified', slot: 1, mergeCommit: merge })
  })
  blocked(f.observeWave(), 'SYNC_BARRIER_REQUIRED')
  f.editState(state => {
    state.slots['1'].phase = 'closed'
    state.acceptedTaskIds = ['BASE']
    state.events.push({ event: 'generation-closed', slot: 1, taskId: 'BASE' })
  })
  blocked(f.observeWave(), 'SYNC_BARRIER_REQUIRED')
  assert.equal(f.invoke('next', ['--slot', '1']).nextTask, null)
  f.git('merge', '--ff-only', merge)
  f.editState(state => {
    state.events.push({ event: 'sync-barrier-advanced', slot: null, previousBaseRevision: state.baseRevision, baseRevision: merge })
    state.baseRevision = merge
  })
  const before = fingerprint(f.root)
  const wave = f.observeWave()
  assert.deepEqual(assignments(wave), [assignment(1, 2, 'NEXT', ['docs/'])])
  assert.equal(wave.progress.acceptedTasks, 1)
  assert.equal(wave.progress.remainingTasks, 1)
  assert.equal(wave.progress.complete, false)
  assert.deepEqual(fingerprint(f.root), before)
})

test('completion requires every task accepted and every generation closed', t => {
  const f = fixture(t, [task('LAST')])
  f.prepare(1, 'LAST')
  f.editState(state => {
    state.acceptedTaskIds = ['LAST']
    state.slots['1'].phase = 'accepted'
    state.events.push({ event: 'delivery-accepted', slot: 1, mergeCommit: f.base })
  })
  const wave = f.observeWave()
  blocked(wave, 'AWAITING_CLOSURE')
  assert.equal(wave.progress.totalTasks, 1)
  assert.equal(wave.progress.acceptedTasks, 1)
  assert.equal(wave.progress.remainingTasks, 0)
  assert.equal(wave.progress.activeGenerations, 1)
  assert.equal(wave.progress.complete, false)
  f.editState(state => {
    state.slots['1'].phase = 'closed'
    state.events.push({ event: 'generation-closed', slot: 1, taskId: 'LAST' })
  })
  const before = fingerprint(f.root)
  const complete = f.observeWave()
  blocked(complete, 'COMPLETE')
  assert.equal(complete.progress.complete, true)
  assert.equal(complete.progress.activeGenerations, 0)
  assert.deepEqual(fingerprint(f.root), before)
})

test('CLI rejects execution flags for wave and out-of-range slot numbers for next without writes', t => {
  const f = fixture(t, [task('A')], { maxWorkers: 3 })
  const before = fingerprint(f.root)
  f.invoke('wave', ['--apply'], 'OPTION_INVALID')
  f.invoke('wave', ['--slot', '1'], 'OPTION_INVALID')
  for (const slot of ['0', '4', '1.5', 'invalid']) f.invoke('next', ['--slot', slot], 'SLOT_INVALID')
  assert.deepEqual(fingerprint(f.root), before)
})
