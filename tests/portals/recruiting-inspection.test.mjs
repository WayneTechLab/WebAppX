import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { inspectWorkspaces, compareWorkspaces } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const clone = value => structuredClone(value)
const marker = 'PRIVATE recruiting names comments department reason'
const instant = '2026-10-15T12:00:00.000Z'
const actor = { mode: 'native', actor: { role: 'hr-admin' } }
const own = { mode: 'interviewer', employeeId: 'employee-002' }
const row = (report, key) => report.modules[0].collections.find(item => item.key === `recruiting.lifecycle.${key}`)
const recruitingRows = report => report.modules[0].collections.filter(item => item.key.startsWith('recruiting.lifecycle.'))
const privateAbsent = report => assert.doesNotMatch(JSON.stringify(report), /PRIVATE|fixture\.invalid|"ratings"|"comments"|"reason"|"department"|fingerprint|employeeSnapshot|legacyJobs/)
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

// Literal inspection fixtures intentionally do not claim domain/replay validity.
// The boundary checks saved shape/identity and hidden payload differences without
// deriving its expected records or counts from an application transition.
function captured() {
  const states = clone(seed)
  const adoption = { eventId: 'recruit-event-1', actor, recordedAt: instant, legacyJobs: clone(states.hr.recruiting.jobs), legacyCandidates: clone(states.hr.recruiting.candidates), legacyHiredEmployees: [], legacyHireLinks: [], legacySequence: 0 }
  adoption.legacyJobs[0].activity = [{ receipt: 'RECRUIT-1', action: marker, actorRole: 'hr-admin' }, { receipt: 'RECRUIT-2', action: marker, actorRole: 'hr-admin' }]
  const interview = { id: 'interview-1', applicationId: 'application-1', participantEmployeeIds: ['employee-002', 'employee-003'], startAt: '2027-01-01T09:00:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 45, createdEventId: 'recruit-event-2' }
  const scorecard = { id: 'scorecard-1', interviewId: interview.id, applicationId: interview.applicationId, authorEmployeeId: 'employee-002', revision: 1, content: { rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 3, collaboration: 4, problemSolving: 5 }, comments: marker }, state: 'draft', latestDraftEventId: 'recruit-event-3', lastOwnRecordedAt: instant, submittedEventId: null }
  const employeeSnapshot = { id: 'employee-hired-1', firstName: marker, lastName: marker, workEmail: 'hidden@fixture.invalid', department: marker, jobTitle: marker, employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, onboarding: [{ id: 'profile', title: marker, status: 'pending' }, { id: 'policy', title: marker, status: 'pending' }] }
  states.hr.recruiting.lifecycle = {
    schemaVersion: 1, sequence: 4, adoption,
    people: [{ id: 'person-1', firstName: marker, lastName: marker, workEmail: 'hidden@fixture.invalid', provenance: { kind: 'legacy', candidateId: 'candidate-seed-001' } }],
    applications: [{ id: 'application-1', personId: 'person-1', jobId: 'job-1', stage: 'interview', stageEnteredAt: instant, lastStageRecordedAt: instant, provenance: { kind: 'created', eventId: 'recruit-event-2' }, hireBindingId: null }],
    requisitions: [{ id: 'requisition-1', revision: 2, content: { department: marker, ownerEmployeeId: 'employee-001', headcount: 3 }, state: 'approved', currentApprovalId: 'approval-1' }],
    approvals: [{ id: 'approval-1', requisitionId: 'requisition-1', revision: 2, content: { department: marker, ownerEmployeeId: 'employee-001', headcount: 3 }, eventId: 'recruit-event-2', actor, recordedAt: instant }],
    jobs: [{ id: 'job-1', revision: 2, title: marker, department: marker, managerEmployeeId: 'employee-001', state: 'published', requisitionId: 'requisition-1', currentPublicationId: 'publication-1', provenance: { kind: 'created', eventId: 'recruit-event-2' } }],
    publications: [{ id: 'publication-1', jobId: 'job-1', jobRevision: 2, job: { title: marker, department: marker, managerEmployeeId: 'employee-001' }, requisitionApprovalId: 'approval-1', eventId: 'recruit-event-2', actor, recordedAt: instant }],
    interviews: [interview], scorecards: [scorecard, { ...clone(scorecard), id: 'scorecard-2', authorEmployeeId: 'employee-003', latestDraftEventId: 'recruit-event-2' }],
    hireBindings: [{ id: 'hire-binding-1', personId: 'person-1', applicationId: 'application-1', employeeId: 'employee-hired-1', provenance: { kind: 'created', eventId: 'recruit-event-3' }, employeeSnapshot, checklist: { version: 'sample-v1', tasks: [{ id: 'profile', title: marker }, { id: 'policy', title: marker }] }, initialBalances: { vacation: 40, sick: 24 }, employmentAtHire: { kind: 'absent' }, legacyEmploymentLinks: null }],
    events: [{ id: 'recruit-event-1', sequence: 1, kind: 'adopt', actor, recordedAt: instant, adoption: clone(adoption) }, { id: 'recruit-event-2', sequence: 2, kind: 'interview-scheduled', actor, recordedAt: instant, applicationId: 'application-1', interview: clone(interview) }, { id: 'recruit-event-3', sequence: 3, kind: 'scorecard-saved', actor: own, recordedAt: instant, applicationId: 'application-1', previousRevision: null, scorecard: clone(scorecard) }],
  }
  return states
}

test('legacy inspection and comparison keep exact reviewed hashes without materializing recruiting', () => {
  const before = JSON.stringify(seed)
  assert.equal(digest(inspectWorkspaces(seed, ['hr', 'cms', 'crm'])), 'a25f693114389cd54db404f1bdfb9de00eab4e70159d94c3de94185ccf6c21dd')
  assert.equal(digest(compareWorkspaces(seed, seed, ['hr', 'cms', 'crm'])), '1e73a0979d83028abcecc5df3c98290143c53bc346bced3205cf767ea404ecc8')
  assert.equal(JSON.stringify(seed), before)
  assert.equal(Object.hasOwn(seed.hr.recruiting, 'lifecycle'), false)
})

test('ten primary collections and one metadata record have literal counts without nested capture double counting', () => {
  const report = inspectWorkspaces(captured(), ['hr'])
  assert.deepEqual(recruitingRows(report).map(item => [item.key, item.kind, item.count]), [
    ['recruiting.lifecycle.people', 'primary', 1], ['recruiting.lifecycle.applications', 'primary', 1], ['recruiting.lifecycle.requisitions', 'primary', 1], ['recruiting.lifecycle.approvals', 'primary', 1], ['recruiting.lifecycle.jobs', 'primary', 1], ['recruiting.lifecycle.publications', 'primary', 1], ['recruiting.lifecycle.interviews', 'primary', 1], ['recruiting.lifecycle.scorecards', 'primary', 2], ['recruiting.lifecycle.hireBindings', 'primary', 1], ['recruiting.lifecycle.events', 'primary', 3], ['recruiting.lifecycle.metadata', 'metadata', 1],
  ])
  assert.equal(report.modules[0].primaryRecordCount, 48)
  assert.deepEqual(row(report, 'scorecards').identifiers, ['scorecard-1', 'scorecard-2'])
  privateAbsent(report)
})

test('optional collection union is symmetric, stable and exposes only bounded safe recruiting metadata', () => {
  const current = captured(), forward = compareWorkspaces(seed, current, ['hr']), reverse = compareWorkspaces(current, seed, ['hr'])
  assert.deepEqual([forward.modules[0].added, forward.modules[0].removed, forward.modules[0].changed], [13, 0, 0])
  assert.deepEqual([reverse.modules[0].added, reverse.modules[0].removed, reverse.modules[0].changed], [0, 13, 0])
  assert.deepEqual(recruitingRows(forward).map(item => item.key), recruitingRows(reverse).map(item => item.key))
  assert.deepEqual(row(forward, 'interviews').recordDetails.added[0].after, { applicationId: 'application-1', participantEmployeeIds: 'employee-002 / employee-003', participantCount: 2, startAt: '2027-01-01T09:00:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 45, createdEventId: 'recruit-event-2' })
  assert.deepEqual(row(forward, 'events').recordDetails.added.find(item => item.identifier === 'recruit-event-3').after, { sequence: 3, eventKind: 'scorecard-saved', recordedAt: instant, actorMode: 'interviewer', actorRole: null, actorEmployeeId: 'employee-002', actorContractorId: null, applicationId: 'application-1', scorecardId: 'scorecard-1' })
  privateAbsent(forward); privateAbsent(reverse)
})

test('all nested hidden captures and private histories contribute to differences without appearing in output', () => {
  const current = captured(), target = clone(current), life = target.hr.recruiting.lifecycle
  life.scorecards[0].content.ratings.collaboration = 1
  life.scorecards[1].content.comments += ' changed'
  life.events[2].scorecard.content.comments += ' changed'
  life.adoption.legacyCandidates[0].firstName += ' changed'
  life.events[0].adoption.legacyCandidates[0].firstName += ' changed'
  life.hireBindings[0].employeeSnapshot.workEmail = 'changed@fixture.invalid'
  const report = compareWorkspaces(current, target, ['hr'])
  assert.deepEqual([row(report, 'scorecards').changed, row(report, 'events').changed, row(report, 'metadata').changed, row(report, 'hireBindings').changed], [2, 2, 1, 1])
  privateAbsent(report)
})

test('identified collection, participant and nested capture reordering is semantically stable', () => {
  const current = captured(), target = clone(current), life = target.hr.recruiting.lifecycle
  for (const key of ['people', 'applications', 'requisitions', 'approvals', 'jobs', 'publications', 'interviews', 'scorecards', 'hireBindings', 'events']) life[key].reverse()
  life.interviews[0].participantEmployeeIds.reverse()
  life.hireBindings[0].checklist.tasks.reverse(); life.hireBindings[0].employeeSnapshot.onboarding.reverse()
  for (const adoption of [life.adoption, life.events.find(event => event.kind === 'adopt').adoption]) { adoption.legacyCandidates.reverse(); adoption.legacyJobs[0].activity.reverse() }
  life.events.find(event => event.kind === 'interview-scheduled').interview.participantEmployeeIds.reverse()
  assert.deepEqual(inspectWorkspaces(current, ['hr']), inspectWorkspaces(target, ['hr']))
  assert.equal(compareWorkspaces(current, target, ['hr']).modules[0].hasChanges, false)
})

test('record omission counts and annotations obey the existing explicit bounds', () => {
  const target = captured(), person = target.hr.recruiting.lifecycle.people[0]
  target.hr.recruiting.lifecycle.people = Array.from({ length: 25 }, (_, index) => ({ ...clone(person), id: `person-bound-${index}` }))
  const report = inspectWorkspaces(target, ['hr'], { identifierLimit: 2 })
  assert.deepEqual([row(report, 'people').count, row(report, 'people').identifiers.length, row(report, 'people').omittedIdentifiers], [25, 2, 23])
  const diff = compareWorkspaces(seed, target, ['hr'], { identifierLimit: 2 })
  assert.deepEqual([row(diff, 'people').added, row(diff, 'people').recordDetails.added.length, row(diff, 'people').omittedIdentifiers.added], [25, 2, 23])
  privateAbsent(diff)
})

test('present malformed extensions and unsafe recruiting metadata refuse without leaking private payloads', () => {
  const edits = [
    state => { state.hr.recruiting.lifecycle = null }, state => { state.hr.recruiting.lifecycle = undefined }, state => { state.hr.recruiting.lifecycle.schemaVersion = 2 },
    state => { delete state.hr.recruiting.lifecycle.people }, state => { state.hr.recruiting.lifecycle.scorecards = null },
    state => { state.hr.recruiting.lifecycle.people[0].id = 'hidden@fixture.invalid' }, state => { state.hr.recruiting.lifecycle.people.push(clone(state.hr.recruiting.lifecycle.people[0])) },
    state => { state.hr.recruiting.lifecycle.applications[0].stageEnteredAt = '2026-10-15' }, state => { state.hr.recruiting.lifecycle.applications[0].lastStageRecordedAt = '2026-02-30T12:00:00.000Z' },
    state => { state.hr.recruiting.lifecycle.events[0].recordedAt = '2026-10-15T12:00:00.000+00:00' }, state => { state.hr.recruiting.lifecycle.events[0].actor.mode = marker },
    state => { state.hr.recruiting.lifecycle.events[2].actor.employeeId = 'hidden@fixture.invalid' }, state => { state.hr.recruiting.lifecycle.interviews[0].timeZone = '+03:00' },
    state => { state.hr.recruiting.lifecycle.interviews[0].timeZone = 'Etc/GMT+3' }, state => { state.hr.recruiting.lifecycle.interviews[0].durationMinutes = 241 },
    state => { state.hr.recruiting.lifecycle.requisitions[0].content.headcount = 51 }, state => { state.hr.recruiting.lifecycle.scorecards[0].revision = 1001 },
  ]
  for (const edit of edits) { const state = captured(); edit(state); assert.throws(() => inspectWorkspaces(state, ['hr']), error => { privateAbsent(error.message); return /Workspace inspection unavailable/.test(error.message) }) }
  let invoked = false; const state = captured()
  Object.defineProperty(state.hr.recruiting.lifecycle.scorecards[0].content, 'comments', { enumerable: true, get() { invoked = true; throw new Error(marker) } })
  assert.throws(() => inspectWorkspaces(state, ['hr']), /accessor or hidden property/)
  assert.equal(invoked, false)
})
