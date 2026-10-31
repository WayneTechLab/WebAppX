import { Buffer } from 'node:buffer';
import {
  API_VERSION,
  SUPPORTED_API_VERSIONS,
  contractLimits,
  getOperationDescriptor,
} from './api-contracts.mjs';

const FINDING_LIMIT = 50;
const BYTE_LIMIT = [
  contractLimits?.bytes,
  contractLimits?.maxBytes,
  contractLimits?.maxRequestBytes,
  contractLimits?.requestBytes,
  contractLimits?.maxPayloadBytes,
].find(value => Number.isSafeInteger(value) && value > 0) ?? 400_000;
const MAX_DEPTH = 64;
const MAX_ENTRIES = 100_000;
const ID_64 = /^[A-Za-z0-9_-]{1,64}$/;
const REVISION = /^[a-f0-9]{64}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const SAFE_PATH = /^\$(?:(?:\.[A-Za-z][A-Za-z0-9_-]{0,95})|(?:\.\*)|(?:\[[0-9]{1,5}\]))*$/;
const CATEGORIES = new Set([
  'validation', 'missing-target', 'conflict', 'capability',
  'confirmation', 'incompatible-version', 'internal',
]);

// The operation allowlist is independent of a registry descriptor's schema. It
// prevents a permissive future schema from accepting hidden query effects.
const PAYLOAD_FIELDS = Object.freeze({
  'graph.status': ['type'],
  'graph.document': ['type', 'documentId', 'revision'],
  'graph.findings': ['type', 'documentId', 'severity', 'objectId', 'referenceType', 'offset', 'limit'],
  'graph.lookup': ['type', 'workspaceId', 'documentId', 'id', 'kind'],
  'graph.compare': ['type', 'documentId', 'beforeRevision', 'afterRevision'],
  'graph.export': ['type', 'documentId'],
  'graph.preview': ['type', 'document', 'identityDocumentId'],
  'graph.accept': ['type', 'digest'],
  'graph.reopen': ['type', 'document'],
  'graph.migrationPreview': ['type', 'document', 'targetVersion'],
  'graph.migrationApply': ['type', 'digest'],
  'contracts.list': ['type'],
  'contracts.describe': ['type', 'operation', 'version'],
  'contracts.examples': ['type', 'operation', 'version'],
  'contracts.compatibility': ['type', 'beforeVersion', 'afterVersion'],
  'contracts.export': ['type'],
});

const REQUIRED_PAYLOAD_FIELDS = Object.freeze({
  'graph.status': [],
  'graph.document': ['documentId'],
  'graph.findings': ['documentId'],
  'graph.lookup': ['workspaceId', 'documentId', 'id', 'kind'],
  'graph.compare': ['documentId', 'beforeRevision', 'afterRevision'],
  'graph.export': ['documentId'],
  'graph.preview': [],
  'graph.accept': ['digest'],
  'graph.reopen': ['document'],
  'graph.migrationPreview': ['document', 'targetVersion'],
  'graph.migrationApply': ['digest'],
  'contracts.list': [],
  'contracts.describe': ['operation'],
  'contracts.examples': ['operation'],
  'contracts.compatibility': ['beforeVersion', 'afterVersion'],
  'contracts.export': [],
});

const CONFIRMATIONS = Object.freeze({
  'graph.accept': 'ACCEPT GRAPH',
  'graph.reopen': 'REOPEN GRAPH',
  'graph.migrationApply': 'MIGRATE GRAPH COPY',
});

const PUBLIC_MESSAGES = Object.freeze({
  INVALID_REQUEST: 'Request does not match the selected contract.',
  INVALID_JSON: 'Request must contain plain JSON data.',
  REQUEST_TOO_LARGE: 'Request exceeds the contract byte limit.',
  REQUEST_TOO_COMPLEX: 'Request exceeds the contract complexity limit.',
  UNSUPPORTED_API_VERSION: `The requested API version is unsupported. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
  OPERATION_UNAVAILABLE: 'Operation is unavailable in the selected API version.',
  RESPONSE_CONTRACT_INVALID: 'The handler result does not match its public contract.',
});

const FINDING_MESSAGES = Object.freeze({
  MAX_BYTES: 'Value exceeds the contract byte limit.',
  MAX_COMPLEXITY: 'Value exceeds the contract complexity limit.',
  INVALID_JSON: 'Value must be plain JSON data.',
  SCHEMA_INVALID: 'The reviewed contract schema is invalid.',
  ONE_OF: 'Value must match exactly one reviewed schema variant.',
  TYPE: 'Value has the wrong type.',
  CONST: 'Value must equal the documented constant.',
  ENUM: 'Value must be one of the documented options.',
  MIN_LENGTH: 'String is shorter than the documented minimum.',
  MAX_LENGTH: 'String is longer than the documented maximum.',
  PATTERN: 'String does not match the documented pattern.',
  MINIMUM: 'Number is below the documented minimum.',
  MAXIMUM: 'Number is above the documented maximum.',
  EXCLUSIVE_MINIMUM: 'Number is below the documented exclusive minimum.',
  EXCLUSIVE_MAXIMUM: 'Number is above the documented exclusive maximum.',
  MIN_ITEMS: 'Array has fewer than the documented minimum items.',
  MAX_ITEMS: 'Array has more than the documented maximum items.',
  REQUIRED: 'Required field is absent.',
  UNKNOWN_FIELD: 'An unrecognized field is present.',
  UNSUPPORTED_VERSION: `Select a supported API version: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
  REQUEST_ID: 'Request ID must be 1 to 64 ASCII letters, digits, underscores, or hyphens.',
  KIND: 'Kind does not match the selected endpoint or operation.',
  OPERATION: 'Operation name is invalid.',
  UNAVAILABLE_OPERATION: 'Operation is unavailable in the selected API version.',
  DISCRIMINATOR: 'Payload type must match its operation.',
  CAPABILITY: 'Capability ID does not match the operation and API version.',
  CONFIRMATION: 'Confirmation does not match the operation.',
  REVISION: 'Expected revision must be null or a 64-character lowercase digest.',
  PAGINATION: 'Pagination must use the documented integer bounds.',
  OMITTED: 'Additional validation finding omitted.',
});

const has = (object, key) => Object.hasOwn(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function finding(path, code, message) {
  return { path, code, message };
}

function collector() {
  const findings = [];
  let omittedCount = 0;
  return {
    findings,
    add(path, code, message) {
      if (findings.length < FINDING_LIMIT) findings.push(finding(path, code, message));
      else omittedCount += 1;
    },
    addOmitted(count) { omittedCount += count; },
    get omittedCount() { return omittedCount; },
    get valid() { return findings.length === 0 && omittedCount === 0; },
  };
}

export class ApiContractError extends Error {
  constructor(code, message, {
    category = 'validation', statusCode = 400, findings = [], omittedCount = 0,
  } = {}) {
    super(message);
    this.name = 'ApiContractError';
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.findings = findings.slice(0, FINDING_LIMIT);
    this.omittedCount = Math.max(0, omittedCount) + Math.max(0, findings.length - FINDING_LIMIT);
  }
}

function boundedCopy(value) {
  const active = new WeakSet();
  const budget = { bytes: 0, entries: 0 };
  const addBytes = bytes => {
    budget.bytes += bytes;
    if (budget.bytes > BYTE_LIMIT) {
      throw new ApiContractError('REQUEST_TOO_LARGE', 'JSON value exceeds the contract byte limit.', {
        findings: [finding('$', 'MAX_BYTES', 'JSON value exceeds the contract byte limit.')],
      });
    }
  };
  const copy = (item, depth) => {
    budget.entries += 1;
    if (budget.entries > MAX_ENTRIES || depth > MAX_DEPTH) {
      throw new ApiContractError('REQUEST_TOO_COMPLEX', 'JSON value exceeds the contract complexity limit.', {
        findings: [finding('$', 'MAX_COMPLEXITY', 'JSON value exceeds the contract complexity limit.')],
      });
    }
    if (item === null) { addBytes(4); return null; }
    if (typeof item === 'string') { addBytes(Buffer.byteLength(JSON.stringify(item), 'utf8')); return item; }
    if (typeof item === 'boolean') { addBytes(item ? 4 : 5); return item; }
    if (typeof item === 'number' && Number.isFinite(item)) {
      addBytes(String(item).length);
      return item;
    }
    if (typeof item !== 'object') {
      throw new ApiContractError('INVALID_JSON', 'The contract value must contain only JSON data.');
    }
    if (active.has(item)) {
      throw new ApiContractError('INVALID_JSON', 'Cyclic contract values are unsupported.');
    }
    const prototype = Object.getPrototypeOf(item);
    if (Array.isArray(item)) {
      if (prototype !== Array.prototype || item.length > MAX_ENTRIES) {
        throw new ApiContractError('INVALID_JSON', 'The contract array is invalid.');
      }
      active.add(item);
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some(key => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)))) {
        throw new ApiContractError('INVALID_JSON', 'The contract array has unsupported properties.');
      }
      const result = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = descriptors[index];
        if (!descriptor || !has(descriptor, 'value') || !descriptor.enumerable) {
          throw new ApiContractError('INVALID_JSON', 'The contract array must be dense data.');
        }
        result.push(copy(descriptor.value, depth + 1));
      }
      active.delete(item);
      addBytes(item.length + 2);
      return result;
    }
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ApiContractError('INVALID_JSON', 'The contract object must be plain JSON data.');
    }
    active.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const keys = Reflect.ownKeys(descriptors);
    const result = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new ApiContractError('INVALID_JSON', 'The contract object has an unsupported property.');
      }
      const descriptor = descriptors[key];
      if (!has(descriptor, 'value') || !descriptor.enumerable) {
        throw new ApiContractError('INVALID_JSON', 'The contract object must contain enumerable data properties.');
      }
      addBytes(Buffer.byteLength(JSON.stringify(key), 'utf8') + 1);
      result[key] = copy(descriptor.value, depth + 1);
    }
    active.delete(item);
    addBytes(keys.length + 2);
    return result;
  };
  try { return copy(value, 0); }
  catch (error) {
    if (error instanceof ApiContractError) throw error;
    throw new ApiContractError('INVALID_JSON', 'The contract value cannot be read as plain JSON.');
  }
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function sameJson(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameJson(item, right[index]));
  }
  if (isObject(left) && isObject(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => has(right, key) && sameJson(left[key], right[key]));
  }
  return false;
}

function inspectSchema(schema, value, path, output, depth = 0) {
  if (!isObject(schema) || depth > MAX_DEPTH) {
    output.add(path, 'SCHEMA_INVALID', 'The reviewed contract schema is invalid.');
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    let matches = 0;
    let closest = null;
    for (const branch of schema.oneOf.slice(0, 32)) {
      const probe = collector();
      inspectSchema(branch, value, path, probe, depth + 1);
      if (probe.valid) matches += 1;
      else if (!closest || probe.findings.length + probe.omittedCount < closest.findings.length + closest.omittedCount) closest = probe;
    }
    if (schema.oneOf.length > 32 || matches !== 1) {
      output.add(path, 'ONE_OF', 'Value must match exactly one reviewed schema variant.');
      if (matches === 0 && closest) {
        for (const item of closest.findings.slice(0, 8)) output.add(item.path, item.code, item.message);
      }
    }
  }
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some(type => matchesType(value, type))) {
    output.add(path, 'TYPE', `Expected ${types.join(' or ')}.`);
    return;
  }
  if (has(schema, 'const') && !sameJson(value, schema.const)) output.add(path, 'CONST', 'Value must equal the documented constant.');
  if (Array.isArray(schema.enum) && !schema.enum.some(item => sameJson(value, item))) {
    output.add(path, 'ENUM', 'Value must be one of the documented options.');
  }
  if (typeof value === 'string') {
    const length = [...value].length;
    if (Number.isInteger(schema.minLength) && length < schema.minLength) output.add(path, 'MIN_LENGTH', `String must have at least ${schema.minLength} characters.`);
    if (Number.isInteger(schema.maxLength) && length > schema.maxLength) output.add(path, 'MAX_LENGTH', `String must have at most ${schema.maxLength} characters.`);
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value)) output.add(path, 'PATTERN', 'String does not match the documented pattern.');
      } catch { output.add(path, 'SCHEMA_INVALID', 'The reviewed contract pattern is invalid.'); }
    }
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) output.add(path, 'MINIMUM', `Number must be at least ${schema.minimum}.`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) output.add(path, 'MAXIMUM', `Number must be at most ${schema.maximum}.`);
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) output.add(path, 'EXCLUSIVE_MINIMUM', 'Number is below the documented exclusive minimum.');
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) output.add(path, 'EXCLUSIVE_MAXIMUM', 'Number is above the documented exclusive maximum.');
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) output.add(path, 'MIN_ITEMS', `Array must contain at least ${schema.minItems} items.`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) output.add(path, 'MAX_ITEMS', `Array must contain at most ${schema.maxItems} items.`);
    if (isObject(schema.items)) value.forEach((item, index) => inspectSchema(schema.items, item, `${path}[${index}]`, output, depth + 1));
  }
  if (isObject(value)) {
    const properties = isObject(schema.properties) ? schema.properties : Object.create(null);
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (typeof key === 'string' && !has(value, key)) output.add(`${path}.${key}`, 'REQUIRED', 'Required field is absent.');
    }
    for (const key of Object.keys(value)) {
      if (has(properties, key)) inspectSchema(properties[key], value[key], `${path}.${key}`, output, depth + 1);
      else if (schema.additionalProperties === false) output.add(`${path}.*`, 'UNKNOWN_FIELD', 'An unrecognized field is present.');
      else if (isObject(schema.additionalProperties)) inspectSchema(schema.additionalProperties, value[key], `${path}.*`, output, depth + 1);
    }
  }
}

/** Validate the reviewed, bounded public JSON Schema subset without echoing values. */
export function validatePublicSchema(schema, value) {
  const output = collector();
  let reviewedSchema;
  try { reviewedSchema = boundedCopy(schema); }
  catch {
    output.add('$', 'SCHEMA_INVALID', 'The reviewed contract schema is invalid.');
    return { valid: false, findings: output.findings, omittedCount: output.omittedCount };
  }
  let copy;
  try { copy = boundedCopy(value); }
  catch (error) {
    if (error instanceof ApiContractError && error.findings.length) {
      for (const item of error.findings) output.add(item.path, item.code, item.message);
      return { valid: false, findings: output.findings, omittedCount: output.omittedCount };
    }
    output.add('$', 'INVALID_JSON', 'Value must be plain, bounded JSON data.');
    return { valid: false, findings: output.findings, omittedCount: output.omittedCount };
  }
  inspectSchema(reviewedSchema, copy, '$', output);
  return { valid: output.valid, findings: output.findings, omittedCount: output.omittedCount };
}

function throwFindings(code, message, output, category = 'validation', statusCode = 400) {
  throw new ApiContractError(code, message, {
    category, statusCode, findings: output.findings, omittedCount: output.omittedCount,
  });
}

/** Validate before service dispatch; return an isolated payload without its discriminator. */
export function validateApiRequest(envelope, { kind } = {}) {
  const input = boundedCopy(envelope);
  const issues = collector();
  if (!isObject(input)) {
    issues.add('$', 'TYPE', 'Request envelope must be an object.');
    throwFindings('INVALID_REQUEST', 'Request envelope is invalid.', issues);
  }
  if (!has(input, 'apiVersion') || typeof input.apiVersion !== 'string') issues.add('$.apiVersion', 'REQUIRED', 'A supported API version is required.');
  if (issues.valid && !SUPPORTED_API_VERSIONS.includes(input.apiVersion)) {
    issues.add('$.apiVersion', 'UNSUPPORTED_VERSION', `Select a supported API version: ${SUPPORTED_API_VERSIONS.join(', ')}.`);
    throwFindings('UNSUPPORTED_API_VERSION', 'The requested API version is unsupported.', issues, 'incompatible-version', 400);
  }
  if (!has(input, 'requestId') || typeof input.requestId !== 'string' || !ID_64.test(input.requestId)) issues.add('$.requestId', 'REQUEST_ID', 'Request ID must be 1 to 64 ASCII letters, digits, underscores, or hyphens.');
  if (input.kind !== 'query' && input.kind !== 'command') issues.add('$.kind', 'KIND', 'Kind must be query or command.');
  if (kind !== undefined && input.kind !== kind) issues.add('$.kind', 'KIND', 'Kind does not match the selected endpoint.');
  if (typeof input.operation !== 'string' || !/^[a-z][A-Za-z0-9.]{1,95}$/.test(input.operation)) issues.add('$.operation', 'OPERATION', 'Operation name is invalid.');
  const command = input.kind === 'command';
  const envelopeFields = new Set(command
    ? ['apiVersion', 'requestId', 'kind', 'operation', 'capabilityId', 'payload', 'confirmation', 'expectedRevision']
    : ['apiVersion', 'requestId', 'kind', 'operation', 'payload']);
  for (const key of Object.keys(input)) if (!envelopeFields.has(key)) issues.add('$.*', 'UNKNOWN_FIELD', 'An unrecognized envelope field is present.');
  if (!isObject(input.payload)) issues.add('$.payload', 'TYPE', 'Payload must be an object.');
  if (!issues.valid) throwFindings('INVALID_REQUEST', 'Request envelope is invalid.', issues);

  const descriptor = getOperationDescriptor(input.operation, input.apiVersion);
  if (!descriptor || !has(PAYLOAD_FIELDS, input.operation)) {
    issues.add('$.operation', 'UNAVAILABLE_OPERATION', 'Operation is unavailable in the selected API version.');
    throwFindings('OPERATION_UNAVAILABLE', 'Operation is unavailable in the selected API version.', issues, 'capability', 404);
  }
  if (!descriptor.implemented) {
    issues.add('$.operation', 'UNAVAILABLE_OPERATION', 'Operation is not implemented in the selected API version.');
    throwFindings('OPERATION_UNAVAILABLE', 'Operation is not implemented in the selected API version.', issues, 'capability', 404);
  }
  if (descriptor.kind !== input.kind) issues.add('$.kind', 'KIND', 'Operation kind does not match the selected payload variant.');

  const allowedPayloadFields = new Set(PAYLOAD_FIELDS[input.operation]);
  for (const key of Object.keys(input.payload)) if (!allowedPayloadFields.has(key)) issues.add('$.payload.*', 'UNKNOWN_FIELD', 'An unrecognized payload field is present.');
  if (input.payload.type !== input.operation) issues.add('$.payload.type', 'DISCRIMINATOR', 'Payload type must match its operation.');
  for (const key of REQUIRED_PAYLOAD_FIELDS[input.operation]) {
    if (!has(input.payload, key)) issues.add(`$.payload.${key}`, 'REQUIRED', 'Required field is absent.');
  }
  if (input.operation === 'graph.document' && has(input.payload, 'revision') && input.payload.revision === null) {
    issues.add('$.payload.revision', 'TYPE', 'An explicit null revision is invalid; omit the field for current.');
  }
  if (input.operation === 'graph.migrationPreview' && has(input.payload, 'targetVersion') && input.payload.targetVersion !== 1) {
    issues.add('$.payload.targetVersion', 'CONST', 'Only target version 1 is supported.');
  }
  if (input.operation === 'graph.findings') {
    if (has(input.payload, 'offset') && (!Number.isInteger(input.payload.offset) || input.payload.offset < 0 || input.payload.offset > 10_000)) {
      issues.add('$.payload.offset', 'PAGINATION', 'Offset must be an integer from 0 through 10000.');
    }
    if (has(input.payload, 'limit') && (!Number.isInteger(input.payload.limit) || input.payload.limit < 1 || input.payload.limit > 50)) {
      issues.add('$.payload.limit', 'PAGINATION', 'Limit must be an integer from 1 through 50.');
    }
  }

  if (command) {
    if (input.capabilityId !== descriptor.capabilityId) issues.add('$.capabilityId', 'CAPABILITY', 'Capability ID does not match the operation and API version.');
    if (typeof input.confirmation !== 'string' || input.confirmation.length > 80) issues.add('$.confirmation', 'CONFIRMATION', 'Confirmation must be a bounded string.');
    else if (has(CONFIRMATIONS, input.operation) && input.confirmation !== CONFIRMATIONS[input.operation]) issues.add('$.confirmation', 'CONFIRMATION', 'Confirmation phrase does not match the operation.');
    else if (!['graph.preview', 'graph.migrationPreview'].includes(input.operation) && input.confirmation.length === 0) issues.add('$.confirmation', 'CONFIRMATION', 'Confirmation cannot be empty for this command.');
    if (!has(input, 'expectedRevision') || (input.expectedRevision !== null && (typeof input.expectedRevision !== 'string' || !REVISION.test(input.expectedRevision)))) {
      issues.add('$.expectedRevision', 'REVISION', 'Expected revision must be null or a 64-character lowercase digest.');
    }
  }
  const schemaPayload = Object.create(null);
  for (const key of Object.keys(input.payload)) if (allowedPayloadFields.has(key)) schemaPayload[key] = input.payload[key];
  const schemaResult = validatePublicSchema(descriptor.inputSchema, schemaPayload);
  for (const item of schemaResult.findings) issues.add(item.path.replace(/^\$/, '$.payload'), item.code, item.message);
  issues.addOmitted(schemaResult.omittedCount);
  if (!issues.valid) {
    const category = command && issues.findings.some(item => item.code === 'CONFIRMATION') ? 'confirmation'
      : command && issues.findings.some(item => item.code === 'CAPABILITY') ? 'capability'
        : 'validation';
    throwFindings('INVALID_REQUEST', 'Request does not match the selected contract.', issues, category);
  }
  if (input.operation === 'graph.preview') {
    const count = Number(has(input.payload, 'document')) + Number(has(input.payload, 'identityDocumentId'));
    if (count !== 1) {
      issues.add('$.payload', 'ONE_OF', 'Provide exactly one document or identity document ID.');
      throwFindings('INVALID_REQUEST', 'Graph preview requires exactly one input.', issues);
    }
  }
  const payload = Object.create(null);
  for (const key of Object.keys(input.payload)) if (key !== 'type') payload[key] = input.payload[key];
  return { descriptor, envelope: input, payload };
}

/** Reject malformed handler success before an HTTP success envelope is sent. */
export function validateApiResponse(descriptor, result, { endpoint } = {}) {
  const reviewedEndpoint = ['/api/contracts/discovery', '/api/contracts/query', '/api/contracts/command'].includes(endpoint)
    ? endpoint : null;
  const mismatch = (findings = [], omittedCount = 0) => {
    const error = new ApiContractError(
      'RESPONSE_CONTRACT_INVALID',
      reviewedEndpoint
        ? `The handler result for ${reviewedEndpoint} does not match its public contract.`
        : 'The handler result does not match its public contract.',
      { category: 'internal', statusCode: 500, findings, omittedCount },
    );
    error.endpoint = reviewedEndpoint;
    return error;
  };
  if (!isObject(descriptor) || !isObject(descriptor.resultSchema)) {
    throw mismatch();
  }
  let copy;
  try { copy = boundedCopy(result); }
  catch {
    throw mismatch();
  }
  const report = validatePublicSchema(descriptor.resultSchema, copy);
  if (!report.valid) {
    throw mismatch(report.findings, report.omittedCount);
  }
  return copy;
}

/** Convert only reviewed typed failures into the public error envelope. */
export function apiErrorResult(error, { apiVersion = API_VERSION, requestId = null } = {}) {
  const typed = error instanceof ApiContractError;
  const foreignCategory = CATEGORIES.has(error?.category) ? error.category : 'internal';
  const category = typed && CATEGORIES.has(error.category) ? error.category : foreignCategory;
  const safeCode = typeof error?.code === 'string' && SAFE_CODE.test(error.code) ? error.code : 'INTERNAL_ERROR';
  const statusCode = category === 'internal' ? 500
    : Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : category === 'missing-target' ? 404 : category === 'conflict' ? 409 : 400;
  const message = has(PUBLIC_MESSAGES, safeCode) ? PUBLIC_MESSAGES[safeCode]
    : category === 'internal' ? 'The contract request could not be completed.'
      : 'The requested contract operation could not be completed.';
  const rawFindings = typed && Array.isArray(error.findings) ? error.findings : [];
  const findings = rawFindings.slice(0, FINDING_LIMIT).map(item => ({
    path: typeof item?.path === 'string' && SAFE_PATH.test(item.path) ? item.path : '$',
    code: typeof item?.code === 'string' && has(FINDING_MESSAGES, item.code) ? item.code : 'INVALID_JSON',
    message: typeof item?.code === 'string' && has(FINDING_MESSAGES, item.code)
      ? FINDING_MESSAGES[item.code] : FINDING_MESSAGES.INVALID_JSON,
  }));
  const omittedCount = typed && Number.isSafeInteger(error.omittedCount) && error.omittedCount >= 0 ? error.omittedCount : 0;
  return {
    statusCode,
    result: {
      apiVersion: typeof apiVersion === 'string' && /^[0-9]+(?:\.[0-9]+){1,2}$/.test(apiVersion) && apiVersion.length <= 32 ? apiVersion : API_VERSION,
      requestId: typeof requestId === 'string' && ID_64.test(requestId) ? requestId : null,
      ok: false,
      error: { category, code: category === 'internal' && !typed ? 'INTERNAL_ERROR' : safeCode, message, findings, omittedCount },
    },
  };
}
