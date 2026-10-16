import type { CrmState } from './types'
import type { CrmMergePreview } from './merge-types'
import { canonicalizeCrmCommand, deriveCrmMerge } from './kernel'
import { isCrmState } from './persistence'
import { applyCrmCommand, crmEnvelopeCharacters, crmSnapshot } from './merge-history'
import { assertCrmMergeActor, assertCrmMergeJson, copyCrmMerge, crmMergeAssert as assert } from './merge-value'
export type CrmMergeCandidate = { next: CrmState; preview: CrmMergePreview }
/** Complete detached candidate stays in the trusted owner/controller only. */
export function buildCrmMergeCandidate(current: unknown, actorValue: unknown, request: unknown): CrmMergeCandidate {
  const actor = assertCrmMergeActor(actorValue)
  assert(actor.role !== 'auditor', 'This preview identity cannot apply CRM merges.', 'forbidden')
  assertCrmMergeJson(current)
  assert(isCrmState(current), 'A complete valid CRM workspace is required. No records changed.')
  const selection = canonicalizeCrmCommand(request); assert('kind' in selection)
  const { change, counts, warnings } = deriveCrmMerge(crmSnapshot(current), actor, selection)
  const result = applyCrmCommand(current, actor, selection)
  return { next: result.state, preview: copyCrmMerge({ schemaVersion: 1, selection, commonOwnerId: change.commonOwnerId, capture: change, counts, warnings, proposedReceipt: result.receipt, finalEnvelopeCharacters: crmEnvelopeCharacters(result.state), effect: 'Retire only the selected source, retain the target fields and redirect the listed links together. Historical captures remain unchanged. No provider or customer notification is sent.' }) }
}
