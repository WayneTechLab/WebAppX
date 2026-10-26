import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
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
  return {
    source: readFileSync(sourceFile).toString('base64'), backups,
    log: existsSync(log) ? readFileSync(log, 'utf8') : null,
    temporary: readdirSync(dirname(sourceFile)).filter((name) => name.endsWith('.tmp')).sort(),
  }
}

test('isolated source API rejects stale writes before backup/log/write and accepts a reviewed latest revision', async () => {
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
    const read = async () => {
      const response = await fetch(`${origin}/api/builder/source?path=${encodeURIComponent(relativeSource)}`)
      assert.equal(response.status, 200)
      return response.json()
    }
    const post = async (fields, options = {}) => {
      const response = await fetch(`${origin}/api/builder/source`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': session, ...options.headers },
        body: JSON.stringify({ path: relativeSource, content: reviewed, confirmation: 'SAVE LOCAL CHANGE', ...fields }),
      })
      return { status: response.status, body: await response.json() }
    }
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
