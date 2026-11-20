import { collectPreviewHierarchy, previewNavigatorLimits, projectPreviewRows } from './preview-navigator.js'

const maxScopes = 4, maxBoundaries = 32
const limits = { ...previewNavigatorLimits, rows: 100 }
const watched = { subtree: true, childList: true, attributes: true,
  attributeFilter: ['id', 'class', 'hidden', 'inert', 'aria-hidden', 'data-systemx-name', 'data-systemx-component', 'src', 'sandbox'] }

function boundaryKind(host) {
  if (host.tagName === 'IFRAME') return 'Frame'
  try { if (host.shadowRoot?.mode === 'open' && host.shadowRoot.host === host) return 'Open shadow root' } catch { /* Inaccessible host. */ }
  return null
}

function boundaryRoot(host, kind) {
  if (!host.isConnected) return null
  try {
    if (kind === 'Open shadow root') return boundaryKind(host) === kind ? host.shadowRoot : null
    if (host.hasAttribute('sandbox') && !host.sandbox.contains('allow-same-origin')) return null
    const doc = host.contentDocument
    if (!doc || doc !== host.contentWindow?.document || !doc.body) return null
    // An iframe has a transient same-origin blank document while its URL loads.
    if (doc.URL === 'about:blank') {
      const src = host.getAttribute('src')?.trim()
      if (host.hasAttribute('srcdoc') || (src && src !== 'about:blank')) return null
    }
    return doc.body
  } catch { return null }
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
const scope = (root, label, host = null, kind = null) => ({ root, label, host, kind, query: '', expanded: new Set([root]) })

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
  actions.append(back, refresh)
  panel.append(heading, path, actions, filter, boundaries, rows, status)
  tree.before(panel)

  let top, stack = [], timer, notice = ''
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
    back.hidden = stack.length < 2; filter.hidden = !current
    boundaries.replaceChildren(); rows.replaceChildren()
    if (!current) { status.textContent = 'Preview context unavailable.'; return }
    for (const item of stack.slice(1)) {
      observer.observe(item.kind === 'Frame' ? item.root.ownerDocument.documentElement : item.root, watched)
      if (item.kind === 'Frame') { item.host.addEventListener('load', schedule); watchedFrames.push(item.host) }
    }
    const snapshot = stack.length === 1 ? top : collectPreviewHierarchy(current.root, limits)
    current.expanded = new Set([...current.expanded].filter(node => snapshot.byElement.has(node)))
    filter.value = current.query
    const query = current.query.trim().toLocaleLowerCase(), findings = []
    let focusButton
    const occurrences = new Map()
    for (const entry of snapshot.entries) {
      const kind = boundaryKind(entry.element)
      if (!kind) continue
      const label = `${kind} · ${entry.label}`
      const occurrence = (occurrences.get(label) ?? 0) + 1
      occurrences.set(label, occurrence)
      if (query && !entry.search.includes(query) && !kind.toLocaleLowerCase().includes(query)) continue
      findings.push(entry)
      if (findings.length > maxBoundaries) continue
      const open = button(occurrence === 1 ? label : `${label} (${occurrence})`)
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
      const view = projectPreviewRows(snapshot, { expanded: current.expanded, query, limits })
      for (const entry of view.rows) {
        const item = element('li')
        item.style.paddingInlineStart = `${Math.min(6, entry.depth) * 0.5}rem`
        if (entry.children.length) {
          const toggle = button(entry.label)
          toggle.setAttribute('aria-expanded', String(entry.expanded)); toggle.navigatorFocusKey = entry.element
          toggle.addEventListener('click', () => {
            if (query) { notice = 'Clear the filter to change expansion.'; render(entry.element); return }
            if (current.expanded.has(entry.element)) current.expanded.delete(entry.element)
            else current.expanded.add(entry.element)
            render(entry.element)
          })
          if (!focusButton && entry.element === focusedKey) focusButton = toggle
          item.append(toggle)
        } else item.textContent = entry.label
        rows.append(item)
      }
      messages.push(`${snapshot.entries.length} inspected nodes · ${view.rows.length} shown${query ? ` · ${view.matchCount} metadata matches` : ''}.`, ...view.reasons)
    }
    status.textContent = messages.filter(Boolean).join(' ')
    if (focusButton) focusButton.focus({ preventScroll: true })
  }
  panel.addEventListener('toggle', () => { if (!panel.open) { unwatch(); stack = []; notice = ''; boundaries.replaceChildren(); rows.replaceChildren() } else render() })
  filter.addEventListener('input', () => { if (stack.length) stack.at(-1).query = filter.value.slice(0, limits.query); notice = ''; render() })
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
    if (!top) { unwatch(); stack = []; notice = 'The preview document changed.' }
    if (panel.open) render()
  } }
}
