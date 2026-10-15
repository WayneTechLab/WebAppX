import { portalById } from './registry'
import { clearDemoState, DEMO_STORAGE_LIMIT, DEMO_STORAGE_VERSION, demoStorageKey, type DemoModule, type DemoStorage, type DemoStorageStatus } from './persistence'
import { replaceDemoState } from './import-state'
import { createRestorePoint, parseRestorePoints, prepareRestorePoints, projectRestorePoints, RESTORE_POINTS_KEY, RESTORE_POINTS_LIMIT, type RestorePoint, type RestorePointOptions, type RestorePointsLoad } from './restore-points'
import { demoWorkspaceValidators, type DemoWorkspaces } from './workspaces'
import { parseRecoveryPreferences, RECOVERY_PREFERENCES_KEY, recoveryStorage, type RecoveryPreferencesLoad, type RecoveryReplacementPreview } from './recovery-preferences'

export type WorkspaceReplacement = 'import' | 'reset'
export type WorkspaceReplacementResult<T> =
  | { ok: true; state: T; status: DemoStorageStatus; checkpointRequired: boolean; point?: RestorePoint; points?: RestorePoint[] }
  | { ok: false; status: DemoStorageStatus; checkpointRequired: boolean; recoveryRequired?: boolean; refreshPreview?: boolean }
const label = (module: DemoModule, operation: WorkspaceReplacement) => `Before ${portalById[module].label} ${operation === 'import' ? 'individual import' : 'Reset'}`
const unchanged = 'The current in-memory workspace remains open; no replacement was accepted.'

function validOptions(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && ['id', 'createdAt'].includes(key) && Object.hasOwn(descriptors[key], 'value'))
}

function prepareIncoming<K extends DemoModule>(module: K, incoming: unknown): { state: DemoWorkspaces[K]; raw: string } {
  const validate = demoWorkspaceValidators[module]
  if (!validate(incoming)) throw new Error('The replacement workspace is invalid or incompatible.')
  const raw = JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: incoming })
  if (raw.length > DEMO_STORAGE_LIMIT) throw new Error('The replacement workspace exceeds the 2,000,000-character save limit.')
  const state: unknown = JSON.parse(raw).data
  if (!validate(state)) throw new Error('The serialized replacement workspace is invalid or incompatible.')
  return { state: state as DemoWorkspaces[K], raw }
}

/** Pure projection: no clock, random identifier, browser read, or mutation. */
export function previewWorkspaceReplacement<K extends DemoModule>(module: K, current: DemoWorkspaces, incoming: unknown, operation: WorkspaceReplacement, settings: RecoveryPreferencesLoad, history: RestorePointsLoad): RecoveryReplacementPreview {
  let required = true
  try {
    if (!['import', 'reset'].includes(operation) || !Object.hasOwn(portalById, module)) throw new Error('Unsupported workspace replacement.')
    const target = prepareIncoming(module, incoming)
    if (!demoWorkspaceValidators[module](current[module])) throw new Error('The current selected workspace is invalid or incompatible.')
    if (settings.error) throw new Error(settings.error)
    const preferences = parseRecoveryPreferences(JSON.stringify({ schemaVersion: 1, ...settings.preferences }))
    required = operation === 'import' ? preferences.beforeImport : preferences.beforeReset
    const facts = { schemaVersion: 1, module, operation, current: JSON.stringify(current[module]), target: target.raw, preferences }
    if (!required) return { ok: true, required: false, canReplace: true, confirmation: JSON.stringify(facts), message: `Checkpoint before ${operation === 'import' ? 'individual import' : 'Reset'} is off. This action creates no restore point.` }
    if (history.error) throw new Error(history.error)
    const points = parseRestorePoints(JSON.stringify({ schemaVersion: 1, points: history.points }))
    let id = ''
    for (let index = 0; index <= points.length; index += 1) {
      const candidate = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
      if (!points.some(point => point.id === candidate)) { id = candidate; break }
    }
    const point = createRestorePoint(current, [module], operation, undefined, { id, createdAt: '2000-01-01T00:00:00.000Z', label: label(module, operation) })
    const projected = projectRestorePoints(points, point)
    const canReplace = projected.raw.length <= RESTORE_POINTS_LIMIT
    return { ok: true, required: true, canReplace, ...(canReplace ? { confirmation: JSON.stringify({ ...facts, history: points }) } : {}), message: canReplace ? `A required ${portalById[module].label}-only checkpoint will save the current complete records before ${operation === 'import' ? 'import' : 'Reset'}.` : 'The required new checkpoint exceeds the 2,000,000-character history limit. Export current records and reduce the selected workspace before trying again.',
      newPointCharacters: JSON.stringify(point).length, projectedHistoryCharacters: projected.raw.length,
      retainedPoints: projected.points.length, prunedPoints: points.length + 1 - projected.points.length, historyLimit: RESTORE_POINTS_LIMIT }
  } catch (error) { return { ok: false, required, canReplace: false, message: error instanceof Error ? error.message : 'The replacement checkpoint could not be previewed.' } }
}

/** Optional history+one-slot commit. A Reset removes the save instead of writing a seed.
 * Storage has no multi-key transaction: verify writes and restore exact prior bytes
 * on failure, reporting uncertainty when any rollback cannot be confirmed.
 */
export function replaceWorkspaceWithRecovery<K extends DemoModule>(module: K, current: DemoWorkspaces, incoming: unknown, operation: WorkspaceReplacement, storage?: DemoStorage | null, options: Omit<RestorePointOptions, 'label'> = {}, confirmation?: string): WorkspaceReplacementResult<DemoWorkspaces[K]> {
  let required = true
  let target: DemoStorage
  let prepared: { state: DemoWorkspaces[K]; raw: string }
  let preferenceRaw: string | null
  let settings: RecoveryPreferencesLoad
  try {
    if (!['import', 'reset'].includes(operation) || !Object.hasOwn(portalById, module)) throw new Error('Unsupported workspace replacement.')
    if (!validOptions(options)) throw new Error('The checkpoint identifier, creation time or options are invalid.')
    // Reject malformed imports before even reading settings/history or capturing a point.
    prepared = prepareIncoming(module, incoming)
    target = recoveryStorage(storage)
    preferenceRaw = target.getItem(RECOVERY_PREFERENCES_KEY)
    const preferences = parseRecoveryPreferences(preferenceRaw)
    settings = { preferences }
    required = operation === 'import' ? preferences.beforeImport : preferences.beforeReset
  } catch (error) { return { ok: false, checkpointRequired: required, status: { kind: 'recovered', message: `${error instanceof Error ? error.message : 'Replacement settings or records could not be read.'} ${unchanged}` } } }

  // A valid known-off one-click Reset has no preview promise to bind. Every
  // individual import and every required Reset must match reviewed facts.
  if (!required && operation === 'reset' && confirmation === undefined) return { ok: true, state: prepared.state, status: clearDemoState(module, target), checkpointRequired: false }

  let previousHistory: string | null = null
  let history: RestorePoint[] = []
  try {
    if (required) {
      previousHistory = target.getItem(RESTORE_POINTS_KEY)
      history = previousHistory === null ? [] : parseRestorePoints(previousHistory)
    }
    const reviewed = previewWorkspaceReplacement(module, current, prepared.state, operation, settings, { points: history })
    if (!reviewed.ok || !reviewed.canReplace) throw new Error(reviewed.message)
    if (typeof confirmation !== 'string' || confirmation !== reviewed.confirmation) throw new Error('The replacement preview changed or was not reviewed. Review the refreshed checkpoint settings, selected records and history before confirming again.')
    if (target.getItem(RECOVERY_PREFERENCES_KEY) !== preferenceRaw || (required && target.getItem(RESTORE_POINTS_KEY) !== previousHistory)) throw new Error('Recovery settings or history changed. Review the refreshed preview before confirming again.')
  } catch (error) { return { ok: false, checkpointRequired: required, refreshPreview: true, status: { kind: 'recovered', message: `${error instanceof Error ? error.message : 'The reviewed replacement could not be confirmed.'} ${unchanged} No history or workspace save was written.` } } }

  if (!required) {
    // Keep the original default-off semantics, including an in-memory Reset when
    // removal fails. Opt-in failure, below, never accepts that seed.
    if (operation === 'reset') return { ok: true, state: prepared.state, status: clearDemoState(module, target), checkpointRequired: false }
    const validate = (value: unknown): value is DemoWorkspaces[K] => demoWorkspaceValidators[module](value)
    const result = replaceDemoState(module, prepared.state, validate, target)
    return { ...result, checkpointRequired: false }
  }

  const key = demoStorageKey(module)
  let previousSave: string | null
  let point: RestorePoint
  let historyRaw: string
  let points: RestorePoint[]
  try {
    point = createRestorePoint(current, [module], operation, undefined, { ...options, label: label(module, operation) })
    const projected = prepareRestorePoints(history, point)
    historyRaw = projected.raw
    points = projected.points
    previousSave = target.getItem(key)
    if (target.getItem(RECOVERY_PREFERENCES_KEY) !== preferenceRaw || target.getItem(RESTORE_POINTS_KEY) !== previousHistory || target.getItem(key) !== previousSave) throw new Error('Recovery settings, history or the selected save changed. Refresh the preview and review before trying again.')
  } catch (error) { return { ok: false, checkpointRequired: true, status: { kind: 'recovered', message: `${error instanceof Error ? error.message : 'The required checkpoint or previous save could not be prepared.'} ${unchanged} No history or workspace save was written.` } } }

  const previous = new Map<string, string | null>([[RESTORE_POINTS_KEY, previousHistory], [key, previousSave]])
  const attempted: string[] = []
  try {
    attempted.push(RESTORE_POINTS_KEY)
    target.setItem(RESTORE_POINTS_KEY, historyRaw)
    if (target.getItem(RESTORE_POINTS_KEY) !== historyRaw) throw new Error('The required checkpoint write was not confirmed.')
    attempted.push(key)
    if (operation === 'reset') target.removeItem(key)
    else target.setItem(key, prepared.raw)
    if (target.getItem(key) !== (operation === 'reset' ? null : prepared.raw)) throw new Error('The workspace replacement write was not confirmed.')
  } catch {
    const uncertain: string[] = []
    for (const slot of [...attempted].reverse()) {
      try {
        const raw = previous.get(slot) ?? null
        if (raw === null) target.removeItem(slot)
        else target.setItem(slot, raw)
        if (target.getItem(slot) !== raw) throw new Error('Rollback readback failed')
      } catch { uncertain.push(slot === RESTORE_POINTS_KEY ? 'restore-point history' : `${portalById[module].label} browser save`) }
    }
    if (uncertain.length) return { ok: false, checkpointRequired: true, recoveryRequired: true, status: { kind: 'unavailable', message: `Replacement failed and rollback could not be confirmed for ${uncertain.join(' and ')}. Those browser slots may differ. ${unchanged} Keep this page open and export current workspaces before refreshing, then recover storage access and review history/saves. Other workspace saves and unrelated browser data were not written.` } }
    return { ok: false, checkpointRequired: true, status: { kind: 'unavailable', message: `The required checkpoint and ${operation === 'reset' ? 'Reset' : 'import'} could not both be saved. Exact previous history and selected save bytes were restored. ${unchanged}` } }
  }
  return { ok: true, checkpointRequired: true, state: prepared.state, point, points,
    status: { kind: operation === 'reset' ? 'reset' : 'saved', message: `${portalById[module].label} ${operation === 'reset' ? 'original fictional records restored and browser save removed' : 'workspace imported and saved'}. A required ${portalById[module].label}-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged.` } }
}
