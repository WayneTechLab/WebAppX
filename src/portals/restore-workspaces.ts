import { portalIds, portalById } from './registry'
import { DEMO_STORAGE_LIMIT, DEMO_STORAGE_VERSION, demoStorageKey, type DemoModule, type DemoStorage, type DemoStorageStatus } from './persistence'
import { isDemoWorkspaces, type DemoWorkspaces } from './workspaces'
import { parseRestorePoints, RESTORE_POINTS_KEY, validRestoreSelection, type RestorePoint, type RestorePointOptions } from './restore-points'
import { prepareCheckpointRestore } from './restore-budget'

export type DemoWorkspacesRestoreResult =
  | { ok: true; status: DemoStorageStatus }
  | { ok: false; status: DemoStorageStatus; recoveryRequired?: boolean }

export type CheckpointRestoreResult =
  | { ok: true; status: DemoStorageStatus; point: RestorePoint; points: RestorePoint[]; states: DemoWorkspaces; modules: DemoModule[] }
  | { ok: false; status: DemoStorageStatus; recoveryRequired?: boolean }

const unchanged = 'The previous in-memory workspaces and browser saves are preserved.'

function storageForRestore(storage?: DemoStorage | null): DemoStorage {
  const result = storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage
  if (!result) throw new Error('Browser storage unavailable')
  return result
}

/** Save a validated selective restore before the caller replaces any live state.
 * localStorage has no multi-key transaction. Snapshot all selected raw saves,
 * prepare every selected envelope, then write synchronously. If a write throws,
 * restore every attempted key, including the key whose write threw. A failed
 * rollback is reported explicitly; callers must keep their current live state.
 */
export function restoreDemoWorkspaces(states: DemoWorkspaces, selected: readonly DemoModule[], storage?: DemoStorage | null): DemoWorkspacesRestoreResult {
  try {
    if (!Array.isArray(selected) || selected.length === 0 || selected.length > portalIds.length || selected.some(module => !portalIds.includes(module)) || new Set(selected).size !== selected.length || !isDemoWorkspaces(states)) throw new Error('Invalid restore')
  } catch {
    return { ok: false, status: { kind: 'recovered', message: `Restore was not applied because the backup or workspace selection is invalid or incompatible. ${unchanged}` } }
  }
  const chosen: readonly DemoModule[] = selected

  let prepared: { module: DemoModule; key: string; raw: string }[]
  try {
    prepared = chosen.map(module => {
      const raw = JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: states[module] })
      if (raw.length > DEMO_STORAGE_LIMIT) throw new Error('Oversized save')
      // Recheck the serialized data so a serialization substitution cannot save
      // a graph different from the one that passed validation above.
      const saved: unknown = JSON.parse(raw)
      if (!saved || typeof saved !== 'object' || !isDemoWorkspaces({ ...states, [module]: (saved as { data: unknown }).data })) throw new Error('Invalid serialized save')
      return { module, key: demoStorageKey(module), raw }
    })
  } catch {
    return { ok: false, status: { kind: 'recovered', message: `Restore was not applied because a selected workspace could not fit or be serialized as a valid browser save. ${unchanged}` } }
  }

  let target: DemoStorage
  const previous = new Map<string, string | null>()
  try {
    target = storageForRestore(storage)
    for (const item of prepared) previous.set(item.key, target.getItem(item.key))
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not read the current saves. ${unchanged} Allow browser storage, then try again.` } }
  }

  const attempted: typeof prepared = []
  try {
    for (const item of prepared) {
      attempted.push(item)
      target.setItem(item.key, item.raw)
    }
  } catch {
    const uncertain: DemoModule[] = []
    for (const item of [...attempted].reverse()) {
      try {
        const raw = previous.get(item.key)
        if (raw === null) target.removeItem(item.key)
        else target.setItem(item.key, raw as string)
      } catch { uncertain.push(item.module) }
    }
    if (uncertain.length) return {
      ok: false,
      recoveryRequired: true,
      status: {
        kind: 'unavailable',
        message: `Restore failed and this browser could not roll back the ${uncertain.map(module => portalById[module].label).join(', ')} save${uncertain.length === 1 ? '' : 's'}. Those browser saves may differ from the previous in-memory workspaces, which remain open. Unselected workspaces and unrelated browser data were not changed. Keep this tab open and export the current workspaces before refreshing. Allow browser storage or free space, then restore again to recover the selected saves.`,
      },
    }
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not save every selected workspace. ${unchanged} Allow browser storage or free space, then try again.` } }
  }

  return { ok: true, status: { kind: 'saved', message: `${chosen.map(module => portalById[module].label).join(', ')} workspace${chosen.length === 1 ? '' : 's'} restored and saved in this browser. Unselected workspaces and unrelated browser data are unchanged.` } }
}

/** Selective restore and undo both commit a recovery snapshot first. All raw
 * selected slots and history are read before any writes. The complete sequence
 * is synchronous; on failure we attempt to recover every attempted slot,
 * including a storage implementation that changed a key before throwing.
 */
function checkpointRestore(current: DemoWorkspaces, targetStates: DemoWorkspaces | undefined, selected: readonly DemoModule[] | undefined, storage: DemoStorage | null | undefined, options: RestorePointOptions, sourcePointId?: string): CheckpointRestoreResult {
  let target: DemoStorage
  try {
    if (!isDemoWorkspaces(current) || (sourcePointId === undefined && (!isDemoWorkspaces(targetStates) || !validRestoreSelection(selected)))) throw new Error('Invalid workspaces')
  } catch {
    return { ok: false, status: { kind: 'recovered', message: `Restore was not applied because the current workspaces, backup or selection are invalid or incompatible. ${unchanged}` } }
  }
  let previousHistory: string | null
  try {
    target = storageForRestore(storage)
    previousHistory = target.getItem(RESTORE_POINTS_KEY)
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not read restore-point history. ${unchanged} Allow browser storage, then try again.` } }
  }

  let point: RestorePoint
  let points: RestorePoint[]
  let states: DemoWorkspaces
  let chosen: DemoModule[]
  let prepared: { key: string; raw: string; label: string }[]
  try {
    const history = previousHistory === null ? [] : parseRestorePoints(previousHistory)
    const result = prepareCheckpointRestore(current, targetStates, selected, history, { ...options, sourcePointId })
    if (!result.ok) throw new Error(result.message)
    if (!result.plan.budget.canRestore) throw new Error(result.plan.budget.reason)
    point = result.plan.point
    points = result.plan.points
    states = result.plan.states
    chosen = result.plan.modules
    prepared = result.plan.prepared
  } catch (error) {
    return { ok: false, status: { kind: 'recovered', message: `Restore was not applied. ${error instanceof Error ? error.message : 'The restore point could not be prepared.'} ${unchanged}` } }
  }

  const previous = new Map<string, string | null>([[RESTORE_POINTS_KEY, previousHistory]])
  try {
    for (const item of prepared.slice(1)) previous.set(item.key, target.getItem(item.key))
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not read the current saves. ${unchanged} Restore-point history is unchanged. Allow browser storage, then try again.` } }
  }
  const attempted: typeof prepared = []
  try {
    for (const item of prepared) {
      attempted.push(item)
      target.setItem(item.key, item.raw)
    }
  } catch {
    const uncertain: string[] = []
    for (const item of [...attempted].reverse()) {
      try {
        const raw = previous.get(item.key)
        if (raw === null) target.removeItem(item.key)
        else target.setItem(item.key, raw as string)
      } catch { uncertain.push(item.label) }
    }
    if (uncertain.length) return {
      ok: false,
      recoveryRequired: true,
      status: { kind: 'unavailable', message: `Restore failed and this browser could not roll back: ${uncertain.join(', ')}. Those browser slots may differ from their previous values. The current in-memory workspaces remain open. Keep this tab open and export the current workspaces before refreshing. Allow browser storage or free space, then recover the selected saves. Unselected workspace saves and unrelated browser data were not changed.` },
    }
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not save the automatic restore point and every selected workspace. ${unchanged} Restore-point history is unchanged. Allow browser storage or free space, then try again.` } }
  }
  return {
    ok: true, point, points, states, modules: chosen,
    status: { kind: 'saved', message: `${chosen.map(module => portalById[module].label).join(', ')} workspace${chosen.length === 1 ? '' : 's'} ${sourcePointId === undefined ? 'restored' : 'recovered from the restore point'} and saved in this browser. An automatic restore point was saved first. Unselected workspaces and unrelated browser data are unchanged.` },
  }
}

export function restoreWithCheckpoint(currentStates: DemoWorkspaces, targetStates: DemoWorkspaces, selected: readonly DemoModule[], storage?: DemoStorage | null, options: RestorePointOptions = {}): CheckpointRestoreResult {
  return checkpointRestore(currentStates, targetStates, selected, storage, options)
}

/** Reapply exactly the portal scope in a saved point, recording a pre-undo
 * point first so the same workflow can undo an undo without special redo state.
 */
export function undoRestorePoint(currentStates: DemoWorkspaces, pointId: string, storage?: DemoStorage | null, options: RestorePointOptions = {}): CheckpointRestoreResult {
  if (typeof pointId !== 'string' || !pointId) return { ok: false, status: { kind: 'recovered', message: `Choose an existing restore point before undoing. ${unchanged}` } }
  return checkpointRestore(currentStates, undefined, undefined, storage, options, pointId)
}
