import { portalById, type PortalId } from './registry'

export type DemoModule = PortalId
export type DemoStorageStatus = {
  kind: 'ready' | 'saved' | 'restored' | 'reset' | 'unavailable' | 'recovered'
  message: string
}
export type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const DEMO_STORAGE_VERSION = 1
export const DEMO_STORAGE_LIMIT = 2_000_000
export const demoStorageKey = (module: DemoModule) => `webappx.demo.${module}`
const name = (module: DemoModule) => portalById[module].label
const unavailable = (module: DemoModule): DemoStorageStatus => ({
  kind: 'unavailable',
  message: `${name(module)} changes are only in memory because this browser could not save them. Refresh may lose changes. Allow browser storage and try another saved action, or Reset to clear this portal's save.`,
})

function browserStorage(storage?: DemoStorage | null): DemoStorage {
  const result = storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage
  if (!result) throw new Error('Browser storage unavailable')
  return result
}

/** Local fictional demo state only. Never reuse these saves as trusted identity,
 * authorization, provider state or a destination for real personal information. */
export function loadDemoState<T>(module: DemoModule, create: () => T, validate: (value: unknown) => value is T, storage?: DemoStorage | null): { state: T; status: DemoStorageStatus } {
  const seed = create()
  let raw: string | null
  try { raw = browserStorage(storage).getItem(demoStorageKey(module)) }
  catch { return { state: seed, status: unavailable(module) } }
  if (raw === null) return { state: seed, status: { kind: 'ready', message: `${name(module)} is ready. Saved actions stay in this browser across refresh. Reset removes only this portal's saved sample.` } }
  try {
    if (raw.length > DEMO_STORAGE_LIMIT) throw new Error('Oversized save')
    const envelope: unknown = JSON.parse(raw)
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Invalid save')
    const record = envelope as Record<string, unknown>
    if (record.schemaVersion !== DEMO_STORAGE_VERSION || record.module !== module || !validate(record.data)) throw new Error('Incompatible save')
    return { state: record.data, status: { kind: 'restored', message: `${name(module)} sample restored from this browser. Saved actions survive refresh; Reset removes only this portal's saved sample.` } }
  } catch {
    return { state: seed, status: { kind: 'recovered', message: `${name(module)} could not restore an incompatible or damaged save. Fresh fictional records are open. Reset removes the old save; your next saved action replaces it.` } }
  }
}

export function saveDemoState<T>(module: DemoModule, state: T, storage?: DemoStorage | null): DemoStorageStatus {
  try {
    const raw = JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data: state })
    if (raw.length > DEMO_STORAGE_LIMIT) throw new Error('Oversized save')
    browserStorage(storage).setItem(demoStorageKey(module), raw)
    return { kind: 'saved', message: `${name(module)} sample saved in this browser. It will be restored after refresh. Reset removes only this portal's saved sample.` }
  } catch { return unavailable(module) }
}

export function clearDemoState(module: DemoModule, storage?: DemoStorage | null): DemoStorageStatus {
  try {
    browserStorage(storage).removeItem(demoStorageKey(module))
    return { kind: 'reset', message: `${name(module)} saved sample removed and original fictional records restored. The other portals' saves are unchanged.` }
  } catch {
    return { kind: 'unavailable', message: `${name(module)} reset in memory, but this browser could not remove its previous save. It may return after refresh. Allow browser storage and Reset again to remove it.` }
  }
}
