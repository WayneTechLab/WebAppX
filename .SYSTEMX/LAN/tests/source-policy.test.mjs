import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { compareSourcePolicies, enumerateSourceInventory, inspectSourcePath, isCanonicalSourcePath, sourcePolicyCatalog, sourcePolicyLimits } from '../Builder/source-policy.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-source-policy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, body = 'export default () => <h1>Test</h1>\n') => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body) }
  put('src/pages/HomePage.tsx')
  put('src/components/layout/Header.tsx')
  put('src/components/navigation/Menu.tsx')
  put('src/components/shell/Shell.tsx')
  put('src/config/siteControls.ts', 'export const title = "Test"\n')
  put('src/index.css', 'body { color: red; }\n')
  put('src/router.tsx')
  return { root, put }
}
function assertFailure(result, code, status = 400) {
  assert.equal(result.statusCode, status)
  assert.equal(result.code, code)
  assert.deepEqual(Object.keys(result).sort(), ['code', 'error', 'statusCode'])
  assert.ok(result.error.length > 10)
  assert.doesNotMatch(result.error, /private-marker|external-marker|HomePage|\/Users\/|[A-Z]:\\/)
}

test('policy catalog uses fixed reviewed rules and a nonactive subset, with no mutable shared DTO', () => {
  const first = sourcePolicyCatalog()
  assert.equal(first.activeRevision, 'source-access-v1')
  assert.equal(first.rules.length, 7)
  assert.equal(first.structuralEdits, false)
  assert.deepEqual(first.reviewedPolicies[1].ruleIds, ['source-pages'])
  first.rules[0].id = 'mutated'
  first.limits.maxBytes = 1
  assert.equal(sourcePolicyCatalog().rules[0].id, 'source-pages')
  assert.equal(sourcePolicyLimits.maxBytes, 1_000_000)
  assert.equal(sourcePolicyCatalog().limits.maxBytes, 1_000_000)
})

test('canonical repository paths reject aliases before any file read', t => {
  const { root } = fixture(t)
  for (const value of [undefined, null, 1, '', '/src/pages/HomePage.tsx', 'C:/src/pages/HomePage.tsx', './src/pages/HomePage.tsx', 'src/../src/pages/HomePage.tsx', 'src//pages/HomePage.tsx', 'src\\pages\\HomePage.tsx', 'src/pages/HomePage%2etsx', 'src/pages/HomePage.tsx\0', 'src/pages/HomePage.tsx\n', ' src/pages/HomePage.tsx', 'src/pages/./HomePage.tsx', 'src/pages/.hidden.tsx', 'a'.repeat(513)]) {
    assert.equal(isCanonicalSourcePath(value), false)
    assertFailure(inspectSourcePath(root, value, { read: true }), 'SOURCE_PATH_INVALID')
  }
  assert.equal(isCanonicalSourcePath('src/pages/HomePage.tsx'), true)
  assert.equal(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }).sourcePath.normalized, 'src/pages/HomePage.tsx')
})

test('source policy refuses neighboring private/runtime/generated-output targets without disclosing them', t => {
  const { root, put } = fixture(t)
  for (const path of ['package.json', 'src/pages/nested/Page.tsx', 'src/pages/private-marker.json', 'src/secrets.ts', 'dist/index.html', '.SYSTEMX/LAN/Temp/operations.jsonl', '.SYSTEMX/LAN/Backup/src/pages/HomePage.tsx', '.SYSTEMX/state/local-session.json']) {
    put(path, 'private-marker secret content')
    assertFailure(inspectSourcePath(root, path, { read: true }), path.startsWith('.') ? 'SOURCE_PATH_INVALID' : 'SOURCE_POLICY_REFUSED')
  }
  const payload = JSON.stringify(enumerateSourceInventory(root, { workspaceId: 'workspace-a' }))
  assert.doesNotMatch(payload, /private-marker|operations\.jsonl|local-session|\/Backup\/|secret content|index\.html/)
})

test('eligible inventory reports only regular allowed paths and metadata, sorted with provenance', t => {
  const { root, put } = fixture(t)
  put('src/pages/ZPage.tsx')
  put('src/pages/Ignored.js', 'body-marker')
  const result = enumerateSourceInventory(root, { workspaceId: 'workspace-a' })
  assert.equal(result.complete, true)
  assert.equal(result.truncated, false)
  assert.equal(result.workspaceId, 'workspace-a')
  assert.equal(result.files.length, 8)
  assert.deepEqual(result.files.map(file => file.path), result.files.map(file => file.path).sort())
  const page = result.files.find(file => file.path === 'src/pages/HomePage.tsx')
  assert.equal(page.ruleId, 'source-pages')
  assert.equal(page.origin, 'authored')
  assert.equal(page.sizeBytes, readFileSync(join(root, page.path)).length)
  assert.deepEqual(page.writeKinds, ['source-text', 'literal-text'])
  assert.equal(page.writable, true)
  assert.deepEqual(result.extensions, ['.tsx', '.ts', '.css'])
  assert.doesNotMatch(JSON.stringify(result), /body-marker|Ignored|export default|"content"|"target"/)
})

test('extension and filename/tag searches cannot expand eligibility or search source bodies', t => {
  const { root, put } = fixture(t)
  put('src/pages/NamedPage.tsx', 'export const privateBodyNeedle = true\n')
  let result = enumerateSourceInventory(root, { extension: '.css', search: 'authored' })
  assert.deepEqual(result.files.map(file => file.path), ['src/index.css'])
  result = enumerateSourceInventory(root, { search: 'namedpage' })
  assert.deepEqual(result.files.map(file => file.path), ['src/pages/NamedPage.tsx'])
  assert.equal(enumerateSourceInventory(root, { search: 'privateBodyNeedle' }).files.length, 0)
  for (const options of [{ extension: '.json' }, { extension: '.TSX' }, { search: 'x'.repeat(121) }, { search: 'line\n' }, { limit: 0 }, { limit: 501 }, { limit: '20' }, { limit: 2.5 }]) assertFailure(enumerateSourceInventory(root, options), 'SOURCE_QUERY_INVALID')
})

test('symlink files and all linked ancestors are refused and omitted from inventory', t => {
  const { root, put } = fixture(t)
  put('external-marker/Page.tsx', 'external-marker')
  symlinkSync(join(root, 'external-marker/Page.tsx'), join(root, 'src/pages/Linked.tsx'))
  assertFailure(inspectSourcePath(root, 'src/pages/Linked.tsx', { read: true }), 'SOURCE_LINK_REFUSED')
  rmSync(join(root, 'src/components/navigation'), { recursive: true })
  symlinkSync(join(root, 'external-marker'), join(root, 'src/components/navigation'), process.platform === 'win32' ? 'junction' : 'dir')
  assertFailure(inspectSourcePath(root, 'src/components/navigation/Page.tsx', { read: true }), 'SOURCE_LINK_REFUSED')
  const result = enumerateSourceInventory(root)
  assert.equal(result.files.some(file => /Linked|navigation/.test(file.path)), false)
  assert.ok(result.omissions.linked >= 2)
  assert.doesNotMatch(JSON.stringify(result), /external-marker/)
})

test('exact case aliases do not resolve or reveal a canonical neighbor', t => {
  const { root, put } = fixture(t)
  assertFailure(inspectSourcePath(root, 'src/pages/homepage.tsx', { read: true }), 'SOURCE_CASE_MISMATCH')
  put('src/pages/homepage.tsx', 'alias')
  if (readdirSync(join(root, 'src/pages')).filter(name => name.toLowerCase() === 'homepage.tsx').length > 1) {
    assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }), 'SOURCE_CASE_AMBIGUOUS')
    assert.equal(enumerateSourceInventory(root).files.some(file => /homepage/i.test(file.path)), false)
  }
})

test('missing and nonregular targets have safe distinct failure categories', t => {
  const { root } = fixture(t)
  assertFailure(inspectSourcePath(root, 'src/pages/Missing.tsx', { read: true }), 'SOURCE_UNAVAILABLE', 404)
  mkdirSync(join(root, 'src/pages/Directory.tsx'))
  assertFailure(inspectSourcePath(root, 'src/pages/Directory.tsx', { read: true }), 'SOURCE_NOT_REGULAR')
})

test('generated markers and generated filenames are readable but cannot acquire write authority', t => {
  const { root, put } = fixture(t)
  for (const [name, body] of [['One.tsx', '// @generated — do not edit\nexport const A = 1'], ['Two.tsx', '/* @generated from schema */\nexport const B = 2'], ['Three.tsx', '// Generated by tooling\nexport const C = 3'], ['Four.tsx', '// DO NOT EDIT\nexport const D = 4'], ['Page.generated.tsx', 'export const E = 5']]) {
    const path = `src/pages/${name}`
    put(path, body)
    const result = inspectSourcePath(root, path, { read: true })
    assert.equal(result.content, body)
    assert.equal(result.metadata.origin, 'generated')
    assert.equal(result.metadata.writable, false)
    assert.deepEqual(result.metadata.writeKinds, [])
    assertFailure(inspectSourcePath(root, path, { read: true, forWrite: true }), 'SOURCE_GENERATED_READ_ONLY', 403)
  }
  const generated = enumerateSourceInventory(root, { search: 'generated' })
  assert.equal(generated.files.length, 5)
  assert.equal(generated.files.every(file => file.origin === 'generated'), true)
})

test('source reads preserve UTF8 bytes and BOM while refusing lossy/UTF16/NUL decoding', t => {
  const { root, put } = fixture(t)
  const bytes = Buffer.from('\ufeffexport const café = "初版"\r\n')
  put('src/pages/HomePage.tsx', bytes)
  const valid = inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true })
  assert.deepEqual(valid.bytes, bytes)
  assert.equal(valid.content, bytes.toString('utf8'))
  for (const bytes of [Buffer.from([0xff, 0xfe, 0x61]), Buffer.from([0xc3, 0x28]), Buffer.from([0xe2, 0x82]), Buffer.from('text\0tail')]) {
    put('src/pages/HomePage.tsx', bytes)
    assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }), 'SOURCE_ENCODING_UNSUPPORTED', 415)
    assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx', { forWrite: true }), 'SOURCE_ENCODING_UNSUPPORTED', 415)
  }
})

test('byte and decoded limits refuse full source while metadata reports actual size', t => {
  const { root, put } = fixture(t)
  put('src/pages/HomePage.tsx', Buffer.alloc(sourcePolicyLimits.maxBytes + 1, 'x'))
  const metadata = inspectSourcePath(root, 'src/pages/HomePage.tsx').metadata
  assert.equal(metadata.sizeBytes, 1_000_001)
  assert.equal(metadata.readable, false)
  assert.equal(metadata.writable, false)
  assert.equal(metadata.reasonCode, 'SOURCE_TOO_LARGE')
  assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }), 'SOURCE_TOO_LARGE', 413)
  put('src/pages/HomePage.tsx', 'x'.repeat(sourcePolicyLimits.maxTextUnits + 1))
  assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }), 'SOURCE_TOO_LARGE', 413)
  put('src/pages/HomePage.tsx', 'x'.repeat(sourcePolicyLimits.maxTextUnits))
  assert.equal(inspectSourcePath(root, 'src/pages/HomePage.tsx', { read: true }).content.length, 500_000)
})

test('bounded result inventories expose omissions without following nested directories', t => {
  const { root, put } = fixture(t)
  for (let index = 0; index < 12; index += 1) put(`src/pages/Page${String(index).padStart(3, '0')}.tsx`)
  put('src/pages/nested/DeepPage.tsx')
  const result = enumerateSourceInventory(root, { limit: 4, extension: '.tsx' })
  assert.equal(result.files.length, 4)
  assert.equal(result.omissions.resultLimit, 13)
  assert.equal(result.complete, false)
  assert.equal(result.truncated, true)
  assert.equal(result.limits.maxDepth, 4)
  assert.equal(result.files.some(file => file.path.includes('nested')), false)
  assert.match(result.notice, /omitted/)
})

test('entry-budget exhaustion is explicit and never follows recursive directory links', t => {
  const { root, put } = fixture(t)
  for (let index = 0; index < sourcePolicyLimits.maxEntries; index += 1) put(`src/pages/P${index}.tsx`, '')
  const result = enumerateSourceInventory(root)
  assert.equal(result.truncated, true)
  assert.equal(result.complete, false)
  assert.equal(result.counts.examinedEntries, 4_000)
  assert.equal(result.omissions.entryBudget, 1)
  assert.match(result.notice, /budget/)
  assertFailure(inspectSourcePath(root, 'src/pages/HomePage.tsx'), 'SOURCE_DIRECTORY_LIMIT')
})

test('policy comparison and proposals report exact eligible losses without reading bodies or applying changes', t => {
  const { root } = fixture(t)
  const before = readFileSync(join(root, 'src/pages/HomePage.tsx'))
  const compared = compareSourcePolicies(root, { workspaceId: 'workspace-a', selection: 'src/index.css' })
  assert.equal(compared.mode, 'review-only')
  assert.equal(compared.applied, false)
  assert.equal(compared.complete, true)
  assert.deepEqual(compared.addedRules, [])
  assert.equal(compared.removedRules.length, 6)
  assert.equal(compared.affectedPaths.removed.length, 6)
  assert.equal(compared.selectionLosesEligibility, true)
  assert.deepEqual(compared.affectedPaths.added, [])
  assert.equal(compareSourcePolicies(root, { selection: 'src/pages/HomePage.tsx' }).selectionLosesEligibility, false)
  assert.equal(inspectSourcePath(root, 'src/index.css', { forWrite: true }).metadata.writable, true)
  assert.deepEqual(readFileSync(join(root, 'src/pages/HomePage.tsx')), before)
  assert.doesNotMatch(JSON.stringify(compared), /export default|"content"|"target"|session|credential/)
  assertFailure(compareSourcePolicies(root, { toRevision: 'unreviewed' }), 'SOURCE_POLICY_UNKNOWN')
  assertFailure(compareSourcePolicies(root, { selection: '../private-marker' }), 'SOURCE_PATH_INVALID')
})

test('workspace identities are returned per request without combining cached inventories', t => {
  const first = fixture(t), second = fixture(t)
  second.put('src/pages/OtherPage.tsx')
  const a = enumerateSourceInventory(first.root, { workspaceId: 'workspace-a' })
  const b = enumerateSourceInventory(second.root, { workspaceId: 'workspace-b' })
  assert.equal(a.workspaceId, 'workspace-a')
  assert.equal(b.workspaceId, 'workspace-b')
  assert.equal(a.files.some(file => file.path.endsWith('OtherPage.tsx')), false)
  assert.equal(b.files.some(file => file.path.endsWith('OtherPage.tsx')), true)
})


test('policy proposal comparison never opens source files or reads generated headers', t => {
  const { root } = fixture(t)
  t.mock.method(fs, 'openSync', () => { throw new Error('source file open prohibited during policy comparison') })
  syncBuiltinESMExports()
  try {
    const compared = compareSourcePolicies(root, { selection: 'src/index.css' })
    assert.equal(compared.complete, true)
    assert.equal(compared.affectedPaths.removed.length, 6)
    assert.equal(compared.selectionLosesEligibility, true)
    assert.equal(fs.openSync.mock.callCount(), 0)
  } finally { t.mock.restoreAll(); syncBuiltinESMExports() }
})


test('metadata-only history can hash bounded raw bytes but cannot bypass content or write decoding', t => {
  const { root, put } = fixture(t)
  const path = 'src/pages/HomePage.tsx'
  const malformed = Buffer.from([0xff, 0xfe, 0x61, 0x00, 0xc3, 0x28])
  put(path, malformed)
  const raw = inspectSourcePath(root, path, { read: true, decodeText: false })
  assert.deepEqual(raw.bytes, malformed)
  assert.equal(Object.hasOwn(raw, 'content'), false)
  assert.equal(raw.sourcePath.normalized, path)
  assert.equal(raw.metadata.path, path)
  assertFailure(inspectSourcePath(root, path, { read: true }), 'SOURCE_ENCODING_UNSUPPORTED', 415)
  assertFailure(inspectSourcePath(root, path, { read: true, forWrite: true, decodeText: false }), 'SOURCE_ENCODING_UNSUPPORTED', 415)
  assertFailure(inspectSourcePath(root, path, { forWrite: true, decodeText: false }), 'SOURCE_ENCODING_UNSUPPORTED', 415)
  put(path, Buffer.alloc(sourcePolicyLimits.maxBytes + 1, 0xff))
  assertFailure(inspectSourcePath(root, path, { read: true, decodeText: false }), 'SOURCE_TOO_LARGE', 413)
})
