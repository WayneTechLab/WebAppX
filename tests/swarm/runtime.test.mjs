import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createController, digest, inspectRepository, pinExecutable, qualifyProtection, qualifyPullRequest, runChild, validateManifest } from '../../.SYSTEMX/swarm/runtime.mjs'

const node = realpathSync(process.execPath)
const run = (cwd, args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim() }
const rejectsCode = (code, action) => assert.rejects(action, error => error.code === code)
const throwsCode = (code, action) => assert.throws(action, error => error.code === code)
function fixture(t, count = 2) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'systemx-swarm-'))), repo = join(temp, 'repo')
  mkdirSync(repo); run(repo, ['init', '-b', 'main']); run(repo, ['config', 'user.email', 'swarm@example.invalid']); run(repo, ['config', 'user.name', 'Swarm Fixture'])
  writeFileSync(join(repo, '.gitignore'), '.SYSTEMX/state/\n'); writeFileSync(join(repo, 'README.md'), 'Synthetic swarm fixture.\n')
  run(repo, ['add', '.']); run(repo, ['commit', '-m', 'fixture baseline'])
  const head = run(repo, ['rev-parse', 'HEAD']), stateDir = join(repo, '.SYSTEMX', 'state', 'swarm', 'fixture')
  const manifest = { schemaVersion: 1, runId: 'fixture', repository: 'example/synthetic', baseBranch: 'main', baseRevision: head, maxWorkers: 10, externalWorkers: 0, reservedPaths: ['coordinator/'], requiredChecks: ['CI'], autoMerge: true, tasks: Array.from({ length: count }, (_, index) => ({ id: `TASK${index + 1}`, title: `Synthetic task ${index + 1}`, acceptance: ['The assigned fixture file exists and is committed.'], allowedPaths: [`workers/slot${index + 1}.txt`], checks: [{ executable: node, args: ['-e', `require('node:assert/strict').equal(require('node:fs').readFileSync('workers/slot${index + 1}.txt','utf8'),'completed\\n')`] }], dependsOn: [] })) }
  const provider = join(temp, 'provider.mjs')
  writeFileSync(provider, `import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { dirname } from 'node:path'; import { execFileSync } from 'node:child_process';
const packet=JSON.parse(readFileSync(0,'utf8')); const path=packet.task.allowedPaths[0]; mkdirSync(dirname(path),{recursive:true});
const complete=()=>{writeFileSync(path,'completed\\n');execFileSync('git',['add','--',path]);execFileSync('git',['commit','-m','complete '+packet.task.id]);console.log('synthetic-provider-output')};if(process.argv[2]==='--gate'){writeFileSync(process.argv[3]+'/'+packet.task.id,'started');const timer=setInterval(()=>{if(existsSync(process.argv[4])){clearInterval(timer);complete()}},10)}else setTimeout(complete,Number(process.argv[2]||0));`)
  const controller = createController({ repo, manifest, stateDir })
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  return { temp, repo, head, manifest, stateDir, provider, controller }
}
test('manifest bounds ten shared slots, explicit checks, dependency closure and immutable protected scopes', () => {
  const manifest = { schemaVersion: 1, runId: 'review', repository: 'example/repo', baseBranch: 'main', baseRevision: 'a'.repeat(40), maxWorkers: 10, externalWorkers: 0, requiredChecks: ['CI'], autoMerge: true, tasks: [{ id: 'T1', title: 'One synthetic task', acceptance: ['A meaningful independent acceptance.'], allowedPaths: ['.SYSTEMX/LAN/Website/'], checks: [{ executable: 'node', args: ['--test'] }], dependsOn: [] }] }
  assert.equal(validateManifest(manifest).maxWorkers, 10)
  for (const maxWorkers of [0, 11, 1.5]) throwsCode('MANIFEST_INVALID', () => validateManifest({ ...manifest, maxWorkers }))
  throwsCode('MANIFEST_INVALID', () => validateManifest({ ...manifest, externalWorkers: 11 }))
  throwsCode('MANIFEST_INVALID', () => validateManifest({ ...manifest, requiredChecks: [] }))
  for (const path of ['../private', '/absolute', 'src\\x', 'src/%2e', '.git/config', '.env.local', '.SYSTEMX/state/private', '.SYSTEMX/.systemx/releases/x']) throwsCode('SCOPE_INVALID', () => validateManifest({ ...manifest, tasks: [{ ...manifest.tasks[0], allowedPaths: [path] }] }))
  throwsCode('DEPENDENCY_CYCLE', () => validateManifest({ ...manifest, tasks: [{ ...manifest.tasks[0], dependsOn: ['T1'] }] }))
  throwsCode('SCOPE_RESERVED', () => validateManifest({ ...manifest, reservedPaths: ['.systemx/lan/'], tasks: manifest.tasks }))
})
test('planning is read-only, mutations need apply, private state cannot enter tracked paths', async t => {
  const f = fixture(t)
  assert.equal(f.controller.plan().availableSlots, 10); assert.equal(existsSync(f.stateDir), false)
  await rejectsCode('APPLY_REQUIRED', () => f.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider] }))
  assert.equal(existsSync(f.stateDir), false)
  throwsCode('STATE_NOT_PRIVATE', () => createController({ repo: f.repo, manifest: f.manifest, stateDir: join(f.repo, 'tracked-state') }))
})
test('ten isolated real Git worktrees and CLI processes execute concurrently without accepting tasks', { timeout: 30_000 }, async t => {
  const f = fixture(t, 10)
  const markers = join(f.temp, 'markers'), release = join(f.temp, 'release'); mkdirSync(markers)
  for (let slot = 1; slot <= 10; slot += 1) await f.controller.prepare({ taskId: `TASK${slot}`, slot, executable: node, args: [f.provider, '--gate', markers, release], apply: true })
  const before = f.controller.status()
  assert.equal(new Set(Object.values(before.slots).map(slot => slot.branch)).size, 10)
  assert.equal(new Set(Object.values(before.slots).map(slot => slot.worktree)).size, 10)
  const points = Array.from({ length: 10 }, (_, index) => f.controller.sync(index + 1))
  const jobs = points.map(point => f.controller.run({ slot: point.slot, syncDigest: point.syncDigest, apply: true }))
  try {
    const deadline = Date.now() + 15_000
    while (readdirSync(markers).length < 10 && Date.now() < deadline) await delay(20)
    assert.equal(readdirSync(markers).length, 10, 'all ten providers must enter their owned worktrees before any is released')
  } finally { writeFileSync(release, 'complete all owned providers') }
  const results = await Promise.all(jobs)
  assert.ok(results.every(result => result.phase === 'review' && result.acceptanceGranted === false))
  const state = f.controller.status()
  assert.ok(Object.values(state.slots).every(slot => slot.phase === 'review' && slot.headRevision !== f.head))
  assert.deepEqual(state.acceptedTaskIds, [])
  assert.equal(run(f.repo, ['rev-parse', 'HEAD']), f.head)
  assert.equal(inspectRepository(f.repo).clean, true)
  assert.equal(lstatSync(join(f.stateDir, 'state.json')).mode & 0o077, 0)
  assert.doesNotMatch(readFileSync(join(f.stateDir, 'state.json'), 'utf8'), /synthetic-provider-output/)
})
test('capacity includes declared IDE workers and scope leases conservatively detect case aliases', async t => {
  const f = fixture(t)
  const manifest = { ...f.manifest, externalWorkers: 9 }
  const controller = createController({ repo: f.repo, manifest, stateDir: f.stateDir })
  await controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider], apply: true })
  await rejectsCode('CAPACITY_EXCEEDED', () => controller.prepare({ taskId: 'TASK2', slot: 2, executable: node, args: [f.provider], apply: true }))
  const g = fixture(t)
  g.manifest.tasks[1].allowedPaths = ['WORKERS/SLOT1.TXT']
  const overlapping = createController({ repo: g.repo, manifest: g.manifest, stateDir: g.stateDir })
  await overlapping.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [g.provider], apply: true })
  await rejectsCode('SCOPE_LEASE_CONFLICT', () => overlapping.prepare({ taskId: 'TASK2', slot: 2, executable: node, args: [g.provider], apply: true }))
})
test('IDE/Codex handoff is exact generation/head/phase bound; occupied branch stays open', async t => {
  const f = fixture(t)
  await f.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider], apply: true })
  const sync = f.controller.sync(1)
  assert.equal(f.controller.sync(1, sync.syncDigest).executionAuthority, false)
  await rejectsCode('SYNC_STALE', () => f.controller.run({ slot: 1, syncDigest: 'b'.repeat(64), apply: true }))
  await rejectsCode('SLOT_BUSY', () => f.controller.prepare({ taskId: 'TASK2', slot: 1, executable: node, args: [f.provider], apply: true }))
  await f.controller.run({ slot: 1, syncDigest: sync.syncDigest, apply: true })
  throwsCode('SYNC_STALE', () => f.controller.sync(1, sync.syncDigest))
  await rejectsCode('ACCEPTANCE_REQUIRED', () => f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'b'.repeat(64), apply: true }))
  await rejectsCode('CLOSURE_NOT_READY', () => f.controller.close({ slot: 1, apply: true }))
})
test('provider identity and scope violations fail closed and preserve work for Agent 0', async t => {
  const f = fixture(t)
  const executable = join(f.temp, 'provider-bin'); writeFileSync(executable, '#!/bin/sh\nexit 0\n'); chmodSync(executable, 0o700)
  await f.controller.prepare({ taskId: 'TASK1', slot: 1, executable, apply: true })
  writeFileSync(executable, '#!/bin/sh\nexit 2\n'); chmodSync(executable, 0o700)
  await rejectsCode('PROVIDER_CHANGED', () => f.controller.run({ slot: 1, syncDigest: f.controller.sync(1).syncDigest, apply: true }))
  const g = fixture(t)
  const outside = join(g.temp, 'outside.mjs'); writeFileSync(outside, "import{writeFileSync}from'node:fs';writeFileSync('outside.txt','keep this evidence');")
  await g.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [outside], apply: true })
  await rejectsCode('SCOPE_VIOLATION', () => g.controller.run({ slot: 1, syncDigest: g.controller.sync(1).syncDigest, apply: true }))
  const state = g.controller.status(); assert.equal(state.slots['1'].phase, 'failed'); assert.equal(readFileSync(join(state.slots['1'].worktree, 'outside.txt'), 'utf8'), 'keep this evidence')
})
test('checks, Z review and Alpha lease are distinct exact-head records; feedback invalidates authority', async t => {
  const f = fixture(t)
  await f.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider], apply: true })
  await f.controller.run({ slot: 1, syncDigest: f.controller.sync(1).syncDigest, apply: true })
  await rejectsCode('REVIEW_REQUIRED', () => f.controller.review({ slot: 1, reviewer: 'agent.z', evidenceDigest: 'b'.repeat(64), apply: true }))
  const checked = await f.controller.verify({ slot: 1, apply: true }); assert.equal(checked.passed, true)
  await rejectsCode('REVIEW_REQUIRED', () => f.controller.review({ slot: 1, reviewer: 'agent.alpha', evidenceDigest: 'b'.repeat(64), apply: true }))
  await f.controller.review({ slot: 1, reviewer: 'agent.z', evidenceDigest: 'b'.repeat(64), apply: true })
  const alpha = await f.controller.alpha({ slot: 1, evidenceDigest: 'c'.repeat(64), expiresMinutes: 1, apply: true })
  assert.equal(alpha.independentIdentityAuthenticated, false)
  assert.equal(alpha.checksDigest, digest(f.controller.status().slots['1'].checks))
  await f.controller.feedback({ slot: 1, reason: 'Review the edge case again.', apply: true })
  const slot = f.controller.status().slots['1']; assert.equal(slot.phase, 'review'); assert.equal(slot.checks, null); assert.equal(slot.review, null); assert.equal(slot.alpha, null)
})
test('dirty coordinator, linked state directories, stale locks and malformed state refuse without cleanup', async t => {
  const f = fixture(t)
  writeFileSync(join(f.repo, 'dirty.txt'), 'preserve')
  await rejectsCode('BASE_STALE', () => f.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider], apply: true }))
  rmSync(join(f.repo, 'dirty.txt'))
  mkdirSync(f.stateDir, { recursive: true }); writeFileSync(join(f.stateDir, 'controller.lock'), 'owned elsewhere', { mode: 0o600 })
  await rejectsCode('CONTROLLER_BUSY', () => f.controller.prepare({ taskId: 'TASK1', slot: 1, executable: node, args: [f.provider], apply: true }))
  assert.equal(readFileSync(join(f.stateDir, 'controller.lock'), 'utf8'), 'owned elsewhere')
  rmSync(f.stateDir, { recursive: true }); const privateTarget = join(f.temp, 'private'); mkdirSync(privateTarget); symlinkSync(privateTarget, f.stateDir)
  throwsCode('STATE_PATH_REFUSED', () => f.controller.status())
  assert.deepEqual(readFileSync(join(f.repo, 'README.md'), 'utf8'), 'Synthetic swarm fixture.\n')
})
test('merge gate rejects stale identities, missing/ambiguous checks and unprotected bases', () => {
  const slot = { headRevision: 'b'.repeat(40), baseRevision: 'a'.repeat(40), branch: 'codex/swarm/test/y01-g001-t1' }, manifest = { baseBranch: 'main', requiredChecks: ['CI'] }
  const pr = { number: 3, state: 'OPEN', isDraft: false, headRefName: slot.branch, headRefOid: slot.headRevision, baseRefName: 'main', baseRefOid: slot.baseRevision, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', reviewDecision: 'APPROVED', statusCheckRollup: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }], url: 'https://github.com/example/synthetic/pull/3' }
  assert.equal(qualifyPullRequest({ pr, slot, manifest }).acceptanceGranted, false)
  for (const changes of [{ isDraft: true }, { headRefOid: 'c'.repeat(40) }, { baseRefOid: 'd'.repeat(40) }, { reviewDecision: 'REVIEW_REQUIRED' }, { mergeable: 'CONFLICTING' }]) throwsCode('PR_NOT_READY', () => qualifyPullRequest({ pr: { ...pr, ...changes }, slot, manifest }))
  for (const rollup of [[], [{ name: 'CI', conclusion: 'SKIPPED' }], [...pr.statusCheckRollup, { name: 'CI', conclusion: 'NEUTRAL' }], [...pr.statusCheckRollup, { name: 'Extra', conclusion: 'FAILURE' }]]) throwsCode('CHECKS_NOT_READY', () => qualifyPullRequest({ pr: { ...pr, statusCheckRollup: rollup }, slot, manifest }))
  const protection = { required_status_checks: { strict: true, contexts: ['CI'] }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true }, enforce_admins: { enabled: true } }
  assert.equal(qualifyProtection(protection, ['CI']), true)
  for (const changes of [{ enforce_admins: { enabled: false } }, { required_status_checks: { strict: false, contexts: ['CI'] } }, { required_pull_request_reviews: { required_approving_review_count: 0, dismiss_stale_reviews: true } }]) throwsCode('PROTECTION_UNVERIFIED', () => qualifyProtection({ ...protection, ...changes }, ['CI']))
})
test('bounded provider execution keeps raw outputs private, enforces deadline and reports its termination boundary', async t => {
  const f = fixture(t)
  const ok = await runChild(node, ['-e', "process.stdout.write('raw synthetic secret-free provider text')"], { cwd: f.repo })
  assert.equal(ok.exitCode, 0); assert.equal(ok.stdoutSha256, digest('raw synthetic secret-free provider text')); assert.doesNotMatch(JSON.stringify(ok), /raw synthetic/)
  const timeout = await runChild(node, ['-e', 'setInterval(()=>{},1000)'], { cwd: f.repo, timeoutMs: 80 })
  assert.equal(timeout.timedOut, true); assert.match(timeout.terminationBoundary, /detached descendants unqualified/)
  const over = await runChild(node, ['-e', "process.stdout.write('x'.repeat(10000));setInterval(()=>{},1000)"], { cwd: f.repo, outputBytes: 100 })
  assert.equal(over.outputLimit, true)
})
test('provider pinning refuses relative executables and symlink aliases', t => {
  const f = fixture(t)
  throwsCode('PROVIDER_PATH_INVALID', () => pinExecutable('node'))
  const link = join(f.temp, 'node-link'); symlinkSync(node, link)
  throwsCode('PROVIDER_PATH_INVALID', () => pinExecutable(link))
})
