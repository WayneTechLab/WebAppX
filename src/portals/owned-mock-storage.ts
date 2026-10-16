export type OwnedMockStorageKey =
  | 'webappx.demo.hr'
  | 'webappx.demo.cms'
  | 'webappx.demo.crm'
  | 'webappx.demo.restore-points'
  | 'webappx.demo.recovery-preferences'

export type OwnedMockStorageDescriptor = Readonly<{
  key: OwnedMockStorageKey
  label: string
  kind: 'workspace' | 'history' | 'preferences'
  nextLoadEffect: string
  preserved: string
}>

/** Hypothetical next-read effects only. This inventory never reads or clears a save. */
export const ownedMockStorageDescriptors: readonly OwnedMockStorageDescriptor[] = Object.freeze([
  Object.freeze({
    key: 'webappx.demo.hr', label: 'HR mock workspace', kind: 'workspace',
    nextLoadEffect: 'Without this save, the next HR workspace load starts from the original fictional HR records. The currently mounted workspace does not change merely because a storage key is removed.',
    preserved: 'CMS and CRM saves, recovery preferences, existing restore points and downloaded backups remain. Restore points may still contain captured HR records.',
  }),
  Object.freeze({
    key: 'webappx.demo.cms', label: 'CMS mock workspace', kind: 'workspace',
    nextLoadEffect: 'Without this save, the next CMS workspace load starts from the original fictional entries, publications and release records. The currently mounted workspace does not change merely because a storage key is removed.',
    preserved: 'HR and CRM saves, recovery preferences, existing restore points and downloaded backups remain. Restore points may still contain captured CMS records.',
  }),
  Object.freeze({
    key: 'webappx.demo.crm', label: 'CRM mock workspace', kind: 'workspace',
    nextLoadEffect: 'Without this save, the next CRM workspace load starts from the original fictional accounts, leads and ownership records. The currently mounted workspace does not change merely because a storage key is removed.',
    preserved: 'HR and CMS saves, recovery preferences, existing restore points and downloaded backups remain. Restore points may still contain captured CRM records.',
  }),
  Object.freeze({
    key: 'webappx.demo.restore-points', label: 'Mock restore-point history', kind: 'history',
    nextLoadEffect: 'Without this history, the next history read has no saved restore points or saved Undo history. The current portal records do not change.',
    preserved: 'All three workspace saves, recovery preferences and separately downloaded backups remain.',
  }),
  Object.freeze({
    key: 'webappx.demo.recovery-preferences', label: 'Mock recovery preferences', kind: 'preferences',
    nextLoadEffect: 'Without these preferences, the next preference read defaults both checkpoint-before-import and checkpoint-before-reset to off.',
    preserved: 'All three workspace saves, existing restore points and separately downloaded backups remain.',
  }),
])

export function isOwnedMockStorageKey(key: string): key is OwnedMockStorageKey {
  return ownedMockStorageDescriptors.some(descriptor => descriptor.key === key)
}
