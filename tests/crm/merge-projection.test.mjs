import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = name => new URL(`../../src/crm/${name}.ts`, import.meta.url)
const { createCrmState, crmActors, transitionCrm } = await loadMockModel(source('model'))
const { buildCrmMergeCandidate } = await loadMockModel(source('merge'))
const { isCrmState } = await loadMockModel(source('persistence'))
const { previewCrmOwnership, applyCrmOwnership } = await loadMockModel(source('ownership'))
const projection = await loadMockModel(source('merge-projection'))
const actor = id => crmActors.find(item => item.id === id)
const paging = { page: 1, pageSize: 20, scopeVersion: 7 }
const selection = { kind: 'contact', sourceId: 'contact-0001', retainedId: 'contact-avery', fieldPolicy: 'retain-target-v1' }
const expectedCounts = { retired: 1, retained: 1, changed: { contacts: 0, leads: 0, opportunities: 0 }, context: { companies: 1, contacts: 0, leads: 0, opportunities: 1, tasks: 1 }, reviewRecords: 5 }
function before() { return transitionCrm(createCrmState(), actor('sales-riley'), { type: 'create-contact', name: 'Private Source Name', email: 'private.source@fiction.invalid', companyId: 'company-harbor' }) }
function merged() { return buildCrmMergeCandidate(before(), actor('sales-riley'), selection).next }

test('former representative gets the exact receipt summary, while new owner receives no earlier capture or inferred lineage', () => {
  const initial = merged(), request = { kind: 'account-transfer', companyId: 'company-harbor', newOwnerId: 'sales-sam' }
  const preview = previewCrmOwnership(initial, actor('crm-owner'), request)
  assert.equal(preview.ok, true)
  const result = applyCrmOwnership(initial, actor('crm-owner'), request, preview.confirmation)
  assert.equal(result.ok, true)
  const state = result.state, raw = JSON.stringify(state)
  const former = projection.projectCrmMergeHistory(state, actor('sales-riley'), paging)
  assert.deepEqual(former, { schemaVersion: 1, scopeVersion: 7, status: 'page', page: 1, pageSize: 20, accessibleCount: 1, returnedCount: 1, hasMore: false, rows: [{ mode: 'recorded-owner-summary', activity: { receipt: 'MOCK-CRM-0002', ownerId: 'sales-riley', action: 'merge-contact', description: 'Historical CRM merge recorded in this ownership scope.', mergeSummary: { schemaVersion: 1, kind: 'contact', sourceId: 'contact-0001', retainedId: 'contact-avery', commonOwnerId: 'sales-riley', fieldPolicy: 'retain-target-v1', counts: expectedCounts } } }] })
  const nextOwner = projection.projectCrmMergeHistory(state, actor('sales-sam'), paging)
  assert.equal(nextOwner.accessibleCount, 0); assert.deepEqual(nextOwner.rows, [])
  const formerScope = projection.projectCrmScope(state, actor('sales-riley')), newScope = projection.projectCrmScope(state, actor('sales-sam'))
  assert.deepEqual(formerScope.companies, []); assert.deepEqual(formerScope.contacts, [])
  assert.deepEqual(formerScope.activity.find(item => item.action === 'merge-contact'), former.rows[0].activity)
  assert.equal(newScope.contacts.some(item => item.id === 'contact-avery'), true)
  assert.equal(newScope.activity.some(item => item.action.startsWith('merge-')), false)
  for (const row of former.rows) for (const forbidden of ['Private Source Name', 'private.source@fiction.invalid', 'Avery Fiction', '250000', 'mergeChange', 'baseline', 'steps']) assert.equal(JSON.stringify(row).includes(forbidden), false, forbidden)
  assert.equal(JSON.stringify(state), raw)
})

test('owner, manager and auditor retain detached captured-at-receipt facts, not current mutable joins', () => {
  const state = merged(), raw = JSON.stringify(state)
  for (const id of ['crm-owner', 'crm-manager', 'crm-auditor']) {
    const page = projection.projectCrmMergeHistory(state, actor(id), { ...paging, pageSize: 1 })
    assert.equal(page.rows[0].mode, 'full'); assert.equal(page.rows[0].activity.mergeChange.source.name, 'Private Source Name')
    assert.equal(Object.hasOwn(page.rows[0].activity, 'mergeSummary'), false)
    page.rows[0].activity.mergeChange.source.name = 'Detached mutation'
    const scoped = projection.projectCrmScope(state, actor(id)); scoped.contacts[0].name = 'Detached directory mutation'
  }
  assert.equal(JSON.stringify(state), raw)
})

test('choices page only the visible current directory and resolve at most two raw selected IDs without hidden labels', () => {
  const state = before(), page = projection.projectCrmMergeChoices(state, actor('sales-riley'), { ...paging, pageSize: 1, kind: 'contact', selectedIds: ['contact-avery', 'contact-jordan'] })
  assert.equal(page.accessibleCount, 2); assert.equal(page.rows.length, 1); assert.equal(page.rows[0].id, 'contact-0001')
  assert.deepEqual(page.selected, [
    { id: 'contact-avery', available: true, choice: { kind: 'contact', id: 'contact-avery', label: 'Avery Fiction', ownerId: 'sales-riley' } },
    { id: 'contact-jordan', available: false },
  ])
  assert.equal(JSON.stringify(page).includes('Jordan Example'), false)
  page.selected[0].choice.label = 'Detached selected label'; assert.equal(state.contacts[0].name, 'Avery Fiction')
  const gone = projection.projectCrmMergeChoices(merged(), actor('sales-riley'), { ...paging, kind: 'contact', selectedIds: ['contact-0001', 'contact-jordan'] })
  assert.deepEqual(gone.selected, [{ id: 'contact-0001', available: false }, { id: 'contact-jordan', available: false }])
})

test('all scoped entry points refuse forged actors before graph access and descriptor-only page admission never invokes accessors', () => {
  let reads = 0
  const hostile = { get companies() { reads++; throw new Error('hidden graph') } }, forged = { id: 'sales-riley', role: 'owner' }
  assert.deepEqual(projection.projectCrmScope(hostile, forged), { companies: [], contacts: [], leads: [], opportunities: [], tasks: [], activity: [], sequence: 0 })
  for (const fn of [projection.projectCrmDuplicateReport, projection.projectCrmDuplicateMembers, projection.projectCrmMergeChoices, projection.projectCrmMergeHistory]) assert.throws(() => fn(hostile, forged, paging))
  assert.equal(reads, 0)
  const state = before()
  for (const request of [
    { ...paging, kind: 'contact', selectedIds: ['contact-avery', 'contact-avery'] },
    { ...paging, kind: 'contact', selectedIds: ['a', 'b', 'c'] },
    { ...paging, kind: 'contact', selectedIds: undefined },
    { ...paging, kind: 'contact', selectedIds: ['x'.repeat(101)] },
    { ...paging, kind: 'contact', get selectedIds() { reads++; return [] } },
    { ...paging, kind: 'contact', selectedIds: [Object.defineProperty({}, 'id', { get() { reads++; return 'contact-avery' } })] },
    { ...paging, kind: 'contact', pageSize: 51 },
    { ...paging, kind: 'contact', extra: true },
  ]) assert.throws(() => projection.projectCrmMergeChoices(state, actor('sales-riley'), request))
  const array = []; Object.defineProperty(array, '0', { enumerable: true, get() { reads++; return 'contact-avery' } }); array.length = 1
  assert.throws(() => projection.projectCrmMergeChoices(state, actor('sales-riley'), { ...paging, kind: 'contact', selectedIds: array }))
  assert.equal(reads, 0)
})

test('ordinary legacy scope preserves a valid 10001-company saved workspace without inheriting merge feature limits', () => {
  const state = createCrmState()
  for (let index = 1; index <= 9999; index++) state.companies.push({ id: `company-${String(index).padStart(4, '0')}`, name: `C${index}`, ownerId: 'sales-riley' })
  state.sequence = 10000
  state.activity = Array.from({ length: 9999 }, (_, index) => ({ receipt: `MOCK-CRM-${String(9999 - index).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-company', description: 'Legacy company created.' }))
  const raw = JSON.stringify({ schemaVersion: 1, module: 'crm', data: state })
  assert.ok(raw.length < 2000000); assert.equal(isCrmState(state), true)
  const visible = projection.projectCrmScope(state, actor('crm-owner'))
  assert.equal(visible.companies.length, 10001); assert.equal(visible.activity.length, 9999); assert.equal(visible.sequence, 0)
  assert.deepEqual(visible.companies.at(-1), { id: 'company-9999', name: 'C9999', ownerId: 'sales-riley' })
  assert.equal(Object.hasOwn(visible, 'mergeHistory'), false); assert.equal(Object.hasOwn(state, 'mergeHistory'), false)
  assert.equal(JSON.stringify({ schemaVersion: 1, module: 'crm', data: state }), raw)
  visible.companies.at(-1).name = 'Detached legacy projection'; visible.activity[0].description = 'Detached activity'
  assert.equal(state.companies.at(-1).name, 'C9999'); assert.equal(state.activity[0].description, 'Legacy company created.')
  assert.throws(() => projection.projectCrmMergeChoices(state, actor('crm-owner'), { ...paging, kind: 'company' }))
})

test('ordinary legacy scope rejects accessor and cyclic JavaScript values without evaluating a getter', () => {
  let reads = 0
  const state = before(), withGetter = { ...state, get contacts() { reads++; return state.contacts } }
  const empty = { companies: [], contacts: [], leads: [], opportunities: [], tasks: [], activity: [], sequence: 0 }
  assert.deepEqual(projection.projectCrmScope(withGetter, actor('crm-owner')), empty); assert.equal(reads, 0)
  const cyclic = { ...state }; cyclic.loop = cyclic
  assert.deepEqual(projection.projectCrmScope(cyclic, actor('crm-owner')), empty); assert.equal(reads, 0)
})
