import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const urls = new Map()
async function load(path) {
  if (urls.has(path)) return import(urls.get(path))
  const source = readFileSync(new URL(`../../src/${path}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const dependencies = [...compiled.matchAll(/from ['"]\.\/([^'"]+)['"]/g)]
  const directory = path.slice(0, path.lastIndexOf('/') + 1)
  for (const dependency of dependencies) await load(`${directory}${dependency[1]}`)
  const resolved = compiled.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, dependency) => `from '${urls.get(`${directory}${dependency}`)}'`)
  urls.set(path, `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)
  return import(urls.get(path))
}
const [backup, storage, cms, cmsValidation, crm, crmValidation, hr, workflow, recruiting, performance, surveys] = await Promise.all([
  load('portals/backup'), load('portals/persistence'), load('cms/model'), load('cms/persistence'), load('crm/model'), load('crm/persistence'),
  load('hr/persistence'), load('hr/mock-workflows'), load('hr/recruiting-link'), load('hr/performance'), load('hr/surveys'),
])
const { createDemoBackup, parseDemoBackup, DEMO_BACKUP_LIMIT, DEMO_BACKUP_FILE_LIMIT } = backup
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const exportedAt = '2026-10-14T20:30:00.000Z'
const clone = value => JSON.parse(JSON.stringify(value))
const owner = { role: 'employer-owner' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const validateHr = value => hr.isHrDemoState(value, fixture)
const validCount = value => Boolean(value && typeof value === 'object' && typeof value.text === 'string')
const envelope = (data = { text: 'fictional sample' }, module = 'cms') => ({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt, data })

function hrSnapshot() {
  let state = hr.createHrDemoState(fixture)
  const candidate = state.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: candidate.jobId, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) {
    state = { ...state, ...recruiting.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, fixture) }
  }
  const effective = recruiting.recruitingFixture(fixture, state.recruiting)
  for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) state.workflow = workflow.transitionMockHr(state.workflow, avery, { type, planId: 'benefit-001', election: 'enroll' }, effective)
  state.workflow = workflow.transitionMockHr(state.workflow, manager, { type: 'approve-time', entryId: 'time-001' }, effective)
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) state.workflow = workflow.transitionMockHr(state.workflow, owner, { type }, effective)
  state.performance = performance.transitionPerformance(state.performance, avery, { type: 'update-goal-progress', goalId: state.performance.goals[0].id, progress: 40 }, effective)
  const surveyId = state.surveys.surveys[0].id
  state.surveys = surveys.transitionSurveys(state.surveys, owner, { type: 'publish-survey', surveyId }, effective)
  state.surveys = surveys.transitionSurveys(state.surveys, avery, { type: 'save-survey-response', surveyId, rating: 5, text: 'Fictional portable survey draft.' }, effective)
  state.selectedEmployee = state.recruiting.hiredEmployees[0].id
  return state
}

function cmsSnapshot() {
  const [author, reviewer, publisher] = cms.cmsActors
  let state = cms.createCmsState()
  const change = (type, actor = author, rest = {}) => {
    state = cms.transitionCms(state, { type, entryId: 'cms-article-001', expectedRevision: state.entries[1].revision, ...rest }, actor)
  }
  for (const [type, actor] of [['submit-review', author], ['approve-entry', reviewer], ['publish-entry', publisher]]) change(type, actor)
  change('edit-entry', author, { title: 'Portable fictional article', slug: 'portable-fictional-article', body: 'This is a saved draft, separate from its frozen publication.' })
  return state
}

function crmSnapshot() {
  const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
  let state = crm.createCrmState()
  const change = event => { state = crm.transitionCrm(state, riley, event) }
  change({ type: 'qualify-lead', leadId: 'lead-jules' })
  change({ type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 })
  const opportunityId = state.leads[0].opportunityId
  change({ type: 'create-task', opportunityId, title: 'Portable fictional follow-up' })
  change({ type: 'complete-task', taskId: state.tasks.at(-1).id })
  for (const stage of ['proposal', 'negotiation', 'won']) change({ type: 'advance-opportunity', opportunityId, stage })
  return state
}

test('HR backup preserves linked hires, benefits, approved payroll, goals and survey drafts as one snapshot', () => {
  const state = hrSnapshot()
  const restored = parseDemoBackup(createDemoBackup('hr', state, validateHr, exportedAt), 'hr', validateHr)
  assert.deepEqual(restored, { state, exportedAt })
  assert.notEqual(restored.state, state)
  assert.equal(restored.state.workflow.payrollHistory.length, 1)
  assert.equal(restored.state.workflow.benefitElections[0].stage, 'confirmed')
  assert.equal(restored.state.performance.goals[0].progress, 40)
  assert.equal(restored.state.surveys.surveys[0].responses[0].status, 'draft')
  assert.deepEqual(restored.state.operations.balances[restored.state.selectedEmployee], { vacation: 40, sick: 24 })
})

test('CMS backup preserves its newer draft, frozen publication, revision and activity receipts', () => {
  const state = cmsSnapshot()
  const text = createDemoBackup('cms', state, cmsValidation.isCmsState, exportedAt)
  const restored = parseDemoBackup(text, 'cms', cmsValidation.isCmsState).state
  assert.deepEqual(restored, state)
  assert.equal(restored.entries[1].revision, 2)
  assert.equal(restored.entries[1].published.revision, 1)
  assert.notEqual(restored.entries[1].title, restored.entries[1].published.title)
  assert.equal(restored.activity.length, 4)
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format', 'schemaVersion', 'module', 'exportedAt', 'data'])
})

test('CRM backup preserves a single conversion, won opportunity and completed follow-up without replay', () => {
  const state = crmSnapshot()
  const restored = parseDemoBackup(createDemoBackup('crm', state, crmValidation.isCrmState, exportedAt), 'crm', crmValidation.isCrmState).state
  assert.deepEqual(restored, state)
  const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
  assert.equal(crm.crmDashboard(restored, riley).wonCents, 150000)
  assert.equal(restored.tasks.at(-1).status, 'done')
  assert.throws(() => crm.transitionCrm(restored, riley, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 }), /cannot be converted again/)
})

test('backup metadata rejects other portals, legacy browser envelopes, unsupported versions and unknown fields', () => {
  const changes = [
    item => { item.module = 'hr' }, item => { item.schemaVersion = 2 }, item => { item.schemaVersion = '1' },
    item => { item.format = 'another-backup' }, item => { delete item.format }, item => { delete item.data },
    item => { item.secret = 'not-a-backup-field' },
  ]
  for (const change of changes) { const item = envelope(); change(item); assert.throws(() => parseDemoBackup(JSON.stringify(item), 'cms', validCount)) }
  assert.throws(() => parseDemoBackup(JSON.stringify({ schemaVersion: 1, module: 'cms', data: { text: 'sample' } }), 'cms', validCount))
  assert.throws(() => createDemoBackup('unknown', { text: 'sample' }, validCount, exportedAt), /Choose an HR, CMS or CRM/)
})

test('missing, impossible or noncanonical export timestamps are rejected and default export time is current UTC', () => {
  for (const value of [undefined, null, 0, '', 'yesterday', '2026-02-30T00:00:00.000Z', '2026-10-14', '2026-10-14T20:30:00Z', '2026-10-14T13:30:00.000-07:00']) {
    assert.throws(() => parseDemoBackup(JSON.stringify({ ...envelope(), exportedAt: value }), 'cms', validCount))
    assert.throws(() => createDemoBackup('cms', { text: 'sample' }, validCount, value ?? 'invalid'))
  }
  const before = Date.now()
  const actual = parseDemoBackup(createDemoBackup('cms', { text: 'sample' }, validCount), 'cms', validCount).exportedAt
  assert.ok(Date.parse(actual) >= before && Date.parse(actual) <= Date.now())
})

test('invalid nested domain graphs are rejected for all three portals without mutating the current workspace', () => {
  for (const [module, create, validate, corrupt] of [
    ['hr', hrSnapshot, validateHr, state => { delete state.workflow.onboarding[state.selectedEmployee] }],
    ['cms', cmsSnapshot, cmsValidation.isCmsState, state => { state.entries[1].published.body = 123 }],
    ['crm', crmSnapshot, crmValidation.isCrmState, state => { state.contacts[0].companyId = 'missing-company' }],
  ]) {
    const current = create()
    const before = clone(current)
    const invalid = clone(current)
    corrupt(invalid)
    assert.throws(() => parseDemoBackup(JSON.stringify(envelope(invalid, module)), module, validate), /incomplete or incompatible/)
    assert.throws(() => createDemoBackup(module, invalid, validate, exportedAt), /incomplete or incompatible/)
    assert.deepEqual(current, before)
  }
})

test('prototype-critical JSON property names are refused even when a permissive validator accepts data', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const item = envelope()
    item.data.extra = JSON.parse(`{"nested":{"${key}":{"polluted":true}}}`)
    assert.throws(() => parseDemoBackup(JSON.stringify(item), 'cms', validCount), /incomplete or incompatible/)
    assert.throws(() => createDemoBackup('cms', item.data, validCount, exportedAt), /incomplete or incompatible/)
  }
  assert.equal({}.polluted, undefined)
})

test('malformed JSON, non-object envelopes and throwing validators fail closed', () => {
  for (const text of ['', '{', 'null', '[]', 'true', '7', '"sample"', '{}']) assert.throws(() => parseDemoBackup(text, 'cms', validCount))
  const throws = () => { throw new Error('A broken validator') }
  assert.throws(() => parseDemoBackup(JSON.stringify(envelope()), 'cms', throws), /incomplete or incompatible/)
  assert.throws(() => createDemoBackup('cms', { text: 'sample' }, throws, exportedAt), /incomplete or incompatible/)
})

test('the exact storage-envelope boundary exports and imports while one additional character is refused', () => {
  const emptySave = JSON.stringify({ schemaVersion: storage.DEMO_STORAGE_VERSION, module: 'cms', data: { text: '' } })
  const state = { text: 'x'.repeat(storage.DEMO_STORAGE_LIMIT - emptySave.length) }
  const text = createDemoBackup('cms', state, validCount, exportedAt)
  assert.ok(text.length <= DEMO_BACKUP_LIMIT)
  assert.deepEqual(parseDemoBackup(text, 'cms', validCount).state, state)
  const oversized = { text: `${state.text}x` }
  assert.throws(() => createDemoBackup('cms', oversized, validCount, exportedAt), /browser save limit/)
  assert.throws(() => parseDemoBackup(JSON.stringify(envelope(oversized)), 'cms', validCount), /browser save limit/)
})

test('oversized decoded text is rejected before parsing or calling a domain validator', () => {
  let checked = false
  const validate = () => { checked = true; return true }
  assert.throws(() => parseDemoBackup('{'.repeat(DEMO_BACKUP_LIMIT + 1), 'cms', validate), /too large/)
  assert.equal(checked, false)
  assert.equal(DEMO_BACKUP_LIMIT, storage.DEMO_STORAGE_LIMIT + 512)
  assert.equal(DEMO_BACKUP_FILE_LIMIT, 4 * DEMO_BACKUP_LIMIT)
})

test('Unicode mock content survives file encoding while size checks use the actual saved string', () => {
  const state = { text: 'Fictional café — 你好 🌿' }
  const text = createDemoBackup('cms', state, validCount, exportedAt)
  assert.ok(Buffer.byteLength(text, 'utf8') <= DEMO_BACKUP_FILE_LIMIT)
  assert.deepEqual(parseDemoBackup(Buffer.from(text, 'utf8').toString('utf8'), 'cms', validCount).state, state)
})

test('nonserializable state is refused and serialized substitutions must still pass validation', () => {
  const circular = { text: 'sample' }; circular.self = circular
  assert.throws(() => createDemoBackup('cms', circular, validCount, exportedAt), /could not be serialized/)
  assert.throws(() => createDemoBackup('cms', { text: 'sample', value: 1n }, validCount, exportedAt), /could not be serialized/)
  assert.throws(() => createDemoBackup('cms', { text: 'sample', toJSON: () => null }, validCount, exportedAt), /incomplete or incompatible/)
})
