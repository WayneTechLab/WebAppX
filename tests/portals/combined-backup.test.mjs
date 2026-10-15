import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const urls = new Map()
async function moduleUrl(url) {
  if (urls.has(url.href)) return urls.get(url.href)
  const pending = (async () => {
    const source = readFileSync(url, 'utf8')
    if (url.pathname.endsWith('.json')) return `data:text/javascript;base64,${Buffer.from(`export default ${source}`).toString('base64')}`
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    const dependencies = new Map()
    for (const [, specifier] of compiled.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) {
      const dependency = new URL(specifier, url)
      if (!/\.(?:json|ts)$/.test(dependency.pathname)) dependency.pathname += '.ts'
      dependencies.set(specifier, await moduleUrl(dependency))
    }
    const resolved = compiled.replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (_, specifier) => `from '${dependencies.get(specifier)}'`)
    return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  })()
  urls.set(url.href, pending)
  return pending
}
async function load(path) { return import(await moduleUrl(new URL(`../../src/${path}.ts`, import.meta.url))) }
const [combined, backup, storage, registry, cms, crm, workflow, recruiting, performance, surveys] = await Promise.all([
  load('portals/combined-backup'), load('portals/backup'), load('portals/persistence'), load('portals/workspaces'),
  load('cms/model'), load('crm/model'), load('hr/mock-workflows'), load('hr/recruiting-link'), load('hr/performance'), load('hr/surveys'),
])
const { createCombinedBackup, parseCombinedBackup, COMBINED_BACKUP_LIMIT, COMBINED_BACKUP_FILE_LIMIT } = combined
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const exportedAt = '2026-10-14T20:30:00.000Z'
const clone = value => JSON.parse(JSON.stringify(value))
const owner = { role: 'employer-owner' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const envelope = (workspaces = registry.createDemoWorkspaces()) => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt, workspaces })

function snapshots() {
  const states = registry.createDemoWorkspaces()
  const candidate = states.hr.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: candidate.jobId, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) {
    states.hr = { ...states.hr, ...recruiting.applyRecruitingToHr(states.hr.recruiting, states.hr.workflow, states.hr.operations, owner, event, fixture) }
  }
  const effective = recruiting.recruitingFixture(fixture, states.hr.recruiting)
  for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) states.hr.workflow = workflow.transitionMockHr(states.hr.workflow, avery, { type, planId: 'benefit-001', election: 'enroll' }, effective)
  states.hr.workflow = workflow.transitionMockHr(states.hr.workflow, manager, { type: 'approve-time', entryId: 'time-001' }, effective)
  states.hr.workflow = workflow.transitionMockHr(states.hr.workflow, owner, { type: 'set-sample-rate', employeeId: 'employee-002', effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }, effective)
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) states.hr.workflow = workflow.transitionMockHr(states.hr.workflow, owner, { type, ...(type === 'prepare-payroll' ? { period: { start: '2026-10-01', end: '2026-10-15' } } : {}) }, effective)
  states.hr.performance = performance.transitionPerformance(states.hr.performance, avery, { type: 'update-goal-progress', goalId: states.hr.performance.goals[0].id, progress: 40 }, effective)
  const surveyId = states.hr.surveys.surveys[0].id
  states.hr.surveys = surveys.transitionSurveys(states.hr.surveys, owner, { type: 'publish-survey', surveyId }, effective)
  states.hr.surveys = surveys.transitionSurveys(states.hr.surveys, avery, { type: 'save-survey-response', surveyId, rating: 5, text: 'Fictional combined survey draft.' }, effective)
  states.hr.selectedEmployee = states.hr.recruiting.hiredEmployees[0].id

  const [author, reviewer, publisher] = cms.cmsActors
  for (const [type, actor] of [['submit-review', author], ['approve-entry', reviewer], ['publish-entry', publisher]]) {
    states.cms = cms.transitionCms(states.cms, { type, entryId: 'cms-article-001', expectedRevision: 1 }, actor)
  }
  states.cms = cms.transitionCms(states.cms, { type: 'edit-entry', entryId: 'cms-article-001', expectedRevision: 1, title: 'Fictional combined draft', slug: 'fictional-combined-draft', body: 'This combined backup keeps this new draft and its earlier publication.' }, author)

  const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
  for (const event of [{ type: 'qualify-lead', leadId: 'lead-jules' }, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 }]) states.crm = crm.transitionCrm(states.crm, riley, event)
  const opportunityId = states.crm.leads[0].opportunityId
  states.crm = crm.transitionCrm(states.crm, riley, { type: 'create-task', opportunityId, title: 'Fictional combined follow-up' })
  states.crm = crm.transitionCrm(states.crm, riley, { type: 'complete-task', taskId: states.crm.tasks.at(-1).id })
  for (const stage of ['proposal', 'negotiation', 'won']) states.crm = crm.transitionCrm(states.crm, riley, { type: 'advance-opportunity', opportunityId, stage })
  return states
}

test('combined round trip preserves complete linked HR, CMS and CRM workflows in one independent JSON snapshot', () => {
  const states = snapshots()
  const before = clone(states)
  const text = createCombinedBackup(states, exportedAt)
  const restored = parseCombinedBackup(text)
  assert.deepEqual(restored, { states, exportedAt })
  assert.deepEqual(states, before)
  assert.notEqual(restored.states, states)
  for (const module of ['hr', 'cms', 'crm']) assert.notEqual(restored.states[module], states[module])
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format', 'schemaVersion', 'exportedAt', 'workspaces'])
  assert.deepEqual(Object.keys(restored.states), ['hr', 'cms', 'crm'])
  assert.equal(restored.states.hr.workflow.payrollHistory.length, 1)
  assert.equal(restored.states.hr.workflow.benefitElections[0].stage, 'confirmed')
  assert.equal(restored.states.hr.performance.goals[0].progress, 40)
  assert.equal(restored.states.hr.surveys.surveys[0].responses[0].status, 'draft')
  assert.deepEqual(restored.states.hr.operations.balances[restored.states.hr.selectedEmployee], { vacation: 40, sick: 24 })
  assert.equal(restored.states.cms.entries[1].revision, 2)
  assert.equal(restored.states.cms.entries[1].published.revision, 1)
  assert.equal(restored.states.cms.activity.length, 4)
  assert.equal(restored.states.crm.tasks.at(-1).status, 'done')
  const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
  assert.equal(crm.crmDashboard(restored.states.crm, riley).wonCents, 150000)
  assert.throws(() => crm.transitionCrm(restored.states.crm, riley, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 }), /cannot be converted again/)
})

test('combined files and per-portal files retain separate unchanged formats', () => {
  const states = registry.createDemoWorkspaces()
  const single = backup.createDemoBackup('cms', states.cms, registry.demoWorkspaceValidators.cms, exportedAt)
  assert.equal(JSON.parse(single).format, 'webappx-mock-workspace')
  assert.throws(() => parseCombinedBackup(single), /combined HR, CMS and CRM backup/)
  assert.throws(() => backup.parseDemoBackup(createCombinedBackup(states, exportedAt), 'cms', registry.demoWorkspaceValidators.cms), /Choose a WebAppX mock workspace backup file/)
})

test('wrong format, unsupported versions and missing or unknown envelope fields are rejected', () => {
  for (const change of [
    item => { item.format = 'other-workspaces' }, item => { item.schemaVersion = 2 }, item => { item.schemaVersion = '1' },
    item => { delete item.format }, item => { delete item.workspaces }, item => { item.selected = ['cms'] },
    item => { item.data = 'not part of this envelope' },
  ]) {
    const item = envelope(); change(item)
    assert.throws(() => parseCombinedBackup(JSON.stringify(item)))
  }
})

test('the workspace map requires exactly HR, CMS and CRM for export and import', () => {
  for (const change of [
    value => { delete value.hr }, value => { delete value.cms }, value => { delete value.crm },
    value => { value.other = {} }, value => { value.HR = value.hr; delete value.hr },
  ]) {
    const states = registry.createDemoWorkspaces(); change(states)
    assert.throws(() => createCombinedBackup(states, exportedAt), /exactly/)
    assert.throws(() => parseCombinedBackup(JSON.stringify(envelope(states))), /exactly/)
  }
  for (const states of [null, [], 'sample', 0]) {
    assert.throws(() => createCombinedBackup(states, exportedAt), /exactly/)
    assert.throws(() => parseCombinedBackup(JSON.stringify(envelope(states))), /exactly/)
  }
})

test('a corrupt module rejects the entire file even when a caller intends to restore a different portal', () => {
  for (const [module, corrupt] of [
    ['hr', state => { delete state.workflow.onboarding[state.selectedEmployee] }],
    ['cms', state => { state.entries[1].published.body = 42 }],
    ['crm', state => { state.contacts[0].companyId = 'missing-company' }],
  ]) {
    const current = snapshots()
    const before = clone(current)
    const invalid = clone(current); corrupt(invalid[module])
    // Parsing has no selective-validation mode; a skipped module is checked too.
    assert.throws(() => parseCombinedBackup(JSON.stringify(envelope(invalid))), /incomplete or incompatible/)
    assert.throws(() => createCombinedBackup(invalid, exportedAt), /incomplete or incompatible/)
    assert.deepEqual(current, before)
  }
})

test('missing, impossible and noncanonical timestamps fail while default export time is current UTC', () => {
  for (const value of [undefined, null, 0, '', 'yesterday', '2026-02-30T00:00:00.000Z', '2026-10-14', '2026-10-14T20:30:00Z', '2026-10-14T13:30:00.000-07:00']) {
    assert.throws(() => parseCombinedBackup(JSON.stringify({ ...envelope(), exportedAt: value })))
    assert.throws(() => createCombinedBackup(registry.createDemoWorkspaces(), value ?? 'invalid'))
  }
  const before = Date.now()
  const timestamp = parseCombinedBackup(createCombinedBackup(registry.createDemoWorkspaces())).exportedAt
  assert.ok(Date.parse(timestamp) >= before && Date.parse(timestamp) <= Date.now())
})

test('prototype-critical properties in any nested workspace are refused without prototype modification', () => {
  for (const module of ['hr', 'cms', 'crm']) for (const key of ['__proto__', 'constructor', 'prototype']) {
    const states = registry.createDemoWorkspaces()
    states[module].transferNote = JSON.parse(`{"nested":{"${key}":{"polluted":true}}}`)
    assert.throws(() => parseCombinedBackup(JSON.stringify(envelope(states))), /incomplete or incompatible/)
    assert.throws(() => createCombinedBackup(states, exportedAt), /incomplete or incompatible/)
  }
  assert.equal({}.polluted, undefined)
})

test('malformed JSON and non-object envelopes fail closed', () => {
  for (const text of ['', '{', 'null', '[]', 'true', '7', '"sample"', '{}']) assert.throws(() => parseCombinedBackup(text))
  for (const text of [null, undefined, 7, {}]) assert.throws(() => parseCombinedBackup(text), /too large/)
})

test('combined size constants enforce decoded text and each portal keeps its exact browser-save limit', () => {
  assert.equal(COMBINED_BACKUP_LIMIT, 3 * backup.DEMO_BACKUP_LIMIT + 512)
  assert.equal(COMBINED_BACKUP_LIMIT, 6_002_048)
  assert.equal(COMBINED_BACKUP_FILE_LIMIT, 24_008_192)
  assert.throws(() => parseCombinedBackup('{'.repeat(COMBINED_BACKUP_LIMIT + 1)), /too large/)
  const states = registry.createDemoWorkspaces()
  states.hr.transferNote = ''
  const emptySave = JSON.stringify({ schemaVersion: storage.DEMO_STORAGE_VERSION, module: 'hr', data: states.hr })
  states.hr.transferNote = 'x'.repeat(storage.DEMO_STORAGE_LIMIT - emptySave.length)
  assert.deepEqual(parseCombinedBackup(createCombinedBackup(states, exportedAt)).states, states)
  states.hr.transferNote += 'x'
  assert.throws(() => createCombinedBackup(states, exportedAt), /browser save limit/)
  assert.throws(() => parseCombinedBackup(JSON.stringify(envelope(states))), /browser save limit/)
})

test('Unicode content survives UTF-8 encoding in the combined file', () => {
  const states = snapshots()
  states.hr.transferNote = 'Fictional café — 你好 🌿'
  const text = createCombinedBackup(states, exportedAt)
  assert.ok(Buffer.byteLength(text, 'utf8') <= COMBINED_BACKUP_FILE_LIMIT)
  assert.deepEqual(parseCombinedBackup(Buffer.from(text, 'utf8').toString('utf8')).states, states)
})

test('nonserializable data and serialized substitutions cannot bypass full workspace validation', () => {
  const circular = registry.createDemoWorkspaces(); circular.hr.transferNote = circular.hr
  assert.throws(() => createCombinedBackup(circular, exportedAt), /could not be serialized/)
  const bigint = registry.createDemoWorkspaces(); bigint.hr.transferNote = 1n
  assert.throws(() => createCombinedBackup(bigint, exportedAt), /could not be serialized/)
  const substituted = registry.createDemoWorkspaces(); substituted.hr.toJSON = () => null
  assert.throws(() => createCombinedBackup(substituted, exportedAt), /incomplete or incompatible/)
})

test('creating and parsing a backup never access browser storage or modify current records', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, get: () => { throw new Error('Storage access is forbidden during backup validation') } })
  try {
    const states = snapshots()
    const before = clone(states)
    assert.deepEqual(parseCombinedBackup(createCombinedBackup(states, exportedAt)).states, before)
    assert.deepEqual(states, before)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else delete globalThis.window
  }
})
