import { useLayoutEffect } from 'react'
import { flushCommittedNavigationFocus, type NavigationCommit } from './navigation'

/** Called by the mounted layout after its accepted destination has rendered. */
export function useCommittedNavigationFocus(commit: NavigationCommit | null) {
  useLayoutEffect(() => { if (commit) flushCommittedNavigationFocus(commit) }, [commit])
}
