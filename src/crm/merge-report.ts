import type { CrmActor, CrmRecordTables, CrmState } from './types'
import { isCrmState } from './persistence'
import { assertCrmMergeActor, canonicalCrmMergeJson } from './merge-value'

export type CrmMergeRefusal = { ok: false; code: string; message: string }
export type CrmPageRequest = { page?: number; pageSize?: number }
export type CrmDuplicateMember = { kind: 'company' | 'contact' | 'lead'; id: string; label: string; ownerId: string; companyId?: string }
export type CrmDuplicateReason = 'candidate' | 'cross-owner-ineligible' | 'expected-conversion-link'
export type CrmDuplicateGroup = { groupId: string; kind: 'company-name' | 'email'; reason: CrmDuplicateReason; normalizedKey: string; memberCount: number; memberPage: number; memberPageSize: number; members: CrmDuplicateMember[]; membersHasMore: boolean }
export type CrmDuplicateReport = { ok: true; schemaVersion: 1; status: 'empty' | 'page'; page: number; pageSize: number; accessibleGroupCount: number; returnedCount: number; hasMore: boolean; groups: CrmDuplicateGroup[] } | CrmMergeRefusal
export type CrmDuplicateMemberRequest = CrmPageRequest & { groupId: string }
export type CrmDuplicateMemberPage = { ok: true; schemaVersion: 1; status: 'empty' | 'page'; groupId: string; reason: CrmDuplicateReason; normalizedKey: string; page: number; pageSize: number; accessibleMemberCount: number; returnedCount: number; hasMore: boolean; members: CrmDuplicateMember[] } | CrmMergeRefusal

export const crmMergeUnavailable = (): CrmMergeRefusal => ({ ok: false, code: 'unavailable', message: 'This CRM merge view is unavailable for this preview identity or selection.' })
export const normalizeCrmDuplicateText = (value: string): string => value.trim().replace(/\s+/gu, ' ').toLowerCase()
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

/** Actor admission precedes every source or selected-record read. Labels do not grant authority. */
export function crmMergeReadActor(value: unknown): CrmActor | null {
  try { return assertCrmMergeActor(value) } catch { return null }
}

/** Internal table scope only; callers never reconstruct command authority from it. */
export function crmMergeVisibleTables(state: CrmState, actor: CrmActor): CrmRecordTables {
  const admitted = (record: { ownerId: string }) => actor.role !== 'sales-rep' || record.ownerId === actor.id
  const companies = state.companies.filter(admitted), companyIds = new Set(companies.map(record => record.id))
  const contacts = state.contacts.filter(record => admitted(record) && companyIds.has(record.companyId)), contactIds = new Set(contacts.map(record => record.id))
  const opportunities = state.opportunities.filter(record => admitted(record) && companyIds.has(record.companyId) && contactIds.has(record.contactId)), opportunityIds = new Set(opportunities.map(record => record.id))
  return { companies, contacts, opportunities, leads: state.leads.filter(record => admitted(record) && (!record.opportunityId || opportunityIds.has(record.opportunityId))), tasks: state.tasks.filter(record => admitted(record) && opportunityIds.has(record.opportunityId)) }
}

/** Finite descriptor-only request parsing. No accessor is evaluated. */
export function crmMergePageRequest(value: unknown, required: readonly string[] = []): { page: number; pageSize: number; values: Record<string, unknown> } | null {
  try {
    if (value === undefined && required.length === 0) return { page: 1, pageSize: 20, values: {} }
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value)
    if (!required.every(key => keys.includes(key)) || keys.some(key => typeof key !== 'string' || ![...required, 'page', 'pageSize'].includes(key))) return null
    if (Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable)) return null
    const values = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]))
    const page = Object.hasOwn(values, 'page') ? values.page : 1, pageSize = Object.hasOwn(values, 'pageSize') ? values.pageSize : 20
    if (typeof page !== 'number' || !Number.isSafeInteger(page) || Object.is(page, -0) || page < 1 || page > 1_000_000 || typeof pageSize !== 'number' || !Number.isSafeInteger(pageSize) || Object.is(pageSize, -0) || pageSize < 1 || pageSize > 50) return null
    return { page, pageSize, values }
  } catch { return null }
}

type PrivateGroup = Omit<CrmDuplicateGroup, 'memberCount' | 'memberPage' | 'memberPageSize' | 'membersHasMore'>
function groupsFor(state: CrmState, actor: CrmActor): PrivateGroup[] {
  const visible = crmMergeVisibleTables(state, actor), companies = new Map<string, CrmDuplicateMember[]>(), emails = new Map<string, CrmDuplicateMember[]>()
  function add(map: Map<string, CrmDuplicateMember[]>, key: string, member: CrmDuplicateMember) { const members = map.get(key) ?? []; members.push(member); map.set(key, members) }
  for (const record of visible.companies) add(companies, normalizeCrmDuplicateText(record.name), { kind: 'company', id: record.id, label: record.name, ownerId: record.ownerId })
  for (const record of visible.contacts) add(emails, record.email.trim().toLowerCase(), { kind: 'contact', id: record.id, label: record.name, ownerId: record.ownerId, companyId: record.companyId })
  for (const record of visible.leads) add(emails, record.email.trim().toLowerCase(), { kind: 'lead', id: record.id, label: record.name, ownerId: record.ownerId, ...(record.companyId ? { companyId: record.companyId } : {}) })
  const groups: PrivateGroup[] = []
  for (const [kind, map] of [['company-name', companies], ['email', emails]] as const) for (const [key, members] of map) {
    if (members.length < 2) continue
    let reason: CrmDuplicateReason = new Set(members.map(member => member.ownerId)).size > 1 ? 'cross-owner-ineligible' : 'candidate'
    if (kind === 'email' && members.length === 2 && reason !== 'cross-owner-ineligible') {
      const contact = members.find(member => member.kind === 'contact'), lead = members.find(member => member.kind === 'lead')
      const liveLead = lead && visible.leads.find(record => record.id === lead.id)
      const opportunity = liveLead && visible.opportunities.find(record => record.id === liveLead.opportunityId)
      if (contact && liveLead?.status === 'converted' && liveLead.contactId === contact.id && opportunity?.leadId === liveLead.id && opportunity.contactId === contact.id) reason = 'expected-conversion-link'
    }
    groups.push({ groupId: `${kind}:${encodeURIComponent(key)}`, kind, reason, normalizedKey: key, members: members.sort((left, right) => compare(left.kind, right.kind) || compare(left.id, right.id)) })
  }
  return groups.sort((left, right) => compare(left.kind, right.kind) || compare(left.normalizedKey, right.normalizedKey) || compare(left.reason, right.reason))
}

/** Advisory only: no normalization writes, implicit selection, journal or save. */
export function duplicateCrmReport(state: unknown, actorValue: unknown, request?: unknown): CrmDuplicateReport {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return crmMergeUnavailable()
  const paging = crmMergePageRequest(request)
  if (!paging) return crmMergeUnavailable()
  try {
    canonicalCrmMergeJson(state)
    if (!isCrmState(state)) return crmMergeUnavailable()
    const all = groupsFor(state, actor), start = (paging.page - 1) * paging.pageSize
    const groups = all.slice(start, start + paging.pageSize).map(group => ({ groupId: group.groupId, kind: group.kind, reason: group.reason, normalizedKey: group.normalizedKey, memberCount: group.members.length, memberPage: 1, memberPageSize: 50, members: group.members.slice(0, 50), membersHasMore: group.members.length > 50 }))
    return { ok: true, schemaVersion: 1, status: groups.length ? 'page' : 'empty', page: paging.page, pageSize: paging.pageSize, accessibleGroupCount: all.length, returnedCount: groups.length, hasMore: start + groups.length < all.length, groups }
  } catch { return crmMergeUnavailable() }
}

export function duplicateCrmGroupMembers(state: unknown, actorValue: unknown, request: unknown): CrmDuplicateMemberPage {
  const actor = crmMergeReadActor(actorValue)
  if (!actor) return crmMergeUnavailable()
  const paging = crmMergePageRequest(request, ['groupId'])
  if (!paging || typeof paging.values.groupId !== 'string' || paging.values.groupId.length > 1000) return crmMergeUnavailable()
  try {
    canonicalCrmMergeJson(state)
    if (!isCrmState(state)) return crmMergeUnavailable()
    const group = groupsFor(state, actor).find(candidate => candidate.groupId === paging.values.groupId)
    if (!group) return crmMergeUnavailable()
    const start = (paging.page - 1) * paging.pageSize, members = group.members.slice(start, start + paging.pageSize)
    return { ok: true, schemaVersion: 1, status: members.length ? 'page' : 'empty', groupId: group.groupId, reason: group.reason, normalizedKey: group.normalizedKey, page: paging.page, pageSize: paging.pageSize, accessibleMemberCount: group.members.length, returnedCount: members.length, hasMore: start + members.length < group.members.length, members }
  } catch { return crmMergeUnavailable() }
}
