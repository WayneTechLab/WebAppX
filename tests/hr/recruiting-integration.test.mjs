import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const { buildRecruitingCandidate } = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle.ts', import.meta.url))
const { recruitingCoreServices } = await loadMockModel(new URL('../../src/hr/recruiting-services.ts', import.meta.url))
const { transitionRecruiting, scopedRecruiting, recruitingSummary } = await loadMockModel(new URL('../../src/hr/recruiting.ts', import.meta.url))
const { isHrDemoState } = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
const raw = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces.hr
const owner = { mode: 'native', actor: { role: 'employer-owner' } }
const at = '2026-10-15T12:00:00.000Z'

function fixture() {
  const state = structuredClone(seed)
  for (const event of [
    { type: 'set-job-status', jobId: 'job-001', status: 'published' },
    { type: 'create-job', title: 'Second fictional role', department: 'Design', managerId: 'employee-001' },
    { type: 'set-job-status', jobId: 'job-recruit-0002', status: 'published' },
  ]) state.recruiting = transitionRecruiting(state.recruiting, owner.actor, event, raw)
  assert.equal(isHrDemoState(state, raw), true)
  return state
}
function apply(state, command) {
  const before = JSON.stringify(state)
  const next = buildRecruitingCandidate(state, owner, { recordedAt: at, ...command }, raw, recruitingCoreServices).next
  assert.equal(JSON.stringify(state), before)
  assert.equal(isHrDemoState(next, raw), true)
  return next
}

test('adoption prevents a retained legacy callback from mutating frozen jobs or candidates', () => {
  const state = apply(fixture(), { kind: 'adopt' })
  const before = JSON.stringify(state)
  assert.throws(() => transitionRecruiting(state.recruiting, owner.actor, { type: 'advance-candidate', candidateId: 'candidate-seed-001', stage: 'screening' }, raw), /adopted recruiting workflow/)
  assert.throws(() => scopedRecruiting(state.recruiting, owner.actor), /adopted recruiting view/)
  assert.equal(JSON.stringify(state), before)
  assert.deepEqual(scopedRecruiting(state.recruiting, { role: 'employee', employeeId: 'employee-002' }), { jobs: [], candidates: [], hiredEmployees: [] })
  assert.throws(() => transitionRecruiting(state.recruiting, { role: 'employee' }, { type: 'create-job' }, raw), /Only the owner or HR/)
})

test('dashboard totals follow authoritative applications, terminal outcomes and hires while legacy arrays stay captured', () => {
  let state = apply(fixture(), { kind: 'adopt' })
  const legacy = structuredClone({ jobs: state.recruiting.jobs, candidates: state.recruiting.candidates, sequence: state.recruiting.sequence })
  const summary = () => recruitingSummary(state.recruiting, owner.actor)
  assert.deepEqual(summary(), { jobs: 2, openJobs: 2, draftJobs: 0, activeCandidates: 2, offers: 0, hires: 0 })
  state = apply(state, { kind: 'add-person-application', personId: 'rperson-0001', jobId: 'job-recruit-0002' })
  assert.equal(summary().activeCandidates, 3)
  state = apply(state, { kind: 'end-application', applicationId: 'rapplication-0003', expectedStage: 'applied', outcome: 'withdrawn', reason: 'Fictional person withdrew this separate application.' })
  assert.equal(summary().activeCandidates, 2)
  for (const [expectedStage, nextStage] of [['applied', 'screening'], ['screening', 'interview'], ['interview', 'offer']]) state = apply(state, { kind: 'move-application', applicationId: 'rapplication-0001', expectedStage, nextStage })
  assert.deepEqual(summary(), { jobs: 2, openJobs: 2, draftJobs: 0, activeCandidates: 2, offers: 1, hires: 0 })
  state = apply(state, { kind: 'hire', applicationId: 'rapplication-0001' })
  assert.deepEqual(summary(), { jobs: 2, openJobs: 2, draftJobs: 0, activeCandidates: 1, offers: 0, hires: 1 })
  assert.deepEqual({ jobs: state.recruiting.jobs, candidates: state.recruiting.candidates, sequence: state.recruiting.sequence }, legacy)
  for (const actor of [{ role: 'auditor' }, { role: 'payroll-admin' }, { role: 'employee', employeeId: 'employee-002' }]) assert.deepEqual(recruitingSummary(state.recruiting, actor), { jobs: 0, openJobs: 0, draftJobs: 0, activeCandidates: 0, offers: 0, hires: 0 })
})

test('actual root actor and update callbacks accept completed recruiting-only onboarding then profile materialization while rejecting undefined actor fields', async () => {
  const source = await readFile(new URL('../../src/hr/components/HrWorkspace.tsx', import.meta.url), 'utf8')
  const syntax = ts.createSourceFile('HrWorkspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const workspace = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'HrWorkspace')
  assert.ok(workspace?.body)
  const actorDeclaration = workspace.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(syntax) === 'actor')
  assert.ok(actorDeclaration?.initializer, 'exercise the actual root actor constructor')
  const declarations = ['setState', 'runAction'].map(name => {
    const declaration = workspace.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(declaration, `exercise the actual root ${name} callback`)
    return declaration.getText(syntax)
  }).join('\n')
  const { transitionMockHr } = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
  const { effectiveHrFixture } = await loadMockModel(new URL('../../src/hr/lifecycle.ts', import.meta.url))
  const { recruitingFixture } = await loadMockModel(new URL('../../src/hr/recruiting-link.ts', import.meta.url))
  const { portalRoles } = await loadMockModel(new URL('../../src/hr/model.ts', import.meta.url))
  let latest = apply(fixture(), { kind: 'adopt' })
  for (const [expectedStage, nextStage] of [['applied', 'screening'], ['screening', 'interview'], ['interview', 'offer']]) latest = apply(latest, { kind: 'move-application', applicationId: 'rapplication-0001', expectedStage, nextStage })
  latest = apply(latest, { kind: 'hire', applicationId: 'rapplication-0001' })
  const employeeId = 'employee-rperson-0001', instanceId = `employment-${employeeId}-1`
  latest.selectedEmployee = employeeId
  const constructor = ts.transpileModule(`const actor = ${actorDeclaration.initializer.getText(syntax)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const rootActor = new Function('portal', 'managementRole', 'portalRoles', 'selectedManager', 'selectedEmployee', 'fixture', `${constructor}\nreturn actor`)
  const actor = rootActor('employee', 'employer-owner', portalRoles, undefined, employeeId, effectiveHrFixture(latest, recruitingFixture(raw, latest.recruiting)))
  assert.deepEqual(actor, { role: 'employee', employeeId }, 'absent identity fields are omitted before any reducer can capture them')
  assert.deepEqual(rootActor('admin', 'employer-owner', portalRoles, undefined, employeeId, raw), { role: 'employer-owner' })
  assert.deepEqual(rootActor('manager', 'employer-owner', portalRoles, { id: 'employee-001' }, employeeId, raw), { role: 'manager', employeeId: 'employee-001' })
  assert.deepEqual(rootActor('contractor', 'employer-owner', portalRoles, undefined, employeeId, raw), { role: 'contractor', contractorId: 'contractor-001' })
  let commits = 0
  const messages = [], errors = []
  const setStoredState = update => { const next = update(latest); latest = next; commits++ }
  const callbacks = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const root = new Function('setStoredState', 'isHrDemoState', 'hrFixture', 'actor', 'transitionMockHr', 'effectiveHrFixture', 'recruitingFixture', 'setWorkflowMessage', 'setWorkflowError', `${callbacks}\nreturn {runAction,setState}`)(setStoredState, isHrDemoState, raw, actor, transitionMockHr, effectiveHrFixture, recruitingFixture, message => messages.push(message), error => errors.push(error))
  const run = event => { const previous = latest, bytes = JSON.stringify(previous), writes = commits; assert.equal(root.runAction(event), true); assert.equal(commits, writes + 1); assert.equal(JSON.stringify(previous), bytes); assert.equal(isHrDemoState(latest, raw), true) }
  for (const type of ['review-profile', 'review-job']) run({ type, employeeId })
  for (const taskId of ['profile', 'policy']) run({ type: 'check-task', employeeId, taskId, complete: true })
  for (const type of ['review-onboarding', 'complete-onboarding']) run({ type, employeeId })
  const completed = structuredClone(latest), before = JSON.stringify(latest)
  assert.equal(Object.hasOwn(latest.workflow, 'lifecycle'), false)
  const observed = { profileReviewed: true, jobReviewed: true, stage: 'complete', tasks: { profile: true, policy: true }, receipt: 'MOCK-ONBOARDING-0001' }
  assert.deepEqual(latest.workflow.onboarding[employeeId], observed); assert.equal(latest.workflow.sequence, 2)
  const event = { type: 'change-profile', employeeId, workEmail: 'casey.lifecycle@example.invalid' }
  // This reproduces the rejected browser candidate without weakening the codec
  // or repairing it with a JSON serialization round trip.
  const invalid = { ...latest, workflow: transitionMockHr(latest.workflow, { ...actor, contractorId: undefined }, event, effectiveHrFixture(latest, recruitingFixture(raw, latest.recruiting)), latest.recruiting) }
  assert.equal(Object.hasOwn(invalid.workflow.lifecycle.directoryHistory[0].actor, 'contractorId'), true)
  assert.equal(isHrDemoState(invalid, raw), false)
  assert.throws(() => root.setState(invalid), /proposed HR workspace is invalid/)
  assert.equal(JSON.stringify(latest), before); assert.equal(commits, 6)
  run(event)
  const initial = { status: 'active', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }
  const expected = structuredClone(completed)
  expected.workflow.profileEmails[employeeId] = event.workEmail
  expected.workflow.lifecycle = {
    schemaVersion: 1, simulationDate: null, sequence: 2, selectedTemplateVersion: 'sample-v1',
    instances: [
      { id: 'employment-employee-001-1', employeeId: 'employee-001', startDate: null, endDate: null, initial: { status: 'active', department: 'Operations', jobTitle: 'Operations Manager', managerId: null }, current: { status: 'active', department: 'Operations', jobTitle: 'Operations Manager', managerId: null }, templateVersion: 'legacy-employee-001', tasks: [{ id: 'intro', title: 'Welcome checklist' }] },
      { id: 'employment-employee-002-1', employeeId: 'employee-002', startDate: null, endDate: null, initial: { status: 'active', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001' }, current: { status: 'active', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001' }, templateVersion: 'legacy-employee-002', tasks: [{ id: 'profile', title: 'Profile review' }, { id: 'policy', title: 'Read welcome policy' }] },
      { id: 'employment-employee-003-1', employeeId: 'employee-003', startDate: null, endDate: null, initial: { status: 'onboarding', department: 'Engineering', jobTitle: 'Software Developer', managerId: 'employee-001' }, current: { status: 'onboarding', department: 'Engineering', jobTitle: 'Software Developer', managerId: 'employee-001' }, templateVersion: 'legacy-employee-003', tasks: [{ id: 'profile', title: 'Complete own profile' }] },
      { id: instanceId, employeeId, startDate: null, endDate: null, initial, current: { ...initial }, templateVersion: 'sample-v1', tasks: [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }], recruitingBaseline: { kind: 'recruiting-baseline', hireBindingId: 'rhire-0001', capturedOnboarding: observed, completion: { actor: 'unknown', effectiveDate: null } } },
    ],
    activeInstances: { 'employee-001': 'employment-employee-001-1', 'employee-002': 'employment-employee-002-1', 'employee-003': 'employment-employee-003-1', [employeeId]: instanceId },
    events: [], directoryHistory: [{ id: 'directory-1', sequence: 1, employeeId, field: 'workEmail', oldValue: 'casey.fiction@example.invalid', newValue: event.workEmail, actor: { role: 'employee', employeeId }, origin: 'direct' }], corrections: [], offboardingAssignments: [],
  }
  assert.deepEqual(latest, expected, 'the complete root-accepted workspace matches literal lifecycle additions and preserves every unrelated record')
  assert.equal(commits, 7); assert.equal(messages.length, 7); assert.deepEqual(errors, Array(7).fill(false))
})
