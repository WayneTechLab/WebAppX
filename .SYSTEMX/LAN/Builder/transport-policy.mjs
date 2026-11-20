import { contractLimits, API_VERSION, SUPPORTED_API_VERSIONS } from './api-contracts.mjs'
import { evaluateRequestPolicy } from './request-policy.mjs'
import { sourceHistoryLimits } from './source-history.mjs'
import { sourcePolicyLimits } from './source-policy.mjs'

export const fontCatalogRowLimit = 200

export const responseLimits = Object.freeze({
  jsonBytes: 4_000_000,
  legacyAcknowledgementBytes: 256_000,
  nesting: 256,
})

const safePost = new Set([
  '/api/contracts/query', '/api/builder/preview', '/api/identity/lookup',
  '/api/identity/inspect', '/api/identity/export', '/api/identity/operation',
])
const proposalPost = new Set([
  '/api/contracts/command', '/api/identity/preview', '/api/identity/accept',
  '/api/identity/reopen', '/api/identity/ownership/preview', '/api/identity/ownership/accept',
  '/api/builder/source', '/api/builder/font',
])
const receiptStatus = new Map([
  ['/api/builder/record', 'saved-local-record'],
  ['/api/builder/page', 'saved-local-model'],
  ['/api/builder/component', 'saved-local-component'],
  ['/api/builder/ingest', 'inventory-complete'],
])
const policyRoute = '/api/transport/policy'
const recordRoute = '/api/builder/record'

// keyedRecord is true only after the host accepts a UUIDv4 Idempotency-Key for
// this record request. The presence of an arbitrary header grants no replay.
export function getRetryDisposition({ method, pathname = '', keyedRecord = false }) {
  if (method === 'GET' && pathname === policyRoute) return 'read-only'
  if (evaluateRequestPolicy({ method, pathname, contentType: 'application/json' })) return 'not-applicable'
  if (method !== 'POST' || safePost.has(pathname)) return 'read-only'
  if (pathname === recordRoute && keyedRecord === true) return 'idempotent-keyed'
  if (proposalPost.has(pathname)) return 'fresh-proposal'
  return 'reconcile-before-retry'
}

export function getTransportPolicy() {
  return {
    schemaVersion: 1,
    retryHeader: 'X-SystemX-Retry',
    representationHeader: 'X-SystemX-Representation',
    retry: {
      'read-only': { methods: ['Admitted GET or HEAD'], postRoutes: [...safePost], guidance: 'Read again for current state.' },
      'idempotent-keyed': { method: 'POST', route: recordRoute, keyHeader: 'Idempotency-Key', keyFormat: 'UUIDv4',
        retentionHours: 24, maximumLiveKeys: 128, scope: 'local workspace, including server restarts',
        guidance: 'Replay the same key and payload within the retention window. A changed payload conflicts. At capacity, a new key is refused.' },
      'fresh-proposal': { method: 'POST', routes: [...proposalPost],
        guidance: 'Reconcile current state, then obtain a current proposal or revision and review the command again.' },
      'reconcile-before-retry': { method: 'POST', routes: [...receiptStatus.keys()],
        guidance: 'Inspect the current local record, page, component or ingest result before submitting another change. An unkeyed POST has no replay guarantee.' },
      'not-applicable': { guidance: 'Choose a declared route and method.' },
    },
    responses: {
      ...responseLimits, scope: 'JSON HTTP bodies, including the trailing newline and any download indentation',
      representations: {
        complete: 'All JSON bytes for the handler result. A requested page or retained window can be a subset of the collection.',
        refused: 'The full representation exceeded a limit. No partial source, document, or export bytes were delivered.',
        acknowledgement: 'The operation succeeded. Its oversized detail was omitted. Reconcile current state before a further change.',
      },
      legacyAcknowledgements: [...receiptStatus.keys()],
      domainLimits: { graphResultBytes: contractLimits.responseBytes, identityDocumentBytes: 400_000, sourceBytes: sourcePolicyLimits.maxBytes },
      windows: {
        sourceInventory: { maximumRows: sourcePolicyLimits.maxResults, fields: ['complete', 'truncated', 'omitted'] },
        sourceHistory: { maximumEntries: sourceHistoryLimits.entries, fields: ['truncated', 'omittedEntries'] },
        graphFindings: { maximumPageSize: contractLimits.pageSize, fields: ['offset', 'limit', 'total', 'upstreamOmittedCount'] },
        projectIngest: { fields: ['limits.fileScanTruncated', 'limits.windows', 'limits.truncated'], totalScope: 'each window names its scanned or retained input' },
        fontCatalog: { maximumRows: fontCatalogRowLimit, countScope: 'returned rows', totalScope: 'all matching catalog families', fields: ['count', 'total', 'omittedCount', 'truncated'] },
      },
    },
  }
}

const limitReached = Symbol('response-limit')

// JSON.stringify supplies the canonical escaping, omission, array and indentation
// semantics. Account for each token before the native encoder grows the result.
function boundedJson(value, maxBytes, pretty) {
  let remaining = maxBytes - 1 // Trailing newline.
  let isRoot = true
  const containers = new WeakMap()
  function spend(bytes) {
    remaining -= bytes
    if (remaining < 0) throw limitReached
  }
  function spendString(text) {
    if (text.length + 2 > remaining) throw limitReached
    spend(Buffer.byteLength(JSON.stringify(text)))
  }
  const result = JSON.stringify(value, function count(key, item) {
    const parent = isRoot ? null : containers.get(this)
    isRoot = false
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
      if (!Array.isArray(this)) return undefined
      item = null
    }
    const depth = parent ? parent.depth + 1 : 0
    if (depth > responseLimits.nesting) throw limitReached
    if (parent) {
      if (parent.hasEntries) spend(1) // Comma.
      else if (pretty) spend(1 + parent.depth * 2) // Closing newline and indentation.
      if (pretty) spend(1 + depth * 2)
      parent.hasEntries = true
      if (!Array.isArray(this)) {
        spendString(key)
        spend(pretty ? 2 : 1) // Colon, and a space for indented output.
      }
    }
    if (item !== null && typeof item === 'object') {
      spend(2)
      containers.set(item, { depth, hasEntries: false })
    } else if (typeof item === 'string') spendString(item)
    else spend(JSON.stringify(item).length)
    return item
  }, pretty ? 2 : undefined)
  if (typeof result !== 'string') throw new TypeError('Expected a JSON response value.')
  return result + '\n'
}

function smallText(value, maxLength) {
  return typeof value === 'string' && value.length <= maxLength ? value : undefined
}

function acknowledgement(pathname, value) {
  const receipt = { status: receiptStatus.get(pathname), acknowledgement: true, detailOmitted: true }
  if (pathname === '/api/builder/page') {
    receipt.page = { id: smallText(value.page?.id, 256), name: smallText(value.page?.name, 120) }
  } else if (pathname === '/api/builder/component') {
    receipt.component = { id: smallText(value.component?.id, 80), name: smallText(value.component?.name, 120),
      export: { format: 'systemx-component', version: 1 } }
    receipt.linkedNode = value.linkedNode ? { pageId: smallText(value.linkedNode.pageId, 256), nodeId: smallText(value.linkedNode.nodeId, 256) } : null
  } else if (pathname === '/api/builder/ingest') {
    receipt.manifestPath = smallText(value.manifestPath, 1024)
    receipt.summary = { framework: smallText(value.manifest?.project?.framework, 120),
      pageCount: value.manifest?.pages?.length, componentCount: value.manifest?.components?.length }
    if (value.manifest?.limits?.truncated) receipt.summary.truncated = true
  }
  return receipt
}

function rejectedInspection(pathname, value) {
  const code = 'TRANSPORT_RESPONSE_TOO_LARGE'
  const message = 'The full JSON response exceeds the local representation limits. Select a smaller scope when available.'
  if (pathname.startsWith('/api/contracts/')) {
    const apiVersion = SUPPORTED_API_VERSIONS.includes(value?.apiVersion) ? value.apiVersion : API_VERSION
    const requestId = typeof value?.requestId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value.requestId) ? value.requestId : null
    return { apiVersion, requestId, ok: false, error: { category: 'validation', code, message, findings: [], omittedCount: 0 } }
  }
  return { code, error: message, complete: false, maxBytes: responseLimits.jsonBytes, maxDepth: responseLimits.nesting }
}

export function encodeTransportJson({ method, pathname = '', statusCode, value, pretty = false }) {
  const success = statusCode >= 200 && statusCode < 300
  const legacyReceipt = method === 'POST' && success && receiptStatus.get(pathname) === value?.status && receiptStatus.has(pathname)
  const maximum = legacyReceipt ? responseLimits.legacyAcknowledgementBytes : responseLimits.jsonBytes
  try {
    return { statusCode, representation: 'complete', body: boundedJson(value, maximum, pretty) }
  } catch (error) {
    if (error !== limitReached) throw error
  }
  if (legacyReceipt) {
    return { statusCode, representation: 'acknowledgement', body: JSON.stringify(acknowledgement(pathname, value)) + '\n' }
  }
  if (success && method === 'POST' && !safePost.has(pathname)) {
    // Valid graph/identity command results are domain-bounded below the wire
    // cap. If a future handler violates that invariant after a successful
    // command, preserve the success without fabricating a domain envelope.
    return { statusCode: 204, representation: 'acknowledgement', body: '' }
  }
  return { statusCode: success ? 413 : statusCode, representation: 'refused',
    body: JSON.stringify(rejectedInspection(pathname, value)) + '\n' }
}
