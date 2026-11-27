import type { DemoStorageStatus } from './persistence'

export type StoragePresentationMode = 'browser' | 'walkthrough'

export const walkthroughRefreshMessage = 'Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.'

// Whole fixed notices only. A domain error or user label sharing a prefix must
// not opt into replacements. Variable templates below contain only portal/slot
// names and counts, never free text from records, filenames or thrown errors.
const storageNotices = new Set([
  'Browser storage unavailable',
  'Named restore point saved in this browser. Current workspaces and browser saves are unchanged.',
  'Restore-point label saved. Its captured records, scope and creation time are unchanged. Current workspaces and browser saves are unchanged.',
  'Restore-point history changed before this action. Refresh the list and try again. Current workspaces and browser saves are unchanged.',
  'Restore points cleared. HR, CMS and CRM workspace saves are unchanged.',
  'This browser could not read restore-point history. Allow browser storage before restoring or undoing.',
  'This browser could not confirm the current restore-point history. The history action was not saved. Current workspaces and browser saves are unchanged.',
  'This browser could not save the history action or confirm rollback of restore-point history. History may differ from its previous value. Current workspaces and their saves were not changed. Keep this tab open and export the current workspaces before refreshing, then review history after browser storage is available.',
  'This browser could not save the history action. Previous restore-point history was preserved. Current workspaces and browser saves are unchanged. Allow browser storage or free space, then try again.',
  'This browser could not read restore-point history. The named point was not saved. Current workspaces and browser saves are unchanged. Allow browser storage, then try again.',
  'This browser could not read restore-point history. The label was not saved. Current workspaces and browser saves are unchanged. Allow browser storage, then try again.',
  'This browser could not confirm that restore-point history was cleared. Workspace saves are unchanged. Allow browser storage, then try again.',
  'Recovery settings are damaged or incompatible. Choose the checkpoint settings explicitly before importing or resetting; no workspace was changed.',
  'This browser could not read recovery settings. No import or Reset can confirm whether a checkpoint is required. Allow browser storage, then try again.',
  'Recovery settings could not be read or validated. Previous settings and workspaces were not changed.',
  'Recovery settings changed before saving. Review the current settings and try again.',
  'The current recovery settings could not be confirmed. No settings were written.',
  'Recovery settings could not be saved or their rollback confirmed. Review settings after browser storage is available. Workspace saves and restore-point history were not changed.',
  'Recovery settings were not saved. Their exact previous bytes were restored; workspace saves and history are unchanged.',
  'Checkpoint settings saved for this browser origin. Workspace saves and restore-point history are unchanged.',
  'The required new checkpoint exceeds the 2,000,000-character history limit. Export current records and reduce the selected workspace before trying again.',
])
for (const label of ['HR', 'CMS', 'CRM']) {
  for (const notice of [
    `${label} is ready. Saved actions stay in this browser across refresh. Reset removes only this portal's saved sample.`,
    `${label} sample restored from this browser. Saved actions survive refresh; Reset removes only this portal's saved sample.`,
    `${label} sample saved in this browser. It will be restored after refresh. Reset removes only this portal's saved sample.`,
    `${label} saved sample removed and original fictional records restored. The other portals' saves are unchanged.`,
    `${label} changes are only in memory because this browser could not save them. Refresh may lose changes. Allow browser storage and try another saved action, or Reset to clear this portal's save.`,
    `${label} reset in memory, but this browser could not remove its previous save. It may return after refresh. Allow browser storage and Reset again to remove it.`,
    `${label} could not restore an incompatible or damaged save. Fresh fictional records are open. Reset removes the old save; your next saved action replaces it.`,
    `${label} import was not applied because the workspace is invalid or incompatible. Your previous workspace and browser save are preserved.`,
    `${label} import was not applied because this browser could not save it. Your previous workspace and browser save are preserved. Allow browser storage or free space, then try again.`,
    `${label} workspace imported and saved in this browser. It will be restored after refresh. The other portals' workspaces are unchanged.`,
    `${label} workspace imported and saved. A required ${label}-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged.`,
    `${label} original fictional records restored and browser save removed. A required ${label}-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged.`,
    `A required ${label}-only checkpoint will save the current complete records before import.`,
    `A required ${label}-only checkpoint will save the current complete records before Reset.`,
    `${label} exceeds the 2,000,000-character browser save limit. Reduce its mock workspace data before trying again.`,
  ]) storageNotices.add(notice)
}
const previousWorkspaces = 'The previous in-memory workspaces and browser saves are preserved.'
for (const notice of [
  `Restore was not applied because the backup or workspace selection is invalid or incompatible. ${previousWorkspaces}`,
  `Restore was not applied because a selected workspace could not fit or be serialized as a valid browser save. ${previousWorkspaces}`,
  `Restore was not applied because the current workspaces, backup or selection are invalid or incompatible. ${previousWorkspaces}`,
  `Restore was not applied because this browser could not read the current saves. ${previousWorkspaces} Allow browser storage, then try again.`,
  `Restore was not applied because this browser could not read restore-point history. ${previousWorkspaces} Allow browser storage, then try again.`,
  `Restore was not applied because this browser could not read the current saves. ${previousWorkspaces} Restore-point history is unchanged. Allow browser storage, then try again.`,
  `Restore was not applied because this browser could not save every selected workspace. ${previousWorkspaces} Allow browser storage or free space, then try again.`,
  `Restore was not applied because this browser could not save the automatic restore point and every selected workspace. ${previousWorkspaces} Restore-point history is unchanged. Allow browser storage or free space, then try again.`,
  'The required checkpoint and Reset could not both be saved. Exact previous history and selected save bytes were restored. The current in-memory workspace remains open; no replacement was accepted.',
  'The required checkpoint and import could not both be saved. Exact previous history and selected save bytes were restored. The current in-memory workspace remains open; no replacement was accepted.',
]) storageNotices.add(notice)
const storageTemplates = [
  /^[0-5] restore points? saved in this browser\.$/,
  /^(?:HR|CMS|CRM)(?:, (?:HR|CMS|CRM)){0,2} workspaces? (?:restored|recovered from the restore point) and saved in this browser\. (?:An automatic restore point was saved first\. )?Unselected workspaces and unrelated browser data are unchanged\.$/,
  /^Restore failed and this browser could not roll back: (?:HR save|CMS save|CRM save|restore-point history)(?:, (?:HR save|CMS save|CRM save|restore-point history)){0,3}\. Those browser slots may differ from their previous values\. The current in-memory workspaces remain open\. Keep this tab open and export the current workspaces before refreshing\. Allow browser storage or free space, then recover the selected saves\. Unselected workspace saves and unrelated browser data were not changed\.$/,
  /^Restore failed and this browser could not roll back the (?:HR|CMS|CRM)(?:, (?:HR|CMS|CRM)){0,2} saves?\. Those browser saves may differ from the previous in-memory workspaces, which remain open\. Unselected workspaces and unrelated browser data were not changed\. Keep this tab open and export the current workspaces before refreshing\. Allow browser storage or free space, then restore again to recover the selected saves\.$/,
  /^Replacement failed and rollback could not be confirmed for (?:restore-point history|(?:HR|CMS|CRM) browser save)(?: and (?:restore-point history|(?:HR|CMS|CRM) browser save))?\. Those browser slots may differ\. The current in-memory workspace remains open; no replacement was accepted\. Keep this page open and export current workspaces before refreshing, then recover storage access and review history\/saves\. Other workspace saves and unrelated browser data were not written\.$/,
]

/** Presentation only. Call with storage-layer notices, never record labels,
 * filenames or domain-result text. Unknown messages are retained verbatim.
 * The caller keeps the original kind/ok/recoveryRequired and all actual effects.
 */
export function storagePresentationMessage(message: string, mode: StoragePresentationMode = 'browser'): string {
  if (mode === 'browser' || message.endsWith(walkthroughRefreshMessage)) return message
  const storageNotice = storageNotices.has(message) || storageTemplates.some(pattern => pattern.test(message))
  if (!storageNotice) return message
  const replacements: readonly (readonly [string, string])[] = [
    ['Saved actions stay in this browser across refresh.', 'Actions stay only in walkthrough memory.'],
    ['Saved actions survive refresh;', 'Actions stay only in walkthrough memory;'],
    ['It will be restored after refresh.', 'It stays only in walkthrough memory.'],
    ["Reset removes only this portal's saved sample.", "Reset clears only this portal's walkthrough sample."],
    ['sample restored from this browser.', 'sample restored from walkthrough memory.'],
    ['saved in this browser', 'saved in walkthrough memory'],
    ['workspace imported and saved.', 'workspace imported and saved in walkthrough memory.'],
    ['saved for this browser origin', 'saved for this walkthrough session'],
    ['saved sample removed', 'walkthrough memory sample removed'],
    ['because this browser could not', 'because the walkthrough memory store could not'],
    ['but this browser could not', 'but the walkthrough memory store could not'],
    ['and this browser could not', 'and the walkthrough memory store could not'],
    ['This browser could not', 'The walkthrough memory store could not'],
    ['Those browser slots', 'Those walkthrough memory slots'],
    ['Those browser saves', 'Those walkthrough memory saves'],
    ['browser saves', 'walkthrough memory saves'],
    ['browser save', 'walkthrough memory save'],
    ['Browser storage unavailable', 'Walkthrough memory storage unavailable'],
    ['Allow browser storage or free space', 'Review walkthrough memory storage or reduce the snapshot size'],
    ['Allow browser storage', 'Review walkthrough memory storage'],
    ['after browser storage is available', 'after walkthrough memory storage is available'],
    ['browser storage', 'walkthrough memory storage'],
    ['Refresh may lose changes.', 'Refresh discards walkthrough changes.'],
    ['It may return after refresh.', 'The previous walkthrough save does not survive refresh.'],
  ]
  let presented = message
  for (const [before, after] of replacements) presented = presented.replaceAll(before, after)
  return `${presented} ${walkthroughRefreshMessage}`
}

export function storageNoticePresentation(status: DemoStorageStatus, mode: StoragePresentationMode = 'browser') {
  const warning = status.kind === 'unavailable' || status.kind === 'recovered'
  return {
    warning,
    heading: mode === 'browser' ? warning ? 'Browser save needs attention. ' : 'Browser save. ' : warning ? 'Walkthrough memory needs attention. ' : 'Walkthrough memory. ',
    message: storagePresentationMessage(status.message, mode),
  }
}
