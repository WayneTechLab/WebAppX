/** Accepted navigation only. History identity is independent of a pathname. */
export type NavigationEntry = Readonly<{ url: string; index: number | null; id: string }>
export type NavigationCommit = Readonly<{
  sequence: number
  location: string
  kind: 'route' | 'traverse' | 'hash'
  entry: Readonly<{ id: string; index: number | null }>
  /** A guarded traversal can replace its physical slot while remembering the intended entry. */
  restoreEntryId: string | null
  focus: 'destination' | 'preserve'
}>
