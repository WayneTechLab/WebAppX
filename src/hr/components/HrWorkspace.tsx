import { useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Circle, FileText, RefreshCcw, Users } from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import { hrFixture, hrRoutes } from '../catalog'
import {
  canApproveTimeEntry, canEditEmployeeProfile, canViewCompensation, canViewRoute, demoPath, formatMoney,
  matchHrRoute, portalRoles, portalRoots, resolveHrPath, scopedEmployees,
  scopedRecords, searchEmployees, validateTimeEntry,
  type HrActor, type HrEmployee, type HrPortal, type HrRecord, type HrRole, type HrRoute,
} from '../model'
import { MOCK_PAY_PERIOD, startMockTimer, stopMockTimer, transitionMockHr, type MockBenefitElection, type MockHrEvent, type MockOnboarding, type MockPayroll, type MockTimer } from '../mock-workflows'

import { peopleOperationsSummary, type PeopleModule, type PeopleOperationsEvent } from '../people-operations'
import { applyLinkedPeopleOperation } from '../linked-operations'
import { PeopleOperations } from './PeopleOperations'
import { scopedHrRequests, transitionHrServiceDesk, type HrServiceDeskEvent } from '../service-desk'
import { HrServiceDesk } from './HrServiceDesk'
import { HrDashboard, HrReports, HrPayHistory } from './HrInsights'
import { recruitingSummary, type RecruitingEvent } from '../recruiting'
import { applyRecruitingToHr, recruitingFixture } from '../recruiting-link'
import { HrRecruiting } from './HrRecruiting'
import { performanceSummary, transitionPerformance, type PerformanceEvent } from '../performance'
import { HrPerformance } from './HrPerformance'
import { surveySummary, transitionSurveys, type SurveysEvent } from '../surveys'
import { HrSurveys } from './HrSurveys'
import { createHrDemoState, isHrDemoState, type HrDemoState } from '../persistence'
import { useDemoPersistence } from '@/portals/useDemoPersistence'
import { DemoStorageNotice } from '@/portals/DemoStorageNotice'
import { DemoWorkspaceBackup } from '@/portals/DemoWorkspaceBackup'

const fieldClass = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const portalLabels: Record<HrPortal, string> = { admin: 'Management', employee: 'Employee', manager: 'Manager', contractor: 'Contractor' }

function label(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Not included'
  return String(value).replace(/[-_]/g, ' ')
}

function Status({ value }: { value: unknown }) {
  return <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium capitalize text-neutral-700">{label(value)}</span>
}

function Panel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">{title}</h2>{note && <p className="mt-2 text-sm leading-6 text-neutral-600">{note}</p>}<div className="mt-5">{children}</div></section>
}

function RecordTable({ records, empty, columns = ['title', 'status'] }: { records: HrRecord[]; empty: string; columns?: string[] }) {
  if (!records.length) return <p className="rounded-md bg-neutral-50 p-4 text-sm text-neutral-600">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead><tr className="border-b border-neutral-200">{columns.map(column => <th scope="col" key={column} className="px-3 py-3 font-semibold capitalize text-neutral-500">{column.replace(/([a-z])([A-Z])/g, '$1 $2')}</th>)}</tr></thead>
        <tbody>{records.map(record => <tr key={record.id} className="border-b border-neutral-100 last:border-0">{columns.map(column => <td key={column} className="px-3 py-4 text-neutral-700">{column === 'status' ? <Status value={record[column]} /> : label(record[column] ?? (column === 'title' ? record.name : undefined))}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function EmployeeDirectory({ employees, portal, canOpenProfile }: { employees: HrEmployee[]; portal: HrPortal; canOpenProfile: boolean }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = searchEmployees(employees, query, status)
  const statuses = [...new Set(employees.map(employee => employee.employmentStatus))]
  return (
    <Panel title={portal === 'manager' ? 'Your demo team' : 'Employee directory'} note="All names and records are fictional. Search by name, department, work email or job.">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="text-sm font-medium">Search employees<input className={fieldClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, department or job" /></label>
        <label className="text-sm font-medium">Employment status<select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      </div>
      <p className="mt-4 text-xs text-neutral-500" aria-live="polite">{filtered.length} of {employees.length} fictional employees</p>
      <div className="mt-4 divide-y divide-neutral-100">
        {filtered.map(employee => <article key={employee.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800">{employee.firstName?.slice(0, 1)}{employee.lastName?.slice(0, 1)}</span><div><h3 className="font-semibold text-neutral-950">{employee.firstName} {employee.lastName}</h3><p className="mt-1 text-xs text-neutral-500">{employee.jobTitle} · {employee.department}</p><p className="mt-1 break-all text-xs text-neutral-500">{employee.workEmail}</p></div></div>
          <div className="flex items-center gap-3"><Status value={employee.employmentStatus} />{portal === 'admin' && canOpenProfile ? <AppLink to={`/hr/demo/admin/employees/${employee.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800">View record<ChevronRight className="h-4 w-4" aria-hidden="true" /></AppLink> : portal === 'manager' && <AppLink to="/hr/demo/manager/tasks" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">View team tasks</AppLink>}</div>
        </article>)}
        {!filtered.length && <p className="py-6 text-sm text-neutral-600">No fictional employees match these filters. Try a different name or status.</p>}
      </div>
    </Panel>
  )
}

function Onboarding({ employee, completed, onToggle }: { employee: Pick<HrEmployee, 'id' | 'firstName' | 'onboarding'>; completed: Set<string>; onToggle: (key: string) => void }) {
  const items = employee.onboarding ?? []
  const done = items.filter(item => item.status === 'complete' || item.status === 'completed' || completed.has(`${employee.id}:${item.id}`)).length
  return <Panel title={`Onboarding · ${employee.firstName}`} note="This checklist simulates app-owned tasks. Tax forms, bank details, identity checks and legally binding signatures require the approved provider workflow.">
    <p className="text-sm font-medium text-emerald-800" aria-live="polite">{done} of {items.length} sample tasks complete</p>
    <div className="mt-4 grid gap-3">{items.map(item => {
      const key = `${employee.id}:${item.id}`
      const preset = item.status === 'complete' || item.status === 'completed'
      const isDone = preset || completed.has(key)
      return <button type="button" key={item.id} aria-pressed={isDone} disabled={preset} onClick={() => onToggle(key)} className="flex min-h-14 items-center gap-3 rounded-lg border border-neutral-200 p-4 text-left text-sm hover:bg-neutral-50 disabled:cursor-default">
        {isDone ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />}<span className="flex-1 font-medium">{item.title}</span><span className="text-xs text-neutral-500">{isDone ? 'Complete' : 'Mark complete'}</span>
      </button>
    })}</div>
    {!items.length && <p className="mt-4 text-sm text-neutral-500">No sample onboarding tasks are assigned.</p>}
  </Panel>
}

function OnboardingJourney({ employee, state, onAction }: { employee: HrEmployee; state: MockOnboarding; onAction: (event: MockHrEvent) => void }) {
  const ready = state.profileReviewed && state.jobReviewed && Object.values(state.tasks).every(Boolean)
  return <Panel title={`Complete sample onboarding · ${employee.firstName}`} note="A complete app-owned simulation. Review fictional profile/job details, finish the checklist, review the summary and confirm. No tax, bank, legal signature or Gusto acceptance is established.">
    <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-lg bg-neutral-50 p-4"><h3 className="text-sm font-semibold">1 · Profile review</h3><p className="mt-2 text-sm text-neutral-600">{employee.firstName} {employee.lastName}<br />{employee.workEmail}</p><button type="button" className={buttonClass + ' mt-4'} disabled={state.profileReviewed || state.stage === 'complete'} onClick={() => onAction({ type: 'review-profile', employeeId: employee.id })}>{state.profileReviewed ? 'Profile reviewed' : 'Review sample profile'}</button></article><article className="rounded-lg bg-neutral-50 p-4"><h3 className="text-sm font-semibold">2 · Job review</h3><p className="mt-2 text-sm text-neutral-600">{employee.jobTitle}<br />{employee.department}</p><button type="button" className={buttonClass + ' mt-4'} disabled={state.jobReviewed || state.stage === 'complete'} onClick={() => onAction({ type: 'review-job', employeeId: employee.id })}>{state.jobReviewed ? 'Job reviewed' : 'Review sample job'}</button></article></div>
    <h3 className="mt-6 text-sm font-semibold">3 · App-owned checklist</h3><div className="mt-3 grid gap-3">{employee.onboarding.map(task => <button type="button" key={task.id} aria-pressed={Boolean(state.tasks[task.id])} disabled={state.stage === 'complete'} onClick={() => onAction({ type: 'check-task', employeeId: employee.id, taskId: task.id, complete: !state.tasks[task.id] })} className="flex min-h-14 items-center gap-3 rounded-lg border border-neutral-200 p-4 text-left text-sm disabled:cursor-default">{state.tasks[task.id] ? <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> : <Circle className="h-5 w-5 text-neutral-400" aria-hidden="true" />}<span className="flex-1 font-medium">{task.title}</span><span className="text-xs text-neutral-500">{state.tasks[task.id] ? 'Complete' : 'Mark complete'}</span></button>)}</div>
    <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><h3 className="text-sm font-semibold">4 · Review and confirm</h3><p className="mt-2 text-sm text-neutral-600">Profile: {state.profileReviewed ? 'reviewed' : 'pending'} · Job: {state.jobReviewed ? 'reviewed' : 'pending'} · Checklist: {Object.values(state.tasks).filter(Boolean).length}/{Object.keys(state.tasks).length}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={!ready || state.stage !== 'draft'} onClick={() => onAction({ type: 'review-onboarding', employeeId: employee.id })}>Review onboarding summary</button><button type="button" className={buttonClass} disabled={state.stage !== 'reviewed'} onClick={() => onAction({ type: 'complete-onboarding', employeeId: employee.id })}>Confirm simulated onboarding</button></div><p role="status" className="mt-4 text-sm font-semibold text-emerald-800">{state.stage === 'complete' ? `Simulated onboarding completed · ${state.receipt}. Demo directory status is now active.` : `Sample status: ${state.stage}`}</p></div>
  </Panel>
}

function TimeEntries({ actor, records, employees, onAction }: { actor: HrActor; records: HrRecord[]; employees: HrEmployee[]; onAction: (event: MockHrEvent) => boolean }) {
  const [date, setDate] = useState('2026-10-15')
  const [hours, setHours] = useState('8')
  const [message, setMessage] = useState('')
  const [timer, setTimer] = useState<MockTimer | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateTimeEntry(date, Number(hours))
    if (!result.valid || !actor.employeeId) { setMessage(result.error ?? 'A synthetic employee identity is required.'); return }
    if (onAction({ type: 'add-time', date, hours: Number(hours), source: 'manual' })) setMessage('Sample draft added. Submit your timesheet, then use the manager preview to approve it before payroll preparation.')
  }
  const visible = scopedRecords(actor, records, employees)
  const employeeNames = new Map(employees.map(employee => [employee.id, `${employee.firstName} ${employee.lastName}`]))
  const ownDrafts = visible.filter(entry => entry.employeeId === actor.employeeId && entry.status === 'draft')
  const timerEmployee = timer ? employees.find(employee => employee.id === timer.employeeId) : undefined
  function stopTimer() {
    if (!timer) return
    try {
      const entry = stopMockTimer(timer, actor, Date.now(), { ...hrFixture, employees })
      if (onAction(entry)) setMessage(`Sample timer recorded ${entry.hours} hours on ${entry.date} as a draft. Elapsed time is rounded for this demo.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The timer could not be recorded.') }
    finally { setTimer(null) }
  }
  function startTimer() {
    try {
      setTimer(startMockTimer(actor, date, Date.now(), { ...hrFixture, employees }))
      setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The timer could not be started.') }
  }
  return <Panel title="Sample timesheet journey" note="Draft entry/timer → employee submission → scoped manager approval → fictional payroll inclusion. Real overtime, clock policy, wages and exports are not calculated.">
    {['employee', 'manager'].includes(actor.role) && <><form onSubmit={submit} className="mb-5 grid items-end gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Work date<input type="date" required className={fieldClass} value={date} onChange={event => setDate(event.target.value)} /></label><label className="text-sm font-medium">Hours<input type="number" min="0.01" max="24" step="0.01" required className={fieldClass} value={hours} onChange={event => setHours(event.target.value)} /></label><button className={buttonClass} type="submit">Add sample time</button></form><div className="mb-5 flex flex-wrap gap-3"><button className={buttonClass} type="button" onClick={() => timer ? stopTimer() : startTimer()}>{timer ? 'Stop and add sample time' : 'Start sample timer'}</button><button className={buttonClass} type="button" disabled={!ownDrafts.length} onClick={() => { if (onAction({ type: 'submit-time', entryIds: ownDrafts.map(entry => entry.id) })) setMessage('Own sample timesheet submitted. A different authorized manager must approve it.') }}>Submit own sample timesheet</button></div><p role="status" className="mb-5 text-sm text-emerald-800">{timer ? `Sample timer running for ${timerEmployee ? `${timerEmployee.firstName} ${timerEmployee.lastName}` : 'the selected employee'} on ${timer.date}; changing the preview identity or resetting cancels it.` : message}</p></>}
    <div className="divide-y divide-neutral-100">{visible.map(entry => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{employeeNames.get(String(entry.employeeId)) ?? label(entry.employeeId)}</h3><p className="mt-1 text-xs text-neutral-500">{label(entry.date)} · {label(entry.hours)} hours · {label(entry.source)}{entry.payrollReceipt ? ` · included in ${entry.payrollReceipt}` : ''}</p></div><div className="flex items-center gap-3"><Status value={entry.status} />{canApproveTimeEntry(actor, entry, employees) && <button type="button" className="min-h-11 text-sm font-semibold text-emerald-800" onClick={() => onAction({ type: 'approve-time', entryId: entry.id })}>Approve sample time</button>}</div></article>)}</div>{!visible.length && <p className="text-sm text-neutral-500">No time entries in this identity's scope.</p>}
  </Panel>
}

function PayrollPreview({ payrolls }: { payrolls: HrRecord[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const payroll = payrolls.find(record => record.id === selected)
  return <div className="grid gap-5"><Panel title="Synthetic payroll history" note="These read-only historical fixture amounts are separate from the current simulation and its receipts above. They do not establish payroll, funding or money movement."><div className="divide-y divide-neutral-100">{payrolls.map(record => <article key={record.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{label(record.payPeriodStart)} to {label(record.payPeriodEnd)}</h3><p className="mt-1 text-xs text-neutral-500">Pay date {label(record.payDate)} · {label(record.employeeCount)} employees</p></div><div className="flex items-center gap-3"><Status value={record.status} /><button className="min-h-11 text-sm font-semibold text-emerald-800" type="button" onClick={() => setSelected(record.id)}>Preview totals</button></div></article>)}</div></Panel>{payroll && <Panel title="Sample payroll totals" note="Preview only. These values do not establish tax accuracy, funding readiness or payroll acceptance."><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-neutral-500">Gross pay</dt><dd className="mt-2 text-xl font-semibold">{formatMoney(payroll.grossPayCents)}</dd></div><div><dt className="text-sm text-neutral-500">Net pay</dt><dd className="mt-2 text-xl font-semibold">{formatMoney(payroll.netPayCents)}</dd></div><div><dt className="text-sm text-neutral-500">Provider submission</dt><dd className="mt-2 text-sm font-semibold">Unavailable in mock mode</dd></div></dl><button className={buttonClass + ' mt-5'} type="button" disabled>Submit payroll requires approved live adapter</button></Panel>}</div>
}

function PayrollJourney({ state, history, actor, onAction }: { state: MockPayroll; history: MockPayroll[]; actor: HrActor; onAction: (event: MockHrEvent) => boolean }) {
  const permitted = ['employer-owner', 'payroll-admin'].includes(actor.role)
  return <Panel title="Run a simulated payroll" note="Use approved sample timesheets. Every rate and deduction is deliberately fictional: $30/hour, flat 20% illustrative withholding and $25 per confirmed enrolled plan, capped at each employee's own available net. This is not a tax engine, wage calculation or money movement.">
    <p className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">Fixed sample pay period: {MOCK_PAY_PERIOD.start} to {MOCK_PAY_PERIOD.end}. Only active employees with approved, unpaid entries in this period are included.</p>
    <ol className="flex flex-wrap gap-2 text-xs font-medium text-neutral-600"><li className="rounded-full bg-neutral-100 px-3 py-2">1 · Prepare approved inputs</li><li className="rounded-full bg-neutral-100 px-3 py-2">2 · Calculate fictional totals</li><li className="rounded-full bg-neutral-100 px-3 py-2">3 · Review</li><li className="rounded-full bg-neutral-100 px-3 py-2">4 · Simulate receipt</li></ol>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-neutral-50 p-4"><p className="text-xs font-semibold uppercase text-neutral-500">Prepared snapshot</p><p className="mt-2 text-sm font-semibold">{state.inputs.length} approved entries · {state.hours} hours</p><p className="mt-2 text-xs leading-5 text-neutral-500">Hours and confirmed benefit elections freeze when prepared. Later changes wait for a new preparation. Receipted entries are excluded from later runs.</p><p className="mt-3 text-xs font-medium">{state.benefitInputs.length} enrolled-plan deductions in this snapshot</p></div><dl className="grid gap-3 rounded-lg border border-neutral-200 p-4 text-sm"><div className="flex justify-between gap-4"><dt>Fictional gross</dt><dd className="font-semibold">{formatMoney(state.grossCents)}</dd></div><div className="flex justify-between gap-4"><dt>Illustrative withholding</dt><dd>{formatMoney(state.illustrativeWithholdingCents)}</dd></div><div className="flex justify-between gap-4"><dt>Sample benefit deductions</dt><dd>{formatMoney(state.benefitDeductionCents)}</dd></div><div className="flex justify-between gap-4 border-t border-neutral-200 pt-3"><dt>Simulated net</dt><dd className="font-semibold">{formatMoney(state.netCents)}</dd></div></dl></div>
    {permitted && <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={buttonClass} onClick={() => onAction({ type: 'prepare-payroll' })}>Prepare sample payroll</button><button type="button" className={buttonClass} disabled={state.stage !== 'prepared'} onClick={() => onAction({ type: 'calculate-payroll' })}>Calculate fictional totals</button><button type="button" className={buttonClass} disabled={state.stage !== 'calculated'} onClick={() => onAction({ type: 'review-payroll' })}>Review simulated payroll</button><button type="button" className={buttonClass} disabled={state.stage !== 'reviewed'} onClick={() => onAction({ type: 'submit-payroll' })}>Simulate payroll submission</button></div>}
    <p role="status" className="mt-5 text-sm font-semibold text-emerald-800">{state.stage === 'submitted' ? `Simulated submission complete · ${state.receipt}. No money moved and no provider was contacted.` : `Sample payroll stage: ${state.stage}`}</p>
    {history.length > 0 && <div className="mt-5 border-t border-neutral-200 pt-4"><h3 className="text-sm font-semibold">Simulation receipts</h3><ul className="mt-3 grid gap-2 text-xs text-neutral-600">{history.map(run => <li key={run.receipt}>{run.receipt} · {run.hours} hours · fictional net {formatMoney(run.netCents)}</li>)}</ul></div>}
  </Panel>
}

function BenefitsJourney({ actor, elections, onAction }: { actor: HrActor; elections: MockBenefitElection[]; onAction: (event: MockHrEvent) => boolean }) {
  const self = actor.role === 'employee'
  const plans = self ? hrFixture.benefits.filter(plan => Array.isArray(plan.employeeIds) && plan.employeeIds.includes(actor.employeeId)) : hrFixture.benefits
  const visibleElections = self ? elections.filter(election => election.employeeId === actor.employeeId) : ['employer-owner', 'hr-admin'].includes(actor.role) ? elections : []
  return <Panel title={self ? 'Choose and confirm sample benefits' : 'Sample benefits administration'} note="Enrollment/waiver → review → confirm → own summary. Plans, coverage and eligibility are fictional. Confirmed enrollment adds an illustrative deduction to subsequently prepared sample payroll; no carrier or provider is contacted.">
    <div className="grid gap-4">{plans.map(plan => {
      const election = visibleElections.find(value => value.planId === plan.id && value.employeeId === actor.employeeId)
      return <article key={plan.id} className="rounded-lg border border-neutral-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-base font-semibold">{label(plan.name)}</h3><p className="mt-2 text-xs text-neutral-500">{label(plan.type)} · illustrative $25 deduction per simulated payroll for enrollment</p></div><Status value={election?.stage ?? plan.status} /></div>{self && <><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={election?.stage === 'confirmed'} onClick={() => onAction({ type: 'elect-benefit', planId: plan.id, election: 'enroll' })}>Elect sample enrollment</button><button type="button" className={buttonClass} disabled={election?.stage === 'confirmed'} onClick={() => onAction({ type: 'elect-benefit', planId: plan.id, election: 'waive' })}>Elect sample waiver</button><button type="button" className={buttonClass} disabled={election?.stage !== 'draft'} onClick={() => onAction({ type: 'review-benefit', planId: plan.id })}>Review sample election</button><button type="button" className={buttonClass} disabled={election?.stage !== 'reviewed'} onClick={() => onAction({ type: 'confirm-benefit', planId: plan.id })}>Confirm sample election</button></div><p className="mt-3 text-sm text-emerald-800" role="status">{election ? `${election.election} · ${election.stage}${election.receipt ? ` · ${election.receipt}` : ''}` : 'No sample election selected.'}</p></>}</article>
    })}</div>{!plans.length && <p className="text-sm text-neutral-500">No sample plans are available for this bound employee.</p>}
    <div className="mt-6 border-t border-neutral-200 pt-5"><h3 className="text-sm font-semibold">{self ? 'Your sample election summary' : 'Confirmed sample employee elections'}</h3><div className="mt-3"><RecordTable records={visibleElections.filter(election => self || election.stage === 'confirmed').map(election => ({ id: `${election.employeeId}:${election.planId}`, employeeId: election.employeeId, title: String(hrFixture.benefits.find(plan => plan.id === election.planId)?.name), election: election.election, status: election.stage, receipt: election.receipt ?? 'Not confirmed' }))} empty="No sample elections in this role's scope." columns={self ? ['title', 'election', 'status', 'receipt'] : ['employeeId', 'title', 'election', 'status']} /></div></div>
  </Panel>
}

function NativeRecords({ kind, title, actor, employees, acknowledgements, onAcknowledge }: { kind: string; title: string; actor: HrActor; employees: HrEmployee[]; acknowledgements: Set<string>; onAcknowledge: (id: string) => void }) {
  const original = hrFixture.native[kind] ?? []
  const records = ['employee', 'manager', 'contractor'].includes(actor.role) && !['policies', 'surveys'].includes(kind) ? scopedRecords(actor, original, employees) : original
  const canAcknowledge = actor.role === 'employee' && ['policies', 'training'].includes(kind)
  return <Panel title={title} note="App-owned HR records, independent of the payroll provider. Preview actions only change this synthetic session."><div className="divide-y divide-neutral-100">{records.map(record => <article key={record.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{label(record.title ?? record.name)}</h3><p className="mt-1 text-xs leading-5 text-neutral-500">{label(record.description ?? record.detail ?? record.category ?? record.version ?? record.employeeId)}</p></div><div className="flex items-center gap-3"><Status value={acknowledgements.has(record.id) ? 'acknowledged in demo' : record.status} />{canAcknowledge && <button type="button" className="min-h-11 text-sm font-semibold text-emerald-800 disabled:text-neutral-400" disabled={acknowledgements.has(record.id)} onClick={() => onAcknowledge(record.id)}>{acknowledgements.has(record.id) ? 'Acknowledged' : 'Acknowledge sample'}</button>}</div></article>)}</div>{!records.length && <p className="text-sm text-neutral-500">No sample records are supplied for this identity. The portable specification describes this module's future adapter.</p>}</Panel>
}

function EmployeeProfile({ employee, actor, email, onEmail }: { employee: HrEmployee; actor: HrActor; email?: string; onEmail: (value: string) => boolean }) {
  const [value, setValue] = useState(email ?? employee.workEmail)
  const [message, setMessage] = useState('')
  const editable = canEditEmployeeProfile(actor, employee.id)
  return <Panel title={`${employee.firstName} ${employee.lastName}`} note="Fictional profile. Sensitive tax, bank, identity and emergency-contact values are intentionally absent."><dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Job</dt><dd className="mt-1 font-medium">{employee.jobTitle}</dd></div><div><dt className="text-neutral-500">Department</dt><dd className="mt-1 font-medium">{employee.department}</dd></div><div><dt className="text-neutral-500">Employment</dt><dd className="mt-2"><Status value={employee.employmentStatus} /></dd></div>{canViewCompensation(actor, employee.id) && <div><dt className="text-neutral-500">Sample compensation amount</dt><dd className="mt-1 font-medium">{employee.compensationConfigured === false ? 'Unconfigured for this sample hire' : formatMoney(employee.payCents)} <span className="text-xs font-normal text-neutral-500">· fixture only; cadence not inferred</span></dd></div>}</dl><form className="mt-6 grid gap-3" onSubmit={event => { event.preventDefault(); if (!editable) return; if (onEmail(value)) setMessage('Sample profile saved in this session. Open onboarding to review any pending requirements. No account or provider record was changed.') }}><label className="text-sm font-medium">Synthetic work email<input className={fieldClass} type="email" disabled={!editable} value={value} onChange={event => setValue(event.target.value)} required /></label><div><button className={buttonClass} disabled={!editable} type="submit">Save sample profile</button></div><p className="text-sm text-emerald-800" role="status">{editable ? message : "This preview role has read-only profile access."}</p></form></Panel>
}

function Specification({ route }: { route: HrRoute }) {
  return <Panel title="Integration boundary" note={`${route.backing.replace(/-/g, ' ')} · ${route.capabilityId}`}><ul className="grid gap-2 text-sm text-neutral-600">{route.sections.map(section => <li key={section} className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />{section}</li>)}</ul>{route.actions.length > 0 && <div className="mt-5 flex flex-wrap gap-3">{route.actions.map(action => <button key={action.id} type="button" disabled title={action.description} className={buttonClass}>{action.label} · adapter required</button>)}</div>}<p className="mt-5 text-xs leading-5 text-neutral-500">Portable actions above are specifications. Only explicitly labeled sample controls on this page run in mock mode. The Gusto Embedded React SDK is a separate optional adapter; this workspace does not simulate provider authorization or compliance acceptance.</p></Panel>
}

export function HrWorkspace({ pathname }: { pathname: string }) {
  const resolution = resolveHrPath(pathname === '/hr/demo' ? '/hr/demo/admin' : pathname)
  const portal = resolution?.portal ?? 'admin'
  const { state, setState, reset: resetStoredState, status: storageStatus, importState } = useDemoPersistence('hr', () => createHrDemoState(hrFixture), value => isHrDemoState(value, hrFixture))
  const { recruiting, performance, surveys, operations, serviceDesk, workflow, managementRole, selectedEmployee } = state
  const fixture = recruitingFixture(hrFixture, recruiting)
  const defaultManager = fixture.employees.find(employee => fixture.employees.some(report => report.managerId === employee.id)) ?? fixture.employees[0]
  const completed = new Set(state.completed)
  const acknowledgements = new Set(state.acknowledgements)
  function setPart<K extends keyof HrDemoState>(key: K, value: HrDemoState[K]) { setState(previous => ({ ...previous, [key]: value })) }
  const [workflowMessage, setWorkflowMessage] = useState('')
  const [workflowError, setWorkflowError] = useState(false)
  const [resetGeneration, setResetGeneration] = useState(0)
  const actor: HrActor = { role: portal === 'admin' ? managementRole : portalRoles[portal], employeeId: portal === 'manager' ? defaultManager?.id : portal === 'employee' ? selectedEmployee : undefined, contractorId: portal === 'contractor' ? fixture.contractors[0]?.id : undefined }
  const selected = resolution && matchHrRoute(resolution.canonical, hrRoutes)
  const route = selected?.route
  const employeeId = selected?.parameters.employeeId ?? actor.employeeId
  const demoEmployees = fixture.employees.map(record => ({ ...record, workEmail: workflow.profileEmails[record.id] ?? record.workEmail, employmentStatus: workflow.employeeStatuses[record.id] ?? record.employmentStatus, onboardingStatus: workflow.onboarding[record.id]?.stage === 'complete' ? 'simulated-complete' : record.onboardingStatus }))
  const employee = demoEmployees.find(record => record.id === employeeId)
  const contractor = fixture.contractors.find(record => record.id === (selected?.parameters.contractorId ?? actor.contractorId))
  const employees = scopedEmployees(actor, demoEmployees)
  const navRoutes = hrRoutes.filter(item => item.portal === portal && !item.path.includes(':') && canViewRoute(actor, item))
  const suffix = resolution?.canonical.slice(portalRoots[portal].length).replace(/^\//, '') ?? ''
  const module = suffix.split('/')[0]
  const nativeKinds: Record<string, string> = { recruiting: 'jobs', policies: 'policies', assets: 'assets', tasks: 'tasks', training: 'training', performance: 'performance', cases: 'cases', 'case-management': 'cases', surveys: 'surveys', automation: 'automations', access: 'access' }

  function toggle(key: string) { setState(previous => ({ ...previous, completed: previous.completed.includes(key) ? previous.completed.filter(value => value !== key) : [...previous.completed, key] })) }
  function acknowledge(id: string) { setState(previous => ({ ...previous, acknowledgements: [...new Set([...previous.acknowledgements, id])] })) }
  function reset() {
    resetStoredState()
    setResetGeneration(previous => previous + 1); setWorkflowMessage('Original synthetic HR records are restored in this view. CMS and CRM samples are unchanged.'); setWorkflowError(false)
  }
  function runAction(event: MockHrEvent) {
    try {
      setPart('workflow', transitionMockHr(workflow, actor, event, fixture))
      setWorkflowMessage('Simulated change recorded in this preview only. No provider call or money movement occurred.')
      setWorkflowError(false)
      return true
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : 'The sample transition could not be applied.')
      setWorkflowError(true)
      return false
    }
  }
  function runPeopleAction(event: PeopleOperationsEvent) {
    try {
      const next = applyLinkedPeopleOperation(workflow, operations, event, actor, fixture)
      setState(previous => ({ ...previous, operations: next.operations, workflow: next.workflow }))
      setWorkflowMessage('Sample people operation recorded. Dashboards and scoped activity reflect this session.')
      setWorkflowError(false)
      return true
    } catch (error) { setWorkflowMessage(error instanceof Error ? error.message : 'The sample action failed.'); setWorkflowError(true); return false }
  }
  function runServiceAction(event: HrServiceDeskEvent) {
    try {
      setPart('serviceDesk', transitionHrServiceDesk(serviceDesk, actor, event, fixture))
      setWorkflowMessage('Fictional HR request updated in this session.')
      setWorkflowError(false)
      return true
    } catch (error) { setWorkflowMessage(error instanceof Error ? error.message : 'The sample request failed.'); setWorkflowError(true); return false }
  }
  const openServiceRequests = scopedHrRequests(serviceDesk, actor, fixture).filter(request => request.status !== 'resolved').length
  const operationsSummary = peopleOperationsSummary(operations, actor, fixture)
  function runRecruitingAction(event: RecruitingEvent) {
    try {
      const next = applyRecruitingToHr(recruiting, workflow, operations, actor, event, hrFixture)
      setState(previous => ({ ...previous, recruiting: next.recruiting, workflow: next.workflow, operations: next.operations }))
      setWorkflowMessage('Sample recruiting updated. Hired candidates appear in the employee directory and onboarding preview.'); setWorkflowError(false); return true
    } catch (error) { setWorkflowMessage(error instanceof Error ? error.message : 'The sample recruiting action failed.'); setWorkflowError(true); return false }
  }
  function runPerformanceAction(event: PerformanceEvent) {
    try {
      setPart('performance', transitionPerformance(performance, actor, event, fixture))
      setWorkflowMessage('Sample performance workflow saved in this session.'); setWorkflowError(false); return true
    } catch (error) { setWorkflowMessage(error instanceof Error ? error.message : 'The sample review action failed.'); setWorkflowError(true); return false }
  }
  function runSurveyAction(event: SurveysEvent) {
    try {
      setPart('surveys', transitionSurveys(surveys, actor, event, fixture))
      setWorkflowMessage('Sample survey workflow saved in this session.'); setWorkflowError(false); return true
    } catch (error) { setWorkflowMessage(error instanceof Error ? error.message : 'The sample survey action failed.'); setWorkflowError(true); return false }
  }
  const recruitingCounts = recruitingSummary(recruiting, actor)
  const talent = {
    recruiting: { publishedJobs: recruitingCounts.openJobs, activeCandidates: recruitingCounts.activeCandidates, hires: recruitingCounts.hires },
    performance: performanceSummary(performance, actor, fixture),
    surveys: surveySummary(surveys, actor, fixture),
  }
  function content() {
    if (!route || !canViewRoute(actor, route)) return <Panel title={!route ? 'Preview page not found' : 'This preview role cannot open this page'}><p className="text-sm leading-6 text-neutral-600">Choose a page from this portal's navigation. Role previews affect fictional data only.</p></Panel>
    if (selected?.parameters.employeeId && !employee) return <Panel title="Fictional employee not found"><p className="text-sm text-neutral-600">The requested ID is not in the synthetic fixture. No provider record is queried.</p></Panel>
    if (selected?.parameters.contractorId && !contractor) return <Panel title="Fictional contractor not found"><p className="text-sm text-neutral-600">The requested ID is not in the synthetic fixture.</p></Panel>
    if (selected?.parameters.payrollId && !fixture.payrolls.some(record => record.id === selected.parameters.payrollId)) return <Panel title="Fictional payroll not found"><p className="text-sm text-neutral-600">The requested payroll ID is not in the synthetic fixture.</p></Panel>
    if (route.capabilityId === 'employee-directory' || module === 'people' || module === 'team') return <EmployeeDirectory employees={employees} portal={portal} canOpenProfile={hrRoutes.some(item => item.portal === 'admin' && item.capabilityId === 'employee-profile' && canViewRoute(actor, item))} />
    if (['employee-profile', 'employee-compensation'].includes(route.capabilityId) && employee) return <div className="grid gap-5"><EmployeeProfile key={`${actor.role}:${employee.id}:${resetGeneration}`} employee={employee} actor={actor} email={workflow.profileEmails[employee.id]} onEmail={value => runAction({ type: 'change-profile', employeeId: employee.id, workEmail: value })} />{portal === 'admin' && <div className="flex flex-wrap gap-4 text-sm font-semibold"><AppLink to={`/hr/demo/admin/employees/${employee.id}/onboarding`} className="underline underline-offset-4">Onboarding checklist</AppLink>{canViewCompensation(actor, employee.id) && <AppLink to={`/hr/demo/admin/employees/${employee.id}/compensation`} className="underline underline-offset-4">Compensation specification</AppLink>}</div>}</div>
    if (route.capabilityId === 'employee-onboarding' && employee) return <OnboardingJourney employee={employee} state={workflow.onboarding[employee.id]} onAction={runAction} />
    if (route.capabilityId === 'contractor-profile' && contractor) return <Panel title="Fictional contractor profile" note="Contractors have their own identity and payment domain. No employee compensation or private employee record is included."><RecordTable records={[contractor]} empty="No contractor in scope." columns={['name', 'email', 'type', 'onboardingStatus']} />{portal === 'admin' && <AppLink className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" to={`/hr/demo/admin/contractors/${contractor.id}/onboarding`}>Review contractor checklist</AppLink>}</Panel>
    if (route.capabilityId === 'contractor-onboarding' && contractor) return <Onboarding employee={{ id: contractor.id, firstName: String(contractor.name), onboarding: contractor.onboarding as HrEmployee['onboarding'] ?? [] }} completed={completed} onToggle={toggle} />
    if (['time-off', 'tasks', 'policies', 'training', 'assets', 'activity'].includes(module) && portal !== 'contractor') return <PeopleOperations key={`${actor.role}:${actor.employeeId ?? 'none'}:${module}:${resetGeneration}`} state={operations} actor={actor} fixture={fixture} module={module as PeopleModule} onAction={runPeopleAction} />
    if (module === 'cases' || module === 'requests' || module === 'support') return <HrServiceDesk key={`${actor.role}:${actor.employeeId ?? 'none'}:${resetGeneration}`} state={serviceDesk} actor={actor} fixture={fixture} onAction={runServiceAction} />
    if (module === 'time' || module === 'time-tracking') return <TimeEntries key={`${actor.role}:${actor.employeeId ?? 'none'}:${resetGeneration}`} actor={actor} records={workflow.timeEntries} employees={demoEmployees} onAction={runAction} />
    if (module === 'payroll' && actor.role === 'auditor') return <Panel title="Simulated payroll receipt inventory" note="Read-only receipt counts and workflow metadata. This role has no compensation access."><RecordTable records={workflow.payrollHistory.map(run => ({ id: run.receipt ?? 'unreceipted', title: run.receipt, entries: run.inputs.length, status: run.stage }))} empty="No submitted simulated payroll receipts in this session." columns={['title', 'entries', 'status']} /><p className="mt-4 text-sm text-neutral-600">{fixture.payrolls.length} separate historical fixture payrolls. Amounts and payroll controls are unavailable to this role.</p></Panel>
    if (module === 'payroll') return <div className="grid gap-5"><PayrollJourney state={workflow.payroll} history={workflow.payrollHistory} actor={actor} onAction={runAction} /><PayrollPreview payrolls={selected?.parameters.payrollId ? fixture.payrolls.filter(record => record.id === selected.parameters.payrollId) : fixture.payrolls} /></div>
    if (route.capabilityId === 'contractor-directory') return <Panel title="Contractor directory"><RecordTable records={fixture.contractors} empty="No sample contractors." columns={['name', 'type', 'onboardingStatus']} /><div className="mt-4 flex flex-wrap gap-4">{fixture.contractors.map(record => <AppLink key={record.id} to={`/hr/demo/admin/contractors/${record.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">View {String(record.name)}</AppLink>)}</div></Panel>
    if (module === 'contractor-payments' || portal === 'contractor' && module === 'payments') return <Panel title="Contractor payment preview" note="No payment is initiated. Fixed sample amounts are independent of employee payroll."><RecordTable records={(portal === 'contractor' ? scopedRecords(actor, fixture.contractorPayments ?? [], fixture.employees) : fixture.contractorPayments ?? []).map(record => ({ ...record, amount: formatMoney(record.amountCents) }))} empty="No payments in this contractor's scope." columns={['title', 'amount', 'date', 'status']} /><button className={buttonClass + ' mt-5'} disabled type="button">Submit contractor payment · live adapter required</button></Panel>
    if (module === 'benefits') return <BenefitsJourney actor={actor} elections={workflow.benefitElections} onAction={runAction} />
    if (route.capabilityId === 'paystubs') return <HrPayHistory actor={actor} fixture={fixture} state={workflow} />
    if (module === 'documents' && portal !== 'contractor') return <PeopleOperations key={`${actor.role}:${actor.employeeId ?? 'none'}:${module}:${resetGeneration}`} state={operations} actor={actor} fixture={fixture} module={module as PeopleModule} onAction={runPeopleAction} />
    if (route.capabilityId === 'documents') return <Panel title={module === 'tax-documents' ? 'Tax document placeholders' : 'Document index'} note="No real PDF, tax form, bank number or legal signature is supplied. Secure downloads and provider forms require live authorization."><RecordTable records={scopedRecords(actor, fixture.documents, fixture.employees).filter(record => module !== 'tax-documents' || record.type === 'tax')} empty="No documents in this identity's scope." columns={['title', 'type', 'status']} /></Panel>
    if (module === 'recruiting') return <HrRecruiting key={`${actor.role}:${resetGeneration}`} state={recruiting} actor={actor} fixture={fixture} onAction={runRecruitingAction} />
    if (module === 'performance') return <HrPerformance key={`${actor.role}:${actor.employeeId ?? 'none'}:${resetGeneration}`} state={performance} actor={actor} fixture={fixture} onAction={runPerformanceAction} />
    if (module === 'surveys') return <HrSurveys key={`${actor.role}:${actor.employeeId ?? 'none'}:${resetGeneration}`} state={surveys} actor={actor} fixture={fixture} onAction={runSurveyAction} />
    if (nativeKinds[module]) return <NativeRecords kind={nativeKinds[module]} title={route.title} actor={actor} employees={fixture.employees} acknowledgements={acknowledgements} onAcknowledge={acknowledge} />
    if (module === 'reports' || module === 'analytics') return <HrReports actor={actor} fixture={fixture} state={workflow} requests={operations.ptoRequests} operations={operationsSummary} openOperations={operationsSummary.openCount} openServiceRequests={openServiceRequests} talent={talent} />
    if (route.capabilityId === 'company-locations') return <Panel title="Work locations" note="Synthetic location metadata. Jurisdiction registration and worksite validation are not established."><RecordTable records={fixture.locations ?? []} empty="No sample locations." columns={['name', 'state', 'status']} /></Panel>
    if (route.capabilityId === 'pay-schedules') return <Panel title="Sample pay schedules" note="Illustrative cadence only. Provider assignment and processing deadlines remain live-gated."><RecordTable records={fixture.paySchedules ?? []} empty="No sample schedules." columns={['title', 'frequency', 'status']} /></Panel>
    if (['company-taxes', 'company-banking'].includes(route.capabilityId)) return <Panel title={route.title} note="Sensitive values are intentionally omitted from the template. Use the authorized Gusto flow through the reviewed server proxy."><p className="text-sm leading-6 text-neutral-600">{route.capabilityId === 'company-banking' ? 'Bank account connection, account verification and employer funding authorization are unavailable in mock mode.' : 'Federal and state tax identifiers, registrations and filing setup are unavailable in mock mode.'}</p></Panel>
    if (module === 'company' || module === 'setup') return <Panel title="Fictional company setup" note="Provider onboarding gates are specifications until a Gusto Demo connection is authorized."><RecordTable records={[fixture.company]} empty="No company fixture." columns={['name', 'status']} /><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Operating mode</dt><dd className="mt-1 font-semibold">Mock · no credentials</dd></div><div><dt className="text-neutral-500">Payroll authorization</dt><dd className="mt-1 font-semibold">Disabled</dd></div></dl></Panel>
    if (module === 'departments' || module === 'organization' || module === 'locations' || module === 'pay-schedules') return <Panel title={route.title} note="Derived fictional organization data. Department and location administration remain adapter specifications."><RecordTable records={[...new Set(employees.map(record => record.department))].map((name, index) => ({ id: `department-${index}`, title: name, status: 'sample' }))} empty="No departments in scope." /></Panel>
    if (module === 'integrations' || module === 'sync' || module === 'audit' || module === 'requests' || module === 'support') return <Panel title={route.title} note="The portable package defines the provider and server contracts. This browser workspace has no Gusto connection or cloud write path."><dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Gusto</dt><dd className="mt-1 font-semibold">Mock preview · disconnected</dd></div><div><dt className="text-neutral-500">Firestore projection</dt><dd className="mt-1 font-semibold">Not provisioned</dd></div><div><dt className="text-neutral-500">Webhook verification</dt><dd className="mt-1 font-semibold">Specification only</dd></div><div><dt className="text-neutral-500">Shared test key</dt><dd className="mt-1 font-semibold">None embedded</dd></div></dl></Panel>
    if (!module) return portal === 'contractor' ? <Panel title="Your fictional contractor record"><RecordTable records={fixture.contractors.filter(record => record.id === actor.contractorId)} empty="No contractor in scope." columns={['name', 'type', 'onboardingStatus']} /></Panel> : <HrDashboard actor={actor} portal={portal} fixture={fixture} state={workflow} requests={operations.ptoRequests} operations={operationsSummary} openOperations={operationsSummary.openCount} openServiceRequests={openServiceRequests} talent={talent} />
    return <Panel title={route.title}><p className="text-sm leading-6 text-neutral-600">This module has a page specification and navigation contract. Its application adapter is not implemented in this first mock phase.</p></Panel>
  }

  return <section className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950"><p className="text-sm font-semibold">Synthetic HR demo · no account or credentials required</p><p className="mt-1 text-xs leading-5">Fictional records only. Saved sample changes use this browser’s local storage and survive refresh when storage is available. No Firebase or Gusto connection is used. Do not enter real employee information.</p></div>
    <DemoStorageNotice status={storageStatus} />
    <DemoWorkspaceBackup key={resetGeneration} module="hr" state={state} validate={value => isHrDemoState(value, hrFixture)} summarize={value => `${hrFixture.employees.length + value.recruiting.hiredEmployees.length} people · ${value.workflow.payrollHistory.length} payroll receipts · ${value.surveys.surveys.length} surveys`} onImport={value => {
      const result = importState(value)
      if (result.ok) { setResetGeneration(previous => previous + 1); setWorkflowMessage(result.status.message); setWorkflowError(false) }
      return result
    }} />
    <div className="mt-7 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label(fixture.company.name)} · {portalLabels[portal]} preview</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{route?.title ?? 'HR preview'}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{route?.description ?? 'Choose a standard people portal.'}</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold"><RefreshCcw className="h-4 w-4" aria-hidden="true" />Reset sample changes</button></div>
    {workflowMessage && <p role={workflowError ? 'alert' : 'status'} className={`mt-4 rounded-md px-4 py-3 text-sm ${workflowError ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{workflowMessage}</p>}
    <nav aria-label="Demo portals" className="mt-6 flex flex-wrap gap-2">{(Object.keys(portalRoots) as HrPortal[]).map(value => <AppLink key={value} to={`/hr/demo/${value}`} aria-current={portal === value ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${portal === value ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>{portalLabels[value]}</AppLink>)}<AppLink to="/hr/demo/sdk" className="inline-flex min-h-11 items-center rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800">Gusto SDK preview</AppLink></nav>
    <div className="mt-5 rounded-lg bg-neutral-50 p-4">{portal === 'admin' ? <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Synthetic management role<select className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={managementRole} onChange={event => setPart('managementRole', event.target.value as HrRole)}><option value="employer-owner">Employer owner</option><option value="payroll-admin">Payroll admin</option><option value="hr-admin">HR admin</option><option value="auditor">Auditor</option></select><span className="text-xs font-normal text-neutral-500">Changes demo navigation only; never Firebase claims.</span></label> : portal === 'employee' ? <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Synthetic employee identity<select className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={selectedEmployee} onChange={event => setPart('selectedEmployee', event.target.value)}>{fixture.employees.map(record => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</select><span className="text-xs font-normal text-neutral-500">Own records only; fictional identity preview.</span></label> : <p className="flex items-center gap-2 text-sm text-neutral-600"><Users className="h-4 w-4" aria-hidden="true" />{portal === 'contractor' ? label(fixture.contractors[0]?.name) : `${defaultManager?.firstName} ${defaultManager?.lastName}`} · {portalRoles[portal]} · fictional identity</p>}</div>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[14rem_1fr]"><aside className="rounded-xl border border-neutral-200 bg-white p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"><nav aria-label={`${portalLabels[portal]} HR pages`} className="hidden gap-1 lg:grid">{navRoutes.map(item => <AppLink key={item.id} to={demoPath(item.path, portal)} aria-current={item.id === route?.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${item.id === route?.id ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>{item.title}</AppLink>)}</nav><details className="lg:hidden"><summary className="min-h-11 cursor-pointer rounded-md px-3 py-3 text-sm font-semibold">Browse {portalLabels[portal].toLowerCase()} pages</summary><nav aria-label={`${portalLabels[portal]} mobile HR pages`} className="mt-2 grid gap-1 sm:grid-cols-2">{navRoutes.map(item => <AppLink key={item.id} to={demoPath(item.path, portal)} aria-current={item.id === route?.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${item.id === route?.id ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>{item.title}</AppLink>)}</nav></details><AppLink to="/hr" className="mt-4 block border-t border-neutral-200 px-3 pt-4 text-xs font-semibold text-neutral-500">About live HR adoption</AppLink></aside><div className="min-w-0 space-y-5">{content()}{route && canViewRoute(actor, route) && <Specification route={route} />}</div></div>
  </section>
}
