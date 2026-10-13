import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Employees } from '@gusto/embedded-api/sdk/employees'
import { HTTPClient } from '@gusto/embedded-api/lib/http'
import { mockSdkResponse, MOCK_COMPANY_ID } from '../../integrations/gusto/mock-api.mjs'

const path = `/__gusto_mock__/v1/companies/${MOCK_COMPANY_ID}/employees`
const headers = { 'X-Gusto-API-Version': '2026-06-15' }

test('published API client parses the exact SDK mock wire format and pagination', async () => {
  const urls = []
  const httpClient = new HTTPClient({ fetcher: async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    urls.push(url.pathname + url.search)
    const result = mockSdkResponse({ method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers) })
    return new Response(JSON.stringify(result.body), { status: result.status, headers: result.headers })
  } })
  const client = new Employees({ serverURL: 'http://mock.invalid/__gusto_mock__/', httpClient })
  const result = await client.list({ companyId: MOCK_COMPANY_ID, onboardedActive: true, page: 1, per: 5, xGustoAPIVersion: '2026-06-15' })
  assert.equal(result.showEmployees?.[0].firstName, 'Avery')
  assert.equal(result.showEmployees?.[0].companyUuid, MOCK_COMPANY_ID)
  const onboarding = await client.list({ companyId: MOCK_COMPANY_ID, onboardedActive: false, page: 1, per: 5, xGustoAPIVersion: '2026-06-15' })
  const dismissed = await client.list({ companyId: MOCK_COMPANY_ID, terminated: true, page: 1, per: 5, xGustoAPIVersion: '2026-06-15' })
  assert.equal(onboarding.showEmployees?.[0].firstName, 'Jordan')
  assert.equal(dismissed.showEmployees?.[0].firstName, 'Morgan')
  assert.equal(urls.length, 3)
  assert.match(urls[0], /onboarded_active=true/)
})

test('directory tabs distinguish active, onboarding and dismissed synthetic people', () => {
  const active = mockSdkResponse({ url: path + '?onboarded_active=true', headers })
  const onboarding = mockSdkResponse({ url: path + '?onboarded_active=false', headers })
  const dismissed = mockSdkResponse({ url: path + '?terminated=true', headers })
  assert.equal(active.body[0].first_name, 'Avery')
  assert.equal(onboarding.body[0].first_name, 'Jordan')
  assert.equal(dismissed.body[0].first_name, 'Morgan')
  assert.equal(active.headers['x-total-count'], '1')
  assert.deepEqual(mockSdkResponse({ url: path + '?page=2&per=1', headers }).body, [])
})

test('mock refuses credentials, writes, foreign identities, unknown endpoints and incompatible versions', () => {
  assert.equal(mockSdkResponse({ url: path, headers: { ...headers, Authorization: 'fixture-not-a-token' } }).status, 400)
  assert.equal(mockSdkResponse({ method: 'DELETE', url: path, headers }).status, 403)
  assert.equal(mockSdkResponse({ url: path.replace(MOCK_COMPANY_ID, 'foreign-company'), headers }).status, 501)
  assert.equal(mockSdkResponse({ url: '/__gusto_mock__/v1/payrolls/submit', headers }).status, 501)
  assert.equal(mockSdkResponse({ url: path, headers: {} }).status, 400)
  assert.equal(mockSdkResponse({ url: path + '?per=1000', headers }).status, 422)
})
