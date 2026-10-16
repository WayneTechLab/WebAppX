import { createContext, useContext } from 'react'

export type CrmDraftTab = 'overview' | 'leads' | 'pipeline' | 'contacts' | 'tasks' | 'ownership' | 'merges' | 'activity'
export const CrmDraftTabContext = createContext<(tab: CrmDraftTab) => void>(() => {})

/** Returning to a registered dirty owner reveals its retained tab before
 * focusing the exact form. This is presentation only, never domain authority. */
export function useCrmDraftFocus(tab: CrmDraftTab, focus: () => void) {
  const reveal = useContext(CrmDraftTabContext)
  return () => { reveal(tab); window.requestAnimationFrame(focus) }
}
export function crmDraftTab(id: string): CrmDraftTab {
  if (id === 'lead' || id.startsWith('convert:')) return 'leads'
  if (id === 'opportunity') return 'pipeline'
  if (id === 'company' || id === 'contact') return 'contacts'
  if (id === 'follow-up') return 'tasks'
  if (id.startsWith('ownership:')) return 'ownership'
  return 'merges'
}
