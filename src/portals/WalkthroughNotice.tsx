import { usePortalRuntime } from './portal-runtime-context'

/** Static copy: navigation and save feedback retain their own announcements. */
export function WalkthroughNotice() {
  const { mode } = usePortalRuntime()
  if (mode !== 'walkthrough') return null
  return <aside aria-label="Walkthrough mode" className="mx-auto mt-5 max-w-7xl rounded-xl border border-sky-300 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-950">
    <strong>Walkthrough — mock data stays in memory.</strong>{' '}
    Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.
  </aside>
}
