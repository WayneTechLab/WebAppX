import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'

const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, title) => navigation(page).getByRole('link', { name: title, exact: true }).click()
const storageKey = module => `webappx.demo.${module}`

async function browserSaves(context, origin) {
  const state = await context.storageState()
  assert.deepEqual(state.cookies, [], 'Native mock actions must not create account/session cookies')
  assert.ok(state.origins.every(item => item.origin === origin), 'Saves must belong to the owned test origin')
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).filter(item => item.name.startsWith('webappx.demo.')).map(item => [item.name, item.value]))
}

async function downloadJson(page, button, artifactDir, label) {
  const waiting = page.waitForEvent('download')
  await button.click()
  const download = await waiting
  const path = join(artifactDir, `${label}.json`)
  await download.saveAs(path)
  assert.equal(await download.failure(), null, 'The actual workspace download must complete')
  const text = await readFile(path, 'utf8')
  return { path, text, value: JSON.parse(text) }
}

async function combinedDownload(page, artifactDir, label) {
  await open(page, 'Portal directory')
  return downloadJson(page, page.getByRole('button', { name: 'Export all workspaces', exact: true }), artifactDir, label)
}

async function restore(page, path, modules) {
  await open(page, 'Portal directory')
  await page.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(path)
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  await expect(preview).toBeVisible()
  // The rendered preview is visible before its passive effect focuses and
  // scrolls the heading. Wait for that user-visible ready state so this effect
  // cannot move a checkbox between pointer hit testing and the actual click.
  await expect(preview.getByRole('heading', { name: 'Choose workspaces to restore', exact: true })).toBeFocused()
  for (const module of modules) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module.toUpperCase()}`) }).check()
  await preview.getByRole('button', { name: 'Restore selected workspaces', exact: true }).click()
  await expect(preview).not.toBeVisible()
}

/** Normal domain changes use rendered inputs and actions. Browser saves and
 * downloads are read as evidence, never injected. The final isolated context
 * changes only the storage platform to exercise a denied-storage condition.
 */
export async function runPortalStateContract({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = []
  let context, page
  let traceName
  try {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    traceName = 'state-contract-native-trace.zip'
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    await page.goto(`${origin}/portals`)
    const baseline = await combinedDownload(page, artifactDir, 'state-contract-baseline')
    assert.deepEqual(baseline.value.workspaces, seed.workspaces)
    assert.deepEqual(await browserSaves(context, origin), {}, 'Opening or exporting seeds must not create native workspace saves')
    checks.push('Fresh native seeds export fully while workspace and recovery slots remain absent')

    await open(page, 'People & HR')
    await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
    await page.getByRole('combobox', { name: /^Synthetic employee identity/ }).selectOption('employee-001')
    await page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1.25')
    await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
    await page.getByRole('button', { name: 'Add sample time', exact: true }).click()
    const afterTime = await browserSaves(context, origin)
    const hr = JSON.parse(afterTime[storageKey('hr')]).data
    assert.equal(hr.selectedEmployee, 'employee-001')
    assert.equal(hr.workflow.timeEntries.length, seed.workspaces.hr.workflow.timeEntries.length + 1)
    assert.deepEqual(hr.workflow.timeEntries.at(-1), { id: 'MOCK-TIME-0001', employeeId: 'employee-001', date: '2026-10-14', hours: 1.25, source: 'manual', status: 'draft' })
    await page.getByRole('button', { name: 'Start sample timer', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Stop and add sample time', exact: true })).toBeVisible()
    await page.getByLabel('Work date', { exact: true }).fill('2026-10-13')
    await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('2.75')
    await open(page, 'Content management')
    assert.deepEqual(await browserSaves(context, origin), afterTime, 'Live timer and unsaved HR fields must not change saved records')
    await open(page, 'People & HR')
    await expect(page.getByRole('heading', { name: 'People workspace', exact: true })).toBeVisible()
    await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
    await expect(page.getByRole('combobox', { name: /^Synthetic employee identity/ })).toHaveValue('employee-001')
    await page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Start sample timer', exact: true })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('8')
    await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-10-15')
    checks.push('HR saves draft time and employee selection, while portal switching cancels its live timer and clears route-local date/hours without recording timer time')

    await open(page, 'Content management')
    await page.locator('#edit-title').fill('Retained state contract draft')
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await page.locator('#edit-title').fill('UNSAVED CMS edit contract')
    await page.locator('#create-title').fill('UNSAVED CMS create contract')
    await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption('articles')
    await page.getByRole('searchbox', { name: 'Search content', exact: true }).fill('Retained')
    await open(page, 'Customer relationships')
    await page.getByRole('combobox', { name: 'CRM preview identity', exact: true }).selectOption('crm-manager')
    await page.getByRole('button', { name: 'Companies & contacts', exact: true }).click()
    await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('Retained Contact Fiction')
    await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('retained-contract@fiction.invalid')
    await page.getByRole('button', { name: 'Create sample contact', exact: true }).click()
    await expect(page.getByText('retained-contract@fiction.invalid', { exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('UNSAVED CRM contact contract')
    await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('unsaved-contract@fiction.invalid')
    const saved = await browserSaves(context, origin)
    assert.deepEqual(JSON.parse(saved[storageKey('cms')]).data.entries.find(item => item.id === 'cms-page-001').published, seed.workspaces.cms.entries.find(item => item.id === 'cms-page-001').published, 'CMS save must retain the frozen published snapshot')
    for (const raw of Object.values(saved)) {
      assert.ok(!raw.includes('UNSAVED '), 'Native workspace envelopes must exclude unsaved text')
      assert.ok(!raw.includes('unsaved-contract@fiction.invalid'), 'Native workspace envelopes must exclude unsaved contact email')
    }
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue('UNSAVED CMS edit contract')
    await expect(page.locator('#create-title')).toHaveValue('UNSAVED CMS create contract')
    await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue('articles')
    await expect(page.getByRole('searchbox', { name: 'Search content', exact: true })).toHaveValue('Retained')
    await open(page, 'Customer relationships')
    await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-manager')
    await expect(page.getByRole('button', { name: 'Companies & contacts', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('textbox', { name: 'Contact name', exact: true })).toHaveValue('UNSAVED CRM contact contract')
    await expect(page.getByRole('textbox', { name: 'Contact email', exact: true })).toHaveValue('unsaved-contract@fiction.invalid')
    checks.push('CMS mounted forms, collection/search and CRM identity/tab/contact inputs survive portal switching while only saved draft/publication/contact records enter storage')

    const current = await combinedDownload(page, artifactDir, 'state-contract-records-only')
    assert.equal(current.value.workspaces.cms.entries.find(item => item.id === 'cms-article-001').title, 'Retained state contract draft')
    assert.equal(current.value.workspaces.hr.workflow.timeEntries.at(-1).hours, 1.25)
    assert.ok(current.value.workspaces.crm.contacts.some(item => item.email === 'retained-contract@fiction.invalid'))
    assert.ok(!current.text.includes('UNSAVED '))
    assert.ok(!current.text.includes('unsaved-contract@fiction.invalid'))
    assert.deepEqual(Object.keys(current.value).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
    checks.push('Actual combined JSON contains accepted draft time, CMS draft/publication and saved contact, excluding unsaved UI and recovery history')

    await restore(page, baseline.path, ['cms'])
    let restored = await browserSaves(context, origin)
    assert.equal(restored[storageKey('hr')], saved[storageKey('hr')])
    assert.equal(restored[storageKey('crm')], saved[storageKey('crm')])
    assert.deepEqual(JSON.parse(restored[storageKey('cms')]).data, seed.workspaces.cms)
    let history = JSON.parse(restored[storageKey('restore-points')]).points
    assert.equal(history.length, 1)
    assert.deepEqual(history[0].modules, ['cms'])
    assert.deepEqual(history[0].states, { cms: current.value.workspaces.cms })
    await open(page, 'Customer relationships')
    await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-manager')
    await expect(page.getByRole('textbox', { name: 'Contact name', exact: true })).toHaveValue('UNSAVED CRM contact contract')
    await open(page, 'Content management')
    await expect(page.getByRole('combobox', { name: 'CMS preview identity', exact: true })).toHaveValue('cms-author')
    await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue('all')
    await expect(page.getByRole('searchbox', { name: 'Search content', exact: true })).toHaveValue('')
    await expect(page.locator('#edit-title')).toHaveValue('A fictional team update')
    await expect(page.locator('#create-title')).toHaveValue('')
    checks.push('Selecting CMS replaces its full records and clears its transient UI; unchecked CRM keeps identity/tab/unsaved contact and exact HR/CRM saves; recovery point contains only prior CMS records')

    await page.locator('#create-title').fill('UNSAVED CMS survives CRM restore')
    await restore(page, baseline.path, ['crm'])
    restored = await browserSaves(context, origin)
    assert.deepEqual(JSON.parse(restored[storageKey('crm')]).data, seed.workspaces.crm)
    history = JSON.parse(restored[storageKey('restore-points')]).points
    assert.deepEqual(history[0].modules, ['crm'])
    assert.deepEqual(history[0].states, { crm: current.value.workspaces.crm })
    await open(page, 'Customer relationships')
    await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-owner')
    await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Companies & contacts', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Contact name', exact: true })).toHaveValue('')
    await open(page, 'Content management')
    await expect(page.locator('#create-title')).toHaveValue('UNSAVED CMS survives CRM restore')
    checks.push('Selecting CRM resets its identity/tab/forms and captures its prior saved contacts; unchecked CMS preserves its unsaved form')

    await open(page, 'Portal directory')
    await page.getByRole('button', { name: /^Undo restore point .* CMS$/ }).click()
    await page.getByRole('button', { name: 'Confirm undo', exact: true }).click()
    restored = await browserSaves(context, origin)
    history = JSON.parse(restored[storageKey('restore-points')]).points
    assert.equal(history[0].kind, 'undo')
    assert.deepEqual(history[0].states, { cms: seed.workspaces.cms })
    assert.deepEqual(JSON.parse(restored[storageKey('cms')]).data, current.value.workspaces.cms)
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue('Retained state contract draft')
    await expect(page.locator('#create-title')).toHaveValue('')
    checks.push('Undo restores the captured CMS records, clears selected transient forms and saves a new point for reversing the Undo')

    await page.locator('#create-title').fill('UNSAVED refresh-only CMS field')
    await page.getByRole('searchbox', { name: 'Search content', exact: true }).fill('Retained')
    await open(page, 'Customer relationships')
    await page.getByRole('combobox', { name: 'CRM preview identity', exact: true }).selectOption('crm-manager')
    await page.getByRole('button', { name: 'Companies & contacts', exact: true }).click()
    await page.getByRole('textbox', { name: 'Contact name', exact: true }).fill('UNSAVED refresh-only CRM field')
    const beforeRefresh = await browserSaves(context, origin)
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-owner')
    await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue('Retained state contract draft')
    await expect(page.locator('#create-title')).toHaveValue('')
    await expect(page.getByRole('searchbox', { name: 'Search content', exact: true })).toHaveValue('')
    assert.deepEqual(await browserSaves(context, origin), beforeRefresh)
    checks.push('Refresh keeps exact workspace/history saves but clears CMS unsaved input/search and CRM temporary identity/tab')

    await restore(page, baseline.path, ['hr'])
    restored = await browserSaves(context, origin)
    assert.deepEqual(JSON.parse(restored[storageKey('hr')]).data, seed.workspaces.hr)
    history = JSON.parse(restored[storageKey('restore-points')]).points
    assert.deepEqual(history[0].modules, ['hr'])
    assert.deepEqual(history[0].states, { hr: current.value.workspaces.hr })
    await open(page, 'People & HR')
    await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
    await expect(page.getByRole('combobox', { name: /^Synthetic employee identity/ })).toHaveValue(seed.workspaces.hr.selectedEmployee)
    checks.push('Selecting HR captures its complete prior draft time/selection records and restores saved employee selection from the target workspace')

    const beforeReset = await browserSaves(context, origin)
    await open(page, 'Content management')
    await page.getByRole('button', { name: 'Reset CMS samples', exact: true }).click()
    const afterReset = await browserSaves(context, origin)
    assert.equal(afterReset[storageKey('cms')], undefined)
    assert.equal(afterReset[storageKey('hr')], beforeReset[storageKey('hr')])
    assert.equal(afterReset[storageKey('crm')], beforeReset[storageKey('crm')])
    assert.equal(afterReset[storageKey('restore-points')], beforeReset[storageKey('restore-points')], 'Reset must not erase recoverable history')
    assert.equal(await readFile(baseline.path, 'utf8'), baseline.text, 'Reset must not change downloaded files')
    await open(page, 'Portal directory')
    await page.getByRole('button', { name: 'Clear restore points', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm clear restore points', exact: true }).click()
    const afterClear = await browserSaves(context, origin)
    assert.deepEqual(afterClear, Object.fromEntries(Object.entries(afterReset).filter(([key]) => key !== storageKey('restore-points'))))
    checks.push('Portal Reset removes only its own save while preserving history/downloads; explicit history clear removes only recovery snapshots')
    await page.screenshot({ path: join(artifactDir, 'state-contract-directory.png'), fullPage: true })
    await context.tracing.stop({ path: join(artifactDir, traceName) }); traceName = undefined
    await context.close(); context = undefined

    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    traceName = 'state-contract-denied-storage-trace.zip'
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied by isolated state-contract fixture', 'SecurityError') } })
    })
    await page.goto(`${origin}/cms/demo`)
    await page.locator('#edit-title').fill('Memory-only fictional CMS draft')
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await expect(page.getByText(/CMS changes are only in memory because this browser could not save them/)).toBeVisible()
    await open(page, 'Customer relationships')
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue('Memory-only fictional CMS draft')
    const memory = await downloadJson(page, page.getByRole('button', { name: 'Export workspace', exact: true }), artifactDir, 'state-contract-denied-storage-export')
    assert.equal(memory.value.data.entries.find(item => item.id === 'cms-article-001').title, 'Memory-only fictional CMS draft')
    assert.deepEqual(await browserSaves(context, origin), {})
    await page.reload()
    await expect(page.locator('#edit-title')).toHaveValue('A fictional team update')
    checks.push('An isolated denied-storage platform fault keeps accepted CMS records in memory across portal switches and export, but refresh opens seeds')
    assert.deepEqual(problems, [], 'State contract requires zero external/provider/backend requests, failed HTTP requests, console errors or uncaught exceptions')
    return { checks, warnings }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true }) } catch { /* Preserve the primary failure. */ }
    error.smokeEvidence = { checks, problems, warnings }
    throw error
  } finally {
    if (context && traceName) {
      try { await context.tracing.stop({ path: join(artifactDir, traceName) }) } catch { /* Preserve the original test failure. */ }
    }
    if (context) await context.close()
  }
}
