/** Independent, hand-authored fictional CRM merge answers. No application
 * model, reducer, validator, projection, inspector or controller supplies these
 * expected records. Helpers assemble only the explicitly named fixture cases. */
export const fixtureLiteral = Object.freeze({
  "companies": [
    {
      "id": "company-harbor",
      "name": "Fictional Harbor Studio",
      "ownerId": "sales-riley"
    },
    {
      "id": "company-orbit",
      "name": "Fictional   Harbor Studio",
      "ownerId": "sales-sam"
    },
    {
      "id": "company-0001",
      "name": "Fictional  Harbor Studio",
      "ownerId": "sales-riley"
    },
    {
      "id": "company-0002",
      "name": "Fictional Harbor  Studio",
      "ownerId": "sales-riley"
    }
  ],
  "contacts": [
    {
      "id": "contact-avery",
      "name": "Mira  Sample",
      "email": "source@harbor.invalid",
      "companyId": "company-harbor",
      "ownerId": "sales-riley"
    },
    {
      "id": "contact-jordan",
      "name": "Jordan Example",
      "email": "jordan@orbit.invalid",
      "companyId": "company-orbit",
      "ownerId": "sales-sam"
    },
    {
      "id": "contact-0001",
      "name": "Mira Sample",
      "email": "other@harbor.invalid",
      "companyId": "company-harbor",
      "ownerId": "sales-riley"
    },
    {
      "id": "contact-0002",
      "name": "Mira Sample",
      "email": "retained@harbor.invalid",
      "companyId": "company-0001",
      "ownerId": "sales-riley"
    }
  ],
  "leads": [
    {
      "id": "lead-jules",
      "name": "Jules Sample",
      "email": "source@harbor.invalid",
      "companyName": "Original converted text stays exact",
      "ownerId": "sales-riley",
      "status": "converted",
      "companyId": "company-harbor",
      "contactId": "contact-avery",
      "opportunityId": "opportunity-harbor"
    },
    {
      "id": "lead-robin",
      "name": "Robin Fiction",
      "email": "robin@ridge.invalid",
      "companyName": "Fictional Harbor Studio",
      "ownerId": "sales-sam",
      "status": "qualified"
    }
  ],
  "opportunities": [
    {
      "id": "opportunity-harbor",
      "title": "Closed won source evidence",
      "companyId": "company-harbor",
      "contactId": "contact-avery",
      "ownerId": "sales-riley",
      "amountCents": 250000,
      "stage": "won",
      "leadId": "lead-jules"
    },
    {
      "id": "opportunity-orbit",
      "title": "Untouched Sam opportunity",
      "companyId": "company-orbit",
      "contactId": "contact-jordan",
      "ownerId": "sales-sam",
      "amountCents": 400000,
      "stage": "proposal"
    },
    {
      "id": "opportunity-0003",
      "title": "Closed lost retained evidence",
      "companyId": "company-0001",
      "contactId": "contact-0002",
      "ownerId": "sales-riley",
      "amountCents": 175025,
      "stage": "lost"
    }
  ],
  "tasks": [
    {
      "id": "task-harbor",
      "title": "Completed source follow-up",
      "ownerId": "sales-riley",
      "opportunityId": "opportunity-harbor",
      "status": "done"
    },
    {
      "id": "task-0003",
      "title": "Completed retained follow-up",
      "ownerId": "sales-riley",
      "opportunityId": "opportunity-0003",
      "status": "done"
    }
  ],
  "activity": [
    {
      "receipt": "MOCK-CRM-0003",
      "ownerId": "sales-riley",
      "action": "complete-task",
      "description": "Legacy imported fixture receipt three."
    },
    {
      "receipt": "MOCK-CRM-0002",
      "ownerId": "sales-riley",
      "action": "convert-lead",
      "description": "Legacy imported fixture receipt two."
    },
    {
      "receipt": "MOCK-CRM-0001",
      "ownerId": "sales-sam",
      "action": "advance-opportunity",
      "description": "Legacy imported fixture receipt one."
    }
  ],
  "sequence": 4
})
const copy = value => structuredClone(value)
export const selections = Object.freeze({
  contact: { kind: 'contact', sourceId: 'contact-avery', retainedId: 'contact-0002', fieldPolicy: 'retain-target-v1' },
  company: { kind: 'company', sourceId: 'company-harbor', retainedId: 'company-0001', fieldPolicy: 'retain-target-v1' },
  laterContact: { kind: 'contact', sourceId: 'contact-0002', retainedId: 'contact-0001', fieldPolicy: 'retain-target-v1' },
  samContact: { kind: 'contact', sourceId: 'contact-jordan', retainedId: 'contact-0002', fieldPolicy: 'retain-target-v1' },
})
export const counts = Object.freeze({
  contact: { retired: 1, retained: 1, changed: { contacts: 0, leads: 1, opportunities: 1 }, context: { companies: 2, contacts: 0, leads: 0, opportunities: 1, tasks: 2 }, reviewRecords: 9 },
  company: { retired: 1, retained: 1, changed: { contacts: 2, leads: 1, opportunities: 1 }, context: { companies: 1, contacts: 1, leads: 0, opportunities: 1, tasks: 2 }, reviewRecords: 11 },
  companyAfterContact: { retired: 1, retained: 1, changed: { contacts: 1, leads: 0, opportunities: 0 }, context: { companies: 1, contacts: 1, leads: 1, opportunities: 2, tasks: 2 }, reviewRecords: 10 },
  contactAfterCompany: { retired: 1, retained: 1, changed: { contacts: 0, leads: 1, opportunities: 1 }, context: { companies: 1, contacts: 0, leads: 0, opportunities: 1, tasks: 2 }, reviewRecords: 8 },
})
export const companyWarnings = Object.freeze([
  'selected-name-match · fictional harbor studio · company-0001, company-harbor',
  'company-name · fictional harbor studio · company-0001, company-0002',
  'contact-name · mira sample · mixed · contact-0001 in company-harbor; contact-0002 in company-0001; contact-avery in company-harbor',
])
export const description = Object.freeze({
  contact: 'Merged sample contact contact-avery into contact-0002; retained target fields and redirected 2 linked records.',
  company: 'Merged sample company company-harbor into company-0001; retained target fields and redirected 4 linked records.',
  companyAfterContact: 'Merged sample company company-harbor into company-0001; retained target fields and redirected 1 linked records.',
  laterContact: 'Merged sample contact contact-0002 into contact-0001; retained target fields and redirected 3 linked records.',
  samContact: 'Merged sample contact contact-jordan into contact-0002; retained target fields and redirected 1 linked records.',
})
export function fixtureA(seed, { open = false, collision = false } = {}) {
  const result = copy(seed); result.crm = copy(fixtureLiteral)
  if (open) { result.crm.opportunities[0].stage = 'discovery'; result.crm.tasks[0].status = 'open'; result.crm.tasks[1].status = 'open' }
  if (collision) result.crm.leads[1].email = 'retained@harbor.invalid'
  return result
}
const rec = (state, table, id) => copy(state[table].find(row => row.id === id))
const pair = (before, after) => ({ before: copy(before), after: copy(after) })
const actors = { 'crm-owner': 'owner', 'crm-manager': 'sales-manager', 'sales-riley': 'sales-rep', 'sales-sam': 'sales-rep' }
function capture(kind, actorId, source, retained, changes, context) {
  return { schemaVersion: 1, actorId, sourceId: source.id, retainedId: retained.id, commonOwnerId: source.ownerId, fieldPolicy: 'retain-target-v1', kind, source: copy(source), retained: copy(retained), changes: copy(changes), context: copy(context) }
}
function receipt(next, before, actorId, command, action, receiptDescription, extra = {}) {
  const nativeReceipt = `MOCK-CRM-${String(before.sequence).padStart(4, '0')}`
  next.activity = [{ receipt: nativeReceipt, ownerId: extra.mergeChange?.commonOwnerId ?? extra.ownerId ?? 'sales-riley', action, description: receiptDescription, ...(extra.mergeChange ? { mergeChange: copy(extra.mergeChange) } : {}), ...(extra.ownershipChange ? { ownershipChange: copy(extra.ownershipChange) } : {}) }, ...copy(before.activity)]
  next.sequence = before.sequence + 1
  const history = before.mergeHistory ? copy(before.mergeHistory) : { schemaVersion: 1, baseline: { kind: 'legacy-at-first-merge', ...copy(before) }, steps: [] }
  history.steps.push({ receipt: nativeReceipt, actor: { id: actorId, role: actors[actorId] }, command: copy(command) })
  next.mergeHistory = history
  return next
}
export function contactA(workspaces, actorId = 'crm-owner') {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  const source = rec(before, 'contacts', 'contact-avery'), retained = rec(before, 'contacts', 'contact-0002')
  const oldLead = rec(before, 'leads', 'lead-jules'), oldOpportunity = rec(before, 'opportunities', 'opportunity-harbor')
  const newLead = { ...oldLead, email: 'retained@harbor.invalid', companyId: 'company-0001', contactId: 'contact-0002' }
  const newOpportunity = { ...oldOpportunity, companyId: 'company-0001', contactId: 'contact-0002' }
  next.contacts = [rec(before, 'contacts', 'contact-jordan'), rec(before, 'contacts', 'contact-0001'), retained]
  next.leads = [newLead, rec(before, 'leads', 'lead-robin')]
  next.opportunities = [newOpportunity, rec(before, 'opportunities', 'opportunity-orbit'), rec(before, 'opportunities', 'opportunity-0003')]
  const companyContext = before.companies.some(row => row.id === 'company-harbor') ? [rec(before, 'companies', 'company-0001'), rec(before, 'companies', 'company-harbor')] : [rec(before, 'companies', 'company-0001')]
  const change = capture('contact', actorId, source, retained, { contacts: [], leads: [pair(oldLead, newLead)], opportunities: [pair(oldOpportunity, newOpportunity)] }, { companies: companyContext, contacts: [], leads: [], opportunities: [rec(before, 'opportunities', 'opportunity-0003')], tasks: [rec(before, 'tasks', 'task-0003'), rec(before, 'tasks', 'task-harbor')] })
  receipt(next, before, actorId, selections.contact, 'merge-contact', description.contact, { mergeChange: change })
  return result
}
export function companyA(workspaces, actorId = 'crm-owner') {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  const source = rec(before, 'companies', 'company-harbor'), retained = rec(before, 'companies', 'company-0001')
  const avery = rec(before, 'contacts', 'contact-avery'), other = rec(before, 'contacts', 'contact-0001')
  const lead = rec(before, 'leads', 'lead-jules'), opportunity = rec(before, 'opportunities', 'opportunity-harbor')
  const nextAvery = { ...avery, companyId: 'company-0001' }, nextOther = { ...other, companyId: 'company-0001' }, nextLead = { ...lead, companyId: 'company-0001' }, nextOpportunity = { ...opportunity, companyId: 'company-0001' }
  next.companies = [rec(before, 'companies', 'company-orbit'), retained, rec(before, 'companies', 'company-0002')]
  next.contacts = [nextAvery, rec(before, 'contacts', 'contact-jordan'), nextOther, rec(before, 'contacts', 'contact-0002')]
  next.leads = [nextLead, rec(before, 'leads', 'lead-robin')]
  next.opportunities = [nextOpportunity, rec(before, 'opportunities', 'opportunity-orbit'), rec(before, 'opportunities', 'opportunity-0003')]
  const change = capture('company', actorId, source, retained, { contacts: [pair(other, nextOther), pair(avery, nextAvery)], leads: [pair(lead, nextLead)], opportunities: [pair(opportunity, nextOpportunity)] }, { companies: [rec(before, 'companies', 'company-0002')], contacts: [rec(before, 'contacts', 'contact-0002')], leads: [], opportunities: [rec(before, 'opportunities', 'opportunity-0003')], tasks: [rec(before, 'tasks', 'task-0003'), rec(before, 'tasks', 'task-harbor')] })
  receipt(next, before, actorId, selections.company, 'merge-company', description.company, { mergeChange: change })
  return result
}
export function companyAfterContact(workspaces, actorId = 'crm-owner') {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  const source = rec(before, 'companies', 'company-harbor'), retained = rec(before, 'companies', 'company-0001')
  const contact = rec(before, 'contacts', 'contact-0001'), changed = { ...contact, companyId: 'company-0001' }
  next.companies = [rec(before, 'companies', 'company-orbit'), retained, rec(before, 'companies', 'company-0002')]
  next.contacts = [rec(before, 'contacts', 'contact-jordan'), changed, rec(before, 'contacts', 'contact-0002')]
  const change = capture('company', actorId, source, retained, { contacts: [pair(contact, changed)], leads: [], opportunities: [] }, { companies: [rec(before, 'companies', 'company-0002')], contacts: [rec(before, 'contacts', 'contact-0002')], leads: [rec(before, 'leads', 'lead-jules')], opportunities: [rec(before, 'opportunities', 'opportunity-0003'), rec(before, 'opportunities', 'opportunity-harbor')], tasks: [rec(before, 'tasks', 'task-0003'), rec(before, 'tasks', 'task-harbor')] })
  receipt(next, before, actorId, selections.company, 'merge-company', description.companyAfterContact, { mergeChange: change })
  return result
}
export function laterContact(workspaces, actorId = 'crm-owner') {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  const source = rec(before, 'contacts', 'contact-0002'), retained = rec(before, 'contacts', 'contact-0001')
  const lead = rec(before, 'leads', 'lead-jules'), oldHarbor = rec(before, 'opportunities', 'opportunity-harbor'), oldOther = rec(before, 'opportunities', 'opportunity-0003')
  const changedLead = { ...lead, email: 'other@harbor.invalid', companyId: 'company-harbor', contactId: 'contact-0001' }
  const changedHarbor = { ...oldHarbor, companyId: 'company-harbor', contactId: 'contact-0001' }, changedOther = { ...oldOther, companyId: 'company-harbor', contactId: 'contact-0001' }
  next.contacts = [rec(before, 'contacts', 'contact-jordan'), retained]
  next.leads = [changedLead, rec(before, 'leads', 'lead-robin')]
  next.opportunities = [changedHarbor, rec(before, 'opportunities', 'opportunity-orbit'), changedOther]
  const change = capture('contact', actorId, source, retained, { contacts: [], leads: [pair(lead, changedLead)], opportunities: [pair(oldOther, changedOther), pair(oldHarbor, changedHarbor)] }, { companies: [rec(before, 'companies', 'company-0001'), rec(before, 'companies', 'company-harbor')], contacts: [], leads: [], opportunities: [], tasks: [rec(before, 'tasks', 'task-0003'), rec(before, 'tasks', 'task-harbor')] })
  receipt(next, before, actorId, selections.laterContact, 'merge-contact', description.laterContact, { mergeChange: change })
  return result
}
export function ordinaryAfterContact(workspaces, stage) {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  let command, action, text
  if (stage === 'advance') { next.opportunities[0].stage = 'proposal'; command = { type: 'advance-opportunity', opportunityId: 'opportunity-harbor', stage: 'proposal' }; action = command.type; text = 'Moved Closed won source evidence to proposal.' }
  else if (stage === 'complete') { next.tasks[0].status = 'done'; command = { type: 'complete-task', taskId: 'task-harbor' }; action = command.type; text = 'Completed sample task Completed source follow-up.' }
  else if (stage === 'contact') { next.contacts.push({ id: 'contact-0007', name: 'After Merge Contact', email: 'after@harbor.invalid', companyId: 'company-0001', ownerId: 'sales-riley' }); command = { type: 'create-contact', name: 'After Merge Contact', email: 'after@harbor.invalid', companyId: 'company-0001' }; action = command.type; text = 'Created After Merge Contact at Fictional  Harbor Studio.' }
  else if (stage === 'opportunity') { next.opportunities.push({ id: 'opportunity-0008', title: 'After merge opportunity', companyId: 'company-0001', contactId: 'contact-0007', ownerId: 'sales-riley', amountCents: 123456, stage: 'discovery' }); command = { type: 'create-opportunity', title: 'After merge opportunity', companyId: 'company-0001', contactId: 'contact-0007', amountCents: 123456 }; action = command.type; text = 'Created sample opportunity After merge opportunity.' }
  else if (stage === 'task') { next.tasks.push({ id: 'task-0009', title: 'After merge task', opportunityId: 'opportunity-0008', ownerId: 'sales-riley', status: 'open' }); command = { type: 'create-task', title: 'After merge task', opportunityId: 'opportunity-0008' }; action = command.type; text = 'Assigned After merge task to the opportunity owner.' }
  else throw new Error('Only the five independently enumerated ordinary fixture steps are supported')
  receipt(next, before, 'crm-owner', command, action, text)
  return result
}
export function transferredTarget(workspaces) {
  const result = copy(workspaces), next = result.crm
  next.companies[2].ownerId = 'sales-sam'; next.contacts[3].ownerId = 'sales-sam'; next.opportunities[2].ownerId = 'sales-sam'; next.tasks[1].ownerId = 'sales-sam'
  next.activity.unshift({ receipt: 'MOCK-CRM-0004', ownerId: 'sales-sam', action: 'transfer-account', description: 'Transferred sample account Fictional  Harbor Studio from Riley Sample to Sam Fixture; 4 linked records moved together.', ownershipChange: { actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'company-0001', affected: { companies: ['company-0001'], contacts: ['contact-0002'], leads: [], opportunities: ['opportunity-0003'], tasks: ['task-0003'] } } })
  next.sequence = 5; return result
}
export function samContact(workspaces) {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  const source = rec(before, 'contacts', 'contact-jordan'), retained = rec(before, 'contacts', 'contact-0002'), old = rec(before, 'opportunities', 'opportunity-orbit')
  const changed = { ...old, companyId: 'company-0001', contactId: 'contact-0002' }
  next.contacts = [rec(before, 'contacts', 'contact-avery'), rec(before, 'contacts', 'contact-0001'), retained]
  next.opportunities = [rec(before, 'opportunities', 'opportunity-harbor'), changed, rec(before, 'opportunities', 'opportunity-0003')]
  const change = capture('contact', 'sales-sam', source, retained, { contacts: [], leads: [], opportunities: [pair(old, changed)] }, { companies: [rec(before, 'companies', 'company-0001'), rec(before, 'companies', 'company-orbit')], contacts: [], leads: [], opportunities: [rec(before, 'opportunities', 'opportunity-0003')], tasks: [rec(before, 'tasks', 'task-0003')] })
  receipt(next, before, 'sales-sam', selections.samContact, 'merge-contact', description.samContact, { mergeChange: change }); return result
}
export function returnedTarget(workspaces) {
  const result = copy(workspaces), before = workspaces.crm, next = result.crm
  next.companies[2].ownerId = 'sales-riley'; next.contacts[2].ownerId = 'sales-riley'; next.opportunities[1].ownerId = 'sales-riley'; next.opportunities[2].ownerId = 'sales-riley'; next.tasks[1].ownerId = 'sales-riley'
  const ownershipChange = { actorId: 'crm-owner', fromOwnerId: 'sales-sam', toOwnerId: 'sales-riley', recordId: 'company-0001', affected: { companies: ['company-0001'], contacts: ['contact-0002'], leads: [], opportunities: ['opportunity-orbit', 'opportunity-0003'], tasks: ['task-0003'] } }
  receipt(next, before, 'crm-owner', { type: 'transfer-account', companyId: 'company-0001', newOwnerId: 'sales-riley', expectedOwnerId: 'sales-sam' }, 'transfer-account', 'Transferred sample account Fictional  Harbor Studio from Sam Fixture to Riley Sample; 5 linked records moved together.', { ownerId: 'sales-riley', ownershipChange }); return result
}
export function pagingFixture(seed, { members = false } = {}) {
  const result = copy(seed), crm = result.crm
  const groups = members ? 1 : 21, size = members ? 51 : 2
  let numeric = 1
  for (let group = 1; group <= groups; group++) for (let member = 1; member <= size; member++) crm.companies.push({ id: `company-${String(numeric++).padStart(4, '0')}`, name: `${members ? 'Member' : `Group ${String(group).padStart(2, '0')}`} ${' '.repeat(member)}Fixture`, ownerId: 'sales-riley' })
  crm.sequence = numeric
  crm.activity = Array.from({ length: numeric - 1 }, (_, index) => ({ receipt: `MOCK-CRM-${String(numeric - 1 - index).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-company', description: 'Legacy paging fixture receipt; no reconstructed history is claimed.' }))
  return result
}
export function malformedImports(seed) {
  const good = contactA(fixtureA(seed)), cases = []
  const changed = (name, mutate) => { const value = copy(good.crm); mutate(value); cases.push([name, value]) }
  changed('null-history', value => { value.mergeHistory = null })
  changed('unknown-schema', value => { value.mergeHistory.schemaVersion = 2 })
  changed('unknown-history-key', value => { value.mergeHistory.aliases = {} })
  changed('missing-step', value => { value.mergeHistory.steps = [] })
  changed('wrong-receipt', value => { value.mergeHistory.steps[0].receipt = 'MOCK-CRM-0005' })
  changed('baseline-field', value => { value.mergeHistory.baseline.contacts[0].name = 'Changed false capture' })
  changed('old-activity', value => { value.activity.at(-1).description = 'Changed old receipt text.' })
  changed('capture-retained', value => { value.activity[0].mergeChange.retained.email = 'changed@false.invalid' })
  changed('omitted-context', value => { value.activity[0].mergeChange.context.tasks.pop() })
  changed('extra-context', value => { value.activity[0].mergeChange.context.contacts.push(copy(fixtureLiteral.contacts[2])) })
  changed('forged-actor', value => { value.mergeHistory.steps[0].actor = { id: 'sales-sam', role: 'sales-rep' } })
  changed('future-generated-id', value => { value.mergeHistory.baseline.contacts[2].id = 'contact-0099' })
  changed('resurrect-source', value => { value.contacts.unshift(copy(fixtureLiteral.contacts[0])) })
  changed('retired-selection', value => { value.mergeHistory.steps[0].command.retainedId = 'contact-avery' })
  changed('final-record', value => { value.opportunities[0].amountCents = 250001 })
  changed('command-shape', value => { value.mergeHistory.steps[0].command.unknown = true })
  return cases
}
/** Fixed review-boundary witnesses: A has nine distinct contact-review rows;
 * exactly 191/192 additional same-opportunity done tasks yields 200/201. */
export function closureFixture(seed, size) {
  if (![200, 201].includes(size)) throw new Error('Only the two declared review-boundary fixtures are supported')
  const result = fixtureA(seed), crm = result.crm
  for (let index = 0; index < (size === 200 ? 191 : 192); index++) crm.tasks.push({ id: `task-${String(index + 4).padStart(4, '0')}`, title: `Completed bounded review task ${index + 1}`, ownerId: 'sales-riley', opportunityId: 'opportunity-harbor', status: 'done' })
  crm.sequence = 500
  crm.activity = Array.from({ length: 499 }, (_, index) => ({ receipt: `MOCK-CRM-${String(499 - index).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'complete-task', description: 'Legacy review-boundary fixture receipt; no reconstructed history is claimed.' }))
  return result
}
/** Separate legacy-cap witness. Existing legacy acceptance permits 10,000 old
 * activity rows; a later ordinary action is not a merge-history adoption. */
export function legacyActivityBoundary(seed) {
  const result = copy(seed)
  result.crm.sequence = 10001
  result.crm.activity = Array.from({ length: 10000 }, (_, index) => ({ receipt: `MOCK-CRM-${String(10000 - index).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-company', description: 'Legacy bounded fixture receipt.' }))
  return result
}
export function legacyBeyondMergeBoundary(workspaces) {
  const result = copy(workspaces)
  result.crm.companies.push({ id: 'company-10001', name: 'Beyond merge inspection bound', ownerId: 'crm-owner' })
  result.crm.activity.unshift({ receipt: 'MOCK-CRM-10001', ownerId: 'crm-owner', action: 'create-company', description: 'Created sample company Beyond merge inspection bound.' })
  result.crm.sequence = 10002
  return result
}
