import { createDemoBackup, parseDemoBackup, DEMO_BACKUP_LIMIT } from './backup'
import { demoWorkspaceValidators, type DemoWorkspaces } from './workspaces'
import type { DemoModule } from './persistence'

export const COMBINED_BACKUP_LIMIT = 3 * DEMO_BACKUP_LIMIT + 512
export const COMBINED_BACKUP_FILE_LIMIT = 4 * COMBINED_BACKUP_LIMIT
export type CombinedBackup = { states: DemoWorkspaces; exportedAt: string }
const FORMAT = 'webappx-mock-workspaces'
const VERSION = 1
const envelopeKeys = ['format', 'schemaVersion', 'exportedAt', 'workspaces']
const modules = ['hr', 'cms', 'crm']

function exactRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
}

function readWorkspace<T>(module: DemoModule, value: unknown, exportedAt: unknown, validate: (value: unknown) => value is T): T {
  // Reuse the single-portal contract for timestamps, reserved property names,
  // complete domain graphs, and the exact browser-save size limit. This helper
  // does not read or write storage, including for portals the user may skip.
  const text = JSON.stringify({ format: 'webappx-mock-workspace', schemaVersion: 1, module, exportedAt, data: value })
  return parseDemoBackup(text, module, validate).state
}

/** Validate the whole backup before any restore selection can be presented.
 * Every file must contain exactly one complete HR, CMS and CRM workspace.
 */
export function parseCombinedBackup(text: string): CombinedBackup {
  if (typeof text !== 'string' || text.length > COMBINED_BACKUP_LIMIT) throw new Error('The combined backup is too large to import. Export smaller mock workspaces.')
  let envelope: unknown
  try { envelope = JSON.parse(text) } catch { throw new Error('The file is not a valid JSON combined workspace backup.') }
  if (!exactRecord(envelope, envelopeKeys) || envelope.format !== FORMAT) throw new Error('Choose a WebAppX combined HR, CMS and CRM backup file.')
  if (envelope.schemaVersion !== VERSION) throw new Error('This combined backup version is not supported by this template.')
  if (!exactRecord(envelope.workspaces, modules)) throw new Error('The combined backup must contain exactly the HR, CMS and CRM workspaces.')
  const states = {
    hr: readWorkspace('hr', envelope.workspaces.hr, envelope.exportedAt, demoWorkspaceValidators.hr),
    cms: readWorkspace('cms', envelope.workspaces.cms, envelope.exportedAt, demoWorkspaceValidators.cms),
    crm: readWorkspace('crm', envelope.workspaces.crm, envelope.exportedAt, demoWorkspaceValidators.crm),
  }
  // Each single-portal decoder has already validated the shared timestamp.
  return { states, exportedAt: envelope.exportedAt as string }
}

function exportWorkspace<T>(module: DemoModule, state: T, validate: (value: unknown) => value is T, exportedAt: string): T {
  // A validated JSON snapshot excludes executable values and catches toJSON
  // substitutions before assembling the combined envelope.
  return parseDemoBackup(createDemoBackup(module, state, validate, exportedAt), module, validate).state
}

/** Export native saved mock state only; no browser settings, unsaved fields,
 * running timers or separate SDK session are included. No storage writes occur.
 */
export function createCombinedBackup(states: DemoWorkspaces, exportedAt = new Date().toISOString()): string {
  if (!exactRecord(states, modules)) throw new Error('A combined export requires exactly the HR, CMS and CRM workspaces.')
  const workspaces = {
    hr: exportWorkspace('hr', states.hr, demoWorkspaceValidators.hr, exportedAt),
    cms: exportWorkspace('cms', states.cms, demoWorkspaceValidators.cms, exportedAt),
    crm: exportWorkspace('crm', states.crm, demoWorkspaceValidators.crm, exportedAt),
  }
  const text = JSON.stringify({ format: FORMAT, schemaVersion: VERSION, exportedAt, workspaces })
  if (text.length > COMBINED_BACKUP_LIMIT) throw new Error('The combined backup is too large to export. Export smaller mock workspaces.')
  return text
}
