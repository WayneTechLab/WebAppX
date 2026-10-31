import test from 'node:test'
import assert from 'node:assert/strict'
import { hashSourceRevision } from '../Builder/source-revision.mjs'
import { buildOwnership, inspectOwnership, planLiteralOperation, previewOwnershipChange,
  acceptOwnershipChange, exportOwnershipDiagnostics } from '../Builder/source-ownership.mjs'

const sha = hashSourceRevision
const workspaceId = sha('workspace-a')
const documentId = `doc_${sha('document-a')}`
const pageId = `page_${sha('page-a')}`
const source = 'export default function Home() { return <main><h1>Hello</h1><p>World</p></main> }'

function fixture(content = source, sourcePath = 'src/pages/Home.tsx') {
  const revision = sha(content)
  const element = (tag, literal, id, extras = {}) => {
    const markup = `<${tag}>${literal}</${tag}>`
    const start = content.indexOf(markup)
    const textStart = start + tag.length + 2
    assert.ok(start >= 0)
    return {
      id, parentId: null, tag, anchor: null, signature: sha(`${tag}:${literal}`), label: literal,
      confidence: 'heuristic', opaque: false, external: false,
      source: { path: sourcePath, start, end: start + markup.length, sourceRevision: revision, fingerprint: sha(markup) },
      fields: { text: { start: textStart, end: textStart + literal.length, fingerprint: sha(literal) } }, ...extras,
    }
  }
  const map = { schemaVersion: 1, ruleVersion: 'identity-v1', workspaceId, documentId, pageId,
    sourcePath, sourceRevision: revision, route: '/home', label: 'Private label',
    nodes: [element('h1', 'Hello', `node_${sha('h1')}`), element('p', content.includes('<p>World</p>') ? 'World' : 'Hello', `node_${sha('p')}`)],
    aliases: [], orphaned: [], warnings: [] }
  return { content, map, reference: { workspaceId, documentId, nodeId: map.nodes[0].id } }
}

function code(expected) {
  return error => error?.code === expected
}

test('source-owned mapping reports exact spans and offers only the literal adapter operation', () => {
  const { map, reference, content } = fixture()
  const report = buildOwnership(map)
  assert.deepEqual(report.coverage, { mapped: 2, partial: 0, stale: 0, unmapped: 0, conflict: 0, total: 2 })
  assert.equal(report.objects[0].mode, 'source-owned')
  assert.deepEqual(report.objects[0].supportedOperations, ['literal'])
  assert.deepEqual(report.objects[0].unsupportedOperations, ['style', 'structure', 'generated'])
  assert.equal(report.objects[0].source.fingerprint, sha('<h1>Hello</h1>'))
  const inspected = inspectOwnership(map, reference, { report })
  assert.equal(inspected.status, 'mapped')
  assert.equal(inspected.confidence, 'heuristic')
  assert.equal(inspected.object.fields.text.owner, 'source')
  assert.deepEqual(inspected.object.fieldSpans.text, { start: content.indexOf('Hello'), end: content.indexOf('Hello') + 5,
    fingerprint: sha('Hello') })
  const proposal = planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content })
  assert.equal(proposal.allowed, true)
  assert.deepEqual(proposal.patch, { start: content.indexOf('Hello'), end: content.indexOf('Hello') + 5, replacement: 'Hi' })
  assert.deepEqual(proposal.impact, [{ sourcePath: map.sourcePath, documentId, nodeId: reference.nodeId, scope: 'route', route: '/home' }])
  assert.equal(content.slice(proposal.patch.start, proposal.patch.end), 'Hello')
})

test('revision drift and both element and field fingerprints gate literal proposals', () => {
  const { map, reference, content } = fixture()
  const stale = buildOwnership(map, { currentRevision: sha('promoted bytes') })
  assert.equal(stale.coverage.stale, 2)
  assert.equal(planLiteralOperation(map, stale, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code,
    'OWNERSHIP_MAPPING_STALE')
  const report = buildOwnership(map)
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: `${content} ` }).code,
    'OWNERSHIP_REVISION_CONFLICT')
  const wrongElement = structuredClone(map)
  wrongElement.nodes[0].source.fingerprint = sha('different element')
  assert.equal(planLiteralOperation(wrongElement, buildOwnership(wrongElement), { reference, expectedRevision: map.sourceRevision,
    text: 'Hi', currentSource: content }).code, 'OWNERSHIP_SPAN_MISMATCH')
  const wrongText = structuredClone(map)
  wrongText.nodes[0].fields.text.fingerprint = sha('different text')
  assert.equal(planLiteralOperation(wrongText, buildOwnership(wrongText), { reference, expectedRevision: map.sourceRevision,
    text: 'Hi', currentSource: content }).code, 'OWNERSHIP_SPAN_MISMATCH')
  const claim = { nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: 'source' },
    source: { ...map.nodes[0].source, start: map.nodes[0].fields.text.start, end: map.nodes[0].fields.text.end,
      fingerprint: sha('wrong claim span') } }
  assert.equal(planLiteralOperation(map, buildOwnership(map, { claims: [claim] }), { reference, expectedRevision: map.sourceRevision,
    text: 'Hi', currentSource: content }).code, 'OWNERSHIP_CLAIM_SPAN_MISMATCH')
})

test('a repeated literal is refused without choosing a first occurrence', () => {
  const content = source.replace('World', 'Hello')
  const { map, reference } = fixture(content)
  const report = buildOwnership(map)
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code,
    'OWNERSHIP_LITERAL_AMBIGUOUS')
  assert.equal(report.coverage.mapped, 2)
})

test('opaque, external, unresolved, and unsupported adapter regions remain inspectable and read only', () => {
  const { map, reference, content } = fixture()
  map.nodes[0].opaque = true
  map.nodes[1].external = true
  map.nodes[1].definition = { name: 'ExternalCard', sourcePath: 'src/components/layout/ExternalCard.tsx' }
  const opaqueReport = buildOwnership(map)
  assert.equal(opaqueReport.coverage.partial, 2)
  assert.ok(opaqueReport.objects[0].reasons.includes('OPAQUE_SOURCE_REGION'))
  assert.ok(opaqueReport.objects[1].reasons.includes('EXTERNAL_COMPONENT_INTERNALS'))
  assert.deepEqual(opaqueReport.objects[1].definitionFields, ['structure'])
  assert.equal(planLiteralOperation(map, opaqueReport, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code,
    'OWNERSHIP_LITERAL_UNSUPPORTED')
  map.nodes[0].opaque = false
  map.nodes[0].confidence = 'unresolved'
  assert.equal(buildOwnership(map).objects[0].status, 'partial')
  const claim = { nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'unknown-v1', fields: { text: 'source' } }
  assert.ok(buildOwnership(map, { claims: [claim] }).objects[0].reasons.includes('ADAPTER_UNSUPPORTED'))
})

test('conflicting source claims retain both claims and disable writes', () => {
  const { map, reference, content } = fixture()
  const claims = [
    { nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: 'source' } },
    { nodeId: map.nodes[0].id, mode: 'source-owned', adapterId: 'second-v1', fields: { text: 'source' } },
  ]
  const report = buildOwnership(map, { claims })
  assert.equal(report.coverage.conflict, 1)
  assert.equal(report.claims.length, 2)
  assert.deepEqual(report.claims.map(claim => claim.conflicts), [[1], [0]])
  assert.equal(report.objects[0].fields.text.supported, false)
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code,
    'OWNERSHIP_CLAIM_CONFLICT')
  const overlap = structuredClone(map)
  overlap.nodes.push({ ...structuredClone(overlap.nodes[0]), id: `node_${sha('duplicate')}` })
  const implicitConflict = buildOwnership(overlap)
  assert.equal(implicitConflict.coverage.conflict, 2)
})

test('generated provenance is required for document ownership; hybrid fields have separate authority', () => {
  const { map, reference, content } = fixture()
  const generated = { nodeId: map.nodes[0].id, mode: 'document-owned', adapterId: 'generator-v1',
    fields: { text: 'document' }, provenance: { documentId, generatorVersion: '1.0.0',
      outputPath: 'src/generated/Home.tsx', outputRevision: sha('generated'), generatedBoundary: { path: 'src/generated/Home.tsx' } } }
  const report = buildOwnership(map, { claims: [generated] })
  assert.equal(report.objects[0].mode, 'document-owned')
  assert.equal(report.objects[0].status, 'mapped')
  assert.equal(report.objects[0].provenance.outputRevision, sha('generated'))
  assert.deepEqual(report.objects[0].supportedOperations, [])
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code,
    'OWNERSHIP_LITERAL_UNSUPPORTED')
  assert.throws(() => buildOwnership(map, { claims: [{ ...generated, provenance: undefined }] }),
    code('OWNERSHIP_GENERATED_BOUNDARY_REQUIRED'))
  assert.throws(() => previewOwnershipChange(map, buildOwnership(map), [{ ...generated, provenance: undefined }]),
    code('OWNERSHIP_GENERATED_BOUNDARY_REQUIRED'))
  const hybrid = { nodeId: map.nodes[0].id, mode: 'hybrid-controlled', adapterId: 'tsx-static-v1',
    fields: { text: 'source', metadata: 'document' } }
  const hybridReport = buildOwnership(map, { claims: [hybrid] })
  assert.equal(hybridReport.objects[0].mode, 'hybrid-controlled')
  assert.deepEqual(hybridReport.objects[0].fields.text, { owner: 'source', supported: true })
  assert.equal(planLiteralOperation(map, hybridReport, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).allowed, true)
  const overlapping = buildOwnership(map, { claims: [{ ...hybrid, fields: { text: 'source' } }] })
  assert.ok(overlapping.objects[0].reasons.includes('HYBRID_BOUNDARY_REQUIRED'))
  assert.equal(overlapping.objects[0].supportedOperations.length, 0)
})

test('preview and acceptance require a matching digest and explicit confirmation without mutating accepted metadata', () => {
  const { map } = fixture()
  const report = buildOwnership(map)
  const snapshot = structuredClone(report)
  const changes = [{ nodeId: map.nodes[0].id, mode: 'hybrid-controlled', adapterId: 'tsx-static-v1',
    fields: { text: 'source', metadata: 'document' } }]
  const proposal = previewOwnershipChange(map, report, changes)
  assert.equal(proposal.requiresReview, true)
  assert.equal(proposal.affected[0].before.mode, 'source-owned')
  assert.equal(proposal.affected[0].after.mode, 'hybrid-controlled')
  assert.deepEqual(report, snapshot)
  assert.throws(() => acceptOwnershipChange(proposal, { digest: sha('wrong'), confirmation: 'ACCEPT OWNERSHIP CHANGE' }), code('OWNERSHIP_DIGEST_MISMATCH'))
  assert.throws(() => acceptOwnershipChange(proposal, { digest: proposal.digest, confirmation: 'no' }), code('OWNERSHIP_CONFIRMATION_REQUIRED'))
  const accepted = acceptOwnershipChange(proposal, { digest: proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  accepted.objects[0].mode = 'unmapped'
  assert.equal(proposal.report.objects[0].mode, 'hybrid-controlled')
  proposal.report.objects[0].mode = 'document-owned'
  assert.throws(() => acceptOwnershipChange(proposal, { digest: proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' }),
    code('OWNERSHIP_DIGEST_MISMATCH'))
})

test('qualified lookup, aliases, unmapped preview nodes, and shared owners remain explicit', () => {
  const { map, reference, content } = fixture(source, 'src/components/layout/Shell.tsx')
  map.aliases.push({ from: `node_${sha('old')}`, to: reference.nodeId, provenance: 'reviewed' })
  assert.equal(inspectOwnership(map, { ...reference, nodeId: map.aliases[0].from }).status, 'mapped')
  assert.equal(inspectOwnership(map, { ...reference, workspaceId: sha('other') }).status, 'workspace-mismatch')
  assert.equal(inspectOwnership(map, { ...reference, documentId: `doc_${sha('other')}` }).status, 'document-mismatch')
  assert.equal(inspectOwnership(map, { ...reference, nodeId: `node_${sha('missing')}` }).status, 'missing')
  const report = buildOwnership(map)
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).impact[0].scope,
    'shared')
  map.nodes.push({ ...structuredClone(map.nodes[0]), id: `node_${sha('runtime')}`, source: undefined, fields: {}, label: 'runtime only' })
  const unmapped = buildOwnership(map)
  assert.equal(unmapped.coverage.unmapped, 1)
  assert.equal(unmapped.objects[2].supportedOperations.length, 0)
})

test('diagnostics include qualified metadata but exclude labels, source bodies, and private paths', () => {
  const { map, content } = fixture()
  const report = buildOwnership(map)
  const exported = exportOwnershipDiagnostics(map, report)
  const encoded = JSON.stringify(exported)
  assert.equal(exported.objects[0].reference.workspaceId, workspaceId)
  assert.equal(exported.objects[0].source.path, 'src/pages/Home.tsx')
  assert.ok(encoded.length < 400_000)
  for (const forbidden of ['Private label', 'Hello', 'World', content, '/Users/waynetechlab']) assert.equal(encoded.includes(forbidden), false)
})

test('large diagnostics remain bounded and declare omitted records', () => {
  const { map } = fixture()
  const template = structuredClone(map.nodes[0])
  for (let i = 0; i < 998; i += 1) map.nodes.push({ ...template, id: `node_${sha(`extra-${i}`)}`, fields: {}, label: 'private fixture label' })
  const report = buildOwnership(map)
  const exported = exportOwnershipDiagnostics(map, report)
  assert.equal(report.coverage.total, 1_000)
  assert.equal(exported.truncated, true)
  assert.ok(Buffer.byteLength(JSON.stringify(exported), 'utf8') <= 400_000)
  assert.ok(exported.objects.length < 1_000)
  assert.equal(JSON.stringify(exported).includes('private fixture label'), false)
})

test('invalid maps, claims, reports, and unsafe replacements fail closed with stable codes', () => {
  const { map, reference, content } = fixture()
  const invalid = structuredClone(map)
  invalid.nodes[1].id = invalid.nodes[0].id
  assert.throws(() => buildOwnership(invalid), code('OWNERSHIP_INVALID_NODE'))
  assert.throws(() => buildOwnership(map, null), code('OWNERSHIP_INVALID_OPTIONS'))
  const ineligible = structuredClone(map)
  ineligible.sourcePath = 'src/index.css'
  assert.throws(() => buildOwnership(ineligible), code('OWNERSHIP_INVALID_MAP'))
  const badAlias = structuredClone(map)
  badAlias.aliases.push({ from: `node_${sha('old')}`, to: `node_${sha('absent')}`, provenance: 'reviewed' })
  assert.throws(() => buildOwnership(badAlias), code('OWNERSHIP_INVALID_ALIASES'))
  const report = buildOwnership(map)
  assert.throws(() => buildOwnership(map, { claims: [{ nodeId: `node_${sha('missing')}`, mode: 'source-owned', adapterId: 'tsx-static-v1' }] }),
    code('OWNERSHIP_UNKNOWN_NODE'))
  const forged = structuredClone(report)
  forged.objects[0].supportedOperations.push('structure')
  assert.throws(() => planLiteralOperation(map, forged, { reference, expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }),
    code('OWNERSHIP_INVALID_REPORT'))
  assert.throws(() => planLiteralOperation(map, report, null), code('OWNERSHIP_INVALID_OPERATION'))
  assert.equal(planLiteralOperation(map, report, { reference, expectedRevision: map.sourceRevision, text: '<script>', currentSource: content }).code,
    'OWNERSHIP_LITERAL_SYNTAX')
  assert.equal(planLiteralOperation(map, report, { reference: { ...reference, workspaceId: sha('other') },
    expectedRevision: map.sourceRevision, text: 'Hi', currentSource: content }).code, 'OWNERSHIP_WORKSPACE_MISMATCH')
})
