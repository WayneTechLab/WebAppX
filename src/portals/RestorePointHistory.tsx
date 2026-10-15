import { useEffect, useRef, useState } from 'react'
import { usePortalWorkspaceBundle } from './PortalWorkspaceProvider'
import { RESTORE_POINTS_MAX, RESTORE_POINTS_LIMIT, type RestorePoint } from './restore-points'
import { summarizeWorkspaces } from './workspace-summaries'
import { portalById } from './registry'
import { previewRestoreBudget } from './restore-budget'
import { RestoreBudgetPreview } from './RestoreBudgetPreview'
import { ManualRestorePoint, RestorePointLabel } from './RestorePointControls'
import { WorkspaceDifferencePreview, WorkspaceInspection } from './WorkspaceInspection'

const button = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
const scope = (point: RestorePoint) => point.modules.map(module => portalById[module].label).join(', ')
const captureKind = (point: RestorePoint) => point.kind === 'manual' ? 'manual capture' : point.kind === 'undo' ? 'Undo' : point.kind === 'import' ? 'individual import' : point.kind === 'reset' ? 'portal Reset' : 'selective restore'

export function RestorePointHistory() {
  const { states, history, undo, clearHistory, createPoint, renamePoint, refreshHistory } = usePortalWorkspaceBundle()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pending = history.points.find(point => point.id === pendingId)
  const hasPending = Boolean(pending)
  const [clearing, setClearing] = useState(false)
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean; recoveryRequired?: boolean } | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const clearHeading = useRef<HTMLHeadingElement>(null)
  const historyHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (returnFocus.current && !hasPending && !clearing) {
      returnFocus.current = false
      const target = opener.current
      if (target?.isConnected && !target.disabled) target.focus()
      else historyHeading.current?.focus()
    } else if (hasPending) previewHeading.current?.focus()
    else if (clearing) clearHeading.current?.focus()
  }, [hasPending, pendingId, clearing])

  function preview(point: RestorePoint, button: HTMLButtonElement) {
    opener.current = button
    refreshHistory()
    setClearing(false); setFeedback(null); setPendingId(point.id)
  }
  function cancel() {
    returnFocus.current = true
    setPendingId(null); setClearing(false)
    setFeedback({ message: 'Canceled. Workspaces and restore points are unchanged.', error: false })
  }
  function applyUndo() {
    if (!pending || !budget?.ok || !budget.canRestore) return
    const result = undo(pending.id, pending)
    if (result.ok) { returnFocus.current = true; setPendingId(null) }
    setFeedback({ message: result.status.message, error: !result.ok, recoveryRequired: !result.ok && result.recoveryRequired })
  }
  function clear() {
    const result = clearHistory()
    if (result.ok) { returnFocus.current = true; setPendingId(null); setClearing(false) }
    setFeedback({ message: result.error || result.status, error: !result.ok })
  }
  function refresh() {
    setPendingId(null); setClearing(false); setFeedback(null)
    refreshHistory()
  }
  const before = pending && summarizeWorkspaces(pending.states)
  const current = summarizeWorkspaces(states)
  const budget = pending ? previewRestoreBudget(states, states, pending.modules, history, { sourcePointId: pending.id }) : null
  const inspected = history.points.find(point => point.id === inspectedId)

  return <section aria-label="Restore points" className="mt-7 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Automatic recovery</p><h2 ref={historyHeading} tabIndex={-1} className="mt-2 text-2xl font-semibold text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Restore points &amp; Undo</h2></div>
      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{history.points.length} / {RESTORE_POINTS_MAX} points</span>
    </div>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-600">Before each combined selective restore or Undo, the selected portals’ current mock records are captured here. Choose a point to recover those portals. Undo also saves a point, so you can reverse it again.</p>
    <p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">Restore points survive refresh at this browser address. Up to {RESTORE_POINTS_MAX} points are kept within {RESTORE_POINTS_LIMIT.toLocaleString('en-US')} serialized characters; oldest points are removed as needed. A restore stops if its new point cannot be saved. Points contain readable fictional records and are excluded from exports. Unsaved forms and live timers are outside this history. Individual imports and Reset create a point only when their separate checkpoint preference is enabled. Use fictional information only.</p>
    <ManualRestorePoint states={states} history={history} onCreate={createPoint} onResult={result => setFeedback({ message: result.status.message, error: !result.ok, recoveryRequired: !result.ok && result.recoveryRequired })} />
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className={button} onClick={refresh}>Refresh restore points</button>
      <button type="button" className={button} disabled={!history.points.length && !history.error} aria-expanded={clearing} aria-controls={clearing ? 'clear-restore-points-preview' : undefined} onClick={event => { opener.current = event.currentTarget; setPendingId(null); setFeedback(null); setClearing(true) }}>Clear restore points</button>
    </div>
    {history.error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">{history.error}</p>}
    {!history.error && !history.points.length && <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">No restore points yet. Create a named point above, or your next combined selective restore will create one automatically.</p>}
    {!!history.points.length && <ol aria-label="Saved restore points" className="mt-5 space-y-3">{history.points.map(point => <li key={point.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-neutral-200 p-4">
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-neutral-950">{point.label ?? `${point.kind === 'manual' ? 'Saved' : 'Before'} ${captureKind(point)}`} · {scope(point)}</p><p className="mt-1 text-xs leading-5 text-neutral-600">{point.label && `${captureKind(point)} · `}Captured records only; labels do not change the capture.</p><p className="mt-1 break-words text-xs leading-5 text-neutral-500">Created at (UTC): <time dateTime={point.createdAt}>{point.createdAt}</time></p><p className="mt-2 text-xs leading-5 text-neutral-600">{point.modules.map(module => `${portalById[module].label}: ${summarizeWorkspaces(point.states)[module]}`).join(' / ')}</p><RestorePointLabel key={`${point.id}:${point.label ?? ''}`} point={point} disabled={!!history.error} onSave={label => {
        const result = renamePoint(point.id, label)
        setFeedback({ message: result.status.message, error: !result.ok, recoveryRequired: !result.ok && result.recoveryRequired })
      }} /></div>
      <button type="button" className={button} aria-expanded={inspected?.id === point.id} aria-controls={inspected?.id === point.id ? 'restore-point-details' : undefined} onClick={() => setInspectedId(previous => previous === point.id ? null : point.id)}>Inspect captured records</button>
      <button type="button" className={button} disabled={!!history.error} aria-expanded={pending?.id === point.id} aria-controls={pending?.id === point.id ? 'restore-point-undo-preview' : undefined} onClick={event => preview(point, event.currentTarget)} aria-label={`Undo restore point ${point.createdAt} ${scope(point)}`}>Undo…</button>
    </li>)}</ol>}
    {inspected && <div id="restore-point-details" className="mt-5"><WorkspaceInspection states={inspected.states} modules={inspected.modules} title="Captured restore-point records" /></div>}
    {pendingId && !pending && <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950">This restore point is no longer available in the current history. Refresh the list and choose an existing point. No workspace was changed.<button type="button" className={`${button} ml-3`} onClick={cancel}>Dismiss unavailable point</button></div>}
    {pending && before && <div id="restore-point-undo-preview" role="region" aria-label="Undo preview" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 ref={previewHeading} tabIndex={-1} className="text-lg font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Undo {scope(pending)}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-950">Recover the records captured at {pending.createdAt} (UTC), {pending.kind === 'manual' ? 'in a named manual point' : `before ${captureKind(pending)}`}. This replaces the entire {scope(pending)} workspace{pending.modules.length > 1 ? 's' : ''}, including later saved edits. A dirty CMS editor is retained for an explicit comparison decision before saving; other selected temporary forms and timers are cleared. Other portals keep their current records.</p>
      <dl className="mt-3 space-y-3 text-sm">{pending.modules.map(module => <div key={module} className="rounded-md border border-amber-200 bg-white p-3"><dt className="font-semibold text-neutral-950">{portalById[module].label}</dt><dd className="mt-1 text-neutral-600"><span className="font-medium">Current:</span> {current[module]}</dd><dd className="mt-1 text-neutral-600"><span className="font-medium">Recover:</span> {before[module]}</dd></div>)}</dl>
      <p className="mt-3 text-sm leading-6 text-amber-950">A new restore point will save the affected portals before Undo is applied. Older points may be removed to keep history within its limit.</p>
      <RestoreBudgetPreview budget={budget} onRefresh={refreshHistory} />
      <WorkspaceDifferencePreview current={states} target={{ ...states, ...pending.states }} modules={pending.modules} title="Undo workspace differences" />
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={`${primary} disabled:cursor-not-allowed disabled:bg-neutral-300`} disabled={!budget?.ok || !budget.canRestore} onClick={applyUndo}>Confirm undo</button><button type="button" className={button} onClick={cancel}>Cancel undo</button></div>
    </div>}
    {clearing && <div id="clear-restore-points-preview" role="region" aria-label="Clear restore points confirmation" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 ref={clearHeading} tabIndex={-1} className="text-lg font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Clear all restore points?</h3><p className="mt-2 text-sm leading-6 text-amber-950">This removes only the restore history at this browser address. HR, CMS and CRM workspaces and downloaded backups are preserved. Cleared restore points cannot be recovered here.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={primary} onClick={clear}>Confirm clear restore points</button><button type="button" className={button} onClick={cancel}>Keep restore points</button></div></div>}
    {feedback && <div role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${feedback.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><p>{feedback.message}</p>{feedback.recoveryRequired && <p className="mt-2 font-semibold">Keep this page open and export all workspaces before refreshing. Browser saves or restore history may need recovery.</p>}</div>}
  </section>
}
