import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { absolutePathSegments, isCanonicalRepositoryRoot } from '../../.SYSTEMX/swarm/path-boundary.mjs'
import { createController, inspectRepository } from '../../.SYSTEMX/swarm/runtime.mjs'

const { join } = path
test('Windows drive separators canonicalize without accepting a different root or subdirectory', () => {
  const options = { pathApi: path.win32, canonicalize: value => path.win32.normalize(value) }
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', 'C:/repo', options), true)
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', 'C:/other', options), false)
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', 'C:/repo/child', options), false)
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', 'D:/repo', options), false)
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', 'C:repo', options), false)
  assert.equal(isCanonicalRepositoryRoot('C:\\repo', '', options), false)
})
test('Windows UNC share roots remain complete and distinct during canonical comparison and traversal', () => {
  const options = { pathApi: path.win32, canonicalize: value => path.win32.normalize(value) }
  assert.equal(isCanonicalRepositoryRoot('\\\\server\\share\\repo', '//server/share/repo', options), true)
  assert.equal(isCanonicalRepositoryRoot('\\\\server\\share\\repo', '//server/other/repo', options), false)
  const result = absolutePathSegments('//server/share/repo/.SYSTEMX/state', path.win32)
  assert.deepEqual(result, { absolute: '\\\\server\\share\\repo\\.SYSTEMX\\state', root: '\\\\server\\share\\', parts: ['repo', '.SYSTEMX', 'state'] })
  assert.equal(result.parts.reduce((current, part) => path.win32.join(current, part), result.root), result.absolute)
})
test('drive and POSIX traversal reconstruct the same absolute path and refuse drive-relative input', () => {
  for (const [input, api, root, parts] of [
    ['C:/repo/.SYSTEMX/state', path.win32, 'C:\\', ['repo', '.SYSTEMX', 'state']],
    ['/repo/.SYSTEMX/state', path.posix, '/', ['repo', '.SYSTEMX', 'state']],
    ['/', path.posix, '/', []],
    ['C:/', path.win32, 'C:\\', []],
  ]) {
    const result = absolutePathSegments(input, api)
    assert.equal(result.root, root); assert.deepEqual(result.parts, parts)
    assert.equal(result.parts.reduce((current, part) => api.join(current, part), result.root), api.normalize(input))
  }
  for (const [input, api] of [['C:repo', path.win32], ['../repo', path.posix]]) assert.throws(() => absolutePathSegments(input, api), error => error.code === 'STATE_PATH_REFUSED')
})
function fixture(t) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-path-boundary-'))), root = join(temp, 'repo')
  mkdirSync(root)
  const git = args => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim() }
  git(['init', '-b', 'main']); git(['config', 'user.name', 'Path fixture']); git(['config', 'user.email', 'paths@example.invalid'])
  writeFileSync(join(root, '.gitignore'), '.SYSTEMX/state/\n'); writeFileSync(join(root, 'README.md'), 'Preserve this synthetic source.\n'); git(['add', '.']); git(['commit', '-m', 'path fixture'])
  const manifest = { schemaVersion: 1, runId: 'paths', repository: 'example/synthetic', baseBranch: 'main', baseRevision: git(['rev-parse', 'HEAD']), maxWorkers: 1, tasks: [{ id: 'T1', title: 'Synthetic path boundary task', acceptance: ['The selected root and no-link policy remain exact.'], allowedPaths: ['src/'], checks: [{ executable: 'node', args: ['--version'] }], dependsOn: [] }] }
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  return { root, temp, manifest }
}
test('actual native Git roots and canonical aliases work while selected subdirectories still refuse', t => {
  const f = fixture(t), alias = join(f.temp, 'alias'), child = join(f.root, 'child')
  mkdirSync(child); symlinkSync(f.root, alias, 'dir')
  assert.equal(inspectRepository(f.root).root, f.root)
  assert.equal(inspectRepository(alias).root, f.root)
  assert.throws(() => inspectRepository(child), error => error.code === 'REPOSITORY_ROOT_REQUIRED')
  assert.equal(readFileSync(join(f.root, 'README.md'), 'utf8'), 'Preserve this synthetic source.\n')
})
test('actual state traversal still refuses a linked descendant without creating records in its target', async t => {
  const f = fixture(t), outside = join(f.temp, 'outside'), state = join(f.temp, 'state-link')
  mkdirSync(outside); symlinkSync(outside, state, 'dir')
  const controller = createController({ repo: f.root, manifest: f.manifest, stateDir: join(state, 'swarm', 'paths') })
  assert.throws(() => controller.plan(), error => error.code === 'STATE_PATH_REFUSED')
  await assert.rejects(() => controller.prepare({ taskId: 'T1', slot: 1, executable: realpathSync(process.execPath), apply: true }), error => error.code === 'STATE_PATH_REFUSED')
  assert.equal(existsSync(join(outside, 'swarm')), false)
  assert.equal(readFileSync(join(f.root, 'README.md'), 'utf8'), 'Preserve this synthetic source.\n')
})
