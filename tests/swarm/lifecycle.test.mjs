/** Real local Git transport + synthetic gh responses. No GitHub/network action is performed. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { createController, digest } from '../../.SYSTEMX/swarm/runtime.mjs'

const node = realpathSync(process.execPath), git = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()
const command = (cwd, args) => { const result = spawnSync(git, args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim() }
const refuses = (code, action) => assert.rejects(action, error => error.code === code)
function fixture(t) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-lifecycle-'))), repo = join(temp, 'repo'), bare = join(temp, 'remote.git'), bin = join(temp, 'bin'), api = join(temp, 'api.json')
  for (const path of [repo, bin]) mkdirSync(path)
  command(repo, ['init', '-b', 'main']); command(repo, ['config', 'user.name', 'Swarm lifecycle']); command(repo, ['config', 'user.email', 'lifecycle@example.invalid'])
  writeFileSync(join(repo, '.gitignore'), '.SYSTEMX/state/\nignored-fixture\n'); writeFileSync(join(repo, 'README.md'), 'Synthetic local GitHub lifecycle\n'); command(repo, ['add', '.']); command(repo, ['commit', '-m', 'baseline'])
  command(temp, ['clone', '--bare', repo, bare]); command(repo, ['remote', 'add', 'origin', 'https://github.com/example/synthetic.git'])
  const actualGit = git, wrapper = join(bin, 'git')
  writeFileSync(wrapper, `#!${node}\nimport{spawnSync}from'node:child_process';const args=process.argv.slice(2);if(args.includes('ls-remote')||args.includes('push')||args.includes('fetch')){for(let i=0;i<args.length;i++)if(args[i]==='origin')args[i]=${JSON.stringify(bare)}}const r=spawnSync(${JSON.stringify(actualGit)},args,{stdio:'inherit'});process.exit(r.status??1);`)
  chmodSync(wrapper, 0o700)
  const previousPath = process.env.PATH; process.env.PATH = `${bin}:${previousPath}`
  const gh = join(temp, 'gh-fixture')
  writeFileSync(api, JSON.stringify({ calls: [], pr: null }))
  writeFileSync(gh, `#!${node}\nimport{readFileSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';const file=${JSON.stringify(api)},bare=${JSON.stringify(bare)},git=${JSON.stringify(actualGit)};const data=JSON.parse(readFileSync(file,'utf8')),args=process.argv.slice(2);data.calls.push(args);const out=x=>process.stdout.write(JSON.stringify(x));const get=(flag)=>args[args.indexOf(flag)+1];const run=(a,input)=>execFileSync(git,['--git-dir',bare,...a],{encoding:'utf8',input}).trim();
if(args[0]==='api'&&!args.includes('PUT'))out({required_status_checks:{strict:true,contexts:['CI']},required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true},enforce_admins:{enabled:true}});
else if(args[1]==='create'){const branch=get('--head'),head=run(['rev-parse','refs/heads/'+branch]),base=run(['rev-parse','refs/heads/main']);data.pr={number:17,state:'OPEN',isDraft:true,headRefName:branch,headRefOid:head,baseRefName:'main',baseRefOid:base,mergeable:'MERGEABLE',mergeStateStatus:'CLEAN',reviewDecision:'APPROVED',statusCheckRollup:[{name:'CI',status:'COMPLETED',conclusion:'SUCCESS'}],url:'https://github.com/example/synthetic/pull/17'};if(data.createFailAfterWrite){writeFileSync(file,JSON.stringify(data));process.exit(7)}out(data.pr)}
else if(args[1]==='ready'){data.pr.isDraft=false;out(data.pr)}
else if(args[0]==='api'&&args.includes('PUT')){if(args.includes('--auto')||args.includes('--admin')||!args.includes('sha='+data.pr.headRefOid))process.exit(5);if(!data.leaveOpen){const tree=run(['rev-parse',data.pr.headRefOid+'^{tree}']),base=run(['rev-parse','refs/heads/main']);const merged=run(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit-tree',tree,'-p',base], 'Synthetic squash merge\\n');run(['update-ref','refs/heads/main',merged,base]);data.pr.state='MERGED';data.pr.mergeCommit={oid:merged}}if(data.mergeFailAfterWrite){writeFileSync(file,JSON.stringify(data));process.exit(8)}out({merged:data.pr.state==='MERGED',sha:data.pr.mergeCommit?.oid??null})}
else if(args[1]==='list'||args[1]==='view'){if(data.pr?.state==='OPEN'&&!data.keepHead){data.pr.headRefOid=run(['rev-parse','refs/heads/'+data.pr.headRefName]);data.pr.baseRefOid=run(['rev-parse','refs/heads/main'])}out(args[1]==='list'?(data.pr?[data.pr]:[]):data.pr)}else process.exit(4);writeFileSync(file,JSON.stringify(data));`)
  chmodSync(gh, 0o700)
  const provider = join(temp, 'provider.mjs')
  writeFileSync(provider, "import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{dirname}from'node:path';import{execFileSync}from'node:child_process';const p=JSON.parse(readFileSync(0,'utf8')),path=p.task.allowedPaths[0];mkdirSync(dirname(path),{recursive:true});writeFileSync(path,p.task.id);execFileSync('git',['add','--',path]);execFileSync('git',['commit','-m',p.task.id]);")
  const head = command(repo, ['rev-parse', 'HEAD']), stateDir = join(repo, '.SYSTEMX', 'state', 'swarm', 'fixture')
  const manifest = { schemaVersion: 1, runId: 'fixture', repository: 'example/synthetic', baseBranch: 'main', baseRevision: head, maxWorkers: 10, externalWorkers: 0, requiredChecks: ['CI'], autoMerge: true, tasks: [1, 2].map(number => ({ id: `T${number}`, title: `Synthetic lifecycle task ${number}`, acceptance: ['The assigned synthetic source is committed and retained.'], allowedPaths: [`files/${number}.txt`], checks: [{ executable: node, args: ['-e', `require('node:assert/strict').equal(require('node:fs').readFileSync('files/${number}.txt','utf8'),'T${number}')`] }], dependsOn: number === 2 ? ['T1'] : [] })) }
  const controller = createController({ repo, manifest, stateDir })
  const readApi = () => JSON.parse(readFileSync(api, 'utf8')), writeApi = value => writeFileSync(api, JSON.stringify(value))
  t.after(() => { process.env.PATH = previousPath; rmSync(temp, { recursive: true, force: true }) })
  return { temp, repo, bare, gh, api, provider, controller, stateDir, readApi, writeApi }
}
async function reviewed(f) {
  await f.controller.prepare({ taskId: 'T1', slot: 1, executable: node, args: [f.provider], apply: true })
  await f.controller.run({ slot: 1, syncDigest: f.controller.sync(1).syncDigest, apply: true })
  await f.controller.verify({ slot: 1, apply: true })
  await f.controller.review({ slot: 1, reviewer: 'agent.z', evidenceDigest: 'b'.repeat(64), apply: true })
  await f.controller.alpha({ slot: 1, evidenceDigest: 'c'.repeat(64), apply: true })
}
async function published(f) {
  await reviewed(f); await f.controller.publish({ slot: 1, ghExecutable: f.gh, apply: true }); await f.controller.ready({ slot: 1, ghExecutable: f.gh, apply: true })
}
test('synthetic PR lifecycle retains branches during review, verifies exact merge, archives original squash history and reassigns a fresh generation', async t => {
  const f = fixture(t); await published(f)
  const before = f.controller.status().slots['1'], plan = await f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh })
  assert.equal(before.phase, 'merge-eligible'); assert.ok(existsSync(before.worktree)); assert.equal(plan.applied, false)
  const merged = await f.controller.merge({ slot: 1, prNumber: 17, planDigest: plan.planDigest, ghExecutable: f.gh, apply: true })
  assert.equal(merged.phase, 'merged'); assert.equal(merged.acceptanceGranted, false)
  await refuses('CLOSURE_NOT_READY', () => f.controller.close({ slot: 1, ghExecutable: f.gh, apply: true }))
  await f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'd'.repeat(64), ghExecutable: f.gh, apply: true })
  const closed = await f.controller.close({ slot: 1, ghExecutable: f.gh, deleteBranch: true, apply: true }); assert.equal(closed.branchRetained, false)
  const state = f.controller.status(), archive = state.slots['1'].archive
  assert.equal(digest(readFileSync(archive.file)), archive.sha256)
  assert.match(command(f.repo, ['bundle', 'list-heads', archive.file]), new RegExp(before.headRevision))
  assert.equal(existsSync(before.worktree), false)
  assert.equal(command(f.repo, ['ls-remote', f.bare, `refs/heads/${before.branch}`]), '')
  const mainHead = command(f.repo, ['--git-dir', f.bare, 'rev-parse', 'refs/heads/main'])
  command(f.repo, ['fetch', f.bare, 'main']); command(f.repo, ['merge', '--ff-only', 'FETCH_HEAD'])
  await f.controller.advance({ baseRevision: mainHead, apply: true })
  assert.equal(f.controller.next(1).nextTask.id, 'T2')
  await f.controller.prepare({ taskId: 'T2', slot: 1, executable: node, args: [f.provider], apply: true })
  const next = f.controller.status().slots['1']; assert.equal(next.generation, 2); assert.notEqual(next.branch, before.branch); assert.equal(next.baseRevision, mainHead)
  assert.deepEqual(f.controller.status().acceptedTaskIds, ['T1'])
  assert.ok(f.readApi().calls.some(args => args[0] === 'api' && args.includes('PUT') && args.includes('sha='+before.headRevision) && !args.includes('--admin') && !args.includes('--auto')))
})
test('stale Alpha lease and remote candidate changes never submit the merge action', async t => {
  const f = fixture(t); await published(f)
  const stateFile = join(f.stateDir, 'state.json'), state = JSON.parse(readFileSync(stateFile, 'utf8')); state.slots['1'].alpha.expiresAt = '2000-01-01T00:00:00.000Z'; writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 })
  await refuses('ALPHA_LEASE_STALE', () => f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh }))
  assert.equal(f.readApi().calls.filter(args => args[0] === 'api' && args.includes('PUT')).length, 0)
  await f.controller.alpha({ slot: 1, evidenceDigest: 'c'.repeat(64), apply: true })
  const data = f.readApi(); data.pr.headRefOid = 'e'.repeat(40); data.keepHead = true; f.writeApi(data)
  await refuses('PR_NOT_READY', () => f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh }))
  assert.equal(f.readApi().calls.filter(args => args[0] === 'api' && args.includes('PUT')).length, 0)
})
test('an OPEN response after immediate merge remains unverified and cannot become task acceptance', async t => {
  const f = fixture(t); await published(f)
  const data = f.readApi(); data.leaveOpen = true; f.writeApi(data)
  const plan = await f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh })
  const result = await f.controller.merge({ slot: 1, prNumber: 17, planDigest: plan.planDigest, ghExecutable: f.gh, apply: true })
  assert.equal(result.phase, 'merge-pending'); assert.equal(result.deferredAutoMergeRequested, false)
  await refuses('ACCEPTANCE_REQUIRED', () => f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'd'.repeat(64), ghExecutable: f.gh, apply: true }))
  assert.equal((await f.controller.observeMerge({ slot: 1, ghExecutable: f.gh, apply: true })).merged, false)
})
test('ignored worker files prevent optional retirement and remain available after accepted merge', async t => {
  const f = fixture(t); await published(f)
  const plan = await f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh }); await f.controller.merge({ slot: 1, prNumber: 17, planDigest: plan.planDigest, ghExecutable: f.gh, apply: true }); await f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'd'.repeat(64), ghExecutable: f.gh, apply: true })
  const slot = f.controller.status().slots['1'], ignored = join(slot.worktree, 'ignored-fixture'); writeFileSync(ignored, 'preserve local data')
  await refuses('CLOSURE_LOCAL_DATA', () => f.controller.close({ slot: 1, ghExecutable: f.gh, deleteBranch: true, apply: true }))
  assert.equal(readFileSync(ignored, 'utf8'), 'preserve local data'); assert.equal(f.controller.status().slots['1'].phase, 'accepted')
  assert.equal((await f.controller.close({ slot: 1, ghExecutable: f.gh, apply: true })).worktreeRetained, true)
})
test('uncertain PR creation is read back and recovered without creating a second pull request', async t => {
  const f = fixture(t); await reviewed(f)
  const data = f.readApi(); data.createFailAfterWrite = true; f.writeApi(data)
  const uncertain = await f.controller.publish({ slot: 1, ghExecutable: f.gh, apply: true })
  assert.equal(uncertain.phase, 'publication-pending'); assert.equal(uncertain.acceptanceGranted, false)
  assert.equal(f.controller.status().slots['1'].phase, 'publication-pending')
  const recovered = await f.controller.publish({ slot: 1, ghExecutable: f.gh, apply: true })
  assert.equal(recovered.recovered, true); assert.equal(recovered.pr.number, 17)
  assert.equal(f.readApi().calls.filter(args => args[1] === 'create').length, 1)
})
test('an uncertain immediate merge cannot be resubmitted and recovers only through exact target readback', async t => {
  const f = fixture(t); await published(f)
  const data = f.readApi(); data.mergeFailAfterWrite = true; f.writeApi(data)
  const plan = await f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh })
  const uncertain = await f.controller.merge({ slot: 1, prNumber: 17, planDigest: plan.planDigest, ghExecutable: f.gh, apply: true })
  assert.equal(uncertain.phase, 'merge-pending'); assert.equal(uncertain.retryAllowed, false)
  await refuses('MERGE_NOT_READY', () => f.controller.merge({ slot: 1, prNumber: 17, planDigest: plan.planDigest, ghExecutable: f.gh, apply: true }))
  const recovered = await f.controller.observeMerge({ slot: 1, ghExecutable: f.gh, apply: true }); assert.equal(recovered.phase, 'merged')
  assert.equal(f.readApi().calls.filter(args => args[0] === 'api' && args.includes('PUT')).length, 1)
  const changed = f.readApi(); changed.pr.baseRefName = 'other'; f.writeApi(changed)
  await refuses('MERGE_UNVERIFIED', () => f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'd'.repeat(64), ghExecutable: f.gh, apply: true }))
  changed.pr.baseRefName = 'main'; f.writeApi(changed)
  await f.controller.accept({ slot: 1, reviewer: 'agent.0', evidenceDigest: 'd'.repeat(64), ghExecutable: f.gh, apply: true })
  changed.pr.baseRefName = 'other'; f.writeApi(changed)
  await refuses('CLOSURE_UNVERIFIED', () => f.controller.close({ slot: 1, ghExecutable: f.gh, apply: true }))
})
test('a worker integrates a newer target, reruns its gates and updates its existing PR without rewriting the branch', async t => {
  const f = fixture(t); await published(f)
  const before = f.controller.status().slots['1']
  writeFileSync(join(f.repo, 'elsewhere.txt'), 'independent accepted work'); command(f.repo, ['add', 'elsewhere.txt']); command(f.repo, ['commit', '-m', 'independent target change']); command(f.repo, ['push', f.bare, 'main'])
  const nextBase = command(f.repo, ['rev-parse', 'HEAD'])
  await refuses('BASE_STALE', () => f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh }))
  const integrated = await f.controller.integrate({ slot: 1, baseRevision: nextBase, apply: true })
  assert.equal(integrated.phase, 'review'); assert.equal(integrated.baseRevision, nextBase); assert.notEqual(integrated.headRevision, before.headRevision)
  const reset = f.controller.status().slots['1']; assert.equal(reset.branch, before.branch); assert.equal(reset.checks, null); assert.equal(reset.review, null); assert.equal(reset.alpha, null)
  assert.equal(readFileSync(join(reset.worktree, 'elsewhere.txt'), 'utf8'), 'independent accepted work')
  await f.controller.verify({ slot: 1, apply: true }); await f.controller.review({ slot: 1, reviewer: 'agent.z', evidenceDigest: 'b'.repeat(64), apply: true }); await f.controller.alpha({ slot: 1, evidenceDigest: 'c'.repeat(64), apply: true })
  const updated = await f.controller.publish({ slot: 1, ghExecutable: f.gh, apply: true }); assert.equal(updated.pr.number, 17); assert.equal(updated.pr.headRevision, integrated.headRevision)
  assert.equal(f.readApi().calls.filter(args => args[1] === 'create').length, 1)
  const plan = await f.controller.mergePlan({ slot: 1, prNumber: 17, ghExecutable: f.gh }); assert.equal(plan.baseRevision, nextBase)
})
