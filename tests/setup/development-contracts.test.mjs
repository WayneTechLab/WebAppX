import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import test from 'node:test'
import { checkDevelopmentContracts, checkEnvironmentCoverage, checkRuntimeDeclarations } from '../../scripts/check-development-contracts.mjs'

const starter = '.SYSTEMX/Template/starter'
const runtime = () => ({
  rootPackage: { engines: { node: '>=24.0.0' }, packageManager: 'npm@11.11.0' },
  starterPackage: { engines: { node: '>=24.0.0' }, packageManager: 'npm@11.11.0' },
  rootLock: { packages: { '': { engines: { node: '>=24.0.0' } } } },
  starterLock: { packages: { '': { engines: { node: '>=24.0.0' } } } },
  pins: Object.fromEntries(['.nvmrc', '.node-version', `${starter}/.nvmrc`, `${starter}/.node-version`].map(name => [name, '24.22.0\n'])),
})
const environment = () => ({
  example: '# Public example only\nVITE_FIREBASE_PROJECT_ID=example\n# @optional VITE_STRIPE_PUBLISHABLE_KEY\n# @optional VITE_STRIPE_PRICE_*\n',
  declarations: 'interface ImportMetaEnv { readonly VITE_FIREBASE_PROJECT_ID?: string }',
  sources: [{ name: 'src/config.ts', text: 'const id = import.meta.env.VITE_FIREBASE_PROJECT_ID' }],
  documents: [{ name: 'docs/setup.md', text: 'Configure VITE_FIREBASE_*; optional extension VITE_STRIPE_PUBLISHABLE_KEY and VITE_STRIPE_PRICE_PLAN.' }],
})

test('root and starter exact runtime declarations and pins agree', () => assert.deepEqual(checkRuntimeDeclarations(runtime()), []))

test('reports engine mismatches including an extra starter engine', () => {
  const fixture = runtime()
  fixture.starterPackage.engines.npm = '>=12'
  assert.ok(checkRuntimeDeclarations(fixture).includes('Root and starter engines declarations differ.'))
})

test('reports absent declarations and nonexact package-manager pins', () => {
  const fixture = runtime()
  delete fixture.rootPackage.engines
  fixture.starterPackage.packageManager = 'npm@latest'
  const errors = checkRuntimeDeclarations(fixture)
  assert.ok(errors.some(error => error.includes('declare engines.node')))
  assert.ok(errors.some(error => error.includes('exact npm version')))
  assert.ok(errors.some(error => error.includes('packageManager declarations differ')))
})

test('reports package lock runtime drift', () => {
  const fixture = runtime()
  delete fixture.starterLock.packages[''].engines
  assert.ok(checkRuntimeDeclarations(fixture).some(error => error.includes('starter: package-lock root engines differ')))
})

test('rejects missing, floating and divergent Node pins', () => {
  for (const value of [undefined, '24', 'lts/*', '24.22.1', '24.22.0-rc.1']) {
    const fixture = runtime()
    fixture.pins[`${starter}/.nvmrc`] = value
    assert.ok(checkRuntimeDeclarations(fixture).length > 0, `must reject ${value}`)
  }
})

test('rejects runtime pin older than minimum and unreviewed range policy', () => {
  const fixture = runtime()
  for (const name of Object.keys(fixture.pins)) fixture.pins[name] = '22.15.0'
  assert.ok(checkRuntimeDeclarations(fixture).some(error => error.includes('older than engines.node')))
  fixture.rootPackage.engines.node = '^24'
  assert.ok(checkRuntimeDeclarations(fixture).some(error => error.includes('documented >=major.minor.patch')))
})

test('rejects matching root/starter declarations that drift from the prerequisite doctor', () => {
  const fixture = runtime()
  for (const manifest of [fixture.rootPackage, fixture.starterPackage]) manifest.engines.node = '>=26.0.0'
  assert.ok(checkRuntimeDeclarations(fixture).includes('engines.node differs from the prerequisite doctor minimum.'))
})

test('client environment names are covered by assignments or explicit optional markers', () => {
  const report = checkEnvironmentCoverage(environment())
  assert.deepEqual(report.errors, [])
  assert.deepEqual([report.exampleCount, report.optionalCount, report.declarationCount], [1, 2, 1])
})

test('catches documented environment names missing from the public example', () => {
  const fixture = environment()
  fixture.documents.push({ name: 'wiki/new.md', text: 'VITE_NEW_CLIENT_SETTING' })
  assert.ok(checkEnvironmentCoverage(fixture).errors.some(error => error.includes('wiki/new.md: documented VITE_NEW_CLIENT_SETTING')))
})

test('catches client source access missing a type and an example', () => {
  const fixture = environment()
  fixture.sources[0].text += '\nconst port = import.meta.env.VITE_FIREBASE_PORT'
  const errors = checkEnvironmentCoverage(fixture).errors
  assert.ok(errors.some(error => error.includes('VITE_FIREBASE_PORT has no ImportMetaEnv declaration')))
  assert.ok(errors.some(error => error.includes('VITE_FIREBASE_PORT is missing from .env.example')))
})

test('optional TypeScript property alone does not silently excuse example drift', () => {
  const fixture = environment()
  fixture.declarations += '\nreadonly VITE_UNDOCUMENTED?: string'
  assert.ok(checkEnvironmentCoverage(fixture).errors.some(error => error.includes('VITE_UNDOCUMENTED is missing')))
})

test('unmarked examples in comments do not count as optional declarations', () => {
  const fixture = environment()
  fixture.example = fixture.example.replace('# @optional VITE_STRIPE_PUBLISHABLE_KEY', '# Optional someday VITE_STRIPE_PUBLISHABLE_KEY')
  assert.ok(checkEnvironmentCoverage(fixture).errors.some(error => error.includes('VITE_STRIPE_PUBLISHABLE_KEY is missing')))
})

test('coverage output contains names and diagnostics, never example values', () => {
  const fixture = environment()
  fixture.example = fixture.example.replace('=example', '=do-not-echo-this-placeholder')
  assert.equal(JSON.stringify(checkEnvironmentCoverage(fixture)).includes('do-not-echo-this-placeholder'), false)
})

function temporaryContractFixture() {
  const root = mkdtempSync(join(tmpdir(), 'webappx-contracts-'))
  const write = (name, value) => {
    mkdirSync(join(root, name, '..'), { recursive: true })
    writeFileSync(join(root, name), typeof value === 'object' ? JSON.stringify(value) : value)
  }
  const fixture = runtime()
  write('package.json', fixture.rootPackage)
  write(`${starter}/package.json`, fixture.starterPackage)
  write('package-lock.json', fixture.rootLock)
  write(`${starter}/package-lock.json`, fixture.starterLock)
  for (const [name, value] of Object.entries(fixture.pins)) write(name, value)
  for (const prefix of ['', `${starter}/`]) {
    write(`${prefix}.env.example`, environment().example)
    write(`${prefix}src/vite-env.d.ts`, environment().declarations)
    write(`${prefix}README.md`, 'Public template setup')
  }
  mkdirSync(join(root, 'docs'))
  mkdirSync(join(root, 'wiki'))
  write('.env.local', 'SECRET=never-read-this-local-secret\n')
  write('.secrets.env', 'SECRET=never-read-this-other-secret\n')
  write(`${starter}/.env.local`, 'SECRET=never-read-this-starter-secret\n')
  return root
}

test('filesystem check never reads local env files, secret stores or process environment', () => {
  const root = temporaryContractFixture()
  const reads = []
  try {
    const report = checkDevelopmentContracts(root, { readText: path => {
      const name = relative(root, path).replaceAll('\\', '/')
      reads.push(name)
      assert.equal(name.endsWith('.env.local') || name.endsWith('.secrets.env'), false)
      return readFileSync(path, 'utf8')
    } })
    assert.equal(report.ok, true, JSON.stringify(report.errors))
    assert.ok(reads.includes('.env.example'))
    assert.ok(reads.includes(`${starter}/.env.example`))
    assert.equal(JSON.stringify(report).includes('never-read'), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('missing public files fail closed with sanitized diagnostics', () => {
  const root = temporaryContractFixture()
  try {
    rmSync(join(root, '.nvmrc'))
    const report = checkDevelopmentContracts(root)
    assert.equal(report.ok, false)
    assert.ok(report.errors.some(error => error.startsWith('Runtime contract files are missing')))
    assert.equal(JSON.stringify(report).includes(root), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
