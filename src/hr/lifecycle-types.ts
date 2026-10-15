import type { HrActor } from './model'
import type { MockOnboarding } from './mock-workflows'

export type HrChecklistTask = { id: string; title: string }
export type HrEmploymentSnapshot = { status: string; department: string; jobTitle: string; managerId: string | null }
export type HrRecruitingBaseline = {
  kind: 'recruiting-baseline'; hireBindingId: string; capturedOnboarding: MockOnboarding;
  completion: { actor: 'unknown'; effectiveDate: null } | null;
}
export type HrEmploymentInstance = {
  id: string; employeeId: string; startDate: string | null; endDate: string | null;
  previousInstanceId?: string; initial: HrEmploymentSnapshot; current: HrEmploymentSnapshot;
  templateVersion: string; tasks: HrChecklistTask[]; archivedOnboarding?: MockOnboarding;
  recruitingBaseline?: HrRecruitingBaseline;
}
export type HrLifecycleEvent = {
  id: string; sequence: number; kind: 'transfer' | 'leave' | 'return' | 'terminate' | 'rehire' | 'onboarding-complete' | 'select-template' | 'hire' | 'set-simulation-date';
  employeeId?: string; instanceId?: string; effectiveDate: string | null; actor: HrActor; reason: string;
  previous: HrEmploymentSnapshot | string | null; proposed: HrEmploymentSnapshot | string;
}
export type HrDirectoryChange = { id: string; sequence: number; employeeId: string; field: 'workEmail'; oldValue: string; newValue: string; actor: HrActor; origin: 'direct' | 'correction'; correctionId?: string }
export type HrCorrectionRequest = {
  id: string; sequence: number; employeeId: string; instanceId: string; field: 'workEmail'; oldValue: string; proposedValue: string;
  status: 'pending' | 'accepted' | 'rejected'; actor: HrActor;
  outcome?: { sequence: number; actor: HrActor; reason: string };
}
export type HrOffboardingAssignment = { id: string; employeeId: string; instanceId: string; transitionId: string; kind: 'asset' | 'access' | 'handover'; title: string; status: 'assigned' }
export type HrLifecycleState = {
  schemaVersion: 1; simulationDate: string | null; sequence: number; selectedTemplateVersion: string;
  instances: HrEmploymentInstance[]; activeInstances: Record<string, string>; events: HrLifecycleEvent[];
  directoryHistory: HrDirectoryChange[]; corrections: HrCorrectionRequest[]; offboardingAssignments: HrOffboardingAssignment[];
}
export type HrLifecycleAction =
  | { type: 'transfer'; employeeId: string; department: string; managerId: string | null; effectiveDate: string; simulationDate: string }
  | { type: 'leave' | 'return' | 'terminate'; employeeId: string; reason: string; effectiveDate: string; simulationDate: string }
  | { type: 'rehire'; employeeId: string; department: string; jobTitle: string; managerId: string | null; startDate: string; simulationDate: string }
  | { type: 'set-simulation-date'; simulationDate: string }
  | { type: 'select-template'; templateVersion: string; simulationDate: string }
  | { type: 'request-correction'; employeeId: string; workEmail: string; simulationDate: string }
  | { type: 'edit-directory'; employeeId: string; workEmail: string; simulationDate: string }
  | { type: 'review-correction'; correctionId: string; outcome: 'accepted' | 'rejected'; reason: string; simulationDate: string }
export type HrLifecyclePreview = {
  confirmation: string; action: HrLifecycleAction; employeeId?: string; instanceId?: string;
  previous?: HrEmploymentSnapshot | string | null; proposed?: HrEmploymentSnapshot | string;
  scopeChanges?: { managerId: string; previousReportIds: string[]; proposedReportIds: string[] }[];
  offboarding?: HrOffboardingAssignment[];
  rehire?: { retainedEmployeeId: string; priorInstanceId: string; newInstanceId: string; templateVersion: string; tasks: HrChecklistTask[] };
  policy: string;
}
