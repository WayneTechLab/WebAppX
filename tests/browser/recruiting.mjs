import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { assertRetainedControl, auditStatusCoverage, auditVisibleControls } from './portal-quality.mjs'
import { recruitingStatusInventory, recruitingStatusSources, recruitingStatusFamilies } from './recruiting-status-inventory.mjs'
import * as expectedRecords from './recruiting-expected.mjs'

const { times } = expectedRecords
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const region = (scope, name) => scope.getByRole('region', { name, exact: true })
const form = (scope, name) => scope.getByRole('form', { name, exact: true })
const application = (page, id) => page.getByRole('article', { name: `Recruiting application ${id}`, exact: true })
const backup = page => region(page, 'HR workspace backup')
const combined = page => region(page, 'Combined workspace backup')
const historyKey = 'webappx.demo.restore-points'
const dialog = page => page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
const upload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
const nativeEnvelope = data => ({ format: 'webappx-mock-workspace', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', module: 'hr', data })
const combinedEnvelope = workspaces => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces })
const qualityRecords = new WeakMap()
function evidenceFor(page) { if (!qualityRecords.has(page)) qualityRecords.set(page, { statuses: [], controls: [], measurements: [], boundaries: [] }); return qualityRecords.get(page) }
export const coveredRecruitingItems = Object.freeze(['WX-0201', 'WX-0202', 'WX-0203', 'WX-0204', 'WX-0205', 'WX-0206', 'WX-0207', 'WX-0208', 'WX-0209', 'WX-0210'])

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
async function recruiting(page) { await hrPortal(page, 'Management'); await hrPage(page, 'Management', 'Recruiting') }
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
async function observe(page, artifactDir, family, state, locator) {
  const literal = recruitingStatusInventory[family]?.[state]
  assert.ok(literal, `Unknown recruiting status ${family}/${state}`)
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
  if (!samples.every(sample => sample.uncovered)) await capture(page, artifactDir, `${name}-OCCLUDED`, locator)
  assert.ok(samples.every(sample => sample.uncovered), `${family}/${state}: actual status must remain uncovered`)
  await capture(page, artifactDir, name, locator); assert.equal(await locator.innerText(), text)
  evidenceFor(page).statuses.push({ family, state, literal, text, bounds, samples, source: recruitingStatusSources[family], capture: `${name}-monochrome.png`, mode: 'actual native UI action; style-only monochrome capture' })
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
export function assertCompleteWorkspaces(actual, expected, name = 'Recruiting journey') { assert.deepEqual(actual, expected, `${name}: complete exports must equal handwritten expected records`) }
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
async function adopt(page, expected, artifactDir, { witness = false } = {}) {
  const target = form(page, 'Recruiting adoption'), recorded = target.getByRole('textbox', { name: /^Recorded UTC time/ })
  await recorded.fill(times.adoption)
  const before = await slots(page)
  await button(target, 'Preview recruiting adoption').click()
  let preview = region(page, 'Recruiting adoption preview')
  assert.deepEqual(await slots(page), before, 'Adoption preview must not write')
  if (witness) {
    await observe(page, artifactDir, 'adoption', 'preview', preview.getByRole('status'))
    await quality(page, artifactDir, 'adoption-preview', target, button(preview, 'Confirm recruiting adoption'), [[recorded, times.adoption]])
    await button(preview, 'Cancel recruiting adoption preview').click()
    await observe(page, artifactDir, 'adoption', 'canceled', region(page, 'Adopt recruiting lifecycle').getByRole('status'))
    assert.deepEqual(await slots(page), before); await expect(recorded).toHaveValue(times.adoption)
    await button(target, 'Preview recruiting adoption').click(); preview = region(page, 'Recruiting adoption preview')
  }
  await button(preview, 'Confirm recruiting adoption').click(); expectedRecords.adopted(expected.hr); await noDialog(page)
}
async function legacyPublish(page, expected) { await button(page, 'Publish sample job').click(); expectedRecords.legacyPublished(expected.hr) }
async function legacyHire(page, expected) {
  await button(page.getByLabel('Fictional candidate list', { exact: true }), /^Casey Fiction/).click()
  for (const name of ['Begin screening', 'Move to interview', 'Prepare sample offer', 'Hire into mock onboarding']) await button(page, name).click()
  expectedRecords.legacyCaseyHired(expected.hr)
}
async function move(page, expected, id, stage, at, artifactDir, witness = false) {
  const card = application(page, id), detail = card.locator('details').filter({ has: page.getByText(`Manage application ${id}`, { exact: true }) })
  if (await detail.getAttribute('open') === null) await card.getByText(`Manage application ${id}`, { exact: true }).click()
  const target = form(card, `Stage change for application ${id}`), previous = expected.hr.recruiting.lifecycle.applications.find(app => app.id === id).stage
  await target.getByRole('textbox', { name: /^Recorded UTC time/ }).fill(at)
  await button(target, `Preview move to ${stage}`).click()
  await button(region(card, `Application ${id} stage preview`), `Confirm move to ${stage}`).click()
  expectedRecords.expectedStage(expected.hr, id, previous, stage, at)
  if (witness) await observe(page, artifactDir, 'application', stage, card.locator('header p').filter({ hasText: `Application stage: ${stage}` }))
}
async function endApplication(page, expected, id, outcome, reason, at, artifactDir, { requireReason = false, witness = false } = {}) {
  const card = application(page, id), summary = card.getByText(`Manage application ${id}`, { exact: true })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
  const target = form(card, `Terminal outcome for application ${id}`), section = region(card, `End application ${id}`)
  await target.getByRole('combobox', { name: 'Terminal application outcome', exact: true }).selectOption(outcome)
  await target.getByRole('textbox', { name: /^Recorded UTC time/ }).fill(at)
  const verb = outcome === 'rejected' ? 'rejection' : 'withdrawal'
  if (requireReason) {
    await target.getByRole('textbox', { name: 'Sample outcome reason', exact: true }).fill('   ')
    const before = await slots(page); await button(target, `Preview ${verb}`).click()
    await observe(page, artifactDir, 'application', 'reasonRequired', section.getByRole('alert')); assert.deepEqual(await slots(page), before)
  }
  await target.getByRole('textbox', { name: 'Sample outcome reason', exact: true }).fill(reason)
  await button(target, `Preview ${verb}`).click()
  const preview = region(card, `Application ${id} outcome preview`)
  await expect(preview).toContainText(reason)
  if (witness) await quality(page, artifactDir, `application-${outcome}-reason`, target, button(preview, `Confirm ${verb}`), [[target.getByRole('textbox', { name: 'Sample outcome reason', exact: true }), reason]])
  await button(preview, `Confirm ${verb}`).click()
  expectedRecords.expectedStage(expected.hr, id, expected.hr.recruiting.lifecycle.applications.find(app => app.id === id).stage, outcome, at, reason)
  if (witness) await observe(page, artifactDir, 'application', outcome, card.getByRole('status'))
  await expect(card).toContainText(`Sample ${outcome} reason: ${reason}`)
  await expect(card.getByRole('form')).toHaveCount(0)
}
async function requisitionAction(page, label, artifactDir, witness = false) {
  const target = form(page, label)
  await target.getByRole('textbox', { name: /^Recorded sample time \(UTC\)/ }).fill(times.adoption)
  await button(target, `Preview ${label.toLowerCase()}`).click()
  const preview = region(target, 'Requisition and job action preview')
  if (witness) {
    await observe(page, artifactDir, 'requisition', 'preview', preview.getByRole('heading', { name: 'Review fictional recruiting action', exact: true }))
    await quality(page, artifactDir, 'requisition-preview', target, button(preview, 'Confirm fictional recruiting action'))
  }
  await button(preview, 'Confirm fictional recruiting action').click()
}
async function requestReview(page, expected, artifactDir) { await requisitionAction(page, 'Request review for rrequisition-0001', artifactDir); expectedRecords.requisitionRequested(expected.hr) }
async function reviewRequisition(page, expected, outcome, artifactDir) {
  const target = form(page, 'Review requisition rrequisition-0001')
  await target.getByRole('combobox', { name: 'Requisition review outcome', exact: true }).selectOption(outcome)
  await target.getByRole('textbox', { name: 'Requisition review reason', exact: true }).fill(outcome === 'approved' ? 'Fictional plan approved.' : 'Fictional plan needs review.')
  await requisitionAction(page, 'Review requisition rrequisition-0001', artifactDir)
  expectedRecords.requisitionReviewed(expected.hr, outcome)
}

export async function requisitionJourney(args) {
  const { page, artifactDir, checks } = args, expected = await seedBrowser(args)
  await recruiting(page); await legacyPublish(page, expected); await adopt(page, expected, artifactDir, { witness: true })
  await observe(page, artifactDir, 'adoption', 'legacy', page.getByRole('article', { name: 'Publication for job job-001', exact: true }).locator('p').filter({ hasText: 'Legacy publication; no recorded approval' }))
  const create = form(page, 'Create sample requisition')
  await create.getByRole('textbox', { name: 'Requisition department', exact: true }).fill('Research')
  await create.getByRole('combobox', { name: 'Requisition owner', exact: true }).selectOption('employee-002')
  await create.getByRole('spinbutton', { name: /^Planning headcount/ }).fill('1')
  await requisitionAction(page, 'Create sample requisition', artifactDir, true); expectedRecords.requisitionDraft(expected.hr)
  const req = page.getByRole('article', { name: 'Requisition rrequisition-0001', exact: true })
  await observe(page, artifactDir, 'requisition', 'draft', req.getByRole('heading', { level: 4 }))
  await requestReview(page, expected, artifactDir); await observe(page, artifactDir, 'requisition', 'requested', req.getByRole('heading', { level: 4 }))
  await reviewRequisition(page, expected, 'rejected', artifactDir); await observe(page, artifactDir, 'requisition', 'rejected', req.getByRole('heading', { level: 4 }))
  await requestReview(page, expected, artifactDir); await reviewRequisition(page, expected, 'approved', artifactDir)
  await observe(page, artifactDir, 'requisition', 'approved', req.getByRole('heading', { level: 4 }))
  const job = form(page, 'Create requisition-backed job')
  await job.getByRole('combobox', { name: 'Approved requisition', exact: true }).selectOption('rrequisition-0001')
  await job.getByRole('textbox', { name: 'Sample job title', exact: true }).fill('Fictional research specialist')
  await job.getByRole('textbox', { name: /^Approved job department/ }).fill('Research')
  await job.getByRole('combobox', { name: 'Sample hiring manager', exact: true }).selectOption('employee-001')
  await requisitionAction(page, 'Create requisition-backed job', artifactDir); expectedRecords.researchJobCreated(expected.hr)
  const pub = page.getByRole('article', { name: 'Publication for job rjob-0002', exact: true })
  await observe(page, artifactDir, 'publication', 'draft', pub.getByRole('heading', { level: 4 }))
  await requisitionAction(page, 'Publish sample job rjob-0002', artifactDir); expectedRecords.researchJobPublished(expected.hr)
  await observe(page, artifactDir, 'publication', 'published', pub.getByRole('heading', { level: 4 }))
  await exact(page, artifactDir, '01-requisition-approval-publication-captures', expected)
  checks.push('WX-0201/WX-0202: actual requisition draft -> review request -> reasoned rejection -> renewed request -> immutable approval -> separately owned job publication; complete captures and legacy bytes match independent literals')
  await recruiting(page)
  const person = form(page, 'Create recruiting person and application')
  await person.getByRole('textbox', { name: 'Fictional first name', exact: true }).fill('Devon')
  await person.getByRole('textbox', { name: 'Fictional last name', exact: true }).fill('Browser')
  await person.getByRole('textbox', { name: /^Fictional work email/ }).fill('devon.browser@example.invalid')
  await person.getByRole('combobox', { name: 'Application job', exact: true }).selectOption('rjob-0002')
  await person.getByRole('textbox', { name: /^Recorded UTC time/ }).fill(times.applied)
  await button(person, 'Preview new person and application').click(); await button(region(page, 'New person and application preview'), 'Confirm new person and application').click(); expectedRecords.devonCreated(expected.hr)
  const beforeConflict = await slots(page)
  await person.getByRole('textbox', { name: 'Fictional first name', exact: true }).fill('Different')
  await person.getByRole('textbox', { name: 'Fictional last name', exact: true }).fill('Name')
  await person.getByRole('textbox', { name: /^Fictional work email/ }).fill('devon.browser@example.invalid')
  await person.getByRole('combobox', { name: 'Application job', exact: true }).selectOption('job-001')
  await person.getByRole('textbox', { name: /^Recorded UTC time/ }).fill(times.separate)
  await button(person, 'Preview new person and application').click()
  await observe(page, artifactDir, 'application', 'conflict', region(page, 'Recruiting identity conflict').getByRole('heading'))
  assert.deepEqual(await slots(page), beforeConflict, 'Conflict preview cannot create or merge a person/application')
  await button(region(page, 'Recruiting identity conflict'), 'Choose existing person for a separate application').click()
  await button(person, 'Discard new person draft').click()
  const separate = form(page, 'Create separate recruiting application')
  await expect(separate.getByRole('combobox', { name: 'Existing recruiting person', exact: true })).toHaveValue('rperson-0003')
  await button(separate, 'Preview separate application').click(); await button(region(page, 'Separate application preview'), 'Confirm separate application').click(); expectedRecords.devonSeparate(expected.hr)
  await observe(page, artifactDir, 'application', 'separate', application(page, 'rapplication-0004').locator('header p').first())
  await move(page, expected, 'rapplication-0003', 'screening', times.screening, artifactDir, true)
  await move(page, expected, 'rapplication-0003', 'interview', times.interview, artifactDir, true)
  await move(page, expected, 'rapplication-0003', 'offer', times.offer, artifactDir, true)
  await endApplication(page, expected, 'rapplication-0003', 'rejected', 'Fictional application rejected after review.', times.final, artifactDir, { requireReason: true, witness: true })
  assert.equal(expected.hr.recruiting.lifecycle.applications[3].stage, 'applied')
  await expect(application(page, 'rapplication-0004')).toContainText('Application stage: applied')
  await endApplication(page, expected, 'rapplication-0004', 'withdrawn', 'Fictional applicant withdrew this separate application.', times.final, artifactDir, { witness: true })
  const observation = region(page, 'Explicit application duration observation'), beforeObservation = await slots(page)
  await button(observation, 'Apply duration observation').click(); await observe(page, artifactDir, 'duration', 'omitted', observation.getByRole('status'))
  const legacyTable = page.getByRole('table', { name: 'Stage timing for rapplication-0001', exact: true })
  await observe(page, artifactDir, 'duration', 'unknown', legacyTable.getByRole('cell', { name: 'Unknown legacy duration', exact: true }))
  await observation.getByRole('textbox', { name: 'Optional observation UTC time', exact: true }).fill(times.observation)
  await button(observation, 'Apply duration observation').click(); await observe(page, artifactDir, 'duration', 'explicit', observation.getByRole('status'))
  const table = page.getByRole('table', { name: 'Stage timing for rapplication-0003', exact: true })
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent))), [
    ['applied', times.applied, times.screening, '7200000 ms', 'known'], ['screening', times.screening, times.interview, '3600000 ms', 'known'], ['interview', times.interview, times.offer, '3600000 ms', 'known'], ['offer', times.offer, times.final, '3600000 ms', 'known'], ['rejected', times.final, 'Open stage', '3600000 ms', 'open'],
  ], 'Actual table durations use literal per-application boundaries, never current clock or private scorecard times')
  await observe(page, artifactDir, 'duration', 'closed', table.getByRole('cell', { name: '7200000 ms', exact: true }))
  await observe(page, artifactDir, 'duration', 'open', table.locator('tbody tr').last().getByRole('cell', { name: '3600000 ms', exact: true }))
  assert.deepEqual(await slots(page), beforeObservation, 'Explicit duration queries do not mutate saved facts')
  const close = form(page, 'Close sample job rjob-0002')
  await close.getByRole('textbox', { name: /^Recorded sample time \(UTC\)/ }).fill(times.final)
  await button(close, 'Preview close sample job rjob-0002').click(); await button(region(close, 'Requisition and job action preview'), 'Confirm fictional recruiting action').click(); expectedRecords.researchJobClosed(expected.hr)
  await observe(page, artifactDir, 'publication', 'closed', pub.getByRole('heading', { level: 4 }))
  await exact(page, artifactDir, '02-conflict-independent-applications-outcomes-durations', expected)
  checks.push('WX-0203/WX-0204: actual duplicate email preview writes nothing, then explicit existing-person choice creates only a second application; rejection and withdrawal retain separate reasoned terminal records without changing the person or sibling application', 'WX-0207/WX-0208/WX-0209: empty reasons refuse without writes, terminal controls disappear, unknown legacy time stays unknown, and literal 7200000/3600000ms public intervals use only explicit UTC boundaries; observations write nothing')
  return { expected }
}

const ownArticle = (page, number) => region(page, 'Own assigned interview scorecards').getByRole('article').filter({ has: page.getByText(`Interview rinterview-000${number}`, { exact: true }) })
const submittedCards = page => page.getByRole('heading', { name: 'Submitted sample scorecards', exact: true }).locator('..')
async function enterOwn(page, id) {
  const entry = region(page, 'Enter an assigned interviewer preview')
  const disclosure = entry.getByText('This is a fictional local preview. Anyone using this browser profile can access the complete HR save. Complete HR exports include saved private scorecards and their history. Leaving the preview opens the ordinary workspace tools; it does not sign in or grant provider access.', { exact: true })
  await expect(disclosure).toBeVisible()
  await entry.getByRole('combobox', { name: 'Assigned fictional interviewer', exact: true }).selectOption(id)
  await button(entry, 'Enter interviewer preview').click(); await noDialog(page)
  await expect(region(page, 'Isolated interviewer preview')).toBeVisible()
}
async function leaveOwn(page) { await button(page, 'Leave interviewer preview').click(); await noDialog(page); await expect(region(page, 'Recruiting lifecycle workspace')).toBeVisible() }
async function ownBoundary(page, artifactDir, name, forbidden = []) {
  const body = page.locator('body'), text = await body.innerText(), ax = await body.ariaSnapshot(), html = await body.innerHTML()
  const ordinaryNames = ['Template workspaces', 'Demo portals', 'Synthetic management role', 'Export all workspaces', 'HR workspace backup', 'Combined workspace backup', 'Payroll readiness', 'Employee directory', 'Synthetic employee identity', 'Recruiting lifecycle workspace', 'Requisition review reason', 'Foreign unreleased form buffer', 'Foreign preserved release preview', 'CMS release activation preview', 'Lead assignment preview', 'lead-jules', 'sales-sam']
  const uploadInputs = await page.locator('input[type="file"]').evaluateAll(elements => elements.map(element => element.outerHTML))
  await writeFile(join(artifactDir, `${name}-dom-ax.json`), JSON.stringify({ text, ax, html, uploadInputs, excluded: [...ordinaryNames, ...forbidden] }, null, 2) + '\n')
  for (const value of [...ordinaryNames, ...forbidden]) {
    assert.equal(text.includes(value), false, `${name}: ordinary/private text ${value} must be absent`)
    assert.equal(ax.includes(value), false, `${name}: ordinary/private AX ${value} must be absent`)
    assert.equal(html.includes(value), false, `${name}: ordinary/private DOM ${value} must be absent`)
  }
  assert.equal(await page.getByRole('navigation').count(), 0, 'The restricted shell exposes no ordinary/global navigation')
  await expect(page.getByRole('link')).toHaveText(['Skip to portal content', 'Portal directory'])
  await expect(page.getByRole('main')).toHaveCount(1); await expect(page.locator('main#content')).toBeVisible()
  await expect(region(page, 'Isolated interviewer preview')).toBeVisible()
  assert.equal(await page.locator('input[type="file"]').count(), 0)
  evidenceFor(page).boundaries.push({ name, excluded: [...ordinaryNames, ...forbidden], noNavigation: true, noFileInputs: true, artifacts: `${name}-dom-ax.json` })
}
async function fillOwn(page, number, comments, at) {
  const target = form(ownArticle(page, number), 'Own scorecard for Casey Fiction')
  for (const [name, value] of [['Role understanding', '4'], ['Collaboration', '3'], ['Problem solving', '5']]) await target.getByRole('combobox', { name, exact: true }).selectOption(value)
  await target.getByRole('textbox', { name: 'Fictional scorecard comments', exact: true }).fill(comments)
  await target.getByRole('textbox', { name: /^Scorecard recorded time in UTC/ }).fill(at)
  return target
}
async function saveOwn(page, expected, options) {
  const target = await fillOwn(page, options.interview ?? 1, options.comments, options.at)
  await button(target, 'Preview own scorecard draft').click(); await button(region(target, 'Own scorecard preview'), 'Confirm own draft save').click()
  expectedRecords.scorecardSaved(expected.hr, options); await exactSaved(page, expected)
}
async function submitOwn(page, expected, number, id, at, artifactDir, witness = false) {
  const article = ownArticle(page, number), target = form(article, 'Own scorecard for Casey Fiction')
  await target.getByRole('textbox', { name: /^Scorecard recorded time in UTC/ }).fill(at)
  await button(target, 'Preview scorecard submission').click()
  const preview = region(target, 'Own scorecard preview')
  if (witness) { await observe(page, artifactDir, 'ownScorecard', 'submissionPreview', preview.getByRole('heading')); await quality(page, artifactDir, 'own-explicit-submit', target, button(preview, 'Confirm scorecard submission')) }
  await button(preview, 'Confirm scorecard submission').click(); expectedRecords.scorecardSubmitted(expected.hr, id, at)
  if (witness) await observe(page, artifactDir, 'ownScorecard', 'submitted', region(article, 'Own submitted sample scorecard').locator('p').first())
  await exactSaved(page, expected)
}
async function schedule(page, expected, number, artifactDir, witness = false) {
  await page.getByRole('combobox', { name: 'Interview application', exact: true }).selectOption('rapplication-0001')
  const target = form(page, 'Schedule sample interview')
  await target.getByRole('textbox', { name: /^Interview start in UTC/ }).fill('2035-01-01T12:00:00.000Z')
  await target.getByRole('textbox', { name: /^Named interview time zone/ }).fill('America/Los_Angeles')
  await target.getByRole('spinbutton', { name: 'Interview duration in minutes', exact: true }).fill('60')
  await target.getByRole('textbox', { name: /^Schedule recorded time in UTC/ }).fill(times.applied)
  await target.getByRole('checkbox', { name: /^Morgan Example/ }).check()
  if (number === 1) await target.getByRole('checkbox', { name: /^Avery Sample/ }).check()
  const before = await slots(page); await button(target, 'Preview sample interview').click()
  const preview = region(target, 'Sample interview preview')
  assert.deepEqual(await slots(page), before, 'Interview preview writes nothing')
  if (witness) {
    await observe(page, artifactDir, 'interview', 'preview', preview.getByText('America/Los_Angeles', { exact: true }))
    await quality(page, artifactDir, 'interview-schedule-preview', target, button(preview, 'Confirm sample interview'), [[target.getByRole('textbox', { name: /^Interview start in UTC/ }), '2035-01-01T12:00:00.000Z']])
  }
  await button(preview, 'Confirm sample interview').click(); expectedRecords.interviewScheduled(expected.hr, number)
  if (witness) await observe(page, artifactDir, 'interview', 'recorded', page.getByRole('list', { name: 'Recorded sample interviews', exact: true }).getByText('rinterview-0001', { exact: true }))
}
async function prepareForeignBuffers(page, expected, artifactDir) {
  await open(page, 'Content management')
  const selected = region(page, 'Selected content')
  await button(page, /^Welcome to the sample studio/).click()
  await selected.locator('#edit-body').fill('Fictional edited content for retained release.')
  await button(selected, 'Save draft revision').click(); await button(selected, 'Request review').click()
  await button(page, /^A fictional team update/).click(); await button(selected, 'Request review').click()
  await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-reviewer')
  await button(selected, 'Approve revision 1').click(); await button(page, /^Welcome to the sample studio/).click(); await button(selected, 'Approve revision 2').click()
  await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-publisher')
  const releases = region(page, 'Local release bundles')
  await releases.getByRole('textbox', { name: 'Release name', exact: true }).fill('Foreign preserved release preview')
  for (const title of ['Welcome to the sample studio', 'A fictional team update']) await releases.getByRole('checkbox', { name: new RegExp(`^${title}`) }).check()
  await button(releases, 'Prepare release draft').click(); expectedRecords.foreignReleasePrepared(expected.cms)
  await exactSaved(page, expected)
  await button(releases, 'Preview release Foreign preserved release preview').click()
  const cmsPreview = await region(page, 'CMS release activation preview').innerText()
  await releases.getByRole('textbox', { name: 'Release name', exact: true }).fill('Foreign unreleased form buffer')
  await releases.getByRole('checkbox', { name: /^Welcome to the sample studio/ }).check()
  const before = await slots(page)
  await openWithDecision(page, 'Customer relationships', ['CMS new release form'], 'Leave and keep draft')
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Ownership').click(); await noDialog(page)
  const lead = form(page, 'Reassign an unconverted lead')
  await lead.getByRole('combobox', { name: 'Lead to reassign', exact: true }).selectOption('lead-jules')
  await lead.getByRole('combobox', { name: 'New lead assignee', exact: true }).selectOption('sales-sam')
  await button(lead, 'Preview lead assignment').click()
  const crmPreview = await region(page, 'Lead assignment preview').innerText()
  await quality(page, artifactDir, 'foreign-nested-crm-before-own-mode', lead, button(region(page, 'Lead assignment preview'), 'Confirm lead assignment'), [[lead.getByRole('combobox', { name: 'New lead assignee', exact: true }), 'sales-sam']])
  await openWithDecision(page, 'People & HR', ['CRM lead assignment selection'], 'Leave and keep draft')
  assert.deepEqual(await slots(page), before)
  return { cmsPreview, crmPreview, cmsSave: before['webappx.demo.cms'], crmSave: before['webappx.demo.crm'] }
}
async function verifyForeignBuffers(page, artifactDir, retained) {
  await open(page, 'Content management')
  const releases = region(page, 'Local release bundles')
  await expect(releases.getByRole('textbox', { name: 'Release name', exact: true })).toHaveValue('Foreign unreleased form buffer')
  await expect(releases.getByRole('checkbox', { name: /^Welcome to the sample studio/ })).toBeChecked()
  assert.equal(await region(page, 'CMS release activation preview').innerText(), retained.cmsPreview, 'Nested CMS preview must survive complete DOM detachment, not only the root editor')
  await quality(page, artifactDir, 'foreign-nested-cms-after-own-mode', releases, button(region(page, 'CMS release activation preview'), 'Cancel release activation'), [[releases.getByRole('textbox', { name: 'Release name', exact: true }), 'Foreign unreleased form buffer']])
  await capture(page, artifactDir, 'retained-cms-child-release-preview', region(page, 'CMS release activation preview'))
  await openWithDecision(page, 'Customer relationships', ['CMS new release form'], 'Discard and leave')
  const lead = form(page, 'Reassign an unconverted lead')
  await expect(lead.getByRole('combobox', { name: 'Lead to reassign', exact: true })).toHaveValue('lead-jules')
  await expect(lead.getByRole('combobox', { name: 'New lead assignee', exact: true })).toHaveValue('sales-sam')
  assert.equal(await region(page, 'Lead assignment preview').innerText(), retained.crmPreview, 'Nested CRM temporary selection and preview must survive the own shell')
  await capture(page, artifactDir, 'retained-crm-child-ownership-preview', region(page, 'Lead assignment preview'))
  await openWithDecision(page, 'People & HR', ['CRM lead assignment selection'], 'Discard and leave')
  const after = await slots(page)
  assert.equal(after['webappx.demo.cms'], retained.cmsSave); assert.equal(after['webappx.demo.crm'], retained.crmSave)
  await writeFile(join(artifactDir, 'foreign-child-form-retention.json'), JSON.stringify({ ...retained, exactPreviewsRetained: true, exactDraftFieldsRetained: true, ownShellExcludedFromDOMAndAX: true, explicitDiscardEachPortal: true }, null, 2) + '\n')
}
export async function interviewJourney(args) {
  const { page, artifactDir, checks } = args, expected = await seedBrowser(args)
  await recruiting(page); await legacyPublish(page, expected); await adopt(page, expected, artifactDir)
  await schedule(page, expected, 1, artifactDir, true); await schedule(page, expected, 2, artifactDir)
  await observe(page, artifactDir, 'interview', 'emptySubmitted', submittedCards(page).getByText('No scorecard has been explicitly submitted.', { exact: true }))
  const foreign = await prepareForeignBuffers(page, expected, artifactDir)
  await recruiting(page)
  const beforeMode = await slots(page)
  await enterOwn(page, 'employee-001'); await observe(page, artifactDir, 'interview', 'ownBoundary', page.getByRole('heading', { name: 'Fictional interviewer preview', exact: true }))
  await ownBoundary(page, artifactDir, '01-own-initial')
  let own = await fillOwn(page, 1, 'Temporary own comment kept by explicit Keep.', times.future)
  await page.getByRole('link', { name: 'Portal directory', exact: true }).click(); await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByRole('listitem')).toHaveText(['Own scorecard for Casey Fiction'])
  await expect(button(dialog(page), 'Leave and keep draft')).toHaveCount(0)
  await button(dialog(page), 'Keep editing').click(); await expect(dialog(page)).not.toBeVisible()
  await expect(own.getByRole('textbox', { name: 'Fictional scorecard comments', exact: true })).toHaveValue('Temporary own comment kept by explicit Keep.')
  assert.deepEqual(await slots(page), beforeMode, 'Mode Keep preserves all raw storage slots')
  await quality(page, artifactDir, 'own-keep-retained-form', own, button(own, 'Preview own scorecard draft'), [[own.getByRole('textbox', { name: 'Fictional scorecard comments', exact: true }), 'Temporary own comment kept by explicit Keep.']])
  await page.getByRole('link', { name: 'Portal directory', exact: true }).click()
  await expect(button(dialog(page), 'Leave and keep draft')).toHaveCount(0)
  await button(dialog(page), 'Discard and leave').click(); await noDialog(page)
  await expect(page).toHaveURL(/\/portals$/)
  assert.deepEqual(await slots(page), beforeMode, 'Explicit own-mode discard writes no record')
  await verifyForeignBuffers(page, artifactDir, foreign)
  checks.push('Retained foreign children: real CMS release draft/member choices and activation preview plus CRM nested lead-assignment selections/preview stay out of own-shell body DOM/AX, then return exactly with their dirty participants; explicit per-portal Retain/Discard changes no saved bytes')
  await recruiting(page)
  await enterOwn(page, 'employee-001')
  own = form(ownArticle(page, 1), 'Own scorecard for Casey Fiction')
  await expect(own.getByRole('textbox', { name: 'Fictional scorecard comments', exact: true })).toHaveValue('')
  const second = await fillOwn(page, 2, 'Private second interview draft 2026.', times.applied)
  await button(second, 'Preview own scorecard draft').click()
  await saveOwn(page, expected, { author: 'employee-001', id: expectedRecords.ownIds.a1, revision: 1, comments: 'Hidden Morgan draft 2030.', at: times.future })
  const beforeStale = await slots(page)
  await button(region(second, 'Own scorecard preview'), 'Confirm own draft save').click()
  await observe(page, artifactDir, 'ownScorecard', 'stale', ownArticle(page, 2).getByRole('alert'))
  assert.deepEqual(await slots(page), beforeStale, 'Another accepted own action makes the full-source preview stale before any write')
  await quality(page, artifactDir, 'own-stale-retains-input', second, button(second, 'Preview own scorecard draft'), [[second.getByRole('textbox', { name: 'Fictional scorecard comments', exact: true }), 'Private second interview draft 2026.']])
  await button(second, 'Preview own scorecard draft').click()
  await observe(page, artifactDir, 'ownScorecard', 'savePreview', region(second, 'Own scorecard preview').getByRole('heading'))
  await button(region(second, 'Own scorecard preview'), 'Confirm own draft save').click()
  expectedRecords.scorecardSaved(expected.hr, { author: 'employee-001', interview: 2, id: expectedRecords.ownIds.a2, revision: 1, comments: 'Private second interview draft 2026.', at: times.applied })
  await exactSaved(page, expected); await leaveOwn(page)
  await expect(region(page, 'Recruiting lifecycle workspace')).not.toContainText('Hidden Morgan draft 2030.')
  await expect(region(page, 'Recruiting lifecycle workspace')).not.toContainText(times.future)
  await expect(submittedCards(page)).toContainText('No scorecard has been explicitly submitted.')
  await enterOwn(page, 'employee-002')
  await ownBoundary(page, artifactDir, '02-other-author-drafts-hidden', ['Hidden Morgan draft 2030.', 'Private second interview draft 2026.', times.future, expectedRecords.ownIds.a1, expectedRecords.ownIds.a2, 'rinterview-0002'])
  await expect(region(page, 'Own assigned interview scorecards').getByRole('article')).toHaveCount(1)
  await ownArticle(page, 1).getByText('Your own scorecard history', { exact: true }).click()
  await expect(ownArticle(page, 1).locator('details ol li')).toHaveText(['No own scorecard actions have been saved for this interview.'])
  await expect(ownArticle(page, 1).getByText('No own scorecard actions have been saved for this interview.', { exact: true })).toBeVisible()
  await saveOwn(page, expected, { author: 'employee-002', id: expectedRecords.ownIds.b1, revision: 1, comments: 'Public Avery submitted scorecard 2026.', at: times.applied })
  await submitOwn(page, expected, 1, expectedRecords.ownIds.b1, times.applied, artifactDir, true)
  await expect(ownArticle(page, 1).locator('details ol li')).toHaveText(['Draft saved · revision 1 · 2026-10-15T09:00:00.000Z', 'Explicitly submitted · revision 1 · 2026-10-15T09:00:00.000Z'])
  await leaveOwn(page)
  await expect(submittedCards(page)).toContainText('Public Avery submitted scorecard 2026.'); await expect(submittedCards(page)).not.toContainText('Hidden Morgan draft 2030.')
  await exact(page, artifactDir, '01-private-2030-does-not-constrain-other-author-2026', expected)
  checks.push('WX-0205: actual scheduling captures explicit UTC start, named America/Los_Angeles zone, duration and participants without invitations; future meeting start remains distinct from recorded event time', 'WX-0206: actual DOM/AX excludes all other-author drafts, draft IDs/times/events and unassigned interviews; a private 2030 save cannot constrain another author’s 2026 own save/submission; management receives only explicit immutable submitted content')
  await recruiting(page); await enterOwn(page, 'employee-001')
  own = form(ownArticle(page, 1), 'Own scorecard for Casey Fiction')
  await own.getByRole('textbox', { name: /^Scorecard recorded time in UTC/ }).fill(times.applied)
  await button(own, 'Preview own scorecard draft').click(); await observe(page, artifactDir, 'ownScorecard', 'timeRefused', ownArticle(page, 1).getByRole('alert'))
  await button(own, 'Discard scorecard changes').click()
  await saveOwn(page, expected, { author: 'employee-001', id: expectedRecords.ownIds.a1, revision: 2, comments: 'Public Morgan revised scorecard 2030.', at: times.future })
  await submitOwn(page, expected, 1, expectedRecords.ownIds.a1, times.future, artifactDir)
  await leaveOwn(page)
  await expect(submittedCards(page)).toContainText('Public Morgan revised scorecard 2030.'); await expect(submittedCards(page)).not.toContainText('Hidden Morgan draft 2030.')
  await expect(submittedCards(page)).not.toContainText('Private second interview draft 2026.')
  await endApplication(page, expected, 'rapplication-0001', 'withdrawn', 'Fictional public application ended in 2026.', times.final, artifactDir)
  await enterOwn(page, 'employee-001'); await expect(form(ownArticle(page, 2), 'Own scorecard for Casey Fiction')).toBeVisible()
  await expect(ownArticle(page, 1)).toContainText('Revision 2 is immutable in this local preview.')
  await ownBoundary(page, artifactDir, '03-terminal-own-access-retained', ['Public Avery submitted scorecard 2026.', expectedRecords.ownIds.b1])
  await leaveOwn(page); await exact(page, artifactDir, '02-private-streams-terminal-access-complete-records', expected)
  checks.push('Own controller and dirty guard: scoped Portal directory exit offers Keep/Discard without a false retention option; Keep retains all raw input/identity, explicit Discard clears former buffers/mode and reentry is clean; stale confirmation writes nothing and retains exact fields; independent own floors and terminal assigned access remain intact')
  await roundTrip(page, artifactDir, args.seed, expected, { witness: false })
  const restored = JSON.parse((await slots(page))['webappx.demo.hr']).data.recruiting.lifecycle
  assert.equal(restored.scorecards.length, 3); assert.equal(restored.interviews.length, 2)
  assert.equal(restored.scorecards.find(card => card.id === expectedRecords.ownIds.a2).content.comments, 'Private second interview draft 2026.')
  assert.equal(restored.events.find(event => event.kind === 'scorecard-saved' && event.scorecard.id === expectedRecords.ownIds.a1).scorecard.content.comments, 'Hidden Morgan draft 2030.')
  checks.push('Populated private recruiting persistence: two interviews, three scorecards, the prior private draft event and independent author histories survive actual old/new HR import, refresh and HR-only restore/Undo; complete nontrivial CMS release data and unchecked save/preference bytes remain exact')
  return { expected }
}

/** Read the recursive Facts markup actually rendered in the pre-hire summary.
 * It does not inspect React state, props, controllers or application modules. */
export async function readDisplayedFacts(scope) {
  return scope.evaluate(element => {
    function read(node) {
      const child = [...node.children].find(item => ['DL', 'OL', 'SPAN'].includes(item.tagName))
      if (!child) throw new Error('Exact hire facts markup is missing')
      if (child.tagName === 'SPAN') return child.textContent === 'Not recorded (null)' ? null : child.textContent
      if (child.tagName === 'OL') return [...child.children].map(read)
      return Object.fromEntries([...child.children].map(item => [item.querySelector(':scope > dt').textContent, read(item.querySelector(':scope > dd'))]))
    }
    return read(element)
  })
}
export function displayedFacts(value) {
  if (value === null) return null
  if (Array.isArray(value)) return value.length ? value.map(displayedFacts) : 'No entries'
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, displayedFacts(item)]))
  return String(value)
}
async function exactHire(page, expected, artifactDir, version, witness = false) {
  const card = application(page, 'rapplication-0001'), target = form(card, 'Hire confirmation for application rapplication-0001')
  await target.getByRole('textbox', { name: /^Recorded UTC time/ }).fill(times.final)
  const before = await slots(page)
  await button(target, 'Preview exact fictional hire').click()
  const review = region(card, 'Application rapplication-0001 hire preview'), summary = region(review, 'Exact fictional hire records')
  const proposed = structuredClone(expected); expectedRecords.caseyHired(proposed.hr, version)
  const id = 'employee-rperson-0001', hired = proposed.hr.recruiting.hiredEmployees.at(-1), history = proposed.hr.workflow.lifecycle
  const values = {
    'Employee identity, assignment and captured checklist': hired,
    'Initial onboarding requirements': proposed.hr.workflow.onboarding[id],
    'Initial directory profile': { employeeId: id, workEmail: 'casey.fiction@example.invalid' },
    'Initial employee status': { employeeId: id, value: 'onboarding' },
    'Initial leave balances in hours': { employeeId: id, vacation: 40, sick: 24 },
  }
  for (const [name, value] of Object.entries(values)) assert.deepEqual(await readDisplayedFacts(region(summary, name)), displayedFacts(value), `Pre-hire actual DOM must show every exact ${name} fact`)
  const employment = region(summary, 'Employment records created by this hire')
  if (history) assert.deepEqual(await readDisplayedFacts(employment), displayedFacts({ instance: history.instances.at(-1), event: history.events.at(-1) }))
  else await expect(employment).toContainText('No employment instance or employment event will be created by this hire.')
  assert.deepEqual(await slots(page), before, 'Exact hire preview cannot initialize any linked record before confirmation')
  if (witness) {
    await observe(page, artifactDir, 'hire', 'exact', summary.getByRole('heading', { name: 'Review every new hire record', exact: true }))
    await observe(page, artifactDir, 'hire', 'absent', employment.locator('p'))
    await quality(page, artifactDir, 'exact-recruiting-only-hire-confirmation', target, button(review, 'Confirm exact fictional hire'), [[target.getByRole('textbox', { name: /^Recorded UTC time/ }), times.final]])
  }
  if (version === 'sample-v2') await observe(page, artifactDir, 'hire', 'v2', region(summary, 'Employee identity, assignment and captured checklist').locator('dd').filter({ hasText: /^sample-v2$/ }))
  await writeFile(join(artifactDir, `exact-hire-${version}-review.json`), JSON.stringify({ values, employment: history ? { instance: history.instances.at(-1), event: history.events.at(-1) } : null, beforeConfirmation: true }, null, 2) + '\n')
  await button(review, 'Confirm exact fictional hire').click()
  Object.assign(expected, proposed)
  if (witness) await observe(page, artifactDir, 'application', 'hired', card.getByRole('status'))
  await exactSaved(page, expected)
}
async function offerCasey(page, expected, artifactDir) {
  await move(page, expected, 'rapplication-0001', 'screening', times.screening, artifactDir)
  await move(page, expected, 'rapplication-0001', 'interview', times.interview, artifactDir)
  await move(page, expected, 'rapplication-0001', 'offer', times.offer, artifactDir)
}
async function completeCasey(page, expected, employeeId) {
  await employee(page, expected, employeeId, 'My onboarding')
  const panel = page.getByRole('heading', { name: 'Complete sample onboarding · Casey', exact: true }).locator('..')
  await button(panel, 'Review sample profile').click(); await button(panel, 'Review sample job').click()
  for (const task of expectedRecords.sampleTasks) await button(panel, `${task.title} Mark complete`).click()
  await button(panel, 'Review onboarding summary').click(); await button(panel, 'Confirm simulated onboarding').click()
  expectedRecords.completedOriginalOnboarding(expected.hr, employeeId)
  await expect(panel.getByRole('status', { name: 'Onboarding completion status', exact: true })).toContainText('MOCK-ONBOARDING-0001')
  return panel
}
async function importHr(page, data) {
  await open(page, 'People & HR')
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('reviewed-native-hr.json', nativeEnvelope(data)))
  await button(backup(page), 'Replace HR workspace').click(); await noDialog(page)
}
async function roundTrip(page, artifactDir, seed, expected, { witness = true } = {}) {
  await page.reload()
  const before = await exact(page, artifactDir, '06-refresh-complete-extensions', expected)
  await open(page, 'People & HR')
  await expect(backup(page)).toContainText('Backups are readable text, including saved private review drafts, recruiting scorecards and survey answers where present.')
  const exported = await download(page, button(backup(page), 'Export workspace'), artifactDir, '07-complete-recruiting-hr-individual')
  assert.deepEqual(exported.data, expected.hr); assert.equal(exported.module, 'hr')
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('original-legacy-hr.json', nativeEnvelope(seed.workspaces.hr)))
  if (witness) await observe(page, artifactDir, 'recovery', 'legacy', button(backup(page), 'Replace HR workspace'))
  await quality(page, artifactDir, 'legacy-hr-import', backup(page), button(backup(page), 'Replace HR workspace'))
  await button(backup(page), 'Replace HR workspace').click()
  await exact(page, artifactDir, '08-import-old-hr-without-extensions', { ...expected, hr: seed.workspaces.hr })
  await open(page, 'People & HR')
  await backup(page).getByLabel('HR backup JSON file', { exact: true }).setInputFiles(upload('actual-recruiting-hr-export.json', exported))
  await quality(page, artifactDir, 'new-hr-extension-import', backup(page), button(backup(page), 'Replace HR workspace'))
  await button(backup(page), 'Replace HR workspace').click()
  const afterImport = await exact(page, artifactDir, '09-import-new-complete-hr', expected)
  for (const [key, value] of Object.entries(before)) if (key !== 'webappx.demo.hr') assert.equal(afterImport[key], value, `Individual import must preserve unrelated raw slot ${key}`)
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('old-combined-select-only-hr.json', combinedEnvelope(seed.workspaces)))
  const preview = region(page, 'Selective restore preview')
  await preview.getByRole('checkbox', { name: /^Restore HR/ }).check()
  for (const module of ['CMS', 'CRM']) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) })).not.toBeChecked()
  if (witness) await observe(page, artifactDir, 'recovery', 'selected', button(preview, 'Restore selected workspaces'))
  await quality(page, artifactDir, 'selected-hr-only-restore', preview, button(preview, 'Restore selected workspaces'))
  await button(preview, 'Restore selected workspaces').click()
  const restored = await exact(page, artifactDir, '10-selected-hr-old-only', { ...expected, hr: seed.workspaces.hr })
  const restorePoint = assertHistoryAppend(afterImport[historyKey], restored[historyKey], { kind: 'restore', hr: expected.hr })
  for (const module of ['cms', 'crm']) assert.equal(restored[`webappx.demo.${module}`], before[`webappx.demo.${module}`], 'Unchecked complete portal bytes must be preserved')
  const history = region(page, 'Restore points')
  const hrOnlyUndo = history.getByRole('button', { name: /^Undo restore point .* HR$/ })
  await expect(hrOnlyUndo).toHaveCount(1); await hrOnlyUndo.click()
  const undo = region(page, 'Undo preview'); await expect(undo).toContainText('Undo HR')
  if (witness) await observe(page, artifactDir, 'recovery', 'undo', button(undo, 'Confirm undo'))
  await quality(page, artifactDir, 'undo-complete-hr-extension', undo, button(undo, 'Confirm undo'))
  await button(undo, 'Confirm undo').click()
  const afterUndo = await exact(page, artifactDir, '11-undo-exact-recruiting-employment-records', expected)
  const undoPoint = assertHistoryAppend(restored[historyKey], afterUndo[historyKey], { kind: 'undo', hr: seed.workspaces.hr, sourcePointId: restorePoint.id })
  assert.deepEqual(Object.keys(afterUndo).sort(), Object.keys(afterImport).sort(), 'Restore/Undo adds no unexpected storage key')
  for (const [key, value] of Object.entries(afterImport)) if (key !== historyKey) assert.equal(afterUndo[key], value, `Undo must restore selected HR bytes and preserve every workspace/preference/unrelated raw slot ${key}`)
  await writeFile(join(artifactDir, 'recovery-history-transitions.json'), JSON.stringify({ before: JSON.parse(afterImport[historyKey]), restorePoint, undoPoint, expectedRestorePreState: expected.hr, expectedUndoPreState: seed.workspaces.hr, allPriorPointsUnchanged: true, unexpectedPruning: false }, null, 2) + '\n')
}
export async function compatibilityJourney(args) {
  const { page, artifactDir, checks, seed } = args, expected = await seedBrowser(args)
  await recruiting(page); await legacyPublish(page, expected); await legacyHire(page, expected)
  await completeCasey(page, expected, 'employee-recruit-seed-001')
  await exact(page, artifactDir, '01-legacy-raw-hire-completed-without-dates', expected)
  assert.equal(Object.hasOwn(expected.hr.workflow, 'lifecycle'), false); assert.equal(Object.hasOwn(expected.hr.recruiting, 'lifecycle'), false)
  await recruiting(page); await adopt(page, expected, artifactDir)
  const app = application(page, 'rapplication-0001')
  await app.getByText('Legacy application activity for rapplication-0001', { exact: true }).click()
  await expect(app).toContainText('MOCK-RECRUIT-0005'); await expect(app).toContainText('Recorded UTC time: unknown legacy time')
  await expect(app).toContainText('Hired employee: employee-recruit-seed-001')
  await exact(page, artifactDir, '02-adoption-keeps-exact-raw-hire-history-completed-receipt', expected)
  await open(page, 'People & HR')
  const legacy = await download(page, button(backup(page), 'Export workspace'), artifactDir, '03-adopted-legacy-hire-export')
  await importHr(page, legacy.data); await exact(page, artifactDir, '03-adopted-legacy-hire-import-compatibility', expected)
  checks.push('Legacy compatibility: ordinary legacy publish/stage/hire/onboarding remains available without dates or extension materialization; explicit adoption captures exact raw hired employee, five original recruiting receipts and known completed onboarding receipt with honest unknown chronology; actual native import retains all of them')
  await importHr(page, seed.workspaces.hr); expected.hr = structuredClone(seed.workspaces.hr)
  await recruiting(page); await legacyPublish(page, expected); await adopt(page, expected, artifactDir); await offerCasey(page, expected, artifactDir)
  await exactHire(page, expected, artifactDir, 'sample-v1', true)
  assert.equal(Object.hasOwn(expected.hr.workflow, 'lifecycle'), false)
  await exact(page, artifactDir, '04-recruiting-only-exact-hire-no-employment-grant', expected)
  const panel = await completeCasey(page, expected, 'employee-rperson-0001')
  await observe(page, artifactDir, 'hire', 'originalComplete', panel.getByRole('status', { name: 'Onboarding completion status', exact: true }))
  assert.equal(Object.hasOwn(expected.hr.workflow, 'lifecycle'), false)
  await employee(page, expected, 'employee-rperson-0001', 'My profile')
  await page.getByRole('textbox', { name: 'Synthetic work email', exact: true }).fill('casey.lifecycle@example.invalid')
  await button(page, 'Save sample profile').click(); expectedRecords.completedRecruitingBaseline(expected.hr)
  await hrPortal(page, 'Management'); await hrPage(page, 'Management', 'Employees')
  const life = region(page, 'Employment lifecycle')
  await life.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption('employee-rperson-0001')
  await observe(page, artifactDir, 'hire', 'baseline', life.getByText('employment-employee-rperson-0001-1 · current instance', { exact: true }))
  await expect(life).toContainText('MOCK-ONBOARDING-0001')
  await exact(page, artifactDir, '05-completed-recruiting-only-hire-later-employment-baseline', expected)
  checks.push('WX-0210: the actual pre-hire summary exposes every employee/checklist/profile/status/opening-balance fact before atomic confirmation; recruiting-only hire creates exactly one stable employee and linked records with compensation unconfigured and no employment history', 'Later employment provenance: ordinary onboarding preserves the captured sample-v1 checklist/receipt, and the first ordinary profile edit materializes a strict completed recruiting baseline with unknown historical actor/date, retaining immutable raw hire and payroll/time/balance/benefit data')
  await roundTrip(page, artifactDir, seed, expected)
  checks.push('Complete recruiting persistence: refresh, old individual import, new actual export/import and HR-only selective restore/Undo preserve the full recruiting/employment extensions and every unchecked CMS/CRM/save/preference byte')
  return { expected }
}
export async function employmentHireJourney(args) {
  const { page, artifactDir, checks } = args, expected = await seedBrowser(args)
  await hrPortal(page, 'Management'); await hrPage(page, 'Management', 'Employees')
  const life = region(page, 'Employment lifecycle')
  const dateInput = region(life, 'Employment simulation date').locator('input[type="date"]')
  await expect(dateInput).toHaveAccessibleName('Employment simulation date')
  await dateInput.fill('2026-10-15'); await expect(dateInput).toHaveValue('2026-10-15')
  await button(life, 'Use simulation date').click(); await button(life, 'Confirm simulation date').click()
  await life.getByRole('combobox', { name: 'Onboarding template version', exact: true }).selectOption('sample-v2')
  await button(life, 'Preview template selection').click(); await button(life, 'Confirm template selection').click(); expectedRecords.selectedV2(expected.hr)
  await recruiting(page); await legacyPublish(page, expected); await adopt(page, expected, artifactDir); await offerCasey(page, expected, artifactDir)
  const preexisting = structuredClone({ payroll: expected.hr.workflow.payroll, payrollHistory: expected.hr.workflow.payrollHistory, timeEntries: expected.hr.workflow.timeEntries, benefitElections: expected.hr.workflow.benefitElections, balances: expected.hr.operations.balances, instances: expected.hr.workflow.lifecycle.instances })
  await exactHire(page, expected, artifactDir, 'sample-v2')
  assert.deepEqual(expected.hr.workflow.lifecycle.instances.slice(0, 3), preexisting.instances)
  for (const name of ['payroll', 'payrollHistory', 'timeEntries', 'benefitElections']) assert.deepEqual(expected.hr.workflow[name], preexisting[name])
  for (const id of Object.keys(preexisting.balances)) assert.deepEqual(expected.hr.operations.balances[id], preexisting.balances[id])
  const saved = await exact(page, artifactDir, '01-selected-v2-employment-present-hire-exact-records', expected)
  await page.reload(); await exact(page, artifactDir, '02-selected-v2-employment-present-refresh', expected)
  for (const module of ['cms', 'crm']) assert.equal((await slots(page))[`webappx.demo.${module}`], saved[`webappx.demo.${module}`])
  checks.push('Employment-present hire: explicit chosen simulation date and sample-v2 selection are captured in the actual pre-hire summary; confirmation atomically adds one new instance/hire event and three-task checklist while keeping all original instances, saved payroll, consumed/time rows, benefits, existing balances and unchecked portals intact')
  return { expected, preexisting }
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

/** Four fresh isolated contexts, all mutations through native product controls.
 * Reads of complete save bytes are assertions, never a state-injection fixture. */
export async function runRecruiting({ browser, origin, artifactDir, seed }) {
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
  const results = await Promise.allSettled([['requisitions', requisitionJourney], ['interviews', interviewJourney], ['compatibility', compatibilityJourney], ['employment-hire', employmentHireJourney]].map(([name, journey]) => run(name, journey)))
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
  const observations = Object.entries(qualityEvidence).flatMap(([lane, item]) => item.statuses.map(value => ({ ...value, capture: `${lane}/${value.capture}` })))
  const statusCoverage = auditStatusCoverage(recruitingStatusFamilies, observations)
  await writeFile(join(artifactDir, 'recruiting-status-coverage.json'), JSON.stringify({ inventory: recruitingStatusInventory, sources: recruitingStatusSources, coverage: statusCoverage, observations, scope: 'New recruiting meanings only; separate from legacy native151, lifecycle46 and selected SDK status inventories. Actual UI at 390px, 20px root text; no render fixtures.' }, null, 2) + '\n')
  await writeFile(join(artifactDir, 'recruiting-quality.json'), JSON.stringify({ viewport: { width: 390, height: 844 }, textSize: '20px', qualityEvidence, contexts }, null, 2) + '\n')
  try {
    assert.deepEqual(await bindings(await filePaths(join(repository, 'src')), repository), runtimeBefore, 'Complete runtime source must remain frozen throughout this browser suite')
    if (!failures.length) assert.deepEqual(statusCoverage.missing, [], 'Every explicit new status requires its own actual uncovered monochrome witness')
  } catch (error) { failures.push(error) }
  if (!failures.length) checks.push(`Recruiting status inventory: ${statusCoverage.expected} literal meanings have actual uncovered monochrome witnesses at 390px/x-large20px`, 'Recruiting accessibility boundary: actual visible control names, retained raw inputs and Tab targets checked; complete own-shell DOM/AX excludes ordinary HR/global navigation, directory/payroll/backup and private other-author content')
  await writeFile(join(artifactDir, 'recruiting-evidence.json'), JSON.stringify({ checks, problems, warnings: [...new Set(warnings)], evidence, contexts, failures: failures.map(error => error.message) }, null, 2) + '\n')
  const harnessPaths = ['scripts/browser-recruiting.mjs', 'tests/browser/recruiting.mjs', 'tests/browser/recruiting-expected.mjs', 'tests/browser/recruiting-status-inventory.mjs', 'tests/browser/recruiting-harness.test.mjs', 'tests/browser/portal-quality.mjs', 'tests/browser/portals-smoke.mjs', 'tests/browser/seed-contract.mjs', 'scripts/browser-smoke.mjs', 'scripts/browser-preview-process.mjs', 'scripts/browser-preview-worker.mjs', 'package-lock.json']
  const artifacts = await bindings((await filePaths(artifactDir)).filter(path => !relative(artifactDir, path).startsWith('vite-cache/') && !['report.json', 'recruiting-manifest.json'].includes(path.split('/').at(-1))), artifactDir)
  const manifest = { algorithm: 'sha256', hashMode: 'exact bytes; runtime before/after equality; self-referential report/manifest and Vite generated cache excluded', runtime: runtimeBefore, harness: await bindings(harnessPaths.map(path => join(repository, path)), repository), artifacts }
  const bytes = JSON.stringify(manifest, null, 2) + '\n'; await writeFile(join(artifactDir, 'recruiting-manifest.json'), bytes)
  const receipt = { file: 'recruiting-manifest.json', sha256: sha256(bytes), runtimeFiles: runtimePaths.length, harnessFiles: harnessPaths.length, artifacts: Object.keys(artifacts).length }
  const result = { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, coveredItems: coveredRecruitingItems, manifest: receipt, statusCoverage, contexts, recruitingEvidence: evidence, qualityEvidence, limits: 'Account-free native local simulation and Chromium evidence only. No provider/account, production, Windows, device or manual screen-reader acceptance.' }
  if (failures.length || problems.length) { const error = failures[0] ?? new Error(problems.join('\n')); error.smokeEvidence = { ...result, problems, laneFailures: failures.map(item => item.message) }; throw error }
  return result
}
