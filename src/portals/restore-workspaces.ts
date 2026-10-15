import { DEMO_STORAGE_LIMIT, DEMO_STORAGE_VERSION, demoStorageKey, type DemoModule, type DemoStorage, type DemoStorageStatus } from './persistence'
import { isDemoWorkspaces, type DemoWorkspaces } from './workspaces'

export type DemoWorkspacesRestoreResult =
  | { ok: true; status: DemoStorageStatus }
  | { ok: false; status: DemoStorageStatus; recoveryRequired?: boolean }

const modules: DemoModule[] = ['hr', 'cms', 'crm']
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
    if (!Array.isArray(selected) || selected.length === 0 || selected.length > modules.length || selected.some(module => !modules.includes(module)) || new Set(selected).size !== selected.length || !isDemoWorkspaces(states)) throw new Error('Invalid restore')
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
        message: `Restore failed and this browser could not roll back the ${uncertain.map(module => module.toUpperCase()).join(', ')} save${uncertain.length === 1 ? '' : 's'}. Those browser saves may differ from the previous in-memory workspaces, which remain open. Unselected workspaces and unrelated browser data were not changed. Keep this tab open and export the current workspaces before refreshing. Allow browser storage or free space, then restore again to recover the selected saves.`,
      },
    }
    return { ok: false, status: { kind: 'unavailable', message: `Restore was not applied because this browser could not save every selected workspace. ${unchanged} Allow browser storage or free space, then try again.` } }
  }

  return { ok: true, status: { kind: 'saved', message: `${chosen.map(module => module.toUpperCase()).join(', ')} workspace${chosen.length === 1 ? '' : 's'} restored and saved in this browser. Unselected workspaces and unrelated browser data are unchanged.` } }
}
