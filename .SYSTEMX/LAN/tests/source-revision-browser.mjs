#!/usr/bin/env node
/** Real source-editor controls, with writes confined to a disposable owned copy. */
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createServer as createPortProbe } from 'node:net'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect as browserExpect } from '@playwright/test'

const expect = browserExpect.configure({ timeout: 15000 })
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const temporary = mkdtempSync(join(tmpdir(), 'webappx-source-revision-browser-'))
const fixture = join(temporary, 'fixture')
const evidenceRoot = process.env.SYSTEMX_SOURCE_REVISION_EVIDENCE_DIR ? resolve(process.env.SYSTEMX_SOURCE_REVISION_EVIDENCE_DIR) : temporary
mkdirSync(evidenceRoot, { recursive: true })
const evidence = mkdtempSync(join(evidenceRoot, 'source-revision-run-'))
mkdirSync(evidence, { recursive: true })
const sha = (value) => createHash('sha256').update(value).digest('hex')
const protectedFiles = execFileSync('git', ['ls-files', '-z', '--', 'src', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/.systemx/releases'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const original = Object.fromEntries(protectedFiles.map((path) => [path, sha(readFileSync(join(root, path)))]))
for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), {
  recursive: true,
  filter: (source) => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some((name) => source === join(root, '.SYSTEMX/LAN', name)),
})
for (const name of ['package.json', '.SYSTEMX/INSTALLATION.json']) {
  mkdirSync(dirname(join(fixture, name)), { recursive: true })
  cpSync(join(root, name), join(fixture, name))
}
const sourcePath = 'src/pages/HomePage.tsx'
const sourceFile = join(fixture, sourcePath)
const secondPath = 'src/pages/AboutPage.tsx', secondFile = join(fixture, secondPath)
const initial = 'export function HomePage() { return <h1>Fixture original</h1> }\n'
writeFileSync(sourceFile, initial)
const secondInitial = 'export function AboutPage() { return <h1>About fixture original</h1> }\n'
writeFileSync(secondFile, secondInitial)
const stylesheetPath = 'src/index.css', stylesheetFile = join(fixture, stylesheetPath)
const stylesheetInitial = '@import "tailwindcss";\n/* Owned stylesheet fixture — café 🌈 */\n:root { --wtl-font-family: "Fixture Sans", system-ui; }\nbody { font-family: var(--wtl-font-family); }\n'
writeFileSync(stylesheetFile, stylesheetInitial)
const filesBelow = (directory) => !existsSync(directory) ? [] : readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? filesBelow(path) : [path]
}).sort()
const effects = () => ({
  source: existsSync(sourceFile) ? readFileSync(sourceFile, 'utf8') : null,
  secondSource: existsSync(secondFile) ? readFileSync(secondFile, 'utf8') : null,
  stylesheet: existsSync(stylesheetFile) ? readFileSync(stylesheetFile, 'utf8') : null,
  backups: filesBelow(join(fixture, '.SYSTEMX/LAN/Backup')).map((path) => [relative(fixture, path), sha(readFileSync(path))]),
  log: existsSync(join(fixture, '.SYSTEMX/LAN/Temp/operations.jsonl')) ? readFileSync(join(fixture, '.SYSTEMX/LAN/Temp/operations.jsonl'), 'utf8') : null,
  temporaryFiles: filesBelow(join(fixture, 'src')).filter((path) => path.endsWith('.tmp')).map((path) => relative(fixture, path)),
})
const freePort = () => new Promise((resolvePort, reject) => {
  const probe = createPortProbe()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close((error) => error ? reject(error) : resolvePort(port)) })
})
const port = await freePort()
let appPort, server, browser, browserServer, context, page, failure, releasePendingResponse
let serverOutput = ''
const checks = [], pageErrors = [], posts = [], fontPosts = [], sourceReads = [], unexpectedRequests = [], syntheticFontRequests = []
const loadedBrowserAssets = [], browserAssetCaptures = []
const app = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${appPort}`)
    if (url.pathname.startsWith('/__systemx')) {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const headers = { ...request.headers }; delete headers.host; delete headers.connection; delete headers['content-length']
      const upstream = await fetch(`http://127.0.0.1:${port}${url.pathname.slice('/__systemx'.length) || '/'}${url.search}`, {
        method: request.method, headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks) }),
      })
      response.writeHead(upstream.status, Object.fromEntries(upstream.headers))
      response.end(Buffer.from(await upstream.arrayBuffer()))
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html><head><title>Owned source guard fixture</title></head><body><h1 data-systemx-source="src/pages/HomePage.tsx">Fixture original</h1><p>Owned source guard browser document.</p></body></html>')
  } catch { response.writeHead(502); response.end('Owned fixture bridge unavailable') }
})
const report = { schemaVersion: 1, kind: 'isolated-source-revision-browser-evidence', checks, pageErrors, posts, fontPosts, sourceReads, unexpectedRequests, syntheticFontRequests, loadedBrowserAssets,
  startedAt: new Date().toISOString(),
  boundaries: 'Source writes and external changes target only an owned temporary copy. Fresh Chromium context; no user browser/storage, provider, real app source, or existing listener is changed.' }
if (process.env.SYSTEMX_SOURCE_REVISION_ATTEMPT_NOTE) report.attemptNote = process.env.SYSTEMX_SOURCE_REVISION_ATTEMPT_NOTE
const inputManifest = {
  schemaVersion: 1,
  algorithm: 'sha256',
  gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  nodeVersion: process.version,
  files: [...filesBelow(join(fixture, '.SYSTEMX/LAN')).filter((path) => /\.(?:mjs|js|html|css)$/.test(path) || path === join(fixture, '.SYSTEMX/LAN/Builder/contracts/font-catalog.json')).map((path) => ({ path: relative(fixture, path).replaceAll('\\', '/'), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })),
    ...filesBelow(join(root, '.SYSTEMX/LAN/tests')).filter((path) => /\.mjs$/.test(path)).map((path) => ({ path: relative(root, path).replaceAll('\\', '/'), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) }))],
  protectedSourceAndSeeds: original,
  syntheticSource: { path: sourcePath, sha256: sha(initial), secondPath, secondSha256: sha(secondInitial), stylesheetPath, stylesheetSha256: sha(stylesheetInitial) },
}
writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(inputManifest, null, 2)}\n`)
try {
  await new Promise((resolveListen, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolveListen) })
  appPort = app.address().port
  const origin = `http://127.0.0.1:${appPort}`
  report.origin = origin
  server = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], {
    cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_GOOGLE_FONTS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  report.ownedProcesses = { harness: process.pid, lan: server.pid }
  writeFileSync(join(evidence, 'execution.json'), `${JSON.stringify({ ...report.ownedProcesses, fixture, origin }, null, 2)}\n`)
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })
  let healthy = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { healthy = (await fetch(`${origin}/__systemx/api/health`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* Wait only for the owned child. */ }
    if (healthy) break
    if (server.exitCode !== null) throw new Error(`Owned LAN fixture exited: ${serverOutput}`)
    await delay(50)
  }
  assert.ok(healthy, serverOutput)
  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  report.ownedProcesses.chromium = browserServer.process().pid
  writeFileSync(join(evidence, 'execution.json'), `${JSON.stringify({ ...report.ownedProcesses, fixture, origin }, null, 2)}\n`)
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin && request.method() === 'GET' && url.pathname.endsWith('/api/builder/source')) sourceReads.push({ path: url.searchParams.get('path') })
  })
  context.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/') || !/\.(?:js|css)$/.test(url.pathname)) return
    const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`
    const expected = inputManifest.files.find((item) => item.path === path)?.sha256
    browserAssetCaptures.push(response.body().then((bytes) => loadedBrowserAssets.push({ path, status: response.status(), sha256: sha(bytes), expectedSha256: expected, matchesCopiedInput: expected === sha(bytes) })).catch((error) => loadedBrowserAssets.push({ path, error: error.message })))
  })
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() === 'GET' && url.protocol === 'https:' && url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') {
      syntheticFontRequests.push({ host: url.hostname, path: url.pathname, disposition: 'synthetic-empty-stylesheet' })
      return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: '/* Isolated font CSS fixture; no external font resources. */' })
    }
    if (request.method() === 'GET' && url.protocol === 'https:' && url.hostname === 'fonts.gstatic.com' && request.resourceType() === 'font') {
      syntheticFontRequests.push({ host: url.hostname, path: url.pathname, disposition: 'expected-font-resource-abort' })
      return route.abort('blockedbyclient')
    }
    if (url.origin !== origin || !['GET', 'HEAD', 'POST'].includes(request.method()) || request.method() === 'POST' && !['/__systemx/api/builder/source', '/__systemx/api/builder/font'].includes(url.pathname)) {
      unexpectedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname })
      return route.abort('blockedbyclient')
    }
    if (request.method() === 'POST') (url.pathname.endsWith('/font') ? fontPosts : posts).push(request.postDataJSON())
    await route.continue()
  })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const waitForResponse = (predicate) => {
    const pending = page.waitForResponse(predicate)
    // Locator failures must reach finally rather than an unhandled wait rejection.
    void pending.catch(() => {})
    return pending
  }
  const assertInspectorGeometry = async (checkpoint, selectors, wrappedSelectors) => {
    const geometry = await page.locator('.right-panel').evaluate((dock, config) => {
      const document = dock.ownerDocument
      const bounds = (element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }
      }
      const nodes = config.selectors.flatMap((selector) => [...dock.querySelectorAll(selector)].map((element, index) => ({ selector, index, ...bounds(element) })))
      const wrapped = config.wrappedSelectors.flatMap((selector) => [...dock.querySelectorAll(selector)].map((element, index) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return { selector, index, ...bounds(element), textLines: [...range.getClientRects()].filter((box) => box.width > 0).map((box) => ({ left: box.left, right: box.right })) }
      }))
      return { checkpoint: config.checkpoint, dock: bounds(dock), declaredWidth: Number(document.querySelector('#right-panel-resizer')?.getAttribute('aria-valuenow')), nodes, wrapped }
    }, { checkpoint, selectors, wrappedSelectors })
    report.visibleGeometry ??= []
    report.visibleGeometry.push(geometry)
    assert.equal(geometry.declaredWidth, 336, `${checkpoint}: check the normal336px inspector, without widening it for evidence`)
    assert.ok(Math.abs(geometry.dock.width - 336) <= 1, `${checkpoint}: inspector outer width must match its declared normal width`)
    for (const selector of selectors) assert.ok(geometry.nodes.some((item) => item.selector === selector), `${checkpoint}: missing visible geometry target ${selector}`)
    for (const item of geometry.nodes) {
      assert.ok(item.width > 0, `${checkpoint}: ${item.selector} must have visible horizontal geometry`)
      assert.ok(item.left >= geometry.dock.left - 1 && item.right <= geometry.dock.right + 1, `${checkpoint}: ${item.selector} must fit inside the inspector instead of being clipped`)
    }
    for (const item of geometry.wrapped) {
      assert.ok(item.scrollWidth <= item.clientWidth + 1, `${checkpoint}: ${item.selector} must wrap complete hash metadata without horizontal overflow`)
      assert.ok(item.textLines.every((line) => line.left >= item.left - 1 && line.right <= item.right + 1), `${checkpoint}: every hash text line must fit its metadata box`)
    }
  }
  await page.goto(`${origin}/__systemx/#source`, { waitUntil: 'domcontentloaded' })
  // Finish the normal boot reads, then use the supported visibility control.
  // Long source readbacks must not depend on the inspector's Auto layout.
  await expect(page.locator('#font-source-revision')).toHaveAttribute('data-revision', sha(stylesheetInitial))
  if (await page.locator('#right-panel-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#right-panel-toggle').click()
  await page.locator('[data-inspector-group-tab="build"]').click()
  await page.locator('[data-inspector-tab="source"]').click()
  await expect(page.locator('#right-panel-visibility')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#right-panel-visibility').click()
  await expect(page.locator('#right-panel-visibility')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#right-panel-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.builder-shell')).not.toHaveClass(/right-panel-collapsed/)
  await expect(page.locator('#right-panel-resizer')).toHaveAttribute('aria-valuenow', '336')
  const initialInspectorBounds = await page.locator('.right-panel').boundingBox()
  assert.ok(initialInspectorBounds && Math.abs(initialInspectorBounds.width - 336) <= 1)
  report.inspectorSetup = { bootStylesheetRevision: sha(stylesheetInitial), pinned: true, expanded: true, width: initialInspectorBounds.width }
  const file = page.locator('#source-file-select'), editor = page.getByRole('textbox', { name: 'Source editor', exact: true, includeHidden: true })
  const confirmation = page.locator('#source-confirmation'), save = page.locator('#save-source'), reload = page.locator('#reload-source')
  const revision = page.locator('#source-revision'), output = page.locator('#source-output')
  await expect(file.locator(`option[value="${sourcePath}"]`)).toHaveCount(1)
  await expect(page.locator('#source-revision-help')).toContainText('bytes of one allowlisted source file')
  await expect(page.locator('#source-revision-help')).toContainText('Git cleanliness, provider publication, or an exclusive lock')
  checks.push('Visible Source help states the one-file byte-hash scope and keeps Git cleanliness, provider publication and exclusive locking separate.')
  await file.selectOption(sourcePath)
  for (const ending of ['\n', '\r\n']) {
    await page.route('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx', async (route) => {
      const response = await route.fetch(), body = await response.json()
      await route.fulfill({ response, json: { ...body, revision: sha(initial) + ending } })
    })
    await page.locator('#load-source').click()
    await expect(output).toContainText('Source revision unavailable')
    await expect(save).toBeDisabled()
    await expect(editor).toHaveValue('')
    await page.unroute('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx')
  }
  checks.push('Malformed loaded revisions with trailing LF or CRLF never bind a file/draft revision or enable Save.')
  await page.locator('#load-source').click()
  await expect(editor).toHaveValue(initial)
  await expect(revision).toHaveAttribute('data-revision', sha(initial))
  const draft = initial.replace('Fixture original', 'Raw operator draft')
  await editor.fill(draft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const external = initial + '// External fixture edit.\n'
  writeFileSync(sourceFile, external)
  const beforeConflict = effects()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
    await save.click()
    assert.equal((await response).status(), 409)
    await expect(output).toContainText('draft and loaded revision are kept')
    await expect(editor).toHaveValue(draft)
    await expect(confirmation).toHaveValue('SAVE LOCAL CHANGE')
    await expect(revision).toHaveAttribute('data-revision', sha(initial))
    await expect(revision).toHaveAttribute('data-current-revision', sha(external))
    await expect(revision).toContainText(`loaded ${sha(initial)} · current ${sha(external)}`)
    assert.equal(posts.at(-1).baseRevision, sha(initial))
    assert.deepEqual(effects(), beforeConflict)
  }
  await page.locator('#panel-source').screenshot({ path: join(evidence, '01-raw-conflict-draft-preserved.png') })
  checks.push('Two stale raw saves return409 with the same loaded revision; draft, approval, source, backup/log and temporary-file inventories remain unchanged.')

  page.once('dialog', (dialog) => dialog.dismiss())
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(output).toContainText('Reload cancelled')
  await expect(editor).toHaveValue(draft)
  await expect(revision).toHaveAttribute('data-revision', sha(initial))
  await page.route('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned fixture read unavailable"}' }))
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(output).toContainText('Owned fixture read unavailable')
  await expect(output).toContainText('Check the local connection and reload source before retrying')
  await expect(editor).toHaveValue(draft)
  await expect(revision).toHaveAttribute('data-revision', sha(initial))
  assert.deepEqual(effects(), beforeConflict)
  await page.unroute('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx')
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue(external)
  await expect(revision).toHaveAttribute('data-revision', sha(external))
  await expect(confirmation).toHaveValue('')
  checks.push('Explicit Reload supports Cancel, retains the complete draft/base on a failed GET, and replaces them only after a confirmed successful GET.')

  const accepted = external.replace('Fixture original', 'Accepted raw draft')
  await editor.fill(accepted)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const successful = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  const acceptedResponse = await successful
  assert.equal(acceptedResponse.status(), 200)
  const acceptedResult = await acceptedResponse.json()
  assert.equal(posts.at(-1).baseRevision, sha(external))
  assert.equal(acceptedResult.revision, sha(accepted))
  await expect(revision).toHaveAttribute('data-revision', sha(accepted))
  assert.equal(readFileSync(sourceFile, 'utf8'), accepted)
  assert.equal(readFileSync(join(fixture, acceptedResult.backup), 'utf8'), external)
  assert.equal(effects().backups.length, beforeConflict.backups.length + 1)
  await page.locator('#panel-source').screenshot({ path: join(evidence, '02-raw-save-new-revision.png') })
  checks.push('A fresh raw save sends the explicitly reloaded base, persists content, returns/retains its new revision and backs up the exact replaced bytes.')

  const crlf = '\uFEFFexport function HomePage() {\r\n  return <h1>Fixture original — café</h1>\r\n}\r\n'
  let representationDialogs = 0
  const refuseUnexpectedDiscard = async (dialog) => { representationDialogs += 1; await dialog.dismiss() }
  page.on('dialog', refuseUnexpectedDiscard)
  writeFileSync(sourceFile, crlf)
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue(crlf.replaceAll('\r\n', '\n'))
  await expect(revision).toContainText('Loaded source')
  await expect(revision).not.toContainText('Unsaved draft')
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(revision).toHaveAttribute('data-revision', sha(crlf))
  assert.equal(representationDialogs, 0, 'Untouched CRLF display must not prompt to discard a draft.')
  const crlfBeforeNoop = effects()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const crlfNoop = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await (await crlfNoop).json()).status, 'unchanged')
  assert.equal(posts.at(-1).content, crlf)
  assert.deepEqual(effects(), crlfBeforeNoop)
  await expect(save).toBeEnabled()
  const visiblyEqualLf = crlf.replaceAll('\r\n', '\n')
  writeFileSync(sourceFile, visiblyEqualLf)
  const beforeEndingConflict = effects()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const endingConflict = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await endingConflict).status(), 409)
  assert.equal(posts.at(-1).content, crlf)
  assert.equal(posts.at(-1).baseRevision, sha(crlf))
  await expect(revision).toHaveAttribute('data-current-revision', sha(visiblyEqualLf))
  assert.deepEqual(effects(), beforeEndingConflict)
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(revision).toHaveAttribute('data-revision', sha(visiblyEqualLf))
  await expect(revision).toContainText('Loaded source')
  assert.equal(representationDialogs, 0)
  checks.push('CRLF loads and unchanged reloads stay clean without discard prompts; no-op Save preserves BOM, Unicode and exact CRLF with no effects, while an external line-ending-only change still receives409.')

  for (const raw of [initial + '// Mixed first.\r\n// Mixed second.\n', initial.replaceAll('\n', '\r')]) {
    writeFileSync(sourceFile, raw)
    await reload.click()
    await expect(editor).toBeEnabled()
    await expect(revision).toHaveAttribute('data-revision', sha(raw))
    await expect(revision).toContainText('Loaded source')
    const beforeNoop = effects()
    await confirmation.fill('SAVE LOCAL CHANGE')
    const noOp = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
    await save.click()
    assert.equal((await (await noOp).json()).status, 'unchanged')
    assert.equal(posts.at(-1).content, raw)
    assert.deepEqual(effects(), beforeNoop)
    await expect(save).toBeEnabled()
  }
  checks.push('Unchanged mixed-line-ending and lone-CR files send their exact loaded text and create no backup or operation entry.')

  writeFileSync(sourceFile, crlf)
  await reload.click()
  await expect(editor).toBeEnabled()
  await expect(revision).toHaveAttribute('data-revision', sha(crlf))
  const displaySent = crlf.replaceAll('\r\n', '\n').replace('Fixture original', 'CRLF source edit')
  const contentSent = displaySent.replaceAll('\n', '\r\n')
  let releaseSave, notifySaved, heldPost
  const saveRelease = new Promise((resolveRelease) => { releaseSave = resolveRelease })
  releasePendingResponse = releaseSave
  const savedAtServer = new Promise((resolveSaved) => { notifySaved = resolveSaved })
  await page.route('**/api/builder/source', async (route) => {
    heldPost = route.request().postDataJSON()
    posts.push(heldPost)
    const response = await route.fetch()
    notifySaved()
    await saveRelease
    await route.fulfill({ response })
  })
  await editor.fill(displaySent)
  await confirmation.fill('SAVE LOCAL CHANGE')
  await save.click()
  await Promise.race([savedAtServer, delay(15000).then(() => { throw new Error('Owned fixture save response was not captured for the in-flight draft check.') })])
  await expect(page.locator('#load-source')).toBeDisabled()
  await expect(reload).toBeDisabled()
  assert.equal(heldPost.content, contentSent)
  assert.equal(readFileSync(sourceFile, 'utf8'), contentSent)
  const newerDisplay = displaySent + '// Newer input while save response is held.\n'
  await editor.fill(newerDisplay)
  const releasedResponse = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  releaseSave()
  const savedCrLf = await (await releasedResponse).json()
  await page.unroute('**/api/builder/source')
  releasePendingResponse = null
  assert.equal(savedCrLf.revision, sha(contentSent))
  assert.equal(readFileSync(join(fixture, savedCrLf.backup), 'utf8'), crlf)
  await expect(revision).toHaveAttribute('data-revision', sha(contentSent))
  await expect(editor).toHaveValue(newerDisplay)
  await expect(revision).toContainText('Unsaved draft')
  await editor.fill(displaySent)
  await expect(revision).toContainText('Loaded source')
  const afterCrLfSave = effects()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const revertedNoop = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await (await revertedNoop).json()).status, 'unchanged')
  assert.equal(posts.at(-1).content, contentSent)
  assert.deepEqual(effects(), afterCrLfSave)
  await expect(save).toBeEnabled()
  assert.equal(representationDialogs, 0)
  page.off('dialog', refuseUnexpectedDiscard)
  await page.locator('#panel-source').screenshot({ path: join(evidence, '04-crlf-display-baseline.png') })
  checks.push('Edited uniform CRLF persists CRLF and exact prior-byte backup; a held response retains newer textarea input as dirty, and reverting to the accepted display baseline sends an exact CRLF no-op.')

  const transportDraft = displaySent + '// Retained after transport and API failures.\n'
  await editor.fill(transportDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const beforeFailedSave = effects(), failedBase = await revision.getAttribute('data-revision')
  for (const mode of ['transport', 'http']) {
    await page.route('**/api/builder/source', (route) => {
      posts.push(route.request().postDataJSON())
      return mode === 'transport' ? route.abort('connectionfailed') : route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned fixture save unavailable"}' })
    })
    const failedRequest = mode === 'transport'
      ? page.waitForEvent('requestfailed', { predicate: (item) => item.url().endsWith('/api/builder/source') && item.method() === 'POST' })
      : waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST' && item.status() === 503)
    void failedRequest.catch(() => {})
    await save.click()
    await failedRequest
    await expect(save).toBeEnabled()
    await expect(output).toContainText('Save was not confirmed')
    await expect(output).toContainText('Check the local connection and reload source before retrying')
    await expect(output).not.toContainText('Source changed since it was loaded')
    await expect(editor).toHaveValue(transportDraft)
    await expect(confirmation).toHaveValue('SAVE LOCAL CHANGE')
    await expect(revision).toHaveAttribute('data-revision', failedBase)
    assert.deepEqual(effects(), beforeFailedSave)
    await page.unroute('**/api/builder/source')
  }
  checks.push('Explicit aborted-transport and HTTP503 save fixtures retain the draft, confirmation and base without promotion or effects, and report an unconfirmed outcome with connection/reload guidance distinct from409.')

  await file.selectOption(secondPath)
  const attemptedPosts = posts.length
  await save.click()
  await expect(output).toContainText(`Selected file changed to ${secondPath}`)
  assert.equal(posts.length, attemptedPosts)
  await expect(editor).toHaveValue(transportDraft)
  await expect(revision).toHaveAttribute('data-revision', failedBase)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.locator('#load-source').click()
  await expect(output).toContainText('Reload cancelled')
  await expect(file).toHaveValue(sourcePath)
  await expect(editor).toHaveValue(transportDraft)
  await file.selectOption(secondPath)
  await page.route('**/api/builder/source?path=src%2Fpages%2FAboutPage.tsx', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned second-file read unavailable"}' }))
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('#load-source').click()
  await expect(editor).toBeEnabled()
  await expect(output).toContainText('Owned second-file read unavailable')
  await expect(editor).toHaveValue(transportDraft)
  await expect(revision).toHaveAttribute('data-revision', failedBase)
  await save.click()
  assert.equal(posts.length, attemptedPosts)
  await page.unroute('**/api/builder/source?path=src%2Fpages%2FAboutPage.tsx')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('#load-source').click()
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue(secondInitial)
  await expect(revision).toHaveAttribute('data-revision', sha(secondInitial))
  const secondAccepted = secondInitial.replace('About fixture original', 'About accepted')
  await editor.fill(secondAccepted)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const secondSave = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  const secondResponse = await secondSave
  assert.equal(secondResponse.status(), 200)
  const secondResult = await secondResponse.json()
  assert.equal(posts.at(-1).path, secondPath)
  assert.equal(posts.at(-1).baseRevision, sha(secondInitial))
  assert.equal(readFileSync(secondFile, 'utf8'), secondAccepted)
  assert.equal(readFileSync(sourceFile, 'utf8'), contentSent)
  assert.equal(readFileSync(join(fixture, secondResult.backup), 'utf8'), secondInitial)
  await expect(revision).toHaveAttribute('data-revision', sha(secondAccepted))
  await expect(save).toBeEnabled()
  await file.selectOption(sourcePath)
  await page.locator('#load-source').click()
  await expect(editor).toBeEnabled()
  await expect(revision).toHaveAttribute('data-revision', sha(contentSent))
  checks.push('Selecting a second file cannot POST an old draft/base; Cancel and failed GET preserve the old binding, while successful explicit load binds the second file hash and saves only that target with an exact backup.')

  const retainedRawBase = await revision.getAttribute('data-revision')
  const retainedRawDraft = accepted + '// Independent raw editor draft.\n'
  await editor.fill(retainedRawDraft)
  writeFileSync(sourceFile, initial)
  const frameHandle = await page.locator('#app-preview-frame').elementHandle(), frame = await frameHandle.contentFrame()
  await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
  await frame.getByRole('heading', { name: 'Fixture original', exact: true }).click()
  const textEditor = page.locator('#settings-text-editor'), textSave = page.locator('#settings-text-save'), textApproval = page.locator('#settings-text-confirmation')
  await expect(textSave).toBeEnabled()
  await textEditor.fill('Selected text draft')
  await textApproval.fill('SAVE TEXT CHANGE')
  const leafExternal = initial + '// Another external fixture edit.\n'
  writeFileSync(sourceFile, leafExternal)
  const beforeLeafConflict = effects()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const conflict = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
    await textSave.click()
    assert.equal((await conflict).status(), 409)
    await expect(page.locator('#settings-text-output')).toContainText('draft and selected source revision are kept')
    await expect(textEditor).toHaveValue('Selected text draft')
    await expect(textApproval).toHaveValue('SAVE TEXT CHANGE')
    await expect(page.locator('#settings-source-revision')).toHaveAttribute('data-revision', sha(initial))
    await expect(page.locator('#settings-source-revision')).toHaveAttribute('data-current-revision', sha(leafExternal))
    await expect(frame.locator('h1')).toHaveText('Fixture original')
    assert.equal(posts.at(-1).baseRevision, sha(initial))
    assert.deepEqual(effects(), beforeLeafConflict)
  }
  await page.locator('#settings-text-reload').click()
  await expect(page.locator('#settings-source-revision')).toContainText(sha(leafExternal).slice(0, 12))
  await expect(textEditor).toHaveValue('Selected text draft')
  const leafSaved = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await textSave.click()
  const leafResult = await (await leafSaved).json()
  const leafContent = leafExternal.replace('Fixture original', 'Selected text draft')
  assert.equal(posts.at(-1).baseRevision, sha(leafExternal))
  assert.equal(leafResult.revision, sha(leafContent))
  assert.equal(readFileSync(sourceFile, 'utf8'), leafContent)
  assert.equal(readFileSync(join(fixture, leafResult.backup), 'utf8'), leafExternal)
  await expect(frame.locator('h1')).toHaveText('Selected text draft')
  await expect(editor).toHaveValue(retainedRawDraft)
  await expect(revision).toHaveAttribute('data-revision', retainedRawBase)
  await page.locator('[data-inspector-group-tab="build"]').click()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const rawAfterLeaf = effects()
  const independentConflict = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await independentConflict).status(), 409)
  assert.equal(posts.at(-1).baseRevision, retainedRawBase)
  assert.deepEqual(effects(), rawAfterLeaf)
  await expect(editor).toHaveValue(retainedRawDraft)
  await page.locator('[data-inspector-group-tab="design"]').click()
  await page.locator('[data-inspector-tab="settings"]').click()
  await page.locator('#panel-settings').screenshot({ path: join(evidence, '03-leaf-save-independent-base.png') })
  checks.push('Selected-text saves keep an independent loaded revision across409 retries; explicit source reload retains the text draft, permits a backed-up save, and never advances a separate raw editor draft/base.')

  await page.locator('[data-inspector-group-tab="build"]').click()
  await page.locator('[data-inspector-tab="source"]').click()
  const compare = page.locator('#compare-source'), review = page.locator('#source-review')
  const prepareReplacement = page.locator('#prepare-source-replacement'), cancelComparison = page.locator('#cancel-source-review')
  const reviewDraftText = page.locator('#source-review-draft'), reviewCurrentText = page.locator('#source-review-current')
  const reviewSummary = page.locator('#source-review-summary'), reviewLines = page.locator('#source-review-lines'), reviewStatus = page.locator('#source-review-status')
  const currentSourceGet = (item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/builder/source') && new URL(item.url()).searchParams.get('path') === sourcePath
  const editorBinding = async () => ({ draft: await editor.inputValue(), approval: await confirmation.inputValue(), loadedRevision: await revision.getAttribute('data-revision') })
  const compareLatest = async () => {
    const response = waitForResponse(currentSourceGet)
    await compare.click()
    assert.equal((await response).status(), 200)
    await expect(prepareReplacement).toBeEnabled()
  }
  const reviewBase = 'export function HomePage() {\n  return <h1>Review base</h1>\n}\n// Unchanged comparison anchor.\n'
  writeFileSync(sourceFile, reviewBase)
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toHaveValue(reviewBase)
  const reviewDraft = reviewBase.replace('Review base', 'Reviewed draft — café') + '// <img data-source-review-probe src="https://source-review.invalid/probe" onerror="window.sourceReviewInjected=true">\n'
  const reviewCurrent = reviewBase.replace('Review base', 'External current source') + '// Current-only comparison line.\n'
  await editor.fill(reviewDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  writeFileSync(sourceFile, reviewCurrent)
  const beforeCompare = effects(), compareBinding = await editorBinding(), beforeComparePosts = posts.length
  await compareLatest()
  assert.equal(posts.length, beforeComparePosts)
  assert.deepEqual(await editorBinding(), compareBinding)
  assert.deepEqual(effects(), beforeCompare)
  await expect(review).toBeVisible()
  await expect(page.locator('#source-review-path')).toHaveText(sourcePath)
  assert.equal(await reviewDraftText.textContent(), reviewDraft)
  assert.equal(await reviewCurrentText.textContent(), reviewCurrent)
  await expect(page.locator('#source-review-loaded-revision')).toContainText(sha(reviewBase))
  await expect(page.locator('#source-review-current-revision')).toContainText(sha(reviewCurrent))
  await expect(page.locator('#source-review-draft-revision')).toContainText(sha(reviewDraft))
  await expect(reviewSummary).toContainText(/changed/i)
  await expect(reviewLines).toContainText('Reviewed draft')
  await expect(reviewLines).toContainText('External current source')
  await expect(reviewLines.locator('[data-change-kind="replace"][data-draft-line="2"][data-current-line="2"]')).toHaveCount(1)
  await expect(review.locator('img, script, iframe')).toHaveCount(0)
  assert.equal(await page.evaluate(() => globalThis.sourceReviewInjected === true), false)
  await page.locator('#panel-source').screenshot({ path: join(evidence, '05-compare-literal-snapshots-and-hashes.png') })
  const comparisonPanes = review.locator('.source-comparison-panes')
  await comparisonPanes.scrollIntoViewIfNeeded()
  await comparisonPanes.screenshot({ path: join(evidence, '05a-comparison-side-by-side-panes.png') })
  await reviewLines.scrollIntoViewIfNeeded()
  await reviewLines.screenshot({ path: join(evidence, '05b-comparison-changed-lines.png') })
  checks.push('Compare latest performs a GET only and displays complete literal current/draft snapshots, full loaded/current/draft hashes and changed-line evidence while retaining draft, loaded base, approval and every source/backup/log/temp effect.')

  await cancelComparison.click()
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(await editorBinding(), compareBinding)
  assert.deepEqual(effects(), beforeCompare)
  assert.equal(posts.length, beforeComparePosts)
  checks.push('Cancel comparison discards review authority without changing the source draft, loaded revision, prior approval or disk effects; source-like markup remains inert.')

  await compareLatest()
  await editor.fill(reviewDraft + '// Edited after comparison.\n')
  await expect(prepareReplacement).toBeDisabled()
  await expect(reviewStatus).toContainText(/outdated|changed|compare/i)
  await editor.fill(reviewDraft)
  await expect(prepareReplacement).toBeDisabled()
  await compareLatest()
  await file.selectOption(secondPath)
  await expect(prepareReplacement).toBeDisabled()
  await file.selectOption(sourcePath)
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(effects(), beforeCompare)
  assert.deepEqual(await editorBinding(), compareBinding)
  checks.push('Editing a compared draft or selecting another file invalidates the review; restoring the old text or selection cannot silently reactivate replacement authority.')

  for (const invalidate of ['draft', 'cancel']) {
    await compareLatest()
    let releaseComparison, notifyCaptured, notifyCompleted
    const comparisonRelease = new Promise((resolveRelease) => { releaseComparison = resolveRelease })
    const comparisonCaptured = new Promise((resolveCaptured) => { notifyCaptured = resolveCaptured })
    const comparisonCompleted = new Promise((resolveCompleted) => { notifyCompleted = resolveCompleted })
    releasePendingResponse = releaseComparison
    await page.route('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx', async (route) => {
      try {
        const response = await route.fetch()
        notifyCaptured()
        await comparisonRelease
        await route.fulfill({ response })
      } catch { /* A deliberately invalidated comparison may abort its own GET. */ }
      finally { notifyCompleted() }
    })
    await compare.click()
    await Promise.race([comparisonCaptured, delay(15000).then(() => { throw new Error('Owned comparison GET did not reach the held-response fixture.') })])
    await expect(save).toBeDisabled()
    await expect(prepareReplacement).toBeDisabled()
    if (invalidate === 'draft') await editor.fill(reviewDraft + '// New input during comparison GET.\n')
    else await cancelComparison.click()
    releaseComparison()
    await Promise.race([comparisonCompleted, delay(15000).then(() => { throw new Error('Owned comparison GET did not finish after invalidation.') })])
    await page.unroute('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx')
    releasePendingResponse = null
    await expect(prepareReplacement).toBeDisabled()
    await expect(revision).toHaveAttribute('data-revision', sha(reviewBase))
    await expect(confirmation).toHaveValue('SAVE LOCAL CHANGE')
    assert.deepEqual(effects(), beforeCompare)
    if (invalidate === 'draft') await editor.fill(reviewDraft)
  }
  checks.push('A held comparison GET disables Save and replacement preparation; a newer draft or Cancel invalidates the response so it cannot resurrect a stale review or promote the loaded base.')

  await page.route('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned comparison read unavailable"}' }))
  const failedComparison = waitForResponse((item) => currentSourceGet(item) && item.status() === 503)
  await compare.click()
  await failedComparison
  await expect(prepareReplacement).toBeDisabled()
  await expect(reviewStatus).toContainText('Owned comparison read unavailable')
  await expect(editor).toHaveValue(reviewDraft)
  await expect(revision).toHaveAttribute('data-revision', sha(reviewBase))
  await expect(confirmation).toHaveValue('SAVE LOCAL CHANGE')
  assert.deepEqual(effects(), beforeCompare)
  await page.unroute('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx')
  checks.push('A failed comparison GET exposes its read failure, retains the complete editor binding and disk inventory, and provides no replacement authority.')

  const clippedDraft = reviewBase + `// ${'x'.repeat(1100)}\n`
  await editor.fill(clippedDraft)
  const clippedBinding = await editorBinding()
  const clippedResponse = waitForResponse(currentSourceGet)
  await compare.click()
  assert.equal((await clippedResponse).status(), 200)
  await expect(reviewSummary).toContainText(/clipped text|truncated/i)
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(await editorBinding(), clippedBinding)
  assert.deepEqual(effects(), beforeCompare)
  await editor.fill(reviewDraft)
  await page.route('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx', async (route) => {
    const response = await route.fetch(), body = await response.json()
    await route.fulfill({ response, json: { ...body, revision: sha('synthetic mismatched current byte hash') } })
  })
  const mismatchedResponse = waitForResponse(currentSourceGet)
  await compare.click()
  assert.equal((await mismatchedResponse).status(), 200)
  await expect(reviewSummary).toContainText('Latest file bytes cannot be reproduced by this text snapshot')
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(await editorBinding(), compareBinding)
  assert.deepEqual(effects(), beforeCompare)
  assert.equal(posts.length, beforeComparePosts)
  await page.unroute('**/api/builder/source?path=src%2Fpages%2FHomePage.tsx')
  checks.push('A clipped changed-line excerpt and a valid-looking current hash that does not match the displayed bytes both refuse replacement preparation, preserving the draft, original base, approval and disk effects.')

  await compareLatest()
  await prepareReplacement.click()
  await expect(save).toHaveText('Save reviewed replacement')
  await expect(confirmation).toHaveValue('')
  await expect(editor).toHaveValue(reviewDraft)
  await expect(revision).toHaveAttribute('data-revision', sha(reviewBase))
  assert.deepEqual(effects(), beforeCompare)
  assert.equal(posts.length, beforeComparePosts)
  await editor.fill(reviewDraft + '// Prepared draft invalidation.\n')
  await expect(prepareReplacement).toBeDisabled()
  await expect(save).not.toHaveText('Save reviewed replacement')
  await expect(confirmation).toHaveValue('')
  await editor.fill(reviewDraft)
  await compareLatest()
  await prepareReplacement.click()
  const racedCurrent = reviewCurrent + '// A newer external edit after explicit review.\n'
  writeFileSync(sourceFile, racedCurrent)
  const beforeReviewedRace = effects()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const reviewedRace = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  const racedResponse = await reviewedRace
  assert.equal(racedResponse.status(), 409)
  const racedBody = await racedResponse.json()
  assert.equal(racedBody.code, 'SOURCE_REVISION_CONFLICT')
  assert.equal(racedBody.currentRevision, sha(racedCurrent))
  assert.equal(posts.at(-1).baseRevision, sha(reviewCurrent))
  assert.equal(posts.at(-1).content, reviewDraft)
  await expect(editor).toHaveValue(reviewDraft)
  await expect(revision).toHaveAttribute('data-revision', sha(reviewBase))
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(effects(), beforeReviewedRace)
  await page.locator('#panel-source').screenshot({ path: join(evidence, '06-reviewed-replacement-newer-race409.png') })
  checks.push('Review replacement alone clears old approval and writes nothing; editing its prepared draft invalidates it, and a newer external edit still returns409 against the explicitly reviewed current hash while retaining the draft and original loaded base.')

  await compareLatest()
  await prepareReplacement.click()
  await expect(confirmation).toHaveValue('')
  await expect(revision).toHaveAttribute('data-revision', sha(reviewBase))
  const beforeReviewedSave = effects(), beforeReviewedPosts = posts.length
  await confirmation.fill('SAVE LOCAL CHANGE')
  const reviewedSave = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  const reviewedResponse = await reviewedSave
  assert.equal(reviewedResponse.status(), 200)
  const reviewedResult = await reviewedResponse.json()
  assert.equal(posts.length, beforeReviewedPosts + 1)
  assert.equal(posts.at(-1).path, sourcePath)
  assert.equal(posts.at(-1).baseRevision, sha(racedCurrent))
  assert.equal(posts.at(-1).content, reviewDraft)
  assert.equal(posts.at(-1).confirmation, 'SAVE LOCAL CHANGE')
  assert.equal(reviewedResult.revision, sha(reviewDraft))
  assert.equal(readFileSync(sourceFile, 'utf8'), reviewDraft)
  assert.equal(readFileSync(join(fixture, reviewedResult.backup), 'utf8'), racedCurrent)
  assert.equal(effects().backups.length, beforeReviewedSave.backups.length + 1)
  await expect(revision).toHaveAttribute('data-revision', sha(reviewDraft))
  await expect(confirmation).toHaveValue('')
  // Accepted revisions render before the post-save inventory refresh completes.
  // Finish that workflow before removing the next test's owned source fixture.
  await expect(save).toBeEnabled()
  await expect(file).toHaveValue(sourcePath)
  await page.locator('[data-inspector-group-tab="build"]').click()
  await page.locator('[data-inspector-tab="source"]').click()
  await expect(page.locator('#panel-source')).toBeVisible()
  await page.locator('#panel-source').screenshot({ path: join(evidence, '07-explicit-reviewed-replacement-exact-backup.png') })
  checks.push('A newly compared and explicitly prepared replacement requires fresh separate save confirmation, posts the reviewed current hash and exact reviewed draft once, backs up precisely the replaced current bytes, and advances the loaded revision only after accepted Save.')

  const unavailableDraft = reviewDraft + '// Draft retained after its file is removed.\n'
  await editor.fill(unavailableDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const missingBinding = await editorBinding()
  report.missingSourcePrecondition = { selectedPath: await file.inputValue(), loadedRevision: missingBinding.loadedRevision, saveDisabled: await save.isDisabled() }
  rmSync(sourceFile)
  const beforeMissing = effects()
  const unavailableBody = { code: 'SOURCE_UNAVAILABLE', error: 'Source is unavailable. Select an existing allowlisted source file, then reload before saving.' }
  const missingPost = waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  const missingPostResponse = await missingPost
  assert.equal(missingPostResponse.status(), 404)
  assert.deepEqual(await missingPostResponse.json(), unavailableBody)
  await expect(save).toBeDisabled()
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(await editorBinding(), missingBinding)
  assert.deepEqual(effects(), beforeMissing)
  assert.equal(existsSync(sourceFile), false)
  const missingGet = waitForResponse(currentSourceGet)
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  const missingGetResponse = await missingGet
  assert.equal(missingGetResponse.status(), 404)
  assert.deepEqual(await missingGetResponse.json(), unavailableBody)
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue(unavailableDraft)
  await expect(revision).toHaveAttribute('data-revision', sha(reviewDraft))
  await expect(confirmation).toHaveValue('SAVE LOCAL CHANGE')
  await expect(output).toContainText('Source is unavailable')
  await expect(save).toBeDisabled()
  const missingCompare = waitForResponse(currentSourceGet)
  await compare.click()
  assert.equal((await missingCompare).status(), 404)
  await expect(prepareReplacement).toBeDisabled()
  assert.deepEqual(await editorBinding(), missingBinding)
  assert.deepEqual(effects(), beforeMissing)
  assert.equal(existsSync(sourceFile), false)
  await page.locator('#panel-source').screenshot({ path: join(evidence, '08-source-unavailable-draft-no-recreate.png') })
  checks.push('Deleting a loaded allowlisted fixture yields exact SOURCE_UNAVAILABLE404 responses for Save, Reload and Compare; the draft/base/approval persist, Save and replacement remain disabled, and source, backup, operation and temp inventories prove no recreation or side effect.')

  const beforeInventoryRefresh = effects(), inventoryRefreshBinding = await editorBinding(), inventoryRefreshPosts = posts.length
  await page.locator('[data-panel-target="command"]').click()
  const refreshFeedback = page.locator('#command-output').evaluate((node) => new Promise((resolveFeedback, rejectFeedback) => {
    const deadline = globalThis.setTimeout(() => { observer.disconnect(); rejectFeedback(new Error('Owned workspace Refresh did not publish completion feedback.')) }, 15000)
    const observer = new globalThis.MutationObserver(() => {
      if (!node.textContent.includes('Workspace refreshed.')) return
      observer.disconnect()
      globalThis.clearTimeout(deadline)
      resolveFeedback(true)
    })
    observer.observe(node, { childList: true, subtree: true, characterData: true })
  }))
  void refreshFeedback.catch(() => {})
  const inventoryResponse = waitForResponse((item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/status'))
  await page.locator('#refresh-status').click()
  assert.equal((await inventoryResponse).status(), 200)
  await refreshFeedback
  await page.locator('[data-inspector-group-tab="build"]').click()
  await page.locator('[data-inspector-tab="source"]').click()
  await expect(page.locator('#panel-source')).toBeVisible()
  report.inventoryRefreshAfterDeletion = {
    ...await editorBinding(),
    selectedPath: await file.inputValue(),
    boundFileOptionCount: await file.locator(`option[value="${sourcePath}"]`).count(),
    compareDisabled: await compare.isDisabled(),
    saveDisabled: await save.isDisabled(),
    output: await output.textContent(),
  }
  await page.locator('#panel-source').screenshot({ path: join(evidence, '09-workspace-refresh-keeps-missing-source-binding.png') })
  assert.deepEqual(effects(), beforeInventoryRefresh)
  assert.equal(posts.length, inventoryRefreshPosts)
  assert.deepEqual(await editorBinding(), inventoryRefreshBinding)
  assert.equal(report.inventoryRefreshAfterDeletion.selectedPath, sourcePath, 'Workspace Refresh must retain access to the loaded draft target even when inventory omits that path')
  assert.equal(report.inventoryRefreshAfterDeletion.boundFileOptionCount, 1)
  await expect(compare).toBeEnabled()
  await expect(save).toBeDisabled()
  checks.push('A real workspace Refresh after source deletion retains the loaded file option, exact draft/base/approval and available Compare retry; a bounded inventory omission never silently selects another source or creates a write.')

  const showCode = async () => {
    await page.locator('[data-inspector-group-tab="build"]').click()
    await page.locator('[data-inspector-tab="source"]').click()
    await expect(page.locator('#panel-source')).toBeVisible()
  }
  const showFonts = async () => {
    await page.locator('[data-inspector-group-tab="design"]').click()
    await page.locator('[data-inspector-tab="style"]').click()
    await expect(page.locator('#font-search')).toBeVisible()
  }
  await file.selectOption(stylesheetPath)
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('#load-source').click()
  await expect(editor).toHaveValue(stylesheetInitial)
  await expect(revision).toHaveAttribute('data-revision', sha(stylesheetInitial))
  const stylesheetDraft = stylesheetInitial + '/* Retained independent raw CSS draft. */\n'
  await editor.fill(stylesheetDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const rawStylesheetBinding = await editorBinding()
  await showFonts()
  const fontRevision = page.locator('#font-source-revision'), fontRefresh = page.locator('#font-refresh-source')
  const fontSave = page.locator('#font-save-project'), fontApproval = page.locator('#font-confirmation'), fontOutput = page.locator('#font-status')
  const chooseFont = async (family) => {
    await page.locator('#font-search').fill(family)
    const choice = page.locator(`[data-font-family="${family}"]`)
    await expect(choice).toHaveCount(1)
    await choice.click()
    await expect(choice).toHaveClass(/selected/)
  }
  const fontBinding = async () => ({
    loadedRevision: await fontRevision.getAttribute('data-revision'),
    approval: await fontApproval.inputValue(),
    selectedFamily: await page.locator('[data-font-family].selected').getAttribute('data-font-family'),
  })
  const refreshFont = async () => {
    const response = waitForResponse((item) => item.request().method() === 'GET' && item.url().endsWith('/api/fonts/project'))
    await fontRefresh.click()
    const result = await response
    assert.equal(result.status(), 200)
    const body = await result.json()
    await expect(fontRevision).toHaveAttribute('data-revision', body.revision)
    return body
  }
  const beforeFontRead = effects(), beforeFontMutations = posts.length + fontPosts.length
  await expect(page.locator('#font-catalog-state')).toContainText('offline fallback')
  const initialFontState = await refreshFont()
  assert.equal(initialFontState.path, stylesheetPath)
  assert.equal(initialFontState.revision, sha(stylesheetInitial))
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeFontRead)
  assert.equal(posts.length + fontPosts.length, beforeFontMutations)
  checks.push('Explicit font source refresh returns the exact stylesheet byte revision while an independently loaded raw CSS draft, its base and approval stay unchanged; the read creates no disk or POST effects.')

  await chooseFont('Inter')
  await fontApproval.fill('SAVE FONT CHANGE')
  const beforeFontSave = effects()
  let releaseFontSave, notifyFontSaved
  const fontSaveRelease = new Promise((resolveRelease) => { releaseFontSave = resolveRelease })
  const fontSavedAtServer = new Promise((resolveSaved) => { notifyFontSaved = resolveSaved })
  releasePendingResponse = releaseFontSave
  await page.route('**/api/builder/font', async (route) => {
    fontPosts.push(route.request().postDataJSON())
    const response = await route.fetch()
    notifyFontSaved()
    await fontSaveRelease
    await route.fulfill({ response })
  })
  await fontSave.click()
  await Promise.race([fontSavedAtServer, delay(15000).then(() => { throw new Error('Owned font save did not reach the held-response fixture.') })])
  await expect(fontSave).toBeDisabled()
  await chooseFont('Roboto')
  await expect(fontApproval).toHaveValue('')
  await fontApproval.fill('SAVE FONT CHANGE')
  const completedFontSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  releaseFontSave()
  const firstFontResponse = await completedFontSave
  assert.equal(firstFontResponse.status(), 200)
  const firstFontResult = await firstFontResponse.json()
  await page.unroute('**/api/builder/font')
  releasePendingResponse = null
  const firstFontContent = readFileSync(stylesheetFile, 'utf8')
  assert.equal(firstFontResult.status, 'saved')
  assert.equal(firstFontResult.family, 'Inter')
  assert.equal(firstFontResult.previousRevision, sha(stylesheetInitial))
  assert.equal(firstFontResult.revision, sha(firstFontContent))
  assert.equal(firstFontResult.currentRevision, sha(firstFontContent))
  assert.equal(fontPosts.at(-1).baseRevision, sha(stylesheetInitial))
  assert.equal(readFileSync(join(fixture, firstFontResult.backup), 'utf8'), stylesheetInitial)
  assert.equal(effects().backups.length, beforeFontSave.backups.length + 1)
  await expect(fontRevision).toHaveAttribute('data-revision', sha(firstFontContent))
  await expect(page.locator('#project-font-family')).toHaveText('Inter')
  await expect(page.locator('[data-font-family="Roboto"]')).toHaveClass(/selected/)
  await expect(fontApproval).toHaveValue('SAVE FONT CHANGE')
  await expect(fontSave).toBeEnabled()
  await expect(fontOutput).toContainText('Inter')
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  await fontRevision.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('font-save-current-revision', ['#panel-style', '.font-tool-card', '.font-project-card', '#font-source-revision', '#font-status'], ['#font-source-revision', '#font-status'])
  await page.locator('.font-project-card').screenshot({ path: join(evidence, '10-font-save-captured-selection-and-revision.png') })
  await fontOutput.scrollIntoViewIfNeeded()
  await fontOutput.screenshot({ path: join(evidence, '10a-font-save-captured-receipt.png') })
  checks.push('A held confirmed Inter font save persists and reports its exact new CSS revision and predecessor backup; a later Roboto selection and freshly typed identical approval survive the Inter response without rebasing the independent raw CSS draft.')

  await showCode()
  const afterFontSave = effects()
  const staleCssSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/source'))
  await save.click()
  const staleCssResponse = await staleCssSave
  assert.equal(staleCssResponse.status(), 409)
  const staleCssBody = await staleCssResponse.json()
  assert.equal(staleCssBody.code, 'SOURCE_REVISION_CONFLICT')
  assert.equal(staleCssBody.currentRevision, sha(firstFontContent))
  assert.equal(posts.at(-1).baseRevision, sha(stylesheetInitial))
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), afterFontSave)
  await expect(revision).toHaveAttribute('data-current-revision', sha(firstFontContent))
  await page.locator('#panel-source').screenshot({ path: join(evidence, '11-font-write-stale-raw-css-draft409.png') })
  checks.push('Saving the CSS editor draft after a guarded font write still sends its original loaded revision and receives409 with the font-written current hash; the full raw draft/base/approval and source/backup/log/temp inventories remain intact.')

  await showFonts()
  await chooseFont('Inter')
  await fontApproval.fill('SAVE FONT CHANGE')
  const beforeFontNoop = effects()
  const fontNoop = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  await fontSave.click()
  const fontNoopResponse = await fontNoop
  assert.equal(fontNoopResponse.status(), 200)
  const fontNoopBody = await fontNoopResponse.json()
  assert.equal(fontNoopBody.status, 'unchanged')
  for (const field of ['previousRevision', 'revision', 'currentRevision']) assert.equal(fontNoopBody[field], sha(firstFontContent))
  assert.deepEqual(effects(), beforeFontNoop)
  await expect(fontApproval).toHaveValue('')
  await expect(fontSave).toBeEnabled()
  checks.push('A confirmed same-font no-op uses the current font baseline, reports identical previous/current/new revisions, clears only its completed font approval and creates no redundant backup, operation or source write.')

  const externallyChangedCss = firstFontContent + '/* External stylesheet revision after font selection. */\n'
  writeFileSync(stylesheetFile, externallyChangedCss)
  await fontApproval.fill('SAVE FONT CHANGE')
  const beforeStaleFont = effects()
  const staleFontSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  await fontSave.click()
  const staleFontResponse = await staleFontSave
  assert.equal(staleFontResponse.status(), 409)
  assert.equal((await staleFontResponse.json()).currentRevision, sha(externallyChangedCss))
  assert.equal(fontPosts.at(-1).baseRevision, sha(firstFontContent))
  await expect(fontRevision).toHaveAttribute('data-revision', sha(firstFontContent))
  await expect(fontRevision).toHaveAttribute('data-current-revision', sha(externallyChangedCss))
  await expect(fontApproval).toHaveValue('SAVE FONT CHANGE')
  await expect(fontSave).toBeDisabled()
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeStaleFont)
  const refreshedFont = await refreshFont()
  assert.equal(refreshedFont.revision, sha(externallyChangedCss))
  await expect(fontApproval).toHaveValue('')
  await chooseFont('Roboto')
  await fontApproval.fill('SAVE FONT CHANGE')
  const retriedFontSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  await fontSave.click()
  const retriedFontResponse = await retriedFontSave
  assert.equal(retriedFontResponse.status(), 200)
  const retriedFontBody = await retriedFontResponse.json()
  const retriedFontContent = readFileSync(stylesheetFile, 'utf8')
  assert.equal(fontPosts.at(-1).baseRevision, sha(externallyChangedCss))
  assert.equal(retriedFontBody.previousRevision, sha(externallyChangedCss))
  assert.equal(retriedFontBody.revision, sha(retriedFontContent))
  assert.equal(readFileSync(join(fixture, retriedFontBody.backup), 'utf8'), externallyChangedCss)
  await expect(fontRevision).toHaveAttribute('data-revision', sha(retriedFontContent))
  await expect(fontSave).toBeEnabled()
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  checks.push('Even a same-font no-op intent refuses a stale stylesheet baseline with409 and no effects; explicit font Refresh obtains the current hash and clears old font approval before a newly confirmed retry saves with an exact predecessor backup.')

  await chooseFont('Inter')
  await fontApproval.fill('SAVE FONT CHANGE')
  let releaseOlderFont, notifyOlderFont
  const olderFontRelease = new Promise((resolveRelease) => { releaseOlderFont = resolveRelease })
  const olderFontCaptured = new Promise((resolveCaptured) => { notifyOlderFont = resolveCaptured })
  let olderFontContent
  releasePendingResponse = releaseOlderFont
  await page.route('**/api/builder/font', async (route) => {
    fontPosts.push(route.request().postDataJSON())
    const response = await route.fetch()
    olderFontContent = readFileSync(stylesheetFile, 'utf8')
    notifyOlderFont()
    await olderFontRelease
    await route.fulfill({ response })
  })
  await fontSave.click()
  await Promise.race([olderFontCaptured, delay(15000).then(() => { throw new Error('Older font receipt was not captured.') })])
  await chooseFont('Roboto')
  await fontApproval.fill('SAVE FONT CHANGE')
  const newerObservedCss = olderFontContent + '/* Newer source observed while older font response is held. */\n'
  writeFileSync(stylesheetFile, newerObservedCss)
  await showCode()
  const cssComparison = waitForResponse((item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/builder/source') && new URL(item.url()).searchParams.get('path') === stylesheetPath)
  await compare.click()
  assert.equal((await cssComparison).status(), 200)
  await expect(page.locator('#source-review-current-revision')).toContainText(sha(newerObservedCss))
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  const beforeOlderFontRelease = effects()
  await showFonts()
  const olderFontResponse = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  releaseOlderFont()
  const olderFontBody = await (await olderFontResponse).json()
  await page.unroute('**/api/builder/font')
  releasePendingResponse = null
  assert.equal(olderFontBody.revision, sha(olderFontContent))
  assert.equal(olderFontBody.previousRevision, sha(retriedFontContent))
  assert.equal(readFileSync(join(fixture, olderFontBody.backup), 'utf8'), retriedFontContent)
  await expect(fontRevision).toHaveAttribute('data-current-revision', sha(newerObservedCss))
  await expect(fontSave).toBeDisabled()
  await expect(fontOutput).toContainText(/superseded|newer source/i)
  await expect(page.locator('[data-font-family="Roboto"]')).toHaveClass(/selected/)
  await expect(fontApproval).toHaveValue('SAVE FONT CHANGE')
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeOlderFontRelease)
  const recoveredFontState = await refreshFont()
  assert.equal(recoveredFontState.revision, sha(newerObservedCss))
  checks.push('A delayed accepted font receipt remains an accepted-write receipt after a newer real CSS comparison observes another revision; it cannot roll back that latest observation, rebase the raw draft, discard newer selection/approval, or enable another write without Refresh.')

  await fontApproval.fill('SAVE FONT CHANGE')
  const beforeFontReadFailure = effects(), retainedFontReadBinding = await fontBinding()
  await page.route('**/api/fonts/project', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned font read unavailable"}' }))
  const failedFontRead = waitForResponse((item) => item.request().method() === 'GET' && item.url().endsWith('/api/fonts/project') && item.status() === 503)
  await fontRefresh.click()
  await failedFontRead
  await expect(fontOutput).toContainText('Owned font read unavailable')
  await expect(fontSave).toBeDisabled()
  assert.deepEqual(await fontBinding(), retainedFontReadBinding)
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeFontReadFailure)
  await page.unroute('**/api/fonts/project')
  await refreshFont()
  await chooseFont('Inter')
  await fontApproval.fill('SAVE FONT CHANGE')
  const beforeFontSaveFailure = effects(), retainedFontSaveBinding = await fontBinding()
  await page.route('**/api/builder/font', (route) => {
    fontPosts.push(route.request().postDataJSON())
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned font save unavailable"}' })
  })
  const failedFontSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font') && item.status() === 503)
  await fontSave.click()
  await failedFontSave
  await expect(fontOutput).toContainText('Owned font save unavailable')
  await expect(fontSave).toBeDisabled()
  assert.deepEqual(await fontBinding(), retainedFontSaveBinding)
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeFontSaveFailure)
  await page.unroute('**/api/builder/font')
  checks.push('HTTP503 font read and save failures retain the selected family, loaded font revision, font approval and independent raw CSS draft; neither claims a confirmed save or creates effects, and another write requires explicit successful Refresh.')

  await refreshFont()
  await fontApproval.fill('SAVE FONT CHANGE')
  const removedFontBinding = await fontBinding()
  rmSync(stylesheetFile)
  const beforeMissingStylesheet = effects()
  const missingFontSave = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/font'))
  await fontSave.click()
  const missingFontResponse = await missingFontSave
  assert.equal(missingFontResponse.status(), 404)
  assert.deepEqual(await missingFontResponse.json(), unavailableBody)
  await expect(fontOutput).toContainText(/unavailable/i)
  await expect(fontSave).toBeDisabled()
  assert.deepEqual(await fontBinding(), removedFontBinding)
  const missingFontRead = waitForResponse((item) => item.request().method() === 'GET' && item.url().endsWith('/api/fonts/project'))
  await fontRefresh.click()
  const missingFontReadResponse = await missingFontRead
  assert.equal(missingFontReadResponse.status(), 404)
  assert.deepEqual(await missingFontReadResponse.json(), unavailableBody)
  await expect(fontSave).toBeDisabled()
  assert.deepEqual(await fontBinding(), removedFontBinding)
  assert.deepEqual(await editorBinding(), rawStylesheetBinding)
  assert.deepEqual(effects(), beforeMissingStylesheet)
  assert.equal(existsSync(stylesheetFile), false)
  await fontRevision.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('font-unavailable-retained-revision', ['#panel-style', '.font-tool-card', '.font-project-card', '#font-source-revision', '#font-status'], ['#font-source-revision', '#font-status'])
  await page.locator('.font-project-card').screenshot({ path: join(evidence, '12-font-source-unavailable-retained-state.png') })
  checks.push('Removing the loaded stylesheet yields the exact SOURCE_UNAVAILABLE404 contract for font Save and Refresh; selection, both editors baseline/draft/approval states and all inventories persist, writes stay disabled, and no stylesheet is recreated.')

  const previewSourceBase = stylesheetInitial + '/* <img data-literal-preview-probe src="https://literal-preview.invalid/probe" onerror="globalThis.literalPreviewInjected=true"> */\n'
  writeFileSync(stylesheetFile, previewSourceBase)
  await showCode()
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toHaveValue(previewSourceBase)
  await expect(revision).toHaveAttribute('data-revision', sha(previewSourceBase))
  const previewButton = page.locator('#preview-source-draft'), literalPreview = page.locator('#source-draft-preview')
  const previewText = page.locator('#source-draft-preview-text'), previewBaseRevision = page.locator('#source-draft-preview-loaded-revision')
  const previewDigest = page.locator('#source-draft-preview-draft-revision'), previewCurrentRevision = page.locator('#source-draft-preview-current-revision')
  const previewStatus = page.locator('#source-draft-preview-status'), previewSummary = page.locator('#source-draft-preview-summary')
  const checkPreview = page.locator('#check-source-draft-preview'), closePreview = page.locator('#close-source-draft-preview')
  const stylesheetGet = (item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/builder/source') && new URL(item.url()).searchParams.get('path') === stylesheetPath
  const capturePreview = async () => {
    const display = await editor.inputValue(), response = waitForResponse(stylesheetGet)
    await previewButton.click()
    assert.equal((await response).status(), 200)
    await expect(previewDigest).toHaveText(sha(display))
    await expect(previewCurrentRevision).toHaveText(sha(readFileSync(stylesheetFile, 'utf8')))
    await expect(checkPreview).toBeEnabled()
  }
  const beforePreview = effects(), beforePreviewMutations = posts.length + fontPosts.length
  await capturePreview()
  await expect(page.locator('#source-draft-preview-path')).toHaveText(stylesheetPath)
  await expect(previewBaseRevision).toHaveText(sha(previewSourceBase))
  await expect(literalPreview).toHaveAttribute('data-freshness', 'current')
  assert.equal(await previewText.textContent(), previewSourceBase)
  await expect(literalPreview.locator('img, script, iframe')).toHaveCount(0)
  assert.equal(await page.evaluate(() => globalThis.literalPreviewInjected === true), false)
  assert.equal(posts.length + fontPosts.length, beforePreviewMutations)
  assert.deepEqual(effects(), beforePreview)
  await literalPreview.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('literal-preview-current-source', ['#panel-source', '#source-draft-preview', '#source-draft-preview dl', '#source-draft-preview dd', '#source-draft-preview-text', '#source-draft-preview-status', '#check-source-draft-preview', '#close-source-draft-preview'], ['#source-draft-preview dd'])
  await literalPreview.screenshot({ path: join(evidence, '13-literal-preview-bound-current-source.png') })
  checks.push('Literal draft preview captures the exact path, raw source baseline, full editor-text digest and observed current revision through GET only; source-like markup renders as inert text and creates no source, backup, log or temp effects.')

  const beforeOldMissingBinding = await editorBinding(), beforeOldMissingMutations = posts.length + fontPosts.length
  let releaseOldMissing, notifyOldMissing
  const oldMissingRelease = new Promise((resolveRelease) => { releaseOldMissing = resolveRelease })
  const oldMissingCaptured = new Promise((resolveCaptured) => { notifyOldMissing = resolveCaptured })
  releasePendingResponse = releaseOldMissing
  rmSync(stylesheetFile)
  await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
    const response = await route.fetch()
    assert.equal(response.status(), 404)
    notifyOldMissing()
    await oldMissingRelease
    await route.fulfill({ response })
  })
  await compare.click()
  await Promise.race([oldMissingCaptured, delay(15000).then(() => { throw new Error('Older missing-source comparison response was not captured.') })])
  writeFileSync(stylesheetFile, previewSourceBase)
  await showFonts()
  const restoredFontObservation = await refreshFont()
  assert.equal(restoredFontObservation.revision, sha(previewSourceBase))
  const beforeOldMissingRelease = effects()
  const olderMissingResponse = waitForResponse((item) => stylesheetGet(item) && item.status() === 404)
  releaseOldMissing()
  await olderMissingResponse
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  releasePendingResponse = null
  await showCode()
  await expect(literalPreview).toHaveAttribute('data-freshness', 'current')
  await expect(previewCurrentRevision).toHaveText(sha(previewSourceBase))
  await expect(fontRevision).toHaveAttribute('data-revision', sha(previewSourceBase))
  await expect(save).toBeEnabled()
  await expect(page.locator('#source-availability')).toBeHidden()
  await expect(prepareReplacement).toBeDisabled()
  await expect(reviewStatus).toContainText('superseded')
  assert.deepEqual(await editorBinding(), beforeOldMissingBinding)
  assert.equal(posts.length + fontPosts.length, beforeOldMissingMutations)
  assert.deepEqual(effects(), beforeOldMissingRelease)
  checks.push('A delayed comparison404 cannot replace a newer positive font-source observation after restoring identical source bytes: raw and preview remain available/current at the restored hash, the old comparison is superseded, and draft/base/approval and disk inventories remain unchanged.')

  await confirmation.fill('SAVE LOCAL CHANGE')
  let releaseRawNoop, notifyRawNoop
  const rawNoopRelease = new Promise((resolveRelease) => { releaseRawNoop = resolveRelease })
  const rawNoopCaptured = new Promise((resolveCaptured) => { notifyRawNoop = resolveCaptured })
  releasePendingResponse = releaseRawNoop
  await page.route('**/api/builder/source', async (route) => {
    posts.push(route.request().postDataJSON())
    const response = await route.fetch()
    notifyRawNoop()
    await rawNoopRelease
    await route.fulfill({ response })
  })
  await save.click()
  await Promise.race([rawNoopCaptured, delay(15000).then(() => { throw new Error('Raw no-op save response was not captured.') })])
  const observedAfterRawNoop = previewSourceBase + '/* Source advanced while raw no-op response is held. */\n'
  writeFileSync(stylesheetFile, observedAfterRawNoop)
  await showFonts()
  const fontObservesNewSource = await refreshFont()
  assert.equal(fontObservesNewSource.revision, sha(observedAfterRawNoop))
  await expect(literalPreview).toHaveAttribute('data-freshness', 'changed')
  await expect(previewCurrentRevision).toHaveText(sha(observedAfterRawNoop))
  const beforeRawNoopRelease = effects()
  const completedRawNoop = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/source'))
  releaseRawNoop()
  const rawNoopBody = await (await completedRawNoop).json()
  await page.unroute('**/api/builder/source')
  releasePendingResponse = null
  assert.equal(rawNoopBody.status, 'unchanged')
  assert.equal(rawNoopBody.revision, sha(previewSourceBase))
  await expect(save).toBeEnabled()
  await showCode()
  await expect(revision).toHaveAttribute('data-revision', sha(previewSourceBase))
  await expect(literalPreview).toHaveAttribute('data-freshness', 'changed')
  await expect(previewCurrentRevision).toHaveText(sha(observedAfterRawNoop))
  await expect(fontRevision).toHaveAttribute('data-revision', sha(observedAfterRawNoop))
  assert.equal(await previewText.textContent(), previewSourceBase)
  assert.deepEqual(effects(), beforeRawNoopRelease)
  checks.push('An accepted raw no-op receipt delayed behind a newer font-source GET retains its own accepted baseline but cannot downgrade the preview, font baseline or latest known source to the older receipt revision; no-op and response release create no backup or write.')

  const advancedPreviewSource = observedAfterRawNoop + '/* Another source advance checked explicitly. */\n'
  writeFileSync(stylesheetFile, advancedPreviewSource)
  const beforeAdvancedCheck = effects(), beforeCheckMutations = posts.length + fontPosts.length
  const checkedAdvanced = waitForResponse(stylesheetGet)
  await checkPreview.click()
  assert.equal((await checkedAdvanced).status(), 200)
  await expect(literalPreview).toHaveAttribute('data-freshness', 'changed')
  await expect(previewCurrentRevision).toHaveText(sha(advancedPreviewSource))
  await expect(previewBaseRevision).toHaveText(sha(previewSourceBase))
  const editedPreviewDraft = previewSourceBase + '/* New raw draft after immutable preview capture. */\n'
  await editor.fill(editedPreviewDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  await expect(literalPreview).toHaveAttribute('data-edited', 'true')
  await expect(checkPreview).toBeEnabled()
  assert.equal(await previewText.textContent(), previewSourceBase)
  await expect(previewDigest).toHaveText(sha(previewSourceBase))
  await expect(revision).toHaveAttribute('data-revision', sha(previewSourceBase))
  assert.equal(posts.length + fontPosts.length, beforeCheckMutations)
  assert.deepEqual(effects(), beforeAdvancedCheck)
  checks.push('Explicit Check source reports an advanced real source revision while keeping the preview baseline and captured text; subsequent same-path typing marks the immutable snapshot edited without changing its digest, rebasing the editor or writing source.')

  const boundaryPrefix = 'x'.repeat(19999) + '🌈'
  const boundaryDraft = boundaryPrefix + 'y'.repeat(500000 - boundaryPrefix.length)
  await editor.fill(boundaryDraft)
  const beforeBoundaryPreview = effects(), boundaryMutations = posts.length + fontPosts.length
  await capturePreview()
  assert.equal(await previewText.textContent(), 'x'.repeat(19999))
  await expect(previewSummary).toContainText('500000 UTF-16 units captured')
  await expect(previewSummary).toContainText('19999 displayed')
  await expect(previewSummary).toContainText('480001 omitted')
  const boundaryReads = sourceReads.length
  await editor.fill(boundaryDraft + 'z')
  await previewButton.click()
  await expect(output).toContainText('500000')
  await expect(output).toContainText(/exceeds/i)
  assert.equal(sourceReads.length, boundaryReads)
  await expect(previewDigest).toHaveText(sha(boundaryDraft))
  assert.equal(await previewText.textContent(), 'x'.repeat(19999))
  assert.equal(posts.length + fontPosts.length, boundaryMutations)
  assert.deepEqual(effects(), beforeBoundaryPreview)
  checks.push('The inclusive500000-unit preview budget hashes the complete draft while a20000-unit display boundary avoids splitting a surrogate pair and reports omissions; one extra unit refuses recapture before any GET and preserves the prior snapshot and all disk effects.')

  await editor.fill(editedPreviewDraft)
  for (const mode of ['draft', 'selection', 'close']) {
    await capturePreview()
    const snapshotText = await previewText.textContent(), snapshotDigest = await previewDigest.textContent()
    const unseenSource = readFileSync(stylesheetFile, 'utf8') + `/* New source behind invalidated ${mode} check. */\n`
    writeFileSync(stylesheetFile, unseenSource)
    const beforeInvalidatedCheck = effects(), beforeInvalidatedMutations = posts.length + fontPosts.length
    let releasePreview, notifyPreview, notifyPreviewDone
    const previewRelease = new Promise((resolveRelease) => { releasePreview = resolveRelease })
    const previewCaptured = new Promise((resolveCaptured) => { notifyPreview = resolveCaptured })
    const previewDone = new Promise((resolveDone) => { notifyPreviewDone = resolveDone })
    releasePendingResponse = releasePreview
    await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
      try {
        const response = await route.fetch()
        notifyPreview()
        await previewRelease
        await route.fulfill({ response })
      } catch { /* These checks deliberately abort their own pending GET. */ }
      finally { notifyPreviewDone() }
    })
    await checkPreview.click()
    await Promise.race([previewCaptured, delay(15000).then(() => { throw new Error('Preview check was not captured.') })])
    if (mode === 'draft') await editor.fill(editedPreviewDraft + '/* New input invalidates the pending observation. */\n')
    if (mode === 'selection') await file.selectOption(secondPath)
    if (mode === 'close') await closePreview.click()
    releasePreview()
    await Promise.race([previewDone, delay(15000).then(() => { throw new Error('Invalidated preview request did not finish.') })])
    await page.unroute('**/api/builder/source?path=src%2Findex.css')
    releasePendingResponse = null
    if (mode === 'close') await expect(literalPreview).toBeHidden()
    else {
      assert.equal(await previewText.textContent(), snapshotText)
      assert.equal(await previewDigest.textContent(), snapshotDigest)
      await expect(literalPreview).toHaveAttribute('data-freshness', 'unknown')
      await expect(previewCurrentRevision).toHaveText('Unknown')
    }
    if (mode === 'selection') { await expect(checkPreview).toBeDisabled(); await file.selectOption(stylesheetPath); await expect(checkPreview).toBeEnabled() }
    if (mode === 'draft') await expect(literalPreview).toHaveAttribute('data-edited', 'true')
    await expect(revision).toHaveAttribute('data-revision', sha(previewSourceBase))
    assert.equal(posts.length + fontPosts.length, beforeInvalidatedMutations)
    assert.deepEqual(effects(), beforeInvalidatedCheck)
  }
  checks.push('New input, a different selected file and Close each invalidate a held preview GET; late responses cannot change captured text/digest, promote an unseen current revision, resurrect a closed preview or write source. Returning to the captured path permits an explicit retry.')

  await capturePreview()
  const retainedPreviewText = await previewText.textContent(), retainedPreviewDigest = await previewDigest.textContent(), retainedPreviewBinding = await editorBinding()
  const beforePreviewError = effects(), beforePreviewErrorMutations = posts.length + fontPosts.length
  await page.route('**/api/builder/source?path=src%2Findex.css', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned literal preview read unavailable"}' }))
  const failedPreviewRead = waitForResponse((item) => stylesheetGet(item) && item.status() === 503)
  await checkPreview.click()
  await failedPreviewRead
  await expect(literalPreview).toHaveAttribute('data-freshness', 'unknown')
  await expect(previewStatus).toContainText('Owned literal preview read unavailable')
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  assert.equal(await previewText.textContent(), retainedPreviewText)
  await expect(previewDigest).toHaveText(retainedPreviewDigest)
  assert.deepEqual(await editorBinding(), retainedPreviewBinding)
  assert.deepEqual(effects(), beforePreviewError)
  rmSync(stylesheetFile)
  const beforePreviewMissing = effects()
  const missingPreviewRead = waitForResponse(stylesheetGet)
  await checkPreview.click()
  const missingPreviewResponse = await missingPreviewRead
  assert.equal(missingPreviewResponse.status(), 404)
  assert.deepEqual(await missingPreviewResponse.json(), unavailableBody)
  await expect(literalPreview).toHaveAttribute('data-freshness', 'unavailable')
  assert.equal(await previewText.textContent(), retainedPreviewText)
  await expect(previewDigest).toHaveText(retainedPreviewDigest)
  assert.deepEqual(await editorBinding(), retainedPreviewBinding)
  assert.equal(posts.length + fontPosts.length, beforePreviewErrorMutations)
  assert.deepEqual(effects(), beforePreviewMissing)
  assert.equal(existsSync(stylesheetFile), false)
  await literalPreview.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('literal-preview-unavailable-source', ['#panel-source', '#source-draft-preview', '#source-draft-preview dl', '#source-draft-preview dd', '#source-draft-preview-text', '#source-draft-preview-status', '#check-source-draft-preview', '#close-source-draft-preview'], ['#source-draft-preview dd'])
  await literalPreview.screenshot({ path: join(evidence, '14-literal-preview-unavailable-retained-snapshot.png') })
  checks.push('Failed preview freshness reads distinguish503 Unknown from actual404 Unavailable, retaining the exact literal snapshot/digest and raw draft/base/approval without POST, backup, log, temp or missing-source recreation effects.')

  const beforeCancelledReload = await editorBinding(), cancelledSnapshot = await previewText.textContent()
  page.once('dialog', (dialog) => dialog.dismiss())
  await reload.click()
  await expect(output).toContainText('Reload cancelled')
  assert.deepEqual(await editorBinding(), beforeCancelledReload)
  assert.equal(await previewText.textContent(), cancelledSnapshot)
  const restoredPreviewSource = previewSourceBase + '/* Source restored before explicit operator reload. */\n'
  writeFileSync(stylesheetFile, restoredPreviewSource)
  const beforeExplicitReload = effects()
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toHaveValue(restoredPreviewSource)
  await expect(revision).toHaveAttribute('data-revision', sha(restoredPreviewSource))
  await expect(confirmation).toHaveValue('')
  await expect(previewBaseRevision).toHaveText(sha(previewSourceBase))
  assert.equal(await previewText.textContent(), cancelledSnapshot)
  await expect(previewStatus).toContainText('Loaded baseline changed')
  assert.deepEqual(effects(), beforeExplicitReload)
  await closePreview.click()
  await expect(literalPreview).toBeHidden()
  await expect(editor).toHaveValue(restoredPreviewSource)
  await expect(revision).toHaveAttribute('data-revision', sha(restoredPreviewSource))
  assert.deepEqual(effects(), beforeExplicitReload)
  checks.push('Cancel Reload retains both raw and preview bindings; only confirmed explicit Reload replaces the raw draft/base and clears its approval, while the old literal snapshot remains marked with its original baseline until Close removes the preview without a write.')

  const workspaceId = (await (await inventoryResponse).json()).repository.workspaceId
  assert.match(workspaceId, /^[0-9a-f]{64}$/)
  const recoveryKey = `systemx.lan.source-recovery.v1.${workspaceId}`
  const unrelatedStorageKey = 'isolated-source-recovery-unrelated'
  const recoveryPanel = page.locator('#source-recovery'), recoveryOptIn = page.locator('#source-recovery-opt-in')
  const storeRecovery = page.locator('#store-source-recovery'), reviewRecovery = page.locator('#review-source-recovery')
  const restoreRecovery = page.locator('#restore-source-recovery'), discardRecovery = page.locator('#discard-source-recovery')
  const recoveryStatus = page.locator('#source-recovery-status'), recoveryExcerpt = page.locator('#source-recovery-draft')
  const storedRecovery = () => page.evaluate((key) => localStorage.getItem(key), recoveryKey)
  const putRecovery = (serialized) => page.evaluate(({ key, serialized }) => localStorage.setItem(key, serialized), { key: recoveryKey, serialized })
  const storeExplicitRecovery = async () => {
    const acceptReplacement = (dialog) => dialog.accept()
    page.on('dialog', acceptReplacement)
    try { await storeRecovery.click(); await expect(recoveryPanel).toHaveAttribute('data-state', 'stored') }
    finally { page.off('dialog', acceptReplacement) }
    const serialized = await storedRecovery()
    assert.ok(serialized)
    const record = JSON.parse(serialized)
    assert.equal(record.draftDisplay, await editor.inputValue())
    assert.equal(record.baseRevision, await revision.getAttribute('data-revision'))
    return { record, serialized }
  }
  const reviewExplicitRecovery = async (stateName) => {
    const response = waitForResponse(stylesheetGet)
    await reviewRecovery.click()
    assert.equal((await response).status(), 200)
    await expect(recoveryPanel).toHaveAttribute('data-state', stateName)
    await expect(restoreRecovery).toBeEnabled()
  }
  const recoveryBaseline = '\uFEFF/* Recovery baseline — café 🌈 */\r\n:root { --wtl-font-family: "Fixture Sans", system-ui; }\r\nbody { font-family: var(--wtl-font-family); }\r\n'
  const recoveryDisplayBaseline = recoveryBaseline.replaceAll('\r\n', '\n')
  const recoveryDraft = recoveryDisplayBaseline + '/* Explicit saved draft <img data-recovery-probe src="https://recovery.invalid/probe"> */\n'
  writeFileSync(stylesheetFile, recoveryBaseline)
  await reload.click()
  await expect(editor).toHaveValue(recoveryDisplayBaseline)
  await expect(revision).toHaveAttribute('data-revision', sha(recoveryBaseline))
  await expect(recoveryOptIn).not.toBeChecked()
  assert.equal(await storedRecovery(), null)
  await editor.fill(recoveryDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  await expect(storeRecovery).toBeDisabled()
  assert.equal(await storedRecovery(), null)
  await page.evaluate((key) => localStorage.setItem(key, 'keep this unrelated fixture value'), unrelatedStorageKey)
  await recoveryOptIn.check()
  assert.equal(await storedRecovery(), null, 'Opting in alone must not capture source text')
  const beforeRecoveryStore = effects(), storeReads = sourceReads.length, storeMutations = posts.length + fontPosts.length
  const savedRecovery = await storeExplicitRecovery()
  assert.deepEqual(Object.keys(savedRecovery.record).sort(), ['schemaVersion', 'workspaceId', 'path', 'baseRevision', 'baselineContent', 'draftDisplay', 'draftDigest', 'storedAt'].sort())
  assert.equal(savedRecovery.record.schemaVersion, 1)
  assert.equal(savedRecovery.record.workspaceId, workspaceId)
  assert.equal(savedRecovery.record.path, stylesheetPath)
  assert.equal(savedRecovery.record.baselineContent, recoveryBaseline)
  assert.equal(savedRecovery.record.baseRevision, sha(recoveryBaseline))
  assert.equal(savedRecovery.record.draftDisplay, recoveryDraft)
  assert.equal(savedRecovery.record.draftDigest, sha(recoveryDraft))
  assert.ok(savedRecovery.serialized.length <= 2100000)
  assert.equal(new Date(savedRecovery.record.storedAt).toISOString(), savedRecovery.record.storedAt)
  await editor.fill(recoveryDraft + '/* New typing does not replace the explicit slot. */\n')
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  assert.equal(sourceReads.length, storeReads)
  assert.equal(posts.length + fontPosts.length, storeMutations)
  assert.deepEqual(effects(), beforeRecoveryStore)
  checks.push('Recovery defaults off and never captures on typing or opting in alone; explicit Store records only the scoped relative path, exact raw baseline and LF draft with independent hashes, leaving approval/token authority and source effects out of storage.')

  const beforeRecoveryReload = effects()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await showCode()
  // Startup font reads are independent source observations. Let that known
  // workflow finish before testing an intentionally stable recovery offer.
  await expect(fontRevision).toHaveAttribute('data-revision', sha(recoveryBaseline))
  await expect(recoveryOptIn).toBeChecked()
  await expect(recoveryPanel).toHaveAttribute('data-state', 'stored')
  await expect(editor).toHaveValue('')
  await expect(restoreRecovery).toBeDisabled()
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  await reviewExplicitRecovery('matching')
  await expect(editor).toHaveValue('')
  await expect(page.locator('#source-recovery-base-revision')).toHaveText(sha(recoveryBaseline))
  await expect(page.locator('#source-recovery-current-revision')).toHaveText(sha(recoveryBaseline))
  assert.equal(await recoveryExcerpt.textContent(), recoveryDraft)
  await expect(recoveryPanel.locator('img, script, iframe')).toHaveCount(0)
  await recoveryPanel.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('recovery-matching-snapshot', ['#panel-source', '#source-recovery', '#source-recovery dd', '#source-recovery-draft', '#restore-source-recovery'], ['#source-recovery dd'])
  await recoveryPanel.screenshot({ path: join(evidence, '15-recovery-matching-revision-and-explicit-restore.png') })
  const beforeRestoreCancel = await editorBinding()
  page.once('dialog', (dialog) => dialog.dismiss())
  await restoreRecovery.click()
  assert.deepEqual(await editorBinding(), beforeRestoreCancel)
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  await confirmation.fill('SAVE LOCAL CHANGE')
  page.once('dialog', (dialog) => dialog.accept())
  await restoreRecovery.click()
  await expect(editor).toHaveValue(recoveryDraft)
  await expect(file).toHaveValue(stylesheetPath)
  await expect(revision).toHaveAttribute('data-revision', sha(recoveryBaseline))
  await expect(confirmation).toHaveValue('')
  await expect(save).toHaveText('Save')
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  assert.deepEqual(effects(), beforeRecoveryReload)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const recoveredWrite = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/source'))
  await save.click()
  const recoveredResponse = await recoveredWrite
  assert.equal(recoveredResponse.status(), 200)
  const recoveredResult = await recoveredResponse.json(), recoveredWireContent = recoveryDraft.replaceAll('\n', '\r\n')
  assert.equal(posts.at(-1).baseRevision, sha(recoveryBaseline))
  assert.equal(posts.at(-1).content, recoveredWireContent)
  assert.equal(recoveredResult.revision, sha(recoveredWireContent))
  assert.equal(readFileSync(stylesheetFile, 'utf8'), recoveredWireContent)
  assert.equal(readFileSync(join(fixture, recoveredResult.backup), 'utf8'), recoveryBaseline)
  await expect(save).toBeEnabled()
  await showCode()
  assert.equal(await storedRecovery(), savedRecovery.serialized, 'A successful Save must not silently update the manual recovery slot')
  checks.push('Same-origin reload offers stored recovery metadata without auto-loading a draft; fresh matching GET and explicit Restore support Cancel, clear prior save approval, retain the original BOM/CRLF baseline, and only a separately confirmed Save writes exact CRLF with the predecessor backup.')

  const staleRecoverySource = recoveredWireContent + '/* External source after the recovered save. */\r\n'
  writeFileSync(stylesheetFile, staleRecoverySource)
  const newerRecoveryLiveDraft = recoveryDraft + '/* Independent live draft before stale recovery. */\n'
  await editor.fill(newerRecoveryLiveDraft)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const beforeStaleReview = effects(), liveBeforeStaleReview = await editorBinding()
  await reviewExplicitRecovery('stale')
  assert.deepEqual(await editorBinding(), liveBeforeStaleReview)
  await expect(page.locator('#source-recovery-base-revision')).toHaveText(sha(recoveryBaseline))
  await expect(page.locator('#source-recovery-current-revision')).toHaveText(sha(staleRecoverySource))
  page.once('dialog', (dialog) => dialog.dismiss())
  await restoreRecovery.click()
  assert.deepEqual(await editorBinding(), liveBeforeStaleReview)
  page.once('dialog', (dialog) => dialog.accept())
  await restoreRecovery.click()
  await expect(editor).toHaveValue(recoveryDraft)
  await expect(revision).toHaveAttribute('data-revision', sha(recoveryBaseline))
  await expect(confirmation).toHaveValue('')
  await confirmation.fill('SAVE LOCAL CHANGE')
  const staleRecoveryWrite = waitForResponse((item) => item.request().method() === 'POST' && item.url().endsWith('/api/builder/source'))
  await save.click()
  const staleRecoveryResponse = await staleRecoveryWrite
  assert.equal(staleRecoveryResponse.status(), 409)
  assert.equal((await staleRecoveryResponse.json()).currentRevision, sha(staleRecoverySource))
  assert.equal(posts.at(-1).baseRevision, sha(recoveryBaseline))
  assert.equal(posts.at(-1).content, recoveredWireContent)
  await expect(editor).toHaveValue(recoveryDraft)
  assert.deepEqual(effects(), beforeStaleReview)
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  checks.push('Stale recovery explicitly keeps the saved older baseline rather than rebasing onto the observed source; review and Cancel preserve the independent live draft, accepted Restore clears approval, and a later normal Save still returns409 without effects.')

  const invalidRecords = [
    ['malformed JSON', '{not-json'],
    ['future schema', JSON.stringify({ ...savedRecovery.record, schemaVersion: 2 })],
    ['unsupported authority field', JSON.stringify({ ...savedRecovery.record, confirmation: 'SAVE LOCAL CHANGE' })],
    ['foreign checkout', JSON.stringify({ ...savedRecovery.record, workspaceId: 'f'.repeat(64) })],
    ['traversing path', JSON.stringify({ ...savedRecovery.record, path: '../src/index.css' })],
    ['different raw bytes', JSON.stringify({ ...savedRecovery.record, baselineContent: recoveryBaseline + 'tampered' })],
    ['wrong baseline digest', JSON.stringify({ ...savedRecovery.record, baseRevision: sha('unrelated baseline') })],
    ['wrong draft digest', JSON.stringify({ ...savedRecovery.record, draftDigest: sha('unrelated draft') })],
    ['CR display text', JSON.stringify({ ...savedRecovery.record, draftDisplay: recoveryDraft + '\r', draftDigest: sha(recoveryDraft + '\r') })],
    ['oversized draft', JSON.stringify({ ...savedRecovery.record, draftDisplay: 'x'.repeat(500001), draftDigest: sha('x'.repeat(500001)) })],
    ['screened private marker', JSON.stringify({ ...savedRecovery.record, draftDisplay: 'const secret = "synthetic-private-marker"', draftDigest: sha('const secret = "synthetic-private-marker"') })],
  ]
  const escapedBaseline = '\u0007'.repeat(351000)
  const oversizedSerializedRecord = JSON.stringify({ ...savedRecovery.record, baselineContent: escapedBaseline, baseRevision: sha(escapedBaseline) })
  assert.ok(oversizedSerializedRecord.length > 2100000)
  invalidRecords.push(['oversized serialized record', oversizedSerializedRecord])
  const beforeInvalidRecovery = effects(), invalidLiveBinding = await editorBinding(), invalidMutations = posts.length + fontPosts.length
  for (const [name, serialized] of invalidRecords) {
    await putRecovery(serialized)
    const readsBefore = sourceReads.length
    await reviewRecovery.click()
    await expect(recoveryPanel).toHaveAttribute('data-state', /^(invalid|unknown)$/)
    await expect(restoreRecovery).toBeDisabled()
    assert.equal(sourceReads.length, readsBefore, `${name}: reject invalid stored data before reading source`)
    assert.equal(await storedRecovery(), serialized, `${name}: invalid data remains explicitly discardable`)
    assert.deepEqual(await editorBinding(), invalidLiveBinding)
    assert.deepEqual(effects(), beforeInvalidRecovery)
  }
  assert.equal(posts.length + fontPosts.length, invalidMutations)
  await putRecovery(savedRecovery.serialized)
  await reviewExplicitRecovery('stale')
  checks.push('Malformed, future, authority-bearing, foreign-workspace, unsafe-path, tampered-hash/text, CR-display, oversized and screened-private recovery records never reach a source GET or enable Restore; the live editor and exact stored slot remain intact and discardable.')

  const beforeRecoveryReadFailure = effects(), recoveryFailureBinding = await editorBinding()
  await page.route('**/api/builder/source?path=src%2Findex.css', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned recovery read unavailable"}' }))
  const failedRecoveryRead = waitForResponse((item) => stylesheetGet(item) && item.status() === 503)
  await reviewRecovery.click()
  await failedRecoveryRead
  await expect(recoveryPanel).toHaveAttribute('data-state', 'unknown')
  await expect(restoreRecovery).toBeDisabled()
  assert.deepEqual(await editorBinding(), recoveryFailureBinding)
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  assert.deepEqual(effects(), beforeRecoveryReadFailure)
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  rmSync(stylesheetFile)
  const beforeMissingRecoveryRead = effects()
  const missingRecoveryRead = waitForResponse(stylesheetGet)
  await reviewRecovery.click()
  const missingRecoveryResponse = await missingRecoveryRead
  assert.equal(missingRecoveryResponse.status(), 404)
  assert.deepEqual(await missingRecoveryResponse.json(), unavailableBody)
  await expect(recoveryPanel).toHaveAttribute('data-state', 'unavailable')
  await expect(restoreRecovery).toBeDisabled()
  assert.deepEqual(await editorBinding(), recoveryFailureBinding)
  assert.equal(await storedRecovery(), savedRecovery.serialized)
  assert.deepEqual(effects(), beforeMissingRecoveryRead)
  assert.equal(existsSync(stylesheetFile), false)
  writeFileSync(stylesheetFile, staleRecoverySource)
  checks.push('Recovery review distinguishes an unconfirmed503 read from actual404 unavailable source; neither offers Restore, changes the saved slot or live editor, creates effects, or recreates the missing file.')

  const beforeRecoveryRemoval = effects(), bindingBeforeRemoval = await editorBinding()
  await recoveryOptIn.uncheck()
  await expect(recoveryOptIn).not.toBeChecked()
  await expect(storeRecovery).toBeDisabled()
  await expect(restoreRecovery).toBeDisabled()
  assert.equal(await storedRecovery(), null)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), unrelatedStorageKey), 'keep this unrelated fixture value')
  assert.deepEqual(await editorBinding(), bindingBeforeRemoval)
  await recoveryOptIn.check()
  await storeExplicitRecovery()
  await discardRecovery.click()
  assert.equal(await storedRecovery(), null)
  await expect(restoreRecovery).toBeDisabled()
  assert.deepEqual(await editorBinding(), bindingBeforeRemoval)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), unrelatedStorageKey), 'keep this unrelated fixture value')
  assert.deepEqual(effects(), beforeRecoveryRemoval)
  checks.push('Opting out and explicit Discard remove only the checkout-scoped recovery slot, invalidate restoration authority and preserve the raw draft/base/approval, unrelated browser storage and every repository effect.')

  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(revision).toHaveAttribute('data-revision', sha(staleRecoverySource))
  const safeStorageDraft = staleRecoverySource.replaceAll('\r\n', '\n') + '/* Safe storage refusal fixture. */\n'
  await editor.fill(safeStorageDraft)
  const safeRecovery = await storeExplicitRecovery()
  const beforeStorageRefusal = effects(), storageRefusalMutations = posts.length + fontPosts.length
  for (const rejectedDraft of ['x'.repeat(500001), 'const secret = "synthetic-private-marker"']) {
    await editor.fill(rejectedDraft)
    await storeRecovery.click()
    await expect(recoveryPanel).toHaveAttribute('data-state', 'invalid')
    await expect(recoveryStatus).toContainText('not stored')
    await expect(recoveryStatus).not.toContainText('synthetic-private-marker')
    assert.equal(await storedRecovery(), safeRecovery.serialized)
    await expect(editor).toHaveValue(rejectedDraft)
    assert.deepEqual(effects(), beforeStorageRefusal)
  }
  await editor.fill(safeStorageDraft)
  await page.evaluate((key) => {
    const prototype = globalThis.Storage.prototype
    globalThis.__recoveryOriginalSetItem = prototype.setItem
    prototype.setItem = function (name, value) {
      if (name === key) throw new globalThis.DOMException('Owned quota refusal fixture', 'QuotaExceededError')
      return globalThis.__recoveryOriginalSetItem.call(this, name, value)
    }
  }, recoveryKey)
  try {
    await storeRecovery.click()
    await expect(recoveryPanel).toHaveAttribute('data-state', 'invalid')
    await expect(recoveryStatus).toContainText('not stored')
    await expect(editor).toHaveValue(safeStorageDraft)
  } finally {
    await page.evaluate(() => { globalThis.Storage.prototype.setItem = globalThis.__recoveryOriginalSetItem; delete globalThis.__recoveryOriginalSetItem })
  }
  assert.equal(await storedRecovery(), safeRecovery.serialized)
  await page.evaluate((key) => {
    const prototype = globalThis.Storage.prototype
    globalThis.__recoveryOriginalGetItem = prototype.getItem
    prototype.getItem = function (name) {
      if (name === key) throw new globalThis.DOMException('Owned storage read refusal fixture', 'SecurityError')
      return globalThis.__recoveryOriginalGetItem.call(this, name)
    }
  }, recoveryKey)
  try {
    const readsBefore = sourceReads.length
    await reviewRecovery.click()
    await expect(recoveryPanel).toHaveAttribute('data-state', 'invalid')
    await expect(restoreRecovery).toBeDisabled()
    assert.equal(sourceReads.length, readsBefore)
  } finally {
    await page.evaluate(() => { globalThis.Storage.prototype.getItem = globalThis.__recoveryOriginalGetItem; delete globalThis.__recoveryOriginalGetItem })
  }
  assert.equal(await storedRecovery(), safeRecovery.serialized)
  assert.equal(posts.length + fontPosts.length, storageRefusalMutations)
  assert.deepEqual(effects(), beforeStorageRefusal)
  checks.push('Oversized or screened-private Store requests and targeted quota/read-denied browser storage failures preserve the previous explicit slot and current in-memory draft, reveal bounded refusal feedback without private marker values, and create no source or fallback-storage effects.')

  const recoveryBoundaryPrefix = 'x'.repeat(19999) + '🌈'
  const recoveryBoundaryDraft = recoveryBoundaryPrefix + 'y'.repeat(500000 - recoveryBoundaryPrefix.length)
  await editor.fill(recoveryBoundaryDraft)
  const beforeRecoveryBoundary = effects()
  const boundaryRecovery = await storeExplicitRecovery()
  assert.equal(boundaryRecovery.record.draftDisplay.length, 500000)
  assert.equal(boundaryRecovery.record.draftDigest, sha(recoveryBoundaryDraft))
  assert.equal(await recoveryExcerpt.textContent(), 'x'.repeat(19999), 'Recovery excerpts must not end with one half of an emoji')
  await expect(page.locator('#source-recovery-summary')).toContainText('480001')
  assert.deepEqual(effects(), beforeRecoveryBoundary)
  await editor.fill(safeStorageDraft)
  await storeExplicitRecovery()
  checks.push('An explicit500000-unit recovery slot retains the complete LF draft and independent digest while its20000-unit visible excerpt avoids splitting a surrogate pair and reports the true omitted count; replacement remains an explicit Store decision.')

  const beforeRecoveryRaces = effects()
  for (const mode of ['edit', 'selection', 'discard', 'off', 'observation']) {
    if (!await recoveryOptIn.isChecked()) await recoveryOptIn.check()
    if (await storedRecovery() === null) await storeExplicitRecovery()
    const recordBeforeRace = await storedRecovery(), bindingBeforeRace = await editorBinding()
    let releaseRecovery, notifyRecovery, notifyRecoveryDone
    const recoveryRelease = new Promise((resolveRelease) => { releaseRecovery = resolveRelease })
    const recoveryCaptured = new Promise((resolveCaptured) => { notifyRecovery = resolveCaptured })
    const recoveryDone = new Promise((resolveDone) => { notifyRecoveryDone = resolveDone })
    let heldRecoveryRequest
    const recoveryRequestTerminal = new Promise((resolveTerminal, rejectTerminal) => {
      const cleanup = () => {
        clearTimeout(deadline)
        page.off('requestfinished', finished)
        page.off('requestfailed', failed)
      }
      const complete = (event) => (request) => {
        if (request !== heldRecoveryRequest) return
        cleanup()
        resolveTerminal(event)
      }
      const finished = complete('requestfinished'), failed = complete('requestfailed')
      const deadline = setTimeout(() => { cleanup(); rejectTerminal(new Error('Held recovery request did not reach a browser terminal event.')) }, 15000)
      page.on('requestfinished', finished)
      page.on('requestfailed', failed)
    })
    void recoveryRequestTerminal.catch(() => {})
    releasePendingResponse = releaseRecovery
    await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
      heldRecoveryRequest = route.request()
      try {
        const response = await route.fetch()
        notifyRecovery()
        await recoveryRelease
        await route.fulfill({ response })
      } catch { /* The tested editor/forget actions deliberately abort this owned read. */ }
      finally { notifyRecoveryDone() }
    })
    await reviewRecovery.click()
    await Promise.race([recoveryCaptured, delay(15000).then(() => { throw new Error('Recovery review did not reach its held GET fixture.') })])
    if (mode === 'edit') await editor.fill(safeStorageDraft + '/* New input during review. */\n')
    if (mode === 'selection') await file.selectOption(secondPath)
    if (mode === 'discard') await discardRecovery.click()
    if (mode === 'off') await recoveryOptIn.uncheck()
    let expectedRecoveryRaceEffects = beforeRecoveryRaces
    if (mode === 'observation') {
      writeFileSync(stylesheetFile, staleRecoverySource + '/* A newer source observation invalidates recovery review. */\r\n')
      await showFonts()
      await refreshFont()
      await showCode()
      expectedRecoveryRaceEffects = effects()
    }
    const bindingAfterRecoveryAction = { ...await editorBinding(), selectedPath: await file.inputValue() }
    releaseRecovery()
    await Promise.race([recoveryDone, delay(15000).then(() => { throw new Error('Invalidated recovery review did not finish.') })])
    report.recoveryReadTerminals ||= []
    report.recoveryReadTerminals.push({ mode, event: await recoveryRequestTerminal })
    await page.unroute('**/api/builder/source?path=src%2Findex.css')
    releasePendingResponse = null
    await expect(restoreRecovery).toBeDisabled()
    if (mode === 'discard' || mode === 'off') assert.equal(await storedRecovery(), null)
    else assert.equal(await storedRecovery(), recordBeforeRace)
    assert.deepEqual({ ...await editorBinding(), selectedPath: await file.inputValue() }, bindingAfterRecoveryAction, 'A held recovery response must preserve the post-action draft, base, approval and selected path before fixture cleanup')
    if (mode !== 'edit') assert.deepEqual(await editorBinding(), bindingBeforeRace, 'Review invalidation actions must preserve the original draft, base and approval')
    if (mode === 'edit') await editor.fill(safeStorageDraft)
    if (mode === 'selection') await file.selectOption(stylesheetPath)
    assert.deepEqual(effects(), expectedRecoveryRaceEffects)
  }
  checks.push('Editing, changing target, Discard, opting out and a newer real source observation invalidate a held recovery GET; late responses never enable Restore, resurrect a forgotten slot, replace the live draft or create repository effects.')

  const refreshWorkspaceInUi = async () => {
    await page.locator('[data-panel-target="command"]').click()
    const feedback = page.locator('#command-output').evaluate((node) => new Promise((resolveFeedback, rejectFeedback) => {
      const deadline = globalThis.setTimeout(() => { observer.disconnect(); rejectFeedback(new Error('Workspace refresh feedback was not observed.')) }, 15000)
      const observer = new globalThis.MutationObserver(() => {
        if (!node.textContent.includes('Workspace refreshed.')) return
        observer.disconnect(); globalThis.clearTimeout(deadline); resolveFeedback(true)
      })
      observer.observe(node, { childList: true, subtree: true, characterData: true })
    }))
    void feedback.catch(() => {})
    const statusResponse = waitForResponse((item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/status'))
    await page.locator('#refresh-status').click()
    const response = await statusResponse
    assert.equal(response.status(), 200)
    await feedback
    await showCode()
    return response.json()
  }
  await recoveryOptIn.check()
  const beforeIdentitySlot = await storeExplicitRecovery(), beforeIdentityBinding = await editorBinding(), beforeIdentityEffects = effects()
  const foreignWorkspaceId = 'e'.repeat(64)
  assert.notEqual(foreignWorkspaceId, workspaceId)
  let releaseOldWorkspaceRead, notifyOldWorkspaceRead, notifyOldWorkspaceDone
  const oldWorkspaceRelease = new Promise((resolveRelease) => { releaseOldWorkspaceRead = resolveRelease })
  const oldWorkspaceCaptured = new Promise((resolveCaptured) => { notifyOldWorkspaceRead = resolveCaptured })
  const oldWorkspaceDone = new Promise((resolveDone) => { notifyOldWorkspaceDone = resolveDone })
  releasePendingResponse = releaseOldWorkspaceRead
  await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
    try {
      const response = await route.fetch()
      assert.equal((await response.json()).workspaceId, workspaceId)
      notifyOldWorkspaceRead()
      await oldWorkspaceRelease
      await route.fulfill({ response })
    } catch { /* A checkout change may abort the old content request. */ }
    finally { notifyOldWorkspaceDone() }
  })
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await Promise.race([oldWorkspaceCaptured, delay(15000).then(() => { throw new Error('Old-workspace source read was not captured.') })])
  await page.route('**/api/status*', async (route) => {
    const response = await route.fetch(), body = await response.json()
    await route.fulfill({ response, json: { ...body, repository: { ...body.repository, workspaceId: foreignWorkspaceId } } })
  })
  const foreignStatus = await refreshWorkspaceInUi()
  assert.equal(foreignStatus.repository.workspaceId, foreignWorkspaceId)
  await recoveryOptIn.check()
  await expect(storeRecovery).toBeDisabled()
  releaseOldWorkspaceRead()
  await Promise.race([oldWorkspaceDone, delay(15000).then(() => { throw new Error('Old-workspace source read did not finish.') })])
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  releasePendingResponse = null
  await expect(editor).toBeEnabled()
  await expect(storeRecovery).toBeDisabled()
  assert.deepEqual(await editorBinding(), beforeIdentityBinding)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), `systemx.lan.source-recovery.v1.${foreignWorkspaceId}`), null)
  assert.equal(await storedRecovery(), beforeIdentitySlot.serialized)
  assert.deepEqual(effects(), beforeIdentityEffects)
  await page.unroute('**/api/status*')
  const restoredStatus = await refreshWorkspaceInUi()
  assert.equal(restoredStatus.repository.workspaceId, workspaceId)
  const beforeMismatchedResponse = await editorBinding()
  await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
    const response = await route.fetch(), body = await response.json()
    await route.fulfill({ response, json: { ...body, workspaceId: foreignWorkspaceId } })
  })
  const mismatchedContent = waitForResponse(stylesheetGet)
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  assert.equal((await mismatchedContent).status(), 200)
  await expect(editor).toBeEnabled()
  assert.deepEqual(await editorBinding(), beforeMismatchedResponse)
  assert.equal(await storedRecovery(), beforeIdentitySlot.serialized)
  assert.deepEqual(effects(), beforeIdentityEffects)
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  // Returning to the same stable checkout A retains its old A snapshot. A
  // refused B response must never relabel that snapshot or enter either slot.
  const identityReadsBeforeStore = sourceReads.length, identityMutationsBeforeStore = posts.length + fontPosts.length
  await expect(recoveryStatus).toContainText('Source load requested')
  const retainedCheckoutRecovery = await storeExplicitRecovery()
  await expect(recoveryStatus).toContainText('stored explicitly')
  assert.equal(retainedCheckoutRecovery.record.workspaceId, workspaceId)
  assert.equal(retainedCheckoutRecovery.record.path, stylesheetPath)
  assert.equal(retainedCheckoutRecovery.record.path, beforeIdentitySlot.record.path)
  assert.equal(retainedCheckoutRecovery.record.baselineContent, beforeIdentitySlot.record.baselineContent)
  assert.equal(retainedCheckoutRecovery.record.baseRevision, beforeIdentitySlot.record.baseRevision)
  assert.equal(retainedCheckoutRecovery.record.draftDisplay, beforeIdentitySlot.record.draftDisplay)
  assert.equal(retainedCheckoutRecovery.record.draftDigest, beforeIdentitySlot.record.draftDigest)
  assert.equal(sha(retainedCheckoutRecovery.record.baselineContent), retainedCheckoutRecovery.record.baseRevision)
  assert.equal(sha(retainedCheckoutRecovery.record.draftDisplay), retainedCheckoutRecovery.record.draftDigest)
  assert.deepEqual(Object.keys(retainedCheckoutRecovery.record).sort(), Object.keys(beforeIdentitySlot.record).sort())
  assert.equal(new Date(retainedCheckoutRecovery.record.storedAt).toISOString(), retainedCheckoutRecovery.record.storedAt)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), `systemx.lan.source-recovery.v1.${foreignWorkspaceId}`), null)
  assert.equal(sourceReads.length, identityReadsBeforeStore)
  assert.equal(posts.length + fontPosts.length, identityMutationsBeforeStore)
  assert.deepEqual(await editorBinding(), beforeMismatchedResponse)
  assert.deepEqual(effects(), beforeIdentityEffects)
  checks.push('An old checkout response cannot adopt a newer same-origin identity, and wrong-workspace source content is refused. Returning to the same stable checkout A can explicitly Store only its retained exact A path, raw baseline, revision, draft and digest; B stays empty and no source, backup, log or temp effects occur.')

  const exportBaseline = '\uFEFF:root { color: blue; --wtl-font-family: "Fixture Sans", system-ui; } body { font-family: var(--wtl-font-family); }\r\n/* Shared export anchor. */\r\n'
  const exportDraftDisplay = exportBaseline.replaceAll('\r\n', '\n').replace('blue', 'red') + '/* Draft-only export line — café 🌈. */\n'
  const exportDraftWire = exportDraftDisplay.replaceAll('\n', '\r\n')
  const exportCurrent = exportBaseline.replace('blue', 'green') + '/* Current-only export line. */\r\n'
  writeFileSync(stylesheetFile, exportBaseline)
  page.once('dialog', (dialog) => dialog.accept())
  await reload.click()
  await expect(editor).toHaveValue(exportBaseline.replaceAll('\r\n', '\n'))
  await editor.fill(exportDraftDisplay)
  await confirmation.fill('SAVE LOCAL CHANGE')
  const exportRecoverySlot = await storeExplicitRecovery()
  writeFileSync(stylesheetFile, exportCurrent)
  const compareStylesheet = async () => {
    const response = waitForResponse(stylesheetGet)
    await compare.click()
    assert.equal((await response).status(), 200)
    await expect(page.locator('#source-review-current-revision')).toHaveText(sha(readFileSync(stylesheetFile, 'utf8')))
  }
  await compareStylesheet()
  const exportPanel = page.locator('#source-export'), reviewExport = page.locator('#review-source-export')
  const exportScope = page.locator('#source-export-scope'), exportConsent = page.locator('#source-export-confirmation')
  const downloadExport = page.locator('#download-source-export'), cancelExport = page.locator('#cancel-source-export')
  const exportStatus = page.locator('#source-export-status')
  const downloads = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  const reviewExportScope = async () => {
    await reviewExport.click()
    await expect(exportPanel).toHaveAttribute('data-state', 'ready')
    return JSON.parse(await exportScope.textContent())
  }
  const downloadComparison = async (name, scope) => {
    const pending = page.waitForEvent('download')
    void pending.catch(() => {})
    await exportConsent.fill('EXPORT COMPARISON')
    await downloadExport.click()
    const download = await pending, path = join(evidence, name)
    assert.equal(download.suggestedFilename(), 'systemx-source-comparison.json')
    await download.saveAs(path)
    const bytes = readFileSync(path), json = bytes.toString('utf8'), payload = JSON.parse(json)
    assert.equal(scope.jsonCharacters, json.length)
    assert.equal(scope.jsonBytes, bytes.length)
    assert.equal(scope.jsonDigest, sha(bytes))
    assert.ok(json.length <= 2500000)
    assert.deepEqual(Object.keys(payload), ['schemaVersion', 'path', 'loadedRevision', 'currentRevision', 'draftRevision', 'draftContent', 'currentContent', 'comparison'])
    assert.deepEqual(scope.includedFields, Object.keys(payload))
    assert.equal(payload.schemaVersion, 1)
    assert.equal(payload.path, stylesheetPath)
    assert.equal(payload.draftRevision, sha(payload.draftContent))
    assert.equal(payload.currentRevision, sha(payload.currentContent))
    assert.equal(scope.draftCharacters, payload.draftContent.length)
    assert.equal(scope.currentCharacters, payload.currentContent.length)
    assert.deepEqual(scope.comparison, { complete: payload.comparison.complete, truncated: payload.comparison.truncated, counts: payload.comparison.counts, reasons: payload.comparison.reasons })
    assert.ok(payload.draftContent.length <= 500000 && payload.currentContent.length <= 500000)
    assert.ok(payload.comparison.rows.length <= 200)
    assert.ok(payload.comparison.rows.every((row) => row.draftText.length <= 1000 && row.currentText.length <= 1000))
    assert.equal(json.includes(fixture), false)
    report.comparisonDownloads ??= []
    report.comparisonDownloads.push({ file: name, sha256: sha(bytes), jsonCharacters: json.length, jsonBytes: bytes.length, truncated: payload.comparison.truncated })
    return payload
  }
  const beforeExport = effects(), exportBinding = await editorBinding(), exportMutations = posts.length + fontPosts.length, exportReads = sourceReads.length
  const scope = await reviewExportScope()
  assert.equal(scope.path, stylesheetPath)
  assert.equal(scope.loadedRevision, sha(exportBaseline))
  assert.equal(scope.currentRevision, sha(exportCurrent))
  assert.equal(scope.draftRevision, sha(exportDraftWire))
  assert.notEqual(scope.draftRevision, exportRecoverySlot.record.draftDigest, 'Wire CRLF export digest and LF recovery digest have different declared meanings')
  const beforeUnconfirmedDownload = downloads.length
  await downloadExport.click()
  await expect(exportStatus).toContainText('EXPORT COMPARISON')
  assert.equal(downloads.length, beforeUnconfirmedDownload)
  await exportPanel.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('comparison-export-scope', ['#panel-source', '#source-export', '#source-export-scope', '#download-source-export', '#source-export-confirmation'], ['#source-export-scope'])
  await exportPanel.screenshot({ path: join(evidence, '16-confirmed-comparison-export-scope.png') })
  const exportedComparison = await downloadComparison('comparison-export-complete.json', scope)
  assert.equal(exportedComparison.draftContent, exportDraftWire)
  assert.equal(exportedComparison.currentContent, exportCurrent)
  assert.equal(exportedComparison.comparison.complete, true)
  assert.equal(exportedComparison.comparison.truncated, false)
  assert.equal(exportedComparison.comparison.counts.changedRows, 2)
  assert.deepEqual(exportedComparison.comparison.rows.map((row) => [row.draftLine, row.currentLine, row.kind]), [[1, 1, 'replace'], [3, 3, 'replace']])
  assert.ok(exportedComparison.comparison.rows.every((row) => row.draftEnding === 'CRLF' && row.currentEnding === 'CRLF'))
  await expect(exportConsent).toHaveValue('')
  await expect(save).toHaveText('Save')
  assert.deepEqual(await editorBinding(), exportBinding)
  assert.equal(posts.length + fontPosts.length, exportMutations)
  assert.equal(sourceReads.length, exportReads, 'Scope review and confirmed Blob download must not make an additional source request')
  assert.deepEqual(effects(), beforeExport)
  checks.push('A separately confirmed real comparison download exactly matches its declared JSON character/byte counts and digest, relative path, raw baseline/current hashes, complete CRLF draft/current bodies and bounded line DTO; recovery LF digest remains distinct and export grants no save authority or repository effects.')

  await cancelExport.click()
  await expect(exportPanel).toBeHidden()
  assert.deepEqual(await editorBinding(), exportBinding)
  await reviewExportScope()
  await exportConsent.fill('EXPORT COMPARISON')
  await editor.fill(exportDraftDisplay + '/* Edited after export scope review. */\n')
  await expect(exportPanel).toHaveAttribute('data-state', 'stale')
  await expect(exportConsent).toHaveValue('')
  await expect(downloadExport).toBeDisabled()
  await editor.fill(exportDraftDisplay)
  await expect(downloadExport).toBeDisabled()
  await compareStylesheet()
  await reviewExportScope()
  await exportConsent.fill('EXPORT COMPARISON')
  await file.selectOption(secondPath)
  await expect(downloadExport).toBeDisabled()
  await expect(exportConsent).toHaveValue('')
  await file.selectOption(stylesheetPath)
  await expect(downloadExport).toBeDisabled()
  await compareStylesheet()
  await reviewExportScope()
  await exportConsent.fill('EXPORT COMPARISON')
  const observedExportAdvance = exportCurrent + '/* New observation invalidates export inclusion consent. */\r\n'
  writeFileSync(stylesheetFile, observedExportAdvance)
  await showFonts()
  await refreshFont()
  await showCode()
  await expect(exportPanel).toHaveAttribute('data-state', 'stale')
  await expect(exportConsent).toHaveValue('')
  await expect(downloadExport).toBeDisabled()
  assert.deepEqual(await editorBinding(), exportBinding)
  const afterExportAdvance = effects()
  assert.equal(posts.length + fontPosts.length, exportMutations)
  await expect(save).toHaveText('Save')
  checks.push('Cancel export preserves the editor; typing, target changes and a newer real source observation invalidate reviewed export scope and inclusion consent. Returning old text or selection never silently reactivates download, replacement or source-write authority.')

  const clippedExportDraft = exportBaseline.replaceAll('\r\n', '\n') + `/* ${'x'.repeat(1100)} */\n`
  await editor.fill(clippedExportDraft)
  await compareStylesheet()
  await expect(prepareReplacement).toBeDisabled()
  const clippedScope = await reviewExportScope()
  assert.equal(clippedScope.comparison.truncated, true)
  assert.ok(clippedScope.comparison.reasons.length > 0)
  const clippedPayload = await downloadComparison('comparison-export-truncated-view.json', clippedScope)
  assert.equal(clippedPayload.draftContent, clippedExportDraft.replaceAll('\n', '\r\n'))
  assert.equal(clippedPayload.currentContent, observedExportAdvance)
  assert.equal(clippedPayload.comparison.truncated, true)
  assert.ok(clippedPayload.comparison.counts.textTruncatedRows > 0)
  await expect(prepareReplacement).toBeDisabled()
  await expect(save).toHaveText('Save')
  assert.deepEqual(effects(), afterExportAdvance)
  await page.route('**/api/builder/source?path=src%2Findex.css', async (route) => {
    const response = await route.fetch(), body = await response.json()
    await route.fulfill({ response, json: { ...body, revision: sha('mismatched export source text') } })
  })
  const mismatchedExportRead = waitForResponse(stylesheetGet)
  await compare.click()
  assert.equal((await mismatchedExportRead).status(), 200)
  await expect(reviewSummary).toContainText('cannot be reproduced')
  await expect(reviewExport).toBeDisabled()
  await expect(prepareReplacement).toBeDisabled()
  await page.unroute('**/api/builder/source?path=src%2Findex.css')
  assert.deepEqual(effects(), afterExportAdvance)
  assert.equal(posts.length + fontPosts.length, exportMutations)
  checks.push('A truthful truncated comparison can be exported only with its full bounded text and explicit truncation counts/reasons while replacement remains disabled; a valid-looking revision that mismatches current text blocks both export review and replacement without effects.')

  const historyPanel = page.locator('#source-history'), historyRefresh = page.locator('#refresh-source-history')
  const historyList = page.locator('#source-history-list'), historyStatus = page.locator('#source-history-status')
  const historyPath = page.locator('#source-history-path'), historyCurrentRevision = page.locator('#source-history-current-revision')
  const historyResponseFor = (path) => (item) => item.request().method() === 'GET' && new URL(item.url()).pathname.endsWith('/api/builder/source/history') && new URL(item.url()).searchParams.get('path') === path
  const readHistory = async (path = stylesheetPath) => {
    const response = waitForResponse(historyResponseFor(path))
    await historyRefresh.click()
    const result = await response
    assert.equal(result.status(), 200)
    const body = await result.json()
    assert.equal(body.schemaVersion, 1)
    assert.equal(body.workspaceId, workspaceId)
    assert.equal(body.path, path)
    assert.ok(body.entries.length <= 30)
    assert.equal(typeof body.truncated, 'boolean')
    assert.ok(Number.isSafeInteger(body.omittedEntries) && body.omittedEntries >= 0)
    for (const entry of body.entries) {
      assert.ok(['builder-save', 'legacy-builder-operation', 'observed-current', 'observed-change'].includes(entry.kind))
      assert.ok(['source', 'leaf-text', 'font', null].includes(entry.operation))
      for (const key of ['content', 'draftContent', 'baselineContent', 'backup', 'absolutePath', 'root', 'actor', 'sessionToken']) assert.equal(Object.hasOwn(entry, key), false)
      if (entry.kind === 'builder-save') { assert.equal(entry.workspaceBound, true); assert.equal(entry.revisionAvailable, true); assert.equal(entry.attribution, 'recorded-builder-operation'); assert.equal(entry.provenance, 'operation-log') }
      if (entry.kind.startsWith('observed-')) { assert.equal(entry.attribution, 'unattributed'); assert.equal(entry.provenance, 'session-observation'); assert.equal(entry.operation, null) }
    }
    assert.equal(JSON.stringify(body).includes(fixture), false)
    await expect(historyPanel).toHaveAttribute('data-state', 'current')
    await expect(historyPath).toHaveText(path)
    await expect(historyCurrentRevision).toHaveText(body.currentRevision)
    return body
  }
  const operationsFile = join(fixture, '.SYSTEMX/LAN/Temp/operations.jsonl')
  const unboundPrevious = sha('legacy prior fixture bytes'), unboundRevision = sha('legacy changed fixture bytes')
  const legacyRows = [
    JSON.stringify({ event: 'source_saved', timestamp: '2001-01-01T00:00:00.000Z', path: stylesheetPath, previousLines: 1, nextLines: 1, actor: 'untrusted legacy actor' }),
    JSON.stringify({ event: 'font_saved', timestamp: '2002-01-01T00:00:00.000Z', path: stylesheetPath, previousRevision: unboundPrevious, revision: unboundRevision, currentRevision: unboundRevision }),
    '{invalid legacy JSON',
    'x'.repeat(17000),
  ]
  writeFileSync(operationsFile, readFileSync(operationsFile, 'utf8') + legacyRows.join('\n') + '\n')
  const firstHistorySource = observedExportAdvance + '/* Unattributed source at first history read. */\r\n'
  writeFileSync(stylesheetFile, firstHistorySource)
  const beforeHistory = effects(), historyBinding = await editorBinding(), historyMutations = posts.length + fontPosts.length
  const firstHistory = await readHistory()
  assert.equal(firstHistory.currentRevision, sha(firstHistorySource))
  assert.ok(firstHistory.entries.some((entry) => entry.kind === 'builder-save' && entry.operation === 'source' && entry.previousRevision === sha(recoveryBaseline) && entry.revision === recoveredResult.revision))
  assert.ok(firstHistory.entries.some((entry) => entry.kind === 'builder-save' && entry.operation === 'font' && entry.revision === firstFontResult.revision))
  const authoredCount = firstHistory.entries.filter((entry) => entry.kind === 'builder-save').length
  assert.equal(authoredCount, 4, 'Only the three confirmed font changes and recovered raw Save are authored CSS changes')
  assert.ok(firstHistory.entries.some((entry) => entry.kind === 'observed-current' && entry.revision === sha(firstHistorySource) && entry.attribution === 'unattributed'))
  const incompleteLegacy = firstHistory.entries.find((entry) => entry.kind === 'legacy-builder-operation' && entry.revisionAvailable === false)
  assert.ok(incompleteLegacy)
  assert.equal(incompleteLegacy.revision, null)
  assert.equal(incompleteLegacy.previousRevision, null)
  const unboundLegacy = firstHistory.entries.find((entry) => entry.kind === 'legacy-builder-operation' && entry.revision === unboundRevision)
  assert.ok(unboundLegacy)
  assert.equal(unboundLegacy.workspaceBound, false)
  assert.equal(unboundLegacy.revisionAvailable, true)
  assert.equal(unboundLegacy.attribution, 'unattributed')
  await expect(historyList.locator(`[data-history-kind="legacy-builder-operation"][data-revision="${unboundRevision}"]`)).toContainText(/unverified|not verified/i)
  await expect(historyList.locator('[data-history-kind="legacy-builder-operation"][data-revision-available="false"]')).toContainText('revision unavailable')
  await expect(historyList).not.toContainText('untrusted legacy actor')
  assert.ok(firstHistory.warnings.length > 0)
  assert.deepEqual(await editorBinding(), historyBinding)
  assert.equal(posts.length + fontPosts.length, historyMutations)
  assert.deepEqual(effects(), beforeHistory)
  await historyPanel.scrollIntoViewIfNeeded()
  await assertInspectorGeometry('source-history-provenance', ['#panel-source', '#source-history', '#source-history-current-revision', '#source-history-list', '#source-history-list article', '#source-history-list code'], ['#source-history-current-revision', '#source-history-list code'])
  await historyPanel.screenshot({ path: join(evidence, '17-source-history-authored-observed-and-legacy.png') })
  const authoredHistoryRow = historyList.locator(`[data-history-kind="builder-save"][data-revision="${recoveredResult.revision}"]`)
  await authoredHistoryRow.scrollIntoViewIfNeeded()
  await authoredHistoryRow.screenshot({ path: join(evidence, '17a-source-history-recorded-save.png') })
  const legacyHistoryRow = historyList.locator(`[data-history-kind="legacy-builder-operation"][data-revision="${unboundRevision}"]`)
  await legacyHistoryRow.scrollIntoViewIfNeeded()
  await legacyHistoryRow.screenshot({ path: join(evidence, '17b-source-history-unverified-legacy.png') })
  checks.push('History attributes only exact checkout-bound confirmed source/font tuples to recorded builder saves; current disk reads are unattributed observations, incomplete legacy hashes stay unavailable, unbound complete tuples remain visibly unverified, and malformed/oversized log rows produce bounded diagnostics without content or repository effects.')

  const secondHistorySource = firstHistorySource + '/* A second external source observation. */\r\n'
  writeFileSync(stylesheetFile, secondHistorySource)
  const beforeRepeatedHistory = effects()
  const secondHistory = await readHistory()
  assert.ok(secondHistory.entries.some((entry) => entry.kind === 'observed-change' && entry.previousRevision === sha(firstHistorySource) && entry.revision === sha(secondHistorySource)))
  assert.equal(secondHistory.entries.filter((entry) => entry.kind === 'builder-save').length, authoredCount)
  const repeatHistory = await readHistory()
  assert.equal(repeatHistory.entries.filter((entry) => entry.kind.startsWith('observed-')).length, secondHistory.entries.filter((entry) => entry.kind.startsWith('observed-')).length)
  assert.equal(repeatHistory.entries.filter((entry) => entry.kind === 'builder-save').length, authoredCount)
  assert.deepEqual(effects(), beforeRepeatedHistory)
  assert.equal(posts.length + fontPosts.length, historyMutations)
  checks.push('A second external revision appears as an unattributed observed change with exact predecessor/current hashes; repeating the same GET deduplicates observations and never turns reads, no-ops,409 or exports into authored saves or log writes.')

  const cachedHistoryRevision = await historyCurrentRevision.textContent()
  const unseenHistorySource = secondHistorySource + '/* Held history response after target switch. */\r\n'
  writeFileSync(stylesheetFile, unseenHistorySource)
  let releaseHistoryTarget, notifyHistoryTarget, notifyHistoryTargetDone
  const historyTargetRelease = new Promise((resolveRelease) => { releaseHistoryTarget = resolveRelease })
  const historyTargetCaptured = new Promise((resolveCaptured) => { notifyHistoryTarget = resolveCaptured })
  const historyTargetDone = new Promise((resolveDone) => { notifyHistoryTargetDone = resolveDone })
  releasePendingResponse = releaseHistoryTarget
  await page.route('**/api/builder/source/history?path=src%2Findex.css&limit=30', async (route) => {
    try { const response = await route.fetch(); notifyHistoryTarget(); await historyTargetRelease; await route.fulfill({ response }) }
    catch { /* Target changes deliberately abort this read. */ }
    finally { notifyHistoryTargetDone() }
  })
  await historyRefresh.click()
  await Promise.race([historyTargetCaptured, delay(15000).then(() => { throw new Error('Target-bound history read was not captured.') })])
  const beforeHistoryTarget = effects(), historyTargetBinding = await editorBinding()
  await file.selectOption(secondPath)
  releaseHistoryTarget()
  await Promise.race([historyTargetDone, delay(15000).then(() => { throw new Error('Invalidated history target read did not finish.') })])
  await page.unroute('**/api/builder/source/history?path=src%2Findex.css&limit=30')
  releasePendingResponse = null
  await expect(historyRefresh).toBeDisabled()
  await expect(historyPath).not.toHaveText(secondPath)
  await expect(historyCurrentRevision).toHaveText(cachedHistoryRevision)
  assert.deepEqual(await editorBinding(), historyTargetBinding)
  assert.deepEqual(effects(), beforeHistoryTarget)
  await file.selectOption(stylesheetPath)
  await readHistory()
  await capturePreview()
  let releaseOlderHistory, notifyOlderHistory
  const olderHistoryRelease = new Promise((resolveRelease) => { releaseOlderHistory = resolveRelease })
  const olderHistoryCaptured = new Promise((resolveCaptured) => { notifyOlderHistory = resolveCaptured })
  releasePendingResponse = releaseOlderHistory
  await page.route('**/api/builder/source/history?path=src%2Findex.css&limit=30', async (route) => {
    const response = await route.fetch(); notifyOlderHistory(); await olderHistoryRelease; await route.fulfill({ response })
  })
  await historyRefresh.click()
  await Promise.race([olderHistoryCaptured, delay(15000).then(() => { throw new Error('Older history observation was not captured.') })])
  const newestHistorySource = unseenHistorySource + '/* Newer font read supersedes held history. */\r\n'
  writeFileSync(stylesheetFile, newestHistorySource)
  await showFonts()
  await refreshFont()
  const beforeOlderHistoryRelease = effects()
  const olderHistoryResponse = waitForResponse(historyResponseFor(stylesheetPath))
  releaseOlderHistory()
  await olderHistoryResponse
  await page.unroute('**/api/builder/source/history?path=src%2Findex.css&limit=30')
  releasePendingResponse = null
  await showCode()
  await expect(historyPanel).toHaveAttribute('data-state', 'unknown')
  await expect(historyStatus).toContainText(/not confirmed|superseded/i)
  await expect(previewCurrentRevision).toHaveText(sha(newestHistorySource))
  await expect(fontRevision).toHaveAttribute('data-revision', sha(newestHistorySource))
  assert.deepEqual(await editorBinding(), historyTargetBinding)
  assert.deepEqual(effects(), beforeOlderHistoryRelease)
  checks.push('A delayed history response cannot rebind a changed target or publish an unseen hash; a newer real font-source observation supersedes an older history result without rolling back preview/font freshness, changing the live editor or creating disk effects.')

  await page.route('**/api/builder/source/history?path=src%2Findex.css&limit=30', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Owned history read unavailable"}' }))
  const beforeHistoryError = effects(), historyErrorBinding = await editorBinding()
  const failedHistory = waitForResponse((item) => historyResponseFor(stylesheetPath)(item) && item.status() === 503)
  await historyRefresh.click()
  await failedHistory
  await expect(historyPanel).toHaveAttribute('data-state', 'unknown')
  await expect(historyStatus).toContainText('not confirmed')
  assert.deepEqual(await editorBinding(), historyErrorBinding)
  assert.deepEqual(effects(), beforeHistoryError)
  await page.unroute('**/api/builder/source/history?path=src%2Findex.css&limit=30')
  rmSync(stylesheetFile)
  const beforeHistoryMissing = effects()
  const missingHistory = waitForResponse(historyResponseFor(stylesheetPath))
  await historyRefresh.click()
  const missingHistoryResponse = await missingHistory
  assert.equal(missingHistoryResponse.status(), 404)
  assert.deepEqual(await missingHistoryResponse.json(), unavailableBody)
  await expect(historyPanel).toHaveAttribute('data-state', 'unavailable')
  await expect(save).toBeDisabled()
  assert.deepEqual(await editorBinding(), historyErrorBinding)
  assert.deepEqual(effects(), beforeHistoryMissing)
  assert.equal(existsSync(stylesheetFile), false)
  checks.push('History503 failures report an unconfirmed snapshot and actual missing-source404 reports unavailable; both preserve the raw draft/base/approval and recovery slot, refuse write authority, and never recreate source or modify backup/log/temp inventories.')

  writeFileSync(sourceFile, leafContent)
  await refreshWorkspaceInUi()
  await file.selectOption(sourcePath)
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('#load-source').click()
  await expect(editor).toHaveValue(leafContent)
  const beforeLeafHistory = effects()
  const leafHistory = await readHistory(sourcePath)
  assert.ok(leafHistory.entries.some((entry) => entry.kind === 'builder-save' && entry.operation === 'leaf-text' && entry.revision === leafResult.revision && entry.workspaceBound === true))
  assert.ok(leafHistory.entries.some((entry) => entry.kind.startsWith('observed-') && entry.revision === sha(leafContent) && entry.attribution === 'unattributed'))
  assert.deepEqual(effects(), beforeLeafHistory)
  assert.equal(posts.length + fontPosts.length, historyMutations)
  checks.push('Confirmed leaf-text history keeps its recorded operation kind and exact saved revision; an external restoration to identical bytes remains a separate unattributed observed snapshot rather than borrowing that historical author claim.')

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedRequests, [])
  assert.ok(syntheticFontRequests.some((item) => item.disposition === 'synthetic-empty-stylesheet'), 'Font CSS requests must exercise the local synthetic response instead of a provider')
  await Promise.all(browserAssetCaptures)
  for (const path of ['.SYSTEMX/LAN/Website/dashboard.js', '.SYSTEMX/LAN/Website/dashboard.css', '.SYSTEMX/LAN/Website/source-comparison.js', '.SYSTEMX/LAN/Website/source-draft-records.js'].filter((path) => inputManifest.files.some((item) => item.path === path))) {
    assert.ok(loadedBrowserAssets.some((item) => item.path === path && item.status === 200 && item.matchesCopiedInput), `Browser must load the copied bytes of ${path}`)
  }
  assert.ok(loadedBrowserAssets.every((item) => item.matchesCopiedInput), 'Every captured browser module and stylesheet must match the frozen copied input')
  assert.ok(inputManifest.files.every((item) => sha(readFileSync(join(root, item.path))) === item.sha256), 'Implementation files must remain frozen for this evidence run')
  report.implementationFilesPreserved = true
  assert.deepEqual(Object.fromEntries(protectedFiles.map((path) => [path, sha(readFileSync(join(root, path)))])), original)
  report.originalSourceAndSeedsPreserved = true
  report.status = 'passed'
} catch (error) {
  failure = error
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack }
  if (page && !page.isClosed()) report.failureUi = await page.locator('#panel-source').evaluate((panel) => ({
    selectedPath: panel.querySelector('#source-file-select')?.value,
    loadedRevision: panel.querySelector('#source-revision')?.dataset.revision,
    saveDisabled: panel.querySelector('#save-source')?.disabled,
    saveLabel: panel.querySelector('#save-source')?.textContent,
    output: panel.querySelector('#source-output')?.textContent,
    reviewStatus: panel.querySelector('#source-review-status')?.textContent,
    recoveryState: panel.querySelector('#source-recovery')?.dataset.state,
    recoveryStatus: panel.querySelector('#source-recovery-status')?.textContent,
    exportState: panel.querySelector('#source-export')?.dataset.state,
    historyState: panel.querySelector('#source-history')?.dataset.state,
    historyStatus: panel.querySelector('#source-history-status')?.textContent,
  })).catch(() => null)
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true, timeout: 5000 }).catch(() => {})
} finally {
  releasePendingResponse?.()
  report.finishedAt = new Date().toISOString()
  report.originalSourceAndSeedsPreserved = protectedFiles.every((path) => sha(readFileSync(join(root, path))) === original[path])
  report.fixtureSourceExistsAtFinish = existsSync(sourceFile)
  report.fixtureStylesheetExistsAtFinish = existsSync(stylesheetFile)
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  if (existsSync(sourceFile)) writeFileSync(join(evidence, 'fixture-final-source.txt'), readFileSync(sourceFile))
  if (existsSync(stylesheetFile)) writeFileSync(join(evidence, 'fixture-final-stylesheet.txt'), readFileSync(stylesheetFile))
  writeFileSync(join(evidence, 'server-output.log'), serverOutput)
  if (context) { await context.tracing.stop({ path: join(evidence, 'trace.zip') }).catch(() => {}); await context.close().catch(() => {}) }
  if (browser) await Promise.race([browser.close().catch(() => {}), delay(3000)])
  if (browserServer) {
    const closed = await Promise.race([browserServer.close().then(() => true).catch(() => false), delay(3000).then(() => false)])
    if (!closed) await Promise.race([browserServer.kill().catch(() => {}), delay(2000)])
  }
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolveExit) => server.once('exit', resolveExit))
    server.kill('SIGTERM')
    if (!await Promise.race([exited.then(() => true), delay(3000).then(() => false)])) { server.kill('SIGKILL'); await Promise.race([exited, delay(2000)]) }
  }
  await new Promise((resolveClose) => app.close(resolveClose))
  await Promise.all(browserAssetCaptures)
  report.implementationFilesPreserved = inputManifest.files.every((item) => sha(readFileSync(join(root, item.path))) === item.sha256)
  report.originalSourceAndSeedsPreserved = protectedFiles.every((path) => sha(readFileSync(join(root, path))) === original[path])
  report.fixtureSourceExistsAtFinish = existsSync(sourceFile)
  report.fixtureStylesheetExistsAtFinish = existsSync(stylesheetFile)
  report.finishedAt = new Date().toISOString()
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify({ ...inputManifest, status: report.status, evidenceFiles: filesBelow(evidence).map((path) => ({ path: relative(evidence, path), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })) }, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, checks: checks.length, originalSourceAndSeedsPreserved: report.originalSourceAndSeedsPreserved, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
