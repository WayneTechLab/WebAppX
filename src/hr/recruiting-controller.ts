import type { HrDemoState } from './persistence'
import type { PreviewHandle, RecruitingCommand, RecruitingController, RecruitingControllerOptions, RecruitingInterviewerPort, SafeRefusal } from './recruiting-lifecycle-types'
import { authorizeRecruitingCommand, buildRecruitingCandidate, recruitingCommandKind, RecruitingConflict } from './recruiting-lifecycle'
import { projectRecruitingView } from './recruiting-lifecycle-projection'
import { assert, canonicalRecruitingJson, copyRecruiting, exactKeys, isRecruitingManager, refuse, safeRecruitingFailure } from './recruiting-lifecycle-value'

type Binding = { source: string; fixture: string; actor: string; epoch: number; generation: number; command: RecruitingCommand; createdAt: number; characters: number }
const expired = (): SafeRefusal => ({ ok: false, code: 'stale', message: 'This recruiting preview expired or changed. Preview again; your inputs are kept.' })
/** One trusted document owner. The returned API contains no source/digest/candidate getter. */
export function createRecruitingController(adapter: RecruitingControllerOptions): RecruitingController {
  const bindings = new Map<PreviewHandle, Binding>(), issued = new Set<string>()
  let disposed = false, lastTime = -1, identity = ''
  const clear = () => bindings.clear()
  function now() { const time = adapter.monotonicNow(); if (!Number.isFinite(time) || time < 0 || time < lastTime) { clear(); refuse('Secure local preview timing is unavailable.', 'unavailable') } lastTime = time; return time }
  function context() {
    if (disposed) refuse('This recruiting preview is unavailable.', 'unavailable')
    const actor = adapter.readActor(), epoch = adapter.readEpoch(), generation = adapter.readModeGeneration()
    assert(Number.isSafeInteger(epoch) && epoch >= 0 && Number.isSafeInteger(generation) && generation >= 0)
    const actorKey = canonicalRecruitingJson(actor), nextIdentity = canonicalRecruitingJson({ actor, epoch, generation })
    if (identity !== nextIdentity) { clear(); identity = nextIdentity }
    const time = now()
    for (const [handle, binding] of bindings) if (time - binding.createdAt >= 600_000) bindings.delete(handle)
    return { actor, actorKey, epoch, generation, time }
  }
  function handle() {
    if (issued.size >= 4096) refuse('Temporary preview capacity reached. Save your current work, then reload this page.', 'limit')
    for (let attempt = 0; attempt < 3; attempt++) {
      let bytes: Uint8Array
      try { bytes = adapter.randomBytes(32) } catch { refuse('Secure local preview randomness is unavailable.', 'unavailable') }
      if (!(bytes instanceof Uint8Array) || bytes.length !== 32) refuse('Secure local preview randomness is unavailable.', 'unavailable')
      const result = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') as PreviewHandle
      if (!issued.has(result)) { issued.add(result); return result }
    }
    refuse('Secure local preview randomness is unavailable.', 'unavailable')
  }
  const controller: RecruitingController = {
    view(options = {}) {
      try {
        const current = context(); exactKeys(options, [], ['observedAt'])
        // Mode authorization precedes full workspace validation and lookup.
        if (!isRecruitingManager(current.actor) && current.actor.mode !== 'interviewer') refuse('This recruiting preview is unavailable.', 'unavailable')
        const state = adapter.readCurrent(), raw = adapter.readRawFixture()
        assert(adapter.services.validateCandidate(state, raw), 'The recruiting workspace is unavailable.')
        return projectRecruitingView(state, current.actor, raw, options)
      } catch (error) { return safeRecruitingFailure(error) }
    },
    preview(command) {
      try {
        const current = context(); authorizeRecruitingCommand(current.actor, recruitingCommandKind(command))
        const state = adapter.readCurrent(), raw = adapter.readRawFixture()
        const source = canonicalRecruitingJson(state), fixture = canonicalRecruitingJson(raw)
        const result = buildRecruitingCandidate(state, current.actor, copyRecruiting(command), raw, adapter.services)
        const publicHandle = handle(), characters = source.length + fixture.length
        if (characters > 4_000_000) refuse('This local preview has reached its capacity.', 'limit')
        while (bindings.size >= 8 || [...bindings.values()].reduce((total, binding) => total + binding.characters, 0) + characters > 4_000_000) { const oldest = bindings.keys().next().value; assert(oldest); bindings.delete(oldest) }
        bindings.set(publicHandle, { source, fixture, actor: current.actorKey, epoch: current.epoch, generation: current.generation, command: copyRecruiting(command), createdAt: current.time, characters })
        return { ok: true, handle: publicHandle, preview: copyRecruiting(result.preview) }
      } catch (error) {
        if (error instanceof RecruitingConflict && isRecruitingManager(adapter.readActor())) return { ok: false, code: 'conflict', conflict: copyRecruiting(error.conflict), message: error.message }
        return safeRecruitingFailure(error)
      }
    },
    confirm(request) {
      let binding: Binding | undefined
      try {
        const current = context(); authorizeRecruitingCommand(current.actor, recruitingCommandKind(request))
        exactKeys(request, ['kind', 'handle']); assert(typeof request.handle === 'string')
        binding = bindings.get(request.handle); bindings.delete(request.handle)
        if (!binding || binding.command.kind !== request.kind || binding.actor !== current.actorKey || binding.epoch !== current.epoch || binding.generation !== current.generation) return expired()
        const captured = binding
        let built = false, acceptedCandidate: HrDemoState | null = null
        const accepted = adapter.replaceCurrent(latest => {
          if (built) refuse(expired().message, 'stale')
          const inside = context()
          authorizeRecruitingCommand(inside.actor, request.kind)
          if (inside.actorKey !== captured.actor || inside.epoch !== captured.epoch || inside.generation !== captured.generation || inside.time - captured.createdAt >= 600_000 || canonicalRecruitingJson(latest) !== captured.source || canonicalRecruitingJson(adapter.readRawFixture()) !== captured.fixture) refuse(expired().message, 'stale')
          const candidate = buildRecruitingCandidate(latest, inside.actor, captured.command, adapter.readRawFixture(), adapter.services)
          built = true; acceptedCandidate = candidate.next
          return candidate.next
        })
        if (!accepted || !built || !acceptedCandidate) return expired()
        const after = context()
        return { ok: true, feedback: 'Fictional recruiting action accepted in this browser.', view: projectRecruitingView(acceptedCandidate, after.actor, adapter.readRawFixture()) }
      } catch (error) {
        if (request && typeof request === 'object') { const descriptor = Object.getOwnPropertyDescriptor(request, 'handle'); if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') bindings.delete(descriptor.value as PreviewHandle) }
        return safeRecruitingFailure(error)
      }
    },
    cancel(publicHandle) { bindings.delete(publicHandle) },
    clear,
    dispose() { disposed = true; clear(); issued.clear() },
  }
  return controller
}
export function recruitingInterviewerPort(controller: RecruitingController): RecruitingInterviewerPort {
  const unavailable = (): SafeRefusal => ({ ok: false, code: 'unavailable', message: 'This recruiting preview is unavailable.' })
  function cancelSuppliedHandle(request: unknown) {
    if (request && typeof request === 'object') {
      const descriptor = Object.getOwnPropertyDescriptor(request, 'handle')
      if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') controller.cancel(descriptor.value as PreviewHandle)
    }
  }
  return {
    view() { const result = controller.view(); return 'mode' in result && result.mode !== 'interviewer' ? unavailable() : result as ReturnType<RecruitingInterviewerPort['view']> },
    preview(command) {
      try {
        if (!['save-scorecard', 'submit-scorecard'].includes(recruitingCommandKind(command) as string)) return unavailable()
        const result = controller.preview(command)
        return result.ok && !['save-scorecard', 'submit-scorecard'].includes(result.preview.kind) ? unavailable() : result as ReturnType<RecruitingInterviewerPort['preview']>
      } catch { return unavailable() }
    },
    confirm(request) {
      try {
        if (!['save-scorecard', 'submit-scorecard'].includes(recruitingCommandKind(request) as string)) { cancelSuppliedHandle(request); return unavailable() }
        const result = controller.confirm(request)
        return result.ok && result.view.mode !== 'interviewer' ? unavailable() : result as ReturnType<RecruitingInterviewerPort['confirm']>
      } catch { cancelSuppliedHandle(request); return unavailable() }
    },
    cancel: controller.cancel,
  }
}
