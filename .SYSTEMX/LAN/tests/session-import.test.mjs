import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { firebaseCommand, startDevSession, validateEmulatorImport } from '../dev-session.mjs'
import { parseSessionOptions } from '../session-supervisor.mjs'

const metadata = () => ({
  version: 'synthetic-cli',
  auth: { version: 'synthetic-auth', path: 'auth_export' },
  firestore: { version: 'synthetic-firestore', path: 'firestore_export', metadata_file: 'firestore_export/export.overall_export_metadata' },
  storage: { version: 'synthetic-storage', path: 'storage_export' },
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'webappx-session-import-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'node_modules/vite/bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/vite/bin/vite.js'), '// injected process only\n')
  await writeFile(join(root, 'firebase.json'), JSON.stringify({ firestore: { rules: 'firestore.rules' }, storage: { rules: 'storage.rules' } }))
  const exportRoot = join(root, 'saved emulator Δ workspace')
  for (const name of ['auth_export', 'firestore_export', 'storage_export']) await mkdir(join(exportRoot, name), { recursive: true })
  await writeFile(join(exportRoot, 'firebase-export-metadata.json'), JSON.stringify(metadata()))
  await writeFile(join(exportRoot, 'auth_export/accounts.json'), '{"synthetic_private_marker":"never print this dataset"}')
  await writeFile(join(exportRoot, 'firestore_export/export.overall_export_metadata'), 'synthetic fixture only')
  let output = ''
  let portChecks = 0
  const spawned = []
  const deps = {
    repoRoot: root,
    environment: {},
    available: async () => { portChecks += 1; return true },
    alive: () => false,
    captureIdentity: pid => ({ pid, parentPid: process.pid, startedAt: 'synthetic birth', commandHash: 'synthetic command' }),
    output: { write: value => { output += value } },
    errors: { write: value => { output += value } },
    readinessIntervalMs: 0,
    command: { executable: 'injected-node', args: ['injected-firebase.js'] },
    spawnChild(executable, args, options) {
      const child = Object.assign(new EventEmitter(), { pid: 900_000 + spawned.length, killed: false, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough() })
      child.kill = () => { child.killed = true; return true }
      spawned.push({ executable, args, options, child })
      return child
    },
  }
  return { root, exportRoot, deps, spawned, output: () => output, portChecks: () => portChecks }
}

async function refuseWithoutSideEffects(f, directory, match = /Emulator import refused:/) {
  await assert.rejects(startDevSession({ ...parseSessionOptions(), emulatorImport: directory }, f.deps), match)
  assert.equal(f.spawned.length, 0)
  assert.equal(f.portChecks(), 0, 'Invalid imports fail before listener planning')
  assert.equal(existsSync(join(f.root, '.SYSTEMX/state')), false, 'Invalid imports do not write runtime state')
  assert.equal(f.output(), '')
}

test('the optional import flag preserves default options and keeps a literal path as one argument', () => {
  assert.deepEqual(parseSessionOptions(), { host: '127.0.0.1', fixedOrigin: false, ports: { app: 5173, lan: 7331, auth: 9099, firestore: 8080, storage: 9199 }, help: false })
  for (const path of ['/synthetic exports/Δ workspace', 'C:\\Local exports\\Δ workspace', '/synthetic/$(literal); & export']) {
    const options = parseSessionOptions(['--emulator-import', path])
    assert.equal(options.emulatorImport, path)
    assert.equal(options.fixedOrigin, false)
  }
  for (const args of [['--emulator-import'], ['--emulator-import', ''], ['--emulator-import', '  '], ['--emulator-import', '--fixed-origin'], ['--emulator-import', 'bad\0path'], ['--emulator-import', 'one', '--emulator-import', 'two']]) assert.throws(() => parseSessionOptions(args), /--emulator-import/)
  assert.equal(validateEmulatorImport(undefined), undefined)
})

test('default Firebase command is unchanged and no import state or guidance appears', async t => {
  const f = await fixture(t)
  const owned = await startDevSession(parseSessionOptions(), f.deps)
  t.after(owned.close)
  assert.deepEqual(f.spawned[0].args, ['injected-firebase.js', 'emulators:start', '--config', owned.session.runtime.firebaseConfig, '--project', 'demo-systemx', '--only', 'auth,firestore,storage'])
  assert.deepEqual(owned.session.runtime, { firebaseConfig: owned.session.runtime.firebaseConfig })
  assert.equal(f.output().includes('explicitly selected local export'), false)
  assert.equal(f.spawned.length, 3)
})

test('validated canonical import is appended once to the Firebase array and retained only in runtime', async t => {
  const f = await fixture(t)
  const requested = join(f.exportRoot, '..', 'saved emulator Δ workspace')
  const canonical = await realpath(f.exportRoot)
  const owned = await startDevSession(parseSessionOptions(['--emulator-import', requested]), f.deps)
  t.after(owned.close)
  assert.deepEqual(f.spawned[0].args, ['injected-firebase.js', 'emulators:start', '--config', owned.session.runtime.firebaseConfig, '--project', 'demo-systemx', '--only', 'auth,firestore,storage', '--import', canonical])
  assert.equal(owned.session.runtime.emulatorImport, canonical)
  assert.equal(JSON.parse(await readFile(join(f.root, '.SYSTEMX/state/local-session.json'), 'utf8')).runtime.emulatorImport, canonical)
  assert.match(f.output(), /explicitly selected local export/)
  assert.match(f.output(), /readiness does not verify imported workflows/)
  assert.equal(f.output().includes('synthetic_private_marker'), false)
  assert.equal(f.output().includes(canonical), false, 'The helper guidance does not print local import paths')
  assert.equal(f.spawned.every(child => child.options.shell === false), true)
  assert.equal(f.spawned.slice(1).some(child => child.args.includes('--import')), false)
})

test('Windows npm invocation preserves import as the final unsplit literal argument', async t => {
  const f = await fixture(t)
  f.deps.command = firebaseCommand({ platform: 'win32', executable: 'C:\\Node\\node.exe', environment: { npm_execpath: 'C:\\Node tools\\npm-cli.js' } })
  const owned = await startDevSession(parseSessionOptions(['--emulator-import', f.exportRoot]), f.deps)
  t.after(owned.close)
  assert.equal(f.spawned[0].executable, 'C:\\Node\\node.exe')
  assert.deepEqual(f.spawned[0].args.slice(0, 5), ['C:\\Node tools\\npm-cli.js', 'exec', '--no', '--', 'firebase-tools'])
  assert.deepEqual(f.spawned[0].args.slice(-2), ['--import', await realpath(f.exportRoot)])
  assert.equal(f.spawned[0].options.shell, false)
})

test('missing export directories and metadata fail before any children or runtime writes', async t => {
  const f = await fixture(t)
  await refuseWithoutSideEffects(f, join(f.root, 'missing'))
  await refuseWithoutSideEffects(f, join(f.root, 'firebase.json'))
  await rm(join(f.exportRoot, 'firebase-export-metadata.json'))
  await refuseWithoutSideEffects(f, f.exportRoot)
})

test('malformed oversized nonregular and unsupported metadata fail without echoing values', async t => {
  const f = await fixture(t)
  const metadataPath = join(f.exportRoot, 'firebase-export-metadata.json')
  for (const value of ['{synthetic_private_marker', '', ' '.repeat(64 * 1024 + 1), 'null', '[]', '{}', '{"version":"x"}', '{"version":"x","auth":null}', '{"version":"x","storage":[]}']) {
    await writeFile(metadataPath, value)
    await refuseWithoutSideEffects(f, f.exportRoot)
  }
  await rm(metadataPath)
  await mkdir(metadataPath)
  await refuseWithoutSideEffects(f, f.exportRoot)
})

test('all supported sections reject escaping absolute missing and wrong-kind referenced paths', async t => {
  const f = await fixture(t)
  for (const [section, field] of [['auth', 'path'], ['storage', 'path'], ['firestore', 'path'], ['firestore', 'metadata_file']]) {
    for (const path of ['../outside', 'safe/../../outside', '..\\outside', '/outside', 'C:\\outside', 'C:outside', '\\\\host\\share', 'file:stream', 'missing', '', '.', 'a\0b']) {
      const value = metadata()
      value[section][field] = path
      await writeFile(join(f.exportRoot, 'firebase-export-metadata.json'), JSON.stringify(value))
      await refuseWithoutSideEffects(f, f.exportRoot)
    }
  }
  const value = metadata()
  value.auth.path = 'firestore_export/export.overall_export_metadata'
  await writeFile(join(f.exportRoot, 'firebase-export-metadata.json'), JSON.stringify(value))
  await refuseWithoutSideEffects(f, f.exportRoot)
  value.auth.path = 'auth_export'
  value.firestore.metadata_file = 'firestore_export'
  await writeFile(join(f.exportRoot, 'firebase-export-metadata.json'), JSON.stringify(value))
  await refuseWithoutSideEffects(f, f.exportRoot)
})

test('linked export roots metadata path components and nested datasets are refused', async t => {
  const f = await fixture(t)
  const rootLink = join(f.root, 'linked export')
  try { await symlink(f.exportRoot, rootLink, 'dir') } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows test account cannot create symlinks'); return }
    throw error
  }
  await refuseWithoutSideEffects(f, rootLink)
  const metadataPath = join(f.exportRoot, 'firebase-export-metadata.json')
  const outsideMetadata = join(f.root, 'outside-metadata.json')
  await writeFile(outsideMetadata, JSON.stringify(metadata()))
  await rm(metadataPath)
  await symlink(outsideMetadata, metadataPath, 'file')
  await refuseWithoutSideEffects(f, f.exportRoot)
  await rm(metadataPath)
  await writeFile(metadataPath, JSON.stringify(metadata()))
  const outside = join(f.root, 'outside')
  await mkdir(outside)
  await writeFile(join(outside, 'fixture.json'), '{}')
  await rm(join(f.exportRoot, 'storage_export'), { recursive: true })
  await symlink(outside, join(f.exportRoot, 'storage_export'), 'dir')
  await refuseWithoutSideEffects(f, f.exportRoot)
  await rm(join(f.exportRoot, 'storage_export'))
  await mkdir(join(f.exportRoot, 'storage_export'))
  await symlink(join(outside, 'fixture.json'), join(f.exportRoot, 'auth_export', 'linked-accounts.json'), 'file')
  await refuseWithoutSideEffects(f, f.exportRoot)
  await rm(join(f.exportRoot, 'auth_export', 'linked-accounts.json'))
  await symlink(outside, join(f.exportRoot, 'linked-directory'), 'dir')
  const value = metadata()
  value.firestore.metadata_file = 'linked-directory/fixture.json'
  await writeFile(metadataPath, JSON.stringify(value))
  await refuseWithoutSideEffects(f, f.exportRoot)
})

test('an export may contain a single supported emulator without fabricating other datasets', async t => {
  const f = await fixture(t)
  await writeFile(join(f.exportRoot, 'firebase-export-metadata.json'), JSON.stringify({ version: 'synthetic-cli', auth: { path: 'auth_export' } }))
  assert.equal(validateEmulatorImport(f.exportRoot), await realpath(f.exportRoot))
})
