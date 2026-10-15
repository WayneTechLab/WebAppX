import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = name => new URL(`../../src/hr/${name}.ts`, import.meta.url)
const persistence = await loadMockModel(source('persistence'))
const core = await loadMockModel(source('recruiting-lifecycle'))
const controllers = await loadMockModel(source('recruiting-controller'))
const { recruitingRequisitions } = await loadMockModel(source('recruiting-requisitions'))
const { recruitingInterviewHandler } = await loadMockModel(source('recruiting-interviews'))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { mode: 'native', actor: { role: 'employer-owner' } }
const actorA = { mode: 'interviewer', employeeId: 'employee-001' }
const actorB = { mode: 'interviewer', employeeId: 'employee-002' }
const services = {
  requisitions: recruitingRequisitions, interviews: recruitingInterviewHandler,
  hire: { build() { throw new Error('Hiring is outside this scorecard fixture.') } },
  validateCandidate: persistence.isHrDemoState,
  isTimeZoneSupported(zone) { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true } catch { return false } },
}
const content = comments => ({ rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 4, collaboration: 3, problemSolving: 5 }, comments })

test('real private controllers stale on hidden source changes without advancing another author’s time floor', () => {
  let state = persistence.createHrDemoState(fixture)
  state = core.buildRecruitingCandidate(state, owner, { kind: 'adopt', recordedAt: '2026-10-15T00:00:00.000Z' }, fixture, services).next
  state = core.buildRecruitingCandidate(state, owner, { kind: 'schedule-interview', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001', 'employee-002'], startAt: '2035-01-01T12:00:00.000Z', timeZone: 'UTC', durationMinutes: 60, recordedAt: '2026-10-15T09:00:00.000Z' }, fixture, services).next
  let accepted = 0, randomCounter = 0
  function ownPort(actor) {
    return controllers.recruitingInterviewerPort(controllers.createRecruitingController({
      readCurrent: () => state, readActor: () => actor, readEpoch: () => 0, readModeGeneration: () => 0, readRawFixture: () => fixture,
      replaceCurrent(build) { const next = build(state); assert.equal(persistence.isHrDemoState(next, fixture), true); state = next; accepted++; return true },
      // Deterministic fixture randomness only. Runtime uses the host's secure adapter.
      randomBytes: length => new Uint8Array(length).fill(++randomCounter), monotonicNow: () => 1, services,
    }))
  }
  const a = ownPort(actorA), b = ownPort(actorB)
  const bBefore = structuredClone(b.view())
  const bCommand = { kind: 'save-scorecard', interviewId: 'rinterview-0001', expectedRevision: null, content: content('Own B independent 2026 comments'), recordedAt: '2026-10-15T09:00:00.000Z' }
  const bPreview = b.preview(bCommand); assert.equal(bPreview.ok, true)
  const aPreview = a.preview({ kind: 'save-scorecard', interviewId: 'rinterview-0001', expectedRevision: null, content: content('SECRET A future draft comments'), recordedAt: '2030-01-01T12:00:00.000Z' })
  assert.equal(aPreview.ok, true); assert.match(aPreview.handle, /^[0-9a-f]{64}$/)
  assert.equal(a.confirm({ kind: 'save-scorecard', handle: aPreview.handle }).ok, true)
  assert.deepEqual(b.view(), bBefore, 'hidden saves change no allowed B projection field')
  const exactAfterA = JSON.stringify(state)
  const stale = b.confirm({ kind: 'save-scorecard', handle: bPreview.handle })
  assert.equal(stale.ok, false); assert.equal(stale.code, 'stale'); assert.equal(JSON.stringify(state), exactAfterA); assert.equal(accepted, 1)
  const retry = b.preview(bCommand)
  assert.equal(retry.ok, true); assert.equal(retry.preview.ownChronologyFloor, null)
  assert.equal(JSON.stringify(retry).includes('SECRET'), false); assert.equal(JSON.stringify(retry).includes('2030-01-01'), false)
  assert.equal(b.confirm({ kind: 'save-scorecard', handle: retry.handle }).ok, true)
  assert.equal(accepted, 2)
  assert.deepEqual(state.recruiting.lifecycle.scorecards.map(card => [card.authorEmployeeId, card.lastOwnRecordedAt, card.state]), [
    ['employee-001', '2030-01-01T12:00:00.000Z', 'draft'], ['employee-002', '2026-10-15T09:00:00.000Z', 'draft'],
  ])
  assert.equal(b.confirm({ kind: 'save-scorecard', handle: retry.handle }).ok, false)
  assert.equal(accepted, 2, 'a consumed handle cannot duplicate a draft')
})
