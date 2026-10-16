import { canManageCrmOwnership } from './kernel'
import { crmActors, type CrmActor, type CrmOwnershipAffected, type CrmState } from './types'
import { applyCrmCommand } from './merge-history'
import { isCrmState } from './persistence'

export type CrmOwnershipSelection =
  | { kind: 'lead-assignment'; leadId: string; newOwnerId: string }
  | { kind: 'account-transfer'; companyId: string; newOwnerId: string }
export type CrmOwnershipRow = { kind: 'company' | 'contact' | 'lead' | 'opportunity' | 'task'; id: string; label: string; fromOwnerId: string; toOwnerId: string }
type Refusal = { ok: false; status: 'refused'; message: string }
export type CrmOwnershipPreview = Refusal | {
  ok: true; status: 'ready'; selection: CrmOwnershipSelection; actorId: string; fromOwnerId: string; toOwnerId: string;
  rows: CrmOwnershipRow[]; affected: CrmOwnershipAffected; warnings: string[]; confirmation: string;
}
export type CrmOwnershipResult = Refusal | { ok: true; state: CrmState; receipt: string }
export const CRM_OWNERSHIP_PREVIEW_LIMIT = 200
const refusal = (message: string): Refusal => ({ ok: false, status: 'refused', message })
const emptyAffected = (): CrmOwnershipAffected => ({ companies: [], contacts: [], leads: [], opportunities: [], tasks: [] })

function selectionValue(value: unknown): CrmOwnershipSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  const key = data.kind === 'lead-assignment' ? 'leadId' : data.kind === 'account-transfer' ? 'companyId' : null
  if (!key || Object.keys(data).length !== 3 || !['kind', key, 'newOwnerId'].every(name => Object.hasOwn(data, name)) || typeof data[key] !== 'string' || typeof data.newOwnerId !== 'string') return null
  return key === 'leadId' ? { kind: 'lead-assignment', leadId: data[key] as string, newOwnerId: data.newOwnerId } : { kind: 'account-transfer', companyId: data[key] as string, newOwnerId: data.newOwnerId }
}

/** The full validated workspace is required. A representative's projection is
 * never reconstructed into authority to inspect or change a hidden graph. */
export function previewCrmOwnership(current: unknown, actor: CrmActor, request: unknown): CrmOwnershipPreview {
  if (!canManageCrmOwnership(actor)) return refusal('Only an owner or sales manager preview can review CRM ownership changes.')
  try {
    if (!isCrmState(current)) return refusal('A complete valid CRM workspace is required. No ownership preview is available.')
    const selection = selectionValue(request)
    if (!selection || !crmActors.some(candidate => candidate.id === selection.newOwnerId && candidate.role !== 'auditor')) return refusal('Choose a supported record and fictional assignee.')
    const rows: CrmOwnershipRow[] = [], affected = emptyAffected()
    const add = (kind: CrmOwnershipRow['kind'], group: keyof CrmOwnershipAffected, record: { id: string; ownerId: string }, label: string) => {
      affected[group].push(record.id)
      rows.push({ kind, id: record.id, label, fromOwnerId: record.ownerId, toOwnerId: selection.newOwnerId })
    }
    let fromOwnerId: string
    const warnings: string[] = ['Historical activity keeps its recorded ownership and text. A new receipt records both fictional assignees. No provider or customer notification is sent.']
    if (selection.kind === 'lead-assignment') {
      const lead = current.leads.find(record => record.id === selection.leadId)
      if (!lead || lead.status === 'converted') return refusal('Choose an unconverted lead. Converted records move through account ownership transfer.')
      fromOwnerId = lead.ownerId
      add('lead', 'leads', lead, lead.name)
      warnings.push('Only this unconverted lead moves. No company, contact, opportunity or follow-up is created or transferred.')
    } else {
      const company = current.companies.find(record => record.id === selection.companyId)
      if (!company) return refusal('Choose an available sample company.')
      fromOwnerId = company.ownerId
      if (current.companies.some(record => record.id !== company.id && record.ownerId === selection.newOwnerId && record.name.toLowerCase() === company.name.toLowerCase())) return refusal('The destination already owns a company with this name. Resolve the duplicate before transferring; no records changed.')
      add('company', 'companies', company, company.name)
      for (const contact of current.contacts.filter(record => record.companyId === company.id)) add('contact', 'contacts', contact, contact.name)
      for (const lead of current.leads.filter(record => record.status === 'converted' && record.companyId === company.id)) add('lead', 'leads', lead, lead.name)
      const opportunities = current.opportunities.filter(record => record.companyId === company.id)
      for (const opportunity of opportunities) add('opportunity', 'opportunities', opportunity, opportunity.title)
      const opportunityIds = new Set(opportunities.map(record => record.id))
      for (const task of current.tasks.filter(record => opportunityIds.has(record.opportunityId))) add('task', 'tasks', task, task.title)
      warnings.push('All linked contacts, converted leads, opportunities and follow-ups move, including closed opportunities and completed tasks.')
      warnings.push('Unconverted leads have no account links and do not move. Company-name text is not a graph link; reassign those leads separately.')
    }
    if (fromOwnerId === selection.newOwnerId) return refusal('This record already belongs to that fictional assignee. No-op ownership changes are refused.')
    if (rows.length > CRM_OWNERSHIP_PREVIEW_LIMIT) return refusal(`This graph exceeds the ${CRM_OWNERSHIP_PREVIEW_LIMIT}-record review limit. The entire operation is refused; no partial transfer is available.`)
    const confirmation = JSON.stringify({ format: 'webappx-crm-ownership-preview', schemaVersion: 1, actor: { id: actor.id, role: actor.role }, selection, current })
    return { ok: true, status: 'ready', selection, actorId: actor.id, fromOwnerId, toOwnerId: selection.newOwnerId, rows, affected, warnings, confirmation }
  } catch { return refusal('The CRM ownership preview could not be verified. No records changed.') }
}

/** Compare every reviewed fact before cloning or creating any receipt. The
 * caller accepts this one complete result, or retains its exact prior state. */
export function applyCrmOwnership(current: unknown, actor: CrmActor, selection: unknown, confirmation: unknown): CrmOwnershipResult {
  const preview = previewCrmOwnership(current, actor, selection)
  if (!preview.ok) return preview
  if (typeof confirmation !== 'string' || confirmation !== preview.confirmation) return refusal('The workspace, identity or selection changed. Review a fresh ownership preview; no records changed.')
  const accepted = current as CrmState
  let next: CrmState
  try {
    const command = preview.selection.kind === 'lead-assignment'
      ? { type: 'assign-lead' as const, leadId: preview.selection.leadId, newOwnerId: preview.toOwnerId, expectedOwnerId: preview.fromOwnerId }
      : { type: 'transfer-account' as const, companyId: preview.selection.companyId, newOwnerId: preview.toOwnerId, expectedOwnerId: preview.fromOwnerId }
    next = applyCrmCommand(accepted, actor, command).state
  } catch { return refusal('The entire ownership result failed graph validation. No records or receipts were accepted.') }
  if (!isCrmState(next)) return refusal('The entire ownership result failed graph validation. No records or receipts were accepted.')
  return { ok: true, state: next, receipt: next.activity[0].receipt }
}
