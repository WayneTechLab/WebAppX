import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const sourceLan = fileURLToPath(new URL('../', import.meta.url))
const host = '127.0.0.1'
const recordRoute = '/api/builder/record'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const sourceName = 'src/pages/HomePage.tsx'

function installFixture(root) {
  const lan = join(root, '.SYSTEMX', 'LAN')
  mkdirSync(lan, { recursive: true })
  for (const entry of readdirSync(sourceLan)) {
    if (['Builder', 'Website', 'Website_Dashboard.html'].includes(entry) || entry.endsWith('.mjs')) {
      cpSync(join(sourceLan, entry), join(lan, entry), { recursive: true })
    }
  }
  mkdirSync(join(root, 'src', 'pages'), { recursive: true })
  writeFileSync(join(root, sourceName), 'export default function HomePage() { return <h1>Transport fixture</h1> }\n')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'transport-fixture', private: true, version: '1.0.0' }))
}

function snapshot(root) {
  const files = {}
  function walk(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) walk(child)
      else files[child] = createHash('sha256').update(readFileSync(join(root, child))).digest('hex')
    }
  }
  for (const path of ['src', '.SYSTEMX/LAN/Files', '.SYSTEMX/LAN/Temp', '.SYSTEMX/LAN/Backup']) {
    if (existsSync(join(root, path))) walk(path)
  }
  return files
}

async function listen() {
  const server = createServer(socket => socket.end())
  const ready = once(server, 'listening')
  server.listen(0, host)
  await ready
  return server
}

async function start(root, dependencyPort) {
  // The strict child must announce its own successful bind before we send it a request.
  const reservation = await listen()
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const origin = 'http://' + host + ':' + port
  const child = spawn(process.execPath, [join(root, '.SYSTEMX', 'LAN', 'server.mjs')], {
    cwd: root,
    env: {
      ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_STRICT_PORT: 'true',
      SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_SESSION_ID: randomUUID(), SYSTEMX_GOOGLE_FONTS_API_KEY: '',
      SYSTEMX_APP_PORT: String(dependencyPort), SYSTEMX_FIREBASE_AUTH_PORT: String(dependencyPort),
      SYSTEMX_FIREBASE_FIRESTORE_PORT: String(dependencyPort), SYSTEMX_FIREBASE_STORAGE_PORT: String(dependencyPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const closed = once(child, 'close')
  let output = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = (output + chunk).slice(-8192) })
  }
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000)
    try { await closed } finally { clearTimeout(deadline) }
  }
  try {
    for (let attempts = 0; attempts < 200 && !output.includes('[SYSTEMX LAN] ' + origin + '/'); attempts++) {
      assert.equal(child.exitCode, null, 'Fixture server exited before startup: ' + output)
      await delay(25)
    }
    assert.ok(output.includes('[SYSTEMX LAN] ' + origin + '/'), 'Fixture did not announce its own listener')
    const dashboard = await fetch(origin, { signal: AbortSignal.timeout(10_000) })
    assert.equal(dashboard.status, 200)
    const html = await dashboard.text()
    const token = html.match(/name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(token, 'The isolated dashboard must supply a session')
    return { origin, token, dashboardHeaders: dashboard.headers, stop }
  } catch (error) {
    await stop()
    throw error
  }
}

async function request(server, path, { method = 'GET', headers, body } = {}) {
  const response = await fetch(server.origin + path, {
    method, headers: { 'x-systemx-session': server.token, ...headers }, body,
    signal: AbortSignal.timeout(8000),
  })
  const value = await response.text()
  return { status: response.status, headers: response.headers, body: value && JSON.parse(value) }
}

function recordBody(name) {
  return { resource: 'collections', collectionId: 'crm-contacts', record: { name } }
}

function post(server, body, headers) {
  return request(server, recordRoute, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
}

function streamPost(server, idempotencyKey) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'x-systemx-session': server.token }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const req = httpRequest(server.origin + recordRoute, {
    method: 'POST', headers, agent: false, signal: AbortSignal.timeout(25_000),
  })
  // Settle on response or a user cancellation, including before headers arrive.
  const result = once(req, 'response').then(async ([response]) => {
    const parts = []
    for await (const chunk of response) parts.push(chunk)
    return { status: response.statusCode, headers: response.headers, body: JSON.parse(Buffer.concat(parts)) }
  })
  return { req, result }
}

function correlate(headers) {
  const id = headers.get('x-systemx-request-id')
  assert.match(id, uuid)
  return id
}

test('LAN operator transport lifecycle uses an isolated server and disposable records', { timeout: 75_000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'webappx-transport-http-'))
  const dependencies = await listen()
  let server
  try {
    installFixture(root)
    server = await start(root, dependencies.address().port)
    const file = join(root, '.SYSTEMX/LAN/Files/local-data.json')
    const journal = join(root, '.SYSTEMX/LAN/Temp/operations.jsonl')
    const operations = () => existsSync(journal)
      ? readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []

    await t.test('HTML and API responses use no-store, while static assets use private revalidation', async () => {
      assert.match(server.dashboardHeaders.get('cache-control'), /\bno-store\b/)
      const health = await request(server, '/api/health')
      assert.equal(health.status, 200)
      assert.equal(health.body.status, 'online')
      assert.match(health.headers.get('cache-control'), /\bno-store\b/)
      const response = await fetch(server.origin + '/Website/dashboard.css', { signal: AbortSignal.timeout(4000) })
      assert.equal(response.status, 200)
      const policy = response.headers.get('cache-control').split(',').map(value => value.trim())
      assert.ok(policy.includes('private') && policy.includes('no-cache') && !policy.includes('no-store'))
      assert.ok((await response.text()).length > 0)
      assert.notEqual(correlate(health.headers), correlate(response.headers))
    })

    await t.test('method, media, JSON and duplicate-query refusals preserve files and report correlations', async () => {
      const before = snapshot(root)
      const method = await request(server, recordRoute)
      assert.equal(method.status, 405)
      assert.equal(method.headers.get('allow'), 'POST')
      assert.equal(method.body.code, 'METHOD_NOT_ALLOWED')
      const media = await request(server, recordRoute, {
        method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(recordBody('Private unsubmitted contact')),
      })
      assert.equal(media.status, 415)
      assert.equal(media.body.code, 'MEDIA_TYPE_UNSUPPORTED')
      const draft = 'export default function HomePage() { return <h1>Unsubmitted draft</h1> }\n'
      const source = await request(server, '/api/builder/source', {
        method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({
          path: sourceName, content: draft, confirmation: 'SAVE LOCAL CHANGE',
          baseRevision: createHash('sha256').update(readFileSync(join(root, sourceName))).digest('hex'),
        }),
      })
      assert.equal(source.status, 415)
      assert.equal(source.body.code, 'MEDIA_TYPE_UNSUPPORTED')
      const invalid = await request(server, recordRoute, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Private unsubmitted contact"',
      })
      assert.equal(invalid.status, 400)
      assert.equal(invalid.headers.get('x-systemx-transport-code'), 'REQUEST_BODY_INVALID_JSON')
      for (const path of ['/api/fonts/catalog?q=Inter&q=Inter', '/api/fonts/catalog?category=serif&category=serif', '/api/fonts/project?path=src%2Findex.css&path=src%2Findex.css']) {
        const duplicate = await request(server, path)
        assert.equal(duplicate.status, 400)
        assert.equal(duplicate.body.code, 'FONT_QUERY_INVALID')
      }
      const diagnostics = await request(server, '/api/transport/diagnostics')
      assert.equal(diagnostics.status, 200)
      const ids = new Set()
      for (const result of [method, media, invalid]) {
        const id = correlate(result.headers)
        ids.add(id)
        assert.ok(diagnostics.body.entries.some(entry => entry.transportId === id && entry.status === result.status))
      }
      assert.equal(ids.size, 3)
      const serialized = JSON.stringify([method.body, media.body, source.body, invalid.body, diagnostics.body])
      for (const privateValue of [server.token, root, draft, 'Private unsubmitted contact']) assert.ok(!serialized.includes(privateValue))
      assert.deepEqual(snapshot(root), before)
    })

    await t.test('a cancelled draft and a request past its deadline leave no records or journal changes', async () => {
      const before = snapshot(root)
      const cancelled = streamPost(server)
      const ended = assert.rejects(cancelled.result, { code: 'ECONNRESET' })
      await new Promise((resolve, reject) => cancelled.req.write('{"resource":', error => error ? reject(error) : resolve()))
      cancelled.req.destroy()
      await ended
      const stalled = streamPost(server)
      stalled.req.write('{"resource":')
      let response
      try { response = await stalled.result } finally { stalled.req.destroy() }
      assert.equal(response.status, 408)
      assert.equal(response.headers['x-systemx-transport-code'], 'REQUEST_BODY_TIMEOUT')
      assert.match(response.headers['x-systemx-request-id'], uuid)
      const health = await request(server, '/api/health')
      assert.equal(health.status, 200)
      assert.deepEqual(snapshot(root), before)
    })

    await t.test('split Unicode creation, conflict and restart preserve the row, one operation and 24-hour receipt', async () => {
      const originalSource = readFileSync(join(root, sourceName))
      const body = recordBody('Renée 🌱')
      const key = randomUUID()
      const wire = Buffer.from(JSON.stringify(body))
      const split = wire.indexOf(Buffer.from('🌱')) + 1
      const first = streamPost(server, key)
      first.req.write(wire.subarray(0, split))
      await delay(25)
      first.req.end(wire.subarray(split))
      const created = await first.result
      assert.equal(created.status, 200)
      assert.match(created.body.recordId, uuid)
      assert.deepEqual(created.body, { status: 'saved-local-record', recordId: created.body.recordId })
      const saved = JSON.parse(readFileSync(file))
      const rows = saved.collections.find(collection => collection.id === 'crm-contacts').rows
      assert.equal(rows.length, 1)
      assert.equal(rows[0].name, body.record.name)
      assert.equal(rows[0].id, created.body.recordId)
      const [receipt] = saved._recordCreateReceipts
      assert.equal(receipt.recordId, rows[0].id)
      assert.equal(receipt.expiresAt - Date.parse(rows[0].createdAt), 24 * 60 * 60 * 1000)
      assert.equal(operations().filter(item => item.event === 'local_record_created').length, 1)
      const beforeReplay = snapshot(root)
      async function replayAndCheck() {
        const same = await post(server, body, { 'Idempotency-Key': key })
        assert.equal(same.status, 200)
        assert.deepEqual(same.body, created.body)
        const conflict = await post(server, recordBody('A different contact'), { 'Idempotency-Key': key })
        assert.equal(conflict.status, 409)
        assert.equal(conflict.body.code, 'RECORD_KEY_CONFLICT')
        const publicData = await request(server, '/api/builder/data')
        assert.equal(publicData.status, 200)
        assert.deepEqual(publicData.body.collections.find(collection => collection.id === 'crm-contacts').rows, rows)
        assert.ok(!Object.hasOwn(publicData.body, '_recordCreateReceipts'))
        assert.deepEqual(snapshot(root), beforeReplay)
      }
      await replayAndCheck()
      await server.stop()
      server = await start(root, dependencies.address().port)
      await replayAndCheck()
      const unkeyed = await post(server, recordBody('Legacy client'))
      assert.equal(unkeyed.status, 200)
      assert.equal(unkeyed.body.status, 'saved-local-record')
      assert.equal(unkeyed.body.data.collections.find(collection => collection.id === 'crm-contacts').rows.length, 2)
      assert.ok(!Object.hasOwn(unkeyed.body.data, '_recordCreateReceipts'))
      assert.deepEqual(readFileSync(join(root, sourceName)), originalSource)
    })
  } finally {
    try { if (server) await server.stop() }
    finally {
      await new Promise(resolve => dependencies.close(resolve))
      rmSync(root, { recursive: true, force: true })
    }
  }
})
