#!/usr/bin/env node
/** Isolated, browser-executed F005/F006 graph and contract proof. No provider access. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

export function bindCatalogRequirements(records, catalog) {
  assert.ok(Array.isArray(catalog?.items), 'The authored requirement catalog is required')
  const byId = new Map(catalog.items.map((item) => [item.id, item]))
  return records.map((record) => ({ ...record, definitions: record.requirementIds.map((id, index) => {
    const item = byId.get(id)
    assert.ok(item && item.familyId === record.familyId && item.capabilityKey === record.key && item.lane === record.lanes[index], `Original requirement binding changed for ${id}`)
    assert.match(item.definitionSha256, /^[a-f0-9]{64}$/, `Missing original definition digest for ${id}`)
    return { id, lane: item.lane, definitionSha256: item.definitionSha256 }
  }) }))
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
const exited = (child) => !child || child.exitCode !== null || child.signalCode !== null
export const stopOwned = async (child) => {
  if (exited(child)) return
  const wait = (milliseconds) => new Promise((done) => {
    const finish = () => { clearTimeout(timer); child.removeListener('exit', finish); done() }
    const timer = setTimeout(finish, milliseconds)
    child.once('exit', finish)
    if (exited(child)) finish()
  })
  child.kill('SIGTERM')
  await wait(5000)
  if (!exited(child)) { child.kill('SIGKILL'); await wait(5000) }
  assert.ok(exited(child), 'An owned fixture process did not reach a terminal state')
}

async function main() {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-graph-contract-browser-'))
  const evidenceParent = outputDirectory(process.argv.slice(2), temporary)
  mkdirSync(evidenceParent, { recursive: true })
  const evidence = mkdtempSync(join(evidenceParent, 'graph-contract-run-'))
  const fixture = join(temporary, 'fixture')
  const specPath = join(root, '.SYSTEMX/LAN/Backlog/specs/01-foundation.json')
  const catalogPath = join(root, 'docs/backlog/lan-10000.json')
  const specification = JSON.parse(readFileSync(specPath, 'utf8'))
  const checks = bindCatalogRequirements(requirementsFromSpec(specification), JSON.parse(readFileSync(catalogPath, 'utf8')))
  const report = { schemaVersion: 1, kind: 'isolated-graph-contract-browser-evidence', status: 'not-run', startedAt: new Date().toISOString(),
    revision: git(['rev-parse', 'HEAD']), scope: 'Copied local LAN assets, synthetic source and graph, owned loopback server and fresh Chromium context. Runtime evidence only after integration; no LAN backlog acceptance, provider, production or user session claim.',
    checks, browserRequests: [], unexpectedRequests: [], pageErrors: [], assetCaptures: [], dialogs: [], pendingIssues: [] }
  let lan, bridge, browserServer, browserChild, browser, context, page, baseline, inputSnapshot, protectedBefore, fixtureEffects, failure, lanOutput = ''
  let malformedResponseRequestId = null
  let migrationResponseDelay = null
  let releaseMigrationResponse = null
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
    const sourceLan = join(root, '.SYSTEMX/LAN')
    const excludedLanDirectories = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(sourceLan, name))
    const implementationPaths = [...files(sourceLan).filter((path) => !excludedLanDirectories.some((directory) => path === directory || path.startsWith(`${directory}${sep}`))),
      ...files(join(root, 'src')), join(root, 'package.json'), join(root, '.SYSTEMX/INSTALLATION.json')].map((path) => relative(root, path).replaceAll('\\', '/')).sort()
    inputSnapshot = Object.fromEntries(implementationPaths.map((path) => [path, sha(readFileSync(join(root, path)))]))
    const protectedPaths = git(['ls-files', '-z', '--', 'src', '.SYSTEMX/LAN/Research', '.SYSTEMX/KIT', '.SYSTEMX/Template', '.SYSTEMX/GLOBAL',
      '.SYSTEMX/PLAN', '.SYSTEMX/MEMORY', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/.systemx/releases']).split('\0').filter(Boolean)
    protectedBefore = Object.fromEntries(protectedPaths.map((path) => [path, sha(readFileSync(join(root, path)))]))
    for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), { recursive: true,
      filter: (source) => !excludedLanDirectories.includes(source) })
    for (const path of ['package.json', '.SYSTEMX/INSTALLATION.json']) { mkdirSync(dirname(join(fixture, path)), { recursive: true }); cpSync(join(root, path), join(fixture, path)) }
    assert.ok(Object.entries(inputSnapshot).every(([path, digest]) => sha(readFileSync(join(fixture, path))) === digest), 'Copied implementation bytes differ from selected root inputs')
    const { getContractRegistry } = await import(pathToFileURL(join(fixture, '.SYSTEMX/LAN/Builder/api-contracts.mjs')).href)
    const { dispatchGraphContract } = await import(pathToFileURL(join(fixture, '.SYSTEMX/LAN/Builder/graph-http.mjs')).href)
    const { createGraphService } = await import(pathToFileURL(join(fixture, '.SYSTEMX/LAN/Builder/graph-service.mjs')).href)
    const registry = getContractRegistry('1.1')
    const oldRegistry = getContractRegistry('1.0')
    assert.match(registry.schemaRevision, hex64)
    assert.match(oldRegistry.schemaRevision, hex64)
    const implemented = registry.operations.filter((descriptor) => descriptor.implemented).map((descriptor) => descriptor.id).sort()
    report.contract = { apiVersion: registry.apiVersion, schemaRevision: registry.schemaRevision, oldSchemaRevision: oldRegistry.schemaRevision, implementedOperationIds: implemented }
    const descriptors = new Map(registry.operations.map((descriptor) => [descriptor.id, descriptor]))
    const oldDescriptors = new Map(oldRegistry.operations.map((descriptor) => [descriptor.id, descriptor]))
    report.inputManifest = { algorithm: 'sha256', backlogSpecSha256: sha(readFileSync(specPath)), backlogCatalogSha256: sha(readFileSync(catalogPath)), harnessSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
      implementationInputs: inputSnapshot, protectedSourceAndSeeds: protectedBefore,
      dependencies: { playwright: requireDependencies('@playwright/test/package.json').version, node: process.version } }
    writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(report.inputManifest, null, 2)}\n`)
    assert.ok(existsSync(join(dependencyRoot, 'node_modules')), 'Existing installed dependencies are required; no install is performed')
    symlinkSync(join(dependencyRoot, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const source = "import ExternalCard from '../components/ExternalCard'\nexport function GraphFixture() { const opaque = 'LOCAL_OPAQUE_GRAPH_CONTEXT'; return <main data-systemx-id=\"graphRoot\"><h1 data-systemx-id=\"graphHeading\">Graph fixture</h1><p>{opaque}</p><ExternalCard title=\"Synthetic external card\" /></main> }\nexport function Auxiliary() { return <aside data-systemx-id=\"graphAuxiliary\">Separate authored root</aside> }\n"
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
          const bodyBytes = Buffer.concat(chunks)
          let parsed
          try { parsed = bodyBytes.length ? JSON.parse(bodyBytes.toString('utf8')) : null } catch { /* Production server validates ordinary malformed JSON. */ }
          // A one-shot owned fixture fault reaches the browser through HTTP and
          // uses the copied production response validator. It is never installed
          // into the application server or selected through a public request flag.
          if (malformedResponseRequestId && parsed?.requestId === malformedResponseRequestId && url.pathname === '/__systemx/api/contracts/query') {
            malformedResponseRequestId = null
            const malformed = await dispatchGraphContract({ service: createGraphService({ workspaceId: sha('isolated-response-fixture') }), method: 'POST',
              url: new URL('http://127.0.0.1/api/contracts/query'), body: parsed,
              handlerOverrides: { 'graph.status': () => ({ fake: 'PRIVATE_GRAPH_CANARY' }) } })
            response.writeHead(malformed.statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            response.end(JSON.stringify(malformed.result))
            return
          }
          const upstream = await fetch(`http://127.0.0.1:${lanPort}${url.pathname.slice('/__systemx'.length) || '/'}${url.search}`, {
            method: request.method, headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: bodyBytes }), signal: AbortSignal.timeout(15000),
          })
          const upstreamBytes = Buffer.from(await upstream.arrayBuffer())
          if (migrationResponseDelay && parsed?.operation === 'graph.migrationApply') {
            const held = migrationResponseDelay
            migrationResponseDelay = null
            held.seen()
            await held.release
          }
          response.writeHead(upstream.status, Object.fromEntries(upstream.headers))
          response.end(upstreamBytes)
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
    browserChild = browserServer.process()
    report.ownedProcesses.chromium = browserChild.pid
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
    context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true })
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    context.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin !== origin) return
      let operation = null
      if (request.method() === 'POST' && url.pathname.startsWith('/__systemx/api/contracts/')) {
        try { operation = request.postDataJSON()?.operation ?? null } catch { /* Invalid payload bodies retain a bounded request record. */ }
      }
      report.browserRequests.push({ method: request.method(), path: url.pathname, ...(operation === null ? {} : { operation }) })
    })
    context.on('response', (response) => {
      const url = new URL(response.url())
      if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/') || !/\.(?:mjs|js|css)$/.test(url.pathname)) return
      const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`
      assetPromises.push(response.body().then((bytes) => report.assetCaptures.push({ path, status: response.status(), sha256: sha(bytes), expectedSha256: report.inputManifest.implementationInputs[path], matchesCopiedInput: sha(bytes) === report.inputManifest.implementationInputs[path] })).catch((error) => report.assetCaptures.push({ path, error: error.message })))
    })
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url())
      const ownedPost = url.pathname.startsWith('/__systemx/api/contracts/') || ['/__systemx/api/identity/preview', '/__systemx/api/identity/accept'].includes(url.pathname)
      if (url.origin !== origin || !['GET', 'HEAD', 'POST'].includes(request.method()) || (request.method() === 'POST' && !ownedPost)) {
        report.unexpectedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname })
        return route.abort('blockedbyclient')
      }
      await route.continue()
    })
    page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on('pageerror', (error) => report.pageErrors.push(error.message))
    page.on('dialog', async (dialog) => { report.dialogs.push({ type: dialog.type(), disposition: 'dismissed' }); await dialog.dismiss() })
    await page.goto(`${origin}/__systemx/#source`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#panel-source')).toBeVisible()
    await expect(page.locator('#graph-contract-inspector')).toBeAttached()
    if (!await page.locator('#graph-contract-inspector').evaluate((node) => node.open)) await page.locator('#graph-contract-inspector > summary').click()
    const graphHost = '#graph-contract-container'
    const openCard = async (id) => {
      const card = page.locator(`#${id}`)
      if (!await card.evaluate((node) => node.open)) await card.locator(':scope > summary').click()
    }
    let lastExchange = null
    const browserRequest = async (method, path, body, suppliedToken = token) => {
      const result = await page.evaluate(async ({ method, path, body, suppliedToken }) => {
      const response = await fetch(`/__systemx${path}`, { method,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(suppliedToken === null ? {} : { 'x-systemx-session': suppliedToken }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) })
      return { status: response.status, body: await response.json().catch(() => null) }
      }, { method, path, body, suppliedToken })
      if (path.startsWith('/api/contracts/') && body?.requestId) assert.equal(result.body?.requestId, body.requestId, 'Contract response must echo its exact request identity')
      lastExchange = { method, path, body: copy(body ?? null), response: result }
      return result
    }
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
    assert.equal(discovery.schemaRevision, registry.schemaRevision, 'Served current discovery must match the copied schema revision')
    assert.deepEqual(discovery.operations.filter((item) => item.implemented).map((item) => item.id).sort(), implemented)
    report.contract.servedCurrentSchemaRevision = discovery.schemaRevision
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
      const visible = await page.locator(graphHost).innerText()
      assert.ok(visible.length > 30, 'Rendered graph/contract inspector must show operator feedback')
      assert.match(visible, /graph|contract/i)
      return { chars: visible.length, sha256: sha(visible) }
    }
    await expect(page.locator(graphHost)).toBeVisible()
    await inspectUi()
    await page.screenshot({ path: join(evidence, '01-graph-contract-inspector.png') })

    const uiAction = async (buttonId, { operation: expectedOperation, status = 200, label } = {}) => {
      const responsePending = expectedOperation ? page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/__systemx/api/contracts/')
        && response.request().postDataJSON()?.operation === expectedOperation) : null
      if (responsePending) void responsePending.catch(() => {})
      await page.locator(`#${buttonId}`).click()
      if (responsePending) assert.equal((await responsePending).status(), status)
      await expect(page.locator(`#${buttonId}`)).toBeEnabled()
      if (label) await expect(page.locator('#graph-contract-status')).toContainText(label)
    }
    const refreshAcceptedUi = async () => {
      if (acceptedRevision === null) return
      await openCard('graph-accepted-card')
      await uiAction('graph-refresh', { operation: 'graph.status' })
      const selected = page.locator('#graph-document-select')
      if (await selected.inputValue() !== acceptedDocumentId) {
        await selected.selectOption(acceptedDocumentId)
        await expect(page.locator('#graph-refresh')).toBeEnabled()
      }
      await expect(page.locator('#graph-accepted-result')).toContainText(acceptedRevision)
    }
    const showRefusalUi = async (exchange, error) => {
      assert.equal(exchange.method, 'POST', 'Structured refusal feedback uses an actual declared envelope')
      assert.ok(exchange.body?.requestId)
      await openCard('contract-discovery-card')
      if (error.code === 'RESPONSE_CONTRACT_INVALID') malformedResponseRequestId = exchange.body.requestId
      await page.locator('#contract-runner-json').fill(JSON.stringify(exchange.body))
      await uiAction('contract-send', { operation: exchange.body.operation, status: exchange.response.status })
      const renderedResponse = JSON.parse(await page.locator('#contract-runner-result').innerText())
      assert.equal(renderedResponse.ok, false)
      assert.equal(renderedResponse.requestId, exchange.body.requestId)
      assert.equal(renderedResponse.error.code, error.code)
      assert.equal(renderedResponse.error.category, error.category)
      await expect(page.locator('#graph-contract-error')).toContainText(error.code)
      await expect(page.locator('#graph-contract-status')).toContainText('Refused:')
      return { requestId: renderedResponse.requestId, code: renderedResponse.error.code, category: renderedResponse.error.category,
        renderedErrorSha256: sha(await page.locator('#graph-contract-error').innerText()) }
    }

    const record = async (familyId, index, behavior, boundary, feedback) => {
      const entry = checks[(familyId === 'F005' ? 0 : 20) + index]
      assert.equal(typeof behavior, 'function')
      assert.equal(typeof boundary, 'function')
      entry.startedAt = new Date().toISOString()
      const requestsBefore = report.browserRequests.length
      try {
        const behaviorResult = await behavior()
        feedbackFrom(behaviorResult)
        await refreshAcceptedUi()
        const beforeRefusal = acceptedRevision
        const beforeDocument = beforeRefusal === null ? null : (await current()).document
        const beforeClientView = await page.locator('#graph-accepted-result').innerText()
        const refusedResult = await boundary()
        const refusalExchange = lastExchange
        feedbackFrom(refusedResult)
        await ensureUnchanged(beforeRefusal)
        const afterDocument = beforeRefusal === null ? null : (await current()).document
        assert.deepEqual(afterDocument, beforeDocument, 'A refused request must retain every accepted graph field, not merely its declared revision')
        const refusalUi = await showRefusalUi(refusalExchange, refusedResult)
        assert.equal(await page.locator('#graph-accepted-result').innerText(), beforeClientView, 'A structured refusal must retain the previous valid client view')
        const rendered = await inspectUi()
        if (feedback) await feedback(behaviorResult, refusedResult)
        entry.status = 'passed'
        entry.laneEvidence = { behavior: sha(JSON.stringify(behaviorResult)), boundaries: refusedResult.code ?? sha(JSON.stringify(refusedResult)),
          recovery: { acceptedRevisionPreserved: beforeRefusal, documentSha256: sha(JSON.stringify(afterDocument)), clientViewSha256: sha(beforeClientView) },
          feedback: { rendered, ...refusalUi, message: refusedResult.message ?? null },
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
    await record('F005', 5, async () => {
      const identityPreview = await browserRequest('POST', '/api/identity/preview', { path: 'src/pages/GraphFixture.tsx' })
      assert.equal(identityPreview.status, 200, JSON.stringify(identityPreview.body))
      const identityAccept = await browserRequest('POST', '/api/identity/accept', { digest: identityPreview.body.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
      assert.equal(identityAccept.status, 200, JSON.stringify(identityAccept.body))
      const identity = identityAccept.body.map
      assert.ok(identity.nodes.filter((node) => node.parentId === null).length > 1, 'The actual TSX identity import must retain both authored definition roots')
      const imported = success(await command('graph.preview', { identityDocumentId: identity.documentId }))
      assert.equal(imported.document.nodes.length, identity.nodes.length + 1, 'Multiple authored roots need one explicit read-only document wrapper, not a discarded root')
      const opaque = imported.document.nodes.filter((node) => node.kind === 'opaque')
      assert.ok(opaque.length > 0)
      assert.ok(opaque.every((node) => node.ownership === 'read-only' && node.source.path === 'src/pages/GraphFixture.tsx' && node.opaqueReason))
      assert.doesNotMatch(JSON.stringify(imported.document), /LOCAL_OPAQUE_GRAPH_CONTEXT/)
      report.identityAdapter = { identityDocumentId: identity.documentId, authoredRoots: identity.nodes.filter((node) => node.parentId === null).length,
        graphNodes: imported.document.nodes.length, opaqueNodes: opaque.length, sourceRevisionPreserved: imported.document.sourceRevision === sourceRevision }
      return imported
    }, genericGraphRefusal)
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
      refusal(await query('graph.lookup', { workspaceId: sha('another-graph-workspace'), documentId: graph.documentId, id: 'alpha', kind: 'node' }))
      refusal(await query('graph.lookup', { workspaceId, documentId: 'anotherDocument', id: 'alpha', kind: 'node' }))
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
      const oldSnapshot = copy((await current()).document)
      const changed = graphFixture(workspaceId, sourceRevision, { order: ['opaque', 'alpha', 'instance'], extra: true })
      changed.nodes.find((node) => node.id === 'alpha').label = 'Changed synthetic label'
      const proposed = success(await preview(changed))
      const updated = success(await accept(proposed.digest))
      acceptedRevision = updated.revision
      const delta = success(await query('graph.compare', { documentId: graph.documentId, beforeRevision: oldRevision, afterRevision: acceptedRevision }))
      assert.ok(delta.added.some((item) => item.id === 'added'))
      assert.ok(delta.reordered.some((item) => item.id === 'root'))
      assert.ok(delta.changed.some((item) => item.id === 'alpha'))
      assert.ok(delta.removed.some((item) => item.id === 'optionalMissing'))
      for (const kind of ['added', 'removed', 'changed', 'reordered']) assert.equal(delta.totals[kind], delta[kind].length)
      assert.equal(delta.omittedCount, 0)
      assert.deepEqual(success(await query('graph.document', { documentId: graph.documentId, revision: oldRevision })).document, oldSnapshot, 'Comparison must preserve the earlier accepted snapshot')
      assert.deepEqual((await current()).document, proposed.document, 'Comparison must preserve the newer accepted snapshot')
      assert.equal((await current()).revision, acceptedRevision)
      return delta
    }, genericGraphRefusal)
    await record('F005', 14, async () => {
      const legacy = legacyGraphFixture(graph)
      const original = JSON.stringify(legacy)
      const proposed = success(await command('graph.migrationPreview', { document: legacy, targetVersion: 1 }))
      assert.deepEqual([proposed.fromVersion, proposed.toVersion], [0, 1])
      assert.ok(Array.isArray(proposed.steps) && proposed.steps.length >= 3)
      const isolated = success(await command('graph.migrationApply', { digest: proposed.digest }, { confirmation: 'MIGRATE GRAPH COPY' }))
      assert.equal(isolated.isolatedCopy, true)
      assert.equal(isolated.document.schemaVersion, 1)
      assert.deepEqual(isolated.document.nodes.find((node) => node.id === 'root').childIds, graph.nodes[0].childIds)
      assert.equal(JSON.stringify(legacy), original, 'Migration must not modify its original input')
      assert.equal((await current()).revision, acceptedRevision)
      const unsupported = copy(legacy); unsupported.unknownTransformation = true
      refusal(await command('graph.migrationPreview', { document: unsupported, targetVersion: 1 }))
      return isolated
    }, async () => refusal(await command('graph.migrationApply', { digest: '0'.repeat(64) }, { confirmation: 'MIGRATE GRAPH COPY' })))
    await record('F005', 15, async () => {
      const bad = copy(graph); bad.references.find((item) => item.id === 'componentRef').expectedVersion = '2.0'
      const error = refusal(await preview(bad))
      const optional = copy(bad); optional.references.find((item) => item.id === 'componentRef').required = false
      assert.ok(success(await preview(optional)).findings.some((item) => item.objectId === 'componentRef'))
      const missing = copy(graph); missing.components = []; missing.nodes = missing.nodes.filter((node) => node.id !== 'componentRoot')
      refusal(await preview(missing))
      missing.references.find((item) => item.id === 'componentRef').required = false
      assert.ok(success(await preview(missing)).findings.some((item) => item.objectId === 'componentRef'))
      return error
    }, genericGraphRefusal)
    await record('F005', 16, async () => {
      const bad = copy(graph); bad.references.find((item) => item.id === 'collectionRef').expectedSchemaId = 'otherSchema'
      const error = refusal(await preview(bad))
      const incompatible = copy(graph); incompatible.references.find((item) => item.id === 'collectionRef').expectedVersion = '2.0'
      refusal(await preview(incompatible))
      const missing = copy(graph); missing.collections = []
      refusal(await preview(missing))
      return error
    }, genericGraphRefusal)
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
      const accepted = (await current()).document
      for (const field of ['pages', 'nodes', 'components', 'collections', 'references']) assert.equal(selected.stats[field], accepted[field].length)
      assert.equal(selected.stats.revision, acceptedRevision)
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
    await record('F006', 0, async () => {
      const observed = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.1'))
      assert.equal(observed.apiVersion, '1.1'); assert.deepEqual(observed.supportedVersions, ['1.0', '1.1'])
      assert.equal(observed.schemaRevision, registry.schemaRevision)
      return observed
    }, genericApiRefusal)
    await record('F006', 1, async () => { const list = success(await query('contracts.list')); assert.ok(JSON.stringify(list).includes('graph.status')); const descriptor = descriptors.get('graph.status'); assert.equal(descriptor.kind, 'query'); assert.ok(descriptor.inputSchema && descriptor.resultSchema); return descriptor }, genericApiRefusal)
    await record('F006', 2, async () => { const descriptor = success(await query('contracts.describe', { operation: 'graph.accept' })); assert.equal(descriptor.kind, 'command'); assert.match(descriptor.capabilityId, /@1$/); assert.ok(descriptor.confirmation && descriptor.revisionPrecondition && descriptor.effect); return descriptor }, genericApiRefusal)
    await record('F006', 3, async () => {
      const descriptor = descriptors.get('graph.preview')
      const bad = { apiVersion: '1.1', requestId: 'unknownField', kind: 'command', operation: 'graph.preview', capabilityId: descriptor.capabilityId, confirmation: '', expectedRevision: null, payload: { type: 'graph.preview', document: graph }, unknown: true }
      return refusal(await browserRequest('POST', '/api/contracts/command', bad), 'validation')
    }, genericApiRefusal)
    await record('F006', 4, async () => refusal(await query('graph.findings', { documentId: graph.documentId, offset: '0', limit: 10 }), 'validation'), genericApiRefusal)
    await record('F006', 5, async () => {
      const old = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.0'))
      assert.equal(old.compatibleVersion, '1.0')
      assert.equal(old.schemaRevision, oldRegistry.schemaRevision)
      assert.deepEqual(old.operations.filter((item) => item.implemented).map((item) => item.id).sort(), oldRegistry.operations.filter((item) => item.implemented).map((item) => item.id).sort())
      report.contract.servedOlderSchemaRevision = old.schemaRevision
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
      const beforeClient = await page.locator('#graph-accepted-result').innerText()
      malformedResponseRequestId = 'badStub'
      const malformed = await browserRequest('POST', '/api/contracts/query', { apiVersion: '1.1', requestId: 'badStub', kind: 'query', operation: 'graph.status', payload: { type: 'graph.status' } })
      const error = refusal(malformed, 'internal')
      const malformedExchange = lastExchange
      assert.equal(error.code, 'RESPONSE_CONTRACT_INVALID')
      const ui = await showRefusalUi(malformedExchange, error)
      assert.equal(await page.locator('#graph-accepted-result').innerText(), beforeClient)
      report.malformedResponseBrowserProof = { ...ui, previousClientViewPreserved: true, scope: 'One-shot owned HTTP fixture fault using copied production response validation, followed by the real dashboard client refusal.' }
      return error
    }, genericApiRefusal)
    await record('F006', 9, async () => { const descriptor = descriptors.get('graph.findings'); assert.ok(descriptor.pagination); const error = refusal(await query('graph.findings', { documentId: graph.documentId, offset: -1, limit: 51 })); return { pagination: descriptor.pagination, error } }, genericApiRefusal)
    await record('F006', 10, async () => { const list = success(await query('contracts.list')); const ids = registry.operations.filter((item) => item.implemented).map((item) => item.capabilityId); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every((id) => /^lan\.(?:graph|contracts)\.[A-Za-z0-9-]+@1$/.test(id))); return { ids, list } }, genericApiRefusal)
    await record('F006', 11, async () => { const error = refusal(await query('graph.status', { mutate: true })); assert.equal((await current()).revision, acceptedRevision); return { error, commandEffect: descriptors.get('graph.accept').effect } }, genericApiRefusal)
    await record('F006', 12, async () => {
      const older = success(await browserRequest('GET', '/api/contracts/discovery?clientVersion=1.0'))
      assert.ok(older.deprecated.length > 0)
      assert.ok(older.deprecated.every((item) => item.replacementVersion === '1.1' && item.compatibilityWindow === 'supported until an explicit removal release'))
      assert.equal(success(await query('graph.status', {}, { version: '1.0' })).workspaceId, workspaceId)
      return older
    }, genericApiRefusal)
    await record('F006', 13, async () => {
      const before = report.browserRequests.length
      const examples = success(await query('contracts.examples', { operation: 'graph.status', version: '1.1' }))
      assert.equal(examples.validRequest.operation, 'graph.status')
      assert.equal(examples.invalidRequest.operation, 'graph.status')
      assert.notDeepEqual(examples.validRequest, examples.invalidRequest)
      assert.equal(report.browserRequests.slice(before).filter((request) => request.path.startsWith('/__systemx/api/contracts/')).length, 1, 'Inspecting examples must send only the examples query')
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
      assert.ok(comparison.additions.some((item) => item.operation === 'graph.compare'))
      assert.equal(comparison.breakingCount, 0)
      const reverse = success(await query('contracts.compatibility', { beforeVersion: '1.1', afterVersion: '1.0' }))
      assert.ok(reverse.breakingChanges.some((item) => item.operation === 'graph.compare'))
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
      assert.equal(report.contract.servedCurrentSchemaRevision, registry.schemaRevision)
      assert.equal(report.contract.servedOlderSchemaRevision, oldRegistry.schemaRevision)
      return report.contract
    }, genericApiRefusal)

    // Use the dashboard's actual boot-mounted inspector, not a second injected
    // component host. Every action below crosses the guarded served API and
    // asserts the operator-facing result and retained client state.
    const uiControls = await page.locator(`${graphHost} button, ${graphHost} input, ${graphHost} textarea, ${graphHost} select`).evaluateAll((nodes) => nodes.map((node) => ({
      id: node.id, tag: node.tagName.toLowerCase(), text: (node.innerText || node.labels?.[0]?.innerText || node.getAttribute('aria-label') || '').trim(),
    })))
    assert.ok(uiControls.length >= 30, 'Real dashboard must mount the complete interactive inspector')
    const frameBeforeUi = await page.locator('#app-preview-frame').boundingBox()
    assert.ok(frameBeforeUi?.width > 0)
    const importText = page.locator('#graph-import-json')
    const identityText = page.locator('#graph-identity-id')
    const uiGraph = graphFixture(workspaceId, sourceRevision, { documentId: 'uiGraph' })
    uiGraph.references.push({ id: 'uiOptional', kind: 'component', documentId: 'uiGraph', targetId: 'missingUiComponent', expectedVersion: '1.0', expectedSchemaId: null, required: false })
    await openCard('graph-import-card')
    await importText.fill(JSON.stringify(uiGraph))
    await identityText.fill('')
    await uiAction('graph-preview', { operation: 'graph.preview', label: 'Graph import preview complete' })
    const uiPreview = JSON.parse(await page.locator('#graph-preview-result').innerText())
    assert.match(uiPreview.digest, hex64)
    assert.equal(uiPreview.documentId, 'uiGraph')
    assert.equal(uiPreview.expectedRevision, null)
    assert.equal(uiPreview.stats.pages, 1)
    assert.ok(uiPreview.findings.some((finding) => finding.objectId === 'uiOptional'))
    await page.locator('#graph-accept-confirmation').fill('ACCEPT GRAPH')
    await uiAction('graph-accept', { operation: 'graph.accept', label: 'Graph acceptance complete' })
    const uiInitial = success(await query('graph.document', { documentId: 'uiGraph' }))
    await openCard('graph-accepted-card')
    await expect(page.locator('#graph-accepted-result')).toContainText(uiInitial.revision)
    const renderedAccepted = JSON.parse(await page.locator('#graph-accepted-result').innerText())
    assert.equal(renderedAccepted.schemaVersion, 1)
    assert.equal(renderedAccepted.sourceRevision, sourceRevision)
    assert.equal(renderedAccepted.stats.nodes, uiGraph.nodes.length)
    assert.equal(renderedAccepted.stats.opaqueNodes, 1)
    await page.locator('#graph-finding-severity').selectOption('warning')
    await page.locator('#graph-finding-object').fill('uiOptional')
    await page.locator('#graph-finding-reference-type').selectOption('component')
    await page.locator('#graph-finding-offset').fill('0')
    await page.locator('#graph-finding-limit').fill('1')
    await uiAction('graph-findings', { operation: 'graph.findings' })
    const uiFindings = JSON.parse(await page.locator('#graph-findings-result').innerText())
    assert.equal(uiFindings.items.length, 1)
    assert.equal(uiFindings.items[0].objectId, 'uiOptional')
    assert.equal(uiFindings.items[0].severity, 'warning')
    assert.equal(uiFindings.items[0].referenceType, 'component')
    assert.equal(uiFindings.revision, uiInitial.revision)
    assert.equal(uiFindings.totalScope, 'retained-findings')
    const beforeInvalidLocalPagination = report.browserRequests.filter((request) => request.path.startsWith('/__systemx/api/contracts/')).length
    const previousFindings = await page.locator('#graph-findings-result').innerText()
    await page.locator('#graph-finding-limit').fill('51')
    await uiAction('graph-findings', { label: 'Refused:' })
    assert.equal(report.browserRequests.filter((request) => request.path.startsWith('/__systemx/api/contracts/')).length, beforeInvalidLocalPagination, 'Invalid local pagination must not send a coerced request')
    assert.equal(await page.locator('#graph-findings-result').innerText(), previousFindings)
    await page.locator('#graph-finding-limit').fill('1')
    await page.locator('#graph-lookup-id').fill('alpha')
    await page.locator('#graph-lookup-kind').selectOption('node')
    await uiAction('graph-lookup', { operation: 'graph.lookup' })
    assert.equal(JSON.parse(await page.locator('#graph-lookup-result').innerText()).id, 'alpha')
    const beforeWrongKind = await page.locator('#graph-accepted-result').innerText()
    await page.locator('#graph-lookup-kind').selectOption('collection')
    await uiAction('graph-lookup', { operation: 'graph.lookup', status: 404, label: 'Refused:' })
    assert.equal(await page.locator('#graph-accepted-result').innerText(), beforeWrongKind)
    await page.locator('#graph-lookup-kind').selectOption('node')

    const uiDownload = async (buttonId, operationId, name) => {
      const pending = page.waitForEvent('download')
      void pending.catch(() => {})
      await uiAction(buttonId, { operation: operationId })
      const download = await pending
      assert.match(download.suggestedFilename(), /\.json$/)
      const path = join(evidence, name)
      await download.saveAs(path)
      const bytes = readFileSync(path)
      const value = JSON.parse(bytes.toString('utf8'))
      assert.doesNotMatch(bytes.toString('utf8'), privateCanary)
      return { value, artifact: { path: name, sha256: sha(bytes), bytes: bytes.length } }
    }
    await openCard('graph-history-card')
    const downloaded = await uiDownload('graph-export', 'graph.export', 'ui-graph-export.json')
    assert.equal(downloaded.value.document.documentId, 'uiGraph')
    assert.deepEqual(downloaded.value.document.nodes.find((node) => node.id === 'root').childIds, uiGraph.nodes[0].childIds)
    const downloadedAgain = await uiDownload('graph-export', 'graph.export', 'ui-graph-export-repeated.json')
    assert.equal(downloadedAgain.artifact.sha256, downloaded.artifact.sha256, 'Repeated explicit exports must have identical complete bytes')
    report.graphExport = { ...downloaded.artifact, revision: downloaded.value.revision, repeatedDownloadSha256: downloadedAgain.artifact.sha256 }
    await page.locator('#graph-reopen-json').fill(JSON.stringify(downloaded.value))
    await page.locator('#graph-reopen-confirmation').fill('REOPEN GRAPH')
    await uiAction('graph-reopen', { operation: 'graph.reopen' })
    assert.equal(JSON.parse(await page.locator('#graph-history-result').innerText()).reopened, true)
    assert.deepEqual(success(await query('graph.document', { documentId: 'uiGraph' })).document, uiInitial.document)

    const changedUi = graphFixture(workspaceId, sourceRevision, { documentId: 'uiGraph', order: ['opaque', 'alpha', 'instance'], extra: true })
    changedUi.nodes.find((node) => node.id === 'alpha').label = 'Changed UI node label'
    await importText.fill(JSON.stringify(changedUi))
    await uiAction('graph-preview', { operation: 'graph.preview' })
    await page.locator('#graph-accept-confirmation').fill('ACCEPT GRAPH')
    await uiAction('graph-accept', { operation: 'graph.accept' })
    const uiChanged = success(await query('graph.document', { documentId: 'uiGraph' }))
    assert.notEqual(uiChanged.revision, uiInitial.revision)
    await page.locator('#graph-before-revision').fill(uiInitial.revision)
    await page.locator('#graph-after-revision').fill(uiChanged.revision)
    await uiAction('graph-compare', { operation: 'graph.compare' })
    const uiComparison = JSON.parse(await page.locator('#graph-compare-result').innerText())
    assert.ok(uiComparison.added.some((item) => item.id === 'added'))
    assert.ok(uiComparison.removed.some((item) => item.id === 'uiOptional'))
    assert.ok(uiComparison.changed.some((item) => item.id === 'alpha'))
    assert.ok(uiComparison.reordered.some((item) => item.id === 'root'))
    assert.deepEqual(success(await query('graph.document', { documentId: 'uiGraph', revision: uiInitial.revision })).document, uiInitial.document)
    assert.deepEqual(success(await query('graph.document', { documentId: 'uiGraph', revision: uiChanged.revision })).document, uiChanged.document)

    await openCard('graph-migration-card')
    const migrationGraph = graphFixture(workspaceId, sourceRevision, { documentId: 'migratedUiGraph' })
    const legacyUi = legacyGraphFixture(migrationGraph)
    const legacyBefore = JSON.stringify(legacyUi)
    await page.locator('#graph-migration-json').fill(legacyBefore)
    await uiAction('graph-migration-preview', { operation: 'graph.migrationPreview' })
    const migrationPreview = JSON.parse(await page.locator('#graph-migration-result').innerText())
    assert.deepEqual([migrationPreview.fromVersion, migrationPreview.toVersion], [0, 1])
    assert.ok(migrationPreview.steps.length >= 3)
    assert.deepEqual(migrationPreview.unsupportedFields, [])
    await page.locator('#graph-migration-confirmation').fill('MIGRATE GRAPH COPY')
    await uiAction('graph-migration-apply', { operation: 'graph.migrationApply' })
    assert.equal(JSON.parse(await page.locator('#graph-migration-result').innerText()).isolatedCopy, true)
    const migrationCopy = JSON.parse(await importText.inputValue())
    assert.equal(migrationCopy.schemaVersion, 1)
    assert.equal(migrationCopy.documentId, 'migratedUiGraph')
    assert.deepEqual(migrationCopy.nodes.find((node) => node.id === 'root').childIds, migrationGraph.nodes[0].childIds)
    assert.equal(JSON.stringify(legacyUi), legacyBefore)
    assert.ok(!success(await query('graph.status')).documents.some((item) => item.documentId === 'migratedUiGraph'), 'Applying an isolated migration must not accept it')
    assert.equal(success(await query('graph.document', { documentId: 'uiGraph' })).revision, uiChanged.revision)
    await uiAction('graph-preview', { operation: 'graph.preview' })
    await page.locator('#graph-accept-confirmation').fill('ACCEPT GRAPH')
    await uiAction('graph-accept', { operation: 'graph.accept' })
    const migratedAccepted = success(await query('graph.document', { documentId: 'migratedUiGraph' }))
    assert.deepEqual(migratedAccepted.document, migrationCopy)

    const raceMigrationGraph = graphFixture(workspaceId, sourceRevision, { documentId: 'raceMigrationGraph' })
    await page.locator('#graph-migration-json').fill(JSON.stringify(legacyGraphFixture(raceMigrationGraph)))
    await uiAction('graph-migration-preview', { operation: 'graph.migrationPreview' })
    await page.locator('#graph-migration-confirmation').fill('MIGRATE GRAPH COPY')
    let markMigrationSeen
    const migrationSeen = new Promise((done) => { markMigrationSeen = done })
    const release = new Promise((done) => { releaseMigrationResponse = done })
    migrationResponseDelay = { seen: markMigrationSeen, release }
    await page.locator('#graph-migration-apply').click()
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error('The owned migration response did not reach its delay fence')), 15000)
      migrationSeen.then(() => { clearTimeout(timer); done() }, reject)
    })
    const newerImportDraft = JSON.stringify(graphFixture(workspaceId, sourceRevision, { documentId: 'newerDraftGraph' }))
    await importText.fill(newerImportDraft)
    await identityText.fill('newerIdentitySelection')
    const acceptedBeforeDelayedCopy = await page.locator('#graph-accepted-result').innerText()
    releaseMigrationResponse()
    releaseMigrationResponse = null
    await expect(page.locator('#graph-migration-apply')).toBeEnabled()
    assert.equal(await importText.inputValue(), newerImportDraft, 'A late migration response must not overwrite newer graph JSON')
    assert.equal(await identityText.inputValue(), 'newerIdentitySelection', 'A late migration response must not clear the newer identity selection')
    const retainedCopy = JSON.parse(await page.locator('#graph-migration-copy-json').inputValue())
    assert.equal(retainedCopy.documentId, 'raceMigrationGraph')
    assert.equal(retainedCopy.schemaVersion, 1)
    assert.equal(await page.locator('#graph-accepted-result').innerText(), acceptedBeforeDelayedCopy)
    await page.locator('#graph-migration-use-copy').click()
    assert.equal(JSON.parse(await importText.inputValue()).documentId, 'raceMigrationGraph', 'Only the explicit retained-copy control may stage the late copy')
    assert.equal(await identityText.inputValue(), '')
    assert.ok(!success(await query('graph.status')).documents.some((item) => item.documentId === 'raceMigrationGraph'))
    report.delayedMigration = { responseHeldUntilNewDraft: true, newerImportAndIdentityPreserved: true,
      isolatedCopyRetainedForReview: true, explicitCopyStagingRequired: true, acceptedViewPreserved: true }

    // The supported older version is exercised through actual discovery,
    // preview and acceptance controls, not merely an API-only status query.
    await openCard('contract-discovery-card')
    await page.locator('#contract-version').selectOption('1.0')
    const oldDiscoveryPending = page.waitForResponse((response) => new URL(response.url()).pathname === '/__systemx/api/contracts/discovery' && new URL(response.url()).searchParams.get('clientVersion') === '1.0')
    void oldDiscoveryPending.catch(() => {})
    await page.locator('#contract-discover').click()
    const oldDiscoveryResponse = await oldDiscoveryPending
    assert.equal(oldDiscoveryResponse.status(), 200)
    await expect(page.locator('#contract-discover')).toBeEnabled()
    const oldUiDiscovery = success({ status: oldDiscoveryResponse.status(), body: await oldDiscoveryResponse.json() })
    assert.equal(oldUiDiscovery.compatibleVersion, '1.0')
    assert.equal(oldUiDiscovery.schemaRevision, oldRegistry.schemaRevision)
    await expect(page.locator('#contract-discovery')).toContainText(oldRegistry.schemaRevision)
    await expect(page.locator('#contract-discovery')).toContainText('"compatibleVersion": "1.0"')
    const oldDiscoveryView = await page.locator('#contract-discovery').innerText()
    assert.ok(oldDiscoveryView.length <= 24200, 'The discovery inspector must keep its bounded display')
    if (JSON.stringify(oldUiDiscovery, null, 2).length > 24000) assert.match(oldDiscoveryView, /display limited; use the explicit export/)
    const oldUiGraph = graphFixture(workspaceId, sourceRevision, { documentId: 'olderUiGraph' })
    await importText.fill(JSON.stringify(oldUiGraph))
    await identityText.fill('')
    await uiAction('graph-preview', { operation: 'graph.preview' })
    await page.locator('#graph-accept-confirmation').fill('ACCEPT GRAPH')
    await uiAction('graph-accept', { operation: 'graph.accept' })
    assert.equal(success(await query('graph.document', { documentId: 'olderUiGraph' }, { version: '1.0' })).document.documentId, 'olderUiGraph')
    const beforeFutureUi = await page.locator('#graph-accepted-result').innerText()
    const beforeFutureDiscovery = await page.locator('#contract-discovery').innerText()
    await page.locator('#contract-version').selectOption('2.0')
    const futureDiscoveryPending = page.waitForResponse((response) => new URL(response.url()).pathname === '/__systemx/api/contracts/discovery' && new URL(response.url()).searchParams.get('clientVersion') === '2.0')
    void futureDiscoveryPending.catch(() => {})
    await page.locator('#contract-discover').click()
    assert.ok((await futureDiscoveryPending).status() >= 400)
    await expect(page.locator('#contract-discover')).toBeEnabled()
    await expect(page.locator('#graph-contract-error')).toContainText('incompatible-version')
    assert.equal(await page.locator('#graph-accepted-result').innerText(), beforeFutureUi)
    assert.equal(await page.locator('#contract-discovery').innerText(), beforeFutureDiscovery)
    await page.locator('#contract-version').selectOption('1.1')
    await page.locator('#contract-discover').click()
    await expect(page.locator('#contract-discover')).toBeEnabled()
    await expect(page.locator('#contract-discovery')).toContainText(registry.schemaRevision)

    await page.locator('#contract-operation').selectOption('graph.status')
    const examplesBefore = report.browserRequests.length
    await uiAction('contract-describe', { operation: 'contracts.examples' })
    const renderedExamples = JSON.parse(await page.locator('#contract-descriptor').innerText())
    assert.equal(renderedExamples.descriptor.id, 'graph.status')
    assert.equal(renderedExamples.syntheticExamplesNotSent.validRequest.operation, 'graph.status')
    assert.ok(report.browserRequests.slice(examplesBefore).every((request) => request.path !== '/__systemx/api/contracts/command'), 'Inspecting examples must never send the examples as commands')
    assert.deepEqual(report.browserRequests.slice(examplesBefore).filter((request) => request.path.startsWith('/__systemx/api/contracts/')).map((request) => request.operation), ['contracts.describe', 'contracts.examples'], 'Inspecting examples must not execute their query or command envelope')
    const validExample = copy(renderedExamples.syntheticExamplesNotSent.validRequest)
    validExample.requestId = 'uiValidExample'
    await page.locator('#contract-runner-json').fill(JSON.stringify(validExample))
    await uiAction('contract-send', { operation: 'graph.status' })
    assert.equal(JSON.parse(await page.locator('#contract-runner-result').innerText()).ok, true)
    const invalidExample = copy(renderedExamples.syntheticExamplesNotSent.invalidRequest)
    invalidExample.requestId = 'uiInvalidExample'
    await page.locator('#contract-runner-json').fill(JSON.stringify(invalidExample))
    const clientBeforeInvalidExample = await page.locator('#graph-accepted-result').innerText()
    await uiAction('contract-send', { operation: 'graph.status', status: 400, label: 'Refused:' })
    assert.equal(JSON.parse(await page.locator('#contract-runner-result').innerText()).error.category, 'validation')
    assert.equal(await page.locator('#graph-accepted-result').innerText(), clientBeforeInvalidExample)
    await page.locator('#contract-before-version').selectOption('1.0')
    await page.locator('#contract-after-version').selectOption('1.1')
    await uiAction('contract-compare', { operation: 'contracts.compatibility' })
    assert.ok(JSON.parse(await page.locator('#contract-compatibility').innerText()).additions.some((item) => item.operation === 'graph.compare'))
    await page.locator('#contract-before-version').selectOption('1.1')
    await page.locator('#contract-after-version').selectOption('1.0')
    await uiAction('contract-compare', { operation: 'contracts.compatibility' })
    assert.ok(JSON.parse(await page.locator('#contract-compatibility').innerText()).breakingChanges.some((item) => item.operation === 'graph.compare'))
    const publicMetadata = await uiDownload('contract-export', 'contracts.export', 'ui-public-contracts.json')
    assert.equal(publicMetadata.value.schemaRevision, registry.schemaRevision)
    assert.deepEqual(publicMetadata.value.operations.filter((item) => item.implemented).map((item) => item.id).sort(), implemented)
    assert.doesNotMatch(JSON.stringify(publicMetadata.value), /sessionToken|x-systemx-session|\/private\//)
    report.uiContractExport = publicMetadata.artifact
    const frameAfterUi = await page.locator('#app-preview-frame').boundingBox()
    assert.equal(frameAfterUi.width, frameBeforeUi.width, 'Opening and using graph subpanels must not resize the preview canvas')
    report.ui = { actualDashboardBoot: true, injectedComponentHost: false, previewClicked: true, acceptClicked: true, findingsFiltered: true,
      qualifiedLookup: true, wrongKindRefused: true, exportDownloaded: true, reopenRoundTrip: true, completeRevisionComparison: true,
      migrationIsolatedThenAccepted: true, olderVersionDiscoveryPreviewAndAccept: true, futureVersionRetainedClient: true,
      delayedMigrationPreservedNewerDraft: true,
      validAndInvalidExamplesExplicitlyExecuted: true, examplesViewedWithoutCommand: true, directionalCompatibilityCompared: true,
      publicMetadataDownloaded: true, previewWidthPreserved: frameAfterUi.width, controls: uiControls.length, rendered: await inspectUi() }
    await page.screenshot({ path: join(evidence, '02-graph-contract-complete.png') })
    await Promise.all(assetPromises)
    assert.equal(report.unexpectedRequests.length, 0)
    assert.equal(report.pageErrors.length, 0)
    assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/graph-contracts-ui.mjs') && asset.matchesCopiedInput))
    assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/graph-contracts.css') && asset.matchesCopiedInput))
    assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/dashboard.js') && asset.matchesCopiedInput))
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
    if (releaseMigrationResponse) releaseMigrationResponse()
    report.cleanupObservations = []
    const cleanup = async (label, action) => {
      try { await action() } catch (error) { report.cleanupObservations.push({ operation: label, message: String(error.message).slice(0, 400) }) }
    }
    if (context) await cleanup('save-owned-browser-trace', () => context.tracing.stop({ path: join(evidence, 'trace.zip') }))
    if (browser) await cleanup('close-owned-browser', () => browser.close())
    if (browserServer) await cleanup('close-owned-browser-server', () => browserServer.close())
    await cleanup('verify-owned-chromium-terminal', () => stopOwned(browserChild))
    await cleanup('verify-owned-lan-terminal', () => stopOwned(lan))
    if (bridge) await cleanup('close-owned-loopback-bridge', async () => { bridge.closeAllConnections(); if (bridge.listening) await new Promise((done) => bridge.close(done)) })
    await Promise.allSettled(assetPromises)
    report.protectedFixturePreserved = baseline ? JSON.stringify(fixtureEffects()) === JSON.stringify(baseline) : null
    report.implementationInputsPreserved = inputSnapshot ? Object.entries(inputSnapshot).every(([path, digest]) => existsSync(join(root, path)) && sha(readFileSync(join(root, path))) === digest) : null
    report.protectedRootPreserved = protectedBefore ? Object.entries(protectedBefore).every(([path, digest]) => existsSync(join(root, path)) && sha(readFileSync(join(root, path))) === digest) : null
    report.ownedProcessReadback = { lan: exited(lan), chromium: exited(browserChild), bridge: !bridge || !bridge.listening }
    report.ownedProcessDisposition = { lan: lan ? { pid: lan.pid, exitCode: lan.exitCode, signalCode: lan.signalCode } : null,
      chromium: browserChild ? { pid: browserChild.pid, exitCode: browserChild.exitCode, signalCode: browserChild.signalCode } : null }
    report.ownedProcessesExited = Object.values(report.ownedProcessReadback).every(Boolean)
    report.harnessPreserved = report.inputManifest ? sha(readFileSync(fileURLToPath(import.meta.url))) === report.inputManifest.harnessSha256 : null
    report.requirementDefinitionsPreserved = report.inputManifest ? sha(readFileSync(specPath)) === report.inputManifest.backlogSpecSha256 && sha(readFileSync(catalogPath)) === report.inputManifest.backlogCatalogSha256 : null
    if (report.status === 'passed' && (!report.protectedFixturePreserved || !report.implementationInputsPreserved || !report.protectedRootPreserved || !report.ownedProcessesExited || !report.harnessPreserved || !report.requirementDefinitionsPreserved)) {
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
      implementationInputsPreserved: report.implementationInputsPreserved, protectedRootPreserved: report.protectedRootPreserved,
      requirementDefinitionsPreserved: report.requirementDefinitionsPreserved, ownedProcessesExited: report.ownedProcessesExited, evidence, failure: report.failure?.message }, null, 2))
  }
  if (failure) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
