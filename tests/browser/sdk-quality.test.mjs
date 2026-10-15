import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAllowedSmokeRequest } from './portals-smoke.mjs'
import { createSdkFailureLedger, isAllowedSdkQualityRequest, sdkInventoryCoverage, sdkStateInventory } from './sdk-quality.mjs'

const origin = 'http://127.0.0.1:5197'

test('SDK companion permits only owned assets and canonical same-origin mock routes; native gate remains unchanged', () => {
  for (const path of ['/hr/demo/sdk', '/src/hr/gusto/GustoSdkPreview.tsx', '/__gusto_mock__/__session', '/__gusto_mock__/v1/employees/fictional-employee/onboarding_status?include=taxes']) {
    assert.equal(isAllowedSdkQualityRequest(origin + path, origin), true, path)
  }
  assert.equal(isAllowedSmokeRequest(origin + '/__gusto_mock__/__session', origin), false)
  for (const url of [
    'https://api.gusto.com/v1/employees', 'https://firestore.googleapis.com/', 'https://example.invalid/__gusto_mock__/__session',
    'http://127.0.0.1:5198/__gusto_mock__/__session', 'http://localhost:5197/__gusto_mock__/__session',
    origin + '/__gusto_mock__', origin + '/__gusto_mock__evil/__session', origin + '/__gusto_mock__//__session',
    origin + '/__gusto_mock__/%2e%2e/__session', origin + '/__gusto_mock__/v1/../__session', origin + '/__gusto_mock__/v1%2femployees',
    origin + '/__gusto_mock__/__session#fragment', origin + '/__gusto_mock__/\\__session',
    origin + '//__gusto_mock__/__session', origin + '//api/gusto',
    origin + '/__systemx/session', origin + '/api/gusto', origin + '/integrations/gusto', origin + '/gusto-mock/session',
    'http://fixture:refused@127.0.0.1:5197/__gusto_mock__/__session', 'data:text/plain,no', 'not a URL',
  ]) assert.equal(isAllowedSdkQualityRequest(url, origin), false, url)
})

test('failure exemptions consume an exact intercepted request and exact resource URL once, never a later same-endpoint failure', () => {
  const ledger = createSdkFailureLedger()
  const request = { url: () => origin + '/__gusto_mock__/__onboarding_review?employeeId=fictional', method: () => 'POST' }
  const later = { ...request }, otherQuery = { ...request, url: () => origin + '/__gusto_mock__/__onboarding_review?employeeId=another' }
  ledger.expect(request, 503)
  assert.equal(ledger.response(later, 503), false)
  assert.equal(ledger.response(request, 500), false)
  assert.equal(ledger.resourceError('Failed to load resource: the server responded with a status of 503 (Service Unavailable)', otherQuery.url()), false)
  assert.equal(ledger.resourceError('Unrelated JavaScript error 503', request.url()), false)
  assert.equal(ledger.reconciled(), false)
  assert.equal(ledger.response(request, 503), true)
  assert.equal(ledger.response(request, 503), false)
  assert.equal(ledger.resourceError('Failed to load resource: the server responded with a status of 503 (Service Unavailable)', request.url()), true)
  assert.equal(ledger.resourceError('Failed to load resource: the server responded with a status of 503 (Service Unavailable)', request.url()), false)
  assert.equal(ledger.response(later, 503), false)
  assert.equal(ledger.reconciled(), true)
  assert.equal(ledger.responsesSeen, 1)
})

test('abort exemption belongs only to one explicitly registered StrictMode session request', () => {
  const ledger = createSdkFailureLedger()
  const firstSession = { url: () => origin + '/__gusto_mock__/__session', method: () => 'POST' }
  const laterSession = { ...firstSession }, asset = { url: () => origin + '/src/main.tsx', method: () => 'GET' }
  ledger.allowStrictModeCancellation(firstSession)
  assert.equal(ledger.abort(laterSession, 'net::ERR_ABORTED'), false)
  assert.equal(ledger.abort(asset, 'net::ERR_ABORTED'), false)
  assert.equal(ledger.abort(firstSession, 'net::ERR_FAILED'), false)
  assert.equal(ledger.abort(firstSession, 'net::ERR_ABORTED'), true)
  assert.equal(ledger.abort(firstSession, 'net::ERR_ABORTED'), false)
})

test('finite SDK ledger requires independent host, directory, data, review, receipt and reset states', () => {
  const expected = [
    'session-starting', 'session-ready-directory', 'session-unavailable', 'session-invalid-response', 'session-retry-starting', 'session-retry-ready',
    'directory-onboarding', 'directory-dismissed', 'directory-unsupported-action', 'directory-completed-active',
    'onboarding-initial', 'onboarding-profile-validation', 'onboarding-after-profile', 'onboarding-compensation-saved',
    'onboarding-federal-tax', 'onboarding-state-tax', 'onboarding-payment', 'onboarding-deductions', 'onboarding-sdk-summary',
    'onboarding-readiness-incomplete', 'onboarding-readiness-unverified', 'onboarding-review-ready', 'onboarding-form-reviewed',
    'onboarding-report-reviewed', 'onboarding-review-refused', 'onboarding-completion-refused', 'onboarding-completion-unverified',
    'onboarding-completed', 'sdk-event-log', 'payroll-preparing', 'payroll-initial', 'payroll-calculating', 'payroll-review', 'payroll-hours', 'payroll-take-home',
    'payroll-tax-debit', 'payroll-submitting', 'payroll-submitted', 'payroll-receipt', 'payroll-receipt-tax', 'payroll-receipt-employees',
    'reset-refused', 'reset-pending', 'reset-success',
  ]
  assert.deepEqual(Object.keys(sdkStateInventory), expected)
  const observations = expected.map(state => ({ state, text: 'Actual visible status text', shape: 'Actual accessible state', capture: state + '-monochrome.png', labelCapture: state + '-label-monochrome.png', witness: { uncovered: true, samples: 3 } }))
  assert.deepEqual(sdkInventoryCoverage(observations), { expected: 44, observed: 44, missing: [], unknown: [] })
  assert.deepEqual(sdkInventoryCoverage(observations.filter(item => item.state !== 'payroll-receipt')).missing, ['payroll-receipt'])
  assert.deepEqual(sdkInventoryCoverage(observations.map(item => item.state === 'onboarding-completed' ? { ...item, shape: '' } : item)).missing, ['onboarding-completed'])
  assert.deepEqual(sdkInventoryCoverage(observations.map(item => item.state === 'payroll-submitting' ? { ...item, labelCapture: '' } : item)).missing, ['payroll-submitting'])
  assert.deepEqual(sdkInventoryCoverage(observations.map(item => item.state === 'onboarding-after-profile' ? { ...item, witness: { uncovered: false, samples: 3 } } : item)).missing, ['onboarding-after-profile'])
  assert.deepEqual(sdkInventoryCoverage([...observations, { state: 'unmounted-provider-export' }]).unknown, ['unmounted-provider-export'])
})
