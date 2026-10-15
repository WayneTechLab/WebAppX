import { createContext, useContext, type ReactNode } from 'react'

const Context = createContext(false)

/** Shared chrome receives only a boolean. The owning portal keeps its selection
 * and authority checks behind its own boundary. */
export function ScopedPortalChromeProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <Context.Provider value={active === true}>{children}</Context.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScopedPortalChrome(): boolean {
  return useContext(Context)
}
