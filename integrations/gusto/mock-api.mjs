import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createOnboardingState, handleOnboarding } from './sdk-onboarding.mjs'
import { handlePayroll } from './sdk-payroll.mjs'

export const MOCK_COMPANY_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000102'
export const MOCK_PAYROLL_ID = '00000000-0000-4000-8000-000000000301'
export const MOCK_SESSION_HEADER = 'X-Systemx-Gusto-Mock-Session'
const apiVersion = '2026-06-15'
const fixture = JSON.parse(readFileSync(new URL('./sdk-employees.fixture.json', import.meta.url), 'utf8'))
const payrollFixture = JSON.parse(readFileSync(new URL('./sdk-payroll.fixture.json', import.meta.url), 'utf8'))
const BODY_LIMIT = 32768
const SESSION_TTL = 3600000
const MAX_SESSIONS = 128

function initialState() {
  const employees = structuredClone(fixture)
  employees[0] = { ...employees[0], ...structuredClone(payrollFixture.employeeRoster[0]) }
  return {
    companyId: MOCK_COMPANY_ID, employees, nextId: 1000,
    ...createOnboardingState(employees, MOCK_COMPANY_ID),
    payrollFixture: structuredClone(payrollFixture), payroll: structuredClone(payrollFixture.payroll),
    payrollPhase: 'draft', payrollRevision: 1, payrollReviewed: false, lastCalculated: null, receipt: null,
  }
}

function containsCredentials(value, depth = 0) {
  if (depth > 12) return true
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.length > 100 || value.some(item => containsCredentials(item, depth + 1))
  return Object.entries(value).some(([key, item]) => /^(authorization|client_secret|access_token|refresh_token|id_token|api_key|password|__proto__|constructor|prototype)$/i.test(key) || containsCredentials(item, depth + 1))
}

export function createMockSdk({ now = () => Date.now(), maxSessions = MAX_SESSIONS, sessionTtl = SESSION_TTL } = {}) {
  const sessions = new Map()
  const respond = (status, body, extra = {}) => ({ status, body: body == null ? body : structuredClone(body), headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Gusto-API-Version': apiVersion, 'X-Systemx-Mock': 'true', ...extra,
  } })
  const error = (status, code, message) => respond(status, { errors: [{ error_key: 'base', category: code, message }] })
  function dispatch({ method = 'GET', url, headers = {}, body }) {
    const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
    if (Object.keys(normalized).some(key => /^(authorization|proxy-authorization|cookie|x-api-key|x-gusto-client-secret|x-gusto-access-token|x-gusto-refresh-token)$/i.test(key)
      && !(key === 'cookie' && normalized[key] === ''))) return error(400, 'mock_credentials_refused', 'The synthetic SDK preview does not accept credentials.')
    if (!['GET', 'POST', 'PUT'].includes(method)) return error(403, 'mock_write_denied', 'This synthetic preview supports only explicitly implemented methods.')
    if (typeof url !== 'string' || url.length > 2048 || !url.startsWith('/__gusto_mock__/') || /[%\\\s#]/.test(url.split('?')[0])) return error(400, 'mock_invalid_path', 'Use a canonical local synthetic API path.')
    if (url.split('?')[0].split('/').slice(1).some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return error(400, 'mock_invalid_path', 'Use a canonical synthetic resource path.')
    const parsed = new URL(url, 'http://mock.invalid'), path = parsed.pathname.slice('/__gusto_mock__'.length), query = parsed.searchParams
    if (path.split('/').slice(1).some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return error(400, 'mock_invalid_path', 'Use a canonical synthetic resource path.')
    if (normalized['x-gusto-api-version'] !== apiVersion && !(path === '/__session' && normalized['x-gusto-api-version'] == null)) return error(400, 'api_version_mismatch', `Use the pinned API version ${apiVersion}.`)
    let data = body
    if (body != null) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        if (Buffer.byteLength(body) > BODY_LIMIT) return error(413, 'mock_body_too_large', 'The synthetic request body is too large.')
        try { data = JSON.parse(body.toString()) } catch { return error(400, 'mock_invalid_json', 'Use a JSON request body.') }
      } else {
        try { if (Buffer.byteLength(JSON.stringify(body)) > BODY_LIMIT) return error(413, 'mock_body_too_large', 'The synthetic request body is too large.') } catch { return error(400, 'mock_invalid_json', 'Use a JSON request body.') }
      }
      if (data == null || typeof data !== 'object' || Array.isArray(data)) return error(422, 'invalid_attribute_value', 'Use an object request body.')
      if (containsCredentials(data)) return error(400, 'mock_credentials_refused', 'Credentials and unsafe object fields are refused.')
      if (method === 'GET') return error(400, 'mock_body_denied', 'Synthetic reads do not accept a body.')
    }
    const allowedQueries = ['onboarded_active', 'terminated', 'page', 'per', 'payroll_uuid', 'uuids', 'sort_by', 'include', 'all_compensations', 'employeeId']
    for (const key of query.keys()) if (!allowedQueries.includes(key) || query.getAll(key).length > 1 || query.get(key).length > 512) return error(501, 'mock_query_not_implemented', 'This query is outside the tested synthetic contract.')
    const page = Number(query.get('page') ?? 1), per = Number(query.get('per') ?? 5)
    if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(per) || per < 1 || per > 100) return error(422, 'invalid_pagination', 'Page and page size must be positive bounded integers.')
    for (const key of ['onboarded_active', 'terminated', 'all_compensations']) if (query.has(key) && !['true', 'false'].includes(query.get(key))) return error(422, 'invalid_attribute_value', 'Use boolean query values.')
    if (query.has('sort_by') && !['name', 'last_name', 'first_name', 'last_name:asc', 'last_name:desc'].includes(query.get('sort_by'))) return error(422, 'invalid_attribute_value', 'Unsupported synthetic sort order.')
    if (query.has('include') && query.get('include').split(',').some(value => !['taxes', 'benefits', 'deductions', 'totals', 'payroll_taxes', 'payroll_status_meta', 'all_compensations'].includes(value))) return error(422, 'invalid_attribute_value', 'Unsupported synthetic resource expansion.')
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id)
    if (path === '/__session') {
      if (method !== 'POST' || query.size || data && Object.keys(data).length) return error(422, 'invalid_attribute_value', 'Create a synthetic session with an empty POST.')
      if (sessions.size >= maxSessions) return respond(429, { errors: [{ error_key: 'base', category: 'mock_capacity', message: 'The local synthetic session limit is reached.' }] }, { 'Retry-After': '1' })
      const sessionId = randomBytes(16).toString('hex')
      sessions.set(sessionId, { state: initialState(), expiresAt: now() + sessionTtl })
      return respond(201, { sessionId, mode: 'mock', expiresInSeconds: Math.floor(sessionTtl / 1000) })
    }
    const sessionId = normalized[MOCK_SESSION_HEADER.toLowerCase()]
    const session = typeof sessionId === 'string' && /^[0-9a-f]{32}$/.test(sessionId) ? sessions.get(sessionId) : null
    const directoryPath = `/v1/companies/${MOCK_COMPANY_ID}/employees`
    if (!session && sessionId != null) return error(403, 'mock_session_invalid', 'Create a new server issued synthetic session.')
    // The historical directory reads stay stateless. Every new workflow needs an issued session.
    if (!session && !(method === 'GET' && path === directoryPath)) {
      const workflowPath = /^\/__(reset|state|onboarding_review)$/.test(path) || path === `/v1/payrolls/${MOCK_PAYROLL_ID}/receipt` || path.startsWith(`/v1/companies/${MOCK_COMPANY_ID}/`)
        || /^\/v1\/(employees|jobs|compensations|home_addresses|work_addresses|locations)\//.test(path)
      return workflowPath ? error(403, 'mock_session_required', 'Create a local synthetic session for this workflow.')
        : error(501, 'mock_endpoint_not_implemented', 'This endpoint is outside the tested synthetic SDK journeys.')
    }
    const state = session?.state ?? initialState()
    if (session) session.expiresAt = now() + sessionTtl
    if (path === '/__reset') {
      if (method !== 'POST' || query.size || data && Object.keys(data).length) return error(422, 'invalid_attribute_value', 'Reset only this session with an empty POST.')
      session.state = initialState(); return respond(200, { mode: 'mock', reset: true })
    }
    if (path === '/__state' && method === 'GET') return respond(200, { mode: 'mock', payrollPhase: state.payrollPhase, receipt: state.receipt, employees: state.employees.map(employee => ({ uuid: employee.uuid, first_name: employee.first_name, onboarded: employee.onboarded, onboarding_status: employee.onboarding_status })) })
    if (path === directoryPath && method === 'GET') {
      const payrollId = query.get('payroll_uuid')
      if (payrollId != null && payrollId !== MOCK_PAYROLL_ID) return error(404, 'not_found', 'This synthetic payroll does not exist.')
      const uuids = query.has('uuids') ? query.get('uuids').split(',') : null
      if (uuids && (!uuids.length || uuids.length > 100 || uuids.some(id => !state.employees.some(employee => employee.uuid === id)))) return error(404, 'not_found', 'Select only synthetic employees in this session.')
      const terminated = query.get('terminated') === 'true', onboarding = query.get('onboarded_active') === 'false'
      const rows = state.employees.filter(employee => uuids ? uuids.includes(employee.uuid) : payrollId ? state.payroll.employee_compensations.some(row => row.employee_uuid === employee.uuid) : terminated ? employee.terminated : onboarding ? !employee.onboarded && !employee.terminated : employee.onboarded && !employee.terminated)
      return respond(200, rows.slice((page - 1) * per, page * per), { 'x-total-pages': String(Math.max(1, Math.ceil(rows.length / per))), 'x-total-count': String(rows.length) })
    }
    if (path === directoryPath && method !== 'POST') return error(403, 'mock_method_denied', 'Only directory reads and bounded synthetic employee creation are implemented.')
    const context = { method, path, query, body: data, state, respond, error, now, allocateId: () => `00000000-0000-4000-8000-${String(++state.nextId).padStart(12, '0')}` }
    return handlePayroll(context) ?? handleOnboarding(context) ?? error(501, 'mock_endpoint_not_implemented', 'This endpoint is outside the tested synthetic SDK journeys.')
  }
  return { respond: dispatch }
}

const defaultMock = createMockSdk()
export function mockSdkResponse(request) { return defaultMock.respond(request) }

export function gustoMockPlugin() {
  const mock = createMockSdk()
  return {
    name: 'webappx-gusto-synthetic-journeys',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/__gusto_mock__/')) return next()
        const chunks = []; let bytes = 0, rejected = false
        const send = result => { if (response.writableEnded) return; response.writeHead(result.status, result.headers); response.end(result.body == null ? undefined : JSON.stringify(result.body)) }
        request.on('data', chunk => {
          bytes += chunk.length
          if (bytes > BODY_LIMIT) { rejected = true; chunks.length = 0; send({ status: 413, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: { errors: [{ error_key: 'base', category: 'mock_body_too_large', message: 'The synthetic request body is too large.' }] } }); return }
          if (!rejected) chunks.push(chunk)
        })
        request.on('end', () => {
          if (rejected) return
          if (bytes && !/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) { send({ status: 415, headers: { 'Content-Type': 'application/json' }, body: { errors: [{ error_key: 'base', category: 'mock_invalid_content_type', message: 'Use application/json for synthetic writes.' }] } }); return }
          send(mock.respond({ method: request.method, url: request.url, headers: request.headers, body: bytes ? Buffer.concat(chunks) : undefined }))
        })
        request.on('error', () => { if (!response.writableEnded) response.end() })
      })
    },
  }
}
