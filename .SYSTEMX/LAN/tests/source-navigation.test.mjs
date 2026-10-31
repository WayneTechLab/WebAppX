import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalSourcePath, sourceNavigationKey, createSourceNavigation, parseSourceNavigation, publicSourceMetadata, parseSourceInventory, filterSourceMetadata, sourcePickerSelection, sourceNavigationLimits } from '../Website/source-navigation.js'

const workspaceId = 'a'.repeat(64)
function metadata(path = 'src/pages/Home.tsx', overrides = {}) {
  return { path, sizeBytes: 48, extension: '.tsx', origin: 'authored', writable: true, readable: true, writeKinds: ['source-text', 'literal-text'], ruleId: 'source-pages', tags: ['source-pages', 'authored', 'tsx'], reasonCode: null, ...overrides }
}
function inventory(overrides = {}) {
  return { schemaVersion: 1, workspaceId, policyRevision: 'source-access-v1', files: [metadata(), metadata('src/index.css', { extension: '.css', ruleId: 'source-styles', tags: ['source-styles', 'authored', 'css'], writeKinds: ['source-text', 'font-imports'] })], limits: { maxBytes: 1000000, maxTextUnits: 500000, maxDepth: 4, maxEntries: 4000, maxResults: 500, maxHeaderBytes: 4096 }, counts: { examinedEntries: 2, eligibleFiles: 2, matchingFiles: 2, returnedFiles: 2 }, omissions: { resultLimit: 0, entryBudget: 0, depthBudget: 0, linked: 0, unavailable: 0, nonRegular: 0, policyRefused: 0 }, complete: true, truncated: false, ...overrides }
}

// Path validation runs before a content GET. No normalization may silently turn
// a refused path into another editable target on a case-insensitive filesystem.
test('canonical picker paths reject aliases, private directories and unsupported extensions before a request', () => {
  for (const path of ['src/pages/Home.tsx', 'src/pages/A.1-page.tsx', 'src/components/layout/Header.tsx', 'src/components/navigation/Nav.tsx', 'src/components/shell/Shell.tsx', 'src/config/siteControls.ts', 'src/index.css', 'src/router.tsx']) assert.equal(canonicalSourcePath(path), true, path)
  for (const path of ['', null, '/src/pages/Home.tsx', 'C:/src/pages/Home.tsx', './src/pages/Home.tsx', 'src//pages/Home.tsx', 'src/pages/../Home.tsx', 'src/./pages/Home.tsx', 'src\\pages\\Home.tsx', 'src/pages/%48ome.tsx', 'src/pages/Home.tsx\n', 'src/pages/Home.tsx\0', 'src/pages/Home.tsx?token=x', '.SYSTEMX/LAN/Temp/operations.jsonl', 'src/pages/.private.tsx', 'src/pages/nested/Page.tsx', 'src/pages/Home.jsx', 'Src/pages/Home.tsx']) assert.equal(canonicalSourcePath(path), false, String(path))
})

test('source navigation has a finite metadata-only shape and strict workspace binding', () => {
  const nav = createSourceNavigation({ workspaceId, path: 'src/pages/Home.tsx', extension: '.tsx', search: 'Home' })
  assert.deepEqual(Object.keys(nav), ['schemaVersion', 'workspaceId', 'path', 'extension', 'search'])
  assert.deepEqual(parseSourceNavigation(JSON.stringify(nav), workspaceId), nav)
  assert.notEqual(sourceNavigationKey(workspaceId), sourceNavigationKey('b'.repeat(64)))
  for (const bad of [{ ...nav, draft: 'never store me' }, { ...nav, revision: 'b'.repeat(64) }, { ...nav, token: 'private' }, { ...nav, workspaceId: 'b'.repeat(64) }, { ...nav, schemaVersion: 2 }]) assert.throws(() => parseSourceNavigation(JSON.stringify(bad), workspaceId), /SOURCE_NAVIGATION_INVALID/)
  assert.throws(() => sourceNavigationKey(workspaceId + '\n'))
  assert.throws(() => parseSourceNavigation('[]', workspaceId))
  assert.throws(() => parseSourceNavigation('x'.repeat(sourceNavigationLimits.serialized + 1), workspaceId))
})

test('sensitive or malformed filter values cannot enter remembered navigation', () => {
  for (const overrides of [{ path: '../.env' }, { extension: '.env' }, { search: 'token = fake' }, { search: 'sk_live_fake' }, { search: 'a\nb' }, { search: '\ud800' }, { search: 'x'.repeat(121) }, { workspaceId: 'not-a-workspace' }]) assert.throws(() => createSourceNavigation({ workspaceId, ...overrides }))
  assert.deepEqual(createSourceNavigation({ workspaceId }), { schemaVersion: 1, workspaceId, path: '', extension: '', search: '' })
})

test('inventory projection drops source bodies, private root and runtime fields at every level', () => {
  const value = inventory({ root: '/private/repository', sessionToken: 'not-exportable', content: 'private body' })
  value.files[0] = { ...value.files[0], content: 'body not indexed', root: '/private/a', backup: '.SYSTEMX/LAN/Backup/private' }
  value.counts.privatePath = 1
  value.omissions.privatePath = 9
  const parsed = parseSourceInventory(value, workspaceId)
  const exported = JSON.stringify(parsed)
  for (const forbidden of ['private body', '/private/', 'sessionToken', 'content', 'backup', 'privatePath', 'body not indexed']) assert.equal(exported.includes(forbidden), false, forbidden)
  assert.deepEqual(parsed.counts, { examinedEntries: 2, eligibleFiles: 2, matchingFiles: 2, returnedFiles: 2 })
  assert.equal(parsed.omissions.unavailable, 0)
})

test('inventory refuses foreign checkout, duplicate paths and malformed public metadata before replacing a picker', () => {
  assert.throws(() => parseSourceInventory(inventory(), 'b'.repeat(64)))
  assert.throws(() => parseSourceInventory(inventory({ files: [metadata(), metadata()] }), workspaceId))
  assert.throws(() => parseSourceInventory(inventory({ files: Array.from({ length: 501 }, () => metadata()) }), workspaceId))
  for (const overrides of [{ path: '.SYSTEMX/LAN/Backup/Home.tsx' }, { sizeBytes: -1 }, { extension: '.env' }, { origin: 'generated', writable: true }, { ruleId: 'source-pages\n' }, { tags: ['private path'] }, { writeKinds: ['save?force'] }, { reasonCode: 'SOURCE_TOO_LARGE\n' }]) assert.throws(() => publicSourceMetadata(metadata(undefined, overrides)))
  assert.throws(() => parseSourceInventory(inventory({ complete: true, truncated: true }), workspaceId))
  assert.throws(() => parseSourceInventory(inventory({ limits: {} }), workspaceId))
})

test('generated and oversized metadata retain explicit read/write decisions without source text', () => {
  const generated = metadata('src/pages/Route.generated.tsx', { origin: 'generated', writable: false, writeKinds: [], reasonCode: 'SOURCE_GENERATED_READ_ONLY' })
  const oversized = metadata('src/pages/Large.tsx', { sizeBytes: 1000001, readable: false, writable: false, writeKinds: [], reasonCode: 'SOURCE_TOO_LARGE' })
  const parsed = parseSourceInventory(inventory({ files: [generated, oversized] }), workspaceId)
  assert.equal(parsed.files[0].readable, true)
  assert.equal(parsed.files[0].writable, false)
  assert.equal(parsed.files[1].readable, false)
  assert.equal(parsed.files[1].sizeBytes, 1000001)
  assert.equal(Object.hasOwn(parsed.files[1], 'content'), false)
})

test('metadata filters search only eligible path and declared tags and never arbitrary file body fields', () => {
  const files = inventory().files
  files[0].content = 'undisclosed body canary'
  assert.deepEqual(filterSourceMetadata(files, { extension: '.css' }).map(file => file.path), ['src/index.css'])
  assert.deepEqual(filterSourceMetadata(files, { search: 'SOURCE-PAGES' }).map(file => file.path), ['src/pages/Home.tsx'])
  assert.equal(filterSourceMetadata(files, { search: 'body canary' }).length, 0)
  assert.equal(filterSourceMetadata(files, { extension: '.css', search: 'Home' }).length, 0)
  assert.throws(() => filterSourceMetadata(files, { extension: '.env' }))
  assert.throws(() => filterSourceMetadata(files, { search: 'x'.repeat(121) }))
})

test('filter omissions keep a selected file without switching the draft or activating another row', () => {
  const inv = inventory()
  const selected = 'src/pages/Home.tsx'
  const filtered = filterSourceMetadata(inv.files, { extension: '.css' })
  assert.deepEqual(sourcePickerSelection(selected, selected, inv, filtered), { path: selected, retained: true, absent: false })
  assert.deepEqual(sourcePickerSelection('', selected, inv, inv.files), { path: '', retained: false, absent: false })
})

test('complete fresh inventory absence clears only picker selection, while partial or errored scans preserve it', () => {
  const selected = 'src/pages/Removed.tsx'
  const inv = inventory()
  assert.deepEqual(sourcePickerSelection(selected, selected, inv, inv.files), { path: '', retained: false, absent: true })
  for (const partial of [inventory({ complete: false, truncated: true }), inventory({ omissions: { ...inv.omissions, unavailable: 1 } })]) assert.deepEqual(sourcePickerSelection(selected, selected, partial, partial.files), { path: selected, retained: true, absent: false })
})


test('an unavailable scan remains useful partial metadata without asserting complete absence', () => {
  const inv = inventory({ complete: false, truncated: false, omissions: { ...inventory().omissions, unavailable: 1 } })
  const parsed = parseSourceInventory(inv, workspaceId)
  assert.equal(parsed.complete, false)
  assert.equal(parsed.truncated, false)
  assert.equal(parsed.files.length, 2)
  assert.deepEqual(sourcePickerSelection('src/pages/Missing.tsx', 'src/pages/Missing.tsx', parsed, parsed.files), { path: 'src/pages/Missing.tsx', retained: true, absent: false })
  assert.throws(() => parseSourceInventory({ ...inv, complete: true }, workspaceId))
})
