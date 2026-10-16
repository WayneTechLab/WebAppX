import type { CrmState } from './types'
import { isLegacyCrmState } from './legacy-validation'
import { isCrmMergeState } from './merge-history'
/** Legacy absence remains exact. Present history requires complete forward proof. */
export function isCrmState(value: unknown): value is CrmState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'mergeHistory')
    if (descriptor) return 'value' in descriptor && descriptor.enumerable === true && isCrmMergeState(value)
    if ('mergeHistory' in value) return false
    return isLegacyCrmState(value)
  } catch { return false }
}
