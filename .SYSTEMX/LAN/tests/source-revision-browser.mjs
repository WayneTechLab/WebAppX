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
const filesBelow = (directory) => !existsSync(directory) ? [] : readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? filesBelow(path) : [path]
}).sort()
const effects = () => ({
  source: existsSync(sourceFile) ? readFileSync(sourceFile, 'utf8') : null,
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
const checks = [], pageErrors = [], posts = [], unexpectedRequests = []
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
const report = { schemaVersion: 1, kind: 'isolated-source-revision-browser-evidence', checks, pageErrors, posts, unexpectedRequests, loadedBrowserAssets,
  startedAt: new Date().toISOString(),
  boundaries: 'Source writes and external changes target only an owned temporary copy. Fresh Chromium context; no user browser/storage, provider, real app source, or existing listener is changed.' }
if (process.env.SYSTEMX_SOURCE_REVISION_ATTEMPT_NOTE) report.attemptNote = process.env.SYSTEMX_SOURCE_REVISION_ATTEMPT_NOTE
const inputManifest = {
  schemaVersion: 1,
  algorithm: 'sha256',
  gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  nodeVersion: process.version,
  files: [...filesBelow(join(fixture, '.SYSTEMX/LAN')).filter((path) => /\.(?:mjs|js|html|css)$/.test(path)).map((path) => ({ path: relative(fixture, path).replaceAll('\\', '/'), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })),
    ...filesBelow(join(root, '.SYSTEMX/LAN/tests')).filter((path) => /\.mjs$/.test(path)).map((path) => ({ path: relative(root, path).replaceAll('\\', '/'), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) }))],
  protectedSourceAndSeeds: original,
  syntheticSource: { path: sourcePath, sha256: sha(initial), secondPath, secondSha256: sha(secondInitial) },
}
writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(inputManifest, null, 2)}\n`)
try {
  await new Promise((resolveListen, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolveListen) })
  appPort = app.address().port
  const origin = `http://127.0.0.1:${appPort}`
  report.origin = origin
  server = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], {
    cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true' },
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
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
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
    if (url.origin !== origin || !['GET', 'HEAD', 'POST'].includes(request.method()) || request.method() === 'POST' && url.pathname !== '/__systemx/api/builder/source') {
      unexpectedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname })
      return route.abort('blockedbyclient')
    }
    if (request.method() === 'POST') posts.push(request.postDataJSON())
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
  await page.goto(`${origin}/__systemx/#source`, { waitUntil: 'domcontentloaded' })
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

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedRequests, [])
  await Promise.all(browserAssetCaptures)
  for (const path of ['.SYSTEMX/LAN/Website/dashboard.js', '.SYSTEMX/LAN/Website/dashboard.css', '.SYSTEMX/LAN/Website/source-comparison.js'].filter((path) => inputManifest.files.some((item) => item.path === path))) {
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
  })).catch(() => null)
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true, timeout: 5000 }).catch(() => {})
} finally {
  releasePendingResponse?.()
  report.finishedAt = new Date().toISOString()
  report.originalSourceAndSeedsPreserved = protectedFiles.every((path) => sha(readFileSync(join(root, path))) === original[path])
  report.fixtureSourceExistsAtFinish = existsSync(sourceFile)
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  if (existsSync(sourceFile)) writeFileSync(join(evidence, 'fixture-final-source.txt'), readFileSync(sourceFile))
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
  report.finishedAt = new Date().toISOString()
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify({ ...inputManifest, status: report.status, evidenceFiles: filesBelow(evidence).map((path) => ({ path: relative(evidence, path), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })) }, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, checks: checks.length, originalSourceAndSeedsPreserved: report.originalSourceAndSeedsPreserved, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
