import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { NAVIGATION_EVENT } from '@/lib/navigation'
import { createCrmMergeHost, type CrmMergeHostInputs } from './merge-host'
import { CrmMerges } from './CrmMerges'

/** Trusted composition. Complete source/identity/replacement accessors are
 * confined to the host; the child sees a permitted view and opaque ports. */
export function CrmMergeHost(inputs: CrmMergeHostInputs) {
  const [host] = useState(() => createCrmMergeHost(inputs))
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot)
  useLayoutEffect(() => {
    host.start()
    const navigated = () => host.navigated()
    window.addEventListener(NAVIGATION_EVENT, navigated)
    return () => { window.removeEventListener(NAVIGATION_EVENT, navigated); host.stop() }
  }, [host])
  return <CrmMerges key={snapshot.lifetime} view={snapshot.view} port={snapshot.port} />
}
