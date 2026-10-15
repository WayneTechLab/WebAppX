import { portalIds } from './registry'
import { createDemoBackup, parseDemoBackup } from './backup'
import { type DemoModule, type DemoStorage, type DemoStorageStatus } from './persistence'
import { demoWorkspaceValidators, isDemoWorkspaces, type DemoWorkspaces } from './workspaces'

export const RESTORE_POINTS_KEY = 'webappx.demo.restore-points'
export const RESTORE_POINTS_MAX = 5
export const RESTORE_POINTS_LIMIT = 2_000_000
export const RESTORE_POINT_LABEL_MAX = 100
export type RestorePoint = {
  id: string
  createdAt: string
  kind: 'restore' | 'undo' | 'manual' | 'import' | 'reset'
  modules: DemoModule[]
  states: Partial<DemoWorkspaces>
  sourcePointId?: string
  label?: string
}
export type RestorePointOptions = { id?: string; createdAt?: string; label?: string }
export type RestorePointsLoad = { points: RestorePoint[]; status?: string; error?: string }
export type ClearRestorePointsResult = { ok: boolean; points: RestorePoint[]; status: string; error?: string }
export type HistoryMutationResult =
  | { ok: true; status: DemoStorageStatus; point: RestorePoint; points: RestorePoint[] }
  | { ok: false; status: DemoStorageStatus; recoveryRequired?: boolean }
export type ManualRestorePointPreview =
  | { ok: false; message: string }
  | { ok: true; canCreate: boolean; reason?: string; point: RestorePoint; currentHistoryCharacters: number; newPointCharacters: number; projectedHistoryCharacters: number; retainedPoints: number; prunedPoints: number; historyLimit: number }

const reserved = new Set(['__proto__', 'prototype', 'constructor'])
const damaged = 'Restore-point history is damaged or incompatible. Current workspaces are unchanged. Clear restore points explicitly before restoring again; clearing history does not clear workspace saves.'

function storageForHistory(storage?: DemoStorage | null): DemoStorage {
  const result = storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage
  if (!result) throw new Error('Browser storage unavailable')
  return result
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)
}
function validPointOptions(value: unknown, allowLabel: boolean, sourcePointId?: string): value is RestorePointOptions {
  if (!record(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const allowed = ['id', 'createdAt', ...(allowLabel ? ['label', 'sourcePointId'] : [])]
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return false
  return (!Object.hasOwn(value, 'id') || value.id === undefined || validId(value.id))
    && (!Object.hasOwn(value, 'createdAt') || value.createdAt === undefined || validTimestamp(value.createdAt))
    && (!Object.hasOwn(value, 'label') || value.label === undefined || typeof value.label === 'string')
    && (!Object.hasOwn(value, 'sourcePointId') || value.sourcePointId === sourcePointId)
}
function hasLabelControls(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029) return true
  }
  return false
}
function validLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= RESTORE_POINT_LABEL_MAX
    && value === value.trim() && !hasLabelControls(value)
}
export function normalizeRestorePointLabel(value: unknown): string {
  if (typeof value !== 'string' || hasLabelControls(value)) throw new Error(`Enter a restore-point label of 1–${RESTORE_POINT_LABEL_MAX} characters on one line.`)
  const label = value.trim()
  if (!validLabel(label)) throw new Error(`Enter a restore-point label of 1–${RESTORE_POINT_LABEL_MAX} characters on one line.`)
  return label
}
function hasReservedKeys(value: unknown): boolean {
  const pending = [value]
  const seen = new Set<object>()
  while (pending.length) {
    const item = pending.pop()
    if (!item || typeof item !== 'object') continue
    if (seen.has(item)) return true
    seen.add(item)
    for (const [key, nested] of Object.entries(item)) {
      if (reserved.has(key)) return true
      pending.push(nested)
    }
  }
  return false
}
export function validRestoreSelection(value: unknown): value is DemoModule[] {
  return Array.isArray(value) && value.length > 0 && value.length <= portalIds.length
    && value.every(module => portalIds.includes(module)) && new Set(value).size === value.length
}
function validatePoint(value: unknown): value is RestorePoint {
  if (!record(value)) return false
  const keys = ['id', 'createdAt', 'kind', 'modules', 'states', ...(value.kind === 'undo' ? ['sourcePointId'] : []), ...(Object.hasOwn(value, 'label') ? ['label'] : [])]
  if (!exactKeys(value, keys) || !validId(value.id) || !validTimestamp(value.createdAt)
    || !['restore', 'undo', 'manual', 'import', 'reset'].includes(value.kind as string) || !validRestoreSelection(value.modules)
    || !record(value.states) || !exactKeys(value.states, value.modules)) return false
  if (value.kind === 'undo' && (!validId(value.sourcePointId) || value.sourcePointId === value.id)) return false
  if ((Object.hasOwn(value, 'label') && !validLabel(value.label)) || (['manual', 'import', 'reset'].includes(value.kind as string) && !validLabel(value.label))) return false
  return value.modules.every(module => {
    const state = (value.states as Record<string, unknown>)[module]
    const validate = (item: unknown): item is DemoWorkspaces[DemoModule] => demoWorkspaceValidators[module](item)
    try { createDemoBackup(module, state, validate, value.createdAt as string); return true } catch { return false }
  })
}

/** Strict local history parsing; never silently discard damaged recovery data. */
export function parseRestorePoints(text: string): RestorePoint[] {
  try {
    if (typeof text !== 'string' || text.length > RESTORE_POINTS_LIMIT) throw new Error('Oversized history')
    const envelope: unknown = JSON.parse(text)
    if (!record(envelope) || !exactKeys(envelope, ['schemaVersion', 'points']) || envelope.schemaVersion !== 1
      || !Array.isArray(envelope.points) || envelope.points.length > RESTORE_POINTS_MAX
      || hasReservedKeys(envelope) || !envelope.points.every(validatePoint)
      || new Set(envelope.points.map(point => point.id)).size !== envelope.points.length) throw new Error('Invalid history')
    return envelope.points as RestorePoint[]
  } catch { throw new Error(damaged) }
}

/** Clone and validate each selected complete portal before it becomes recovery data. */
export function createRestorePoint(states: DemoWorkspaces, selected: readonly DemoModule[], kind: RestorePoint['kind'] = 'restore', sourcePointId?: string, options: RestorePointOptions = {}): RestorePoint {
  if (!validPointOptions(options, true, sourcePointId)) throw new Error('The restore-point identifier, creation time or options are invalid.')
  if (!validRestoreSelection(selected) || !isDemoWorkspaces(states)) throw new Error('The current mock workspaces or restore selection are invalid.')
  const createdAt = options.createdAt ?? new Date().toISOString()
  // Both branches have the same serialized length, allowing a pure size preview
  // to project the exact envelope length without generating a live identifier.
  const id = options.id ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16)
    return (character === 'x' ? random : (random & 3) | 8).toString(16)
  }))
  const snapshots: Partial<DemoWorkspaces> = {}
  for (const module of selected) {
    const validate = (item: unknown): item is DemoWorkspaces[DemoModule] => demoWorkspaceValidators[module](item)
    const state = parseDemoBackup(createDemoBackup(module, states[module], validate, createdAt), module, validate).state
    Object.assign(snapshots, { [module]: state })
  }
  const label = options.label === undefined ? undefined : normalizeRestorePointLabel(options.label)
  const point: RestorePoint = { id, createdAt, kind, modules: [...selected], states: snapshots, ...(sourcePointId === undefined ? {} : { sourcePointId }), ...(label === undefined ? {} : { label }) }
  if (!validatePoint(point)) throw new Error('The restore point could not be validated.')
  return point
}

/** Pure retention projection shared by the preview and the committed write.
 * A newest point that cannot fit is returned for an explanatory size preview;
 * prepareRestorePoints remains the validating, rejecting write preparation.
 */
export function projectRestorePoints(points: readonly RestorePoint[], point: RestorePoint): { points: RestorePoint[]; raw: string } {
  if (points.some(existing => existing.id === point.id)) throw new Error('A restore point with this identifier already exists. Try again.')
  const kept = [point, ...points].slice(0, RESTORE_POINTS_MAX)
  let raw = JSON.stringify({ schemaVersion: 1, points: kept })
  while (raw.length > RESTORE_POINTS_LIMIT && kept.length > 1) {
    kept.pop()
    raw = JSON.stringify({ schemaVersion: 1, points: kept })
  }
  return { points: kept, raw }
}

/** Keep newest first; remove oldest points to fit the bounded history budget. */
export function prepareRestorePoints(points: readonly RestorePoint[], point: RestorePoint): { points: RestorePoint[]; raw: string } {
  const projected = projectRestorePoints(points, point)
  if (projected.raw.length > RESTORE_POINTS_LIMIT) throw new Error('The restore point exceeds the 2,000,000-character history limit. Export a backup and reduce the selected mock workspace data before trying again.')
  return { points: parseRestorePoints(projected.raw), raw: projected.raw }
}

export function loadRestorePoints(storage?: DemoStorage | null): RestorePointsLoad {
  let raw: string | null
  try { raw = storageForHistory(storage).getItem(RESTORE_POINTS_KEY) }
  catch { return { points: [], error: 'This browser could not read restore-point history. Allow browser storage before restoring or undoing.' } }
  if (raw === null) return { points: [], status: 'No restore points yet.' }
  try {
    const points = parseRestorePoints(raw)
    return { points, status: `${points.length} restore point${points.length === 1 ? '' : 's'} saved in this browser.` }
  } catch (error) { return { points: [], error: error instanceof Error ? error.message : damaged } }
}

/** Pure manual capture preview. Placeholder identity/time use exactly the same
 * serialized lengths as runtime values and never access browser storage, crypto
 * or the clock. Commit reloads history and rechecks the real write budget.
 */
export function previewManualRestorePoint(current: DemoWorkspaces, selected: readonly DemoModule[], label: string, historyInput: RestorePointsLoad | readonly RestorePoint[], options: Omit<RestorePointOptions, 'label'> = {}): ManualRestorePointPreview {
  try {
    if (!validPointOptions(options, false)) throw new Error('The restore-point preview identifier, creation time or options are invalid.')
    if (!Array.isArray(historyInput) && (historyInput as RestorePointsLoad).error) throw new Error((historyInput as RestorePointsLoad).error)
    const supplied = Array.isArray(historyInput) ? historyInput : (historyInput as RestorePointsLoad).points
    const history = parseRestorePoints(JSON.stringify({ schemaVersion: 1, points: supplied }))
    let id = options.id
    if (id === undefined) {
      for (let index = 0; index <= history.length; index += 1) {
        const candidate = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
        if (!history.some(point => point.id === candidate)) { id = candidate; break }
      }
    }
    const point = createRestorePoint(current, selected, 'manual', undefined, { ...options, label: normalizeRestorePointLabel(label), id, createdAt: options.createdAt ?? '2000-01-01T00:00:00.000Z' })
    const projected = projectRestorePoints(history, point)
    const canCreate = projected.raw.length <= RESTORE_POINTS_LIMIT
    return {
      ok: true, canCreate, point,
      ...(canCreate ? {} : { reason: 'The named restore point exceeds the 2,000,000-character history limit. Export a backup and reduce the selected mock workspace data before trying again.' }),
      currentHistoryCharacters: JSON.stringify({ schemaVersion: 1, points: history }).length,
      newPointCharacters: JSON.stringify(point).length,
      projectedHistoryCharacters: projected.raw.length,
      retainedPoints: projected.points.length,
      prunedPoints: history.length + 1 - projected.points.length,
      historyLimit: RESTORE_POINTS_LIMIT,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The named restore-point preview could not be prepared.' }
  }
}

/** Commit one validated history envelope. No workspace save is read or written.
 * Guard against a stale read and restore exact prior bytes if a write changes
 * history before throwing. An uncertain rollback never reports preservation.
 */
function commitHistory(target: DemoStorage, previous: string | null, raw: string, pointId: string, message: string): HistoryMutationResult {
  let points: RestorePoint[]
  let point: RestorePoint
  try {
    points = parseRestorePoints(raw)
    const preparedPoint = points.find(item => item.id === pointId)
    if (!preparedPoint) throw new Error('Prepared restore point is missing')
    point = preparedPoint
    if (target.getItem(RESTORE_POINTS_KEY) !== previous) return {
      ok: false, status: { kind: 'recovered', message: 'Restore-point history changed before this action. Refresh the list and try again. Current workspaces and browser saves are unchanged.' },
    }
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: 'This browser could not confirm the current restore-point history. The history action was not saved. Current workspaces and browser saves are unchanged.' } }
  }
  try {
    target.setItem(RESTORE_POINTS_KEY, raw)
    if (target.getItem(RESTORE_POINTS_KEY) !== raw) throw new Error('History write was not confirmed')
  } catch {
    try {
      if (previous === null) target.removeItem(RESTORE_POINTS_KEY)
      else target.setItem(RESTORE_POINTS_KEY, previous)
      if (target.getItem(RESTORE_POINTS_KEY) !== previous) throw new Error('History rollback was not confirmed')
    } catch {
      return { ok: false, recoveryRequired: true, status: { kind: 'unavailable', message: 'This browser could not save the history action or confirm rollback of restore-point history. History may differ from its previous value. Current workspaces and their saves were not changed. Keep this tab open and export the current workspaces before refreshing, then review history after browser storage is available.' } }
    }
    return { ok: false, status: { kind: 'unavailable', message: 'This browser could not save the history action. Previous restore-point history was preserved. Current workspaces and browser saves are unchanged. Allow browser storage or free space, then try again.' } }
  }
  return { ok: true, point, points, status: { kind: 'saved', message } }
}

/** Save a named selected-scope snapshot to history alone; never import or apply it. */
export function createManualRestorePoint(current: DemoWorkspaces, selected: readonly DemoModule[], label: string, storage?: DemoStorage | null, options: Omit<RestorePointOptions, 'label'> = {}): HistoryMutationResult {
  try {
    if (!validPointOptions(options, false)) throw new Error('Invalid options')
  } catch {
    return { ok: false, status: { kind: 'recovered', message: 'The restore-point identifier, creation time or options are invalid. The named point was not saved. Current workspaces and browser saves are unchanged.' } }
  }
  let target: DemoStorage
  let previous: string | null
  try {
    target = storageForHistory(storage)
    previous = target.getItem(RESTORE_POINTS_KEY)
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: 'This browser could not read restore-point history. The named point was not saved. Current workspaces and browser saves are unchanged. Allow browser storage, then try again.' } }
  }
  try {
    const history = previous === null ? [] : parseRestorePoints(previous)
    const point = createRestorePoint(current, selected, 'manual', undefined, { ...options, label: normalizeRestorePointLabel(label) })
    const prepared = prepareRestorePoints(history, point)
    return commitHistory(target, previous, prepared.raw, point.id, 'Named restore point saved in this browser. Current workspaces and browser saves are unchanged.')
  } catch (error) {
    return { ok: false, status: { kind: 'recovered', message: `${error instanceof Error ? error.message : 'The named restore point could not be prepared.'} Current workspaces and browser saves are unchanged.` } }
  }
}

/** Rename one persisted point without recreating its capture or pruning history. */
export function renameRestorePoint(pointId: string, label: string, storage?: DemoStorage | null): HistoryMutationResult {
  let target: DemoStorage
  let previous: string | null
  try {
    target = storageForHistory(storage)
    previous = target.getItem(RESTORE_POINTS_KEY)
  } catch {
    return { ok: false, status: { kind: 'unavailable', message: 'This browser could not read restore-point history. The label was not saved. Current workspaces and browser saves are unchanged. Allow browser storage, then try again.' } }
  }
  try {
    const history = previous === null ? [] : parseRestorePoints(previous)
    if (!validId(pointId) || !history.some(point => point.id === pointId)) throw new Error('This restore point is no longer available. Refresh the list and choose an existing point.')
    const named = normalizeRestorePointLabel(label)
    const points = history.map(point => point.id === pointId ? { ...point, label: named } : point)
    const raw = JSON.stringify({ schemaVersion: 1, points })
    if (raw.length > RESTORE_POINTS_LIMIT) throw new Error('This label would exceed the 2,000,000-character history limit. Shorten the label or export and review the existing history first.')
    return commitHistory(target, previous, raw, pointId, 'Restore-point label saved. Its captured records, scope and creation time are unchanged. Current workspaces and browser saves are unchanged.')
  } catch (error) {
    return { ok: false, status: { kind: 'recovered', message: `${error instanceof Error ? error.message : 'The restore-point label could not be prepared.'} Current workspaces and browser saves are unchanged.` } }
  }
}

export function clearRestorePoints(storage?: DemoStorage | null): ClearRestorePointsResult {
  try {
    storageForHistory(storage).removeItem(RESTORE_POINTS_KEY)
    return { ok: true, points: [], status: 'Restore points cleared. HR, CMS and CRM workspace saves are unchanged.' }
  } catch {
    const error = 'This browser could not confirm that restore-point history was cleared. Workspace saves are unchanged. Allow browser storage, then try again.'
    return { ok: false, points: [], status: error, error }
  }
}
