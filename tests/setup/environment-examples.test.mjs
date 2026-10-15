import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkEnvironmentDeclarations, checkEnvironmentExample, checkEnvironmentExamples, checkEnvironmentSchema, environmentContractFiles } from '../../scripts/check-environment-examples.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const starter = '.SYSTEMX/Template/starter'
const schemaName = 'docs/environment-config.schema.json'
// Independent read boundary: production allowlist changes require explicit test review.
const expectedContractFiles = [
  'docs/environment-config.schema.json',
  '.env.example',
  'src/vite-env.d.ts',
  '.SYSTEMX/Template/starter/.env.example',
  '.SYSTEMX/Template/starter/src/vite-env.d.ts',
  'docs/GUSTO-FIREBASE.md',
]
const markerText = '# @optional VITE_STRIPE_PUBLISHABLE_KEY\n# @optional VITE_STRIPE_PRICE_*\n'
const declarations = 'interface ImportMetaEnv {\n  readonly VITE_FIREBASE_PROJECT_ID: string\n}\n'
const example = 'VITE_FIREBASE_PROJECT_ID=your-project\nSMTP_PASSWORD=replace-with-secret-store-value\n' + markerText
const descriptor = (classification, sensitivity, consumer, declaredIn, values = ['']) => ({
  type: 'string', enum: values, 'x-classification': classification, 'x-sensitivity': sensitivity,
  'x-consumer': consumer, 'x-declared-in': declaredIn,
})
const fixtureSchema = () => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object', additionalProperties: false,
  properties: {
    VITE_FIREBASE_PROJECT_ID: descriptor('public-browser', 'public', 'browser', ['root', 'starter'], ['', 'your-project']),
    VITE_STRIPE_PUBLISHABLE_KEY: descriptor('public-browser', 'public', 'optional-extension', [], ['', 'pk_test_example']),
    SMTP_PASSWORD: descriptor('server-only', 'secret', 'server', [], ['', 'replace-with-secret-store-value']),
    GUSTO_MODE: descriptor('server-only', 'private-setting', 'server', [], ['', 'disabled']),
  },
  patternProperties: {
    '^VITE_STRIPE_PRICE_[A-Z][A-Z0-9_]*$': descriptor('public-browser', 'public', 'optional-extension', [], ['', 'price_example']),
  },
  'x-webappx': {
    version: 1,
    profiles: [
      { id: 'root', example: '.env.example', declarations: 'src/vite-env.d.ts', required: ['VITE_FIREBASE_PROJECT_ID', 'SMTP_PASSWORD'] },
      { id: 'starter', example: starter + '/.env.example', declarations: starter + '/src/vite-env.d.ts', required: ['VITE_FIREBASE_PROJECT_ID', 'SMTP_PASSWORD'] },
    ],
    optionalMarkers: ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_STRIPE_PRICE_*'],
    serverDocumentation: { path: 'docs/GUSTO-FIREBASE.md', keys: ['GUSTO_MODE'] },
  },
})
const checkExample = (text, schema = fixtureSchema()) => checkEnvironmentExample({
  id: 'root', example: text, schema, required: ['VITE_FIREBASE_PROJECT_ID', 'SMTP_PASSWORD'],
})
const write = (root, name, value) => {
  mkdirSync(dirname(join(root, name)), { recursive: true })
  writeFileSync(join(root, name), typeof value === 'string' ? value : JSON.stringify(value))
}
function temporaryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'webappx-environment-examples-'))
  write(root, schemaName, fixtureSchema())
  for (const prefix of ['', starter + '/']) {
    write(root, prefix + '.env.example', example)
    write(root, prefix + 'src/vite-env.d.ts', declarations)
  }
  write(root, 'docs/GUSTO-FIREBASE.md', 'Server-only GUSTO_MODE remains disabled.\n')
  return root
}

test('independent schema fixture identifies browser fields, server secrets and blank placeholders', () => {
  assert.deepEqual(checkEnvironmentSchema(fixtureSchema()), [])
  assert.deepEqual(checkExample(example).errors, [])
  const blank = 'VITE_FIREBASE_PROJECT_ID=\nSMTP_PASSWORD=""\n' + markerText
  assert.deepEqual(checkExample(blank).errors, [])
})

test('optional publishable key and concrete Stripe price family keys use reviewed placeholders', () => {
  const report = checkExample(example + 'VITE_STRIPE_PUBLISHABLE_KEY=pk_test_example\nVITE_STRIPE_PRICE_PLAN=price_example\n')
  assert.deepEqual(report.errors, [])
  assert.ok(report.assignments.some(entry => entry.name === 'VITE_STRIPE_PRICE_PLAN' && entry.classification === 'public-browser'))
})

test('unknown browser and server keys fail without printing their values', () => {
  const report = checkExample(example + 'VITE_UNREVIEWED=do-not-echo-this-value\nUNREVIEWED_SETTING=another-private-looking-value\n')
  assert.ok(report.errors.some(error => error.includes('VITE_UNREVIEWED has no reviewed public-browser')))
  assert.ok(report.errors.some(error => error.includes('UNREVIEWED_SETTING has no reviewed server-only')))
  assert.equal(JSON.stringify(report).includes('do-not-echo'), false)
  assert.equal(JSON.stringify(report).includes('private-looking'), false)
})

test('missing mandatory fixture keys fail even when a runtime field could be optional', () => {
  const report = checkExample('VITE_FIREBASE_PROJECT_ID=\n' + markerText)
  assert.ok(report.errors.includes('root: missing mandatory fixture key SMTP_PASSWORD.'))
})

test('duplicate assignments fail rather than silently taking the last placeholder', () => {
  assert.ok(checkExample(example + 'SMTP_PASSWORD=\n').errors.includes('root: duplicate assignment SMTP_PASSWORD.'))
})

test('unsupported syntax and unbalanced quotes produce line or key diagnostics only', () => {
  const report = checkExample(example + 'export VALUE=never-echo-syntax\nVITE_STRIPE_PUBLISHABLE_KEY="never-echo-quote\n')
  assert.ok(report.errors.some(error => error.includes('not a supported example assignment')))
  assert.ok(report.errors.some(error => error.includes('invalid quoted example placeholder')))
  assert.equal(JSON.stringify(report).includes('never-echo'), false)
})

test('unreviewed placeholders are rejected and never copied into reports', () => {
  const report = checkExample('VITE_FIREBASE_PROJECT_ID=never-echo-live-project\nSMTP_PASSWORD=never-echo-live-password\n' + markerText)
  assert.equal(report.errors.filter(error => error.includes('reviewed example placeholder or blank')).length, 2)
  assert.equal(JSON.stringify(report).includes('never-echo'), false)
})

test('optional markers must be explicit, reviewed and unique', () => {
  for (const text of [
    example.replace('# @optional VITE_STRIPE_PRICE_*', '# Optional VITE_STRIPE_PRICE_*'),
    example.replace('VITE_STRIPE_PRICE_*', 'VITE_UNKNOWN_*'),
    example.replace('VITE_STRIPE_PRICE_*', 'VITE_STRIPE_PRICE_**'),
    example + '# @optional VITE_STRIPE_PRICE_*\n',
  ]) assert.ok(checkExample(text).errors.length > 0)
})

test('reserved server and secret patterns are refused under VITE_', () => {
  for (const name of [
    'VITE_SMTP_PASSWORD', 'VITE_SMTP_HOST', 'VITE_SENDER_EMAIL', 'VITE_GUSTO_MODE',
    'VITE_GUSTO_CLIENT_SECRET', 'VITE_GUSTO_WEBHOOK_VERIFICATION_TOKEN',
    'VITE_SYSTEMX_GOOGLE_FONTS_API_KEY', 'VITE_OPENAI_API_KEY',
    'VITE_STRIPE_SECRET_KEY', 'VITE_APP_ACCESS_TOKEN', 'VITE_APP_REFRESH_TOKEN',
    'VITE_FIREBASE_ADMIN_PRIVATE_KEY', 'VITE_GOOGLE_APPLICATION_CREDENTIALS',
  ]) {
    assert.ok(checkExample(example + name + '=\n').errors.some(error => error.includes('reserved server or secret name')), name)
    const schema = fixtureSchema()
    schema.properties[name] = descriptor('public-browser', 'public', 'optional-extension', [])
    assert.ok(checkEnvironmentSchema(schema).some(error => error.includes('prefix boundary')), name)
  }
})

test('malformed classification and exposure combinations fail closed', () => {
  for (const change of [
    entry => { entry['x-classification'] = 'never-echo-malformed-category' },
    entry => { entry['x-sensitivity'] = 'secret' },
    entry => { entry['x-consumer'] = 'server' },
    entry => { entry['x-declared-in'] = 'root' },
  ]) {
    const schema = fixtureSchema()
    change(schema.properties.VITE_FIREBASE_PROJECT_ID)
    const errors = checkEnvironmentSchema(schema)
    assert.ok(errors.length > 0)
    assert.equal(JSON.stringify(errors).includes('never-echo'), false)
  }
  const schema = fixtureSchema()
  schema.properties.VITE_PRIVATE_SETTING = descriptor('server-only', 'private-setting', 'server', [])
  assert.ok(checkEnvironmentSchema(schema).some(error => error.includes('prefix boundary')))
  const mislabeledSecret = fixtureSchema()
  mislabeledSecret.properties.SMTP_PASSWORD['x-sensitivity'] = 'private-setting'
  assert.ok(checkEnvironmentSchema(mislabeledSecret).some(error => error.includes('requires server-only secret classification')))
})

test('secret schema examples permit blank or explicit replacement placeholders only', () => {
  const schema = fixtureSchema()
  schema.properties.SMTP_PASSWORD.enum.push('never-echo-schema-secret')
  const errors = checkEnvironmentSchema(schema)
  assert.ok(errors.some(error => error.includes('non-placeholder secret example')))
  assert.equal(JSON.stringify(errors).includes('never-echo'), false)
})

test('schema profiles cannot redirect the checker to private files', () => {
  const schema = fixtureSchema()
  schema['x-webappx'].profiles[0].example = '.env.local'
  schema['x-webappx'].serverDocumentation.path = 'integrations/gusto/functions/.env.gusto'
  assert.equal(checkEnvironmentSchema(schema).filter(error => error.includes('inventory')).length, 2)
})

test('unsupported JSON Schema keywords and malformed families are rejected', () => {
  const schema = fixtureSchema()
  schema.allOf = [{ required: ['UNREVIEWED_SETTING'] }]
  schema.patternProperties['^VITE_ANYTHING_.*$'] = descriptor('public-browser', 'public', 'optional-extension', [])
  const errors = checkEnvironmentSchema(schema)
  assert.ok(errors.some(error => error.includes('unsupported schema keyword')))
  assert.ok(errors.some(error => error.includes('unsupported optional variable family')))
})

test('browser declaration additions, removals and server classifications disagree visibly', () => {
  for (const text of [
    declarations + 'readonly VITE_UNKNOWN_SETTING?: string\n',
    '',
    declarations + 'readonly VITE_STRIPE_PUBLISHABLE_KEY?: string\n',
  ]) assert.ok(checkEnvironmentDeclarations({ id: 'root', declarations: text, schema: fixtureSchema() }).errors.length > 0)
  const schema = fixtureSchema()
  schema.properties.VITE_FIREBASE_PROJECT_ID['x-classification'] = 'server-only'
  assert.ok(checkEnvironmentDeclarations({ id: 'root', declarations, schema }).errors.length > 0)
})

test('browser schema string types and literal choices must agree with TypeScript', () => {
  const numeric = declarations.replace(': string', ': number')
  assert.ok(checkEnvironmentDeclarations({ id: 'root', declarations: numeric, schema: fixtureSchema() }).errors.some(error => error.includes('string configuration')))
  const literals = declarations.replace(': string', ": 'another-project' | 'staging'")
  assert.ok(checkEnvironmentDeclarations({ id: 'root', declarations: literals, schema: fixtureSchema() }).errors.some(error => error.includes('schema string choices')))
})

test('poison private files and shell environment getters are never read', () => {
  const root = temporaryFixture()
  const reads = []
  const savedEnvironment = Object.getOwnPropertyDescriptor(process, 'env')
  let environmentReads = 0
  try {
    assert.deepEqual([...environmentContractFiles], expectedContractFiles)
    for (const name of ['.env', '.env.local', '.env.gusto', '.secrets.env', starter + '/.env.local', 'integrations/gusto/functions/.env.gusto']) {
      write(root, name, 'SECRET=never-read-private-poison\n')
    }
    Object.defineProperty(process, 'env', { value: new Proxy(Object.create(null), {
      get() { environmentReads += 1; throw new Error('Never read shell values.') },
      ownKeys() { environmentReads += 1; throw new Error('Never enumerate shell values.') },
    }), configurable: true, enumerable: true, writable: true })
    const report = checkEnvironmentExamples(root, { readText: path => {
      const name = relative(root, path).split('\\').join('/')
      if (!expectedContractFiles.includes(name)) throw new Error('Private file read guard.')
      reads.push(name)
      return readFileSync(path, 'utf8')
    } })
    Object.defineProperty(process, 'env', savedEnvironment)
    assert.equal(report.ok, true, JSON.stringify(report.errors))
    assert.equal(environmentReads, 0)
    assert.deepEqual(reads, expectedContractFiles)
    assert.equal(JSON.stringify(report).includes('never-read'), false)
  } finally {
    Object.defineProperty(process, 'env', savedEnvironment)
    rmSync(root, { recursive: true, force: true })
  }
})

test('missing public files and invalid JSON return sanitized failures', () => {
  const root = temporaryFixture()
  try {
    write(root, schemaName, '{"never-echo-invalid-json"')
    rmSync(join(root, '.env.example'))
    const report = checkEnvironmentExamples(root)
    assert.equal(report.ok, false)
    assert.equal(JSON.stringify(report).includes(root), false)
    assert.equal(JSON.stringify(report).includes('never-echo'), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('symlinked example files are rejected before their targets are read', () => {
  const root = temporaryFixture()
  try {
    write(root, '.env.local', 'SECRET=never-read-target\n')
    rmSync(join(root, '.env.example'))
    symlinkSync('.env.local', join(root, '.env.example'))
    const reads = []
    const report = checkEnvironmentExamples(root, { readText: path => {
      reads.push(relative(root, path))
      return readFileSync(path, 'utf8')
    } })
    assert.equal(report.ok, false)
    assert.equal(reads.includes('.env.example'), false)
    assert.equal(JSON.stringify(report).includes('never-read-target'), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('symlinked parent directories are rejected before traversing the public path', () => {
  const root = temporaryFixture()
  try {
    write(root, 'private-types/vite-env.d.ts', 'readonly VITE_POISON: string\n')
    rmSync(join(root, 'src'), { recursive: true })
    symlinkSync('private-types', join(root, 'src'), 'dir')
    const reads = []
    const report = checkEnvironmentExamples(root, { readText: path => {
      reads.push(relative(root, path))
      return readFileSync(path, 'utf8')
    } })
    assert.equal(report.ok, false)
    assert.equal(reads.includes('src/vite-env.d.ts'), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('documented server-only keys must remain named in the reviewed public guide', () => {
  const root = temporaryFixture()
  try {
    write(root, 'docs/GUSTO-FIREBASE.md', 'The adapter remains disabled.\n')
    assert.ok(checkEnvironmentExamples(root).errors.includes('server documentation: GUSTO_MODE is missing its reviewed server-only reference.'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI is read-only, reports categories/counts and refuses arbitrary file arguments', () => {
  const root = temporaryFixture()
  try {
    const script = 'scripts/check-environment-examples.mjs'
    write(root, script, readFileSync(join(repository, script), 'utf8'))
    write(root, '.env.local', 'SECRET=never-read-cli-poison\n')
    const before = Object.fromEntries([...expectedContractFiles, script, '.env.local'].map(name => [name, readFileSync(join(root, name), 'utf8')]))
    const success = spawnSync(process.execPath, [join(root, script), '--json'], { cwd: root, encoding: 'utf8' })
    assert.equal(success.status, 0, success.stderr)
    const report = JSON.parse(success.stdout)
    assert.equal(report.ok, true)
    assert.deepEqual(report.examples.map(entry => [entry.publicBrowserCount, entry.serverOnlyCount]), [[1, 1], [1, 1]])
    assert.equal(success.stdout.includes('replace-with-secret-store-value'), false)
    assert.equal(success.stdout.includes('never-read'), false)
    const rejected = spawnSync(process.execPath, [join(root, script), '--file', '.env.local'], { cwd: root, encoding: 'utf8' })
    assert.equal(rejected.status, 2)
    assert.match(rejected.stderr, /^Usage:/)
    assert.equal(rejected.stderr.includes('.env.local'), false)
    for (const [name, contents] of Object.entries(before)) assert.equal(readFileSync(join(root, name), 'utf8'), contents, name)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checked-in root and starter examples agree with the reviewed schema and type inventories', () => {
  const report = checkEnvironmentExamples(repository)
  assert.equal(report.ok, true, JSON.stringify(report.errors))
  assert.deepEqual(report.examples.map(entry => [entry.scope, entry.publicBrowserCount, entry.serverOnlyCount, entry.declarationCount, entry.optionalMarkerCount]), [
    ['root', 20, 8, 16, 2],
    ['starter', 14, 7, 10, 2],
  ])
})
