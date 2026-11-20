// Index only the inspected mounted range. A limited scan cannot establish that an
// anchor is unique, even when just one occurrence is visible within the budget.
export function indexNavigatorIdentities(snapshot, identify) {
  const identities = new Map()
  if (!snapshot?.anchors || snapshot.rangeLimited || typeof identify !== 'function') return identities
  const seen = new Map()
  for (const entry of snapshot.entries) {
    if (!entry.anchor || snapshot.anchors.get(entry.anchor) !== 1) continue
    const identity = identify(entry)
    if (typeof identity?.key !== 'string' || !identity.key || identity.anchor !== entry.anchor || identity.tag !== entry.tag) continue
    if (seen.has(identity.key)) {
      identities.delete(seen.get(identity.key))
      continue
    }
    seen.set(identity.key, entry.element)
    identities.set(entry.element, identity)
  }
  return identities
}

export function createNavigatorExpansion() {
  let current, qualified = new Map(), deliberate = new Map(), scope, suspended

  function reset() {
    current = null
    qualified = new Map()
    deliberate = new Map()
    scope = undefined
    suspended = null
  }

  function choices(expanded) {
    const result = []
    if (!current) return result
    for (const entry of current.entries) {
      const element = entry.element
      if (!entry.children.length || (!deliberate.has(element) && (!expanded.has(element) || element === current.root))) continue
      result.push({ element, anchor: entry.anchor, sourcePath: entry.sourcePath, key: qualified.get(element)?.key,
        open: expanded.has(element), explicit: deliberate.has(element) })
    }
    return result
  }

  function suspend(expanded) {
    if (!current) return
    // A hidden/loading iframe can keep an entire old document alive. Retain
    // only qualified strings and booleans, plus a count of omitted choices.
    const pending = choices(expanded)
    suspended = {
      rootClosed: !expanded.has(current.root),
      omitted: pending.filter(choice => !choice.key).length,
      choices: pending.filter(choice => choice.key).map(({ key, open, explicit }) => ({ key, open, explicit })),
    }
    current = null
    qualified = new Map()
    deliberate = new Map()
  }

  function reconcile(snapshot, previousExpanded, identities, scopeKey) {
    const expanded = new Set([snapshot.root]), nextChoices = new Map()
    const sameScope = scope !== undefined && scopeKey === scope
    let unresolved = 0, restored = 0, notice = ''
    if (sameScope) {
      const byKey = new Map([...identities].map(([element, identity]) => [identity.key, element]))
      const pending = suspended?.choices ?? choices(previousExpanded)
      unresolved = suspended?.omitted ?? 0
      if (suspended?.rootClosed || (current && !previousExpanded.has(current.root))) expanded.delete(snapshot.root)
      for (const choice of pending) {
        const same = snapshot.byElement.get(choice.element)
        let target
        if (same && (!same.anchor || (!snapshot.rangeLimited && snapshot.anchors.get(same.anchor) === 1)) &&
            same.anchor === choice.anchor && same.sourcePath === choice.sourcePath &&
            (!choice.key || identities.get(choice.element)?.key === choice.key)) target = choice.element
        else if (choice.key) target = byKey.get(choice.key)
        if (!target || !snapshot.byElement.get(target)?.children.length) { unresolved++; continue }
        if (choice.open) expanded.add(target)
        else expanded.delete(target)
        if (choice.explicit) nextChoices.set(target, choice.open)
        if (target !== choice.element) restored++
      }
      if (restored) notice = `Restored ${restored} expansion choice${restored === 1 ? '' : 's'} by accepted identity.`
      if (unresolved) notice += (notice ? ' ' : '') + `${unresolved} unresolved expansion choice${unresolved === 1 ? '' : 's'}. Missing, ambiguous or replaced branches stay collapsed.`
    } else if (scope !== undefined) {
      notice = 'Hierarchy scope changed. Previous expansion choices were cleared.'
    }
    current = snapshot
    qualified = identities
    deliberate = nextChoices
    scope = scopeKey
    suspended = null
    return { expanded, restored, unresolved, notice }
  }

  function remember(element, open) {
    if (current?.byElement.get(element)?.children.length) deliberate.set(element, open)
  }
  return { reconcile, remember, suspend, reset }
}
