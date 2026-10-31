import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  API_VERSION, SUPPORTED_API_VERSIONS, contractLimits,
  getContractRegistry, getOperationDescriptor, discoveryForClient,
} from '../Builder/api-contracts.mjs'

const canonical = value => Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']'
  : value !== null && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value)

test('reviewed 1.0 remains executable as its own schema set', t => {
  assert.equal(API_VERSION, '1.1')
  assert.deepEqual(SUPPORTED_API_VERSIONS, ['1.0', '1.1'])
  const older = getContractRegistry('1.0')
  const current = getContractRegistry()
  assert.deepEqual(older.operations.map(d => d.id), [
    'graph.status', 'graph.document', 'graph.preview', 'graph.accept', 'graph.export',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.export',
  ])
  assert.deepEqual(current.operations.map(d => d.id), [
    'graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export',
    'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
  ])
  assert.equal(getOperationDescriptor('graph.findings', '1.0'), null)
  assert.equal(getOperationDescriptor('graph.findings', '1.1')?.implemented, true)
  assert.equal(getOperationDescriptor('graph.preview', '1.0')?.inputSchema.properties.apiVersion.const, '1.0')
  assert.equal(getOperationDescriptor('graph.preview', '1.1')?.inputSchema.properties.apiVersion.const, '1.1')
  assert.notEqual(older.schemaRevision, current.schemaRevision)
  for (const registry of [older, current]) {
    t.diagnostic('apiVersion=' + registry.apiVersion +
      ' schemaRevision=' + registry.schemaRevision +
      ' implementedOperations=' + registry.operations.filter(d => d.implemented).map(d => d.id).join(','))
  }
})

test('schema revisions bind exact fixed public bytes and exclude their own hash', () => {
  for (const version of SUPPORTED_API_VERSIONS) {
    const { schemaRevision, ...publicBytes } = getContractRegistry(version)
    assert.equal(schemaRevision, createHash('sha256').update(canonical(publicBytes)).digest('hex'))
    assert.match(schemaRevision, /^[a-f0-9]{64}$/)
  }
  assert.ok(Object.isFrozen(getContractRegistry().operations[0].inputSchema.properties.payload))
  assert.throws(() => { getContractRegistry().operations.push('mutated') }, TypeError)
})

test('query and command envelopes expose exact discriminated fields before dispatch', () => {
  const requiredDescriptorKeys = [
    'id', 'version', 'kind', 'implemented', 'capabilityId', 'inputSchema', 'resultSchema',
    'effect', 'confirmation', 'revisionPrecondition', 'pagination', 'deprecated', 'examples',
  ]
  for (const version of SUPPORTED_API_VERSIONS) {
    for (const descriptor of getContractRegistry(version).operations) {
      assert.deepEqual(Object.keys(descriptor).sort(), requiredDescriptorKeys.sort())
      assert.equal(descriptor.implemented, true)
      assert.equal(descriptor.capabilityId, 'lan.' + descriptor.id + '@1')
      assert.equal(descriptor.inputSchema.additionalProperties, false)
      assert.deepEqual([...descriptor.inputSchema.required].sort(), Object.keys(descriptor.inputSchema.properties).sort())
      assert.equal(descriptor.inputSchema.properties.kind.const, descriptor.kind)
      assert.equal(descriptor.inputSchema.properties.operation.const, descriptor.id)
      assert.equal(descriptor.inputSchema.properties.apiVersion.const, version)
      if (descriptor.kind === 'command') {
        assert.equal(descriptor.inputSchema.properties.capabilityId.const, descriptor.capabilityId)
        assert.equal(descriptor.inputSchema.properties.expectedRevision.type.includes('null'), true)
        assert.equal(descriptor.revisionPrecondition.required, true)
        assert.equal(descriptor.confirmation.required, true)
      } else {
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'confirmation'), false)
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'expectedRevision'), false)
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'capabilityId'), false)
        assert.equal(descriptor.confirmation, null)
      }
    }
  }
  const preview = getOperationDescriptor('graph.preview')
  assert.equal(preview.inputSchema.properties.payload.oneOf.length, 2)
  assert.deepEqual(preview.inputSchema.properties.payload.oneOf.map(x => x.required), [
    ['type', 'document'], ['type', 'identityDocumentId'],
  ])
  assert.equal(preview.inputSchema.properties.payload.oneOf.every(x => x.additionalProperties === false), true)
  assert.equal(getOperationDescriptor('graph.accept').inputSchema.properties.confirmation.const, 'ACCEPT GRAPH')
  assert.equal(getOperationDescriptor('graph.reopen').inputSchema.properties.confirmation.const, 'REOPEN GRAPH')
  assert.equal(getOperationDescriptor('graph.migrationApply').inputSchema.properties.confirmation.const, 'MIGRATE GRAPH COPY')
})

test('bounded read schemas state nullable, absent, and pagination behavior', () => {
  const document = getOperationDescriptor('graph.document').inputSchema.properties.payload
  assert.deepEqual(document.required, ['type', 'documentId'])
  assert.equal(document.properties.revision.type, 'string')
  assert.equal(document.properties.revision.pattern, '^[a-f0-9]{64}$')
  const findings = getOperationDescriptor('graph.findings')
  assert.deepEqual(findings.pagination, {
    mode: 'offset', defaultOffset: 0, defaultLimit: 20,
    maximumOffset: 10000, maximumLimit: 50,
    totalScope: 'findings in the accepted document',
  })
  assert.equal(findings.inputSchema.properties.payload.properties.offset.type, 'integer')
  assert.equal(findings.inputSchema.properties.payload.properties.limit.minimum, 1)
  assert.equal(findings.inputSchema.properties.payload.properties.limit.maximum, 50)
  assert.equal(findings.resultSchema.properties.total.type, 'integer')
  assert.deepEqual(getOperationDescriptor('graph.status').inputSchema.properties.payload.required, ['type'])
  assert.deepEqual(getOperationDescriptor('graph.accept').inputSchema.properties.expectedRevision.type, ['string', 'null'])
  assert.equal(contractLimits.findings, 50)
})

test('discovery reports supported compatibility, deprecated 1.0, and unavailable effects', () => {
  const older = discoveryForClient('1.0')
  assert.equal(older.apiVersion, '1.1')
  assert.equal(older.compatibleVersion, '1.0')
  assert.equal(older.schemaRevision, getContractRegistry('1.0').schemaRevision)
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.findings' && x.availableSince === '1.1'))
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.sourceWrite'))
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.editStructure'))
  assert.equal(older.deprecated.length, 9)
  assert.equal(older.deprecated[0].replacementVersion, '1.1')
  assert.equal(older.deprecated[0].removalDate, null)
  assert.equal(discoveryForClient('1.1').deprecated.length, 0)
  assert.equal(getOperationDescriptor('graph.sourceWrite'), null)
  assert.equal(getOperationDescriptor('__proto__'), null)
  assert.throws(() => getContractRegistry('2.0'), error => {
    assert.equal(error.code, 'API_VERSION_UNSUPPORTED')
    assert.equal(error.category, 'incompatible-version')
    assert.deepEqual(error.supportedVersions, ['1.0', '1.1'])
    assert.doesNotMatch(error.message, /2\.0/)
    return true
  })
})

test('public registry contains no runtime or private machine value', () => {
  const serialized = JSON.stringify(discoveryForClient('1.0')) + JSON.stringify(discoveryForClient('1.1'))
  assert.doesNotMatch(serialized, /\/Users\/|\/private\/|file:\/\/|localhost|127\.0\.0\.1|firebase|api[_-]?key/i)
  assert.equal(getContractRegistry().scope.sourceWrites, false)
  assert.equal(getContractRegistry().scope.structuralEditing, false)
  for (const descriptor of getContractRegistry().operations) {
    assert.ok(descriptor.resultSchema.properties || descriptor.resultSchema.oneOf)
    assert.notDeepEqual(descriptor.resultSchema, { type: 'object', additionalProperties: true })
  }
})
