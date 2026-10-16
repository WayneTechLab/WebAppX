import type { HrActor, HrFixture } from './model'
import type { MockPayroll, MockSamplePeriod } from './mock-workflows'
import type { HrDemoState } from './persistence'

/** Portable authority is the event stream; preview handles never enter saved state. */
export type PayrollMoney = { grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number }
export type PayrollWriter = { role: 'employer-owner' | 'payroll-admin'; employeeId?: string }
export type PayrollReceiptAnchor = { receipt: string; snapshot: MockPayroll }
export type PayrollControlBase = { id: string; sequence: number; actor: PayrollWriter; recordedOn: string; reason: string }
export type PayrollPeriodClosed = PayrollControlBase & { kind: 'period-closed'; period: MockSamplePeriod; receiptIds: string[] }
export type PayrollAdjusted = PayrollControlBase & { kind: 'receipt-adjusted'; adjustmentReceipt: string; originalReceipt: string; employeeId: string; previousAdjustmentId: string | null; previous: PayrollMoney; proposed: PayrollMoney; delta: PayrollMoney }
export type PayrollControlEvent = PayrollPeriodClosed | PayrollAdjusted
export type MockPayrollControlV1 = { schemaVersion: 1; sequence: number; anchors: PayrollReceiptAnchor[]; events: PayrollControlEvent[] }
export type MockPayrollControl = MockPayrollControlV1
export type PayrollControlCommand =
  | { kind: 'close-period'; period: MockSamplePeriod; recordedOn: string; reason: string }
  | { kind: 'adjust-receipt'; originalReceipt: string; employeeId: string; recordedOn: string; reason: string; proposed: Omit<PayrollMoney, 'netCents'> }
export type PayrollControlRefusal = { ok: false; code: 'invalid' | 'unavailable' | 'stale' | 'limit'; message: string }
export type PayrollClosureSummary = { id: string; period: MockSamplePeriod; receiptIds: string[]; recordedOn: string }
export type PayrollAdjustmentSummary = { id: string; adjustmentReceipt: string; originalReceipt: string; employeeId: string; recordedOn: string; previousAdjustmentId: string | null; original: PayrollMoney; previous: PayrollMoney; proposed: PayrollMoney; delta: PayrollMoney; reason: string }
export type PayrollReceiptChoice = { receipt: string; period: MockSamplePeriod | null; employees: { employeeId: string; original: PayrollMoney; cumulative: PayrollMoney }[] }
export type PayrollControlView =
  | { mode: 'writer'; closures: PayrollClosureSummary[]; adjustments: PayrollAdjustmentSummary[]; receipts: PayrollReceiptChoice[] }
  | { mode: 'own'; employeeId: string; adjustments: PayrollAdjustmentSummary[] }
  | { mode: 'auditor'; closures: PayrollClosureSummary[]; adjustments: { id: string; adjustmentReceipt: string; originalReceipt: string; employeeId: string; recordedOn: string }[]; anchorCount: number; eventCount: number }
export type PayrollControlPreview =
  | { kind: 'close-period'; period: MockSamplePeriod; receiptIds: string[]; entryCount: number; pendingPayrollBecomesStale: boolean; recordedOn: string; reason: string; effect: string }
  | { kind: 'adjust-receipt'; originalReceipt: string; employeeId: string; period: MockSamplePeriod | null; previousAdjustmentId: string | null; original: PayrollMoney; previous: PayrollMoney; proposed: PayrollMoney; delta: PayrollMoney; recordedOn: string; reason: string; effect: string }
export type PayrollControlHandle = string & { readonly __payrollControlHandle: unique symbol }
export type PayrollControlPreviewResult = { ok: true; handle: PayrollControlHandle; preview: PayrollControlPreview } | PayrollControlRefusal
export type PayrollControlConfirmRequest = { kind: PayrollControlCommand['kind']; handle: PayrollControlHandle }
export type PayrollControlConfirmResult = { ok: true; feedback: string; view: PayrollControlView } | PayrollControlRefusal
export type PayrollControlServices = { validateCandidate: (state: HrDemoState, raw: HrFixture) => boolean }
export type PayrollControlControllerOptions = {
  readCurrent: () => HrDemoState; readRawFixture: () => HrFixture; readActor: () => HrActor;
  readEpoch: () => number; readModeGeneration: () => number; monotonicNow: () => number;
  randomBytes: (length: number) => Uint8Array;
  replaceCurrent: (update: (latest: HrDemoState) => HrDemoState) => boolean;
  services: PayrollControlServices;
}
/** Closure's dirty decision is a separate trusted host capability; queueing must not call confirm. */
export type PayrollControlPort = {
  view: () => PayrollControlView | PayrollControlRefusal;
  preview: (command: PayrollControlCommand) => PayrollControlPreviewResult;
  confirm: (request: PayrollControlConfirmRequest) => PayrollControlConfirmResult;
  cancel: (handle: PayrollControlHandle) => void;
}
export type PayrollControlController = PayrollControlPort & { clear: () => void; dispose: () => void }
