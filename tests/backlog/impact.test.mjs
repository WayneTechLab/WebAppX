import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createImpactReport, defaultCatalogPath, formatImpactReport, impactLimits, parseImpactArguments, parseNameStatus } from '../../scripts/backlog-impact.mjs'
import { render } from '../../scripts/webappx-backlog.mjs'

const script = fileURLToPath(new URL('../../scripts/backlog-impact.mjs', import.meta.url))
const catalogScript = fileURLToPath(new URL('../../scripts/webappx-backlog.mjs', import.meta.url))
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
const git = (cwd, ...args) => {
  const child = spawnSync('git', ['--no-optional-locks', ...args], { cwd, env: childEnv, shell: false, timeout: 10_000, maxBuffer: 8_388_608, encoding: 'utf8', windowsHide: true })
  assert.equal(child.status, 0, child.stderr)
  return child.stdout.trim()
}
const item = (id, source, status = 'todo') => ({ id, source, status, area: 'setup', priority: 'P1', phase: 'foundation', title: `Specific proposal for ${id}`, acceptance: `Observe the explicit fixture result for ${id}.`, gate: 'local', dependsOn: [], ...(status === 'done' ? { completion: { verifiedOn: '2026-10-15', sourceBase: 'a'.repeat(40), evidence: 'docs/receipt.md', reviewedBy: 'agent.0' } } : {}) })
const catalogFor = items => ({ schemaVersion: 1, project: 'WebAppX', intent: 'proposed-backlog', createdOn: '2026-10-15', sourceCommit: 'a'.repeat(40), items })
async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), value)
}
async function catalogWrite(root, catalog, views = false) {
  await put(root, defaultCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
  if (views) {
    const result = render(catalog)
    await put(root, 'docs/backlog/WEBAPPX-1000-TODO.md', result.markdown)
    await put(root, 'docs/backlog/webappx-1000-todo.csv', result.csv)
  }
}
async function fixture(t, items = [item('WX-0001', 'src')], files = { 'src/a.ts': 'before\n' }, views = false) {
  const root = await mkdtemp(join(tmpdir(), 'webappx-impact-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Synthetic impact fixture')
  git(root, 'config', 'user.email', 'fixture@example.invalid')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'core.filemode', 'true')
  const catalog = catalogFor(items)
  await catalogWrite(root, catalog, views)
  for (const [path, value] of Object.entries(files)) await put(root, path, value)
  await put(root, '.SYSTEMX/WORK/TASKS.json', '{"tasks":[]}\n')
  await put(root, '.SYSTEMX/PLAN/MASTER-PLAN.md', '# Blank adoption seed\n')
  const commit = message => { git(root, 'add', '--all'); git(root, '-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : '/dev/null'}`, 'commit', '--quiet', '-m', message); return git(root, 'rev-parse', 'HEAD') }
  const from = commit('baseline')
  return { root, from, catalog, commit, report: options => createImpactReport({ repositoryRoot: root, from, to: 'HEAD', ...options }) }
}
const paths = report => report.changes.flatMap(change => change.paths.map(entry => entry.path)).sort()

test('committed changes match exact and directory scopes, both rename endpoints, deletes, types and modes', async t => {
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'src/deleted.ts', 'done'), item('WX-0003', 'src/old name.ts'), item('WX-0004', 'moved/new name.ts'), item('WX-0005', 'src/type.ts'), item('WX-0006', 'scripts/run.sh'), item('WX-0007', 'src-extra'), item('WX-0008', 'src/prefix'), item('WX-0009', 'src/new.ts')], { 'src/deleted.ts': 'deleted\n', 'src/old name.ts': 'stable rename contents\n', 'src/type.ts': 'regular file\n', 'scripts/run.sh': '#!/bin/sh\n', 'src/prefix-other.ts': 'before\n' })
  await rm(join(f.root, 'src/deleted.ts'))
  await mkdir(join(f.root, 'moved'))
  await rename(join(f.root, 'src/old name.ts'), join(f.root, 'moved/new name.ts'))
  await put(f.root, 'src/new.ts', 'added\n')
  await put(f.root, 'src/prefix-other.ts', 'after\n')
  git(f.root, 'add', '--all')
  git(f.root, 'update-index', '--chmod=+x', 'scripts/run.sh')
  const symlinkOid = git(f.root, 'hash-object', '-w', '--stdin')
  git(f.root, 'update-index', '--cacheinfo', `120000,${symlinkOid},src/type.ts`)
  git(f.root, 'commit', '--quiet', '-m', 'committed change types')
  const report = await f.report()
  assert.deepEqual(report.proposals.map(value => [value.id, value.matchedPaths]), [
    ['WX-0001', ['src/deleted.ts', 'src/new.ts', 'src/old name.ts', 'src/prefix-other.ts', 'src/type.ts']],
    ['WX-0002', ['src/deleted.ts']], ['WX-0003', ['src/old name.ts']], ['WX-0004', ['moved/new name.ts']], ['WX-0005', ['src/type.ts']], ['WX-0006', ['scripts/run.sh']], ['WX-0009', ['src/new.ts']],
  ])
  assert.deepEqual(report.changes.map(change => [change.status, change.paths.map(value => value.path)]), [
    ['R100', ['src/old name.ts', 'moved/new name.ts']], ['M', ['scripts/run.sh']], ['D', ['src/deleted.ts']], ['A', ['src/new.ts']], ['M', ['src/prefix-other.ts']], ['T', ['src/type.ts']],
  ])
  assert.equal(report.counts.acceptedScopeReviewRequired, 1)
  assert.equal(report.proposals[1].catalogStatus, 'done')
  assert.ok(report.proposals.every(value => value.reviewRequired))
})

test('identical trees resolve full commit IDs and bind exact committed catalog bytes', async t => {
  const f = await fixture(t)
  git(f.root, 'tag', '-a', 'reviewed-baseline', '-m', 'annotated fixture tag')
  const report = await f.report({ from: f.from.slice(0, 10), to: 'reviewed-baseline' })
  assert.equal(report.fromRevision, f.from)
  assert.equal(report.toRevision, f.from)
  assert.equal(report.catalog.revision, f.from)
  assert.equal(report.catalog.sha256, createHash('sha256').update(await readFile(join(f.root, defaultCatalogPath))).digest('hex'))
  assert.deepEqual(report.proposals, [])
  assert.equal(report.counts.reviewRequired, 0)
  assert.equal(report.truncation.outputTruncated, false)
  assert.match(formatImpactReport(report), /Review required: 0 proposals/)
  assert.doesNotMatch(JSON.stringify(report), /\/Users\/|\/Volumes\/|webappx-impact-/)
})

test('explicit historical catalog revision consistently chooses its own source mapping and digest', async t => {
  const f = await fixture(t, [item('WX-0001', 'src/a.ts')])
  f.catalog.items[0].source = 'src/other.ts'
  await catalogWrite(f.root, f.catalog)
  await put(f.root, 'src/a.ts', 'changed source\n')
  f.commit('move proposal mapping')
  const current = await f.report()
  const historical = await f.report({ catalogRevision: f.from })
  assert.deepEqual(current.proposals, [])
  assert.deepEqual(historical.proposals.map(value => [value.id, value.referencedScopes, value.matchedPaths]), [['WX-0001', ['src/a.ts'], ['src/a.ts']]])
  assert.equal(historical.catalog.selection, 'explicit-revision')
  assert.equal(historical.catalog.revision, f.from)
  assert.notEqual(historical.catalog.sha256, current.catalog.sha256)
  assert.deepEqual(current.catalogChanges.definitionChangedProposalIds, ['WX-0001'])
  assert.equal(current.counts.reviewRequired, 1)
  assert.equal(historical.counts.reviewRequired, 1)
})

test('status and completion metadata with exact generated companions do not trigger broad document scope reviews', async t => {
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'docs')], undefined, true)
  f.catalog.items[0] = item('WX-0001', 'src', 'done')
  await catalogWrite(f.root, f.catalog, true)
  f.commit('review metadata only')
  const report = await f.report()
  assert.deepEqual(paths(report), ['docs/backlog/WEBAPPX-1000-TODO.md', 'docs/backlog/webappx-1000-todo.csv', defaultCatalogPath].sort())
  assert.deepEqual(report.changes.map(change => change.paths[0].classification).sort(), ['catalog', 'generated-catalog-metadata', 'generated-catalog-metadata'])
  assert.equal(report.counts.reviewRequired, 0)
  assert.equal(report.catalogChanges.state, 'metadata-only')
  assert.deepEqual(report.catalogChanges.metadataChangedProposalIds, ['WX-0001'])
  assert.deepEqual(report.proposals, [])
})

test('hand-edited generated documents remain reviewable document changes during metadata edits', async t => {
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'docs')], undefined, true)
  f.catalog.items[0] = item('WX-0001', 'src', 'done')
  await catalogWrite(f.root, f.catalog, true)
  const path = 'docs/backlog/WEBAPPX-1000-TODO.md'
  await put(f.root, path, `${(await readFile(join(f.root, path), 'utf8'))}\nA manually edited document claim.\n`)
  f.commit('metadata plus document edit')
  const report = await f.report()
  assert.deepEqual(report.proposals.map(value => [value.id, value.matchedPaths]), [['WX-0002', [path]]])
  assert.equal(report.counts.productScopePaths, 1)
})

test('definition and acceptance edits produce separate exact-ID review advisories', async t => {
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'docs'), item('WX-0003', 'tests')])
  f.catalog.items[0].acceptance = 'Observe a newly reviewed specific acceptance condition.'
  f.catalog.items[1].title = 'A changed proposal definition title'
  f.catalog.items[2] = item('WX-0003', 'tests', 'done')
  await catalogWrite(f.root, f.catalog)
  f.commit('definitions and acceptance metadata')
  const report = await f.report({ limit: 1 })
  assert.equal(report.catalogChanges.state, 'proposal-definitions-changed')
  assert.deepEqual(report.catalogChanges.definitionChangedProposalIds, ['WX-0001'])
  assert.equal(report.catalogChanges.definitionReviewRequired, 2)
  assert.equal(report.catalogChanges.omittedDefinitionProposalIds, 1)
  assert.deepEqual(report.catalogChanges.metadataChangedProposalIds, ['WX-0003'])
  assert.equal(report.counts.reviewRequired, 2)
  assert.equal(report.counts.scopeReviewRequired, 0)
  assert.equal(report.truncation.outputTruncated, true)
})

test('deleted catalog can be examined only through an explicit available catalog revision', async t => {
  const f = await fixture(t)
  await rm(join(f.root, defaultCatalogPath))
  f.commit('remove catalog')
  await assert.rejects(f.report(), /regular blob/)
  const report = await f.report({ catalogRevision: f.from })
  assert.equal(report.catalogChanges.state, 'deleted')
  assert.deepEqual(report.catalogChanges.definitionChangedProposalIds, ['WX-0001'])
  assert.equal(report.counts.scopeReviewRequired, 0)
  assert.equal(report.counts.reviewRequired, 1)
})

test('matching uses complete case-sensitive path segments and retains tabs and newlines from Git', async t => {
  if (process.platform === 'win32') { t.skip('Windows filesystems do not support newline/tab fixture names.'); return }
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'src-extra'), item('WX-0003', 'SRC'), item('WX-0004', 'src/a.ts')])
  await put(f.root, 'src/with\ttab\nand space.ts', 'new\n')
  await put(f.root, 'src-extra/a.ts', 'new\n')
  await put(f.root, 'src/a.ts-child', 'new\n')
  f.commit('literal path boundaries')
  const report = await f.report()
  assert.deepEqual(report.proposals.map(value => [value.id, value.matchedPaths]), [['WX-0001', ['src/a.ts-child', 'src/with\ttab\nand space.ts']], ['WX-0002', ['src-extra/a.ts']]])
})

test('reporting from committed trees preserves dirty worktree, index and blank canonical seeds', async t => {
  const f = await fixture(t)
  await put(f.root, 'src/a.ts', 'committed change\n'); f.commit('source change')
  const expected = await f.report()
  await put(f.root, defaultCatalogPath, 'deliberately invalid workingtree JSON\n')
  await put(f.root, 'src/a.ts', 'unstaged local work\n')
  await put(f.root, 'staged.txt', 'staged local work\n'); git(f.root, 'add', 'staged.txt')
  await put(f.root, 'untracked.txt', 'untracked local work\n')
  await mkdir(join(f.root, 'scripts'), { recursive: true })
  await copyFile(script, join(f.root, 'scripts/backlog-impact.mjs'))
  await copyFile(catalogScript, join(f.root, 'scripts/webappx-backlog.mjs'))
  const files = [defaultCatalogPath, 'src/a.ts', 'staged.txt', 'untracked.txt', '.git/index', '.SYSTEMX/WORK/TASKS.json', '.SYSTEMX/PLAN/MASTER-PLAN.md']
  const before = await Promise.all(files.map(path => readFile(join(f.root, path))))
  const status = git(f.root, 'status', '--porcelain=v2', '-z', '--untracked-files=all')
  assert.deepEqual(await f.report(), expected)
  for (const json of [false, true]) {
    const result = spawnSync(process.execPath, [join(f.root, 'scripts/backlog-impact.mjs'), '--from', f.from, '--to', 'HEAD', ...(json ? ['--json'] : [])], { cwd: f.root, env: childEnv, shell: false, encoding: 'utf8', timeout: 15_000, maxBuffer: 1_048_576 })
    assert.equal(result.status, 0, result.stderr)
    if (json) assert.deepEqual(JSON.parse(result.stdout), expected)
    else assert.match(result.stdout, /WX-0001 \(todo; review required\)/)
  }
  assert.deepEqual(await Promise.all(files.map(path => readFile(join(f.root, path)))), before)
  assert.equal(git(f.root, 'status', '--porcelain=v2', '-z', '--untracked-files=all'), status)
})

test('display limits retain exact review/change counts and bound each emitted proposal match list', async t => {
  const f = await fixture(t, [item('WX-0001', 'src'), item('WX-0002', 'src'), item('WX-0003', 'src', 'done')])
  for (let index = 0; index < 30; index++) await put(f.root, `src/file-${String(index).padStart(2, '0')}.ts`, 'new\n')
  f.commit('many source paths')
  const report = await f.report({ limit: 1, changeLimit: 1 })
  assert.deepEqual(report.counts, { proposals: 3, changedRecords: 30, changedPaths: 30, productScopePaths: 30, scopeReviewRequired: 3, acceptedScopeReviewRequired: 1, definitionReviewRequired: 0, reviewRequired: 3 })
  assert.equal(report.proposals.length, 1)
  assert.equal(report.proposals[0].matchedPaths.length, 20)
  assert.equal(report.proposals[0].omittedMatchedPaths, 10)
  assert.deepEqual(report.truncation, { omittedChangeRecords: 29, omittedProposals: 2, omittedMatchedPaths: 10, outputTruncated: true })
})

test('revision, CLI and catalog-path ambiguity is refused without defaults or filesystem substitution', async t => {
  const f = await fixture(t)
  for (const revisions of [{ from: undefined }, { to: undefined }, { from: 'missing-local-branch' }, { to: `${f.from}^{tree}` }, { catalogRevision: 'missing-catalog-revision' }, { from: '--all' }]) await assert.rejects(f.report(revisions), /explicit|revision|Git query failed/)
  for (const path of ['../outside.json', '/outside.json', 'docs/./catalog.json', 'docs\\catalog.json', 'docs/catalog.json#claim', 'C:/outside.json', ':(glob)**']) await assert.rejects(f.report({ catalogPath: path }), /safe repository-relative/)
  for (const args of [[], ['--from', 'HEAD'], ['--from', 'HEAD', '--to', 'HEAD', '--from', 'HEAD'], ['--from', 'HEAD', '--to', 'HEAD', '--limit', '0'], ['--from', 'HEAD', '--to', 'HEAD', '--change-limit', '201'], ['--from', 'HEAD', '--to', 'HEAD', '--limit', '1.5'], ['--json', '--json'], ['--help', '--json'], ['--unknown']]) assert.throws(() => parseImpactArguments(args))
  assert.deepEqual(parseImpactArguments(['--from', 'HEAD~1', '--to', 'HEAD', '--json', '--limit', '2']), { from: 'HEAD~1', to: 'HEAD', json: true, limit: 2 })
  assert.deepEqual(parseImpactArguments(['--help']), { help: true })
})

test('catalog scopes remain lexical data and malformed committed catalogs are refused', async t => {
  const f = await fixture(t)
  for (const badCatalog of [catalogFor([item('WX-0001', '../outside')]), catalogFor([item('WX-0001', '/outside')]), catalogFor([item('WX-0001', 'src'), item('WX-0001', 'src')]), catalogFor([{ ...item('WX-0001', 'src'), id: ['WX-0001'] }]), catalogFor([{ ...item('WX-0001', 'src'), id: ['WX-0001'] }, { ...item('WX-0001', 'src'), id: ['WX-0001'] }]), { ...f.catalog, schemaVersion: 2 }, { ...f.catalog, items: [] }]) {
    await catalogWrite(f.root, badCatalog); f.commit('malformed committed catalog')
    await assert.rejects(f.report(), /schema 1|unique proposal IDs/)
  }
})

test('NUL protocol rejects incomplete or unsafe records before producing candidates', () => {
  assert.deepEqual(parseNameStatus('R100\0old name\0new name\0M\0script\0'), [{ status: 'R100', paths: ['old name', 'new name'] }, { status: 'M', paths: ['script'] }])
  for (const output of ['M\0file', 'R100\0old\0', 'M\0../outside\0', 'M\0/absolute\0', 'Z\0file\0', 'R101\0old\0new\0', 'M\0\0']) assert.throws(() => parseNameStatus(output), /NUL|Invalid/)
  assert.throws(() => parseNameStatus(Buffer.from([77, 0, 255, 0])), /encoded data/)
  assert.throws(() => parseNameStatus(Array.from({ length: impactLimits.changes + 1 }, (_, index) => `M\0f${index}\0`).join('')), /input limit/)
})

test('timeouts, signals, partial NUL and output overflow refuse the whole comparison', async t => {
  const f = await fixture(t)
  for (const [failure, expected] of [
    [{ error: { code: 'ETIMEDOUT' }, status: null }, /timed out/],
    [{ error: { code: 'ENOBUFS' }, status: null }, /output limit/],
    [{ signal: 'SIGTERM', status: null }, /query failed/],
    [{ status: 0, stdout: Buffer.from('M\0unfinished') }, /Incomplete NUL/],
    [{ status: 0, stdout: Buffer.alloc(impactLimits.gitBytes + 1) }, /output limit/],
  ]) {
    const run = (command, args, options) => args.includes('diff') ? failure : spawnSync(command, args, options)
    await assert.rejects(f.report({ run }), expected)
  }
  const run = (command, args, options) => args.includes('cat-file') ? { status: 0, stdout: Buffer.alloc(impactLimits.catalogBytes + 1) } : spawnSync(command, args, options)
  await assert.rejects(f.report({ run }), /output limit/)
})

test('inherited Git redirections, replacement refs, grafts and executable diff configuration cannot alter the report', async t => {
  const f = await fixture(t)
  await put(f.root, 'src/a.ts', 'real committed change\n'); const to = f.commit('source change')
  await put(f.root, 'src/a.ts', 'before\n'); const replacement = f.commit('replacement would hide source change')
  git(f.root, 'replace', to, replacement)
  await put(f.root, '.git/info/grafts', `${to} ${replacement}\n`)
  const sentinel = join(f.root, 'unexpected-helper-ran')
  git(f.root, 'config', 'diff.external', `node -e "require('fs').writeFileSync('unexpected-helper-ran','bad')"`)
  const environment = { ...process.env, GIT_DIR: '/unavailable-external-git', GIT_WORK_TREE: '/unavailable-worktree', GIT_INDEX_FILE: '/unavailable-index', GIT_OBJECT_DIRECTORY: '/unavailable-objects', GIT_ALTERNATE_OBJECT_DIRECTORIES: '/unavailable-alternates', GIT_CONFIG_GLOBAL: '/unavailable-global-config', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'diff.external', GIT_CONFIG_VALUE_0: 'unavailable-helper', GIT_TRACE: sentinel }
  const report = await f.report({ to, env: environment })
  assert.equal(report.toRevision, to)
  assert.deepEqual(report.proposals.map(value => [value.id, value.matchedPaths]), [['WX-0001', ['src/a.ts']]])
  await assert.rejects(readFile(sentinel), /ENOENT/)
})

test('external gitdirs, includes, object alternates and partial-clone automatic fetching are refused', async t => {
  const f = await fixture(t)
  const nested = join(f.root, 'nested')
  await mkdir(nested)
  await assert.rejects(createImpactReport({ repositoryRoot: nested, from: f.from, to: f.from }), /own local .git/)
  await put(nested, '.git', `gitdir: ${join(f.root, '.git')}\n`)
  await assert.rejects(createImpactReport({ repositoryRoot: nested, from: f.from, to: f.from }), /own local .git/)
  git(f.root, 'config', 'include.path', '/unavailable-external-config')
  await assert.rejects(f.report(), /config includes/)
  git(f.root, 'config', '--unset', 'include.path')
  await put(f.root, '.git/objects/info/alternates', '/unavailable-external-objects\n')
  await assert.rejects(f.report(), /object alternates/)
  await rm(join(f.root, '.git/objects/info/alternates'))
  git(f.root, 'config', 'remote.test.promisor', 'true')
  git(f.root, 'config', 'remote.test.url', 'https://example.invalid/never-contacted')
  await assert.rejects(f.report(), /promisor/)
})

test('catalog blobs and Git metadata symlinks never follow external files', async t => {
  const f = await fixture(t)
  const oid = git(f.root, 'hash-object', '-w', '--stdin')
  git(f.root, 'update-index', '--cacheinfo', `120000,${oid},${defaultCatalogPath}`)
  git(f.root, 'commit', '--quiet', '-m', 'catalog symlink blob')
  await assert.rejects(f.report(), /regular blob/)
  try { await symlink('/unavailable-external-ref', join(f.root, '.git/refs/heads/external')) }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('Windows metadata symlink check skipped: symlink privileges unavailable.'); return } throw error }
  await assert.rejects(f.report(), /metadata symlinks/)
})

test('worktree-specific include configuration is refused before starting Git', async t => {
  const f = await fixture(t)
  git(f.root, 'config', 'extensions.worktreeConfig', 'true')
  await put(f.root, '.git/config.worktree', '[include]\n\tpath = /unavailable-external-config\n')
  let calls = 0
  const run = () => { calls++; throw new Error('Git must not start for this unsupported metadata.') }
  await assert.rejects(f.report({ run }), /worktree-specific configuration/)
  assert.equal(calls, 0)
})

test('reflog and pseudo-ref metadata symlinks cannot bypass the checkout fence', async t => {
  const f = await fixture(t)
  let calls = 0
  const run = () => { calls++; throw new Error('Git must not start for symlink metadata.') }
  for (const [path, from] of [['.git/logs/HEAD', 'HEAD@{1}'], ['.git/ORIG_HEAD', 'ORIG_HEAD']]) {
    await rm(join(f.root, path), { force: true })
    try { await symlink('/unavailable-external-reflog', join(f.root, path)) }
    catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows symlink privileges unavailable.'); return } throw error }
    await assert.rejects(f.report({ from, run }), /metadata symlinks/)
    await rm(join(f.root, path))
  }
  assert.equal(calls, 0)
})
