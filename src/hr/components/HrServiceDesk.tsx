import { useState, type FormEvent } from 'react'
import { useUnsavedTransition } from '@/portals/unsaved-work'
import { useHrFormDraft } from './useHrFormDraft'
import type { HrActor, HrFixture } from '../model'
import { canManageHrRequest, hrRequestAssignees, hrRequestCategories, scopedHrRequests, type HrServiceDeskEvent, type HrServiceDeskState, type HrServiceRequest } from '../service-desk'

const fieldClass = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'

type Action = (event: HrServiceDeskEvent) => boolean | void

function RequestCard({ request, actor, fixture, onAction, onReveal }: { request: HrServiceRequest; actor: HrActor; fixture: HrFixture; onAction: Action; onReveal?: () => void }) {
  const permitted = canManageHrRequest(actor, request, fixture)
  const transition = useUnsavedTransition()
  const assignmentId = `hr:request:${request.id}:assignment`
  const assignment = useHrFormDraft({ id: assignmentId, label: `Request assignment ${request.id}`, initial: request.assigneeId ?? 'hr-team', enabled: permitted && request.status !== 'resolved', reveal: onReveal })
  const resolving = useHrFormDraft({ id: `hr:request:${request.id}:resolution`, label: `Request resolution ${request.id}`, initial: '', enabled: permitted && request.status === 'in-progress', reveal: onReveal })
  const assignee = assignment.value
  const resolution = resolving.value
  const employee = fixture.employees.find(person => person.id === request.employeeId)
  const assignees = hrRequestAssignees(actor, fixture, request)
  const currentAssignee = hrRequestAssignees({ role: 'employer-owner' }, fixture).find(person => person.id === request.assigneeId)?.label
  return <article className="rounded-lg border border-neutral-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{request.title}</h3><p className="mt-1 text-xs text-neutral-500">{request.id} · {hrRequestCategories.find(category => category.id === request.category)?.label} · {employee ? `${employee.firstName} ${employee.lastName}` : 'Company internal sample'}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium capitalize text-neutral-700">{request.status.replace('-', ' ')}</span></div>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">{request.details}</p>
    <p className="mt-3 text-xs text-neutral-500">Owner: {currentAssignee ?? 'Awaiting assignment'}</p>
    {request.resolution && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Sample resolution:</strong> {request.resolution}</p>}
    {permitted && <div className="mt-5 border-t border-neutral-100 pt-4">
      {request.status !== 'resolved' && <div id={assignment.id} className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm font-medium">Request owner<select className={fieldClass} value={assignee} onChange={event => assignment.setValue(event.target.value)}>{assignees.map(person => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label><button type="button" className={buttonClass + ' self-end'} disabled={request.assigneeId === assignee} onClick={() => { if (onAction({ type: 'assign-request', requestId: request.id, assigneeId: assignee }) !== false) assignment.accept() }}>Assign sample owner</button></div>}
      {request.status === 'open' && <button type="button" className={buttonClass + ' mt-4'} disabled={!request.assigneeId} onClick={() => onAction({ type: 'set-request-status', requestId: request.id, status: 'in-progress' })}>Start sample request</button>}
      {request.status === 'in-progress' && <div id={resolving.id} className="mt-4"><label className="text-sm font-medium">Sample resolution<textarea className={fieldClass} rows={2} minLength={3} maxLength={500} value={resolution} onChange={event => resolving.setValue(event.target.value)} placeholder="Describe the fictional outcome" /></label><button type="button" className={buttonClass + ' mt-3'} disabled={resolution.trim().length < 3} onClick={() => transition({ portal: 'hr', ids: [assignmentId], label: 'Resolve request' }, () => { if (onAction({ type: 'set-request-status', requestId: request.id, status: 'resolved', resolution }) !== false) resolving.accept('') })}>Resolve sample request</button></div>}
      {request.status === 'resolved' && <button type="button" className={buttonClass} onClick={() => onAction({ type: 'set-request-status', requestId: request.id, status: 'open' })}>Reopen sample request</button>}
    </div>}
    <details className="mt-4 text-xs text-neutral-500"><summary className="min-h-8 cursor-pointer py-2 font-medium">Sample activity · {request.activity.length} actions</summary><ol className="mt-2 space-y-2">{request.activity.map(activity => <li key={activity.receipt}>{activity.receipt} · {activity.action} · {activity.actorRole.replaceAll('-', ' ')}</li>)}{!request.activity.length && <li>Seeded company request; no actions yet.</li>}</ol></details>
  </article>
}

export function HrServiceDesk({ state, actor, fixture, onAction }: { state: HrServiceDeskState; actor: HrActor; fixture: HrFixture; onAction: Action }) {
  const draft = useHrFormDraft<{ category: 'equipment' | 'access' | 'hr-general'; title: string; details: string }>({ id: `hr:request:${actor.employeeId}:create`, label: 'New HR request', initial: { category: 'equipment', title: '', details: '' }, enabled: actor.role === 'employee' })
  const { category, title, details } = draft.value
  const setCategory = (category: typeof draft.value.category) => draft.setValue(previous => ({ ...previous, category }))
  const setTitle = (title: string) => draft.setValue(previous => ({ ...previous, title }))
  const setDetails = (details: string) => draft.setValue(previous => ({ ...previous, details }))
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const records = scopedHrRequests(state, actor, fixture)
  const visible = records.filter(record => filter === 'all' || record.status === filter)
  const supported = ['employee', 'manager', 'hr-admin', 'employer-owner', 'auditor'].includes(actor.role)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (onAction({ type: 'create-request', category, title, details }) !== false) { draft.accept({ category, title: '', details: '' }); setMessage('Sample request created. Switch to the manager or HR preview to assign, start and resolve it.') }
  }
  if (!supported) return <section className="rounded-xl border border-neutral-200 bg-white p-6"><h2 className="text-lg font-semibold">HR service desk</h2><p className="mt-3 text-sm text-neutral-600">This role has no access to general HR requests. Choose an employee, manager, owner, HR administrator or auditor preview.</p></section>
  return <div className="space-y-6">
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">HR service desk</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Track fictional equipment, app access and general HR requests from submission through resolution. Use sample information only. Saved requests stay in this browser across refresh; no messages or provider cases are sent.</p>
      <div className="mt-5 grid grid-cols-3 gap-3">{(['open', 'in-progress', 'resolved'] as const).map(status => <div key={status} className="rounded-lg bg-neutral-50 p-3"><p className="text-xs capitalize text-neutral-500">{status.replace('-', ' ')}</p><p className="mt-2 text-2xl font-semibold text-neutral-950">{records.filter(record => record.status === status).length}</p></div>)}</div>
      <p className="mt-4 text-xs text-neutral-500">{actor.role === 'employee' ? 'Your own requests are visible here. Managers and HR handle the next steps.' : actor.role === 'manager' ? 'Only direct-report requests are visible. Your own requests and company cases are excluded.' : actor.role === 'auditor' ? 'Read-only review of sample requests and their activity.' : 'Manage employee requests and internal company samples.'}</p>
    </section>
    {actor.role === 'employee' && <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">Create a sample request</h2><form id={draft.id} className="mt-5 space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Category<select className={fieldClass} value={category} onChange={event => setCategory(event.target.value as typeof category)}>{hrRequestCategories.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="block text-sm font-medium">Request title<input className={fieldClass} required minLength={3} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Demo laptop accessory" /></label><label className="block text-sm font-medium">Request details<textarea className={fieldClass} required minLength={3} maxLength={2000} rows={3} value={details} onChange={event => setDetails(event.target.value)} placeholder="Describe a fictional general request. Do not enter real employee, health, banking or identity details." /></label><button type="submit" className={buttonClass}>Submit sample request</button><p role="status" className="text-sm text-emerald-800">{message}</p></form></section>}
    <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold text-neutral-950">{actor.role === 'employee' ? 'My sample requests' : 'Sample request queue'}</h2><label className="text-sm font-medium">Request status<select className={fieldClass} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select></label></div><div className="mt-5 space-y-4">{records.map(request => <div key={`${actor.role}:${actor.employeeId ?? ''}:${request.id}`} hidden={filter !== 'all' && request.status !== filter}><RequestCard request={request} actor={actor} fixture={fixture} onAction={onAction} onReveal={() => setFilter('all')} /></div>)}{!visible.length && <p className="rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No sample requests match this view.</p>}</div></section>
  </div>
}
