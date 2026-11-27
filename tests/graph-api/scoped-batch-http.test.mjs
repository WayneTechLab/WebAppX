import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { graphFixture } from '../../scripts/lan-graph-contract-browser.mjs'
import { exportGraphDocument } from '../../.SYSTEMX/LAN/Builder/graph-evolution.mjs'
import { startGraphCommandFixture } from './graph-command-server-fixture.mjs'

const by = (g, id) => g.nodes.find(n => n.id === id)
async function accepted(t) {
  const server = await startGraphCommandFixture(t)
  const source = Buffer.from('export const Card = () => "Example component";\n')
  const sourceRevision = createHash('sha256').update(source).digest('hex')
  const dir = join(server.root, 'src', 'pages')
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'GraphFixture.tsx')
  await writeFile(path, source)
  const graph = graphFixture(server.status.repository.workspaceId, sourceRevision)
  const alpha = by(graph, 'alpha')
  Object.assign(by(graph, 'componentRoot'), { ownership: 'source-owned', source: { ...alpha.source, start: 6, end: 18 } })
  graph.pages.push({ id: 'otherPage', rootId: 'otherRoot', route: '/other' })
  graph.nodes.push({ ...alpha, id: 'otherRoot', parentId: null, source: { ...alpha.source, start: 18, end: 24 } })
  const other = graphFixture(server.status.repository.workspaceId, sourceRevision, { documentId: 'otherDocument' })
  for (const doc of [graph, other]) {
    const preview = await server.call('command', 'graph.preview', { document: doc })
    await server.call('command', 'graph.accept', { digest: preview.digest })
  }
  const current = (documentId = graph.documentId) => server.call('query', 'graph.export', { documentId })
  const before = await current()
  async function run(body) {
    const result = await server.read('/api/graph/commands', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-systemx-session': server.session }, body: JSON.stringify(body) })
    return result.json()
  }
  const review = (edits, expectedRevision = before.revision) => run({ action: 'reviewBatch', documentId: graph.documentId, expectedRevision, edits })
  const decision = (p, action, extra = {}) => run({ action, proposalId: p.proposalId, expectedRevision: p.targetRevision,
    ...(action === 'confirm' && { confirmation: p.confirmationText }), ...extra })
  return { ...server, graph, current, before, other: exportGraphDocument(other), path, source, review, run, decision }
}
function edit(operation, id, value, extras = {}) {
  return { operation, capabilityId: 'lan.' + operation + '@1', target: { kind: operation.split('.')[0], id }, value, ...extras }
}
async function preserved(f) {
  assert.deepEqual(await f.current(), f.before)
  assert.deepEqual(await f.current('otherDocument'), f.other)
  assert.deepEqual(await readFile(f.path), f.source)
}
test('batch freezes explicit document targets, derived references and unchanged scope; cancel and one confirmed transaction', async t => {
  const f = await accepted(t)
  const edits = [edit('component.setVersion', 'card', '2.0', { expectedValue: '1.0' }),
    edit('node.setLabel', 'alpha', 'Reviewed node')]
  const p = (await f.review(edits)).result
  assert.equal(p.operation, 'graph.batch')
  assert.equal(p.targetRevision, f.before.revision)
  assert.deepEqual(p.targets, edits.map(e => e.target))
  assert.deepEqual(p.preconditions, edits.map(e => ({target:e.target, capabilityId:e.capabilityId, expectedValueChecked:Object.hasOwn(e,'expectedValue')})))
  assert.equal(p.sourceChecks.length, 1)
  assert.equal(p.sourceChecks[0].revision, f.graph.sourceRevision)
  assert.equal(p.sourceChecks[0].ownerId, p.owners[0].id)
  assert.deepEqual(p.scope.affected, [{ kind: 'component', id: 'card' }, { kind: 'node', id: 'alpha' }, { kind: 'reference', id: 'componentRef' }])
  assert.deepEqual(p.scope.unaffected, { components: 0, pages: 2, nodes: 5, references: 1, collections: 1 })
  assert.equal(p.scope.outsideSelection, 'all-other-objects-and-documents-unchanged')
  assert.deepEqual(p.owners.map(o => o.path), ['src/pages/GraphFixture.tsx'])
  await preserved(f)
  assert.equal((await f.decision(p, 'confirm', { edits: [edit('page.setRoute', 'otherPage', '/unreviewed')] })).error.code, 'SCOPED_SHAPE')
  assert.equal((await f.decision(p, 'cancel')).result.canceled, true)
  assert.equal((await f.decision(p, 'confirm')).error.code, 'SCOPED_PROPOSAL_MISSING')
  await preserved(f)
  const again = (await f.review(edits)).result
  const wrong = await f.decision(again, 'confirm', { confirmation: p.confirmationText })
  assert.equal(wrong.error.code, 'SCOPED_CONFIRMATION')
  await preserved(f)
  const expected = structuredClone(f.before.document)
  by(expected, 'alpha').label = 'Reviewed node'
  expected.components[0].version = '2.0'
  expected.references.find(r => r.id === 'componentRef').expectedVersion = '2.0'
  const commit = await f.decision(again, 'confirm')
  assert.equal(commit.result.revision, again.candidateRevision)
  assert.deepEqual(await f.current(), exportGraphDocument(expected))
  assert.deepEqual(await f.current('otherDocument'), f.other)
  assert.deepEqual(await readFile(f.path), f.source)
})
test('late failed preconditions and overlapping document or real UTF-16 source writes identify the edit without committing', async t => {
  const f = await accepted(t)
  const lead = edit('node.setLabel', 'alpha', 'Earlier valid')
  const sourcePlan = (id, text) => edit('node.planSourceReplacement', id, text)
  const cases = [
    [[lead, edit('component.setVersion', 'card', '2.0', { expectedValue: '9' })], 'SCOPED_PRECONDITION', 1],
    [[lead, edit('page.setRoute', 'page', '/other')], 'SCOPED_ROUTE_USED', 1],
    [[lead, edit('node.setLabel', 'alpha', 'Conflicting value')], 'SCOPED_WRITE_CONFLICT', 1],
    [[lead, edit('node.setLabel', 'otherRoot', '/Users/embedded/example')], 'SCOPED_VALUE', 1],
    [[lead, sourcePlan('alpha','abc'), sourcePlan('componentRoot','def')], 'SCOPED_WRITE_CONFLICT', 2],
    [[sourcePlan('componentRoot','def'), sourcePlan('alpha','abc')], 'SCOPED_WRITE_CONFLICT', 1],
    [[sourcePlan('alpha','abc'), sourcePlan('otherRoot','def')], 'SCOPED_SOURCE_PROMOTION_UNAVAILABLE', 0],
    [[lead, edit('node.setLabel', 'opaque','Not editable')], 'SCOPED_OWNER_REQUIRED', 1],
    [[lead, edit('component.setVersion','card','2.0',{capabilityId:'unknown'})], 'SCOPED_CAPABILITY', 1],
  ]
  for (const [edits, code, i] of cases) {
    const r = await f.review(edits)
    assert.equal(r.error.code, code)
    assert.deepEqual(r.error.details, { condition: code, target: edits[i].target, editIndex: i })
    if (code === 'SCOPED_WRITE_CONFLICT') {
      const conflict = r.error.conflict
      assert.equal(conflict.secondEditIndex, i)
      assert.deepEqual(conflict.firstTarget, edits[conflict.firstEditIndex].target)
      assert.deepEqual(conflict.secondTarget, edits[i].target)
      if (conflict.kind === 'source') {
        assert.match(conflict.ownerId, /^source:[a-f0-9]{64}$/)
        assert.ok(conflict.firstRange.start < conflict.secondRange.end && conflict.secondRange.start < conflict.firstRange.end)
      } else assert.equal(conflict.field, 'label')
    }
    await preserved(f)
  }
  assert.equal((await f.review(Array(17).fill(lead))).error.code, 'SCOPED_BATCH_LIMIT')
  await preserved(f)
  const swap = [edit('page.setRoute','page','/other'), edit('page.setRoute','otherPage','/graph-fixture')]
  const first = (await f.review(swap)).result
  await f.decision(first, 'cancel')
  const second = (await f.review([...swap].reverse())).result
  assert.equal(first.candidateRevision, second.candidateRevision)
  await preserved(f)
})
test('a physical source change expires the proposal; restoring original bytes cannot revive its confirmation', async t => {
  const f = await accepted(t)
  const edits = [edit('node.setLabel', 'alpha', 'Reviewed')]
  const first = (await f.review(edits)).result
  await writeFile(f.path, 'export const updated = true;\n')
  const refused = await f.decision(first,'confirm')
  assert.equal(refused.error.code, 'SCOPED_SOURCE_STALE')
  assert.deepEqual(refused.error.details.target, { kind: 'node', id: 'alpha' })
  assert.deepEqual(await f.current(), f.before)
  await writeFile(f.path, f.source)
  const closed = (await f.decision(first,'confirm')).error
  assert.equal(closed.code, 'SCOPED_PROPOSAL_MISSING')
  assert.equal(closed.reason, 'source-changed')
  const second = (await f.review(edits)).result
  // Replace with identical contents before the host checks again. File identity
  // must still fence the previous review across a change-and-restore.
  const replacement = join(f.root,'replacement.tsx')
  await writeFile(replacement, f.source)
  await rename(replacement, f.path)
  assert.equal((await f.decision(second,'confirm')).error.code, 'SCOPED_SOURCE_STALE')
  await preserved(f)
  const third = (await f.review(edits)).result
  assert.equal((await f.decision(third,'confirm', { confirmation: second.confirmationText })).error.code, 'SCOPED_CONFIRMATION')
  assert.equal((await f.decision(third,'confirm')).result.revision, third.candidateRevision)
})
test('document head changed then restored by another client invalidates old proposal even when final revision digest matches', async t => {
  const f = await accepted(t)
  const staged = (await f.review([edit('node.setLabel', 'alpha', 'Draft')])).result
  const intermediate = structuredClone(f.before.document)
  by(intermediate, 'alpha').label = 'Another client'
  const head = await f.call('command','graph.preview',{document:intermediate})
  const changed = await f.call('command','graph.accept',{digest:head.digest},f.before.revision)
  const back = await f.call('command','graph.preview',{document:f.before.document})
  await f.call('command','graph.accept',{digest:back.digest},changed.revision)
  const verdict = await f.decision(staged, 'confirm')
  assert.equal(verdict.error.code, 'SCOPED_STALE')
  assert.deepEqual(verdict.error.details.target, {kind:'document',id:f.graph.documentId})
  await preserved(f)
  assert.equal((await f.decision(staged, 'confirm')).error.code, 'SCOPED_PROPOSAL_MISSING')
})
