import type { CrmState } from './model'

type RecordValue = Record<string, unknown>
const owners = ['crm-owner', 'crm-manager', 'sales-riley', 'sales-sam']
const actions = ['create-company', 'create-contact', 'create-lead', 'qualify-lead', 'convert-lead', 'create-opportunity', 'advance-opportunity', 'create-task', 'complete-task', 'assign-lead', 'transfer-account']
function record(value: unknown, required: string[], optional: string[] = []): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)) && required.every(key => Object.hasOwn(value, key))
}
function text(value: unknown, maximum = 120): value is string { return typeof value === 'string' && value.length >= 2 && value.length <= maximum && value.trim() === value && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) }
function integer(value: unknown, minimum = 1): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum }
function email(value: unknown) { return text(value, 160) && value === value.toLowerCase() && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.invalid$/.test(value) }
function choice(value: unknown, allowed: readonly string[]): value is string { return typeof value === 'string' && allowed.includes(value) }

/** Validate the complete CRM graph before restoring any labels or linked records. */
export function isCrmState(value: unknown): value is CrmState {
  if (!record(value, ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity', 'sequence']) || !integer(value.sequence)) return false
  for (const key of ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity']) if (!Array.isArray(value[key])) return false
  const arrays = value as Record<'companies' | 'contacts' | 'leads' | 'opportunities' | 'tasks' | 'activity', unknown[]>
  if (arrays.activity.length !== value.sequence - 1) return false
  const tables: Record<string, Map<string, RecordValue>> = {}
  const shapes: Record<string, string[]> = {
    companies: ['id', 'name', 'ownerId'], contacts: ['id', 'name', 'email', 'companyId', 'ownerId'],
    leads: ['id', 'name', 'email', 'companyName', 'ownerId', 'status'],
    opportunities: ['id', 'title', 'companyId', 'contactId', 'ownerId', 'amountCents', 'stage'],
    tasks: ['id', 'title', 'ownerId', 'opportunityId', 'status'],
  }
  const optional: Record<string, string[]> = { leads: ['opportunityId', 'companyId', 'contactId'], opportunities: ['leadId'] }
  const seedIds: Record<string, string[]> = { companies: ['company-harbor', 'company-orbit'], contacts: ['contact-avery', 'contact-jordan'], leads: ['lead-jules', 'lead-robin'], opportunities: ['opportunity-harbor', 'opportunity-orbit'], tasks: ['task-harbor'] }
  for (const key of ['companies', 'contacts', 'leads', 'opportunities', 'tasks'] as const) {
    const table = new Map<string, RecordValue>()
    for (const item of arrays[key]) {
      if (!record(item, shapes[key], optional[key]) || !text(item.id, 100) || table.has(item.id) || !choice(item.ownerId, owners)) return false
      const kind = key === 'companies' ? 'company' : key === 'opportunities' ? 'opportunity' : key.slice(0, -1)
      if (!seedIds[key].includes(item.id) && (!new RegExp(`^${kind}-\\d{4,}$`).test(item.id) || Number(item.id.slice(kind.length + 1)) < 1 || Number(item.id.slice(kind.length + 1)) >= value.sequence)) return false
      if (key === 'companies' && !text(item.name)) return false
      if (key === 'contacts' && (!text(item.name) || !email(item.email) || !text(item.companyId))) return false
      if (key === 'leads' && (!text(item.name) || !email(item.email) || !text(item.companyName) || !choice(item.status, ['new', 'qualified', 'converted']))) return false
      if (key === 'opportunities' && (!text(item.title, 141) || !integer(item.amountCents) || item.amountCents > 100000000 || !text(item.companyId) || !text(item.contactId) || !choice(item.stage, ['discovery', 'proposal', 'negotiation', 'won', 'lost']))) return false
      if (key === 'tasks' && (!text(item.title) || !text(item.opportunityId) || !choice(item.status, ['open', 'done']))) return false
      table.set(item.id, item)
    }
    if (seedIds[key].some(id => !table.has(id))) return false
    tables[key] = table
  }
  const companyNames = new Set<string>()
  for (const company of tables.companies.values()) {
    const key = `${company.ownerId}:${String(company.name).toLowerCase()}`
    if (companyNames.has(key)) return false
    companyNames.add(key)
  }
  for (const kind of ['contacts', 'leads']) {
    const emails = new Set<string>()
    for (const item of tables[kind].values()) {
      if (emails.has(String(item.email))) return false
      emails.add(String(item.email))
    }
  }
  for (const contact of tables.contacts.values()) if (tables.companies.get(String(contact.companyId))?.ownerId !== contact.ownerId) return false
  for (const opportunity of tables.opportunities.values()) {
    const company = tables.companies.get(String(opportunity.companyId))
    const contact = tables.contacts.get(String(opportunity.contactId))
    if (!company || !contact || company.ownerId !== opportunity.ownerId || contact.ownerId !== opportunity.ownerId || contact.companyId !== company.id) return false
    if (Object.hasOwn(opportunity, 'leadId')) {
      const lead = tables.leads.get(String(opportunity.leadId))
      if (!lead || lead.status !== 'converted' || lead.opportunityId !== opportunity.id) return false
    }
  }
  for (const lead of tables.leads.values()) {
    if (lead.status === 'converted') {
      const opportunity = tables.opportunities.get(String(lead.opportunityId))
      const contact = tables.contacts.get(String(lead.contactId))
      if (!opportunity || !contact || opportunity.leadId !== lead.id || opportunity.ownerId !== lead.ownerId || opportunity.companyId !== lead.companyId || opportunity.contactId !== lead.contactId || contact.email !== lead.email) return false
    } else if (['opportunityId', 'companyId', 'contactId'].some(key => Object.hasOwn(lead, key))) return false
  }
  for (const task of tables.tasks.values()) if (tables.opportunities.get(String(task.opportunityId))?.ownerId !== task.ownerId) return false
  for (const [index, activity] of arrays.activity.entries()) {
    if (!record(activity, ['receipt', 'ownerId', 'action', 'description'], ['ownershipChange']) || activity.receipt !== `MOCK-CRM-${String(value.sequence - index - 1).padStart(4, '0')}` || !choice(activity.ownerId, owners) || !choice(activity.action, actions) || !text(activity.description, 500)) return false
    if (activity.action !== 'assign-lead' && activity.action !== 'transfer-account') {
      if (Object.hasOwn(activity, 'ownershipChange')) return false
      continue
    }
    const change = activity.ownershipChange
    if (!record(change, ['actorId', 'fromOwnerId', 'toOwnerId', 'recordId', 'affected']) || !choice(change.actorId, ['crm-owner', 'crm-manager']) || !choice(change.fromOwnerId, owners) || !choice(change.toOwnerId, owners) || change.fromOwnerId === change.toOwnerId || activity.ownerId !== change.toOwnerId || !text(change.recordId, 100)) return false
    const affected = change.affected
    if (!record(affected, ['companies', 'contacts', 'leads', 'opportunities', 'tasks'])) return false
    for (const kind of ['companies', 'contacts', 'leads', 'opportunities', 'tasks']) {
      const ids = affected[kind]
      if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !text(id, 100) || !tables[kind].has(id))) return false
    }
    if (activity.action === 'assign-lead') {
      if (JSON.stringify(affected.leads) !== JSON.stringify([change.recordId]) || ['companies', 'contacts', 'opportunities', 'tasks'].some(kind => (affected[kind] as unknown[]).length)) return false
    } else {
      if (JSON.stringify(affected.companies) !== JSON.stringify([change.recordId])) return false
      for (const id of affected.contacts as string[]) if (tables.contacts.get(id)?.companyId !== change.recordId) return false
      for (const id of affected.leads as string[]) if (tables.leads.get(id)?.companyId !== change.recordId) return false
      for (const id of affected.opportunities as string[]) if (tables.opportunities.get(id)?.companyId !== change.recordId) return false
      for (const id of affected.tasks as string[]) if (tables.opportunities.get(String(tables.tasks.get(id)?.opportunityId))?.companyId !== change.recordId) return false
    }
  }
  return true
}
