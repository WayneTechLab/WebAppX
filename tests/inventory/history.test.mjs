import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { compareInventories } from '../../.SYSTEMX/LAN/Builder/importer/inventory-comparison.mjs'
import { trackedInventory } from '../../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const cli = fileURLToPath(new URL('../../scripts/lan-repository-inventory.mjs', import.meta.url))
const page = 'export function Page() { return <main /> }\n'
const router = (name, route = '/hello') => `import { Page } from './${name}'
export function renderPage(pathname: string) {
  switch (pathname) {
    case '${route}': return <Page />
    default: return <Page />
  }
}`
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(),'inventory-history-'))
  t.after(() => rmSync(root,{recursive:true,force:true}))
  function put(path,text) {
    const file = join(root,path)
    mkdirSync(dirname(file),{recursive:true})
    writeFileSync(file,text)
  }
  const git = (...args) => execFileSync('git',args,{cwd:root,stdio:'pipe'}).toString().trim()
  git('init','-q')
  git('config','user.name','Inventory fixture')
  git('config','user.email','test@example.invalid')
  git('config','core.autocrlf','false')
  put('package.json','{"dependencies":{"react":"1","vite":"1"}}')
  put('index.html','<script type="module" src="/src/main.tsx"></script>')
  put('src/main.tsx',router('Page'))
  put('src/Page.tsx',page)
  put('src/tools.ts','export const id = 1\n')
  put('.gitignore','src/ignored/\n')
  git('add','.')
  git('commit','--no-gpg-sign','-qm','fixture')
  const call = (action='scan', options) => trackedInventory(root,action,options)
  const command = (...args) => {
    const result = spawnSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8'})
    assert.equal(result.stderr,'')
    return {exit:result.status, ...JSON.parse(result.stdout)}
  }
  const cache = join(root,'.git','systemx-repository-inventory','last-good.json')
  return {root,put,git,call,command,cache}
}
const zeroCounts = {added:0,removed:0,changed:0,previouslyUncovered:0,unverified:0}

test('normal CLI compares before acceptance and preserves original renamed, added, removed and changed identities', t => {
  const f = fixture(t)
  const initial = f.command('compare')
  assert.equal(initial.status,'compared')
  assert.equal(initial.lastGoodRevision,null)
  assert.ok(initial.comparison.counts.added > 0)
  assert.ok(!existsSync(dirname(f.cache)))
  const first = f.call()
  assert.equal(first.status,'accepted')
  const saved = readFileSync(f.cache)
  f.git('mv','src/Page.tsx','src/Welcome.tsx')
  f.put('src/main.tsx',router('Welcome','/welcome'))
  f.put('package.json','{"dependencies":{"react":"2","vite":"1"}}')
  const result = f.command('compare')
  assert.equal(result.exit,0)
  assert.equal(result.lastGoodRevision,first.inventory.revision)
  const delta = result.comparison
  const has = (change,kind,identity) => delta.differences.some(row => row.change===change && row.kind===kind && row.identity.includes(identity))
  assert.ok(has('added','source','src/Welcome.tsx'))
  assert.ok(has('removed','source','src/Page.tsx'))
  assert.ok(has('changed','source','src/main.tsx'))
  assert.ok(has('removed','route','/hello'))
  assert.ok(has('added','route','/welcome'))
  assert.ok(has('changed','route','*'))
  assert.ok(has('changed','dependency','react'))
  assert.ok(!has('changed','dependency','vite'))
  assert.notEqual(delta.baselineSourceRevision,delta.candidateSourceRevision)
  assert.deepEqual(readFileSync(f.cache),saved)
  assert.deepEqual(f.call().comparison,delta)
  assert.deepEqual(f.call('compare').comparison.counts,zeroCounts)
})

test('source revisions ignore presentation ordering and unrelated commit changes; older schemas distinguish absent coverage', t => {
  const f = fixture(t)
  const {inventory} = f.call()
  const reordered = structuredClone(inventory)
  for (const list of [reordered.evidence,reordered.routes,reordered.entryPoints,reordered.configuration.dependencies,reordered.components.exports]) list.reverse()
  assert.deepEqual(compareInventories(inventory,reordered).counts,zeroCounts)
  const older = { ...inventory, schemaVersion:1 }
  delete older.components
  delete older.configuration
  assert.ok(compareInventories(older,inventory).differences.some(r=>r.kind==='dependency' && r.change==='previouslyUncovered'))
  f.put('README.md','documentation')
  f.git('add','README.md')
  f.git('commit','--no-gpg-sign','-qm','docs')
  const {comparison} = f.call('compare')
  assert.notEqual(comparison.baselineRevision,comparison.candidateRevision)
  assert.equal(comparison.baselineSourceRevision,comparison.candidateSourceRevision)
  assert.deepEqual(comparison.counts,zeroCounts)
})

test('staged, unstaged and untracked are separately bounded to eligible sources, including both states on a single path', t => {
  const f = fixture(t)
  const baseline = f.call()
  f.put('src/Page.tsx',page.replace('main','header'))
  f.git('add','src/Page.tsx')
  f.put('src/Page.tsx',page.replace('main','footer'))
  f.put('src/Untracked.tsx','UNTRACKED_SECRET_CONTENT'.repeat(20000))
  f.put('src/ignored/Never.tsx','ignored')
  f.put('src/vendor/sdk/Vendor.tsx','never')
  f.put('src/privateKey.tsx','never')
  symlinkSync(f.root,join(f.root,'src','Loop'),'dir')
  const result = f.command('compare')
  assert.equal(result.status,'compared')
  assert.equal(result.inventory.commit,baseline.inventory.commit)
  const state = result.workingState
  assert.deepEqual(state.staged.rows,[{path:'src/Page.tsx',status:'modified'}])
  assert.deepEqual(state.unstaged.rows,[{path:'src/Page.tsx',status:'modified'}])
  assert.deepEqual(state.untracked.rows,['src/Untracked.tsx'])
  assert.ok(state.exclusions.ignoredUntracked && state.exclusions.linkedEntries && state.exclusions.prunedDirectories)
  assert.ok(!result.inventory.evidence.some(e=>e.path.includes('Untracked')))
  assert.doesNotMatch(JSON.stringify(result),/UNTRACKED_SECRET_CONTENT|Never\.tsx|Vendor\.tsx|privateKey\.tsx/)
})

test('line ending conversion retains exact source digest and avoids false unstaged changes', t => {
  const f = fixture(t)
  f.put('.gitattributes','*.tsx text eol=crlf\n')
  f.git('add','.gitattributes')
  const original = f.call()
  f.put('src/Page.tsx',page.replace(/\n/g,'\r\n'))
  const result = f.call('compare')
  assert.equal(result.status,'compared')
  assert.deepEqual(result.workingState.unstaged.rows,[])
  assert.notEqual(original.comparison.candidateSourceRevision,result.comparison.candidateSourceRevision)
  assert.equal(result.inventory.evidence.find(e=>e.path==='src/Page.tsx').matchesIndex,false)
})

test('partial scans retain accepted bytes and classify missing resources as unverified', t => {
  const f = fixture(t)
  const first = f.call()
  const before = readFileSync(f.cache)
  f.put('src/main.tsx',router('Page').replace("case '/hello'","case runtimePath()"))
  unlinkSync(join(f.root,'src','tools.ts'))
  const result = f.command('scan')
  assert.equal(result.status,'incomplete')
  assert.equal(result.exit,1)
  assert.equal(result.lastGoodRevision,first.inventory.revision)
  assert.ok(result.comparison.differences.some(row=>row.kind==='route' && row.change==='unverified' && row.identity[0]==='/hello'))
  assert.ok(result.workingState.unstaged.rows.some(row=>row.path==='src/tools.ts' && row.status==='deleted'))
  assert.equal(result.comparison.counts.removed,0)
  assert.deepEqual(readFileSync(f.cache),before)
  const unsupportedManifest = '{"dependencies":{"next":"1","fake_credential_DO_NOT_EXPORT":"https://private.example.invalid/"}}'
  f.put('package.json',unsupportedManifest)
  const refused = f.command('scan')
  assert.equal(refused.code,'unsupported-stack')
  assert.equal(refused.capabilities.stack,'next')
  assert.ok(refused.capabilities.available.includes('tracked-index'))
  assert.ok(refused.capabilities.missing.includes('supported-entry-and-route-adapter'))
  assert.equal(refused.capabilities.evidence.length,1)
  assert.doesNotMatch(JSON.stringify(refused),/DO_NOT_EXPORT|private\.example/)
  assert.equal(readFileSync(join(f.root,'package.json'),'utf8'),unsupportedManifest)
  assert.deepEqual(readFileSync(f.cache),before)
})

test('elapsed, file and directory limits reject candidates while preserving the same accepted cache', t => {
  const f = fixture(t)
  f.call()
  const bytes = readFileSync(f.cache)
  const timed = f.command('compare','--budget-ms','1')
  assert.equal(timed.code,'elapsed-budget')
  assert.equal(timed.work.limits.elapsedMs,1)
  f.put('src/tools.ts','x'.repeat(256001))
  assert.equal(f.call('compare').code,'linked-or-oversized-file')
  f.put('src/tools.ts','export const id = 1\n')
  let deep = 'src'
  for (let i=0;i<20;i++) deep += '/sub'
  f.put(deep+'/Leaf.tsx',page)
  const limited = f.call()
  assert.equal(limited.code,'directory-depth-budget')
  assert.ok(limited.work.spent.directories > 0)
  assert.deepEqual(readFileSync(f.cache),bytes)
})
