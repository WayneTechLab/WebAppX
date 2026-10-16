import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'
import { fixture } from './merge-fixture.mjs'
const { buildCrmMergeCandidate: build } = await loadMockModel(new URL('../../src/crm/merge.ts', import.meta.url))
const { isCrmState } = await loadMockModel(new URL('../../src/crm/persistence.ts', import.meta.url))
const { applyCrmCommand } = await loadMockModel(new URL('../../src/crm/merge-history.ts', import.meta.url))
const { createCrmState, transitionCrm } = await loadMockModel(new URL('../../src/crm/model.ts', import.meta.url))
const clone = value => structuredClone(value)
const owner = { id: 'crm-owner', role: 'owner', label: 'Casey' }
const contact = { kind: 'contact', sourceId: 'contact-avery', retainedId: 'contact-0002', fieldPolicy: 'retain-target-v1' }
const company = { kind: 'company', sourceId: 'company-harbor', retainedId: 'company-0001', fieldPolicy: 'retain-target-v1' }
const change = (s, command) => applyCrmCommand(s, owner, command).state
function adopted() { return build(fixture(), owner, contact).next }
test('legacy reads and ordinary work retain absent history, new seed is unchanged and first use alone captures the boundary', () => {
  const state = fixture(), bytes = JSON.stringify(state)
  assert.equal(isCrmState(state), true); assert.equal(JSON.stringify(state), bytes)
  const next = transitionCrm(state, owner, { type: 'complete-task', taskId: 'task-harbor' })
  assert.equal(Object.hasOwn(next, 'mergeHistory'), false)
  assert.equal(Object.hasOwn(createCrmState(), 'mergeHistory'), false)
  const merged = build(next, owner, contact).next
  assert.equal(merged.mergeHistory.baseline.kind, 'legacy-at-first-merge')
  const { kind: _kind, ...baseline } = merged.mergeHistory.baseline
  assert.deepEqual(baseline, next)
  assert.deepEqual(merged.mergeHistory.steps, [{ receipt: 'MOCK-CRM-0005', actor: { id: 'crm-owner', role: 'owner' }, command: contact }])
})
test('transfer, contact/company merges, later transfer and all supported linked work replay at the actual positions', () => {
  let state = fixture()
  state = change(state, { type: 'transfer-account', companyId: 'company-harbor', newOwnerId: 'crm-manager', expectedOwnerId: 'sales-riley' })
  state = change(state, { type: 'transfer-account', companyId: 'company-0001', newOwnerId: 'crm-manager', expectedOwnerId: 'sales-riley' })
  const baseline = clone(state)
  state = build(state, owner, contact).next
  const firstActivity = clone(state.activity[0])
  state = build(state, owner, company).next
  state = change(state, { type: 'transfer-account', companyId: 'company-0001', newOwnerId: 'crm-owner', expectedOwnerId: 'crm-manager' })
  state = transitionCrm(state, owner, { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage: 'proposal' })
  state = transitionCrm(state, owner, { type: 'complete-task', taskId: 'task-harbor' })
  state = transitionCrm(state, owner, { type: 'create-contact', companyId: 'company-0001', name: ' Future Contact ', email: 'FUTURE@TARGET.INVALID' })
  state = transitionCrm(state, owner, { type: 'create-opportunity', companyId: 'company-0001', contactId: 'contact-0011', title: 'Future opportunity', amountCents: 175025 })
  state = transitionCrm(state, owner, { type: 'create-task', opportunityId: 'opportunity-0012', title: 'Later follow-up' })
  state = build(state, owner, { ...contact, sourceId: 'contact-0002', retainedId: 'contact-0011' }).next
  assert.equal(state.sequence, 15)
  assert.deepEqual(state.mergeHistory.steps.map(step => step.receipt), ['MOCK-CRM-0006', 'MOCK-CRM-0007', 'MOCK-CRM-0008', 'MOCK-CRM-0009', 'MOCK-CRM-0010', 'MOCK-CRM-0011', 'MOCK-CRM-0012', 'MOCK-CRM-0013', 'MOCK-CRM-0014'])
  assert.deepEqual(state.mergeHistory.steps[5].command, { type: 'create-contact', name: 'Future Contact', email: 'future@target.invalid', companyId: 'company-0001' })
  assert.deepEqual(state.activity.slice(9), baseline.activity)
  assert.deepEqual(state.activity.find(a => a.receipt === 'MOCK-CRM-0006'), firstActivity)
  assert.deepEqual(state.contacts.map(c => c.id), ['contact-jordan', 'contact-0011'])
  assert.equal(state.leads.find(l => l.id === 'lead-0003').email, 'future@target.invalid')
  assert.equal(state.leads.find(l => l.id === 'lead-0003').contactId, 'contact-0011')
  assert.equal(state.opportunities.find(o => o.id === 'opportunity-harbor').stage, 'proposal')
  assert.equal(state.tasks.find(t => t.id === 'task-harbor').status, 'done')
  assert.equal(isCrmState(state), true)
  assert.equal(isCrmState(JSON.parse(JSON.stringify(state))), true)
  const bytes = JSON.stringify(state)
  assert.throws(() => build(state, owner, contact))
  assert.throws(() => build(state, owner, { ...company, sourceId: 'company-harbor' }))
  assert.equal(JSON.stringify(state), bytes)
})
test('company before contact and later ordinary stage/task work retain old captures despite changed live links', () => {
  let state = build(fixture(), owner, company).next
  const captured = clone(state.activity[0])
  state = build(state, owner, contact).next
  state = transitionCrm(state, owner, { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage: 'proposal' })
  state = transitionCrm(state, owner, { type: 'complete-task', taskId: 'task-harbor' })
  assert.equal(isCrmState(state), true)
  assert.deepEqual(state.activity[3], captured)
  assert.deepEqual(state.mergeHistory.steps.map(s => 'kind' in s.command ? s.command.kind : s.command.type), ['company', 'contact', 'advance-opportunity', 'complete-task'])
})
test('every omitted/extra/forged historical fact, future creation and final-state mismatch refuses without repair', () => {
  const state = adopted(), bytes = JSON.stringify(state)
  const cases = [
    s => { delete s.mergeHistory.steps[0] },
    s => { s.mergeHistory.steps.push(clone(s.mergeHistory.steps[0])) },
    s => { s.mergeHistory.steps[0].actor = { id: 'sales-riley', role: 'owner' } },
    s => { s.mergeHistory.steps[0].actor.label = 'Not a stored actor field' },
    s => { s.mergeHistory.steps[0].command.extra = true },
    s => { s.mergeHistory.steps[0].receipt = 'MOCK-CRM-0005' },
    s => { s.mergeHistory.baseline.contacts[2].id = 'contact-0500' },
    s => { s.mergeHistory.baseline.activity[0].description = 'Changed only in baseline.' },
    s => { s.activity[0].mergeChange.context.tasks.pop() },
    s => { s.activity[0].mergeChange.context.tasks.push(clone(s.activity[0].mergeChange.context.tasks[0])) },
    s => { s.activity[0].mergeChange.context.contacts.push(clone(s.contacts[0])) },
    s => { s.activity[0].mergeChange.changes.leads[0].before.ownerId = 'sales-sam' },
    s => { s.activity[0].mergeChange.changes.opportunities[0].after.amountCents++ },
    s => { s.activity[0].mergeChange.source.email = 'forged@harbor.invalid' },
    s => { s.activity[0].ownershipChange = {} },
    s => { s.contacts.push(clone(s.mergeHistory.baseline.contacts[0])) },
    s => { s.contacts[1].name = 'Changed current only' },
    s => { s.activity.reverse() },
    s => { s.mergeHistory.aliases = {} },
    s => { s.mergeHistory.baseline.mergeHistory = {} },
    s => { s.mergeHistory.steps[0].command.sourceId = 'contact-0005' },
  ]
  for (const corrupt of cases) { const candidate = clone(state); corrupt(candidate); const raw = JSON.stringify(candidate); assert.equal(isCrmState(candidate), false); assert.equal(JSON.stringify(candidate), raw) }
  assert.equal(JSON.stringify(state), bytes)
})
test('first-use provenance accepts coherent fictional legacy alternatives without claiming cryptographic past authenticity', () => {
  const state = adopted()
  state.mergeHistory.baseline.activity[0].description = 'Coherently supplied legacy narrative.'
  state.activity.at(-3).description = 'Coherently supplied legacy narrative.'
  assert.equal(isCrmState(state), true)
  const changed = fixture(); changed.contacts[0].name = 'Alternate Legacy Name'
  assert.equal(isCrmState(changed), true)
  const result = build(changed, owner, contact).next
  assert.equal(result.activity[0].mergeChange.source.name, 'Alternate Legacy Name')
  assert.equal(isCrmState(result), true)
})
test('optional presence and whole-envelope plain JSON are strict without evaluating nested accessors', () => {
  for (const bad of [undefined, null, {}, [], { schemaVersion: 2 }]) { const state = fixture(); state.mergeHistory = bad; assert.equal(isCrmState(state), false) }
  const inherited = Object.assign(Object.create({ mergeHistory: undefined }), fixture())
  assert.equal(isCrmState(inherited), false)
  let reads = 0
  const cases = [
    s => Object.defineProperty(s.contacts[0], 'name', { enumerable: true, get() { reads++; return 'Avery' } }),
    s => Object.defineProperty(s.mergeHistory.steps[0].command, 'sourceId', { enumerable: true, get() { reads++; return 'contact-avery' } }),
    s => Object.defineProperty(s.activity[0].mergeChange, 'hidden', { value: 1 }),
    s => { s.mergeHistory.steps[0].command[Symbol('hidden')] = true },
    s => { s.activity[0].mergeChange.context.tasks[0].extra = undefined },
    s => { s.activity[0].mergeChange.source.extra = -0 },
    s => { s.activity[0].mergeChange.source.extra = Infinity },
    s => { s.mergeHistory.steps[0].command.extra = s },
  ]
  for (const corrupt of cases) { const state = adopted(); corrupt(state); assert.equal(isCrmState(state), false) }
  assert.equal(reads, 0)
})
test('one journal sequence, merge count, array/node/depth and complete envelope bounds reject rather than prune', () => {
  const state = adopted()
  for (const corrupt of [s => { s.mergeHistory.steps = Array(1001).fill(s.mergeHistory.steps[0]) }, s => { s.mergeHistory.steps = Array(101).fill(s.mergeHistory.steps[0]) }, s => { s.mergeHistory.baseline.tasks = Array(10001).fill(s.mergeHistory.baseline.tasks[0]) }, s => { s.mergeHistory.steps[0].command.extra = 'x'.repeat(2000001) }, s => { let root = s; for (let i = 0; i < 101; i++) { root.extra = {}; root = root.extra } }]) { const candidate = clone(state); corrupt(candidate); assert.equal(isCrmState(candidate), false) }
  assert.equal(isCrmState(state), true)
})

test('a hand-written 1,000-step coherent journal is readable but a next ordinary acceptance refuses without pruning', () => {
  const state = adopted()
  for (let receiptNumber = 5; receiptNumber <= 1003; receiptNumber++) {
    const suffix = String(receiptNumber).padStart(4, '0'), receipt = `MOCK-CRM-${suffix}`, name = `Native journal company ${receiptNumber}`
    state.companies.push({ id: `company-${suffix}`, name, ownerId: 'crm-owner' })
    state.activity.unshift({ receipt, ownerId: 'crm-owner', action: 'create-company', description: `Created sample company ${name}.` })
    state.mergeHistory.steps.push({ receipt, actor: { id: 'crm-owner', role: 'owner' }, command: { type: 'create-company', name } })
    state.sequence++
  }
  assert.equal(state.mergeHistory.steps.length, 1000)
  assert.equal(isCrmState(state), true)
  const bytes = JSON.stringify(state)
  assert.throws(() => transitionCrm(state, owner, { type: 'create-company', name: 'One beyond journal capacity' }), error => error.code === 'limit')
  assert.equal(JSON.stringify(state), bytes)
})
test('one hundred literal contact retirements replay; the 101st merge refuses although its selected live source remains available', () => {
  const before = fixture()
  for (let n = 4; n <= 104; n++) before.contacts.push({ id: `contact-${String(n).padStart(4, '0')}`, name: `Source Contact ${n}`, email: `source${n}@harbor.invalid`, companyId: 'company-harbor', ownerId: 'sales-riley' })
  before.sequence = 105
  before.activity = Array.from({ length: 104 }, (_, i) => ({ receipt: `MOCK-CRM-${String(104 - i).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-contact', description: 'Old fictional contact capture.' }))
  assert.equal(isCrmState(before), true)
  const state = clone(before)
  state.mergeHistory = { schemaVersion: 1, baseline: { kind: 'legacy-at-first-merge', ...clone(before) }, steps: [] }
  for (let n = 4; n <= 103; n++) {
    const sourceId = `contact-${String(n).padStart(4, '0')}`, receipt = `MOCK-CRM-${String(state.sequence).padStart(4, '0')}`
    const source = state.contacts.find(row => row.id === sourceId), retained = clone(before.contacts[2])
    const mergeChange = { schemaVersion: 1, kind: 'contact', actorId: 'crm-owner', sourceId, retainedId: 'contact-0002', commonOwnerId: 'sales-riley', fieldPolicy: 'retain-target-v1', source: clone(source), retained, changes: { contacts: [], leads: [], opportunities: [] }, context: { companies: [clone(before.companies[2]), clone(before.companies[0])], contacts: [], leads: [], opportunities: [clone(before.opportunities[2])], tasks: [clone(before.tasks[1])] } }
    state.contacts = state.contacts.filter(row => row.id !== sourceId)
    state.activity.unshift({ receipt, ownerId: 'sales-riley', action: 'merge-contact', description: `Merged sample contact ${sourceId} into contact-0002; retained target fields and redirected 0 linked records.`, mergeChange })
    state.mergeHistory.steps.push({ receipt, actor: { id: 'crm-owner', role: 'owner' }, command: { ...contact, sourceId } })
    state.sequence++
  }
  assert.equal(state.mergeHistory.steps.length, 100)
  assert.equal(isCrmState(state), true)
  const bytes = JSON.stringify(state)
  assert.throws(() => build(state, owner, { ...contact, sourceId: 'contact-0104' }), error => error.code === 'limit')
  assert.equal(JSON.stringify(state), bytes)
})
test('single/combined codecs, selective restore and Undo retain complete legacy or merged branches and refuse malformed history before writes', async () => {
  const backup = await loadMockModel(new URL('../../src/portals/backup.ts', import.meta.url))
  const combined = await loadMockModel(new URL('../../src/portals/combined-backup.ts', import.meta.url))
  const workspaces = await loadMockModel(new URL('../../src/portals/workspaces.ts', import.meta.url))
  const restore = await loadMockModel(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
  const persistence = await loadMockModel(new URL('../../src/portals/persistence.ts', import.meta.url))
  const imports = await loadMockModel(new URL('../../src/portals/import-state.ts', import.meta.url))
  const merged = adopted(), exportedAt = '2026-10-15T12:00:00.000Z'
  assert.deepEqual(backup.parseDemoBackup(backup.createDemoBackup('crm', merged, isCrmState, exportedAt), 'crm', isCrmState).state, merged)
  const current = { ...workspaces.createDemoWorkspaces(), crm: fixture() }, target = { ...clone(current), crm: merged }
  assert.deepEqual(combined.parseCombinedBackup(combined.createCombinedBackup(target, exportedAt)).states, target)
  const slots = new Map(), writes = []
  const storage = { getItem: key => slots.get(key) ?? null, setItem(key, raw) { writes.push(key); slots.set(key, raw) }, removeItem: key => slots.delete(key) }
  for (const key of ['hr', 'cms', 'crm']) persistence.saveDemoState(key, current[key], storage)
  slots.set('webappx.demo.recovery-preferences', 'preserved-preference-bytes')
  const untouched = [slots.get('webappx.demo.hr'), slots.get('webappx.demo.cms'), slots.get('webappx.demo.recovery-preferences')]
  writes.length = 0
  const restored = restore.restoreWithCheckpoint(current, target, ['crm'], storage, { id: '00000000-0000-4000-8000-000000000001', createdAt: exportedAt })
  assert.equal(restored.ok, true)
  assert.deepEqual(restored.states.crm, merged)
  assert.deepEqual(writes, ['webappx.demo.restore-points', 'webappx.demo.crm'])
  const undo = restore.undoRestorePoint(restored.states, restored.point.id, storage, { id: '00000000-0000-4000-8000-000000000002', createdAt: '2026-10-15T12:01:00.000Z' })
  assert.equal(undo.ok, true); assert.deepEqual(undo.states.crm, fixture()); assert.equal(Object.hasOwn(undo.states.crm, 'mergeHistory'), false)
  assert.deepEqual([slots.get('webappx.demo.hr'), slots.get('webappx.demo.cms'), slots.get('webappx.demo.recovery-preferences')], untouched)
  const saved = [...slots], malformed = clone(merged); malformed.activity[0].mergeChange.context.tasks.pop(); writes.length = 0
  assert.equal(imports.replaceDemoState('crm', malformed, isCrmState, storage).ok, false)
  assert.equal(restore.restoreDemoWorkspaces({ ...target, crm: malformed }, ['crm'], storage).ok, false)
  assert.throws(() => combined.parseCombinedBackup(JSON.stringify({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt, workspaces: { ...target, crm: malformed } })))
  assert.deepEqual(writes, []); assert.deepEqual([...slots], saved)
})

test('post-boundary lead create, qualify, owner assignment and new-owner conversion have one literal complete result and codec replay', async () => {
  const riley = { id: 'sales-riley', role: 'sales-rep', label: 'Riley' }
  const sam = { id: 'sales-sam', role: 'sales-rep', label: 'Sam' }
  let state = adopted()
  const prior = clone(state)
  const expected = clone(prior)
  // Expected records, receipts and commands below are literal independent facts.
  // The previously separately proven first-merge result is only this test's source.
  expected.companies.push({ id: 'company-0008', name: 'Future Sales Company', ownerId: 'sales-sam' })
  expected.contacts.push({ id: 'contact-0008', name: 'New Lead', email: 'new-lead@example.invalid', companyId: 'company-0008', ownerId: 'sales-sam' })
  expected.leads.push({ id: 'lead-0005', name: 'New Lead', email: 'new-lead@example.invalid', companyName: 'Future Sales Company', ownerId: 'sales-sam', status: 'converted', companyId: 'company-0008', contactId: 'contact-0008', opportunityId: 'opportunity-0008' })
  expected.opportunities.push({ id: 'opportunity-0008', title: 'Future Sales Company · sample opportunity', companyId: 'company-0008', contactId: 'contact-0008', ownerId: 'sales-sam', amountCents: 175025, stage: 'discovery', leadId: 'lead-0005' })
  expected.activity.unshift(
    { receipt: 'MOCK-CRM-0008', ownerId: 'sales-sam', action: 'convert-lead', description: 'Converted New Lead into linked company, contact and opportunity records.' },
    { receipt: 'MOCK-CRM-0007', ownerId: 'sales-sam', action: 'assign-lead', description: 'Reassigned unconverted lead New Lead from Riley Sample to Sam Fixture.', ownershipChange: { actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'lead-0005', affected: { companies: [], contacts: [], leads: ['lead-0005'], opportunities: [], tasks: [] } } },
    { receipt: 'MOCK-CRM-0006', ownerId: 'sales-riley', action: 'qualify-lead', description: 'Qualified New Lead; conversion is now available.' },
    { receipt: 'MOCK-CRM-0005', ownerId: 'sales-riley', action: 'create-lead', description: 'Created sample lead New Lead.' },
  )
  expected.sequence = 9
  expected.mergeHistory.steps.push(
    { receipt: 'MOCK-CRM-0005', actor: { id: 'sales-riley', role: 'sales-rep' }, command: { type: 'create-lead', name: 'New Lead', email: 'new-lead@example.invalid', companyName: 'Future Sales Company' } },
    { receipt: 'MOCK-CRM-0006', actor: { id: 'sales-riley', role: 'sales-rep' }, command: { type: 'qualify-lead', leadId: 'lead-0005' } },
    { receipt: 'MOCK-CRM-0007', actor: { id: 'crm-owner', role: 'owner' }, command: { type: 'assign-lead', leadId: 'lead-0005', newOwnerId: 'sales-sam', expectedOwnerId: 'sales-riley' } },
    { receipt: 'MOCK-CRM-0008', actor: { id: 'sales-sam', role: 'sales-rep' }, command: { type: 'convert-lead', leadId: 'lead-0005', amountCents: 175025 } },
  )
  state = transitionCrm(state, riley, { type: 'create-lead', name: ' New Lead ', email: 'NEW-LEAD@EXAMPLE.INVALID', companyName: ' Future Sales Company ' })
  state = transitionCrm(state, riley, { type: 'qualify-lead', leadId: 'lead-0005' })
  state = transitionCrm(state, owner, { type: 'assign-lead', leadId: 'lead-0005', newOwnerId: 'sales-sam', expectedOwnerId: 'sales-riley' })
  state = transitionCrm(state, sam, { type: 'convert-lead', leadId: 'lead-0005', amountCents: 175025 })
  assert.deepEqual(state, expected)
  assert.deepEqual(state.activity.slice(4), prior.activity)
  assert.deepEqual(state.mergeHistory.baseline, prior.mergeHistory.baseline)
  assert.deepEqual(state.mergeHistory.steps[0], prior.mergeHistory.steps[0])
  assert.equal(isCrmState(state), true)
  const backup = await loadMockModel(new URL('../../src/portals/backup.ts', import.meta.url))
  const persistence = await loadMockModel(new URL('../../src/portals/persistence.ts', import.meta.url))
  const exportedAt = '2026-10-15T12:30:00.000Z'
  assert.deepEqual(backup.parseDemoBackup(backup.createDemoBackup('crm', state, isCrmState, exportedAt), 'crm', isCrmState).state, expected)
  const slots = new Map(), writes = []
  const storage = { getItem: key => slots.get(key) ?? null, setItem(key, raw) { writes.push(key); slots.set(key, raw) }, removeItem: key => slots.delete(key) }
  assert.equal(persistence.saveDemoState('crm', state, storage).kind, 'saved')
  assert.deepEqual(writes, ['webappx.demo.crm'])
  assert.deepEqual(persistence.loadDemoState('crm', createCrmState, isCrmState, storage).state, expected)
  assert.deepEqual(JSON.parse(slots.get('webappx.demo.crm')), { schemaVersion: 1, module: 'crm', data: expected })
})
