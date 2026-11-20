import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectExternalProject } from '../Builder/importer/current-repo.mjs'

const source = fileURLToPath(new URL('../', import.meta.url))
const fixtures = Array.from({ length: 217 }, (_, index) => ({
  family: 'Fixture ' + String(index + 1).padStart(3, '0'), category: index < 213 ? 'serif' : 'display',
  variants: ['regular'], subsets: ['latin'],
}))
fixtures[0].variants = Array.from({ length: 35 }, (_, i) => String(100 + i))
fixtures[0].axes = [{ tag: 'wght', start: 100, end: 900, internal: 'provider detail' }, null]
fixtures[0].subsets.push('x'.repeat(1000))

async function withFontServer(mode, action) {
  const fixture = mkdtempSync(join(tmpdir(), 'webappx-font-window-'))
  const lan = join(fixture, '.SYSTEMX', 'LAN')
  const excluded = new Set(['tests', 'Files', 'Temp', 'Backup', 'Research'])
  cpSync(source, lan, { recursive: true, filter: path => !excluded.has(basename(path)) })
  cpSync(join(source, '../../package.json'), join(fixture, 'package.json'))
  writeFileSync(join(lan, 'Builder/contracts/font-catalog.json'), JSON.stringify({ families: fixtures }))
  const stub = join(fixture, 'font-provider.mjs')
  writeFileSync(stub, `globalThis.fetch = async () => {
    if (process.env.FONT_FIXTURE_MODE === 'empty') return Response.json({ items: [] })
    throw new Error('Fixture provider diagnostic that belongs to the provider.')
  }`)
  const child = spawn(process.execPath, ['--import', pathToFileURL(stub).href, join(lan, 'server.mjs')], {
    cwd: fixture,
    env: { ...process.env, SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_STRICT_PORT: 'false',
      SYSTEMX_GOOGLE_FONTS_API_KEY: mode === 'offline' ? '' : 'fictional-fixture-key', FONT_FIXTURE_MODE: mode },
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const stopped = once(child, 'exit')
  try {
    const [ready] = await once(createInterface({ input: child.stdout }), 'line', { signal: AbortSignal.timeout(7_000) })
    const origin = ready.match(/^\[SYSTEMX LAN\] (http:\/\/127\.0\.0\.1:\d+)\/$/)?.[1]
    assert.ok(origin)
    await action(async (search = '') => {
      const response = await fetch(origin + '/api/fonts/catalog' + search)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('x-systemx-representation'), 'complete')
      return response.json()
    })
  } finally {
    child.kill('SIGTERM')
    await stopped
    rmSync(fixture, { recursive: true, force: true })
  }
}

test('real font catalog reports omitted matching families and filters the entire curated catalog', async () => {
  await withFontServer('offline', async get => {
    for (const [query, total, count] of [
      ['', 217, 200], ['?category=serif', 213, 200], ['?q=fixture%202&category=display', 4, 4],
      ['?q=217', 1, 1], ['?q=unknown', 0, 0],
    ]) {
      const catalog = await get(query)
      assert.deepEqual([catalog.total, catalog.count, catalog.items.length, catalog.limit, catalog.omittedCount, catalog.truncated],
        [total, count, count, 200, total - count, total > count], query)
      assert.equal(catalog.source, 'curated-google-fonts-fallback')
      if (query === '?q=217') assert.equal(catalog.items[0].family, 'Fixture 217')
      if (query === '') {
        const first = catalog.items[0]
        assert.deepEqual(first.omitted, { variants: 3, subsets: 1, axes: 1 })
        assert.deepEqual(first.axes, [{ tag: 'wght', start: 100, end: 900 }])
        assert.equal(first.subsets.length, 1)
      }
    }
  })
})

test('an empty or unavailable font provider reports a bounded warning and the actual fallback source', async () => {
  for (const mode of ['empty', 'unavailable']) {
    await withFontServer(mode, async get => {
      const catalog = await get('?q=217')
      assert.equal(catalog.source, 'curated-google-fonts-fallback')
      assert.equal(catalog.items[0].source, 'curated-google-fonts-fallback')
      assert.equal(catalog.warning, 'Live Google Fonts metadata is unavailable. Showing the checked-in catalog.')
      assert.equal(catalog.apiConfigured, true)
      assert.doesNotMatch(JSON.stringify(catalog), /fictional-fixture-key|Fixture provider diagnostic/)
    })
  }
})

test('ingest flags individual inspection windows even when the file scan itself is complete', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'webappx-ingest-window-'))
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const pages = join(fixture, 'src/pages')
  mkdirSync(pages, { recursive: true })
  const scripts = Object.fromEntries(Array.from({ length: 122 }, (_, i) => ['task' + i, 'echo fixture']))
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts }))
  for (let i = 0; i < 243; i++) writeFileSync(join(pages, 'Page' + i + '.tsx'), '')
  const manifest = inspectExternalProject(fixture)
  assert.equal(manifest.limits.truncated, true)
  assert.equal(manifest.limits.fileScanTruncated, false)
  assert.equal(manifest.pages.length, 240)
  assert.deepEqual(manifest.limits.windows.pages, { scope: 'scanned-files', total: 243, count: 240, limit: 240, omittedCount: 3 })
  assert.equal(manifest.limits.windows.scripts.omittedCount, 2)
  assert.equal(manifest.limits.windows.styles.scope, 'sourceFiles')
  assert.equal(manifest.limits.windows.components.omittedCount, 0)
})

test('file scan limit distinguishes an exactly full scan from a scan with additional files', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'webappx-ingest-limit-'))
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  for (let i = 0; i < 1200; i++) writeFileSync(join(fixture, 'sample-' + i + '.txt'), '')
  const complete = inspectExternalProject(fixture)
  assert.equal(complete.limits.filesScanned, 1200)
  assert.equal(complete.limits.truncated, false)
  writeFileSync(join(fixture, 'extra.txt'), '')
  const limited = inspectExternalProject(fixture)
  assert.equal(limited.limits.filesScanned, 1200)
  assert.equal(limited.limits.fileScanTruncated, true)
  assert.equal(limited.limits.truncated, true)
})
