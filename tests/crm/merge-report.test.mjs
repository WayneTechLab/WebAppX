import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = name => new URL(`../../src/crm/${name}.ts`, import.meta.url)
const { createCrmState, crmActors, transitionCrm } = await loadMockModel(source('model'))
const { isCrmState } = await loadMockModel(source('persistence'))
const { duplicateCrmReport, duplicateCrmGroupMembers, normalizeCrmDuplicateText } = await loadMockModel(source('merge-report'))
const actor = id => crmActors.find(item => item.id === id)

function candidates() {
  let state = transitionCrm(createCrmState(), actor('sales-riley'), { type: 'create-company', name: 'Fictional  Harbor Studio' })
  state = transitionCrm(state, actor('sales-riley'), { type: 'create-company', name: 'Example  Orbit Workshop' })
  state = transitionCrm(state, actor('sales-sam'), { type: 'convert-lead', leadId: 'lead-robin', amountCents: 10000 })
  // A valid imported cross-table collision. Native create deliberately refuses it.
  state.leads.find(item => item.id === 'lead-jules').email = 'avery@harbor.invalid'
  assert.equal(isCrmState(state), true)
  return state
}

test('normalization is exact whitespace/case only, preserving accents, punctuation and email-like tags', () => {
  assert.equal(normalizeCrmDuplicateText('  Acmé \t  Studio, LLC  '), 'acmé studio, llc')
  assert.notEqual(normalizeCrmDuplicateText('Acmé Studio'), normalizeCrmDuplicateText('Acme Studio'))
  assert.equal(normalizeCrmDuplicateText('A.B+Tag@Example.invalid'), 'a.b+tag@example.invalid')
})

test('literal scoped classifications and code-point order are read-only for all five canonical identities', () => {
  const state = candidates(), before = structuredClone(state), raw = JSON.stringify(state)
  const expected = [
    ['cross-owner-ineligible', 'example orbit workshop', ['company:company-0002', 'company:company-orbit']],
    ['candidate', 'fictional harbor studio', ['company:company-0001', 'company:company-harbor']],
    ['candidate', 'avery@harbor.invalid', ['contact:contact-avery', 'lead:lead-jules']],
    ['expected-conversion-link', 'robin@ridge.invalid', ['contact:contact-0003', 'lead:lead-robin']],
  ]
  for (const id of ['crm-owner', 'crm-manager', 'crm-auditor']) {
    const report = duplicateCrmReport(state, actor(id))
    assert.equal(report.ok, true)
    assert.deepEqual(report.groups.map(group => [group.reason, group.normalizedKey, group.members.map(member => `${member.kind}:${member.id}`)]), expected)
    assert.deepEqual(Object.keys(report).sort(), ['accessibleGroupCount', 'groups', 'hasMore', 'ok', 'page', 'pageSize', 'returnedCount', 'schemaVersion', 'status'].sort())
    assert.equal(report.accessibleGroupCount, 4); assert.equal(report.pageSize, 20)
  }
  assert.deepEqual(duplicateCrmReport(state, actor('sales-riley')).groups.map(group => [group.reason, group.normalizedKey]), expected.slice(1, 3).map(row => row.slice(0, 2)))
  assert.deepEqual(duplicateCrmReport(state, actor('sales-sam')).groups.map(group => [group.reason, group.normalizedKey]), [expected[3].slice(0, 2)])
  const report = duplicateCrmReport(state, actor('sales-riley')); report.groups[0].members[0].label = 'Detached DTO mutation'
  assert.deepEqual(state, before); assert.equal(JSON.stringify(state), raw); assert.equal(Object.hasOwn(state, 'mergeHistory'), false)
})

test('group paging and independent member paging return bounded arrays with accessible totals only', () => {
  let state = createCrmState()
  for (let index = 1; index <= 51; index++) state = transitionCrm(state, actor('sales-riley'), { type: 'create-company', name: `Sample${' '.repeat(index)}Directory` })
  assert.equal(isCrmState(state), true)
  const before = JSON.stringify(state), report = duplicateCrmReport(state, actor('sales-riley'), { page: 1, pageSize: 1 })
  assert.equal(report.accessibleGroupCount, 1); assert.equal(report.returnedCount, 1); assert.equal(report.groups[0].memberCount, 51)
  assert.equal(report.groups[0].members.length, 50); assert.equal(report.groups[0].membersHasMore, true)
  assert.deepEqual(Object.keys(report.groups[0]).sort(), ['groupId', 'kind', 'reason', 'normalizedKey', 'memberCount', 'memberPage', 'memberPageSize', 'members', 'membersHasMore'].sort())
  const tail = duplicateCrmGroupMembers(state, actor('sales-riley'), { groupId: report.groups[0].groupId, page: 2, pageSize: 50 })
  assert.equal(tail.returnedCount, 1); assert.equal(tail.accessibleMemberCount, 51); assert.equal(tail.hasMore, false)
  assert.equal(tail.members[0].id, 'company-0051')
  assert.equal(duplicateCrmReport(state, actor('sales-sam')).accessibleGroupCount, 0)
  assert.equal(duplicateCrmReport(state, actor('sales-riley'), { page: 2, pageSize: 1 }).status, 'empty')
  assert.equal(JSON.stringify(state), before)
})

test('unknown actor refuses before graph lookup; malformed requests never invoke getters', () => {
  let reads = 0
  const hostile = { get companies() { reads++; throw new Error('hidden') } }
  const denied = duplicateCrmReport(hostile, { id: 'sales-riley', role: 'owner' })
  assert.equal(denied.ok, false); assert.equal(reads, 0)
  assert.deepEqual(duplicateCrmGroupMembers(hostile, null, { groupId: 'hidden' }), denied)
  const state = candidates()
  for (const request of [{ page: 0 }, { page: Infinity }, { page: -0 }, { pageSize: 51 }, { pageSize: undefined }, { page: 1, extra: true }, { get page() { reads++; return 1 } }]) assert.equal(duplicateCrmReport(state, actor('crm-owner'), request).ok, false)
  assert.equal(reads, 0)
  const hidden = duplicateCrmGroupMembers(state, actor('sales-riley'), { groupId: 'email:robin%40ridge.invalid' })
  const missing = duplicateCrmGroupMembers(state, actor('sales-riley'), { groupId: 'email:missing%40fiction.invalid' })
  assert.deepEqual(hidden, missing)
  const getterSource = { ...state, get contacts() { reads++; return state.contacts } }
  assert.equal(duplicateCrmReport(getterSource, actor('crm-owner')).ok, false); assert.equal(reads, 0)
})
