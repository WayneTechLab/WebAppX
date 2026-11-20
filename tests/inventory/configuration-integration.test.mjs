import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { trackedInventory } from '../../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
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
