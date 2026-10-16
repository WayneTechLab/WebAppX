/** Finite new native payroll-control meanings. Existing payroll regression,
 * native151, lifecycle46 and recruiting42 inventories remain independent. */
export const payrollStatusInventory = Object.freeze({
  closure: Object.freeze({
    absent: 'No sample period has been explicitly closed.',
    invalid: 'Review all fields before previewing',
    unresolved: 'Every time entry in this company window must be approved and included in its exact-period receipts before closure.',
    preview: 'Review company-wide sample period closure',
    cancel: 'Preview period closure',
    accepted: 'Fictional payroll control accepted in memory. Check the browser storage notice before refreshing.',
    duplicate: 'This sample window is already closed or overlaps a closed window.',
    overlap: 'A different submitted window overlaps this sample period.',
    periodlessConflict: 'A periodless historical receipt has known consumed time in this window; its period remains unknown.',
    multiple: 'MOCK-PAYROLL-0002, MOCK-PAYROLL-0004',
  }),
  correction: Object.freeze({
    empty: 'No separate fictional payroll adjustments are recorded.',
    invalid: 'Review all fields before previewing',
    preview: 'Review separate fictional payroll adjustment',
    cancel: 'Preview payroll correction',
    positive: '+$30.00',
    downward: '-$15.00',
    benefitsOnly: '-$5.00',
    manualWithholding: '-$11.00',
    noop: 'This target already matches the cumulative sample balance; no correction was created.',
    stale: 'This payroll preview expired or changed. Preview again; your inputs are kept.',
    open: 'MOCK-PAYROLL-ADJUSTMENT-0001',
    fractional: '+$2.49',
    unknownPeriod: 'Unknown — periodless legacy receipt; no period is inferred',
    // A declared unsupported original remains in ordinary history, while the
    // writer selector has only this visible placeholder and no target option.
    unsupported: 'Choose an original submitted receipt',
    namespace: 'A generated sample adjustment receipt already exists.',
  }),
  ordinary: Object.freeze({
    timeClosed: 'The company sample window 2026-10-01 to 2026-10-15 is closed. Its frozen receipts and time cannot change.',
    periodClosed: 'The selected sample period overlaps the closed company window 2026-10-01 to 2026-10-15. Choose a nonoverlapping open period.',
    stale: 'Sample payroll stage: stale',
  }),
  scoped: Object.freeze({ own: 'Your separate fictional payroll adjustments', auditor: 'Payroll control metadata' }),
  recovery: Object.freeze({
    selected: 'Restore selected workspaces',
    undo: 'Confirm undo',
    required: 'New checkpoint',
    refused: 'Replacement failed and rollback could not be confirmed for restore-point history.',
    memory: 'HR changes are only in memory because this browser could not save them.',
  }),
})
export const payrollStatusSources = Object.freeze({ closure: 'src/hr/components/HrPayrollControl.tsx; src/hr/payroll-control.ts', correction: 'src/hr/components/HrPayrollControl.tsx; src/hr/payroll-control-controller.ts; src/hr/payroll-control.ts', ordinary: 'src/hr/components/HrWorkspace.tsx; src/hr/mock-workflows.ts; src/hr/payroll-control.ts', scoped: 'src/hr/components/HrInsights.tsx', recovery: 'src/portals/DemoWorkspaceBackup.tsx; src/portals/DemoWorkspaceReset.tsx; src/portals/useDemoPersistence.ts' })
export const payrollStatusFamilies = Object.freeze(Object.fromEntries(Object.entries(payrollStatusInventory).map(([family, states]) => [family, Object.keys(states)])))
