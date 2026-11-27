import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const root = new URL('../../src/portals/', import.meta.url)
const presentation = await loadMockModel(new URL('storage-presentation.ts', root))
const { workspaceSaveSummary } = await loadMockModel(new URL('save-summary.ts', root))
const persistence = await loadMockModel(new URL('persistence.ts', root))
const { createMemoryDemoStorage } = await loadMockModel(new URL('portal-runtime.ts', root))
const { replaceDemoState } = await loadMockModel(new URL('import-state.ts', root))
const preferences = await loadMockModel(new URL('recovery-preferences.ts', root))
const history = await loadMockModel(new URL('restore-points.ts', root))
const { createDemoWorkspaces } = await loadMockModel(new URL('workspaces.ts', root))
const { restoreDemoWorkspaces, restoreWithCheckpoint, undoRestorePoint } = await loadMockModel(new URL('restore-workspaces.ts', root))
const { previewWorkspaceReplacement, replaceWorkspaceWithRecovery } = await loadMockModel(new URL('replacement-recovery.ts', root))
const { storagePresentationMessage: message, storageNoticePresentation: notice } = presentation
const boundary = 'Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.'
const timestamp = '2026-10-15T06:00:00.000Z'
const options = id => ({ id, createdAt: timestamp })
const validate = value => value?.record === 1
const seed = () => ({ record: 1 })

function actualStatuses() {
  const storage = createMemoryDemoStorage()
  const ready = persistence.loadDemoState('hr', seed, validate, storage).status
  const saved = persistence.saveDemoState('hr', seed(), storage)
  const restored = persistence.loadDemoState('hr', seed, validate, storage).status
  const reset = persistence.clearDemoState('hr', storage)
  const unavailable = persistence.saveDemoState('hr', seed(), null)
  const failedReset = persistence.clearDemoState('hr', null)
  storage.setItem(persistence.demoStorageKey('hr'), 'damaged')
  const recovered = persistence.loadDemoState('hr', seed, validate, storage).status
  return [ready, saved, restored, reset, unavailable, failedReset, recovered]
}

test('real persistence notices and default directory summaries preserve exact browser wording', () => {
  const expected = [
    ['ready', 'Ready', "HR is ready. Saved actions stay in this browser across refresh. Reset removes only this portal's saved sample."],
    ['saved', 'Saved', "HR sample saved in this browser. It will be restored after refresh. Reset removes only this portal's saved sample."],
    ['saved', 'Saved', "HR sample restored from this browser. Saved actions survive refresh; Reset removes only this portal's saved sample."],
    ['ready', 'Ready', "HR saved sample removed and original fictional records restored. The other portals' saves are unchanged."],
    ['unavailable', 'Unavailable', "HR changes are only in memory because this browser could not save them. Refresh may lose changes. Allow browser storage and try another saved action, or Reset to clear this portal's save."],
    ['unavailable', 'Unavailable', 'HR reset in memory, but this browser could not remove its previous save. It may return after refresh. Allow browser storage and Reset again to remove it.'],
    ['recovered', 'Recovered', 'HR could not restore an incompatible or damaged save. Fresh fictional records are open. Reset removes the old save; your next saved action replaces it.'],
  ]
  const statuses = actualStatuses()
  for (const [index, status] of statuses.entries()) {
    const [kind, label, text] = expected[index]
    assert.equal(status.message, text)
    assert.equal(message(text), text)
    assert.equal(message(text, 'browser'), text)
    assert.deepEqual(workspaceSaveSummary(status), { kind, label, message: text })
    assert.deepEqual(workspaceSaveSummary(status, 'browser'), { kind, label, message: text })
    assert.deepEqual(notice(status), {
      warning: ['unavailable', 'recovered'].includes(status.kind),
      heading: ['unavailable', 'recovered'].includes(status.kind) ? 'Browser save needs attention. ' : 'Browser save. ',
      message: text,
    })
  }
})

test('walkthrough save/load/reset summaries retain status semantics without claiming refresh persistence', () => {
  const statuses = actualStatuses()
  const before = JSON.stringify(statuses)
  const expectedLabels = ['Ready in memory', 'Memory only', 'Memory only', 'Ready in memory', 'Memory unavailable', 'Memory unavailable', 'Review memory']
  const expectedOpening = [
    'HR is ready. Actions stay only in walkthrough memory.',
    'HR sample saved in walkthrough memory. It stays only in walkthrough memory.',
    'HR sample restored from walkthrough memory. Actions stay only in walkthrough memory;',
    'HR walkthrough memory sample removed and original fictional records restored.',
    'HR changes are only in memory because the walkthrough memory store could not save them. Refresh discards walkthrough changes.',
    'HR reset in memory, but the walkthrough memory store could not remove its previous save. The previous walkthrough save does not survive refresh.',
    'HR could not restore an incompatible or damaged save. Fresh fictional records are open.',
  ]
  for (const [index, status] of statuses.entries()) {
    const summary = workspaceSaveSummary(status, 'walkthrough')
    assert.equal(summary.label, expectedLabels[index])
    assert.ok(summary.message.startsWith(expectedOpening[index]), summary.message)
    assert.ok(summary.message.endsWith(boundary))
    assert.doesNotMatch(summary.message, /Saved actions survive refresh|stay in this browser across refresh|will be restored after refresh|Allow browser storage/)
    assert.equal(summary.kind, workspaceSaveSummary(status).kind)
    assert.equal(notice(status, 'walkthrough').warning, notice(status).warning)
    assert.equal(message(summary.message, 'walkthrough'), summary.message, 'presentation is idempotent')
  }
  assert.equal(JSON.stringify(statuses), before)
})

test('actual imports and required checkpoint settings retain success/refusal details in walkthrough memory', () => {
  const storage = createMemoryDemoStorage()
  const imported = replaceDemoState('cms', seed(), validate, storage)
  assert.equal(imported.ok, true)
  assert.equal(message(imported.status.message, 'walkthrough'), `CMS workspace imported and saved in walkthrough memory. It stays only in walkthrough memory. The other portals' workspaces are unchanged. ${boundary}`)
  const refused = replaceDemoState('cms', seed(), validate, null)
  assert.equal(refused.ok, false)
  assert.equal(message(refused.status.message, 'walkthrough'), `CMS import was not applied because the walkthrough memory store could not save it. Your previous workspace and walkthrough memory save are preserved. Review walkthrough memory storage or reduce the snapshot size, then try again. ${boundary}`)
  const invalid = replaceDemoState('cms', { record: 2 }, validate, storage)
  assert.equal(invalid.ok, false)
  assert.ok(message(invalid.status.message, 'walkthrough').startsWith('CMS import was not applied because the workspace is invalid or incompatible.'))
  const settings = preferences.saveRecoveryPreferences({ beforeImport: true, beforeReset: true }, storage)
  assert.equal(settings.ok, true)
  assert.equal(message(settings.status.message, 'walkthrough'), `Checkpoint settings saved for this walkthrough session. Workspace saves and restore-point history are unchanged. ${boundary}`)
  const states = createDemoWorkspaces()
  const preview = previewWorkspaceReplacement('hr', states, states.hr, 'import', preferences.loadRecoveryPreferences(storage), history.loadRestorePoints(storage))
  assert.equal(preview.ok, true)
  assert.equal(preview.required, true)
  assert.equal(message(preview.message, 'walkthrough'), `A required HR-only checkpoint will save the current complete records before import. ${boundary}`)
  const replaced = replaceWorkspaceWithRecovery('hr', states, states.hr, 'import', storage, options('required-import'), preview.confirmation)
  assert.equal(replaced.ok, true)
  assert.equal(message(replaced.status.message, 'walkthrough'), `HR workspace imported and saved in walkthrough memory. A required HR-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged. ${boundary}`)
  const resetPreview = previewWorkspaceReplacement('hr', states, states.hr, 'reset', preferences.loadRecoveryPreferences(storage), history.loadRestorePoints(storage))
  assert.equal(resetPreview.canReplace, true)
  const reset = replaceWorkspaceWithRecovery('hr', states, states.hr, 'reset', storage, options('required-reset'), resetPreview.confirmation)
  assert.equal(reset.ok, true)
  assert.equal(reset.status.kind, 'reset')
  assert.equal(message(reset.status.message, 'walkthrough'), `HR original fictional records restored and walkthrough memory save removed. A required HR-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged. ${boundary}`)
})

test('actual named points, history-only rename, selected restore, Undo and clear describe memory scope', () => {
  const storage = createMemoryDemoStorage()
  const states = createDemoWorkspaces()
  const point = history.createManualRestorePoint(states, ['cms'], 'browser save 名称', storage, options('manual'))
  assert.equal(point.ok, true)
  assert.equal(message(point.status.message, 'walkthrough'), `Named restore point saved in walkthrough memory. Current workspaces and walkthrough memory saves are unchanged. ${boundary}`)
  const renamed = history.renameRestorePoint('manual', 'Saved actions survive refresh; literal label', storage)
  assert.equal(renamed.ok, true)
  assert.equal(message(renamed.status.message, 'walkthrough'), `Restore-point label saved. Its captured records, scope and creation time are unchanged. Current workspaces and walkthrough memory saves are unchanged. ${boundary}`)
  assert.equal(renamed.point.label, 'Saved actions survive refresh; literal label')
  assert.equal(message(history.loadRestorePoints(storage).status, 'walkthrough'), `1 restore point saved in walkthrough memory. ${boundary}`)
  const target = structuredClone(states)
  target.cms.entries[1].title = 'Changed fictional CMS draft'
  const restored = restoreWithCheckpoint(states, target, ['cms'], storage, options('before-restore'))
  assert.equal(restored.ok, true)
  assert.equal(message(restored.status.message, 'walkthrough'), `CMS workspace restored and saved in walkthrough memory. An automatic restore point was saved first. Unselected workspaces and unrelated browser data are unchanged. ${boundary}`)
  const undone = undoRestorePoint(restored.states, 'before-restore', storage, options('before-undo'))
  assert.equal(undone.ok, true)
  assert.equal(message(undone.status.message, 'walkthrough'), `CMS workspace recovered from the restore point and saved in walkthrough memory. An automatic restore point was saved first. Unselected workspaces and unrelated browser data are unchanged. ${boundary}`)
  const all = restoreWithCheckpoint(undone.states, target, ['hr', 'cms', 'crm'], storage, options('all-portals'))
  assert.equal(all.ok, true)
  assert.equal(message(all.status.message, 'walkthrough'), `HR, CMS, CRM workspaces restored and saved in walkthrough memory. An automatic restore point was saved first. Unselected workspaces and unrelated browser data are unchanged. ${boundary}`)
  const cleared = history.clearRestorePoints(storage)
  assert.equal(cleared.ok, true)
  assert.equal(message(cleared.status, 'walkthrough'), `Restore points cleared. HR, CMS and CRM workspace saves are unchanged. ${boundary}`)
})

test('actual rollback uncertainty keeps affected slots, live-memory warning and export-before-refresh guidance', () => {
  const underlying = createMemoryDemoStorage()
  const failing = {
    getItem: key => underlying.getItem(key),
    setItem(key, value) { underlying.setItem(key, value); throw new Error('controlled history fault') },
    removeItem() { throw new Error('controlled rollback fault') },
  }
  const current = createDemoWorkspaces()
  const target = structuredClone(current)
  target.cms.entries[1].title = 'Fictional changed target'
  const result = restoreWithCheckpoint(current, target, ['cms'], failing, options('uncertain'))
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  const before = JSON.stringify(result)
  const presented = message(result.status.message, 'walkthrough')
  assert.match(presented, /^Restore failed and the walkthrough memory store could not roll back: restore-point history\./)
  assert.match(presented, /Those walkthrough memory slots may differ from their previous values/)
  assert.match(presented, /The current in-memory workspaces remain open/)
  assert.match(presented, /Keep this tab open and export the current workspaces before refreshing/)
  assert.ok(presented.endsWith(boundary))
  assert.doesNotMatch(presented, /Restore succeeded|saved in this browser|Allow browser storage/)
  assert.equal(JSON.stringify(result), before)
})

test('actual required import and Reset rollback faults present producer browser-save slots as walkthrough memory', () => {
  for (const [module, label, operation, historyUncertain, expectedSlots] of [
    ['cms', 'CMS', 'import', false, 'CMS browser save'],
    ['hr', 'HR', 'reset', true, 'HR browser save and restore-point history'],
  ]) {
    const underlying = createMemoryDemoStorage()
    const current = createDemoWorkspaces()
    const incoming = structuredClone(current[module])
    if (module === 'cms') incoming.entries[1].title = 'Fictional imported draft; browser save remains literal record text'
    assert.equal(persistence.saveDemoState(module, current[module], underlying).kind, 'saved')
    assert.equal(preferences.saveRecoveryPreferences({ beforeImport: true, beforeReset: true }, underlying).ok, true)
    const workspaceKey = persistence.demoStorageKey(module)
    const before = JSON.stringify({ current, incoming })
    const previousSave = underlying.getItem(workspaceKey)
    const preview = previewWorkspaceReplacement(module, current, incoming, operation, preferences.loadRecoveryPreferences(underlying), history.loadRestorePoints(underlying))
    assert.equal(preview.ok, true)
    assert.equal(preview.required, true)
    let workspaceAttempted = false
    const attempted = []
    const storage = {
      getItem: key => underlying.getItem(key),
      setItem(key, value) {
        attempted.push(['set', key])
        if (key === workspaceKey) {
          if (!workspaceAttempted) {
            workspaceAttempted = true
            underlying.setItem(key, value)
          }
          throw new Error('controlled replacement workspace write/rollback fault')
        }
        underlying.setItem(key, value)
      },
      removeItem(key) {
        attempted.push(['remove', key])
        if (key === workspaceKey) {
          if (!workspaceAttempted) {
            workspaceAttempted = true
            underlying.removeItem(key)
          }
          throw new Error('controlled Reset workspace removal/rollback fault')
        }
        if (historyUncertain && key === history.RESTORE_POINTS_KEY) throw new Error('controlled history rollback fault')
        underlying.removeItem(key)
      },
    }
    const result = replaceWorkspaceWithRecovery(module, current, incoming, operation, storage, options(`uncertain-${operation}`), preview.confirmation)
    assert.equal(result.ok, false)
    assert.equal(result.checkpointRequired, true)
    assert.equal(result.recoveryRequired, true)
    assert.equal(result.status.kind, 'unavailable')
    const actualMessage = result.status.message
    assert.equal(actualMessage, `Replacement failed and rollback could not be confirmed for ${expectedSlots}. Those browser slots may differ. The current in-memory workspace remains open; no replacement was accepted. Keep this page open and export current workspaces before refreshing, then recover storage access and review history/saves. Other workspace saves and unrelated browser data were not written.`)
    assert.equal(message(actualMessage), actualMessage)
    const expectedMemorySlots = operation === 'import' ? 'CMS walkthrough memory save' : 'HR walkthrough memory save and restore-point history'
    assert.equal(message(actualMessage, 'walkthrough'), `Replacement failed and rollback could not be confirmed for ${expectedMemorySlots}. Those walkthrough memory slots may differ. The current in-memory workspace remains open; no replacement was accepted. Keep this page open and export current workspaces before refreshing, then recover storage access and review history/saves. Other workspace saves and unrelated browser data were not written. ${boundary}`)
    assert.equal(JSON.stringify({ current, incoming }), before, 'failed replacement preserves the actual live state and supplied target')
    assert.notEqual(underlying.getItem(workspaceKey), previousSave, 'fault really left the selected memory slot changed')
    assert.equal(underlying.getItem(history.RESTORE_POINTS_KEY) === null, !historyUncertain)
    assert.deepEqual(attempted, [
      ['set', history.RESTORE_POINTS_KEY],
      [operation === 'import' ? 'set' : 'remove', workspaceKey],
      ['set', workspaceKey],
      ['remove', history.RESTORE_POINTS_KEY],
    ], label)
    assert.equal(message(`${actualMessage} User label: browser save 名称`, 'walkthrough'), `${actualMessage} User label: browser save 名称`, 'a prefix-sharing unknown message does not enter the finite template')
  }
})

test('actual non-checkpoint selective restore rollback producer uses its distinct portal-list grammar', () => {
  const underlying = createMemoryDemoStorage()
  const states = createDemoWorkspaces()
  const storage = {
    getItem: key => underlying.getItem(key),
    setItem(key, value) { underlying.setItem(key, value); throw new Error('controlled workspace write fault') },
    removeItem() { throw new Error('controlled workspace rollback fault') },
  }
  const result = restoreDemoWorkspaces(states, ['crm'], storage)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /^Restore failed and this browser could not roll back the CRM save\./)
  const presented = message(result.status.message, 'walkthrough')
  assert.match(presented, /^Restore failed and the walkthrough memory store could not roll back the CRM save\./)
  assert.match(presented, /Those walkthrough memory saves may differ from the previous in-memory workspaces, which remain open/)
  assert.match(presented, /Keep this tab open and export the current workspaces before refreshing/)
  assert.ok(presented.endsWith(boundary))
  assert.equal(message(result.status.message), result.status.message)
})

test('labels, Unicode filenames, unknown errors and domain text are never rewritten', () => {
  for (const literal of [
    'Saved actions survive refresh; literal record title',
    '名称 browser save — Saved actions survive refresh;.json',
    'The candidate could not be hired: browser save is a fictional supplied reason.',
    'The restore-point label exceeds its limit. Shorten the label before retrying.',
    '"HR sample saved in this browser." is the filename; parsing failed.',
    'HR sample saved in this browser. Note: browser save is a user-supplied title.',
    'Recovery settings are a record title; saved in this browser is literal user text.',
    'This browser could not parse the filename "browser save 名称".',
  ]) assert.equal(message(literal, 'walkthrough'), literal)
})

test('presenter evaluates without runtime dependencies or any browser storage access', async () => {
  const source = await readFile(new URL('storage-presentation.ts', root), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  assert.doesNotMatch(compiled, /require\(|import\(|import\.meta/)
  const exports = {}
  const context = { exports }
  for (const key of ['window', 'document', 'localStorage', 'sessionStorage']) Object.defineProperty(context, key, { get() { throw new Error(`unexpected ${key} access`) } })
  runInNewContext(compiled, context, { timeout: 1000 })
  assert.equal(exports.storagePresentationMessage("HR sample saved in this browser. It will be restored after refresh. Reset removes only this portal's saved sample.", 'walkthrough'), `HR sample saved in walkthrough memory. It stays only in walkthrough memory. Reset clears only this portal's walkthrough sample. ${boundary}`)
})
