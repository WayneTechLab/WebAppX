import assert from 'node:assert/strict'
import { before, test } from 'node:test'

const project = 'demo-systemx-gusto-rules'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
if (!/^127\.0\.0\.1:\d+$/.test(authHost ?? '') || !/^127\.0\.0\.1:\d+$/.test(firestoreHost ?? '') || process.env.GCLOUD_PROJECT !== project) {
  throw new Error('Gusto rule tests require explicit loopback emulators and the isolated demo-systemx-gusto-rules project')
}
const base = `http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents`
const org = 'demo-systemx-hr'
const path = (collection, id, tenant = org) => `organizations/${tenant}/${collection}/${id}`
const clients = {}

function field(value) {
  if (value === null) return { nullValue: null }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'string') return { stringValue: value }
  if (value.timestampValue) return value
  return { mapValue: { fields: fields(value) } }
}
function fields(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, field(value)])) }
async function request(method, document, token, body) {
  const response = await fetch(`${base}/${document}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, data: await response.json() }
}
async function seed(document, data) { assert.equal((await request('PATCH', document, 'owner', { fields: fields(data) })).status, 200) }
async function account(name, claims = {}) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${name}@example.test`, password: 'synthetic-fixture-password', returnSecureToken: true }),
  })
  assert.equal(response.status, 200); const data = await response.json()
  if (!Object.keys(claims).length) return { uid: data.localId, token: data.idToken }
  const update = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId: data.localId, customAttributes: JSON.stringify(claims) }),
  })
  assert.equal(update.status, 200)
  const signed = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${name}@example.test`, password: 'synthetic-fixture-password', returnSecureToken: true }),
  })
  assert.equal(signed.status, 200); return { uid: data.localId, token: (await signed.json()).idToken }
}
async function selfCreate(client, id, patch = {}) {
  const document = {
    orgId: org, requestId: id, personId: 'person-alex', firebaseUid: client.uid, policyId: 'vacation',
    startAt: { timestampValue: '2026-11-01T00:00:00Z' }, endAt: { timestampValue: '2026-11-03T00:00:00Z' },
    hours: 24, note: 'Synthetic request', status: 'requested', source: 'systemx', ...patch,
  }
  const response = await fetch(`${base}:commit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${client.token}` },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/${path('hr_time_off_requests', id)}`, fields: fields(document) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] }] }),
  })
  return response.status
}

before(async () => {
  for (const name of ['employee', 'manager', 'owner', 'unrelated', 'unmapped-manager', 'empty-manager']) clients[name] = await account(name)
  clients.staff = await account('staff', { level: 5, admin: true })
  for (const [name, personId, roles] of [['employee', 'person-alex', ['employee']], ['manager', 'person-jordan', ['manager']], ['owner', 'person-owner', ['employer-owner']], ['unrelated', 'person-unrelated', ['employee']]]) {
    await seed(path('hr_memberships', clients[name].uid), { uid: clients[name].uid, orgId: org, status: 'active', personId, roles })
  }
  await seed(path('hr_memberships', clients['unmapped-manager'].uid), { uid: clients['unmapped-manager'].uid, orgId: org, status: 'active', roles: ['manager'] })
  await seed(path('hr_memberships', clients['empty-manager'].uid), { uid: clients['empty-manager'].uid, orgId: org, status: 'active', roles: ['manager'], personId: '' })
  await seed(path('hr_people', 'person-alex'), { orgId: org, personId: 'person-alex', displayName: 'Alex Example', managerPersonId: 'person-jordan' })
  await seed(path('hr_people', 'person-unrelated'), { orgId: org, personId: 'person-unrelated', displayName: 'Other Example', managerPersonId: 'different-manager' })
  await seed(path('hr_people', 'person-unassigned'), { orgId: org, personId: 'person-unassigned', displayName: 'Unassigned Example' })
  await seed(path('hr_people', 'person-empty-manager'), { orgId: org, personId: 'person-empty-manager', displayName: 'Unassigned Example', managerPersonId: '' })
  await seed(path('hr_people', 'person-malformed'), { orgId: org, displayName: 'Malformed Example' })
  await seed(path('hr_compensation', 'person-malformed'), { orgId: org, amount: 100 })
  await seed(path('hr_people', 'person-alex', 'another-org'), { orgId: 'another-org', personId: 'person-alex', displayName: 'Other tenant' })
  await seed(path('hr_compensation', 'person-alex'), { orgId: org, personId: 'person-alex', amount: 100 })
  await seed(path('hr_time_off_policies', 'vacation'), { orgId: org, policyId: 'vacation', status: 'active' })
  await seed(path('hr_time_off_policies', 'inactive'), { orgId: org, policyId: 'inactive', status: 'inactive' })
  for (const collection of ['integrations', 'hr_external_ids', 'hr_webhook_inbox', 'hr_idempotency', 'hr_audit_events', 'hr_payroll_secrets']) await seed(path(collection, 'fixture'), { orgId: org, value: 'synthetic-restricted' })
})

test('anonymous and generic staff claims cannot read HR data; own member and manager report directory can', async () => {
  assert.equal((await request('GET', path('hr_people', 'person-alex'))).status, 403)
  assert.equal((await request('GET', path('hr_people', 'person-alex'), clients.staff.token)).status, 403)
  assert.equal((await request('GET', path('hr_people', 'person-alex'), clients.employee.token)).status, 200)
  assert.equal((await request('GET', path('hr_people', 'person-alex'), clients.manager.token)).status, 200)
  assert.equal((await request('GET', path('hr_people', 'person-unrelated'), clients.manager.token)).status, 403)
  assert.equal((await request('GET', path('hr_people', 'person-unrelated'), clients.employee.token)).status, 403)
  for (const name of ['manager', 'unmapped-manager', 'empty-manager']) {
    for (const personId of ['person-unassigned', 'person-empty-manager', 'person-malformed']) assert.equal((await request('GET', path('hr_people', personId), clients[name].token)).status, 403, `${name}/${personId}`)
  }
  assert.equal((await request('GET', path('hr_people', 'person-malformed'), clients.owner.token)).status, 403)
  assert.equal((await request('GET', path('hr_compensation', 'person-malformed'), clients['unmapped-manager'].token)).status, 403)
})

test('cross tenant directory and manager compensation are denied, own and assigned HR compensation read succeeds', async () => {
  assert.equal((await request('GET', path('hr_people', 'person-alex', 'another-org'), clients.owner.token)).status, 403)
  assert.equal((await request('GET', path('hr_compensation', 'person-alex'), clients.manager.token)).status, 403)
  assert.equal((await request('GET', path('hr_compensation', 'person-alex'), clients.employee.token)).status, 200)
  assert.equal((await request('GET', path('hr_compensation', 'person-alex'), clients.owner.token)).status, 200)
})

test('membership registry, provider mappings, event inbox, audit and secrets stay protected from even owner client writes', async () => {
  assert.equal((await request('GET', path('hr_memberships', clients.employee.uid), clients.employee.token)).status, 403)
  assert.equal((await request('GET', path('hr_memberships', clients.owner.uid), clients.employee.token)).status, 403)
  assert.equal((await request('PATCH', path('hr_memberships', clients.employee.uid), clients.owner.token, { fields: fields({ orgId: org, uid: clients.employee.uid, roles: ['employer-owner'], status: 'active' }) })).status, 403)
  for (const collection of ['integrations', 'hr_external_ids', 'hr_webhook_inbox', 'hr_idempotency', 'hr_audit_events', 'hr_payroll_secrets']) {
    assert.equal((await request('GET', path(collection, 'fixture'), clients.owner.token)).status, 403)
    assert.equal((await request('PATCH', path(collection, 'fixture'), clients.owner.token, { fields: fields({ orgId: org, value: 'overwrite' }) })).status, 403)
  }
})

test('self time off creation validates identity, fields, timestamps, policy and immutable approval state', async () => {
  assert.equal(await selfCreate(clients.employee, 'request-valid'), 200)
  for (const [id, patch] of [
    ['request-other-person', { personId: 'person-unrelated' }], ['request-other-uid', { firebaseUid: clients.owner.uid }],
    ['request-other-org', { orgId: 'another-org' }], ['request-empty-person', { personId: '' }],
    ['request-approved', { status: 'approved' }], ['request-extra-field', { approvedBy: clients.employee.uid }],
    ['request-negative-hours', { hours: -1 }], ['request-excess-hours', { hours: 241 }],
    ['request-long-note', { note: 'x'.repeat(501) }], ['request-policy-inactive', { policyId: 'inactive' }],
    ['request-reversed', { endAt: { timestampValue: '2026-10-01T00:00:00Z' } }],
    ['request-excess-span', { endAt: { timestampValue: '2027-01-01T00:00:00Z' } }],
  ]) assert.equal(await selfCreate(clients.employee, id, patch), 403, id)
  assert.equal((await request('PATCH', path('hr_time_off_requests', 'request-valid'), clients.employee.token, { fields: fields({ status: 'approved' }) })).status, 403)
  assert.equal((await request('DELETE', path('hr_time_off_requests', 'request-valid'), clients.owner.token)).status, 403)
  assert.equal((await request('GET', path('hr_time_off_requests', 'request-valid'), clients.employee.token)).status, 200)
  assert.equal((await request('GET', path('hr_time_off_requests', 'request-valid'), clients.unrelated.token)).status, 403)
})
