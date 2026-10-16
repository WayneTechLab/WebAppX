import { crmActors, crmStages, type CrmActor, type CrmEvent, type CrmState, type CrmOwnershipChange, type CrmOpportunity } from './types'
import type { CrmCommand, CrmMergeSelection, CrmMergeChange, CrmMergeCounts, CrmMergeWarning, CrmSnapshot } from './merge-types'
import { assertCrmMergeActor, copyCrmMerge, crmMergeAssert as assert, crmMergeKeys, canonicalCrmMergeJson, normalizedCrmName } from './merge-value'
import { isCrmActiveGraph } from './legacy-validation'
export { crmActors, crmStages } from './types'
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

export function reduceCrmOrdinary(current: CrmState, actor: CrmActor, event: CrmEvent): CrmState {
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

const commandKeys: Record<string, string[]> = {
  'create-company': ['name'], 'create-contact': ['name', 'email', 'companyId'], 'create-lead': ['name', 'email', 'companyName'],
  'qualify-lead': ['leadId'], 'assign-lead': ['leadId', 'newOwnerId', 'expectedOwnerId'], 'convert-lead': ['leadId', 'amountCents'],
  'create-opportunity': ['title', 'companyId', 'contactId', 'amountCents'], 'advance-opportunity': ['opportunityId', 'stage'],
  'create-task': ['title', 'opportunityId'], 'complete-task': ['taskId'], 'transfer-account': ['companyId', 'newOwnerId', 'expectedOwnerId'],
}
export function canonicalizeCrmCommand(value: unknown): CrmCommand {
  assert(value && typeof value === 'object' && !Array.isArray(value))
  const kind = Object.getOwnPropertyDescriptor(value, 'kind'), type = Object.getOwnPropertyDescriptor(value, 'type')
  if (kind) {
    crmMergeKeys(value, ['kind', 'sourceId', 'retainedId', 'fieldPolicy'])
    assert((value.kind === 'contact' || value.kind === 'company') && value.fieldPolicy === 'retain-target-v1')
    assert(typeof value.sourceId === 'string' && typeof value.retainedId === 'string' && value.sourceId !== value.retainedId && value.sourceId.length <= 100 && value.retainedId.length <= 100)
    return { kind: value.kind, sourceId: value.sourceId, retainedId: value.retainedId, fieldPolicy: 'retain-target-v1' }
  }
  assert(type && 'value' in type && typeof type.value === 'string' && Object.hasOwn(commandKeys, type.value))
  const eventType = type.value, keys = commandKeys[eventType]
  crmMergeKeys(value, ['type', ...keys])
  const next: Record<string, unknown> = { type: eventType }
  for (const key of keys) {
    const field = value[key]
    if (['name', 'title', 'companyName'].includes(key)) next[key] = text(field as string, key === 'title' ? 'Title' : 'Name')
    else if (key === 'email') next[key] = email(field as string)
    else if (key === 'amountCents') next[key] = amount(field as number)
    else if (key === 'stage') { assert(typeof field === 'string' && (crmStages as readonly string[]).includes(field)); next[key] = field }
    else { assert(typeof field === 'string' && field.length > 0 && field.length <= 100 && field.trim() === field); next[key] = field }
  }
  return next as CrmCommand
}
export function readStoredCrmCommand(value: unknown): CrmCommand | null {
  try { const result = canonicalizeCrmCommand(value); return canonicalCrmMergeJson(result) === canonicalCrmMergeJson(value) ? result : null } catch { return null }
}
const sorted = <T extends { id: string }>(rows: T[]): T[] => rows.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
export function deriveCrmMerge(current: CrmSnapshot, actorValue: CrmActor, request: unknown): { change: CrmMergeChange; warnings: CrmMergeWarning[]; counts: CrmMergeCounts } {
  const actor = assertCrmMergeActor(actorValue)
  assert(actor.role !== 'auditor', 'This preview identity cannot apply CRM merges.', 'forbidden')
  const parsed = canonicalizeCrmCommand(request); assert('kind' in parsed)
  const selection: CrmMergeSelection = parsed
  const source = selection.kind === 'contact' ? current.contacts.find(r => r.id === selection.sourceId) : current.companies.find(r => r.id === selection.sourceId)
  const retained = selection.kind === 'contact' ? current.contacts.find(r => r.id === selection.retainedId) : current.companies.find(r => r.id === selection.retainedId)
  const unavailable = 'The selected CRM records cannot be merged. No records changed.'
  assert(source && retained && source.ownerId === retained.ownerId && (actor.role !== 'sales-rep' || source.ownerId === actor.id), unavailable, 'conflict')
  const commonOwnerId = source.ownerId
  const changes: CrmMergeChange['changes'] = { contacts: [], leads: [], opportunities: [] }
  const context: CrmMergeChange['context'] = { companies: [], contacts: [], leads: [], opportunities: [], tasks: [] }
  const warnings: CrmMergeWarning[] = []
  if (selection.kind === 'contact') {
    const s = current.contacts.find(r => r.id === source.id)!, r = current.contacts.find(r => r.id === retained.id)!
    const companyIds = new Set([s.companyId, r.companyId])
    context.companies = sorted(current.companies.filter(c => companyIds.has(c.id)))
    assert(context.companies.length === companyIds.size, unavailable, 'conflict')
    changes.opportunities = sorted(current.opportunities.filter(o => o.contactId === s.id)).map(before => ({ before, after: { ...before, contactId: r.id, companyId: r.companyId } }))
    changes.leads = sorted(current.leads.filter(l => l.status === 'converted' && l.contactId === s.id)).map(before => ({ before, after: { ...before, contactId: r.id, companyId: r.companyId, email: r.email } }))
    context.opportunities = sorted(current.opportunities.filter(o => o.contactId === r.id))
    context.leads = sorted(current.leads.filter(l => l.status === 'converted' && l.contactId === r.id))
  } else {
    const s = current.companies.find(r => r.id === source.id)!, r = current.companies.find(c => c.id === retained.id)!
    changes.contacts = sorted(current.contacts.filter(c => c.companyId === s.id)).map(before => ({ before, after: { ...before, companyId: r.id } }))
    changes.opportunities = sorted(current.opportunities.filter(o => o.companyId === s.id)).map(before => ({ before, after: { ...before, companyId: r.id } }))
    changes.leads = sorted(current.leads.filter(l => l.status === 'converted' && l.companyId === s.id)).map(before => ({ before, after: { ...before, companyId: r.id } }))
    context.contacts = sorted(current.contacts.filter(c => c.companyId === r.id))
    context.opportunities = sorted(current.opportunities.filter(o => o.companyId === r.id))
    context.leads = sorted(current.leads.filter(l => l.status === 'converted' && l.companyId === r.id))
    context.companies = sorted(current.companies.filter(c => c.id !== s.id && c.id !== r.id && c.ownerId === commonOwnerId && normalizedCrmName(c.name) === normalizedCrmName(r.name)))
    if (normalizedCrmName(s.name) === normalizedCrmName(r.name)) warnings.push({ kind: 'selected-name-match', normalizedName: normalizedCrmName(r.name), companyIds: [s.id, r.id].sort() })
    if (context.companies.length) warnings.push({ kind: 'company-name', normalizedName: normalizedCrmName(r.name), companyIds: [r.id, ...context.companies.map(c => c.id)].sort() })
    const names = new Map<string, typeof current.contacts>()
    for (const contact of current.contacts.filter(c => c.companyId === s.id || c.companyId === r.id)) { const name = normalizedCrmName(contact.name); names.set(name, [...(names.get(name) ?? []), contact]) }
    for (const name of [...names.keys()].sort()) {
      const contacts = sorted(names.get(name)!)
      if (contacts.length < 2) continue
      const companyCount = new Set(contacts.map(c => c.companyId)).size
      warnings.push({ kind: 'contact-name', normalizedName: name, classification: companyCount === 1 ? 'pre-existing' : contacts.length === 2 ? 'new-cross-company' : 'mixed', members: contacts.map(c => ({ contactId: c.id, originalCompanyId: c.companyId })) })
    }
  }
  const opportunityIds = new Set([...changes.opportunities.map(p => p.before.id), ...context.opportunities.map(o => o.id)])
  context.tasks = sorted(current.tasks.filter(t => opportunityIds.has(t.opportunityId)))
  const closure = new Map<string, { ownerId: string }>()
  closure.set(`${selection.kind}:${source.id}`, source); closure.set(`${selection.kind}:${retained.id}`, retained)
  for (const key of ['contacts', 'leads', 'opportunities'] as const) for (const pair of changes[key]) closure.set(`${key}:${pair.before.id}`, pair.before)
  for (const key of ['companies', 'contacts', 'leads', 'opportunities', 'tasks'] as const) for (const record of context[key]) closure.set(`${key === 'companies' ? 'company' : key === 'contacts' ? 'contact' : key}:${record.id}`, record)
  // source/retained and context never overlap except the intentionally deduplicated company pair.
  assert([...closure.values()].every(row => row.ownerId === commonOwnerId), unavailable, 'conflict')
  assert(closure.size <= 200, 'This CRM merge exceeds the 200-record review limit. No records changed.', 'limit')
  const changesById = new Map(changes.leads.map(p => [p.before.id, p.after]))
  const emails = new Set<string>()
  for (const lead of current.leads) { const address = (changesById.get(lead.id) ?? lead).email; assert(!emails.has(address), unavailable, 'conflict'); emails.add(address) }
  const change = { schemaVersion: 1 as const, kind: selection.kind, actorId: actor.id, sourceId: source.id, retainedId: retained.id, commonOwnerId, fieldPolicy: 'retain-target-v1' as const, source, retained, changes, context } as CrmMergeChange
  const counts: CrmMergeCounts = { retired: 1, retained: 1, changed: { contacts: changes.contacts.length, leads: changes.leads.length, opportunities: changes.opportunities.length }, context: { companies: context.companies.length, contacts: context.contacts.length, leads: context.leads.length, opportunities: context.opportunities.length, tasks: context.tasks.length }, reviewRecords: closure.size }
  return copyCrmMerge({ change, warnings, counts })
}
export function reduceCrmCommand(current: CrmSnapshot, actorValue: CrmActor, command: CrmCommand): { next: CrmSnapshot; receipt: string; command: CrmCommand } {
  const actor = assertCrmMergeActor(actorValue)
  let next: CrmSnapshot
  if ('kind' in command) {
    const { change } = deriveCrmMerge(current, actor, command)
    next = copyCrmMerge(current)
    const key = command.kind === 'contact' ? 'contacts' : 'companies'
    if (key === 'contacts') next.contacts = next.contacts.filter(row => row.id !== command.sourceId)
    else next.companies = next.companies.filter(row => row.id !== command.sourceId)
    for (const key of ['contacts', 'leads', 'opportunities'] as const) {
      const pairs = new Map<string, unknown>(change.changes[key].map(p => [p.before.id, p.after]))
      for (let i = 0; i < next[key].length; i++) if (pairs.has(next[key][i].id)) (next[key] as unknown[])[i] = copyCrmMerge(pairs.get(next[key][i].id))
    }
    const changed = change.changes.contacts.length + change.changes.leads.length + change.changes.opportunities.length
    next.activity.unshift({ receipt: `MOCK-CRM-${String(next.sequence).padStart(4, '0')}`, ownerId: change.commonOwnerId, action: command.kind === 'contact' ? 'merge-contact' : 'merge-company', description: `Merged sample ${command.kind} ${command.sourceId} into ${command.retainedId}; retained target fields and redirected ${changed} linked records.`, mergeChange: change })
    next.sequence++
  } else if (command.type === 'transfer-account') {
    assert(canManageCrmOwnership(actor), 'Only an owner or sales manager preview can change CRM ownership.', 'forbidden')
    next = structuredClone(current)
    const company = next.companies.find(row => row.id === command.companyId)
    const destination = crmActors.find(a => a.id === command.newOwnerId && a.role !== 'auditor')
    assert(company && destination && company.ownerId === command.expectedOwnerId && company.ownerId !== destination.id)
    assert(!next.companies.some(row => row.id !== company.id && row.ownerId === destination.id && row.name.toLowerCase() === company.name.toLowerCase()))
    const fromOwnerId = company.ownerId
    const affected = { companies: [company.id], contacts: next.contacts.filter(c => c.companyId === company.id).map(c => c.id), leads: next.leads.filter(l => l.status === 'converted' && l.companyId === company.id).map(l => l.id), opportunities: next.opportunities.filter(o => o.companyId === company.id).map(o => o.id), tasks: [] as string[] }
    affected.tasks = next.tasks.filter(t => affected.opportunities.includes(t.opportunityId)).map(t => t.id)
    assert(Object.values(affected).reduce((n, ids) => n + ids.length, 0) <= 200)
    for (const key of ['companies', 'contacts', 'leads', 'opportunities', 'tasks'] as const) for (const row of next[key]) if (affected[key].includes(row.id)) { assert(row.ownerId === fromOwnerId); row.ownerId = destination.id }
    const ownerName = (id: string) => crmActors.find(a => a.id === id)!.label.split(' · ')[0]
    next.activity.unshift({ receipt: `MOCK-CRM-${String(next.sequence).padStart(4, '0')}`, ownerId: destination.id, action: 'transfer-account', description: `Transferred sample account ${company.name} from ${ownerName(fromOwnerId)} to ${ownerName(destination.id)}; ${Object.values(affected).reduce((n, ids) => n + ids.length, 0)} linked records moved together.`, ownershipChange: { actorId: actor.id, fromOwnerId, toOwnerId: destination.id, recordId: company.id, affected } })
    next.sequence++
  } else next = reduceCrmOrdinary(current, actor, command)
  assert(isCrmActiveGraph(next), 'The complete CRM result failed graph validation. No records changed.')
  return { next, receipt: next.activity[0].receipt, command: copyCrmMerge(command) }
}
