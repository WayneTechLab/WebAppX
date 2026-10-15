import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useDemoPersistence } from './useDemoPersistence'
import { createDemoWorkspaces, demoWorkspaceValidators, type DemoWorkspaces } from './workspaces'
import type { DemoModule, DemoStorageStatus } from './persistence'
import { restoreWithCheckpoint, undoRestorePoint } from './restore-workspaces'
import { clearRestorePoints, createManualRestorePoint, loadRestorePoints, renameRestorePoint, type RestorePoint, type RestorePointsLoad } from './restore-points'

type PortalWorkspace<K extends DemoModule> = ReturnType<typeof useDemoPersistence<DemoWorkspaces[K]>>
type WorkspaceRevisions = Record<DemoModule, number>
type WorkspaceBundle = {
  states: DemoWorkspaces
  revisions: WorkspaceRevisions
  statuses: Record<DemoModule, DemoStorageStatus>
  restore: (states: DemoWorkspaces, selected: readonly DemoModule[]) => ReturnType<typeof restoreWithCheckpoint>
  history: RestorePointsLoad
  undo: (pointId: string, expectedPoint: RestorePoint) => ReturnType<typeof undoRestorePoint>
  clearHistory: () => ReturnType<typeof clearRestorePoints>
  createPoint: (selected: readonly DemoModule[], label: string) => ReturnType<typeof createManualRestorePoint>
  renamePoint: (pointId: string, label: string) => ReturnType<typeof renameRestorePoint>
  refreshHistory: () => void
}
type WorkspaceHandles = { [K in DemoModule]: PortalWorkspace<K> }
type WorkspaceContext = WorkspaceHandles & { bundle: WorkspaceBundle }

const PortalWorkspaceContext = createContext<WorkspaceContext | null>(null)
const createHr = () => createDemoWorkspaces().hr
const createCms = () => createDemoWorkspaces().cms
const createCrm = () => createDemoWorkspaces().crm

/** One owner per portal save keeps individual actions and combined restores on
 * the same in-memory snapshots. No component loads a second, stale copy.
 */
export function PortalWorkspaceProvider({ children }: { children: ReactNode }) {
  const hr = useDemoPersistence('hr', createHr, demoWorkspaceValidators.hr)
  const cms = useDemoPersistence('cms', createCms, demoWorkspaceValidators.cms)
  const crm = useDemoPersistence('crm', createCrm, demoWorkspaceValidators.crm)
  const [revisions, setRevisions] = useState<WorkspaceRevisions>({ hr: 0, cms: 0, crm: 0 })
  const [history, setHistory] = useState(() => loadRestorePoints())
  const { acceptStoredState: acceptHr } = hr
  const { acceptStoredState: acceptCms } = cms
  const { acceptStoredState: acceptCrm } = crm

  const acceptRestore = useCallback((result: ReturnType<typeof restoreWithCheckpoint>) => {
    setHistory(loadRestorePoints())
    if (!result.ok) return result
    const { states, modules: selected } = result
    // The helper saves all selected portals first. React batches these updates
    // with the revision change, remounting only restored portals' temporary UI.
    if (selected.includes('hr')) acceptHr(states.hr, result.status)
    if (selected.includes('cms')) acceptCms(states.cms, result.status)
    if (selected.includes('crm')) acceptCrm(states.crm, result.status)
    setRevisions(previous => ({
      hr: previous.hr + (selected.includes('hr') ? 1 : 0),
      cms: previous.cms + (selected.includes('cms') ? 1 : 0),
      crm: previous.crm + (selected.includes('crm') ? 1 : 0),
    }))
    return result
  }, [acceptHr, acceptCms, acceptCrm])

  const states = { hr: hr.state, cms: cms.state, crm: crm.state }
  const restore: WorkspaceBundle['restore'] = (target, selected) => acceptRestore(restoreWithCheckpoint(states, target, selected))
  const undo: WorkspaceBundle['undo'] = (pointId, expectedPoint) => acceptRestore(undoRestorePoint(states, pointId, undefined, {}, expectedPoint))
  const clearHistory = () => {
    const result = clearRestorePoints()
    setHistory(loadRestorePoints())
    return result
  }
  const refreshHistory = () => setHistory(loadRestorePoints())
  const createPoint: WorkspaceBundle['createPoint'] = (selected, label) => {
    const result = createManualRestorePoint(states, selected, label)
    setHistory(loadRestorePoints())
    return result
  }
  const renamePoint: WorkspaceBundle['renamePoint'] = (pointId, label) => {
    const result = renameRestorePoint(pointId, label)
    setHistory(loadRestorePoints())
    return result
  }

  const statuses = { hr: hr.status, cms: cms.status, crm: crm.status }
  return <PortalWorkspaceContext.Provider value={{ hr, cms, crm, bundle: { states, revisions, statuses, restore, history, undo, clearHistory, createPoint, renamePoint, refreshHistory } }}>{children}</PortalWorkspaceContext.Provider>
}

// These hooks deliberately share the provider's private context.
// eslint-disable-next-line react-refresh/only-export-components
export function usePortalWorkspace<K extends DemoModule>(module: K): WorkspaceHandles[K] {
  const value = useContext(PortalWorkspaceContext)
  if (!value) throw new Error('Portal workspaces must be used inside PortalWorkspaceProvider.')
  return value[module]
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortalWorkspaceBundle(): WorkspaceBundle {
  const value = useContext(PortalWorkspaceContext)
  if (!value) throw new Error('Portal workspaces must be used inside PortalWorkspaceProvider.')
  return value.bundle
}
