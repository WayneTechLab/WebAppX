// These views project bounded mounted metadata. They do not traverse the DOM,
// change the preview or infer a logical item/instance from visible text.
const maxRows = 32
const create = (name, text = '') => {
  const element = document.createElement(name)
  element.textContent = text
  return element
}

function numericAttribute(element, name, minimum) {
  const raw = element.getAttribute(name)
  if (raw === null) return undefined
  if (typeof raw !== 'string' || raw.length > 16 || !/^(?:-1|0|[1-9][0-9]*)$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && (value === -1 && minimum === 0 || value >= minimum) ? value : null
}

const listRoles = new Map([['list', 'listitem'], ['listbox', 'option'], ['grid', 'row'], ['treegrid', 'row'], ['table', 'row']])
function roleOf(entry) {
  const declared = entry.element.getAttribute?.('role')?.slice(0, 100).trim().toLowerCase().split(/\s+/)[0]
  if (declared) return declared
  return ({ ul: 'list', ol: 'list', li: 'listitem', table: 'table', tr: 'row', select: 'listbox', option: 'option' })[entry.tag]
}

export function virtualCoverage(snapshot) {
  const ancestry = new Map(), candidates = []
  for (const entry of snapshot?.entries ?? []) {
    const role = roleOf(entry), parent = ancestry.get(entry.parent)
    let group = parent
    if (listRoles.has(role)) {
      const rowBased = listRoles.get(role) === 'row'
      const marker = entry.element.getAttribute('data-systemx-virtualized')
      group = { label: entry.label, itemRole: listRoles.get(role), mounted: 0, totals: new Set(), positions: new Set(),
        marked: marker === '' || marker === 'true', invalid: false, maxPosition: 0 }
      if (rowBased) {
        const total = numericAttribute(entry.element, 'aria-rowcount', 0)
        if (total !== undefined) { group.marked = true; group.totals.add(total) }
      }
      candidates.push(group)
    } else if (group && role === group.itemRole) {
      group.mounted++
      const row = role === 'row'
      const position = numericAttribute(entry.element, row ? 'aria-rowindex' : 'aria-posinset', 1)
      const total = row ? undefined : numericAttribute(entry.element, 'aria-setsize', 0)
      if (position !== undefined || total !== undefined) group.marked = true
      if (total !== undefined) group.totals.add(total)
      if (position !== undefined) {
        if (position === null || group.positions.has(position)) group.invalid = true
        else { group.positions.add(position); group.maxPosition = Math.max(group.maxPosition, position) }
      }
    }
    ancestry.set(entry, group)
  }
  return candidates.filter(group => group.marked).map(group => {
    const [reported] = group.totals
    const inconsistent = group.invalid || group.totals.size > 1 || reported === null ||
      (reported >= 0 && (group.mounted > reported || group.maxPosition > reported))
    return { label: group.label, mounted: group.mounted, positioned: group.positions.size, inconsistent,
      total: !inconsistent && Number.isSafeInteger(reported) && reported >= 0 ? reported : null }
  })
}

function inspectionPanel(before, label) {
  const panel = create('details'), summary = create('summary', label), status = create('output'), rows = create('div')
  panel.className = 'panel-guidance navigator-inspection'
  status.className = 'command-output'; status.setAttribute('aria-live', 'polite')
  panel.append(summary, status, rows)
  before.before(panel)
  return { panel, status, rows }
}

export function mountVirtualCoverage(before, scope) {
  const { panel, status, rows } = inspectionPanel(before, 'Virtual list coverage')
  panel.dataset.navCoverage = scope
  const list = create('ul')
  list.dataset.navCoverageRows = ''; rows.append(list)
  let snapshot = null
  function render() {
    list.replaceChildren()
    if (!panel.open) return
    if (!snapshot) { status.textContent = 'Preview scope unavailable.'; return }
    const groups = virtualCoverage(snapshot)
    for (const group of groups.slice(0, maxRows)) {
      const logical = group.total === null ? (group.inconsistent ? 'unknown logical total (inconsistent declarations)' : 'unknown logical total') : group.total + ' logical'
      list.append(create('li', `${group.label} · ${group.mounted} mounted in the inspected range · ${logical} · ${group.positioned} declared positions.`))
    }
    const range = snapshot.rangeLimited ? ' Inspection stopped at the hierarchy budget.' : ''
    status.textContent = groups.length
      ? `${Math.min(groups.length, maxRows)} of ${groups.length} declared windows. Logical counts come from list or grid metadata. Unmounted items and source coverage are unverified.${range}`
      : `No declared virtual windows in the inspected range. Unmarked virtualization and unmounted items are unknown.${range}`
  }
  panel.addEventListener('toggle', render)
  return { panel, update(next) { if (snapshot !== next) { snapshot = next; render() } } }
}

export function componentGroups(snapshot, identities) {
  const groups = new Map()
  for (const entry of snapshot?.entries ?? []) {
    const identity = identities?.get(entry.element)
    const definition = identity?.definition
    if (!definition?.sourcePath || !definition.name || entry.element.getAttribute?.('data-systemx-component') !== definition.name) continue
    const key = JSON.stringify([identity.workspaceId, identity.documentId, definition.sourcePath, definition.name])
    if (!groups.has(key)) groups.set(key, { key, name: definition.name, path: definition.sourcePath, instances: [] })
    groups.get(key).instances.push({ key: identity.key, nodeId: identity.nodeId, anchor: identity.anchor, label: entry.label, element: entry.element })
  }
  return [...groups.values()]
}

export function mountComponentGroups(before, activate) {
  const { panel, status, rows } = inspectionPanel(before, 'Component instances')
  panel.id = 'preview-navigator-components'
  let snapshot, identities, notice = ''
  const expanded = new Set()
  function render() {
    const focused = rows.contains(document.activeElement) ? document.activeElement?.navigatorGroupFocus : null
    for (const detail of rows.children) {
      if (detail.open) expanded.add(detail.navigatorDefinitionKey)
      else expanded.delete(detail.navigatorDefinitionKey)
    }
    rows.replaceChildren()
    if (!panel.open) return
    const groups = componentGroups(snapshot, identities)
    const activeKeys = new Set(groups.map(group => group.key))
    for (const key of expanded) if (!activeKeys.has(key)) expanded.delete(key)
    let remaining = 100, shown = 0, restoreFocus
    for (const group of groups.slice(0, maxRows)) {
      if (!remaining) break
      const detail = create('details'), heading = create('summary', `${group.name} · ${group.instances.length} ${group.instances.length === 1 ? 'instance' : 'instances'}`)
      detail.dataset.navDefinition = ''; detail.navigatorDefinitionKey = group.key
      detail.open = expanded.has(group.key)
      heading.navigatorGroupFocus = group.key
      if (focused === group.key) restoreFocus = heading
      detail.append(heading, create('small', group.path))
      for (const instance of group.instances.slice(0, remaining)) {
        const line = create('div')
        line.dataset.navInstance = ''
        line.append(create('span', `${instance.label} · ${instance.anchor}`))
        for (const action of ['Select', 'Reveal']) {
          const button = create('button', action)
          button.type = 'button'; button.className = 'button'
          button.dataset['navInstance' + action] = ''
          button.navigatorGroupFocus = JSON.stringify([instance.key, action])
          if (focused === button.navigatorGroupFocus) restoreFocus = button
          button.addEventListener('click', () => {
            const result = activate(instance, group.key, action)
            notice = result ? `${action === 'Select' ? 'Selected' : 'Reveal requested for'} ${instance.anchor} · ${instance.nodeId}.` : 'Instance unavailable or its declaration changed. Refresh the inspected hierarchy.'
            status.textContent = notice
          })
          line.append(button)
        }
        detail.append(line); remaining--; shown++
      }
      rows.append(detail)
    }
    const total = groups.reduce((sum, group) => sum + group.instances.length, 0)
    status.textContent = notice || (total ? `${shown} of ${total} qualified instances shown in inspected DOM order.` : 'No current qualified component instances in this scope.')
    if (focused) (restoreFocus ?? panel.querySelector('summary')).focus({ preventScroll: true })
  }
  panel.addEventListener('toggle', render)
  return { update(next, nextIdentities) {
    if (next === snapshot && identities === nextIdentities) return
    if (snapshot?.root !== next?.root) {
      const heldFocus = rows.contains(document.activeElement)
      rows.replaceChildren()
      expanded.clear(); notice = ''
      if (heldFocus) panel.querySelector('summary').focus({ preventScroll: true })
    }
    if (next !== snapshot) notice = ''
    snapshot = next; identities = nextIdentities; render()
  } }
}
