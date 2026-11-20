import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { trackedInventory } from '../../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const cliPath = fileURLToPath(new URL('../../scripts/lan-repository-inventory.mjs', import.meta.url))
function cli(root, action, exitCode = 0) {
  const result = spawnSync(process.execPath, [cliPath, action, '--root', root], { encoding: 'utf8' })
  assert.equal(result.status, exitCode, result.stderr || result.stdout)
  return JSON.parse(result.stdout)
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(),'tracked-config-fixture-'))
  t.after(() => rmSync(root, { recursive:true, force:true }))
  const git = (...args) => execFileSync('git', [...args], { cwd:root, stdio:'pipe' })
  const put = (path, bytes) => { mkdirSync(dirname(join(root,path)),{recursive:true}); writeFileSync(join(root,path),bytes) }
  git('init','-q')
  git('config','user.name','fixture')
  git('config','user.email','fixture@example.invalid')
  put('package.json','{"devDependencies":{"vite":"6"},"engines":{"node":">=22"}}')
  put('index.html','<script type="module" src="/src/router.tsx"></script>')
  put('src/router.tsx',"import Page from './Page'\nexport function renderPage(pathname) { switch(pathname){default:return <Page/>} }")
  put('src/Page.tsx','export default function Page() { return <main/> }')
  git('add','.')
  git('commit','--no-gpg-sign','-qm','baseline')
  return { root, put, git, scan: () => trackedInventory(root), last: () => trackedInventory(root,'last-good'),
    cache:join(root,'.git','systemx-repository-inventory','last-good.json') }
}

test('the operator scan reads only reviewed tracked config and binds each declaration to the exact working bytes', t => {
  const f = fixture(t)
  const pin = Buffer.from('\uFEFF22.3.0\n')
  f.put('.node-version',pin)
  f.put('.nvmrc','22.3.0\n')
  f.put('.npmrc','PRIVATE_CONFIGURATION_CANARY')
  f.put('.env','PRIVATE_CONFIGURATION_CANARY')
  f.put('firebase.json','{"emulators":{"firestore":{"host":"127.0.0.1","port":8180}}}')
  f.git('add','-f','.node-version','.nvmrc','.npmrc','.env','firebase.json')
  const result = f.scan()
  assert.equal(result.status,'accepted',JSON.stringify(result))
  const { configuration, evidence } = result.inventory
  assert.equal(result.inventory.schemaVersion,4)
  assert.ok(configuration.runtimePins.some(row => row.evidence.path === '.node-version' && row.evidence.sha256 === sha(pin)))
  assert.ok(configuration.firebase.some(row => row.service === 'firestore' && row.port === 8180 && row.observation === 'not-observed'))
  assert.ok(!evidence.some(item => ['.env','.npmrc'].includes(item.path)))
  assert.ok(!JSON.stringify(result).includes('PRIVATE_CONFIGURATION_CANARY'))
  assert.deepEqual(f.last().lastGood, result.inventory)
  const prior = readFileSync(f.cache)
  unlinkSync(join(f.root,'.nvmrc'))
  symlinkSync('.npmrc',join(f.root,'.nvmrc'))
  const refused = f.scan()
  assert.equal(refused.status,'refused')
  assert.equal(refused.lastGoodRevision,result.inventory.revision)
  assert.deepEqual(readFileSync(f.cache),prior)
})

test('v2 readback reports its missing configuration coverage; unresolved new declarations preserve it byte for byte', t => {
  const f = fixture(t)
  const { configuration, metadata, revision, ...legacy } = f.scan().inventory
  assert.ok(configuration.dependencies.length)
  legacy.schemaVersion = 2
  legacy.revision = sha(JSON.stringify(legacy))
  assert.notEqual(legacy.revision,revision)
  f.put('.git/systemx-repository-inventory/last-good.json',JSON.stringify(legacy))
  assert.deepEqual(f.last().lastGood,legacy)
  assert.deepEqual(f.last().missingCoverage,['configuration','resource-metadata'])
  const kept = readFileSync(f.cache)
  f.put('package.json','{"devDependencies":{"vite":"6","foo":"file:/private/PACKAGE_SOURCE_CANARY"}}')
  const partial = f.scan()
  assert.equal(partial.status,'incomplete')
  assert.equal(partial.lastGoodRevision,legacy.revision)
  assert.equal(partial.lastGoodSchemaVersion,2)
  assert.ok(partial.inventory.findings.some(item => item.code === 'unsupported-dependency-declaration'))
  assert.ok(!JSON.stringify(partial).includes('PACKAGE_SOURCE_CANARY'))
  assert.deepEqual(readFileSync(f.cache),kept)
})

test('preview proxy declarations surface independently of development routing and preserve the accepted inventory', t => {
  const f = fixture(t)
  f.put('vite.config.ts', 'export default {preview:{proxy:{}}}')
  f.git('add', 'vite.config.ts')
  const good = cli(f.root, 'scan')
  assert.equal(good.status, 'accepted')
  const bytes = readFileSync(f.cache)
  for (const server of ['', 'server:{host:"localhost"},', 'server:{proxy:{}},']) {
    const source = 'export default {\n' + server + '\npreview:{proxy:{\n"/__systemx":"http://PRIVATE_CANARY"\n}}}'
    f.put('vite.config.ts', source)
    const report = cli(f.root, 'scan', 1)
    assert.equal(report.status, 'incomplete')
    assert.deepEqual(report.inventory.configuration.bridges, [])
    assert.deepEqual(report.inventory.findings.find(row => row.code === 'unsupported-vite-preview-bridge'),
      { state: 'unresolved', code: 'unsupported-vite-preview-bridge', path: 'vite.config.ts', line: 4 })
    assert.ok(report.inventory.evidence.some(row => row.path === 'vite.config.ts' && row.sha256 === sha(source)))
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_CANARY/)
    assert.equal(report.lastGoodRevision, good.inventory.revision)
    assert.deepEqual(readFileSync(f.cache), bytes)
  }
  assert.deepEqual(cli(f.root, 'last-good').lastGood, good.inventory)
  const server = 'server:{host:"localhost",proxy:{"/__systemx":"http://localhost"}}'
  for (const host of ['true', 'pickHost()']) {
    f.put('vite.config.ts', 'export default {' + server + ',preview:{host:' + host + '}}')
    const report = cli(f.root, 'scan', 1)
    assert.ok(report.inventory.findings.some(row => row.code === 'unsupported-vite-preview-host'))
    assert.equal(report.inventory.configuration.bridges[0].preview, 'unresolved')
    assert.deepEqual(readFileSync(f.cache), bytes)
  }
  f.put('vite.config.ts', 'export default {' + server + ',preview:{host:true,proxy:{}}}')
  assert.equal(cli(f.root, 'scan').inventory.configuration.bridges[0].preview, 'explicit-empty-proxy')
})

test('a scan needs a shared version across all runtime declarations before replacing the last complete inventory', t => {
  const f = fixture(t)
  function setPins(engine, nvm) {
    f.put('package.json', JSON.stringify({ devDependencies: { vite: '6' }, engines: { node: engine } }))
    f.put('.nvmrc', nvm + '\n')
  }
  setPins('24.0.0', '24.x')
  f.git('add', '.nvmrc')
  let good = cli(f.root, 'scan')
  assert.equal(good.status, 'accepted')
  for (const [engine, selector] of [
    ['22.x || 24.x', '>=24 <25'], ['>23.9.4 <24', '23.9.x'],
    ['>=24.0.0-rc.1 <24.0.0', '24.0.0-rc.2'], ['>=24.0.0-rc.1 <24.0.0', '=24.0.0-rc.2'],
  ]) {
    setPins(engine, selector)
    good = cli(f.root, 'scan')
    assert.equal(good.status, 'accepted')
    assert.deepEqual(good.inventory.configuration.runtimePins.map(row => row.value), [engine, selector])
  }
  const bytes = readFileSync(f.cache)
  for (const [engine, selector, code, path] of [
    ...['22', '22.x', '>=22 <23'].map(selector => ['24.0.0', selector, 'runtime-pin-outside-engine', '.nvmrc']),
    ['>=22 <23', '24.0.0', 'runtime-pin-outside-engine', '.nvmrc'],
    ['>=22 <23', '24.x', 'runtime-selector-comparison-unresolved', 'package.json'],
    ['>=22 <25', '24.0.0-rc.1', 'runtime-selector-comparison-unresolved', '.nvmrc'],
    ['>=24.0.0-rc.4 <24.0.0 || >=22', '24.0.0-rc.2', 'runtime-selector-comparison-unresolved', '.nvmrc'],
    ['>=24 >=24.0.0-rc.1', '24.0.0-rc.2', 'runtime-selector-comparison-unresolved', '.nvmrc'],
    ['>=24 <23', '>=24 <23', 'runtime-selector-comparison-unresolved', 'package.json'],
    ['>=22', '24.0.0-rc.01', 'unsupported-runtime-declaration', '.nvmrc'],
  ]) {
    setPins(engine, selector)
    const report = cli(f.root, 'scan', 1)
    assert.equal(report.status, 'incomplete')
    assert.ok(report.inventory.findings.some(row => row.code === code && row.path === path), JSON.stringify(report.inventory.findings))
    assert.equal(report.lastGoodRevision, good.inventory.revision)
    assert.deepEqual(readFileSync(f.cache), bytes)
  }
  assert.deepEqual(cli(f.root, 'last-good').lastGood, good.inventory)
})

test('unresolved Vite directories and bridge routes identify the missing adapter and the source of each finding', t => {
  const f = fixture(t)
  const config = 'vite.config.ts'
  f.put(config, 'export default {}')
  f.git('add',config)
  const good = cli(f.root,'scan')
  const accepted = readFileSync(f.cache)
  for (const [source, code, missingCapability] of [
    ['build: {outDir: chooseDirectory()}', 'unsupported-vite-directory-declaration', 'vite-build-directory-resolution'],
    ['publicDir: chooseDirectory()', 'unsupported-vite-directory-declaration', 'vite-build-directory-resolution'],
    ["server: {proxy:{'/__systemx':{target:'http://localhost',rewrite:path=>change(path)}}}", 'unsupported-vite-bridge-declaration', 'vite-bridge-resolution'],
    ["server: {proxy:{'/elsewhere':'http://localhost'}}", 'unsupported-vite-proxy-route', 'vite-bridge-resolution'],
  ]) {
    f.put(config,`export default {
  ${source}
}`)
    const report = cli(f.root,'scan',1)
    assert.equal(report.status,'incomplete')
    assert.deepEqual(report.capabilities.missing,['static-configuration-resolution',missingCapability])
    const {findings,metadata} = report.inventory
    const index = findings.findIndex(row => row.code === code)
    assert.ok(index >= 0,JSON.stringify(findings))
    assert.equal(findings[index].path,config)
    assert.equal(findings[index].line,2)
    const rule = metadata.provenance.findings[index]
    assert.deepEqual(metadata.provenance.rules[rule],{adapter:'vite-static-config',basis:'unresolved'})
    assert.equal(report.lastGoodRevision,good.inventory.revision)
    assert.deepEqual(readFileSync(f.cache),accepted)
  }

  // Both emitter domains can produce a finding involving the word "route".
  f.put('src/router.tsx',`import Page from './Page'
export function renderPage(pathname) { switch(pathname){case dynamicPath():return <Page/>;default:return <Page/>} }`)
  const {inventory,capabilities} = cli(f.root,'compare',1)
  assert.deepEqual(capabilities.missing,['complete-entry-and-route-resolution','static-configuration-resolution','vite-bridge-resolution'])
  const provenance = inventory.metadata.provenance
  const adapters = Object.fromEntries(inventory.findings.map((row,i) => [row.code,provenance.rules[provenance.findings[i]].adapter]))
  assert.equal(adapters['unsupported-vite-proxy-route'],'vite-static-config')
  assert.equal(adapters['dynamic-route-pattern'],'react-route-declaration')

  const cases = Array.from({ length:105 }, (_, n) => `case choose(${n}): return <Page/>`).join('\n')
  f.put('src/router.tsx', `import Page from './Page'
export function renderPage(pathname) { switch(pathname){${cases}
default:return <Page/>} }`)
  const capped = cli(f.root,'compare',1)
  assert.ok(capped.inventory.omittedFindings > 0)
  assert.ok(!capped.inventory.findings.some(row => row.code === 'unsupported-vite-proxy-route'))
  assert.deepEqual(capped.capabilities.missing,capabilities.missing)
  assert.deepEqual(readFileSync(f.cache),accepted)
})
