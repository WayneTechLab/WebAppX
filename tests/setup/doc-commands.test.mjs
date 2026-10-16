import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { buildDocCommandReport, scanMarkdownCommands, checkDocumentationCommands, runDocCommandsCli } from '../../scripts/check-doc-commands.mjs'

const manifest = { root: { scripts: { dev: 'vite', test: 'node --test', 'doctor:test': 'node --test doctor' } }, starter: { scripts: { dev: 'vite', build: 'vite build' } }, functions: { scripts: { check: 'node --check index.mjs', test: 'node --test' } } }
const doc = text => ({ path: 'docs/example.md', text, defaultContext: 'root' })
const report = (text, contexts = []) => buildDocCommandReport({ documents: [doc(text)], manifests: manifest, contexts })
const digest = value => createHash('sha256').update(value).digest('hex')

test('inline and fenced examples, flag orders, aliases, CRLF and separators keep literal locations', () => {
  const text = 'Use `npm --silent run dev` first.\r\n\r\n```bash\r\nnpm run --if-present doctor:test -- --PRIVATE_ARG\r\nnpm test && npm run-script dev\r\n```\r\n'
  const actual = report(text)
  assert.equal(actual.ok, true)
  assert.deepEqual(actual.references.map(row => [row.line, row.column, row.script]), [[1, 6, 'dev'], [4, 1, 'doctor:test'], [5, 1, 'test'], [5, 13, 'dev']])
  assert.doesNotMatch(JSON.stringify(actual), /PRIVATE_ARG/)
})

test('CommonMark multiline inline spans normalize line endings and retain original command coordinates', () => {
  const text = 'Use `npm run\nmissing` next. Then `` npm\r\nrun dev `` and `npm ci\n--no-audit`.\n\nPrivate `npm run typo -- "$(PRIVATE_ARGUMENT)"\nPRIVATE_TRAILING`.'
  const actual = report(text)
  assert.deepEqual(actual.errors.map(row => [row.line, row.column, row.script, row.reason]), [[1, 6, 'missing', 'unknown-npm-script'], [6, 10, 'typo', 'unknown-npm-script']])
  assert.deepEqual(actual.references.map(row => [row.line, row.column, row.kind, row.script]), [[1, 6, 'script', 'missing'], [2, 24, 'script', 'dev'], [3, 17, 'ordinary', null], [6, 10, 'script', 'typo']])
  assert.doesNotMatch(JSON.stringify(actual), /PRIVATE_ARGUMENT|PRIVATE_TRAILING/)
  assert.deepEqual(report(text.replace(/\r?\n/g, '\r\n')).errors.map(row => [row.line, row.column, row.script]), [[1, 6, 'missing'], [6, 10, 'typo']])
})

test('inline delimiters match complete backtick runs and never join separate paragraphs or fences', () => {
  const actual = report('Use `` npm run\nmissing ` quoted ``. Then `npm run dev`.\n\n`npm run\n\nmissing`\n\n```sh\nnpm run typo\n```\n')
  assert.deepEqual(actual.errors.map(row => row.script), ['missing', 'typo'])
  assert.equal(actual.references.find(row => row.script === 'dev').context, 'root')
  assert.equal(actual.references.length, 3)
})

test('unknown scripts fail under if-present while ordinary npm subcommands and explicit placeholders stay distinct', () => {
  const actual = report('```sh\nnpm ci\nnpm install\nnpm exec --package=fake -- do-not-run\nnpm audit\nnpm --version\nnpm run <script>\nnpm run --if-present typo\n```')
  assert.equal(actual.ok, false)
  assert.deepEqual(actual.errors, [{ path: 'docs/example.md', line: 8, column: 1, script: 'typo', context: 'root', reason: 'unknown-npm-script' }])
  assert.equal(actual.references.filter(row => row.kind === 'ordinary').length, 5)
  assert.equal(actual.references.filter(row => row.kind === 'placeholder').length, 1)
})

test('all npm lifecycle shorthands require real scripts and trailing script arguments are inert', () => {
  const actual = report('```\nnpm test -- --example="npm run secret"\nnpm start\nnpm stop\nnpm restart\n```')
  assert.deepEqual(actual.errors.map(row => row.script), ['start', 'stop', 'restart'])
  assert.equal(actual.references.length, 4)
  assert.doesNotMatch(JSON.stringify(actual), /secret/)
})

test('only fixed literal nested package prefixes select reviewed manifests, never root or arbitrary filesystem input', () => {
  const actual = report('```\nnpm --prefix integrations/gusto/functions run check\nnpm run check --prefix integrations/gusto/functions\nnpm --prefix .SYSTEMX/Template/starter run build\nnpm --prefix ../../PRIVATE run dev\nnpm --workspace private run dev\n```')
  assert.deepEqual(actual.references.map(row => row.context), ['functions', 'functions', 'starter', null, null])
  assert.deepEqual(actual.errors.map(row => row.reason), ['unresolved-package-context', 'unresolved-package-context'])
  assert.doesNotMatch(JSON.stringify(actual), /PRIVATE|private/)
})

test('dot prefixes preserve nested or ambiguous current context and nested paths require a verified root', () => {
  const actual = report('```sh\ncd integrations/gusto/functions\ncd .\nnpm --prefix . run check\nnpm --prefix .SYSTEMX/Template/starter run build\n```\n\n```sh\ncd private-app\ncd ./\nnpm --prefix . run dev\n```')
  assert.deepEqual(actual.references.map(row => row.context), ['functions', null, null])
  assert.deepEqual(actual.errors.map(row => [row.script, row.reason]), [['build', 'unresolved-package-context'], ['dev', 'unresolved-package-context']])
  assert.doesNotMatch(JSON.stringify(actual), /private-app/)
})

test('ambiguous cd contexts refuse until an exact occurrence is explicitly bound; no rest-of-file waiver', () => {
  const text = '```sh\ncd my-app\nnpm run dev\nnpm run typo\n```'
  const first = scanMarkdownCommands(doc(text))[0]
  const context = { path: first.path, line: first.line, column: first.column, script: 'dev', commandSha256: digest('npm run dev'), documentSha256: digest(text), context: 'root', reason: 'Published template adoption example.', sourceRevision: 'a'.repeat(40) }
  assert.deepEqual(report(text, [context]).errors.map(row => row.script), ['typo'])
  assert.equal(report(text).errors.length, 2)
  assert.equal(report(text.replace('npm run dev', 'npm run dev -- changed'), [context]).errors.some(row => row.reason === 'stale-context-record'), true)
  assert.equal(report(text.replace('my-app', 'otherx'), [context]).errors.some(row => row.reason === 'stale-context-record'), true)
})

test('reviewed text hashes and exact occurrence locations remain portable in a CRLF checkout', () => {
  const text = '```sh\ncd my-app\nnpm run dev -- \\\n  inert-argument\n```\n'
  const first = scanMarkdownCommands(doc(text))[0]
  const context = { ...first, context: 'root', reason: 'Reviewed root adoption example.', sourceRevision: 'a'.repeat(40) }
  delete context.kind
  delete context.invalid
  assert.equal(report(text, [context]).ok, true)
  assert.equal(report(text.replace(/\n/g, '\r\n'), [context]).ok, true)
  assert.equal(report(text.replace('my-app', 'another-app'), [context]).ok, false)
})

test('historical exception matches exact source, script and location and cannot exempt another unknown example', () => {
  const text = 'Old `npm run old:alias`. Current `npm run typo`.'
  const historical = { path: 'docs/example.md', line: 1, column: 6, script: 'old:alias', commandSha256: digest('npm run old:alias'), documentSha256: digest(text), context: 'historical', reason: 'Explicitly retired spelling.', sourceRevision: 'a'.repeat(40) }
  const actual = report(text, [historical])
  assert.deepEqual(actual.errors.map(row => row.script), ['typo'])
  assert.equal(actual.references[0].context, 'historical')
  assert.throws(() => report(text, [{ ...historical, sourceRevision: 'not-a-revision' }]), /Invalid/)
  assert.throws(() => report(text, [historical, historical]), /Invalid/)
  assert.equal(report(text.replace('Old', 'Now'), [historical]).errors.some(row => row.reason === 'stale-context-record'), true)
})

test('explicit grammar placeholder is a single visible unvalidated occurrence, distinct from historical evidence', () => {
  const text = 'Grammar `npm run NAME`; actual `npm run typo`.'
  const placeholder = { path: 'docs/example.md', line: 1, column: 10, script: 'NAME', commandSha256: digest('npm run NAME'), documentSha256: digest(text), context: 'placeholder', reason: 'Explicit grammar placeholder.', sourceRevision: null }
  const actual = report(text, [placeholder])
  assert.deepEqual(actual.errors.map(row => row.script), ['typo'])
  assert.equal(actual.references[0].context, 'placeholder'); assert.equal(actual.references[0].kind, 'placeholder')
  assert.throws(() => report(text, [{ ...placeholder, context: 'historical' }]), /Invalid/)
})

test('fence-like content cannot close a fenced block early and hide later unknown examples', () => {
  const actual = report('```sh\nnpm run dev\n```not-a-closing-fence\nnpm run typo\n```\n')
  assert.deepEqual(actual.errors.map(row => row.script), ['typo'])
})

test('unsupported expansions and shell-looking payloads never execute or appear in diagnostics', () => {
  const text = '```sh\nnpm run $(PRIVATE_LITERAL)\nnpm run typo -- "$(PRIVATE_ARG)"\nnpm --mystery run dev\n```'
  const actual = report(text)
  assert.equal(actual.errors.length, 3)
  assert.doesNotMatch(JSON.stringify(actual), /PRIVATE_LITERAL|PRIVATE_ARG/)
  assert.equal(actual.errors[0].script, null)
})

test('shape, traversal, duplicate paths and accessors fail before data execution', () => {
  assert.throws(() => buildDocCommandReport({ documents: [{ ...doc('`npm run dev`'), path: 'docs/../private.md' }], manifests: manifest }), /Invalid/)
  assert.throws(() => buildDocCommandReport({ documents: [doc(''), doc('')], manifests: manifest }), /Invalid/)
  assert.throws(() => buildDocCommandReport({ documents: [doc(''), { ...doc(''), path: 'docs/Example.md' }], manifests: manifest }), /Invalid/)
  assert.throws(() => buildDocCommandReport({ documents: [doc('`npm run dev`')], manifests: { ...manifest, root: { scripts: { dev: false } } } }), /Invalid/)
  let reads = 0; const input = doc('')
  Object.defineProperty(input, 'text', { enumerable: true, get() { reads++; return '' } })
  assert.throws(() => buildDocCommandReport({ documents: [input], manifests: manifest }), /Invalid/); assert.equal(reads, 0)
})

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'webappx docs Café ')); t.after(() => rm(root, { recursive: true, force: true }))
  const files = { 'README.md': '`npm run dev`', 'docs/guide.md': '`npm run test`', 'wiki/guide.md': '`npm ci`', '.SYSTEMX/Template/starter/README.md': '`npm run build`', 'package.json': JSON.stringify(manifest.root), '.SYSTEMX/Template/starter/package.json': JSON.stringify(manifest.starter), 'integrations/gusto/functions/package.json': JSON.stringify(manifest.functions), 'scripts/doc-command-contexts.json': '{"schemaVersion":1,"contexts":[]}', '.env.local': 'PRIVATE_SENTINEL=preserve' }
  for (const [name, value] of Object.entries(files)) { await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), value) }
  return { root, files }
}

test('actual reader and CLI inspect maintained scope without reading private state or changing bytes', async t => {
  const { root, files } = await fixture(t)
  const actual = await checkDocumentationCommands(root)
  assert.equal(actual.ok, true); assert.equal(actual.documentCount, 4); assert.equal(actual.referenceCount, 4)
  assert.equal(actual.references.find(row => row.path.endsWith('starter/README.md')).context, 'starter')
  const stdout = [], stderr = []
  assert.equal(await runDocCommandsCli(['--json'], { root, stdout: { write: value => stdout.push(value) }, stderr: { write: value => stderr.push(value) } }), 0)
  assert.equal(JSON.parse(stdout.join('')).ok, true); assert.deepEqual(stderr, [])
  for (const [name, value] of Object.entries(files)) assert.equal(await readFile(join(root, name), 'utf8'), value)
})

test('CLI rejects unknown names and invalid flags with bounded diagnostics excluding arguments', async t => {
  const { root } = await fixture(t)
  await writeFile(join(root, 'docs/guide.md'), '`npm run typo -- PRIVATE_ARG`')
  const stdout = [], stderr = []
  const io = { root, stdout: { write: value => stdout.push(value) }, stderr: { write: value => stderr.push(value) } }
  assert.equal(await runDocCommandsCli([], io), 1)
  assert.match(stdout.join(''), /docs\/guide.md:1:2: unknown-npm-script \(typo\)/)
  assert.equal(await runDocCommandsCli(['--PRIVATE_OPTION'], io), 2)
  assert.doesNotMatch(stdout.join('') + stderr.join(''), /PRIVATE_ARG|PRIVATE_OPTION/)
})

test('importing documentation checker does not scan source, print, write or execute examples', () => {
  const url = new URL('../../scripts/check-doc-commands.mjs', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv[1] = '/unrelated/example'; await import(${JSON.stringify(url)});`], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, shell: false })
  assert.equal(child.status, 0); assert.equal(child.stdout, ''); assert.equal(child.stderr, '')
})
