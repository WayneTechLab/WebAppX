import type { HrActor, HrFixture } from './model'

export type HrRequestCategory = 'equipment' | 'access' | 'hr-general'
export type HrRequestStatus = 'open' | 'in-progress' | 'resolved'
export type HrRequestActivity = { receipt: string; action: 'created' | 'assigned' | 'started' | 'resolved' | 'reopened'; actorRole: HrActor['role'] }
export type HrServiceRequest = {
  id: string; employeeId?: string; category: HrRequestCategory; title: string; details: string;
  status: HrRequestStatus; assigneeId: string | null; resolution?: string; activity: HrRequestActivity[];
}
export type HrServiceDeskState = { requests: HrServiceRequest[]; sequence: number }
export type HrServiceDeskEvent =
  | { type: 'create-request'; category: HrRequestCategory; title: string; details: string }
  | { type: 'assign-request'; requestId: string; assigneeId: string }
  | { type: 'set-request-status'; requestId: string; status: HrRequestStatus; resolution?: string }

export const hrRequestCategories: { id: HrRequestCategory; label: string }[] = [
  { id: 'equipment', label: 'Equipment' }, { id: 'access', label: 'App access' }, { id: 'hr-general', label: 'HR general' },
]

export function createHrServiceDesk(fixture: HrFixture): HrServiceDeskState {
  const requests = (fixture.native.cases ?? []).map((record, index): HrServiceRequest => ({
    id: `request-seed-${index + 1}`, title: String(record.title ?? 'Sample general request'),
    details: 'Fictional company request imported from the sample fixture. No employee private information is included.',
    category: 'equipment', status: 'open', assigneeId: 'hr-team', activity: [],
  }))
  return { requests, sequence: 0 }
}

function employeeExists(id: string | undefined, fixture: HrFixture) {
  return Boolean(id && fixture.employees.some(employee => employee.id === id))
}

export function canManageHrRequest(actor: HrActor, request: HrServiceRequest, fixture: HrFixture) {
  if (['employer-owner', 'hr-admin'].includes(actor.role)) return !request.employeeId || employeeExists(request.employeeId, fixture)
  return actor.role === 'manager' && employeeExists(actor.employeeId, fixture) && request.employeeId !== actor.employeeId &&
    fixture.employees.some(employee => employee.id === request.employeeId && employee.managerId === actor.employeeId)
}

export function scopedHrRequests(state: HrServiceDeskState, actor: HrActor, fixture: HrFixture) {
  if (['employer-owner', 'hr-admin', 'auditor'].includes(actor.role)) return state.requests.filter(request => !request.employeeId || employeeExists(request.employeeId, fixture))
  if (actor.role === 'employee' && employeeExists(actor.employeeId, fixture)) return state.requests.filter(request => request.employeeId === actor.employeeId)
  if (actor.role === 'manager') return state.requests.filter(request => canManageHrRequest(actor, request, fixture))
  return []
}

export function hrRequestAssignees(actor: HrActor, fixture: HrFixture, request?: HrServiceRequest) {
  const managers = fixture.employees.filter(employee => fixture.employees.some(report => report.managerId === employee.id))
    .filter(employee => actor.role !== 'manager' || employee.id === actor.employeeId)
    .filter(employee => !request || fixture.employees.some(report => report.id === request.employeeId && report.managerId === employee.id))
  return [{ id: 'hr-team', label: 'Sample HR team' }, ...managers.map(employee => ({ id: employee.id, label: `${employee.firstName} ${employee.lastName} · manager` }))]
}

function text(value: string, name: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`Enter a sample ${name}.`)
  const result = value.trim()
  const controlCharacter = Array.from(result).some(character => {
    const code = character.charCodeAt(0)
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
  })
  if (result.length < min || result.length > max || controlCharacter) throw new Error(`Use ${min}–${max} characters for the sample ${name}.`)
  return result
}

export function transitionHrServiceDesk(state: HrServiceDeskState, actor: HrActor, event: HrServiceDeskEvent, fixture: HrFixture): HrServiceDeskState {
  const next = structuredClone(state)
  const recordActivity = (request: HrServiceRequest, action: HrRequestActivity['action']) => {
    next.sequence += 1
    request.activity.push({ receipt: `MOCK-HR-${String(next.sequence).padStart(4, '0')}`, action, actorRole: actor.role })
  }
  if (event.type === 'create-request') {
    if (actor.role !== 'employee' || !employeeExists(actor.employeeId, fixture)) throw new Error('Choose a valid employee preview to create a sample request.')
    if (!hrRequestCategories.some(category => category.id === event.category)) throw new Error('Choose a supported general request category.')
    if (next.requests.filter(request => request.employeeId === actor.employeeId && request.status !== 'resolved').length >= 20) throw new Error('Resolve an existing sample request before creating more than 20 open requests.')
    const request: HrServiceRequest = {
      id: `request-${next.sequence + 1}`, employeeId: actor.employeeId, category: event.category,
      title: text(event.title, 'title', 3, 100), details: text(event.details, 'details', 3, 2000),
      status: 'open', assigneeId: null, activity: [],
    }
    recordActivity(request, 'created')
    next.requests.push(request)
    return next
  }
  const request = next.requests.find(record => record.id === event.requestId)
  if (!request) throw new Error('The sample request was not found.')
  if (!canManageHrRequest(actor, request, fixture)) throw new Error('This role cannot manage that sample request.')
  if (event.type === 'assign-request') {
    if (request.status === 'resolved') throw new Error('Reopen the sample request before changing its owner.')
    if (!hrRequestAssignees(actor, fixture, request).some(assignee => assignee.id === event.assigneeId)) throw new Error('Choose a valid sample HR team or permitted manager.')
    if (request.assigneeId === event.assigneeId) throw new Error('The sample request already has that owner.')
    request.assigneeId = event.assigneeId
    recordActivity(request, 'assigned')
    return next
  }
  if (event.type !== 'set-request-status') throw new Error('Unsupported sample request action.')
  if (event.status === 'in-progress') {
    if (request.status !== 'open' || !request.assigneeId) throw new Error('Assign an owner to an open sample request before starting work.')
    request.status = 'in-progress'
    recordActivity(request, 'started')
  } else if (event.status === 'resolved') {
    if (request.status !== 'in-progress') throw new Error('Start work on the sample request before resolving it.')
    request.resolution = text(event.resolution ?? '', 'resolution', 3, 500)
    request.status = 'resolved'
    recordActivity(request, 'resolved')
  } else if (event.status === 'open') {
    if (request.status !== 'resolved') throw new Error('Only a resolved sample request can be reopened.')
    request.status = 'open'
    delete request.resolution
    recordActivity(request, 'reopened')
  } else throw new Error('Choose a supported sample request status.')
  return next
}
