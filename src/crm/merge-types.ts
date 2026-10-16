import type { CrmActor, CrmCompany, CrmContact, CrmEvent, CrmLead, CrmOpportunity, CrmState, CrmTask } from './types'
export type CrmMergeSelection = { kind: 'contact' | 'company'; sourceId: string; retainedId: string; fieldPolicy: 'retain-target-v1' }
export type CrmCompactActor = Pick<CrmActor, 'id' | 'role'>
export type CrmAccountTransferCommand = { type: 'transfer-account'; companyId: string; newOwnerId: string; expectedOwnerId: string }
export type CrmCommand = CrmEvent | CrmAccountTransferCommand | CrmMergeSelection
export type CrmSnapshot = Omit<CrmState, 'mergeHistory'>
export type CrmPair<T> = { before: T; after: T }
export type CrmMergeChanges = { contacts: CrmPair<CrmContact>[]; leads: CrmPair<CrmLead>[]; opportunities: CrmPair<CrmOpportunity>[] }
export type CrmMergeContext = { companies: CrmCompany[]; contacts: CrmContact[]; leads: CrmLead[]; opportunities: CrmOpportunity[]; tasks: CrmTask[] }
export type CrmMergeChange = { schemaVersion: 1; actorId: string; sourceId: string; retainedId: string; commonOwnerId: string; fieldPolicy: 'retain-target-v1'; changes: CrmMergeChanges; context: CrmMergeContext } & ({ kind: 'contact'; source: CrmContact; retained: CrmContact } | { kind: 'company'; source: CrmCompany; retained: CrmCompany })
export type CrmMergeReceipt = CrmMergeChange
export type CrmMergeStep = { receipt: string; actor: CrmCompactActor; command: CrmCommand }
export type CrmMergeHistoryV1 = { schemaVersion: 1; baseline: CrmSnapshot & { kind: 'legacy-at-first-merge' }; steps: CrmMergeStep[] }
export type CrmMergeCounts = { retired: number; retained: number; changed: { contacts: number; leads: number; opportunities: number }; context: { companies: number; contacts: number; leads: number; opportunities: number; tasks: number }; reviewRecords: number }
export type CrmMergeWarning = { kind: 'selected-name-match' | 'company-name'; normalizedName: string; companyIds: string[] } | { kind: 'contact-name'; normalizedName: string; classification: 'pre-existing' | 'new-cross-company' | 'mixed'; members: { contactId: string; originalCompanyId: string }[] }
export type CrmMergePreview = { schemaVersion: 1; selection: CrmMergeSelection; commonOwnerId: string; capture: CrmMergeChange; counts: CrmMergeCounts; warnings: CrmMergeWarning[]; proposedReceipt: string; finalEnvelopeCharacters: number; effect: string }
