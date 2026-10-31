import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

const require = createRequire(import.meta.url)
const builder = resolve(dirname(fileURLToPath(import.meta.url)), '../Builder')
const coreAvailable = existsSync(join(builder, 'identity-core.mjs'))
const temporary = mkdtempSync(join(tmpdir(), 'systemx-tsx-adapter-'))
const typescriptPackage = dirname(require.resolve('typescript/package.json'))
mkdirSync(join(temporary, 'node_modules'))
symlinkSync(typescriptPackage, join(temporary, 'node_modules', 'typescript'), 'dir')
writeFileSync(join(temporary, 'package.json'), '{"type":"module"}\n')
copyFileSync(join(builder, 'source-identity-adapter.mjs'), join(temporary, 'source-identity-adapter.mjs'))
writeFileSync(join(temporary, 'identity-core.mjs'), `
export function createIdentityMap(input) {
  return { schemaVersion: 1, workspaceId: input.workspaceId, sourcePath: input.sourcePath,
    sourceRevision: input.sourceRevision, route: input.route, label: input.label,
    nodes: input.nodes.map(node => ({ ...node, id: node.key })) }
}
`)
after(() => rmSync(temporary, { recursive: true, force: true }))
const { parseSourceIdentity } = await import(pathToFileURL(join(temporary, 'source-identity-adapter.mjs')).href)

const sha = value => createHash('sha256').update(value).digest('hex')
const workspaceId = 'a'.repeat(64)
function parse(content, path = 'src/pages/HomePage.tsx', options = {}) {
  return parseSourceIdentity({ path, content, sourceRevision: sha(content), workspaceId, ...options })
}
function byTag(result, tag) { return result.map.nodes.filter(node => node.tag === tag) }
function codeIs(code) { return error => error?.code === code }

test('Home fixture preserves authored anchor and exact UTF-16 source and literal spans', () => {
  const content = `const marker = '😀'\r\nimport Widget from './Widget'\r\nexport function HomePage({ title }) {\r\n  return <>\r\n    <section data-snap-label="Intro">\r\n      <h1 data-systemx-id="hero-title">Welcome 🧭</h1>\r\n      <p>Local copy</p>\r\n      <p>{title}</p>\r\n      <Widget>External body</Widget>\r\n      {['a', 'b'].map(item => <span>{item}</span>)}\r\n    </section>\r\n  </>\r\n}\r\n`
  const result = parse(content, 'src/pages/HomePage.tsx', { route: '/home', label: 'Reviewed home' })
  assert.equal(result.adapter.id, 'tsx-static-v1')
  assert.deepEqual(result.adapter.supportedOperations, ['literal'])
  assert.deepEqual(result.adapter.unsupportedOperations, ['style', 'structure', 'generated'])
  assert.equal(result.shared, false)
  assert.equal(result.map.route, '/home')
  assert.equal(result.map.label, 'Reviewed home')
  assert.equal(result.map.nodes.length, 5)
  const heading = byTag(result, 'h1')[0]
  assert.equal(heading.anchor, 'hero-title')
  assert.equal(heading.label, 'Welcome 🧭')
  assert.equal(heading.definition.name, 'HomePage')
  assert.equal(heading.definition.sourcePath, 'src/pages/HomePage.tsx')
  assert.equal(heading.source.path, 'src/pages/HomePage.tsx')
  assert.equal(heading.source.sourceRevision, sha(content))
  assert.equal(heading.source.start, content.indexOf('<h1'))
  assert.equal(content.slice(heading.source.start, heading.source.end), '<h1 data-systemx-id="hero-title">Welcome 🧭</h1>')
  assert.equal(heading.source.fingerprint, sha(content.slice(heading.source.start, heading.source.end)))
  assert.equal(heading.fields.text.start, content.indexOf('Welcome 🧭'))
  assert.equal(content.slice(heading.fields.text.start, heading.fields.text.end), 'Welcome 🧭')
  assert.equal(heading.fields.text.fingerprint, sha('Welcome 🧭'))
  assert.notEqual(heading.fields.text.start, Buffer.byteLength(content.slice(0, heading.fields.text.start), 'utf8'), 'span offsets use UTF-16 units, not UTF-8 bytes')
  assert.equal(byTag(result, 'span').length, 0, 'dynamic map callback is not a durable source node')
  const expressions = byTag(result, 'p').filter(node => node.opaque)
  assert.equal(expressions.length, 1)
  assert.deepEqual(expressions[0].fields, {})
  const external = byTag(result, 'Widget')[0]
  assert.equal(external.external, true)
  assert.equal(external.opaque, true)
  assert.deepEqual(external.fields, {})
  assert.ok(result.diagnostics.some(row => row.code === 'SOURCE_COMPONENT_EXTERNAL'))
  assert.ok(result.diagnostics.some(row => row.code === 'SOURCE_EXPRESSION_OPAQUE'))
})

test('shared navigation retains selected route context and local definition owner', () => {
  const content = `export function Navigation() { return <nav><a href="/one">One</a><a href="/two">Two</a></nav> }`
  const result = parse(content, 'src/components/navigation/Navigation.tsx', { route: '/reviewed' })
  assert.equal(result.shared, true)
  assert.equal(result.map.route, '/reviewed')
  assert.equal(result.map.nodes.length, 3)
  assert.equal(byTag(result, 'a')[0].definition.name, 'Navigation')
  assert.equal(byTag(result, 'a')[0].definition.sourcePath, 'src/components/navigation/Navigation.tsx')
  assert.notEqual(byTag(result, 'a')[0].signature, byTag(result, 'a')[1].signature)
  assert.ok(byTag(result, 'a').every(node => node.parentKey === byTag(result, 'nav')[0].key))
})

test('reordered unique siblings keep signatures while indistinguishable siblings remain ambiguous', () => {
  const first = parse('export function HomePage() { return <div><span>One</span><span>Two</span></div> }')
  const reordered = parse('export function HomePage() { return <div><span>Two</span><span>One</span></div> }')
  const signatures = result => byTag(result, 'span').map(node => [node.label, node.signature]).sort((a, b) => a[0].localeCompare(b[0]))
  assert.deepEqual(signatures(first), signatures(reordered))
  assert.equal(byTag(first, 'div')[0].signature, byTag(reordered, 'div')[0].signature)

  const repeated = parse('export function HomePage() { return <div><span>Same</span><span>Same</span></div> }')
  const [left, right] = byTag(repeated, 'span')
  assert.notEqual(left.key, right.key, 'candidate keys only distinguish occurrences locally')
  assert.equal(left.parentKey, right.parentKey)
  assert.equal(left.signature, right.signature, 'core must leave an indistinguishable unanchored pair unresolved')
})

test('expressions and external components are read only while scalar literals retain exact fields', () => {
  const result = parse(`export function HomePage({ title, click }) { return <div><p>{title}</p><button onClick={click}>Go</button><p>Plain</p><Card><b>Hidden</b></Card></div> }`)
  assert.equal(byTag(result, 'p')[0].opaque, true)
  assert.deepEqual(byTag(result, 'p')[0].fields, {})
  assert.equal(byTag(result, 'button')[0].opaque, true)
  assert.deepEqual(byTag(result, 'button')[0].fields, {})
  assert.equal(byTag(result, 'p')[1].opaque, false)
  assert.equal(byTag(result, 'p')[1].fields.text.fingerprint, sha('Plain'))
  assert.equal(byTag(result, 'Card')[0].external, true)
  assert.equal(byTag(result, 'b').length, 0)
})

test('TSX source is parsed without executing its statements or imports', () => {
  const marker = '__systemx_adapter_source_execution_fixture__'
  const content = `globalThis.${marker} = true; import './never-resolve'; export const Home = () => <main>Safe</main>`
  const result = parse(content)
  assert.equal(globalThis[marker], undefined)
  assert.equal(byTag(result, 'main')[0].fields.text.fingerprint, sha('Safe'))
})

test('invalid, duplicate, dynamic, and hidden duplicate authored anchors refuse import', () => {
  assert.throws(() => parse('export const Home = () => <p data-systemx-id="9bad">Text</p>'), codeIs('SOURCE_IDENTITY_ANCHOR_INVALID'))
  assert.throws(() => parse('export const Home = () => <><p data-systemx-id="same"/><p data-systemx-id="same"/></>'), codeIs('SOURCE_IDENTITY_ANCHOR_DUPLICATE'))
  assert.throws(() => parse('export const Home = ({ id }) => <p data-systemx-id={id}>Text</p>'), codeIs('SOURCE_IDENTITY_ANCHOR_INVALID'))
  assert.throws(() => parse('export const Home = () => <><p data-systemx-id="same"/>{[1].map(() => <p data-systemx-id="same"/>)}</>'), codeIs('SOURCE_IDENTITY_ANCHOR_DUPLICATE'))
})

test('syntax, path, source size, revision, and workspace bounds fail with stable codes', () => {
  assert.throws(() => parse('export const Home = () => <div><span></div>'), codeIs('SOURCE_IDENTITY_TSX_SYNTAX'))
  assert.throws(() => parse('<p>Hi</p>', 'src/pages/../../private.tsx'), codeIs('SOURCE_IDENTITY_PATH_INVALID'))
  assert.throws(() => parse('<p>Hi</p>', 'src/index.css'), codeIs('SOURCE_IDENTITY_PATH_INVALID'))
  assert.throws(() => parse(`<p>${'x'.repeat(500_000)}</p>`), codeIs('SOURCE_IDENTITY_SOURCE_LIMIT'))
  assert.throws(() => parse(`export const Home = () => <>${'<i/>'.repeat(1_001)}</>`), codeIs('SOURCE_IDENTITY_NODE_LIMIT'))
  assert.throws(() => parse('<p>\uD800</p>'), codeIs('SOURCE_IDENTITY_ENCODING_INVALID'))
  assert.throws(() => parseSourceIdentity({ path: 'src/pages/HomePage.tsx', content: '<p>Hi</p>', sourceRevision: '0'.repeat(64), workspaceId }), codeIs('SOURCE_IDENTITY_REVISION_INVALID'))
  assert.throws(() => parseSourceIdentity({ path: 'src/pages/HomePage.tsx', content: '<p>Hi</p>', sourceRevision: sha('<p>Hi</p>'), workspaceId: 'bad' }), codeIs('SOURCE_IDENTITY_WORKSPACE_INVALID'))
})

test('real identity-core integration after coordinator composes worker branches', { skip: !coreAvailable }, async () => {
  const actual = await import(pathToFileURL(join(builder, 'source-identity-adapter.mjs')).href)
  const importActual = content => actual.parseSourceIdentity({ path: 'src/pages/HomePage.tsx', content, sourceRevision: sha(content), workspaceId })
  const result = importActual('<main><h1 data-systemx-id="title">Hello</h1></main>')
  assert.equal(result.map.schemaVersion, 1)
  assert.equal(result.map.nodes.length, 2)
  assert.equal(result.map.nodes.find(node => node.anchor === 'title')?.confidence, 'explicit')
  const first = importActual('<main><p>One</p><p>Two</p></main>')
  const reordered = importActual('<main><p>Two</p><p>One</p></main>')
  const idByLabel = map => new Map(map.nodes.filter(node => node.tag === 'p').map(node => [node.label, node.id]))
  assert.deepEqual(idByLabel(first.map), idByLabel(reordered.map))
  const repeated = importActual('<main><p>Same</p><p>Same</p></main>')
  const unresolved = repeated.map.nodes.filter(node => node.tag === 'p')
  assert.equal(unresolved.length, 2)
  assert.ok(unresolved.every(node => node.confidence === 'unresolved'))
  assert.notEqual(unresolved[0].id, unresolved[1].id)
})
