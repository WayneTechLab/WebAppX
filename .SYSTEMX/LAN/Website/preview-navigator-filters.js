// Read-only facets of the bounded, mounted hierarchy. Accessible names, text
// content, frame URLs and form values are never collected.
const kinds = {
  landmark: ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'region', 'search', 'form'],
  heading: ['heading'],
  link: ['link'],
  control: ['button', 'checkbox', 'combobox', 'listbox', 'option', 'radio', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'searchbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio'],
  list: ['list', 'listitem'],
  table: ['table', 'grid', 'treegrid', 'rowgroup', 'row', 'columnheader', 'rowheader', 'cell', 'gridcell'],
  media: ['img', 'figure'],
}
const nativeKinds = {
  landmark: ['main', 'nav', 'header', 'footer', 'aside', 'form', 'search'],
  heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  control: ['button', 'input', 'textarea', 'select', 'option', 'summary', 'meter', 'progress'],
  list: ['ul', 'ol', 'li', 'dl', 'dt', 'dd'],
  table: ['table', 'tbody', 'thead', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup'],
  media: ['img', 'picture', 'video', 'audio', 'canvas', 'svg', 'figure'],
  frame: ['iframe'],
  text: ['p', 'span', 'em', 'strong', 'label', 'pre', 'code', 'small', 'blockquote', 'time'],
}
const index = groups => new Map(Object.entries(groups).flatMap(([kind, values]) => values.map(value => [value, kind])))
const roles = index(kinds), tags = index(nativeKinds)
export function semanticKind(element, tag) {
  const role = (element.getAttribute?.('role') ?? '').slice(0, 100).trim().toLowerCase().split(/\s+/)[0]
  if (role === 'none' || role === 'presentation') return 'other'
  if (roles.has(role)) return roles.get(role)
  if ((tag === 'a' || tag === 'area') && element.hasAttribute('href')) return 'link'
  return tags.get(tag) ?? 'other'
}

export function visibilityStates(entries, scopes = []) {
  // A frame's inner document and a shadow root have a separate DOM ancestry.
  // Include their already-qualified host chain without entering another document.
  let scopeHidden = false, scopeInert = false
  for (const { host, kind } of scopes) {
    let ancestor = host
    for (let depth = 0; ancestor && depth <= 41; depth++, ancestor = ancestor.parentElement) {
      const style = ancestor.ownerDocument.defaultView.getComputedStyle(ancestor)
      if (ancestor.hasAttribute('hidden') || style.display === 'none' || style.contentVisibility === 'hidden' ||
          (kind === 'Frame' && ancestor === host && ['hidden', 'collapse'].includes(style.visibility))) scopeHidden = true
      if (ancestor.hasAttribute('inert')) scopeInert = true
    }
  }
  const states = new Map(), displaySuppressed = new Set()
  for (const entry of entries) {
    const { element, parent } = entry
    if (element.nodeType !== 1) { states.set(entry, 'unavailable-box'); continue }
    let status = 'unavailable-box'
    try {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      if (scopeHidden || entry.hidden || displaySuppressed.has(parent) || style.display === 'none' || style.contentVisibility === 'hidden') displaySuppressed.add(entry)
      if (displaySuppressed.has(entry) || style.visibility === 'hidden' || style.visibility === 'collapse') status = 'hidden'
      else if (scopeInert || entry.inert) status = 'inert'
      else if (element.getClientRects().length) status = 'rendered'
    } catch { /* Unavailable layout in this inspected document. */ }
    states.set(entry, status)
  }
  return states
}

const fields = {
  kind: ['any', ...Object.keys(nativeKinds), 'link', 'other'],
  visibility: ['any', 'rendered', 'hidden', 'inert', 'unavailable-box'],
  mapping: ['any', 'mapped', 'unmapped', 'stale', 'read-only'],
}
export const emptyNavigatorFilters = () => ({ kind: [], visibility: 'any', mapping: 'any' })
export const hasNavigatorFilters = filters => Boolean(filters && (filters.kind.length || filters.visibility !== 'any' || filters.mapping !== 'any'))
export function mountNavigatorFilters(before, scope, change) {
  const group = document.createElement('details'), title = document.createElement('summary')
  group.className = 'panel-guidance navigator-filters'
  group.dataset.navScope = scope
  title.textContent = 'Hierarchy filters'
  group.append(title)
  const controls = {}
  let previousKinds = []
  for (const [key, values] of Object.entries(fields)) {
    const label = document.createElement('label'), select = document.createElement('select')
    label.textContent = { kind: 'Element kind', visibility: 'Visibility', mapping: 'Source mapping' }[key]
    select.dataset.navFilter = key
    if (key === 'kind') { select.multiple = true; select.size = 3 }
    for (const value of values) {
      const option = document.createElement('option')
      option.value = value; option.textContent = value === 'any' ? 'All' : value[0].toUpperCase() + value.slice(1).replaceAll('-', ' ')
      select.append(option)
    }
    controls[key] = select; label.append(select); group.append(label)
    select.addEventListener('change', () => {
      const selected = Array.from(controls.kind.selectedOptions, option => option.value)
      const resetKind = key === 'kind' && previousKinds.length && selected.includes('any')
      const kind = resetKind ? [] : selected.filter(value => value !== 'any')
      change({ kind, visibility: controls.visibility.value, mapping: controls.mapping.value })
    })
  }
  const clear = document.createElement('button')
  clear.type = 'button'; clear.className = 'button'; clear.dataset.navClearFilters = ''; clear.textContent = 'Clear filters'
  clear.addEventListener('click', () => change(emptyNavigatorFilters()))
  group.append(clear)
  before.before(group)
  return { group, update(filters) {
    previousKinds = filters.kind
    for (const option of controls.kind.options) option.selected = filters.kind.length ? filters.kind.includes(option.value) : option.value === 'any'
    controls.visibility.value = filters.visibility; controls.mapping.value = filters.mapping
    clear.disabled = !hasNavigatorFilters(filters)
  } }
}
