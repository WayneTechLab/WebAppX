import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { assertRetainedControl, auditStatusCoverage, auditVisibleControls } from './portal-quality.mjs'
import { payrollStatusInventory, payrollStatusSources, payrollStatusFamilies } from './payroll-control-status-inventory.mjs'
import { createKeyboardDriver } from './keyboard-driver.mjs'
import { runPayrollLifecycle } from './payroll-lifecycle.mjs'
import * as E from './payroll-control-expected.mjs'

const { avery, jordan, date, period } = E
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const region = (scope, name) => scope.getByRole('region', { name, exact: true })
const form = (scope, name) => scope.getByRole('form', { name, exact: true })
const backup = page => region(page, 'HR workspace backup')
const combined = page => region(page, 'Combined workspace backup')
const historyKey = 'webappx.demo.restore-points'
const dialog = page => page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
const upload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
const nativeEnvelope = data => ({ format: 'webappx-mock-workspace', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', module: 'hr', data })
const combinedEnvelope = workspaces => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces })
const qualityRecords = new WeakMap()
function evidenceFor(page) { if (!qualityRecords.has(page)) qualityRecords.set(page, { statuses: [], controls: [], measurements: [], boundaries: [] }); return qualityRecords.get(page) }
export const coveredPayrollControlItems = Object.freeze(['WX-0159', 'WX-0160'])

async function slots(page) {
  const state = await page.context().storageState(), origin = new URL(page.url()).origin
  assert.deepEqual(state.cookies, []); assert.ok(state.origins.every(item => item.origin === origin))
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}
async function noDialog(page) { await expect(dialog(page), 'An accepted action must leave its own form clean').not.toBeVisible() }
async function open(page, name) {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name, exact: true }).click()
  await noDialog(page)
}
async function openWithDecision(page, name, participants, choice) {
  const before = await slots(page)
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name, exact: true }).click()
  await expect(dialog(page)).toBeVisible(); await expect(dialog(page).getByRole('listitem')).toHaveText(participants)
  await button(dialog(page), choice).click(); await noDialog(page)
  assert.deepEqual(await slots(page), before, 'An explicit temporary-form decision must not mutate any saved slot')
}
async function hrPortal(page, name) {
  await open(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name, exact: true }).click(); await noDialog(page)
}
async function hrPage(page, portal, name) {
  const mobile = page.getByRole('navigation', { name: `${portal} mobile HR pages`, exact: true })
  if (!await mobile.isVisible()) await page.getByText(`Browse ${portal.toLowerCase()} pages`, { exact: true }).click()
  await mobile.getByRole('link', { name, exact: true }).click(); await noDialog(page)
}
async function payroll(page) { await hrPortal(page, 'Management'); await hrPage(page, 'Management', 'Payroll workspace') }
async function employee(page, expected, id, title) {
  await hrPortal(page, 'Employee')
  const select = page.getByRole('combobox', { name: /^Synthetic employee identity/ })
  if (await select.inputValue() !== id) { await select.selectOption(id); expected.hr.selectedEmployee = id; await noDialog(page) }
  await hrPage(page, 'Employee', title)
}
async function extraLarge(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await button(page, 'Open accessibility controls').click()
  await button(page.getByRole('group', { name: 'Text size', exact: true }), 'Extra large').click()
  await button(region(page, 'Accessibility and page controls'), 'Close accessibility controls').click()
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px')
}
async function capture(page, artifactDir, name, scope) {
  const style = await page.addStyleTag({ content: 'html,dialog:modal,dialog::backdrop{filter:grayscale(1)!important}' })
  try {
    if (scope) await scope.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    await (scope ?? page).screenshot({ path: join(artifactDir, `${name}-monochrome.png`), ...(scope ? {} : { fullPage: true }) })
  } finally { await style.evaluate(element => element.remove()) }
}
export function assertPayrollWitnessBounds(bounds, viewportWidth) {
  assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= viewportWidth + 1, `The complete status witness must fit the ${viewportWidth}px viewport; interior hit points alone do not prove full text visibility`)
}
async function observe(page, artifactDir, family, state, locator) {
  const literal = payrollStatusInventory[family]?.[state]
  assert.ok(literal, `Unknown payroll control status ${family}/${state}`)
  await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); await expect(locator).toContainText(literal)
  assert.deepEqual(page.viewportSize(), { width: 390, height: 844 }); await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const text = await locator.innerText(), bounds = await locator.boundingBox()
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0 && bounds.height <= 800, `${family}/${state}: a bounded readable actual text witness is required`)
  const samples = await locator.evaluate(element => {
    const box = element.getBoundingClientRect()
    return [0.2, 0.5, 0.8].map(fraction => { const x = box.left + box.width * fraction, y = box.top + box.height / 2, hit = document.elementFromPoint(x, y); return { x, y, uncovered: Boolean(hit && (hit === element || element.contains(hit))), hit: hit?.outerHTML.slice(0, 350) } })
  })
  const name = `status-${family}-${state}`
  await writeFile(join(artifactDir, `${name}-measurement.json`), JSON.stringify({ bounds, samples, text }, null, 2) + '\n')
  if (bounds.x < -1 || bounds.x + bounds.width > page.viewportSize().width + 1) await capture(page, artifactDir, `${name}-OVERFLOW`, locator)
  assertPayrollWitnessBounds(bounds, page.viewportSize().width)
  if (!samples.every(sample => sample.uncovered)) await capture(page, artifactDir, `${name}-OCCLUDED`, locator)
  assert.ok(samples.every(sample => sample.uncovered), `${family}/${state}: actual status must remain uncovered`)
  await capture(page, artifactDir, name, locator); assert.equal(await locator.innerText(), text)
  evidenceFor(page).statuses.push({ family, state, literal, text, bounds, samples, source: payrollStatusSources[family], capture: `${name}-monochrome.png`, mode: 'actual native UI action; style-only monochrome capture' })
}
async function quality(page, artifactDir, name, scope, keyboardTarget, inputs = []) {
  const audit = await auditVisibleControls(page, name, artifactDir), measurements = []
  for (const control of await scope.locator('input:not([type="file"]):not([type="hidden"]),select,textarea,button').all()) if (await control.isVisible()) measurements.push(await assertRetainedControl(page, control))
  for (const [control, value] of inputs) await assertRetainedControl(page, control, { value })
  if (keyboardTarget) await assertRetainedControl(page, keyboardTarget, { keyboard: true })
  evidenceFor(page).controls.push(audit); evidenceFor(page).measurements.push({ name, measurements, literals: inputs.map(([, value]) => value), keyboard: Boolean(keyboardTarget) })
}
const lastDownload = new WeakMap()
async function download(page, control, artifactDir, name) {
  const remaining = 160 - (Date.now() - (lastDownload.get(page) ?? 0)); if (remaining > 0) await delay(remaining)
  lastDownload.set(page, Date.now())
  const [result] = await Promise.all([page.waitForEvent('download'), control.click()])
  const path = join(artifactDir, `${name}.json`); await result.saveAs(path); assert.equal(await result.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
}
async function exactSaved(page, expected) {
  const saved = await slots(page)
  for (const module of ['hr', 'cms', 'crm']) assert.deepEqual(JSON.parse(saved[`webappx.demo.${module}`]), { schemaVersion: 1, module, data: expected[module] }, `Complete saved ${module} record`)
  return saved
}
async function exact(page, artifactDir, name, expected) {
  await open(page, 'Portal directory')
  await expect(combined(page)).toContainText('saved private review drafts, recruiting scorecards, survey answers and receipts')
  const result = await download(page, button(combined(page), 'Export all workspaces'), artifactDir, name)
  assert.deepEqual(Object.keys(result).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(result.format, 'webappx-mock-workspaces'); assert.equal(result.schemaVersion, 1)
  assertCompleteWorkspaces(result.workspaces, expected, name)
  return exactSaved(page, expected)
}
export function assertCompleteWorkspaces(actual, expected, name = 'Payroll control journey') { assert.deepEqual(actual, expected, `${name}: complete exports must equal handwritten expected records`) }
export function assertHistoryAppend(beforeRaw, afterRaw, { kind, hr, sourcePointId }) {
  const before = JSON.parse(beforeRaw), after = JSON.parse(afterRaw)
  assert.deepEqual(Object.keys(before).sort(), ['points', 'schemaVersion']); assert.equal(before.schemaVersion, 1)
  assert.deepEqual(Object.keys(after).sort(), ['points', 'schemaVersion']); assert.equal(after.schemaVersion, 1)
  assert.ok(Array.isArray(before.points) && before.points.length < 5, 'This bounded journey is below the five-point cap; no pruning is expected')
  assert.equal(after.points.length, before.points.length + 1)
  assert.deepEqual(after.points.slice(1), before.points, 'Every prior full history capture remains unchanged')
  const point = after.points[0]
  assert.deepEqual(Object.keys(point).sort(), ['createdAt', 'id', 'kind', 'modules', 'states', ...(kind === 'undo' ? ['sourcePointId'] : [])].sort(), 'This explicit restore/Undo creates no implicit label or extra metadata')
  assert.match(point.id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  assert.match(point.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.equal(new Date(point.createdAt).toISOString(), point.createdAt)
  assert.equal(new Set(after.points.map(item => item.id)).size, after.points.length)
  assert.equal(point.kind, kind); assert.deepEqual(point.modules, ['hr']); assert.deepEqual(Object.keys(point.states), ['hr'])
  assert.deepEqual(point.states.hr, hr, 'New history captures the complete independently expected HR pre-state')
  if (kind === 'undo') { assert.equal(point.sourcePointId, sourcePointId); assert.notEqual(point.id, sourcePointId) }
  return point
}
async function seedBrowser({ page, origin, artifactDir, seed }) {
  await page.goto(`${origin}/portals`); await extraLarge(page)
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('canonical-native-seed.json', combinedEnvelope(seed.workspaces)))
  const preview = region(page, 'Selective restore preview')
  for (const module of ['HR', 'CMS', 'CRM']) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) }).check()
  await button(preview, 'Restore selected workspaces').click()
  const expected = structuredClone(seed.workspaces)
  await exact(page, artifactDir, '00-canonical-native-seed', expected)
  return expected
}

const closureForm = page => form(page, 'Close submitted sample period')
const correctionForm = page => form(page, 'Create fictional payroll correction')
const closurePreview = page => region(page, 'Period closure preview')
const correctionPreview = page => region(page, 'Payroll correction preview')
const timeRow = (page, id) => page.getByRole('article', { name: `Time entry ${id}`, exact: true })
const moneyLabels = ['Fictional gross', 'Illustrative withholding', 'Sample benefits', 'Fictional net']
const rawFields = ['Correction recorded date', 'Correction reason', 'Corrected cumulative fictional gross (dollars)', 'Corrected cumulative illustrative withholding (dollars)', 'Corrected cumulative sample benefits (dollars)']
const correctionField = (page, name) => name === 'Correction reason' ? correctionForm(page).getByRole('textbox', { name: /^Correction reason/ }) : correctionForm(page).getByLabel(name, { exact: true })
const moneyKeys = ['grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents', 'netCents']
const dollars = (cents, signed = false) => `${cents < 0 ? '-' : signed && cents > 0 ? '+' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const feedback = page => page.getByRole('alert').filter({ hasText: /^The company sample window|^The selected sample period|^Approve at least one/ })
function ordinaryFrozenBytes(saved) {
  const workflow = JSON.parse(saved['webappx.demo.hr']).data.workflow
  return JSON.stringify(Object.fromEntries(['sequence', 'payroll', 'payrollHistory', 'timeEntries', 'benefitElections', 'sampleRates'].map(key => [key, workflow[key]])))
}

async function memory(page, artifactDir, name, expected) {
  const value = await download(page, button(backup(page), 'Export workspace'), artifactDir, name)
  assert.equal(value.format, 'webappx-mock-workspace'); assert.equal(value.schemaVersion, 1); assert.equal(value.module, 'hr')
  assert.equal(new Date(value.exportedAt).toISOString(), value.exportedAt)
  assert.deepEqual(value.data, expected.hr, `${name}: complete accepted HR memory equals independent literals`)
  return value
}
async function preserved(page, artifactDir, name, expected, action) {
  const before = await slots(page)
  const original = JSON.stringify(expected.hr.workflow.payrollHistory)
  await action()
  assert.deepEqual(await slots(page), before, `${name}: every origin slot including complete workspace/history/preferences is byte-exact`)
  await memory(page, artifactDir, name, expected)
  assert.equal(JSON.stringify(expected.hr.workflow.payrollHistory), original)
}
async function importHr(page, data, { filename = 'declared-payroll-fixture.json' } = {}) {
  await open(page, 'People & HR')
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload(filename, nativeEnvelope(data)))
  await button(backup(page), 'Replace HR workspace').click(); await noDialog(page)
}
async function discardControlForms(page, target = 'People & HR') {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: target, exact: true }).click()
  if (await dialog(page).isVisible()) {
    const participants = await dialog(page).getByRole('listitem').allTextContents()
    assert.ok(participants.length > 0 && participants.every(label => ['Sample period closure', 'Fictional payroll correction'].includes(label.trim())), 'This explicit branch teardown may discard only its known payroll-control forms; unexpected dirty participants fail')
    await button(dialog(page), 'Discard and leave').click()
  }
  await noDialog(page)
}
async function cleanPayroll(page) { await discardControlForms(page, 'Portal directory'); await payroll(page) }
async function manager(page) {
  await hrPortal(page, 'Manager'); await hrPage(page, 'Manager', 'Team time')
  await expect(page.getByRole('combobox', { name: /^Synthetic manager identity/ })).toHaveValue('employee-001')
}
async function approve(page, ids) {
  await manager(page)
  for (const id of ids) await button(timeRow(page, id), 'Approve sample time').click()
}
async function removeJordan(page, expected) {
  await employee(page, expected, jordan, 'My time')
  await button(timeRow(page, 'time-002'), 'Delete draft').click()
  const confirm = page.getByRole('group', { name: 'Delete draft time-002', exact: true })
  await button(confirm, 'Keep draft').click(); await expect(timeRow(page, 'time-002')).toBeVisible()
  await button(timeRow(page, 'time-002'), 'Delete draft').click(); await button(confirm, 'Confirm delete draft').click()
  await expect(timeRow(page, 'time-002')).toHaveCount(0)
}
async function benefit(page, expected) {
  await employee(page, expected, avery, 'My benefits')
  const plan = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Demo health plan', exact: true }) })
  for (const action of ['Elect sample enrollment', 'Review sample election', 'Confirm sample election']) await button(plan, action).click()
}
async function rate(page, employeeId, amount, effective = '2026-10-01') {
  const rates = form(page, 'Configure fictional hourly rates')
  await rates.getByRole('combobox', { name: /^Rate employee/ }).selectOption(employeeId)
  await rates.getByLabel('Fictional hourly rate (dollars)', { exact: true }).fill(amount)
  await rates.getByLabel('Rate effective date', { exact: true }).fill(effective)
  await button(rates, 'Add sample rate').click(); await noDialog(page)
}
async function ordinaryPeriod(page, start = period.start, end = period.end) {
  await page.getByLabel('Sample period start', { exact: true }).fill(start)
  await page.getByLabel('Sample period end', { exact: true }).fill(end)
}
async function submitPayroll(page, start = period.start, end = period.end) {
  await ordinaryPeriod(page, start, end)
  for (const action of ['Prepare sample payroll', 'Calculate fictional totals', 'Review simulated payroll', 'Simulate payroll submission']) await button(page, action).click()
  await noDialog(page)
}
async function makeA(args, unresolvedJordan = false) {
  const expected = await seedBrowser(args), { page } = args
  if (!unresolvedJordan) await removeJordan(page, expected)
  await benefit(page, expected); await approve(page, ['time-001']); await payroll(page)
  await rate(page, avery, '30.00'); await submitPayroll(page)
  const result = E.fixtureA(args.seed.workspaces, { unresolvedJordan })
  await exact(page, args.artifactDir, '01-native-original-A', result)
  await payroll(page)
  return result
}
async function chooseClosure(page, reason = E.closureA.reason, receipt = 'MOCK-PAYROLL-0002') {
  const scope = closureForm(page)
  await scope.getByRole('combobox', { name: /^Submitted period/ }).selectOption(receipt)
  await scope.getByLabel('Closure recorded date', { exact: true }).fill(date)
  await scope.getByRole('textbox', { name: /^Closure reason/ }).fill(reason)
}
async function chooseCorrection(page, receipt = 'MOCK-PAYROLL-0002', employeeId = avery) {
  const scope = correctionForm(page)
  await scope.getByRole('combobox', { name: /^Original receipt/ }).selectOption(receipt)
  await scope.getByRole('combobox', { name: /^Correction employee/ }).selectOption(employeeId)
}
async function correctionInputs(page, amounts, reason, recordedOn = date) {
  const values = [recordedOn, reason, ...amounts]
  for (let i = 0; i < rawFields.length; i++) await correctionField(page, rawFields[i]).fill(values[i])
  return values
}
async function assertRaw(page, values) {
  for (let i = 0; i < rawFields.length; i++) await expect(correctionField(page, rawFields[i])).toHaveValue(values[i])
}
async function assertMoney(scope, title, value, signed = false) {
  const group = scope.getByRole('heading', { name: title, exact: true }).locator('..')
  for (let i = 0; i < moneyLabels.length; i++) await expect(group.getByText(moneyLabels[i], { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText(dollars(value[moneyKeys[i]], signed))
}
async function assertAdjustment(scope, event, original) {
  await assertMoney(scope, 'Immutable original statement', original)
  await assertMoney(scope, 'Previous cumulative balance', event.previous)
  await assertMoney(scope, 'Separate signed adjustment', event.delta, true)
  await assertMoney(scope, 'Proposed cumulative balance', event.proposed)
  await expect(scope.getByText(event.reason, { exact: true })).toBeVisible()
  await expect(scope.getByRole('link', { name: event.originalReceipt, exact: true })).toHaveAttribute('href', `#payroll-original-${event.originalReceipt}`)
}
async function close(page, artifactDir, expected, { witness = false, reason = E.closureA.reason } = {}) {
  const frozen = ordinaryFrozenBytes(await slots(page))
  await chooseClosure(page, reason)
  await preserved(page, artifactDir, 'closure-preview-no-write', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await expect(closurePreview(page)).toContainText('2026-10-01 to 2026-10-15')
  await expect(closurePreview(page)).toContainText('MOCK-PAYROLL-0002')
  if (witness) {
    await observe(page, artifactDir, 'closure', 'preview', closurePreview(page).getByRole('heading', { name: 'Review company-wide sample period closure', exact: true }))
    await button(closurePreview(page), 'Cancel closure preview').click()
    await expect(closurePreview(page)).toHaveCount(0)
    await observe(page, artifactDir, 'closure', 'cancel', button(closureForm(page), 'Preview period closure'))
    await expect(closureForm(page).getByRole('textbox', { name: /^Closure reason/ })).toHaveValue(reason)
    await button(closureForm(page), 'Preview period closure').click()
    // The ordinary period form really coexists with the closure preview.
    // This creates a late dirty participant without private timer injection.
    const before = await slots(page)
    await page.getByLabel('Sample period end', { exact: true }).fill('2026-10-16')
    await button(closurePreview(page), 'Confirm period closure').click()
    await expect(dialog(page).getByRole('listitem')).toHaveText(['Chosen payroll period'])
    await button(dialog(page), 'Keep editing').click(); await noDialog(page)
    await expect(closurePreview(page)).toBeVisible()
    await expect(page.getByLabel('Sample period end', { exact: true })).toHaveValue('2026-10-16')
    assert.deepEqual(await slots(page), before, 'Keep must neither consume the handle nor change any save')
    await button(closurePreview(page), 'Confirm period closure').click()
    await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
    await expect(page.getByLabel('Sample period end', { exact: true })).toHaveValue('2026-10-15')
  } else {
    await button(closurePreview(page), 'Confirm period closure').click(); await noDialog(page)
  }
  assert.equal(ordinaryFrozenBytes(await slots(page)), frozen, 'Closure retains the actual serialized ordinary pointer/history/input/time/election/rate/sequence facts')
  if (witness) await observe(page, artifactDir, 'closure', 'accepted', closureForm(page).getByRole('status'))
}
async function adjustment(page, artifactDir, event, original, amounts, { witness, expected } = {}) {
  const frozen = ordinaryFrozenBytes(await slots(page))
  const raw = await correctionInputs(page, amounts, event.reason, event.recordedOn)
  await preserved(page, artifactDir, `preview-${event.id}`, expected, async () => { await button(correctionForm(page), 'Preview payroll correction').click() })
  await assertAdjustment(correctionPreview(page), event, original)
  if (witness === 'positive') {
    await observe(page, artifactDir, 'correction', 'preview', correctionPreview(page).getByRole('heading', { name: 'Review separate fictional payroll adjustment', exact: true }))
    await quality(page, artifactDir, 'correction-preview', correctionForm(page), button(correctionPreview(page), 'Cancel correction preview'), rawFields.map((name, i) => [correctionField(page, name), raw[i]]))
    const keys = []; evidenceFor(page).keyboard = keys
    const keyboard = createKeyboardDriver(page, keys)
    await keyboard.focus(button(correctionPreview(page), 'Cancel correction preview'), 'Tab to correction Cancel')
    await page.keyboard.press('Enter'); await assertRaw(page, raw)
    await expect(button(correctionForm(page), 'Preview payroll correction')).toBeFocused()
    await observe(page, artifactDir, 'correction', 'cancel', button(correctionForm(page), 'Preview payroll correction'))
    await keyboard.focus(button(correctionForm(page), 'Preview payroll correction'), 'Tab to correction Preview'); await page.keyboard.press('Enter')
    await keyboard.focus(button(correctionPreview(page), 'Confirm fictional payroll correction'), 'Tab to correction Confirm'); await page.keyboard.press('Enter')
  } else {
    await button(correctionPreview(page), 'Confirm fictional payroll correction').click()
  }
  await noDialog(page)
  assert.equal(ordinaryFrozenBytes(await slots(page)), frozen, 'A separate adjustment must not rewrite actual serialized ordinary payroll/time/election/rate/sequence facts')
  const article = page.getByRole('article', { name: `Adjustment ${event.adjustmentReceipt}`, exact: true })
  await assertAdjustment(article, event, original)
  if (witness) {
    const target = article.getByRole('heading', { name: 'Separate signed adjustment', exact: true }).locator('..').getByText(payrollStatusInventory.correction[witness], { exact: true })
    await observe(page, artifactDir, 'correction', witness, target)
  }
  await assertRaw(page, raw)
}

async function addTime(page, expected, workDate, hours, { submit = true } = {}) {
  await employee(page, expected, avery, 'My time')
  await page.getByLabel('Work date', { exact: true }).fill(workDate)
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill(String(hours))
  await button(page, 'Add sample time').click()
  if (submit) await button(page, 'Submit own sample timesheet').click()
}
async function restoreNativeA(page, actualExport, expected) {
  await discardControlForms(page, 'Portal directory')
  await importHr(page, actualExport.data, { filename: 'actual-native-A-export.json' })
  await payroll(page); await exactSaved(page, expected)
}
async function rawRefusals(page, artifactDir, expected) {
  const scope = correctionForm(page), before = await slots(page)
  const rawCases = ['', '1e2', '12.345', '12x', '-1.00', '10000000000.01']
  for (let i = 0; i < rawCases.length; i++) {
    const raw = await correctionInputs(page, [rawCases[i], '54.00', '25.00'], 'Raw decimal refusal')
    await button(scope, 'Preview payroll correction').click()
    const errors = scope.getByRole('alert', { name: 'Payroll correction field errors', exact: true })
    await expect(errors).toContainText('Enter corrected gross as exact dollars')
    await expect(scope.getByLabel(rawFields[2], { exact: true })).toBeFocused()
    await expect(scope.getByLabel(rawFields[2], { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await assertRaw(page, raw); assert.deepEqual(await slots(page), before)
    if (i === 3) await observe(page, artifactDir, 'correction', 'invalid', errors)
  }
  const raw = await correctionInputs(page, ['10.00', '54.00', '25.00'], 'Net below zero refusal')
  await button(scope, 'Preview payroll correction').click()
  await expect(scope.getByRole('alert')).toContainText('Corrected withholding plus benefits must not exceed corrected gross.')
  await expect(scope.getByLabel(rawFields[3], { exact: true })).toBeFocused(); await assertRaw(page, raw)
  assert.deepEqual(await slots(page), before); await memory(page, artifactDir, 'invalid-decimal-complete-memory', expected)
}
async function dirtyCorrection(page, artifactDir, expected, raw) {
  const before = await slots(page)
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
  await expect(dialog(page).getByRole('listitem')).toHaveText(['Fictional payroll correction'])
  await page.keyboard.press('Escape'); await noDialog(page); await assertRaw(page, raw)
  await page.getByRole('combobox', { name: 'Synthetic management role', exact: false }).selectOption('payroll-admin')
  await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Keep editing').click(); await noDialog(page)
  await expect(page.getByRole('combobox', { name: 'Synthetic management role', exact: false })).toHaveValue('employer-owner')
  await assertRaw(page, raw); assert.deepEqual(await slots(page), before)
  await quality(page, artifactDir, 'kept-correction-raw', correctionForm(page), button(correctionForm(page), 'Preview payroll correction'), rawFields.map((name, i) => [correctionField(page, name), raw[i]]))
  await memory(page, artifactDir, 'kept-correction-memory', expected)
}
export async function nativeAJourney(args) {
  const { page, artifactDir, seed, checks } = args
  let expected = await makeA(args, true)
  await observe(page, artifactDir, 'closure', 'absent', region(page, 'Closed sample periods').getByText(payrollStatusInventory.closure.absent, { exact: true }))
  await observe(page, artifactDir, 'correction', 'empty', region(page, 'Separate payroll adjustment receipts').getByText(payrollStatusInventory.correction.empty, { exact: true }))
  await button(closureForm(page), 'Preview period closure').click()
  await observe(page, artifactDir, 'closure', 'invalid', closureForm(page).getByRole('alert'))
  await expect(closureForm(page).getByRole('combobox', { name: /^Submitted period/ })).toBeFocused()
  await chooseClosure(page)
  await preserved(page, artifactDir, 'unresolved-inactive-row-refusal', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await observe(page, artifactDir, 'closure', 'unresolved', closureForm(page).getByRole('alert'))
  await cleanPayroll(page); await removeJordan(page, expected); await employee(page, expected, avery, 'My pay')
  expected = E.fixtureA(seed.workspaces)
  await payroll(page)
  const original = await memory(page, artifactDir, 'P0-native-original-A', expected)
  await open(page, 'Portal directory')
  const originalCombined = await download(page, button(combined(page), 'Export all workspaces'), artifactDir, 'P0-native-original-A-combined')
  assert.deepEqual(originalCombined.workspaces, E.fixtureA(seed.workspaces))
  await payroll(page)
  const originalBytes = JSON.stringify(expected.hr.workflow.payrollHistory)
  await timerGuard(page, artifactDir, expected)
  await chooseCorrection(page); await rawRefusals(page, artifactDir, expected)
  const raw = await correctionInputs(page, E.correctionRaw[0], E.correctionReasons[0])
  await dirtyCorrection(page, artifactDir, expected, raw)
  await button(correctionForm(page), 'Preview payroll correction').click()
  await rate(page, avery, '35.00', '2026-11-01'); E.futureRate(expected)
  await preserved(page, artifactDir, 'mounted-rate-source-stale-refusal', expected, async () => { await button(correctionPreview(page), 'Confirm fictional payroll correction').click() })
  await observe(page, artifactDir, 'correction', 'stale', correctionForm(page).getByRole('alert'))
  await assertRaw(page, raw); await expect(correctionPreview(page)).toHaveCount(0)
  await adjustment(page, artifactDir, E.openCorrection, E.originalMoneyA, E.correctionRaw[0], { expected })
  E.correctedOpenA(expected)
  await observe(page, artifactDir, 'correction', 'open', page.getByRole('article', { name: 'Adjustment MOCK-PAYROLL-ADJUSTMENT-0001', exact: true }).getByRole('heading', { name: 'MOCK-PAYROLL-ADJUSTMENT-0001', exact: true }))
  await exact(page, artifactDir, '02-correction-without-closure-after-stale', expected)
  assert.equal(JSON.stringify(expected.hr.workflow.payrollHistory), originalBytes)
  checks.push('WX-0160: native eight-hour original, exact raw-decimal/all-field errors, Keep/Escape/role refusal and mounted rate-change stale preview preserve complete memory/bytes; a fresh correction succeeds before closure with a separate event1 receipt and manual frozen original')

  expected = E.fixtureA(seed.workspaces); await restoreNativeA(page, original, expected)
  await close(page, artifactDir, expected, { witness: true }); E.closedA(expected)
  await memory(page, artifactDir, 'P1-native-closed-A', expected)
  await preserved(page, artifactDir, 'duplicate-close-no-write', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await observe(page, artifactDir, 'closure', 'duplicate', closureForm(page).getByRole('alert'))
  await chooseCorrection(page)
  const states = ['positive', 'downward', 'benefitsOnly', 'manualWithholding']
  for (let i = 0; i < E.correctionsA.length; i++) {
    await adjustment(page, artifactDir, E.correctionsA[i], E.originalMoneyA, E.correctionRaw[i], { witness: states[i], expected })
    E.correctedA(expected, i + 1)
    await memory(page, artifactDir, `accepted-correction-${i + 1}`, expected)
    assert.equal(JSON.stringify(expected.hr.workflow.payrollHistory), originalBytes)
    if (i === 0) {
      await correctionForm(page).getByLabel(rawFields[2], { exact: true }).fill('270.0')
      await expect(correctionForm(page).getByLabel(rawFields[2], { exact: true })).toHaveValue('270.0')
      const beforeNormalized = await slots(page)
      await exact(page, artifactDir, 'normalized-cents-reversion-is-clean', expected)
      assert.deepEqual(await slots(page), beforeNormalized)
      await payroll(page); await chooseCorrection(page)
    }
  }
  await preserved(page, artifactDir, 'identical-cumulative-noop', expected, async () => { await button(correctionForm(page), 'Preview payroll correction').click() })
  await observe(page, artifactDir, 'correction', 'noop', correctionForm(page).getByRole('alert'))
  await assertRaw(page, [date, E.correctionReasons[3], ...E.correctionRaw[3]])
  const keys = [], keyboard = createKeyboardDriver(page, keys)
  for (const name of ['Original receipt', 'Correction employee', ...rawFields, 'Preview payroll correction']) {
    const control = name.startsWith('Preview') ? button(correctionForm(page), name) : ['Original receipt', 'Correction employee'].includes(name) ? correctionForm(page).getByRole('combobox', { name: new RegExp(`^${name}`) }) : correctionField(page, name)
    await keyboard.focus(control, `Payroll correction ${name}`)
  }
  await page.keyboard.press('Shift+Tab'); await keyboard.assertFocus(correctionForm(page).getByLabel(rawFields[4], { exact: true }), 'Reverse Tab returns to the exact benefits field')
  await writeFile(join(artifactDir, 'correction-keyboard.json'), JSON.stringify(keys, null, 2) + '\n')
  await quality(page, artifactDir, 'multiple-adjustment-rows', region(page, 'Sample payroll closures and corrections'), button(correctionForm(page), 'Preview payroll correction'))
  await exact(page, artifactDir, 'P5-native-closed-four-corrections-A', expected)
  const final = structuredClone(expected)
  await roundTrip(page, artifactDir, seed, expected, originalCombined)
  checks.push('WX-0159/WX-0160: explicit closure and four literal positive/downward/benefits-only/manual-withholding events preserve one original/history/consumed-time snapshot; all original/previous/proposed/signed deltas, receipt links, no-op and exact control sequence6 are verified; actual keyboard and multi-row scopes remain distinct')
  await nativeLockBranches(args, original, final)
  return { original: E.originalA, final, ordinaryHistoryBytesUnchanged: true, keyboard: keys }
}

async function timerGuard(page, artifactDir, expected) {
  await employee(page, expected, avery, 'My time')
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1.50')
  await button(page, 'Start sample timer').click()
  const before = await slots(page)
  const management = page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Management', exact: true })
  await management.click()
  await expect(dialog(page).getByRole('listitem')).toHaveText(['Manual time entry', 'Running sample timer'])
  await button(dialog(page), 'Keep editing').click(); await noDialog(page)
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-14')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('1.50')
  await expect(button(page, 'Stop and add sample time')).toBeVisible()
  assert.deepEqual(await slots(page), before)
  await management.click(); await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
  assert.deepEqual(await slots(page), before, 'Discard cancels only temporary timer/form state; it must not manufacture a time row')
  await payroll(page); await memory(page, artifactDir, 'timer-Keep-Discard-no-phantom-entry', expected)
}

async function nativeLockBranches(args, original, final) {
  const { page, artifactDir, seed, checks } = args
  let expected = structuredClone(final)
  await employee(page, expected, avery, 'My time')
  for (const workDate of ['2026-10-01', '2026-10-09', '2026-10-15']) {
    await page.getByLabel('Work date', { exact: true }).fill(workDate)
    await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1.25')
    await preserved(page, artifactDir, `inclusive-closed-date-${workDate}`, expected, async () => { await button(page, 'Add sample time').click() })
    await expect(page.getByLabel('Work date', { exact: true })).toHaveValue(workDate)
    await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('1.25')
    if (workDate === '2026-10-15') await observe(page, artifactDir, 'ordinary', 'timeClosed', feedback(page))
  }
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Management', exact: true }).click()
  await expect(dialog(page).getByRole('listitem')).toHaveText(['Manual time entry'])
  await button(dialog(page), 'Keep editing').click(); await noDialog(page)
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-15')
  const identity = page.getByRole('combobox', { name: /^Synthetic employee identity/ })
  await identity.selectOption('employee-001'); await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
  expected.hr.selectedEmployee = 'employee-001'
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-09')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1')
  await preserved(page, artifactDir, 'company-lock-applies-to-Morgan-own-time', expected, async () => { await button(page, 'Add sample time').click() })
  await expect(feedback(page)).toHaveText(payrollStatusInventory.ordinary.timeClosed)
  await identity.selectOption(avery); await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
  expected.hr.selectedEmployee = avery
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-16')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1')
  await button(page, 'Add sample time').click(); await button(page, 'Submit own sample timesheet').click()
  await approve(page, ['MOCK-TIME-0003']); E.lateTime(expected)
  await payroll(page)
  for (const [start, end] of [['2026-10-01', '2026-10-16'], ['2026-10-09', '2026-10-09'], ['2026-09-30', '2026-10-01']]) {
    await ordinaryPeriod(page, start, end)
    await preserved(page, artifactDir, `closed-period-${start}-${end}`, expected, async () => { await button(page, 'Prepare sample payroll').click() })
    await expect(feedback(page)).toContainText(payrollStatusInventory.ordinary.periodClosed)
  }
  await observe(page, artifactDir, 'ordinary', 'periodClosed', feedback(page))
  await ordinaryPeriod(page, '2026-09-16', '2026-09-30')
  await preserved(page, artifactDir, 'truly-adjacent-no-eligible-refusal', expected, async () => { await button(page, 'Prepare sample payroll').click() })
  await expect(feedback(page)).toContainText('Approve at least one unpaid time entry')
  await ordinaryPeriod(page, '2026-10-16', '2026-10-31'); await button(page, 'Prepare sample payroll').click()
  expected.hr.workflow.payroll = { period: { start: '2026-10-16', end: '2026-10-31' }, stage: 'prepared', inputs: [{ entryId: 'MOCK-TIME-0003', employeeId: avery, date: '2026-10-16', hours: 1, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }], benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }], employeeTotals: [], hours: 1, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 }
  await exact(page, artifactDir, 'adjacent-open-ordinary-preparation', expected)
  checks.push('WX-0159: inclusive closed-date time refusal retains raw fields and all accepted records; wider/narrower/touching preparation refuses atomically while adjacent Oct16 time and its separate open-period preparation succeed')

  expected = E.fixtureA(seed.workspaces); await restoreNativeA(page, original, expected)
  await addTime(page, expected, '2026-10-16', 1); await approve(page, ['MOCK-TIME-0003']); await payroll(page)
  await ordinaryPeriod(page, period.start, '2026-10-16'); await button(page, 'Prepare sample payroll').click(); E.pendingWider(expected)
  await close(page, artifactDir, expected); E.closedA(expected)
  await observe(page, artifactDir, 'ordinary', 'stale', page.getByRole('status').filter({ hasText: /^Sample payroll stage: stale$/ }))
  for (const action of ['Calculate fictional totals', 'Review simulated payroll', 'Simulate payroll submission']) await expect(button(page, action)).toBeDisabled()
  await exact(page, artifactDir, 'closure-retains-and-stales-wider-preparation', expected)
  checks.push('WX-0159: a natively reached wider prepared pointer survives closure byte-for-byte but becomes visibly stale and its three later ordinary stages are disabled')

  expected = E.fixtureA(seed.workspaces); await restoreNativeA(page, original, expected)
  await addTime(page, expected, '2026-10-16', 2); await approve(page, ['MOCK-TIME-0003']); await payroll(page)
  await submitPayroll(page, '2026-10-10', '2026-10-20'); E.secondReceipt(expected)
  await chooseClosure(page)
  await preserved(page, artifactDir, 'different-submitted-window-refusal', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await observe(page, artifactDir, 'closure', 'overlap', closureForm(page).getByRole('alert'))

  expected = E.fixtureA(seed.workspaces); await restoreNativeA(page, original, expected)
  await addTime(page, expected, '2026-10-10', 2); E.lateTime(expected, { workDate: '2026-10-10', hours: 2, stage: 'submitted' }); await payroll(page)
  await chooseClosure(page)
  await preserved(page, artifactDir, 'new-submitted-row-blocks-close', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await cleanPayroll(page); await approve(page, ['MOCK-TIME-0003']); expected.hr.workflow.timeEntries.at(-1).status = 'approved'; await payroll(page)
  await chooseClosure(page)
  await preserved(page, artifactDir, 'approved-unconsumed-row-blocks-close', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await expect(closureForm(page).getByRole('alert')).toContainText(payrollStatusInventory.closure.unresolved)
  await cleanPayroll(page); await submitPayroll(page)
  expected = E.secondReceipt(E.fixtureA(seed.workspaces), { samePeriod: true })
  await chooseClosure(page); await button(closureForm(page), 'Preview period closure').click()
  await observe(page, artifactDir, 'closure', 'multiple', closurePreview(page).getByText('MOCK-PAYROLL-0002, MOCK-PAYROLL-0004', { exact: true }))
  await button(closurePreview(page), 'Confirm period closure').click(); E.closedTwoExact(expected)
  await exact(page, artifactDir, 'exact-window-captures-two-native-receipts', expected)
  checks.push('WX-0159: nonidentical submitted overlaps and both submitted/unapproved and approved/unconsumed inside rows block closure; two natively submitted exact-window receipts close together with exactly two immutable anchors in history order')
}

async function roundTrip(page, artifactDir, seed, expected, originalCombined) {
  await page.reload(); const before = await exact(page, artifactDir, 'recovery-refresh-P5', expected)
  await open(page, 'People & HR')
  const actual = await memory(page, artifactDir, 'recovery-individual-P5', expected)
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('old-HR-no-controls.json', nativeEnvelope(seed.workspaces.hr)))
  await button(backup(page), 'Replace HR workspace').click()
  await exact(page, artifactDir, 'recovery-old-HR-compatibility', { ...expected, hr: seed.workspaces.hr })
  await open(page, 'People & HR')
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('actual-new-HR-P5.json', actual))
  await button(backup(page), 'Replace HR workspace').click()
  const imported = await exact(page, artifactDir, 'recovery-new-HR-P5', expected)
  for (const [key, bytes] of Object.entries(before)) assert.equal(imported[key], bytes, `Old/new individual import preserves exact recovered full slot ${key}`)
  const proposed = { ...expected, hr: E.fixtureA(seed.workspaces).hr }
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('actual-P0-combined-select-HR-only.json', originalCombined))
  const preview = region(page, 'Selective restore preview')
  await preview.getByRole('checkbox', { name: /^Restore HR/ }).check()
  for (const module of ['CMS', 'CRM']) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) })).not.toBeChecked()
  await expect(preview).toContainText('payroll-control-0005')
  await expect(preview).not.toContainText(E.correctionReasons[3]); await expect(preview).not.toContainText('$260.00')
  await button(preview, 'Cancel combined restore').click(); assert.deepEqual(await slots(page), imported)
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('actual-P0-combined-select-HR-only.json', originalCombined))
  await preview.getByRole('checkbox', { name: /^Restore HR/ }).check()
  await observe(page, artifactDir, 'recovery', 'selected', button(preview, 'Restore selected workspaces'))
  await button(preview, 'Restore selected workspaces').click()
  const restored = await exact(page, artifactDir, 'recovery-selected-HR-P0', proposed)
  const point = assertHistoryAppend(imported[historyKey], restored[historyKey], { kind: 'restore', hr: expected.hr })
  for (const [key, bytes] of Object.entries(imported)) if (!['webappx.demo.hr', historyKey].includes(key)) assert.equal(restored[key], bytes, `Selected HR restore preserves unrelated byte slot ${key}`)
  const undoButton = region(page, 'Restore points').getByRole('button', { name: /^Undo restore point .* HR$/ })
  await expect(undoButton).toHaveCount(1); await undoButton.click()
  const undo = region(page, 'Undo preview'); await expect(undo).toContainText('Undo HR')
  await observe(page, artifactDir, 'recovery', 'undo', button(undo, 'Confirm undo'))
  await button(undo, 'Confirm undo').click()
  const after = await exact(page, artifactDir, 'recovery-Undo-exact-P5', expected)
  const undoPoint = assertHistoryAppend(restored[historyKey], after[historyKey], { kind: 'undo', hr: proposed.hr, sourcePointId: point.id })
  assert.deepEqual(Object.keys(after).sort(), Object.keys(imported).sort())
  for (const [key, bytes] of Object.entries(imported)) if (key !== historyKey) assert.equal(after[key], bytes, `Undo restores exact P5 and leaves all other slots ${key}`)
  await writeFile(join(artifactDir, 'recovery-history-proof.json'), JSON.stringify({ restorePoint: point, undoPoint, everyPriorPointPreserved: true, noPruning: true }, null, 2) + '\n')
}

export async function fractionalJourney(args) {
  const { page, artifactDir, seed, checks } = args
  let expected = await seedBrowser(args)
  await removeJordan(page, expected); await manager(page)
  await timeRow(page, 'time-001').getByLabel('Return reason for time-001', { exact: true }).fill('Fractional fixture review')
  await button(timeRow(page, 'time-001'), 'Return sample time').click()
  await employee(page, expected, avery, 'My time')
  async function edit(id, hours, workDate) {
    await button(timeRow(page, id), 'Edit draft').click()
    await page.getByLabel(`Work date for ${id}`, { exact: true }).fill(workDate)
    await page.getByRole('spinbutton', { name: `Hours for ${id}`, exact: true }).fill(hours)
    await button(timeRow(page, id), 'Save draft changes').click()
  }
  await edit('time-001', '0.125', '2026-10-09')
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-10')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('0.12')
  await button(page, 'Add sample time').click()
  await edit('MOCK-TIME-0001', '0.125', '2026-10-10'); await button(page, 'Submit own sample timesheet').click()
  await approve(page, ['time-001', 'MOCK-TIME-0001']); await payroll(page)
  await rate(page, avery, '30.04'); await submitPayroll(page)
  expected = E.fixtureF(seed.workspaces)
  await exact(page, artifactDir, 'fractional-native-original-751-cents', expected); await payroll(page)
  await close(page, artifactDir, expected, { reason: 'Freeze fractional sample period' })
  const closed = structuredClone(expected); E.closedA(closed); closed.hr.workflow.payrollControl.anchors[0].snapshot = structuredClone(E.originalF); closed.hr.workflow.payrollControl.events[0].reason = 'Freeze fractional sample period'
  await chooseCorrection(page)
  const event = E.correctedF(structuredClone(expected)).hr.workflow.payrollControl.events[1]
  await adjustment(page, artifactDir, event, { grossCents: 751, illustrativeWithholdingCents: 150, benefitDeductionCents: 0, netCents: 601 }, ['10.00', '1.00', '0.00'], { expected: closed, witness: 'fractional' })
  E.correctedF(expected); await exact(page, artifactDir, 'fractional-closed-corrected-complete-records', expected)
  checks.push('WX-0159/WX-0160: actual returned/editable 0.125+0.125-hour rows at $30.04 produce qualified 751-cent original (not752); closure and separate +249/-50/0/+299 correction retain both frozen fractional inputs and exact history')
  return { original: E.originalF, final: expected }
}
async function completeJordan(page, expected) {
  await employee(page, expected, jordan, 'My onboarding')
  for (const action of ['Review sample profile', 'Review sample job', 'Complete own profile Mark complete', 'Review onboarding summary', 'Confirm simulated onboarding']) await button(page, action).click()
  await employee(page, expected, jordan, 'My time'); await button(page, 'Submit own sample timesheet').click()
}
export async function scopedJourney(args) {
  const { page, artifactDir, seed, checks } = args
  let expected = await seedBrowser(args)
  await completeJordan(page, expected); await benefit(page, expected)
  await approve(page, ['time-001', 'time-002']); await payroll(page)
  await rate(page, avery, '30.00'); await rate(page, jordan, '40.00'); await submitPayroll(page)
  expected = E.fixtureM(seed.workspaces)
  await exact(page, artifactDir, 'two-employee-native-original-M', expected); await payroll(page)
  await chooseCorrection(page, 'MOCK-PAYROLL-0003', avery)
  const targetRaw = await correctionInputs(page, ['270.0', '50.00', '20.00'], 'Retained target change witness')
  const targetBefore = await slots(page)
  await correctionForm(page).getByRole('combobox', { name: /^Correction employee/ }).selectOption(jordan)
  await expect(dialog(page).getByRole('listitem')).toHaveText(['Fictional payroll correction'])
  await button(dialog(page), 'Keep editing').click(); await noDialog(page)
  await expect(correctionForm(page).getByRole('combobox', { name: /^Correction employee/ })).toHaveValue(avery); await assertRaw(page, targetRaw)
  assert.deepEqual(await slots(page), targetBefore)
  await correctionForm(page).getByRole('combobox', { name: /^Correction employee/ }).selectOption(jordan)
  await expect(dialog(page)).toBeVisible(); await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
  await expect(correctionForm(page).getByRole('combobox', { name: /^Correction employee/ })).toHaveValue(jordan)
  await expect(correctionField(page, 'Correction reason')).toHaveValue('')
  assert.deepEqual(await slots(page), targetBefore)
  for (let i = 0; i < E.correctionsM.length; i++) {
    const event = E.correctionsM[i]
    await chooseCorrection(page, 'MOCK-PAYROLL-0003', event.employeeId)
    await adjustment(page, artifactDir, event, event.previous, i === 0 ? ['270.00', '50.00', '20.00'] : ['260.00', '30.00', '0.00'], { expected })
    E.correctedM(expected, i + 1)
  }
  await exact(page, artifactDir, 'two-employee-separate-corrections-M', expected)
  await ownProjection(page, artifactDir, expected, avery, E.correctionsM[0], E.correctionsM[1], '$167.00')
  await ownProjection(page, artifactDir, expected, jordan, E.correctionsM[1], E.correctionsM[0], '$192.00')
  await payroll(page)
  const role = page.getByRole('combobox', { name: /^Synthetic management role/ })
  await role.selectOption('auditor'); expected.hr.managementRole = 'auditor'; await noDialog(page)
  await expect(page.getByRole('heading', { name: 'This preview role cannot open this page', exact: true })).toBeVisible()
  await hrPage(page, 'Management', 'Payroll history')
  await auditorProjection(page, artifactDir)
  await memory(page, artifactDir, 'auditor-complete-save-not-a-security-boundary', expected)
  await role.selectOption('hr-admin'); expected.hr.managementRole = 'hr-admin'; await noDialog(page)
  await expect(region(page, 'Sample payroll closures and corrections')).toHaveCount(0)
  await expect(button(page, 'Preview payroll correction')).toHaveCount(0)
  await role.selectOption('payroll-admin'); expected.hr.managementRole = 'payroll-admin'
  await expect(region(page, 'Sample payroll closures and corrections')).toBeVisible()
  await role.selectOption('employer-owner'); expected.hr.managementRole = 'employer-owner'
  await employee(page, expected, avery, 'My pay')
  await exact(page, artifactDir, 'two-nonempty-identities-all-roles-final', expected)
  checks.push('WX-0160: two natively paid employees have independent first-adjustment links; own views expose exactly their original/correction amounts and no other reason/amount in DOM/AX, auditor receives metadata only, HR admin receives no writer controls, payroll admin remains a native writer; complete local backup capability stays disclosed')
  return { original: E.originalM, final: expected }
}

// Region captions are deliberately scoped so legacy static payroll examples do
// not create a false whole-page compensation prohibition for the auditor.
async function ownProjection(page, artifactDir, expected, employeeId, own, foreign, originalNet) {
  await employee(page, expected, employeeId, 'My pay')
  const statement = page.getByRole('heading', { name: 'Your simulated pay receipts', exact: true }).locator('..')
  await expect(statement).toContainText(originalNet)
  const ownRegion = region(page, 'Own fictional payroll adjustments')
  await expect(ownRegion.getByRole('article')).toHaveCount(1)
  const article = ownRegion.getByRole('article'); await expect(article).toContainText(own.reason)
  await expect(article).toContainText(own.adjustmentReceipt); await expect(ownRegion).not.toContainText(foreign.reason)
  const html = await ownRegion.innerHTML(), ax = await ownRegion.ariaSnapshot()
  assert.ok(!html.includes(foreign.reason) && !ax.includes(foreign.reason))
  assert.ok(!html.includes(dollars(foreign.proposed.netCents)) && !ax.includes(dollars(foreign.proposed.netCents)))
  for (const [title, value, signed] of [['Immutable original amounts', own.previous, false], ['Previous cumulative balance', own.previous, false], ['Separate signed adjustment', own.delta, true], ['Cumulative balance after this adjustment', own.proposed, false]]) {
    const group = article.getByRole('heading', { name: title, exact: true }).locator('..')
    const labels = ['Fictional gross', 'Illustrative withholding', 'Sample benefit deductions', 'Fictional net']
    for (let i = 0; i < labels.length; i++) await expect(group.getByText(labels[i], { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText(dollars(value[moneyKeys[i]], signed))
  }
  await expect(article.getByRole('link', { name: own.originalReceipt, exact: true })).toHaveAttribute('href', `#employee-original-${own.originalReceipt}-${employeeId}`)
  if (employeeId === avery) await observe(page, artifactDir, 'scoped', 'own', ownRegion.getByRole('heading', { name: 'Your separate fictional payroll adjustments', exact: true }))
  await quality(page, artifactDir, `own-${employeeId}-correction-scope`, ownRegion)
  await capture(page, artifactDir, `own-${employeeId}-correction`, ownRegion)
}
async function auditorProjection(page, artifactDir) {
  const audit = region(page, 'Payroll control metadata')
  await expect(audit).toContainText('MOCK-PAYROLL-ADJUSTMENT-0001')
  await expect(audit).toContainText('MOCK-PAYROLL-ADJUSTMENT-0002')
  const html = await audit.innerHTML(), ax = await audit.ariaSnapshot()
  for (const text of ['Avery-only correction witness', 'Jordan-only correction witness', '$270.00', '$260.00', '$200.00', '$230.00', 'Avery Sample', 'Jordan Demo', 'grossCents', 'proposed', 'anchors']) assert.ok(!html.includes(text) && !ax.includes(text), `Auditor scoped DOM/AX must exclude ${text}`)
  await observe(page, artifactDir, 'scoped', 'auditor', audit.getByRole('heading', { name: 'Payroll control metadata', exact: true }))
  const table = region(page, 'Payroll control metadata table')
  await table.evaluate(element => { element.scrollLeft = element.scrollWidth })
  const lastColumn = table.getByRole('columnheader', { name: 'Recorded date', exact: true })
  await expect(lastColumn).toBeVisible()
  const containerBounds = await table.boundingBox(), columnBounds = await lastColumn.boundingBox()
  assert.ok(containerBounds && columnBounds && columnBounds.x >= containerBounds.x && columnBounds.x + columnBounds.width <= containerBounds.x + containerBounds.width + 1, 'Last metadata column is reachable inside its deliberate horizontal scroller')
  await quality(page, artifactDir, 'auditor-metadata-only', audit)
  await capture(page, artifactDir, 'auditor-metadata-only', audit)
}

async function importedCase(page, expected, name) {
  await discardControlForms(page, 'Portal directory')
  await importHr(page, expected.hr, { filename: `${name}.json` }); await payroll(page)
}
export function malformedPayrollImports(seed) {
  const valid = E.correctedA(E.fixtureA(seed))
  const cases = []
  function changed(name, edit) { const value = structuredClone(valid); edit(value.hr); cases.push([name, value.hr]) }
  changed('null-present-extension', hr => { hr.workflow.payrollControl = null })
  changed('wrong-extension-version', hr => { hr.workflow.payrollControl.schemaVersion = 2 })
  changed('empty-present-extension', hr => { hr.workflow.payrollControl = { schemaVersion: 1, sequence: 1, anchors: [], events: [] } })
  changed('forged-anchor-money', hr => { hr.workflow.payrollControl.anchors[0].snapshot.netCents++ })
  changed('forged-signed-delta', hr => { hr.workflow.payrollControl.events[1].delta.grossCents++ })
  changed('forged-predecessor', hr => { hr.workflow.payrollControl.events[2].previousAdjustmentId = null })
  changed('duplicate-event-identity', hr => { hr.workflow.payrollControl.events[2].id = 'payroll-control-0002' })
  changed('duplicate-adjustment-receipt', hr => { hr.workflow.payrollControl.events[2].adjustmentReceipt = 'MOCK-PAYROLL-ADJUSTMENT-0002' })
  changed('missing-anchored-original', hr => { hr.workflow.payrollHistory = [] })
  changed('orphan-consumed-time', hr => { hr.workflow.timeEntries[0].payrollReceipt = 'MOCK-PAYROLL-9999' })
  changed('duplicate-consumed-input', hr => { hr.workflow.payrollHistory[0].inputs.push(structuredClone(hr.workflow.payrollHistory[0].inputs[0])) })
  changed('overlapping-closure-event', hr => { const event = structuredClone(E.closureA); event.id = 'payroll-control-0006'; event.sequence = 6; event.period.end = '2026-10-16'; hr.workflow.payrollControl.events.push(event); hr.workflow.payrollControl.sequence = 7 })
  changed('partial-frozen-date-pair', hr => { delete hr.workflow.payroll.inputs[0].rateEffectiveFrom; delete hr.workflow.payrollHistory[0].inputs[0].rateEffectiveFrom })
  changed('unanchored-same-window-original', hr => {
    const added = E.secondReceipt(E.fixtureA(seed), { samePeriod: true }).hr.workflow
    hr.workflow.timeEntries = added.timeEntries; hr.workflow.payroll = added.payroll; hr.workflow.payrollHistory = added.payrollHistory; hr.workflow.sequence = 5
  })
  changed('event-bound-breach', hr => { hr.workflow.payrollControl.events = Array.from({ length: 251 }, () => structuredClone(E.closureA)); hr.workflow.payrollControl.sequence = 252 })
  return cases
}
export async function legacyJourney(args) {
  const { page, artifactDir, seed, checks } = args
  await seedBrowser(args)
  let expected = E.periodlessA(seed.workspaces)
  await importedCase(page, expected, 'declared-periodless-known-date-LK')
  await expect(closureForm(page).getByRole('combobox', { name: /^Submitted period/ }).locator('option')).toHaveCount(1)
  await chooseCorrection(page)
  const raw = await correctionInputs(page, E.correctionRaw[0], E.correctionReasons[0], '2026-09-30')
  await preserved(page, artifactDir, 'LK-preview-no-inferred-period-floor', expected, async () => { await button(correctionForm(page), 'Preview payroll correction').click() })
  await observe(page, artifactDir, 'correction', 'unknownPeriod', correctionPreview(page).getByText(payrollStatusInventory.correction.unknownPeriod, { exact: true }))
  await assertRaw(page, raw); await button(correctionPreview(page), 'Confirm fictional payroll correction').click()
  E.correctedOpenA(expected, '2026-09-30'); await exact(page, artifactDir, 'declared-LK-correction-unknown-period-preserved', expected)
  expected = E.periodlessA(seed.workspaces, { unknownWorkDate: true })
  await importedCase(page, expected, 'declared-periodless-unknown-consumed-date-LU')
  await preserved(page, artifactDir, 'LU-unavailable-choice-no-date-repair', expected, async () => {
    await expect(correctionForm(page).getByRole('combobox', { name: /^Original receipt/ }).locator('option')).toHaveCount(1)
    await expect(correctionForm(page).getByRole('combobox', { name: /^Original receipt/ })).toHaveValue('')
    await button(correctionForm(page), 'Preview payroll correction').click()
    await expect(correctionForm(page).getByRole('alert')).toContainText('Choose an available original submitted receipt.')
  })
  await expect(correctionPreview(page)).toHaveCount(0)
  const unsupported = ['MOCK-PAYROLL-0000', 'MOCK-PAYROLL-2', 'MOCK-PAYROLL-00002', 'LEGACY-TEXT']
  for (let i = 0; i < unsupported.length; i++) {
    expected = E.periodlessA(seed.workspaces, { receipt: unsupported[i] })
    await importedCase(page, expected, `declared-readable-unsupported-receipt-${i}`)
    await preserved(page, artifactDir, `unsupported-canonical-receipt-${i}`, expected, async () => {
      await expect(correctionForm(page).getByRole('combobox', { name: /^Original receipt/ }).locator('option')).toHaveCount(1)
      await expect(correctionForm(page).getByRole('combobox', { name: /^Original receipt/ })).toHaveValue('')
      await expect(page.getByRole('heading', { name: 'Run a simulated payroll', exact: true }).locator('..')).toContainText(unsupported[i])
    })
    if (i === 0) await observe(page, artifactDir, 'correction', 'unsupported', correctionForm(page).getByRole('combobox', { name: /^Original receipt/ }))
  }
  expected = E.secondReceipt(E.periodlessA(seed.workspaces), { samePeriod: true })
  await importedCase(page, expected, 'declared-LK-plus-explicit-window-conflict')
  await chooseClosure(page, E.closureA.reason, 'MOCK-PAYROLL-0004')
  await preserved(page, artifactDir, 'known-periodless-date-conflicts-with-explicit-window', expected, async () => { await button(closureForm(page), 'Preview period closure').click() })
  await observe(page, artifactDir, 'closure', 'periodlessConflict', closureForm(page).getByRole('alert'))
  expected = E.secondReceipt(E.fixtureA(seed.workspaces), { samePeriod: true, receipt: 'MOCK-PAYROLL-ADJUSTMENT-0002' })
  await importedCase(page, expected, 'declared-separate-ordinary-namespace-collision')
  await chooseCorrection(page)
  await adjustment(page, artifactDir, E.openCorrection, E.originalMoneyA, E.correctionRaw[0], { expected })
  E.correctedOpenA(expected)
  await correctionInputs(page, E.correctionRaw[1], E.correctionReasons[1])
  await preserved(page, artifactDir, 'generated-adjustment2-collides-with-unrelated-ordinary-receipt', expected, async () => { await button(correctionForm(page), 'Preview payroll correction').click() })
  await observe(page, artifactDir, 'correction', 'namespace', correctionForm(page).getByRole('alert'))
  checks.push('WX-0159/WX-0160 declared import compatibility: periodless known-date original corrects with unknown period and explicit Sep30 date; unknown consumed dates and four unsupported receipt spellings stay readable/exportable but are unavailable as actionable choices (primitive qualification refusal belongs to focused core tests); known-date periodless overlap and an unrelated ordinary adjustment-namespace collision refuse without repair or writes')

  expected = E.correctedA(E.fixtureA(seed.workspaces))
  await importedCase(page, expected, 'declared-valid-control-P5-import-refusal-baseline')
  const before = await slots(page)
  for (const [name, hr] of malformedPayrollImports(seed.workspaces)) {
    await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload(`malformed-control-${name}.json`, nativeEnvelope(hr)))
    await expect(backup(page).getByRole('alert')).toBeVisible()
    await expect(button(backup(page), 'Replace HR workspace')).toHaveCount(0)
    assert.deepEqual(await slots(page), before, `${name}: malformed present extension refuses atomically before any save/history write`)
  }
  await memory(page, artifactDir, 'all-malformed-imports-preserve-complete-P5', expected)
  await capture(page, artifactDir, 'malformed-present-control-import-refused', backup(page))
  checks.push('Strict actual JSON import boundary: 15 independent malformed present-control fixtures (anchor/delta/predecessor/ID/link/overlap/partial dates/forgotten exact-window receipt/bounds) refuse the whole replacement, preserving complete accepted P5 memory and every raw slot')
  return { declaredCompatibilityFixtures: 8, malformedRefusals: malformedPayrollImports(seed.workspaces).map(([name]) => name), final: expected }
}

function assertCheckpoint(beforeRaw, afterRaw, hr, kind, label) {
  const before = JSON.parse(beforeRaw), after = JSON.parse(afterRaw)
  assert.deepEqual(Object.keys(after).sort(), ['points', 'schemaVersion']); assert.equal(after.schemaVersion, 1)
  assert.equal(after.points.length, before.points.length + 1); assert.deepEqual(after.points.slice(1), before.points)
  const point = after.points[0]
  assert.deepEqual(Object.keys(point).sort(), ['createdAt', 'id', 'kind', 'label', 'modules', 'states'])
  assert.match(point.id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/); assert.equal(new Date(point.createdAt).toISOString(), point.createdAt)
  assert.equal(point.kind, kind); assert.equal(point.label, label); assert.deepEqual(point.modules, ['hr']); assert.deepEqual(point.states, { hr })
  return point
}
export async function storageFaultJourney(args) {
  const { page, artifactDir, seed, checks } = args
  // This fixture replaces only the Storage platform write boundary. Domain
  // state enters exclusively through rendered JSON file controls below.
  await page.addInitScript(() => {
    const native = Storage.prototype.setItem
    const fault = { mode: '', historyAttempts: 0, hrAttempts: 0 }
    Object.defineProperty(window, '__payrollStorageFault', { value: fault })
    Storage.prototype.setItem = function (key, value) {
      if (fault.mode === 'history' && key === 'webappx.demo.restore-points') { fault.historyAttempts++; throw new DOMException('Declared payroll history-write platform fault', 'QuotaExceededError') }
      if (fault.mode === 'hr' && key === 'webappx.demo.hr') { fault.hrAttempts++; throw new DOMException('Declared payroll HR-save platform fault', 'QuotaExceededError') }
      return native.call(this, key, value)
    }
  })
  await seedBrowser(args)
  let expected = E.correctedA(E.fixtureA(seed.workspaces))
  await importHr(page, expected.hr, { filename: 'declared-valid-P5-for-platform-fault.json' })
  const importPref = backup(page).getByRole('checkbox', { name: 'Require checkpoint before individual imports', exact: true })
  const resetPref = backup(page).getByRole('checkbox', { name: 'Require checkpoint before Reset', exact: true })
  await importPref.check(); await resetPref.check()
  let before = await slots(page)
  await page.evaluate(() => { window.__payrollStorageFault.mode = 'history' })
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('denied-required-import-P0.json', nativeEnvelope(E.fixtureA(seed.workspaces).hr)))
  const checkpoint = region(page, 'Required checkpoint preview')
  await observe(page, artifactDir, 'recovery', 'required', checkpoint.getByText('New checkpoint', { exact: true }))
  await button(backup(page), 'Replace HR workspace').click()
  const refused = backup(page).getByRole('alert').filter({ hasText: /checkpoint|history/i })
  await expect(refused).toContainText('The current in-memory workspace remains open; no replacement was accepted.')
  await observe(page, artifactDir, 'recovery', 'refused', refused)
  assert.deepEqual(await slots(page), before); await memory(page, artifactDir, 'required-import-fault-complete-P5', expected)
  await button(backup(page), 'Cancel import').click()
  await button(page, 'Reset sample changes').click()
  const reset = region(page, 'HR Reset confirmation')
  await button(reset, 'Confirm Reset HR').click(); await expect(reset).toBeVisible()
  assert.deepEqual(await slots(page), before); await memory(page, artifactDir, 'required-Reset-fault-complete-P5', expected)
  await button(reset, 'Keep HR workspace').click()
  const failedAttempts = await page.evaluate(() => ({ ...window.__payrollStorageFault }))
  assert.ok(failedAttempts.historyAttempts >= 2); assert.equal(failedAttempts.hrAttempts, 0)
  await page.evaluate(() => { window.__payrollStorageFault.mode = '' })
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('accepted-required-import-P0.json', nativeEnvelope(E.fixtureA(seed.workspaces).hr)))
  await button(backup(page), 'Replace HR workspace').click()
  const afterImport = await slots(page)
  const point = assertCheckpoint(before[historyKey], afterImport[historyKey], expected.hr, 'import', 'Before HR individual import')
  expected = E.fixtureA(seed.workspaces)
  await memory(page, artifactDir, 'required-import-success-complete-P0', expected)
  for (const [key, bytes] of Object.entries(before)) if (!['webappx.demo.hr', historyKey].includes(key)) assert.equal(afterImport[key], bytes)
  await resetPref.uncheck(); before = await slots(page)
  await button(page, 'Reset sample changes').click()
  await expect(region(page, 'HR Reset confirmation')).toHaveCount(0)
  const afterReset = await slots(page)
  assert.equal(Object.hasOwn(afterReset, 'webappx.demo.hr'), false)
  for (const [key, bytes] of Object.entries(before)) if (key !== 'webappx.demo.hr') assert.equal(afterReset[key], bytes)
  expected = structuredClone(seed.workspaces)
  await memory(page, artifactDir, 'default-reset-absent-controls-and-seed', expected)
  checks.push('Payroll recovery platform fault: required import and Reset refuse before live replacement when history writes fail; all complete P5 memory/slots stay exact; removing only the fault permits one exact required pre-import checkpoint, and default-off Reset restores seed/control absence without affecting other portals/history/preferences')

  await importPref.uncheck()
  await importHr(page, E.fixtureA(seed.workspaces).hr, { filename: 'declared-valid-P0-for-quota-fault.json' })
  expected = E.fixtureA(seed.workspaces); await payroll(page); await chooseCorrection(page)
  await correctionInputs(page, E.correctionRaw[0], E.correctionReasons[0]); await button(correctionForm(page), 'Preview payroll correction').click()
  before = await slots(page)
  await page.evaluate(() => { window.__payrollStorageFault.mode = 'hr'; window.__payrollStorageFault.hrAttempts = 0 })
  await button(correctionPreview(page), 'Confirm fictional payroll correction').click(); E.correctedOpenA(expected)
  assert.deepEqual(await slots(page), before, 'One accepted memory action under quota denial must retain the exact prior raw save and every unrelated byte')
  await observe(page, artifactDir, 'recovery', 'memory', page.getByRole('status').filter({ hasText: payrollStatusInventory.recovery.memory }))
  await memory(page, artifactDir, 'accepted-memory-only-correction-export', expected)
  await memory(page, artifactDir, 'second-export-no-auto-save-retry', expected)
  const attempts = await page.evaluate(() => ({ ...window.__payrollStorageFault }))
  assert.equal(attempts.hrAttempts, 1, 'Exactly one explicit accepted action attempts one save; exports must not retry')
  await expect(correctionForm(page).getByRole('status')).toHaveText('Fictional payroll control accepted in memory. Check the browser storage notice before refreshing.')
  checks.push('Payroll quota fault: one correction accepts once in memory with the exact immutable original and separate event1; generic memory-only warning and complete exports are truthful, only one save is attempted, and the previous full raw save remains unchanged without an automatic retry or durability claim')
  return { fault: 'Only Storage.prototype.setItem history/HR save writes are explicitly denied', checkpoint: point, attempts, finalMemory: expected, rawSavedBeforeMemoryOnlyAction: before }
}

async function filePaths(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filePaths(path)); else if (entry.isFile()) result.push(path)
  }
  return result.sort()
}
const sha256 = value => createHash('sha256').update(value).digest('hex')
async function bindings(paths, base) { return Object.fromEntries(await Promise.all(paths.map(async path => [relative(base, path), sha256(await readFile(path))]))) }

/** Existing eight-check regression plus five fresh isolated contexts, all mutations through native product controls.
 * Reads of complete save bytes are assertions, never a state-injection fixture. */
export async function runPayrollSuite({ browser, origin, artifactDir, seed }) {
  const repository = process.cwd(), runtimePaths = await filePaths(join(repository, 'src')), runtimeBefore = await bindings(runtimePaths, repository)
  const checks = [], problems = [], warnings = [], evidence = {}, qualityEvidence = {}, contexts = []
  async function run(name, journey) {
    let context, page, failure
    const directory = join(artifactDir, name); await mkdir(directory)
    const cleanup = { name, contextClosed: false, traceSaved: false }
    contexts.push(cleanup)
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
      evidence[name] = await journey({ page, context, origin, artifactDir: directory, seed, checks })
      qualityEvidence[name] = evidenceFor(page)
      await page.screenshot({ path: join(directory, 'final.png'), fullPage: true })
    } catch (error) {
      failure = error
      await writeFile(join(directory, 'failure.json'), JSON.stringify({ lane: name, message: error.message, stack: error.stack }, null, 2) + '\n').catch(() => {})
      if (page && !page.isClosed()) await page.screenshot({ path: join(directory, 'failure.png'), fullPage: true, timeout: 5000 }).catch(() => {})
      throw error
    } finally {
      if (page) qualityEvidence[name] = evidenceFor(page)
      const errors = []
      if (context) {
        try { await context.tracing.stop({ path: join(directory, 'trace.zip') }); cleanup.traceSaved = true } catch (error) { errors.push(error.message) }
        try { await context.close(); cleanup.contextClosed = true } catch (error) { errors.push(error.message) }
      }
      if (errors.length) { cleanup.errors = errors; if (failure) failure.artifactErrors = errors; else throw new Error(`${name}: context cleanup failed: ${errors.join('; ')}`) }
    }
  }
  const legacyDirectory = join(artifactDir, 'legacy-eight'); await mkdir(legacyDirectory)
  const legacyCleanup = { name: 'legacy-eight', contextClosed: false, traceSaved: false }; contexts.push(legacyCleanup)
  const legacyRun = runPayrollLifecycle({ browser, origin, artifactDir: legacyDirectory, seed }).then(async result => {
    assert.equal(result.checks.length, 8, 'The existing complete eight-check payroll journey remains required')
    assert.ok((await readFile(join(legacyDirectory, 'trace.zip'))).length > 0)
    legacyCleanup.contextClosed = true; legacyCleanup.traceSaved = true
    checks.push(...result.checks); warnings.push(...result.warnings); evidence.legacy = result; return result
  }).catch(async error => { await writeFile(join(legacyDirectory, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, partial: error.smokeEvidence }, null, 2) + '\n'); throw error })
  const results = await Promise.allSettled([legacyRun, ...([['native-A', nativeAJourney], ['fractional-F', fractionalJourney], ['scoped-M', scopedJourney], ['declared-imports', legacyJourney], ['platform-faults', storageFaultJourney]].map(([name, journey]) => run(name, journey)))])
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
  const observations = Object.entries(qualityEvidence).flatMap(([lane, item]) => item.statuses.map(value => ({ ...value, capture: `${lane}/${value.capture}` })))
  const statusCoverage = auditStatusCoverage(payrollStatusFamilies, observations)
  await writeFile(join(artifactDir, 'payroll-control-status-coverage.json'), JSON.stringify({ inventory: payrollStatusInventory, sources: payrollStatusSources, coverage: statusCoverage, observations, scope: 'New native payroll-control meanings only; separate from legacy native151, lifecycle46, recruiting42 and selected SDK status inventories. Actual UI at 390px, 20px root text; no render fixtures.' }, null, 2) + '\n')
  await writeFile(join(artifactDir, 'payroll-control-quality.json'), JSON.stringify({ viewport: { width: 390, height: 844 }, textSize: '20px', qualityEvidence, contexts }, null, 2) + '\n')
  try {
    assert.deepEqual(await bindings(await filePaths(join(repository, 'src')), repository), runtimeBefore, 'Complete runtime source must remain frozen throughout this browser suite')
    if (!failures.length) assert.deepEqual(statusCoverage.missing, [], 'Every explicit new status requires its own actual uncovered monochrome witness')
  } catch (error) { failures.push(error) }
  if (!failures.length) checks.push(`Payroll control status inventory: ${statusCoverage.expected} literal meanings have actual uncovered monochrome witnesses at 390px/x-large20px`, 'Payroll control accessibility: actual visible names, exact retained raw inputs, strict Tab/native-date focus, distinct multi-adjustment scopes and scoped own/auditor DOM/AX checked at390px/x-large20px')
  await writeFile(join(artifactDir, 'payroll-control-evidence.json'), JSON.stringify({ checks, problems, warnings: [...new Set(warnings)], evidence, contexts, failures: failures.map(error => error.message) }, null, 2) + '\n')
  const harnessPaths = ['scripts/browser-payroll.mjs', 'tests/browser/payroll-lifecycle.mjs', 'tests/browser/payroll-control.mjs', 'tests/browser/payroll-control-expected.mjs', 'tests/browser/payroll-control-status-inventory.mjs', 'tests/browser/payroll-control-harness.test.mjs', 'tests/browser/keyboard-driver.mjs', 'tests/browser/portal-quality.mjs', 'tests/browser/portals-smoke.mjs', 'tests/browser/seed-contract.mjs', 'scripts/browser-smoke.mjs', 'scripts/browser-preview-process.mjs', 'scripts/browser-preview-worker.mjs', 'package-lock.json']
  const artifacts = await bindings((await filePaths(artifactDir)).filter(path => !relative(artifactDir, path).startsWith('vite-cache/') && !['report.json', 'payroll-control-manifest.json'].includes(path.split('/').at(-1))), artifactDir)
  const manifest = { algorithm: 'sha256', hashMode: 'exact bytes; runtime before/after equality; self-referential report/manifest and Vite generated cache excluded', runtime: runtimeBefore, harness: await bindings(harnessPaths.map(path => join(repository, path)), repository), artifacts }
  const bytes = JSON.stringify(manifest, null, 2) + '\n'; await writeFile(join(artifactDir, 'payroll-control-manifest.json'), bytes)
  const receipt = { file: 'payroll-control-manifest.json', sha256: sha256(bytes), runtimeFiles: runtimePaths.length, harnessFiles: harnessPaths.length, artifacts: Object.keys(artifacts).length }
  const result = { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, coveredItems: coveredPayrollControlItems, manifest: receipt, statusCoverage, contexts, payrollControlEvidence: evidence, qualityEvidence, limits: 'Account-free native local simulation and Chromium evidence only. No provider/account, production, Windows, device or manual screen-reader acceptance.' }
  if (failures.length || problems.length) { const error = failures[0] ?? new Error(problems.join('\n')); error.smokeEvidence = { ...result, problems, laneFailures: failures.map(item => item.message) }; throw error }
  return result
}
