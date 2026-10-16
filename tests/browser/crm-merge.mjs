import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { auditVisibleControls, assertRetainedControl, auditStatusCoverage } from './portal-quality.mjs'
import { createKeyboardDriver } from './keyboard-driver.mjs'
import { crmMergeStatusInventory as statuses, crmMergeStatusFamilies, crmMergeStatusSources } from './crm-merge-status-inventory.mjs'
import * as E from './crm-merge-expected.mjs'

export const coveredCrmMergeItems = Object.freeze(['WX-0369', 'WX-0370', 'WX-0371', 'WX-0372', 'WX-0373'])
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const region = (scope, name) => scope.getByRole('region', { name, exact: true })
const backup = page => region(page, 'CRM workspace backup')
const combined = page => region(page, 'Combined workspace backup')
const report = page => region(page, 'CRM duplicate candidates')
const history = page => region(page, 'Recorded CRM merge history')
const receiptRows = page => history(page).getByRole('article').filter({ has: page.getByRole('heading', { level: 3 }) })
const form = (page, kind) => page.getByRole('form', { name: `${kind === 'contact' ? 'Contact' : 'Company'} merge selection`, exact: true })
const preview = (page, kind) => region(page, `${kind === 'contact' ? 'Contact' : 'Company'} merge preview`)
const selection = (page, kind, side) => form(page, kind).getByRole('combobox', { name: `${side === 'source' ? 'Source' : 'Retained'} ${kind}`, exact: true })
const dialog = page => page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
const upload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
const envelope = data => ({ format: 'webappx-mock-workspace', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', module: 'crm', data })
const combinedEnvelope = workspaces => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces })
const historyKey = 'webappx.demo.restore-points'
const records = new WeakMap()
const recordFor = page => { if (!records.has(page)) records.set(page, { statuses: [], controls: [], keyboard: [], snapshots: [] }); return records.get(page) }
async function noDialog(page) { await expect(dialog(page), 'Completed native actions must not introduce unexpected dirty work').not.toBeVisible() }
async function slots(page) {
  const value = await page.context().storageState(), origin = new URL(page.url()).origin
  assert.deepEqual(value.cookies, []); assert.ok(value.origins.every(item => item.origin === origin))
  return Object.fromEntries((value.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}
async function decide(page, expected, choice) {
  await expect(dialog(page)).toBeVisible(); await expect(dialog(page).getByRole('listitem')).toHaveText(expected)
  const before = await slots(page); await button(dialog(page), choice).click(); await noDialog(page)
  assert.deepEqual(await slots(page), before, 'A temporary dirty-work decision cannot write CRM, other portals, history or preferences')
}
async function tab(page, name, discard) {
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name, exact: true }).click()
  if (discard) await decide(page, discard, 'Discard and leave')
  else await noDialog(page)
}
async function open(page, name, discard) {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name, exact: true }).click()
  if (discard) await decide(page, discard, 'Discard and leave')
  else await noDialog(page)
}
async function identity(page, id, discard) {
  await page.getByRole('combobox', { name: 'CRM preview identity', exact: true }).selectOption(id)
  if (discard) await decide(page, discard, 'Discard and leave')
  else await noDialog(page)
  await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue(id)
}
async function extraLarge(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await button(page, 'Open accessibility controls').click()
  await button(page.getByRole('group', { name: 'Text size', exact: true }), 'Extra large').click()
  await button(region(page, 'Accessibility and page controls'), 'Close accessibility controls').click()
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px')
}
export function assertCrmWitnessBounds(bounds, width) { assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'The complete status witness must fit the viewport; interior points cannot prove full text visibility') }
async function observe(page, dir, family, state, locator) {
  const literal = statuses[family]?.[state]; assert.ok(literal)
  await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); await expect(locator).toContainText(literal)
  assert.deepEqual(page.viewportSize(), { width: 390, height: 844 }); await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const text = await locator.innerText(), bounds = await locator.boundingBox()
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0 && bounds.height <= 800, 'A complete bounded readable text witness is required')
  const samples = await locator.evaluate(element => {
    const box = element.getBoundingClientRect()
    return [0.2, 0.5, 0.8].map(fraction => { const x = box.left + box.width * fraction, y = box.top + box.height / 2, hit = document.elementFromPoint(x, y); return { x, y, uncovered: Boolean(hit && (hit === element || element.contains(hit))), hit: hit?.outerHTML.slice(0, 350) } })
  })
  const filename = `status-${family}-${state}`
  await writeFile(join(dir, `${filename}-measurement.json`), JSON.stringify({ bounds, samples, text }, null, 2) + '\n')
  const style = await page.addStyleTag({ content: 'html,dialog:modal,dialog::backdrop{filter:grayscale(1)!important}' })
  try { await locator.screenshot({ path: join(dir, `${filename}-monochrome.png`) }) } finally { await style.evaluate(element => element.remove()) }
  assertCrmWitnessBounds(bounds, 390); assert.ok(samples.every(sample => sample.uncovered), `${family}/${state}: every text witness must be uncovered`)
  assert.equal(await locator.innerText(), text)
  recordFor(page).statuses.push({ family, state, literal, text, bounds, samples, source: crmMergeStatusSources[family], capture: `${filename}-monochrome.png`, mode: 'actual native browser action; style-only monochrome capture' })
}
async function quality(page, dir, name, scope) {
  const controls = await auditVisibleControls(page, name, dir), measurements = []
  for (const control of await scope.locator('input:not([type="file"]):not([type="hidden"]),select,textarea,button').all()) if (await control.isVisible()) measurements.push(await assertRetainedControl(page, control))
  recordFor(page).controls.push({ name, ...controls, measurements })
}
const lastDownload = new WeakMap()
async function download(page, control, dir, label) {
  const wait = 160 - (Date.now() - (lastDownload.get(page) ?? 0)); if (wait > 0) await delay(wait)
  lastDownload.set(page, Date.now())
  const [result] = await Promise.all([page.waitForEvent('download'), control.click()])
  const path = join(dir, `${label}.json`); await result.saveAs(path); assert.equal(await result.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
}
async function memory(page, dir, label, expected) {
  const actual = await download(page, button(backup(page), 'Export workspace'), dir, label)
  assert.deepEqual(Object.keys(actual).sort(), ['data', 'exportedAt', 'format', 'module', 'schemaVersion'])
  assert.equal(actual.format, 'webappx-mock-workspace'); assert.equal(actual.schemaVersion, 1); assert.equal(actual.module, 'crm'); assert.equal(new Date(actual.exportedAt).toISOString(), actual.exportedAt)
  assert.deepEqual(actual.data, expected.crm, `${label}: every CRM active record, legacy boundary, journal command and complete receipt equals independently authored expected records`)
  recordFor(page).snapshots.push({ label, file: `${label}.json`, sequence: expected.crm.sequence, journalSteps: expected.crm.mergeHistory?.steps.length ?? 0 })
  return actual
}
async function exact(page, dir, label, expected, baseline, { memoryOnly = false, historyMayChange = false } = {}) {
  await memory(page, dir, label, expected)
  const saved = await slots(page)
  if (!memoryOnly) assert.deepEqual(JSON.parse(saved['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm }, `${label}: complete native CRM save envelope`)
  for (const [key, value] of Object.entries(baseline)) if (key !== 'webappx.demo.crm' && !(historyMayChange && key === historyKey)) assert.equal(saved[key], value, `${label}: unrelated raw slot ${key} remains byte-exact`)
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(baseline).sort(), 'The browser must not acquire unexpected storage slots')
  return saved
}
async function unchanged(page, dir, label, expected, action) { const before = await slots(page); await action(); assert.deepEqual(await slots(page), before, `${label}: no saved record, receipt, history or preference changed`); await memory(page, dir, label, expected) }
async function seedBrowser({ page, origin, artifactDir, seed }) {
  await page.goto(`${origin}/portals`); await extraLarge(page)
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('canonical-native-seed.json', combinedEnvelope(seed.workspaces)))
  const target = region(page, 'Selective restore preview')
  for (const module of ['HR', 'CMS', 'CRM']) await target.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) }).check()
  await button(target, 'Restore selected workspaces').click(); await noDialog(page)
  await open(page, 'Customer relationships')
  const saved = await slots(page)
  for (const module of ['hr', 'cms', 'crm']) assert.deepEqual(JSON.parse(saved[`webappx.demo.${module}`]), { schemaVersion: 1, module, data: seed.workspaces[module] })
  await memory(page, artifactDir, '00-complete-named-seed', seed.workspaces)
  return saved
}
async function importCrm(page, expected, label, discard) {
  await backup(page).getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(upload(`${label}.json`, envelope(expected.crm)))
  await expect(backup(page).getByRole('heading', { name: 'Ready to replace CRM workspace', exact: true })).toBeVisible()
  await button(backup(page), 'Replace CRM workspace').click()
  if (discard) await decide(page, discard, 'Discard and leave')
  else await noDialog(page)
  await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-owner')
}
async function choose(page, chosen, { keyboard = false } = {}) {
  await selection(page, chosen.kind, 'source').selectOption(chosen.sourceId)
  await selection(page, chosen.kind, 'retained').selectOption(chosen.retainedId)
  const opener = button(form(page, chosen.kind), `Preview ${chosen.kind} merge`)
  if (keyboard) { const driver = createKeyboardDriver(page, recordFor(page).keyboard); await driver.focus(opener, 'Merge Preview reachable by actual Tab'); await page.keyboard.press('Enter') }
  else await opener.click()
  return preview(page, chosen.kind)
}
async function fields(scope, title, expected) {
  const container = scope.getByRole('heading', { name: title, exact: true }).locator('..')
  const values = await container.locator('dl').evaluate(element => ({ keys: [...element.querySelectorAll('dt')].map(item => item.textContent), values: [...element.querySelectorAll('dd')].map(item => item.textContent) }))
  assert.deepEqual(Object.fromEntries(values.keys.map((key, index) => [key, values.values[index]])), Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])), `${title}: every full field/value is rendered from the authorized capture`)
}
async function assertCapture(scope, capture, expectedCounts) {
  await fields(scope, `Retire source ${capture.sourceId}`, capture.source)
  await fields(scope, `Keep retained ${capture.retainedId} exactly`, capture.retained)
  for (const kind of ['contacts', 'leads', 'opportunities']) for (const pair of capture.changes[kind]) for (const side of ['before', 'after']) await fields(scope, `${kind} ${pair.before.id} ${side}`, pair[side])
  for (const kind of ['companies', 'contacts', 'leads', 'opportunities', 'tasks']) for (const row of capture.context[kind]) await fields(scope, `${kind} ${row.id}`, row)
  const expectedFields = 2 + Object.values(capture.changes).reduce((n, values) => n + 2 * values.length, 0) + Object.values(capture.context).reduce((n, values) => n + values.length, 0)
  assert.equal(await region(scope, 'Retired and retained records').locator('dl').count() + await region(scope, 'Changed linked records').locator('dl').count() + await region(scope, 'Unchanged linked context').locator('dl').count(), expectedFields, 'No unreviewed or duplicate captured record may be rendered')
  if (expectedCounts) {
    await expect(scope).toContainText(`${expectedCounts.reviewRecords} of maximum 200`)
    await expect(scope).toContainText(`${expectedCounts.changed.contacts} contacts · ${expectedCounts.changed.leads} leads · ${expectedCounts.changed.opportunities} opportunities`)
    await expect(scope).toContainText(['companies', 'contacts', 'leads', 'opportunities', 'tasks'].map(key => `${expectedCounts.context[key]} ${key}`).join(' · '))
  }
}
async function apply(page, kind, { keyboard = false } = {}) {
  const control = button(preview(page, kind), `Apply ${kind} merge`)
  if (keyboard) { const driver = createKeyboardDriver(page, recordFor(page).keyboard); await driver.focus(control, 'Separate merge Apply reachable by actual Tab'); await page.keyboard.press('Enter') }
  else await control.click()
  await expect(preview(page, kind)).toHaveCount(0); await noDialog(page)
}
function panelFor(page, kind) { return form(page, kind).locator('..') }
export function assertCrmHistoryAppend(beforeRaw, afterRaw, { kind, crm, sourcePointId }) {
  const before = JSON.parse(beforeRaw), after = JSON.parse(afterRaw)
  assert.deepEqual(Object.keys(after).sort(), ['points', 'schemaVersion']); assert.equal(after.schemaVersion, 1)
  assert.deepEqual(after.points.slice(1), before.points, 'All prior full history records must remain unchanged')
  const point = after.points[0]
  assert.deepEqual(Object.keys(point).sort(), (kind === 'undo' ? ['createdAt', 'id', 'kind', 'modules', 'sourcePointId', 'states'] : ['createdAt', 'id', 'kind', 'modules', 'states']).sort())
  assert.equal(point.kind, kind); assert.deepEqual(point.modules, ['crm']); assert.deepEqual(point.states, { crm }, 'New checkpoint captures the complete independently expected CRM pre-state')
  assert.equal(new Date(point.createdAt).toISOString(), point.createdAt); assert.match(point.id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  if (kind === 'undo') assert.equal(point.sourcePointId, sourcePointId)
  return point
}

async function reportJourney(args) {
  const { page, artifactDir: dir, seed, origin, checks } = args
  await page.goto(`${origin}/crm/demo`); await extraLarge(page); await tab(page, 'Duplicates & merges')
  await observe(page, dir, 'report', 'empty', report(page).getByRole('status'))
  await observe(page, dir, 'history', 'empty', history(page).getByText(statuses.history.empty, { exact: true }))
  const initial = await slots(page); assert.equal(Object.keys(initial).some(key => key.startsWith('webappx.demo.')), false)
  await memory(page, dir, '01-fresh-seed-read', seed.workspaces); assert.deepEqual(await slots(page), initial)
  checks.push('WX-0369: fresh report/history reads and real export preserve the full named legacy seed and create no CRM save or history arm')
  await open(page, 'Portal directory')
  const baseline = await seedBrowser(args), expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A'); await tab(page, 'Duplicates & merges')
  const companyGroup = report(page).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Normalized company name: fictional harbor studio', exact: true }) })
  await observe(page, dir, 'report', 'crossOwner', companyGroup.getByText(statuses.report.crossOwner, { exact: true }))
  await expect(companyGroup.getByRole('listitem')).toHaveText([
    'Fictional  Harbor Studiocompany · company-0001 · owner sales-riley',
    'Fictional Harbor  Studiocompany · company-0002 · owner sales-riley',
    'Fictional Harbor Studiocompany · company-harbor · owner sales-riley',
    'Fictional   Harbor Studiocompany · company-orbit · owner sales-sam',
  ])
  const conversion = report(page).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Normalized email: source@harbor.invalid', exact: true }) })
  await observe(page, dir, 'report', 'conversion', conversion.getByText(statuses.report.conversion, { exact: true }))
  await expect(conversion.getByRole('listitem')).toHaveCount(2)
  const before = await slots(page)
  for (const actorId of ['crm-manager', 'sales-riley', 'sales-sam', 'crm-auditor']) {
    await identity(page, actorId)
    if (actorId === 'sales-riley') { await expect(companyGroup.getByRole('listitem')).toHaveCount(3); await observe(page, dir, 'report', 'candidate', companyGroup.getByText(statuses.report.candidate, { exact: true })); await expect(report(page)).not.toContainText('company-orbit') }
    else if (actorId === 'sales-sam') { await expect(companyGroup).toHaveCount(0); await expect(report(page).getByRole('article')).toHaveCount(0) }
    else await expect(companyGroup.getByRole('listitem')).toHaveCount(4)
    assert.deepEqual(await slots(page), before)
  }
  await observe(page, dir, 'history', 'readOnly', region(page, 'CRM duplicates and merges').getByText(statuses.history.readOnly, { exact: true }))
  await expect(form(page, 'contact')).toHaveCount(0); await expect(form(page, 'company')).toHaveCount(0)
  await identity(page, 'crm-owner'); await exact(page, dir, '02-five-actor-scopes-no-writes', expected, baseline)
  checks.push('WX-0369: owner, manager, both representatives and read-only auditor report only their accessible normalized company/email groups; hidden owners/counts stay absent and every save byte remains unchanged')
  const paged = E.pagingFixture(seed.workspaces)
  await importCrm(page, paged, 'literal-21-groups'); await tab(page, 'Duplicates & merges')
  await expect(report(page).getByRole('article')).toHaveCount(20)
  await button(report(page), 'Next candidate groups page').click(); await expect(report(page).getByRole('article')).toHaveCount(1)
  await observe(page, dir, 'report', 'secondPage', report(page).getByRole('navigation', { name: 'candidate groups pagination', exact: true }).getByText(statuses.report.secondPage, { exact: true }))
  await identity(page, 'sales-riley'); await expect(report(page).getByRole('article')).toHaveCount(20)
  await expect(report(page).getByRole('navigation', { name: 'candidate groups pagination', exact: true })).toContainText('Page 1 · 20 shown · 21 accessible')
  const members = E.pagingFixture(seed.workspaces, { members: true })
  await importCrm(page, members, 'literal-51-members'); await tab(page, 'Duplicates & merges')
  const memberGroup = report(page).getByRole('article'); await expect(memberGroup).toHaveCount(1); await expect(memberGroup.getByRole('listitem')).toHaveCount(20)
  await button(memberGroup, 'Next members for company-name member fixture page').click(); await expect(memberGroup.getByRole('listitem')).toHaveCount(20)
  await button(memberGroup, 'Next members for company-name member fixture page').click(); await expect(memberGroup.getByRole('listitem')).toHaveCount(11)
  await observe(page, dir, 'report', 'memberPage', memberGroup.getByRole('navigation').getByText(statuses.report.memberPage, { exact: true }))
  await exact(page, dir, '03-bounded-report-paging', members, baseline)
  checks.push('WX-0369: actual 21-group pages show 20/1 accessible groups; a separate 51-member group shows 20/20/11, role change resets paging and full imported data remains unchanged')
  await importCrm(page, expected, 'literal-A-own-representative-preview'); await tab(page, 'Duplicates & merges'); await identity(page, 'sales-riley')
  await unchanged(page, dir, '03b-own-Riley-preview', expected, async () => { await choose(page, E.selections.contact); await assertCapture(preview(page, 'contact'), E.contactA(expected, 'sales-riley').crm.activity[0].mergeChange, E.counts.contact); await button(preview(page, 'contact'), 'Cancel contact merge preview').click() })
  await identity(page, 'crm-owner', ['Contact merge selection'])
  const atLimit = E.closureFixture(seed.workspaces, 200)
  await importCrm(page, atLimit, 'literal-exactly-200-review-records'); await tab(page, 'Duplicates & merges')
  await unchanged(page, dir, '03c-exactly-200-preview-complete', atLimit, async () => {
    await choose(page, E.selections.contact); await expect(preview(page, 'contact')).toContainText('200 of maximum 200')
    await expect(region(preview(page, 'contact'), 'Unchanged linked context').getByRole('heading', { name: /^tasks task-/ })).toHaveCount(193)
    await button(preview(page, 'contact'), 'Cancel contact merge preview').click()
  })
  await selection(page, 'contact', 'source').selectOption(''); await selection(page, 'contact', 'retained').selectOption('')
  const overLimit = E.closureFixture(seed.workspaces, 201)
  await importCrm(page, overLimit, 'literal-201-review-records'); await tab(page, 'Duplicates & merges')
  await unchanged(page, dir, '03d-201-refused-whole-preview', overLimit, async () => {
    await choose(page, E.selections.contact); await expect(preview(page, 'contact')).toHaveCount(0)
    await observe(page, dir, 'preview', 'limit', panelFor(page, 'contact').getByRole('alert'))
  })
  await selection(page, 'contact', 'source').selectOption(''); await selection(page, 'contact', 'retained').selectOption('')
  const collision = E.fixtureA(seed.workspaces, { collision: true })
  await importCrm(page, collision, 'literal-hidden-collision'); await tab(page, 'Duplicates & merges'); await identity(page, 'sales-riley')
  await expect(report(page)).not.toContainText('lead-robin')
  await unchanged(page, dir, '04-hidden-email-collision-refused', collision, async () => { await choose(page, E.selections.contact); await expect(preview(page, 'contact')).toHaveCount(0); await expect(panelFor(page, 'contact').getByRole('alert')).toHaveText(statuses.preview.refused) })
  await observe(page, dir, 'preview', 'refused', panelFor(page, 'contact').getByRole('alert'))
  await identity(page, 'crm-owner', ['Contact merge selection'])
  await selection(page, 'contact', 'source').selectOption('contact-avery'); await selection(page, 'contact', 'retained').selectOption('contact-jordan')
  await unchanged(page, dir, '05-cross-owner-refused', collision, async () => { await button(form(page, 'contact'), 'Preview contact merge').click(); await expect(preview(page, 'contact')).toHaveCount(0); await expect(panelFor(page, 'contact').getByRole('alert')).toHaveText(statuses.preview.refused) })
  checks.push('WX-0370: converted source email collision with hidden Sam lead and incompatible cross-owner selection each refuse wholly before confirmation, with generic text and no partial captures or saved mutation')
}

async function contactRecoveryJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A-contact'); await tab(page, 'Duplicates & merges')
  await button(form(page, 'contact'), 'Preview contact merge').click()
  await observe(page, dir, 'preview', 'invalid', page.getByRole('alert', { name: 'Contact merge field errors', exact: true }))
  await expect(selection(page, 'contact', 'source')).toBeFocused()
  const next = E.contactA(expected), before = await slots(page)
  await choose(page, E.selections.contact, { keyboard: true }); await assertCapture(preview(page, 'contact'), next.crm.activity[0].mergeChange, E.counts.contact)
  await observe(page, dir, 'preview', 'ready', preview(page, 'contact').getByRole('status'))
  assert.deepEqual(await slots(page), before)
  const keyboard = createKeyboardDriver(page, recordFor(page).keyboard)
  await keyboard.focus(button(preview(page, 'contact'), 'Cancel contact merge preview'), 'Cancel contact preview reachable by Tab'); await page.keyboard.press('Enter')
  await keyboard.assertFocus(button(form(page, 'contact'), 'Preview contact merge'), 'Cancel returns exact Preview opener')
  await observe(page, dir, 'preview', 'canceled', panelFor(page, 'contact').getByRole('status'))
  await expect(selection(page, 'contact', 'source')).toHaveValue('contact-avery'); await expect(selection(page, 'contact', 'retained')).toHaveValue('contact-0002')
  await exact(page, dir, '06-cancel-full-preview-no-mutation', expected, baseline)
  await choose(page, E.selections.contact); await quality(page, dir, 'crm-contact-preview-controls', preview(page, 'contact'))
  await apply(page, 'contact', { keyboard: true }); expected = next
  await observe(page, dir, 'preview', 'accepted', panelFor(page, 'contact').getByRole('status'))
  await observe(page, dir, 'preview', 'unavailable', form(page, 'contact').getByText(statuses.preview.unavailable, { exact: true }))
  await expect(selection(page, 'contact', 'source')).toHaveValue('contact-avery'); await expect(selection(page, 'contact', 'source').locator('option:checked')).toHaveText('Unavailable selected contact · contact-avery')
  const accepted = await exact(page, dir, '07-contact-applied-once', expected, baseline)
  await page.keyboard.press('Enter'); assert.deepEqual(await slots(page), accepted, 'Additional native Enter cannot recreate the retired source or receipt')
  await observe(page, dir, 'history', 'full', history(page).getByText(statuses.history.full, { exact: true }))
  await assertCapture(receiptRows(page).first(), expected.crm.activity[0].mergeChange)
  await page.reload(); await tab(page, 'Duplicates & merges'); await exact(page, dir, '08-contact-reloaded-complete-history', expected, baseline)
  checks.push('WX-0370/WX-0371: keyboard Preview/Cancel restores exact focus and selections without writes; separate Apply retires Avery, preserves target/all statuses and both done tasks, redirects converted lead/opportunity exactly once, and reload retains complete baseline, receipt and command')
  const chain = E.companyAfterContact(expected)
  await choose(page, E.selections.company); await assertCapture(preview(page, 'company'), chain.crm.activity[0].mergeChange, E.counts.companyAfterContact)
  await apply(page, 'company'); expected = chain
  await exact(page, dir, '09-contact-then-company-chain', expected, baseline)
  const mergedBefore = await slots(page)
  await open(page, 'Portal directory')
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('selective-CRM-to-legacy.json', combinedEnvelope(E.fixtureA(seed.workspaces))))
  const restore = region(page, 'Selective restore preview')
  await restore.getByRole('checkbox', { name: /^Restore CRM/ }).check()
  await observe(page, dir, 'recovery', 'selected', button(restore, 'Restore selected workspaces'))
  const differences = region(restore, 'Selected restore differences')
  for (const [key, count] of [['activity.mergeChange', 2], ['activity.mergeChange.captures', 4], ['activity.mergeChange.changes', 3], ['activity.mergeChange.context', 12], ['mergeHistory.presence', 1], ['mergeHistory.baseline', 1], ['mergeHistory.steps', 2]]) {
    await expect(differences.locator(`output[aria-label="CRM ${key} beforeCount"]`)).toHaveText(String(count))
    await expect(differences.locator(`output[aria-label="CRM ${key} afterCount"]`)).toHaveText('0')
  }
  for (const [kind, count] of [['added', 2], ['removed', 2], ['changed', 3], ['unchanged', 13]]) await expect(differences.locator(`output[aria-label="CRM ${kind} primary records"]`)).toHaveText(String(count))
  for (const privateText of ['source@harbor.invalid', 'retained@harbor.invalid', 'Original converted text stays exact', 'Closed won source evidence']) await expect(differences).not.toContainText(privateText)
  const emptyLabels = await differences.locator('dl[aria-label$=" metadata"] dt').evaluateAll(elements => elements.filter(element => !element.textContent.trim()).length)
  assert.equal(emptyLabels, 0, 'Every displayed structured metadata value needs a readable field label')
  await expect(restore.getByRole('checkbox', { name: /^Restore HR/ })).not.toBeChecked(); await expect(restore.getByRole('checkbox', { name: /^Restore CMS/ })).not.toBeChecked()
  await button(restore, 'Restore selected workspaces').click()
  const restored = await slots(page), point = assertCrmHistoryAppend(mergedBefore[historyKey], restored[historyKey], { kind: 'restore', crm: expected.crm })
  for (const [key, value] of Object.entries(mergedBefore)) if (!['webappx.demo.crm', historyKey].includes(key)) assert.equal(restored[key], value)
  await open(page, 'Customer relationships'); await exact(page, dir, '10-selected-restore-removes-history-arm', E.fixtureA(seed.workspaces), restored)
  await open(page, 'Portal directory')
  const historyRegion = region(page, 'Restore points'), undoOpener = historyRegion.getByRole('button', { name: `Undo restore point ${point.createdAt} CRM`, exact: true })
  await undoOpener.click(); const undo = region(historyRegion, 'Undo preview')
  await observe(page, dir, 'recovery', 'undo', button(undo, 'Confirm undo'))
  const undoDifferences = region(undo, 'Undo workspace differences')
  await expect(undoDifferences.locator('output[aria-label="CRM activity.mergeChange.captures beforeCount"]')).toHaveText('0')
  await expect(undoDifferences.locator('output[aria-label="CRM activity.mergeChange.captures afterCount"]')).toHaveText('4')
  await expect(undoDifferences.locator('output[aria-label="CRM mergeHistory.presence afterCount"]')).toHaveText('1')
  for (const privateText of ['source@harbor.invalid', 'retained@harbor.invalid', 'Original converted text stays exact', 'Closed won source evidence']) await expect(undoDifferences).not.toContainText(privateText)
  await button(undo, 'Confirm undo').click()
  const undone = await slots(page); assertCrmHistoryAppend(restored[historyKey], undone[historyKey], { kind: 'undo', crm: E.fixtureA(seed.workspaces).crm, sourcePointId: point.id })
  for (const [key, value] of Object.entries(restored)) if (!['webappx.demo.crm', historyKey].includes(key)) assert.equal(undone[key], value)
  await open(page, 'Customer relationships'); await exact(page, dir, '11-Undo-restores-complete-merge-chain', expected, undone)
  checks.push('WX-0373: contact→company chronology has exact second-step membership; real selected CRM restore removes history to the legacy branch with one complete pre-state checkpoint, and Undo restores the entire chain while preserving HR/CMS/preferences and every prior recovery point')
  for (const [label, data] of E.malformedImports(seed.workspaces)) {
    const beforeImport = await slots(page)
    await backup(page).getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(upload(`refused-${label}.json`, envelope(data)))
    const refusal = backup(page).getByRole('alert'); await expect(refusal).toContainText('Current workspace unchanged.')
    assert.deepEqual(await slots(page), beforeImport, `${label}: malformed real import cannot change any origin slot`)
    if (label === 'omitted-context') await observe(page, dir, 'recovery', 'refused', refusal)
  }
  await memory(page, dir, '12-after-sixteen-refused-real-imports', expected)
  checks.push('WX-0371/WX-0373: sixteen independent malformed real JSON imports refuse altered baseline, receipt, closure, actor, command, future ID, resurrection or final output without touching full accepted memory or saved bytes')
}

async function companyChronologyJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A-company'); await tab(page, 'Duplicates & merges')
  const next = E.companyA(expected), before = await slots(page)
  await choose(page, E.selections.company); await assertCapture(preview(page, 'company'), next.crm.activity[0].mergeChange, E.counts.company)
  const warnings = region(preview(page, 'company'), 'Duplicate-name warnings')
  assert.deepEqual((await warnings.getByRole('listitem').allTextContents()).sort(), [...E.companyWarnings].sort(), 'Every warning string, classification and exact member ID must match; warning row ordering is not an acceptance criterion')
  await observe(page, dir, 'preview', 'mixed', warnings.getByRole('listitem').filter({ hasText: /^contact-name/ }))
  await observe(page, dir, 'preview', 'companyMatch', warnings.getByRole('listitem').filter({ hasText: /^selected-name-match/ }))
  assert.deepEqual(await slots(page), before)
  await button(preview(page, 'company'), 'Cancel company merge preview').click(); await expect(button(form(page, 'company'), 'Preview company merge')).toBeFocused()
  assert.deepEqual(await slots(page), before)
  await choose(page, E.selections.company); await quality(page, dir, 'crm-company-preview-controls', preview(page, 'company')); await apply(page, 'company'); expected = next
  await exact(page, dir, '13-company-applied-full-graph', expected, baseline)
  const contactNext = E.contactA(expected)
  await choose(page, E.selections.contact); await assertCapture(preview(page, 'contact'), contactNext.crm.activity[0].mergeChange, E.counts.contactAfterCompany)
  await apply(page, 'contact'); expected = contactNext
  await exact(page, dir, '14-company-then-contact-complete-chain', expected, baseline)
  assert.deepEqual(expected.crm.contacts, E.companyAfterContact(E.contactA(E.fixtureA(seed.workspaces))).crm.contacts)
  await importCrm(page, expected, 'valid-export-equivalent-two-merges'); await exact(page, dir, '15-chain-real-reimport', expected, baseline)
  checks.push('WX-0372/WX-0373: exact 11-row company preview shows all three warning classes before writes; one Apply moves source contacts/converted lead/opportunity and preserves completed tasks/unconverted text, then contact merge uses the current deduplicated 8-row closure and coherent full history survives import')
  expected = E.fixtureA(seed.workspaces); await importCrm(page, expected, 'literal-A-retirement-chain'); await tab(page, 'Duplicates & merges')
  await choose(page, E.selections.contact); await apply(page, 'contact'); expected = E.contactA(expected)
  await choose(page, E.selections.laterContact); await apply(page, 'contact'); expected = E.laterContact(expected)
  await exact(page, dir, '16-later-retirement-of-earlier-retained', expected, baseline)
  await button(form(page, 'contact'), 'Preview contact merge').click(); await expect(page.getByRole('alert', { name: 'Contact merge field errors', exact: true })).toBeVisible()
  await expect(selection(page, 'contact', 'source')).toHaveValue('contact-0002'); await expect(selection(page, 'contact', 'source').locator('option:checked')).toHaveText('Unavailable selected contact · contact-0002')
  checks.push('WX-0371: a later merge retires the earlier retained contact using its then-current complete graph and ordered receipt; both retired IDs stay historical, existing reciprocal links remain coherent, and unavailable retired selection refuses without alias fallback')
}

async function ordinaryJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces, { open: true })
  await importCrm(page, expected, 'literal-A-open'); await tab(page, 'Duplicates & merges'); await choose(page, E.selections.contact); await apply(page, 'contact'); expected = E.contactA(expected)
  await tab(page, 'Pipeline')
  const source = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Closed won source evidence', exact: true }) })
  await button(source, 'Move to proposal').click(); expected = E.ordinaryAfterContact(expected, 'advance')
  await tab(page, 'Follow-up tasks')
  await button(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Completed source follow-up', exact: true }) }), 'Complete sample follow-up').click(); expected = E.ordinaryAfterContact(expected, 'complete')
  await tab(page, 'Companies & contacts')
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('  After Merge Contact  ')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('after@harbor.invalid')
  await page.getByRole('combobox', { name: 'Contact company', exact: true }).selectOption('company-0001')
  await button(page, 'Create sample contact').click(); expected = E.ordinaryAfterContact(expected, 'contact')
  await tab(page, 'Pipeline')
  await page.getByRole('textbox', { name: 'Opportunity title', exact: true }).fill('After merge opportunity')
  await page.getByRole('combobox', { name: 'Opportunity company', exact: true }).selectOption('company-0001')
  await page.getByRole('combobox', { name: 'Opportunity contact', exact: true }).selectOption('contact-0007')
  await page.getByRole('spinbutton', { name: 'Opportunity amount (USD)', exact: true }).fill('1234.56')
  await button(page, 'Create sample opportunity').click(); expected = E.ordinaryAfterContact(expected, 'opportunity')
  await tab(page, 'Follow-up tasks')
  await page.getByRole('textbox', { name: 'Follow-up title', exact: true }).fill('After merge task')
  await page.getByRole('combobox', { name: 'Follow-up opportunity', exact: true }).selectOption('opportunity-0008')
  await button(page, 'Create sample follow-up').click(); expected = E.ordinaryAfterContact(expected, 'task')
  await exact(page, dir, '17-five-ordinary-steps-after-merge', expected, baseline)
  await page.reload(); await exact(page, dir, '18-ordinary-history-reload', expected, baseline)
  await importCrm(page, expected, 'valid-full-ordinary-history-reimport'); await exact(page, dir, '19-ordinary-history-real-import', expected, baseline)
  checks.push('WX-0371: after merge, actual stage/task/contact/opportunity/follow-up forms append five exact canonical commands and receipts 0005–0009 with IDs 0007/0008/0009; previous captures remain unchanged through export, reload and real import')
}

async function transfer(page, target) {
  await tab(page, 'Ownership')
  const ownerForm = page.getByRole('form', { name: 'Transfer a sample account', exact: true })
  await ownerForm.getByRole('combobox', { name: 'Account to transfer', exact: true }).selectOption('company-0001')
  await ownerForm.getByRole('combobox', { name: 'New account owner', exact: true }).selectOption(target)
  await button(ownerForm, 'Preview account transfer').click(); await button(region(page, 'Account ownership transfer preview'), 'Confirm account transfer').click()
}
async function transferJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A-transfer'); await transfer(page, 'sales-sam'); expected = E.transferredTarget(expected)
  await exact(page, dir, '20-before-boundary-four-record-transfer', expected, baseline)
  await tab(page, 'Duplicates & merges'); await identity(page, 'sales-sam')
  await choose(page, E.selections.samContact); await apply(page, 'contact'); expected = E.samContact(expected)
  await observe(page, dir, 'history', 'representative', history(page).getByText(statuses.history.representative, { exact: true }))
  await identity(page, 'crm-owner'); await transfer(page, 'sales-riley'); expected = E.returnedTarget(expected)
  await exact(page, dir, '21-transfer-merge-transfer-complete', expected, baseline)
  await tab(page, 'Duplicates & merges'); await identity(page, 'sales-sam')
  await expect(receiptRows(page)).toHaveCount(1)
  await expect(receiptRows(page).getByRole('heading', { level: 3 })).toHaveText('MOCK-CRM-0005 · merge-contact')
  await expect(history(page)).toContainText('Historical CRM merge recorded in this ownership scope.')
  await expect(history(page)).not.toContainText('jordan@orbit.invalid'); await expect(history(page)).not.toContainText('retained@harbor.invalid'); await expect(history(page)).not.toContainText('Jordan Example'); await expect(history(page)).not.toContainText('Untouched Sam opportunity')
  assert.equal(await history(page).locator('h5').count(), 0, 'Former representative receives no captured full-record field tables')
  await expect(selection(page, 'contact', 'source').locator('option[value="contact-0002"]')).toHaveCount(0)
  await identity(page, 'sales-riley'); await expect(receiptRows(page)).toHaveCount(0)
  await expect(history(page)).toContainText('No merge receipts are accessible in this recorded ownership scope.')
  await expect(selection(page, 'contact', 'source').locator('option[value="contact-0002"]')).toHaveCount(1)
  await identity(page, 'crm-auditor'); await expect(form(page, 'contact')).toHaveCount(0); await expect(receiptRows(page)).toHaveCount(1)
  await expect(receiptRows(page).getByRole('heading', { level: 3 })).toHaveText('MOCK-CRM-0005 · merge-contact')
  await assertCapture(receiptRows(page).first(), expected.crm.activity[1].mergeChange)
  await exact(page, dir, '22-current-former-representative-and-auditor-scopes', expected, baseline)
  checks.push('WX-0369/WX-0371: native transfer→own Sam merge→later transfer preserves historical receipt membership and chronological import proof; former Sam gets fixed IDs/counts summary without private capture fields, new Riley sees current choices without inherited other-owner merge history, auditor reads full capture without actions')
}

async function retainedTab(page, name, participants, choice = 'Leave and keep draft') {
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name, exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  assert.deepEqual((await dialog(page).getByRole('listitem').allTextContents()).map(value => value.trim()).sort(), [...participants].sort(), 'The dialog must list exactly the independently expected dirty owners')
  const before = await slots(page); await button(dialog(page), choice).click(); await noDialog(page)
  assert.deepEqual(await slots(page), before)
}
async function dirtyJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A-retained-drafts'); await tab(page, 'Companies & contacts')
  const contactName = page.getByRole('textbox', { name: 'Contact name', exact: true }), contactEmail = page.getByRole('textbox', { name: 'Contact email', exact: true })
  await contactName.fill('  Literal unsaved contact  '); await contactEmail.fill('unsaved@literal.invalid')
  await page.getByRole('combobox', { name: 'Contact company', exact: true }).selectOption('company-harbor')
  await retainedTab(page, 'Pipeline', ['New CRM contact'])
  const opportunityTitle = page.getByRole('textbox', { name: 'Opportunity title', exact: true }), opportunityAmount = page.getByRole('spinbutton', { name: 'Opportunity amount (USD)', exact: true })
  await opportunityTitle.fill('  Literal unsaved opportunity  '); await opportunityAmount.fill('00123.40')
  await page.getByRole('combobox', { name: 'Opportunity company', exact: true }).selectOption('company-harbor')
  await page.getByRole('combobox', { name: 'Opportunity contact', exact: true }).selectOption('contact-avery')
  await retainedTab(page, 'Duplicates & merges', ['New CRM contact', 'New CRM opportunity'])
  await selection(page, 'contact', 'source').selectOption('contact-avery'); await selection(page, 'contact', 'retained').selectOption('contact-0002')
  await choose(page, E.selections.company); await apply(page, 'company'); expected = E.companyA(expected)
  await exact(page, dir, '23a-company-merge-keeps-unrelated-raw-drafts', expected, baseline)
  const dirty = ['New CRM contact', 'New CRM opportunity', 'Contact merge selection']
  await retainedTab(page, 'Pipeline', dirty, 'Keep editing')
  await expect(contactName).toBeVisible(); await expect(contactName).toBeFocused()
  await expect(contactName).toHaveValue('  Literal unsaved contact  '); await expect(contactEmail).toHaveValue('unsaved@literal.invalid')
  await expect(page.getByRole('combobox', { name: 'Contact company', exact: true })).toHaveValue('company-harbor')
  await expect(page.getByRole('combobox', { name: 'Contact company', exact: true }).locator('option:checked')).toHaveText('Unavailable selected company · company-harbor')
  await retainedTab(page, 'Pipeline', dirty)
  await expect(opportunityTitle).toHaveValue('  Literal unsaved opportunity  '); await expect(opportunityAmount).toHaveValue('00123.40')
  await expect(page.getByRole('combobox', { name: 'Opportunity company', exact: true })).toHaveValue('company-harbor')
  await expect(page.getByRole('combobox', { name: 'Opportunity contact', exact: true })).toHaveValue('contact-avery')
  await expect(page.getByRole('combobox', { name: 'Opportunity company', exact: true }).locator('option:checked')).toHaveText('Unavailable selected company · company-harbor')
  await expect(page.getByRole('combobox', { name: 'Opportunity contact', exact: true }).locator('option:checked')).toHaveText('Unavailable selected contact · contact-avery')
  await unchanged(page, dir, '23b-unavailable-ordinary-selection-prevented', expected, async () => { await expect(button(page, 'Create sample opportunity')).toBeDisabled(); await opportunityAmount.press('Enter'); await expect(opportunityTitle).toHaveValue('  Literal unsaved opportunity  '); await expect(opportunityAmount).toHaveValue('00123.40'); await expect(page.getByRole('combobox', { name: 'Opportunity company', exact: true })).toHaveValue('company-harbor'); await expect(page.getByRole('combobox', { name: 'Opportunity contact', exact: true })).toHaveValue('contact-avery') })
  await retainedTab(page, 'Duplicates & merges', dirty)
  await expect(selection(page, 'contact', 'source')).toHaveValue('contact-avery'); await expect(selection(page, 'contact', 'retained')).toHaveValue('contact-0002')
  await button(form(page, 'contact'), 'Preview contact merge').click(); await apply(page, 'contact'); expected = E.contactA(expected)
  await exact(page, dir, '23c-only-submitted-merge-form-rebased', expected, baseline)
  const before = await slots(page)
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: 'Portal directory', exact: true }).click()
  assert.deepEqual((await dialog(page).getByRole('listitem').allTextContents()).map(value => value.trim()).sort(), ['New CRM contact', 'New CRM opportunity'].sort())
  await button(dialog(page), 'Keep editing').click(); await noDialog(page); await expect(contactName).toBeVisible(); await expect(contactName).toBeFocused()
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: 'Portal directory', exact: true }).click()
  await button(dialog(page), 'Discard and leave').click(); await noDialog(page); assert.deepEqual(await slots(page), before)
  await open(page, 'Customer relationships'); await tab(page, 'Companies & contacts')
  await expect(contactName).toHaveValue(''); await expect(contactEmail).toHaveValue('')
  await tab(page, 'Pipeline'); await expect(opportunityTitle).toHaveValue(''); await expect(opportunityAmount).toHaveValue('2500')
  await exact(page, dir, '23d-explicit-discard-clears-only-ordinary-drafts', expected, baseline)
  checks.push('WX-0370/WX-0371/WX-0373: actual retained CRM tabs preserve literal contact name/email and opportunity title/00123.40 amount while company/contact retirements render explicit unavailable IDs; disabled stale ordinary submission and native Enter create no action or saved change; Keep reveals/focuses its exact owning form, each merge rebases only itself and explicit Discard clears the two remaining drafts without saved mutation')
  expected = E.legacyActivityBoundary(seed.workspaces)
  await importCrm(page, expected, 'literal-10000-legacy-activity-boundary'); await tab(page, 'Duplicates & merges')
  await selection(page, 'company', 'source').selectOption('company-harbor'); await selection(page, 'company', 'retained').selectOption('company-orbit')
  await retainedTab(page, 'Companies & contacts', ['Company merge selection'])
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Beyond merge inspection bound')
  await button(page, 'Create sample company').click(); expected = E.legacyBeyondMergeBoundary(expected)
  await exact(page, dir, '23e-ordinary-legacy-growth-preserves-complete-state', expected, baseline)
  await retainedTab(page, 'Duplicates & merges', ['Company merge selection'])
  const unavailable = region(page, 'Company merge temporarily unavailable')
  await expect(selection(page, 'company', 'source')).toHaveValue('company-harbor'); await expect(selection(page, 'company', 'retained')).toHaveValue('company-orbit')
  await expect(button(form(page, 'company'), 'Preview company merge')).toBeDisabled()
  await observe(page, dir, 'preview', 'featureUnavailable', unavailable.locator('p').first())
  await retainedTab(page, 'Companies & contacts', ['Company merge selection'], 'Keep editing')
  await expect(selection(page, 'company', 'source')).toBeVisible(); await expect(selection(page, 'company', 'source')).toBeFocused()
  await expect(selection(page, 'company', 'source')).toHaveValue('company-harbor'); await expect(selection(page, 'company', 'retained')).toHaveValue('company-orbit')
  await exact(page, dir, '23f-feature-refusal-retains-raw-selection-and-dirty-owner', expected, baseline)
  checks.push('CRM feature-bound regression: a real ordinary company creation after a valid 10,000-row legacy activity import produces exactly receipt/company-10001 and sequence 10002 without adopting history; the newly unavailable merge feature keeps literal source/retained IDs, disables Preview with a nearby reason, preserves dirty ownership and Keep reveals/focuses the original form')

}

async function storageJourney(args) {
  const { page, artifactDir: dir, seed, checks } = args
  await page.addInitScript(() => {
    const native = Storage.prototype.setItem, fault = { enabled: false, attempts: 0 }
    Object.defineProperty(window, '__crmMergeStorageFault', { value: fault })
    Storage.prototype.setItem = function (key, value) { if (fault.enabled && key === 'webappx.demo.crm') { fault.attempts++; throw new DOMException('Declared CRM-save platform quota fault', 'QuotaExceededError') } return native.call(this, key, value) }
  })
  const baseline = await seedBrowser(args); let expected = E.fixtureA(seed.workspaces)
  await importCrm(page, expected, 'literal-A-storage'); await tab(page, 'Duplicates & merges')
  const before = await slots(page)
  await choose(page, E.selections.contact)
  await page.evaluate(() => { window.__crmMergeStorageFault.enabled = true })
  await apply(page, 'contact'); expected = E.contactA(expected)
  await observe(page, dir, 'recovery', 'memoryOnly', page.getByRole('status').filter({ hasText: /CRM changes are only in memory/ }))
  await expect(panelFor(page, 'contact').getByRole('status')).toContainText(statuses.preview.accepted)
  assert.deepEqual(await slots(page), before, 'Quota-failed merge accepts memory once while every raw stored byte remains exact')
  const platform = await page.evaluate(() => ({ ...window.__crmMergeStorageFault })); assert.equal(platform.attempts, 1)
  await exact(page, dir, '23-quota-fault-complete-memory-export', expected, baseline, { memoryOnly: true })
  await page.keyboard.press('Enter'); assert.equal((await page.evaluate(() => ({ ...window.__crmMergeStorageFault }))).attempts, 1)
  checks.push('WX-0371: an explicit Storage platform quota fault yields exactly one CRM save attempt, one accepted in-memory complete merge/receipt and truthful storage warning; Export backs up the memory result while old raw save/other portals/history remain exact')
}

async function filePaths(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filePaths(path))
    else if (entry.isFile()) result.push(path)
  }
  return result.sort()
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
async function bindings(paths, root) { return Object.fromEntries(await Promise.all(paths.map(async path => [relative(root, path).replaceAll('\\', '/'), sha256(await readFile(path))]))) }
export async function runCrmMergeSuite({ browser, origin, artifactDir, seed }) {
  const repository = process.cwd(), runtimePaths = await filePaths(join(repository, 'src')), runtimeBefore = await bindings(runtimePaths, repository)
  const checks = [], problems = [], warnings = [], contexts = [], allStatuses = []
  const journeys = [['report', reportJourney], ['contact-recovery', contactRecoveryJourney], ['company-chronology', companyChronologyJourney], ['ordinary', ordinaryJourney], ['transfer', transferJourney], ['dirty', dirtyJourney], ['storage', storageJourney]]
  for (const [name, run] of journeys) {
    const dir = join(artifactDir, name); await mkdir(dir, { recursive: true })
    let context, page, tracing = false
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
      await run({ browser, context, page, origin, artifactDir: dir, seed, checks })
      assert.deepEqual(problems, [], 'CRM merge contexts require zero external/provider/backend requests, failed HTTP requests, console errors or uncaught errors')
      const observed = recordFor(page); allStatuses.push(...observed.statuses)
      await writeFile(join(dir, 'journey-evidence.json'), JSON.stringify(observed, null, 2) + '\n')
      contexts.push({ name, evidence: `${name}/journey-evidence.json`, statusCount: observed.statuses.length, controlAudits: observed.controls.length, snapshotCount: observed.snapshots.length, keyboardObservations: observed.keyboard.length })
      await context.tracing.stop({ path: join(dir, 'trace.zip') }); tracing = false
    } catch (error) {
      if (page && !page.isClosed()) try { await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true }) } catch { /* Preserve the primary failure. */ }
      error.smokeEvidence = { checks, problems, warnings, contexts, ...(page ? { currentJourney: recordFor(page) } : {}) }
      throw error
    } finally {
      if (context && tracing) try { await context.tracing.stop({ path: join(dir, 'trace.zip') }) } catch { /* Preserve primary failure and trace when possible. */ }
      if (context) await context.close()
    }
  }
  const coverage = auditStatusCoverage(crmMergeStatusFamilies, allStatuses)
  assert.deepEqual(coverage.missing, [], 'Every declared CRM merge meaning needs an actual native UI witness')
  await writeFile(join(artifactDir, 'crm-merge-status-evidence.json'), JSON.stringify({ schemaVersion: 1, inventory: statuses, sources: crmMergeStatusSources, observations: allStatuses, contexts }, null, 2) + '\n')
  checks.push('CRM merge status inventory: all 24 introduced meanings have actual native narrow/x-large witnesses, complete bounds, three uncovered hit samples and monochrome captures; seven isolated contexts close with zero unexpected network or browser failures')
  assert.deepEqual(await bindings(await filePaths(join(repository, 'src')), repository), runtimeBefore, 'Every runtime source byte must remain frozen throughout CRM browser verification')
  const harnessPaths = ['scripts/browser-portal-lifecycle.mjs', 'scripts/browser-smoke.mjs', 'scripts/browser-preview-process.mjs', 'scripts/browser-preview-worker.mjs', 'tests/browser/crm-merge.mjs', 'tests/browser/crm-merge-expected.mjs', 'tests/browser/crm-merge-status-inventory.mjs', 'tests/browser/crm-merge-harness.test.mjs', 'tests/browser/portal-lifecycle.mjs', 'tests/browser/portals-smoke.mjs', 'tests/browser/portal-quality.mjs', 'tests/browser/keyboard-driver.mjs', 'tests/browser/seed-contract.mjs', 'tests/browser/fixtures/portal-smoke-v1.json', 'tests/browser/fixtures/portal-smoke-v1.sha256', 'package.json']
  const artifactBindings = await bindings((await filePaths(artifactDir)).filter(path => !relative(artifactDir, path).startsWith('vite-cache/') && !['report.json', 'crm-merge-manifest.json'].includes(path.split('/').at(-1))), artifactDir)
  const manifest = { algorithm: 'sha256', hashMode: 'exact file bytes; complete runtime before/after equality; generated Vite dependency cache and self-referential report/manifest excluded', runtime: runtimeBefore, harness: await bindings(harnessPaths.map(path => join(repository, path)), repository), artifacts: artifactBindings }
  const bytes = JSON.stringify(manifest, null, 2) + '\n'; await writeFile(join(artifactDir, 'crm-merge-manifest.json'), bytes)
  const manifestReceipt = { file: 'crm-merge-manifest.json', sha256: sha256(bytes), runtimeFiles: runtimePaths.length, harnessFiles: harnessPaths.length, artifacts: Object.keys(artifactBindings).length }
  return { checks, warnings, seedHash: seed.sha256, manifest: manifestReceipt, crmMerge: { contextCount: contexts.length, statusCount: allStatuses.length, statusCoverage: crmMergeStatusFamilies, contexts, coveredItems: coveredCrmMergeItems } }
}
