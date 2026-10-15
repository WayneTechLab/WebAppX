import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Own only the surface, never its React-managed children. Detachment keeps the
 * same portal target available for StrictMode effect cleanup/setup replay. */
function createRetainedSurface() {
  let target: HTMLDivElement | null = null
  const listeners = new Set<() => void>()
  return {
    read: () => target,
    server: () => null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    place(anchor: HTMLDivElement | null, suspended: boolean) {
      if (!anchor) { target?.remove(); return }
      if (!target) {
        target = anchor.ownerDocument.createElement('div')
        for (const listener of [...listeners]) listener()
      }
      if (suspended) target.remove()
      else if (target.parentNode !== anchor) anchor.appendChild(target)
    },
    detach() { target?.remove() },
  }
}

/** Retain mounted portal hooks and drafts while removing their entire surface
 * from the connected document. This controls presentation, not domain access. */
export function RetainedPortalSurface({ suspended, children }: { suspended: boolean; children: ReactNode }) {
  const [surface] = useState(createRetainedSurface)
  const anchor = useRef<HTMLDivElement>(null)
  const target = useSyncExternalStore(surface.subscribe, surface.read, surface.server)
  useLayoutEffect(() => {
    surface.place(anchor.current, suspended)
    return surface.detach
  }, [surface, suspended])

  return <div ref={anchor} data-retained-portal-surface="">{target ? createPortal(children, target) : null}</div>
}
