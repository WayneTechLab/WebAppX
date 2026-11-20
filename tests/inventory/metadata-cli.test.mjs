import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../scripts/lan-repository-inventory.mjs', import.meta.url))
const page = 'src/Welcome.tsx', asset = 'public/images/icon.svg'
const marker = '.SYSTEMX/.systemx/releases/1.0.0/STANDARD.md'

test('operator CLI exports a bounded v4 inventory and revalidates selected declarations without promoting changed scans', t => {
  const root = mkdtempSync(join(tmpdir(), 'webappx-metadata-command-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  function put(file, text) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  function git(...args) { execFileSync('git', args, { cwd: root, stdio: 'pipe' }) }
  function run(action, ...flags) {
    const call = spawnSync(process.execPath, [cli, action, '--root', root, ...flags], { encoding: 'utf8', maxBuffer: 2_000_000, timeout: 30_000 })
    assert.ifError(call.error)
    assert.ok(call.stdout, call.stderr || action)
    const result = JSON.parse(call.stdout)
    assert.equal(call.status, ['refused','incomplete'].includes(result.status) ? 1 : 0, action)
    return result
  }
  git('init','-q')
  git('config','user.email','fixture@example.invalid')
  git('config','user.name','Inventory fixture')
  put('package.json', JSON.stringify({ devDependencies: { vite: '1' } }))
  put('index.html','<script type="module" src="/src/main.tsx"></script>')
  put('src/main.tsx', "import { renderPage as Router } from './router'\nexport const App = () => <Router />")
  const router = target => `import { Page } from './Welcome'
export function renderPage(pathname) { switch(pathname) { case '${target}': return <Page />; default: return <Page /> } }`
  put('src/router.tsx',router('/'))
  put(page,'export const Page = () => <main/> // SOURCE_BODY_FIXTURE')
  put('src/Other.tsx','export const Other = () => <aside/>')
  put(asset,'<svg>ASSET_BODY_FIXTURE</svg>')
  put('.SYSTEMX/LAN/Builder/contracts/capability-manifest.json','{"sample":"HOST_CONTENT_FIXTURE"}')
  put(marker,'MANAGED_BODY_FIXTURE')
  put('public/private/portrait.svg','PRIVATE_ASSET_FIXTURE')
  git('add','-f','.')
  git('commit','--no-gpg-sign','-qm','local inventory fixture')
  const accepted = run('scan')
  assert.equal(accepted.status, 'accepted', JSON.stringify(accepted))
  assert.equal(accepted.inventory.schemaVersion, 4)
  const revision = accepted.inventory.revision
  const exported = run('export')
  assert.equal(exported.status, 'exported')
  const { artifact } = exported
  assert.equal(artifact.inventoryRevision, revision)
  assert.deepEqual(artifact.resources.filter(row => row.kind === 'public-asset').map(row => [row.path, row.mediaType]), [[asset,'image/svg+xml']])
  assert.ok(artifact.resources.some(row => row.path === marker && row.owner === 'managed-release'))
  assert.ok(artifact.resources.some(row => row.owner === 'host-extension'))
  assert.doesNotMatch(JSON.stringify(artifact), /(?:ASSET|SOURCE)_BODY_FIXTURE|HOST_CONTENT_FIXTURE|MANAGED_BODY_FIXTURE|PRIVATE_ASSET_FIXTURE|private\/portrait/)
  const review = selected => run('revalidate', '--revision', revision, '--path', selected)
  assert.equal(review(page).status, 'revalidated')
  assert.equal(review(marker).code, 'ownership-review-required')
  put('src/router.tsx',router('/updated'))
  assert.equal(review(page).code, 'resource-changed-rescan-required')
  put('src/router.tsx', `import { Page } from './Welcome'
import { Other } from './Other'
export function renderPage(pathname) {
  switch (pathname) {
    case '/duplicate': return <Page />
    case '/duplicate': return <Other />
    default: return <Page />
  }
}`)
  const conflict = run('compare')
  assert.equal(conflict.status, 'incomplete', JSON.stringify(conflict))
  const competing = conflict.inventory.metadata.conflicts.filter(row => row.key === '/duplicate')
  assert.deepEqual(competing.map(row => row.kind), ['route','page'])
  assert.deepEqual(competing[0].references.map(row => [row.path,row.line,row.target]), [
    ['src/router.tsx',5,page], ['src/router.tsx',6,'src/Other.tsx'],
  ])
  assert.equal(conflict.inventory.routes.some(row => row.pattern === '/duplicate'), false)
  assert.equal(review(page).code, 'fresh-complete-comparison-required')
  assert.equal(run('export').artifact.inventoryRevision, revision)
  assert.equal(run('last-good').lastGood.revision, revision)
})

test('CLI follows the effective publicDir, excludes private names and refuses stale asset selection', t => {
  const root = mkdtempSync(join(tmpdir(), 'webappx-public-dir-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (path, contents) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), contents) }
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  const filename = 'npm_' + 'a'.repeat(30)
  const googleMarker = 'AI' + 'za' + 'a'.repeat(30)
  function run(action, ...flags) {
    const result = spawnSync(process.execPath, [cli, action, '--root', root, ...flags], { encoding: 'utf8', timeout: 30_000, maxBuffer: 2_000_000 })
    assert.ifError(result.error)
    assert.ok(result.stdout, result.stderr)
    assert.ok(!result.stdout.includes(filename) && !result.stdout.includes(googleMarker), 'Private fixture filenames must not reach CLI stdout.')
    return JSON.parse(result.stdout)
  }
  const assets = value => value.resources.filter(row => row.kind === 'public-asset').map(row => row.path)
  git('init','-q')
  git('config','user.name','Inventory fixture')
  git('config','user.email','fixture@example.invalid')
  write('package.json', '{"devDependencies":{"vite":"1"}}')
  write('index.html', '<script type="module" src="/src/main.tsx"></script>')
  write('src/main.tsx', "import {renderPage as Router} from './router'; export const App=()=> <Router />")
  write('src/router.tsx', "import {Page} from './Page'; export function renderPage(pathname){switch(pathname){case '/': return <Page/>; default: return <Page/>}}")
  write('src/Page.tsx','export const Page=()=> <main/>')
  const initial = 'public/logo.svg', shared = 'public/media/photo.webp', custom = 'static/site.svg'
  for (const path of [initial, shared, custom, 'static/robots.txt', 'static/child/robots.txt', 'static-copy/other.svg',
    'public/' + filename + '.svg', 'static/' + googleMarker + '.svg']) write(path, 'fixture only')
  write('vite.config.js','export default {}')
  git('add','-f','.')
  git('commit','--no-gpg-sign','-qm','public root fixture')
  const baseline = run('scan')
  assert.equal(baseline.status,'accepted',JSON.stringify(baseline))
  assert.deepEqual(assets(baseline.inventory.metadata), [initial,shared])
  const revision = baseline.inventory.revision
  const check = path => run('revalidate','--revision',revision,'--path',path)
  assert.equal(check(initial).status,'revalidated')
  write('vite.config.js',"export default { publicDir: 'public' }")
  assert.equal(check(initial).code,'resource-changed-rescan-required', 'Revalidate the selected asset’s publicDir declaration and source revision.')
  write('vite.config.js','export default { publicDir: false }')
  const disabled = run('compare')
  assert.equal(disabled.status,'compared',JSON.stringify(disabled))
  assert.deepEqual(assets(disabled.inventory.metadata),[])
  assert.equal(check(initial).code,'resource-changed-rescan-required')
  write('vite.config.js',"export default { publicDir: 'public/media' }")
  assert.deepEqual(assets(run('compare').inventory.metadata),[shared])
  assert.equal(check(shared).code,'resource-changed-rescan-required', 'The same physical path maps to a different public URL base.')
  write('vite.config.js',"export default { publicDir: 'static' }")
  const relocated = run('compare')
  assert.deepEqual(assets(relocated.inventory.metadata),['static/robots.txt',custom])
  assert.equal(check(initial).code,'resource-changed-rescan-required')
  assert.equal(run('export').artifact.inventoryRevision, revision)
  assert.equal(run('scan').status,'accepted')
  assert.deepEqual(assets(run('export').artifact),['static/robots.txt',custom])
  const cache = join(root,'.git/systemx-repository-inventory/last-good.json')
  const retained = readFileSync(cache,'utf8')
  assert.ok(!retained.includes(filename) && !retained.includes(googleMarker))

  // Previous v4 snapshots always classified the public/ convention, including
  // paths the current private-name policy excludes. Keep them out of readback
  // and let a successful present-day scan repair the checked cache.
  const historical = JSON.parse(retained)
  const priorAssets = baseline.inventory.metadata.resources.filter(row => row.kind === 'public-asset')
  historical.metadata.resources = historical.metadata.resources.filter(row => row.kind !== 'public-asset')
    .concat(priorAssets, { ...priorAssets[0], path:'public/' + filename + '.svg' }).sort((a,b) => a.path.localeCompare(b.path))
  historical.metadata.provenance.publicAssetScope = baseline.inventory.metadata.provenance.publicAssetScope
  delete historical.revision
  historical.revision = createHash('sha256').update(JSON.stringify(historical)).digest('hex')
  writeFileSync(cache, JSON.stringify(historical) + '\n')
  assert.equal(run('last-good').code, 'public-asset-policy-rescan-required')
  assert.equal(run('compare').code, 'public-asset-policy-rescan-required')
  const repaired = run('scan')
  assert.equal(repaired.status, 'accepted', JSON.stringify(repaired))
  assert.equal(repaired.rescanReason, 'public-asset-policy-updated')
  assert.deepEqual(assets(run('export').artifact), ['static/robots.txt',custom])
  assert.ok(!readFileSync(cache, 'utf8').includes(filename))
})
