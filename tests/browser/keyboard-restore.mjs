import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { expectedAfter } from './seed-contract.mjs'
import { loadMockModel } from './model-loader.mjs'

/** The runner owns the fresh browser context; this journey navigates initially. All input
 * within this journey uses keyboard traversal and native keyboard activation.
 * Native file-chooser setFiles is the only OS input exception; it follows an
 * actual keyboard activation and never writes directly to a browser file input.
 */
export async function runKeyboardRestore({ page, context, origin, artifactDir, seed, keyboard }) {
  const checks = []
  const section = page.getByRole('region', { name: 'Combined workspace backup', exact: true })
  const importButton = section.getByRole('button', { name: 'Import combined backup', exact: true })
  const exportButton = section.getByRole('button', { name: 'Export all workspaces', exact: true })
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  const previewHeading = preview.getByRole('heading', { name: 'Choose workspaces to restore', exact: true })
  const restoreButton = preview.getByRole('button', { name: 'Restore selected workspaces', exact: true })
  const historySection = page.getByRole('region', { name: 'Restore points', exact: true })
  const undoPreview = historySection.getByRole('region', { name: 'Undo preview', exact: true })
  const { createCombinedBackup, parseCombinedBackup } = await loadMockModel(new URL('../../src/portals/combined-backup.ts', import.meta.url))
  const { parseRestorePoints, RESTORE_POINTS_KEY } = await loadMockModel(new URL('../../src/portals/restore-points.ts', import.meta.url))

  async function activate(target, key = 'Enter', label = 'Restore workflow control') {
    await keyboard.focus(target, label)
    await keyboard.assertFocus(target, label)
    await page.keyboard.press(key)
  }
  async function browserSaves() {
    const storage = await context.storageState()
    assert.deepEqual(storage.cookies, [], 'Keyboard restores never create an account session')
    const own = storage.origins.find(item => item.origin === origin)
    return [...(own?.localStorage ?? [])].sort((left, right) => left.name.localeCompare(right.name))
  }
  async function savedPoints() {
    const raw = (await browserSaves()).find(item => item.name === RESTORE_POINTS_KEY)?.value
    return raw === undefined ? [] : parseRestorePoints(raw)
  }
  async function exported(label) {
    await keyboard.focus(exportButton, 'Export all workspaces')
    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await downloadPromise
    const destination = join(artifactDir, `keyboard-restore-${label}.json`)
    await download.saveAs(destination)
    assert.equal(await download.failure(), null)
    return parseCombinedBackup(await readFile(destination, 'utf8')).states
  }
  async function openImport(file) {
    await keyboard.focus(importButton, 'Import combined backup')
    const chooserPromise = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    await (await chooserPromise).setFiles(file)
    await keyboard.assertFocus(previewHeading, 'Selective restore preview heading')
    await expect(importButton).toHaveAttribute('aria-expanded', 'true')
    await expect(restoreButton).toBeDisabled()
    for (const portal of ['HR', 'CMS', 'CRM']) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${portal}(?:$| )`) })).not.toBeChecked()
  }
  async function select(portals) {
    for (const portal of portals) {
      const checkbox = preview.getByRole('checkbox', { name: new RegExp(`^Restore ${portal}(?:$| )`) })
      await activate(checkbox, 'Space', `Restore ${portal} checkbox`)
      await expect(checkbox).toBeChecked()
    }
    await expect(restoreButton).toBeEnabled()
  }
  async function applyImport() {
    await activate(restoreButton)
    await expect(preview).toBeHidden()
    await keyboard.assertFocus(importButton, 'Import opener after successful restore')
    await expect(importButton).toHaveAttribute('aria-expanded', 'false')
  }
  async function openUndo(opener) {
    await activate(opener)
    await keyboard.assertFocus(undoPreview.getByRole('heading', { name: 'Undo HR, CMS', exact: true }), 'Undo preview heading')
    await expect(opener).toHaveAttribute('aria-expanded', 'true')
    await expect(undoPreview.getByRole('button', { name: 'Confirm undo', exact: true })).toBeEnabled()
  }

  await page.goto(`${origin}/portals`)
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  assert.deepEqual(await exported('baseline'), seed.workspaces)
  const originalSaves = await browserSaves()
  assert.deepEqual(await savedPoints(), [])

  // The import file is made from reviewed synthetic records outside the browser.
  // Every portal differs, so unchecked CRM preservation is observable.
  const imported = expectedAfter(expectedAfter(expectedAfter(seed.workspaces, 'hr'), 'cms'), 'crm')
  const file = join(artifactDir, 'keyboard-selective-restore-input.json')
  await writeFile(file, createCombinedBackup(imported, seed.createdAt))
  await openImport(file)
  const hrCheckbox = preview.getByRole('checkbox', { name: /^Restore HR\b/ })
  const cmsCheckbox = preview.getByRole('checkbox', { name: /^Restore CMS\b/ })
  const crmCheckbox = preview.getByRole('checkbox', { name: /^Restore CRM\b/ })
  await activate(hrCheckbox, 'Space')
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(cmsCheckbox, 'CMS checkbox after forward Tab')
  await page.keyboard.press('Space')
  await expect(cmsCheckbox).toBeChecked()
  await page.keyboard.press('Shift+Tab')
  await keyboard.assertFocus(hrCheckbox, 'HR checkbox after reverse Tab')
  await expect(hrCheckbox).toBeChecked()
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(cmsCheckbox, 'CMS checkbox after returning forward')
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(crmCheckbox, 'Unchecked CRM checkbox in forward Tab order')
  await expect(crmCheckbox).not.toBeChecked()
  await expect(restoreButton).toBeEnabled()
  await expect(preview.getByText('HR, CMS will be replaced and saved after an automatic restore point is saved. Unchecked portals keep their current records. Restore replaces entire selected workspaces. A dirty CMS editor is retained for comparison with the restored draft; use Reload or Reapply to choose its text. Other selected unsaved forms and timers are cleared. It does not merge records.', { exact: true })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Cancel combined restore', exact: true })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Cancel combined restore', exact: true })).toBeEnabled()
  await activate(preview.getByRole('button', { name: 'Cancel combined restore', exact: true }))
  await expect(preview).toBeHidden()
  await keyboard.assertFocus(importButton, 'Import opener after canceled restore')
  assert.deepEqual(await browserSaves(), originalSaves, 'Canceling selective restore preserves every raw save and restore-point byte')
  assert.deepEqual(await exported('canceled-import'), seed.workspaces)
  checks.push('Keyboard import, Space selection, forward/reverse Tab and cancellation preserve complete records/history and return focus to Import')

  await openImport(file)
  await select(['HR', 'CMS'])
  await expect(crmCheckbox).not.toBeChecked()
  await applyImport()
  const restored = { hr: imported.hr, cms: imported.cms, crm: seed.workspaces.crm }
  assert.deepEqual(await exported('selected-hr-cms'), restored, 'Only selected HR/CMS are replaced; the deliberately different CRM in the file remains unapplied')
  const points = await savedPoints()
  assert.equal(points.length, 1)
  assert.match(points[0].id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
  assert.match(points[0].createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.deepEqual(points[0], { id: points[0].id, createdAt: points[0].createdAt, kind: 'restore', modules: ['hr', 'cms'], states: { hr: seed.workspaces.hr, cms: seed.workspaces.cms } })
  const originalPointId = points[0].id
  const firstUndo = historySection.getByRole('button', { name: /^Undo restore point / }).first()
  const undoLabel = await firstUndo.getAttribute('aria-label')
  assert.ok(undoLabel)
  const originalUndo = historySection.getByRole('button', { name: undoLabel, exact: true })
  checks.push('Keyboard selective restore saves a selected-only recovery point and exactly preserves unchecked CRM')

  const beforeCancelUndo = await browserSaves()
  await openUndo(originalUndo)
  await expect(undoPreview.getByText(`Recover the records captured at ${points[0].createdAt} (UTC), before selective restore. This replaces the entire HR, CMS workspaces, including later saved edits. A dirty CMS editor is retained for an explicit comparison decision before saving; other selected temporary forms and timers are cleared. Other portals keep their current records.`, { exact: true })).toBeVisible()
  await expect(undoPreview.getByText('A new restore point will save the affected portals before Undo is applied. Older points may be removed to keep history within its limit.', { exact: true })).toBeVisible()
  await expect(undoPreview.getByRole('button', { name: 'Cancel undo', exact: true })).toBeVisible()
  await expect(undoPreview.getByRole('button', { name: 'Cancel undo', exact: true })).toBeEnabled()
  await activate(undoPreview.getByRole('button', { name: 'Cancel undo', exact: true }))
  await expect(undoPreview).toBeHidden()
  await keyboard.assertFocus(originalUndo, 'Exact Undo opener after canceled Undo')
  await expect(originalUndo).toHaveAttribute('aria-expanded', 'false')
  assert.deepEqual(await browserSaves(), beforeCancelUndo, 'Cancel Undo preserves all workspace and recovery-history bytes')
  assert.deepEqual(await exported('canceled-undo'), restored)
  checks.push('Keyboard Undo preview/cancellation returns to its exact opener and preserves complete records/history')

  const beforeCancelClear = await browserSaves()
  assert.deepEqual(await savedPoints(), points, 'The clear-history scenario starts from the complete independently checked selected-only capture')
  const clearOpener = historySection.getByRole('button', { name: 'Clear restore points', exact: true })
  const clearPreview = historySection.getByRole('region', { name: 'Clear restore points confirmation', exact: true })
  const clearConfirm = clearPreview.getByRole('button', { name: 'Confirm clear restore points', exact: true })
  const keepPoints = clearPreview.getByRole('button', { name: 'Keep restore points', exact: true })
  await activate(clearOpener)
  await expect(clearOpener).toHaveAttribute('aria-expanded', 'true')
  await keyboard.assertFocus(clearPreview.getByRole('heading', { name: 'Clear all restore points?', exact: true }), 'Clear-history preview heading')
  await expect(clearPreview.getByText('This removes only the restore history at this browser address. HR, CMS and CRM workspaces and downloaded backups are preserved. Cleared restore points cannot be recovered here.', { exact: true })).toBeVisible()
  await expect(clearConfirm).toBeVisible(); await expect(clearConfirm).toBeEnabled()
  await expect(keepPoints).toBeVisible(); await expect(keepPoints).toBeEnabled()
  assert.deepEqual(await browserSaves(), beforeCancelClear, 'Opening the destructive history preview writes no workspace, history or preference byte')
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(clearConfirm, 'Confirm clear after forward Tab from its heading')
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(keepPoints, 'Keep restore points after forward Tab')
  await page.keyboard.press('Shift+Tab')
  await keyboard.assertFocus(clearConfirm, 'Confirm clear after reverse Tab')
  await page.keyboard.press('Tab')
  await keyboard.assertFocus(keepPoints, 'Keep restore points after returning forward')
  await clearPreview.screenshot({ path: join(artifactDir, 'keyboard-clear-history-preview.png') })
  await page.keyboard.press('Enter')
  await expect(clearPreview).toBeHidden()
  await expect(clearOpener).toHaveAttribute('aria-expanded', 'false')
  await keyboard.assertFocus(clearOpener, 'Exact Clear restore points opener after Keep')
  assert.deepEqual(await browserSaves(), beforeCancelClear, 'Keep restore points preserves every raw workspace, history and preference byte')
  assert.deepEqual(await savedPoints(), points, 'Keep restore points preserves every captured field, scope, identity, timestamp and history position')
  await page.screenshot({ path: join(artifactDir, 'keyboard-clear-history-canceled.png'), fullPage: true })
  assert.deepEqual(await exported('canceled-history-clear'), restored, 'Canceling history deletion preserves the complete independently expected HR/CMS records and unchecked CRM')
  assert.deepEqual(await browserSaves(), beforeCancelClear, 'The independent post-cancel download must also preserve every raw slot')
  checks.push('WX-0708/WX-0717: native selective restore, Undo and clear-history previews expose exact scope/effect/cancel; keyboard history Keep survives forward/reverse Tab, returns to its exact Clear opener and preserves complete exported records plus every raw history/workspace/preference byte')

  await openUndo(originalUndo)
  await activate(undoPreview.getByRole('button', { name: 'Confirm undo', exact: true }))
  await expect(undoPreview).toBeHidden()
  await keyboard.assertFocus(originalUndo, 'Exact Undo opener after successful Undo')
  assert.deepEqual(await exported('undo-complete'), seed.workspaces)
  const afterUndo = await savedPoints()
  assert.equal(afterUndo.length, 2)
  assert.equal(afterUndo[0].kind, 'undo')
  assert.equal(afterUndo[0].sourcePointId, originalPointId)
  assert.deepEqual(afterUndo[0].states, { hr: imported.hr, cms: imported.cms })
  checks.push('Keyboard Confirm Undo restores the complete expected records, saves a reversible point and returns to the exact Undo opener')

  // Fill the bounded history, then undo its oldest point. The source opener is
  // pruned by that same transaction, requiring a meaningful focus fallback.
  for (let index = 0; index < 3; index += 1) {
    await openImport(file)
    await select(['HR'])
    await applyImport()
  }
  assert.equal((await savedPoints()).length, 5)
  await openUndo(originalUndo)
  await activate(undoPreview.getByRole('button', { name: 'Confirm undo', exact: true }))
  await expect(undoPreview).toBeHidden()
  await expect(originalUndo).toHaveCount(0)
  await keyboard.assertFocus(historySection.getByRole('heading', { name: 'Restore points & Undo', exact: true }), 'History heading after retained history removes the Undo opener')
  const retained = await savedPoints()
  assert.equal(retained.length, 5)
  assert.equal(retained.some(point => point.id === originalPointId), false)
  assert.equal(retained[0].sourcePointId, originalPointId)
  await page.screenshot({ path: join(artifactDir, 'keyboard-restore-focus-fallback.png'), fullPage: true })
  assert.deepEqual(await exported('retention-undo'), seed.workspaces)
  const finalSaves = await browserSaves()
  assert.equal(finalSaves.find(item => item.name === 'webappx.demo.crm')?.value, originalSaves.find(item => item.name === 'webappx.demo.crm')?.value, 'Unchecked CRM raw save is preserved through restore, Undo and retention')
  assert.equal(finalSaves.find(item => item.name === 'sfwa-wtl:accessibility-preferences')?.value, originalSaves.find(item => item.name === 'sfwa-wtl:accessibility-preferences')?.value)
  checks.push('Keyboard Undo that prunes its oldest source point focuses the meaningful history heading and preserves complete unselected data')
  await page.reload() // Persistence lifecycle observation, after the keyboard journey.
  await expect(historySection.getByRole('heading', { name: 'Restore points & Undo', exact: true })).toBeVisible()
  assert.deepEqual(await browserSaves(), finalSaves, 'Refresh preserves every saved workspace and retained recovery-point byte')
  assert.deepEqual(await savedPoints(), retained)
  assert.deepEqual(await exported('after-refresh'), seed.workspaces)
  checks.push('Keyboard restore and retained Undo history survive refresh with exact saved bytes and complete exported records')
  return { checks, baselineHash: seed.sha256, retainedPoints: retained.length, selectedPortals: ['hr', 'cms'] }
}
