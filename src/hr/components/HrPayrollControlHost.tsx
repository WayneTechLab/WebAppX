import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { useUnsavedTransition } from '@/portals/unsaved-work'
import { createPayrollControlHost, type PayrollControlHostInputs } from '../payroll-control-host'
import { HrPayrollControl } from './HrPayrollControl'

/** Trusted composition; the writer child sees only its projection and ports. */
export function HrPayrollControlHost(props: PayrollControlHostInputs) {
  const transition = useUnsavedTransition()
  const [host] = useState(() => createPayrollControlHost(props, transition))
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot)
  useLayoutEffect(() => { host.start(); return () => host.stop() }, [host])
  // The transition hook supplies a new callback on render. Updating that private
  // callback must not publish a new external-store snapshot and cause a loop.
  useLayoutEffect(() => { host.setTransition(transition) }, [host, transition])
  const { state, actor, rawFixture, replacementEpoch, active, readActive, onUpdate } = props
  useLayoutEffect(() => { host.sync({ state, actor, rawFixture, replacementEpoch, active, readActive, onUpdate }) }, [host, state, actor, rawFixture, replacementEpoch, active, readActive, onUpdate])
  if (!('mode' in snapshot) || snapshot.mode !== 'writer') return <p role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-800">Fictional payroll controls are unavailable for this preview.</p>
  return <HrPayrollControl view={snapshot} port={host.port} guardClosure={host.guardClosure} />
}
