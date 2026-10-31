import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { attachSourceIdentityInspector } from '../Website/source-identities.js'
import { createSourceIdentityService } from '../Builder/source-identity-service.mjs'

// Minimal native-like controls exercise the real inspector's event/state logic.
// Rendered geometry and browser semantics remain the separate browser harness.
class Element extends EventTarget {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false; this.parent = null }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node) } }
  replaceChildren(...nodes) { for (const node of this.children) node.parent = null; this.children = []; this.append(...nodes) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  getAttribute(key) { return this.attributes[key] ?? null }
  querySelector(selector) {
    if (!selector.startsWith('#')) throw new Error('Fixture supports explicit ID selectors only')
    const id = selector.slice(1)
    for (const child of this.children) { if (child.id === id) return child; const found = child.querySelector(selector); if (found) return found }
    return null
  }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')) }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const path = 'src/pages/HomePage.tsx'
const content = 'export default function HomePage() { return <main data-systemx-id="home"><h1 data-systemx-id="headline">Unique heading</h1><p data-systemx-id="intro">Unique introduction</p></main> }\n'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-identity-ui-'))
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  const file = join(root, path)
  writeFileSync(file, content)
  const service = createSourceIdentityService(root)
  const previousDocument = globalThis.document, previousWindow = globalThis.window
  const head = new Element('head'), body = new Element('body')
  const document = { head, body, createElement: tag => new Element(tag), querySelector: selector => head.querySelector(selector) ?? body.querySelector(selector) }
  globalThis.document = document
  globalThis.window = { setTimeout }
  const container = new Element('section')
  body.append(container)
  const picker = new Element('select')
  picker.id = 'source-file-select'
  picker.value = path
  container.append(picker)
  const calls = [], staged = []
  let intercept = null
  const api = async (endpoint, options = {}) => {
    const request = { endpoint, body: options.body ? JSON.parse(options.body) : null }
    calls.push(request)
    const execute = () => {
      if (endpoint === '/api/identity/status') return service.status()
      if (endpoint.startsWith('/api/identity/document?')) return service.read({ documentId: new URL(endpoint, 'http://fixture').searchParams.get('documentId') })
      const method = { '/api/identity/preview': 'preview', '/api/identity/accept': 'accept', '/api/identity/inspect': 'inspect', '/api/identity/export': 'export', '/api/identity/reopen': 'reopen', '/api/identity/ownership/preview': 'ownershipPreview', '/api/identity/ownership/accept': 'ownershipAccept', '/api/identity/operation': 'operation' }[endpoint]
      assert.ok(method, `Unexpected API request ${endpoint}`)
      return service[method](request.body)
    }
    return intercept ? intercept(request, execute) : execute()
  }
  const handle = attachSourceIdentityInspector({ container, api, selectedPath: () => picker.value, onStageLiteral: proposal => { staged.push(proposal) } })
  const node = id => { const found = container.querySelector('#' + id); assert.ok(found, id); return found }
  const input = (id, value) => { const target = node(id); target.value = value; target.dispatchEvent(new Event('input')) }
  const click = async id => { node(id).click(); await tick() }
  const accept = async () => { await click('identity-import-preview'); input('identity-confirmation', 'ACCEPT IDENTITY MAP'); await click('identity-accept'); return service.read({ path }).map }
  t.after(() => { handle.destroy(); if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; rmSync(root, { recursive: true, force: true }) })
  return { service, file, handle, node, input, click, accept, calls, staged, intercept(value) { intercept = value } }
}

function previewDetail(map, overrides = {}) {
  return { tag: 'h1', id: 'runtime-heading', anchor: 'headline', route: '/', sourcePath: map.sourcePath, workspaceId: map.workspaceId, ...overrides }
}

test('actual service envelopes preview and accept qualified metadata only with fresh confirmation', async t => {
  const f = fixture(t)
  await f.click('identity-import-preview')
  const first = JSON.parse(f.node('identity-summary').textContent)
  assert.match(first.preview.digest, /^[a-f0-9]{64}$/)
  assert.equal(first.preview.sourcePath, path)
  assert.ok(first.proposalCoverage.total > 0)
  assert.equal(f.node('identity-accept').disabled, true)
  f.input('identity-confirmation', 'incorrect')
  await f.click('identity-accept')
  assert.equal(f.service.status().documents.length, 0)
  f.input('identity-confirmation', 'ACCEPT IDENTITY MAP')
  await f.click('identity-accept')
  const after = JSON.parse(f.node('identity-summary').textContent)
  assert.equal(after.accepted.sourcePath, path)
  assert.equal(after.readState, 'accepted at checked source revision')
  assert.equal(after.preview, null)
  assert.equal(f.node('identity-confirmation').value, '')
  assert.equal(readFileSync(f.file, 'utf8'), content)
  await f.click('identity-import-preview')
  assert.equal(f.node('identity-accept').disabled, true, 'a new reviewed proposal requires new confirmation')
})

test('foreign or internally mismatched preview responses preserve the previously accepted map', async t => {
  const f = fixture(t)
  const map = await f.accept()
  f.intercept((request, execute) => {
    const result = execute()
    if (request.endpoint === '/api/identity/preview') return { ...result, proposal: { ...result.proposal, map: { ...result.proposal.map, workspaceId: '0'.repeat(64) } } }
    return result
  })
  await f.click('identity-import-preview')
  assert.match(f.node('identity-status').textContent, /qualified selected document proposal/)
  assert.equal(JSON.parse(f.node('identity-summary').textContent).accepted.documentId, map.documentId)
  assert.equal(f.node('identity-accept').disabled, true)
  f.intercept((request, execute) => request.endpoint === '/api/identity/preview' ? { ...execute(), workspaceId: '0'.repeat(64) } : execute())
  await f.click('identity-import-preview')
  assert.match(f.node('identity-status').textContent, /another workspace/)
  assert.equal(JSON.parse(f.node('identity-summary').textContent).accepted.documentId, map.documentId)
})

test('unmapped runtime selection shows bounded location and never derives a durable owner from DOM id or text', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const before = f.calls.length
  const result = f.handle.observePreviewSelection(previewDetail(map, { anchor: undefined, id: 'headline', text: 'Unique heading', runtimeSecret: 'must-not-display', route: '/' + 'x'.repeat(900) }))
  assert.equal(result.status, 'unmapped')
  const observed = JSON.parse(f.node('identity-preview-selection').textContent)
  assert.equal(observed.reference, null)
  assert.equal(observed.runtime.route.length, 512)
  assert.match(observed.sourceWrite, /unavailable/)
  assert.equal(f.node('identity-preview-selection').textContent.includes('must-not-display'), false)
  assert.equal(f.node('identity-node-select').value, '')
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.equal(f.calls.length, before, 'unmapped observation makes no source or inspection request')
})

test('only exact explicit anchor, workspace, path, route and tag qualify runtime reference inspection', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const selected = map.nodes.find(node => node.anchor === 'headline')
  const result = f.handle.observePreviewSelection(previewDetail(map))
  await tick()
  assert.equal(result.status, 'qualified explicit anchor')
  assert.deepEqual(result.reference, { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: selected.id })
  assert.equal(f.node('identity-node-select').value, selected.id)
  assert.match(f.node('identity-node-detail').textContent, /"inspection"/)
  assert.equal(f.node('identity-stage-operation').disabled, true)
  for (const overrides of [{ anchor: 'not-declared' }, { tag: 'h2' }, { route: '/another-page' }, { sourcePath: 'src/pages/OtherPage.tsx' }, { workspaceId: 'b'.repeat(64) }]) {
    const before = f.calls.length
    assert.equal(f.handle.observePreviewSelection(previewDetail(map, overrides)).status, 'unmapped')
    await tick()
    assert.equal(f.calls.length, before)
    assert.equal(f.node('identity-node-select').value, '')
  }
})

test('stale accepted mapping remains inspectable metadata but runtime selection cannot claim current authority', async t => {
  const f = fixture(t)
  const map = await f.accept()
  writeFileSync(f.file, content + '// source revision changed\n')
  await f.handle.refresh()
  assert.equal(JSON.parse(f.node('identity-summary').textContent).readState, 'stale')
  assert.equal(f.handle.observePreviewSelection(previewDetail(map)).status, 'unmapped')
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.equal(readFileSync(f.file, 'utf8'), content + '// source revision changed\n')
})

test('delayed literal operation for a former preview node cannot repopulate authority after another node selection', async t => {
  const f = fixture(t)
  const map = await f.accept()
  f.handle.observePreviewSelection(previewDetail(map))
  await tick()
  let release
  f.intercept((request, execute) => {
    const result = execute()
    return request.endpoint === '/api/identity/operation' ? new Promise(resolve => { release = () => resolve(result) }) : result
  })
  f.input('identity-operation-text', 'Changed heading')
  f.node('identity-operation-preview').click()
  await tick()
  assert.equal(typeof release, 'function')
  f.handle.observePreviewSelection(previewDetail(map, { anchor: 'intro', tag: 'p' }))
  await tick()
  release()
  await tick()
  assert.equal(f.node('identity-node-select').value, map.nodes.find(node => node.anchor === 'intro').id)
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.match(f.node('identity-operation-detail').textContent, /^Select an accepted node/)
  assert.deepEqual(f.staged, [])
  assert.equal(readFileSync(f.file, 'utf8'), content)
})

test('separate ownership envelope requires its own confirmation and does not mutate source', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const heading = map.nodes.find(node => node.anchor === 'headline')
  const changes = [{ nodeId: heading.id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: { owner: 'source', supported: false } }, source: heading.source, provenance: { documentId: map.documentId } }]
  f.input('identity-ownership-json', JSON.stringify(changes))
  await f.click('identity-ownership-preview')
  const proposal = JSON.parse(f.node('identity-ownership-detail').textContent).proposal
  assert.ok(proposal, f.node('identity-status').textContent)
  assert.match(proposal.digest, /^[a-f0-9]{64}$/)
  assert.equal(f.node('identity-ownership-accept').disabled, true)
  f.input('identity-ownership-confirmation', 'ACCEPT OWNERSHIP CHANGE')
  await f.click('identity-ownership-accept')
  assert.match(f.node('identity-status').textContent, /Ownership change accepted/)
  assert.equal(f.node('identity-ownership-confirmation').value, '')
  assert.equal(f.service.read({ documentId: map.documentId }).ownership.claims.length, 1)
  assert.equal(readFileSync(f.file, 'utf8'), content)
})


test('an inspect reply for another qualified node cannot assert the selected owner or enable staging', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const intro = map.nodes.find(node => node.anchor === 'intro')
  f.intercept((request, execute) => {
    const result = execute()
    return request.endpoint === '/api/identity/inspect' ? { ...result, reference: { ...result.reference, nodeId: intro.id } } : result
  })
  f.handle.observePreviewSelection(previewDetail(map))
  await tick()
  assert.match(f.node('identity-status').textContent, /exact qualified reference/)
  assert.equal(JSON.parse(f.node('identity-summary').textContent).readState, 'inspection unresolved; mapping unverified')
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.equal(JSON.parse(f.node('identity-node-detail').textContent).inspection, null)
  assert.deepEqual(f.staged, [])
})

test('refused preview displays every bounded duplicate group while preserving accepted identity and input drafts', async t => {
  const f = fixture(t)
  const map = await f.accept()
  f.input('identity-operation-text', 'Retained operator draft')
  const groups = [
    { code: 'SOURCE_IDENTITY_ANCHOR_DUPLICATE', identityDigest: 'a'.repeat(64), count: 2 },
    { code: 'SOURCE_IDENTITY_ANCHOR_DUPLICATE', identityDigest: 'b'.repeat(64), count: 3 },
  ]
  f.intercept((request, execute) => {
    if (request.endpoint !== '/api/identity/preview') return execute()
    const error = new Error('Source identity anchors contain duplicate groups.')
    error.code = 'SOURCE_IDENTITY_ANCHOR_DUPLICATE'
    error.diagnostics = [...groups.map(group => ({ ...group, sourceContent: 'must-not-display' })), { code: 'INVALID_DIAGNOSTIC', identityDigest: '/private/path', count: 9000 }]
    throw error
  })
  await f.click('identity-import-preview')
  const summary = JSON.parse(f.node('identity-summary').textContent)
  assert.equal(summary.accepted.documentId, map.documentId)
  assert.deepEqual(summary.refusalDiagnostics.groups, groups)
  assert.equal(summary.refusalDiagnostics.omitted, 1)
  assert.equal(f.node('identity-summary').textContent.includes('must-not-display'), false)
  assert.equal(f.node('identity-operation-text').value, 'Retained operator draft')
  assert.equal(f.node('identity-accept').disabled, true)
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.equal(readFileSync(f.file, 'utf8'), content)
})

test('retired ownership claims are reviewed before acceptance and retained as read-only metadata through read and reopen', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const heading = map.nodes.find(node => node.anchor === 'headline')
  const changes = [{ nodeId: heading.id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: { owner: 'source', supported: false } }, source: heading.source, provenance: { documentId: map.documentId } }]
  const proposed = f.service.ownershipPreview({ documentId: map.documentId, changes })
  f.service.ownershipAccept({ digest: proposed.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  writeFileSync(f.file, content.replace('<h1 data-systemx-id="headline">Unique heading</h1>', ''))
  await f.click('identity-import-preview')
  const preview = JSON.parse(f.node('identity-summary').textContent).preview
  assert.ok(preview, f.node('identity-status').textContent)
  assert.equal(preview.ownershipRetirementCount, 1)
  assert.equal(preview.ownershipRetirements[0].nodeId, heading.id)
  assert.equal(preview.ownershipRetirements[0].reason, 'OWNERSHIP_TARGET_RETIRED')
  assert.match(preview.ownershipRetirements[0].claimDigest, /^[a-f0-9]{64}$/)
  assert.equal(f.node('identity-accept').disabled, true)
  f.input('identity-confirmation', 'ACCEPT IDENTITY MAP')
  await f.click('identity-accept')
  let accepted = JSON.parse(f.node('identity-summary').textContent).accepted
  assert.equal(accepted.retiredOwnershipClaimCount, 1)
  assert.equal(accepted.retiredOwnershipClaims[0].nodeId, heading.id)
  await f.handle.refresh()
  accepted = JSON.parse(f.node('identity-summary').textContent).accepted
  assert.equal(accepted.retiredOwnershipClaims[0].nodeId, heading.id)
  const exported = f.service.export({ documentId: map.documentId })
  assert.equal(exported.retiredOwnershipClaims[0].nodeId, heading.id)
  f.input('identity-reopen-json', JSON.stringify(exported))
  f.input('identity-reopen-confirmation', 'REOPEN IDENTITY DOCUMENT')
  await f.click('identity-reopen')
  accepted = JSON.parse(f.node('identity-summary').textContent).accepted
  assert.equal(accepted.retiredOwnershipClaims[0].nodeId, heading.id)
  assert.equal(f.node('identity-stage-operation').disabled, true)
  assert.deepEqual(f.staged, [])
})

test('a real retired document-owned claim may show a public generated output without expanding source operations', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const heading = map.nodes.find(node => node.anchor === 'headline')
  const outputPath = 'public/generated/page.html'
  const outputRevision = 'd'.repeat(64)
  const changes = [{ nodeId: heading.id, mode: 'document-owned', adapterId: 'generator-v1',
    fields: { text: { owner: 'document', supported: false } },
    source: { ...heading.source, path: outputPath, sourceRevision: outputRevision },
    provenance: { documentId: map.documentId, generatorVersion: 'fixture-v1', outputPath, outputRevision, generatedBoundary: { path: outputPath } } }]
  const proposed = f.service.ownershipPreview({ documentId: map.documentId, changes })
  f.service.ownershipAccept({ digest: proposed.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  writeFileSync(f.file, content.replace('<h1 data-systemx-id="headline">Unique heading</h1>', ''))
  await f.click('identity-import-preview')
  const preview = JSON.parse(f.node('identity-summary').textContent).preview
  assert.ok(preview, f.node('identity-status').textContent)
  assert.equal(preview.ownershipRetirementCount, 1)
  assert.equal(preview.ownershipRetirements[0].sourcePath, outputPath)
  assert.equal(preview.ownershipRetirements[0].sourceRevision, outputRevision)
  assert.equal(f.node('identity-stage-operation').disabled, true)
  f.input('identity-confirmation', 'ACCEPT IDENTITY MAP')
  await f.click('identity-accept')
  await f.handle.refresh()
  const accepted = JSON.parse(f.node('identity-summary').textContent).accepted
  assert.equal(accepted.retiredOwnershipClaims[0].sourcePath, outputPath)
  assert.equal(f.node('source-file-select').value, path)
  assert.deepEqual(f.staged, [])
  assert.equal(f.calls.some(call => call.endpoint.includes(outputPath)), false, 'history metadata must not open the generated output')
})

test('private or noncanonical retirement metadata refuses preview while preserving the accepted map and drafts', async t => {
  const f = fixture(t)
  const map = await f.accept()
  const heading = map.nodes.find(node => node.anchor === 'headline')
  f.input('identity-operation-text', 'Keep this input draft')
  const privatePaths = ['/private/generated.html', 'C:/private/generated.html', 'public/../private/file.html', 'public\\generated\\page.html', '.SYSTEMX/state/session.json', '.SYSTEMX/local/secret.json', '.SYSTEMX/LAN/Temp/operations.jsonl', '.SYSTEMX/LAN/Backup/Home.tsx', '.systemx/lan/backup/Home.tsx', '.git/config', '.env', 'src/.env.local', 'node_modules/package/index.js', 'public/Node_Modules/generated.html', 'public/%2e%2e/private.html', 'public//generated.html', './public/generated.html']
  for (const sourcePath of privatePaths) {
    f.intercept((request, execute) => {
      const result = execute()
      return request.endpoint === '/api/identity/preview' ? { ...result, ownershipRetirements: [{
        workspaceId: map.workspaceId, documentId: map.documentId, nodeId: heading.id, sourcePath,
        sourceRevision: map.sourceRevision, claimDigest: 'e'.repeat(64), reason: 'OWNERSHIP_TARGET_RETIRED',
      }] } : result
    })
    await f.click('identity-import-preview')
    const summary = JSON.parse(f.node('identity-summary').textContent)
    assert.equal(summary.accepted.documentId, map.documentId, sourcePath)
    assert.equal(summary.accepted.retiredOwnershipClaimCount, 0, sourcePath)
    assert.equal(summary.preview, null, sourcePath)
    assert.equal(f.node('identity-operation-text').value, 'Keep this input draft', sourcePath)
    assert.equal(f.node('identity-accept').disabled, true, sourcePath)
    assert.equal(f.node('identity-stage-operation').disabled, true, sourcePath)
    assert.match(f.node('identity-status').textContent, /qualified public metadata/)
  }
  assert.deepEqual(f.staged, [])
  assert.equal(readFileSync(f.file, 'utf8'), content)
})
