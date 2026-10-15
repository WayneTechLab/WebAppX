import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createCombinedBackup, parseCombinedBackup, COMBINED_BACKUP_FILE_LIMIT } from './combined-backup'
import { usePortalWorkspaceBundle } from './PortalWorkspaceProvider'
import type { DemoModule } from './persistence'
import type { DemoWorkspaces } from './workspaces'
import { summarizeWorkspaces } from './workspace-summaries'
import { portalById, portalIds } from './registry'
import { previewRestoreBudget } from './restore-budget'
import { RestoreBudgetPreview } from './RestoreBudgetPreview'

const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'

export function CombinedWorkspaceBackup() {
  const { states, restore, history, refreshHistory } = usePortalWorkspaceBundle()
  const input = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef(false)
  const selection = useRef(0)
  const [reading, setReading] = useState(false)
  const [pending, setPending] = useState<{ states: DemoWorkspaces; exportedAt: string; filename: string } | null>(null)
  const [selected, setSelected] = useState<DemoModule[]>([])
  const [feedback, setFeedback] = useState<{ message: string; error: boolean; recoveryRequired?: boolean } | null>(null)

  useEffect(() => {
    if (returnFocus.current && !pending && !reading) {
      returnFocus.current = false
      importButton.current?.focus()
    } else if (pending) previewHeading.current?.focus()
  }, [pending, reading])

  function download() {
    try {
      const exportedAt = new Date().toISOString()
      const json = createCombinedBackup(states, exportedAt)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `webappx-all-mock-workspaces-${exportedAt.replace(/[:.]/g, '-')}.json`
      document.body.append(link)
      try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
      setFeedback({ message: 'Combined backup download started. One file contains HR, CMS and CRM, including saved mock drafts and receipts.', error: false })
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'The combined backup could not be exported.', error: true }) }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const token = ++selection.current
    setPending(null); setSelected([]); setFeedback(null); setReading(true)
    try {
      if (file.size > COMBINED_BACKUP_FILE_LIMIT) throw new Error('The combined backup file is too large.')
      const text = await file.text()
      if (token !== selection.current) return
      const backup = parseCombinedBackup(text)
      refreshHistory()
      setPending({ ...backup, filename: file.name })
    } catch (error) {
      if (token === selection.current) {
        returnFocus.current = true
        setFeedback({ message: `${error instanceof Error ? error.message : 'This file could not be read.'} Current workspaces unchanged.`, error: true })
      }
    } finally { if (token === selection.current) setReading(false) }
  }

  function cancel() {
    returnFocus.current = true
    selection.current += 1
    setPending(null); setSelected([]); setReading(false)
    setFeedback({ message: 'Combined restore canceled. Current workspaces unchanged.', error: false })
  }

  function apply() {
    if (!pending || !selected.length || !budget?.ok || !budget.canRestore) return
    const result = restore(pending.states, selected)
    if (result.ok) { returnFocus.current = true; setPending(null); setSelected([]) }
    setFeedback({ message: result.status.message, error: !result.ok, recoveryRequired: !result.ok && result.recoveryRequired })
  }
  const details = pending && summarizeWorkspaces(pending.states)
  const budget = pending && selected.length ? previewRestoreBudget(states, pending.states, selected, history) : null

  return <section aria-label="Combined workspace backup" className="mt-7 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">HR · CMS · CRM</p>
    <h2 className="mt-2 text-2xl font-semibold text-neutral-950">Back up all workspaces</h2>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-600">Download one JSON file with all three current mock workspaces. Import a combined file to choose which portals to restore. Original sample records are included for portals you have not changed.</p>
    <p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">Files contain readable fictional data, including saved private review drafts, survey answers and receipts. Unsaved fields, running timers, restore points and the separate SDK session are excluded. Nothing is uploaded and no account is needed. Each selective restore first saves a restore point for the selected portals. Use Export all workspaces for a separate backup you can keep.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} onClick={download}>Export all workspaces</button><button ref={importButton} type="button" className={secondary} disabled={reading} aria-expanded={Boolean(pending)} aria-controls={pending ? 'combined-restore-preview' : undefined} onClick={() => input.current?.click()}>Import combined backup</button><input hidden ref={input} type="file" accept=".json,application/json" aria-label="Combined backup JSON file" onChange={chooseFile} />{reading && <><p role="status" className="self-center text-sm text-neutral-600">Reading combined backup…</p><button type="button" className={secondary} onClick={cancel}>Cancel combined restore</button></>}</div>
    {pending && details && <div id="combined-restore-preview" role="region" aria-label="Selective restore preview" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 ref={previewHeading} tabIndex={-1} className="text-lg font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Choose workspaces to restore</h3>
      <dl className="mt-3 grid gap-x-5 gap-y-2 break-words text-sm text-amber-950 sm:grid-cols-[auto_1fr]"><dt className="font-medium">File</dt><dd>{pending.filename}</dd><dt className="font-medium">Exported at (UTC)</dt><dd>{pending.exportedAt}</dd></dl>
      <fieldset className="mt-4 space-y-2"><legend className="text-sm font-semibold text-amber-950">Workspaces to restore</legend>{portalIds.map(module => <label key={module} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-white p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-800" checked={selected.includes(module)} onChange={event => { refreshHistory(); setSelected(previous => event.target.checked ? [...previous, module] : previous.filter(value => value !== module)) }} /><span><span className="block text-sm font-semibold text-neutral-950">Restore {portalById[module].label}</span><span className="mt-1 block text-xs leading-5 text-neutral-600">{details[module]}</span></span></label>)}</fieldset>
      <p className="mt-3 text-sm leading-6 text-amber-950">{selected.length ? `${selected.map(module => portalById[module].label).join(', ')} will be replaced and saved after an automatic restore point is saved. Unchecked portals keep their current records.` : 'Select at least one workspace. Nothing is selected automatically.'} Restore replaces entire selected workspaces and clears their unsaved forms and timers. It does not merge records.</p>
      <RestoreBudgetPreview budget={budget} onRefresh={refreshHistory} />
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!selected.length || !budget?.ok || !budget.canRestore} className="inline-flex min-h-11 items-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-neutral-300" onClick={apply}>Restore selected workspaces</button><button type="button" className={secondary} onClick={cancel}>Cancel combined restore</button></div>
    </div>}
    {feedback && <div role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${feedback.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><p>{feedback.message}</p>{feedback.recoveryRequired && <p className="mt-2 font-semibold">Browser saves may have changed. Keep this page open and export all workspaces before refreshing, then retry the restore when browser storage is available.</p>}</div>}
  </section>
}
