import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { loadMockModel } from './model-loader.mjs'

/** A scoped selector must name the semantic entity as well as the action. A
 * duplicate name is recorded even when an intentional unique scope resolves it.
 * Hidden mounted controls do not participate in a visible interaction audit.
 */
export function auditControlRecords(records) {
  const visible = records.filter(record => record.visible)
  const groups = new Map()
  const missingNames = []
  for (const record of visible) {
    if (!record.name.trim()) missingNames.push(record)
    const key = JSON.stringify([record.role, record.name])
    groups.set(key, [...(groups.get(key) ?? []), record])
  }
  const repeated = [...groups.values()].filter(group => group.length > 1).map(group => ({
    role: group[0].role, name: group[0].name, count: group.length,
    scopes: group.map(record => record.scope),
    resolved: group.every(record => record.scope && group.filter(other => other.scope === record.scope).length === 1),
  }))
  return { visible: visible.length, hidden: records.length - visible.length, repeated, ambiguous: repeated.filter(group => !group.resolved), missingNames }
}

const open = (page, name) => page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name, exact: true }).click()
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const backup = (page, name) => page.getByRole('region', { name: `${name} workspace backup`, exact: true })
const combined = page => page.getByRole('region', { name: 'Combined workspace backup', exact: true })
const file = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
const individual = (module, data) => ({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt: '2026-10-15T12:00:00.000Z', data })

async function saved(context, origin) {
  const state = await context.storageState()
  assert.deepEqual(state.cookies, [])
  assert.ok(state.origins.every(item => item.origin === origin))
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}
let lastDownload = 0
async function download(page, control, artifactDir, name) {
  const remaining = 160 - (Date.now() - lastDownload)
  if (remaining > 0) await delay(remaining)
  lastDownload = Date.now()
  const waiting = page.waitForEvent('download')
  await control.click()
  const result = await waiting
  const target = join(artifactDir, `${name}.json`)
  await result.saveAs(target)
  assert.equal(await result.failure(), null)
  return JSON.parse(await readFile(target, 'utf8'))
}
async function snapshot(page, artifactDir, name) {
  await open(page, 'Portal directory')
  const result = await download(page, button(combined(page), 'Export all workspaces'), artifactDir, name)
  assert.deepEqual(Object.keys(result).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(result.format, 'webappx-mock-workspaces'); assert.equal(result.schemaVersion, 1)
  return result.workspaces
}

/** Playwright supplies the actual accessible name. DOM inspection supplies only
 * deliberate locator scopes: named region/nav, fieldset legend and record
 * article/section heading plus its visible identifier text. No DOM ordinal is
 * accepted as a disambiguating name.
 */
export async function auditVisibleControls(page, label, artifactDir) {
  const nodes = page.locator('button, a[href], input:not([type="hidden"]):not([type="file"]), textarea, select, summary')
  const records = []
  const documentEpoch = await page.evaluate(() => performance.timeOrigin)
  const initialControls = await nodes.elementHandles()
  const session = await page.context().newCDPSession(page)
  let disclosureNames
  try { const tree = await session.send('Accessibility.getFullAXTree'); disclosureNames = tree.nodes.filter(node => node.role?.value === 'DisclosureTriangle').map(node => node.name?.value ?? '') }
  finally { await session.detach() }
  for (let index = 0; index < initialControls.length; index += 1) {
    const locator = nodes.nth(index)
    const node = initialControls[index]
    if (!await node.isVisible()) { records.push({ visible: false, role: '', name: '', scope: '' }); continue }
    const aria = await locator.ariaSnapshot()
    assert.equal(await locator.evaluate((element, captured) => element === captured, node), true, `${label}: controls changed during accessible-name measurement; repeat against stable source`)
    const first = aria.split('\n')[0]
    const match = /^- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?/.exec(first)
    if (!match) throw new Error(`Could not measure accessible control: ${first}`)
    let role = match[1]
    let name = match[2] ? JSON.parse(`"${match[2]}"`) : ''
    // Playwright's ARIA YAML exposes native summary as text. Chromium's
    // accessibility tree supplies its actual DisclosureTriangle name.
    if (await node.evaluate(element => element.tagName === 'SUMMARY')) {
      const text = await node.innerText()
      name = disclosureNames.find(value => value === text.trim()) ?? ''
      role = 'disclosure'
    }
    const scope = await node.evaluate(element => {
      const parts = []
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'NAV' || parent.getAttribute('role') === 'region' || parent.tagName === 'FIELDSET' || parent.tagName === 'FORM') {
          const label = parent.getAttribute('aria-label') || parent.querySelector(':scope > legend')?.textContent?.trim()
          // Point UUIDs are intentionally excluded: the list item's visible
          // label/kind/modules/time must disambiguate every point action.
          if (label && !(parent.tagName === 'FORM' && label.startsWith('Rename restore point '))) parts.unshift(`${parent.tagName.toLowerCase()}:${label}`)
        } else if (parent.tagName === 'LI' && parent.parentElement?.getAttribute('aria-label') === 'Saved restore points') {
          const paragraphs = [...parent.querySelectorAll(':scope > div > p')]
          const heading = paragraphs[0]?.textContent?.trim() ?? ''
          const kind = paragraphs[1]?.textContent?.trim() ?? ''
          const time = parent.querySelector('time')?.textContent?.trim() ?? ''
          if (heading && time) parts.unshift(`restore-point:${heading} / ${kind} / ${time}`)
        } else if (parent.tagName === 'ARTICLE' || parent.tagName === 'SECTION') {
          const label = parent.getAttribute('aria-label') || parent.querySelector('h1,h2,h3,h4,h5')?.textContent?.trim()
          if (label) {
            // Existing record cards expose their identifier/person in prose. It
            // is a deliberate filter scope, never a hidden generated DOM ID.
            const identifier = parent.tagName === 'ARTICLE' ? [...parent.querySelectorAll('p')].map(item => item.textContent.trim()).find(text => /(?:employee-|time-|task-|goal-|review-|candidate-|job-|opportunity-|lead-|cms-|MOCK-|policy-|training-|asset-|document-)/.test(text)) : ''
            parts.unshift(`${parent.tagName.toLowerCase()}:${label}${identifier ? ` / ${identifier}` : ''}`)
          }
        }
      }
      return parts.join(' > ')
    })
    records.push({ visible: true, role, name, scope, aria, element: await node.evaluate(element => element.outerHTML.slice(0, 1000)) })
  }
  assert.equal(await page.evaluate(() => performance.timeOrigin), documentEpoch, `${label}: the document reloaded during accessible-name measurement; this audit is invalid`)
  const finalControls = await nodes.elementHandles()
  assert.equal(finalControls.length, initialControls.length, `${label}: control count changed during measurement; this audit is invalid`)
  for (let index = 0; index < initialControls.length; index += 1) assert.equal(await finalControls[index].evaluate((element, captured) => element === captured, initialControls[index]), true, `${label}: control identity changed during measurement; this audit is invalid`)
  await Promise.all([...initialControls, ...finalControls].map(handle => handle.dispose()))
  const report = { label, records, ...auditControlRecords(records) }
  if (['hr-profile', 'hr-time', 'cms-draft', 'crm-leads'].includes(label)) {
    assert.equal(records.filter(record => record.visible && record.role === 'button' && record.name === 'Import workspace').length, 1, `${label}: exactly one workspace import is visible`)
    assert.equal(await page.locator('button').filter({ hasText: /^Import workspace$/ }).count(), 3, 'All three portal import controls remain mounted during the audit')
  }
  await writeFile(join(artifactDir, `controls-${label}.json`), JSON.stringify(report, null, 2) + '\n')
  assert.deepEqual(report.missingNames, [], `${label}: every visible interactive control must have an accessible name`)
  assert.deepEqual(report.ambiguous, [], `${label}: duplicate role/name selectors need a unique semantic record or region scope`)
  return { label, visible: report.visible, hidden: report.hidden, repeated: report.repeated }
}

/** Values may scroll inside editable text fields; labels/actions may not be
 * clipped by any non-scrollable ancestor. Native select option popups are not
 * DOM boxes. Each target is reached with Tab, not HTMLElement.focus().
 */
export async function assertRetainedControl(page, locator, { value, keyboard = false } = {}) {
  await expect(locator).toBeVisible()
  if (value !== undefined) await expect(locator).toHaveValue(value)
  await locator.scrollIntoViewIfNeeded()
  const measurement = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const clips = []
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), box = parent.getBoundingClientRect()
      if (['hidden', 'clip'].includes(style.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) clips.push(`${parent.tagName}:x`)
      if (['hidden', 'clip'].includes(style.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)) clips.push(`${parent.tagName}:y`)
    }
    const labelClips = [...(element.labels ?? [])].flatMap(label => {
      const range = document.createRange(); range.selectNodeContents(label)
      return [...range.getClientRects()].filter(box => box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)).map(() => label.textContent.trim())
    })
    return { labelClips, width: rect.width, height: rect.height, left: rect.left, right: rect.right, viewport: innerWidth, clips, disabled: element.disabled, tabIndex: element.tabIndex, name: element.getAttribute('aria-label') || [...(element.labels ?? [])].map(label => label.textContent).join(' ') || element.textContent, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, tag: element.tagName }
  })
  assert.ok(measurement.name.trim(), 'The control retains its label')
  assert.ok(measurement.width > 0 && measurement.height > 0)
  assert.ok(measurement.left >= -1 && measurement.right <= measurement.viewport + 1, `Control must fit the narrow viewport: ${measurement.name}`)
  assert.deepEqual(measurement.labelClips, [], `Label must fit the narrow viewport: ${measurement.name}`)
  assert.deepEqual(measurement.clips, [], `Control must not be clipped: ${measurement.name}`)
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(measurement.tag)) assert.ok(measurement.scrollWidth <= measurement.clientWidth + 1, `Action text must wrap without clipping: ${measurement.name}`)
  if (keyboard && !measurement.disabled) {
    assert.ok(measurement.tabIndex >= 0)
    let reached = false
    for (let index = 0; index < 180; index += 1) {
      await page.keyboard.press('Tab')
      if (await locator.evaluate(element => element === document.activeElement)) { reached = true; break }
    }
    assert.ok(reached, `Tab must reach ${measurement.name}`)
    await expect(locator).toBeFocused()
  }
  return measurement
}

async function capture(page, artifactDir, name, locator) {
  const style = await page.addStyleTag({ content: 'html, dialog:modal, dialog::backdrop { filter: grayscale(1) !important; }' })
  const target = locator ?? page
  try {
    if (locator) {
      const box = await locator.boundingBox()
      if (box && box.height < (page.viewportSize()?.height ?? 844) - 140) await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    }
    await target.screenshot({ path: join(artifactDir, `${name}-monochrome.png`), ...(locator ? {} : { fullPage: true }) })
  }
  finally { await style.evaluate(element => element.remove()) }
}

// Retain bounded screenshots of actual visible text as well as full context.
// Long inspection tables can exceed the image viewer's maximum dimension; a
// readable witness never replaces the original product/context capture.
async function captureTextWitness(page, artifactDir, name, scope, text, selector = 'p,dd,dt,span,td,small,h2,h3,button') {
  const normalize = value => value.trim().replace(/\s+/g, ' ').replaceAll('-', ' ').toLowerCase()
  const expected = normalize(text)
  const candidates = scope.locator(selector)
  const records = (await candidates.allInnerTexts()).map((value, index) => ({ index, text: normalize(value) }))
    .filter(record => record.text.includes(expected)).sort((a, b) => Number(b.text === expected) - Number(a.text === expected) || a.text.length - b.text.length)
  for (const record of records) {
    const candidate = candidates.nth(record.index)
    if (!await candidate.isVisible()) continue
    await capture(page, artifactDir, name, candidate)
    return `${name}-monochrome.png`
  }
  const box = await scope.boundingBox()
  assert.ok(box && box.height < 600, `A bounded actual visible text witness is required for ${text}`)
  await expect(scope).toContainText(text)
  await capture(page, artifactDir, name, scope)
  return `${name}-monochrome.png`
}

async function nativeJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/portals`)
  await button(page, 'Open accessibility controls').click()
  await page.getByRole('group', { name: 'Text size', exact: true }).getByRole('button', { name: 'Extra large', exact: true }).click()
  await page.getByRole('region', { name: 'Accessibility and page controls', exact: true }).getByRole('button', { name: 'Close accessibility controls', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize), { message: 'The actual x-large stylesheet must apply before measuring portal layouts' }).toBe('20px')
  assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).fontSize), '20px')
  assert.deepEqual(await snapshot(page, artifactDir, 'quality-seed'), seed.workspaces)
  const auxiliary = await saved(context, origin)
  const audits = [await auditVisibleControls(page, 'directory', artifactDir)]
  await open(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
  await page.getByText('Browse employee pages', { exact: true }).click()
  await page.getByRole('navigation', { name: 'Employee mobile HR pages', exact: true }).getByRole('link', { name: 'My profile', exact: true }).click()
  const email = page.getByRole('textbox', { name: 'Synthetic work email', exact: true })
  await email.fill('quality.avery@example.invalid')
  await assertRetainedControl(page, email, { value: 'quality.avery@example.invalid', keyboard: true })
  await capture(page, artifactDir, 'xlarge-hr-profile-entered', email.locator('..'))
  await assertRetainedControl(page, button(page, 'Save sample profile'), { keyboard: true })
  await page.keyboard.press('Enter')
  const expected = structuredClone(seed.workspaces)
  expected.hr.workflow.profileEmails['employee-002'] = 'quality.avery@example.invalid'
  audits.push(await auditVisibleControls(page, 'hr-profile', artifactDir))
  await capture(page, artifactDir, 'xlarge-hr-profile')
  await page.getByRole('navigation', { name: 'Employee mobile HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
  const workDate = page.getByLabel('Work date', { exact: true }), hours = page.getByRole('spinbutton', { name: 'Hours', exact: true })
  await workDate.fill('2026-10-12'); await hours.fill('1.5')
  await assertRetainedControl(page, workDate, { value: '2026-10-12', keyboard: true })
  await assertRetainedControl(page, hours, { value: '1.5', keyboard: true })
  await capture(page, artifactDir, 'xlarge-hr-time-entered', workDate.locator('..').locator('..'))
  await assertRetainedControl(page, page.getByRole('combobox', { name: /^Synthetic employee identity/ }), { value: 'employee-002' })
  await assertRetainedControl(page, button(page, 'Add sample time'), { keyboard: true }); await page.keyboard.press('Enter')
  expected.hr.workflow.timeEntries.push({ id: 'MOCK-TIME-0001', employeeId: 'employee-002', date: '2026-10-12', hours: 1.5, source: 'manual', status: 'draft' }); expected.hr.workflow.sequence = 2
  audits.push(await auditVisibleControls(page, 'hr-time', artifactDir)); await capture(page, artifactDir, 'xlarge-hr-time')
  await open(page, 'Content management')
  const edit = page.getByRole('region', { name: 'Selected content', exact: true })
  await page.getByRole('button', { name: /A fictional team update/ }).click()
  await edit.getByRole('textbox', { name: 'Content title', exact: true }).fill('Fictional extra large editorial draft')
  await edit.getByRole('textbox', { name: 'Content slug', exact: true }).fill('fictional-extra-large-editorial-draft')
  await edit.getByRole('textbox', { name: 'Plain-text content', exact: true }).fill('Fictional extra large content remains readable and saved.')
  for (const [name, value] of [['Content title', 'Fictional extra large editorial draft'], ['Content slug', 'fictional-extra-large-editorial-draft'], ['Plain-text content', 'Fictional extra large content remains readable and saved.']]) await assertRetainedControl(page, edit.getByRole('textbox', { name, exact: true }), { value, keyboard: name === 'Content title' })
  await capture(page, artifactDir, 'xlarge-cms-editor-entered', edit)
  await assertRetainedControl(page, button(edit, 'Save draft revision'), { keyboard: true }); await page.keyboard.press('Enter')
  Object.assign(expected.cms.entries.find(item => item.id === 'cms-article-001'), { title: 'Fictional extra large editorial draft', slug: 'fictional-extra-large-editorial-draft', body: 'Fictional extra large content remains readable and saved.', revision: 2, status: 'draft', approval: null, feedback: '' })
  expected.cms.sequence = 1; expected.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  audits.push(await auditVisibleControls(page, 'cms-draft', artifactDir)); await capture(page, artifactDir, 'xlarge-cms-draft')
  await open(page, 'Customer relationships'); await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Leads').click()
  for (const [name, value] of [['Lead name', 'Quality Sample'], ['Lead email', 'quality@example.invalid'], ['Lead company', 'Fictional Quality Lab']]) { await page.getByRole('textbox', { name, exact: true }).fill(value); await assertRetainedControl(page, page.getByRole('textbox', { name, exact: true }), { value, keyboard: name === 'Lead name' }) }
  await capture(page, artifactDir, 'xlarge-crm-lead-entered', page.getByRole('textbox', { name: 'Lead name', exact: true }).locator('xpath=ancestor::section[1]'))
  await assertRetainedControl(page, button(page, 'Create sample lead'), { keyboard: true }); await page.keyboard.press('Enter')
  expected.crm.leads.push({ id: 'lead-0001', name: 'Quality Sample', email: 'quality@example.invalid', companyName: 'Fictional Quality Lab', ownerId: 'crm-owner', status: 'new' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: 'Created sample lead Quality Sample.' }); expected.crm.sequence = 2
  audits.push(await auditVisibleControls(page, 'crm-leads', artifactDir)); await capture(page, artifactDir, 'xlarge-crm-leads')
  // Confirm the product's complete exported records, rather than only counters.
  assert.deepEqual(await snapshot(page, artifactDir, 'quality-mutated'), expected)
  const mutatedSlots = await saved(context, origin)
  for (const module of ['hr', 'cms', 'crm']) assert.deepEqual(JSON.parse(mutatedSlots[`webappx.demo.${module}`]), { schemaVersion: 1, module, data: expected[module] })
  assert.equal(mutatedSlots['sfwa-wtl:accessibility-preferences'], auxiliary['sfwa-wtl:accessibility-preferences'])
  checks.push('WX-0722: actual Extra large preference yields 20px root text at 390px width; HR, CMS and CRM labels/entered values/save actions fit, survive Tab/Enter and match complete independent exports and saved envelopes')
  for (const [module, title] of [['hr', 'People & HR'], ['cms', 'Content management'], ['crm', 'Customer relationships']]) {
    await open(page, title)
    const region = backup(page, module.toUpperCase())
    await region.getByLabel(`${module.toUpperCase()} backup JSON file`, { exact: true }).setInputFiles(file(`quality-${module}.json`, individual(module, expected[module])))
    await expect(region.getByRole('heading', { name: `Ready to replace ${module.toUpperCase()} workspace`, exact: true })).toBeVisible()
    await assertRetainedControl(page, button(region, `Replace ${module.toUpperCase()} workspace`), { keyboard: true })
    await capture(page, artifactDir, `xlarge-${module}-import-ready`, region)
    await assertRetainedControl(page, button(region, 'Cancel import'), { keyboard: true }); await page.keyboard.press('Enter')
    assert.deepEqual(await saved(context, origin), mutatedSlots, 'Canceled narrow-width individual import preserves every saved byte')
    await capture(page, artifactDir, `xlarge-${module}-import-canceled`)
  }
  await open(page, 'Portal directory')
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(file('quality-original.json', { format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces: seed.workspaces }))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  for (const module of ['HR', 'CMS', 'CRM']) { const checkbox = preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) }); await checkbox.check(); await assertRetainedControl(page, checkbox) }
  await expect(preview).toContainText('HR, CMS, CRM will be replaced')
  audits.push(await auditVisibleControls(page, 'selected-restore', artifactDir))
  await capture(page, artifactDir, 'xlarge-restore-preview', preview)
  await captureTextWitness(page, artifactDir, 'xlarge-restore-explanation', preview, 'HR, CMS, CRM will be replaced')
  await assertRetainedControl(page, button(preview, 'Restore selected workspaces'), { keyboard: true })
  await capture(page, artifactDir, 'xlarge-restore-actions', button(preview, 'Restore selected workspaces').locator('..'))
  await page.keyboard.press('Enter')
  assert.deepEqual(await snapshot(page, artifactDir, 'quality-restored'), seed.workspaces)
  const history = page.getByRole('region', { name: 'Restore points', exact: true })
  await history.getByRole('button', { name: /^Undo restore point / }).click()
  const undo = page.getByRole('region', { name: 'Undo preview', exact: true })
  await expect(undo).toContainText('Undo HR, CMS, CRM')
  audits.push(await auditVisibleControls(page, 'undo', artifactDir))
  await capture(page, artifactDir, 'xlarge-undo-preview', undo)
  await assertRetainedControl(page, button(undo, 'Cancel undo'), { keyboard: true })
  await captureTextWitness(page, artifactDir, 'xlarge-undo-explanation', undo, 'Recover the records captured')
  await assertRetainedControl(page, button(undo, 'Confirm undo'), { keyboard: true })
  await capture(page, artifactDir, 'xlarge-undo-actions', button(undo, 'Confirm undo').locator('..'))
  await page.keyboard.press('Enter')
  assert.deepEqual(await snapshot(page, artifactDir, 'quality-undone'), expected)
  audits.push(await auditVisibleControls(page, 'after-undo-multiple-points', artifactDir))
  const finalSlots = await saved(context, origin)
  for (const module of ['hr', 'cms', 'crm']) assert.equal(finalSlots[`webappx.demo.${module}`], mutatedSlots[`webappx.demo.${module}`], 'Undo recovers each complete original save byte for byte')
  assert.equal(finalSlots['sfwa-wtl:accessibility-preferences'], auxiliary['sfwa-wtl:accessibility-preferences'], 'Restore and Undo preserve the exact chosen reading preference')
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  checks.push('WX-0722: all three individual import confirmations/cancel actions and selective restore/Undo confirmations retain labels/actions at actual x-large/narrow width; Tab/Enter confirms real replacements and Undo restores complete prior records and saved bytes')
  assert.ok(audits.some(audit => audit.hidden > 0), 'Hidden mounted portal controls must actually exist during this audit')
  assert.ok(audits.some(audit => audit.repeated.some(item => item.name === 'Qualify sample lead' && item.resolved)), 'Repeated record actions must be measured and deliberately scoped')
  checks.push('WX-0655: real accessible names are measured across directory/HR/CMS/CRM/import/selective restore/Undo with hidden portal modules mounted; duplicate global selectors are recorded and each repeated record action/import is resolved by a unique semantic scope')
  return { viewport: { width: 390, height: 844 }, textScale: 'x-large', rootFontSize: '20px', audits }
}

// This finite inventory names all implemented workflow state machines, plus the
// generic static fixture status renderer and browser/recovery state families.
// The fixture is deliberately not a transition test: it renders strict valid
// synthetic snapshots in a separate disposable context through actual product
// components. Native journeys above establish ordinary user interactions.
export const statusFamilies = Object.freeze({
  onboarding: ['draft', 'reviewed', 'complete'],
  onboardingFlags: ['Profile: pending', 'Job: pending', 'Profile: reviewed', 'Job: reviewed', 'Complete', 'Mark complete'],
  time: ['draft', 'submitted', 'approved'],
  timeModifiers: ['Returned by Morgan Example:', 'included in MOCK-QUALITY-PAID'],
  benefits: ['draft', 'reviewed', 'confirmed'],
  benefitChoices: ['enroll', 'waive'],
  payroll: ['idle', 'prepared', 'calculated', 'reviewed', 'submitted'],
  payrollFreshness: ['Payroll preparation is stale.'],
  pto: ['pending', 'approved', 'rejected', 'cancelled'],
  tasks: ['pending', 'draft', 'assigned', 'in progress', 'open', 'completed'],
  policies: ['published', 'pending', 'assigned', 'acknowledged'],
  training: ['pending', 'draft', 'assigned', 'in progress', 'completed'],
  assets: ['pending', 'assigned', 'acknowledged', 'return requested', 'returned'],
  documents: ['pending', 'published', 'assigned', 'acknowledged', 'placeholder'],
  service: ['open', 'in progress', 'resolved'],
  jobs: ['draft', 'published', 'closed'],
  candidates: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'],
  goals: ['draft', 'active', 'completed'],
  reviews: ['draft', 'self submitted', 'manager review', 'published', 'acknowledged'],
  surveys: ['draft', 'published', 'closed'],
  surveyResponse: ['draft', 'submitted'],
  surveyClosedDraft: ['This sample survey is closed.', 'saved answers were not submitted and are excluded from results.'],
  cms: ['draft', 'in review', 'approved', 'published', 'retired'],
  cmsModifiers: ['Reviewer feedback:', 'approved by the separate reviewer', 'The published sample is still revision'],
  crmLead: ['new', 'qualified', 'converted'],
  crmOpportunity: ['discovery', 'proposal', 'negotiation', 'won', 'lost'],
  crmTask: ['open', 'done'],
  employment: ['active', 'onboarding'],
  provider: ['Mock preview · disconnected', 'Not provisioned', 'Specification only', 'None embedded', 'Disabled'],
  staticRecords: ['mock', 'synthetic', 'illustrative', 'draft', 'mock complete', 'in progress', 'complete', 'pending', 'disabled', 'sample'],
  storage: ['ready', 'saved', 'restored', 'reset', 'unavailable', 'recovered'],
  recovery: ['manual capture', 'selective restore', 'Undo', 'individual import', 'portal Reset', 'Ready to replace', 'Current workspace unchanged.', 'will be replaced', 'Undo HR, CMS, CRM'],
  inspection: ['Select at least one workspace to inspect its records.', 'Select at least one workspace to compare before restoring.', 'Record inspection is unavailable', 'Difference inspection is unavailable', 'No saved record or listed metadata differences', 'Added', 'Removed', 'Changed', 'Unchanged'],
  budget: ['Select at least one workspace', 'Storage preview refused', 'Selected workspace total', 'Restore is unavailable'],
  importWorkflow: ['individual reading', 'combined reading', 'individual accepted', 'individual refused', 'combined refused', 'combined empty selection', 'combined canceled'],
})
export const externalStatusFamilies = Object.freeze({
  restorePointKinds: ['restore', 'undo', 'manual', 'import', 'reset'],
  cmsEditorKinds: ['clean', 'current', 'stale', 'missing'],
})

export function auditStatusLabelRecords(expected, records, { exact = true } = {}) {
  const normalize = value => value.trim().replaceAll('-', ' ').toLowerCase()
  const labels = records.filter(record => record.kind === 'status-label' && record.visible).map(record => normalize(record.text))
  return { missing: expected.filter(state => !labels.some(text => exact ? text === normalize(state) : text.includes(normalize(state)))) }
}

export function auditStatusCoverage(families, observations) {
  const missing = []
  for (const [family, states] of Object.entries(families)) for (const state of states) if (!observations.some(item => item.family === family && item.state === state && item.text.trim() && item.capture)) missing.push({ family, state })
  return { expected: Object.values(families).reduce((sum, states) => sum + states.length, 0), observed: observations.length, missing }
}

export async function statusFixture(seed) {
  const states = structuredClone(seed.workspaces), hr = states.hr
  const employee = 'employee-002', manager = 'employee-001'
  const record = (family, status, extra = {}) => ({ id: `quality-${family}-${status}`, title: `Fictional ${family} ${status}`, employeeId: employee, status, ...extra })
  const statuses = family => statusFamilies[family].map(value => value.replaceAll(' ', '-'))
  hr.workflow.timeEntries = statuses('time').map((status, index) => ({ id: `quality-time-${status}`, employeeId: employee, date: `2026-10-${String(index + 1).padStart(2, '0')}`, hours: 1, source: 'manual', status }))
  hr.workflow.timeEntries.push({ id: 'quality-time-returned', employeeId: employee, date: '2026-10-04', hours: 1, source: 'manual', status: 'draft', returnReason: 'Fictional hours need correction.', returnedBy: manager }, { id: 'quality-time-paid', employeeId: employee, date: '2026-10-05', hours: 1, source: 'manual', status: 'approved', payrollReceipt: 'MOCK-QUALITY-PAID' })
  hr.workflow.sampleRates = { [employee]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }] }
  hr.operations.ptoRequests = statuses('pto').map(status => ({ ...record('pto', status), startDate: '2026-11-02', endDate: '2026-11-02', hours: 8, type: 'vacation' }))
  for (const family of ['tasks', 'policies', 'training', 'assets', 'documents']) hr.operations.records[family] = statuses(family).map(status => record(family, status, family === 'documents' ? { type: 'welcome' } : {}))
  hr.serviceDesk.requests = statuses('service').map(status => ({ ...record('request', status), category: 'equipment', details: 'Fictional quality fixture request.', assigneeId: 'hr-team', activity: [], ...(status === 'resolved' ? { resolution: 'Fictional fixture resolution.' } : {}) }))
  hr.recruiting.jobs = statuses('jobs').map(status => ({ id: `quality-job-${status}`, title: `Fictional job ${status}`, department: 'Operations', managerId: manager, status, activity: [] }))
  const hire = { ...structuredClone(seed.workspaces.hr.recruiting.hiredEmployees[0] ?? {}), id: 'quality-hired-employee', firstName: 'Fictional', lastName: 'Hire', workEmail: 'fictional.hire@example.invalid', department: 'Operations', jobTitle: 'Fictional job published', employmentStatus: 'onboarding', managerId: manager, payCents: 0, compensationConfigured: false, compensationStatus: 'unconfigured', onboarding: [{ id: 'profile', title: 'Complete own profile', status: 'pending' }, { id: 'policy', title: 'Review sample welcome checklist', status: 'pending' }] }
  hr.recruiting.hiredEmployees = [hire]
  hr.workflow.onboarding[hire.id] = { profileReviewed: false, jobReviewed: false, stage: 'draft', tasks: { profile: false, policy: false } }
  hr.workflow.profileEmails[hire.id] = hire.workEmail; hr.workflow.employeeStatuses[hire.id] = 'onboarding'; hr.operations.balances[hire.id] = { vacation: 40, sick: 24 }
  hr.recruiting.candidates = statuses('candidates').map(stage => ({ id: `quality-candidate-${stage}`, jobId: 'quality-job-published', firstName: 'Fictional', lastName: stage, workEmail: stage === 'hired' ? hire.workEmail : `fictional.${stage}@example.invalid`, stage, activity: [], ...(stage === 'hired' ? { employeeId: hire.id } : {}) }))
  hr.performance.goals = statuses('goals').map(status => ({ ...record('goal', status), progress: status === 'completed' ? 100 : 0, activity: [] }))
  hr.performance.reviews = statuses('reviews').map(stage => ({ id: `quality-review-${stage}`, title: `Fictional review ${stage}`, employeeId: employee, managerId: manager, stage, activity: [], ...(stage !== 'draft' ? { selfComments: 'Fictional submitted self review.' } : {}), ...(['published', 'acknowledged'].includes(stage) ? { managerComments: 'Fictional published manager feedback.' } : {}) }))
  hr.surveys.surveys = statuses('surveys').map(status => ({ id: `quality-survey-${status}`, title: `Fictional survey ${status}`, status, audienceIds: [employee, manager], questions: { ratingPrompt: 'Fictional clarity rating?', textPrompt: 'Fictional improvement?' }, responses: status === 'draft' ? [] : [{ employeeId: employee, rating: 4, text: 'Fictional saved draft response.', status: 'draft' }, { employeeId: manager, rating: 5, text: 'Fictional submitted response.', status: 'submitted', receipt: 'MOCK-QUALITY-SURVEY' }], activity: [] }))
  const [{ transitionCms, cmsActors }, { transitionCrm, crmActors }] = await Promise.all([loadMockModel(new URL('../../src/cms/model.ts', import.meta.url)), loadMockModel(new URL('../../src/crm/model.ts', import.meta.url))])
  let cms = states.cms
  const author = cmsActors[0], reviewer = cmsActors[1], publisher = cmsActors[2]
  // Preserve canonical seed IDs and build internally consistent receipt chains.
  cms = transitionCms(cms, { type: 'edit-entry', entryId: 'cms-page-001', expectedRevision: 1, title: 'Fictional frozen draft', slug: 'welcome', body: 'Fictional revision awaiting a future publication.' }, author)
  cms = transitionCms(cms, { type: 'submit-review', entryId: 'cms-page-001', expectedRevision: 2 }, author)
  cms = transitionCms(cms, { type: 'return-draft', entryId: 'cms-page-001', expectedRevision: 2, feedback: 'Fictional reviewer feedback.' }, reviewer)
  for (const status of ['in-review', 'approved', 'published', 'retired']) {
    cms = transitionCms(cms, { type: 'create-entry', collectionId: 'articles', title: `Fictional content ${status}`, slug: `fictional-${status}`, body: 'Fictional quality fixture content for status rendering.' }, author)
    const entryId = cms.entries.at(-1).id
    cms = transitionCms(cms, { type: 'submit-review', entryId, expectedRevision: 1 }, author)
    if (status !== 'in-review') cms = transitionCms(cms, { type: 'approve-entry', entryId, expectedRevision: 1 }, reviewer)
    if (['published', 'retired'].includes(status)) cms = transitionCms(cms, { type: 'publish-entry', entryId, expectedRevision: 1 }, publisher)
    if (status === 'retired') cms = transitionCms(cms, { type: 'retire-entry', entryId, expectedRevision: 1 }, publisher)
  }
  states.cms = cms
  let crm = states.crm
  const owner = crmActors[0]
  for (const status of statusFamilies.crmLead) {
    crm = transitionCrm(crm, owner, { type: 'create-lead', name: `Fictional lead ${status}`, email: `${status}@quality.invalid`, companyName: `Fictional quality ${status}` })
    const leadId = crm.leads.at(-1).id
    if (status !== 'new') crm = transitionCrm(crm, owner, { type: 'qualify-lead', leadId })
    if (status === 'converted') crm = transitionCrm(crm, owner, { type: 'convert-lead', leadId, amountCents: 150000 })
  }
  for (const stage of statusFamilies.crmOpportunity) {
    crm = transitionCrm(crm, owner, { type: 'create-opportunity', title: `Fictional opportunity ${stage}`, companyId: 'company-harbor', contactId: 'contact-avery', amountCents: 150000 })
    const opportunityId = crm.opportunities.at(-1).id
    if (stage === 'lost') crm = transitionCrm(crm, owner, { type: 'advance-opportunity', opportunityId, stage })
    else for (const target of ['proposal', 'negotiation', 'won'].slice(0, ['discovery', 'proposal', 'negotiation', 'won'].indexOf(stage))) crm = transitionCrm(crm, owner, { type: 'advance-opportunity', opportunityId, stage: target })
  }
  crm = transitionCrm(crm, owner, { type: 'complete-task', taskId: 'task-harbor' })
  crm = transitionCrm(crm, owner, { type: 'create-task', title: 'Fictional open follow up', opportunityId: 'opportunity-harbor' })
  states.crm = crm
  return states
}

export async function validateFixture(states) {
  const [{ isHrDemoState }, { hrFixture }, { isCmsState }, { isCrmState }] = await Promise.all([
    loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url)),
    loadMockModel(new URL('../../src/hr/catalog.ts', import.meta.url)),
    loadMockModel(new URL('../../src/cms/persistence.ts', import.meta.url)),
    loadMockModel(new URL('../../src/crm/persistence.ts', import.meta.url)),
  ])
  assert.equal(isHrDemoState(states.hr, hrFixture), true, 'The render-only HR fixture must pass the actual strict importer validator')
  assert.equal(isCmsState(states.cms), true, 'The render-only CMS fixture must pass the actual strict importer validator')
  assert.equal(isCrmState(states.crm), true, 'The render-only CRM fixture must pass the actual strict importer validator')
}

export async function statusJourney({ page, context, origin, artifactDir, seed, checks }) {
  const states = await statusFixture(seed)
  await validateFixture(states)
  await page.setContent('<!doctype html><html><body><article><h3>Fictional lead converted; fictional opportunity won</h3><span>No workflow status badge</span></article></body></html>')
  const absentBadges = await page.locator('article span.rounded-full').allInnerTexts()
  assert.deepEqual(auditStatusLabelRecords(['converted', 'won'], absentBadges.map(text => ({ kind: 'status-label', visible: true, text }))).missing, ['converted', 'won'], 'A title containing status words must never substitute for a missing actual status badge')
  checks.push('WX-0720 auditor negative DOM fixture: record titles containing converted/won cannot satisfy absent product status badges')
  const identicalPoint = id => `<li><div><p>Same fictional capture · HR</p><p>manual capture · Captured records only</p><p>Created at (UTC): <time>2026-10-15T12:00:00.000Z</time></p><form aria-label="Rename restore point ${id}"><label>Point label<input value="Same fictional capture"></label><button>Save point label</button></form></div><button>Inspect captured records</button></li>`
  await page.setContent(`<!doctype html><html><body><section aria-label="Restore points"><h2>Restore points</h2><ol aria-label="Saved restore points">${identicalPoint('different-private-id-a')}${identicalPoint('different-private-id-b')}</ol></section></body></html>`)
  await assert.rejects(() => auditVisibleControls(page, 'negative-identical-point-scopes', artifactDir), /duplicate role\/name selectors need a unique semantic/)
  checks.push('WX-0655 auditor negative DOM fixture: identical visible capture scopes remain ambiguous despite different hidden point UUID form names')

  // Approved fixture boundary: strict validated fictional snapshots only, in an
  // owned empty profile. Never used by the real-interaction journey above.
  await context.addInitScript(({ states }) => {
    for (const [module, data] of Object.entries(states)) if (localStorage.getItem(`webappx.demo.${module}`) === null) localStorage.setItem(`webappx.demo.${module}`, JSON.stringify({ schemaVersion: 1, module, data }))
  }, { states })
  const observations = [], captures = []
  async function observe(family, locator, name, variants = statusFamilies[family], labels = locator) {
    await expect(locator).toBeVisible()
    const labelTexts = await labels.allInnerTexts()
    const labelRecords = []
    for (let index = 0; index < labelTexts.length; index += 1) labelRecords.push({ kind: 'status-label', visible: await labels.nth(index).isVisible(), text: labelTexts[index] })
    assert.deepEqual(auditStatusLabelRecords(variants, labelRecords, { exact: labels !== locator }).missing, [], `${family}: every status requires its own visible product label, never a title that contains the same word`)
    for (const state of variants) {
      const exactIndex = labelTexts.findIndex(value => value.trim().replaceAll('-', ' ').toLowerCase() === state.toLowerCase().replaceAll('-', ' '))
      const witnessName = `${name}-${variants.indexOf(state)}-label`
      const labelCapture = exactIndex >= 0 ? `${witnessName}-monochrome.png` : await captureTextWitness(page, artifactDir, witnessName, locator, state)
      if (exactIndex >= 0) await capture(page, artifactDir, witnessName, labels.nth(exactIndex))
      observations.push({ family, state, text: state, capture: `${name}-monochrome.png`, ...(labelCapture ? { labelCapture } : {}) })
    }
    await capture(page, artifactDir, name, locator)
    captures.push(`${name}-monochrome.png`)
  }
  for (const family of ['time', 'pto', 'tasks', 'policies', 'training', 'assets', 'documents', 'service', 'jobs', 'candidates', 'goals', 'reviews', 'surveys']) {
    const route = { time: 'time', pto: 'time-off', service: 'cases', jobs: 'recruiting', candidates: 'recruiting', goals: 'performance', reviews: 'performance' }[family] ?? family
    await page.goto(`${origin}/hr/demo/admin/${route}`)
    const workspace = page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..')
    const labels = family === 'jobs' ? workspace.locator('article p span.capitalize') : family === 'candidates' ? workspace.locator('[aria-label="Fictional candidate list"] button span:last-child') : workspace.locator('span.rounded-full')
    await observe(family, workspace, `statuses-${family}`, statusFamilies[family], labels)
    if (family === 'time') {
      await observe('timeModifiers', workspace, 'statuses-time-modifiers', ['Returned by Morgan Example:'])
      // The paid marker uses the literal consumed receipt identifier.
      await expect(workspace).toContainText('MOCK-QUALITY-PAID')
      observations.push({ family: 'timeModifiers', state: 'included in MOCK-QUALITY-PAID', text: 'included in MOCK-QUALITY-PAID', capture: 'statuses-time-monochrome.png', labelCapture: await captureTextWitness(page, artifactDir, 'statuses-time-paid-label', workspace, 'included in MOCK-QUALITY-PAID') })
    }
  }
  await page.goto(`${origin}/cms/demo`)
  const cms = page.getByRole('heading', { name: 'Content publishing workspace', exact: true }).locator('xpath=ancestor::header').locator('..')
  for (const state of statusFamilies.cms) {
    await page.getByRole('button', { name: state === 'draft' ? /Fictional frozen draft/ : new RegExp(`Fictional content ${state.replaceAll(' ', '-')}`) }).click()
    const selected = page.getByRole('region', { name: 'Selected content', exact: true })
    await observe('cms', selected, `statuses-cms-${state.replaceAll(' ', '-')}`, [state], selected.locator('span.rounded-full'))
  }
  await page.getByRole('button', { name: /Fictional frozen draft/ }).click()
  await expect(cms).toContainText('Reviewer feedback:')
  await expect(cms).toContainText('The published sample is still revision 1')
  await capture(page, artifactDir, 'statuses-cms-draft-modifiers', page.getByRole('region', { name: 'Selected content', exact: true }))
  await page.getByRole('button', { name: /Fictional content approved/ }).click()
  await expect(cms).toContainText('approved by the separate reviewer')
  await observe('cmsModifiers', cms, 'statuses-cms-approval-modifier', ['approved by the separate reviewer'])
  await page.getByRole('button', { name: /Fictional frozen draft/ }).click()
  for (const state of ['Reviewer feedback:', 'The published sample is still revision']) observations.push({ family: 'cmsModifiers', state, text: state, capture: 'statuses-cms-draft-modifiers-monochrome.png', labelCapture: await captureTextWitness(page, artifactDir, `statuses-cms-modifier-${state.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`, page.getByRole('region', { name: 'Selected content', exact: true }), state) })
  await page.goto(`${origin}/crm/demo`)
  const crm = page.getByRole('region', { name: 'CRM mock workspace', exact: true })
  for (const [family, tab] of [['crmLead', 'Leads'], ['crmOpportunity', 'Pipeline'], ['crmTask', 'Follow-up tasks']]) {
    await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), tab).click()
    await observe(family, crm, `statuses-${family}`, statusFamilies[family], crm.locator('article span.rounded-full'))
  }
  // Generic fixture values are rendered by the same real Status/RecordTable
  // components; inspect all existing static fixture routes, not one badge.
  const staticRoutes = [
    ['company', ['mock']], ['company/locations', ['synthetic']], ['company/pay-schedules', ['mock']],
    ['payroll', ['draft', 'mock complete']], ['contractor-payments', ['synthetic', 'pending']],
    ['benefits', ['illustrative']], ['contractors', ['in progress', 'complete']], ['access', ['mock']], ['automation', ['disabled']], ['organization', ['sample']],
  ]
  for (const [route, values] of staticRoutes) {
    await page.goto(`${origin}/hr/demo/admin/${route}`)
    const workspace = page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..')
    await observe('staticRecords', workspace, `statuses-static-${route.replaceAll('/', '-')}`, values)
  }
  await page.goto(`${origin}/hr/demo/admin/integrations/gusto`)
  await observe('provider', page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..'), 'statuses-provider', statusFamilies.provider.filter(state => state !== 'Disabled'))
  await page.goto(`${origin}/hr/demo/admin/company`)
  await observe('provider', page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..'), 'statuses-provider-disabled', ['Disabled'])
  await page.goto(`${origin}/hr/demo/admin/employees`)
  await observe('employment', page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..'), 'statuses-employment')
  // Isolated fixture updates below revalidate the complete graph before loading.
  // They prove rendering, never claim that user actions reached these states.
  async function loadVariant(next, path) {
    await validateFixture(next)
    await page.evaluate(next => { for (const [module, data] of Object.entries(next)) localStorage.setItem(`webappx.demo.${module}`, JSON.stringify({ schemaVersion: 1, module, data })) }, next)
    await page.goto(`${origin}${path}`)
  }
  // Variant rendering uses actual exported components below. The independent
  // normal-app fixture already covers every public HR auxiliary module and CRM.
  const variantEvidence = await renderStatusVariants({ page, origin, artifactDir, states, observations, loadVariant })
  await recoveryStatusFixtures({ page, origin, artifactDir, states, observations, loadVariant })
  await importStatusFixtures({ page, context, origin, artifactDir, states, seed, observations })
  const coverage = auditStatusCoverage(statusFamilies, observations)
  await writeFile(join(artifactDir, 'status-coverage.json'), JSON.stringify({ boundary: 'Strict fictional render fixtures; no transition acceptance', coverage, observations, captures, variantEvidence }, null, 2) + '\n')
  assert.deepEqual(coverage.missing, [], 'Every inventoried workflow state requires actual text and a monochrome product capture')
  await statusContactSheets(page, artifactDir, observations)
  checks.push(`WX-0720: all ${coverage.expected} inventoried workflow/status meanings are observed as real text in actual product components under grayscale; rare states use explicitly labeled strict synthetic render fixtures and retained captures`)
  return { coverage, captures, variantEvidence }
}

export async function renderStatusVariants({ page, artifactDir, states, observations, loadVariant }) {
  const captures = []
  async function actual(family, state, text, name, scope) {
    await expect(scope).toContainText(text)
    await capture(page, artifactDir, name, scope)
    const rendered = await scope.innerText()
    assert.ok(rendered.toLocaleLowerCase('en-US').includes(text.toLocaleLowerCase('en-US')), `Visible rendered text must contain ${JSON.stringify(text)}; CSS capitalization may change letter case`)
    observations.push({ family, state, text, capture: `${name}-monochrome.png` }); captures.push(`${name}-monochrome.png`)
    observations.at(-1).labelCapture = await captureTextWitness(page, artifactDir, `${name}-${state.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-label`, scope, text)
  }
  for (const stage of statusFamilies.onboarding) {
    const next = structuredClone(states), onboarding = next.hr.workflow.onboarding['employee-002']
    Object.assign(onboarding, { stage, profileReviewed: stage !== 'draft', jobReviewed: stage !== 'draft', tasks: Object.fromEntries(Object.keys(onboarding.tasks).map(id => [id, stage !== 'draft'])), ...(stage === 'complete' ? { receipt: 'MOCK-QUALITY-ONBOARDING' } : {}) })
    await loadVariant(next, '/hr/demo/employee/onboarding')
    const panel = page.getByRole('heading', { name: 'Complete sample onboarding · Avery', exact: true }).locator('..')
    await actual('onboarding', stage, stage === 'complete' ? 'Simulated onboarding completed · MOCK-QUALITY-ONBOARDING' : `Sample status: ${stage}`, `statuses-onboarding-${stage}`, panel)
    const flags = stage === 'draft' ? ['Profile: pending', 'Job: pending', 'Mark complete'] : ['Profile: reviewed', 'Job: reviewed', 'Complete']
    const checklistLabels = panel.locator('button[aria-pressed] > span:last-child')
    await expect(checklistLabels).toHaveCount(Object.keys(onboarding.tasks).length)
    assert.ok((await checklistLabels.allInnerTexts()).every(text => text === (stage === 'draft' ? 'Mark complete' : 'Complete')), 'Every real checklist state label must match; the panel heading cannot substitute')
    for (const state of flags) { await expect(panel).toContainText(state); observations.push({ family: 'onboardingFlags', state, text: state, capture: `statuses-onboarding-${stage}-monochrome.png`, labelCapture: await captureTextWitness(page, artifactDir, `statuses-onboarding-${stage}-${state.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-label`, panel, state) }) }
  }
  const [{ hrFixture }] = await Promise.all([loadMockModel(new URL('../../src/hr/catalog.ts', import.meta.url))])
  for (const [index, stage] of statusFamilies.benefits.entries()) {
    const next = structuredClone(states)
    next.hr.workflow.benefitElections = hrFixture.benefits.map((plan, planIndex) => ({ employeeId: 'employee-002', planId: plan.id, election: planIndex ? 'waive' : 'enroll', stage, ...(stage === 'confirmed' ? { receipt: `MOCK-QUALITY-BENEFIT-${index}-${planIndex}` } : {}) }))
    await loadVariant(next, '/hr/demo/employee/benefits')
    const workspace = page.getByText('Synthetic HR demo · no account or credentials required', { exact: true }).locator('..').locator('..')
    await expect(workspace.locator('article span.rounded-full')).toHaveText([stage, stage], { ignoreCase: true })
    await actual('benefits', stage, stage, `statuses-benefits-${stage}`, workspace)
    if (index === 0) {
      const summary = page.getByRole('heading', { name: 'Your sample election summary', exact: true }).locator('..')
      const choices = await summary.locator('tbody tr td:nth-child(2)').allInnerTexts()
      assert.deepEqual(choices, ['enroll', 'waive'], 'Actual visible election table cells must distinguish enrollment and waiver')
      for (const election of statusFamilies.benefitChoices) observations.push({ family: 'benefitChoices', state: election, text: election, capture: `statuses-benefits-${stage}-monochrome.png`, labelCapture: await captureTextWitness(page, artifactDir, `statuses-benefits-${election}-label`, summary, election) })
    }
  }
  for (const stage of statusFamilies.payroll) {
    const next = structuredClone(states)
    const payroll = next.hr.workflow.payroll
    Object.assign(payroll, { stage, period: { start: '2026-10-01', end: '2026-10-15' } })
    if (stage !== 'idle') Object.assign(payroll, { inputs: [{ entryId: 'quality-time-approved', employeeId: 'employee-002', date: '2026-10-03', hours: 1, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }], benefitInputs: [], hours: 1 })
    if (['calculated', 'reviewed', 'submitted'].includes(stage)) Object.assign(payroll, { employeeTotals: [{ employeeId: 'employee-002', hours: 1, grossCents: 3000, illustrativeWithholdingCents: 600, benefitDeductionCents: 0, netCents: 2400 }], grossCents: 3000, illustrativeWithholdingCents: 600, netCents: 2400 })
    if (stage === 'submitted') payroll.receipt = 'MOCK-QUALITY-PAYROLL'
    await loadVariant(next, '/hr/demo/admin/payroll')
    const panel = page.getByRole('heading', { name: 'Run a simulated payroll', exact: true }).locator('..')
    const visibleStatus = panel.getByRole('status')
    await actual('payroll', stage, stage === 'submitted' ? 'Simulated submission complete · MOCK-QUALITY-PAYROLL' : `Sample payroll stage: ${stage}`, `statuses-payroll-${stage}`, visibleStatus)
    if (stage === 'prepared') {
      next.hr.workflow.timeEntries.find(entry => entry.id === 'quality-time-approved').hours = 2
      await loadVariant(next, '/hr/demo/admin/payroll')
      const warning = page.getByRole('alert').filter({ hasText: 'Payroll preparation is stale.' })
      await actual('payrollFreshness', 'Payroll preparation is stale.', 'Payroll preparation is stale.', 'statuses-payroll-stale', warning)
    }
  }
  // Survey drafts are rendered in the owning employee's answer form; owner
  // results deliberately exclude private drafts. Exercise the real draft-save
  // notification so its meaning is measured, not inferred from field values.
  await loadVariant(states, '/hr/demo/employee/surveys')
  const closedSurvey = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fictional survey closed', exact: true }) }).last()
  for (const state of statusFamilies.surveyClosedDraft) { await expect(closedSurvey).toContainText(state); observations.push({ family: 'surveyClosedDraft', state, text: state, capture: 'statuses-survey-closed-draft-monochrome.png' }) }
  await capture(page, artifactDir, 'statuses-survey-closed-draft', closedSurvey)
  const survey = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fictional survey published', exact: true }) }).last()
  await button(survey, 'Save my sample answers').click()
  await actual('surveyResponse', 'draft', 'saved privately as a draft', 'statuses-survey-response-draft', survey)
  await button(survey, 'Submit my sample response').click()
  await actual('surveyResponse', 'submitted', 'Your submitted sample response', 'statuses-survey-response-submitted', survey)
  // A controlled render-only fixture mounts actual exported notice/summary and
  // budget components. These sources receive the same public props as the app;
  // no replacement badge markup is used, and no live workspace is modified.
  await page.evaluate(async states => {
    const observedModule = suffix => {
      const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => { const parsed = new URL(name); return parsed.origin === location.origin && parsed.pathname.endsWith(suffix) })
      if (!url) throw new Error(`The owned application did not load ${suffix}`)
      return url
    }
    const [{ default: React }, clientModule, { DemoStorageNotice }, { WorkspaceSaveSummary }, { RestoreBudgetPreview }, { WorkspaceInspection, WorkspaceDifferencePreview }] = await Promise.all([
      import(observedModule('/deps/react.js')), import(observedModule('/deps/react-dom_client.js')),
      import('/src/portals/DemoStorageNotice.tsx'), import('/src/portals/PortalChrome.tsx'), import('/src/portals/RestoreBudgetPreview.tsx'), import('/src/portals/WorkspaceInspection.tsx'),
    ])
    const createRoot = clientModule.createRoot ?? clientModule.default?.createRoot
    if (typeof createRoot !== 'function') throw new Error('The observed React DOM module does not expose createRoot')
    document.getElementById('root').hidden = true
    const container = document.createElement('main'); container.id = 'quality-render-fixtures'; document.body.append(container)
    const create = React.createElement
    const storage = [
      ['ready', 'HR is ready. Saved actions stay in this browser across refresh.'],
      ['saved', 'HR sample saved in this browser.'],
      ['restored', 'HR sample restored from this browser.'],
      ['reset', 'HR saved sample removed. Original fictional records are restored.'],
      ['unavailable', 'HR changes are only in memory because this browser could not save them. Refresh may lose changes.'],
      ['recovered', 'HR could not restore an incompatible or damaged save. Fresh fictional records are open.'],
    ]
    const allowed = { ok: true, canRestore: true, selected: [{ module: 'hr', characters: 100, limit: 2000000 }], selectedCharacters: 100, newPointCharacters: 150, currentHistoryCharacters: 0, projectedHistoryCharacters: 150, historyLimit: 2000000, retainedPoints: 1, prunedPoints: 0 }
    const budgets = [['empty', null], ['refused', { ok: false, message: 'Storage preview refused. Unsupported fictional fixture.' }], ['allowed', allowed], ['blocked', { ...allowed, canRestore: false, reason: 'The selected fictional workspace exceeds its limit.' }]]
    createRoot(container).render(create(React.Fragment, null,
      create('h1', null, 'Render-only fictional status examples — no workflow transition claim'),
      ...storage.map(([kind, message]) => create('section', { key: kind, 'aria-label': `Storage fixture ${kind}`, className: 'm-5 border p-4' }, create(DemoStorageNotice, { status: { kind, message } }), create(WorkspaceSaveSummary, { label: 'HR', status: { kind, message } }))),
      ...budgets.map(([id, budget]) => create('section', { key: id, 'aria-label': `Budget fixture ${id}`, className: 'm-5 border p-4' }, create(RestoreBudgetPreview, { budget, onRefresh() {} }))),
      create(WorkspaceInspection, { states, modules: [], title: 'Fictional empty inspection fixture' }),
      create(WorkspaceInspection, { states: { hr: {} }, modules: ['hr'], title: 'Fictional refused inspection fixture' }),
      create(WorkspaceDifferencePreview, { current: states, target: states, modules: [], title: 'Fictional empty difference fixture' }),
      create(WorkspaceDifferencePreview, { current: { hr: {} }, target: { hr: {} }, modules: ['hr'], title: 'Fictional refused difference fixture' }),
      create(WorkspaceDifferencePreview, { current: states, target: states, modules: ['cms'], title: 'Fictional unchanged difference fixture' }),
    ))
  }, states)
  const notices = { ready: 'HR is ready.', saved: 'HR sample saved', restored: 'HR sample restored', reset: 'HR saved sample removed', unavailable: 'only in memory', recovered: 'incompatible or damaged save' }
  for (const [kind, text] of Object.entries(notices)) await actual('storage', kind, text, `statuses-storage-${kind}`, page.getByRole('region', { name: `Storage fixture ${kind}`, exact: true }))
  for (const [name, state] of [['empty', 'Select at least one workspace'], ['refused', 'Storage preview refused'], ['allowed', 'Selected workspace total'], ['blocked', 'Restore is unavailable']]) await actual('budget', state, state, `statuses-budget-${name}`, page.getByRole('region', { name: `Budget fixture ${name}`, exact: true }))
  for (const [title, values] of [
    ['Fictional empty inspection fixture', ['Select at least one workspace to inspect its records.']],
    ['Fictional refused inspection fixture', ['Record inspection is unavailable']],
    ['Fictional empty difference fixture', ['Select at least one workspace to compare before restoring.']],
    ['Fictional refused difference fixture', ['Difference inspection is unavailable']],
    ['Fictional unchanged difference fixture', ['No saved record or listed metadata differences', 'Added', 'Removed', 'Changed', 'Unchanged']],
  ]) {
    const scope = page.getByRole('region', { name: title, exact: true }), name = `statuses-${title.toLowerCase().replaceAll(' ', '-')}`
    if (title === 'Fictional unchanged difference fixture') await expect(scope.locator('dl dt')).toHaveText(['Added', 'Removed', 'Changed', 'Unchanged'], { ignoreCase: true })
    for (const state of values) await actual('inspection', state, ['Added', 'Removed', 'Changed', 'Unchanged'].includes(state) ? state.toLowerCase() : state, name, scope)
  }
  return { boundary: 'Actual normal app with strict known synthetic snapshots; actual exported notice/budget components with fictional props', captures }
}

export async function runPortalQuality({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], qualityEvidence = {}
  async function journey(name, run) {
    let context, page, failure, tracing = false
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
      qualityEvidence[name] = await run({ page, context, origin, artifactDir, seed, checks })
    } catch (error) {
      failure = error
      if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDir, `${name}-failure.png`), fullPage: true, timeout: 5000 }).catch(() => {})
      throw error
    } finally {
      const errors = []
      if (tracing) try { await context.tracing.stop({ path: join(artifactDir, `${name}-trace.zip`) }) } catch (error) { errors.push(error.message) }
      if (context) try { await context.close() } catch (error) { errors.push(error.message) }
      if (errors.length && failure) failure.artifactErrors = errors
      else if (errors.length) throw new Error(`Quality ${name} cleanup failed: ${errors.join('; ')}`)
    }
  }
  try {
    await journey('native', nativeJourney)
    await journey('statuses', statusJourney)
    assert.deepEqual(problems, [])
    return { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, coveredItems: ['WX-0655', 'WX-0720', 'WX-0722'], qualityEvidence }
  } catch (error) {
    error.smokeEvidence = { checks, problems, warnings: [...new Set(warnings)], qualityEvidence }
    throw error
  }
}

export async function recoveryStatusFixtures({ page, origin, artifactDir, states, observations, loadVariant }) {
  const { points, history } = await statusHistoryFixture(states)
  assert.equal(points.length, 5)
  await loadVariant(states, '/portals')
  await page.evaluate(history => localStorage.setItem('webappx.demo.restore-points', history), history)
  await page.reload()
  const region = page.getByRole('region', { name: 'Restore points', exact: true })
  for (const state of ['manual capture', 'selective restore', 'Undo', 'individual import', 'portal Reset']) {
    await expect(region).toContainText(state)
    const labelCapture = await captureTextWitness(page, artifactDir, `statuses-recovery-${state.toLowerCase().replaceAll(' ', '-')}-label`, region.locator('ol[aria-label="Saved restore points"]'), state, 'li p')
    observations.push({ family: 'recovery', state, text: state, capture: 'statuses-recovery-kinds-monochrome.png', labelCapture })
  }
  await capture(page, artifactDir, 'statuses-recovery-kinds', region)
  const multiPointAudit = await auditVisibleControls(page, 'five-recovery-kinds', artifactDir)
  assert.ok(multiPointAudit.repeated.some(group => group.name === 'Inspect captured records' && group.count === 5 && group.resolved), 'Every repeated point action must be measured against its unique visible label/kind/module/time scope')
  await region.getByRole('button', { name: 'Undo restore point 2026-10-15T12:00:00.000Z HR, CMS, CRM', exact: true }).click()
  const undo = page.getByRole('region', { name: 'Undo preview', exact: true })
  await expect(undo).toContainText('Undo HR, CMS, CRM')
  await capture(page, artifactDir, 'statuses-recovery-undo', undo)
  observations.push({ family: 'recovery', state: 'Undo HR, CMS, CRM', text: 'Undo HR, CMS, CRM', capture: 'statuses-recovery-undo-monochrome.png', labelCapture: await captureTextWitness(page, artifactDir, 'statuses-recovery-undo-heading', undo, 'Undo HR, CMS, CRM') })
  await button(undo, 'Cancel undo').click()
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(file('fictional-status-combined.json', { format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces: states }))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  await preview.getByRole('checkbox', { name: /^Restore HR/ }).check()
  await expect(preview).toContainText('will be replaced')
  await capture(page, artifactDir, 'statuses-recovery-selected', preview)
  observations.push({ family: 'recovery', state: 'will be replaced', text: 'HR will be replaced', capture: 'statuses-recovery-selected-monochrome.png', labelCapture: await captureTextWitness(page, artifactDir, 'statuses-recovery-selected-explanation', preview, 'HR will be replaced') })
  await button(preview, 'Cancel combined restore').click()
  await open(page, 'Content management')
  const imports = backup(page, 'CMS')
  await imports.getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(file('fictional-status-cms.json', individual('cms', states.cms)))
  await expect(imports).toContainText('Ready to replace')
  await capture(page, artifactDir, 'statuses-import-preview', imports)
  observations.push({ family: 'recovery', state: 'Ready to replace', text: 'Ready to replace CMS workspace', capture: 'statuses-import-preview-monochrome.png' })
  await button(imports, 'Cancel import').click()
  await expect(imports).toContainText('Current workspace unchanged.')
  await capture(page, artifactDir, 'statuses-import-canceled', imports)
  observations.push({ family: 'recovery', state: 'Current workspace unchanged.', text: 'Import canceled. Current workspace unchanged.', capture: 'statuses-import-canceled-monochrome.png' })
  assert.equal(new URL(page.url()).origin, origin)
}

async function importStatusFixtures({ page, context, origin, artifactDir, states, seed, observations }) {
  // Platform fixture only: hold the selected fictional File.text promise so
  // real React file-input handlers expose their transient reading states. No
  // model, React state, backend, provider or user browser profile is injected.
  assert.deepEqual(await snapshot(page, artifactDir, 'quality-import-status-before'), states)
  const initialSlots = await saved(context, origin)
  await page.evaluate(() => {
    const original = File.prototype.text
    let release
    File.prototype.text = function () {
      if (!this.name.startsWith('quality-held-')) return original.call(this)
      return new Promise((resolve, reject) => { release = () => original.call(this).then(resolve, reject) })
    }
    window.__qualityHeldFile = { release() { if (!release) throw new Error('The fictional local file was not read'); const current = release; release = undefined; return current() }, restore() { File.prototype.text = original; delete window.__qualityHeldFile } }
  })
  async function witness(state, text, scope, name) {
    await expect(scope).toContainText(text)
    const labelCapture = await captureTextWitness(page, artifactDir, name, scope, text)
    observations.push({ family: 'importWorkflow', state, text, capture: labelCapture, boundary: state.includes('reading') ? 'Held fictional local File.text platform fixture; actual product file-input handler and controls' : 'Actual native local-file controls and messages' })
  }
  const unchanged = async label => assert.deepEqual(await saved(context, origin), initialSlots, `${label}: every workspace, history and unrelated saved byte remains unchanged`)
  try {
    await open(page, 'Content management')
    const individualRegion = backup(page, 'CMS')
    await individualRegion.getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(file('quality-held-individual.json', individual('cms', states.cms)))
    await witness('individual reading', 'Reading local backup…', individualRegion, 'statuses-import-reading-individual')
    await expect(button(individualRegion, 'Import workspace')).toBeDisabled()
    await expect(button(individualRegion, 'Cancel import')).toBeVisible()
    await unchanged('Held individual read')
    await button(individualRegion, 'Cancel import').click()
    await page.evaluate(() => window.__qualityHeldFile.release())
    await expect(individualRegion).toContainText('Import canceled. Current workspace unchanged.')
    await expect(individualRegion.getByRole('heading', { name: 'Ready to replace CMS workspace', exact: true })).toHaveCount(0)
    await unchanged('Canceled individual read')
    await individualRegion.getByLabel('CMS backup JSON file', { exact: true }).setInputFiles({ name: 'quality-invalid-individual.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') })
    await witness('individual refused', 'The file is not a valid JSON mock workspace backup. Current workspace unchanged.', individualRegion, 'statuses-import-invalid-individual')
    await unchanged('Invalid individual import')
    await open(page, 'Portal directory')
    const combinedRegion = combined(page)
    const bundle = { format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces: states }
    await combinedRegion.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(file('quality-held-combined.json', bundle))
    await witness('combined reading', 'Reading combined backup…', combinedRegion, 'statuses-import-reading-combined')
    await expect(button(combinedRegion, 'Import combined backup')).toBeDisabled()
    await expect(button(combinedRegion, 'Cancel combined restore')).toBeVisible()
    await unchanged('Held combined read')
    await button(combinedRegion, 'Cancel combined restore').click()
    await page.evaluate(() => window.__qualityHeldFile.release())
    await expect(page.getByRole('region', { name: 'Selective restore preview', exact: true })).toHaveCount(0)
    await unchanged('Canceled combined read')
    await combinedRegion.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles({ name: 'quality-invalid-combined.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') })
    await witness('combined refused', 'The file is not a valid JSON combined workspace backup. Current workspaces unchanged.', combinedRegion, 'statuses-import-invalid-combined')
    await unchanged('Invalid combined import')
    await combinedRegion.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(file('quality-empty-selection-combined.json', bundle))
    const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
    await witness('combined empty selection', 'Select at least one workspace. Nothing is selected automatically.', preview, 'statuses-import-combined-empty-selection')
    for (const name of ['HR', 'CMS', 'CRM']) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${name}`) })).not.toBeChecked()
    await expect(button(preview, 'Restore selected workspaces')).toBeDisabled()
    await unchanged('Combined empty selection')
    await button(preview, 'Cancel combined restore').click()
    await witness('combined canceled', 'Combined restore canceled. Current workspaces unchanged.', combinedRegion, 'statuses-import-combined-canceled')
    await unchanged('Combined preview cancel')
    assert.deepEqual(await snapshot(page, artifactDir, 'quality-import-status-unchanged'), states)
    await open(page, 'Content management')
    const acceptedRegion = backup(page, 'CMS')
    await acceptedRegion.getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(file('quality-accepted-individual.json', individual('cms', seed.workspaces.cms)))
    await expect(acceptedRegion.getByRole('heading', { name: 'Ready to replace CMS workspace', exact: true })).toBeVisible()
    await button(acceptedRegion, 'Replace CMS workspace').click()
    const acceptedMessage = page.getByRole('heading', { name: 'Content publishing workspace', exact: true }).locator('xpath=ancestor::header').locator('..').locator(':scope > div[role="status"]')
    await witness('individual accepted', 'CMS workspace imported and saved in this browser.', acceptedMessage, 'statuses-import-accepted-individual')
    const expectedSlots = { ...initialSlots, 'webappx.demo.cms': JSON.stringify({ schemaVersion: 1, module: 'cms', data: seed.workspaces.cms }) }
    assert.deepEqual(await saved(context, origin), expectedSlots, 'Accepted individual import changes only its complete selected save; history and other saved bytes remain exact')
    assert.deepEqual(await snapshot(page, artifactDir, 'quality-import-status-accepted'), { ...states, cms: seed.workspaces.cms })
  } finally { await page.evaluate(() => window.__qualityHeldFile?.restore()) }
}

async function statusContactSheets(page, artifactDir, observations) {
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const unique = [...new Map(observations.map(item => [JSON.stringify([item.family, item.state]), item])).values()]
  // Each thumbnail is a retained screenshot of actual product rendering. The
  // surrounding table labels identify evidence, not replacement product badges.
  for (let start = 0; start < unique.length; start += 24) {
    const rows = await Promise.all(unique.slice(start, start + 24).map(async item => {
      const png = (await readFile(join(artifactDir, item.labelCapture ?? item.capture))).toString('base64')
      return `<article><strong>${escape(item.family)} · ${escape(item.state)}</strong><img alt="Actual monochrome product capture" src="data:image/png;base64,${png}"><small>${escape(item.capture)}</small></article>`
    }))
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Actual status capture contact sheet</title><style>body{margin:20px;font:14px system-ui;background:white;color:black}h1{font-size:20px}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}article{border:1px solid #777;padding:8px;min-height:110px;overflow:hidden}strong,small{display:block;overflow-wrap:anywhere}img{display:block;max-width:100%;height:76px;object-fit:contain;object-position:left center;margin:6px 0}small{font-size:9px}</style></head><body><h1>Actual monochrome product captures · entries ${start + 1}–${Math.min(start + 24, unique.length)} / ${unique.length}</h1><p>Render fixtures prove visible meaning; native user journeys are recorded separately. Open individual PNGs for full context.</p><main>${rows.join('')}</main></body></html>`
    await writeFile(join(artifactDir, `status-contact-sheet-${Math.floor(start / 24) + 1}.html`), html)
    await page.setContent(html)
    await page.screenshot({ path: join(artifactDir, `status-contact-sheet-${Math.floor(start / 24) + 1}.png`), fullPage: true })
  }
}

export async function statusHistoryFixture(states) {
  const { createRestorePoint, parseRestorePoints } = await loadMockModel(new URL('../../src/portals/restore-points.ts', import.meta.url))
  const kinds = ['manual', 'restore', 'undo', 'import', 'reset']
  const labels = { manual: 'Fictional manual status capture', import: 'Before fictional HR individual import', reset: 'Before fictional HR portal Reset' }
  const points = kinds.map((kind, index) => createRestorePoint(states, ['import', 'reset'].includes(kind) ? ['hr'] : ['hr', 'cms', 'crm'], kind, kind === 'undo' ? 'quality-history-manual' : undefined, { id: `quality-history-${kind}`, createdAt: `2026-10-15T12:00:0${index}.000Z`, ...(labels[kind] ? { label: labels[kind] } : {}) }))
  const history = JSON.stringify({ schemaVersion: 1, points })
  assert.deepEqual(parseRestorePoints(history), points)
  return { points, history }
}
