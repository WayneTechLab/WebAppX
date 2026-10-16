import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as E from './crm-merge-expected.mjs'
import { assertCrmWitnessBounds, assertCrmHistoryAppend } from './crm-merge.mjs'
import { crmMergeStatusInventory, crmMergeStatusFamilies } from './crm-merge-status-inventory.mjs'
const seedBytes = readFileSync(new URL('./fixtures/portal-smoke-v1.json', import.meta.url))
const seed = JSON.parse(seedBytes).workspaces
const hash = value => createHash('sha256').update(value).digest('hex')
test('independent CRM fixture is immutable, complete legacy data with generated IDs below the declared boundary', () => {
  assert.equal(hash(seedBytes), 'ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02')
  const fixture = E.fixtureA(seed)
  assert.deepEqual(fixture.hr, seed.hr); assert.deepEqual(fixture.cms, seed.cms)
  assert.equal(fixture.crm.sequence, 4); assert.equal(fixture.crm.activity.length, 3)
  assert.equal(Object.hasOwn(fixture.crm, 'mergeHistory'), false)
  assert.deepEqual(fixture.crm.tasks.map(row => row.status), ['done', 'done'])
  assert.deepEqual(fixture.crm.opportunities.map(row => row.stage), ['won', 'proposal', 'lost'])
  assert.deepEqual(E.fixtureA(seed, { collision: true }).crm.leads.map(row => row.email), ['source@harbor.invalid', 'retained@harbor.invalid'])
  assert.deepEqual(E.fixtureA(seed, { open: true }).crm.tasks.map(row => row.status), ['open', 'open'])
})
test('literal contact result keeps the target full fields and changes only two declared linked rows', () => {
  const fixture = E.fixtureA(seed), result = E.contactA(fixture), change = result.crm.activity[0].mergeChange
  assert.deepEqual(result.crm.contacts.map(row => row.id), ['contact-jordan', 'contact-0001', 'contact-0002'])
  assert.deepEqual(result.crm.contacts[2], fixture.crm.contacts[3]); assert.deepEqual(result.crm.tasks, fixture.crm.tasks)
  assert.deepEqual(result.crm.companies, fixture.crm.companies); assert.equal(result.crm.leads[0].companyName, fixture.crm.leads[0].companyName)
  assert.equal(result.crm.leads[0].email, 'retained@harbor.invalid'); assert.equal(result.crm.opportunities[0].stage, 'won')
  assert.equal(result.crm.sequence, 5); assert.deepEqual(result.crm.activity.slice(1), fixture.crm.activity)
  assert.deepEqual(change.context.companies.map(row => row.id), ['company-0001', 'company-harbor'])
  assert.deepEqual(change.context.tasks.map(row => row.id), ['task-0003', 'task-harbor'])
  assert.deepEqual(change.changes.contacts, []); assert.equal(E.counts.contact.reviewRecords, 9)
  assert.deepEqual(result.crm.mergeHistory.baseline, { kind: 'legacy-at-first-merge', ...fixture.crm })
  assert.deepEqual(result.crm.mergeHistory.steps, [{ receipt: 'MOCK-CRM-0004', actor: { id: 'crm-owner', role: 'owner' }, command: E.selections.contact }])
})
test('literal company result preserves unrelated text and closed/done state with complete same-owner captures', () => {
  const fixture = E.fixtureA(seed), result = E.companyA(fixture), change = result.crm.activity[0].mergeChange
  assert.deepEqual(result.crm.companies.map(row => row.id), ['company-orbit', 'company-0001', 'company-0002'])
  assert.deepEqual(result.crm.tasks, fixture.crm.tasks); assert.deepEqual(result.crm.leads[1], fixture.crm.leads[1])
  assert.equal(result.crm.opportunities[0].contactId, 'contact-avery'); assert.equal(result.crm.leads[0].email, 'source@harbor.invalid')
  assert.deepEqual(change.changes.contacts.map(row => row.before.id), ['contact-0001', 'contact-avery'])
  assert.equal(E.counts.company.reviewRecords, 11); assert.equal(E.companyWarnings.length, 3)
})
test('opposite merge chronology keeps distinct complete captures while reaching the same active graph', () => {
  const fixture = E.fixtureA(seed), contactFirst = E.companyAfterContact(E.contactA(fixture)), companyFirst = E.contactA(E.companyA(fixture))
  for (const table of ['companies', 'contacts', 'leads', 'opportunities', 'tasks']) assert.deepEqual(contactFirst.crm[table], companyFirst.crm[table])
  assert.notDeepEqual(contactFirst.crm.activity, companyFirst.crm.activity)
  assert.deepEqual(contactFirst.crm.activity.map(row => row.receipt), ['MOCK-CRM-0005', 'MOCK-CRM-0004', 'MOCK-CRM-0003', 'MOCK-CRM-0002', 'MOCK-CRM-0001'])
  assert.equal(E.counts.companyAfterContact.reviewRecords, 10); assert.equal(E.counts.contactAfterCompany.reviewRecords, 8)
})
test('literal later retirement and ordinary actions preserve earlier full receipts and generate only declared future IDs', () => {
  const initial = E.contactA(E.fixtureA(seed, { open: true })), old = structuredClone(initial.crm.activity)
  let ordinary = initial
  for (const stage of ['advance', 'complete', 'contact', 'opportunity', 'task']) ordinary = E.ordinaryAfterContact(ordinary, stage)
  assert.equal(ordinary.crm.sequence, 10); assert.equal(ordinary.crm.mergeHistory.steps.length, 6)
  assert.deepEqual(ordinary.crm.activity.slice(5), old)
  assert.deepEqual(ordinary.crm.contacts.at(-1), { id: 'contact-0007', name: 'After Merge Contact', email: 'after@harbor.invalid', companyId: 'company-0001', ownerId: 'sales-riley' })
  assert.equal(ordinary.crm.opportunities.at(-1).amountCents, 123456); assert.equal(ordinary.crm.tasks.at(-1).id, 'task-0009')
  const chain = E.laterContact(E.contactA(E.fixtureA(seed)))
  assert.deepEqual(chain.crm.contacts.map(row => row.id), ['contact-jordan', 'contact-0001'])
  assert.equal(chain.crm.leads[0].email, 'other@harbor.invalid'); assert.equal(chain.crm.activity[0].mergeChange.source.id, 'contact-0002')
})
test('literal transfer chronology has exact four-record and five-record membership with historical merge owner kept', () => {
  const transferred = E.transferredTarget(E.fixtureA(seed)), merged = E.samContact(transferred), returned = E.returnedTarget(merged)
  assert.equal(transferred.crm.sequence, 5); assert.equal(merged.crm.sequence, 6); assert.equal(returned.crm.sequence, 7)
  assert.deepEqual(merged.crm.mergeHistory.baseline, { kind: 'legacy-at-first-merge', ...transferred.crm })
  assert.deepEqual(returned.crm.activity.slice(1), merged.crm.activity)
  assert.equal(returned.crm.activity[1].mergeChange.commonOwnerId, 'sales-sam')
  assert.equal(returned.crm.leads[1].ownerId, 'sales-sam'); assert.equal(returned.crm.companies[1].ownerId, 'sales-sam')
  assert.deepEqual(returned.crm.activity[0].ownershipChange.affected.opportunities, ['opportunity-orbit', 'opportunity-0003'])
})
test('paging and malformed inputs are literal finite variants with no imported application oracle', () => {
  assert.equal(E.pagingFixture(seed).crm.companies.length, 44); assert.equal(E.pagingFixture(seed, { members: true }).crm.companies.length, 53)
  assert.equal(E.closureFixture(seed, 200).crm.tasks.length, 193); assert.equal(E.closureFixture(seed, 201).crm.tasks.length, 194)
  const legacy = E.legacyActivityBoundary(seed), grown = E.legacyBeyondMergeBoundary(legacy)
  assert.equal(legacy.crm.activity.length, 10000); assert.equal(grown.crm.activity.length, 10001); assert.equal(grown.crm.sequence, 10002)
  assert.equal(Object.hasOwn(grown.crm, 'mergeHistory'), false); assert.deepEqual(grown.crm.activity.slice(1), legacy.crm.activity)
  assert.ok(JSON.stringify({ schemaVersion: 1, module: 'crm', data: grown.crm }).length < 2000000)
  const cases = new Map(E.malformedImports(seed)); assert.equal(cases.size, 16)
  assert.equal(cases.get('future-generated-id').mergeHistory.baseline.contacts[2].id, 'contact-0099')
  assert.equal(cases.get('final-record').opportunities[0].amountCents, 250001)
  const source = readFileSync(new URL('./crm-merge-expected.mjs', import.meta.url), 'utf8')
  assert.equal(/from ['"][^'"]*src\//.test(source), false)
  assert.equal(/buildCrmMerge|deriveCrmMerge|transitionCrm|loadMockModel|isCrmState/.test(source), false)
})
test('whole-witness geometry rejects offscreen headings even if three interior samples happen to fit', () => {
  assert.throws(() => assertCrmWitnessBounds({ x: -85, y: 40, width: 560, height: 35 }, 390), /complete status witness/)
  assert.doesNotThrow(() => assertCrmWitnessBounds({ x: 46, y: 40, width: 298, height: 76 }, 390))
  assert.equal(Object.values(crmMergeStatusInventory).reduce((sum, values) => sum + Object.keys(values).length, 0), 24)
  assert.deepEqual(Object.keys(crmMergeStatusFamilies), ['report', 'preview', 'history', 'recovery'])
})
test('selected restore and Undo compare complete pre-state and immutable earlier history instead of trusting counts', () => {
  const old = { id: 'old-point', createdAt: '2026-10-15T12:00:00.000Z', kind: 'restore', modules: ['hr', 'cms', 'crm'], states: seed }
  const previous = E.contactA(E.fixtureA(seed)).crm
  const point = { id: 'next-point', createdAt: '2026-10-15T12:01:00.000Z', kind: 'restore', modules: ['crm'], states: { crm: previous } }
  const before = JSON.stringify({ schemaVersion: 1, points: [old] }), after = JSON.stringify({ schemaVersion: 1, points: [point, old] })
  assert.equal(assertCrmHistoryAppend(before, after, { kind: 'restore', crm: previous }).id, 'next-point')
  assert.throws(() => assertCrmHistoryAppend(before, after, { kind: 'restore', crm: seed.crm }), /complete independently/)
  const tampered = JSON.parse(after); tampered.points[1].states.crm.sequence = 99
  assert.throws(() => assertCrmHistoryAppend(before, JSON.stringify(tampered), { kind: 'restore', crm: previous }), /prior full history/)
})
