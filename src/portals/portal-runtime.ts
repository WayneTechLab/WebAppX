import type { DemoStorage } from './persistence'
import { isOwnedMockStorageKey, type OwnedMockStorageKey } from './owned-mock-storage'

export type DemoPersistenceMode = 'browser' | 'walkthrough'
export type PortalRuntime = Readonly<{
  mode: DemoPersistenceMode
  storage: DemoStorage | null | undefined
}>

/** A private store for one browser document. It has no browser-storage fallback. */
export function createMemoryDemoStorage(): DemoStorage {
  const records = new Map<OwnedMockStorageKey, string>()
  function ownedKey(key: string): OwnedMockStorageKey {
    if (!isOwnedMockStorageKey(key)) throw new Error('This memory store accepts only WebAppX mock storage keys.')
    return key
  }
  return Object.freeze({
    getItem(key: string): string | null {
      return records.get(ownedKey(key)) ?? null
    },
    setItem(key: string, value: string): void {
      const acceptedKey = ownedKey(key)
      if (typeof value !== 'string') throw new Error('Mock storage values must be serialized strings.')
      records.set(acceptedKey, value)
    },
    removeItem(key: string): void {
      records.delete(ownedKey(key))
    },
  })
}

/** Call once above routed portal providers. Undefined retains dynamic browser access. */
export function createPortalRuntime(mode: DemoPersistenceMode = 'browser'): PortalRuntime {
  if (mode !== 'browser' && mode !== 'walkthrough') throw new Error('Unknown mock persistence mode.')
  return Object.freeze({ mode, storage: mode === 'walkthrough' ? createMemoryDemoStorage() : undefined })
}
