import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const urls = {}
async function load(name) {
  const source = readFileSync(new URL(`../../src/hr/${name}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const resolved = compiled.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, dependency) => {
    assert.ok(urls[dependency], `Load ${dependency} before ${name}`)
    return `from '${urls[dependency]}'`
  })
  urls[name] = `data:text/javascript;base64,${Buffer.from(`${resolved}\n//# sourceURL=hr-${name}.mjs`).toString('base64')}`
  return import(urls[name])
}
const model = await load('model')
const workflow = await load('mock-workflows')
const people = await load('people-operations')
await load('service-desk')
const recruiting = await load('recruiting')
const linking = await load('recruiting-link')
const operations = await load('linked-operations')
await load('performance')
await load('surveys')
const persistence = await load('persistence')
const lifecycle = await load('lifecycle')
const base = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const hr = { role: 'hr-admin' }
const self = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const date = '2026-10-15'
const initial = (fixture = base) => persistence.createHrDemoState(fixture)
const apply = (state, action, actor = owner, fixture = base) => {
  const preview = lifecycle.previewHrLifecycle(state, actor, { simulationDate: date, ...action }, fixture)
  const next = lifecycle.confirmHrLifecycle(state, actor, preview.action, preview.confirmation, fixture)
  assert.equal(persistence.isHrDemoState(next, fixture), true, 'accepted complete candidate is valid')
  return next
}
const instanceId = 'employment-employee-002-1'
function onboard(state, employeeId = 'employee-002', fixture = base) {
  const actor = { role: 'employee', employeeId }
  const id = state.workflow.lifecycle?.activeInstances[employeeId]
  for (const type of ['review-profile', 'review-job']) state.workflow = workflow.transitionMockHr(state.workflow, actor, { type, employeeId, ...(id ? { instanceId: id } : {}) }, fixture)
  for (const taskId of Object.keys(state.workflow.onboarding[employeeId].tasks)) state.workflow = workflow.transitionMockHr(state.workflow, actor, { type: 'check-task', employeeId, taskId, complete: true, ...(id ? { instanceId: id } : {}) }, fixture)
  for (const type of ['review-onboarding', 'complete-onboarding']) state.workflow = workflow.transitionMockHr(state.workflow, actor, { type, employeeId, ...(id ? { instanceId: id } : {}) }, fixture)
  return state
}
function terminated() {
  let state = onboard(initial())
  return apply(state, { type: 'terminate', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional end of employment.' })
}
const rehire = { type: 'rehire', employeeId: 'employee-002', startDate: '2026-10-16', simulationDate: '2026-10-16', department: 'Research', jobTitle: 'Fictional researcher', managerId: 'employee-001' }

test('legacy view and preview preserve exact complete bytes and unknown employment dates', () => {
  const state = initial(); const before = JSON.stringify(state)
  const view = lifecycle.lifecycleView(state, base)
  assert.equal(view.simulationDate, null)
  assert.deepEqual(view.instances.map(instance => [instance.id, instance.startDate]), [['employment-employee-001-1', null], [instanceId, null], ['employment-employee-003-1', null]])
  const preview = lifecycle.previewHrLifecycle(state, owner, { type: 'set-simulation-date', simulationDate: date }, base)
  assert.equal(typeof preview.confirmation, 'string')
  assert.equal(JSON.stringify(state), before)
  assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), false)
  assert.equal(persistence.isHrDemoState(JSON.parse(before), base), true)
})

test('first meaningful ordinary profile save records old/new actor/sequence with honest unknown date', () => {
  const state = initial(); const before = JSON.stringify(state)
  const unchanged = workflow.transitionMockHr(state.workflow, self, { type: 'change-profile', employeeId: self.employeeId, workEmail: 'avery@example.invalid' }, base)
  assert.equal(Object.hasOwn(unchanged, 'lifecycle'), false)
  assert.throws(() => workflow.transitionMockHr(state.workflow, self, { type: 'change-profile', employeeId: self.employeeId, workEmail: '' }, base), /required/)
  state.workflow = workflow.transitionMockHr(state.workflow, self, { type: 'change-profile', employeeId: self.employeeId, workEmail: '  changed@example.invalid  ' }, base)
  assert.equal(state.workflow.lifecycle.simulationDate, null)
  assert.deepEqual(state.workflow.lifecycle.directoryHistory, [{ id: 'directory-1', sequence: 1, employeeId: 'employee-002', field: 'workEmail', oldValue: 'avery@example.invalid', newValue: 'changed@example.invalid', actor: self, origin: 'direct' }])
  assert.equal(state.workflow.sequence, 1)
  assert.equal(persistence.isHrDemoState(state, base), true)
  assert.equal(Object.hasOwn(JSON.parse(before).workflow, 'lifecycle'), false)
})

test('ordinary profile then original onboarding still completes without a fabricated date or new required API step', () => {
  let state = initial()
  state.workflow = workflow.transitionMockHr(state.workflow, self, { type: 'change-profile', employeeId: self.employeeId, workEmail: 'changed@example.invalid' }, base)
  // Existing original-instance calls remain valid without a new instanceId parameter.
  for (const type of ['review-profile', 'review-job']) state.workflow = workflow.transitionMockHr(state.workflow, self, { type, employeeId: self.employeeId }, base)
  state.workflow = workflow.transitionMockHr(state.workflow, self, { type: 'check-task', employeeId: self.employeeId, taskId: 'policy', complete: true }, base)
  for (const type of ['review-onboarding', 'complete-onboarding']) state.workflow = workflow.transitionMockHr(state.workflow, self, { type, employeeId: self.employeeId }, base)
  assert.equal(state.workflow.onboarding[self.employeeId].receipt, 'MOCK-ONBOARDING-0001')
  assert.equal(state.workflow.lifecycle.events[0].effectiveDate, null)
  assert.equal(state.workflow.lifecycle.instances[1].startDate, null)
  assert.equal(persistence.isHrDemoState(state, base), true)
})

test('preview confirmation binds full source, actor, action and raw fixture and refuses replay', () => {
  const state = initial(); const action = { type: 'set-simulation-date', simulationDate: date }
  const preview = lifecycle.previewHrLifecycle(state, owner, action, base)
  const changed = structuredClone(state); changed.completed.push('sentinel')
  for (const [source, actor, input, fixture] of [[changed, owner, action, base], [state, hr, action, base], [state, owner, { ...action, simulationDate: '2026-10-16' }, base], [state, owner, action, { ...base, company: { ...base.company, name: 'Changed source' } }]]) {
    const before = JSON.stringify(source)
    assert.throws(() => lifecycle.confirmHrLifecycle(source, actor, input, preview.confirmation, fixture), /Preview again/)
    assert.equal(JSON.stringify(source), before)
  }
  const next = lifecycle.confirmHrLifecycle(state, owner, action, preview.confirmation, base)
  assert.throws(() => lifecycle.confirmHrLifecycle(next, owner, action, preview.confirmation, base), /Preview again/)
  assert.equal(next.workflow.lifecycle.sequence, 2)
})

test('dates, no-op and unauthorized lifecycle proposals preserve the entire original workspace', () => {
  const state = initial(); const before = JSON.stringify(state)
  const action = { type: 'leave', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional leave.', simulationDate: date }
  for (const actor of [self, manager, { role: 'payroll-admin' }, { role: 'auditor' }, { role: 'contractor', contractorId: 'contractor-001' }]) assert.throws(() => lifecycle.previewHrLifecycle(state, actor, action, base), /Only the owner or HR/)
  for (const overrides of [{ reason: ' ' }, { reason: 'bad\nreason' }, { effectiveDate: '2026-02-30' }, { effectiveDate: '2026-10-16' }]) assert.throws(() => lifecycle.previewHrLifecycle(state, owner, { ...action, ...overrides }, base))
  assert.throws(() => lifecycle.previewHrLifecycle(state, owner, { type: 'select-template', templateVersion: 'sample-v1', simulationDate: date }, base), /already selected/)
  assert.equal(JSON.stringify(state), before)
})

test('transfer preview reports literal old/new assignment and exact changed manager scopes', () => {
  const state = initial(); state.performance.reviews[0].stage = 'acknowledged'
  const action = { type: 'transfer', employeeId: 'employee-002', department: 'Research', managerId: null, effectiveDate: date, simulationDate: date }
  const before = JSON.stringify(state)
  const preview = lifecycle.previewHrLifecycle(state, owner, action, base)
  assert.deepEqual(preview.previous, { status: 'active', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001' })
  assert.deepEqual(preview.proposed, { status: 'active', department: 'Research', jobTitle: 'Product Designer', managerId: null })
  assert.deepEqual(preview.scopeChanges, [{ managerId: 'employee-001', previousReportIds: ['employee-002', 'employee-003'], proposedReportIds: ['employee-003'] }])
  assert.equal(JSON.stringify(state), before)
  const next = apply(state, action)
  const projected = lifecycle.effectiveHrFixture(next, linking.recruitingFixture(base, next.recruiting))
  assert.deepEqual(model.scopedEmployees(manager, projected.employees).map(employee => employee.id), ['employee-001', 'employee-003'])
  assert.equal(model.canApproveTimeEntry(manager, next.workflow.timeEntries[0], projected.employees), false)
  assert.equal(projected.employees[1].department, 'Research')
  assert.equal(base.employees[1].department, 'Design')
})

test('manager reassignment refuses every unfinished review stage without rewriting frozen comments', () => {
  for (const stage of ['draft', 'self-submitted', 'manager-review', 'published']) {
    const state = initial(); state.performance.reviews[0].stage = stage; state.performance.reviews[0].managerComments = 'Frozen review sentinel.'
    const before = JSON.stringify(state)
    assert.throws(() => apply(state, { type: 'transfer', employeeId: 'employee-002', department: 'Research', managerId: null, effectiveDate: date }), /acknowledge/)
    assert.equal(JSON.stringify(state), before)
  }
})

test('self and reporting cycles identify only actual cycle members', () => {
  const state = initial()
  assert.throws(() => apply(state, { type: 'transfer', employeeId: 'employee-001', department: 'Operations', managerId: 'employee-001', effectiveDate: date }), /employee-001/)
  assert.throws(() => apply(state, { type: 'transfer', employeeId: 'employee-001', department: 'Operations', managerId: 'employee-002', effectiveDate: date }), /Affected employee IDs: employee-001, employee-002/)
  assert.deepEqual(lifecycle.reportingCycleIds([{ id: 'outsider', managerId: 'b' }, { id: 'a', managerId: 'b' }, { id: 'b', managerId: 'c' }, { id: 'c', managerId: 'a' }, { id: 'root', managerId: null }]), ['a', 'b', 'c'])
})

test('leave and return record prior state, reasons and dates without mutating unrelated records', () => {
  const state = initial(); const sentinels = JSON.stringify([state.operations, state.performance, state.workflow.timeEntries])
  let next = apply(state, { type: 'leave', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional leave for a sample.' })
  assert.equal(next.workflow.employeeStatuses['employee-002'], 'on-leave')
  assert.equal(next.workflow.lifecycle.events[0].previous.status, 'active')
  assert.equal(next.workflow.lifecycle.events[0].reason, 'Fictional leave for a sample.')
  assert.throws(() => apply(next, { type: 'leave', employeeId: 'employee-002', effectiveDate: date, reason: 'Duplicate leave.' }), /not allowed/)
  next = apply(next, { type: 'return', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional return to work.' })
  assert.equal(next.workflow.employeeStatuses['employee-002'], 'active')
  assert.equal(next.workflow.lifecycle.events[1].previous.status, 'on-leave')
  assert.equal(JSON.stringify([next.operations, next.performance, next.workflow.timeEntries]), sentinels)
})

test('termination previews and creates three linked existing-workflow tasks atomically, completion preserves capture', () => {
  const state = initial(); const action = { type: 'terminate', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional end of employment.', simulationDate: date }
  const before = JSON.stringify(state)
  const preview = lifecycle.previewHrLifecycle(state, owner, action, base)
  assert.deepEqual(preview.offboarding.map(item => [item.id, item.kind, item.instanceId, item.status]), [['lifecycle-1-asset', 'asset', instanceId, 'assigned'], ['lifecycle-1-access', 'access', instanceId, 'assigned'], ['lifecycle-1-handover', 'handover', instanceId, 'assigned']])
  assert.equal(JSON.stringify(state), before)
  const next = apply(state, action)
  assert.equal(next.operations.records.tasks.length, state.operations.records.tasks.length + 3)
  const capture = JSON.stringify(next.workflow.lifecycle.offboardingAssignments)
  next.operations = people.transitionPeopleOperations(next.operations, { type: 'complete-task', recordId: 'lifecycle-1-asset' }, owner, lifecycle.effectiveHrFixture(next, base))
  assert.equal(next.operations.records.tasks.find(task => task.id === 'lifecycle-1-asset').status, 'completed')
  assert.equal(JSON.stringify(next.workflow.lifecycle.offboardingAssignments), capture)
  assert.equal(persistence.isHrDemoState(next, base), true)
  assert.throws(() => apply(next, action), /terminated/)
})

test('task identity collision and manager-with-reports termination refuse the complete transaction', () => {
  const state = initial(); state.operations.records.tasks.push({ id: 'lifecycle-1-asset', employeeId: 'employee-002', status: 'pending', title: 'Preserve this existing task' })
  const before = JSON.stringify(state)
  assert.throws(() => apply(state, { type: 'terminate', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional termination.' }), /identity already exists/)
  assert.equal(JSON.stringify(state), before)
  assert.throws(() => apply(initial(), { type: 'terminate', employeeId: 'employee-001', effectiveDate: date, reason: 'Fictional termination.' }), /employee-002, employee-003/)
})

test('rehire retains directory identity and old receipt, creates versioned new instance, and freezes balances/rates/benefits/payroll', () => {
  let state = terminated()
  state.workflow.sampleRates = { 'employee-002': [{ effectiveFrom: '2026-10-01', hourlyRateCents: 2500 }] }
  const oldReceipt = JSON.stringify(state.workflow.onboarding['employee-002'])
  const preserved = JSON.stringify([state.operations.balances, state.workflow.sampleRates, state.workflow.benefitElections, state.workflow.payroll, state.workflow.payrollHistory, state.workflow.timeEntries])
  state = apply(state, { type: 'select-template', templateVersion: 'sample-v2' })
  const preview = lifecycle.previewHrLifecycle(state, owner, rehire, base)
  assert.deepEqual(preview.rehire, { retainedEmployeeId: 'employee-002', priorInstanceId: instanceId, newInstanceId: 'employment-employee-002-2', templateVersion: 'sample-v2', tasks: [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }, { id: 'security', title: 'Review fictional access and security guidance' }] })
  const next = apply(state, rehire)
  assert.equal(next.recruiting.hiredEmployees.length, 0)
  assert.equal(next.workflow.lifecycle.activeInstances['employee-002'], 'employment-employee-002-2')
  assert.equal(JSON.stringify(next.workflow.lifecycle.instances[1].archivedOnboarding), oldReceipt)
  assert.deepEqual(next.workflow.onboarding['employee-002'], { profileReviewed: false, jobReviewed: false, tasks: { profile: false, policy: false, security: false }, stage: 'draft' })
  assert.equal(JSON.stringify([next.operations.balances, next.workflow.sampleRates, next.workflow.benefitElections, next.workflow.payroll, next.workflow.payrollHistory, next.workflow.timeEntries]), preserved)
  assert.match(preview.policy, /balances, fictional hourly rate timelines and benefit elections unchanged/)
  assert.throws(() => apply(next, rehire), /terminated instance/)
})

test('old onboarding controls and linked original policy cannot advance the rehire checklist', () => {
  const state = apply(terminated(), rehire)
  const before = JSON.stringify(state.workflow)
  for (const extra of [{}, { instanceId }]) assert.throws(() => workflow.transitionMockHr(state.workflow, self, { type: 'check-task', employeeId: 'employee-002', taskId: 'policy', complete: true, ...extra }, lifecycle.effectiveHrFixture(state, base)), /current employment instance/)
  const linked = operations.applyLinkedPeopleOperation(state.workflow, state.operations, { type: 'acknowledge-policy', recordId: 'policy-001' }, self, lifecycle.effectiveHrFixture(state, base))
  assert.equal(linked.workflow.onboarding['employee-002'].tasks.policy, false)
  assert.equal(JSON.stringify(state.workflow), before)
  const accepted = workflow.transitionMockHr(state.workflow, self, { type: 'check-task', employeeId: 'employee-002', instanceId: 'employment-employee-002-2', taskId: 'policy', complete: true }, lifecycle.effectiveHrFixture(state, base))
  assert.equal(accepted.onboarding['employee-002'].tasks.policy, true)
})

test('employee correction proposal and HR acceptance produce exact immutable outcome and email history', () => {
  const proposed = apply(initial(), { type: 'request-correction', employeeId: 'employee-002', workEmail: 'corrected@example.invalid' }, self)
  assert.equal(proposed.workflow.profileEmails['employee-002'], 'avery@example.invalid')
  assert.deepEqual(proposed.workflow.lifecycle.corrections[0], { id: 'correction-1', sequence: 1, employeeId: 'employee-002', instanceId, field: 'workEmail', oldValue: 'avery@example.invalid', proposedValue: 'corrected@example.invalid', actor: self, status: 'pending' })
  const next = apply(proposed, { type: 'review-correction', correctionId: 'correction-1', outcome: 'accepted', reason: 'Reviewed fictional correction.' }, hr)
  assert.equal(next.workflow.profileEmails['employee-002'], 'corrected@example.invalid')
  assert.deepEqual(next.workflow.lifecycle.directoryHistory, [{ id: 'directory-2', sequence: 2, employeeId: 'employee-002', field: 'workEmail', oldValue: 'avery@example.invalid', newValue: 'corrected@example.invalid', actor: hr, origin: 'correction', correctionId: 'correction-1' }])
  assert.deepEqual(next.workflow.lifecycle.corrections[0].outcome, { sequence: 3, actor: hr, reason: 'Reviewed fictional correction.' })
  assert.throws(() => apply(next, { type: 'review-correction', correctionId: 'correction-1', outcome: 'accepted', reason: 'Repeated review.' }), /unreviewed/)
})

test('correction rejection, own-only authority and stale underlying email checks preserve the right records', () => {
  const proposed = apply(initial(), { type: 'request-correction', employeeId: 'employee-002', workEmail: 'corrected@example.invalid' }, self)
  const stale = apply(proposed, { type: 'edit-directory', employeeId: 'employee-002', workEmail: 'later@example.invalid' })
  const before = JSON.stringify(stale)
  assert.throws(() => apply(stale, { type: 'review-correction', correctionId: 'correction-1', outcome: 'accepted', reason: 'Stale acceptance.' }), /changed after/)
  assert.equal(JSON.stringify(stale), before)
  const rejected = apply(stale, { type: 'review-correction', correctionId: 'correction-1', outcome: 'rejected', reason: 'The current value was separately reviewed.' })
  assert.equal(rejected.workflow.profileEmails['employee-002'], 'later@example.invalid')
  assert.equal(rejected.workflow.lifecycle.directoryHistory.length, 1)
  assert.equal(rejected.workflow.lifecycle.corrections[0].status, 'rejected')
  assert.throws(() => apply(initial(), { type: 'request-correction', employeeId: 'employee-003', workEmail: 'foreign@example.invalid' }, self), /own/)
  assert.throws(() => apply(initial(), { type: 'edit-directory', employeeId: 'employee-002', workEmail: 'real@example.com' }), /\.invalid/)
})

test('extension validation rejects malformed links, dates, sequences, graph, current status and task bindings', () => {
  const accepted = apply(terminated(), rehire)
  const mutations = [
    state => { state.workflow.lifecycle.schemaVersion = 2 },
    state => { state.workflow.lifecycle.unreviewed = true },
    state => { state.workflow.lifecycle.activeInstances['employee-002'] = 'foreign' },
    state => { state.workflow.lifecycle.sequence += 1 },
    state => { state.workflow.lifecycle.instances[3].startDate = date },
    state => { state.workflow.lifecycle.instances[3].tasks[0].title = 'Unreviewed new checklist' },
    state => { state.workflow.lifecycle.instances[1].archivedOnboarding.receipt = 'Changed but duplicate receipt'; state.workflow.onboarding['employee-001'].receipt = 'Changed but duplicate receipt' },
    state => { state.workflow.employeeStatuses['employee-002'] = 'active' },
    state => { state.workflow.lifecycle.instances[0].current.managerId = 'employee-002' },
    state => { delete state.workflow.onboarding['employee-002'].tasks.policy },
    state => { state.operations.records.tasks = state.operations.records.tasks.filter(task => task.id !== 'lifecycle-1-access') },
    state => { state.workflow.lifecycle.offboardingAssignments[0].instanceId = 'employment-employee-002-2' },
  ]
  for (const mutate of mutations) { const value = structuredClone(accepted); mutate(value); assert.equal(persistence.isHrDemoState(value, base), false) }
  const absent = initial(); absent.workflow.lifecycle = null
  assert.equal(persistence.isHrDemoState(absent, base), false)
  assert.equal(persistence.isHrDemoState(JSON.parse(JSON.stringify(accepted)), base), true)
})

test('captured checklist selection applies to native hire with unknown original start, preserving unrelated state', () => {
  let state = initial()
  state.workflow = workflow.transitionMockHr(state.workflow, self, { type: 'change-profile', employeeId: self.employeeId, workEmail: 'changed@example.invalid' }, base)
  const job = state.recruiting.jobs[0]; const candidate = state.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: job.id, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) state = { ...state, ...linking.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, base) }
  const hire = state.recruiting.hiredEmployees[0]
  const captured = state.workflow.lifecycle.instances.find(instance => instance.employeeId === hire.id)
  assert.equal(captured.startDate, null)
  assert.equal(captured.templateVersion, 'sample-v1')
  assert.equal(state.workflow.lifecycle.events[0].kind, 'hire')
  assert.equal(state.workflow.lifecycle.events[0].effectiveDate, null)
  assert.equal(persistence.isHrDemoState(state, base), true)
  state = onboard(state, hire.id, lifecycle.effectiveHrFixture(state, base))
  assert.equal(persistence.isHrDemoState(state, base), true)
  assert.equal(lifecycle.effectiveHrFixture(state, linking.recruitingFixture(base, state.recruiting)).employees.at(-1).onboardingStatus, 'simulated-complete')
})

test('selected v2 and effective manager status reach recruiting while captured hire records remain unchanged', () => {
  let state = apply(initial(), { type: 'select-template', templateVersion: 'sample-v2' })
  const job = state.recruiting.jobs[0]; const candidate = state.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: job.id, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) state = { ...state, ...linking.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, base) }
  assert.deepEqual(state.recruiting.hiredEmployees[0].onboarding.map(task => task.id), ['profile', 'policy', 'security'])
  assert.equal(state.workflow.lifecycle.instances.at(-1).startDate, date)
  assert.equal(persistence.isHrDemoState(state, base), true)
  const captured = JSON.stringify(state.recruiting.hiredEmployees)
  state = apply(state, { type: 'leave', employeeId: 'employee-001', effectiveDate: date, reason: 'Fictional manager leave.' })
  assert.equal(JSON.stringify(state.recruiting.hiredEmployees), captured)
  assert.throws(() => linking.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, { type: 'create-job', title: 'Sample new role', department: 'Research', managerId: 'employee-001' }, base), /active sample manager/)
  assert.equal(recruiting.HR_ONBOARDING_TEMPLATES.length, 2)
})

test('submitted nonempty payroll and consumed time remain byte-identical through termination, rehire and later template selection', () => {
  let state = initial()
  state.workflow = workflow.transitionMockHr(state.workflow, manager, { type: 'approve-time', entryId: 'time-001' }, base)
  state.workflow = workflow.transitionMockHr(state.workflow, owner, { type: 'set-sample-rate', employeeId: 'employee-002', effectiveFrom: '2026-10-01', hourlyRateCents: 2500 }, base)
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) state.workflow = workflow.transitionMockHr(state.workflow, owner, { type, ...(type === 'prepare-payroll' ? { period: { start: '2026-10-01', end: '2026-10-15' } } : {}) }, base)
  assert.equal(state.workflow.payroll.grossCents, 20000)
  assert.equal(state.workflow.payroll.netCents, 16000)
  assert.equal(state.workflow.payroll.receipt, 'MOCK-PAYROLL-0001')
  const frozen = JSON.stringify([state.workflow.payroll, state.workflow.payrollHistory, state.workflow.timeEntries])
  state = apply(state, { type: 'terminate', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional termination after submitted payroll.' })
  state = apply(state, rehire)
  state = apply(state, { type: 'select-template', templateVersion: 'sample-v2', simulationDate: '2026-10-16' })
  assert.equal(JSON.stringify([state.workflow.payroll, state.workflow.payrollHistory, state.workflow.timeEntries]), frozen)
  assert.equal(workflow.payrollFreshness(state.workflow, lifecycle.effectiveHrFixture(state, base)).stale, false)
})

test('unsubmitted preparation becomes stale after a lifecycle eligibility change and cannot submit', () => {
  let state = initial()
  state.workflow = workflow.transitionMockHr(state.workflow, manager, { type: 'approve-time', entryId: 'time-001' }, base)
  state.workflow = workflow.transitionMockHr(state.workflow, owner, { type: 'set-sample-rate', employeeId: 'employee-002', effectiveFrom: '2026-10-01', hourlyRateCents: 2500 }, base)
  state.workflow = workflow.transitionMockHr(state.workflow, owner, { type: 'prepare-payroll', period: { start: '2026-10-01', end: '2026-10-15' } }, base)
  const prepared = JSON.stringify(state.workflow.payroll)
  state = apply(state, { type: 'leave', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional leave after preparation.' })
  assert.equal(workflow.payrollFreshness(state.workflow, lifecycle.effectiveHrFixture(state, base)).stale, true)
  assert.throws(() => workflow.transitionMockHr(state.workflow, owner, { type: 'calculate-payroll' }, lifecycle.effectiveHrFixture(state, base)), /stale/)
  assert.equal(JSON.stringify(state.workflow.payroll), prepared)
})

test('rehire confirmation catches a changed selected checklist and preserves the reviewed old receipt', () => {
  const state = terminated()
  const preview = lifecycle.previewHrLifecycle(state, owner, rehire, base)
  const changed = apply(state, { type: 'select-template', templateVersion: 'sample-v2' })
  const before = JSON.stringify(changed)
  assert.throws(() => lifecycle.confirmHrLifecycle(changed, owner, rehire, preview.confirmation, base), /Preview again/)
  assert.equal(JSON.stringify(changed), before)
  assert.equal(changed.workflow.onboarding['employee-002'].receipt, 'MOCK-ONBOARDING-0001')
})

test('import refuses an edited history that hides a past reporting cycle behind a later valid graph', () => {
  let state = apply(initial(), { type: 'transfer', employeeId: 'employee-001', department: 'Research', managerId: null, effectiveDate: date })
  state = apply(state, { type: 'transfer', employeeId: 'employee-001', department: 'Operations', managerId: null, effectiveDate: date })
  const bad = structuredClone(state)
  bad.workflow.lifecycle.events[0].proposed.managerId = 'employee-002'
  bad.workflow.lifecycle.events[1].previous.managerId = 'employee-002'
  assert.equal(persistence.isHrDemoState(bad, base), false)
  assert.equal(persistence.isHrDemoState(state, base), true)
})

test('import requires the checklist selected at instance creation and exact archived task definitions', () => {
  const state = apply(terminated(), rehire)
  const changed = structuredClone(state)
  const newInstance = changed.workflow.lifecycle.instances.at(-1)
  newInstance.templateVersion = 'sample-v2'
  newInstance.tasks.push({ id: 'security', title: 'Review fictional access and security guidance' })
  changed.workflow.onboarding['employee-002'].tasks.security = false
  assert.equal(persistence.isHrDemoState(changed, base), false)
  const reordered = JSON.parse(JSON.stringify(state), (_key, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value)
  assert.equal(persistence.isHrDemoState(reordered, base), true)
})

test('import refuses rehire active status before a bound completed onboarding checklist and receipt', () => {
  const state = apply(terminated(), rehire)
  const forged = structuredClone(state)
  const instance = forged.workflow.lifecycle.instances.at(-1)
  instance.initial.status = 'active'
  instance.current.status = 'active'
  forged.workflow.lifecycle.events.find(event => event.kind === 'rehire').proposed.status = 'active'
  forged.workflow.employeeStatuses['employee-002'] = 'active'
  const before = JSON.stringify(forged)
  assert.equal(persistence.isHrDemoState(forged, base), false)
  assert.equal(JSON.stringify(forged), before)
  assert.equal(state.workflow.onboarding['employee-002'].stage, 'draft')
  assert.equal(state.workflow.employeeStatuses['employee-002'], 'onboarding')

  const forgedCompletion = structuredClone(state)
  const pending = forgedCompletion.workflow.lifecycle.instances.at(-1)
  const sequence = forgedCompletion.workflow.lifecycle.sequence++
  forgedCompletion.workflow.lifecycle.events.push({ id: `lifecycle-${sequence}`, sequence, kind: 'onboarding-complete', employeeId: 'employee-002', instanceId: pending.id, effectiveDate: '2026-10-16', actor: self, reason: 'Sample onboarding confirmed', previous: { ...pending.current }, proposed: { ...pending.current, status: 'active' } })
  pending.current.status = 'active'
  forgedCompletion.workflow.employeeStatuses['employee-002'] = 'active'
  assert.equal(persistence.isHrDemoState(forgedCompletion, base), false, 'a fabricated activation event cannot bypass the still-draft checklist')

  const completed = onboard(structuredClone(state), 'employee-002', lifecycle.effectiveHrFixture(state, base))
  assert.equal(completed.workflow.onboarding['employee-002'].receipt, 'MOCK-ONBOARDING-0002')
  assert.equal(completed.workflow.employeeStatuses['employee-002'], 'active')
  assert.equal(persistence.isHrDemoState(completed, base), true)
  for (const mutate of [value => { value.workflow.onboarding['employee-002'].tasks.policy = false }, value => { value.workflow.onboarding['employee-002'].profileReviewed = false }, value => { delete value.workflow.onboarding['employee-002'].receipt }]) {
    const incomplete = structuredClone(completed); mutate(incomplete)
    assert.equal(persistence.isHrDemoState(incomplete, base), false)
  }
})

test('native hire imports also require initial onboarding before legitimate completion', () => {
  let state = apply(initial(), { type: 'set-simulation-date' })
  const job = state.recruiting.jobs[0]; const candidate = state.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: job.id, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) state = { ...state, ...linking.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, base) }
  const forged = structuredClone(state)
  const instance = forged.workflow.lifecycle.instances.at(-1)
  instance.initial.status = 'active'; instance.current.status = 'active'
  forged.workflow.lifecycle.events.find(event => event.kind === 'hire').proposed.status = 'active'
  forged.workflow.employeeStatuses[instance.employeeId] = 'active'
  assert.equal(persistence.isHrDemoState(forged, base), false)
  assert.equal(persistence.isHrDemoState(state, base), true)
})

test('materialized legacy assignment anchors to immutable seed or captured hire while recorded transfers remain valid', () => {
  let state = apply(initial(), { type: 'set-simulation-date' })
  for (const [field, value] of [['department', 'Unrecorded imported transfer'], ['jobTitle', 'Unrecorded fictional title'], ['managerId', null]]) {
    const forged = structuredClone(state)
    const instance = forged.workflow.lifecycle.instances.find(item => item.employeeId === 'employee-002')
    instance.initial[field] = value; instance.current[field] = value
    assert.equal(persistence.isHrDemoState(forged, base), false, field)
  }
  state.performance.reviews[0].stage = 'acknowledged'
  const transferred = apply(state, { type: 'transfer', employeeId: 'employee-002', department: 'Recorded research', managerId: null, effectiveDate: date })
  assert.equal(transferred.workflow.lifecycle.instances[1].initial.department, 'Design')
  assert.equal(transferred.workflow.lifecycle.instances[1].current.department, 'Recorded research')
  assert.equal(persistence.isHrDemoState(transferred, base), true)

  let hired = initial()
  const job = hired.recruiting.jobs[0]; const candidate = hired.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: job.id, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) hired = { ...hired, ...linking.applyRecruitingToHr(hired.recruiting, hired.workflow, hired.operations, owner, event, base) }
  hired = apply(hired, { type: 'set-simulation-date' })
  const captured = JSON.stringify(hired.recruiting.hiredEmployees)
  const forgedHire = structuredClone(hired)
  const legacyHire = forgedHire.workflow.lifecycle.instances.at(-1)
  legacyHire.initial.department = 'Unrecorded hire transfer'; legacyHire.current.department = 'Unrecorded hire transfer'
  assert.equal(persistence.isHrDemoState(forgedHire, base), false)
  assert.equal(JSON.stringify(hired.recruiting.hiredEmployees), captured)
  assert.equal(persistence.isHrDemoState(hired, base), true)
})

test('rehire preserves the unfinished-review manager binding and refuses a manager change without partial work', () => {
  const state = terminated()
  assert.equal(state.performance.reviews.find(review => review.employeeId === 'employee-002').stage, 'draft')
  const before = JSON.stringify(state)
  for (const managerId of [null, 'employee-002']) {
    assert.throws(() => apply(state, { ...rehire, managerId }), managerId === null ? /acknowledge.*review.*rehire/ : /cannot manage themselves/)
    assert.equal(JSON.stringify(state), before)
  }
  const sameManager = apply(state, rehire)
  assert.equal(sameManager.workflow.lifecycle.instances.at(-1).current.managerId, 'employee-001')
  assert.deepEqual(sameManager.performance, state.performance)
  const acknowledged = structuredClone(state)
  acknowledged.performance.reviews.find(review => review.employeeId === 'employee-002').stage = 'acknowledged'
  const released = apply(acknowledged, { ...rehire, managerId: null })
  assert.equal(released.workflow.lifecycle.instances.at(-1).current.managerId, null)
  assert.deepEqual(released.performance, acknowledged.performance)
})


test('rehire with a different valid active manager also refuses its unfinished captured review', () => {
  const fixture = structuredClone(base)
  fixture.employees[2].employmentStatus = 'active'
  let state = onboard(initial(fixture), 'employee-002', fixture)
  state = apply(state, { type: 'terminate', employeeId: 'employee-002', effectiveDate: date, reason: 'Fictional termination.' }, owner, fixture)
  const before = JSON.stringify(state)
  assert.throws(() => apply(state, { ...rehire, managerId: 'employee-003' }, owner, fixture), /acknowledge.*review.*rehire/)
  assert.equal(JSON.stringify(state), before)
})


test('import refuses a rehire manager rewrite that would strand the captured unfinished review', () => {
  const state = apply(terminated(), rehire)
  const forged = structuredClone(state)
  const instance = forged.workflow.lifecycle.instances.at(-1)
  instance.initial.managerId = null; instance.current.managerId = null
  forged.workflow.lifecycle.events.find(event => event.kind === 'rehire').proposed.managerId = null
  assert.equal(persistence.isHrDemoState(forged, base), false)
  assert.equal(persistence.isHrDemoState(state, base), true)
})
