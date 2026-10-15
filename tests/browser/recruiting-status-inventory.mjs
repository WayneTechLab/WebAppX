/** Literal native recruiting meanings. The older native 151 and lifecycle 46
 * inventories remain separate; no render fixtures count as observations here. */
export const recruitingStatusInventory = Object.freeze({
  adoption: { preview: 'Ready for explicit confirmation', canceled: 'Preview canceled. No recruiting records were changed; your inputs are kept.', legacy: 'Legacy publication; no recorded approval' },
  requisition: { draft: 'rrequisition-0001 · revision 1 · draft', requested: 'rrequisition-0001 · revision 1 · in-review', rejected: 'rrequisition-0001 · revision 1 · rejected', approved: 'rrequisition-0001 · revision 1 · approved', preview: 'Review fictional recruiting action' },
  publication: { draft: 'Fictional research specialist · draft', published: 'Fictional research specialist · published', closed: 'Fictional research specialist · closed' },
  application: { conflict: 'Review the existing identity', separate: 'rapplication-0004 · Person rperson-0003', screening: 'Application stage: screening', interview: 'Application stage: interview', offer: 'Application stage: offer', reasonRequired: 'Enter a sample reason for rejection or withdrawal.', rejected: 'This application is rejected.', withdrawn: 'This application is withdrawn.', hired: 'This application is hired.' },
  duration: { unknown: 'Unknown legacy duration', omitted: 'No observation instant supplied.', explicit: 'Duration view requested with observation UTC time 2026-10-15T15:00:00.000Z.', closed: '7200000 ms', open: '3600000 ms' },
  interview: { preview: 'America/Los_Angeles', recorded: 'rinterview-0001', emptySubmitted: 'No scorecard has been explicitly submitted.', ownBoundary: 'Fictional interviewer preview' },
  ownScorecard: { savePreview: 'Own draft save preview', submissionPreview: 'Own scorecard submission preview', stale: 'This recruiting preview expired or changed. Preview again; your inputs are kept.', timeRefused: 'Choose a recorded time at or after your previous scorecard action for this interview.', submitted: 'Revision 1 is immutable in this local preview.' },
  hire: { exact: 'Review every new hire record', absent: 'No employment instance or employment event will be created by this hire.', v2: 'sample-v2', originalComplete: 'MOCK-ONBOARDING-0001', baseline: 'employment-employee-rperson-0001-1' },
  recovery: { legacy: 'Replace HR workspace', selected: 'Restore selected workspaces', undo: 'Confirm undo' },
})
export const recruitingStatusSources = Object.freeze({
  adoption: 'src/hr/components/HrRecruitingApplications.tsx', requisition: 'src/hr/components/HrRecruitingRequisitions.tsx', publication: 'src/hr/components/HrRecruitingRequisitions.tsx', application: 'src/hr/components/HrRecruitingApplications.tsx', duration: 'src/hr/components/HrRecruitingApplications.tsx', interview: 'src/hr/components/HrRecruitingInterviews.tsx', ownScorecard: 'src/hr/components/HrRecruitingOwnScorecards.tsx', hire: 'src/hr/components/HrRecruitingHireSummary.tsx', recovery: 'src/portals/DemoWorkspaceBackup.tsx and PortalBackupManager.tsx',
})
export const recruitingStatusFamilies = Object.freeze(Object.fromEntries(Object.entries(recruitingStatusInventory).map(([name, states]) => [name, Object.freeze(Object.keys(states))])))
