import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const sourcePath = 'src/pages/HomePage.tsx'
const sourceText = 'export default function HomePage() { return <h1>Policy fixture café</h1> }\r\n'
const cssText = ':root { --wtl-font-family: "Initial", serif; }\nbody { font-family: serif; }\n'
const responseBody = (value) => { try { return JSON.parse(value) } catch { return value } }

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close((error) => error ? reject(error) : resolvePort(port))
  })
})

// Record every source, backup, ingest and operation artifact, including links.
// A rejected request must not create a backup, temporary replacement or log row.
function effects(fixture) {
  const snapshot = {}
  const visit = (path, prefix) => {
    if (!existsSync(path)) return
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name), name = `${prefix}/${entry.name}`
      if (entry.isSymbolicLink()) snapshot[name] = `link:${sha(readlinkSync(file))}`
      else if (entry.isDirectory()) visit(file, name)
      else snapshot[name] = sha(readFileSync(file))
    }
  }
  visit(join(fixture, 'src'), 'src')
  visit(join(fixture, '.SYSTEMX/LAN/Backup'), 'Backup')
  visit(join(fixture, '.SYSTEMX/LAN/Temp'), 'Temp')
  return snapshot
}

function rawGet(origin, path, headers) {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest(origin + path, { headers }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (part) => { body += part })
      response.once('end', () => {
        resolveResponse({ status: response.statusCode, body: responseBody(body) })
      })
      response.once('error', reject)
    })
    request.once('error', reject)
    request.end()
  })
}

test('isolated F002 source APIs enforce metadata, policy and write boundaries without account or provider access', async (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-source-policy-api-'))
  const fixture = join(temporary, 'fixture'), lan = join(fixture, '.SYSTEMX/LAN')
  const originalLan = join(repository, '.SYSTEMX/LAN')
  const omitted = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(originalLan, name))
  cpSync(originalLan, lan, { recursive: true, filter: (path) => !omitted.includes(path) })
  cpSync(join(repository, 'package.json'), join(fixture, 'package.json'))
  const put = (path, bytes) => {
    const target = join(fixture, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    return target
  }
  put(sourcePath, sourceText)
  put('src/pages/OtherPage.tsx', 'export default function OtherPage() { return <p>Other</p> }\n')
  put('src/index.css', cssText)
  put('src/router.tsx', 'export const routes = []\n')
  put('src/config/siteControls.ts', 'export const siteControls = {}\n')
  put('src/components/layout/Frame.tsx', 'export function Frame() { return <main /> }\n')
  put('src/components/navigation/Navigation.tsx', 'export function Navigation() { return <nav /> }\n')
  put('src/components/shell/Shell.tsx', 'export function Shell() { return <div /> }\n')
  put('src/components/private/Hidden.tsx', 'PRIVATE_BODY_NEVER_RETURNED\n')
  put('src/pages/nested/HiddenPage.tsx', 'NESTED_BODY_NEVER_RETURNED\n')
  put('src/pages/env-secret.key', 'ENV_BODY_NEVER_RETURNED\n')
  put('.env', 'PRIVATE_ENV_BODY_NEVER_RETURNED=fixture\n')
  put('.SYSTEMX/LAN/Backup/private-backup.tsx', 'BACKUP_BODY_NEVER_RETURNED\n')
  put('.SYSTEMX/LAN/Temp/ingest/private-ingest.tsx', 'INGEST_BODY_NEVER_RETURNED\n')
  put('.SYSTEMX/LAN/Temp/operations.jsonl', '{"private":"LOG_BODY_NEVER_RETURNED"}\n')

  const port = await freePort(), unused = await freePort(), origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [join(lan, 'server.mjs')], {
    cwd: fixture,
    env: {
      ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(unused),
      SYSTEMX_FIREBASE_AUTH_PORT: String(unused), SYSTEMX_FIREBASE_FIRESTORE_PORT: String(unused),
      SYSTEMX_FIREBASE_STORAGE_PORT: String(unused), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_SESSION_ID: `source-policy-api-${process.pid}`, SYSTEMX_GOOGLE_FONTS_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { ready = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Await only the owned fixture. */ }
      if (ready || child.exitCode !== null) break
      await delay(50)
    }
    assert.ok(ready, `Owned source policy fixture did not start: ${output}`)
    const html = await (await fetch(origin)).text()
    const token = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(token)
    const get = async (path, headers = {}) => {
      const response = await fetch(origin + path, { headers })
      return { status: response.status, body: responseBody(await response.text()) }
    }
    const inventory = (query = '') => get(`/api/builder/source/inventory${query}`)
    const read = (path = sourcePath) => get(`/api/builder/source?path=${encodeURIComponent(path)}`)
    const post = async (path, body, headers = {}) => {
      const response = await fetch(origin + path, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': token, ...headers }, body: JSON.stringify(body),
      })
      return { status: response.status, body: responseBody(await response.text()) }
    }
    const save = (fields = {}, headers = {}) => post('/api/builder/source', {
      path: sourcePath, content: sourceText.replace('Policy fixture', 'Reviewed policy fixture'),
      baseRevision: sha(sourceText), confirmation: 'SAVE LOCAL CHANGE', ...fields,
    }, headers)
    const font = (fields = {}) => post('/api/builder/font', {
      family: 'Inter', confirmation: 'SAVE FONT CHANGE', baseRevision: sha(readFileSync(join(fixture, 'src/index.css'))), ...fields,
    })
    const assertSafe = (body) => {
      const serialized = JSON.stringify(body)
      assert.doesNotMatch(serialized, /BODY_NEVER_RETURNED|PRIVATE_ENV|LOG_BODY|PRIVATE_BODY|ENV_BODY|private-backup|private-ingest|env-secret\.key|HiddenPage|components\/private|x-systemx-session/)
      assert.ok(!serialized.includes(fixture), 'Public metadata must not reveal its absolute fixture root')
      assert.ok(!serialized.includes(temporary), 'Public metadata must not reveal temporary parent paths')
      assert.ok(!serialized.includes('Policy fixture café'), 'Public metadata must not include eligible source bodies')
    }
    const assertRefused = async (result, status, code) => {
      assert.equal(result.status, status, JSON.stringify(result.body))
      assert.equal(result.body.code, code)
      assert.equal(typeof result.body.error, 'string')
      assert.equal('content' in result.body, false)
      assertSafe(result.body)
    }

    await t.test('eligible inventory is regular, workspace-bound, bounded and contains only public metadata', async () => {
      const before = effects(fixture), result = await inventory()
      assert.equal(result.status, 200)
      const { body } = result
      assert.equal(body.schemaVersion, 1)
      assert.match(body.workspaceId, /^[a-f0-9]{64}$/)
      assert.equal(body.workspaceId, sha(`systemx-workspace\0${realpathSync(fixture)}`))
      assert.notEqual(body.workspaceId, sha(`systemx-workspace\0${realpathSync(repository)}`))
      assert.equal(body.policyRevision, 'source-access-v1')
      assert.deepEqual(new Set(body.extensions), new Set(['.tsx', '.ts', '.css']))
      assert.equal(body.complete, true)
      assert.equal(body.truncated, false)
      assert.equal(body.limits.maxBytes, 1_000_000)
      assert.equal(body.limits.maxTextUnits, 500_000)
      assert.equal(body.limits.maxDepth, 4)
      assert.equal(body.limits.maxEntries, 4000)
      assert.equal(body.limits.maxResults, 500)
      assert.deepEqual(body.files.map((file) => file.path).sort(), [
        'src/components/layout/Frame.tsx', 'src/components/navigation/Navigation.tsx', 'src/components/shell/Shell.tsx',
        'src/config/siteControls.ts', 'src/index.css', sourcePath, 'src/pages/OtherPage.tsx', 'src/router.tsx',
      ].sort())
      for (const file of body.files) {
        assert.equal(file.sizeBytes, readFileSync(join(fixture, file.path)).byteLength)
        assert.equal(file.origin, 'authored')
        assert.equal(file.writable, true)
        assert.equal(file.readable, true)
        assert.ok(file.ruleId)
        assert.ok(Array.isArray(file.tags))
        assert.ok(file.writeKinds.includes('source-text'))
        assert.equal(file.writeKinds.includes('structural'), false)
        for (const key of ['content', 'bytes', 'target', 'absolutePath', 'token', 'sessionId', 'environment']) assert.equal(key in file, false)
      }
      assert.ok(body.files.find((file) => file.path === 'src/index.css').writeKinds.includes('font-imports'))
      assertSafe(body)
      const source = await read()
      assert.equal(source.status, 200)
      assert.equal(source.body.workspaceId, body.workspaceId)
      assert.equal(source.body.content, sourceText)
      assert.equal(source.body.revision, sha(Buffer.from(sourceText)))
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('extension and metadata search do not index bodies or widen policy', async () => {
      const before = effects(fixture)
      const css = await inventory('?extension=.css')
      assert.equal(css.status, 200)
      assert.deepEqual(css.body.files.map((file) => file.path), ['src/index.css'])
      const ts = await inventory('?extension=.ts')
      assert.deepEqual(ts.body.files.map((file) => file.path), ['src/config/siteControls.ts'])
      const match = await inventory('?search=HomePage')
      assert.deepEqual(match.body.files.map((file) => file.path), [sourcePath])
      const tagMatch = await inventory('?search=source-styles')
      assert.deepEqual(tagMatch.body.files.map((file) => file.path), ['src/index.css'])
      const bodySearch = await inventory('?search=Policy%20fixture%20caf%C3%A9')
      assert.equal(bodySearch.status, 200)
      assert.deepEqual(bodySearch.body.files, [])
      const privateSearch = await inventory('?search=private')
      assert.equal(privateSearch.status, 200)
      assert.deepEqual(privateSearch.body.files, [])
      assertSafe(privateSearch.body)
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('canonical invalid paths, private paths and unsupported source kinds have stable contained refusals', async () => {
      const before = effects(fixture)
      for (const path of ['', '/src/pages/HomePage.tsx', '../src/pages/HomePage.tsx', './src/pages/HomePage.tsx', 'src//pages/HomePage.tsx', 'src/pages/../pages/HomePage.tsx', 'src\\pages\\HomePage.tsx', 'src/pages/%48omePage.tsx', 'C:/src/pages/HomePage.tsx', 'src/pages/HomePage.tsx\0']) {
        await assertRefused(await read(path), 400, 'SOURCE_PATH_INVALID')
        await assertRefused(await save({ path }), 400, 'SOURCE_PATH_INVALID')
      }
      for (const path of ['.env', '.SYSTEMX/LAN/Backup/private-backup.tsx', '.SYSTEMX/LAN/Temp/operations.jsonl', '.SYSTEMX/LAN/Temp/ingest/private-ingest.tsx']) {
        await assertRefused(await read(path), 400, 'SOURCE_PATH_INVALID')
        await assertRefused(await save({ path }), 400, 'SOURCE_PATH_INVALID')
      }
      for (const path of ['package.json', 'src/components/private/Hidden.tsx', 'src/pages/nested/HiddenPage.tsx', 'src/pages/env-secret.key']) {
        await assertRefused(await read(path), 400, 'SOURCE_POLICY_REFUSED')
        await assertRefused(await save({ path }), 400, 'SOURCE_POLICY_REFUSED')
      }
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('source path lookup preserves exact casing and handles disappearance without recreation', async () => {
      const before = effects(fixture)
      for (const path of ['src/pages/homepage.tsx']) {
        await assertRefused(await read(path), 400, 'SOURCE_CASE_MISMATCH')
        await assertRefused(await save({ path }), 400, 'SOURCE_CASE_MISMATCH')
      }
      for (const path of ['Src/pages/HomePage.tsx', 'src/Pages/HomePage.tsx']) {
        await assertRefused(await read(path), 400, 'SOURCE_POLICY_REFUSED')
        await assertRefused(await save({ path }), 400, 'SOURCE_POLICY_REFUSED')
      }
      await assertRefused(await read('src/pages/Absent.tsx'), 404, 'SOURCE_UNAVAILABLE')
      await assertRefused(await save({ path: 'src/pages/Absent.tsx' }), 404, 'SOURCE_UNAVAILABLE')
      assert.equal(existsSync(join(fixture, 'src/pages/Absent.tsx')), false)
      const home = join(fixture, sourcePath)
      rmSync(home)
      const removed = effects(fixture)
      await assertRefused(await read(), 404, 'SOURCE_UNAVAILABLE')
      await assertRefused(await save(), 404, 'SOURCE_UNAVAILABLE')
      assert.equal((await inventory()).body.files.some((file) => file.path === sourcePath), false)
      assert.deepEqual(effects(fixture), removed)
      put(sourcePath, sourceText)
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('links at file and ancestor boundaries are never enumerated, read or written', async (linkTest) => {
      const linked = 'src/pages/LinkedPage.tsx', outside = join(temporary, 'outside-source.tsx')
      writeFileSync(outside, 'LINK_BODY_NEVER_RETURNED\n')
      try { symlinkSync(outside, join(fixture, linked), 'file') } catch (error) {
        if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { linkTest.skip('Windows file-link privilege unavailable'); return }
        throw error
      }
      try {
        const before = effects(fixture)
        await assertRefused(await read(linked), 400, 'SOURCE_LINK_REFUSED')
        await assertRefused(await save({ path: linked }), 400, 'SOURCE_LINK_REFUSED')
        assert.equal((await inventory()).body.files.some((file) => file.path === linked), false)
        assert.deepEqual(effects(fixture), before)
        assert.equal(readFileSync(outside, 'utf8'), 'LINK_BODY_NEVER_RETURNED\n')
      } finally { rmSync(join(fixture, linked), { force: true }) }

      const pages = join(fixture, 'src/pages'), preserved = join(fixture, 'src/preserved-pages')
      renameSync(pages, preserved)
      symlinkSync(preserved, pages, process.platform === 'win32' ? 'junction' : 'dir')
      try {
        const before = effects(fixture)
        await assertRefused(await read(), 400, 'SOURCE_LINK_REFUSED')
        await assertRefused(await save(), 400, 'SOURCE_LINK_REFUSED')
        const listed = await inventory()
        assert.equal(listed.body.files.some((file) => file.path.startsWith('src/pages/')), false)
        assertSafe(listed.body)
        assert.deepEqual(effects(fixture), before)
      } finally { rmSync(pages); renameSync(preserved, pages) }
    })

    await t.test('directories posing as source files are refused before content or mutation effects', async () => {
      const path = 'src/pages/Directory.tsx', target = join(fixture, path)
      mkdirSync(target)
      try {
        const before = effects(fixture)
        await assertRefused(await read(path), 400, 'SOURCE_NOT_REGULAR')
        await assertRefused(await save({ path }), 400, 'SOURCE_NOT_REGULAR')
        assert.equal((await inventory()).body.files.some((file) => file.path === path), false)
        assert.deepEqual(effects(fixture), before)
      } finally { rmSync(target, { recursive: true }) }
    })

    await t.test('size metadata reports full byte size and oversized reads and writes fail without truncation', async () => {
      const path = 'src/pages/LargePage.tsx'
      for (const bytes of [Buffer.from('a'.repeat(500_001)), Buffer.from('漢'.repeat(333_334))]) {
        put(path, bytes)
        const before = effects(fixture)
        const listed = await inventory('?search=LargePage')
        assert.equal(listed.status, 200)
        assert.equal(listed.body.files.length, 1)
        assert.equal(listed.body.files[0].sizeBytes, bytes.length)
        await assertRefused(await read(path), 413, 'SOURCE_TOO_LARGE')
        await assertRefused(await save({ path, baseRevision: sha(bytes) }), 413, 'SOURCE_TOO_LARGE')
        assert.deepEqual(effects(fixture), before)
      }
      rmSync(join(fixture, path))
      const before = effects(fixture)
      await assertRefused(await save({ content: '漢'.repeat(333_334) }), 413, 'SOURCE_TOO_LARGE')
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('malformed UTF-8, UTF-16 and NUL sources are refused; UTF-8 BOM is exact and reversible', async () => {
      const path = 'src/pages/EncodingPage.tsx'
      for (const bytes of [Buffer.from([0xff, 0xfe, 0x42]), Buffer.from([0xc3, 0x28]), Buffer.from('\ufeffexport default "UTF16"', 'utf16le'), Buffer.from('export const text = "\0"')]) {
        put(path, bytes)
        const before = effects(fixture)
        await assertRefused(await read(path), 415, 'SOURCE_ENCODING_UNSUPPORTED')
        await assertRefused(await save({ path, baseRevision: sha(bytes) }), 415, 'SOURCE_ENCODING_UNSUPPORTED')
        assert.deepEqual(effects(fixture), before)
      }
      const original = Buffer.from(`\ufeff${sourceText}`)
      put(path, original)
      const before = effects(fixture), loaded = await read(path)
      assert.equal(loaded.status, 200)
      assert.equal(loaded.body.content, original.toString('utf8'))
      assert.equal(loaded.body.revision, sha(original))
      assert.deepEqual(effects(fixture), before)
      rmSync(join(fixture, path))
    })

    await t.test('generated-origin files remain readable but raw and font writes cannot create backups or logs', async () => {
      const path = 'src/pages/GeneratedPage.tsx', content = `// @generated by isolated fixture; DO NOT EDIT\n${sourceText}`
      put(path, content)
      const generatedCss = `/* @generated by isolated fixture; DO NOT EDIT */\n${cssText}`
      put('src/index.css', generatedCss)
      try {
        const before = effects(fixture)
        const listed = await inventory()
        const generated = listed.body.files.filter((file) => [path, 'src/index.css'].includes(file.path))
        assert.equal(generated.length, 2)
        for (const file of generated) {
          assert.equal(file.origin, 'generated')
          assert.equal(file.writable, false)
          assert.deepEqual(file.writeKinds, [])
        }
        const loaded = await read(path)
        assert.equal(loaded.status, 200)
        assert.equal(loaded.body.content, content)
        assert.equal(loaded.body.writable, false)
        await assertRefused(await save({ path, baseRevision: loaded.body.revision }), 403, 'SOURCE_GENERATED_READ_ONLY')
        await assertRefused(await save({ path: 'src/index.css', baseRevision: sha(generatedCss), content: cssText }), 403, 'SOURCE_GENERATED_READ_ONLY')
        await assertRefused(await font(), 403, 'SOURCE_GENERATED_READ_ONLY')
        assert.deepEqual(effects(fixture), before)
      } finally { rmSync(join(fixture, path)); put('src/index.css', cssText) }
    })

    await t.test('named reviewed policy comparison exposes exact rule and eligibility changes without applying them', async () => {
      const before = effects(fixture)
      const current = await get('/api/builder/source/policy')
      assert.equal(current.status, 200)
      assert.equal(current.body.activeRevision, 'source-access-v1')
      assert.equal(current.body.structuralEdits, false)
      const rules = new Map(current.body.rules.map((rule) => [rule.id, rule]))
      for (const file of (await inventory()).body.files) assert.ok(rules.has(file.ruleId), 'Every eligible file must name a current public rule')
      assertSafe(current.body)
      const compared = await get('/api/builder/source/policy?compare=source-pages-only-v1&selection=src%2Findex.css')
      assert.equal(compared.status, 200)
      const comparison = compared.body.comparison
      assert.ok(comparison)
      assert.equal(comparison.selectionLosesEligibility, true)
      assert.ok(comparison.removedRules.length > 0)
      assert.deepEqual(comparison.addedRules, [])
      assert.deepEqual(comparison.affectedPaths.added, [])
      assert.ok(comparison.affectedPaths.removed.includes('src/index.css'))
      assert.equal(comparison.affectedPaths.removed.includes(sourcePath), false)
      assertSafe(compared.body)
      const retained = await get(`/api/builder/source/policy?compare=source-pages-only-v1&selection=${encodeURIComponent(sourcePath)}`)
      assert.equal(retained.body.comparison.selectionLosesEligibility, false)
      const attemptedApply = await post('/api/builder/source/policy', { compare: 'source-pages-only-v1', apply: true, confirmation: 'APPLY SOURCE POLICY' })
      assert.ok(attemptedApply.status >= 400 && attemptedApply.status < 500, 'Policy review must expose no apply operation')
      const stillCurrent = await inventory('?extension=.css')
      assert.equal(stillCurrent.body.policyRevision, 'source-access-v1')
      assert.deepEqual(stillCurrent.body.files.map((file) => file.path), ['src/index.css'])
      assert.equal((await read('src/index.css')).body.writable, true)
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('invalid or ambiguous API queries cannot smuggle alternate paths or policy revisions', async () => {
      const before = effects(fixture)
      for (const query of ['?limit=0', '?limit=501', '?limit=1.5', '?limit=01', '?limit=1&limit=2', '?extension=.tsx&extension=.css', '?extension=.json', '?search=a&search=b', '?path=src/pages/HomePage.tsx', `?search=${'x'.repeat(121)}`, '?search=%00']) {
        const result = await inventory(query)
        assert.equal(result.status, 400, `Query must be refused: ${query}`)
        assert.ok(result.body.code)
        assertSafe(result.body)
      }
      for (const query of ['?compare=arbitrary-expansion', '?compare=source-pages-only-v1&compare=source-access-v1', '?rules=src/**', '?selection=src/index.css&selection=src/router.tsx']) {
        const result = await get(`/api/builder/source/policy${query}`)
        assert.equal(result.status, 400)
        assert.ok(result.body.code)
        assertSafe(result.body)
      }
      for (const query of ['?path=src/pages/HomePage.tsx&path=src/router.tsx', '?path=src/pages/HomePage.tsx&unexpected=1']) {
        const result = await get(`/api/builder/source${query}`)
        assert.equal(result.status, 400)
        assert.ok(result.body.code)
      }
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('bounded enumeration discloses result omissions and cannot expand excluded directory trees', async () => {
      for (let index = 0; index < 520; index += 1) put(`src/pages/Budget${String(index).padStart(3, '0')}.tsx`, `export const item = ${index}\n`)
      for (let index = 0; index < 20; index += 1) put(`src/pages/nested/deeper/loop${index}/Hidden.tsx`, 'EXCLUDED_DEEP_BODY_NEVER_RETURNED\n')
      const before = effects(fixture)
      const limited = await inventory('?limit=5')
      assert.equal(limited.status, 200)
      assert.equal(limited.body.files.length, 5)
      assert.equal(limited.body.truncated, true)
      assert.equal(limited.body.complete, false)
      assert.ok(limited.body.omitted > 0)
      assertSafe(limited.body)
      const maximum = await inventory('?limit=500')
      assert.equal(maximum.body.files.length, 500)
      assert.equal(maximum.body.truncated, true)
      assert.ok(maximum.body.counts)
      assert.ok(maximum.body.omissions)
      assert.equal(maximum.body.files.some((file) => file.path.includes('/nested/')), false)
      assert.deepEqual(effects(fixture), before)
      for (let index = 0; index < 520; index += 1) rmSync(join(fixture, `src/pages/Budget${String(index).padStart(3, '0')}.tsx`))
      rmSync(join(fixture, 'src/pages/nested/deeper'), { recursive: true })
    })

    await t.test('Host, Origin and token guards remain effective for the expanded read surface and source writes', async () => {
      const before = effects(fixture)
      for (const path of ['/api/builder/source/inventory', '/api/builder/source/policy', `/api/builder/source?path=${encodeURIComponent(sourcePath)}`]) {
        assert.equal((await rawGet(origin, path, { host: 'untrusted.invalid' })).status, 403)
        assert.equal((await get(path, { origin: 'https://untrusted.invalid' })).status, 403)
      }
      assert.equal((await save({}, { 'x-systemx-session': 'untrusted-token' })).status, 403)
      assert.equal((await save({}, { origin: 'https://untrusted.invalid' })).status, 403)
      assert.deepEqual(effects(fixture), before)
    })

    await t.test('an explicitly confirmed fresh source save preserves exact backup; stale retry cannot overwrite it', async () => {
      const original = readFileSync(join(fixture, sourcePath))
      const fresh = await read()
      const replacement = sourceText.replace('Policy fixture café', 'Accepted F002 fixture')
      const saved = await save({ baseRevision: fresh.body.revision, content: replacement })
      assert.equal(saved.status, 200)
      assert.equal(saved.body.status, 'saved')
      assert.equal(saved.body.revision, sha(Buffer.from(replacement)))
      assert.deepEqual(readFileSync(join(fixture, saved.body.backup)), original)
      assert.equal(readFileSync(join(fixture, sourcePath), 'utf8'), replacement)
      const before = effects(fixture)
      await assertRefused(await save({ baseRevision: fresh.body.revision }), 409, 'SOURCE_REVISION_CONFLICT')
      assert.deepEqual(effects(fixture), before)
      const log = readFileSync(join(lan, 'Temp/operations.jsonl'), 'utf8')
      assert.equal(log.trim().split('\n').length, 2)
      assert.doesNotMatch(log, /Accepted F002 fixture|Policy fixture café|x-systemx-session/)
    })
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt += 1) await delay(50)
    if (child.exitCode === null) { child.kill('SIGKILL'); for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt += 1) await delay(20) }
    assert.notEqual(child.exitCode, null, 'Owned API fixture child must terminate before cleanup')
    rmSync(temporary, { recursive: true, force: true })
  }
})
