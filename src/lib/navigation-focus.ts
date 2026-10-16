import type { NavigationCommit, NavigationEntry } from './navigation-types'

export type SemanticFocusTarget = Readonly<{
  workspace: string
  scope: string
  key: string | null
  context: string
  fallbacks: readonly string[]
}>
export type FocusRequest = Readonly<{ commit: NavigationCommit; remembered: SemanticFocusTarget | null }>
export type NavigationFocusHost<T> = {
  capture: (entry: NavigationEntry) => SemanticFocusTarget | null
  active: () => unknown
  hasPriorityFocus: (atAcceptance: unknown) => boolean
  candidates: (request: FocusRequest) => readonly T[]
  /** Revalidate at the last boundary and return true only if focus actually landed. */
  focus: (target: T) => boolean
}

/** Volatile, bounded semantic memory. No record data, DOM references or history writes. */
export function createNavigationFocusCoordinator<T>(host: NavigationFocusHost<T>, limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid navigation focus memory limit.')
  const memory = new Map<string, SemanticFocusTarget>()
  let pending: { commit: NavigationCommit; active: unknown; consumed: boolean } | null = null
  let disposed = false
  return {
    captureDeparture(entry: NavigationEntry) {
      if (disposed) return
      const captured = host.capture(entry)
      // A modal/repeated request cannot replace a valid captured departure with nothing.
      if (!captured || !captured.workspace || !captured.scope || captured.workspace.length > 100 || captured.scope.length > 1024 || (captured.key !== null && (!captured.key || captured.key.length > 512)) || captured.context.length > 1024 || captured.fallbacks.length > 8 || captured.fallbacks.some(key => !key || key.length > 512)) return
      const value = Object.freeze({ ...captured, fallbacks: Object.freeze([...captured.fallbacks]) })
      memory.delete(entry.id)
      memory.set(entry.id, value)
      while (memory.size > limit) memory.delete(memory.keys().next().value!)
    },
    accept(commit: NavigationCommit) {
      if (disposed || (pending && commit.sequence <= pending.commit.sequence)) return
      pending = { commit, active: host.active(), consumed: commit.focus === 'preserve' }
    },
    flush(commit: NavigationCommit) {
      if (disposed || !pending || pending.commit !== commit || pending.consumed) return false
      pending.consumed = true
      if (host.hasPriorityFocus(pending.active)) return false
      const remembered = commit.kind === 'traverse' && commit.restoreEntryId ? memory.get(commit.restoreEntryId) ?? null : null
      for (const target of host.candidates({ commit, remembered })) {
        if (disposed || pending.commit !== commit || host.hasPriorityFocus(pending.active)) return false
        if (host.focus(target)) return true
      }
      return false
    },
    dispose() { disposed = true; pending = null; memory.clear() },
    size: () => memory.size,
  }
}
