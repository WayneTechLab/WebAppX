import { validateTimeOff, type HrActor, type HrFixture, type HrRecord } from './model'

export type PeopleModule = 'time-off' | 'tasks' | 'policies' | 'training' | 'assets' | 'documents' | 'activity'
export type PeopleRecordModule = Exclude<PeopleModule, 'time-off' | 'activity'>
export type LeaveType = 'vacation' | 'sick'
export type PeoplePtoRequest = HrRecord & { employeeId: string; startDate: string; endDate: string; type: LeaveType; hours: number; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; receipt?: string; reason?: string }
export type PeopleActivity = {
  id: string; receipt: string; sequence: number; action: PeopleOperationsEvent['type'];
  actor: HrActor; module: Exclude<PeopleModule, 'activity'>; recordId: string;
  employeeId?: string; contractorId?: string; previousStatus: string; status: string; description: string;
}
export type PeopleOperationsState = {
  ptoRequests: PeoplePtoRequest[];
  balances: Record<string, Record<LeaveType, number>>;
  records: Record<PeopleRecordModule, HrRecord[]>;
  activity: PeopleActivity[];
  sequence: number;
}
export type PeopleOperationsEvent =
  | { type: 'request-pto'; employeeId?: string; startDate: string; endDate: string; leaveType: LeaveType }
  | { type: 'approve-pto' | 'reject-pto' | 'cancel-pto'; requestId: string; reason?: string }
  | { type: 'complete-task' | 'acknowledge-policy' | 'complete-training' | 'acknowledge-asset' | 'request-asset-return' | 'confirm-asset-return' | 'acknowledge-document'; recordId: string }

const companyReaders = new Set(['employer-owner', 'hr-admin', 'auditor'])
const companyWriters = new Set(['employer-owner', 'hr-admin'])
const reservingStatuses = new Set(['pending', 'approved'])
const acknowledgeableDocumentTypes = new Set(['policy', 'handbook', 'welcome', 'training'])
const eventModules: Partial<Record<PeopleOperationsEvent['type'], PeopleRecordModule>> = {
  'complete-task': 'tasks', 'acknowledge-policy': 'policies', 'complete-training': 'training',
  'acknowledge-asset': 'assets', 'request-asset-return': 'assets', 'confirm-asset-return': 'assets', 'acknowledge-document': 'documents',
}

export function createPeopleOperations(fixture: HrFixture): PeopleOperationsState {
  const assignments = (records: HrRecord[]) => records.flatMap(record => {
    const employeeIds = Array.isArray(record.employeeIds) ? [...new Set(record.employeeIds.filter(id => knownEmployee(id, fixture)) as string[])] : []
    if (!employeeIds.length) return [structuredClone(record)]
    return employeeIds.map(employeeId => ({ ...structuredClone(record), id: `${record.id}--${employeeId}`, sourceId: record.id, employeeId }))
  })
  return {
    ptoRequests: fixture.timeOffRequests.map(request => ({ ...structuredClone(request), employeeId: String(request.employeeId), startDate: String(request.startDate), endDate: String(request.endDate), type: request.type === 'sick' ? 'sick' : 'vacation', hours: Number(request.hours), status: ['pending', 'approved', 'rejected', 'cancelled'].includes(String(request.status)) ? request.status as PeoplePtoRequest['status'] : 'pending' })),
    balances: Object.fromEntries(fixture.employees.map(employee => [employee.id, { vacation: 40, sick: 24 }])),
    records: {
      tasks: assignments(fixture.native.tasks ?? []), policies: assignments(fixture.native.policies ?? []),
      training: assignments(fixture.native.training ?? []), assets: assignments(fixture.native.assets ?? []),
      documents: assignments(fixture.documents),
    },
    activity: [], sequence: 1,
  }
}

function knownEmployee(id: unknown, fixture: HrFixture) {
  return typeof id === 'string' && fixture.employees.some(employee => employee.id === id)
}

function ownSubject(actor: HrActor, record: HrRecord, fixture: HrFixture) {
  if (['employee', 'manager'].includes(actor.role) && knownEmployee(actor.employeeId, fixture)) return record.employeeId === actor.employeeId
  return actor.role === 'contractor' && Boolean(actor.contractorId) && fixture.contractors.some(contractor => contractor.id === actor.contractorId) && record.contractorId === actor.contractorId
}

function directReport(actor: HrActor, record: HrRecord, fixture: HrFixture) {
  return actor.role === 'manager' && knownEmployee(actor.employeeId, fixture) && record.employeeId !== actor.employeeId && fixture.employees.some(employee => employee.id === record.employeeId && employee.managerId === actor.employeeId)
}

function scopedSubject(actor: HrActor, record: HrRecord, fixture: HrFixture) {
  return companyReaders.has(actor.role) || ownSubject(actor, record, fixture) || directReport(actor, record, fixture)
}

function mayChangeSubject(actor: HrActor, record: HrRecord, fixture: HrFixture) {
  return companyWriters.has(actor.role) || ownSubject(actor, record, fixture) || directReport(actor, record, fixture)
}

export function getPeopleRecords(state: PeopleOperationsState, module: PeopleRecordModule, actor: HrActor, fixture: HrFixture) {
  if (actor.role === 'payroll-admin' && module === 'documents') return state.records.documents
  return state.records[module].filter(record => scopedSubject(actor, record, fixture))
}

export function peopleOperationsSummary(state: PeopleOperationsState, actor: HrActor, fixture: HrFixture) {
  const pending = (module: PeopleRecordModule, statuses: string[]) => getPeopleRecords(state, module, actor, fixture).filter(record => statuses.includes(String(record.status))).length
  const tasks = pending('tasks', ['pending', 'draft', 'assigned', 'in-progress', 'open'])
  const policies = pending('policies', ['published', 'pending', 'assigned'])
  const training = pending('training', ['pending', 'draft', 'assigned', 'in-progress'])
  const assets = pending('assets', ['pending', 'assigned', 'return-requested'])
  const documents = getPeopleRecords(state, 'documents', actor, fixture).filter(record => acknowledgeableDocumentTypes.has(String(record.type)) && ['pending', 'published', 'assigned'].includes(String(record.status))).length
  const pendingPto = getPeoplePtoRequests(state, actor, fixture).filter(request => request.status === 'pending').length
  return { openCount: tasks + policies + training + assets + documents, tasks, policies, training, assets, documents, pendingPto }
}

export function getPeoplePtoRequests(state: PeopleOperationsState, actor: HrActor, fixture: HrFixture) {
  // Payroll admins can inspect time-off metadata but cannot approve or change it.
  if (actor.role === 'payroll-admin') return state.ptoRequests
  return state.ptoRequests.filter(request => scopedSubject(actor, request, fixture))
}

export function getPeopleActivity(state: PeopleOperationsState, actor: HrActor, fixture: HrFixture) {
  return state.activity.filter(activity => scopedSubject(actor, { id: activity.recordId, employeeId: activity.employeeId, contractorId: activity.contractorId }, fixture))
}

export function getPeopleBalance(state: PeopleOperationsState, employeeId: string, type: LeaveType) {
  const total = state.balances[employeeId]?.[type] ?? 0
  const matching = state.ptoRequests.filter(request => request.employeeId === employeeId && request.type === type)
  const pending = matching.filter(request => request.status === 'pending').reduce((hours, request) => hours + request.hours, 0)
  const approved = matching.filter(request => request.status === 'approved').reduce((hours, request) => hours + request.hours, 0)
  return { total, pending, approved, available: total - pending - approved }
}

export function peoplePtoHours(startDate: string, endDate: string) {
  const validation = validateTimeOff(startDate, endDate)
  if (!validation.valid) throw new Error(validation.error)
  let hours = 0
  const end = new Date(`${endDate}T00:00:00Z`).valueOf()
  for (let date = new Date(`${startDate}T00:00:00Z`).valueOf(); date <= end; date += 86400000) {
    const day = new Date(date).getUTCDay()
    if (day !== 0 && day !== 6) hours += 8
  }
  if (!hours) throw new Error('Choose at least one Monday–Friday day in this synthetic leave policy.')
  return hours
}

export function transitionPeopleOperations(state: PeopleOperationsState, event: PeopleOperationsEvent, actor: HrActor, fixture: HrFixture): PeopleOperationsState {
  const next = structuredClone(state)
  if (actor.role === 'auditor') throw new Error('The auditor preview is read-only.')
  const appendActivity = (module: PeopleActivity['module'], record: HrRecord, previousStatus: string, description: string) => {
    const sequence = next.sequence++
    const receipt = `MOCK-PEOPLE-${String(sequence).padStart(4, '0')}`
    record.receipt = receipt
    next.activity.push({ id: `people-activity-${sequence}`, receipt, sequence, action: event.type, actor: { ...actor }, module, recordId: record.id, employeeId: record.employeeId, contractorId: typeof record.contractorId === 'string' ? record.contractorId : undefined, previousStatus, status: String(record.status), description })
  }
  if (event.type === 'request-pto') {
    const employeeId = event.employeeId ?? actor.employeeId
    if (!knownEmployee(employeeId, fixture)) throw new Error('A known synthetic employee is required.')
    if (!companyWriters.has(actor.role) && (!['employee', 'manager'].includes(actor.role) || actor.employeeId !== employeeId)) throw new Error('You can request sample leave only for your bound employee identity.')
    if (!['vacation', 'sick'].includes(event.leaveType)) throw new Error('Choose vacation or sick leave.')
    const hours = peoplePtoHours(event.startDate, event.endDate)
    if (next.ptoRequests.some(request => request.employeeId === employeeId && reservingStatuses.has(request.status) && request.startDate <= event.endDate && request.endDate >= event.startDate)) throw new Error('This sample request overlaps pending or approved leave for the same employee.')
    const balance = getPeopleBalance(next, employeeId!, event.leaveType)
    if (hours > balance.available) throw new Error(`Only ${balance.available} sample ${event.leaveType} hours are available after reservations.`)
    const request: PeoplePtoRequest = { id: `people-pto-${next.sequence}`, employeeId: employeeId!, startDate: event.startDate, endDate: event.endDate, type: event.leaveType, hours, status: 'pending' }
    next.ptoRequests.push(request)
    appendActivity('time-off', request, 'new', `${hours} fictional ${event.leaveType} hours requested; balance reserved.`)
    return next
  }
  if (['approve-pto', 'reject-pto', 'cancel-pto'].includes(event.type)) {
    const decision = event as Extract<PeopleOperationsEvent, { requestId: string }>
    const request = next.ptoRequests.find(value => value.id === decision.requestId)
    if (!request) throw new Error('The sample leave request was not found.')
    const previousStatus = request.status
    if (decision.type === 'cancel-pto') {
      if (!mayChangeSubject(actor, request, fixture)) throw new Error('This role cannot cancel that sample leave request.')
      if (!reservingStatuses.has(request.status)) throw new Error('Only pending or approved sample leave can be cancelled.')
      request.status = 'cancelled'
    } else {
      if (!companyWriters.has(actor.role) && !directReport(actor, request, fixture)) throw new Error('Leave decisions require HR administration or a direct-report manager; self-approval is unavailable.')
      if (request.status !== 'pending') throw new Error('Only pending sample leave can be approved or rejected.')
      if (decision.type === 'approve-pto' && getPeopleBalance(next, request.employeeId, request.type).available < 0) throw new Error('The synthetic leave balance is over-reserved; correct requests before approval.')
      request.status = decision.type === 'approve-pto' ? 'approved' : 'rejected'
    }
    if (decision.reason) request.reason = decision.reason.trim().slice(0, 200)
    appendActivity('time-off', request, previousStatus, `Sample leave ${request.status}; no calendar or payroll provider was changed.`)
    return next
  }
  const change = event as Extract<PeopleOperationsEvent, { recordId: string }>
  const module = eventModules[change.type]
  if (!module) throw new Error('Unknown people operation.')
  const record = next.records[module].find(value => value.id === change.recordId)
  if (!record || !mayChangeSubject(actor, record, fixture)) throw new Error('This role cannot change that sample record.')
  const previousStatus = String(record.status ?? 'pending')
  if (change.type === 'complete-task' || change.type === 'complete-training') {
    if (!['pending', 'draft', 'assigned', 'in-progress', 'open'].includes(previousStatus)) throw new Error('This sample assignment is already complete or unavailable.')
    record.status = 'completed'
  } else if (change.type === 'acknowledge-policy' || change.type === 'acknowledge-document') {
    if (!ownSubject(actor, record, fixture)) throw new Error('Only the bound person can acknowledge their own sample policy or document; managers and administrators cannot acknowledge for another person.')
    if (change.type === 'acknowledge-document' && !acknowledgeableDocumentTypes.has(String(record.type))) throw new Error('Only non-tax policy, handbook, welcome or training documents can be acknowledged in this preview; provider forms remain unavailable.')
    if (!['published', 'pending', 'assigned'].includes(previousStatus)) throw new Error('This sample record has already been acknowledged or is unavailable.')
    record.status = 'acknowledged'
  } else if (change.type === 'acknowledge-asset') {
    if (!['assigned', 'pending'].includes(previousStatus)) throw new Error('Only a pending or assigned sample asset can be acknowledged.')
    record.status = 'acknowledged'
  } else if (change.type === 'request-asset-return') {
    if (!['assigned', 'acknowledged'].includes(previousStatus)) throw new Error('A sample asset must be assigned or acknowledged before requesting its return.')
    record.status = 'return-requested'
  } else if (change.type === 'confirm-asset-return') {
    if (!companyWriters.has(actor.role) && !directReport(actor, record, fixture)) throw new Error('Sample return confirmation requires HR administration or the assigned employee’s manager.')
    if (previousStatus !== 'return-requested') throw new Error('Request the sample asset return before confirming it.')
    record.status = 'returned'
  }
  appendActivity(module, record, previousStatus, `Sample ${module} record marked ${record.status}; this is not a legal signature, training certification or physical custody receipt.`)
  return next
}

export function canPeopleOperation(state: PeopleOperationsState, event: PeopleOperationsEvent, actor: HrActor, fixture: HrFixture) {
  try { transitionPeopleOperations(state, event, actor, fixture); return true } catch { return false }
}
