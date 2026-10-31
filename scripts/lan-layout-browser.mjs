#!/usr/bin/env node
/** Responsive LAN operator controls against real assets in an owned disposable repository. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createPortProbe } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect as browserExpect } from '@playwright/test'

const expect = browserExpect.configure({ timeout: 15000 })
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha = value => createHash('sha256').update(value).digest('hex')
const git = args => execFileSync('git', [...args], { cwd: root, encoding: 'utf8' }).trim()
const temporary = mkdtempSync(join(tmpdir(), 'webappx-layout-browser-'))
const fixture = join(temporary, 'fixture')
const evidenceRoot = process.env.SYSTEMX_LAN_LAYOUT_EVIDENCE_DIR ? resolve(process.env.SYSTEMX_LAN_LAYOUT_EVIDENCE_DIR) : temporary
mkdirSync(evidenceRoot, { recursive: true })
const evidence = mkdtempSync(join(evidenceRoot, 'layout-run-'))
const filesBelow = directory => !existsSync(directory) ? [] : readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : []
}).sort()
const snapshot = directory => Object.fromEntries(filesBelow(directory).map(path => [relative(directory, path).replaceAll('\\', '/'), sha(readFileSync(path))]))
const protectedPaths = git(['ls-files', '-z', '--', 'src', '.SYSTEMX/LAN/Research', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/.systemx/releases']).split('\0').filter(Boolean)
const protectedBefore = Object.fromEntries(protectedPaths.map(path => [path, sha(readFileSync(join(root, path)))]))
const report = { schemaVersion: 1, kind: 'isolated-lan-responsive-layout-browser-evidence', sourceRevision: git(['rev-parse', 'HEAD']), startedAt: new Date().toISOString(),
  boundary: 'Real copied LAN assets with a synthetic iframe document, temporary source files and fresh browser storage. No user browser, existing app/runtime, provider, production or real source writes. Module form submission is intentionally invalid and must perform no POST.',
  checks: [], geometry: [], requests: [], unexpectedRequests: [], pageErrors: [], assets: [] }
let child, browserServer, browser, context, page, bridge, appPort, failure, fixtureBefore, implementationInputs
let serverOutput = ''
const assetPromises = []
const port = await new Promise((resolvePort, reject) => { const probe = createPortProbe(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(error => error ? reject(error) : resolvePort(value)) }) })
const viewportCases = [{ width: 1440, height: 1024 }, { width: 1163, height: 1024 }, { width: 900, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]
const homePath = 'src/pages/HomePage.tsx'
const longPath = 'src/components/layout/ResponsiveOperatorNavigationAndReusableModuleFixture.tsx'
const documentHtml = '<!doctype html><html><head><title>Owned LAN layout fixture</title></head><body><main data-systemx-source="src/pages/HomePage.tsx"><h1 id="layout-hero" data-systemx-id="layoutHero">Responsive operator fixture</h1><section id="layout-parent"><article><div><div><div><div><div><h2 id="nested-layout-target"><span id="layout-click-span">Nested layout fixture</span></h2><p>Owned fixture text for settings and hierarchy inspection.</p></div></div></div></div></div></article></section><a id="layout-route-link" data-layout-spa href="/about">About fixture</a></main><script>document.addEventListener("click",event=>{const link=event.target.closest("a[data-layout-spa]");if(!link)return;event.preventDefault();history.pushState({},"",link.href);document.querySelector("main").dataset.systemxSource=location.pathname==="/about"?"src/pages/AboutPage.tsx":"src/pages/HomePage.tsx";window.dispatchEvent(new PopStateEvent("popstate"));});</script></body></html>'
const record = async (viewport, name, action) => {
  report.activeCheck = { viewport: viewport.width, name, startedAt: new Date().toISOString() }
  await action()
  report.checks.push({ ...report.activeCheck, status: 'passed', finishedAt: new Date().toISOString() })
  report.activeCheck = null
}
try {
  for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(root, directory), join(fixture, directory), { recursive: true,
    filter: source => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some(name => source === join(root, '.SYSTEMX/LAN', name)) })
  for (const path of ['package.json', '.SYSTEMX/INSTALLATION.json']) { mkdirSync(dirname(join(fixture, path)), { recursive: true }); cpSync(join(root, path), join(fixture, path)) }
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  implementationInputs = snapshot(join(fixture, '.SYSTEMX/LAN'))
  writeFileSync(join(fixture, homePath), 'export function HomePage() { return <main data-systemx-id="layoutRoot"><h1 data-systemx-id="layoutHero">Responsive operator fixture</h1><p>Layout fixture source.</p></main> }\n')
  mkdirSync(dirname(join(fixture, longPath)), { recursive: true })
  writeFileSync(join(fixture, longPath), 'export function ResponsiveOperatorNavigationAndReusableModuleFixture() { return <header>Reusable module fixture</header> }\n')
  fixtureBefore = snapshot(fixture)
  report.inputManifest = { schemaVersion: 1, sourceRevision: report.sourceRevision, nodeVersion: process.version,
    files: Object.fromEntries(Object.entries(implementationInputs).map(([path, hash]) => [`.SYSTEMX/LAN/${path}`, hash])),
    harness: { path: 'scripts/lan-layout-browser.mjs', sha256: sha(readFileSync(fileURLToPath(import.meta.url))) }, protectedSourceAndSeeds: protectedBefore }
  writeFileSync(join(evidence, 'input-manifest.json'), `${JSON.stringify(report.inputManifest, null, 2)}\n`)
  bridge = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${appPort}`)
      if (url.pathname.startsWith('/__systemx')) {
        const headers = { ...request.headers }; delete headers.host; delete headers.connection; delete headers['content-length']
        const upstream = await fetch(`http://127.0.0.1:${port}${url.pathname.slice('/__systemx'.length) || '/'}${url.search}`, { headers })
        response.writeHead(upstream.status, Object.fromEntries(upstream.headers)); response.end(Buffer.from(await upstream.arrayBuffer())); return
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(documentHtml)
    } catch { response.writeHead(502); response.end('Owned layout fixture unavailable') }
  })
  await new Promise((resolveListen, reject) => { bridge.once('error', reject); bridge.listen(0, '127.0.0.1', resolveListen) })
  appPort = bridge.address().port
  const origin = `http://127.0.0.1:${appPort}`
  child = spawn('node', [join(fixture, '.SYSTEMX/LAN/server.mjs')], { cwd: fixture,
    env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_GOOGLE_FONTS_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  report.ownedProcesses = { harness: process.pid, lan: child.pid }
  child.stdout.on('data', chunk => { serverOutput += chunk.toString() }); child.stderr.on('data', chunk => { serverOutput += chunk.toString() })
  let healthy = false
  for (let attempt = 0; attempt < 120; attempt += 1) { try { healthy = (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })).ok } catch { /* Only the owned fixture is polled. */ } if (healthy || child.exitCode !== null) break; await delay(50) }
  assert.ok(healthy, 'Owned layout fixture did not become healthy')
  // The standalone dashboard initializes its two ignored sample-model files on
  // first read. Qualify those exact owned-fixture startup effects before freezing
  // the no-write baseline for all browser journeys.
  const warmup = await fetch(`${origin}/__systemx/`)
  assert.equal(warmup.status, 200); await warmup.text()
  const initialized = snapshot(fixture)
  const initializationPaths = [...new Set([...Object.keys(fixtureBefore), ...Object.keys(initialized)])].filter(path => fixtureBefore[path] !== initialized[path])
  assert.ok(initializationPaths.every(path => ['.SYSTEMX/LAN/Files/component-registry.json', '.SYSTEMX/LAN/Files/local-data.json'].includes(path)), 'Unexpected owned fixture initialization effect')
  report.ownedFixtureInitialization = { paths: initializationPaths, scope: 'Ignored sample models in the owned temporary fixture only; all source and implementation inputs remain exact.' }
  fixtureBefore = initialized
  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  report.ownedProcesses.chromium = browserServer.process().pid
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  for (const viewport of viewportCases) {
    context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      report.requests.push({ viewport: viewport.width, method: request.method(), path: url.pathname })
      if (request.method() === 'GET' && url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* Owned empty font fixture. */' })
      if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) { report.unexpectedRequests.push({ viewport: viewport.width, method: request.method(), path: url.pathname }); return route.abort('blockedbyclient') }
      await route.continue()
    })
    context.on('response', response => {
      const url = new URL(response.url())
      if (url.origin !== origin || !url.pathname.startsWith('/__systemx/Website/') || !/\.(?:js|css)$/.test(url.pathname)) return
      const path = `.SYSTEMX/LAN/${url.pathname.slice('/__systemx/'.length)}`
      assetPromises.push(response.body().then(bytes => report.assets.push({ viewport: viewport.width, path, status: response.status(), sha256: sha(bytes), matchesInput: sha(bytes) === report.inputManifest.files[path] })).catch(error => report.assets.push({ path, error: error.message })))
    })
    page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(error.message))
    await page.goto(`${origin}/__systemx/#components`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#component-source option').filter({ hasText: longPath })).toHaveCount(1)
    const openLeft = async panel => { await page.locator(`.workspace-rail [data-panel-target="${panel}"]`).click(); await expect(page.locator(`#panel-${panel}`)).toBeVisible() }
    const openRight = async (group, panel) => {
      const expanded = await page.locator('#right-panel-toggle').getAttribute('aria-expanded') === 'true'
      const activeGroup = (await page.locator(`[data-inspector-group-tab="${group}"]`).getAttribute('class') ?? '').split(/\s+/).includes('active')
      // Clicking the already-open active rail group deliberately closes it.
      // Only request the group when it needs opening or changing.
      if (!expanded || !activeGroup) await page.locator(`[data-inspector-group-button="${group}"]`).click()
      await expect(page.locator('#right-panel-toggle')).toHaveAttribute('aria-expanded', 'true')
      await page.locator(`[data-inspector-tab="${panel}"]`).click()
      await expect(page.locator(`#panel-${panel}`)).toBeVisible()
    }
    const pin = async side => { const button = page.locator(`#${side}-panel-visibility`); if (await button.getAttribute('aria-pressed') !== 'true') await button.click() }
    const resize = async side => {
      const handle = page.locator(`#${side}-panel-resizer`)
      if (!await handle.isVisible()) { assert.ok(viewport.width <= 700, 'Only compact focus panes may omit resize handles'); return }
      await handle.focus()
      for (let i = 0; i < 20; i += 1) await handle.press(side === 'left' ? 'ArrowLeft' : 'ArrowRight')
      await expect(handle).toHaveAttribute('aria-valuenow', side === 'left' ? '220' : '260')
    }
    const contained = async (selector, boundary = selector) => {
      let visible = 0
      for (const locator of await page.locator(selector).all()) {
        if (!await locator.isVisible()) continue
        visible += 1
        const geometry = await locator.evaluate((node, boundarySelector) => {
        const parent = document.querySelector(boundarySelector), box = node.getBoundingClientRect(), frame = parent.getBoundingClientRect()
        return { selector: node.id || node.className, width: box.width, left: box.left, right: box.right, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          nativeTextWindow: ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName),
          frame: { left: frame.left, right: frame.right }, viewportWidth: innerWidth }
        }, boundary)
        report.geometry.push({ viewport: viewport.width, ...geometry })
        assert.ok(geometry.width > 0, `${viewport.width} ${selector} is hidden`)
        assert.ok(geometry.left >= geometry.frame.left - 1 && geometry.right <= geometry.frame.right + 1, `${viewport.width} ${selector} escapes ${boundary}`)
        if (!geometry.nativeTextWindow) assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${viewport.width} ${selector} horizontally clips content (${geometry.scrollWidth}/${geometry.clientWidth})`)
        assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1, `${viewport.width} ${selector} escapes viewport`)
      }
      assert.ok(visible > 0, `${selector} has no visible operator surface`)
    }
    const reachable = async selector => {
      const node = page.locator(selector)
      await expect(node).toBeEnabled(); await node.scrollIntoViewIfNeeded(); await node.focus()
      const reachable = await node.evaluate(element => {
        const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return { visible: box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1,
          hit: element === hit || element.contains(hit), focused: document.activeElement === element,
          box: { x: box.x, y: box.y, width: box.width, height: box.height }, hitElement: hit?.id || hit?.className || hit?.tagName || null }
      })
      report.geometry.push({ viewport: viewport.width, checkpoint: 'control-reachability', selector, ...reachable })
      assert.ok(reachable.visible && reachable.hit && reachable.focused, `${viewport.width} ${selector} is clipped, covered or keyboard-unreachable`)
    }
    await record(viewport, 'Components intrinsic width, native form and keyboard reach', async () => {
      await openLeft('components'); if (viewport.width >= 1163 || viewport.width <= 700) await pin('left')
      await resize('left')
      for (const selector of ['.left-panel', '.left-panel .panel-navigation', '.panel-switcher', '#panel-components', '#component-list', '#component-save-form']) await contained(selector, '.left-panel')
      const helpSections = page.locator('#panel-components .panel-guidance')
      assert.ok(await helpSections.count() > 0)
      for (const section of await helpSections.all()) assert.equal(await section.evaluate(node => node.open), false, 'Ordinary module guidance starts collapsed')
      const help = helpSections.first()
      await help.locator('summary').focus(); await page.keyboard.press('Enter')
      await expect(help.locator('p')).toBeVisible(); await contained('#panel-components .panel-guidance', '.left-panel')
      await help.locator('summary').press('Enter')
      await page.locator('#component-name').fill('Responsive layout fixture module')
      await page.locator('#component-source').selectOption(longPath)
      await page.locator('#component-tags').fill('responsive, navigation, fixture')
      await page.locator('#component-slots').fill('brand, navigation, actions')
      await page.locator('#component-width').selectOption('contained')
      for (const selector of ['#component-name', '#component-source', '#component-tags', '#component-slots', '#component-width', '#component-confirmation']) { await contained(selector, '.left-panel'); await reachable(selector) }
      await page.locator('#component-name').focus()
      for (const id of ['component-source', 'component-tags', 'component-slots', 'component-width', 'component-confirmation']) { await page.keyboard.press('Tab'); await expect(page.locator(`#${id}`)).toBeFocused() }
      await page.keyboard.press('Tab')
      const submit = page.locator('#component-save-form button[type="submit"]')
      await expect(submit).toBeFocused(); await submit.press('Enter')
      assert.equal(await page.locator('#component-confirmation').evaluate(node => node.validity.valueMissing), true)
      assert.equal(report.requests.filter(request => request.method === 'POST').length, 0)
      await page.locator('#component-confirmation').fill('SAVE MODULE')
      assert.equal(await page.locator('#component-save-form').evaluate(form => form.checkValidity()), true)
      await page.screenshot({ path: join(evidence, `${viewport.width}-components-form.png`) })
    })
    await record(viewport, 'Navigator nested hierarchy actions remain contained and reachable', async () => {
      await openLeft('navigator')
      await page.getByRole('searchbox', { name: 'Search live hierarchy', exact: true }).fill('#nested-layout-target')
      const row = page.getByRole('tree', { name: 'Live preview hierarchy', exact: true }).getByRole('treeitem').filter({ hasText: '#nested-layout-target' })
      await expect(row).toHaveCount(1); await row.focus(); await row.press('Enter')
      for (const selector of ['#panel-navigator', '#preview-navigator-search', '.navigator-actions', '#preview-layer-tree']) await contained(selector, '.left-panel')
      await reachable('#preview-navigator-clear'); await page.locator('#preview-navigator-clear').click()
      const parent = page.getByRole('tree', { name: 'Live preview hierarchy', exact: true }).getByRole('treeitem').filter({ hasText: '#layout-parent' })
      await expect(parent).toHaveCount(1); await parent.focus()
      if (await parent.getAttribute('aria-expanded') !== 'true') await parent.press('ArrowRight')
      await expect(parent).toHaveAttribute('aria-expanded', 'true')
      await parent.press('ArrowLeft'); await expect(parent).toHaveAttribute('aria-expanded', 'false')
      await parent.press('ArrowRight'); await expect(parent).toHaveAttribute('aria-expanded', 'true')
      await reachable('#preview-navigator-reveal'); await page.locator('#preview-navigator-reveal').click()
    })
    await record(viewport, 'Right Style Settings Code and identity controls fit minimum width', async () => {
      await openRight('design', 'style'); if (viewport.width >= 1163 || viewport.width <= 700) await pin('right')
      await resize('right')
      for (const selector of ['.right-panel', '.inspector-tabs', '.inspector-group-tabs', '.inspector-subtabs', '#panel-style']) await contained(selector, '.right-panel')
      await reachable('#font-search'); await page.locator('#font-search').fill('Inter')
      await openRight('design', 'settings'); await contained('#panel-settings', '.right-panel')
      await openRight('build', 'source')
      await page.locator('#source-file-select').selectOption(homePath)
      for (const selector of ['#panel-source', '.source-toolbar', '#source-editor', '#source-identity-panel']) await contained(selector, '.right-panel')
      await reachable('#identity-import-preview'); await reachable('#identity-reopen-json')
      await page.screenshot({ path: join(evidence, `${viewport.width}-identity-controls.png`) })
    })
    await record(viewport, 'Effective sidebar focus pinning collapse and reopen', async () => {
      if (viewport.width <= 700) {
        await openLeft('components'); await pin('left')
        await expect(page.locator('.builder-shell')).toHaveAttribute('data-compact-panel', 'left')
        assert.equal(await page.locator('.right-panel').evaluate(node => node.inert), true)
        await expect(page.locator('#left-panel-toggle')).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('#right-panel-toggle')).toHaveAttribute('aria-expanded', 'false')
        await openRight('build', 'source'); await pin('right')
        await expect(page.locator('.builder-shell')).toHaveAttribute('data-compact-panel', 'right')
        assert.equal(await page.locator('.left-panel').evaluate(node => node.inert), true)
        await expect(page.locator('#left-panel-toggle')).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('#right-panel-toggle')).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('#right-panel-visibility')).toHaveAttribute('aria-pressed', 'true')
        await page.setViewportSize({ width: 1440, height: viewport.height })
        await expect(page.locator('.left-panel')).toBeVisible(); await expect(page.locator('.right-panel')).toBeVisible()
        await page.setViewportSize(viewport)
      }
      for (const side of ['left', 'right']) {
        if (side === 'left') await openLeft('components'); else await openRight('build', 'source')
        await page.locator(`#${side}-panel-toggle`).click()
        await expect(page.locator(`#${side}-panel-toggle`)).toHaveAttribute('aria-expanded', 'false')
        assert.equal(await page.locator(`.${side}-panel`).evaluate(node => node.inert), true)
        await page.locator(`#${side}-panel-toggle`).click()
        await expect(page.locator(`#${side}-panel-toggle`)).toHaveAttribute('aria-expanded', 'true')
      }
    })
    await record(viewport, 'Toolbar footer menus and accessible symbols have usable bounds', async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const left = await page.locator('#left-panel-toggle').getAttribute('aria-expanded') === 'true'
        const right = await page.locator('#right-panel-toggle').getAttribute('aria-expanded') === 'true'
        if (!left && !right) break
        await page.locator(left ? '#left-panel-toggle' : '#right-panel-toggle').click()
      }
      await expect(page.locator('.canvas-workspace')).toBeVisible()
      await contained('.builder-toolbar'); await contained('.canvas-application-bar')
      await reachable('#workspace-menu-toggle'); await page.locator('#workspace-menu-toggle').click()
      await expect(page.locator('#workspace-menu')).toBeVisible(); await contained('#workspace-menu')
      const headerGeometry = await page.locator('.builder-toolbar').evaluate(toolbar => {
        const box = toolbar.getBoundingClientRect(), toggle = document.querySelector('#workspace-menu-toggle').getBoundingClientRect(), menu = document.querySelector('#workspace-menu').getBoundingClientRect()
        return { toolbarRight: box.right, toolbarHeight: box.height, toggleRight: toggle.right, menuRight: menu.right, menuBottom: menu.bottom, viewportHeight: innerHeight }
      })
      report.geometry.push({ viewport: viewport.width, checkpoint: 'header-and-dropdown', ...headerGeometry })
      assert.ok(headerGeometry.toolbarRight - headerGeometry.toggleRight >= -1 && headerGeometry.toolbarRight - headerGeometry.toggleRight <= 24, 'Workspace menu toggle must stay at the header right edge')
      assert.ok(Math.abs(headerGeometry.menuRight - headerGeometry.toggleRight) <= 2, 'Dropdown must align with its own toggle edge')
      assert.ok(headerGeometry.menuBottom <= headerGeometry.viewportHeight + 1, 'Dropdown must remain vertically reachable')
      await page.locator('#workspace-menu-close').focus(); await page.keyboard.press('Tab')
      assert.equal(await page.locator('#workspace-menu').evaluate(menu => menu.contains(document.activeElement)), true)
      await page.keyboard.press('Escape')
      await expect(page.locator('#workspace-menu')).toBeHidden(); await expect(page.locator('#workspace-menu-toggle')).toBeFocused()
      const workspaceDetails = page.locator('.canvas-header details').first()
      await expect(workspaceDetails).toHaveCount(1)
      assert.equal(await workspaceDetails.evaluate(node => node.open), false, 'Secondary canvas workspace context starts collapsed')
      const canvasHeader = await page.locator('.canvas-header').boundingBox()
      report.geometry.push({ viewport: viewport.width, checkpoint: 'collapsed-canvas-header', ...canvasHeader })
      assert.ok(canvasHeader.height <= 220, 'Collapsed canvas header must leave useful preview space')
      await workspaceDetails.locator('summary').focus(); await page.keyboard.press('Enter')
      assert.equal(await workspaceDetails.evaluate(node => node.open), true)
      await contained('.canvas-header details', '.canvas-header')
      await workspaceDetails.locator('summary').press('Enter')
      const frame = await (await page.locator('#app-preview-frame').elementHandle()).contentFrame()
      assert.ok(frame)
      await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
      const previewSnapshot = async () => ({
        inner: await frame.evaluate(() => ({ width: innerWidth, height: innerHeight,
          spanWidth: document.querySelector('#layout-click-span').getBoundingClientRect().width,
          spanFont: getComputedStyle(document.querySelector('#layout-click-span')).font })),
        frame: await page.locator('#app-preview-frame').boundingBox(),
        viewportBox: await page.locator('#canvas-preview-viewport').evaluate(node => ({ width: node.getBoundingClientRect().width, clientWidth: node.clientWidth, cssWidth: getComputedStyle(node).width, boxSizing: getComputedStyle(node).boxSizing })),
        host: await page.locator('.canvas-preview-stage').evaluate(stage => ({ scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop, x: scrollX, y: scrollY })),
        device: await page.locator('#canvas-device-select').inputValue(), width: await page.locator('#canvas-width-input').inputValue(),
        left: await page.locator('#left-panel-toggle').getAttribute('aria-expanded'), right: await page.locator('#right-panel-toggle').getAttribute('aria-expanded'),
      })
      const settledPreview = async () => {
        let prior = '', repeats = 0, observed
        await expect.poll(async () => {
          observed = await previewSnapshot()
          const serialized = JSON.stringify(observed)
          repeats = serialized === prior ? repeats + 1 : 0
          prior = serialized
          return repeats
        }, { intervals: [16, 32, 64, 100], message: 'Wait for actual iframe and chrome geometry to settle after explicit operator layout changes' }).toBeGreaterThanOrEqual(3)
        return observed
      }
      for (const preset of ['ios-393', 'fit']) {
        await page.locator('#canvas-device-select').selectOption(preset)
        if (await page.locator('#preview-inspect-toggle').getAttribute('aria-pressed') !== 'true') await page.locator('#preview-inspect-toggle').click()
        const span = frame.locator('#layout-click-span')
        await span.scrollIntoViewIfNeeded()
        if (preset === 'ios-393') await expect.poll(() => frame.evaluate(() => innerWidth)).toBe(393)
        const before = await settledPreview()
        if (preset === 'ios-393') {
          assert.equal(before.inner.width, 393, 'Stable browser content width must match the requested device width, not its bordered outer box')
          assert.equal(before.frame.width, 393)
        }
        await span.click(); await expect(span).toHaveAttribute('data-systemx-inspector-selected', '')
        assert.deepEqual(await settledPreview(), before, `${viewport.width}/${preset}: selection must preserve real iframe dimensions, typography, chrome and scroll`)
        report.geometry.push({ viewport: viewport.width, checkpoint: `selection-preserves-${preset}`, snapshot: before })
      }
      await page.locator('#canvas-preview').click()
      await expect(page.locator('#preview-inspect-toggle')).toHaveAttribute('aria-pressed', 'false')
      const beforeNavigation = await settledPreview()
      await frame.locator('#layout-route-link').click()
      await frame.waitForURL(`${origin}/about`)
      await expect(page.locator('#canvas-page-select')).toHaveValue('about')
      assert.equal(new URL(await page.locator('#app-preview-frame').getAttribute('src')).pathname, '/', 'SPA navigation deliberately leaves its initial src attribute unchanged')
      assert.deepEqual(await settledPreview(), beforeNavigation, 'Interact SPA navigation preserves viewport and user device selection')
      await reachable('#evidence-toggle'); await page.locator('#evidence-toggle').click()
      await expect(page.locator('#evidence-drawer')).toBeVisible(); await contained('#evidence-drawer')
      const refreshed = page.locator('#sync-summary').evaluate(node => new Promise((resolveRefresh, rejectRefresh) => {
        const timer = setTimeout(() => { observer.disconnect(); rejectRefresh(new Error('Evidence refresh did not render its metadata result')) }, 15000)
        const observer = new MutationObserver(() => { clearTimeout(timer); observer.disconnect(); resolveRefresh(true) })
        observer.observe(node, { childList: true, characterData: true, subtree: true })
      }))
      void refreshed.catch(() => {})
      const beforeRefresh = await settledPreview()
      await page.locator('#refresh-sync').click(); await refreshed
      assert.equal(new URL(frame.url()).pathname, '/about', 'Metadata refresh must retain the actual SPA route')
      await expect(page.locator('#canvas-page-select')).toHaveValue('about')
      assert.deepEqual(await settledPreview(), beforeRefresh, 'Metadata refresh cannot change the active viewport')
      await page.locator('#evidence-toggle').click()
      await page.locator('#canvas-page-select').selectOption('home')
      await frame.waitForURL(`${origin}/`)
      await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
      await expect(page.locator('#canvas-page-select')).toHaveValue('home')
      assert.deepEqual(await settledPreview(), beforeNavigation, 'Page picker must navigate from actual SPA About to Home despite an unchanged src attribute')
      await reachable('#canvas-device-select'); await page.locator('#canvas-device-select').selectOption('ios-393')
      await reachable('#canvas-fit-toggle'); await page.locator('#canvas-fit-toggle').click()
      await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeVisible()
      const badSymbols = await page.locator('.module-symbol,.panel-tab-symbol,.rail-icon').evaluateAll(nodes => nodes.filter(node => node.getAttribute('aria-hidden') !== 'true').map(node => node.className))
      assert.deepEqual(badSymbols, [])
      await expect(page.getByRole('link', { name: 'Reusable components', exact: true })).toHaveCount(1)
      await openLeft('canvas')
      assert.ok(await page.getByRole('button', { name: 'Reusable module', exact: true }).count() > 0)
      const quickFind = page.locator('#left-panel-quick-find'), command = page.locator('#builder-command-input')
      const overlayNeeded = !await command.isVisible()
      await reachable('#left-panel-quick-find'); await quickFind.click()
      await expect(command).toBeVisible(); await expect(command).toBeFocused()
      await contained('#builder-command-input', '.builder-toolbar')
      await command.press('Escape')
      if (overlayNeeded) await expect(quickFind).toBeFocused()
      await page.keyboard.press('Meta+k')
      await expect(command).toBeVisible(); await expect(command).toBeFocused()
      await command.press('Escape')
      if (overlayNeeded) await expect(quickFind).toBeFocused()
      await page.screenshot({ path: join(evidence, `${viewport.width}-shell-footer.png`) })
    })
    await context.tracing.stop({ path: join(evidence, `${viewport.width}-trace.zip`) }); await context.close(); context = null; page = null
  }
  await Promise.all(assetPromises)
  assert.equal(report.checks.length, 25); assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedRequests, [])
  assert.ok(report.assets.length >= 20 && report.assets.every(asset => asset.status === 200 && asset.matchesInput))
  assert.deepEqual(snapshot(fixture), fixtureBefore)
  report.status = 'passed'
} catch (error) {
  failure = error; report.status = 'failed'; report.failure = { message: error.message, stack: error.stack }
  if (page) await page.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {})
} finally {
  if (context) { await context.tracing.stop({ path: join(evidence, 'failure-trace.zip') }).catch(() => {}); await context.close().catch(() => {}) }
  if (browser) await browser.close().catch(() => {}); if (browserServer) await browserServer.close().catch(() => {})
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), delay(5000)]); if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise(resolveExit => child.once('exit', resolveExit)) } }
  if (bridge) { bridge.closeAllConnections(); if (bridge.listening) await new Promise(resolveClose => bridge.close(resolveClose)) }
  await Promise.allSettled(assetPromises)
  report.protectedFilesPreserved = protectedPaths.every(path => { try { return sha(readFileSync(join(root, path))) === protectedBefore[path] } catch { return false } })
  report.fixturePreserved = fixtureBefore ? JSON.stringify(snapshot(fixture)) === JSON.stringify(fixtureBefore) : null
  const finalFixture = snapshot(fixture)
  report.fixtureChanges = fixtureBefore ? [...new Set([...Object.keys(fixtureBefore), ...Object.keys(finalFixture)])].filter(path => fixtureBefore[path] !== finalFixture[path]) : null
  report.inputChanges = report.inputManifest ? Object.entries(report.inputManifest.files).filter(([path, hash]) => { try { return sha(readFileSync(join(root, path))) !== hash } catch { return true } }).map(([path]) => path) : null
  report.harnessPreserved = report.inputManifest ? sha(readFileSync(fileURLToPath(import.meta.url))) === report.inputManifest.harness.sha256 : null
  report.ownedLanExited = !child || child.exitCode !== null
  if (report.status === 'passed' && (!report.protectedFilesPreserved || !report.fixturePreserved || !report.harnessPreserved || !report.ownedLanExited || report.inputChanges.length)) { failure = new Error('Layout evidence preservation or input freshness failed'); report.status = 'failed'; report.failure = { message: failure.message } }
  report.finishedAt = new Date().toISOString()
  writeFileSync(join(evidence, 'server-output.log'), serverOutput); writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(evidence, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, artifacts: filesBelow(evidence).map(path => ({ path: relative(evidence, path), sha256: sha(readFileSync(path)), bytes: readFileSync(path).length })) }, null, 2)}\n`)
  rmSync(fixture, { recursive: true, force: true })
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, protectedFilesPreserved: report.protectedFilesPreserved, fixturePreserved: report.fixturePreserved, inputChanges: report.inputChanges, ownedLanExited: report.ownedLanExited, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
