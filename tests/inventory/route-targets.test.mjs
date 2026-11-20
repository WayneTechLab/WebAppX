import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspectDeclaredRoutes } from '../../.SYSTEMX/LAN/Builder/importer/declared-routes.mjs'

const ts = createRequire(import.meta.url)('typescript')
const router = children => `import { Routes as Definitions, Route as R, Navigate as Redirect, Link } from 'react-router-dom'
import Person, { Directory as People, Directory as article } from './Pages'
export function Router() {
  return <Definitions>
${children}
  </Definitions>
}`

function inspect(children) {
  const rows = [], findings = []
  inspectDeclaredRoutes({ sourcePath: 'src/router.tsx', source: router(children), ts,
    resolveImport: specifier => specifier === './Pages' ? 'src/Pages.tsx' : null,
    route: row => rows.push(row), unresolved: finding => findings.push(finding) })
  return { rows, findings }
}

test('flat route targets preserve the exact imported export for JSX elements and component values', () => {
  const { rows, findings } = inspect([
    '<R path="/one" Component={Person}/>',
    '<R path="/people" Component={(People)}/>',
    '<R path="/also-people" element={(<People/>)}/>',
    '<R path="/value" Component={article}/>',
  ].join('\n'))
  assert.deepEqual(findings, [])
  assert.deepEqual(rows.map(({ pattern, exportName, source, line }) => [pattern, exportName, source, line]), [
    ['/one', 'default', 'src/Pages.tsx', 5], ['/people', 'Directory', 'src/Pages.tsx', 6],
    ['/also-people', 'Directory', 'src/Pages.tsx', 7], ['/value', 'Directory', 'src/Pages.tsx', 8],
  ])
})

test('both target orders, duplicate attributes and spreads in any position leave the target unresolved', () => {
  const conflicting = [
    'path="/a" element={<Person/>} Component={People}', 'path="/b" Component={People} element={<Person/>}',
    'path="/c" element={<Person/>} element={<People/>}', 'path="/d" Component={Person} Component={People}',
    'path="/e" path="/alias" Component={Person}', '{...props} path="/f" element={<Person/>}',
    'path="/g" {...props} Component={People}', 'path="/h" element={<Person/>} {...props}',
    'path="/i" caseSensitive caseSensitive element={<Person/>}', 'element Component={People} path="/j"',
  ]
  const { rows, findings } = inspect(conflicting.map(attrs => `<R ${attrs}/>`).join('\n'))
  assert.deepEqual(rows, [])
  assert.deepEqual(findings, conflicting.map((_, index) => ({ code: 'ambiguous-route-branch', line: index + 5 })))
})

test('intrinsics, navigation and computed targets cannot supply authored page modules or route aliases', () => {
  const { rows, findings } = inspect([
    '<R path="/native" element={<article/>}/>', '<R path="/anchor" element={<a href="/not-a-route"/>}/>',
    '<R path="/redirect" element={<Redirect to="/not-declared"/>}/>', '<R path="/link" Component={Link}/>',
    '<R path="/choice" Component={flag ? Person : People}/>', '<R path="/jsx" Component={<People/>}/>',
    '<R path="/factory" Component={pickPage()}/>', '<Link to="/menu-alias"/>',
  ].join('\n'))
  assert.deepEqual(rows, [])
  assert.deepEqual(findings.map(finding => finding.code), [...Array(7).fill('unresolved-route-module'), 'dynamic-route-dispatch'])
})

test('operator scan of a conflicting route returns incomplete and keeps the last accepted inventory byte for byte', t => {
  const root = mkdtempSync(join(tmpdir(), 'lan-route-targets-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', [...args], { cwd: root, stdio: 'pipe' })
  const cliPath = fileURLToPath(new URL('../../scripts/lan-repository-inventory.mjs', import.meta.url))
  function cli(action, expectedStatus = 0) {
    let output
    try {
      output = execFileSync(process.execPath, [cliPath, action, '--root', root], { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      assert.equal(error.status, expectedStatus)
      return JSON.parse(error.stdout)
    }
    assert.equal(expectedStatus, 0)
    return JSON.parse(output)
  }
  git('init', '-q')
  git('config', 'user.email', 'inventory@example.invalid')
  git('config', 'user.name', 'Inventory fixture')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'package.json'), '{"devDependencies":{"vite":"1"}}')
  writeFileSync(join(root, 'index.html'), '<script type="module" src="/src/main.tsx"></script>')
  writeFileSync(join(root, 'src/main.tsx'), "import { createRoot } from 'react-dom/client'; import { Router } from './router'; createRoot(node).render(<Router/>)")
  writeFileSync(join(root, 'src/Pages.tsx'), 'export default function Person(){return <main/>}; export function Directory(){return <main/>}')
  const routerPath = join(root, 'src/router.tsx')
  writeFileSync(routerPath, router('<R path="/people" Component={People}/>'))
  git('add', '.')
  git('commit', '--no-gpg-sign', '-qm', 'fixture')
  const good = cli('scan')
  assert.equal(good.status, 'accepted', JSON.stringify(good))
  assert.deepEqual(good.inventory.routes.map(row => row.pattern), ['/people'])
  const cache = join(root, '.git/systemx-repository-inventory/last-good.json')
  const previousBytes = readFileSync(cache)
  writeFileSync(routerPath, router('<R path="/people" element={<Person/>} Component={People}/>'))
  const partial = cli('scan', 1)
  assert.equal(partial.status, 'incomplete')
  assert.deepEqual(partial.inventory.routes, [])
  assert.ok(partial.inventory.findings.some(row => row.code === 'ambiguous-route-branch' && row.path === 'src/router.tsx' && row.line === 5))
  assert.equal(partial.lastGoodRevision, good.inventory.revision)
  assert.deepEqual(readFileSync(cache), previousBytes)
  assert.deepEqual(cli('last-good').lastGood, good.inventory)
})
