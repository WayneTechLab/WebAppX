import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPreviewHierarchy, previewNavigatorLimits, projectPreviewRows } from '../Website/preview-navigator.js'
import { parseNavigatorSearch } from '../Website/preview-navigator-search.js'

function element(tag, attributes = {}, children = []) {
  return {
    nodeType: 1, tagName: tag.toUpperCase(), attributes, children,
    hasAttribute(name) { return Object.hasOwn(attributes, name) },
    getAttribute(name) {
      assert.ok(!['value', 'placeholder', 'aria-label', 'title', 'type', 'data-private'].includes(name))
      return attributes[name] ?? null
    },
    get textContent() { throw Error('Private subtree text') },
    get value() { throw Error('Private form value') },
    matches() { throw Error('Unexpected selector execution') },
    querySelectorAll() { throw Error('Unexpected selector execution') },
  }
}

test('plain tag, ID, class and authored metadata retain folded substring search and ancestor visibility', () => {
  const item = element('button', { id: 'Hero', class: 'card-primary', 'data-systemx-name': 'Design area' })
  const snapshot = collectPreviewHierarchy(element('body', {}, [item]))
  for (const query of ['UTTON', '#he', '.CARD-', 'sign AREA']) {
    const view = projectPreviewRows(snapshot, { query })
    assert.equal(view.searchMode, 'plain')
    assert.equal(view.matchCount, 1)
    assert.deepEqual(view.rows.map(row => row.matched), [false, true])
  }
  const plain = projectPreviewRows(snapshot, { query: 'button long', limits: { ...previewNavigatorLimits, query: 6 } })
  assert.equal(plain.matchCount, 1)
  assert.match(plain.reasons[0], /first 6 characters/)
})

test('exact AND predicates support repeated class terms, quoted authored values and independent field semantics', () => {
  const attrs = { id: 'Save', class: 'btn Primary sm:hover', 'data-systemx-name': ' Save   draft ', 'data-systemx-component': 'Toolbar (v2)' }
  const target = element('button', attrs)
  const near = element('button', { ...attrs, class: 'btn Primary-extra' })
  const snapshot = collectPreviewHierarchy(element('body', {}, [target, near]))
  const query = 'TAG:BUTTON id:Save class:Primary class:"sm:hover" name:"SAVE draft" component:"Toolbar (v2)"'
  const view = projectPreviewRows(snapshot, { query })
  assert.equal(view.searchMode, 'predicates')
  assert.equal(view.predicateCount, 6)
  assert.equal(view.searchRefusal, null)
  assert.deepEqual(view.rows.map(row => row.element), [snapshot.root, target])
  for (const wrong of ['id:save', 'class:primary', 'name:"draft"', 'tag:but', 'component:toolbar', 'class:Pri']) {
    assert.equal(projectPreviewRows(snapshot, { query: wrong }).matchCount, 0, wrong)
  }
  const restricted = projectPreviewRows(snapshot, {
    query, filters: { kind: ['heading'], visibility: 'any', mapping: 'any' },
  })
  assert.equal(restricted.matchCount, 0)
})

test('refusal rejects the whole expression, reports a bounded fixed reason and leaves independent hierarchy state usable', () => {
  const child = element('input', { id: 'field', value: 'PRIVATE_CONTENT' })
  const root = element('body', {}, [element('section', {}, [child])])
  const snapshot = collectPreviewHierarchy(root)
  const expanded = new Set([root])
  const before = projectPreviewRows(snapshot, { expanded }).rows
  for (const query of ['tag:input value:PRIVATE_CONTENT', 'tag:input junk', 'tag:input OR id:field', 'TAG=', 'tag:', 'tag:input[class]',
    'class:field,textarea', 'name:"PRIVATE_CONTENT', 'tag:"input,textarea"', 'class:"field extra"', 'name:""', 'class:btn|tag:input',
    'tag:input '.repeat(7), '[value]', 'div > input', 'div+span', '.btn~input', 'div,span', 'input:where(div)', ' + ', 'tag:input' + ' '.repeat(160)]) {
    const view = projectPreviewRows(snapshot, { query, expanded })
    assert.equal(view.searchMode, 'refused', query)
    assert.equal(view.filtering, true)
    assert.equal(view.matchCount, 0)
    assert.deepEqual(view.rows, [])
    assert.equal(view.truncated, false)
    assert.match(view.searchRefusal, /^Search refused\./)
    assert.ok(!view.searchRefusal.includes('PRIVATE_CONTENT'))
  }
  assert.deepEqual(projectPreviewRows(snapshot, { expanded, query: '' }).rows, before)
  assert.equal(parseNavigatorSearch(' '.repeat(100_000) + 'tag:input').mode, 'refused')
})

test('clipped authored attributes cannot satisfy exact predicates, while intact fields remain usable', () => {
  const prefix = 'known', rest = ' '.repeat(501) + 'tail'
  const item = element('button', { id: 'current', class: prefix + rest, 'data-systemx-name': prefix + rest, 'data-systemx-component': 'known' })
  const snapshot = collectPreviewHierarchy(element('body', {}, [item]))
  for (const query of ['name:known', 'class:known']) {
    const view = projectPreviewRows(snapshot, { query })
    assert.equal(view.matchCount, 0)
    assert.ok(view.reasons.some(reason => reason.includes('metadata limited to 500')))
  }
  assert.equal(projectPreviewRows(snapshot, { query: 'id:current component:known' }).matchCount, 1)
})

test('structured searches retain bounded match and row projections in scoped snapshots', () => {
  const entries = Array.from({ length: 15 }, () => element('li', { 'data-systemx-name': 'Reused row' }))
  const snapshot = collectPreviewHierarchy(element('ul', {}, entries), { ...previewNavigatorLimits, nodes: 9 })
  const view = projectPreviewRows(snapshot, { query: 'tag:li name:"reused row"', limits: { ...previewNavigatorLimits, matches: 3, rows: 2 } })
  assert.equal(view.matchCount, 8)
  assert.equal(view.rows.length, 2)
  assert.equal(view.truncated, true)
  assert.match(view.reasons.join(' '), /first 3 of 8/)
  assert.match(view.reasons.join(' '), /limited to 9 nodes/)
})
