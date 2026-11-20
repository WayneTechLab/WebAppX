import { API_VERSION, SUPPORTED_API_VERSIONS } from './api-contracts.mjs'

const read = ['GET']
const write = ['POST']
const readWrite = ['GET', 'POST']
const asset = ['GET', 'HEAD']
const routes = new Map([
  ['/api/health', read],
  ['/api/status', read],
  ['/api/transport/diagnostics', read],
  ['/api/transport/limits', read],
  ['/api/transport/policy', read],
  ['/api/tools', read],
  ['/api/auth/providers', read],
  ['/api/fonts/catalog', read],
  ['/api/fonts/project', read],
  ['/api/builder/workspace', read],
  ['/api/builder/data', read],
  ['/api/builder/components', read],
  ['/api/builder/components/export', read],
  ['/api/builder/source/inventory', read],
  ['/api/builder/source/policy', read],
  ['/api/builder/source/history', read],
  ['/api/builder/source', readWrite],
  ['/api/builder/font', write],
  ['/api/builder/page', write],
  ['/api/builder/component', write],
  ['/api/builder/ingest', write],
  ['/api/builder/record', write],
  ['/api/builder/preview', write],
  ['/api/graph/commands', write],
  ['/api/contracts/discovery', read],
  ['/api/contracts/query', write],
  ['/api/contracts/command', write],
  ['/api/identity/status', read],
  ['/api/identity/document', read],
  ['/api/identity/preview', write],
  ['/api/identity/accept', write],
  ['/api/identity/lookup', write],
  ['/api/identity/inspect', write],
  ['/api/identity/export', write],
  ['/api/identity/reopen', write],
  ['/api/identity/ownership/preview', write],
  ['/api/identity/ownership/accept', write],
  ['/api/identity/operation', write],
  ['/', asset],
  ['/Website_Dashboard.html', asset],
])

// Accept the browser JSON clients' representation and optional UTF-8 parameter.
// headersDistinct supplies an array so repeated field lines can be distinguished.
function acceptsJson(contentType) {
  if (Array.isArray(contentType)) {
    if (contentType.length !== 1) return false
    contentType = contentType[0]
  }
  return typeof contentType === 'string'
    && /^[ \t]*application\/json(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?[ \t]*$/i.test(contentType)
}

function graphRefusal(code, category, message, envelope) {
  const apiVersion = SUPPORTED_API_VERSIONS.includes(envelope?.apiVersion) ? envelope.apiVersion : API_VERSION
  const requestId = typeof envelope?.requestId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(envelope.requestId)
    ? envelope.requestId : null
  return { apiVersion, requestId, ok: false, error: { category, code, message, findings: [], omittedCount: 0 } }
}

/**
 * Evaluate the parsed URL pathname after authority checks and before dispatch.
 * A null result admits the request to the existing route/body/domain validators.
 * For a wrong-route JSON graph POST only, the server may supply its bounded
 * parsed contractEnvelope to retain the original response version and requestId.
 */
export function evaluateRequestPolicy({ pathname, method, contentType, contractEnvelope }) {
  const methods = routes.get(pathname) ?? (pathname.startsWith('/Website/') ? asset : undefined)
  const graph = pathname.startsWith('/api/contracts/')
  const identity = pathname.startsWith('/api/identity/')

  if (!methods && !graph && !identity) {
    return { statusCode: 404, result: { code: 'ROUTE_NOT_FOUND', error: 'Local route not found.' } }
  }

  if (!methods?.includes(method)) {
    let result = { code: 'METHOD_NOT_ALLOWED', error: 'Use a declared method for this local route.' }
    if (identity) result = { code: 'IDENTITY_ROUTE_UNAVAILABLE', error: 'Choose a supported identity operation and method.' }
    if (graph) result = graphRefusal('GRAPH_ROUTE_UNAVAILABLE', 'capability', 'The requested contract operation could not be completed.', contractEnvelope)

    const refusal = { statusCode: 405, allow: methods?.join(', ') ?? '', result }
    if (graph && method === 'POST' && acceptsJson(contentType) && contractEnvelope === undefined) refusal.readContractEnvelope = true
    return refusal
  }

  if (method === 'POST' && !acceptsJson(contentType)) {
    const message = 'Send JSON with Content-Type application/json using UTF-8.'
    const result = graph ? graphRefusal('API_MEDIA_TYPE_UNSUPPORTED', 'validation', message)
      : { code: identity ? 'IDENTITY_MEDIA_TYPE_UNSUPPORTED' : 'MEDIA_TYPE_UNSUPPORTED', error: message }
    return { statusCode: 415, result }
  }

  return null
}
