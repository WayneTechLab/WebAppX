import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { clearDemoState, loadDemoState, saveDemoState, type DemoModule, type DemoStorageStatus } from './persistence'
import { replaceDemoState } from './import-state'
import type { DemoImportResult } from './import-state'
import type { WorkspaceRecoveryControls } from './recovery-preferences'

type ReplacementHandlers<T> = {
  importState?: (current: T, incoming: unknown, confirmation?: string) => DemoImportResult<T>
  reset?: (current: T, seed: T, confirmation?: string) => DemoImportResult<T>
}

export function useDemoPersistence<T>(module: DemoModule, create: () => T, validate: (value: unknown) => value is T, replacement?: ReplacementHandlers<T>) {
  const [snapshot, setSnapshot] = useState(() => loadDemoState(module, create, validate))
  const [replacementEpoch, setReplacementEpoch] = useState(0)
  const current = useRef(snapshot.state)
  const setState = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const value = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next
    // Persist in the event turn so an immediate refresh cannot race an effect.
    // Functional updates run once against our latest value, outside React's
    // render/updater replay; storage writes never occur during a render.
    current.current = value
    setSnapshot({ state: value, status: saveDemoState(module, value) })
  }, [module])
  const reset = useCallback((confirmation?: string) => {
    const value = create()
    // Default Reset deliberately accepts the seed even if save removal fails.
    // Required-checkpoint handlers instead refuse without accepting a seed.
    const result = replacement?.reset ? replacement.reset(current.current, value, confirmation) : { ok: true as const, state: value, status: clearDemoState(module) }
    if (result.ok) {
      current.current = result.state
      setSnapshot({ state: result.state, status: result.status })
      setReplacementEpoch(previous => previous + 1)
    } else setSnapshot({ state: current.current, status: result.status })
    return { ok: result.ok, status: result.status }
  }, [module, create, replacement])
  const importState = useCallback((value: unknown, confirmation?: string) => {
    const result = replacement?.importState ? replacement.importState(current.current, value, confirmation) : replaceDemoState(module, value, validate)
    if (result.ok) {
      current.current = result.state
      setSnapshot({ state: result.state, status: result.status })
      setReplacementEpoch(previous => previous + 1)
    } else {
      setSnapshot({ state: current.current, status: result.status })
    }
    return { ok: result.ok, status: result.status }
  }, [module, validate, replacement])
  // The portal coordinator calls this only after the selected browser saves
  // have all succeeded. It must not write those slots a second time.
  const acceptStoredState = useCallback((value: T, status: DemoStorageStatus) => {
    current.current = value
    setSnapshot({ state: value, status })
    setReplacementEpoch(previous => previous + 1)
  }, [])
  return { state: snapshot.state, setState, reset, importState, acceptStoredState, status: snapshot.status, replacementEpoch, recovery: undefined as WorkspaceRecoveryControls | undefined }
}
