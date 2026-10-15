import type { CrmState } from './model'

type RecordValue = Record<string, unknown>
const owners = ['crm-owner', 'crm-manager', 'sales-riley', 'sales-sam']
const actions = ['create-company', 'create-contact', 'create-lead', 'qualify-lead', 'convert-lead', 'create-opportunity', 'advance-opportunity', 'create-task', 'complete-task']
function record(value: unknown, required: string[], optional: string[] = []): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)) && required.every(key => Object.hasOwn(value, key))
}
function text(value: unknown, maximum = 120): value is string { return typeof value === 'string' && value.length >= 2 && value.length <= maximum && value.trim() === value && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) }
function integer(value: unknown, minimum = 1): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum }
function email(value: unknown) { return text(value, 160) && value === value.toLowerCase() && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.invalid$/.test(value) }

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
      if (!record(item, shapes[key], optional[key]) || !text(item.id, 100) || table.has(item.id) || !owners.includes(String(item.ownerId))) return false
      const kind = key === 'companies' ? 'company' : key === 'opportunities' ? 'opportunity' : key.slice(0, -1)
      if (!seedIds[key].includes(item.id) && (!new RegExp(`^${kind}-\\d{4,}$`).test(item.id) || Number(item.id.slice(kind.length + 1)) < 1 || Number(item.id.slice(kind.length + 1)) >= value.sequence)) return false
      if (key === 'companies' && !text(item.name)) return false
      if (key === 'contacts' && (!text(item.name) || !email(item.email) || !text(item.companyId))) return false
      if (key === 'leads' && (!text(item.name) || !email(item.email) || !text(item.companyName) || !['new', 'qualified', 'converted'].includes(String(item.status)))) return false
      if (key === 'opportunities' && (!text(item.title, 141) || !integer(item.amountCents) || item.amountCents > 100000000 || !text(item.companyId) || !text(item.contactId) || !['discovery', 'proposal', 'negotiation', 'won', 'lost'].includes(String(item.stage)))) return false
      if (key === 'tasks' && (!text(item.title) || !text(item.opportunityId) || !['open', 'done'].includes(String(item.status)))) return false
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
    if (!record(activity, ['receipt', 'ownerId', 'action', 'description']) || activity.receipt !== `MOCK-CRM-${String(value.sequence - index - 1).padStart(4, '0')}` || !owners.includes(String(activity.ownerId)) || !actions.includes(String(activity.action)) || !text(activity.description, 500)) return false
  }
  return true
}
