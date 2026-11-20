import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { graphFixture } from '../../scripts/lan-graph-contract-browser.mjs'
import { startGraphCommandFixture } from './graph-command-server-fixture.mjs'

test('two direct LAN clients share server checks and one-use confirmation, and the accepted graph survives a fresh read', async t => {
  const { root, status, session, read, call } = await startGraphCommandFixture(t)
  const bytes = 'export const Example = "Initial file";\n'
  const path = join(root, 'src', 'GraphFixture.tsx')
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(path, bytes)
  const graph = graphFixture(status.repository.workspaceId, createHash('sha256').update(bytes).digest('hex'))
  graph.nodes.find(n => n.id === 'alpha').source.path = 'src/GraphFixture.tsx'
  const preview = await call('command', 'graph.preview', { document: graph })
  await call('command', 'graph.accept', { digest: preview.digest })
  const current = () => call('query', 'graph.export', { documentId: graph.documentId })
  const original = await current()
  const input = { action: 'review', expectedRevision: original.revision, documentId: graph.documentId,
    operation: 'node.setLabel', target: { kind: 'node', id: 'alpha' }, capabilityId: 'lan.node.setLabel@1', value: 'Exact edit' }
  async function post(body, overrides = {}, route = '/api/graph/commands') {
    return read(route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-systemx-session': session, ...overrides },
      body: JSON.stringify(body) })
  }
  const client = async body => {
    const res = await post(body)
    assert.equal(res.headers.get('x-systemx-retry'), 'fresh-proposal')
    return { status: res.status, ...await res.json() }
  }
  assert.equal((await post(input, { 'x-systemx-session': 'unavailable' })).status, 403)
  assert.equal((await post(input, { Origin: 'http://example.test' })).status, 403)
  assert.equal((await post(input, {}, '/api/graph/commands?override=1')).status, 400)
  assert.equal((await post(input, { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await read('/api/graph/commands')).status, 405)
  assert.equal((await client({ ...input, target: { kind: 'page', id: 'page' } })).error.code, 'SCOPED_TARGET_KIND')
  assert.equal((await client({ ...input, target: { kind: 'node', id: 'opaque' } })).error.code, 'SCOPED_OWNER_REQUIRED')
  assert.equal((await client({ ...input, capabilityId: 'lan.page.setRoute@1' })).error.code, 'SCOPED_CAPABILITY')
  const { result: review } = await client(input)
  assert.equal(review.targetRevision, original.revision)
  assert.equal((await client({ ...input, value: 'Concurrent edit' })).error.code, 'SCOPED_OVERLAP')
  const decide = (p, action) => ({ action, proposalId: p.proposalId, expectedRevision: p.targetRevision })
  assert.equal((await client(decide(review, 'confirm'))).error.code, 'SCOPED_CONFIRMATION')
  assert.equal((await client(decide(review, 'cancel'))).result.canceled, true)
  assert.equal((await client({ ...decide(review, 'confirm'), confirmation: review.confirmationText })).error.code, 'SCOPED_PROPOSAL_MISSING')
  const { result: second } = await client(input)
  assert.equal((await client({ ...decide(second, 'confirm'), confirmation: review.confirmationText })).error.code, 'SCOPED_CONFIRMATION')
  assert.deepEqual(await current(), original)
  assert.equal(await readFile(path, 'utf8'), bytes)
  const committed = await client({ ...decide(second, 'confirm'), confirmation: second.confirmationText })
  assert.equal(committed.result.revision, second.candidateRevision)
  const after = await current()
  const expected = structuredClone(original.document)
  expected.nodes.find(n => n.id === 'alpha').label = 'Exact edit'
  assert.deepEqual(after.document, expected)
  assert.equal(after.revision, second.candidateRevision)
  assert.equal(await readFile(path, 'utf8'), bytes)
  assert.equal((await client(input)).error.code, 'SCOPED_STALE')
})

test('direct clients cannot enable a host-disabled edit even with a valid capability and source ownership', async t => {
  const { status, session, read, call } = await startGraphCommandFixture(t, { capabilitySetting: 'lan.page.setRoute@1' })
  const graph = graphFixture(status.repository.workspaceId, 'b'.repeat(64))
  const first = await call('command', 'graph.preview', { document: graph })
  await call('command', 'graph.accept', { digest: first.digest })
  const before = await call('query', 'graph.export', { documentId: graph.documentId })
  const review = { action: 'review', operation: 'node.setLabel', documentId: graph.documentId, target: { kind: 'node', id: 'alpha' },
    expectedRevision: before.revision, value: 'New metadata', capabilityId: 'lan.node.setLabel@1' }
  const send = async data => (await read('/api/graph/commands', { method: 'POST', headers: {
    'Content-Type': 'application/json', 'x-systemx-session': session }, body: JSON.stringify(data) })).json()
  const rejected = await send(review)
  assert.equal(rejected.error.code, 'SCOPED_DISABLED')
  assert.match(rejected.error.message, /lan\.node\.setLabel@1/)
  assert.equal((await send({ ...review, capabilitySetting: 'lan.node.setLabel@1' })).error.code, 'SCOPED_SHAPE')
  const allowed = await send({ ...review, operation: 'page.setRoute', target: { kind: 'page', id: 'page' }, value: '/allowed', capabilityId: 'lan.page.setRoute@1' })
  assert.equal(allowed.ok, true)
  assert.deepEqual(await call('query', 'graph.export', { documentId: graph.documentId }), before)
})
