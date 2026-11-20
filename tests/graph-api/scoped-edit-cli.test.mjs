import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { graphFixture } from '../../scripts/lan-graph-contract-browser.mjs'
import { startGraphCommandFixture } from './graph-command-server-fixture.mjs'

const cli = fileURLToPath(new URL('../../scripts/lan-graph-edit.mjs', import.meta.url))

function openEditor(t, origin) {
  const child = spawn(process.execPath, [cli, '--origin', origin], { stdio: 'pipe' })
  const closed = once(child, 'close')
  const replies = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', text => { stderr += text })
  child.stdin.on('error', () => {})
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
    await closed
  })
  const write = item => child.stdin.write(JSON.stringify(item) + '\n')
  async function next() {
    const { done, value } = await replies.next()
    assert.equal(done, false, 'Expected a CLI reply. ' + stderr)
    return JSON.parse(value)
  }
  return { child, closed, write, next, async run(item) { write(item); return next() } }
}

async function accepted(t, { ownComponent = false, capabilitySetting } = {}) {
  const server = await startGraphCommandFixture(t, { capabilitySetting })
  const source = Buffer.from('export const title = "Fixture";\n')
  const path = join(server.root, 'src', 'pages', 'GraphFixture.tsx')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, source)
  const doc = graphFixture(server.status.repository.workspaceId, createHash('sha256').update(source).digest('hex'))
  if (ownComponent) {
    const componentRoot = doc.nodes.find(node => node.id === 'componentRoot')
    componentRoot.ownership = 'source-owned'
    componentRoot.source = { ...doc.nodes.find(node => node.id === 'alpha').source }
  }
  const { documentId } = doc
  const preview = await server.call('command', 'graph.preview', { document: doc })
  await server.call('command', 'graph.accept', { digest: preview.digest })
  const exported = () => server.call('query', 'graph.export', { documentId })
  return { ...server, source, path, documentId, exported, before: await exported() }
}

test('normal LAN editor retains full selection and Unicode draft on cancel and confirms exactly one reviewed revision', { timeout: 25000 }, async t => {
  const f = await accepted(t)
  const editor = openEditor(t, f.origin)
  const selection = { documentId: f.documentId, expectedRevision: f.before.revision, target: { kind: 'node', id: 'alpha' } }
  const draft = { operation: 'node.setLabel', value: 'Résumé draft — 橙' }
  const documents = await editor.run({ action: 'list' })
  assert.deepEqual(documents.result.documents, [{ documentId: f.documentId, revision: f.before.revision }])
  assert.deepEqual(await editor.run({ action: 'select', ...selection }), { ok: true, result: { selected: true } })
  assert.equal((await editor.run({ action: 'draft', ...draft })).ok, true)
  const context = (await editor.run({ action: 'context' })).result
  assert.deepEqual(context, { mode: 'edit', selection, draft, proposalId: null })

  editor.write({ action: 'review' })
  editor.write({ action: 'select', ...selection, target: { kind: 'page', id: 'page' } })
  const opening = await editor.next()
  assert.equal(opening.ok, true, JSON.stringify(opening.error))
  const first = opening.result
  assert.equal(first.targetRevision, f.before.revision)
  assert.equal(first.operation, draft.operation)
  assert.deepEqual(first.target, selection.target)
  assert.deepEqual(first.effects.changed.map(x => [x.id, x.fields]), [['alpha', ['label']]])
  assert.ok(first.owners.some(o => o.path === 'src/pages/GraphFixture.tsx'))
  assert.equal((await editor.next()).error.code, 'EDITOR_REVIEW_OPEN')
  assert.deepEqual((await editor.run({ action: 'cancel' })).result, { decision: 'cancel', ...context })
  assert.deepEqual((await editor.run({ action: 'context' })).result, context)
  assert.deepEqual(await f.exported(), f.before)
  assert.deepEqual(await readFile(f.path), f.source)

  const second = (await editor.run({ action: 'review' })).result
  assert.notEqual(second.confirmationText, first.confirmationText)
  assert.equal((await editor.run({ action: 'confirm', confirmation: first.confirmationText })).error.code, 'SCOPED_CONFIRMATION')
  assert.deepEqual(await f.exported(), f.before)
  assert.deepEqual(await readFile(f.path), f.source)
  const committed = await editor.run({ action: 'confirm', confirmation: second.confirmationText })
  assert.equal(committed.result.selection.expectedRevision, second.candidateRevision)
  assert.equal(committed.result.draft, null)
  const after = await f.exported(), expected = structuredClone(f.before.document)
  expected.nodes.find(node => node.id === 'alpha').label = draft.value
  assert.deepEqual(after.document, expected)
  assert.equal(after.revision, second.candidateRevision)
  assert.deepEqual(await readFile(f.path), f.source)
  editor.child.stdin.end()
  assert.equal((await editor.closed)[0], 1) // The deliberate refusals are reflected in the batch exit code.
})

test('end of input releases the pending server-side reservation and leaves the accepted graph intact', { timeout: 25000 }, async t => {
  const f = await accepted(t), editor = openEditor(t, f.origin)
  const target = { kind: 'node', id: 'alpha' }
  await editor.run({ action: 'select', documentId: f.documentId, expectedRevision: f.before.revision, target })
  await editor.run({ action: 'draft', operation: 'node.setLabel', value: 'Keep in editor' })
  const review = await editor.run({ action: 'review' })
  assert.equal(review.ok, true)
  editor.child.stdin.end()
  assert.equal((await editor.next()).result.decision, 'cancel')
  assert.equal((await editor.closed)[0], 0)
  const raw = await f.read('/api/graph/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': f.session },
    body: JSON.stringify({ action: 'cancel', proposalId: review.result.proposalId, expectedRevision: f.before.revision }) })
  assert.equal((await raw.json()).error.code, 'SCOPED_PROPOSAL_MISSING')
  assert.deepEqual(await f.exported(), f.before)
  assert.deepEqual(await readFile(f.path), f.source)
})

test('losing the commit reply keeps a manual confirmation from being sent twice', { timeout: 25000 }, async t => {
  const f = await accepted(t)
  let confirms = 0
  const proxy = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const upstream = await f.read(req.url, { method: req.method,
      headers: req.method === 'POST' ? { 'content-type': 'application/json', 'x-systemx-session': req.headers['x-systemx-session'] } : {},
      ...(body && { body }) })
    const text = await upstream.text()
    if (req.url === '/api/graph/commands' && JSON.parse(body).action === 'confirm') { confirms++; res.destroy(); return }
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') }).end(text)
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  t.after(() => new Promise(resolve => proxy.close(resolve)))
  const editor = openEditor(t, 'http://127.0.0.1:' + proxy.address().port)
  await editor.run({ action: 'select', documentId: f.documentId, expectedRevision: f.before.revision, target: { kind: 'node', id: 'alpha' } })
  await editor.run({ action: 'draft', operation: 'node.setLabel', value: 'Saved once' })
  const { result: review } = await editor.run({ action: 'review' })
  const confirm = { action: 'confirm', confirmation: review.confirmationText }
  assert.equal((await editor.run(confirm)).error.code, 'EDITOR_CONNECTION')
  assert.equal((await editor.run(confirm)).error.code, 'EDITOR_UNCERTAIN')
  assert.equal(confirms, 1)
  assert.equal((await editor.run({ action: 'list' })).result.documents[0].revision, review.candidateRevision)
  assert.equal((await editor.run({ action: 'cancel' })).error.code, 'SCOPED_PROPOSAL_MISSING')
  const { result: context } = await editor.run({ action: 'context' })
  assert.equal(context.mode, 'edit')
  assert.equal(context.draft.value, 'Saved once')
  assert.equal((await f.exported()).revision, review.candidateRevision)
  assert.deepEqual(await readFile(f.path), f.source)
  editor.child.stdin.end()
  await editor.closed
})

test('two CLI operators see field and owner preconditions, overlapping documents and stale revision recovery', { timeout: 25000 }, async t => {
  const f = await accepted(t, { ownComponent: true }), first = openEditor(t, f.origin), second = openEditor(t, f.origin)
  const select = async (editor, kind, id, revision = f.before.revision) => {
    const reply = await editor.run({ action: 'select', documentId: f.documentId, expectedRevision: revision, target: { kind, id } })
    assert.equal(reply.ok, true)
  }
  const draft = async (editor, operation, value) => assert.equal((await editor.run({ action: 'draft', operation, value })).ok, true)
  await select(first, 'node', 'page')
  await draft(first, 'node.setLabel', 'Changed')
  assert.equal((await first.run({ action: 'review' })).error.code, 'SCOPED_TARGET_KIND')
  await select(first, 'node', 'opaque')
  await draft(first, 'node.setLabel', 'Changed')
  assert.equal((await first.run({ action: 'review' })).error.code, 'SCOPED_OWNER_REQUIRED')
  await select(first, 'page', 'page')
  await draft(first, 'page.setRoute', '/updated')
  const pageReview = (await first.run({ action: 'review' })).result
  await select(second, 'component', 'card')
  await draft(second, 'component.setVersion', '2.0')
  assert.equal((await second.run({ action: 'review' })).error.code, 'SCOPED_OVERLAP')
  assert.deepEqual(await f.exported(), f.before)
  assert.equal((await first.run({ action: 'confirm', confirmation: pageReview.confirmationText })).ok, true)
  assert.equal((await second.run({ action: 'review' })).error.code, 'SCOPED_STALE')
  await select(second, 'component', 'card', pageReview.candidateRevision)
  assert.equal((await second.run({ action: 'context' })).result.draft.value, '2.0')
  const component = await second.run({ action: 'review' })
  assert.equal(component.ok, true, JSON.stringify(component.error))
  assert.deepEqual(component.result.effects.changed.map(x => [x.kind, x.fields]), [
    ['component', ['version']], ['reference', ['expectedVersion']],
  ])
  assert.equal((await second.run({ action: 'confirm', confirmation: component.result.confirmationText })).ok, true)
  const expected = structuredClone(f.before.document)
  expected.pages[0].route = '/updated'
  expected.components[0].version = '2.0'
  expected.references.find(r => r.kind === 'component').expectedVersion = '2.0'
  const after = await f.exported()
  assert.deepEqual(after.document, expected)
  assert.equal(after.revision, component.result.candidateRevision)
  assert.deepEqual(await readFile(f.path), f.source)
  first.child.stdin.end()
  second.child.stdin.end()
  await Promise.all([first.closed, second.closed])
})

test('host-disabled operation names the missing capability and retains the draft', { timeout: 25000 }, async t => {
  const f = await accepted(t, { capabilitySetting: 'lan.page.setRoute@1' })
  const editor = openEditor(t, f.origin)
  await editor.run({ action: 'select', documentId: f.documentId, expectedRevision: f.before.revision, target: { kind: 'node', id: 'alpha' } })
  await editor.run({ action: 'draft', operation: 'node.setLabel', value: 'Retained draft' })
  const refusal = await editor.run({ action: 'review' })
  assert.equal(refusal.error.code, 'SCOPED_DISABLED')
  assert.match(refusal.error.message, /lan\.node\.setLabel@1/)
  assert.match(refusal.error.message, /LAN host disabled/)
  assert.equal((await editor.run({ action: 'context' })).result.draft.value, 'Retained draft')
  assert.deepEqual(await f.exported(), f.before)
  assert.deepEqual(await readFile(f.path), f.source)
  editor.child.stdin.end()
  await editor.closed
})
