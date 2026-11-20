import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { trackedInventory } from '../../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const pageSource = `import { Navigation } from './Chrome'
export const First = () => <main><Navigation /></main>
export default function Second() { return <main>content</main> }
export const displayValue = 'ordinary scalar'
export const LooksLikeAComponent = 42
function NeverCalled() { return <header/> }
`
const routerSource = `import { First, default as Second } from './Pages'
import { Frame } from './Frame'
function renderPage(pathname: string) {
  switch (pathname) {
    case '/first': return <First />
    default: return <Second />
  }
}
export function Router() { return <Frame>{renderPage(pathname)}</Frame> }`
const chrome = `export function Header() { return <header /> }
export const Footer = () => <footer />
export function Navigation() { return <nav /> }
export function Unused() { return <nav /> }
`

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tracked-shell-fixture-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', [...args], { cwd: root, stdio: 'pipe' })
  function put(path, text) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text) }
  git('init','-q')
  git('config','user.email','inventory@example.invalid')
  git('config','user.name','fixture')
  put('package.json','{"devDependencies":{"vite":"1"}}')
  put('index.html','<script type="module" src="/src/main.tsx"></script>')
  put('src/main.tsx', "import { createRoot } from 'react-dom/client'\nimport { Router } from './router'\ncreateRoot(node).render(<Router />)")
  put('src/router.tsx',routerSource)
  put('src/Pages.tsx',pageSource)
  put('src/Frame.tsx', "import { Header as SiteHeader, Footer } from './Chrome'\nexport function Frame({children}) {return <><SiteHeader />{children}<Footer /></>}")
  put('src/Chrome.tsx',chrome)
  git('add','.')
  git('commit','--no-gpg-sign','-qm','baseline')
  return { root, put, git, scan: () => trackedInventory(root), cache: join(root, '.git', 'systemx-repository-inventory', 'last-good.json') }
}

test('shared shell imports are traced per page; two exports in one page file do not inherit one another’s navigation', t => {
  const f = fixture(t), result = f.scan()
  assert.equal(result.status, 'accepted', JSON.stringify(result.inventory?.findings))
  const c = result.inventory.components
  assert.ok(c.exports.some(e => e.name === 'default' && e.source === 'src/Pages.tsx' && e.declarationLine === 3 && e.sourceRevision === sha(pageSource)))
  assert.ok(c.exports.some(e => e.name === 'Unused' && e.sourceRevision === sha(chrome)))
  assert.ok(!c.exports.some(e => ['NeverCalled','LooksLikeAComponent','displayValue'].includes(e.name)))
  const byName = Object.fromEntries(c.shellSources.map(s => [s.component,s]))
  assert.deepEqual(Object.keys(byName).sort(), ['Footer','Header','Navigation'])
  for (const [name,role] of [['Header','header'],['Footer','footer']]) {
    assert.equal(byName[name].roles[0].role,role)
    assert.deepEqual(byName[name].usedBy.map(u => [u.pageExport,u.patterns,u.via]), [['First',['/first'],'route-wrapper'],['default',['*'],'route-wrapper']])
    assert.ok(byName[name].usedBy.every(u => u.trace.some(s => s.source === 'src/Frame.tsx') && u.trace.some(s => s.source === 'src/router.tsx')))
  }
  assert.deepEqual(byName.Navigation.usedBy.map(u => [u.pageExport,u.patterns,u.via]), [['First',['/first'],'page-render']])
  assert.equal(f.git('status','--short').toString(), '')
})

test('flat route-container siblings are shared only by declared pages in that container', t => {
  const f = fixture(t)
  f.put('src/router.tsx', `import { Routes, Route } from 'react-router-dom'
import { First, default as Second } from './Pages'
import { Header, Footer } from './Chrome'
export function Router() { return <><header/><Header/><Routes><Route path="/a" element={<First/>}/><Route path="/b" element={<Second/>}/></Routes><Footer/></> }`)
  const scan = f.scan()
  assert.equal(scan.status,'accepted',JSON.stringify(scan.inventory?.findings))
  const header = scan.inventory.components.shellSources.find(s => s.component === 'Header')
  assert.deepEqual(header.usedBy.flatMap(u => u.patterns), ['/a','/b'])
  assert.ok(header.usedBy.every(u => u.via === 'route-sibling'))
  const inline = scan.inventory.components.shellSources.find(s => s.component === 'Router')
  assert.deepEqual(inline.roles,[{role:'header',line:4}])
  assert.ok(inline.usedBy.every(u => u.via === 'router-markup'))
})

test('tracked shell rename and unrelated dirty JSX change refresh the evidence without guessing from filenames or reading untracked candidates', t => {
  const f = fixture(t), before = f.scan().inventory
  f.git('mv','src/Chrome.tsx','src/Parts.tsx')
  f.put('src/Parts.tsx',chrome + '\n// dirty source')
  f.put('src/Frame.tsx',readFileSync(join(f.root,'src/Frame.tsx'),'utf8').replace('./Chrome','./Parts'))
  f.put('src/Pages.tsx',pageSource.replace('./Chrome','./Parts'))
  f.put('src/UntrackedNavbar.tsx','export function Leak() { return <nav/> }')
  const after = f.scan()
  assert.equal(after.status,'accepted')
  const headers = after.inventory.components.shellSources.filter(s => s.component === 'Header')
  assert.equal(headers.length,1)
  assert.equal(headers[0].source,'src/Parts.tsx')
  assert.equal(headers[0].sourceRevision,sha(chrome + '\n// dirty source'))
  assert.notEqual(after.inventory.revision,before.revision)
  assert.ok(!JSON.stringify(after.inventory).includes('UntrackedNavbar'))
})

test('unknown component creation or re-exports keep the previous complete snapshot, including v1 snapshots read by the newer tool', t => {
  const f = fixture(t), accepted = f.scan().inventory
  const { revision, components, configuration, metadata, ...oldFields } = accepted
  assert.ok(components.exports.length)
  assert.ok(configuration.dependencies.length)
  oldFields.schemaVersion = 1
  const legacy = { ...oldFields, revision: sha(JSON.stringify(oldFields)) }
  assert.notEqual(legacy.revision, revision)
  writeFileSync(f.cache, JSON.stringify(legacy))
  const old = trackedInventory(f.root, 'last-good')
  assert.deepEqual(old.lastGood, legacy)
  assert.deepEqual(old.missingCoverage, ['component-exports','shared-shell-sources','configuration','resource-metadata'])
  const bytes = readFileSync(f.cache)
  f.put('src/Chrome.tsx', chrome + "\nexport const Generated = externalFactory()\nexport * from './not-analysed'")
  const incomplete = f.scan()
  assert.equal(incomplete.status, 'incomplete')
  assert.equal(incomplete.lastGoodSchemaVersion, 1)
  assert.equal(incomplete.lastGoodRevision, legacy.revision)
  assert.deepEqual(readFileSync(f.cache), bytes)
  assert.ok(incomplete.inventory.findings.some(item => item.path === 'src/Chrome.tsx' && /component-export/.test(item.code)))
  f.put('src/Chrome.tsx',chrome)
  assert.equal(f.scan().status,'accepted')
  assert.equal(trackedInventory(f.root,'last-good').lastGood.schemaVersion,4)
})

test('retained role, path and revision evidence are validated before displaying old component metadata', t => {
  const f = fixture(t), original = f.scan().inventory
  const { revision: old, ...edited } = original
  edited.components.shellSources[0].usedBy[0].trace.push({source:'/private/CACHE_CONTENT_CANARY',line:1})
  const digest = sha(JSON.stringify(edited))
  assert.notEqual(digest, old)
  writeFileSync(f.cache, JSON.stringify({ ...edited, revision:digest }))
  const read = trackedInventory(f.root, 'last-good')
  assert.equal(read.code,'invalid-retained-inventory')
  assert.ok(!JSON.stringify(read).includes('CACHE_CONTENT_CANARY'))
})
