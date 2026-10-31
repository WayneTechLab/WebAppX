import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSourceIdentity } from '../Builder/source-identity-adapter.mjs'
import { hashSourceRevision } from '../Builder/source-revision.mjs'
import { buildOwnership, planLiteralOperation, previewOwnershipChange, acceptOwnershipChange,
  exportOwnershipDiagnostics } from '../Builder/source-ownership.mjs'

const sha = hashSourceRevision
const path = 'src/pages/OwnershipPage.tsx'
const workspaceId = sha('ownership-regression-workspace')
const confirmation = 'ACCEPT OWNERSHIP CHANGE'
function fixture(content = 'export default function OwnershipPage(){return <h1 data-systemx-id="headline">Hello</h1>}') {
  const { map } = parseSourceIdentity({ path, content, sourceRevision: sha(content), workspaceId, route: '/ownership' })
  const node = map.nodes.find(item => item.anchor === 'headline')
  assert.ok(node)
  return { content, map, node, reference: { workspaceId, documentId: map.documentId, nodeId: node.id } }
}
const claimFor = (node) => ({ nodeId: node.id, mode: 'source-owned', adapterId: 'tsx-static-v1',
  fields: { text: { owner: 'source', supported: true } }, source: node.source, provenance: {} })
const planFor = ({ content, map, reference }, report = buildOwnership(map)) => planLiteralOperation(map, report,
  { reference, expectedRevision: map.sourceRevision, text: 'Reviewed replacement', currentSource: content })
const coded = expected => error => error?.code === expected

test('one actual imported JSX literal remains editable when comments, attributes or JS strings repeat its text', () => {
  const input = fixture('// Hello is also a comment\nconst label="Hello";export default function OwnershipPage(){return <h1 title="Hello" data-systemx-id="headline">Hello</h1>}')
  const before = JSON.stringify(input.map)
  const report = buildOwnership(input.map)
  const plan = planFor(input, report)
  assert.equal(plan.allowed, true)
  assert.equal(input.content.slice(plan.patch.start, plan.patch.end), 'Hello')
  assert.equal(plan.patch.start, input.node.fields.text.start)
  assert.equal(plan.patch.end, input.node.fields.text.end)
  const proposed = input.content.slice(0, plan.patch.start) + plan.patch.replacement + input.content.slice(plan.patch.end)
  assert.match(proposed, /const label="Hello"/)
  assert.match(proposed, /title="Hello"/)
  assert.match(proposed, /headline">Reviewed replacement<\/h1>/)
  assert.equal(JSON.stringify(input.map), before)
  assert.equal(input.content.includes('Reviewed replacement'), false)
})

test('two actual compatible JSX literal spans still refuse an ambiguous operation', () => {
  const input = fixture('export default function OwnershipPage(){return <main><h1 data-systemx-id="headline">Hello</h1><p data-systemx-id="other">Hello</p></main>}')
  const plan = planFor(input)
  assert.equal(plan.allowed, false)
  assert.equal(plan.code, 'OWNERSHIP_LITERAL_AMBIGUOUS')
  assert.equal(plan.patch, undefined)
})

test('unknown or foreign qualification and operation-expansion claims are rejected rather than ignored', () => {
  const { map, node } = fixture()
  const claim = claimFor(node)
  for (const extra of [
    { reference: { workspaceId: sha('foreign workspace'), documentId: map.documentId, nodeId: node.id } },
    { supportedOperations: ['structure'] }, { label: 'PRIVATE_CLAIM_TEXT' },
  ]) assert.throws(() => buildOwnership(map, { claims: [{ ...claim, ...extra }] }), coded('OWNERSHIP_INVALID_CLAIM'))
  const poisoned = JSON.parse(JSON.stringify(claim).replace(/}$/, ',"__proto__":{"polluted":true}}'))
  assert.throws(() => buildOwnership(map, { claims: [poisoned] }), coded('OWNERSHIP_INVALID_CLAIM'))
  assert.equal({}.polluted, undefined)
  assert.throws(() => buildOwnership(map, { claims: [{ ...claim, fields: { text: { owner: 'source', supported: true, operation: 'structure' } } }] }), coded('OWNERSHIP_INVALID_CLAIM'))
})

test('generated ownership requires a declared document/output boundary and cannot enable source regeneration', () => {
  const input = fixture()
  const provenance = { documentId: input.map.documentId, generatorVersion: 'generator-v1.2.0',
    outputPath: 'src/generated/OwnershipPage.tsx', outputRevision: sha('generated output'),
    generatedBoundary: { path: 'src/generated/OwnershipPage.tsx' } }
  const generated = { ...claimFor(input.node), mode: 'document-owned', adapterId: 'generator-v1', fields: { text: 'document' }, provenance }
  for (const invalid of [undefined, {}, { ...provenance, documentId: `doc_${sha('foreign document')}` },
    { ...provenance, outputPath: path, generatedBoundary: { path } }]) {
    assert.throws(() => buildOwnership(input.map, { claims: [{ ...generated, provenance: invalid }] }), error => typeof error.code === 'string')
  }
  const report = buildOwnership(input.map, { claims: [generated] })
  assert.equal(report.objects[0].mode, 'document-owned')
  assert.equal(report.objects[0].status, 'mapped')
  assert.deepEqual(report.objects[0].supportedOperations, [])
  assert.deepEqual(report.objects[0].provenance, provenance)
  assert.equal(planFor(input, report).allowed, false)
  const exported = exportOwnershipDiagnostics(input.map, report)
  assert.equal(exported.objects[0].provenance.outputRevision, provenance.outputRevision)
  assert.doesNotMatch(JSON.stringify(exported), /Hello|export default|sessionToken|\/Users\//)
})

test('reviewed hybrid source/document fields remain nonoverlapping and support only the declared literal', () => {
  const input = fixture(), initial = buildOwnership(input.map)
  const hybrid = { ...claimFor(input.node), mode: 'hybrid-controlled', fields: { text: 'source', metadata: 'document' } }
  const proposal = previewOwnershipChange(input.map, initial, [hybrid])
  const accepted = acceptOwnershipChange(proposal, { digest: proposal.digest, confirmation })
  const object = accepted.objects.find(item => item.nodeId === input.node.id)
  assert.equal(object.mode, 'hybrid-controlled')
  assert.deepEqual(object.supportedOperations, ['literal'])
  assert.deepEqual(object.unsupportedOperations, ['style', 'structure', 'generated'])
  assert.equal(planFor(input, accepted).allowed, true)
  const overlap = buildOwnership(input.map, { claims: [hybrid, { ...claimFor(input.node), fields: { text: 'document' } }] })
  assert.equal(overlap.objects[0].status, 'conflict')
  assert.equal(planFor(input, overlap).allowed, false)
  assert.deepEqual(initial.claims, [])
})

test('credential-shaped or free-body provenance cannot enter diagnostic exports', () => {
  const { map, node } = fixture(), claim = claimFor(node)
  for (const provenance of ['free-form source body', { label: 'PRIVATE_BODY' }, { generatorVersion: 'sk_live_fixture' },
    { generatorVersion: '/Users/private/repository' }, { generatorVersion: 'line\nbreak' }]) {
    assert.throws(() => buildOwnership(map, { claims: [{ ...claim, provenance }] }), coded('OWNERSHIP_INVALID_PROVENANCE'))
  }
  assert.throws(() => buildOwnership(map, { claims: [{ ...claim, adapterId: 'sk_live_fixture' }] }), coded('OWNERSHIP_INVALID_CLAIM'))
})

test('accessor properties and sparse/accessor claim arrays are rejected without executing getters', () => {
  const { map, node } = fixture()
  let reads = 0
  const claim = claimFor(node)
  const accessorClaim = { ...claim }
  Object.defineProperty(accessorClaim, 'nodeId', { enumerable: true, get() { reads += 1; return node.id } })
  assert.throws(() => buildOwnership(map, { claims: [accessorClaim] }), coded('OWNERSHIP_INVALID_CLAIM'))
  const accessorField = { owner: 'source' }
  Object.defineProperty(accessorField, 'supported', { enumerable: true, get() { reads += 1; return true } })
  assert.throws(() => buildOwnership(map, { claims: [{ ...claim, fields: { text: accessorField } }] }), coded('OWNERSHIP_INVALID_CLAIM'))
  const claims = []
  Object.defineProperty(claims, '0', { enumerable: true, configurable: true, get() { reads += 1; return claim } })
  assert.throws(() => buildOwnership(map, { claims }), coded('OWNERSHIP_INVALID_CLAIMS'))
  assert.throws(() => buildOwnership(map, { claims: Array(1) }), coded('OWNERSHIP_INVALID_CLAIMS'))
  assert.equal(reads, 0)
})

test('literal revision checks bind raw bytes before decoding and refuse lossy UTF-8 input', () => {
  const input = fixture('export default function OwnershipPage(){return <h1 data-systemx-id="headline">Replacement \uFFFD</h1>}')
  const report = buildOwnership(input.map)
  const operation = { reference: input.reference, expectedRevision: input.map.sourceRevision, text: 'Reviewed', currentSource: Buffer.from(input.content, 'utf8') }
  assert.equal(planLiteralOperation(input.map, report, operation).allowed, true)
  const exact = Buffer.from(input.content, 'utf8'), marker = Buffer.from('\uFFFD', 'utf8')
  const offset = exact.indexOf(marker)
  assert.ok(offset >= 0)
  const malformed = Buffer.concat([exact.subarray(0, offset), Buffer.from([0xff]), exact.subarray(offset + marker.length)])
  assert.equal(malformed.toString('utf8'), input.content, 'The malformed-byte fixture reproduces the old lossy-decoding equality')
  assert.notEqual(sha(malformed), input.map.sourceRevision)
  const rejected = planLiteralOperation(input.map, report, { ...operation, currentSource: malformed })
  assert.equal(rejected.allowed, false)
  assert.equal(rejected.code, 'OWNERSHIP_REVISION_CONFLICT')
  assert.equal(rejected.patch, undefined)
  const lossyString = input.content.replace('\uFFFD', '\uD800')
  assert.equal(sha(lossyString), input.map.sourceRevision, 'An unpaired surrogate would also normalize to the same UTF-8 replacement bytes')
  const stringRejected = planLiteralOperation(input.map, report, { ...operation, currentSource: lossyString })
  assert.equal(stringRejected.allowed, false)
  assert.equal(stringRejected.code, 'OWNERSHIP_ENCODING_UNSUPPORTED')
  assert.throws(() => planLiteralOperation(input.map, report, { ...operation, text: '\uD800' }), coded('OWNERSHIP_INVALID_OPERATION'))
  assert.deepEqual(Buffer.from(input.content, 'utf8'), exact)
})
