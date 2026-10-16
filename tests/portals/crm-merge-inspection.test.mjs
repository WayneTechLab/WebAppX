import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { inspectWorkspaces, compareWorkspaces } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const clone = value => structuredClone(value)
const marker = 'PRIVATE merge name description title'
const email = 'private-merge@fixture.invalid'
const receipt = 'MOCK-CRM-0002'
const row = (report, key) => report.modules.find(value => value.module === 'crm').collections.find(value => value.key === key)
const extensionRows = report => report.modules.find(value => value.module === 'crm').collections.filter(value => value.key.startsWith('activity.mergeChange') || value.key.startsWith('mergeHistory.'))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const privateAbsent = value => assert.doesNotMatch(JSON.stringify(value), /PRIVATE|fixture\.invalid|"name"|"email"|"description"|"amountCents"|"title"|fingerprint|"command"|"record"/)

// Handwritten captured facts test the defensive inspection boundary, never
// claim domain/replay validity, and never derive expected records from a reducer.
function captured() {
  const states = clone(seed), crm = states.crm
  const source = { id: 'contact-source', name: marker, email, companyId: 'company-harbor', ownerId: 'sales-riley' }
  const retained = { ...clone(crm.contacts[0]), name: marker, email: 'retained@fixture.invalid' }
  const opportunityBefore = { ...clone(crm.opportunities[0]), contactId: source.id, title: marker }
  const opportunityAfter = { ...clone(opportunityBefore), contactId: retained.id }
  const leadBefore = { ...clone(crm.leads[0]), name: marker, email, companyName: marker, status: 'converted', companyId: source.companyId, contactId: source.id, opportunityId: opportunityBefore.id }
  const leadAfter = { ...clone(leadBefore), email: retained.email, contactId: retained.id }
  const oldActivity = { receipt: 'MOCK-CRM-0001', ownerId: 'sales-riley', action: 'create-contact', description: marker }
  const baseline = { kind: 'legacy-at-first-merge', ...clone(crm), contacts: [retained, clone(crm.contacts[1]), source], leads: [leadBefore, clone(crm.leads[1])], opportunities: [opportunityBefore, clone(crm.opportunities[1])], activity: [clone(oldActivity)], sequence: 2 }
  const change = {
    schemaVersion: 1, kind: 'contact', actorId: 'crm-owner', sourceId: source.id, retainedId: retained.id, commonOwnerId: 'sales-riley', fieldPolicy: 'retain-target-v1',
    source: clone(source), retained: clone(retained), changes: { contacts: [], leads: [{ before: clone(leadBefore), after: clone(leadAfter) }], opportunities: [{ before: clone(opportunityBefore), after: clone(opportunityAfter) }] },
    context: { companies: [{ ...clone(crm.companies[0]), name: marker }], contacts: [], leads: [], opportunities: [], tasks: [{ ...clone(crm.tasks[0]), title: marker }] },
  }
  Object.assign(crm, { contacts: [clone(retained), clone(crm.contacts[1])], leads: [leadAfter, clone(crm.leads[1])], opportunities: [opportunityAfter, clone(crm.opportunities[1])],
    activity: [{ receipt, ownerId: 'sales-riley', action: 'merge-contact', description: marker, mergeChange: change }, oldActivity], sequence: 3,
    mergeHistory: { schemaVersion: 1, baseline, steps: [{ receipt, actor: { id: 'crm-owner', role: 'owner' }, command: { kind: 'contact', sourceId: source.id, retainedId: retained.id, fieldPolicy: 'retain-target-v1' } }] },
  })
  return states
}
function companyCaptured() {
  const states = captured(), change = states.crm.activity[0].mergeChange
  change.kind = 'company'; change.sourceId = 'company-source'; change.retainedId = 'company-harbor'
  change.source = { id: change.sourceId, name: marker, ownerId: 'sales-riley' }
  change.retained = { id: change.retainedId, name: marker, ownerId: 'sales-riley' }
  change.changes.contacts = [{ before: { ...clone(states.crm.contacts[0]), companyId: change.sourceId }, after: clone(states.crm.contacts[0]) }]
  states.crm.activity[0].action = 'merge-company'
  states.crm.mergeHistory.steps[0].command = { kind: 'company', sourceId: change.sourceId, retainedId: change.retainedId, fieldPolicy: 'retain-target-v1' }
  return states
}
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value) } return value }

test('merge absence preserves exact legacy report hashes and never creates optional history', () => {
  const state = frozen(clone(seed)), before = JSON.stringify(state)
  assert.equal(digest(inspectWorkspaces(state, ['hr', 'cms', 'crm'])), 'a25f693114389cd54db404f1bdfb9de00eab4e70159d94c3de94185ccf6c21dd')
  assert.equal(digest(compareWorkspaces(state, state, ['hr', 'cms', 'crm'])), '1e73a0979d83028abcecc5df3c98290143c53bc346bced3205cf767ea404ecc8')
  assert.equal(JSON.stringify(state), before)
  assert.equal(Object.hasOwn(state.crm, 'mergeHistory'), false)
})

test('literal capture, pair, context and history counts never inflate primary active records', () => {
  const states = frozen(captured()), before = JSON.stringify(states), report = inspectWorkspaces(states, ['crm'])
  assert.equal(report.modules[0].primaryRecordCount, 11)
  assert.deepEqual(extensionRows(report).map(value => [value.key, value.kind, value.count]), [
    ['activity.mergeChange', 'nested', 1], ['activity.mergeChange.captures', 'nested', 2], ['activity.mergeChange.changes', 'nested', 2], ['activity.mergeChange.context', 'nested', 2],
    ['mergeHistory.presence', 'metadata', 1], ['mergeHistory.baseline', 'metadata', 1], ['mergeHistory.steps', 'metadata', 1],
  ])
  assert.deepEqual(row(report, 'activity.mergeChange.captures').identifiers, [`${receipt} / retained / contact / contact-avery`, `${receipt} / source / contact / contact-source`])
  assert.deepEqual(row(report, 'activity.mergeChange.changes').identifiers, [`${receipt} / lead / lead-jules`, `${receipt} / opportunity / opportunity-harbor`])
  assert.deepEqual(row(report, 'activity.mergeChange.context').identifiers, [`${receipt} / company / company-harbor`, `${receipt} / task / task-harbor`])
  assert.equal(row(report, 'activity').count, 2)
  assert.equal(JSON.stringify(states), before)
  privateAbsent(report)
})

test('adding and removing history use symmetric collection order and safe literal metadata', () => {
  const states = captured(), baseline = { ...clone(seed), crm: clone(states.crm.mergeHistory.baseline) }; delete baseline.crm.kind
  const forward = compareWorkspaces(baseline, states, ['crm']), reverse = compareWorkspaces(states, baseline, ['crm'])
  assert.deepEqual(extensionRows(forward).map(value => value.key), extensionRows(reverse).map(value => value.key))
  assert.deepEqual([forward.modules[0].added, forward.modules[0].removed, forward.modules[0].changed], [1, 1, 2])
  assert.deepEqual([reverse.modules[0].added, reverse.modules[0].removed, reverse.modules[0].changed], [1, 1, 2])
  assert.deepEqual(row(forward, 'mergeHistory.baseline').recordDetails.added[0], { identifier: 'baseline', before: null, after: { boundaryKind: 'legacy-at-first-merge', sequence: 2, companyCount: 2, contactCount: 3, leadCount: 2, opportunityCount: 2, taskCount: 1, activityCount: 1 } })
  assert.deepEqual(row(reverse, 'mergeHistory.baseline').recordDetails.removed[0].after, null)
  assert.deepEqual(row(forward, 'mergeHistory.steps').recordDetails.added[0].after, { receiptId: receipt, actorId: 'crm-owner', actorRole: 'owner', commandKind: 'merge-contact', sourceId: 'contact-source', retainedId: 'contact-avery', fieldPolicy: 'retain-target-v1' })
  privateAbsent(forward); privateAbsent(reverse)
})

test('company captures use typed identities and expose no retained/source field contents', () => {
  const states = companyCaptured(), old = clone(states); delete old.crm.mergeHistory; delete old.crm.activity[0].mergeChange
  const report = compareWorkspaces(old, states, ['crm'])
  assert.deepEqual(row(report, 'activity.mergeChange.captures').identifiers.added, [`${receipt} / retained / company / company-harbor`, `${receipt} / source / company / company-source`])
  assert.deepEqual(row(report, 'activity.mergeChange.changes').recordDetails.added.find(value => value.identifier.endsWith('contact-avery')).after, { receiptId: receipt, recordKind: 'contact', recordId: 'contact-avery', ownerId: 'sales-riley' })
  privateAbsent(report)
})

test('same-count private captured values, baseline fields and old descriptions remain detectable without disclosure', () => {
  const source = captured(), target = clone(source)
  target.crm.activity[0].mergeChange.source.email = 'changed@fixture.invalid'
  target.crm.activity[0].mergeChange.changes.opportunities[0].before.amountCents += 123
  target.crm.activity[0].mergeChange.context.tasks[0].title += ' changed'
  target.crm.mergeHistory.baseline.contacts[0].email = 'baseline-changed@fixture.invalid'
  target.crm.mergeHistory.baseline.activity[0].description += ' changed'
  const before = JSON.stringify([source, target]), report = compareWorkspaces(source, target, ['crm'])
  assert.deepEqual([row(report, 'activity.mergeChange.captures').changed, row(report, 'activity.mergeChange.changes').changed, row(report, 'activity.mergeChange.context').changed], [1, 1, 1])
  assert.deepEqual([row(report, 'mergeHistory.presence').changed, row(report, 'mergeHistory.baseline').changed], [1, 1])
  assert.equal(row(report, 'activity').changed, 1)
  assert.equal(JSON.stringify([source, target]), before)
  privateAbsent(report)
})

test('ordered journal and baseline array changes are visible despite stable displayed identities', () => {
  const source = captured()
  source.crm.mergeHistory.steps.push({ receipt: 'MOCK-CRM-0003', actor: { id: 'sales-riley', role: 'sales-rep' }, command: { type: 'create-company', name: marker } })
  const reordered = clone(source); reordered.crm.mergeHistory.steps.reverse(); reordered.crm.mergeHistory.baseline.contacts.reverse()
  const report = compareWorkspaces(source, reordered, ['crm'])
  assert.equal(row(report, 'mergeHistory.presence').changed, 1)
  assert.equal(row(report, 'mergeHistory.baseline').changed, 1)
  assert.deepEqual([row(report, 'mergeHistory.steps').changed, row(report, 'mergeHistory.steps').added, row(report, 'mergeHistory.steps').removed, row(report, 'mergeHistory.steps').unchanged], [0, 0, 0, 2])
  const target = clone(source); target.crm.mergeHistory.steps[1].command.name += ' changed'
  const changed = compareWorkspaces(source, target, ['crm'])
  assert.equal(row(changed, 'mergeHistory.steps').changed, 1)
  assert.equal(row(changed, 'mergeHistory.presence').changed, 1)
  assert.deepEqual(row(changed, 'mergeHistory.steps').recordDetails.changed[0].before, row(changed, 'mergeHistory.steps').recordDetails.changed[0].after)
  privateAbsent(report); privateAbsent(changed)
})

test('explicit omission versus present metadata contributes to hidden comparisons', () => {
  const source = captured(), target = clone(source)
  target.crm.mergeHistory.baseline.companies[0].recordedNote = ''
  const report = compareWorkspaces(source, target, ['crm'])
  assert.equal(row(report, 'mergeHistory.baseline').changed, 1)
  assert.equal(row(report, 'mergeHistory.presence').changed, 1)
  assert.equal(row(report, 'mergeHistory.steps').changed, 0)
  privateAbsent(report)
})

test('bounded identifiers and metadata details retain exact omitted counts', () => {
  const source = captured(), target = clone(source)
  target.crm.activity[0].mergeChange.context.tasks = Array.from({ length: 25 }, (_, index) => ({ ...clone(source.crm.tasks[0]), id: `task-bound-${String(index).padStart(2, '0')}`, title: marker }))
  const inspection = inspectWorkspaces(target, ['crm'], { identifierLimit: 2 })
  assert.deepEqual([row(inspection, 'activity.mergeChange.context').count, row(inspection, 'activity.mergeChange.context').identifiers.length, row(inspection, 'activity.mergeChange.context').omittedIdentifiers], [26, 2, 24])
  const report = compareWorkspaces(source, target, ['crm'], { identifierLimit: 2 })
  assert.deepEqual([row(report, 'activity.mergeChange.context').added, row(report, 'activity.mergeChange.context').recordDetails.added.length, row(report, 'activity.mergeChange.context').omittedIdentifiers.added], [25, 2, 23])
  privateAbsent(inspection); privateAbsent(report)
})

test('malformed and duplicate new shapes fail closed with safe errors', () => {
  const edits = [
    state => { state.crm.mergeHistory = undefined }, state => { state.crm.mergeHistory = null }, state => { state.crm.mergeHistory = {} },
    state => { state.crm.mergeHistory.schemaVersion = 2 }, state => { state.crm.mergeHistory.extra = marker }, state => { state.crm.mergeHistory.steps = [] },
    state => { state.crm.mergeHistory.baseline.kind = marker }, state => { state.crm.mergeHistory.baseline.contacts.push(clone(state.crm.mergeHistory.baseline.contacts[0])) },
    state => { state.crm.mergeHistory.steps.push(clone(state.crm.mergeHistory.steps[0])) }, state => { state.crm.mergeHistory.steps[0].actor.role = marker },
    state => { state.crm.mergeHistory.steps[0].actor.id = email }, state => { state.crm.mergeHistory.steps[0].command.kind = marker },
    state => { state.crm.activity[0].mergeChange.schemaVersion = 2 }, state => { state.crm.activity[0].mergeChange.context.extra = [] },
    state => { state.crm.activity[0].mergeChange.changes.leads[0].after.id = 'lead-other' },
    state => { state.crm.activity[0].mergeChange.context.tasks.push(clone(state.crm.activity[0].mergeChange.context.tasks[0])) },
    state => { state.crm.activity[0].mergeChange.changes.leads.push(clone(state.crm.activity[0].mergeChange.changes.leads[0])) },
  ]
  for (const edit of edits) { const state = captured(); edit(state); assert.throws(() => inspectWorkspaces(state, ['crm']), error => { privateAbsent(error.message); return /Workspace inspection unavailable/.test(error.message) }) }
})

test('descriptor validation precedes extraction and unselected CRM is not inspected', () => {
  const state = captured(); let reads = 0
  Object.defineProperty(state.crm.mergeHistory.baseline.contacts[0], 'name', { enumerable: true, get() { reads++; throw new Error(marker) } })
  assert.throws(() => inspectWorkspaces(state, ['crm']), /accessor or hidden property/)
  assert.equal(reads, 0)
  assert.deepEqual(inspectWorkspaces(state, ['hr', 'cms']), inspectWorkspaces(seed, ['hr', 'cms']))
})

test('four-part identities are confined to merge captures and preserve the existing legacy composite bound', () => {
  assert.ok(row(inspectWorkspaces(captured(), ['crm']), 'activity.mergeChange.captures').identifiers.every(value => value.split(' / ').length === 4))
  const state = clone(seed); state.hr.completed.push('legacy:four:part:flag')
  assert.throws(() => inspectWorkspaces(state, ['hr']), /invalid composite identifier/)
})

test('finite journal and merge inventories refuse excess without truncating primary totals or mutating sources', () => {
  const state = captured()
  state.crm.mergeHistory.steps = Array.from({ length: 1000 }, (_, index) => ({ receipt: `MOCK-CRM-${String(index + 2).padStart(4, '0')}`, actor: { id: 'sales-riley', role: 'sales-rep' }, command: { type: 'create-company', name: marker } }))
  const before = JSON.stringify(state), report = inspectWorkspaces(state, ['crm'], { identifierLimit: 1 })
  assert.deepEqual([row(report, 'mergeHistory.steps').count, row(report, 'mergeHistory.steps').identifiers.length, row(report, 'mergeHistory.steps').omittedIdentifiers], [1000, 1, 999])
  assert.equal(report.modules[0].primaryRecordCount, 11)
  assert.equal(JSON.stringify(state), before)
  state.crm.mergeHistory.steps.push({ receipt: 'MOCK-CRM-1002', actor: { id: 'sales-riley', role: 'sales-rep' }, command: { type: 'create-company', name: marker } })
  assert.throws(() => inspectWorkspaces(state, ['crm']), /invalid CRM merge history metadata/)
  const over = captured(), merge = over.crm.activity[0]
  over.crm.activity = Array.from({ length: 101 }, (_, index) => ({ ...clone(merge), receipt: `MOCK-CRM-${String(index + 2).padStart(4, '0')}` }))
  assert.throws(() => inspectWorkspaces(over, ['crm']), /invalid CRM merge history presence/)
  privateAbsent(report)
})
