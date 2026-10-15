import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { inflateSync } from 'node:zlib'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'

const historyKey = 'webappx.demo.restore-points'
const preferencesKey = 'webappx.demo.recovery-preferences'
const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, title) => navigation(page).getByRole('link', { name: title, exact: true }).click()
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const dialog = page => page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
const backup = (page, module) => page.getByRole('region', { name: `${module.toUpperCase()} workspace backup`, exact: true })
const upload = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
const combinedFile = states => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces: states })
const individualFile = (module, state) => ({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt: '2026-10-15T12:00:00.000Z', data: state })
const lastDownload = new WeakMap()

function inspectCapturePng(bytes) {
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Capture must be an actual PNG')
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
  assert.equal(bytes[24], 8, 'Capture inspection requires 8-bit browser PNG pixels')
  assert.ok([2, 6].includes(bytes[25]), 'Capture must contain RGB or RGBA browser pixels')
  assert.equal(bytes[28], 0, 'Capture inspection requires a non-interlaced browser PNG')
  const channels = bytes[25] === 6 ? 4 : 3, stride = width * channels
  const length = height * (stride + 1)
  assert.ok(length > 0 && length <= 64_000_000, 'Capture pixel inspection must remain bounded')
  const chunks = []
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
    assert.ok(offset + length + 12 <= bytes.length, 'Capture PNG chunk must be complete')
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
    if (type === 'IEND') break
  }
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: length })
  assert.equal(raw.length, length)
  let offset = 0, previous = Buffer.alloc(stride), darkPixels = 0, nonGrayPixels = 0
  const darkBounds = { left: width, top: height, right: -1, bottom: -1 }
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = Buffer.alloc(stride)
    assert.ok(filter >= 0 && filter <= 4, 'Capture PNG filter must be supported')
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, above = previous[x], upperLeft = x >= channels ? previous[x - channels] : 0
      const prediction = left + above - upperLeft
      const dl = Math.abs(prediction - left), da = Math.abs(prediction - above), du = Math.abs(prediction - upperLeft)
      const paeth = dl <= da && dl <= du ? left : da <= du ? above : upperLeft
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth][filter]
      row[x] = (raw[offset++] + predictor) & 255
    }
    for (let x = 0; x < width; x++) {
      const index = x * channels, r = row[index], g = row[index + 1], b = row[index + 2]
      if (channels === 4 && row[index + 3] === 0) continue
      if (r !== g || g !== b) nonGrayPixels++
      if (Math.max(r, g, b) < 80) {
        darkPixels++
        darkBounds.left = Math.min(darkBounds.left, x); darkBounds.right = Math.max(darkBounds.right, x)
        darkBounds.top = Math.min(darkBounds.top, y); darkBounds.bottom = Math.max(darkBounds.bottom, y)
      }
    }
    previous = row
  }
  return { width, height, nonGrayPixels, darkPixels, darkBounds: darkPixels ? darkBounds : null }
}

async function grayscaleCapture(page, scope, artifactDir, name) {
  // Display-only probe for the current rendered state. It neither changes the
  // application model nor asserts a device/browser accessibility certification.
  await expect(scope).toBeVisible()
  await scope.scrollIntoViewIfNeeded()
  const read = () => scope.evaluate(element => ({ modal: element.matches('dialog:modal'), text: element.innerText, open: element.tagName === 'DIALOG' ? element.open : null, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
  const before = await read()
  assert.ok(before.text.trim().length >= 30, 'Capture must contain meaningful rendered text')
  if (before.modal) {
    await expect(scope.getByRole('heading', { name: 'Leave with unsaved changes?', exact: true })).toBeVisible()
    for (const choice of ['Keep editing', 'Discard and leave']) await expect(button(scope, choice)).toBeVisible()
    assert.equal(before.open, true)
    assert.ok(before.width >= 300 && before.height >= 200, 'A modal capture cannot be a collapsed strip')
  } else assert.ok(before.width >= 250 && before.height >= 80, 'A state capture must have nontrivial bounds')
  // Native dialogs render in the top layer, outside the root filter's effect.
  const style = await page.addStyleTag({ content: 'html,dialog:modal{filter:grayscale(1)!important}dialog::backdrop{filter:grayscale(1)!important;backdrop-filter:grayscale(1)!important}' })
  let pixels, after
  try {
    const bytes = await scope.screenshot({ path: join(artifactDir, `${name}-grayscale.png`) })
    after = await read()
    await expect(scope).toBeVisible()
    assert.equal(after.text, before.text, 'Rendered text must remain identical throughout capture')
    assert.equal(after.modal, before.modal); assert.equal(after.open, before.open)
    assert.ok(Math.abs(after.width - before.width) <= 1 && Math.abs(after.height - before.height) <= 1, 'Capture bounds must remain stable')
    if (before.modal) {
      await expect(scope.getByRole('heading', { name: 'Leave with unsaved changes?', exact: true })).toBeVisible()
      for (const choice of ['Keep editing', 'Discard and leave']) await expect(button(scope, choice)).toBeVisible()
    }
    pixels = inspectCapturePng(bytes)
    assert.ok(Math.abs(pixels.width - before.width) <= 2 && Math.abs(pixels.height - before.height) <= 2, 'PNG must cover the complete measured state, including the full modal height')
    assert.equal(pixels.nonGrayPixels, 0, 'Every actual captured visible RGB pixel must be monochrome')
    assert.ok(pixels.darkPixels >= 500, 'A blank white/gray capture cannot establish readable state evidence')
  }
  finally { await style.evaluate(element => element.remove()) }
  await writeFile(join(artifactDir, `${name}-capture-proof.json`), JSON.stringify({ modal: before.modal, textLength: before.text.trim().length, textSha256: createHash('sha256').update(before.text).digest('hex'), stableText: after.text === before.text, before: { width: before.width, height: before.height, open: before.open }, after: { width: after.width, height: after.height, open: after.open }, png: pixels }, null, 2) + '\n')
}

async function choose(page, choice) {
  await expect(dialog(page)).toBeVisible()
  await expect(button(dialog(page), 'Keep editing')).toBeFocused()
  await button(dialog(page), choice).click()
  await expect(dialog(page)).not.toBeVisible()
}

async function slots(context, origin) {
  const state = await context.storageState()
  assert.deepEqual(state.cookies, [], 'The account-free journeys must not create account or session cookies')
  assert.ok(state.origins.every(item => item.origin === origin), 'Only the owned loopback origin may have browser storage')
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]).sort(([a], [b]) => a.localeCompare(b)))
}

async function additionalPage(context, problems, warnings) {
  const page = await context.newPage()
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(30_000)
  page.on('pageerror', error => problems.push(`Additional owned page error: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`Additional owned page console error: ${message.text()}`)
    else if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('response', response => { if (response.status() >= 400) problems.push(`Additional owned page HTTP ${response.status()}: ${response.url()}`) })
  page.on('requestfailed', request => problems.push(`Additional owned page failed request: ${request.url()} (${request.failure()?.errorText})`))
  return page
}

async function download(page, control, artifactDir, name) {
  // A real browser can throttle a rapid burst of otherwise legitimate exports.
  const remaining = 150 - (Date.now() - (lastDownload.get(page) ?? 0))
  if (remaining > 0) await delay(remaining)
  lastDownload.set(page, Date.now())
  const waiting = page.waitForEvent('download')
  await control.click()
  const result = await waiting
  const path = join(artifactDir, `${name}.json`)
  await result.saveAs(path)
  assert.equal(await result.failure(), null, 'The actual backup download must finish')
  return { path, value: JSON.parse(await readFile(path, 'utf8')) }
}

async function exportAll(page, artifactDir, name, leaveChoice) {
  await open(page, 'Portal directory')
  if (leaveChoice) await choose(page, leaveChoice)
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  const result = await download(page, button(page.getByRole('region', { name: 'Combined workspace backup', exact: true }), 'Export all workspaces'), artifactDir, name)
  assert.deepEqual(Object.keys(result.value).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(result.value.format, 'webappx-mock-workspaces')
  assert.equal(result.value.schemaVersion, 1)
  assert.deepEqual(Object.keys(result.value.workspaces).sort(), ['cms', 'crm', 'hr'])
  return result.value.workspaces
}

async function restorePreview(page, states, modules, filename) {
  await page.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload(filename, combinedFile(states)))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  await expect(preview.getByRole('heading', { name: 'Choose workspaces to restore', exact: true })).toBeFocused()
  for (const module of modules) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module.toUpperCase()}`) }).check()
  return preview
}

async function applyRestore(page, states, modules, filename) {
  const preview = await restorePreview(page, states, modules, filename)
  await button(preview, 'Restore selected workspaces').click()
  await expect(preview).not.toBeVisible()
}

function expectCompany(states, name, sequence, ownerId = 'crm-owner') {
  states.crm.companies.push({ id: `company-${String(sequence).padStart(4, '0')}`, name, ownerId })
  states.crm.activity.unshift({ receipt: `MOCK-CRM-${String(sequence).padStart(4, '0')}`, ownerId, action: 'create-company', description: `Created sample company ${name}.` })
  states.crm.sequence = sequence + 1
}

async function createCompany(page, name) {
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Companies & contacts').click()
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill(name)
  await button(page, 'Create sample company').click()
}

function expectCmsEdit(states, id, content, sequence) {
  const entry = states.cms.entries.find(item => item.id === id)
  Object.assign(entry, content, { revision: entry.revision + 1, status: 'draft', approval: null, feedback: '' })
  states.cms.activity.push({ receipt: `MOCK-CMS-${String(sequence).padStart(4, '0')}`, entryId: id, revision: entry.revision, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  states.cms.sequence = sequence
}

async function navigationJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  const expected = structuredClone(seed.workspaces)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-00-seed'), expected)
  const freshSlots = await slots(context, origin)
  await open(page, 'Content management')
  const initialTitle = expected.cms.entries.find(item => item.id === 'cms-article-001').title
  const localTitle = 'Unsaved CMS navigation acceptance title'
  await page.locator('#edit-title').fill(localTitle)
  await open(page, 'Customer relationships')
  await grayscaleCapture(page, dialog(page), artifactDir, 'navigation-unsaved-dialog')
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/cms/demo`)
  await expect(page.locator('#edit-title')).toHaveValue(localTitle)
  assert.deepEqual(await slots(context, origin), freshSlots)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-01-retained-cms-excluded', 'Leave and keep draft'), expected)
  await page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true }).click()
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/cms/demo`)
  await expect(page.locator('#edit-title')).toBeFocused()
  await expect(page.locator('#edit-title')).toHaveValue(localTitle)
  await expect(dialog(page)).not.toBeVisible()
  assert.deepEqual(await slots(context, origin), freshSlots)
  checks.push('WX-0059: leaving the shell from the directory detects a hidden retained CMS draft; Keep editing directly activates and focuses its owning CMS editor without a second prompt or any saved change')
  await open(page, 'Content management')
  await expect(page.locator('#edit-title')).toHaveValue(localTitle)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-02-discarded-cms', 'Discard and leave'), expected)
  await open(page, 'Content management')
  await expect(page.locator('#edit-title')).toHaveValue(initialTitle)
  await page.locator('#edit-title').fill('Temporary reverted CMS title')
  await page.locator('#edit-title').fill(initialTitle)
  await open(page, 'Portal directory')
  await expect(dialog(page)).not.toBeVisible()
  assert.deepEqual(await slots(context, origin), freshSlots)
  checks.push('WX-0059: CMS Keep editing preserves exact input and route; Leave and keep draft retains it within the open shell while exports exclude it; Discard clears it; reverting to baseline navigates without a prompt or save')

  await open(page, 'Content management')
  const savedTitle = 'Accepted CMS safety navigation title'
  await page.locator('#edit-title').fill(savedTitle)
  await button(page, 'Save draft revision').click()
  expectCmsEdit(expected, 'cms-article-001', { title: savedTitle }, 1)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-03-accepted-cms-no-prompt'), expected)
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: a completed CMS draft action immediately rebases its buffer, so subsequent navigation is not intercepted')

  await open(page, 'Customer relationships')
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Companies & contacts').click()
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('Unsaved Contact Fixture')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('unsaved-contact@fixture.invalid')
  await page.getByRole('combobox', { name: /^Contact company/ }).selectOption('company-orbit')
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Accepted Safety Company')
  await button(page, 'Create sample company').click()
  expectCompany(expected, 'Accepted Safety Company', 1)
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Pipeline').click()
  await expect(dialog(page)).toContainText('New CRM contact')
  await expect(dialog(page)).not.toContainText('New CRM company')
  await choose(page, 'Keep editing')
  await expect(page.getByRole('textbox', { name: 'Contact name', exact: true })).toHaveValue('Unsaved Contact Fixture')
  await expect(page.getByRole('textbox', { name: 'Contact email', exact: true })).toHaveValue('unsaved-contact@fixture.invalid')
  await expect(page.getByRole('combobox', { name: /^Contact company/ })).toHaveValue('company-orbit')
  await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toHaveValue('')
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-04-company-save-contact-draft', 'Discard and leave'), expected)
  checks.push('WX-0059: accepting a CRM company clears only its form; an independent dirty contact keeps exact text and company choice, still prompts, and never appears in a workspace export')

  await open(page, 'Customer relationships')
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Leads').click()
  const robin = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Robin Fiction', exact: true }) })
  await robin.getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true }).fill('1650')
  await page.getByRole('combobox', { name: /^CRM preview identity/ }).selectOption('sales-riley')
  await expect(dialog(page)).toContainText('Conversion amount for Robin Fiction')
  await choose(page, 'Keep editing')
  await expect(page.getByRole('combobox', { name: /^CRM preview identity/ })).toHaveValue('crm-owner')
  await expect(robin.getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true })).toHaveValue('1650')
  await page.getByRole('combobox', { name: /^CRM preview identity/ }).selectOption('sales-riley')
  await choose(page, 'Discard and leave')
  await expect(page.getByRole('combobox', { name: /^CRM preview identity/ })).toHaveValue('sales-riley')
  await expect(robin).toHaveCount(0)
  await page.getByRole('combobox', { name: /^CRM preview identity/ }).selectOption('crm-owner')
  await expect(robin.getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true })).toHaveValue('1500')
  await robin.getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true }).fill('1900')
  await robin.getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true }).fill('1500')
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Dashboard').click()
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: CRM conversion amounts guard an identity change; Keep preserves owner and exact amount, Discard changes scope without converting, and an exact reverted amount is clean')

  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Leads').click()
  await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill('Unsubmitted Lead Fixture')
  await button(robin, 'Convert sample lead').click()
  const converted = expected.crm.leads.find(item => item.id === 'lead-robin')
  Object.assign(converted, { status: 'converted', companyId: 'company-0002', contactId: 'contact-0002', opportunityId: 'opportunity-0002' })
  expected.crm.companies.push({ id: 'company-0002', name: 'Example Ridge Studio', ownerId: 'sales-sam' })
  expected.crm.contacts.push({ id: 'contact-0002', name: 'Robin Fiction', email: 'robin@ridge.invalid', companyId: 'company-0002', ownerId: 'sales-sam' })
  expected.crm.opportunities.push({ id: 'opportunity-0002', title: 'Example Ridge Studio · sample opportunity', companyId: 'company-0002', contactId: 'contact-0002', ownerId: 'sales-sam', amountCents: 150000, stage: 'discovery', leadId: 'lead-robin' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0002', ownerId: 'sales-sam', action: 'convert-lead', description: 'Converted Robin Fiction into linked company, contact and opportunity records.' })
  expected.crm.sequence = 3
  await open(page, 'Content management')
  await expect(dialog(page)).toContainText('New CRM lead')
  await expect(dialog(page)).not.toContainText('Conversion amount for Robin Fiction')
  await choose(page, 'Keep editing')
  await expect(page.getByRole('textbox', { name: 'Lead name', exact: true })).toHaveValue('Unsubmitted Lead Fixture')
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-05-conversion-preserves-lead-draft', 'Discard and leave'), expected)
  checks.push('WX-0059: successful CRM conversion rebases only its amount and freezes the complete linked records; a separate unsubmitted lead remains dirty until deliberately discarded')

  await open(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
  await page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('2.75')
  await button(page, 'Start sample timer').click()
  const beforeHrLeave = await slots(context, origin)
  await open(page, 'Content management')
  await expect(dialog(page)).toContainText('Manual time entry')
  await expect(dialog(page)).toContainText('Running sample timer')
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/hr/demo/employee/time`)
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-14')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('2.75')
  await expect(button(page, 'Stop and add sample time')).toBeVisible()
  assert.deepEqual(await slots(context, origin), beforeHrLeave)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-06-retained-hr-excluded', 'Leave and keep draft'), expected)
  await page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true }).click()
  await expect(dialog(page)).toContainText('Manual time entry')
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/hr/demo/employee/time`)
  await expect(page.getByLabel('Work date', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-14')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('2.75')
  await expect(button(page, 'Stop and add sample time')).toBeVisible()
  await expect(dialog(page)).not.toBeVisible()
  assert.deepEqual(await slots(context, origin), beforeHrLeave)
  checks.push('WX-0059: a hidden retained HR manual/timer draft blocks leaving the shell; Keep activates the exact supported employee time subsection, focuses Work date, preserves literal inputs/timer and all three workspaces’ saved bytes, and raises no second guard')
  await open(page, 'People & HR')
  await expect(button(page, 'Stop and add sample time')).toBeVisible()
  await open(page, 'Content management')
  await choose(page, 'Discard and leave')
  await open(page, 'People & HR')
  await expect(button(page, 'Start sample timer')).toBeVisible()
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-15')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('8')
  assert.deepEqual(await slots(context, origin), beforeHrLeave, 'Discarding manual fields and a live timer must not create a time entry or mutate any saved byte')
  checks.push('WX-0059: HR manual time and running timer survive Keep/retained shell navigation, remain excluded from backups, and Discard cancels both without a phantom time record')

  await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1.25')
  await button(page, 'Add sample time').click()
  expected.hr.workflow.timeEntries.push({ id: 'MOCK-TIME-0001', employeeId: 'employee-002', date: '2026-10-14', hours: 1.25, source: 'manual', status: 'draft' })
  expected.hr.workflow.sequence = 2
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-07-accepted-hr-no-prompt'), expected)
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: accepting manual HR time makes that form clean immediately while the full export adds exactly the submitted draft and preserves every other record')

  await open(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Manager', exact: true }).click()
  await page.getByRole('navigation', { name: 'Manager HR pages', exact: true }).getByRole('link', { name: 'Team time', exact: true }).click()
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-12')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('2.5')
  const seedTime = page.getByRole('article', { name: 'Time entry time-001', exact: true })
  const unsavedReason = 'Unsaved return reason must not disappear through an approval.'
  await seedTime.getByLabel('Return reason for time-001', { exact: true }).fill(unsavedReason)
  const beforeApprove = await slots(context, origin)
  await button(seedTime, 'Approve sample time').click()
  await expect(dialog(page)).toContainText('Return reason time-001')
  await expect(dialog(page)).not.toContainText('Manual time entry')
  await choose(page, 'Keep editing')
  await expect(seedTime.getByLabel('Return reason for time-001', { exact: true })).toHaveValue(unsavedReason)
  await expect(seedTime).toContainText('submitted')
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-12')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('2.5')
  assert.deepEqual(await slots(context, origin), beforeApprove)
  await button(seedTime, 'Approve sample time').click(); await choose(page, 'Discard and leave')
  expected.hr.workflow.timeEntries.find(item => item.id === 'time-001').status = 'approved'
  await expect(seedTime).toContainText('approved')
  await expect(seedTime.getByLabel('Return reason for time-001', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-12')
  await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('2.5')
  await open(page, 'Portal directory')
  await expect(dialog(page)).toContainText('Manual time entry')
  await expect(dialog(page)).not.toContainText('Return reason time-001')
  await choose(page, 'Discard and leave')
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-08-approval-scoped-unsaved-reason'), expected)
  checks.push('WX-0059: approving submitted HR time scopes its prompt to a typed return reason; Keep preserves reason and independent manual draft without writes, Discard permits exactly approval while the other manual form stays dirty, and later discarding it creates no phantom entry')

  await open(page, 'Customer relationships')
  await open(page, 'Content management')
  await page.locator('#edit-title').fill('Unsaved CMS history navigation fixture')
  const beforeHistory = await slots(context, origin)
  await page.goBack()
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/cms/demo`)
  await expect(page.locator('#edit-title')).toHaveValue('Unsaved CMS history navigation fixture')
  // The disclosed traversal fallback reuses the observed physical history
  // slot. Establish a fresh visible CRM -> CMS pair before testing Discard
  // and its native Forward destination; Keep does not promise a stack repair.
  await open(page, 'Customer relationships'); await choose(page, 'Leave and keep draft')
  await open(page, 'Content management')
  await expect(page.locator('#edit-title')).toHaveValue('Unsaved CMS history navigation fixture')
  await page.goBack()
  await choose(page, 'Discard and leave')
  await expect(page).toHaveURL(`${origin}/crm/demo`)
  await expect(page.getByRole('heading', { name: 'CRM portal', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(`${origin}/cms/demo`)
  await expect(page.locator('#edit-title')).toHaveValue(savedTitle)
  await expect(navigation(page).getByRole('link', { name: 'Content management', exact: true })).toHaveAttribute('aria-current', 'page')
  assert.deepEqual(await slots(context, origin), beforeHistory)
  assert.deepEqual(await exportAll(page, artifactDir, 'navigation-09-history-coherence'), expected)
  checks.push('WX-0059: Back/Forward keeps browser URL, rendered portal, selected navigation and unsaved decisions coherent under the disclosed current-slot fallback; Keep stays on CMS, a fresh visible CRM/CMS pair verifies Discard and Forward, and exact saves remain preserved')
  return { finalWorkspaces: expected, finalSlots: await slots(context, origin) }
}

const legacyHistoryJourney = decision => async ({ page, context, origin, artifactDir, seed, checks }) => {
  // Explicit history-platform fixture: hide Navigation API positions and push
  // two same-document raw entries before the app installs its guard. Neither
  // workspace storage nor a domain/controller function is touched.
  const cmsUrl = '/cms/demo?history-probe=unmarked-cms#legacy-cms'
  const crmUrl = '/crm/demo?history-probe=unmarked-crm#legacy-crm'
  await page.addInitScript(({ origin: expectedOrigin, cmsUrl, crmUrl }) => {
    if (window.location.origin !== expectedOrigin) return
    Object.defineProperty(window, 'navigation', { configurable: true, value: undefined })
    const originalPush = window.history.pushState
    originalPush.call(window.history, { safetyFixture: 'raw-cms-entry' }, '', cmsUrl)
    originalPush.call(window.history, { safetyFixture: 'raw-crm-entry' }, '', crmUrl)
    let pushCalls = 0
    window.history.pushState = function (...args) { pushCalls += 1; return originalPush.apply(this, args) }
    Object.defineProperty(window, '__webappxSafetyLegacyProbe', { configurable: true, value: { get pushCalls() { return pushCalls } } })
  }, { origin, cmsUrl, crmUrl })
  await page.goto(`${origin}/portals`)
  await expect(page).toHaveURL(`${origin}${crmUrl}`)
  await expect(page.getByRole('heading', { name: 'CRM portal', exact: true })).toBeVisible()
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Companies & contacts').click()
  const text = 'Unmarked history CRM draft remains exact'
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill(text)
  const before = await slots(context, origin)
  const historyBefore = await page.evaluate(() => ({ length: window.history.length, pushCalls: window.__webappxSafetyLegacyProbe.pushCalls }))
  await page.goBack()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText('To preserve your unsaved work, this page is kept at the current browser history position.')
  await expect(dialog(page)).toContainText('Leaving opens the requested destination at that same position.')
  await expect(dialog(page)).toContainText('Back and Forward entries may differ.')
  await expect(page).toHaveURL(`${origin}${crmUrl}`)
  await expect(page.getByRole('heading', { name: 'CRM portal', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toHaveValue(text)
  await expect(navigation(page).getByRole('link', { name: 'Customer relationships', exact: true })).toHaveAttribute('aria-current', 'page')
  assert.deepEqual(await slots(context, origin), before)
  const name = decision === 'Keep editing' ? 'legacy-history-keep' : 'legacy-history-discard'
  await grayscaleCapture(page, dialog(page), artifactDir, name)
  await choose(page, decision)
  if (decision === 'Keep editing') {
    await expect(page).toHaveURL(`${origin}${crmUrl}`)
    await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toHaveValue(text)
    await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toBeFocused()
  } else {
    await expect(page).toHaveURL(`${origin}${cmsUrl}`)
    await expect(page.getByRole('heading', { name: 'Content publishing workspace', exact: true })).toBeVisible()
    await expect(navigation(page).getByRole('link', { name: 'Content management', exact: true })).toHaveAttribute('aria-current', 'page')
  }
  const historyAfter = await page.evaluate(() => ({ length: window.history.length, pushCalls: window.__webappxSafetyLegacyProbe.pushCalls }))
  assert.deepEqual(historyAfter, historyBefore, 'The disclosed legacy decision must reuse the observed slot without adding a history entry or issuing a native pushState')
  assert.deepEqual(await slots(context, origin), before)
  assert.deepEqual(await exportAll(page, artifactDir, `${name}-complete-export`, decision === 'Keep editing' ? 'Discard and leave' : undefined), seed.workspaces)
  checks.push(`WX-0059: labeled no-Navigation-API/raw-entry browser probe discloses current-slot fallback; ${decision} preserves coherent exact URL/rendered route, draft consequences and all saved bytes without any new history entry or native push during the decision`)
  return { platformBoundary: 'Navigation API positions hidden; two raw same-document history entries created before the app guard, with native push-call observation only', decision, historyBefore, historyAfter, finalWorkspaces: seed.workspaces, unchangedSlots: before }
}

async function crmFormsJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/crm/demo`)
  const expected = structuredClone(seed.workspaces)
  const tabs = page.getByRole('navigation', { name: 'CRM pages', exact: true })
  await button(tabs, 'Leads').click()
  const lead = { name: 'CRM Safety Accepted Lead', email: 'crm-safety-lead@fixture.invalid', companyName: 'CRM Safety Lead Studio' }
  await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill(lead.name)
  await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill('unaccepted-real-domain@example.com')
  await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill(lead.companyName)
  await button(page, 'Create sample lead').click()
  await expect(page.getByRole('alert')).toContainText('.invalid')
  await button(tabs, 'Companies & contacts').click()
  await choose(page, 'Keep editing')
  await expect(page.getByRole('textbox', { name: 'Lead name', exact: true })).toHaveValue(lead.name)
  await expect(page.getByRole('textbox', { name: 'Lead email', exact: true })).toHaveValue('unaccepted-real-domain@example.com')
  await expect(page.getByRole('textbox', { name: 'Lead company', exact: true })).toHaveValue(lead.companyName)
  await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill(lead.email)
  await button(page, 'Create sample lead').click()
  expected.crm.leads.push({ id: 'lead-0001', ...lead, ownerId: 'crm-owner', status: 'new' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: `Created sample lead ${lead.name}.` })
  expected.crm.sequence = 2
  await expect(page.getByRole('textbox', { name: 'Lead name', exact: true })).toHaveValue('')
  await button(tabs, 'Pipeline').click(); await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: model-rejected CRM lead creation retains all form fields and its dirty registration; correcting the fictional address accepts one exact lead and makes that form clean')

  await page.getByRole('textbox', { name: 'Opportunity title', exact: true }).fill('CRM Safety Linked Opportunity')
  await page.getByRole('combobox', { name: /^Opportunity company/ }).selectOption('company-orbit')
  await expect(page.getByRole('combobox', { name: /^Opportunity contact/ })).toHaveValue('contact-jordan')
  await page.getByRole('spinbutton', { name: 'Opportunity amount (USD)', exact: true }).fill('1234.56')
  await button(tabs, 'Companies & contacts').click(); await choose(page, 'Keep editing')
  await expect(page.getByRole('textbox', { name: 'Opportunity title', exact: true })).toHaveValue('CRM Safety Linked Opportunity')
  await expect(page.getByRole('combobox', { name: /^Opportunity company/ })).toHaveValue('company-orbit')
  await expect(page.getByRole('combobox', { name: /^Opportunity contact/ })).toHaveValue('contact-jordan')
  await expect(page.getByRole('spinbutton', { name: 'Opportunity amount (USD)', exact: true })).toHaveValue('1234.56')
  await button(page, 'Create sample opportunity').click()
  expected.crm.opportunities.push({ id: 'opportunity-0002', title: 'CRM Safety Linked Opportunity', companyId: 'company-orbit', contactId: 'contact-jordan', ownerId: 'sales-sam', amountCents: 123456, stage: 'discovery' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0002', ownerId: 'sales-sam', action: 'create-opportunity', description: 'Created sample opportunity CRM Safety Linked Opportunity.' })
  expected.crm.sequence = 3
  await button(tabs, 'Follow-up tasks').click(); await expect(dialog(page)).not.toBeVisible()
  await page.getByRole('textbox', { name: 'Follow-up title', exact: true }).fill('CRM Safety Follow-up Fixture')
  await page.getByRole('combobox', { name: /^Follow-up opportunity/ }).selectOption('opportunity-0002')
  await button(tabs, 'Dashboard').click(); await choose(page, 'Keep editing')
  await expect(page.getByRole('textbox', { name: 'Follow-up title', exact: true })).toHaveValue('CRM Safety Follow-up Fixture')
  await expect(page.getByRole('combobox', { name: /^Follow-up opportunity/ })).toHaveValue('opportunity-0002')
  await button(page, 'Create sample follow-up').click()
  expected.crm.tasks.push({ id: 'task-0003', title: 'CRM Safety Follow-up Fixture', opportunityId: 'opportunity-0002', ownerId: 'sales-sam', status: 'open' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0003', ownerId: 'sales-sam', action: 'create-task', description: 'Assigned CRM Safety Follow-up Fixture to the opportunity owner.' })
  expected.crm.sequence = 4
  await button(tabs, 'Companies & contacts').click(); await expect(dialog(page)).not.toBeVisible()
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('CRM Safety Contact Fixture')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('crm-safety-contact@fixture.invalid')
  await button(page, 'Create sample contact').click()
  expected.crm.contacts.push({ id: 'contact-0004', name: 'CRM Safety Contact Fixture', email: 'crm-safety-contact@fixture.invalid', companyId: 'company-harbor', ownerId: 'sales-riley' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0004', ownerId: 'sales-riley', action: 'create-contact', description: 'Created CRM Safety Contact Fixture at Fictional Harbor Studio.' })
  expected.crm.sequence = 5
  assert.deepEqual(await exportAll(page, artifactDir, 'crm-forms-01-complete-accepted-actions'), expected)
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: CRM opportunity Keep preserves title, dependent company/contact and exact amount; follow-up Keep preserves its selected opportunity; accepted opportunity, task and contact actions each rebase only their own form and export complete linked records')

  await open(page, 'Customer relationships')
  const beforeEmptyImport = await slots(context, origin)
  // Preserve every required seed identifier and complete relationship graph.
  // Reassign them consistently to Sam, leaving Riley's valid scoped view empty.
  expected.crm = structuredClone(seed.workspaces.crm)
  for (const collection of ['companies', 'contacts', 'leads', 'opportunities', 'tasks']) for (const record of expected.crm[collection]) record.ownerId = 'sales-sam'
  const region = backup(page, 'crm')
  await region.getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(upload('empty-crm-scope-controlled-select.json', individualFile('crm', expected.crm)))
  await button(region, 'Replace CRM workspace').click()
  const afterEmptyImport = await slots(context, origin)
  assert.deepEqual(JSON.parse(afterEmptyImport['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm })
  assert.deepEqual(Object.fromEntries(Object.entries(afterEmptyImport).filter(([key]) => key !== 'webappx.demo.crm')), Object.fromEntries(Object.entries(beforeEmptyImport).filter(([key]) => key !== 'webappx.demo.crm')), 'Importing a valid CRM with one empty representative scope changes only its one save slot when checkpoints are off')
  await page.getByRole('combobox', { name: /^CRM preview identity/ }).selectOption('sales-riley')
  await button(tabs, 'Companies & contacts').click()
  await expect(button(page, 'Create sample contact')).toBeDisabled()
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('First Company Contact Fixture')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('first-company-contact@fixture.invalid')
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('CRM First Company Fixture')
  await button(page, 'Create sample company').click()
  expectCompany(expected, 'CRM First Company Fixture', 1, 'sales-riley')
  await expect(page.getByRole('textbox', { name: 'Contact name', exact: true })).toHaveValue('First Company Contact Fixture')
  await expect(page.getByRole('textbox', { name: 'Contact email', exact: true })).toHaveValue('first-company-contact@fixture.invalid')
  await expect(page.getByRole('combobox', { name: /^Contact company/ })).toHaveValue('company-0001')
  await expect(button(page, 'Create sample contact')).toBeEnabled()
  const afterFirstCompany = await slots(context, origin)
  assert.deepEqual(JSON.parse(afterFirstCompany['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm })
  assert.deepEqual(Object.fromEntries(Object.entries(afterFirstCompany).filter(([key]) => key !== 'webappx.demo.crm')), Object.fromEntries(Object.entries(afterEmptyImport).filter(([key]) => key !== 'webappx.demo.crm')))
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('')
  await open(page, 'Portal directory')
  await expect(dialog(page)).not.toBeVisible()
  assert.deepEqual(await slots(context, origin), afterFirstCompany, 'The automatically selected first company is a clean default when the typed contact fields are reverted')
  // Switching portals retains this mounted contact form. Returning must not
  // hide an empty internal selection by recreating the component's defaults.
  await open(page, 'Customer relationships')
  await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('First Company Contact Fixture')
  await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('first-company-contact@fixture.invalid')
  await button(page, 'Create sample contact').click()
  expected.crm.contacts.push({ id: 'contact-0002', name: 'First Company Contact Fixture', email: 'first-company-contact@fixture.invalid', companyId: 'company-0001', ownerId: 'sales-riley' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0002', ownerId: 'sales-riley', action: 'create-contact', description: 'Created First Company Contact Fixture at CRM First Company Fixture.' })
  expected.crm.sequence = 3
  assert.deepEqual(await exportAll(page, artifactDir, 'crm-forms-02-empty-workspace-first-company-contact'), expected)
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0059: a complete valid CRM with an empty representative scope imports without touching unrelated slots; creating that representative’s first company preserves typed contact name/email, makes its new company a clean automatic default, and subsequent contact creation saves exactly the displayed relationship')
  return { finalWorkspaces: expected, finalSlots: await slots(context, origin) }
}

async function cmsRecoveryJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  const expected = structuredClone(seed.workspaces)
  await open(page, 'Content management')
  await button(page, /Welcome to the sample studio/).click()
  const localTitle = 'Unsaved author title survives replacement'
  await page.locator('#edit-title').fill(localTitle)
  await open(page, 'Portal directory'); await choose(page, 'Leave and keep draft')
  const restored = structuredClone(expected)
  const restoredPage = restored.cms.entries.find(item => item.id === 'cms-page-001')
  Object.assign(restoredPage, { title: 'Restored server draft at the same revision', slug: 'restored-server-slug', body: 'Restored server body replaces the untouched author field.', status: 'draft', approval: null })
  await applyRestore(page, restored, ['cms'], 'same-revision-cms.json')
  expected.cms = structuredClone(restored.cms)
  const afterRestore = await slots(context, origin)
  await open(page, 'Content management')
  const recovery = page.getByRole('region', { name: 'CMS editor recovery', exact: true })
  await expect(recovery.getByRole('heading', { name: 'CMS editor changed after replacement', exact: true })).toBeVisible()
  const comparison = recovery.getByRole('table', { name: 'CMS editor baseline, restored draft and unsaved text', exact: true })
  const titleRow = comparison.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /^Content title/ }) })
  await expect(titleRow).toContainText('Welcome to the sample studio')
  await expect(titleRow).toContainText('Restored server draft at the same revision')
  await expect(titleRow).toContainText(localTitle)
  await grayscaleCapture(page, recovery, artifactDir, 'cms-editor-comparison')
  assert.deepEqual(await slots(context, origin), afterRestore, 'Showing the comparison must not accept unsaved text or write a new revision')
  await button(recovery, 'Reapply unsaved text').click()
  await expect(recovery).not.toBeVisible()
  await expect(page.locator('#edit-title')).toBeFocused()
  await expect(page.locator('#edit-title')).toHaveValue(localTitle)
  await expect(page.locator('#edit-slug')).toHaveValue('restored-server-slug')
  await expect(page.locator('#edit-body')).toHaveValue('Restored server body replaces the untouched author field.')
  assert.deepEqual(await slots(context, origin), afterRestore, 'Reapply changes only the local editor buffer until the ordinary Save action succeeds')
  await expect(page.getByRole('region', { name: 'Published sample preview', exact: true })).toContainText('Welcome to the sample studio')
  await expect(page.getByRole('region', { name: 'Published sample preview', exact: true })).not.toContainText(localTitle)
  await button(page, 'Save draft revision').click()
  expectCmsEdit(expected, 'cms-page-001', { title: localTitle }, 1)
  assert.deepEqual(expected.cms.entries[0].published, seed.workspaces.cms.entries[0].published)
  assert.deepEqual(await exportAll(page, artifactDir, 'cms-recovery-01-reapply-explicit-save'), expected)
  checks.push('WX-0285: a selected CMS restore with the same numeric revision but different saved content presents baseline/restored/unsaved comparison; explicit Reapply overlays only the changed title, keeps restored untouched slug/body, writes nothing until Save, and preserves the frozen publication')

  await open(page, 'Content management')
  await page.locator('#edit-body').fill('Unsaved body must be discarded by the explicit Reload choice.')
  await open(page, 'Portal directory'); await choose(page, 'Leave and keep draft')
  const reloadTarget = structuredClone(expected)
  Object.assign(reloadTarget.cms.entries[0], { title: 'Reloaded current CMS title', slug: 'reloaded-current-slug', body: 'Reloaded current CMS body remains the accepted saved value.' })
  await applyRestore(page, reloadTarget, ['cms'], 'reload-current-cms.json')
  expected.cms = structuredClone(reloadTarget.cms)
  const beforeReload = await slots(context, origin)
  await open(page, 'Content management')
  await expect(recovery).toBeVisible()
  await page.getByRole('combobox', { name: /^CMS preview identity/ }).selectOption('cms-viewer')
  await expect(button(recovery, 'Reapply unsaved text')).toBeDisabled()
  await button(recovery, 'Reload restored draft').click()
  await expect(recovery).not.toBeVisible()
  await expect(page.locator('#cms-selected-heading')).toBeFocused()
  await expect(page.locator('#cms-selected-heading')).toBeVisible()
  await page.getByRole('combobox', { name: /^CMS preview identity/ }).selectOption('cms-author')
  await expect(page.locator('#edit-title')).toHaveValue('Reloaded current CMS title')
  await expect(page.locator('#edit-slug')).toHaveValue('reloaded-current-slug')
  await expect(page.locator('#edit-body')).toHaveValue('Reloaded current CMS body remains the accepted saved value.')
  assert.deepEqual(await slots(context, origin), beforeReload)
  assert.deepEqual(await exportAll(page, artifactDir, 'cms-recovery-02-reload-no-new-receipt'), expected)
  await expect(dialog(page)).not.toBeVisible()
  checks.push('WX-0285: a later accepted replacement presents another comparison; read-only viewer cannot Reapply, explicit Reload focuses the visible restored heading, adopts the complete restored draft and creates no extra saved revision or receipt')

  await open(page, 'Content management')
  await button(page, /A fictional team update/).click()
  await button(page, 'Request review').click()
  const article = expected.cms.entries.find(item => item.id === 'cms-article-001')
  article.status = 'in-review'
  expected.cms.sequence = 2
  expected.cms.activity.push({ receipt: 'MOCK-CMS-0002', entryId: article.id, revision: 1, actorId: 'cms-author', action: 'Requested review' })
  await page.getByRole('combobox', { name: /^CMS preview identity/ }).selectOption('cms-reviewer')
  const feedback = 'Preserved unsubmitted review feedback after approval.'
  await page.getByRole('textbox', { name: 'Review feedback', exact: true }).fill(feedback)
  await button(page, 'Approve revision 1').click()
  article.status = 'approved'; article.approval = { revision: 1, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0003' }
  expected.cms.sequence = 3
  expected.cms.activity.push({ receipt: 'MOCK-CMS-0003', entryId: article.id, revision: 1, actorId: 'cms-reviewer', action: 'Approved exact draft revision' })
  const retained = page.getByRole('region', { name: 'Retained CMS review feedback', exact: true })
  await expect(retained.getByRole('textbox', { name: 'Retained review feedback', exact: true })).toHaveValue(feedback)
  const afterApproval = await slots(context, origin)
  await open(page, 'Portal directory'); await choose(page, 'Leave and keep draft')
  await page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true }).click()
  await choose(page, 'Keep editing')
  await expect(page).toHaveURL(`${origin}/cms/demo`)
  await expect(page.getByRole('combobox', { name: /^CMS preview identity/ })).toHaveValue('cms-reviewer')
  await expect(retained.getByRole('textbox', { name: 'Retained review feedback', exact: true })).toBeFocused()
  await expect(retained.getByRole('textbox', { name: 'Retained review feedback', exact: true })).toHaveValue(feedback)
  await expect(retained.getByRole('button', { name: /Return draft|Approve revision/ })).toHaveCount(0)
  await retained.getByRole('textbox', { name: 'Retained review feedback', exact: true }).fill('Edited temporary retained feedback only.')
  await grayscaleCapture(page, retained, artifactDir, 'cms-retained-review-feedback')
  await button(retained, 'Discard retained feedback').click()
  await expect(retained).not.toBeVisible()
  await expect(page.locator('#cms-selected-heading')).toBeFocused()
  assert.deepEqual(await slots(context, origin), afterApproval)
  assert.deepEqual(await exportAll(page, artifactDir, 'cms-recovery-03-retained-review-feedback'), expected)
  checks.push('WX-0059: approval preserves an unsubmitted feedback buffer in a visible retained editor; hidden-owner Keep activates the reviewer and focuses exact feedback; editing/discarding that temporary buffer creates no extra receipt or saved bytes')

  await open(page, 'Content management')
  await page.getByRole('combobox', { name: /^CMS preview identity/ }).selectOption('cms-author')
  const beforeCreate = structuredClone(expected.cms)
  await page.locator('#create-title').fill('Missing-entry recovery sample')
  await page.locator('#create-slug').fill('missing-entry-recovery-sample')
  await page.locator('#create-body').fill('Fictional content saved only to exercise a missing restored entry.')
  await button(page, 'Create draft').click()
  const missingEntry = { id: 'cms-entry-0004', collectionId: 'pages', authorId: 'cms-author', revision: 1, status: 'draft', approval: null, published: null, feedback: '', title: 'Missing-entry recovery sample', slug: 'missing-entry-recovery-sample', body: 'Fictional content saved only to exercise a missing restored entry.' }
  expected.cms.entries.push(missingEntry)
  expected.cms.sequence = 4
  expected.cms.activity.push({ receipt: 'MOCK-CMS-0004', entryId: missingEntry.id, revision: 1, actorId: 'cms-author', action: 'Created draft' })
  await page.locator('#edit-title').fill('Unsaved missing entry title remains recoverable')
  await open(page, 'Portal directory'); await choose(page, 'Leave and keep draft')
  const missingTarget = structuredClone(expected); missingTarget.cms = beforeCreate
  await applyRestore(page, missingTarget, ['cms'], 'missing-edited-cms-entry.json')
  expected.cms = beforeCreate
  const afterMissing = await slots(context, origin)
  await open(page, 'Content management')
  await expect(recovery).toContainText('This entry is missing from the restored workspace.')
  await expect(button(recovery, 'Reapply unsaved text')).toBeDisabled()
  await grayscaleCapture(page, recovery, artifactDir, 'cms-missing-entry-comparison')
  await button(recovery, 'Reload restored draft').click()
  await expect(recovery).not.toBeVisible()
  await expect(page.locator('#cms-selected-heading')).toBeFocused()
  await expect(page.locator('#cms-selected-heading')).toBeVisible()
  assert.deepEqual(await slots(context, origin), afterMissing)
  assert.deepEqual(await exportAll(page, artifactDir, 'cms-recovery-04-missing-entry-explicit-reload'), expected)
  checks.push('WX-0285: a restored workspace missing a newly created edited entry preserves its unsaved comparison, disables Reapply, and explicit Reload focuses a visible fallback without recreating the removed record or writing')
  return { finalWorkspaces: expected, finalSlots: await slots(context, origin) }
}

function validatePoint(point, kind, module, expectedState) {
  assert.match(point.id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  assert.match(point.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.deepEqual(point, { id: point.id, createdAt: point.createdAt, kind, modules: [module], states: { [module]: expectedState }, label: `Before ${module.toUpperCase()} ${kind === 'import' ? 'individual import' : 'Reset'}` })
}

async function checkpointJourney({ page, context, origin, artifactDir, seed, checks, problems, warnings }) {
  await page.goto(`${origin}/crm/demo`)
  const expected = structuredClone(seed.workspaces)
  const region = backup(page, 'crm')
  const importOption = region.getByRole('checkbox', { name: 'Require checkpoint before individual imports', exact: true })
  const resetOption = region.getByRole('checkbox', { name: 'Require checkpoint before Reset', exact: true })
  await expect(importOption).not.toBeChecked(); await expect(resetOption).not.toBeChecked()
  const initialSlots = await slots(context, origin)
  assert.equal(Object.hasOwn(initialSlots, preferencesKey), false)
  assert.equal(Object.hasOwn(initialSlots, historyKey), false)
  await createCompany(page, 'Checkpoint Alpha Fiction')
  expectCompany(expected, 'Checkpoint Alpha Fiction', 1)
  const savedAlpha = structuredClone(expected.crm)
  const alpha = await download(page, button(region, 'Export workspace'), artifactDir, 'checkpoint-crm-alpha')
  assert.deepEqual(alpha.value.data, savedAlpha)
  await createCompany(page, 'Checkpoint Beta Fiction')
  expectCompany(expected, 'Checkpoint Beta Fiction', 2)
  const beforeImportState = structuredClone(expected.crm)
  await importOption.check()
  await expect(importOption).toBeChecked(); await expect(resetOption).not.toBeChecked()
  const beforePreview = await slots(context, origin)
  assert.deepEqual(JSON.parse(beforePreview[preferencesKey]), { schemaVersion: 1, beforeImport: true, beforeReset: false })
  await region.getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(alpha.path)
  await expect(region.getByRole('region', { name: 'Required checkpoint preview', exact: true })).toContainText('checkpoint')
  await grayscaleCapture(page, region, artifactDir, 'checkpoint-import-preview')
  assert.deepEqual(await slots(context, origin), beforePreview, 'Import preview must not save its required point early')
  const other = await additionalPage(context, problems, warnings)
  await other.goto(`${origin}/crm/demo`)
  const otherImport = backup(other, 'crm').getByRole('checkbox', { name: 'Require checkpoint before individual imports', exact: true })
  const otherReset = backup(other, 'crm').getByRole('checkbox', { name: 'Require checkpoint before Reset', exact: true })
  await otherImport.uncheck()
  const afterOtherImportChange = await slots(context, origin)
  assert.deepEqual(JSON.parse(afterOtherImportChange[preferencesKey]), { schemaVersion: 1, beforeImport: false, beforeReset: false })
  await button(region, 'Replace CRM workspace').click()
  await expect(region.getByRole('alert')).toContainText(/changed|review|preview/i)
  await expect(region.getByRole('heading', { name: 'Ready to replace CRM workspace', exact: true })).toBeVisible()
  await grayscaleCapture(page, region, artifactDir, 'checkpoint-import-stale-preview-refused')
  assert.deepEqual(await slots(context, origin), afterOtherImportChange, 'A different owned page disabling the checkpoint must not let an old required-import confirmation bypass its preview')
  const refused = await download(page, button(region, 'Export workspace'), artifactDir, 'checkpoint-import-stale-refusal-live-state')
  assert.deepEqual(refused.value.data, beforeImportState)
  await button(region, 'Cancel import').click()
  await otherImport.check()
  await page.reload()
  await region.getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(alpha.path)
  await button(region, 'Replace CRM workspace').click()
  expected.crm = savedAlpha
  const afterImport = await slots(context, origin)
  const firstHistory = JSON.parse(afterImport[historyKey])
  assert.deepEqual(Object.keys(firstHistory).sort(), ['points', 'schemaVersion'])
  assert.equal(firstHistory.schemaVersion, 1); assert.equal(firstHistory.points.length, 1)
  validatePoint(firstHistory.points[0], 'import', 'crm', beforeImportState)
  assert.equal(afterImport[preferencesKey], beforePreview[preferencesKey])
  assert.deepEqual(JSON.parse(afterImport['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm })
  for (const module of ['hr', 'cms']) assert.equal(afterImport[`webappx.demo.${module}`], beforePreview[`webappx.demo.${module}`])
  assert.deepEqual(await exportAll(page, artifactDir, 'checkpoint-01-import-complete-scope'), expected)
  checks.push('WX-0455: settings start off and are independent; enabling only individual-import checkpoints previews without writes, captures the entire pre-import CRM state with exact kind/scope/label, then replaces CRM while preserving HR/CMS and settings bytes')
  checks.push('WX-0455: a second owned same-origin page uses the real preference control to disable a checkpoint after preview; the old confirmation is refused without any record/history write, and only a freshly reviewed required preview can proceed')

  await open(page, 'Customer relationships'); await page.reload()
  await expect(importOption).toBeChecked(); await expect(resetOption).not.toBeChecked()
  await button(page, 'Reset CRM demo').click()
  await expect(page.getByRole('region', { name: 'CRM Reset confirmation', exact: true })).not.toBeVisible()
  expected.crm = structuredClone(seed.workspaces.crm)
  const afterDefaultReset = await slots(context, origin)
  assert.equal(Object.hasOwn(afterDefaultReset, 'webappx.demo.crm'), false)
  assert.equal(afterDefaultReset[historyKey], afterImport[historyKey])
  assert.equal(afterDefaultReset[preferencesKey], afterImport[preferencesKey])
  assert.deepEqual(await exportAll(page, artifactDir, 'checkpoint-02-default-reset-preserved'), expected)
  checks.push('WX-0455/WX-0456: preferences survive refresh; enabling imports alone leaves ordinary Reset as a single action that accepts the original CRM seed, removes only its save and creates no extra history point')

  await open(page, 'Customer relationships')
  await resetOption.check()
  await expect(importOption).toBeChecked(); await expect(resetOption).toBeChecked()
  await createCompany(page, 'Checkpoint Reset Fiction')
  expectCompany(expected, 'Checkpoint Reset Fiction', 1)
  const beforeResetState = structuredClone(expected.crm)
  const beforeReset = await slots(context, origin)
  await button(page, 'Reset CRM demo').click()
  const confirmation = page.getByRole('region', { name: 'CRM Reset confirmation', exact: true })
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole('region', { name: 'Required checkpoint preview', exact: true })).toContainText('checkpoint')
  await grayscaleCapture(page, confirmation, artifactDir, 'checkpoint-reset-preview')
  assert.deepEqual(await slots(context, origin), beforeReset)
  await other.reload()
  await expect(otherReset).toBeChecked()
  await otherReset.uncheck()
  const afterOtherResetChange = await slots(context, origin)
  assert.deepEqual(JSON.parse(afterOtherResetChange[preferencesKey]), { schemaVersion: 1, beforeImport: true, beforeReset: false })
  await button(confirmation, 'Confirm Reset CRM').click()
  await expect(confirmation).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: /changed|review|preview/i }).first()).toBeVisible()
  await grayscaleCapture(page, confirmation.locator('..'), artifactDir, 'checkpoint-reset-stale-preview-refused')
  assert.deepEqual(await slots(context, origin), afterOtherResetChange, 'An old required Reset preview must refuse after another page disables its requirement, preserving complete current records and all bytes')
  await button(confirmation, 'Keep CRM workspace').click()
  await expect(confirmation).not.toBeVisible()
  await otherReset.check()
  await page.reload()
  assert.deepEqual(await slots(context, origin), beforeReset)
  await button(page, 'Reset CRM demo').click()
  await button(confirmation, 'Confirm Reset CRM').click()
  await expect(confirmation).not.toBeVisible()
  expected.crm = structuredClone(seed.workspaces.crm)
  const afterReset = await slots(context, origin)
  const finalHistory = JSON.parse(afterReset[historyKey])
  assert.equal(finalHistory.points.length, 2)
  validatePoint(finalHistory.points[0], 'reset', 'crm', beforeResetState)
  assert.deepEqual(finalHistory.points[1], firstHistory.points[0])
  assert.equal(afterReset[preferencesKey], beforeReset[preferencesKey])
  assert.equal(Object.hasOwn(afterReset, 'webappx.demo.crm'), false)
  assert.deepEqual(await exportAll(page, artifactDir, 'checkpoint-03-confirmed-reset-complete-scope'), expected)
  checks.push('WX-0456: enabling Reset independently requires a write-free checkpoint preview and explicit confirmation; Keep preserves every raw slot; confirmation captures exact pre-Reset CRM records before accepting the seed and leaves the prior import point unchanged')
  checks.push('WX-0456: a second owned page disabling Reset checkpoints after preview cannot bypass the original required confirmation; stale confirmation refuses and only reloading/reviewing current settings and a new preview allows Reset')
  await other.close()
  return { finalWorkspaces: expected, finalSlots: await slots(context, origin), importPoint: firstHistory.points[0], resetPoint: finalHistory.points[0] }
}

async function historyFailureJourney({ page, context, origin, artifactDir, seed, checks }) {
  // This isolated fault replaces only the browser storage platform's history
  // write method. No workspace, history, settings or application state is injected.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'webappx.demo.restore-points') throw new DOMException('Synthetic history write denied by safety browser test', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.goto(`${origin}/crm/demo`)
  const expected = structuredClone(seed.workspaces)
  await createCompany(page, 'History Failure Retained Fixture')
  expectCompany(expected, 'History Failure Retained Fixture', 1)
  const region = backup(page, 'crm')
  await region.getByRole('checkbox', { name: 'Require checkpoint before individual imports', exact: true }).check()
  await region.getByRole('checkbox', { name: 'Require checkpoint before Reset', exact: true }).check()
  const before = await slots(context, origin)
  await region.getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(upload('denied-history-import.json', individualFile('crm', seed.workspaces.crm)))
  await button(region, 'Replace CRM workspace').click()
  await expect(region.getByRole('alert')).toContainText(/checkpoint|history/i)
  await expect(region.getByRole('heading', { name: 'Ready to replace CRM workspace', exact: true })).toBeVisible()
  await grayscaleCapture(page, region, artifactDir, 'checkpoint-import-refused')
  assert.deepEqual(await slots(context, origin), before, 'Required-history import failure must preserve every raw browser slot byte')
  await button(region, 'Cancel import').click()
  assert.deepEqual(await exportAll(page, artifactDir, 'history-failure-01-import-refused'), expected)
  checks.push('WX-0455: under an explicitly isolated denied-history-write platform fault, a required individual import is refused before live replacement; its preview remains available and every workspace/settings/history byte stays unchanged')

  await open(page, 'Customer relationships')
  await button(page, 'Reset CRM demo').click()
  const confirmation = page.getByRole('region', { name: 'CRM Reset confirmation', exact: true })
  await button(confirmation, 'Confirm Reset CRM').click()
  await expect(confirmation).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: /checkpoint|history/i }).first()).toBeVisible()
  await grayscaleCapture(page, confirmation.locator('..'), artifactDir, 'checkpoint-reset-refused')
  assert.deepEqual(await slots(context, origin), before, 'Required-history Reset failure must not remove a workspace save or any other raw slot')
  await button(confirmation, 'Keep CRM workspace').click()
  assert.deepEqual(await exportAll(page, artifactDir, 'history-failure-02-reset-refused'), expected)
  checks.push('WX-0456: the same denied-history-write fault refuses required Reset, keeps its confirmation and current saved records, and preserves all raw browser slots without accepting a seed')
  return { fault: 'Storage.prototype.setItem refuses only webappx.demo.restore-points', finalWorkspaces: expected, unchangedSlots: before }
}

function metadata(scope, side, id, label) {
  return scope.locator(`dl[aria-label="${side} ${id} metadata"]`).getByText(label, { exact: true }).locator('..').locator('dd')
}

async function differencesJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  const expected = structuredClone(seed.workspaces)
  const target = structuredClone(seed.workspaces)
  Object.assign(target.cms.entries[0], { title: 'Redacted target CMS draft title', slug: 'redacted-target-slug', body: 'Redacted target CMS draft body remains hidden in structured inspection.', revision: 2, status: 'draft', approval: null })
  Object.assign(target.cms.entries[0].published, { title: 'Redacted target publication title', body: 'Redacted target publication body remains a frozen saved projection.' })
  Object.assign(target.crm.companies[0], { name: 'Redacted target company label', ownerId: 'sales-sam' })
  Object.assign(target.crm.contacts[0], { name: 'Redacted Target Contact', email: 'redacted-target@fixture.invalid', companyId: 'company-orbit', ownerId: 'sales-sam' })
  target.crm.leads[0].status = 'qualified'
  Object.assign(target.crm.opportunities[0], { title: 'Redacted target opportunity title', companyId: 'company-orbit', ownerId: 'sales-sam', amountCents: 275000, stage: 'proposal' })
  target.crm.tasks[0].ownerId = 'sales-sam'
  const before = await slots(context, origin)
  const preview = await restorePreview(page, target, ['cms', 'crm'], 'structured-domain-differences.json')
  const differences = preview.getByRole('region', { name: 'Selected restore differences', exact: true })
  const cmsRecord = differences.locator('tr[data-collection="entries"] [data-record-id="cms-page-001"]')
  await expect(metadata(cmsRecord, 'Current', 'cms-page-001', 'Draft revision')).toHaveText('1')
  await expect(metadata(cmsRecord, 'Target', 'cms-page-001', 'Draft revision')).toHaveText('2')
  await expect(metadata(cmsRecord, 'Current', 'cms-page-001', 'Workflow status')).toHaveText('published')
  await expect(metadata(cmsRecord, 'Target', 'cms-page-001', 'Workflow status')).toHaveText('draft')
  await expect(metadata(cmsRecord, 'Current', 'cms-page-001', 'Approval revision')).toHaveText('1')
  await expect(metadata(cmsRecord, 'Target', 'cms-page-001', 'Approval revision')).toHaveText('None')
  await expect(metadata(cmsRecord, 'Current', 'cms-page-001', 'Published revision')).toHaveText('1')
  await expect(metadata(cmsRecord, 'Target', 'cms-page-001', 'Published revision')).toHaveText('1')
  const projections = cmsRecord.locator('dl[aria-label="CMS cms-page-001 projection changes"]')
  for (const [label, change] of [['Draft projection', 'changed'], ['Approval projection', 'removed'], ['Published projection', 'changed']]) await expect(projections.getByText(label, { exact: true }).locator('..').locator('dd')).toHaveText(change)
  await expect(differences.getByLabel('CMS changed primary records', { exact: true })).toHaveText('1')
  checks.push('WX-0459: selected CMS restore inspection separates draft, approval and frozen publication changes, with explicit current/target revisions and workflow metadata even when the published revision number is unchanged')

  const company = differences.locator('tr[data-collection="companies"] [data-record-id="company-harbor"]')
  await expect(metadata(company, 'Current', 'company-harbor', 'Owner ID')).toHaveText('sales-riley')
  await expect(metadata(company, 'Target', 'company-harbor', 'Owner ID')).toHaveText('sales-sam')
  const contact = differences.locator('tr[data-collection="contacts"] [data-record-id="contact-avery"]')
  await expect(metadata(contact, 'Current', 'contact-avery', 'Company ID')).toHaveText('company-harbor')
  await expect(metadata(contact, 'Target', 'contact-avery', 'Company ID')).toHaveText('company-orbit')
  const lead = differences.locator('tr[data-collection="leads"] [data-record-id="lead-jules"]')
  await expect(metadata(lead, 'Current', 'lead-jules', 'Lead state')).toHaveText('new')
  await expect(metadata(lead, 'Target', 'lead-jules', 'Lead state')).toHaveText('qualified')
  const opportunity = differences.locator('tr[data-collection="opportunities"] [data-record-id="opportunity-harbor"]')
  await expect(metadata(opportunity, 'Current', 'opportunity-harbor', 'Opportunity stage')).toHaveText('discovery')
  await expect(metadata(opportunity, 'Target', 'opportunity-harbor', 'Opportunity stage')).toHaveText('proposal')
  await expect(metadata(opportunity, 'Current', 'opportunity-harbor', 'Company ID')).toHaveText('company-harbor')
  await expect(metadata(opportunity, 'Target', 'opportunity-harbor', 'Company ID')).toHaveText('company-orbit')
  await expect(metadata(opportunity, 'Target', 'opportunity-harbor', 'Contact ID')).toHaveText('contact-avery')
  await expect(differences.getByLabel('CRM changed primary records', { exact: true })).toHaveText('5')
  await expect(differences).toContainText('Selected workspaces are replaced as a whole.')
  for (const text of ['Redacted target CMS draft title', 'Redacted target publication title', 'Redacted target company label', 'Redacted Target Contact', 'redacted-target@fixture.invalid', 'Redacted target opportunity title']) await expect(differences).not.toContainText(text)
  assert.deepEqual(await slots(context, origin), before, 'Domain difference inspection must not write any workspace, history or settings slot')
  checks.push('WX-0460: selected CRM restore inspection shows current/target company ownership, contact links, lead state and opportunity stage/link metadata, keeps free-text content hidden, and explains whole-module replacement without writing')
  await button(preview, 'Restore selected workspaces').click()
  await expect(preview).not.toBeVisible()
  expected.cms = structuredClone(target.cms); expected.crm = structuredClone(target.crm)
  assert.deepEqual(await exportAll(page, artifactDir, 'differences-01-whole-selected-modules'), expected)
  const after = await slots(context, origin)
  const history = JSON.parse(after[historyKey])
  assert.equal(history.points.length, 1)
  assert.deepEqual(history.points[0].modules, ['cms', 'crm'])
  assert.deepEqual(history.points[0].states, { cms: seed.workspaces.cms, crm: seed.workspaces.crm })
  assert.equal(after['webappx.demo.hr'], before['webappx.demo.hr'])
  const historyRegion = page.getByRole('region', { name: 'Restore points', exact: true })
  await historyRegion.getByRole('button', { name: /^Undo restore point/ }).click()
  const undo = historyRegion.getByRole('region', { name: 'Undo workspace differences', exact: true })
  const undoLead = undo.locator('tr[data-collection="leads"] [data-record-id="lead-jules"]')
  await expect(metadata(undoLead, 'Current', 'lead-jules', 'Lead state')).toHaveText('qualified')
  await expect(metadata(undoLead, 'Target', 'lead-jules', 'Lead state')).toHaveText('new')
  await expect(undo.locator('tr[data-collection="entries"] [data-record-id="cms-page-001"]')).toBeVisible()
  assert.deepEqual(await slots(context, origin), after)
  checks.push('WX-0459/WX-0460: confirming the inspected selection replaces the complete CMS and CRM snapshots, captures exactly their previous records, preserves HR, and Undo uses the same structured comparison in the reverse direction')
  return { finalWorkspaces: expected, finalSlots: after, selectedRestorePoint: history.points[0] }
}

/** All domain edits and replacements use rendered controls and real local
 * downloads/uploads. Complete expected records are stated independently from
 * reducers. Only the labeled denied-history context alters a platform API.
 */
export async function runPortalSafety({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], evidence = {}
  async function journey(name, run) {
    let context, page, tracing = false, failure
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
      evidence[name] = await run({ page, context, origin, artifactDir, seed, checks, problems, warnings })
      await page.screenshot({ path: join(artifactDir, `${name}-final.png`), fullPage: true })
    } catch (error) {
      failure = error
      if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDir, `${name}-failure.png`), fullPage: true, timeout: 5000 }).catch(() => {})
      throw error
    } finally {
      const errors = []
      if (tracing) try { await context.tracing.stop({ path: join(artifactDir, `${name}-trace.zip`) }) } catch (error) { errors.push(error.message) }
      if (context) try { await context.close() } catch (error) { errors.push(error.message) }
      if (errors.length && failure) failure.artifactErrors = errors
      else if (errors.length) throw new Error(`Safety ${name} cleanup failed: ${errors.join('; ')}`)
    }
  }
  try {
    await journey('navigation', navigationJourney)
    await journey('legacy-history-keep', legacyHistoryJourney('Keep editing'))
    await journey('legacy-history-discard', legacyHistoryJourney('Discard and leave'))
    await journey('crm-forms', crmFormsJourney)
    await journey('cms-recovery', cmsRecoveryJourney)
    await journey('checkpoints', checkpointJourney)
    await journey('denied-history', historyFailureJourney)
    await journey('domain-differences', differencesJourney)
    assert.deepEqual(problems, [], 'Safety journeys require no provider/backend/external requests, HTTP errors, failed requests, console errors or uncaught exceptions')
    const grayscaleCaptures = []
    for (const [name, scope] of [
      ['navigation-unsaved-dialog', 'Native unsaved navigation dialog with Keep/Discard/retain choices'],
      ['legacy-history-keep', 'Disclosed raw unindexed-history fallback before Keep editing'],
      ['legacy-history-discard', 'Disclosed raw unindexed-history fallback before Discard'],
      ['cms-editor-comparison', 'Restored CMS draft comparison before explicit Reapply'],
      ['cms-retained-review-feedback', 'Unsubmitted review feedback retained after approval'],
      ['cms-missing-entry-comparison', 'Missing edited CMS entry with disabled Reapply and explicit Reload'],
      ['checkpoint-import-preview', 'Required individual-import checkpoint preview'],
      ['checkpoint-reset-preview', 'Required Reset checkpoint preview'],
      ['checkpoint-import-refused', 'Individual import refused under denied history writes'],
      ['checkpoint-reset-refused', 'Reset refused under denied history writes'],
      ['checkpoint-import-stale-preview-refused', 'Individual import refused after another owned page changes its requirement'],
      ['checkpoint-reset-stale-preview-refused', 'Reset refused after another owned page changes its requirement'],
    ]) {
      const filename = `${name}-grayscale.png`
      const bytes = await readFile(join(artifactDir, filename))
      const proofFile = `${name}-capture-proof.json`
      const proof = JSON.parse(await readFile(join(artifactDir, proofFile), 'utf8'))
      grayscaleCaptures.push({ filename, scope, sha256: createHash('sha256').update(bytes).digest('hex'), proofFile, proof })
    }
    await writeFile(join(artifactDir, 'safety-grayscale-captures.json'), JSON.stringify({ probe: 'Temporary grayscale(1) display-only filters on html, dialog:modal and dialog::backdrop, removed immediately after each actual DOM capture; native top-layer dialogs are filtered explicitly', boundary: 'Local Chromium render evidence; no device or accessibility certification claim', captures: grayscaleCaptures }, null, 2) + '\n')
    await writeFile(join(artifactDir, 'safety-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
    return { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, coveredItems: ['WX-0059', 'WX-0285', 'WX-0455', 'WX-0456', 'WX-0459', 'WX-0460'], grayscaleCaptures, safetyEvidence: evidence }
  } catch (error) {
    error.smokeEvidence = { checks, problems, warnings: [...new Set(warnings)], safetyEvidence: evidence }
    throw error
  }
}
