#!/usr/bin/env node
/** Exercise F007 through the normal LAN dashboard in a disposable checkout. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { outputDirectory, stopOwned } from './lan-graph-contract-browser.mjs'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const checkout = dirname(resolve(root, git('rev-parse', '--git-common-dir')))
const dependencies = createRequire(join(existsSync(join(root, 'node_modules')) ? root : checkout, 'package.json'))
const { chromium, expect } = dependencies('@playwright/test')
const output = outputDirectory(process.argv.slice(2), tmpdir())
mkdirSync(output, { recursive: true })
const evidence = mkdtempSync(join(output, 'transport-browser-'))
const fixture = mkdtempSync(join(tmpdir(), 'transport-workspace-'))
const lan = '.SYSTEMX/LAN'
const sourcePath = 'src/pages/TransportFixturePage.tsx'
const source = 'export const TransportFixturePage = () => <p>SOURCE_CONTENT_CANARY</p>\n'
const draft = source.replace('SOURCE_CONTENT_CANARY', 'UNSAVED_DRAFT_CANARY')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { schemaVersion: 1, revision: git('rev-parse', 'HEAD'), browser: 'Chromium', checks: [], status: 'failed' }
const listen = server => new Promise((done, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => done(server.address().port))
})
const close = server => new Promise(done => { server.close(done); server.closeAllConnections() })

let server, preview, browser, releasePending
try {
  const ignored = ['Backup', 'Files', 'Research', 'Temp', 'tests'].map(name => join(root, lan, name))
  cpSync(join(root, lan), join(fixture, lan), { recursive: true, filter: path => !ignored.includes(path) })
  cpSync(join(root, 'package.json'), join(fixture, 'package.json'))
  report.implementationSHA256 = Object.fromEntries([
    'server.mjs', 'Builder/transport-diagnostics.mjs', 'Website_Dashboard.html',
    'Website/dashboard.css', 'Website/dashboard.js', 'Website/transport-diagnostics.js',
  ].map(file => [file, digest(readFileSync(join(fixture, lan, file)))]))
  report.testSHA256 = digest(readFileSync(fileURLToPath(import.meta.url)))
  mkdirSync(dirname(join(fixture, sourcePath)), { recursive: true })
  writeFileSync(join(fixture, sourcePath), source)
  const streamAsset = join(fixture, lan, 'Website', 'INTERRUPTED_ASSET.css')
  writeFileSync(streamAsset, '')
  truncateSync(streamAsset, 32 * 1024 * 1024)
  // An owned placeholder serves the iframe and receives all status TCP probes.
  // Neither the dashboard nor its probes use the operator's app or emulators.
  preview = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><title>Local fixture</title><main>Transport fixture</main>')
  })
  const previewPort = await listen(preview)
  const reservation = createServer()
  const port = await listen(reservation)
  await close(reservation)
  const origin = `http://127.0.0.1:${port}`
  const previewOrigin = `http://127.0.0.1:${previewPort}`
  const diagnostics = origin + '/api/transport/diagnostics'
  const isolatedPorts = Object.fromEntries(['APP', 'FIREBASE_AUTH', 'FIREBASE_FIRESTORE', 'FIREBASE_STORAGE'].map(key => [`SYSTEMX_${key}_PORT`, String(previewPort)]))
  const nativeEnv = Object.fromEntries(['PATH', 'SystemRoot', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
  server = spawn(process.execPath, [join(fixture, lan, 'server.mjs')], { cwd: fixture,
    env: { ...nativeEnv, ...isolatedPorts, SYSTEMX_LAN_PORT: String(port), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true' },
    stdio: ['ignore', 'pipe', 'ignore'] })
  let stdout = '', launchError
  server.on('error', error => { launchError = error })
  server.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-4096) })
  await expect.poll(() => {
    if (launchError) throw launchError
    assert.equal(server.exitCode, null, 'Owned LAN process exited during startup')
    return stdout.includes(`[SYSTEMX LAN] ${origin}/`)
  }, { timeout: 15000 }).toBe(true)

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  let reads = 0, refusal = false, holdNext = false, pageErrors = 0, unexpectedRequests = 0
  context.on('request', request => { if (request.url() === diagnostics) reads++ })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') {
      return route.fulfill({ contentType: 'text/css', body: '' })
    }
    if (![origin, previewOrigin].includes(url.origin) || !['GET', 'HEAD'].includes(request.method())) {
      unexpectedRequests++
      return route.abort()
    }
    if (request.url() === diagnostics && refusal) {
      refusal = false
      return route.continue({ headers: { ...request.headers(), 'x-systemx-session': 'INVALID_SESSION_CANARY' } })
    }
    if (request.url() === diagnostics && holdNext) {
      holdNext = false
      await new Promise(done => { releasePending = done })
      return route.abort().catch(() => {})
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', () => { pageErrors++ })
  await page.clock.install()
  await page.goto(origin + '/#source')
  const editor = page.locator('#source-editor')
  await page.locator('#source-file-select').selectOption(sourcePath)
  const [loaded] = await Promise.all([
    page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/builder/source' && url.searchParams.get('path') === sourcePath
    }),
    page.getByRole('button', { name: 'Load', exact: true }).click(),
  ])
  assert.equal(loaded.status(), 200)
  const sourceId = await loaded.headerValue('x-systemx-request-id')
  assert.match(sourceId, uuid)
  await expect(editor).toHaveValue(source)
  await editor.fill(draft)
  await page.getByRole('link', { name: 'Insights', exact: true }).click()
  const panel = page.locator('#transport-diagnostics')
  const status = panel.locator('#transport-status')
  const rows = panel.locator('#transport-entries > li')
  const session = await page.locator('meta[name="systemx-session"]').getAttribute('content')
  assert.ok(session)
  const sensitive = [sourcePath, fixture, 'SOURCE_CONTENT_CANARY', 'UNSAVED_DRAFT_CANARY', 'INVALID_SESSION_CANARY', 'INTERRUPTED_ASSET', session]
  const assertSafe = text => {
    assert.ok(sensitive.every(value => !text.includes(value)), 'Diagnostics exposed a private fixture value')
  }
  const noPolling = async count => {
    await page.clock.fastForward(60000)
    assert.equal(await page.evaluate(() => document.readyState), 'complete')
    assert.equal(reads, count, 'Diagnostics must wait for the next operator action')
  }
  const read = async button => {
    const [result] = await Promise.all([page.waitForResponse(diagnostics), button.click()])
    const id = await result.headerValue('x-systemx-request-id')
    assert.match(id, uuid)
    return { result, id }
  }
  const snapshot = async ({ result, id }, correlated, code, category) => {
    assert.equal(result.status(), 200)
    assert.match(await result.headerValue('cache-control'), /no-store/)
    const body = await result.json()
    assertSafe(JSON.stringify(body))
    assert.deepEqual(Object.keys(body).sort(), ['entries', 'limit', 'schemaVersion'])
    assert.equal(body.schemaVersion, 1)
    assert.equal(body.limit, 64)
    assert.ok(body.entries.length > 0 && body.entries.length <= body.limit)
    for (const entry of body.entries) {
      const fields = ['category', 'durationMs', 'method', 'status', 'transportId']
      if (entry.status === null) {
        fields.push('outcome')
        assert.equal(entry.outcome, 'cancelled')
      } else {
        assert.ok(Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599)
      }
      assert.deepEqual(Object.keys(entry).sort(), fields.sort())
      assert.match(entry.transportId, uuid)
      assert.ok(Number.isInteger(entry.durationMs) && entry.durationMs >= 0)
    }
    assert.ok(!body.entries.some(entry => entry.transportId === id), 'A pending read appeared as already completed')
    const entry = body.entries.find(entry => entry.transportId === correlated)
    assert.ok(entry, 'The observed response header did not correlate to a completed diagnostics entry')
    assert.equal(entry.method, 'GET')
    assert.equal(entry.status, code)
    assert.equal(entry.category, category)
    await expect(status).toHaveAttribute('data-state', 'completed')
    await expect(status).toContainText(id)
    const row = rows.filter({ hasText: correlated })
    await expect(row).toBeVisible()
    for (const field of [entry.method, entry.category, String(code), `${entry.durationMs} ms`]) await expect(row).toContainText(field)
    assertSafe(await panel.innerText())
    return entry
  }

  await expect(panel.locator('summary')).toBeVisible()
  await noPolling(0)
  const interruptedId = await page.evaluate(async () => {
    const controller = new AbortController()
    const response = await fetch('/Website/INTERRUPTED_ASSET.css', { signal: controller.signal })
    const chunk = await response.body.getReader().read()
    if (chunk.done) throw new Error('Expected an in-flight response')
    controller.abort()
    return response.headers.get('x-systemx-request-id')
  })
  assert.match(interruptedId, uuid)
  const initial = await read(panel.locator('summary'))
  report.sourceRead = await snapshot(initial, sourceId, 200, 'builder')
  const interruptedRows = (await initial.result.json()).entries.filter(entry => entry.transportId === interruptedId)
  assert.equal(interruptedRows.length, 1)
  const [interrupted] = interruptedRows
  assert.deepEqual([interrupted.status, interrupted.outcome, interrupted.category], [null, 'cancelled', 'assets'])
  await expect(rows.filter({ hasText: interruptedId })).toContainText('GET · assets · Cancelled')
  report.cancelledRead = interrupted
  report.checks.push('Aborting a streamed browser read produced one correlated Cancelled row.')
  await noPolling(1)
  report.checks.push('A single on-demand read rendered the observed source response ID and bounded metadata.')
  const visibleBeforeRefusal = await rows.allTextContents()
  refusal = true
  const denied = await read(panel.getByRole('button', { name: 'Refresh', exact: true }))
  assert.equal(denied.result.status(), 403)
  await expect(status).toHaveAttribute('data-state', 'unavailable')
  await expect(status).toContainText(denied.id)
  assertSafe(await panel.innerText())
  assert.equal(await editor.inputValue(), draft)
  assert.deepEqual(await rows.allTextContents(), visibleBeforeRefusal, 'A failed read discarded the prior snapshot')
  await noPolling(2)
  const retry = await read(panel.getByRole('button', { name: 'Retry', exact: true }))
  report.refusedRead = await snapshot(retry, denied.id, 403, 'diagnostics')
  assert.notEqual(denied.id, retry.id)
  report.checks.push('A real session refusal preserved the draft and results. Retry recovered and correlated the 403.')

  holdNext = true
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => typeof releasePending).toBe('function')
  await expect(status).toHaveAttribute('data-state', 'pending')
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(status).toHaveAttribute('data-state', 'cancelled')
  const afterCancel = await read(panel.getByRole('button', { name: 'Retry', exact: true }))
  await snapshot(afterCancel, retry.id, 200, 'diagnostics')
  releasePending()
  releasePending = null
  await noPolling(5)
  await expect(status).toHaveAttribute('data-state', 'completed')
  assert.equal(await editor.inputValue(), draft)
  assert.equal(readFileSync(join(fixture, sourcePath), 'utf8'), source)
  assert.equal(pageErrors, 0, 'Unexpected page error')
  assert.equal(unexpectedRequests, 0, 'Unexpected provider or write request')
  report.checks.push('Cancel and retry preserved the unsaved draft and the fixture file, with five explicit reads and no polling.')
  await panel.scrollIntoViewIfNeeded()
  await panel.screenshot({ path: join(evidence, 'transport-diagnostics.png') })
  await page.getByRole('button', { name: 'Open code and provider tools' }).click()
  await page.getByRole('link', { name: 'Code', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toHaveValue(draft)
  report.fixtureSourceSHA256 = digest(source)
  report.reads = reads
  report.status = 'passed'
} finally {
  releasePending?.()
  try { await browser?.close() } finally {
    try { await stopOwned(server) } finally {
      if (preview?.listening) await close(preview)
      rmSync(fixture, { recursive: true, force: true })
      writeFileSync(join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n')
      console.log(JSON.stringify({ status: report.status, checks: report.checks.length, evidence }))
    }
  }
}
