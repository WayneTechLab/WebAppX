import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'
import { fixture } from './merge-fixture.mjs'

const { createCrmMergeHost } = await loadMockModel(new URL('../../src/crm/merge-host.ts', import.meta.url))
const selection = { kind: 'contact', sourceId: 'contact-avery', retainedId: 'contact-0002', fieldPolicy: 'retain-target-v1' }
function harness() {
  let state = fixture(), actor = { id: 'crm-owner', role: 'owner' }, epoch = 0, generation = 0, path = '/crm/demo', active = true, time = 0, nonce = 0, reads = 0, saves = 0
  const host = createCrmMergeHost({
    readCurrent: () => { reads++; return state }, readActor: () => actor,
    readEpoch: () => epoch, readModeGeneration: () => generation, readActive: () => active,
    replaceCurrent(build) { const next = build(state); state = next; saves++; return true },
  }, {
    readPath: () => path, monotonicNow: () => time,
    randomBytes(length) { assert.equal(length, 32); const bytes = new Uint8Array(32); new DataView(bytes.buffer).setUint32(28, ++nonce); return bytes },
  })
  return { host, get state() { return state }, set state(value) { state = value }, set actor(value) { actor = value }, set epoch(value) { epoch = value }, set generation(value) { generation = value }, set path(value) { path = value }, set active(value) { active = value }, set time(value) { time = value }, get reads() { return reads }, get saves() { return saves } }
}

test('disposed host ports never revive or consume a fresh lifetime handle during StrictMode cleanup/setup replay', () => {
  const h = harness(), original = structuredClone(h.state), old = h.host.getSnapshot()
  const pending = old.port.preview(selection); assert.equal(pending.ok, true)
  h.host.stop(); h.host.start()
  const next = h.host.getSnapshot(); assert.ok(next.lifetime > old.lifetime); assert.notEqual(next.port, old.port)
  assert.equal(old.port.view().ok, false)
  assert.equal(old.port.preview(selection).ok, false)
  const fresh = next.port.preview(selection); assert.equal(fresh.ok, true)
  old.port.cancel(fresh.handle)
  assert.equal(old.port.confirm({ kind: 'contact', handle: fresh.handle }).ok, false)
  assert.equal(next.port.confirm({ kind: 'contact', handle: pending.handle }).ok, false)
  assert.deepEqual(h.state, original); assert.equal(h.saves, 0)
  assert.equal(next.port.confirm({ kind: 'contact', handle: fresh.handle }).ok, true)
  assert.equal(h.saves, 1)
  h.host.stop()
})

test('hidden retained hosts provide current authorized projections while actual route and tab deny commands before source reads', () => {
  const h = harness(), first = h.host.getSnapshot(), pending = first.port.preview(selection)
  assert.equal(pending.ok, true)
  h.path = '/cms/demo'; h.host.navigated()
  const hidden = h.host.getSnapshot(); assert.equal(hidden.view.ok, true)
  assert.ok(hidden.view.value.scopeVersion > first.view.value.scopeVersion)
  const reads = h.reads
  assert.equal(hidden.port.preview(selection).ok, false)
  assert.equal(hidden.port.confirm({ kind: 'contact', handle: pending.handle }).ok, false)
  assert.equal(h.reads, reads); assert.equal(h.saves, 0)
  h.path = '/crm/demo'; h.active = false; h.host.navigated()
  assert.equal(h.host.getSnapshot().view.ok, true)
  const beforeTabAttempt = h.reads
  assert.equal(hidden.port.preview(selection).ok, false); assert.equal(h.reads, beforeTabAttempt)
  h.active = true; h.host.navigated()
  assert.equal(h.host.getSnapshot().port.confirm({ kind: 'contact', handle: pending.handle }).ok, false)
  assert.equal(h.saves, 0)
  h.host.stop()
})

test('provider live source and identical-data replacement epoch stale a handle before another React render', () => {
  const h = harness(), original = structuredClone(h.state)
  const first = h.host.getSnapshot().port.preview(selection); assert.equal(first.ok, true)
  h.state = structuredClone(h.state); h.epoch = 1
  assert.equal(h.host.getSnapshot().port.confirm({ kind: 'contact', handle: first.handle }).ok, false)
  assert.deepEqual(h.state, original); assert.equal(h.saves, 0)
  const next = h.host.getSnapshot().port.preview(selection); assert.equal(next.ok, true)
  h.state.companies[1].name = 'Changed unselected company at the same sequence'
  assert.equal(h.host.getSnapshot().port.confirm({ kind: 'contact', handle: next.handle }).ok, false)
  assert.equal(h.state.sequence, original.sequence); assert.equal(h.saves, 0)
  const view = h.host.getSnapshot()
  assert.equal(h.host.getSnapshot(), view, 'Unchanged small permitted snapshots are referentially stable for useSyncExternalStore')
  h.host.stop()
})
