import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadMockModel } from '../browser/model-loader.mjs'
const core = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle.ts', import.meta.url))
const replay = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle-replay.ts', import.meta.url))
const projections = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle-projection.ts', import.meta.url))
const values = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle-value.ts', import.meta.url))
const controllers = await loadMockModel(new URL('../../src/hr/recruiting-controller.ts', import.meta.url))
const { recruitingRequisitions } = await loadMockModel(new URL('../../src/hr/recruiting-requisitions.ts', import.meta.url))
const { recruitingInterviewHandler } = await loadMockModel(new URL('../../src/hr/recruiting-interviews.ts', import.meta.url))
const { recruitingHireAdapter } = await loadMockModel(new URL('../../src/hr/recruiting-hire.ts', import.meta.url))
const legacy = await loadMockModel(new URL('../../src/hr/recruiting.ts', import.meta.url))
const legacyLink = await loadMockModel(new URL('../../src/hr/recruiting-link.ts', import.meta.url))
const raw = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces.hr
const copy = value => structuredClone(value)
const owner = { mode: 'native', actor: { role: 'employer-owner' } }
const A = { mode: 'interviewer', employeeId: 'employee-001' }, B = { mode: 'interviewer', employeeId: 'employee-002' }
const at = '2026-10-15T09:00:00.000Z'
// This trusted-validator test port isolates core guarantees. Complete HR import
// crosslinks are covered by the persistence lane; no browser oracle uses it.
const services = { requisitions: recruitingRequisitions, interviews: recruitingInterviewHandler, hire: recruitingHireAdapter, validateCandidate: () => true, isTimeZoneSupported: zone => { try { return (zone === 'UTC' || zone.includes('/')) && !/^[+-]/.test(zone) && Boolean(new Intl.DateTimeFormat('en-US', { timeZone: zone })) } catch { return false } } }
function initial() {
  const state = copy(seed)
  state.recruiting = legacy.transitionRecruiting(state.recruiting, owner.actor, { type: 'set-job-status', jobId: state.recruiting.jobs[0].id, status: 'published' }, raw)
  state.recruiting = legacy.transitionRecruiting(state.recruiting, owner.actor, { type: 'create-job', title: 'Second fictional role', department: 'Design', managerId: 'employee-001' }, raw)
  state.recruiting = legacy.transitionRecruiting(state.recruiting, owner.actor, { type: 'set-job-status', jobId: state.recruiting.jobs[1].id, status: 'published' }, raw)
  return state
}
function apply(state, command, actor = owner, ports = services) {
  const before = JSON.stringify(state), result = core.buildRecruitingCandidate(state, actor, { recordedAt: at, ...command }, raw, ports)
  assert.equal(JSON.stringify(state), before, 'every pure accepted action preserves its complete input')
  return result.next
}
const adopted = () => apply(initial(), { kind: 'adopt' })
function stage(state, nextStage, recordedAt = at, applicationId = 'rapplication-0001') { const app = state.recruiting.lifecycle.applications.find(app => app.id === applicationId); return apply(state, { kind: 'move-application', applicationId, expectedStage: app.stage, nextStage, recordedAt }) }
function interviewerState() { let state = adopted(); state = stage(state, 'screening'); state = stage(state, 'interview'); return apply(state, { kind: 'schedule-interview', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001', 'employee-002'], startAt: '2026-11-01T17:30:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 60 }) }
const content = comments => ({ rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 3, collaboration: 4, problemSolving: 5 }, comments })
function harness(source = initial()) {
  let state = source, actor = owner, epoch = 0, generation = 0, clock = 0, random = 0, rawFixture = copy(raw), writes = 0, beforeCommit = () => {}, accepts = true, validator = () => true
  const controller = controllers.createRecruitingController({ readCurrent: () => state, readActor: () => actor, readEpoch: () => epoch, readModeGeneration: () => generation, readRawFixture: () => rawFixture, monotonicNow: () => clock, randomBytes: length => new Uint8Array(length).fill(++random), services: { ...services, validateCandidate: (...args) => validator(...args) }, replaceCurrent(build) { beforeCommit(); if (!accepts) return false; const next = build(state); state = next; writes++; return true } })
  return { controller, get state() { return state }, get writes() { return writes }, replace(next) { state = next }, actor(next) { actor = next }, epoch() { epoch++ }, generation() { generation++ }, time(value) { clock = value }, raw(next) { rawFixture = next }, beforeCommit(fn) { beforeCommit = fn }, accepts(value) { accepts = value }, validate(fn) { validator = fn } }
}

test('read-only legacy view keeps all bytes and unknown times; adoption captures one honest baseline event without employment materialization', () => {
  const old = initial(), before = JSON.stringify(old)
  const view = projections.projectRecruitingView(old, owner, raw)
  assert.equal(JSON.stringify(old), before); assert.equal(Object.hasOwn(old.recruiting, 'lifecycle'), false)
  assert.deepEqual(view.applications[0].intervals, [{ stage: 'applied', enteredAt: null, exitedAt: null, durationMs: null, boundary: 'unknown-legacy' }])
  const state = apply(old, { kind: 'adopt' }), life = state.recruiting.lifecycle
  assert.deepEqual(life.adoption.legacyJobs, old.recruiting.jobs); assert.deepEqual(life.adoption.legacyCandidates, old.recruiting.candidates); assert.deepEqual(life.adoption.legacyHiredEmployees, [])
  assert.deepEqual(life.adoption.legacyHireLinks, []); assert.equal(life.events.length, 1); assert.equal(life.sequence, 2)
  assert.deepEqual(life.applications[0], { id: 'rapplication-0001', personId: 'rperson-0001', jobId: old.recruiting.jobs[0].id, stage: 'applied', stageEnteredAt: null, lastStageRecordedAt: null, provenance: { kind: 'legacy', candidateId: 'candidate-seed-001', initialStage: 'applied' }, hireBindingId: null })
  assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), false)
  assert.deepEqual(state.workflow, old.workflow); assert.deepEqual(state.operations, old.operations)
  assert.throws(() => apply(state, { kind: 'adopt' }), /already/)
})

test('adopted raw hires and actual unknown employment links are immutable; today’s later graph cannot invent adoption facts', () => {
  let old = initial()
  for (const stage of ['screening', 'interview', 'offer', 'hired']) old = { ...old, ...legacyLink.applyRecruitingToHr(old.recruiting, old.workflow, old.operations, owner.actor, { type: 'advance-candidate', candidateId: old.recruiting.candidates[0].id, stage }, raw) }
  const bytes = JSON.stringify(old.recruiting.hiredEmployees), state = apply(old, { kind: 'adopt' }), life = state.recruiting.lifecycle
  assert.equal(JSON.stringify(state.recruiting.hiredEmployees), bytes); assert.equal(JSON.stringify(life.adoption.legacyHiredEmployees), bytes)
  assert.deepEqual(life.adoption.legacyHireLinks, [{ employeeId: old.recruiting.hiredEmployees[0].id, instanceId: null, hireEventId: null }])
  assert.equal(life.hireBindings[0].employmentAtHire, null); assert.deepEqual(life.hireBindings[0].legacyEmploymentLinks, { instanceId: null, hireEventId: null }); assert.equal(life.hireBindings[0].initialBalances, null)
  const forged = copy(state); forged.recruiting.hiredEmployees[0].jobTitle = 'Rewritten capture'
  assert.throws(() => replay.replayRecruitingLifecycle(forged.recruiting, raw, services))
  assert.deepEqual(projections.projectRecruitingView(state, owner, raw).applications[0].legacyActivity, old.recruiting.candidates[0].activity)
})

test('duplicate email yields authorized conflict without a handle or any application/counter/save mutation', () => {
  const h = harness(adopted()), before = JSON.stringify(h.state)
  const result = h.controller.preview({ kind: 'create-person-application', jobId: h.state.recruiting.jobs[1].id, firstName: 'Wrong', lastName: 'Replacement', workEmail: ' CASEY.FICTION@EXAMPLE.INVALID ', recordedAt: at })
  assert.deepEqual(result.conflict, { kind: 'person', id: 'rperson-0001', displayName: 'Casey Fiction' }); assert.equal(result.code, 'conflict'); assert.equal(Object.hasOwn(result, 'handle'), false)
  assert.equal(JSON.stringify(h.state), before); assert.equal(h.writes, 0)
  h.actor(A)
  const denied = h.controller.preview({ kind: 'create-person-application', jobId: 'hidden', firstName: 'Wrong', lastName: 'Replacement', workEmail: 'casey.fiction@example.invalid', recordedAt: at })
  assert.equal(denied.code, 'unavailable'); assert.equal(JSON.stringify(denied).includes('Casey'), false); assert.equal(Object.hasOwn(denied, 'conflict'), false)
})

test('one person has two independently staged applications; withdrawal is terminal and cannot hire', () => {
  let state = adopted(); const jobId = state.recruiting.jobs[1].id
  state = apply(state, { kind: 'add-person-application', personId: 'rperson-0001', jobId })
  const second = copy(state.recruiting.lifecycle.applications[2]), prior = copy(state.recruiting.lifecycle.events)
  state = stage(state, 'screening')
  state = apply(state, { kind: 'end-application', applicationId: 'rapplication-0001', expectedStage: 'screening', outcome: 'withdrawn', reason: 'Fictional candidate chose to withdraw.' })
  assert.deepEqual(state.recruiting.lifecycle.applications[2], second)
  assert.deepEqual(state.recruiting.lifecycle.events.slice(0, prior.length), prior)
  assert.equal(state.recruiting.lifecycle.applications[0].stage, 'withdrawn')
  assert.equal(projections.projectRecruitingView(state, owner, raw).applications[0].outcomeReason, 'Fictional candidate chose to withdraw.')
  const before = JSON.stringify(state)
  assert.throws(() => stage(state, 'interview'))
  assert.throws(() => apply(state, { kind: 'hire', applicationId: 'rapplication-0001' }))
  assert.equal(JSON.stringify(state), before)
  assert.throws(() => apply(state, { kind: 'add-person-application', personId: 'rperson-0001', jobId }), core.RecruitingConflict)
})

test('person-derived atomic hire adds the exact linked records and leaves another application, payroll and legacy arrays unchanged', () => {
  let state = adopted(); state = apply(state, { kind: 'add-person-application', personId: 'rperson-0001', jobId: state.recruiting.jobs[1].id })
  for (const nextStage of ['screening', 'interview', 'offer']) state = stage(state, nextStage)
  const second = copy(state.recruiting.lifecycle.applications[2]), before = copy(state)
  const result = core.buildRecruitingCandidate(state, owner, { kind: 'hire', applicationId: 'rapplication-0001', recordedAt: at }, raw, services), next = result.next
  assert.equal(result.preview.hire.employee.id, 'employee-rperson-0001'); assert.deepEqual(result.preview.hire.balance, { employeeId: 'employee-rperson-0001', vacation: 40, sick: 24 })
  assert.deepEqual(next.workflow.onboarding['employee-rperson-0001'], { profileReviewed: false, jobReviewed: false, stage: 'draft', tasks: { profile: false, policy: false } })
  assert.equal(next.recruiting.lifecycle.hireBindings[0].employmentAtHire.kind, 'absent'); assert.equal(Object.hasOwn(next.workflow, 'lifecycle'), false)
  assert.deepEqual(next.recruiting.lifecycle.applications[2], second); assert.deepEqual(next.workflow.payroll, before.workflow.payroll); assert.deepEqual(next.recruiting.jobs, before.recruiting.jobs); assert.deepEqual(next.recruiting.candidates, before.recruiting.candidates)
  assert.equal(JSON.stringify(state), JSON.stringify(before))
  assert.throws(() => apply(next, { kind: 'hire', applicationId: 'rapplication-0001' }))
})

test('public stage durations use literal instants, preserve unknown legacy interval and require an explicit observation for an open stage', () => {
  let state = stage(adopted(), 'screening', '2026-10-15T09:00:00.000Z')
  state = stage(state, 'interview', '2026-10-16T12:00:00.000Z')
  const view = projections.projectRecruitingView(state, owner, raw)
  assert.deepEqual(view.applications[0].intervals, [
    { stage: 'applied', enteredAt: null, exitedAt: '2026-10-15T09:00:00.000Z', durationMs: null, boundary: 'unknown-legacy' },
    { stage: 'screening', enteredAt: '2026-10-15T09:00:00.000Z', exitedAt: '2026-10-16T12:00:00.000Z', durationMs: 97_200_000, boundary: 'known' },
    { stage: 'interview', enteredAt: '2026-10-16T12:00:00.000Z', exitedAt: null, durationMs: null, boundary: 'open' },
  ])
  assert.equal(projections.projectRecruitingView(state, owner, raw, { observedAt: '2026-10-16T13:00:00.000Z' }).applications[0].intervals[2].durationMs, 3_600_000)
  assert.throws(() => projections.projectRecruitingView(state, owner, raw, { observedAt: '2026-10-16T11:00:00.000Z' }))
  assert.throws(() => stage(state, 'offer', at)); assert.equal(stage(state, 'offer', '2026-10-16T12:00:00.000Z').recruiting.lifecycle.applications[0].stage, 'offer')
})

test('hidden future draft cannot advance another author or public stage clock; projections exclude drafts, earlier content and global event identifiers', () => {
  let state = interviewerState()
  state = apply(state, { kind: 'save-scorecard', interviewId: state.recruiting.lifecycle.interviews[0].id, expectedRevision: null, content: content('PRIVATE FIRST AUTHOR FUTURE DRAFT'), recordedAt: '2030-01-01T12:00:00.000Z' }, A)
  const ownB = projections.projectRecruitingView(state, B, raw)
  assert.equal(ownB.assignedInterviews[0].lastOwnRecordedAt, null); assert.equal(ownB.assignedInterviews[0].ownScorecard, null)
  assert.equal(JSON.stringify(ownB).includes('PRIVATE FIRST'), false); assert.equal(JSON.stringify(ownB).includes('2030-'), false)
  state = apply(state, { kind: 'save-scorecard', interviewId: state.recruiting.lifecycle.interviews[0].id, expectedRevision: null, content: content('SECOND AUTHOR PRIVATE SAVED ANSWER'), recordedAt: at }, B)
  const card = state.recruiting.lifecycle.scorecards.find(card => card.authorEmployeeId === B.employeeId)
  state = apply(state, { kind: 'submit-scorecard', scorecardId: card.id, expectedRevision: 1, recordedAt: at }, B)
  const manager = projections.projectRecruitingView(state, owner, raw)
  assert.equal(manager.submittedScorecards.length, 1); assert.equal(manager.submittedScorecards[0].content.comments, 'SECOND AUTHOR PRIVATE SAVED ANSWER')
  assert.equal(JSON.stringify(manager).includes('PRIVATE FIRST'), false); assert.equal(JSON.stringify(manager).includes('2030-'), false); assert.equal(JSON.stringify(manager).includes('latestDraftEventId'), false)
  const before = copy(state.recruiting.lifecycle.applications[0]); state = stage(state, 'offer', at)
  assert.equal(state.recruiting.lifecycle.applications[0].lastStageRecordedAt, at); assert.equal(before.stageEnteredAt, at)
  const wrong = copy(state); wrong.recruiting.lifecycle.scorecards[1].latestDraftEventId = wrong.recruiting.lifecycle.scorecards[0].latestDraftEventId
  assert.throws(() => replay.replayRecruitingLifecycle(wrong.recruiting, raw, services))
})

test('strict replay refuses changed current stage/cursor/event order and frozen base without repairing the source', () => {
  const valid = stage(adopted(), 'screening')
  for (const mutate of [state => { state.recruiting.lifecycle.applications[0].stage = 'offer' }, state => { state.recruiting.lifecycle.applications[0].lastStageRecordedAt = '2030-01-01T00:00:00.000Z' }, state => { state.recruiting.lifecycle.events[1].sequence = 44 }, state => { state.recruiting.lifecycle.events[1].previousStage = 'interview' }, state => { state.recruiting.candidates[0].activity.push({ receipt: 'forged', action: 'forged', actorRole: 'employer-owner' }) }, state => { state.recruiting.lifecycle.extra = true }]) {
    const bad = copy(valid); mutate(bad); const bytes = JSON.stringify(bad)
    assert.throws(() => replay.replayRecruitingLifecycle(bad.recruiting, raw, services)); assert.equal(JSON.stringify(bad), bytes)
  }
})

test('private random handle binds full latest source even for same-sequence replacements and consumes failures', () => {
  const h = harness(), preview = h.controller.preview({ kind: 'adopt', recordedAt: at })
  assert.equal(preview.ok, true); assert.match(preview.handle, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(preview).includes('profileEmails'), false); assert.equal(JSON.stringify(preview).includes('payrollHistory'), false)
  const changed = copy(h.state); changed.workflow.profileEmails['employee-003'] = 'changed@fixture.invalid'; h.replace(changed)
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: preview.handle }).code, 'stale'); assert.equal(h.writes, 0); assert.deepEqual(h.state, changed)
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: preview.handle }).code, 'stale')
  const fresh = h.controller.preview({ kind: 'adopt', recordedAt: at }); assert.equal(fresh.ok, true)
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: fresh.handle }).ok, true); assert.equal(h.writes, 1)
})

test('confirm rechecks actor, epoch, mode, fixture, TTL and actual source inside the synchronous commit', () => {
  for (const modify of [h => h.actor({ mode: 'native', actor: { role: 'hr-admin' } }), h => h.epoch(), h => h.generation(), h => h.time(600_000), h => { const fixture = copy(raw); fixture.company.name = 'Different raw fixture'; h.raw(fixture) }, h => h.beforeCommit(() => { const next = copy(h.state); next.completed.push('accepted-before-commit'); h.replace(next) })]) {
    const h = harness(), p = h.controller.preview({ kind: 'adopt', recordedAt: at }); modify(h)
    const result = h.controller.confirm({ kind: 'adopt', handle: p.handle })
    assert.equal(result.ok, false); assert.equal(h.writes, 0); assert.equal(Object.hasOwn(h.state.recruiting, 'lifecycle'), false)
  }
})

test('cancel, eviction, cross-controller, wrong kind and no-updater acceptance cannot apply or replay a preview', () => {
  const h = harness(), handles = Array.from({ length: 9 }, () => h.controller.preview({ kind: 'adopt', recordedAt: at }).handle)
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: handles[0] }).code, 'stale')
  h.controller.cancel(handles[1]); assert.equal(h.controller.confirm({ kind: 'adopt', handle: handles[1] }).code, 'stale')
  const other = harness(); assert.equal(other.controller.confirm({ kind: 'adopt', handle: handles[2] }).code, 'stale')
  assert.equal(h.controller.confirm({ kind: 'hire', handle: handles[3] }).code, 'stale')
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: handles[3] }).code, 'stale')
  h.accepts(false); assert.equal(h.controller.confirm({ kind: 'adopt', handle: handles[4] }).ok, false); assert.equal(h.writes, 0)
  h.controller.dispose(); assert.equal(h.controller.preview({ kind: 'adopt', recordedAt: at }).code, 'unavailable')
})

test('complete candidate refusal and unsafe JSON/date inputs preserve all bytes without evaluating accessors', () => {
  const state = initial(), before = JSON.stringify(state)
  assert.throws(() => core.buildRecruitingCandidate(state, owner, { kind: 'adopt', recordedAt: at }, raw, { ...services, validateCandidate: next => !Object.hasOwn(next.recruiting, 'lifecycle') }))
  assert.equal(JSON.stringify(state), before)
  let reads = 0
  const bad = { kind: 'adopt', recordedAt: at }; Object.defineProperty(bad, 'hidden', { enumerable: true, get() { reads++; throw new Error('must never read') } })
  assert.throws(() => core.buildRecruitingCandidate(state, owner, bad, raw, services)); assert.equal(reads, 0)
  for (const recordedAt of ['2026-02-30T00:00:00.000Z', '2026-10-15T09:00:00Z', '2026-10-15T09:00:00.000+00:00', 123, null]) assert.throws(() => apply(state, { kind: 'adopt', recordedAt }))
  assert.throws(() => values.canonicalRecruitingJson([, 1])); assert.throws(() => values.canonicalRecruitingJson({ value: undefined })); assert.throws(() => values.canonicalRecruitingJson(Object.create({ inherited: true })))
})

test('a directory correction can free an old raw email for a new person without inventing historical email eligibility', () => {
  let state = adopted(); state.workflow.profileEmails['employee-002'] = 'avery.changed@fixture.invalid'
  state = apply(state, { kind: 'create-person-application', jobId: state.recruiting.jobs[0].id, firstName: 'Another', lastName: 'Fiction', workEmail: 'avery@example.invalid' })
  assert.equal(state.recruiting.lifecycle.people.at(-1).workEmail, 'avery@example.invalid')
  assert.deepEqual(replay.replayRecruitingLifecycle(state.recruiting, raw, services), state.recruiting.lifecycle)
})

test('secure randomness failure has no fallback; unsupported getter kinds and hidden array properties are rejected without reads', () => {
  const h = harness(), before = JSON.stringify(h.state)
  let reads = 0
  const command = { recordedAt: at }; Object.defineProperty(command, 'kind', { enumerable: true, get() { reads++; return 'adopt' } })
  assert.equal(h.controller.preview(command).ok, false); assert.equal(reads, 0)
  const narrow = controllers.recruitingInterviewerPort(h.controller); assert.equal(narrow.preview(command).ok, false); assert.equal(reads, 0)
  assert.equal(narrow.confirm(command).ok, false); assert.equal(reads, 0)
  const array = [1]; Object.defineProperty(array, 'hidden', { value: 'not JSON', enumerable: false }); assert.throws(() => values.canonicalRecruitingJson(array))
  const unavailable = controllers.createRecruitingController({ readCurrent: () => h.state, readActor: () => owner, readEpoch: () => 0, readModeGeneration: () => 0, readRawFixture: () => raw, replaceCurrent() { throw new Error('must not write') }, randomBytes() { throw new Error('secure randomness unavailable') }, monotonicNow: () => 0, services })
  assert.equal(unavailable.preview({ kind: 'adopt', recordedAt: at }).code, 'unavailable')
  assert.equal(JSON.stringify(h.state), before)
})

test('wrong unauthorized confirmation consumes its supplied known handle without exposing lookup results', () => {
  const h = harness(), p = h.controller.preview({ kind: 'adopt', recordedAt: at })
  assert.equal(h.controller.confirm({ kind: 'save-scorecard', handle: p.handle }).ok, false)
  assert.equal(h.controller.confirm({ kind: 'adopt', handle: p.handle }).code, 'stale'); assert.equal(h.writes, 0)
})

test('issued preview history is bounded at4096 and consumed secure-random collisions never reissue an old handle', () => {
  const tinyRaw = { employees: [] }, state = { recruiting: { jobs: [], candidates: [], hiredEmployees: [], sequence: 0 }, workflow: { onboarding: {}, profileEmails: {}, employeeStatuses: {}, sequence: 1 }, operations: { balances: {} } }
  let number = 0, writes = 0
  const adapter = { readCurrent: () => state, readActor: () => owner, readEpoch: () => 0, readModeGeneration: () => 0, readRawFixture: () => tinyRaw, replaceCurrent() { writes++; return false }, randomBytes(length) { const bytes = new Uint8Array(length); new DataView(bytes.buffer).setUint32(0, ++number); return bytes }, monotonicNow: () => 0, services }
  const c = controllers.createRecruitingController(adapter), bytes = JSON.stringify(state)
  for (let index = 0; index < 4096; index++) { const p = c.preview({ kind: 'adopt', recordedAt: at }); assert.equal(p.ok, true, `valid preview ${index}`); c.cancel(p.handle) }
  const limited = c.preview({ kind: 'adopt', recordedAt: at }); assert.equal(limited.code, 'limit'); assert.match(limited.message, /Temporary preview capacity/)
  assert.equal(JSON.stringify(state), bytes); assert.equal(writes, 0)
  const repeated = controllers.createRecruitingController({ ...adapter, randomBytes: length => new Uint8Array(length).fill(7) })
  const first = repeated.preview({ kind: 'adopt', recordedAt: at }); assert.equal(first.ok, true); repeated.cancel(first.handle)
  assert.equal(repeated.preview({ kind: 'adopt', recordedAt: at }).code, 'unavailable')
  assert.equal(repeated.confirm({ kind: 'adopt', handle: first.handle }).code, 'stale'); assert.equal(writes, 0)
})

test('core composes the actual complete HR validator nonrecursively for adoption, independent applications and linked hiring', async () => {
  const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
  const strict = { ...services, validateCandidate: persistence.isHrDemoState }
  let state = apply(initial(), { kind: 'adopt' }, owner, strict)
  state = apply(state, { kind: 'add-person-application', personId: 'rperson-0001', jobId: state.recruiting.jobs[1].id }, owner, strict)
  for (const nextStage of ['screening', 'interview', 'offer']) state = apply(state, { kind: 'move-application', applicationId: 'rapplication-0001', expectedStage: state.recruiting.lifecycle.applications[0].stage, nextStage }, owner, strict)
  state = apply(state, { kind: 'hire', applicationId: 'rapplication-0001' }, owner, strict)
  assert.equal(persistence.isHrDemoState(state, raw), true)
  const corrupt = copy(state); delete corrupt.workflow.onboarding['employee-rperson-0001']
  assert.equal(persistence.isHrDemoState(corrupt, raw), false)
  const bytes = JSON.stringify(corrupt)
  assert.throws(() => core.buildRecruitingCandidate(corrupt, owner, { kind: 'end-application', applicationId: 'rapplication-0003', expectedStage: 'applied', outcome: 'rejected', reason: 'Fictional rejection.', recordedAt: at }, raw, strict))
  assert.equal(JSON.stringify(corrupt), bytes)
})

test('adoption captures actual known legacy employment links once rather than resolving them from later overlays', async () => {
  const workflows = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
  let old = initial(); old.workflow.lifecycle = workflows.createHrLifecycle(old.workflow, raw, null)
  for (const stage of ['screening', 'interview', 'offer', 'hired']) old = { ...old, ...legacyLink.applyRecruitingToHr(old.recruiting, old.workflow, old.operations, owner.actor, { type: 'advance-candidate', candidateId: old.recruiting.candidates[0].id, stage }, raw) }
  const state = apply(old, { kind: 'adopt' }), id = 'employee-recruit-seed-001'
  assert.deepEqual(state.recruiting.lifecycle.adoption.legacyHireLinks, [{ employeeId: id, instanceId: `employment-${id}-1`, hireEventId: 'lifecycle-1' }])
  assert.deepEqual(state.recruiting.lifecycle.hireBindings[0].legacyEmploymentLinks, { instanceId: `employment-${id}-1`, hireEventId: 'lifecycle-1' })
  assert.equal(state.recruiting.lifecycle.hireBindings[0].employmentAtHire, null)
  assert.deepEqual(state.workflow.lifecycle, old.workflow.lifecycle, 'adoption adds no invented employment events or dates')
})

test('private captured-source character budget evicts old previews before eight handles using complete valid HR input', async () => {
  const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
  const rawFixture = { ...copy(raw), fictionalFixturePadding: 'x'.repeat(600_000) }
  let state = initial()
  state.completed = Array.from({ length: 60 }, (_, index) => `${index}-${'x'.repeat(9990)}`)
  assert.equal(persistence.isHrDemoState(state, rawFixture), true)
  const before = copy(state), bytes = JSON.stringify(state)
  const capturedCharacters = values.canonicalRecruitingJson(state).length + values.canonicalRecruitingJson(rawFixture).length
  assert.ok(capturedCharacters * 3 <= 4_000_000 && capturedCharacters * 4 > 4_000_000, 'independent threshold requires fourth preview to evict exactly the oldest, below eight handles')
  let number = 0, writes = 0
  const controller = controllers.createRecruitingController({ readCurrent: () => state, readActor: () => owner, readEpoch: () => 0, readModeGeneration: () => 0, readRawFixture: () => rawFixture, monotonicNow: () => 0, randomBytes(length) { const data = new Uint8Array(length); new DataView(data.buffer).setUint32(0, ++number); return data }, replaceCurrent(build) { const next = build(state); assert.equal(persistence.isHrDemoState(next, rawFixture), true); state = next; writes++; return true }, services: { ...services, validateCandidate: persistence.isHrDemoState } })
  const handles = Array.from({ length: 4 }, () => { const result = controller.preview({ kind: 'adopt', recordedAt: at }); assert.equal(result.ok, true); return result.handle })
  assert.equal(JSON.stringify(state), bytes); assert.equal(writes, 0, 'all previews preserve every record and counter')
  assert.equal(controller.confirm({ kind: 'adopt', handle: handles[0] }).code, 'stale'); assert.equal(writes, 0, 'budget-evicted preview never reaches the writer')
  assert.equal(controller.confirm({ kind: 'adopt', handle: handles[3] }).ok, true); assert.equal(writes, 1, 'retained recent preview confirms once through the actual full validator')
  assert.equal(state.recruiting.lifecycle.events.length, 1); assert.equal(state.recruiting.lifecycle.sequence, 2)
  const unchanged = copy(state); delete unchanged.recruiting.lifecycle
  assert.deepEqual(unchanged, before)
})

test('narrow interviewer wrong-kind and getter-kind confirmations consume a real own handle and preserve complete saved input', async () => {
  const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
  for (const malformed of [false, true]) {
    const h = harness(interviewerState()); h.actor(A); h.validate(persistence.isHrDemoState)
    const port = controllers.recruitingInterviewerPort(h.controller)
    const preview = port.preview({ kind: 'save-scorecard', interviewId: 'rinterview-0001', expectedRevision: null, content: content('Own private draft awaiting confirmation'), recordedAt: at })
    assert.equal(preview.ok, true)
    let reads = 0
    const request = { handle: preview.handle, kind: 'hire' }
    if (malformed) Object.defineProperty(request, 'kind', { enumerable: true, get() { reads++; throw new Error('never evaluate kind getter') } })
    const bytes = JSON.stringify(h.state)
    assert.equal(port.confirm(request).code, 'unavailable'); assert.equal(reads, 0)
    assert.equal(port.confirm({ kind: 'save-scorecard', handle: preview.handle }).code, 'stale')
    assert.equal(h.writes, 0); assert.equal(JSON.stringify(h.state), bytes)
  }
})
