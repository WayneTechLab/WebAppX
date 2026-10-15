import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { installNavigationGuard, NAVIGATION_EVENT } from '../lib/navigation'
import { createUnsavedWorkController, isUnsavedPortalShell, unsavedPortalForPath, unsavedRouteTransition, type UnsavedPortal, type UnsavedTransitionOptions, type UnsavedWorkParticipant } from './unsaved-work-core'

type Controller = ReturnType<typeof createUnsavedWorkController>
const Context = createContext<Controller | null>(null)

export type { UnsavedPortal, UnsavedTransitionOptions, UnsavedWorkParticipant } from './unsaved-work-core'

export function UnsavedWorkProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(createUnsavedWorkController)
  const pending = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const dialog = useRef<HTMLDialogElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const installation = installNavigationGuard((request, commit) => {
      const owner = unsavedPortalForPath(request.from)
      if (owner) controller.rememberOwnerLocation(owner, request.from)
      return controller.request({ ...unsavedRouteTransition(request.from, request.to), ...(request.historyFallback ? { historyNotice: 'To preserve your unsaved work, this page is kept at the current browser history position. Leaving opens the requested destination at that same position. Back and Forward entries may differ.' } : {}) }, commit)
    })
    const releaseFocus = controller.setOwnerActivation((location, focus) => {
      installation.activateRetainedOwner(location, () => window.requestAnimationFrame(focus))
    })
    return () => { releaseFocus(); installation() }
  }, [controller])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!controller.hasDirty()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const clearExitedSession = () => {
      if (!isUnsavedPortalShell(window.location.pathname)) controller.clearSlots()
    }
    window.addEventListener('beforeunload', warn)
    window.addEventListener(NAVIGATION_EVENT, clearExitedSession)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener(NAVIGATION_EVENT, clearExitedSession)
    }
  }, [controller])
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (pending && !element.open) { element.showModal(); keep.current?.focus() }
    else if (!pending && element.open) { element.close(); controller.takeFocus()?.() }
  }, [pending, controller])

  return <Context.Provider value={controller}>
    {children}
    <dialog ref={dialog} aria-labelledby={headingId} aria-describedby={descriptionId} className="m-auto max-h-[90vh] w-[min(36rem,calc(100%_-_2rem))] overflow-y-auto rounded-xl border border-amber-300 bg-white p-6 text-neutral-950 shadow-xl backdrop:bg-neutral-950/40" onCancel={event => { event.preventDefault(); if (pending) controller.resolve(pending.id, 'keep-editing') }}>
      {pending && <><h2 id={headingId} className="text-xl font-semibold">Leave with unsaved changes?</h2><p id={descriptionId} className="mt-3 text-sm leading-6">{pending.label}. These forms contain temporary changes that have not been accepted as workspace records.</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{pending.participants.map(participant => <li key={participant.id}>{participant.label}</li>)}</ul>
        {pending.error && <p role="alert" className="mt-4 text-sm text-red-900">{pending.error}</p>}
        {pending.historyNotice && <p className="mt-4 text-sm leading-6">{pending.historyNotice}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button ref={keep} type="button" className="min-h-11 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold" onClick={() => controller.resolve(pending.id, 'keep-editing')}>Keep editing</button><button type="button" className="min-h-11 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => controller.resolve(pending.id, 'discard', () => dialog.current?.close())}>Discard and leave</button>{pending.canRetain && <button type="button" className="min-h-11 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold" onClick={() => controller.resolve(pending.id, 'retain', () => dialog.current?.close())}>Leave and keep draft</button>}</div>
        {pending.canRetain && <p className="mt-3 text-xs leading-5 text-neutral-600">Keeping a draft retains temporary inputs only in this open page. Refresh, closing this page or a later replacement can clear them. They are excluded from workspace backups and restore points.</p>}
      </>}
    </dialog>
  </Context.Provider>
}

/** The owning form controls its baseline and resets. Reading refs at the
 * decision boundary avoids a save -> navigation race with a pending effect. */
// eslint-disable-next-line react-refresh/only-export-components
export function useUnsavedWork(participant: UnsavedWorkParticipant) {
  const controller = useContext(Context)
  const latest = useRef(participant)
  useLayoutEffect(() => {
    latest.current = participant
    controller?.rememberOwnerLocation(participant.portal, `${window.location.pathname}${window.location.search}${window.location.hash}`)
  })
  useLayoutEffect(() => controller?.register(() => {
    const current = latest.current
    return { ...current, focus: current.focus ? () => controller.focusOwner(current.portal, () => latest.current.focus?.()) : undefined }
  }), [controller, participant.id])
}

/** The shell supplies its already validated return destinations. This keeps
 * unsupported URL descendants from replacing a mounted form's real owner. */
// eslint-disable-next-line react-refresh/only-export-components
export function useUnsavedOwnerLocations(locations: Partial<Record<UnsavedPortal, string>>) {
  const controller = useContext(Context)
  useLayoutEffect(() => {
    for (const portal of ['hr', 'cms', 'crm'] as const) {
      const location = locations[portal]
      if (location) controller?.rememberOwnerLocation(portal, location, true)
    }
  }, [controller, locations])
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnsavedTransition() {
  const controller = useContext(Context)
  return useCallback((options: UnsavedTransitionOptions, commit: () => void) => {
    if (!controller) { commit(); return true }
    return controller.request({ ...options, retain: options.retain === true && isUnsavedPortalShell(window.location.pathname) }, commit)
  }, [controller])
}

/** Deliberately separate from domain persistence. A custom adopted router
 * without this optional provider gets ordinary component-local state. */
// eslint-disable-next-line react-refresh/only-export-components
export function useVolatileSlot<T>(key: string, initial: () => T): [T, Dispatch<SetStateAction<T>>] {
  const controller = useContext(Context)
  const [fallback] = useState(createUnsavedWorkController)
  const owner = controller ?? fallback
  // The initializer belongs to a new binding, like useState's initializer. A
  // render after session exit must retain the old binding until it unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const binding = useMemo(() => owner.bindSlot(key, initial), [owner, key])
  const value = useSyncExternalStore(owner.subscribe, binding.read, binding.read)
  const set = useCallback<Dispatch<SetStateAction<T>>>(update => binding.write(update), [binding])
  return [value, set]
}
