import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../../.SYSTEMX/LAN/Builder/runtime/port-utils.mjs'
import { dispatchGraphContract } from '../../.SYSTEMX/LAN/Builder/graph-http.mjs'
import { createGraphService } from '../../.SYSTEMX/LAN/Builder/graph-service.mjs'
import { graphFixture } from '../../scripts/lan-graph-contract-browser.mjs'

const cli = fileURLToPath(new URL('../../scripts/lan-command-proposal.mjs', import.meta.url))
const workspaceId = '3'.repeat(64), sourceRevision = '4'.repeat(64)
const token = 'c'.repeat(48)
const execute = async (args, input = '') => {
  const child = spawn(process.execPath, [cli, ...args], { stdio: 'pipe', signal: AbortSignal.timeout(10000) })
  const closed = once(child, 'close')
  let out = '', err = ''
  child.stdout.setEncoding('utf8').on('data', part => { out += part })
  child.stderr.setEncoding('utf8').on('data', part => { err += part })
  child.stdin.on('error', () => {}) // A rejected argument can close stdin before a writer finishes.
  child.stdin.end(input)
  return { code: (await closed)[0], out, err }
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'proposal-cli-private-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const document = graphFixture(workspaceId, sourceRevision)
  const service = createGraphService({ workspaceId })
  const preview = await service.preview({ document })
  service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const exported = service.export({ documentId: document.documentId })
  const candidate = structuredClone(document)
  candidate.nodes.find(node => node.id === 'alpha').label = 'Private draft label'
  const baseline = join(dir, 'baseline.json'), draft = join(dir, 'candidate.json'), proposal = join(dir, 'proposal.json')
  await writeFile(baseline, JSON.stringify(exported))
  await writeFile(draft, JSON.stringify(candidate))
  return { dir, baseline, draft, proposal, exported, candidate, service, documentId: document.documentId }
}

function createArgs(f, options = ['--baseline', f.baseline]) {
  return ['create', ...options, '--candidate', f.draft, '--expected-revision', f.exported.revision]
}

test('operator create and inspect round-trip a GUI-format export, preserve bytes, and reject stale inputs', async t => {
  const f = await fixture(t)
  const before = await Promise.all([readFile(f.baseline), readFile(f.draft)])
  const created = await execute(createArgs(f))
  assert.equal(created.code, 0, created.err)
  assert.equal(created.err, '')
  const portable = JSON.parse(created.out)
  assert.equal(portable.targetRevision, f.exported.revision)
  assert.equal(portable.documentId, f.documentId)
  assert.doesNotMatch(created.out, /Private draft label|Preserved metadata|systemx-session/)
  assert.ok(!created.out.includes(f.dir))
  await writeFile(f.proposal, created.out)
  const args = ['inspect', '--baseline', f.baseline, '--candidate', f.draft, '--proposal', '-']
  assert.deepEqual(await execute(args, created.out), created)
  assert.deepEqual(await Promise.all([readFile(f.baseline), readFile(f.draft)]), before)
  const stale = await execute([...createArgs(f).slice(0, -1), '0'.repeat(64)])
  assert.equal(stale.code, 1)
  assert.equal(stale.out, '')
  assert.match(stale.err, /COMMAND_BASELINE_STALE.*Export the current graph/)
  const altered = { ...portable, candidateRevision: '9'.repeat(64) }
  assert.equal((await execute(args, JSON.stringify(altered))).code, 1)
})

test('help, bounded private files, duplicate spellings and origin grammar are handled before output', async t => {
  const f = await fixture(t)
  const help = await execute(['--help'])
  assert.equal(help.code, 0)
  assert.match(help.out, /create --baseline.*\n.*inspect --baseline/)
  const readStdin = ['create', '--baseline', f.baseline, '--candidate', '-', '--expected-revision', f.exported.revision]
  for (const input of ['{"a":{"a":1,"\\u0061":2}}', ' '.repeat(2_000_001), Buffer.from([0xff])]) {
    const reply = await execute(readStdin, input)
    assert.equal(reply.code, 1)
    assert.equal(reply.out, '')
    assert.ok(!reply.err.includes(f.dir))
  }
  assert.equal((await execute(['inspect', '--baseline', '-', '--candidate', '-', '--proposal', f.proposal])).code, 2)
  assert.equal((await execute([...createArgs(f), '--baseline', f.baseline])).code, 2)
  for (const origin of ['http://localhost:1000', 'http://127.0.0.1:1234/a', 'https://127.0.0.1:1', 'http://127.0.0.1:65536', 'http://127.0.0.1:1234@outside.invalid']) {
    assert.equal((await execute(createArgs(f, ['--origin', origin, '--document', f.documentId]))).code, 2)
  }
  const tooLarge = join(f.dir, 'private-large')
  await writeFile(tooLarge, Buffer.alloc(2_000_001))
  for (const path of [tooLarge, f.dir, join(f.dir, 'private-missing')]) {
    const reply = await execute(createArgs(f, ['--baseline', path]))
    assert.equal(reply.code, 1)
    assert.equal(reply.out, '')
    assert.ok(!reply.err.includes(f.dir))
  }
})

test('a symbolic link to a file or parent directory cannot become a graph input', async t => {
  const f = await fixture(t)
  const link = join(f.dir, 'link')
  const directory = join(f.dir, 'dir-link')
  try {
    await symlink(f.baseline, link)
    await symlink(f.dir, directory, 'dir')
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') { t.skip('Creating a test symlink requires Windows Developer Mode'); return }
    throw error
  }
  for (const path of [link, join(directory, 'baseline.json')]) {
    const reply = await execute(createArgs(f, ['--baseline', path]))
    assert.equal(reply.code, 1)
    assert.equal(reply.out, '')
    assert.ok(!reply.err.includes(f.dir))
  }
})

test('live uses the selected origin and read-only graph contracts; mismatches and redirects emit no proposal', async t => {
  const f = await fixture(t)
  const events = []
  let mode = 'ok', statusReads = 0, bounced = 0
  const bounce = createServer((_req, res) => { bounced++; res.end() })
  bounce.listen(0, '127.0.0.1')
  await once(bounce, 'listening')
  t.after(() => new Promise(done => bounce.close(done)))
  const server = createServer(async (req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      assert.equal(req.headers['x-systemx-session'], undefined)
      events.push('dashboard')
      if (mode === 'dashboard-redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1:' + bounce.address().port + '/' }).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<meta name="systemx-session" content="${token}" /><script type="application/json" id="systemx-status-data">${JSON.stringify({ repository: { workspaceId } })}</script>`)
      return
    }
    assert.equal(req.method, 'POST')
    assert.equal(req.url, '/api/contracts/query')
    assert.equal(req.headers['x-systemx-session'], token)
    let raw = ''
    for await (const part of req) raw += part
    const body = JSON.parse(raw)
    assert.equal(body.kind, 'query')
    assert.ok(['graph.status','graph.document'].includes(body.operation))
    events.push(body.operation)
    if (mode === 'query-redirect') {
      res.writeHead(307, { Location: 'http://127.0.0.1:' + bounce.address().port + '/' }).end()
      return
    }
    const reply = await dispatchGraphContract({ service: f.service, method: 'POST', url: new URL(req.url, 'http://localhost'), body })
    if (mode === 'wrong-workspace' && body.operation === 'graph.status') reply.result.result.workspaceId = '6'.repeat(64)
    if (mode === 'changed' && body.operation === 'graph.status' && ++statusReads === 2) reply.result.result.documents[0].revision = '6'.repeat(64)
    if (mode === 'wrong-id') reply.result.requestId = 'different-request'
    res.writeHead(reply.statusCode, { 'Content-Type': 'application/json' }).end(JSON.stringify(reply.result))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(done => server.close(done)))
  const live = createArgs(f, ['--origin', 'http://127.0.0.1:' + server.address().port, '--document', f.documentId])
  const offline = await execute(createArgs(f))
  assert.equal(offline.code, 0, offline.err)
  assert.deepEqual(await execute(live), offline)
  assert.deepEqual(events, ['dashboard', 'graph.status', 'graph.document', 'graph.status'])
  for (mode of ['wrong-workspace', 'wrong-id', 'changed', 'dashboard-redirect', 'query-redirect']) {
    const refusal = await execute(live)
    assert.equal(refusal.code, 1, mode)
    assert.equal(refusal.out, '')
    assert.ok(!refusal.err.includes(token) && !refusal.err.includes(f.dir), mode)
  }
  assert.equal(bounced, 0)
})

test('direct LAN dashboard and selected graph yield the same portable review as a downloaded graph export', async t => {
  const root = await mkdtemp(join(tmpdir(), 'lan-proposal-operator-'))
  const sourceLan = fileURLToPath(new URL('../../.SYSTEMX/LAN/', import.meta.url)), lan = join(root, '.SYSTEMX', 'LAN')
  let child, stopped
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill()
    if (stopped) await stopped
    await rm(root, { recursive: true, force: true })
  })
  await mkdir(lan, { recursive: true })
  for (const name of ['Builder', 'Website', 'Website_Dashboard.html', 'server.mjs', 'session-restart-preview.mjs', 'work-status.mjs']) {
    await cp(join(sourceLan, name), join(lan, name), { recursive: true })
  }
  const port = String(await findAvailablePort(randomInt(20000, 60000))), origin = 'http://127.0.0.1:' + port
  child = spawn(process.execPath, [join(lan, 'server.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: dirname(process.execPath), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_LAN_PORT: port, SYSTEMX_APP_PORT: port, SYSTEMX_FIREBASE_AUTH_PORT: port,
      SYSTEMX_FIREBASE_FIRESTORE_PORT: port, SYSTEMX_FIREBASE_STORAGE_PORT: port } })
  stopped = once(child, 'close')
  const lines = createInterface({ input: child.stdout })
  const [banner] = await Promise.race([once(lines, 'line', { signal: AbortSignal.timeout(8000) }),
    stopped.then(() => { throw new Error('Disposable LAN stopped before readiness') })])
  lines.close()
  assert.equal(banner, '[SYSTEMX LAN] ' + origin + '/')
  const read = (path, options = {}) => fetch(origin + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) })
  const dashboard = await (await read('/')).text()
  const session = dashboard.match(/<meta name="systemx-session" content="([a-f0-9]{48})"/)?.[1]
  const status = JSON.parse(dashboard.match(/id="systemx-status-data">([^<]+)</)?.[1])
  assert.ok(session && status.repository.workspaceId)
  const source = 'export default function GraphFixture() { return <main>Private authored text</main> }'
  const sourcePath = join(root, 'src', 'pages', 'GraphFixture.tsx')
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, source)
  const document = graphFixture(status.repository.workspaceId, createHash('sha256').update(source).digest('hex'))
  async function call(kind, operation, payload) {
    const body = { apiVersion: '1.1', requestId: randomUUID(), kind, operation, payload: { type: operation, ...payload } }
    if (kind === 'command') Object.assign(body, { capabilityId: 'lan.' + operation + '@1', expectedRevision: null,
      confirmation: operation === 'graph.accept' ? 'ACCEPT GRAPH' : '' })
    const response = await read('/api/contracts/' + kind, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-systemx-session': session }, body: JSON.stringify(body) })
    const data = await response.json()
    assert.equal(data.ok, true, data.error?.code)
    return data.result
  }
  // Only this fixture setup initializes a new, disposable graph session.
  const preview = await call('command', 'graph.preview', { document })
  await call('command', 'graph.accept', { digest: preview.digest })
  const exported = await call('query', 'graph.export', { documentId: document.documentId })
  const baseline = join(root, 'download.json'), draft = join(root, 'candidate.json')
  await writeFile(baseline, JSON.stringify(exported))
  document.nodes.find(node => node.id === 'alpha').label = 'Private replacement'
  await writeFile(draft, JSON.stringify(document))
  const candidate = ['--candidate', draft], revision = ['--expected-revision', exported.revision]
  const live = ['--origin', origin, '--document', document.documentId]
  const offline = await execute(['create', '--baseline', baseline, ...candidate, ...revision])
  assert.equal(offline.code, 0, offline.err)
  assert.deepEqual(await execute(['create', ...live, ...candidate, ...revision]), offline)
  assert.deepEqual(await execute(['inspect', ...live, ...candidate, '--proposal', '-'], offline.out), offline)
  assert.doesNotMatch(offline.out, /Private replacement|Private authored text/)
  assert.ok(!offline.out.includes(session) && !offline.out.includes(root))
  assert.deepEqual(await call('query', 'graph.export', { documentId: document.documentId }), exported)
  assert.equal(await readFile(sourcePath, 'utf8'), source)
})

test('CLI distinguishes first and last insertion, removal, reparenting and every owner in a three-way reversal', async t => {
  const f = await fixture(t)
  const graph = structuredClone(f.exported.document)
  const find = (doc, id) => doc.nodes.find(item => item.id === id)
  for (const [id, name] of [['alpha', 'First'], ['opaque', 'Middle'], ['instance', 'Last']]) {
    find(graph, id).source = { ...find(graph, 'alpha').source, path: 'src/' + name + '.tsx' }
  }
  const preview = await f.service.preview({ document: graph })
  f.service.accept({ digest: preview.digest, expectedRevision: f.exported.revision, confirmation: 'ACCEPT GRAPH' })
  f.exported = f.service.export({ documentId: f.documentId })
  await writeFile(f.baseline, JSON.stringify(f.exported))
  async function review(doc) {
    await writeFile(f.draft, JSON.stringify(doc))
    const result = await execute(createArgs(f))
    assert.equal(result.code, 0, result.err)
    return JSON.parse(result.out)
  }
  const insertion = async index => {
    const doc = structuredClone(graph)
    doc.nodes.push({ ...find(doc, 'alpha'), id: 'extra', source: null })
    find(doc, 'root').childIds.splice(index, 0, 'extra')
    return review(doc)
  }
  const first = await insertion(0), last = await insertion(3)
  assert.notDeepEqual(first.effects, last.effects)
  for (const [result, at] of [[first, 0], [last, 3]]) {
    const order = result.effects.changed.find(row => row.id === 'root').childOrder
    assert.deepEqual(order.before, ['alpha', 'opaque', 'instance'])
    assert.equal(order.after[at], 'extra')
    assert.deepEqual(order.inserted, [{ id: 'extra', from: null, to: at }])
    assert.deepEqual(result.effects.added.find(row => row.id === 'extra').placement, { before: null, after: { parentId: 'root', index: at } })
  }
  const reversed = structuredClone(graph)
  find(reversed, 'root').childIds.reverse()
  const result = await review(reversed)
  const change = result.effects.reordered.find(row => row.id === 'root')
  for (const ownerIds of [change.ownersBefore, change.ownersAfter]) {
    const paths = ownerIds.map(id => result.owners.find(owner => owner.id === id).path)
    assert.deepEqual(paths.sort(), ['src/First.tsx', 'src/Last.tsx', 'src/Middle.tsx'])
  }
  assert.deepEqual(change.childOrder.moved.map(row => [row.id, row.from, row.to]),
    [['instance', 2, 0], ['opaque', 1, 1], ['alpha', 0, 2]])
  const moved = structuredClone(graph)
  find(moved, 'root').childIds.splice(1, 1)
  find(moved, 'componentRoot').childIds.push('opaque')
  find(moved, 'opaque').parentId = 'componentRoot'
  const transfer = await review(moved)
  assert.deepEqual(transfer.effects.changed.find(row => row.id === 'root').childOrder.removed, [{ id: 'opaque', from: 1, to: null }])
  assert.deepEqual(transfer.effects.changed.find(row => row.id === 'opaque').placement,
    { before: { parentId: 'root', index: 1 }, after: { parentId: 'componentRoot', index: 0 } })
  assert.deepEqual(transfer.effects.changed.find(row => row.id === 'componentRoot').childOrder.inserted, [{ id: 'opaque', from: null, to: 0 }])
  assert.deepEqual(JSON.parse(await readFile(f.baseline, 'utf8')), f.exported)
})

test('invalid relationships identify distinct repairable preconditions without echoing graph input', async t => {
  const f = await fixture(t)
  for (const [code, corrupt, guidance] of [
    ['GRAPH_ROOT_MISSING', doc => { doc.pages[0].rootId = 'privateMissingNode' }, /root/i],
    ['NODE_CHILD_DUPLICATE', doc => { const root = doc.nodes.find(node => node.id === 'root'); root.childIds.push(root.childIds[0]) }, /duplicat|once/i],
  ]) {
    const doc = structuredClone(f.candidate)
    corrupt(doc)
    await writeFile(f.draft, JSON.stringify(doc))
    const rejected = await execute(createArgs(f))
    assert.equal(rejected.code, 1)
    assert.equal(rejected.out, '')
    assert.ok(rejected.err.includes(code), rejected.err)
    assert.match(rejected.err, guidance)
    assert.doesNotMatch(rejected.err, /privateMissingNode|Private draft label|GraphFixture\.tsx/)
    assert.ok(rejected.err.length < 1200)
  }
})
