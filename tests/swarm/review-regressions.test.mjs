import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { createController, qualifyProtection, qualifyPullRequest, runChild, validateManifest } from '../../.SYSTEMX/swarm/runtime.mjs'

const executable = realpathSync(process.execPath)
const head = 'a'.repeat(40), base = 'b'.repeat(40)
const slot = { headRevision: head, branch: 'codex/swarm/review/y01-g001-task', baseRevision: base }
const integrationManifest = { baseBranch: 'main', requiredChecks: ['ci'] }
const pull = (changes = {}) => ({
  number: 12, state: 'OPEN', isDraft: false, headRefOid: head, headRefName: slot.branch,
  baseRefName: 'main', baseRefOid: base, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
  reviewDecision: 'APPROVED', statusCheckRollup: [{ name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' }],
  url: 'https://github.com/example/fixture/pull/12', ...changes,
})
const protection = (changes = {}) => ({
  required_status_checks: { strict: true, contexts: ['ci'], checks: [] },
  required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
  enforce_admins: { enabled: true }, ...changes,
})
const task = (id, allowedPaths) => ({
  id, title: `Review fixture ${id}`, acceptance: ['Only the assigned fixture file is eligible.'], allowedPaths,
  checks: [{ executable, args: ['-e', 'process.exit(0)'] }], dependsOn: [],
})
const manifest = (changes = {}) => ({
  schemaVersion: 1, runId: 'review-regression', repository: 'example/fixture', baseBranch: 'main',
  baseRevision: base, maxWorkers: 2, externalWorkers: 0, reservedPaths: [], requiredChecks: ['ci'], autoMerge: false,
  tasks: [task('A', ['src/a.txt']), task('B', ['src/b.txt'])], ...changes,
})
const expectCode = (code) => (error) => error?.code === code

test('review: a named required check needs one unambiguous terminal success', () => {
  assert.equal(qualifyPullRequest({ pr: pull(), slot, manifest: integrationManifest }).acceptanceGranted, false)
  for (const duplicate of ['SKIPPED', 'NEUTRAL', 'SUCCESS']) {
    const pr = pull({ statusCheckRollup: [
      { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'ci', conclusion: duplicate, status: 'COMPLETED' },
    ] })
    assert.throws(() => qualifyPullRequest({ pr, slot, manifest: integrationManifest }), expectCode('CHECKS_NOT_READY'))
  }
  for (const check of [
    { name: 'ci', conclusion: 'SKIPPED', status: 'COMPLETED' },
    { name: 'ci', conclusion: 'SUCCESS', status: 'IN_PROGRESS' },
    { name: 'ci', conclusion: null, status: 'QUEUED' },
  ]) assert.throws(() => qualifyPullRequest({ pr: pull({ statusCheckRollup: [check] }), slot, manifest: integrationManifest }), expectCode('CHECKS_NOT_READY'))
})

test('review: a stale head, base, branch, review or mergeability cannot qualify', () => {
  for (const change of [
    { headRefOid: 'c'.repeat(40) }, { baseRefOid: 'd'.repeat(40) }, { headRefName: 'codex/unowned' },
    { baseRefName: 'release' }, { reviewDecision: 'REVIEW_REQUIRED' }, { mergeable: 'CONFLICTING' },
    { mergeStateStatus: 'BLOCKED' }, { isDraft: true }, { state: 'MERGED' },
  ]) assert.throws(() => qualifyPullRequest({ pr: pull(change), slot, manifest: integrationManifest }), expectCode('PR_NOT_READY'))
})

test('review: protection must explicitly require a positive integer approval count and current checks', () => {
  assert.equal(qualifyProtection(protection(), ['ci']), true)
  for (const count of [undefined, 0, -1, 0.5, '1', NaN]) {
    assert.throws(() => qualifyProtection(protection({ required_pull_request_reviews: { dismiss_stale_reviews: true, required_approving_review_count: count } }), ['ci']), expectCode('PROTECTION_UNVERIFIED'))
  }
  for (const change of [
    { required_status_checks: { strict: false, contexts: ['ci'] } },
    { required_status_checks: { strict: true, contexts: [] } },
    { required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: false } },
    { enforce_admins: { enabled: false } },
  ]) assert.throws(() => qualifyProtection(protection(change), ['ci']), expectCode('PROTECTION_UNVERIFIED'))
})

test('review: coordinator reservations cannot be bypassed with case aliases', () => {
  assert.throws(() => validateManifest(manifest({ reservedPaths: ['src/Foo/'], tasks: [task('A', ['src/foo/a.txt'])] })), expectCode('SCOPE_RESERVED'))
})

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false, timeout: 10_000, windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
function repositoryFixture(t, fields = {}) {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-swarm-review-')))
  const repo = join(temporary, 'repo'), stateDir = join(temporary, 'private-state')
  mkdirSync(join(repo, 'src'), { recursive: true })
  writeFileSync(join(repo, 'src/a.txt'), 'A\n'); writeFileSync(join(repo, 'src/b.txt'), 'B\n')
  git(repo, ['init', '-b', 'main']); git(repo, ['config', 'user.name', 'Synthetic swarm reviewer'])
  git(repo, ['config', 'user.email', 'fixture@example.invalid']); git(repo, ['config', 'commit.gpgsign', 'false'])
  git(repo, ['config', 'core.hooksPath', join(repo, '.git/disabled-hooks')])
  git(repo, ['add', 'src']); git(repo, ['commit', '-m', 'Synthetic base'])
  t.after(() => rmSync(temporary, { recursive: true, force: true }))
  const selected = manifest({ baseRevision: git(repo, ['rev-parse', 'HEAD']), ...fields })
  return { temporary, repo, stateDir, manifest: selected, controller: createController({ repo, manifest: selected, stateDir }) }
}
async function waitFor(check, label, milliseconds = 5000) {
  const deadline = Date.now() + milliseconds
  while (!check()) { if (Date.now() >= deadline) assert.fail(label); await delay(10) }
}

test('review: two owned providers can overlap while controller changes stay independently locked', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = repositoryFixture(t)
  const handshake = join(fixture.temporary, 'handshake'); mkdirSync(handshake)
  const code = [
    "const fs=require('node:fs'),path=require('node:path');let data='';process.stdin.on('data',part=>data+=part);",
    "process.stdin.on('end',()=>{const packet=JSON.parse(data),id=packet.task.id;",
    `const root=${JSON.stringify(handshake)};fs.writeFileSync(path.join(root,'started-'+id),String(process.pid));`,
    "const deadline=setTimeout(()=>process.exit(3),10000);const poll=setInterval(()=>{if(fs.existsSync(path.join(root,'release-'+id))){clearInterval(poll);clearTimeout(deadline);process.exit(0)}},10);});",
  ].join('')
  for (const [number, id] of [[1, 'A'], [2, 'B']]) await fixture.controller.prepare({ taskId: id, slot: number, executable, args: ['-e', code], apply: true })
  const syncA = fixture.controller.sync(1), syncB = fixture.controller.sync(2)
  const first = fixture.controller.run({ slot: 1, syncDigest: syncA.syncDigest, apply: true })
  let second
  try {
    await waitFor(() => existsSync(join(handshake, 'started-A')), 'First synthetic provider did not start')
    assert.equal(fixture.controller.status().slots['1'].phase, 'running')
    second = fixture.controller.run({ slot: 2, syncDigest: syncB.syncDigest, apply: true })
    await waitFor(() => existsSync(join(handshake, 'started-B')), 'Second synthetic provider could not overlap the first')
    const both = fixture.controller.status()
    assert.equal(both.slots['1'].phase, 'running')
    assert.equal(both.slots['2'].phase, 'running')
    writeFileSync(join(handshake, 'release-A'), '')
    assert.equal((await first).phase, 'review')
    writeFileSync(join(handshake, 'release-B'), '')
    assert.equal((await second).phase, 'review')
    assert.equal(fixture.controller.status().slots['1'].lease, undefined)
    assert.equal(fixture.controller.status().slots['2'].lease, undefined)
    assert.equal(git(fixture.repo, ['rev-parse', 'HEAD']), fixture.manifest.baseRevision)
    assert.equal(git(fixture.repo, ['status', '--porcelain']), '')
  } finally {
    writeFileSync(join(handshake, 'release-A'), ''); writeFileSync(join(handshake, 'release-B'), '')
    await Promise.allSettled([first, second].filter(Boolean))
  }
})

test('review: declared external workers consume the same capacity budget', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = repositoryFixture(t, { externalWorkers: 1 })
  await fixture.controller.prepare({ taskId: 'A', slot: 1, executable, args: ['-e', 'process.exit(0)'], apply: true })
  assert.equal(fixture.controller.plan().availableSlots, 0)
  await assert.rejects(fixture.controller.prepare({ taskId: 'B', slot: 2, executable, args: ['-e', 'process.exit(0)'], apply: true }), expectCode('CAPACITY_EXCEEDED'))
})

test('review: a broad host scope still cannot accept edits to an immutable release snapshot', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = repositoryFixture(t, { tasks: [task('A', ['.SYSTEMX/'])] })
  const relative = '.SYSTEMX/.systemx/releases/synthetic/source.txt'
  const code = `const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(path.dirname(${JSON.stringify(relative)}),{recursive:true});fs.writeFileSync(${JSON.stringify(relative)},'preserve failed-worker evidence')`
  await fixture.controller.prepare({ taskId: 'A', slot: 1, executable, args: ['-e', code], apply: true })
  await assert.rejects(fixture.controller.run({ slot: 1, syncDigest: fixture.controller.sync(1).syncDigest, apply: true }), expectCode('SCOPE_VIOLATION'))
  const current = fixture.controller.status().slots['1']
  assert.equal(current.phase, 'failed')
  assert.equal(readFileSync(join(current.worktree, relative), 'utf8'), 'preserve failed-worker evidence')
  assert.equal(existsSync(join(fixture.repo, relative)), false)
  assert.equal(git(fixture.repo, ['rev-parse', 'HEAD']), fixture.manifest.baseRevision)
})

test('review: Alpha cannot substitute for independent Z review and its lease stays explicitly bounded', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = repositoryFixture(t)
  await fixture.controller.prepare({ taskId: 'A', slot: 1, executable, args: ['-e', 'process.stdin.resume()'], apply: true })
  await fixture.controller.run({ slot: 1, syncDigest: fixture.controller.sync(1).syncDigest, apply: true })
  await fixture.controller.verify({ slot: 1, apply: true })
  const evidenceDigest = 'e'.repeat(64)
  await assert.rejects(fixture.controller.review({ slot: 1, reviewer: 'agent.alpha', evidenceDigest, apply: true }), expectCode('REVIEW_REQUIRED'))
  await assert.rejects(fixture.controller.alpha({ slot: 1, evidenceDigest, apply: true }), expectCode('ALPHA_REQUIRED'))
  const review = await fixture.controller.review({ slot: 1, reviewer: 'agent.z', evidenceDigest, apply: true })
  assert.equal(review.recordedOperatorAssertion, true)
  for (const expiresMinutes of [0, 16, 1.5]) await assert.rejects(fixture.controller.alpha({ slot: 1, evidenceDigest, expiresMinutes, apply: true }), expectCode('ALPHA_REQUIRED'))
  const lease = await fixture.controller.alpha({ slot: 1, evidenceDigest, expiresMinutes: 1, apply: true })
  assert.equal(lease.recordedOperatorAssertion, true)
  assert.equal(lease.independentIdentityAuthenticated, false)
  assert.equal(lease.headRevision, fixture.manifest.baseRevision)
  assert.ok(Date.parse(lease.expiresAt) > Date.now())
  assert.ok(Date.parse(lease.expiresAt) <= Date.now() + 60_000)
})

test('review: a detached descendant holding pipes cannot make the provider timeout unbounded', { skip: process.platform === 'win32' }, async (t) => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-swarm-pipe-review-')))
  const marker = join(temporary, 'owned-descendant.json'), ownedScript = join(temporary, 'owned-descendant.mjs')
  writeFileSync(ownedScript, "import { writeFileSync } from 'node:fs';writeFileSync(process.argv[2],JSON.stringify({pid:process.pid,script:process.argv[1]}));setInterval(()=>{},1000)\n")
  const code = `require('node:child_process').spawn(process.execPath,[${JSON.stringify(ownedScript)},${JSON.stringify(marker)}],{detached:true,stdio:['ignore',process.stdout,process.stderr]});setInterval(()=>{},1000)`
  const started = Date.now()
  let timer, result, knownPid
  try {
    const hardLimit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Provider pipe deadline was not bounded')), 5000) })
    result = await Promise.race([runChild(executable, ['-e', code], { cwd: temporary, timeoutMs: 1500 }), hardLimit])
    clearTimeout(timer)
    assert.equal(result.timedOut, true)
    assert.equal(result.pipeDeadline, true)
    assert.match(result.terminationBoundary, /detached descendants unqualified/)
    assert.ok(Date.now() - started < 5000)
    assert.ok(existsSync(marker), 'The synthetic detached descendant must actually have started')
    const recorded = JSON.parse(readFileSync(marker, 'utf8'))
    knownPid = recorded.pid
    assert.equal(recorded.script, ownedScript)
    const observed = spawnSync('ps', ['-p', String(knownPid), '-o', 'command='], { encoding: 'utf8', timeout: 1000 })
    assert.equal(observed.status, 0)
    assert.ok(observed.stdout.includes(ownedScript), 'Cleanup must identify this exact synthetic descendant')
  } finally {
    clearTimeout(timer)
    if (!knownPid && existsSync(marker)) knownPid = JSON.parse(readFileSync(marker, 'utf8')).pid
    if (knownPid) {
      const observed = spawnSync('ps', ['-p', String(knownPid), '-o', 'command='], { encoding: 'utf8', timeout: 1000 })
      if (observed.status === 0 && observed.stdout.includes(ownedScript)) { try { process.kill(-knownPid, 'SIGKILL') } catch { /* Only the proven synthetic descendant group. */ } }
      await waitFor(() => {
        const remaining = spawnSync('ps', ['-p', String(knownPid), '-o', 'command='], { encoding: 'utf8', timeout: 1000 })
        return remaining.status !== 0 || !remaining.stdout.includes(ownedScript)
      }, 'The explicitly owned synthetic descendant must stop before its fixture is removed', 2000)
    }
    rmSync(temporary, { recursive: true, force: true })
  }
})
