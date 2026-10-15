import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useUnsavedTransition } from '@/portals/unsaved-work'
import { ScopedPortalChromeProvider } from '@/portals/ScopedPortalChrome'

const recruitingPath = '/hr/demo/admin/recruiting'

type PreviewState = {
  pathname: string
  locationVersion: number
  interviewerEmployeeId: string | null
  generation: number
}

export type RecruitingPreview = Readonly<{
  interviewerEmployeeId: string | null
  generation: number
  /** The trusted HR owner validates the known fictional identity first. The
   * boolean reports whether the unsaved-work decision committed immediately. */
  enter: (employeeId: string) => boolean
  leave: () => boolean
}>

const unavailable: RecruitingPreview = Object.freeze({
  interviewerEmployeeId: null,
  generation: 0,
  enter: () => false,
  leave: () => false,
})
const Context = createContext<RecruitingPreview>(unavailable)

/** Volatile shell selection only: no domain records, account role, persistence
 * or provider authority lives here. Keep this provider mounted across routes. */
export function RecruitingPreviewProvider({ pathname, children }: { pathname: string; children: ReactNode }) {
  const request = useUnsavedTransition()
  const [state, setState] = useState<PreviewState>(() => ({ pathname, locationVersion: 0, interviewerEmployeeId: null, generation: 0 }))
  const current = useRef(state)
  let selected = state
  if (state.pathname !== pathname) {
    // Adjust this component before committing children, rather than clearing in
    // a later effect that could briefly render stale interviewer chrome. A
    // departure also invalidates queued decisions even if Back returns here.
    const leavingMode = state.interviewerEmployeeId !== null && pathname !== recruitingPath
    selected = { ...state, pathname, locationVersion: state.locationVersion + 1, interviewerEmployeeId: pathname === recruitingPath ? state.interviewerEmployeeId : null, generation: state.generation + (leavingMode ? 1 : 0) }
    setState(selected)
  }
  useLayoutEffect(() => { current.current = selected }, [selected])

  const change = useCallback((employeeId: string | null) => {
    const source = current.current
    if (source.pathname !== recruitingPath) return false
    if (employeeId !== null && (typeof employeeId !== 'string' || employeeId.length === 0 || employeeId.length > 200 || employeeId.trim() !== employeeId)) return false
    if (source.interviewerEmployeeId === employeeId) return true
    const label = employeeId === null ? 'Leave interviewer preview' : source.interviewerEmployeeId === null ? 'Enter interviewer preview' : 'Change interviewer preview'
    return request({ portal: 'hr', label }, () => {
      const latest = current.current
      if (latest.pathname !== recruitingPath || latest.locationVersion !== source.locationVersion || latest.generation !== source.generation || latest.interviewerEmployeeId !== source.interviewerEmployeeId) return
      const next = { ...latest, interviewerEmployeeId: employeeId, generation: latest.generation + 1 }
      // A following event sees the accepted selection without awaiting an
      // effect or render. Domain controller handles bind this same generation.
      current.current = next
      setState(next)
    })
  }, [request])
  const enter = useCallback((employeeId: string) => typeof employeeId === 'string' && change(employeeId), [change])
  const leave = useCallback(() => change(null), [change])

  return <Context.Provider value={{ interviewerEmployeeId: selected.interviewerEmployeeId, generation: selected.generation, enter, leave }}><ScopedPortalChromeProvider active={selected.interviewerEmployeeId !== null}>{children}</ScopedPortalChromeProvider></Context.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRecruitingPreview(): RecruitingPreview {
  return useContext(Context)
}
