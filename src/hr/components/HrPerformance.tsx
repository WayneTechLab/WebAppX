import { useState, type FormEvent } from 'react'
import type { HrActor, HrFixture } from '../model'
import { canAssignPerformance, canReviewPerformance, isPerformanceSelf, performanceSummary, scopedPerformance, type PerformanceEvent, type PerformanceGoal, type PerformanceReview, type PerformanceState } from '../performance'

const fieldClass = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
type Action = (event: PerformanceEvent) => boolean | void
type Props = { state: PerformanceState; actor: HrActor; fixture: HrFixture; onAction: Action }

function personName(employeeId: string, fixture: HrFixture) {
  const employee = fixture.employees.find(person => person.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown sample employee'
}

function Activity({ record }: { record: PerformanceGoal | PerformanceReview }) {
  return <details className="mt-4 text-xs text-neutral-500"><summary className="min-h-8 cursor-pointer py-2 font-medium">Sample activity · {record.activity.length} actions</summary><ol className="mt-2 space-y-2">{record.activity.map(item => <li key={item.receipt}>{item.receipt} · {item.action} · {item.actorRole.replaceAll('-', ' ')}</li>)}{!record.activity.length && <li>Seeded sample; no actions yet.</li>}</ol></details>
}

function GoalCard({ goal, actor, fixture, onAction }: { goal: PerformanceGoal; actor: HrActor; fixture: HrFixture; onAction: Action }) {
  const editable = isPerformanceSelf(actor, goal.employeeId, fixture) && goal.status !== 'completed'
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onAction({ type: 'update-goal-progress', goalId: goal.id, progress: Number(data.get('progress')) })
  }
  return <article className="rounded-lg border border-neutral-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{goal.title}</h3><p className="mt-1 text-xs text-neutral-500">{personName(goal.employeeId, fixture)} · {goal.id}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium capitalize text-neutral-700">{goal.status}</span></div>
    <div className="mt-4 flex items-center gap-3"><progress aria-label={`Goal progress for ${goal.title}`} className="h-3 w-full accent-emerald-700" max={100} value={goal.progress} /><span className="text-sm font-semibold tabular-nums text-neutral-800">{goal.progress}%</span></div>
    {editable && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={save}><label className="text-sm font-medium">Progress for {goal.title}<input className={fieldClass} type="number" name="progress" min={0} max={100} step={1} required defaultValue={goal.progress} /></label><button className={buttonClass} type="submit">Save sample progress</button><button className={buttonClass} type="button" onClick={() => onAction({ type: 'update-goal-progress', goalId: goal.id, progress: 100 })}>Complete sample goal</button></form>}
    {!editable && <p className="mt-3 text-xs text-neutral-500">{goal.status === 'completed' ? 'Completed sample goals are locked.' : 'The employee records their own progress. Managers and HR can assign goals.'}</p>}
    <Activity record={goal} />
  </article>
}

function ReviewCard({ review, actor, fixture, onAction }: { review: PerformanceReview; actor: HrActor; fixture: HrFixture; onAction: Action }) {
  const [selfDraft, setSelfDraft] = useState(review.selfComments ?? '')
  const [managerDraft, setManagerDraft] = useState(review.managerComments ?? '')
  const name = personName(review.employeeId, fixture)
  const own = isPerformanceSelf(actor, review.employeeId, fixture)
  const reviewer = canReviewPerformance(actor, review, fixture)
  const published = ['published', 'acknowledged'].includes(review.stage)
  function saveSelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAction({ type: 'save-self-review', reviewId: review.id, comments: String(new FormData(event.currentTarget).get('comments') ?? '') })
  }
  function saveManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAction({ type: 'save-manager-review', reviewId: review.id, comments: String(new FormData(event.currentTarget).get('comments') ?? '') })
  }
  return <article className="rounded-lg border border-neutral-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{review.title} · {name}</h3><p className="mt-1 text-xs text-neutral-500">Reviewer: {personName(review.managerId, fixture)} · {review.id}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium capitalize text-neutral-700">{review.stage.replaceAll('-', ' ')}</span></div>
    <p className="mt-4 text-xs leading-5 text-neutral-500">Self-review → manager review → publication → employee acknowledgment. Acknowledgment records receipt; it does not record agreement or determine compensation.</p>
    {own && review.stage === 'draft' ? <form className="mt-4 space-y-3" onSubmit={saveSelf}><label className="block text-sm font-medium">Self-review draft for {name}<textarea name="comments" className={fieldClass} required minLength={3} maxLength={2000} rows={3} value={selfDraft} onInput={event => setSelfDraft(event.currentTarget.value)} onChange={event => setSelfDraft(event.target.value)} placeholder="Describe a fictional accomplishment and a next step." /></label><p className="text-xs text-neutral-500">Your draft stays private until you submit it. Use fictional work examples. Save your current text before submitting.</p><div className="flex flex-wrap gap-3"><button className={buttonClass} type="submit">Save self-review draft</button><button className={buttonClass} type="button" disabled={!review.selfComments || selfDraft.trim() !== review.selfComments} onClick={() => onAction({ type: 'submit-self-review', reviewId: review.id })}>Submit sample self-review</button></div></form> : review.selfComments ? <div className="mt-4 rounded-md bg-neutral-50 p-4"><h4 className="text-sm font-semibold text-neutral-800">Submitted self-review</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">{review.selfComments}</p></div> : <p className="mt-4 rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">{review.stage === 'draft' ? 'Awaiting employee self-review. Private drafts are not shared.' : 'Review comments are not included in this role’s view.'}</p>}
    {reviewer && ['self-submitted', 'manager-review'].includes(review.stage) && <form className="mt-4 space-y-3" onSubmit={saveManager}><label className="block text-sm font-medium">Manager review draft for {name}<textarea name="comments" className={fieldClass} required minLength={3} maxLength={2000} rows={3} value={managerDraft} onInput={event => setManagerDraft(event.currentTarget.value)} onChange={event => setManagerDraft(event.target.value)} placeholder="Record fictional feedback, support and next steps." /></label><p className="text-xs text-neutral-500">Only you can see this manager draft until publication. Publishing shares it with the employee and HR. Save your current text before publishing.</p><div className="flex flex-wrap gap-3"><button className={buttonClass} type="submit">Save manager review draft</button><button className={buttonClass} type="button" disabled={!review.managerComments || managerDraft.trim() !== review.managerComments} onClick={() => onAction({ type: 'publish-review', reviewId: review.id })}>Publish sample review</button></div></form>}
    {published && review.managerComments && <div className="mt-4 rounded-md bg-emerald-50 p-4"><h4 className="text-sm font-semibold text-emerald-950">Published manager review</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-900">{review.managerComments}</p></div>}
    {own && review.stage === 'published' && <button className={buttonClass + ' mt-4'} type="button" onClick={() => onAction({ type: 'acknowledge-review', reviewId: review.id })}>Acknowledge sample review</button>}
    {!own && !reviewer && !published && actor.role !== 'auditor' && <p className="mt-4 text-xs text-neutral-500">HR and the owner administer cycles. The employee submits their own review; the assigned direct manager writes and publishes feedback.</p>}
    {review.stage === 'acknowledged' && <p className="mt-4 text-sm font-medium text-emerald-800">Employee acknowledgment recorded. This review is locked.</p>}
    <Activity record={review} />
  </article>
}

export function HrPerformance({ state, actor, fixture, onAction }: Props) {
  const scoped = scopedPerformance(state, actor, fixture)
  const summary = performanceSummary(state, actor, fixture)
  const goalEmployees = fixture.employees.filter(employee => isPerformanceSelf(actor, employee.id, fixture) || canAssignPerformance(actor, employee.id, fixture))
  const reviewEmployees = fixture.employees.filter(employee => canAssignPerformance(actor, employee.id, fixture) && employee.managerId && employee.managerId !== employee.id && fixture.employees.some(manager => manager.id === employee.managerId) && !state.reviews.some(review => review.employeeId === employee.id && review.stage !== 'acknowledged'))
  const supported = ['employee', 'manager', 'employer-owner', 'hr-admin', 'auditor'].includes(actor.role)
  function create(event: FormEvent<HTMLFormElement>, type: 'create-goal' | 'create-review') {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (onAction({ type, employeeId: String(data.get('employeeId') ?? ''), title: String(data.get('title') ?? '') }) !== false) form.reset()
  }
  if (!supported) return <section className="rounded-xl border border-neutral-200 bg-white p-6"><h2 className="text-lg font-semibold">Goals and performance reviews</h2><p className="mt-3 text-sm text-neutral-600">This preview role cannot access sample performance records.</p></section>
  return <div className="space-y-6">
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Goals and performance reviews</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Practice goals and a complete review cycle with fictional work examples. Changes stay in this browser session. No messages, automated scoring or employment decisions are made.</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: 'Goals complete', value: `${summary.completedGoals} / ${summary.goals}` }, { label: 'Open reviews', value: summary.openReviews }, { label: 'Your self-reviews due', value: summary.selfReviewsDue }, { label: 'Your manager reviews due', value: summary.managerReviewsDue }].map(stat => <div key={stat.label} className="rounded-lg bg-neutral-50 p-3"><p className="text-xs text-neutral-500">{stat.label}</p><p className="mt-2 text-2xl font-semibold text-neutral-950">{stat.value}</p></div>)}</div><p className="mt-4 text-xs text-neutral-500">{actor.role === 'employee' ? 'Only your goals and reviews appear here. Your manager’s draft remains private until publication.' : actor.role === 'manager' ? 'Your own records and direct reports appear here. You cannot review yourself or edit a report’s self-review.' : actor.role === 'auditor' ? 'Read-only sample metadata. Review comments are excluded.' : 'HR and owner manage goals and review cycles. Draft self-reviews and unpublished manager comments remain private.'}</p></section>
    {(goalEmployees.length > 0 || reviewEmployees.length > 0) && <div className="grid gap-6 lg:grid-cols-2">{goalEmployees.length > 0 && <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Create a sample goal</h2><form className="mt-4 space-y-4" onSubmit={event => create(event, 'create-goal')}><label className="block text-sm font-medium">Goal employee<select name="employeeId" className={fieldClass}>{goalEmployees.map(employee => <option key={employee.id} value={employee.id}>{personName(employee.id, fixture)}</option>)}</select></label><label className="block text-sm font-medium">Goal title<input name="title" className={fieldClass} required minLength={3} maxLength={100} placeholder="Demo documentation improvement" /></label><button type="submit" className={buttonClass}>Create sample goal</button></form></section>}{reviewEmployees.length > 0 && <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Open a sample review cycle</h2><form className="mt-4 space-y-4" onSubmit={event => create(event, 'create-review')}><label className="block text-sm font-medium">Review employee<select name="employeeId" className={fieldClass}>{reviewEmployees.map(employee => <option key={employee.id} value={employee.id}>{personName(employee.id, fixture)}</option>)}</select></label><label className="block text-sm font-medium">Review cycle title<input name="title" className={fieldClass} required minLength={3} maxLength={100} placeholder="Demo next-quarter review" /></label><p className="text-xs text-neutral-500">Each employee needs a separate assigned manager. Finish and acknowledge the existing review before opening another cycle.</p><button type="submit" className={buttonClass}>Open sample review cycle</button></form></section>}</div>}
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Sample goals</h2><div className="mt-5 space-y-4">{scoped.goals.map(goal => <GoalCard key={`${actor.role}:${actor.employeeId ?? ''}:${goal.id}`} goal={goal} actor={actor} fixture={fixture} onAction={onAction} />)}{!scoped.goals.length && <p className="rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No sample goals are assigned in this view.</p>}</div></section>
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Sample review cycles</h2><div className="mt-5 space-y-4">{scoped.reviews.map(review => <ReviewCard key={`${actor.role}:${actor.employeeId ?? ''}:${review.id}`} review={review} actor={actor} fixture={fixture} onAction={onAction} />)}{!scoped.reviews.length && <p className="rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No sample reviews are assigned in this view.</p>}</div></section>
  </div>
}
