import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createSourceHistory, readSourceOperationHistory, sourceHistoryLimits } from '../Builder/source-history.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const workspaceId = sha('fixture-workspace')
const sourcePath = 'src/pages/HomePage.tsx'
const stamp = (second) => new Date(Date.UTC(2026, 9, 29, 0, 0, second)).toISOString()
const row = (fields = {}) => ({ event: 'source_saved', path: sourcePath, workspaceId, timestamp: stamp(1), previousRevision: sha('before'), revision: sha('after'), currentRevision: sha('after'), ...fields })
const line = (value) => `${JSON.stringify(value)}\n`

function logFixture(t, create = true) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-history-model-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'Temp/operations.jsonl')
  if (create) { mkdirSync(dirname(file)); writeFileSync(file, '') }
  const read = (path = sourcePath) => readSourceOperationHistory({ root, file, path, workspaceId })
  return { root, file, read }
}

test('history projects only scoped, validated metadata and qualifies legacy/unbound tuples', (t) => {
  const fixture = logFixture(t)
  const privateFields = { sessionId: 'private-session-marker', backup: '/Users/private-backup', projectRoot: '/private/project-root', content: 'sk_live_DO_NOT_RETURN', token: 'DO_NOT_RETURN_TOKEN' }
  const records = [
    row({ sourceKind: 'leaf-text', ...privateFields }),
    row({ event: 'font_saved' }), // A font operation cannot target a JSX file.
    row({ path: 'src/pages/Other.tsx', content: 'OTHER_PRIVATE_BODY' }),
    row({ event: 'existing_project_ingest', ...privateFields }),
    row({ workspaceId: sha('foreign-workspace') }),
    row({ timestamp: '/private/not-a-timestamp' }),
    { event: 'source_saved', path: sourcePath, timestamp: stamp(2), ...privateFields },
    row({ timestamp: stamp(3), revision: 'malformed-private-value' }),
  ]
  writeFileSync(fixture.file, records.map(line).join(''))
  const before = readFileSync(fixture.file)
  const result = fixture.read()
  assert.equal(result.entries.length, 3)
  const confirmed = result.entries.find((entry) => entry.kind === 'builder-save')
  assert.equal(confirmed.operation, 'leaf-text')
  assert.equal(confirmed.previousRevision, sha('before'))
  assert.equal(confirmed.revision, sha('after'))
  assert.equal(confirmed.workspaceBound, true)
  assert.equal(confirmed.revisionAvailable, true)
  for (const entry of result.entries.filter((entry) => entry.kind === 'legacy-builder-operation')) {
    assert.equal(entry.revision, null)
    assert.equal(entry.previousRevision, null)
    assert.equal(entry.revisionAvailable, false)
  }
  assert.equal(result.log.foreignWorkspaceLines, 1)
  assert.equal(result.log.invalidLines, 2)
  assert.equal(result.log.legacyEntries, 2)
  assert.equal(result.log.truncated, true)
  assert.doesNotMatch(JSON.stringify(result), /private-session|private-backup|project-root|sk_live|DO_NOT_RETURN|OTHER_PRIVATE|malformed-private-value|not-a-timestamp/)
  assert.deepEqual(readFileSync(fixture.file), before)

  writeFileSync(fixture.file, line(row({ event: 'font_saved', path: 'src/index.css', workspaceId: undefined, ...privateFields })))
  const unbound = fixture.read('src/index.css').entries[0]
  assert.equal(unbound.kind, 'legacy-builder-operation')
  assert.equal(unbound.attribution, 'unattributed')
  assert.equal(unbound.workspaceBound, false)
  assert.equal(unbound.revisionAvailable, true)
  assert.equal(unbound.revision, sha('after'))
  assert.equal(unbound.previousRevision, sha('before'))
})

test('log byte/line/record limits and partial records are disclosed before parsing', (t) => {
  const fixture = logFixture(t)
  const valid = Buffer.from(line(row()))
  let prefix = Buffer.from('é'.repeat(sourceHistoryLimits.logBytes))
  let bytes = Buffer.concat([prefix, Buffer.from('\n'), valid])
  if ((bytes[bytes.length - sourceHistoryLimits.logBytes] & 0xc0) !== 0x80) {
    prefix = Buffer.concat([prefix, Buffer.from('X')])
    bytes = Buffer.concat([prefix, Buffer.from('\n'), valid])
  }
  assert.equal(bytes[bytes.length - sourceHistoryLimits.logBytes] & 0xc0, 0x80, 'Tail fixture must begin inside UTF-8')
  writeFileSync(fixture.file, bytes)
  let result = fixture.read()
  assert.equal(result.entries.length, 1)
  assert.equal(result.log.bytesInspected, sourceHistoryLimits.logBytes)
  assert.ok(result.log.bytesOmitted > 0)
  assert.equal(result.log.invalidLines, 0)
  assert.equal(result.log.truncated, true)

  writeFileSync(fixture.file, line(row()) + '\n'.repeat(sourceHistoryLimits.logLines + 1))
  result = fixture.read()
  assert.equal(result.log.linesInspected, sourceHistoryLimits.logLines)
  assert.ok(result.log.linesOmitted > 0)
  assert.equal(result.entries.length, 0)
  assert.equal(result.log.truncated, true)

  writeFileSync(fixture.file, line(row()) + line(row({ content: 'x'.repeat(sourceHistoryLimits.lineBytes) })) + '{malformed}\n' + JSON.stringify(row({ timestamp: stamp(5) })))
  result = fixture.read()
  assert.equal(result.entries.length, 1)
  assert.equal(result.log.oversizedLines, 1)
  assert.equal(result.log.invalidLines, 1)
  assert.equal(result.log.incompleteLines, 1)
  assert.equal(result.log.truncated, true)
  assert.ok(result.warnings.length)
  writeFileSync(fixture.file, '\n')
  assert.equal(fixture.read().log.linesInspected, 1)
})

test('missing, directory and linked logs are reported without creating or following files', async (t) => {
  const fixture = logFixture(t, false)
  assert.equal(fixture.read().log.status, 'missing')
  assert.equal(existsSync(dirname(fixture.file)), false)
  mkdirSync(dirname(fixture.file)); mkdirSync(fixture.file)
  assert.equal(fixture.read().log.status, 'unavailable')
  rmSync(fixture.file, { recursive: true })
  const outside = join(fixture.root, 'outside.jsonl')
  writeFileSync(outside, line(row({ content: 'PRIVATE_LINKED_BODY' })))
  await t.test('file and ancestor links are refused', (linkTest) => {
    try { symlinkSync(outside, fixture.file, 'file') } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { linkTest.skip('Windows file-link privileges unavailable'); return }
      throw error
    }
    assert.equal(fixture.read().log.status, 'unavailable')
    rmSync(fixture.file); rmSync(dirname(fixture.file), { recursive: true })
    const outsideDirectory = join(fixture.root, 'outside-directory'); mkdirSync(outsideDirectory)
    symlinkSync(outsideDirectory, dirname(fixture.file), process.platform === 'win32' ? 'junction' : 'dir')
    assert.equal(fixture.read().log.status, 'unavailable')
    assert.equal(existsSync(join(outsideDirectory, 'operations.jsonl')), false)
    assert.equal(readFileSync(outside, 'utf8'), line(row({ content: 'PRIVATE_LINKED_BODY' })))
  })
})

test('session observations remain unattributed across A→B→A and enforce finite memory/result limits', (t) => {
  const fixture = logFixture(t)
  writeFileSync(fixture.file, line(row({ timestamp: stamp(0), revision: sha('A'), currentRevision: sha('A') })))
  const operationWindow = fixture.read(), history = createSourceHistory()
  const snapshot = (currentRevision, second, path = sourcePath, limit = 50) => history.snapshot({ path, workspaceId, currentRevision, operationWindow, now: stamp(second), limit })
  snapshot(sha('A'), 1); snapshot(sha('B'), 2)
  const returned = snapshot(sha('A'), 3)
  const observations = returned.entries.filter((entry) => entry.provenance === 'session-observation')
  assert.equal(observations.length, 3)
  assert.equal(observations[0].kind, 'observed-change')
  assert.equal(observations[0].previousRevision, sha('B'))
  assert.equal(observations[0].revision, sha('A'))
  assert.ok(observations.every((entry) => entry.attribution === 'unattributed'))
  assert.equal(snapshot(sha('A'), 4).observations.retained, 3)
  for (let index = 0; index < 25; index += 1) snapshot(sha(String(index)), index + 5)
  const capped = snapshot(sha('24'), 31, sourcePath, 1)
  assert.equal(capped.entries.length, 1)
  assert.equal(capped.observations.retained, 20)
  assert.ok(capped.observations.omitted > 0)
  assert.ok(capped.omittedEntries > 0)
  assert.equal(capped.truncated, true)
  for (let index = 0; index < 33; index += 1) snapshot(sha('A'), 40 + index, `src/pages/Fixture${index}.tsx`)
  const evicted = snapshot(sha('A'), 80)
  assert.ok(evicted.observations.evictedPaths > 0)
  assert.equal(evicted.observations.retained, 1)
  assert.equal(evicted.truncated, true)
  for (const limit of [0, 101, NaN, 1.5, '1', '1junk']) assert.throws(() => snapshot(sha('A'), 90, sourcePath, limit), /Invalid source history snapshot arguments/)
})

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer(); server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close((error) => error ? reject(error) : resolvePort(port)) })
})

function effects(fixture, lan) {
  const files = {}
  const visit = (path, prefix) => {
    if (!existsSync(path)) return
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name), key = `${prefix}/${entry.name}`
      if (entry.isSymbolicLink()) files[key] = `link:${sha(readlinkSync(file))}`
      else if (entry.isDirectory()) visit(file, key)
      else files[key] = sha(readFileSync(file))
    }
  }
  visit(join(lan, 'Backup'), 'Backup'); visit(join(lan, 'Temp'), 'Temp'); visit(join(fixture, 'src'), 'src')
  return files
}

test('isolated history HTTP scopes operations, binds workspace/current bytes and never writes on reads or refusals', async (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'webappx-history-http-')), fixture = join(temporary, 'fixture')
  const originalLan = join(repository, '.SYSTEMX/LAN'), lan = join(fixture, '.SYSTEMX/LAN')
  const omitted = ['Files', 'Temp', 'Backup', 'Research', 'tests'].map((name) => join(originalLan, name))
  cpSync(originalLan, lan, { recursive: true, filter: (path) => !omitted.includes(path) })
  cpSync(join(repository, 'package.json'), join(fixture, 'package.json'))
  mkdirSync(join(fixture, 'src/pages'), { recursive: true })
  const home = join(fixture, sourcePath), css = join(fixture, 'src/index.css'), log = join(lan, 'Temp/operations.jsonl')
  const original = 'export default function HomePage() { return <h1>History A</h1> }\r\n'
  const changed = original.replace('History A', 'History B'), leafChanged = changed.replace('History B', 'History leaf')
  writeFileSync(home, original); writeFileSync(join(fixture, 'src/pages/Other.tsx'), 'export default function Other() { return <p>Other</p> }\n')
  writeFileSync(css, ':root { --wtl-font-family: serif; }\nbody { font-family: serif; }\n')
  const port = await freePort(), unused = await freePort(), origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [join(lan, 'server.mjs')], { cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(unused), SYSTEMX_FIREBASE_AUTH_PORT: String(unused), SYSTEMX_FIREBASE_FIRESTORE_PORT: String(unused), SYSTEMX_FIREBASE_STORAGE_PORT: String(unused), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_SESSION_ID: `history-fixture-${process.pid}`, SYSTEMX_GOOGLE_FONTS_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk.toString() }); child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { ready = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Await this owned fixture. */ }
      if (ready || child.exitCode !== null) break
      await delay(50)
    }
    assert.ok(ready, `Owned history fixture failed to start: ${output}`)
    const html = await (await fetch(origin)).text(), token = html.match(/meta name="systemx-session" content="([^"]+)"/)?.[1]
    assert.ok(token)
    const get = async (url) => { const response = await fetch(origin + url); return { status: response.status, body: await response.json() } }
    const history = (path = sourcePath, tail = '') => get(`/api/builder/source/history?path=${encodeURIComponent(path)}${tail}`)
    const post = async (url, body) => { const response = await fetch(origin + url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': token }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() } }
    const sourcePost = (content, baseRevision, sourceKind) => post('/api/builder/source', { path: sourcePath, content, baseRevision, sourceKind, confirmation: 'SAVE LOCAL CHANGE' })
    const status = await get('/api/status'), id = status.body.repository.workspaceId
    assert.equal(id, sha(`systemx-workspace\0${realpathSync(fixture)}`))
    assert.notEqual(id, sha(`systemx-workspace\0${realpathSync(temporary)}`))
    const loaded = await get(`/api/builder/source?path=${encodeURIComponent(sourcePath)}`)
    assert.equal(loaded.body.workspaceId, id)
    const initialEffects = effects(fixture, lan)
    const first = await history()
    assert.equal(first.status, 200); assert.equal(first.body.workspaceId, id); assert.equal(first.body.currentRevision, sha(original))
    assert.equal(first.body.log.status, 'missing'); assert.equal(first.body.entries.length, 1)
    assert.equal(first.body.entries[0].kind, 'observed-current'); assert.equal(first.body.entries[0].attribution, 'unattributed')
    assert.equal((await history()).body.entries.length, 1)
    assert.deepEqual(effects(fixture, lan), initialEffects); assert.equal(existsSync(dirname(log)), false)
    writeFileSync(home, changed)
    const externalEffects = effects(fixture, lan), observed = await history()
    assert.equal(observed.body.currentRevision, sha(changed))
    assert.ok(observed.body.entries.some((entry) => entry.kind === 'observed-change' && entry.previousRevision === sha(original) && entry.revision === sha(changed) && entry.attribution === 'unattributed'))
    assert.deepEqual(effects(fixture, lan), externalEffects); writeFileSync(home, original)
    await history()

    const saved = await sourcePost(changed, sha(original))
    assert.equal(saved.status, 200)
    let current = await history(), confirmed = current.body.entries.find((entry) => entry.kind === 'builder-save')
    assert.equal(confirmed.operation, 'source'); assert.equal(confirmed.previousRevision, sha(original)); assert.equal(confirmed.revision, saved.body.revision); assert.equal(confirmed.workspaceBound, true)
    const leaf = await sourcePost(leafChanged, saved.body.revision, 'leaf-text')
    assert.equal(leaf.status, 200)
    const cssBefore = sha(readFileSync(css)), font = await post('/api/builder/font', { family: 'Inter', baseRevision: cssBefore, confirmation: 'SAVE FONT CHANGE' })
    assert.equal(font.status, 200)
    assert.equal((await get('/api/fonts/project')).body.workspaceId, id)
    const fontHistory = await history('src/index.css')
    const fontRow = fontHistory.body.entries.find((entry) => entry.kind === 'builder-save')
    assert.equal(fontRow.operation, 'font'); assert.equal(fontRow.previousRevision, cssBefore); assert.equal(fontRow.revision, font.body.revision)
    current = await history()
    assert.deepEqual(new Set(current.body.entries.filter((entry) => entry.kind === 'builder-save').map((entry) => entry.operation)), new Set(['source', 'leaf-text']))
    const beforeReads = effects(fixture, lan)
    assert.equal((await sourcePost(leafChanged, leaf.body.revision)).body.status, 'unchanged')
    assert.equal((await sourcePost('stale draft', sha(original))).status, 409)
    const unsupportedPost = await fetch(origin + '/api/builder/source/history', { method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': token }, body: '{}' })
    assert.equal(unsupportedPost.status, 404)
    await unsupportedPost.text()
    assert.equal((await history(sourcePath, '&limit=1')).body.entries.length, 1)
    for (const tail of ['&limit=0', '&limit=101', '&limit=NaN', '&limit=1.5', '&limit=1junk', '&limit=1&limit=2', '&rollback=true', '&path=src%2Findex.css']) {
      const result = await history(sourcePath, tail)
      assert.equal(result.status, 400); assert.equal(result.body.code, 'SOURCE_HISTORY_QUERY_INVALID')
    }
    assert.equal((await get('/api/builder/source/history')).body.code, 'SOURCE_HISTORY_QUERY_INVALID')
    for (const path of ['../private.tsx', '/private/source.tsx', 'package.json']) assert.equal((await history(path)).status, 400)
    assert.deepEqual(effects(fixture, lan), beforeReads)

    appendFileSync(log, line({ event: 'source_saved', path: sourcePath, timestamp: stamp(1), content: 'sk_live_PRIVATE_HISTORY_BODY', projectRoot: '/private/DO_NOT_RETURN' }) + line({ event: 'font_saved', path: 'src/index.css', timestamp: stamp(2), previousRevision: sha('old-css'), revision: sha('old-result') }) + '{malformed}\n')
    const poisonedEffects = effects(fixture, lan)
    current = await history()
    assert.ok(current.body.entries.some((entry) => entry.kind === 'legacy-builder-operation' && entry.revision === null && entry.previousRevision === null))
    const unboundFont = (await history('src/index.css')).body.entries.find((entry) => entry.kind === 'legacy-builder-operation')
    assert.equal(unboundFont.workspaceBound, false); assert.equal(unboundFont.attribution, 'unattributed'); assert.equal(unboundFont.revisionAvailable, true)
    assert.doesNotMatch(JSON.stringify(current.body), /sk_live|PRIVATE_HISTORY|DO_NOT_RETURN|sessionId|backup|projectRoot/)
    assert.ok(current.body.truncated); assert.deepEqual(effects(fixture, lan), poisonedEffects)
    rmSync(home)
    const removed = effects(fixture, lan), missing = await history()
    assert.deepEqual(missing, { status: 404, body: { code: 'SOURCE_UNAVAILABLE', error: 'Source is unavailable. Select an existing allowlisted source file, then reload before saving.' } })
    assert.deepEqual(effects(fixture, lan), removed); assert.equal(existsSync(home), false)
    writeFileSync(home, Buffer.from([0xff, 0xef, 0xbb, 0xbf]))
    const privateBytes = effects(fixture, lan), rawHistory = await history()
    assert.equal(rawHistory.body.currentRevision, sha(readFileSync(home)))
    assert.deepEqual(effects(fixture, lan), privateBytes)
    assert.doesNotMatch(JSON.stringify(rawHistory.body), /fixture\/|\/Users\/|private\/|systemx-session/)
    assert.equal(lstatSync(log).isFile(), true)
    await t.test('history refuses nonregular/linked source and does not follow a linked operation log', async (linkTest) => {
      rmSync(home); mkdirSync(home)
      const directoryEffects = effects(fixture, lan)
      assert.equal((await history()).status, 400)
      assert.deepEqual(effects(fixture, lan), directoryEffects)
      assert.equal(lstatSync(home).isDirectory(), true)
      rmSync(home, { recursive: true })
      const outsideSource = join(temporary, 'outside-source.tsx')
      writeFileSync(outsideSource, 'PRIVATE_OUTSIDE_SOURCE')
      try { symlinkSync(outsideSource, home, 'file') } catch (error) {
        if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { linkTest.skip('Windows file-link privileges unavailable'); return }
        throw error
      }
      const linkedSourceEffects = effects(fixture, lan)
      assert.deepEqual(await history(), { status: 400, body: { error: 'Source path is outside the editable allowlist' } })
      assert.deepEqual(effects(fixture, lan), linkedSourceEffects)
      assert.equal(readFileSync(outsideSource, 'utf8'), 'PRIVATE_OUTSIDE_SOURCE')
      rmSync(home); writeFileSync(home, original)
      const oldLog = readFileSync(log), outsideLog = join(temporary, 'outside-operation-log.jsonl')
      const outsideBytes = line(row({ workspaceId: id, content: 'PRIVATE_OUTSIDE_LOG' }))
      writeFileSync(outsideLog, outsideBytes); rmSync(log); symlinkSync(outsideLog, log, 'file')
      try {
        const linkedLogEffects = effects(fixture, lan), result = await history()
        assert.equal(result.status, 200)
        assert.equal(result.body.log.status, 'unavailable')
        assert.ok(result.body.entries.every((entry) => entry.provenance === 'session-observation'))
        assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_OUTSIDE/)
        assert.deepEqual(effects(fixture, lan), linkedLogEffects)
        assert.equal(readFileSync(outsideLog, 'utf8'), outsideBytes)
      } finally { rmSync(log); writeFileSync(log, oldLog) }
    })
  } finally {
    const exited = new Promise((done) => { if (child.exitCode !== null || child.signalCode !== null) done(true); else child.once('exit', () => done(true)) })
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    if (!await Promise.race([exited, delay(3000).then(() => false)])) { child.kill('SIGKILL'); assert.ok(await Promise.race([exited, delay(2000).then(() => false)])) }
    rmSync(temporary, { recursive: true, force: true })
  }
})
