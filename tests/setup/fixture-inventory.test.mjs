import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildFixtureInventory, fixtureInventoryLimits, fixtureInventorySourcePaths, formatFixtureInventory, parseFixtureInventory, parseFixtureInventoryArguments, readFixtureInventory } from '../../scripts/fixture-inventory.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const descriptorPath = 'scripts/fixture-inventory.json'
const descriptors = parseFixtureInventory(await readFile(join(root, descriptorPath), 'utf8'))
const sourceTexts = new Map(await Promise.all(fixtureInventorySourcePaths.map(async path => [path, await readFile(join(root, path), 'utf8')])))
const clone = () => structuredClone(descriptors)
const sourceClone = () => new Map(sourceTexts)
const literalIds = ['native-hr', 'native-cms', 'native-crm', 'sdk-onboarding', 'sdk-payroll', 'browser-baseline', 'role-examples', 'sdk-reference']
async function temporary(t) {
  const target = await mkdtemp(join(tmpdir(), 'webappx fixture 日本語 '))
  t.after(() => rm(target, { recursive: true, force: true }))
  for (const path of ['scripts/fixture-inventory.mjs', descriptorPath, ...fixtureInventorySourcePaths]) {
    await mkdir(dirname(join(target, path)), { recursive: true })
    await copyFile(join(root, path), join(target, path))
  }
  return target
}
function cli(target, args, cwd = target) {
  return spawnSync(process.execPath, [join(target, 'scripts/fixture-inventory.mjs'), ...args], { cwd, shell: false, timeout: 10_000, maxBuffer: 131_072, encoding: 'utf8' })
}

test('exact eight maintained groups separate native, SDK, reviewed fixture and reference reset contracts', () => {
  const report = buildFixtureInventory(descriptors, sourceTexts)
  assert.deepEqual(report.groups.map(group => [group.id, group.kind, group.reset.action]), [
    ['native-hr', 'native-workspace', 'Reset HR demo'], ['native-cms', 'native-workspace', 'Reset CMS demo'], ['native-crm', 'native-workspace', 'Reset CRM demo'],
    ['sdk-onboarding', 'sdk-session', 'Reset SDK samples'], ['sdk-payroll', 'sdk-session', 'Reset SDK samples'],
    ['browser-baseline', 'reviewed-fixture', 'No user Reset rewrites this file'], ['role-examples', 'reviewed-fixture', 'No app Reset'], ['sdk-reference', 'retained-reference', 'No user Reset'],
  ])
  assert.deepEqual(report.groups.slice(0, 3).map(group => group.reset.reviewControls), [
    ['Reset HR workspace?', 'Confirm Reset HR', 'Keep HR workspace'],
    ['Reset CMS workspace?', 'Confirm Reset CMS', 'Keep CMS workspace'],
    ['Reset CRM workspace?', 'Confirm Reset CRM', 'Keep CRM workspace'],
  ])
  assert.deepEqual(report.counts, { groups: 8, sourceFiles: 32 })
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.intent, 'fictional-fixture-source-inventory')
  assert.match(report.groups[0].reset.effect, /absence of optional employment\/recruiting lifecycle/)
  assert.match(report.groups[1].reset.effect, /release bundles are absent/)
  assert.match(report.groups[4].reset.boundaries.join(' '), /No native payroll, provider submission or funds movement/)
  assert.match(report.groups[7].reset.effect, /Current SDK mock reads integrations\/gusto\/sdk-employees.fixture.json instead/)
  assert.match(report.limitations.join(' '), /arbitrary inline and dynamic test cases are outside/)
})

test('complete HR composition and actual shared reset/control links are reported without executing builders', () => {
  const hr = buildFixtureInventory(descriptors, sourceTexts).groups[0]
  assert.deepEqual(hr.sources.filter(source => source.symbols.some(symbol => /^create/.test(symbol))).map(source => [source.path, source.symbols]), [
    ['src/hr/persistence.ts', ['createHrDemoState']], ['src/hr/mock-workflows.ts', ['createMockHrState']],
    ['src/hr/people-operations.ts', ['createPeopleOperations']], ['src/hr/service-desk.ts', ['createHrServiceDesk']],
    ['src/hr/recruiting.ts', ['createRecruitingState']], ['src/hr/performance.ts', ['createPerformanceState']],
    ['src/hr/surveys.ts', ['createSurveysState']], ['src/portals/workspaces.ts', ['createDemoWorkspaces']],
  ])
  assert.deepEqual(hr.sources.slice(-5).map(source => source.path), ['src/portals/PortalWorkspaceProvider.tsx', 'src/portals/DemoWorkspaceReset.tsx', 'src/portals/registry.ts', 'src/portals/useDemoPersistence.ts', 'src/portals/replacement-recovery.ts'])
  assert.match(hr.reset.boundaries.join(' '), /checkpoint.*stale confirmation.*refuse/)
  const text = formatFixtureInventory(buildFixtureInventory(descriptors, sourceTexts))
  assert.match(text, /src\/cms\/model.ts -> createCmsState, cmsCollections, cmsActors/)
  assert.match(text, /src\/crm\/model.ts -> createCrmState, crmActors/)
  assert.deepEqual(buildFixtureInventory(descriptors, sourceTexts).groups[2].sources.slice(0, 3).map(source => [source.binding, source.path, source.symbols]), [
    ['crm-model', 'src/crm/model.ts', ['createCrmState', 'crmActors']],
    ['crm-kernel', 'src/crm/kernel.ts', ['createCrmState']],
    ['crm-types', 'src/crm/types.ts', ['crmActors']],
  ])
})

test('descriptor order cannot change stable group or source ordering; pure inputs and source bodies are preserved', () => {
  const input = clone(); const sources = sourceClone()
  const before = structuredClone(input); const oldSources = [...sources]
  const expected = buildFixtureInventory(input, sources)
  input.groups.reverse(); input.groups.forEach(group => group.bindings.reverse())
  assert.deepEqual(buildFixtureInventory(input, sources), expected)
  assert.deepEqual([...sources], oldSources)
  assert.deepEqual(descriptors, before)
  expected.groups[0].sources[0].symbols.push('external mutation')
  assert.deepEqual(buildFixtureInventory(descriptors, sources).groups.map(group => group.id), literalIds)
})

test('missing, duplicate, unknown IDs/kinds/bindings and native-SDK reset crossclaims refuse', () => {
  for (const mutate of [
    value => value.groups.pop(), value => { value.groups[7] = value.groups[0] }, value => { value.groups[0].id = 'unknown-fixture' },
    value => { value.groups[0].kind = 'sdk-session' }, value => { value.groups[0].bindings.pop() },
    value => { value.groups[0].bindings[0] = '../private.env' }, value => { value.groups[0].bindings[0] = value.groups[0].bindings[1] },
    value => { value.groups[0].reset.action = 'Reset SDK samples' }, value => { value.groups[0].reset.reviewControls[1] = 'Confirm Reset CMS' }, value => { value.groups[3].reset.action = 'Reset HR demo' },
    value => { value.groups[0].extra = 'unsupported' }, value => { value.groups[0].reset.effect = 'x'.repeat(601) },
  ]) {
    const value = clone(); mutate(value)
    assert.throws(() => buildFixtureInventory(value, sourceTexts), /reviewed|group|reset/)
  }
})

test('each required builder, reset label and session/seed source link disappearance refuses instead of omitting a group', () => {
  for (const [path, before, after] of [
    ['src/hr/persistence.ts', 'surveys: createSurveysState(fixture)', 'surveys: undefined'],
    ['src/hr/mock-workflows.ts', 'export function createMockHrState(', 'export function removedBuilder('],
    ['src/crm/model.ts', "export * from './types'", "export * from './other-types'"],
    ['src/crm/model.ts', "export { createCrmState, canWriteCrm, canManageCrmOwnership } from './kernel'", "export { createCrmState } from './other-kernel'"],
    ['src/crm/kernel.ts', 'export function createCrmState(', 'export function removedCrmBuilder('],
    ['src/crm/types.ts', 'export const crmActors:', 'export const removedCrmActors:'],
    ['src/portals/useDemoPersistence.ts', 'currentReplacementEpoch.current += 1', 'currentReplacementEpoch.current += 0'],
    ['src/portals/useDemoPersistence.ts', 'setReplacementEpoch(currentReplacementEpoch.current)', 'setReplacementEpoch(0)'],
    ['src/portals/DemoWorkspaceReset.tsx', 'Confirm Reset {portalById[module].label}', 'Confirm replacement'],
    ['src/portals/registry.ts', "id: 'cms', label: 'CMS'", "id: 'cms', label: 'Other'"],
    ['src/portals/PortalWorkspaceProvider.tsx', "replacement('crm', current, seed, 'reset', confirmation)", 'undefined'],
    ['src/hr/gusto/GustoSdkPreview.tsx', '>Reset SDK samples</button>', '>Other action</button>'],
    ['integrations/gusto/mock-api.mjs', 'session.state = initialState()', 'session.state = null'],
    ['tests/browser/seed-contract.mjs', 'assert.deepEqual(seed.workspaces, createDemoWorkspaces()', 'assert.deepEqual(seed.workspaces, undefined'],
  ]) {
    const sources = sourceClone(); assert.ok(sources.get(path).includes(before)); sources.set(path, sources.get(path).replaceAll(before, after))
    assert.throws(() => buildFixtureInventory(descriptors, sources), /source binding drift/)
  }
})

test('fixture bodies and execution traps never enter reports; no complete-source snippets are returned', () => {
  const sources = sourceClone()
  const secret = 'SYNTHETIC_FIXTURE_BODY_DO_NOT_RENDER_928174'
  sources.set('.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', JSON.stringify({ samplePrivateBody: secret }))
  for (const path of ['integrations/gusto/mock-api.mjs', 'tests/browser/generate-seed.mjs']) sources.set(path, `throw new Error('${secret}');\n${sources.get(path)}`)
  const report = buildFixtureInventory(descriptors, sources)
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secret))
  assert.doesNotMatch(formatFixtureInventory(report), new RegExp(secret))
  assert.deepEqual(Object.keys(report.sourceBindings[0]), ['path', 'sha256'])
  assert.ok(report.sourceBindings.every(value => /^[a-f0-9]{64}$/.test(value.sha256)))
})

test('strict descriptor parser refuses duplicate JSON members, malformed data, nesting and byte overflow without leaking payloads', () => {
  for (const value of ['{"schemaVersion":1,"schemaVersion":1}', '{"nested":{"id":1,"id":2}}', '{"secret":"DO_NOT_ECHO",}', '[[[[[[[[[[[[[[0]]]]]]]]]]]]]]', 'x'.repeat(fixtureInventoryLimits.descriptorBytes + 1)]) {
    assert.throws(() => parseFixtureInventory(value), error => /descriptor/.test(error.message) && !error.message.includes('DO_NOT_ECHO'))
  }
  assert.deepEqual(parseFixtureInventory(JSON.stringify(descriptors)), descriptors)
})

test('source allowlist and per-file bounds refuse unavailable, extra and oversized inputs', () => {
  const missing = sourceClone(); missing.delete('src/cms/model.ts')
  assert.throws(() => buildFixtureInventory(descriptors, missing), /finite public source allowlist/)
  const extra = sourceClone(); extra.set('.env.local', 'DO_NOT_READ')
  assert.throws(() => buildFixtureInventory(descriptors, extra), /finite public source allowlist/)
  const oversized = sourceClone(); oversized.set('src/cms/model.ts', 'x'.repeat(fixtureInventoryLimits.sourceBytes + 1))
  assert.throws(() => buildFixtureInventory(descriptors, oversized), /oversized/)
})

test('real CLI is module-relative in a spaces/Unicode path, read-only in every mode and never imports fixture generators', async t => {
  const target = await temporary(t)
  const sentinel = join(target, '.env.local'); await writeFile(sentinel, 'LOCAL_SENTINEL_PRESERVED\n')
  const generator = join(target, 'tests/browser/generate-seed.mjs')
  await writeFile(generator, `throw new Error('FIXTURE_GENERATOR_WAS_EXECUTED');\n${await readFile(generator, 'utf8')}`)
  const paths = [descriptorPath, ...fixtureInventorySourcePaths, '.env.local']
  const before = await Promise.all(paths.map(path => readFile(join(target, path))))
  for (const args of [[], ['--check'], ['--json'], ['--check', '--json']]) {
    const result = cli(target, args, tmpdir()); assert.equal(result.status, 0, result.stderr)
    if (args.includes('--json')) assert.deepEqual(JSON.parse(result.stdout).groups.map(group => group.id), literalIds)
    else assert.match(result.stdout, /8 reviewed groups/)
    assert.doesNotMatch(result.stdout + result.stderr, /LOCAL_SENTINEL_PRESERVED|FIXTURE_GENERATOR_WAS_EXECUTED/)
  }
  assert.deepEqual(await Promise.all(paths.map(path => readFile(join(target, path)))), before)
})

test('loader refuses missing files, symlink files and symlink parents; no outside source is followed', async t => {
  const target = await temporary(t)
  const cms = join(target, 'src/cms/model.ts'); await rename(cms, `${cms}.saved`)
  await assert.rejects(readFixtureInventory({ repositoryRoot: target }), /contained regular public file/)
  try { await symlink(`${cms}.saved`, cms) } catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('Windows symlink privileges unavailable'); return } throw error }
  await assert.rejects(readFixtureInventory({ repositoryRoot: target }), /contained regular public file/)
  await rm(cms); await rename(`${cms}.saved`, cms)
  const hr = join(target, 'src/hr'); await rename(hr, `${hr}-saved`); await symlink(`${hr}-saved`, hr, 'dir')
  await assert.rejects(readFixtureInventory({ repositoryRoot: target }), /contained regular public file/)
})

test('malformed descriptor refusal occurs before source reads and CLI has no write/reset/generate or arbitrary path options', async t => {
  const target = await temporary(t)
  await writeFile(join(target, descriptorPath), '{"schemaVersion":1,"schemaVersion":1}')
  await rm(join(target, 'src'), { recursive: true })
  await assert.rejects(readFixtureInventory({ repositoryRoot: target }), /Duplicate fixture descriptor/)
  for (const args of [['--write'], ['--generate'], ['--reset'], ['--root', '/outside'], ['--json', '--json'], ['--help', '--json']]) {
    assert.throws(() => parseFixtureInventoryArguments(args), /Use only/)
    const result = cli(target, args); assert.equal(result.status, 1); assert.match(result.stderr, /Fixture inventory refused/)
  }
  assert.deepEqual(parseFixtureInventoryArguments(['--check', '--json']), { json: true, check: true })
  assert.deepEqual(parseFixtureInventoryArguments(['--help']), { help: true })
})
