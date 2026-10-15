import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = readFileSync(new URL('../../src/portals/registry.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { portalRegistry, portalIds, portalById, portalForPath, isDemoPortalPath, portalDirectoryHref } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const [{ resolvePortalRoute, normalizePortalPath, portalBreadcrumbs }, { hrRoutes }, { workspaceSaveSummary }] = await Promise.all([
  loadMockModel(new URL('../../src/portals/routes.ts', import.meta.url)),
  loadMockModel(new URL('../../src/hr/catalog.ts', import.meta.url)),
  loadMockModel(new URL('../../src/portals/save-summary.ts', import.meta.url)),
])
const { navigate } = await loadMockModel(new URL('../../src/lib/navigation.ts', import.meta.url))

test('app navigation honors system and saved reduced motion before scrolling newly rendered keyboard targets', () => {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  try {
    for (const [systemReduced, savedMotion, behavior] of [[true, 'system', 'instant'], [false, 'reduced', 'instant'], [false, 'system', 'smooth']]) {
      const scrolls = [], locations = [], events = []
      globalThis.window = {
        location: new URL('https://example.invalid/portals'),
        matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: systemReduced } },
        history: { pushState: (...args) => locations.push(args) },
        dispatchEvent: event => events.push(event.type),
        scrollTo: options => scrolls.push(options),
      }
      globalThis.document = {
        documentElement: { dataset: { wtlMotion: savedMotion } },
        getElementById: id => { assert.equal(id, 'review'); return null },
      }
      navigate('/hr/demo/employee/onboarding?source=keyboard#review')
      assert.deepEqual(locations, [[{}, '', '/hr/demo/employee/onboarding?source=keyboard#review']])
      assert.deepEqual(events, ['sfwa-wtl:navigation'])
      assert.deepEqual(scrolls, [{ top: 0, behavior }])
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
  }
})

test('the registry has unique stable mock identities, labels and default routes', () => {
  assert.deepEqual(portalIds, ['hr', 'cms', 'crm'])
  for (const property of ['id', 'label', 'title', 'href', 'pathRoot']) {
    assert.equal(new Set(portalRegistry.map(portal => portal[property])).size, portalRegistry.length)
  }
  assert.deepEqual(Object.keys(portalById), portalIds)
  assert.equal(portalDirectoryHref, '/portals')
  assert.equal(portalForPath(portalDirectoryHref), undefined)
})

test('every directory card and crosslink has metadata and points to its own route family', () => {
  const icons = new Set(['users', 'file-text', 'handshake'])
  for (const portal of portalRegistry) {
    assert.equal(portalById[portal.id], portal)
    assert.equal(portalForPath(portal.href), portal)
    assert.equal(isDemoPortalPath(portal.href), true)
    assert.ok(portal.href.startsWith('/') && !portal.href.startsWith('//'))
    assert.equal(portal.workspaceLabel, `${portal.label} workspace`)
    assert.ok(icons.has(portal.icon))
    for (const property of ['title', 'description', 'workflows', 'roles', 'tone']) assert.ok(portal[property].trim().length > 0)
    assert.match(portal.roles, /previews$/)
  }
})

test('HR matches the exact root and slash-delimited descendants without prefix collisions', () => {
  for (const path of ['/hr/demo', '/hr/demo/', '/hr/demo/admin', '/hr/demo/admin/payroll', '/hr/demo/employee/time']) {
    assert.equal(portalForPath(path), portalById.hr)
    assert.equal(isDemoPortalPath(path), true)
  }
  for (const path of ['/hr', '/hr/demography', '/hr/demo-other', '/hr/demo2', '/hr/demos/admin']) {
    assert.equal(portalForPath(path), undefined)
    assert.equal(isDemoPortalPath(path), false)
  }
})

test('CMS and CRM preserve exact routing rather than claiming unsupported nested pages', () => {
  for (const id of ['cms', 'crm']) {
    assert.equal(portalById[id].match, 'exact')
    assert.equal(portalForPath(`/${id}/demo`), portalById[id])
    for (const suffix of ['/', '/unknown', '-other', '2']) assert.equal(portalForPath(`/${id}/demo${suffix}`), undefined)
  }
})

test('pathname matching is case sensitive and excludes non-portal routes and query strings', () => {
  for (const path of ['', '/', '/portal', '/settings', '/HR/demo', '/cms/Demo', '/crm/demo?view=leads', 'https://example.invalid/hr/demo']) {
    assert.equal(portalForPath(path), undefined)
    assert.equal(isDemoPortalPath(path), false)
  }
})

test('the SDK is recognized only as an HR route family, with no fourth shared workspace', () => {
  assert.equal(portalForPath('/hr/demo/sdk'), portalById.hr)
  assert.equal(portalIds.includes('sdk'), false)
  assert.equal(Object.hasOwn(portalById, 'sdk'), false)
  assert.notEqual(portalById.hr.href, '/hr/demo/sdk')
})

test('entry normalization preserves supported HR deep links while ignoring location query and hash for matching', () => {
  for (const [location, expectedPath, expectedPortal] of [
    ['/portals///?source=hr#mock-data-handling', '/portals', null],
    ['/cms/demo/?collection=pages#editor', '/cms/demo', 'cms'],
    ['/crm/demo///?view=leads#pipeline', '/crm/demo', 'crm'],
    ['/hr/demo/admin/payroll/?period=mock#review', '/hr/demo/admin/payroll', 'hr'],
    ['/hr/demo/employee/onboarding/?step=summary', '/hr/demo/employee/onboarding', 'hr'],
    ['/hr/demo/admin/employees/employee-002/', '/hr/demo/admin/employees/employee-002', 'hr'],
  ]) {
    const route = resolvePortalRoute(location, hrRoutes)
    assert.equal(route.pathname, expectedPath)
    assert.equal(route.kind, expectedPortal ? 'workspace' : 'directory')
    if (expectedPortal) assert.equal(route.portal.id, expectedPortal)
  }
  const payroll = resolvePortalRoute('/hr/demo/admin/payroll/?period=mock', hrRoutes)
  assert.equal(payroll.hrRoute.path, '/admin/hr/payroll')
  assert.equal(payroll.hrPortal, 'admin')
  assert.equal(normalizePortalPath('/hr/demo/employee/time?return=/crm/demo#timer'), '/hr/demo/employee/time')
})

test('unsupported descendants are assigned only to their correct slash-delimited portal family', () => {
  for (const [path, portal] of [['/hr/demo/no-such-page', 'hr'], ['/hr/demo/admin/payroll/more/unknown', 'hr'], ['/cms/demo/content', 'cms'], ['/crm/demo/contacts', 'crm']]) {
    const route = resolvePortalRoute(path, hrRoutes)
    assert.equal(route.kind, 'unsupported')
    assert.equal(route.portal.id, portal)
    assert.equal(route.portal.href, portalById[portal].href)
    assert.equal(route.pathname, path)
  }
  for (const path of ['/hr/demo-other', '/cms/demo2', '/crm/demography', '//hr/demo/admin', '/HR/demo/admin', 'https://example.invalid/hr/demo']) assert.equal(resolvePortalRoute(path, hrRoutes).kind, 'outside')
})

test('unsafe HR route parameters do not become supported deep links', () => {
  for (const segment of ['%2Fsecret', '%2e%2e', '%', '%00', 'employee%20one']) assert.equal(resolvePortalRoute(`/hr/demo/admin/employees/${segment}`, hrRoutes).kind, 'unsupported')
})

test('HR aliases and SDK resolve without changing the requested supported pathname', () => {
  for (const path of ['/hr/demo', '/hr/demo/admin', '/hr/demo/employee', '/hr/demo/manager', '/hr/demo/contractor', '/hr/demo/sdk']) {
    const route = resolvePortalRoute(path, hrRoutes)
    assert.equal(route.kind, 'workspace')
    assert.equal(route.pathname, path)
    assert.equal(route.portal.id, 'hr')
  }
})

test('breadcrumbs link supported deep HR pages and missing CMS/CRM pages back to their directory and portal roots', () => {
  const route = resolvePortalRoute('/hr/demo/employee/onboarding', hrRoutes)
  const crumbs = portalBreadcrumbs(route)
  assert.deepEqual(crumbs.map(crumb => crumb.href), ['/portals', '/hr/demo/admin', '/hr/demo/employee', undefined])
  assert.equal(crumbs[2].label, 'Employee')
  assert.equal(crumbs.at(-1).label, route.hrRoute.title)
  assert.deepEqual(portalBreadcrumbs(resolvePortalRoute('/cms/demo/unknown', hrRoutes)), [
    { label: 'Portal directory', href: '/portals' },
    { label: 'Content management', href: '/cms/demo' },
    { label: 'Unavailable page' },
  ])
  assert.deepEqual(portalBreadcrumbs(resolvePortalRoute('/crm/demo', hrRoutes)), [{ label: 'Portal directory', href: '/portals' }, { label: 'Customer relationships' }])
  assert.deepEqual(portalBreadcrumbs(resolvePortalRoute('/outside', hrRoutes)), [])
})

test('directory save summaries retain current provider messages for every persistence outcome', () => {
  for (const [providerKind, summaryKind, label] of [
    ['ready', 'ready', 'Ready'], ['reset', 'ready', 'Ready'], ['saved', 'saved', 'Saved'],
    ['restored', 'saved', 'Saved'], ['recovered', 'recovered', 'Recovered'], ['unavailable', 'unavailable', 'Unavailable'],
  ]) {
    const message = `Distinct provider message for ${providerKind}`
    assert.deepEqual(workspaceSaveSummary({ kind: providerKind, message }), { kind: summaryKind, label, message })
  }
})
