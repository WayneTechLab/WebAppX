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
const fixture = join(temporary, 'fixture'), evidence = join(temporary, 'evidence')
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
  source: readFileSync(sourceFile, 'utf8'),
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
const report = { schemaVersion: 1, kind: 'isolated-source-revision-browser-evidence', checks, pageErrors, posts, unexpectedRequests,
  boundaries: 'Source writes and external changes target only an owned temporary copy. Fresh Chromium context; no user browser/storage, provider, real app source, or existing listener is changed.' }
try {
  await new Promise((resolveListen, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolveListen) })
  appPort = app.address().port
  const origin = `http://127.0.0.1:${appPort}`
  report.origin = origin
  server = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], {
    cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
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
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
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
    const response = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const successful = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const crlfNoop = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await (await crlfNoop).json()).status, 'unchanged')
  assert.equal(posts.at(-1).content, crlf)
  assert.deepEqual(effects(), crlfBeforeNoop)
  await expect(save).toBeEnabled()
  const visiblyEqualLf = crlf.replaceAll('\r\n', '\n')
  writeFileSync(sourceFile, visiblyEqualLf)
  const beforeEndingConflict = effects()
  await confirmation.fill('SAVE LOCAL CHANGE')
  const endingConflict = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
    const noOp = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const releasedResponse = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const revertedNoop = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
      : page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST' && item.status() === 503)
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
  const secondSave = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
    const conflict = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const leafSaved = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
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
  const independentConflict = page.waitForResponse((item) => item.url().endsWith('/api/builder/source') && item.request().method() === 'POST')
  await save.click()
  assert.equal((await independentConflict).status(), 409)
  assert.equal(posts.at(-1).baseRevision, retainedRawBase)
  assert.deepEqual(effects(), rawAfterLeaf)
  await expect(editor).toHaveValue(retainedRawDraft)
  await page.locator('[data-inspector-group-tab="design"]').click()
  await page.locator('[data-inspector-tab="settings"]').click()
  await page.locator('#panel-settings').screenshot({ path: join(evidence, '03-leaf-save-independent-base.png') })
  checks.push('Selected-text saves keep an independent loaded revision across409 retries; explicit source reload retains the text draft, permits a backed-up save, and never advances a separate raw editor draft/base.')

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedRequests, [])
  assert.deepEqual(Object.fromEntries(protectedFiles.map((path) => [path, sha(readFileSync(join(root, path)))])), original)
  report.originalSourceAndSeedsPreserved = true
  report.status = 'passed'
} catch (error) {
  failure = error
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack }
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  releasePendingResponse?.()
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
  report.originalSourceAndSeedsPreserved = protectedFiles.every((path) => sha(readFileSync(join(root, path))) === original[path])
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, checks: checks.length, originalSourceAndSeedsPreserved: report.originalSourceAndSeedsPreserved, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
