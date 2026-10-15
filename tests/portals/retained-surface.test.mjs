import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const source = await readFile(new URL('../../src/portals/RetainedPortalSurface.tsx', import.meta.url), 'utf8')
const template = await readFile(new URL('../../src/pages/TemplatePortalsPage.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')
const evaluate = dependencies => new Function(...Object.keys(dependencies), `${compiled}\nreturn {RetainedPortalSurface,createRetainedSurface}`)(...Object.values(dependencies))
const jsx = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }

/** Narrow owned-element ports exercise the actual placement/effect callbacks.
 * React reconciliation, browser DOM/AX absence and input-state preservation are
 * separate browser evidence; this harness does not claim those observations. */
function elements() {
  const operations = [], created = []
  const document = { createElement(tag) {
    const node = { tag, ownerDocument: document, parentNode: null, children: [],
      appendChild(child) { if (child.parentNode) child.remove(); this.children.push(child); child.parentNode = this; operations.push(['append', this, child]); return child },
      remove() { const parent = this.parentNode; if (parent) { parent.children.splice(parent.children.indexOf(this), 1); this.parentNode = null; operations.push(['remove', parent, this]) } },
    }
    created.push(node)
    return node
  } }
  return { document, operations, created, anchor: document.createElement('anchor') }
}

function component(initialSuspended = false) {
  const dom = elements(), slots = [], portals = [], effectSlots = []
  const child = { type: 'LiteralRetainedChild', props: { identity: 'same child tree' } }
  let cursor = 0, effects = [], rerender = false, tree, suspended = initialSuspended
  const dependencies = {
    React: jsx,
    createPortal(children, container, key) { const portal = { children, container, key }; portals.push(portal); return portal },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], () => assert.fail('No React state update belongs to render or placement')] },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useSyncExternalStore(subscribe, read, server) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { unsubscribe: subscribe(() => { rerender = true }), read, server }
      return read()
    },
    useLayoutEffect(setup, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((item, position) => !Object.is(item, previous.deps[position]))) effects.push(() => {
        previous?.cleanup?.()
        slots[index] = { setup, deps, cleanup: setup() }
        if (!effectSlots.includes(index)) effectSlots.push(index)
      })
    },
  }
  const actual = evaluate(dependencies)
  function render(value = suspended) {
    suspended = value
    let attempts = 0
    do {
      assert.ok(++attempts < 5, 'Committed target publication must settle')
      cursor = 0; effects = []; rerender = false
      const count = dom.created.length
      tree = actual.RetainedPortalSurface({ suspended, children: child })
      assert.equal(dom.created.length, count, 'Render never allocates DOM')
      tree.props.ref.current = dom.anchor
      for (const effect of effects) effect()
    } while (rerender)
    return tree
  }
  return { dom, portals, child, render,
    strictReplay() { for (const index of effectSlots) slots[index].cleanup?.(); for (const index of effectSlots) slots[index].cleanup = slots[index].setup() },
    unmount() { for (const index of effectSlots) slots[index].cleanup?.(); for (const slot of slots) slot?.unsubscribe?.(); tree.props.ref.current = null },
  }
}

test('module evaluation and actual React server rendering require no DOM and create no portal', () => {
  let portals = 0
  const actual = evaluate({ React, useLayoutEffect: React.useLayoutEffect, useRef: React.useRef, useState: React.useState, useSyncExternalStore: React.useSyncExternalStore, createPortal() { portals++; throw new Error('A server must not create a DOM portal') } })
  const controller = actual.createRetainedSurface()
  assert.equal(controller.read(), null); assert.equal(controller.server(), null)
  for (const suspended of [false, true]) assert.equal(renderToStaticMarkup(React.createElement(actual.RetainedPortalSurface, { suspended }, React.createElement('input', { type: 'file' }))), '<div data-retained-portal-surface=""></div>')
  assert.equal(portals, 0)
})

test('first committed layout allocates one owned div and ordinary re-renders retain its exact portal target', () => {
  const ui = component(); const tree = ui.render()
  assert.equal(ui.dom.created.length, 2, 'One anchor plus one surface')
  const target = ui.dom.created[1]
  assert.equal(target.tag, 'div'); assert.equal(target.parentNode, ui.dom.anchor)
  assert.deepEqual(ui.dom.anchor.children, [target])
  assert.equal(tree.props.children[0].container, target)
  ui.render(); ui.render()
  assert.equal(ui.dom.created.length, 2)
  assert.ok(ui.portals.every(portal => portal.container === target && portal.children === ui.child && portal.key === undefined))
})

test('suspension detaches only the surface while retaining target, child nodes and portal composition', () => {
  const ui = component(); ui.render()
  const target = ui.dom.created[1], ownedChild = ui.dom.document.createElement('react-owned-input')
  target.appendChild(ownedChild)
  const tree = ui.render(true)
  assert.equal(target.parentNode, null); assert.deepEqual(ui.dom.anchor.children, [])
  assert.deepEqual(target.children, [ownedChild]); assert.equal(ownedChild.parentNode, target)
  assert.equal(tree.props.children[0].container, target, 'Portal remains rendered while target is disconnected')
  assert.equal(tree.props.children[0].children, ui.child)
  ui.render(true)
  assert.equal(ui.dom.created.length, 3); assert.equal(target.children[0], ownedChild)
})

test('resuming reattaches the same target during the actual layout callback before a later focus turn', () => {
  const ui = component(); ui.render()
  const target = ui.dom.created[1]
  ui.render(true); ui.render(false)
  assert.equal(target.parentNode, ui.dom.anchor)
  assert.equal(ui.portals.at(-1).container, target)
  assert.deepEqual(ui.dom.operations.at(-1), ['append', ui.dom.anchor, target])
  const focusTurn = () => assert.equal(target.parentNode, ui.dom.anchor, 'Destination focus sees a reattached surface after layout')
  focusTurn()
})

test('initial suspension never connects the surface and still creates its retained portal children', () => {
  const ui = component(true), tree = ui.render()
  const target = ui.dom.created[1]
  assert.equal(target.parentNode, null)
  assert.equal(ui.dom.operations.some(([operation]) => operation === 'append'), false)
  assert.equal(tree.props.children[0].container, target)
  assert.equal(tree.props.children[0].children, ui.child)
  ui.render(false)
  assert.equal(ui.dom.created.length, 2); assert.equal(target.parentNode, ui.dom.anchor)
})

test('StrictMode effect cleanup/setup replay reuses one target in connected and suspended modes', () => {
  for (const suspended of [false, true]) {
    const ui = component(suspended); ui.render()
    const target = ui.dom.created[1]
    ui.strictReplay(); ui.strictReplay(); ui.render()
    assert.equal(ui.dom.created.length, 2)
    assert.equal(ui.portals.at(-1).container, target)
    assert.equal(target.parentNode, suspended ? null : ui.dom.anchor)
  }
})

test('unmount removes only owned placement and a new component lifetime gets a separate surface', () => {
  const ui = component(); ui.render()
  const target = ui.dom.created[1], other = ui.dom.document.createElement('unrelated-anchor-child')
  ui.dom.anchor.appendChild(other)
  ui.unmount()
  assert.equal(target.parentNode, null)
  assert.deepEqual(ui.dom.anchor.children, [other], 'Cleanup never clears the anchor or another owner’s nodes')
  const next = component(); next.render()
  assert.notEqual(next.dom.created[1], target)
})

test('actual store publishes only its first target allocation and preserves it through detached setup replay', () => {
  const actual = evaluate({ React: jsx, useLayoutEffect() {}, useRef() {}, useState() {}, useSyncExternalStore() {}, createPortal() {} })
  const surface = actual.createRetainedSurface(), dom = elements()
  let publications = 0
  const unsubscribe = surface.subscribe(() => { publications++ })
  surface.place(null, false); assert.equal(surface.read(), null)
  surface.place(dom.anchor, false)
  const target = surface.read()
  surface.detach(); surface.place(dom.anchor, true); surface.place(dom.anchor, false)
  assert.equal(surface.read(), target); assert.equal(publications, 1)
  assert.equal(surface.server(), null, 'Server snapshot stays stable and DOM-free')
  unsubscribe(); surface.detach(); assert.equal(publications, 1)
})

test('generic source exposes no authority and suspends placement without conditionally removing React children', () => {
  const ast = ts.createSourceFile('surface.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.deepEqual(ast.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text), ['react', 'react-dom'])
  assert.equal(/localStorage|sessionStorage|window\.|innerHTML|textContent|replaceChildren|removeChild|HrDemoState|HrRole|interviewer|employeeId/.test(source), false)
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'RetainedPortalSurface')
  const portals = []
  const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'createPortal') portals.push(node); ts.forEachChild(node, visit) }
  visit(component)
  assert.equal(portals.length, 1)
  assert.deepEqual(portals[0].arguments.map(node => node.getText(ast)), ['children', 'target'])
  assert.match(component.getText(ast), /target \? createPortal\(children, target\) : null/)
  assert.match(component.getText(ast), /useLayoutEffect\(\(\) => \{\s*surface.place\(anchor.current, suspended\)/)
})

test('template keeps both module instances and replacement keys inside stable suspension wrappers', () => {
  const ast = ts.createSourceFile('template.tsx', template, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const surfaces = []
  const visit = node => { if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'RetainedPortalSurface') surfaces.push(node); ts.forEachChild(node, visit) }
  visit(ast)
  assert.equal(surfaces.length, 2)
  assert.deepEqual(surfaces.map(node => node.openingElement.attributes.getText(ast)), ['suspended={interviewer}', 'suspended={interviewer}'])
  assert.deepEqual(surfaces.map(node => node.children.filter(ts.isJsxSelfClosingElement).map(child => child.getText(ast))), [['<CmsDemo key={revisions.cms} />'], ['<CrmDemo key={revisions.crm} />']])
  for (const node of surfaces) assert.ok(ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(ast) === 'div', 'Existing hidden module wrapper remains mounted')
  assert.match(template, /<HrPage key=\{revisions.hr\} pathname=\{returnLocations.hr\} \/>/)
  assert.equal(/!interviewer\s*&&\s*<CmsDemo|!interviewer\s*&&\s*<CrmDemo/.test(template), false)
})
