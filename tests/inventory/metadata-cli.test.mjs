import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  assert.equal(run('export').artifact.inventoryRevision, revision)
  assert.equal(run('last-good').lastGood.revision, revision)
})
