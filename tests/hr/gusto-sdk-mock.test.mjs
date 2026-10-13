import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Employees } from '@gusto/embedded-api/sdk/employees'
import { HTTPClient } from '@gusto/embedded-api/lib/http'
import { GustoEmbedded } from '@gusto/embedded-api'
import { RFCDate } from '@gusto/embedded-api/types/rfcdate'
import { createMockSdk, mockSdkResponse, MOCK_COMPANY_ID, MOCK_EMPLOYEE_ID, MOCK_PAYROLL_ID, MOCK_SESSION_HEADER, gustoMockPlugin } from '../../integrations/gusto/mock-api.mjs'

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

function session(mock) {
  const response = mock.respond({ method: 'POST', url: '/__gusto_mock__/__session', headers })
  assert.equal(response.status, 201)
  assert.match(response.body.sessionId, /^[0-9a-f]{32}$/)
  return response.body.sessionId
}
function localRequest(mock, sessionId, method, route, body) {
  return mock.respond({ method, url: `/__gusto_mock__${route}`, headers: { ...headers, [MOCK_SESSION_HEADER]: sessionId }, ...(body == null ? {} : { body }) })
}
function client(mock, sessionId) {
  return new GustoEmbedded({ serverURL: 'http://mock.invalid/__gusto_mock__/', httpClient: new HTTPClient({ fetcher: async (input, init) => {
    const request = new Request(input, init)
    request.headers.set(MOCK_SESSION_HEADER, sessionId)
    const url = new URL(request.url), text = request.method === 'GET' ? '' : await request.clone().text()
    const result = mock.respond({ method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers), body: text || undefined })
    return new Response(result.body == null ? null : JSON.stringify(result.body), { status: result.status, headers: result.headers })
  } }) })
}

async function saveOnboardingData(mock, sessionId, employeeId = MOCK_EMPLOYEE_ID) {
  const sdk = client(mock, sessionId)
  const { employee } = await sdk.employees.get({ employeeId })
  await sdk.employees.update({ employeeId, requestBody: { version: employee.version, firstName: employee.firstName, lastName: employee.lastName, email: 'jordan@example.invalid', dateOfBirth: '1992-02-12', ssn: '123456789', selfOnboarding: false } })
  const { companyLocationsList: locations } = await sdk.locations.get({ companyId: MOCK_COMPANY_ID })
  await sdk.employeeAddresses.create({ employeeId, requestBody: { street1: '100 Fictional Lane', city: 'Austin', state: 'TX', zip: '78701', country: 'USA', effectiveDate: new RFCDate('2026-10-13'), courtesyWithholding: false } })
  await sdk.employeeAddresses.createWorkAddress({ employeeId, requestBody: { locationUuid: locations[0].uuid, effectiveDate: new RFCDate('2026-10-13') } })
  const { job } = await sdk.jobsAndCompensations.createJob({ employeeId, jobsCreateRequestBody: { title: 'Synthetic engineer', hireDate: '2026-10-13', twoPercentShareholder: false } })
  const compensation = job.compensations.find(row => row.uuid === job.currentCompensationUuid)
  const updated = await sdk.jobsAndCompensations.updateCompensation({ compensationId: compensation.uuid, compensationsUpdateRequestBody: { version: compensation.version, rate: '60000.00', paymentUnit: 'Year', flsaStatus: 'Exempt', adjustForMinimumWage: false, minimumWages: [] } })
  const taxes = (await sdk.employeeTaxSetup.getFederalTaxes({ employeeUuid: employeeId })).employeeFederalTax
  await sdk.employeeTaxSetup.updateFederalTaxes({ employeeUuid: employeeId, requestBody: { version: taxes.version, w4DataType: 'rev_2020_w4', filingStatus: 'Single', twoJobs: false, dependentsAmount: 0, otherIncome: 0, deductions: 0, extraWithholding: 0 } })
  assert.deepEqual((await sdk.employeeTaxSetup.getStateTaxes({ employeeUuid: employeeId })).employeeStateTaxesList, [])
  const payment = (await sdk.employeePaymentMethod.get({ employeeId })).employeePaymentMethod
  await sdk.employeePaymentMethod.update({ employeeId, requestBody: { version: payment.version, type: 'Check' } })
  assert.deepEqual((await sdk.employeePaymentMethods.getBankAccounts({ employeeId })).employeeBankAccounts, [])
  assert.deepEqual((await sdk.garnishments.list({ employeeId })).garnishments, [])
  return { sdk, job, compensation: updated.compensation }
}

test('issued sessions isolate browser workflows, reject guesses and reset only their own state', () => {
  const mock = createMockSdk(), first = session(mock), second = session(mock)
  assert.notEqual(first, second)
  assert.equal(localRequest(mock, 'f'.repeat(32), 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}`).status, 403)
  const employee = localRequest(mock, first, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}`).body
  assert.equal(localRequest(mock, first, 'PUT', `/v1/employees/${MOCK_EMPLOYEE_ID}`, { version: employee.version, first_name: 'First session' }).status, 200)
  assert.equal(localRequest(mock, second, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}`).body.first_name, 'Jordan')
  assert.equal(localRequest(mock, first, 'POST', '/__reset').status, 200)
  assert.equal(localRequest(mock, first, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}`).body.first_name, 'Jordan')
  assert.equal(localRequest(mock, second, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}`).body.first_name, 'Jordan')
  assert.equal(gustoMockPlugin().apply, 'serve')
  assert.equal(typeof gustoMockPlugin().configurePreviewServer, 'undefined')
})

test('synthetic sessions have bounded capacity and expiry without reusing supplied identifiers', () => {
  let clock = 100
  const mock = createMockSdk({ now: () => clock, maxSessions: 1, sessionTtl: 100 })
  const first = session(mock)
  assert.equal(mock.respond({ method: 'POST', url: '/__gusto_mock__/__session', headers }).status, 429)
  clock = 201
  assert.equal(localRequest(mock, first, 'GET', '/__state').status, 403)
  assert.notEqual(session(mock), first)
})

test('workflow bounds deny unsafe URLs, queries, bodies, credentials and foreign resources', () => {
  const mock = createMockSdk(), id = session(mock)
  for (const route of ['/v1/employees/%2e%2e', '/v1/employees/../jobs/x', '/v1/employees/x%2fy', '/v1/employees//x']) assert.equal(localRequest(mock, id, 'GET', route).status, 400)
  assert.equal(mock.respond({ url: 'https://api.gusto.com/v1/employees/x', headers }).status, 400)
  assert.equal(localRequest(mock, id, 'GET', `/v1/employees/foreign-employee`).status, 404)
  assert.equal(localRequest(mock, id, 'GET', '/v1/companies/foreign-company/employees').status, 404)
  assert.equal(localRequest(mock, id, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}?role=owner`).status, 501)
  assert.equal(localRequest(mock, id, 'GET', `/v1/employees/${MOCK_EMPLOYEE_ID}?page=1&page=2`).status, 501)
  assert.equal(localRequest(mock, id, 'PUT', `/v1/employees/${MOCK_EMPLOYEE_ID}`, '{invalid').status, 400)
  assert.equal(localRequest(mock, id, 'PUT', `/v1/employees/${MOCK_EMPLOYEE_ID}`, { version: 'mock-v1', client_secret: 'never-accepted' }).status, 400)
  assert.equal(localRequest(mock, id, 'PUT', `/v1/employees/${MOCK_EMPLOYEE_ID}`, { first_name: 'x'.repeat(32768) }).status, 413)
  assert.equal(localRequest(mock, id, 'POST', '/__onboarding_review', { employeeId: 'foreign-employee', formsReviewed: true, newHireReportReviewed: true }).status, 404)
})

test('actual published client completes saved administrative data plus explicit simulated reviews and readback', async () => {
  const mock = createMockSdk(), id = session(mock)
  assert.deepEqual(localRequest(mock, id, 'GET', `/__onboarding_review?employeeId=${MOCK_EMPLOYEE_ID}`).body, { dataStepsComplete: false })
  assert.equal(localRequest(mock, id, 'POST', '/__onboarding_review', { employeeId: MOCK_EMPLOYEE_ID, formsReviewed: true, newHireReportReviewed: true }).status, 422)
  const { sdk, compensation } = await saveOnboardingData(mock, id)
  assert.equal(compensation.rate, '60000.00')
  const savedJobs = (await sdk.jobsAndCompensations.getJobs({ employeeId: MOCK_EMPLOYEE_ID, include: 'all_compensations' })).jobs
  assert.equal(savedJobs[0].compensations[0].rate, '60000.00')
  assert.equal(localRequest(mock, id, 'GET', `/__onboarding_review?employeeId=${MOCK_EMPLOYEE_ID}`).body.dataStepsComplete, true)
  await assert.rejects(sdk.employees.updateOnboardingStatus({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { onboardingStatus: 'onboarding_completed' } }), error => error.httpMeta.response.status === 422)
  assert.equal(localRequest(mock, id, 'POST', '/__onboarding_review', { employeeId: MOCK_EMPLOYEE_ID, formsReviewed: true, newHireReportReviewed: false }).status, 422)
  const review = localRequest(mock, id, 'POST', '/__onboarding_review', { employeeId: MOCK_EMPLOYEE_ID, formsReviewed: true, newHireReportReviewed: true })
  assert.equal(review.body.legalSignatureCreated, false)
  assert.equal(review.body.reportFiled, false)
  await sdk.employees.updateOnboardingStatus({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { onboardingStatus: 'onboarding_completed' } })
  const status = (await sdk.employees.getOnboardingStatus({ employeeId: MOCK_EMPLOYEE_ID })).employeeOnboardingStatus
  assert.equal(status.onboardingStatus, 'onboarding_completed')
  assert.equal(status.onboardingSteps.every(step => !step.required || step.completed), true)
  assert.equal((await sdk.employees.get({ employeeId: MOCK_EMPLOYEE_ID })).employee.onboarded, true)
  const active = await sdk.employees.list({ companyId: MOCK_COMPANY_ID, onboardedActive: true })
  assert.equal(active.showEmployees.some(employee => employee.uuid === MOCK_EMPLOYEE_ID), true)
  const completedEmployee = (await sdk.employees.get({ employeeId: MOCK_EMPLOYEE_ID })).employee
  await sdk.employees.update({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { version: completedEmployee.version, firstName: 'Jordan revised' } })
  const invalidated = (await sdk.employees.getOnboardingStatus({ employeeId: MOCK_EMPLOYEE_ID })).employeeOnboardingStatus
  assert.equal(invalidated.onboardingStatus, 'admin_onboarding_incomplete')
  assert.equal(invalidated.onboardingSteps.find(step => step.id === 'employee_form_signing').completed, false)
  assert.equal(invalidated.onboardingSteps.find(step => step.id === 'file_new_hire_report').completed, false)
  assert.equal((await sdk.employees.get({ employeeId: MOCK_EMPLOYEE_ID })).employee.onboarded, false)
  await assert.rejects(sdk.employees.updateOnboardingStatus({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { onboardingStatus: 'onboarding_completed' } }), error => error.httpMeta.response.status === 422)
  const reopened = await sdk.employees.list({ companyId: MOCK_COMPANY_ID, onboardedActive: false })
  assert.equal(reopened.showEmployees.some(employee => employee.uuid === MOCK_EMPLOYEE_ID), true)
})

test('employee creation roundtrip uses published client, optimistic versions and fixed synthetic identifiers', async () => {
  const mock = createMockSdk(), id = session(mock), sdk = client(mock, id)
  const created = (await sdk.employees.create({ companyId: MOCK_COMPANY_ID, requestBody: { firstName: 'New', lastName: 'Example', email: 'new@example.invalid', dateOfBirth: new RFCDate('1992-02-12'), ssn: '123456789', selfOnboarding: false } })).employee
  assert.equal(created.hasSsn, true)
  assert.equal(created.ssn, '')
  await sdk.employees.update({ employeeId: created.uuid, requestBody: { version: created.version, firstName: 'Updated' } })
  assert.equal((await sdk.employees.get({ employeeId: created.uuid })).employee.firstName, 'Updated')
  await assert.rejects(sdk.employees.update({ employeeId: created.uuid, requestBody: { version: created.version, firstName: 'Stale' } }), error => error.httpMeta.response.status === 409)
  assert.equal((await sdk.employees.get({ employeeId: created.uuid })).employee.firstName, 'Updated')
  assert.equal(localRequest(mock, id, 'POST', `/v1/companies/${MOCK_COMPANY_ID}/employees`, { first_name: 'No', last_name: 'Real identifiers', ssn: '987654321' }).status, 422)
})

test('published SDK work address creation accepts location only and validates dates only when supplied', async () => {
  const mock = createMockSdk(), id = session(mock), sdk = client(mock, id)
  const locationId = '00000000-0000-4000-8000-000000000011'
  const { employeeWorkAddress } = await sdk.employeeAddresses.createWorkAddress({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { locationUuid: locationId } })
  assert.equal(employeeWorkAddress.locationUuid, locationId)
  assert.equal(employeeWorkAddress.effectiveDate, undefined)
  const rows = (await sdk.employeeAddresses.getWorkAddresses({ employeeId: MOCK_EMPLOYEE_ID })).employeeWorkAddressesList
  assert.equal(rows[0].uuid, employeeWorkAddress.uuid)
  assert.equal(rows[0].effectiveDate, undefined)
  assert.equal(localRequest(mock, id, 'POST', `/v1/employees/${MOCK_EMPLOYEE_ID}/work_addresses`, { location_uuid: locationId, effective_date: '2026-02-30' }).status, 422)
  const dated = (await sdk.employeeAddresses.createWorkAddress({ employeeId: MOCK_EMPLOYEE_ID, requestBody: { locationUuid: locationId, effectiveDate: new RFCDate('2026-10-15') } })).employeeWorkAddress
  assert.equal(dated.effectiveDate, '2026-10-15')
})

test('published client job titles propagate to current compensation and survive compensation saves without a title', async () => {
  const mock = createMockSdk(), id = session(mock), sdk = client(mock, id)
  const seeded = (await sdk.jobsAndCompensations.getJobs({ employeeId: '00000000-0000-4000-8000-000000000101', include: 'all_compensations' })).jobs[0]
  assert.equal(seeded.compensations.find(row => row.uuid === seeded.currentCompensationUuid).title, seeded.title)
  const { job } = await sdk.jobsAndCompensations.createJob({ employeeId: MOCK_EMPLOYEE_ID, jobsCreateRequestBody: { title: 'Synthetic operations specialist', hireDate: '2026-10-15', twoPercentShareholder: false } })
  const stub = job.compensations.find(row => row.uuid === job.currentCompensationUuid)
  assert.equal(stub.title, 'Synthetic operations specialist')
  const { compensation } = await sdk.jobsAndCompensations.updateCompensation({ compensationId: stub.uuid, compensationsUpdateRequestBody: { version: stub.version, rate: '30.00', paymentUnit: 'Hour', flsaStatus: 'Nonexempt', adjustForMinimumWage: false, minimumWages: [] } })
  assert.equal(compensation.title, 'Synthetic operations specialist')
  const saved = (await sdk.jobsAndCompensations.getJobs({ employeeId: MOCK_EMPLOYEE_ID, include: 'all_compensations' })).jobs[0]
  assert.equal(saved.compensations.find(row => row.uuid === saved.currentCompensationUuid).title, saved.title)
  const renamed = (await sdk.jobsAndCompensations.update({ jobId: saved.uuid, jobsUpdateRequestBody: { version: saved.version, title: 'Synthetic team lead' } })).job
  const renamedCompensation = renamed.compensations.find(row => row.uuid === renamed.currentCompensationUuid)
  assert.equal(renamedCompensation.title, 'Synthetic team lead')
  assert.notEqual(renamedCompensation.version, compensation.version)
  await assert.rejects(sdk.jobsAndCompensations.updateCompensation({ compensationId: compensation.uuid, compensationsUpdateRequestBody: { version: compensation.version, rate: '40.00', paymentUnit: 'Hour', flsaStatus: 'Nonexempt' } }), error => error.httpMeta.response.status === 409)
  const latest = (await sdk.jobsAndCompensations.getCompensation({ compensationId: compensation.uuid })).compensation
  assert.equal(latest.title, 'Synthetic team lead')
})

test('actual published payroll client prepares, edits, calculates, reviews and fake submits with conflict and replay guards', async () => {
  const mock = createMockSdk(), id = session(mock), sdk = client(mock, id)
  const ids = { companyId: MOCK_COMPANY_ID, payrollId: MOCK_PAYROLL_ID }
  await assert.rejects(sdk.payrolls.submit({ ...ids, requestBody: { submissionBlockers: [] } }), error => error.httpMeta.response.status === 409)
  const prepared = (await sdk.payrolls.prepare({ ...ids, requestBody: { employeeUuids: ['00000000-0000-4000-8000-000000000101'] } })).payrollPrepared
  const row = prepared.employeeCompensations[0]
  const patch = { ...ids, payrollUpdate: { employeeCompensations: [{ employeeUuid: row.employeeUuid, version: row.version, hourlyCompensations: [{ name: 'Regular Hours', jobUuid: row.hourlyCompensations[0].jobUuid, hours: '40.000' }] }] } }
  await sdk.payrolls.update(patch)
  await assert.rejects(sdk.payrolls.update(patch), error => error.httpMeta.response.status === 409)
  await sdk.payrolls.calculate(ids)
  await assert.rejects(sdk.payrolls.submit({ ...ids, requestBody: { submissionBlockers: [] } }), error => error.httpMeta.response.status === 409)
  const calculated = (await sdk.payrolls.get({ ...ids, include: ['totals', 'taxes', 'benefits'] })).payrollShow
  assert.equal(calculated.processingRequest.status, 'calculate_success')
  assert.equal(calculated.employeeCompensations[0].hourlyCompensations[0].hours, '40.000')
  assert.equal(calculated.totals.grossPay, '1000.00')
  assert.equal(calculated.totals.netPay, '1000.00')
  assert.equal(calculated.totals.employeeTaxes, '0.00')
  assert.equal((await sdk.bankAccounts.get({ companyId: MOCK_COMPANY_ID })).companyBankAccounts[0].name, 'Synthetic company account')
  await sdk.paymentConfigs.get({ companyUuid: MOCK_COMPANY_ID })
  await sdk.payrolls.submit({ ...ids, requestBody: { submissionBlockers: [] } })
  const submitted = (await sdk.payrolls.get(ids)).payrollShow
  assert.equal(submitted.processed, true)
  assert.equal(submitted.processingRequest.status, 'submit_success')
  const receipt = localRequest(mock, id, 'GET', '/__state').body.receipt
  assert.equal(receipt.mode, 'mock')
  assert.equal(receipt.state, 'fake-submitted')
  assert.match(receipt.notice, /No wages/)
  await assert.rejects(sdk.payrolls.submit({ ...ids, requestBody: { submissionBlockers: [] } }), error => error.httpMeta.response.status === 409)
  assert.equal(localRequest(mock, id, 'POST', '/__reset').status, 200)
  assert.equal(localRequest(mock, id, 'GET', '/__state').body.payrollPhase, 'draft')
})
