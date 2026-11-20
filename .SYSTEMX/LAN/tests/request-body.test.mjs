import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, request as httpRequest } from 'node:http'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { readRequestBody, requestBodyLimits, RequestBodyError } from '../Builder/request-body.mjs'

const events = ['data', 'end', 'close', 'aborted', 'error']
const listeners = stream => events.map(event => stream.listenerCount(event))

function assertFailure(promise, code, statusCode, retryable, closeConnection) {
  return assert.rejects(promise, error => {
    assert.ok(error instanceof RequestBodyError)
    assert.equal(error.code, code)
    assert.equal(error.statusCode, statusCode)
    assert.equal(error.retryable, retryable)
    assert.equal(error.closeConnection, closeConnection)
    return true
  })
}

test('split bytes preserve UTF-8 across every boundary and wait for the end of a complete message', async () => {
  const stream = new PassThrough()
  const value = { text: 'Résumé 漢字 😀', flags: [true, false, null, 0] }
  const input = Buffer.from(JSON.stringify(value))
  stream.headers = { 'content-length': String(input.length) }
  stream.complete = false
  const initial = listeners(stream)
  let finished = false
  const result = readRequestBody(stream).then(value => { finished = true; return value })
  for (const byte of input) stream.write(Buffer.from([byte]))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(finished, false)
  stream.complete = true
  stream.end()
  assert.deepEqual(await result, value)
  assert.deepEqual(listeners(stream), initial)
})

test('complete JSON primitives retain their types and an empty body retains its legacy default', async () => {
  for (const [text, value] of [['null', null], ['0', 0], ['false', false], ['"text"', 'text'], ['[1]', [1]], ['', {}]]) {
    const stream = new PassThrough()
    const read = readRequestBody(stream)
    stream.end(text)
    assert.deepEqual(await read, value)
  }
  const broken = new PassThrough()
  const read = readRequestBody(broken)
  broken.end('{"private-source-text"')
  await assert.rejects(read, error => {
    assert.equal(error.message, 'Request body must be valid JSON')
    assert.equal(error.code, 'REQUEST_BODY_INVALID_JSON')
    assert.equal(error.closeConnection, false)
    return true
  })
  assert.deepEqual(listeners(broken), [0, 0, 0, 0, 0])
})

test('legacy decoded ceiling accepts a million UTF-16 units including three-byte characters', async () => {
  assert.equal(requestBodyLimits.maxTextUnits, 1_000_000)
  const text = '漢'.repeat(requestBodyLimits.maxTextUnits - 2)
  const wire = Buffer.from(JSON.stringify(text))
  assert.equal(wire.byteLength, 2_999_996)
  const stream = new PassThrough()
  const valid = readRequestBody(stream)
  stream.write(wire.subarray(0, 2))
  stream.end(wire.subarray(2))
  assert.equal(await valid, text)
  const oversized = new PassThrough()
  const rejected = readRequestBody(oversized)
  oversized.end(JSON.stringify(text + '漢'))
  await assertFailure(rejected, 'REQUEST_BODY_TOO_LARGE', 400, false, true)
  assert.deepEqual(listeners(oversized), [0, 0, 0, 0, 0])
})

test('wire cap checks declared bytes before reading and counts bytes across transfers without a length', async () => {
  assert.equal(requestBodyLimits.maxBytes, 3_000_000)
  const early = new PassThrough()
  early.headers = { 'content-length': '3000001' }
  await assertFailure(readRequestBody(early), 'REQUEST_BODY_TOO_LARGE', 400, false, true)
  assert.equal(early.listenerCount('data'), 0)
  assert.equal(early.isPaused(), true)

  const exact = new PassThrough()
  exact.headers = { 'content-length': '3000000' }
  const read = readRequestBody(exact)
  exact.end()
  await assertFailure(read, 'REQUEST_BODY_INCOMPLETE', 400, true, true)

  const streamed = new PassThrough()
  const oversized = readRequestBody(streamed)
  streamed.write(Buffer.from('"漢'))
  streamed.write(Buffer.alloc(2_999_997, 32))
  await assertFailure(oversized, 'REQUEST_BODY_TOO_LARGE', 400, false, true)
  assert.equal(streamed.isPaused(), true)
  streamed.destroy()
})

test('incomplete messages cannot dispatch a valid JSON prefix and omit stream error details', async () => {
  for (const event of ['aborted', 'close', 'error']) {
    const stream = new PassThrough()
    const existing = () => {}
    stream.on(event, existing)
    const original = listeners(stream)
    const read = readRequestBody(stream)
    stream.write('{"completeJSON":true}')
    stream.emit(event, new Error('private local stream detail'))
    await assert.rejects(read, error => {
      assert.equal(error.code, 'REQUEST_BODY_INCOMPLETE')
      assert.equal(error.message, 'Request body was not received completely')
      assert.equal(error.retryable, true)
      return true
    })
    assert.deepEqual(listeners(stream), original)
    assert.ok(stream.listeners(event).includes(existing))
    stream.destroy()
  }
  for (const incomplete of ['short', 'excess', 'http-incomplete', 'object-mode']) {
    const stream = new PassThrough({ objectMode: incomplete === 'object-mode' })
    if (incomplete === 'short') stream.headers = { 'content-length': '3' }
    if (incomplete === 'excess') stream.headers = { 'content-length': '1' }
    if (incomplete === 'http-incomplete') stream.complete = false
    const read = readRequestBody(stream)
    stream.end(incomplete === 'object-mode' ? { example: true } : '{}')
    await assertFailure(read, 'REQUEST_BODY_INCOMPLETE', 400, true, true)
  }
})

test('one absolute deadline expires while bytes arrive and leaves another request and its listeners intact', async (t) => {
  const slow = new PassThrough(), other = new PassThrough()
  const existing = () => {}
  slow.on('close', existing)
  const original = listeners(slow)
  const expiring = readRequestBody(slow, { timeoutMs: 45 })
  const independent = readRequestBody(other, { timeoutMs: 4_000 })
  slow.write(' ')
  const writer = setInterval(() => slow.write(' '), 4)
  t.after(() => clearInterval(writer))
  // Bound a regression that restarts its timer on every chunk.
  const watchdog = setTimeout(() => slow.end('{}'), 1_000)
  t.after(() => clearTimeout(watchdog))
  try {
    await assertFailure(expiring, 'REQUEST_BODY_TIMEOUT', 408, true, true)
  } finally {
    clearInterval(writer)
    clearTimeout(watchdog)
    other.end('{"ok":true}')
  }
  assert.equal(slow.isPaused(), true)
  assert.deepEqual(listeners(slow), original)
  assert.deepEqual(await independent, { ok: true })
  slow.destroy()
})

test('a complete payload delivered after the deadline cannot beat a delayed timer callback', async () => {
  const stream = new PassThrough()
  const read = readRequestBody(stream, { timeoutMs: 10 })
  // Simulate a busy event loop without allowing the timeout callback to run.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
  stream.end('{}')
  await assertFailure(read, 'REQUEST_BODY_TIMEOUT', 408, true, true)
  assert.deepEqual(listeners(stream), [0, 0, 0, 0, 0])
})

test('an already interrupted or predecoded stream is refused immediately and invalid timeout configuration is rejected', async () => {
  const ended = new PassThrough()
  ended.destroy()
  await assertFailure(readRequestBody(ended), 'REQUEST_BODY_INCOMPLETE', 400, true, true)
  const decoded = new PassThrough().setEncoding('utf8')
  await assertFailure(readRequestBody(decoded), 'REQUEST_BODY_INCOMPLETE', 400, true, true)
  assert.throws(() => readRequestBody(new PassThrough(), { timeoutMs: 0 }), RangeError)
})

test('a disconnected HTTP upload never reaches dispatch and the owned listener serves the next request', { timeout: 5_000 }, async t => {
  let signalStart, signalFailure
  const started = new Promise(resolve => { signalStart = resolve })
  const interrupted = new Promise(resolve => { signalFailure = resolve })
  const dispatched = []
  const server = createServer(async (request, response) => {
    try {
      const reading = readRequestBody(request)
      signalStart()
      dispatched.push(await reading)
      response.end('ok')
    } catch (error) {
      signalFailure(error)
      if (!response.destroyed) response.writeHead(error.statusCode, { connection: 'close' }).end(error.message)
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => {
    server.close(resolve)
    server.closeAllConnections()
  }))
  const options = { hostname: '127.0.0.1', port: server.address().port, method: 'POST', agent: false }
  const unfinished = httpRequest(options)
  unfinished.on('error', () => {})
  unfinished.write('{"completeJSON":true}')
  await started
  unfinished.destroy()
  const error = await interrupted
  assert.equal(error.code, 'REQUEST_BODY_INCOMPLETE')
  assert.deepEqual(dispatched, [])

  const complete = httpRequest(options)
  const received = once(complete, 'response')
  complete.end('0')
  const [response] = await received
  response.resume()
  await once(response, 'end')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(dispatched, [0])
})
