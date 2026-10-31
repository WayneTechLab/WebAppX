import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { canonicalJson, GraphError, graphLimits, graphRevision, normalizeGraph, serializeGraph } from '../Builder/graph-core.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const source = { path: 'src/pages/HomePage.tsx', sourceRevision: sha('source bytes'),
  start: 0, end: 20, fingerprint: sha('source span') }

function fixture() {
  return {
    schemaVersion: 1, workspaceId: sha('workspace'), documentId: 'doc_home',
    sourceRevision: source.sourceRevision,
    pages: [{ id: 'page_home', rootId: 'node_root', route: '/' }],
    nodes: [
      { id: 'node_right', kind: 'opaque', parentId: 'node_root', childIds: [], label: 'External region',
        ownership: 'read-only', source: { ...source, start: 21, end: 40 }, opaqueReason: 'Unsupported JSX expression' },
      { id: 'node_root', kind: 'element', parentId: null, childIds: ['node_left', 'node_right'], label: 'main',
        ownership: 'source-owned', source: { ...source }, opaqueReason: null },
      { id: 'node_left', kind: 'element', parentId: 'node_root', childIds: [], label: 'section',
        ownership: 'source-owned', source: { ...source, start: 41, end: 60 }, opaqueReason: null },
    ],
    references: [{ id: 'ref_node', kind: 'node', documentId: 'doc_home', targetId: 'node_left',
      expectedVersion: null, expectedSchemaId: null, required: true }],
    components: [{ id: 'component_card', version: '1.0', rootId: 'node_left' }],
    collections: [{ id: 'collection_posts', schemaId: 'posts.v1', version: '1' }],
    extensions: { 'org.webappx.readonly': { region: { note: 'Unparsed display metadata', rank: 2 } } },
  }
}

function fails(action, code) {
  assert.throws(action, error => error instanceof GraphError && error.code === code
    && error.findings.length > 0 && error.findings.length <= graphLimits.findings
    && Number.isInteger(error.omittedCount) && error.omittedCount >= 0)
}

test('normalization copies exact graph shape and preserves source-owned and opaque metadata', () => {
  const input = fixture()
  const original = structuredClone(input)
  const graph = normalizeGraph(input)
  assert.deepEqual(input, original)
  assert.notStrictEqual(graph, input)
  assert.notStrictEqual(graph.nodes[0], input.nodes[0])
  assert.deepEqual(graph.nodes.map(node => node.id), ['node_left', 'node_right', 'node_root'])
  assert.deepEqual(graph.nodes[2].childIds, ['node_left', 'node_right'])
  assert.deepEqual(graph.nodes[2].source, source)
  assert.equal(graph.nodes[1].kind, 'opaque')
  assert.equal(graph.nodes[1].opaqueReason, 'Unsupported JSX expression')
  graph.extensions['org.webappx.readonly'].region.rank = 3
  assert.equal(input.extensions['org.webappx.readonly'].region.rank, 2)
})

test('canonical bytes and revisions ignore object and collection insertion order but keep child order', () => {
  const first = fixture()
  first.pages.push({ id: 'page_secondary', rootId: 'node_secondary', route: '/secondary' })
  first.nodes.push({ id: 'node_secondary', kind: 'element', parentId: null, childIds: [],
    label: 'aside', ownership: 'read-only', source: null, opaqueReason: null })
  first.references.push({ id: 'ref_secondary', kind: 'node', documentId: 'doc_home',
    targetId: 'node_secondary', expectedVersion: null, expectedSchemaId: null, required: false })
  first.components.push({ id: 'component_secondary', version: '2.0', rootId: 'node_secondary' })
  first.collections.push({ id: 'collection_secondary', schemaId: 'secondary.v1', version: '1' })
  const reversed = Object.fromEntries(Object.entries(first).reverse())
  reversed.pages = [...first.pages].reverse()
  reversed.nodes = [...first.nodes].reverse().map(node => Object.fromEntries(Object.entries(node).reverse()))
  reversed.references = [...first.references].reverse()
  reversed.components = [...first.components].reverse()
  reversed.collections = [...first.collections].reverse()
  reversed.extensions = { 'org.webappx.readonly': { region: { rank: 2, note: 'Unparsed display metadata' } } }
  const bytes = serializeGraph(first)
  assert.equal(bytes, serializeGraph(reversed))
  assert.equal(bytes, serializeGraph(first))
  assert.equal(graphRevision(first), sha(bytes))
  assert.equal(graphRevision(reversed), graphRevision(first))
  assert.deepEqual(JSON.parse(bytes).pages.map(page => page.id), ['page_home', 'page_secondary'])
  assert.deepEqual(JSON.parse(bytes).references.map(reference => reference.id), ['ref_node', 'ref_secondary'])
  assert.deepEqual(JSON.parse(bytes).components.map(component => component.id), ['component_card', 'component_secondary'])
  assert.deepEqual(JSON.parse(bytes).collections.map(collection => collection.id), ['collection_posts', 'collection_secondary'])
  const reordered = fixture()
  reordered.pages = first.pages
  reordered.nodes.push(first.nodes.at(-1))
  reordered.references = first.references
  reordered.components = first.components
  reordered.collections = first.collections
  reordered.nodes.find(node => node.id === 'node_root').childIds.reverse()
  assert.notEqual(graphRevision(reordered), graphRevision(first))
  const changed = fixture()
  changed.pages = first.pages
  changed.nodes.push(first.nodes.at(-1))
  changed.references = first.references
  changed.components = first.components
  changed.collections = first.collections
  changed.nodes.find(node => node.id === 'node_left').label = 'article'
  assert.notEqual(graphRevision(changed), graphRevision(first))
  assert.deepEqual(JSON.parse(bytes).nodes.find(node => node.id === 'node_root').childIds, ['node_left', 'node_right'])
})

test('generic canonical JSON refuses executable object behavior without running accessors', () => {
  assert.equal(canonicalJson({ z: { b: 2, a: 1 }, a: [true, null] }), '{"a":[true,null],"z":{"a":1,"b":2}}')
  const cycle = {}; cycle.self = cycle
  fails(() => canonicalJson(cycle), 'GRAPH_JSON_CYCLE')
  let ran = false
  fails(() => canonicalJson({ get unsafe() { ran = true; return 'secret' } }), 'GRAPH_JSON_INVALID')
  assert.equal(ran, false)
  fails(() => canonicalJson({ value: undefined }), 'GRAPH_JSON_INVALID')
  fails(() => canonicalJson(new Date()), 'GRAPH_JSON_INVALID')
  const proxy = new Proxy({}, { get() { ran = true; return 'secret' } })
  fails(() => canonicalJson(proxy), 'GRAPH_JSON_INVALID')
  assert.equal(ran, false)
  fails(() => canonicalJson(Array(2)), 'GRAPH_JSON_INVALID')
  fails(() => canonicalJson(JSON.parse('{"__proto__":{"polluted":true}}')), 'GRAPH_JSON_INVALID')
  assert.equal({}.polluted, undefined)
})

test('strict shape, schema version and source span refusals do not change the input', () => {
  const base = fixture()
  const future = structuredClone(base); future.schemaVersion = 2
  fails(() => normalizeGraph(future), 'GRAPH_SCHEMA_UNSUPPORTED')
  assert.equal(future.schemaVersion, 2)
  const missing = structuredClone(base); delete missing.references
  fails(() => normalizeGraph(missing), 'GRAPH_SHAPE_INVALID')
  const extra = structuredClone(base); extra.runtime = { pid: 123 }
  fails(() => normalizeGraph(extra), 'GRAPH_RUNTIME_FIELD')
  const badSource = structuredClone(base); badSource.nodes[0].source.path = '../outside.tsx'
  fails(() => normalizeGraph(badSource), 'GRAPH_SOURCE_PATH_INVALID')
  const privatePath = structuredClone(base); privatePath.nodes[0].label = '/Users/private/project'
  fails(() => normalizeGraph(privatePath), 'GRAPH_PRIVATE_FIELD')
  const badSpan = structuredClone(base); badSpan.nodes[0].source.end = -1
  fails(() => normalizeGraph(badSpan), 'GRAPH_SOURCE_SPAN_INVALID')
  assert.deepEqual(base, fixture())
})

test('runtime/private data and unsupported extension namespaces are refused at any nested level', () => {
  const ext = fixture()
  ext.extensions['org.webappx.readonly'].region.sessionToken = 'redacted'
  fails(() => normalizeGraph(ext), 'GRAPH_RUNTIME_FIELD')
  delete ext.extensions['org.webappx.readonly'].region.sessionToken
  ext.extensions['org.webappx.readonly'].region.note = 'Bearer hiddencredential'
  fails(() => normalizeGraph(ext), 'GRAPH_PRIVATE_FIELD')
  const unknown = fixture(); unknown.extensions['org.other.plugin'] = { note: 'safe' }
  fails(() => normalizeGraph(unknown), 'GRAPH_EXTENSION_NAMESPACE_UNSUPPORTED')
  const executable = fixture(); executable.extensions['org.webappx.readonly'].region.onClick = 'run'
  fails(() => normalizeGraph(executable), 'GRAPH_RUNTIME_FIELD')
  const wrapper = fixture(); wrapper.nodes[0].kind = 'document-root'
  fails(() => normalizeGraph(wrapper), 'GRAPH_DOCUMENT_ROOT_INVALID')
})

test('all byte, collection, extension and nesting budgets fail before returning a partial graph', () => {
  const tooManyNodes = fixture()
  tooManyNodes.nodes = Array.from({ length: graphLimits.nodes + 1 }, (_, index) => ({
    ...tooManyNodes.nodes[0], id: `node_${index}`,
  }))
  fails(() => normalizeGraph(tooManyNodes), 'GRAPH_COLLECTION_LIMIT')
  const tooBigExtension = fixture()
  tooBigExtension.extensions['org.webappx.readonly'] = { note: 'a'.repeat(graphLimits.extensionBytes) }
  fails(() => normalizeGraph(tooBigExtension), 'GRAPH_EXTENSION_BYTE_LIMIT')
  const tooDeepExtension = fixture()
  tooDeepExtension.extensions['org.webappx.readonly'] = { a: { b: { c: { d: { e: { f: true } } } } } }
  fails(() => normalizeGraph(tooDeepExtension), 'GRAPH_EXTENSION_DEPTH')
  const tooBigDocument = fixture()
  tooBigDocument.references = Array.from({ length: graphLimits.references }, (_, index) => ({
    id: `ref_${String(index).padStart(4, '0')}_${'x'.repeat(80)}`, kind: 'node',
    documentId: 'doc_home', targetId: `node_${'a'.repeat(80)}`,
    expectedVersion: 'v'.repeat(120), expectedSchemaId: 's'.repeat(300), required: true,
  }))
  fails(() => normalizeGraph(tooBigDocument), 'GRAPH_BYTE_LIMIT')
  let deep = null
  for (let index = 0; index <= graphLimits.depth; index += 1) deep = [deep]
  fails(() => canonicalJson(deep), 'GRAPH_DEPTH_LIMIT')
})

test('schema declares the narrow public graph shape and matching limits', () => {
  const schema = JSON.parse(readFileSync(new URL('../Builder/contracts/graph-read-model.schema.json', import.meta.url), 'utf8'))
  assert.equal(schema.properties.schemaVersion.const, 1)
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(fixture())))
  assert.equal(schema.properties.nodes.maxItems, graphLimits.nodes)
  assert.equal(schema.properties.references.maxItems, graphLimits.references)
  assert.deepEqual(Object.keys(schema.properties.extensions.properties), ['org.webappx.readonly'])
  assert.equal(schema.$defs.node.properties.childIds.description.includes('never sorted'), true)
})

test('GraphError bounds supplied diagnostics and carries the omitted count', () => {
  const error = new GraphError('GRAPH_TEST', 'contained', {
    findings: Array.from({ length: 53 }, (_, index) => ({ id: `finding_${index}` })), omittedCount: 2,
  })
  assert.equal(error.findings.length, graphLimits.findings)
  assert.equal(error.omittedCount, 5)
  assert.equal(error.category, 'validation')
  assert.equal(error.statusCode, 400)
})

test('a single-segment app route stays valid while filesystem values remain refused elsewhere', () => {
  const input = fixture()
  for (const route of ['/home', '/about', '/hr/demo/admin/payroll', '/cms/demo', '/crm/demo']) {
    input.pages[0].route = route
    assert.equal(normalizeGraph(input).pages[0].route, route)
  }
  input.nodes[0].label = '/home'
  fails(() => normalizeGraph(input), 'GRAPH_PRIVATE_FIELD')
  input.nodes[0].label = 'region'
  for (const route of ['/Users/owner/private-project', '/Volumes/drive/private-project', '/home/settings']) {
    input.pages[0].route = route
    fails(() => normalizeGraph(input), 'GRAPH_ROUTE_PRIVATE_PREFIX')
  }
  input.pages[0].route = '/home'
  input.extensions['org.webappx.readonly'] = { route: '/home/owner/private-project' }
  fails(() => normalizeGraph(input), 'GRAPH_PRIVATE_FIELD')
})

test('reviewed extension arrays and objects enforce the published thousand-entry bound', () => {
  const input = fixture()
  input.extensions['org.webappx.readonly'] = Array(1000).fill(0)
  assert.equal(normalizeGraph(input).extensions['org.webappx.readonly'].length, 1000)
  input.extensions['org.webappx.readonly'].push(0)
  fails(() => normalizeGraph(input), 'GRAPH_EXTENSION_ENTRY_LIMIT')
  input.extensions['org.webappx.readonly'] = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`n${i}`, 0]))
  assert.equal(Object.keys(normalizeGraph(input).extensions['org.webappx.readonly']).length, 1000)
  input.extensions['org.webappx.readonly'].extra = 0
  fails(() => normalizeGraph(input), 'GRAPH_EXTENSION_ENTRY_LIMIT')
})
