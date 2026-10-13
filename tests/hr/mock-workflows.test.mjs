import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual pure host model without a browser, emulator, provider or
// account. Transpilation is in memory; reusable template records stay blank.
const source = readFileSync(new URL('../../src/hr/model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
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
