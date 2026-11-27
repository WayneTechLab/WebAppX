import { previewNavigatorLimits } from './preview-navigator.js'

const changeLimit = 120

// Weak keys identify repeated labels and retained DOM nodes without holding
// detached subtrees in the baseline. Samples contain only bounded metadata.
export function createHierarchySampler() {
  const handles = new WeakMap()
  let nextHandle = 0
  const series = Symbol('runtime hierarchy')
  function handle(node) {
    if (!handles.has(node)) handles.set(node, ++nextHandle)
    return handles.get(node)
  }
  function available(snapshot) {
    const root = snapshot?.root
    return Boolean(root?.isConnected && root.ownerDocument && snapshot.entries?.[0]?.element === root)
  }
  function sameScope(sample, snapshot) {
    return available(snapshot) && sample?.series === series && sample.root === handle(snapshot.root)
      && sample.document === handle(snapshot.root.ownerDocument)
  }
  function capture(snapshot) {
    if (!available(snapshot)) return null
    const entries = snapshot.entries.slice(0, previewNavigatorLimits.nodes)
    const records = entries.map(entry => Object.freeze({
      id: handle(entry.element), label: entry.label.slice(0, 160),
      parent: entry.parent ? handle(entry.parent.element) : null,
    }))
    return Object.freeze({
      series, root: handle(snapshot.root), document: handle(snapshot.root.ownerDocument),
      records: Object.freeze(records),
      partial: Boolean(snapshot.rangeLimited || entries.length < snapshot.entries.length),
    })
  }
  return { capture, sameScope }
}

export function compareHierarchySamples(before, after) {
  if (!before || !after || before.series !== after.series || before.root !== after.root || before.document !== after.document) return null
  const previous = new Map(before.records.map(node => [node.id, node]))
  const current = new Map(after.records.map(node => [node.id, node]))
  const counts = { added: 0, removed: 0, reparented: 0, 'first-seen': 0, 'last-seen': 0 }
  const changes = []
  function record(kind, node, from = null, to = null) {
    counts[kind]++
    if (changes.length < changeLimit) changes.push({ kind, node, from, to })
  }
  for (const node of after.records) {
    const old = previous.get(node.id)
    if (!old) record(before.partial ? 'first-seen' : 'added', node)
    else if (old.parent !== node.parent) record('reparented', node, previous.get(old.parent), current.get(node.parent))
  }
  for (const node of before.records) {
    if (!current.has(node.id)) record(after.partial ? 'last-seen' : 'removed', node)
  }
  return { counts, changes, total: Object.values(counts).reduce((sum, n) => sum + n, 0) }
}

export function mountNavigatorComparison(before, { scope, readSnapshot }) {
  const doc = before.ownerDocument
  function create(tag, label) {
    const node = doc.createElement(tag)
    if (label) node.textContent = label
    return node
  }
  const panel = create('details')
  panel.className = 'panel-guidance'
  panel.dataset.navCompare = scope
  const actions = create('div')
  actions.className = 'navigator-actions'
  function button(key, label) {
    const action = create('button', label)
    action.type = 'button'
    action.className = 'button'
    action.dataset[key] = ''
    actions.append(action)
    return action
  }
  const capture = button('navCapture', 'Capture baseline')
  const compare = button('navCompareNow', 'Compare now')
  const clear = button('navClearComparison', 'Clear comparison')
  const summary = create('output')
  summary.dataset.navDiffSummary = ''
  summary.setAttribute('aria-live', 'polite')
  summary.className = 'command-output'
  const list = create('ul')
  list.dataset.navDiffResults = ''
  list.setAttribute('aria-label', 'Runtime hierarchy changes')
  panel.append(create('summary', 'Compare runtime snapshots'),
    create('p', 'Compare mounted nodes in this hierarchy scope, including collapsed and filtered rows. Labels identify runtime elements. Source and document revisions are tracked separately.'),
    actions, summary, list)
  before.before(panel)

  const sampler = createHierarchySampler()
  let baseline = null
  const reset = message => {
    baseline = null
    clear.disabled = compare.disabled = true
    summary.textContent = message
    list.replaceChildren()
  }
  reset('Capture a baseline to compare two moments in this scope.')
  capture.disabled = true
  function update(snapshot) {
    capture.disabled = !snapshot?.root?.isConnected || !snapshot.entries?.length
    if (baseline && !sampler.sameScope(baseline, snapshot)) {
      reset('The document or scope changed. Capture a new baseline in the current hierarchy.')
    }
  }
  function read() {
    const snapshot = readSnapshot()
    update(snapshot)
    return sampler.capture(snapshot)
  }
  const count = sample => sample.records.length + ' inspected' + (sample.partial ? ' (scan limited)' : '')
  const label = node => node ? node.label + ' [#' + node.id + ']' : 'Scope root'
  capture.addEventListener('click', () => {
    const sample = read()
    if (!sample) { reset('This scope is unavailable. Open a mounted hierarchy to capture a baseline.'); return }
    baseline = sample
    clear.disabled = compare.disabled = false
    list.replaceChildren()
    summary.textContent = 'Baseline captured · ' + count(sample) + '.'
  })
  compare.addEventListener('click', () => {
    const current = read()
    const result = compareHierarchySamples(baseline, current)
    if (!result) { reset('The document or scope changed. Capture a new baseline in the current hierarchy.'); return }
    const { counts, changes, total } = result
    const details = ['Baseline ' + count(baseline) + ', current ' + count(current) + '.',
      counts.added + ' added · ' + counts.removed + ' removed · ' + counts.reparented + ' reparented.']
    if (baseline.partial || current.partial) {
      details.push(counts['first-seen'] + ' first seen · ' + counts['last-seen'] + ' last seen. Membership outside a limited scan is unknown.')
    }
    if (total > changes.length) details.push('Showing ' + changes.length + ' of ' + total + ' changes.')
    summary.textContent = details.join(' ')
    list.replaceChildren(...changes.map(({ kind, node, from, to }) => {
      const row = create('li')
      row.dataset.navChange = kind
      row.textContent = kind.replace('-', ' ') + ' · ' + label(node)
      if (kind === 'reparented') row.textContent += ' · ' + label(from) + ' → ' + label(to)
      return row
    }))
  })
  clear.addEventListener('click', () => {
    reset('Baseline cleared. Capture a new baseline at any time.')
    capture.focus({ preventScroll: true })
  })
  return { update, panel }
}
