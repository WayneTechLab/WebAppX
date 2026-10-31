#!/usr/bin/env node
/** Isolated, browser-executed F005/F006 graph and contract proof. No provider access. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const capabilityKeys = Object.freeze({
  F005: Object.freeze([
    'import-a-normalized-document-read-model', 'validate-document-root-references', 'reject-cyclic-node-hierarchies',
    'validate-parent-child-reciprocity', 'preserve-child-ordering', 'represent-opaque-imported-nodes',
    'bound-document-import-size', 'validate-document-schema-versions', 'compute-canonical-document-revisions',
    'inspect-graph-validation-findings', 'separate-runtime-from-canonical-fields', 'resolve-qualified-document-references',
    'retain-unsupported-schema-extensions', 'compare-canonical-graph-revisions', 'migrate-documents-through-reviewed-steps',
    'validate-component-references', 'validate-collection-references', 'serialize-documents-deterministically',
    'inspect-document-graph-statistics', 'recover-the-previous-valid-graph',
  ]),
  F006: Object.freeze([
    'advertise-the-lan-api-version', 'expose-query-contract-descriptors', 'expose-command-contract-descriptors',
    'validate-exact-command-envelopes', 'validate-query-input-schemas', 'negotiate-compatible-client-contracts',
    'refuse-unsupported-api-versions', 'publish-typed-error-categories', 'validate-response-contracts',
    'define-pagination-contracts', 'version-capability-identifiers', 'separate-read-and-mutation-contracts',
    'describe-contract-deprecations', 'inspect-contract-examples-locally', 'validate-union-payload-discriminators',
    'bound-validation-diagnostics', 'define-nullable-and-absent-semantics', 'inspect-contract-compatibility-changes',
    'export-public-contract-metadata', 'bind-tests-to-contract-versions',
  ]),
})

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const hex64 = /^[a-f0-9]{64}$/
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const copy = (value) => JSON.parse(JSON.stringify(value))
const privateCanary = /PRIVATE_GRAPH_CANARY|SESSION_GRAPH_CANARY|\/private\/graph-canary/

export function requirementsFromSpec(specification) {
  assert.ok(Array.isArray(specification?.families), 'Foundation backlog families are required')
  const records = []
  for (const [familyId, first] of [['F005', 401], ['F006', 501]]) {
    const family = specification.families.find((item) => item.id === familyId)
    assert.ok(family, `${familyId} is missing from the original foundation specification`)
    assert.deepEqual(family.capabilities.map((item) => item.key), capabilityKeys[familyId], `${familyId} exact capability list drifted`)
    for (const [index, capability] of family.capabilities.entries()) {
      const start = first + index * 5
      records.push({ familyId, key: capability.key, title: capability.title, requirementIds: Array.from({ length: 5 }, (_, lane) => `LAN-${String(start + lane).padStart(5, '0')}`),
        lanes: ['behavior', 'boundaries', 'recovery', 'feedback', 'evidence'], status: 'not-run' })
    }
  }
  assert.equal(records.length, 40)
  return records
}

export function graphFixture(workspaceId, sourceRevision, { documentId = 'fixtureGraph', order = ['alpha', 'opaque', 'instance'], extra = false } = {}) {
  assert.match(workspaceId, hex64)
  assert.match(sourceRevision, hex64)
  const nodes = [
    { id: 'root', kind: 'document-root', parentId: null, childIds: [...order, ...(extra ? ['added'] : [])], label: 'Synthetic page root', ownership: 'read-only', source: null, opaqueReason: null },
    { id: 'alpha', kind: 'element', parentId: 'root', childIds: [], label: 'Synthetic alpha', ownership: 'source-owned', source: { path: 'src/pages/GraphFixture.tsx', sourceRevision, start: 0, end: 12, fingerprint: sourceRevision }, opaqueReason: null },
    { id: 'opaque', kind: 'opaque', parentId: 'root', childIds: [], label: 'Unsupported expression', ownership: 'read-only', source: { path: 'src/pages/GraphFixture.tsx', sourceRevision, start: 12, end: 24, fingerprint: sourceRevision }, opaqueReason: 'Dynamic JSX expression' },
    { id: 'instance', kind: 'component-instance', parentId: 'root', childIds: [], label: 'Synthetic component instance', ownership: 'read-only', source: null, opaqueReason: null },
    { id: 'componentRoot', kind: 'element', parentId: null, childIds: [], label: 'Synthetic component root', ownership: 'read-only', source: null, opaqueReason: null },
  ]
  if (extra) nodes.push({ id: 'added', kind: 'element', parentId: 'root', childIds: [], label: 'Added node', ownership: 'read-only', source: null, opaqueReason: null })
  return { schemaVersion: 1, workspaceId, documentId, sourceRevision, pages: [{ id: 'page', rootId: 'root', route: '/graph-fixture' }], nodes,
    references: [{ id: 'componentRef', kind: 'component', documentId, targetId: 'card', expectedVersion: '1.0', expectedSchemaId: null, required: true },
      { id: 'collectionRef', kind: 'collection', documentId, targetId: 'items', expectedVersion: '1.0', expectedSchemaId: 'itemSchema', required: true }],
    components: [{ id: 'card', version: '1.0', rootId: 'componentRoot' }], collections: [{ id: 'items', schemaId: 'itemSchema', version: '1.0' }],
    extensions: { 'org.webappx.readonly': { fixtureNote: 'Preserved metadata', orderHint: ['alpha', 'opaque'] } } }
}

export function legacyGraphFixture(document) {
  const legacy = copy(document)
  legacy.schemaVersion = 0
  legacy.page = legacy.pages[0]
  delete legacy.pages
  for (const node of legacy.nodes) delete node.childIds
  return legacy
}

export function outputDirectory(args, temporary) {
  const index = args.indexOf('--output-dir')
  assert.ok(index < 0 || (index === args.length - 2 && args.filter((arg) => arg === '--output-dir').length === 1), 'Use --output-dir PATH exactly once')
  assert.ok(args.length === 0 || index === 0, 'Only --output-dir PATH is supported')
  return index < 0 ? temporary : resolve(args[index + 1])
}

const files = (directory) => existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? files(path) : [path]
}).sort() : []
const snapshot = (directory) => Object.fromEntries(files(directory).map((path) => [relative(directory, path).replaceAll('\\', '/'), lstatSync(path).isSymbolicLink() ? `link:${sha(readlinkSync(path))}` : sha(readFileSync(path))]))
const protectedSnapshot = (directory) => Object.fromEntries(['src', '.SYSTEMX/LAN/Backup', '.SYSTEMX/LAN/Temp', '.SYSTEMX/LAN/Research'].map((path) => [path, snapshot(join(directory, path))]))
const freePort = () => new Promise((resolvePort, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close((error) => error ? reject(error) : resolvePort(port)) })
})
const stopOwned = async (child) => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((done) => child.once('exit', done)), delay(5000)])
  if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise((done) => child.once('exit', done)) }
}

async function main() {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-graph-contract-browser-'))
  const evidenceParent = outputDirectory(process.argv.slice(2), temporary)
  mkdirSync(evidenceParent, { recursive: true })
  const evidence = mkdtempSync(join(evidenceParent, 'graph-contract-run-'))
  const fixture = join(temporary, 'fixture')
  const specPath = join(root, '.SYSTEMX/LAN/Backlog/specs/01-foundation.json')
  const specification = JSON.parse(readFileSync(specPath, 'utf8'))
  const checks = requirementsFromSpec(specification)
  const report = { schemaVersion: 1, kind: 'isolated-graph-contract-browser-evidence', status: 'not-run', startedAt: new Date().toISOString(),
    revision: git(['rev-parse', 'HEAD']), scope: 'Copied local LAN assets, synthetic source and graph, owned loopback server and fresh Chromium context. Runtime evidence only after integration; no LAN backlog acceptance, provider, production or user session claim.',
    checks, browserRequests: [], unexpectedRequests: [], pageErrors: [], assetCaptures: [], dialogs: [], pendingIssues: [] }
  let lan, bridge, browserServer, browser, context, page, baseline, inputSnapshot, fixtureEffects, failure, lanOutput = ''
  const assetPromises = []
  const required = [
    '.SYSTEMX/LAN/Builder/graph-core.mjs', '.SYSTEMX/LAN/Builder/contracts/graph-read-model.schema.json', '.SYSTEMX/LAN/Builder/graph-validation.mjs',
    '.SYSTEMX/LAN/Builder/graph-evolution.mjs', '.SYSTEMX/LAN/Builder/graph-identity-adapter.mjs',
    '.SYSTEMX/LAN/Builder/graph-service.mjs', '.SYSTEMX/LAN/Builder/graph-http.mjs', '.SYSTEMX/LAN/Builder/api-contracts.mjs',
    '.SYSTEMX/LAN/Builder/api-validation.mjs', '.SYSTEMX/LAN/Builder/api-tools.mjs', '.SYSTEMX/LAN/Website/graph-contracts-ui.mjs',
    '.SYSTEMX/LAN/Website/graph-contracts.css',
  ]
  try {
    const absent = required.filter((path) => !existsSync(join(root, path)))
    assert.deepEqual(absent, [], `Integrated graph/API/UI modules are required before browser launch: ${absent.join(', ')}`)
    assert.match(readFileSync(join(root, '.SYSTEMX/LAN/server.mjs'), 'utf8'), /\/api\/contracts\//, 'Agent 0 server contract routing is required before browser launch')
    const commonDir = resolve(root, git(['rev-parse', '--git-common-dir']))
    const dependencyRoot = existsSync(join(root, 'node_modules')) ? root : dirname(commonDir)
    const requireDependencies = createRequire(join(dependencyRoot, 'package.json'))
    const { chromium, expect: browserExpect } = requireDependencies('@playwright/test')
    const expect = browserExpect.configure({ timeout: 15000 })
    const { getContractRegistry } = await import(new URL('../.SYSTEMX/LAN/Builder/api-contracts.mjs', import.meta.url))
    const { dispatchGraphContract } = await import(new URL('../.SYSTEMX/LAN/Builder/graph-http.mjs', import.meta.url))
    const { createGraphService } = await import(new URL('../.SYSTEMX/LAN/Builder/graph-service.mjs', import.meta.url))
    const registry = getContractRegistry('1.1')
    const oldRegistry = getContractRegistry('1.0')
    assert.match(registry.schemaRevision, hex64)
    assert.match(oldRegistry.schemaRevision, hex64)
    const implemented = registry.operations.filter((descriptor) => descriptor.implemented).map((descriptor) => descriptor.id).sort()
    report.contract = { apiVersion: registry.apiVersion, schemaRevision: registry.schemaRevision, oldSchemaRevision: oldRegistry.schemaRevision, implementedOperationIds: implemented }
    const descriptors = new Map(registry.operations.map((descriptor) => [descriptor.id, descriptor]))
    const oldDescriptors = new Map(oldRegistry.operations.map((descriptor) => [descriptor.id, descriptor]))
    const implementationPaths = [...required, '.SYSTEMX/LAN/Website/graph-contracts.css', '.SYSTEMX/LAN/server.mjs'].filter((path) => existsSync(join(root, path)))
    inputSnapshot = Object.fromEntries(implementationPaths.map((path) => [path, sha(readFileSync(join(root, path)))]))
    report.inputManifest = { algorithm: 'sha256', backlogSpecSha256: sha(readFileSync(specPath)), harnessSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
      implementationInputs: inputSnapshot,
      dependencies: { playwright: requireDependencies('@playwright/test/package.json').version, node: process.version } }
    writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(report.inputManifest, null, 2)}\n`)
    const sourceLan = join(root, '.SYSTEMX/LAN')
    for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), { recursive: true,
      filter: (source) => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some((name) => source === join(sourceLan, name)) })
    for (const path of ['package.json', '.SYSTEMX/INSTALLATION.json']) { mkdirSync(dirname(join(fixture, path)), { recursive: true }); cpSync(join(root, path), join(fixture, path)) }
    assert.ok(Object.entries(inputSnapshot).every(([path, digest]) => sha(readFileSync(join(fixture, path))) === digest), 'Copied implementation bytes differ from selected root inputs')
    assert.ok(existsSync(join(dependencyRoot, 'node_modules')), 'Existing installed dependencies are required; no install is performed')
    symlinkSync(join(dependencyRoot, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const source = 'export const GraphFixture = <main>synthetic graph fixture</main>\n'
    const sourceRevision = sha(source)
    const put = (path, value) => { const target = join(fixture, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
    put('src/pages/GraphFixture.tsx', source)
    put('.SYSTEMX/LAN/Backup/graph-canary.txt', 'PRIVATE_GRAPH_CANARY')
    put('.SYSTEMX/LAN/Temp/graph-canary.txt', 'PRIVATE_GRAPH_CANARY')
    put('.SYSTEMX/LAN/Research/graph-canary.txt', 'PRIVATE_GRAPH_CANARY')
    baseline = protectedSnapshot(fixture)
    fixtureEffects = () => protectedSnapshot(fixture)
    report.copiedInputSha256 = sha(JSON.stringify(report.inputManifest.implementationInputs))
    const lanPort = await freePort()
    let bridgePort
    bridge = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, `http://127.0.0.1:${bridgePort}`)
        if (url.pathname.startsWith('/__systemx')) {
          const chunks = []
          for await (const chunk of request) chunks.push(chunk)
          const headers = { ...request.headers }
          delete headers.host; delete headers.connection; delete headers['content-length']
          const upstream = await fetch(`http://127.0.0.1:${lanPort}${url.pathname.slice('/__systemx'.length) || '/'}${url.search}`, {
            method: request.method, headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks) }), signal: AbortSignal.timeout(15000),
          })
          response.writeHead(upstream.status, Object.fromEntries(upstream.headers))
          response.end(Buffer.from(await upstream.arrayBuffer()))
          return
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<!doctype html><html><head><title>Owned graph contract fixture</title></head><body><main><h1>Graph and contract fixture</h1><div id="graph-contract-test-host"></div></main></body></html>')
      } catch { response.writeHead(502); response.end('Owned fixture bridge unavailable') }
    })
    await new Promise((done, reject) => { bridge.once('error', reject); bridge.listen(0, '127.0.0.1', done) })
    bridgePort = bridge.address().port
    const origin = `http://127.0.0.1:${bridgePort}`
    report.origin = origin
    lan = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], { cwd: fixture,
      env: { ...process.env, SYSTEMX_LAN_PORT: String(lanPort), SYSTEMX_APP_PORT: String(bridgePort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_GOOGLE_FONTS_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
    for (const stream of [lan.stdout, lan.stderr]) stream.on('data', (part) => { lanOutput += part.toString() })
    report.ownedProcesses = { harness: process.pid, lan: lan.pid }
    let ready = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try { ready = (await fetch(`http://127.0.0.1:${lanPort}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Owned child only. */ }
      if (ready || lan.exitCode !== null) break
      await delay(50)
    }
    assert.ok(ready, `Owned LAN fixture did not become healthy: ${lanOutput.slice(-2000)}`)
    const dashboard = await (await fetch(`${origin}/__systemx/`)).text()
    const token = dashboard.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(token, 'Owned LAN server omitted its local session token')
    browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
    report.ownedProcesses.chromium = browserServer.process().pid
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
    context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true })
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    context.on('request', (request) => { const url = new URL(request.url()); if (url.origin === origin) report.browserRequests.push({ method: request.method(), path: url.pathname }) })
    context.on('response', (response) => {
      const url = new URL(response.url())
      if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/graph-contracts') || !/\.(?:mjs|css)$/.test(url.pathname)) return
      const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`
      assetPromises.push(response.body().then((bytes) => report.assetCaptures.push({ path, status: response.status(), sha256: sha(bytes), expectedSha256: report.inputManifest.implementationInputs[path], matchesCopiedInput: sha(bytes) === report.inputManifest.implementationInputs[path] })).catch((error) => report.assetCaptures.push({ path, error: error.message })))
    })
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== origin || !['GET', 'HEAD', 'POST'].includes(request.method()) || (request.method() === 'POST' && !url.pathname.startsWith('/__systemx/api/contracts/'))) {
        report.unexpectedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname })
        return route.abort('blockedbyclient')
      }
      await route.continue()
    })
    page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on('pageerror', (error) => report.pageErrors.push(error.message))
    page.on('dialog', async (dialog) => { report.dialogs.push({ type: dialog.type(), disposition: 'dismissed' }); await dialog.dismiss() })
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    const browserRequest = async (method, path, body, suppliedToken = token) => page.evaluate(async ({ method, path, body, suppliedToken }) => {
      const response = await fetch(`/__systemx${path}`, { method,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(suppliedToken === null ? {} : { 'x-systemx-session': suppliedToken }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) })
      return { status: response.status, body: await response.json().catch(() => null) }
    }, { method, path, body, suppliedToken })
    const unauthorized = await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.1', undefined, null)
    assert.equal(unauthorized.status, 403, 'Contract discovery must retain the LAN session guard')
    report.sessionGuard = { unauthenticatedDiscoveryStatus: unauthorized.status }
    let requestNumber = 0
    const operation = async (kind, id, payload = {}, { version = '1.1', confirmation, expectedRevision, extra = {} } = {}) => {
      const descriptor = (version === '1.0' ? oldDescriptors : descriptors).get(id)
      assert.ok(descriptor?.implemented, `${id} must be implemented in ${version}`)
      const envelope = { apiVersion: version, requestId: `browser${++requestNumber}`, kind, operation: id,
        ...(kind === 'command' ? { capabilityId: descriptor.capabilityId, confirmation: confirmation ?? '', expectedRevision: expectedRevision ?? null } : {}),
        payload: { type: id, ...payload }, ...extra }
      return browserRequest('POST', `/api/contracts/${kind}`, envelope)
    }
    const query = (id, payload, options) => operation('query', id, payload, options)
    const command = (id, payload, options) => operation('command', id, payload, options)
    const success = (response) => { assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(response.body?.ok, true); return response.body.result }
    const refusal = (response, category) => {
      assert.ok(response.status >= 400 && response.status < 600, `Expected HTTP refusal, got ${response.status}`)
      assert.equal(response.body?.ok, false)
      assert.match(response.body?.error?.code, /^[A-Z][A-Z0-9_]+$/)
      assert.ok(Array.isArray(response.body?.error?.findings))
      assert.ok(response.body.error.findings.length <= 50)
      assert.ok(Number.isInteger(response.body.error.omittedCount) && response.body.error.omittedCount >= 0)
      if (category) assert.equal(response.body.error.category, category)
      assert.doesNotMatch(JSON.stringify(response.body), privateCanary)
      return response.body.error
    }
    const discovery = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.1'))
    assert.ok(discovery)
    const graphStatus = success(await query('graph.status'))
    const workspaceId = graphStatus.workspaceId
    assert.match(workspaceId, hex64)
    let graph = graphFixture(workspaceId, sourceRevision)
    let acceptedRevision = null
    let acceptedDocumentId = graph.documentId
    const current = async () => success(await query('graph.document', { documentId: acceptedDocumentId }))
    const preview = (document = graph, version = '1.1') => command('graph.preview', { document }, { version })
    const accept = (digest, expectedRevision = acceptedRevision, version = '1.1') => command('graph.accept', { digest }, { confirmation: 'ACCEPT GRAPH', expectedRevision, version })
    const ensureUnchanged = async (revision = acceptedRevision) => { if (revision !== null) assert.equal((await current()).revision, revision) }
    const genericGraphRefusal = async () => { const invalid = copy(graph); invalid.pages[0].rootId = 'missingRoot'; return refusal(await preview(invalid)) }
    const genericApiRefusal = async () => refusal(await browserRequest('POST', '/api/contracts/query', { apiVersion: '2.0', requestId: `future${++requestNumber}`, kind: 'query', operation: 'graph.status', payload: { type: 'graph.status' } }), 'incompatible-version')
    const feedbackFrom = (value) => { assert.ok(isObject(value) || Array.isArray(value)); assert.ok(JSON.stringify(value).length > 0); assert.doesNotMatch(JSON.stringify(value), privateCanary) }
    const inspectUi = async () => {
      const visible = await page.locator('#graph-contract-test-host').innerText()
      assert.ok(visible.length > 30, 'Rendered graph/contract inspector must show operator feedback')
      assert.match(visible, /graph|contract/i)
      return { chars: visible.length, sha256: sha(visible) }
    }
    const uiAttached = await page.evaluate(async ({ token, workspaceId }) => {
      const { attachGraphContractInspector } = await import('/__systemx/Website/graph-contracts-ui.mjs')
      const host = document.getElementById('graph-contract-test-host')
      const api = async (path, body) => {
        const response = await fetch(`/__systemx${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Accept: 'application/json', 'x-systemx-session': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
        const value = await response.json()
        if (!response.ok) { const error = new Error(value?.error?.message ?? `HTTP ${response.status}`); error.response = value; throw error }
        return value
      }
      const controller = await attachGraphContractInspector({ container: host, api, getIdentityDocumentId: () => null, getWorkspaceId: () => workspaceId, onStatus: (value) => { window.__graphInspectorStatus = String(value) } })
      window.__graphInspectorController = controller
      return typeof attachGraphContractInspector === 'function'
    }, { token, workspaceId })
    assert.equal(uiAttached, true)
    await expect(page.locator('#graph-contract-test-host')).toBeVisible()
    await inspectUi()
    await page.screenshot({ path: join(evidence, '01-graph-contract-inspector.png') })

    const record = async (familyId, index, behavior, boundary, feedback) => {
      const entry = checks[(familyId === 'F005' ? 0 : 20) + index]
      assert.equal(typeof behavior, 'function')
      assert.equal(typeof boundary, 'function')
      entry.startedAt = new Date().toISOString()
      const requestsBefore = report.browserRequests.length
      try {
        const behaviorResult = await behavior()
        feedbackFrom(behaviorResult)
        const beforeRefusal = acceptedRevision
        const refusedResult = await boundary()
        feedbackFrom(refusedResult)
        await ensureUnchanged(beforeRefusal)
        const rendered = await inspectUi()
        if (feedback) await feedback(behaviorResult, refusedResult)
        entry.status = 'passed'
        entry.laneEvidence = { behavior: sha(JSON.stringify(behaviorResult)), boundaries: refusedResult.code ?? sha(JSON.stringify(refusedResult)),
          recovery: { acceptedRevisionPreserved: beforeRefusal }, feedback: { rendered, code: refusedResult.code ?? null, message: refusedResult.message ?? null },
          evidence: { browserRequestCount: report.browserRequests.length - requestsBefore, contractSchemaRevision: registry.schemaRevision } }
        assert.ok(entry.laneEvidence.evidence.browserRequestCount > 0, 'Capability check must exercise actual browser API')
      } catch (error) {
        entry.status = 'failed'
        entry.failure = error.message
        throw new Error(`${familyId}/${entry.key}: ${error.message}`, { cause: error })
      } finally { entry.finishedAt = new Date().toISOString() }
    }

    // F005 checks use actual HTTP dispatch in the fresh browser context. Every
    // check includes a capability-specific observation plus a refused import or
    // request, prior accepted-revision readback, rendered feedback and a receipt.
    await record('F005', 0, async () => {
      const proposed = success(await preview())
      assert.match(proposed.digest, hex64)
      assert.deepEqual(proposed.document.pages.map(({ id }) => id), ['page'])
      assert.equal(proposed.document.nodes.length, 5)
      const accepted = success(await accept(proposed.digest))
      acceptedRevision = accepted.revision
      assert.match(acceptedRevision, hex64)
      assert.equal((await current()).revision, acceptedRevision)
      return accepted
    }, genericGraphRefusal)
    await record('F005', 1, async () => { const bad = copy(graph); bad.pages[0].rootId = 'crossDocumentRoot'; const error = refusal(await preview(bad)); assert.match(JSON.stringify(error), /crossDocumentRoot|root/i); return error }, genericGraphRefusal)
    await record('F005', 2, async () => { const bad = copy(graph); bad.nodes.find((node) => node.id === 'root').parentId = 'alpha'; bad.nodes.find((node) => node.id === 'alpha').childIds = ['root']; const error = refusal(await preview(bad)); assert.match(JSON.stringify(error), /cycle|root|alpha/i); assert.ok(JSON.stringify(error).length < 20_000); return error }, genericGraphRefusal)
    await record('F005', 3, async () => { const bad = copy(graph); bad.nodes.find((node) => node.id === 'opaque').parentId = 'alpha'; const error = refusal(await preview(bad)); assert.match(JSON.stringify(error), /parent|child|opaque/i); return error }, genericGraphRefusal)
    await record('F005', 4, async () => {
      const exported = success(await query('graph.export', { documentId: graph.documentId }))
      assert.deepEqual(exported.document.nodes.find((node) => node.id === 'root').childIds, ['alpha', 'opaque', 'instance'])
      const reopened = success(await command('graph.reopen', { document: exported }, { confirmation: 'REOPEN GRAPH', expectedRevision: acceptedRevision }))
      acceptedRevision = reopened.revision
      assert.deepEqual((await current()).document.nodes.find((node) => node.id === 'root').childIds, ['alpha', 'opaque', 'instance'])
      return reopened
    }, genericGraphRefusal)
    await record('F005', 5, async () => { const node = (await current()).document.nodes.find((item) => item.id === 'opaque'); assert.equal(node.kind, 'opaque'); assert.equal(node.ownership, 'read-only'); assert.equal(node.source.path, 'src/pages/GraphFixture.tsx'); assert.ok(node.opaqueReason); return node }, genericGraphRefusal)
    await record('F005', 6, async () => {
      const tooMany = copy(graph)
      for (let i = 0; i < 1001; i += 1) tooMany.nodes.push({ id: `extra${i}`, kind: 'element', parentId: 'root', childIds: [], label: 'x', ownership: 'read-only', source: null, opaqueReason: null })
      const error = refusal(await preview(tooMany))
      assert.match(JSON.stringify(error), /node|limit|size|budget/i)
      const oversized = copy(graph); oversized.nodes[0].label = 'x'.repeat(400001)
      refusal(await preview(oversized))
      const tooManyReferences = copy(graph)
      for (let i = 0; i < 2001; i += 1) tooManyReferences.references.push({ id: `ref${i}`, kind: 'node', documentId: graph.documentId, targetId: 'alpha', expectedVersion: null, expectedSchemaId: null, required: false })
      refusal(await preview(tooManyReferences))
      const tooDeep = copy(graph)
      for (let i = 0; i < 65; i += 1) {
        const parent = i === 0 ? tooDeep.nodes.find((node) => node.id === 'alpha') : tooDeep.nodes.at(-1)
        const id = `deep${i}`
        parent.childIds.push(id)
        tooDeep.nodes.push({ id, kind: 'element', parentId: parent.id, childIds: [], label: id, ownership: 'read-only', source: null, opaqueReason: null })
      }
      refusal(await preview(tooDeep))
      return error
    }, genericGraphRefusal)
    await record('F005', 7, async () => { const future = copy(graph); future.schemaVersion = 2; const error = refusal(await preview(future)); assert.match(JSON.stringify(error), /version|schema/i); return error }, genericGraphRefusal)
    await record('F005', 8, async () => {
      const reorderedKeys = { nodes: [...graph.nodes].reverse(), pages: graph.pages, references: [...graph.references].reverse(), collections: graph.collections, components: graph.components, extensions: graph.extensions, sourceRevision: graph.sourceRevision, documentId: graph.documentId, workspaceId: graph.workspaceId, schemaVersion: 1 }
      const equivalent = success(await preview(reorderedKeys))
      assert.equal(equivalent.revision, acceptedRevision)
      const changed = graphFixture(workspaceId, sourceRevision, { order: ['opaque', 'alpha', 'instance'] })
      assert.notEqual(success(await preview(changed)).revision, equivalent.revision)
      return equivalent
    }, genericGraphRefusal)
    await record('F005', 9, async () => {
      const withWarning = copy(graph); withWarning.references.push({ id: 'optionalMissing', kind: 'component', documentId: graph.documentId, targetId: 'unavailable', expectedVersion: '1.0', expectedSchemaId: null, required: false })
      const proposed = success(await preview(withWarning))
      assert.ok(proposed.findings.some((finding) => finding.objectId === 'optionalMissing'))
      const accepted = success(await accept(proposed.digest))
      acceptedRevision = accepted.revision
      const filtered = success(await query('graph.findings', { documentId: graph.documentId, severity: 'warning', referenceType: 'component', objectId: 'optionalMissing', offset: 0, limit: 10 }))
      assert.ok(filtered.items.some((finding) => finding.objectId === 'optionalMissing' && finding.id))
      return filtered
    }, genericGraphRefusal)
    await record('F005', 10, async () => { const bad = copy(graph); bad.sessionToken = 'SESSION_GRAPH_CANARY'; return refusal(await preview(bad)) }, genericGraphRefusal)
    await record('F005', 11, async () => {
      const found = success(await query('graph.lookup', { workspaceId, documentId: graph.documentId, id: 'alpha', kind: 'node' }))
      assert.equal(found.id ?? found.node?.id, 'alpha')
      refusal(await query('graph.lookup', { workspaceId, documentId: graph.documentId, id: 'alpha', kind: 'collection' }), 'missing-target')
      return found
    }, genericGraphRefusal)
    await record('F005', 12, async () => {
      const accepted = (await current()).document
      assert.deepEqual(accepted.extensions['org.webappx.readonly'], graph.extensions['org.webappx.readonly'])
      const bad = copy(graph); bad.extensions['org.unknown'] = { command: 'run' }
      refusal(await preview(bad))
      return accepted.extensions
    }, genericGraphRefusal)
    await record('F005', 13, async () => {
      const oldRevision = acceptedRevision
      const changed = graphFixture(workspaceId, sourceRevision, { order: ['opaque', 'alpha', 'instance'], extra: true })
      const proposed = success(await preview(changed))
      const updated = success(await accept(proposed.digest))
      acceptedRevision = updated.revision
      const delta = success(await query('graph.compare', { documentId: graph.documentId, beforeRevision: oldRevision, afterRevision: acceptedRevision }))
      assert.ok(delta.added.some((item) => item.id === 'added'))
      assert.ok(delta.reordered.some((item) => item.id === 'root'))
      assert.equal((await current()).revision, acceptedRevision)
      return delta
    }, genericGraphRefusal)
    await record('F005', 14, async () => {
      const legacy = legacyGraphFixture(graph)
      const proposed = success(await command('graph.migrationPreview', { document: legacy, targetVersion: 1 }))
      assert.deepEqual([proposed.fromVersion, proposed.toVersion], [0, 1])
      assert.ok(Array.isArray(proposed.steps) && proposed.steps.length >= 3)
      const isolated = success(await command('graph.migrationApply', { digest: proposed.digest }, { confirmation: 'MIGRATE GRAPH COPY' }))
      assert.equal(isolated.isolatedCopy, true)
      assert.equal((await current()).revision, acceptedRevision)
      return isolated
    }, async () => refusal(await command('graph.migrationApply', { digest: '0'.repeat(64) }, { confirmation: 'MIGRATE GRAPH COPY' })))
    await record('F005', 15, async () => {
      const bad = copy(graph); bad.references.find((item) => item.id === 'componentRef').expectedVersion = '2.0'
      const error = refusal(await preview(bad))
      const optional = copy(bad); optional.references.find((item) => item.id === 'componentRef').required = false
      assert.ok(success(await preview(optional)).findings.some((item) => item.objectId === 'componentRef'))
      return error
    }, genericGraphRefusal)
    await record('F005', 16, async () => { const bad = copy(graph); bad.references.find((item) => item.id === 'collectionRef').expectedSchemaId = 'otherSchema'; return refusal(await preview(bad)) }, genericGraphRefusal)
    await record('F005', 17, async () => {
      const first = success(await query('graph.export', { documentId: graph.documentId }))
      const second = success(await query('graph.export', { documentId: graph.documentId }))
      assert.equal(JSON.stringify(first), JSON.stringify(second))
      assert.doesNotMatch(JSON.stringify(first), privateCanary)
      return first
    }, genericGraphRefusal)
    await record('F005', 18, async () => {
      const status = success(await query('graph.status'))
      const selected = status.documents.find((item) => item.documentId === graph.documentId)
      assert.equal(selected.revision, acceptedRevision)
      for (const field of ['pages', 'nodes', 'components', 'collections', 'references', 'unresolvedReferences']) assert.ok(Number.isInteger(selected.stats[field]))
      return selected
    }, genericGraphRefusal)
    await record('F005', 19, async () => {
      const bad = copy(graph); bad.sourceRevision = sha('new invalid source revision'); bad.pages[0].rootId = 'missingRoot'
      const error = refusal(await preview(bad))
      assert.match(JSON.stringify(error), new RegExp(bad.sourceRevision))
      assert.equal((await current()).revision, acceptedRevision)
      return error
    }, genericGraphRefusal)

    // F006 checks continue through the same served, session-protected endpoints.
    await record('F006', 0, async () => { assert.equal(discovery.apiVersion ?? discovery.currentVersion, '1.1'); assert.match(JSON.stringify(discovery), /1\.0/); return discovery }, genericApiRefusal)
    await record('F006', 1, async () => { const list = success(await query('contracts.list')); assert.ok(JSON.stringify(list).includes('graph.status')); const descriptor = descriptors.get('graph.status'); assert.equal(descriptor.kind, 'query'); assert.ok(descriptor.inputSchema && descriptor.resultSchema); return descriptor }, genericApiRefusal)
    await record('F006', 2, async () => { const descriptor = descriptors.get('graph.accept'); assert.equal(descriptor.kind, 'command'); assert.match(descriptor.capabilityId, /@1$/); assert.ok(descriptor.confirmation && descriptor.revisionPrecondition && descriptor.effect); return descriptor }, genericApiRefusal)
    await record('F006', 3, async () => {
      const descriptor = descriptors.get('graph.preview')
      const bad = { apiVersion: '1.1', requestId: 'unknownField', kind: 'command', operation: 'graph.preview', capabilityId: descriptor.capabilityId, confirmation: '', expectedRevision: null, payload: { type: 'graph.preview', document: graph }, unknown: true }
      return refusal(await browserRequest('POST', '/api/contracts/command', bad), 'validation')
    }, genericApiRefusal)
    await record('F006', 4, async () => refusal(await query('graph.findings', { documentId: graph.documentId, offset: '0', limit: 10 }), 'validation'), genericApiRefusal)
    await record('F006', 5, async () => {
      const old = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.0'))
      const oldStatus = success(await query('graph.status', {}, { version: '1.0' }))
      assert.equal(oldStatus.workspaceId, workspaceId)
      const oldPreview = success(await preview(graph, '1.0'))
      assert.match(oldPreview.digest, hex64)
      assert.ok(oldDescriptors.get('graph.compare')?.implemented !== true)
      return old
    }, async () => refusal(await browserRequest('POST', '/api/contracts/query', { apiVersion: '1.0', requestId: 'oldNew', kind: 'query', operation: 'graph.compare', payload: { type: 'graph.compare' } })))
    await record('F006', 6, genericApiRefusal, genericApiRefusal)
    await record('F006', 7, async () => {
      const categories = new Set()
      categories.add(refusal(await query('graph.document', { documentId: 'missingDocument' })).category)
      categories.add(refusal(await query('graph.findings', { documentId: graph.documentId, limit: 'wrong' })).category)
      const pending = success(await preview())
      categories.add(refusal(await accept(pending.digest, '0'.repeat(64))).category)
      const pendingAgain = success(await preview())
      categories.add(refusal(await command('graph.accept', { digest: pendingAgain.digest }, { confirmation: 'wrong', expectedRevision: acceptedRevision })).category)
      const descriptor = descriptors.get('graph.preview')
      categories.add(refusal(await browserRequest('POST', '/api/contracts/command', { apiVersion: '1.1', requestId: 'wrongCapability', kind: 'command', operation: 'graph.preview', capabilityId: `${descriptor.capabilityId}wrong`, confirmation: '', expectedRevision: null, payload: { type: 'graph.preview', document: graph } })).category)
      assert.deepEqual([...categories].sort(), ['capability', 'confirmation', 'conflict', 'missing-target', 'validation'])
      return { categories: [...categories] }
    }, genericApiRefusal)
    await record('F006', 8, async () => {
      const service = createGraphService({ workspaceId })
      const descriptor = descriptors.get('graph.status')
      assert.ok(descriptor)
      const malformed = await dispatchGraphContract({ service, method: 'POST', url: new URL('http://127.0.0.1/api/contracts/query'),
        body: { apiVersion: '1.1', requestId: 'badStub', kind: 'query', operation: 'graph.status', payload: { type: 'graph.status' } },
        handlerOverrides: { 'graph.status': () => ({ fake: 'PRIVATE_GRAPH_CANARY' }) } })
      const error = refusal({ status: malformed.statusCode, body: malformed.result }, 'internal')
      assert.equal(error.code, 'RESPONSE_CONTRACT_INVALID')
      return error
    }, genericApiRefusal)
    await record('F006', 9, async () => { const descriptor = descriptors.get('graph.findings'); assert.ok(descriptor.pagination); const error = refusal(await query('graph.findings', { documentId: graph.documentId, offset: -1, limit: 51 })); return { pagination: descriptor.pagination, error } }, genericApiRefusal)
    await record('F006', 10, async () => { const list = success(await query('contracts.list')); const ids = registry.operations.filter((item) => item.implemented).map((item) => item.capabilityId); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every((id) => /^lan\.(?:graph|contracts)\.[A-Za-z0-9-]+@1$/.test(id))); return { ids, list } }, genericApiRefusal)
    await record('F006', 11, async () => { const error = refusal(await query('graph.status', { mutate: true })); assert.equal((await current()).revision, acceptedRevision); return { error, commandEffect: descriptors.get('graph.accept').effect } }, genericApiRefusal)
    await record('F006', 12, async () => { const older = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.0')); assert.match(JSON.stringify(older), /deprecat|compatib|replac/i); assert.equal(success(await query('graph.status', {}, { version: '1.0' })).workspaceId, workspaceId); return older }, genericApiRefusal)
    await record('F006', 13, async () => {
      const before = report.browserRequests.length
      const examples = success(await query('contracts.examples', { operation: 'graph.status', version: '1.1' }))
      assert.match(JSON.stringify(examples), /valid|invalid/i)
      assert.ok(report.browserRequests.length - before === 1, 'Inspecting examples must send only the examples query')
      assert.doesNotMatch(JSON.stringify(examples), privateCanary)
      return examples
    }, genericApiRefusal)
    await record('F006', 14, async () => {
      const descriptor = descriptors.get('graph.preview')
      const mixed = { apiVersion: '1.1', requestId: 'mixedVariant', kind: 'command', operation: 'graph.preview', capabilityId: descriptor.capabilityId, confirmation: '', expectedRevision: null, payload: { type: 'graph.accept', document: graph } }
      return refusal(await browserRequest('POST', '/api/contracts/command', mixed), 'validation')
    }, genericApiRefusal)
    await record('F006', 15, async () => {
      const many = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`wrong${index}`, index]))
      const error = refusal(await query('graph.findings', { documentId: graph.documentId, ...many }), 'validation')
      assert.equal(error.findings.length, 50)
      assert.ok(error.omittedCount >= 20)
      return error
    }, genericApiRefusal)
    await record('F006', 16, async () => {
      const absent = success(await query('graph.document', { documentId: graph.documentId }))
      const explicitNull = refusal(await query('graph.document', { documentId: graph.documentId, revision: null }), 'validation')
      assert.equal(absent.revision, acceptedRevision)
      return { absent: absent.revision, explicitNull }
    }, genericApiRefusal)
    await record('F006', 17, async () => {
      const comparison = success(await query('contracts.compatibility', { beforeVersion: '1.0', afterVersion: '1.1' }))
      assert.match(JSON.stringify(comparison), /additive|breaking|added|removed/i)
      assert.match(JSON.stringify(comparison), /graph\.compare|graph\.findings/)
      return comparison
    }, genericApiRefusal)
    await record('F006', 18, async () => {
      const exported = success(await query('contracts.export'))
      assert.doesNotMatch(JSON.stringify(exported), privateCanary)
      assert.doesNotMatch(JSON.stringify(exported), /sessionToken|x-systemx-session|\/private\//)
      assert.ok(JSON.stringify(exported).includes(registry.schemaRevision))
      assert.ok(JSON.stringify(exported).includes('graph.status'))
      const path = join(evidence, 'public-contracts.json')
      writeFileSync(path, `${JSON.stringify(exported, null, 2)}\n`)
      report.contractExport = { path: 'public-contracts.json', sha256: sha(readFileSync(path)), bytes: readFileSync(path).length }
      return exported
    }, genericApiRefusal)
    await record('F006', 19, async () => {
      assert.match(registry.schemaRevision, hex64)
      assert.ok(implemented.length >= 10)
      assert.equal(report.contract.schemaRevision, registry.schemaRevision)
      return report.contract
    }, genericApiRefusal)

    // Exercise the mounted production UI with native fill/click/download actions,
    // separately from the browser's direct API checks above. Control discovery
    // uses labels and graph/contract IDs so a renamed control fails visibly.
    const uiControls = await page.locator('#graph-contract-test-host button, #graph-contract-test-host input, #graph-contract-test-host textarea, #graph-contract-test-host select').evaluateAll((nodes) => nodes.map((node) => ({
      id: node.id, tag: node.tagName.toLowerCase(), text: (node.innerText || node.labels?.[0]?.innerText || node.getAttribute('aria-label') || '').trim(),
    })))
    const pick = (tag, test, description) => {
      const found = uiControls.find((item) => item.tag === tag && item.id && test.test(`${item.id} ${item.text}`))
      assert.ok(found, `Mounted inspector lacks ${description}; available: ${uiControls.map((item) => `${item.id}:${item.text}`).join(', ').slice(0, 1500)}`)
      return page.locator(`#${found.id}`)
    }
    const uiGraph = graphFixture(workspaceId, sourceRevision, { documentId: 'uiGraph' })
    const importText = pick('textarea', /graph-(?:import|document|json)(?!.*(?:migration|reopen))|graph.*(?:import|document).*json/i, 'graph document JSON textarea')
    await importText.fill(JSON.stringify(uiGraph))
    const uiPreviewResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/__systemx/api/contracts/command' && response.request().postDataJSON()?.operation === 'graph.preview')
    void uiPreviewResponse.catch(() => {})
    await pick('button', /graph.*preview(?!.*migration)/i, 'graph preview button').click()
    assert.equal((await uiPreviewResponse).status(), 200)
    const acceptConfirmation = pick('input', /graph.*confirm/i, 'graph acceptance confirmation field')
    await acceptConfirmation.fill('ACCEPT GRAPH')
    const uiAcceptResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/__systemx/api/contracts/command' && response.request().postDataJSON()?.operation === 'graph.accept')
    void uiAcceptResponse.catch(() => {})
    await pick('button', /graph.*accept/i, 'graph acceptance button').click()
    assert.equal((await uiAcceptResponse).status(), 200)
    const selected = success(await query('graph.document', { documentId: 'uiGraph' }))
    assert.deepEqual(selected.document.nodes.find((node) => node.id === 'root').childIds, uiGraph.nodes[0].childIds)
    const downloadPending = page.waitForEvent('download')
    void downloadPending.catch(() => {})
    const uiExportResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/__systemx/api/contracts/query' && response.request().postDataJSON()?.operation === 'graph.export')
    void uiExportResponse.catch(() => {})
    await pick('button', /graph.*export/i, 'graph export button').click()
    assert.equal((await uiExportResponse).status(), 200)
    const download = await downloadPending
    assert.match(download.suggestedFilename(), /\.json$/)
    const downloadPath = join(evidence, 'ui-graph-export.json')
    await download.saveAs(downloadPath)
    const downloaded = JSON.parse(readFileSync(downloadPath, 'utf8'))
    assert.equal(downloaded.document.documentId, 'uiGraph')
    assert.deepEqual(downloaded.document.nodes.find((node) => node.id === 'root').childIds, uiGraph.nodes[0].childIds)
    assert.doesNotMatch(JSON.stringify(downloaded), privateCanary)
    report.graphExport = { path: 'ui-graph-export.json', sha256: sha(readFileSync(downloadPath)), bytes: readFileSync(downloadPath).length, revision: downloaded.revision }
    const versionSelect = pick('select', /contract.*version/i, 'contract API version selector')
    await versionSelect.selectOption('1.0')
    assert.equal(await versionSelect.inputValue(), '1.0')
    await versionSelect.selectOption('1.1')
    assert.equal(await versionSelect.inputValue(), '1.1')
    const operationSelect = pick('select', /contract.*operation/i, 'contract operation selector')
    await operationSelect.selectOption('graph.status')
    const examplesBefore = report.browserRequests.length
    await pick('button', /contract.*example/i, 'contract examples button').click()
    await expect(page.locator('#graph-contract-test-host')).toContainText(/valid|invalid/i)
    assert.ok(report.browserRequests.slice(examplesBefore).every((request) => request.path !== '/__systemx/api/contracts/command'), 'Inspecting examples must not dispatch a command')
    const uiText = await inspectUi()
    report.ui = { attached: true, previewClicked: true, acceptClicked: true, exportDownloaded: true, oldAndCurrentVersionSelected: true, examplesViewedWithoutCommand: true,
      rendered: uiText, controls: uiControls.length }
    assert.ok(report.ui.controls >= 10, 'Graph and contract inspector must expose real interactive controls')
    await page.screenshot({ path: join(evidence, '02-graph-contract-complete.png') })
    const dashboardPage = await context.newPage()
    dashboardPage.on('pageerror', (error) => report.pageErrors.push(error.message))
    await dashboardPage.goto(`${origin}/__systemx/#source`, { waitUntil: 'domcontentloaded' })
    await expect(dashboardPage.locator('#panel-source')).toBeVisible()
    if (await dashboardPage.locator('#right-panel-toggle').getAttribute('aria-expanded') !== 'true') await dashboardPage.locator('#right-panel-toggle').click()
    await dashboardPage.locator('[data-inspector-group-tab="build"]').click()
    await dashboardPage.locator('[data-inspector-tab="source"]').click()
    if (await dashboardPage.locator('#right-panel-visibility').getAttribute('aria-pressed') !== 'true') await dashboardPage.locator('#right-panel-visibility').click()
    await expect(dashboardPage.locator('#panel-source [id^="graph-"], #panel-source [id^="contract-"]').first()).toBeAttached()
    report.ui.dashboardMountedControls = await dashboardPage.locator('#panel-source [id^="graph-"], #panel-source [id^="contract-"]').count()
    await dashboardPage.screenshot({ path: join(evidence, '03-dashboard-mounted-inspector.png') })
    await dashboardPage.close()
    await Promise.all(assetPromises)
    assert.equal(report.unexpectedRequests.length, 0)
    assert.equal(report.pageErrors.length, 0)
    assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/graph-contracts-ui.mjs') && asset.matchesCopiedInput))
    assert.ok(report.assetCaptures.every((asset) => asset.status === 200 && asset.matchesCopiedInput))
    assert.ok(checks.every((entry) => entry.status === 'passed'))
    report.status = 'passed'
  } catch (error) {
    failure = error
    report.status = 'failed'
    report.failure = { message: error.message, stack: error.stack }
    report.pendingIssues.push(error.message)
    if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {})
  } finally {
    if (context) await context.tracing.stop({ path: join(evidence, 'trace.zip') }).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (browserServer) await browserServer.close().catch(() => {})
    await stopOwned(lan)
    if (bridge) { bridge.closeAllConnections(); if (bridge.listening) await new Promise((done) => bridge.close(done)) }
    await Promise.allSettled(assetPromises)
    report.protectedFixturePreserved = baseline ? JSON.stringify(fixtureEffects()) === JSON.stringify(baseline) : null
    report.implementationInputsPreserved = inputSnapshot ? Object.entries(inputSnapshot).every(([path, digest]) => existsSync(join(root, path)) && sha(readFileSync(join(root, path))) === digest) : null
    report.ownedProcessesExited = !lan || lan.exitCode !== null
    report.harnessPreserved = report.inputManifest ? sha(readFileSync(fileURLToPath(import.meta.url))) === report.inputManifest.harnessSha256 : null
    if (report.status === 'passed' && (!report.protectedFixturePreserved || !report.implementationInputsPreserved || !report.ownedProcessesExited || !report.harnessPreserved)) {
      failure = new Error('Protected input, fixture effects, harness or owned-process invariant failed')
      report.status = 'failed'; report.failure = { message: failure.message, stack: failure.stack }
    }
    report.finishedAt = new Date().toISOString()
    report.counts = Object.fromEntries(['passed', 'failed', 'not-run'].map((status) => [status, checks.filter((entry) => entry.status === status).length]))
    writeFileSync(join(evidence, 'server-output.log'), lanOutput)
    writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
    const manifest = { schemaVersion: 1, status: report.status, artifacts: files(evidence).map((path) => ({ path: relative(evidence, path), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })) }
    writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    rmSync(fixture, { recursive: true, force: true })
    console.log(JSON.stringify({ status: report.status, counts: report.counts, contract: report.contract, protectedFixturePreserved: report.protectedFixturePreserved,
      implementationInputsPreserved: report.implementationInputsPreserved, ownedProcessesExited: report.ownedProcessesExited, evidence, failure: report.failure?.message }, null, 2))
  }
  if (failure) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
