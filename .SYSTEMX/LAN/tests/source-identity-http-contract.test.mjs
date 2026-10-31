import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const originalLan = join(repository, '.SYSTEMX/LAN')
const homePath = 'src/pages/HomePage.tsx'
const page = [
  '// PRIVATE_HTTP_SOURCE_COMMENT_51c4 must not enter identity responses.',
  'export default function HomePage() {',
  '  return <main data-systemx-id="home">',
  '    <h1 data-systemx-id="headline">HTTP fixture headline</h1>',
  '    <p data-systemx-id="intro">HTTP fixture introduction</p>',
  '  </main>',
  '}',
  '',
].join('\n')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const proposalOf = (result) => result?.proposal ?? result
const parseBody = (value) => { try { return JSON.parse(value) } catch { return value } }

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close((error) => error ? reject(error) : resolvePort(port))
    })
  })
}

function effects(root) {
  const result = {}
  const visit = (path, relative) => {
    if (!existsSync(path)) return
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      const name = relative + '/' + entry.name
      if (entry.isDirectory()) visit(child, name)
      else result[name] = entry.isSymbolicLink() ? 'linked' : sha(readFileSync(child))
    }
  }
  for (const directory of ['src', '.SYSTEMX/LAN/Backup', '.SYSTEMX/LAN/Temp']) visit(join(root, directory), directory)
  return result
}

function put(root, path, value) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

function installExistingTypescript(fixture) {
  const commonGit = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: repository, encoding: 'utf8' }).trim()
  const candidates = [
    join(repository, 'node_modules/typescript'),
    join(dirname(resolve(repository, commonGit)), 'node_modules/typescript'),
  ]
  const existing = candidates.find((path) => existsSync(join(path, 'package.json')))
  assert.ok(existing, 'Existing TypeScript dependency is needed to run the isolated HTTP fixture')
  mkdirSync(join(fixture, 'node_modules'), { recursive: true })
  symlinkSync(existing, join(fixture, 'node_modules/typescript'), process.platform === 'win32' ? 'junction' : 'dir')
}

function safeBody(body, fixture, token, { exportOnly = false } = {}) {
  const serialized = JSON.stringify(body)
  assert.ok(!serialized.includes(fixture), 'HTTP response exposed the absolute fixture root')
  assert.ok(!serialized.includes(token), 'HTTP response exposed the LAN session token')
  assert.doesNotMatch(serialized, /PRIVATE_HTTP_SOURCE_COMMENT_51c4|SESSION_SECRET_31a9|local-session\.json/)
  assert.ok(!serialized.includes(page), 'HTTP response exposed the full source body')
  if (exportOnly) assert.doesNotMatch(serialized, /HTTP fixture headline|HTTP fixture introduction/)
}

function refusal(result, fixture, token, statuses = [400, 409, 415]) {
  assert.ok(statuses.includes(result.status), JSON.stringify(result))
  assert.equal(typeof result.body?.error, 'string', JSON.stringify(result))
  assert.equal(typeof result.body?.code, 'string', JSON.stringify(result))
  safeBody(result.body, fixture, token)
}

test('actual isolated LAN identity routes enforce protected metadata-only import, ownership and recovery contracts', async (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-identity-http-'))
  t.after(() => rmSync(temporary, { recursive: true, force: true }))
  const fixture = join(temporary, 'fixture')
  const lan = join(fixture, '.SYSTEMX/LAN')
  const omitted = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(originalLan, name))
  cpSync(originalLan, lan, { recursive: true, filter: (path) => !omitted.includes(path) })
  cpSync(join(repository, 'package.json'), join(fixture, 'package.json'))
  installExistingTypescript(fixture)
  put(fixture, homePath, page)
  put(fixture, 'src/pages/OtherPage.tsx', 'export default () => <h1 data-systemx-id="other">Other</h1>\n')
  put(fixture, '.env', 'SESSION_SECRET_31a9=private\n')
  put(fixture, '.SYSTEMX/LAN/Backup/private.tsx', 'SESSION_SECRET_31a9\n')
  const port = await freePort()
  const unused = await freePort()
  const origin = 'http://127.0.0.1:' + port
  const child = spawn(process.execPath, [join(lan, 'server.mjs')], {
    cwd: fixture,
    env: {
      ...process.env,
      SYSTEMX_LAN_PORT: String(port),
      SYSTEMX_APP_PORT: String(unused),
      SYSTEMX_FIREBASE_AUTH_PORT: String(unused),
      SYSTEMX_FIREBASE_FIRESTORE_PORT: String(unused),
      SYSTEMX_FIREBASE_STORAGE_PORT: String(unused),
      SYSTEMX_STRICT_PORT: 'true',
      SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_SESSION_ID: 'identity-http-' + process.pid,
      SYSTEMX_GOOGLE_FONTS_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    let healthy = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { healthy = (await fetch(origin + '/api/health', { signal: AbortSignal.timeout(500) })).ok } catch { /* Await only this owned fixture. */ }
      if (healthy || child.exitCode !== null) break
      await delay(50)
    }
    assert.ok(healthy, 'Owned identity HTTP fixture did not start: ' + output)
    const dashboard = await (await fetch(origin)).text()
    const token = dashboard.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(token, 'Fixture did not provide its LAN session token')
    const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
      const response = await fetch(origin + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000),
      })
      return { status: response.status, contentType: response.headers.get('content-type'), body: parseBody(await response.text()) }
    }
    const get = (path, headers) => request(path, { headers })
    const post = (path, body, headers = {}) => request(path, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'x-systemx-session': token, ...headers },
    })

    const status = await get('/api/identity/status')
    if (status.status === 404) {
      throw new Error('IDENTITY_HTTP_ROUTES_PENDING: Agent 0 must wire /api/identity/* into the actual server before this test can pass')
    }
    assert.equal(status.status, 200, JSON.stringify(status))
    assert.match(status.body.workspaceId, /^[a-f0-9]{64}$/)
    assert.equal(status.body.ruleVersion, 'identity-v1')
    assert.deepEqual(status.body.documents, [])
    const before = effects(fixture)
    safeBody(status.body, fixture, token)
    assert.ok([404, 405].includes((await get('/api/identity/accept')).status), 'GET must not invoke the accept route')

    const unauthenticated = await request('/api/identity/preview', {
      method: 'POST', body: { path: homePath }, headers: { 'content-type': 'application/json' },
    })
    assert.equal(unauthenticated.status, 403)
    const foreignOrigin = await post('/api/identity/preview', { path: homePath }, { origin: 'https://foreign.invalid' })
    assert.equal(foreignOrigin.status, 403)
    assert.deepEqual(effects(fixture), before)

    const invalidPath = await post('/api/identity/preview', { path: '../src/pages/HomePage.tsx' })
    refusal(invalidPath, fixture, token)
    const preview = await post('/api/identity/preview', { path: homePath, route: '/home', label: 'Private label' })
    assert.equal(preview.status, 200, JSON.stringify(preview))
    const proposal = proposalOf(preview.body)
    assert.equal(preview.body.workspaceId, status.body.workspaceId)
    assert.ok(preview.body.ownership)
    assert.equal(proposal.map.sourceRevision, sha(page))
    assert.equal(proposal.map.sourcePath, homePath)
    assert.equal(proposal.requiresReview, true)
    assert.match(proposal.digest, /^[a-f0-9]{64}$/)
    safeBody(preview.body, fixture, token)
    assert.deepEqual((await get('/api/identity/status')).body.documents, [], 'Preview silently accepted a document')
    assert.deepEqual(effects(fixture), before)

    const wrongConfirmation = await post('/api/identity/accept', { digest: proposal.digest, confirmation: 'wrong' })
    refusal(wrongConfirmation, fixture, token)
    const accepted = await post('/api/identity/accept', { digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
    assert.equal(accepted.status, 200, JSON.stringify(accepted))
    assert.equal(accepted.body.accepted, true)
    assert.equal(accepted.body.map.documentId, proposal.map.documentId)
    assert.deepEqual(effects(fixture), before)
    const map = accepted.body.map
    const headline = map.nodes.find((node) => node.anchor === 'headline')
    assert.ok(headline)
    const ref = { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: headline.id }

    const document = await get('/api/identity/document?documentId=' + encodeURIComponent(map.documentId))
    assert.equal(document.status, 200, JSON.stringify(document))
    assert.equal(document.body.map.documentId, map.documentId)
    assert.ok(document.body.ownership)
    assert.equal((await get('/api/identity/status')).body.documents.length, 1)
    const lookup = await post('/api/identity/lookup', ref)
    assert.equal(lookup.status, 200, JSON.stringify(lookup))
    assert.equal(lookup.body.status, 'resolved')
    assert.equal(lookup.body.node.id, headline.id)
    const inspect = await post('/api/identity/inspect', ref)
    assert.equal(inspect.status, 200, JSON.stringify(inspect))
    assert.ok(JSON.stringify(inspect.body).includes(headline.id))
    assert.ok(JSON.stringify(inspect.body).includes('source-owned'))
    const foreign = await post('/api/identity/lookup', { ...ref, workspaceId: sha('foreign-workspace') })
    assert.equal(foreign.status, 200)
    assert.equal(foreign.body.status, 'workspace-mismatch')

    const operation = await post('/api/identity/operation', {
      documentId: map.documentId, reference: ref, expectedRevision: sha(page), text: 'Reviewed HTTP headline',
    })
    assert.equal(operation.status, 200, JSON.stringify(operation))
    assert.equal(operation.body.allowed, true, JSON.stringify(operation))
    assert.equal(operation.body.patch.replacement, 'Reviewed HTTP headline')
    assert.equal(page.slice(operation.body.patch.start, operation.body.patch.end), 'HTTP fixture headline')
    assert.deepEqual(effects(fixture), before, 'Operation proposal wrote source or created a backup')
    const blockedOperation = await post('/api/identity/operation', {
      documentId: map.documentId, reference: { ...ref, workspaceId: sha('foreign-workspace') },
      expectedRevision: sha(page), text: 'Forbidden',
    })
    assert.ok([200, 400, 409].includes(blockedOperation.status), JSON.stringify(blockedOperation))
    if (blockedOperation.status === 200) assert.equal(blockedOperation.body.allowed, false)
    else refusal(blockedOperation, fixture, token)
    assert.deepEqual(effects(fixture), before)

    const changes = [{
      nodeId: headline.id,
      mode: 'source-owned',
      adapterId: 'tsx-static-v1',
      fields: { text: { owner: 'source', supported: true } },
      source: headline.source,
      provenance: 'Reviewed HTTP fixture',
    }]
    const ownershipPreview = await post('/api/identity/ownership/preview', { documentId: map.documentId, changes })
    assert.equal(ownershipPreview.status, 200, JSON.stringify(ownershipPreview))
    const ownershipProposal = proposalOf(ownershipPreview.body)
    assert.match(ownershipProposal.digest, /^[a-f0-9]{64}$/)
    assert.equal(ownershipProposal.requiresReview, true)
    refusal(await post('/api/identity/ownership/accept', { digest: ownershipProposal.digest, confirmation: 'wrong' }), fixture, token)
    const ownershipAccepted = await post('/api/identity/ownership/accept', {
      digest: ownershipProposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE',
    })
    assert.equal(ownershipAccepted.status, 200, JSON.stringify(ownershipAccepted))
    assert.deepEqual(effects(fixture), before)

    const exported = await post('/api/identity/export', { documentId: map.documentId })
    assert.equal(exported.status, 200, JSON.stringify(exported))
    assert.equal(exported.body.kind, 'systemx-source-document')
    assert.equal(exported.body.map.documentId, map.documentId)
    assert.ok(JSON.stringify(exported.body).length <= 400_000)
    safeBody(exported.body, fixture, token, { exportOnly: true })
    const malformed = structuredClone(exported.body)
    malformed.map.nodes[0].parentId = malformed.map.nodes[0].id
    refusal(await post('/api/identity/reopen', { document: malformed, confirmation: 'REOPEN IDENTITY DOCUMENT' }), fixture, token)
    const reopened = await post('/api/identity/reopen', { document: exported.body, confirmation: 'REOPEN IDENTITY DOCUMENT' })
    assert.equal(reopened.status, 200, JSON.stringify(reopened))
    assert.equal(reopened.body.map.documentId, map.documentId)
    assert.deepEqual(reopened.body.map.nodes.map((node) => node.id), map.nodes.map((node) => node.id))
    assert.deepEqual(effects(fixture), before)

    const pending = await post('/api/identity/preview', { path: homePath })
    assert.equal(pending.status, 200, JSON.stringify(pending))
    put(fixture, homePath, page.replace('HTTP fixture headline', 'External revision'))
    const drifted = effects(fixture)
    refusal(await post('/api/identity/accept', {
      digest: proposalOf(pending.body).digest, confirmation: 'ACCEPT IDENTITY MAP',
    }), fixture, token, [409])
    const stale = await get('/api/identity/document?documentId=' + encodeURIComponent(map.documentId))
    assert.equal(stale.status, 200)
    assert.ok(stale.body.ownership.objects.some((object) => object.status === 'stale'))
    const blocked = await post('/api/identity/operation', {
      documentId: map.documentId, reference: ref, expectedRevision: sha(page), text: 'Must refuse',
    })
    assert.ok([200, 400, 409].includes(blocked.status))
    if (blocked.status === 200) assert.equal(blocked.body.allowed, false)
    else refusal(blocked, fixture, token)
    assert.deepEqual(effects(fixture), drifted)
    for (const body of [document.body, lookup.body, inspect.body, operation.body, ownershipPreview.body, ownershipAccepted.body, stale.body]) {
      safeBody(body, fixture, token)
    }
  } finally {
    const exited = new Promise((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolveExit(true); return }
      child.once('exit', () => resolveExit(true))
    })
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    if (!await Promise.race([exited, delay(3000).then(() => false)])) {
      child.kill('SIGKILL')
      assert.ok(await Promise.race([exited, delay(2000).then(() => false)]), 'Owned HTTP fixture must exit before cleanup')
    }
  }
})
