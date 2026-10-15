import type { DemoModule } from './persistence'
import type { DemoWorkspaces } from './workspaces'

export const workspaceInspectionLimits = Object.freeze({ identifierLimit: 8, maximumIdentifierLimit: 20, identifierCharacters: 200, entities: 100_000, nodes: 300_000, characters: 6_100_000, depth: 32 })
export type InspectionKind = 'primary' | 'nested' | 'metadata'
export type InspectionOptions = { identifierLimit?: number }
export type WorkspaceCollectionInspection = { key: string; label: string; kind: InspectionKind; identityRule: string; count: number; identifiers: string[]; omittedIdentifiers: number }
export type WorkspaceModuleInspection = { module: DemoModule; primaryRecordCount: number; collections: WorkspaceCollectionInspection[] }
export type WorkspaceInspectionReport = { schemaVersion: 1; modules: WorkspaceModuleInspection[] }
type ChangeKind = 'added' | 'removed' | 'changed'
export type WorkspaceCollectionDifference = Omit<WorkspaceCollectionInspection, 'count' | 'identifiers' | 'omittedIdentifiers'> & {
  beforeCount: number; afterCount: number; added: number; removed: number; changed: number; unchanged: number;
  identifiers: Record<ChangeKind, string[]>; omittedIdentifiers: Record<ChangeKind, number>;
}
export type WorkspaceModuleDifference = { module: DemoModule; added: number; removed: number; changed: number; unchanged: number; hasChanges: boolean; collections: WorkspaceCollectionDifference[] }
export type WorkspaceDifferenceReport = { schemaVersion: 1; modules: WorkspaceModuleDifference[] }
type JsonRecord = Record<string, unknown>
type Entity = { parts: string[]; value: unknown }
type IndexedCollection = { key: string; label: string; kind: InspectionKind; identityRule: string; entries: Map<string, { identifier: string; fingerprint: string }> }
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
      const entries = new Map<string, { identifier: string; fingerprint: string }>()
      for (const row of rows) {
        const parts = row.parts.map(token); const identity = encode(parts)
        if (!parts.length || parts.length > 3) return failure('invalid composite identifier')
        if (entries.has(identity)) return failure(`duplicate identity in ${key}`)
        entries.set(identity, { identifier: parts.join(' / '), fingerprint: JSON.stringify(stable(row.value)) })
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
    } else if (module === 'cms') {
      const entries = records(state.entries)
      primary('entries', 'Content entries', entries)
      primary('activity', 'Editorial activity', state.activity, undefined, 'receipt')
      for (const [field, label] of [['approval', 'Exact-revision approvals'], ['published', 'Frozen published snapshots']]) add(`entries.${field}`, label, 'nested', 'One present snapshot per content entry ID; null counts zero', entries.filter(entry => entry[field] !== null).map(entry => ({ parts: [id(entry)], value: object(entry[field]) })))
      sequences([['sequence', state.sequence]])
    } else {
      for (const [key, label] of [['companies', 'Companies'], ['contacts', 'Contacts'], ['leads', 'Leads'], ['opportunities', 'Opportunities'], ['tasks', 'Follow-up tasks']]) primary(key, label, state[key])
      primary('activity', 'Sales activity', state.activity, undefined, 'receipt')
      sequences([['sequence', state.sequence]])
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
    const collections = before.get(module)!.map((left, index): WorkspaceCollectionDifference => {
      const right = after.get(module)![index]
      const ids = { added: [] as string[], removed: [] as string[], changed: [] as string[] }; let unchanged = 0
      for (const [key, entry] of right.entries) {
        const previous = left.entries.get(key)
        if (!previous) ids.added.push(entry.identifier)
        else if (previous.fingerprint !== entry.fingerprint) ids.changed.push(entry.identifier)
        else unchanged++
      }
      for (const [key, entry] of left.entries) if (!right.entries.has(key)) ids.removed.push(entry.identifier)
      return { key: left.key, label: left.label, kind: left.kind, identityRule: left.identityRule, beforeCount: left.entries.size, afterCount: right.entries.size, added: ids.added.length, removed: ids.removed.length, changed: ids.changed.length, unchanged, identifiers: { added: ids.added.slice(0, limit), removed: ids.removed.slice(0, limit), changed: ids.changed.slice(0, limit) }, omittedIdentifiers: { added: Math.max(0, ids.added.length - limit), removed: Math.max(0, ids.removed.length - limit), changed: Math.max(0, ids.changed.length - limit) } }
    })
    const primary = collections.filter(collection => collection.kind === 'primary')
    return { module, added: primary.reduce((n, row) => n + row.added, 0), removed: primary.reduce((n, row) => n + row.removed, 0), changed: primary.reduce((n, row) => n + row.changed, 0), unchanged: primary.reduce((n, row) => n + row.unchanged, 0), hasChanges: collections.some(row => row.added + row.removed + row.changed > 0), collections }
  }) }
}
