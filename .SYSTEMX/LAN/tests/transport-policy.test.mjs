import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeTransportJson, getRetryDisposition, getTransportPolicy, responseLimits } from '../Builder/transport-policy.mjs'

const get = (pathname, value, options) => encodeTransportJson({ method: 'GET', pathname, value, statusCode: 200, ...options })
const post = (pathname, value, options) => encodeTransportJson({ method: 'POST', pathname, value, statusCode: 200, ...options })
const retry = (method, pathname, keyedRecord) => getRetryDisposition({ method, pathname, keyedRecord })

test('advertises repeatable reads separately from proposal and manual-reconciliation routes', () => {
  const policy = getTransportPolicy()
  assert.equal(policy.responses.jsonBytes, responseLimits.jsonBytes)
  assert.equal(policy.retryHeader, 'X-SystemX-Retry')
  assert.equal(policy.representationHeader, 'X-SystemX-Representation')
  for (const path of policy.retry['read-only'].postRoutes) assert.equal(retry('POST', path), 'read-only', path)
  for (const path of policy.retry['fresh-proposal'].routes) assert.equal(retry('POST', path), 'fresh-proposal', path)
  for (const path of policy.retry['reconcile-before-retry'].routes) assert.equal(retry('POST', path), 'reconcile-before-retry', path)
  assert.equal(retry('GET', '/api/builder/source'), 'read-only')
  assert.equal(retry('POST', '/api/builder/source'), 'fresh-proposal')
  assert.equal(retry('GET', '/api/transport/policy'), 'read-only')
  assert.equal(retry('HEAD', '/Website/dashboard.js'), 'read-only')
  assert.equal(retry('POST', '/api/contracts/query'), 'read-only')
  assert.equal(retry('POST', '/api/contracts/command'), 'fresh-proposal')
  assert.equal(retry('POST', '/api/status'), 'not-applicable')
  assert.equal(retry('GET', '/api/missing'), 'not-applicable')
})

test('keyed retry is exclusive to a validated key on a local record operation', () => {
  const description = getTransportPolicy().retry['idempotent-keyed']
  assert.equal(description.keyHeader, 'Idempotency-Key')
  assert.equal(description.retentionHours, 24)
  assert.equal(description.maximumLiveKeys, 128)
  assert.match(description.scope, /restart/)
  assert.equal(retry('POST', description.route, true), 'idempotent-keyed')
  for (const value of [undefined, false, 'unverified']) assert.equal(retry('POST', description.route, value), 'reconcile-before-retry')
  assert.equal(retry('POST', '/api/builder/component', true), 'reconcile-before-retry')
  assert.equal(retry('POST', '/api/contracts/command', true), 'fresh-proposal')
})

test('compact and download encoding preserve complete JSON including escapes and native omissions', () => {
  const value = { title: 'Quotes " · 絵 · 🎨', details: [true, null, undefined, { empty: {}, ignored: undefined }],
    '': { 'quoted"key': '\t\n\r\\', loneSurrogate: '\ud800' }, count: 27, repeated: [] }
  value.repeated = [value.details, value.details]
  for (const pretty of [false, true]) {
    const result = get('/api/builder/components/export', value, { pretty })
    assert.equal(result.statusCode, 200)
    assert.equal(result.representation, 'complete')
    assert.equal(result.body, JSON.stringify(value, null, pretty ? 2 : undefined) + '\n')
  }
})

test('accepts the exact UTF-8 wire limit and refuses the whole source or indented export one byte later', () => {
  for (const [pathname, pretty] of [['/api/builder/source', false], ['/api/builder/components/export', true]]) {
    const value = { content: ['é', { text: '' }] }
    const overhead = Buffer.byteLength(JSON.stringify(value, null, pretty ? 2 : undefined) + '\n')
    const room = responseLimits.jsonBytes - overhead
    value.content[1].text = '絵'.repeat(Math.floor(room / 3)) + 'a'.repeat(room % 3)
    const exact = get(pathname, value, { pretty })
    assert.equal(exact.statusCode, 200)
    assert.equal(Buffer.byteLength(exact.body), responseLimits.jsonBytes)
    value.content[1].text += 'a'
    const denied = get(pathname, value, { pretty })
    assert.equal(denied.statusCode, 413)
    assert.equal(denied.representation, 'refused')
    const report = JSON.parse(denied.body)
    assert.equal(report.code, 'TRANSPORT_RESPONSE_TOO_LARGE')
    assert.equal(report.complete, false)
    assert.equal(report.content, undefined)
    assert.ok(Buffer.byteLength(denied.body) < 1024)
  }
})

test('refuses excessive nesting explicitly while retaining preexisting failure status', () => {
  let value = { text: 'deep data' }
  for (let i = 0; i <= responseLimits.nesting; i++) value = { inner: value }
  assert.equal(get('/api/builder/data', value).statusCode, 413)
  const priorRefusal = get('/api/builder/data', value, { statusCode: 409 })
  assert.equal(priorRefusal.statusCode, 409)
  assert.equal(JSON.parse(priorRefusal.body).maxDepth, responseLimits.nesting)
})

test('ordinary write receipts keep their shapes and oversized legacy successes keep their real outcome', () => {
  const excess = 'x'.repeat(responseLimits.legacyAcknowledgementBytes)
  const examples = [
    ['/api/builder/record', { status: 'saved-local-record', data: { users: [] } }, 'data'],
    ['/api/builder/page', { status: 'saved-local-model', page: { id: 'home', name: 'Home', nodeTree: {} } }, 'page'],
    ['/api/builder/component', { status: 'saved-local-component', component: { id: 'card', name: 'Card', export: { format: 'systemx-component', version: 1 } }, linkedNode: { pageId: 'home', nodeId: 'text' }, registry: {} }, 'registry'],
    ['/api/builder/ingest', { status: 'inventory-complete', manifestPath: 'Temp/example/manifest.json', manifest: { project: { framework: 'react' }, pages: [{}], components: [{}, {}] } }, 'manifest'],
  ]
  for (const [path, value, field] of examples) {
    assert.deepEqual(JSON.parse(post(path, value).body), value)
    value[field].largeDetail = excess
    const result = post(path, value)
    assert.equal(result.statusCode, 200)
    assert.equal(result.representation, 'acknowledgement')
    assert.ok(Buffer.byteLength(result.body) < 1024)
    const receipt = JSON.parse(result.body)
    assert.equal(receipt.status, value.status)
    assert.equal(receipt.acknowledgement, true)
    assert.equal(receipt.detailOmitted, true)
    if (field === 'data') assert.equal(receipt.data, undefined)
    if (field === 'page') assert.deepEqual(receipt.page, { id: 'home', name: 'Home' })
    if (field === 'registry') {
      assert.deepEqual(receipt.component, value.component)
      assert.deepEqual(receipt.linkedNode, value.linkedNode)
      assert.equal(receipt.registry, undefined)
    }
    if (field === 'manifest') {
      assert.equal(receipt.manifestPath, value.manifestPath)
      assert.deepEqual(receipt.summary, { framework: 'react', pageCount: 1, componentCount: 2 })
      assert.equal(receipt.manifest, undefined)
    }
  }
})

test('versioned graph and identity results retain their envelopes above the legacy receipt budget', () => {
  const detail = 'x'.repeat(responseLimits.legacyAcknowledgementBytes)
  for (const version of ['1.0', '1.1']) {
    const value = { apiVersion: version, requestId: 'graph_check', ok: true, result: { document: { detail } } }
    const graph = post('/api/contracts/command', value)
    assert.equal(graph.representation, 'complete')
    assert.equal(graph.body, JSON.stringify(value) + '\n')
  }
  const identity = { accepted: true, map: { detail } }
  assert.equal(post('/api/identity/accept', identity).body, JSON.stringify(identity) + '\n')
})

test('oversized graph inspection retains its typed refusal; a completed command never becomes a failed read', () => {
  const value = { apiVersion: '1.0', requestId: 'legacy', ok: true, result: 'x'.repeat(responseLimits.jsonBytes) }
  const inspection = post('/api/contracts/query', value)
  const refusal = JSON.parse(inspection.body)
  assert.equal(inspection.statusCode, 413)
  assert.equal(refusal.apiVersion, '1.0')
  assert.equal(refusal.requestId, 'legacy')
  assert.equal(refusal.ok, false)
  assert.equal(refusal.error.code, 'TRANSPORT_RESPONSE_TOO_LARGE')
  assert.deepEqual(refusal.error.findings, [])
  const command = post('/api/contracts/command', value)
  assert.deepEqual(command, { statusCode: 204, representation: 'acknowledgement', body: '' })
})
