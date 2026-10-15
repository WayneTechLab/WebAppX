import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { clearDemoState, loadDemoState, saveDemoState, type DemoModule, type DemoStorageStatus } from './persistence'
import { replaceDemoState } from './import-state'

export function useDemoPersistence<T>(module: DemoModule, create: () => T, validate: (value: unknown) => value is T) {
  const [snapshot, setSnapshot] = useState(() => loadDemoState(module, create, validate))
  const current = useRef(snapshot.state)
  const setState = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const value = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next
    // Persist in the event turn so an immediate refresh cannot race an effect.
    // Functional updates run once against our latest value, outside React's
    // render/updater replay; storage writes never occur during a render.
    current.current = value
    setSnapshot({ state: value, status: saveDemoState(module, value) })
  }, [module])
  const reset = useCallback(() => {
    const value = create()
    current.current = value
    setSnapshot({ state: value, status: clearDemoState(module) })
  }, [module, create])
  const importState = useCallback((value: unknown) => {
    const result = replaceDemoState(module, value, validate)
    if (result.ok) {
      current.current = result.state
      setSnapshot({ state: result.state, status: result.status })
    } else {
      setSnapshot({ state: current.current, status: result.status })
    }
    return { ok: result.ok, status: result.status }
  }, [module, validate])
  // The portal coordinator calls this only after the selected browser saves
  // have all succeeded. It must not write those slots a second time.
  const acceptStoredState = useCallback((value: T, status: DemoStorageStatus) => {
    current.current = value
    setSnapshot({ state: value, status })
  }, [])
  return { state: snapshot.state, setState, reset, importState, acceptStoredState, status: snapshot.status }
}
