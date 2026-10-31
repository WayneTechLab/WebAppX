import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createIdentityMap, identityDigest } from '../Builder/identity-core.mjs'
import {
  acceptOwnershipChange, buildOwnership, exportOwnershipDiagnostics, inspectOwnership,
  planLiteralOperation, previewOwnershipChange,
} from '../Builder/source-ownership.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const workspaceId = 'a'.repeat(64)
const foreignWorkspaceId = 'b'.repeat(64)
const sourcePath = 'src/pages/HomePage.tsx'

function mapped(content, elements, { path = sourcePath, workspace = workspaceId } = {}) {
  const revision = hash(content)
  const nodes = elements.map(({ key, element, ordinal = 0, tag = 'p', anchor = null, text = null,
    signature = `${tag}|${anchor ?? element}`, opaque = false, external = false, definition }) => {
    let start = -1
    for (let index = 0; index <= ordinal; index += 1) start = content.indexOf(element, start + 1)
    assert.notEqual(start, -1, `Fixture fragment missing: ${element}`)
    const end = start + element.length
    const fields = {}
    if (text !== null) {
      const textStart = content.indexOf(text, start)
      assert.ok(textStart >= start && textStart + text.length <= end)
      fields.text = { start: textStart, end: textStart + text.length, fingerprint: hash(text) }
    }
    return {
      key, parentKey: null, tag, anchor, signature: hash(signature), label: key,
      source: { path, start, end, sourceRevision: revision, fingerprint: hash(content.slice(start, end)) },
      fields, opaque, external, ...(definition ? { definition } : {}),
    }
  })
  return createIdentityMap({ workspaceId: workspace, sourcePath: path, sourceRevision: revision, route: '/',
    label: 'PRIVATE_LABEL_MARKER', nodes })
}

function titleFixture() {
  const element = '<h1 data-systemx-id="title">Hello</h1>'
  const content = `<main>${element}</main>`
  return { content, map: mapped(content, [{ key: 'title', element, tag: 'h1', anchor: 'title', text: 'Hello' }]) }
}

function reference(map, nodeId = map.nodes[0].id) {
  return { workspaceId: map.workspaceId, documentId: map.documentId, nodeId }
}

function operation(map, content, text = 'Updated', nodeId = map.nodes[0].id) {
  return { reference: reference(map, nodeId), expectedRevision: map.sourceRevision, text, currentSource: content }
}

function assertCodedRefusal(action) {
  assert.throws(action, error => error instanceof Error && typeof error.code === 'string' && error.code.length > 0)
}

test('default ownership is bounded to exact literal fields and reports unsupported authority', () => {
  const { map } = titleFixture()
  const report = buildOwnership(map)
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.workspaceId, map.workspaceId)
  assert.equal(report.documentId, map.documentId)
  assert.equal(report.sourceRevision, map.sourceRevision)
  assert.equal(report.objects.length, map.nodes.length)
  assert.equal(report.coverage.total, map.nodes.length)
  const object = report.objects[0]
  assert.equal(object.nodeId, map.nodes[0].id)
  assert.equal(object.mode, 'source-owned')
  assert.equal(object.adapterId, 'tsx-static-v1')
  assert.equal(object.status, 'mapped')
  assert.equal(object.fields.text.owner, 'source')
  assert.equal(object.fields.text.supported, true)
  assert.ok(object.supportedOperations.includes('literal'))
  for (const kind of ['style', 'structure', 'generated']) assert.ok(object.unsupportedOperations.includes(kind))
  assert.equal(object.source.path, sourcePath)
  assert.equal(object.source.sourceRevision, map.sourceRevision)
})

test('inspector requires qualified references and makes foreign or missing objects explicit', () => {
  const { map } = titleFixture()
  const found = inspectOwnership(map, reference(map))
  assert.match(JSON.stringify(found), new RegExp(map.nodes[0].id))
  assert.match(JSON.stringify(found), /source-owned|mapped/)
  assert.match(JSON.stringify(found), /explicit/)
  const foreign = inspectOwnership(map, { ...reference(map), workspaceId: foreignWorkspaceId })
  assert.notEqual(foreign.status, 'mapped')
  assert.match(JSON.stringify(foreign), /workspace-mismatch/)
  const missing = inspectOwnership(map, { ...reference(map), nodeId: 'node_' + 'f'.repeat(64) })
  assert.match(JSON.stringify(missing), /missing|unmapped/)
  assertCodedRefusal(() => inspectOwnership(map, { nodeId: map.nodes[0].id }))
})

test('literal plan proposes one exact span and never mutates source or report', () => {
  const { content, map } = titleFixture()
  const report = buildOwnership(map)
  const beforeReport = structuredClone(report)
  const beforeMap = structuredClone(map)
  const plan = planLiteralOperation(map, report, operation(map, content))
  assert.equal(plan.allowed, true)
  assert.equal(plan.patch.start, content.indexOf('Hello'))
  assert.equal(plan.patch.end, content.indexOf('Hello') + 'Hello'.length)
  assert.equal(plan.patch.replacement, 'Updated')
  assert.ok(Array.isArray(plan.impact))
  assert.equal(content, '<main><h1 data-systemx-id="title">Hello</h1></main>')
  assert.deepEqual(report, beforeReport)
  assert.deepEqual(map, beforeMap)
})

test('stale revision, altered bytes, and forged field fingerprint all refuse a literal patch', () => {
  const { content, map } = titleFixture()
  const report = buildOwnership(map)
  const staleExpected = planLiteralOperation(map, report, { ...operation(map, content), expectedRevision: hash('older') })
  assert.equal(staleExpected.allowed, false)
  assert.equal(staleExpected.patch, undefined)
  const changedBytes = planLiteralOperation(map, report, operation(map, content.replace('Hello', 'Jello')))
  assert.equal(changedBytes.allowed, false)
  assert.equal(changedBytes.patch, undefined)
  const staleReport = buildOwnership(map, { currentRevision: hash('promoted elsewhere') })
  assert.ok(staleReport.coverage.stale >= 1)
  const stalePlan = planLiteralOperation(map, staleReport, operation(map, content))
  assert.equal(stalePlan.allowed, false)
  assert.equal(stalePlan.patch, undefined)
  const forged = structuredClone(map)
  forged.nodes[0].fields.text.fingerprint = 'f'.repeat(64)
  const forgedPlan = planLiteralOperation(forged, buildOwnership(forged), operation(forged, content))
  assert.equal(forgedPlan.allowed, false)
  assert.equal(forgedPlan.patch, undefined)
})

test('qualified cross-workspace and cross-document operations cannot inherit matching node authority', () => {
  const { content, map } = titleFixture()
  const report = buildOwnership(map)
  for (const altered of [
    { ...reference(map), workspaceId: foreignWorkspaceId },
    { ...reference(map), documentId: 'doc_' + 'f'.repeat(64) },
    { ...reference(map), nodeId: 'node_' + 'f'.repeat(64) },
  ]) {
    const plan = planLiteralOperation(map, report, { ...operation(map, content), reference: altered })
    assert.equal(plan.allowed, false)
    assert.equal(plan.patch, undefined)
  }
})

test('repeated compatible literal occurrences are ambiguous even when one span was selected', () => {
  const one = '<p data-systemx-id="one">Same</p>'
  const two = '<p data-systemx-id="two">Same</p>'
  const content = `<main>${one}${two}</main>`
  const map = mapped(content, [
    { key: 'one', element: one, anchor: 'one', text: 'Same', signature: 'p|one' },
    { key: 'two', element: two, anchor: 'two', text: 'Same', signature: 'p|two' },
  ])
  const report = buildOwnership(map)
  const plan = planLiteralOperation(map, report, operation(map, content, 'Different', map.nodes[0].id))
  assert.equal(plan.allowed, false)
  assert.equal(plan.patch, undefined)
  assert.match(String(plan.code), /AMBIGU|REFUS|CONFLICT/i)
})

test('opaque expressions, external components and unresolved twins have no inferred write authority', () => {
  const expression = '<p>{user.name}</p>'
  const external = '<ExternalCard title="Hello" />'
  const content = `<main>${expression}${external}</main>`
  const map = mapped(content, [
    { key: 'expression', element: expression, opaque: true, signature: 'p|expression' },
    { key: 'external', element: external, tag: 'ExternalCard', external: true,
      definition: { name: 'ExternalCard', sourcePath: 'src/components/layout/Card.tsx' }, signature: 'component|ExternalCard' },
  ])
  const report = buildOwnership(map)
  for (const node of map.nodes) {
    const object = report.objects.find(item => item.nodeId === node.id)
    assert.ok(object)
    assert.equal(object.fields.text?.supported ?? false, false)
    assert.equal(planLiteralOperation(map, report, operation(map, content, 'Update', node.id)).allowed, false)
  }
  const externalObject = report.objects.find(item => item.nodeId === map.nodes[1].id)
  assert.equal(externalObject.definition.name, 'ExternalCard')
  assert.ok(externalObject.unsupportedOperations.includes('structure'))
  const repeated = '<p>Same</p>'
  const twinsContent = `<main>${repeated}${repeated}</main>`
  const twins = mapped(twinsContent, [
    { key: 'one', element: repeated, ordinal: 0, text: 'Same', signature: 'p|same' },
    { key: 'two', element: repeated, ordinal: 1, text: 'Same', signature: 'p|same' },
  ])
  assert.ok(twins.nodes.every(node => node.confidence === 'unresolved'))
  const twinsReport = buildOwnership(twins)
  assert.equal(planLiteralOperation(twins, twinsReport, operation(twins, twinsContent)).allowed, false)
})

test('overlapping explicit owner claims remain visible and disable source writes', () => {
  const { content, map } = titleFixture()
  const node = map.nodes[0]
  const claim = {
    nodeId: node.id, mode: 'source-owned', adapterId: 'tsx-static-v1',
    fields: { text: { owner: 'source', supported: true } }, source: node.source,
  }
  const report = buildOwnership(map, { claims: [
    { ...claim, provenance: 'tsx owner' },
    { ...claim, adapterId: 'alternate-static-v1', provenance: 'alternate owner' },
  ] })
  assert.equal(report.claims.length, 2)
  assert.equal(report.objects[0].status, 'conflict')
  assert.equal(report.coverage.conflict, 1)
  const plan = planLiteralOperation(map, report, operation(map, content))
  assert.equal(plan.allowed, false)
  assert.equal(plan.patch, undefined)
})

test('document-owned claims without a generated boundary and malformed claims cannot grant authority', () => {
  const { map } = titleFixture()
  const nodeId = map.nodes[0].id
  assertCodedRefusal(() => buildOwnership(map, { claims: [{
    nodeId, mode: 'document-owned', adapterId: 'tsx-static-v1',
    fields: { text: { owner: 'document', supported: true } },
  }] }))
  assertCodedRefusal(() => buildOwnership(map, { claims: [{ nodeId: 'node_' + 'f'.repeat(64), mode: 'source-owned', adapterId: 'tsx-static-v1', fields: {} }] }))
  const poisoned = JSON.parse('{"__proto__":{"polluted":true},"nodeId":"' + nodeId + '","mode":"source-owned","adapterId":"tsx-static-v1","fields":{}}')
  assertCodedRefusal(() => buildOwnership(map, { claims: [poisoned] }))
  assert.equal({}.polluted, undefined)
})

test('ownership preview and acceptance bind exact digest, explicit confirmation and caller-owned report', () => {
  const { map } = titleFixture()
  const report = buildOwnership(map)
  const claim = {
    nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'tsx-static-v1',
    fields: { text: { owner: 'source', supported: true } }, source: map.nodes[0].source,
    provenance: 'reviewed literal ownership',
  }
  const snapshot = structuredClone(report)
  const proposal = previewOwnershipChange(map, report, [claim])
  assert.equal(proposal.requiresReview, true)
  const { digest, ...body } = proposal
  assert.equal(digest, identityDigest(body))
  assertCodedRefusal(() => acceptOwnershipChange(proposal, { digest: 'f'.repeat(64), confirmation: 'ACCEPT OWNERSHIP CHANGE' }))
  assertCodedRefusal(() => acceptOwnershipChange(proposal, { digest, confirmation: 'yes' }))
  const accepted = acceptOwnershipChange(proposal, { digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  assert.notStrictEqual(accepted, proposal.report)
  assert.deepEqual(report, snapshot)
  const tampered = structuredClone(proposal)
  tampered.report.objects[0].mode = 'document-owned'
  assertCodedRefusal(() => acceptOwnershipChange(tampered, { digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' }))
})

test('ownership preview refuses cross-document changes and unsupported operation expansion', () => {
  const { map } = titleFixture()
  const report = buildOwnership(map)
  const change = {
    nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'tsx-static-v1',
    fields: { text: { owner: 'source', supported: true } }, source: map.nodes[0].source,
    provenance: 'reviewed literal ownership',
  }
  assertCodedRefusal(() => previewOwnershipChange(map, report, [{ ...change, reference: { ...reference(map), workspaceId: foreignWorkspaceId } }]))
  assertCodedRefusal(() => previewOwnershipChange(map, report, [{ ...change, supportedOperations: ['structure'] }]))
})

test('diagnostics export includes qualified coverage and spans while excluding labels and source bodies', () => {
  const { content, map } = titleFixture()
  const report = buildOwnership(map)
  const diagnostics = exportOwnershipDiagnostics(map, report)
  const serialized = JSON.stringify(diagnostics)
  assert.match(serialized, new RegExp(map.workspaceId))
  assert.match(serialized, new RegExp(map.documentId))
  assert.match(serialized, new RegExp(map.nodes[0].id))
  assert.match(serialized, /source-owned|mapped/)
  assert.match(serialized, /coverage|start|end/)
  assert.doesNotMatch(serialized, /PRIVATE_LABEL_MARKER|<main>|Hello|sessionToken|domHandle|\/Users\//)
  assert.equal(content.includes('Hello'), true)
  assertCodedRefusal(() => exportOwnershipDiagnostics(map, { objects: [] }))
})
