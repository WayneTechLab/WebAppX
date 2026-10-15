import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { render, summary, validate } from '../../scripts/webappx-backlog.mjs'

const catalog = JSON.parse(await readFile(new URL('../../docs/backlog/webappx-1000-todo.json', import.meta.url), 'utf8'))
const copy = () => structuredClone(catalog)
const script = fileURLToPath(new URL('../../scripts/webappx-backlog.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
const completion = () => ({
  verifiedOn: '2026-10-14',
  sourceBase: 'a9e78672d707e198dc10193972b17a76958abeb5',
  evidence: 'docs/SYSTEMX-ROADMAP-QA-2026-10-14.md',
  reviewedBy: 'agent.0',
})
const completedCopy = () => {
  const value = copy()
  value.items[0] = { ...value.items[0], status: 'done', completion: completion() }
  return value
}

test('the published proposal catalog has valid sources, ordered identities and dependency scopes', async () => {
  assert.equal((await validate(copy())).items.length, 1000)
})

test('metadata rejects coerced types and impossible calendar dates', async () => {
  for (const patch of [{ createdOn: [catalog.createdOn] }, { sourceCommit: [catalog.sourceCommit] }, { createdOn: '2026-99-99' }, { createdOn: '2026-02-30' }, { sourceCommit: 123 }, { createdOn: '2026-2-1' }]) {
    await assert.rejects(validate({ ...copy(), ...patch }), /schema 1/)
  }
})

test('missing rows, reordered IDs and incorrect area allocation cannot pass', async () => {
  const missing = copy(); missing.items.pop()
  await assert.rejects(validate(missing), /exactly 1,000/)
  const reordered = copy(); [reordered.items[0], reordered.items[1]] = [reordered.items[1], reordered.items[0]]
  await assert.rejects(validate(reordered), /IDs must be ordered/)
  const area = copy(); area.items[0].area = 'identity'
  await assert.rejects(validate(area), /50 items/)
})

test('duplicate proposals, forward dependencies and escaped or missing sources cannot pass', async () => {
  for (const field of ['title', 'acceptance']) {
    const value = copy(); value.items[1][field] = value.items[0][field]
    await assert.rejects(validate(value), new RegExp(`duplicate ${field}`))
  }
  const dependency = copy(); dependency.items[0].dependsOn = ['WX-0002']
  await assert.rejects(validate(dependency), /earlier catalog IDs/)
  for (const source of ['../outside-source', '/tmp/outside-source', 'src/nonexistent-backlog-source.ts']) {
    const value = copy(); value.items[0].source = source
    await assert.rejects(validate(value), /source/)
  }
})

test('done requires complete metadata while todo prohibits completion fields', async () => {
  const missing = copy(); missing.items[0].status = 'done'
  await assert.rejects(validate(missing), /done items require completion/)
  const unstarted = copy(); unstarted.items[0] = { ...unstarted.items[0], status: 'todo', completion: completion() }
  await assert.rejects(validate(unstarted), /todo items prohibit/)
  for (const metadata of [null, {}, { ...completion(), extra: 'unrecognized' }]) {
    const value = completedCopy(); value.items[0].completion = metadata
    await assert.rejects(validate(value), /completion requires/)
  }
})

test('completion dates, source bases and reviewer identities reject coercion and invented values', async () => {
  for (const patch of [
    { verifiedOn: ['2026-10-14'] }, { verifiedOn: '2026-02-30' }, { verifiedOn: '2026-10-32' }, { verifiedOn: '2026-2-1' },
    { sourceBase: ['a9e78672d707e198dc10193972b17a76958abeb5'] }, { sourceBase: 'short' }, { sourceBase: 123 },
    { reviewedBy: ['agent.0'] }, { reviewedBy: 'agent.1' }, { reviewedBy: '' },
  ]) {
    const value = completedCopy(); Object.assign(value.items[0].completion, patch)
    await assert.rejects(validate(value), /completion requires/)
  }
})

test('completion evidence must resolve to an existing repository file', async () => {
  for (const evidence of [
    '../outside-receipt.md', '/tmp/outside-receipt.md', 'docs/./SYSTEMX-ROADMAP-QA-2026-10-14.md',
    'docs/missing-completion-receipt.md', 'docs', 'docs/receipt.md#claim', 'docs\\receipt.md', ['docs/SYSTEMX-ROADMAP-QA-2026-10-14.md'],
  ]) {
    const value = completedCopy(); value.items[0].completion.evidence = evidence
    await assert.rejects(validate(value), /completion evidence/)
  }
})

test('completion evidence cannot escape through an in-repository symbolic link', async context => {
  const outside = await mkdtemp(join(tmpdir(), 'webappx-completion-'))
  const fixture = await mkdtemp(new URL('./.completion-', import.meta.url))
  try {
    await writeFile(join(outside, 'receipt.md'), 'Synthetic test evidence outside the repository.\n')
    try { await symlink(join(outside, 'receipt.md'), join(fixture, 'receipt.md')) }
    catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        context.skip('Windows symlink privileges are unavailable in this environment.')
        return
      }
      throw error
    }
    const value = completedCopy()
    value.items[0].completion.evidence = `tests/backlog/${basename(fixture)}/receipt.md`
    await assert.rejects(validate(value), /completion evidence does not resolve to a file inside/)
  } finally {
    await Promise.all([rm(fixture, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  }
})

test('reviewed completion passes without mutating the catalog or implying a different acceptance gate', async () => {
  for (const reviewedBy of ['agent.0', 'user']) {
    for (const gate of ['local', 'provider', 'operator']) {
      const value = completedCopy(); value.items[0].completion.reviewedBy = reviewedBy; value.items[0].gate = gate
      const before = structuredClone(value)
      assert.equal(await validate(value), value)
      assert.deepEqual(value, before)
    }
  }
})

test('summaries distinguish remaining proposals from recorded completion', () => {
  const value = completedCopy()
  const result = summary(value)
  assert.equal(result.total, 1000)
  assert.equal(result.statuses.done, value.items.filter(item => item.status === 'done').length)
  assert.equal(result.statuses.todo + result.statuses.done, 1000)
  assert.equal(result.remainingPriorities.P1, value.items.filter(item => item.priority === 'P1' && item.status === 'todo').length)
})

test('rendered checkboxes, evidence and CSV retain exact completion metadata', () => {
  const value = completedCopy()
  const before = structuredClone(value)
  const rendered = render(value)
  assert.match(rendered.markdown, /- \[x\] \*\*WX-0001/)
  assert.match(rendered.markdown, /Verified: 2026-10-14.*Source base: `a9e78672d707e198dc10193972b17a76958abeb5`.*Reviewed by: `agent\.0`.*Evidence:/)
  assert.match(rendered.markdown, /\[docs\/SYSTEMX-ROADMAP-QA-2026-10-14\.md\]\(\.\.\/\.\.\/docs\/SYSTEMX-ROADMAP-QA-2026-10-14\.md\)/)
  const csvRows = rendered.csv.trimEnd().split('\n').map(line => line.match(/"(?:[^"]|"")*"(?:,|$)/g).map(token => {
    const field = token.endsWith(',') ? token.slice(0, -1) : token
    return field.slice(1, -1).replaceAll('""', '"')
  }))
  const [headers, ...rows] = csvRows
  assert.equal(headers.at(-1), 'completion')
  const recovered = rows.map(row => {
    const item = Object.fromEntries(headers.map((key, index) => [key, row[index]]))
    item.dependsOn = item.dependsOn ? item.dependsOn.split(';') : []
    if (item.completion) item.completion = JSON.parse(item.completion)
    else delete item.completion
    return item
  })
  assert.deepEqual(recovered, value.items)
  assert.deepEqual(value, before)
})

test('exact ID and combined priority/area/limit queries return only matching proposals', () => {
  const id = run('--id', 'WX-0151')
  assert.equal(id.status, 0, id.stderr)
  assert.equal(JSON.parse(id.stdout).items[0].id, 'WX-0151')
  const query = run('--area', 'mock-recovery', '--priority', 'P1', '--status', 'todo', '--limit', '2')
  assert.equal(query.status, 0, query.stderr)
  const result = JSON.parse(query.stdout)
  assert.ok(result.matches >= result.items.length)
  assert.ok(result.items.length <= 2 && result.items.length > 0)
  assert.ok(result.items.every(item => item.area === 'mock-recovery' && item.priority === 'P1' && item.status === 'todo'))
  const done = run('--status', 'done', '--limit', '1000')
  assert.equal(done.status, 0, done.stderr)
  const completed = JSON.parse(done.stdout)
  assert.equal(completed.matches, catalog.items.filter(item => item.status === 'done').length)
  assert.ok(completed.items.every(item => item.status === 'done' && item.completion))
})

test('unknown or ambiguous CLI options fail without writing generated views', () => {
  for (const args of [['--limit', '0'], ['--id', 'WX-9999'], ['--area', 'missing'], ['--priority', 'P0'], ['--status', 'in-progress'], ['--write', '--id', 'WX-0001'], ['--check', '--write'], ['--limit'], ['--status'], ['--summary', '--summary']]) {
    const result = run(...args)
    assert.notEqual(result.status, 0, args.join(' '))
    assert.match(result.stderr, /WebAppX backlog failed/)
  }
})
