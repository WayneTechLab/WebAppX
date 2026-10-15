import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useUnsavedTransition } from '@/portals/unsaved-work'
import { confirmHrLifecycle, effectiveHrFixture, lifecycleView, previewHrLifecycle } from '../lifecycle'
import type { HrEmploymentInstance, HrEmploymentSnapshot, HrLifecycleAction, HrLifecyclePreview } from '../lifecycle-types'
import { scopedEmployees, type HrActor, type HrEmployee, type HrFixture } from '../model'
import type { HrDemoState } from '../persistence'
import { HR_ONBOARDING_TEMPLATES } from '../recruiting'
import { focusHrForm, normalizeHrFormValue, useHrFormDraft } from './useHrFormDraft'

const fieldClass = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-500 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondaryClass = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-400'
type Props = { state: HrDemoState; actor: HrActor; baseFixture: HrFixture; onAction: (update: (current: HrDemoState) => HrDemoState) => boolean }
type PreviewState = { preview: HrLifecyclePreview; actor: HrActor }
type DraftGroup = 'transfer' | 'transition' | 'rehire'
const groupId = (employeeId: string, instanceId: string, group: DraftGroup) => `hr:lifecycle:${employeeId}:${instanceId}:${group}`
const actorLabel = (actor: HrActor) => `${actor.role.replaceAll('-', ' ')}${actor.employeeId ? ` · ${actor.employeeId}` : ''} (local preview)`
function person(id: string | null, fixture: HrFixture) {
  if (!id) return 'No manager'
  const employee = fixture.employees.find(item => item.id === id)
  return employee ? `${employee.firstName} ${employee.lastName} · ${id}` : id
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'The sample lifecycle action could not be reviewed.' }
function focusLater(id: string) { window.requestAnimationFrame(() => focusHrForm(id)) }
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h3 className="text-lg font-semibold text-neutral-950">{title}</h3>{children}</section>
}
function Snapshot({ value, fixture }: { value: HrEmploymentSnapshot | string | null | undefined; fixture: HrFixture }) {
  if (value == null) return <p>No prior employment snapshot.</p>
  if (typeof value === 'string') return <p className="break-words">{value}</p>
  return <dl className="space-y-2 text-sm"><div><dt className="font-medium">Employment state</dt><dd>{value.status}</dd></div><div><dt className="font-medium">Department</dt><dd className="break-words">{value.department}</dd></div><div><dt className="font-medium">Job title</dt><dd className="break-words">{value.jobTitle}</dd></div><div><dt className="font-medium">Manager</dt><dd className="break-words">{person(value.managerId, fixture)}</dd></div></dl>
}
function Preview({ value, fixture, title, confirmLabel, onCancel, onConfirm, canConfirm = true }: { value: PreviewState; fixture: HrFixture; title: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; canConfirm?: boolean }) {
  const { preview, actor } = value
  const action = preview.action
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [value])
  const date = 'effectiveDate' in action ? action.effectiveDate : 'startDate' in action ? action.startDate : action.simulationDate
  return <section aria-label={title} className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-neutral-950">
    <h4 ref={heading} tabIndex={-1} className="font-semibold">{title}</h4>
    <p className="text-sm">Reviewed by {actorLabel(actor)}. Effective date: <strong>{date}</strong>. Simulation date: <strong>{action.simulationDate}</strong>.</p>
    {preview.employeeId && <p className="text-sm break-words">Employee: {person(preview.employeeId, fixture)}. Employment instance: {preview.instanceId}.</p>}
    {!preview.rehire && <div className="grid gap-4 sm:grid-cols-2"><div><h5 className="mb-2 text-sm font-semibold">Previous</h5><Snapshot value={preview.previous} fixture={fixture} /></div><div><h5 className="mb-2 text-sm font-semibold">Proposed</h5><Snapshot value={preview.proposed} fixture={fixture} /></div></div>}
    {'reason' in action && <p className="text-sm whitespace-pre-wrap break-words"><strong>Sample reason:</strong> {action.reason.trim()}</p>}
    {preview.scopeChanges && <div className="space-y-3"><h5 className="text-sm font-semibold">Affected direct-report scopes</h5>{preview.scopeChanges.length ? preview.scopeChanges.map(scope => <div key={scope.managerId} className="rounded-md border border-amber-200 bg-white p-3 text-sm"><p className="font-semibold">{person(scope.managerId, fixture)}</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><div><p className="font-medium">Previous direct reports</p><ul className="mt-1 list-inside list-disc">{scope.previousReportIds.map(id => <li key={id}>{person(id, fixture)}</li>)}{!scope.previousReportIds.length && <li>No direct reports</li>}</ul></div><div><p className="font-medium">Proposed direct reports</p><ul className="mt-1 list-inside list-disc">{scope.proposedReportIds.map(id => <li key={id}>{person(id, fixture)}</li>)}{!scope.proposedReportIds.length && <li>No direct reports</li>}</ul></div></div></div>) : <p className="text-sm">No direct-report scope changes.</p>}</div>}
    {preview.offboarding && <div><h5 className="text-sm font-semibold">Assignments created only after confirmation</h5><ul className="mt-2 space-y-2 text-sm">{preview.offboarding.map(assignment => <li key={assignment.id}><strong>{assignment.kind}:</strong> {assignment.title} · {assignment.instanceId}</li>)}</ul><p className="mt-2 text-xs">These are fictional local assignments. No asset status, account access or external system is changed.</p></div>}
    {preview.rehire && <div className="grid gap-4 sm:grid-cols-2"><div><h5 className="text-sm font-semibold">Retained directory identity and history</h5><p className="mt-2 text-sm break-words">Employee ID: {preview.rehire.retainedEmployeeId}</p><p className="mt-2 text-sm break-words">Prior employment instance: {preview.rehire.priorInstanceId}</p><p className="mt-2 text-sm">Contact details and prior onboarding receipts remain attached to their original records.</p></div><div><h5 className="text-sm font-semibold">New employment and onboarding requirements</h5><p className="mt-2 text-sm break-words">New instance: {preview.rehire.newInstanceId}</p><p className="mt-2 text-sm">Captured checklist: {preview.rehire.templateVersion}. Every new item starts incomplete.</p><ul className="mt-2 list-inside list-disc text-sm">{preview.rehire.tasks.map(task => <li key={task.id}>{task.title} · {task.id}</li>)}</ul><div className="mt-3"><Snapshot value={preview.proposed} fixture={fixture} /></div></div></div>}
    <p className="text-xs leading-5">{preview.policy}</p>
    <p className="text-xs leading-5">Confirmation checks the latest accepted workspace, preview identity and role again. If any reviewed fact changed, create a new preview.</p>
    <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={!canConfirm} onClick={onConfirm}>{confirmLabel}</button><button type="button" className={secondaryClass} onClick={onCancel}>Cancel {action.type === 'set-simulation-date' ? 'simulation date' : action.type === 'select-template' ? 'template' : action.type === 'rehire' ? 'rehire' : action.type === 'transfer' ? 'transfer' : 'transition'} preview</button></div>
  </section>
}
function ManagerOptions({ fixture, employeeId }: { fixture: HrFixture; employeeId: string }) {
  return <><option value="">No manager</option>{fixture.employees.filter(employee => employee.employmentStatus === 'active' || employee.id === employeeId).map(employee => <option key={employee.id} value={employee.id} disabled={employee.id === employeeId}>{person(employee.id, fixture)}{employee.id === employeeId ? ' (cannot manage self)' : ''}</option>)}</>
}

function EmployeeLifecycle({ state, actor, baseFixture, employee, instance, simulationDate, onAction, onAccepted }: Props & { employee: HrEmployee; instance: HrEmploymentInstance; simulationDate: string; onAccepted: () => void }) {
  const fixture = effectiveHrFixture(state, baseFixture)
  const permitted = ['employer-owner', 'hr-admin'].includes(actor.role)
  const transfer = useHrFormDraft({ id: groupId(employee.id, instance.id, 'transfer'), label: `Transfer draft for ${employee.firstName} ${employee.lastName}`, initial: { department: employee.department, managerId: employee.managerId ?? '', effectiveDate: '' }, enabled: permitted })
  const transition = useHrFormDraft({ id: groupId(employee.id, instance.id, 'transition'), label: `Employment transition draft for ${employee.firstName} ${employee.lastName}`, initial: { type: 'leave' as 'leave' | 'return' | 'terminate', effectiveDate: '', reason: '' }, enabled: permitted })
  const rehire = useHrFormDraft({ id: groupId(employee.id, instance.id, 'rehire'), label: `Rehire draft for ${employee.firstName} ${employee.lastName}`, initial: { department: employee.department, jobTitle: employee.jobTitle, managerId: employee.managerId ?? '', startDate: '' }, enabled: permitted })
  const [review, setReview] = useState<{ group: DraftGroup; value: PreviewState } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const errorElement = useRef<HTMLParagraphElement>(null)
  const groups = { transfer, transition, rehire }
  function currentAction(group: DraftGroup): HrLifecycleAction {
    if (group === 'transfer') return { type: 'transfer', employeeId: employee.id, ...transfer.value, managerId: transfer.value.managerId || null, simulationDate }
    if (group === 'rehire') return { type: 'rehire', employeeId: employee.id, ...rehire.value, managerId: rehire.value.managerId || null, simulationDate }
    return { ...transition.value, employeeId: employee.id, simulationDate }
  }
  const reviewCurrent = !!review && normalizeHrFormValue(review.value.preview.action) === normalizeHrFormValue(currentAction(review.group))
  function refuse(error: unknown) { setError(errorMessage(error)); window.requestAnimationFrame(() => errorElement.current?.focus()) }
  function clearReview() { setReview(null); setError(''); setMessage('') }
  function preview(event: FormEvent<HTMLFormElement>, group: DraftGroup, action: HrLifecycleAction) {
    event.preventDefault()
    clearReview()
    if (!permitted) { refuse(new Error('This preview role has read-only employment lifecycle access.')); return }
    try {
      const result = previewHrLifecycle(state, actor, action, baseFixture)
      setReview({ group, value: { preview: result, actor: { ...actor } } })
    } catch (error) { refuse(error) }
  }
  function confirm() {
    if (!review || !permitted) return
    if (!reviewCurrent) { setReview(null); refuse(new Error('The temporary fields or simulation date changed. Preview this action again.')); return }
    if (review.group === 'rehire' && (transfer.dirty || transition.dirty)) { refuse(new Error('Finish or explicitly discard the transfer and transition drafts before confirming a new employment instance.')); return }
    try {
      const { preview } = review.value
      confirmHrLifecycle(state, actor, preview.action, preview.confirmation, baseFixture)
      if (!onAction(current => confirmHrLifecycle(current, actor, preview.action, preview.confirmation, baseFixture))) { refuse(new Error('The employment action was refused. Review the current record and create a new preview.')); setReview(null); return }
      const group = groups[review.group]
      group.accept()
      if (review.group === 'transition') transition.accept({ ...transition.value, reason: '' })
      onAccepted()
      setReview(null); setError(''); setMessage('Sample employment change accepted in this workspace. No provider or external system was contacted.')
    } catch (error) { setReview(null); refuse(error) }
  }
  function cancel() { const id = review && groups[review.group].id; setReview(null); if (id) focusLater(id) }
  function discard(group: DraftGroup) { groups[group].discard(); clearReview(); focusLater(groups[group].id) }
  const active = employee.employmentStatus !== 'terminated'
  const confirmLabel = review?.group === 'transfer' ? 'Confirm sample transfer' : review?.group === 'rehire' ? 'Confirm fictional rehire' : review?.value.preview.action.type === 'terminate' ? 'Confirm fictional termination' : review?.value.preview.action.type === 'return' ? 'Confirm sample return' : 'Confirm sample leave'
  return <div className="space-y-5">
    <div className="rounded-lg bg-neutral-50 p-4 text-sm"><p className="font-semibold">{employee.firstName} {employee.lastName} · {employee.id}</p><p className="mt-2 break-words">Current instance: {instance.id} · {employee.employmentStatus}</p><p className="mt-2">Start: {instance.startDate ?? 'Unknown legacy start date'} · End: {instance.endDate ?? 'No end date recorded'}</p><p className="mt-2">Onboarding checklist: {instance.templateVersion} · {state.workflow.onboarding[employee.id]?.stage ?? 'Unavailable'}</p></div>
    {!permitted && <p className="text-sm text-neutral-600">This preview role can read records in its scope. Only the owner or HR administrator preview can change employment lifecycle records.</p>}
    <Panel title="Fictional employee transfer"><p className="text-sm text-neutral-600">Preview the previous and proposed department, manager, date and direct-report scopes. Self-management and reporting cycles are refused.</p>
      <form id={transfer.id} className="space-y-4" onSubmit={event => preview(event, 'transfer', { type: 'transfer', employeeId: employee.id, ...transfer.value, managerId: transfer.value.managerId || null, simulationDate })}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Transfer department<input className={fieldClass} required minLength={2} maxLength={80} value={transfer.value.department} disabled={!permitted || !active} onChange={event => { transfer.setValue(previous => ({ ...previous, department: event.target.value })); clearReview() }} /></label><label className="block text-sm font-medium">Transfer manager<select className={fieldClass} value={transfer.value.managerId} disabled={!permitted || !active} onChange={event => { transfer.setValue(previous => ({ ...previous, managerId: event.target.value })); clearReview() }}><ManagerOptions fixture={fixture} employeeId={employee.id} /></select></label><label className="block text-sm font-medium">Transfer effective date<input className={fieldClass} type="date" required value={transfer.value.effectiveDate} disabled={!permitted || !active} onChange={event => { transfer.setValue(previous => ({ ...previous, effectiveDate: event.target.value })); clearReview() }} /></label></div>
        <div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass} disabled={!permitted || !active}>Preview sample transfer</button><button type="button" className={secondaryClass} disabled={!permitted || !transfer.dirty} onClick={() => discard('transfer')}>Discard transfer draft</button></div>
      </form>
      {review?.group === 'transfer' && <Preview value={review.value} fixture={fixture} title="Sample transfer preview" confirmLabel={confirmLabel} onCancel={cancel} onConfirm={confirm} canConfirm={reviewCurrent} />}
    </Panel>
    <Panel title="Employment state transition"><p className="text-sm text-neutral-600">Sample leave is separate from vacation or sick requests. Leave, return and termination record the prior state and a printable sample reason.</p>
      <form id={transition.id} className="space-y-4" onSubmit={event => preview(event, 'transition', { ...transition.value, employeeId: employee.id, simulationDate })}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Employment transition<select className={fieldClass} value={transition.value.type} disabled={!permitted || !active} onChange={event => { transition.setValue(previous => ({ ...previous, type: event.target.value as 'leave' | 'return' | 'terminate' })); clearReview() }}><option value="leave">Sample leave</option><option value="return">Return from sample leave</option><option value="terminate">Fictional termination</option></select></label><label className="block text-sm font-medium">Transition effective date<input className={fieldClass} type="date" required value={transition.value.effectiveDate} disabled={!permitted || !active} onChange={event => { transition.setValue(previous => ({ ...previous, effectiveDate: event.target.value })); clearReview() }} /></label></div>
        <label className="block text-sm font-medium">Sample transition reason<textarea className={fieldClass} required minLength={2} maxLength={500} rows={3} value={transition.value.reason} disabled={!permitted || !active} onChange={event => { transition.setValue(previous => ({ ...previous, reason: event.target.value })); clearReview() }} /></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass} disabled={!permitted || !active}>Preview employment transition</button><button type="button" className={secondaryClass} disabled={!permitted || !transition.dirty} onClick={() => discard('transition')}>Discard transition draft</button></div>
      </form>
      {review?.group === 'transition' && <Preview value={review.value} fixture={fixture} title="Employment transition preview" confirmLabel={confirmLabel} onCancel={cancel} onConfirm={confirm} canConfirm={reviewCurrent} />}
    </Panel>
    <Panel title="Fictional rehire comparison"><p className="text-sm text-neutral-600">Rehire retains the person and historical records while creating a new employment instance and incomplete onboarding checklist. A terminated prior instance is required.</p>
      <form id={rehire.id} className="space-y-4" onSubmit={event => preview(event, 'rehire', { type: 'rehire', employeeId: employee.id, ...rehire.value, managerId: rehire.value.managerId || null, simulationDate })}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Rehire department<input className={fieldClass} required minLength={2} maxLength={80} value={rehire.value.department} disabled={!permitted || active} onChange={event => { rehire.setValue(previous => ({ ...previous, department: event.target.value })); clearReview() }} /></label><label className="block text-sm font-medium">Rehire job title<input className={fieldClass} required minLength={2} maxLength={100} value={rehire.value.jobTitle} disabled={!permitted || active} onChange={event => { rehire.setValue(previous => ({ ...previous, jobTitle: event.target.value })); clearReview() }} /></label><label className="block text-sm font-medium">Rehire manager<select className={fieldClass} value={rehire.value.managerId} disabled={!permitted || active} onChange={event => { rehire.setValue(previous => ({ ...previous, managerId: event.target.value })); clearReview() }}><ManagerOptions fixture={fixture} employeeId={employee.id} /></select></label><label className="block text-sm font-medium">Rehire start date<input className={fieldClass} type="date" required value={rehire.value.startDate} disabled={!permitted || active} onChange={event => { rehire.setValue(previous => ({ ...previous, startDate: event.target.value })); clearReview() }} /></label></div>
        <div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass} disabled={!permitted || active}>Compare fictional rehire</button><button type="button" className={secondaryClass} disabled={!permitted || !rehire.dirty} onClick={() => discard('rehire')}>Discard rehire draft</button></div>
      </form>
      {(transfer.dirty || transition.dirty) && !active && <p className="text-sm text-amber-900">Finish or explicitly discard the transfer and transition drafts before confirming a new employment instance.</p>}
      {review?.group === 'rehire' && <Preview value={review.value} fixture={fixture} title="Fictional rehire preview" confirmLabel={confirmLabel} onCancel={cancel} onConfirm={confirm} canConfirm={reviewCurrent} />}
    </Panel>
    {review && !reviewCurrent && <p role="status" className="text-sm text-amber-900">The temporary fields or simulation date changed. Preview this action again before confirming.</p>}
    {error && <p ref={errorElement} role="alert" tabIndex={-1} className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    {message && <p role="status" className="text-sm font-medium text-emerald-800">{message}</p>}
  </div>
}

export function HrEmploymentLifecycle({ state, actor, baseFixture, onAction }: Props) {
  const request = useUnsavedTransition()
  const fixture = effectiveHrFixture(state, baseFixture)
  const view = lifecycleView(state, baseFixture)
  const employees = scopedEmployees(actor, fixture.employees)
  const [selected, setSelected] = useState(state.selectedEmployee)
  const employee = employees.find(item => item.id === selected) ?? employees[0]
  const instance = view.instances.find(item => item.id === (employee && view.activeInstances[employee.id]))
  const permitted = ['employer-owner', 'hr-admin'].includes(actor.role)
  const simulation = useHrFormDraft({ id: 'hr:lifecycle:simulation-date', label: 'Employment simulation date', initial: view.simulationDate ?? '', enabled: permitted })
  const template = useHrFormDraft({ id: 'hr:lifecycle:template', label: 'Onboarding template selection', initial: view.selectedTemplateVersion, enabled: permitted })
  const [dateReview, setDateReview] = useState<PreviewState | null>(null)
  const [dateError, setDateError] = useState('')
  const [dateMessage, setDateMessage] = useState('')
  const [templateReview, setTemplateReview] = useState<PreviewState | null>(null)
  const [templateError, setTemplateError] = useState('')
  const [templateMessage, setTemplateMessage] = useState('')
  function previewDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setDateError(''); setDateMessage(''); setDateReview(null)
    if (!permitted) return
    try { setDateReview({ preview: previewHrLifecycle(state, actor, { type: 'set-simulation-date', simulationDate: simulation.value }, baseFixture), actor: { ...actor } }) }
    catch (error) { setDateError(errorMessage(error)) }
  }
  const dateReviewCurrent = !!dateReview && dateReview.preview.action.simulationDate === simulation.value
  const templateReviewCurrent = !!templateReview && templateReview.preview.action.type === 'select-template' && templateReview.preview.action.templateVersion === template.value && templateReview.preview.action.simulationDate === simulation.value
  function confirmDate() {
    if (!dateReview || !permitted) return
    if (!dateReviewCurrent) { setDateReview(null); setDateError('The simulation date changed. Preview the date again.'); return }
    try {
      const { preview } = dateReview
      confirmHrLifecycle(state, actor, preview.action, preview.confirmation, baseFixture)
      if (!onAction(current => confirmHrLifecycle(current, actor, preview.action, preview.confirmation, baseFixture))) { setDateError('The simulation date was refused. Review the current state and preview again.'); setDateReview(null); return }
      simulation.accept(); setDateReview(null); setDateError(''); setDateMessage('Explicit simulation date accepted. No employment date was inferred or scheduled.')
    } catch (error) { setDateReview(null); setDateError(errorMessage(error)) }
  }
  function previewTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setTemplateError(''); setTemplateMessage(''); setTemplateReview(null)
    if (!permitted) return
    try { setTemplateReview({ preview: previewHrLifecycle(state, actor, { type: 'select-template', templateVersion: template.value, simulationDate: simulation.value }, baseFixture), actor: { ...actor } }) }
    catch (error) { setTemplateError(errorMessage(error)) }
  }
  function confirmTemplate() {
    if (!templateReview || !permitted) return
    if (!templateReviewCurrent) { setTemplateReview(null); setTemplateError('The template choice or simulation date changed. Preview the selection again.'); return }
    try {
      const { preview } = templateReview
      confirmHrLifecycle(state, actor, preview.action, preview.confirmation, baseFixture)
      if (!onAction(current => confirmHrLifecycle(current, actor, preview.action, preview.confirmation, baseFixture))) { setTemplateError('The template selection was refused. Review the current state and preview again.'); setTemplateReview(null); return }
      template.accept(); simulation.accept(); setTemplateReview(null); setTemplateError(''); setTemplateMessage('Template selection accepted. Existing captured checklists and receipts are unchanged.')
    } catch (error) { setTemplateReview(null); setTemplateError(errorMessage(error)) }
  }
  const selectedTemplate = HR_ONBOARDING_TEMPLATES.find(item => item.version === template.value)
  const instances = employee ? view.instances.filter(item => item.employeeId === employee.id) : []
  const events = employee ? view.events.filter(item => item.employeeId === employee.id) : []
  const assignments = employee ? view.offboardingAssignments.filter(item => item.employeeId === employee.id) : []
  return <section aria-label="Employment lifecycle" className="space-y-6">
    <div><h2 id="hr-employment-lifecycle" tabIndex={-1} className="text-2xl font-bold text-neutral-950">Employment lifecycle</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Fictional employment instances, reporting scopes and onboarding versions. Actions affect this local workspace only; preview roles are not authenticated authority.</p></div>
    <Panel title="Employment simulation date"><form id={simulation.id} className="space-y-4" onSubmit={previewDate}><label className="block max-w-sm text-sm font-medium">Employment simulation date<input className={fieldClass} type="date" required value={simulation.value} disabled={!permitted} onChange={event => { simulation.setValue(event.target.value); setDateReview(null); setDateError(''); setDateMessage(''); setTemplateReview(null); setTemplateError('') }} /></label><p className="text-xs leading-5 text-neutral-600">Choose an explicit sample date before previewing a change. Effective dates must be on or before it and follow the accepted timeline. Legacy start dates remain unknown; no clock-derived employment date is invented.</p><div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass} disabled={!permitted}>Use simulation date</button><button type="button" className={secondaryClass} disabled={!permitted || !simulation.dirty} onClick={() => { simulation.discard(); setDateReview(null); setDateError(''); focusLater(simulation.id) }}>Discard simulation date draft</button></div></form>
      {dateReview && <Preview value={dateReview} fixture={fixture} title="Simulation date preview" confirmLabel="Confirm simulation date" onCancel={() => { setDateReview(null); focusLater(simulation.id) }} onConfirm={confirmDate} canConfirm={dateReviewCurrent} />}
      {dateReview && !dateReviewCurrent && <p role="status" className="text-sm text-amber-900">The simulation date changed. Preview the date again before confirming.</p>}
      {dateError && <p role="alert" className="text-sm text-red-900">{dateError}</p>}{dateMessage && <p role="status" className="text-sm text-emerald-800">{dateMessage}</p>}
    </Panel>
    <Panel title="Captured onboarding template versions"><p className="text-sm text-neutral-600">Selected for subsequent new hires and rehires: <strong>{view.selectedTemplateVersion}</strong>. Changing the selection does not alter existing checklist definitions, completions or receipts.</p>
      <form id={template.id} className="space-y-4" onSubmit={previewTemplate}><label className="block text-sm font-medium">Onboarding template version<select className={fieldClass} value={template.value} disabled={!permitted} onChange={event => { template.setValue(event.target.value); setTemplateReview(null); setTemplateError(''); setTemplateMessage('') }}>{HR_ONBOARDING_TEMPLATES.map(item => <option key={item.version} value={item.version}>{item.title} · {item.version}</option>)}</select></label><ul className="list-inside list-disc text-sm">{selectedTemplate?.tasks.map(task => <li key={task.id}>{task.title} · {task.id}</li>)}</ul><div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass} disabled={!permitted}>Preview template selection</button><button type="button" className={secondaryClass} disabled={!permitted || !template.dirty} onClick={() => { template.discard(); setTemplateReview(null); setTemplateError(''); focusLater(template.id) }}>Discard template selection draft</button></div></form>
      {templateReview && <Preview value={templateReview} fixture={fixture} title="Onboarding template selection preview" confirmLabel="Confirm template selection" onCancel={() => { setTemplateReview(null); focusLater(template.id) }} onConfirm={confirmTemplate} canConfirm={templateReviewCurrent} />}
      {templateReview && !templateReviewCurrent && <p role="status" className="text-sm text-amber-900">The template choice or simulation date changed. Preview the selection again before confirming.</p>}
      {templateError && <p role="alert" className="text-sm text-red-900">{templateError}</p>}{templateMessage && <p role="status" className="text-sm text-emerald-800">{templateMessage}</p>}
    </Panel>
    {employee && instance ? <>
      <label className="block text-sm font-medium">Lifecycle employee<select className={fieldClass} value={employee.id} onChange={event => {
        const next = event.target.value
        request({ ids: (['transfer', 'transition', 'rehire'] as const).map(group => groupId(employee.id, instance.id, group)), label: 'Change the lifecycle employee' }, () => setSelected(next))
      }}>{employees.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select></label>
      <EmployeeLifecycle key={`${employee.id}:${instance.id}:${actor.role}:${actor.employeeId ?? ''}`} state={state} actor={actor} baseFixture={baseFixture} employee={employee} instance={instance} simulationDate={simulation.value} onAction={onAction} onAccepted={() => simulation.accept()} />
      <Panel title="Employment instances and captured onboarding"><ol className="space-y-4">{instances.map(item => {
        const onboarding = item.id === instance.id ? state.workflow.onboarding[employee.id] : item.archivedOnboarding
        return <li key={item.id} className="rounded-lg border border-neutral-200 p-4 text-sm"><p className="font-semibold break-words">{item.id}{item.id === instance.id ? ' · current instance' : ' · prior instance'}</p><p className="mt-2">Start: {item.startDate ?? 'Unknown legacy start date'} · End: {item.endDate ?? 'No end date recorded'}</p><p className="mt-2">Captured checklist: {item.templateVersion} · Onboarding: {onboarding?.stage ?? 'No archived payload'}</p><p className="mt-2 break-words">{onboarding?.receipt ? `Original onboarding receipt: ${onboarding.receipt}` : 'No completion receipt recorded.'}</p><ul className="mt-2 list-inside list-disc">{item.tasks.map(task => <li key={task.id}>{task.title} · {onboarding?.tasks[task.id] ? 'complete' : 'incomplete'}</li>)}</ul></li>
      })}</ol></Panel>
      <Panel title="Fictional offboarding assignments"><ul className="space-y-3 text-sm">{assignments.map(item => <li key={item.id} className="rounded-lg border border-neutral-200 p-3"><p className="font-semibold">{item.kind} · {item.title}</p><p className="mt-1 break-words">{item.status} · {item.id} · employment {item.instanceId}</p></li>)}{!assignments.length && <li>No fictional offboarding assignments have been created for this employee.</li>}</ul><p className="text-xs text-neutral-600">Assignments record local asset, access and handover work only. No external account is disabled or provider notified.</p></Panel>
      <Panel title="Employment lifecycle history"><ol className="space-y-3 text-sm">{events.map(item => <li key={item.id} className="rounded-lg border border-neutral-200 p-3"><p className="font-semibold">Sequence {item.sequence} · {item.kind} · {item.effectiveDate}</p><p className="mt-1">{actorLabel(item.actor)} · {item.instanceId}</p>{item.reason && <p className="mt-2 whitespace-pre-wrap break-words">Sample reason: {item.reason}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 font-medium">Previous</p><Snapshot value={item.previous} fixture={fixture} /></div><div><p className="mb-1 font-medium">Accepted</p><Snapshot value={item.proposed} fixture={fixture} /></div></div></li>)}{!events.length && <li>No accepted employment lifecycle changes.</li>}</ol></Panel>
    </> : <p className="rounded-lg border border-neutral-200 p-4 text-sm">No employee lifecycle records are available in this preview role’s scope.</p>}
  </section>
}
