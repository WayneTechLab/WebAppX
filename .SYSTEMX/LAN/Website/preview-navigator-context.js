import { collectPreviewHierarchy, previewNavigatorLimits, projectPreviewRows } from './preview-navigator.js'
import { mountNavigatorComparison } from './preview-navigator-comparison.js'
import { mountVirtualCoverage } from './preview-navigator-inspection.js'
import { bindNavigatorSearch, duplicateMatchContexts, revealAncestorStep, revealPathMatches } from './preview-navigator-targets.js'
import { parseNavigatorSearch, matchesNavigatorSearch } from './preview-navigator-search.js'
import { emptyNavigatorFilters, hasNavigatorFilters, mountNavigatorFilters } from './preview-navigator-filters.js'

const maxScopes = 4, maxBoundaries = 32
const limits = { ...previewNavigatorLimits, rows: 100 }
const watched = { subtree: true, childList: true, attributes: true,
  attributeFilter: ['id', 'class', 'hidden', 'inert', 'aria-hidden', 'data-systemx-name', 'data-systemx-component', 'src', 'srcdoc', 'sandbox', 'role', 'href', 'style', 'open', 'data-systemx-id', 'data-systemx-source', 'data-systemx-virtualized', 'aria-posinset', 'aria-setsize', 'aria-rowindex', 'aria-rowcount'] }

function boundaryKind(host) {
  if (host.tagName === 'IFRAME') return 'Frame'
  try { if (host.shadowRoot?.mode === 'open' && host.shadowRoot.host === host) return 'Open shadow root' } catch { /* Inaccessible host. */ }
  return null
}

// Check declarative origin and sandbox before asking for a document. The
// browser's same-origin contentDocument getter safely returns null on redirects.
export function frameBoundary(host) {
  const exclude = reason => ({ reason, root: null })
  if (!host.isConnected) return exclude('Detached frame')
  try {
    if (host.hasAttribute('sandbox') && !host.sandbox.contains('allow-same-origin')) return exclude('Opaque sandbox')
    const src = host.getAttribute('src')?.trim(), srcdoc = host.hasAttribute('srcdoc')
    if (src && src !== 'about:blank' && !srcdoc) {
      const target = new URL(src, host.ownerDocument.baseURI)
      if (!['http:', 'https:', 'blob:'].includes(target.protocol)) return exclude('Unsupported frame URL')
      if (target.origin !== host.ownerDocument.defaultView.origin) return exclude('Cross-origin frame')
    }
    const doc = host.contentDocument
    if (!doc?.body || (doc.URL === 'about:blank' && (srcdoc || (src && src !== 'about:blank')))) return exclude('Frame document unavailable')
    return { root: doc.body, reason: null }
  } catch { return exclude('Frame document unavailable') }
}

function boundaryRoot(host, kind) {
  if (!host.isConnected) return null
  if (kind === 'Open shadow root') return boundaryKind(host) === kind ? host.shadowRoot : null
  return frameBoundary(host).root
}

const element = (tag, text = '') => {
  const node = document.createElement(tag)
  node.textContent = text
  return node
}
const button = label => {
  const node = element('button', label)
  node.type = 'button'
  node.className = 'button'
  node.style.maxWidth = '100%'; node.style.whiteSpace = 'normal'
  return node
}
const scope = (root, label, host = null, kind = null) => ({ root, label, host, kind, query: '', filters: emptyNavigatorFilters(), expanded: new Set([root]) })

// Scoped nodes stay in this inspector. The canvas selection and source tools
// only receive elements selected through their original top-document workflow.
export function mountNavigatorContexts(tree) {
  const panel = element('details'), heading = element('summary', 'Shadow roots and frames')
  panel.id = 'preview-navigator-contexts'; panel.className = 'panel-guidance'; panel.style.overflowWrap = 'anywhere'
  const path = element('strong'), actions = element('div'), back = button('Back to parent'), refresh = button('Refresh contexts')
  const filter = element('input'), boundaries = element('div'), rows = element('ul'), status = element('output')
  path.setAttribute('aria-label', 'Hierarchy scope')
  actions.className = boundaries.className = 'navigator-actions'
  filter.type = 'search'; filter.className = 'navigator-search'; filter.maxLength = limits.query
  filter.placeholder = 'Filter scoped metadata'; filter.setAttribute('aria-label', filter.placeholder)
  rows.setAttribute('aria-label', 'Scoped element hierarchy')
  rows.style.paddingInlineStart = '1rem'
  status.className = 'command-output'; status.setAttribute('aria-live', 'polite')
  const nextReveal = button('Reveal next ancestors')
  nextReveal.dataset.navRevealNext = 'context'; nextReveal.hidden = true
  actions.append(back, refresh, nextReveal)
  panel.append(heading, path, actions, filter, boundaries, rows, status)
  tree.before(panel)
  const facets = mountNavigatorFilters(boundaries, 'context', filters => {
    if (stack.length < 2) return
    stack.at(-1).filters = filters; notice = ''; render()
  })

  let top, stack = [], timer, notice = ''
  const coverage = mountVirtualCoverage(boundaries, 'context')
  const comparison = mountNavigatorComparison(boundaries, { scope: 'context', readSnapshot() {
    reconcile()
    return panel.open && stack.length > 1 ? collectPreviewHierarchy(stack.at(-1).root, limits) : null
  } })
  function updateScopeTools(snapshot) {
    const nested = stack.length > 1 ? snapshot : null
    coverage.panel.hidden = comparison.panel.hidden = !nested
    coverage.update(nested); comparison.update(nested)
  }
  const observer = new MutationObserver(schedule)
  let watchedFrames = []
  function schedule() {
    if (panel.open && !timer) timer = setTimeout(() => { timer = null; render() }, 100)
  }
  function unwatch() {
    clearTimeout(timer); timer = null
    observer.disconnect()
    for (const frame of watchedFrames) frame.removeEventListener('load', schedule)
    watchedFrames = []
  }
  function reconcile() {
    if (!top || !top.root.isConnected || top.root.ownerDocument?.body !== top.root) { stack = []; return }
    if (stack[0]?.root !== top.root) {
      if (stack.length) notice = 'The preview document changed. Returned to the current preview.'
      stack = [scope(top.root, 'Preview')]
    }
    for (let index = 1; index < stack.length; index++) {
      const current = stack[index]
      if (!stack[index - 1].root.contains(current.host) || boundaryRoot(current.host, current.kind) !== current.root) {
        stack.length = index
        notice = 'The inspected context was replaced or became unavailable. Returned to its parent.'
        break
      }
    }
  }
  function render(focusTarget) {
    unwatch()
    if (!panel.open) return
    reconcile()
    const current = stack.at(-1)
    const active = document.activeElement
    const focusedKey = focusTarget ?? active?.navigatorFocusKey
    path.textContent = stack.map(item => item.label).join(' › ')
    back.hidden = stack.length < 2; filter.hidden = !current; facets.group.hidden = stack.length < 2
    boundaries.replaceChildren(); rows.replaceChildren()
    if (!current) { updateScopeTools(null); status.textContent = 'Preview context unavailable.'; return }
    for (const item of stack.slice(1)) {
      observer.observe(item.kind === 'Frame' ? item.root.ownerDocument.documentElement : item.root, watched)
      if (item.kind === 'Frame') { item.host.addEventListener('load', schedule); watchedFrames.push(item.host) }
    }
    const snapshot = stack.length === 1 ? top : collectPreviewHierarchy(current.root, limits)
    updateScopeTools(snapshot)
    current.expanded = new Set([...current.expanded].filter(node => snapshot.byElement.has(node)))
    facets.update(current.filters)
    filter.value = current.query
    const query = current.query, search = parseNavigatorSearch(query), findings = []
    if (current.pending && !revealPathMatches(snapshot, current.pending)) {
      current.pending = null; notice = 'The pending reveal path changed or was replaced.'
    }
    nextReveal.hidden = !current.pending
    const view = stack.length > 1 ? projectPreviewRows(snapshot, { expanded: current.expanded, query,
      filters: current.filters, scopes: stack.slice(1), limits }) : null
    const duplicateLabels = view ? duplicateMatchContexts(view) : new Map()
    let focusButton
    const occurrences = new Map()
    for (const entry of snapshot.entries) {
      const kind = boundaryKind(entry.element)
      if (!kind || (hasNavigatorFilters(current.filters) && !view?.matching.has(entry))) continue
      const label = `${kind} · ${entry.label}`
      const occurrence = (occurrences.get(label) ?? 0) + 1
      occurrences.set(label, occurrence)
      if (search.mode === 'refused') continue
      if (search.mode !== 'empty' && !matchesNavigatorSearch(search, entry) &&
          !(search.mode === 'plain' && kind.toLocaleLowerCase().includes(search.query))) continue
      findings.push(entry)
      if (findings.length > maxBoundaries) continue
      const name = occurrence === 1 ? label : `${label} (${occurrence})`
      if (kind === 'Frame') {
        entry.element.addEventListener('load', schedule)
        watchedFrames.push(entry.element)
        const { reason } = frameBoundary(entry.element)
        if (reason) {
          const boundary = element('span', `${name} · ${reason}. Frame contents excluded.`)
          boundary.dataset.navBoundary = 'excluded'
          boundaries.append(boundary)
          continue
        }
      }
      const open = button(name)
      open.navigatorFocusKey = entry.element
      if (entry.element === focusedKey) focusButton = open
      open.addEventListener('click', () => {
        reconcile()
        if (stack.at(-1) !== current || !current.root.contains(entry.element)) { notice = 'Context host unavailable.'; render(); return }
        if (stack.length - 1 >= maxScopes) { notice = `Inspection limited to ${maxScopes} nested contexts.`; render(entry.element); return }
        const root = boundaryRoot(entry.element, kind)
        if (!root) { notice = `${kind} unavailable. Only mounted, accessible same-origin content can be inspected.`; render(entry.element); return }
        stack.push(scope(root, open.textContent, entry.element, kind))
        notice = ''; render(); back.focus({ preventScroll: true })
      })
      boundaries.append(open)
    }
    const messages = [notice, `${Math.min(findings.length, maxBoundaries)} of ${findings.length} matching context boundaries.`]
    if (stack.length === 1) messages.push(...snapshot.reasons, 'Closed roots and unmounted content are outside this view.')
    else {
      for (const entry of view.rows) {
        const item = element('li')
        item.style.paddingInlineStart = `${Math.min(6, entry.depth) * 0.5}rem`
        if (entry.children.length) {
          const toggle = button(entry.label)
          toggle.setAttribute('aria-expanded', String(entry.expanded)); toggle.navigatorFocusKey = entry.element
          toggle.addEventListener('click', () => {
            if (view.filtering) { notice = 'Clear the filters and search to change expansion.'; render(entry.element); return }
            if (current.expanded.has(entry.element)) current.expanded.delete(entry.element)
            else current.expanded.add(entry.element)
            render(entry.element)
          })
          if (!focusButton && entry.element === focusedKey) focusButton = toggle
          item.append(toggle)
        } else {
          item.textContent = entry.label
          item.tabIndex = -1
          item.navigatorFocusKey = entry.element
          if (!focusButton && entry.element === focusedKey) focusButton = item
        }
        if (view.filtering) {
          item.dataset.navMatch = entry.matched ? 'match' : 'ancestor'
          if (!entry.matched && hasNavigatorFilters(current.filters)) item.append(element('small', ' · ancestor'))
        }
        const context = duplicateLabels.get(entry.element)
        if (context) {
          const detail = element('small', context); detail.dataset.navDuplicate = ''; item.append(detail)
        }
        if (view.filtering && entry.matched) {
          const reveal = button('Reveal'); reveal.dataset.navRevealMatch = ''
          reveal.setAttribute('aria-label', 'Reveal ' + entry.label)
          reveal.addEventListener('click', () => revealScoped(current, entry.element))
          item.append(reveal)
        }
        rows.append(item)
      }
      messages.push(`${snapshot.entries.length} inspected nodes · ${view.rows.length} shown${view.filtering ? ` · ${view.matchCount} ${hasNavigatorFilters(current.filters) ? 'matches' : 'metadata matches'}` : ''}.`, ...view.reasons)
    }
    status.textContent = search.refusal || messages.filter(Boolean).join(' ')
    if (focusButton) {
      focusButton.focus({ preventScroll: true })
      if (focusTarget) focusButton.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }
  panel.addEventListener('toggle', () => { if (!panel.open) { unwatch(); stack = []; updateScopeTools(null); notice = ''; boundaries.replaceChildren(); rows.replaceChildren() } else render() })
  function revealScoped(current, target, prior) {
    reconcile()
    if (stack.at(-1) !== current) { notice = 'Context unavailable.'; render(); return }
    const snapshot = collectPreviewHierarchy(current.root, limits)
    const step = revealAncestorStep(snapshot, target, current.expanded, { limits, previous: prior })
    current.pending = step.pending; notice = step.notice
    if (step.status === 'partial' || step.status === 'revealed') { current.expanded = step.expanded; current.query = ''; current.filters = emptyNavigatorFilters() }
    render(step.frontier)
    if (step.pending) nextReveal.focus({ preventScroll: true })
  }
  nextReveal.addEventListener('click', () => {
    const current = stack.at(-1)
    if (current?.pending) revealScoped(current, current.pending.target, current.pending)
  })
  bindNavigatorSearch(filter, query => { if (stack.length) stack.at(-1).query = query; notice = ''; render() })
  refresh.addEventListener('click', () => { notice = ''; render() })
  back.addEventListener('click', () => {
    const previous = stack.at(-1)
    reconcile()
    if (stack.at(-1) !== previous || stack.length < 2) { render(); return }
    stack.pop(); notice = ''; render(previous.host)
  })
  return { update(snapshot) {
    if (top === snapshot) return
    top = snapshot
    if (!top) { unwatch(); stack = []; updateScopeTools(null); notice = 'The preview document changed.' }
    if (panel.open) render()
  } }
}
