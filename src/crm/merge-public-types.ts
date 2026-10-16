import type { CrmActor, CrmActivity, CrmLegacyActivity, CrmMergeActivity, CrmRecordTables, CrmState } from './types'
import type { CrmMergeCounts, CrmMergePreview as CrmCoreMergePreview, CrmMergeSelection } from './merge-types'

export type CrmMergeHandle = string & { readonly __crmMergeHandle: unique symbol }
export type CrmRefusal = { ok: false; code: string; message: string }
export type CrmResult<T> = { ok: true; value: T } | CrmRefusal
export type CrmPageRequest = { page: number; pageSize: number; scopeVersion: number }
export type CrmPage<T> = { schemaVersion: 1; scopeVersion: number; status: 'empty' | 'page'; page: number; pageSize: number; accessibleCount: number; returnedCount: number; hasMore: boolean; rows: T[] }
export type CrmDuplicateGroupKey = { reason: 'company-name' | 'email'; normalizedKey: string }
export type CrmDuplicateMember = { kind: 'company' | 'contact' | 'lead'; id: string; ownerId: string; label: string; companyId?: string }
export type CrmDuplicateGroup = { key: CrmDuplicateGroupKey; classification: 'candidate' | 'expected-conversion-link' | 'cross-owner-ineligible'; members: CrmPage<CrmDuplicateMember> }
export type CrmGroupMembersRequest = CrmPageRequest & { group: CrmDuplicateGroupKey }
export type CrmChoiceRequest = CrmPageRequest & { kind: 'contact' | 'company'; selectedIds?: string[] }
export type CrmMergeChoice = { kind: 'contact' | 'company'; id: string; label: string; ownerId: string }
export type CrmChoicePage = CrmPage<CrmMergeChoice> & { selected: ({ id: string; available: false } | { id: string; available: true; choice: CrmMergeChoice })[] }
export type CrmMergePreview = CrmCoreMergePreview & { scopeVersion: number }
export type CrmMergeSafeActivity = { receipt: string; ownerId: string; action: 'merge-contact' | 'merge-company'; description: string; mergeSummary: { schemaVersion: 1; kind: 'contact' | 'company'; sourceId: string; retainedId: string; commonOwnerId: string; fieldPolicy: 'retain-target-v1'; counts: CrmMergeCounts } }
export type CrmActivityView = CrmLegacyActivity | CrmMergeActivity | CrmMergeSafeActivity
export type CrmScopedState = CrmRecordTables & { activity: CrmActivityView[]; sequence: 0 }
export type CrmMergeHistoryRow = { mode: 'full'; activity: Extract<CrmActivity, { mergeChange: unknown }> } | { mode: 'recorded-owner-summary'; activity: CrmMergeSafeActivity }
export type CrmMergeView = { status: 'ready'; scopeVersion: number; mode: 'writer' | 'read-only'; historyPolicy: 'full-capture' | 'recorded-owner-summary'; notice: string }
export type CrmMergePreviewResult = { ok: true; handle: CrmMergeHandle; preview: CrmMergePreview } | CrmRefusal
export type CrmMergeConfirmResult = { ok: true; receipt: string; feedback: string; view: CrmMergeView } | CrmRefusal
export interface CrmMergePort {
  view(): CrmResult<CrmMergeView>
  report(request: CrmPageRequest): CrmResult<CrmPage<CrmDuplicateGroup>>
  groupMembers(request: CrmGroupMembersRequest): CrmResult<CrmPage<CrmDuplicateMember>>
  choices(request: CrmChoiceRequest): CrmResult<CrmChoicePage>
  history(request: CrmPageRequest): CrmResult<CrmPage<CrmMergeHistoryRow>>
  preview(selection: CrmMergeSelection): CrmMergePreviewResult
  confirm(request: { kind: 'contact' | 'company'; handle: CrmMergeHandle }): CrmMergeConfirmResult
  cancel(handle: CrmMergeHandle): void
}
export type CrmMergeControllerOptions = { readCurrent: () => unknown; readActor: () => unknown; readEpoch: () => number; readModeGeneration: () => number; readActive: () => boolean; retainInactiveReadProjection?: boolean; replaceCurrent: (update: (latest: CrmState) => CrmState) => boolean; randomBytes: (length: 32) => Uint8Array; monotonicNow: () => number }
export interface CrmMergeController extends CrmMergePort { clear(): void; dispose(): void }
export type CrmMergeActor = CrmActor
