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
  urls[name] = `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  return import(urls[name])
}
await load('recruiting-lifecycle-value')
const { recruitingInterviewHandler: handler } = await load('recruiting-interviews')
const { projectRecruitingView } = await load('recruiting-lifecycle-projection')
const owner = { mode: 'native', actor: { role: 'employer-owner' } }
const authorA = { mode: 'interviewer', employeeId: 'employee-001' }
const authorB = { mode: 'interviewer', employeeId: 'employee-002' }
const employees = [
  { id: 'employee-001', firstName: 'Alex', lastName: 'Sample', employmentStatus: 'terminated' },
  { id: 'employee-002', firstName: 'Blair', lastName: 'Fiction', employmentStatus: 'on-leave' },
  { id: 'employee-003', firstName: 'Casey', lastName: 'Other', employmentStatus: 'active' },
]
const supported = zone => ['UTC', 'America/Los_Angeles', 'America/New_York'].includes(zone)
const rules = { knownEmployeeIds: new Set(employees.map(employee => employee.id)), isTimeZoneSupported: supported }
const early = '2026-10-15T09:00:00.000Z'
const future = '2030-01-01T12:00:00.000Z'
const content = comments => ({ rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 4, collaboration: 3, problemSolving: 5 }, comments })
function initial() {
  return {
    schemaVersion: 1, sequence: 1,
    adoption: { eventId: 'adoption-fixture', actor: owner, recordedAt: early, legacyJobs: [], legacyCandidates: [], legacyHiredEmployees: [], legacyHireLinks: [], legacySequence: 0 },
    people: [{ id: 'rperson-0001', firstName: 'Devon', lastName: 'Sample', workEmail: 'devon@example.invalid', provenance: { kind: 'created', eventId: 'fixture-person' } }],
    applications: [{ id: 'rapplication-0001', personId: 'rperson-0001', jobId: 'sample-job', stage: 'interview', stageEnteredAt: early, lastStageRecordedAt: early, provenance: { kind: 'legacy', candidateId: 'fixture-candidate', initialStage: 'interview' }, hireBindingId: null }],
    requisitions: [], approvals: [], jobs: [{ id: 'sample-job', revision: 1, title: 'Fictional researcher', department: 'Research', managerEmployeeId: 'employee-003', state: 'published', requisitionId: null, currentPublicationId: null, provenance: { kind: 'legacy', jobId: 'sample-job', initialState: 'published' } }],
    publications: [], interviews: [], scorecards: [], hireBindings: [], events: [],
  }
}
const schedule = (extra = {}) => ({ kind: 'schedule-interview', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001', 'employee-002'], startAt: '2026-10-20T15:00:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 60, recordedAt: early, ...extra })
function plan(life, command, actor = owner, fixtureEmployees = employees) {
  return handler.plan(command, { lifecycle: life, actor, employees: fixtureEmployees, event(offset = 0) { return { id: `recruiting-event-${life.sequence + offset}`, sequence: life.sequence + offset, actor: structuredClone(actor), recordedAt: command.recordedAt } }, isTimeZoneSupported: supported })[0]
}
function step(life, command, actor = owner, fixtureEmployees = employees) {
  const event = plan(life, command, actor, fixtureEmployees)
  const before = JSON.stringify(life)
  const next = handler.replay(life, event, { ...rules, knownEmployeeIds: new Set(fixtureEmployees.map(employee => employee.id)) })
  assert.equal(JSON.stringify(life), before, 'planning/replay do not mutate the source')
  assert.equal(next.sequence, life.sequence, 'core alone owns the counter')
  assert.deepEqual(next.events, life.events, 'core alone appends events')
  next.events.push(event); next.sequence++
  return next
}
const save = (comments, recordedAt = early, expectedRevision = null, interviewId = 'rinterview-0001') => ({ kind: 'save-scorecard', interviewId, expectedRevision, content: content(comments), recordedAt })
const submit = (card, recordedAt = early) => ({ kind: 'submit-scorecard', scorecardId: card.id, expectedRevision: card.revision, recordedAt })
const view = (life, actor) => projectRecruitingView({ recruiting: { lifecycle: life, hiredEmployees: [] } }, actor, { employees })
function unchangedRefusal(life, run) { const before = JSON.stringify(life); assert.throws(run); assert.equal(JSON.stringify(life), before) }

test('explicit scheduling produces the complete literal capture without stage or time inference', () => {
  const life = initial(), before = JSON.stringify(life)
  const event = plan(life, schedule({ recordedAt: '2020-01-01T00:00:00.000Z' }))
  assert.deepEqual(event, {
    id: 'recruiting-event-1', sequence: 1, actor: owner, recordedAt: '2020-01-01T00:00:00.000Z', kind: 'interview-scheduled', applicationId: 'rapplication-0001',
    interview: { id: 'rinterview-0001', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001', 'employee-002'], startAt: '2026-10-20T15:00:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 60, createdEventId: 'recruiting-event-1' },
  })
  assert.equal(JSON.stringify(life), before)
  const next = step(life, schedule())
  assert.deepEqual(next.applications, life.applications)
  assert.deepEqual(next.interviews[0], event.interview)
})

test('invalid instants, numeric zones, durations and participant sets refuse atomically', () => {
  const life = initial()
  for (const extra of [
    { recordedAt: '2026-10-15T09:00:00Z' }, { startAt: '2026-02-30T09:00:00.000Z' }, { startAt: '2026-10-15T09:00:00.000+00:00' },
    { timeZone: '+01:00' }, { timeZone: 'Etc/GMT+1' }, { timeZone: 'MadeUp/Zone' }, { durationMinutes: 14 }, { durationMinutes: 241 }, { durationMinutes: 15.5 },
    { participantEmployeeIds: [] }, { participantEmployeeIds: ['employee-001', 'employee-001'] }, { participantEmployeeIds: ['unknown-employee'] },
  ]) unchangedRefusal(life, () => plan(life, schedule(extra)))
})

test('authorization occurs before entity lookup; foreign and unknown own targets agree', () => {
  const life = step(initial(), schedule({ participantEmployeeIds: ['employee-001'] }))
  let lookedUp = false
  const wrongFamily = { kind: 'save-scorecard', get interviewId() { lookedUp = true; throw new Error('hidden'); } }
  assert.throws(() => plan(life, wrongFamily, owner), /unavailable/)
  assert.equal(lookedUp, false)
  const messages = ['rinterview-0001', 'unknown-interview'].map(id => { try { plan(life, save('Own sample', early, null, id), authorB) } catch (error) { return error.message } })
  assert.deepEqual(messages, ['This recruiting action is unavailable.', 'This recruiting action is unavailable.'])
  unchangedRefusal(life, () => plan(life, schedule(), authorA))
})

test('hidden author A 2030 draft cannot advance author B 2026 save or submission bounds', () => {
  let life = step(initial(), schedule())
  const stages = JSON.stringify(life.applications)
  life = step(life, save('Author A hidden future draft', future), authorA)
  life = step(life, save('Author B independent earlier draft'), authorB)
  assert.deepEqual(life.scorecards.map(card => [card.id, card.lastOwnRecordedAt]), [
    ['rscorecard-e0387eda02bea9a6', future], ['rscorecard-e808a3da06ee256f', early],
  ])
  life = step(life, submit(life.scorecards[1]), authorB)
  assert.deepEqual(life.events.at(-1), { id: 'recruiting-event-4', sequence: 4, actor: authorB, recordedAt: early, kind: 'scorecard-submitted', applicationId: 'rapplication-0001', interviewId: 'rinterview-0001', scorecardId: 'rscorecard-e808a3da06ee256f', authorEmployeeId: 'employee-002', draftEventId: 'recruiting-event-3', revision: 1 })
  assert.equal(life.scorecards[1].revision, 1)
  assert.equal(JSON.stringify(life.applications), stages)
  unchangedRefusal(life, () => plan(life, save('Earlier own revision', early, 1), authorA))
  life = step(life, submit(life.scorecards[0], future), authorA)
  assert.equal(life.scorecards[0].state, 'submitted')
})

test('one author has independent chronology on different interviews', () => {
  let life = step(initial(), schedule())
  life = step(life, schedule({ recordedAt: '2020-01-01T00:00:00.000Z', startAt: '2020-01-02T00:00:00.000Z' }))
  life = step(life, save('Future draft on first interview', future), authorA)
  life = step(life, save('Earlier draft on second interview', early, null, 'rinterview-0002'), authorA)
  assert.deepEqual(life.scorecards.map(card => card.lastOwnRecordedAt), [future, early])
})

test('save revisions use own continuity, reject no-op and backward time, permit equality', () => {
  let life = step(step(initial(), schedule()), save('First own sample comments'), authorA)
  for (const command of [save('First own sample comments', early, 1), save('New own comments', early, 0), save('New own comments', '2026-10-15T08:59:59.999Z', 1)]) unchangedRefusal(life, () => plan(life, command, authorA))
  life = step(life, save('Second own sample comments', early, 1), authorA)
  assert.equal(life.scorecards[0].revision, 2)
  assert.equal(life.scorecards[0].latestDraftEventId, 'recruiting-event-3')
  life = step(life, submit(life.scorecards[0]), authorA)
  assert.equal(life.events.at(-1).draftEventId, 'recruiting-event-3')
  assert.equal(life.scorecards[0].revision, 2)
  unchangedRefusal(life, () => plan(life, submit(life.scorecards[0]), authorA))
  unchangedRefusal(life, () => plan(life, save('Post-submission overwrite', early, 2), authorA))
})

test('replay refuses foreign, stale, missing and mismatched saved-draft links', () => {
  let life = step(step(initial(), schedule()), save('A original draft'), authorA)
  life = step(life, save('B private draft'), authorB)
  life = step(life, save('A current revision', early, 1), authorA)
  const event = plan(life, submit(life.scorecards[0]), authorA)
  for (const mutate of [
    event => { event.draftEventId = 'recruiting-event-2' }, event => { event.draftEventId = 'recruiting-event-3' }, event => { event.draftEventId = 'missing-event' },
    event => { event.applicationId = 'other-application' }, event => { event.interviewId = 'other-interview' }, event => { event.authorEmployeeId = 'employee-002' }, event => { event.revision = 1 },
  ]) {
    const forged = structuredClone(event); mutate(forged)
    unchangedRefusal(life, () => handler.replay(life, forged, rules))
  }
  const missing = structuredClone(life); missing.events = missing.events.filter(item => item.id !== 'recruiting-event-4')
  unchangedRefusal(missing, () => plan(missing, submit(missing.scorecards[0]), authorA))
})

test('replay refuses forged saved cursors, state, author, content and extra fields', () => {
  const life = step(initial(), schedule()), event = plan(life, save('Own valid draft'), authorA)
  for (const mutate of [
    event => { event.scorecard.lastOwnRecordedAt = future }, event => { event.scorecard.latestDraftEventId = 'other-draft' }, event => { event.scorecard.state = 'submitted' },
    event => { event.scorecard.authorEmployeeId = 'employee-002' }, event => { event.scorecard.content.ratings.collaboration = 6 }, event => { event.scorecard.extra = 'unreviewed' },
  ]) { const forged = structuredClone(event); mutate(forged); unchangedRefusal(life, () => handler.replay(life, forged, rules)) }
})

test('management excludes drafts before and after submission; another author gets no draft/history/timestamp', () => {
  let life = step(initial(), schedule())
  const bBefore = JSON.stringify(view(life, authorB))
  life = step(life, save('SECRET earlier draft A', future), authorA)
  const managerDraft = view(life, owner)
  assert.deepEqual(managerDraft.submittedScorecards, [])
  assert.equal(JSON.stringify(managerDraft).includes('SECRET'), false)
  assert.equal(JSON.stringify(managerDraft).includes(future), false)
  assert.equal(JSON.stringify(view(life, authorB)), bBefore)
  life = step(life, save('Explicit submitted content A', future, 1), authorA)
  life = step(life, submit(life.scorecards[0], future), authorA)
  const managerSubmitted = view(life, owner)
  assert.equal(managerSubmitted.submittedScorecards[0].content.comments, 'Explicit submitted content A')
  assert.equal(JSON.stringify(managerSubmitted).includes('SECRET'), false)
  assert.equal(JSON.stringify(view(life, authorB)), bBefore)
  assert.equal(JSON.stringify(view(life, authorA)).includes('SECRET earlier draft A'), false, 'own history is safe event metadata, not earlier content')
})

test('known assigned identities retain own work after terminal application and employment status changes', () => {
  let life = step(initial(), schedule())
  life.applications[0].stage = 'withdrawn'
  unchangedRefusal(life, () => plan(life, schedule()))
  life = step(life, save('Own final sample review'), authorA)
  life = step(life, submit(life.scorecards[0]), authorA)
  assert.equal(view(life, authorA).assignedInterviews[0].ownScorecard.state, 'submitted')
})

test('pair-derived IDs have fixed literal UTF-8 results, support long IDs and distinct pair boundaries', () => {
  for (const [interviewId, employeeId, expected] of [
    ['rinterview-0001', 'x'.repeat(200), 'rscorecard-ff150ebf774e5e00'],
    ['ab', 'c', 'rscorecard-535e36f0108fb217'], ['a', 'bc', 'rscorecard-3abad4542100df77'],
  ]) {
    const life = initial(); life.interviews.push({ id: interviewId, applicationId: 'rapplication-0001', participantEmployeeIds: [employeeId], startAt: early, timeZone: 'UTC', durationMinutes: 60, createdEventId: 'fixture-interview' })
    const actor = { mode: 'interviewer', employeeId }, fixture = [{ id: employeeId }]
    assert.equal(plan(life, save('Literal pair test', early, null, interviewId), actor, fixture).scorecard.id, expected)
  }
})

test('an existing different-pair ID collision refuses without merging or revealing its owner', () => {
  const life = step(initial(), schedule())
  life.scorecards.push({ id: 'rscorecard-e0387eda02bea9a6', interviewId: 'different-interview', authorEmployeeId: 'employee-002' })
  unchangedRefusal(life, () => plan(life, save('Own collision refusal'), authorA))
  try { plan(life, save('Own collision refusal'), authorA) } catch (error) { assert.equal(error.message, 'This local scorecard identity is unavailable.'); assert.equal(error.message.includes('employee-002'), false) }
})
