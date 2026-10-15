import type { DemoStorage, DemoStorageStatus } from './persistence'

export const RECOVERY_PREFERENCES_KEY = 'webappx.demo.recovery-preferences'
export const RECOVERY_PREFERENCES_LIMIT = 4_096
export type RecoveryPreference = 'beforeImport' | 'beforeReset'
export type RecoveryPreferences = { beforeImport: boolean; beforeReset: boolean }
export type RecoveryPreferencesLoad = { preferences: RecoveryPreferences; error?: string }
export type RecoveryPreferencesResult = { ok: boolean; preferences: RecoveryPreferences; status: DemoStorageStatus; recoveryRequired?: boolean }
export type RecoveryReplacementPreview = {
  ok: boolean
  required: boolean
  canReplace: boolean
  message: string
  newPointCharacters?: number
  projectedHistoryCharacters?: number
  retainedPoints?: number
  prunedPoints?: number
  historyLimit?: number
  /** Exact reviewed facts in component memory only; never render or export. */
  confirmation?: string
}
/** Optional controls keep adopted providers without recovery integration usable. */
export type WorkspaceRecoveryControls = {
  settings: RecoveryPreferencesLoad
  setPreference: (preference: RecoveryPreference, enabled: boolean) => RecoveryPreferencesResult
  previewImport: (incoming: unknown) => RecoveryReplacementPreview
  previewReset: () => RecoveryReplacementPreview
}

export const defaultRecoveryPreferences = (): RecoveryPreferences => ({ beforeImport: false, beforeReset: false })
const damaged = 'Recovery settings are damaged or incompatible. Choose the checkpoint settings explicitly before importing or resetting; no workspace was changed.'

export function recoveryStorage(storage?: DemoStorage | null): DemoStorage {
  const result = storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage
  if (!result) throw new Error('Browser storage unavailable')
  return result
}

/** Absence means both options are off. Malformed settings never silently disable a checkpoint. */
export function parseRecoveryPreferences(raw: string | null): RecoveryPreferences {
  if (raw === null) return defaultRecoveryPreferences()
  try {
    if (typeof raw !== 'string' || raw.length > RECOVERY_PREFERENCES_LIMIT) throw new Error('Invalid settings')
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings')
    const item = value as Record<string, unknown>
    const keys = ['schemaVersion', 'beforeImport', 'beforeReset']
    if (Reflect.ownKeys(item).length !== keys.length || keys.some(key => !Object.hasOwn(item, key))
      || item.schemaVersion !== 1 || typeof item.beforeImport !== 'boolean' || typeof item.beforeReset !== 'boolean') throw new Error('Invalid settings')
    return { beforeImport: item.beforeImport, beforeReset: item.beforeReset }
  } catch { throw new Error(damaged) }
}

export function loadRecoveryPreferences(storage?: DemoStorage | null): RecoveryPreferencesLoad {
  try { return { preferences: parseRecoveryPreferences(recoveryStorage(storage).getItem(RECOVERY_PREFERENCES_KEY)) } }
  catch (error) { return { preferences: defaultRecoveryPreferences(), error: error instanceof Error && error.message === damaged ? damaged : 'This browser could not read recovery settings. No import or Reset can confirm whether a checkpoint is required. Allow browser storage, then try again.' } }
}

/** Explicitly save both reviewed booleans to their own key; never touch workspaces or history. */
export function saveRecoveryPreferences(value: RecoveryPreferences, storage?: DemoStorage | null): RecoveryPreferencesResult {
  let target: DemoStorage
  let previous: string | null
  let preferences: RecoveryPreferences
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== 2
      || !Object.hasOwn(value, 'beforeImport') || !Object.hasOwn(value, 'beforeReset')
      || ['beforeImport', 'beforeReset'].some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'))
      || typeof value.beforeImport !== 'boolean' || typeof value.beforeReset !== 'boolean') throw new Error('Choose both checkpoint settings explicitly.')
    preferences = { beforeImport: value.beforeImport, beforeReset: value.beforeReset }
    target = recoveryStorage(storage)
    previous = target.getItem(RECOVERY_PREFERENCES_KEY)
  } catch {
    return { ok: false, preferences: defaultRecoveryPreferences(), status: { kind: 'unavailable', message: 'Recovery settings could not be read or validated. Previous settings and workspaces were not changed.' } }
  }
  const raw = JSON.stringify({ schemaVersion: 1, ...preferences })
  try {
    if (target.getItem(RECOVERY_PREFERENCES_KEY) !== previous) return { ok: false, preferences: loadRecoveryPreferences(target).preferences, status: { kind: 'recovered', message: 'Recovery settings changed before saving. Review the current settings and try again.' } }
  } catch {
    return { ok: false, preferences: defaultRecoveryPreferences(), status: { kind: 'unavailable', message: 'The current recovery settings could not be confirmed. No settings were written.' } }
  }
  try {
    target.setItem(RECOVERY_PREFERENCES_KEY, raw)
    if (target.getItem(RECOVERY_PREFERENCES_KEY) !== raw) throw new Error('Settings write was not confirmed')
  } catch {
    try {
      if (previous === null) target.removeItem(RECOVERY_PREFERENCES_KEY)
      else target.setItem(RECOVERY_PREFERENCES_KEY, previous)
      if (target.getItem(RECOVERY_PREFERENCES_KEY) !== previous) throw new Error('Settings rollback was not confirmed')
    } catch {
      return { ok: false, preferences: defaultRecoveryPreferences(), recoveryRequired: true, status: { kind: 'unavailable', message: 'Recovery settings could not be saved or their rollback confirmed. Review settings after browser storage is available. Workspace saves and restore-point history were not changed.' } }
    }
    return { ok: false, preferences: loadRecoveryPreferences(target).preferences, status: { kind: 'unavailable', message: 'Recovery settings were not saved. Their exact previous bytes were restored; workspace saves and history are unchanged.' } }
  }
  return { ok: true, preferences, status: { kind: 'saved', message: 'Checkpoint settings saved for this browser origin. Workspace saves and restore-point history are unchanged.' } }
}
