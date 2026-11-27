import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { chromium, expect } from '@playwright/test'
import { startGraphCommandFixture } from '../graph-api/graph-command-server-fixture.mjs'

const sourcePath = 'src/pages/HomePage.tsx'
const source = 'export function HomePage() { return <main>Local session layout fixture</main> }\n'
const draft = source.replace('Local session layout fixture', 'Unsaved editor draft')
const layoutKey = 'systemx.lan.builder.layout.v4'

test('session preview URLs initialize a fresh canvas and preserve existing browser layout and drafts', { timeout: 60_000 }, async t => {
  const { root, origin } = await startGraphCommandFixture(t)
  await mkdir(join(root, 'src/pages'), { recursive: true })
  await writeFile(join(root, sourcePath), source)
  const browser = await chromium.launch({ timeout: 12_000 })
  const pageErrors = [], unexpectedRequests = []
  t.after(() => browser.close())
  async function fresh() {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') {
        return route.fulfill({ contentType: 'text/css', body: '' })
      }
      if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method()) &&
          !(request.method() === 'POST' && url.pathname === '/api/contracts/query' && request.postDataJSON()?.kind === 'query')) {
        unexpectedRequests.push(request.method() + ' ' + url.pathname)
        return route.abort()
      }
      // The fixture points app and LAN at its own ephemeral port. Supply only
      // the app iframe locally; the complete dashboard and APIs use the real server.
      if (request.isNavigationRequest() && request.frame().parentFrame()) {
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mock app</title><main>Mock app</main>' })
      }
      return route.continue()
    })
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
    return context
  }
  const launch = id => origin + '/?previewPreset=' + encodeURIComponent(id) + '#source'
  const storedSlot = page => page.evaluate(() => Object.fromEntries(
    Object.entries(localStorage).filter(([key]) => key.toLowerCase().includes('recovery'))))

  const context = await fresh()
  const page = await context.newPage()
  const picker = page.getByRole('combobox', { name: 'Preview device and snap point' })
  await page.goto(launch('tablet-820'))
  await expect(picker).toBeVisible()
  await expect(picker).toHaveValue('tablet-820')
  await expect(page.locator('#canvas-width-input')).toHaveValue('820')
  await expect(page.locator('#canvas-fit-toggle')).toHaveAttribute('aria-pressed', 'false')
  const frame = page.frameLocator('#app-preview-frame').locator('html')
  await expect.poll(() => frame.evaluate(node => node.ownerDocument.defaultView.innerWidth)).toBe(820)
  await picker.selectOption('ios-393')
  await page.reload()
  await expect(picker).toHaveValue('ios-393')
  await expect(page.locator('#canvas-width-input')).toHaveValue('393')
  await expect.poll(() => frame.evaluate(node => node.ownerDocument.defaultView.innerWidth)).toBe(393)

  await expect(page.locator('#panel-source')).toBeVisible()
  await page.locator('#source-file-select').selectOption(sourcePath)
  await page.locator('#load-source').click()
  const editor = page.locator('#source-editor')
  await expect(editor).toHaveValue(source)
  await editor.fill(draft)
  await page.locator('#source-recovery-opt-in').check()
  await page.locator('#store-source-recovery').click()
  await expect(page.locator('#source-recovery-status')).toContainText('stored explicitly')
  const before = await storedSlot(page)
  assert.ok(Object.values(before).some(value => value.includes('Unsaved editor draft')))
  const priorLayout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), layoutKey)

  const another = await context.newPage()
  await another.goto(launch('desktop-1440'))
  await expect(another.getByRole('combobox', { name: 'Preview device and snap point' })).toHaveValue('ios-393')
  await expect(another.locator('#canvas-width-input')).toHaveValue('393')
  assert.deepEqual(await another.evaluate(key => JSON.parse(localStorage.getItem(key)), layoutKey), priorLayout)
  assert.deepEqual(await storedSlot(another), before)
  await expect(editor).toHaveValue(draft)
  assert.equal(await readFile(join(root, sourcePath), 'utf8'), source)
  await context.close()

  const freshUnknown = await fresh()
  const unknown = await freshUnknown.newPage()
  await unknown.goto(launch('unrecognized-preview-size'))
  await expect(unknown.getByRole('combobox', { name: 'Preview device and snap point' })).toHaveValue('fit')
  await expect(unknown.locator('#canvas-fit-toggle')).toHaveAttribute('aria-pressed', 'true')
  await freshUnknown.close()
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedRequests, [])
})
