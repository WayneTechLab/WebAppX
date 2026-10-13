import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual pure host model without a browser, emulator, provider or
// account. Transpilation is in memory; reusable template records stay blank.
const source = readFileSync(new URL('../../src/hr/model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const modelUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
const model = await import(modelUrl)
const workflowSource = readFileSync(new URL('../../src/hr/mock-workflows.ts', import.meta.url), 'utf8')
const workflowCompiled = ts.transpileModule(workflowSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/from ['"]\.\/model['"]/, `from '${modelUrl}'`)
const workflow = await import(`data:text/javascript;base64,${Buffer.from(workflowCompiled).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const employees = [
  { id: 'manager-one', managerId: null, firstName: 'Morgan', lastName: 'Sample', department: 'Engineering', workEmail: 'morgan@example.test', jobTitle: 'Team lead', employmentStatus: 'active' },
  { id: 'employee-one', managerId: 'manager-one', firstName: 'Alex', lastName: 'Example', department: 'Engineering', workEmail: 'alex@example.test', jobTitle: 'Developer', employmentStatus: 'active' },
  { id: 'employee-two', managerId: 'manager-two', firstName: 'Sam', lastName: 'Fiction', department: 'Operations', workEmail: 'sam@example.test', jobTitle: 'Specialist', employmentStatus: 'onboarding' },
]

test('demo routes cannot become production portal paths or accept malformed resource identifiers', () => {
  assert.deepEqual(model.resolveHrPath('/hr/demo/employee/profile'), { demo: true, portal: 'employee', canonical: '/employee/profile' })
  assert.deepEqual(model.resolveHrPath('/admin/hr/employees'), { demo: false, portal: 'admin', canonical: '/admin/hr/employees' })
  assert.equal(model.resolveHrPath('/employee-elsewhere'), null)
  assert.equal(model.resolveHrPath('/hr/demo/administer'), null)
  const routes = [{ path: '/admin/hr/employees/:employeeId' }, { path: '/admin/hr/employees/onboarding' }]
  assert.equal(model.matchHrRoute('/admin/hr/employees/onboarding', routes).route.path, '/admin/hr/employees/onboarding')
  assert.equal(model.matchHrRoute('/admin/hr/employees/employee-one', routes).parameters.employeeId, 'employee-one')
  for (const id of ['%2Fsecret', '%2e%2e', '%', '%00', 'employee%20one']) assert.equal(model.matchHrRoute(`/admin/hr/employees/${id}`, routes), null)
  assert.equal(model.matchHrRoute('/admin/hr/employees/employee-one/more', routes), null)
})

test('route policy excludes employee, manager and contractor from employer payroll', () => {
  const payroll = { roles: ['employer-owner', 'payroll-admin', 'auditor'] }
  for (const role of ['employee', 'manager', 'contractor', 'hr-admin', 'untrusted']) assert.equal(model.canViewRoute({ role }, payroll), false)
  assert.equal(model.canViewRoute({ role: 'payroll-admin' }, payroll), true)
  assert.equal(model.canViewCompensation({ role: 'manager', employeeId: 'manager-one' }, 'employee-one'), false)
  assert.equal(model.canViewCompensation({ role: 'employee', employeeId: 'employee-one' }, 'employee-two'), false)
  assert.equal(model.canViewCompensation({ role: 'employee', employeeId: 'employee-one' }, 'employee-one'), true)
  assert.equal(model.canViewCompensation({ role: 'employee' }), false)
})

test('self-service and manager projections exclude unrelated records and contractor data', () => {
  const employee = { role: 'employee', employeeId: 'employee-one' }
  const manager = { role: 'manager', employeeId: 'manager-one' }
  assert.deepEqual(model.scopedEmployees(employee, employees).map(record => record.id), ['employee-one'])
  assert.deepEqual(model.scopedEmployees(manager, employees).map(record => record.id), ['manager-one', 'employee-one'])
  assert.deepEqual(model.scopedEmployees({ role: 'contractor' }, employees), [])
  const documents = [{ id: 'own', employeeId: 'employee-one' }, { id: 'other', employeeId: 'employee-two' }, { id: 'private-company' }, { id: 'contractor', contractorId: 'contractor-one' }]
  assert.deepEqual(model.scopedRecords(employee, documents, employees).map(record => record.id), ['own'])
  assert.deepEqual(model.scopedRecords(manager, documents, employees).map(record => record.id), ['own'])
  assert.deepEqual(model.scopedRecords({ role: 'employee' }, documents, employees), [])
  assert.deepEqual(model.scopedRecords({ role: 'contractor' }, documents, employees), [])
  assert.deepEqual(model.scopedRecords({ role: 'unknown' }, documents, employees), [])
  assert.deepEqual(model.scopedEmployees({ role: 'unknown' }, employees), [])
  assert.deepEqual(model.scopedRecords({ role: 'contractor', contractorId: 'contractor-one' }, documents, employees).map(record => record.id), ['contractor'])
})

test('profile writes respect the portable role policy and absent amounts remain absent', () => {
  for (const role of ['auditor', 'payroll-admin', 'manager', 'contractor']) assert.equal(model.canEditEmployeeProfile({ role }, 'employee-one'), false)
  assert.equal(model.canEditEmployeeProfile({ role: 'hr-admin' }, 'employee-one'), true)
  assert.equal(model.canEditEmployeeProfile({ role: 'employee', employeeId: 'employee-one' }, 'employee-one'), true)
  assert.equal(model.canEditEmployeeProfile({ role: 'employee', employeeId: 'employee-one' }, 'employee-two'), false)
  assert.equal(model.canEditEmployeeProfile({ role: 'employee' }, 'employee-one'), false)
  for (const value of [undefined, null, '']) assert.equal(model.formatMoney(value), 'Not included')
  assert.equal(model.formatMoney(0), '$0.00')
})

test('sample time-off approval requires pending status and manager team ownership', () => {
  const manager = { role: 'manager', employeeId: 'manager-one' }
  assert.equal(model.canApproveTimeOff(manager, { employeeId: 'employee-one', status: 'pending' }, employees), true)
  for (const employeeId of ['employee-two', 'manager-one', 'unknown']) assert.equal(model.canApproveTimeOff(manager, { employeeId, status: 'pending' }, employees), false)
  assert.equal(model.canApproveTimeOff({ role: 'employee', employeeId: 'employee-one' }, { employeeId: 'employee-one', status: 'pending' }, employees), false)
  assert.equal(model.canApproveTimeOff({ role: 'hr-admin' }, { employeeId: 'employee-one', status: 'approved' }, employees), false)
  assert.equal(model.canApproveTimeOff({ role: 'employer-owner' }, { employeeId: 'employee-two', status: 'requested' }, employees), true)
  assert.equal(model.canApproveTimeOff({ role: 'manager' }, { employeeId: 'unassigned', status: 'pending' }, [{ id: 'unassigned' }]), false)
})

test('time request validation rejects impossible, reversed and excessive dates and hours', () => {
  assert.deepEqual(model.validateTimeOff('2028-02-29', '2028-03-01'), { valid: true, days: 2 })
  for (const [start, end] of [['2026-02-29', '2026-03-01'], ['2026-10-20', '2026-10-19'], ['2026-10-01', '2026-11-01'], ['10/01/2026', '2026-10-02']]) assert.equal(model.validateTimeOff(start, end).valid, false)
  for (const hours of [0, -1, 24.01, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(model.validateTimeEntry('2026-10-15', hours).valid, false)
  assert.equal(model.validateTimeEntry('2026-02-30', 8).valid, false)
  assert.equal(model.validateTimeEntry('2026-10-15', 7.5).valid, true)
})

test('employee search applies status and case-insensitive text together', () => {
  assert.deepEqual(model.searchEmployees(employees, ' ENGINEERING ', 'active').map(record => record.id), ['manager-one', 'employee-one'])
  assert.deepEqual(model.searchEmployees(employees, 'sam@', 'onboarding').map(record => record.id), ['employee-two'])
  assert.deepEqual(model.searchEmployees(employees, 'sam@', 'active'), [])
})

const selfActor = { role: 'employee', employeeId: fixture.actors.selfEmployeeId }
const managerActor = { role: 'manager', employeeId: fixture.actors.managerEmployeeId }
const ownerActor = { role: 'employer-owner' }
const change = (state, actor, event) => workflow.transitionMockHr(state, actor, event, fixture)

test('onboarding requires profile, job and checklist review then confirmation, and updates shared directory status', () => {
  const person = fixture.employees.find(employee => employee.employmentStatus === 'onboarding')
  const actor = { role: 'employee', employeeId: person.id }
  let state = workflow.createMockHrState(fixture)
  const initial = structuredClone(state)
  assert.throws(() => change(state, actor, { type: 'complete-onboarding', employeeId: person.id }), /Review sample onboarding/)
  assert.throws(() => change(state, actor, { type: 'review-onboarding', employeeId: person.id }), /finish every/)
  assert.throws(() => change(state, selfActor, { type: 'review-profile', employeeId: person.id }), /cannot change/)
  assert.throws(() => change(state, actor, { type: 'check-task', employeeId: person.id, taskId: 'constructor', complete: true }), /not found/)
  state = change(state, actor, { type: 'review-profile', employeeId: person.id })
  state = change(state, actor, { type: 'review-job', employeeId: person.id })
  for (const task of person.onboarding) state = change(state, actor, { type: 'check-task', employeeId: person.id, taskId: task.id, complete: true })
  state = change(state, actor, { type: 'review-onboarding', employeeId: person.id })
  assert.equal(state.onboarding[person.id].stage, 'reviewed')
  state = change(state, actor, { type: 'complete-onboarding', employeeId: person.id })
  assert.equal(state.employeeStatuses[person.id], 'active')
  assert.equal(state.onboarding[person.id].stage, 'complete')
  assert.match(state.onboarding[person.id].receipt, /^MOCK-ONBOARDING-/)
  assert.deepEqual(workflow.createMockHrState(fixture), initial)
  assert.throws(() => change(state, actor, { type: 'complete-onboarding', employeeId: person.id }), /locked/)
})

test('time drafting and employee submission enforce ownership, and manager approval excludes self and other teams', () => {
  let state = workflow.createMockHrState(fixture)
  state = change(state, selfActor, { type: 'add-time', date: '2026-10-15', hours: 7.5, source: 'manual' })
  const entry = state.timeEntries.at(-1)
  assert.equal(entry.status, 'draft')
  assert.throws(() => change(state, managerActor, { type: 'submit-time', entryIds: [entry.id] }), /own draft/)
  assert.throws(() => change(state, selfActor, { type: 'approve-time', entryId: entry.id }), /Approval requires/)
  state = change(state, selfActor, { type: 'submit-time', entryIds: [entry.id] })
  assert.equal(state.timeEntries.at(-1).status, 'submitted')
  assert.throws(() => change(state, { role: 'manager', employeeId: 'unrelated-manager' }, { type: 'approve-time', entryId: entry.id }), /Approval requires/)
  state = change(state, managerActor, { type: 'approve-time', entryId: entry.id })
  assert.equal(state.timeEntries.at(-1).status, 'approved')
  state = change(state, managerActor, { type: 'add-time', date: '2026-10-15', hours: 8, source: 'manual' })
  const managerEntry = state.timeEntries.at(-1)
  state = change(state, managerActor, { type: 'submit-time', entryIds: [managerEntry.id] })
  assert.throws(() => change(state, managerActor, { type: 'approve-time', entryId: managerEntry.id }), /self-approval/)
  assert.throws(() => change(state, ownerActor, { type: 'add-time', date: '2026-10-15', hours: 8, source: 'manual' }), /bound synthetic/)
})

test('sample timer rejects invalid clocks and durations and records elapsed time without external state', () => {
  assert.equal(workflow.elapsedMockHours(1000, 3601000), 1)
  assert.equal(workflow.elapsedMockHours(1000, 1001), 0.0001)
  for (const [start, end] of [[1000, 1000], [1000, 999], [0, 86400001], [Number.NaN, 1000]]) assert.throws(() => workflow.elapsedMockHours(start, end))
  const state = change(workflow.createMockHrState(fixture), selfActor, { type: 'add-time', date: '2026-10-15', hours: workflow.elapsedMockHours(1000, 1801000), source: 'timer' })
  assert.equal(state.timeEntries.at(-1).hours, 0.5)
  assert.equal(state.timeEntries.at(-1).source, 'timer')
  assert.equal(state.timeEntries.at(-1).status, 'draft')
})

test('combined sample time for one employee/day cannot exceed 24 hours', () => {
  let state = workflow.createMockHrState(fixture)
  state = change(state, selfActor, { type: 'add-time', date: '2026-10-09', hours: 16, source: 'manual' })
  assert.throws(() => change(state, selfActor, { type: 'add-time', date: '2026-10-09', hours: 0.01, source: 'timer' }), /Combined/)
  assert.equal(state.timeEntries.filter(entry => entry.employeeId === selfActor.employeeId && entry.date === '2026-10-09').reduce((sum, entry) => sum + entry.hours, 0), 24)
})

test('benefit elections require the own available plan and review before confirmation', () => {
  let state = workflow.createMockHrState(fixture)
  const plan = fixture.benefits.find(value => value.employeeIds.includes(selfActor.employeeId))
  assert.throws(() => change(state, selfActor, { type: 'confirm-benefit', planId: plan.id }), /Choose a sample election/)
  assert.throws(() => change(state, managerActor, { type: 'elect-benefit', planId: plan.id, election: 'enroll' }), /employee self/)
  assert.throws(() => change(state, { role: 'employee', employeeId: 'unknown' }, { type: 'elect-benefit', planId: plan.id, election: 'enroll' }), /bound synthetic/)
  state = change(state, selfActor, { type: 'elect-benefit', planId: plan.id, election: 'enroll' })
  assert.throws(() => change(state, selfActor, { type: 'confirm-benefit', planId: plan.id }), /Review the sample election/)
  state = change(state, selfActor, { type: 'review-benefit', planId: plan.id })
  state = change(state, selfActor, { type: 'confirm-benefit', planId: plan.id })
  assert.equal(state.benefitElections[0].employeeId, selfActor.employeeId)
  assert.equal(state.benefitElections[0].stage, 'confirmed')
  assert.match(state.benefitElections[0].receipt, /^MOCK-BENEFIT-/)
  assert.throws(() => change(state, selfActor, { type: 'elect-benefit', planId: plan.id, election: 'waive' }), /locked/)
})

test('payroll freezes approved time and elections, calculates separate fictional deductions and blocks receipt replay', () => {
  let state = workflow.createMockHrState(fixture)
  const time = state.timeEntries.find(entry => entry.employeeId === selfActor.employeeId && entry.status === 'submitted')
  const plans = fixture.benefits.filter(plan => plan.employeeIds.includes(selfActor.employeeId))
  assert.throws(() => change(state, ownerActor, { type: 'prepare-payroll' }), /Approve at least one/)
  for (const role of ['manager', 'employee', 'hr-admin', 'auditor', 'contractor']) assert.throws(() => change(state, { role, employeeId: selfActor.employeeId }, { type: 'prepare-payroll' }), /Only the employer/)
  assert.throws(() => change(state, ownerActor, { type: 'submit-payroll' }), /Review fictional/)
  state = change(state, managerActor, { type: 'approve-time', entryId: time.id })
  for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) state = change(state, selfActor, { type, planId: plans[0].id, election: 'enroll' })
  state = change(state, ownerActor, { type: 'prepare-payroll' })
  assert.equal(state.payroll.inputs.length, 1)
  assert.equal(state.payroll.inputs[0].hours, time.hours)
  assert.equal(state.payroll.benefitInputs.length, 1)
  if (plans[1]) for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) state = change(state, selfActor, { type, planId: plans[1].id, election: 'enroll' })
  assert.equal(state.payroll.benefitInputs.length, 1)
  state = change(state, ownerActor, { type: 'calculate-payroll' })
  assert.equal(state.payroll.grossCents, time.hours * 3000)
  assert.equal(state.payroll.illustrativeWithholdingCents, Math.round(time.hours * 3000 * 0.2))
  assert.equal(state.payroll.benefitDeductionCents, 2500)
  assert.equal(state.payroll.netCents, state.payroll.grossCents - state.payroll.illustrativeWithholdingCents - 2500)
  state = change(state, ownerActor, { type: 'review-payroll' })
  state = change(state, ownerActor, { type: 'submit-payroll' })
  assert.match(state.payroll.receipt, /^MOCK-PAYROLL-/)
  assert.equal(state.payrollHistory.length, 1)
  assert.equal(state.timeEntries.find(entry => entry.id === time.id).payrollReceipt, state.payroll.receipt)
  assert.throws(() => change(state, ownerActor, { type: 'submit-payroll' }), /Review fictional/)
  assert.throws(() => change(state, ownerActor, { type: 'prepare-payroll' }), /Approve at least one/)
  assert.equal(fixture.timeEntries.find(entry => entry.id === time.id).status, 'submitted')
})

test('payroll excludes inactive/onboarding employees and approved dates outside the fixed sample period', () => {
  let state = workflow.createMockHrState(fixture)
  const onboardingEmployee = fixture.employees.find(employee => employee.employmentStatus === 'onboarding')
  const onBoardActor = { role: 'employee', employeeId: onboardingEmployee.id }
  state = change(state, onBoardActor, { type: 'add-time', date: '2026-10-15', hours: 8, source: 'manual' })
  const unready = state.timeEntries.at(-1)
  state = change(state, onBoardActor, { type: 'submit-time', entryIds: [unready.id] })
  state = change(state, managerActor, { type: 'approve-time', entryId: unready.id })
  state = change(state, selfActor, { type: 'add-time', date: '2026-10-16', hours: 8, source: 'manual' })
  const outside = state.timeEntries.at(-1)
  state = change(state, selfActor, { type: 'submit-time', entryIds: [outside.id] })
  state = change(state, managerActor, { type: 'approve-time', entryId: outside.id })
  assert.throws(() => change(state, ownerActor, { type: 'prepare-payroll' }), /active sample employee/)
  state = change(state, onBoardActor, { type: 'review-profile', employeeId: onboardingEmployee.id })
  state = change(state, onBoardActor, { type: 'review-job', employeeId: onboardingEmployee.id })
  for (const task of onboardingEmployee.onboarding) state = change(state, onBoardActor, { type: 'check-task', employeeId: onboardingEmployee.id, taskId: task.id, complete: true })
  state = change(state, onBoardActor, { type: 'review-onboarding', employeeId: onboardingEmployee.id })
  state = change(state, onBoardActor, { type: 'complete-onboarding', employeeId: onboardingEmployee.id })
  state = change(state, ownerActor, { type: 'prepare-payroll' })
  assert.deepEqual(state.payroll.inputs.map(input => input.entryId), [unready.id])
  assert.equal(state.payroll.inputs.some(input => input.entryId === outside.id), false)
})
