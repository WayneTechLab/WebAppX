import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = name => new URL(`../../src/crm/${name}.ts`, import.meta.url)
const { createCrmState, crmActors, transitionCrm } = await loadMockModel(source('model'))
const { createCrmMergeController } = await loadMockModel(source('merge-controller'))
const { buildCrmMergeCandidate } = await loadMockModel(source('merge'))
const { applyCrmOwnership, previewCrmOwnership } = await loadMockModel(source('ownership'))
const { isCrmState } = await loadMockModel(source('persistence'))
const riley = crmActors.find(actor => actor.id === 'sales-riley'), auditor = crmActors.find(actor => actor.id === 'crm-auditor')
const selection = { kind: 'contact', sourceId: 'contact-0001', retainedId: 'contact-avery', fieldPolicy: 'retain-target-v1' }
function initial() { return transitionCrm(createCrmState(), riley, { type: 'create-contact', name: 'Source Sample', email: 'source@fiction.invalid', companyId: 'company-harbor' }) }
function harness(options = {}) {
  let state = options.state ?? initial(), actor = riley, epoch = 0, generation = 0, active = true, time = 0, nonce = 0, saves = 0, callbacks = 0, reads = 0, beforeBuild = null
  const adapter = {
    readCurrent() { reads++; return state }, readActor: () => actor, readEpoch: () => epoch, readModeGeneration: () => generation, readActive: () => active,
    monotonicNow: () => time,
    randomBytes(length) { assert.equal(length, 32); const bytes = new Uint8Array(length); new DataView(bytes.buffer).setUint32(28, ++nonce); return bytes },
    replaceCurrent(build) { if (beforeBuild) beforeBuild(); callbacks++; const next = build(state); state = next; saves++; return true },
    ...options.adapter,
  }
  const controller = createCrmMergeController(adapter)
  return { controller, adapter, get state() { return state }, set state(value) { state = value }, set actor(value) { actor = value }, set epoch(value) { epoch = value }, set generation(value) { generation = value }, set active(value) { active = value }, set time(value) { time = value }, set beforeBuild(value) { beforeBuild = value }, get saves() { return saves }, get callbacks() { return callbacks }, get reads() { return reads } }
}
function request(controller, extra = {}) { const view = controller.view(); assert.equal(view.ok, true); return { page: 1, pageSize: 20, scopeVersion: view.value.scopeVersion, ...extra } }
function preview(h) { const result = h.controller.preview(selection); assert.equal(result.ok, true, JSON.stringify(result)); return result }

test('read, paging, preview and cancel are byte-preserving; one accepted memory result creates one receipt and consumes its handle', () => {
  const h = harness(), before = JSON.stringify(h.state), page = request(h.controller)
  assert.equal(h.controller.report(page).ok, true)
  assert.equal(h.controller.choices({ ...page, kind: 'contact', selectedIds: ['contact-avery'] }).ok, true)
  assert.equal(h.controller.history(page).ok, true)
  const cancelled = preview(h); h.controller.cancel(cancelled.handle)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: cancelled.handle }).ok, false)
  const p = preview(h)
  assert.match(p.handle, /^[a-f0-9]{64}$/)
  assert.deepEqual(Object.keys(p).sort(), ['ok', 'handle', 'preview'].sort())
  for (const forbidden of ['sourceSerialization', 'sourceDigest', 'baseline', 'mergeHistory', 'candidate', 'binding']) assert.equal(Object.hasOwn(p.preview, forbidden), false)
  assert.equal(JSON.stringify(h.state), before); assert.equal(h.saves, 0)
  const accepted = h.controller.confirm({ kind: 'contact', handle: p.handle })
  assert.deepEqual(accepted, { ok: true, receipt: 'MOCK-CRM-0002', feedback: 'Fictional CRM merge accepted in memory. Check the browser storage notice before refreshing.', view: { status: 'ready', scopeVersion: p.preview.scopeVersion + 1, mode: 'writer', historyPolicy: 'recorded-owner-summary', notice: 'This page lists merge receipts recorded in your ownership scope. Historical IDs do not grant access to current records.' } })
  assert.equal(h.saves, 1); assert.equal(h.callbacks, 1); assert.equal(h.state.mergeHistory.steps.length, 1)
  assert.equal(h.state.activity[0].receipt, 'MOCK-CRM-0002'); assert.equal(h.state.contacts.some(contact => contact.id === 'contact-0001'), false)
  assert.equal(isCrmState(h.state), true)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false); assert.equal(h.saves, 1)
  assert.equal(h.controller.report(page).code, 'stale')
})

test('same-sequence changed content, actor, generation, epoch and identical-data replacement all stale private previews', () => {
  for (const change of [
    h => { h.state = { ...h.state, companies: h.state.companies.map(company => company.id === 'company-orbit' ? { ...company, name: 'Changed hidden company' } : company) } },
    h => { h.actor = crmActors.find(actor => actor.id === 'crm-owner') },
    h => { h.generation = 1 },
    h => { h.epoch = 1; h.state = structuredClone(h.state) },
  ]) {
    const h = harness(), p = preview(h), sequence = h.state.sequence
    change(h)
    assert.equal(h.state.sequence, sequence)
    const result = h.controller.confirm({ kind: 'contact', handle: p.handle })
    assert.equal(result.ok, false); assert.equal(result.code, 'stale'); assert.equal(h.saves, 0)
    assert.equal(Object.hasOwn(h.state, 'mergeHistory'), false)
  }
})

test('the actual latest callback reauthorizes identity, route, epoch and complete content before a save', () => {
  for (const change of [
    h => { h.actor = auditor }, h => { h.active = false }, h => { h.epoch = 1 },
    h => { h.state = { ...h.state, contacts: h.state.contacts.map(contact => contact.id === 'contact-jordan' ? { ...contact, name: 'Changed at callback' } : contact) } },
  ]) {
    const h = harness(), p = preview(h)
    h.beforeBuild = () => change(h)
    assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false)
    assert.equal(h.saves, 0); assert.equal(h.callbacks, 1); assert.equal(Object.hasOwn(h.state, 'mergeHistory'), false)
  }
  const repeated = harness({ adapter: { replaceCurrent(build) { build(initial()); build(initial()); return true } } }), p = preview(repeated)
  assert.equal(repeated.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false)
})

test('malformed and wrong-family confirmations consume a safely supplied handle without evaluating getters', () => {
  let getters = 0
  for (const malformed of [p => ({ kind: 'company', handle: p.handle }), p => ({ kind: 'contact', handle: p.handle, extra: true }), p => ({ get kind() { getters++; return 'contact' }, handle: p.handle })]) {
    const h = harness(), p = preview(h)
    assert.equal(h.controller.confirm(malformed(p)).ok, false)
    assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false); assert.equal(h.saves, 0)
  }
  const h = harness(), p = preview(h)
  assert.equal(h.controller.confirm({ kind: 'contact', get handle() { getters++; return p.handle } }).ok, false)
  assert.equal(getters, 0)
  // An accessor never supplies a handle value, so it cannot consume some other live nonce.
  assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, true)
})

test('forged actors and auditors are denied before reading a source or looking up selected IDs', () => {
  let reads = 0, actor = { id: 'sales-riley', role: 'owner' }
  const h = harness({ adapter: { readActor: () => actor, readCurrent() { reads++; throw new Error('must not look up graph') } } })
  const page = { page: 1, pageSize: 20, scopeVersion: 1 }
  for (const action of [() => h.controller.view(), () => h.controller.report(page), () => h.controller.choices({ ...page, kind: 'contact' }), () => h.controller.history(page), () => h.controller.preview(selection), () => h.controller.confirm({ kind: 'contact', handle: 'a'.repeat(64) })]) assert.equal(action().ok, false)
  assert.equal(reads, 0)
  actor = auditor
  assert.equal(h.controller.preview(selection).ok, false); assert.equal(h.controller.confirm({ kind: 'contact', handle: 'a'.repeat(64) }).ok, false); assert.equal(reads, 0)
})

test('expiry, backward monotonic time, cancel, clear, route departure and permanent disposal cannot reuse a handle', () => {
  for (const invalidate of [h => { h.time = 600000 }, h => { h.time = -1 }, (h, p) => h.controller.cancel(p.handle), h => h.controller.clear(), h => { h.active = false }, h => h.controller.dispose()]) {
    const h = harness(), p = preview(h); invalidate(h, p)
    assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false); assert.equal(h.saves, 0)
  }
  const h = harness(), p = preview(h)
  h.active = false; assert.equal(h.controller.view().ok, false)
  h.active = true; assert.equal(h.controller.view().ok, true)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false)
  h.controller.dispose(); assert.equal(h.controller.preview(selection).ok, false)
  const replacement = harness(); assert.equal(replacement.controller.preview(selection).ok, true)
})

test('secure random source has no fallback, nonce collisions are bounded, and the oldest of nine live previews is evicted', () => {
  for (const randomBytes of [() => { throw new Error('no entropy') }, () => new Uint8Array(31), () => Array(32).fill(0)]) {
    const h = harness({ adapter: { randomBytes } }); assert.equal(h.controller.preview(selection).ok, false); assert.equal(h.saves, 0)
  }
  let calls = 0
  const collision = harness({ adapter: { randomBytes() { calls++; return new Uint8Array(32) } } })
  const first = preview(collision); collision.controller.cancel(first.handle)
  assert.equal(collision.controller.preview(selection).ok, false); assert.equal(calls, 4)
  const h = harness(), previews = Array.from({ length: 9 }, () => preview(h))
  assert.equal(h.controller.confirm({ kind: 'contact', handle: previews[0].handle }).ok, false)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: previews[8].handle }).ok, true)
})

test('all ever-issued handles are finite even when each preview is cancelled immediately', () => {
  const h = harness()
  for (let index = 0; index < 4096; index++) { const p = preview(h); h.controller.cancel(p.handle) }
  const denied = h.controller.preview(selection)
  assert.equal(denied.ok, false); assert.equal(denied.code, 'limit'); assert.equal(h.saves, 0)
})

test('aggregate captured-character budget evicts oldest previews before the eight-handle cap', () => {
  const state = initial()
  state.sequence = 1001
  state.activity = Array.from({ length: 1000 }, (_, index) => ({ receipt: `MOCK-CRM-${String(1000 - index).padStart(4, '0')}`, ownerId: 'sales-riley', action: 'create-company', description: 'F'.repeat(500) }))
  assert.equal(isCrmState(state), true)
  const h = harness({ state }), previews = Array.from({ length: 8 }, () => preview(h))
  assert.equal(h.controller.confirm({ kind: 'contact', handle: previews[0].handle }).ok, false)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: previews[7].handle }).ok, true); assert.equal(h.saves, 1)
})

test('retained inactive projections keep current scope pages available but commands refuse before source lookup and consume handles', () => {
  const h = harness({ adapter: { retainInactiveReadProjection: true } }), p = preview(h), raw = JSON.stringify(h.state)
  const firstVersion = p.preview.scopeVersion
  h.active = false
  const current = h.controller.view()
  assert.equal(current.ok, true); assert.equal(current.value.mode, 'writer'); assert.ok(current.value.scopeVersion > firstVersion)
  const page = { page: 1, pageSize: 20, scopeVersion: current.value.scopeVersion }
  assert.equal(h.controller.report(page).ok, true)
  assert.equal(h.controller.choices({ ...page, kind: 'contact', selectedIds: [selection.sourceId] }).ok, true)
  assert.equal(h.controller.history(page).ok, true)
  const reads = h.reads
  let getters = 0
  assert.equal(h.controller.preview(selection).ok, false)
  assert.equal(h.controller.confirm({ get kind() { getters++; return 'contact' }, handle: p.handle }).ok, false)
  assert.equal(getters, 0); assert.equal(h.reads, reads); assert.equal(h.saves, 0); assert.equal(JSON.stringify(h.state), raw)
  assert.equal(h.controller.report({ ...page, scopeVersion: firstVersion }).code, 'stale')
  h.active = true
  const returned = h.controller.view()
  assert.equal(returned.ok, true); assert.ok(returned.value.scopeVersion > current.value.scopeVersion)
  assert.equal(h.controller.confirm({ kind: 'contact', handle: p.handle }).ok, false)
})

test('inactive retained reads reauthorize source, actor and replacement epoch without replacing literal selected IDs or exposing former private captures', () => {
  const owner = crmActors.find(actor => actor.id === 'crm-owner'), sam = crmActors.find(actor => actor.id === 'sales-sam')
  const h = harness({ adapter: { retainInactiveReadProjection: true } })
  const original = request(h.controller), selectedIds = [selection.sourceId, selection.retainedId], rawIds = JSON.stringify(selectedIds)
  h.active = false
  h.state = buildCrmMergeCandidate(h.state, riley, selection).next; h.epoch = 1
  const requestTransfer = { kind: 'account-transfer', companyId: 'company-harbor', newOwnerId: 'sales-sam' }
  const transfer = previewCrmOwnership(h.state, owner, requestTransfer)
  assert.equal(transfer.ok, true)
  const accepted = applyCrmOwnership(h.state, owner, requestTransfer, transfer.confirmation)
  assert.equal(accepted.ok, true); h.state = accepted.state
  const formerPage = request(h.controller)
  assert.ok(formerPage.scopeVersion > original.scopeVersion)
  assert.equal(h.controller.report(original).code, 'stale')
  const formerChoices = h.controller.choices({ ...formerPage, kind: 'contact', selectedIds })
  assert.equal(formerChoices.ok, true)
  assert.deepEqual(formerChoices.value.selected, [{ id: selection.sourceId, available: false }, { id: selection.retainedId, available: false }])
  const formerHistory = h.controller.history(formerPage)
  assert.equal(formerHistory.ok, true); assert.equal(formerHistory.value.rows[0].mode, 'recorded-owner-summary')
  assert.equal(JSON.stringify(formerHistory).includes('Source Sample'), false); assert.equal(JSON.stringify(formerHistory).includes('mergeChange'), false)
  h.actor = sam
  const nextPage = request(h.controller)
  assert.ok(nextPage.scopeVersion > formerPage.scopeVersion)
  assert.equal(h.controller.history(formerPage).code, 'stale')
  const nextHistory = h.controller.history(nextPage), nextChoices = h.controller.choices({ ...nextPage, kind: 'contact', selectedIds })
  assert.equal(nextHistory.ok, true); assert.equal(nextHistory.value.accessibleCount, 0); assert.deepEqual(nextHistory.value.rows, [])
  assert.equal(nextChoices.ok, true); assert.equal(nextChoices.value.selected[0].available, false); assert.equal(nextChoices.value.selected[1].available, true)
  assert.equal(JSON.stringify(selectedIds), rawIds); assert.equal(h.saves, 0)
})

test('retained read admission cannot authorize a reentrant command or an invalid actor', () => {
  let controller, reads = 0, nested, active = false, actor = riley
  const state = initial()
  const h = harness({ adapter: { retainInactiveReadProjection: true, readActive: () => active, readActor: () => actor, readCurrent() { reads++; nested = controller.preview(selection); return state } } })
  controller = h.controller
  const view = controller.view()
  assert.equal(view.ok, true); assert.equal(nested.ok, false); assert.equal(reads, 1); assert.equal(h.saves, 0)
  actor = { id: 'sales-riley', role: 'owner' }
  assert.equal(controller.view().ok, false); assert.equal(reads, 1)
  active = true
  assert.equal(controller.preview(selection).ok, false); assert.equal(reads, 1)
})
