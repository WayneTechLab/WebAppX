import { portalById } from './registry'
import { saveDemoState, type DemoModule, type DemoStorage, type DemoStorageStatus } from './persistence'

export type DemoImportResult<T> = { ok: true; state: T; status: DemoStorageStatus } | { ok: false; status: DemoStorageStatus }

/** Apply only a validated snapshot that was durably saved in this browser.
 * Validation is repeated here even when an import preview already checked it.
 * The caller must retain its existing in-memory workspace when ok is false.
 */
export function replaceDemoState<T>(module: DemoModule, value: unknown, validate: (value: unknown) => value is T, storage?: DemoStorage | null): DemoImportResult<T> {
  let valid = false
  try { valid = validate(value) } catch { /* Treat throwing validators as refusal. */ }
  if (!valid) return {
    ok: false,
    status: { kind: 'recovered', message: `${portalById[module].label} import was not applied because the workspace is invalid or incompatible. Your previous workspace and browser save are preserved.` },
  }
  const state = value as T
  const status = saveDemoState(module, state, storage)
  if (status.kind !== 'saved') return {
    ok: false,
    status: { kind: 'unavailable', message: `${portalById[module].label} import was not applied because this browser could not save it. Your previous workspace and browser save are preserved. Allow browser storage or free space, then try again.` },
  }
  return {
    ok: true,
    state,
    status: { kind: 'saved', message: `${portalById[module].label} workspace imported and saved in this browser. It will be restored after refresh. The other portals' workspaces are unchanged.` },
  }
}
