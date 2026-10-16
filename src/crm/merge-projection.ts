import type { CrmActor, CrmMergeActivity, CrmState } from './types'
import type { CrmMergeCounts } from './merge-types'
import type { CrmChoicePage, CrmChoiceRequest, CrmDuplicateGroup, CrmDuplicateMember, CrmGroupMembersRequest, CrmMergeHistoryRow, CrmMergeSafeActivity, CrmPage, CrmPageRequest, CrmScopedState } from './merge-public-types'
import { canonicalCrmMergeJson, copyCrmMerge } from './merge-value'
import { isCrmState } from './persistence'
import { crmMergeReadActor, crmMergeUnavailable, crmMergeVisibleTables, duplicateCrmGroupMembers, duplicateCrmReport } from './merge-report'

export const CRM_MERGE_REPRESENTATIVE_NOTICE = 'This page lists merge receipts recorded in your ownership scope. Historical IDs do not grant access to current records.'
export const CRM_MERGE_FULL_HISTORY_NOTICE = 'Historical merge captures show fields captured at their receipt. Current directory labels are separate.'
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const refuse = (): never => { throw new Error(crmMergeUnavailable().message) }

/** Descriptor-only exact public request admission, before source reads. */
export function readCrmMergePageRequest(value: unknown, extraKeys: readonly string[] = [], optionalKeys: readonly string[] = []): Record<string, unknown> & CrmPageRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return refuse()
  const required = ['page', 'pageSize', 'scopeVersion', ...extraKeys], keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value)
  if (!required.every(key => keys.includes(key)) || keys.some(key => typeof key !== 'string' || ![...required, ...optionalKeys].includes(key)) || Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable)) return refuse()
  const data = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]))
  for (const [key, minimum, maximum] of [['page', 1, 1_000_000], ['pageSize', 1, 50], ['scopeVersion', 0, Number.MAX_SAFE_INTEGER]] as const) {
    const item = data[key]
    if (typeof item !== 'number' || !Number.isSafeInteger(item) || Object.is(item, -0) || item < minimum || item > maximum) return refuse()
  }
  return data as Record<string, unknown> & CrmPageRequest
}

function admitted(state: CrmState, actorValue: unknown): CrmActor {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return refuse()
  canonicalCrmMergeJson(state)
  if (!isCrmState(state)) return refuse()
  return actor
}
function page<T>(rows: T[], request: CrmPageRequest): CrmPage<T> {
  const start = (request.page - 1) * request.pageSize, selected = rows.slice(start, start + request.pageSize)
  return { schemaVersion: 1, scopeVersion: request.scopeVersion, status: selected.length ? 'page' : 'empty', page: request.page, pageSize: request.pageSize, accessibleCount: rows.length, returnedCount: selected.length, hasMore: start + selected.length < rows.length, rows: copyCrmMerge(selected) }
}
function counts(activity: CrmMergeActivity): CrmMergeCounts {
  const capture = activity.mergeChange
  const changed = { contacts: capture.changes.contacts.length, leads: capture.changes.leads.length, opportunities: capture.changes.opportunities.length }
  const context = { companies: capture.context.companies.length, contacts: capture.context.contacts.length, leads: capture.context.leads.length, opportunities: capture.context.opportunities.length, tasks: capture.context.tasks.length }
  return { retired: 1, retained: 1, changed, context, reviewRecords: 2 + Object.values(changed).reduce((total, count) => total + count, 0) + Object.values(context).reduce((total, count) => total + count, 0) }
}
function safeActivity(activity: CrmMergeActivity): CrmMergeSafeActivity {
  const capture = activity.mergeChange
  return { receipt: activity.receipt, ownerId: activity.ownerId, action: activity.action, description: 'Historical CRM merge recorded in this ownership scope.', mergeSummary: { schemaVersion: 1, kind: capture.kind, sourceId: capture.sourceId, retainedId: capture.retainedId, commonOwnerId: capture.commonOwnerId, fieldPolicy: capture.fieldPolicy, counts: counts(activity) } }
}

/** Legacy directory reads retain their original capacity. Inspect descriptors
 * iteratively so valid saved JSON inherits none of the new journal limits. */
function assertLegacyScopeJson(value: unknown): void {
  const ancestors = new Set<object>(), pending: { value: unknown; exit?: boolean }[] = [{ value }]
  while (pending.length) {
    const entry = pending.pop()!, item = entry.value
    if (entry.exit) { ancestors.delete(item as object); continue }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') continue
    if (typeof item === 'number') { if (!Number.isFinite(item) || Object.is(item, -0)) refuse(); continue }
    if (!item || typeof item !== 'object' || ancestors.has(item)) refuse()
    const object = item as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object)
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) refuse()
    const keys = Reflect.ownKeys(object)
    if (array && (keys.length !== (object as unknown[]).length + 1 || !keys.every(key => key === 'length' || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < (object as unknown[]).length))) refuse()
    ancestors.add(object); pending.push({ value: object, exit: true })
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(object, key)
      if (typeof key !== 'string' || !descriptor || !('value' in descriptor) || !descriptor.enumerable) return refuse()
      pending.push({ value: descriptor.value })
    }
  }
}

/** The compatibility directory projection never emits private historical captures to representatives. */
export function projectCrmScope(state: CrmState, actorValue: unknown): CrmScopedState {
  const empty = (): CrmScopedState => ({ companies: [], contacts: [], leads: [], opportunities: [], tasks: [], activity: [], sequence: 0 })
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return empty()
  try {
    const legacy = !Object.hasOwn(state, 'mergeHistory') && !('mergeHistory' in state)
    if (legacy) { assertLegacyScopeJson(state); if (!isCrmState(state)) return empty() }
    else admitted(state, actor)
    const copy = legacy ? structuredClone : copyCrmMerge
    const tables = crmMergeVisibleTables(state, actor)
    const activity = state.activity.filter(item => actor.role !== 'sales-rep' || item.ownerId === actor.id).map(item => actor.role === 'sales-rep' && 'mergeChange' in item ? safeActivity(item as CrmMergeActivity) : copy(item))
    return { ...copy(tables), activity, sequence: 0 }
  } catch { return empty() }
}

export function projectCrmDuplicateReport(state: CrmState, actorValue: unknown, requestValue: CrmPageRequest): CrmPage<CrmDuplicateGroup> {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return refuse()
  const request = readCrmMergePageRequest(requestValue)
  const result = duplicateCrmReport(state, actor, { page: request.page, pageSize: request.pageSize })
  if (!result.ok) return refuse()
  return { schemaVersion: 1, scopeVersion: request.scopeVersion, status: result.status, page: result.page, pageSize: result.pageSize, accessibleCount: result.accessibleGroupCount, returnedCount: result.returnedCount, hasMore: result.hasMore, rows: result.groups.map(group => ({ key: { reason: group.kind, normalizedKey: group.normalizedKey }, classification: group.reason, members: { schemaVersion: 1, scopeVersion: request.scopeVersion, status: group.members.length ? 'page' : 'empty', page: 1, pageSize: 50, accessibleCount: group.memberCount, returnedCount: group.members.length, hasMore: group.membersHasMore, rows: copyCrmMerge(group.members) } })) }
}

export function projectCrmDuplicateMembers(state: CrmState, actorValue: unknown, requestValue: CrmGroupMembersRequest): CrmPage<CrmDuplicateMember> {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return refuse()
  const request = readCrmMergePageRequest(requestValue, ['group'])
  const group = request.group
  if (!group || typeof group !== 'object' || Array.isArray(group) || ![Object.prototype, null].includes(Object.getPrototypeOf(group))) return refuse()
  const descriptors = Object.getOwnPropertyDescriptors(group), keys = Reflect.ownKeys(group)
  if (keys.length !== 2 || !keys.includes('reason') || !keys.includes('normalizedKey') || Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable)) return refuse()
  const reason: unknown = descriptors.reason.value, normalizedKey: unknown = descriptors.normalizedKey.value
  if (!['company-name', 'email'].includes(reason as string) || typeof normalizedKey !== 'string' || normalizedKey.length > 160) return refuse()
  const result = duplicateCrmGroupMembers(state, actor, { groupId: `${reason}:${encodeURIComponent(normalizedKey)}`, page: request.page, pageSize: request.pageSize })
  if (!result.ok) return refuse()
  return { schemaVersion: 1, scopeVersion: request.scopeVersion, status: result.status, page: result.page, pageSize: result.pageSize, accessibleCount: result.accessibleMemberCount, returnedCount: result.returnedCount, hasMore: result.hasMore, rows: copyCrmMerge(result.members) }
}

export function projectCrmMergeChoices(state: CrmState, actorValue: unknown, requestValue: CrmChoiceRequest): CrmChoicePage {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return refuse()
  const request = readCrmMergePageRequest(requestValue, ['kind'], ['selectedIds'])
  if (request.kind !== 'company' && request.kind !== 'contact') return refuse()
  let selectedIds: string[] = []
  if (Object.hasOwn(request, 'selectedIds')) {
    const input = request.selectedIds
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length > 2 || Reflect.ownKeys(input).length !== input.length + 1) return refuse()
    selectedIds = Array.from({ length: input.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index))
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'string' || !/^[A-Za-z0-9_-]{2,100}$/.test(descriptor.value)) return refuse()
      return descriptor.value as string
    })
    if (new Set(selectedIds).size !== selectedIds.length) return refuse()
  }
  admitted(state, actor)
  const visible = crmMergeVisibleTables(state, actor)
  const records = request.kind === 'company' ? visible.companies : visible.contacts
  const rows = records.map(record => ({ kind: request.kind as 'company' | 'contact', id: record.id, label: record.name, ownerId: record.ownerId })).sort((left, right) => compare(left.id, right.id))
  return { ...page(rows, request), selected: selectedIds.map(id => { const choice = rows.find(row => row.id === id); return choice ? { id, available: true as const, choice: copyCrmMerge(choice) } : { id, available: false as const } }) }
}

export function projectCrmMergeHistory(state: CrmState, actorValue: unknown, requestValue: CrmPageRequest): CrmPage<CrmMergeHistoryRow> {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return refuse()
  const request = readCrmMergePageRequest(requestValue)
  admitted(state, actor)
  const rows: CrmMergeHistoryRow[] = []
  for (const activity of state.activity) {
    if (!('mergeChange' in activity) || (actor.role === 'sales-rep' && activity.ownerId !== actor.id)) continue
    rows.push(actor.role === 'sales-rep' ? { mode: 'recorded-owner-summary', activity: safeActivity(activity as CrmMergeActivity) } : { mode: 'full', activity: copyCrmMerge(activity as CrmMergeActivity) })
  }
  return page(rows, request)
}
