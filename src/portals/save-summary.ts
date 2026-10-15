import type { DemoStorageStatus } from './persistence'

/** Loading an existing save and resetting to defaults keep their explanatory
 * provider message while using the same four directory summary states.
 */
export function workspaceSaveSummary(status: DemoStorageStatus) {
  const kind = status.kind === 'restored' ? 'saved' : status.kind === 'reset' ? 'ready' : status.kind
  const label = { ready: 'Ready', saved: 'Saved', recovered: 'Recovered', unavailable: 'Unavailable' }[kind]
  return { kind, label, message: status.message }
}
