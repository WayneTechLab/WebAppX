import { createDemoBackup, parseDemoBackup, DEMO_BACKUP_LIMIT } from './backup'
import { demoWorkspaceValidators, isDemoWorkspaces, type DemoWorkspaces } from './workspaces'
import { DEMO_STORAGE_VERSION, demoStorageKey, type DemoStorage } from './persistence'

export const ADOPTED_FORMAT = 'webappx-adopted-cms-crm-workspaces'
export const COMBINED_BACKUP_LIMIT = 2 * DEMO_BACKUP_LIMIT + 512
export const COMBINED_BACKUP_FILE_LIMIT = 4 * COMBINED_BACKUP_LIMIT
export type CombinedBackup = { states: DemoWorkspaces; exportedAt: string }
const modules = ['cms', 'crm'] as const

export function parseCombinedBackup(text: string): CombinedBackup {
  if (typeof text !== 'string' || text.length > COMBINED_BACKUP_LIMIT) throw new Error('Adopted bundle exceeds its size limit.')
  let envelope: Record<string, unknown>
  try { envelope = JSON.parse(text) } catch { throw new Error('Choose a valid adopted CMS and CRM JSON bundle.') }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || Reflect.ownKeys(envelope).length !== 4
      || !['format', 'schemaVersion', 'exportedAt', 'workspaces'].every(key => Object.hasOwn(envelope, key))
      || envelope.format !== ADOPTED_FORMAT || envelope.schemaVersion !== 1) {
    throw new Error('Only adopted CMS and CRM bundles version 1 are accepted. Default combined backups and recovery points are incompatible.')
  }
  if (!isDemoWorkspaces(envelope.workspaces)) throw new Error('The adopted bundle requires exactly complete CMS and CRM workspaces.')
  const states = {} as DemoWorkspaces
  for (const module of modules) {
    const single = JSON.stringify({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt: envelope.exportedAt, data: envelope.workspaces[module] })
    // Keep the unchanged single-module timestamp, graph and save-budget checks.
    Object.assign(states, { [module]: parseDemoBackup<DemoWorkspaces[typeof module]>(single, module, demoWorkspaceValidators[module]).state })
  }
  return { states, exportedAt: envelope.exportedAt as string }
}

export function createCombinedBackup(states: DemoWorkspaces, exportedAt = new Date().toISOString()): string {
  if (!isDemoWorkspaces(states)) throw new Error('Export requires exactly complete CMS and CRM workspaces.')
  const workspaces = Object.fromEntries(modules.map(module => [module,
    JSON.parse(createDemoBackup<DemoWorkspaces[typeof module]>(module, states[module], demoWorkspaceValidators[module], exportedAt)).data]))
  const text = JSON.stringify({ format: ADOPTED_FORMAT, schemaVersion: 1, exportedAt, workspaces })
  parseCombinedBackup(text)
  return text
}

/** This adopted app deliberately has no recovery-point contract. Validate every
 * byte before writes, then save both slots before replacing either live state.
 * Failed writes attempt rollback; failed rollback is explicitly reported.
 */
export function restoreAdoptedBundle(states: DemoWorkspaces, storage: DemoStorage) {
  let verified: DemoWorkspaces
  try { verified = parseCombinedBackup(createCombinedBackup(states)).states }
  catch { return { ok: false, message: 'Incompatible adopted bundle. Current workspaces unchanged.' } }
  const prepared = modules.map(module => ({ key: demoStorageKey(module), raw: JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: verified[module] }) }))
  const previous = new Map<string, string | null>()
  try { for (const row of prepared) previous.set(row.key, storage.getItem(row.key)) }
  catch { return { ok: false, message: 'Could not read browser saves. Current workspaces unchanged.' } }
  const attempted: string[] = []
  try {
    for (const row of prepared) { attempted.push(row.key); storage.setItem(row.key, row.raw) }
  } catch {
    let uncertain = false
    for (const key of attempted.reverse()) {
      try { const raw = previous.get(key); if (raw === null) storage.removeItem(key); else storage.setItem(key, raw as string) }
      catch { uncertain = true }
    }
    return { ok: false, message: uncertain ? 'Restore failed and browser saves may differ. Keep this tab open and export current workspaces before refreshing.' : 'Restore failed; previous browser saves and live workspaces preserved.' }
  }
  return { ok: true, states: verified, message: 'Adopted CMS and CRM bundle restored and saved. No recovery point was created.' }
}
