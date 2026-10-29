import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkSourceRevision, hashSourceRevision } from '../Builder/source-revision.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('source revisions identify exact bytes, including line endings and Unicode', () => {
  assert.equal(hashSourceRevision('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(hashSourceRevision(Buffer.from('café\r\n')), sha256(Buffer.from('café\r\n')))
  assert.notEqual(hashSourceRevision('café\r\n'), hashSourceRevision('café\n'))
  assert.notEqual(hashSourceRevision(Buffer.from([0xff])), hashSourceRevision('\ufffd'))
})

test('missing and malformed revision conditions return fixed, safe JSON', () => {
  assert.deepEqual(checkSourceRevision(undefined, 'private source'), {
    statusCode: 428, code: 'SOURCE_REVISION_REQUIRED', error: 'Reload source before saving; baseRevision is required.',
  })
  const supplied = 'sk_live_invalid-precondition-only'
  for (const invalid of [null, '', 'a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(64)}\n`, `${'a'.repeat(64)}\r\n`, 'g'.repeat(64), 123, ['a'.repeat(64)], {}, supplied]) {
    const result = checkSourceRevision(invalid, 'private source')
    assert.equal(result.statusCode, 400)
    assert.equal(result.code, 'SOURCE_REVISION_INVALID')
    assert.doesNotMatch(JSON.stringify(result), /private source|sk_live/)
    assert.deepEqual(Object.keys(result).sort(), ['code', 'error', 'statusCode'])
  }
})

test('matching revisions accept either hex case; stale results expose only a fresh hash', () => {
  const bytes = Buffer.from('current private source\r\n')
  const revision = sha256(bytes)
  assert.deepEqual(checkSourceRevision(revision.toUpperCase(), bytes), { statusCode: 200, revision })
  const stale = checkSourceRevision(sha256('old source'), bytes)
  assert.deepEqual(stale, {
    statusCode: 409, code: 'SOURCE_REVISION_CONFLICT',
    error: 'Source changed since it was loaded. Reload source before saving.', currentRevision: revision,
  })
  assert.doesNotMatch(JSON.stringify(stale), /current private source|old source/)
})

const freePort = () => new Promise((resolvePort, reject) => {
  const socket = createServer()
  socket.once('error', reject)
  socket.listen(0, '127.0.0.1', () => {
    const port = socket.address().port
    socket.close((error) => error ? reject(error) : resolvePort(port))
  })
})

function artifactSnapshot(lanRoot, sourceFile) {
  const backups = {}
  const visit = (directory, prefix = '') => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const name = `${prefix}${entry.name}`
      if (entry.isDirectory()) visit(path, `${name}/`)
      else backups[name] = sha256(readFileSync(path))
    }
  }
  visit(join(lanRoot, 'Backup'))
  const log = join(lanRoot, 'Temp', 'operations.jsonl')
  let source = null
  try {
    const entry = lstatSync(sourceFile)
    source = entry.isSymbolicLink() ? { link: readlinkSync(sourceFile) }
      : entry.isFile() ? readFileSync(sourceFile).toString('base64') : { kind: 'non-file' }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  return {
    source, backups,
    log: existsSync(log) ? readFileSync(log, 'utf8') : null,
    temporary: existsSync(dirname(sourceFile)) ? readdirSync(dirname(sourceFile)).filter((name) => name.endsWith('.tmp')).sort() : [],
  }
}

test('isolated source API rejects stale writes before backup/log/write and accepts a reviewed latest revision', async (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-source-revision-'))
  const fixture = join(temporary, 'fixture')
  const originalLan = join(repoRoot, '.SYSTEMX', 'LAN')
  const fixtureLan = join(fixture, '.SYSTEMX', 'LAN')
  const omitted = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(originalLan, name))
  cpSync(originalLan, fixtureLan, { recursive: true, filter: (path) => !omitted.includes(path) })
  cpSync(join(repoRoot, 'package.json'), join(fixture, 'package.json'))
  const relativeSource = 'src/pages/HomePage.tsx'
  const sourceFile = join(fixture, relativeSource)
  mkdirSync(dirname(sourceFile), { recursive: true })
  const original = 'export default function HomePage() { return <h1>初版</h1> }\r\n'
  const latest = 'export default function HomePage() { return <h1>Latest café</h1> }\r\n'
  const reviewed = 'export default function HomePage() { return <h1>Reviewed edit</h1> }\n'
  writeFileSync(sourceFile, original)
  const port = await freePort()
  const unusedAppPort = await freePort()
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [join(fixtureLan, 'server.mjs')], {
    cwd: fixture,
    env: {
      ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(unusedAppPort),
      SYSTEMX_FIREBASE_AUTH_PORT: String(unusedAppPort), SYSTEMX_FIREBASE_FIRESTORE_PORT: String(unusedAppPort),
      SYSTEMX_FIREBASE_STORAGE_PORT: String(unusedAppPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_SESSION_ID: `source-revision-test-${process.pid}`,
      SYSTEMX_GOOGLE_FONTS_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    let healthy = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { healthy = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Await this owned child. */ }
      if (healthy || child.exitCode !== null) break
      await delay(50)
    }
    assert.ok(healthy, `Owned source fixture did not start: ${output}`)
    const html = await (await fetch(origin)).text()
    const session = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(session, 'Owned fixture must expose its local session token')
    const requestRead = async (path = relativeSource) => {
      const response = await fetch(`${origin}/api/builder/source?path=${encodeURIComponent(path)}`)
      return { status: response.status, body: await response.json() }
    }
    const read = async () => {
      const response = await requestRead()
      assert.equal(response.status, 200)
      return response.body
    }
    const post = async (fields, options = {}) => {
      const response = await fetch(`${origin}/api/builder/source`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': session, ...options.headers },
        body: JSON.stringify({ path: relativeSource, content: reviewed, confirmation: 'SAVE LOCAL CHANGE', ...fields }),
      })
      return { status: response.status, body: await response.json() }
    }
    const postChunks = (chunks) => new Promise((resolveResponse, rejectResponse) => {
      const request = httpRequest(`${origin}/api/builder/source`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', 'x-systemx-session': session },
      }, (response) => {
        let body = ''
        response.on('data', (chunk) => { body += chunk })
        response.once('end', () => {
          try { resolveResponse({ status: response.statusCode, body: JSON.parse(body) }) } catch (error) { rejectResponse(error) }
        })
        response.once('error', rejectResponse)
      })
      request.once('error', rejectResponse)
      const write = async () => {
        for (const chunk of chunks) {
          await new Promise((resolveWrite, rejectWrite) => request.write(chunk, (error) => error ? rejectWrite(error) : resolveWrite()))
          // Separate real HTTP chunks rather than relying on one buffer's TCP
          // segmentation to happen to split a multi-byte character.
          if (chunks.length > 1) await delay(5)
        }
        request.end()
      }
      write().catch(rejectResponse)
    })
    const loaded = await read()
    assert.equal(loaded.content, original)
    assert.equal(loaded.revision, sha256(Buffer.from(original)))
    assert.equal(loaded.policy, 'backup-diff-confirm')
    assert.equal(loaded.writable, true)

    const untouched = artifactSnapshot(fixtureLan, sourceFile)
    const missing = await post({})
    assert.equal(missing.status, 428)
    assert.equal(missing.body.code, 'SOURCE_REVISION_REQUIRED')
    const invalid = await post({ baseRevision: 'sk_live_precondition-probe-only' })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.code, 'SOURCE_REVISION_INVALID')
    assert.doesNotMatch(JSON.stringify(invalid.body), /sk_live|Reviewed edit/)
    assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), untouched)

    // A second editor changes only the temporary fixture, after the first read.
    writeFileSync(sourceFile, latest)
    const afterOtherEditor = artifactSnapshot(fixtureLan, sourceFile)
    for (const content of [reviewed, latest]) {
      const stale = await post({ baseRevision: loaded.revision, content })
      assert.equal(stale.status, 409)
      assert.equal(stale.body.code, 'SOURCE_REVISION_CONFLICT')
      assert.equal(stale.body.currentRevision, sha256(Buffer.from(latest)))
      assert.deepEqual(Object.keys(stale.body).sort(), ['code', 'currentRevision', 'error'])
      assert.doesNotMatch(JSON.stringify(stale.body), /Latest café|Reviewed edit|HomePage/)
      assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), afterOtherEditor)
    }

    const fresh = await read()
    const secret = await post({ baseRevision: fresh.revision, content: 'const key = "sk_live_isolated-fixture-only"' })
    assert.equal(secret.status, 400)
    assert.match(secret.body.error, /secret-shaped/i)
    const unauthorized = await post({ baseRevision: fresh.revision }, { headers: { 'x-systemx-session': 'wrong-token' } })
    assert.equal(unauthorized.status, 403)
    assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), afterOtherEditor)

    const saved = await post({ baseRevision: fresh.revision.toUpperCase() })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.status, 'saved')
    assert.equal(saved.body.revision, sha256(Buffer.from(reviewed)))
    assert.match(saved.body.backup, /^\.SYSTEMX\/LAN\/Backup\//)
    assert.equal(readFileSync(join(fixture, saved.body.backup), 'utf8'), latest)
    assert.equal(readFileSync(sourceFile, 'utf8'), reviewed)
    const savedArtifacts = artifactSnapshot(fixtureLan, sourceFile)
    assert.equal(Object.keys(savedArtifacts.backups).length, 1)
    assert.deepEqual(savedArtifacts.temporary, [])
    const operations = savedArtifacts.log.trim().split('\n').map((line) => JSON.parse(line))
    assert.equal(operations.length, 1)
    assert.equal(operations[0].event, 'source_saved')
    assert.equal(operations[0].path, relativeSource)
    assert.doesNotMatch(savedArtifacts.log, /Latest café|Reviewed edit|sk_live|x-systemx-session/)
    const afterSaveRead = await read()
    assert.equal(afterSaveRead.revision, saved.body.revision)
    const unchanged = await post({ baseRevision: afterSaveRead.revision })
    assert.equal(unchanged.status, 200)
    assert.deepEqual(unchanged.body, { status: 'unchanged', path: relativeSource, revision: afterSaveRead.revision })
    assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), savedArtifacts)

    await t.test('deleted source returns fixed 404 guidance for GET and POST without recreating files or artifacts', async () => {
      rmSync(sourceFile)
      const unavailable = {
        code: 'SOURCE_UNAVAILABLE',
        error: 'Source is unavailable. Select an existing allowlisted source file, then reload before saving.',
      }
      const removedArtifacts = artifactSnapshot(fixtureLan, sourceFile)
      for (const result of [await requestRead(), await post({ baseRevision: afterSaveRead.revision }), await post({})]) {
        assert.equal(result.status, 404)
        assert.deepEqual(result.body, unavailable)
        assert.doesNotMatch(JSON.stringify(result.body), /HomePage|Reviewed edit|currentRevision|baseRevision|[A-Za-z]:|\/private\/|\/Users\//)
      }
      const neverCreated = await requestRead('src/pages/AbsentPage.tsx')
      assert.equal(neverCreated.status, 404)
      assert.deepEqual(neverCreated.body, unavailable)
      assert.equal(existsSync(join(fixture, 'src/pages/AbsentPage.tsx')), false)

      // Token and existing approval/content/secret validation still precede path
      // availability. An unavailable target cannot bypass those earlier guards.
      assert.equal((await post({ baseRevision: afterSaveRead.revision }, { headers: { 'x-systemx-session': 'wrong-token' } })).status, 403)
      assert.match((await post({ confirmation: 'not approved' })).body.error, /Type SAVE LOCAL CHANGE/)
      assert.match((await post({ content: null })).body.error, /content is missing/)
      assert.match((await post({ content: 'const key = "sk_live_fixture-only"' })).body.error, /Secret-shaped/)
      for (const path of ['../HomePage.tsx', 'package.json', 'src/pages/HomePage.tsx/child']) {
        assert.deepEqual(await requestRead(path), { status: 400, body: { error: 'Source path is outside the editable allowlist' } })
        assert.deepEqual(await post({ path }), { status: 400, body: { error: 'Source path is outside the editable allowlist' } })
      }
      assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), removedArtifacts)
      assert.equal(existsSync(sourceFile), false)
      writeFileSync(sourceFile, reviewed)
    })

    await t.test('replacement after a comparison remains an ordinary stale conflict and cannot force a save', async () => {
      const comparison = await read()
      const replacement = 'export default function HomePage() { return <h1>Replacement after review</h1> }\n'
      // Only the isolated fixture simulates the other editor replacing the file.
      rmSync(sourceFile)
      writeFileSync(sourceFile, replacement)
      const replacementArtifacts = artifactSnapshot(fixtureLan, sourceFile)
      const stale = await post({ baseRevision: comparison.revision, force: true, replace: true })
      assert.equal(stale.status, 409)
      assert.deepEqual(stale.body, {
        code: 'SOURCE_REVISION_CONFLICT',
        error: 'Source changed since it was loaded. Reload source before saving.',
        currentRevision: sha256(replacement),
      })
      assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), replacementArtifacts)
      const current = await read()
      assert.equal(current.content, replacement)
      assert.equal(current.revision, sha256(replacement))
      writeFileSync(sourceFile, reviewed)
    })

    await t.test('regular-file boundary refuses directories and linked files or ancestors rather than reporting them missing', async (boundaryTest) => {
      const refused = { status: 400, body: { error: 'Source path is outside the editable allowlist' } }
      const assertRefusedWithoutEffects = async () => {
        const before = artifactSnapshot(fixtureLan, sourceFile)
        assert.deepEqual(await requestRead(), refused)
        assert.deepEqual(await post({ baseRevision: afterSaveRead.revision }), refused)
        assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), before)
      }
      rmSync(sourceFile)
      mkdirSync(sourceFile)
      await assertRefusedWithoutEffects()
      rmSync(sourceFile, { recursive: true })

      const inRootTarget = join(fixture, 'src/pages/LinkTarget.tsx')
      const outsideTarget = join(temporary, 'outside-source.tsx')
      const outsideBytes = 'synthetic outside content: never expose or overwrite\n'
      writeFileSync(inRootTarget, 'synthetic linked in-root source\n')
      writeFileSync(outsideTarget, outsideBytes)
      try {
        for (const target of [inRootTarget, outsideTarget, join(temporary, 'missing-target.tsx')]) {
          try { symlinkSync(target, sourceFile, 'file') } catch (error) {
            if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
              boundaryTest.skip('File-link creation is unavailable without Windows symlink privileges')
              return
            }
            throw error
          }
          await assertRefusedWithoutEffects()
          rmSync(sourceFile)
        }
        assert.equal(readFileSync(outsideTarget, 'utf8'), outsideBytes)
        assert.equal(readFileSync(inRootTarget, 'utf8'), 'synthetic linked in-root source\n')
      } finally {
        rmSync(sourceFile, { force: true })
        writeFileSync(sourceFile, reviewed)
      }

      const pages = dirname(sourceFile)
      const preservedPages = join(fixture, 'src/preserved-pages')
      const outsidePages = join(temporary, 'outside-pages')
      mkdirSync(outsidePages)
      writeFileSync(join(outsidePages, 'HomePage.tsx'), outsideBytes)
      renameSync(pages, preservedPages)
      try {
        for (const target of [preservedPages, outsidePages, join(temporary, 'missing-pages')]) {
          symlinkSync(target, pages, process.platform === 'win32' ? 'junction' : 'dir')
          await assertRefusedWithoutEffects()
          rmSync(pages)
        }
        assert.equal(readFileSync(join(outsidePages, 'HomePage.tsx'), 'utf8'), outsideBytes)
      } finally {
        rmSync(pages, { force: true })
        renameSync(preservedPages, pages)
      }
    })

    await t.test('font changes bind exact stylesheet revisions and preserve source guards', async (fontTest) => {
      const cssFile = join(fixture, 'src/index.css')
      const initial = '\ufeff@charset "UTF-8";\r\n/* untouched café 😀 */\r\n:root {\r\n  --wtl-font-family: "Initial", serif;\r\n  --untouched: "漢字";\r\n}\r\nbody {\r\n  font-family: serif;\r\n  color: #123;\r\n}\r\n.unchanged { content: "Keep"; }'
      const readFont = async (path) => {
        const response = await fetch(`${origin}/api/fonts/project${path === undefined ? '' : `?path=${encodeURIComponent(path)}`}`)
        return { status: response.status, body: await response.json() }
      }
      const postFont = async (fields, headers = {}) => {
        const response = await fetch(`${origin}/api/builder/font`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': session, ...headers },
          body: JSON.stringify({ family: 'Inter', confirmation: 'SAVE FONT CHANGE', ...fields }),
        })
        return { status: response.status, body: await response.json() }
      }
      writeFileSync(cssFile, initial)
      let saved

      await fontTest.test('current GET and invalid authority/preconditions leave exact bytes and artifacts unchanged', async () => {
        const before = artifactSnapshot(fixtureLan, cssFile)
        const current = await readFont()
        assert.equal(current.status, 200)
        assert.deepEqual(current.body, { path: 'src/index.css', revision: sha256(Buffer.from(initial)), configured: false, family: 'Initial', cssUrl: null, fallback: true })
        assert.equal((await requestRead('src/index.css')).body.revision, current.body.revision)
        assert.equal((await postFont({ baseRevision: current.body.revision }, { 'x-systemx-session': 'wrong-token' })).status, 403)
        assert.match((await postFont({ confirmation: 'not approved' })).body.error, /SAVE FONT CHANGE/)
        const missing = await postFont({})
        assert.equal(missing.status, 428)
        assert.equal(missing.body.code, 'SOURCE_REVISION_REQUIRED')
        const invalid = await postFont({ baseRevision: 'sk_live_invalid-font-precondition' })
        assert.equal(invalid.status, 400)
        assert.equal(invalid.body.code, 'SOURCE_REVISION_INVALID')
        assert.doesNotMatch(JSON.stringify(invalid.body), /sk_live|untouched|Initial/)
        const unknown = await postFont({ family: 'Not A Verified Font' })
        assert.equal(unknown.status, 400)
        assert.match(unknown.body.error, /verified.*catalog/)
        for (const path of ['src/router.tsx', '../outside.css', null]) {
          assert.equal((await postFont({ path, baseRevision: current.body.revision })).body.code, 'SOURCE_TARGET_UNSUPPORTED')
        }
        assert.equal((await readFont('src/router.tsx')).status, 400)
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), before)
      })

      await fontTest.test('matching font save inserts a real import and preserves BOM, uniform CRLF, unrelated bytes and exact backup', async () => {
        const beforeRevision = sha256(Buffer.from(initial))
        saved = await postFont({ baseRevision: beforeRevision.toUpperCase() })
        assert.equal(saved.status, 200)
        assert.equal(saved.body.status, 'saved')
        assert.equal(saved.body.path, 'src/index.css')
        assert.equal(saved.body.family, 'Inter')
        assert.match(saved.body.cssUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?family=Inter/)
        const importBlock = ['/* SYSTEMX FONT IMPORT START */', `@import url("${saved.body.cssUrl}");`, '/* SYSTEMX FONT IMPORT END */'].join('\r\n')
        const expected = initial.replace('@charset "UTF-8";', `@charset "UTF-8";\r\n${importBlock}\r\n`)
          .replace('--wtl-font-family: "Initial", serif;', '--wtl-font-family: "Inter", system-ui, -apple-system, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;')
          .replace('font-family: serif;', 'font-family: var(--wtl-font-family);')
        assert.deepEqual(readFileSync(cssFile), Buffer.from(expected))
        assert.deepEqual(readFileSync(join(fixture, saved.body.backup)), Buffer.from(initial))
        assert.equal(saved.body.previousRevision, beforeRevision)
        assert.equal(saved.body.revision, sha256(Buffer.from(expected)))
        assert.equal(saved.body.currentRevision, saved.body.revision)
        assert.deepEqual([...readFileSync(cssFile).subarray(0, 3)], [0xef, 0xbb, 0xbf])
        assert.doesNotMatch(expected, /(?<!\r)\n/)
        assert.ok(expected.endsWith('.unchanged { content: "Keep"; }'))
        const current = await readFont()
        assert.equal(current.body.revision, saved.body.revision)
        assert.equal(current.body.family, 'Inter')
        assert.equal(current.body.configured, true)
        const operation = artifactSnapshot(fixtureLan, cssFile).log.trim().split('\n').map(JSON.parse).at(-1)
        assert.equal(operation.event, 'font_saved')
        assert.equal(operation.previousRevision, saved.body.previousRevision)
        assert.equal(operation.revision, saved.body.revision)
        assert.equal(operation.currentRevision, saved.body.revision)
      })

      await fontTest.test('no-op still checks freshness; stale retry and an old raw stylesheet draft cannot overwrite the font save', async () => {
        const before = artifactSnapshot(fixtureLan, cssFile)
        const noOp = await postFont({ baseRevision: saved.body.revision })
        assert.deepEqual(noOp, { status: 200, body: {
          status: 'unchanged', path: 'src/index.css', family: 'Inter', cssUrl: saved.body.cssUrl,
          previousRevision: saved.body.revision, revision: saved.body.revision, currentRevision: saved.body.revision,
        } })
        for (const result of [await postFont({ baseRevision: sha256(Buffer.from(initial)) }), await post({ path: 'src/index.css', content: initial, baseRevision: sha256(Buffer.from(initial)) })]) {
          assert.equal(result.status, 409)
          assert.equal(result.body.code, 'SOURCE_REVISION_CONFLICT')
          assert.equal(result.body.currentRevision, saved.body.revision)
        }
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), before)
        const external = `${readFileSync(cssFile, 'utf8')}\r\n.external { color: blue; }`
        writeFileSync(cssFile, external)
        const changed = artifactSnapshot(fixtureLan, cssFile)
        const staleNoOp = await postFont({ baseRevision: saved.body.revision })
        assert.equal(staleNoOp.status, 409)
        assert.equal(staleNoOp.body.currentRevision, sha256(Buffer.from(external)))
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), changed)
        const latestFont = await readFont()
        const retried = await postFont({ family: 'Roboto', baseRevision: latestFont.body.revision })
        assert.equal(retried.status, 200)
        assert.equal(retried.body.previousRevision, latestFont.body.revision)
        assert.equal(retried.body.revision, sha256(readFileSync(cssFile)))
        assert.equal(retried.body.currentRevision, retried.body.revision)
        assert.deepEqual(readFileSync(join(fixture, retried.body.backup)), Buffer.from(external))
        assert.equal((await readFont()).body.family, 'Roboto')
      })

      await fontTest.test('unsupported bytes/layouts and secret-shaped proposed CSS fail closed without backup or source changes', async () => {
        const ordinary = ':root { --wtl-font-family: "Initial", serif; }\nbody { font-family: serif; }\n'
        const cases = [
          [Buffer.concat([Buffer.from([0xff]), Buffer.from(ordinary)]), 'SOURCE_ENCODING_UNSUPPORTED'],
          [Buffer.from(`\ufeff${ordinary}`, 'utf16le'), 'SOURCE_ENCODING_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('\n', '\r\n')), 'SOURCE_LINE_ENDINGS_UNSUPPORTED'],
          [Buffer.from(ordinary.replaceAll('\n', '\r')), 'SOURCE_LINE_ENDINGS_UNSUPPORTED'],
          [Buffer.from('body { color: red; }\n'), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('body {', '.body {')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('body {', '#body {')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('body {', '.wrapper body {')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('serif; }', 'serif }')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('font-family: serif;', 'font-family: serif')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('font-family: serif;', 'font: 16px serif;')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('font-family: serif;', 'font-family: serif; all: initial;')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(':root { --other: fn(a; --wtl-font-family : "Value only"); }\nbody { font-family: serif; }\n'), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(':root { --other: [a; --wtl-font-family : "Value only"]; }\nbody { font-family: serif; }\n'), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(':root { --other: a\\; --wtl-font-family : "Value only"; }\nbody { font-family: serif; }\n'), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(ordinary.replace('body {', 'body { /* SYSTEMX FONT IMPORT START */\n/* SYSTEMX FONT IMPORT END */\n')), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(`${ordinary}/* SYSTEMX FONT IMPORT START */\n/* SYSTEMX FONT IMPORT END */`), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(`/* SYSTEMX FONT IMPORT START */\n${ordinary}`), 'SOURCE_FORMAT_UNSUPPORTED'],
          [Buffer.from(`/* SYSTEMX FONT IMPORT START */\n/* SYSTEMX FONT IMPORT END */\n/* SYSTEMX FONT IMPORT START */\n/* SYSTEMX FONT IMPORT END */\n${ordinary}`), 'SOURCE_FORMAT_UNSUPPORTED'],
        ]
        for (const [bytes, code] of cases) {
          writeFileSync(cssFile, bytes)
          const before = artifactSnapshot(fixtureLan, cssFile)
          const get = await readFont(), result = await postFont({ baseRevision: sha256(bytes) })
          assert.equal(get.status, 400)
          assert.equal(get.body.code, code)
          assert.equal(result.status, 400)
          assert.equal(result.body.code, code)
          assert.deepEqual(Object.keys(result.body).sort(), ['code', 'error'])
          assert.doesNotMatch(JSON.stringify(result.body), /Initial|@import|outside|\/Users\//)
          assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), before)
        }
        const secret = `${ordinary}/* const key = "sk_live_font-fixture-only" */\n`
        writeFileSync(cssFile, secret)
        const before = artifactSnapshot(fixtureLan, cssFile)
        const current = await readFont()
        assert.equal(current.status, 200)
        assert.doesNotMatch(JSON.stringify(current.body), /sk_live|const key|font-fixture/)
        const rejected = await postFont({ baseRevision: current.body.revision })
        assert.equal(rejected.status, 400)
        assert.equal(rejected.body.error, 'Secret-shaped content is rejected by SYSTEMX')
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), before)
      })

      await fontTest.test('missing/nonregular/linked fixed stylesheet remains unavailable or refused without recreation', async (boundaryTest) => {
        const expectedUnavailable = { code: 'SOURCE_UNAVAILABLE', error: 'Source is unavailable. Select an existing allowlisted source file, then reload before saving.' }
        rmSync(cssFile)
        const absent = artifactSnapshot(fixtureLan, cssFile)
        for (const result of [await readFont(), await postFont({ baseRevision: 'a'.repeat(64) })]) assert.deepEqual(result, { status: 404, body: expectedUnavailable })
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), absent)
        assert.equal(existsSync(cssFile), false)
        mkdirSync(cssFile)
        const directory = artifactSnapshot(fixtureLan, cssFile)
        assert.equal((await readFont()).status, 400)
        assert.equal((await postFont({ baseRevision: 'a'.repeat(64) })).status, 400)
        assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), directory)
        rmSync(cssFile, { recursive: true })
        const outside = join(temporary, 'outside-font.css')
        writeFileSync(outside, initial)
        try {
          for (const target of [outside, join(temporary, 'missing-font.css')]) {
            try { symlinkSync(target, cssFile, 'file') } catch (error) {
              if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { boundaryTest.skip('Windows file-link privileges unavailable'); return }
              throw error
            }
            const linked = artifactSnapshot(fixtureLan, cssFile)
            for (const result of [await readFont(), await postFont({ baseRevision: sha256(Buffer.from(initial)) })]) assert.deepEqual(result, { status: 400, body: { error: 'Source path is outside the editable allowlist' } })
            assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), linked)
            rmSync(cssFile)
          }
          assert.deepEqual(readFileSync(outside), Buffer.from(initial))
        } finally { rmSync(cssFile, { force: true }); writeFileSync(cssFile, initial) }
      })

      await fontTest.test('ordinary LF CSS with existing imports and whitespace metadata is supported', async () => {
        const css = '@import "tailwindcss";\n/* SYSTEMX FONT IMPORT START */\n@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");\n/* SYSTEMX FONT IMPORT END */\n:root { --wtl-font-family : "Inter", serif; }\nbody { FONT-FAMILY: serif; }\n'
        writeFileSync(cssFile, css)
        const loaded = await readFont()
        assert.equal(loaded.status, 200)
        assert.equal(loaded.body.configured, true)
        assert.equal(loaded.body.family, 'Inter')
        const result = await postFont({ family: 'Roboto', baseRevision: loaded.body.revision })
        assert.equal(result.status, 200)
        assert.equal(result.body.revision, sha256(readFileSync(cssFile)))
        assert.equal(result.body.previousRevision, sha256(Buffer.from(css)))
        assert.deepEqual(readFileSync(join(fixture, result.body.backup)), Buffer.from(css))
        const after = readFileSync(cssFile, 'utf8')
        assert.ok(after.startsWith('@import "tailwindcss";\n/* SYSTEMX FONT IMPORT START */\n'))
        assert.doesNotMatch(after, /\r/)
        assert.match(after, /body \{ font-family: var\(--wtl-font-family\); \}/)
      })

      await fontTest.test('font edits and metadata recognize exact declaration names rather than custom-property suffixes or values', async () => {
        const css = ':root { --custom--wtl-font-family : "Initial", serif; --other: --wtl-font-family: "Value only"; }\nbody { --custom-font-family: serif; FONT-FAMILY: serif; }\n'
        writeFileSync(cssFile, css)
        const loaded = await readFont()
        assert.equal(loaded.status, 200)
        assert.equal(loaded.body.family, null)
        assert.equal(loaded.body.configured, false)
        const result = await postFont({ baseRevision: loaded.body.revision })
        assert.equal(result.status, 200)
        assert.equal(result.body.status, 'saved')
        const after = readFileSync(cssFile, 'utf8')
        assert.match(after, /--custom--wtl-font-family : "Initial", serif;/)
        assert.match(after, /--other: --wtl-font-family: "Value only";/)
        assert.match(after, /--custom-font-family: serif;/)
        assert.match(after, /:root \{\n  --wtl-font-family: "Inter",/)
        assert.match(after, /body \{ --custom-font-family: serif; font-family: var\(--wtl-font-family\); \}/)
        assert.deepEqual(readFileSync(join(fixture, result.body.backup)), Buffer.from(css))
        assert.equal(result.body.revision, sha256(readFileSync(cssFile)))
        const current = await readFont()
        assert.equal(current.body.configured, true)
        assert.equal(current.body.family, 'Inter')
        assert.equal(current.body.revision, result.body.revision)
      })
    })

    await t.test('real HTTP chunks preserve exact reviewed UTF-8, BOM and CRLF content and its backup', async () => {
      const previous = '\ufeff// Initial café 😀\r\nexport default function HomePage() { return <h1>Initial</h1> }\r\n'
      const content = '\ufeffexport default function HomePage() { return <h1>A😀B café 漢字</h1> }\r\n'
      writeFileSync(sourceFile, previous)
      const loaded = await read()
      const encoded = Buffer.from(JSON.stringify({ path: relativeSource, content, baseRevision: loaded.revision, confirmation: 'SAVE LOCAL CHANGE' }))
      const cuts = [0, encoded.length]
      for (const character of ['\ufeff', '😀', 'é', '漢', '字']) {
        const start = encoded.indexOf(Buffer.from(character))
        assert.ok(start >= 0, `Chunk fixture must contain ${character}`)
        for (let offset = 1; offset < Buffer.byteLength(character); offset += 1) cuts.push(start + offset)
      }
      cuts.sort((left, right) => left - right)
      const chunks = cuts.slice(1).map((end, index) => encoded.subarray(cuts[index], end))
      const saved = await postChunks(chunks)
      assert.equal(saved.status, 200)
      assert.equal(saved.body.status, 'saved')
      assert.equal(saved.body.revision, sha256(Buffer.from(content)))
      assert.deepEqual(readFileSync(sourceFile), Buffer.from(content))
      assert.deepEqual(readFileSync(join(fixture, saved.body.backup)), Buffer.from(previous))
      const loadedAfter = await read()
      assert.equal(loadedAfter.content, content)
      assert.equal(loadedAfter.revision, saved.body.revision)
    })

    await t.test('shared JSON parser keeps malformed and oversized refusals plus its decoded-length boundary without write effects', async () => {
      const loaded = await read()
      const before = artifactSnapshot(fixtureLan, sourceFile)
      assert.deepEqual(await postChunks([Buffer.from('{"path":')]), {
        status: 400, body: { error: 'Request body must be valid JSON' },
      })
      const fields = { path: relativeSource, content: loaded.content, baseRevision: loaded.revision, confirmation: 'SAVE LOCAL CHANGE' }
      const empty = JSON.stringify({ ...fields, padding: '' })
      const padding = '漢'.repeat(1_000_000 - empty.length)
      const atLimit = JSON.stringify({ ...fields, padding })
      assert.equal(atLimit.length, 1_000_000)
      assert.ok(Buffer.byteLength(atLimit) > 2_000_000, 'The existing body limit counts decoded UTF-16 units rather than UTF-8 bytes')
      const unchanged = await postChunks([Buffer.from(atLimit)])
      assert.deepEqual(unchanged, {
        status: 200, body: { status: 'unchanged', path: relativeSource, revision: loaded.revision },
      })
      const overLimit = JSON.stringify({ ...fields, padding: `${padding}漢` })
      assert.equal(overLimit.length, 1_000_001)
      let oversized
      try { oversized = await postChunks([Buffer.from(overLimit)]) } catch (error) {
        // The established oversized-body policy destroys the request. Depending
        // on socket timing, callers receive its fixed 400 or a closed transport.
        assert.ok(['ECONNRESET', 'EPIPE'].includes(error.code), `Unexpected oversized-body failure: ${error.code}`)
      }
      if (oversized) assert.deepEqual(oversized, {
        status: 400, body: { error: 'Request body exceeds local builder limit' },
      })
      const oversizedSource = await post({ baseRevision: loaded.revision, content: 'x'.repeat(500_001) })
      assert.equal(oversizedSource.status, 400)
      assert.equal(oversizedSource.body.error, 'Source content is missing or exceeds the local limit')
      assert.deepEqual(artifactSnapshot(fixtureLan, sourceFile), before)
      assert.equal((await read()).revision, loaded.revision)
    })
  } finally {
    const exited = new Promise((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolveExit(true); return }
      child.once('exit', () => resolveExit(true))
    })
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    if (!await Promise.race([exited, delay(3000).then(() => false)])) {
      child.kill('SIGKILL')
      assert.ok(await Promise.race([exited, delay(2000).then(() => false)]), 'Owned fixture server must exit before cleanup')
    }
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('font source is checked before metadata effects and rechecked after an awaited offline catalog response', async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-font-revision-race-'))
  const fixture = join(temporary, 'fixture')
  const originalLan = join(repoRoot, '.SYSTEMX', 'LAN')
  const fixtureLan = join(fixture, '.SYSTEMX', 'LAN')
  const omitted = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(originalLan, name))
  cpSync(originalLan, fixtureLan, { recursive: true, filter: (path) => !omitted.includes(path) })
  cpSync(join(repoRoot, 'package.json'), join(fixture, 'package.json'))
  const cssFile = join(fixture, 'src/index.css')
  mkdirSync(dirname(cssFile), { recursive: true })
  const original = ':root { --wtl-font-family: "Initial", serif; }\nbody { font-family: serif; }\n'
  writeFileSync(cssFile, original)
  const started = join(temporary, 'catalog-requested')
  const released = join(temporary, 'catalog-released')
  const preload = join(temporary, 'offline-font-catalog.mjs')
  writeFileSync(preload, `import { existsSync, writeFileSync } from 'node:fs'\nimport { setTimeout as delay } from 'node:timers/promises'\nglobalThis.fetch = async (url, { signal } = {}) => {\n  if (!String(url).startsWith('https://www.googleapis.com/webfonts/v1/webfonts?')) throw new Error('Unexpected offline fixture request')\n  writeFileSync(${JSON.stringify(started)}, 'metadata-requested')\n  while (!existsSync(${JSON.stringify(released)})) await delay(5, undefined, { signal })\n  return { ok: true, json: async () => ({ items: [{ family: 'Inter', category: 'sans-serif', variants: ['400'] }] }) }\n}\n`)
  const port = await freePort(), unusedAppPort = await freePort()
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, join(fixtureLan, 'server.mjs')], {
    cwd: fixture,
    env: {
      ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(unusedAppPort),
      SYSTEMX_FIREBASE_AUTH_PORT: String(unusedAppPort), SYSTEMX_FIREBASE_FIRESTORE_PORT: String(unusedAppPort),
      SYSTEMX_FIREBASE_STORAGE_PORT: String(unusedAppPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_SESSION_ID: `font-revision-race-${process.pid}`, SYSTEMX_GOOGLE_FONTS_API_KEY: 'synthetic-offline-font-metadata',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    let healthy = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { healthy = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Await only this owned fixture. */ }
      if (healthy || child.exitCode !== null) break
      await delay(50)
    }
    assert.ok(healthy, `Owned offline font fixture did not start: ${output}`)
    const html = await (await fetch(origin)).text()
    const session = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(session)
    const postFont = async (baseRevision) => {
      const response = await fetch(`${origin}/api/builder/font`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': session },
        body: JSON.stringify({ family: 'Inter', confirmation: 'SAVE FONT CHANGE', baseRevision }),
        signal: AbortSignal.timeout(5000),
      })
      return { status: response.status, body: await response.json() }
    }
    const current = await (await fetch(`${origin}/api/fonts/project`)).json()
    assert.equal(current.revision, sha256(Buffer.from(original)))
    const before = artifactSnapshot(fixtureLan, cssFile)
    assert.equal((await postFont(undefined)).status, 428)
    assert.equal((await postFont('not-a-revision')).status, 400)
    assert.equal((await postFont('0'.repeat(64))).status, 409)
    assert.equal(existsSync(started), false, 'Invalid preconditions must not request external metadata or mutate its cache')
    assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), before)

    const pending = postFont(current.revision)
    pending.catch(() => {})
    for (let attempt = 0; attempt < 200 && !existsSync(started); attempt += 1) await delay(5)
    assert.equal(existsSync(started), true, 'The accepted request must reach the controlled metadata await')
    const external = `${original}.external { color: #abc; }\n`
    writeFileSync(cssFile, external)
    const externallyChanged = artifactSnapshot(fixtureLan, cssFile)
    writeFileSync(released, 'release')
    const refused = await pending
    assert.deepEqual(refused, { status: 409, body: {
      code: 'SOURCE_REVISION_CONFLICT', error: 'Source changed since it was loaded. Reload source before saving.', currentRevision: sha256(Buffer.from(external)),
    } })
    assert.deepEqual(artifactSnapshot(fixtureLan, cssFile), externallyChanged)
    const refreshed = await (await fetch(`${origin}/api/fonts/project`)).json()
    assert.equal(refreshed.revision, sha256(Buffer.from(external)))
    const saved = await postFont(refreshed.revision)
    assert.equal(saved.status, 200)
    assert.equal(saved.body.status, 'saved')
    assert.equal(saved.body.previousRevision, refreshed.revision)
    assert.equal(saved.body.revision, sha256(readFileSync(cssFile)))
    assert.equal(saved.body.currentRevision, saved.body.revision)
    assert.deepEqual(readFileSync(join(fixture, saved.body.backup)), Buffer.from(external))
  } finally {
    const exited = new Promise((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolveExit(true); return }
      child.once('exit', () => resolveExit(true))
    })
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    if (!await Promise.race([exited, delay(3000).then(() => false)])) {
      child.kill('SIGKILL')
      assert.ok(await Promise.race([exited, delay(2000).then(() => false)]), 'Owned offline font fixture must exit before cleanup')
    }
    rmSync(temporary, { recursive: true, force: true })
  }
})
