import demoCompany from '../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'
import type { HrFixture } from '../hr/model'
import { createHrDemoState, isHrDemoState, type HrDemoState } from '../hr/persistence'
import { createCmsState, type CmsState } from '../cms/model'
import { isCmsState } from '../cms/persistence'
import { createCrmState, type CrmState } from '../crm/model'
import { isCrmState } from '../crm/persistence'
import { portalIds } from './registry'

export type DemoWorkspaces = { hr: HrDemoState; cms: CmsState; crm: CrmState }

const hrFixture = demoCompany as unknown as HrFixture

export const demoWorkspaceValidators = {
  hr: (value: unknown): value is HrDemoState => isHrDemoState(value, hrFixture),
  cms: isCmsState,
  crm: isCrmState,
}

export function createDemoWorkspaces(): DemoWorkspaces {
  return { hr: createHrDemoState(hrFixture), cms: createCmsState(), crm: createCrmState() }
}

/** A combined snapshot always contains one complete workspace for each portal.
 * These validators establish compatibility of fictional records, never authority.
 */
export function isDemoWorkspaces(value: unknown): value is DemoWorkspaces {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Reflect.ownKeys(value)
  if (keys.length !== portalIds.length || !portalIds.every(key => Object.hasOwn(value, key))) return false
  const workspaces = value as Record<string, unknown>
  return portalIds.every(module => demoWorkspaceValidators[module](workspaces[module]))
}
