import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium, expect } from '@playwright/test'
import release from '@waynetechlab/webappxai/release' with { type: 'json' }
import modelPin from '../src/webappxai/model-pin.json' with { type: 'json' }
import runtimeSource from '../vendor/webappxai/SOURCE.json' with { type: 'json' }

// Opt-in integration test. Start the local demo stack with the private pilot files first.
const { values } = parseArgs({ options: { origin: { type: 'string' }, 'output-dir': { type: 'string' } } })
const usage = 'Usage: node scripts/browser-webappxai.mjs --origin http://127.0.0.1:PORT [--output-dir DIR]'
assert.ok(values.origin, usage)
function loopbackOrigin(value) {
  const url = new URL(value)
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password, 'Expected an HTTP loopback origin')
  return url.origin
}

const origin = loopbackOrigin(values.origin)
const output = values['output-dir'] ?? await mkdtemp(path.join(tmpdir(), 'webappxai-browser-'))
await mkdir(output, { recursive: true })
const configResponse = await fetch(origin + '/__systemx/api/auth/providers', { redirect: 'error' })
assert.ok(configResponse.ok, 'Start the WebAppX local demo stack before running this test')
const config = await configResponse.json()
assert.ok(config.mode === 'firebase-emulator' && config.environment === 'local-only' &&
  config.emulatorOnline === true && config.projectId.startsWith('demo-'), 'Expected a local Firebase demo project')
const authOrigin = loopbackOrigin(config.emulatorUrl)
const authIdentity = await fetch(authOrigin + '/', { redirect: 'error' }).then(r => r.json())
assert.equal(authIdentity.authEmulator?.ready, true)
const apiBase = '/api/webappxai/'
const assetBase = apiBase + modelPin.revision + '/'
const workerUrl = origin + '/webappxai/worker.js'
const files = Object.keys(release.assets)
const report = {
  origin, project: config.projectId, model: modelPin,
  runtime: { tag: runtimeSource.tag, commit: runtimeSource.commit }, checks: [],
}
assert.match(modelPin.revision, /^[a-f0-9]{40}$/)
function passed(check) {
  report.checks.push(check)
  console.log('PASS ' + check)
}
async function account(action, body) {
  const r = await fetch(authOrigin + '/identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=systemx-local-api-key', {
    method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  assert.ok(r.ok, 'Test account ' + action + ' failed (' + r.status + ')')
  return r.json()
}

const prompt = 'What is WebAppX?'
const email = 'webappxai-' + randomUUID() + '@example.test'
const password = randomUUID() + 'aA!'
let cleanupToken
const browser = await chromium.launch()
try {
  for (const file of files) {
    const r = await fetch(origin + assetBase + file, { redirect: 'error' })
    await r.body?.cancel()
    assert.ok([401, 403].includes(r.status), 'Missing credentials should deny access to ' + file + ', got ' + r.status)
  }
  passed('Both revision-pinned private asset routes deny signed-out downloads')
  const context = await browser.newContext({ viewport: { width: 390, height: 650 }, serviceWorkers: 'block' })
  const allowed = new Set([origin, authOrigin])
  for (const port of [config.ports.firestore, config.ports.storage]) {
    const url = new URL(authOrigin)
    url.port = String(port)
    allowed.add(url.origin)
  }
  const errors = []
  const offOrigin = new Set()
  const downloads = []
  let sentPrompt = false
  context.on('page', p => {
    p.on('pageerror', e => errors.push(e.message))
    p.on('websocket', ws => ws.on('framesent', ({ payload }) => {
      if (String(payload).includes(prompt)) sentPrompt = true
    }))
  })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !allowed.has(url.origin)) {
      offOrigin.add(url.origin)
      return route.abort()
    }
    if (decodeURI(url.href).includes(prompt) || request.postData()?.includes(prompt)) sentPrompt = true
    if (url.pathname.startsWith(apiBase) || url.pathname.startsWith('/webappxai/')) downloads.push(url.pathname)
    return route.continue()
  })
  const page = await context.newPage()
  page.on('requestfailed', req => {
    const pathname = new URL(req.url()).pathname
    if (pathname.startsWith(apiBase) || pathname.startsWith('/webappxai/')) {
      console.error('Failed model resource: ' + pathname + ' (' + req.failure()?.errorText + ')')
    }
  })
  const help = page.getByRole('region', { name: 'Self-service help desk' })
  const pilot = help.getByRole('region', { name: 'WebAppXai', exact: true })
  const openHelp = () => page.getByRole('button', { name: 'Open help desk' }).click()
  const load = pilot.getByRole('button', { name: 'Load model', exact: true })
  const signInLink = pilot.getByRole('link', { name: 'Sign in to load model' })
  async function waitForReady() {
    const status = pilot.getByRole('status')
    await expect(status).toHaveText(/Ready on this device|could not|stopped|needs a secure/i, { timeout: 90000 })
    await expect(status).toHaveText('Ready on this device.')
  }
  const log = pilot.getByRole('log', { name: 'Local conversation' })
  await page.goto(origin)
  await openHelp()
  await expect(pilot.getByText('Research pilot')).toBeVisible()
  await expect(signInLink).toBeVisible()
  await expect(load).toHaveCount(0)
  await help.getByRole('button', { name: 'Where do I start?' }).click()
  await expect(help.getByText(/^Open the docs page/)).toBeVisible()
  const bounds = await help.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 651,
    'Help desk should fit the 390 × 650 viewport')
  await signInLink.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'mobile-help.png') })
  assert.deepEqual(downloads, [])
  passed('Mobile Help fits 390 × 650, displays the research label and serves FAQ answers without downloading AI assets')

  await signInLink.click()
  await expect(page).toHaveURL(origin + '/login')
  await expect(page.getByText('Local development lane', { exact: true })).toBeVisible()
  const fixture = await account('signUp', { email, password, returnSecureToken: true })
  cleanupToken = fixture.idToken
  const claims = JSON.parse(Buffer.from(cleanupToken.split('.')[1], 'base64url'))
  assert.ok(claims.aud === config.projectId && claims.sub === fixture.localId && claims.email === email,
    'Expected the isolated account to belong to this demo project')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.goto(origin)
  await openHelp()
  await expect(load).toBeVisible()
  await help.getByRole('button', { name: 'What is this template?' }).click()
  await expect(help.getByText(/^A Firebase-ready React/)).toBeVisible()
  assert.deepEqual(downloads, [])
  passed('Email/password sign-in unlocks Load model on the homepage while FAQ still works with zero AI downloads')

  const responses = files.map(file => page.waitForResponse(r => new URL(r.url()).pathname === assetBase + file, { timeout: 45000 }))
  const [, workerResponse, , ...received] = await Promise.all([
    load.click(),
    context.waitForEvent('response', r => r.url() === workerUrl),
    page.waitForEvent('worker', worker => worker.url() === workerUrl),
    ...responses,
  ])
  assert.equal(workerResponse.status(), 200)
  assert.match(workerResponse.headers()['content-security-policy'] ?? '', /(?:^|;)\s*connect-src 'none'(?:;|$)/)
  report.workerSha256 = createHash('sha256').update(await workerResponse.body()).digest('hex')
  assert.equal(report.workerSha256, runtimeSource.files['runtime/worker.js'], 'Worker bytes must match the tagged runtime')
  passed('Help launches the exact ' + runtimeSource.tag + ' worker with outbound connections blocked')
  report.privateBytes = {}
  for (const [index, r] of received.entries()) {
    assert.equal(r.status(), 200, 'Authenticated asset response for ' + files[index])
    assert.ok((await r.request().allHeaders()).authorization?.startsWith('Bearer '), 'Expected authenticated request')
    const file = files[index]
    report.privateBytes[file] = Number(r.headers()['content-length'])
    assert.equal(report.privateBytes[file], release.assets[file].bytes)
    console.log('Received ' + file + ' (' + report.privateBytes[file] + ' bytes)')
  }
  await waitForReady()
  passed('Explicit load downloads both private assets and initializes the on-device model')
  await context.setOffline(true)
  report.generationRequests = 0
  const countRequest = () => { report.generationRequests++ }
  context.on('request', countRequest)
  try {
    await pilot.getByLabel('Message', { exact: true }).fill(prompt)
    await pilot.getByRole('button', { name: 'Send locally' }).click()
    await expect(pilot.getByText('Reply complete.', { exact: true })).toBeVisible({ timeout: 120000 })
    const reply = await log.locator('p').filter({ has: page.getByText('WebAppXai', { exact: true }) }).innerText()
    report.offlineReply = reply.replace(/^WebAppXai\s*·\s*/, '').trim()
    assert.equal(report.offlineReply, 'WebAppX is a React, TypeScript, Vite and Firebase webapp template with SYSTEMX guidance.')
    await page.screenshot({ path: path.join(output, 'mobile-offline-reply.png') })
    assert.equal(report.generationRequests, 0, 'Generation must stay on this device')
  } finally {
    context.off('request', countRequest)
    await context.setOffline(false)
  }
  passed('The pinned model generates its expected reply offline with zero network requests')

  // Recreate the previous version's one-record cache in this disposable browser profile.
  const accountCacheKey = revision => JSON.stringify([config.projectId, 'local-emulator', fixture.localId, revision])
  const pinnedKey = accountCacheKey(modelPin.revision)
  const oldKey = accountCacheKey(release.revision)
  await page.evaluate(({ pinnedKey, oldKey }) => new Promise((resolve, reject) => {
    const opening = indexedDB.open('webappxai-pilot-assets-v1', 1)
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const tx = db.transaction('releases', 'readwrite')
      const store = tx.objectStore('releases')
      const entry = store.get(pinnedKey)
      entry.onsuccess = () => {
        if (!entry.result) return tx.abort()
        store.put(entry.result, oldKey)
        store.delete(pinnedKey)
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(new Error('Could not seed the legacy cache from the real model')) }
    }
  }), { pinnedKey, oldKey })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload()
  await openHelp()
  await expect(load).toBeVisible()
  await load.click()
  await waitForReady()
  const cacheKeys = await page.evaluate(() => new Promise((resolve, reject) => {
    const opening = indexedDB.open('webappxai-pilot-assets-v1', 1)
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const keys = db.transaction('releases').objectStore('releases').getAllKeys()
      keys.onsuccess = () => { db.close(); resolve(keys.result) }
      keys.onerror = () => { db.close(); reject(keys.error) }
    }
  }))
  assert.deepEqual(cacheKeys, [pinnedKey], 'Legacy cached bytes should be promoted to the pinned revision')
  assert.deepEqual(downloads.filter(p => p.startsWith(apiBase)).sort(), files.map(f => assetBase + f).sort())
  await expect(log.locator('p')).toHaveCount(0)
  passed('Reload promotes the legacy signed-in cache to the exact model revision with no redownload and an empty conversation')
  const session = await context.newPage()
  await session.goto(origin + '/login')
  await session.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(signInLink).toBeVisible({ timeout: 15000 })
  await expect(log).toHaveCount(0)
  await expect(load).toHaveCount(0)
  await help.getByRole('button', { name: 'Can I get project help?' }).click()
  await expect(help.getByText(/^Use the contact route/)).toBeVisible()
  passed('Cross-tab sign-out removes chat and model controls and preserves the anonymous FAQ')
  assert.equal(sentPrompt, false, 'No outbound request or socket frame should contain the chat prompt')
  assert.deepEqual([...offOrigin], [], 'Unexpected off-device connection')
  assert.deepEqual(errors, [], 'Unexpected browser error')
  passed('No external HTTP requests, transmitted chat prompt or uncaught page errors observed')
} finally {
  try {
    if (cleanupToken) {
      await account('delete', { idToken: cleanupToken })
      passed('Removed the temporary Auth emulator user')
    }
  } finally {
    await browser.close()
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log('Browser artifacts: ' + output)
  }
}
