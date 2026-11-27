import { useLayoutEffect } from 'react'
import { flushCommittedNavigationFocus, type NavigationCommit } from './navigation'

/** Called by the mounted layout after its accepted destination has rendered. */
export function useCommittedNavigationFocus(commit: NavigationCommit | null) {
  useLayoutEffect(() => {
    if (!commit) return
    // Retained portal children mount in a synchronous layout-effect update.
    // Let that commit finish before resolving the destination against the DOM.
    let active = true
    queueMicrotask(() => { if (active) flushCommittedNavigationFocus(commit) })
    return () => { active = false }
  }, [commit])
}
