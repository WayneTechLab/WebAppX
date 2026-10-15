import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMockModel } from '../browser/model-loader.mjs'

const { compareWorkspaces, inspectWorkspaces, workspaceInspectionLimits } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const clone = value => structuredClone(value)
const all = ['hr', 'cms', 'crm']
const marker = 'PRIVATE-FREE-TEXT-DO-NOT-DISPLAY'
const collection = (report, module, key) => report.modules.find(item => item.module === module).collections.find(item => item.key === key)
const counts = (report, module) => Object.fromEntries(report.modules.find(item => item.module === module).collections.map(item => [item.key, item.count]))
const activity = receipt => ({ receipt, action: marker, actorRole: 'employee' })
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

// Literal counts, reviewed independently against the stored named seed. This
// list intentionally does not derive expected keys or counts from production.
const hrCounts = {
  'workflow.onboarding': 3, 'workflow.onboarding.tasks': 4, 'workflow.profileEmails': 3, 'workflow.employeeStatuses': 3,
  'workflow.timeEntries': 2, 'workflow.benefitElections': 0, 'workflow.payroll': 1, 'workflow.payrollHistory': 0,
  'workflow.payroll.inputs': 0, 'workflow.payroll.benefitInputs': 0, 'workflow.payroll.employeeTotals': 0,
  'workflow.payrollHistory.inputs': 0, 'workflow.payrollHistory.benefitInputs': 0, 'workflow.payrollHistory.employeeTotals': 0,
  'workflow.sampleRateTimelines': 0, 'workflow.sampleRates': 0,
  'operations.ptoRequests': 1, 'operations.balances': 3, 'operations.records.tasks': 3, 'operations.records.policies': 1,
  'operations.records.training': 2, 'operations.records.assets': 2, 'operations.records.documents': 3, 'operations.activity': 0,
  'serviceDesk.requests': 1, 'serviceDesk.requests.activity': 0,
  'recruiting.jobs': 1, 'recruiting.jobs.activity': 0, 'recruiting.candidates': 2, 'recruiting.candidates.activity': 0,
  'recruiting.hiredEmployees': 0, 'recruiting.hiredEmployees.onboarding': 0,
  'performance.goals': 1, 'performance.goals.activity': 0, 'performance.reviews': 2, 'performance.reviews.activity': 0,
  'surveys.surveys': 1, 'surveys.surveys.audienceIds': 3, 'surveys.surveys.questions': 1, 'surveys.surveys.responses': 0, 'surveys.surveys.activity': 0,
  'preview.completed': 0, 'preview.acknowledgements': 0, 'preview.selections': 2, 'metadata.sequences': 6,
}
const cmsCounts = { entries: 2, activity: 0, 'entries.approval': 1, 'entries.published': 1, 'metadata.sequences': 1 }
const crmCounts = { companies: 2, contacts: 2, leads: 2, opportunities: 2, tasks: 1, activity: 0, 'metadata.sequences': 1 }

function rich() {
  const states = clone(seed); const hr = states.hr
  hr.recruiting.hiredEmployees.push({ id: 'employee-004', firstName: marker, lastName: marker, workEmail: marker, department: marker, jobTitle: marker, employmentStatus: 'active', managerId: 'employee-001', payCents: 3000, onboarding: [{ id: 'profile', title: marker, status: 'pending' }, { id: 'policy', title: marker, status: 'pending' }] })
  hr.workflow.onboarding['employee-004'] = { profileReviewed: false, jobReviewed: false, stage: 'draft', tasks: { profile: false, policy: false } }
  hr.workflow.profileEmails['employee-004'] = marker; hr.workflow.employeeStatuses['employee-004'] = 'active'; hr.operations.balances['employee-004'] = { vacation: 40, sick: 24 }
  hr.workflow.benefitElections = [{ employeeId: 'employee-002', planId: 'benefit-001', election: 'enroll', stage: 'confirmed', receipt: 'BENEFIT-001' }]
  const payroll = { stage: 'submitted', receipt: 'PAYROLL-001', period: { start: '2026-10-01', end: '2026-10-15' }, inputs: [{ entryId: 'time-001', employeeId: 'employee-002', date: '2026-10-09', rateEffectiveFrom: '2026-10-01', hours: 8, rateCents: 3000 }], benefitInputs: [{ employeeId: 'employee-002', planId: 'benefit-001', deductionCents: 2500 }], employeeTotals: [{ employeeId: 'employee-002', hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 }], hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 }
  hr.workflow.payroll = clone(payroll); hr.workflow.payrollHistory = [clone(payroll)]
  hr.workflow.sampleRates = { 'employee-002': [{ effectiveFrom: '2026-09-01', hourlyRateCents: 2900 }, { effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }], 'employee-003': [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }] }
  hr.workflow.timeEntries[0].returnReason = marker; hr.workflow.timeEntries[0].returnedBy = 'employee-001'
  hr.operations.activity = [{ id: 'PEOPLE-001', receipt: 'PEOPLE-001', sequence: 1, action: marker, actor: { role: 'employee', employeeId: 'employee-002' }, module: 'tasks', recordId: 'task-001', previousStatus: 'pending', status: 'completed', description: marker }]
  hr.serviceDesk.requests[0].details = marker; hr.serviceDesk.requests[0].resolution = marker; hr.serviceDesk.requests[0].activity = [activity('REQUEST-001')]
  hr.recruiting.jobs[0].title = marker; hr.recruiting.jobs[0].activity = [activity('JOB-001')]
  hr.recruiting.candidates.forEach((candidate, index) => { candidate.workEmail = marker; candidate.activity = [activity(`CANDIDATE-00${index + 1}`)] })
  hr.performance.goals[0].title = marker; hr.performance.goals[0].activity = [activity('GOAL-001')]
  hr.performance.reviews.forEach((review, index) => { review.selfComments = marker; review.managerComments = marker; review.activity = [activity(`REVIEW-00${index + 1}`)] })
  hr.surveys.surveys[0].questions = { ratingPrompt: marker, textPrompt: marker }
  hr.surveys.surveys[0].responses = [{ employeeId: 'employee-002', rating: 4, text: marker, status: 'submitted', receipt: 'RESPONSE-001' }, { employeeId: 'employee-003', rating: 5, text: marker, status: 'draft' }]
  hr.surveys.surveys[0].activity = [activity('SURVEY-001'), activity('SURVEY-002')]
  hr.completed = ['contractor-001:intro', 'contractor-001:policy']; hr.acknowledgements = ['policy-001']
  states.cms.entries[1].approval = { revision: 1, reviewerId: 'cms-reviewer', receipt: 'CMS-REVIEW-002' }
  states.cms.entries[1].published = { title: marker, slug: 'fictional', body: marker, revision: 1, receipt: 'CMS-PUBLISH-002' }
  states.cms.entries.forEach(entry => { entry.title = marker; entry.body = marker; entry.feedback = marker })
  states.cms.activity = [{ receipt: 'CMS-ACTIVITY-002', entryId: 'cms-article-001', revision: 1, actorId: 'cms-author', action: marker }, { receipt: 'CMS-ACTIVITY-001', entryId: 'cms-page-001', revision: 1, actorId: 'cms-author', action: marker }]
  states.crm.contacts.forEach(contact => { contact.email = marker; contact.name = marker })
  states.crm.activity = [{ receipt: 'CRM-002', ownerId: 'crm-owner', action: marker, description: marker }, { receipt: 'CRM-001', ownerId: 'crm-owner', action: marker, description: marker }]
  return states
}

test('the unchanged named seed has a literal complete count breakdown and primary totals', () => {
  const report = inspectWorkspaces(seed, all)
  assert.deepEqual(counts(report, 'hr'), hrCounts)
  assert.deepEqual(counts(report, 'cms'), cmsCounts)
  assert.deepEqual(counts(report, 'crm'), crmCounts)
  assert.deepEqual(report.modules.map(item => [item.module, item.primaryRecordCount]), [['hr', 35], ['cms', 2], ['crm', 9]])
  assert.deepEqual(collection(report, 'hr', 'workflow.onboarding.tasks').identifiers, ['employee-001 / intro', 'employee-002 / policy', 'employee-002 / profile', 'employee-003 / profile'])
  assert.deepEqual(collection(report, 'cms', 'entries.published').identifiers, ['cms-page-001'])
})

test('all nested HR, CMS and CRM collections report literal nonempty captured counts without free text', () => {
  const states = rich(); const report = inspectWorkspaces(states, all)
  assert.deepEqual(counts(report, 'hr'), { ...hrCounts,
    'workflow.onboarding': 4, 'workflow.onboarding.tasks': 6, 'workflow.profileEmails': 4, 'workflow.employeeStatuses': 4,
    'workflow.benefitElections': 1, 'workflow.payrollHistory': 1,
    'workflow.payroll.inputs': 1, 'workflow.payroll.benefitInputs': 1, 'workflow.payroll.employeeTotals': 1,
    'workflow.payrollHistory.inputs': 1, 'workflow.payrollHistory.benefitInputs': 1, 'workflow.payrollHistory.employeeTotals': 1,
    'workflow.sampleRateTimelines': 2, 'workflow.sampleRates': 3, 'operations.balances': 4, 'operations.activity': 1,
    'serviceDesk.requests.activity': 1, 'recruiting.jobs.activity': 1, 'recruiting.candidates.activity': 2,
    'recruiting.hiredEmployees': 1, 'recruiting.hiredEmployees.onboarding': 2,
    'performance.goals.activity': 1, 'performance.reviews.activity': 2,
    'surveys.surveys.responses': 2, 'surveys.surveys.activity': 2, 'preview.completed': 2, 'preview.acknowledgements': 1,
  })
  assert.deepEqual(counts(report, 'cms'), { entries: 2, activity: 2, 'entries.approval': 2, 'entries.published': 2, 'metadata.sequences': 1 })
  assert.deepEqual(counts(report, 'crm'), { ...crmCounts, activity: 2 })
  assert.deepEqual(report.modules.map(item => [item.module, item.primaryRecordCount]), [['hr', 46], ['cms', 4], ['crm', 11]])
  assert.deepEqual(collection(report, 'hr', 'workflow.sampleRates').identifiers, ['employee-002 / 2026-09-01', 'employee-002 / 2026-10-01', 'employee-003 / 2026-10-01'])
  assert.deepEqual(collection(report, 'hr', 'workflow.payrollHistory.benefitInputs').identifiers, ['PAYROLL-001 / employee-002 / benefit-001'])
  assert.deepEqual(collection(report, 'hr', 'surveys.surveys.responses').identifiers, ['survey-001 / employee-002', 'survey-001 / employee-003'])
  assert.doesNotMatch(JSON.stringify(report), new RegExp(marker))
})

test('selection reads captured modules only and returns canonical module order', () => {
  const states = { cms: seed.cms, crm: seed.crm }
  Object.defineProperty(states, 'hr', { get() { throw new Error('Unselected HR must not be read') } })
  const report = inspectWorkspaces(states, ['crm', 'cms'])
  assert.deepEqual(report.modules.map(item => item.module), ['cms', 'crm'])
  assert.deepEqual(inspectWorkspaces({}, []), { schemaVersion: 1, modules: [] })
  assert.deepEqual(compareWorkspaces({}, {}, []), { schemaVersion: 1, modules: [] })
})

test('primary diff counts use identity rather than positions and distinguish hidden field changes', () => {
  const current = clone(seed); const target = clone(seed)
  target.crm.companies[0].name = marker
  target.crm.contacts[1].email = marker
  target.crm.leads = [{ ...target.crm.leads[0], status: 'qualified' }, { id: 'lead-added', name: marker, email: marker, companyName: marker, ownerId: 'sales-riley', status: 'new' }]
  target.crm.tasks = []
  const report = compareWorkspaces(current, target, ['crm'])
  assert.deepEqual(Object.fromEntries(['added', 'removed', 'changed', 'unchanged', 'hasChanges'].map(key => [key, report.modules[0][key]])), { added: 1, removed: 2, changed: 3, unchanged: 4, hasChanges: true })
  const leads = collection(report, 'crm', 'leads')
  assert.deepEqual(leads.identifiers, { added: ['lead-added'], removed: ['lead-robin'], changed: ['lead-jules'] })
  assert.deepEqual(collection(report, 'crm', 'tasks').identifiers, { added: [], removed: ['task-harbor'], changed: [] })
  assert.doesNotMatch(JSON.stringify(report), new RegExp(marker))
})

test('hidden nested fields change the complete parent and nested rows without doublecounting module totals', () => {
  const current = rich(); const target = clone(current)
  target.hr.workflow.payroll.inputs[0].date = '2026-10-10'
  target.hr.workflow.timeEntries[0].returnReason = `${marker}-changed`
  target.hr.performance.reviews[0].managerComments = `${marker}-changed`
  target.hr.surveys.surveys[0].responses[0].text = `${marker}-changed`
  const report = compareWorkspaces(current, target, ['hr'])
  assert.equal(report.modules[0].changed, 4)
  assert.equal(collection(report, 'hr', 'workflow.payroll.inputs').changed, 1)
  assert.equal(collection(report, 'hr', 'workflow.payroll').changed, 1)
  assert.equal(collection(report, 'hr', 'surveys.surveys.responses').changed, 1)
  assert.equal(collection(report, 'hr', 'surveys.surveys').changed, 1)
  assert.doesNotMatch(JSON.stringify(report), new RegExp(marker))
})

test('all stored entity fields participate in change detection without being returned', () => {
  const source = rich()
  const edits = [
    target => { target.hr.workflow.profileEmails['employee-002'] = `${marker}-new` },
    target => { target.hr.workflow.onboarding['employee-002'].tasks.profile = false },
    target => { target.hr.operations.balances['employee-002'].sick = 1 },
    target => { target.hr.operations.records.documents[0].description = marker },
    target => { target.hr.recruiting.candidates[0].firstName = marker },
    target => { target.hr.recruiting.hiredEmployees[0].onboarding[0].title = `${marker}-new` },
    target => { target.hr.workflow.sampleRates['employee-002'][1].hourlyRateCents = 3500 },
    target => { target.hr.workflow.payroll.period.end = '2026-10-14' },
  ]
  for (const edit of edits) {
    const target = clone(source); edit(target)
    const result = compareWorkspaces(source, target, ['hr'])
    assert.equal(result.modules[0].changed, 1)
    assert.doesNotMatch(JSON.stringify(result), new RegExp(marker))
  }
  const cms = clone(source); cms.cms.entries[0].published.body = `${marker}-new`
  const result = compareWorkspaces(source, cms, ['cms'])
  assert.equal(result.modules[0].changed, 1)
  assert.equal(collection(result, 'cms', 'entries.published').changed, 1)
})

test('identified top-level and nested collections plus object key order are reorder invariant', () => {
  const current = rich(); const target = clone(current)
  function reverseArrays(value) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.reverse(); value.forEach(reverseArrays) } else Object.values(value).forEach(reverseArrays)
  }
  reverseArrays(target)
  target.hr.workflow.onboarding = Object.fromEntries(Object.entries(target.hr.workflow.onboarding).reverse())
  const result = compareWorkspaces(current, target, all)
  assert.deepEqual(result.modules.map(module => [module.module, module.added, module.removed, module.changed, module.hasChanges]), [['hr', 0, 0, 0, false], ['cms', 0, 0, 0, false], ['crm', 0, 0, 0, false]])
  assert.deepEqual(inspectWorkspaces(current, all), inspectWorkspaces(target, all))
})

test('preview flags, selections and counters are metadata rather than business entity changes', () => {
  const current = clone(seed); const target = clone(seed)
  target.hr.completed = ['contractor-001:intro']; target.hr.acknowledgements = ['policy-001']; target.hr.selectedEmployee = 'employee-003'; target.hr.managementRole = 'auditor'; target.hr.workflow.sequence++
  target.cms.sequence++; target.crm.sequence++
  const report = compareWorkspaces(current, target, all)
  assert.deepEqual(report.modules.map(module => [module.module, module.added, module.removed, module.changed, module.hasChanges]), [['hr', 0, 0, 0, true], ['cms', 0, 0, 0, true], ['crm', 0, 0, 0, true]])
  assert.equal(collection(report, 'hr', 'preview.selections').changed, 2)
  assert.equal(collection(report, 'hr', 'preview.completed').added, 1)
  assert.equal(collection(report, 'hr', 'metadata.sequences').changed, 1)
  const uiOnly = clone(seed); uiOnly.cms.selectedEntry = marker; uiOnly.crm.currentTab = marker
  assert.deepEqual(compareWorkspaces(seed, uiOnly, ['cms', 'crm']).modules.map(module => module.hasChanges), [false, false])
})

test('optional rate timelines do not invent inherited rates; empty timeline containers are explicit nested data', () => {
  const current = clone(seed); const target = clone(seed)
  target.hr.workflow.sampleRates = { 'employee-002': [] }
  const report = compareWorkspaces(current, target, ['hr'])
  assert.equal(report.modules[0].added, 0)
  assert.equal(collection(report, 'hr', 'workflow.sampleRates').added, 0)
  assert.equal(collection(report, 'hr', 'workflow.sampleRateTimelines').added, 1)
  const actual = rich()
  actual.hr.workflow.sampleRates['employee-002'].pop()
  const difference = compareWorkspaces(rich(), actual, ['hr'])
  assert.deepEqual(collection(difference, 'hr', 'workflow.sampleRates').identifiers.removed, ['employee-002 / 2026-10-01'])
  assert.equal(difference.modules[0].removed, 1)
})

test('identifier display limits preserve literal totals and counts for every change category', () => {
  const current = clone(seed); const target = clone(seed)
  current.crm.leads = Array.from({ length: 12 }, (_, index) => ({ ...current.crm.leads[0], id: `old-${String(index).padStart(2, '0')}` }))
  target.crm.leads = Array.from({ length: 12 }, (_, index) => ({ ...target.crm.leads[0], id: `new-${String(index).padStart(2, '0')}` }))
  const inspected = collection(inspectWorkspaces(current, ['crm']), 'crm', 'leads')
  assert.equal(inspected.count, 12); assert.equal(inspected.identifiers.length, 8); assert.equal(inspected.omittedIdentifiers, 4)
  const diff = collection(compareWorkspaces(current, target, ['crm'], { identifierLimit: 3 }), 'crm', 'leads')
  assert.deepEqual(diff.identifiers, { added: ['new-00', 'new-01', 'new-02'], removed: ['old-00', 'old-01', 'old-02'], changed: [] })
  assert.deepEqual(diff.omittedIdentifiers, { added: 9, removed: 9, changed: 0 })
  assert.equal(diff.added, 12); assert.equal(diff.removed, 12)
})

test('duplicate identities in every nested identity strategy fail closed', () => {
  const edits = [
    target => target.hr.workflow.timeEntries.push(clone(target.hr.workflow.timeEntries[0])),
    target => target.hr.workflow.benefitElections.push(clone(target.hr.workflow.benefitElections[0])),
    target => target.hr.workflow.payroll.inputs.push(clone(target.hr.workflow.payroll.inputs[0])),
    target => target.hr.workflow.payroll.benefitInputs.push(clone(target.hr.workflow.payroll.benefitInputs[0])),
    target => target.hr.workflow.payroll.employeeTotals.push(clone(target.hr.workflow.payroll.employeeTotals[0])),
    target => target.hr.workflow.payrollHistory.push(clone(target.hr.workflow.payrollHistory[0])),
    target => target.hr.workflow.sampleRates['employee-002'].push(clone(target.hr.workflow.sampleRates['employee-002'][0])),
    target => target.hr.serviceDesk.requests[0].activity.push(clone(target.hr.serviceDesk.requests[0].activity[0])),
    target => target.hr.recruiting.hiredEmployees[0].onboarding.push(clone(target.hr.recruiting.hiredEmployees[0].onboarding[0])),
    target => target.hr.surveys.surveys[0].responses.push(clone(target.hr.surveys.surveys[0].responses[0])),
    target => target.hr.surveys.surveys[0].audienceIds.push(target.hr.surveys.surveys[0].audienceIds[0]),
    target => target.hr.completed.push(target.hr.completed[0]),
    target => target.cms.activity.push(clone(target.cms.activity[0])),
    target => target.crm.leads.push(clone(target.crm.leads[0])),
  ]
  for (const edit of edits) { const target = rich(); edit(target); assert.throws(() => inspectWorkspaces(target, all), /duplicate identity/); assert.throws(() => compareWorkspaces(rich(), target, all), /duplicate identity/) }
})

test('invalid identifiers, collection shapes, selections and unsupported JSON fail without exposing values', () => {
  const edits = [
    target => { target.hr.workflow.timeEntries[0].id = `${marker} with spaces` },
    target => { target.cms.activity[0].receipt = 'x'.repeat(201) },
    target => { target.hr.workflow.sampleRates['employee-002'][0].effectiveFrom = '2026-02-30' },
    target => { target.hr.workflow.onboarding['employee-002'].tasks.profile = 'not-a-boolean' },
    target => { target.hr.performance.reviews = null },
    target => { target.crm.sequence = Number.NaN },
    target => { target.hr.completed = ['a:b:c:d'] },
  ]
  for (const edit of edits) { const target = rich(); edit(target); assert.throws(() => inspectWorkspaces(target, all), error => /Workspace inspection unavailable/.test(error.message) && !error.message.includes(marker)) }
  for (const selected of [['hr', 'hr'], ['CMS'], ['unknown'], null]) assert.throws(() => inspectWorkspaces(seed, selected), /selected modules/)
  for (const identifierLimit of [0, -1, 1.5, 21, Infinity]) assert.throws(() => inspectWorkspaces(seed, ['cms'], { identifierLimit }), /display limit/)
  assert.throws(() => inspectWorkspaces({}, ['hr']), /absent/)
})

test('getters, cycles, functions, sparse arrays and traversal bounds refuse without executing source code', () => {
  let invoked = false
  const getter = clone(seed); Object.defineProperty(getter.cms.entries[0], 'body', { enumerable: true, get() { invoked = true; return marker } })
  assert.throws(() => inspectWorkspaces(getter, ['cms']), /accessor/); assert.equal(invoked, false)
  const cycle = clone(seed); cycle.cms.entries[0].extra = cycle.cms
  assert.throws(() => inspectWorkspaces(cycle, ['cms']), /circular/)
  const executable = clone(seed); executable.crm.contacts[0].toJSON = () => { invoked = true; return {} }
  assert.throws(() => inspectWorkspaces(executable, ['crm']), /non-JSON/); assert.equal(invoked, false)
  const sparse = clone(seed); sparse.crm.leads.length = 4
  assert.throws(() => inspectWorkspaces(sparse, ['crm']), /sparse/)
  const deep = clone(seed); let value = deep.crm
  for (let index = 0; index < 40; index++) value = value.extra = {}
  assert.throws(() => inspectWorkspaces(deep, ['crm']), /traversal limit/)
  const large = clone(seed); large.cms.entries[0].body = 'x'.repeat(workspaceInspectionLimits.characters + 1)
  assert.throws(() => inspectWorkspaces(large, ['cms']), /character limit/)
})

test('all inspections and comparisons preserve deeply frozen sources and return detached identifier data only', () => {
  const current = freeze(rich()); const target = freeze(clone(seed)); const before = JSON.stringify(current); const after = JSON.stringify(target)
  const report = inspectWorkspaces(current, all); const diff = compareWorkspaces(current, target, all)
  report.modules[0].collections[0].identifiers.push('caller-only')
  diff.modules[0].collections[0].identifiers.changed.push('caller-only')
  assert.equal(JSON.stringify(current), before); assert.equal(JSON.stringify(target), after)
  assert.equal(JSON.stringify(inspectWorkspaces(current, all)).includes('caller-only'), false)
  assert.doesNotMatch(JSON.stringify(report) + JSON.stringify(diff), /fingerprint|PRIVATE-FREE-TEXT/)
})

async function loadComponents() {
  const helper = await readFile(new URL('../../src/portals/workspace-inspection.ts', import.meta.url), 'utf8')
  const helperJs = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`
  const source = await readFile(new URL('../../src/portals/WorkspaceInspection.tsx', import.meta.url), 'utf8')
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
  compiled = compiled.replaceAll("'./workspace-inspection'", `'${helperUrl}'`).replaceAll('"./workspace-inspection"', `"${helperUrl}"`)
  compiled = compiled.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}

test('presentation exposes scoped regions, all collection counts, omission notices and no hidden free text', async () => {
  const { WorkspaceInspection, WorkspaceDifferencePreview } = await loadComponents()
  const current = rich(); const target = clone(current); target.hr.performance.reviews[0].managerComments = `${marker}-new`
  const details = renderToStaticMarkup(createElement(WorkspaceInspection, { states: current, modules: all, title: 'Point detail test' }))
  const difference = renderToStaticMarkup(createElement(WorkspaceDifferencePreview, { current, target, modules: ['hr'], title: 'Undo difference test' }))
  assert.match(details, /role="region" aria-label="Point detail test"/)
  assert.match(difference, /role="region" aria-label="Undo difference test"/)
  for (const key of Object.keys(hrCounts)) assert.ok(details.includes(`data-collection="${key}"`), key)
  assert.match(details, /HR primary record count">46<\/output>/)
  assert.match(difference, /HR changed primary records">1<\/output>/)
  assert.doesNotMatch(details + difference, new RegExp(marker))
  assert.doesNotMatch(details + difference, /onClick|textarea|type="submit"/)
})

test('presentation has neutral no-selection and fixed invalid-data messages without revealing unsafe IDs', async () => {
  const { WorkspaceInspection, WorkspaceDifferencePreview } = await loadComponents()
  assert.match(renderToStaticMarkup(createElement(WorkspaceInspection, { states: {}, modules: [] })), /Select at least one workspace/)
  const target = clone(seed); target.cms.entries[0].id = `${marker} unsafe identifier`
  const output = renderToStaticMarkup(createElement(WorkspaceDifferencePreview, { current: seed, target, modules: ['cms'] }))
  assert.match(output, /role="alert"/)
  assert.doesNotMatch(output, new RegExp(marker))
})
