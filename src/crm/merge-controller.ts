import type { CrmActor, CrmState } from './types'
import type { CrmMergeSelection } from './merge-types'
import type { CrmMergeController, CrmMergeControllerOptions, CrmMergeHandle, CrmMergeView, CrmRefusal } from './merge-public-types'
import { buildCrmMergeCandidate } from './merge'
import { isCrmState } from './persistence'
import { assertCrmMergeActor, canonicalCrmMergeJson, copyCrmMerge, crmMergeAssert as assert, crmMergeFailure, crmMergeKeys } from './merge-value'
import { CRM_MERGE_FULL_HISTORY_NOTICE, CRM_MERGE_REPRESENTATIVE_NOTICE, projectCrmDuplicateMembers, projectCrmDuplicateReport, projectCrmMergeChoices, projectCrmMergeHistory, readCrmMergePageRequest } from './merge-projection'

export type { CrmMergeController, CrmMergeControllerOptions } from './merge-public-types'
type Binding = { source: string; actor: string; selection: CrmMergeSelection; preview: string; policy: 'retain-target-v1'; epoch: number; generation: number; scopeVersion: number; createdAt: number; characters: number }
const stale = (): CrmRefusal => ({ ok: false, code: 'stale', message: 'This CRM merge preview expired or changed. Preview again; your selections are kept.' })
const inactive = 'This CRM merge view is unavailable for this preview identity or selection.'
const feedback = 'Fictional CRM merge accepted in memory. Check the browser storage notice before refreshing.'

/** One trusted document lifetime. Complete sources and confirmation bindings stay inside this closure. */
export function createCrmMergeController(adapter: CrmMergeControllerOptions): CrmMergeController {
  const bindings = new Map<CrmMergeHandle, Binding>(), issued = new Set<string>()
  let disposed = false, scopeVersion = 1, lastTime = -1
  let observed: { source: string; actor: string; epoch: number; generation: number; active: boolean } | null = null
  const clear = () => bindings.clear()
  function advance() { assert(scopeVersion < Number.MAX_SAFE_INTEGER, 'Temporary CRM view capacity reached. Save your current work, then reload this page.', 'limit'); scopeVersion++; clear() }
  function context(writer = false) {
    assert(!disposed, inactive, 'unavailable')
    const active = adapter.readActive() === true
    if (observed && observed.active !== active) { advance(); observed = { ...observed, active } }
    // Retained forms may read freshly authorized DTOs while hidden. Command
    // admission remains explicit here and inside the actual latest callback.
    if (!active && (writer || adapter.retainInactiveReadProjection !== true)) { clear(); assert(false, inactive, 'unavailable') }
    let actor: CrmActor
    try { actor = assertCrmMergeActor(adapter.readActor()); if (writer) assert(actor.role !== 'auditor', inactive, 'forbidden') }
    catch (error) { if (observed) { observed = null; advance() } else clear(); throw error }
    const epoch = adapter.readEpoch(), generation = adapter.readModeGeneration()
    assert(Number.isSafeInteger(epoch) && epoch >= 0 && Number.isSafeInteger(generation) && generation >= 0, inactive, 'unavailable')
    const time = adapter.monotonicNow()
    if (!Number.isFinite(time) || time < 0 || time < lastTime) { clear(); assert(false, 'Secure local CRM preview timing is unavailable.', 'unavailable') }
    lastTime = time
    for (const [handle, binding] of bindings) if (time - binding.createdAt >= 600_000) bindings.delete(handle)
    const state = adapter.readCurrent(), source = canonicalCrmMergeJson(state)
    assert(isCrmState(state), inactive, 'unavailable')
    const actorKey = canonicalCrmMergeJson({ id: actor.id, role: actor.role })
    if (observed && (observed.source !== source || observed.actor !== actorKey || observed.epoch !== epoch || observed.generation !== generation)) advance()
    observed = { source, actor: actorKey, epoch, generation, active }
    return { actor, actorKey, epoch, generation, time, state: state as CrmState, source, scopeVersion }
  }
  function view(actor: CrmActor): CrmMergeView {
    return { status: 'ready', scopeVersion, mode: actor.role === 'auditor' ? 'read-only' : 'writer', historyPolicy: actor.role === 'sales-rep' ? 'recorded-owner-summary' : 'full-capture', notice: actor.role === 'sales-rep' ? CRM_MERGE_REPRESENTATIVE_NOTICE : CRM_MERGE_FULL_HISTORY_NOTICE }
  }
  function ownHandle(request: unknown): CrmMergeHandle | null {
    try {
      if (request && typeof request === 'object') {
        const descriptor = Object.getOwnPropertyDescriptor(request, 'handle')
        if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') return descriptor.value as CrmMergeHandle
      }
    } catch { /* No accessor value is needed to consume a malformed request. */ }
    return null
  }
  function issueHandle(): CrmMergeHandle {
    assert(issued.size < 4096, 'Temporary CRM preview capacity reached. Save your current work, then reload this page.', 'limit')
    for (let attempt = 0; attempt < 3; attempt++) {
      let bytes: Uint8Array
      try { bytes = adapter.randomBytes(32) } catch { assert(false, 'Secure local CRM preview randomness is unavailable.', 'unavailable') }
      assert(bytes instanceof Uint8Array && Object.getPrototypeOf(bytes) === Uint8Array.prototype && bytes.length === 32, 'Secure local CRM preview randomness is unavailable.', 'unavailable')
      const result = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') as CrmMergeHandle
      if (!issued.has(result)) { issued.add(result); return result }
    }
    assert(false, 'Secure local CRM preview randomness is unavailable.', 'unavailable')
  }
  function paging(request: unknown, extra: readonly string[] = [], optional: readonly string[] = []) {
    const current = context(), parsed = readCrmMergePageRequest(request, extra, optional)
    assert(parsed.scopeVersion === current.scopeVersion, stale().message, 'stale')
    return current
  }
  const controller: CrmMergeController = {
    view() { try { const current = context(); return { ok: true, value: view(current.actor) } } catch (error) { return crmMergeFailure(error) } },
    report(request) { try { const current = paging(request); return { ok: true, value: projectCrmDuplicateReport(current.state, current.actor, request) } } catch (error) { return crmMergeFailure(error) } },
    groupMembers(request) { try { const current = paging(request, ['group']); return { ok: true, value: projectCrmDuplicateMembers(current.state, current.actor, request) } } catch (error) { return crmMergeFailure(error) } },
    choices(request) { try { const current = paging(request, ['kind'], ['selectedIds']); return { ok: true, value: projectCrmMergeChoices(current.state, current.actor, request) } } catch (error) { return crmMergeFailure(error) } },
    history(request) { try { const current = paging(request); return { ok: true, value: projectCrmMergeHistory(current.state, current.actor, request) } } catch (error) { return crmMergeFailure(error) } },
    preview(selection) {
      try {
        const current = context(true), candidate = buildCrmMergeCandidate(current.state, current.actor, selection)
        const capture = { source: current.source, actor: current.actorKey, selection: copyCrmMerge(candidate.preview.selection), preview: canonicalCrmMergeJson(candidate.preview), policy: 'retain-target-v1' as const, epoch: current.epoch, generation: current.generation, scopeVersion: current.scopeVersion, createdAt: current.time }
        const characters = canonicalCrmMergeJson(capture).length
        assert(characters <= 4_000_000, 'This local CRM merge preview has reached its capacity.', 'limit')
        const handle = issueHandle()
        while (bindings.size >= 8 || [...bindings.values()].reduce((total, item) => total + item.characters, 0) + characters > 4_000_000) {
          const oldest = bindings.keys().next().value
          assert(oldest, 'This local CRM merge preview has reached its capacity.', 'limit'); bindings.delete(oldest)
        }
        bindings.set(handle, { ...capture, characters })
        return { ok: true, handle, preview: { ...copyCrmMerge(candidate.preview), scopeVersion } }
      } catch (error) { return crmMergeFailure(error) }
    },
    confirm(request) {
      const supplied = ownHandle(request), captured = supplied ? bindings.get(supplied) : undefined
      if (supplied) bindings.delete(supplied)
      try {
        const current = context(true)
        crmMergeKeys(request, ['kind', 'handle'])
        assert((request.kind === 'contact' || request.kind === 'company') && typeof request.handle === 'string' && /^[a-f0-9]{64}$/.test(request.handle))
        if (!captured || captured.selection.kind !== request.kind || captured.actor !== current.actorKey || captured.epoch !== current.epoch || captured.generation !== current.generation || captured.scopeVersion !== current.scopeVersion || captured.source !== current.source || captured.policy !== 'retain-target-v1') return stale()
        let invoked = false, accepted: CrmState | null = null, acceptedActor: CrmActor | null = null, receipt = ''
        const acceptedMemory = adapter.replaceCurrent(latest => {
          assert(!invoked, stale().message, 'stale'); invoked = true
          const inside = context(true)
          assert(inside.actorKey === captured.actor && inside.epoch === captured.epoch && inside.generation === captured.generation && inside.scopeVersion === captured.scopeVersion && inside.time - captured.createdAt < 600_000 && canonicalCrmMergeJson(latest) === captured.source && captured.policy === 'retain-target-v1', stale().message, 'stale')
          const candidate = buildCrmMergeCandidate(latest, inside.actor, captured.selection)
          assert(canonicalCrmMergeJson(candidate.preview) === captured.preview, stale().message, 'stale')
          accepted = candidate.next; acceptedActor = inside.actor; receipt = candidate.preview.proposedReceipt
          return candidate.next
        })
        if (!acceptedMemory || !invoked || !accepted || !acceptedActor) return stale()
        advance()
        observed = { source: canonicalCrmMergeJson(accepted), actor: captured.actor, epoch: captured.epoch, generation: captured.generation, active: true }
        return { ok: true, receipt, feedback, view: view(acceptedActor) }
      } catch (error) { return crmMergeFailure(error) }
    },
    cancel(handle) { if (typeof handle === 'string') bindings.delete(handle) },
    clear,
    dispose() { disposed = true; clear(); observed = null },
  }
  return controller
}
