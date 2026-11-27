import './preview-navigator-expansion.test.mjs'
import './preview-navigator-search.test.mjs'
import './preview-navigator-bookmarks.test.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewNavigatorLimits, collectPreviewHierarchy, projectPreviewRows, ancestorPreviewEntries, isCurrentPreviewElement } from '../Website/preview-navigator.js'

const documentIdentity = {}
class ElementFixture {
  constructor(tag, attributes = {}, children = [], ownerDocument = documentIdentity) {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.attributes = attributes
    this.children = children
    this.ownerDocument = ownerDocument
    this.isConnected = true
    for (const child of children) child.parentElement = this
  }
  getAttribute(name) { return this.attributes[name] ?? null }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name) }
  contains(element) { return this.children.some((child) => child === element || child.contains(element)) }
  get textContent() { throw new Error('Navigator must not read subtree text') }
  get value() { throw new Error('Navigator must not read input values') }
}
const node = (tag, attributes, children) => new ElementFixture(tag, attributes, children)
const limits = (overrides) => ({ ...previewNavigatorLimits, ...overrides })

test('read-only hierarchy includes more than ten children and preserves expansion independently', () => {
  const children = Array.from({ length: 24 }, (_, index) => node('section', { id: `section-${index}` }, [node('h2')]))
  const root = node('body', {}, children)
  const snapshot = collectPreviewHierarchy(root)
  assert.equal(snapshot.entries.length, 49)
  assert.equal(snapshot.truncated, false)
  assert.equal(projectPreviewRows(snapshot).rows.length, 1)
  const expanded = new Set([root, children[23]])
  const rows = projectPreviewRows(snapshot, { expanded }).rows
  assert.equal(rows.length, 26)
  assert.ok(rows.some((entry) => entry.element === children[23].children[0]))
  assert.deepEqual(ancestorPreviewEntries(snapshot, children[23].children[0]).map((entry) => entry.element), [root, children[23], children[23].children[0]])
  assert.equal(root.children.length, 24)
})

test('search reads only bounded tag, ID, class, and explicit name/component metadata', () => {
  const named = node('section', { id: 'hero', class: 'layout card special final', 'data-systemx-name': 'Campaign area', 'data-systemx-component': 'FeaturePanel' }, [node('input', { value: 'never-harvest-this', placeholder: 'private-field', 'aria-label': 'private-label' })])
  const root = node('body', {}, [named])
  const snapshot = collectPreviewHierarchy(root)
  for (const query of ['SECTION', 'hero', '#hero', '.card', '.final', 'campaign', 'featurepanel']) {
    const result = projectPreviewRows(snapshot, { query })
    assert.equal(result.matchCount, 1, query)
    assert.deepEqual(result.rows.map((entry) => entry.element), [root, named])
  }
  for (const query of ['never-harvest-this', 'private-field', 'private-label']) {
    assert.equal(projectPreviewRows(snapshot, { query }).matchCount, 0)
  }
  assert.equal(snapshot.byElement.get(named).label, 'Campaign area · section#hero.layout.card.special')
})

test('hidden/inert and inherited states remain metadata without changing inspectability', () => {
  const child = node('button')
  const hidden = node('div', { hidden: '', inert: '', 'aria-hidden': 'true' }, [child])
  const root = node('body', {}, [hidden])
  const snapshot = collectPreviewHierarchy(root)
  assert.equal(snapshot.byElement.get(child).hidden, true)
  assert.equal(snapshot.byElement.get(child).inert, true)
  assert.equal(snapshot.byElement.get(child).ariaHidden, true)
  assert.equal(isCurrentPreviewElement(child, root), true)
  assert.deepEqual(hidden.attributes, { hidden: '', inert: '', 'aria-hidden': 'true' })
})

test('source-only and executable metadata nodes are excluded from the runtime hierarchy', () => {
  const root = node('body', {}, [node('script', { id: 'secret-script' }), node('style'), node('template', {}, [node('section')]), node('iframe', { id: 'nested-frame' }), node('main')])
  const snapshot = collectPreviewHierarchy(root)
  assert.deepEqual(snapshot.entries.map((entry) => entry.tag), ['body', 'iframe', 'main'])
  assert.equal(projectPreviewRows(snapshot, { query: 'secret-script' }).matchCount, 0)
})

test('node and depth limits identify incomplete scans even when search has no matches', () => {
  const root = node('body', {}, Array.from({ length: 30 }, (_, index) => node('p', { id: `p-${index}` })))
  const snapshot = collectPreviewHierarchy(root, limits({ nodes: 8 }))
  assert.equal(snapshot.entries.length, 8)
  const noMatch = projectPreviewRows(snapshot, { query: 'p-29' })
  assert.equal(noMatch.matchCount, 0)
  assert.equal(noMatch.truncated, true)
  assert.match(noMatch.reasons.join(' '), /limited to 8 nodes/)
  const deep = node('body', {}, [node('div', {}, [node('section', {}, [node('button')])])])
  const depth = collectPreviewHierarchy(deep, limits({ depth: 2 }))
  assert.deepEqual(depth.entries.map((entry) => entry.depth), [0, 1, 2])
  assert.match(depth.reasons.join(' '), /depth limited to 2/)
})

test('query, match, row and metadata limits are explicit', () => {
  const root = node('body', {}, Array.from({ length: 8 }, (_, index) => node('article', { class: 'card', id: `item-${index}` })))
  const snapshot = collectPreviewHierarchy(root)
  const result = projectPreviewRows(snapshot, { query: '.card', limits: limits({ matches: 2, rows: 2 }) })
  assert.equal(result.matchCount, 8)
  assert.equal(result.rows.length, 2)
  assert.match(result.reasons.join(' '), /first 2 of 8/)
  assert.match(result.reasons.join(' '), /limited to 2 rows/)
  const query = projectPreviewRows(snapshot, { query: 'article-extra-long', limits: limits({ query: 7 }) })
  assert.equal(query.query, 'article')
  assert.match(query.reasons.join(' '), /first 7 characters/)
  const large = collectPreviewHierarchy(node('body', {}, [node('div', { class: 'x'.repeat(100000) + 'suffix' })]))
  assert.equal(large.entries[1].search.includes('suffix'), false)
  assert.match(large.reasons.join(' '), /metadata limited to 500/)
})

test('scope checks refuse stale, detached, other-document and outside-body elements', () => {
  const child = node('main')
  const root = node('body', {}, [child])
  assert.equal(isCurrentPreviewElement(child, root), true)
  assert.equal(isCurrentPreviewElement(root, root), true)
  child.isConnected = false
  assert.equal(isCurrentPreviewElement(child, root), false)
  child.isConnected = true
  child.ownerDocument = {}
  assert.equal(isCurrentPreviewElement(child, root), false)
  assert.equal(isCurrentPreviewElement(node('main'), root), false)
  assert.equal(isCurrentPreviewElement(child, null), false)
})

test('a fresh snapshot reflects replacement and reparenting without resolving stale nodes', () => {
  const old = node('p', { id: 'replace' })
  const branch = node('main', {}, [old])
  const root = node('body', {}, [branch])
  const first = collectPreviewHierarchy(root)
  const replacement = node('p', { id: 'replace' })
  root.children = [replacement, branch]
  replacement.parentElement = root
  branch.children = []
  old.isConnected = false
  const next = collectPreviewHierarchy(root)
  assert.equal(first.byElement.has(old), true)
  assert.equal(next.byElement.has(old), false)
  assert.equal(next.byElement.get(replacement).parent.element, root)
  assert.equal(isCurrentPreviewElement(old, root), false)
})

test('semantic filtering intersects metadata with a union of kinds and preserves ancestor expansion', () => {
  const action = node('div', { role: 'button', class: 'shared' })
  const heading = node('h2', { class: 'shared' })
  const link = node('a', { href: '/', class: 'shared' })
  const section = node('section', { class: 'shared' }, [action, heading, link])
  const root = node('body', {}, [section])
  const snapshot = collectPreviewHierarchy(root)
  const expanded = new Set([root])
  const filters = { kind: ['control', 'heading'], visibility: 'any', mapping: 'any' }
  const result = projectPreviewRows(snapshot, { expanded, filters, query: 'shared' })
  assert.deepEqual(result.rows.map(item => [item.tag, item.matched]), [['body', false], ['section', false], ['div', true], ['h2', true]])
  assert.equal(result.matchCount, 2)
  assert.deepEqual(projectPreviewRows(snapshot, { expanded }).rows.map(item => item.tag), ['body', 'section'])
})

test('mapping projection qualifies unique explicit anchors only within a complete scan', () => {
  const el = (id, source) => node('h2', { 'data-systemx-id': id, ...(source && { 'data-systemx-source': source }) })
  const group = node('section', { 'data-systemx-source': 'src/Owner.tsx' }, [el('unique'), el('duplicate'), el('duplicate'), el('other', 'src/Other.tsx')])
  const root = node('body', {}, [group])
  const filters = { kind: [], visibility: 'any', mapping: 'mapped' }
  const lookups = []
  const ownership = entry => { lookups.push(entry.anchor); return entry.sourcePath === 'src/Owner.tsx' ? 'mapped' : 'unmapped' }
  const result = projectPreviewRows(collectPreviewHierarchy(root), { filters, ownership })
  assert.equal(result.matchCount, 1)
  assert.deepEqual(lookups, ['unique', 'other'])
  lookups.length = 0
  assert.equal(projectPreviewRows(collectPreviewHierarchy(root, limits({ nodes: 4 })), { filters, ownership }).matchCount, 0)
  assert.deepEqual(lookups, [])
})

test('declared cross-origin and opaque frame boundaries exclude contents before any document inspection', async () => {
  const { frameBoundary } = await import('../Website/preview-navigator-context.js')
  const doc = { baseURI: 'http://127.0.0.1:5123/', defaultView: { origin: 'http://127.0.0.1:5123' } }
  for (const [attrs, reason] of [[{ src: 'http://localhost:5123/private?token=redacted' }, 'Cross-origin frame'], [{ sandbox: '' }, 'Opaque sandbox'], [{ src: 'data:text/html,redacted' }, 'Unsupported frame URL']]) {
    const frame = new ElementFixture('iframe', attrs, [node('h2')], doc)
    frame.sandbox = { contains: () => false }
    let read = 0
    Object.defineProperty(frame, 'contentDocument', { get() { read++; throw Error('Private frame') } })
    assert.deepEqual(frameBoundary(frame), { root: null, reason })
    assert.equal(read, 0)
    assert.equal(collectPreviewHierarchy(frame).entries.length, 1)
  }
})

test('comparison tracks DOM identity across repeated labels, moving parents and replacement without reading private fields', async () => {
  const { createHierarchySampler, compareHierarchySamples } = await import('../Website/preview-navigator-comparison.js')
  const first = node('span'), second = node('span'), oldField = node('input', { value: 'private' })
  const left = node('section', { id: 'left' }, [first, second, oldField])
  const right = node('section', { id: 'right' })
  const root = node('body', {}, [left, right])
  const sampler = createHierarchySampler()
  const before = sampler.capture(collectPreviewHierarchy(root))
  // The first span stays in place. The second moves. An identical-looking
  // input replaces the old element and gets its own ephemeral handle.
  left.children = [first, node('input', { value: 'private again' })]
  right.children = [second]
  const after = sampler.capture(collectPreviewHierarchy(root))
  const diff = compareHierarchySamples(before, after)
  assert.deepEqual(diff.counts, { added: 1, removed: 1, reparented: 1, 'first-seen': 0, 'last-seen': 0 })
  const moved = diff.changes.find(change => change.kind === 'reparented')
  assert.equal(moved.node.label, 'span')
  assert.equal(moved.from.label, 'section#left')
  assert.equal(moved.to.label, 'section#right')
  assert.deepEqual(before.records.filter(record => record.label === 'span').map(record => record.parent), [moved.from.id, moved.from.id])
  assert.equal(Object.isFrozen(before.records[0]), true)
  assert.ok(!JSON.stringify(diff).includes('private'))
})

test('comparison bounds presentation and reports uncertain membership for the incomplete direction only', async () => {
  const { createHierarchySampler, compareHierarchySamples } = await import('../Website/preview-navigator-comparison.js')
  const root = node('body', {}, Array.from({ length: 145 }, () => node('li')))
  const sampler = createHierarchySampler()
  const full = sampler.capture(collectPreviewHierarchy(root))
  const partial = sampler.capture(collectPreviewHierarchy(root, limits({ nodes: 2 })))
  const seen = compareHierarchySamples(partial, full)
  assert.equal(seen.counts['first-seen'], 144)
  assert.equal(seen.counts.added, 0)
  assert.equal(seen.changes.length, 120)
  assert.equal(seen.total, 144)
  const lost = compareHierarchySamples(full, partial)
  assert.equal(lost.counts['last-seen'], 144)
  assert.equal(lost.counts.removed, 0)
  // Long authored labels alone do not hide nodes from discovery.
  root.children = [node('span', { id: 'x'.repeat(550) })]
  const shortened = sampler.capture(collectPreviewHierarchy(root))
  assert.equal(shortened.partial, false)
  assert.equal(compareHierarchySamples(full, shortened).counts.removed, 145)
})

test('comparison refuses another scope, replaced document, foreign handle series and detached roots', async () => {
  const { createHierarchySampler, compareHierarchySamples } = await import('../Website/preview-navigator-comparison.js')
  const frame = node('iframe')
  const root = node('body', {}, [frame])
  const sampler = createHierarchySampler()
  const top = collectPreviewHierarchy(root)
  const original = sampler.capture(top)
  assert.equal(sampler.sameScope(original, top), true)
  assert.equal(compareHierarchySamples(original, createHierarchySampler().capture(top)), null)
  assert.equal(compareHierarchySamples(original, sampler.capture(collectPreviewHierarchy(frame))), null)
  root.ownerDocument = {}
  assert.equal(sampler.sameScope(original, collectPreviewHierarchy(root)), false)
  assert.equal(compareHierarchySamples(original, sampler.capture(collectPreviewHierarchy(root))), null)
  root.isConnected = false
  assert.equal(sampler.capture(collectPreviewHierarchy(root)), null)
})

test('virtual windows count nearest mounted items independently and retain unknown or conflicting logical totals', async () => {
  const { virtualCoverage } = await import('../Website/preview-navigator-inspection.js')
  const child = node('ul', { id: 'nested', 'data-systemx-virtualized': 'true' }, [node('li')])
  const list = node('ol', { id: 'window' }, [
    node('li', { 'aria-setsize': '500', 'aria-posinset': '31' }, [child]),
    node('li', { 'aria-setsize': '500', 'aria-posinset': '32' }),
  ])
  const grid = node('div', { role: 'grid', 'aria-rowcount': '800' }, [node('div', { role: 'rowgroup' }, [node('div', { role: 'row', 'aria-rowindex': '14' })])])
  const wrong = node('ul', { id: 'invalid' }, [
    node('li', { 'aria-setsize': '16', 'aria-posinset': '4' }),
    node('li', { 'aria-setsize': '15', 'aria-posinset': '4' }),
  ])
  const normal = node('ol', {}, [node('li')])
  const root = node('body', {}, [list, grid, wrong, normal])
  const view = virtualCoverage(collectPreviewHierarchy(root))
  assert.deepEqual(view.map(({ total, mounted, positioned, inconsistent }) => [total, mounted, positioned, inconsistent]), [
    [500, 2, 2, false], [null, 1, 0, false], [800, 1, 1, false], [null, 2, 1, true],
  ])
  const limited = collectPreviewHierarchy(root, limits({ nodes: 3 }))
  assert.equal(limited.rangeLimited, true)
  assert.equal(virtualCoverage(limited)[0].mounted, 1)
})

test('grouping requires a current definition-matched declaration, retaining DOM order and repeated instance labels', async () => {
  const { componentGroups } = await import('../Website/preview-navigator-inspection.js')
  const first = node('article', { 'data-systemx-component': 'Card' })
  const unmapped = node('article', { 'data-systemx-component': 'Card' })
  const wrongName = node('article', { 'data-systemx-component': 'Other' })
  const second = node('article', { 'data-systemx-component': 'Card' })
  const root = node('body', {}, [second, wrongName, first, unmapped])
  const snapshot = collectPreviewHierarchy(root)
  const definition = { name: 'Card', sourcePath: 'src/Card.tsx' }
  const common = { workspaceId: 'local', documentId: 'document', definition }
  const identities = new Map([[first, { ...common, key: 'first' }], [second, { ...common, key: 'second' }], [wrongName, common]])
  const [group] = componentGroups(snapshot, identities)
  assert.deepEqual(group.instances.map(instance => instance.key), ['second', 'first'])
  assert.deepEqual(root.children, [second, wrongName, first, unmapped])
  assert.deepEqual(componentGroups(snapshot, new Map()), [])
})

test('duplicate match contexts distinguish inspected occurrences and only expose two bounded authored ancestors', async () => {
  const { duplicateMatchContexts } = await import('../Website/preview-navigator-targets.js')
  const duplicate = () => node('button', { 'data-systemx-name': 'Save', class: 'action' })
  const a = duplicate(), b = duplicate(), c = duplicate()
  const root = node('body', {}, [node('main', { id: 'outer' }, [node('div', { id: 'left' }, [a, b]), node('div', { id: 'right' }, [c])])])
  const snapshot = collectPreviewHierarchy(root)
  const result = projectPreviewRows(snapshot, { query: 'tag:button name:Save' })
  const contexts = duplicateMatchContexts(result)
  assert.deepEqual([...contexts.values()], [
    'main#outer › div#left · inspected match 1 of 3', 'main#outer › div#left · inspected match 2 of 3',
    'main#outer › div#right · inspected match 3 of 3',
  ])
  assert.equal(duplicateMatchContexts(projectPreviewRows(snapshot)).size, 0)
})

test('progressive reveal opens five or fewer collapsed ancestors per action and refuses a changed path', async () => {
  const { revealAncestorStep, revealPathMatches } = await import('../Website/preview-navigator-targets.js')
  const target = node('button'), parents = [target]
  for (let i = 0; i < 16; i++) parents.unshift(node('section', {}, [parents[0]]))
  const root = node('body', {}, [parents[0]])
  const snap = collectPreviewHierarchy(root)
  let expanded = new Set([root]), pending
  for (const expected of ['partial', 'partial', 'partial', 'revealed']) {
    const result = revealAncestorStep(snap, target, expanded, { previous: pending })
    assert.equal(result.status, expected)
    assert.ok(result.expanded.size - expanded.size <= 5)
    expanded = result.expanded
    pending = result.pending
  }
  const firstStep = revealAncestorStep(snap, target, new Set([root]))
  parents.at(-2).children = []
  parents[0].children.push(target)
  const changed = collectPreviewHierarchy(root)
  assert.equal(revealPathMatches(changed, firstStep.pending), false)
  assert.equal(revealAncestorStep(changed, target, expanded, { previous: firstStep.pending }).status, 'unavailable')
  const limited = collectPreviewHierarchy(root, limits({ depth: 1 }))
  assert.match(revealAncestorStep(limited, target, expanded).notice, /depth limited to 1/)
  assert.equal(revealAncestorStep(snap, target, expanded, { limits: limits({ rows: 4 }) }).status, 'limited')
})
