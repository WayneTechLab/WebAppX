import type { DemoModule } from './persistence'
import type { DemoWorkspaces } from './workspaces'

export const workspaceInspectionLimits = Object.freeze({ identifierLimit: 8, maximumIdentifierLimit: 20, identifierCharacters: 200, entities: 100_000, nodes: 300_000, characters: 6_100_000, depth: 32 })
export type InspectionKind = 'primary' | 'nested' | 'metadata'
export type InspectionOptions = { identifierLimit?: number }
export type WorkspaceCollectionInspection = { key: string; label: string; kind: InspectionKind; identityRule: string; count: number; identifiers: string[]; omittedIdentifiers: number }
export type WorkspaceModuleInspection = { module: DemoModule; primaryRecordCount: number; collections: WorkspaceCollectionInspection[] }
export type WorkspaceInspectionReport = { schemaVersion: 1; modules: WorkspaceModuleInspection[] }
type ChangeKind = 'added' | 'removed' | 'changed'
export type StructuredRecordMetadata = Record<string, string | number | null>
export type CmsProjection = 'draft' | 'approval' | 'publication'
export type ProjectionDifference = ChangeKind | 'unchanged' | 'absent'
export type WorkspaceRecordDifference = {
  identifier: string; before: StructuredRecordMetadata | null; after: StructuredRecordMetadata | null;
  projections?: Record<CmsProjection, ProjectionDifference>;
}
export type WorkspaceCollectionDifference = Omit<WorkspaceCollectionInspection, 'count' | 'identifiers' | 'omittedIdentifiers'> & {
  beforeCount: number; afterCount: number; added: number; removed: number; changed: number; unchanged: number;
  identifiers: Record<ChangeKind, string[]>; omittedIdentifiers: Record<ChangeKind, number>;
  recordDetails?: Record<ChangeKind, WorkspaceRecordDifference[]>;
}
export type WorkspaceModuleDifference = { module: DemoModule; added: number; removed: number; changed: number; unchanged: number; hasChanges: boolean; collections: WorkspaceCollectionDifference[] }
export type WorkspaceDifferenceReport = { schemaVersion: 1; modules: WorkspaceModuleDifference[] }
type JsonRecord = Record<string, unknown>
type Entity = { parts: string[]; value: unknown }
type RecordAnnotation = { metadata: StructuredRecordMetadata; projections?: Record<CmsProjection, string | null> }
type IndexedEntry = { identifier: string; fingerprint: string; annotation?: RecordAnnotation }
type IndexedCollection = { key: string; label: string; kind: InspectionKind; identityRule: string; entries: Map<string, IndexedEntry> }
const order: readonly DemoModule[] = ['hr', 'cms', 'crm']
const forbidden = new Set(['__proto__', 'constructor', 'prototype'])
const failure = (reason: string): never => { throw new Error(`Workspace inspection unavailable: ${reason}. No records were changed.`) }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function object(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return failure('expected a plain record')
  return value as JsonRecord
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : failure('expected a collection') }
function token(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value) || forbidden.has(value)) return failure('invalid bounded record identifier')
  return value
}
const id = (value: unknown, field = 'id') => token(object(value)[field])
const encode = (parts: string[]) => JSON.stringify(parts)
const by = (rows: unknown[], identity: (value: unknown) => string[]) => [...rows].sort((left, right) => compare(encode(identity(left)), encode(identity(right))))
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort(compare).map(key => [key, stable((value as JsonRecord)[key])])) : value
const fingerprint = (value: unknown) => JSON.stringify(stable(value))

function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return failure('invalid content revision metadata')
  return value
}
function savedCounter(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return failure('invalid saved sequence metadata')
  return value
}
function stateChoice(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) return failure('invalid workflow state metadata')
  return value
}
const optionalId = (record: JsonRecord, key: string) => Object.hasOwn(record, key) ? token(record[key]) : null
const nullableId = (value: unknown) => value === null ? null : token(value)
const nullableDate = (value: unknown) => value === null ? null : tokenDate(value)
const hrRoles = ['employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor']
const ownershipGroups = ['companies', 'contacts', 'leads', 'opportunities', 'tasks'] as const
function actorMetadata(value: unknown): StructuredRecordMetadata {
  const actor = object(value)
  return { actorRole: stateChoice(actor.role, hrRoles), actorEmployeeId: optionalId(actor, 'employeeId'), actorContractorId: optionalId(actor, 'contractorId') }
}
function recruitingInstantMetadata(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return failure('invalid recruiting UTC instant metadata')
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : failure('invalid recruiting UTC instant metadata')
}
const nullableRecruitingInstant = (value: unknown) => value === null ? null : recruitingInstantMetadata(value)
function recruitingActorMetadata(value: unknown): StructuredRecordMetadata {
  const actor = object(value)
  if (actor.mode === 'native') return { actorMode: 'native', ...actorMetadata(actor.actor) }
  if (actor.mode === 'interviewer') return { actorMode: 'interviewer', actorRole: null, actorEmployeeId: token(actor.employeeId), actorContractorId: null }
  return failure('invalid recruiting actor metadata')
}
function recruitingZoneMetadata(value: unknown): string {
  if (typeof value !== 'string' || value.length > 80 || value !== 'UTC' && !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value) || /^Etc\/GMT[+-]/.test(value)) return failure('invalid recruiting named zone metadata')
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0); return value } catch { return failure('invalid recruiting named zone metadata') }
}
function recruitingNumberMetadata(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return failure('invalid recruiting numeric metadata')
  return value
}
function publicationMetadata(value: unknown): StructuredRecordMetadata {
  const publication = value === null ? null : object(value)
  return { publicationRevision: publication ? revision(publication.revision) : null, publicationReceiptId: publication ? token(publication.receipt) : null }
}

/** Only allowlisted structured metadata leaves the comparison index. Complete
 * hidden payload fingerprints still determine the existing change categories. */
function annotateRecord(module: DemoModule, key: string, value: unknown): RecordAnnotation | undefined {
  if (module === 'hr' && key.startsWith('recruiting.lifecycle.')) {
    const entry = object(value)
    if (key === 'recruiting.lifecycle.people') return { metadata: { provenanceKind: stateChoice(object(entry.provenance).kind, ['legacy', 'created']) } }
    if (key === 'recruiting.lifecycle.applications') return { metadata: {
      personId: token(entry.personId), jobId: token(entry.jobId), applicationStage: stateChoice(entry.stage, ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']),
      stageEnteredAt: nullableRecruitingInstant(entry.stageEnteredAt), lastStageRecordedAt: nullableRecruitingInstant(entry.lastStageRecordedAt), hireBindingId: nullableId(entry.hireBindingId),
    } }
    if (key === 'recruiting.lifecycle.requisitions') return { metadata: {
      revision: recruitingNumberMetadata(entry.revision, 1, 1000), requisitionState: stateChoice(entry.state, ['draft', 'in-review', 'approved', 'rejected']),
      ownerEmployeeId: token(object(entry.content).ownerEmployeeId), headcount: recruitingNumberMetadata(object(entry.content).headcount, 1, 50), currentApprovalId: nullableId(entry.currentApprovalId),
    } }
    if (key === 'recruiting.lifecycle.approvals') return { metadata: {
      requisitionId: token(entry.requisitionId), revision: recruitingNumberMetadata(entry.revision, 1, 1000), eventId: token(entry.eventId), recordedAt: recruitingInstantMetadata(entry.recordedAt), ...recruitingActorMetadata(entry.actor),
    } }
    if (key === 'recruiting.lifecycle.jobs') return { metadata: {
      revision: recruitingNumberMetadata(entry.revision, 1, 1000), jobState: stateChoice(entry.state, ['draft', 'published', 'closed']), managerEmployeeId: token(entry.managerEmployeeId),
      requisitionId: nullableId(entry.requisitionId), currentPublicationId: nullableId(entry.currentPublicationId),
    } }
    if (key === 'recruiting.lifecycle.publications') return { metadata: {
      jobId: token(entry.jobId), jobRevision: recruitingNumberMetadata(entry.jobRevision, 1, 1000), requisitionApprovalId: token(entry.requisitionApprovalId), eventId: token(entry.eventId), recordedAt: recruitingInstantMetadata(entry.recordedAt),
    } }
    if (key === 'recruiting.lifecycle.interviews') {
      const participants = array(entry.participantEmployeeIds).map(token)
      if (!participants.length || participants.length > 5 || new Set(participants).size !== participants.length) return failure('invalid recruiting participant metadata')
      return { metadata: { applicationId: token(entry.applicationId), participantEmployeeIds: participants.sort(compare).join(' / '), participantCount: participants.length,
        startAt: recruitingInstantMetadata(entry.startAt), timeZone: recruitingZoneMetadata(entry.timeZone), durationMinutes: recruitingNumberMetadata(entry.durationMinutes, 15, 240), createdEventId: token(entry.createdEventId),
      } }
    }
    if (key === 'recruiting.lifecycle.scorecards') return { metadata: {
      interviewId: token(entry.interviewId), applicationId: token(entry.applicationId), authorEmployeeId: token(entry.authorEmployeeId), revision: recruitingNumberMetadata(entry.revision, 1, 1000),
      scorecardState: stateChoice(entry.state, ['draft', 'submitted']), rubricVersion: stateChoice(object(entry.content).rubricVersion, ['sample-interview-v1']),
      latestDraftEventId: token(entry.latestDraftEventId), lastOwnRecordedAt: recruitingInstantMetadata(entry.lastOwnRecordedAt), submittedEventId: nullableId(entry.submittedEventId),
    } }
    if (key === 'recruiting.lifecycle.hireBindings') {
      const employment = entry.employmentAtHire === null ? null : object(entry.employmentAtHire)
      const legacy = entry.legacyEmploymentLinks === null ? null : object(entry.legacyEmploymentLinks)
      return { metadata: { personId: token(entry.personId), applicationId: token(entry.applicationId), employeeId: token(entry.employeeId),
        provenanceKind: stateChoice(object(entry.provenance).kind, ['legacy', 'created']), checklistVersion: nullableId(object(entry.checklist).version),
        employmentAtHireKind: employment ? stateChoice(employment.kind, ['absent', 'created']) : null,
        employmentInstanceId: employment?.kind === 'created' ? token(employment.instanceId) : null, employmentHireEventId: employment?.kind === 'created' ? token(employment.hireEventId) : null,
        legacyEmploymentInstanceId: legacy ? nullableId(legacy.instanceId) : null, legacyEmploymentHireEventId: legacy ? nullableId(legacy.hireEventId) : null,
      } }
    }
    if (key === 'recruiting.lifecycle.events') {
      const metadata: StructuredRecordMetadata = { sequence: revision(entry.sequence), eventKind: stateChoice(entry.kind, ['adopt', 'person-created', 'application-created', 'application-stage', 'requisition-changed', 'requisition-reviewed', 'job-changed', 'job-published', 'interview-scheduled', 'scorecard-saved', 'scorecard-submitted', 'hired']), recordedAt: recruitingInstantMetadata(entry.recordedAt), ...recruitingActorMetadata(entry.actor) }
      for (const field of ['applicationId', 'requisitionId', 'jobId', 'interviewId', 'scorecardId', 'authorEmployeeId', 'draftEventId']) if (Object.hasOwn(entry, field)) metadata[field] = token(entry[field])
      for (const [field, label] of [['person', 'personId'], ['interview', 'interviewId'], ['scorecard', 'scorecardId'], ['hire', 'hireBindingId']]) if (Object.hasOwn(entry, field)) metadata[label] = id(entry[field])
      return { metadata }
    }
    if (key === 'recruiting.lifecycle.metadata') {
      const adoption = object(entry.adoption)
      return { metadata: { schemaVersion: revision(entry.schemaVersion), sequence: revision(entry.sequence), adoptionEventId: token(adoption.eventId), recordedAt: recruitingInstantMetadata(adoption.recordedAt),
        legacySequence: savedCounter(adoption.legacySequence), legacyJobCount: array(adoption.legacyJobs).length, legacyCandidateCount: array(adoption.legacyCandidates).length,
        legacyHireCount: array(adoption.legacyHiredEmployees).length, legacyHireLinkCount: array(adoption.legacyHireLinks).length, ...recruitingActorMetadata(adoption.actor),
      } }
    }
    return undefined
  }
  if (module === 'hr' && ['workflow.lifecycle.instances', 'workflow.lifecycle.instances.initial', 'workflow.lifecycle.instances.current', 'workflow.lifecycle.events', 'workflow.lifecycle.directoryHistory', 'workflow.lifecycle.corrections', 'workflow.lifecycle.corrections.outcome', 'workflow.lifecycle.offboardingAssignments', 'operations.records.tasks'].includes(key)) {
    const entry = object(value)
    if (key === 'workflow.lifecycle.instances') return { metadata: {
      employeeId: token(entry.employeeId), previousInstanceId: optionalId(entry, 'previousInstanceId'),
      startDate: nullableDate(entry.startDate), endDate: nullableDate(entry.endDate),
      templateVersion: token(entry.templateVersion), taskCount: array(entry.tasks).length,
    } }
    if (['workflow.lifecycle.instances.initial', 'workflow.lifecycle.instances.current'].includes(key)) return { metadata: {
      employmentStatus: stateChoice(entry.status, ['active', 'onboarding', 'on-leave', 'terminated']), managerId: nullableId(entry.managerId),
    } }
    if (key === 'workflow.lifecycle.events') return { metadata: {
      sequence: revision(entry.sequence), eventKind: stateChoice(entry.kind, ['transfer', 'leave', 'return', 'terminate', 'rehire', 'onboarding-complete', 'select-template', 'hire', 'set-simulation-date']),
      employeeId: optionalId(entry, 'employeeId'), instanceId: optionalId(entry, 'instanceId'), effectiveDate: nullableDate(entry.effectiveDate), ...actorMetadata(entry.actor),
    } }
    if (key === 'workflow.lifecycle.directoryHistory') return { metadata: {
      sequence: revision(entry.sequence), employeeId: token(entry.employeeId), field: stateChoice(entry.field, ['workEmail']),
      origin: stateChoice(entry.origin, ['direct', 'correction']), correctionId: optionalId(entry, 'correctionId'), ...actorMetadata(entry.actor),
    } }
    if (key === 'workflow.lifecycle.corrections') return { metadata: {
      sequence: revision(entry.sequence), employeeId: token(entry.employeeId), instanceId: token(entry.instanceId),
      field: stateChoice(entry.field, ['workEmail']), correctionStatus: stateChoice(entry.status, ['pending', 'accepted', 'rejected']), ...actorMetadata(entry.actor),
    } }
    if (key === 'workflow.lifecycle.corrections.outcome') return { metadata: { sequence: revision(entry.sequence), ...actorMetadata(entry.actor) } }
    if (key === 'workflow.lifecycle.offboardingAssignments') return { metadata: {
      employeeId: token(entry.employeeId), instanceId: token(entry.instanceId), transitionId: token(entry.transitionId),
      assignmentKind: stateChoice(entry.kind, ['asset', 'access', 'handover']), assignmentStatus: stateChoice(entry.status, ['assigned']),
    } }
    if (key === 'operations.records.tasks' && Object.hasOwn(entry, 'lifecycleTransitionId')) return { metadata: {
      employeeId: token(entry.employeeId), employmentInstanceId: token(entry.employmentInstanceId), sourceId: token(entry.sourceId),
      lifecycleTransitionId: token(entry.lifecycleTransitionId), offboardingKind: stateChoice(entry.offboardingKind, ['asset', 'access', 'handover']),
      assignmentStatus: stateChoice(entry.status, ['pending', 'completed']),
    } }
    return undefined
  }
  if (module === 'cms' && key === 'entries') {
    const entry = object(value)
    const approval = entry.approval === null ? null : object(entry.approval)
    const published = entry.published === null ? null : object(entry.published)
    const draft = Object.fromEntries(Object.entries(entry).filter(([field]) => !['approval', 'published'].includes(field)))
    return {
      metadata: {
        collectionId: token(entry.collectionId), draftRevision: revision(entry.revision),
        workflowStatus: stateChoice(entry.status, ['draft', 'in-review', 'approved', 'published', 'retired']),
        approvalRevision: approval ? revision(approval.revision) : null,
        approvalReviewerId: approval ? token(approval.reviewerId) : null,
        approvalReceiptId: approval ? token(approval.receipt) : null,
        publicationRevision: published ? revision(published.revision) : null,
        publicationReceiptId: published ? token(published.receipt) : null,
      },
      projections: { draft: fingerprint(draft), approval: approval ? fingerprint(approval) : null, publication: published ? fingerprint(published) : null },
    }
  }
  if (module === 'cms' && key === 'releaseBundles') {
    const bundle = object(value)
    return { metadata: {
      workflowStatus: stateChoice(bundle.status, ['draft', 'activated']), createdBy: token(bundle.createdBy),
      preparedAtSequence: savedCounter(bundle.preparedAtSequence), activatedAtSequence: bundle.activatedAtSequence === null ? null : revision(bundle.activatedAtSequence),
      memberCount: array(bundle.members).length, activatedPublicationCount: bundle.activatedPublications === null ? 0 : array(bundle.activatedPublications).length,
    } }
  }
  if (module === 'cms' && key === 'releaseBundles.members') {
    const member = object(value); const approval = object(member.approval)
    return { metadata: {
      entryId: token(member.entryId), collectionId: token(member.collectionId), authorId: token(member.authorId), draftRevision: revision(member.revision),
      approvalRevision: revision(approval.revision), approvalReviewerId: token(approval.reviewerId), approvalReceiptId: token(approval.receipt),
      ...publicationMetadata(member.previousPublication),
    } }
  }
  if (module === 'cms' && key === 'releaseBundles.members.approval') {
    const approval = object(value)
    return { metadata: { approvalRevision: revision(approval.revision), approvalReviewerId: token(approval.reviewerId), approvalReceiptId: token(approval.receipt) } }
  }
  if (module === 'cms' && key === 'releaseBundles.members.previousPublication') return { metadata: publicationMetadata(value) }
  if (module === 'cms' && key === 'releaseBundles.activatedPublications') return { metadata: { entryId: token(object(value).entryId), ...publicationMetadata(object(value).publication) } }
  if (module === 'crm' && (key === 'activity.ownershipChange' || key === 'activity' && Object.hasOwn(object(value), 'ownershipChange'))) {
    const change = object(key === 'activity' ? object(value).ownershipChange : value); const affected = object(change.affected)
    return { metadata: {
      actorId: token(change.actorId), fromOwnerId: token(change.fromOwnerId), toOwnerId: token(change.toOwnerId), recordId: token(change.recordId),
      affectedCompanies: array(affected.companies).length, affectedContacts: array(affected.contacts).length, affectedLeads: array(affected.leads).length,
      affectedOpportunities: array(affected.opportunities).length, affectedTasks: array(affected.tasks).length,
    } }
  }
  if (module !== 'crm' || !['companies', 'contacts', 'leads', 'opportunities'].includes(key)) return undefined
  const entry = object(value)
  const metadata: StructuredRecordMetadata = { ownerId: token(entry.ownerId) }
  if (key === 'contacts') metadata.companyId = token(entry.companyId)
  if (key === 'leads') Object.assign(metadata, {
    leadState: stateChoice(entry.status, ['new', 'qualified', 'converted']),
    companyId: optionalId(entry, 'companyId'), contactId: optionalId(entry, 'contactId'), opportunityId: optionalId(entry, 'opportunityId'),
  })
  if (key === 'opportunities') Object.assign(metadata, {
    opportunityStage: stateChoice(entry.stage, ['discovery', 'proposal', 'negotiation', 'won', 'lost']),
    companyId: token(entry.companyId), contactId: token(entry.contactId), leadId: optionalId(entry, 'leadId'),
  })
  return { metadata }
}

function recordDifference(before: IndexedEntry | undefined, after: IndexedEntry | undefined): WorkspaceRecordDifference {
  const annotations = { before: before?.annotation, after: after?.annotation }
  const projections = annotations.before?.projections || annotations.after?.projections
    ? Object.fromEntries((['draft', 'approval', 'publication'] as const).map(key => {
      const left = annotations.before?.projections?.[key] ?? null
      const right = annotations.after?.projections?.[key] ?? null
      const change: ProjectionDifference = left === null && right === null ? 'absent' : left === null ? 'added' : right === null ? 'removed' : left === right ? 'unchanged' : 'changed'
      return [key, change]
    })) as Record<CmsProjection, ProjectionDifference> : undefined
  // A legacy record can share a collection with newer annotated records. An
  // empty allowlisted metadata object means present without such metadata;
  // null continues to mean that the entire record is absent on that side.
  return { identifier: (after ?? before)!.identifier, before: before ? annotations.before?.metadata ?? {} : null, after: after ? annotations.after?.metadata ?? {} : null, ...(projections ? { projections } : {}) }
}

/** Inspect only JSON data properties. Accessors/cycles/unsupported values are
 * refused before collection extraction, without invoking getters or toJSON. */
function validateJson(value: unknown) {
  let nodes = 0; let characters = 0
  const ancestors = new Set<object>()
  function visit(entry: unknown, depth: number) {
    if (++nodes > workspaceInspectionLimits.nodes || depth > workspaceInspectionLimits.depth) return failure('input traversal limit exceeded')
    if (entry === null || typeof entry === 'boolean') return
    if (typeof entry === 'string') { characters += entry.length; if (characters > workspaceInspectionLimits.characters) return failure('input character limit exceeded'); return }
    if (typeof entry === 'number') { if (!Number.isFinite(entry)) return failure('non-finite value'); return }
    if (!entry || typeof entry !== 'object' || ancestors.has(entry)) return failure('non-JSON or circular data')
    if (!Array.isArray(entry)) object(entry)
    ancestors.add(entry)
    const keys = Reflect.ownKeys(entry)
    if (Array.isArray(entry) && (entry.length > workspaceInspectionLimits.entities || keys.length !== entry.length + 1)) return failure('sparse, extended or oversized collection')
    for (const key of keys) {
      if (Array.isArray(entry) && key === 'length') continue
      if (typeof key !== 'string' || forbidden.has(key)) return failure('unsupported record property')
      const descriptor = Object.getOwnPropertyDescriptor(entry, key)
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return failure('accessor or hidden property')
      characters += key.length
      if (characters > workspaceInspectionLimits.characters) return failure('input character limit exceeded')
      visit(descriptor.value, depth + 1)
    }
    ancestors.delete(entry)
  }
  visit(value, 0)
}

function modulesFor(value: readonly DemoModule[]): DemoModule[] {
  if (!Array.isArray(value) || value.length > order.length || value.some(module => !order.includes(module)) || new Set(value).size !== value.length) return failure('invalid or duplicate selected modules')
  return order.filter(module => value.includes(module))
}
function limitFor(options: InspectionOptions): number {
  const limit = options.identifierLimit ?? workspaceInspectionLimits.identifierLimit
  if (!Number.isInteger(limit) || limit < 1 || limit > workspaceInspectionLimits.maximumIdentifierLimit) return failure('identifier display limit must be between 1 and 20')
  return limit
}

function inventory(states: Partial<DemoWorkspaces>, modules: DemoModule[]): Map<DemoModule, IndexedCollection[]> {
  const source = object(states); const result = new Map<DemoModule, IndexedCollection[]>()
  let total = 0
  for (const module of modules) {
    const descriptor = Object.getOwnPropertyDescriptor(source, module)
    if (!descriptor || !('value' in descriptor)) return failure('selected module is absent or not data')
    const state = object(descriptor.value)
    validateJson(state)
    const collections: IndexedCollection[] = []
    function add(key: string, label: string, kind: InspectionKind, identityRule: string, rows: Entity[]) {
      total += rows.length
      if (total > workspaceInspectionLimits.entities) return failure('entity inspection limit exceeded')
      const entries = new Map<string, IndexedEntry>()
      for (const row of rows) {
        const parts = row.parts.map(token); const identity = encode(parts)
        if (!parts.length || parts.length > 3) return failure('invalid composite identifier')
        if (entries.has(identity)) return failure(`duplicate identity in ${key}`)
        const annotation = annotateRecord(module, key, row.value)
        entries.set(identity, { identifier: parts.join(' / '), fingerprint: fingerprint(row.value), ...(annotation ? { annotation } : {}) })
      }
      collections.push({ key, label, kind, identityRule, entries: new Map([...entries].sort(([a], [b]) => compare(a, b))) })
    }
    const records = (value: unknown): JsonRecord[] => array(value).map(object)
    const mapped = (value: unknown): Entity[] => Object.entries(object(value)).map(([key, entry]) => ({ parts: [token(key)], value: entry }))
    function primary(key: string, label: string, value: unknown, normalize?: (record: JsonRecord) => unknown, field = 'id') {
      add(key, label, 'primary', `One record per ${field}`, records(value).map(record => ({ parts: [id(record, field)], value: normalize ? normalize(record) : record })))
    }
    function nestedActivity(key: string, label: string, parents: JsonRecord[]) {
      add(key, label, 'nested', 'Parent ID + activity receipt', parents.flatMap(parent => records(parent.activity).map(entry => ({ parts: [id(parent), id(entry, 'receipt')], value: entry }))))
    }
    const normalizeActivity = (record: JsonRecord) => ({ ...record, activity: by(array(record.activity), entry => [id(entry, 'receipt')]) })
    function sequences(fields: [string, unknown][]) {
      for (const [, value] of fields) if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return failure('invalid saved sequence metadata')
      add('metadata.sequences', 'Saved sequence counters (metadata)', 'metadata', 'One value per counter; excluded from entity totals', fields.map(([key, value]) => ({ parts: [key], value })))
    }

    if (module === 'hr') {
      const workflow = object(state.workflow); const operations = object(state.operations); const desk = object(state.serviceDesk)
      const recruiting = object(state.recruiting); const performance = object(state.performance); const surveys = object(state.surveys)
      const onboarding = object(workflow.onboarding)
      add('workflow.onboarding', 'Onboarding records', 'primary', 'One record per employee map key', mapped(onboarding))
      add('workflow.onboarding.tasks', 'Onboarding checklist items', 'nested', 'Employee map key + task map key', Object.entries(onboarding).flatMap(([employee, entry]) => Object.entries(object(object(entry).tasks)).map(([task, complete]) => {
        if (typeof complete !== 'boolean') return failure('invalid onboarding checklist value')
        return { parts: [employee, task], value: complete }
      })))
      add('workflow.profileEmails', 'Saved profile email records', 'primary', 'One record per employee map key; values hidden', mapped(workflow.profileEmails))
      add('workflow.employeeStatuses', 'Employment status records', 'primary', 'One record per employee map key', mapped(workflow.employeeStatuses))
      primary('workflow.timeEntries', 'Time entries', workflow.timeEntries)
      add('workflow.benefitElections', 'Benefit elections', 'primary', 'Employee ID + plan ID', records(workflow.benefitElections).map(entry => ({ parts: [id(entry, 'employeeId'), id(entry, 'planId')], value: entry })))
      const normalizePayroll = (record: JsonRecord) => ({ ...record,
        inputs: by(array(record.inputs), entry => [id(entry, 'entryId')]),
        benefitInputs: by(array(record.benefitInputs), entry => [id(entry, 'employeeId'), id(entry, 'planId')]),
        employeeTotals: by(array(record.employeeTotals), entry => [id(entry, 'employeeId')]),
      })
      const payroll = object(workflow.payroll); const history = records(workflow.payrollHistory)
      add('workflow.payroll', 'Current payroll snapshot', 'primary', 'One current snapshot, including idle state', [{ parts: ['current'], value: normalizePayroll(payroll) }])
      primary('workflow.payrollHistory', 'Submitted payroll receipts', history, normalizePayroll, 'receipt')
      for (const [key, label, parents] of [
        ['workflow.payroll', 'Current payroll', [{ parts: ['current'], value: payroll }]],
        ['workflow.payrollHistory', 'Payroll history', history.map(entry => ({ parts: [id(entry, 'receipt')], value: entry }))],
      ] as [string, string, { parts: string[]; value: JsonRecord }[]][]) {
        add(`${key}.inputs`, `${label} time inputs`, 'nested', 'Snapshot ID + time entry ID', parents.flatMap(parent => records(parent.value.inputs).map(entry => ({ parts: [...parent.parts, id(entry, 'entryId')], value: entry }))))
        add(`${key}.benefitInputs`, `${label} benefit inputs`, 'nested', 'Snapshot ID + employee ID + plan ID', parents.flatMap(parent => records(parent.value.benefitInputs).map(entry => ({ parts: [...parent.parts, id(entry, 'employeeId'), id(entry, 'planId')], value: entry }))))
        add(`${key}.employeeTotals`, `${label} employee totals`, 'nested', 'Snapshot ID + employee ID', parents.flatMap(parent => records(parent.value.employeeTotals).map(entry => ({ parts: [...parent.parts, id(entry, 'employeeId')], value: entry }))))
      }
      const rates = workflow.sampleRates === undefined ? {} : object(workflow.sampleRates)
      add('workflow.sampleRateTimelines', 'Configured sample rate timelines', 'nested', 'One timeline per employee map key; absent map counts zero', Object.entries(rates).map(([employee, timeline]) => ({ parts: [employee], value: by(array(timeline), entry => [tokenDate(object(entry).effectiveFrom)]) })))
      add('workflow.sampleRates', 'Effective-dated sample rate entries', 'primary', 'Employee map key + effective date; no inherited fixture rates', Object.entries(rates).flatMap(([employee, timeline]) => records(timeline).map(entry => ({ parts: [employee, tokenDate(entry.effectiveFrom)], value: entry }))))
      primary('operations.ptoRequests', 'Leave requests', operations.ptoRequests)
      add('operations.balances', 'Leave balance records', 'primary', 'One balance object per employee map key', mapped(operations.balances))
      const assignments = object(operations.records)
      for (const [key, label] of [['tasks', 'Assigned tasks'], ['policies', 'Policy assignments'], ['training', 'Training assignments'], ['assets', 'Asset assignments'], ['documents', 'Document records']]) primary(`operations.records.${key}`, label, assignments[key])
      primary('operations.activity', 'People-operation activity', operations.activity)
      const requests = records(desk.requests)
      primary('serviceDesk.requests', 'Service requests', requests, normalizeActivity); nestedActivity('serviceDesk.requests.activity', 'Service-request activity', requests)
      const jobs = records(recruiting.jobs); const candidates = records(recruiting.candidates); const hires = records(recruiting.hiredEmployees)
      primary('recruiting.jobs', 'Recruiting jobs', jobs, normalizeActivity); nestedActivity('recruiting.jobs.activity', 'Recruiting job activity', jobs)
      primary('recruiting.candidates', 'Recruiting candidates', candidates, normalizeActivity); nestedActivity('recruiting.candidates.activity', 'Candidate activity', candidates)
      primary('recruiting.hiredEmployees', 'Captured hired employees', hires, entry => ({ ...entry, onboarding: by(array(entry.onboarding), task => [id(task)]) }))
      add('recruiting.hiredEmployees.onboarding', 'Hired employee onboarding items', 'nested', 'Hired employee ID + task ID', hires.flatMap(employee => records(employee.onboarding).map(task => ({ parts: [id(employee), id(task)], value: task }))))
      if (Object.hasOwn(recruiting, 'lifecycle')) {
        const lifecycle = object(recruiting.lifecycle)
        const recruitingCollections = [
          ['people', 'Recruiting people'], ['applications', 'Recruiting applications'], ['requisitions', 'Recruiting requisitions'], ['approvals', 'Captured requisition approvals'],
          ['jobs', 'Authoritative recruiting jobs'], ['publications', 'Captured job publications'], ['interviews', 'Recruiting interviews'], ['scorecards', 'Recruiting scorecards'],
          ['hireBindings', 'Recruiting hire bindings'], ['events', 'Recruiting lifecycle events'],
        ] as const
        const required = ['schemaVersion', 'sequence', 'adoption', ...recruitingCollections.map(([key]) => key)]
        if (lifecycle.schemaVersion !== 1 || required.some(key => !Object.hasOwn(lifecycle, key)) || Object.keys(lifecycle).some(key => !required.includes(key))) return failure('unsupported recruiting lifecycle snapshot')
        const normalizeEmployee = (employee: JsonRecord) => ({ ...employee, onboarding: by(array(employee.onboarding), task => [id(task)]) })
        const normalizeAdoption = (capture: JsonRecord) => ({ ...capture,
          legacyJobs: by(records(capture.legacyJobs).map(normalizeActivity), job => [id(job)]),
          legacyCandidates: by(records(capture.legacyCandidates).map(normalizeActivity), candidate => [id(candidate)]),
          legacyHiredEmployees: by(records(capture.legacyHiredEmployees).map(normalizeEmployee), employee => [id(employee)]),
          legacyHireLinks: by(array(capture.legacyHireLinks), link => [id(link, 'employeeId')]),
        })
        const normalizeInterview = (interview: JsonRecord) => ({ ...interview, participantEmployeeIds: by(array(interview.participantEmployeeIds), employee => [token(employee)]) })
        const normalizeHire = (hire: JsonRecord) => ({ ...hire, employeeSnapshot: normalizeEmployee(object(hire.employeeSnapshot)), checklist: { ...object(hire.checklist), tasks: by(array(object(hire.checklist).tasks), task => [id(task)]) } })
        const normalizeEvent = (event: JsonRecord) => ({ ...event,
          ...(Object.hasOwn(event, 'adoption') ? { adoption: normalizeAdoption(object(event.adoption)) } : {}),
          ...(Object.hasOwn(event, 'interview') ? { interview: normalizeInterview(object(event.interview)) } : {}),
          ...(Object.hasOwn(event, 'hire') ? { hire: normalizeHire(object(event.hire)) } : {}),
        })
        for (const [key, label] of recruitingCollections) primary(`recruiting.lifecycle.${key}`, label, lifecycle[key], key === 'interviews' ? normalizeInterview : key === 'hireBindings' ? normalizeHire : key === 'events' ? normalizeEvent : undefined)
        // Captured arrays and event bodies are contained provenance, not a second
        // inventory of people/jobs/hires. Their complete hidden content remains
        // in these fingerprints, with identified nested order normalized.
        add('recruiting.lifecycle.metadata', 'Recruiting lifecycle adoption metadata', 'metadata', 'One present optional extension; nested adoption captures are not additional primary records', [{ parts: ['extension'], value: { schemaVersion: lifecycle.schemaVersion, sequence: lifecycle.sequence, adoption: normalizeAdoption(object(lifecycle.adoption)) } }])
      }
      const goals = records(performance.goals); const reviews = records(performance.reviews)
      primary('performance.goals', 'Performance goals', goals, normalizeActivity); nestedActivity('performance.goals.activity', 'Goal activity', goals)
      primary('performance.reviews', 'Performance reviews', reviews, normalizeActivity); nestedActivity('performance.reviews.activity', 'Review activity', reviews)
      const surveyRecords = records(surveys.surveys)
      primary('surveys.surveys', 'Surveys', surveyRecords, entry => ({ ...normalizeActivity(entry), audienceIds: by(array(entry.audienceIds), employee => [token(employee)]), responses: by(array(entry.responses), response => [id(response, 'employeeId')]) }))
      add('surveys.surveys.audienceIds', 'Survey audience assignments', 'nested', 'Survey ID + employee ID', surveyRecords.flatMap(survey => array(survey.audienceIds).map(employee => ({ parts: [id(survey), token(employee)], value: employee }))))
      add('surveys.surveys.questions', 'Survey question sets', 'nested', 'One question object per survey ID', surveyRecords.map(survey => ({ parts: [id(survey)], value: object(survey.questions) })))
      add('surveys.surveys.responses', 'Survey responses', 'nested', 'Survey ID + employee ID', surveyRecords.flatMap(survey => records(survey.responses).map(response => ({ parts: [id(survey), id(response, 'employeeId')], value: response }))))
      nestedActivity('surveys.surveys.activity', 'Survey activity', surveyRecords)
      for (const [key, label] of [['completed', 'Saved preview checklist flags'], ['acknowledgements', 'Saved preview acknowledgement flags']]) add(`preview.${key}`, label, 'metadata', 'One saved preview flag per key; excluded from entity totals', array(state[key]).map(value => {
        if (typeof value !== 'string') return failure('invalid saved preview flag')
        return { parts: value.split(':').map(token), value }
      }))
      add('preview.selections', 'Saved preview selections', 'metadata', 'Two saved selection fields; values hidden and excluded from entity totals', ['managementRole', 'selectedEmployee'].map(key => {
        if (typeof state[key] !== 'string') return failure('invalid saved preview selection')
        return { parts: [key], value: state[key] }
      }))
      sequences([['workflow', workflow.sequence], ['operations', operations.sequence], ['serviceDesk', desk.sequence], ['recruiting', recruiting.sequence], ['performance', performance.sequence], ['surveys', surveys.sequence]])
      // Optional durable extensions are inspected only when actually captured.
      // Reading legacy saves never projects fixture defaults into the report.
      if (Object.hasOwn(workflow, 'lifecycle')) {
        const lifecycle = object(workflow.lifecycle); const instances = records(lifecycle.instances)
        if (lifecycle.schemaVersion !== 1) return failure('unsupported lifecycle schema')
        primary('workflow.lifecycle.instances', 'Employment instances', instances, instance => ({ ...instance, tasks: by(array(instance.tasks), task => [id(task)]) }))
        for (const field of ['initial', 'current']) add(`workflow.lifecycle.instances.${field}`, `${field === 'initial' ? 'Initial' : 'Current'} employment snapshots`, 'nested', 'One captured snapshot per employment instance ID', instances.map(instance => ({ parts: [id(instance)], value: object(instance[field]) })))
        add('workflow.lifecycle.instances.tasks', 'Captured onboarding template tasks', 'nested', 'Employment instance ID + task ID; captured template items, not fixture defaults', instances.flatMap(instance => records(instance.tasks).map(task => ({ parts: [id(instance), id(task)], value: task }))))
        const archived = instances.filter(instance => Object.hasOwn(instance, 'archivedOnboarding'))
        add('workflow.lifecycle.instances.archivedOnboarding', 'Archived onboarding snapshots', 'nested', 'One present archived onboarding snapshot per superseded instance ID', archived.map(instance => ({ parts: [id(instance)], value: object(instance.archivedOnboarding) })))
        add('workflow.lifecycle.instances.archivedOnboarding.tasks', 'Archived onboarding checklist flags', 'nested', 'Employment instance ID + archived checklist map key', archived.flatMap(instance => Object.entries(object(object(instance.archivedOnboarding).tasks)).map(([task, complete]) => {
          if (typeof complete !== 'boolean') return failure('invalid archived onboarding checklist value')
          return { parts: [id(instance), task], value: complete }
        })))
        add('workflow.lifecycle.activeInstances', 'Active employment instance links', 'nested', 'Employee map key; value is an instance ID reference, excluded from primary totals', Object.entries(object(lifecycle.activeInstances)).map(([employee, instance]) => ({ parts: [employee], value: token(instance) })))
        const events = records(lifecycle.events)
        primary('workflow.lifecycle.events', 'Employment lifecycle events', events)
        for (const field of ['previous', 'proposed']) add(`workflow.lifecycle.events.${field}`, `${field === 'previous' ? 'Previous' : 'Proposed'} lifecycle transition values`, 'nested', 'One present captured transition value per event ID; null counts zero', events.filter(event => event[field] !== null).map(event => ({ parts: [id(event)], value: event[field] })))
        primary('workflow.lifecycle.directoryHistory', 'Directory change history', lifecycle.directoryHistory)
        const corrections = records(lifecycle.corrections)
        primary('workflow.lifecycle.corrections', 'Directory correction requests', corrections)
        add('workflow.lifecycle.corrections.outcome', 'Directory correction outcomes', 'nested', 'One present outcome per correction request ID; outcome sequence is metadata', corrections.filter(correction => Object.hasOwn(correction, 'outcome')).map(correction => ({ parts: [id(correction)], value: object(correction.outcome) })))
        primary('workflow.lifecycle.offboardingAssignments', 'Captured offboarding assignments', lifecycle.offboardingAssignments)
        add('workflow.lifecycle.metadata', 'Lifecycle saved metadata', 'metadata', 'Schema, simulation date, sequence and selected template; excluded from entity totals', [
          { parts: ['schemaVersion'], value: revision(lifecycle.schemaVersion) }, { parts: ['simulationDate'], value: nullableDate(lifecycle.simulationDate) },
          { parts: ['sequence'], value: revision(lifecycle.sequence) }, { parts: ['selectedTemplateVersion'], value: token(lifecycle.selectedTemplateVersion) },
        ])
      }
      if (Object.hasOwn(state, 'selectedManager')) add('preview.selectedManager', 'Saved manager preview selection', 'metadata', 'One present selected manager field; excluded from entity totals', [{ parts: ['selectedManager'], value: token(state.selectedManager) }])
    } else if (module === 'cms') {
      const entries = records(state.entries)
      primary('entries', 'Content entries', entries)
      primary('activity', 'Editorial activity', state.activity, undefined, 'receipt')
      for (const [field, label] of [['approval', 'Exact-revision approvals'], ['published', 'Frozen published snapshots']]) add(`entries.${field}`, label, 'nested', 'One present snapshot per content entry ID; null counts zero', entries.filter(entry => entry[field] !== null).map(entry => ({ parts: [id(entry)], value: object(entry[field]) })))
      sequences([['sequence', state.sequence]])
      if (Object.hasOwn(state, 'releaseBundles')) {
        const bundles = records(state.releaseBundles)
        primary('releaseBundles', 'Captured release bundles', bundles, bundle => ({ ...bundle, members: by(array(bundle.members), member => [id(member, 'entryId')]), activatedPublications: bundle.activatedPublications === null ? null : by(array(bundle.activatedPublications), publication => [id(publication, 'entryId')]) }))
        const members = bundles.flatMap(bundle => records(bundle.members).map(member => ({ parts: [id(bundle), id(member, 'entryId')], value: member })))
        add('releaseBundles.members', 'Captured release members (approved snapshots)', 'nested', 'Release bundle ID + entry ID; complete approved content remains hidden', members)
        add('releaseBundles.members.approval', 'Captured release approval snapshots', 'nested', 'Release bundle ID + entry ID; one approval per captured member', members.map(member => ({ parts: member.parts, value: object(member.value.approval) })))
        add('releaseBundles.members.previousPublication', 'Release prior publication snapshots', 'nested', 'Release bundle ID + entry ID; null prior publications count zero', members.filter(member => member.value.previousPublication !== null).map(member => ({ parts: member.parts, value: object(member.value.previousPublication) })))
        add('releaseBundles.activatedPublications', 'Release activated publication snapshots', 'nested', 'Release bundle ID + entry ID; publication receipt is metadata, not another record', bundles.flatMap(bundle => bundle.activatedPublications === null ? [] : records(bundle.activatedPublications).map(publication => ({ parts: [id(bundle), id(publication, 'entryId')], value: publication }))))
        add('releaseBundles.metadata', 'Release extension presence', 'metadata', 'One present optional release collection field, including an empty collection; excluded from entity totals', [{ parts: ['present'], value: true }])
      }
    } else {
      for (const [key, label] of [['companies', 'Companies'], ['contacts', 'Contacts'], ['leads', 'Leads'], ['opportunities', 'Opportunities'], ['tasks', 'Follow-up tasks']]) primary(key, label, state[key])
      const normalizeOwnership = (change: JsonRecord) => ({ ...change, affected: { ...object(change.affected), ...Object.fromEntries(ownershipGroups.map(group => [group, by(array(object(change.affected)[group]), entry => [token(entry)])])) } })
      const activities = records(state.activity)
      primary('activity', 'Sales activity', activities, activity => Object.hasOwn(activity, 'ownershipChange') ? { ...activity, ownershipChange: normalizeOwnership(object(activity.ownershipChange)) } : activity, 'receipt')
      sequences([['sequence', state.sequence]])
      const ownership = activities.filter(activity => Object.hasOwn(activity, 'ownershipChange'))
      if (ownership.length) {
        add('activity.ownershipChange', 'Recorded ownership change metadata', 'nested', 'One present ownership snapshot per activity receipt; excluded from primary totals', ownership.map(activity => ({ parts: [id(activity, 'receipt')], value: normalizeOwnership(object(activity.ownershipChange)) })))
        for (const group of ownershipGroups) add(`activity.ownershipChange.affected.${group}`, `Ownership affected ${group} references`, 'nested', 'Activity receipt + affected record ID; ID references, not additional workspace records', ownership.flatMap(activity => array(object(object(activity.ownershipChange).affected)[group]).map(reference => ({ parts: [id(activity, 'receipt'), token(reference)], value: reference }))))
      }
    }
    result.set(module, collections)
  }
  return result
}

function tokenDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return failure('invalid effective-date identifier')
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : failure('invalid effective-date identifier')
}

/** Counts stored record instances, not distinct people or authorization scope.
 * Nested rows describe contained records or collection containers and are not
 * added into primaryRecordCount. Static fixture directories are absent. */
export function inspectWorkspaces(states: Partial<DemoWorkspaces>, selected: readonly DemoModule[], options: InspectionOptions = {}): WorkspaceInspectionReport {
  const modules = modulesFor(selected); const limit = limitFor(options)
  const indexed = inventory(states, modules)
  return { schemaVersion: 1, modules: modules.map(module => {
    const collections = indexed.get(module)!
    return { module, primaryRecordCount: collections.filter(collection => collection.kind === 'primary').reduce((total, collection) => total + collection.entries.size, 0), collections: collections.map(({ entries, ...collection }) => ({ ...collection, count: entries.size, identifiers: [...entries.values()].slice(0, limit).map(entry => entry.identifier), omittedIdentifiers: Math.max(0, entries.size - limit) })) }
  }) }
}

/** Compare complete hidden payloads by stable collection identities. Identified
 * collections ignore storage order. No source payload or fingerprint is returned. */
export function compareWorkspaces(current: Partial<DemoWorkspaces>, target: Partial<DemoWorkspaces>, selected: readonly DemoModule[], options: InspectionOptions = {}): WorkspaceDifferenceReport {
  const modules = modulesFor(selected); const limit = limitFor(options)
  const before = inventory(current, modules); const after = inventory(target, modules)
  return { schemaVersion: 1, modules: modules.map(module => {
    const previousCollections = before.get(module)!; const nextCollections = after.get(module)!
    const previousByKey = new Map(previousCollections.map(collection => [collection.key, collection]))
    const nextByKey = new Map(nextCollections.map(collection => [collection.key, collection]))
    const extension = (key: string) => key.startsWith('workflow.lifecycle.') || key.startsWith('recruiting.lifecycle.') || key === 'preview.selectedManager' || key.startsWith('releaseBundles') || key.startsWith('activity.ownershipChange')
    const keys = [...new Set([...previousByKey.keys(), ...nextByKey.keys()])]
    // Legacy rows retain their established order; optional extension rows have
    // the same order in both comparison directions, even if a field is absent.
    const orderedKeys = [...keys.filter(key => !extension(key)), ...keys.filter(extension).sort(compare)]
    const collections = orderedKeys.map((key): WorkspaceCollectionDifference => {
      const descriptor = nextByKey.get(key) ?? previousByKey.get(key)!
      const left = previousByKey.get(key) ?? { ...descriptor, entries: new Map<string, IndexedEntry>() }
      const right = nextByKey.get(key) ?? { ...descriptor, entries: new Map<string, IndexedEntry>() }
      const ids = { added: [] as string[], removed: [] as string[], changed: [] as string[] }; let unchanged = 0
      const records: Record<ChangeKind, WorkspaceRecordDifference[]> = { added: [], removed: [], changed: [] }
      const hasRecordDetails = module === 'cms' && left.key === 'entries' || module === 'crm' && ['companies', 'contacts', 'leads', 'opportunities'].includes(left.key)
        || [...left.entries.values(), ...right.entries.values()].some(entry => entry.annotation)
      function change(kind: ChangeKind, previous: IndexedEntry | undefined, next: IndexedEntry | undefined) {
        ids[kind].push((next ?? previous)!.identifier)
        if (hasRecordDetails && records[kind].length < limit) records[kind].push(recordDifference(previous, next))
      }
      for (const [key, entry] of right.entries) {
        const previous = left.entries.get(key)
        if (!previous) change('added', undefined, entry)
        else if (previous.fingerprint !== entry.fingerprint) change('changed', previous, entry)
        else unchanged++
      }
      for (const [key, entry] of left.entries) if (!right.entries.has(key)) change('removed', entry, undefined)
      return { key: left.key, label: left.label, kind: left.kind, identityRule: left.identityRule, beforeCount: left.entries.size, afterCount: right.entries.size, added: ids.added.length, removed: ids.removed.length, changed: ids.changed.length, unchanged, identifiers: { added: ids.added.slice(0, limit), removed: ids.removed.slice(0, limit), changed: ids.changed.slice(0, limit) }, omittedIdentifiers: { added: Math.max(0, ids.added.length - limit), removed: Math.max(0, ids.removed.length - limit), changed: Math.max(0, ids.changed.length - limit) }, ...(hasRecordDetails ? { recordDetails: records } : {}) }
    })
    const primary = collections.filter(collection => collection.kind === 'primary')
    return { module, added: primary.reduce((n, row) => n + row.added, 0), removed: primary.reduce((n, row) => n + row.removed, 0), changed: primary.reduce((n, row) => n + row.changed, 0), unchanged: primary.reduce((n, row) => n + row.unchanged, 0), hasChanges: collections.some(row => row.added + row.removed + row.changed > 0), collections }
  }) }
}
