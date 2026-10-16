import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { allocateSmokePort } from '../../scripts/browser-smoke.mjs'
import { ownedPreviewProcess } from '../../scripts/browser-preview-process.mjs'
import { newIsolatedContext } from './portals-smoke.mjs'
import { createKeyboardDriver } from './keyboard-driver.mjs'
import { auditVisibleControls } from './portal-quality.mjs'
import { adopted, interviewScheduled } from './recruiting-expected.mjs'

export const foundationMockKeys = Object.freeze([
  'webappx.demo.hr', 'webappx.demo.cms', 'webappx.demo.crm',
  'webappx.demo.restore-points', 'webappx.demo.recovery-preferences',
])
export const walkthroughBanner = 'Walkthrough — mock data stays in memory. Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.'
const fixtureTime = '2026-10-15T12:00:00.000Z'
const repository = fileURLToPath(new URL('../../', import.meta.url))
const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const backup = (page, module) => page.getByRole('region', { name: `${module.toUpperCase()} workspace backup`, exact: true })
const history = page => page.getByRole('region', { name: 'Restore points', exact: true })
const lastDownload = new WeakMap()

/** Independent literal expectations: no application transition or serializer is
 * imported to calculate the records a user action is expected to create. */
export function expectedFoundationAction(source, module, label) {
  const next = structuredClone(source)
  if (module === 'hr') {
    assert.equal(next.hr.performance.sequence, 0)
    next.hr.performance.sequence = 1
    next.hr.performance.goals.push({ id: 'goal-1', employeeId: 'employee-002', title: label, progress: 0, status: 'active', activity: [{ receipt: 'MOCK-PERF-0001', action: 'goal created', actorRole: 'employer-owner' }] })
  } else if (module === 'cms') {
    const entry = next.cms.entries.find(item => item.id === 'cms-article-001')
    assert.equal(entry.revision, 1)
    assert.equal(next.cms.sequence, 0)
    Object.assign(entry, { title: label, revision: 2, status: 'draft', approval: null, feedback: '' })
    next.cms.sequence = 1
    next.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  } else if (module === 'crm') {
    assert.equal(next.crm.sequence, 1)
    next.crm.companies.push({ id: 'company-0001', name: label, ownerId: 'crm-owner' })
    next.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-company', description: `Created sample company ${label}.` })
    next.crm.sequence = 2
  } else throw new Error('Unknown foundation expectation module')
  return next
}

export function foundationPersistentFixture(seed) {
  let states = expectedFoundationAction(seed, 'hr', 'Browser-only preserved HR goal')
  states = expectedFoundationAction(states, 'cms', 'Browser-only preserved CMS title')
  states = expectedFoundationAction(states, 'crm', 'Browser-only preserved CRM company')
  return {
    'webappx.demo.hr': `${JSON.stringify({ schemaVersion: 1, module: 'hr', data: states.hr }, null, 2)}\n`,
    'webappx.demo.cms': `${JSON.stringify({ schemaVersion: 1, module: 'cms', data: states.cms }, null, 2)}\n`,
    'webappx.demo.crm': `${JSON.stringify({ schemaVersion: 1, module: 'crm', data: states.crm }, null, 2)}\n`,
    'webappx.demo.restore-points': `${JSON.stringify({ schemaVersion: 1, points: [{ id: 'browser-only-foundation-point', createdAt: fixtureTime, kind: 'manual', label: 'Browser-only preserved history', modules: ['hr', 'cms', 'crm'], states }] }, null, 2)}\n`,
    'webappx.demo.recovery-preferences': '{ "schemaVersion": 1, "beforeImport": true, "beforeReset": true }\n',
    'foundation.unrelated': 'Unrelated browser bytes — preserve 🧭\n',
    'webappx.demo.unowned-sentinel': '{"outside":"the exact five-key inventory"}\n',
  }
}

/** Installed after fixture seeding, before the application document loads.
 * Playwright storageState is the separate out-of-band byte inspection channel.
 * Ledger rows never retain saved values, and every original method still runs. */
export function installFoundationStorageAudit({ protectedKeys }) {
  const watched = new Set(protectedKeys)
  const ledger = []
  Object.defineProperty(window, '__webappxFoundationStorageAudit', { value: ledger, configurable: false, writable: false })
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    const original = Storage.prototype[method]
    Storage.prototype[method] = function (...args) {
      const key = typeof args[0] === 'string' ? args[0] : null
      if (watched.has(key)) ledger.push({ method, key })
      return Reflect.apply(original, this, args)
    }
  }
}

export function assertFoundationSlots(actual, expected, label) {
  for (const key of Object.keys(expected)) assert.equal(actual[key], expected[key], `${label}: exact bytes for ${key}`)
}

async function browserSlots(context, origin) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'Account-free foundation journeys must not create cookies')
  assert.ok(storage.origins.every(item => item.origin === origin), 'Storage must remain on the owned origin')
  return Object.fromEntries((storage.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}

async function seededContext(browser, origin, problems, warnings, initial) {
  const result = await newIsolatedContext(browser, origin, problems, warnings)
  const path = `${origin}/__foundation-browser-fixture`
  await result.context.route(path, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Owned foundation storage setup</title>' }))
  await result.page.goto(path)
  await result.page.evaluate(entries => { for (const [key, value] of entries) localStorage.setItem(key, value) }, Object.entries(initial))
  await result.context.unroute(path)
  await result.context.addInitScript(installFoundationStorageAudit, { protectedKeys: [...foundationMockKeys] })
  assertFoundationSlots(await browserSlots(result.context, origin), initial, 'Out-of-band fixture setup')
  return result
}

async function auditWalkthrough(page, context, origin, initial, observations, label) {
  const calls = await page.evaluate(() => window.__webappxFoundationStorageAudit)
  assert.deepEqual(calls, [], `${label}: the application must not read, write or remove the five browser mock slots`)
  assertFoundationSlots(await browserSlots(context, origin), initial, label)
  observations.push({ label, applicationCalls: calls, protectedKeys: [...foundationMockKeys], exactPersistentBytesPreserved: true })
}

async function openPortal(page, title) { await navigation(page).getByRole('link', { name: title, exact: true }).click() }

async function downloadAll(page, artifactDir, name) {
  await openPortal(page, 'Portal directory')
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  // A browser may throttle legitimate downloads in a tight burst.
  const remaining = 150 - (Date.now() - (lastDownload.get(page) ?? 0))
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
  lastDownload.set(page, Date.now())
  const waiting = page.waitForEvent('download')
  await button(page.getByRole('region', { name: 'Combined workspace backup', exact: true }), 'Export all workspaces').click()
  const result = await waiting
  const path = join(artifactDir, `${name}.json`)
  await result.saveAs(path)
  assert.equal(await result.failure(), null)
  const envelope = JSON.parse(await readFile(path, 'utf8'))
  assert.deepEqual(Object.keys(envelope).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(envelope.format, 'webappx-mock-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  assert.deepEqual(Object.keys(envelope.workspaces).sort(), ['cms', 'crm', 'hr'])
  return envelope.workspaces
}

const upload = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
const individualFile = (module, data) => ({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt: fixtureTime, data })
const combinedFile = workspaces => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: fixtureTime, workspaces })

async function keyboardActivate(page, keyboard, target, label) {
  await keyboard.focus(target, label)
  await page.keyboard.press('Enter')
}

async function selectRestore(page, states, modules, name) {
  await page.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload(name, combinedFile(states)))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  for (const module of modules) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module.toUpperCase()}`) }).check()
  await button(preview, 'Restore selected workspaces').click()
  await expect(preview).not.toBeVisible()
}

async function firstRunJourney({ browser, origin, artifactDir, seed, checks, problems, warnings, focus }) {
  const initial = foundationPersistentFixture(seed.workspaces)
  const { context, page } = await seededContext(browser, origin, problems, warnings, initial)
  const keyboard = createKeyboardDriver(page, focus)
  try {
    await page.goto(`${origin}/docs`)
    const docsHeading = page.getByRole('heading', { name: 'Setup documentation lives with the template.', exact: true })
    await expect(docsHeading).toBeVisible()
    await expect(docsHeading).not.toBeFocused()
    const destinations = page.getByRole('region', { name: 'First-run destinations', exact: true })
    for (const text of ['npm ci', 'npm run dev:mock', 'npm run doctor', 'npm run dev:systemx', 'Firebase CLI, Java', 'Native dev:mock does not start this service.']) await expect(destinations).toContainText(text)
    await expect(destinations).toContainText('They need no Firebase project, Gusto account or API key.')
    const bridge = destinations.getByRole('link', { name: 'Open optional local control plane', exact: true })
    await expect(bridge).toHaveAttribute('href', '/__systemx/')
    await expect(bridge).toHaveAttribute('target', '_blank')
    await expect(destinations).toContainText('The link opens a new tab; it does not check readiness or start services.')
    const preview = page.getByRole('region', { name: 'WebAppX mock storage preview', exact: true })
    const before = await browserSlots(context, origin)
    const beforeCalls = await page.evaluate(() => window.__webappxFoundationStorageAudit)
    const summary = preview.locator('summary').filter({ hasText: 'Preview mock storage reset effects' })
    await keyboardActivate(page, keyboard, summary, 'Open the nonmutating five-key preview')
    await expect(preview.locator('code')).toHaveText([...foundationMockKeys])
    for (const text of ['This preview reads no saved values and deletes nothing.', 'existing restore points', 'defaults both checkpoint-before-import and checkpoint-before-reset to off', 'Accessibility preferences, account previews, Firebase data']) await expect(preview).toContainText(text)
    await expect(preview).not.toContainText('Browser-only preserved')
    await expect(preview).not.toContainText(initial['foundation.unrelated'])
    await keyboardActivate(page, keyboard, summary, 'Close the nonmutating five-key preview')
    assert.deepEqual(await browserSlots(context, origin), before, 'Opening/closing the preview must preserve every browser slot byte')
    assert.deepEqual(await page.evaluate(() => window.__webappxFoundationStorageAudit), beforeCalls, 'The preview must not read, write or remove any browser mock key')
    checks.push('WX-0015/WX-0018: first-run docs distinguish account-free app/portal startup from the optional Firebase CLI/Java control plane; its exact five-key reset preview exposes effects only and performs no storage access or mutation')

    for (const [label, path, heading] of [['Public app', '/', null], ['People & HR', '/hr/demo/admin', 'People workspace'], ['Content management', '/cms/demo', 'Content publishing workspace'], ['Customer relationships', '/crm/demo', 'CRM portal']]) {
      const link = destinations.getByRole('link', { name: label, exact: true })
      await expect(link).toHaveAttribute('href', path)
      await keyboardActivate(page, keyboard, link, `First-run ${label} link`)
      assert.equal(new URL(page.url()).pathname, path)
      const activeHeading = heading ? page.getByRole('heading', { name: heading, exact: true }) : page.locator('main h1')
      await keyboard.assertFocus(activeHeading, `Accepted ${label} route focuses its actual heading`)
      await keyboardActivate(page, keyboard, page.getByRole('contentinfo').getByRole('link', { name: 'Docs', exact: true }), `Return from ${label} to docs`)
      await keyboard.assertFocus(docsHeading, 'Accepted docs return heading')
    }
    assertFoundationSlots(await browserSlots(context, origin), initial, 'First-run destination navigation')
    checks.push('WX-0015/WX-0061: all four first-run anchors work by real Tab/Enter, accepted routes focus their visible heading, docs returns focus its heading, and existing browser workspaces remain exact')

    await page.setViewportSize({ width: 390, height: 844 })
    await button(page, 'Open accessibility controls').click()
    await button(page.getByRole('group', { name: 'Text size', exact: true }), 'Extra large').click()
    await button(page.getByRole('region', { name: 'Accessibility and page controls', exact: true }), 'Close accessibility controls').click()
    await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
    await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px')
    await auditVisibleControls(page, 'foundation-first-run-xlarge', artifactDir)
    await page.screenshot({ path: join(artifactDir, 'foundation-first-run-390-xlarge.png'), fullPage: true })
    await keyboardActivate(page, keyboard, destinations.getByRole('link', { name: 'Content management', exact: true }), 'Open CMS at extra-large text')
    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Portal directory', exact: true }), 'Open the token sample directory')
    const sample = page.getByRole('region', { name: 'Portal design token sample', exact: true })
    await expect(sample).toBeVisible()
    for (const token of ['surface-base', 'surface-raised', 'surface-muted', 'space-control', 'space-panel', 'space-section', 'emphasis-primary', 'emphasis-secondary', 'emphasis-quiet', 'focus-ring-color', 'focus-ring-width', 'focus-ring-offset']) await expect(sample).toContainText(`--portal-${token}`)
    const dimensions = await sample.evaluate(element => {
      const style = selector => getComputedStyle(element.querySelector(selector))
      return {
        surfaces: ['.portal-surface-base', '.portal-surface-raised', '.portal-surface-muted'].map(selector => style(selector).backgroundColor),
        controlGap: style('.portal-space-control').columnGap,
        panelPadding: style('article.portal-space-panel').paddingTop,
        sectionGap: style('.portal-space-section').columnGap,
        colors: ['.portal-emphasis-primary', '.portal-emphasis-secondary', '.portal-emphasis-quiet'].map(selector => style(selector).color),
      }
    })
    assert.deepEqual(dimensions, { surfaces: ['rgb(250, 250, 250)', 'rgb(255, 255, 255)', 'rgb(245, 245, 245)'], controlGap: '15px', panelPadding: '25px', sectionGap: '30px', colors: ['rgb(23, 23, 23)', 'rgb(82, 82, 82)', 'rgb(102, 102, 102)'] })
    await keyboard.focus(sample.getByRole('textbox', { name: 'Focus sample field', exact: true }), 'Token sample actual keyboard outline')
    await expect(sample.getByRole('textbox', { name: 'Focus sample field', exact: true })).toHaveValue('Fictional focus sample')
    const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    assert.ok(width.document <= width.viewport + 1, 'The 390px extra-large token sample must not widen the document')
    await page.screenshot({ path: join(artifactDir, 'foundation-tokens-390-xlarge.png'), fullPage: true })
    assertFoundationSlots(await browserSlots(context, origin), initial, 'First-run and token sample')
    checks.push('WX-0015/WX-0701: real Extra large text is 20px at390px; first-run controls retain strict accessible names/geometry and all twelve token labels have rendered surface, rem spacing, emphasis and actual keyboard-focus examples without changing mock saves')
  } finally { await context.close() }
}

async function focusJourney({ browser, origin, artifactDir, seed, checks, problems, warnings, focus }) {
  const { context, page } = await newIsolatedContext(browser, origin, problems, warnings)
  const keyboard = createKeyboardDriver(page, focus)
  let expected = structuredClone(seed.workspaces)
  try {
    await page.goto(`${origin}/portals`)
    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Content management', exact: true }), 'Keyboard open CMS')
    await keyboard.assertFocus(page.getByRole('heading', { name: 'Content publishing workspace', exact: true }), 'New CMS route heading')
    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Portal directory', exact: true }), 'Create the real directory history destination')
    await page.goBack()
    await expect(page).toHaveURL(`${origin}/cms/demo`)
    await keyboard.focus(page.locator('#edit-title'), 'Remember the clean article editor by keyboard')
    await page.goForward()
    await expect(page).toHaveURL(`${origin}/portals`)
    await page.goBack()
    await keyboard.assertFocus(page.locator('#edit-title'), 'Valid physical Back restores the exact remembered article editor')
    await page.goForward()
    await expect(page).toHaveURL(`${origin}/portals`)
    expected.cms.entries = expected.cms.entries.filter(entry => entry.id !== 'cms-article-001')
    await selectRestore(page, expected, ['cms'], 'foundation-remove-article.json')
    await page.goBack()
    await expect(page).toHaveURL(`${origin}/cms/demo`)
    await keyboard.assertFocus(page.getByRole('heading', { name: 'Editorial collection', exact: true }), 'Removed article Back falls to the editorial list')
    await expect(page.locator('#edit-title')).toHaveAttribute('data-nav-focus', 'cms:entry:cms-page-001:title')
    await expect(page.locator('#edit-title')).not.toBeFocused()
    assert.deepEqual(await downloadAll(page, artifactDir, 'foundation-focus-01-removed-cms'), expected)
    checks.push('WX-0061/WX-0715: real Back restores a valid remembered article editor; after real selective import removes that article, Back focuses Editorial collection instead of another record reusing edit-title, with exact full workspace preservation')

    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Customer relationships', exact: true }), 'Keyboard open CRM')
    await keyboard.assertFocus(page.getByRole('heading', { name: 'CRM portal', exact: true }), 'New CRM route heading')
    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Portal directory', exact: true }), 'Create CRM history destination')
    await page.goBack()
    await keyboardActivate(page, keyboard, button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Leads'), 'Open the CRM lead subsection')
    const qualifier = page.locator('[data-nav-focus="crm:lead:lead-jules:qualify"]')
    await keyboard.focus(qualifier, 'Remember a CRM record action without activating it')
    await page.goForward()
    await expect(page).toHaveURL(`${origin}/portals`)
    await page.goBack()
    await keyboard.assertFocus(qualifier, 'Valid CRM Back restores the exact current lead action')
    await page.goForward()
    expected.crm.leads = expected.crm.leads.filter(lead => lead.id !== 'lead-jules')
    await selectRestore(page, expected, ['crm'], 'foundation-remove-lead.json')
    await page.goBack()
    await expect(page).toHaveURL(`${origin}/crm/demo`)
    await keyboard.assertFocus(page.getByRole('heading', { name: 'CRM portal', exact: true }), 'Removed CRM lead and subsection fall to workspace heading')
    await expect(page.getByRole('heading', { name: 'Sample lead queue', exact: true })).toHaveCount(0)
    await expect(button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Overview')).toHaveAttribute('aria-current', 'page')
    assert.deepEqual(await downloadAll(page, artifactDir, 'foundation-focus-02-removed-crm'), expected)
    checks.push('WX-0715: real CRM Back restores a valid lead target, then falls to CRM portal after accepted replacement removes the lead and former subsection; it never reveals hidden tabs or changes records to satisfy focus')

    await openPortal(page, 'Content management')
    const originalTitle = await page.locator('#edit-title').inputValue()
    await page.locator('#edit-title').fill('Unsaved focus refusal fixture')
    await keyboardActivate(page, keyboard, navigation(page).getByRole('link', { name: 'Customer relationships', exact: true }), 'Request CRM while CMS is dirty')
    const dialog = page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
    await keyboard.assertFocus(button(dialog, 'Keep editing'), 'Dirty dialog owns focus while other surfaces are inert')
    for (const label of ['Discard and leave', 'Leave and keep draft', 'Keep editing']) {
      await page.keyboard.press('Tab')
      await keyboard.assertFocus(button(dialog, label), `Modal Tab remains on ${label}`)
    }
    await page.keyboard.press('Enter')
    await expect(dialog).not.toBeVisible()
    await expect(page).toHaveURL(`${origin}/cms/demo`)
    await keyboard.assertFocus(page.locator('#edit-title'), 'Keep editing retains source focus and rejects destination jump')
    await expect(page.locator('#edit-title')).toHaveValue('Unsaved focus refusal fixture')
    await page.locator('#edit-title').fill(originalTitle)
    assert.deepEqual(await downloadAll(page, artifactDir, 'foundation-focus-03-refused-no-save'), expected)
    checks.push('WX-0061: real Tab stays inside the native unsaved modal while background surfaces are inert; Keep editing preserves the CMS URL, exact draft and source focus with no destination jump or saved change')

    const ownFixture = structuredClone(expected)
    adopted(ownFixture.hr)
    interviewScheduled(ownFixture.hr, 1)
    await selectRestore(page, ownFixture, ['hr'], 'foundation-known-assigned-interviewer.json')
    expected = ownFixture
    await openPortal(page, 'People & HR')
    await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Recruiting', exact: true }).click()
    const entry = page.getByRole('region', { name: 'Enter an assigned interviewer preview', exact: true })
    await entry.getByRole('combobox', { name: 'Assigned fictional interviewer', exact: true }).selectOption('employee-001')
    await keyboardActivate(page, keyboard, button(entry, 'Enter interviewer preview'), 'Enter the assigned fictional interviewer')
    await expect(page.getByRole('region', { name: 'Isolated interviewer preview', exact: true })).toBeVisible()
    await expect(page.locator('[data-nav-workspace="cms"]')).toHaveCount(0)
    await expect(page.locator('[data-nav-workspace="crm"]')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Template workspaces', exact: true })).toHaveCount(0)
    await keyboard.focus(button(page, 'Leave interviewer preview'), 'Actual scoped keyboard traversal excludes detached CMS and CRM targets')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Recruiting lifecycle workspace', exact: true })).toBeVisible()
    assert.deepEqual(await downloadAll(page, artifactDir, 'foundation-focus-04-detached-surfaces'), expected)
    checks.push('WX-0715: an imported valid handwritten assigned-interview fixture enters the real restricted preview; CMS/CRM targets are detached from DOM, actual Tab reaches only permitted controls, and leaving preserves the complete expected graph')
  } finally { await context.close() }
}

async function normalStorageJourney({ browser, origin, artifactDir, seed, checks, problems, warnings }) {
  const initial = foundationPersistentFixture(seed.workspaces)
  const { context, page } = await seededContext(browser, origin, problems, warnings, initial)
  try {
    await page.goto(`${origin}/cms/demo`)
    await expect(page.locator('#edit-title')).toHaveValue('Browser-only preserved CMS title')
    const expected = Object.fromEntries(['hr', 'cms', 'crm'].map(module => [module, JSON.parse(initial[`webappx.demo.${module}`]).data]))
    await page.evaluate(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Post-mount synthetic storage denial', 'SecurityError') } })
    })
    await page.locator('#edit-title').fill('Normal mode latest getter refusal')
    await button(page, 'Save draft revision').click()
    const entry = expected.cms.entries.find(item => item.id === 'cms-article-001')
    Object.assign(entry, { title: 'Normal mode latest getter refusal', revision: 3, status: 'draft', approval: null, feedback: '' })
    expected.cms.sequence = 2
    expected.cms.activity.push({ receipt: 'MOCK-CMS-0002', entryId: 'cms-article-001', revision: 3, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
    assert.deepEqual(await downloadAll(page, artifactDir, 'foundation-normal-postmount-denial'), expected)
    await expect(page.getByRole('status', { name: 'CMS save status', exact: true })).toContainText('Browser save: Unavailable')
    assertFoundationSlots(await browserSlots(context, origin), initial, 'Normal mode post-mount storage denial')
    checks.push('WX-0017 compatibility: normal mode loads prior browser records, then a real post-mount storage getter denial is observed by the next save; the accepted edit stays in memory with Unavailable status and all prior persistent bytes remain exact')
  } finally { await context.close() }
}

async function ordinaryWalkthroughActions(page, seed, artifactDir) {
  let expected = structuredClone(seed)
  await openPortal(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Performance', exact: true }).click()
  await page.getByRole('combobox', { name: 'Goal employee', exact: true }).selectOption('employee-002')
  await page.getByRole('textbox', { name: 'Goal title', exact: true }).fill('Walkthrough-only HR goal')
  await button(page, 'Create sample goal').click()
  expected = expectedFoundationAction(expected, 'hr', 'Walkthrough-only HR goal')
  assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-01-hr'), expected)

  await openPortal(page, 'Content management')
  await page.locator('#edit-title').fill('Walkthrough-only CMS title')
  await button(page, 'Save draft revision').click()
  expected = expectedFoundationAction(expected, 'cms', 'Walkthrough-only CMS title')
  assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-02-cms'), expected)

  await openPortal(page, 'Customer relationships')
  await button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), 'Companies & contacts').click()
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Walkthrough-only CRM company')
  await button(page, 'Create sample company').click()
  expected = expectedFoundationAction(expected, 'crm', 'Walkthrough-only CRM company')
  assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-03-crm'), expected)
  return expected
}

async function walkthroughJourney({ browser, origin, artifactDir, seed, checks, problems, warnings, storageObservations }) {
  const initial = foundationPersistentFixture(seed.workspaces)
  const { context, page } = await seededContext(browser, origin, problems, warnings, initial)
  try {
    await page.goto(`${origin}/portals`)
    await expect(page.getByText(walkthroughBanner, { exact: true })).toBeVisible()
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-00-fresh-seed'), seed.workspaces)
    for (const label of ['HR', 'CMS', 'CRM']) await expect(page.getByRole('status', { name: `${label} save status`, exact: true })).toContainText('Walkthrough memory: Ready in memory')
    await expect(history(page)).toContainText('Restore points stay only in walkthrough memory. Refresh starts fresh records, settings and history while walkthrough mode stays on.')
    await expect(history(page)).not.toContainText('Restore points survive refresh at this browser address.')
    await expect(history(page).getByRole('list', { name: 'Saved restore points', exact: true })).toHaveCount(0)
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Fresh walkthrough ignores all existing browser workspaces, history and settings')

    let expected = await ordinaryWalkthroughActions(page, seed.workspaces, artifactDir)
    for (const label of ['HR', 'CMS', 'CRM']) await expect(page.getByRole('status', { name: `${label} save status`, exact: true })).toContainText('Walkthrough memory: Memory only')
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'All three accepted actions and complete exports')
    checks.push('WX-0017: explicit walkthrough ignores five existing browser slots and saves literal HR goal, CMS revision and CRM company changes only in live memory, with zero application reads/writes/removals of those slots')

    await openPortal(page, 'Content management')
    await expect(backup(page, 'cms')).toContainText('Both settings start off and apply to this walkthrough only. Refresh starts fresh records and settings while walkthrough mode stays on; existing browser saves are untouched.')
    await expect(backup(page, 'cms')).not.toContainText('survives refresh')
    for (const label of ['Require checkpoint before individual imports', 'Require checkpoint before Reset']) {
      const input = backup(page, 'cms').getByRole('checkbox', { name: label, exact: true })
      await expect(input).not.toBeChecked()
      await input.check()
      await expect(input).toBeChecked()
    }
    await openPortal(page, 'Portal directory')
    const manual = page.getByRole('form', { name: 'Create named restore point', exact: true })
    await manual.getByRole('textbox', { name: 'Restore point name', exact: true }).fill('Walkthrough original capture')
    for (const label of ['HR', 'CMS', 'CRM']) await manual.getByRole('checkbox', { name: `Capture ${label}`, exact: true }).check()
    await button(manual, 'Create named restore point').click()
    const named = history(page).getByRole('listitem').filter({ hasText: 'Walkthrough original capture' })
    await expect(named).toHaveCount(1)
    await named.getByRole('textbox', { name: 'Point label', exact: true }).fill('Walkthrough renamed capture')
    await button(named, 'Save point label').click()
    await expect(history(page).getByRole('listitem')).toHaveCount(1)
    await expect(history(page).getByText('Walkthrough renamed capture · HR, CMS, CRM', { exact: true })).toBeVisible()
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-04-settings-manual-rename'), expected)
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Settings, manual capture and rename')
    checks.push('WX-0017: both checkpoint preferences, manual three-portal history and a point rename work in walkthrough memory without changing full workspace exports or five persistent slot bytes')

    await openPortal(page, 'Content management')
    await backup(page, 'cms').getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(upload('walkthrough-cms-seed.json', individualFile('cms', seed.workspaces.cms)))
    await expect(backup(page, 'cms').getByRole('region', { name: 'Required checkpoint preview', exact: true })).toContainText('Retained points')
    await expect(backup(page, 'cms').getByRole('region', { name: 'Required checkpoint preview', exact: true })).toContainText('A required memory checkpoint must save before replacement.')
    await expect(backup(page, 'cms')).toContainText('This replaces the current CMS walkthrough workspace and its memory save. It does not merge records or change existing browser saves.')
    await button(backup(page, 'cms'), 'Replace CMS workspace').click()
    expected = { ...expected, cms: structuredClone(seed.workspaces.cms) }
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-05-individual-import'), expected)
    await expect(history(page).getByRole('listitem')).toHaveCount(2)

    await openPortal(page, 'People & HR')
    await button(page, 'Reset sample changes').click()
    const reset = page.getByRole('region', { name: 'HR Reset confirmation', exact: true })
    await expect(reset.getByRole('region', { name: 'Required checkpoint preview', exact: true })).toBeVisible()
    await expect(reset).toContainText('walkthrough')
    await button(reset, 'Confirm Reset HR').click()
    expected = { ...expected, hr: structuredClone(seed.workspaces.hr) }
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-06-required-reset'), expected)
    await expect(history(page).getByRole('listitem')).toHaveCount(3)
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Required individual import and Reset checkpoints')
    checks.push('WX-0017: individual CMS import and required HR Reset each checkpoint the prior in-memory workspace, replace only the selected records and preserve every persistent mock slot')

    await page.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('walkthrough-select-crm.json', combinedFile(seed.workspaces)))
    const restore = page.getByRole('region', { name: 'Selective restore preview', exact: true })
    await restore.getByRole('checkbox', { name: /^Restore CRM/ }).check()
    await expect(restore).toContainText('will be replaced and saved only in walkthrough memory after a memory restore point is saved.')
    await button(restore, 'Restore selected workspaces').click()
    const beforeSelectiveRestore = expected
    expected = { ...expected, crm: structuredClone(seed.workspaces.crm) }
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-07-selective-restore'), expected)
    await expect(history(page).getByRole('listitem')).toHaveCount(4)
    const restorePoint = history(page).getByRole('listitem').filter({ has: page.getByText('Before selective restore · CRM', { exact: true }) })
    await restorePoint.getByRole('button', { name: /^Undo restore point / }).click()
    await button(page.getByRole('region', { name: 'Undo preview', exact: true }), 'Confirm undo').click()
    expected = beforeSelectiveRestore
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-08-undo'), expected)
    await expect(history(page).getByRole('listitem')).toHaveCount(5)
    await button(history(page), 'Clear restore points').click()
    await button(page.getByRole('region', { name: 'Clear restore points confirmation', exact: true }), 'Confirm clear restore points').click()
    await expect(history(page).getByRole('list', { name: 'Saved restore points', exact: true })).toHaveCount(0)
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-09-clear-history'), expected)
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Selective CRM restore, Undo and clear history')
    checks.push('WX-0017: selective CRM restore and Undo recover exact complete expected records, create four then five memory points, and clearing history preserves workspaces and every browser slot')

    await page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true }).click()
    await page.getByRole('contentinfo').getByRole('link', { name: 'Docs', exact: true }).click()
    await page.getByRole('region', { name: 'First-run destinations', exact: true }).getByRole('link', { name: 'Customer relationships', exact: true }).click()
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-10-public-return'), expected)
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Public pages and portal return share one document memory')
    await page.reload()
    await expect(page.getByText(walkthroughBanner, { exact: true })).toBeVisible()
    assert.deepEqual(await downloadAll(page, artifactDir, 'walkthrough-11-refresh-fresh'), seed.workspaces)
    await expect(history(page).getByRole('list', { name: 'Saved restore points', exact: true })).toHaveCount(0)
    await openPortal(page, 'Content management')
    for (const label of ['Require checkpoint before individual imports', 'Require checkpoint before Reset']) await expect(backup(page, 'cms').getByRole('checkbox', { name: label, exact: true })).not.toBeChecked()
    await auditWalkthrough(page, context, origin, initial, storageObservations, 'Refresh keeps mode but resets records, preferences and history')
    const fresh = await context.newPage()
    try {
      fresh.setDefaultTimeout(15_000)
      fresh.on('pageerror', error => problems.push(`Fresh walkthrough page error: ${error.message}`))
      fresh.on('console', message => { if (message.type() === 'error') problems.push(`Fresh walkthrough console error: ${message.text()}`); else if (message.type() === 'warning') warnings.push(message.text()) })
      fresh.on('response', response => { if (response.status() >= 400) problems.push(`Fresh walkthrough HTTP ${response.status()}: ${response.url()}`) })
      fresh.on('requestfailed', request => problems.push(`Fresh walkthrough failed request: ${request.url()}`))
      await fresh.goto(`${origin}/portals`)
      await expect(fresh.getByText(walkthroughBanner, { exact: true })).toBeVisible()
      assert.deepEqual(await downloadAll(fresh, artifactDir, 'walkthrough-12-new-document-fresh'), seed.workspaces)
      await auditWalkthrough(fresh, context, origin, initial, storageObservations, 'New document starts fresh walkthrough memory')
    } finally { await fresh.close() }
    await page.screenshot({ path: join(artifactDir, 'walkthrough-mode-refresh.png'), fullPage: true })
    checks.push('WX-0017: public-page round trips preserve walkthrough memory; refresh and a new tab keep the explicit mode while restarting fictional records, settings and history, with all persistent sentinels unchanged')
  } finally { await context.close() }
}

/** Extended checks compose after the unchanged ten foundation groups. The
 * auxiliary walkthrough listener and its process handle belong only to this
 * helper; no existing project listener is reused or terminated. */
export async function runFoundationNavigation({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], focus = [], storageObservations = []
  let walkthrough
  let walkthroughOrigin
  let primary
  try {
    await firstRunJourney({ browser, origin, artifactDir, seed, checks, problems, warnings, focus })
    await focusJourney({ browser, origin, artifactDir, seed, checks, problems, warnings, focus })
    await normalStorageJourney({ browser, origin, artifactDir, seed, checks, problems, warnings })
    walkthrough = ownedPreviewProcess({ root: repository, cacheDir: join(artifactDir, 'walkthrough-vite-cache'), port: await allocateSmokePort(), walkthrough: true })
    await walkthrough.listen()
    const address = walkthrough.httpServer.address()
    assert.equal(address.address, '127.0.0.1')
    walkthroughOrigin = `http://127.0.0.1:${address.port}`
    await walkthroughJourney({ browser, origin: walkthroughOrigin, artifactDir, seed, checks, problems, warnings, storageObservations })
    assert.deepEqual(problems, [], 'Foundation additions require zero external/provider/backend requests, HTTP failures, console errors and uncaught exceptions')
  } catch (error) {
    primary = error
    error.smokeEvidence = { checks, problems, warnings, focus, storageObservations, walkthroughOrigin, walkthroughProcess: walkthrough?.processHandle }
    throw error
  } finally {
    try { await walkthrough?.close() }
    catch (error) { if (!primary) throw error; primary.smokeEvidence.walkthroughCleanupError = error.message }
    await writeFile(join(artifactDir, 'foundation-navigation-focus.json'), `${JSON.stringify(focus, null, 2)}\n`)
    await writeFile(join(artifactDir, 'foundation-walkthrough-storage.json'), `${JSON.stringify({ observations: storageObservations, origin: walkthroughOrigin, process: walkthrough?.processHandle }, null, 2)}\n`)
  }
  return { checks, warnings, focusObservations: focus.length, storageObservations: storageObservations.length, walkthroughOrigin, walkthroughProcess: walkthrough.processHandle }
}
