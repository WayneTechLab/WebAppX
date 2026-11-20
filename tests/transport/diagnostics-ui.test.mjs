import assert from 'node:assert/strict'
import test from 'node:test'
import { attachTransportDiagnostics } from '../../.SYSTEMX/LAN/Website/transport-diagnostics.js'
import { getTransportPolicy } from '../../.SYSTEMX/LAN/Builder/transport-policy.mjs'
import { createRequestAdmission } from '../../.SYSTEMX/LAN/Builder/request-admission.mjs'

const firstId = '66666666-6666-4666-8666-666666666666'
const nextId = '77777777-7777-4777-8777-777777777777'
const entry = (transportId = firstId) => ({ transportId, method: 'GET', category: 'builder', status: 200, durationMs: 7 })
const snapshot = (...entries) => ({ schemaVersion: 1, limit: 64, entries })
const settle = () => new Promise(resolve => setImmediate(resolve))

function inspector() {
  const controls = new Map()
  const doc = { createElement: () => new Element() }
  class Element extends EventTarget {
    dataset = {}
    attributes = new Map()
    children = []
    textContent = ''
    ownerDocument = doc
    querySelector(selector) { return controls.get(selector) }
    setAttribute(name, value) { this.attributes.set(name, value) }
    removeAttribute(name) { this.attributes.delete(name) }
    get childElementCount() { return this.children.length }
    append(...children) { this.children.push(...children) }
    replaceChildren(...children) { this.children = children }
    focus() { doc.activeElement = this }
  }
  const [panel, status, refresh, cancel, entries, policyRead, policyStatus, policySummary] = [
    'diagnostics', 'status', 'read', 'cancel', 'entries', 'policy-read', 'policy-status', 'policy-summary',
  ].map(name => {
    const element = new Element()
    controls.set(`#transport-${name}`, element)
    return element
  })
  const requests = []
  attachTransportDiagnostics(panel, (path, options) => new Promise((resolve, reject) => {
    requests.push({ path, options, resolve, reject })
  }))
  function toggle(open) {
    panel.open = open
    panel.dispatchEvent(new Event('toggle'))
  }
  const click = element => element.dispatchEvent(new Event('click'))
  return { requests, status, refresh, cancel, entries, policyRead, policyStatus, policySummary, click, toggle, doc }
}

test('policy reads publish only verified summaries and cannot replace a completed view after folding or cancellation', async () => {
  const ui = inspector()
  ui.toggle(true)
  ui.requests[0].resolve(snapshot())
  await settle()
  assert.equal(ui.requests.length, 1)
  const limits = createRequestAdmission().snapshot()
  const rules = getTransportPolicy()
  ui.click(ui.policyRead)
  const [oldLimits, oldPolicy] = ui.requests.slice(-2)
  ui.toggle(false)
  assert.equal(oldLimits.options.signal.aborted, true)
  assert.equal(oldPolicy.options.signal.aborted, true)
  ui.toggle(true)
  ui.requests.at(-1).resolve(snapshot())
  ui.click(ui.policyRead)
  const [currentLimits, currentPolicy] = ui.requests.slice(-2)
  currentPolicy.resolve(rules)
  currentLimits.resolve(limits)
  await settle()
  assert.equal(ui.policyStatus.dataset.state, 'completed')
  const rendered = () => ui.policySummary.children.map(row => row.textContent)
  const verified = rendered()
  assert.equal(verified.length, 10)
  oldLimits.resolve({ ...limits, burst: 1 })
  oldPolicy.reject(new Error('PRIVATE_STALE_POLICY'))
  await settle()
  assert.deepEqual(rendered(), verified)
  for (const [budget, policy] of [
    [{ ...limits, inFlight: limits.maxInFlight + 1 }, rules], [limits, { ...rules, retry: {} }],
    [limits, { ...rules, retry: { ...rules.retry, 'idempotent-keyed': { ...rules.retry['idempotent-keyed'], route: '/private-route' } } }],
  ]) {
    ui.click(ui.policyRead)
    const [remaining, contract] = ui.requests.slice(-2)
    remaining.resolve(budget)
    contract.resolve(policy)
    await settle()
    assert.equal(ui.policyStatus.dataset.state, 'unavailable')
    assert.deepEqual(rendered(), verified)
    assert.doesNotMatch(ui.policyStatus.textContent, /private/i)
  }
  assert.equal(ui.status.dataset.state, 'completed')
})

test('only the latest explicit read owns the status and rows, even if cancelled requests settle later', async () => {
  const ui = inspector()
  assert.equal(ui.requests.length, 0)
  ui.toggle(true)
  const [old] = ui.requests
  assert.equal(old.path, '/api/transport/diagnostics')
  assert.equal(old.options.method, 'GET')
  assert.equal(ui.status.dataset.state, 'pending')
  ui.click(ui.refresh)
  assert.equal(ui.requests.length, 1)
  ui.cancel.focus()
  ui.click(ui.cancel)
  assert.equal(old.options.signal.aborted, true)
  assert.equal(ui.status.dataset.state, 'cancelled')
  assert.equal(ui.refresh.textContent, 'Retry')
  assert.equal(ui.doc.activeElement, ui.refresh)
  ui.click(ui.refresh)
  const next = ui.requests[1]
  next.options.onResponseHeaders(new Headers({ 'x-systemx-request-id': firstId }))
  next.resolve(snapshot(entry(nextId)))
  await settle()
  old.reject(new Error('older failure'))
  await settle()
  assert.equal(ui.entries.children[0].children[0], 'GET · builder · HTTP 200 · 7 ms')
  assert.equal(ui.entries.children[0].children[1].textContent, nextId)
  assert.equal(ui.status.textContent, `Read complete. 1 recent request. Request ${firstId}.`)
  ui.click(ui.refresh)
  const closing = ui.requests[2]
  ui.toggle(false)
  assert.equal(closing.options.signal.aborted, true)
  closing.resolve(snapshot())
  await settle()
  assert.equal(ui.status.dataset.state, 'cancelled')
  assert.equal(ui.entries.childElementCount, 1)
  ui.toggle(true)
  ui.requests[3].resolve(snapshot())
  await settle()
  assert.equal(ui.entries.childElementCount, 0)
  assert.equal(ui.status.textContent, 'Read complete. No recent requests.')
})

test('unrecognized fields, identifiers, private error messages and over-budget results never replace the last verified view', async () => {
  const ui = inspector()
  ui.toggle(true)
  ui.requests[0].resolve(snapshot(entry()))
  await settle()
  for (const invalid of [
    snapshot({ ...entry(), privatePath: '/private/draft' }),
    { ...snapshot(entry()), privateMetadata: '/private/draft' },
    snapshot({ ...entry(), outcome: 'cancelled' }),
    snapshot({ ...entry(), status: null }),
    snapshot({ ...entry(), status: null, outcome: '/private/value' }),
    snapshot({ ...entry(), status: null, outcome: 'cancelled', reason: '/private/draft' }),
    snapshot({ ...entry(), category: '/private/source' }),
    snapshot({ ...entry(), transportId: 'private-token' }),
    snapshot({ ...entry(), status: 'private-status' }),
    snapshot({ ...entry(), durationMs: -1 }),
    snapshot(...Array(65).fill(entry())),
    { ...snapshot(), schemaVersion: 2 },
  ]) {
    ui.click(ui.refresh)
    const read = ui.requests.at(-1)
    read.options.onResponseHeaders(new Headers({ 'x-systemx-request-id': '/private/invalid' }))
    read.resolve(invalid)
    await settle()
    assert.equal(ui.status.dataset.state, 'unavailable')
    assert.equal(ui.refresh.textContent, 'Retry')
    assert.equal(ui.entries.childElementCount, 1)
    assert.equal(ui.entries.children[0].children[1].textContent, firstId)
    assert.doesNotMatch(ui.status.textContent, /private/)
    assert.doesNotMatch(JSON.stringify(ui.entries.children[0].children), /private/)
  }
  ui.click(ui.refresh)
  const refused = ui.requests.at(-1)
  refused.options.onResponseHeaders(new Headers({ 'x-systemx-request-id': nextId }))
  refused.reject(Object.assign(new Error('/private/message'), { status: 403 }))
  await settle()
  assert.equal(ui.status.dataset.state, 'unavailable')
  assert.match(ui.status.textContent, /Access refused/)
  assert.ok(ui.status.textContent.includes(nextId))
  assert.doesNotMatch(ui.status.textContent, /private/)
  assert.equal(ui.entries.childElementCount, 1)
})

test('a cancelled transport row renders its correlation ID and duration alongside completed requests', async () => {
  const ui = inspector()
  ui.toggle(true)
  ui.requests[0].resolve(snapshot({ ...entry(nextId), outcome: 'cancelled', status: null }, entry(firstId)))
  await settle()
  assert.equal(ui.status.dataset.state, 'completed')
  assert.equal(ui.entries.childElementCount, 2)
  assert.equal(ui.entries.children[0].children[0], 'GET · builder · Cancelled · 7 ms')
  assert.equal(ui.entries.children[0].children[1].textContent, nextId)
  assert.equal(ui.entries.children[1].children[0], 'GET · builder · HTTP 200 · 7 ms')
})
