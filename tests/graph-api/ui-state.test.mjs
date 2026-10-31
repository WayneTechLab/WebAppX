import assert from 'node:assert/strict'
import test from 'node:test'
import { attachGraphContractInspector } from '../../.SYSTEMX/LAN/Website/graph-contracts-ui.mjs'

// Exercise the actual inspector event handlers with a minimal inert DOM and
// independently scripted responses. Browser layout and real dispatch belong
// to the separate browser harness, not this deterministic state-race proof.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = new Map(); this.attributes = new Map(); this.value = ''; this.textContent = ''; this.disabled = false }
  append(child) { child.parent = this; this.children.push(child) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
  replaceChildren(...children) { this.children = []; for (const child of children) this.append(child) }
  setAttribute(key, value) { this.attributes.set(key, value) }
  addEventListener(name, callback) { const listeners = this.listeners.get(name) ?? []; listeners.push(callback); this.listeners.set(name, listeners) }
  querySelectorAll(tag) { const output = []; for (const child of this.children) { if (child.tagName === tag) output.push(child); output.push(...child.querySelectorAll(tag)) }; return output }
  emit(name) { for (const callback of this.listeners.get(name) ?? []) callback({ target: this }) }
}

const WORKSPACE = 'a'.repeat(64), NEXT_WORKSPACE = 'b'.repeat(64), REVISION = 'c'.repeat(64), DIGEST = 'd'.repeat(64), SCHEMA = 'e'.repeat(64)
const graph = () => ({ schemaVersion: 1, workspaceId: WORKSPACE, documentId: 'doc_fixture', sourceRevision: null,
  pages: [{ id: 'page_fixture', rootId: 'node_root', route: '/' }],
  nodes: [{ id: 'node_root', kind: 'element', parentId: null, childIds: [], label: 'main', ownership: 'source-owned', source: null, opaqueReason: null }],
  references: [], components: [], collections: [], extensions: {} })
const snapshot = () => ({ document: graph(), revision: REVISION, stats: { revision: REVISION, pages: 1, nodes: 1, references: 0, components: 0, collections: 0, unresolvedReferences: 0, opaqueNodes: 0 }, findings: [], omittedCount: 0 })
const descriptors = ['graph.status', 'graph.document', 'graph.preview', 'graph.accept', 'graph.export', 'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.export'].map(id => ({ id, kind: ['graph.preview', 'graph.accept'].includes(id) ? 'command' : 'query', implemented: true, capabilityId: `lan.${id}@1`, effect: 'metadata only' }))
descriptors.push(...['graph.migrationPreview', 'graph.migrationApply', 'graph.reopen'].map(id => ({ id, kind: 'command', implemented: true, capabilityId: `lan.${id}@1`, effect: 'metadata only' })))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function until(condition) { for (let index = 0; index < 100; index += 1) { if (condition()) return; await new Promise(resolve => setImmediate(resolve)) }; assert.fail('Inspector did not reach the expected settled state') }

async function withInspector(run, override = () => undefined) {
  const previous = globalThis.document
  const head = new Element('head'), body = new Element('body'), container = new Element('div')
  body.append(container)
  const find = (root, id) => root.id === id ? root : root.children.map(child => find(child, id)).find(Boolean)
  globalThis.document = { head, body, createElement: tag => new Element(tag), querySelector: selector => find(head, selector.slice(1)) ?? find(body, selector.slice(1)) }
  let workspace = WORKSPACE, accepted = false
  const calls = []
  const success = (version, requestId, result) => ({ apiVersion: version, requestId, ok: true, result })
  const api = async (path, envelope) => {
    calls.push({ path, envelope: envelope && structuredClone(envelope) })
    const custom = override(path, envelope, success)
    if (custom !== undefined) return custom
    if (path.startsWith('/api/contracts/discovery')) {
      const clientVersion = new URL(path, 'http://fixture.invalid').searchParams.get('clientVersion')
      if (clientVersion === '2.0') return { apiVersion: '1.1', requestId: null, ok: false, error: { category: 'incompatible-version', code: 'API_VERSION_UNSUPPORTED', message: 'Choose a supported version.', findings: [], omittedCount: 0 } }
      const operations = clientVersion === '1.0' ? descriptors.slice(0, 9) : descriptors
      return success('1.1', null, { apiVersion: '1.1', clientVersion, compatibleVersion: clientVersion, supportedVersions: ['1.0', '1.1'], schemaRevision: SCHEMA, operations, unavailableOperations: [], deprecated: [] })
    }
    const { apiVersion, requestId, operation } = envelope
    let result
    if (operation === 'graph.status') result = { workspaceId: WORKSPACE, documents: accepted ? [{ documentId: 'doc_fixture', revision: REVISION, sourceRevision: null, stats: snapshot().stats }] : [], limits: {} }
    else if (operation === 'graph.preview') result = { ...snapshot(), digest: DIGEST, documentId: 'doc_fixture', sourceRevision: null }
    else if (operation === 'graph.accept' || operation === 'graph.reopen') { accepted = true; result = snapshot() }
    else if (operation === 'graph.document') result = snapshot()
    else if (operation === 'graph.migrationPreview') result = { digest: DIGEST, fromVersion: 0, toVersion: 1, steps: ['convert page', 'derive child order'], unsupportedFields: [], document: graph() }
    else if (operation === 'graph.migrationApply') result = { ...snapshot(), isolatedCopy: true }
    else throw new Error(`Unexpected scripted operation ${operation}`)
    return success(apiVersion, requestId, result)
  }
  const controller = attachGraphContractInspector({ container, api, getWorkspaceId: () => workspace })
  const element = id => { const value = find(body, id); assert.ok(value, id); return value }
  const change = (id, value, event = 'input') => { const target = element(id); target.value = value; target.emit(event) }
  const click = async id => { const target = element(id); assert.equal(target.disabled, false, `${id} enabled`); target.onclick(); await until(() => !target.disabled) }
  try { await run({ controller, element, change, click, calls, setWorkspace: value => { workspace = value } }) }
  finally { controller.destroy(); globalThis.document = previous }
}

test('supported older discovery validates server and negotiated versions separately, then executes older commands', async () => {
  await withInspector(async ui => {
    ui.change('contract-version', '1.0', 'change')
    await ui.click('contract-discover')
    assert.match(ui.element('graph-contract-status').textContent, /complete/)
    assert.equal(ui.element('contract-operation').children.length, 10, 'Nine older operations plus the empty choice')
    ui.change('graph-import-json', JSON.stringify(graph()))
    await ui.click('graph-preview')
    ui.change('graph-accept-confirmation', 'ACCEPT GRAPH')
    await ui.click('graph-accept')
    assert.match(ui.element('graph-accepted-result').textContent, /doc_fixture/)
    assert.deepEqual(ui.calls.filter(call => call.envelope?.kind === 'command').map(call => call.envelope.apiVersion), ['1.0', '1.0'])
  })
})

test('future-version discovery preserves the last verified metadata and accepted view without fallback requests', async () => {
  await withInspector(async ui => {
    await ui.click('contract-discover')
    ui.change('graph-import-json', JSON.stringify(graph())); await ui.click('graph-preview')
    ui.change('graph-accept-confirmation', 'ACCEPT GRAPH'); await ui.click('graph-accept')
    const discovery = ui.element('contract-discovery').textContent, accepted = ui.element('graph-accepted-result').textContent
    ui.change('contract-version', '2.0', 'change'); await ui.click('contract-discover')
    assert.equal(ui.element('contract-discovery').textContent, discovery)
    assert.equal(ui.element('graph-accepted-result').textContent, accepted)
    const evidence = JSON.parse(ui.element('contract-evidence').textContent)
    assert.equal(evidence.requestedApiVersion, '2.0'); assert.equal(evidence.verifiedApiVersion, '1.1'); assert.equal(evidence.schemaRevision, SCHEMA)
    assert.match(ui.element('graph-contract-status').textContent, /incompatible-version/)
  })
})

test('an isolated migration result cannot overwrite a newer import draft and remains available for explicit staging', async () => {
  const pending = deferred()
  await withInspector(async ui => {
    ui.change('graph-migration-json', JSON.stringify({ schemaVersion: 0 }))
    await ui.click('graph-migration-preview')
    ui.change('graph-migration-confirmation', 'MIGRATE GRAPH COPY')
    const apply = ui.click('graph-migration-apply')
    await until(() => ui.calls.some(call => call.envelope?.operation === 'graph.migrationApply'))
    ui.change('graph-import-json', 'newer unsaved graph draft')
    ui.change('graph-identity-id', 'doc_newer')
    const request = ui.calls.at(-1).envelope
    pending.resolve({ apiVersion: request.apiVersion, requestId: request.requestId, ok: true, result: { ...snapshot(), isolatedCopy: true } })
    await apply
    assert.equal(ui.element('graph-import-json').value, 'newer unsaved graph draft')
    assert.equal(ui.element('graph-identity-id').value, 'doc_newer')
    assert.equal(ui.element('graph-migration-copy-json').readOnly, true)
    assert.equal(JSON.parse(ui.element('graph-migration-copy-json').value).documentId, 'doc_fixture')
    await ui.click('graph-migration-use-copy')
    assert.equal(JSON.parse(ui.element('graph-import-json').value).documentId, 'doc_fixture')
    assert.equal(ui.element('graph-identity-id').value, '')
  }, (_path, envelope) => envelope?.operation === 'graph.migrationApply' ? pending.promise : undefined)
})

test('workspace drift during migration refuses staging and preserves the newer draft', async () => {
  const pending = deferred()
  await withInspector(async ui => {
    ui.change('graph-migration-json', JSON.stringify({ schemaVersion: 0 })); await ui.click('graph-migration-preview')
    ui.change('graph-import-json', 'original local draft'); ui.change('graph-migration-confirmation', 'MIGRATE GRAPH COPY')
    const apply = ui.click('graph-migration-apply')
    await until(() => ui.calls.some(call => call.envelope?.operation === 'graph.migrationApply'))
    const request = ui.calls.at(-1).envelope
    ui.setWorkspace(NEXT_WORKSPACE)
    pending.resolve({ apiVersion: request.apiVersion, requestId: request.requestId, ok: true, result: { ...snapshot(), isolatedCopy: true } })
    await apply
    assert.equal(ui.element('graph-import-json').value, 'original local draft')
    assert.match(ui.element('graph-contract-status').textContent, /workspace/i)
    assert.equal(ui.element('graph-migration-copy-json').value, '')
  }, (_path, envelope) => envelope?.operation === 'graph.migrationApply' ? pending.promise : undefined)
})

test('reopen initializes qualified status before a fresh inspector validates the successful response', async () => {
  await withInspector(async ui => {
    ui.change('graph-reopen-json', JSON.stringify({ format: 'webappx-graph', formatVersion: 1, revision: REVISION, document: graph() }))
    ui.change('graph-reopen-confirmation', 'REOPEN GRAPH'); await ui.click('graph-reopen')
    assert.match(ui.element('graph-contract-status').textContent, /complete/)
    assert.match(ui.element('graph-accepted-result').textContent, /doc_fixture/)
    const statusIndex = ui.calls.findIndex(call => call.envelope?.operation === 'graph.status')
    const reopenIndex = ui.calls.findIndex(call => call.envelope?.operation === 'graph.reopen')
    assert.ok(statusIndex >= 0 && statusIndex < reopenIndex)
  })
})

test('wrong negotiated discovery metadata is refused without replacing the previously verified contract', async () => {
  await withInspector(async ui => {
    await ui.click('contract-discover')
    const previous = ui.element('contract-discovery').textContent
    ui.change('contract-version', '1.0', 'change'); await ui.click('contract-discover')
    assert.equal(ui.element('contract-discovery').textContent, previous)
    assert.match(ui.element('graph-contract-status').textContent, /did not verify/)
    assert.equal(JSON.parse(ui.element('contract-evidence').textContent).verifiedApiVersion, '1.1')
  }, (path, _envelope, success) => path.includes('clientVersion=1.0') ? success('1.1', null, { apiVersion: '1.1', clientVersion: '1.1', compatibleVersion: '1.1', supportedVersions: ['1.0', '1.1'], schemaRevision: SCHEMA, operations: descriptors }) : undefined)
})

test('editing a reopen input during initial status loading prevents the older export from being dispatched', async () => {
  const pending = deferred()
  await withInspector(async ui => {
    const original = JSON.stringify({ format: 'webappx-graph', formatVersion: 1, revision: REVISION, document: graph() })
    ui.change('graph-reopen-json', original); ui.change('graph-reopen-confirmation', 'REOPEN GRAPH')
    const reopen = ui.click('graph-reopen')
    await until(() => ui.calls.some(call => call.envelope?.operation === 'graph.status'))
    ui.change('graph-reopen-json', 'newer unsaved export draft')
    const request = ui.calls.at(-1).envelope
    pending.resolve({ apiVersion: request.apiVersion, requestId: request.requestId, ok: true, result: { workspaceId: WORKSPACE, documents: [], limits: {} } })
    await reopen
    assert.equal(ui.element('graph-reopen-json').value, 'newer unsaved export draft')
    assert.equal(ui.calls.filter(call => call.envelope?.operation === 'graph.reopen').length, 0)
    assert.match(ui.element('graph-contract-status').textContent, /input changed/i)
  }, (_path, envelope) => envelope?.operation === 'graph.status' ? pending.promise : undefined)
})
