import { useState, type FormEvent } from 'react'
import { useUnsavedTransition } from '@/portals/unsaved-work'
import { useHrFormDraft } from './useHrFormDraft'
import type { HrActor, HrFixture, HrRecord } from '../model'
import {
  canPeopleOperation, getPeopleActivity, getPeopleBalance, getPeoplePtoRequests, getPeopleRecords, peoplePtoHours,
  type LeaveType, type PeopleModule, type PeopleOperationsEvent, type PeopleOperationsState, type PeopleRecordModule,
} from '../people-operations'

export type PeopleOperationsProps = { state: PeopleOperationsState; actor: HrActor; fixture: HrFixture; module: PeopleModule; onAction: (event: PeopleOperationsEvent) => boolean | void }
const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const moduleTitles: Record<PeopleModule, string> = { 'time-off': 'Sample time-off requests', tasks: 'Assigned HR tasks', policies: 'Policy acknowledgments', training: 'Training assignments', assets: 'Equipment assignments and returns', documents: 'Document acknowledgments', activity: 'People operations activity' }

function readable(value: unknown) { return String(value ?? 'Not supplied').replace(/[-_]/g, ' ') }
function person(record: Pick<HrRecord, 'employeeId'> & { contractorId?: unknown }, fixture: HrFixture) {
  const employee = fixture.employees.find(value => value.id === record.employeeId)
  if (employee) return `${employee.firstName} ${employee.lastName}`
  const contractor = fixture.contractors.find(value => value.id === record.contractorId)
  return contractor ? String(contractor.name) : 'Unassigned sample record'
}
function Status({ status }: { status: unknown }) { return <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium capitalize text-neutral-700">{readable(status)}</span> }

function Activity({ state, actor, fixture, module }: Omit<PeopleOperationsProps, 'onAction'>) {
  const all = getPeopleActivity(state, actor, fixture).filter(entry => module === 'activity' || entry.module === module)
  const entries = all.slice(-12).reverse()
  return <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">{module === 'activity' ? 'Scoped simulation activity' : 'Recent sample activity'}</h2><p className="mt-2 text-xs leading-5 text-neutral-500">Ordered local simulation receipts. These entries record preview actions, not legal signatures, provider events, training certification or physical equipment custody.</p><ol className="mt-5 divide-y divide-neutral-100">{entries.map(entry => <li key={entry.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{readable(entry.action)}</p><span className="text-xs font-semibold text-emerald-800">{entry.receipt}</span></div><p className="mt-2 text-xs text-neutral-600">{person(entry, fixture)} · {readable(entry.previousStatus)} → {readable(entry.status)}</p><p className="mt-1 text-xs leading-5 text-neutral-500">{entry.description}</p><p className="mt-1 text-xs text-neutral-500">Preview actor: {person(entry.actor, fixture) === 'Unassigned sample record' ? readable(entry.actor.role) : `${person(entry.actor, fixture)} · ${readable(entry.actor.role)}`}</p></li>)}</ol>{!entries.length && <p className="mt-5 rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No people operation has been recorded in this identity’s scope. Complete a sample action to create its local receipt.</p>}</section>
}

function PtoContent({ state, actor, fixture, onAction }: Omit<PeopleOperationsProps, 'module'>) {
  const companyView = ['employer-owner', 'hr-admin', 'auditor', 'payroll-admin'].includes(actor.role)
  const admin = ['employer-owner', 'hr-admin'].includes(actor.role)
  const self = ['employee', 'manager'].includes(actor.role) && fixture.employees.some(employee => employee.id === actor.employeeId)
  const [employeeId, setEmployeeId] = useState(actor.employeeId ?? fixture.employees[0]?.id ?? '')
  const selectedEmployeeId = companyView ? employeeId : actor.employeeId ?? ''
  const request = useUnsavedTransition()
  const leaveId = `hr:leave:${actor.role}:${actor.employeeId ?? 'company'}`
  const leave = useHrFormDraft<{ startDate: string; endDate: string; leaveType: LeaveType }>({ id: leaveId, label: 'Sample leave request', initial: { startDate: '2026-10-15', endDate: '2026-10-15', leaveType: 'vacation' }, enabled: admin || self })
  const { startDate, endDate, leaveType } = leave.value
  const setStartDate = (startDate: string) => leave.setValue(previous => ({ ...previous, startDate }))
  const setEndDate = (endDate: string) => leave.setValue(previous => ({ ...previous, endDate }))
  const setLeaveType = (leaveType: LeaveType) => leave.setValue(previous => ({ ...previous, leaveType }))
  const [message, setMessage] = useState('')
  let hours: number | null = null
  let dateError = ''
  try { hours = peoplePtoHours(startDate, endDate) } catch (error) { dateError = error instanceof Error ? error.message : 'Check the dates.' }
  const requests = getPeoplePtoRequests(state, actor, fixture)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    try {
      const formData = new FormData(event.currentTarget)
      const submittedStartDate = String(formData.get('startDate') ?? '')
      const submittedEndDate = String(formData.get('endDate') ?? '')
      const submittedLeaveType = String(formData.get('leaveType') ?? '')
      if (submittedLeaveType !== 'vacation' && submittedLeaveType !== 'sick') throw new Error('Choose vacation or sick leave.')
      setStartDate(submittedStartDate)
      setEndDate(submittedEndDate)
      setLeaveType(submittedLeaveType)
      const result = onAction({ type: 'request-pto', employeeId: selectedEmployeeId, startDate: submittedStartDate, endDate: submittedEndDate, leaveType: submittedLeaveType })
      if (result !== false) { leave.accept({ startDate: submittedStartDate, endDate: submittedEndDate, leaveType: submittedLeaveType }); setMessage('Sample request recorded. Its hours are reserved until a scoped decision or cancellation.') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The sample request could not be recorded.') }
  }
  return <div className="space-y-5"><section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Fictional leave balances</h2><p className="mt-2 text-sm leading-6 text-neutral-600">This preview starts each employee with 40 vacation and 24 sick hours. Pending requests reserve hours; approved leave uses them. Rejection or cancellation releases them. The sample counts eight hours per Monday–Friday, with no holiday, accrual or legal eligibility calculation.</p>
    {companyView && <label className="mt-5 block max-w-md text-sm font-medium">Balance preview employee<select value={employeeId} onChange={event => { const employeeId = event.target.value; request({ portal: 'hr', ids: [leaveId], label: 'Change leave employee' }, () => setEmployeeId(employeeId)) }} className={field}>{fixture.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>}
    {selectedEmployeeId && <div className="mt-5 grid gap-4 sm:grid-cols-2">{(['vacation', 'sick'] as LeaveType[]).map(type => { const balance = getPeopleBalance(state, selectedEmployeeId, type); return <article key={type} className="rounded-lg bg-emerald-50 p-4"><h3 className="text-sm font-semibold capitalize text-emerald-900">{type} · {balance.available} h available</h3><dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-neutral-600"><div><dt>Sample total</dt><dd className="mt-1 font-semibold">{balance.total} h</dd></div><div><dt>Pending</dt><dd className="mt-1 font-semibold">{balance.pending} h</dd></div><div><dt>Approved</dt><dd className="mt-1 font-semibold">{balance.approved} h</dd></div></dl></article> })}</div>}
    {(admin || self) && <form id={leave.id} onSubmit={submit} className="mt-6 border-t border-neutral-200 pt-5"><h3 className="text-base font-semibold">Request sample leave{admin ? ' for the selected employee' : ' for yourself'}</h3><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Start date<input type="date" name="startDate" required value={startDate} onInput={event => setStartDate(event.currentTarget.value)} onChange={event => setStartDate(event.currentTarget.value)} className={field} /></label><label className="text-sm font-medium">End date<input type="date" name="endDate" required value={endDate} onInput={event => setEndDate(event.currentTarget.value)} onChange={event => setEndDate(event.currentTarget.value)} className={field} /></label><label className="text-sm font-medium">Leave type<select name="leaveType" value={leaveType} onChange={event => setLeaveType(event.currentTarget.value as LeaveType)} className={field}><option value="vacation">Vacation</option><option value="sick">Sick</option></select></label></div><p className="mt-3 text-xs text-neutral-500">{hours === null ? dateError : `${hours} sample hours requested. Pending and approved overlapping leave will be refused.`}</p><button type="submit" className={button + ' mt-4'} disabled={hours === null}>Submit sample leave request</button><p role="status" className="mt-3 text-sm text-emerald-800">{message}</p></form>}
  </section><section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Requests in your preview scope</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Managers decide direct-report requests and cannot approve their own. An employee may cancel their own pending or approved sample request; this local policy does not change an actual leave calendar.</p><div className="mt-4 divide-y divide-neutral-100">{requests.map(request => <article key={request.id} className="py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{person(request, fixture)}</h3><p className="mt-2 text-sm text-neutral-600">{request.startDate} → {request.endDate} · {request.hours} hours · {request.type}</p>{request.receipt && <p className="mt-2 text-xs font-semibold text-emerald-800">{request.receipt}</p>}{request.reason && <p className="mt-2 text-xs text-neutral-500">Sample note: {request.reason}</p>}</div><Status status={request.status} /></div><div className="mt-4 flex flex-wrap gap-3">{(['approve-pto', 'reject-pto', 'cancel-pto'] as const).map(type => { const event = { type, requestId: request.id }; return canPeopleOperation(state, event, actor, fixture) ? <button key={type} type="button" className={button} onClick={() => onAction(event)}>{type === 'approve-pto' ? 'Approve sample leave' : type === 'reject-pto' ? 'Reject sample leave' : 'Cancel sample leave'}</button> : null })}</div></article>)}</div>{!requests.length && <p className="mt-5 rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No requests are visible for this identity. Eligible employees can create one above.</p>}</section></div>
}

function recordActions(module: PeopleRecordModule, record: HrRecord, actor: HrActor) {
  const directReport = actor.role === 'manager' && record.employeeId !== actor.employeeId
  const administrative = ['employer-owner', 'hr-admin'].includes(actor.role)
  const completion = directReport ? 'Mark direct-report sample complete' : administrative ? 'Mark assigned sample complete' : module === 'training' ? 'Complete my sample training' : 'Complete my sample task'
  const event = (type: Extract<PeopleOperationsEvent, { recordId: string }>['type'], label: string) => ({ event: { type, recordId: record.id }, label })
  switch (module) {
    case 'tasks': return [event('complete-task', completion)]
    case 'training': return [event('complete-training', completion)]
    case 'policies': return [event('acknowledge-policy', 'Acknowledge my sample policy')]
    case 'documents': return [event('acknowledge-document', 'Acknowledge my sample document')]
    case 'assets': return [event('acknowledge-asset', 'Acknowledge sample assignment'), event('request-asset-return', 'Request sample asset return'), event('confirm-asset-return', 'Confirm sample asset return')]
  }
}

export function PeopleOperations(props: PeopleOperationsProps) {
  const { state, actor, fixture, module, onAction } = props
  if (module === 'activity') return <Activity state={state} actor={actor} fixture={fixture} module={module} />
  if (module === 'time-off') return <div className="space-y-5"><PtoContent key={`${actor.role}:${actor.employeeId ?? ''}`} state={state} actor={actor} fixture={fixture} onAction={onAction} /><Activity state={state} actor={actor} fixture={fixture} module={module} /></div>
  const records = getPeopleRecords(state, module, actor, fixture)
  const notes: Record<PeopleRecordModule, string> = {
    tasks: 'Complete assigned fictional HR tasks. Managers may explicitly mark a direct-report task complete; this does not complete SYSTEMX agent work.',
    policies: 'Each employee has a separate acknowledgment record. Only the assigned person can acknowledge their sample policy. No legal signature or actual handbook acceptance is produced.',
    training: 'Record completion of a fictional assignment. Managers may explicitly mark direct-report samples complete; this does not certify learning or compliance.',
    assets: 'Acknowledge a sample assignment, request return, then have its manager or HR confirm it. This exercise does not verify possession or physical custody.',
    documents: 'Acknowledge your own non-tax welcome, handbook, policy or training record. Tax forms, identity, banking, provider documents and legal signing remain unavailable.',
  }
  return <div className="space-y-5"><section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">{moduleTitles[module]}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{notes[module]}</p>{actor.role === 'auditor' && <p className="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">Auditor preview: read-only records and activity.</p>}<div className="mt-5 divide-y divide-neutral-100">{records.map(record => {
    const actions = recordActions(module, record, actor).filter(action => canPeopleOperation(state, action.event, actor, fixture))
    return <article key={record.id} className="py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold">{String(record.title ?? record.name ?? 'Sample record')}</h3><p className="mt-2 text-xs text-neutral-500">{person(record, fixture)}{record.version ? ` · version ${String(record.version)}` : ''}{record.dueDate ? ` · due ${String(record.dueDate)}` : ''}</p>{Boolean(record.receipt) && <p className="mt-2 text-xs font-semibold text-emerald-800">{String(record.receipt)}</p>}</div><Status status={record.status} /></div>{module === 'documents' && !['policy', 'handbook', 'welcome', 'training'].includes(String(record.type)) && <p className="mt-3 text-xs leading-5 text-neutral-500">Provider or restricted document placeholder. No acknowledgment, download or signature action is exposed.</p>}<div className="mt-4 flex flex-wrap gap-3">{actions.map(action => <button type="button" key={action.event.type} className={button} onClick={() => onAction(action.event)}>{action.label}</button>)}</div></article>
  })}</div>{!records.length && <p className="mt-5 rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">No assigned sample records are visible for this identity.</p>}</section><Activity state={state} actor={actor} fixture={fixture} module={module} /></div>
}
