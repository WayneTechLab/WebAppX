import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { evidenceSummary, queryEvidence, renderEvidence, validateEvidenceIndex } from '../../scripts/backlog-evidence.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const index = JSON.parse(await readFile(resolve(root, 'docs/backlog/webappx-evidence-index.json'), 'utf8'))
const catalog = JSON.parse(await readFile(resolve(root, 'docs/backlog/webappx-1000-todo.json'), 'utf8'))
const copy = () => structuredClone(index)

test('public receipts preserve examined revision, historical observation base and pending-prerequisite scope', async () => {
  const value = copy()
  const before = structuredClone(value)
  assert.equal(await validateEvidenceIndex(value, catalog), value)
  assert.deepEqual(value, before)
  const undo = value.reviews.find(review => review.proposalId === 'WX-0717')
  assert.equal(undo.examinedRevision, '0469e11bcb17ec67b118099a73958e039c759979')
  const browser = undo.evidence.find(evidence => evidence.category === 'browser')
  assert.equal(browser.observationRevision, 'cae18da251b0a9c4418a4fbebf2bd514ccd2dcdd')
  assert.equal(browser.revisionBasis, 'receipt-source-base')
  assert.notEqual(browser.observationRevision, undo.examinedRevision)
  assert.match(undo.limitations, /WX-0708 prerequisite acceptance pending/)
  assert.match(undo.limitations, /does not independently authorize closing WX-0717/)
  assert.deepEqual(evidenceSummary(value), {
    reviews: 2, proposals: 2, references: 3,
    categories: { local: 2, browser: 1, provider: 0, operator: 0 },
  })
  for (const review of value.reviews) {
    assert.equal(Object.hasOwn(review, 'status'), false)
    assert.equal(Object.hasOwn(review, 'completion'), false)
  }
})

test('a pending proposal and prerequisite can carry evidence without inheriting completion', async () => {
  const proposals = structuredClone(catalog)
  for (const id of ['WX-0717', 'WX-0708']) {
    const item = proposals.items.find(item => item.id === id)
    item.status = 'todo'
    delete item.completion
  }
  const before = JSON.stringify(proposals)
  await validateEvidenceIndex(copy(), proposals)
  assert.equal(JSON.stringify(proposals), before)
})

test('missing, coerced and malformed revisions are rejected at both record levels', async () => {
  for (const revision of [undefined, null, 123, ['a'.repeat(40)], '0469e11', 'a'.repeat(39), 'a'.repeat(41), 'G'.repeat(40), 'A'.repeat(40)]) {
    for (const level of ['review', 'observation']) {
      const value = copy()
      const target = level === 'review' ? value.reviews[0] : value.reviews[0].evidence[0]
      const field = level === 'review' ? 'examinedRevision' : 'observationRevision'
      if (revision === undefined) delete target[field]
      else target[field] = revision
      await assert.rejects(validateEvidenceIndex(value, catalog), /missing (?:evidence )?fields|revision|Revision|SHA/)
    }
  }
})

test('calendar dates require strings, real days and original observations no later than review', async () => {
  for (const date of [undefined, null, ['2026-10-15'], '2026-2-03', '2026-02-29', '2026-99-99', '2026-04-31', '2026-10-15T00:00:00Z']) {
    for (const level of ['review', 'observation']) {
      const value = copy()
      const target = level === 'review' ? value.reviews[0] : value.reviews[0].evidence[0]
      const field = level === 'review' ? 'reviewedOn' : 'observedOn'
      if (date === undefined) delete target[field]
      else target[field] = date
      await assert.rejects(validateEvidenceIndex(value, catalog), /missing (?:evidence )?fields|date/)
    }
  }
  const future = copy()
  future.reviews[0].evidence[0].observedOn = '2026-10-16'
  await assert.rejects(validateEvidenceIndex(future, catalog), /no later than reviewedOn/)
  const leap = copy()
  leap.reviews[0].reviewedOn = '2024-02-29'
  leap.reviews[0].evidence.forEach(evidence => { evidence.observedOn = '2024-02-29' })
  await validateEvidenceIndex(leap, catalog)
})

test('unknown proposal IDs, duplicate review IDs and evidence-free reviews fail', async () => {
  for (const proposalId of ['WX-0000', 'WX-1001', 'WX-9999', 'wx-0717', ['WX-0717']]) {
    const value = copy(); value.reviews[0].proposalId = proposalId
    await assert.rejects(validateEvidenceIndex(value, catalog), /unknown proposal ID/)
  }
  const duplicate = copy(); duplicate.reviews[1].reviewId = duplicate.reviews[0].reviewId
  await assert.rejects(validateEvidenceIndex(duplicate, catalog), /unique WXR/)
  const empty = copy(); empty.reviews[0].evidence = []
  await assert.rejects(validateEvidenceIndex(empty, catalog), /between one and eight/)
  const tooMany = copy(); tooMany.reviews = Array.from({ length: 1001 }, () => tooMany.reviews[0])
  await assert.rejects(validateEvidenceIndex(tooMany, catalog), /at most 1,000/)
  await validateEvidenceIndex({ ...copy(), reviews: [] }, catalog)
})

test('status, completion and task-state lookalikes are prohibited at every level', async () => {
  for (const level of ['index', 'review', 'evidence']) {
    for (const [field, content] of [['status', 'done'], ['completion', {}], ['accepted', true], ['currentCompletion', true], ['dependsOn', []]]) {
      const value = copy()
      const target = level === 'index' ? value : level === 'review' ? value.reviews[0] : value.reviews[0].evidence[0]
      target[field] = content
      await assert.rejects(validateEvidenceIndex(value, catalog), /metadata|unexpected or missing (?:evidence )?fields/)
    }
  }
})

test('all four scoped categories are allowed without inferring authority or task status', async () => {
  for (const category of ['local', 'browser', 'provider', 'operator']) {
    const value = copy()
    value.reviews = [value.reviews[1]]
    value.reviews[0].evidence[0].category = category
    const before = structuredClone(value)
    await validateEvidenceIndex(value, catalog)
    assert.deepEqual(value, before)
    assert.equal(evidenceSummary(value).categories[category], 1)
  }
  const unknown = copy(); unknown.reviews[0].evidence[0].category = 'production'
  await assert.rejects(validateEvidenceIndex(unknown, catalog), /unknown evidence category/)
})

test('examined-source observations must match while reused receipt bases retain their own revisions', async () => {
  const mismatch = copy()
  mismatch.reviews[0].evidence[0].observationRevision = 'a'.repeat(40)
  await assert.rejects(validateEvidenceIndex(mismatch, catalog), /revisionBasis/)
  mismatch.reviews[0].evidence[0].revisionBasis = 'receipt-source-base'
  await validateEvidenceIndex(mismatch, catalog)
  mismatch.reviews[0].evidence[0].revisionBasis = 'latest'
  await assert.rejects(validateEvidenceIndex(mismatch, catalog), /revisionBasis/)
})

test('unsafe, absolute, URL and malformed reference paths are rejected portably', async () => {
  for (const reference of [undefined, null, ['docs/report.md'], '/tmp/report.md', '../report.md', 'docs/../report.md', './docs/report.md',
    'docs//report.md', 'docs/', 'docs/./report.md', 'docs\\report.md', 'C:/report.md', 'C:\\report.md', '\\\\server\\report.md',
    'https://example.com/report', 'https://user:secret@example.com/report?token=secret', 'docs/report.md?token=secret',
    'docs/report.md#part', 'docs/%2e%2e/report.md', ' docs/report.md', 'docs/report\n.md']) {
    const value = copy()
    if (reference === undefined) delete value.reviews[0].evidence[0].reference
    else value.reviews[0].evidence[0].reference = reference
    await assert.rejects(validateEvidenceIndex(value, catalog), /missing evidence fields|repository-relative file/)
  }
})

test('realpath rejects absent files, directories and symlink escapes, including parent links', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'webappx-evidence-paths-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const fixture = resolve(temporary, 'repository')
  await mkdir(resolve(fixture, 'docs'), { recursive: true })
  await writeFile(resolve(fixture, 'docs/report.md'), 'Synthetic in-repository receipt.\n')
  await writeFile(resolve(temporary, 'outside.md'), 'Synthetic outside receipt.\n')
  try {
    await symlink(resolve(temporary, 'outside.md'), resolve(fixture, 'docs/escape.md'))
    await symlink(temporary, resolve(fixture, 'outside'), process.platform === 'win32' ? 'junction' : 'dir')
    await symlink(resolve(fixture, 'docs/report.md'), resolve(fixture, 'docs/internal.md'))
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Windows symlink creation needs developer mode or symlink privileges.')
      return
    }
    throw error
  }
  const single = reference => {
    const value = copy(); value.reviews = [value.reviews[1]]
    value.reviews[0].evidence[0].reference = reference
    return value
  }
  for (const reference of ['docs/missing.md', 'docs', 'docs/escape.md', 'outside/outside.md']) {
    await assert.rejects(validateEvidenceIndex(single(reference), catalog, { repositoryRoot: fixture }), /existing file inside this repository/)
  }
  for (const reference of ['docs/report.md', 'docs/internal.md']) await validateEvidenceIndex(single(reference), catalog, { repositoryRoot: fixture })
})

test('duplicate references and unbounded or multiline descriptions fail', async () => {
  const duplicate = copy(); duplicate.reviews[0].evidence.push(structuredClone(duplicate.reviews[0].evidence[0]))
  await assert.rejects(validateEvidenceIndex(duplicate, catalog), /duplicate scoped evidence/)
  for (const [field, content] of [['scope', 'short'], ['scope', 'a'.repeat(701)], ['scope', 'Hidden\nsecond line'], ['limitations', ''], ['limitations', 'a'.repeat(1001)]]) {
    const value = copy(); value.reviews[0][field] = content
    await assert.rejects(validateEvidenceIndex(value, catalog), /bounded single-line/)
  }
})

test('queries filter by proposal and evidence category, preserve limitations and bound output', () => {
  const before = JSON.stringify(index)
  const selected = queryEvidence(index, { proposalId: 'WX-0717', category: 'browser', limit: 1 })
  assert.equal(selected.matches, 1)
  assert.equal(selected.reviews.length, 1)
  assert.equal(selected.reviews[0].evidence.length, 1)
  assert.equal(selected.reviews[0].evidence[0].category, 'browser')
  assert.match(selected.reviews[0].limitations, /WX-0708/)
  assert.deepEqual(queryEvidence(index, { proposalId: 'WX-0708' }), { matches: 0, reviews: [] })
  for (const limit of [0, 101, 1.5, '1']) assert.throws(() => queryEvidence(index, { limit }), /Limit/)
  assert.throws(() => queryEvidence(index, { category: 'production' }), /category/)
  assert.equal(JSON.stringify(index), before)
})

test('Markdown preserves revision qualifications, scoped links and escaped prose without checkboxes', () => {
  const value = copy()
  value.reviews[0].scope = 'Reviewed [text] <script> and `code` with *markers*.'
  const rendered = renderEvidence(value)
  assert.match(rendered, /0469e11bcb17ec67b118099a73958e039c759979/)
  assert.match(rendered, /cae18da251b0a9c4418a4fbebf2bd514ccd2dcdd.*receipt-source-base/)
  assert.match(rendered, /\.\.\/\.\.\/docs\/KEYBOARD-PORTALS-QA-2026-10-15\.md/)
  assert.match(rendered, /\\\[text\\\] \\<script\\>/)
  assert.match(rendered, /WX-0708 prerequisite acceptance pending/)
  assert.doesNotMatch(rendered, /- \[[x ]\]/)
})

test('accepted special filenames render complete encoded Markdown destinations', async t => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'webappx-evidence-markdown-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await mkdir(resolve(fixture, 'docs'))
  const reference = "docs/receipt) [review] !'(.md"
  await writeFile(resolve(fixture, reference), 'Synthetic receipt with portable punctuation in its filename.\n')
  const value = copy(); value.reviews = [value.reviews[1]]
  value.reviews[0].evidence[0].reference = reference
  await validateEvidenceIndex(value, catalog, { repositoryRoot: fixture })
  const rendered = renderEvidence(value)
  assert.match(rendered, /\(\.\.\/\.\.\/docs\/receipt%29%20%5Breview%5D%20%21%27%28\.md\)/)
  assert.match(rendered, /receipt\) \\\[review\\\]/)
})

async function bytesUnder(folder) {
  const result = {}
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = resolve(path, entry.name)
      if (entry.isDirectory()) await visit(file)
      else result[file.slice(folder.length + 1)] = await readFile(file, 'base64')
    }
  }
  await visit(folder)
  return result
}

test('all CLI modes preserve catalog bytes and blank seeds in an isolated template copy', async t => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'webappx-evidence-cli-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const files = ['scripts/backlog-evidence.mjs', 'docs/backlog/webappx-evidence-index.json', 'docs/backlog/webappx-1000-todo.json',
    'docs/EXISTING-FOUNDATION-ACCEPTANCE-2026-10-15.md', 'docs/KEYBOARD-PORTALS-QA-2026-10-15.md',
    '.SYSTEMX/WORK/TASKS.json', '.SYSTEMX/WORK/FOCUS.json', '.SYSTEMX/AGENTS/REGISTRY.json',
    '.SYSTEMX/GLOBAL/CONTEXT.md', '.SYSTEMX/PLAN/MASTER-PLAN.md', '.SYSTEMX/MEMORY/PROJECT.md', '.SYSTEMX/AGENTS/agent.0/MEMORY.md']
  for (const file of files) {
    await mkdir(dirname(resolve(fixture, file)), { recursive: true })
    await cp(resolve(root, file), resolve(fixture, file))
  }
  const before = await bytesUnder(fixture)
  const run = (...args) => spawnSync(process.execPath, ['scripts/backlog-evidence.mjs', ...args], { cwd: fixture, encoding: 'utf8' })
  for (const args of [[], ['--check'], ['--summary'], ['--markdown'], ['--id', 'WX-0717'], ['--id', 'WX-0708'], ['--category', 'browser', '--limit', '1']]) {
    const result = run(...args)
    assert.equal(result.status, 0, result.stderr)
    if (args[0] === '--id' && args[1] === 'WX-0708') assert.deepEqual(JSON.parse(result.stdout), { matches: 0, reviews: [] })
  }
  for (const args of [['--write'], ['--apply'], ['--status', 'done'], ['--completion'], ['--id', 'WX-9999'],
    ['--category', 'production'], ['--limit', '101'], ['--limit', '0'], ['--limit', '1.5'], ['--limit'],
    ['--check', '--id', 'WX-0717'], ['--summary', '--summary'], ['--help', '--apply']]) {
    const result = run(...args)
    assert.notEqual(result.status, 0, args.join(' '))
    assert.match(result.stderr, /WebAppX evidence index failed/)
  }
  assert.deepEqual(await bytesUnder(fixture), before)
})
