import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'

const modules = ['hr', 'cms', 'crm']
const names = { hr: 'People & HR', cms: 'Content management', crm: 'Customer relationships' }
const key = module => `webappx.demo.${module}`
const historyKey = key('restore-points')
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const open = (page, title) => page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: title, exact: true }).click()
const combined = page => page.getByRole('region', { name: 'Combined workspace backup', exact: true })

async function saves(context, origin) {
  const state = await context.storageState()
  assert.deepEqual(state.cookies, [], 'The recovery drill must not create account cookies')
  assert.ok(state.origins.every(item => item.origin === origin), 'Only the runner-owned origin can contain fixture saves')
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}

async function download(page, button, artifactDir, label) {
  const waiting = page.waitForEvent('download')
  await button.click()
  const item = await waiting
  const path = join(artifactDir, `${label}.json`)
  await item.saveAs(path)
  assert.equal(await item.failure(), null, 'The rendered export must finish writing its actual download')
  const text = await readFile(path, 'utf8')
  return { path, text, value: JSON.parse(text) }
}

/** A presentation-only probe of the actual observed status scene. Remove the
 * temporary stylesheet even when capture fails; never modify model/storage. */
async function captureStatusScene(page, artifactDir, label, status) {
  await expect(status).toBeVisible()
  await page.screenshot({ path: join(artifactDir, `${label}.png`), fullPage: true })
  const colorName = `${label}-status.png`
  const monochromeName = `${label}-status-monochrome.png`
  const color = await status.screenshot({ path: join(artifactDir, colorName) })
  const width = color.readUInt32BE(16), height = color.readUInt32BE(20)
  assert.ok(width > 0 && width <= 1440 && height > 0 && height <= 1080, 'The actual status/control locator capture must fit one normal viewport for readable inspection')
  const style = await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' })
  try {
    await page.screenshot({ path: join(artifactDir, `${label}-monochrome.png`), fullPage: true })
    const monochrome = await status.screenshot({ path: join(artifactDir, monochromeName) })
    assert.equal(monochrome.readUInt32BE(16), width)
    assert.equal(monochrome.readUInt32BE(20), height)
  }
  finally { await style.evaluate(element => element.remove()) }
  return { color: colorName, monochrome: monochromeName, width, height, source: 'actual product DOM locator; full-page originals also retained' }
}

async function exportAll(page, artifactDir, label, expected) {
  await open(page, 'Portal directory')
  const result = await download(page, combined(page).getByRole('button', { name: 'Export all workspaces', exact: true }), artifactDir, label)
  assert.deepEqual(Object.keys(result.value).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(result.value.format, 'webappx-mock-workspaces')
  assert.equal(result.value.schemaVersion, 1)
  assert.match(result.value.exportedAt, utc)
  for (const module of modules) assert.deepEqual(result.value.workspaces[module], expected[module], `Full ${module.toUpperCase()} memory export must match the independent expected records`)
  return result
}

/** Each portal is exported independently, then checked against its own literal
 * expectation. No application reducer/codec generates expected domain changes. */
async function verifyPortals(page, context, origin, artifactDir, prefix, expected) {
  const before = await saves(context, origin)
  for (const module of modules) {
    await open(page, names[module])
    const region = page.getByRole('region', { name: `${module.toUpperCase()} workspace backup`, exact: true })
    const result = await download(page, region.getByRole('button', { name: 'Export workspace', exact: true }), artifactDir, `${prefix}-${module}`)
    assert.deepEqual(Object.keys(result.value).sort(), ['data', 'exportedAt', 'format', 'module', 'schemaVersion'])
    assert.equal(result.value.format, 'webappx-mock-workspace')
    assert.equal(result.value.module, module)
    assert.equal(result.value.schemaVersion, 1)
    assert.match(result.value.exportedAt, utc)
    assert.deepEqual(result.value.data, expected[module], `${module.toUpperCase()} individual export must preserve every expected record`)
    assert.deepEqual(JSON.parse(before[key(module)]), { schemaVersion: 1, module, data: expected[module] }, `${module.toUpperCase()} saved envelope must independently match memory`)
  }
  assert.deepEqual(await saves(context, origin), before, 'Independent inspection/exports must not write saves or history')
}

function expectedCms(seed, title) {
  const next = structuredClone(seed)
  const article = next.cms.entries.find(entry => entry.id === 'cms-article-001')
  assert.equal(article.revision, 1)
  assert.equal(next.cms.sequence, 0)
  Object.assign(article, { title, revision: 2, status: 'draft', approval: null, feedback: '' })
  next.cms.sequence = 1
  next.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  return next
}

function expectedCurrent(seed) {
  const next = expectedCms(seed, 'Fictional recovery drill saved draft')
  assert.equal(next.hr.workflow.sequence, 1)
  next.hr.selectedEmployee = 'employee-001'
  next.hr.workflow.sequence = 2
  next.hr.workflow.timeEntries.push({ id: 'MOCK-TIME-0001', employeeId: 'employee-001', date: '2026-10-14', hours: 1.25, source: 'manual', status: 'draft' })
  assert.equal(next.crm.sequence, 1)
  next.crm.sequence = 2
  next.crm.leads.push({ id: 'lead-0001', name: 'Recovery Drill Fiction', email: 'recovery-drill@fixture.invalid', companyName: 'Fictional Recovery Drill Studio', ownerId: 'crm-owner', status: 'new' })
  next.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: 'Created sample lead Recovery Drill Fiction.' })
  return next
}

async function createCurrent(page) {
  await open(page, names.hr)
  await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true }).click()
  await page.getByRole('combobox', { name: /^Synthetic employee identity/ }).selectOption('employee-001')
  await page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('1.25')
  await page.getByRole('button', { name: 'Add sample time', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Time entry MOCK-TIME-0001', exact: true })).toContainText('1.25 hours')
  await open(page, names.cms)
  await page.locator('#edit-title').fill('Fictional recovery drill saved draft')
  await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
  await open(page, names.crm)
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill('Recovery Drill Fiction')
  await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill('recovery-drill@fixture.invalid')
  await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill('Fictional Recovery Drill Studio')
  await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
  await expect(page.getByText('recovery-drill@fixture.invalid', { exact: true })).toBeVisible()
}

async function previewRestore(page, path, selected) {
  await open(page, 'Portal directory')
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(path)
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  await expect(preview.getByRole('heading', { name: 'Choose workspaces to restore', exact: true })).toBeFocused()
  for (const module of selected) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module.toUpperCase()}`) }).check()
  return preview
}

/** Test-only storage platform fault. It never reads/writes React state or calls
 * domain transitions. The normal-mode original methods serve real UI actions.
 * The deliberately failed target write changes CMS before throwing; rollback
 * restores CMS, but refuses HR and history, leaving an observable mixed save. */
function installPartialStorageFault() {
  const set = Storage.prototype.setItem
  const remove = Storage.prototype.removeItem
  let armed = false
  let failed = false
  const events = []
  Storage.prototype.setItem = function (name, value) {
    if (!armed) return set.call(this, name, value)
    if (failed && name === 'webappx.demo.hr') { events.push({ operation: 'set', key: name, outcome: 'refused-rollback' }); throw new DOMException('Controlled recovery drill rollback failure', 'QuotaExceededError') }
    if (!failed && name === 'webappx.demo.cms') {
      set.call(this, name, value)
      failed = true
      events.push({ operation: 'set', key: name, outcome: 'wrote-then-threw' })
      throw new DOMException('Controlled recovery drill write failure', 'QuotaExceededError')
    }
    set.call(this, name, value)
    events.push({ operation: 'set', key: name, outcome: 'saved' })
  }
  Storage.prototype.removeItem = function (name) {
    if (armed && failed && name === 'webappx.demo.restore-points') { events.push({ operation: 'remove', key: name, outcome: 'refused-rollback' }); throw new DOMException('Controlled recovery drill history rollback failure', 'QuotaExceededError') }
    return remove.call(this, name)
  }
  Object.defineProperty(window, '__recoveryDrillStorage', { value: {
    arm() { armed = true; failed = false; events.length = 0 },
    disarm() { armed = false },
    events() { return events.map(event => ({ ...event })) },
  } })
}

function checkPoint(point, expected, scope) {
  assert.deepEqual(Object.keys(point).sort(), ['createdAt', 'id', 'kind', 'modules', 'states'])
  assert.match(point.id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  assert.match(point.createdAt, utc)
  assert.equal(point.kind, 'restore')
  assert.deepEqual(point.modules, scope)
  assert.deepEqual(point.states, Object.fromEntries(scope.map(module => [module, expected[module]])))
}

/** Actual uploads/downloads and rendered actions in owned contexts. The only
 * injected state is an explicitly identified storage-platform fault/corruption.
 * Domain expectations are hand-written above; no model creates expected data. */
export async function runRecoveryFailureDrill({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], observations = []
  let context, page, traceName
  const current = expectedCurrent(seed.workspaces)
  async function start(name, init) {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    if (init) await page.addInitScript(init)
    traceName = `${name}-trace.zip`
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    await page.goto(`${origin}/portals`)
  }
  async function close() {
    await context.tracing.stop({ path: join(artifactDir, traceName) }); traceName = undefined
    await context.close(); context = undefined
  }
  try {
    await start('partial-rollback', installPartialStorageFault)
    const baseline = await exportAll(page, artifactDir, '00-portable-seed', seed.workspaces)
    await createCurrent(page)
    const portable = await exportAll(page, artifactDir, '01-current-before-fault', current)
    await verifyPortals(page, context, origin, artifactDir, '02-current', current)
    const before = await saves(context, origin)
    assert.equal(before[historyKey], undefined)
    await writeFile(join(artifactDir, '03-before-raw-saves.json'), JSON.stringify(before, null, 2) + '\n')
    checks.push('Real HR draft time, CMS revision 2 and CRM lead match independent complete expected records, saved envelopes and individual portable exports')

    const invalidCms = { format: 'webappx-mock-workspace', schemaVersion: 1, module: 'cms', exportedAt: '2026-10-15T12:00:00.000Z', data: structuredClone(current.cms) }
    invalidCms.data.entries[0].revision = 0
    const badFiles = [['invalid-individual-json', '{deliberately malformed fictional JSON'], ['invalid-individual-records', JSON.stringify(invalidCms)], ['invalid-combined-json', '{deliberately malformed fictional JSON'], ['invalid-combined-records', JSON.stringify({ ...baseline.value, workspaces: { hr: seed.workspaces.hr } })]]
    for (const [label, text] of badFiles) {
      const path = join(artifactDir, `${label}.json`)
      await writeFile(path, text)
      if (label.includes('individual')) {
        await open(page, names.cms)
        const region = page.getByRole('region', { name: 'CMS workspace backup', exact: true })
        await region.getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(path)
        await expect(region.getByRole('alert')).toContainText('Current workspace unchanged.')
        await expect(region.getByRole('button', { name: 'Replace CMS workspace', exact: true })).not.toBeVisible()
      } else {
        await open(page, 'Portal directory')
        await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(path)
        await expect(combined(page).getByRole('alert')).toContainText('Current workspaces unchanged.')
        await expect(page.getByRole('region', { name: 'Selective restore preview', exact: true })).not.toBeVisible()
      }
      assert.deepEqual(await saves(context, origin), before, `${label} must preserve every exact browser save byte, history absence and unrelated preference`)
      await exportAll(page, artifactDir, `04-after-${label}`, current)
    }
    await exportAll(page, artifactDir, '04-after-invalid-imports', current)
    checks.push('Malformed and incompatible individual/combined UI uploads are refused before replacement with exact unchanged memory and browser save bytes')

    const preview = await previewRestore(page, baseline.path, ['hr', 'cms'])
    await expect(preview.getByRole('button', { name: 'Restore selected workspaces', exact: true })).toBeEnabled()
    const faultDocument = await page.evaluate(() => performance.timeOrigin)
    await page.evaluate(() => window.__recoveryDrillStorage.arm())
    await preview.getByRole('button', { name: 'Restore selected workspaces', exact: true }).click()
    await expect(combined(page).getByRole('alert')).toContainText('could not roll back: HR save, restore-point history')
    await expect(combined(page).getByRole('alert')).toContainText('The current in-memory workspaces remain open.')
    await expect(combined(page).getByRole('alert')).toContainText('Keep this tab open and export the current workspaces before refreshing.')
    await expect(combined(page).getByRole('alert')).toContainText('Browser saves may have changed.')
    const faultEvents = await page.evaluate(() => window.__recoveryDrillStorage.events())
    assert.deepEqual(faultEvents, [
      { operation: 'set', key: historyKey, outcome: 'saved' },
      { operation: 'set', key: key('hr'), outcome: 'saved' },
      { operation: 'set', key: key('cms'), outcome: 'wrote-then-threw' },
      { operation: 'set', key: key('cms'), outcome: 'saved' },
      { operation: 'set', key: key('hr'), outcome: 'refused-rollback' },
      { operation: 'remove', key: historyKey, outcome: 'refused-rollback' },
    ])
    const uncertain = await saves(context, origin)
    assert.equal(uncertain[key('hr')], JSON.stringify({ schemaVersion: 1, module: 'hr', data: seed.workspaces.hr }), 'Failed HR rollback leaves the target seed save, even though live HR memory stays current')
    assert.equal(uncertain[key('cms')], before[key('cms')], 'The write that changed CMS before throwing must also be rolled back')
    assert.equal(uncertain[key('crm')], before[key('crm')], 'Unselected CRM save must remain byte-identical')
    const attemptedHistory = JSON.parse(uncertain[historyKey])
    assert.deepEqual(Object.keys(attemptedHistory).sort(), ['points', 'schemaVersion'])
    assert.equal(attemptedHistory.schemaVersion, 1)
    assert.equal(attemptedHistory.points.length, 1)
    checkPoint(attemptedHistory.points[0], current, ['hr', 'cms'])
    assert.deepEqual(Object.fromEntries(Object.entries(uncertain).filter(([name]) => ![key('hr'), historyKey].includes(name))), Object.fromEntries(Object.entries(before).filter(([name]) => ![key('hr'), historyKey].includes(name))))
    await writeFile(join(artifactDir, '05-uncertain-raw-saves.json'), JSON.stringify(uncertain, null, 2) + '\n')
    const uncertainCapture = await captureStatusScene(page, artifactDir, '06-uncertain-guidance', combined(page).getByRole('alert'))
    checks.push('A controlled write-after-change and partial rollback failure produce exact mixed saved slots while preserving live workspaces and displaying stop/export-before-refresh guidance')

    const rescue = await exportAll(page, artifactDir, '07-rescue-current-memory-BEFORE-RELOAD', current)
    assert.equal(await page.evaluate(() => performance.timeOrigin), faultDocument, 'The rescue export must complete in the same document as the failed restore, before any reload')
    assert.deepEqual(rescue.value.workspaces, portable.value.workspaces)
    assert.deepEqual(await saves(context, origin), uncertain, 'Rescue export must not repair or overwrite uncertain browser slots')
    observations.push({ case: 'partial-rollback', injection: 'owned-context Storage methods only; CMS changes then throws, CMS rollback succeeds, HR and history rollback fail', reloadBeforeRescue: false, documentPreservedBeforeRescue: true, liveMemory: 'current HR/CMS/CRM', savedSlots: { hr: 'seed target', cms: 'current; rollback succeeded', crm: 'current; unselected' }, history: 'attempted current HR/CMS point remains', rescue: '07-rescue-current-memory-BEFORE-RELOAD.json', statusCapture: uncertainCapture, faultEvents })
    checks.push('A real combined rescue download captures all current in-memory records before any reload and leaves the uncertain saved slots untouched')

    await page.evaluate(() => window.__recoveryDrillStorage.disarm())
    const recovery = await previewRestore(page, rescue.path, ['hr', 'cms'])
    await recovery.getByRole('button', { name: 'Restore selected workspaces', exact: true }).click()
    await expect(recovery).not.toBeVisible()
    const recovered = await saves(context, origin)
    for (const module of modules) assert.equal(recovered[key(module)], before[key(module)], `${module.toUpperCase()} recovery save must return to its exact pre-fault bytes`)
    const recoveredHistory = JSON.parse(recovered[historyKey])
    assert.equal(recoveredHistory.points.length, 2)
    checkPoint(recoveredHistory.points[0], current, ['hr', 'cms'])
    assert.deepEqual(recoveredHistory.points[1], attemptedHistory.points[0], 'Recovery preserves the earlier valid attempted capture without relabeling it as a successful restore')
    await verifyPortals(page, context, origin, artifactDir, '08-recovered-before-reload', current)
    await page.reload()
    await verifyPortals(page, context, origin, artifactDir, '09-recovered-after-reload', current)
    assert.deepEqual(await saves(context, origin), recovered)
    checks.push('Portable rescue recovery replaces only HR/CMS after storage is available; CRM raw bytes remain exact, all three independent exports and saved envelopes agree before and after reload')
    await close()

    await start('unavailable-storage', () => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Controlled recovery drill denied-storage platform', 'SecurityError') } })
    })
    await open(page, names.cms)
    await page.locator('#edit-title').fill('Memory-only recovery drill draft')
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Browser save needs attention\. CMS changes are only in memory/ })).toHaveText('Browser save needs attention. CMS changes are only in memory because this browser could not save them. Refresh may lose changes. Allow browser storage and try another saved action, or Reset to clear this portal\'s save.')
    const unavailableCapture = await captureStatusScene(page, artifactDir, '10-unavailable-save-guidance', page.getByRole('status').filter({ hasText: /^Browser save needs attention\. CMS changes are only in memory/ }))
    const memory = expectedCms(seed.workspaces, 'Memory-only recovery drill draft')
    await exportAll(page, artifactDir, '10-unavailable-memory-BEFORE-RELOAD', memory)
    assert.equal((await saves(context, origin))[key('cms')], undefined)
    await page.reload()
    await exportAll(page, artifactDir, '11-unavailable-after-reload-seed', seed.workspaces)
    assert.ok(Object.keys(await saves(context, origin)).every(name => !name.startsWith('webappx.demo.')))
    observations.push({ case: 'unavailable-storage', injection: 'owned-context localStorage getter throws SecurityError', acceptedMemory: 'CMS revision 2; HR/CRM seed', savedWorkspaceSlots: 'absent', rescue: '10-unavailable-memory-BEFORE-RELOAD.json', afterReload: 'all three seeds; memory-only CMS change no longer present', statusCapture: unavailableCapture })
    checks.push('Controlled unavailable storage accepts a CMS action in memory with guidance and a real rescue export; no workspace save appears and refresh independently returns all three seeds')
    await close()

    await start('damaged-history')
    await createCurrent(page)
    const beforeDamage = await saves(context, origin)
    const damagedText = '{controlled fictional damaged restore-history bytes'
    await page.evaluate(({ name, value }) => localStorage.setItem(name, value), { name: historyKey, value: damagedText })
    await page.reload()
    await open(page, 'Portal directory')
    const historyRegion = page.getByRole('region', { name: 'Restore points', exact: true })
    await expect(historyRegion.getByRole('alert')).toContainText('Restore-point history is damaged or incompatible.')
    const damagedCapture = await captureStatusScene(page, artifactDir, '12-damaged-history-guidance', historyRegion)
    const preserved = await exportAll(page, artifactDir, '12-damaged-history-current-memory', current)
    const damagedSaves = { ...beforeDamage, [historyKey]: damagedText }
    assert.deepEqual(await saves(context, origin), damagedSaves)
    const blocked = await previewRestore(page, baseline.path, ['cms'])
    await expect(blocked.getByRole('button', { name: 'Restore selected workspaces', exact: true })).toBeDisabled()
    await expect(blocked).toContainText('Restore-point history is damaged or incompatible.')
    assert.deepEqual(await saves(context, origin), damagedSaves, 'Damaged history blocks restore before every write')
    await blocked.getByRole('button', { name: 'Cancel combined restore', exact: true }).click()
    checks.push('Damaged history is explicitly reported and blocks selected restore before writes while a real preservation export contains all current records')
    await historyRegion.getByRole('button', { name: 'Clear restore points', exact: true }).click()
    await expect(historyRegion.getByRole('region', { name: 'Clear restore points confirmation', exact: true })).toContainText('Cleared restore points cannot be recovered here.')
    assert.deepEqual(await saves(context, origin), damagedSaves, 'Opening the explicit clear confirmation must not clear damaged history')
    await historyRegion.getByRole('button', { name: 'Confirm clear restore points', exact: true }).click()
    await expect(historyRegion.getByText('No restore points yet. Create a named point above, or your next combined selective restore will create one automatically.', { exact: true })).toBeVisible()
    assert.deepEqual(await saves(context, origin), beforeDamage, 'Explicit clear discards only the unusable history bytes and preserves every current workspace save and preference')
    assert.equal(await readFile(preserved.path, 'utf8'), preserved.text, 'History clear must not change the preserved portable backup')
    await verifyPortals(page, context, origin, artifactDir, '13-after-history-discard', current)
    await page.reload()
    await verifyPortals(page, context, origin, artifactDir, '14-history-discard-after-reload', current)
    assert.deepEqual(await saves(context, origin), beforeDamage)
    observations.push({ case: 'damaged-history', injection: 'owned-context malformed history slot only, after real saved actions', beforeClear: 'three current workspace saves exact; unusable history blocks restore', afterExplicitClear: 'history absent; three workspace saves and portable download unchanged', interpretation: 'unusable history discarded; no history reconstruction or repair claimed', statusCapture: damagedCapture })
    checks.push('Damaged history blocks restore; preserve/export first, explicit confirmation discards only unusable history, and HR/CMS/CRM independently retain exact saves/exports after reload')
    await close()
    assert.deepEqual(problems, [], 'Recovery drill requires zero unexpected external/provider/backend requests, failed requests, console errors or uncaught browser exceptions')
    return { checks, warnings, observations }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true }) } catch { /* Preserve original failure. */ }
    error.smokeEvidence = { checks, problems, warnings, observations }
    throw error
  } finally {
    if (context) {
      if (traceName) try { await context.tracing.stop({ path: join(artifactDir, traceName) }) } catch { /* Keep primary failure/report. */ }
      await context.close()
    }
    await writeFile(join(artifactDir, 'recovery-drill-observations.json'), JSON.stringify({ schemaVersion: 1, scope: 'isolated synthetic storage platform faults; actual rendered actions and downloads', observations }, null, 2) + '\n')
  }
}
