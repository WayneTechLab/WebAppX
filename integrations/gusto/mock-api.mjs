import { readFileSync } from 'node:fs'

export const MOCK_COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const apiVersion = '2026-06-15'
const fixture = JSON.parse(readFileSync(new URL('./sdk-employees.fixture.json', import.meta.url), 'utf8'))

// This adapter never forwards requests. Coverage is the SDK employee directory only.
export function mockSdkResponse({ method = 'GET', url, headers = {} }) {
  const response = (status, body, extra = {}) => ({ status, body, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Gusto-API-Version': apiVersion, ...extra,
  } })
  const error = (status, code, message) => response(status, { errors: [{ category: code, message }] })
  if (Object.keys(headers).some(key => key.toLowerCase() === 'authorization')) {
    return error(400, 'mock_credentials_refused', 'The synthetic SDK preview does not accept credentials.')
  }
  if (method !== 'GET') return error(403, 'mock_write_denied', 'This SDK preview supports directory reads only.')
  const parsed = new URL(url, 'http://mock.invalid')
  if (parsed.pathname !== `/__gusto_mock__/v1/companies/${MOCK_COMPANY_ID}/employees`) {
    return error(501, 'mock_endpoint_not_implemented', 'This endpoint is outside the tested SDK directory contract.')
  }
  const version = Object.entries(headers).find(([key]) => key.toLowerCase() === 'x-gusto-api-version')?.[1]
  if (version !== apiVersion) return error(400, 'api_version_mismatch', `Use the pinned API version ${apiVersion}.`)
  if ([...parsed.searchParams.keys()].some(key => !['onboarded_active', 'terminated', 'page', 'per'].includes(key))) {
    return error(501, 'mock_query_not_implemented', 'This query is outside the tested SDK directory contract.')
  }
  const page = Number(parsed.searchParams.get('page') ?? 1)
  const per = Number(parsed.searchParams.get('per') ?? 5)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(per) || per < 1 || per > 100) {
    return error(422, 'invalid_pagination', 'Page and page size must be positive bounded integers.')
  }
  const terminated = parsed.searchParams.get('terminated') === 'true'
  const onboarding = parsed.searchParams.get('onboarded_active') === 'false'
  const rows = fixture.filter(employee => terminated ? employee.terminated :
    onboarding ? !employee.onboarded && !employee.terminated : employee.onboarded && !employee.terminated)
  return response(200, rows.slice((page - 1) * per, page * per), {
    'x-total-pages': String(Math.max(1, Math.ceil(rows.length / per))),
    'x-total-count': String(rows.length),
  })
}

export function gustoMockPlugin() {
  return {
    name: 'webappx-gusto-synthetic-directory',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/__gusto_mock__/')) return next()
        const result = mockSdkResponse({ method: request.method, url: request.url, headers: request.headers })
        response.writeHead(result.status, result.headers)
        response.end(JSON.stringify(result.body))
      })
    },
  }
}
