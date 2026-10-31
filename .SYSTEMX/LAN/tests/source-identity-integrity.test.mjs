import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createIdentityExportIntegrity } from '../Builder/source-identity-integrity.mjs'

const workspaceId = 'a'.repeat(64)
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-identity-integrity-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
const payload = () => ({ schemaVersion: 1, kind: 'systemx-source-document', workspaceId, map: { sourcePath: 'src/pages/HomePage.tsx' } })

test('export key is created only by an explicit seal and is absent from portable metadata', t => {
  const root = fixture(t)
  const authority = createIdentityExportIntegrity(root, workspaceId)
  assert.equal(existsSync(join(root, '.SYSTEMX')), false)
  assert.throws(() => authority.verify(payload()), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  assert.equal(existsSync(join(root, '.SYSTEMX')), false)
  const exported = authority.seal(payload())
  const path = join(root, '.SYSTEMX/state/source-identity/export-integrity.key')
  const material = readFileSync(path)
  assert.equal(material.length, 32)
  assert.ok(lstatSync(path).isFile())
  if (process.platform !== 'win32') {
    assert.equal(lstatSync(path).mode & 0o077, 0)
    assert.equal(lstatSync(join(root, '.SYSTEMX/state/source-identity')).mode & 0o077, 0)
  }
  assert.equal(JSON.stringify(exported).includes(material.toString('hex')), false)
  assert.deepEqual(createIdentityExportIntegrity(root, workspaceId).verify(exported), payload())
  exported.map.sourcePath = 'src/pages/AboutPage.tsx'
  assert.throws(() => authority.verify(exported), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
})

test('linked runtime directories and malformed key files refuse without changing the linked target', t => {
  const root = fixture(t)
  const external = fixture(t)
  mkdirSync(join(root, '.SYSTEMX/state'), { recursive: true })
  symlinkSync(external, join(root, '.SYSTEMX/state/source-identity'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => createIdentityExportIntegrity(root, workspaceId).seal(payload()), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  assert.equal(existsSync(join(external, 'export-integrity.key')), false)
  const other = fixture(t)
  mkdirSync(join(other, '.SYSTEMX/state/source-identity'), { recursive: true, mode: 0o700 })
  const key = join(other, '.SYSTEMX/state/source-identity/export-integrity.key')
  writeFileSync(key, Buffer.alloc(33), { mode: 0o600 })
  assert.throws(() => createIdentityExportIntegrity(other, workspaceId).seal(payload()), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  assert.equal(readFileSync(key).length, 33)
})

test('unsafe added provenance, unknown workspace and input accessors cannot enter an export', t => {
  const root = fixture(t)
  const authority = createIdentityExportIntegrity(root, workspaceId)
  const document = payload()
  document.allocation = { sourcePath: 'src/pages/sk-proj-fictional.tsx' }
  assert.throws(() => authority.seal(document), { code: 'SOURCE_IDENTITY_EXPORT_UNSAFE_METADATA' })
  assert.equal(existsSync(join(root, '.SYSTEMX')), false)
  assert.throws(() => authority.seal({ ...payload(), workspaceId: 'b'.repeat(64) }), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  let reads = 0
  const getter = Object.defineProperty({}, 'workspaceId', { enumerable: true, get() { reads += 1; return workspaceId } })
  assert.throws(() => authority.seal(getter), { code: 'IDENTITY_DIGEST_INVALID' })
  assert.equal(reads, 0)
})

test('a key whose private file permissions were changed is refused on the next export', t => {
  const root = fixture(t)
  const authority = createIdentityExportIntegrity(root, workspaceId)
  authority.seal(payload())
  const key = join(root, '.SYSTEMX/state/source-identity/export-integrity.key')
  chmodSync(key, 0o644)
  if (process.platform !== 'win32') assert.throws(() => authority.seal(payload()), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  else assert.equal(authority.verify(authority.seal(payload())).workspaceId, workspaceId)
})
