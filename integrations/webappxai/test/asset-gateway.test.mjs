import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createLocalAuthorizer, createLocalReader } from '../dev-model.mjs'
import runtimeRelease from '@waynetechlab/webappxai/release' with { type: 'json' }
import { legacyReleaseName, PILOT_ASSETS, PILOT_REVISION, PREVIOUS_REVISION, releaseForRevision, servePilotAsset } from '../functions/contracts.mjs'

const expectedRoute = `/api/webappxai/${PILOT_REVISION}/tokenizer.json`

async function localServer(t, handler) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  return server.address().port
}

test('browser and server use the same immutable release checksums', async () => {
  const modelPin = JSON.parse(await readFile(new URL('../../../src/webappxai/model-pin.json', import.meta.url)))
  const deployed = JSON.parse(await readFile(new URL('../functions/release.json', import.meta.url)))
  const previous = JSON.parse(await readFile(new URL('../functions/previous-release.json', import.meta.url)))
  assert.equal(modelPin.repository, 'SatoshiUNO/WebAppXai')
  assert.match(modelPin.revision, /^[a-f0-9]{40}$/)
  assert.deepEqual(deployed.model, { repository: modelPin.repository, revision: modelPin.revision })
  assert.equal(modelPin.pilot, deployed.revision)
  assert.equal(PILOT_REVISION, modelPin.revision)
  assert.deepEqual(modelPin.assets, Object.fromEntries(
    Object.entries(PILOT_ASSETS).map(([name, { bytes, sha256 }]) => [name, { bytes, sha256 }]),
  ))
  assert.equal(PREVIOUS_REVISION, '13234ff5521012ddcfda6cda14eda3850d5448d4')
  assert.equal(runtimeRelease.revision, previous.revision)
  assert.deepEqual(runtimeRelease.assets, previous.assets)
  if (PILOT_REVISION === PREVIOUS_REVISION) assert.deepEqual(deployed, previous)
  for (const asset of Object.values(PILOT_ASSETS)) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/)
    assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0)
  }
})

test('pinned and compatible GET routes require authorization and verify bytes before delivery', async t => {
  const reads = []
  const port = await localServer(t, (request, response) => servePilotAsset(request, response, {
    authorize: async token => token === 'named-test-user',
    read: async (name, revision) => {
      reads.push({ name, revision })
      return Buffer.alloc(releaseForRevision(revision).assets[name].bytes)
    },
  }))
  async function probe(path, token, method = 'GET') {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    return { status: response.status, message: await response.text() }
  }
  const routes = [
    [expectedRoute, PILOT_REVISION],
    [`/api/webappxai/${PREVIOUS_REVISION}/tokenizer.json`, PREVIOUS_REVISION],
    [`/api/webappxai/${legacyReleaseName}/tokenizer.json`, PREVIOUS_REVISION],
  ]
  for (const [route] of routes) assert.equal((await probe(route)).status, 401)
  assert.equal((await probe(expectedRoute, 'invalid')).status, 401)
  assert.equal((await probe(expectedRoute, 'named-test-user', 'POST')).status, 405)
  for (const path of [
    '/api/webappxai/pilot-002-chat/tokenizer.json',
    '/api/webappxai/main/tokenizer.json',
    '/api/webappxai/' + '1'.repeat(40) + '/tokenizer.json',
    expectedRoute + '?alt=media', expectedRoute + '%2Fother', expectedRoute.replace(/tokenizer\.json$/, 'manifest.json'),
  ]) {
    assert.equal((await probe(path, 'named-test-user')).status, 404)
  }
  assert.deepEqual(reads, [])
  for (const [route] of routes) {
    const corrupt = await probe(route, 'named-test-user')
    assert.equal(corrupt.status, 503)
    assert.equal(corrupt.message, 'The research pilot files are unavailable.')
  }
  assert.deepEqual(reads, routes.map(([, revision]) => ({ name: 'tokenizer.json', revision })))
})

function emulatorToken(sub, provider, overrides = {}) {
  const seconds = Math.floor(Date.now() / 1000)
  const payload = {
    sub, iss: 'https://securetoken.google.com/demo-systemx', aud: 'demo-systemx',
    exp: seconds + 300, auth_time: seconds, firebase: { sign_in_provider: provider }, ...overrides,
  }
  return [JSON.stringify({ alg: 'none' }), JSON.stringify(payload)].map(v => Buffer.from(v).toString('base64url')).join('.') + '.'
}

test('local gateway requires the supervised project and a matching active Auth emulator account', async t => {
  let lookups = 0
  const port = await localServer(t, async (request, response) => {
    ++lookups
    assert.equal(request.method, 'POST')
    assert.equal(request.url, '/identitytoolkit.googleapis.com/v1/accounts:lookup?key=systemx-local-api-key')
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks))
    assert.equal(typeof body.idToken, 'string')
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ users: [{ localId: 'emulator-test-user' }] }))
  })
  const env = {
    VITE_SYSTEMX_LOCAL_SESSION: 'true', VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1', VITE_FIREBASE_AUTH_EMULATOR_PORT: String(port),
  }
  const authorize = createLocalAuthorizer(env)
  const valid = emulatorToken('emulator-test-user', 'password')
  for (const overrides of [
    { VITE_SYSTEMX_LOCAL_SESSION: '' }, { VITE_FIREBASE_USE_EMULATORS: 'false' },
    { VITE_FIREBASE_EMULATOR_HOST: 'example.invalid' }, { VITE_FIREBASE_PROJECT_ID: 'another-project' },
  ]) {
    await assert.rejects(createLocalAuthorizer({ ...env, ...overrides })(valid))
  }
  assert.equal(await authorize(emulatorToken('emulator-test-user', 'anonymous')), false)
  assert.equal(await authorize(emulatorToken('emulator-test-user', 'password', { exp: 1 })), false)
  assert.equal(await authorize(emulatorToken('emulator-test-user', 'password', { aud: 'another-project' })), false)
  assert.equal(lookups, 0)
  assert.equal(await authorize(emulatorToken('different-user', 'password')), false)
  assert.equal(await authorize(valid), true)
  assert.equal(lookups, 2)
})

test('only regular release-sized files outside served directories can be read', async t => {
  const root = await mkdtemp(join(tmpdir(), 'webappxai-private-reader-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const served = join(root, 'app')
  const external = join(root, 'private')
  await mkdir(served)
  await mkdir(external)
  await writeFile(join(external, 'tokenizer.json'), 'short')
  await assert.rejects(createLocalReader(external, [served])('tokenizer.json'), /size/)
  await assert.rejects(createLocalReader(external, [served])('../private/tokenizer.json'), /release/)
  await assert.rejects(createLocalReader(served, [served])('tokenizer.json'), /external private/)
  await writeFile(join(external, 'tokenizer.json'), Buffer.alloc(PILOT_ASSETS['tokenizer.json'].bytes))
  const readActive = createLocalReader(external, [served])
  assert.equal((await readActive('tokenizer.json')).length, PILOT_ASSETS['tokenizer.json'].bytes)
  await assert.rejects(readActive('tokenizer.json', '../other'), /Unknown release/)
  if (PILOT_REVISION !== PREVIOUS_REVISION) {
    await assert.rejects(readActive('tokenizer.json', PREVIOUS_REVISION), /Missing private release/)
    const previous = join(root, 'previous')
    await mkdir(previous)
    const oldBytes = Buffer.alloc(runtimeRelease.assets['tokenizer.json'].bytes, 0x41)
    await writeFile(join(previous, 'tokenizer.json'), oldBytes)
    const read = createLocalReader(external, [served], previous)
    assert.deepEqual(await read('tokenizer.json', PREVIOUS_REVISION), oldBytes)
    assert.equal((await read('tokenizer.json', PILOT_REVISION))[0], 0)
    await assert.rejects(createLocalReader(external, [served], served)('tokenizer.json', PREVIOUS_REVISION), /external private/)
  }
})
