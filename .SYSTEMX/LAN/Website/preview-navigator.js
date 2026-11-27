import { matchesNavigatorSearch, navigatorQueryLimit, parseNavigatorSearch } from './preview-navigator-search.js'
import { hasNavigatorFilters, semanticKind, visibilityStates } from './preview-navigator-filters.js'

// Read-only runtime DOM metadata. This is not a canonical source/document graph.
export const previewNavigatorLimits = Object.freeze({ nodes: 1500, depth: 40, query: navigatorQueryLimit, matches: 120, rows: 500, metadata: 500 })

const excludedTags = new Set(['HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE'])
const isElement = (node) => Boolean(node?.nodeType === 1 && typeof node.tagName === 'string')
const normalized = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

function metadata(element) {
  const max = previewNavigatorLimits.metadata
  const rawTag = element.tagName
  const rawId = element.getAttribute('id') ?? ''
  const rawClass = element.getAttribute('class') ?? ''
  const rawName = element.getAttribute('data-systemx-name') ?? ''
  const rawComponent = element.getAttribute('data-systemx-component') ?? ''
  const take = value => normalized(value.slice(0, max))
  const tag = rawTag.slice(0, max).toLowerCase()
  const id = take(rawId), classes = take(rawClass)
  const name = take(rawName), component = take(rawComponent)
  // A clipped value cannot establish an exact predicate match. Other fields
  // remain independently searchable when one authored attribute is oversized.
  const searchFields = {
    tag: rawTag.length <= max ? tag : null,
    id: rawId.length <= max ? rawId : null,
    class: rawClass.length <= max ? rawClass.split(/[\t\n\f\r ]+/u) : null,
    name: rawName.length <= max ? name.toLowerCase() : null,
    component: rawComponent.length <= max ? component.toLowerCase() : null,
  }
  const identity = `${tag}${id ? `#${id}` : ''}${classes ? `.${classes.split(' ').slice(0, 3).join('.')}` : ''}`
  const label = `${name || component ? `${name || component} · ` : ''}${identity}`.slice(0, 160)
  const metadataLimited = Object.values(searchFields).includes(null)
  return { tag, label, metadataLimited, searchFields, search: [tag, id, classes, name, component, identity, classes.split(' ').map((value) => `.${value}`).join(' ')].join(' ').toLocaleLowerCase() }
}

export function isCurrentPreviewElement(element, root) {
  return Boolean(isElement(element) && isElement(root) && element.isConnected
    && element.ownerDocument === root.ownerDocument && (element === root || root.contains(element)))
}

export function collectPreviewHierarchy(root, limits = previewNavigatorLimits) {
  const entries = []
  const byElement = new Map()
  const reasons = new Set(), anchors = new Map()
  let rangeLimited = false
  const shadow = root?.nodeType === 11 && root.mode === 'open' && root.host?.shadowRoot === root
  if (!isElement(root) && !shadow) return { root, entries, byElement, reasons: ['Preview document unavailable.'], truncated: false }
  // Indexed child access avoids copying an arbitrarily large children collection.
  const stack = [{ element: root, parent: null, depth: 0 }]
  let examined = 0
  while (stack.length) {
    const next = stack[stack.length - 1]
    if (!next.entry) {
      if (examined >= limits.nodes) { rangeLimited = true; reasons.add(`Inspection limited to ${limits.nodes} nodes.`); break }
      examined += 1
      const boundary = shadow && next.element === root
      if (!boundary && (!isElement(next.element) || excludedTags.has(next.element.tagName))) { stack.pop(); continue }
      const parent = next.parent
      const entry = {
        element: next.element, parent, depth: next.depth, children: [],
        hidden: Boolean(parent?.hidden || (!boundary && next.element.hasAttribute('hidden'))),
        inert: Boolean(parent?.inert || (!boundary && next.element.hasAttribute('inert'))),
        ariaHidden: Boolean(parent?.ariaHidden || (!boundary && next.element.getAttribute('aria-hidden') === 'true')),
        ...(boundary ? { tag: '#shadow-root', label: 'Open shadow root', search: 'open shadow root' } : metadata(next.element)),
      }
      entry.kind = semanticKind(entry.element, entry.tag)
      const anchor = next.element.getAttribute?.('data-systemx-id')
      if (anchor && anchor.length <= 80 && /^[A-Za-z][A-Za-z0-9_-]*$/.test(anchor)) {
        entry.anchor = anchor
        anchors.set(anchor, (anchors.get(anchor) ?? 0) + 1)
      }
      // Explicit source ownership can inherit through this scope's inspected
      // parents. A malformed marker must shadow, never fall back to another path.
      const source = next.element.getAttribute?.('data-systemx-source')
      entry.sourcePath = source == null ? parent?.sourcePath : source.length <= 512 ? source : ''
      entries.push(entry)
      if (entry.metadataLimited) reasons.add(`Element metadata limited to ${previewNavigatorLimits.metadata} characters per attribute.`)
      byElement.set(entry.element, entry)
      if (parent) parent.children.push(entry)
      next.entry = entry
      next.childIndex = 0
      if (entry.tag === 'iframe') { stack.pop(); continue }
      if (next.depth >= limits.depth) {
        if (next.element.children.length) { rangeLimited = true; reasons.add(`Inspection depth limited to ${limits.depth} levels.`) }
        stack.pop()
        continue
      }
    }
    if (next.childIndex >= next.element.children.length) { stack.pop(); continue }
    const child = next.element.children[next.childIndex++]
    stack.push({ element: child, parent: next.entry, depth: next.depth + 1 })
  }
  return { root, entries, byElement, anchors, rangeLimited, reasons: [...reasons], truncated: reasons.size > 0 }
}

export function ancestorPreviewEntries(snapshot, element) {
  const path = []
  let entry = snapshot?.byElement.get(element)
  while (entry) { path.unshift(entry); entry = entry.parent }
  return path
}

export function projectPreviewRows(snapshot, { expanded = new Set(), query = '', filters, ownership, scopes, limits = previewNavigatorLimits } = {}) {
  const search = parseNavigatorSearch(query, limits.query)
  const reasons = [...(snapshot?.reasons ?? [])]
  if (search.limited) reasons.push(`Search limited to the first ${limits.query} characters. Refine the query.`)
  const searchInfo = { query: search.query, searchMode: search.mode, searchRefusal: search.refusal ?? null, predicateCount: search.terms.length }
  if (search.refusal) {
    return { ...searchInfo, rows: [], filtering: true, matching: new Set(), matchCount: 0, reasons, truncated: reasons.length > 0 }
  }
  const entries = snapshot?.entries ?? []
  const included = new Set()
  const filtering = search.mode !== 'empty' || hasNavigatorFilters(filters)
  const visibility = filters && filters.visibility !== 'any' ? visibilityStates(entries, scopes) : null
  const mapping = entry => ownership && !snapshot.rangeLimited && entry.anchor && snapshot.anchors.get(entry.anchor) === 1 ? ownership(entry) : 'unmapped'
  const matches = filtering ? entries.filter(entry => matchesNavigatorSearch(search, entry)
    && (!filters?.kind.length || filters.kind.includes(entry.kind))
    && (!visibility || visibility.get(entry) === filters.visibility)
    && (!filters || filters.mapping === 'any' || mapping(entry) === filters.mapping)) : []
  const matching = new Set(matches)
  if (filtering) {
    for (const match of matches.slice(0, limits.matches)) {
      let entry = match
      while (entry) { included.add(entry); entry = entry.parent }
    }
    if (matches.length > limits.matches) reasons.push(`Showing the first ${limits.matches} of ${matches.length} inspected matches.`)
  }
  const rows = []
  const visible = new Set()
  for (const entry of entries) {
    const show = filtering ? included.has(entry) : !entry.parent || (visible.has(entry.parent) && expanded.has(entry.parent.element))
    if (!show) continue
    if (rows.length >= limits.rows) { reasons.push(`Hierarchy view limited to ${limits.rows} rows. Collapse branches or refine search.`); break }
    visible.add(entry)
    rows.push({ ...entry, expanded: filtering ? entry.children.some((child) => included.has(child)) : expanded.has(entry.element), matched: matching.has(entry) })
  }
  return { rows, filtering, matching, ...searchInfo, matchCount: matches.length, reasons, truncated: reasons.length > 0 }
}
