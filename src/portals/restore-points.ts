import { createDemoBackup, parseDemoBackup } from './backup'
import { type DemoModule, type DemoStorage } from './persistence'
import { demoWorkspaceValidators, isDemoWorkspaces, type DemoWorkspaces } from './workspaces'

export const RESTORE_POINTS_KEY = 'webappx.demo.restore-points'
export const RESTORE_POINTS_MAX = 5
export const RESTORE_POINTS_LIMIT = 2_000_000
export type RestorePoint = {
  id: string
  createdAt: string
  kind: 'restore' | 'undo'
  modules: DemoModule[]
  states: Partial<DemoWorkspaces>
  sourcePointId?: string
}
export type RestorePointOptions = { id?: string; createdAt?: string }
export type RestorePointsLoad = { points: RestorePoint[]; status?: string; error?: string }
export type ClearRestorePointsResult = { ok: boolean; points: RestorePoint[]; status: string; error?: string }

const modules: DemoModule[] = ['hr', 'cms', 'crm']
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
  return Array.isArray(value) && value.length > 0 && value.length <= modules.length
    && value.every(module => modules.includes(module)) && new Set(value).size === value.length
}
function validatePoint(value: unknown): value is RestorePoint {
  if (!record(value)) return false
  const keys = ['id', 'createdAt', 'kind', 'modules', 'states', ...(value.kind === 'undo' ? ['sourcePointId'] : [])]
  if (!exactKeys(value, keys) || !validId(value.id) || !validTimestamp(value.createdAt)
    || !['restore', 'undo'].includes(value.kind as string) || !validRestoreSelection(value.modules)
    || !record(value.states) || !exactKeys(value.states, value.modules)) return false
  if (value.kind === 'undo' && (!validId(value.sourcePointId) || value.sourcePointId === value.id)) return false
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
export function createRestorePoint(states: DemoWorkspaces, selected: readonly DemoModule[], kind: 'restore' | 'undo' = 'restore', sourcePointId?: string, options: RestorePointOptions = {}): RestorePoint {
  if (!validRestoreSelection(selected) || !isDemoWorkspaces(states)) throw new Error('The current mock workspaces or restore selection are invalid.')
  const createdAt = options.createdAt ?? new Date().toISOString()
  const id = options.id ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `point-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)
  const snapshots: Partial<DemoWorkspaces> = {}
  for (const module of selected) {
    const validate = (item: unknown): item is DemoWorkspaces[DemoModule] => demoWorkspaceValidators[module](item)
    const state = parseDemoBackup(createDemoBackup(module, states[module], validate, createdAt), module, validate).state
    Object.assign(snapshots, { [module]: state })
  }
  const point: RestorePoint = { id, createdAt, kind, modules: [...selected], states: snapshots, ...(sourcePointId === undefined ? {} : { sourcePointId }) }
  if (!validatePoint(point)) throw new Error('The automatic restore point could not be validated.')
  return point
}

/** Keep newest first; remove oldest points to fit the bounded history budget. */
export function prepareRestorePoints(points: RestorePoint[], point: RestorePoint): { points: RestorePoint[]; raw: string } {
  if (points.some(existing => existing.id === point.id)) throw new Error('A restore point with this identifier already exists. Try again.')
  const kept = [point, ...points].slice(0, RESTORE_POINTS_MAX)
  let raw = JSON.stringify({ schemaVersion: 1, points: kept })
  while (raw.length > RESTORE_POINTS_LIMIT && kept.length > 1) {
    kept.pop()
    raw = JSON.stringify({ schemaVersion: 1, points: kept })
  }
  if (raw.length > RESTORE_POINTS_LIMIT) throw new Error('The automatic restore point exceeds the 2,000,000-character history limit. Export a backup and reduce the selected mock workspace data before trying again.')
  return { points: parseRestorePoints(raw), raw }
}

export function loadRestorePoints(storage?: DemoStorage | null): RestorePointsLoad {
  let raw: string | null
  try { raw = storageForHistory(storage).getItem(RESTORE_POINTS_KEY) }
  catch { return { points: [], error: 'This browser could not read restore-point history. Allow browser storage before restoring or undoing.' } }
  if (raw === null) return { points: [], status: 'No automatic restore points yet.' }
  try {
    const points = parseRestorePoints(raw)
    return { points, status: `${points.length} automatic restore point${points.length === 1 ? '' : 's'} saved in this browser.` }
  } catch (error) { return { points: [], error: error instanceof Error ? error.message : damaged } }
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
