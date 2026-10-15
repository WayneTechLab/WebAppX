import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile, link } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import {
  ROOT, DATA_PATH, GUIDE_PATH, CAPABILITIES_PATH, INVENTORY_PATH, SDK_PATH,
  selectedSdkExports, validateGapData, runGapCheck, sourceDigest,
} from '../../scripts/check-gusto-capability-gaps.mjs'

const data = JSON.parse(await readFile(join(ROOT, DATA_PATH), 'utf8'))
// Independently handwritten specification coverage and actual mounted exports.
// These values are not derived from the generator or the gap row count.
const expectedIds = [
  'hr-overview', 'company-setup', 'company-locations', 'company-taxes', 'company-banking', 'pay-schedules',
  'employee-directory', 'employee-profile', 'employee-onboarding', 'employee-compensation',
  'contractor-directory', 'contractor-profile', 'contractor-onboarding', 'payroll', 'paystubs',
  'contractor-payments', 'documents', 'benefits', 'time-tracking', 'time-off', 'reporting', 'recruiting',
  'organization', 'tasks', 'policies', 'assets', 'access', 'training', 'performance', 'cases', 'surveys',
  'automation', 'provider-connection',
]
const selected = {
  'employee-directory': ['EmployeeManagement.EmployeeList'],
  'employee-onboarding': ['EmployeeOnboarding.OnboardingExecutionFlow'],
  payroll: ['Payroll.PayrollExecutionFlow'],
}
const clone = () => structuredClone(data)
const row = (value, id) => value.capabilities.find(item => item.id === id)
const hash = value => createHash('sha256').update(value).digest('hex')

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'webappx-capability-gaps-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const refs = new Set([DATA_PATH, GUIDE_PATH, 'package.json', 'package-lock.json', ...data.sourceBindings.map(item => item.path),
    ...data.capabilities.flatMap(item => [item.native, item.sdk, item.evidence].flatMap(section => section.refs))])
  for (const name of refs) {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await cp(join(ROOT, name), join(root, name))
  }
  return root
}

test('reviewed map covers all 33 canonical IDs once with independently expected selections', async () => {
  assert.deepEqual(data.capabilities.map(item => item.id), expectedIds)
  assert.equal(new Set(data.capabilities.map(item => item.id)).size, 33)
  for (const item of data.capabilities) {
    assert.deepEqual(item.sdk.selectedExports, selected[item.id] ?? [], item.id)
    assert.equal(item.evidence.scope, 'source-review')
    assert.ok(item.adopter.backendWork.length > 0)
  }
  assert.equal(await validateGapData(data), data)
})

test('current guide check reads without modifying canonical data or generated guide', async () => {
  const before = await Promise.all([readFile(join(ROOT, DATA_PATH)), readFile(join(ROOT, GUIDE_PATH))])
  assert.deepEqual(await runGapCheck(), { capabilities: 33, selectedSdkComponents: 3, evidenceScope: 'source-review', written: false })
  const after = await Promise.all([readFile(join(ROOT, DATA_PATH)), readFile(join(ROOT, GUIDE_PATH))])
  assert.deepEqual(after, before)
})

test('source review deliberately maps incomplete native capabilities and unselected inventory flows', () => {
  for (const id of ['company-taxes', 'company-banking']) {
    assert.equal(row(data, id).native.coverage, 'not-implemented')
    assert.equal(row(data, id).sdk.coverage, 'inventory-only')
    assert.equal(row(data, id).adopter.providerRequirement, 'required')
  }
  assert.equal(row(data, 'contractor-onboarding').native.coverage, 'partial-mock')
  assert.equal(row(data, 'contractor-payments').native.coverage, 'read-only-mock')
  assert.equal(row(data, 'automation').native.coverage, 'read-only-mock')
  assert.match(row(data, 'surveys').native.behavior, /not anonymous/)
  assert.match(row(data, 'provider-connection').native.behavior, /no provider\/payroll connection/)
})

test('benefits and general time entry have native interfaces with no dedicated pinned SDK flow', () => {
  for (const id of ['benefits', 'time-tracking']) {
    const item = row(data, id)
    assert.equal(item.native.coverage, 'interactive-mock')
    assert.equal(item.sdk.coverage, 'none')
    assert.deepEqual(item.sdk.inventoryExports, [])
    assert.match(item.sdk.detail, /No dedicated/)
  }
  // PTO exists as an unselected inventory flow; it is not general time entry.
  assert.deepEqual(row(data, 'time-off').sdk.inventoryExports, ['TimeOff.TimeOffFlow'])
  assert.equal(row(data, 'time-off').sdk.coverage, 'inventory-only')
})

test('native-only domains explicitly identify host backend work without inventing required Gusto calls', () => {
  for (const id of ['recruiting', 'organization', 'tasks', 'policies', 'assets', 'access', 'training', 'performance', 'cases', 'surveys', 'automation']) {
    const item = row(data, id)
    assert.equal(item.adopter.providerRequirement, 'not-required', id)
    assert.deepEqual(item.adopter.providerWork, [], id)
    assert.ok(item.adopter.backendWork[0].length > 40, id)
    assert.ok(item.adopter.rationale.length > 40, id)
  }
})

test('missing, duplicate, unknown and reordered capabilities refuse complete coverage', async () => {
  const missing = clone(); missing.capabilities.pop()
  await assert.rejects(validateGapData(missing), /Every documented capability/)
  const duplicate = clone(); duplicate.capabilities[1] = structuredClone(duplicate.capabilities[0])
  await assert.rejects(validateGapData(duplicate), /Duplicate capability/)
  const unknown = clone(); unknown.capabilities[0].id = 'future-unreviewed-capability'
  await assert.rejects(validateGapData(unknown), /Unknown capability/)
  const reordered = clone(); [reordered.capabilities[0], reordered.capabilities[1]] = [reordered.capabilities[1], reordered.capabilities[0]]
  await assert.rejects(validateGapData(reordered), /definition\/order drift/)
})

test('canonical title and capability metadata drift cannot be hidden by complete IDs', async () => {
  for (const change of [item => { item.title = 'A changed title' }, item => { item.capabilitySha256 = '0'.repeat(64) }]) {
    const value = clone(); change(value.capabilities[0])
    await assert.rejects(validateGapData(value), /definition\/order drift/)
  }
})

test('each capability requires independent source evidence, backend work and explicit provider decision', async () => {
  for (const mutate of [
    item => { item.evidence.scope = 'provider-verified' },
    item => { item.evidence.limitation = '' },
    item => { item.native.behavior = '' },
    item => { item.sdk.detail = '' },
    item => { item.adopter.backendWork = [] },
    item => { item.adopter.providerWork = [] },
    item => { item.adopter.providerRequirement = 'already-connected' },
  ]) {
    const value = clone(); mutate(row(value, 'company-setup'))
    await assert.rejects(validateGapData(value))
  }
  const native = clone(); row(native, 'training').adopter.providerWork = ['Invented mandatory provider operation']
  await assert.rejects(validateGapData(native), /Not-required provider work/)
})

test('catalog workflow exports never become selected SDK coverage by declaration alone', async () => {
  const falseSelected = clone()
  row(falseSelected, 'employee-profile').sdk.selectedExports = ['EmployeeManagement.DashboardFlow']
  row(falseSelected, 'employee-profile').sdk.coverage = 'selected-mock'
  await assert.rejects(validateGapData(falseSelected), /not selected mock UI coverage/)
  const unrelated = clone(); row(unrelated, 'benefits').sdk.inventoryExports = ['TimeOff.TimeOffFlow']
  await assert.rejects(validateGapData(unrelated), /Inventory candidates differ/)
  const falseClass = clone(); row(falseClass, 'contractor-directory').sdk.coverage = 'selected-mock'
  await assert.rejects(validateGapData(falseClass), /classification disagrees/)
})

test('each actually selected component requires one exact primary capability mapping', async () => {
  const missing = clone(); row(missing, 'employee-directory').sdk.selectedExports = []; row(missing, 'employee-directory').sdk.coverage = 'inventory-only'
  await assert.rejects(validateGapData(missing), /must map to one capability exactly once/)
  const duplicate = clone(); row(duplicate, 'employee-profile').sdk.selectedExports = ['EmployeeManagement.EmployeeList']; row(duplicate, 'employee-profile').sdk.coverage = 'selected-mock'
  await assert.rejects(validateGapData(duplicate), /must map to one capability exactly once/)
})

test('AST selection ignores comments and string examples and resolves import aliases', () => {
  const source = `import { Payroll as Pay, GustoProvider } from '@gusto/embedded-react-sdk';
    const example = '<EmployeeManagement.DashboardFlow />';
    // <CompanyOnboarding.OnboardingFlow />
    export const View = () => <GustoProvider><Pay.PayrollExecutionFlow /></GustoProvider>;`
  assert.deepEqual(selectedSdkExports(source), ['Payroll.PayrollExecutionFlow'])
  assert.deepEqual(selectedSdkExports(`import * as Sdk from '@gusto/embedded-react-sdk'; const X = () => <Sdk.EmployeeManagement.EmployeeList />;`), ['EmployeeManagement.EmployeeList'])
  assert.throws(() => selectedSdkExports('const = <broken'), /not valid TSX/)
})

test('required source bindings and explicit text/vendor hash modes cannot be omitted or weakened', async () => {
  const missing = clone(); missing.sourceBindings.pop()
  await assert.rejects(validateGapData(missing), /Missing bounded reviewed source/)
  const duplicate = clone(); duplicate.sourceBindings[1] = structuredClone(duplicate.sourceBindings[0])
  await assert.rejects(validateGapData(duplicate), /duplicate source binding/)
  const wrongMode = clone(); wrongMode.sourceBindings.find(item => item.path === INVENTORY_PATH).hashMode = 'utf8-lf-sha256'
  await assert.rejects(validateGapData(wrongMode), /hash mode/)
  assert.notEqual(sourceDigest(Buffer.from('line\r\n'), 'bytes-sha256'), sourceDigest(Buffer.from('line\n'), 'bytes-sha256'))
  assert.equal(sourceDigest(Buffer.from('line\r\n'), 'utf8-lf-sha256'), hash('line\n'))
  assert.notEqual(sourceDigest(Buffer.from('\ufeffline\n'), 'utf8-lf-sha256'), hash('line\n'))
  assert.throws(() => sourceDigest(Buffer.from([255]), 'utf8-lf-sha256'), /encoded data was not valid/)
})

test('all 77 reviewed source members are required at the exact finite source bound', async () => {
  assert.equal(data.sourceBindings.length, 77)
  const replacement = { path: 'src/hr/catalog.ts', hashMode: 'utf8-lf-sha256', sha256: sourceDigest(await readFile(join(ROOT, 'src/hr/catalog.ts')), 'utf8-lf-sha256') }
  assert.equal(data.sourceBindings.some(binding => binding.path === replacement.path), false)
  for (const [index, source] of data.sourceBindings.entries()) {
    const missing = clone()
    // Keep the count at its limit so membership cannot pass on a count check.
    missing.sourceBindings[index] = replacement
    await assert.rejects(validateGapData(missing), /Required behavior\/source binding is missing/, source.path)
  }
  const tooMany = clone()
  tooMany.sourceBindings.push(replacement)
  assert.equal(tooMany.sourceBindings.length, 78)
  await assert.rejects(validateGapData(tooMany), /Missing bounded reviewed source bindings/)
})

test('a relevant native source edit refuses the prior review even with all capability rows present', async t => {
  const root = await fixture(t)
  await writeFile(join(root, 'src/hr/model.ts'), (await readFile(join(root, 'src/hr/model.ts'), 'utf8')) + '\n// Changed behavior boundary requires review\n')
  await assert.rejects(validateGapData(clone(), { root }), /Reviewed source drift: src\/hr\/model.ts/)
})

test('changed canonical capability bytes or selected SDK source cannot retain the prior review', async t => {
  const root = await fixture(t)
  const catalog = JSON.parse(await readFile(join(root, CAPABILITIES_PATH), 'utf8'))
  catalog.capabilities[0].description = 'A new unreviewed capability contract'
  await writeFile(join(root, CAPABILITIES_PATH), JSON.stringify(catalog))
  await assert.rejects(validateGapData(clone(), { root }), /Reviewed source drift/)
  await cp(join(ROOT, CAPABILITIES_PATH), join(root, CAPABILITIES_PATH))
  const sdk = await readFile(join(root, SDK_PATH), 'utf8')
  await writeFile(join(root, SDK_PATH), sdk.replace('<EmployeeManagement.EmployeeList ', '<EmployeeManagement.DashboardFlow '))
  await assert.rejects(validateGapData(clone(), { root }), /three mounted mock components changed/)
})

test('reviewed text CRLF checkouts and generated guide CRLF remain portable', async t => {
  const root = await fixture(t)
  for (const binding of data.sourceBindings.filter(item => item.hashMode === 'utf8-lf-sha256')) {
    const file = join(root, binding.path)
    await writeFile(file, (await readFile(file, 'utf8')).replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'))
  }
  await writeFile(join(root, GUIDE_PATH), (await readFile(join(root, GUIDE_PATH), 'utf8')).replaceAll('\n', '\r\n'))
  assert.equal((await runGapCheck({ root })).capabilities, 33)
})

test('vendor inventory CRLF mutation violates the exact pinned bytes', async t => {
  const root = await fixture(t)
  const file = join(root, INVENTORY_PATH)
  await writeFile(file, (await readFile(file, 'utf8')).replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'))
  await assert.rejects(validateGapData(clone(), { root }), /Pinned vendor inventory bytes differ/)
})

test('app dependency and lockfile cannot drift away from the reviewed pinned SDK version', async t => {
  const root = await fixture(t)
  for (const name of ['package.json', 'package-lock.json']) {
    const file = join(root, name), original = await readFile(file)
    const value = JSON.parse(original.toString('utf8'))
    if (name === 'package.json') value.dependencies['@gusto/embedded-react-sdk'] = '99.0.0'
    else value.packages['node_modules/@gusto/embedded-react-sdk'].version = '99.0.0'
    await writeFile(file, JSON.stringify(value))
    await assert.rejects(validateGapData(clone(), { root }), /Declared or locked SDK dependency differs/)
    await writeFile(file, original)
  }
})

test('source refs reject escaped, missing, directory and secret/runtime locations', async () => {
  for (const ref of ['../outside.md', '/absolute.md', 'docs/missing-review.md', 'src/hr', 'integrations/gusto/.secrets.json', '.SYSTEMX/logs/private.json']) {
    const value = clone(); value.capabilities[0].evidence.refs = [ref]
    await assert.rejects(validateGapData(value))
  }
})

test('linked and hard-linked evidence files refuse before their payload is read', async t => {
  const root = await fixture(t)
  const outside = join(root, 'outside.md')
  await writeFile(outside, 'Private fixture payload must not appear in errors')
  const alias = join(root, 'docs/alias.md')
  try { await symlink(outside, alias) } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Account cannot create fixture symlinks'); return }
    throw error
  }
  const value = clone(); value.capabilities[0].evidence.refs = ['docs/alias.md']
  await assert.rejects(validateGapData(value, { root }), error => /Linked source/.test(error.message) && !error.message.includes('Private fixture payload'))
  await rm(alias)
  await link(outside, alias)
  await assert.rejects(validateGapData(value, { root }), /bounded regular files/)
})

test('generated guide drift refuses; explicit regeneration changes only the owned guide', async t => {
  const root = await fixture(t)
  const protectedNames = new Set([DATA_PATH, ...data.sourceBindings.map(item => item.path)])
  const before = new Map(await Promise.all([...protectedNames].map(async name => [name, await readFile(join(root, name))])))
  await writeFile(join(root, GUIDE_PATH), 'Stale or manually changed guide\n')
  await assert.rejects(runGapCheck({ root }), /Generated capability guide drift/)
  assert.equal((await runGapCheck({ root, write: true })).written, true)
  assert.equal((await runGapCheck({ root })).written, false)
  for (const [name, bytes] of before) assert.deepEqual(await readFile(join(root, name)), bytes, name)
})

test('metadata cannot claim a new browser/provider execution or a verified Git revision', async () => {
  for (const mutate of [
    value => { value.evidenceScope = 'provider-connected' },
    value => { value.reviewBase.provenance = 'verified-current-head' },
    value => { value.reviewBase.revision = ['a'.repeat(40)] },
    value => { value.reviewedOn = '2026-02-30' },
    value => { value.sdk.version = '99.0.0' },
  ]) {
    const value = clone(); mutate(value)
    await assert.rejects(validateGapData(value))
  }
})

test('CLI help is visible through an owned symlink and rejects unrecognized options', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'webappx-capability-cli-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const alias = join(root, 'check.mjs')
  try { await symlink(join(ROOT, 'scripts/check-gusto-capability-gaps.mjs'), alias) } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Account cannot create fixture symlinks'); return }
    throw error
  }
  const help = spawnSync(process.execPath, [alias, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /Usage: node scripts\/check-gusto-capability-gaps/)
  const refused = spawnSync(process.execPath, [alias, '--provider-probe'], { encoding: 'utf8' })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /Choose --check or --write/)
})
