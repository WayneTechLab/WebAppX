import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  API_VERSION, SUPPORTED_API_VERSIONS, getContractRegistry, getOperationDescriptor,
} from '../Builder/api-contracts.mjs'
import { validateApiRequest } from '../Builder/api-validation.mjs'
import {
  ApiToolError, compareApiContracts, contractExamples, dispatchContractTool,
  exportPublicContracts, negotiateApiVersion,
} from '../Builder/api-tools.mjs'

const supported = ['1.0', '1.1']

test('older and current clients negotiate exact reviewed versions with contained future refusal', () => {
  assert.equal(API_VERSION, '1.1')
  assert.deepEqual([...SUPPORTED_API_VERSIONS].sort(), supported)
  for (const version of supported) {
    const discovery = negotiateApiVersion(version)
    const text = JSON.stringify(discovery)
    assert.match(text, new RegExp(version.replace('.', '\\.')))
    assert.ok(text.length < 100_000, 'Discovery metadata is bounded')
    assert.equal(getContractRegistry(version).apiVersion, version)
  }
  for (const version of ['2.0', '', null, 1.1]) {
    assert.throws(() => negotiateApiVersion(version), (error) =>
      error instanceof ApiToolError && error.category === 'incompatible-version'
      && error.code === 'API_VERSION_UNSUPPORTED' && supported.every((item) => error.message.includes(item)))
  }
  assert.ok(getOperationDescriptor('graph.status', '1.0')?.implemented)
  assert.ok(!getOperationDescriptor('contracts.compatibility', '1.0')?.implemented)
})

test('compatibility is directional, deterministic, and tied to exact schema revisions', () => {
  const forward = compareApiContracts('1.0', '1.1')
  const reverse = compareApiContracts('1.1', '1.0')
  assert.equal(forward.beforeSchemaRevision, getContractRegistry('1.0').schemaRevision)
  assert.equal(forward.afterSchemaRevision, getContractRegistry('1.1').schemaRevision)
  assert.equal(forward.beforeVersion, '1.0')
  assert.equal(forward.afterVersion, '1.1')
  assert.ok(forward.additions.some((change) => change.operation === 'contracts.compatibility'))
  assert.ok(reverse.breakingChanges.some((change) => change.operation === 'contracts.compatibility'))
  assert.equal(forward.additionCount + forward.breakingCount,
    forward.additions.length + forward.breakingChanges.length + forward.omittedCount)
  assert.ok(forward.additions.length + forward.breakingChanges.length <= 50)
  assert.deepEqual(compareApiContracts('1.0', '1.1'), forward)
  const same = compareApiContracts('1.0', '1.0')
  assert.equal(same.additionCount, 0)
  assert.equal(same.breakingCount, 0)
  assert.throws(() => compareApiContracts('1.0', '2.0'), (error) =>
    error instanceof ApiToolError && error.category === 'incompatible-version')
})

test('all implemented descriptors provide locally inspectable, schema-valid synthetic envelopes', () => {
  for (const version of supported) {
    const registry = getContractRegistry(version)
    const implementedIds = registry.operations.filter((item) => item.implemented).map((item) => item.id).sort()
    for (const operation of implementedIds) {
      const examples = contractExamples({ operation, version })
      assert.equal(examples.schemaRevision, registry.schemaRevision)
      assert.equal(examples.validRequest.apiVersion, version)
      assert.equal(examples.invalidRequest.apiVersion, version)
      assert.equal(examples.validRequest.operation, operation)
      assert.equal(examples.validRequest.payload.type, operation)
      assert.equal(examples.invalidRequest.payload.unexpectedField, true)
      assert.equal(validateApiRequest(examples.validRequest, { kind: examples.validRequest.kind }).descriptor.id, operation)
      assert.throws(() => validateApiRequest(examples.invalidRequest, { kind: examples.invalidRequest.kind }))
    }
    // This is a source-level fixture receipt, not evidence that a server executed the operations.
    console.log(`api-tools fixture receipt ${version} ${registry.schemaRevision} ${implementedIds.join(',')}`)
  }
  assert.throws(() => contractExamples({ operation: 'graph.findings', version: '1.0' }),
    (error) => error instanceof ApiToolError && error.category === 'capability')
})

test('metadata export is public, deterministic, detached, and free of process state', () => {
  for (const version of supported) {
    const first = exportPublicContracts(version)
    const second = exportPublicContracts(version)
    const registry = getContractRegistry(version)
    assert.deepEqual(first, second)
    assert.equal(first.schemaRevision, registry.schemaRevision)
    assert.equal(first.apiVersion, version)
    assert.deepEqual(first.operations.map((item) => item.id), registry.operations.map((item) => item.id))
    assert.ok(first.capabilities.every((item) => item.id.startsWith('lan.') && item.id.endsWith('@1')))
    const text = JSON.stringify(first)
    assert.ok(!text.includes(process.cwd()), 'Archive must not reveal the checkout path')
    assert.ok(!text.includes(process.env.HOME || '\u0000'), 'Archive must not reveal the home path')
    assert.doesNotMatch(text, /x-systemx-session|access_token|refresh_token|private-backup/i)
    first.operations[0].id = 'tampered'
    assert.deepEqual(exportPublicContracts(version), second, 'Returned metadata cannot mutate the registry')
  }
  assert.throws(() => exportPublicContracts('2.0'), (error) =>
    error instanceof ApiToolError && error.category === 'incompatible-version')
})

test('contract tools dispatch only explicit local queries and refuse malformed or unavailable requests', () => {
  const beforeRefusals = exportPublicContracts('1.0')
  const { format, formatVersion, capabilities, ...publicRegistry } = exportPublicContracts('1.0')
  assert.equal(format, 'webappx-api-contracts')
  assert.equal(formatVersion, 1)
  assert.ok(capabilities.length > 0)
  assert.deepEqual(dispatchContractTool('contracts.list', {}, '1.0'), publicRegistry)
  const descriptor = dispatchContractTool('contracts.describe', { operation: 'graph.status' }, '1.0')
  assert.equal(descriptor.id, 'graph.status')
  assert.equal(dispatchContractTool('contracts.examples', { operation: 'graph.status' }, '1.0').validRequest.apiVersion, '1.0')
  assert.equal(dispatchContractTool('contracts.compatibility', { beforeVersion: '1.0', afterVersion: '1.1' }, '1.1').beforeVersion, '1.0')
  assert.equal(dispatchContractTool('contracts.export', {}, '1.0').apiVersion, '1.0')
  for (const [operation, payload, version] of [
    ['contracts.compatibility', { beforeVersion: '1.0', afterVersion: '1.1' }, '1.0'],
    ['graph.accept', { digest: 'a'.repeat(64) }, '1.1'],
    ['contracts.list', { write: true }, '1.1'],
    ['contracts.describe', { operation: 'graph.status', version: null }, '1.1'],
  ]) assert.throws(() => dispatchContractTool(operation, payload, version), ApiToolError)
  let invoked = false
  const accessor = Object.defineProperty({}, 'operation', { enumerable: true, get() { invoked = true; return 'graph.status' } })
  assert.throws(() => dispatchContractTool('contracts.describe', accessor), ApiToolError)
  assert.equal(invoked, false, 'No accessor may run during inspection')
  assert.deepEqual(exportPublicContracts('1.0'), beforeRefusals, 'Refusals preserve the last valid public state')
})
