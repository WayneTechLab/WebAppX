import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium, expect } from '@playwright/test'
import release from '@waynetechlab/webappxai/release' with { type: 'json' }
import modelPin from '../src/webappxai/model-pin.json' with { type: 'json' }
import runtimeSource from '../vendor/webappxai/SOURCE.json' with { type: 'json' }

// Opt-in integration test. Start the local demo stack with the private pilot files first.
const { values } = parseArgs({ options: {
  origin: { type: 'string' }, 'output-dir': { type: 'string' }, 'old-assets-dir': { type: 'string' },
} })
const usage = 'Usage: node scripts/browser-webappxai.mjs --origin http://127.0.0.1:PORT [--output-dir DIR] [--old-assets-dir PILOT_003_DIR]'
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
const files = ['model.onnx', 'tokenizer.json']
assert.deepEqual(Object.keys(modelPin.assets).sort(), files)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const prompt = modelPin.smoke.question
assert.ok(typeof prompt === 'string' && prompt.trim())
assert.ok(typeof modelPin.smoke.answer === 'string' && modelPin.smoke.answer.trim())
const oldRevision = '13234ff5521012ddcfda6cda14eda3850d5448d4'
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

const cleanupTokens = []
async function signInFreshAccount(page) {
  const email = 'webappxai-' + randomUUID() + '@example.test'
  const password = randomUUID() + 'aA!'
  const fixture = await account('signUp', { email, password, returnSecureToken: true })
  cleanupTokens.push(fixture.idToken)
  const claims = JSON.parse(Buffer.from(fixture.idToken.split('.')[1], 'base64url'))
  assert.ok(claims.aud === config.projectId && claims.sub === fixture.localId && claims.email === email,
    'Expected the isolated account to belong to this demo project')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  return fixture.localId
}

function accountKey(uid, ...pin) {
  return JSON.stringify([config.projectId, 'local-emulator', uid, ...pin])
}
const activeKey = uid => accountKey(uid, modelPin.revision, ...files.map(name => modelPin.assets[name].sha256))

async function seedPreviousRelease(page, uid, directory) {
  assert.notEqual(modelPin.revision, oldRevision, 'Upgrade fixture requires a different active revision')
  assert.notEqual(modelPin.assets['model.onnx'].sha256, release.assets['model.onnx'].sha256,
    'Upgrade fixture requires a different active model')
  const encoded = []
  for (const name of files) {
    const bytes = await readFile(path.join(directory, name))
    assert.equal(bytes.length, release.assets[name].bytes, 'Previous fixture size for ' + name)
    assert.equal(sha256(bytes), release.assets[name].sha256, 'Previous fixture digest for ' + name)
    encoded.push(bytes.toString('base64'))
  }
  // Playwright transfers the private bytes into this disposable profile without serving or saving them.
  await page.evaluate(({ keys, encoded }) => new Promise((resolve, reject) => {
    const decode = value => {
      const raw = atob(value)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      return bytes.buffer
    }
    const pair = { model: decode(encoded[0]), tokenizer: decode(encoded[1]) }
    const opening = indexedDB.open('webappxai-pilot-assets-v1', 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('releases')
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const tx = db.transaction('releases', 'readwrite')
      for (const key of keys) tx.objectStore('releases').put(pair, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), { keys: [accountKey(uid, oldRevision), accountKey(uid, release.revision)], encoded })
}

async function cacheKeys(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const opening = indexedDB.open('webappxai-pilot-assets-v1', 1)
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const keys = db.transaction('releases').objectStore('releases').getAllKeys()
      keys.onsuccess = () => { db.close(); resolve(keys.result) }
      keys.onerror = () => { db.close(); reject(keys.error) }
    }
  }))
}
async function cachedDigests(page, key) {
  return page.evaluate(async key => {
    const pair = await new Promise((resolve, reject) => {
      const opening = indexedDB.open('webappxai-pilot-assets-v1', 1)
      opening.onerror = () => reject(opening.error)
      opening.onsuccess = () => {
        const db = opening.result
        const entry = db.transaction('releases').objectStore('releases').get(key)
        entry.onsuccess = () => { db.close(); resolve(entry.result) }
        entry.onerror = () => { db.close(); reject(entry.error) }
      }
    })
    const digests = {}
    for (const [name, bytes] of [['model.onnx', pair.model], ['tokenizer.json', pair.tokenizer]]) {
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      const sha256 = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')
      digests[name] = { bytes: bytes.byteLength, sha256 }
    }
    return digests
  }, key)
}

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
  const uid = await signInFreshAccount(page)
  await page.goto(origin)
  await openHelp()
  await expect(load).toBeVisible()
  await help.getByRole('button', { name: 'What is this template?' }).click()
  await expect(help.getByText(/^A Firebase-ready React/)).toBeVisible()
  assert.deepEqual(downloads, [])
  passed('Email/password sign-in unlocks Load model on the homepage while FAQ still works with zero AI downloads')

  report.previousModelSeeded = Boolean(values['old-assets-dir'])
  if (report.previousModelSeeded) {
    await seedPreviousRelease(page, uid, values['old-assets-dir'])
    assert.deepEqual((await cacheKeys(page)).sort(), [accountKey(uid, oldRevision), accountKey(uid, release.revision)].sort())
    passed('Seeded both historical cache keys for this authenticated user with hash-verified previous model bytes')
  }
  const privateDownloads = () => downloads.filter(p => p.startsWith(apiBase))
  const expectedDownloads = files.map(file => assetBase + file).sort()
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
    assert.equal(report.privateBytes[file], modelPin.assets[file].bytes)
    console.log('Received ' + file + ' (' + report.privateBytes[file] + ' bytes)')
  }
  await waitForReady()
  assert.deepEqual(privateDownloads().sort(), expectedDownloads)
  assert.deepEqual(await cacheKeys(page), [activeKey(uid)])
  // Hash the actual persisted response bytes. Chromium can evict large network bodies from its inspector cache.
  report.cachedAssets = await cachedDigests(page, activeKey(uid))
  for (const name of files) {
    assert.equal(report.cachedAssets[name].bytes, modelPin.assets[name].bytes)
    assert.equal(report.cachedAssets[name].sha256, modelPin.assets[name].sha256, 'Active asset digest for ' + name)
  }
  passed('Explicit load fetches both active assets, verifies their digests and retains only the signed-in active cache')
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
    assert.equal(report.offlineReply, modelPin.smoke.answer)
    await page.screenshot({ path: path.join(output, 'mobile-offline-reply.png') })
    assert.equal(report.generationRequests, 0, 'Generation must stay on this device')
  } finally {
    context.off('request', countRequest)
    await context.setOffline(false)
  }
  passed('The pinned model generates its expected reply offline with zero network requests')

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload()
  await openHelp()
  await expect(load).toBeVisible()
  await load.click()
  await waitForReady()
  assert.deepEqual(await cacheKeys(page), [activeKey(uid)])
  assert.deepEqual(privateDownloads().sort(), expectedDownloads, 'Verified active cache should avoid both private downloads')
  await expect(log.locator('p')).toHaveCount(0)
  passed('Reload verifies the same account’s active cache with zero additional private downloads and an empty conversation')
  const session = await context.newPage()
  await session.goto(origin + '/login')
  await session.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(signInLink).toBeVisible({ timeout: 15000 })
  await expect(log).toHaveCount(0)
  await expect(load).toHaveCount(0)
  await help.getByRole('button', { name: 'Can I get project help?' }).click()
  await expect(help.getByText(/^Use the contact route/)).toBeVisible()
  passed('Cross-tab sign-out removes chat and model controls and preserves the anonymous FAQ')
  assert.deepEqual(await cacheKeys(page), [activeKey(uid)], 'First account cache must be present for the isolation check')
  await signInLink.click()
  const otherUid = await signInFreshAccount(page)
  assert.notEqual(otherUid, uid)
  await page.goto(origin)
  await openHelp()
  await expect(load).toBeVisible()
  await load.click()
  await waitForReady()
  assert.deepEqual(privateDownloads().sort(), [...expectedDownloads, ...expectedDownloads].sort(),
    'The second account must fetch both assets despite the first account’s complete verified cache')
  assert.deepEqual(await cacheKeys(page), [activeKey(otherUid)], 'Replacement must retain only the second account’s pair')
  passed('A second signed-in account fetches its own active pair and cannot reuse the first account’s valid bytes')
  assert.equal(sentPrompt, false, 'No outbound request or socket frame should contain the chat prompt')
  assert.deepEqual([...offOrigin], [], 'Unexpected off-device connection')
  assert.deepEqual(errors, [], 'Unexpected browser error')
  passed('No external HTTP requests, transmitted chat prompt or uncaught page errors observed')
} finally {
  try {
    const cleanup = await Promise.allSettled(cleanupTokens.map(idToken => account('delete', { idToken })))
    for (const result of cleanup) if (result.status === 'rejected') throw result.reason
    if (cleanup.length) passed('Removed the temporary Auth emulator users')
  } finally {
    await browser.close()
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log('Browser artifacts: ' + output)
  }
}
