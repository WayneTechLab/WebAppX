import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/portals/registry.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { portalRegistry, portalIds, portalById, portalForPath, isDemoPortalPath, portalDirectoryHref } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

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
