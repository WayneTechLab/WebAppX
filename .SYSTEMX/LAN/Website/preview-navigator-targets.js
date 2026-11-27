import { ancestorPreviewEntries, previewNavigatorLimits, projectPreviewRows } from './preview-navigator.js'

export function duplicateMatchContexts(projection) {
  const contexts = new Map()
  if (!projection.filtering || !projection.matching?.size) return contexts
  const visible = new Set(projection.rows.map(row => row.element))
  const totals = new Map(), occurrences = new Map()
  for (const entry of projection.matching) totals.set(entry.label, (totals.get(entry.label) ?? 0) + 1)
  for (const entry of projection.matching) {
    const total = totals.get(entry.label)
    if (total < 2) continue
    const occurrence = (occurrences.get(entry.label) ?? 0) + 1
    occurrences.set(entry.label, occurrence)
    if (!visible.has(entry.element)) continue
    const parents = []
    for (let parent = entry.parent; parent && parents.length < 2; parent = parent.parent) {
      const label = parent.label
      parents.unshift(label.length > 40 ? label.slice(0, 39) + '…' : label)
    }
    contexts.set(entry.element, `${parents.length ? parents.join(' › ') + ' · ' : ''}inspected match ${occurrence} of ${total}`)
  }
  return contexts
}

export function revealPathMatches(snapshot, prior) {
  if (!snapshot || snapshot.root !== prior?.root || !snapshot.byElement.has(prior.target)) return false
  const chain = ancestorPreviewEntries(snapshot, prior.target)
  return chain.length === prior.chain.length && chain.every((entry, index) => entry.element === prior.chain[index])
}

export function revealAncestorStep(snapshot, target, expanded, { previous, limits = previewNavigatorLimits } = {}) {
  if (previous && !revealPathMatches(snapshot, previous)) {
    return { status: 'unavailable', notice: 'The reveal path changed or was replaced. Select the current target to start again.' }
  }
  const entries = ancestorPreviewEntries(snapshot, target)
  if (!entries.length) {
    const budget = snapshot?.rangeLimited ? ' ' + snapshot.reasons.join(' ') : ''
    return { status: 'unavailable', notice: 'Target unavailable in the inspected hierarchy.' + budget }
  }
  const chain = entries.map(entry => entry.element)
  const closed = chain.slice(0, -1).filter(element => !expanded.has(element))
  const opened = closed.slice(0, 5)
  const next = new Set([...expanded, ...opened])
  const remaining = closed.length - opened.length
  const frontier = remaining ? closed[opened.length] : target
  const projection = projectPreviewRows(snapshot, { expanded: next, limits })
  if (!projection.rows.some(row => row.element === frontier)) {
    return { status: 'limited', expanded: next, notice: `Reveal reached the ${limits.rows}-row view limit. Collapse other branches or search for the target.` }
  }
  if (remaining) return { status: 'partial', expanded: next, frontier, pending: { root: snapshot.root, target, chain },
    notice: `Opened ${opened.length} ancestors. ${remaining} collapsed ancestors remain. Choose Reveal next ancestors to continue.` }
  return { status: 'revealed', expanded: next, frontier: target, notice: 'Target visible in the inspected hierarchy.' }
}

// Keep ordinary input at its existing native bound. An oversized structured
// paste retains one extra character so the parser refuses the whole expression.
export function bindNavigatorSearch(input, changed) {
  if (!input) return
  const limit = previewNavigatorLimits.query
  const update = () => {
    const structured = input.value.includes(':')
    input.maxLength = structured ? limit + 1 : limit
    if (input.value.length > input.maxLength) input.value = input.value.slice(0, input.maxLength)
    changed(input.value)
  }
  input.addEventListener('beforeinput', event => {
    if (!event.inputType?.startsWith('insert')) return
    const insertion = event.data ?? event.dataTransfer?.getData('text/plain')
    if (typeof insertion !== 'string') return
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start
    if (input.value.length - (end - start) + insertion.length <= limit) return
    const candidate = input.value.slice(0, start) + insertion.slice(0, limit + 1) + input.value.slice(end)
    if (!candidate.includes(':')) return
    event.preventDefault()
    input.maxLength = limit + 1
    input.value = candidate.slice(0, limit + 1)
    changed(input.value)
  })
  input.addEventListener('input', update)
}
