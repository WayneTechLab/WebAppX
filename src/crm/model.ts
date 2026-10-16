/** Account-free fictional CRM compatibility facade. */
export * from './types'
export { createCrmState, canWriteCrm, canManageCrmOwnership } from './kernel'
import type { CrmActor, CrmEvent, CrmState } from './types'
import { canWriteCrm } from './kernel'
import { applyCrmCommand } from './merge-history'
import { projectCrmScope } from './merge-projection'
export const scopedCrmState = projectCrmScope
export function transitionCrm(current: CrmState, actor: CrmActor, event: CrmEvent): CrmState {
  if (!canWriteCrm(actor)) throw new Error('This preview identity has no CRM write permission.')
  return applyCrmCommand(current, actor, event).state
}
export function crmDashboard(state: CrmState, actor: CrmActor) {
  const visible = scopedCrmState(state, actor)
  const open = visible.opportunities.filter(record => !['won', 'lost'].includes(record.stage))
  return {
    companies: visible.companies.length, contacts: visible.contacts.length,
    leads: visible.leads.filter(record => record.status !== 'converted').length,
    openOpportunities: open.length, pipelineCents: open.reduce((sum, record) => sum + record.amountCents, 0),
    wonCents: visible.opportunities.filter(record => record.stage === 'won').reduce((sum, record) => sum + record.amountCents, 0),
    openTasks: visible.tasks.filter(record => record.status === 'open').length, activities: visible.activity.length,
  }
}
