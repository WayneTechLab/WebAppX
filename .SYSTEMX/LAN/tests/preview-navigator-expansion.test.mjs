import assert from 'node:assert/strict'
import test from 'node:test'
import { createNavigatorExpansion, indexNavigatorIdentities } from '../Website/preview-navigator-expansion.js'

const scope = 'fixture-workspace:/'
const branch = (anchor, key = anchor) => ({ anchor, key, tag: 'section', child: {} })
function scan(branches, { root = {}, limited = false } = {}) {
  const entries = [{ element: root, tag: 'body', children: branches }]
  const anchors = new Map()
  for (const element of branches) {
    entries.push({ element, anchor: element.anchor, tag: element.tag, sourcePath: element.path, children: [element.child] })
    if (element.anchor) anchors.set(element.anchor, (anchors.get(element.anchor) ?? 0) + 1)
  }
  const snapshot = { root, entries, anchors, rangeLimited: limited, byElement: new Map(entries.map(entry => [entry.element, entry])) }
  const identities = indexNavigatorIdentities(snapshot, entry => entry.element.key && { key: entry.element.key, anchor: entry.anchor, tag: entry.tag })
  return { snapshot, identities }
}
const update = (tracker, scan, expanded = new Set(), scopeKey = scope) => tracker.reconcile(scan.snapshot, expanded, scan.identities, scopeKey)

test('replaced branches restore expanded and deliberately collapsed choices only by unique declared identity', () => {
  const tracker = createNavigatorExpansion()
  const alpha = branch('alpha'), beta = branch('beta'), anonymous = branch(null)
  const before = scan([alpha, beta, anonymous])
  const { expanded } = update(tracker, before)
  for (const [node, open] of [[alpha, true], [beta, false], [anonymous, true]]) {
    if (open) expanded.add(node)
    tracker.remember(node, open)
  }
  const alpha2 = branch('alpha'), beta2 = branch('beta'), anonymous2 = branch(null)
  const after = scan([beta2, anonymous2, alpha2], { root: before.snapshot.root })
  const result = update(tracker, after, expanded)
  assert.deepEqual([...result.expanded], [before.snapshot.root, alpha2])
  assert.equal(result.restored, 2)
  assert.equal(result.unresolved, 1)
  assert.match(result.notice, /1 unresolved expansion choice/)
  const stable = update(tracker, after, result.expanded)
  assert.equal(stable.restored, 0)
  assert.equal(stable.unresolved, 0)
  assert.deepEqual(stable.expanded, result.expanded)
})

test('changed declarations, duplicate runtime anchors or duplicate durable references cannot reopen a similar node', () => {
  for (const newBranches of [[branch('head', 'different')], [branch('head'), branch('head')], [branch('head'), branch('second', 'head')]]) {
    const tracker = createNavigatorExpansion()
    const before = scan([branch('head')])
    const { expanded } = update(tracker, before)
    expanded.add(before.snapshot.entries[1].element)
    const after = scan(newBranches, { root: before.snapshot.root })
    const result = update(tracker, after, expanded)
    assert.equal(result.restored, 0)
    assert.equal(result.unresolved, 1)
    assert.deepEqual([...result.expanded], [after.snapshot.root])
  }
})

test('limited scans withhold durable matches and disclose lost choices without rediscovering unseen nodes', () => {
  const tracker = createNavigatorExpansion(), original = branch('head')
  const before = scan([original])
  const { expanded } = update(tracker, before)
  expanded.add(original)
  const limited = scan([original], { root: before.snapshot.root, limited: true })
  assert.equal(limited.identities.size, 0)
  const refused = update(tracker, limited, expanded)
  assert.equal(refused.unresolved, 1)
  assert.equal(refused.expanded.has(original), false)
  const restoredRange = scan([branch('head')], { root: before.snapshot.root })
  assert.equal(update(tracker, restoredRange, refused.expanded).restored, 0)
})

test('suspend releases old handles and reconciles only compatible choices when the same preview scope returns', () => {
  const tracker = createNavigatorExpansion()
  const original = branch('head'), unknown = branch(null)
  const before = scan([original, unknown])
  const { expanded } = update(tracker, before)
  expanded.add(original); expanded.add(unknown)
  tracker.suspend(expanded)
  tracker.suspend(new Set())
  const next = branch('head')
  const replacement = scan([next])
  const restored = update(tracker, replacement)
  assert.equal(restored.restored, 1)
  assert.equal(restored.unresolved, 1)
  assert.deepEqual([...restored.expanded], [replacement.snapshot.root, next])
  tracker.suspend(restored.expanded)
  const otherRoute = scan([branch('head')])
  const changed = update(tracker, otherRoute, new Set(), 'fixture-workspace:/other')
  assert.equal(changed.restored, 0)
  assert.deepEqual([...changed.expanded], [otherRoute.snapshot.root])
  assert.match(changed.notice, /scope changed/i)
  tracker.reset()
  assert.equal(update(tracker, replacement).restored, 0)
})

test('live anonymous branches retain manual expansion by handle, but detached unqualified branches stay collapsed', () => {
  const tracker = createNavigatorExpansion(), anonymous = branch(null), first = scan([anonymous])
  const initial = update(tracker, first)
  initial.expanded.add(anonymous)
  const unchanged = update(tracker, scan([anonymous], { root: first.snapshot.root }), initial.expanded)
  assert.equal(unchanged.expanded.has(anonymous), true)
  assert.equal(unchanged.restored, 0)
  const replaced = update(tracker, scan([branch(null)], { root: first.snapshot.root }), unchanged.expanded)
  assert.equal(replaced.unresolved, 1)
  assert.equal(replaced.expanded.size, 1)
})
