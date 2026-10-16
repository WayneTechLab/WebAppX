import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const crm = await loadMockModel(new URL('../../src/crm/model.ts', import.meta.url))
const owner = crm.crmActors.find(actor => actor.role === 'owner')
const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
const sam = crm.crmActors.find(actor => actor.id === 'sales-sam')
const auditor = crm.crmActors.find(actor => actor.role === 'auditor')
const change = (state, event, actor = riley) => crm.transitionCrm(state, actor, event)

test('CRM scope projects one representative’s linked records and excludes other activities', () => {
  let state = crm.createCrmState()
  state = change(state, { type: 'qualify-lead', leadId: 'lead-jules' })
  const visible = crm.scopedCrmState(state, riley)
  assert.deepEqual(visible.companies.map(company => company.id), ['company-harbor'])
  assert.deepEqual(visible.contacts.map(contact => contact.id), ['contact-avery'])
  assert.deepEqual(visible.opportunities.map(opportunity => opportunity.id), ['opportunity-harbor'])
  assert.equal(crm.scopedCrmState(state, sam).activity.length, 0)
  assert.equal(crm.scopedCrmState(state, owner).companies.length, 2)
  assert.equal(crm.scopedCrmState(state, { ...riley, id: 'unknown' }).contacts.length, 0)
  assert.equal(crm.scopedCrmState(state, { ...riley, role: 'owner' }).companies.length, 0)
})

test('lead conversion is atomic, linked, exactly once and immediately reflected in the dashboard', () => {
  let state = crm.createCrmState()
  const original = structuredClone(state)
  assert.throws(() => change(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 }), /Qualify/)
  assert.deepEqual(state, original)
  state = change(state, { type: 'qualify-lead', leadId: 'lead-jules' })
  state = change(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 })
  const lead = state.leads.find(record => record.id === 'lead-jules')
  const opportunity = state.opportunities.find(record => record.id === lead.opportunityId)
  assert.equal(lead.status, 'converted')
  assert.equal(opportunity.companyId, lead.companyId)
  assert.equal(opportunity.contactId, lead.contactId)
  assert.equal(state.contacts.find(record => record.id === lead.contactId).companyId, lead.companyId)
  assert.equal(opportunity.leadId, lead.id)
  assert.equal(crm.crmDashboard(state, riley).pipelineCents, 400000)
  assert.equal(crm.crmDashboard(state, riley).leads, 0)
  const converted = structuredClone(state)
  assert.throws(() => change(state, { type: 'convert-lead', leadId: lead.id, amountCents: 200000 }), /cannot be converted again/)
  assert.deepEqual(state, converted)
})

test('conversion reuses an existing same-owner company without creating duplicate account records', () => {
  let state = crm.createCrmState()
  state = change(state, { type: 'create-lead', name: 'Sky Fiction', email: 'sky@harbor.invalid', companyName: 'FICTIONAL HARBOR STUDIO' })
  const lead = state.leads.at(-1)
  state = change(state, { type: 'qualify-lead', leadId: lead.id })
  state = change(state, { type: 'convert-lead', leadId: lead.id, amountCents: 12345 })
  assert.equal(state.companies.length, 2)
  assert.equal(state.leads.at(-1).companyId, 'company-harbor')
  assert.equal(state.contacts.at(-1).email, 'sky@harbor.invalid')
})

test('representatives cannot mutate foreign records or create records with mismatched links', () => {
  const state = crm.createCrmState()
  for (const event of [
    { type: 'qualify-lead', leadId: 'lead-robin' },
    { type: 'convert-lead', leadId: 'lead-robin', amountCents: 10000 },
    { type: 'create-contact', companyId: 'company-orbit', name: 'Demo Person', email: 'demo@orbit.invalid' },
    { type: 'advance-opportunity', opportunityId: 'opportunity-orbit', stage: 'negotiation' },
    { type: 'create-task', opportunityId: 'opportunity-orbit', title: 'Foreign task' },
  ]) assert.throws(() => change(state, event), /unavailable/)
  assert.throws(() => change(state, { type: 'create-opportunity', title: 'Mismatch example', companyId: 'company-harbor', contactId: 'contact-jordan', amountCents: 10000 }, owner), /belonging/)
  assert.throws(() => change(state, { type: 'create-opportunity', title: 'Missing company', companyId: 'missing', contactId: 'contact-avery', amountCents: 10000 }), /unavailable/)
})

test('auditors and forged identities cannot write while the legitimate sales manager can act across the company', () => {
  const state = crm.createCrmState()
  for (const actor of [auditor, { ...riley, role: 'owner' }, { ...owner, id: 'unknown' }]) {
    assert.throws(() => change(state, { type: 'create-company', name: 'Sample blocked company' }, actor), /no CRM write/)
  }
  const manager = crm.crmActors.find(actor => actor.role === 'sales-manager')
  assert.equal(change(state, { type: 'qualify-lead', leadId: 'lead-jules' }, manager).leads[0].status, 'qualified')
  assert.equal(crm.scopedCrmState(state, auditor).opportunities.length, 2)
})

test('fictional contact validation rejects real domains, malformed strings and duplicate email records', () => {
  let state = crm.createCrmState()
  for (const email of ['person@example.com', 'person@invalid', 'person@-bad.invalid', 'person@.invalid', 'bad address@example.invalid']) {
    assert.throws(() => change(state, { type: 'create-contact', name: 'Fictional Person', email, companyId: 'company-harbor' }), /fictional email/)
  }
  for (const name of ['', 'x', 'a'.repeat(121), 'Unsafe\nName']) assert.throws(() => change(state, { type: 'create-company', name }))
  state = change(state, { type: 'create-contact', name: 'Robin Fiction', email: ' ROBIN@EXAMPLE.INVALID ', companyId: 'company-harbor' })
  assert.equal(state.contacts.at(-1).email, 'robin@example.invalid')
  assert.throws(() => change(state, { type: 'create-contact', name: 'Duplicate Fiction', email: 'robin@example.invalid', companyId: 'company-harbor' }), /different fictional email/)
  assert.throws(() => change(state, { type: 'create-lead', name: 'Duplicate Fiction', email: 'avery@harbor.invalid', companyName: 'Demo Company' }), /different fictional email/)
})

test('invalid monetary amounts cannot create or convert opportunities and leave no partial records', () => {
  let state = change(crm.createCrmState(), { type: 'qualify-lead', leadId: 'lead-jules' })
  for (const amountCents of [0, -1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 100000001, Number.MAX_SAFE_INTEGER]) {
    const before = structuredClone(state)
    assert.throws(() => change(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents }), /amount/)
    assert.deepEqual(state, before)
    assert.throws(() => change(state, { type: 'create-opportunity', title: 'Bad amount', companyId: 'company-harbor', contactId: 'contact-avery', amountCents }), /amount/)
  }
  state = change(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 1 })
  assert.equal(state.opportunities.at(-1).amountCents, 1)
})

test('pipeline follows valid stages, won value leaves open pipeline, and terminal transitions cannot replay', () => {
  let state = crm.createCrmState()
  assert.throws(() => change(state, { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage: 'won' }), /Move/)
  for (const stage of ['proposal', 'negotiation', 'won']) state = change(state, { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage })
  assert.equal(crm.crmDashboard(state, riley).pipelineCents, 0)
  assert.equal(crm.crmDashboard(state, riley).wonCents, 250000)
  assert.throws(() => change(state, { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage: 'lost' }), /Closed/)
  assert.throws(() => change(state, { type: 'advance-opportunity', opportunityId: 'opportunity-orbit', stage: 'unknown' }, owner), /Move/)
  state = change(state, { type: 'advance-opportunity', opportunityId: 'opportunity-orbit', stage: 'lost' }, owner)
  assert.equal(crm.crmDashboard(state, owner).pipelineCents, 0)
})

test('follow-ups inherit opportunity ownership, update the inbox and complete once', () => {
  let state = change(crm.createCrmState(), { type: 'create-task', title: 'Draft sample proposal', opportunityId: 'opportunity-harbor' }, owner)
  const task = state.tasks.at(-1)
  assert.equal(task.ownerId, riley.id)
  assert.equal(crm.crmDashboard(state, riley).openTasks, 2)
  assert.equal(crm.crmDashboard(state, sam).openTasks, 0)
  assert.throws(() => change(state, { type: 'complete-task', taskId: task.id }, sam), /unavailable/)
  state = change(state, { type: 'complete-task', taskId: task.id })
  assert.equal(crm.crmDashboard(state, riley).openTasks, 1)
  assert.throws(() => change(state, { type: 'complete-task', taskId: task.id }), /already complete/)
  assert.equal(new Set(state.activity.map(activity => activity.receipt)).size, state.activity.length)
})

test('scope excludes inconsistent cross-owner graph edges instead of leaking contact or opportunity labels', () => {
  const state = crm.createCrmState()
  state.contacts.push({ id: 'inconsistent-contact', ownerId: riley.id, companyId: 'company-orbit', name: 'Hidden Cross Link', email: 'hidden@orbit.invalid' })
  state.opportunities.push({ id: 'inconsistent-opportunity', ownerId: riley.id, companyId: 'company-harbor', contactId: 'contact-jordan', title: 'Hidden Deal', amountCents: 500, stage: 'discovery' })
  state.tasks.push({ id: 'inconsistent-task', ownerId: riley.id, opportunityId: 'opportunity-orbit', title: 'Hidden Task', status: 'open' })
  const projected = crm.scopedCrmState(state, riley)
  assert.equal(projected.contacts.some(record => record.id === 'inconsistent-contact'), false)
  assert.equal(projected.opportunities.some(record => record.id === 'inconsistent-opportunity'), false)
  assert.equal(projected.tasks.some(record => record.id === 'inconsistent-task'), false)
})
