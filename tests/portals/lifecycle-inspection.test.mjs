import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMockModel } from '../browser/model-loader.mjs'

const { inspectWorkspaces, compareWorkspaces } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const all = ['hr', 'cms', 'crm']
const clone = value => structuredClone(value)
const marker = 'PRIVATE lifecycle title body reason text'
const oldEmail = 'private-before@example.invalid'
const newEmail = 'private-after@example.invalid'
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const row = (report, module, key) => report.modules.find(item => item.module === module).collections.find(item => item.key === key)
const rows = (report, module) => report.modules.find(item => item.module === module).collections
const extensionKey = key => key.startsWith('workflow.lifecycle.') || key === 'preview.selectedManager' || key.startsWith('releaseBundles') || key.startsWith('activity.ownershipChange')
const extensionCounts = (report, module) => Object.fromEntries(rows(report, module).filter(item => extensionKey(item.key)).map(item => [item.key, [item.kind, item.count]]))
const changes = (report, module) => Object.fromEntries(rows(report, module).filter(item => item.added + item.removed + item.changed).map(item => [item.key, [item.added, item.removed, item.changed]]))
const snapshot = (status = 'active') => ({ status, department: marker, jobTitle: marker, managerId: 'employee-001' })
const publication = receipt => ({ revision: 1, receipt, title: marker, slug: 'private-publication-route', body: marker })
const approval = receipt => ({ revision: 1, reviewerId: 'cms-reviewer', receipt })
const owner = { role: 'employer-owner' }
const self = { role: 'employee', employeeId: 'employee-002' }

// Literal captured shapes exercise the inspection boundary independently of
// transition generators and domain authorization/validation tests. Nested ID
// references deliberately need not describe a currently active domain graph.
function captured() {
  const states = clone(seed)
  const old = { id: 'employment-employee-002-1', employeeId: 'employee-002', startDate: null, endDate: '2026-10-01', initial: snapshot(), current: snapshot('terminated'), templateVersion: 'sample-v1', tasks: [{ id: 'profile', title: marker }, { id: 'policy', title: marker }], archivedOnboarding: { profileReviewed: true, jobReviewed: true, stage: 'complete', tasks: { policy: true, profile: true }, receipt: 'OLD-ONBOARDING-1' } }
  states.hr.workflow.lifecycle = {
    schemaVersion: 1, simulationDate: '2026-10-15', sequence: 6, selectedTemplateVersion: 'sample-v2',
    instances: [
      { id: 'employment-employee-001-1', employeeId: 'employee-001', startDate: null, endDate: null, initial: snapshot(), current: snapshot(), templateVersion: 'sample-v1', tasks: [{ id: 'intro', title: marker }] },
      old,
      { id: 'employment-employee-003-1', employeeId: 'employee-003', startDate: null, endDate: null, initial: snapshot('onboarding'), current: snapshot('onboarding'), templateVersion: 'sample-v1', tasks: [{ id: 'profile', title: marker }] },
      { id: 'employment-employee-002-2', employeeId: 'employee-002', previousInstanceId: old.id, startDate: '2026-10-02', endDate: null, initial: snapshot('onboarding'), current: snapshot('onboarding'), templateVersion: 'sample-v2', tasks: [{ id: 'profile', title: marker }, { id: 'policy', title: marker }, { id: 'security', title: marker }] },
    ],
    activeInstances: { 'employee-001': 'employment-employee-001-1', 'employee-002': 'employment-employee-002-2', 'employee-003': 'employment-employee-003-1' },
    events: [
      { id: 'lifecycle-1', sequence: 1, kind: 'terminate', employeeId: 'employee-002', instanceId: old.id, effectiveDate: '2026-10-01', actor: owner, reason: marker, previous: snapshot(), proposed: snapshot('terminated') },
      { id: 'lifecycle-2', sequence: 2, kind: 'rehire', employeeId: 'employee-002', instanceId: 'employment-employee-002-2', effectiveDate: '2026-10-02', actor: owner, reason: marker, previous: null, proposed: snapshot('onboarding') },
    ],
    directoryHistory: [{ id: 'directory-4', sequence: 4, employeeId: 'employee-002', field: 'workEmail', oldValue: oldEmail, newValue: newEmail, actor: owner, origin: 'correction', correctionId: 'correction-3' }],
    corrections: [{ id: 'correction-3', sequence: 3, employeeId: 'employee-002', instanceId: 'employment-employee-002-2', field: 'workEmail', oldValue: oldEmail, proposedValue: newEmail, actor: self, status: 'accepted', outcome: { sequence: 5, actor: owner, reason: marker } }],
    offboardingAssignments: ['asset', 'access', 'handover'].map(kind => ({ id: `lifecycle-1-${kind}`, employeeId: 'employee-002', instanceId: old.id, transitionId: 'lifecycle-1', kind, title: marker, status: 'assigned' })),
  }
  states.hr.selectedManager = 'employee-001'
  states.hr.operations.records.tasks.push(...['asset', 'access', 'handover'].map(kind => ({ id: `lifecycle-1-${kind}`, employeeId: 'employee-002', employmentInstanceId: old.id, sourceId: `lifecycle-1-${kind}`, lifecycleTransitionId: 'lifecycle-1', offboardingKind: kind, title: marker, status: 'pending' })))
  states.cms.releaseBundles = [{ id: 'cms-release-0001', name: marker, status: 'activated', createdBy: 'cms-publisher', preparedAtSequence: 0, members: [
    { entryId: 'cms-page-001', collectionId: 'pages', authorId: 'cms-author', revision: 1, title: marker, slug: 'private-page-route', body: marker, approval: approval('CMS-REVIEW-1'), previousPublication: publication('CMS-PRIOR-1') },
    { entryId: 'cms-article-001', collectionId: 'articles', authorId: 'cms-author', revision: 1, title: marker, slug: 'private-article-route', body: marker, approval: approval('CMS-REVIEW-2'), previousPublication: null },
  ], activatedAtSequence: 2, activatedPublications: [{ entryId: 'cms-page-001', publication: publication('CMS-ACTIVATE-1') }, { entryId: 'cms-article-001', publication: publication('CMS-ACTIVATE-2') }] }]
  states.crm.activity = [{ receipt: 'CRM-TRANSFER-1', ownerId: 'sales-sam', action: 'transfer-account', description: marker, ownershipChange: {
    actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'company-harbor',
    affected: { companies: ['company-harbor'], contacts: ['contact-avery', 'contact-other'], leads: ['lead-jules'], opportunities: ['opportunity-harbor', 'opportunity-other'], tasks: ['task-harbor', 'task-other'] },
  } }]
  return clone(states)
}

// Expectations are literal; the manifest is not used to generate its own oracle.
const hrExtensions = {
  'workflow.lifecycle.instances': ['primary', 4], 'workflow.lifecycle.instances.initial': ['nested', 4], 'workflow.lifecycle.instances.current': ['nested', 4],
  'workflow.lifecycle.instances.tasks': ['nested', 7], 'workflow.lifecycle.instances.archivedOnboarding': ['nested', 1], 'workflow.lifecycle.instances.archivedOnboarding.tasks': ['nested', 2],
  'workflow.lifecycle.activeInstances': ['nested', 3], 'workflow.lifecycle.events': ['primary', 2], 'workflow.lifecycle.events.previous': ['nested', 1], 'workflow.lifecycle.events.proposed': ['nested', 2],
  'workflow.lifecycle.directoryHistory': ['primary', 1], 'workflow.lifecycle.corrections': ['primary', 1], 'workflow.lifecycle.corrections.outcome': ['nested', 1],
  'workflow.lifecycle.offboardingAssignments': ['primary', 3], 'workflow.lifecycle.metadata': ['metadata', 4], 'preview.selectedManager': ['metadata', 1],
}
const cmsExtensions = {
  releaseBundles: ['primary', 1], 'releaseBundles.members': ['nested', 2], 'releaseBundles.members.approval': ['nested', 2],
  'releaseBundles.members.previousPublication': ['nested', 1], 'releaseBundles.activatedPublications': ['nested', 2], 'releaseBundles.metadata': ['metadata', 1],
}
const crmExtensions = {
  'activity.ownershipChange': ['nested', 1], 'activity.ownershipChange.affected.companies': ['nested', 1], 'activity.ownershipChange.affected.contacts': ['nested', 2],
  'activity.ownershipChange.affected.leads': ['nested', 1], 'activity.ownershipChange.affected.opportunities': ['nested', 2], 'activity.ownershipChange.affected.tasks': ['nested', 2],
}
function assertPrivate(value) { assert.doesNotMatch(JSON.stringify(value), /PRIVATE lifecycle|private-before@|private-after@|private-.*route|fingerprint|department|jobTitle|oldValue|newValue|proposedValue|reason|description|\"body\"|\"title\"/) }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

test('legacy absence preserves the exact pre-extension inspection and comparison reports and source bytes', () => {
  const source = freeze(clone(seed)); const bytes = JSON.stringify(source)
  // Recorded from the helper before this extension, not recalculated from expected code.
  assert.equal(digest(inspectWorkspaces(source, all)), 'a25f693114389cd54db404f1bdfb9de00eab4e70159d94c3de94185ccf6c21dd')
  assert.equal(digest(compareWorkspaces(source, source, all)), '1e73a0979d83028abcecc5df3c98290143c53bc346bced3205cf767ea404ecc8')
  assert.equal(JSON.stringify(source), bytes)
  assert.equal(Object.hasOwn(source.hr.workflow, 'lifecycle'), false)
  assert.equal(Object.hasOwn(source.hr, 'selectedManager'), false)
  assert.equal(Object.hasOwn(source.cms, 'releaseBundles'), false)
})

test('every optional durable collection has literal kinds, counts and stable identities without primary double counting', () => {
  const report = inspectWorkspaces(captured(), all)
  assert.deepEqual(extensionCounts(report, 'hr'), hrExtensions)
  assert.deepEqual(extensionCounts(report, 'cms'), cmsExtensions)
  assert.deepEqual(extensionCounts(report, 'crm'), crmExtensions)
  assert.deepEqual(report.modules.map(module => [module.module, module.primaryRecordCount]), [['hr', 49], ['cms', 3], ['crm', 10]])
  assert.deepEqual(row(report, 'hr', 'workflow.lifecycle.instances.archivedOnboarding.tasks').identifiers, ['employment-employee-002-1 / policy', 'employment-employee-002-1 / profile'])
  assert.deepEqual(row(report, 'hr', 'workflow.lifecycle.corrections.outcome').identifiers, ['correction-3'])
  assert.deepEqual(row(report, 'cms', 'releaseBundles.members').identifiers, ['cms-release-0001 / cms-article-001', 'cms-release-0001 / cms-page-001'])
  assert.deepEqual(row(report, 'crm', 'activity.ownershipChange.affected.tasks').identifiers, ['CRM-TRANSFER-1 / task-harbor', 'CRM-TRANSFER-1 / task-other'])
  assertPrivate(report)
})

test('optional collection union reports literal additions and removals in both directions', () => {
  const target = captured(); const forward = compareWorkspaces(seed, target, all); const reverse = compareWorkspaces(target, seed, all)
  assert.deepEqual(forward.modules.map(module => [module.module, module.added, module.removed, module.changed]), [['hr', 14, 0, 0], ['cms', 1, 0, 0], ['crm', 1, 0, 0]])
  assert.deepEqual(reverse.modules.map(module => [module.module, module.added, module.removed, module.changed]), [['hr', 0, 14, 0], ['cms', 0, 1, 0], ['crm', 0, 1, 0]])
  for (const [module, expected] of [['hr', hrExtensions], ['cms', cmsExtensions], ['crm', crmExtensions]]) {
    for (const [key, [kind, count]] of Object.entries(expected)) {
      const added = row(forward, module, key); const removed = row(reverse, module, key)
      assert.deepEqual([added.kind, added.beforeCount, added.afterCount, added.added, added.removed, added.changed], [kind, 0, count, count, 0, 0], key)
      assert.deepEqual([removed.kind, removed.beforeCount, removed.afterCount, removed.added, removed.removed, removed.changed], [kind, count, 0, 0, count, 0], key)
      assert.deepEqual(added.identifiers.added, removed.identifiers.removed, key)
    }
    assert.deepEqual(rows(forward, module).map(item => item.key), rows(reverse, module).map(item => item.key))
  }
  assertPrivate(forward); assertPrivate(reverse)
})

test('present empty extensions and selected-manager-only snapshots retain explicit presence and scalar differences', () => {
  const onlyManager = clone(seed); onlyManager.hr.selectedManager = 'employee-001'
  const empty = clone(seed)
  empty.hr.workflow.lifecycle = { schemaVersion: 1, simulationDate: null, sequence: 1, selectedTemplateVersion: 'sample-v1', instances: [], activeInstances: {}, events: [], directoryHistory: [], corrections: [], offboardingAssignments: [] }
  empty.cms.releaseBundles = []
  const forward = compareWorkspaces(onlyManager, empty, ['hr', 'cms']); const reverse = compareWorkspaces(empty, onlyManager, ['hr', 'cms'])
  assert.deepEqual(changes(forward, 'hr'), { 'preview.selectedManager': [0, 1, 0], 'workflow.lifecycle.metadata': [4, 0, 0] })
  assert.deepEqual(changes(forward, 'cms'), { 'releaseBundles.metadata': [1, 0, 0] })
  for (const report of [forward, reverse]) {
    assert.deepEqual(report.modules.map(module => [module.added, module.removed, module.changed, module.hasChanges]), [[0, 0, 0, true], [0, 0, 0, true]])
  }
  assert.deepEqual(rows(forward, 'hr').map(item => item.key), rows(reverse, 'hr').map(item => item.key))
  const changed = clone(empty); Object.assign(changed.hr.workflow.lifecycle, { simulationDate: '2026-10-16', sequence: 2, selectedTemplateVersion: 'sample-v2' })
  assert.deepEqual(row(compareWorkspaces(empty, changed, ['hr']), 'hr', 'workflow.lifecycle.metadata').identifiers.changed, ['selectedTemplateVersion', 'sequence', 'simulationDate'])
})

test('hidden payload edits change the exact containing records and projections without returning content', () => {
  const cases = [
    ['hr', state => { state.hr.workflow.lifecycle.instances[1].initial.department += ' changed' }, { 'workflow.lifecycle.instances': [0, 0, 1], 'workflow.lifecycle.instances.initial': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.instances[1].current.jobTitle += ' changed' }, { 'workflow.lifecycle.instances': [0, 0, 1], 'workflow.lifecycle.instances.current': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.instances[1].tasks[0].title += ' changed' }, { 'workflow.lifecycle.instances': [0, 0, 1], 'workflow.lifecycle.instances.tasks': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.instances[1].archivedOnboarding.tasks.profile = false }, { 'workflow.lifecycle.instances': [0, 0, 1], 'workflow.lifecycle.instances.archivedOnboarding': [0, 0, 1], 'workflow.lifecycle.instances.archivedOnboarding.tasks': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.events[0].reason += ' changed' }, { 'workflow.lifecycle.events': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.events[0].previous.department += ' changed' }, { 'workflow.lifecycle.events': [0, 0, 1], 'workflow.lifecycle.events.previous': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.events[0].proposed.jobTitle += ' changed' }, { 'workflow.lifecycle.events': [0, 0, 1], 'workflow.lifecycle.events.proposed': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.directoryHistory[0].newValue = 'private-third@example.invalid' }, { 'workflow.lifecycle.directoryHistory': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.corrections[0].proposedValue = 'private-third@example.invalid' }, { 'workflow.lifecycle.corrections': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.corrections[0].outcome.reason += ' changed' }, { 'workflow.lifecycle.corrections': [0, 0, 1], 'workflow.lifecycle.corrections.outcome': [0, 0, 1] }],
    ['hr', state => { state.hr.workflow.lifecycle.offboardingAssignments[0].title += ' changed' }, { 'workflow.lifecycle.offboardingAssignments': [0, 0, 1] }],
    ['cms', state => { state.cms.releaseBundles[0].name += ' changed' }, { releaseBundles: [0, 0, 1] }],
    ['cms', state => { state.cms.releaseBundles[0].members[0].body += ' changed' }, { releaseBundles: [0, 0, 1], 'releaseBundles.members': [0, 0, 1] }],
    ['cms', state => { state.cms.releaseBundles[0].members[0].approval.receipt = 'CMS-REVIEW-CHANGED' }, { releaseBundles: [0, 0, 1], 'releaseBundles.members': [0, 0, 1], 'releaseBundles.members.approval': [0, 0, 1] }],
    ['cms', state => { state.cms.releaseBundles[0].members[0].previousPublication.body += ' changed' }, { releaseBundles: [0, 0, 1], 'releaseBundles.members': [0, 0, 1], 'releaseBundles.members.previousPublication': [0, 0, 1] }],
    ['cms', state => { state.cms.releaseBundles[0].activatedPublications[0].publication.body += ' changed' }, { releaseBundles: [0, 0, 1], 'releaseBundles.activatedPublications': [0, 0, 1] }],
    ['crm', state => { state.crm.activity[0].description += ' changed' }, { activity: [0, 0, 1] }],
    ['crm', state => { state.crm.activity[0].ownershipChange.actorId = 'sales-manager' }, { activity: [0, 0, 1], 'activity.ownershipChange': [0, 0, 1] }],
    ['crm', state => { state.crm.activity[0].ownershipChange.affected.futureMetadata = { private: marker } }, { activity: [0, 0, 1], 'activity.ownershipChange': [0, 0, 1] }],
  ]
  for (const [module, mutate, expected] of cases) {
    const source = captured(); const target = clone(source); mutate(target)
    const report = compareWorkspaces(source, target, [module])
    assert.deepEqual(changes(report, module), expected)
    assert.equal(report.modules[0].added + report.modules[0].removed, 0)
    assertPrivate(report)
    assert.doesNotMatch(JSON.stringify(report), /private-third@/)
  }
})

test('archived checklist and offboarding task links remain distinct from active onboarding and captured assignments', () => {
  const current = captured(); const target = clone(current)
  target.hr.workflow.lifecycle.instances[1].archivedOnboarding.tasks.profile = false
  target.hr.operations.records.tasks.find(task => task.id === 'lifecycle-1-asset').status = 'completed'
  target.hr.operations.records.tasks.find(task => task.id === 'lifecycle-1-access').employmentInstanceId = 'employment-employee-002-2'
  target.hr.workflow.lifecycle.activeInstances['employee-002'] = 'employment-employee-002-1'
  const report = compareWorkspaces(current, target, ['hr'])
  assert.deepEqual(changes(report, 'hr'), { 'operations.records.tasks': [0, 0, 2], 'workflow.lifecycle.activeInstances': [0, 0, 1], 'workflow.lifecycle.instances': [0, 0, 1], 'workflow.lifecycle.instances.archivedOnboarding': [0, 0, 1], 'workflow.lifecycle.instances.archivedOnboarding.tasks': [0, 0, 1] })
  assert.equal(row(report, 'hr', 'workflow.onboarding').changed, 0)
  assert.equal(row(report, 'hr', 'workflow.lifecycle.offboardingAssignments').changed, 0)
  assert.deepEqual(row(report, 'hr', 'operations.records.tasks').recordDetails.changed.map(item => [item.identifier, item.after.employmentInstanceId, item.after.assignmentStatus]), [['lifecycle-1-access', 'employment-employee-002-2', 'pending'], ['lifecycle-1-asset', 'employment-employee-002-1', 'completed']])
  assert.equal(report.modules[0].changed, 3)
  assertPrivate(report)
})

test('release members, prior publications and activation captures have independent literal directional differences', () => {
  const current = captured(); const target = clone(current); const bundle = target.cms.releaseBundles[0]
  bundle.members[0].previousPublication = null; bundle.activatedPublications = null; bundle.activatedAtSequence = null; bundle.status = 'draft'
  const report = compareWorkspaces(current, target, ['cms'])
  assert.deepEqual(changes(report, 'cms'), { releaseBundles: [0, 0, 1], 'releaseBundles.activatedPublications': [0, 2, 0], 'releaseBundles.members': [0, 0, 1], 'releaseBundles.members.previousPublication': [0, 1, 0] })
  assert.equal(report.modules[0].changed, 1)
  assert.deepEqual(row(report, 'cms', 'releaseBundles').recordDetails.changed[0].after, { workflowStatus: 'draft', createdBy: 'cms-publisher', preparedAtSequence: 0, activatedAtSequence: null, memberCount: 2, activatedPublicationCount: 0 })
  assert.deepEqual(row(report, 'cms', 'releaseBundles.members.previousPublication').recordDetails.removed[0], { identifier: 'cms-release-0001 / cms-page-001', before: { publicationRevision: 1, publicationReceiptId: 'CMS-PRIOR-1' }, after: null })
  assert.equal(Object.hasOwn(row(report, 'cms', 'releaseBundles.members').recordDetails.changed[0], 'projections'), false)
  assert.deepEqual(row(report, 'cms', 'entries').recordDetails, { added: [], removed: [], changed: [] })
  assertPrivate(report)
})

test('same-count ownership changes detect exact affected ID sets without inventing primary records', () => {
  const current = captured(); const target = clone(current)
  target.crm.companies[0].ownerId = 'sales-sam'
  target.crm.activity[0].ownershipChange.affected.contacts[1] = 'contact-replacement'
  const report = compareWorkspaces(current, target, ['crm'])
  assert.deepEqual(changes(report, 'crm'), { companies: [0, 0, 1], activity: [0, 0, 1], 'activity.ownershipChange': [0, 0, 1], 'activity.ownershipChange.affected.contacts': [1, 1, 0] })
  assert.deepEqual([report.modules[0].added, report.modules[0].removed, report.modules[0].changed], [0, 0, 2])
  assert.deepEqual(row(report, 'crm', 'activity').recordDetails.changed[0].after, { actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'company-harbor', affectedCompanies: 1, affectedContacts: 2, affectedLeads: 1, affectedOpportunities: 2, affectedTasks: 2 })
  assert.deepEqual(row(report, 'crm', 'activity.ownershipChange.affected.contacts').identifiers, { added: ['CRM-TRANSFER-1 / contact-replacement'], removed: ['CRM-TRANSFER-1 / contact-other'], changed: [] })
  assertPrivate(report)
})

test('mixed legacy and extended activities or tasks distinguish unannotated records from absent records', () => {
  const current = captured()
  current.crm.activity.push({ receipt: 'CRM-LEGACY-1', ownerId: 'sales-riley', action: marker, description: marker })
  const target = clone(current)
  target.crm.activity[1].description += ' changed'
  target.hr.operations.records.tasks[0].title = marker
  const report = compareWorkspaces(current, target, ['hr', 'crm'])
  assert.deepEqual(row(report, 'crm', 'activity').recordDetails.changed, [{ identifier: 'CRM-LEGACY-1', before: {}, after: {} }])
  assert.deepEqual(row(report, 'hr', 'operations.records.tasks').recordDetails.changed, [{ identifier: current.hr.operations.records.tasks[0].id, before: {}, after: {} }])
  const removed = clone(target); removed.crm.activity = removed.crm.activity.filter(activity => activity.receipt !== 'CRM-LEGACY-1')
  assert.deepEqual(row(compareWorkspaces(current, removed, ['crm']), 'crm', 'activity').recordDetails.removed, [{ identifier: 'CRM-LEGACY-1', before: {}, after: null }])
  assertPrivate(report)
})

test('all new identified collection orders are semantically invariant, including parent payloads', () => {
  const source = captured(); const target = clone(source); const lifecycle = target.hr.workflow.lifecycle
  lifecycle.instances.reverse(); lifecycle.instances.forEach(instance => instance.tasks.reverse()); lifecycle.events.reverse(); lifecycle.offboardingAssignments.reverse()
  lifecycle.activeInstances = Object.fromEntries(Object.entries(lifecycle.activeInstances).reverse())
  target.cms.releaseBundles.reverse(); target.cms.releaseBundles[0].members.reverse(); target.cms.releaseBundles[0].activatedPublications.reverse()
  Object.values(target.crm.activity[0].ownershipChange.affected).forEach(ids => ids.reverse())
  target.hr.operations.records.tasks.reverse()
  const report = compareWorkspaces(source, target, all)
  assert.deepEqual(report.modules.map(module => [module.added, module.removed, module.changed, module.hasChanges]), [[0, 0, 0, false], [0, 0, 0, false], [0, 0, 0, false]])
  assert.deepEqual(inspectWorkspaces(source, all), inspectWorkspaces(target, all))
})

test('new collection totals, record details and nested ID links obey the same explicit output bounds', () => {
  const current = captured(); const target = clone(current)
  const template = target.hr.workflow.lifecycle.instances[0]
  target.hr.workflow.lifecycle.instances = Array.from({ length: 25 }, (_, index) => ({ ...clone(template), id: `employment-bound-${String(index).padStart(2, '0')}` }))
  target.cms.releaseBundles = Array.from({ length: 25 }, (_, index) => ({ ...clone(target.cms.releaseBundles[0]), id: `cms-release-bound-${String(index).padStart(2, '0')}` }))
  target.crm.activity[0].ownershipChange.affected.contacts = Array.from({ length: 25 }, (_, index) => `contact-bound-${String(index).padStart(2, '0')}`)
  const inventory = inspectWorkspaces(target, all, { identifierLimit: 2 }); const report = compareWorkspaces(current, target, all, { identifierLimit: 2 })
  assert.deepEqual([row(inventory, 'hr', 'workflow.lifecycle.instances').count, row(inventory, 'hr', 'workflow.lifecycle.instances').omittedIdentifiers], [25, 23])
  assert.deepEqual([row(inventory, 'cms', 'releaseBundles.members').count, row(inventory, 'cms', 'releaseBundles.members').omittedIdentifiers], [50, 48])
  assert.deepEqual([row(inventory, 'crm', 'activity.ownershipChange.affected.contacts').count, row(inventory, 'crm', 'activity.ownershipChange.affected.contacts').omittedIdentifiers], [25, 23])
  assert.deepEqual([row(report, 'hr', 'workflow.lifecycle.instances').added, row(report, 'hr', 'workflow.lifecycle.instances').removed, row(report, 'hr', 'workflow.lifecycle.instances').omittedIdentifiers.added], [25, 4, 23])
  assert.deepEqual([row(report, 'cms', 'releaseBundles').added, row(report, 'cms', 'releaseBundles').omittedIdentifiers.added, row(report, 'cms', 'releaseBundles').recordDetails.added.length], [25, 23, 2])
  for (const module of report.modules) for (const item of module.collections) for (const kind of ['added', 'removed', 'changed']) {
    assert.ok(item.identifiers[kind].length <= 2)
    if (item.recordDetails) assert.ok(item.recordDetails[kind].length <= 2)
  }
  const changed = clone(target); changed.hr.workflow.lifecycle.instances.forEach(instance => { instance.initial.department += ' changed' }); changed.cms.releaseBundles.forEach(bundle => { bundle.name += ' changed' })
  const changedReport = compareWorkspaces(target, changed, ['hr', 'cms'], { identifierLimit: 2 })
  assert.deepEqual([row(changedReport, 'hr', 'workflow.lifecycle.instances').changed, row(changedReport, 'hr', 'workflow.lifecycle.instances').omittedIdentifiers.changed, row(changedReport, 'hr', 'workflow.lifecycle.instances').recordDetails.changed.length], [25, 23, 2])
  assert.deepEqual([row(changedReport, 'cms', 'releaseBundles').changed, row(changedReport, 'cms', 'releaseBundles').omittedIdentifiers.changed], [25, 23])
  assertPrivate(report); assertPrivate(changedReport)
})

test('duplicate identities in new primary, nested, activation and ownership-reference collections refuse', () => {
  const duplicates = [
    state => state.hr.workflow.lifecycle.instances.push(clone(state.hr.workflow.lifecycle.instances[0])),
    state => state.hr.workflow.lifecycle.instances[0].tasks.push(clone(state.hr.workflow.lifecycle.instances[0].tasks[0])),
    state => state.hr.workflow.lifecycle.events.push(clone(state.hr.workflow.lifecycle.events[0])),
    state => state.hr.workflow.lifecycle.directoryHistory.push(clone(state.hr.workflow.lifecycle.directoryHistory[0])),
    state => state.hr.workflow.lifecycle.corrections.push(clone(state.hr.workflow.lifecycle.corrections[0])),
    state => state.hr.workflow.lifecycle.offboardingAssignments.push(clone(state.hr.workflow.lifecycle.offboardingAssignments[0])),
    state => state.cms.releaseBundles.push(clone(state.cms.releaseBundles[0])),
    state => state.cms.releaseBundles[0].members.push(clone(state.cms.releaseBundles[0].members[0])),
    state => state.cms.releaseBundles[0].activatedPublications.push(clone(state.cms.releaseBundles[0].activatedPublications[0])),
    state => state.crm.activity[0].ownershipChange.affected.tasks.push('task-harbor'),
  ]
  for (const mutate of duplicates) {
    const source = captured(); mutate(source); const bytes = JSON.stringify(source)
    assert.throws(() => inspectWorkspaces(source, all), /Workspace inspection unavailable: duplicate identity in/)
    assert.throws(() => compareWorkspaces(seed, source, all), /Workspace inspection unavailable: duplicate identity in/)
    assert.equal(JSON.stringify(source), bytes)
  }
})

test('unsafe new IDs, metadata and malformed optional fields fail closed without exposing values or executing accessors', () => {
  const invalid = [
    state => { state.hr.workflow.lifecycle = undefined }, state => { state.cms.releaseBundles = undefined },
    state => { state.hr.workflow.lifecycle.schemaVersion = 2 },
    state => { state.hr.selectedManager = oldEmail }, state => { state.hr.workflow.lifecycle.instances[0].id = oldEmail },
    state => { state.hr.workflow.lifecycle.instances[0].current.managerId = newEmail }, state => { state.hr.workflow.lifecycle.instances[0].current.status = marker },
    state => { state.hr.workflow.lifecycle.instances[0].startDate = '2026-02-30' }, state => { state.hr.workflow.lifecycle.events[0].actor.role = marker },
    state => { state.hr.workflow.lifecycle.instances[1].archivedOnboarding.tasks.profile = marker },
    state => { state.hr.workflow.lifecycle.corrections[0].outcome.sequence = -1 }, state => { state.cms.releaseBundles[0].members[0].approval.receipt = oldEmail },
    state => { state.crm.activity[0].ownershipChange.fromOwnerId = oldEmail }, state => { state.crm.activity[0].ownershipChange.affected.contacts = [oldEmail] },
  ]
  for (const mutate of invalid) {
    const source = captured(); mutate(source)
    assert.throws(() => inspectWorkspaces(source, all), error => { assertPrivate(error.message); return /Workspace inspection unavailable/.test(error.message) })
  }
  let invoked = false; const source = captured()
  Object.defineProperty(source.hr.workflow.lifecycle.instances[0], 'tasks', { enumerable: true, get() { invoked = true; throw new Error(marker) } })
  assert.throws(() => inspectWorkspaces(source, ['hr']), /accessor or hidden property/)
  assert.equal(invoked, false)
})

test('new record annotations are detached from deeply frozen source payloads and never retain free text', () => {
  const source = freeze(captured()); const target = freeze(clone(seed)); const before = JSON.stringify(source); const after = JSON.stringify(target)
  const inventory = inspectWorkspaces(source, all); const report = compareWorkspaces(target, source, all)
  row(report, 'hr', 'workflow.lifecycle.instances').recordDetails.added[0].after.employeeId = 'caller-only'
  row(report, 'cms', 'releaseBundles.members').recordDetails.added[0].after.approvalReceiptId = 'caller-only'
  row(report, 'crm', 'activity').recordDetails.added[0].after.fromOwnerId = 'caller-only'
  row(inventory, 'hr', 'workflow.lifecycle.instances').identifiers.push('caller-only')
  assert.equal(JSON.stringify(source), before); assert.equal(JSON.stringify(target), after)
  assert.doesNotMatch(JSON.stringify(compareWorkspaces(target, source, all)), /caller-only/)
  assertPrivate(inventory); assertPrivate(report)
})

test('new safe metadata renders human-readable labels while captured free text remains absent', async () => {
  const helper = await readFile(new URL('../../src/portals/workspace-inspection.ts', import.meta.url), 'utf8')
  const helperJs = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`
  const source = await readFile(new URL('../../src/portals/WorkspaceInspection.tsx', import.meta.url), 'utf8')
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
  compiled = compiled.replaceAll("'./workspace-inspection'", `'${helperUrl}'`).replaceAll('"./workspace-inspection"', `"${helperUrl}"`).replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  const { WorkspaceDifferencePreview } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const html = renderToStaticMarkup(createElement(WorkspaceDifferencePreview, { current: seed, target: captured(), modules: all, title: 'Lifecycle inspection test' }))
  for (const label of ['Employee ID', 'Previous employment instance ID', 'Start date', 'Captured template version', 'Lifecycle event kind', 'Correction request status', 'Offboarding assignment kind', 'Source assignment ID', 'Prepared at sequence', 'Activated publication count', 'Author ID', 'Previous owner ID', 'Affected task ID references']) assert.ok(html.includes(label), label)
  assert.match(html, /role="region" aria-label="Lifecycle inspection test"/)
  assert.doesNotMatch(html, /<dt[^>]*><\/dt>|PRIVATE lifecycle|private-before@|private-after@|private-.*route|onClick|textarea|type="submit"/)
})
