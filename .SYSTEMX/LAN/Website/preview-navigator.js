// Read-only runtime DOM metadata. This is not a canonical source/document graph.
export const previewNavigatorLimits = Object.freeze({ nodes: 1500, depth: 40, query: 160, matches: 120, rows: 500, metadata: 500 })

const excludedTags = new Set(['HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE'])
const isElement = (node) => Boolean(node?.nodeType === 1 && typeof node.tagName === 'string')
const normalized = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

function metadata(element) {
  const take = (value) => normalized(String(value ?? '').slice(0, previewNavigatorLimits.metadata))
  const tag = element.tagName.toLowerCase()
  const id = take(element.getAttribute('id'))
  const classes = take(element.getAttribute('class'))
  const name = take(element.getAttribute('data-systemx-name'))
  const component = take(element.getAttribute('data-systemx-component'))
  const identity = `${tag}${id ? `#${id}` : ''}${classes ? `.${classes.split(' ').slice(0, 3).join('.')}` : ''}`
  const label = `${name || component ? `${name || component} · ` : ''}${identity}`.slice(0, 160)
  const metadataLimited = ['id', 'class', 'data-systemx-name', 'data-systemx-component']
    .some((attribute) => String(element.getAttribute(attribute) ?? '').length > previewNavigatorLimits.metadata)
  return { tag, label, metadataLimited, search: [tag, id, classes, name, component, identity, classes.split(' ').map((value) => `.${value}`).join(' ')].join(' ').toLocaleLowerCase() }
}

export function isCurrentPreviewElement(element, root) {
  return Boolean(isElement(element) && isElement(root) && element.isConnected
    && element.ownerDocument === root.ownerDocument && (element === root || root.contains(element)))
}

export function collectPreviewHierarchy(root, limits = previewNavigatorLimits) {
  const entries = []
  const byElement = new Map()
  const reasons = new Set()
  if (!isElement(root)) return { root, entries, byElement, reasons: ['Preview document unavailable.'], truncated: false }
  // Indexed child access avoids copying an arbitrarily large children collection.
  const stack = [{ element: root, parent: null, depth: 0 }]
  let examined = 0
  while (stack.length) {
    const next = stack[stack.length - 1]
    if (!next.entry) {
      if (examined >= limits.nodes) { reasons.add(`Inspection limited to ${limits.nodes} nodes.`); break }
      examined += 1
      if (!isElement(next.element) || excludedTags.has(next.element.tagName)) { stack.pop(); continue }
      const parent = next.parent
      const entry = {
        element: next.element, parent, depth: next.depth, children: [],
        hidden: Boolean(parent?.hidden || next.element.hasAttribute('hidden')),
        inert: Boolean(parent?.inert || next.element.hasAttribute('inert')),
        ariaHidden: Boolean(parent?.ariaHidden || next.element.getAttribute('aria-hidden') === 'true'),
        ...metadata(next.element),
      }
      entries.push(entry)
      if (entry.metadataLimited) reasons.add(`Element metadata limited to ${previewNavigatorLimits.metadata} characters per attribute.`)
      byElement.set(entry.element, entry)
      if (parent) parent.children.push(entry)
      next.entry = entry
      next.childIndex = 0
      if (next.depth >= limits.depth) {
        if (next.element.children.length) reasons.add(`Inspection depth limited to ${limits.depth} levels.`)
        stack.pop()
        continue
      }
    }
    if (next.childIndex >= next.element.children.length) { stack.pop(); continue }
    const child = next.element.children[next.childIndex++]
    stack.push({ element: child, parent: next.entry, depth: next.depth + 1 })
  }
  return { root, entries, byElement, reasons: [...reasons], truncated: reasons.size > 0 }
}

export function ancestorPreviewEntries(snapshot, element) {
  const path = []
  let entry = snapshot?.byElement.get(element)
  while (entry) { path.unshift(entry); entry = entry.parent }
  return path
}

export function projectPreviewRows(snapshot, { expanded = new Set(), query = '', limits = previewNavigatorLimits } = {}) {
  const queryLimited = String(query).length > limits.query
  const rawQuery = normalized(String(query).slice(0, limits.query))
  const needle = rawQuery.slice(0, limits.query).toLocaleLowerCase()
  const reasons = [...(snapshot?.reasons ?? [])]
  if (queryLimited) reasons.push(`Search limited to the first ${limits.query} characters. Refine the query.`)
  const entries = snapshot?.entries ?? []
  const included = new Set()
  const matches = entries.filter((entry) => needle && entry.search.includes(needle))
  if (needle) {
    for (const match of matches.slice(0, limits.matches)) {
      let entry = match
      while (entry) { included.add(entry); entry = entry.parent }
    }
    if (matches.length > limits.matches) reasons.push(`Showing the first ${limits.matches} of ${matches.length} inspected matches.`)
  }
  const rows = []
  const visible = new Set()
  for (const entry of entries) {
    const show = needle ? included.has(entry) : !entry.parent || (visible.has(entry.parent) && expanded.has(entry.parent.element))
    if (!show) continue
    if (rows.length >= limits.rows) { reasons.push(`Hierarchy view limited to ${limits.rows} rows. Collapse branches or refine search.`); break }
    visible.add(entry)
    rows.push({ ...entry, expanded: needle ? entry.children.some((child) => included.has(child)) : expanded.has(entry.element), matched: Boolean(needle && entry.search.includes(needle)) })
  }
  return { rows, query: needle, matchCount: matches.length, reasons, truncated: reasons.length > 0 }
}
