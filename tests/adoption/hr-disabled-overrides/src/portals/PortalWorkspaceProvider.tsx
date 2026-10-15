import { createContext, useContext, useState, type ReactNode } from 'react'
import { useDemoPersistence } from './useDemoPersistence'
import { createCmsState } from '../cms/model'
import { createCrmState } from '../crm/model'
import { isCmsState } from '../cms/persistence'
import { isCrmState } from '../crm/persistence'
import { restoreAdoptedBundle } from './combined-backup'
import type { DemoWorkspaces } from './workspaces'

type Handles = { cms: ReturnType<typeof useDemoPersistence<DemoWorkspaces['cms']>>; crm: ReturnType<typeof useDemoPersistence<DemoWorkspaces['crm']>> }
type Context = Handles & { bundle: { states: DemoWorkspaces; revision: number; restore: (states: DemoWorkspaces) => { ok: boolean; message: string } } }
const WorkspaceContext = createContext<Context | null>(null)
export function PortalWorkspaceProvider({ children }: { children: ReactNode }) {
  const cms = useDemoPersistence('cms', createCmsState, isCmsState)
  const crm = useDemoPersistence('crm', createCrmState, isCrmState)
  const [revision, setRevision] = useState(0)
  function restore(states: DemoWorkspaces) {
    let storage: Storage
    try { storage = window.localStorage } catch { return { ok: false, message: 'Browser storage unavailable. Current workspaces unchanged.' } }
    const result = restoreAdoptedBundle(states, storage)
    if (result.ok && result.states) {
      const status = { kind: 'saved' as const, message: result.message }
      cms.acceptStoredState(result.states.cms, status)
      crm.acceptStoredState(result.states.crm, status)
      setRevision(previous => previous + 1)
    }
    return result
  }
  return <WorkspaceContext.Provider value={{ cms, crm, bundle: { states: { cms: cms.state, crm: crm.state }, revision, restore } }}>{children}</WorkspaceContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePortalWorkspace<K extends keyof Handles>(module: K): Handles[K] {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('A workspace provider is required.')
  return value[module]
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePortalWorkspaceBundle() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('A workspace provider is required.')
  return value.bundle
}
