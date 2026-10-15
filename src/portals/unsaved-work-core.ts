export type UnsavedPortal = 'hr' | 'cms' | 'crm'
export type UnsavedWorkParticipant = {
  id: string
  portal: UnsavedPortal
  label: string
  isDirty: () => boolean
  discard: () => void
  focus?: () => void
}
export type UnsavedTransitionOptions = {
  portal?: UnsavedPortal
  ids?: readonly string[]
  label: string
  retain?: boolean
  historyNotice?: string
}
export type UnsavedDecision = 'keep-editing' | 'discard' | 'retain'
export type PendingUnsavedTransition = {
  id: number
  label: string
  participants: { id: string; portal: UnsavedPortal; label: string }[]
  canRetain: boolean
  error?: string
  historyNotice?: string
}
type Registration = { token: object; read: () => UnsavedWorkParticipant }
type Pending = { view: PendingUnsavedTransition; options: UnsavedTransitionOptions; commit: () => void }
type SlotUpdate<T> = T | ((previous: T) => T)

/** Only callbacks and volatile UI values live here. No browser storage, domain
 * model, provider, authentication or application route catalog is imported. */
export function createUnsavedWorkController() {
  const registrations = new Map<string, Registration>()
  const listeners = new Set<() => void>()
  let slots = new Map<string, unknown>()
  const ownerLocations = new Map<UnsavedPortal, string>()
  const validatedOwnerLocations = new Map<UnsavedPortal, string>()
  const supportedObservedLocations = new Map<UnsavedPortal, string>()
  let activateOwner: ((location: string, focus: () => void) => void) | undefined
  let pending: Pending | null = null
  let sequence = 0
  let focusAfterClose: (() => void) | undefined
  const emit = () => { for (const listener of [...listeners]) listener() }

  function selected(options: UnsavedTransitionOptions) {
    const ids = options.ids && new Set(options.ids)
    return [...registrations.values()].flatMap(({ read }) => {
      const participant = read()
      if ((options.portal && participant.portal !== options.portal) || (ids && !ids.has(participant.id))) return []
      // Failure to inspect a form must not silently authorize its destruction.
      try { return participant.isDirty() ? [participant] : [] } catch { return [participant] }
    })
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => pending?.view ?? null,
    register(read: () => UnsavedWorkParticipant) {
      const { id } = read()
      if (!id) throw new Error('An unsaved form needs a stable identity.')
      const token = {}
      registrations.set(id, { token, read })
      return () => { if (registrations.get(id)?.token === token) registrations.delete(id) }
    },
    hasDirty: () => selected({ label: 'Leave this page' }).length > 0,
    request(options: UnsavedTransitionOptions, commit: () => void) {
      if (pending) {
        if (options.historyNotice && pending.view.historyNotice !== options.historyNotice) {
          pending = { ...pending, view: { ...pending.view, historyNotice: options.historyNotice } }
          emit()
        }
        return false
      }
      const participants = selected(options)
      if (!participants.length) { commit(); return true }
      focusAfterClose = undefined
      pending = {
        view: { id: ++sequence, label: options.label, participants: participants.map(({ id, portal, label }) => ({ id, portal, label })), canRetain: options.retain === true, ...(options.historyNotice ? { historyNotice: options.historyNotice } : {}) },
        options: { ...options, ids: options.ids && [...options.ids] }, commit,
      }
      emit()
      return false
    },
    resolve(id: number, decision: UnsavedDecision, beforeCommit?: () => void) {
      if (!pending || pending.view.id !== id || (decision === 'retain' && !pending.view.canRetain)) return false
      const intent = pending
      const participants = selected(intent.options)
      if (decision === 'keep-editing') {
        focusAfterClose = participants.find(participant => participant.focus)?.focus
        pending = null
        emit()
        return true
      }
      if (decision === 'discard') {
        try { for (const participant of participants) participant.discard() } catch {
          pending = { ...intent, view: { ...intent.view, error: 'This form could not discard its temporary changes. Keep editing and review it before leaving.' } }
          emit()
          return false
        }
      }
      // Native dialog closure restores its opener's focus. Complete that
      // restoration before a successful transition focuses its destination.
      beforeCommit?.()
      pending = null
      emit()
      intent.commit()
      return true
    },
    takeFocus() { const focus = focusAfterClose; focusAfterClose = undefined; return focus },
    setOwnerActivation(activate: (location: string, focus: () => void) => void) { activateOwner = activate; return () => { if (activateOwner === activate) activateOwner = undefined } },
    rememberOwnerLocation(portal: UnsavedPortal, location: string, validated = false) {
      if (unsavedPortalForPath(location) !== portal) return
      if (validated) validatedOwnerLocations.set(portal, location)
      else ownerLocations.set(portal, location)
      const supported = validatedOwnerLocations.get(portal), observed = ownerLocations.get(portal)
      if (supported && observed && pathname(supported) === pathname(observed)) supportedObservedLocations.set(portal, observed)
    },
    focusOwner(portal: UnsavedPortal, focus: () => void) {
      const supported = validatedOwnerLocations.get(portal)
      const latest = ownerLocations.get(portal), retained = supportedObservedLocations.get(portal)
      const observed = supported && latest && pathname(latest) !== pathname(supported) ? retained : latest
      const location = supported && (!observed || pathname(observed) !== pathname(supported)) ? supported : observed ?? supported
      if (location && activateOwner) activateOwner(location, focus)
      else focus()
    },
    bindSlot<T>(key: string, initial: () => T) {
      // A mounted subscriber remains bound to its original session map. After
      // exit, its last snapshot cannot initialize or write the new session.
      const session = slots
      return {
        read() { if (!session.has(key)) session.set(key, initial()); return session.get(key) as T },
        write(update: SlotUpdate<T>) {
          if (session !== slots) return
          const previous = session.has(key) ? session.get(key) as T : initial()
          const next = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update
          session.set(key, next)
          if (!Object.is(previous, next)) emit()
        },
      }
    },
    clearSlots() { slots = new Map(); ownerLocations.clear(); validatedOwnerLocations.clear(); supportedObservedLocations.clear(); emit() },
  }
}

function pathname(location: string) {
  const value = location.split(/[?#]/, 1)[0].replace(/\/+$/, '')
  return value || '/'
}

export function unsavedPortalForPath(location: string): UnsavedPortal | null {
  return /^\/(hr|cms|crm)\/demo(?:\/|$)/.exec(pathname(location))?.[1] as UnsavedPortal | undefined ?? null
}

export function isUnsavedPortalShell(location: string) {
  return pathname(location) === '/portals' || unsavedPortalForPath(location) !== null
}

/** Portal switching hides a mounted module. Subpage/SDK changes can destroy
 * inputs. Leaving the shell considers every retained portal's forms. */
export function unsavedRouteTransition(from: string, to: string): UnsavedTransitionOptions {
  if (pathname(from) === pathname(to)) return { label: 'Open this location', ids: [] }
  if (!isUnsavedPortalShell(to)) return { label: 'Leave the portal workspaces' }
  const portal = unsavedPortalForPath(from)
  if (!portal) return { label: 'Open this workspace', ids: [] }
  return { portal, label: 'Leave this portal view', retain: unsavedPortalForPath(to) !== portal }
}
