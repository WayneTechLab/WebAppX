import type {
  EventBase, LifecycleJob, RecruitingDomainHandler, RecruitingLifecycleV1, RecruitingPlanContext,
  RecruitingReplayContext, RecruitingRequisition, RequisitionApproval, RequisitionCommand,
  RequisitionContent, RequisitionEvent, JobPublication,
} from './recruiting-lifecycle-types'
import {
  assert, assertRecruitingActor, canonicalRecruitingJson, copyRecruiting, exactKeys, isRecruitingManager,
  nextRecruitingId, recruitingId, recruitingInstant, recruitingInteger, recruitingText,
  refuse, RECRUITING_LIMITS, sameRecruitingValue,
} from './recruiting-lifecycle-value'

const terminal = new Set(['hired', 'rejected', 'withdrawn'])
const unavailable = () => refuse('This recruiting preview is unavailable.', 'unavailable')
const stale = () => refuse('This recruiting record changed. Review its current revision and preview again.', 'stale')
const capacity = () => refuse('This local workspace has reached its capacity. No records were changed.', 'limit')
function room(count: number, limit: number) { if (count >= limit) capacity() }
function content(value: RequisitionContent, known: ReadonlySet<string>): RequisitionContent {
  exactKeys(value, ['department', 'ownerEmployeeId', 'headcount'])
  recruitingInteger(value.headcount, 1, 50)
  assert(typeof value.ownerEmployeeId === 'string' && known.has(value.ownerEmployeeId))
  return { department: recruitingText(value.department, 2, 80), ownerEmployeeId: value.ownerEmployeeId, headcount: value.headcount }
}
function requisition(state: RecruitingLifecycleV1, id: string, revision?: number) {
  recruitingId(id)
  const record = state.requisitions.find(item => item.id === id)
  assert(record, 'The sample requisition is unavailable.')
  if (revision !== undefined && record.revision !== revision) stale()
  return record
}
function job(state: RecruitingLifecycleV1, id: string, revision?: number) {
  recruitingId(id, 200)
  const record = state.jobs.find(item => item.id === id)
  assert(record, 'The sample job is unavailable.')
  if (revision !== undefined && record.revision !== revision) stale()
  return record
}
function nextRevision(revision: number) { recruitingInteger(revision, 1, 1000); if (revision === 1000) capacity(); return revision + 1 }
function approval(state: RecruitingLifecycleV1, record: RecruitingRequisition) {
  const capture = state.approvals.find(item => item.id === record.currentApprovalId)
  assert(record.state === 'approved' && capture && capture.requisitionId === record.id && capture.revision === record.revision && sameRecruitingValue(capture.content, record.content), 'The sample requisition needs approval of its current revision.')
  return capture
}
function duplicateJob(state: RecruitingLifecycleV1, title: string, department: string, except?: string) {
  assert(!state.jobs.some(item => item.id !== except && item.state !== 'closed' && item.title.toLowerCase() === title.toLowerCase() && item.department.toLowerCase() === department.toLowerCase()), 'An open sample job already uses that title and department.')
}
function validateBase(state: RecruitingLifecycleV1, event: EventBase, known: ReadonlySet<string>) {
  assertRecruitingActor(event.actor, known)
  if (!isRecruitingManager(event.actor)) unavailable()
  room(state.events.length, RECRUITING_LIMITS.events)
  recruitingInstant(event.recordedAt); recruitingId(event.id); recruitingInteger(event.sequence, 1, RECRUITING_LIMITS.events)
  assert(event.sequence === state.sequence && event.id === `recruit-event-${String(event.sequence).padStart(4, '0')}`)
}
function currentOwner(context: RecruitingPlanContext, id: string) {
  assert(context.employees.some(employee => employee.id === id && employee.employmentStatus === 'active'), 'Choose an active fictional requisition owner.')
}
function currentManager(context: RecruitingPlanContext, id: string) {
  assert(context.employees.some(employee => employee.id === id && employee.employmentStatus === 'active') && context.employees.some(employee => employee.managerId === id), 'Choose an active fictional hiring manager with an existing team.')
}
function knownIds(context: RecruitingPlanContext) { return new Set(context.employees.map(employee => employee.id)) }

/** Plan emits facts only. The controller privately binds the complete source;
 * core alone appends accepted events and advances the global sequence. */
function plan(command: RequisitionCommand, context: RecruitingPlanContext): RequisitionEvent[] {
  const known = knownIds(context)
  canonicalRecruitingJson(context.actor)
  assertRecruitingActor(context.actor, known)
  if (!isRecruitingManager(context.actor)) unavailable()
  canonicalRecruitingJson(command)
  const state = context.lifecycle
  const fields: Record<RequisitionCommand['kind'], string[]> = {
    'create-requisition': ['content'], 'edit-requisition': ['requisitionId', 'revision', 'content'],
    'request-requisition-review': ['requisitionId', 'revision'], 'review-requisition': ['requisitionId', 'revision', 'outcome', 'reason'],
    'create-job': ['title', 'department', 'managerEmployeeId', 'requisitionId'], 'bind-job-requisition': ['jobId', 'revision', 'requisitionId'],
    'publish-job': ['jobId', 'revision'], 'close-job': ['jobId', 'revision'],
  }
  assert(Object.hasOwn(fields, command.kind))
  exactKeys(command, ['kind', 'recordedAt', ...fields[command.kind]])
  recruitingInstant(command.recordedAt)
  if ('revision' in command) recruitingInteger(command.revision, 1, 1000)
  const base = copyRecruiting(context.event())
  exactKeys(base, ['id', 'sequence', 'actor', 'recordedAt'])
  validateBase(state, base, known)
  assert(sameRecruitingValue(base.actor, context.actor) && base.recordedAt === command.recordedAt)
  if (command.kind === 'create-requisition') {
    room(state.requisitions.length, RECRUITING_LIMITS.requisitions)
    const proposed = content(command.content, known); currentOwner(context, proposed.ownerEmployeeId)
    return [{ ...base, kind: 'requisition-changed', requisitionId: nextRecruitingId('rrequisition', state.requisitions), previousRevision: null,
      requisition: { id: nextRecruitingId('rrequisition', state.requisitions), revision: 1, content: proposed, state: 'draft', currentApprovalId: null } }]
  }
  if (command.kind === 'edit-requisition' || command.kind === 'request-requisition-review' || command.kind === 'review-requisition') {
    const record = requisition(state, command.requisitionId, command.revision)
    if (command.kind === 'edit-requisition') {
      const proposed = content(command.content, known); currentOwner(context, proposed.ownerEmployeeId)
      assert(!sameRecruitingValue(proposed, record.content), 'The proposed requisition has no changes.')
      return [{ ...base, kind: 'requisition-changed', requisitionId: record.id, previousRevision: record.revision,
        requisition: { ...copyRecruiting(record), revision: nextRevision(record.revision), content: proposed, state: 'draft', currentApprovalId: null } }]
    }
    currentOwner(context, record.content.ownerEmployeeId)
    if (command.kind === 'request-requisition-review') {
      assert(record.state === 'draft' || record.state === 'rejected', 'Only a draft or rejected sample requisition can request review.')
      return [{ ...base, kind: 'requisition-changed', requisitionId: record.id, previousRevision: record.revision, requisition: { ...copyRecruiting(record), state: 'in-review', currentApprovalId: null } }]
    }
    assert(record.state === 'in-review', 'Request sample requisition review before recording an outcome.')
    assert(command.outcome === 'approved' || command.outcome === 'rejected')
    const reason = recruitingText(command.reason, 2, 500)
    let capture: RequisitionApproval | null = null
    if (command.outcome === 'approved') {
      room(state.approvals.length, RECRUITING_LIMITS.approvals)
      capture = { id: nextRecruitingId('rapproval', state.approvals), requisitionId: record.id, revision: record.revision, content: copyRecruiting(record.content), eventId: base.id, actor: copyRecruiting(base.actor), recordedAt: base.recordedAt }
    }
    return [{ ...base, kind: 'requisition-reviewed', requisitionId: record.id, revision: record.revision, outcome: command.outcome, reason, approval: capture }]
  }
  if (command.kind === 'create-job') {
    room(state.jobs.length, RECRUITING_LIMITS.jobs)
    const request = requisition(state, command.requisitionId); approval(state, request); currentOwner(context, request.content.ownerEmployeeId)
    currentManager(context, command.managerEmployeeId)
    const title = recruitingText(command.title, 3, 100); const department = recruitingText(command.department, 2, 80)
    assert(department === request.content.department, 'The job department must match its approved requisition.')
    duplicateJob(state, title, department)
    const id = nextRecruitingId('rjob', state.jobs)
    return [{ ...base, kind: 'job-changed', jobId: id, previousRevision: null, job: { id, revision: 1, title, department, managerEmployeeId: command.managerEmployeeId, state: 'draft', requisitionId: request.id, currentPublicationId: null, provenance: { kind: 'created', eventId: base.id } } }]
  }
  const record = job(state, command.jobId, command.revision)
  if (command.kind === 'close-job') {
    assert(record.state === 'published', 'Only a published sample job can be closed.')
    assert(!state.applications.some(application => application.jobId === record.id && !terminal.has(application.stage)), 'Finish or end each active application before closing the job.')
    return [{ ...base, kind: 'job-changed', jobId: record.id, previousRevision: record.revision, job: { ...copyRecruiting(record), revision: nextRevision(record.revision), state: 'closed' } }]
  }
  assert(record.state === 'draft', 'Only a draft sample job can be bound or published.')
  const request = requisition(state, command.kind === 'bind-job-requisition' ? command.requisitionId : record.requisitionId ?? '')
  const capture = approval(state, request); currentOwner(context, request.content.ownerEmployeeId); currentManager(context, record.managerEmployeeId)
  if (command.kind === 'bind-job-requisition') {
    assert(record.requisitionId !== request.id || record.department !== request.content.department, 'The job already has this approved requisition binding.')
    duplicateJob(state, record.title, request.content.department, record.id)
    return [{ ...base, kind: 'job-changed', jobId: record.id, previousRevision: record.revision, job: { ...copyRecruiting(record), revision: nextRevision(record.revision), requisitionId: request.id, department: request.content.department } }]
  }
  assert(record.department === request.content.department, 'Review and bind the job to its current approved requisition department.')
  room(state.publications.length, RECRUITING_LIMITS.publications)
  const publication: JobPublication = { id: nextRecruitingId('rpublication', state.publications), jobId: record.id, jobRevision: record.revision,
    job: { title: record.title, department: record.department, managerEmployeeId: record.managerEmployeeId }, requisitionApprovalId: capture.id,
    eventId: base.id, actor: copyRecruiting(base.actor), recordedAt: base.recordedAt }
  return [{ ...base, kind: 'job-published', jobId: record.id, publication }]
}

/** Rebuild only this lane's projections from immutable accepted events. Current
 * employment eligibility is deliberately not replay authority. */
function replay(lifecycle: RecruitingLifecycleV1, event: RequisitionEvent, context: RecruitingReplayContext): RecruitingLifecycleV1 {
  canonicalRecruitingJson(event)
  validateBase(lifecycle, event, context.knownEmployeeIds)
  const state = { ...lifecycle, requisitions: copyRecruiting(lifecycle.requisitions), approvals: copyRecruiting(lifecycle.approvals), jobs: copyRecruiting(lifecycle.jobs), publications: copyRecruiting(lifecycle.publications) }
  const baseFields = ['id', 'sequence', 'actor', 'recordedAt', 'kind']
  if (event.kind === 'requisition-changed') {
    exactKeys(event, [...baseFields, 'requisitionId', 'previousRevision', 'requisition'])
    const next = event.requisition
    exactKeys(next, ['id', 'revision', 'content', 'state', 'currentApprovalId'])
    const normalized = content(next.content, context.knownEmployeeIds)
    assert(next.id === event.requisitionId && sameRecruitingValue(normalized, next.content))
    if (event.previousRevision === null) {
      room(state.requisitions.length, RECRUITING_LIMITS.requisitions)
      assert(next.id === nextRecruitingId('rrequisition', state.requisitions) && next.revision === 1 && next.state === 'draft' && next.currentApprovalId === null)
      state.requisitions.push(copyRecruiting(next))
    } else {
      recruitingInteger(event.previousRevision, 1, 1000)
      const previous = requisition(state, event.requisitionId, event.previousRevision)
      const edit = next.revision === previous.revision + 1 && !sameRecruitingValue(next.content, previous.content) && next.state === 'draft'
      const review = next.revision === previous.revision && sameRecruitingValue(next.content, previous.content) && ['draft', 'rejected'].includes(previous.state) && next.state === 'in-review'
      recruitingInteger(next.revision, 1, 1000); assert((edit || review) && next.currentApprovalId === null)
      state.requisitions[state.requisitions.indexOf(previous)] = copyRecruiting(next)
    }
  } else if (event.kind === 'requisition-reviewed') {
    exactKeys(event, [...baseFields, 'requisitionId', 'revision', 'outcome', 'reason', 'approval'])
    const record = requisition(state, event.requisitionId, event.revision)
    assert(record.state === 'in-review' && ['approved', 'rejected'].includes(event.outcome))
    assert(recruitingText(event.reason, 2, 500) === event.reason)
    if (event.outcome === 'approved') {
      room(state.approvals.length, RECRUITING_LIMITS.approvals)
      const expected: RequisitionApproval = { id: nextRecruitingId('rapproval', state.approvals), requisitionId: record.id, revision: record.revision, content: copyRecruiting(record.content), eventId: event.id, actor: copyRecruiting(event.actor), recordedAt: event.recordedAt }
      assert(sameRecruitingValue(event.approval, expected))
      state.approvals.push(expected); record.currentApprovalId = expected.id
    } else { assert(event.approval === null); record.currentApprovalId = null }
    record.state = event.outcome
  } else if (event.kind === 'job-changed') {
    exactKeys(event, [...baseFields, 'jobId', 'previousRevision', 'job'])
    const next = event.job
    exactKeys(next, ['id', 'revision', 'title', 'department', 'managerEmployeeId', 'state', 'requisitionId', 'currentPublicationId', 'provenance'])
    assert(next.id === event.jobId && typeof next.managerEmployeeId === 'string' && context.knownEmployeeIds.has(next.managerEmployeeId))
    assert(recruitingText(next.title, 3, 100) === next.title && recruitingText(next.department, 2, 80) === next.department)
    if (event.previousRevision === null) {
      room(state.jobs.length, RECRUITING_LIMITS.jobs)
      const request = requisition(state, next.requisitionId ?? ''); approval(state, request)
      assert(next.id === nextRecruitingId('rjob', state.jobs) && next.revision === 1 && next.state === 'draft' && next.currentPublicationId === null && next.department === request.content.department)
      assert(sameRecruitingValue(next.provenance, { kind: 'created', eventId: event.id })); duplicateJob(state, next.title, next.department)
      state.jobs.push(copyRecruiting(next))
    } else {
      const previous = job(state, event.jobId, event.previousRevision)
      const expected: LifecycleJob = { ...previous, revision: nextRevision(previous.revision) }
      if (previous.state === 'draft' && next.state === 'draft') {
        const request = requisition(state, next.requisitionId ?? ''); approval(state, request)
        assert(previous.requisitionId !== request.id || previous.department !== request.content.department)
        expected.requisitionId = request.id; expected.department = request.content.department; duplicateJob(state, expected.title, expected.department, expected.id)
      } else {
        assert(previous.state === 'published' && next.state === 'closed')
        assert(!state.applications.some(application => application.jobId === previous.id && !terminal.has(application.stage)))
        expected.state = 'closed'
      }
      assert(sameRecruitingValue(next, expected)); state.jobs[state.jobs.indexOf(previous)] = copyRecruiting(next)
    }
  } else if (event.kind === 'job-published') {
    exactKeys(event, [...baseFields, 'jobId', 'publication'])
    room(state.publications.length, RECRUITING_LIMITS.publications)
    const record = job(state, event.jobId); const request = requisition(state, record.requisitionId ?? ''); const capture = approval(state, request)
    assert(record.state === 'draft' && record.department === request.content.department && context.knownEmployeeIds.has(record.managerEmployeeId))
    const expected: JobPublication = { id: nextRecruitingId('rpublication', state.publications), jobId: record.id, jobRevision: record.revision,
      job: { title: record.title, department: record.department, managerEmployeeId: record.managerEmployeeId }, requisitionApprovalId: capture.id,
      eventId: event.id, actor: copyRecruiting(event.actor), recordedAt: event.recordedAt }
    assert(sameRecruitingValue(event.publication, expected)); state.publications.push(expected)
    record.state = 'published'; record.currentPublicationId = expected.id
  } else refuse()
  return state
}

export const recruitingRequisitions: RecruitingDomainHandler<RequisitionCommand, RequisitionEvent> = { plan, replay }
