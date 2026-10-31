import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchSourceIdentity } from '../Builder/source-identity-http.mjs'

const url = path => new URL(`http://127.0.0.1:7331/api/identity/${path}`)

test('identity HTTP dispatch keeps observation routes separate from mutation verbs', async () => {
  const called = []
  const service = { status: () => ({ documents: [] }), read: body => { called.push(body); return { map: null } } }
  assert.equal((await dispatchSourceIdentity({ service, method: 'GET', url: url('status') })).statusCode, 200)
  assert.equal((await dispatchSourceIdentity({ service, method: 'GET', url: url('document?documentId=doc_123') })).statusCode, 200)
  assert.deepEqual(called, [{ documentId: 'doc_123' }])
  assert.equal((await dispatchSourceIdentity({ service, method: 'GET', url: url('accept') })).statusCode, 405)
  assert.equal((await dispatchSourceIdentity({ service, method: 'HEAD', url: url('status') })).statusCode, 405)
})

test('identity queries refuse duplicate identifiers, unexpected filters and query/body mixing before service access', async () => {
  const service = new Proxy({}, { get: () => { assert.fail('Invalid input must not reach a service method.') } })
  for (const path of ['status?path=src/pages/Home.tsx', 'document', 'document?documentId=a&documentId=b', 'document?documentId=a&path=x']) {
    assert.equal((await dispatchSourceIdentity({ service, method: 'GET', url: url(path) })).statusCode, 400)
  }
  assert.equal((await dispatchSourceIdentity({ service, method: 'POST', url: url('accept?digest=a'), body: {} })).statusCode, 400)
})

test('identity operation bodies refuse arrays, extra fields and excess UTF-8 bytes', async () => {
  const service = new Proxy({}, { get: () => { assert.fail('Invalid body must not invoke the service.') } })
  for (const body of [null, [], { path: 'src/pages/Home.tsx', force: true }, { path: 'é'.repeat(200_001) }]) {
    assert.equal((await dispatchSourceIdentity({ service, method: 'POST', url: url('preview'), body })).statusCode, 400)
  }
})

test('identity service refusals expose a bounded code without private exception content', async () => {
  const secretError = Object.assign(new Error('/private/host/source.tsx contains PRIVATE_BODY_MARKER'), { code: 'IDENTITY_REVISION_STALE' })
  const service = { accept: () => { throw secretError } }
  const response = await dispatchSourceIdentity({ service, method: 'POST', url: url('accept'), body: { digest: 'x', confirmation: 'x' } })
  assert.equal(response.statusCode, 409)
  assert.equal(response.result.code, 'IDENTITY_REVISION_STALE')
  assert.doesNotMatch(JSON.stringify(response), /PRIVATE_BODY_MARKER|private\/host/)
})

test('identity dispatch does not resolve inherited property names as operations', async () => {
  const service = new Proxy({}, { get: () => { assert.fail('Unknown operation reached service.') } })
  for (const name of ['constructor', '__proto__', 'toString', 'ownership/constructor']) {
    assert.equal((await dispatchSourceIdentity({ service, method: 'POST', url: url(name), body: {} })).statusCode, 405)
  }
})

test('literal proposals and ownership acceptance have distinct declared methods and payloads', async () => {
  const seen = []
  const service = {
    operation: body => { seen.push(['operation', body]); return { allowed: false } },
    ownershipAccept: body => { seen.push(['ownershipAccept', body]); return { accepted: true } },
  }
  const proposal = { documentId: 'doc_1', reference: { workspaceId: 'w', documentId: 'doc_1', nodeId: 'n' }, expectedRevision: 'r', text: 'Example' }
  const acceptance = { digest: 'd', confirmation: 'ACCEPT OWNERSHIP CHANGE' }
  await dispatchSourceIdentity({ service, method: 'POST', url: url('operation'), body: proposal })
  await dispatchSourceIdentity({ service, method: 'POST', url: url('ownership/accept'), body: acceptance })
  assert.deepEqual(seen, [['operation', proposal], ['ownershipAccept', acceptance]])
})
