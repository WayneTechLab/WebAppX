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
  committed: (url: string) => void
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
  function accept(entry: Entry, scroll = false) {
    approved = entry
    known.set(entry.id, { index: entry.index, url: entry.url })
    host.committed(entry.url)
    if (scroll) host.scroll?.(entry.url)
  }
  function reuseCurrentSlot(url: string, commit = false) {
    // A new coordinate session starts at this exact reused slot. Older
    // markers remain unindexed rather than pretending to share its origin.
    session = `${sessionId}:legacy:${++sequence}`
    known.clear()
    const entry = { url, index: nativePosition() ?? 0, id: nextId() }
    host.replace(markedState(host.state(), session, entry.index, entry.id), url)
    approved = entry
    known.set(entry.id, { index: entry.index, url })
    if (commit) host.committed(url)
  }
  function onPopState() {
    const incoming = readEntry()
    if (sameEntry(incoming, approved)) return
    const from = approved
    let fallback = false, committed = false
    const allowed = guard({ from: from.url, to: incoming.url, kind: 'traverse', historyFallback: true }, () => {
      committed = true
      if (fallback) reuseCurrentSlot(incoming.url, true)
      else accept(incoming)
    })
    if (!allowed && !committed) {
      fallback = true
      reuseCurrentSlot(from.url)
    }
  }
  function pushState(state: unknown, to: string, guarded = true) {
    const commit = () => {
      const position = nativePosition()
      const next: Entry = { url: to, index: position !== undefined ? position + 1 : approved.index === null ? null : approved.index + 1, id: nextId() }
      host.push(markedState(state, session, next.index, next.id), to)
      const actual = nativePosition()
      if (actual !== undefined) next.index = actual
      accept(next, true)
    }
    return guarded ? guard({ from: approved.url, to, kind: 'route' }, commit) : (commit(), true)
  }
  return {
    onPopState,
    current: () => ({ ...approved }),
    pushState,
    replaceState(state: unknown, to: string) {
        return guard({ from: approved.url, to, kind: 'route' }, () => { host.replace(markedState(state, session, approved.index, approved.id), to); accept({ ...approved, url: to }) })
    },
    navigate(to: string) { if (to === approved.url) { host.scroll?.(to); return true }; return pushState({}, to) },
    replaceHash(to: string) {
      if (pathOf(to) !== pathOf(approved.url)) return false
      host.replace(markedState(host.state(), session, approved.index, approved.id), to)
      approved = { ...approved, url: to }; known.set(approved.id, { index: approved.index, url: to })
      return true
    },
    onHashChange() { if (host.location() !== approved.url) onPopState() },
    activateRetainedOwner(to: string, activated: () => void) {
      const portal = (url: string) => /^\/(hr|cms|crm)\/demo(?:\/|$)/.exec(pathOf(url))?.[1]
      const shell = (url: string) => pathOf(url) === '/portals' || !!portal(url)
      if (!to.startsWith('/') || to.startsWith('//') || !shell(approved.url) || !portal(to)) return false
      if (portal(approved.url) === portal(to) && pathOf(approved.url) !== pathOf(to)) return false
      const activate = () => { if (to === approved.url) activated(); else if (pushState({}, to, false)) activated() }
      activate()
      return true
    },
  }
}

let activeDriver: ReturnType<typeof createNavigationDriver> | null = null

function browserLocation() { return `${window.location.pathname}${window.location.search}${window.location.hash}` }

function scrollToLocation(location: string) {
  const hash = new URL(location, window.location.href).hash.slice(1)
  if (hash) {
    let id = hash
    try { id = decodeURIComponent(hash) } catch { /* A literal malformed hash can still name an element. */ }
    const target = document.getElementById(id)
    if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' }); return }
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
  const driver = createNavigationDriver({
    location: browserLocation,
    state: () => window.history.state,
    replace: (state, url) => nativeReplace(state, '', url),
    push: (state, url) => nativePush(state, '', url),
    go: delta => window.history.go(delta),
    committed: () => window.dispatchEvent(new Event(NAVIGATION_EVENT)),
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
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('hashchange', onHash)
    if (window.history.pushState === wrappedPush) window.history.pushState = originalPush
    if (window.history.replaceState === wrappedReplace) window.history.replaceState = originalReplace
    if (activeDriver === driver) activeDriver = null
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
  window.dispatchEvent(new Event(NAVIGATION_EVENT))
  scrollToLocation(location)
  return true
}

export function replaceNavigationHash(hash: string) {
  const target = `${window.location.pathname}${window.location.search}${hash.startsWith('#') ? hash : `#${hash}`}`
  if (activeDriver) return activeDriver.replaceHash(target)
  window.history.replaceState(window.history.state, '', target)
  return true
}
