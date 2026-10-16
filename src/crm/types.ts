/** Neutral fictional CRM records and fixed catalog. No browser, storage or provider imports. */
import type { CrmMergeChange, CrmMergeHistoryV1 } from './merge-types'
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
export type CrmLegacyActivity = { receipt: string; ownerId: string; action: string; description: string; ownershipChange?: CrmOwnershipChange; mergeChange?: never }
export type CrmMergeActivity = { receipt: string; ownerId: string; action: 'merge-contact' | 'merge-company'; description: string; mergeChange: CrmMergeChange; ownershipChange?: never }
export type CrmActivity = CrmLegacyActivity | CrmMergeActivity
export type CrmRecordTables = { companies: CrmCompany[]; contacts: CrmContact[]; leads: CrmLead[]; opportunities: CrmOpportunity[]; tasks: CrmTask[] }
export type CrmState = { companies: CrmCompany[]; contacts: CrmContact[]; leads: CrmLead[]; opportunities: CrmOpportunity[]; tasks: CrmTask[]; activity: CrmActivity[]; sequence: number; mergeHistory?: CrmMergeHistoryV1 }
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

