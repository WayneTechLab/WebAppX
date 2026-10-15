/** Account-free CRM: synthetic records; optional browser persistence belongs to the demo UI. No outbound/provider operations. */
export type CrmRole = 'owner' | 'sales-manager' | 'sales-rep' | 'auditor'
export type CrmActor = { id: string; role: CrmRole; label: string }
export type CrmCompany = { id: string; name: string; ownerId: string }
export type CrmContact = { id: string; name: string; email: string; companyId: string; ownerId: string }
export type CrmLead = { id: string; name: string; email: string; companyName: string; ownerId: string; status: 'new' | 'qualified' | 'converted'; opportunityId?: string; companyId?: string; contactId?: string }
export const crmStages = ['discovery', 'proposal', 'negotiation', 'won', 'lost'] as const
export type CrmStage = typeof crmStages[number]
export type CrmOpportunity = { id: string; title: string; companyId: string; contactId: string; ownerId: string; amountCents: number; stage: CrmStage; leadId?: string }
export type CrmTask = { id: string; title: string; ownerId: string; opportunityId: string; status: 'open' | 'done' }
export type CrmOwnershipAffected = { companies: string[]; contacts: string[]; leads: string[]; opportunities: string[]; tasks: string[] }
export type CrmOwnershipChange = { actorId: string; fromOwnerId: string; toOwnerId: string; recordId: string; affected: CrmOwnershipAffected }
export type CrmActivity = { receipt: string; ownerId: string; action: string; description: string; ownershipChange?: CrmOwnershipChange }
export type CrmState = { companies: CrmCompany[]; contacts: CrmContact[]; leads: CrmLead[]; opportunities: CrmOpportunity[]; tasks: CrmTask[]; activity: CrmActivity[]; sequence: number }
export type CrmEvent =
  | { type: 'create-company'; name: string }
  | { type: 'create-contact'; name: string; email: string; companyId: string }
  | { type: 'create-lead'; name: string; email: string; companyName: string }
  | { type: 'qualify-lead'; leadId: string }
  | { type: 'assign-lead'; leadId: string; newOwnerId: string; expectedOwnerId: string }
  | { type: 'convert-lead'; leadId: string; amountCents: number }
  | { type: 'create-opportunity'; title: string; companyId: string; contactId: string; amountCents: number }
  | { type: 'advance-opportunity'; opportunityId: string; stage: CrmStage }
  | { type: 'create-task'; title: string; opportunityId: string }
  | { type: 'complete-task'; taskId: string }

export const crmActors: readonly CrmActor[] = [
  { id: 'crm-owner', role: 'owner', label: 'Casey Example · Owner' },
  { id: 'crm-manager', role: 'sales-manager', label: 'Morgan Example · Sales manager' },
  { id: 'sales-riley', role: 'sales-rep', label: 'Riley Sample · Sales representative' },
  { id: 'sales-sam', role: 'sales-rep', label: 'Sam Fixture · Sales representative' },
  { id: 'crm-auditor', role: 'auditor', label: 'Alex Demo · Auditor (read only)' },
]

export function createCrmState(): CrmState {
  return {
    companies: [{ id: 'company-harbor', name: 'Fictional Harbor Studio', ownerId: 'sales-riley' }, { id: 'company-orbit', name: 'Example Orbit Workshop', ownerId: 'sales-sam' }],
    contacts: [{ id: 'contact-avery', name: 'Avery Fiction', email: 'avery@harbor.invalid', companyId: 'company-harbor', ownerId: 'sales-riley' }, { id: 'contact-jordan', name: 'Jordan Example', email: 'jordan@orbit.invalid', companyId: 'company-orbit', ownerId: 'sales-sam' }],
    leads: [{ id: 'lead-jules', name: 'Jules Sample', email: 'jules@meadow.invalid', companyName: 'Sample Meadow Lab', ownerId: 'sales-riley', status: 'new' }, { id: 'lead-robin', name: 'Robin Fiction', email: 'robin@ridge.invalid', companyName: 'Example Ridge Studio', ownerId: 'sales-sam', status: 'qualified' }],
    opportunities: [{ id: 'opportunity-harbor', title: 'Sample portal discovery', companyId: 'company-harbor', contactId: 'contact-avery', ownerId: 'sales-riley', amountCents: 250000, stage: 'discovery' }, { id: 'opportunity-orbit', title: 'Fictional workflow workshop', companyId: 'company-orbit', contactId: 'contact-jordan', ownerId: 'sales-sam', amountCents: 400000, stage: 'proposal' }],
    tasks: [{ id: 'task-harbor', title: 'Prepare fictional discovery notes', ownerId: 'sales-riley', opportunityId: 'opportunity-harbor', status: 'open' }],
    activity: [], sequence: 1,
  }
}

function validActor(actor: CrmActor) { return Boolean(actor && typeof actor === 'object' && crmActors.some(candidate => candidate.id === actor.id && candidate.role === actor.role)) }
export function canWriteCrm(actor: CrmActor) { return validActor(actor) && actor.role !== 'auditor' }
export function canManageCrmOwnership(actor: CrmActor) { return validActor(actor) && (actor.role === 'owner' || actor.role === 'sales-manager') }
function canRead(actor: CrmActor, record: { ownerId: string }) { return validActor(actor) && (actor.role !== 'sales-rep' || record.ownerId === actor.id) }
function canWrite(actor: CrmActor, record: { ownerId: string }) { return canWriteCrm(actor) && canRead(actor, record) }

export function scopedCrmState(state: CrmState, actor: CrmActor): CrmState {
  const companies = state.companies.filter(record => canRead(actor, record))
  const companyIds = new Set(companies.map(record => record.id))
  const contacts = state.contacts.filter(record => canRead(actor, record) && companyIds.has(record.companyId))
  const contactIds = new Set(contacts.map(record => record.id))
  const opportunities = state.opportunities.filter(record => canRead(actor, record) && companyIds.has(record.companyId) && contactIds.has(record.contactId))
  const opportunityIds = new Set(opportunities.map(record => record.id))
  return {
    companies, contacts, opportunities,
    leads: state.leads.filter(record => canRead(actor, record) && (!record.opportunityId || opportunityIds.has(record.opportunityId))),
    tasks: state.tasks.filter(record => canRead(actor, record) && opportunityIds.has(record.opportunityId)),
    activity: state.activity.filter(record => canRead(actor, record)), sequence: 0,
  }
}

export function crmDashboard(state: CrmState, actor: CrmActor) {
  const visible = scopedCrmState(state, actor)
  const open = visible.opportunities.filter(record => !['won', 'lost'].includes(record.stage))
  return {
    companies: visible.companies.length, contacts: visible.contacts.length,
    leads: visible.leads.filter(record => record.status !== 'converted').length,
    openOpportunities: open.length, pipelineCents: open.reduce((sum, record) => sum + record.amountCents, 0),
    wonCents: visible.opportunities.filter(record => record.stage === 'won').reduce((sum, record) => sum + record.amountCents, 0),
    openTasks: visible.tasks.filter(record => record.status === 'open').length, activities: visible.activity.length,
  }
}

function text(value: string, label: string, max = 120) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > max || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`${label} must contain 2–${max} readable characters.`)
  return value.trim()
}
function email(value: string) {
  const result = text(value, 'Sample email', 160).toLowerCase()
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.invalid$/i.test(result)) throw new Error('Use a fictional email ending in .invalid, such as person@example.invalid.')
  return result
}
function amount(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100000000) throw new Error('Sample opportunity amount must be between $0.01 and $1,000,000.00.')
  return value
}
function requireRecord<T extends { id: string; ownerId: string }>(records: T[], id: string, actor: CrmActor) {
  const record = records.find(candidate => candidate.id === id && canWrite(actor, candidate))
  if (!record) throw new Error('That sample record is unavailable to this actor.')
  return record
}

export function transitionCrm(current: CrmState, actor: CrmActor, event: CrmEvent): CrmState {
  if (!canWriteCrm(actor)) throw new Error('This preview identity has no CRM write permission.')
  if (event.type === 'assign-lead' && !canManageCrmOwnership(actor)) throw new Error('Only an owner or sales manager preview can change CRM ownership.')
  const state = structuredClone(current)
  const receipt = `MOCK-CRM-${String(state.sequence).padStart(4, '0')}`
  const id = (kind: string) => `${kind}-${String(state.sequence).padStart(4, '0')}`
  let ownerId = actor.id
  let description = ''
  let ownershipChange: CrmOwnershipChange | undefined
  switch (event.type) {
    case 'create-company': {
      const name = text(event.name, 'Company name')
      if (state.companies.some(record => record.ownerId === actor.id && record.name.toLowerCase() === name.toLowerCase())) throw new Error('This actor already owns a sample company with that name.')
      state.companies.push({ id: id('company'), name, ownerId })
      description = `Created sample company ${name}.`
      break
    }
    case 'create-contact': {
      const company = requireRecord(state.companies, event.companyId, actor)
      const name = text(event.name, 'Contact name')
      const address = email(event.email)
      if (state.contacts.some(record => record.email === address)) throw new Error('Sample contact could not be added; use a different fictional email.')
      ownerId = company.ownerId
      state.contacts.push({ id: id('contact'), name, email: address, companyId: company.id, ownerId })
      description = `Created ${name} at ${company.name}.`
      break
    }
    case 'create-lead': {
      const name = text(event.name, 'Lead name')
      const address = email(event.email)
      const companyName = text(event.companyName, 'Company name')
      if (state.leads.some(record => record.email === address) || state.contacts.some(record => record.email === address)) throw new Error('Sample lead could not be added; use a different fictional email.')
      state.leads.push({ id: id('lead'), name, email: address, companyName, ownerId, status: 'new' })
      description = `Created sample lead ${name}.`
      break
    }
    case 'qualify-lead': {
      const lead = requireRecord(state.leads, event.leadId, actor)
      if (lead.status !== 'new') throw new Error('Only a new sample lead can be qualified.')
      lead.status = 'qualified'; ownerId = lead.ownerId
      description = `Qualified ${lead.name}; conversion is now available.`
      break
    }
    case 'assign-lead': {
      if (!canManageCrmOwnership(actor)) throw new Error('Only an owner or sales manager preview can change CRM ownership.')
      const lead = requireRecord(state.leads, event.leadId, actor)
      if (!['new', 'qualified'].includes(lead.status) || ['companyId', 'contactId', 'opportunityId'].some(key => Object.hasOwn(lead, key))) throw new Error('Only an unconverted lead can be reassigned; use account ownership transfer for converted records.')
      if (lead.ownerId !== event.expectedOwnerId) throw new Error('The lead assignment changed. Review a fresh preview before confirming.')
      const nextOwner = crmActors.find(candidate => candidate.id === event.newOwnerId && candidate.role !== 'auditor')
      if (!nextOwner || nextOwner.id === lead.ownerId) throw new Error('Choose a different supported fictional assignee.')
      const fromOwnerId = lead.ownerId
      const fromName = crmActors.find(candidate => candidate.id === fromOwnerId)?.label.split(' · ')[0]
      if (!fromName) throw new Error('The current fictional assignee is unavailable.')
      lead.ownerId = nextOwner.id; ownerId = nextOwner.id
      ownershipChange = { actorId: actor.id, fromOwnerId, toOwnerId: nextOwner.id, recordId: lead.id,
        affected: { companies: [], contacts: [], leads: [lead.id], opportunities: [], tasks: [] } }
      description = `Reassigned unconverted lead ${lead.name} from ${fromName} to ${nextOwner.label.split(' · ')[0]}.`
      break
    }
    case 'convert-lead': {
      const lead = requireRecord(state.leads, event.leadId, actor)
      if (lead.status !== 'qualified') throw new Error('Qualify the sample lead before conversion; a converted lead cannot be converted again.')
      const amountCents = amount(event.amountCents)
      ownerId = lead.ownerId
      let company = state.companies.find(record => record.ownerId === ownerId && record.name.toLowerCase() === lead.companyName.toLowerCase())
      const priorContact = state.contacts.find(record => record.email === lead.email)
      if (priorContact && (priorContact.ownerId !== ownerId || !company || priorContact.companyId !== company.id)) throw new Error('Conversion has a conflicting contact; use a distinct fictional lead.')
      if (!company) { company = { id: id('company'), name: lead.companyName, ownerId }; state.companies.push(company) }
      const contact = priorContact ?? { id: id('contact'), name: lead.name, email: lead.email, companyId: company.id, ownerId }
      if (!priorContact) state.contacts.push(contact)
      const opportunity: CrmOpportunity = { id: id('opportunity'), title: `${company.name} · sample opportunity`, companyId: company.id, contactId: contact.id, ownerId, amountCents, stage: 'discovery', leadId: lead.id }
      state.opportunities.push(opportunity)
      lead.status = 'converted'; lead.companyId = company.id; lead.contactId = contact.id; lead.opportunityId = opportunity.id
      description = `Converted ${lead.name} into linked company, contact and opportunity records.`
      break
    }
    case 'create-opportunity': {
      const company = requireRecord(state.companies, event.companyId, actor)
      const contact = requireRecord(state.contacts, event.contactId, actor)
      if (contact.companyId !== company.id || contact.ownerId !== company.ownerId) throw new Error('Choose a contact belonging to the selected company and record owner.')
      const title = text(event.title, 'Opportunity title')
      ownerId = company.ownerId
      state.opportunities.push({ id: id('opportunity'), title, companyId: company.id, contactId: contact.id, ownerId, amountCents: amount(event.amountCents), stage: 'discovery' })
      description = `Created sample opportunity ${title}.`
      break
    }
    case 'advance-opportunity': {
      const opportunity = requireRecord(state.opportunities, event.opportunityId, actor)
      if (['won', 'lost'].includes(opportunity.stage)) throw new Error('Closed sample opportunities cannot change stage.')
      const next = crmStages[crmStages.indexOf(opportunity.stage) + 1]
      if (event.stage !== 'lost' && event.stage !== next) throw new Error('Move the sample opportunity through discovery, proposal and negotiation before winning.')
      opportunity.stage = event.stage; ownerId = opportunity.ownerId
      description = `Moved ${opportunity.title} to ${event.stage}.`
      break
    }
    case 'create-task': {
      const opportunity = requireRecord(state.opportunities, event.opportunityId, actor)
      const title = text(event.title, 'Task title')
      if (['won', 'lost'].includes(opportunity.stage)) throw new Error('Create follow-up tasks while the sample opportunity is open.')
      ownerId = opportunity.ownerId
      state.tasks.push({ id: id('task'), title, opportunityId: opportunity.id, ownerId, status: 'open' })
      description = `Assigned ${title} to the opportunity owner.`
      break
    }
    case 'complete-task': {
      const task = requireRecord(state.tasks, event.taskId, actor)
      if (task.status !== 'open') throw new Error('This sample task is already complete.')
      task.status = 'done'; ownerId = task.ownerId
      description = `Completed sample task ${task.title}.`
      break
    }
    default: throw new Error('Unsupported sample CRM action.')
  }
  state.activity.unshift({ receipt, ownerId, action: event.type, description, ...(ownershipChange ? { ownershipChange } : {}) })
  state.sequence += 1
  return state
}
