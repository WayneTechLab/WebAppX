import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/hr/recruiting.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const recruiting = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const hr = { role: 'hr-admin' }
const change = (state, event, actor = owner, data = fixture) => recruiting.transitionRecruiting(state, actor, event, data)
function published() {
  const state = recruiting.createRecruitingState(fixture)
  return change(state, { type: 'set-job-status', jobId: state.jobs[0].id, status: 'published' })
}
function advance(state, candidateId, stages) {
  return stages.reduce((current, stage) => change(current, { type: 'advance-candidate', candidateId, stage }), state)
}

test('fictional recruiting journey creates one onboarding employee with the job manager and unconfigured compensation', () => {
  const initial = recruiting.createRecruitingState(fixture)
  let state = published()
  const candidateId = state.candidates[0].id
  state = advance(state, candidateId, ['screening', 'interview', 'offer', 'hired'])
  assert.equal(initial.jobs[0].status, 'draft')
  assert.equal(initial.hiredEmployees.length, 0)
  assert.equal(state.candidates[0].stage, 'hired')
  const employee = state.hiredEmployees[0]
  assert.match(employee.id, /^employee-recruit-/)
  assert.equal(state.candidates[0].employeeId, employee.id)
  assert.equal(employee.workEmail, state.candidates[0].workEmail)
  assert.equal(employee.managerId, state.jobs[0].managerId)
  assert.equal(employee.department, state.jobs[0].department)
  assert.equal(employee.jobTitle, state.jobs[0].title)
  assert.equal(employee.employmentStatus, 'onboarding')
  assert.equal(employee.payCents, 0)
  assert.equal(employee.compensationConfigured, false)
  assert.equal(employee.compensationStatus, 'unconfigured-synthetic')
  assert.deepEqual(employee.onboarding.map(task => task.status), ['pending', 'pending'])
  assert.match(state.candidates[0].activity.at(-1).receipt, /^MOCK-RECRUIT-\d{4}$/)
  assert.throws(() => advance(state, candidateId, ['hired']), /final stage/)
  assert.throws(() => advance(state, candidateId, ['rejected']), /final stage/)
  assert.equal(state.hiredEmployees.length, 1)
})

test('job publication, pipeline ordering and terminal rejection are enforced by transitions', () => {
  let state = recruiting.createRecruitingState(fixture)
  const candidateId = state.candidates[0].id
  assert.throws(() => advance(state, candidateId, ['screening']), /Publish/)
  assert.throws(() => change(state, { type: 'set-job-status', jobId: state.jobs[0].id, status: 'closed' }), /Only a published/)
  state = published()
  for (const stage of ['interview', 'offer', 'hired', 'unsupported']) assert.throws(() => advance(state, candidateId, [stage]), /in order/)
  state = advance(state, candidateId, ['screening'])
  assert.throws(() => advance(state, candidateId, ['screening']), /in order/)
  state = advance(state, candidateId, ['rejected'])
  for (const stage of ['screening', 'interview', 'hired', 'rejected']) assert.throws(() => advance(state, candidateId, [stage]), /final stage/)
  assert.equal(state.hiredEmployees.length, 0)
})

test('jobs close only after active applications have a final outcome and closed jobs cannot reopen', () => {
  let state = published()
  const jobId = state.jobs[0].id
  assert.throws(() => change(state, { type: 'set-job-status', jobId, status: 'published' }), /Only a draft/)
  assert.throws(() => change(state, { type: 'set-job-status', jobId, status: 'closed' }), /Hire or reject/)
  for (const candidate of state.candidates) state = advance(state, candidate.id, ['rejected'])
  state = change(state, { type: 'set-job-status', jobId, status: 'closed' })
  assert.equal(state.jobs[0].status, 'closed')
  assert.throws(() => change(state, { type: 'set-job-status', jobId, status: 'published' }), /Only a draft/)
  assert.throws(() => change(state, { type: 'create-candidate', jobId, firstName: 'Alex', lastName: 'Sample', workEmail: 'alex@example.invalid' }), /Publish/)
})

test('candidate creation accepts only fictional email domains and prevents company-wide duplicate applications', () => {
  let state = published()
  const event = { type: 'create-candidate', jobId: state.jobs[0].id, firstName: 'Alex', lastName: 'Sample', workEmail: 'ALEX.SAMPLE@EXAMPLE.INVALID' }
  for (const workEmail of ['alex@gmail.com', 'alex@example.com', 'alex@example.invalid.evil.com', 'alex@invalid', 'alex@example..invalid', 'alex example@example.invalid']) assert.throws(() => change(state, { ...event, workEmail }), /fictional email/)
  state = change(state, event)
  assert.equal(state.candidates.at(-1).workEmail, 'alex.sample@example.invalid')
  assert.throws(() => change(state, { ...event, workEmail: 'Alex.Sample@Example.Invalid' }), /already belongs/)
  assert.throws(() => change(state, { ...event, workEmail: fixture.employees[0].workEmail }), /already belongs/)
  const candidateId = state.candidates.at(-1).id
  state = advance(state, candidateId, ['rejected'])
  assert.throws(() => change(state, event), /already belongs/)
  assert.throws(() => change(state, { ...event, workEmail: 'new@example.invalid', firstName: 'A\u0000lex' }), /printable/)
})

test('candidate projections and mutations are denied outside owner and HR administrator roles', () => {
  const state = published()
  for (const role of ['employee', 'manager', 'payroll-admin', 'auditor', 'contractor', 'unknown']) {
    const actor = { role, employeeId: 'employee-001' }
    assert.deepEqual(recruiting.scopedRecruiting(state, actor), { jobs: [], candidates: [], hiredEmployees: [] })
    assert.deepEqual(recruiting.recruitingSummary(state, actor), { jobs: 0, openJobs: 0, draftJobs: 0, activeCandidates: 0, offers: 0, hires: 0 })
    assert.throws(() => change(state, { type: 'advance-candidate', candidateId: state.candidates[0].id, stage: 'screening' }, actor), /Only the owner/)
  }
  assert.equal(recruiting.scopedRecruiting(state, hr).candidates.length, state.candidates.length)
  const next = change(state, { type: 'advance-candidate', candidateId: state.candidates[0].id, stage: 'screening' }, hr)
  assert.equal(next.candidates[0].activity.at(-1).actorRole, 'hr-admin')
})

test('sample jobs validate title, department, manager ownership and duplicate open jobs', () => {
  let state = recruiting.createRecruitingState(fixture)
  const event = { type: 'create-job', title: 'Demo designer', department: 'Design', managerId: 'employee-001' }
  for (const managerId of ['foreign', 'employee-002', 'employee-003', '']) assert.throws(() => change(state, { ...event, managerId }), /active sample manager/)
  assert.throws(() => change(state, { ...event, title: ' ' }), /job title/)
  assert.throws(() => change(state, { ...event, department: ' ' }), /department/)
  state = change(state, event)
  assert.equal(state.jobs.at(-1).status, 'draft')
  assert.throws(() => change(state, { ...event, title: 'DEMO DESIGNER', department: 'design' }), /already uses/)
  const noManager = structuredClone(fixture)
  noManager.employees[0].employmentStatus = 'terminated'
  assert.throws(() => change(state, { type: 'set-job-status', jobId: state.jobs.at(-1).id, status: 'published' }, owner, noManager), /active manager/)
})

test('recruiting dashboard counts reflect offers and hires without altering unrelated candidates', () => {
  let state = published()
  const firstId = state.candidates[0].id
  const secondId = state.candidates[1].id
  state = advance(state, firstId, ['screening', 'interview', 'offer'])
  assert.deepEqual(recruiting.recruitingSummary(state, owner), { jobs: 1, openJobs: 1, draftJobs: 0, activeCandidates: 2, offers: 1, hires: 0 })
  state = advance(state, firstId, ['hired'])
  assert.equal(state.candidates.find(candidate => candidate.id === secondId).stage, 'applied')
  assert.deepEqual(recruiting.recruitingSummary(state, owner), { jobs: 1, openJobs: 1, draftJobs: 0, activeCandidates: 1, offers: 0, hires: 1 })
})

test('missing resource and unsupported recruiting actions fail without changing input state', () => {
  const state = published()
  const snapshot = structuredClone(state)
  assert.throws(() => change(state, { type: 'advance-candidate', candidateId: 'foreign', stage: 'screening' }), /not found/)
  assert.throws(() => change(state, { type: 'set-job-status', jobId: 'foreign', status: 'published' }), /not found/)
  assert.throws(() => change(state, { type: 'set-job-status', jobId: state.jobs[0].id, status: 'hidden' }), /supported/)
  assert.throws(() => change(state, { type: 'delete-candidate', candidateId: state.candidates[0].id }), /Unsupported/)
  assert.deepEqual(state, snapshot)
})
