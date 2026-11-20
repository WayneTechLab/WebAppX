import assert from 'node:assert/strict'
import test from 'node:test'
import { createLanConnection } from '../../.SYSTEMX/LAN/Website/lan-connection.js'

const status = { repository: { workspaceId: 'a'.repeat(64) }, session: { id: 'local-session' } }
const diagnostics = { schemaVersion: 1, limit: 64, entries: [] }
const transportId = '77777777-7777-4777-8777-777777777777'

function setup() {
  const events = []
  const gate = createLanConnection((state, message) => events.push({ state, message }))
  gate.observeStatus(status)
  const drop = () => assert.rejects(gate.readResponse('/api/builder/source', { method: 'POST' },
    async () => { throw new TypeError('private untrusted transport text') }), { code: 'LAN_CONNECTION_LOST', kind: 'transport' })
  return { events, gate, drop }
}

test('an uncertain mutation is never replayed, and read-only operations continue throughout recovery', async () => {
  const { events, gate, drop } = setup()
  await drop()
  assert.equal(gate.blocked, true)
  assert.doesNotMatch(events.at(-1).message, /private/)
  let mutations = 0
  async function mutation() {
    return gate.readResponse('/api/builder/source', { method: 'POST' }, async () => {
      mutations++
      return Response.json({ accepted: true })
    })
  }
  await assert.rejects(mutation(), { code: 'LAN_STATUS_REQUIRED' })
  for (const [path, method] of [['/api/builder/source', 'GET'], ['/api/contracts/query', 'POST']]) {
    const { result } = await gate.readResponse(path, { method }, async () => Response.json({ read: true }))
    assert.equal(result.read, true)
  }
  const calls = []
  await Promise.all([0, 1].map(() => gate.reconnect(async (path, options) => {
    calls.push(path)
    assert.equal(options.signal.aborted, false)
    return path === '/api/status' ? status : diagnostics
  })))
  assert.deepEqual(calls, ['/api/status', '/api/transport/diagnostics'])
  assert.equal(mutations, 0)
  assert.equal(gate.blocked, false)
  await mutation()
  assert.equal(mutations, 1)
})

test('foreign checkout, different supervisor session and rotated credential all keep the mutation gate closed', async () => {
  const { events, gate, drop } = setup()
  await drop()
  for (const foreign of [{ ...status, repository: { workspaceId: 'b'.repeat(64) } }, { ...status, session: { id: 'restarted' } }, {}]) {
    gate.observeStatus(foreign)
    const calls = []
    await gate.reconnect(async path => { calls.push(path); return foreign })
    assert.equal(gate.blocked, true)
    assert.match(events.at(-1).message, /could not be verified/)
    assert.deepEqual(calls, ['/api/status'])
  }
  await gate.reconnect(async path => {
    if (path === '/api/status') return status
    throw Object.assign(new Error('private error'), { status: 403, transportId })
  })
  assert.equal(gate.blocked, true)
  assert.match(events.at(-1).message, /session expired/)
  assert.ok(events.at(-1).message.includes(transportId))
  assert.doesNotMatch(events.at(-1).message, /private/)
})

test('cancelled reads and JSON domain refusals leave the connection available; an interrupted response body pauses mutations', async () => {
  const { events, gate } = setup()
  const controller = new AbortController()
  const cancelled = gate.readResponse('/api/builder/source', { signal: controller.signal }, async () => {
    controller.abort()
    throw controller.signal.reason
  })
  await assert.rejects(cancelled, { name: 'AbortError' })
  const { response, result } = await gate.readResponse('/api/builder/source', { method: 'POST' }, async () =>
    Response.json({ error: 'revision conflict' }, { status: 409 }))
  assert.equal(response.status, 409)
  assert.equal(result.error, 'revision conflict')
  assert.deepEqual(events, [])
  const stream = new ReadableStream({ start(c) { c.error(new TypeError('private stack')) } })
  await assert.rejects(gate.readResponse('/api/builder/source', { method: 'POST' }, async () =>
    new Response(stream, { headers: { 'x-systemx-request-id': transportId } })), { kind: 'transport', transportId })
  assert.equal(gate.blocked, true)
  assert.ok(events.at(-1).message.includes(transportId))
  assert.doesNotMatch(events.at(-1).message, /private/)
})

test('a failure during a reconnect invalidates its late response; an older request cannot relock a verified session', async () => {
  const { events, gate, drop } = setup()
  const oldRead = Promise.withResolvers()
  const oldResult = gate.readResponse('/api/builder/source', {}, () => oldRead.promise)
  await drop()
  const delayedStatus = Promise.withResolvers()
  const stale = gate.reconnect(() => delayedStatus.promise)
  await assert.rejects(gate.readResponse('/api/health', {}, async () => { throw new TypeError() }), { code: 'LAN_CONNECTION_LOST' })
  await gate.reconnect(async path => path === '/api/status' ? status : diagnostics)
  delayedStatus.resolve({ ...status, session: { id: 'foreign' } })
  await stale
  oldRead.reject(new TypeError())
  await assert.rejects(oldResult, { code: 'LAN_CONNECTION_LOST' })
  assert.equal(gate.blocked, false)
  assert.equal(events.at(-1).state, 'ready')
})
