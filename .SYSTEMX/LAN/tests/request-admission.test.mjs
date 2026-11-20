import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { createServer, get } from 'node:http'
import test from 'node:test'
import { createRequestAdmission, requestAdmissionLimits } from '../Builder/request-admission.mjs'

const costlyRead = '/api/builder/source'
const command = '/api/contracts/command'
const exempt = ['/', '/Website_Dashboard.html', '/Website/dashboard.js', '/api/health', '/api/transport/diagnostics', '/api/transport/limits', '/api/transport/policy']

test('full concurrency refuses only new API dispatches and leaves health, diagnostics and limits readable', () => {
  const admission = createRequestAdmission({ now: () => 0 })
  const held = Array.from({ length: requestAdmissionLimits.maxInFlight }, () => new EventEmitter())
  for (const response of held) assert.equal(admission.admit(command, response), null)
  const full = admission.snapshot()
  assert.deepEqual(full, { schemaVersion: 1, scope: 'local-session', ...requestAdmissionLimits,
    inFlight: held.length, availableTokens: requestAdmissionLimits.burst - held.length })
  assert.equal(admission.admit(command, held[0]), null, 'The same in-flight response consumes only one slot')
  const refused = new EventEmitter()
  const refusal = admission.admit(costlyRead, refused)
  assert.equal(refusal.code, 'REQUEST_CONCURRENCY_LIMIT')
  assert.equal(refusal.scope, 'local-session')
  assert.equal(refusal.retryAfterSeconds, 1)
  assert.equal(refused.listenerCount('finish'), 0)
  assert.equal(refused.listenerCount('close'), 0)
  for (const pathname of exempt) assert.equal(admission.admit(pathname, new EventEmitter()), null)
  assert.deepEqual(admission.snapshot(), full)

  // A response normally emits finish followed by close. An interrupted one can
  // emit close alone. Neither event may release a different command's slot.
  admission.complete(held[0])
  admission.complete(held[0])
  assert.equal(admission.snapshot().inFlight, full.maxInFlight, 'A handler can finish before the response flushes')
  held[0].prependOnceListener('finish', () => held[0].emit('close'))
  held[0].emit('finish')
  const next = new EventEmitter()
  assert.equal(admission.admit(costlyRead, next), null)
  held[0].emit('close')
  assert.equal(admission.snapshot().inFlight, full.maxInFlight)
  assert.equal(admission.admit(command, new EventEmitter()).code, 'REQUEST_CONCURRENCY_LIMIT')
  next.emit('close')
  next.emit('finish')
  assert.equal(admission.snapshot().inFlight, full.maxInFlight, 'An early close cannot free a slot while its handler is running')
  admission.complete(next)
  admission.complete(next)
  for (const response of held.slice(1)) {
    response.emit('finish')
    admission.complete(response)
  }
  assert.equal(admission.snapshot().inFlight, 0)
})

test('all admitted APIs share a finite burst and refill; refusals and inspection never spend a token', () => {
  let time = 1000
  const admission = createRequestAdmission({ now: () => time })
  const { burst, refillPerSecond } = requestAdmissionLimits
  for (let i = 0; i < burst; i++) {
    const response = new EventEmitter()
    assert.equal(admission.admit(i % 2 ? command : costlyRead, response), null)
    response.emit('finish')
    admission.complete(response)
  }
  const exhausted = admission.snapshot()
  assert.equal(exhausted.availableTokens, 0)
  assert.equal(exhausted.inFlight, 0)
  const refused = admission.admit('/api/status', new EventEmitter())
  assert.equal(refused.code, 'REQUEST_RATE_LIMIT')
  assert.equal(refused.scope, 'local-session')
  assert.equal(refused.retryAfterSeconds, 1)
  for (const pathname of exempt) assert.equal(admission.admit(pathname, new EventEmitter()), null)
  assert.deepEqual(admission.snapshot(), exhausted)

  const interval = 1000 / refillPerSecond
  time += interval / 2
  assert.equal(admission.admit(command, new EventEmitter()).code, 'REQUEST_RATE_LIMIT')
  time += interval / 2
  const first = new EventEmitter()
  assert.equal(admission.admit(command, first), null)
  assert.equal(admission.snapshot().availableTokens, 0)
  first.emit('close')
  admission.complete(first)
  assert.equal(admission.snapshot().availableTokens, 0, 'A disconnect releases capacity but does not refund a served request')

  time = 0
  assert.equal(admission.snapshot().availableTokens, 0)
  time = 1000 + interval
  assert.equal(admission.snapshot().availableTokens, 0, 'Moving the clock backward must not mint tokens')
  time += 60_000
  assert.equal(admission.snapshot().availableTokens, burst, 'Idle time cannot increase the burst allowance')
})

test('a disconnected loopback client holds its slot until local work finishes; inspection and recovery stay usable', { timeout: 5000 }, async t => {
  const admission = createRequestAdmission({ now: () => 0 })
  let notifyClose
  const interrupted = new Promise(resolve => { notifyClose = resolve })
  let finishWork, notifySettled
  const work = new Promise(resolve => { finishWork = resolve })
  const settled = new Promise(resolve => { notifySettled = resolve })
  const server = createServer((req, res) => {
    async function handle() {
      const refusal = admission.admit(req.url, res)
      if (refusal) {
        res.writeHead(429, { 'Retry-After': String(refusal.retryAfterSeconds), 'Content-Type': 'application/json' })
        res.end(JSON.stringify(refusal))
        return
      }
      if (req.url === costlyRead) {
        res.once('close', notifyClose)
        res.write('fixture response started')
        await work
        return
      }
      res.end('ready')
    }
    void handle().finally(() => {
      admission.complete(res)
      if (req.url === costlyRead) notifySettled()
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { finishWork(); server.close(resolve); server.closeAllConnections() }))
  const origin = 'http://127.0.0.1:' + server.address().port
  // Reserve the other slots in memory. The socket test needs only one live
  // uncompleted request, regardless of the production concurrency budget.
  const reserved = Array.from({ length: requestAdmissionLimits.maxInFlight - 1 }, () => new EventEmitter())
  for (const response of reserved) assert.equal(admission.admit(command, response), null)
  const [partial] = await once(get(origin + costlyRead), 'response')
  assert.equal(partial.statusCode, 200)
  partial.destroy()
  await interrupted
  assert.equal(admission.snapshot().inFlight, requestAdmissionLimits.maxInFlight)
  const denied = await fetch(origin + '/api/status')
  assert.equal(denied.status, 429)
  assert.equal(denied.headers.get('retry-after'), '1')
  assert.equal((await denied.json()).scope, 'local-session')
  assert.equal(await (await fetch(origin + '/api/health')).text(), 'ready')
  finishWork()
  await settled
  assert.equal(await (await fetch(origin + '/api/status')).text(), 'ready')
  for (const response of reserved) {
    admission.complete(response)
    response.emit('finish')
  }
  assert.equal(admission.snapshot().inFlight, 0)
})
