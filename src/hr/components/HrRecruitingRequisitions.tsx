import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useUnsavedWork } from '@/portals/unsaved-work'
import { createHrFormDraft, focusHrForm, normalizeHrFormValue } from './useHrFormDraft'
import type { ManagementRecruitingPreview, PreviewHandle, RecruitingManagementPort, RequisitionCommand, ScopedRecruitingView } from '../recruiting-lifecycle-types'

type ManagementView = Pick<Extract<ScopedRecruitingView, { mode: 'management' }>, 'jobs' | 'requisitions'>
export type RecruitingEmployeeChoice = { id: string; label: string }
export type HrRecruitingRequisitionsProps = {
  view: ManagementView
  port: Pick<RecruitingManagementPort, 'preview' | 'confirm' | 'cancel'>
  ownerChoices: readonly RecruitingEmployeeChoice[]
  managerChoices: readonly RecruitingEmployeeChoice[]
}
type Fields = Record<string, string>
type FieldRenderer = (values: Fields, change: (key: string, value: string) => void) => ReactNode
type Pending = { handle: PreviewHandle; kind: RequisitionCommand['kind']; preview: ManagementRecruitingPreview; command: RequisitionCommand }
const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = `${button} bg-white text-neutral-900 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50`
const panel = 'min-w-0 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'
const failed = 'The fictional recruiting action was refused. Review current facts and preview again; your inputs are kept.'

function FormFields({ values, change, children }: { values: Fields; change: (key: string, value: string) => void; children: FieldRenderer }) {
  return children(values, change)
}

function CommandPreview({ pending, onConfirm, onCancel }: { pending: Pending; onConfirm: () => void; onCancel: () => void }) {
  const { preview, command } = pending
  return <section role="region" aria-label="Requisition and job action preview" className="mt-4 min-w-0 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <h4 className="font-semibold">Review fictional recruiting action</h4>
    <dl className="mt-3 grid gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-[auto_1fr]">
      <dt>Action</dt><dd>{command.kind}</dd><dt>Recorded sample time (UTC)</dt><dd>{preview.recordedAt}</dd>
      {preview.requisition && <><dt>Requisition / revision / state</dt><dd>{preview.requisition.id} · {preview.requisition.revision} · {preview.requisition.state}</dd><dt>Department</dt><dd>{preview.requisition.content.department}</dd><dt>Requisition owner ID</dt><dd>{preview.requisition.content.ownerEmployeeId}</dd><dt>Planning headcount</dt><dd>{preview.requisition.content.headcount}</dd><dt>Current approval capture</dt><dd>{preview.requisition.currentApprovalId ?? 'None'}</dd></>}
      {preview.job && <><dt>Job / revision / state</dt><dd>{preview.job.id} · {preview.job.revision} · {preview.job.state}</dd><dt>Job title / department</dt><dd>{preview.job.title} · {preview.job.department}</dd><dt>Hiring manager ID</dt><dd>{preview.job.managerEmployeeId}</dd><dt>Bound requisition</dt><dd>{preview.job.requisitionId ?? 'None'}</dd><dt>Publication capture</dt><dd>{preview.job.publication.kind === 'captured' ? preview.job.publication.publicationId : preview.job.publication.kind === 'legacy-unrecorded' ? 'Legacy publication; no recorded approval' : 'None'}</dd></>}
      {command.kind === 'review-requisition' && <><dt>Review outcome</dt><dd>{command.outcome}</dd><dt>Review reason</dt><dd className="whitespace-pre-wrap">{command.reason}</dd></>}
    </dl>
    {preview.warnings.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <p className="mt-3 text-xs leading-5 text-neutral-600">Preview changes no saved record. Confirmation rechecks current source, revision and preview identity. Headcount records fictional planning information; it does not consume a hiring quota.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={onConfirm}>Confirm fictional recruiting action</button><button type="button" className={secondary} onClick={onCancel}>Cancel recruiting action preview</button></div>
  </section>
}

/** This form owns only its typed inputs and an opaque controller handle. It
 * never receives HR state, an updater callback, source hashes or private drafts. */
function RequisitionCommandForm({ id, label, initial, sourceRevision, makeCommand, port, children }: {
  id: string; label: string; initial: Fields; makeCommand: (values: Fields) => RequisitionCommand
  sourceRevision?: number; port: HrRecruitingRequisitionsProps['port']; children: FieldRenderer
}) {
  const [draft] = useState(() => createHrFormDraft(initial, normalizeHrFormValue))
  const [boundRevision, setBoundRevision] = useState(sourceRevision)
  const [values, render] = useState(initial)
  const [pending, renderPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const [error, setError] = useState(''); const [feedback, setFeedback] = useState('')
  function invalidate() { const old = pendingRef.current; pendingRef.current = null; renderPending(null); if (old) port.cancel(old.handle) }
  function change(key: string, value: string) { invalidate(); render(draft.change(previous => ({ ...previous, [key]: value }))); setError(''); setFeedback('') }
  function discard() { invalidate(); render(sourceRevision !== boundRevision ? draft.accept(initial) : draft.discard()); setBoundRevision(sourceRevision); setError(''); setFeedback('') }
  useUnsavedWork({ id, portal: 'hr', label, isDirty: draft.isDirty, discard, focus: () => focusHrForm(id) })
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); invalidate(); setError(''); setFeedback('')
    if (sourceRevision !== boundRevision) { setError('This record revision changed while this form was open. Your inputs are kept. Discard this form draft to load the current saved values before previewing again.'); return }
    try {
      const command = makeCommand(draft.value()); const result = port.preview(command)
      if (!result.ok) { setError(result.message); return }
      if (result.preview.kind !== command.kind || !('changedPeople' in result.preview)) { port.cancel(result.handle); setError(failed); return }
      const next = { handle: result.handle, kind: command.kind, preview: result.preview, command }
      pendingRef.current = next; renderPending(next)
    } catch { setError(failed) }
  }
  function confirm(handle: PreviewHandle) {
    const current = pendingRef.current
    if (!current || current.handle !== handle) return
    pendingRef.current = null; renderPending(null)
    try {
      const result = port.confirm({ kind: current.kind, handle })
      if (!result.ok) { setError(result.message); setFeedback(''); return }
      render(draft.accept(draft.value())); setError(''); setFeedback(result.feedback); focusHrForm(id)
    } catch { setError(failed); setFeedback('') }
  }
  return <form id={id} aria-label={label} className="mt-4 min-w-0 space-y-4" noValidate onSubmit={preview}>
    <FormFields values={values} change={change}>{children}</FormFields>
    {sourceRevision !== undefined && <p className="text-xs leading-5 text-neutral-600">This form keeps the revision it opened. If that revision changes, discard this form draft to load current values before making another preview.</p>}
    <label className="block text-sm font-medium">Recorded sample time (UTC)<input className={field} value={values.recordedAt} onChange={event => change('recordedAt', event.target.value)} placeholder="2026-10-15T09:00:00.000Z" required autoComplete="off" /><span className="mt-1 block text-xs text-neutral-500">Choose an explicit UTC instant with milliseconds and Z. No timestamp is inferred from the clock.</span></label>
    <div className="flex flex-wrap gap-3"><button type="submit" className={button}>Preview {label.toLowerCase()}</button><button type="button" className={secondary} onClick={() => { discard(); focusHrForm(id) }}>Discard {label.toLowerCase()} draft</button></div>
    {pending && <CommandPreview pending={pending} onConfirm={() => confirm(pending.handle)} onCancel={() => { if (pendingRef.current?.handle === pending.handle) { invalidate(); focusHrForm(id) } }} />}
    {error && <p role="alert" className="break-words text-sm text-red-900">{error}</p>}
    {feedback && <p role="status" className="break-words text-sm text-emerald-900">{feedback}</p>}
  </form>
}

function ContentFields({ values, change, owners }: { values: Fields; change: (key: string, value: string) => void; owners: readonly RecruitingEmployeeChoice[] }) {
  return <><label className="block text-sm font-medium">Requisition department<input className={field} value={values.department} onChange={event => change('department', event.target.value)} required minLength={2} maxLength={80} /></label><label className="block text-sm font-medium">Requisition owner<select className={field} value={values.ownerEmployeeId} onChange={event => change('ownerEmployeeId', event.target.value)} required><option value="">Choose an active fictional owner</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.label} · {owner.id}</option>)}</select></label><label className="block text-sm font-medium">Planning headcount<input className={field} type="number" min={1} max={50} step={1} value={values.headcount} onChange={event => change('headcount', event.target.value)} required /><span className="mt-1 block text-xs text-neutral-500">Recorded planning value, 1–50. It is not a hiring quota.</span></label></>
}
const commandContent = (values: Fields) => ({ department: values.department, ownerEmployeeId: values.ownerEmployeeId, headcount: Number(values.headcount) })

export function HrRecruitingRequisitions({ view, port, ownerChoices, managerChoices }: HrRecruitingRequisitionsProps) {
  const approved = view.requisitions.filter(record => record.state === 'approved' && record.currentApprovalId !== null)
  const choices = (values: Fields, change: (key: string, value: string) => void) => <label className="block text-sm font-medium">Approved requisition<select className={field} value={values.requisitionId} onChange={event => change('requisitionId', event.target.value)} required><option value="">Choose a reviewed requisition</option>{approved.map(record => <option key={record.id} value={record.id}>{record.id} · revision {record.revision} · {record.content.department}</option>)}</select></label>
  return <section role="region" aria-label="Recruiting requisitions and job publication" className="min-w-0 space-y-6">
    <header className={panel}><h2 className="text-xl font-semibold">Recruiting requisitions and job publication</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Create fictional headcount plans, request explicit review and bind jobs to an approved requisition before publishing locally. Requisition owner and hiring manager are separate choices and may name the same person. No job board, message, account or provider is contacted.</p></header>
    <section className={panel}><h3 className="text-lg font-semibold">Create sample requisition</h3><RequisitionCommandForm id="hr:recruiting:requisition:create" label="Create sample requisition" initial={{ department: '', ownerEmployeeId: '', headcount: '1', recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'create-requisition', content: commandContent(values), recordedAt: values.recordedAt })}>{(values, change) => <ContentFields values={values} change={change} owners={ownerChoices} />}</RequisitionCommandForm></section>
    <section className={panel}><h3 className="text-lg font-semibold">Saved sample requisitions</h3>{view.requisitions.map(record => <article key={record.id} aria-label={`Requisition ${record.id}`} className="mt-4 min-w-0 rounded-lg border border-neutral-200 p-4">
      <h4 className="font-semibold">{record.id} · revision {record.revision} · {record.state}</h4><p className="mt-2 text-sm">{record.content.department} · owner {record.content.ownerEmployeeId} · planning headcount {record.content.headcount}</p>
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Edit requisition {record.id}</summary><RequisitionCommandForm id={`hr:recruiting:requisition:edit:${record.id}`} label={`Edit requisition ${record.id}`} sourceRevision={record.revision} initial={{ department: record.content.department, ownerEmployeeId: record.content.ownerEmployeeId, headcount: String(record.content.headcount), recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'edit-requisition', requisitionId: record.id, revision: record.revision, content: commandContent(values), recordedAt: values.recordedAt })}>{(values, change) => <ContentFields values={values} change={change} owners={ownerChoices} />}</RequisitionCommandForm></details>
      {['draft', 'rejected'].includes(record.state) && <RequisitionCommandForm id={`hr:recruiting:requisition:request:${record.id}`} label={`Request review for ${record.id}`} sourceRevision={record.revision} initial={{ recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'request-requisition-review', requisitionId: record.id, revision: record.revision, recordedAt: values.recordedAt })}>{() => <p className="text-sm">Request explicit review of revision {record.revision}; requesting review records no approval.</p>}</RequisitionCommandForm>}
      {record.state === 'in-review' && <RequisitionCommandForm id={`hr:recruiting:requisition:review:${record.id}`} label={`Review requisition ${record.id}`} sourceRevision={record.revision} initial={{ outcome: 'approved', reason: '', recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'review-requisition', requisitionId: record.id, revision: record.revision, outcome: values.outcome as 'approved' | 'rejected', reason: values.reason, recordedAt: values.recordedAt })}>{(values, change) => <><label className="block text-sm font-medium">Requisition review outcome<select className={field} value={values.outcome} onChange={event => change('outcome', event.target.value)}><option value="approved">Approve current revision</option><option value="rejected">Reject current revision</option></select></label><label className="block text-sm font-medium">Requisition review reason<textarea className={field} value={values.reason} onChange={event => change('reason', event.target.value)} minLength={2} maxLength={500} required rows={2} /></label></>}</RequisitionCommandForm>}
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Captured approvals for {record.id} · {record.approvals.length}</summary><ul className="mt-2 space-y-2 text-sm">{record.approvals.map(capture => <li key={capture.id} className="break-words">{capture.id} · revision {capture.revision} · {capture.content.department} · owner {capture.content.ownerEmployeeId} · headcount {capture.content.headcount} · {capture.recordedAt}</li>)}{!record.approvals.length && <li>No approval has been recorded.</li>}</ul></details>
    </article>)}{!view.requisitions.length && <p className="mt-3 text-sm text-neutral-600">No sample requisitions. Create a draft and request review.</p>}</section>
    <section className={panel}><h3 className="text-lg font-semibold">Create requisition-backed sample job</h3><RequisitionCommandForm id="hr:recruiting:job:create" label="Create requisition-backed job" initial={{ title: '', department: '', managerEmployeeId: '', requisitionId: '', recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'create-job', title: values.title, department: values.department, managerEmployeeId: values.managerEmployeeId, requisitionId: values.requisitionId, recordedAt: values.recordedAt })}>{(values, change) => <>{choices(values, change)}<label className="block text-sm font-medium">Sample job title<input className={field} value={values.title} onChange={event => change('title', event.target.value)} required minLength={3} maxLength={100} /></label><label className="block text-sm font-medium">Approved job department<input className={field} value={values.department} onChange={event => change('department', event.target.value)} required minLength={2} maxLength={80} /><span className="mt-1 block text-xs text-neutral-500">Must match the chosen approved requisition department.</span></label><label className="block text-sm font-medium">Sample hiring manager<select className={field} value={values.managerEmployeeId} onChange={event => change('managerEmployeeId', event.target.value)} required><option value="">Choose an active manager with a team</option>{managerChoices.map(manager => <option key={manager.id} value={manager.id}>{manager.label} · {manager.id}</option>)}</select></label></>}</RequisitionCommandForm></section>
    <section className={panel}><h3 className="text-lg font-semibold">Job requisition bindings and publication</h3>{view.jobs.map(record => <article key={record.id} aria-label={`Publication for job ${record.id}`} className="mt-4 min-w-0 rounded-lg border border-neutral-200 p-4"><h4 className="font-semibold">{record.title} · {record.state}</h4><p className="mt-2 text-sm">{record.id} · revision {record.revision} · {record.department} · hiring manager {record.managerEmployeeId}</p><p className="mt-2 text-sm">Requisition: {record.requisitionId ?? 'None'}. Publication: {record.publication.kind === 'captured' ? record.publication.publicationId : record.publication.kind === 'legacy-unrecorded' ? 'Legacy publication; no recorded approval' : 'None'}.</p>
      {record.state === 'draft' && <><RequisitionCommandForm id={`hr:recruiting:job:bind:${record.id}`} label={`Bind approved requisition to ${record.id}`} sourceRevision={record.revision} initial={{ requisitionId: record.requisitionId ?? '', recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'bind-job-requisition', jobId: record.id, revision: record.revision, requisitionId: values.requisitionId, recordedAt: values.recordedAt })}>{(values, change) => <>{choices(values, change)}<p className="text-xs text-neutral-600">Binding captures the approved department and increments the job revision. Earlier publication and approval captures stay unchanged.</p></>}</RequisitionCommandForm><RequisitionCommandForm id={`hr:recruiting:job:publish:${record.id}`} label={`Publish sample job ${record.id}`} sourceRevision={record.revision} initial={{ recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'publish-job', jobId: record.id, revision: record.revision, recordedAt: values.recordedAt })}>{() => <p className="text-sm">Review the current approved requisition and hiring manager before a local publication capture is recorded.</p>}</RequisitionCommandForm></>}
      {record.state === 'published' && <RequisitionCommandForm id={`hr:recruiting:job:close:${record.id}`} label={`Close sample job ${record.id}`} sourceRevision={record.revision} initial={{ recordedAt: '' }} port={port} makeCommand={values => ({ kind: 'close-job', jobId: record.id, revision: record.revision, recordedAt: values.recordedAt })}>{() => <p className="text-sm">Every application must be hired, rejected or withdrawn. Closing cannot reopen the job and creates no historical approval.</p>}</RequisitionCommandForm>}
    </article>)}{!view.jobs.length && <p className="mt-3 text-sm text-neutral-600">No sample jobs in this management view.</p>}</section>
  </section>
}
