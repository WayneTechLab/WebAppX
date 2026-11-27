import { createNavigationFocusCoordinator, type FocusRequest, type SemanticFocusTarget } from './navigation-focus'
import type { NavigationEntry } from './navigation-types'

const workspaceSelector = '[data-nav-workspace][data-nav-scope][data-nav-active="true"]'
const pathOf = (location: string) => location.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
const keyOf = (element: Element) => element.getAttribute('data-nav-focus')

/** Actual DOM adapter. Semantic keys identify records; an old reused id grants nothing. */
export function createBrowserNavigationFocus(doc: Document) {
  const win = doc.defaultView
  const isElement = (value: unknown): value is HTMLElement => !!win && value instanceof win.HTMLElement
  const live = (element: HTMLElement) => {
    if (!element.isConnected || element.ownerDocument !== doc || element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"], [data-nav-active="false"]')) return false
    if (element.matches(':disabled, [aria-disabled="true"]')) return false
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      const style = win!.getComputedStyle(current)
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
    }
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0
  }
  const visible = (selector: string, root: ParentNode = doc) => Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(live)
  const main = () => {
    const candidates = visible('main[data-nav-main="true"]')
    if (candidates.length === 1) return candidates[0]
    if (candidates.length > 1) return null
    const fallback = doc.getElementById('content')
    return isElement(fallback) && fallback.tagName === 'MAIN' && live(fallback) ? fallback : null
  }
  const activeWorkspace = () => {
    const content = main()
    if (!content) return null
    const matches = visible(workspaceSelector, content)
    return matches.length === 1 ? matches[0] : null
  }
  const contextOf = (element: HTMLElement, boundary: HTMLElement | null) => {
    const context: string[] = []
    for (let current = element.parentElement; current && current !== boundary; current = current.parentElement) {
      if (!current.matches('nav, section, form, [role="region"]')) continue
      const label = current.getAttribute('aria-label')
      if (label) context.unshift(`${current.tagName}:${label}`)
    }
    return context.join(' / ')
  }
  const ownScope = (element: HTMLElement) => element.closest<HTMLElement>(workspaceSelector)
  const permitted = (element: HTMLElement, workspace: HTMLElement | null) => {
    if (!live(element)) return false
    const owner = element.closest('[data-nav-workspace]')
    return owner ? owner === workspace : !!main()?.contains(element)
  }
  const withKey = (key: string, root: ParentNode) => visible('[data-nav-focus]', root).filter(element => keyOf(element) === key)
  const unique = (items: HTMLElement[]) => items.length === 1 ? items : []
  const supportedHash = (element: HTMLElement) => !!keyOf(element) || element.matches('h1, h2, h3, h4, h5, h6, main, section, article, a[href], button, input, select, textarea, [tabindex]')
  const capture = (entry: NavigationEntry): SemanticFocusTarget | null => {
    const target = doc.activeElement
    if (!isElement(target) || !live(target) || target.closest('dialog[open]')) return null
    const owner = ownScope(target)
    if (target.closest('[data-nav-workspace]') && owner !== activeWorkspace()) return null
    const key = keyOf(target)
    if (!key && !owner) return null
    const declared = target.closest('[data-nav-fallback]')?.getAttribute('data-nav-fallback') ?? ''
    const fallbacks = declared.split(/\s+/).filter(Boolean)
    if (owner) {
      for (const kind of ['list', 'workspace']) {
        const headings = visible(`[data-nav-heading="${kind}"]`, owner)
        if (headings.length === 1 && keyOf(headings[0]) && !fallbacks.includes(keyOf(headings[0])!)) fallbacks.push(keyOf(headings[0])!)
      }
    }
    return {
      workspace: owner?.dataset.navWorkspace ?? 'page',
      scope: owner?.dataset.navScope ?? pathOf(entry.url), key,
      context: key ? contextOf(target, owner) : '', fallbacks,
    }
  }
  const candidates = ({ commit, remembered }: FocusRequest) => {
    const content = main()
    if (!content) return []
    const workspace = activeWorkspace()
    const root = workspace ?? content
    const result: HTMLElement[] = []
    const add = (items: HTMLElement[]) => { for (const element of items) if (!result.includes(element)) result.push(element) }
    if (remembered) {
      const sameScope = remembered.workspace === 'page'
        ? remembered.scope === pathOf(commit.location)
        : !!workspace && remembered.workspace === workspace.dataset.navWorkspace && remembered.scope === workspace.dataset.navScope
      if (sameScope && remembered.key) {
        const searchRoot = remembered.workspace === 'page' ? doc : root
        add(unique(withKey(remembered.key, searchRoot).filter(element => contextOf(element, workspace) === remembered.context && (remembered.workspace === 'page' ? !element.closest('[data-nav-workspace]') : permitted(element, workspace)))))
      }
    }
    let hash = commit.location.includes('#') ? commit.location.slice(commit.location.indexOf('#') + 1) : ''
    try { hash = decodeURIComponent(hash) } catch { /* A malformed fragment may still literally name a supported target. */ }
    if (hash) {
      const matches = visible('[id]').filter(element => element.id === hash && permitted(element, workspace) && supportedHash(element))
      add(unique(matches))
    }
    if (remembered) {
      const sameWorkspace = remembered.workspace === (workspace?.dataset.navWorkspace ?? 'page')
      if (sameWorkspace) for (const key of remembered.fallbacks) add(unique(withKey(key, root).filter(element => element.matches('[data-nav-heading="list"], [data-nav-heading="workspace"]') && permitted(element, workspace))))
      add(unique(visible('[data-nav-heading="list"]', root)))
    }
    add(unique(visible('[data-nav-heading="workspace"]', root)))
    add(unique(visible('h1', root)))
    add(unique(visible('h1', content)))
    add([content])
    return result.map(element => ({ element, key: keyOf(element), owner: element.closest<HTMLElement>('[data-nav-workspace]'), scope: element.closest<HTMLElement>('[data-nav-workspace]')?.dataset.navScope ?? null }))
  }
  const focus = (candidate: { element: HTMLElement; key: string | null; owner: HTMLElement | null; scope: string | null }) => {
    const { element } = candidate
    const workspace = activeWorkspace(), content = main()
    // Revalidate identity/ownership after earlier candidates could run focus handlers.
    if (keyOf(element) !== candidate.key || element.closest('[data-nav-workspace]') !== candidate.owner || (candidate.owner?.dataset.navScope ?? null) !== candidate.scope) return false
    if (!live(element) || !content || (element !== content && !permitted(element, workspace) && element.closest('[data-nav-workspace]'))) return false
    const structural = element.matches('h1, h2, h3, h4, h5, h6, main, section, article')
    if (!structural && !element.matches('a[href], button, input, select, textarea, [tabindex]')) return false
    const temporary = structural && !element.hasAttribute('tabindex')
    if (temporary) element.setAttribute('tabindex', '-1')
    try {
      element.focus({ preventScroll: true })
      if (doc.activeElement !== element || !live(element) || keyOf(element) !== candidate.key || (candidate.owner?.dataset.navScope ?? null) !== candidate.scope) { if (temporary) element.removeAttribute('tabindex'); return false }
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      if (temporary) element.addEventListener('blur', () => { if (element.getAttribute('tabindex') === '-1') element.removeAttribute('tabindex') }, { once: true })
      return true
    } catch {
      if (temporary) element.removeAttribute('tabindex')
      return false
    }
  }
  return createNavigationFocusCoordinator({
    capture, candidates, focus,
    active: () => doc.activeElement,
    hasPriorityFocus: previous => {
      if (visible('dialog[open]').length) return true
      const current = doc.activeElement
      return current !== previous && isElement(current) && !current.matches('body, html') && live(current)
    },
  })
}
