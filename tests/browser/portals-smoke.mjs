import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { expectedAfter, dashboardTotals, smokeChanges } from './seed-contract.mjs'
import { loadMockModel } from './model-loader.mjs'

const portalIds = ['hr', 'cms', 'crm']
const keys = portalIds.map(portal => `webappx.demo.${portal}`)
export const smokeHmrPath = '/__webappx_smoke_hmr'

export function isAllowedSmokeRequest(url, origin) {
  try {
    const parsed = new URL(url)
    return parsed.origin === origin && !/^\/(?:__systemx|__gusto_mock__|api|integrations|gusto-mock)(?:\/|$)/.test(parsed.pathname)
  } catch { return false }
}

export function isAllowedSmokeWebSocket(url, origin) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'ws:' && parsed.host === new URL(origin).host && parsed.pathname === smokeHmrPath
  } catch { return false }
}

async function metric(page, label, value) {
  const row = page.getByText(label, { exact: true }).locator('..')
  await expect(row.getByText(String(value), { exact: true })).toBeVisible()
}

async function assertHrDashboard(page, totals) {
  await expect(page.getByRole('heading', { name: 'People workspace', exact: true })).toBeVisible()
  await metric(page, 'People in scope', totals.people)
  await metric(page, 'Time awaiting approval', totals.timeAwaitingApproval)
  await metric(page, 'Submitted payroll receipts', totals.submittedPayrollReceipts)
  await metric(page, 'Goals', totals.goals)
  await metric(page, 'Open reviews', totals.openReviews)
}
async function assertCmsDashboard(page, totals) {
  await expect(page.getByRole('heading', { name: 'Content publishing workspace', exact: true })).toBeVisible()
  const metrics = page.getByRole('region', { name: 'CMS metrics', exact: true })
  for (const [label, value] of [['Drafts', totals.drafts], ['Awaiting review', totals.awaitingReview], ['Approved revisions', totals.approvedRevisions], ['Published samples', totals.publishedSamples]]) await metric(metrics, label, value)
}
async function assertCrmDashboard(page, totals) {
  await expect(page.getByRole('heading', { name: 'CRM portal', exact: true })).toBeVisible()
  await metric(page, 'Active sample leads', totals.activeLeads)
  await metric(page, 'Open sample pipeline', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.openPipelineCents / 100))
  await metric(page, 'Sample won value', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.wonCents / 100))
  await metric(page, 'Open follow-ups', totals.openFollowUps)
}

function navigation(page) { return page.getByRole('navigation', { name: 'Template workspaces', exact: true }) }
async function openPortal(page, title) { await navigation(page).getByRole('link', { name: title, exact: true }).click() }
async function openHrDashboard(page) {
  await openPortal(page, 'People & HR')
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Management', exact: true }).click()
}

async function exportSnapshot(page, artifactDir, label) {
  await openPortal(page, 'Portal directory')
  const section = page.getByRole('region', { name: 'Combined workspace backup', exact: true })
  const downloadPromise = page.waitForEvent('download')
  await section.getByRole('button', { name: 'Export all workspaces', exact: true }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /^webappx-all-mock-workspaces-.*\.json$/)
  const destination = join(artifactDir, `${label}.json`)
  await download.saveAs(destination)
  assert.equal(await download.failure(), null, 'The actual combined workspace download must complete')
  const text = await readFile(destination, 'utf8')
  const { parseCombinedBackup } = await loadMockModel(new URL('../../src/portals/combined-backup.ts', import.meta.url))
  return parseCombinedBackup(text).states
}

function observePage(page, problems, warnings) {
  page.on('pageerror', error => problems.push(`Uncaught browser error: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`Browser console error: ${message.text()}`)
    else if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('response', response => { if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`) })
  page.on('requestfailed', request => problems.push(`Failed request: ${request.url()} (${request.failure()?.errorText})`))
}

export async function newIsolatedContext(browser, origin, problems, warnings) {
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' })
  await context.route('**/*', async route => {
    if (isAllowedSmokeRequest(route.request().url(), origin)) await route.continue()
    else {
      problems.push(`Unexpected external/provider/backend request: ${route.request().url()}`)
      await route.abort('blockedbyclient')
    }
  })
  await context.routeWebSocket('**/*', socket => {
    if (isAllowedSmokeWebSocket(socket.url(), origin)) socket.connectToServer()
    else { problems.push(`Unexpected WebSocket: ${socket.url()}`); socket.close() }
  })
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] }, 'Each run must start in a fresh browser context')
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(30_000)
  observePage(page, problems, warnings)
  return { context, page }
}

async function assertSavedPayloads(context, origin, expected, auxiliarySaves) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'Mock workflows must not create account/session cookies')
  assert.equal(storage.origins.length, 1)
  const saved = storage.origins.find(item => item.origin === origin)
  assert.ok(saved, 'Saved workspaces must belong only to the owned test origin')
  assert.deepEqual(saved.localStorage.map(item => item.name).sort(), [...keys, ...auxiliarySaves.map(item => item.name)].sort(), 'Only workspace saves and the unchanged app accessibility preference should be present')
  assert.deepEqual(saved.localStorage.filter(item => !keys.includes(item.name)), auxiliarySaves, 'Portal mutations must preserve the app accessibility preference exactly')
  for (const portal of portalIds) {
    const envelope = JSON.parse(saved.localStorage.find(item => item.name === `webappx.demo.${portal}`).value)
    assert.deepEqual(envelope, { schemaVersion: 1, module: portal, data: expected[portal] }, `The full ${portal.toUpperCase()} saved envelope must match its expected records`)
  }
}

/** All domain changes below are actual user-facing controls. Full exports and
 * the refreshed saved envelopes are compared with independently stated records.
 * No evaluate(), storage injection, reducer injection or provider session is used.
 */
export async function runPortalSmoke({ browser, origin, artifactDir, seed }) {
  const checks = []
  const problems = []
  const warnings = []
  let context
  let page
  let traceStarted = false
  try {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    traceStarted = true
    await page.goto(`${origin}/portals`)
    await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
    assert.deepEqual(await exportSnapshot(page, artifactDir, '00-baseline'), seed.workspaces)
    const baselineStorage = await context.storageState()
    assert.deepEqual(baselineStorage.cookies, [])
    const auxiliarySaves = baselineStorage.origins.find(item => item.origin === origin)?.localStorage ?? []
    assert.deepEqual(auxiliarySaves.map(item => item.name), ['sfwa-wtl:accessibility-preferences'], 'A fresh app may save only its default accessibility preference before a domain action')
    checks.push('Fresh browser context exports the complete reviewed named seed')

    await openPortal(page, 'People & HR')
    await assertHrDashboard(page, seed.dashboardTotals.hr)
    await page.screenshot({ path: join(artifactDir, '01-hr-baseline.png'), fullPage: true })
    await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Performance', exact: true }).click()
    await page.getByRole('combobox', { name: 'Goal employee', exact: true }).selectOption(smokeChanges.goalEmployee)
    await page.getByRole('textbox', { name: 'Goal title', exact: true }).fill(smokeChanges.goalTitle)
    await page.getByRole('button', { name: 'Create sample goal', exact: true }).click()
    await expect(page.getByText(smokeChanges.goalTitle, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(smokeChanges.goalTitle, { exact: true })).toBeVisible()
    let expected = expectedAfter(seed.workspaces, 'hr')
    assert.deepEqual(await exportSnapshot(page, artifactDir, '02-after-hr-refresh'), expected, 'HR persists its new goal; all CMS/CRM records remain unchanged')
    await openHrDashboard(page)
    await assertHrDashboard(page, dashboardTotals(expected).hr)
    checks.push('HR: create goal, reload, update dashboard and compare full payload; CMS/CRM preserved')

    await openPortal(page, 'Content management')
    await assertCmsDashboard(page, seed.dashboardTotals.cms)
    await page.locator('#edit-title').fill(smokeChanges.contentTitle)
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await expect(page.locator('#edit-title')).toHaveValue(smokeChanges.contentTitle)
    await page.reload()
    await expect(page.locator('#edit-title')).toHaveValue(smokeChanges.contentTitle)
    expected = expectedAfter(expected, 'cms')
    assert.deepEqual(await exportSnapshot(page, artifactDir, '03-after-cms-refresh'), expected, 'CMS persists the exact revision and receipt; all HR/CRM records remain unchanged')
    await openPortal(page, 'Content management')
    await assertCmsDashboard(page, dashboardTotals(expected).cms)
    await page.screenshot({ path: join(artifactDir, '04-cms-persisted.png'), fullPage: true })
    checks.push('CMS: save draft revision, reload and compare full payload; HR/CRM preserved')

    await openPortal(page, 'Customer relationships')
    await assertCrmDashboard(page, seed.dashboardTotals.crm)
    await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: 'Leads', exact: true }).click()
    await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill(smokeChanges.leadName)
    await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill(smokeChanges.leadEmail)
    await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill(smokeChanges.leadCompany)
    await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
    await expect(page.getByRole('heading', { name: smokeChanges.leadName, exact: true })).toBeVisible()
    await page.reload()
    expected = expectedAfter(expected, 'crm')
    await assertCrmDashboard(page, dashboardTotals(expected).crm)
    assert.deepEqual(await exportSnapshot(page, artifactDir, '05-after-crm-refresh'), expected, 'CRM persists the new lead and receipt; all HR/CMS records remain unchanged')
    await assertSavedPayloads(context, origin, expected, auxiliarySaves)
    await openPortal(page, 'Customer relationships')
    await page.screenshot({ path: join(artifactDir, '06-crm-persisted.png'), fullPage: true })
    checks.push('CRM: create fictional lead, reload, update dashboard and compare full payload; HR/CMS preserved')
    checks.push('All three exact saved envelopes contain only expected synthetic data; no account cookies')
    await context.tracing.stop({ path: join(artifactDir, 'trace.zip') })
    traceStarted = false
    await context.close()
    context = undefined

    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await page.goto(`${origin}/portals`)
    assert.deepEqual(await exportSnapshot(page, artifactDir, '07-second-context-baseline'), seed.workspaces, 'A second isolated context must not inherit any prior run data')
    const secondStorage = await context.storageState()
    assert.deepEqual(secondStorage.cookies, [])
    assert.deepEqual(secondStorage.origins.find(item => item.origin === origin)?.localStorage ?? [], auxiliarySaves, 'Reading/exporting fresh sample fixtures may save the default accessibility preference, without any domain save')
    checks.push('A second fresh context restores the unchanged baseline without cross-context leakage')
    assert.deepEqual(problems, [], 'Browser smoke requires zero external/provider/backend requests, failed HTTP requests, console errors and uncaught exceptions')
    checks.push('Zero external/provider/backend requests, failed HTTP requests, browser console errors or uncaught exceptions')
    return { checks, warnings, baselineTotals: seed.dashboardTotals, finalTotals: dashboardTotals(expected), baselineHash: seed.sha256 }
  } catch (error) {
    if (page && !page.isClosed()) {
      try { await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true, timeout: 5_000 }) } catch { /* The context may already be closed after a timeout. */ }
    }
    error.smokeEvidence = { checks, problems, warnings }
    throw error
  } finally {
    if (traceStarted && context) {
      try { await context.tracing.stop({ path: join(artifactDir, 'trace.zip') }) } catch { /* Preserve the original test failure. */ }
    }
    if (context) await context.close()
  }
}
