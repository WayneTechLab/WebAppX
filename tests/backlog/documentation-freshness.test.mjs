import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createFreshnessReport, defaultFreshnessDecisions, defaultFreshnessMapping, formatFreshnessReport, parseFreshnessArguments, recordFreshnessDecision, validateFreshnessDecisions, validateFreshnessMapping } from '../../scripts/documentation-freshness.mjs'
import { createImpactReport } from '../../scripts/backlog-impact.mjs'
import { render } from '../../scripts/webappx-backlog.mjs'

const today = '2026-10-15'
const catalogPath = 'docs/backlog/webappx-1000-todo.json'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
const git = (cwd, ...args) => {
  const child = spawnSync('git', ['--no-optional-locks', ...args], { cwd, env, shell: false, timeout: 10_000, maxBuffer: 8_388_608, encoding: 'utf8', windowsHide: true })
  assert.equal(child.status, 0, child.stderr)
  return child.stdout.trim()
}
async function put(root, path, bytes) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes) }
const catalogItem = (number, source = 'src') => ({ id: `WX-${String(number).padStart(4, '0')}`, source, status: 'todo', area: 'setup', priority: 'P1', phase: 'foundation', title: `Specific fixture proposal ${number}`, acceptance: `Observe the explicit fixture outcome for proposal ${number}.`, gate: 'local', dependsOn: [] })
const clone = value => structuredClone(value)

async function fixture(t, { scopes = ['src'], proposals = ['WX-0001'], items = 1, views = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'documentation-freshness-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Synthetic freshness fixture'); git(root, 'config', 'user.email', 'fixture@example.invalid'); git(root, 'config', 'core.autocrlf', 'false')
  const catalog = { schemaVersion: 1, project: 'WebAppX', intent: 'proposed-backlog', createdOn: today, sourceCommit: 'a'.repeat(40), items: Array.from({ length: items }, (_, index) => catalogItem(index + 1)) }
  const saveCatalog = async () => {
    await put(root, catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
    if (views) {
      const result = render(catalog)
      await put(root, 'docs/backlog/WEBAPPX-1000-TODO.md', result.markdown); await put(root, 'docs/backlog/webappx-1000-todo.csv', result.csv)
    }
  }
  await saveCatalog()
  await put(root, 'docs/guide.md', '# Reviewed fictional guide\n')
  await put(root, 'src/a.ts', 'before\n')
  await put(root, '.SYSTEMX/WORK/TASKS.json', '{"tasks":[]}\n')
  const commit = (label, paths = ['src']) => { git(root, 'add', '--', ...paths); git(root, 'commit', '--quiet', '-m', label); return git(root, 'rev-parse', 'HEAD') }
  git(root, 'add', '--all'); git(root, 'commit', '--quiet', '-m', 'baseline')
  const from = git(root, 'rev-parse', 'HEAD')
  await put(root, 'docs/receipt.md', `# Original dated receipt\nObserved ${today}; starting source base ${from}. This receipt describes historical fixture observations.\n`)
  const mapping = { schemaVersion: 1, intent: 'documentation-evidence-freshness', catalog: { path: catalogPath, revision: from, sha256: hash(await readFile(join(root, catalogPath))) }, guides: [{
    id: 'fixture-guide', guide: { path: 'docs/guide.md', sha256: hash(await readFile(join(root, 'docs/guide.md'))) }, examinedRevision: from,
    sourceReview: { reviewedOn: today, scope: 'Source-only inspection; historical browser observations keep the original receipt source base.' },
    proposalIds: proposals, sourceScopes: scopes,
    receipts: [{ path: 'docs/receipt.md', sha256: hash(await readFile(join(root, 'docs/receipt.md'))), category: 'browser', observedOn: today, observationRevision: from, revisionBasis: 'receipt-source-base', scope: 'Historical browser observation with a starting source base, without a new browser run.' }],
  }] }
  const saveMapping = () => put(root, defaultFreshnessMapping, `${JSON.stringify(mapping, null, 2)}\n`)
  await saveMapping()
  await put(root, defaultFreshnessDecisions, '{"schemaVersion":1,"intent":"documentation-review-decisions","decisions":[]}\n')
  const options = { repositoryRoot: root, to: 'HEAD', today }
  const report = extra => createFreshnessReport({ ...options, ...extra })
  const record = async (extra = {}) => {
    const preview = await report()
    return recordFreshnessDecision({ ...options, guide: 'fixture-guide', decision: 'retain', reviewedBy: 'fixture-reviewer', reviewedOn: today, rationale: 'Retain the original historical receipt; this source review records no new browser observations.', expectedReportDigest: preview.reportDigest, expectedDecisionsDigest: preview.decisions.sha256, ...extra })
  }
  return { root, from, mapping, catalog, saveCatalog, saveMapping, commit, report, record, options }
}

test('freshness reports literal relevant paths and retain original receipt qualifications', async t => {
  const f = await fixture(t, { scopes: ['src/a'] })
  await put(f.root, 'src/a/inside file.ts', 'changed\n'); await put(f.root, 'src/a-extra/outside.ts', 'unrelated\n'); f.commit('scoped changes')
  const report = await f.report()
  assert.deepEqual(report.counts, { guides: 1, sourceReviewRequired: 1, definitionReviewRequired: 0, reviewRequired: 1, historicalSourceBaseReceipts: 1 })
  assert.equal(report.targetRevision, git(f.root, 'rev-parse', 'HEAD'))
  assert.deepEqual(report.guides[0].changedPaths, ['src/a/inside file.ts'])
  assert.equal(report.guides[0].assessment, 'source-changes-require-review')
  assert.equal(report.guides[0].receipts[0].observationRevision, f.from)
  assert.equal(report.guides[0].receipts[0].observedOn, today)
  assert.match(report.guides[0].receipts[0].qualification, /starting source base.*not identify an exact/)
  assert.equal(report.guides[0].currentBrowserVerified, false)
  assert.match(report.boundary, /local.*not claimed to be committed blobs/)
  assert.match(formatFreshnessReport(report), /1 \/ 1 guides/)
})

test('unrelated source changes do not make a guide a review candidate', async t => {
  const f = await fixture(t, { scopes: ['src/a.ts'] })
  await put(f.root, 'src/a.ts-other', 'outside exact scope\n'); f.commit('unrelated source')
  const report = await f.report()
  assert.equal(report.counts.reviewRequired, 0)
  assert.equal(report.guides[0].assessment, 'no-mapped-source-change')
  assert.deepEqual(report.guides[0].changedPaths, [])
})

test('rename endpoints and deletions remain relevant without reading deleted scope files', async t => {
  const f = await fixture(t, { scopes: ['src/a.ts', 'moved'] })
  await mkdir(join(f.root, 'moved')); await rename(join(f.root, 'src/a.ts'), join(f.root, 'moved/new name.ts'))
  f.commit('rename scope', ['src', 'moved'])
  const report = await f.report()
  assert.deepEqual(report.guides[0].changedPaths, ['moved/new name.ts', 'src/a.ts'])
  assert.equal(report.guides[0].sourceChangeCount, 2)
})

test('catalog status/completion and verified generated views do not trigger broad docs review', async t => {
  const f = await fixture(t, { scopes: ['docs'], views: true })
  f.catalog.items[0].status = 'done'; f.catalog.items[0].completion = { verifiedOn: today, sourceBase: f.from, evidence: 'docs/receipt.md', reviewedBy: 'agent.0' }
  await f.saveCatalog(); f.commit('catalog metadata only', [catalogPath, 'docs/backlog/WEBAPPX-1000-TODO.md', 'docs/backlog/webappx-1000-todo.csv'])
  const report = await f.report()
  assert.equal(report.counts.reviewRequired, 0)
  assert.deepEqual(report.guides[0].definitionAdvisoryIds, [])
})

test('related definitions are separate guide advisories and unrelated proposal edits stay separate', async t => {
  const f = await fixture(t, { items: 2 })
  f.catalog.items[1].acceptance = 'A changed unrelated proposal acceptance condition.'; await f.saveCatalog(); f.commit('other definition', [catalogPath])
  assert.equal((await f.report()).counts.reviewRequired, 0)
  f.catalog.items[0].title = 'Changed reviewed definition title'; await f.saveCatalog(); f.commit('mapped definition', [catalogPath])
  const report = await f.report()
  assert.deepEqual(report.guides[0].definitionAdvisoryIds, ['WX-0001'])
  assert.equal(report.guides[0].assessment, 'definition-review-advisory')
  assert.equal(report.counts.sourceReviewRequired, 0)
  assert.equal(report.counts.definitionReviewRequired, 1)
})

test('scope matching does not depend on the impact engine first 100 proposal rows', async t => {
  const f = await fixture(t, { items: 130, proposals: ['WX-0130'] })
  await put(f.root, 'src/a.ts', 'after\n'); f.commit('many affected proposals')
  const report = await f.report()
  assert.equal(report.counts.reviewRequired, 1)
  assert.deepEqual(report.guides[0].changedPaths, ['src/a.ts'])
})

test('unknown syntactically valid IDs are refused against the committed catalog even when the workingtree invents them', async t => {
  const f = await fixture(t)
  f.mapping.guides[0].proposalIds = ['WX-9999']; await f.saveMapping()
  await assert.rejects(f.report(), /Unknown mapped proposal ID.*bound committed catalog/)
  f.catalog.items.push(catalogItem(9999)); await f.saveCatalog()
  const files = ['docs/receipt.md', catalogPath, defaultFreshnessMapping, defaultFreshnessDecisions, '.git/index']
  const before = await Promise.all(files.map(path => readFile(join(f.root, path))))
  await assert.rejects(f.report(), /Unknown mapped proposal ID.*bound committed catalog/)
  await assert.rejects(f.record(), /Unknown mapped proposal ID.*bound committed catalog/)
  assert.deepEqual(await Promise.all(files.map(path => readFile(join(f.root, path)))), before)
})

test('each guide validates proposal membership when a committed comparison is cached', async t => {
  const f = await fixture(t)
  await put(f.root, 'docs/second.md', '# Another source-reviewed guide\n')
  const second = clone(f.mapping.guides[0]); second.id = 'second-guide'; second.guide = { path: 'docs/second.md', sha256: hash(await readFile(join(f.root, 'docs/second.md'))) }; second.proposalIds = ['WX-9999']
  f.mapping.guides.push(second); await f.saveMapping()
  await assert.rejects(f.report(), /Unknown mapped proposal ID.*bound committed catalog/)
})

test('display path omissions retain full counts and underlying incomplete sets are refused', async t => {
  const f = await fixture(t)
  for (let index = 0; index < 25; index++) await put(f.root, `src/file-${index}.ts`, 'new\n')
  f.commit('bounded display')
  const report = await f.report()
  assert.equal(report.guides[0].sourceChangeCount, 25)
  assert.equal(report.guides[0].changedPaths.length, 20)
  assert.equal(report.guides[0].omittedChangedPaths, 5)
  const impact = async options => ({ ...await createImpactReport(options), truncation: { omittedChangeRecords: 1 } })
  await assert.rejects(f.report({ impact }), /Incomplete changed-path/)
  const definitionOverflow = async options => { const result = await createImpactReport(options); result.catalogChanges.omittedDefinitionProposalIds = 1; return result }
  await assert.rejects(f.report({ impact: definitionOverflow }), /Incomplete changed-path/)
})

test('missing/unavailable commit operands and stale committed catalog digest fail closed', async t => {
  const f = await fixture(t)
  await assert.rejects(f.report({ to: undefined }), /explicit locally available/)
  await assert.rejects(f.report({ to: 'missing-local-target' }), /Git query failed/)
  f.mapping.guides[0].examinedRevision = 'b'.repeat(40); await f.saveMapping()
  await assert.rejects(f.report(), /Git query failed/)
  f.mapping.guides[0].examinedRevision = f.from; f.mapping.catalog.sha256 = 'c'.repeat(64); await f.saveMapping()
  await assert.rejects(f.report(), /catalog binding/)
})

test('guide, receipt and mapping drift are explicit failures rather than refreshed evidence', async t => {
  const f = await fixture(t)
  await put(f.root, 'docs/guide.md', '# Changed unchecked guide\n')
  await assert.rejects(f.report(), /Guide digest drift/)
  f.mapping.guides[0].guide.sha256 = hash(await readFile(join(f.root, 'docs/guide.md'))); await f.saveMapping()
  await put(f.root, 'docs/receipt.md', '# Altered original receipt\n')
  await assert.rejects(f.report(), /Receipt digest drift/)
  f.mapping.guides[0].receipts[0].sha256 = hash(await readFile(join(f.root, 'docs/receipt.md'))); await f.saveMapping()
  await assert.rejects(f.report(), /mapped original date and observation revision/)
})

test('validation rejects coerced IDs, unknown fields, dates, duplicate records and unsafe references', async t => {
  const f = await fixture(t)
  const edits = [
    value => { value.status = 'done' }, value => { value.guides[0].id = ['fixture-guide'] },
    value => { value.guides[0].proposalIds = [['WX-0001']] }, value => { value.guides[0].sourceScopes = ['../outside'] },
    value => { value.guides[0].guide.path = '/outside.md' }, value => { value.guides[0].receipts[0].path = 'docs/receipt.md#claim' },
    value => { value.guides[0].sourceReview.reviewedOn = '2026-02-30' }, value => { value.guides[0].sourceReview.reviewedOn = '2026-10-16' },
    value => { value.guides[0].receipts[0].observedOn = '2026-10-16' }, value => { value.guides.push(clone(value.guides[0])) },
    value => { value.guides[0].receipts[0].revisionBasis = 'unqualified' },
    value => { value.guides[0].receipts[0].completion = {} }, value => { value.catalog.revision = 'HEAD' },
  ]
  for (const edit of edits) { const value = clone(f.mapping); edit(value); assert.throws(() => validateFreshnessMapping(value, { today })) }
  assert.equal(validateFreshnessMapping(f.mapping, { today }), f.mapping)
})

test('preview preserves receipts, guides, dirty index/worktree and blank records byte for byte', async t => {
  const f = await fixture(t)
  await put(f.root, 'src/a.ts', 'committed\n'); f.commit('source change')
  await put(f.root, 'src/a.ts', 'uncommitted private work\n')
  await put(f.root, 'staged.txt', 'staged work\n'); git(f.root, 'add', 'staged.txt')
  const files = ['docs/receipt.md', 'docs/guide.md', catalogPath, defaultFreshnessMapping, defaultFreshnessDecisions, '.git/index', 'src/a.ts', 'staged.txt', '.SYSTEMX/WORK/TASKS.json']
  const before = await Promise.all(files.map(path => readFile(join(f.root, path))))
  const status = git(f.root, 'status', '--porcelain=v2', '-z', '--untracked-files=all')
  const first = await f.report(); const second = await f.report()
  assert.deepEqual(first, second)
  assert.deepEqual(await Promise.all(files.map(path => readFile(join(f.root, path)))), before)
  assert.equal(git(f.root, 'status', '--porcelain=v2', '-z', '--untracked-files=all'), status)
})

test('an explicit decision appends dated bindings while preserving receipts/catalog/index', async t => {
  const f = await fixture(t)
  await put(f.root, 'src/a.ts', 'changed\n'); const to = f.commit('source review target')
  const files = ['docs/receipt.md', 'docs/guide.md', catalogPath, '.git/index', '.SYSTEMX/WORK/TASKS.json', defaultFreshnessMapping]
  const before = await Promise.all(files.map(path => readFile(join(f.root, path))))
  const preview = await f.report()
  const result = await f.record({ decision: 'refresh-needed', rationale: 'Refresh this guide against the changed mapped source; preserve the original historical browser receipt.' })
  assert.equal(result.record.targetRevision, to)
  assert.equal(result.record.reportDigest, preview.reportDigest)
  assert.equal(result.record.mappingSha256, preview.mapping.sha256)
  assert.equal(result.record.inputsSha256, preview.inputsSha256)
  assert.equal(result.record.scopeSha256, preview.guides[0].scopeSha256)
  assert.equal(result.record.reviewedOn, today)
  assert.equal(result.record.decision, 'refresh-needed')
  const after = await f.report()
  assert.equal(after.reportDigest, preview.reportDigest)
  assert.equal(after.decisions.total, 1)
  assert.deepEqual(after.decisions.matching, [result.record])
  assert.equal(validateFreshnessDecisions(JSON.parse(await readFile(join(f.root, defaultFreshnessDecisions), 'utf8'))).decisions.length, 1)
  assert.deepEqual(await Promise.all(files.map(path => readFile(join(f.root, path)))), before)
  assert.deepEqual((await readdir(join(f.root, 'docs/evidence'))).sort(), ['documentation-freshness-decisions.json', 'documentation-freshness-map.json'])
})

test('stale target, scope, mapping and decision-history bindings refuse a write', async t => {
  const f = await fixture(t)
  const first = await f.report()
  await put(f.root, 'src/a.ts', 'new committed target\n'); f.commit('new target')
  const decisionArguments = { expectedReportDigest: first.reportDigest, expectedDecisionsDigest: first.decisions.sha256 }
  await assert.rejects(f.record(decisionArguments), /Stale preview/)
  const second = await f.report()
  f.mapping.guides[0].sourceScopes = ['other']; await f.saveMapping()
  await assert.rejects(f.record({ expectedReportDigest: second.reportDigest, expectedDecisionsDigest: second.decisions.sha256 }), /Stale preview/)
  const third = await f.report()
  await put(f.root, defaultFreshnessDecisions, '{\n"schemaVersion":1,"intent":"documentation-review-decisions","decisions":[]\n}\n')
  await assert.rejects(f.record({ expectedReportDigest: third.reportDigest, expectedDecisionsDigest: third.decisions.sha256 }), /Stale preview/)
  assert.equal(JSON.parse(await readFile(join(f.root, defaultFreshnessDecisions), 'utf8')).decisions.length, 0)
})

test('duplicates, overwrite attempts, unknown guides, future dates and incomplete record options are refused', async t => {
  const f = await fixture(t)
  await f.record()
  const before = await readFile(join(f.root, defaultFreshnessDecisions))
  await assert.rejects(f.record(), /Duplicate review decision/)
  await assert.rejects(f.record({ guide: 'unmapped-guide' }), /mapped guide/)
  await assert.rejects(f.record({ reviewedOn: '2026-10-16' }), /actual date/)
  await assert.rejects(f.record({ expectedReportDigest: undefined }), /both preview digests/)
  assert.deepEqual(await readFile(join(f.root, defaultFreshnessDecisions)), before)
  const value = JSON.parse(before)
  value.decisions[0].completion = {}; assert.throws(() => validateFreshnessDecisions(value), /prohibited/)
})

test('lock conflicts preserve decision history and an absent history can be created explicitly', async t => {
  const f = await fixture(t)
  const before = await readFile(join(f.root, defaultFreshnessDecisions))
  await put(f.root, `${defaultFreshnessDecisions}.lock`, 'another writer owns this\n')
  await assert.rejects(f.record(), /locked/)
  assert.deepEqual(await readFile(join(f.root, defaultFreshnessDecisions)), before)
  assert.equal(await readFile(join(f.root, `${defaultFreshnessDecisions}.lock`), 'utf8'), 'another writer owns this\n')
  await rm(join(f.root, `${defaultFreshnessDecisions}.lock`)); await rm(join(f.root, defaultFreshnessDecisions))
  const preview = await f.report(); assert.equal(preview.decisions.sha256, 'absent')
  const result = await f.record(); assert.equal(result.record.decision, 'retain')
})

test('local input symlinks and paths outside the docs input contract are refused', async t => {
  const f = await fixture(t)
  for (const options of [{ mappingPath: '../outside.json' }, { decisionsPath: 'docs/receipt.md' }, { decisionsPath: defaultFreshnessMapping }]) await assert.rejects(f.report(options), /distinct JSON files directly/)
  await rm(join(f.root, 'docs/receipt.md'))
  try { await symlink('/unavailable-private-receipt', join(f.root, 'docs/receipt.md')) }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows symlink privileges unavailable.'); return } throw error }
  await assert.rejects(f.report(), /symlinks are refused/)
})

test('missing and oversized local inputs refuse inspection without partial reports', async t => {
  const f = await fixture(t)
  await rm(join(f.root, 'docs/receipt.md'))
  await assert.rejects(f.report(), /required contained local input/)
  await put(f.root, 'docs/receipt.md', Buffer.alloc(1_048_577))
  await assert.rejects(f.report(), /1 MiB inspection limit/)
})

test('source engine errors and local input drift during comparison preserve original bytes/history', async t => {
  const f = await fixture(t)
  const original = await readFile(join(f.root, defaultFreshnessDecisions))
  await assert.rejects(f.report({ impact: async () => { throw new Error('Source comparison unavailable') } }), /Source comparison unavailable/)
  const impact = async options => { const report = await createImpactReport(options); await put(f.root, 'docs/guide.md', 'concurrent local guide edit\n'); return report }
  await assert.rejects(f.report({ impact }), /changed during.*preview/)
  assert.deepEqual(await readFile(join(f.root, defaultFreshnessDecisions)), original)
})

test('CLI previews and deliberate record invocation work through a real temporary checkout', async t => {
  const f = await fixture(t)
  for (const name of ['documentation-freshness.mjs', 'backlog-impact.mjs', 'webappx-backlog.mjs']) {
    await mkdir(join(f.root, 'scripts'), { recursive: true })
    await copyFile(fileURLToPath(new URL(`../../scripts/${name}`, import.meta.url)), join(f.root, 'scripts', name))
  }
  const run = args => spawnSync(process.execPath, [join(f.root, 'scripts/documentation-freshness.mjs'), ...args], { cwd: f.root, env, shell: false, timeout: 15_000, maxBuffer: 1_048_576, encoding: 'utf8' })
  const preview = run(['--to', 'HEAD', '--json']); assert.equal(preview.status, 0, preview.stderr)
  const report = JSON.parse(preview.stdout)
  const result = run(['--to', report.targetRevision, '--record-decision', '--guide', 'fixture-guide', '--decision', 'retain', '--reviewed-by', 'fixture-reviewer', '--reviewed-on', today, '--rationale', 'Retain the original historical browser receipt with unchanged mapped source; no browser rerun is claimed.', '--expected-report-digest', report.reportDigest, '--expected-decisions-digest', report.decisions.sha256])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).record.targetRevision, f.from)
  assert.doesNotMatch(preview.stdout + result.stdout, /\/Users\/|\/Volumes\//)
  assert.equal((preview.stdout + result.stdout).includes(f.root), false)
  assert.notEqual(run(['--to', 'missing']).status, 0)
})

test('CLI rejects ambiguous modes and missing mutation fields', () => {
  for (const args of [[], ['--to'], ['--to', 'HEAD', '--to', 'HEAD'], ['--json', '--json'], ['--to', 'HEAD', '--guide', 'guide'], ['--to', 'HEAD', '--record-decision'], ['--help', '--json'], ['--to', 'HEAD', '--write']]) assert.throws(() => parseFreshnessArguments(args))
  assert.deepEqual(parseFreshnessArguments(['--to', 'HEAD', '--json']), { to: 'HEAD', json: true })
  assert.deepEqual(parseFreshnessArguments(['--help']), { help: true })
})

test('multiple guides use independent scopes and keep exact observation qualification', async t => {
  const f = await fixture(t, { scopes: ['src/a.ts'] })
  await put(f.root, 'docs/second.md', '# Another source-reviewed guide\n')
  const second = clone(f.mapping.guides[0])
  second.id = 'second-guide'; second.guide = { path: 'docs/second.md', sha256: hash(await readFile(join(f.root, 'docs/second.md'))) }; second.sourceScopes = ['unrelated']
  second.receipts[0].revisionBasis = 'examined-source'
  f.mapping.guides.push(second); await f.saveMapping()
  await put(f.root, 'src/a.ts', 'changed\n'); f.commit('one guide scope change')
  let calls = 0
  const impact = options => { calls++; return createImpactReport(options) }
  const report = await f.report({ impact })
  assert.equal(calls, 1)
  assert.deepEqual(report.guides.map(guide => [guide.id, guide.reviewRequired]), [['fixture-guide', true], ['second-guide', false]])
  assert.match(report.guides[1].receipts[0].qualification, /Original receipt examined-source.*no new execution/)
  assert.equal(report.counts.historicalSourceBaseReceipts, 1)
})

test('a later source-only guide review preserves an older exact examined-source observation', async t => {
  const f = await fixture(t)
  await put(f.root, 'src/a.ts', 'later reviewed source\n'); const target = f.commit('later source inspection')
  const originalReceipt = `# Original receipt\nObserved ${today}; exact examined source ${f.from}. This original browser observation is retained.\n`
  await put(f.root, 'docs/receipt.md', originalReceipt)
  f.mapping.guides[0].examinedRevision = target
  Object.assign(f.mapping.guides[0].receipts[0], { sha256: hash(originalReceipt), revisionBasis: 'examined-source' })
  await f.saveMapping()
  const report = await f.report()
  assert.equal(report.guides[0].examinedRevision, target)
  assert.equal(report.guides[0].receipts[0].observationRevision, f.from)
  assert.equal(report.guides[0].receipts[0].revisionBasis, 'examined-source')
  assert.equal(report.guides[0].currentBrowserVerified, false)
  assert.equal(await readFile(join(f.root, 'docs/receipt.md'), 'utf8'), originalReceipt)
})
