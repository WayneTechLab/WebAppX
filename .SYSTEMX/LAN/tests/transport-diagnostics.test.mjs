import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomInt } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../Builder/runtime/port-utils.mjs'

const lan = fileURLToPath(new URL('../', import.meta.url))
const endpoint = '/api/transport/diagnostics'
const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/

async function startFixture(t) {
  const fixture = await mkdtemp(join(tmpdir(), 'webappx-transport-'))
  const target = join(fixture, '.SYSTEMX', 'LAN')
  let child, stopped
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill()
    if (stopped) await stopped
    await rm(fixture, { recursive: true, force: true })
  })
  await mkdir(target, { recursive: true })
  for (const path of ['Builder', 'Website', 'Website_Dashboard.html', 'server.mjs', 'session-restart-preview.mjs', 'work-status.mjs']) {
    await cp(join(lan, path), join(target, path), { recursive: true })
  }
  const port = String(await findAvailablePort(randomInt(20000, 60000)))
  child = spawn(process.execPath, [join(target, 'server.mjs')], {
    cwd: fixture,
    env: { ...process.env, PATH: dirname(process.execPath), SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_LAN_PORT: port, SYSTEMX_APP_PORT: port, SYSTEMX_FIREBASE_AUTH_PORT: port,
      SYSTEMX_FIREBASE_FIRESTORE_PORT: port, SYSTEMX_FIREBASE_STORAGE_PORT: port,
      SYSTEMX_STRICT_PORT: 'true' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  stopped = once(child, 'close')
  const lines = createInterface({ input: child.stdout })
  const [line] = await Promise.race([
    once(lines, 'line', { signal: AbortSignal.timeout(8000) }),
    stopped.then(() => { throw new Error('Owned LAN fixture stopped before announcing its port') }),
  ])
  lines.close()
  const origin = `http://127.0.0.1:${port}`
  assert.equal(line, `[SYSTEMX LAN] ${origin}/`)
  const send = (path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = request(origin, { path, method, headers, agent: false, signal: AbortSignal.timeout(8000) }, res => {
      let text = ''
      res.setEncoding('utf8').on('data', part => { text += part })
      res.once('error', reject)
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, id: res.headers['x-systemx-request-id'], text }))
    })
    req.once('error', reject)
    req.end(body)
  })
  return { target, send }
}

test('loopback LAN correlates completed responses and exposes only bounded session-local transport metadata', async t => {
  const { target, send } = await startFixture(t)
  const dashboard = await send('/')
  assert.equal(dashboard.status, 200)
  assert.match(dashboard.id, uuid)
  const token = dashboard.text.match(/<meta name="systemx-session" content="([\da-f]{48})"/)?.[1]
  assert.ok(token)
  const headers = { 'x-systemx-session': token }
  const read = () => send(endpoint, { headers })

  await t.test('each success and refusal has a new transport ID, while a versioned caller retains its own ID', async () => {
    const health = await send('/api/health?private=PRIVATE_QUERY', { headers: { 'x-systemx-request-id': 'PRIVATE_HEADER' } })
    const asset = await send('/Website/dashboard.css', { method: 'HEAD' })
    const missing = await send('/PRIVATE_FILE')
    const noSession = await send(endpoint)
    const wrongSession = await send(endpoint, { headers: { 'x-systemx-session': 'PRIVATE_TOKEN' } })
    const badHost = await send(endpoint, { headers: { ...headers, host: 'private.invalid' } })
    const badOrigin = await send(endpoint, { headers: { ...headers, origin: 'https://private.invalid' } })
    const method = await send(endpoint, { method: 'POST', headers, body: 'PRIVATE_BODY' })
    const oddMethod = await send('/api/health', { method: 'PROPFIND' })
    const badQuery = await send(endpoint + '?filter=PRIVATE_QUERY', { headers })
    const envelope = { apiVersion: '1.1', requestId: 'PRIVATE_ENVELOPE_ID', kind: 'query',
      operation: 'graph.status', payload: { type: 'graph.status' } }
    const contract = await send('/api/contracts/query', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(envelope) })
    const badBody = await send('/api/contracts/query', { method: 'POST', headers, body: 'PRIVATE_INVALID_JSON' })
    assert.equal(JSON.parse(contract.text).requestId, envelope.requestId)
    assert.notEqual(contract.id, envelope.requestId)
    assert.equal(method.headers.allow, 'GET')
    assert.equal(noSession.text.includes('"entries"'), false)
    const check = await read()
    assert.equal(check.status, 200)
    assert.match(check.headers['cache-control'], /no-store/)
    const snapshot = JSON.parse(check.text)
    assert.deepEqual(Object.keys(snapshot).sort(), ['entries', 'limit', 'schemaVersion'])
    assert.equal(snapshot.schemaVersion, 1)
    assert.equal(snapshot.limit, 64)
    const expected = [
      [dashboard, 'GET', 'dashboard', 200], [health, 'GET', 'health', 200], [asset, 'HEAD', 'assets', 200],
      [missing, 'GET', 'other', 404], [noSession, 'GET', 'diagnostics', 403], [wrongSession, 'GET', 'diagnostics', 403],
      [badHost, 'GET', 'other', 403], [badOrigin, 'GET', 'other', 403], [method, 'POST', 'diagnostics', 405],
      [oddMethod, 'OTHER', 'health', 405], [badQuery, 'GET', 'diagnostics', 400],
      [contract, 'POST', 'contracts', 200], [badBody, 'POST', 'contracts', 400],
    ]
    assert.match(check.id, uuid)
    assert.deepEqual(snapshot.entries.map(row => row.transportId), expected.map(([reply]) => reply.id).reverse())
    assert.equal(new Set([...expected.map(([reply]) => reply.id), check.id]).size, expected.length + 1)
    for (const [reply, method, category, status] of expected) {
      assert.match(reply.id, uuid)
      assert.equal(reply.status, status)
      const row = snapshot.entries.find(item => item.transportId === reply.id)
      assert.deepEqual(Object.keys(row).sort(), ['category', 'durationMs', 'method', 'status', 'transportId'])
      assert.deepEqual([row.method, row.category, row.status], [method, category, status])
      assert.ok(Number.isSafeInteger(row.durationMs) && row.durationMs >= 0)
    }
    assert.doesNotMatch(check.text, /PRIVATE_|private\.invalid|api\/contracts|Website\/|x-systemx-session/)
    assert.ok(!check.text.includes(token) && !check.text.includes(target))
  })

  await t.test('an unexpected handler error returns a correlated safe 500 and leaves health available', async () => {
    await writeFile(join(target, 'Files', 'local-data.json'), 'null')
    const response = await send('/api/builder/workspace?target=PRIVATE_FAULT')
    assert.equal(response.status, 500)
    assert.match(response.id, uuid)
    assert.deepEqual(JSON.parse(response.text), { error: 'The local LAN request could not be completed.' })
    const [failure] = JSON.parse((await read()).text).entries
    assert.deepEqual([failure.transportId, failure.category, failure.status], [response.id, 'builder', 500])
    assert.equal((await send('/api/health')).status, 200)
  })

  await t.test('the 64 most recently completed responses survive eviction in newest-first order', async () => {
    const ids = []
    for (let index = 0; index < 66; index++) ids.push((await send('/api/health', { method: 'HEAD' })).id)
    const snapshot = JSON.parse((await read()).text)
    assert.equal(snapshot.entries.length, 64)
    assert.deepEqual(snapshot.entries.map(row => row.transportId), ids.slice(-64).reverse())
  })
})
