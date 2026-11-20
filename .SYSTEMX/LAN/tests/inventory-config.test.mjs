import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import ts from 'typescript'
import { configurationInputPaths, inspectInventoryConfig, validInventoryConfig } from '../Builder/importer/inventory-config.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
function scan(files) {
  const reads = [], issues = []
  const evidence = Object.entries(files).filter(([path]) => configurationInputPaths.includes(path))
    .map(([path, source]) => ({ path, sha256: sha(source) }))
  const config = inspectInventoryConfig({
    ts, hasTracked: key => Object.hasOwn(files, key),
    read: key => { reads.push(key); return files[key].replace(/^\uFEFF/, '') },
    evidenceFor: key => evidence.find(item => item.path === key),
    issue: (code, path, line) => issues.push({ code, path, line }),
  })
  assert.ok(validInventoryConfig(config, evidence), 'Every emitted row must validate against its real source revision')
  return { config, reads, issues, evidence }
}

test('declared dependencies are scoped and bounded; unreviewed URLs, selectors and package fields do not escape', () => {
  const packageText = '\uFEFF' + JSON.stringify({
    dependencies: { '@scope/widget': '^2.4.1', library: '>=1.0.0 <3.0.0 || 4.x', local: 'file:/Users/PRIVATE_CANARY',
      remote: 'https://name:PRIVATE_CANARY@registry.invalid/x.tgz', 'secret-tool': '1.1.0' },
    devDependencies: { vite: '~6.2.0' }, peerDependencies: { library: '1.0.0 - 2.5.0' },
    optionalDependencies: { optional: '3.0.0-rc.1' },
    scripts: { install: 'PRIVATE_CANARY' }, arbitrary: 'PRIVATE_CANARY',
  })
  const { config, reads, issues } = scan({ 'package.json': packageText, '.npmrc': 'PRIVATE_CANARY', '.env': 'PRIVATE_CANARY',
    '.firebaserc': 'PRIVATE_CANARY', 'node_modules/vite/package.json': '{}', 'unlisted.json': '{}' })
  assert.deepEqual(reads, ['package.json'])
  assert.deepEqual(config.dependencies.map(row => [row.group, row.name, row.range]), [
    ['dependencies', '@scope/widget', '^2.4.1'], ['dependencies', 'library', '>=1.0.0 <3.0.0 || 4.x'],
    ['devDependencies', 'vite', '~6.2.0'], ['optionalDependencies', 'optional', '3.0.0-rc.1'],
    ['peerDependencies', 'library', '1.0.0 - 2.5.0'],
  ])
  assert.ok(config.dependencies.every(row => row.state === 'declared' && row.evidence.sha256 === sha(packageText)))
  assert.deepEqual(issues.map(row => row.code), ['unsupported-dependency-declaration'])
  assert.doesNotMatch(JSON.stringify({ config, issues }), /PRIVATE_CANARY|registry\.invalid|secret-tool|\/Users\//)
})

test('runtime pins keep their provenance and report conflicts without inspecting the installed runtime', () => {
  const manifest = JSON.stringify({ engines: { node: '>=24.0.0 <25', npm: '11.x' },
    packageManager: 'npm@11.11.0', volta: { node: '24.2.0' } })
  const files = { 'package.json': manifest, '.node-version': 'v24.2.0\n', '.nvmrc': '22.1.0' }
  const { config, issues } = scan(files)
  assert.equal(config.runtimePins.length, 6)
  assert.ok(config.runtimePins.some(row => row.field === 'engines' && row.value === '>=24.0.0 <25'))
  assert.ok(config.runtimePins.some(row => row.field === 'version-file' && row.value === '24.2.0' && row.evidence.path === '.node-version'))
  assert.ok(issues.some(row => row.code === 'runtime-pin-outside-engine' && row.path === '.nvmrc'))
  assert.ok(issues.some(row => row.code === 'conflicting-runtime-pins'))
  assert.deepEqual(scan({ ...files, '.nvmrc': '24.2.0' }).issues, [])
  const alias = scan({ '.nvmrc': 'lts/PRIVATE_CANARY' })
  assert.equal(alias.config.runtimePins.length, 0)
  assert.equal(alias.issues[0].code, 'unsupported-runtime-declaration')
})

test('Firebase service and emulator declarations never project credentials, project aliases, runtime state or external host names', () => {
  const files = { 'firebase.json': JSON.stringify({
    firestore: { rules: '/private/PRIVATE_CANARY' }, functions: [{ source: '/Users/PRIVATE_CANARY' }],
    hosting: [{ public: 'dist', site: 'PRIVATE_CANARY' }, { public: '/Users/PRIVATE_CANARY' }],
    emulators: { auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: 'PRIVATE_CANARY.internal', port: 8080 },
      storage: { host: '0.0.0.0', port: 999999 }, ui: { enabled: false }, PRIVATE_CANARY: {} },
  }), '.firebaserc': 'PRIVATE_CANARY' }
  const { config, reads, issues } = scan(files)
  assert.deepEqual(reads, ['firebase.json'])
  assert.ok(config.firebase.every(row => row.state === 'declared' && row.observation === 'not-observed'))
  assert.deepEqual(config.firebase.find(row => row.service === 'hosting').publicRoots, ['dist'])
  assert.equal(config.firebase.find(row => row.kind === 'emulator' && row.service === 'firestore').binding, 'other-declared-host')
  assert.equal(config.firebase.find(row => row.service === 'ui').enabled, false)
  assert.ok(issues.some(row => row.code === 'invalid-emulator-port'))
  assert.ok(issues.some(row => row.code === 'unsupported-hosting-public-root'))
  assert.doesNotMatch(JSON.stringify({ issues, config }), /PRIVATE_CANARY|\/Users\/|\.internal/)
})

test('invalid declarations, duplicate names and budget failures never silently replace a reviewed input', () => {
  const ambiguous = scan({ 'package.json': '{"dependencies":{"react":"1.0.0","\\u0072eact":"2.0.0"}}',
    'firebase.json': 'not json', '.node-version': '1'.repeat(257),
    'vite.config.js': 'export default {}', 'vite.config.ts': 'export default {}' })
  assert.deepEqual(ambiguous.config.dependencies, [])
  assert.deepEqual(ambiguous.config.buildTargets, [])
  assert.deepEqual(new Set(ambiguous.issues.map(row => row.code)), new Set(['duplicate-config-field', 'invalid-configuration-json', 'configuration-byte-limit', 'ambiguous-vite-config']))
  const oversized = scan({ 'package.json': JSON.stringify({ dependencies: Object.fromEntries(
    Array.from({ length: 257 }, (_, i) => ['pkg' + i, '1.2.3'])) }) })
  assert.deepEqual(oversized.config.dependencies, [])
  assert.equal(oversized.issues[0].code, 'dependency-declaration-limit')
})

test('cached projections reject unlisted sources, extra data, private paths, tampered revisions and unsupported selectors', () => {
  const { config, evidence } = scan({ 'package.json': '{"dependencies":{"react":"^19.0.0"}}', '.node-version': '24.2.0',
    'firebase.json': '{"hosting":{"public":"dist"}}' })
  for (const change of [
    copy => { copy.extra = true },
    copy => { copy.dependencies[0].script = 'untrusted' },
    copy => { copy.dependencies[0].range = 'file:/Users/a' },
    copy => { copy.dependencies[0].range = 'XXXYYY' },
    copy => { copy.runtimePins[0].evidence.sha256 = sha('altered') },
    copy => { copy.runtimePins[0].evidence.path = '.npmrc' },
    copy => { copy.firebase[0].publicRoots = ['../private'] },
    copy => { copy.firebase[0].observation = 'live' },
  ]) {
    const copy = structuredClone(config)
    change(copy)
    assert.equal(validInventoryConfig(copy, evidence), false)
  }
})
