import { useRef, useState, type FormEvent } from 'react'
import { useUnsavedTransition, useUnsavedWork } from '@/portals/unsaved-work'
import { scopedEmployees, type HrActor, type HrEmployee, type HrFixture } from '../model'
import type { HrDemoState } from '../persistence'
import { confirmHrLifecycle, effectiveHrFixture, lifecycleView, previewHrLifecycle } from '../lifecycle'
import type { HrCorrectionRequest, HrLifecycleAction, HrLifecyclePreview } from '../lifecycle-types'
import { createHrFormDraft, focusHrForm, normalizeHrFormValue } from './useHrFormDraft'

const panel = 'rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'
const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'

type Props = {
  state: HrDemoState
  actor: HrActor
  baseFixture: HrFixture
  employeeId?: string
  onAction: (update: (current: HrDemoState) => HrDemoState) => boolean
}
type EmailFields = { workEmail: string; simulationDate: string }
type ReviewFields = { outcome: 'accepted' | 'rejected'; reason: string; simulationDate: string }
const actorLabel = (actor: HrActor) => `${actor.role}${actor.employeeId ? ` · ${actor.employeeId}` : ''}`
const emailGroup = (mode: 'request' | 'edit', employeeId: string) => `hr:directory:${mode}:${employeeId}`
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The sample directory action was refused. Your inputs are kept.'

/** Use the shared synchronous baseline controller. Discard also drops the
 * companion preview, so a discarded value can never be confirmed on return. */
function useDirectoryDraft<T>({ id, label, initial }: { id: string; label: string; initial: T }) {
  const [controller] = useState(() => createHrFormDraft(initial, normalizeHrFormValue))
  const [value, render] = useState(initial)
  const [pending, renderPending] = useState<HrLifecyclePreview | null>(null)
  const pendingRef = useRef<HrLifecyclePreview | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  function setPending(preview: HrLifecyclePreview | null) { pendingRef.current = preview; renderPending(preview) }
  function change(next: T | ((previous: T) => T)) {
    render(controller.change(next)); setPending(null); setError(''); setMessage('')
  }
  function accept(next: T) { render(controller.accept(next)); setPending(null); setError('') }
  function refuse(error: unknown) { setPending(null); setError(errorMessage(error)); setMessage('') }
  useUnsavedWork({ id, portal: 'hr', label, isDirty: controller.isDirty, discard: () => {
    render(controller.discard()); setPending(null); setError(''); setMessage('')
  }, focus: () => focusHrForm(id) })
  return { id, value, read: controller.value, change, accept, pending, pendingRef, setPending, error, message, setError, setMessage, refuse }
}

function DirectoryPreview({ preview, title, onConfirm, onCancel }: {
  preview: HrLifecyclePreview; title: string; onConfirm: () => void; onCancel: () => void
}) {
  return <section role="region" aria-label={title} className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <h4 className="font-semibold text-neutral-950">{title}</h4>
    <dl className="mt-3 grid gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-[auto_1fr]">
      <dt className="font-medium">Previous work email</dt><dd>{typeof preview.previous === 'string' ? preview.previous : 'Unavailable'}</dd>
      <dt className="font-medium">Proposed work email</dt><dd>{typeof preview.proposed === 'string' ? preview.proposed : 'Unavailable'}</dd>
      <dt className="font-medium">Simulation date</dt><dd>{preview.action.simulationDate}</dd>
      {preview.action.type === 'review-correction' && <><dt className="font-medium">Review outcome</dt><dd>{preview.action.outcome}</dd><dt className="font-medium">Outcome reason</dt><dd className="whitespace-pre-wrap">{preview.action.reason}</dd></>}
    </dl>
    <p className="mt-3 text-xs leading-5 text-neutral-600">Preview has changed no workspace record. Confirmation rechecks the current complete HR source, action and preview identity. Changed facts require another preview.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={onConfirm}>Confirm {title.toLowerCase()}</button><button type="button" className={secondary} onClick={onCancel}>Cancel {title.toLowerCase()}</button></div>
  </section>
}

function EmailCorrectionForm({ state, actor, baseFixture, onAction, employee, mode, simulationDate }: Props & {
  employee: HrEmployee; mode: 'request' | 'edit'; simulationDate: string
}) {
  const requesting = mode === 'request'
  const label = requesting ? 'Propose work email correction' : 'Edit directory work email'
  const title = requesting ? 'Correction request preview' : 'Directory edit preview'
  const draft = useDirectoryDraft<EmailFields>({ id: emailGroup(mode, employee.id), label, initial: { workEmail: employee.workEmail, simulationDate } })
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = draft.read()
    if (!/^[^\s@]+@[^\s@]+\.invalid$/i.test(values.workEmail.trim())) { draft.refuse(new Error('Use a fictional work email ending in .invalid.')); return }
    const action: HrLifecycleAction = { type: requesting ? 'request-correction' : 'edit-directory', employeeId: employee.id, ...values }
    try { draft.setPending(previewHrLifecycle(state, actor, action, baseFixture)); draft.setError(''); draft.setMessage('') }
    catch (error) { draft.refuse(error) }
  }
  function confirm() {
    const pending = draft.pendingRef.current
    if (!pending) return
    try {
      let computed = false
      const accepted = onAction(current => { const next = confirmHrLifecycle(current, actor, pending.action, pending.confirmation, baseFixture); computed = true; return next })
      if (!accepted || !computed) { draft.refuse(new Error('The current HR action was refused. Preview again; your inputs are kept.')); return }
      const values = draft.read()
      draft.accept({ simulationDate: values.simulationDate, workEmail: requesting ? employee.workEmail : values.workEmail.trim() })
      draft.setMessage(requesting ? 'Sample correction requested. The directory email is unchanged until HR accepts it.' : 'Sample directory email saved with its previous value, new value and preview actor in change history.')
      focusHrForm(draft.id)
    } catch (error) { draft.refuse(error) }
  }
  return <form id={draft.id} aria-label={label} className="mt-4 space-y-4" noValidate onSubmit={preview}>
    <p className="text-sm text-neutral-600">{employee.firstName} {employee.lastName} · {employee.id}<span className="mt-1 block break-all">Current directory email: {employee.workEmail}</span></p>
    <label className="block text-sm font-medium">{requesting ? 'Proposed work email' : 'New directory work email'}<input className={field} type="email" required maxLength={160} value={draft.value.workEmail} onChange={event => draft.change(previous => ({ ...previous, workEmail: event.target.value }))} autoComplete="off" /><span className="mt-1 block text-xs text-neutral-500">Use fictional .invalid addresses only. Email case is retained; surrounding whitespace is normalized.</span></label>
    <label className="block text-sm font-medium">Simulation date<input className={field} type="date" required value={draft.value.simulationDate} onChange={event => draft.change(previous => ({ ...previous, simulationDate: event.target.value }))} /><span className="mt-1 block text-xs text-neutral-500">Choose the sample date explicitly. No employment date is inferred from the clock.</span></label>
    <button type="submit" className={button}>{requesting ? 'Preview correction request' : 'Preview directory edit'}</button>
    {draft.pending && <DirectoryPreview preview={draft.pending} title={title} onConfirm={confirm} onCancel={() => { draft.setPending(null); focusHrForm(draft.id) }} />}
    {draft.error && <p role="alert" className="break-words text-sm text-red-900">{draft.error}</p>}
    {draft.message && <p role="status" className="break-words text-sm text-emerald-900">{draft.message}</p>}
  </form>
}

function CorrectionReviewForm({ state, actor, baseFixture, onAction, correction, simulationDate }: Props & {
  correction: HrCorrectionRequest; simulationDate: string
}) {
  const draft = useDirectoryDraft<ReviewFields>({ id: `hr:directory:review:${correction.id}`, label: `Review directory correction ${correction.id}`, initial: { outcome: 'accepted', reason: '', simulationDate } })
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const action: HrLifecycleAction = { type: 'review-correction', correctionId: correction.id, ...draft.read() }
    try { draft.setPending(previewHrLifecycle(state, actor, action, baseFixture)); draft.setError(''); draft.setMessage('') }
    catch (error) { draft.refuse(error) }
  }
  function confirm() {
    const pending = draft.pendingRef.current
    if (!pending) return
    try {
      let computed = false
      const accepted = onAction(current => { const next = confirmHrLifecycle(current, actor, pending.action, pending.confirmation, baseFixture); computed = true; return next })
      if (!accepted || !computed) { draft.refuse(new Error('The current HR review was refused. Preview again; your inputs are kept.')); return }
      draft.accept({ ...draft.read(), reason: '' })
      draft.setMessage('Sample correction outcome recorded. Rejection leaves the directory unchanged; acceptance records the email change atomically.')
      window.requestAnimationFrame(() => {
        const heading = document.getElementById(`hr-directory-correction-${correction.id}`)
        if (heading?.getClientRects().length && !heading.closest('[hidden]')) heading.focus()
      })
    } catch (error) { draft.refuse(error) }
  }
  return <form id={draft.id} aria-label={`Review directory correction ${correction.id}`} className="mt-4 space-y-4 border-t border-neutral-200 pt-4" noValidate onSubmit={preview}>
    <label className="block text-sm font-medium">Correction outcome<select className={field} value={draft.value.outcome} onChange={event => draft.change(previous => ({ ...previous, outcome: event.target.value as ReviewFields['outcome'] }))}><option value="accepted">Accept correction</option><option value="rejected">Reject correction</option></select></label>
    <label className="block text-sm font-medium">Correction outcome reason<textarea className={field} required minLength={2} maxLength={500} rows={2} value={draft.value.reason} onChange={event => draft.change(previous => ({ ...previous, reason: event.target.value }))} placeholder="Describe the fictional review outcome" /></label>
    <label className="block text-sm font-medium">Simulation date<input className={field} type="date" required value={draft.value.simulationDate} onChange={event => draft.change(previous => ({ ...previous, simulationDate: event.target.value }))} /></label>
    <button type="submit" className={button}>Preview correction outcome</button>
    {draft.pending && <DirectoryPreview preview={draft.pending} title="Correction outcome preview" onConfirm={confirm} onCancel={() => { draft.setPending(null); focusHrForm(draft.id) }} />}
    {draft.error && <p role="alert" className="break-words text-sm text-red-900">{draft.error}</p>}
    {draft.message && <p role="status" className="break-words text-sm text-emerald-900">{draft.message}</p>}
  </form>
}

export function HrDirectoryCorrections({ state, actor, baseFixture, onAction, employeeId }: Props) {
  const fixture = effectiveHrFixture(state, baseFixture)
  const permitted = scopedEmployees(actor, fixture.employees)
  const employees = employeeId === undefined ? permitted : permitted.filter(employee => employee.id === employeeId)
  const visibleIds = new Set(employees.map(employee => employee.id))
  const view = lifecycleView(state, baseFixture)
  const corrections = view.corrections.filter(correction => visibleIds.has(correction.employeeId))
  const history = view.directoryHistory.filter(change => visibleIds.has(change.employeeId))
  const manage = ['employer-owner', 'hr-admin'].includes(actor.role)
  const own = ['employee', 'manager'].includes(actor.role) ? employees.find(employee => employee.id === actor.employeeId) : undefined
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => employees[0]?.id ?? '')
  const selected = employees.find(employee => employee.id === selectedEmployeeId) ?? employees[0]
  const request = useUnsavedTransition()
  const simulationDate = view.simulationDate ?? ''
  const person = (id: string) => { const employee = employees.find(person => person.id === id); return employee ? `${employee.firstName} ${employee.lastName} · ${id}` : id }
  const shared = { state, actor, baseFixture, onAction }
  return <section aria-label="Directory corrections and history" className="min-w-0 max-w-full space-y-6">
    <header className={panel}><h2 className="text-xl font-semibold text-neutral-950">Directory corrections and history</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Propose a fictional work-email correction, review its recorded outcome and inspect saved old/new values. Preview identities are local workflow inputs, not authenticated authority. No email, account or provider record is changed.</p>{!employees.length && <p className="mt-3 text-sm text-neutral-600">{employeeId === undefined ? 'No employee directory records are available in this preview scope.' : 'No authorized employee matches this page target.'}</p>}</header>
    {own && <section className={panel}><h3 className="text-lg font-semibold">Propose your directory correction</h3><EmailCorrectionForm key={`request:${own.id}`} {...shared} employee={own} mode="request" simulationDate={simulationDate} /></section>}
    {manage && selected && <section className={panel}><h3 className="text-lg font-semibold">Direct directory email edit</h3>{employeeId === undefined && <label className="mt-4 block text-sm font-medium">Directory employee<select className={field} value={selected.id} onChange={event => { const employeeId = event.target.value; request({ portal: 'hr', ids: [emailGroup('edit', selected.id)], label: 'Change directory employee' }, () => setSelectedEmployeeId(employeeId)) }}>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.id}</option>)}</select></label>}<EmailCorrectionForm key={`edit:${selected.id}`} {...shared} employee={selected} mode="edit" simulationDate={simulationDate} /></section>}
    <section className={panel}><h3 className="text-lg font-semibold">Directory correction requests</h3><p className="mt-2 text-xs text-neutral-500">Requests and outcomes in the current directory scope. A pending request changes no directory value.</p><div className="mt-4 space-y-4">{corrections.map(correction => <article key={correction.id} aria-label={`Directory correction ${correction.id}`} className="rounded-lg border border-neutral-200 p-4"><div className="flex flex-wrap justify-between gap-3"><h4 id={`hr-directory-correction-${correction.id}`} tabIndex={-1} className="font-semibold">{person(correction.employeeId)}</h4><span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize">{correction.status}</span></div><dl className="mt-3 grid gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-[auto_1fr]"><dt>Request ID / sequence</dt><dd>{correction.id} · {correction.sequence}</dd><dt>Employment instance</dt><dd>{correction.instanceId}</dd><dt>Previous work email</dt><dd>{correction.oldValue}</dd><dt>Proposed work email</dt><dd>{correction.proposedValue}</dd><dt>Requesting actor preview</dt><dd>{actorLabel(correction.actor)}</dd>{correction.outcome && <><dt>Outcome actor preview</dt><dd>{actorLabel(correction.outcome.actor)}</dd><dt>Outcome sequence</dt><dd>{correction.outcome.sequence}</dd><dt>Outcome reason</dt><dd className="whitespace-pre-wrap">{correction.outcome.reason}</dd></>}</dl>{manage && correction.status === 'pending' && <CorrectionReviewForm {...shared} correction={correction} simulationDate={simulationDate} />}</article>)}{!corrections.length && <p className="text-sm text-neutral-600">No correction requests in this preview scope.</p>}</div></section>
    <section className={panel}><h3 className="text-lg font-semibold">Saved directory change history</h3><p className="mt-2 text-xs leading-5 text-neutral-500">Only accepted directory changes appear here. A rejected request records its outcome above without changing the directory. Sequences are local action order, not timestamps or an authenticated audit trail.</p>{history.length ? <div className="mt-4 min-w-0 max-w-full overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Saved directory email changes</caption><thead><tr>{['Change sequence', 'Employee', 'Field', 'Old value', 'New value', 'Actor preview', 'Origin'].map(label => <th className="px-3 py-2 font-semibold" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{history.map(change => <tr key={change.id} className="border-t border-neutral-200"><td className="px-3 py-3">{change.sequence}</td><th className="px-3 py-3 font-medium" scope="row">{person(change.employeeId)}</th><td className="px-3 py-3">Work email</td><td className="break-all px-3 py-3">{change.oldValue}</td><td className="break-all px-3 py-3">{change.newValue}</td><td className="px-3 py-3">{actorLabel(change.actor)}</td><td className="px-3 py-3">{change.origin}{change.correctionId ? ` · ${change.correctionId}` : ''}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-neutral-600">No saved directory email changes in this preview scope.</p>}</section>
  </section>
}
