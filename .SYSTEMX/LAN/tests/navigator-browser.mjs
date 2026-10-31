#!/usr/bin/env node
/**
 * Read-only navigator journeys against an explicitly supplied, already owned LAN
 * bridge. Starts only its own Chromium; never starts/stops an application server.
 *
 * node .SYSTEMX/LAN/tests/navigator-browser.mjs --origin http://127.0.0.1:5174
 * Evidence is retained under the system temporary directory. The deterministic
 * fixtures exist only in this browser's iframe document, separately from the
 * genuine Home/About journeys. No fixture is written to source or builder data.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect as browserExpect } from '@playwright/test'

const expect = browserExpect.configure({ timeout: 15000 })
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const args = process.argv.slice(2)
assert.equal(args.length, 2, 'Usage: navigator-browser.mjs --origin http://127.0.0.1:<owned-vite-port>')
assert.equal(args[0], '--origin', 'An explicitly owned --origin is required; this script never discovers or starts servers.')
const target = new URL(args[1])
assert.ok(target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  && target.port && target.pathname === '/' && !target.search && !target.hash && !target.username && !target.password,
'--origin must be a loopback HTTP origin with an explicit port and no path, query, credentials or fragment.')
const origin = target.origin
const bridge = `${origin}/__systemx/`
const evidence = mkdtempSync(join(tmpdir(), 'webappx-navigator-browser-'))
mkdirSync(evidence, { recursive: true })
const checks = []
const pageErrors = []
const requests = []
const refusedRequests = []
const webSockets = []
const protectedPaths = [
  'src', 'package.json', 'package-lock.json', '.SYSTEMX/INSTALLATION.json',
  '.SYSTEMX/GLOBAL', '.SYSTEMX/PLAN', '.SYSTEMX/MEMORY', '.SYSTEMX/WORK', '.SYSTEMX/AGENTS',
  '.SYSTEMX/.systemx/releases', '.SYSTEMX/LAN/Builder', '.SYSTEMX/LAN/Website', '.SYSTEMX/LAN/Website_Dashboard.html',
]
const mutableModelPaths = ['.SYSTEMX/LAN/Files/local-data.json', '.SYSTEMX/LAN/Files/component-registry.json']
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const listProtectedFiles = () => execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...protectedPaths], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0').filter(Boolean)
const captureProtectedBytes = () => Object.fromEntries([...new Set([...listProtectedFiles(), ...mutableModelPaths])].sort()
  .map((name) => [name, existsSync(join(repoRoot, name)) ? sha256(readFileSync(join(repoRoot, name))) : null]))
const originalProtected = captureProtectedBytes()
const runtimeSourcePaths = ['.SYSTEMX/LAN/Website/dashboard.js', '.SYSTEMX/LAN/Website/dashboard.css',
  '.SYSTEMX/LAN/Website/preview-navigator.js', '.SYSTEMX/LAN/Website_Dashboard.html']
const runtimeDigests = (snapshot) => Object.fromEntries(runtimeSourcePaths.map((path) => [path, snapshot[path] ?? null]))
writeFileSync(join(evidence, 'protected-before.json'), `${JSON.stringify(originalProtected, null, 2)}\n`)
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
let browserServer, browser, context, page, failure
const report = {
  schemaVersion: 1, kind: 'owned-live-lan-navigator-browser-evidence', origin, bridge,
  sourceRevision, evidence, startedAt: new Date().toISOString(), checks, pageErrors, requests, refusedRequests, webSockets,
  protectedFileCount: Object.keys(originalProtected).length,
  runtimeDigestsBefore: runtimeDigests(originalProtected),
  protectedSnapshotSha256Before: sha256(JSON.stringify(originalProtected)),
  boundaries: {
    serverOwnership: 'Operator supplied existing loopback stack; no application process created or stopped.',
    browserOwnership: 'Fresh Chromium server and isolated context created and closed only by this script.',
    actualApp: 'Checked-in Home/About routes rendered through the genuine same-origin Vite/LAN bridge.',
    fixture: 'Deterministic nodes injected only into the owned iframe DOM; not an application feature or persisted model.',
    network: 'GET/HEAD only; non-read methods and external hosts refused before dispatch. Same-origin Vite HMR websocket permitted.',
    publication: 'No source save, provider mutation, production deployment or owner acceptance exercised.',
  },
}
const getJson = async (path) => {
  const response = await fetch(`${bridge}${path}`, { signal: AbortSignal.timeout(15000) })
  assert.equal(response.status, 200, `GET ${path} must return 200`)
  return response.json()
}
const check = (coverage, detail) => checks.push({ coverage, detail })
try {
  const health = await getJson('api/health')
  assert.equal(health.mode, 'local-only')
  assert.equal(health.status, 'online')
  const status = await getJson('api/status')
  assert.equal(new URL(status.vite.url).origin, origin, 'Supplied bridge must describe the same Vite origin.')
  assert.equal(new URL(status.session.bridgeUrl).origin, origin)
  assert.equal(status.builder.mode, 'template-edit')
  assert.equal(status.builder.writePolicy, 'backup-diff-confirm')
  const homeSource = await getJson('api/builder/source?path=src%2Fpages%2FHomePage.tsx')
  assert.equal(homeSource.content, readFileSync(join(repoRoot, 'src/pages/HomePage.tsx'), 'utf8'),
    'Bridge Home source must match the selected worktree bytes.')
  const data = await getJson('api/builder/data')
  const homePage = data.pages.find((item) => item.route === '/')
  const aboutPage = data.pages.find((item) => item.route === '/about')
  assert.ok(homePage && aboutPage, 'Actual mapped Home and About pages are required.')
  report.runtime = { health, sessionId: status.session.id, appUrl: status.session.appUrl, firebase: status.session.firebase }
  check('actual-app', 'Online local-only LAN bridge identifies the supplied Vite origin and returns exact worktree Home source bytes.')

  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push({ method: request.method(), origin: url.origin, path: url.pathname })
    if (!['http:', 'https:'].includes(url.protocol)) { await route.continue(); return }
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if (!['GET', 'HEAD'].includes(request.method()) || !local) {
      refusedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname })
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(25000)
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('websocket', (socket) => webSockets.push({ origin: new URL(socket.url()).origin, path: new URL(socket.url()).pathname }))
  await page.goto(`${bridge}#navigator`, { waitUntil: 'domcontentloaded' })
  const tree = page.getByRole('tree', { name: 'Live preview hierarchy', exact: true })
  const search = page.getByRole('searchbox', { name: 'Search live hierarchy', exact: true })
  const summary = page.locator('#preview-layer-summary')
  const clear = page.getByRole('button', { name: 'Clear search', exact: true })
  const reveal = page.getByRole('button', { name: 'Reveal selection', exact: true })
  const frameElement = page.locator('#app-preview-frame')
  await expect(frameElement).toBeVisible()
  await expect(search).toBeVisible()
  const frameHandle = await frameElement.elementHandle()
  const frame = await frameHandle.contentFrame()
  assert.ok(frame, 'Live preview iframe must exist.')
  await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
  await expect(frame.getByRole('heading', { level: 1, name: 'WebAppX', exact: true })).toBeVisible()
  assert.equal(new URL(frame.url()).origin, origin)
  const shellState = async () => page.locator('.builder-shell').evaluate((element) => ({
    leftCollapsed: element.classList.contains('left-panel-collapsed'),
    rightCollapsed: element.classList.contains('right-panel-collapsed'),
    activeLeft: element.querySelector('[data-left-panel].is-active')?.getAttribute('data-left-panel'),
    activeRight: element.querySelector('[data-right-panel].is-active')?.getAttribute('data-right-panel'),
  }))
  const assertThreePanels = async () => {
    await expect(page.locator('.left-panel')).toBeVisible()
    await expect(page.locator('.canvas-workspace')).toBeVisible()
    await expect(page.locator('.right-panel')).toBeVisible()
    const state = await shellState()
    assert.equal(state.leftCollapsed, false)
    assert.equal(state.rightCollapsed, false)
    const bounds = await Promise.all(['.left-panel', '.canvas-workspace', '.right-panel'].map((selector) => page.locator(selector).boundingBox()))
    assert.ok(bounds.every((box) => box && box.width > 100 && box.height > 100))
    assert.ok(bounds[0].x < bounds[1].x && bounds[1].x < bounds[2].x, 'Structure, canvas and inspector keep their left-to-right arrangement.')
  }
  const namedRow = (name) => tree.getByRole('treeitem').filter({ hasText: name.startsWith('#')
    ? new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^a-zA-Z0-9_-]|$)`)
    : name })
  const searchFor = async (query, expected = query) => {
    await search.fill(query)
    const row = namedRow(expected)
    await expect(row).toHaveCount(1)
    return row
  }
  const selectFixture = async (id) => {
    const row = await searchFor(`#${id}`, `#${id}`)
    await row.click()
    await expect(frame.locator(`#${id}`)).toHaveAttribute('data-systemx-inspector-selected', '')
    return row
  }
  await assertThreePanels()
  await frame.getByRole('heading', { level: 1, name: 'WebAppX', exact: true }).click()
  await expect(frame.locator('h1')).toHaveAttribute('data-systemx-inspector-selected', '')
  await search.fill('h1')
  await expect(tree.getByRole('treeitem').filter({ hasText: /^.*h1[.# ]/ })).toHaveCount(1)
  await tree.getByRole('treeitem').filter({ hasText: /^.*h1[.# ]/ }).click()
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1)
  await expect(page.locator('#canvas-breadcrumb-element')).toContainText('h1')
  await clear.click()
  await assertThreePanels()
  await page.screenshot({ path: join(evidence, '01-actual-home-three-panels.png') })
  check('actual-app', 'Actual Home heading selects through canvas inspection and the metadata search/tree while all three builder panels remain visible.')

  // Browser-document-only fixture; no source, app workspace, database or model writes.
  await frame.evaluate(() => {
    const make = (tag, id, name, parent) => {
      const element = document.createElement(tag)
      element.id = id
      if (name) element.setAttribute('data-systemx-name', name)
      parent.append(element)
      return element
    }
    const root = make('section', 'sx-navqa-fixture', 'QA fixture root', document.body)
    root.style.padding = '16px'
    const branch = make('div', 'sx-navqa-branch', 'QA branch', root)
    const list = make('ul', 'sx-navqa-list', 'QA list', branch)
    for (let index = 1; index <= 36; index += 1) {
      const number = String(index).padStart(2, '0')
      const item = make('li', `sx-navqa-item-${number}`, `QA sibling ${number}`, list)
      item.className = 'sx-navqa-sibling'
      make('span', `sx-navqa-leaf-${number}`, `QA leaf ${number}`, item).textContent = `Fixture row ${number}`
    }
    const metadata = make('button', 'sx-navqa-id-needle', 'QA metadata target', root)
    metadata.className = 'sx-navqa-class-needle'
    metadata.type = 'button'
    metadata.textContent = 'SX_NAVQA_BODY_TEXT_4E1'
    const component = make('article', 'sx-navqa-component', '', root)
    component.setAttribute('data-systemx-component', 'QA component target')
    const input = make('input', 'sx-navqa-input', 'QA typing field', root)
    input.setAttribute('aria-label', 'QA typing field')
    input.value = 'SX_NAVQA_PRIVATE_VALUE_9D2'
    const hidden = make('div', 'sx-navqa-hidden', 'QA hidden parent', root)
    hidden.hidden = true
    make('span', 'sx-navqa-hidden-child', 'QA inherited hidden', hidden).textContent = 'Hidden fixture'
    const inert = make('button', 'sx-navqa-inert', 'QA inert target', root)
    inert.inert = true
    inert.textContent = 'Inert fixture'
    const unrendered = make('button', 'sx-navqa-unrendered', 'QA unrendered target', root)
    unrendered.style.display = 'none'
    unrendered.textContent = 'Unrendered fixture'
    const aria = make('span', 'sx-navqa-aria-hidden', 'QA ARIA hidden target', root)
    aria.setAttribute('aria-hidden', 'true')
    aria.textContent = 'ARIA fixture'
    const privateContainer = make('div', 'sx-navqa-private-container', 'QA private container', root)
    make('span', 'sx-navqa-private-child', 'QA private child', privateContainer).textContent = 'SX_NAVQA_PRIVATE_CONTAINER_7B3'
    window.__SX_NAVQA_CONTAINER_TEXT_READS__ = 0
    Object.defineProperty(privateContainer, 'textContent', { configurable: true, get() {
      window.__SX_NAVQA_CONTAINER_TEXT_READS__ += 1
      throw new Error('QA private container textContent must not be read by navigation.')
    } })
  })
  const sibling36 = await selectFixture('sx-navqa-item-36')
  await expect(sibling36).toHaveAttribute('aria-selected', 'true')
  await clear.click()
  await expect(namedRow('QA sibling ')).toHaveCount(36)
  await expect(namedRow('#sx-navqa-item-36')).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: join(evidence, '02-fixture-beyond-ten.png') })
  check('dom-fixture', 'The 36th sibling is searchable/selectable, and clearing search shows all 36 siblings instead of the legacy ten-child slice.')

  const leafDotRow = await searchFor('#sx-navqa-leaf-36', '#sx-navqa-leaf-36')
  await leafDotRow.locator('span[aria-hidden="true"]').first().click()
  await expect(frame.locator('#sx-navqa-leaf-36')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(leafDotRow).toHaveAttribute('aria-selected', 'true')
  check('dom-fixture', 'Clicking a leaf row indicator selects its real iframe leaf; the decorative dot does not behave as an empty disclosure button.')

  for (const query of ['sx-navqa-id-needle', '#sx-navqa-id-needle', 'sx-navqa-class-needle', '.sx-navqa-class-needle', 'QA metadata target']) {
    const row = await searchFor(query, '#sx-navqa-id-needle')
    await expect(row).toHaveClass(/search-match/)
  }
  await searchFor('QA component target', '#sx-navqa-component')
  await searchFor('ul', '#sx-navqa-list')
  for (const query of ['SX_NAVQA_BODY_TEXT_4E1', 'SX_NAVQA_PRIVATE_VALUE_9D2']) {
    await search.fill(query)
    await expect(tree.getByRole('treeitem')).toHaveCount(0)
    await expect(summary).toContainText('No matching element metadata')
  }
  await search.fill('zjp')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('zjp')
  assert.equal((await shellState()).activeLeft, 'navigator', 'Typing panel shortcut letters in search must preserve the active panel.')
  check('dom-fixture', 'Search accepts tags, raw/prefixed IDs/classes and authored names/components; body text and input values are excluded, and input typing retains focus.')

  await selectFixture('sx-navqa-item-36')
  await clear.click()
  const beforeKeyboard = await shellState()
  const listRow = namedRow('#sx-navqa-list')
  await listRow.focus()
  await listRow.press('ArrowLeft')
  await expect(listRow).toHaveAttribute('aria-expanded', 'false')
  await expect(namedRow('QA sibling ')).toHaveCount(0)
  await listRow.press('ArrowRight')
  await expect(listRow).toHaveAttribute('aria-expanded', 'true')
  await expect(namedRow('QA sibling ')).toHaveCount(36)
  await listRow.press('ArrowRight')
  await expect(namedRow('#sx-navqa-item-01')).toBeFocused()
  await namedRow('#sx-navqa-item-01').press('ArrowLeft')
  await expect(listRow).toBeFocused()
  await listRow.press('Home')
  await expect(tree.getByRole('treeitem').first()).toBeFocused()
  await tree.getByRole('treeitem').first().press('ArrowDown')
  await expect(tree.getByRole('treeitem').nth(1)).toBeFocused()
  await tree.getByRole('treeitem').nth(1).press('ArrowUp')
  await expect(tree.getByRole('treeitem').first()).toBeFocused()
  await tree.getByRole('treeitem').first().press('End')
  await expect(tree.getByRole('treeitem').last()).toBeFocused()
  await namedRow('#sx-navqa-item-35').focus()
  await namedRow('#sx-navqa-item-35').press('Enter')
  await expect(frame.locator('#sx-navqa-item-35')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(namedRow('#sx-navqa-item-35')).toBeFocused()
  await namedRow('#sx-navqa-item-34').focus()
  await namedRow('#sx-navqa-item-34').press('Space')
  await expect(frame.locator('#sx-navqa-item-34')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(tree.locator('[tabindex="0"]')).toHaveCount(1)
  const afterKeyboard = await shellState()
  assert.deepEqual(afterKeyboard, beforeKeyboard, 'Tree keys must not invoke legacy canvas arrow selection or change inspector/panel context.')
  const levels = await tree.getByRole('treeitem').evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('aria-level'))))
  assert.ok(levels.every((level) => Number.isInteger(level) && level >= 1))
  check('dom-fixture', 'ARIA tree has one tab stop and valid levels; Left/Right, Up/Down, Home/End and Enter/Space operate the visible tree while preserving all panel/inspector context.')

  await listRow.focus()
  await listRow.press('ArrowLeft')
  await expect(listRow).toHaveAttribute('aria-expanded', 'false')
  const beforeMutationSummary = await summary.textContent()
  await frame.evaluate(() => {
    const unrelated = document.createElement('div')
    unrelated.id = 'sx-navqa-unrelated-mutation'
    document.getElementById('sx-navqa-fixture').append(unrelated)
  })
  await expect(summary).not.toHaveText(beforeMutationSummary)
  await expect(listRow).toHaveAttribute('aria-expanded', 'false')
  await expect(namedRow('QA sibling ')).toHaveCount(0)
  await reveal.click()
  await expect(listRow).toHaveAttribute('aria-expanded', 'true')
  await expect(namedRow('#sx-navqa-item-34')).toHaveAttribute('aria-selected', 'true')
  check('dom-fixture', 'An explicitly collapsed ancestor of the selected deep node stays collapsed after an unrelated DOM mutation; explicit Reveal opens the selected path again.')

  await selectFixture('sx-navqa-private-container')
  await clear.click()
  await selectFixture('sx-navqa-private-child')
  await page.locator('.canvas-workspace-details > summary').click()
  await page.locator('#canvas-element-breadcrumbs [data-preview-breadcrumb-index]').filter({ hasText: '#sx-navqa-private-container' }).click()
  await page.locator('.canvas-workspace-details > summary').click()
  await expect(frame.locator('#sx-navqa-private-container')).toHaveAttribute('data-systemx-inspector-selected', '')
  assert.equal(await frame.evaluate(() => window.__SX_NAVQA_CONTAINER_TEXT_READS__), 0,
    'Navigator/tree and breadcrumb container selection must not aggregate container textContent.')
  for (const locator of [tree, page.locator('#canvas-element-breadcrumbs'), page.locator('#selected-element-state'), page.locator('#preview-selection-location')]) {
    await expect(locator).not.toContainText('SX_NAVQA_PRIVATE_CONTAINER_7B3')
  }
  check('dom-fixture', 'Tree and breadcrumb container selection never read a poisoned container textContent getter or expose its private child text in navigation/selection labels.')

  await selectFixture('sx-navqa-item-34')
  await clear.click()
  await page.locator('.canvas-workspace-details > summary').click()
  await page.locator('#canvas-element-breadcrumbs [data-preview-breadcrumb-index]').filter({ hasText: '#sx-navqa-list' }).click()
  await page.locator('.canvas-workspace-details > summary').click()
  await expect(frame.locator('#sx-navqa-list')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(page.locator('#canvas-breadcrumb-element')).toContainText('#sx-navqa-list')
  await selectFixture('sx-navqa-item-36')
  await search.fill('SX_NAVQA_NO_MATCH')
  await expect(tree.getByRole('treeitem')).toHaveCount(0)
  await reveal.click()
  await expect(search).toHaveValue('')
  await expect(namedRow('#sx-navqa-item-36')).toHaveAttribute('aria-selected', 'true')
  assert.ok(await frame.locator('#sx-navqa-item-36').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0
  }), 'Reveal scrolls the real iframe target into view.')
  await page.screenshot({ path: join(evidence, '03-fixture-breadcrumbs-reveal.png') })
  check('dom-fixture', 'Clickable ancestor breadcrumbs select the real ancestor; Reveal clears a hiding query, restores the selected path and scrolls the iframe target into view.')

  const availabilityIds = ['sx-navqa-hidden', 'sx-navqa-hidden-child', 'sx-navqa-inert', 'sx-navqa-unrendered', 'sx-navqa-aria-hidden']
  const availabilityState = () => frame.evaluate((ids) => ids.map((id) => {
    const element = document.getElementById(id)
    return { id, hidden: element.getAttribute('hidden'), inert: element.getAttribute('inert'), style: element.getAttribute('style'), ariaHidden: element.getAttribute('aria-hidden') }
  }), availabilityIds)
  const originalAvailability = await availabilityState()
  for (const [id, flag] of [['sx-navqa-hidden', 'hidden'], ['sx-navqa-hidden-child', 'hidden'], ['sx-navqa-inert', 'inert'], ['sx-navqa-unrendered', null]]) {
    const row = await selectFixture(id)
    if (flag) await expect(row).toContainText(`(${flag})`)
    await reveal.click()
    await expect(summary).toContainText('reveal cannot make it visible')
    assert.notEqual(await frame.evaluate(() => document.activeElement?.id), id, 'Unavailable target must not receive app focus.')
  }
  const ariaRow = await selectFixture('sx-navqa-aria-hidden')
  await expect(ariaRow).toContainText('(ARIA hidden)')
  assert.deepEqual(await availabilityState(), originalAvailability)
  check('dom-fixture', 'Hidden/inherited-hidden, inert and unrendered targets remain inspectable without changing visibility, inertness, styles or app focus; ARIA-hidden remains distinct metadata.')

  await selectFixture('sx-navqa-item-36')
  await frame.locator('#sx-navqa-item-36').evaluate((element) => element.remove())
  await expect(namedRow('#sx-navqa-item-36')).toHaveCount(0)
  await expect(page.locator('#selected-element-state')).toHaveText('Page canvas')
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  check('dom-fixture', 'Removing the selected fixture node refreshes the live hierarchy and clears stale selection.')

  await clear.click()
  await page.getByRole('combobox', { name: 'Current page', exact: true }).selectOption(aboutPage.id)
  await expect.poll(() => new URL(frame.url()).pathname).toBe('/about')
  await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
  await expect(frame.locator('h1')).toBeVisible()
  await expect(page.locator('#selected-element-state')).toHaveText(`${aboutPage.name} · ${aboutPage.route}`)
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  await expect(tree).not.toContainText('sx-navqa')
  await frame.locator('h1').click()
  await expect(frame.locator('h1')).toHaveAttribute('data-systemx-inspector-selected', '')
  await frame.goto(`${origin}/about`, { waitUntil: 'domcontentloaded' })
  await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
  await expect(frame.locator('h1')).toBeVisible()
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(0)
  await expect(page.locator('#selected-element-state')).toHaveText('Page canvas')
  for (const selector of ['#settings-text-editor', '#settings-text-preview', '#settings-text-revert', '#settings-text-save', '#style-edit-text']) {
    await expect(page.locator(selector)).toBeDisabled()
  }
  report.reloadSelectionBehavior = 'Safely cleared: no old DOM/tree markers and leaf editing disabled; fresh heading reselected successfully.'
  await frame.locator('h1').click()
  await expect(frame.locator('h1')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(tree).not.toContainText('sx-navqa')
  await page.getByRole('combobox', { name: 'Current page', exact: true }).selectOption(homePage.id)
  await expect.poll(() => new URL(frame.url()).pathname).toBe('/')
  await expect(frame.getByRole('heading', { level: 1, name: 'WebAppX', exact: true })).toBeVisible()
  await expect(page.locator('#selected-element-state')).toHaveText(`${homePage.name} · ${homePage.route}`)
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  check('actual-app', 'Actual page-picker navigation discards prior-document fixture/selection. About reload safely clears all DOM/tree selection markers and disables leaf editing; a fresh real heading is selectable, and returning Home clears it.')

  await frame.locator('h1').click()
  await expect(frame.locator('h1')).toHaveAttribute('data-systemx-inspector-selected', '')
  await frame.evaluate(() => { window.__SX_NAVQA_SAME_DOCUMENT__ = 'owned-SPA-route' })
  await page.locator('#preview-inspect-toggle').click()
  await expect(page.locator('#preview-inspect-toggle')).toHaveAttribute('aria-pressed', 'false')
  await frame.getByRole('link', { name: 'About template', exact: true }).click()
  await expect.poll(() => new URL(frame.url()).pathname).toBe('/about')
  assert.equal(await frame.evaluate(() => window.__SX_NAVQA_SAME_DOCUMENT__), 'owned-SPA-route', 'Real AppLink navigation should retain the iframe document.')
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  await expect(page.locator('#selected-element-state')).toHaveText('Page canvas')
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(0)
  await page.locator('#preview-inspect-toggle').click()
  await expect(page.locator('#preview-inspect-toggle')).toHaveAttribute('aria-pressed', 'true')
  await frame.locator('h1').click()
  await expect(frame.locator('h1')).toHaveAttribute('data-systemx-inspector-selected', '')
  await frame.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
  await expect(frame.locator('html')).toHaveAttribute('data-systemx-inspector-bound', '')
  await expect(frame.getByRole('heading', { level: 1, name: 'WebAppX', exact: true })).toBeVisible()
  await expect(frame.locator('[data-systemx-inspector-selected]')).toHaveCount(0)
  check('actual-app', 'An actual AppLink in interaction mode changes Home to About within the same iframe document, refreshes hierarchy and clears stale selection; inspection resumes on the new route.')

  await frame.evaluate(() => {
    const root = document.createElement('section')
    root.id = 'sx-navqa-bounds'
    root.setAttribute('data-systemx-name', 'QA scan bounds')
    for (let index = 0; index < 1700; index += 1) {
      const child = document.createElement('div')
      child.id = `sx-navqa-bound-${index}`
      child.className = 'sx-navqa-bound'
      root.append(child)
    }
    document.body.prepend(root)
  })
  await search.fill('.sx-navqa-bound')
  await expect(summary).toContainText('Inspection limited to 1500 nodes')
  await expect(summary).toContainText('Showing the first 120')
  assert.ok(await tree.getByRole('treeitem').count() <= 122, 'Search renders bounded matches plus their two ancestor rows.')
  await selectFixture('sx-navqa-bounds')
  await clear.click()
  const boundsRow = namedRow('#sx-navqa-bounds')
  await boundsRow.focus()
  await boundsRow.press('ArrowRight')
  await expect(boundsRow).toHaveAttribute('aria-expanded', 'true')
  await expect(summary).toContainText('Hierarchy view limited to 500 rows')
  await expect(tree.getByRole('treeitem')).toHaveCount(500)
  await search.fill('SX_NAVQA_OUTSIDE_SEARCH_RANGE')
  await expect(summary).toContainText('No matches in the inspected range; the search is incomplete')
  await expect(search).toHaveAttribute('maxlength', '160')
  await search.fill('x'.repeat(200))
  assert.ok((await search.inputValue()).length <= 160, 'The genuine search control bounds user input at 160 characters.')
  await page.screenshot({ path: join(evidence, '04-fixture-bounded-scan.png') })
  check('dom-fixture', 'A 1700-node fixture reports the 1500-node scan cap, 120-result search cap, 500-row view cap and explicitly incomplete misses; user query input is bounded to 160 characters.')

  await frame.evaluate(() => {
    document.getElementById('sx-navqa-bounds').remove()
    const root = document.createElement('section')
    root.id = 'sx-navqa-depth'
    let parent = root
    for (let index = 0; index < 45; index += 1) {
      const child = document.createElement('div')
      child.id = `sx-navqa-depth-${index}`
      parent.append(child)
      parent = child
    }
    document.body.prepend(root)
  })
  await search.fill('#sx-navqa-depth-44')
  await expect(summary).toContainText('Inspection depth limited to 40 levels')
  await expect(summary).toContainText('No matches in the inspected range; the search is incomplete')
  await expect(tree.getByRole('treeitem')).toHaveCount(0)
  await frame.locator('#sx-navqa-depth').evaluate((element) => element.remove())
  await clear.click()
  await expect(summary).not.toContainText('limited')
  await assertThreePanels()
  await page.screenshot({ path: join(evidence, '05-actual-home-final.png') })
  check('dom-fixture', 'A 45-level fixture reports the depth-40 inspection limit; removing it restores the actual Home hierarchy and three-panel shell.')

  assert.deepEqual(pageErrors, [], 'The owned page and iframe must have no uncaught browser errors.')
  assert.deepEqual(refusedRequests, [], 'No attempted write request or external-host request is expected in these local read-only journeys.')
  assert.ok(webSockets.every((socket) => socket.origin === origin.replace(/^http:/, 'ws:')), 'Only the owned Vite origin may open HMR websockets.')
  assert.deepEqual(captureProtectedBytes(), originalProtected, 'Tracked app/builder/default/seed source and local data model bytes must remain unchanged.')
  report.protectedBytesPreserved = true
  check('preservation', 'No uncaught browser errors, attempted write/external requests, unrelated websockets or protected source/model byte changes were observed.')
  report.status = 'passed'
} catch (error) {
  failure = error
  report.status = 'failed'
  report.failure = { name: error.name, message: error.message, stack: error.stack }
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  if (context) {
    await context.tracing.stop({ path: join(evidence, 'trace.zip') }).catch(() => {})
    await context.close().catch(() => {})
  }
  if (browser) await Promise.race([browser.close().catch(() => {}), delay(3000)])
  if (browserServer) {
    const closed = await Promise.race([browserServer.close().then(() => true).catch(() => false), delay(3000).then(() => false)])
    if (!closed) await Promise.race([browserServer.kill().catch(() => {}), delay(2000)])
  }
  report.finishedAt = new Date().toISOString()
  const finalProtected = captureProtectedBytes()
  report.protectedBytesPreserved = JSON.stringify(finalProtected) === JSON.stringify(originalProtected)
  report.runtimeDigestsAfter = runtimeDigests(finalProtected)
  report.protectedSnapshotSha256After = sha256(JSON.stringify(finalProtected))
  writeFileSync(join(evidence, 'protected-after.json'), `${JSON.stringify(finalProtected, null, 2)}\n`)
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ status: report.status, checks: checks.length, protectedBytesPreserved: report.protectedBytesPreserved, evidence, failure: report.failure?.message }, null, 2))
}
if (failure) process.exitCode = 1
