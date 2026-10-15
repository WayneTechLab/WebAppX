import { useEffect, useRef, useState } from 'react'
import { usePortalWorkspaceBundle } from './PortalWorkspaceProvider'
import { RESTORE_POINTS_MAX, RESTORE_POINTS_LIMIT, type RestorePoint } from './restore-points'
import { summarizeWorkspaces } from './workspace-summaries'
import { portalById } from './registry'
import { previewRestoreBudget } from './restore-budget'
import { RestoreBudgetPreview } from './RestoreBudgetPreview'

const button = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
const scope = (point: RestorePoint) => point.modules.map(module => portalById[module].label).join(', ')

export function RestorePointHistory() {
  const { states, history, undo, clearHistory, refreshHistory } = usePortalWorkspaceBundle()
  const [pending, setPending] = useState<RestorePoint | null>(null)
  const [clearing, setClearing] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean; recoveryRequired?: boolean } | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const clearHeading = useRef<HTMLHeadingElement>(null)
  const historyHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (returnFocus.current && !pending && !clearing) {
      returnFocus.current = false
      const target = opener.current
      if (target?.isConnected && !target.disabled) target.focus()
      else historyHeading.current?.focus()
    } else if (pending) previewHeading.current?.focus()
    else if (clearing) clearHeading.current?.focus()
  }, [pending, clearing])

  function preview(point: RestorePoint, button: HTMLButtonElement) {
    opener.current = button
    refreshHistory()
    setClearing(false); setFeedback(null); setPending(point)
  }
  function cancel() {
    returnFocus.current = true
    setPending(null); setClearing(false)
    setFeedback({ message: 'Canceled. Workspaces and restore points are unchanged.', error: false })
  }
  function applyUndo() {
    if (!pending || !budget?.ok || !budget.canRestore) return
    const result = undo(pending.id)
    if (result.ok) { returnFocus.current = true; setPending(null) }
    setFeedback({ message: result.status.message, error: !result.ok, recoveryRequired: !result.ok && result.recoveryRequired })
  }
  function clear() {
    const result = clearHistory()
    if (result.ok) { returnFocus.current = true; setPending(null); setClearing(false) }
    setFeedback({ message: result.error || result.status, error: !result.ok })
  }
  function refresh() {
    setPending(null); setClearing(false); setFeedback(null)
    refreshHistory()
  }
  const before = pending && summarizeWorkspaces(pending.states)
  const current = summarizeWorkspaces(states)
  const budget = pending ? previewRestoreBudget(states, states, pending.modules, history, { sourcePointId: pending.id }) : null

  return <section aria-label="Restore points" className="mt-7 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Automatic recovery</p><h2 ref={historyHeading} tabIndex={-1} className="mt-2 text-2xl font-semibold text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Restore points &amp; Undo</h2></div>
      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{history.points.length} / {RESTORE_POINTS_MAX} points</span>
    </div>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-600">Before each combined selective restore or Undo, the selected portals’ current mock records are captured here. Choose a point to recover those portals. Undo also saves a point, so you can reverse it again.</p>
    <p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">Restore points survive refresh at this browser address. Up to {RESTORE_POINTS_MAX} points are kept within {RESTORE_POINTS_LIMIT.toLocaleString('en-US')} serialized characters; oldest points are removed as needed. A restore stops if its new point cannot be saved. Points contain readable fictional records and are excluded from exports. Unsaved forms, live timers, individual imports and resets are outside this history. Use fictional information only.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className={button} onClick={refresh}>Refresh restore points</button>
      <button type="button" className={button} disabled={!history.points.length && !history.error} aria-expanded={clearing} aria-controls={clearing ? 'clear-restore-points-preview' : undefined} onClick={event => { opener.current = event.currentTarget; setPending(null); setFeedback(null); setClearing(true) }}>Clear restore points</button>
    </div>
    {history.error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">{history.error}</p>}
    {!history.error && !history.points.length && <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">No restore points yet. Your next combined selective restore will create one automatically.</p>}
    {!!history.points.length && <ol aria-label="Saved restore points" className="mt-5 space-y-3">{history.points.map(point => <li key={point.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-neutral-200 p-4">
      <div><p className="text-sm font-semibold text-neutral-950">Before {point.kind === 'undo' ? 'Undo' : 'selective restore'} · {scope(point)}</p><p className="mt-1 break-words text-xs leading-5 text-neutral-500">Created at (UTC): <time dateTime={point.createdAt}>{point.createdAt}</time></p><p className="mt-2 text-xs leading-5 text-neutral-600">{point.modules.map(module => `${portalById[module].label}: ${summarizeWorkspaces(point.states)[module]}`).join(' / ')}</p></div>
      <button type="button" className={button} disabled={!!history.error} aria-expanded={pending?.id === point.id} aria-controls={pending?.id === point.id ? 'restore-point-undo-preview' : undefined} onClick={event => preview(point, event.currentTarget)} aria-label={`Undo restore point ${point.createdAt} ${scope(point)}`}>Undo…</button>
    </li>)}</ol>}
    {pending && before && <div id="restore-point-undo-preview" role="region" aria-label="Undo preview" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 ref={previewHeading} tabIndex={-1} className="text-lg font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Undo {scope(pending)}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-950">Recover the records captured at {pending.createdAt} (UTC), before {pending.kind === 'undo' ? 'Undo' : 'selective restore'}. This replaces the entire {scope(pending)} workspace{pending.modules.length > 1 ? 's' : ''}, including later saved edits, and clears their unsaved forms and timers. Other portals keep their current records.</p>
      <dl className="mt-3 space-y-3 text-sm">{pending.modules.map(module => <div key={module} className="rounded-md border border-amber-200 bg-white p-3"><dt className="font-semibold text-neutral-950">{portalById[module].label}</dt><dd className="mt-1 text-neutral-600"><span className="font-medium">Current:</span> {current[module]}</dd><dd className="mt-1 text-neutral-600"><span className="font-medium">Recover:</span> {before[module]}</dd></div>)}</dl>
      <p className="mt-3 text-sm leading-6 text-amber-950">A new restore point will save the affected portals before Undo is applied. Older points may be removed to keep history within its limit.</p>
      <RestoreBudgetPreview budget={budget} onRefresh={refreshHistory} />
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={`${primary} disabled:cursor-not-allowed disabled:bg-neutral-300`} disabled={!budget?.ok || !budget.canRestore} onClick={applyUndo}>Confirm undo</button><button type="button" className={button} onClick={cancel}>Cancel undo</button></div>
    </div>}
    {clearing && <div id="clear-restore-points-preview" role="region" aria-label="Clear restore points confirmation" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 ref={clearHeading} tabIndex={-1} className="text-lg font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Clear all restore points?</h3><p className="mt-2 text-sm leading-6 text-amber-950">This removes only the restore history at this browser address. HR, CMS and CRM workspaces and downloaded backups are preserved. Cleared restore points cannot be recovered here.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={primary} onClick={clear}>Confirm clear restore points</button><button type="button" className={button} onClick={cancel}>Keep restore points</button></div></div>}
    {feedback && <div role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${feedback.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><p>{feedback.message}</p>{feedback.recoveryRequired && <p className="mt-2 font-semibold">Keep this page open and export all workspaces before refreshing. Browser saves or restore history may need recovery.</p>}</div>}
  </section>
}
