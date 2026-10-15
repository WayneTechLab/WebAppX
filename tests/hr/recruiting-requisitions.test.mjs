import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { recruitingRequisitions: handler } = await loadMockModel(new URL('../../src/hr/recruiting-requisitions.ts', import.meta.url))
const clone = value => structuredClone(value)
const actor = { mode: 'native', actor: { role: 'employer-owner' } }
const time = '2026-10-15T09:00:00.000Z'
const people = [
  { id: 'employee-001', firstName: 'Morgan', lastName: 'Sample', workEmail: 'morgan@example.invalid', department: 'Operations', jobTitle: 'Manager', employmentStatus: 'active', managerId: null, payCents: 0, onboarding: [] },
  { id: 'employee-002', firstName: 'Avery', lastName: 'Sample', workEmail: 'avery@example.invalid', department: 'Operations', jobTitle: 'Specialist', employmentStatus: 'active', managerId: 'employee-001', payCents: 0, onboarding: [] },
]
const known = new Set(['employee-001', 'employee-002'])
const replayContext = { knownEmployeeIds: known, isTimeZoneSupported: () => true }
const base = sequence => ({ id: `recruit-event-${String(sequence).padStart(4, '0')}`, sequence, actor: clone(actor), recordedAt: time })
function initial() {
  const adoption = { eventId: 'recruit-event-0001', actor: clone(actor), recordedAt: time, legacyJobs: [], legacyCandidates: [], legacyHiredEmployees: [], legacyHireLinks: [], legacySequence: 0 }
  return { schemaVersion: 1, sequence: 2, adoption, people: [], applications: [], requisitions: [], approvals: [], jobs: [], publications: [], interviews: [], scorecards: [], hireBindings: [], events: [{ ...base(1), kind: 'adopt', adoption: clone(adoption) }] }
}
const content = { department: 'Operations', ownerEmployeeId: 'employee-002', headcount: 1 }
function plan(state, command, options = {}) {
  const currentActor = options.actor ?? actor
  return handler.plan(command, { lifecycle: state, actor: currentActor, employees: options.employees ?? people, isTimeZoneSupported: () => true,
    event: (offset = 0) => ({ ...base(state.sequence + offset), actor: clone(currentActor), recordedAt: command.recordedAt }) })
}
function apply(state, command, options) {
  const before = clone(state); const events = plan(state, command, options)
  assert.deepEqual(state, before)
  let next = state
  for (const event of events) {
    const projected = handler.replay(next, event, replayContext)
    // Only the trusted core appends facts and consumes event sequence.
    assert.equal(projected.sequence, next.sequence)
    assert.equal(projected.events, next.events)
    for (const key of ['people', 'applications', 'interviews', 'scorecards', 'hireBindings', 'adoption']) assert.equal(projected[key], next[key], key)
    next = { ...projected, sequence: event.sequence + 1, events: [...projected.events, clone(event)] }
  }
  return next
}
const create = state => apply(state, { kind: 'create-requisition', content: clone(content), recordedAt: time })
function approved() {
  let state = create(initial())
  state = apply(state, { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 1, recordedAt: time })
  return apply(state, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'approved', reason: '  Fictional plan reviewed  ', recordedAt: time })
}
const jobCommand = { kind: 'create-job', title: 'Sample operations specialist', department: 'Operations', managerEmployeeId: 'employee-001', requisitionId: 'rrequisition-0001', recordedAt: time }
const withJob = () => apply(approved(), jobCommand)
const publish = state => apply(state, { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time })
function preservedRefusal(state, command, pattern, options) {
  const before = clone(state)
  assert.throws(() => plan(state, command, options), pattern)
  assert.deepEqual(state, before)
}

test('create plans one literal draft event; replay touches only owned projections and preserves all input bytes', () => {
  const source = initial(); const before = clone(source)
  const command = { kind: 'create-requisition', content: { ...content, department: '  Operations  ' }, recordedAt: time }
  const expected = { ...base(2), kind: 'requisition-changed', requisitionId: 'rrequisition-0001', previousRevision: null, requisition: { id: 'rrequisition-0001', revision: 1, content: clone(content), state: 'draft', currentApprovalId: null } }
  assert.deepEqual(plan(source, command), [expected])
  const projected = handler.replay(source, expected, replayContext)
  assert.deepEqual(projected.requisitions, [expected.requisition])
  assert.deepEqual(projected.approvals, []); assert.deepEqual(projected.publications, [])
  assert.equal(projected.sequence, 2); assert.equal(projected.events, source.events)
  assert.deepEqual(source, before)
  expected.requisition.content.department = 'caller-only'
  assert.equal(projected.requisitions[0].content.department, 'Operations')
})

test('review request and explicit outcome are separate events with an exact immutable content/revision capture', () => {
  const draft = create(initial())
  preservedRefusal(draft, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'approved', reason: 'Reviewed', recordedAt: time }, /Request sample requisition review/)
  const state = approved()
  assert.deepEqual(state.requisitions, [{ id: 'rrequisition-0001', revision: 1, content, state: 'approved', currentApprovalId: 'rapproval-0001' }])
  assert.deepEqual(state.approvals, [{ id: 'rapproval-0001', requisitionId: 'rrequisition-0001', revision: 1, content, eventId: 'recruit-event-0004', actor, recordedAt: time }])
  assert.deepEqual(state.events.map(event => event.kind), ['adopt', 'requisition-changed', 'requisition-changed', 'requisition-reviewed'])
  assert.equal(state.events[3].reason, 'Fictional plan reviewed')
  preservedRefusal(state, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'approved', reason: 'Replay', recordedAt: time }, /Request sample requisition review/)
})

test('rejection requires a visible reason, records no approval and can explicitly request another review', () => {
  let state = apply(create(initial()), { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 1, recordedAt: time })
  for (const reason of ['', ' ', 'x', 'sample\nreason', 'x'.repeat(501)]) preservedRefusal(state, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'rejected', reason, recordedAt: time }, /fictional recruiting action is invalid/)
  state = apply(state, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'rejected', reason: '  Fictional headcount needs review  ', recordedAt: time })
  assert.equal(state.requisitions[0].state, 'rejected'); assert.equal(state.requisitions[0].revision, 1); assert.deepEqual(state.approvals, [])
  assert.equal(state.events[3].reason, 'Fictional headcount needs review')
  state = apply(state, { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 1, recordedAt: time })
  assert.equal(state.requisitions[0].state, 'in-review'); assert.equal(state.requisitions[0].revision, 1)
})

test('owner is independent from hiring manager and publication captures the current exact approved revision', () => {
  const draft = withJob(); const source = clone(draft); const state = publish(draft)
  assert.deepEqual(state.jobs, [{ id: 'rjob-0001', revision: 1, title: 'Sample operations specialist', department: 'Operations', managerEmployeeId: 'employee-001', state: 'published', requisitionId: 'rrequisition-0001', currentPublicationId: 'rpublication-0001', provenance: { kind: 'created', eventId: 'recruit-event-0005' } }])
  assert.equal(state.requisitions[0].content.ownerEmployeeId, 'employee-002')
  assert.deepEqual(state.publications, [{ id: 'rpublication-0001', jobId: 'rjob-0001', jobRevision: 1, job: { title: 'Sample operations specialist', department: 'Operations', managerEmployeeId: 'employee-001' }, requisitionApprovalId: 'rapproval-0001', eventId: 'recruit-event-0006', actor, recordedAt: time }])
  assert.deepEqual(draft, source)
  preservedRefusal(state, { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time }, /Only a draft/)
})

test('later edits clear current approval and preserve all immutable earlier approval/publication captures', () => {
  const published = publish(withJob()); const history = clone({ approvals: published.approvals, publications: published.publications })
  const state = apply(published, { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 1, content: { ...content, headcount: 3 }, recordedAt: time })
  assert.deepEqual(state.requisitions, [{ id: 'rrequisition-0001', revision: 2, content: { ...content, headcount: 3 }, state: 'draft', currentApprovalId: null }])
  assert.deepEqual({ approvals: state.approvals, publications: state.publications }, history)
  assert.deepEqual(state.jobs, published.jobs)
  preservedRefusal(state, { ...jobCommand, title: 'Another fictional job' }, /needs approval/)
})

test('re-binding the same requisition recaptures a changed department at a new job revision', () => {
  let state = apply(withJob(), { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 1, content: { ...content, department: 'Research' }, recordedAt: time })
  state = apply(state, { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 2, recordedAt: time })
  state = apply(state, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 2, outcome: 'approved', reason: 'New department reviewed', recordedAt: time })
  preservedRefusal(state, { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time }, /bind the job/)
  state = apply(state, { kind: 'bind-job-requisition', jobId: 'rjob-0001', revision: 1, requisitionId: 'rrequisition-0001', recordedAt: time })
  assert.equal(state.jobs[0].revision, 2); assert.equal(state.jobs[0].department, 'Research')
  state = apply(state, { kind: 'publish-job', jobId: 'rjob-0001', revision: 2, recordedAt: time })
  assert.equal(state.publications[0].jobRevision, 2); assert.equal(state.publications[0].requisitionApprovalId, 'rapproval-0002')
  assert.equal(state.approvals[0].content.department, 'Operations')
})

test('headcount is recorded planning information and is neither consumed nor enforced as a hiring quota', () => {
  let state = publish(withJob())
  state.applications = [{ id: 'application-1', jobId: 'rjob-0001', stage: 'hired' }, { id: 'application-2', jobId: 'rjob-0001', stage: 'hired' }]
  state = apply(state, { ...jobCommand, title: 'Second sample job' })
  state = apply(state, { kind: 'publish-job', jobId: 'rjob-0002', revision: 1, recordedAt: time })
  assert.equal(state.publications.length, 2); assert.equal(state.requisitions[0].content.headcount, 1)
})

test('legacy publication and closing never fabricate approval or publication captures; closed jobs cannot reopen', () => {
  const state = initial(); state.jobs = [{ id: 'legacy-job', revision: 1, title: 'Legacy sample job', department: 'Operations', managerEmployeeId: 'employee-001', state: 'published', requisitionId: null, currentPublicationId: null, provenance: { kind: 'legacy', jobId: 'legacy-job', initialState: 'published' } }]
  const next = apply(state, { kind: 'close-job', jobId: 'legacy-job', revision: 1, recordedAt: time })
  assert.equal(next.jobs[0].state, 'closed'); assert.equal(next.jobs[0].revision, 2)
  assert.deepEqual(next.approvals, []); assert.deepEqual(next.publications, []); assert.deepEqual(next.requisitions, [])
  assert.deepEqual(next.jobs[0].provenance, state.jobs[0].provenance)
  preservedRefusal(next, { kind: 'publish-job', jobId: 'legacy-job', revision: 2, recordedAt: time }, /Only a draft/)
})

test('legacy draft binding requires real approval and accepts a preserved 200-character legacy job ID', () => {
  const state = approved(); const id = 'j'.repeat(200)
  state.jobs = [{ id, revision: 1, title: 'Legacy draft job', department: 'Other department', managerEmployeeId: 'employee-001', state: 'draft', requisitionId: null, currentPublicationId: null, provenance: { kind: 'legacy', jobId: id, initialState: 'draft' } }]
  const next = apply(state, { kind: 'bind-job-requisition', jobId: id, revision: 1, requisitionId: 'rrequisition-0001', recordedAt: time })
  assert.equal(next.jobs[0].id, id); assert.equal(next.jobs[0].department, 'Operations'); assert.equal(next.jobs[0].revision, 2)
  assert.equal(next.jobs[0].requisitionId, 'rrequisition-0001'); assert.deepEqual(next.publications, [])
})

test('closing uses authoritative applications and treats withdrawal/rejection/hire as distinct terminal outcomes', () => {
  const state = publish(withJob())
  state.applications = ['hired', 'rejected', 'withdrawn'].map((stage, index) => ({ id: `application-${index}`, jobId: 'rjob-0001', stage }))
  const next = apply(state, { kind: 'close-job', jobId: 'rjob-0001', revision: 1, recordedAt: time })
  assert.equal(next.jobs[0].state, 'closed'); assert.deepEqual(next.applications, state.applications)
  for (const stage of ['applied', 'screening', 'interview', 'offer']) {
    const active = clone(state); active.applications.push({ id: 'active', jobId: 'rjob-0001', stage })
    preservedRefusal(active, { kind: 'close-job', jobId: 'rjob-0001', revision: 1, recordedAt: time }, /Finish or end/)
  }
})

test('current active/team eligibility is checked for commands, while historical replay uses only known identities', () => {
  const state = withJob(); const command = { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time }; const events = plan(state, command)
  const inactive = clone(people); inactive.forEach(person => { person.employmentStatus = 'terminated'; person.managerId = null })
  preservedRefusal(state, command, /active fictional requisition owner/, { employees: inactive })
  const managerInactive = clone(people); managerInactive[0].employmentStatus = 'terminated'
  preservedRefusal(state, command, /active fictional hiring manager/, { employees: managerInactive })
  const noTeam = clone(people); noTeam[1].managerId = null
  preservedRefusal(state, command, /active fictional hiring manager/, { employees: noTeam })
  const historical = handler.replay(state, events[0], { knownEmployeeIds: new Set(inactive.map(person => person.id)), isTimeZoneSupported: () => true })
  assert.equal(historical.jobs[0].state, 'published')
  assert.throws(() => handler.replay(state, events[0], { knownEmployeeIds: new Set(['employee-002']), isTimeZoneSupported: () => true }))
})

test('stale revisions, no-op edits/bindings and invalid fields refuse without counter or record changes', () => {
  const state = withJob()
  for (const command of [
    { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 9, content, recordedAt: time },
    { kind: 'publish-job', jobId: 'rjob-0001', revision: 9, recordedAt: time },
  ]) preservedRefusal(state, command, error => error.code === 'stale')
  preservedRefusal(state, { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 1, content: { ...content, department: ' Operations ' }, recordedAt: time }, /no changes/)
  preservedRefusal(state, { kind: 'bind-job-requisition', jobId: 'rjob-0001', revision: 1, requisitionId: 'rrequisition-0001', recordedAt: time }, /already has/)
  for (const bad of [{ headcount: 0 }, { headcount: 51 }, { headcount: 1.5 }, { ownerEmployeeId: 'unknown' }, { department: 'x' }, { department: 'bad\ntext' }, { extra: 'private' }]) preservedRefusal(state, { kind: 'create-requisition', content: { ...content, ...bad }, recordedAt: time })
  for (const recordedAt of ['2026-02-30T09:00:00.000Z', '2026-10-15T09:00:00Z', '2026-10-15T09:00:00.000+00:00']) preservedRefusal(state, { kind: 'create-requisition', content, recordedAt })
})

test('authorization precedes lookup and unsafe getter command evaluation; JSON inputs never invoke accessors', () => {
  const state = initial(); let invoked = false
  const command = { kind: 'edit-requisition', recordedAt: time, revision: 1 }
  Object.defineProperty(command, 'requisitionId', { enumerable: true, get() { invoked = true; throw new Error('PRIVATE') } })
  preservedRefusal(state, command, /unavailable/, { actor: { mode: 'interviewer', employeeId: 'employee-002' } })
  assert.equal(invoked, false)
  assert.throws(() => plan(state, command)); assert.equal(invoked, false)
  const event = { ...base(2), kind: 'requisition-changed' }
  Object.defineProperty(event, 'requisition', { enumerable: true, get() { invoked = true; throw new Error('PRIVATE') } })
  assert.throws(() => handler.replay(state, event, replayContext)); assert.equal(invoked, false)
})

test('replay refuses forged content, revisions, state, actor, captures and sequence instead of trusting current snapshots', () => {
  const draft = create(initial()); const review = apply(draft, { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 1, recordedAt: time })
  const outcome = plan(review, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'approved', reason: 'Reviewed', recordedAt: time })[0]
  const jobState = withJob(); const publishEvent = plan(jobState, { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time })[0]
  const createEvent = plan(initial(), { kind: 'create-requisition', content, recordedAt: time })[0]
  const cases = [
    [initial(), createEvent, event => { event.requisition.state = 'approved' }],
    [initial(), createEvent, event => { event.requisition.revision = 2 }],
    [initial(), createEvent, event => { event.requisition.content.department = ' Operations ' }],
    [initial(), createEvent, event => { event.requisition.extra = 'PRIVATE' }],
    [review, outcome, event => { event.approval.content.headcount = 2 }],
    [review, outcome, event => { event.approval.eventId = 'recruit-event-0001' }],
    [review, outcome, event => { event.approval.actor = { mode: 'native', actor: { role: 'hr-admin' } } }],
    [review, outcome, event => { event.approval.recordedAt = '2026-10-16T09:00:00.000Z' }],
    [jobState, publishEvent, event => { event.publication.jobRevision = 2 }],
    [jobState, publishEvent, event => { event.publication.requisitionApprovalId = 'rapproval-other' }],
    [jobState, publishEvent, event => { event.publication.job.managerEmployeeId = 'employee-002' }],
    [jobState, publishEvent, event => { event.sequence++ }],
    [jobState, publishEvent, event => { event.actor = { mode: 'interviewer', employeeId: 'employee-002' } }],
  ]
  for (const [state, source, mutate] of cases) {
    const event = clone(source); mutate(event); const before = clone(state)
    assert.throws(() => handler.replay(state, event, replayContext)); assert.deepEqual(state, before)
  }
})

test('collection, capture, revision and event bounds refuse the whole command without silent pruning', () => {
  const createCommand = { kind: 'create-requisition', content, recordedAt: time }
  const fullRequests = initial(); fullRequests.requisitions = Array.from({ length: 50 }, (_, index) => ({ id: `rrequisition-${index}`, revision: 1, content, state: 'draft', currentApprovalId: null }))
  preservedRefusal(fullRequests, createCommand, error => error.code === 'limit')
  const fullJobs = approved(); fullJobs.jobs = Array.from({ length: 50 }, (_, index) => ({ id: `job-${index}` }))
  preservedRefusal(fullJobs, jobCommand, error => error.code === 'limit')
  const fullApprovals = apply(create(initial()), { kind: 'request-requisition-review', requisitionId: 'rrequisition-0001', revision: 1, recordedAt: time }); fullApprovals.approvals = Array.from({ length: 500 }, (_, index) => ({ id: `approval-${index}` }))
  preservedRefusal(fullApprovals, { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 1, outcome: 'approved', reason: 'Reviewed', recordedAt: time }, error => error.code === 'limit')
  const fullPublications = withJob(); fullPublications.publications = Array.from({ length: 50 }, (_, index) => ({ id: `publication-${index}` }))
  preservedRefusal(fullPublications, { kind: 'publish-job', jobId: 'rjob-0001', revision: 1, recordedAt: time }, error => error.code === 'limit')
  const fullEvents = initial(); fullEvents.events = Array.from({ length: 6000 }, () => ({})); fullEvents.sequence = 6001
  preservedRefusal(fullEvents, createCommand, error => error.code === 'limit')
  const lastRevision = create(initial()); lastRevision.requisitions[0].revision = 1000
  preservedRefusal(lastRevision, { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 1000, content: { ...content, headcount: 2 }, recordedAt: time }, error => error.code === 'limit')
})

test('requisition/job times are explicit causal facts without a global or cross-stream chronology floor', () => {
  const state = approved(); const earlier = '2020-01-01T00:00:00.000Z'
  const next = apply(state, { ...jobCommand, recordedAt: earlier })
  assert.equal(next.events.at(-1).recordedAt, earlier)
  assert.equal(next.events.at(-2).recordedAt, time)
  assert.equal(Object.hasOwn(next, 'simulationAt'), false)
})
