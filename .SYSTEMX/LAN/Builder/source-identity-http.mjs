/** Bounded HTTP dispatch for the host's source-identity read model. */
const postMethods = Object.freeze({
  preview: ['preview', ['path', 'route', 'label', 'renameFrom', 'aliases', 'ruleVersion']],
  accept: ['accept', ['digest', 'confirmation']],
  lookup: ['lookup', ['workspaceId', 'documentId', 'nodeId']],
  inspect: ['inspect', ['workspaceId', 'documentId', 'nodeId']],
  export: ['export', ['documentId']],
  reopen: ['reopen', ['document', 'confirmation']],
  'ownership/preview': ['ownershipPreview', ['documentId', 'changes']],
  'ownership/accept': ['ownershipAccept', ['digest', 'confirmation']],
  operation: ['operation', ['documentId', 'reference', 'expectedRevision', 'text']],
})

function invalid(code, message, statusCode = 400) {
  return { statusCode, result: { code, error: message } }
}

export async function dispatchSourceIdentity({ service, method, url, body }) {
  const action = url.pathname.slice('/api/identity/'.length)
  if (method === 'GET' && action === 'status') {
    if ([...url.searchParams].length) return invalid('IDENTITY_QUERY_INVALID', 'Status does not accept query parameters.')
    return { statusCode: 200, result: await service.status() }
  }
  if (method === 'GET' && action === 'document') {
    const query = url.searchParams
    if (query.getAll('documentId').length !== 1 || [...query.keys()].some(key => key !== 'documentId')) {
      return invalid('IDENTITY_QUERY_INVALID', 'Choose one qualified document identifier.')
    }
    body = { documentId: query.get('documentId') }
  } else if (method !== 'POST' || !Object.hasOwn(postMethods, action)) {
    return invalid('IDENTITY_ROUTE_UNAVAILABLE', 'Choose a supported identity operation and method.', 405)
  }
  if (method === 'POST' && [...url.searchParams].length) return invalid('IDENTITY_QUERY_INVALID', 'Identity operations use a bounded JSON body without query parameters.')
  const [operation, keys] = method === 'GET' ? ['read', ['documentId']] : postMethods[action]
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))
    || Buffer.byteLength(JSON.stringify(body), 'utf8') > 400_000) {
    return invalid('IDENTITY_BODY_INVALID', 'Use a bounded identity operation with its declared fields.')
  }
  try {
    return { statusCode: 200, result: await service[operation](body) }
  } catch (error) {
    const code = typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.code) ? error.code : 'IDENTITY_REFUSED'
    const statusCode = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 499 ? error.statusCode
      : /(?:STALE|DRIFT|CONFLICT|MISMATCH)/.test(code) ? 409 : /ENCODING/.test(code) ? 415 : 400
    // Service exceptions never expose source content, session state or host paths.
    const response = invalid(code, 'Identity operation refused. Keep the previous accepted map and review the selected source, revision and proposal.', statusCode)
    if (Array.isArray(error.diagnostics) && error.diagnostics.length <= 1000) {
      response.result.diagnostics = error.diagnostics.filter(item => item && /^[A-Z][A-Z0-9_]{1,63}$/.test(item.code)
        && /^[a-f0-9]{64}$/.test(item.identityDigest) && Number.isInteger(item.count) && item.count >= 2 && item.count <= 1000)
        .map(({ code: diagnosticCode, identityDigest, count }) => ({ code: diagnosticCode, identityDigest, count }))
    }
    return response
  }
}
