import { useState, type FormEvent } from 'react'
import type { HrActor, HrFixture } from '../model'
import { canManageSurveys, scopedSurveys, surveyAggregate, surveySummary, type HrSurvey, type SurveysEvent, type SurveysState } from '../surveys'

const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
type Action = (event: SurveysEvent) => boolean | void

function DraftForm({ survey, fixture, onAction }: { survey?: HrSurvey; fixture: HrFixture; onAction: Action }) {
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const fields = { title: String(values.get('title') ?? ''), ratingPrompt: String(values.get('ratingPrompt') ?? ''), textPrompt: String(values.get('textPrompt') ?? ''), audienceIds: values.getAll('audience').map(String) }
    const action: SurveysEvent = survey ? { type: 'edit-survey', surveyId: survey.id, ...fields } : { type: 'create-survey', ...fields }
    if (onAction(action) !== false) {
      setDirty(false)
      setMessage(survey ? 'Sample draft saved. Publish when the questions and audience are ready.' : 'Sample survey draft created. Review it below before publishing.')
      if (!survey) form.reset()
    }
  }
  return <form className="space-y-4" onSubmit={submit} onChange={() => setDirty(true)}>
    <label className="block text-sm font-medium">Survey title<input className={field} name="title" defaultValue={survey?.title ?? ''} minLength={3} maxLength={100} required placeholder="Demo onboarding feedback" /></label>
    <label className="block text-sm font-medium">Rating question · 1–5<input className={field} name="ratingPrompt" defaultValue={survey?.questions.ratingPrompt ?? 'How clear are the sample onboarding next steps?'} minLength={3} maxLength={180} required /></label>
    <label className="block text-sm font-medium">Short-text question<input className={field} name="textPrompt" defaultValue={survey?.questions.textPrompt ?? 'What would improve this fictional onboarding experience?'} minLength={3} maxLength={180} required /></label>
    <fieldset><legend className="text-sm font-semibold">Employee audience</legend><p className="mt-1 text-xs leading-5 text-neutral-500">Choose at least one sample employee. The audience and questions become fixed when published; future hires are not added automatically.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{fixture.employees.map(employee => <label key={employee.id} className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-200 p-3 text-sm"><input type="checkbox" name="audience" value={employee.id} defaultChecked={survey ? survey.audienceIds.includes(employee.id) : false} className="size-4 accent-emerald-700" /><span>{employee.firstName} {employee.lastName}<span className="block text-xs text-neutral-500">{employee.department}</span></span></label>)}</div></fieldset>
    <button type="submit" className={button}>{survey ? 'Save sample survey draft' : 'Create sample survey draft'}</button><p role="status" className="text-sm text-emerald-800">{message}</p>
    {survey && <div className="border-t border-neutral-200 pt-4"><p className="text-xs leading-5 text-neutral-500">Save any edits before publishing. Publication fixes the saved questions and audience and makes this survey available to its assigned employee previews.</p><button type="button" className={button + ' mt-3'} disabled={dirty} onClick={() => onAction({ type: 'publish-survey', surveyId: survey.id })}>Publish saved sample survey</button>{dirty && <p className="mt-2 text-xs text-neutral-500">Save the draft before publishing these changes.</p>}</div>}
  </form>
}

function SurveyAnswers({ survey, actor, onAction }: { survey: HrSurvey; actor: HrActor; onAction: Action }) {
  const response = survey.responses.find(record => record.employeeId === actor.employeeId)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  if (response?.status === 'submitted') return <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-950"><h4 className="font-semibold">Your submitted sample response</h4><p className="mt-3">{survey.questions.ratingPrompt} <strong>{response.rating} / 5</strong></p><p className="mt-3 font-medium">{survey.questions.textPrompt}</p><p className="mt-1 whitespace-pre-wrap break-words leading-6">{response.text}</p><p className="mt-3 text-xs font-semibold">{response.receipt} · Submitted once; answers are locked.</p></div>
  if (survey.status === 'closed') return <p className="mt-5 rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">This sample survey is closed.{response ? ' Your saved answers were not submitted and are excluded from results.' : ' No response was submitted.'}{response && <span className="mt-3 block break-words">Your saved rating: {response.rating} / 5 · Your saved text: {response.text}</span>}</p>
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    if (onAction({ type: 'save-survey-response', surveyId: survey.id, rating: Number(values.get('rating')), text: String(values.get('text') ?? '') }) !== false) { setDirty(false); setMessage('Your sample answers are saved privately as a draft. Submit to include them in identified results.') }
  }
  return <div className="mt-5"><form className="space-y-4" onSubmit={save} onChange={() => setDirty(true)}>
    <label className="block text-sm font-medium">{survey.questions.ratingPrompt}<select name="rating" defaultValue={response?.rating ?? ''} required className={field}><option value="" disabled>Choose a sample rating</option>{[1, 2, 3, 4, 5].map(rating => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
    <label className="block text-sm font-medium">{survey.questions.textPrompt}<textarea className={field} name="text" defaultValue={response?.text ?? ''} required minLength={3} maxLength={500} rows={3} placeholder="Use fictional feedback only." /></label>
    <button type="submit" className={button}>Save my sample answers</button><p role="status" className="text-sm text-emerald-800">{message}</p>
  </form><div className="mt-4 border-t border-neutral-200 pt-4"><p className="text-xs leading-5 text-neutral-500">Submission shares your name and these answers with the owner, HR administrators and read-only auditor preview. Submitted answers cannot be edited or submitted again.</p><button type="button" className={button + ' mt-3'} disabled={!response || dirty} onClick={() => onAction({ type: 'submit-survey-response', surveyId: survey.id })}>Submit my sample response</button>{dirty && <p className="mt-2 text-xs text-neutral-500">Save your current answers before submitting.</p>}</div></div>
}

function Results({ survey, fixture }: { survey: HrSurvey; fixture: HrFixture }) {
  const aggregate = surveyAggregate(survey)
  return <div className="mt-5 border-t border-neutral-200 pt-5"><h4 className="font-semibold">Identified sample results</h4><p className="mt-2 text-sm text-neutral-600">{aggregate.submitted} of {aggregate.invited} assigned employees submitted · {aggregate.meanRating === null ? 'No submitted ratings' : `Average rating ${aggregate.meanRating.toFixed(2)} / 5`}</p><p className="mt-2 text-xs leading-5 text-neutral-500">These responses are identified. This preview does not provide anonymous collection, anonymization or a minimum response threshold. Saved drafts are private to their employee and excluded.</p>
    <dl className="mt-4 grid grid-cols-5 gap-2">{aggregate.ratings.map(({ rating, count }) => <div key={rating} className="rounded-md bg-neutral-50 p-3 text-center"><dt className="text-xs text-neutral-500">{rating} / 5</dt><dd className="mt-1 text-lg font-semibold">{count}</dd></div>)}</dl>
    <div className="mt-4 space-y-3">{survey.responses.filter(response => response.status === 'submitted').map(response => { const employee = fixture.employees.find(person => person.id === response.employeeId); return <article key={response.employeeId} className="rounded-md border border-neutral-200 p-4"><h5 className="text-sm font-semibold">{employee ? `${employee.firstName} ${employee.lastName}` : 'Former sample employee'} · {response.rating} / 5</h5><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">{response.text}</p><p className="mt-2 text-xs text-emerald-800">{response.receipt}</p></article> })}</div>
  </div>
}

export function HrSurveys({ state, actor, fixture, onAction }: { state: SurveysState; actor: HrActor; fixture: HrFixture; onAction: Action }) {
  const surveys = scopedSurveys(state, actor, fixture)
  const counts = surveySummary(state, actor, fixture)
  const manage = canManageSurveys(actor)
  const results = manage || actor.role === 'auditor'
  return <div className="space-y-6">
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">{actor.role === 'employee' ? 'My sample surveys' : 'Employee feedback surveys'}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Run synthetic employee feedback with a rating and short-text question. Draft → publish → employee save → employee submit → close. Saved surveys and responses stay in this browser across refresh and send no messages. Use fictional information only.</p><p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>Identified feedback:</strong> submitted names and answers are visible to owner, HR and auditor previews. This is not anonymous feedback or a channel for real employee or sensitive information.</p>
      <dl className="mt-5 grid grid-cols-3 gap-3">{[{ label: actor.role === 'employee' ? 'Assigned surveys' : 'Draft surveys', count: actor.role === 'employee' ? counts.assigned : counts.draft }, { label: 'Open surveys', count: counts.published }, { label: actor.role === 'employee' ? 'Awaiting my response' : 'Submitted responses', count: actor.role === 'employee' ? counts.unsubmitted : counts.submittedResponses }].map(item => <div key={item.label} className="rounded-lg bg-neutral-50 p-3"><dt className="text-xs text-neutral-500">{item.label}</dt><dd className="mt-2 text-2xl font-semibold">{item.count}</dd></div>)}</dl>
    </section>
    {manage && <details className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><summary className="min-h-8 cursor-pointer text-lg font-semibold">Create a sample survey</summary><div className="mt-5"><DraftForm fixture={fixture} onAction={onAction} /></div></details>}
    {surveys.map(survey => <section key={survey.id} className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{survey.title}</h3><p className="mt-1 text-xs text-neutral-500">{survey.id}{results && ` · ${survey.audienceIds.length} assigned sample employees`}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold capitalize">{survey.status}</span></div>
      {survey.status === 'draft' && manage ? <div className="mt-5"><DraftForm key={survey.activity.length} survey={survey} fixture={fixture} onAction={onAction} /></div> : results ? <div className="mt-4 text-sm text-neutral-600"><p>Rating: {survey.questions.ratingPrompt}</p><p className="mt-2">Text: {survey.questions.textPrompt}</p></div> : null}
      {actor.role === 'employee' && <SurveyAnswers key={`${actor.employeeId}:${survey.id}`} survey={survey} actor={actor} onAction={onAction} />}
      {results && survey.status !== 'draft' && <Results survey={survey} fixture={fixture} />}
      {manage && survey.status === 'published' && <button type="button" className={button + ' mt-5'} onClick={() => onAction({ type: 'close-survey', surveyId: survey.id })}>Close sample survey</button>}
      {survey.receipt && <p className="mt-4 text-xs font-semibold text-emerald-800">{survey.receipt}</p>}
    </section>)}
    {!surveys.length && <section className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">{actor.role === 'employee' ? 'No published or closed sample survey is assigned to you. Draft survey content is not visible.' : 'This role has no survey records in its preview scope.'}</section>}
  </div>
}
