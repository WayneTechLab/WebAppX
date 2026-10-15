import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
const recruiting = await loadMockModel(new URL('../../src/hr/recruiting.ts', import.meta.url))
const linked = await loadMockModel(new URL('../../src/hr/recruiting-link.ts', import.meta.url))
const core = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle.ts', import.meta.url))
const { recruitingCoreServices } = await loadMockModel(new URL('../../src/hr/recruiting-services.ts', import.meta.url))
const employment = await loadMockModel(new URL('../../src/hr/lifecycle.ts', import.meta.url))
const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const backup = await loadMockModel(new URL('../../src/portals/backup.ts', import.meta.url))
const storage = await loadMockModel(new URL('../../src/portals/persistence.ts', import.meta.url))
const base = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }, actor = { mode: 'native', actor: owner }
const instant = '2026-10-15T12:00:00.000Z', date = '2026-10-15'
const validate = state => persistence.isHrDemoState(state, base)
const clone = value => structuredClone(value)
const bytes = value => JSON.stringify(value)
const command = (state, fields, selectedActor = actor) => core.buildRecruitingCandidate(state, selectedActor, { ...fields, recordedAt: instant }, base, recruitingCoreServices).next
const lifeAction = (state, fields) => {
  const action = { simulationDate: date, ...fields }
  const preview = employment.previewHrLifecycle(state, owner, action, base)
  return employment.confirmHrLifecycle(state, owner, action, preview.confirmation, base)
}
function seed(withEmployment = false) {
  let state = persistence.createHrDemoState(base)
  state.recruiting = recruiting.transitionRecruiting(state.recruiting, owner, { type: 'set-job-status', jobId: state.recruiting.jobs[0].id, status: 'published' }, base)
  if (withEmployment) state = lifeAction(state, { type: 'set-simulation-date', simulationDate: date })
  return state
}
function adopted(withEmployment = false) { return command(seed(withEmployment), { kind: 'adopt' }) }
function hired(withEmployment = false) {
  let state = adopted(withEmployment)
  state = command(state, { kind: 'create-person-application', jobId: state.recruiting.jobs[0].id, firstName: 'Morgan', lastName: 'Stable', workEmail: 'morgan.stable@example.invalid' })
  for (const [expectedStage, nextStage] of [['applied', 'screening'], ['screening', 'interview'], ['interview', 'offer']]) state = command(state, { kind: 'move-application', applicationId: 'rapplication-0003', expectedStage, nextStage })
  return command(state, { kind: 'hire', applicationId: 'rapplication-0003' })
}
const employeeId = 'employee-rperson-0003'
const tasks = [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }]
const rawEmployee = { id: employeeId, firstName: 'Morgan', lastName: 'Stable', workEmail: 'morgan.stable@example.invalid', department: 'Operations', jobTitle: 'Demo support specialist', employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false, onboarding: tasks.map(task => ({ ...task, status: 'pending' })), onboardingTemplateVersion: 'sample-v1' }
function completed(state) {
  const fixture = linked.recruitingFixture(base, state.recruiting)
  const instanceId = state.workflow.lifecycle?.activeInstances[employeeId]
  const self = { role: 'employee', employeeId }
  for (const event of [{ type: 'review-profile' }, { type: 'review-job' }, { type: 'check-task', taskId: 'profile', complete: true }, { type: 'check-task', taskId: 'policy', complete: true }, { type: 'review-onboarding' }, { type: 'complete-onboarding' }]) state.workflow = workflow.transitionMockHr(state.workflow, self, { ...event, employeeId, ...(instanceId ? { instanceId } : {}) }, fixture, state.recruiting)
  return state
}
function refuses(original, mutations) {
  for (const mutate of mutations) {
    const changed = clone(original); mutate(changed)
    const before = bytes(changed)
    assert.equal(validate(changed), false)
    assert.equal(bytes(changed), before, 'validation never repairs or changes rejected input')
    assert.throws(() => backup.createDemoBackup('hr', changed, validate, instant), /incomplete|incompatible/)
  }
}

test('all four optional-extension combinations round trip through the complete save and backup codecs', () => {
  for (const state of [seed(), seed(true), adopted(), adopted(true)]) {
    const before = bytes(state)
    assert.equal(validate(state), true)
    const text = backup.createDemoBackup('hr', state, validate, instant)
    assert.deepEqual(backup.parseDemoBackup(text, 'hr', validate), { state, exportedAt: instant })
    const slots = new Map(), local = { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value), removeItem: key => slots.delete(key) }
    assert.equal(storage.saveDemoState('hr', state, local).kind, 'saved')
    const loaded = storage.loadDemoState('hr', () => persistence.createHrDemoState(base), validate, local)
    assert.equal(loaded.status.kind, 'restored'); assert.deepEqual(loaded.state, state)
    assert.equal(bytes(state), before)
  }
})

test('a present malformed extension never falls back to the exact legacy validator', () => {
  const legacy = seed()
  // Existing permissive legacy definitions remain unchanged until explicit adoption.
  legacy.recruiting.jobs[0].legacyExtra = 'old compatible sample'
  assert.equal(validate(legacy), true)
  for (const extension of [null, undefined, false, {}, { schemaVersion: 2 }]) { const state = seed(); state.recruiting.lifecycle = extension; assert.equal(validate(state), false) }
  refuses(adopted(), [state => { state.recruiting.jobs[0].extra = 'unsupported' }, state => { state.recruiting.lifecycle.people[0].extra = 'unsupported' }, state => { delete state.recruiting.lifecycle.events }, state => { state.recruiting.extra = [] }])
})

test('created hire has a literal complete graph while legacy candidates remain byte-identical', () => {
  const state = hired()
  assert.equal(validate(state), true)
  assert.deepEqual(state.recruiting.hiredEmployees, [rawEmployee])
  assert.deepEqual(state.recruiting.lifecycle.hireBindings, [{ id: 'rhire-0001', personId: 'rperson-0003', applicationId: 'rapplication-0003', employeeId, provenance: { kind: 'created', eventId: 'recruit-event-0007' }, employeeSnapshot: rawEmployee, checklist: { version: 'sample-v1', tasks }, initialBalances: { vacation: 40, sick: 24 }, employmentAtHire: { kind: 'absent' }, legacyEmploymentLinks: null }])
  assert.deepEqual(state.workflow.onboarding[employeeId], { profileReviewed: false, jobReviewed: false, tasks: { profile: false, policy: false }, stage: 'draft' })
  assert.equal(state.workflow.profileEmails[employeeId], 'morgan.stable@example.invalid')
  assert.equal(state.workflow.employeeStatuses[employeeId], 'onboarding')
  assert.deepEqual(state.operations.balances[employeeId], { vacation: 40, sick: 24 })
  assert.deepEqual(state.recruiting.candidates, seed().recruiting.candidates)
  assert.equal(state.recruiting.candidates.some(candidate => candidate.employeeId === employeeId), false)
  refuses(state, [value => { delete value.workflow.onboarding[employeeId] }, value => { delete value.operations.balances[employeeId] }, value => { value.recruiting.hiredEmployees[0].workEmail = 'forged@example.invalid' }, value => { value.recruiting.lifecycle.applications[2].hireBindingId = null }, value => { value.recruiting.candidates[0].stage = 'hired'; value.recruiting.candidates[0].employeeId = employeeId }])
})

test('frozen legacy arrays, activities, raw-hire prefix and captured known employment links refuse forgery', () => {
  let state = seed(true)
  const candidateId = state.recruiting.candidates[0].id
  for (const stage of ['screening', 'interview', 'offer', 'hired']) state = { ...state, ...linked.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, { type: 'advance-candidate', candidateId, stage }, base) }
  state = command(state, { kind: 'adopt' })
  assert.equal(validate(state), true)
  assert.deepEqual(state.recruiting.lifecycle.adoption.legacyHireLinks, [{ employeeId: 'employee-recruit-seed-001', instanceId: 'employment-employee-recruit-seed-001-1', hireEventId: 'lifecycle-2' }])
  refuses(state, [value => { value.recruiting.jobs[0].activity[0].action = 'changed' }, value => { value.recruiting.candidates[0].activity.reverse() }, value => { value.recruiting.sequence++ }, value => { value.recruiting.hiredEmployees[0].department = 'forged' }, value => { const link = value.recruiting.lifecycle.adoption.legacyHireLinks[0]; link.instanceId = 'employment-employee-002-1'; value.recruiting.lifecycle.events[0].adoption.legacyHireLinks[0] = clone(link); value.recruiting.lifecycle.hireBindings[0].legacyEmploymentLinks.instanceId = link.instanceId }])
})

test('created employment-at-hire links exact native actor, instance, initial template and captured checklist', () => {
  const state = hired(true)
  assert.equal(validate(state), true)
  assert.deepEqual(state.recruiting.lifecycle.hireBindings[0].employmentAtHire, { kind: 'created', instanceId: 'employment-employee-rperson-0003-1', hireEventId: 'lifecycle-2' })
  assert.deepEqual(state.workflow.lifecycle.instances.at(-1), { id: 'employment-employee-rperson-0003-1', employeeId, startDate: date, endDate: null, initial: { status: 'onboarding', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }, current: { status: 'onboarding', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }, templateVersion: 'sample-v1', tasks })
  refuses(state, [value => { value.workflow.lifecycle.events[1].actor = { role: 'hr-admin' } }, value => { delete value.workflow.lifecycle }, value => { value.workflow.lifecycle.instances.at(-1).initial.status = 'active'; value.workflow.lifecycle.instances.at(-1).current.status = 'active'; value.workflow.lifecycle.events[1].proposed.status = 'active'; value.workflow.employeeStatuses[employeeId] = 'active' }, value => { value.workflow.lifecycle.instances.at(-1).recruitingBaseline = { kind: 'recruiting-baseline' } }])
  const complete = completed(state)
  assert.equal(validate(complete), true)
  refuses(complete, [value => { value.workflow.onboarding[employeeId].receipt = 'forged-completion' }, value => { value.workflow.onboarding[employeeId].receipt = 'MOCK-ONBOARDING-00001' }])
})

test('mutually consistent raw, binding and event checklist forgeries still require a supported immutable template', () => {
  refuses(hired(), [value => {
    value.recruiting.hiredEmployees[0].onboarding[0].title = 'Forged task title'
    const binding = value.recruiting.lifecycle.hireBindings[0]
    binding.employeeSnapshot.onboarding[0].title = 'Forged task title'
    binding.checklist.tasks[0].title = 'Forged task title'
    value.recruiting.lifecycle.events.at(-1).hire = clone(binding)
  }, value => {
    delete value.recruiting.hiredEmployees[0].onboardingTemplateVersion
    delete value.recruiting.lifecycle.hireBindings[0].employeeSnapshot.onboardingTemplateVersion
    delete value.recruiting.lifecycle.events.at(-1).hire.employeeSnapshot.onboardingTemplateVersion
  }])
})

test('ordinary onboarding before employment requires exact completion, canonical receipt and unique ownership', () => {
  const state = completed(hired())
  assert.equal(validate(state), true)
  assert.deepEqual(state.workflow.onboarding[employeeId], { profileReviewed: true, jobReviewed: true, tasks: { profile: true, policy: true }, stage: 'complete', receipt: 'MOCK-ONBOARDING-0001' })
  refuses(state, [value => { value.workflow.onboarding[employeeId].profileReviewed = false }, value => { value.workflow.onboarding[employeeId].tasks.profile = false }, value => { value.workflow.onboarding[employeeId].receipt = 'MOCK-ONBOARDING-00001' }, value => { value.workflow.onboarding[employeeId].receipt = 'MOCK-ONBOARDING-0002' }, value => { value.workflow.onboarding['employee-002'].receipt = 'MOCK-ONBOARDING-0001' }, value => { delete value.workflow.onboarding[employeeId].receipt }])
  const unfinished = hired(); unfinished.workflow.employeeStatuses[employeeId] = 'active'; assert.equal(validate(unfinished), false)
})

test('later employment materialization captures a literal completed recruiting baseline without invented events', () => {
  const state = lifeAction(completed(hired()), { type: 'set-simulation-date', simulationDate: date })
  assert.equal(validate(state), true)
  assert.deepEqual(state.workflow.lifecycle.instances.at(-1), { id: 'employment-employee-rperson-0003-1', employeeId, startDate: null, endDate: null, initial: { status: 'active', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }, current: { status: 'active', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }, templateVersion: 'sample-v1', tasks, recruitingBaseline: { kind: 'recruiting-baseline', hireBindingId: 'rhire-0001', capturedOnboarding: { profileReviewed: true, jobReviewed: true, tasks: { profile: true, policy: true }, stage: 'complete', receipt: 'MOCK-ONBOARDING-0001' }, completion: { actor: 'unknown', effectiveDate: null } } })
  assert.deepEqual(state.workflow.lifecycle.events, [{ id: 'lifecycle-1', sequence: 1, kind: 'set-simulation-date', effectiveDate: date, actor: owner, reason: '', previous: null, proposed: date }])
  refuses(state, [value => { value.workflow.lifecycle.instances.at(-1).recruitingBaseline.completion.actor = 'employer-owner' }, value => { value.workflow.lifecycle.instances.at(-1).recruitingBaseline.capturedOnboarding.receipt = 'MOCK-ONBOARDING-00001' }, value => { value.workflow.lifecycle.instances.at(-1).recruitingBaseline.hireBindingId = 'missing' }, value => { delete value.workflow.lifecycle.instances.at(-1).recruitingBaseline }, value => { value.workflow.lifecycle.instances.at(-1).startDate = date }])
})

test('incomplete baseline permits only real later completion and archived baseline remains bound after rehire', () => {
  let unfinished = lifeAction(hired(), { type: 'set-simulation-date', simulationDate: date })
  assert.equal(validate(unfinished), true)
  assert.equal(unfinished.workflow.lifecycle.instances.at(-1).initial.status, 'onboarding')
  assert.equal(unfinished.workflow.lifecycle.instances.at(-1).recruitingBaseline.completion, null)
  unfinished = completed(unfinished); assert.equal(validate(unfinished), true)
  assert.equal(unfinished.workflow.lifecycle.events.at(-1).kind, 'onboarding-complete')
  let state = lifeAction(completed(hired()), { type: 'terminate', employeeId, effectiveDate: date, reason: 'Fictional archived employment.' })
  state = lifeAction(state, { type: 'rehire', employeeId, simulationDate: '2026-10-16', startDate: '2026-10-16', department: 'Research', jobTitle: 'Researcher', managerId: 'employee-001' })
  assert.equal(validate(state), true)
  assert.equal(state.workflow.lifecycle.instances.at(-2).recruitingBaseline.completion.actor, 'unknown')
  assert.equal(Object.hasOwn(state.workflow.lifecycle.instances.at(-1), 'recruitingBaseline'), false)
  refuses(state, [value => { value.workflow.lifecycle.instances.at(-2).recruitingBaseline.capturedOnboarding.tasks.policy = false }, value => { value.workflow.lifecycle.instances.at(-1).recruitingBaseline = clone(value.workflow.lifecycle.instances.at(-2).recruitingBaseline) }, value => { value.workflow.lifecycle.instances.at(-2).archivedOnboarding.receipt = 'MOCK-ONBOARDING-0009' }])
})

test('first profile history for a created hire stays anchored to immutable email while later legitimate edits restore', () => {
  const state = hired()
  state.workflow = workflow.transitionMockHr(state.workflow, { role: 'employee', employeeId }, { type: 'change-profile', employeeId, workEmail: 'changed.morgan@example.invalid' }, linked.recruitingFixture(base, state.recruiting), state.recruiting)
  assert.equal(validate(state), true)
  assert.deepEqual(state.workflow.lifecycle.directoryHistory[0], { id: 'directory-1', sequence: 1, employeeId, field: 'workEmail', oldValue: 'morgan.stable@example.invalid', newValue: 'changed.morgan@example.invalid', actor: { role: 'employee', employeeId }, origin: 'direct' })
  refuses(state, [value => { value.workflow.lifecycle.directoryHistory[0].oldValue = 'unrecorded@example.invalid' }, value => { value.workflow.profileEmails[employeeId] = 'unrecorded@example.invalid' }])
})

test('complete envelope cap includes unrelated fields and validation refuses hostile JSON without getter execution', () => {
  const state = adopted(); const before = bytes(state)
  const overhead = bytes({ schemaVersion: 1, module: 'hr', data: { ...state, padding: '' } }).length
  state.padding = 'x'.repeat(2_000_000 - overhead)
  assert.equal(bytes({ schemaVersion: 1, module: 'hr', data: state }).length, 2_000_000)
  assert.equal(validate(state), true)
  state.padding += 'x'; assert.equal(validate(state), false)
  const hostile = JSON.parse(before); let reads = 0
  Object.defineProperty(hostile.recruiting.lifecycle.people[0], 'privateGetter', { enumerable: true, get() { reads++; return 'secret' } })
  assert.equal(validate(hostile), false); assert.equal(reads, 0)
  const nested = JSON.parse(before)
  Object.defineProperty(nested.workflow, 'onboarding', { enumerable: true, get() { reads++; return {} } })
  assert.equal(validate(nested), false); assert.equal(reads, 0)
  const rootAccessor = JSON.parse(before), validRecruiting = clone(rootAccessor.recruiting)
  Object.defineProperty(rootAccessor, 'recruiting', { enumerable: true, get() { reads++; return validRecruiting } })
  assert.equal(validate(rootAccessor), false); assert.equal(reads, 0)
  const raw = bytes({ schemaVersion: 1, module: 'hr', data: hostile })
  const loaded = storage.loadDemoState('hr', () => persistence.createHrDemoState(base), validate, { getItem: () => raw })
  assert.equal(loaded.status.kind, 'recovered')
})
