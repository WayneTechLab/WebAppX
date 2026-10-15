import { useRef, useState, type FormEvent } from 'react'
import { useUnsavedTransition, useUnsavedWork } from '@/portals/unsaved-work'
import { createHrFormDraft, focusHrForm } from './useHrFormDraft'
import type { ManagementRecruitingPreview, PreviewHandle, RecruitingManagementPort, ScopedRecruitingView } from '../recruiting-lifecycle-types'

type ManagementView = Extract<ScopedRecruitingView, { mode: 'management' }>
export type RecruitingParticipantChoice = { employeeId: string; displayName: string }
type Props = { view: ManagementView; port: RecruitingManagementPort; participantChoices: readonly RecruitingParticipantChoice[] }
type ScheduleFields = { recordedAt: string; startAt: string; timeZone: string; durationMinutes: string; participants: string[] }
type Pending = { handle: PreviewHandle; preview: ManagementRecruitingPreview }
const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'
const panel = 'min-w-0 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'
const empty = (): ScheduleFields => ({ recordedAt: '', startAt: '', timeZone: 'UTC', durationMinutes: '60', participants: [] })
const scheduleId = (applicationId: string) => `hr:recruiting:interview:${applicationId}`

function InterviewScheduleForm({ applicationId, port, participantChoices }: Pick<Props, 'port' | 'participantChoices'> & { applicationId: string }) {
  const id = scheduleId(applicationId)
  const [draft] = useState(() => createHrFormDraft(empty()))
  const [values, render] = useState(draft.value())
  const pendingRef = useRef<Pending | null>(null)
  const [pending, renderPending] = useState<Pending | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  function clearPreview() { if (pendingRef.current) port.cancel(pendingRef.current.handle); pendingRef.current = null; renderPending(null) }
  function change(update: (previous: ScheduleFields) => ScheduleFields) { clearPreview(); render(draft.change(update)); setError(''); setMessage('') }
  function discard() { clearPreview(); render(draft.discard()); setError(''); setMessage('') }
  useUnsavedWork({ id, portal: 'hr', label: 'Sample interview schedule', isDirty: () => draft.isDirty() || pendingRef.current !== null, discard, focus: () => focusHrForm(id) })
  function preview(event: FormEvent) {
    event.preventDefault(); clearPreview(); setError(''); setMessage('')
    const current = draft.value()
    try {
      const result = port.preview({ kind: 'schedule-interview', applicationId, participantEmployeeIds: current.participants, startAt: current.startAt, timeZone: current.timeZone, durationMinutes: Number(current.durationMinutes), recordedAt: current.recordedAt })
      if (!result.ok) { setError(result.message); return }
      if (result.preview.kind !== 'schedule-interview') { port.cancel(result.handle); setError('The interview preview is unavailable. Review your inputs and try again.'); return }
      const next = { handle: result.handle, preview: result.preview }
      pendingRef.current = next; renderPending(next)
    } catch { setError('The interview preview is unavailable. Your inputs are kept.') }
  }
  function confirm() {
    const current = pendingRef.current
    if (!current) return
    try {
      const result = port.confirm({ kind: 'schedule-interview', handle: current.handle })
      clearPreview()
      if (!result.ok) { setError(result.message); return }
      render(draft.accept(empty())); setError(''); setMessage(result.feedback)
      focusHrForm(id)
    } catch { clearPreview(); setError('The interview confirmation was refused. Your inputs are kept; preview again.') }
  }
  const proposed = pending?.preview.interview
  return <form id={id} aria-label="Schedule sample interview" className="mt-5 space-y-4" noValidate onSubmit={preview}>
    <p className="break-all text-xs text-neutral-500">Application: {applicationId}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-medium">Interview start in UTC<input className={field} type="text" required value={values.startAt} onChange={event => change(previous => ({ ...previous, startAt: event.target.value }))} placeholder="2026-10-20T15:00:00.000Z" autoComplete="off" /><span className="mt-1 block text-xs text-neutral-500">Enter an explicit UTC instant with milliseconds. A future start does not advance application stages.</span></label>
      <label className="min-w-0 text-sm font-medium">Named interview time zone<input className={field} required value={values.timeZone} onChange={event => change(previous => ({ ...previous, timeZone: event.target.value }))} placeholder="America/Los_Angeles" /><span className="mt-1 block text-xs text-neutral-500">Use UTC or a supported named zone. Numeric offsets are refused.</span></label>
      <label className="min-w-0 text-sm font-medium">Interview duration in minutes<input className={field} type="number" required min={15} max={240} step={1} value={values.durationMinutes} onChange={event => change(previous => ({ ...previous, durationMinutes: event.target.value }))} /></label>
      <label className="min-w-0 text-sm font-medium">Schedule recorded time in UTC<input className={field} required value={values.recordedAt} onChange={event => change(previous => ({ ...previous, recordedAt: event.target.value }))} placeholder="2026-10-15T09:00:00.000Z" autoComplete="off" /><span className="mt-1 block text-xs text-neutral-500">Choose this event time explicitly; it is separate from the meeting start.</span></label>
    </div>
    <fieldset className="min-w-0 rounded-lg border border-neutral-200 p-3"><legend className="px-1 text-sm font-semibold">Fictional interview participants</legend><p className="text-xs text-neutral-500">Choose 1–5 known sample employees. No invitation is sent.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{participantChoices.map(choice => <label key={choice.employeeId} className="flex min-h-11 min-w-0 items-center gap-3 rounded-md px-2 text-sm"><input type="checkbox" className="h-4 w-4 shrink-0" checked={values.participants.includes(choice.employeeId)} onChange={event => change(previous => ({ ...previous, participants: event.target.checked ? [...previous.participants, choice.employeeId] : previous.participants.filter(id => id !== choice.employeeId) }))} /><span className="min-w-0 break-words">{choice.displayName}<span className="block break-all text-xs text-neutral-500">{choice.employeeId}</span></span></label>)}</div></fieldset>
    <div className="flex flex-wrap gap-3"><button type="submit" className={button}>Preview sample interview</button><button type="button" className={secondary} onClick={discard}>Discard interview draft</button></div>
    {pending && proposed && <section role="region" aria-label="Sample interview preview" className="min-w-0 rounded-lg border border-amber-300 bg-amber-50 p-4"><h4 className="font-semibold">Sample interview preview</h4><dl className="mt-3 grid min-w-0 gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-[auto_minmax(0,1fr)]"><dt>Interview</dt><dd className="break-all">{proposed.id}</dd><dt>Start</dt><dd>{proposed.startAt}</dd><dt>Zone</dt><dd>{proposed.timeZone}</dd><dt>Duration</dt><dd>{proposed.durationMinutes} minutes</dd><dt>Recorded time</dt><dd>{pending.preview.recordedAt}</dd><dt>Participants</dt><dd>{proposed.participants.map(item => item.displayName).join(', ')}</dd></dl><p className="mt-3 text-xs text-neutral-600">Preview has changed no record. Confirmation rechecks the current workspace; no calendar invitation or message is created.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={confirm}>Confirm sample interview</button><button type="button" className={secondary} onClick={clearPreview}>Cancel interview preview</button></div></section>}
    {error && <p role="alert" className="break-words text-sm text-red-900">{error}</p>}{message && <p role="status" className="break-words text-sm text-emerald-800">{message}</p>}
  </form>
}

export function HrRecruitingInterviews({ view, port, participantChoices }: Props) {
  const request = useUnsavedTransition()
  const active = view.applications.filter(item => !['hired', 'rejected', 'withdrawn'].includes(item.stage))
  const [selected, setSelected] = useState(() => active[0]?.id ?? '')
  // A sibling management action can finish an application. Keep its mounted
  // temporary schedule until the operator explicitly switches or discards it.
  const held = view.applications.find(item => item.id === selected)
  const applicationId = held?.id ?? ''
  const options = held && !active.some(item => item.id === held.id) ? [...active, held] : active
  function select(next: string) { request({ portal: 'hr', ids: applicationId ? [scheduleId(applicationId)] : [], label: 'Change interview application' }, () => setSelected(next)) }
  const description = (id: string) => {
    const application = view.applications.find(item => item.id === id)
    const person = view.people.find(item => item.id === application?.personId)
    const job = view.jobs.find(item => item.id === application?.jobId)
    return `${person ? `${person.firstName} ${person.lastName}` : id} · ${job?.title ?? 'Sample application'}`
  }
  return <div className="min-w-0 space-y-6">
    <section className={panel}><h3 className="text-lg font-semibold">Sample interviews</h3><p className="mt-2 text-sm leading-6 text-neutral-600">Choose explicit fictional times, participants and a named zone. This local schedule sends no invitation, email or calendar request.</p>{options.length > 0 && <label className="mt-4 block min-w-0 text-sm font-medium">Interview application<select className={field} value={applicationId} onChange={event => select(event.target.value)}>{!applicationId && <option value="">Choose an application</option>}{options.map(item => <option key={item.id} value={item.id}>{description(item.id)} · {item.stage}</option>)}</select></label>}{held && !active.some(item => item.id === held.id) && <p className="mt-3 text-sm text-amber-800">This application is now terminal. Your temporary schedule is kept; new scheduling will be refused. Choose another application or discard the draft.</p>}{applicationId ? <InterviewScheduleForm key={applicationId} applicationId={applicationId} port={port} participantChoices={participantChoices} /> : <p className="mt-4 text-sm text-neutral-600">Choose a nonterminal application for a new interview.</p>}
      <ul className="mt-6 space-y-3" aria-label="Recorded sample interviews">{view.interviews.map(interview => <li key={interview.id} className="min-w-0 rounded-lg border border-neutral-200 p-4"><p className="break-words font-semibold">{description(interview.applicationId)}</p><p className="mt-1 break-all text-xs text-neutral-500">{interview.id}</p><p className="mt-2 break-words text-sm">{interview.startAt} · {interview.timeZone} · {interview.durationMinutes} minutes</p><p className="mt-2 break-words text-sm text-neutral-600">Participants: {interview.participants.map(item => item.displayName).join(', ')}</p></li>)}</ul>
    </section>
    <section className={panel}><h3 className="text-lg font-semibold">Submitted sample scorecards</h3><p className="mt-2 text-sm leading-6 text-neutral-600">Hiring review shows explicitly submitted content. Other authors’ saved drafts and earlier draft revisions are absent.</p><div className="mt-4 space-y-4">{view.submittedScorecards.map(card => <article key={card.id} className="min-w-0 rounded-lg border border-neutral-200 p-4"><h4 className="break-words font-semibold">{description(card.applicationId)}</h4><p className="mt-1 break-all text-xs text-neutral-500">{card.interviewId} · {card.authorEmployeeId} · revision {card.revision}</p><p className="mt-2 break-words text-xs text-neutral-500">Submitted: {card.submittedAt}</p><dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm"><dt>Role understanding</dt><dd>{card.content.ratings.roleUnderstanding}/5</dd><dt>Collaboration</dt><dd>{card.content.ratings.collaboration}/5</dd><dt>Problem solving</dt><dd>{card.content.ratings.problemSolving}/5</dd></dl><p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-700">{card.content.comments}</p></article>)}{!view.submittedScorecards.length && <p className="text-sm text-neutral-600">No scorecard has been explicitly submitted.</p>}</div></section>
  </div>
}
