import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import { requireMember, canReadPerson, authorizeProviderRequest, resolveInventoryEndpoints } from '../../integrations/gusto/functions/src/security.mjs'
import { directoryProjection, payrollStatusProjection, timeOffRequest } from '../../integrations/gusto/functions/src/projections.mjs'
import { createHrBackend, integrationState, SYNTHETIC_ORG } from '../../integrations/gusto/functions/src/backend.mjs'
import { verifyWebhookHex, webhookEnvelope, persistWebhook } from '../../integrations/gusto/functions/src/webhooks.mjs'

const company = '00000000-0000-4000-8000-000000000001'
const employeeId = '00000000-0000-4000-8000-000000000002'
const otherEmployeeId = '00000000-0000-4000-8000-000000000003'
const membership = { uid: 'uid-alex', orgId: SYNTHETIC_ORG, status: 'active', roles: ['employee'], personId: 'person-alex', gustoEmployeeUuid: employeeId }
const connection = { orgId: SYNTHETIC_ORG, gustoCompanyUuid: company }
const employee = requireMember(membership.uid, SYNTHETIC_ORG, membership, connection)
const resources = [
  { orgId: SYNTHETIC_ORG, companyUuid: company, externalId: employeeId, personId: 'person-alex', kind: 'employee' },
  { orgId: SYNTHETIC_ORG, companyUuid: company, externalId: otherEmployeeId, personId: 'person-other', kind: 'employee' },
]
const denied = fn => assert.throws(fn, { code: 'permission-denied' })

test('HR membership is server bound; caller level or role cannot create authority', () => {
  assert.throws(() => requireMember(null, SYNTHETIC_ORG, membership), { code: 'unauthenticated' })
  denied(() => requireMember('uid-other', SYNTHETIC_ORG, membership))
  denied(() => requireMember(membership.uid, 'another-org', membership))
  denied(() => requireMember(membership.uid, SYNTHETIC_ORG, { ...membership, status: 'inactive' }))
  denied(() => requireMember(membership.uid, SYNTHETIC_ORG, { ...membership, roles: ['staff'], level: 5, admin: true }))
  denied(() => requireMember(membership.uid, SYNTHETIC_ORG, null))
  assert.deepEqual(employee.roles, ['employee'])
})

test('manager can see own reports directory while compensation, unrelated employees and payroll secrets stay denied', () => {
  const manager = { ...employee, roles: ['manager'], personId: 'person-jordan' }
  const report = { orgId: SYNTHETIC_ORG, personId: 'person-alex', managerPersonId: 'person-jordan' }
  assert.equal(canReadPerson(manager, report), true)
  assert.equal(canReadPerson(manager, report, 'compensation'), false)
  assert.equal(canReadPerson(manager, report, 'restricted-hr'), false)
  assert.equal(canReadPerson(manager, { ...report, managerPersonId: 'unrelated' }), false)
  assert.equal(canReadPerson(employee, report, 'compensation'), true)
  assert.equal(canReadPerson(employee, { ...report, orgId: 'other-org' }), false)
  for (const role of ['employer-owner', 'payroll-admin', 'hr-admin', 'auditor', 'employee']) assert.equal(canReadPerson({ ...employee, roles: [role] }, report, 'payroll-secret'), false)
  for (const missing of [undefined, null, '', ' ', '../invalid', 7]) {
    const unmapped = { ...manager, personId: missing }
    const unassigned = { ...report, managerPersonId: missing }
    assert.equal(canReadPerson(unmapped, unassigned), false)
    assert.equal(canReadPerson(unmapped, { ...report, personId: missing }, 'compensation'), false)
    assert.equal(canReadPerson({ ...employee, roles: ['employer-owner'] }, { ...report, personId: missing }), false)
  }
  assert.equal(canReadPerson(manager, null), false)
})

test('provider self-service permits only own server mapped employee in the current organization', () => {
  const path = `/v1/employees/${employeeId}`
  assert.equal(authorizeProviderRequest(employee, { method: 'GET', path }, resources).path, path)
  denied(() => authorizeProviderRequest(employee, { method: 'GET', path: `/v1/employees/${otherEmployeeId}` }, resources))
  denied(() => authorizeProviderRequest(employee, { method: 'GET', path }, [{ ...resources[0], orgId: 'other-org' }]))
  denied(() => authorizeProviderRequest(employee, { method: 'GET', path }, [{ ...resources[0], companyUuid: 'other-company' }]))
  denied(() => authorizeProviderRequest(employee, { method: 'GET', path }, [{ ...resources[0], personId: 'person-other' }]))
  denied(() => authorizeProviderRequest(employee, { method: 'GET', path }, []))
  denied(() => authorizeProviderRequest({ ...employee, personId: undefined }, { method: 'GET', path }, [{ ...resources[0], personId: undefined }]))
  denied(() => authorizeProviderRequest({ ...employee, personId: '' }, { method: 'GET', path }, [{ ...resources[0], personId: '' }]))
})

test('curated endpoints bind company and nested payroll IDs independently', () => {
  const owner = { ...employee, roles: ['employer-owner'] }
  assert.equal(authorizeProviderRequest(owner, { method: 'GET', path: `/v1/companies/${company}/employees` }).orgId, SYNTHETIC_ORG)
  denied(() => authorizeProviderRequest(owner, { method: 'GET', path: '/v1/companies/another-company/employees' }))
  const payroll = { orgId: SYNTHETIC_ORG, companyUuid: company, kind: 'payroll', externalId: 'payroll-1' }
  assert.equal(authorizeProviderRequest(owner, { method: 'GET', path: `/v1/companies/${company}/payrolls/payroll-1` }, [payroll]).method, 'GET')
  denied(() => authorizeProviderRequest(owner, { method: 'GET', path: `/v1/companies/${company}/payrolls/payroll-1` }, [{ ...payroll, orgId: 'other-org' }]))
  denied(() => authorizeProviderRequest({ ...employee, roles: ['manager'] }, { method: 'GET', path: `/v1/employees/${employeeId}` }, resources))
})

test('all provider writes, money movement, secret endpoints and arbitrary request metadata are denied', () => {
  const owner = { ...employee, roles: ['employer-owner'] }
  for (const path of [`/v1/companies/${company}/payrolls/payroll-1/submit`, `/v1/companies/${company}/contractor_payment_groups`, `/v1/employees/${employeeId}`]) {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) denied(() => authorizeProviderRequest(owner, { method, path }, resources))
  }
  for (const suffix of ['bank_accounts', 'payment_method', 'federal_taxes', 'pay_stubs', 'forms']) denied(() => authorizeProviderRequest(owner, { method: 'GET', path: `/v1/employees/${employeeId}/${suffix}` }, resources))
  for (const field of ['headers', 'url', 'body', 'Authorization', 'role', 'companyId']) denied(() => authorizeProviderRequest(employee, { method: 'GET', path: `/v1/employees/${employeeId}`, [field]: 'untrusted' }, resources))
})

test('URL decoding and path traversal cannot bypass endpoint checks', () => {
  for (const path of [
    'https://api.gusto.com/v1/employees/x', '//api.gusto.com/v1/employees/x', '/v1/employees/../employees/x',
    '/v1/employees/%2e%2e', '/v1/employees/%252e%252e', '/v1/employees/a%2fb', '/v1/employees/a\\b',
    '/v1/employees/x?company=other', '/v1/employees/x#fragment', '/v1//employees/x', '/v1/employees/x/',
  ]) denied(() => authorizeProviderRequest(employee, { method: 'GET', path }, resources))
})

test('SDK flow traversal terminates cycles and never grants inventory endpoints', () => {
  const inventory = {
    flows: { A: { blocks: ['B', 'A'] }, B: { blocks: ['Read', 'A', 'Write'] } },
    blocks: { Read: { endpoints: [{ method: 'GET', path: '/v1/employees/:employeeId' }] }, Write: { endpoints: [{ method: 'POST', path: '/v1/payrolls/:payrollId/submit' }] } },
  }
  assert.equal(resolveInventoryEndpoints(inventory, ['A', 'Read']).length, 2)
  assert.throws(() => resolveInventoryEndpoints(inventory, ['Unknown']), { code: 'invalid-argument' })
  denied(() => authorizeProviderRequest(employee, { method: 'POST', path: '/v1/payrolls/payroll-1/submit' }))
})

test('directory and payroll status projections drop unrecognized and nested secret values', () => {
  const projected = directoryProjection(SYNTHETIC_ORG, 'person-alex', {
    displayName: 'Alex Example', workEmail: 'alex@example.test', employmentStatus: 'active',
    ssn: 'synthetic-secret', bank: { routing: 'synthetic-secret' }, tax: { answers: [] },
    compensation: { salary: 100000 }, payCents: 10000000, dateOfBirth: '2000-01-01', homeAddress: 'restricted',
  })
  assert.deepEqual(Object.keys(projected).sort(), ['orgId', 'personId', 'displayName', 'workEmail', 'employmentStatus'].sort())
  assert.deepEqual(payrollStatusProjection(SYNTHETIC_ORG, 'payroll-1', { status: 'paid', bank: {}, employees: [], ssn: 'no' }), { orgId: SYNTHETIC_ORG, payrollId: 'payroll-1', source: 'gusto', status: 'paid' })
})

test('native time off binds actor identity and rejects impossible dates, excess fields and invalid hours', () => {
  const input = { policyId: 'vacation', startDate: '2026-11-01', endDate: '2026-11-03', hours: 24, note: 'Synthetic demo' }
  const request = timeOffRequest(employee, input, 'request-1', new Date('2026-10-13T00:00:00Z'))
  assert.equal(request.firebaseUid, employee.uid)
  assert.equal(request.personId, 'person-alex')
  assert.equal(request.status, 'requested')
  assert.equal(request.startAt, '2026-11-01T00:00:00.000Z')
  for (const extra of ['personId', 'firebaseUid', 'orgId', 'status', 'approvedBy']) assert.throws(() => timeOffRequest(employee, { ...input, [extra]: 'untrusted' }, 'request-2'), { code: 'invalid-argument' })
  for (const patch of [{ startDate: '2026-02-30' }, { startDate: '2026-11-04' }, { endDate: '2027-01-01' }, { hours: 0 }, { hours: 241 }, { note: 'x'.repeat(501) }]) assert.throws(() => timeOffRequest(employee, { ...input, ...patch }, 'request-2'), { code: 'invalid-argument' })
  denied(() => timeOffRequest({ ...employee, personId: undefined }, input, 'request-2'))
  denied(() => timeOffRequest({ ...employee, roles: ['contractor'] }, input, 'request-2'))
})

test('optional backend requires trusted HR membership even in mock mode', async () => {
  const records = new Map()
  const services = {
    getMembership: async (org, uid) => org === SYNTHETIC_ORG && uid === membership.uid ? membership : null,
    getTimeOffPolicy: async org => ({ orgId: org, status: 'active' }),
    createTimeOff: async (org, id, record) => records.set(`${org}/${id}`, record),
  }
  const backend = createHrBackend(services, { mode: 'mock' })
  assert.equal((await backend.directory(membership.uid, SYNTHETIC_ORG)).length, 1)
  await assert.rejects(backend.directory('uid-unrelated-staff', SYNTHETIC_ORG), { code: 'permission-denied' })
  await assert.rejects(backend.directory(membership.uid, 'other-org'), { code: 'permission-denied' })
  await backend.requestTimeOff(membership.uid, SYNTHETIC_ORG, { policyId: 'vacation', startDate: '2026-11-01', endDate: '2026-11-01', hours: 8 }, 'request-1')
  assert.equal(records.get(`${SYNTHETIC_ORG}/request-1`).firebaseUid, membership.uid)
  const inactive = createHrBackend({ ...services, getTimeOffPolicy: async () => ({ orgId: SYNTHETIC_ORG, status: 'inactive' }) }, { mode: 'mock' })
  await assert.rejects(inactive.requestTimeOff(membership.uid, SYNTHETIC_ORG, { policyId: 'vacation', startDate: '2026-11-01', endDate: '2026-11-01', hours: 8 }, 'request-2'), { code: 'invalid-argument' })
})

test('disabled, demo and production modes cannot forward provider requests or mutate synthetic data', async () => {
  const services = { getMembership: async () => membership }
  for (const mode of ['disabled', 'mock', 'demo', 'production']) {
    const backend = createHrBackend(services, { mode, providerApproved: true, secretsConfigured: true })
    assert.equal((await backend.status(membership.uid, SYNTHETIC_ORG)).providerConnected, false)
    await assert.rejects(backend.proxy(membership.uid, SYNTHETIC_ORG), { code: 'failed-precondition' })
    if (mode !== 'mock') await assert.rejects(backend.directory(membership.uid, SYNTHETIC_ORG), { code: 'failed-precondition' })
  }
  assert.equal(integrationState().status, 'disabled')
})

const verificationToken = 'synthetic-webhook-token-never-real'
const now = 1780000000
const event = { uuid: 'event-1', event_type: 'employee.updated', resource_type: 'Company', resource_uuid: company, entity_type: 'Employee', entity_uuid: employeeId, timestamp: now }
const raw = Buffer.from(JSON.stringify(event))
const signature = bytes => createHmac('sha256', verificationToken).update(bytes).digest('hex')

test('webhook HMAC verifies original bytes and rejects reserialization, tampering and wrong signatures', () => {
  assert.equal(verifyWebhookHex(raw, signature(raw), verificationToken).length, 64)
  denied(() => verifyWebhookHex(Buffer.from(JSON.stringify(event, null, 2)), signature(raw), verificationToken))
  denied(() => verifyWebhookHex(raw, 'f'.repeat(64), verificationToken))
  denied(() => verifyWebhookHex(raw, signature(raw), 'another-long-synthetic-secret'))
  denied(() => verifyWebhookHex(raw, 'sha256=' + signature(raw), verificationToken))
  assert.throws(() => verifyWebhookHex(Buffer.alloc(262145), signature(raw), verificationToken), { code: 'invalid-argument' })
})

test('webhook events bind company, reject stale or future new events, and exclude source payloads', () => {
  const envelope = webhookEnvelope(raw, signature(raw), verificationToken, company, now)
  assert.equal(envelope.state, 'pending-reconciliation')
  assert.equal(envelope.bodyHash.length, 64)
  assert.equal('rawBody' in envelope, false)
  denied(() => webhookEnvelope(raw, signature(raw), verificationToken, 'other-company', now))
  for (const timestamp of [now - 5 * 86400, now + 301]) {
    const payload = Buffer.from(JSON.stringify({ ...event, timestamp }))
    denied(() => webhookEnvelope(payload, signature(payload), verificationToken, company, now))
  }
})

test('webhook inbox transaction deduplicates authenticated deliveries and rejects event ID content changes', async () => {
  const inbox = new Map(); let creates = 0; let tail = Promise.resolve()
  const services = { transaction: callback => {
    const run = tail.then(() => callback({ get: async (org, id) => inbox.get(`${org}/${id}`), create: async (org, id, record) => { creates++; inbox.set(`${org}/${id}`, record) } }))
    tail = run.catch(() => undefined); return run
  } }
  const args = { orgId: SYNTHETIC_ORG, companyUuid: company, rawBody: raw, signature: signature(raw), verificationToken, nowSeconds: now }
  const results = await Promise.all([persistWebhook(services, args), persistWebhook(services, args)])
  assert.equal(creates, 1)
  assert.equal(results.filter(result => result.duplicate).length, 1)
  // A captured valid delivery cannot be repurposed by changing the body.
  const altered = Buffer.from(JSON.stringify({ ...event, entity_uuid: otherEmployeeId }))
  await assert.rejects(persistWebhook(services, { ...args, rawBody: altered }), { code: 'permission-denied' })
  await assert.rejects(persistWebhook(services, { ...args, rawBody: altered, signature: signature(altered) }), { code: 'already-exists' })
  assert.equal(creates, 1)
  assert.equal(inbox.get(`${SYNTHETIC_ORG}/event-1`).orgId, SYNTHETIC_ORG)
})
