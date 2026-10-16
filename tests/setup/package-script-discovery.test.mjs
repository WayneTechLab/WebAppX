import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildScriptDiscovery, parsePublicJson, readPublicText, readScriptDiscovery, runScriptDiscoveryCli } from '../../scripts/package-script-discovery.mjs'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const purposes = { schemaVersion: 1, scripts: [
  { name: 'doctor', purpose: 'setup', description: 'Inspect prerequisites.' },
  { name: 'dev', purpose: 'app', description: 'Start the public app.' },
  { name: 'portals:test', purpose: 'portal', description: 'Check fictional portals.' },
  { name: 'systemx:status', purpose: 'SYSTEMX', description: 'Inspect managed installation.' },
  { name: 'wiki:check', purpose: 'wiki', description: 'Inspect wiki differences.' },
  { name: 'deploy', purpose: 'release', description: 'Explicit publication command.' },
] }
const manifest = { scripts: { doctor: 'node doctor.mjs', dev: 'vite', 'portals:test': 'node --test portals.mjs', 'systemx:status': 'python3 manager.py status', 'wiki:check': 'bash wiki.sh --dry-run', deploy: 'bash deploy.sh' } }
const clone = value => structuredClone(value)
const output = () => { const values = []; return { values, write: value => values.push(value) } }

test('six literal purposes cover real supplied manifest names and preserve actual commands as inert data', () => {
  const source = clone(manifest); source.scripts.dev = 'node -e "throw new Error(\'MUST_NOT_EXECUTE\')"'
  const before = JSON.stringify(source), report = buildScriptDiscovery(source, purposes)
  assert.equal(report.ok, true); assert.equal(report.scriptCount, 6)
  assert.deepEqual(report.groups.map(group => [group.purpose, group.scripts.map(row => row.name)]), [['setup', ['doctor']], ['app', ['dev']], ['portal', ['portals:test']], ['SYSTEMX', ['systemx:status']], ['wiki', ['wiki:check']], ['release', ['deploy']]])
  assert.equal(report.groups[1].scripts[0].command, 'node -e "throw new Error(\'MUST_NOT_EXECUTE\')"')
  assert.equal(JSON.stringify(source), before)
})

test('new manifest names are explicit unclassified entries; stale metadata never invents a maintained command', () => {
  const changed = clone(manifest); changed.scripts.newlyAdded = 'echo new'
  const report = buildScriptDiscovery(changed, purposes)
  assert.equal(report.ok, false); assert.deepEqual(report.unclassified, [{ name: 'newlyAdded', command: 'echo new' }])
  delete changed.scripts.dev
  assert.deepEqual(buildScriptDiscovery(changed, purposes).staleClassifications, ['dev'])
})

test('duplicate, unknown-purpose, malformed and oversized public data refuse without executing accessors', () => {
  for (const edit of [value => value.scripts.push(clone(value.scripts[0])), value => { value.scripts[0].purpose = 'misc' }, value => { value.scripts[0].description = 'bad\nline' }, value => { value.extra = true }]) {
    const value = clone(purposes); edit(value); assert.throws(() => buildScriptDiscovery(manifest, value), /Invalid/)
  }
  let reads = 0; const hostile = clone(manifest)
  Object.defineProperty(hostile.scripts, 'private', { enumerable: true, get() { reads++; return 'private' } })
  assert.throws(() => buildScriptDiscovery(hostile, purposes), /Invalid/); assert.equal(reads, 0)
  assert.throws(() => buildScriptDiscovery({ scripts: { dev: 'x'.repeat(50_001) } }, purposes), /Invalid/)
})

test('bounded JSON reader rejects duplicate/reserved keys, malformed numbers, sparse syntax and excessive depth', () => {
  assert.deepEqual(parsePublicJson('{"text":"literal \\" quote","values":[1,true,null,-2.5]}'), { text: 'literal " quote', values: [1, true, null, -2.5] })
  for (const text of ['{"name":1,"name":2}', '{"__proto__":{}}', '[1,]', '{"n":01}', '{"n":1e999}', ' '.repeat(2_000_001), '['.repeat(34) + '0' + ']'.repeat(34)]) assert.throws(() => parsePublicJson(text), /Invalid/)
})

test('actual reviewed manifest has exact membership and literal representatives in all six purposes', async () => {
  const packageText = await readFile(join(repository, 'package.json'), 'utf8')
  const metadata = await readFile(join(repository, 'scripts/package-script-purposes.json'), 'utf8')
  const actual = JSON.parse(packageText), report = await readScriptDiscovery(repository)
  assert.equal(report.ok, true)
  assert.deepEqual(report.groups.flatMap(group => group.scripts.map(row => row.name)).sort(), Object.keys(actual.scripts).sort())
  for (const [purpose, name] of [['setup', 'doctor'], ['app', 'dev'], ['portal', 'portals:test'], ['SYSTEMX', 'systemx:status'], ['wiki', 'wiki:check'], ['release', 'deploy']]) assert.ok(report.groups.find(group => group.purpose === purpose).scripts.some(row => row.name === name && row.command === actual.scripts[name]))
  assert.equal(await readFile(join(repository, 'package.json'), 'utf8'), packageText)
  assert.equal(await readFile(join(repository, 'scripts/package-script-purposes.json'), 'utf8'), metadata)
})

test('CLI check refuses unclassified data, invalid flags do not leak arguments, and public paths reject symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'webappx scripts Café ')); t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'scripts'))
  const changed = clone(manifest); changed.scripts.unknown = 'false'
  await writeFile(join(root, 'package.json'), JSON.stringify(changed)); await writeFile(join(root, 'scripts/package-script-purposes.json'), JSON.stringify(purposes))
  const stdout = output(), stderr = output()
  assert.equal(await runScriptDiscoveryCli(['--json'], { root, stdout, stderr }), 0)
  assert.equal(JSON.parse(stdout.values.join('')).ok, false)
  assert.equal(await runScriptDiscoveryCli(['--check'], { root, stdout: output(), stderr }), 1)
  assert.equal(await runScriptDiscoveryCli(['--PRIVATE_LITERAL'], { root, stdout, stderr }), 2)
  assert.doesNotMatch(stderr.values.join(''), /PRIVATE_LITERAL/)
  await assert.rejects(readPublicText(root, '../package.json'), /Invalid/)
  const link = join(root, 'scripts/linked.json'); await symlink(join(root, 'package.json'), link)
  await assert.rejects(readPublicText(root, 'scripts/linked.json'), /Invalid/)
})

test('importing discovery performs no reads, output or child execution even with misleading arguments', () => {
  const url = new URL('../../scripts/package-script-discovery.mjs', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv[1] = '/unrelated/check'; await import(${JSON.stringify(url)});`], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false })
  assert.equal(child.status, 0); assert.equal(child.stdout, ''); assert.equal(child.stderr, '')
})
