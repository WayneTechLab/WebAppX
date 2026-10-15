import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { loadMockModel } from '../browser/model-loader.mjs'

const load = name => loadMockModel(new URL(`../../src/hr/${name}.ts`, import.meta.url))
const baseline = await load('recruiting-employment-baseline')
const workflow = await load('mock-workflows')
const recruiting = await load('recruiting')
const linking = await load('recruiting-link')
const persistence = await load('persistence')
const lifecycle = await load('lifecycle')
const core = await load('recruiting-lifecycle')
const { recruitingRequisitions } = await load('recruiting-requisitions')
const { recruitingInterviewHandler } = await load('recruiting-interviews')
const { recruitingHireAdapter } = await load('recruiting-hire')
const raw = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const actor = { mode: 'native', actor: owner }
const date = '2026-10-15', at = `${date}T09:00:00.000Z`
const employeeId = 'employee-rperson-0001', instanceId = `employment-${employeeId}-1`
const self = { role: 'employee', employeeId }
const tasks1 = [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }]
const tasks2 = [...tasks1, { id: 'security', title: 'Review fictional access and security guidance' }]
const pending = { profileReviewed: false, jobReviewed: false, stage: 'draft', tasks: { profile: false, policy: false } }
const complete = { profileReviewed: true, jobReviewed: true, stage: 'complete', tasks: { profile: true, policy: true }, receipt: 'MOCK-ONBOARDING-0001' }
const assignment = status => ({ status, department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' })
const services = { requisitions: recruitingRequisitions, interviews: recruitingInterviewHandler, hire: recruitingHireAdapter, validateCandidate: persistence.isHrDemoState, isTimeZoneSupported: zone => zone === 'UTC' }
function applyRecruiting(state, command) {
  const before = JSON.stringify(state)
  const next = core.buildRecruitingCandidate(state, actor, { recordedAt: at, ...command }, raw, services).next
  assert.equal(JSON.stringify(state), before, 'the complete recruiting source stays immutable')
  assert.equal(persistence.isHrDemoState(next, raw), true, 'every setup action passes the actual complete-state validator')
  return next
}
function original() {
  const state = persistence.createHrDemoState(raw)
  state.recruiting = recruiting.transitionRecruiting(state.recruiting, owner, { type: 'set-job-status', jobId: 'job-001', status: 'published' }, raw)
  return state
}
function hire(source = original()) {
  let state = source.recruiting.lifecycle ? source : applyRecruiting(source, { kind: 'adopt' })
  for (const nextStage of ['screening', 'interview', 'offer']) state = applyRecruiting(state, { kind: 'move-application', applicationId: 'rapplication-0001', expectedStage: state.recruiting.lifecycle.applications[0].stage, nextStage })
  return applyRecruiting(state, { kind: 'hire', applicationId: 'rapplication-0001' })
}
function applyEmployment(state, action) {
  const before = JSON.stringify(state)
  const preview = lifecycle.previewHrLifecycle(state, owner, { simulationDate: date, ...action }, raw)
  assert.equal(JSON.stringify(state), before, 'preview never materializes employment')
  const next = lifecycle.confirmHrLifecycle(state, owner, preview.action, preview.confirmation, raw)
  assert.equal(persistence.isHrDemoState(next, raw), true)
  return next
}
function ordinary(state, event, identity = self) {
  const next = structuredClone(state)
  next.workflow = workflow.transitionMockHr(state.workflow, identity, event, lifecycle.effectiveHrFixture(state, raw), state.recruiting)
  assert.equal(persistence.isHrDemoState(next, raw), true)
  return next
}
function onboard(state, id = employeeId) {
  const identity = { role: 'employee', employeeId: id }
  for (const type of ['review-profile', 'review-job']) state = ordinary(state, { type, employeeId: id }, identity)
  for (const taskId of Object.keys(state.workflow.onboarding[id].tasks)) state = ordinary(state, { type: 'check-task', employeeId: id, taskId, complete: true }, identity)
  for (const type of ['review-onboarding', 'complete-onboarding']) state = ordinary(state, { type, employeeId: id }, identity)
  return state
}
function expectedInstance(onboarding = pending, status = 'onboarding', templateVersion = 'sample-v1', tasks = tasks1) {
  return { id: instanceId, employeeId, startDate: null, endDate: null, initial: assignment(status), templateVersion, tasks,
    recruitingBaseline: { kind: 'recruiting-baseline', hireBindingId: 'rhire-0001', capturedOnboarding: onboarding, completion: status === 'active' ? { actor: 'unknown', effectiveDate: null } : null }, current: assignment(status) }
}
const find = state => state.workflow.lifecycle.instances.find(instance => instance.id === instanceId)

test('observed completion requires every exact task, both reviews and its canonical bounded own receipt', () => {
  assert.equal(baseline.recruitingBaselineIsComplete(complete, tasks1, 2), true)
  for (const [onboarding, tasks, sequence] of [
    [{ ...complete, profileReviewed: false }, tasks1, 2], [{ ...complete, jobReviewed: false }, tasks1, 2],
    [{ ...complete, stage: 'reviewed' }, tasks1, 2], [{ ...complete, tasks: { profile: true } }, tasks1, 2],
    [{ ...complete, tasks: { profile: true, policy: true, injected: true } }, tasks1, 2],
    [{ ...complete, tasks: { profile: true, policy: false } }, tasks1, 2], [complete, [...tasks1, tasks1[0]], 2],
    [{ ...complete, receipt: undefined }, tasks1, 2], [{ ...complete, receipt: 'MOCK-ONBOARDING-0000' }, tasks1, 2],
    [{ ...complete, receipt: 'MOCK-ONBOARDING-0002' }, tasks1, 2], [{ ...complete, receipt: 'MOCK-ONBOARDING-00001' }, tasks1, 2],
    [{ ...complete, receipt: 'MOCK-ONBOARDING-9007199254740992' }, tasks1, Number.MAX_SAFE_INTEGER],
    [complete, tasks1, 1], [complete, tasks1, 2.5],
  ]) assert.equal(baseline.recruitingBaselineIsComplete(onboarding, tasks, sequence), false)
})

test('new absent-at-hire pending capture is detached, read-only and records exact first-instance facts without historical events', () => {
  const state = hire(), before = JSON.stringify(state), rawHire = state.recruiting.hiredEmployees[0]
  assert.deepEqual(state.workflow.onboarding[employeeId], pending)
  const view = lifecycle.lifecycleView(state, raw)
  assert.deepEqual(view.instances.find(instance => instance.id === instanceId), expectedInstance())
  assert.deepEqual(view.events, []); assert.equal(view.sequence, 1); assert.equal(view.simulationDate, null)
  assert.equal(JSON.stringify(state), before); assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), false)
  const capture = baseline.recruitingEmploymentBaseline(state.workflow, { ...rawHire, department: 'Overlaid department', managerId: null }, state.recruiting)
  assert.deepEqual(capture.initial, assignment('onboarding'), 'assignment comes from immutable raw hire, never overlaid caller fields')
  capture.tasks[0].title = 'Detached test edit'; capture.recruitingBaseline.capturedOnboarding.tasks.profile = true
  assert.equal(JSON.stringify(state), before)
})

test('ordinary onboarding, rejected profile and no-op profile preserve absence; meaningful profile materializes only the exact observed capture', () => {
  let state = hire()
  state = ordinary(state, { type: 'review-profile', employeeId })
  state = ordinary(state, { type: 'check-task', employeeId, taskId: 'profile', complete: true })
  assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), false)
  const before = JSON.stringify(state)
  const unchanged = ordinary(state, { type: 'change-profile', employeeId, workEmail: '  casey.fiction@example.invalid  ' })
  assert.equal(JSON.stringify(unchanged), before)
  assert.throws(() => ordinary(state, { type: 'change-profile', employeeId, workEmail: '' }), /required/)
  assert.throws(() => ordinary(state, { type: 'change-profile', employeeId, workEmail: 'wrong@example.invalid' }, { role: 'employee', employeeId: 'employee-002' }), /cannot/)
  assert.equal(JSON.stringify(state), before)
  const observed = { profileReviewed: true, jobReviewed: false, stage: 'draft', tasks: { profile: true, policy: false } }
  const next = ordinary(state, { type: 'change-profile', employeeId, workEmail: 'changed@example.invalid' })
  assert.deepEqual(find(next), expectedInstance(observed))
  assert.deepEqual(next.workflow.onboarding[employeeId], { ...observed, profileReviewed: false })
  assert.deepEqual(next.workflow.lifecycle.events, [])
  assert.deepEqual(next.workflow.lifecycle.directoryHistory, [{ id: 'directory-1', sequence: 1, employeeId, field: 'workEmail', oldValue: 'casey.fiction@example.invalid', newValue: 'changed@example.invalid', actor: self, origin: 'direct' }])
  const expected = structuredClone(state)
  expected.workflow.profileEmails[employeeId] = 'changed@example.invalid'; expected.workflow.onboarding[employeeId].profileReviewed = false
  expected.workflow.lifecycle = structuredClone(next.workflow.lifecycle)
  assert.deepEqual(next, expected, 'all complete unrelated records stay exact')
})

test('completion before first employment action preserves the original receipt and truthful unknown actor/date, without fabricated hire, completion or template events', () => {
  const state = onboard(hire()), before = JSON.stringify(state)
  assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), false)
  assert.deepEqual(state.workflow.onboarding[employeeId], complete); assert.equal(state.workflow.sequence, 2)
  const next = applyEmployment(state, { type: 'set-simulation-date' })
  assert.deepEqual(find(next), expectedInstance(complete, 'active'))
  assert.deepEqual(next.workflow.lifecycle.events, [{ id: 'lifecycle-1', sequence: 1, kind: 'set-simulation-date', effectiveDate: date, actor: owner, reason: '', previous: null, proposed: date }])
  assert.equal(JSON.stringify(state), before); assert.deepEqual(next.workflow.onboarding, state.workflow.onboarding)
  assert.deepEqual(next.recruiting, state.recruiting)
  const edited = ordinary(state, { type: 'change-profile', employeeId, workEmail: 'later@example.invalid' })
  assert.deepEqual(find(edited), expectedInstance(complete, 'active'))
  assert.deepEqual(edited.workflow.onboarding[employeeId], complete)
  assert.deepEqual(edited.workflow.lifecycle.events, [])
})

test('a valid captured v2 import retains its exact security task and version at first materialization without inventing template history', () => {
  // An archived absent-employment capture can use either known checklist version.
  // This literal imported snapshot has no selected employment template field.
  const state = hire(), rawHire = state.recruiting.hiredEmployees[0], binding = state.recruiting.lifecycle.hireBindings[0]
  rawHire.onboardingTemplateVersion = 'sample-v2'
  rawHire.onboarding = tasks2.map(task => ({ ...task, status: 'pending' }))
  binding.employeeSnapshot = structuredClone(rawHire); binding.checklist = { version: 'sample-v2', tasks: structuredClone(tasks2) }
  state.recruiting.lifecycle.events.find(event => event.kind === 'hired').hire = structuredClone(binding)
  state.workflow.onboarding[employeeId].tasks = { profile: false, policy: false, security: false }
  assert.equal(persistence.isHrDemoState(state, raw), true)
  const next = applyEmployment(state, { type: 'set-simulation-date' })
  assert.deepEqual(find(next), expectedInstance({ ...pending, tasks: { profile: false, policy: false, security: false } }, 'onboarding', 'sample-v2', tasks2))
  assert.equal(next.workflow.lifecycle.selectedTemplateVersion, 'sample-v1')
  assert.deepEqual(next.workflow.lifecycle.events.map(event => event.kind), ['set-simulation-date'])
})

test('pending baseline later completes using the normal single event and leaves its captured pre-completion facts immutable', () => {
  const materialized = ordinary(hire(), { type: 'change-profile', employeeId, workEmail: 'changed@example.invalid' })
  const next = onboard(materialized), initial = expectedInstance()
  assert.deepEqual(find(next).recruitingBaseline, initial.recruitingBaseline)
  assert.deepEqual(next.workflow.onboarding[employeeId], complete)
  assert.deepEqual(next.workflow.lifecycle.events, [{ id: 'lifecycle-2', sequence: 2, kind: 'onboarding-complete', employeeId, instanceId, effectiveDate: null, actor: self, reason: 'Sample onboarding confirmed', previous: assignment('onboarding'), proposed: assignment('active') }])
  assert.deepEqual(find(next).initial, assignment('onboarding')); assert.deepEqual(find(next).current, assignment('active'))
  const bytes = JSON.stringify(next)
  assert.throws(() => ordinary(next, { type: 'complete-onboarding', employeeId }), /locked/)
  assert.equal(JSON.stringify(next), bytes)
})

test('strict baseline provenance refuses copied, ambiguous, mislinked, mismatched checklist and fabricated active captures without mutation', () => {
  const source = hire()
  for (const mutate of [
    s => { s.recruiting.lifecycle.hireBindings.push(structuredClone(s.recruiting.lifecycle.hireBindings[0])) },
    s => { s.recruiting.lifecycle.hireBindings[0].employeeSnapshot.department = 'Forged assignment' },
    s => { s.recruiting.lifecycle.hireBindings[0].legacyEmploymentLinks = { instanceId: null, hireEventId: null } },
    s => { s.recruiting.lifecycle.events.find(event => event.kind === 'hired').hire.id = 'wrong-binding' },
    s => { s.recruiting.lifecycle.applications[0].hireBindingId = 'wrong-binding' },
    s => { s.recruiting.lifecycle.hireBindings[0].checklist.tasks[0].title = 'Substitute task' },
    s => { s.workflow.onboarding[employeeId].tasks.extra = false },
    s => { s.workflow.employeeStatuses[employeeId] = 'active' },
  ]) {
    const state = structuredClone(source); mutate(state); const before = JSON.stringify(state)
    assert.throws(() => baseline.recruitingEmploymentBaseline(state.workflow, state.recruiting.hiredEmployees[0], state.recruiting))
    assert.equal(JSON.stringify(state), before)
  }
  const duplicate = onboard(source)
  duplicate.workflow.onboarding['employee-003'].receipt = 'MOCK-ONBOARDING-0001'
  assert.throws(() => baseline.recruitingEmploymentBaseline(duplicate.workflow, duplicate.recruiting.hiredEmployees[0], duplicate.recruiting), /status/)
})

test('legacy and employment-present hires never receive the baseline arm; existing state cannot rematerialize it', () => {
  const source = hire(), employee = source.recruiting.hiredEmployees[0]
  assert.equal(baseline.recruitingEmploymentBaseline(source.workflow, employee), null)
  assert.equal(baseline.recruitingEmploymentBaseline(source.workflow, raw.employees[0], source.recruiting), null)
  const present = hire(applyEmployment(original(), { type: 'set-simulation-date' }))
  assert.equal(present.recruiting.lifecycle.hireBindings[0].employmentAtHire.kind, 'created')
  assert.equal(Object.hasOwn(find(present), 'recruitingBaseline'), false)
  assert.deepEqual(present.workflow.lifecycle.events.map(event => event.kind), ['set-simulation-date', 'hire'])
  assert.equal(baseline.recruitingEmploymentBaseline(present.workflow, present.recruiting.hiredEmployees[0], present.recruiting), null)
  let legacy = original()
  for (const stage of ['screening', 'interview', 'offer', 'hired']) legacy = { ...legacy, ...linking.applyRecruitingToHr(legacy.recruiting, legacy.workflow, legacy.operations, owner, { type: 'advance-candidate', candidateId: 'candidate-seed-001', stage }, raw) }
  legacy = applyRecruiting(legacy, { kind: 'adopt' })
  const legacyHire = legacy.recruiting.hiredEmployees[0]
  assert.equal(baseline.recruitingEmploymentBaseline(legacy.workflow, legacyHire, legacy.recruiting), null)
  const accepted = applyEmployment(legacy, { type: 'set-simulation-date' })
  const instance = accepted.workflow.lifecycle.instances.find(item => item.employeeId === legacyHire.id)
  assert.equal(instance.templateVersion, `legacy-${legacyHire.id}`); assert.equal(Object.hasOwn(instance, 'recruitingBaseline'), false)
})

test('all four optional-extension combinations remain valid and read/adoption preserve complete records', () => {
  const neither = original(), neitherBytes = JSON.stringify(neither)
  lifecycle.lifecycleView(neither, raw)
  assert.equal(JSON.stringify(neither), neitherBytes)
  const recruitingOnly = applyRecruiting(neither, { kind: 'adopt' })
  assert.deepEqual(recruitingOnly.workflow, neither.workflow)
  const employmentOnly = applyEmployment(neither, { type: 'set-simulation-date' })
  assert.deepEqual(employmentOnly.recruiting, neither.recruiting)
  const both = applyRecruiting(employmentOnly, { kind: 'adopt' })
  assert.deepEqual(both.workflow, employmentOnly.workflow)
  for (const [state, hasRecruiting, hasEmployment] of [[neither, false, false], [recruitingOnly, true, false], [employmentOnly, false, true], [both, true, true]]) {
    assert.equal(persistence.isHrDemoState(state, raw), true)
    assert.equal(Object.hasOwn(state.recruiting, 'lifecycle'), hasRecruiting)
    assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), hasEmployment)
  }
})

test('the initial reporting graph includes baseline instances and refuses an initial cycle even after a later transfer repairs the current graph', () => {
  // Explicit raw-fixture variants isolate initial graph replay. The new hire is
  // a graph node from the beginning, despite having no fabricated hire event.
  const state = hire(), fixture = structuredClone(raw)
  fixture.employees.find(employee => employee.id === 'employee-003').managerId = employeeId
  state.performance.reviews.find(review => review.employeeId === 'employee-003').managerId = employeeId
  state.workflow.lifecycle = workflow.createHrLifecycle(state.workflow, linking.recruitingFixture(fixture, state.recruiting), null, state.recruiting)
  assert.equal(persistence.isHrDemoState(state, fixture), true, 'a baseline node can be the existing raw manager reference')
  const cyclic = structuredClone(state), cycleFixture = structuredClone(fixture)
  cycleFixture.employees[0].managerId = employeeId
  const manager = cyclic.workflow.lifecycle.instances[0]
  manager.initial.managerId = employeeId
  manager.current.managerId = null
  cyclic.workflow.lifecycle.simulationDate = date; cyclic.workflow.lifecycle.sequence = 2
  cyclic.workflow.lifecycle.events = [{ id: 'lifecycle-1', sequence: 1, kind: 'transfer', employeeId: 'employee-001', instanceId: 'employment-employee-001-1', effectiveDate: date, actor: owner, reason: '', previous: { status: 'active', department: 'Operations', jobTitle: 'Operations Manager', managerId: employeeId }, proposed: { status: 'active', department: 'Operations', jobTitle: 'Operations Manager', managerId: null } }]
  const before = JSON.stringify(cyclic)
  assert.deepEqual(lifecycle.reportingCycleIds(cyclic.workflow.lifecycle.instances.map(instance => ({ id: instance.employeeId, managerId: instance.current.managerId }))), [])
  assert.equal(persistence.isHrDemoState(cyclic, cycleFixture), false)
  assert.equal(JSON.stringify(cyclic), before)
})

test('rehire preserves the archived original baseline and receipt and creates a normal new checklist without another baseline', () => {
  let state = applyEmployment(onboard(hire()), { type: 'set-simulation-date' })
  const observed = structuredClone(find(state).recruitingBaseline), immutableRecruiting = structuredClone(state.recruiting)
  state = applyEmployment(state, { type: 'terminate', employeeId, effectiveDate: date, reason: 'Fictional original employment ended.' })
  state = applyEmployment(state, { type: 'rehire', employeeId, startDate: '2026-10-16', simulationDate: '2026-10-16', department: 'Research', jobTitle: 'Fictional researcher', managerId: 'employee-001' })
  const chain = state.workflow.lifecycle.instances.filter(instance => instance.employeeId === employeeId)
  assert.deepEqual(chain[0].recruitingBaseline, observed); assert.deepEqual(chain[0].archivedOnboarding, complete)
  assert.deepEqual(chain[1], { id: `employment-${employeeId}-2`, employeeId, startDate: '2026-10-16', endDate: null, previousInstanceId: instanceId, initial: { status: 'onboarding', department: 'Research', jobTitle: 'Fictional researcher', managerId: 'employee-001' }, current: { status: 'onboarding', department: 'Research', jobTitle: 'Fictional researcher', managerId: 'employee-001' }, templateVersion: 'sample-v1', tasks: tasks1 })
  assert.deepEqual(state.workflow.onboarding[employeeId], pending)
  assert.deepEqual(state.recruiting, immutableRecruiting)
  const forged = structuredClone(state)
  forged.workflow.lifecycle.instances.at(-1).recruitingBaseline = structuredClone(observed)
  assert.equal(persistence.isHrDemoState(forged, raw), false)
  // Current-instance guards are still required for a later rehire.
  for (const type of ['review-profile', 'review-job']) state = ordinary(state, { type, employeeId, instanceId: `employment-${employeeId}-2` })
  for (const taskId of ['profile', 'policy']) state = ordinary(state, { type: 'check-task', employeeId, instanceId: `employment-${employeeId}-2`, taskId, complete: true })
  for (const type of ['review-onboarding', 'complete-onboarding']) state = ordinary(state, { type, employeeId, instanceId: `employment-${employeeId}-2` })
  assert.deepEqual(state.workflow.onboarding[employeeId], { ...complete, receipt: 'MOCK-ONBOARDING-0002' })
  assert.deepEqual(find(state).recruitingBaseline, observed); assert.deepEqual(find(state).archivedOnboarding, complete)
  assert.deepEqual(state.workflow.lifecycle.events.map(event => event.kind), ['set-simulation-date', 'terminate', 'rehire', 'onboarding-complete'])
})
