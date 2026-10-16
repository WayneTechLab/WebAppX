import type { HrDemoState } from './persistence'
import type { PayrollControlCommand, PayrollControlController, PayrollControlControllerOptions, PayrollControlHandle, PayrollControlRefusal } from './payroll-control-types'
import { authorizePayrollControlActor, buildPayrollControlCandidate, projectPayrollControlView } from './payroll-control'
import { canonicalPayrollJson, copyPayroll, payrollAssert as assert, payrollFailure, payrollKeys, payrollRefuse } from './payroll-control-value'

type Binding = { source: string; fixture: string; actor: string; epoch: number; generation: number; command: PayrollControlCommand; createdAt: number; characters: number }
const expired = (): PayrollControlRefusal => ({ ok: false, code: 'stale', message: 'This payroll preview expired or changed. Preview again; your inputs are kept.' })
/** One document owner. Complete bindings and candidates remain private to this closure. */
export function createPayrollControlController(adapter: PayrollControlControllerOptions): PayrollControlController {
  const bindings = new Map<PayrollControlHandle, Binding>(), issued = new Set<string>()
  let disposed = false, lastTime = -1, identity = ''
  const clear = () => bindings.clear()
  function context() {
    if (disposed) payrollRefuse('This sample payroll preview is unavailable.', 'unavailable')
    const actor = adapter.readActor(), epoch = adapter.readEpoch(), generation = adapter.readModeGeneration()
    assert(Number.isSafeInteger(epoch) && epoch >= 0 && Number.isSafeInteger(generation) && generation >= 0)
    const actorKey = canonicalPayrollJson(actor), nextIdentity = canonicalPayrollJson({ actor, epoch, generation })
    if (identity !== nextIdentity) { clear(); identity = nextIdentity }
    const time = adapter.monotonicNow()
    if (!Number.isFinite(time) || time < 0 || time < lastTime) { clear(); payrollRefuse('Secure local preview timing is unavailable.', 'unavailable') }
    lastTime = time
    for (const [handle, binding] of bindings) if (time - binding.createdAt >= 600_000) bindings.delete(handle)
    return { actor, actorKey, epoch, generation, time }
  }
  function consumeOwnHandle(request: unknown) {
    if (request && typeof request === 'object') {
      const descriptor = Object.getOwnPropertyDescriptor(request, 'handle')
      if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') bindings.delete(descriptor.value as PayrollControlHandle)
    }
  }
  function issueHandle(): PayrollControlHandle {
    if (issued.size >= 4096) payrollRefuse('Temporary payroll preview capacity reached. Save your current work, then reload this page.', 'limit')
    for (let attempt = 0; attempt < 3; attempt++) {
      let bytes: Uint8Array
      try { bytes = adapter.randomBytes(32) } catch { payrollRefuse('Secure local preview randomness is unavailable.', 'unavailable') }
      if (!(bytes instanceof Uint8Array) || bytes.length !== 32) payrollRefuse('Secure local preview randomness is unavailable.', 'unavailable')
      const result = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') as PayrollControlHandle
      if (!issued.has(result)) { issued.add(result); return result }
    }
    payrollRefuse('Secure local preview randomness is unavailable.', 'unavailable')
  }
  const controller: PayrollControlController = {
    view() {
      try {
        const current = context()
        payrollKeys(current.actor, ['role'], ['employeeId'])
        assert(['employer-owner', 'payroll-admin', 'employee', 'auditor'].includes(current.actor.role), 'This sample payroll view is unavailable.')
        const state = adapter.readCurrent(), raw = adapter.readRawFixture()
        assert(adapter.services.validateCandidate(state, raw), 'The sample payroll workspace is unavailable.')
        return projectPayrollControlView(state, current.actor, raw)
      } catch (error) { return payrollFailure(error) }
    },
    preview(command) {
      try {
        const current = context(); authorizePayrollControlActor(current.actor)
        const state = adapter.readCurrent(), raw = adapter.readRawFixture()
        const source = canonicalPayrollJson(state), fixture = canonicalPayrollJson(raw)
        const candidate = buildPayrollControlCandidate(state, current.actor, command, raw, adapter.services)
        const characters = source.length + fixture.length
        if (characters > 4_000_000) payrollRefuse('This local payroll preview has reached its capacity.', 'limit')
        const handle = issueHandle()
        while (bindings.size >= 8 || [...bindings.values()].reduce((total, binding) => total + binding.characters, 0) + characters > 4_000_000) {
          const oldest = bindings.keys().next().value; assert(oldest); bindings.delete(oldest)
        }
        bindings.set(handle, { source, fixture, actor: current.actorKey, epoch: current.epoch, generation: current.generation, command: copyPayroll(command), createdAt: current.time, characters })
        return { ok: true, handle, preview: copyPayroll(candidate.preview) }
      } catch (error) { return payrollFailure(error) }
    },
    confirm(request) {
      try {
        const current = context(); authorizePayrollControlActor(current.actor)
        payrollKeys(request, ['kind', 'handle'])
        assert((request.kind === 'close-period' || request.kind === 'adjust-receipt') && typeof request.handle === 'string')
        const captured = bindings.get(request.handle); bindings.delete(request.handle)
        if (!captured || captured.command.kind !== request.kind || captured.actor !== current.actorKey || captured.epoch !== current.epoch || captured.generation !== current.generation) return expired()
        let invoked = false, acceptedCandidate: HrDemoState | null = null
        const accepted = adapter.replaceCurrent(latest => {
          if (invoked) payrollRefuse(expired().message, 'stale')
          invoked = true
          const inside = context(); authorizePayrollControlActor(inside.actor)
          const raw = adapter.readRawFixture()
          if (inside.actorKey !== captured.actor || inside.epoch !== captured.epoch || inside.generation !== captured.generation || inside.time - captured.createdAt >= 600_000 || canonicalPayrollJson(latest) !== captured.source || canonicalPayrollJson(raw) !== captured.fixture) payrollRefuse(expired().message, 'stale')
          const candidate = buildPayrollControlCandidate(latest, inside.actor, captured.command, raw, adapter.services)
          acceptedCandidate = candidate.next
          return candidate.next
        })
        if (!accepted || !invoked || !acceptedCandidate) return expired()
        const after = context()
        return { ok: true, feedback: 'Fictional payroll control accepted in memory. Check the browser storage notice before refreshing.', view: projectPayrollControlView(acceptedCandidate, after.actor, adapter.readRawFixture()) }
      } catch (error) { consumeOwnHandle(request); return payrollFailure(error) }
    },
    cancel(handle) { bindings.delete(handle) }, clear,
    dispose() { disposed = true; clear() },
  }
  return controller
}
