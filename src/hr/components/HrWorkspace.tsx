import { useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Circle, FileText, RefreshCcw, Users } from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import { hrFixture, hrRoutes } from '../catalog'
import {
  canApproveTimeOff, canEditEmployeeProfile, canViewCompensation, canViewRoute, demoPath, formatMoney,
  matchHrRoute, portalRoles, portalRoots, resolveHrPath, scopedEmployees,
  scopedRecords, searchEmployees, validateTimeEntry, validateTimeOff,
  type HrActor, type HrEmployee, type HrPortal, type HrRecord, type HrRole, type HrRoute,
} from '../model'

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

function Stat({ title, value, detail }: { title: string; value: ReactNode; detail: string }) {
  return <article className="rounded-xl border border-neutral-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">{value}</p><p className="mt-2 text-xs leading-5 text-neutral-500">{detail}</p></article>
}

function EmployeeDirectory({ employees, portal }: { employees: HrEmployee[]; portal: HrPortal }) {
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
          <div className="flex items-center gap-3"><Status value={employee.employmentStatus} />{portal === 'admin' ? <AppLink to={`/hr/demo/admin/employees/${employee.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800">View record<ChevronRight className="h-4 w-4" aria-hidden="true" /></AppLink> : portal === 'manager' && <AppLink to="/hr/demo/manager/tasks" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">View team tasks</AppLink>}</div>
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

function TimeEntries({ actor, records, employees, onEntry }: { actor: HrActor; records: HrRecord[]; employees: HrEmployee[]; onEntry: (entry: HrRecord) => void }) {
  const [date, setDate] = useState('2026-10-15')
  const [hours, setHours] = useState('8')
  const [message, setMessage] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateTimeEntry(date, Number(hours))
    if (!result.valid || !actor.employeeId) { setMessage(result.error ?? 'A synthetic employee identity is required.'); return }
    onEntry({ id: `demo-time-${Date.now()}`, employeeId: actor.employeeId, date, hours: Number(hours), status: 'submitted' })
    setMessage('Sample time entry added. No time clock or payroll system was changed.')
  }
  return <Panel title="Sample time entries" note="Recorded hours are fictional. Real overtime, approval, clocking and payroll export require an adopted and validated adapter.">
    {actor.role === 'employee' && <form onSubmit={submit} className="mb-6 grid items-end gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Work date<input type="date" required className={fieldClass} value={date} onChange={event => setDate(event.target.value)} /></label><label className="text-sm font-medium">Hours<input type="number" min="0.01" max="24" step="0.01" required className={fieldClass} value={hours} onChange={event => setHours(event.target.value)} /></label><button className={buttonClass} type="submit">Add sample time</button><p role="status" className="text-sm text-emerald-800 sm:col-span-3">{message}</p></form>}
    <RecordTable records={scopedRecords(actor, records, employees)} empty="No time entries in this identity's scope." columns={['employeeId', 'date', 'hours', 'status']} />
  </Panel>
}

function TimeOff({ actor, employees, requests, onRequest, onApprove }: { actor: HrActor; employees: HrEmployee[]; requests: HrRecord[]; onRequest: (value: HrRecord) => void; onApprove: (id: string) => void }) {
  const [startDate, setStartDate] = useState('2026-10-15')
  const [endDate, setEndDate] = useState('2026-10-16')
  const [type, setType] = useState('vacation')
  const [message, setMessage] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateTimeOff(startDate, endDate)
    if (!result.valid) { setMessage(result.error ?? 'Check the request.'); return }
    if (!actor.employeeId) { setMessage('Select an employee preview to create a sample request.'); return }
    onRequest({ id: `demo-request-${Date.now()}`, employeeId: actor.employeeId, startDate, endDate, type, status: 'pending' })
    setMessage(`Sample request submitted for ${result.days} calendar days. No company or payroll system was changed.`)
  }
  const visible = scopedRecords(actor, requests, employees)
  return <div className="grid gap-5">
    {(actor.role === 'employee' || actor.role === 'manager') && <Panel title="Request time off" note="Sample vacation/sick requests use calendar days. Real accrual, eligibility and payroll treatment are not calculated."><form onSubmit={submit} className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Start date<input type="date" required className={fieldClass} value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="text-sm font-medium">End date<input type="date" required className={fieldClass} value={endDate} onChange={event => setEndDate(event.target.value)} /></label><label className="text-sm font-medium">Request type<select className={fieldClass} value={type} onChange={event => setType(event.target.value)}><option value="vacation">Vacation</option><option value="sick">Sick</option></select></label><div className="sm:col-span-3"><button className={buttonClass} type="submit">Submit sample request</button><p role="status" className="mt-3 text-sm text-emerald-800">{message}</p></div></form></Panel>}
    <Panel title="Time-off requests" note={actor.role === 'manager' ? 'Only your fictional direct reports are in scope. Managers cannot approve their own requests.' : 'These requests are synthetic and remain in memory.'}>
      <div className="divide-y divide-neutral-100">{visible.map(request => <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold">{employees.find(employee => employee.id === request.employeeId)?.name ?? request.employeeId}</p><p className="mt-1 text-xs text-neutral-500">{label(request.type)} · {label(request.startDate)} to {label(request.endDate)}</p></div><div className="flex items-center gap-3"><Status value={request.status} />{canApproveTimeOff(actor, request, employees) && <button type="button" onClick={() => onApprove(request.id)} className="min-h-11 text-sm font-semibold text-emerald-800">Approve sample</button>}</div></article>)}</div>
      {!visible.length && <p className="text-sm text-neutral-500">No requests in this preview identity's scope.</p>}
    </Panel>
  </div>
}

function PayrollPreview({ payrolls }: { payrolls: HrRecord[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const payroll = payrolls.find(record => record.id === selected)
  return <div className="grid gap-5"><Panel title="Synthetic payroll history" note="Amounts are fixed fictional fixture values, not a payroll calculation. Submission, approval, funding and money movement are unavailable."><div className="divide-y divide-neutral-100">{payrolls.map(record => <article key={record.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{label(record.payPeriodStart)} to {label(record.payPeriodEnd)}</h3><p className="mt-1 text-xs text-neutral-500">Pay date {label(record.payDate)} · {label(record.employeeCount)} employees</p></div><div className="flex items-center gap-3"><Status value={record.status} /><button className="min-h-11 text-sm font-semibold text-emerald-800" type="button" onClick={() => setSelected(record.id)}>Preview totals</button></div></article>)}</div></Panel>{payroll && <Panel title="Sample payroll totals" note="Preview only. These values do not establish tax accuracy, funding readiness or payroll acceptance."><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-neutral-500">Gross pay</dt><dd className="mt-2 text-xl font-semibold">{formatMoney(payroll.grossPayCents)}</dd></div><div><dt className="text-sm text-neutral-500">Net pay</dt><dd className="mt-2 text-xl font-semibold">{formatMoney(payroll.netPayCents)}</dd></div><div><dt className="text-sm text-neutral-500">Provider submission</dt><dd className="mt-2 text-sm font-semibold">Unavailable in mock mode</dd></div></dl><button className={buttonClass + ' mt-5'} type="button" disabled>Submit payroll requires approved live adapter</button></Panel>}</div>
}

function NativeRecords({ kind, title, actor, employees, acknowledgements, onAcknowledge }: { kind: string; title: string; actor: HrActor; employees: HrEmployee[]; acknowledgements: Set<string>; onAcknowledge: (id: string) => void }) {
  const original = hrFixture.native[kind] ?? []
  const records = ['employee', 'manager', 'contractor'].includes(actor.role) && !['policies', 'surveys'].includes(kind) ? scopedRecords(actor, original, employees) : original
  const canAcknowledge = actor.role === 'employee' && ['policies', 'training'].includes(kind)
  return <Panel title={title} note="App-owned HR records, independent of the payroll provider. Preview actions only change this synthetic session."><div className="divide-y divide-neutral-100">{records.map(record => <article key={record.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="text-sm font-semibold">{label(record.title ?? record.name)}</h3><p className="mt-1 text-xs leading-5 text-neutral-500">{label(record.description ?? record.detail ?? record.category ?? record.version ?? record.employeeId)}</p></div><div className="flex items-center gap-3"><Status value={acknowledgements.has(record.id) ? 'acknowledged in demo' : record.status} />{canAcknowledge && <button type="button" className="min-h-11 text-sm font-semibold text-emerald-800 disabled:text-neutral-400" disabled={acknowledgements.has(record.id)} onClick={() => onAcknowledge(record.id)}>{acknowledgements.has(record.id) ? 'Acknowledged' : 'Acknowledge sample'}</button>}</div></article>)}</div>{!records.length && <p className="text-sm text-neutral-500">No sample records are supplied for this identity. The portable specification describes this module's future adapter.</p>}</Panel>
}

function EmployeeProfile({ employee, actor, email, onEmail }: { employee: HrEmployee; actor: HrActor; email?: string; onEmail: (value: string) => void }) {
  const [value, setValue] = useState(email ?? employee.workEmail)
  const [message, setMessage] = useState('')
  const editable = canEditEmployeeProfile(actor, employee.id)
  return <Panel title={`${employee.firstName} ${employee.lastName}`} note="Fictional profile. Sensitive tax, bank, identity and emergency-contact values are intentionally absent."><dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Job</dt><dd className="mt-1 font-medium">{employee.jobTitle}</dd></div><div><dt className="text-neutral-500">Department</dt><dd className="mt-1 font-medium">{employee.department}</dd></div><div><dt className="text-neutral-500">Employment</dt><dd className="mt-2"><Status value={employee.employmentStatus} /></dd></div>{canViewCompensation(actor, employee.id) && <div><dt className="text-neutral-500">Sample compensation amount</dt><dd className="mt-1 font-medium">{formatMoney(employee.payCents)} <span className="text-xs font-normal text-neutral-500">· fixture only; cadence not inferred</span></dd></div>}</dl><form className="mt-6 grid gap-3" onSubmit={event => { event.preventDefault(); if (!editable) return; onEmail(value); setMessage('Sample work email changed in this session. No account or provider record was changed.') }}><label className="text-sm font-medium">Synthetic work email<input className={fieldClass} type="email" disabled={!editable} value={value} onChange={event => setValue(event.target.value)} required /></label><div><button className={buttonClass} disabled={!editable} type="submit">Save sample profile</button></div><p className="text-sm text-emerald-800" role="status">{editable ? message : "This preview role has read-only profile access."}</p></form></Panel>
}

function Specification({ route }: { route: HrRoute }) {
  return <Panel title="Integration boundary" note={`${route.backing.replace(/-/g, ' ')} · ${route.capabilityId}`}><ul className="grid gap-2 text-sm text-neutral-600">{route.sections.map(section => <li key={section} className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />{section}</li>)}</ul>{route.actions.length > 0 && <div className="mt-5 flex flex-wrap gap-3">{route.actions.map(action => <button key={action.id} type="button" disabled title={action.description} className={buttonClass}>{action.label} · adapter required</button>)}</div>}<p className="mt-5 text-xs leading-5 text-neutral-500">Portable actions above are specifications. Only explicitly labeled sample controls on this page run in mock mode. The Gusto Embedded React SDK is a separate optional adapter; this workspace does not simulate provider authorization or compliance acceptance.</p></Panel>
}

export function HrWorkspace({ pathname }: { pathname: string }) {
  const resolution = resolveHrPath(pathname === '/hr/demo' ? '/hr/demo/admin' : pathname)
  const portal = resolution?.portal ?? 'admin'
  const [managementRole, setManagementRole] = useState<HrRole>('employer-owner')
  const defaultEmployee = hrFixture.employees.find(employee => employee.managerId) ?? hrFixture.employees[0]
  const defaultManager = hrFixture.employees.find(employee => hrFixture.employees.some(report => report.managerId === employee.id)) ?? hrFixture.employees[0]
  const [selectedEmployee, setSelectedEmployee] = useState(defaultEmployee?.id ?? '')
  const [completed, setCompleted] = useState<Set<string>>(() => new Set())
  const [acknowledgements, setAcknowledgements] = useState<Set<string>>(() => new Set())
  const [requests, setRequests] = useState<HrRecord[]>(() => structuredClone(hrFixture.timeOffRequests))
  const [timeEntries, setTimeEntries] = useState<HrRecord[]>(() => structuredClone(hrFixture.timeEntries))
  const [profileEmails, setProfileEmails] = useState<Record<string, string>>({})
  const actor: HrActor = { role: portal === 'admin' ? managementRole : portalRoles[portal], employeeId: portal === 'manager' ? defaultManager?.id : portal === 'employee' ? selectedEmployee : undefined, contractorId: portal === 'contractor' ? hrFixture.contractors[0]?.id : undefined }
  const selected = resolution && matchHrRoute(resolution.canonical, hrRoutes)
  const route = selected?.route
  const employeeId = selected?.parameters.employeeId ?? actor.employeeId
  const employee = hrFixture.employees.find(record => record.id === employeeId)
  const contractor = hrFixture.contractors.find(record => record.id === (selected?.parameters.contractorId ?? actor.contractorId))
  const employees = scopedEmployees(actor, hrFixture.employees)
  const navRoutes = hrRoutes.filter(item => item.portal === portal && !item.path.includes(':') && canViewRoute(actor, item))
  const suffix = resolution?.canonical.slice(portalRoots[portal].length).replace(/^\//, '') ?? ''
  const module = suffix.split('/')[0]
  const nativeKinds: Record<string, string> = { recruiting: 'jobs', policies: 'policies', assets: 'assets', tasks: 'tasks', training: 'training', performance: 'performance', cases: 'cases', 'case-management': 'cases', surveys: 'surveys', automation: 'automations', access: 'access' }

  function toggle(key: string) { setCompleted(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  function acknowledge(id: string) { setAcknowledgements(previous => new Set([...previous, id])) }
  function reset() { setCompleted(new Set()); setAcknowledgements(new Set()); setRequests(structuredClone(hrFixture.timeOffRequests)); setTimeEntries(structuredClone(hrFixture.timeEntries)); setProfileEmails({}) }
  function content() {
    if (!route || !canViewRoute(actor, route)) return <Panel title={!route ? 'Preview page not found' : 'This preview role cannot open this page'}><p className="text-sm leading-6 text-neutral-600">Choose a page from this portal's navigation. Role previews affect fictional data only.</p></Panel>
    if (selected?.parameters.employeeId && !employee) return <Panel title="Fictional employee not found"><p className="text-sm text-neutral-600">The requested ID is not in the synthetic fixture. No provider record is queried.</p></Panel>
    if (selected?.parameters.contractorId && !contractor) return <Panel title="Fictional contractor not found"><p className="text-sm text-neutral-600">The requested ID is not in the synthetic fixture.</p></Panel>
    if (selected?.parameters.payrollId && !hrFixture.payrolls.some(record => record.id === selected.parameters.payrollId)) return <Panel title="Fictional payroll not found"><p className="text-sm text-neutral-600">The requested payroll ID is not in the synthetic fixture.</p></Panel>
    if (route.capabilityId === 'employee-directory' || module === 'people' || module === 'team') return <EmployeeDirectory employees={employees} portal={portal} />
    if (['employee-profile', 'employee-compensation'].includes(route.capabilityId) && employee) return <div className="grid gap-5"><EmployeeProfile key={employee.id} employee={employee} actor={actor} email={profileEmails[employee.id]} onEmail={value => setProfileEmails(previous => ({ ...previous, [employee.id]: value }))} />{portal === 'admin' && <div className="flex flex-wrap gap-4 text-sm font-semibold"><AppLink to={`/hr/demo/admin/employees/${employee.id}/onboarding`} className="underline underline-offset-4">Onboarding checklist</AppLink>{canViewCompensation(actor, employee.id) && <AppLink to={`/hr/demo/admin/employees/${employee.id}/compensation`} className="underline underline-offset-4">Compensation specification</AppLink>}</div>}</div>
    if (route.capabilityId === 'employee-onboarding' && employee) return <Onboarding employee={employee} completed={completed} onToggle={toggle} />
    if (route.capabilityId === 'contractor-profile' && contractor) return <Panel title="Fictional contractor profile" note="Contractors have their own identity and payment domain. No employee compensation or private employee record is included."><RecordTable records={[contractor]} empty="No contractor in scope." columns={['name', 'email', 'type', 'onboardingStatus']} />{portal === 'admin' && <AppLink className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" to={`/hr/demo/admin/contractors/${contractor.id}/onboarding`}>Review contractor checklist</AppLink>}</Panel>
    if (route.capabilityId === 'contractor-onboarding' && contractor) return <Onboarding employee={{ id: contractor.id, firstName: String(contractor.name), onboarding: contractor.onboarding as HrEmployee['onboarding'] ?? [] }} completed={completed} onToggle={toggle} />
    if (module === 'time-off') return <TimeOff actor={actor} employees={hrFixture.employees} requests={requests} onRequest={value => setRequests(previous => [...previous, value])} onApprove={id => setRequests(previous => previous.map(request => request.id === id && canApproveTimeOff(actor, request, hrFixture.employees) ? { ...request, status: 'approved' } : request))} />
    if (module === 'time' || module === 'time-tracking') return <TimeEntries actor={actor} records={timeEntries} employees={hrFixture.employees} onEntry={record => setTimeEntries(previous => [...previous, record])} />
    if (module === 'payroll') return <PayrollPreview payrolls={selected?.parameters.payrollId ? hrFixture.payrolls.filter(record => record.id === selected.parameters.payrollId) : hrFixture.payrolls} />
    if (route.capabilityId === 'contractor-directory') return <Panel title="Contractor directory"><RecordTable records={hrFixture.contractors} empty="No sample contractors." columns={['name', 'type', 'onboardingStatus']} /><div className="mt-4 flex flex-wrap gap-4">{hrFixture.contractors.map(record => <AppLink key={record.id} to={`/hr/demo/admin/contractors/${record.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">View {String(record.name)}</AppLink>)}</div></Panel>
    if (module === 'contractor-payments' || portal === 'contractor' && module === 'payments') return <Panel title="Contractor payment preview" note="No payment is initiated. Fixed sample amounts are independent of employee payroll."><RecordTable records={(portal === 'contractor' ? scopedRecords(actor, hrFixture.contractorPayments ?? [], hrFixture.employees) : hrFixture.contractorPayments ?? []).map(record => ({ ...record, amount: formatMoney(record.amountCents) }))} empty="No payments in this contractor's scope." columns={['title', 'amount', 'date', 'status']} /><button className={buttonClass + ' mt-5'} disabled type="button">Submit contractor payment · live adapter required</button></Panel>
    if (module === 'benefits') return <Panel title="Benefits catalog" note="Fictional plan availability only. Enrollment, coverage and deduction calculations are not implemented."><RecordTable records={portal === 'employee' ? hrFixture.benefits.filter(record => Array.isArray(record.employeeIds) && record.employeeIds.includes(actor.employeeId)) : hrFixture.benefits} empty="No sample plans in this identity's scope." columns={['name', 'type', 'status']} /></Panel>
    if (route.capabilityId === 'paystubs') return <Panel title="Synthetic pay history" note="Fixed fictional pay statements. Provider downloads, payment methods and actual tax values remain unavailable."><RecordTable records={scopedRecords(actor, hrFixture.paystubs ?? [], hrFixture.employees).map(record => ({ ...record, gross: formatMoney(record.grossPayCents), net: formatMoney(record.netPayCents) }))} empty="No sample pay statement in this employee's scope." columns={['title', 'payDate', 'gross', 'net', 'status']} /></Panel>
    if (route.capabilityId === 'documents') return <Panel title={module === 'tax-documents' ? 'Tax document placeholders' : 'Document index'} note="No real PDF, tax form, bank number or legal signature is supplied. Secure downloads and provider forms require live authorization."><RecordTable records={scopedRecords(actor, hrFixture.documents, hrFixture.employees).filter(record => module !== 'tax-documents' || record.type === 'tax')} empty="No documents in this identity's scope." columns={['title', 'type', 'status']} /></Panel>
    if (nativeKinds[module]) return <NativeRecords kind={nativeKinds[module]} title={route.title} actor={actor} employees={hrFixture.employees} acknowledgements={acknowledgements} onAcknowledge={acknowledge} />
    if (module === 'reports' || module === 'analytics') return <Panel title="Reporting inventory" note="Synthetic report definitions only. Downloads, aggregated production payroll and data exports require a reviewed adapter."><RecordTable records={hrFixture.reports} empty="No sample reports." columns={['title', 'category', 'status']} /></Panel>
    if (route.capabilityId === 'company-locations') return <Panel title="Work locations" note="Synthetic location metadata. Jurisdiction registration and worksite validation are not established."><RecordTable records={hrFixture.locations ?? []} empty="No sample locations." columns={['name', 'state', 'status']} /></Panel>
    if (route.capabilityId === 'pay-schedules') return <Panel title="Sample pay schedules" note="Illustrative cadence only. Provider assignment and processing deadlines remain live-gated."><RecordTable records={hrFixture.paySchedules ?? []} empty="No sample schedules." columns={['title', 'frequency', 'status']} /></Panel>
    if (['company-taxes', 'company-banking'].includes(route.capabilityId)) return <Panel title={route.title} note="Sensitive values are intentionally omitted from the template. Use the authorized Gusto flow through the reviewed server proxy."><p className="text-sm leading-6 text-neutral-600">{route.capabilityId === 'company-banking' ? 'Bank account connection, account verification and employer funding authorization are unavailable in mock mode.' : 'Federal and state tax identifiers, registrations and filing setup are unavailable in mock mode.'}</p></Panel>
    if (module === 'company' || module === 'setup') return <Panel title="Fictional company setup" note="Provider onboarding gates are specifications until a Gusto Demo connection is authorized."><RecordTable records={[hrFixture.company]} empty="No company fixture." columns={['name', 'status']} /><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Operating mode</dt><dd className="mt-1 font-semibold">Mock · no credentials</dd></div><div><dt className="text-neutral-500">Payroll authorization</dt><dd className="mt-1 font-semibold">Disabled</dd></div></dl></Panel>
    if (module === 'departments' || module === 'organization' || module === 'locations' || module === 'pay-schedules') return <Panel title={route.title} note="Derived fictional organization data. Department and location administration remain adapter specifications."><RecordTable records={[...new Set(employees.map(record => record.department))].map((name, index) => ({ id: `department-${index}`, title: name, status: 'sample' }))} empty="No departments in scope." /></Panel>
    if (module === 'integrations' || module === 'sync' || module === 'audit' || module === 'requests' || module === 'support') return <Panel title={route.title} note="The portable package defines the provider and server contracts. This browser workspace has no Gusto connection or cloud write path."><dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Gusto</dt><dd className="mt-1 font-semibold">Mock preview · disconnected</dd></div><div><dt className="text-neutral-500">Firestore projection</dt><dd className="mt-1 font-semibold">Not provisioned</dd></div><div><dt className="text-neutral-500">Webhook verification</dt><dd className="mt-1 font-semibold">Specification only</dd></div><div><dt className="text-neutral-500">Shared test key</dt><dd className="mt-1 font-semibold">None embedded</dd></div></dl></Panel>
    if (!module) return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-3"><Stat title={portal === 'employee' ? 'Your profile' : 'People in scope'} value={portal === 'employee' ? employee?.firstName : portal === 'contractor' ? 1 : employees.length} detail="Fictional demo identity" /><Stat title="Sample requests" value={scopedRecords(actor, requests, hrFixture.employees).filter(record => ['pending', 'requested'].includes(String(record.status))).length} detail="Time off awaiting a sample decision" /><Stat title="Provider connection" value="Mock" detail="No Gusto account or test key" /></div>{portal === 'employee' && employee ? <Onboarding employee={employee} completed={completed} onToggle={toggle} /> : portal === 'contractor' ? <Panel title="Your fictional contractor record"><RecordTable records={hrFixture.contractors.filter(record => record.id === actor.contractorId)} empty="No contractor in scope." columns={['name', 'type', 'onboardingStatus']} /></Panel> : <EmployeeDirectory employees={employees} portal={portal} />}</div>
    return <Panel title={route.title}><p className="text-sm leading-6 text-neutral-600">This module has a page specification and navigation contract. Its application adapter is not implemented in this first mock phase.</p></Panel>
  }

  return <section className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950"><p className="text-sm font-semibold">Synthetic HR demo · no account or credentials required</p><p className="mt-1 text-xs leading-5">Fictional records only. Sample changes stay in memory, reset on refresh and never reach Firebase or Gusto. Do not enter real employee information.</p></div>
    <div className="mt-7 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label(hrFixture.company.name)} · {portalLabels[portal]} preview</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{route?.title ?? 'HR preview'}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{route?.description ?? 'Choose a standard people portal.'}</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold"><RefreshCcw className="h-4 w-4" aria-hidden="true" />Reset sample changes</button></div>
    <nav aria-label="Demo portals" className="mt-6 flex flex-wrap gap-2">{(Object.keys(portalRoots) as HrPortal[]).map(value => <AppLink key={value} to={`/hr/demo/${value}`} aria-current={portal === value ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${portal === value ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>{portalLabels[value]}</AppLink>)}<AppLink to="/hr/demo/sdk" className="inline-flex min-h-11 items-center rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800">Gusto SDK preview</AppLink></nav>
    <div className="mt-5 rounded-lg bg-neutral-50 p-4">{portal === 'admin' ? <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Synthetic management role<select className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={managementRole} onChange={event => setManagementRole(event.target.value as HrRole)}><option value="employer-owner">Employer owner</option><option value="payroll-admin">Payroll admin</option><option value="hr-admin">HR admin</option><option value="auditor">Auditor</option></select><span className="text-xs font-normal text-neutral-500">Changes demo navigation only; never Firebase claims.</span></label> : portal === 'employee' ? <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Synthetic employee identity<select className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={selectedEmployee} onChange={event => setSelectedEmployee(event.target.value)}>{hrFixture.employees.map(record => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</select><span className="text-xs font-normal text-neutral-500">Own records only; fictional identity preview.</span></label> : <p className="flex items-center gap-2 text-sm text-neutral-600"><Users className="h-4 w-4" aria-hidden="true" />{portal === 'contractor' ? label(hrFixture.contractors[0]?.name) : `${defaultManager?.firstName} ${defaultManager?.lastName}`} · {portalRoles[portal]} · fictional identity</p>}</div>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[14rem_1fr]"><aside className="rounded-xl border border-neutral-200 bg-white p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"><nav aria-label={`${portalLabels[portal]} HR pages`} className="hidden gap-1 lg:grid">{navRoutes.map(item => <AppLink key={item.id} to={demoPath(item.path, portal)} aria-current={item.id === route?.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${item.id === route?.id ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>{item.title}</AppLink>)}</nav><details className="lg:hidden"><summary className="min-h-11 cursor-pointer rounded-md px-3 py-3 text-sm font-semibold">Browse {portalLabels[portal].toLowerCase()} pages</summary><nav aria-label={`${portalLabels[portal]} mobile HR pages`} className="mt-2 grid gap-1 sm:grid-cols-2">{navRoutes.map(item => <AppLink key={item.id} to={demoPath(item.path, portal)} aria-current={item.id === route?.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${item.id === route?.id ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>{item.title}</AppLink>)}</nav></details><AppLink to="/hr" className="mt-4 block border-t border-neutral-200 px-3 pt-4 text-xs font-semibold text-neutral-500">About live HR adoption</AppLink></aside><div className="min-w-0 space-y-5">{content()}{route && canViewRoute(actor, route) && <Specification route={route} />}</div></div>
  </section>
}
