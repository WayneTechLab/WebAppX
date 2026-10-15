import { canEditEmployeeProfile, validateTimeEntry, type HrActor, type HrFixture } from './model'
import { createHrLifecycle, effectiveWorkflowFixture } from './mock-workflows'
import { isHrDemoState, type HrDemoState } from './persistence'
import { recruitingFixture } from './recruiting-link'
import { hrOnboardingTemplate } from './recruiting'
import type { HrEmploymentInstance, HrEmploymentSnapshot, HrLifecycleAction, HrLifecyclePreview, HrLifecycleState } from './lifecycle-types'
export type { HrLifecycleAction, HrLifecyclePreview, HrLifecycleState, HrEmploymentInstance } from './lifecycle-types'

export const HR_REHIRE_POLICY = 'Retain directory identity, prior onboarding receipts, balances, fictional hourly rate timelines and benefit elections unchanged. New employment requires a new captured onboarding checklist. Submitted payroll and consumed time remain frozen; no provider access or account grant is created.'
function seedFixture(state: HrDemoState, base: HrFixture): HrFixture {
  const hired = new Map(state.recruiting.hiredEmployees.map(employee => [employee.id, employee]))
  for (const employee of base.employees) {
    const hire = hired.get(employee.id)
    if (hire && JSON.stringify(employee) !== JSON.stringify(hire)) throw new Error('Use the raw base fixture, not an overlaid employee projection.')
  }
  return { ...base, employees: base.employees.filter(employee => !hired.has(employee.id)) }
}
function rawFixture(state: HrDemoState, base: HrFixture) { return recruitingFixture(seedFixture(state, base), state.recruiting) }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
function sampleText(value: unknown, label: string, max = 100) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > max || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`Enter a sample ${label} using 2–${max} printable characters.`)
  return value.trim()
}
function email(value: string) {
  const result = sampleText(value, 'work email', 160)
  if (!/^[^\s@]+@[^\s@]+\.invalid$/i.test(result)) throw new Error('Use a synthetic work email ending in .invalid.')
  return result
}
function validDate(value: string) { if (!validateTimeEntry(value, 1).valid) throw new Error('Choose a valid explicit sample date.'); return value }
function initialLifecycle(state: HrDemoState, base: HrFixture, simulationDate: string | null): HrLifecycleState {
  return createHrLifecycle(state.workflow, rawFixture(state, base), simulationDate, state.recruiting)
}
/** Pure view: legacy facts are projected without adding fields to saved state. */
export function lifecycleView(state: HrDemoState, base: HrFixture) {
  const lifecycle = state.workflow.lifecycle ?? initialLifecycle(state, base, null)
  return { ...structuredClone(lifecycle), simulationDate: state.workflow.lifecycle?.simulationDate ?? null, policy: HR_REHIRE_POLICY }
}
/** Use this fixture for BOTH rendering and every native HR authority check. */
export function effectiveHrFixture(state: HrDemoState, base: HrFixture): HrFixture {
  return effectiveWorkflowFixture(state.workflow, rawFixture(state, base))
}
/** Returns only the IDs belonging to cycles; descendants outside a cycle are excluded. */
export function reportingCycleIds(employees: { id: string; managerId: string | null }[]): string[] {
  const managers = new Map(employees.map(employee => [employee.id, employee.managerId]))
  const cycles = new Set<string>()
  for (const employee of employees) {
    const path: string[] = []; const seen = new Map<string, number>(); let id: string | null | undefined = employee.id
    while (id && managers.has(id)) {
      if (seen.has(id)) { path.slice(seen.get(id)).forEach(value => cycles.add(value)); break }
      seen.set(id, path.length); path.push(id); id = managers.get(id)
    }
  }
  return [...cycles].sort()
}
function requireManager(actor: HrActor) { if (!['employer-owner', 'hr-admin'].includes(actor.role)) throw new Error('Only the owner or HR administrator preview may change employment lifecycle records.') }
function sourceValid(state: HrDemoState, base: HrFixture) { if (!isHrDemoState(state, seedFixture(state, base))) throw new Error('The complete HR workspace must be valid before a lifecycle action.') }
function token(state: HrDemoState, actor: HrActor, action: HrLifecycleAction, base: HrFixture) { return JSON.stringify({ schemaVersion: 1, state, actor, action, base }) }

function candidate(state: HrDemoState, actor: HrActor, action: HrLifecycleAction, base: HrFixture) {
  sourceValid(state, base)
  validDate(action.simulationDate)
  if (state.workflow.lifecycle && state.workflow.lifecycle.simulationDate !== null && action.simulationDate < state.workflow.lifecycle.simulationDate) throw new Error('The simulation date cannot precede the last accepted lifecycle action.')
  const next = structuredClone(state)
  const lifecycle = next.workflow.lifecycle ??= initialLifecycle(state, base, action.simulationDate)
  lifecycle.simulationDate = action.simulationDate
  const fixture = effectiveHrFixture(state, base)
  const preview: Omit<HrLifecyclePreview, 'confirmation'> = { action: structuredClone(action), policy: HR_REHIRE_POLICY }
  const sequence = () => lifecycle.sequence++
  const getInstance = (employeeId: string) => {
    const instance = lifecycle.instances.find(item => item.id === lifecycle.activeInstances[employeeId])
    if (!instance) throw new Error('Choose an existing fictional employee.')
    preview.employeeId = employeeId; preview.instanceId = instance.id
    return instance
  }
  const managerValid = (employeeId: string, managerId: string | null) => {
    if (managerId === employeeId) throw new Error(`An employee cannot manage themselves. Affected employee IDs: ${employeeId}.`)
    if (managerId !== null && !fixture.employees.some(employee => employee.id === managerId && employee.employmentStatus === 'active')) throw new Error('Choose an existing active fictional manager or no manager.')
  }
  const dated = (instance: HrEmploymentInstance, date: string) => {
    validDate(date)
    const latest = lifecycle.events.filter(event => event.instanceId === instance.id).at(-1)?.effectiveDate ?? instance.startDate
    if (date > action.simulationDate || latest && date < latest) throw new Error('The effective date must follow this instance’s history and be on or before the simulation date.')
  }
  const event = (kind: 'transfer' | 'leave' | 'return' | 'terminate' | 'rehire' | 'select-template' | 'set-simulation-date', effectiveDate: string, previous: HrEmploymentSnapshot | string | null, proposed: HrEmploymentSnapshot | string, instance?: HrEmploymentInstance, reason = '') => {
    const seq = sequence(); const id = `lifecycle-${seq}`
    lifecycle.events.push({ id, sequence: seq, kind, effectiveDate, previous: structuredClone(previous), proposed: structuredClone(proposed), actor: { ...actor }, reason, ...(instance ? { employeeId: instance.employeeId, instanceId: instance.id } : {}) })
    preview.previous = previous; preview.proposed = proposed
    return id
  }
  const setEmail = (employeeId: string, value: string, origin: 'direct' | 'correction', correctionId?: string) => {
    const oldValue = next.workflow.profileEmails[employeeId]
    if (oldValue === value) throw new Error('The directory already has that sample work email.')
    next.workflow.profileEmails[employeeId] = value
    const onboarding = next.workflow.onboarding[employeeId]
    if (onboarding.stage !== 'complete') { onboarding.profileReviewed = false; onboarding.stage = 'draft' }
    const seq = sequence()
    lifecycle.directoryHistory.push({ id: `directory-${seq}`, sequence: seq, employeeId, field: 'workEmail', oldValue, newValue: value, actor: { ...actor }, origin, ...(correctionId ? { correctionId } : {}) })
    preview.previous = oldValue; preview.proposed = value
  }
  if (action.type === 'set-simulation-date') {
    requireManager(actor)
    if (state.workflow.lifecycle?.simulationDate === action.simulationDate) throw new Error('That simulation date is already selected.')
    event('set-simulation-date', action.simulationDate, state.workflow.lifecycle?.simulationDate ?? null, action.simulationDate)
  } else if (action.type === 'select-template') {
    requireManager(actor); hrOnboardingTemplate(action.templateVersion)
    if (lifecycle.selectedTemplateVersion === action.templateVersion) throw new Error('That onboarding template version is already selected.')
    event('select-template', action.simulationDate, lifecycle.selectedTemplateVersion, action.templateVersion)
    lifecycle.selectedTemplateVersion = action.templateVersion
  } else if (action.type === 'request-correction') {
    const instance = getInstance(action.employeeId)
    if (!['employee', 'manager'].includes(actor.role) || actor.employeeId !== action.employeeId) throw new Error('Only a bound employee may propose their own directory correction.')
    const value = email(action.workEmail)
    if (value === next.workflow.profileEmails[action.employeeId]) throw new Error('Propose a different sample work email.')
    if (lifecycle.corrections.some(item => item.employeeId === action.employeeId && item.status === 'pending')) throw new Error('Review the existing pending correction first.')
    const seq = sequence()
    lifecycle.corrections.push({ id: `correction-${seq}`, sequence: seq, employeeId: action.employeeId, instanceId: instance.id, field: 'workEmail', oldValue: next.workflow.profileEmails[action.employeeId], proposedValue: value, actor: { ...actor }, status: 'pending' })
    preview.previous = next.workflow.profileEmails[action.employeeId]; preview.proposed = value
  } else if (action.type === 'review-correction') {
    requireManager(actor)
    const correction = lifecycle.corrections.find(item => item.id === action.correctionId)
    if (!correction || correction.status !== 'pending') throw new Error('Choose an unreviewed sample correction.')
    const reason = sampleText(action.reason, 'correction outcome reason', 500)
    getInstance(correction.employeeId)
    if (lifecycle.activeInstances[correction.employeeId] !== correction.instanceId) throw new Error('This correction belongs to a previous employment instance.')
    if (!['accepted', 'rejected'].includes(action.outcome)) throw new Error('Choose an accepted or rejected correction outcome.')
    if (action.outcome === 'accepted') {
      if (next.workflow.profileEmails[correction.employeeId] !== correction.oldValue || lifecycle.directoryHistory.some(item => item.employeeId === correction.employeeId && item.sequence > correction.sequence)) throw new Error('The directory changed after this correction was proposed. Review a new proposal.')
      setEmail(correction.employeeId, correction.proposedValue, 'correction', correction.id)
    } else { preview.previous = correction.oldValue; preview.proposed = correction.proposedValue }
    correction.status = action.outcome; correction.outcome = { sequence: sequence(), actor: { ...actor }, reason }
  } else if (action.type === 'edit-directory') {
    getInstance(action.employeeId)
    if (!canEditEmployeeProfile(actor, action.employeeId)) throw new Error('This preview role cannot edit that directory record.')
    setEmail(action.employeeId, email(action.workEmail), 'direct')
  } else {
    requireManager(actor)
    const instance = getInstance(action.employeeId)
    if (action.type === 'rehire') {
      dated(instance, action.startDate)
      if (instance.current.status !== 'terminated' || !instance.endDate || action.startDate <= instance.endDate) throw new Error('Rehire requires a terminated instance and a start date after its end date.')
      managerValid(action.employeeId, action.managerId)
      if (instance.current.managerId !== action.managerId && next.performance.reviews.some(review => review.employeeId === action.employeeId && review.stage !== 'acknowledged')) throw new Error('Finish and acknowledge the existing performance review before changing its direct manager on rehire.')
      const template = hrOnboardingTemplate(lifecycle.selectedTemplateVersion)
      instance.archivedOnboarding = structuredClone(next.workflow.onboarding[action.employeeId])
      const initial = { status: 'onboarding', department: sampleText(action.department, 'department', 80), jobTitle: sampleText(action.jobTitle, 'job title'), managerId: action.managerId }
      const count = lifecycle.instances.filter(item => item.employeeId === action.employeeId).length + 1
      const added: HrEmploymentInstance = { id: `employment-${action.employeeId}-${count}`, employeeId: action.employeeId, startDate: action.startDate, endDate: null, previousInstanceId: instance.id, initial, current: { ...initial }, templateVersion: template.version, tasks: template.tasks }
      lifecycle.instances.push(added); lifecycle.activeInstances[action.employeeId] = added.id
      next.workflow.onboarding[action.employeeId] = { profileReviewed: false, jobReviewed: false, tasks: Object.fromEntries(template.tasks.map(task => [task.id, false])), stage: 'draft' }
      next.workflow.employeeStatuses[action.employeeId] = 'onboarding'
      event('rehire', action.startDate, null, added.current, added)
      preview.rehire = { retainedEmployeeId: action.employeeId, priorInstanceId: instance.id, newInstanceId: added.id, templateVersion: template.version, tasks: structuredClone(template.tasks) }
    } else {
      dated(instance, action.effectiveDate)
      if (instance.current.status === 'terminated') throw new Error('This instance is terminated; compare a new fictional rehire.')
      const previous = { ...instance.current }
      if (action.type === 'transfer') {
        managerValid(action.employeeId, action.managerId)
        const department = sampleText(action.department, 'department', 80)
        if (instance.current.department === department && instance.current.managerId === action.managerId) throw new Error('The proposed transfer has no changes.')
        if (instance.current.managerId !== action.managerId && next.performance.reviews.some(review => review.employeeId === action.employeeId && review.stage !== 'acknowledged')) throw new Error('Finish and acknowledge the existing performance review before changing its direct manager.')
        instance.current = { ...instance.current, department, managerId: action.managerId }
      } else {
        const reason = sampleText(action.reason, 'transition reason', 500)
        if (action.type === 'leave' && instance.current.status !== 'active' || action.type === 'return' && instance.current.status !== 'on-leave' || action.type === 'terminate' && !['active', 'on-leave', 'onboarding'].includes(instance.current.status)) throw new Error('That employment transition is not allowed from the prior state.')
        if (action.type === 'terminate') {
          const reports = fixture.employees.filter(employee => employee.managerId === action.employeeId && employee.employmentStatus !== 'terminated').map(employee => employee.id)
          if (reports.length) throw new Error(`Transfer the current direct reports before termination: ${reports.join(', ')}.`)
          instance.endDate = action.effectiveDate
        }
        instance.current.status = action.type === 'leave' ? 'on-leave' : action.type === 'return' ? 'active' : 'terminated'
        next.workflow.employeeStatuses[action.employeeId] = instance.current.status
        const transitionId = event(action.type, action.effectiveDate, previous, instance.current, instance, reason)
        if (action.type === 'terminate') {
          const assignments = (['asset', 'access', 'handover'] as const).map(kind => ({ id: `${transitionId}-${kind}`, employeeId: action.employeeId, instanceId: instance.id, transitionId, kind, title: ({ asset: 'Return fictional assigned assets', access: 'Review fictional access removal', handover: 'Complete fictional handover' })[kind], status: 'assigned' as const }))
          lifecycle.offboardingAssignments.push(...assignments)
          if (assignments.some(assignment => next.operations.records.tasks.some(task => task.id === assignment.id))) throw new Error('An offboarding assignment identity already exists.')
          next.operations.records.tasks.push(...assignments.map(assignment => ({ id: assignment.id, employeeId: assignment.employeeId, employmentInstanceId: assignment.instanceId, sourceId: assignment.id, lifecycleTransitionId: assignment.transitionId, offboardingKind: assignment.kind, title: assignment.title, status: 'pending' })))
          preview.offboarding = structuredClone(assignments)
        }
      }
      if (action.type === 'transfer') event('transfer', action.effectiveDate, previous, instance.current, instance)
    }
    const proposedFixture = effectiveHrFixture(next, base)
    const cycles = reportingCycleIds(proposedFixture.employees)
    if (cycles.length) throw new Error(`Reporting cycle refused. Affected employee IDs: ${cycles.join(', ')}.`)
    if (action.type === 'transfer' || action.type === 'rehire') {
      const managerIds = new Set([...fixture.employees, ...proposedFixture.employees].map(employee => employee.managerId).filter((id): id is string => Boolean(id)))
      preview.scopeChanges = [...managerIds].sort().map(managerId => ({ managerId, previousReportIds: fixture.employees.filter(employee => employee.managerId === managerId).map(employee => employee.id).sort(), proposedReportIds: proposedFixture.employees.filter(employee => employee.managerId === managerId).map(employee => employee.id).sort() })).filter(item => !same(item.previousReportIds, item.proposedReportIds))
    }
  }
  sourceValid(next, base)
  return { next, preview }
}
export function previewHrLifecycle(state: HrDemoState, actor: HrActor, action: HrLifecycleAction, base: HrFixture): HrLifecyclePreview {
  return { ...candidate(state, actor, action, base).preview, confirmation: token(state, actor, action, base) }
}
export function confirmHrLifecycle(state: HrDemoState, actor: HrActor, action: HrLifecycleAction, confirmation: string, base: HrFixture): HrDemoState {
  if (typeof confirmation !== 'string' || confirmation !== token(state, actor, action, base)) throw new Error('The reviewed HR source, action or preview identity changed. Preview again before confirmation.')
  return candidate(state, actor, action, base).next
}
