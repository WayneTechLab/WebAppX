import { createCmsState, type CmsState } from '../cms/model'
import { isCmsState } from '../cms/persistence'
import { createCrmState, type CrmState } from '../crm/model'
import { isCrmState } from '../crm/persistence'

export type DemoWorkspaces = { cms: CmsState; crm: CrmState }
export const demoWorkspaceValidators = { cms: isCmsState, crm: isCrmState }
export const createDemoWorkspaces = (): DemoWorkspaces => ({ cms: createCmsState(), crm: createCrmState() })
export function isDemoWorkspaces(value: unknown): value is DemoWorkspaces {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Reflect.ownKeys(record).length === 2 && Object.hasOwn(record, 'cms') && Object.hasOwn(record, 'crm')
    && isCmsState(record.cms) && isCrmState(record.crm)
}
