import { createContext, useContext, type ReactNode } from 'react'
import { createPortalRuntime, type PortalRuntime } from './portal-runtime'

const defaultRuntime = createPortalRuntime()
const PortalRuntimeContext = createContext<PortalRuntime>(defaultRuntime)

export function PortalRuntimeProvider({ runtime, children }: { runtime: PortalRuntime; children: ReactNode }) {
  return <PortalRuntimeContext.Provider value={runtime}>{children}</PortalRuntimeContext.Provider>
}

// Custom portal shells retain the ordinary browser default without a provider.
// eslint-disable-next-line react-refresh/only-export-components
export function usePortalRuntime(): PortalRuntime {
  return useContext(PortalRuntimeContext)
}
