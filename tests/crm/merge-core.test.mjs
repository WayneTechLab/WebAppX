import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import { loadMockModel } from '../browser/model-loader.mjs'
import { fixture } from './merge-fixture.mjs'
const { buildCrmMergeCandidate: build } = await loadMockModel(new URL('../../src/crm/merge.ts', import.meta.url))
const { isCrmState } = await loadMockModel(new URL('../../src/crm/persistence.ts', import.meta.url))
const { canonicalCrmMergeJson, assertCrmMergeActor } = await loadMockModel(new URL('../../src/crm/merge-value.ts', import.meta.url))
const clone = value => structuredClone(value)
const owner = { id: 'crm-owner', role: 'owner', label: 'Display text is not authority' }
const riley = { id: 'sales-riley', role: 'sales-rep', label: 'Riley' }
const selection = { kind: 'contact', sourceId: 'contact-avery', retainedId: 'contact-0002', fieldPolicy: 'retain-target-v1' }
// Independently written accepted legacy boundary. Its arbitrary old descriptions
// deliberately make no claim to reconstructing old commands/actors.
function expectedContact(before) {
  const receipt = `MOCK-CRM-${String(before.sequence).padStart(4, '0')}`
  const source = clone(before.contacts[0]), retained = clone(before.contacts[2])
  const opportunity0 = { ...before.opportunities[0], companyId: 'company-0001', contactId: 'contact-0002' }
  const opportunity3 = { ...before.opportunities[3], companyId: 'company-0001', contactId: 'contact-0002' }
  const lead3 = { ...before.leads[2], companyId: 'company-0001', contactId: 'contact-0002', email: 'retained@target.invalid' }
  const change = { schemaVersion: 1, kind: 'contact', actorId: 'crm-owner', sourceId: 'contact-avery', retainedId: 'contact-0002', commonOwnerId: 'sales-riley', fieldPolicy: 'retain-target-v1', source, retained,
    changes: { contacts: [], leads: [{ before: clone(before.leads[2]), after: lead3 }], opportunities: [{ before: clone(before.opportunities[3]), after: opportunity3 }, { before: clone(before.opportunities[0]), after: opportunity0 }] },
    context: { companies: [clone(before.companies[2]), clone(before.companies[0])], contacts: [], leads: [], opportunities: [clone(before.opportunities[2])], tasks: [clone(before.tasks[1]), clone(before.tasks[2]), clone(before.tasks[0])] } }
  const next = clone(before)
  next.contacts.splice(0, 1); next.leads[2] = lead3; next.opportunities[0] = opportunity0; next.opportunities[3] = opportunity3
  next.activity.unshift({ receipt, ownerId: 'sales-riley', action: 'merge-contact', description: 'Merged sample contact contact-avery into contact-0002; retained target fields and redirected 3 linked records.', mergeChange: change })
  next.sequence = before.sequence + 1
  next.mergeHistory = { schemaVersion: 1, baseline: { kind: 'legacy-at-first-merge', ...clone(before) }, steps: [{ receipt, actor: { id: 'crm-owner', role: 'owner' }, command: clone(selection) }] }
  return next
}
test('actual neutral modules form a semantically valid TypeScript program', () => {
  const files = ['types', 'merge-types', 'merge-value', 'legacy-validation', 'kernel', 'merge-history', 'persistence', 'merge'].map(name => fileURLToPath(new URL(`../../src/crm/${name}.ts`, import.meta.url)))
  const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true, noEmit: true })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
})
test('contact merge has one independently authored complete result, exact captures and no source mutation', () => {
  const before = fixture(), bytes = JSON.stringify(before)
  assert.equal(isCrmState(before), true)
  const result = build(before, owner, selection)
  assert.deepEqual(result.next, expectedContact(before))
  assert.equal(isCrmState(result.next), true)
  assert.equal(JSON.stringify(before), bytes)
  assert.deepEqual(result.preview.counts, { retired: 1, retained: 1, changed: { contacts: 0, leads: 1, opportunities: 2 }, context: { companies: 2, contacts: 0, leads: 0, opportunities: 1, tasks: 3 }, reviewRecords: 11 })
  assert.equal(result.preview.finalEnvelopeCharacters, JSON.stringify({ schemaVersion: 1, module: 'crm', data: result.next }).length)
  assert.equal(Object.hasOwn(result.preview, 'next'), false)
  assert.equal(Object.hasOwn(result.preview, 'mergeHistory'), false)
})
test('company merge retains exact target, moves all statuses, names only explicit conflicts and leaves name-only leads exact', () => {
  const before = fixture()
  before.companies.push({ id: 'company-0003', name: 'Target   Studio', ownerId: 'sales-riley' })
  before.contacts.push({ id: 'contact-0003', name: 'Avery   Fiction', email: 'another@harbor.invalid', companyId: 'company-harbor', ownerId: 'sales-riley' })
  const bytes = JSON.stringify(before)
  const request = { ...selection, kind: 'company', sourceId: 'company-harbor', retainedId: 'company-0001' }
  const result = build(before, owner, request)
  assert.deepEqual(result.next.companies, before.companies.slice(1))
  assert.deepEqual(result.next.contacts, [ { ...before.contacts[0], companyId: 'company-0001' }, before.contacts[1], before.contacts[2], { ...before.contacts[3], companyId: 'company-0001' } ])
  assert.deepEqual(result.next.opportunities, [{ ...before.opportunities[0], companyId: 'company-0001' }, before.opportunities[1], before.opportunities[2], { ...before.opportunities[3], companyId: 'company-0001' }])
  assert.deepEqual(result.next.leads, [before.leads[0], before.leads[1], { ...before.leads[2], companyId: 'company-0001' }])
  assert.deepEqual(result.next.tasks, before.tasks)
  assert.deepEqual(result.next.activity.slice(1), before.activity)
  assert.deepEqual(result.preview.warnings, [{ kind: 'company-name', normalizedName: 'target studio', companyIds: ['company-0001', 'company-0003'] }, { kind: 'contact-name', normalizedName: 'avery fiction', classification: 'mixed', members: [{ contactId: 'contact-0002', originalCompanyId: 'company-0001' }, { contactId: 'contact-0003', originalCompanyId: 'company-harbor' }, { contactId: 'contact-avery', originalCompanyId: 'company-harbor' }] }])
  assert.equal(result.preview.counts.reviewRecords, 13)
  assert.equal(isCrmState(result.next), true)
  assert.equal(JSON.stringify(before), bytes)
})
test('same-owner policy permits the owning representative/manager, refuses hidden, mixed or malformed selections atomically', () => {
  const before = fixture(), bytes = JSON.stringify(before)
  assert.equal(build(before, riley, selection).preview.commonOwnerId, 'sales-riley')
  assert.equal(build(before, { id: 'crm-manager', role: 'sales-manager' }, selection).next.sequence, 5)
  const bad = [ { ...selection, kind: 'lead' }, { ...selection, retainedId: selection.sourceId }, { ...selection, sourceId: 'missing' }, { ...selection, retainedId: 'contact-jordan' }, { ...selection, fieldPolicy: 'automatic' }, { ...selection, extra: true }, { ...selection, sourceId: ['contact-avery'] } ]
  for (const request of bad) assert.throws(() => build(before, owner, request))
  for (const actor of [{ id: 'sales-sam', role: 'sales-rep' }, { id: 'crm-auditor', role: 'auditor' }, { id: 'sales-riley', role: 'owner' }]) assert.throws(() => build(before, actor, selection))
  assert.equal(JSON.stringify(before), bytes)
})
test('actor and new optional descriptors refuse before getters; safe JSON/canonical equality never launders lossy values', () => {
  let reads = 0
  const dangerous = Object.defineProperty({}, 'contacts', { get() { reads++; return [] } })
  assert.throws(() => build(dangerous, { id: 'unknown', role: 'owner' }, selection))
  assert.equal(reads, 0)
  assert.throws(() => assertCrmMergeActor(Object.defineProperty({ role: 'owner' }, 'id', { enumerable: true, get() { reads++; return 'crm-owner' } })))
  const candidate = fixture()
  Object.defineProperty(candidate, 'mergeHistory', { enumerable: true, get() { reads++; return {} } })
  assert.equal(isCrmState(candidate), false); assert.equal(reads, 0)
  for (const value of [undefined, -0, Infinity, [,], Object.defineProperty({}, 'secret', { value: 1 }), Object.create({ inherited: 1 })]) assert.throws(() => canonicalCrmMergeJson(value))
  assert.equal(canonicalCrmMergeJson({ b: 2, a: [1, 3] }), '{"a":[1,3],"b":2}')
})
test('global converted-email collision refuses without exposing hidden labels or mutating the accepted source', () => {
  const before = fixture()
  before.leads.push({ id: 'lead-0002', name: 'Hidden Collision', email: 'retained@target.invalid', companyName: 'Private text', ownerId: 'sales-sam', status: 'new' })
  assert.equal(isCrmState(before), true)
  const bytes = JSON.stringify(before)
  assert.throws(() => build(before, riley, selection), error => error.message === 'The selected CRM records cannot be merged. No records changed.')
  assert.equal(JSON.stringify(before), bytes)
})
test('closure bound counts unchanged done tasks: exact200 succeeds and201 refuses with no partial preview', () => {
  const before = fixture()
  for (let i = 4; i <= 192; i++) before.tasks.push({ id: `task-${String(i).padStart(4, '0')}`, title: `Captured task ${i}`, ownerId: 'sales-riley', opportunityId: 'opportunity-harbor', status: 'done' })
  // Raise the honest legacy boundary; all synthetic IDs must precede it.
  before.sequence = 193; before.activity = Array.from({ length: 192 }, (_, i) => ({ receipt: `MOCK-CRM-${String(192 - i).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-task', description: 'Legacy captured task history.' }))
  assert.equal(isCrmState(before), true)
  assert.equal(build(before, owner, selection).preview.counts.reviewRecords, 200)
  before.tasks.push({ id: 'task-0192', title: 'Last duplicated ID', ownerId: 'sales-riley', opportunityId: 'opportunity-harbor', status: 'done' })
  // A distinct supported row, never invalid duplicate data to manufacture a limit.
  before.tasks.at(-1).id = 'task-0193'; before.sequence = 194; before.activity.unshift({ receipt: 'MOCK-CRM-0193', ownerId: 'sales-riley', action: 'create-task', description: 'Another legacy task.' })
  assert.equal(isCrmState(before), true)
  const bytes = JSON.stringify(before)
  assert.throws(() => build(before, owner, selection), /200-record/)
  assert.equal(JSON.stringify(before), bytes)
})

test('the exact serialized native envelope accepts 2,000,000 characters and refuses a coherent larger result before acceptance', () => {
  const before = fixture()
  before.sequence = 1801
  before.activity = Array.from({ length: 1800 }, (_, i) => ({ receipt: `MOCK-CRM-${String(1800 - i).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-company', description: 'OK' }))
  const size = value => JSON.stringify({ schemaVersion: 1, module: 'crm', data: value }).length
  let remaining = 2000000 - size(expectedContact(before))
  if (remaining % 2) { before.contacts[2].name += 'X'; remaining -= 3 }
  for (const activity of before.activity) { const length = Math.min(498, remaining / 2); activity.description += 'x'.repeat(length); remaining -= length * 2 }
  assert.equal(remaining, 0)
  assert.equal(isCrmState(before), true)
  assert.ok(size(before) < 2000000)
  const expected = expectedContact(before)
  assert.equal(size(expected), 2000000)
  const result = build(before, owner, selection)
  assert.deepEqual(result.next, expected)
  assert.equal(result.preview.finalEnvelopeCharacters, 2000000)
  const larger = clone(before); larger.contacts[2].name += 'X'
  assert.equal(size(expectedContact(larger)), 2000003)
  const bytes = JSON.stringify(larger)
  assert.throws(() => build(larger, owner, selection), error => error.code === 'limit' && /2,000,000/.test(error.message))
  assert.equal(JSON.stringify(larger), bytes)
  const incoming = clone(result.next)
  incoming.mergeHistory.baseline.activity[0].description += 'x'; incoming.activity[1].description += 'x'
  assert.equal(size(incoming), 2000002)
  assert.equal(isCrmState(incoming), false)
})
