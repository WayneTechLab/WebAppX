import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMockModel } from '../browser/model-loader.mjs'

const providerSource = await readFile(new URL('../../src/hr/RecruitingPreviewProvider.tsx', import.meta.url), 'utf8')
const layoutSource = await readFile(new URL('../../src/components/layout/Layout.tsx', import.meta.url), 'utf8')
const routerSource = await readFile(new URL('../../src/router.tsx', import.meta.url), 'utf8')
const chromeSource = await readFile(new URL('../../src/portals/ScopedPortalChrome.tsx', import.meta.url), 'utf8')
const { createUnsavedWorkController } = await loadMockModel(new URL('../../src/portals/unsaved-work-core.ts', import.meta.url))
const recruitingPath = '/hr/demo/admin/recruiting'
const jsx = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')

/** Actual provider closures with synchronous hook slots and the real dirty
 * decision controller. These are component/state contracts, not DOM proof. */
function shell(initialPath = recruitingPath) {
  const slots = [], requests = [], renders = [], controller = createUnsavedWorkController()
  let cursor = 0, changed = false, rendering = false, pathname = initialPath, tree, context, layoutEffects = []
  const request = (options, commit) => { requests.push(options); return controller.request(options, commit) }
  const dependencies = {
    React: jsx,
    createContext(value) { context = { value, Provider: 'RecruitingPreviewContext' }; return context },
    useContext: () => context.value,
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; if (rendering) changed = true }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useLayoutEffect(effect) { layoutEffects.push(effect) },
    useCallback: callback => callback,
    useUnsavedTransition: () => request,
    ScopedPortalChromeProvider: 'ScopedPortalChromeProvider',
  }
  const actual = new Function(...Object.keys(dependencies), `${compile(providerSource)}\nreturn {RecruitingPreviewProvider,useRecruitingPreview}`)(...Object.values(dependencies))
  function render(nextPath = pathname) {
    pathname = nextPath
    let attempts = 0
    do {
      assert.ok(++attempts < 5, 'render-phase path adjustment must settle')
      cursor = 0; changed = false; rendering = true; layoutEffects = []
      tree = actual.RecruitingPreviewProvider({ pathname, children: 'retained route content' })
      rendering = false
      context.value = tree.props.value
      const chrome = tree.props.children[0]
      assert.equal(chrome.type, 'ScopedPortalChromeProvider')
      assert.deepEqual(Object.keys(chrome.props), ['active', 'children'])
      assert.equal(chrome.props.active, context.value.interviewerEmployeeId !== null)
      assert.deepEqual(chrome.props.children, ['retained route content'])
      renders.push({ pathname, interviewerEmployeeId: context.value.interviewerEmployeeId, generation: context.value.generation })
    } while (changed)
    for (const effect of layoutEffects) effect()
    return actual.useRecruitingPreview()
  }
  return { render, controller, requests, renders, beforeProvider: () => actual.useRecruitingPreview(), value: () => context.value }
}
function participant(controller, { portal = 'hr', id = 'literal-hr-draft' } = {}) {
  let dirty = true, discarded = 0, focused = 0
  controller.register(() => ({ id, portal, label: `Draft ${id}`, isDirty: () => dirty, discard: () => { dirty = false; discarded++ }, focus: () => { focused++ } }))
  return { get dirty() { return dirty }, get discarded() { return discarded }, get focused() { return focused }, change() { dirty = true } }
}
function resolve(controller, decision) {
  const pending = controller.getSnapshot()
  assert.ok(pending)
  assert.equal(controller.resolve(pending.id, decision), true)
  return pending
}

test('fresh mode and optional-provider fallback cannot acquire interviewer authority from a route or supplied props', () => {
  const shared = new Function('React', 'createContext', 'useContext', `${compile(chromeSource)}\nreturn {ScopedPortalChromeProvider,useScopedPortalChrome}`)(React, React.createContext, React.useContext)
  const Flag = () => React.createElement('output', null, String(shared.useScopedPortalChrome()))
  assert.equal(renderToStaticMarkup(React.createElement(Flag)), '<output>false</output>', 'An adopted layout without the HR provider defaults to ordinary chrome')
  for (const active of [true, false]) assert.equal(renderToStaticMarkup(React.createElement(shared.ScopedPortalChromeProvider, { active }, React.createElement(Flag))), `<output>${active}</output>`)
  const ui = shell()
  const fallback = ui.beforeProvider()
  assert.equal(fallback.interviewerEmployeeId, null); assert.equal(fallback.generation, 0)
  assert.equal(fallback.enter('employee-001'), false); assert.equal(fallback.leave(), false)
  assert.equal(Object.isFrozen(fallback), true)
  assert.equal(ui.render().interviewerEmployeeId, null)
  assert.equal(ui.render().generation, 0)
  assert.deepEqual(ui.requests, [])
})

test('clean enter, identity change and leave increment only actual accepted mode changes, synchronously', () => {
  const ui = shell(), api = ui.render()
  assert.equal(api.enter('employee-001'), true)
  // No render between events: the second callback must read the accepted ref.
  assert.equal(api.enter('employee-001'), true)
  assert.equal(api.enter('employee-002'), true)
  assert.equal(ui.render().interviewerEmployeeId, 'employee-002')
  assert.equal(ui.value().generation, 2)
  assert.equal(api.leave(), true); assert.equal(api.leave(), true)
  assert.equal(ui.render().interviewerEmployeeId, null); assert.equal(ui.value().generation, 3)
  assert.deepEqual(ui.requests, [
    { portal: 'hr', label: 'Enter interviewer preview' },
    { portal: 'hr', label: 'Change interviewer preview' },
    { portal: 'hr', label: 'Leave interviewer preview' },
  ])
})

test('enter, switch and leave use real scoped dirty decisions; Keep retains mode and discard affects HR only', () => {
  const ui = shell(), hr = participant(ui.controller), cms = participant(ui.controller, { portal: 'cms', id: 'cms-independent' })
  let api = ui.render()
  assert.equal(api.enter('employee-001'), false)
  assert.equal(ui.render().interviewerEmployeeId, null); assert.equal(ui.value().generation, 0)
  assert.deepEqual(ui.controller.getSnapshot().participants, [{ id: 'literal-hr-draft', portal: 'hr', label: 'Draft literal-hr-draft' }])
  assert.equal(ui.controller.getSnapshot().canRetain, false)
  resolve(ui.controller, 'keep-editing'); ui.controller.takeFocus()?.()
  assert.equal(hr.focused, 1); assert.equal(hr.dirty, true); assert.equal(ui.render().generation, 0)
  assert.equal(api.enter('employee-001'), false); resolve(ui.controller, 'discard')
  api = ui.render(); assert.equal(api.interviewerEmployeeId, 'employee-001'); assert.equal(api.generation, 1)
  assert.equal(hr.discarded, 1); assert.equal(cms.discarded, 0); assert.equal(cms.dirty, true)
  hr.change(); assert.equal(api.enter('employee-002'), false)
  resolve(ui.controller, 'keep-editing'); api = ui.render()
  assert.equal(api.interviewerEmployeeId, 'employee-001'); assert.equal(api.generation, 1)
  assert.equal(api.enter('employee-002'), false); resolve(ui.controller, 'discard'); api = ui.render()
  assert.equal(api.interviewerEmployeeId, 'employee-002'); assert.equal(api.generation, 2)
  hr.change(); assert.equal(api.leave(), false); resolve(ui.controller, 'keep-editing'); api = ui.render()
  assert.equal(api.interviewerEmployeeId, 'employee-002'); assert.equal(api.generation, 2)
  assert.equal(api.leave(), false); resolve(ui.controller, 'discard'); api = ui.render()
  assert.equal(api.interviewerEmployeeId, null); assert.equal(api.generation, 3)
  assert.equal(hr.discarded, 3); assert.equal(cms.discarded, 0)
})

test('failed dirty discard refuses the mode change and retains its generation and inputs', () => {
  const ui = shell()
  ui.controller.register(() => ({ id: 'refusing-draft', portal: 'hr', label: 'Refusing literal draft', isDirty: () => true, discard() { throw new Error('cannot discard') } }))
  const api = ui.render(); assert.equal(api.enter('employee-001'), false)
  const pending = ui.controller.getSnapshot()
  assert.equal(ui.controller.resolve(pending.id, 'discard'), false)
  assert.match(ui.controller.getSnapshot().error, /could not discard/)
  assert.equal(ui.render().interviewerEmployeeId, null); assert.equal(ui.value().generation, 0)
})

test('committed departure clears active identity before child composition and later Back never restores it', () => {
  const ui = shell(); const api = ui.render(); api.enter('employee-001'); ui.render()
  const outside = ui.render('/portals')
  assert.equal(outside.interviewerEmployeeId, null); assert.equal(outside.generation, 2)
  assert.equal(ui.renders.filter(row => row.pathname === '/portals').every(row => row.interviewerEmployeeId === null), true, 'Even the adjustment render exposes native composition')
  assert.equal(api.enter('employee-002'), false); assert.equal(api.leave(), false)
  const returned = ui.render(recruitingPath)
  assert.equal(returned.interviewerEmployeeId, null); assert.equal(returned.generation, 2)
  assert.equal(returned.enter('employee-002'), true)
  assert.equal(ui.render().generation, 3)
})

test('a queued leave cannot clear a newly entered identity after route departure and return', () => {
  const ui = shell(); let api = ui.render(); api.enter('employee-001'); api = ui.render()
  participant(ui.controller); assert.equal(api.leave(), false)
  ui.render('/portals'); ui.render(recruitingPath)
  resolve(ui.controller, 'discard'); api = ui.render()
  assert.equal(api.interviewerEmployeeId, null); assert.equal(api.generation, 2)
  assert.equal(api.enter('employee-002'), true)
  assert.equal(ui.render().interviewerEmployeeId, 'employee-002'); assert.equal(ui.value().generation, 3)
})

test('a queued enter or identity switch cannot revive after departure and Back, even at the same old generation', () => {
  for (const active of [false, true]) {
    const ui = shell(); let api = ui.render()
    if (active) { api.enter('employee-001'); api = ui.render() }
    participant(ui.controller)
    assert.equal(api.enter('employee-002'), false)
    ui.render('/about'); ui.render(recruitingPath)
    resolve(ui.controller, 'discard')
    const returned = ui.render()
    assert.equal(returned.interviewerEmployeeId, null)
    assert.equal(returned.generation, active ? 2 : 0)
    assert.equal(returned.enter('employee-002'), true)
    assert.equal(ui.render().interviewerEmployeeId, 'employee-002')
  }
})

test('mode cannot enter at URL descendants, aliases, other native pages, or malformed identity boundaries', () => {
  for (const pathname of ['/hr/demo', '/hr/demo/admin', '/hr/demo/admin/recruiting/other', '/admin/hr/recruiting', '/hr/demo/sdk', '/portals', '/hr/demo/admin/recruiting?interviewer=employee-001']) {
    const ui = shell(pathname), api = ui.render()
    assert.equal(api.enter('employee-001'), false, pathname)
    assert.equal(api.interviewerEmployeeId, null); assert.equal(api.generation, 0); assert.equal(ui.requests.length, 0)
  }
  const ui = shell(), api = ui.render()
  for (const id of ['', ' employee-001', 'employee-001 ', 'x'.repeat(201), null, undefined, {}]) assert.equal(api.enter(id), false)
  assert.equal(ui.requests.length, 0)
})

const layoutDependencies = {
  React: jsx, Navbar: 'Navbar', Footer: 'Footer', FirebaseSetupNotice: 'FirebaseSetupNotice', PageSnapMenu: 'PageSnapMenu', HelpDeskChat: 'HelpDeskChat', AccessibilityPageControl: 'AccessibilityPageControl', AppLink: 'AppLink',
  siteControls: { pageSnap: true, helpDesk: 'help', accessibility: true, showPageTravel: true },
}
function layout(active) {
  return new Function(...Object.keys(layoutDependencies), 'useScopedPortalChrome', `${compile(layoutSource.replaceAll('import.meta.env.DEV', 'false'))}\nreturn Layout`)(...Object.values(layoutDependencies), () => active)({ currentPath: recruitingPath, children: 'literal scoped content' })
}
function nodes(tree) {
  const found = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    found.push(value); visit(value.props?.children)
  }
  visit(tree); return found
}

test('active layout unmounts all global management chrome while preserving neutral exit, content and accessibility', () => {
  const tree = layout(true), rendered = nodes(tree)
  for (const type of ['Navbar', 'Footer', 'FirebaseSetupNotice', 'PageSnapMenu', 'HelpDeskChat']) assert.equal(rendered.some(node => node.type === type), false, `${type} is unmounted, not hidden`)
  const exits = rendered.filter(node => node.type === 'AppLink')
  assert.equal(exits.length, 1); assert.equal(exits[0].props.to, '/portals')
  assert.deepEqual(exits[0].props.children, ['Portal directory'])
  const main = rendered.filter(node => node.type === 'main')
  assert.equal(main.length, 1); assert.equal(main[0].props.id, 'content'); assert.equal(main[0].props.tabIndex, -1)
  assert.deepEqual(main[0].props.children, ['literal scoped content'])
  assert.ok(rendered.some(node => node.type === 'a' && node.props.href === '#content'))
  assert.equal(rendered.filter(node => node.type === 'AccessibilityPageControl').length, 1)
  assert.equal(rendered.some(node => node.props.hidden || node.props['aria-hidden']), false)
  assert.equal(JSON.stringify(tree).includes('employee-001'), false, 'Outer chrome receives no identity text or HR records')
})

test('native layout retains existing component order, props and the same content position', () => {
  const tree = layout(false), rendered = nodes(tree)
  assert.deepEqual(tree.props.children.map(node => node.type), ['Navbar', 'FirebaseSetupNotice', 'main', 'Footer', 'PageSnapMenu', 'HelpDeskChat', 'AccessibilityPageControl'])
  assert.equal(rendered.find(node => node.type === 'Navbar').props.key, `navbar:${recruitingPath}`)
  assert.equal(rendered.find(node => node.type === 'Navbar').props.currentPath, recruitingPath)
  assert.equal(rendered.find(node => node.type === 'PageSnapMenu').props.pathname, recruitingPath)
  assert.equal(rendered.find(node => node.type === 'HelpDeskChat').props.mode, 'help')
  assert.equal(rendered.find(node => node.type === 'AccessibilityPageControl').props.showPageTravel, true)
  assert.equal(tree.props.children[2].type, layout(true).props.children[2].type, 'Stable main position retains routed content across mode changes')
})

test('source composition keeps provider unkeyed beneath UnsavedWorkProvider and imports no HR state or persistence', () => {
  const providerAst = ts.createSourceFile('provider.tsx', providerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = providerAst.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
  assert.deepEqual(imports, ['react', '@/portals/unsaved-work', '@/portals/ScopedPortalChrome'])
  assert.equal(/window|localStorage|sessionStorage|URLSearchParams|HrDemoState|HrFixture|HrRole|fetch\(/.test(providerSource), false)
  const chromeAst = ts.createSourceFile('chrome.tsx', chromeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.deepEqual(chromeAst.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text), ['react'])
  assert.match(chromeSource, /active: boolean; children: ReactNode/)
  assert.equal(/window|localStorage|sessionStorage|pathname|employeeId|Recruiting|HrDemoState|HrRole|fetch\(/.test(chromeSource), false)
  const layoutAst = ts.createSourceFile('layout.tsx', layoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const layoutImports = layoutAst.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
  assert.equal(layoutImports.some(path => /(?:^|\/)hr(?:\/|$)/.test(path)), false, 'Shared Layout cannot import the optional HR runtime')
  assert.ok(layoutImports.includes('@/portals/ScopedPortalChrome'))
  const routerAst = ts.createSourceFile('router.tsx', routerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const routed = routerAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'RoutedContent')
  const opening = []
  const visit = node => { if (ts.isJsxOpeningElement(node)) opening.push(node); ts.forEachChild(node, visit) }
  visit(routed)
  assert.deepEqual(opening.map(node => node.tagName.getText(routerAst)), ['RecruitingPreviewProvider', 'Layout'])
  const providerAttributes = opening[0].attributes.properties.map(node => node.name?.getText(routerAst))
  assert.deepEqual(providerAttributes, ['pathname'], 'No path key may remount retained portal forms')
  const app = routerAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AppRouter')
  assert.match(app.getText(routerAst), /<UnsavedWorkProvider><RoutedContent\s*\/><\/UnsavedWorkProvider>/)
})
