import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestFeedback } from '../../.SYSTEMX/LAN/Website/request-feedback.js'

const source = '/api/builder/source?path=private%2Fworkspace%2Ffile'
const id = 'e544bc94-7a18-4a9e-b987-ae49b5adc021'
const headers = (retry = 'read-only', requestId = id, wait = '') => new Headers({
  'x-systemx-request-id': requestId, 'x-systemx-retry': retry, 'retry-after': wait,
})

function inspector() {
  const updates = []
  const observe = createRequestFeedback((state, text) => updates.push({ state, text }))
  function begin(path, options = {}) {
    let received, resolve, reject
    const operation = observe(path, options, incoming => {
      received = incoming
      return new Promise((yes, no) => { resolve = yes; reject = no })
    })
    return { operation, received, resolve, reject }
  }
  return { begin, updates, last: () => updates.at(-1) }
}

test('the source lifecycle shows only safe correlation and timing guidance and preserves responses and header callbacks', async () => {
  const ui = inspector()
  let forwarded
  const sourceRead = ui.begin(source, { onResponseHeaders: value => { forwarded = value } })
  assert.equal(ui.last().state, 'pending')
  const wireHeaders = headers('read-only', id, '2')
  sourceRead.received.onResponseHeaders(wireHeaders)
  assert.equal(forwarded, wireHeaders)
  assert.match(ui.last().text, new RegExp(id))
  const refusal = { response: { status: 429, ok: false }, result: { error: 'private body', requestId: 'private envelope id' } }
  sourceRead.resolve(refusal)
  assert.equal(await sourceRead.operation, refusal)
  assert.equal(ui.last().state, 'refused')
  assert.match(ui.last().text, /HTTP 429.*Safe to repeat this read.*Wait 2 s/)
  assert.doesNotMatch(JSON.stringify(ui.updates), /private/)
})

test('abort is immediate; stale headers, results and background reads cannot replace the latest tracked operation', async () => {
  const ui = inspector()
  const controller = new AbortController()
  const old = ui.begin(source, { signal: controller.signal })
  old.received.onResponseHeaders(headers())
  controller.abort()
  assert.equal(ui.last().state, 'cancelled')
  const next = ui.begin('/api/contracts/query', { method: 'POST' })
  const secondId = 'c3162df5-ad35-412e-9874-ae49b5adc022'
  next.received.onResponseHeaders(headers('read-only', secondId))
  const success = { response: { ok: true, status: 200 }, result: { ok: true, requestId: 'domain-canary' } }
  next.resolve(success)
  assert.equal(await next.operation, success)
  const count = ui.updates.length
  const inspect = ui.begin('/api/transport/diagnostics')
  assert.equal(inspect.received.onResponseHeaders, undefined)
  inspect.resolve(success)
  await inspect.operation
  old.received.onResponseHeaders(headers('fresh-proposal', id))
  const original = new Error('private cancellation reason')
  old.reject(original)
  await assert.rejects(old.operation, error => error === original)
  assert.equal(ui.updates.length, count)
  assert.equal(ui.last().state, 'completed')
  assert.match(ui.last().text, new RegExp(secondId))
  assert.doesNotMatch(ui.last().text, /domain-canary|private/)
})

test('unknown headers or read-only claims on writes never authorize replay; refusal and network failure retain their own outcome', async () => {
  const ui = inspector()
  for (const [path, retry, expected] of [
    ['/api/contracts/command', 'fresh-proposal', /Review a fresh revision or proposal/],
    ['/api/builder/source', 'read-only', /Verify current state/],
    ['/api/contracts/command', 'private-retry', /Verify current state/],
  ]) {
    const change = ui.begin(path, { method: 'POST' })
    change.received.onResponseHeaders(headers(retry, 'private-token', 'private-delay'))
    change.resolve({ response: { ok: false, status: 409 }, result: { error: 'private-field' } })
    await change.operation
    assert.equal(ui.last().state, 'refused')
    assert.match(ui.last().text, expected)
    assert.doesNotMatch(ui.last().text, /Safe to repeat|private|Request private-token/)
  }
  const failed = ui.begin('/api/builder/source', { method: 'POST' })
  const privateError = new Error('private URL or source')
  failed.reject(privateError)
  await assert.rejects(failed.operation, error => error === privateError)
  assert.equal(ui.last().state, 'unavailable')
  assert.match(ui.last().text, /Verify current state/)
  assert.doesNotMatch(ui.last().text, /private/)
})
