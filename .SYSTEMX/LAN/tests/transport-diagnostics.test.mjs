import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomInt } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rename, rm, truncate, writeFile } from 'node:fs/promises'
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

async function startFixture(t, prepare) {
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
  if (prepare) await prepare(target)
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
  return { target, send, origin }
}

test('loopback LAN correlates completed responses and exposes only bounded session-local transport metadata', async t => {
  const { target, send, origin } = await startFixture(t)
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
    const badBody = await send('/api/contracts/query', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: 'PRIVATE_INVALID_JSON' })
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
      [dashboard, 'GET', 'dashboard', 200], [health, 'GET', 'health', 400], [asset, 'HEAD', 'assets', 200],
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

  await t.test('interrupting a live response records one cancellation with its issued ID and no HTTP status', async () => {
    // A sparse fixture keeps the stream open past the first chunk on loopback.
    const asset = join(target, 'Website', 'PRIVATE_STREAM.css')
    await writeFile(asset, '')
    await truncate(asset, 32 * 1024 * 1024)
    const interruptedId = await new Promise((resolve, reject) => {
      const req = request(origin, { path: '/Website/PRIVATE_STREAM.css?PRIVATE_QUERY', agent: false, signal: AbortSignal.timeout(8000) }, res => {
        res.once('error', reject)
        res.once('data', () => {
          resolve(res.headers['x-systemx-request-id'])
          res.destroy()
        })
      })
      req.once('error', reject)
      req.end()
    })
    assert.match(interruptedId, uuid)
    // Poll the owned server until it has observed the peer close.
    let row
    const deadline = performance.now() + 3000
    do {
      const result = await read()
      assert.equal(result.status, 200)
      assert.ok(!result.text.includes('PRIVATE_STREAM'))
      const matches = JSON.parse(result.text).entries.filter(item => item.transportId === interruptedId)
      assert.ok(matches.length <= 1)
      row = matches[0]
      if (!row) await new Promise(resolve => setTimeout(resolve, 20))
    } while (!row && performance.now() < deadline)
    assert.ok(row, 'Missing cancellation record')
    assert.deepEqual(Object.keys(row).sort(), ['category', 'durationMs', 'method', 'outcome', 'status', 'transportId'])
    assert.deepEqual([row.method, row.category, row.status, row.outcome], ['GET', 'assets', null, 'cancelled'])
    assert.ok(Number.isSafeInteger(row.durationMs) && row.durationMs >= 0)
    const health = await send('/api/health')
    assert.equal(health.status, 200)
    const final = JSON.parse((await read()).text).entries
    assert.equal(final.filter(item => item.transportId === interruptedId).length, 1)
    assert.equal(final.filter(item => item.transportId === health.id).length, 1)
  })

  await t.test('an unexpected handler error returns a correlated safe 500 and leaves health available', async () => {
    await writeFile(join(target, 'Files', 'local-data.json'), 'null')
    const response = await send('/api/builder/workspace')
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

test('LAN admits normal API work and reports a pre-body 429 without blocking guarded transport inspections', async t => {
  const { send } = await startFixture(t, async target => {
    // Give this disposable server a stationary clock and one remaining token.
    // Seed the real bucket in memory. No traffic burst or open socket is needed.
    const module = join(target, 'Builder', 'request-admission.mjs')
    await rename(module, join(target, 'Builder', 'fixture-real-admission.mjs'))
    await writeFile(module, `
      import { EventEmitter } from 'node:events'
      import { createRequestAdmission as create, requestAdmissionLimits } from './fixture-real-admission.mjs'
      export function createRequestAdmission() {
        const admission = create({ now: () => 0 })
        for (let i = 1; i < requestAdmissionLimits.burst; i++) {
          const response = new EventEmitter()
          admission.admit('/api/builder/data', response)
          response.emit('finish')
          admission.complete(response)
        }
        return admission
      }
    `)
  })
  const dashboard = await send('/')
  const token = dashboard.text.match(/<meta name="systemx-session" content="([\da-f]{48})"/)?.[1]
  assert.ok(token)
  const headers = { 'x-systemx-session': token }
  const limits = '/api/transport/limits'
  const policy = '/api/transport/policy'
  const inspect = async path => {
    const response = await send(path, { headers })
    assert.equal(response.status, 200)
    return JSON.parse(response.text)
  }
  for (const path of [limits, policy]) {
    assert.equal((await send(path)).status, 403)
    assert.equal((await send(path + '?filter=private', { headers })).status, 400)
    const wrongMethod = await send(path, { method: 'POST', headers })
    assert.equal(wrongMethod.status, 405)
    assert.equal(wrongMethod.headers.allow, 'GET')
  }
  const before = await inspect(limits)
  assert.equal(before.scope, 'local-session')
  assert.equal(before.availableTokens, 1)
  assert.equal(before.inFlight, 0)
  assert.equal((await send('/api/builder/data')).status, 200)
  assert.deepEqual(await inspect(limits), { ...before, availableTokens: 0 })

  // Both an ordinary POST and the compatibility read of a wrong-route graph
  // envelope would return invalid-body errors if parsing happened before admission.
  for (const path of ['/api/builder/preview', '/api/contracts/discovery']) {
    const response = await send(path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{' })
    assert.equal(response.status, 429)
    assert.equal(response.headers['retry-after'], '1')
    assert.equal(response.headers['x-systemx-transport-code'], 'REQUEST_RATE_LIMIT')
    assert.equal(response.headers.connection, 'close')
    const body = JSON.parse(response.text)
    assert.equal(body.code, 'REQUEST_RATE_LIMIT')
    assert.equal(body.scope, 'local-session')
    assert.equal(body.retryAfterSeconds, 1)
  }
  assert.equal((await send('/api/health')).status, 200)
  assert.equal((await inspect(policy)).schemaVersion, 1)
  const checked = await send(limits, { headers })
  assert.deepEqual(JSON.parse(checked.text), { ...before, availableTokens: 0 })
  const recent = await inspect(endpoint)
  assert.equal(recent.entries.find(row => row.transportId === checked.id)?.category, 'diagnostics')
})

test('singleton URL inputs preserve status and typed errors; refused mutations leave fixture bytes intact', async t => {
  const sourcePath = 'src/pages/HomePage.tsx'
  const source = 'export function HomePage() { return <main>Fixture</main> }\n'
  const { target, send } = await startFixture(t, async lanRoot => {
    const file = join(lanRoot, '..', '..', sourcePath)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, source)
  })
  const dashboard = await send('/')
  const token = dashboard.text.match(/<meta name="systemx-session" content="([\da-f]{48})"/)?.[1]
  assert.ok(token)
  const headers = { 'x-systemx-session': token, 'content-type': 'application/json' }
  const read = async path => {
    const response = await send(path, { headers })
    assert.equal(response.status, 200, path)
    return JSON.parse(response.text)
  }
  const post = (path, value) => send(path, { method: 'POST', headers, body: JSON.stringify(value) })
  const files = ['Files/local-data.json', 'Files/component-registry.json', '../../' + sourcePath]
  const readBytes = () => Promise.all(files.map(file => readFile(join(target, file))))
  const before = await readBytes()

  const css = await send('/Website/dashboard.css')
  const cachedCss = await send('/Website/dashboard.css?ui=first&ui=second')
  assert.equal(css.status, 200)
  assert.equal(cachedCss.status, 200)
  assert.equal(cachedCss.text, css.text)
  for (const [path, first, second] of [
    ['/api/fonts/catalog', 'q=Inter&category=sans-serif', 'category=sans-serif&q=Inter'],
    ['/api/builder/source/inventory', 'extension=.tsx&search=Home&limit=1', 'limit=1&search=Home&extension=.tsx'],
  ]) assert.deepEqual(await read(path + '?' + first), await read(path + '?' + second))
  const selection = async query => (await read('/api/status?' + query)).operating.workStatus.adoptedProject
  assert.deepEqual(await selection('project=Fixture&workScope=child'), await selection('workScope=child&project=Fixture'))
  for (const query of ['workScope=root&workScope=child', 'workScope=root&unknown=1']) {
    assert.equal((await selection(query)).diagnostic, 'invalid-scope-selection')
  }

  for (const [path, code] of [
    ['/api/health?unknown=1', 'QUERY_INVALID'], ['/api/builder/data?resource=A&resource=B', 'QUERY_INVALID'],
    ['/api/fonts/catalog?q=one&%71=two', 'FONT_QUERY_INVALID'], ['/api/fonts/project?extra=1', 'FONT_QUERY_INVALID'],
    ['/api/builder/source?path=a&path=b', 'SOURCE_QUERY_INVALID'],
    ['/api/builder/source/history?path=a&limit=1&limit=1', 'SOURCE_HISTORY_QUERY_INVALID'],
    ['/api/identity/document?documentId=a&%64ocumentId=b', 'IDENTITY_QUERY_INVALID'],
  ]) {
    const response = await send(path, { headers })
    assert.equal(response.status, 400, path)
    assert.equal(JSON.parse(response.text).code, code, path)
  }
  const loaded = await read('/api/builder/source?path=' + encodeURIComponent(sourcePath))
  assert.equal(loaded.content, source)
  const sourceWrite = { confirmation: 'SAVE LOCAL CHANGE', path: sourcePath, baseRevision: loaded.revision, content: source.replace('Fixture', 'Draft') }
  for (const [path, value, code] of [
    ['/api/builder/source?path=a&path=b', sourceWrite, 'QUERY_INVALID'],
    ['/api/builder/record?resource=users', { resource: 'users', record: { name: 'Fixture' } }, 'QUERY_INVALID'],
    ['/api/identity/preview?route=a&route=b', { path: sourcePath }, 'IDENTITY_QUERY_INVALID'],
  ]) {
    const response = await post(path, value)
    assert.equal(response.status, 400, path)
    assert.equal(response.headers.connection, 'close')
    assert.equal(JSON.parse(response.text).code, code, path)
  }
  for (const kind of ['query', 'command']) {
    const response = await post('/api/contracts/' + kind + '?operation=a&operation=b', { apiVersion: '1.0', requestId: 'retainedId', kind })
    const envelope = JSON.parse(response.text)
    assert.equal(response.status, 400)
    assert.deepEqual([envelope.apiVersion, envelope.requestId, envelope.ok, envelope.error.code], ['1.0', 'retainedId', false, 'GRAPH_QUERY_INVALID'])
  }
  assert.deepEqual(await readBytes(), before)
})
