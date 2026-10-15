import type { DemoWorkspaces } from './workspaces'
import type { DemoModule } from './persistence'

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`

export function summarizeWorkspaces(states: Partial<DemoWorkspaces>): Partial<Record<DemoModule, string>> {
  return {
    ...(states.hr ? { hr: `${count(Object.keys(states.hr.workflow.onboarding).length, 'person').replace('persons', 'people')} · ${count(states.hr.workflow.payrollHistory.length, 'payroll receipt')} · ${count(states.hr.surveys.surveys.length, 'survey')}` } : {}),
    ...(states.cms ? { cms: `${count(states.cms.entries.length, 'content record')} · ${count(states.cms.entries.filter(entry => entry.published).length, 'published snapshot')} · ${count(states.cms.activity.length, 'action')}` } : {}),
    ...(states.crm ? { crm: `${count(states.crm.companies.length, 'company').replace('companys', 'companies')} · ${count(states.crm.leads.length, 'lead')} · ${count(states.crm.opportunities.length, 'opportunity').replace('opportunitys', 'opportunities')}` } : {}),
  }
}
