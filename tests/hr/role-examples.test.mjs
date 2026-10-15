import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import test from 'node:test'
import ts from 'typescript'
import { validateHrRoleExamples, renderHrRoleExamples, checkHrRoleExamples, runHrRoleExamples } from '../../scripts/hr-role-examples.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixture = JSON.parse(readFileSync(new URL('../fixtures/hr-capability-examples.json', import.meta.url), 'utf8'))
const company = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const script = resolve(root, 'scripts/hr-role-examples.mjs')
const clone = value => structuredClone(value)

// Compile the actual application modules in memory. Neither the generator nor
// its rendered document supplies expected domain behavior to these models.
const urls = new Map()
async function load(name) {
  name = posix.normalize(name)
  if (urls.has(name)) return import(urls.get(name))
  const path = resolve(root, 'src', `${name}.ts`)
  let compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  compiled = compiled.replace(/import (\w+) from ['"]([^'"]+\.json)['"];?/g, (_, binding, relative) => `const ${binding} = ${readFileSync(resolve(dirname(path), relative), 'utf8')};`)
  const dependencies = [...compiled.matchAll(/from ['"](\.[^'"]+)['"]/g)]
  for (const dependency of dependencies) await load(posix.join(posix.dirname(name), dependency[1]))
  compiled = compiled.replace(/from ['"](\.[^'"]+)['"]/g, (_, dependency) => `from '${urls.get(posix.normalize(posix.join(posix.dirname(name), dependency)))}'`)
  urls.set(name, `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  return import(urls.get(name))
}
const model = await load('hr/model')
const workflow = await load('hr/mock-workflows')
const performance = await load('hr/performance')
const surveys = await load('hr/surveys')
const persistence = await load('hr/persistence')
const backup = await load('portals/backup')
const workspaces = await load('portals/workspaces')
const combined = await load('portals/combined-backup')
const cms = await load('cms/model')
const crm = await load('crm/model')

const approvalRefusal = 'Approval requires a submitted entry within this role and team scope; self-approval is unavailable.'
// These literal expectations make a fixture edit that silently reverses a
// documented permission require its own independent test review.
const literalResults = {
  'owner-change-known-profile': ['allow', ['profileEmails', 'employee-002'], 'reviewed.example@example.invalid'],
  'owner-cannot-impersonate-self-review': ['deny', 'Only the employee can write or submit their own sample self-review.'],
  'payroll-review-onboarding': ['allow', ['onboarding', 'employee-003', 'profileReviewed'], true],
  'payroll-cannot-edit-profile': ['deny', 'This demo role cannot change that employee profile.'],
  'hr-approve-submitted-time': ['allow', ['timeEntries', '0', 'status'], 'approved'],
  'hr-cannot-impersonate-manager-review': ['deny', 'Only the assigned direct manager can review or publish this sample cycle.'],
  'manager-approve-direct-report': ['allow', ['timeEntries', '0', 'status'], 'approved'],
  'manager-refuse-draft-time': ['deny', approvalRefusal],
  'manager-refuse-unrelated-report': ['deny', approvalRefusal],
  'manager-refuse-self-approval': ['deny', approvalRefusal],
  'manager-refuse-unsubmitted-review': ['deny', 'The employee must submit the self-review before manager review. Published reviews are locked.'],
  'manager-publish-reviewed-cycle': ['allow', ['reviews', '0', 'stage'], 'published'],
  'employee-edit-own-profile': ['allow', ['profileEmails', 'employee-002'], 'reviewed.example@example.invalid'],
  'employee-refuse-foreign-profile': ['deny', 'This demo role cannot change that employee profile.'],
  'employee-refuse-unreviewed-benefit': ['deny', 'Review the sample election before confirming.'],
  'employee-confirm-reviewed-benefit': ['allow', ['benefitElections', '0', 'stage'], 'confirmed'],
  'contractor-refuse-employee-time': ['deny', 'A bound synthetic employee identity is required.'],
  'auditor-refuse-time-approval': ['deny', approvalRefusal],
}

test('reviewed fixture pins the original criterion and seven literal synthetic actors', () => {
  assert.equal(validateHrRoleExamples(fixture), fixture)
  assert.equal(fixture.review.proposalId, 'WX-0908')
  assert.equal(fixture.review.canonicalDocument, 'docs/PORTAL-CAPABILITIES.md')
  assert.equal(fixture.review.hashMode, 'utf8-lf-sha256')
  assert.equal(fixture.review.criterion, 'A documentation generator derives the HR role examples from reviewed capability fixtures, links the canonical cross-portal matrix and fails its consistency check when documented actions drift from the fixture definitions.')
  assert.deepEqual(fixture.roles.map(row => row.role), ['employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor'])
  assert.deepEqual(fixture.cases.map(row => row.id).sort(), Object.keys(literalResults).sort())
})

for (const row of fixture.cases) test(`literal domain case: ${row.id}`, () => {
  const expected = literalResults[row.id]
  const actualLiteral = row.expected.outcome === 'allow' ? ['allow', row.expected.path, row.expected.value] : ['deny', row.expected.error]
  assert.deepEqual(actualLiteral, expected)
  const create = row.domain === 'workflow' ? workflow.createMockHrState : performance.createPerformanceState
  const transition = row.domain === 'workflow' ? workflow.transitionMockHr : performance.transitionPerformance
  let state = create(company)
  for (const step of row.setup) state = transition(state, step.actor, step.event, company)
  const before = clone(state)
  if (expected[0] === 'deny') assert.throws(() => transition(state, row.actor, row.event, company), error => error.message === expected[1])
  else {
    const next = transition(state, row.actor, row.event, company)
    assert.equal(expected[1].reduce((value, key) => value[key], next), expected[2])
    assert.notDeepEqual(next, state)
  }
  assert.deepEqual(state, before, 'Both success and refusal preserve the input state')
})

const allEmployees = ['employee-001', 'employee-002', 'employee-003']
const allDocuments = ['document-001', 'document-002', 'document-003']
const ownDocuments = ['document-001', 'document-002']
const literalProjections = {
  'employer-owner': [allEmployees, allDocuments, true, false],
  'payroll-admin': [allEmployees, allDocuments, true, false],
  'hr-admin': [allEmployees, allDocuments, false, false],
  manager: [allEmployees, ownDocuments, false, false],
  employee: [['employee-002'], ownDocuments, true, true],
  contractor: [[], ['document-003'], false, false],
  auditor: [allEmployees, allDocuments, false, false],
}
for (const row of fixture.roles) test(`literal resource projections: ${row.role}`, () => {
  const expected = literalProjections[row.role]
  assert.deepEqual([row.projection.employeeIds, row.projection.documentIds, row.projection.compensationVisible, row.projection.selfDraftVisible], expected)
  assert.deepEqual(model.scopedEmployees(row.actor, company.employees).map(value => value.id), expected[0])
  assert.deepEqual(model.scopedRecords(row.actor, company.documents, company.employees).map(value => value.id), expected[1])
  assert.equal(model.canViewCompensation(row.actor, 'employee-002'), expected[2])
  let state = performance.createPerformanceState(company)
  state = performance.transitionPerformance(state, { role: 'employee', employeeId: 'employee-002' }, { type: 'save-self-review', reviewId: 'review-seed-employee-002', comments: 'Fictional private draft.' }, company)
  const projected = performance.scopedPerformance(state, row.actor, company).reviews.find(value => value.id === 'review-seed-employee-002')
  assert.equal(Boolean(projected && Object.hasOwn(projected, 'selfComments')), expected[3])
})

test('all HR roles export complete saved state even when their visible projections omit its drafts', () => {
  const state = persistence.createHrDemoState(company)
  state.performance = performance.transitionPerformance(state.performance, { role: 'employee', employeeId: 'employee-002' }, { type: 'save-self-review', reviewId: 'review-seed-employee-002', comments: 'Fictional saved draft outside auditor pages.' }, company)
  state.surveys = surveys.transitionSurveys(state.surveys, { role: 'employer-owner' }, { type: 'publish-survey', surveyId: 'survey-001' }, company)
  state.surveys = surveys.transitionSurveys(state.surveys, { role: 'employee', employeeId: 'employee-002' }, { type: 'save-survey-response', surveyId: 'survey-001', rating: 4, text: 'Fictional saved survey draft.' }, company)
  assert.equal(persistence.isHrDemoState(state, company), true)
  for (const { actor } of fixture.roles) {
    const text = backup.createDemoBackup('hr', state, value => persistence.isHrDemoState(value, company), '2026-10-15T12:00:00.000Z')
    const restored = backup.parseDemoBackup(text, 'hr', value => persistence.isHrDemoState(value, company)).state
    assert.deepEqual(restored, state)
    assert.equal(restored.performance.reviews[0].selfComments, 'Fictional saved draft outside auditor pages.')
    assert.equal(restored.surveys.surveys[0].responses[0].status, 'draft')
    if (['contractor', 'auditor'].includes(actor.role)) assert.equal(JSON.stringify(performance.scopedPerformance(state.performance, actor, company)).includes('Fictional saved draft outside auditor pages.'), false)
  }
  assert.equal(surveys.scopedSurveys(state.surveys, { role: 'auditor' }, company)[0].responses.length, 0)
})

test('CMS, CRM and combined mock exports also retain the complete domain graph', () => {
  const states = workspaces.createDemoWorkspaces()
  const stamp = '2026-10-15T12:00:00.000Z'
  for (const module of ['hr', 'cms', 'crm']) {
    const restored = backup.parseDemoBackup(backup.createDemoBackup(module, states[module], workspaces.demoWorkspaceValidators[module], stamp), module, workspaces.demoWorkspaceValidators[module]).state
    assert.deepEqual(restored, states[module])
  }
  assert.ok(states.cms.entries.some(entry => entry.status === 'draft'))
  assert.ok(cms.cmsPublishedEntries(states.cms).length < states.cms.entries.length)
  const representative = crm.crmActors.find(actor => actor.id === 'sales-riley')
  assert.ok(crm.scopedCrmState(states.crm, representative).leads.length < states.crm.leads.length)
  assert.deepEqual(combined.parseCombinedBackup(combined.createCombinedBackup(states, stamp)).states, states)
  assert.deepEqual(fixture.exportBoundary.modules, ['hr', 'cms', 'crm'])
  assert.equal(fixture.exportBoundary.access, 'all-preview-roles')
  assert.equal(fixture.exportBoundary.contents, 'complete-saved-domain-state')
})

test('documentation check rejects changed actions, prerequisites, outcomes and edited prose', async () => {
  const markdown = await readFile(resolve(root, 'docs/HR-ROLE-EXAMPLES.md'), 'utf8')
  assert.equal(checkHrRoleExamples(fixture, markdown), true)
  for (const change of [
    value => { value.cases[0].event.employeeId = 'employee-003' },
    value => { value.cases[0].statePrerequisites = ['A changed resource prerequisite.'] },
    value => { value.cases[0].expected.description = 'A changed observable outcome.' },
  ]) {
    const changed = clone(fixture); change(changed)
    assert.throws(() => checkHrRoleExamples(changed, markdown), /documentation drift/)
  }
  assert.throws(() => checkHrRoleExamples(fixture, markdown.replace('Exact refusal:', 'Expected approval:')), /documentation drift/)
  assert.ok(renderHrRoleExamples(fixture).includes('[canonical cross-portal capability matrix](PORTAL-CAPABILITIES.md)'))
})

test('malformed or permission-incomplete fixture data is refused before rendering', () => {
  for (const change of [
    value => { value.roles.pop() },
    value => { value.cases.push(clone(value.cases[0])) },
    value => { value.cases = value.cases.filter(row => row.actor.role !== 'auditor') },
    value => { value.cases[0].actor.token = 'outside-contract' },
    value => { value.cases[0].expected.value = Number.NaN },
    value => { value.review.reviewedSources[0].path = '../outside' },
    value => { value.exportBoundary.contents = 'role-filtered-state' },
  ]) {
    const invalid = clone(fixture); change(invalid)
    assert.throws(() => validateHrRoleExamples(invalid))
  }
})

test('reviewed authority and transaction sources are required within a separate finite source bound', () => {
  assert.equal(fixture.review.reviewedSources.length, 50)
  for (const source of fixture.review.reviewedSources) {
    const missing = clone(fixture)
    missing.review.reviewedSources = missing.review.reviewedSources.filter(item => item.path !== source.path)
    assert.throws(() => validateHrRoleExamples(missing), /required.*source boundary/, source.path)
  }
  const atLimit = clone(fixture)
  for (let index = atLimit.review.reviewedSources.length; index < 56; index++) atLimit.review.reviewedSources.push({ path: `src/reviewed-extra-${index}.ts`, sha256: 'a'.repeat(64) })
  assert.equal(validateHrRoleExamples(atLimit), atLimit)
  const tooMany = clone(atLimit)
  tooMany.review.reviewedSources.push({ path: 'src/reviewed-over-limit.ts', sha256: 'b'.repeat(64) })
  assert.throws(() => validateHrRoleExamples(tooMany), /Reviewed sources: use a bounded list/)
  const ordinaryList = clone(fixture)
  ordinaryList.roles[0].projection.employeeIds = Array.from({ length: 41 }, (_, index) => `employee-${index}`)
  assert.throws(() => validateHrRoleExamples(ordinaryList), /Employee projection: use a bounded list/)
})

test('source drift refuses check and render without replacing a reviewed output', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'webappx-role-review-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const sourceRoot = resolve(temporary, 'source')
  for (const source of fixture.review.reviewedSources) {
    const file = resolve(sourceRoot, source.path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, await readFile(resolve(root, source.path)))
  }
  const fixtures = resolve(temporary, 'fixtures.json')
  const output = resolve(temporary, 'role-examples.md')
  await writeFile(fixtures, JSON.stringify(fixture))
  await writeFile(output, renderHrRoleExamples(fixture).replace(/\n/g, '\r\n'))
  for (const source of fixture.review.reviewedSources) await writeFile(resolve(sourceRoot, source.path), (await readFile(resolve(root, source.path), 'utf8')).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'))
  assert.equal((await runHrRoleExamples({ fixtures, output, sourceRoot })).written, false, 'CRLF checkout text is equivalent to the reviewed LF text')
  await writeFile(output, 'Preserve the reviewed output.\n')
  await writeFile(resolve(sourceRoot, 'src/hr/model.ts'), '// A changed capability implementation\n')
  for (const write of [false, true]) await assert.rejects(runHrRoleExamples({ fixtures, output, sourceRoot, write }), /Reviewed source drift/)
  assert.equal(await readFile(output, 'utf8'), 'Preserve the reviewed output.\n')
})

test('CLI defaults to check, renders only explicitly and rejects conflicting flags', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'webappx-role-cli-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const output = resolve(temporary, 'roles.md')
  const spawn = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: temporary })
  const baseline = await readFile(resolve(root, 'docs/HR-ROLE-EXAMPLES.md'))
  const checked = spawn([])
  assert.equal(checked.status, 0, checked.stderr)
  assert.deepEqual(await readFile(resolve(root, 'docs/HR-ROLE-EXAMPLES.md')), baseline)
  const written = spawn(['--write', '--output', output])
  assert.equal(written.status, 0, written.stderr)
  assert.equal(await readFile(output, 'utf8'), renderHrRoleExamples(fixture))
  await writeFile(output, 'Edited action without fixture review.\n')
  const refused = spawn(['--check', '--output', output])
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /documentation drift/)
  assert.equal(await readFile(output, 'utf8'), 'Edited action without fixture review.\n')
  for (const args of [['--write', '--check'], ['--output'], ['--unknown'], ['--check', '--check']]) assert.equal(spawn(args).status, 1)
})

test('import has no output or filesystem changes even with misleading process arguments', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'webappx-role-import-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const output = resolve(temporary, 'sentinel.md')
  await writeFile(output, 'Keep this sentinel.\n')
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(script).href)})`, '--', '--write', '--output', output], { cwd: temporary, encoding: 'utf8' })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, '')
  assert.equal(imported.stderr, '')
  assert.equal(await readFile(output, 'utf8'), 'Keep this sentinel.\n')
})

test('reviewed source hashes match the examined UTF-8 text with portable checkout line endings', async () => {
  for (const source of fixture.review.reviewedSources) assert.equal(createHash('sha256').update((await readFile(resolve(root, source.path), 'utf8')).replace(/\r\n/g, '\n')).digest('hex'), source.sha256, source.path)
})
