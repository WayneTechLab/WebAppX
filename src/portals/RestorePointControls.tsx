import { useId, useState } from 'react'
import { portalById, portalIds } from './registry'
import type { DemoModule } from './persistence'
import type { DemoWorkspaces } from './workspaces'
import { previewManualRestorePoint, RESTORE_POINT_LABEL_MAX, type HistoryMutationResult, type RestorePoint, type RestorePointsLoad } from './restore-points'

const control = 'min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
const button = `${control} font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50`

export function ManualRestorePoint({ states, history, onCreate, onResult }: {
  states: DemoWorkspaces
  history: RestorePointsLoad
  onCreate: (selected: readonly DemoModule[], label: string) => HistoryMutationResult
  onResult: (result: HistoryMutationResult) => void
}) {
  const nameId = useId()
  const [label, setLabel] = useState('')
  const [selected, setSelected] = useState<DemoModule[]>([])
  const preview = selected.length && label.trim() ? previewManualRestorePoint(states, selected, label, history) : null
  return <form aria-label="Create named restore point" className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4" noValidate onSubmit={event => {
    event.preventDefault()
    if (!preview?.ok || !preview.canCreate) return
    const result = onCreate(selected, label)
    if (result.ok) { setLabel(''); setSelected([]) }
    onResult(result)
  }}>
    <h3 className="text-base font-semibold text-neutral-950">Save a point without restoring</h3>
    <p className="mt-2 text-sm leading-6 text-neutral-600">Name a snapshot of the selected portals’ current records. This saves only restore-point history. Your open workspaces, workspace saves and unsaved forms stay unchanged.</p>
    <label htmlFor={nameId} className="mt-3 block text-sm font-semibold text-neutral-900">Restore point name</label>
    <input id={nameId} value={label} maxLength={RESTORE_POINT_LABEL_MAX} onChange={event => setLabel(event.target.value)} className={`${control} mt-1 w-full max-w-lg`} aria-required="true" autoComplete="off" />
    <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2"><legend className="mb-1 text-sm font-semibold text-neutral-900">Portals to capture</legend>{portalIds.map(module => <label key={module} className="flex min-h-11 items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={selected.includes(module)} onChange={event => setSelected(previous => event.target.checked ? portalIds.filter(id => previous.includes(id) || id === module) : previous.filter(id => id !== module))} className="h-4 w-4 accent-emerald-800" />Capture {portalById[module].label}</label>)}</fieldset>
    {preview?.ok && <div role="region" aria-label="Named restore point storage preview" className="mt-3 rounded-md border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-700">
      <p>History after capture: <strong>{preview.retainedPoints} points</strong> · {preview.projectedHistoryCharacters.toLocaleString('en-US')} / {preview.historyLimit.toLocaleString('en-US')} serialized characters.</p>
      <p>{preview.prunedPoints ? `${preview.prunedPoints} older point${preview.prunedPoints === 1 ? '' : 's'} will be removed to retain this capture.` : 'No older points will be removed.'} Browser storage availability is checked when saving.</p>
      {!preview.canCreate && <p role="alert" className="mt-2 font-semibold text-red-900">{preview.reason}</p>}
    </div>}
    {preview && !preview.ok && <p role="alert" className="mt-3 text-sm leading-6 text-red-900">{preview.message}</p>}
    <button type="submit" className={`${button} mt-4`} disabled={!preview?.ok || !preview.canCreate}>Create named restore point</button>
  </form>
}

export function RestorePointLabel({ point, disabled, onSave }: { point: RestorePoint; disabled: boolean; onSave: (label: string) => void }) {
  const inputId = useId()
  const [label, setLabel] = useState(point.label ?? '')
  return <form aria-label={`Rename restore point ${point.id}`} className="mt-3 flex flex-wrap items-end gap-2" noValidate onSubmit={event => { event.preventDefault(); onSave(label) }}>
    <div><label htmlFor={inputId} className="block text-xs font-semibold text-neutral-700">Point label</label><input id={inputId} value={label} maxLength={RESTORE_POINT_LABEL_MAX} disabled={disabled} onChange={event => setLabel(event.target.value)} className={`${control} mt-1 w-full sm:w-64`} autoComplete="off" /></div>
    <button type="submit" className={button} disabled={disabled || !label.trim() || label.trim() === point.label}>Save point label</button>
  </form>
}
