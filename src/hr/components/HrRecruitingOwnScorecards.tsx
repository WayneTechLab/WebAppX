import { useRef, useState, type FormEvent } from 'react'
import { useUnsavedWork } from '@/portals/unsaved-work'
import { createHrFormDraft, focusHrForm, normalizeHrFormValue } from './useHrFormDraft'
import type { OwnInterviewView, OwnScorecardPreview, PreviewHandle, RecruitingInterviewerPort, ScopedRecruitingView, ScorecardContent } from '../recruiting-lifecycle-types'

type Props = { view: Extract<ScopedRecruitingView, { mode: 'interviewer' }>; port: RecruitingInterviewerPort }
type Fields = { roleUnderstanding: string; collaboration: string; problemSolving: string; comments: string; recordedAt: string }
type Pending = { handle: PreviewHandle; preview: OwnScorecardPreview }
const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'
const rubricLabels = [['roleUnderstanding', 'Role understanding'], ['collaboration', 'Collaboration'], ['problemSolving', 'Problem solving']] as const
function initialFields(interview: OwnInterviewView): Fields {
  const content = interview.ownScorecard?.content
  return { roleUnderstanding: content ? String(content.ratings.roleUnderstanding) : '', collaboration: content ? String(content.ratings.collaboration) : '', problemSolving: content ? String(content.ratings.problemSolving) : '', comments: content?.comments ?? '', recordedAt: '' }
}
function contentOf(values: Fields): ScorecardContent {
  return { rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: Number(values.roleUnderstanding), collaboration: Number(values.collaboration), problemSolving: Number(values.problemSolving) }, comments: values.comments }
}

function OwnScorecardForm({ interview, employeeId, port }: { interview: OwnInterviewView; employeeId: string; port: RecruitingInterviewerPort }) {
  const id = `hr:recruiting:scorecard:${employeeId}:${interview.id}`
  const [draft] = useState(() => createHrFormDraft(initialFields(interview)))
  const [values, render] = useState(draft.value())
  const acceptedContent = useRef<ScorecardContent | null>(interview.ownScorecard?.content ?? null)
  const pendingRef = useRef<Pending | null>(null)
  const [pending, renderPending] = useState<Pending | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const submitted = interview.ownScorecard?.state === 'submitted'
  function clearPreview() { if (pendingRef.current) port.cancel(pendingRef.current.handle); pendingRef.current = null; renderPending(null) }
  function change(update: (previous: Fields) => Fields) { clearPreview(); render(draft.change(update)); setError(''); setMessage('') }
  function discard() { clearPreview(); render(draft.discard()); setError(''); setMessage('') }
  useUnsavedWork({ id, portal: 'hr', label: `Own scorecard for ${interview.candidate.displayName}`, canRetain: false, isDirty: () => draft.isDirty() || pendingRef.current !== null, discard, focus: () => focusHrForm(id) })
  function preview(kind: 'save-scorecard' | 'submit-scorecard') {
    clearPreview(); setError(''); setMessage('')
    const current = draft.value()
    if (kind === 'submit-scorecard' && (!interview.ownScorecard || acceptedContent.current === null || normalizeHrFormValue(contentOf(current)) !== normalizeHrFormValue(acceptedContent.current))) {
      setError('Save your scorecard changes or discard them before submitting the saved revision.'); return
    }
    try {
      const result = port.preview(kind === 'save-scorecard'
        ? { kind, interviewId: interview.id, expectedRevision: interview.ownScorecard?.revision ?? null, content: contentOf(current), recordedAt: current.recordedAt }
        : { kind, scorecardId: interview.ownScorecard!.id, expectedRevision: interview.ownScorecard!.revision, recordedAt: current.recordedAt })
      if (!result.ok) { setError(result.message); return }
      if (result.preview.kind !== kind || result.preview.interviewId !== interview.id || result.preview.authorEmployeeId !== employeeId) { port.cancel(result.handle); setError('Your scorecard preview is unavailable. Review your inputs and try again.'); return }
      const next = { handle: result.handle, preview: result.preview }
      pendingRef.current = next; renderPending(next)
    } catch { setError('Your scorecard preview is unavailable. Your inputs are kept.') }
  }
  function save(event: FormEvent) { event.preventDefault(); preview('save-scorecard') }
  function confirm() {
    const current = pendingRef.current
    if (!current) return
    try {
      const result = port.confirm({ kind: current.preview.kind, handle: current.handle })
      clearPreview()
      if (!result.ok) { setError(result.message); return }
      const content = current.preview.content
      acceptedContent.current = content
      render(draft.accept({ roleUnderstanding: String(content.ratings.roleUnderstanding), collaboration: String(content.ratings.collaboration), problemSolving: String(content.ratings.problemSolving), comments: content.comments, recordedAt: current.preview.recordedAt }))
      setError(''); setMessage(result.feedback); focusHrForm(id)
    } catch { clearPreview(); setError('Your scorecard confirmation was refused. Your inputs are kept; preview again.') }
  }
  return <article aria-label={`Own scorecard for ${interview.candidate.displayName} · interview ${interview.id}`} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <h3 className="break-words text-lg font-semibold">{interview.candidate.displayName}</h3><p className="mt-1 break-words text-sm text-neutral-600">{interview.job.title} · application {interview.application.stage}</p><p className="mt-2 break-all text-xs text-neutral-500">Interview {interview.id}</p><p className="mt-2 break-words text-sm text-neutral-600">{interview.startAt} · {interview.timeZone} · {interview.durationMinutes} minutes</p>
    {submitted ? <section id={id} aria-label="Own submitted sample scorecard" className="mt-5 min-w-0 rounded-lg bg-emerald-50 p-4" tabIndex={-1}><h4 className="font-semibold">Your submitted sample scorecard</h4><p className="mt-2 text-sm text-neutral-700">Revision {interview.ownScorecard!.revision} is immutable in this local preview.</p><dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">{rubricLabels.map(([key, label]) => <div key={key} className="contents"><dt>{label}</dt><dd>{interview.ownScorecard!.content.ratings[key]}/5</dd></div>)}</dl><p className="mt-3 whitespace-pre-wrap break-words text-sm">{interview.ownScorecard!.content.comments}</p></section>
      : <form id={id} aria-label={`Own scorecard for ${interview.candidate.displayName}`} className="mt-5 min-w-0 space-y-4" noValidate onSubmit={save}>
        <p className="text-sm text-neutral-600">Save a draft first. Only an explicit submission shares that saved revision with hiring review. Earlier drafts remain private to your fictional preview identity.</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">{rubricLabels.map(([key, label]) => <label key={key} className="min-w-0 text-sm font-medium">{label}<select className={field} required value={values[key]} onChange={event => change(previous => ({ ...previous, [key]: event.target.value }))}><option value="">Choose rating</option>{[1, 2, 3, 4, 5].map(rating => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>)}</div>
        <label className="block min-w-0 text-sm font-medium">Fictional scorecard comments<textarea className={field + ' min-h-32'} required minLength={3} maxLength={2000} value={values.comments} onChange={event => change(previous => ({ ...previous, comments: event.target.value }))} /></label>
        <label className="block min-w-0 text-sm font-medium">Scorecard recorded time in UTC<input className={field} required value={values.recordedAt} onChange={event => change(previous => ({ ...previous, recordedAt: event.target.value }))} placeholder="2026-10-15T09:00:00.000Z" autoComplete="off" /><span className="mt-1 block break-words text-xs text-neutral-500">Use an explicit UTC instant with milliseconds. {interview.lastOwnRecordedAt ? `Your previous action for this interview: ${interview.lastOwnRecordedAt}. Equality is allowed.` : 'Your first saved action has no earlier own time bound.'}</span></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className={button}>Preview own scorecard draft</button>{interview.ownScorecard?.state === 'draft' && <button type="button" className={secondary} onClick={() => preview('submit-scorecard')}>Preview scorecard submission</button>}<button type="button" className={secondary} onClick={discard}>Discard scorecard changes</button></div>
        {pending && <section role="region" aria-label="Own scorecard preview" className="min-w-0 rounded-lg border border-amber-300 bg-amber-50 p-4"><h4 className="font-semibold">{pending.preview.kind === 'save-scorecard' ? 'Own draft save preview' : 'Own scorecard submission preview'}</h4><p className="mt-2 text-sm">{pending.preview.kind === 'save-scorecard' ? `Save draft revision ${pending.preview.proposedRevision}.` : `Submit saved draft revision ${pending.preview.draftRevision}. This submitted revision will be immutable.`}</p><dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">{rubricLabels.map(([key, label]) => <div key={key} className="contents"><dt>{label}</dt><dd>{pending.preview.content.ratings[key]}/5</dd></div>)}</dl><p className="mt-3 whitespace-pre-wrap break-words text-sm">{pending.preview.content.comments}</p><p className="mt-3 break-words text-xs text-neutral-600">Recorded time: {pending.preview.recordedAt}. Preview has changed no record.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={confirm}>{pending.preview.kind === 'save-scorecard' ? 'Confirm own draft save' : 'Confirm scorecard submission'}</button><button type="button" className={secondary} onClick={clearPreview}>Cancel scorecard preview</button></div></section>}
      </form>}
    {error && <p role="alert" className="mt-4 break-words text-sm text-red-900">{error}</p>}{message && <p role="status" className="mt-4 break-words text-sm text-emerald-800">{message}</p>}
    <details className="mt-4 min-w-0 border-t border-neutral-100 pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Your own scorecard history</summary><ol className="mt-2 space-y-2 text-xs text-neutral-600">{interview.ownHistory.map((event, index) => <li key={index} className="break-words">{event.kind === 'saved' ? 'Draft saved' : 'Explicitly submitted'} · revision {event.revision} · {event.recordedAt}</li>)}{!interview.ownHistory.length && <li>No own scorecard actions have been saved for this interview.</li>}</ol></details>
  </article>
}

/** This component receives only the interviewer projection and its narrow port.
 * The trusted shell owns identity changes, complete state and replacement tools. */
export function HrRecruitingOwnScorecards({ view, port }: Props) {
  return <section className="min-w-0 space-y-5" aria-label="Own assigned interview scorecards"><header><h2 className="text-xl font-semibold">Your assigned sample interviews</h2><p className="mt-2 text-sm leading-6 text-neutral-600">This fictional interviewer preview contains only assigned context and your own scorecards. No invitations, external accounts or provider actions are created.</p></header>{view.assignedInterviews.map(interview => <OwnScorecardForm key={`${view.employeeId}:${interview.id}`} interview={interview} employeeId={view.employeeId} port={port} />)}{!view.assignedInterviews.length && <p className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-600">No sample interviews are assigned to this fictional identity.</p>}</section>
}
