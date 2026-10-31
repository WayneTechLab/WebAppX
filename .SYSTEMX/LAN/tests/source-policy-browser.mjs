#!/usr/bin/env node
/** F002 source-access proof against the real LAN UI/API in an owned disposable repository. */
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createServer as createPortProbe } from 'node:net'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect as browserExpect } from '@playwright/test'

const expect = browserExpect.configure({ timeout: 15000 })
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const temporary = mkdtempSync(join(tmpdir(), 'webappx-source-policy-browser-'))
const fixture = join(temporary, 'fixture')
const evidenceRoot = process.env.SYSTEMX_SOURCE_POLICY_EVIDENCE_DIR ? resolve(process.env.SYSTEMX_SOURCE_POLICY_EVIDENCE_DIR) : temporary
mkdirSync(evidenceRoot, { recursive: true })
const evidence = mkdtempSync(join(evidenceRoot, 'source-policy-run-'))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const regularFiles = (directory) => !existsSync(directory) ? [] : readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? regularFiles(path) : entry.isFile() ? [path] : []
}).sort()
const snapshot = (directory) => Object.fromEntries(regularFiles(directory).map((path) => [relative(directory, path).replaceAll('\\', '/'), sha(readFileSync(path))]))
const protectedFiles = execFileSync('git', ['ls-files', '-z', '--', 'src', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/.systemx/releases'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const protectedOriginal = Object.fromEntries(protectedFiles.map((path) => [path, sha(readFileSync(join(root, path)))]))
for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), {
  recursive: true,
  filter: (source) => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some((name) => source === join(root, '.SYSTEMX/LAN', name)),
})
for (const name of ['package.json', '.SYSTEMX/INSTALLATION.json']) {
  mkdirSync(dirname(join(fixture, name)), { recursive: true })
  cpSync(join(root, name), join(fixture, name))
}
// Freeze implementation inputs before adding synthetic private/runtime fixtures.
const inputFiles = snapshot(join(fixture, '.SYSTEMX/LAN'))
const put = (path, bytes) => { mkdirSync(dirname(join(fixture, path)), { recursive: true }); writeFileSync(join(fixture, path), bytes) }
const homePath = 'src/pages/HomePage.tsx'
const homeText = 'export function HomePage() { return <h1>Owned F002 fixture</h1> }\n// UNINDEXED_BODY_NEEDLE_9421\n'
const cssText = '@import "tailwindcss";\n:root { --wtl-font-family: "Fixture Sans", system-ui; }\nbody { font-family: var(--wtl-font-family); }\n'
put(homePath, homeText)
put('src/pages/AboutPage.tsx', 'export function AboutPage() { return <p>About the owned fixture</p> }\n')
put('src/pages/GeneratedPage.tsx', '// @generated — do not edit\nexport const generated = <p>Generated fixture</p>\n')
put('src/pages/UnsupportedPage.tsx', Buffer.from([0xff, 0xfe, 0x61]))
put('src/pages/OversizedPage.tsx', Buffer.alloc(1_000_001, 0x61))
put('src/pages/Unsupported.txt', 'EXCLUDED_PRIVATE_FILENAME_MARKER_2941')
put('src/pages/nested/deep/NotEligible.tsx', '// Excluded nested source fixture\n')
put('src/index.css', cssText)
for (const path of ['.SYSTEMX/LAN/Backup/private-backup.tsx', '.SYSTEMX/LAN/Temp/ingest/private.tsx', '.SYSTEMX/LAN/Temp/operations.jsonl', 'src/.env', 'src/pages/.private.tsx']) put(path, 'EXCLUDED_PRIVATE_CONTENT_MARKER_7419')
const external = join(temporary, 'external-owned')
mkdirSync(external, { recursive: true })
writeFileSync(join(external, 'ExternalPage.tsx'), '// EXTERNAL_LINK_TARGET_MUST_NOT_LEAK\n')
symlinkSync(join(external, 'ExternalPage.tsx'), join(fixture, 'src/pages/LinkedPage.tsx'))
rmSync(join(fixture, 'src/components/navigation'), { recursive: true, force: true })
mkdirSync(join(fixture, 'src/components'), { recursive: true })
symlinkSync(external, join(fixture, 'src/components/navigation'), process.platform === 'win32' ? 'junction' : 'dir')
const linkedTargets = { file: readlinkSync(join(fixture, 'src/pages/LinkedPage.tsx')), directory: readlinkSync(join(fixture, 'src/components/navigation')) }
const manifest = {
  schemaVersion: 1, algorithm: 'sha256', gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), nodeVersion: process.version,
  implementationInputs: Object.fromEntries(Object.entries(inputFiles).map(([path, digest]) => [`.SYSTEMX/LAN/${path}`, digest])),
  harness: { path: '.SYSTEMX/LAN/tests/source-policy-browser.mjs', sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
  protectedSourceAndSeeds: protectedOriginal,
  fixture: { homePath, homeSha256: sha(homeText), cssSha256: sha(cssText), linkedTargets: 'Owned temporary external file and directory; never user data.' },
}
writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
const freePort = () => new Promise((resolvePort, reject) => {
  const probe = createPortProbe()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close((error) => error ? reject(error) : resolvePort(port)) })
})
const port = await freePort()
let appPort, child, browserServer, browser, context, page, failure, sourceBaseline
let childOutput = ''
const checks = [], pageErrors = [], unexpectedRequests = [], browserRequests = [], loadedBrowserAssets = [], assetCaptures = [], dialogs = []
const report = {
  schemaVersion: 1, kind: 'isolated-source-access-policy-browser-evidence', startedAt: new Date().toISOString(), checks, pageErrors, unexpectedRequests, browserRequests, loadedBrowserAssets, dialogs,
  boundaries: 'Real copied LAN source-access implementation and UI against synthetic temporary source fixtures, not the compiled WebAppX application. Fresh Chromium storage. No current app source, user browser storage, providers, production or existing listeners are changed.',
}
if (process.env.SYSTEMX_SOURCE_POLICY_ATTEMPT_NOTE) report.attemptNote = process.env.SYSTEMX_SOURCE_POLICY_ATTEMPT_NOTE
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
      response.writeHead(upstream.status, Object.fromEntries(upstream.headers)); response.end(Buffer.from(await upstream.arrayBuffer())); return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html><head><title>Owned source policy fixture</title></head><body><h1 data-systemx-source="src/pages/HomePage.tsx">Owned F002 fixture</h1></body></html>')
  } catch { response.writeHead(502); response.end('Owned fixture bridge unavailable') }
})
const group = async (id, name, work) => {
  const started = new Date().toISOString()
  await work()
  checks.push({ requirementRange: `LAN-${String(id).padStart(5, '0')}–LAN-${String(id + 4).padStart(5, '0')}`, name, status: 'passed', startedAt: started, finishedAt: new Date().toISOString() })
}
try {
  await new Promise((resolveListen, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolveListen) })
  appPort = app.address().port
  const origin = `http://127.0.0.1:${appPort}`, apiBase = `${origin}/__systemx/api/builder/source`
  report.origin = origin
  child = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], {
    cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_GOOGLE_FONTS_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  report.ownedProcesses = { harness: process.pid, lan: child.pid }
  const execution = () => writeFileSync(join(evidence, 'execution.json'), `${JSON.stringify({ ...report.ownedProcesses, fixture, origin }, null, 2)}\n`)
  execution()
  child.stdout.on('data', (chunk) => { childOutput += chunk.toString() })
  child.stderr.on('data', (chunk) => { childOutput += chunk.toString() })
  let healthy = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { healthy = (await fetch(`${origin}/__systemx/api/health`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* Wait only for the owned fixture child. */ }
    if (healthy) break
    if (child.exitCode !== null) throw new Error(`Owned fixture exited: ${childOutput}`)
    await delay(50)
  }
  assert.ok(healthy, childOutput)
  const html = await (await fetch(`${origin}/__systemx/`)).text()
  const token = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
  assert.ok(token)
  const get = async (suffix = '') => {
    const response = await fetch(`${apiBase}${suffix}`, { signal: AbortSignal.timeout(10000) })
    return { status: response.status, body: await response.json() }
  }
  const source = (path) => get(`?path=${encodeURIComponent(path)}`)
  const post = async (path, revision) => {
    const response = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-systemx-session': token }, body: JSON.stringify({ path, baseRevision: revision, content: '// Unauthorized generated write\n', confirmation: 'SAVE LOCAL CHANGE' }) })
    return { status: response.status, body: await response.json() }
  }
  const privateLeak = /EXCLUDED_PRIVATE|EXTERNAL_LINK_TARGET|private-backup|ingest\/private|operations\.jsonl|\/external-owned|UNINDEXED_BODY_NEEDLE_9421/
  const inventory = await get('/inventory?limit=500')
  assert.equal(inventory.status, 200)
  const workspaceId = inventory.body.workspaceId
  assert.match(workspaceId, /^[a-f0-9]{64}$/)
  report.workspaceId = workspaceId
  sourceBaseline = snapshot(fixture)
  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  report.ownedProcesses.chromium = browserServer.process().pid; execution()
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true })
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin) browserRequests.push({ method: request.method(), path: url.pathname, query: url.search })
  })
  context.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/') || !/\.(?:js|css)$/.test(url.pathname)) return
    const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`, expected = manifest.implementationInputs[path]
    assetCaptures.push(response.body().then((bytes) => loadedBrowserAssets.push({ path, status: response.status(), sha256: sha(bytes), expectedSha256: expected, matchesCopiedInput: sha(bytes) === expected })).catch((error) => loadedBrowserAssets.push({ path, error: error.message })))
  })
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() === 'GET' && url.protocol === 'https:' && url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: '/* Isolated font metadata fixture. */' })
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) {
      unexpectedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname }); return route.abort('blockedbyclient')
    }
    await route.continue()
  })
  page = await context.newPage(); page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('dialog', async (dialog) => { dialogs.push({ type: dialog.type(), message: dialog.message(), disposition: 'accepted-owned-fixture' }); await dialog.accept() })
  const bodyReads = () => browserRequests.filter((request) => request.path === '/__systemx/api/builder/source').length
  const showSource = async () => {
    await expect(page.locator('#font-source-revision')).toHaveAttribute('data-revision', sha(cssText))
    if (await page.locator('#right-panel-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#right-panel-toggle').click()
    await page.locator('[data-inspector-group-tab="build"]').click()
    await page.locator('[data-inspector-tab="source"]').click()
    if (await page.locator('#right-panel-visibility').getAttribute('aria-pressed') !== 'true') await page.locator('#right-panel-visibility').click()
    await expect(page.locator('#right-panel-visibility')).toHaveAttribute('aria-pressed', 'true')
    if (!await page.locator('#source-browser').getAttribute('open')) {
      if (!await page.locator('#source-browser').evaluate((node) => node.open)) await page.locator('#source-browser summary').click()
    }
    await expect(page.locator('#source-workspace-boundary')).toContainText(workspaceId)
  }
  await page.goto(`${origin}/__systemx/#source`, { waitUntil: 'domcontentloaded' })
  await showSource()
  const picker = page.locator('#source-file-select'), editor = page.locator('#source-editor'), save = page.locator('#save-source'), output = page.locator('#source-output')
  const metadata = page.locator('#source-file-metadata')
  const search = page.getByLabel('Search metadata', { exact: true }), extension = page.getByLabel('Extension', { exact: true })
  const refresh = async () => {
    const pending = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/api/builder/source/inventory'))
    void pending.catch(() => {})
    await page.locator('#refresh-source-inventory').click()
    const response = await pending
    assert.equal(response.status(), 200)
    await expect(page.locator('#refresh-source-inventory')).toBeEnabled()
    return response.json()
  }
  const selectAndLoad = async (path) => {
    await picker.selectOption(path)
    const pending = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/api/builder/source') && new URL(response.url()).searchParams.get('path') === path)
    void pending.catch(() => {})
    await page.locator('#load-source').click()
    return pending
  }
  const binding = async () => ({ draft: await editor.inputValue(), revision: await page.locator('#source-revision').getAttribute('data-revision') })

  await group(101, 'Browse only bounded regular eligible source metadata', async () => {
    assert.equal(inventory.body.policyRevision, 'source-access-v1')
    assert.ok(inventory.body.files.some((file) => file.path === homePath))
    assert.ok(inventory.body.files.every((file) => !file.path.includes('/nested/') && !file.path.endsWith('.txt') && !file.path.includes('LinkedPage')))
    assert.doesNotMatch(JSON.stringify(inventory.body), privateLeak)
    assert.equal(bodyReads(), 0, 'Initial source inventory must not read source bodies into the editor')
    await expect(picker.locator(`option[value="${homePath}"]`)).toHaveCount(1)
    assert.deepEqual(snapshot(fixture), sourceBaseline)
  })
  await group(106, 'Extension filters cannot expand access or read source bodies', async () => {
    await extension.selectOption('.css')
    await expect(picker.locator('option[value="src/index.css"]')).toHaveCount(1)
    const filtered = await get('/inventory?extension=.css&limit=500')
    assert.equal(filtered.status, 200); assert.ok(filtered.body.files.length > 0)
    assert.ok(filtered.body.files.every((file) => file.extension === '.css'))
    const invalid = await get('/inventory?extension=.env')
    assert.equal(invalid.status, 400)
    assert.equal(bodyReads(), 0)
    await extension.selectOption('')
  })
  await group(111, 'Stable refusal categories disclose no private neighbors or bodies', async () => {
    for (const path of ['.SYSTEMX/LAN/Backup/private-backup.tsx', '.SYSTEMX/LAN/Temp/operations.jsonl', 'src/pages/Unsupported.txt', 'src/.env']) {
      const refused = await source(path)
      assert.equal(refused.status, 400)
      assert.equal(refused.body.code, path.includes('.SYSTEMX') || path === 'src/.env' ? 'SOURCE_PATH_INVALID' : 'SOURCE_POLICY_REFUSED')
      assert.doesNotMatch(JSON.stringify(refused.body), privateLeak)
      assert.equal(Object.hasOwn(refused.body, 'content'), false)
      assert.equal(Object.hasOwn(refused.body, 'revision'), false)
    }
    assert.deepEqual(snapshot(fixture), sourceBaseline)
  })
  await group(116, 'Canonical manual selection refuses aliases before any file request', async () => {
    const reads = bodyReads()
    for (const path of ['/tmp/private.tsx', '../src/pages/HomePage.tsx', './src/pages/HomePage.tsx', 'src\\pages\\HomePage.tsx', 'src/pages/%48omePage.tsx', 'src/pages/../pages/HomePage.tsx']) {
      await page.locator('#source-canonical-path').fill(path)
      await page.locator('#select-source-path').click()
      assert.equal(bodyReads(), reads)
      const refused = await source(path)
      assert.equal(refused.status, 400); assert.equal(refused.body.code, 'SOURCE_PATH_INVALID')
    }
    await page.locator('#source-canonical-path').fill(homePath)
    await page.locator('#select-source-path').click()
    await expect(picker).toHaveValue(homePath)
    assert.equal(bodyReads(), reads, 'A canonical selection still requires a separate explicit Load')
    assert.equal((await selectAndLoad(homePath)).status(), 200)
    await expect(editor).toHaveValue(homeText)
  })
  await group(121, 'Linked files and parent directories cannot enter readable scope', async () => {
    for (const path of ['src/pages/LinkedPage.tsx', 'src/components/navigation/ExternalPage.tsx']) {
      const refused = await source(path)
      assert.equal(refused.status, 400); assert.equal(refused.body.code, 'SOURCE_LINK_REFUSED')
      assert.doesNotMatch(JSON.stringify(refused.body), /EXTERNAL_LINK_TARGET|external-owned|ExternalPage/)
    }
    assert.equal(lstatSync(join(fixture, 'src/pages/LinkedPage.tsx')).isSymbolicLink(), true)
    assert.equal(readlinkSync(join(fixture, 'src/pages/LinkedPage.tsx')), linkedTargets.file)
    assert.equal(readlinkSync(join(fixture, 'src/components/navigation')), linkedTargets.directory)
  })
  await group(126, 'Supported write kinds and unsupported structure are explicit metadata', async () => {
    const home = inventory.body.files.find((file) => file.path === homePath), css = inventory.body.files.find((file) => file.path === 'src/index.css')
    assert.equal(home.writable, true); assert.ok(home.writeKinds.includes('source-text'))
    assert.ok(home.writeKinds.includes('literal-text')); assert.ok(css.writeKinds.includes('font-imports'))
    assert.ok(inventory.body.files.every((file) => !file.writeKinds.includes('structural')))
    await picker.selectOption(homePath)
    await expect(metadata).toContainText(/write|source/i)
    await expect(metadata).toContainText(/structur/i)
  })
  await group(131, 'File size is visible before opening and oversized reads are refused whole', async () => {
    const oversized = inventory.body.files.find((file) => file.path === 'src/pages/OversizedPage.tsx')
    assert.equal(oversized.sizeBytes, 1_000_001); assert.equal(oversized.readable, false); assert.equal(oversized.reasonCode, 'SOURCE_TOO_LARGE')
    await picker.selectOption(oversized.path)
    await expect(metadata).toContainText(/1[,. ]?000[,. ]?001|1000001/)
    const before = await binding(), refused = await source(oversized.path)
    assert.equal(refused.status, 413); assert.equal(refused.body.code, 'SOURCE_TOO_LARGE')
    assert.equal(Object.hasOwn(refused.body, 'content'), false)
    assert.deepEqual(await binding(), before)
    await picker.selectOption(homePath)
  })
  await group(136, 'Generated source is labelled and read-only at UI and write API', async () => {
    const path = 'src/pages/GeneratedPage.tsx', generated = inventory.body.files.find((file) => file.path === path)
    assert.equal(generated.origin, 'generated'); assert.equal(generated.writable, false); assert.deepEqual(generated.writeKinds, [])
    assert.equal((await selectAndLoad(path)).status(), 200)
    await expect(metadata).toContainText(/generated/i)
    await expect(save).toBeDisabled()
    const before = snapshot(fixture), current = await source(path), refused = await post(path, current.body.revision)
    assert.ok([400, 403].includes(refused.status)); assert.equal(refused.body.code, 'SOURCE_GENERATED_READ_ONLY')
    assert.deepEqual(snapshot(fixture), before)
    await selectAndLoad(homePath)
  })
  await group(141, 'Runtime backups logs and ingest cannot be queried into inventory', async () => {
    for (const query of ['?search=private', '?search=operations', '?extension=.tsx&search=Backup']) {
      const result = await get(`/inventory${query}`)
      assert.equal(result.status, 200); assert.deepEqual(result.body.files, [])
      assert.doesNotMatch(JSON.stringify(result.body), privateLeak)
    }
    for (const query of ['?path=.SYSTEMX/LAN/Backup', '?root=src', '?search=a&search=b']) assert.equal((await get(`/inventory${query}`)).status, 400)
    assert.deepEqual(snapshot(fixture), sourceBaseline)
  })
  await group(146, 'Exact casing is preserved and aliases do not choose another file', async () => {
    const before = await binding()
    for (const path of ['src/pages/homepage.tsx', 'Src/pages/HomePage.tsx']) {
      const refused = await source(path)
      assert.equal(refused.status, 400)
      // A differently cased policy prefix is refused lexically, before the
      // allowlisted filename resolver needs to examine directory entries.
      assert.equal(refused.body.code, path.startsWith('Src/') ? 'SOURCE_POLICY_REFUSED' : 'SOURCE_CASE_MISMATCH')
      assert.equal(Object.hasOwn(refused.body, 'content'), false)
      assert.doesNotMatch(JSON.stringify(refused.body), /HomePage\.tsx/)
    }
    assert.deepEqual(await binding(), before)
    assert.equal((await source(homePath)).body.content, homeText)
  })
  await group(151, 'Inventory refresh preserves drafts and clears unavailable selection without next-row activation', async () => {
    const draft = `${homeText}// Unsaved retained draft\n`
    await editor.fill(draft)
    const before = await binding(), reads = bodyReads()
    await refresh()
    await expect(picker).toHaveValue(homePath)
    assert.deepEqual(await binding(), before)
    rmSync(join(fixture, homePath))
    try {
      const result = await refresh()
      assert.equal(result.complete, true)
      await expect(picker).toHaveValue('')
      assert.deepEqual(await binding(), before)
      await expect(save).toBeDisabled()
      assert.equal(bodyReads(), reads)
    } finally { put(homePath, homeText) }
    await refresh()
    await picker.selectOption(homePath)
    await expect(editor).toHaveValue(draft)
    // Capture a real complete inventory while About is absent, then restore and
    // explicitly load that known path before allowing the older absence to arrive.
    // The selector has genuine earlier metadata; no test-only option/state is injected.
    const restoredPath = 'src/pages/AboutPage.tsx', restoredText = readFileSync(join(fixture, restoredPath), 'utf8')
    rmSync(join(fixture, restoredPath))
    let releaseInventory, notifyCaptured, notifyDone
    const held = new Promise((resolveHeld) => { releaseInventory = resolveHeld })
    const captured = new Promise((resolveCaptured) => { notifyCaptured = resolveCaptured })
    const done = new Promise((resolveDone) => { notifyDone = resolveDone })
    await page.route('**/api/builder/source/inventory*', async (route) => {
      try {
        const response = await route.fetch(), oldInventory = await response.json()
        assert.equal(oldInventory.complete, true)
        assert.equal(oldInventory.files.some((file) => file.path === restoredPath), false)
        notifyCaptured()
        await held
        await route.fulfill({ response, json: oldInventory })
      } finally { notifyDone() }
    })
    try {
      await page.locator('#refresh-source-inventory').click()
      await Promise.race([captured, delay(15000).then(() => { throw new Error('Older complete inventory was not captured.') })])
      put(restoredPath, restoredText)
      assert.equal((await selectAndLoad(restoredPath)).status(), 200)
      await expect(editor).toHaveValue(restoredText)
      const newerBinding = await binding()
      releaseInventory()
      await Promise.race([done, delay(15000).then(() => { throw new Error('Older inventory did not finish after release.') })])
      await expect(page.locator('#source-inventory-status')).toContainText('SOURCE_INVENTORY_SUPERSEDED')
      await expect(picker).toHaveValue(restoredPath)
      assert.deepEqual(await binding(), newerBinding)
      await expect(save).toBeEnabled()
      report.inventoryRace = { heldCompleteSnapshotExcludedPath: restoredPath, explicitNewerLoadSurvived: true, pickerCleared: false, loadedRevision: newerBinding.revision }
    } finally {
      put(restoredPath, restoredText)
      releaseInventory()
      await Promise.race([done, delay(15000)])
      await page.unroute('**/api/builder/source/inventory*')
    }
    await refresh()
    await selectAndLoad(homePath)
    await editor.fill(draft)
  })
  await group(156, 'Search matches public filename and tags without indexing file bodies', async () => {
    const before = await binding(), reads = bodyReads()
    await search.fill('HomePage')
    await expect(picker.locator(`option[value="${homePath}"]`)).toHaveCount(1)
    await search.fill('UNINDEXED_BODY_NEEDLE_9421')
    const bodyMatch = await get('/inventory?search=UNINDEXED_BODY_NEEDLE_9421')
    assert.equal(bodyMatch.status, 200); assert.deepEqual(bodyMatch.body.files, [])
    await search.fill('')
    const tag = inventory.body.files.find((file) => file.path === homePath).tags[0]
    assert.equal(typeof tag, 'string')
    const tagMatch = await get(`/inventory?search=${encodeURIComponent(tag)}&limit=500`)
    assert.ok(tagMatch.body.files.some((file) => file.path === homePath))
    assert.equal(bodyReads(), reads); assert.deepEqual(await binding(), before)
  })
  await group(161, 'Policy provenance names the active rule and immutable revision', async () => {
    const home = inventory.body.files.find((file) => file.path === homePath)
    assert.equal(typeof home.ruleId, 'string'); assert.ok(home.ruleId.length > 0)
    await picker.selectOption(homePath)
    await expect(metadata).toContainText(home.ruleId)
    const policy = await get('/policy')
    assert.equal(policy.status, 200); assert.equal(policy.body.workspaceId, workspaceId)
    assert.ok(JSON.stringify(policy.body).includes('source-access-v1'))
    assert.ok(JSON.stringify(policy.body).includes(home.ruleId))
    assert.doesNotMatch(JSON.stringify(policy.body), privateLeak)
    report.policy = policy.body
  })
  await group(166, 'Policy proposal review is read-only and reports exact affected paths', async () => {
    const before = snapshot(fixture), reads = bodyReads(), bound = await binding()
    await page.locator('#review-source-policy').click()
    await expect(page.locator('#source-policy-review')).toContainText('source-pages-only-v1')
    assert.equal(bodyReads(), reads); assert.deepEqual(await binding(), bound)
    assert.deepEqual(snapshot(fixture), before)
    const current = await source('src/index.css')
    assert.equal(current.status, 200, 'Reviewing a narrower proposal must not apply it')
    await page.locator('#source-policy-review').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(evidence, '01-policy-proposal-and-source-browser.png') })
  })
  await group(171, 'Reviewed policy comparison reports removed rules and affected selections', async () => {
    const result = await get('/policy?compare=source-pages-only-v1&selection=src%2Findex.css')
    assert.equal(result.status, 200)
    const comparison = result.body.comparison
    assert.ok(Array.isArray(comparison.addedRules)); assert.ok(Array.isArray(comparison.removedRules)); assert.ok(comparison.removedRules.length > 0)
    assert.ok(comparison.affectedPaths.removed.includes('src/index.css'))
    assert.equal(comparison.selectionLosesEligibility, true)
    const home = await get(`/policy?compare=source-pages-only-v1&selection=${encodeURIComponent(homePath)}`)
    assert.equal(home.body.comparison.selectionLosesEligibility, false)
    assert.equal((await get('/policy?compare=unreviewed-rule')).status, 400)
    assert.deepEqual(snapshot(fixture), sourceBaseline)
  })
  await group(176, 'Unsupported source encodings refuse lossy loads while preserving open drafts', async () => {
    const before = await binding(), refused = await source('src/pages/UnsupportedPage.tsx')
    assert.equal(refused.status, 415); assert.equal(refused.body.code, 'SOURCE_ENCODING_UNSUPPORTED')
    assert.equal(Object.hasOwn(refused.body, 'content'), false); assert.equal(Object.hasOwn(refused.body, 'revision'), false)
    await picker.selectOption('src/pages/UnsupportedPage.tsx')
    const invalidMetadata = inventory.body.files.find((file) => file.path === 'src/pages/UnsupportedPage.tsx')
    if (invalidMetadata.readable === false) {
      await expect(metadata).toContainText('SOURCE_ENCODING_UNSUPPORTED')
      await expect(page.locator('#load-source')).toBeDisabled()
    } else {
      const response = await selectAndLoad('src/pages/UnsupportedPage.tsx')
      assert.equal(response.status(), 415)
      await expect(output).toContainText(/encoding|UTF-8/i)
    }
    assert.deepEqual(await binding(), before)
    // Inventory is metadata, not an exclusive lock. A file that was readable
    // when enumerated may become unsupported before a separately requested read.
    await picker.selectOption(homePath)
    put(homePath, Buffer.from([0xff, 0xfe, 0x61]))
    try {
      const response = await selectAndLoad(homePath)
      assert.equal(response.status(), 415)
      await expect(output).toContainText(/encoding|UTF-8/i)
      assert.deepEqual(await binding(), before)
    } finally { put(homePath, homeText) }
    assert.deepEqual(snapshot(fixture), sourceBaseline)
  })
  await group(181, 'Declared enumeration and result budgets truncate explicitly without link recursion', async () => {
    const limited = await get('/inventory?limit=1')
    assert.equal(limited.status, 200); assert.equal(limited.body.files.length, 1)
    assert.equal(limited.body.truncated, true); assert.equal(limited.body.complete, false)
    for (const field of ['maxDepth', 'maxEntries', 'maxResults', 'maxBytes', 'maxTextUnits']) assert.ok(Number.isInteger(limited.body.limits[field]) && limited.body.limits[field] > 0)
    const budgetFiles = Array.from({ length: 505 }, (_, index) => `src/pages/ZBudget${String(index).padStart(4, '0')}.tsx`)
    for (const path of budgetFiles) put(path, 'export const Budget = null\n')
    try {
      const bounded = await get('/inventory?limit=500')
      assert.equal(bounded.status, 200); assert.equal(bounded.body.files.length, 500)
      assert.equal(bounded.body.truncated, true); assert.equal(bounded.body.complete, false)
      assert.ok(JSON.stringify(bounded.body.omissions ?? bounded.body.omitted).length > 2)
      assert.doesNotMatch(JSON.stringify(bounded.body), /ExternalPage|LinkedPage|nested\/deep/)
    } finally { for (const path of budgetFiles) rmSync(join(fixture, path)) }
    assert.deepEqual(snapshot(fixture), sourceBaseline)
    report.enumerationLimits = limited.body.limits
  })
  await group(186, 'Workspace boundary remains visible and foreign inventories never bind', async () => {
    await expect(page.locator('#source-workspace-boundary')).toContainText(workspaceId)
    const before = await binding(), selected = await picker.inputValue(), foreignId = sha('foreign-source-inventory-fixture')
    await page.route('**/api/builder/source/inventory*', async (route) => {
      const response = await route.fetch(), body = await response.json()
      await route.fulfill({ response, json: { ...body, workspaceId: foreignId, files: [{ ...body.files[0], path: 'src/pages/ForeignOnly.tsx' }] } })
    })
    try {
      await refresh()
      await expect(picker.locator('option[value="src/pages/ForeignOnly.tsx"]')).toHaveCount(0)
      await expect(picker).toHaveValue(selected)
      assert.deepEqual(await binding(), before)
      await expect(page.locator('#source-workspace-boundary')).toContainText(workspaceId)
    } finally { await page.unroute('**/api/builder/source/inventory*') }
    await refresh()
  })
  await group(191, 'Navigation opt-in stores only revalidated nonsecret picker metadata', async () => {
    await search.fill('HomePage'); await extension.selectOption('.tsx'); await picker.selectOption(homePath)
    await page.locator('#source-navigation-opt-in').check()
    const storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((key) => key.includes('source-navigation')).map((key) => [key, localStorage.getItem(key)])))
    assert.equal(Object.keys(storage).length, 1)
    const serialized = Object.values(storage)[0]
    assert.ok(serialized.includes(homePath)); assert.ok(serialized.includes('.tsx')); assert.ok(serialized.includes('HomePage'))
    assert.doesNotMatch(serialized, /content|draft|baseRevision|session|token|UNINDEXED|Owned F002/)
    report.navigationPreference = JSON.parse(serialized)
    const beforeReload = bodyReads()
    await page.reload({ waitUntil: 'domcontentloaded' }); await showSource()
    await expect(page.locator('#source-navigation-opt-in')).toBeChecked()
    await expect(picker).toHaveValue(homePath)
    await expect(search).toHaveValue('HomePage'); await expect(extension).toHaveValue('.tsx')
    await expect(editor).toHaveValue(''); await expect(save).toBeDisabled()
    assert.equal(bodyReads(), beforeReload, 'Revalidated navigation must not auto-load content or authority')
    await page.locator('#source-navigation-opt-in').uncheck()
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('source-navigation'))), [])
    await search.fill(''); await extension.selectOption('')
  })
  await group(196, 'Explicit inventory export contains policy metadata and no file bodies or private paths', async () => {
    await refresh()
    const before = snapshot(fixture), reads = bodyReads()
    const pending = page.waitForEvent('download'); void pending.catch(() => {})
    await page.locator('#export-source-inventory').click()
    const download = await pending, path = join(evidence, 'eligible-source-inventory.json')
    assert.match(download.suggestedFilename(), /source.*inventory.*\.json$/)
    await download.saveAs(path)
    const bytes = readFileSync(path), exported = JSON.parse(bytes.toString('utf8'))
    assert.ok(Array.isArray(exported.files)); assert.ok(exported.files.some((file) => file.path === homePath))
    assert.equal(exported.workspaceId, workspaceId); assert.equal(exported.policyRevision, 'source-access-v1')
    assert.doesNotMatch(bytes.toString('utf8'), privateLeak)
    assert.doesNotMatch(bytes.toString('utf8'), /"(?:content|draftContent|currentContent|baseRevision|sessionToken)"/)
    assert.ok(exported.files.every((file) => typeof file.sizeBytes === 'number' && typeof file.ruleId === 'string'))
    assert.equal(bodyReads(), reads); assert.deepEqual(snapshot(fixture), before)
    report.inventoryExport = { sha256: sha(bytes), bytes: bytes.length, file: 'eligible-source-inventory.json', eligibleFiles: exported.files.length }
    await page.locator('#source-inventory-status').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(evidence, '02-exported-source-metadata-and-navigation.png') })
  })
  const geometry = await page.locator('.right-panel').evaluate((dock) => ({ width: dock.getBoundingClientRect().width, clientWidth: dock.clientWidth, scrollWidth: dock.scrollWidth, browserClientWidth: dock.querySelector('#source-browser').clientWidth, browserScrollWidth: dock.querySelector('#source-browser').scrollWidth }))
  assert.ok(Math.abs(geometry.width - 336) <= 1)
  assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1)
  assert.ok(geometry.browserScrollWidth <= geometry.browserClientWidth + 1)
  report.inspectorGeometry = geometry
  await Promise.all(assetCaptures)
  assert.equal(pageErrors.length, 0); assert.equal(unexpectedRequests.length, 0)
  assert.ok(loadedBrowserAssets.length >= 4)
  assert.ok(loadedBrowserAssets.every((asset) => asset.matchesCopiedInput && asset.status === 200))
  assert.deepEqual(snapshot(fixture), sourceBaseline)
  assert.equal(checks.length, 20)
  report.status = 'passed'
} catch (error) {
  failure = error; report.status = 'failed'; report.failure = { message: error.message, stack: error.stack }
  if (page) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  if (context) await context.tracing.stop({ path: join(evidence, 'trace.zip') }).catch(() => {})
  if (browser) await browser.close().catch(() => {})
  if (browserServer) await browserServer.close().catch(() => {})
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), delay(5000)])
    if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise((resolveExit) => child.once('exit', resolveExit)) }
  }
  app.closeAllConnections()
  if (app.listening) await new Promise((resolveClose) => app.close(resolveClose))
  await Promise.allSettled(assetCaptures)
  const digestIfPresent = (path) => { try { return sha(readFileSync(path)) } catch { return null } }
  report.originalSourceAndSeedsPreserved = protectedFiles.every((path) => digestIfPresent(join(root, path)) === protectedOriginal[path])
  report.implementationInputsPreserved = Object.entries(manifest.implementationInputs).every(([path, digest]) => digestIfPresent(join(root, path)) === digest)
  report.harnessPreserved = digestIfPresent(fileURLToPath(import.meta.url)) === manifest.harness.sha256
  report.fixturePreserved = sourceBaseline ? JSON.stringify(snapshot(fixture)) === JSON.stringify(sourceBaseline) : null
  report.ownedLanExited = child ? child.exitCode !== null : true
  if (report.status === 'passed' && (!report.originalSourceAndSeedsPreserved || !report.implementationInputsPreserved || !report.harnessPreserved || !report.fixturePreserved || !report.ownedLanExited)) {
    failure = new Error('A required protected-file, input, fixture, harness or owned-process invariant failed. This attempt is not accepted.')
    report.status = 'failed'; report.failure = { message: failure.message, stack: failure.stack }
  }
  report.finishedAt = new Date().toISOString()
  writeFileSync(join(evidence, 'server-output.log'), childOutput)
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify({ ...manifest, status: report.status, artifacts: regularFiles(evidence).map((path) => ({ path: relative(evidence, path), bytes: readFileSync(path).length, sha256: sha(readFileSync(path)) })) }, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true }); rmSync(external, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, checks: checks.length, originalSourceAndSeedsPreserved: report.originalSourceAndSeedsPreserved, implementationInputsPreserved: report.implementationInputsPreserved, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
