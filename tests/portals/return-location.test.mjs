import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { rememberPortalLocation, portalReturnHref, resolvePortalRoute, portalBreadcrumbs } = await loadMockModel(new URL('../../src/portals/routes.ts', import.meta.url))
const { hrRoutes } = await loadMockModel(new URL('../../src/hr/catalog.ts', import.meta.url))
const defaults = { hr: '/hr/demo/admin', cms: '/cms/demo', crm: '/crm/demo' }

test('a fresh mounted session starts at the three exact supported module roots', () => {
  assert.deepEqual(rememberPortalLocation(undefined, '/portals', hrRoutes), defaults)
  assert.deepEqual(rememberPortalLocation(null, '/outside', hrRoutes), defaults)
  for (const [id, href] of Object.entries(defaults)) assert.equal(portalReturnHref(undefined, id, hrRoutes), href)
})

test('independent session observations retain the last supported HR subsection through directory, other portals and unavailable paths', () => {
  // Each expected row is literal, independent of the resolver or implementation.
  const observations = [
    ['/hr/demo/employee/onboarding', '/hr/demo/employee/onboarding'],
    ['/portals', '/hr/demo/employee/onboarding'],
    ['/cms/demo', '/hr/demo/employee/onboarding'],
    ['/hr/demo/no-such-page', '/hr/demo/employee/onboarding'],
    ['/crm/demo', '/hr/demo/employee/onboarding'],
    ['/hr/demo/manager/time', '/hr/demo/manager/time'],
    ['/portals?source=hr#mock-data-handling', '/hr/demo/manager/time'],
    ['/hr/demo/admin/payroll/missing/extra', '/hr/demo/manager/time'],
    ['/hr/demo/admin/employees/employee-002', '/hr/demo/admin/employees/employee-002'],
    ['/portals', '/hr/demo/admin/employees/employee-002'],
    ['/hr/demo/contractor/documents', '/hr/demo/contractor/documents'],
    ['/portals', '/hr/demo/contractor/documents'],
  ]
  let memory = undefined
  for (const [location, hr] of observations) {
    const previous = memory && structuredClone(memory)
    const next = rememberPortalLocation(memory, location, hrRoutes)
    assert.deepEqual(next, { hr, cms: '/cms/demo', crm: '/crm/demo' }, location)
    if (memory) assert.deepEqual(memory, previous, 'Observing a location does not mutate an earlier session snapshot')
    memory = next
  }
})

test('all literal supported route families and canonical host additions can be remembered', () => {
  for (const path of [
    '/hr/demo', '/hr/demo/admin', '/hr/demo/employee', '/hr/demo/manager', '/hr/demo/contractor',
    '/hr/demo/admin/payroll', '/hr/demo/admin/employees/employee-003/onboarding',
    '/hr/demo/admin/contractors/contractor-001', '/hr/demo/employee/requests',
    '/hr/demo/manager/requests', '/hr/demo/admin/activity', '/hr/demo/employee/activity', '/hr/demo/manager/activity',
  ]) assert.equal(rememberPortalLocation(undefined, path, hrRoutes).hr, path, path)
  assert.equal(rememberPortalLocation(undefined, '/cms/demo', hrRoutes).cms, '/cms/demo')
  assert.equal(rememberPortalLocation(undefined, '/crm/demo', hrRoutes).crm, '/crm/demo')
})

test('trailing slash and location suffixes normalize to the supported pathname without becoming preferences', () => {
  for (const [location, id, expected] of [
    ['/hr/demo/employee/onboarding///?return=/crm/demo#review', 'hr', '/hr/demo/employee/onboarding'],
    ['/hr/demo/admin/employees/employee-002/?view=profile', 'hr', '/hr/demo/admin/employees/employee-002'],
    ['/cms/demo///?collection=articles#editor', 'cms', '/cms/demo'],
    ['/crm/demo/?view=leads#pipeline', 'crm', '/crm/demo'],
  ]) {
    const memory = rememberPortalLocation(undefined, location, hrRoutes)
    assert.equal(memory[id], expected)
    assert.equal(portalReturnHref({ [id]: location }, id, hrRoutes), expected)
  }
})

test('unsupported, external, protected and malformed locations cannot replace a supported return destination', () => {
  const previous = Object.freeze({ ...defaults, hr: '/hr/demo/employee/onboarding' })
  for (const location of [
    '/hr/demo/not-real', '/hr/demo/admin/payroll/unexpected/extra', '/hr/demo/sdk/unexpected',
    '/cms/demo/content', '/crm/demo/contacts', '/hr/demo//admin',
    '/hr/demo-other', '/cms/demo2', '/crm/demography', '/HR/demo/admin',
    '/admin/hr/payroll', '/employee/onboarding', '/manager/hr/time', '/contractor/documents',
    '//hr/demo/admin', 'https://example.invalid/hr/demo/admin', 'javascript:alert(1)',
    '', '/', '/portals', null, undefined, 0, ['hr'], { toString() { throw new Error('Do not coerce routes') } },
  ]) assert.deepEqual(rememberPortalLocation(previous, location, hrRoutes), previous)
})

test('unsafe or prototype-critical HR parameters remain unsupported and never become return links', () => {
  const previous = { ...defaults, hr: '/hr/demo/employee/time' }
  for (const value of ['%2Fsecret', '%2e%2e', '%', '%00', 'employee%20one', '__proto__', 'prototype', 'constructor', 'Constructor', '%5f%5fproto%5f%5f', '%63onstructor']) {
    const location = `/hr/demo/admin/employees/${value}`
    assert.equal(resolvePortalRoute(location, hrRoutes).kind, 'unsupported', location)
    assert.deepEqual(rememberPortalLocation(previous, location, hrRoutes), previous)
    assert.equal(portalReturnHref({ hr: location }, 'hr', hrRoutes), defaults.hr)
  }
  assert.equal({}.polluted, undefined)
})

test('each stored destination is revalidated for its own portal, including inherited and unknown map keys', () => {
  for (const memory of [
    { hr: '/crm/demo', cms: '/hr/demo/admin/payroll', crm: '/cms/demo' },
    { hr: '/hr/demo/no-such-page', cms: '//evil.invalid', crm: 'https://example.invalid/crm/demo' },
    { hr: {}, cms: ['cms'], crm: 5 },
    Object.create({ hr: '/hr/demo/employee/onboarding', cms: '/cms/demo', crm: '/crm/demo' }),
    JSON.parse('{"__proto__":{"polluted":true},"constructor":"/hr/demo/admin/payroll","prototype":"/cms/demo"}'),
  ]) {
    assert.deepEqual(rememberPortalLocation(memory, '/portals', hrRoutes), defaults)
    for (const [id, expected] of Object.entries(defaults)) assert.equal(portalReturnHref(memory, id, hrRoutes), expected)
  }
  assert.throws(() => portalReturnHref({}, '__proto__', hrRoutes), /Unknown portal identity/)
  assert.throws(() => portalReturnHref({}, 'constructor', hrRoutes), /Unknown portal identity/)
  assert.equal({}.polluted, undefined)
})

test('directory or CMS/CRM navigation preserves the exact SDK destination without creating a fourth shared module', () => {
  const sdk = rememberPortalLocation(undefined, '/hr/demo/sdk', hrRoutes)
  assert.deepEqual(sdk, { hr: '/hr/demo/sdk', cms: '/cms/demo', crm: '/crm/demo' })
  assert.deepEqual(rememberPortalLocation(sdk, '/portals', hrRoutes), sdk)
  assert.deepEqual(rememberPortalLocation(sdk, '/cms/demo', hrRoutes), sdk)
  assert.deepEqual(rememberPortalLocation(sdk, '/hr/demo/sdk/not-supported', hrRoutes), sdk)
  assert.deepEqual(Object.keys(sdk), ['hr', 'cms', 'crm'])
  assert.equal(rememberPortalLocation(sdk, '/hr/demo/employee/time', hrRoutes).hr, '/hr/demo/employee/time')
})

test('new component navigation memory is independent of earlier sessions and workspace restore revisions', () => {
  const first = rememberPortalLocation(undefined, '/hr/demo/manager/time', hrRoutes)
  assert.deepEqual(rememberPortalLocation(undefined, '/portals', hrRoutes), defaults)
  assert.deepEqual(rememberPortalLocation(first, '/portals', hrRoutes), { ...defaults, hr: '/hr/demo/manager/time' })
  // A restore revision belongs to the provider and is not an input to this
  // pathname-only session memory; revisiting the directory retains the location.
  assert.equal(Object.hasOwn(first, 'revisions'), false)
  assert.deepEqual(portalBreadcrumbs(resolvePortalRoute('/hr/demo/employee/onboarding', hrRoutes)).map(item => item.href), ['/portals', '/hr/demo/admin', '/hr/demo/employee', undefined])
})
