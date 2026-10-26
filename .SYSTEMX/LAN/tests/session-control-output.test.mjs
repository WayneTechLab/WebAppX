import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const modulePaths = ['session-control.mjs', 'session-restart-preview.mjs', 'Builder/runtime/port-utils.mjs']
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'webappx-session-output-'))
  const lan = join(root, '.SYSTEMX', 'LAN')
  const state = join(root, '.SYSTEMX', 'state')
  mkdirSync(join(lan, 'Builder', 'runtime'), { recursive: true })
  mkdirSync(state, { recursive: true })
  for (const path of modulePaths) copyFileSync(join(repoRoot, '.SYSTEMX', 'LAN', path), join(lan, path))
  writeFileSync(join(state, 'runtime-sentinel.json'), '{"synthetic":"preserve fixture state"}\n')
  return { root, lan, state, record: join(state, 'local-session.json') }
}

function fixtureSnapshot(root) {
  const files = {}
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), key = `${prefix}${entry.name}`
      if (entry.isDirectory()) visit(path, `${key}/`)
      else files[key] = sha256(readFileSync(path))
    }
  }
  visit(root)
  return files
}

async function pipedCli(fixture, args) {
  const child = spawn(process.execPath, [join(fixture.lan, 'session-control.mjs'), ...args], {
    cwd: fixture.root, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stderr = []
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  const stdout = []
  // Attach immediately so Node's child-exit stdio draining cannot discard a
  // small response, but consume slowly enough to pressure a large pipe write.
  const outputComplete = pipeline(child.stdout, new Writable({
    highWaterMark: 1024,
    write(chunk, _encoding, callback) {
      stdout.push(Buffer.from(chunk))
      setTimeout(callback, 3)
    },
  }))
  const result = new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolveExit({ code, signal }))
  })
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10000)
  try {
    // No session or application process is launched by these copied CLI cases.
    const [exit] = await Promise.all([result, outputComplete])
    return { ...exit, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString('utf8') }
  } finally {
    clearTimeout(timeout)
  }
}

test('recorded status flushes a large Unicode JSON record through a pressured pipe before exit', async () => {
  const fixture = createFixture()
  try {
    const session = {
      schemaVersion: 1, sessionId: 'synthetic-output-only', processes: {},
      diagnostics: '視界🙂 café — literal fixture metadata\n'.repeat(16000),
      finalMarker: 'END_OF_COMPLETE_JSON_最後🙂',
    }
    writeFileSync(fixture.record, `${JSON.stringify(session, null, 2)}\n`)
    const before = fixtureSnapshot(fixture.root)
    const result = await pipedCli(fixture, ['status'])
    assert.equal(result.code, 0)
    assert.equal(result.signal, null)
    assert.equal(result.stderr, '')
    assert.ok(result.stdout.length > 64 * 1024)
    assert.equal(result.stdout.at(-1), 10, 'Complete JSON output retains its final newline')
    const expected = { ...session, status: 'recorded', processes: {} }
    assert.deepEqual(JSON.parse(result.stdout.toString('utf8')), expected)
    assert.deepEqual(result.stdout, Buffer.from(`${JSON.stringify(expected, null, 2)}\n`))
    assert.equal(JSON.parse(result.stdout.toString('utf8')).finalMarker, session.finalMarker)
    assert.deepEqual(fixtureSnapshot(fixture.root), before)
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})

test('offline status is complete newline-terminated JSON and leaves a missing or malformed fixture record unchanged', async () => {
  const fixture = createFixture()
  try {
    for (const malformed of [false, true]) {
      if (malformed) writeFileSync(fixture.record, '{incomplete synthetic record')
      const before = fixtureSnapshot(fixture.root)
      const result = await pipedCli(fixture, ['status'])
      assert.equal(result.code, 0)
      assert.equal(result.signal, null)
      assert.equal(result.stderr, '')
      assert.equal(result.stdout.at(-1), 10)
      assert.deepEqual(JSON.parse(result.stdout.toString('utf8')), { status: 'offline', reason: 'no-owned-session-record' })
      assert.deepEqual(fixtureSnapshot(fixture.root), before)
    }
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})

test('both read-only restart preview forms flush refused JSON and preserve exit code and fixture bytes', async () => {
  const fixture = createFixture()
  try {
    const before = fixtureSnapshot(fixture.root)
    for (const args of [['restart', '--preview'], ['restart-preview']]) {
      const result = await pipedCli(fixture, args)
      assert.equal(result.code, 1)
      assert.equal(result.signal, null)
      assert.equal(result.stderr, '')
      assert.equal(result.stdout.at(-1), 10)
      const preview = JSON.parse(result.stdout.toString('utf8'))
      assert.equal(preview.readOnly, true)
      assert.equal(preview.action, 'restart-preview')
      assert.equal(preview.status, 'refused')
      assert.equal(preview.canRestart, false)
      assert.deepEqual(preview.reasons, ['no-owned-session-record'])
      assert.deepEqual(fixtureSnapshot(fixture.root), before)
    }
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})

test('invalid restart arguments preserve complete stderr usage and exit 2 without an action', async () => {
  const fixture = createFixture()
  try {
    const before = fixtureSnapshot(fixture.root)
    const result = await pipedCli(fixture, ['restart'])
    assert.equal(result.code, 2)
    assert.equal(result.signal, null)
    assert.equal(result.stdout.length, 0)
    assert.equal(result.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs restart --preview\n')
    assert.deepEqual(fixtureSnapshot(fixture.root), before)
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})
