import { createBrowserNavigationFocus } from './navigation-focus-dom'
import type { NavigationCommit, NavigationEntry } from './navigation-types'
export type { NavigationCommit, NavigationEntry } from './navigation-types'

export const NAVIGATION_EVENT = 'sfwa-wtl:navigation'
export const NAVIGATION_STATE_KEY = '__webappxNavigation'

export type NavigationRequest = { from: string; to: string; kind: 'route' | 'traverse'; historyFallback?: boolean }
export type NavigationGuard = (request: NavigationRequest, commit: () => void) => boolean
type Entry = { url: string; index: number | null; id: string }
type Marker = { session: string; index: number | null; entry?: string }
export type NavigationHost = {
  location: () => string
  state: () => unknown
  replace: (state: unknown, url: string) => void
  push: (state: unknown, url: string) => void
  go: (delta: number) => void
  committed: (url: string, commit?: NavigationCommit) => void
  accepted?: (commit: NavigationCommit) => void
  captureDeparture?: (entry: NavigationEntry) => void
  nextCommitSequence?: () => number
  scroll?: (url: string) => void
  position?: () => number | undefined
}

function marker(state: unknown): Marker | null {
  if (!state || typeof state !== 'object') return null
  const value = (state as Record<string, unknown>)[NAVIGATION_STATE_KEY]
  if (!value || typeof value !== 'object') return null
  const { session, index, entry } = value as Record<string, unknown>
  return typeof session === 'string' && session.length > 0 && (Number.isSafeInteger(index) || (index === null && typeof entry === 'string')) ? { session, index: index as number | null, entry: typeof entry === 'string' ? entry : undefined } : null
}

function markedState(state: unknown, session: string, index: number | null, entry: string) {
  const preserved = state && typeof state === 'object' && !Array.isArray(state)
    ? state : state == null ? {} : { __webappxPreviousHistoryState: state }
  return { ...preserved, [NAVIGATION_STATE_KEY]: { session, index, entry } }
}

const pathOf = (url: string) => normalizePath(url.split(/[?#]/, 1)[0])

/** Clean traversal uses the browser's observed entry. A guarded traversal
 * reuses the current slot with an explicit UI notice. The driver never issues
 * history.go: neither a marker nor a native position proves which asynchronous
 * traversal event arrived. No entries are added or truncated by the fallback. */
export function createNavigationDriver(host: NavigationHost, guard: NavigationGuard, sessionId = `navigation-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  const previous = marker(host.state())
  let session = previous?.session ?? sessionId
  let sequence = 0
  let commitSequence = 0
  let disposed = false
  const nextId = () => `${session}:entry:${++sequence}:${Math.random().toString(36).slice(2)}`
  const nativePosition = () => { const value = host.position?.(); return Number.isSafeInteger(value) ? value as number : undefined }
  let approved: Entry = { url: host.location(), index: nativePosition() ?? previous?.index ?? 0, id: previous?.entry ?? nextId() }
  const known = new Map<string, { index: number | null; url: string }>([[approved.id, { index: approved.index, url: approved.url }]])
  host.replace(markedState(host.state(), session, approved.index, approved.id), approved.url)

  function readEntry(): Entry {
    const url = host.location(), value = marker(host.state())
    let id = value?.session === session ? value.entry ?? nextId() : nextId()
    const observed = nativePosition()
    let index = observed ?? (value?.session === session ? value.index : null)
    const remembered = known.get(id)
    if (remembered && (remembered.url !== url || (observed !== undefined && remembered.index !== observed))) { id = nextId(); index = observed ?? null }
    if (index === null && remembered?.url === url) index = remembered.index
    known.set(id, { index, url })
    host.replace(markedState(host.state(), session, index, id), url)
    return { url, index, id }
  }
  const sameEntry = (left: Entry, right: Entry) => left.id === right.id && left.url === right.url
  function publish(entry: Entry, kind: NavigationCommit['kind'], focus: NavigationCommit['focus'], restoreEntryId: string | null, navigationEvent = true) {
    if (disposed) return
    const commit: NavigationCommit = Object.freeze({ sequence: host.nextCommitSequence?.() ?? ++commitSequence, location: entry.url, kind, entry: Object.freeze({ id: entry.id, index: entry.index }), restoreEntryId, focus })
    host.accepted?.(commit)
    if (navigationEvent) host.committed(entry.url, commit)
  }
  function accept(entry: Entry, scroll = false, kind: NavigationCommit['kind'] = 'route', restoreEntryId: string | null = null, focus: NavigationCommit['focus'] = 'destination') {
    approved = entry
    known.set(entry.id, { index: entry.index, url: entry.url })
    publish(entry, kind, focus, restoreEntryId)
    if (scroll) host.scroll?.(entry.url)
  }
  function reuseCurrentSlot(url: string, commit = false, restoreEntryId: string | null = null) {
    // A new coordinate session starts at this exact reused slot. Older
    // markers remain unindexed rather than pretending to share its origin.
    session = `${sessionId}:legacy:${++sequence}`
    known.clear()
    const entry = { url, index: nativePosition() ?? 0, id: nextId() }
    host.replace(markedState(host.state(), session, entry.index, entry.id), url)
    approved = entry
    known.set(entry.id, { index: entry.index, url })
    if (commit) publish(entry, 'traverse', 'destination', restoreEntryId)
  }
  function onPopState() {
    if (disposed) return
    const incoming = readEntry()
    if (sameEntry(incoming, approved)) return
    const from = approved
    host.captureDeparture?.(Object.freeze({ ...from }))
    let fallback = false, committed = false
    const allowed = guard({ from: from.url, to: incoming.url, kind: 'traverse', historyFallback: true }, () => {
      if (disposed) return
      committed = true
      if (fallback) reuseCurrentSlot(incoming.url, true, incoming.id)
      else accept(incoming, false, 'traverse', incoming.id)
    })
    if (!allowed && !committed) {
      fallback = true
      reuseCurrentSlot(from.url)
    }
  }
  function pushState(state: unknown, to: string, guarded = true, focus: NavigationCommit['focus'] = 'destination') {
    if (disposed) return false
    host.captureDeparture?.(Object.freeze({ ...approved }))
    const commit = () => {
      if (disposed) return
      const position = nativePosition()
      const next: Entry = { url: to, index: position !== undefined ? position + 1 : approved.index === null ? null : approved.index + 1, id: nextId() }
      host.push(markedState(state, session, next.index, next.id), to)
      const actual = nativePosition()
      if (actual !== undefined) next.index = actual
      accept(next, true, 'route', null, focus)
    }
    return guarded ? guard({ from: approved.url, to, kind: 'route' }, commit) : (commit(), true)
  }
  return {
    onPopState,
    dispose() { disposed = true; known.clear() },
    current: () => ({ ...approved }),
    pushState,
    replaceState(state: unknown, to: string) {
        if (disposed) return false
        host.captureDeparture?.(Object.freeze({ ...approved }))
        return guard({ from: approved.url, to, kind: 'route' }, () => { if (disposed) return; host.replace(markedState(state, session, approved.index, approved.id), to); accept({ ...approved, url: to }) })
    },
    navigate(to: string) { if (disposed) return false; if (to === approved.url) { host.captureDeparture?.(Object.freeze({ ...approved })); accept({ ...approved }, true); return true }; return pushState({}, to) },
    replaceHash(to: string) {
      if (disposed) return false
      if (pathOf(to) !== pathOf(approved.url)) return false
      host.replace(markedState(host.state(), session, approved.index, approved.id), to)
      approved = { ...approved, url: to }; known.set(approved.id, { index: approved.index, url: to })
      publish(approved, 'hash', 'preserve', null, false)
      return true
    },
    onHashChange() { if (host.location() !== approved.url) onPopState() },
    activateRetainedOwner(to: string, activated: () => void) {
      if (disposed) return false
      const portal = (url: string) => /^\/(hr|cms|crm)\/demo(?:\/|$)/.exec(pathOf(url))?.[1]
      const shell = (url: string) => pathOf(url) === '/portals' || !!portal(url)
      if (!to.startsWith('/') || to.startsWith('//') || !shell(approved.url) || !portal(to)) return false
      if (portal(approved.url) === portal(to) && pathOf(approved.url) !== pathOf(to)) return false
      const activate = () => { if (to === approved.url) activated(); else if (pushState({}, to, false, 'preserve')) activated() }
      activate()
      return true
    },
  }
}

let activeDriver: ReturnType<typeof createNavigationDriver> | null = null
let activeFocus: ReturnType<typeof createBrowserNavigationFocus> | null = null
let acceptedCommit: NavigationCommit | null = null
let browserCommitSequence = 0
const commitListeners = new Set<() => void>()

export function subscribeNavigationCommits(listener: () => void) { commitListeners.add(listener); return () => { commitListeners.delete(listener) } }
export function getNavigationCommit() { return acceptedCommit }
export function flushCommittedNavigationFocus(commit: NavigationCommit) { return activeFocus?.flush(commit) ?? false }
function publishBrowserCommit(commit: NavigationCommit) {
  acceptedCommit = commit
  for (const listener of commitListeners) listener()
}

function browserLocation() { return `${window.location.pathname}${window.location.search}${window.location.hash}` }

function scrollToLocation(location: string) {
  const hash = new URL(location, window.location.href).hash.slice(1)
  if (hash) {
    let id = hash
    try { id = decodeURIComponent(hash) } catch { /* A literal malformed hash can still name an element. */ }
    const target = document.getElementById(id)
    if (target) { target.scrollIntoView({ block: 'start' }); return }
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.wtlMotion === 'reduced'
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' })
}

/** Installed by the optional UI provider. Custom adopted routers can keep
 * using navigate without importing portal/domain code or installing a guard. */
export function installNavigationGuard(guard: NavigationGuard) {
  const nativeNavigation = (window as Window & { navigation?: { currentEntry?: { index?: number } } }).navigation
  const originalPush = window.history.pushState
  const originalReplace = window.history.replaceState
  const nativePush = originalPush.bind(window.history)
  const nativeReplace = originalReplace.bind(window.history)
  const focus = createBrowserNavigationFocus(document)
  activeFocus = focus
  const driver = createNavigationDriver({
    location: browserLocation,
    state: () => window.history.state,
    replace: (state, url) => nativeReplace(state, '', url),
    push: (state, url) => nativePush(state, '', url),
    go: delta => window.history.go(delta),
    committed: (_url, commit) => window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: commit })),
    accepted: commit => { focus.accept(commit); publishBrowserCommit(commit) },
    captureDeparture: entry => focus.captureDeparture(entry),
    nextCommitSequence: () => ++browserCommitSequence,
    scroll: scrollToLocation,
    position: () => nativeNavigation?.currentEntry?.index,
  }, guard)
  activeDriver = driver
  const resolveLocation = (url?: string | URL | null) => {
    const target = new URL(url == null ? window.location.href : String(url), window.location.href)
    if (target.origin !== window.location.origin) throw new DOMException('History URLs must have the current origin.', 'SecurityError')
    return `${target.pathname}${target.search}${target.hash}`
  }
  // Give every future same-document write an independent position/token,
  // including callers that copy history.state or supply no state at all.
  const wrappedPush: History['pushState'] = (state, _unused, url) => { driver.pushState(state, resolveLocation(url)) }
  const wrappedReplace: History['replaceState'] = (state, _unused, url) => { driver.replaceState(state, resolveLocation(url)) }
  window.history.pushState = wrappedPush
  window.history.replaceState = wrappedReplace
  const onPop = () => driver.onPopState()
  const onHash = () => driver.onHashChange()
  window.addEventListener('popstate', onPop)
  window.addEventListener('hashchange', onHash)
  const uninstall = () => {
    driver.dispose()
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('hashchange', onHash)
    if (window.history.pushState === wrappedPush) window.history.pushState = originalPush
    if (window.history.replaceState === wrappedReplace) window.history.replaceState = originalReplace
    if (activeDriver === driver) activeDriver = null
    focus.dispose()
    if (activeFocus === focus) activeFocus = null
  }
  return Object.assign(uninstall, { activateRetainedOwner: driver.activateRetainedOwner })
}

export function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function isActivePath(currentPath: string, targetPath: string, end = false) {
  const current = normalizePath(currentPath)
  const target = normalizePath(targetPath)

  if (target === '/') return current === '/'
  return end ? current === target : current === target || current.startsWith(`${target}/`)
}

export function navigate(to: string) {
  const target = new URL(/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(to) ? to : `/${to}`, window.location.href)
  if (target.origin !== window.location.origin || !['http:', 'https:'].includes(target.protocol)) { window.location.assign(target.href); return false }
  const location = `${target.pathname}${target.search}${target.hash}`
  if (activeDriver) return activeDriver.navigate(location)
  window.history.pushState({}, '', location)
  const entry = marker(window.history.state)
  const commit: NavigationCommit = Object.freeze({ sequence: ++browserCommitSequence, location, kind: 'route', entry: Object.freeze({ id: entry?.entry ?? `unmanaged:${browserCommitSequence}`, index: entry?.index ?? null }), restoreEntryId: null, focus: 'destination' })
  publishBrowserCommit(commit)
  window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: commit }))
  scrollToLocation(location)
  return true
}

export function replaceNavigationHash(hash: string) {
  const target = `${window.location.pathname}${window.location.search}${hash.startsWith('#') ? hash : `#${hash}`}`
  if (activeDriver) return activeDriver.replaceHash(target)
  window.history.replaceState(window.history.state, '', target)
  const entry = marker(window.history.state)
  publishBrowserCommit(Object.freeze({ sequence: ++browserCommitSequence, location: target, kind: 'hash', entry: Object.freeze({ id: entry?.entry ?? `unmanaged:${browserCommitSequence}`, index: entry?.index ?? null }), restoreEntryId: null, focus: 'preserve' }))
  return true
}
