import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { graphFixture } from '../../../scripts/lan-graph-contract-browser.mjs'
import { createCommandProposal, inspectCommandProposal } from '../Builder/command-proposal.mjs'
import { exportGraphDocument } from '../Builder/graph-evolution.mjs'
import { createGraphService } from '../Builder/graph-service.mjs'

const digest = text => createHash('sha256').update(text).digest('hex')
const workspaceId = digest('proposal-workspace')
const source = 'export const Card = () => "Fixture source bytes";\n'
const original = () => graphFixture(workspaceId, digest(source))
const node = (graph, id) => graph.nodes.find(item => item.id === id)

function edit(graph) {
  const candidate = structuredClone(graph)
  const root = node(candidate, 'root')
  root.childIds = ['opaque', 'added', 'alpha']
  candidate.nodes = candidate.nodes.filter(item => item.id !== 'instance')
  candidate.nodes.push({ ...node(candidate, 'alpha'), id: 'added', label: 'New content', source: null, ownership: 'read-only' })
  node(candidate, 'alpha').label = 'New private display value'
  node(candidate, 'alpha').source.path = 'src/pages/NewCard.tsx'
  return candidate
}

function fixture() {
  const graph = original()
  const baseline = exportGraphDocument(graph)
  return { baseline, candidate: edit(graph), expectedRevision: baseline.revision }
}

test('a graph review names the exact operation, accepted and candidate revisions, effects and source owners', () => {
  const input = fixture()
  const before = JSON.stringify(input)
  const proposal = createCommandProposal(input)
  assert.equal(JSON.stringify(input), before)
  assert.equal(proposal.operation, 'graph.accept')
  assert.equal(proposal.capabilityId, 'lan.graph.accept@1')
  assert.equal(proposal.domainEffect, 'accept-local-memory')
  assert.equal(proposal.sourceWrites, false)
  assert.equal(proposal.workspaceId, workspaceId)
  assert.equal(proposal.documentId, 'fixtureGraph')
  assert.equal(proposal.targetRevision, input.baseline.revision)
  assert.equal(proposal.sourceRevision, digest(source))
  assert.equal(proposal.candidateRevision, exportGraphDocument(input.candidate).revision)
  assert.deepEqual(proposal.effects.added.map(row => [row.kind, row.id]), [['node', 'added']])
  assert.deepEqual(proposal.effects.removed.map(row => [row.kind, row.id]), [['node', 'instance']])
  assert.deepEqual(proposal.effects.changed.map(row => [row.id, row.fields]), [['alpha', ['label', 'source']], ['root', ['childIds']]])
  const reordered = proposal.effects.reordered[0]
  assert.deepEqual(reordered.beforeOrder, ['alpha', 'opaque'])
  assert.deepEqual(reordered.afterOrder, ['opaque', 'alpha'])
  const ownerPath = id => proposal.owners.find(owner => owner.id === id).path
  const alpha = proposal.effects.changed[0]
  assert.deepEqual(alpha.sourceFields, ['path'])
  assert.deepEqual(alpha.ownersBefore.map(ownerPath), ['src/pages/GraphFixture.tsx'])
  assert.deepEqual(alpha.ownersAfter.map(ownerPath), ['src/pages/NewCard.tsx'])
  assert.deepEqual(new Set(reordered.ownersAfter.map(ownerPath)), new Set(['src/pages/GraphFixture.tsx', 'src/pages/NewCard.tsx']))
  assert.equal(proposal.effects.added[0].ownersAfter[0], 'document')
  assert.doesNotMatch(JSON.stringify(proposal), /New private display value|New content|Fixture source bytes/)
})

test('reordering collection arrays and JSON keys preserves saved review, identity and ownership order', () => {
  const input = fixture()
  const proposal = createCommandProposal(input)
  const reordered = Object.fromEntries(Object.entries(input.candidate).reverse())
  reordered.nodes = [...reordered.nodes].reverse()
  reordered.references = [...reordered.references].reverse()
  const inspected = inspectCommandProposal({ baseline: input.baseline, candidate: reordered,
    proposal: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(proposal).reverse()))) })
  assert.deepEqual(inspected, proposal)
  assert.equal(JSON.stringify(createCommandProposal({ ...input, candidate: reordered })), JSON.stringify(proposal))
})

test('refuses stale, cross-document, cross-workspace, changed-source and ambiguous inputs before proposal', () => {
  const input = fixture()
  assert.throws(() => createCommandProposal({ ...input, expectedRevision: '0'.repeat(64) }), { code: 'COMMAND_BASELINE_STALE' })
  assert.throws(() => createCommandProposal({ ...input, expectedRevision: null }), { code: 'COMMAND_EXPECTED_REVISION' })
  const doc = original()
  doc.documentId = 'differentDoc'
  for (const ref of doc.references) ref.documentId = doc.documentId
  assert.throws(() => createCommandProposal({ ...input, candidate: doc }), { code: 'COMMAND_TARGET_MISMATCH' })
  assert.throws(() => createCommandProposal({ ...input, candidate: { ...input.candidate, workspaceId: digest('other workspace') } }), { code: 'COMMAND_TARGET_MISMATCH' })
  assert.throws(() => createCommandProposal({ ...input, candidate: { ...input.candidate, sourceRevision: digest('another source') } }), { code: 'COMMAND_SOURCE_CHANGED' })
  assert.throws(() => createCommandProposal({ ...input, candidate: input.baseline.document }), { code: 'COMMAND_NO_EFFECT' })
  const ambiguous = structuredClone(input.candidate)
  ambiguous.nodes.push(node(ambiguous, 'alpha'))
  assert.throws(() => createCommandProposal({ ...input, candidate: ambiguous }), { code: 'GRAPH_VALIDATION_FAILED' })
  const tampered = { ...input.baseline, revision: digest('unverified revision') }
  assert.throws(() => createCommandProposal({ ...input, baseline: tampered }), { code: 'GRAPH_EXPORT_REVISION_MISMATCH' })
})

test('inspection refuses replaced candidates, stale current exports and forged or executable review fields', () => {
  const input = fixture()
  const proposal = createCommandProposal(input)
  const changed = structuredClone(input.candidate)
  node(changed, 'alpha').label = 'A separate candidate'
  for (const candidate of [changed, input.baseline.document]) {
    assert.throws(() => inspectCommandProposal({ ...input, proposal, candidate }), { code: 'COMMAND_CANDIDATE_REPLACED' })
  }
  const baseline = exportGraphDocument(changed)
  assert.throws(() => inspectCommandProposal({ ...input, baseline, proposal }), { code: 'COMMAND_BASELINE_STALE' })
  for (const field of [{ proposalId: digest('misleading id') }, { effects: { ...proposal.effects, removed: [] } },
    { owners: [] }, { operation: 'graph.reopen' }, { unexpected: true }]) {
    assert.throws(() => inspectCommandProposal({ ...input, proposal: { ...proposal, ...field } }),
      error => ['COMMAND_PROPOSAL_MISMATCH', 'COMMAND_PROPOSAL_INVALID'].includes(error.code))
  }
  const accessor = { ...proposal }
  Object.defineProperty(accessor, 'owners', { get() { assert.fail('getter evaluated') } })
  assert.throws(() => inspectCommandProposal({ ...input, proposal: accessor }), { code: 'COMMAND_PROPOSAL_INVALID' })
  assert.deepEqual(inspectCommandProposal({ ...input, proposal }), proposal)
})

test('source impact for changed page/component works through graph roots; private names stay opaque', () => {
  const graph = original()
  graph.documentId = 'privateDocument'
  for (const ref of graph.references) ref.documentId = graph.documentId
  node(graph, 'alpha').source.path = 'src/privateClient/Detail.tsx'
  node(graph, 'componentRoot').source = { ...node(graph, 'alpha').source, path: 'src/components/Card.tsx' }
  const candidate = structuredClone(graph)
  candidate.pages[0].route = '/products'
  candidate.components[0].version = '2.0'
  candidate.references.find(ref => ref.kind === 'component').expectedVersion = '2.0'
  node(candidate, 'alpha').id = 'privateWidget'
  node(candidate, 'root').childIds[0] = 'privateWidget'
  const baseline = exportGraphDocument(graph)
  const proposal = createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision })
  const json = JSON.stringify(proposal)
  assert.doesNotMatch(json, /privateDocument|privateClient|privateWidget/)
  assert.ok(proposal.effects.added[0].id.startsWith('redacted:'))
  assert.ok(proposal.documentId.startsWith('redacted:'))
  const owner = id => proposal.owners.find(x => x.id === id)
  const page = proposal.effects.changed.find(x => x.kind === 'page')
  assert.ok(page.ownersAfter.map(owner).some(x => x.kind === 'source' && x.path === null))
  for (const kind of ['component', 'reference']) {
    const item = proposal.effects.changed.find(x => x.kind === kind)
    assert.deepEqual(item.ownersAfter.map(owner).map(x => x.path), ['src/components/Card.tsx'])
  }
})

test('unmapped children retain their containing source owner and graph-only metadata retains its document owner', () => {
  const graph = original()
  node(graph, 'root').childIds = ['alpha', 'opaque']
  node(graph, 'alpha').childIds = ['instance']
  node(graph, 'instance').parentId = 'alpha'
  const baseline = exportGraphDocument(graph)
  const candidate = structuredClone(graph)
  node(candidate, 'instance').label = 'New nested value'
  node(candidate, 'alpha').ownership = 'read-only'
  candidate.collections[0].version = '2.0'
  candidate.references.find(ref => ref.kind === 'collection').expectedVersion = '2.0'
  candidate.extensions['org.webappx.readonly'].fixtureNote = 'Unpublished extension value'
  const { effects, owners } = createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision })
  const nested = effects.changed.find(item => item.id === 'instance')
  assert.deepEqual(nested.ownersAfter, nested.ownersBefore)
  assert.deepEqual(nested.ownersAfter.map(id => owners.find(owner => owner.id === id).path), ['src/pages/GraphFixture.tsx'])
  assert.deepEqual(effects.changed.find(item => item.id === 'alpha').ownership, { before: 'source-owned', after: 'read-only' })
  for (const kind of ['document', 'collection', 'reference']) {
    assert.deepEqual(effects.changed.find(item => item.kind === kind).ownersAfter, ['document'])
  }
  assert.doesNotMatch(JSON.stringify(effects), /Unpublished extension value|New nested value/)
})

test('refuses truncated effects instead of saving a partial impact report', () => {
  const input = fixture()
  for (let i = 0; i < 51; i++) {
    const id = 'new' + i
    input.candidate.nodes.push({ ...node(input.candidate, 'added'), id })
    node(input.candidate, 'root').childIds.push(id)
  }
  assert.throws(() => createCommandProposal(input), { code: 'COMMAND_EFFECT_LIMIT' })
})

test('creation, inspection, discard and refusal preserve source, accepted graph and existing preview; confirmation still controls acceptance', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'lan-graph-command-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  await mkdir(join(temporary, 'src', 'pages'), { recursive: true })
  const path = join(temporary, 'src', 'pages', 'GraphFixture.tsx')
  await writeFile(path, source)
  const sourceBefore = await readFile(path)
  const graph = original()
  const service = createGraphService({ workspaceId })
  const { documentId } = graph
  const first = await service.preview({ document: graph })
  const initial = service.accept({ digest: first.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const baseline = service.export({ documentId })
  const candidate = edit(graph)
  const pending = await service.preview({ document: candidate })
  const state = () => JSON.stringify([service.status(), service.read({ documentId }), service.export({ documentId })])
  const stateBefore = state()
  const input = { baseline, candidate, expectedRevision: initial.revision }
  createCommandProposal(input) // discard this copy without storing a domain proposal
  const proposal = createCommandProposal(input)
  const reviewed = inspectCommandProposal({ ...input, proposal })
  assert.throws(() => createCommandProposal({ ...input, expectedRevision: digest('stale') }), { code: 'COMMAND_BASELINE_STALE' })
  assert.throws(() => service.accept({ digest: reviewed.proposalId, expectedRevision: initial.revision,
    confirmation: 'ACCEPT GRAPH' }), { code: 'GRAPH_PROPOSAL_MISSING' })
  assert.throws(() => service.accept({ digest: pending.digest, expectedRevision: initial.revision,
    confirmation: '' }), { code: 'GRAPH_CONFIRMATION_REQUIRED' })
  assert.equal(state(), stateBefore)
  assert.deepEqual(await readFile(path), sourceBefore)
  const accepted = service.accept({ digest: pending.digest, expectedRevision: initial.revision, confirmation: 'ACCEPT GRAPH' })
  assert.equal(accepted.revision, proposal.candidateRevision)
  assert.deepEqual(service.export({ documentId }), exportGraphDocument(candidate))
  assert.throws(() => inspectCommandProposal({ ...input, proposal, baseline: service.export({ documentId }) }), { code: 'COMMAND_BASELINE_STALE' })
  assert.deepEqual(await readFile(path), sourceBefore)
})

test('a new end child includes its unchanged anchor owner and omits unaffected sibling owners', () => {
  const graph = original()
  for (const id of ['alpha', 'opaque', 'instance']) {
    node(graph, id).source = { ...node(graph, 'alpha').source, path: 'src/' + id + '.tsx' }
  }
  const baseline = exportGraphDocument(graph)
  const candidate = structuredClone(graph)
  node(candidate, 'root').childIds.push('privateNewChild')
  candidate.nodes.push({ ...node(candidate, 'alpha'), id: 'privateNewChild', source: null, ownership: 'read-only' })
  const review = createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision })
  const root = review.effects.changed.find(row => row.id === 'root')
  assert.deepEqual(root.childOrder.neighborChanges, ['instance'])
  assert.deepEqual(root.childOrder.moved, [])
  assert.deepEqual(root.ownersBefore.map(id => review.owners.find(owner => owner.id === id).path), ['src/instance.tsx'])
  assert.deepEqual(root.ownersAfter.map(id => review.owners.find(owner => owner.id === id).path), ['src/instance.tsx'])
  assert.match(root.childOrder.after.at(-1), /^redacted:[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(review), /privateNewChild/)
})

test('the complete sibling order report is refused if it cannot fit in the portable byte budget', () => {
  const graph = original()
  for (let i = 0; i < 340; i++) {
    const id = 'child' + String(i).padStart(3, '0') + 'x'.repeat(78)
    graph.nodes.push({ ...node(graph, 'alpha'), id, source: null })
    node(graph, 'root').childIds.push(id)
  }
  const baseline = exportGraphDocument(graph)
  const candidate = structuredClone(graph)
  node(candidate, 'root').childIds.reverse()
  const snapshot = JSON.stringify([baseline, candidate])
  assert.throws(() => createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision }),
    error => error.code === 'COMMAND_EFFECT_LIMIT' && error.statusCode === 413 && /smaller edits/.test(error.message))
  assert.equal(JSON.stringify([baseline, candidate]), snapshot)
})

test('a stationary sibling with unchanged adjacent neighbors still owns its crossed order relations', () => {
  const graph = original()
  const root = node(graph, 'root')
  for (const id of ['fourth', 'fifth']) {
    graph.nodes.push({ ...node(graph, 'alpha'), id })
    root.childIds.push(id)
  }
  for (const id of root.childIds) node(graph, id).source = { ...node(graph, 'alpha').source, path: 'src/' + id + '.tsx' }
  const baseline = exportGraphDocument(graph)
  const candidate = structuredClone(graph)
  node(candidate, 'root').childIds = ['fifth', 'opaque', 'instance', 'fourth', 'alpha']
  const review = createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision })
  const change = review.effects.reordered[0]
  assert.ok(!change.childOrder.neighborChanges.includes('instance'))
  assert.deepEqual(change.childOrder.moved.find(item => item.id === 'instance'),
    { id: 'instance', from: 2, to: 2, relativeOrderChanged: true })
  for (const ids of [change.ownersBefore, change.ownersAfter]) {
    assert.ok(ids.some(id => review.owners.find(owner => owner.id === id).path === 'src/instance.tsx'))
  }
})
