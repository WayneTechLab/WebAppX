import { GraphError } from './graph-core.mjs'
import { API_VERSION, SUPPORTED_API_VERSIONS, discoveryForClient } from './api-contracts.mjs'
import { validateApiRequest, validateApiResponse, apiErrorResult } from './api-validation.mjs'
import { dispatchContractTool } from './api-tools.mjs'

const QUERY_OPERATIONS = new Set([
  'graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export',
  'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
])
const COMMAND_OPERATIONS = new Set([
  'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply',
])
const CONTRACT_TOOLS = new Set([
  'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
])
const REQUEST_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

function refuse(code, message, category = 'validation', statusCode = 400) {
  throw new GraphError(code, message, { category, statusCode })
}
function safeField(body, key) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const descriptor = Object.getOwnPropertyDescriptor(body, key)
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null
}
function safeRequestId(body) {
  const id = safeField(body, 'requestId')
  return typeof id === 'string' && REQUEST_ID.test(id) ? id : null
}
function safeVersion(body) {
  const version = safeField(body, 'apiVersion')
  return typeof version === 'string' && SUPPORTED_API_VERSIONS.includes(version) ? version : API_VERSION
}

async function graphHandler(service, operation, payload, envelope) {
  // Deliberately enumerate every supported domain method. An operation string
  // from a request never indexes the service object or invokes a server method.
  switch (operation) {
    case 'graph.status': return service.status()
    case 'graph.document': return service.read(payload)
    case 'graph.findings': return service.findings(payload)
    case 'graph.lookup': return service.lookup(payload)
    case 'graph.compare': return service.compare(payload)
    case 'graph.export': return service.export(payload)
    case 'graph.preview': return service.preview(payload)
    case 'graph.accept': return service.accept({ digest: payload.digest,
      expectedRevision: envelope.expectedRevision, confirmation: envelope.confirmation })
    case 'graph.reopen': return service.reopen({ document: payload.document,
      expectedRevision: envelope.expectedRevision, confirmation: envelope.confirmation })
    case 'graph.migrationPreview': return service.migrationPreview(payload)
    case 'graph.migrationApply': return service.migrationApply({ digest: payload.digest,
      confirmation: envelope.confirmation })
    default: refuse('GRAPH_OPERATION_UNAVAILABLE', 'Choose a supported graph operation.', 'capability', 404)
  }
}

/**
 * Local contract dispatcher. The host server must complete its session,
 * Host, and Origin guard before calling this function for GET or POST.
 */
export async function dispatchGraphContract({ service, method, url, body, handlerOverrides } = {}) {
  const requestId = safeRequestId(body)
  const responseVersion = safeVersion(body)
  try {
    if (!service || typeof service !== 'object') refuse('GRAPH_SERVICE_UNAVAILABLE', 'Graph service is unavailable.', 'internal', 500)
    const target = url instanceof URL ? url : typeof url === 'string' ? new URL(url, 'http://localhost') : null
    if (!target) refuse('GRAPH_ROUTE_INVALID', 'Choose a supported contract endpoint.')

    if (method === 'GET' && target.pathname === '/api/contracts/discovery') {
      if (body !== undefined && body !== null) refuse('GRAPH_DISCOVERY_BODY_INVALID', 'Discovery uses query parameters only.')
      const parameters = [...target.searchParams]
      if (parameters.length > 1 || parameters.some(([key]) => key !== 'clientVersion')) {
        refuse('GRAPH_DISCOVERY_QUERY_INVALID', 'Discovery accepts only one clientVersion parameter.')
      }
      const clientVersion = parameters.length ? parameters[0][1] : API_VERSION
      if (!clientVersion) refuse('GRAPH_DISCOVERY_QUERY_INVALID', 'Choose an exact client version.')
      const result = await discoveryForClient(clientVersion)
      return { statusCode: 200, result: { apiVersion: API_VERSION, requestId: null, ok: true, result } }
    }

    const kind = target.pathname === '/api/contracts/query' ? 'query'
      : target.pathname === '/api/contracts/command' ? 'command' : null
    if (method !== 'POST' || kind === null) {
      refuse('GRAPH_ROUTE_UNAVAILABLE', 'Choose a supported contract endpoint and method.', 'capability', 405)
    }
    if ([...target.searchParams].length) refuse('GRAPH_QUERY_INVALID', 'Contract operations use a JSON body without query parameters.')

    // Worker 7 validates the exact envelope, payload discriminator, version,
    // capability, confirmation, and expected-revision shape before any lookup.
    const validated = validateApiRequest(body, { kind })
    const { descriptor, envelope, payload } = validated
    const operation = envelope.operation
    if (!descriptor.implemented || !((kind === 'query' ? QUERY_OPERATIONS : COMMAND_OPERATIONS).has(operation))) {
      refuse('GRAPH_OPERATION_UNAVAILABLE', 'The requested contract operation is unavailable.', 'capability', 404)
    }
    let result
    if (handlerOverrides && Object.hasOwn(handlerOverrides, operation)) {
      const override = handlerOverrides[operation]
      if (typeof override !== 'function') refuse('GRAPH_HANDLER_INVALID', 'The injected development handler is invalid.', 'internal', 500)
      result = await override(payload, envelope)
    } else if (CONTRACT_TOOLS.has(operation)) {
      result = await dispatchContractTool(operation, payload, envelope.apiVersion)
    } else result = await graphHandler(service, operation, payload, envelope)

    // A malformed handler result is an internal error, never a fabricated
    // success or a response with partially validated fields.
    const checked = validateApiResponse(descriptor, result, { endpoint: target.pathname })
    return { statusCode: 200, result: { apiVersion: envelope.apiVersion, requestId: envelope.requestId,
      ok: true, result: checked } }
  } catch (error) {
    return apiErrorResult(error, { apiVersion: responseVersion, requestId })
  }
}
