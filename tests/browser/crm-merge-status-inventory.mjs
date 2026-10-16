/** Literal meanings introduced by native CRM duplicate/merge UI only. Existing
 * portal lifecycle, payroll and legacy inventories remain independent. */
export const crmMergeStatusInventory = Object.freeze({
  report: Object.freeze({
    empty: 'No duplicate candidates are accessible in this scope.',
    crossOwner: 'Cross-owner match — ineligible for merge',
    candidate: 'Candidate for deliberate review',
    conversion: 'Expected conversion link — no merge suggested',
    secondPage: 'Page 2 · 1 shown · 21 accessible',
    memberPage: 'Page 3 · 11 shown · 51 accessible',
  }),
  preview: Object.freeze({
    invalid: 'Review merge selections',
    ready: 'Preview ready. No CRM record, save or receipt has changed.',
    canceled: 'Preview canceled. CRM records and saved bytes are unchanged. Your selections are kept.',
    mixed: 'contact-name · mira sample · mixed',
    companyMatch: 'selected-name-match · fictional harbor studio',
    accepted: 'Fictional CRM merge accepted in memory. Check the browser storage notice before refreshing.',
    limit: '200-record',
    refused: 'The selected CRM records cannot be merged. No records changed.',
    featureUnavailable: 'Your temporary selections are kept. Current record availability cannot be determined by these merge controls.',
    unavailable: 'This selected ID is unavailable in the current scope. Your literal selection is kept; choose a current record explicitly.',
  }),
  history: Object.freeze({
    empty: 'No merge receipts are accessible in this recorded ownership scope.',
    full: 'Captured at this receipt · contact · source contact-avery → retained contact-0002 · owner sales-riley',
    representative: 'Historical IDs grant no current record access. Captured private fields and current hidden joins are excluded.',
    readOnly: 'Read-only preview: candidate and accessible history pages are available; merge actions are unavailable.',
  }),
  recovery: Object.freeze({
    refused: 'Current workspace unchanged.',
    selected: 'Restore selected workspaces',
    undo: 'Confirm undo',
    memoryOnly: 'CRM changes are only in memory because this browser could not save them.',
  }),
})
export const crmMergeStatusSources = Object.freeze({ report: 'src/crm/CrmMerges.tsx; src/crm/merge-projection.ts', preview: 'src/crm/CrmMerges.tsx; src/crm/merge-controller.ts', history: 'src/crm/CrmMerges.tsx; src/crm/merge-projection.ts', recovery: 'src/portals/DemoWorkspaceBackup.tsx; src/portals/DemoStorageNotice.tsx; src/portals/DemoWorkspaceBackup.tsx' })
export const crmMergeStatusFamilies = Object.freeze(Object.fromEntries(Object.entries(crmMergeStatusInventory).map(([family, states]) => [family, Object.keys(states)])))
