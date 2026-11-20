import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import { dispatchSourceIdentity } from '../Builder/source-identity-http.mjs'
import { evaluateRequestPolicy } from '../Builder/request-policy.mjs'

function evaluate(method, path, contentType, contractEnvelope) {
  const { pathname } = new URL(path, 'http://localhost')
  return evaluateRequestPolicy({ method, pathname, contentType, contractEnvelope })
}

test('dashboard data and discovery routes admit their documented GETs', () => {
  for (const path of [
    '/api/health', '/api/status?workScope=root', '/api/tools', '/api/transport/diagnostics',
    '/api/auth/providers', '/api/fonts/catalog?q=Inter', '/api/fonts/project',
    '/api/builder/workspace', '/api/builder/data', '/api/builder/components',
    '/api/builder/components/export', '/api/builder/source/inventory?limit=10',
    '/api/builder/source/policy', '/api/builder/source/history?path=src/pages/Home.tsx',
    '/api/contracts/discovery?clientVersion=1.0', '/api/identity/status', '/api/identity/document?documentId=home',
  ]) {
    assert.equal(evaluate('GET', path), null, path)
    const refusal = evaluate('POST', path, 'application/json')
    assert.equal(refusal.statusCode, 405, path)
    assert.equal(refusal.allow, 'GET', path)
  }
})

test('legacy mutations and versioned operations require their declared POST', () => {
  for (const path of [
    '/api/builder/font', '/api/builder/page', '/api/builder/component', '/api/builder/ingest',
    '/api/builder/record', '/api/builder/preview', '/api/contracts/query', '/api/contracts/command',
    '/api/identity/preview', '/api/identity/accept', '/api/identity/lookup', '/api/identity/inspect',
    '/api/identity/export', '/api/identity/reopen', '/api/identity/ownership/preview',
    '/api/identity/ownership/accept', '/api/identity/operation',
  ]) {
    assert.equal(evaluate('POST', path, 'application/json'), null, path)
    const refusal = evaluate('GET', path)
    assert.equal(refusal.statusCode, 405, path)
    assert.equal(refusal.allow, 'POST', path)
  }
})

test('source admits both read and save and applies media policy only to a save', () => {
  const path = '/api/builder/source'
  assert.equal(evaluate('GET', path + '?path=src/pages/Home.tsx'), null)
  assert.equal(evaluate('POST', path, 'application/json'), null)
  assert.equal(evaluate('POST', path).statusCode, 415)
  for (const method of ['HEAD', 'PUT', 'OPTIONS']) {
    const refusal = evaluate(method, path)
    assert.equal(refusal.statusCode, 405)
    assert.equal(refusal.allow, 'GET, POST')
  }
})

test('dashboard documents and Website assets admit reads and metadata requests', () => {
  for (const path of ['/', '/Website_Dashboard.html', '/Website/dashboard.js']) {
    assert.equal(evaluate('GET', path), null)
    assert.equal(evaluate('HEAD', path), null)
    assert.deepEqual(evaluate('POST', path, 'application/json'), {
      statusCode: 405, allow: 'GET, HEAD',
      result: { code: 'METHOD_NOT_ALLOWED', error: 'Use a declared method for this local route.' },
    })
  }
  for (const method of ['GET', 'POST']) {
    assert.equal(evaluate(method, '/api/unknown').statusCode, 404)
    assert.equal(evaluate(method, '/other.html').statusCode, 404)
  }
})

test('accepts application/json and optional UTF-8 charset from supported browser clients', () => {
  for (const contentType of [
    'application/json', ['application/json'], 'application/json; charset=utf-8',
    'APPLICATION/JSON; Charset="UTF-8"', ['application/json; charset=UTF-8'],
  ]) {
    for (const path of ['/api/builder/preview', '/api/identity/preview', '/api/contracts/query']) {
      assert.equal(evaluate('POST', path, contentType), null, path)
    }
  }
})

test('incompatible or missing JSON media receives a bounded family-specific refusal', () => {
  for (const contentType of [
    undefined, '', 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data',
    'application/javascript', 'application/json; charset=UTF-16', 'application/json; profile=custom',
    ['application/json', 'text/plain'], 'application/json, text/plain',
  ]) {
    const legacy = evaluate('POST', '/api/builder/record', contentType)
    assert.equal(legacy.statusCode, 415)
    assert.equal(legacy.result.code, 'MEDIA_TYPE_UNSUPPORTED')
    const identity = evaluate('POST', '/api/identity/preview', contentType)
    assert.equal(identity.statusCode, 415)
    assert.equal(identity.result.code, 'IDENTITY_MEDIA_TYPE_UNSUPPORTED')
    const graph = evaluate('POST', '/api/contracts/command', contentType)
    assert.equal(graph.statusCode, 415)
    assert.equal(graph.result.ok, false)
    assert.equal(graph.result.error.code, 'API_MEDIA_TYPE_UNSUPPORTED')
    assert.equal(graph.result.error.category, 'validation')
    assert.equal(graph.result.requestId, null)
    assert.equal(graph.readContractEnvelope, undefined)
  }
})

test('graph method refusal matches the dispatcher across supported versions and unknown routes', async () => {
  const inputs = [
    ['GET', '/api/contracts/command', undefined], ['HEAD', '/api/contracts/discovery', undefined],
    ['POST', '/api/contracts/discovery', { apiVersion: '1.0', requestId: 'previous-client' }],
    ['POST', '/api/contracts/unknown', { apiVersion: '1.1', requestId: 'current-client' }],
    ['POST', '/api/contracts/unknown', { apiVersion: '3.0', requestId: 'invalid id' }],
  ]
  for (const [method, path, body] of inputs) {
    const contentType = method === 'POST' ? 'application/json' : undefined
    const refusal = evaluate(method, path, contentType, body)
    const expected = await dispatchGraphContract({ service: {}, method, url: path, body })
    assert.equal(refusal.statusCode, expected.statusCode)
    assert.deepEqual(refusal.result, expected.result)
    assert.equal(refusal.readContractEnvelope, undefined)
  }
  assert.equal(evaluate('POST', '/api/contracts/discovery', 'application/json').readContractEnvelope, true)
  assert.equal(evaluate('POST', '/api/contracts/discovery', 'text/plain').readContractEnvelope, undefined)
})

test('identity method refusal matches the established dispatcher result', async () => {
  for (const [method, path] of [
    ['GET', '/api/identity/accept'], ['HEAD', '/api/identity/status'],
    ['POST', '/api/identity/document'], ['GET', '/api/identity/unknown'],
  ]) {
    const refusal = evaluate(method, path, 'application/json')
    const expected = await dispatchSourceIdentity({ service: {}, method, url: new URL(path, 'http://localhost') })
    assert.equal(refusal.statusCode, expected.statusCode)
    assert.deepEqual(refusal.result, expected.result)
  }
})
