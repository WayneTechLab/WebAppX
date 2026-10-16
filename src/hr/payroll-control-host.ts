import type { UnsavedTransitionOptions } from '@/portals/unsaved-work-core'
import { canonicalRecruitingJson } from './recruiting-lifecycle-value'
import { createPayrollControlController } from './payroll-control-controller'
import { isHrDemoState, type HrDemoState } from './persistence'
import { authorizePayrollControlActor } from './payroll-control'
import { canonicalPayrollJson } from './payroll-control-value'
import type { HrActor, HrFixture } from './model'
import type { PayrollControlHandle, PayrollControlPort, PayrollControlRefusal, PayrollControlView } from './payroll-control-types'

export type PayrollControlHostInputs = {
  state: HrDemoState; actor: HrActor; rawFixture: HrFixture; replacementEpoch: number
  active: boolean; readActive: () => boolean; onUpdate: (build: (latest: HrDemoState) => HrDemoState) => boolean
}
type Transition = (options: UnsavedTransitionOptions, commit: () => void) => boolean
type Snapshot = Extract<PayrollControlView, { mode: 'writer' }> | PayrollControlRefusal
const unavailable = (): PayrollControlRefusal => ({ ok: false, code: 'unavailable', message: 'These fictional payroll controls are unavailable for this preview. No change was accepted.' })
function actorKey(actor: HrActor) { try { return canonicalRecruitingJson(actor) } catch { return null } }

/** The complete source, updater and private controller never enter a UI DTO. */
export function createPayrollControlHost(initial: PayrollControlHostInputs, transition: Transition) {
  let current = { ...initial }, incoming = { state: initial.state, epoch: initial.replacementEpoch }
  let requestTransition = transition, generation = 0, disposed = false
  const listeners = new Set<() => void>()
  function writerAllowed(requireActiveRoute = true) {
    if (!current.active || disposed) return false
    try {
      if (requireActiveRoute && current.readActive() !== true) return false
      // Actor shape is resolved before reading either source or target records.
      authorizePayrollControlActor(current.actor)
      canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: current.state })
      canonicalPayrollJson(current.rawFixture)
      if (current.state.managementRole !== current.actor.role) return false
      return !current.actor.employeeId || [...current.rawFixture.employees, ...current.state.recruiting.hiredEmployees].some(employee => employee.id === current.actor.employeeId)
    } catch { return false }
  }
  function createController() {
    return createPayrollControlController({
      readCurrent: () => current.state, readRawFixture: () => current.rawFixture,
      readActor: () => current.actor, readEpoch: () => current.replacementEpoch,
      readModeGeneration: () => generation,
      monotonicNow: () => globalThis.performance.now(),
      randomBytes(length) {
        if (length !== 32) throw new Error('Secure local preview randomness is unavailable.')
        const bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes); return bytes
      },
      services: { validateCandidate: (candidate, fixture) => isHrDemoState(candidate, fixture) },
      replaceCurrent(build) {
        if (!writerAllowed() || disposed) return false
        let ran = false, candidate: HrDemoState | undefined
        const accepted = current.onUpdate(latest => {
          if (ran) throw new Error('The trusted payroll update callback ran more than once.')
          ran = true; candidate = build(latest); return candidate
        })
        if (!accepted || !ran || !candidate) return false
        current.state = candidate
        return true
      },
    })
  }
  let controller = createController()
  function makeSnapshot(): Snapshot {
    // Retained hidden portals keep their temporary forms; command ports still
    // read current route visibility at the instant of every attempted action.
    if (!writerAllowed(false)) return unavailable()
    try { const view = controller.view(); return 'mode' in view && view.mode === 'writer' ? view : unavailable() }
    catch { return unavailable() }
  }
  let snapshot = makeSnapshot()
  function publish() { snapshot = makeSnapshot(); for (const listener of listeners) listener() }
  const port: PayrollControlPort = {
    view() { return makeSnapshot() },
    preview(command) { return writerAllowed() && !disposed ? controller.preview(command) : unavailable() },
    confirm(request) {
      // Denied access must not reach target lookup. Consume only a safely
      // supplied own data-property handle, without invoking an accessor.
      if (!writerAllowed() || disposed) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(request, 'handle')
          if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') controller.cancel(descriptor.value as PayrollControlHandle)
        } catch { /* An invalid request exposes no target or source detail. */ }
        return unavailable()
      }
      const result = controller.confirm(request)
      if (result.ok) publish()
      return result
    },
    cancel(handle) { controller.cancel(handle) },
  }
  return {
    port,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setTransition(next: Transition) { requestTransition = next },
    sync(next: PayrollControlHostInputs) {
      const identityChanged = actorKey(current.actor) !== actorKey(next.actor)
        || current.active !== next.active || current.replacementEpoch !== next.replacementEpoch
      const state = incoming.state !== next.state || incoming.epoch !== next.replacementEpoch ? next.state : current.state
      incoming = { state: next.state, epoch: next.replacementEpoch }; current = { ...next, state }
      if (identityChanged) { generation++; controller.clear() }
      publish()
    },
    guardClosure(commit: () => void) {
      // Resolve current authority before examining target records or requesting
      // access to other forms. A source change during a queued choice is still
      // checked by the one-use controller inside the latest root callback.
      if (!writerAllowed() || disposed) return false
      const employeeIds = new Set([...current.rawFixture.employees, ...current.state.recruiting.hiredEmployees].map(employee => employee.id))
      const ids = new Set(['hr:payroll:period', 'hr:payroll:rate'])
      for (const id of employeeIds) { ids.add(`hr:time:${id}:manual`); ids.add(`hr:time:${id}:timer`) }
      for (const entry of current.state.workflow.timeEntries) { ids.add(`hr:time:${entry.id}:correction`); ids.add(`hr:time:${entry.id}:return`) }
      return requestTransition({ portal: 'hr', ids: [...ids], retain: false, label: 'Close sample period; review temporary time and payroll changes. Discarded temporary changes stay discarded if the later closure is stale.' }, commit)
    },
    start() { if (disposed) { disposed = false; controller = createController(); publish() } },
    stop() { controller.dispose(); disposed = true },
  }
}
