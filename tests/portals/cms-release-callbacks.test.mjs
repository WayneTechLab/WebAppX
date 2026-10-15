import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const cms = await loadMockModel(new URL('../../src/cms/model.ts', import.meta.url))
const releases = await loadMockModel(new URL('../../src/cms/release-bundles.ts', import.meta.url))
const source = await readFile(new URL('../../src/cms/CmsDemo.tsx', import.meta.url), 'utf8')
const syntax = ts.createSourceFile('CmsDemo.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaration = name => syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)?.getText(syntax)
const variable = name => syntax.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(syntax) === name))?.getText(syntax)
let onCommit
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(syntax) === 'ReleaseBundles') {
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(syntax) === 'onCommit')
    onCommit = attribute.initializer.expression.getText(syntax)
  }
  ts.forEachChild(node, visit)
}
visit(syntax)
assert.ok(onCommit, 'capture the actual parent persistence callback')
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
const componentCode = compile(['field', 'button', 'secondary', 'panel', 'emptyReleaseDraft'].map(variable).join('\n') + '\n' + declaration('useImmediateState') + '\n' + declaration('ReleaseBundles'))

function approvedPair() {
  const [author, reviewer] = cms.cmsActors
  let state = cms.createCmsState()
  for (const entryId of ['cms-page-001', 'cms-article-001']) {
    if (entryId === 'cms-page-001') state = cms.transitionCms(state, { type: 'edit-entry', entryId, expectedRevision: 1, title: 'Release welcome page', slug: 'release-welcome', body: 'A fictional welcome page prepared for a local release.' }, author)
    const expectedRevision = state.entries.find(entry => entry.id === entryId).revision
    state = cms.transitionCms(state, { type: 'submit-review', entryId, expectedRevision }, author)
    state = cms.transitionCms(state, { type: 'approve-entry', entryId, expectedRevision }, reviewer)
  }
  return state
}
function nodes(root, predicate) {
  if (Array.isArray(root)) return root.flatMap(item => nodes(item, predicate))
  if (!root || typeof root !== 'object') return []
  return [...(predicate(root) ? [root] : []), ...nodes(root.children, predicate)]
}
function text(root) {
  if (Array.isArray(root)) return root.map(text).join('')
  if (!root || typeof root === 'boolean') return ''
  return typeof root === 'object' ? text(root.children) : String(root)
}
function button(root, label) {
  const matches = nodes(root, node => node.type === 'button' && text(node) === label)
  assert.equal(matches.length, 1, label)
  return matches[0]
}

/** Capture the real component handlers and real parent updater. Only React hook
 * scheduling and the persistence handle are deterministic boundary fixtures;
 * all release/editorial operations are the application's actual pure modules.
 */
function harness(initial) {
  const slots = []
  let cursor = 0
  let latest = initial
  let commits = 0
  const useState = initialValue => {
    const index = cursor++
    if (!Object.hasOwn(slots, index)) slots[index] = typeof initialValue === 'function' ? initialValue() : initialValue
    return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update }]
  }
  const useRef = value => {
    const index = cursor++
    if (!Object.hasOwn(slots, index)) slots[index] = { current: value }
    return slots[index]
  }
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }), Fragment: 'fragment' }
  const Component = new Function('useState', 'useRef', 'useUnsavedWork', 'prepareCmsReleaseBundle', 'previewCmsReleaseBundle', 'activateCmsReleaseBundle', 'React', `${componentCode}; return ReleaseBundles`)(useState, useRef, () => {}, releases.prepareCmsReleaseBundle, releases.previewCmsReleaseBundle, releases.activateCmsReleaseBundle, React)
  const commit = new Function('setState', 'setMessage', 'setError', `${compile(`const commit = ${onCommit}`)}; return commit`)(update => { const next = typeof update === 'function' ? update(latest) : update; latest = next; commits += 1 }, () => {}, () => {})
  const renderedState = initial
  return {
    render() { cursor = 0; return Component({ state: renderedState, actor: cms.cmsActors[2], focusDraft() {}, onCommit: commit }) },
    get latest() { return latest },
    get commits() { return commits },
    acceptWithoutRerender(next) { latest = next },
  }
}

test('a retained actual Confirm callback refuses a newer accepted snapshot without a write or loss, and Cancel preserves it', () => {
  const state = releases.prepareCmsReleaseBundle(approvedPair(), { name: 'Release one', entryIds: ['cms-page-001', 'cms-article-001'] }, cms.cmsActors[2])
  const fixture = harness(state)
  button(fixture.render(), 'Preview release Release one').props.onClick()
  const confirm = button(fixture.render(), 'Confirm activate release').props.onClick
  const latest = cms.transitionCms(state, { type: 'create-entry', collectionId: 'pages', title: 'New accepted page', slug: 'new-accepted-page', body: 'A newly accepted fictional page must survive the old callback.' }, cms.cmsActors[0])
  fixture.acceptWithoutRerender(latest)
  const before = JSON.stringify(latest)
  confirm()
  const after = fixture.render()
  assert.equal(fixture.commits, 0)
  assert.equal(JSON.stringify(fixture.latest), before)
  assert.equal(fixture.latest.entries.at(-1).id, 'cms-entry-0006')
  assert.match(text(nodes(after, node => node.props.role === 'alert')), /preview is stale/)
  assert.equal(nodes(after, node => node.props['aria-label'] === 'CMS release activation preview').length, 1)
  button(after, 'Cancel release activation').props.onClick()
  assert.equal(fixture.commits, 0)
  assert.equal(JSON.stringify(fixture.latest), before)
  assert.equal(nodes(fixture.render(), node => node.props['aria-label'] === 'CMS release activation preview').length, 0)
})

test('a retained actual preparation callback checks latest member approval and keeps every field after refusal', () => {
  const state = approvedPair()
  const fixture = harness(state)
  let view = fixture.render()
  nodes(view, node => node.type === 'input' && node.props.id === 'cms-release-name')[0].props.onChange({ target: { value: 'Pending release' } })
  for (const checkbox of nodes(view, node => node.type === 'input' && node.props.type === 'checkbox')) checkbox.props.onChange({ target: { checked: true } })
  view = fixture.render()
  const prepare = nodes(view, node => node.type === 'form')[0].props.onSubmit
  const latest = cms.transitionCms(state, { type: 'edit-entry', entryId: 'cms-article-001', expectedRevision: 1, title: 'New accepted article', slug: 'team-update', body: 'A changed accepted draft no longer has its captured approval.' }, cms.cmsActors[0])
  fixture.acceptWithoutRerender(latest)
  const before = JSON.stringify(latest)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById() { return null } } })
  try { prepare({ preventDefault() {} }) }
  finally { if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document }
  view = fixture.render()
  assert.equal(fixture.commits, 0)
  assert.equal(JSON.stringify(fixture.latest), before)
  assert.equal(nodes(view, node => node.type === 'input' && node.props.id === 'cms-release-name')[0].props.value, 'Pending release')
  assert.deepEqual(nodes(view, node => node.type === 'input' && node.props.type === 'checkbox').map(node => node.props.checked), [true, true])
  assert.match(text(nodes(view, node => node.props.role === 'alert')), /needs separate reviewer approval/)
})

test('an actual preparation callback preserves a newer unrelated entry and records exactly one accepted state', () => {
  const state = approvedPair()
  const fixture = harness(state)
  let view = fixture.render()
  nodes(view, node => node.type === 'input' && node.props.id === 'cms-release-name')[0].props.onChange({ target: { value: 'Accepted release' } })
  for (const checkbox of nodes(view, node => node.type === 'input' && node.props.type === 'checkbox')) checkbox.props.onChange({ target: { checked: true } })
  view = fixture.render()
  const latest = cms.transitionCms(state, { type: 'create-entry', collectionId: 'pages', title: 'New accepted page', slug: 'new-accepted-page', body: 'A newly accepted fictional page must survive release preparation.' }, cms.cmsActors[0])
  fixture.acceptWithoutRerender(latest)
  nodes(view, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(fixture.commits, 1)
  assert.deepEqual(fixture.latest.entries, latest.entries)
  assert.deepEqual(fixture.latest.activity, latest.activity)
  assert.equal(fixture.latest.sequence, 6)
  assert.equal(fixture.latest.releaseBundles[0].preparedAtSequence, 6)
  view = fixture.render()
  assert.equal(nodes(view, node => node.type === 'input' && node.props.id === 'cms-release-name')[0].props.value, '')
  assert.deepEqual(nodes(view, node => node.type === 'input' && node.props.type === 'checkbox').map(node => node.props.checked), [false, false])
})
