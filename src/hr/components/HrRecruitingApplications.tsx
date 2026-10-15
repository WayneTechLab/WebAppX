import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUnsavedWork } from '@/portals/unsaved-work'
import { createHrFormDraft, focusHrForm, normalizeHrFormValue } from './useHrFormDraft'
import { HrRecruitingHireSummary } from './HrRecruitingHireSummary'
import type { ApplicationStage, ApplicationView, ManagementRecruitingPreview, PreviewHandle, RecruitingCommand, RecruitingManagementPort, ScopedRecruitingView } from '../recruiting-lifecycle-types'

type ManagementView = Extract<ScopedRecruitingView, { mode: 'management' }>
export type HrRecruitingApplicationsProps = { view: ManagementView; port: RecruitingManagementPort; adopted: boolean; onView: (view: ManagementView) => void }
type Pending = { handle: PreviewHandle; kind: RecruitingCommand['kind']; preview: ManagementRecruitingPreview; fields: string; port: RecruitingManagementPort }
const field = 'mt-2 block min-h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const primary = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50'
const panel = 'min-w-0 space-y-4 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'
const focusLater = (id: string) => window.requestAnimationFrame(() => focusHrForm(id))
class InputError extends Error {}
function utc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new InputError('Enter a valid UTC instant in YYYY-MM-DDTHH:mm:ss.sssZ format.')
  return value
}

/** Own only user-entered fields and opaque handles. Discard cancels the live
 * handle synchronously, including when invoked through the shared registry. */
function useCommandForm<T>({ id, label, initial, port, onView }: { id: string; label: string; initial: T; port: RecruitingManagementPort; onView: (view: ManagementView) => void }) {
  const [draft] = useState(() => createHrFormDraft(initial))
  const [value, render] = useState(initial)
  const [pending, renderPending] = useState<Pending | null>(null)
  const live = useRef<Pending | null>(null)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const [conflict, setConflict] = useState<NonNullable<ManagementRecruitingPreview['conflict']> | null>(null)
  function cancelHandle() { const current = live.current; live.current = null; if (current) current.port.cancel(current.handle); renderPending(null) }
  function change(next: T | ((previous: T) => T)) { cancelHandle(); setError(''); setMessage(''); setConflict(null); render(draft.change(next)) }
  function discard() { cancelHandle(); setError(''); setMessage(''); setConflict(null); render(draft.discard()) }
  useUnsavedWork({ id, portal: 'hr', label, isDirty: () => draft.isDirty(), discard, focus: () => focusLater(id) })
  useEffect(() => () => { const current = live.current; live.current = null; if (current) current.port.cancel(current.handle) }, [])
  function preview(event: FormEvent, build: (fields: T) => RecruitingCommand) {
    event.preventDefault(); cancelHandle(); setError(''); setMessage(''); setConflict(null)
    try {
      const command = build(draft.value()), result = port.preview(command)
      if (!result.ok) { setError(result.message); if (result.code === 'conflict') setConflict(result.conflict); return }
      if (!('changedPeople' in result.preview) || result.preview.kind !== command.kind) { port.cancel(result.handle); setError('A management recruiting preview is unavailable. Your inputs are kept.'); return }
      if (command.kind === 'hire' && !result.preview.hire) { port.cancel(result.handle); setError('Exact hire records were not supplied. Preview again; your inputs are kept.'); return }
      const next = { handle: result.handle, kind: command.kind, preview: result.preview, fields: normalizeHrFormValue(draft.value()), port }
      live.current = next; renderPending(next)
    } catch (failure) { setError(failure instanceof InputError ? failure.message : 'This recruiting action could not be previewed. Your inputs are kept.') }
  }
  function confirm(reviewed: Pending, blocked?: string) {
    if (blocked) { setError(blocked); return }
    if (live.current !== reviewed || reviewed.fields !== normalizeHrFormValue(draft.value())) { setError('The reviewed fields changed. Preview again; your inputs are kept.'); return }
    let result
    try { result = reviewed.port.confirm({ kind: reviewed.kind, handle: reviewed.handle }) }
    catch { cancelHandle(); setError('This recruiting confirmation was refused. Your inputs are kept.'); return }
    cancelHandle()
    if (!result.ok) { setError(result.message); return }
    if (result.view.mode !== 'management') { setError('The management view is no longer available. Your inputs are kept.'); return }
    render(draft.accept(initial)); setConflict(null); setError(''); setMessage(result.feedback); onView(result.view); focusLater(id)
  }
  function cancel() { cancelHandle(); setMessage('Preview canceled. No recruiting records were changed; your inputs are kept.'); focusLater(id) }
  return { id, value, read: draft.value, dirty: draft.isDirty, refuse: setError, change, discard, preview, confirm, cancel, pending, error, message, conflict }
}
type CommandForm<T> = ReturnType<typeof useCommandForm<T>>
function RecordedTime({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block min-w-0 text-sm font-medium">Recorded UTC time<input className={field} required maxLength={24} value={value} placeholder="2026-10-15T12:00:00.000Z" onChange={event => onChange(event.target.value)} /><span className="mt-1 block text-xs font-normal text-neutral-600">Enter YYYY-MM-DDTHH:mm:ss.sssZ explicitly. No current time is supplied.</span></label>
}
function Review<T>({ form, title, confirmLabel, beforeConfirm }: { form: CommandForm<T>; title: string; confirmLabel: string; beforeConfirm?: () => string | undefined }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (form.pending) heading.current?.focus() }, [form.pending])
  return <>
    {form.error && <p role="alert" className="break-words text-sm text-red-900">{form.error}</p>}
    {form.message && <p role="status" className="break-words text-sm text-emerald-900">{form.message}</p>}
    {form.pending && <section aria-label={title} className="min-w-0 space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h4 ref={heading} tabIndex={-1} className="font-semibold">{title}</h4>
      <p role="status" className="text-sm font-semibold">Ready for explicit confirmation</p>
      <p className="break-words text-sm">Action: {form.pending.preview.kind} · Recorded UTC time: {form.pending.preview.recordedAt}</p>
      <ul className="space-y-2 text-sm">{form.pending.preview.changedPeople.map(person => <li key={person.id} className="break-words">Person: {person.firstName} {person.lastName} · {person.id} · {person.workEmail}</li>)}{form.pending.preview.changedApplications.map(application => <li key={application.id} className="break-words">Application: {application.id} · Person: {application.personId} · Job: {application.jobId} · Proposed stage: {application.stage}{application.outcomeReason ? ` · Sample reason: ${application.outcomeReason}` : ''}</li>)}</ul>
      {form.pending.preview.job && <p className="break-words text-sm">Job: {form.pending.preview.job.title} · {form.pending.preview.job.id}</p>}
      {form.pending.preview.hire && <HrRecruitingHireSummary creation={form.pending.preview.hire} />}
      {form.pending.preview.warnings.length > 0 && <ul className="list-inside list-disc space-y-2 text-sm">{form.pending.preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <p className="text-xs leading-5">The latest workspace and preview identity are checked again at confirmation. Cancel retains the temporary fields.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className={primary} onClick={() => form.pending && form.confirm(form.pending, beforeConfirm?.())}>{confirmLabel}</button><button type="button" className={secondary} onClick={form.cancel}>Cancel {title.toLowerCase()}</button></div>
    </section>}
  </>
}
function JobOptions({ view }: { view: ManagementView }) { return <><option value="">Choose a published job</option>{view.jobs.filter(job => job.state === 'published').map(job => <option key={job.id} value={job.id}>{job.title} · {job.id}</option>)}</> }
function Adoption({ port, onView }: Pick<HrRecruitingApplicationsProps, 'port' | 'onView'>) {
  const form = useCommandForm({ id: 'hr:recruiting-lifecycle:adopt', label: 'Recruiting lifecycle adoption', initial: { recordedAt: '' }, port, onView })
  return <section aria-label="Adopt recruiting lifecycle" className={panel}><h3 className="text-lg font-semibold">Adopt the saved recruiting records</h3><p className="text-sm leading-6">Explicit adoption captures existing jobs, applications and hires without changing their historical records. It creates no employment history.</p><form id={form.id} aria-label="Recruiting adoption" className="space-y-4" onSubmit={event => form.preview(event, values => ({ kind: 'adopt', recordedAt: utc(values.recordedAt) }))}><RecordedTime value={form.value.recordedAt} onChange={recordedAt => form.change({ recordedAt })} /><button className={primary} type="submit">Preview recruiting adoption</button><button className={secondary + ' ml-3'} type="button" onClick={form.discard}>Discard adoption draft</button></form><Review form={form} title="Recruiting adoption preview" confirmLabel="Confirm recruiting adoption" /></section>
}
function ApplicationEntry({ view, port, onView }: Pick<HrRecruitingApplicationsProps, 'view' | 'port' | 'onView'>) {
  const person = useCommandForm({ id: 'hr:recruiting-lifecycle:new-person', label: 'New recruiting person and application', initial: { firstName: '', lastName: '', workEmail: '', jobId: '', recordedAt: '' }, port, onView })
  const existing = useCommandForm({ id: 'hr:recruiting-lifecycle:existing-person', label: 'Separate application for an existing recruiting person', initial: { personId: '', jobId: '', recordedAt: '' }, port, onView })
  const matching = person.conflict?.kind === 'person' ? view.people.find(item => item.id === person.conflict!.id) : undefined
  return <div className="grid min-w-0 grid-cols-1 gap-5">
    <section aria-label="New recruiting person and application" className={panel}><h3 className="text-lg font-semibold">Add a fictional person and application</h3><form id={person.id} aria-label="Create recruiting person and application" className="space-y-4" onSubmit={event => person.preview(event, values => ({ kind: 'create-person-application', ...values, recordedAt: utc(values.recordedAt) }))}>
      <label className="block text-sm font-medium">Fictional first name<input className={field} required minLength={2} maxLength={60} value={person.value.firstName} onChange={event => person.change(previous => ({ ...previous, firstName: event.target.value }))} /></label>
      <label className="block text-sm font-medium">Fictional last name<input className={field} required minLength={2} maxLength={60} value={person.value.lastName} onChange={event => person.change(previous => ({ ...previous, lastName: event.target.value }))} /></label>
      <label className="block text-sm font-medium">Fictional work email<input className={field} type="email" required maxLength={160} value={person.value.workEmail} onChange={event => person.change(previous => ({ ...previous, workEmail: event.target.value }))} /><span className="mt-1 block text-xs font-normal text-neutral-600">Use a fictional .invalid address. Matching email requires a deliberate identity decision.</span></label>
      <label className="block text-sm font-medium">Application job<select className={field} required value={person.value.jobId} onChange={event => person.change(previous => ({ ...previous, jobId: event.target.value }))}><JobOptions view={view} /></select></label>
      <RecordedTime value={person.value.recordedAt} onChange={recordedAt => person.change(previous => ({ ...previous, recordedAt }))} />
      <div className="flex flex-wrap gap-3"><button type="submit" className={primary}>Preview new person and application</button><button type="button" className={secondary} onClick={person.discard}>Discard new person draft</button></div>
    </form>
      {person.conflict && <section aria-label="Recruiting identity conflict" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><h4 className="font-semibold">Review the existing identity</h4><p className="break-words">{person.conflict.kind} · {person.conflict.displayName} · {person.conflict.id}</p><p>No person or application was created. A separate application preserves the existing person identity; this does not merge records.</p>{matching && <button type="button" className={secondary} onClick={() => { if (existing.dirty()) { existing.refuse('Finish or explicitly discard the separate-application draft before choosing this person.'); focusLater(existing.id); return }; const typed = person.read(); existing.change({ personId: matching.id, jobId: typed.jobId, recordedAt: typed.recordedAt }); focusLater(existing.id) }}>Choose existing person for a separate application</button>}</section>}
      <Review form={person} title="New person and application preview" confirmLabel="Confirm new person and application" />
    </section>
    <section aria-label="Existing person separate application" className={panel}><h3 className="text-lg font-semibold">Create a separate application for an existing person</h3><p className="text-sm">Each application has its own job, stage, reasons and history. Selecting a person does not change their other applications.</p><form id={existing.id} aria-label="Create separate recruiting application" className="space-y-4" onSubmit={event => existing.preview(event, values => ({ kind: 'add-person-application', ...values, recordedAt: utc(values.recordedAt) }))}>
      <label className="block text-sm font-medium">Existing recruiting person<select className={field} required value={existing.value.personId} onChange={event => existing.change(previous => ({ ...previous, personId: event.target.value }))}><option value="">Choose an existing person</option>{view.people.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select></label>
      <label className="block text-sm font-medium">Separate application job<select className={field} required value={existing.value.jobId} onChange={event => existing.change(previous => ({ ...previous, jobId: event.target.value }))}><JobOptions view={view} /></select></label>
      <RecordedTime value={existing.value.recordedAt} onChange={recordedAt => existing.change(previous => ({ ...previous, recordedAt }))} />
      <div className="flex flex-wrap gap-3"><button type="submit" className={primary}>Preview separate application</button><button type="button" className={secondary} onClick={existing.discard}>Discard separate application draft</button></div>
    </form><Review form={existing} title="Separate application preview" confirmLabel="Confirm separate application" /></section>
  </div>
}
const advances: Partial<Record<ApplicationStage, 'screening' | 'interview' | 'offer'>> = { applied: 'screening', screening: 'interview', interview: 'offer' }
function Intervals({ application }: { application: ApplicationView }) {
  return <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left font-semibold">Stage timing for {application.id}</caption><thead><tr>{['Stage', 'Entered UTC', 'Exited UTC', 'Duration', 'Boundary'].map(label => <th scope="col" key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{application.intervals.map((interval, index) => <tr key={index} className="border-t border-neutral-200"><td className="p-2">{interval.stage}</td><td className="break-words p-2">{interval.enteredAt ?? 'Unknown legacy entry'}</td><td className="break-words p-2">{interval.exitedAt ?? (interval.boundary === 'open' ? 'Open stage' : 'Unknown legacy exit')}</td><td className="p-2">{interval.durationMs === null ? interval.boundary === 'open' ? 'Not observed' : 'Unknown legacy duration' : `${interval.durationMs} ms`}</td><td className="p-2">{interval.boundary}</td></tr>)}</tbody></table></div>
}
function ApplicationCard({ application, view, port, onView }: Pick<HrRecruitingApplicationsProps, 'view' | 'port' | 'onView'> & { application: ApplicationView }) {
  const next = advances[application.stage], terminal = ['hired', 'rejected', 'withdrawn'].includes(application.stage)
  const person = view.people.find(item => item.id === application.personId), job = view.jobs.find(item => item.id === application.jobId)
  const stage = useCommandForm({ id: `hr:recruiting-lifecycle:${application.id}:stage`, label: `Stage change for application ${application.id}`, initial: { recordedAt: '' }, port, onView })
  const outcome = useCommandForm({ id: `hr:recruiting-lifecycle:${application.id}:outcome`, label: `Terminal outcome for application ${application.id}`, initial: { outcome: 'rejected' as 'rejected' | 'withdrawn', reason: '', recordedAt: '' }, port, onView })
  const hire = useCommandForm({ id: `hr:recruiting-lifecycle:${application.id}:hire`, label: `Hire confirmation for application ${application.id}`, initial: { recordedAt: '' }, port, onView })
  return <article aria-label={`Recruiting application ${application.id}`} className={panel}><header className="space-y-2"><h3 className="font-semibold">{person ? `${person.firstName} ${person.lastName}` : application.personId}</h3><p className="break-words text-sm">{application.id} · Person {application.personId} · {job?.title ?? application.jobId}</p><p className="text-sm">Application stage: <strong>{application.stage}</strong></p>{application.outcomeReason && <p className="break-words text-sm">Sample {application.stage} reason: {application.outcomeReason}</p>}{application.hiredEmployeeId && <p className="break-words text-sm">Hired employee: {application.hiredEmployeeId}</p>}</header><Intervals application={application} />
    {application.legacyActivity.length > 0 ? <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Legacy application activity for {application.id}</summary><ol className="space-y-3 text-sm">{application.legacyActivity.map(activity => <li key={activity.receipt} className="space-y-1 rounded-lg border border-neutral-200 p-3"><p className="break-words">Receipt: {activity.receipt}</p><p className="break-words">Action: {activity.action}</p><p>Actor preview: {activity.actorRole}</p><p>Recorded UTC time: unknown legacy time</p></li>)}</ol></details> : <p className="text-xs text-neutral-600">No legacy activity was recorded for this application.</p>}
    {terminal ? <p role="status" className="text-sm">This application is {application.stage}. Its recorded outcome is retained; other applications for this person remain independent.</p> : <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Manage application {application.id}</summary><div className="space-y-5">
      {next && <section aria-label={`Advance application ${application.id}`} className="space-y-4"><form id={stage.id} aria-label={`Stage change for application ${application.id}`} className="space-y-4" onSubmit={event => stage.preview(event, values => ({ kind: 'move-application', applicationId: application.id, expectedStage: application.stage, nextStage: next, recordedAt: utc(values.recordedAt) }))}><RecordedTime value={stage.value.recordedAt} onChange={recordedAt => stage.change({ recordedAt })} /><div className="flex flex-wrap gap-3"><button className={primary} type="submit">Preview move to {next}</button><button className={secondary} type="button" onClick={stage.discard}>Discard stage draft</button></div></form><Review form={stage} title={`Application ${application.id} stage preview`} confirmLabel={`Confirm move to ${next}`} /></section>}
      {application.stage === 'offer' && <section aria-label={`Hire application ${application.id}`} className="space-y-4"><form id={hire.id} aria-label={`Hire confirmation for application ${application.id}`} className="space-y-4" onSubmit={event => hire.preview(event, values => ({ kind: 'hire', applicationId: application.id, recordedAt: utc(values.recordedAt) }))}><RecordedTime value={hire.value.recordedAt} onChange={recordedAt => hire.change({ recordedAt })} /><div className="flex flex-wrap gap-3"><button className={primary} type="submit">Preview exact fictional hire</button><button className={secondary} type="button" onClick={hire.discard}>Discard hire draft</button></div></form><Review form={hire} title={`Application ${application.id} hire preview`} confirmLabel="Confirm exact fictional hire" beforeConfirm={() => stage.dirty() || outcome.dirty() ? 'Finish or explicitly discard the other temporary drafts for this application before hiring.' : undefined} /></section>}
      <section aria-label={`End application ${application.id}`} className="space-y-4"><form id={outcome.id} aria-label={`Terminal outcome for application ${application.id}`} className="space-y-4" onSubmit={event => outcome.preview(event, values => { if (!values.reason.trim()) throw new InputError('Enter a sample reason for rejection or withdrawal.'); return { kind: 'end-application', applicationId: application.id, expectedStage: application.stage, ...values, reason: values.reason.trim(), recordedAt: utc(values.recordedAt) } })}>
        <label className="block text-sm font-medium">Terminal application outcome<select className={field} value={outcome.value.outcome} onChange={event => outcome.change(previous => ({ ...previous, outcome: event.target.value as 'rejected' | 'withdrawn' }))}><option value="rejected">Reject this application</option><option value="withdrawn">Withdraw this application</option></select></label>
        <label className="block text-sm font-medium">Sample outcome reason<textarea className={field} required minLength={2} maxLength={500} rows={3} value={outcome.value.reason} onChange={event => outcome.change(previous => ({ ...previous, reason: event.target.value }))} /></label>
        <RecordedTime value={outcome.value.recordedAt} onChange={recordedAt => outcome.change(previous => ({ ...previous, recordedAt }))} /><div className="flex flex-wrap gap-3"><button className={primary} type="submit">Preview {outcome.value.outcome === 'rejected' ? 'rejection' : 'withdrawal'}</button><button className={secondary} type="button" onClick={outcome.discard}>Discard outcome draft</button></div>
      </form><Review form={outcome} title={`Application ${application.id} outcome preview`} confirmLabel={`Confirm ${outcome.value.outcome === 'rejected' ? 'rejection' : 'withdrawal'}`} beforeConfirm={() => stage.dirty() || hire.dirty() ? 'Finish or explicitly discard the other temporary drafts for this application before recording a terminal outcome.' : undefined} /></section>
    </div></details>}
  </article>
}
function Observation({ port, onView }: Pick<HrRecruitingApplicationsProps, 'port' | 'onView'>) {
  const [observedAt, setObservedAt] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  function observe(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    try { const result = port.view(observedAt ? { observedAt: utc(observedAt) } : undefined); if ('ok' in result) { setError(result.message); return }; if (result.mode !== 'management') { setError('Management stage timing is unavailable in this preview identity.'); return }; onView(result); setMessage(observedAt ? `Duration view requested with observation UTC time ${observedAt}. Unknown legacy boundaries remain unknown.` : 'No observation instant supplied. Open durations remain unknown; recorded closed durations are retained.') } catch (failure) { setError(failure instanceof InputError ? failure.message : 'The stage observation could not be read.') }
  }
  return <section aria-label="Explicit application duration observation" className={panel}><h3 className="text-lg font-semibold">Observe open stage durations</h3><p className="text-sm">Closed intervals use their recorded boundaries. Open durations remain unknown until you supply an explicit UTC observation; legacy unknown boundaries remain unknown.</p><form aria-label="Application duration observation" className="space-y-4" onSubmit={observe}><label className="block text-sm font-medium">Optional observation UTC time<input className={field} maxLength={24} value={observedAt} placeholder="2026-10-15T12:00:00.000Z" onChange={event => setObservedAt(event.target.value)} /></label><button type="submit" className={secondary}>Apply duration observation</button></form>{error && <p role="alert" className="break-words text-sm text-red-900">{error}</p>}{message && <p role="status" className="break-words text-sm text-neutral-700">{message}</p>}</section>
}
export function HrRecruitingApplications({ view, port, adopted, onView }: HrRecruitingApplicationsProps) {
  return <section aria-label="Recruiting people and applications" className="min-w-0 space-y-5"><header className={panel}><h2 className="text-xl font-semibold">People and their independent applications</h2><p className="text-sm leading-6">Use fictional identities and account-free local records. Each person may have separate applications with distinct stages, terminal reasons and explicit UTC history.</p></header>{!adopted ? <Adoption port={port} onView={onView} /> : <><ApplicationEntry view={view} port={port} onView={onView} /><Observation port={port} onView={onView} /><section aria-label="Recruiting applications" className="space-y-5"><h3 className="text-lg font-semibold">Applications</h3>{view.applications.map(application => <ApplicationCard key={application.id} application={application} view={view} port={port} onView={onView} />)}{!view.applications.length && <p className="text-sm text-neutral-600">No applications have been recorded.</p>}</section></>}</section>
}
