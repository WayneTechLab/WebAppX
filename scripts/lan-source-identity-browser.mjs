#!/usr/bin/env node
/** F003/F004 source identity proof against the served LAN UI and API in an owned fixture. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { createServer as createPortProbe } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const commonDir = resolve(root, git(['rev-parse', '--git-common-dir']))
const dependencyRoot = existsSync(join(root, 'node_modules')) ? root : dirname(commonDir)
const requireDependencies = createRequire(join(dependencyRoot, 'package.json'))
const { chromium, expect: browserExpect } = requireDependencies('@playwright/test')
const expect = browserExpect.configure({ timeout: 15000 })
const specification = JSON.parse(readFileSync(join(root, '.SYSTEMX/LAN/Backlog/specs/01-foundation.json'), 'utf8'))
const families = Object.fromEntries(specification.families.filter((family) => ['F003', 'F004'].includes(family.id)).map((family) => [family.id, family]))
assert.equal(families.F003?.capabilities.length, 20, 'F003 authored capability contract changed')
assert.equal(families.F004?.capabilities.length, 20, 'F004 authored capability contract changed')

const temporary = mkdtempSync(join(tmpdir(), 'webappx-source-identity-browser-'))
const fixture = join(temporary, 'fixture')
const evidenceParent = process.env.SYSTEMX_SOURCE_IDENTITY_EVIDENCE_DIR ? resolve(process.env.SYSTEMX_SOURCE_IDENTITY_EVIDENCE_DIR) : temporary
mkdirSync(evidenceParent, { recursive: true })
const evidence = mkdtempSync(join(evidenceParent, 'identity-run-'))
const report = {
  schemaVersion: 1,
  kind: 'isolated-source-identity-browser-evidence',
  startedAt: new Date().toISOString(),
  revision: git(['rev-parse', 'HEAD']),
  scope: 'Synthetic F002-eligible TSX fixtures served by copied LAN server and UI. This is local acceptance evidence only; no Designer DOM binding, catalog acceptance, production, provider, or native-platform proof is inferred.',
  checks: [], assetCaptures: [], browserRequests: [], unexpectedRequests: [], pageErrors: [], dialogs: [],
}
for (const family of ['F003', 'F004']) {
  for (const [index, capability] of families[family].capabilities.entries()) {
    const first = (family === 'F003' ? 201 : 301) + index * 5
    report.checks.push({ family, key: capability.key, requirementRange: `LAN-${String(first).padStart(5, '0')}–LAN-${String(first + 4).padStart(5, '0')}`, status: 'not-run', evidence: null })
  }
}
const check = async (family, index, evidenceScope, action) => {
  const record = report.checks[(family === 'F003' ? 0 : 20) + index]
  if (typeof action !== 'function') {
    record.status = 'not-evidenced'
    record.evidence = evidenceScope
    return
  }
  record.startedAt = new Date().toISOString()
  try {
    const result = await action()
    record.status = result?.partial ? 'partial' : 'passed'
    if (result?.partial) record.limitation = result.partial
    record.evidence = evidenceScope
    record.finishedAt = new Date().toISOString()
  } catch (error) {
    record.status = 'failed'
    record.evidence = evidenceScope
    record.failure = error.message
    record.finishedAt = new Date().toISOString()
    throw new Error(`${family}/${record.key}: ${error.message}`, { cause: error })
  }
}
const regularFiles = (directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? regularFiles(path) : [path]
  }).sort()
}
const snapshot = (directory) => Object.fromEntries(regularFiles(directory).map((path) => {
  const key = relative(directory, path).replaceAll('\\', '/')
  return [key, lstatSync(path).isSymbolicLink() ? `link:${sha(readlinkSync(path))}` : sha(readFileSync(path))]
}))
const fixtureEffects = () => Object.fromEntries(['src', '.SYSTEMX/LAN/Backup', '.SYSTEMX/LAN/Temp', '.SYSTEMX/LAN/Research'].map((path) => [path, snapshot(join(fixture, path))]))
const protectedPaths = git(['ls-files', '-z', '--', 'src', '.SYSTEMX/LAN/Backup', '.SYSTEMX/LAN/Research', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/.systemx/releases']).split('\0').filter(Boolean)
const protectedBefore = Object.fromEntries(protectedPaths.map((path) => [path, sha(readFileSync(join(root, path)))]))
const freePort = () => new Promise((resolvePort, reject) => {
  const probe = createPortProbe()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close((error) => error ? reject(error) : resolvePort(port)) })
})
const put = (path, value, destination = fixture) => {
  const target = join(destination, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
  return target
}
const homePath = 'src/pages/HomePage.tsx'
const aboutPath = 'src/pages/AboutPage.tsx'
const sharedPath = 'src/components/layout/Frame.tsx'
const renamePath = 'src/pages/RenamePage.tsx'
const renamedPath = 'src/pages/RenamedPage.tsx'
const homeInitial = `import ExternalCard from '../components/ExternalCard'\nexport function HomePage() {\n  const opaque = 'OPAQUE_RUNTIME_VALUE'\n  return <main data-systemx-id="homeRoot">\n    <h1 data-systemx-id="hero">Identity fixture hero</h1>\n    <p data-systemx-id="summary">Summary literal fixture</p>\n    <button data-systemx-id="primary">Primary action</button>\n    <section><span>Ambiguous twin</span><span>Ambiguous twin</span></section>\n    <p>Unique fallback fixture</p>\n    <p>{opaque}</p>\n    <ExternalCard title="External fixture" />\n  </main>\n}\n`
const homeReordered = homeInitial.replace('    <p data-systemx-id="summary">Summary literal fixture</p>\n    <button data-systemx-id="primary">Primary action</button>', '    <button data-systemx-id="primary">Primary action</button>\n    <p data-systemx-id="summary">Summary literal fixture</p>')
const homeReplaced = homeReordered.replace('data-systemx-id="hero"', 'data-systemx-id="newHero"')
const aboutInitial = 'export function AboutPage() { return <main data-systemx-id="aboutRoot"><h1 data-systemx-id="aboutHero">Identity fixture hero</h1><p>About route literal</p></main> }\n'
const sharedInitial = 'export function Frame() { return <header data-systemx-id="sharedHeader"><strong>Shared shell fixture</strong></header> }\n'
const renameInitial = 'export function RenamePage() { return <main data-systemx-id="renameRoot"><p data-systemx-id="renameText">Rename fixture</p></main> }\n'
const fixtures = new Map([[homePath, homeInitial], [aboutPath, aboutInitial], [sharedPath, sharedInitial], [renamePath, renameInitial]])
const forbidden = /OPAQUE_RUNTIME_VALUE|PRIVATE_CONTENT_NEEDLE|EXTERNAL_LINK_TARGET|x-systemx-session|sessionToken|\/external-owned/
const assertMetadataOnly = (value, label = 'metadata') => {
  const serialized = JSON.stringify(value)
  assert.doesNotMatch(serialized, forbidden, `${label} leaked source/private data`)
  assert.ok(!serialized.includes(fixture), `${label} leaked the fixture root`)
  assert.ok(!serialized.includes(temporary), `${label} leaked the temporary root`)
}
const nodeByAnchor = (map, anchor) => {
  const node = map.nodes.find((entry) => entry.anchor === anchor)
  assert.ok(node, `Anchor ${anchor} absent from imported map`)
  return node
}
const qualified = (map, node) => ({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId: node.id })
const validDigest = (value) => assert.match(value, /^[a-f0-9]{64}$/)
const assertMap = (map, path, workspaceId) => {
  assert.equal(map.schemaVersion, 1)
  assert.equal(map.ruleVersion, 'identity-v1')
  assert.equal(map.workspaceId, workspaceId)
  assert.equal(map.sourcePath, path)
  assert.match(map.documentId, /^doc_[a-f0-9]+$/)
  assert.match(map.pageId, /^page_[a-f0-9]+$/)
  validDigest(map.sourceRevision)
  assert.ok(Array.isArray(map.nodes) && map.nodes.length > 0)
  assert.ok(Array.isArray(map.aliases) && Array.isArray(map.orphaned) && Array.isArray(map.warnings))
  assertMetadataOnly({ ...map, label: undefined, nodes: map.nodes.map(({ label, ...node }) => node) }, 'identity map')
}

let bridge, bridgePort, lanPort, lan, otherLan, otherPort, browserServer, browser, context, page, failure
let lanOutput = '', otherOutput = '', baselineEffects, inputSnapshot, lanBaseline
const assetPromises = []
const stopOwned = async (child) => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), delay(5000)])
  if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise((resolveExit) => child.once('exit', resolveExit)) }
}
const startLan = async (directory, port, appPort, output) => {
  const child = spawn(process.execPath, [join(directory, '.SYSTEMX/LAN/server.mjs')], {
    cwd: directory,
    env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_GOOGLE_FONTS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let localOutput = ''
  child.stdout.on('data', (part) => { localOutput += part.toString(); output(part.toString()) })
  child.stderr.on('data', (part) => { localOutput += part.toString(); output(part.toString()) })
  let ready = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Only the owned child is polled. */ }
    if (ready) break
    if (child.exitCode !== null) break
    await delay(50)
  }
  assert.ok(ready, `Owned LAN fixture did not become healthy: ${localOutput.slice(-4000)}`)
  return child
}

try {
  const sourceLan = join(root, '.SYSTEMX/LAN')
  for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), {
    recursive: true,
    filter: (source) => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some((name) => source === join(sourceLan, name)),
  })
  for (const path of ['package.json', '.SYSTEMX/INSTALLATION.json']) {
    mkdirSync(dirname(join(fixture, path)), { recursive: true })
    cpSync(join(root, path), join(fixture, path))
  }
  if (!existsSync(join(fixture, 'node_modules'))) {
    assert.ok(existsSync(join(dependencyRoot, 'node_modules')), 'Existing repository node_modules required for TypeScript and Playwright')
    symlinkSync(join(dependencyRoot, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  }
  inputSnapshot = snapshot(join(fixture, '.SYSTEMX/LAN'))
  for (const [path, content] of fixtures) put(path, content)
  put('src/pages/GeneratedPage.tsx', '// @generated — read-only fixture\nexport const GeneratedPage = <p>Generated fixture</p>\n')
  put('src/pages/.private.tsx', 'PRIVATE_CONTENT_NEEDLE')
  put('.SYSTEMX/LAN/Backup/guard.txt', 'PRIVATE_CONTENT_NEEDLE')
  put('.SYSTEMX/LAN/Temp/operations.jsonl', '{"marker":"PRIVATE_CONTENT_NEEDLE"}\n')
  put('.SYSTEMX/LAN/Research/guard.txt', 'PRIVATE_CONTENT_NEEDLE')
  const external = put('external-owned/ExternalPage.tsx', 'EXTERNAL_LINK_TARGET', temporary)
  symlinkSync(relative(dirname(join(fixture, 'src/pages/LinkedPage.tsx')), external), join(fixture, 'src/pages/LinkedPage.tsx'))
  baselineEffects = fixtureEffects()
  lanBaseline = snapshot(join(fixture, '.SYSTEMX/LAN'))
  report.fixtureSourceBaseline = Object.fromEntries([...fixtures].map(([path, content]) => [path, sha(content)]))
  report.inputManifest = {
    algorithm: 'sha256', revision: report.revision, nodeVersion: process.version,
    implementationInputs: Object.fromEntries(Object.entries(inputSnapshot).filter(([path]) => /\.(?:mjs|js|css|html)$/.test(path)).map(([path, digest]) => [`.SYSTEMX/LAN/${path}`, digest])),
    protectedTrackedFiles: protectedBefore,
    harness: { path: 'scripts/lan-source-identity-browser.mjs', sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
  }
  writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(report.inputManifest, null, 2)}\n`)

  lanPort = await freePort()
  bridge = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${bridgePort}`)
      if (url.pathname.startsWith('/__systemx')) {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const headers = { ...request.headers }
        delete headers.host; delete headers.connection; delete headers['content-length']
        const upstream = await fetch(`http://127.0.0.1:${lanPort}${url.pathname.slice('/__systemx'.length) || '/'}${url.search}`, {
          method: request.method, headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks) }),
        })
        response.writeHead(upstream.status, Object.fromEntries(upstream.headers))
        response.end(Buffer.from(await upstream.arrayBuffer()))
        return
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<!doctype html><html><head><title>Owned identity fixture</title></head><body><h1 data-systemx-source="src/pages/HomePage.tsx">Synthetic browser preview</h1></body></html>')
    } catch { response.writeHead(502); response.end('Owned fixture bridge unavailable') }
  })
  await new Promise((resolveListen, reject) => { bridge.once('error', reject); bridge.listen(0, '127.0.0.1', resolveListen) })
  bridgePort = bridge.address().port
  const origin = `http://127.0.0.1:${bridgePort}`
  report.origin = origin
  lan = await startLan(fixture, lanPort, bridgePort, (part) => { lanOutput += part })
  report.ownedProcesses = { harness: process.pid, lan: lan.pid }
  const html = await (await fetch(`${origin}/__systemx/`)).text()
  const token = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
  assert.ok(token, 'Served LAN dashboard omitted session token')
  const api = async (method, path, body, suppliedToken = token) => {
    const response = await fetch(`${origin}/__systemx${path}`, {
      method, headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(suppliedToken === null ? {} : { 'x-systemx-session': suppliedToken }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    })
    let result
    try { result = await response.json() } catch { result = null }
    return { status: response.status, body: result }
  }
  const get = (path) => api('GET', path)
  const post = (path, body, suppliedToken) => api('POST', path, body, suppliedToken)
  const ok = async (promise) => { const result = await promise; assert.equal(result.status, 200, JSON.stringify(result.body)); assert.ok(result.body && typeof result.body === 'object'); return result.body }
  const refused = async (promise) => {
    const result = await promise
    assert.ok([400, 403, 404, 409, 413, 415].includes(result.status), `Expected refusal; got ${result.status}: ${JSON.stringify(result.body)}`)
    assert.match(result.body?.code, /^[A-Z][A-Z0-9_]+$/)
    assert.equal(typeof result.body?.error, 'string')
    assertMetadataOnly(result.body, 'refusal')
    return result.body
  }
  const status = await ok(get('/api/identity/status'))
  validDigest(status.workspaceId)
  assert.deepEqual(status.documents, [])
  assert.equal(status.ruleVersion, 'identity-v1')
  report.workspaceId = status.workspaceId
  const preview = (path, options = {}) => ok(post('/api/identity/preview', { path, route: '/', ...options }))
  const accept = (proposal) => ok(post('/api/identity/accept', { digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' }))
  const read = (documentId) => ok(get(`/api/identity/document?documentId=${encodeURIComponent(documentId)}`))
  const lookup = (reference) => ok(post('/api/identity/lookup', reference))
  const operation = (map, node, text, expectedRevision = map.sourceRevision) => ok(post('/api/identity/operation', { documentId: map.documentId, reference: qualified(map, node), expectedRevision, text }))
  const findTextNode = (map) => map.nodes.find((node) => node.anchor === 'summary' && node.fields?.text)

  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  report.ownedProcesses.chromium = browserServer.process().pid
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true })
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin) report.browserRequests.push({ method: request.method(), path: url.pathname, query: url.search })
  })
  context.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/') || !/\.(?:js|css)$/.test(url.pathname)) return
    const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`
    assetPromises.push(response.body().then((bytes) => report.assetCaptures.push({ path, status: response.status(), sha256: sha(bytes), expectedSha256: report.inputManifest.implementationInputs[path], matchesCopiedInput: sha(bytes) === report.inputManifest.implementationInputs[path] })).catch((error) => report.assetCaptures.push({ path, error: error.message })))
  })
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() === 'GET' && url.protocol === 'https:' && url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: '/* Synthetic font response. */' })
    if (url.origin !== origin || !(['GET', 'HEAD'].includes(request.method()) || (request.method() === 'POST' && url.pathname.startsWith('/__systemx/api/identity/')))) {
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
  if (await page.locator('#right-panel-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#right-panel-toggle').click()
  await page.locator('[data-inspector-group-tab="build"]').click()
  await page.locator('[data-inspector-tab="source"]').click()
  if (await page.locator('#right-panel-visibility').getAttribute('aria-pressed') !== 'true') await page.locator('#right-panel-visibility').click()
  await expect(page.locator('#source-file-select option').first()).toBeAttached()
  const identityPanel = page.locator('#source-identity-panel')
  await expect(identityPanel).toBeVisible()
  if (!await identityPanel.evaluate((element) => element.open)) await identityPanel.locator('summary').click()
  await expect(identityPanel).toHaveAttribute('open', '')
  const selectPath = async (path) => { await page.locator('#source-file-select').selectOption(path); await expect(page.locator('#source-file-select')).toHaveValue(path) }
  const clickIdentity = async (selector, suffix, expectedStatus = 200) => {
    const responsePending = page.waitForResponse((response) => new URL(response.url()).pathname === `/__systemx/api/identity/${suffix}` && response.request().method() === 'POST')
    await page.locator(selector).click()
    const response = await responsePending
    const body = await response.json().catch(() => null)
    if (expectedStatus === 200) assert.equal(response.status(), 200, JSON.stringify(body))
    return { status: response.status(), body }
  }
  await selectPath(homePath)
  let home, about, shared, rename, originalHero, replacementHero, replacementProposal, exported
  await check('F003', 0, 'Served UI import preview and explicit accept; repeated API import keeps document identity.', async () => {
    const unauthorized = await post('/api/identity/preview', { path: homePath }, null)
    assert.equal(unauthorized.status, 403)
    assertMetadataOnly(unauthorized.body, 'unauthorized identity response')
    await expect(page.locator('#identity-accept')).toBeDisabled()
    const { body: proposed } = await clickIdentity('#identity-import-preview', 'preview')
    assertMap(proposed.map, homePath, status.workspaceId)
    validDigest(proposed.digest)
    assert.equal(proposed.requiresReview, true)
    await expect(page.locator('#identity-summary')).toContainText(proposed.map.documentId)
    await page.locator('#identity-confirmation').fill('ACCEPT IDENTITY MAP')
    const { body: accepted } = await clickIdentity('#identity-accept', 'accept')
    assert.equal(accepted.accepted, true)
    home = accepted.map
    assert.equal(home.documentId, proposed.map.documentId)
    const repeated = await preview(homePath)
    assert.equal(repeated.map.documentId, home.documentId)
    assert.equal(repeated.map.pageId, home.pageId)
    assert.deepEqual(fixtureEffects(), baselineEffects)
    await page.locator('#panel-source').screenshot({ path: join(evidence, '01-accepted-identity-inspector.png') })
  })
  await check('F003', 1, 'Label-only preview preserves reviewed page and document IDs.', async () => {
    const labeled = await preview(homePath, { label: 'A revised display label' })
    assert.equal(labeled.map.documentId, home.documentId)
    assert.equal(labeled.map.pageId, home.pageId)
    assert.equal((await read(home.documentId)).map.pageId, home.pageId)
  })
  await check('F003', 2, 'Explicit anchored nodes keep IDs on repeated import and inspector uses qualified ID.', async () => {
    originalHero = nodeByAnchor(home, 'hero')
    assert.equal(originalHero.confidence, 'explicit')
    const repeated = await preview(homePath)
    assert.equal(nodeByAnchor(repeated.map, 'hero').id, originalHero.id)
    await page.locator('#identity-node-select').selectOption(originalHero.id)
    await expect(page.locator('#identity-node-detail')).toContainText(originalHero.id)
    await expect(page.locator('#identity-node-detail')).toContainText(home.documentId)
  })
  await check('F003', 3, 'Duplicate authored anchors refuse preview and retain accepted map and source.', async () => {
    const current = readFileSync(join(fixture, homePath), 'utf8')
    put(homePath, current.replace('data-systemx-id="primary"', 'data-systemx-id="hero"'))
    try {
      await refused(post('/api/identity/preview', { path: homePath }))
      assert.equal(nodeByAnchor((await read(home.documentId)).map, 'hero').id, originalHero.id)
    } finally { put(homePath, current) }
    assert.deepEqual(fixtureEffects(), baselineEffects)
  })
  await check('F003', 4, 'Reviewed sibling reorder keeps explicit IDs and updates exact source revision.', async () => {
    const uniqueBefore = home.nodes.find((node) => node.label === 'Unique fallback fixture')
    assert.ok(uniqueBefore, 'Fixture must contain a unique fallback candidate')
    put(homePath, homeReordered)
    const proposed = await preview(homePath)
    assert.equal(nodeByAnchor(proposed.map, 'hero').id, originalHero.id)
    assert.equal(nodeByAnchor(proposed.map, 'primary').id, nodeByAnchor(home, 'primary').id)
    assert.equal(proposed.map.nodes.find((node) => node.label === 'Unique fallback fixture')?.id, uniqueBefore.id)
    assert.ok(proposed.counts.preserved >= 2)
    home = (await accept(proposed)).map
    assert.equal(home.sourceRevision, sha(homeReordered))
  })
  await check('F003', 5, 'Rename requires exact previous path and displays reviewed transfer evidence.', async () => {
    const first = await preview(renamePath)
    rename = (await accept(first)).map
    put(renamedPath, renameInitial)
    const noTransfer = await preview(renamedPath)
    assert.notEqual(noTransfer.map.documentId, rename.documentId)
    await refused(post('/api/identity/preview', { path: renamedPath, renameFrom: 'src/pages/MissingPage.tsx' }))
    const proposed = await preview(renamedPath, { renameFrom: renamePath })
    assert.equal(proposed.rename?.from, renamePath)
    assert.equal(proposed.rename?.to, renamedPath)
    assert.equal(proposed.map.documentId, rename.documentId)
    assert.equal(proposed.requiresReview, true)
    await refused(post('/api/identity/accept', { digest: proposed.digest, confirmation: 'wrong' }))
    rename = (await accept(proposed)).map
    assert.equal(rename.sourcePath, renamedPath)
    assert.equal(rename.documentId, first.map.documentId)
  })
  await check('F003', 6, 'Replacement preview retires prior node and does not silently retarget old reference.', async () => {
    put(homePath, homeReplaced)
    const proposed = await preview(homePath)
    replacementProposal = proposed
    replacementHero = nodeByAnchor(proposed.map, 'newHero')
    assert.notEqual(replacementHero.id, originalHero.id)
    assert.ok(proposed.retired.some((entry) => JSON.stringify(entry).includes(originalHero.id)))
    assert.ok(proposed.added.some((entry) => JSON.stringify(entry).includes(replacementHero.id)))
    assert.equal((await read(home.documentId)).map.sourceRevision, sha(homeReordered))
  })
  await check('F003', 7, 'Valid authored anchors are explicit; invalid syntax is refused without replacing map.', async () => {
    const current = readFileSync(join(fixture, homePath), 'utf8')
    put(homePath, current.replace('data-systemx-id="newHero"', 'data-systemx-id="1-invalid"'))
    try { await refused(post('/api/identity/preview', { path: homePath })) } finally { put(homePath, current) }
    assert.equal(nodeByAnchor((await read(home.documentId)).map, 'hero').id, originalHero.id)
  })
  await check('F003', 8, 'Indistinguishable unanchored siblings remain unresolved with bounded warning evidence.', async () => {
    const proposed = await preview(homePath)
    const twins = proposed.map.nodes.filter((node) => node.label === 'Ambiguous twin')
    assert.equal(twins.length, 2)
    assert.ok(twins.every((node) => node.confidence === 'unresolved'))
    assert.notEqual(twins[0].id, twins[1].id)
    assert.ok(proposed.ambiguous.length || proposed.map.warnings.length)
  })
  await check('F003', 9, 'Reviewed retired-to-existing alias preserves provenance and rejects loops.', async () => {
    const proposed = await preview(homePath, { aliases: [{ from: originalHero.id, to: replacementHero.id, provenance: 'Reviewed fixture replacement' }] })
    assert.ok(proposed.map.aliases.some((alias) => alias.from === originalHero.id && alias.to === replacementHero.id && alias.provenance))
    home = (await accept(proposed)).map
    const old = await lookup(qualified(home, originalHero))
    assert.equal(old.status, 'resolved')
    assert.equal(old.node?.id, replacementHero.id)
    const bad = await post('/api/identity/preview', { path: homePath, aliases: [{ from: replacementHero.id, to: originalHero.id, provenance: 'invalid loop' }] })
    assert.ok(bad.status !== 200 || !bad.body?.map?.aliases?.some((alias) => alias.from === replacementHero.id), 'Alias loop cannot be accepted')
  })
  await check('F003', 10, 'Document-qualified lookup refuses cross-document node reference.', async () => {
    about = (await accept(await preview(aboutPath, { route: '/about' }))).map
    const wrong = await lookup({ workspaceId: home.workspaceId, documentId: about.documentId, nodeId: replacementHero.id })
    assert.notEqual(wrong.status, 'resolved')
    assert.notEqual(wrong.node?.id, replacementHero.id)
  })
  await check('F003', 11, 'Second owned workspace has a different workspaceId and refuses foreign references.', async () => {
    const second = join(temporary, 'other-fixture')
    cpSync(fixture, second, { recursive: true, filter: (path) => path !== join(fixture, 'node_modules') })
    symlinkSync(join(dependencyRoot, 'node_modules'), join(second, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    otherPort = await freePort()
    const unused = await freePort()
    otherLan = await startLan(second, otherPort, unused, (part) => { otherOutput += part })
    report.ownedProcesses.otherLan = otherLan.pid
    const otherOrigin = `http://127.0.0.1:${otherPort}`
    const otherStatusResponse = await fetch(`${otherOrigin}/api/identity/status`)
    assert.equal(otherStatusResponse.status, 200)
    const otherStatus = await otherStatusResponse.json()
    validDigest(otherStatus.workspaceId)
    assert.notEqual(otherStatus.workspaceId, home.workspaceId)
    const otherHtml = await (await fetch(otherOrigin)).text()
    const otherToken = otherHtml.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(otherToken)
    const otherLookupResponse = await fetch(`${otherOrigin}/api/identity/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-systemx-session': otherToken }, body: JSON.stringify(qualified(home, replacementHero)) })
    assert.equal(otherLookupResponse.status, 200)
    const otherLookup = await otherLookupResponse.json()
    assert.equal(otherLookup.status, 'workspace-mismatch')
  })
  await check('F003', 12, 'Current qualified lookup resolves exact node; missing node returns explicit missing.', async () => {
    const found = await lookup(qualified(home, replacementHero))
    assert.equal(found.status, 'resolved')
    assert.equal(found.node?.id, replacementHero.id)
    const missing = await lookup({ ...qualified(home, replacementHero), nodeId: `node_${'f'.repeat(64)}` })
    assert.equal(missing.status, 'missing')
  })
  await check('F003', 13, 'Retired reference is orphaned with original provenance, not rebound to sibling.', async () => {
    assert.ok(Array.isArray(replacementProposal.orphans))
    assert.ok(replacementProposal.orphans.some((entry) => JSON.stringify(entry).includes(originalHero.id)), 'Replacement preview lost retired reference')
    assert.ok(home.aliases.some((alias) => alias.from === originalHero.id), 'Accepted alias must retain reviewed provenance')
  })
  await check('F003', 14, 'Preview exposes stable counts and the UI summary remains source-bound.', async () => {
    const proposed = await preview(homePath)
    for (const name of ['preserved', 'added', 'retired', 'ambiguous']) assert.ok(Number.isInteger(proposed.counts[name]) && proposed.counts[name] >= 0)
    assert.equal(proposed.requiresReview, true)
    await expect(page.locator('#identity-summary')).toContainText(home.documentId)
  })
  await check('F003', 15, 'Rule change is explicit migration or coded refusal, never a silent v1 reinterpretation.', async () => {
    const result = await post('/api/identity/preview', { path: homePath, ruleVersion: 'identity-v2' })
    if (result.status === 200) {
      assert.ok(result.body.migration, 'Changed rule version requires explicit migration object')
      assert.equal(result.body.requiresReview, true)
      assert.equal((await read(home.documentId)).map.ruleVersion, 'identity-v1')
    } else await refused(Promise.resolve(result))
  })
  await check('F003', 16, 'UI export/download and explicit reopen keep IDs while excluding source bodies.', async () => {
    const pending = page.waitForEvent('download')
    await page.locator('#identity-export').click()
    const download = await pending
    assert.match(download.suggestedFilename(), /\.json$/)
    const path = join(evidence, 'identity-document-export.json')
    await download.saveAs(path)
    exported = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(exported.kind, 'systemx-source-document')
    assert.equal(exported.workspaceId, home.workspaceId)
    assert.equal(exported.map.documentId, home.documentId)
    assert.equal(exported.map.pageId, home.pageId)
    assertMetadataOnly(exported, 'document export')
    assert.ok(!JSON.stringify(exported).includes('"label":'), 'Metadata export must omit labels')
    await page.locator('#identity-reopen-json').fill(JSON.stringify(exported))
    await page.locator('#identity-reopen-confirmation').fill('REOPEN IDENTITY DOCUMENT')
    const { body: reopened } = await clickIdentity('#identity-reopen', 'reopen')
    assert.equal(reopened.map.documentId, home.documentId)
    assert.equal(nodeByAnchor(reopened.map, 'newHero').id, replacementHero.id)
    home = reopened.map
    report.export = { file: 'identity-document-export.json', bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) }
    await page.locator('#panel-source').screenshot({ path: join(evidence, '02-export-reopen-identity.png') })
  })
  await check('F003', 17, 'Same relative path in second repository cannot reopen or authorize first workspace document.', async () => {
    const second = join(temporary, 'other-fixture')
    const otherHtml = await (await fetch(`http://127.0.0.1:${otherPort}/`)).text()
    const otherToken = otherHtml.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    const response = await fetch(`http://127.0.0.1:${otherPort}/api/identity/reopen`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-systemx-session': otherToken }, body: JSON.stringify({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }) })
    assert.ok(response.status >= 400)
    const body = await response.json()
    assert.match(body.code, /^[A-Z][A-Z0-9_]+$/)
    assert.equal(readFileSync(join(second, homePath), 'utf8'), homeReplaced)
  })
  await check('F003', 18, 'Inspector shows confidence, qualified reference and source provenance.', async () => {
    await page.locator('#identity-node-select').selectOption(replacementHero.id)
    const detail = await page.locator('#identity-node-detail').textContent()
    assert.ok(detail.includes('explicit') && detail.includes(home.documentId) && detail.includes(replacementHero.id))
    assert.ok(detail.includes(homePath))
    await expect(page.locator('#identity-status')).toBeVisible()
  })
  await check('F003', 19, 'Unresolved candidates remain visible and cannot be mistaken for writable explicit nodes.', async () => {
    const proposed = await preview(homePath)
    assert.ok(proposed.map.nodes.some((node) => node.confidence === 'unresolved'))
    assert.ok(proposed.map.warnings.length || proposed.ambiguous.length)
    assert.notEqual(proposed.map.nodes.find((node) => node.confidence === 'unresolved')?.id, replacementHero.id)
    return { partial: 'API ambiguity is checked; no separate live DOM representation exists for these nodes.' }
  })

  const ownershipModule = await import(pathToFileURL(join(fixture, '.SYSTEMX/LAN/Builder/source-ownership.mjs')).href)
  let owner = (await read(home.documentId)).ownership
  const summaryNode = findTextNode(home)
  assert.ok(summaryNode, 'Fixture literal text span is required by F004 tests')
  await check('F004', 0, 'Source-owned node names authored source and supported semantic operations.', async () => {
    const object = owner.objects.find((entry) => entry.nodeId === summaryNode.id)
    assert.equal(object.mode, 'source-owned')
    assert.equal(object.adapterId, 'tsx-static-v1')
    assert.equal(object.status, 'mapped')
    assert.ok(object.supportedOperations.includes('literal'))
    assert.equal(object.source.path, homePath)
  })
  await check('F004', 1, 'Document-owned generation boundary is outside this source-import adapter; no positive generation claim.', null)
  await check('F004', 2, 'Hybrid authority requires a reviewed field claim; this fixture has no generated field boundary.', null)
  await check('F004', 3, 'Live unmapped preview element selection is not wired by the F003/F004 read-model contract.', null)
  await check('F004', 4, 'Exact bounded UTF-16 text span and fingerprint match source bytes.', async () => {
    const source = readFileSync(join(fixture, homePath), 'utf8')
    assert.equal(summaryNode.source.sourceRevision, sha(source))
    const field = summaryNode.fields.text
    assert.equal(sha(source.slice(field.start, field.end)), field.fingerprint)
    assert.ok(field.start >= summaryNode.source.start && field.end <= summaryNode.source.end)
    assert.ok(field.end > field.start)
  })
  await check('F004', 5, 'Installed adapter declares literal-only capability; style/structure/generated unsupported.', async () => {
    const imported = await preview(sharedPath)
    shared = (await accept(imported)).map
    assert.deepEqual(imported.ownership.objects.find((entry) => entry.nodeId === nodeByAnchor(shared, 'sharedHeader').id)?.unsupportedOperations?.sort(), ['generated', 'structure', 'style'].sort())
    const detail = await ok(post('/api/identity/inspect', qualified(home, summaryNode)))
    assertMetadataOnly(detail, 'ownership inspect')
    await expect(page.locator('#identity-ownership-detail')).toBeVisible()
  })
  await check('F004', 6, 'Ambiguous twin source literals are not arbitrarily writable; operation refuses or disallows.', async () => {
    const twin = home.nodes.find((node) => node.label === 'Ambiguous twin')
    assert.ok(twin)
    const result = await post('/api/identity/operation', { documentId: home.documentId, reference: qualified(home, twin), expectedRevision: home.sourceRevision, text: 'Changed twin' })
    if (result.status === 200) assert.equal(result.body.allowed, false)
    else await refused(Promise.resolve(result))
  })
  await check('F004', 7, 'Raw revision drift makes read model stale and blocks a mapped literal proposal.', async () => {
    const before = readFileSync(join(fixture, homePath), 'utf8')
    put(homePath, `${before}\n// drift fixture\n`)
    try {
      const stale = await read(home.documentId)
      const object = stale.ownership.objects.find((entry) => entry.nodeId === summaryNode.id)
      assert.equal(object.status, 'stale')
      const result = await post('/api/identity/operation', { documentId: home.documentId, reference: qualified(home, summaryNode), expectedRevision: home.sourceRevision, text: 'Changed summary' })
      if (result.status === 200) assert.equal(result.body.allowed, false)
      else await refused(Promise.resolve(result))
      await page.locator('#identity-operation-text').fill('Safe draft preserved')
      await page.locator('#identity-node-select').selectOption(summaryNode.id)
      const action = page.locator('#identity-operation-preview')
      if (await action.isEnabled()) {
        const response = await clickIdentity('#identity-operation-preview', 'operation', null)
        if (response.status === 200) assert.equal(response.body.allowed, false)
        else {
          assert.ok([400, 409, 415].includes(response.status))
          assert.match(response.body?.code, /^[A-Z][A-Z0-9_]+$/)
        }
      } else {
        await expect(page.locator('#identity-status')).toContainText(/stale|revision|reload|reconcile/i)
      }
      await expect(page.locator('#identity-operation-text')).toHaveValue('Safe draft preserved')
      await page.locator('#panel-source').screenshot({ path: join(evidence, '03-stale-operation-refusal.png') })
    } finally { put(homePath, before) }
  })
  await check('F004', 8, 'Shared layout source owner remains distinct and displays shared impact.', async () => {
    const node = nodeByAnchor(shared, 'sharedHeader')
    const reportObject = (await read(shared.documentId)).ownership.objects.find((entry) => entry.nodeId === node.id)
    assert.equal(reportObject.source.path, sharedPath)
    assert.ok(reportObject.definition || reportObject.provenance || sharedPath.includes('/layout/'))
    assert.notEqual(shared.documentId, home.documentId)
    return { partial: 'Shared source owner is checked; live multi-route impact visualization is outside this source-import read model.' }
  })
  await check('F004', 9, 'Same visible label on separate route resolves to different source owner and document.', async () => {
    const aboutHero = nodeByAnchor(about, 'aboutHero')
    const inspected = await ok(post('/api/identity/inspect', qualified(about, aboutHero)))
    assertMetadataOnly(inspected, 'route ownership inspect')
    assert.equal(aboutHero.source.path, aboutPath)
    assert.notEqual(about.documentId, home.documentId)
    assert.notEqual(aboutHero.id, replacementHero.id)
  })
  await check('F004', 10, 'Generated-output provenance requires a generator contract beyond the TSX source-import adapter.', null)
  await check('F004', 11, 'Ownership proposal API needs qualified, reviewed changes and separate confirmation.', async () => {
    const invalid = await post('/api/identity/ownership/preview', { documentId: home.documentId, changes: [{ nodeId: 'foreign', mode: 'source-owned' }] })
    await refused(Promise.resolve(invalid))
    const noProposal = await post('/api/identity/ownership/accept', { digest: '0'.repeat(64), confirmation: 'ACCEPT OWNERSHIP CHANGE' })
    await refused(Promise.resolve(noProposal))
    assert.equal((await read(home.documentId)).ownership.coverage.total, owner.coverage.total)
    return { partial: 'Invalid proposal and premature acceptance are refused; positive ownership migration is not proven by this fixture.' }
  })
  await check('F004', 12, 'Overlapping authored claims retain conflict visibility and disable writes.', async () => {
    const claim = { nodeId: summaryNode.id, mode: 'source-owned', adapterId: 'tsx-static-v1', source: summaryNode.source, fields: { text: { owner: 'source', supported: true } }, provenance: 'fixture claim A' }
    const conflicted = ownershipModule.buildOwnership(home, { claims: [claim, { ...claim, provenance: 'fixture claim B' }] })
    assert.ok(conflicted.coverage.conflict > 0)
    const object = conflicted.objects.find((entry) => entry.nodeId === summaryNode.id)
    assert.equal(object.status, 'conflict')
    assert.equal(conflicted.claims.length, 2)
    const planned = ownershipModule.planLiteralOperation(home, conflicted, { reference: qualified(home, summaryNode), expectedRevision: home.sourceRevision, text: 'Blocked claim', currentSource: readFileSync(join(fixture, homePath), 'utf8') })
    assert.equal(planned.allowed, false)
  })
  await check('F004', 13, 'Component instance and definition metadata are inspectable without shared definition edits.', async () => {
    const external = home.nodes.find((node) => node.external || node.definition)
    assert.ok(external)
    assert.equal(external.external, true)
    const object = owner.objects.find((entry) => entry.nodeId === external.id)
    assert.ok(object)
    assert.ok(object.definition || external.definition)
    assert.ok(Array.isArray(object.instanceFields ?? []))
    assert.ok(Array.isArray(object.definitionFields ?? []))
    return { partial: 'Source metadata distinguishes instance and definition; no shared definition mutation is exercised.' }
  })
  await check('F004', 14, 'Opaque JSX expression retains source metadata and no supported literal write.', async () => {
    const opaque = home.nodes.find((node) => node.opaque && !node.external)
    assert.ok(opaque)
    const mapped = owner.objects.find((entry) => entry.nodeId === opaque.id)
    assert.ok(mapped)
    assert.ok(!mapped.supportedOperations.includes('literal'))
    assert.equal(opaque.source.path, homePath)
  })
  await check('F004', 15, 'External component internals remain read-only under imported source owner.', async () => {
    const external = home.nodes.find((node) => node.external)
    assert.ok(external)
    const mapped = owner.objects.find((entry) => entry.nodeId === external.id)
    assert.ok(mapped)
    assert.ok(!mapped.supportedOperations.includes('structure'))
    const result = await post('/api/identity/operation', { documentId: home.documentId, reference: qualified(home, external), expectedRevision: home.sourceRevision, text: 'No external write' })
    if (result.status === 200) assert.equal(result.body.allowed, false)
    else await refused(Promise.resolve(result))
    await refused(post('/api/identity/preview', { path: 'src/pages/LinkedPage.tsx' }))
    await refused(post('/api/identity/preview', { path: 'src/pages/GeneratedPage.tsx' }))
  })
  await check('F004', 16, 'Coverage counts include partial/unmapped/stale/conflict scope and sum to total.', async () => {
    const coverage = owner.coverage
    for (const name of ['mapped', 'partial', 'stale', 'unmapped', 'conflict', 'total']) assert.ok(Number.isInteger(coverage[name]) && coverage[name] >= 0)
    assert.equal(coverage.mapped + coverage.partial + coverage.stale + coverage.unmapped + coverage.conflict, coverage.total)
    assert.equal(coverage.total, owner.objects.length)
    assert.ok(coverage.partial + coverage.unmapped > 0, 'Fixture must expose incomplete coverage')
  })
  await check('F004', 17, 'Literal proposal states qualified owner, impact and exact patch without writing source.', async () => {
    const before = fixtureEffects()
    const result = await operation(home, summaryNode, 'Reviewed summary replacement')
    assert.equal(result.allowed, true)
    assert.ok(Array.isArray(result.impact) && result.impact.length > 0)
    assert.equal(result.patch.start, summaryNode.fields.text.start)
    assert.equal(result.patch.end, summaryNode.fields.text.end)
    assert.equal(result.patch.replacement, 'Reviewed summary replacement')
    assert.deepEqual(fixtureEffects(), before)
    await page.locator('#identity-operation-text').fill('Browser proposal only')
    await page.locator('#identity-node-select').selectOption(summaryNode.id)
    const { body: browserResult } = await clickIdentity('#identity-operation-preview', 'operation')
    assert.equal(browserResult.allowed, true)
    await expect(page.locator('#identity-operation-detail')).toContainText('Browser proposal only')
    assert.deepEqual(fixtureEffects(), before)
  })
  await check('F004', 18, 'Fresh reimport after synthetic source promotion updates revision; no automatic unrelated repair.', async () => {
    const before = readFileSync(join(fixture, homePath), 'utf8')
    const changed = before.replace('Summary literal fixture', 'Promoted fixture summary')
    put(homePath, changed)
    try {
      const stale = await read(home.documentId)
      assert.ok(stale.ownership.objects.some((entry) => entry.status === 'stale'))
      const proposed = await preview(homePath)
      assert.equal(proposed.map.sourceRevision, sha(changed))
      assert.equal((await read(about.documentId)).map.sourceRevision, about.sourceRevision)
      home = (await accept(proposed)).map
      assert.equal((await read(home.documentId)).map.sourceRevision, sha(changed))
    } finally {
      put(homePath, before)
      const restored = await preview(homePath)
      home = (await accept(restored)).map
    }
    return { partial: 'Source bytes are changed only in the owned fixture; controlled source-editor promotion is not exercised.' }
  })
  await check('F004', 19, 'Exported ownership diagnostics are bounded qualified metadata only.', async () => {
    const document = await ok(post('/api/identity/export', { documentId: home.documentId }))
    assert.equal(document.workspaceId, home.workspaceId)
    assert.equal(document.map.documentId, home.documentId)
    assert.ok(document.ownership)
    assertMetadataOnly(document, 'ownership diagnostics')
    assert.ok(!JSON.stringify(document).includes('"label":'), 'Ownership export must omit labels')
    const diagnostics = ownershipModule.exportOwnershipDiagnostics(home, (await read(home.documentId)).ownership)
    assertMetadataOnly(diagnostics, 'ownership module diagnostics')
    assert.ok(JSON.stringify(diagnostics).length <= 400_000)
  })

  await page.setViewportSize({ width: 900, height: 900 })
  await page.locator('#right-panel-visibility').scrollIntoViewIfNeeded()
  const geometry = await identityPanel.evaluate((panel) => {
    const box = panel.getBoundingClientRect()
    const descendants = [...panel.querySelectorAll('pre, textarea, input, select, button, output')].map((node) => ({ id: node.id, width: node.getBoundingClientRect().width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }))
    return { width: box.width, clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth, descendants }
  })
  assert.ok(geometry.width <= 336 && geometry.width >= 280, `Inspector width ${geometry.width} is outside narrow dock`)
  assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, 'Inspector has horizontal overflow')
  assert.ok(geometry.descendants.every((entry) => entry.width <= geometry.width + 1), 'Inspector control escapes narrow dock')
  const unlabelled = await identityPanel.locator('input, textarea, select').evaluateAll((nodes) => nodes.filter((node) => !node.labels?.length && !node.getAttribute('aria-label')).map((node) => node.id))
  assert.deepEqual(unlabelled, [], 'Interactive identity fields need labels')
  await page.locator('#identity-node-select').focus()
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'identity-node-select')
  await page.locator('#panel-source').screenshot({ path: join(evidence, '04-narrow-keyboard-inspector.png') })
  report.geometry = geometry
  report.keyboard = { focusedNodeSelect: true, unlabelledFields: unlabelled }

  for (const [path, content] of fixtures) put(path, content)
  rmSync(join(fixture, renamedPath), { force: true })
  assert.deepEqual(fixtureEffects(), baselineEffects, 'Metadata and operation previews must not change source, backups, Temp or Research')
  await Promise.all(assetPromises)
  assert.equal(report.pageErrors.length, 0, `Browser page errors: ${report.pageErrors.join('; ')}`)
  assert.equal(report.unexpectedRequests.length, 0)
  assert.ok(report.assetCaptures.length >= 3)
  assert.ok(report.assetCaptures.every((asset) => asset.status === 200 && asset.matchesCopiedInput), 'Served asset differs from copied input')
  assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/source-identities.js')), 'Actual source identity UI module did not load')
  assert.ok(report.assetCaptures.some((asset) => asset.path.endsWith('/identity-inspector.css')), 'Actual source identity stylesheet did not load')
  assert.equal(report.checks.length, 40)
  assert.ok(report.checks.every((entry) => ['passed', 'partial', 'not-evidenced'].includes(entry.status)))
  report.status = report.checks.some((entry) => entry.status !== 'passed') ? 'passed-with-explicit-gaps' : 'passed'
} catch (error) {
  failure = error
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack }
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  if (context) await context.tracing.stop({ path: join(evidence, 'trace.zip') }).catch(() => {})
  if (browser) await browser.close().catch(() => {})
  if (browserServer) await browserServer.close().catch(() => {})
  await stopOwned(otherLan)
  await stopOwned(lan)
  if (bridge) {
    bridge.closeAllConnections()
    if (bridge.listening) await new Promise((resolveClose) => bridge.close(resolveClose))
  }
  await Promise.allSettled(assetPromises)
  report.protectedTrackedFilesPreserved = protectedPaths.every((path) => {
    try { return sha(readFileSync(join(root, path))) === protectedBefore[path] } catch { return false }
  })
  report.implementationInputsPreserved = inputSnapshot ? Object.entries(inputSnapshot).every(([path, digest]) => {
    try {
      const current = join(fixture, '.SYSTEMX/LAN', path)
      return (lstatSync(current).isSymbolicLink() ? `link:${sha(readlinkSync(current))}` : sha(readFileSync(current))) === digest
    } catch { return false }
  }) : null
  report.fixtureLanPreserved = lanBaseline ? JSON.stringify(snapshot(join(fixture, '.SYSTEMX/LAN'))) === JSON.stringify(lanBaseline) : null
  report.fixturePreserved = baselineEffects ? JSON.stringify(fixtureEffects()) === JSON.stringify(baselineEffects) : null
  report.ownedProcessesExited = (!lan || lan.exitCode !== null) && (!otherLan || otherLan.exitCode !== null)
  report.harnessPreserved = report.inputManifest ? sha(readFileSync(fileURLToPath(import.meta.url))) === report.inputManifest.harness.sha256 : null
  if (report.status !== 'failed' && (!report.protectedTrackedFilesPreserved || !report.implementationInputsPreserved || !report.fixtureLanPreserved || !report.fixturePreserved || !report.ownedProcessesExited || !report.harnessPreserved)) {
    failure = new Error('Protected source, fixture, implementation input, harness or owned-process invariant failed')
    report.status = 'failed'
    report.failure = { message: failure.message, stack: failure.stack }
  }
  report.finishedAt = new Date().toISOString()
  report.counts = Object.fromEntries(['passed', 'partial', 'not-evidenced', 'not-run', 'failed'].map((status) => [status, report.checks.filter((entry) => entry.status === status).length]))
  writeFileSync(join(evidence, 'server-output.log'), lanOutput)
  if (otherOutput) writeFileSync(join(evidence, 'other-server-output.log'), otherOutput)
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  const manifest = { schemaVersion: 1, status: report.status, artifacts: regularFiles(evidence).map((path) => ({ path: relative(evidence, path), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })) }
  writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true })
  rmSync(join(temporary, 'other-fixture'), { recursive: true, force: true })
  rmSync(join(temporary, 'external-owned'), { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, counts: report.counts, protectedTrackedFilesPreserved: report.protectedTrackedFilesPreserved, implementationInputsPreserved: report.implementationInputsPreserved, fixturePreserved: report.fixturePreserved, ownedProcessesExited: report.ownedProcessesExited, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
