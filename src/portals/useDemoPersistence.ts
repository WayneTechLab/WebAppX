import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { clearDemoState, loadDemoState, saveDemoState, type DemoModule } from './persistence'

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
  return { state: snapshot.state, setState, reset, status: snapshot.status }
}
