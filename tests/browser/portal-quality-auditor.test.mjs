import assert from 'node:assert/strict'
import test from 'node:test'
import { auditControlRecords, auditStatusCoverage, statusFamilies, externalStatusFamilies } from './portal-quality.mjs'

const control = (name, scope = '', visible = true, role = 'button') => ({ name, scope, visible, role })
test('negative fixture detects an ambiguous visible import selector while excluding hidden mounted portals', () => {
  const result = auditControlRecords([control('Import workspace'), control('Import workspace'), control('Import workspace', 'HR backup', false)])
  assert.equal(result.hidden, 1); assert.equal(result.visible, 2)
  assert.deepEqual(result.ambiguous.map(item => [item.name, item.count]), [['Import workspace', 2]])
})
test('separate visible backup regions resolve repeated import actions and retain the global ambiguity measurement', () => {
  const result = auditControlRecords([control('Import workspace', 'CMS workspace backup'), control('Import workspace', 'CRM workspace backup'), control('Import workspace', 'HR workspace backup', false)])
  assert.equal(result.repeated.length, 1); assert.equal(result.repeated[0].resolved, true); assert.deepEqual(result.ambiguous, [])
})
test('negative repeated-record fixture fails even when every button has a nonempty accessible name', () => {
  const result = auditControlRecords([control('Advance', 'Opportunity Sample A'), control('Advance', 'Opportunity Sample A')])
  assert.equal(result.ambiguous.length, 1); assert.deepEqual(result.missingNames, [])
})
test('unique semantic record scopes disambiguate repeated actions without relying on DOM ordinal', () => {
  const result = auditControlRecords([control('Advance', 'Opportunity Sample A'), control('Advance', 'Opportunity Sample B')])
  assert.deepEqual(result.ambiguous, []); assert.equal(result.repeated[0].resolved, true)
})
test('visible unnamed controls are rejected and hidden unnamed controls are excluded', () => {
  const result = auditControlRecords([control('  ', 'Visible form'), control('', 'Hidden form', false)])
  assert.equal(result.missingNames.length, 1)
})
test('negative status fixture refuses missing terminal states and text without a retained monochrome capture', () => {
  const families = { payroll: ['prepared', 'submitted'], survey: ['draft'] }
  assert.deepEqual(auditStatusCoverage(families, [{ family: 'payroll', state: 'prepared', text: 'prepared', capture: 'prepared.png' }, { family: 'payroll', state: 'submitted', text: 'submitted', capture: '' }]).missing, [{ family: 'payroll', state: 'submitted' }, { family: 'survey', state: 'draft' }])
})
test('complete inventory cannot be accepted from a representative single status capture', () => {
  const result = auditStatusCoverage(statusFamilies, [{ family: 'time', state: 'draft', text: 'Draft', capture: 'draft.png' }])
  assert.ok(result.expected > 100); assert.equal(result.missing.length, result.expected - 1)
})
test('complete rare-status fixture preserves strict HR/CMS/CRM schema and relationship validity', async () => {
  const { readFile } = await import('node:fs/promises')
  const { statusFixture, validateFixture } = await import('./portal-quality.mjs')
  const seed = JSON.parse(await readFile(new URL('./fixtures/portal-smoke-v1.json', import.meta.url), 'utf8'))
  await validateFixture(await statusFixture(seed))
})
test('finite status inventory matches every literal model enum, rather than silently omitting a newly added state', async () => {
  const ts = (await import('typescript')).default
  const { readFile } = await import('node:fs/promises')
  const sources = new Map()
  async function literalUnion(path, alias, property) {
    if (!sources.has(path)) sources.set(path, ts.createSourceFile(path, await readFile(new URL(`../../src/${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true))
    const source = sources.get(path)
    let target
    function find(node) { if (ts.isTypeAliasDeclaration(node) && node.name.text === alias) target = node.type; else ts.forEachChild(node, find) }
    find(source)
    assert.ok(target, `${path}:${alias} must exist`)
    if (property) {
      let found
      function visit(node) { if (ts.isPropertySignature(node) && node.name.getText(source) === property) found = node.type; else ts.forEachChild(node, visit) }
      visit(target); target = found
    }
    assert.ok(target, `${alias}.${property} must exist`)
    const nodes = ts.isUnionTypeNode(target) ? target.types : [target]
    assert.ok(nodes.every(node => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)), `${alias}.${property} must remain an explicit enum or update this deliberate audit`)
    return nodes.map(node => node.literal.text.replaceAll('-', ' '))
  }
  const mappings = [
    ['hr/mock-workflows.ts', 'MockOnboarding', 'stage', 'onboarding'],
    ['hr/mock-workflows.ts', 'MockTimeEntry', 'status', 'time'],
    ['hr/mock-workflows.ts', 'MockBenefitElection', 'stage', 'benefits'],
    ['hr/mock-workflows.ts', 'MockBenefitElection', 'election', 'benefitChoices'],
    ['hr/mock-workflows.ts', 'MockPayroll', 'stage', 'payroll'],
    ['hr/people-operations.ts', 'PeoplePtoRequest', 'status', 'pto'],
    ['hr/service-desk.ts', 'HrRequestStatus', undefined, 'service'],
    ['hr/recruiting.ts', 'RecruitingJobStatus', undefined, 'jobs'],
    ['hr/recruiting.ts', 'RecruitingStage', undefined, 'candidates'],
    ['hr/performance.ts', 'PerformanceGoal', 'status', 'goals'],
    ['hr/performance.ts', 'PerformanceReview', 'stage', 'reviews'],
    ['hr/surveys.ts', 'SurveyStatus', undefined, 'surveys'],
    ['hr/surveys.ts', 'SurveyResponse', 'status', 'surveyResponse'],
    ['cms/model.ts', 'CmsEntry', 'status', 'cms'],
    ['crm/model.ts', 'CrmLead', 'status', 'crmLead'],
    ['crm/model.ts', 'CrmTask', 'status', 'crmTask'],
    ['portals/persistence.ts', 'DemoStorageStatus', 'kind', 'storage'],
    ['portals/restore-points.ts', 'RestorePoint', 'kind', 'restorePointKinds'],
    ['cms/editor-recovery.ts', 'CmsEditorComparison', 'kind', 'cmsEditorKinds'],
  ]
  const allFamilies = { ...statusFamilies, ...externalStatusFamilies }
  for (const [path, alias, property, family] of mappings) assert.deepEqual([...allFamilies[family]].sort(), (await literalUnion(path, alias, property)).sort(), `${family} must cover the exact original model enum`)
  const { crmStages } = await (await import('./model-loader.mjs')).loadMockModel(new URL('../../src/crm/model.ts', import.meta.url))
  assert.deepEqual(statusFamilies.crmOpportunity, [...crmStages])
})
test('every actual recovery-kind render fixture passes strict history validation with required truthful labels and scope', async () => {
  const { readFile } = await import('node:fs/promises')
  const { statusFixture, statusHistoryFixture } = await import('./portal-quality.mjs')
  const seed = JSON.parse(await readFile(new URL('./fixtures/portal-smoke-v1.json', import.meta.url), 'utf8'))
  const { points } = await statusHistoryFixture(await statusFixture(seed))
  assert.deepEqual(points.map(point => point.kind), ['manual', 'restore', 'undo', 'import', 'reset'])
  assert.deepEqual(points.filter(point => ['import', 'reset'].includes(point.kind)).map(point => point.modules), [['hr'], ['hr']])
  assert.ok(points.filter(point => ['manual', 'import', 'reset'].includes(point.kind)).every(point => point.label.trim().length > 0))
})
test('negative title-only status fixture cannot substitute for missing, hidden or incorrect product badges', async () => {
  const { auditStatusLabelRecords } = await import('./portal-quality.mjs')
  const records = [{ kind: 'title', visible: true, text: 'Fictional opportunity won' }, { kind: 'status-label', visible: false, text: 'won' }, { kind: 'status-label', visible: true, text: 'not won' }]
  assert.deepEqual(auditStatusLabelRecords(['won'], records).missing, ['won'])
  assert.deepEqual(auditStatusLabelRecords(['won'], [...records, { kind: 'status-label', visible: true, text: 'Won' }]).missing, [])
})
test('five repeated restore-point actions resolve by visible capture semantics, but identical captures still fail without UUID/index exemptions', () => {
  const scope = (label, kind, modules, time) => `restore-point:${label} / ${kind} / ${modules} / ${time}`
  const records = ['manual capture', 'selective restore', 'Undo', 'individual import', 'portal Reset'].map((kind, index) => control('Inspect captured records', scope('Fictional capture', kind, 'HR', `2026-10-15T12:00:0${index}.000Z`)))
  assert.equal(auditControlRecords(records).repeated[0].resolved, true)
  const collision = [control('Inspect captured records', scope('Same visible label', 'manual capture', 'HR', '2026-10-15T12:00:00.000Z')), control('Inspect captured records', scope('Same visible label', 'manual capture', 'HR', '2026-10-15T12:00:00.000Z'))]
  assert.equal(auditControlRecords(collision).ambiguous.length, 1)
})
