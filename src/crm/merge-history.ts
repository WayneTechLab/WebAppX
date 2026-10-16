import type { CrmActor, CrmState } from './types'
import type { CrmCommand, CrmMergeHistoryV1, CrmSnapshot } from './merge-types'
import { canonicalizeCrmCommand, readStoredCrmCommand, reduceCrmCommand, reduceCrmOrdinary } from './kernel'
import { isLegacyCrmState } from './legacy-validation'
import { assertCrmMergeActor, assertCrmMergeJson, canonicalCrmMergeJson, copyCrmMerge, crmMergeAssert as assert, crmMergeKeys } from './merge-value'

export function crmSnapshot(state: CrmState): CrmSnapshot {
  return { companies: state.companies, contacts: state.contacts, leads: state.leads, opportunities: state.opportunities, tasks: state.tasks, activity: state.activity, sequence: state.sequence }
}
export function crmEnvelopeCharacters(state: CrmState): number { return JSON.stringify({ schemaVersion: 1, module: 'crm', data: state }).length }
export function replayCrmMergeHistory(value: unknown): CrmSnapshot | null {
  try {
    assertCrmMergeJson(value)
    crmMergeKeys(value, ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity', 'sequence', 'mergeHistory'])
    crmMergeKeys(value.mergeHistory, ['schemaVersion', 'baseline', 'steps'])
    const history = value.mergeHistory
    assert(history.schemaVersion === 1)
    crmMergeKeys(history.baseline, ['kind', 'companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity', 'sequence'])
    assert(history.baseline.kind === 'legacy-at-first-merge')
    const baseline = crmSnapshot(history.baseline as CrmState)
    assert(isLegacyCrmState(baseline))
    assert(Array.isArray(history.steps) && history.steps.length > 0 && history.steps.length <= 1000)
    let replay: CrmSnapshot = copyCrmMerge(baseline), merges = 0
    for (let index = 0; index < history.steps.length; index++) {
      const step: unknown = history.steps[index]
      crmMergeKeys(step, ['receipt', 'actor', 'command'])
      crmMergeKeys(step.actor, ['id', 'role'])
      const actor = assertCrmMergeActor(step.actor), command = readStoredCrmCommand(step.command)
      assert(command && (index !== 0 || 'kind' in command))
      if ('kind' in command) assert(++merges <= 100)
      const result = reduceCrmCommand(replay, actor, command)
      assert(step.receipt === result.receipt)
      replay = result.next
    }
    assert(merges > 0 && crmEnvelopeCharacters(value as CrmState) <= 2000000)
    assert(canonicalCrmMergeJson(replay) === canonicalCrmMergeJson(crmSnapshot(value as CrmState)))
    return replay
  } catch { return null }
}
export function isCrmMergeState(value: unknown): value is CrmState { return replayCrmMergeHistory(value) !== null }
export function applyCrmCommand(current: CrmState, actorValue: CrmActor, input: unknown): { state: CrmState; receipt: string; command: CrmCommand } {
  const actor = assertCrmMergeActor(actorValue)
  const descriptor = Object.getOwnPropertyDescriptor(current, 'mergeHistory')
  assert(!descriptor || 'value' in descriptor)
  assert(descriptor || !('mergeHistory' in current))
  const ordinaryType = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'type') : undefined
  if (!descriptor && ordinaryType && 'value' in ordinaryType && ordinaryType.value !== 'transfer-account') {
    // Preserve old native validation order/messages before canonical journal parsing.
    const next = reduceCrmOrdinary(current, actor, input as Parameters<typeof reduceCrmOrdinary>[2])
    return { state: next, receipt: next.activity[0].receipt, command: canonicalizeCrmCommand(input) }
  }
  const command = canonicalizeCrmCommand(input)
  if (!descriptor && !('kind' in command)) {
    const next = reduceCrmCommand(crmSnapshot(current), actor, command).next
    return { state: next, receipt: next.activity[0].receipt, command }
  }
  assertCrmMergeJson(current)
  assert(descriptor ? isCrmMergeState(current) : isLegacyCrmState(current), 'A complete valid CRM workspace is required. No records changed.')
  const history: CrmMergeHistoryV1 = descriptor ? copyCrmMerge(current.mergeHistory!) : { schemaVersion: 1, baseline: { kind: 'legacy-at-first-merge', ...copyCrmMerge(crmSnapshot(current)) }, steps: [] }
  assert(history.steps.length < 1000 && (!('kind' in command) || history.steps.filter(step => 'kind' in step.command).length < 100), 'This CRM history reached its capacity. Export your work before starting another sample branch.', 'limit')
  const result = reduceCrmCommand(crmSnapshot(current), actor, command)
  history.steps.push({ receipt: result.receipt, actor: { id: actor.id, role: actor.role }, command: copyCrmMerge(command) })
  const state: CrmState = { ...result.next, mergeHistory: history }
  assert(crmEnvelopeCharacters(state) <= 2000000, 'This CRM save exceeds its 2,000,000-character capacity. No records changed.', 'limit')
  assert(isCrmMergeState(state), 'The complete CRM merge history could not be verified. No records changed.')
  return { state, receipt: result.receipt, command }
}
