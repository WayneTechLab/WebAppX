import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { trackedInventory, inventoryLimits } from '../../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const script = file => `<script type="module" src="${file}"></script>`
const router = component => `import { Page } from './${component}'
export function renderPage(pathname: string) {
  switch (pathname) {
    case '/':
    case '/welcome': return <Page />
    default: return <Page />
  }
}`
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-inventory-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  function put(path, data) {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data)
  }
  const git = (...args) => execFileSync('git', [...args], { cwd: root, stdio: 'pipe' })
  git('init', '-q')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'user.name', 'Inventory fixture')
  put('package.json', JSON.stringify({ devDependencies: { vite: '1' }, scripts: { preinstall: 'node should-never-run.js' } }))
  put('index.html', `<!-- ${script('/src/not-real.tsx')} -->\n<template>${script('/src/also-not-real.tsx')}</template>\n${script('/src/start.tsx')}`)
  put('src/start.tsx', "import { renderPage as Router } from './router'\nexport const App = () => <Router />\nthrow Error('application must never be evaluated')\n")
  put('src/router.tsx', router('Welcome'))
  put('src/Welcome.tsx', 'export const Page = () => <main />')
  git('add', '.')
  git('commit', '--no-gpg-sign', '-qm', 'fixture')
  return { root, put, git, scan: () => trackedInventory(root), last: () => trackedInventory(root, 'last-good') }
}

test('explicit HTML entry and flat static routes have tracked working bytes, exact declaration lines and a stable revision', t => {
  const f = fixture(t)
  const first = f.scan()
  assert.equal(first.status, 'accepted', JSON.stringify(first))
  const { inventory } = first
  assert.deepEqual(inventory.entryPoints, [{ state: 'explicit', source: 'src/start.tsx', declaredIn: 'index.html', line: 3 }])
  assert.deepEqual(inventory.routes.map(r => [r.pattern, r.source, r.declaredIn]), ['/', '/welcome', '*'].map(p => [p, 'src/Welcome.tsx', 'src/router.tsx']))
  assert.equal(inventory.routes[0].line, 4)
  assert.ok(inventory.evidence.every(item => item.matchesIndex && /^[a-f0-9]{64}$/.test(item.sha256)))
  assert.equal(f.scan().inventory.revision, inventory.revision)
  assert.deepEqual(f.last().lastGood, inventory)
  assert.equal(f.git('status', '--short').toString(), '')
  assert.ok(!JSON.stringify(first).includes(f.root))
})

test('dirty tracked and staged rename evidence uses working paths; an untracked source is never accepted', t => {
  const f = fixture(t)
  const original = f.scan().inventory
  f.put('src/Welcome.tsx', 'export const Page = () => <article />')
  const dirty = f.scan().inventory
  assert.notEqual(dirty.revision, original.revision)
  assert.equal(dirty.evidence.find(item => item.path === 'src/Welcome.tsx').matchesIndex, false)
  f.git('mv', 'src/Welcome.tsx', 'src/Renamed.tsx')
  f.put('src/router.tsx', router('Renamed'))
  const renamed = f.scan().inventory
  assert.ok(renamed.routes.every(row => row.source === 'src/Renamed.tsx'))
  renameSync(join(f.root, 'src/Renamed.tsx'), join(f.root, 'src/Untracked.tsx'))
  f.put('src/router.tsx', router('Untracked'))
  assert.equal(f.scan().status, 'incomplete')
  assert.equal(f.last().lastGood.revision, renamed.revision)
})

test('a conventional entry is labeled inferred; incomplete router declarations and unsupported projects preserve prior bytes', t => {
  const f = fixture(t)
  f.git('rm', 'index.html')
  f.git('mv', 'src/start.tsx', 'src/main.tsx')
  const accepted = f.scan().inventory
  assert.deepEqual(accepted.entryPoints, [{ state: 'inferred', source: 'src/main.tsx', basis: 'vite-entry-convention' }])
  const stored = join(f.root, '.git', 'systemx-repository-inventory', 'last-good.json')
  const baseline = readFileSync(stored)
  f.put('src/router.tsx', router('Welcome').replace("case '/welcome'", "case makeRuntimePath()"))
  const partial = f.scan()
  assert.equal(partial.status, 'incomplete')
  assert.ok(partial.inventory.findings.some(row => row.state === 'unresolved' && row.path === 'src/router.tsx'))
  assert.equal(partial.lastGoodRevision, accepted.revision)
  assert.deepEqual(readFileSync(stored), baseline)
  f.put('package.json', '{"dependencies":{"unsupported-engine":"1"}}')
  assert.deepEqual([f.scan().code, f.scan().lastGoodRevision], ['unsupported-stack', accepted.revision])
  assert.deepEqual(readFileSync(stored), baseline)
})

test('private, symlinked, oversized and untracked targets never replace the last accepted routes or expose their contents', t => {
  const f = fixture(t)
  const original = f.scan().inventory
  f.put('src/private/secrets.tsx', "throw 'PRIVATE_VALUE_CANARY'")
  f.git('add', '-f', 'src/private/secrets.tsx')
  f.put('index.html', script('/src/private/secrets.tsx'))
  const privateScan = f.scan()
  assert.equal(privateScan.status, 'incomplete')
  assert.doesNotMatch(JSON.stringify(privateScan), /PRIVATE_VALUE_CANARY|secrets\.tsx/)
  f.put('index.html', script('/src/start.tsx'))
  unlinkSync(join(f.root, 'src/Welcome.tsx'))
  symlinkSync('private/secrets.tsx', join(f.root, 'src/Welcome.tsx'))
  assert.equal(f.scan().status, 'incomplete')
  f.git('add', 'src/Welcome.tsx')
  assert.equal(f.scan().inventory.exclusions.nonregularIndex, 1)
  assert.equal(f.last().lastGood.revision, original.revision)
  f.put('src/router.tsx', 'x'.repeat(inventoryLimits.sourceBytes + 1))
  assert.equal(f.scan().status, 'refused')
  assert.equal(f.last().lastGood.revision, original.revision)
})

test('flat React Router declarations use the imported module and retain a dynamic or nested declaration as unresolved', t => {
  const f = fixture(t)
  f.put('src/router.tsx', `import { Route as R, Routes } from 'react-router-dom'
import { Page } from './Welcome'
export function App() { return <Routes>
  <R path="/item/:id" element={<Page/>} />
  <R path={runtimePath()} element={<Page/>} />
  <R path="/nested"><R path="child" element={<Page/>} /></R>
</Routes> }`)
  const scan = f.scan()
  assert.equal(scan.status, 'incomplete')
  assert.deepEqual(scan.inventory.routes.map(row => row.pattern), ['/item/:id'])
  assert.deepEqual(new Set(scan.inventory.findings.map(item => item.code)), new Set(['dynamic-route-pattern', 'nested-route-declaration']))
})

test('explicit Vite inputs override the default page; a dynamic input never silently falls back to index.html', t => {
  const f = fixture(t)
  f.put('custom.html', script('/src/start.tsx'))
  f.put('vite.config.ts', "import { defineConfig } from 'vite'\nexport default defineConfig({build:{rollupOptions:{input:{app:'custom.html'}}}})")
  f.git('add', 'vite.config.ts', 'custom.html')
  const original = f.scan()
  assert.equal(original.status, 'accepted')
  assert.deepEqual(original.inventory.entryPoints[0], { state:'explicit', source:'src/start.tsx', declaredIn:'custom.html', line:1, configuration:{path:'vite.config.ts', line:2} })
  f.put('vite.config.ts', 'export default {build:{rollupOptions:{input: getUserSetting()}}}')
  const partial = f.scan()
  assert.equal(partial.status, 'incomplete')
  assert.deepEqual(partial.inventory.entryPoints, [])
  assert.equal(partial.lastGoodRevision, original.inventory.revision)
})

test('the actual operator CLI retrieves an atomic retained snapshot; even a rehashed corrupt cache cannot inject private output', t => {
  const f = fixture(t)
  const command = fileURLToPath(new URL('../../scripts/lan-repository-inventory.mjs', import.meta.url))
  const cli = action => JSON.parse(execFileSync(process.execPath, [command, action, '--root', f.root], { encoding: 'utf8' }))
  assert.equal(cli('last-good').status, 'empty')
  const accepted = cli('scan').inventory
  assert.deepEqual(cli('last-good').lastGood, accepted)
  const cached = join(f.root, '.git', 'systemx-repository-inventory', 'last-good.json')
  const { revision, ...unsafe } = accepted
  unsafe.routes[0].source = '/private/PRIVATE_CACHE_CANARY'
  const substituted = { ...unsafe, revision: createHash('sha256').update(JSON.stringify(unsafe)).digest('hex') }
  assert.notEqual(substituted.revision, revision)
  writeFileSync(cached, JSON.stringify(substituted))
  assert.equal(f.last().code, 'invalid-retained-inventory')
  assert.doesNotMatch(JSON.stringify(f.last()), /PRIVATE_CACHE_CANARY/)
})
