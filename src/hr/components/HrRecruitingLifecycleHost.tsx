import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { DemoStorageStatus } from '@/portals/persistence'
import { useRecruitingPreview } from '../RecruitingPreviewProvider'
import { createRecruitingController, recruitingInterviewerPort } from '../recruiting-controller'
import { recruitingCoreServices } from '../recruiting-services'
import { canonicalRecruitingJson } from '../recruiting-lifecycle-value'
import { effectiveHrFixture } from '../lifecycle'
import { recruitingManagers } from '../recruiting'
import type { HrActor, HrFixture } from '../model'
import type { HrDemoState } from '../persistence'
import type { RecruitingActor, RecruitingManagementPort, ScopedRecruitingView, UtcInstant } from '../recruiting-lifecycle-types'
import { HrRecruitingApplications } from './HrRecruitingApplications'
import { HrRecruitingRequisitions } from './HrRecruitingRequisitions'
import { HrRecruitingInterviews } from './HrRecruitingInterviews'
import { HrRecruitingOwnScorecards } from './HrRecruitingOwnScorecards'

export type HrRecruitingLifecycleHostProps = {
  state: HrDemoState; actor: HrActor; rawFixture: HrFixture; replacementEpoch: number
  storageStatus: DemoStorageStatus
  onUpdate: (build: (latest: HrDemoState) => HrDemoState) => boolean
}
type Inputs = Omit<HrRecruitingLifecycleHostProps, 'storageStatus'>
type Mode = { employeeId: string | null; generation: number }
type ManagementView = Extract<ScopedRecruitingView, { mode: 'management' }>
type Binding = { source: string; fixture: string; actor: string; epoch: number; generation: number }
type ViewReceipt = { binding: Binding; observedAt?: UtcInstant; origin: 'read' | 'confirm' }
type CachedView = ViewReceipt & { view: ScopedRecruitingView }
type Choice = { id: string; label: string }
type Snapshot = {
  displayed: ScopedRecruitingView | null; employeeId: string | null; knownOwn: boolean
  adopted: boolean; reapplyObservation: boolean
  employeeChoices: Choice[]; ownerChoices: Choice[]; managerChoices: Choice[]; assignedChoices: Choice[]
}
const sameBinding = (left: Binding, right: Binding) => left.source === right.source && left.fixture === right.fixture && left.actor === right.actor && left.epoch === right.epoch && left.generation === right.generation
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
const unavailable = 'This recruiting preview is unavailable. Your temporary fields are kept.'

/** Private imperative store: React observes immutable public snapshots. Source,
 * updater and opaque-view receipts never become part of a child snapshot. */
function createHostRuntime(initial: Inputs, initialMode: Mode) {
  let current = { ...initial }, incoming = { state: initial.state, epoch: initial.replacementEpoch, mode: initialMode }, mode = initialMode
  let cached: CachedView | null = null, issuedViews = new WeakMap<ScopedRecruitingView, ViewReceipt>(), reapplyObservation = false
  let disposed = false
  const listeners = new Set<() => void>()
  function nativeActor() { const value = { ...current.actor }; if (value.employeeId === undefined) delete value.employeeId; if (value.contractorId === undefined) delete value.contractorId; return value }
  function readActor(): RecruitingActor { return mode.employeeId === null ? { mode: 'native', actor: nativeActor() } : { mode: 'interviewer', employeeId: mode.employeeId } }
  function binding(): Binding { return { source: canonicalRecruitingJson(current.state), fixture: canonicalRecruitingJson(current.rawFixture), actor: canonicalRecruitingJson(readActor()), epoch: current.replacementEpoch, generation: mode.generation } }
  function identity() { return canonicalRecruitingJson({ actor: nativeActor(), epoch: current.replacementEpoch, mode }) }
  function createController() {
    return createRecruitingController({
      readCurrent: () => current.state, readActor,
      readRawFixture: () => current.rawFixture,
      readEpoch: () => current.replacementEpoch,
      readModeGeneration: () => mode.generation,
      replaceCurrent(build) {
        let ran = false, candidate: HrDemoState | undefined
        const accepted = current.onUpdate(latest => {
          if (ran) throw new Error('The trusted update callback ran more than once.')
          ran = true; candidate = build(latest); return candidate
        })
        if (!accepted || !ran || !candidate) return false
        current.state = candidate
        return true
      },
      randomBytes(length) {
        if (length !== 32) throw new Error('Secure local preview randomness is unavailable.')
        const bytes = new Uint8Array(32)
        globalThis.crypto.getRandomValues(bytes)
        return bytes
      },
      monotonicNow: () => globalThis.performance.now(),
      services: recruitingCoreServices,
    })
  }
  let controller = createController()
  function knownAssigned(employeeId: string) {
    const known = [...current.rawFixture.employees, ...current.state.recruiting.hiredEmployees].some(person => person.id === employeeId)
    return known && Boolean(current.state.recruiting.lifecycle?.interviews.some(interview => interview.participantEmployeeIds.includes(employeeId)))
  }
  function makeSnapshot(): Snapshot {
    let displayed: ScopedRecruitingView | null = null
    try {
      const latestBinding = binding()
      if (cached && !sameBinding(cached.binding, latestBinding)) { if (cached.observedAt !== undefined) reapplyObservation = true; cached = null }
      const result = controller.view()
      if ('mode' in result) displayed = cached?.view.mode === result.mode ? cached.view : result
    } catch { displayed = null }
    // Own mode never computes or publishes all-staff choice lists.
    const effective = mode.employeeId === null && displayed?.mode === 'management' ? effectiveHrFixture(current.state, current.rawFixture) : null
    const choice = (person: { id: string; firstName: string; lastName: string }) => ({ id: person.id, label: `${person.firstName} ${person.lastName}` })
    const employeeChoices = effective?.employees.map(choice) ?? []
    return {
      displayed, employeeId: mode.employeeId, knownOwn: mode.employeeId !== null && knownAssigned(mode.employeeId),
      adopted: Object.hasOwn(current.state.recruiting, 'lifecycle'), reapplyObservation,
      employeeChoices, ownerChoices: effective?.employees.filter(person => person.employmentStatus === 'active').map(choice) ?? [],
      managerChoices: effective ? recruitingManagers(effective).map(choice) : [], assignedChoices: employeeChoices.filter(person => knownAssigned(person.id)),
    }
  }
  let snapshot = makeSnapshot()
  function publish() { snapshot = makeSnapshot(); for (const listener of listeners) listener() }
  function clearBindings() { controller.clear(); cached = null; issuedViews = new WeakMap(); reapplyObservation = false }
  function remember(view: ScopedRecruitingView, origin: ViewReceipt['origin'], observedAt?: UtcInstant) {
    const receipt = { binding: binding(), origin, ...(observedAt === undefined ? {} : { observedAt }) }
    issuedViews.set(view, receipt)
    return receipt
  }
  const port: RecruitingManagementPort = {
    view(options) { const result = controller.view(options); if ('mode' in result) remember(result, 'read', options?.observedAt); return result },
    preview(command) { return controller.preview(command) },
    confirm(request) {
      const result = controller.confirm(request)
      if (result.ok) {
        if (cached?.observedAt !== undefined) reapplyObservation = true
        const receipt = remember(result.view, 'confirm'); cached = { ...receipt, view: result.view }; publish()
      }
      return result
    },
    cancel(handle) { controller.cancel(handle) }, clear() { controller.clear() }, dispose() { controller.dispose() },
  }
  return {
    port, ownPort: recruitingInterviewerPort(port), knownAssigned,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    sync(next: Inputs, nextMode: Mode) {
      const before = identity()
      // Unchanged parent props must not replace an accepted synchronous result.
      const state = incoming.state !== next.state || incoming.epoch !== next.replacementEpoch ? next.state : current.state
      if (incoming.mode.employeeId !== nextMode.employeeId || incoming.mode.generation !== nextMode.generation) mode = nextMode
      incoming = { state: next.state, epoch: next.replacementEpoch, mode: nextMode }; current = { ...next, state }
      if (before !== identity()) clearBindings()
      publish()
    },
    start() { if (disposed) { controller = createController(); disposed = false; publish() } },
    stop() { controller.dispose(); disposed = true; cached = null; issuedViews = new WeakMap() },
    acceptView(view: ScopedRecruitingView) {
      const receipt = issuedViews.get(view)
      if (!receipt || !sameBinding(receipt.binding, binding())) { reapplyObservation = true; publish(); return }
      if (receipt.origin === 'read') reapplyObservation = false
      cached = { ...receipt, view }; publish()
    },
    acceptedMode(employeeId: string | null) {
      if (mode.employeeId === employeeId) return
      mode = { employeeId, generation: mode.generation + 1 }; clearBindings(); publish()
    },
  }
}

/** Trusted boundary. Full state stays private; children receive only public
 * DTOs and capabilities. Layout synchronization finishes before user events. */
export function HrRecruitingLifecycleHost({ state, actor, rawFixture, replacementEpoch, storageStatus, onUpdate }: HrRecruitingLifecycleHostProps) {
  const previewMode = useRecruitingPreview()
  const [host] = useState(() => createHostRuntime({ state, actor, rawFixture, replacementEpoch, onUpdate }, { employeeId: previewMode.interviewerEmployeeId, generation: previewMode.generation }))
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot)
  const [entry, setEntry] = useState(''), [entryError, setEntryError] = useState('')
  useLayoutEffect(() => {
    host.sync({ state, actor, rawFixture, replacementEpoch, onUpdate }, { employeeId: previewMode.interviewerEmployeeId, generation: previewMode.generation })
  }, [host, state, actor, rawFixture, replacementEpoch, onUpdate, previewMode.interviewerEmployeeId, previewMode.generation])
  useEffect(() => { host.start(); return () => host.stop() }, [host])
  function enterInterviewer(event: FormEvent) {
    event.preventDefault(); setEntryError('')
    if (!entry || !host.knownAssigned(entry)) { setEntryError('Choose an assigned fictional interviewer.'); return }
    if (previewMode.enter(entry)) host.acceptedMode(entry)
  }
  function leaveInterviewer() { if (previewMode.leave()) host.acceptedMode(null) }
  const { displayed, employeeId } = snapshot
  if (employeeId !== null) {
    const own = displayed?.mode === 'interviewer' && displayed.employeeId === employeeId && snapshot.knownOwn ? displayed : null
    return <section aria-label="Isolated interviewer preview" className="mx-auto w-full max-w-4xl space-y-5 px-5 py-8"><header className="space-y-3"><h1 className="text-2xl font-semibold">Fictional interviewer preview</h1><p role="status" className="text-sm leading-6">{storageStatus.kind === 'unavailable' ? 'Accepted changes are only in memory. Refresh may lose your changes.' : 'Fictional changes use this browser’s local storage. No account or provider is connected.'}</p><button type="button" className={secondary} onClick={leaveInterviewer}>Leave interviewer preview</button></header>{own ? <HrRecruitingOwnScorecards view={own} port={host.ownPort} /> : <p role="alert" className="text-sm text-red-900">{unavailable}</p>}</section>
  }
  if (displayed?.mode !== 'management') return <p role="alert" className="text-sm text-red-900">{unavailable}</p>
  const management: ManagementView = displayed
  return <section aria-label="Recruiting lifecycle workspace" className="min-w-0 space-y-6">
    {snapshot.reapplyObservation && <p role="status" className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">Saved recruiting facts changed. Reapply the explicit duration observation to refresh open durations.</p>}
    <HrRecruitingApplications view={management} port={host.port} adopted={snapshot.adopted} onView={host.acceptView} />
    {snapshot.adopted && <><HrRecruitingRequisitions view={{ jobs: management.jobs, requisitions: management.requisitions }} port={host.port} ownerChoices={snapshot.ownerChoices} managerChoices={snapshot.managerChoices} /><HrRecruitingInterviews view={management} port={host.port} participantChoices={snapshot.employeeChoices.map(person => ({ employeeId: person.id, displayName: person.label }))} />
      <section aria-label="Enter an assigned interviewer preview" className="min-w-0 space-y-4 rounded-xl border border-neutral-200 bg-white p-5"><h2 className="text-lg font-semibold">Open an assigned fictional interviewer</h2><p className="text-sm leading-6 text-neutral-600">This is a fictional local preview. Anyone using this browser profile can access the complete HR save. Complete HR exports include saved private scorecards and their history. Leaving the preview opens the ordinary workspace tools; it does not sign in or grant provider access.</p><form className="space-y-4" onSubmit={enterInterviewer}><label className="block text-sm font-medium">Assigned fictional interviewer<select className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" required value={entry} onChange={event => { setEntry(event.target.value); setEntryError('') }}><option value="">Choose an assigned interviewer</option>{snapshot.assignedChoices.map(person => <option key={person.id} value={person.id}>{person.label} · {person.id}</option>)}</select></label><button type="submit" className={secondary} disabled={!snapshot.assignedChoices.length}>Enter interviewer preview</button></form>{!snapshot.assignedChoices.length && <p className="text-sm text-neutral-600">Schedule an interview with known fictional participants before entering an interviewer preview.</p>}{entryError && <p role="alert" className="text-sm text-red-900">{entryError}</p>}</section>
    </>}
  </section>
}
