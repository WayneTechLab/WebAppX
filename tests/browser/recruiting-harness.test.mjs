import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assertCompleteWorkspaces, assertHistoryAppend, coveredRecruitingItems, displayedFacts } from './recruiting.mjs'
import { recruitingStatusInventory, recruitingStatusFamilies } from './recruiting-status-inventory.mjs'
import { auditStatusCoverage } from './portal-quality.mjs'
import * as records from './recruiting-expected.mjs'

const seed = JSON.parse(readFileSync(new URL('./fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const copy = value => structuredClone(value)

test('complete recruiting oracle detects omitted nested events, altered unchecked records and unknown additions', () => {
  const expected = copy(seed); records.legacyPublished(expected.hr); records.adopted(expected.hr)
  records.interviewScheduled(expected.hr, 1)
  records.scorecardSaved(expected.hr, { author: 'employee-001', id: records.ownIds.a1, revision: 1, comments: 'Private literal example.', at: records.times.future })
  assertCompleteWorkspaces(copy(expected), expected)
  const mutations = [
    value => value.hr.recruiting.lifecycle.events.pop(),
    value => { value.hr.recruiting.lifecycle.scorecards[0].content.comments = 'Wrong private draft' },
    value => { value.cms.entries[0].body = 'Unchecked portal loss' },
    value => { value.crm.sequence++ },
    value => { value.hr.workflow.unknownField = true },
  ]
  for (const mutate of mutations) { const actual = copy(expected); mutate(actual); assert.throws(() => assertCompleteWorkspaces(actual, expected), assert.AssertionError) }
})

test('handwritten hidden 2030 / other author 2026 ledger preserves raw legacy bytes and exact submission draft linkage', () => {
  const hr = copy(seed.hr); records.legacyPublished(hr)
  const legacy = JSON.stringify({ jobs: hr.recruiting.jobs, candidates: hr.recruiting.candidates, hiredEmployees: hr.recruiting.hiredEmployees, sequence: hr.recruiting.sequence })
  records.adopted(hr); records.interviewScheduled(hr, 1)
  records.scorecardSaved(hr, { author: 'employee-001', id: records.ownIds.a1, revision: 1, comments: 'Hidden future draft.', at: '2030-01-01T12:00:00.000Z' })
  records.scorecardSaved(hr, { author: 'employee-002', id: records.ownIds.b1, revision: 1, comments: 'Public 2026 revision.', at: '2026-10-15T09:00:00.000Z' })
  records.scorecardSubmitted(hr, records.ownIds.b1, '2026-10-15T09:00:00.000Z')
  const life = hr.recruiting.lifecycle
  assert.equal(life.events.length, 5); assert.equal(life.sequence, 6)
  assert.equal(life.applications[0].stageEnteredAt, null); assert.equal(life.applications[0].lastStageRecordedAt, null)
  assert.deepEqual(life.events.at(-1), { id: 'recruit-event-0005', sequence: 5, actor: { mode: 'interviewer', employeeId: 'employee-002' }, recordedAt: '2026-10-15T09:00:00.000Z', kind: 'scorecard-submitted', applicationId: 'rapplication-0001', interviewId: 'rinterview-0001', scorecardId: 'rscorecard-e808a3da06ee256f', authorEmployeeId: 'employee-002', draftEventId: 'recruit-event-0004', revision: 1 })
  assert.equal(JSON.stringify({ jobs: hr.recruiting.jobs, candidates: hr.recruiting.candidates, hiredEmployees: hr.recruiting.hiredEmployees, sequence: hr.recruiting.sequence }), legacy)
  assert.equal(life.scorecards[0].state, 'draft'); assert.equal(life.scorecards[1].state, 'submitted')
})

test('hire expectations distinguish recruiting-only completed provenance from selected v2 employment creation', () => {
  const hr = copy(seed.hr); records.legacyPublished(hr); records.adopted(hr)
  for (const [previous, stage, at] of [['applied', 'screening', records.times.screening], ['screening', 'interview', records.times.interview], ['interview', 'offer', records.times.offer]]) records.expectedStage(hr, 'rapplication-0001', previous, stage, at)
  records.caseyHired(hr)
  assert.equal(Object.hasOwn(hr.workflow, 'lifecycle'), false)
  assert.equal(hr.recruiting.hiredEmployees[0].id, 'employee-rperson-0001')
  assert.deepEqual(hr.recruiting.lifecycle.hireBindings[0].employmentAtHire, { kind: 'absent' })
  records.completedOriginalOnboarding(hr, 'employee-rperson-0001'); records.completedRecruitingBaseline(hr)
  const instance = hr.workflow.lifecycle.instances[3]
  assert.equal(instance.initial.status, 'active'); assert.equal(instance.startDate, null)
  assert.deepEqual(instance.recruitingBaseline.completion, { actor: 'unknown', effectiveDate: null })
  assert.equal(instance.recruitingBaseline.capturedOnboarding.receipt, 'MOCK-ONBOARDING-0001')
  assert.equal(hr.recruiting.hiredEmployees[0].employmentStatus, 'onboarding')
  const v2 = copy(seed.hr); records.selectedV2(v2); records.legacyPublished(v2); records.adopted(v2)
  for (const [previous, stage, at] of [['applied', 'screening', records.times.screening], ['screening', 'interview', records.times.interview], ['interview', 'offer', records.times.offer]]) records.expectedStage(v2, 'rapplication-0001', previous, stage, at)
  records.caseyHired(v2, 'sample-v2')
  assert.deepEqual(v2.workflow.onboarding['employee-rperson-0001'].tasks, { profile: false, policy: false, security: false })
  assert.equal(v2.workflow.lifecycle.instances[3].initial.status, 'onboarding')
  assert.equal(v2.workflow.lifecycle.instances[3].startDate, '2026-10-15')
  assert.deepEqual(v2.recruiting.lifecycle.hireBindings[0].employmentAtHire, { kind: 'created', instanceId: 'employment-employee-rperson-0001-1', hireEventId: 'lifecycle-3' })
})

test('foreign child retention setup expects exact CMS receipts/captures and preserves both frozen publication and CRM source', () => {
  const expected = copy(seed), publication = copy(seed.cms.entries[0].published), crm = JSON.stringify(seed.crm)
  records.foreignReleasePrepared(expected.cms)
  assert.equal(expected.cms.sequence, 5); assert.equal(expected.cms.activity.length, 5)
  assert.deepEqual(expected.cms.entries[0].published, publication)
  assert.equal(expected.cms.releaseBundles[0].name, 'Foreign preserved release preview')
  assert.equal(expected.cms.releaseBundles[0].members[0].approval.receipt, 'MOCK-CMS-0005')
  assert.equal(expected.cms.releaseBundles[0].members[1].approval.receipt, 'MOCK-CMS-0004')
  assert.equal(expected.cms.releaseBundles[0].activatedAtSequence, null)
  assert.equal(JSON.stringify(expected.crm), crm)
})

test('literal status inventory is finite and unknown observations cannot satisfy an absent required state', () => {
  assert.deepEqual(coveredRecruitingItems, ['WX-0201', 'WX-0202', 'WX-0203', 'WX-0204', 'WX-0205', 'WX-0206', 'WX-0207', 'WX-0208', 'WX-0209', 'WX-0210'])
  const observations = Object.entries(recruitingStatusInventory).flatMap(([family, states]) => Object.entries(states).map(([state, text]) => ({ family, state, text, capture: `${family}-${state}.png` })))
  assert.deepEqual(auditStatusCoverage(recruitingStatusFamilies, observations).missing, [])
  assert.equal(auditStatusCoverage(recruitingStatusFamilies, observations.slice(1)).missing.length, 1)
  assert.equal(auditStatusCoverage(recruitingStatusFamilies, [...observations.slice(1), { family: 'invented', state: 'ready', text: 'Invented', capture: 'invented.png' }]).missing.length, 1)
})

test('summary comparison retains nulls, every scalar and empty collections rather than substring totals', () => {
  assert.deepEqual(displayedFacts({ employeeId: 'employee-rperson-0001', payCents: 0, compensationConfigured: false, tasks: [{ id: 'profile', title: 'Complete own profile' }], previous: null, empty: [] }), { employeeId: 'employee-rperson-0001', payCents: '0', compensationConfigured: 'false', tasks: [{ id: 'profile', title: 'Complete own profile' }], previous: null, empty: 'No entries' })
})

test('recovery oracle requires one complete HR pre-state append, exact prior captures and valid Undo linkage', () => {
  const before = { schemaVersion: 1, points: [{ id: 'initial-seed-point', createdAt: '2026-10-15T12:00:00.000Z', kind: 'restore', modules: ['hr', 'cms', 'crm'], states: copy(seed) }] }
  const hr = copy(seed.hr); records.legacyPublished(hr); records.adopted(hr)
  const restore = { id: 'selected-hr-point', createdAt: '2026-10-15T12:01:00.000Z', kind: 'restore', modules: ['hr'], states: { hr } }
  const restored = { schemaVersion: 1, points: [restore, ...copy(before.points)] }
  assertHistoryAppend(JSON.stringify(before), JSON.stringify(restored), { kind: 'restore', hr })
  const undo = { id: 'undo-hr-point', createdAt: '2026-10-15T12:02:00.000Z', kind: 'undo', modules: ['hr'], states: { hr: copy(seed.hr) }, sourcePointId: 'selected-hr-point' }
  const undone = { schemaVersion: 1, points: [undo, ...copy(restored.points)] }
  assertHistoryAppend(JSON.stringify(restored), JSON.stringify(undone), { kind: 'undo', hr: seed.hr, sourcePointId: 'selected-hr-point' })
  for (const mutate of [value => value.points.pop(), value => { value.points[1].states.hr.recruiting.lifecycle.events = [] }, value => { value.points[0].states.hr.selectedEmployee = 'employee-003' }, value => { value.points[0].sourcePointId = 'initial-seed-point' }, value => { value.points[0].label = 'Invented automatic label' }, value => { value.points[0].modules.push('cms') }]) {
    const damaged = copy(undone); mutate(damaged)
    assert.throws(() => assertHistoryAppend(JSON.stringify(restored), JSON.stringify(damaged), { kind: 'undo', hr: seed.hr, sourcePointId: 'selected-hr-point' }), assert.AssertionError)
  }
})

test('browser expectations and journeys contain no application model oracle or saved-state injection', () => {
  for (const name of ['recruiting.mjs', 'recruiting-expected.mjs']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8')
    assert.equal(/from ['"][^'"]*src\//.test(source), false)
    assert.equal(/loadMockModel|transitionRecruiting|previewRecruiting|projectRecruitingView|localStorage\.setItem|addInitScript|React\.use|__react/.test(source), false)
  }
  const runner = readFileSync(new URL('../../scripts/browser-recruiting.mjs', import.meta.url), 'utf8')
  assert.match(runner, /runBrowserSuite\(\{ args, suite: 'recruiting', runChecks: runRecruiting \}\)/)
})
