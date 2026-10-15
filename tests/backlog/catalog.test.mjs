import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validate } from '../../scripts/webappx-backlog.mjs'

const catalog = JSON.parse(await readFile(new URL('../../docs/backlog/webappx-1000-todo.json', import.meta.url), 'utf8'))
const copy = () => structuredClone(catalog)
const script = fileURLToPath(new URL('../../scripts/webappx-backlog.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

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

test('exact ID and combined priority/area/limit queries return only matching proposals', () => {
  const id = run('--id', 'WX-0151')
  assert.equal(id.status, 0, id.stderr)
  assert.equal(JSON.parse(id.stdout).items[0].id, 'WX-0151')
  const query = run('--area', 'mock-recovery', '--priority', 'P1', '--limit', '2')
  assert.equal(query.status, 0, query.stderr)
  const result = JSON.parse(query.stdout)
  assert.ok(result.matches >= result.items.length)
  assert.ok(result.items.length <= 2 && result.items.length > 0)
  assert.ok(result.items.every(item => item.area === 'mock-recovery' && item.priority === 'P1'))
})

test('unknown or ambiguous CLI options fail without writing generated views', () => {
  for (const args of [['--limit', '0'], ['--id', 'WX-9999'], ['--area', 'missing'], ['--priority', 'P0'], ['--write', '--id', 'WX-0001'], ['--check', '--write'], ['--limit'], ['--summary', '--summary']]) {
    const result = run(...args)
    assert.notEqual(result.status, 0, args.join(' '))
    assert.match(result.stderr, /WebAppX backlog failed/)
  }
})
