import { useRef, useState, type ChangeEvent } from 'react'
import { createDemoBackup, parseDemoBackup, DEMO_BACKUP_FILE_LIMIT, type DemoBackup } from './backup'
import type { DemoModule, DemoStorageStatus } from './persistence'
import { portalById } from './registry'
import type { WorkspaceRecoveryControls } from './recovery-preferences'
import { RecoveryCheckpointPreview } from './RecoveryCheckpointPreview'

const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50'

export function DemoWorkspaceBackup<T>({ module, state, validate, summarize, onImport, recovery }: {
  module: DemoModule; state: T; validate: (value: unknown) => value is T;
  summarize: (value: T) => string;
  onImport: (value: T, confirmation?: string) => { ok: boolean; status: DemoStorageStatus };
  recovery?: WorkspaceRecoveryControls;
}) {
  const input = useRef<HTMLInputElement>(null)
  const selection = useRef(0)
  const [pending, setPending] = useState<{ backup: DemoBackup<T>; filename: string } | null>(null)
  const [reading, setReading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const title = portalById[module].label
  const checkpoint = pending && recovery ? recovery.previewImport(pending.backup.state) : undefined

  function download() {
    try {
      const exportedAt = new Date().toISOString()
      const json = createDemoBackup(module, state, validate, exportedAt)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `webappx-${module}-mock-${exportedAt.replace(/[:.]/g, '-')}.json`
      document.body.append(link)
      try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
      setFeedback({ message: `${title} backup download started. It contains this portal's fictional records, saved drafts and receipts.`, error: false })
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'This workspace could not be exported.', error: true }) }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const token = ++selection.current
    setPending(null); setFeedback(null); setReading(true)
    try {
      if (file.size > DEMO_BACKUP_FILE_LIMIT) throw new Error('This backup file is too large. Choose a smaller WebAppX workspace export.')
      const text = await file.text()
      if (token !== selection.current) return
      const backup = parseDemoBackup(text, module, validate)
      setPending({ backup, filename: file.name })
    } catch (error) {
      if (token === selection.current) setFeedback({ message: `${error instanceof Error ? error.message : 'This file could not be read.'} Current workspace unchanged.`, error: true })
    } finally { if (token === selection.current) setReading(false) }
  }

  function cancel() {
    selection.current += 1
    setPending(null); setReading(false)
    setFeedback({ message: 'Import canceled. Current workspace unchanged.', error: false })
  }

  function replace() {
    if (!pending) return
    const result = onImport(pending.backup.state, checkpoint?.confirmation)
    if (result.ok) setPending(null)
    setFeedback({ message: result.status.message, error: !result.ok })
  }

  return <section aria-label={`${title} workspace backup`} className="mt-5 rounded-xl border border-neutral-200 bg-white p-5">
    <h2 className="text-lg font-semibold text-neutral-950">Back up this workspace</h2>
    <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600">Export {title}'s fictional records to a JSON file, then import it in this portal in another browser. Files stay on your device; nothing is uploaded. Import replaces this portal's records. The other portals stay separate.</p>
    <p className="mt-2 text-xs leading-5 text-neutral-500">Backups are readable text, including saved private review drafts and survey answers where present. Use fictional data only. Unsaved fields and running timers are excluded. Export your current workspace before replacing it if you want to keep both versions.</p>
    {recovery && <fieldset className="mt-4 rounded-lg border border-neutral-200 p-3">
      <legend className="px-1 text-sm font-semibold text-neutral-900">Optional required checkpoints</legend>
      <p className="mb-3 text-xs leading-5 text-neutral-500">Both settings start off. Each applies to all native portals at this browser origin, survives refresh and stays outside workspace exports and restore-point history. When enabled, replacement refuses if its checkpoint cannot be saved.</p>
      {recovery.settings.error && <p role="alert" className="mb-3 text-sm leading-6 text-red-900">{recovery.settings.error} Choose the settings below explicitly; a successful setting change saves both choices shown.</p>}
      {(['beforeImport', 'beforeReset'] as const).map(preference => <label key={preference} className="mt-2 flex min-h-11 items-center gap-3 text-sm text-neutral-800"><input type="checkbox" checked={recovery.settings.preferences[preference]} onChange={event => {
        const result = recovery.setPreference(preference, event.currentTarget.checked)
        setFeedback({ message: result.status.message, error: !result.ok })
      }} />{preference === 'beforeImport' ? 'Require checkpoint before individual imports' : 'Require checkpoint before Reset'}</label>)}
    </fieldset>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className={secondary} onClick={download}>Export workspace</button>
      <button type="button" className={secondary} onClick={() => input.current?.click()} disabled={reading}>Import workspace</button>
      <input ref={input} hidden type="file" accept=".json,application/json" aria-label={`${title} backup JSON file`} onChange={chooseFile} />
      {reading && <><p role="status" className="self-center text-sm text-neutral-600">Reading local backup…</p><button type="button" className={secondary} onClick={cancel}>Cancel import</button></>}
    </div>
    {pending && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-950">Ready to replace {title} workspace</h3>
      <dl className="mt-3 grid gap-x-5 gap-y-2 break-words text-sm text-amber-950 sm:grid-cols-[auto_1fr]"><dt className="font-medium">File</dt><dd>{pending.filename}</dd><dt className="font-medium">Exported at (UTC)</dt><dd>{pending.backup.exportedAt}</dd><dt className="font-medium">Backup records</dt><dd>{summarize(pending.backup.state)}</dd></dl>
      <p className="mt-3 text-sm leading-6 text-amber-950">This replaces the current {title} mock workspace and its browser save. It does not merge records. Continue only if this is the backup you want to use.</p>
      {checkpoint && <RecoveryCheckpointPreview preview={checkpoint} />}
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="inline-flex min-h-11 items-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={checkpoint !== undefined && (!checkpoint.ok || !checkpoint.canReplace)} onClick={replace}>Replace {title} workspace</button><button type="button" className={secondary} onClick={cancel}>Cancel import</button></div>
    </div>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${feedback.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>{feedback.message}</p>}
  </section>
}
