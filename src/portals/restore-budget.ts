import { portalById } from './registry'
import { DEMO_STORAGE_LIMIT, DEMO_STORAGE_VERSION, demoStorageKey, type DemoModule } from './persistence'
import { createRestorePoint, parseRestorePoints, projectRestorePoints, RESTORE_POINTS_KEY, RESTORE_POINTS_LIMIT, validRestoreSelection, type RestorePoint, type RestorePointOptions, type RestorePointsLoad } from './restore-points'
import { isDemoWorkspaces, type DemoWorkspaces } from './workspaces'

export type RestoreBudgetOptions = RestorePointOptions & { sourcePointId?: string }
export type RestoreBudgetMetrics = {
  selected: { module: DemoModule; characters: number; limit: number }[]
  selectedCharacters: number
  newPointCharacters: number
  currentHistoryCharacters: number
  projectedHistoryCharacters: number
  retainedPoints: number
  prunedPoints: number
  historyLimit: number
}
export type RestoreBudgetPreview =
  | { ok: false; message: string }
  | ({ ok: true; canRestore: boolean; reason?: string } & RestoreBudgetMetrics)

type CheckpointPlan = {
  point: RestorePoint
  points: RestorePoint[]
  states: DemoWorkspaces
  modules: DemoModule[]
  prepared: { key: string; raw: string; label: string }[]
  budget: Extract<RestoreBudgetPreview, { ok: true }>
}
type CheckpointPlanResult = { ok: false; message: string } | { ok: true; plan: CheckpointPlan }
type HistoryInput = RestorePointsLoad | readonly RestorePoint[]

function readHistory(history: HistoryInput): RestorePoint[] {
  if (!Array.isArray(history) && (history as RestorePointsLoad).error) throw new Error((history as RestorePointsLoad).error)
  const points = Array.isArray(history) ? history : (history as RestorePointsLoad).points
  // Treat supplied history with the same strictness as persisted history. This
  // also clones caller records, rejecting getters/serialization substitutions.
  return parseRestorePoints(JSON.stringify({ schemaVersion: 1, points }))
}

/** Produce the exact detached state, history retention and strings to write.
 * This pure preparation is shared by confirmation and the read-only preview;
 * callers still read fresh history and enforce real storage success at commit.
 */
export function prepareCheckpointRestore(current: DemoWorkspaces, target: DemoWorkspaces | undefined, selected: readonly DemoModule[] | undefined, historyInput: HistoryInput, options: RestoreBudgetOptions = {}): CheckpointPlanResult {
  try {
    if (!isDemoWorkspaces(current)) throw new Error('The current mock workspaces are invalid or incompatible.')
    const history = readHistory(historyInput)
    const source = options.sourcePointId === undefined ? undefined : history.find(point => point.id === options.sourcePointId)
    if (options.sourcePointId !== undefined && !source) throw new Error('This restore point is no longer available. Refresh the restore-point list and choose an existing point.')
    if (source) {
      selected = source.modules
      target = { ...current, ...source.states }
    }
    if (!validRestoreSelection(selected) || !isDemoWorkspaces(target)) throw new Error('Choose at least one valid workspace and a complete, compatible backup before restoring.')
    const modules = [...selected]
    const point = createRestorePoint(current, modules, source ? 'undo' : 'restore', options.sourcePointId, options)
    const restored = createRestorePoint(target, modules, 'restore', undefined, { id: 'restored-target', createdAt: point.createdAt })
    const states = JSON.parse(JSON.stringify({ ...current, ...restored.states })) as DemoWorkspaces
    if (!isDemoWorkspaces(states)) throw new Error('The serialized mock workspaces are invalid or incompatible.')
    const nextHistory = projectRestorePoints(history, point)
    const workspaceWrites = modules.map(module => ({
      key: demoStorageKey(module),
      raw: JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: states[module] }),
      label: `${portalById[module].label} save`,
    }))
    const selectedMetrics = workspaceWrites.map((item, index) => ({ module: modules[index], characters: item.raw.length, limit: DEMO_STORAGE_LIMIT }))
    const oversized = selectedMetrics.find(item => item.characters > item.limit)
    const reason = oversized
      ? `${portalById[oversized.module].label} exceeds the 2,000,000-character browser save limit. Reduce its mock workspace data before trying again.`
      : nextHistory.raw.length > RESTORE_POINTS_LIMIT
        ? 'The automatic restore point exceeds the 2,000,000-character history limit. Export a backup and reduce the selected mock workspace data before trying again.'
        : undefined
    const budget: Extract<RestoreBudgetPreview, { ok: true }> = {
      ok: true,
      canRestore: reason === undefined,
      ...(reason ? { reason } : {}),
      selected: selectedMetrics,
      selectedCharacters: selectedMetrics.reduce((sum, item) => sum + item.characters, 0),
      newPointCharacters: JSON.stringify(point).length,
      currentHistoryCharacters: JSON.stringify({ schemaVersion: 1, points: history }).length,
      projectedHistoryCharacters: nextHistory.raw.length,
      retainedPoints: nextHistory.points.length,
      prunedPoints: history.length + 1 - nextHistory.points.length,
      historyLimit: RESTORE_POINTS_LIMIT,
    }
    // The history envelope is parsed again before any possible storage write.
    // The oversized newest point remains measurable but cannot be committed.
    const points = budget.canRestore ? parseRestorePoints(nextHistory.raw) : nextHistory.points
    return { ok: true, plan: { point: points[0], points, states, modules, prepared: [{ key: RESTORE_POINTS_KEY, raw: nextHistory.raw, label: 'restore-point history' }, ...workspaceWrites], budget } }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The restore storage budget could not be prepared.' }
  }
}

/** Serialized character counts, not physical bytes or available browser quota.
 * No storage probes, writes, UUID generation or caller-owned mutations occur.
 * A fixed-length placeholder projects the same size as runtime UUIDs. Pick an
 * unused placeholder so existing points cannot cause a false duplicate error.
 */
export function previewRestoreBudget(current: DemoWorkspaces, target: DemoWorkspaces, selected: readonly DemoModule[], history: HistoryInput, options: RestoreBudgetOptions = {}): RestoreBudgetPreview {
  try {
    const points = readHistory(history)
    let previewId = options.id
    if (previewId === undefined) {
      for (let index = 0; index <= points.length; index += 1) {
        const candidate = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
        if (!points.some(point => point.id === candidate)) { previewId = candidate; break }
      }
    }
    const result = prepareCheckpointRestore(current, target, selected, points, { ...options, id: previewId, createdAt: options.createdAt ?? '2000-01-01T00:00:00.000Z' })
    return result.ok ? result.plan.budget : result
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The restore storage budget could not be prepared.' }
  }
}
