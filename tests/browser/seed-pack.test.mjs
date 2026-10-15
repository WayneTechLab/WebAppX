import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createServer as createTcpServer } from 'node:net'
import { seedFile, seedDigestFile, validateSeedIntegrity, validateSeedContent, loadValidatedSeed, sha256, expectedAfter } from './seed-contract.mjs'
import { isAllowedSmokeRequest, isAllowedSmokeWebSocket } from './portals-smoke.mjs'
import { allocateSmokePort, isolateSmokeEnvironment, parseSmokeArguments, withOwnedSmokeResources } from '../../scripts/browser-smoke.mjs'

const text = await readFile(seedFile, 'utf8')
const hash = (await readFile(seedDigestFile, 'utf8')).trim()
const copy = () => JSON.parse(text)

test('the named seed has the recorded raw hash, complete valid defaults and reviewed dashboard totals', async () => {
  const seed = await loadValidatedSeed()
  assert.equal(seed.sha256, hash)
  assert.deepEqual(seed.dashboardTotals, {
    hr: { people: 3, timeAwaitingApproval: 1, confirmedBenefitElections: 0, submittedPayrollReceipts: 0, goals: 1, openReviews: 2 },
    cms: { drafts: 1, awaitingReview: 0, approvedRevisions: 0, publishedSamples: 1 },
    crm: { activeLeads: 2, openPipelineCents: 650000, wonCents: 0, openFollowUps: 1 },
  })
})

test('changed bytes, missing/malformed digests and unsupported seed identities fail before browser launch', () => {
  assert.throws(() => validateSeedIntegrity(`${text} `, hash), /digest changed/)
  assert.throws(() => validateSeedIntegrity(text.replaceAll('\n', '\r\n'), hash), /digest changed/)
  for (const invalid of ['', hash.toUpperCase(), 'not a hash', `${hash}extra`]) assert.throws(() => validateSeedIntegrity(text, invalid), /recorded SHA-256/)
  for (const patch of [{ schemaVersion: 2 }, { name: 'unreviewed-seed' }, { createdAt: 'now' }]) {
    const changed = JSON.stringify({ ...copy(), ...patch })
    assert.throws(() => validateSeedIntegrity(changed, sha256(changed)), /Unsupported|Unexpected|fixed UTC/)
  }
})

test('changing dashboard totals cannot be hidden by updating a fixture digest', async () => {
  const invalid = copy()
  invalid.dashboardTotals.crm.openPipelineCents = 1
  const changed = JSON.stringify(invalid)
  const seed = validateSeedIntegrity(changed, sha256(changed))
  await assert.rejects(validateSeedContent(seed), /dashboard totals/)
})

test('broken cross-links and valid but changed mock defaults require an intentional seed review', async () => {
  const invalid = copy()
  invalid.workspaces.crm.contacts[0].companyId = 'missing-company'
  await assert.rejects(validateSeedContent(invalid), /complete domain validators/)
  const drift = copy()
  drift.workspaces.cms.entries[1].title = 'Changed baseline without review'
  await assert.rejects(validateSeedContent(drift), /defaults drifted/)
})

test('expected UI deltas leave every unselected workspace byte-equivalent and preserve the named seed', () => {
  const original = copy().workspaces
  const snapshot = structuredClone(original)
  for (const selected of ['hr', 'cms', 'crm']) {
    const result = expectedAfter(original, selected)
    assert.notDeepEqual(result[selected], original[selected])
    for (const other of ['hr', 'cms', 'crm'].filter(portal => portal !== selected)) assert.deepEqual(result[other], original[other])
  }
  assert.deepEqual(original, snapshot)
})

test('network gate permits only its owned origin and rejects providers, other local listeners and backend paths', () => {
  const origin = 'http://127.0.0.1:43210'
  for (const path of ['/', '/portals', '/hr/demo/admin', '/cms/demo', '/crm/demo', '/src/main.tsx', '/@vite/client', '/favicon.svg']) assert.equal(isAllowedSmokeRequest(`${origin}${path}`, origin), true)
  for (const url of ['http://127.0.0.1:7331/status', 'http://localhost:43210/portals', 'https://api.gusto.com/', 'https://firestore.googleapis.com/', `${origin}/__systemx/status`, `${origin}/__gusto_mock__/token`, `${origin}/api/provider`, `${origin}/integrations/gusto/mock`, `${origin}/gusto-mock/token`, 'file:///tmp/mock.json', 'not a URL']) assert.equal(isAllowedSmokeRequest(url, origin), false)
  assert.equal(isAllowedSmokeWebSocket('ws://127.0.0.1:43210/__webappx_smoke_hmr?token=fictional-hmr-token', origin), true)
  for (const url of ['ws://127.0.0.1:7331/', 'ws://127.0.0.1:43210/', 'ws://127.0.0.1:43210/__systemx/', 'ws://127.0.0.1:43210/__gusto_mock__/', 'wss://example.invalid/', 'not a URL']) assert.equal(isAllowedSmokeWebSocket(url, origin), false)
})

test('inherited client credentials and local-session flags are disabled while private server variables remain private', () => {
  const environment = { VITE_FIREBASE_API_KEY: 'synthetic-sensitive-value', VITE_FIREBASE_USE_EMULATORS: 'true', VITE_SYSTEMX_LOCAL_SESSION: 'true', VITE_GUSTO_TOKEN: 'another-synthetic-value', PRIVATE_SERVER_VALUE: 'not exposed' }
  isolateSmokeEnvironment(environment)
  assert.equal(environment.VITE_FIREBASE_API_KEY, '')
  assert.equal(environment.VITE_GUSTO_TOKEN, '')
  assert.equal(environment.VITE_FIREBASE_USE_EMULATORS, 'false')
  assert.equal(environment.VITE_SYSTEMX_LOCAL_SESSION, 'false')
  assert.equal(environment.PRIVATE_SERVER_VALUE, 'not exposed')
})

test('unsupported or incomplete CLI arguments are rejected rather than targeting another browser/server', () => {
  for (const args of [['--url', 'http://localhost:55733'], ['--port', '5173'], ['--output'], ['--output', '--headed'], ['--profile', 'Default']]) assert.throws(() => parseSmokeArguments(args), /Unknown or incomplete/)
  assert.equal(parseSmokeArguments(['--headed']).headed, true)
})

test('the OS allocator returns a released positive loopback port instead of Vite default 5173', async () => {
  const port = await allocateSmokePort()
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535)
  assert.notEqual(port, 5173)
  const probe = createTcpServer()
  try {
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen({ host: '127.0.0.1', port }, resolve) })
    assert.equal(probe.address().port, port, 'The allocator must release its listener before Vite starts')
  } finally { if (probe.listening) await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve())) }
})

test('allocating a smoke port leaves an existing default-port listener untouched', async () => {
  const sentinel = createTcpServer()
  let owned = false
  try {
    owned = await new Promise((resolve, reject) => {
      sentinel.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error))
      sentinel.listen({ host: '127.0.0.1', port: 5173 }, () => resolve(true))
    })
    const port = await allocateSmokePort()
    assert.notEqual(port, 5173)
    if (owned) assert.equal(sentinel.listening, true, 'The allocator cannot stop or replace another listener')
  } finally { if (owned) await new Promise((resolve, reject) => sentinel.close(error => error ? reject(error) : resolve())) }
})

function resources({ listenError, launchError, checkError, browserCloseError } = {}) {
  const calls = []
  const server = {
    httpServer: { address: () => ({ address: '127.0.0.1', port: 45678 }) },
    async listen() { calls.push('listen'); if (listenError) throw listenError },
    async close() { calls.push('close owned Vite') },
  }
  const browser = { async close() { calls.push('close owned browser'); if (browserCloseError) throw browserCloseError } }
  return {
    calls,
    options: {
      async startServer() { calls.push('create owned Vite'); return server },
      async launchBrowser() { calls.push('launch owned browser'); if (launchError) throw launchError; return browser },
      async runChecks({ origin }) { calls.push(`check ${origin}`); if (checkError) throw checkError; return { checks: ['sample'] } },
    },
  }
}

test('successful checks close their own browser and Vite resources and return cleanup evidence', async () => {
  const owned = resources()
  const report = await withOwnedSmokeResources(owned.options)
  assert.deepEqual(report.cleanup, { browserClosed: true, serverClosed: true })
  assert.deepEqual(owned.calls.slice(-2), ['close owned browser', 'close owned Vite'])
})

test('a listen or browser-launch failure closes the Vite resource without accessing an existing listener', async () => {
  for (const errorName of ['listenError', 'launchError']) {
    const failure = new Error(errorName)
    const owned = resources({ [errorName]: failure })
    await assert.rejects(withOwnedSmokeResources(owned.options), error => error === failure)
    assert.equal(owned.calls.at(-1), 'close owned Vite')
    assert.deepEqual(failure.smokeCleanup, { browserClosed: false, serverClosed: true })
    assert.equal(owned.calls.includes('close owned browser'), false)
  }
})

test('a browser assertion failure keeps its error while both owned resources are closed', async () => {
  const failure = new Error('Actual UI payload mismatch')
  const owned = resources({ checkError: failure })
  await assert.rejects(withOwnedSmokeResources(owned.options), error => error === failure)
  assert.deepEqual(failure.smokeCleanup, { browserClosed: true, serverClosed: true })
  assert.deepEqual(owned.calls.slice(-2), ['close owned browser', 'close owned Vite'])
})

test('an interruption before startup opens no resources and is not an unhandled rejection', async () => {
  const controller = new AbortController()
  const failure = new Error('Interrupted during fixture validation')
  controller.abort(failure)
  const owned = resources()
  await assert.rejects(withOwnedSmokeResources({ ...owned.options, signal: controller.signal }), error => error === failure)
  assert.deepEqual(owned.calls, [])
  assert.deepEqual(failure.smokeCleanup, { browserClosed: false, serverClosed: false })
})

test('an interruption during browser startup closes the resources acquired by that phase', async () => {
  const controller = new AbortController()
  const failure = new Error('Interrupted during Chromium startup')
  const owned = resources()
  const launch = owned.options.launchBrowser
  owned.options.launchBrowser = async () => { const browser = await launch(); controller.abort(failure); return browser }
  await assert.rejects(withOwnedSmokeResources({ ...owned.options, signal: controller.signal }), error => error === failure)
  assert.equal(owned.calls.some(value => value.startsWith('check ')), false)
  assert.deepEqual(owned.calls.slice(-2), ['close owned browser', 'close owned Vite'])
  assert.deepEqual(failure.smokeCleanup, { browserClosed: true, serverClosed: true })
})

test('browser cleanup failure still closes Vite and records the cleanup failure without masking the assertion', async () => {
  const failure = new Error('Original assertion')
  const owned = resources({ checkError: failure, browserCloseError: new Error('Browser close denied') })
  await assert.rejects(withOwnedSmokeResources(owned.options), error => error === failure)
  assert.equal(owned.calls.at(-1), 'close owned Vite')
  assert.deepEqual(failure.smokeCleanupErrors, ['Browser close denied'])
  assert.deepEqual(failure.smokeCleanup, { browserClosed: false, serverClosed: true })
})
