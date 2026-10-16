#!/usr/bin/env node
/** Finite public-source inventory. Source modules are read as text, never imported. */
import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = fileURLToPath(new URL('../', import.meta.url))
export const fixtureInventoryLimits = Object.freeze({ descriptorBytes: 65_536, sourceBytes: 786_432, totalSourceBytes: 8_388_608, groups: 8, depth: 12 })
const binding = (path, symbols = [], anchors = []) => Object.freeze({ path, symbols, anchors })
// The finite read fence and source anchors are reviewed code, never paths or executable text supplied by a caller.
const bindings = Object.freeze({
  'hr-fixture': binding('.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'),
  'hr-state': binding('src/hr/persistence.ts', ['createHrDemoState'], ['export function createHrDemoState(', 'workflow: createMockHrState(fixture)', 'operations: createPeopleOperations(fixture)', 'serviceDesk: createHrServiceDesk(fixture)', 'recruiting: createRecruitingState(fixture)', 'performance: createPerformanceState(fixture)', 'surveys: createSurveysState(fixture)']),
  'hr-workflow': binding('src/hr/mock-workflows.ts', ['createMockHrState'], ['export function createMockHrState(']),
  'hr-operations': binding('src/hr/people-operations.ts', ['createPeopleOperations'], ['export function createPeopleOperations(']),
  'hr-service-desk': binding('src/hr/service-desk.ts', ['createHrServiceDesk'], ['export function createHrServiceDesk(']),
  'hr-recruiting': binding('src/hr/recruiting.ts', ['createRecruitingState'], ['export function createRecruitingState(']),
  'hr-performance': binding('src/hr/performance.ts', ['createPerformanceState'], ['export function createPerformanceState(']),
  'hr-surveys': binding('src/hr/surveys.ts', ['createSurveysState'], ['export function createSurveysState(']),
  'cms-model': binding('src/cms/model.ts', ['createCmsState', 'cmsCollections', 'cmsActors'], ['export function createCmsState(', 'export const cmsCollections =', 'export const cmsActors:']),
  'crm-model': binding('src/crm/model.ts', ['createCrmState', 'crmActors'], ['export function createCrmState(', 'export const crmActors:']),
  'workspace-defaults': binding('src/portals/workspaces.ts', ['createDemoWorkspaces'], ["import demoCompany from '../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'", 'export function createDemoWorkspaces(', 'hr: createHrDemoState(hrFixture), cms: createCmsState(), crm: createCrmState()']),
  'workspace-provider': binding('src/portals/PortalWorkspaceProvider.tsx', ['PortalWorkspaceProvider'], ['const createHr = () => createDemoWorkspaces().hr', 'const createCms = () => createDemoWorkspaces().cms', 'const createCrm = () => createDemoWorkspaces().crm', "replacement('hr', current, seed, 'reset', confirmation)", "replacement('cms', current, seed, 'reset', confirmation)", "replacement('crm', current, seed, 'reset', confirmation)", "previewWorkspaceReplacement(module, states, createDemoWorkspaces()[module], 'reset', settings, history)"]),
  'native-reset-controls': binding('src/portals/DemoWorkspaceReset.tsx', ['DemoWorkspaceReset'], ['export function DemoWorkspaceReset(', 'Reset ${portalById[module].label} demo', 'Reset {portalById[module].label} workspace?', 'Confirm Reset {portalById[module].label}', 'Keep {portalById[module].label} workspace', 'recovery.settings.error || recovery.settings.preferences.beforeReset']),
  'portal-labels': binding('src/portals/registry.ts', ['portalRegistry'], ["id: 'hr', label: 'HR'", "id: 'cms', label: 'CMS'", "id: 'crm', label: 'CRM'"]),
  'native-reset-state': binding('src/portals/useDemoPersistence.ts', ['useDemoPersistence'], ['const reset = useCallback(', 'const value = create()', 'replacement.reset(current.current, value, confirmation)', 'clearDemoState(module)', 'setReplacementEpoch(previous => previous + 1)']),
  'native-reset-recovery': binding('src/portals/replacement-recovery.ts', ['replaceWorkspaceWithRecovery'], ['export function replaceWorkspaceWithRecovery', "operation === 'reset'", 'clearDemoState(module, target)', 'target.removeItem(key)', 'confirmation !== reviewed.confirmation']),
  'sdk-employees': binding('integrations/gusto/sdk-employees.fixture.json'),
  'sdk-onboarding': binding('integrations/gusto/sdk-onboarding.mjs', ['createOnboardingState'], ['export function createOnboardingState(']),
  'sdk-payroll-fixture': binding('integrations/gusto/sdk-payroll.fixture.json'),
  'sdk-payroll-handler': binding('integrations/gusto/sdk-payroll.mjs', ['handlePayroll'], ['export function handlePayroll(']),
  'sdk-session': binding('integrations/gusto/mock-api.mjs', ['initialState', 'createMockSdk'], ['function initialState()', "new URL('./sdk-employees.fixture.json', import.meta.url)", "new URL('./sdk-payroll.fixture.json', import.meta.url)", '...createOnboardingState(employees, MOCK_COMPANY_ID)', "payrollPhase: 'draft'", "if (path === '/__reset')", 'session.state = initialState()', 'state: initialState(), expiresAt:']),
  'sdk-reset-ui': binding('src/hr/gusto/GustoSdkPreview.tsx', ['reset'], ['async function reset()', "fetch('/__gusto_mock__/__reset', { method: 'POST'", '>Reset SDK samples</button>']),
  'browser-seed': binding('tests/browser/fixtures/portal-smoke-v1.json'),
  'browser-seed-digest': binding('tests/browser/fixtures/portal-smoke-v1.sha256'),
  'browser-seed-contract': binding('tests/browser/seed-contract.mjs', ['loadValidatedSeed', 'validateSeedContent'], ['export async function loadValidatedSeed()', "new URL('./fixtures/portal-smoke-v1.json', import.meta.url)", "new URL('./fixtures/portal-smoke-v1.sha256', import.meta.url)", 'assert.deepEqual(seed.workspaces, createDemoWorkspaces()']),
  'browser-seed-generator': binding('tests/browser/generate-seed.mjs', [], ["process.argv[2] !== '--write'", 'await writeFile(seedFile, text)', 'await writeFile(seedDigestFile,']),
  'role-fixture': binding('tests/fixtures/hr-capability-examples.json'),
  'role-renderer': binding('scripts/hr-role-examples.mjs', ['renderHrRoleExamples'], ["'tests/fixtures/hr-capability-examples.json'", 'export function renderHrRoleExamples(']),
  'sdk-reference-list': binding('.SYSTEMX/GUSTO/mock/fixtures/synthetic-sdk-employee-list.json'),
  'sdk-reference-notes': binding('.SYSTEMX/GUSTO/mock/fixtures/synthetic-sdk-employee-list-notes.json'),
})
const nativeBindings = ['workspace-defaults', 'workspace-provider', 'native-reset-controls', 'portal-labels', 'native-reset-state', 'native-reset-recovery']
const required = Object.freeze({
  'native-hr': ['native-workspace', 'Reset HR demo', ['hr-fixture', 'hr-state', 'hr-workflow', 'hr-operations', 'hr-service-desk', 'hr-recruiting', 'hr-performance', 'hr-surveys', ...nativeBindings]],
  'native-cms': ['native-workspace', 'Reset CMS demo', ['cms-model', ...nativeBindings]],
  'native-crm': ['native-workspace', 'Reset CRM demo', ['crm-model', ...nativeBindings]],
  'sdk-onboarding': ['sdk-session', 'Reset SDK samples', ['sdk-employees', 'sdk-onboarding', 'sdk-session', 'sdk-reset-ui']],
  'sdk-payroll': ['sdk-session', 'Reset SDK samples', ['sdk-payroll-fixture', 'sdk-payroll-handler', 'sdk-session', 'sdk-reset-ui']],
  'browser-baseline': ['reviewed-fixture', 'No user Reset rewrites this file', ['browser-seed', 'browser-seed-digest', 'browser-seed-contract', 'browser-seed-generator']],
  'role-examples': ['reviewed-fixture', 'No app Reset', ['role-fixture', 'role-renderer']],
  'sdk-reference': ['retained-reference', 'No user Reset', ['sdk-reference-list', 'sdk-reference-notes']],
})
export const fixtureInventorySourcePaths = Object.freeze([...new Set(Object.values(bindings).map(value => value.path))].sort())
const fail = message => { throw new Error(message) }
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const text = (value, max = 600) => typeof value === 'string' && value.length > 0 && value.length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
const sha256 = value => createHash('sha256').update(value).digest('hex')

/** Strict JSON syntax plus duplicate member detection, without importing a parser or evaluating values. */
export function parseFixtureInventory(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > fixtureInventoryLimits.descriptorBytes) fail('Fixture descriptor exceeds its UTF-8 input bound.')
  let cursor = 0
  const space = () => { while (/\s/.test(text[cursor] ?? '') && cursor < text.length) cursor++ }
  function string() {
    const start = cursor++
    while (cursor < text.length) {
      if (text[cursor] === '\\') cursor += 2
      else if (text[cursor++] === '"') return JSON.parse(text.slice(start, cursor))
    }
    fail('Invalid fixture descriptor JSON.')
  }
  function value(depth) {
    if (depth > fixtureInventoryLimits.depth) fail('Fixture descriptor nesting exceeds its bound.')
    space()
    if (text[cursor] === '"') { string(); return }
    if (text[cursor] === '{') {
      cursor++; space(); const keys = new Set()
      if (text[cursor] !== '}') while (true) {
        if (text[cursor] !== '"') fail('Invalid fixture descriptor JSON.')
        const key = string(); if (keys.has(key)) fail('Duplicate fixture descriptor JSON member.'); keys.add(key)
        space(); if (text[cursor++] !== ':') fail('Invalid fixture descriptor JSON.')
        value(depth + 1); space()
        if (text[cursor] !== ',') break
        cursor++; space()
      }
      if (text[cursor++] !== '}') fail('Invalid fixture descriptor JSON.')
    } else if (text[cursor] === '[') {
      cursor++; space()
      if (text[cursor] !== ']') while (true) { value(depth + 1); space(); if (text[cursor] !== ',') break; cursor++ }
      if (text[cursor++] !== ']') fail('Invalid fixture descriptor JSON.')
    } else {
      const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(cursor))
      if (!token) fail('Invalid fixture descriptor JSON.')
      cursor += token[0].length
    }
  }
  try { value(0); space(); if (cursor !== text.length) fail('Invalid fixture descriptor JSON.'); return JSON.parse(text) }
  catch (error) { if (error instanceof SyntaxError) fail('Invalid fixture descriptor JSON.'); throw error }
}

function validateDescriptors(descriptors) {
  if (!exact(descriptors, ['schemaVersion', 'intent', 'groups']) || descriptors.schemaVersion !== 1 || descriptors.intent !== 'fictional-fixture-source-inventory' || !Array.isArray(descriptors.groups) || descriptors.groups.length !== fixtureInventoryLimits.groups) fail('Expected the reviewed schema-1 eight-group fixture inventory.')
  const seen = new Set()
  for (const group of descriptors.groups) {
    if (!exact(group, ['id', 'kind', 'label', 'consumerScope', 'bindings', 'reset']) || typeof group.id !== 'string' || !Object.hasOwn(required, group.id) || seen.has(group.id)) fail('Fixture inventory has a missing, duplicate or unknown group ID.')
    seen.add(group.id)
    const [kind, action, expected] = required[group.id]
    if (group.kind !== kind || !text(group.label, 100) || !text(group.consumerScope, 160) || !Array.isArray(group.bindings) || group.bindings.length !== expected.length || new Set(group.bindings).size !== expected.length || expected.some(id => !group.bindings.includes(id))) fail(`Fixture group ${group.id} has an invalid kind or missing/unknown source binding.`)
    const moduleLabel = { 'native-hr': 'HR', 'native-cms': 'CMS', 'native-crm': 'CRM' }[group.id]
    const reviewControls = moduleLabel ? [`Reset ${moduleLabel} workspace?`, `Confirm Reset ${moduleLabel}`, `Keep ${moduleLabel} workspace`] : []
    if (!exact(group.reset, ['action', 'effect', 'boundaries', 'reviewControls']) || !Array.isArray(group.reset.reviewControls) || JSON.stringify(group.reset.reviewControls) !== JSON.stringify(reviewControls) || group.reset.action !== action || !text(group.reset.effect) || !Array.isArray(group.reset.boundaries) || !group.reset.boundaries.length || group.reset.boundaries.length > 5 || group.reset.boundaries.some(value => !text(value))) fail(`Fixture group ${group.id} has an invalid reset contract.`)
  }
}

/** Pure report builder. Supplied source text is never returned or executed. */
export function buildFixtureInventory(descriptors, sourceTexts) {
  validateDescriptors(descriptors)
  if (!(sourceTexts instanceof Map) || sourceTexts.size !== fixtureInventorySourcePaths.length || fixtureInventorySourcePaths.some(path => !sourceTexts.has(path))) fail('Fixture inventory requires exactly its finite public source allowlist.')
  let total = 0
  for (const path of fixtureInventorySourcePaths) {
    const source = sourceTexts.get(path)
    if (typeof source !== 'string' || !source.length || Buffer.byteLength(source) > fixtureInventoryLimits.sourceBytes) fail(`Fixture source unavailable or oversized: ${path}`)
    total += Buffer.byteLength(source)
  }
  if (total > fixtureInventoryLimits.totalSourceBytes) fail('Fixture source total exceeds its bound.')
  for (const [id, contract] of Object.entries(bindings)) {
    if (contract.anchors.some(anchor => !sourceTexts.get(contract.path).includes(anchor))) fail(`Fixture source binding drift: ${id} (${contract.path})`)
  }
  const groups = Object.keys(required).map(id => {
    const group = descriptors.groups.find(value => value.id === id)
    return { id: group.id, kind: group.kind, label: group.label, consumerScope: group.consumerScope,
      sources: required[id][2].map(key => ({ binding: key, path: bindings[key].path, symbols: [...bindings[key].symbols] })),
      reset: { action: group.reset.action, effect: group.reset.effect, reviewControls: [...group.reset.reviewControls], boundaries: [...group.reset.boundaries] } }
  })
  return { schemaVersion: 1, intent: 'fictional-fixture-source-inventory', counts: { groups: groups.length, sourceFiles: fixtureInventorySourcePaths.length }, groups,
    sourceBindings: fixtureInventorySourcePaths.map(path => ({ path, sha256: sha256(sourceTexts.get(path)) })),
    limitations: ['Finite reviewed fixture/default/reset groups only; arbitrary inline and dynamic test cases are outside this inventory.', 'Source anchors establish the reviewed files, builder references and control labels, not runtime behavior or exhaustive semantic coverage.', 'Public sources are read as text; no model import, fixture generation, reset, child process, service, network, provider or storage action is performed.'] }
}

async function readContained(root, path, maximum) {
  let current = root
  for (const part of path.split('/')) {
    current = resolve(current, part)
    const info = await lstat(current).catch(() => null)
    if (!info || info.isSymbolicLink()) fail(`Fixture inventory requires a contained regular public file: ${path}`)
    if (current !== resolve(root, path) && !info.isDirectory()) fail(`Fixture inventory source parent is not a directory: ${path}`)
    if (current === resolve(root, path) && (!info.isFile() || info.size > maximum)) fail(`Fixture inventory source unavailable or oversized: ${path}`)
  }
  const bytes = await readFile(current)
  if (bytes.length > maximum) fail(`Fixture inventory source unavailable or oversized: ${path}`)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { fail(`Fixture inventory source is not UTF-8: ${path}`) }
}

export async function readFixtureInventory({ repositoryRoot = defaultRoot } = {}) {
  const root = await realpath(repositoryRoot)
  const descriptors = parseFixtureInventory(await readContained(root, 'scripts/fixture-inventory.json', fixtureInventoryLimits.descriptorBytes))
  validateDescriptors(descriptors)
  const sources = new Map()
  // Sequential bounded reads keep the finite byte budget predictable on supported hosts.
  let bytes = 0
  for (const path of fixtureInventorySourcePaths) {
    const source = await readContained(root, path, fixtureInventoryLimits.sourceBytes)
    bytes += Buffer.byteLength(source)
    if (bytes > fixtureInventoryLimits.totalSourceBytes) fail('Fixture source total exceeds its bound.')
    sources.set(path, source)
  }
  return buildFixtureInventory(descriptors, sources)
}

export function formatFixtureInventory(report) {
  const lines = [`Fictional fixture sources (schema ${report.schemaVersion}): ${report.counts.groups} reviewed groups / ${report.counts.sourceFiles} public files.`]
  for (const group of report.groups) {
    lines.push('', `${group.id}: ${group.label} [${group.kind}]`, `Consumer: ${group.consumerScope}`)
    for (const source of group.sources) lines.push(`  ${source.path}${source.symbols.length ? ` -> ${source.symbols.join(', ')}` : ''}`)
    lines.push(`Reset: ${group.reset.action}`, ...(group.reset.reviewControls.length ? [`Review controls (when required): ${group.reset.reviewControls.join('; ')}`] : []), `Effect: ${group.reset.effect}`, ...group.reset.boundaries.map(value => `Boundary: ${value}`))
  }
  lines.push('', ...report.limitations.map(value => `- ${value}`))
  return lines.join('\n') + '\n'
}

export function parseFixtureInventoryArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const seen = new Set()
  for (const arg of args) {
    if (!['--json', '--check'].includes(arg) || seen.has(arg)) fail('Use only --json and/or --check; no fixture write, generate or reset mode exists.')
    seen.add(arg)
  }
  return { json: seen.has('--json'), check: seen.has('--check') }
}
async function main() {
  const options = parseFixtureInventoryArguments(process.argv.slice(2))
  if (options.help) { console.log('Usage: node scripts/fixture-inventory.mjs [--json] [--check]\nRead-only finite public-source/reset inventory; no model import or fixture mutation.'); return }
  const report = await readFixtureInventory()
  console.log(options.json ? JSON.stringify(report, null, 2) : options.check ? `Fixture inventory verified: ${report.counts.groups} reviewed groups, ${report.counts.sourceFiles} public source files; no fixtures or resets executed.` : formatFixtureInventory(report).trimEnd())
}
if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`Fixture inventory refused: ${error.message}`); process.exitCode = 1 })
