// A URL never selects an input twice. POST targets are carried in the body.
// Dashboard and static asset query strings do not participate in API dispatch.
const readFields = new Map([
  ['/api/status', ['workScope', 'project']],
  ['/api/fonts/catalog', ['q', 'category']],
  ['/api/fonts/project', ['path']],
  ['/api/builder/source', ['path']],
  ['/api/builder/source/inventory', ['extension', 'search', 'limit']],
  ['/api/builder/source/policy', ['compare', 'selection']],
  ['/api/builder/source/history', ['path', 'limit']],
  ['/api/identity/document', ['documentId']],
  ['/api/contracts/discovery', ['clientVersion']],
])

export function acceptsRequestQuery(method, url) {
  if (!url.pathname.startsWith('/api/') || url.searchParams.size === 0) return true
  const allowed = method === 'GET' && readFields.get(url.pathname)
  if (!allowed || url.searchParams.size > allowed.length) return false
  const seen = new Set()
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || seen.has(key)) return false
    seen.add(key)
  }
  return true
}

const readErrors = new Map([
  ['/api/fonts/catalog', ['FONT_QUERY_INVALID', 'Supply each font catalog filter once.']],
  ['/api/fonts/project', ['FONT_QUERY_INVALID', 'Supply a single project stylesheet path.']],
  ['/api/builder/source', ['SOURCE_QUERY_INVALID', 'Choose one canonical repository-relative source path.']],
  ['/api/builder/source/inventory', ['SOURCE_QUERY_INVALID', 'Use unique supported source inventory filters and a limit from 1 through 500.']],
  ['/api/builder/source/policy', ['SOURCE_QUERY_INVALID', 'Choose one reviewed policy comparison and an optional repository-relative selection.']],
  ['/api/builder/source/history', ['SOURCE_HISTORY_QUERY_INVALID', 'Choose one allowlisted source path and an optional history limit from 1 through 100.']],
  ['/api/identity/document', ['IDENTITY_QUERY_INVALID', 'Choose one qualified document identifier.']],
  ['/api/identity/status', ['IDENTITY_QUERY_INVALID', 'Status does not accept query parameters.']],
])

export function invalidQueryResponse(method, pathname) {
  if (pathname.startsWith('/api/transport/')) return { error: 'Transport inspection endpoints accept no query parameters.' }
  if (method === 'POST' && pathname.startsWith('/api/identity/')) {
    return { code: 'IDENTITY_QUERY_INVALID', error: 'Identity operations use a bounded JSON body without query parameters.' }
  }
  const readError = method === 'GET' ? readErrors.get(pathname) : undefined
  const [code, error] = readError ?? ['QUERY_INVALID', 'Use only declared URL parameters once each.']
  return { code, error }
}
