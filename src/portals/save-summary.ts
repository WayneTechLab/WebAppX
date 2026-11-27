import type { DemoStorageStatus } from './persistence'
import { storagePresentationMessage, type StoragePresentationMode } from './storage-presentation'

/** Loading an existing save and resetting to defaults keep their explanatory
 * provider message while using the same four directory summary states.
 */
export function workspaceSaveSummary(status: DemoStorageStatus, mode: StoragePresentationMode = 'browser') {
  const kind = status.kind === 'restored' ? 'saved' : status.kind === 'reset' ? 'ready' : status.kind
  const label = { ready: 'Ready', saved: 'Saved', recovered: 'Recovered', unavailable: 'Unavailable' }[kind]
  return { kind, label: mode === 'browser' ? label : { ready: 'Ready in memory', saved: 'Memory only', recovered: 'Review memory', unavailable: 'Memory unavailable' }[kind], message: storagePresentationMessage(status.message, mode) }
}
