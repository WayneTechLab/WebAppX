import assert from 'node:assert/strict'
import test from 'node:test'
import { attachTransportDiagnostics } from '../../.SYSTEMX/LAN/Website/transport-diagnostics.js'

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
  const [panel, status, refresh, cancel, entries] = ['diagnostics', 'status', 'read', 'cancel', 'entries'].map(name => {
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
  return { requests, status, refresh, cancel, entries, click, toggle, doc }
}

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
  ui.requests[0].resolve(snapshot({ ...entry(), privatePath: '/private/draft' }))
  await settle()
  for (const invalid of [
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
