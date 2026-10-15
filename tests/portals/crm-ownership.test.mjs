import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const crm = await loadMockModel(new URL('../../src/crm/model.ts', import.meta.url))
const { isCrmState } = await loadMockModel(new URL('../../src/crm/persistence.ts', import.meta.url))
const { previewCrmOwnership: preview, applyCrmOwnership: apply, CRM_OWNERSHIP_PREVIEW_LIMIT } = await loadMockModel(new URL('../../src/crm/ownership.ts', import.meta.url))
const owner = crm.crmActors.find(actor => actor.id === 'crm-owner')
const manager = crm.crmActors.find(actor => actor.id === 'crm-manager')
const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
const sam = crm.crmActors.find(actor => actor.id === 'sales-sam')
const auditor = crm.crmActors.find(actor => actor.id === 'crm-auditor')
const leadSelection = { kind: 'lead-assignment', leadId: 'lead-jules', newOwnerId: 'sales-sam' }
const accountSelection = { kind: 'account-transfer', companyId: 'company-harbor', newOwnerId: 'sales-sam' }
const copy = value => structuredClone(value)

function linkedFixture() {
  return {
    companies: [{ id: 'company-harbor', name: 'Fictional Harbor Studio', ownerId: 'sales-riley' }, { id: 'company-orbit', name: 'Example Orbit Workshop', ownerId: 'sales-sam' }],
    contacts: [
      { id: 'contact-avery', name: 'Avery Fiction', email: 'avery@harbor.invalid', companyId: 'company-harbor', ownerId: 'sales-riley' },
      { id: 'contact-jordan', name: 'Jordan Example', email: 'jordan@orbit.invalid', companyId: 'company-orbit', ownerId: 'sales-sam' },
      { id: 'contact-0002', name: 'Jules Sample', email: 'jules@meadow.invalid', companyId: 'company-harbor', ownerId: 'sales-riley' },
    ],
    leads: [
      { id: 'lead-jules', name: 'Jules Sample', email: 'jules@meadow.invalid', companyName: 'Fictional Harbor Studio', ownerId: 'sales-riley', status: 'converted', companyId: 'company-harbor', contactId: 'contact-0002', opportunityId: 'opportunity-0002' },
      { id: 'lead-robin', name: 'Robin Fiction', email: 'robin@ridge.invalid', companyName: 'Fictional Harbor Studio', ownerId: 'sales-sam', status: 'qualified' },
    ],
    opportunities: [
      { id: 'opportunity-harbor', title: 'Sample portal discovery', companyId: 'company-harbor', contactId: 'contact-avery', ownerId: 'sales-riley', amountCents: 250000, stage: 'won' },
      { id: 'opportunity-orbit', title: 'Fictional workflow workshop', companyId: 'company-orbit', contactId: 'contact-jordan', ownerId: 'sales-sam', amountCents: 400000, stage: 'proposal' },
      { id: 'opportunity-0002', title: 'Fictional Harbor Studio · sample opportunity', companyId: 'company-harbor', contactId: 'contact-0002', ownerId: 'sales-riley', amountCents: 150000, stage: 'discovery', leadId: 'lead-jules' },
    ],
    tasks: [
      { id: 'task-harbor', title: 'Prepare fictional discovery notes', ownerId: 'sales-riley', opportunityId: 'opportunity-harbor', status: 'done' },
      { id: 'task-0003', title: 'Fictional open follow-up', ownerId: 'sales-riley', opportunityId: 'opportunity-0002', status: 'open' },
    ],
    activity: [
      { receipt: 'MOCK-CRM-0003', ownerId: 'sales-riley', action: 'create-task', description: 'Assigned Fictional open follow-up to the opportunity owner.' },
      { receipt: 'MOCK-CRM-0002', ownerId: 'sales-riley', action: 'convert-lead', description: 'Converted Jules Sample into linked company, contact and opportunity records.' },
      { receipt: 'MOCK-CRM-0001', ownerId: 'sales-riley', action: 'qualify-lead', description: 'Qualified Jules Sample; conversion is now available.' },
    ],
    sequence: 4,
  }
}

test('owner and manager can reassign an unconverted lead with both exact assignees and no unrelated graph change', () => {
  for (const actor of [owner, manager]) {
    const state = crm.createCrmState(), before = JSON.stringify(state)
    const review = preview(state, actor, leadSelection)
    assert.equal(review.ok, true)
    assert.deepEqual(review.rows, [{ kind: 'lead', id: 'lead-jules', label: 'Jules Sample', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' }])
    assert.deepEqual(review.affected, { companies: [], contacts: [], leads: ['lead-jules'], opportunities: [], tasks: [] })
    const result = apply(state, actor, leadSelection, review.confirmation)
    assert.equal(result.ok, true)
    const expected = crm.createCrmState()
    expected.leads[0].ownerId = 'sales-sam'
    expected.activity = [{ receipt: 'MOCK-CRM-0001', ownerId: 'sales-sam', action: 'assign-lead',
      description: 'Reassigned unconverted lead Jules Sample from Riley Sample to Sam Fixture.',
      ownershipChange: { actorId: actor.id, fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'lead-jules', affected: { companies: [], contacts: [], leads: ['lead-jules'], opportunities: [], tasks: [] } } }]
    expected.sequence = 2
    assert.deepEqual(result.state, expected)
    assert.equal(JSON.stringify(state), before)
    assert.equal(isCrmState(JSON.parse(JSON.stringify(result.state))), true)
    assert.equal(crm.scopedCrmState(result.state, riley).leads.some(item => item.id === 'lead-jules'), false)
    assert.equal(crm.scopedCrmState(result.state, sam).leads.some(item => item.id === 'lead-jules'), true)
  }
})

test('qualified leads can move while converted, same-owner, auditor and unknown assignees refuse unchanged', () => {
  const state = crm.createCrmState()
  const qualified = { kind: 'lead-assignment', leadId: 'lead-robin', newOwnerId: 'sales-riley' }
  const review = preview(state, manager, qualified)
  assert.equal(apply(state, manager, qualified, review.confirmation).ok, true)
  for (const request of [{ ...leadSelection, newOwnerId: 'sales-riley' }, { ...leadSelection, newOwnerId: 'crm-auditor' }, { ...leadSelection, newOwnerId: 'missing' }, { ...leadSelection, leadId: 'missing' }]) assert.equal(preview(state, owner, request).ok, false)
  assert.equal(preview(linkedFixture(), owner, leadSelection).ok, false)
  assert.equal(state.activity.length, 0)
  assert.equal(state.sequence, 1)
})

test('ownership authorization refuses before inspecting hidden records or revealing graph labels', () => {
  for (const actor of [riley, sam, auditor, { ...riley, role: 'owner' }, { ...owner, id: 'unknown' }, null]) {
    const hidden = new Proxy({}, { ownKeys() { throw new Error('Hidden graph was inspected') }, get() { throw new Error('Hidden graph was read') } })
    const result = preview(hidden, actor, accountSelection)
    assert.deepEqual(result, { ok: false, status: 'refused', message: 'Only an owner or sales manager preview can review CRM ownership changes.' })
    assert.deepEqual(apply(hidden, actor, accountSelection, 'not-authority'), result)
  }
  assert.throws(() => crm.transitionCrm({}, riley, { type: 'assign-lead', leadId: 'hidden', newOwnerId: 'sales-sam', expectedOwnerId: 'sales-riley' }), /Only an owner/)
})

test('complete transfer preview identifies every linked record, including closed work, and ignores company-name text edges', () => {
  const state = linkedFixture(), before = JSON.stringify(state)
  assert.equal(isCrmState(state), true)
  const review = preview(state, manager, accountSelection)
  assert.equal(review.ok, true)
  assert.deepEqual(review.affected, { companies: ['company-harbor'], contacts: ['contact-avery', 'contact-0002'], leads: ['lead-jules'], opportunities: ['opportunity-harbor', 'opportunity-0002'], tasks: ['task-harbor', 'task-0003'] })
  assert.deepEqual(review.rows, [
    { kind: 'company', id: 'company-harbor', label: 'Fictional Harbor Studio', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'contact', id: 'contact-avery', label: 'Avery Fiction', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'contact', id: 'contact-0002', label: 'Jules Sample', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'lead', id: 'lead-jules', label: 'Jules Sample', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'opportunity', id: 'opportunity-harbor', label: 'Sample portal discovery', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'opportunity', id: 'opportunity-0002', label: 'Fictional Harbor Studio · sample opportunity', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'task', id: 'task-harbor', label: 'Prepare fictional discovery notes', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
    { kind: 'task', id: 'task-0003', label: 'Fictional open follow-up', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam' },
  ])
  assert.ok(review.warnings.some(item => item.includes('Company-name text is not a graph link')))
  assert.equal(JSON.stringify(state), before, 'Preview is purely read-only')
})

test('confirmed transfer accepts one exact complete graph and preserves all prior receipts byte-for-byte', () => {
  const state = linkedFixture(), before = JSON.stringify(state), review = preview(state, owner, accountSelection)
  const result = apply(state, owner, accountSelection, review.confirmation)
  assert.equal(result.ok, true)
  const expected = linkedFixture()
  expected.companies[0].ownerId = 'sales-sam'
  expected.contacts[0].ownerId = 'sales-sam'; expected.contacts[2].ownerId = 'sales-sam'
  expected.leads[0].ownerId = 'sales-sam'
  expected.opportunities[0].ownerId = 'sales-sam'; expected.opportunities[2].ownerId = 'sales-sam'
  expected.tasks[0].ownerId = 'sales-sam'; expected.tasks[1].ownerId = 'sales-sam'
  expected.sequence = 5
  expected.activity.unshift({ receipt: 'MOCK-CRM-0004', ownerId: 'sales-sam', action: 'transfer-account',
    description: 'Transferred sample account Fictional Harbor Studio from Riley Sample to Sam Fixture; 8 linked records moved together.',
    ownershipChange: { actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'company-harbor',
      affected: { companies: ['company-harbor'], contacts: ['contact-avery', 'contact-0002'], leads: ['lead-jules'], opportunities: ['opportunity-harbor', 'opportunity-0002'], tasks: ['task-harbor', 'task-0003'] } } })
  assert.deepEqual(result.state, expected)
  assert.equal(JSON.stringify(result.state.activity.slice(1)), JSON.stringify(state.activity))
  assert.equal(JSON.stringify(state), before)
  assert.equal(isCrmState(result.state), true)
  assert.equal(crm.scopedCrmState(result.state, riley).companies.some(item => item.id === 'company-harbor'), false)
  assert.deepEqual(crm.scopedCrmState(result.state, sam).companies.map(item => item.id), ['company-harbor', 'company-orbit'])
  assert.deepEqual(result.state.leads[1], state.leads[1], 'A name-only unconverted lead is not an account edge')
  assert.equal(apply(result.state, owner, accountSelection, review.confirmation).ok, false, 'No-op/replay cannot append a second receipt')
})

test('same-sequence replacements, every graph family, actor and selection changes invalidate confirmation before any change', () => {
  for (const mutate of [
    state => { state.companies[0].name = 'Changed fictional company' }, state => { state.contacts[0].name = 'Changed Fiction' },
    state => { state.leads[1].name = 'Changed Sample' }, state => { state.opportunities[0].amountCents += 1 },
    state => { state.tasks[0].title = 'Changed fictional follow-up' }, state => { state.activity[0].description = 'Changed historical receipt text.' },
  ]) {
    const state = linkedFixture(), review = preview(state, owner, accountSelection)
    mutate(state)
    const before = JSON.stringify(state)
    assert.equal(isCrmState(state), true)
    const result = apply(state, owner, accountSelection, review.confirmation)
    assert.equal(result.ok, false)
    assert.match(result.message, /fresh ownership preview/)
    assert.equal(JSON.stringify(state), before)
  }
  const state = linkedFixture(), review = preview(state, owner, accountSelection), before = JSON.stringify(state)
  for (const [actor, selection, confirmation] of [[manager, accountSelection, review.confirmation], [owner, { ...accountSelection, newOwnerId: 'crm-manager' }, review.confirmation], [owner, { ...accountSelection, companyId: 'company-orbit', newOwnerId: 'sales-riley' }, review.confirmation], [owner, accountSelection, undefined], [owner, accountSelection, null], [owner, accountSelection, review.confirmation + 'changed']]) assert.equal(apply(state, actor, selection, confirmation).ok, false)
  assert.equal(JSON.stringify(state), before)
})

test('malformed and projected inputs refuse without reconstructing hidden or mixed-owner graph edges', () => {
  for (const mutate of [
    state => { state.contacts[0].ownerId = 'sales-sam' }, state => { state.contacts[0].companyId = 'missing-company' },
    state => { state.opportunities[0].contactId = 'contact-jordan' }, state => { state.tasks[0].ownerId = 'sales-sam' },
    state => { state.leads[0].ownerId = 'sales-sam' }, state => { state.leads[0].opportunityId = 'missing-opportunity' },
    state => { state.companies.push(copy(state.companies[0])) }, state => { state.sequence = 0 },
  ]) {
    const state = linkedFixture(); mutate(state); const before = JSON.stringify(state)
    assert.equal(preview(state, owner, accountSelection).ok, false)
    assert.equal(apply(state, owner, accountSelection, 'forged').ok, false)
    assert.equal(JSON.stringify(state), before)
  }
  assert.equal(preview(crm.scopedCrmState(linkedFixture(), riley), owner, accountSelection).ok, false)
  for (const selection of [null, {}, { ...accountSelection, unexpected: true }, { ...accountSelection, companyId: 12 }, { ...accountSelection, newOwnerId: null }]) assert.equal(preview(linkedFixture(), owner, selection).ok, false)
})

test('destination company-name collision, no-op and over-capacity graphs refuse the entire operation', () => {
  const collision = linkedFixture(); collision.companies[1].name = 'FICTIONAL HARBOR STUDIO'
  assert.equal(isCrmState(collision), true)
  assert.match(preview(collision, owner, accountSelection).message, /destination already owns/)
  assert.match(preview(linkedFixture(), owner, { ...accountSelection, newOwnerId: 'sales-riley' }).message, /No-op/)
  const state = linkedFixture()
  for (let index = 0; index < CRM_OWNERSHIP_PREVIEW_LIMIT; index++) {
    const n = state.sequence++
    state.contacts.push({ id: `contact-${String(n).padStart(4, '0')}`, name: `Capacity Fixture ${n}`, email: `capacity-${n}@fixture.invalid`, companyId: 'company-harbor', ownerId: 'sales-riley' })
    state.activity.unshift({ receipt: `MOCK-CRM-${String(n).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-contact', description: `Created Capacity Fixture ${n} at Fictional Harbor Studio.` })
  }
  const before = JSON.stringify(state)
  assert.equal(isCrmState(state), true)
  assert.match(preview(state, owner, accountSelection).message, /entire operation is refused/)
  assert.equal(apply(state, owner, accountSelection, 'not-a-partial-authority').ok, false)
  assert.equal(JSON.stringify(state), before)
})

test('strict persistence preserves legacy absence and requires complete metadata only for the two new ownership actions', () => {
  const legacy = linkedFixture(), encoded = JSON.stringify(legacy)
  assert.equal(isCrmState(JSON.parse(encoded)), true)
  assert.equal(JSON.stringify(legacy), encoded)
  const review = preview(legacy, owner, accountSelection), transferred = apply(legacy, owner, accountSelection, review.confirmation).state
  for (const mutate of [
    state => { delete state.activity[0].ownershipChange }, state => { state.activity[0].ownershipChange = null },
    state => { state.activity[0].ownershipChange.extra = 'refused' }, state => { state.activity[0].ownershipChange.actorId = 'sales-riley' },
    state => { state.activity[0].ownershipChange.fromOwnerId = 'crm-auditor' }, state => { state.activity[0].ownershipChange.toOwnerId = 'sales-riley' },
    state => { state.activity[0].ownershipChange.affected.tasks.push('missing-task') }, state => { state.activity[0].ownershipChange.affected.contacts.push('contact-jordan') },
    state => { state.activity[0].ownershipChange.affected.companies = ['company-orbit'] }, state => { state.activity[0].ownershipChange.affected.leads.push('lead-jules') },
    state => { state.activity[1].ownershipChange = copy(state.activity[0].ownershipChange) },
  ]) { const state = copy(transferred); mutate(state); assert.equal(isCrmState(state), false) }
  const state = crm.createCrmState(), assigned = apply(state, owner, leadSelection, preview(state, owner, leadSelection).confirmation).state
  const missing = copy(assigned); delete missing.activity[0].ownershipChange
  assert.equal(isCrmState(missing), false)
  const malformed = copy(assigned); malformed.activity[0].ownershipChange.affected.companies.push('company-harbor')
  assert.equal(isCrmState(malformed), false)
})

test('later conversion and a second account transfer retain older assignment/transfer receipts without weakening graph validation', () => {
  let state = crm.createCrmState()
  state = apply(state, owner, leadSelection, preview(state, owner, leadSelection).confirmation).state
  const assignment = JSON.stringify(state.activity[0])
  state = crm.transitionCrm(state, sam, { type: 'qualify-lead', leadId: 'lead-jules' })
  state = crm.transitionCrm(state, sam, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 12345 })
  const selection = { kind: 'account-transfer', companyId: state.leads[0].companyId, newOwnerId: 'sales-riley' }
  state = apply(state, manager, selection, preview(state, manager, selection).confirmation).state
  const transfer = JSON.stringify(state.activity[0])
  const back = { ...selection, newOwnerId: 'crm-owner' }
  state = apply(state, owner, back, preview(state, owner, back).confirmation).state
  assert.equal(isCrmState(JSON.parse(JSON.stringify(state))), true)
  assert.equal(JSON.stringify(state.activity.at(-1)), assignment)
  assert.equal(JSON.stringify(state.activity[1]), transfer)
  assert.equal(state.leads[0].ownerId, 'crm-owner')
})
