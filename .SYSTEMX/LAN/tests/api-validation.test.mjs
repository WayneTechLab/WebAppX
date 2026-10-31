import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiContractError,
  apiErrorResult,
  validateApiRequest,
  validateApiResponse,
  validatePublicSchema,
} from '../Builder/api-validation.mjs';
import { getOperationDescriptor } from '../Builder/api-contracts.mjs';

const query = (operation = 'graph.status', apiVersion = '1.1') => ({
  apiVersion, requestId: 'request_1', kind: 'query', operation,
  payload: { type: operation },
});

function command(operation = 'graph.preview') {
  return {
    apiVersion: '1.1', requestId: 'request_2', kind: 'command', operation,
    capabilityId: getOperationDescriptor(operation, '1.1').capabilityId,
    payload: { type: operation, identityDocumentId: 'Document1' },
    confirmation: '', expectedRevision: null,
  };
}

function rejectRequest(value, options, category = 'validation') {
  assert.throws(() => validateApiRequest(value, options), error => {
    assert.ok(error instanceof ApiContractError);
    assert.equal(error.category, category);
    assert.ok(error.findings.length > 0);
    assert.ok(error.findings.length <= 50);
    assert.ok(Number.isInteger(error.omittedCount));
    return true;
  });
}

test('validated query is isolated, versioned, and has no payload discriminator at dispatch', () => {
  for (const apiVersion of ['1.0', '1.1']) {
    const request = query('graph.status', apiVersion);
    const checked = validateApiRequest(request, { kind: 'query' });
    assert.equal(checked.descriptor.kind, 'query');
    assert.deepEqual({ ...checked.payload }, {});
    assert.equal(checked.envelope.payload.type, 'graph.status');
    request.payload.type = 'graph.accept';
    assert.equal(checked.envelope.payload.type, 'graph.status');
  }
});

test('unsupported versions, unavailable older operations, and endpoint mismatches refuse', () => {
  const unsupported = query('graph.status', '2.0');
  rejectRequest(unsupported, { kind: 'query' }, 'incompatible-version');
  try { validateApiRequest(unsupported, { kind: 'query' }); }
  catch (error) {
    const response = apiErrorResult(error, { apiVersion: unsupported.apiVersion, requestId: unsupported.requestId });
    assert.match(response.result.error.message, /1\.0/);
    assert.match(response.result.error.message, /1\.1/);
  }
  rejectRequest(query('graph.findings', '1.0'), { kind: 'query' }, 'capability');
  rejectRequest(query(), { kind: 'command' });
});

test('query mutation flags and mismatched command variants refuse before dispatch', () => {
  rejectRequest({ ...query(), effect: 'write' }, { kind: 'query' });
  rejectRequest({ ...query(), payload: { type: 'graph.status', confirmation: 'ACCEPT GRAPH' } }, { kind: 'query' });
  const wrongVariant = command();
  wrongVariant.payload = { type: 'graph.accept', digest: 'a'.repeat(64) };
  rejectRequest(wrongVariant, { kind: 'command' });
  const wrongCapability = command();
  wrongCapability.capabilityId = 'lan.graph.accept@1';
  rejectRequest(wrongCapability, { kind: 'command' }, 'capability');
});

test('command precondition and confirmation are explicit; preview has exactly one input', () => {
  const valid = command();
  assert.deepEqual({ ...validateApiRequest(valid, { kind: 'command' }).payload }, { identityDocumentId: 'Document1' });
  const absentRevision = command();
  delete absentRevision.expectedRevision;
  rejectRequest(absentRevision, { kind: 'command' });
  const emptyRevision = command();
  emptyRevision.expectedRevision = '';
  rejectRequest(emptyRevision, { kind: 'command' });
  const twoInputs = command();
  twoInputs.payload.document = {};
  rejectRequest(twoInputs, { kind: 'command' });
  const absentInput = command();
  delete absentInput.payload.identityDocumentId;
  rejectRequest(absentInput, { kind: 'command' });
});

test('nullable and absent fields have distinct validation results', () => {
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['requiredNull'],
    properties: {
      requiredNull: { type: ['string', 'null'] },
      optionalString: { type: 'string' },
    },
  };
  assert.equal(validatePublicSchema(schema, { requiredNull: null }).valid, true);
  assert.equal(validatePublicSchema(schema, { requiredNull: 'yes' }).valid, true);
  assert.equal(validatePublicSchema(schema, { optionalString: 'yes' }).valid, false);
  assert.equal(validatePublicSchema(schema, { requiredNull: null, optionalString: null }).valid, false);
});

test('absent current revision differs from an explicit null graph revision', () => {
  const request = query('graph.document');
  request.payload.documentId = 'Document1';
  assert.equal(validateApiRequest(request, { kind: 'query' }).payload.revision, undefined);
  request.payload.revision = null;
  rejectRequest(request, { kind: 'query' });
});

test('pagination rejects strings and out-of-range values without coercion', () => {
  const request = query('graph.findings');
  request.payload.documentId = 'Document1';
  request.payload.offset = '1';
  request.payload.limit = 51;
  rejectRequest(request, { kind: 'query' });
});

test('diagnostics are bounded, counted, field-oriented, and never echo input values', () => {
  const schema = { type: 'object', properties: {}, additionalProperties: false };
  const value = Object.fromEntries(Array.from({ length: 91 }, (_, index) => [`private_${index}`, 'secret-value']));
  const result = validatePublicSchema(schema, value);
  assert.equal(result.valid, false);
  assert.equal(result.findings.length, 50);
  assert.equal(result.omittedCount, 41);
  assert.ok(result.findings.every(item => item.path === '$.*'));
  assert.ok(!JSON.stringify(result).includes('secret-value'));
  assert.ok(!JSON.stringify(result).includes('private_'));
});

test('schema checks numeric, boolean, string, array, and exact oneOf constraints', () => {
  const schema = {
    oneOf: [{ type: 'integer', minimum: 0, maximum: 10 }, { type: 'string', pattern: '^[A-Z]+$', minLength: 2 }],
  };
  assert.equal(validatePublicSchema(schema, 5).valid, true);
  assert.equal(validatePublicSchema(schema, 'AB').valid, true);
  assert.equal(validatePublicSchema(schema, 11).valid, false);
  assert.equal(validatePublicSchema(schema, 'a').valid, false);
  assert.equal(validatePublicSchema({ type: 'boolean' }, 1).valid, false);
  assert.equal(validatePublicSchema({ type: 'array', minItems: 1, maxItems: 2, items: { type: 'integer' } }, [1, '2']).valid, false);
  assert.equal(validatePublicSchema({ oneOf: [{ type: 'number' }, { type: 'integer' }] }, 1).valid, false);
});

test('malformed success is an internal typed error; returned success is copied', () => {
  const descriptor = {
    resultSchema: {
      type: 'object', additionalProperties: false,
      required: ['count', 'ok'],
      properties: { count: { type: 'integer', minimum: 0 }, ok: { type: 'boolean' } },
    },
  };
  const result = { count: 1, ok: true };
  const checked = validateApiResponse(descriptor, result);
  result.count = -1;
  assert.equal(checked.count, 1);
  assert.throws(() => validateApiResponse(descriptor, { count: '1', ok: true }, { endpoint: '/api/contracts/query' }), error => {
    assert.equal(error.code, 'RESPONSE_CONTRACT_INVALID');
    assert.equal(error.category, 'internal');
    assert.equal(error.statusCode, 500);
    assert.equal(error.endpoint, '/api/contracts/query');
    assert.ok(error.findings.some(item => item.path === '$.count'));
    return true;
  });
});

test('typed error envelope retains request identity and contains unexpected failures', () => {
  const typed = new ApiContractError('INVALID_REQUEST', 'Request is invalid.', {
    findings: [{ path: '$.payload.id', code: 'TYPE', message: 'Expected string.' }],
  });
  const response = apiErrorResult(typed, { apiVersion: '1.0', requestId: 'request_9' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.result.apiVersion, '1.0');
  assert.equal(response.result.requestId, 'request_9');
  assert.equal(response.result.ok, false);
  assert.equal(response.result.error.category, 'validation');
  const unknown = apiErrorResult(new Error('/private/path token secret'), { requestId: 'request_9' });
  assert.equal(unknown.statusCode, 500);
  assert.equal(unknown.result.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(unknown).includes('/private/path'));
  const maliciousTyped = apiErrorResult(new ApiContractError('INVALID_REQUEST', '/private/path token secret', {
    findings: [{ path: '/private/path', code: 'TYPE', message: 'token secret' }],
  }));
  assert.ok(!JSON.stringify(maliciousTyped).includes('/private/path'));
  assert.ok(!JSON.stringify(maliciousTyped).includes('token secret'));
});

test('non-JSON accessors and prototype keys refuse without invoking handlers', () => {
  let invoked = false;
  const accessor = query();
  Object.defineProperty(accessor.payload, 'hidden', { enumerable: true, get() { invoked = true; return 'x'; } });
  rejectRequest(accessor, { kind: 'query' });
  assert.equal(invoked, false);
  const poisoned = JSON.parse('{"type":"graph.status","__proto__":{"polluted":true}}');
  rejectRequest({ ...query(), payload: poisoned }, { kind: 'query' });
  assert.equal({}.polluted, undefined);
});
