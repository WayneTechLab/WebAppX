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
