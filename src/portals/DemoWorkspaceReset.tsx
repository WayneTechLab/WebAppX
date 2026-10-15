import { useState, type ReactNode } from 'react'
import type { DemoModule, DemoStorageStatus } from './persistence'
import { portalById } from './registry'
import type { WorkspaceRecoveryControls } from './recovery-preferences'
import { RecoveryCheckpointPreview } from './RecoveryCheckpointPreview'

const button = 'inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'

/** Adopted providers can omit recovery; their original one-click Reset stays usable. */
export function DemoWorkspaceReset({ module, recovery, onReset, children, className = button }: {
  module: DemoModule
  recovery?: WorkspaceRecoveryControls
  onReset: (confirmation?: string) => { ok: boolean; status: DemoStorageStatus } | void
  children?: ReactNode
  className?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const preview = confirming && recovery ? recovery.previewReset() : undefined
  function apply() {
    const result = onReset(preview?.confirmation)
    if (result) {
      if (result.ok) setConfirming(false)
      setFeedback({ message: result.status.message, error: !result.ok })
    } else setConfirming(false)
  }
  function start() {
    setFeedback(null)
    if (recovery && (recovery.settings.error || recovery.settings.preferences.beforeReset)) setConfirming(true)
    else apply()
  }
  return <div>
    <button type="button" onClick={start} className={className}>{children ?? `Reset ${portalById[module].label} demo`}</button>
    {confirming && <div role="region" aria-label={`${portalById[module].label} Reset confirmation`} className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-semibold text-amber-950">Reset {portalById[module].label} workspace?</h2>
      <p className="mt-2 text-sm leading-6 text-amber-950">{preview?.required ? `This captures the complete current ${portalById[module].label} records first, then restores` : 'This restores'} its original fictional records and removes only its browser save. Unsaved forms and timers are not captured. Other portals remain unchanged.</p>
      {preview && <RecoveryCheckpointPreview preview={preview} />}
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={button} disabled={!preview?.ok || !preview.canReplace} onClick={apply}>Confirm Reset {portalById[module].label}</button><button type="button" className={button} onClick={() => { setConfirming(false); setFeedback({ message: 'Reset canceled. Workspace saves and history are unchanged.', error: false }) }}>Keep {portalById[module].label} workspace</button></div>
    </div>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className="mt-2 text-sm leading-6">{feedback.message}</p>}
  </div>
}
