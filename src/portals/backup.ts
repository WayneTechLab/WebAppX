import { portalIds, portalById } from './registry'
import { DEMO_STORAGE_LIMIT, DEMO_STORAGE_VERSION, type DemoModule } from './persistence'

export const DEMO_BACKUP_LIMIT = DEMO_STORAGE_LIMIT + 512
// A UTF-8 file can use up to four bytes for a character. The decoded text and
// actual browser-save envelope are checked separately before accepting it.
export const DEMO_BACKUP_FILE_LIMIT = 4 * DEMO_BACKUP_LIMIT
export type DemoBackup<T> = { state: T; exportedAt: string }
const FORMAT = 'webappx-mock-workspace'
const VERSION = 1
const keys = ['format', 'schemaVersion', 'module', 'exportedAt', 'data']
const reservedKeys = new Set(['__proto__', 'constructor', 'prototype'])

function requireModule(module: DemoModule) {
  if (!portalIds.includes(module)) throw new Error('Choose an HR, CMS or CRM mock workspace.')
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function hasReservedKeys(value: unknown): boolean {
  const pending = [value]
  while (pending.length) {
    const item = pending.pop()
    if (!item || typeof item !== 'object') continue
    for (const [key, nested] of Object.entries(item)) {
      if (reservedKeys.has(key)) return true
      pending.push(nested)
    }
  }
  return false
}

function validState<T>(value: unknown, validate: (value: unknown) => value is T): value is T {
  try { return validate(value) } catch { return false }
}

/** Decode an untrusted local file without reading or writing browser storage.
 * Domain validators check the complete portal graph before callers can replace
 * their current sample. A backup is fictional data, never identity or authority.
 */
export function parseDemoBackup<T>(text: string, module: DemoModule, validate: (value: unknown) => value is T): DemoBackup<T> {
  requireModule(module)
  if (typeof text !== 'string' || text.length > DEMO_BACKUP_LIMIT) throw new Error('The backup is too large to import. Export a smaller mock workspace.')
  let envelope: unknown
  try { envelope = JSON.parse(text) } catch { throw new Error('The file is not a valid JSON mock workspace backup.') }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Choose a WebAppX mock workspace backup file.')
  const record = envelope as Record<string, unknown>
  if (Object.keys(record).length !== keys.length || !keys.every(key => Object.hasOwn(record, key)) || record.format !== FORMAT) throw new Error('Choose a WebAppX mock workspace backup file.')
  if (record.schemaVersion !== VERSION) throw new Error('This backup version is not supported by this template.')
  if (record.module !== module) throw new Error(`This backup does not belong to the ${portalById[module].label} portal. Choose its matching backup.`)
  if (!validTimestamp(record.exportedAt)) throw new Error('The backup has an invalid export timestamp.')
  if (hasReservedKeys(record.data) || !validState(record.data, validate)) throw new Error('The backup contains incomplete or incompatible mock workspace records.')
  // This is the exact shape used by saveDemoState. A valid download must also
  // fit the saved-workspace limit after import, without writing to test quota.
  const saved = JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: record.data })
  if (saved.length > DEMO_STORAGE_LIMIT) throw new Error('The workspace is too large for this template\'s browser save limit.')
  return { state: record.data, exportedAt: record.exportedAt }
}

/** Export only a complete validated snapshot, excluding unsaved form fields,
 * running timers and unrelated browser data. Compact JSON preserves the same
 * capacity as the existing browser-save format.
 */
export function createDemoBackup<T>(module: DemoModule, state: T, validate: (value: unknown) => value is T, exportedAt = new Date().toISOString()): string {
  requireModule(module)
  if (!validState(state, validate)) throw new Error('The current mock workspace is incomplete or incompatible and cannot be exported.')
  let text: string
  try { text = JSON.stringify({ format: FORMAT, schemaVersion: VERSION, module, exportedAt, data: state }) }
  catch { throw new Error('The current mock workspace could not be serialized as a JSON backup.') }
  parseDemoBackup(text, module, validate)
  return text
}
