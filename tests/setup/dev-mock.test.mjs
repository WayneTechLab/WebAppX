import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { fork } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { allocateMockPort, createMockEnvironment, mockViteOptions, mockWorkerArguments, parseMockArguments, runMockWorker, startMockServer } from '../../scripts/dev-mock.mjs'

const launcher = fileURLToPath(new URL('../../scripts/dev-mock.mjs', import.meta.url))

test('mock quick-start accepts only loopback port, walkthrough and help options', () => {
  assert.deepEqual(parseMockArguments([]), { port: 0, help: false, walkthrough: false })
  assert.deepEqual(parseMockArguments(['--port', '5181']), { port: 5181, help: false, walkthrough: false })
  assert.equal(parseMockArguments(['--help']).help, true)
  for (const args of [['--port'], ['--port', '-1'], ['--port', '65536'], ['--port', '3.5'], ['--port', '3;touch injected'], ['--host', '0.0.0.0'], ['--serve']]) assert.throws(() => parseMockArguments(args))
})

test('walkthrough is a strict explicit boolean flag in parent and worker argument parsing', () => {
  assert.deepEqual(parseMockArguments(['--walkthrough']), { port: 0, help: false, walkthrough: true })
  assert.deepEqual(parseMockArguments(['--walkthrough', '--port', '5181']), { port: 5181, help: false, walkthrough: true })
  assert.deepEqual(parseMockArguments(['--port', '5181', '--walkthrough', '--help']), { port: 5181, help: true, walkthrough: true })
  assert.deepEqual(mockWorkerArguments({ port: 5181, walkthrough: true }), ['--serve', '--port', '5181', '--walkthrough'])
  assert.deepEqual(parseMockArguments(mockWorkerArguments({ port: 5181, walkthrough: true }).slice(1)), { port: 5181, help: false, walkthrough: true })
  assert.deepEqual(mockWorkerArguments({ port: 5181, walkthrough: false }), ['--serve', '--port', '5181'])
  for (const args of [['--walkthrough=true'], ['--walkthrough=false'], ['--walkthrough', 'false'], ['--walkthrough', 'true'], ['--walkthrough', '--walkthrough']]) assert.throws(() => parseMockArguments(args))
  for (const walkthrough of ['true', 'false', 1, 0, null]) {
    assert.throws(() => mockWorkerArguments({ port: 0, walkthrough }), /explicit boolean/)
    assert.throws(() => mockViteOptions({ port: 5181, plugins: [], walkthrough }), /explicit boolean/)
  }
})

test('child environment excludes inherited client, provider and emulator settings without mutating the parent', () => {
  const original = { PATH: '/safe/bin', HOME: '/fictional/home', VITE_FIREBASE_API_KEY: 'synthetic-do-not-use', vite_gusto_token: 'synthetic-do-not-use', FIREBASE_CONFIG: 'synthetic', GUSTO_CLIENT_SECRET: 'synthetic', SYSTEMX_LOCAL_SESSION: 'true', GOOGLE_APPLICATION_CREDENTIALS: '/fictional/key.json', KEEP_TEST: 'unchanged' }
  const before = structuredClone(original)
  assert.deepEqual(createMockEnvironment(original), { PATH: '/safe/bin', HOME: '/fictional/home', KEEP_TEST: 'unchanged', VITE_FIREBASE_USE_EMULATORS: 'false', VITE_SYSTEMX_LOCAL_SESSION: 'false' })
  assert.deepEqual(original, before)
})

test('native mock Vite config ignores .env and project integration plugins', () => {
  const plugins = [{ name: 'react' }, { name: 'tailwind' }]
  const config = mockViteOptions({ port: 5181, cacheDir: '/synthetic/cache', root: '/synthetic/app', plugins })
  assert.equal(config.configFile, false)
  assert.equal(config.envDir, false)
  assert.deepEqual(config.server, { host: '127.0.0.1', port: 5181, strictPort: true, open: false, proxy: {} })
  assert.deepEqual(config.plugins, plugins)
  assert.deepEqual(config.define, { __WEBAPPX_WALKTHROUGH__: false })
  assert.equal(config.resolve.alias['@'].replaceAll('\\', '/'), '/synthetic/app/src')
})

test('concurrent injected servers keep opposite walkthrough defines and inherited environments isolated', async () => {
  const beforeEnvironment = { ...process.env }
  const inherited = { ...process.env, VITE_WEBAPPX_WALKTHROUGH: 'true', VITE_FIREBASE_PROJECT_ID: 'synthetic-not-forwarded' }
  const inheritedBefore = { ...inherited }
  const clean = createMockEnvironment(inherited)
  assert.equal(clean.VITE_WEBAPPX_WALKTHROUGH, undefined)
  assert.equal(clean.VITE_FIREBASE_PROJECT_ID, undefined)
  const configs = []
  let releaseRuntime
  const ready = new Promise(resolve => { releaseRuntime = resolve })
  const runtime = async () => {
    await ready
    return { plugins: [], createServer: async config => {
      configs.push(config)
      return { listen: async () => {}, httpServer: { address: () => ({ address: '127.0.0.1', port: config.server.port }) }, close: async () => {} }
    } }
  }
  const browser = startMockServer(Object.freeze({ port: 5181, walkthrough: false }), { runtime })
  const walkthrough = startMockServer(Object.freeze({ port: 5182, walkthrough: true }), { runtime })
  releaseRuntime()
  const owned = await Promise.all([browser, walkthrough])
  try {
    assert.deepEqual(owned.map(server => server.walkthrough), [false, true])
    assert.deepEqual(configs.sort((a, b) => a.server.port - b.server.port).map(config => config.define), [{ __WEBAPPX_WALKTHROUGH__: false }, { __WEBAPPX_WALKTHROUGH__: true }])
    assert.notEqual(configs[0].define, configs[1].define)
    assert.notEqual(configs[0].cacheDir, configs[1].cacheDir)
    for (const config of configs) {
      assert.equal(config.envDir, false)
      assert.equal(config.configFile, false)
      assert.equal(config.server.host, '127.0.0.1')
      assert.deepEqual(config.server.proxy, {})
    }
    assert.deepEqual(inherited, inheritedBefore)
    assert.deepEqual({ ...process.env }, beforeEnvironment)
  } finally { await Promise.all(owned.map(server => server.close())) }
  for (const config of configs) await assert.rejects(access(config.cacheDir), { code: 'ENOENT' })
})

test('an invalid injected walkthrough mode refuses before runtime or cache allocation', async () => {
  let calls = 0
  await assert.rejects(startMockServer({ port: 0, walkthrough: 'true' }, { runtime: async () => { calls += 1; assert.fail('Invalid selection must not load runtime') } }), /explicit boolean/)
  assert.equal(calls, 0)
})

test('port allocation preserves an existing listener', async () => {
  const existing = createServer()
  await new Promise(resolve => existing.listen({ host: '127.0.0.1', port: 0 }, resolve))
  try {
    const allocated = await allocateMockPort()
    assert.ok(allocated > 0 && allocated <= 65535)
    assert.notEqual(allocated, existing.address().port)
    assert.equal(existing.listening, true)
  } finally { await new Promise(resolve => existing.close(resolve)) }
})

test('failed server startup closes only its server and removes its temporary cache', async () => {
  let options
  let closes = 0
  await assert.rejects(startMockServer({ port: 5181 }, { runtime: async () => ({ plugins: [], createServer: async received => {
    options = received
    return { listen: async () => { throw new Error('port in use') }, environments: { client: { waitForRequestsIdle: () => assert.fail('An unstarted server has no request crawl to drain') } }, close: async () => { closes += 1 } }
  } }) }), /port in use/)
  assert.equal(closes, 1)
  await assert.rejects(access(options.cacheDir), { code: 'ENOENT' })
})

test('successful server close is idempotent and removes only its own cache', async () => {
  let options
  let closes = 0
  const order = []
  const owned = await startMockServer({ port: 5181 }, { runtime: async () => ({ plugins: [], createServer: async received => {
    options = received
    return { listen: async () => {}, httpServer: { address: () => ({ address: '127.0.0.1', port: 5181 }) }, environments: { client: { waitForRequestsIdle: async () => { order.push('imports-idle') } } }, close: async () => { closes += 1; order.push('server-closed') } }
  } }) })
  assert.equal(owned.url, 'http://127.0.0.1:5181/portals')
  await access(options.cacheDir)
  await owned.close()
  await owned.close()
  assert.equal(closes, 1)
  assert.deepEqual(order, ['imports-idle', 'server-closed'])
  await assert.rejects(access(options.cacheDir), { code: 'ENOENT' })
})

test('concurrent close calls await the same import drain and owned cleanup', async () => {
  let releaseImports
  const imports = new Promise(resolve => { releaseImports = resolve })
  let closes = 0
  let options
  const owned = await startMockServer({ port: 5181 }, { runtime: async () => ({ plugins: [], createServer: async received => {
    options = received
    return { listen: async () => {}, httpServer: { address: () => ({ address: '127.0.0.1', port: 5181 }) }, environments: { client: { waitForRequestsIdle: () => imports } }, close: async () => { closes += 1 } }
  } }) })
  const first = owned.close()
  const second = owned.close()
  assert.equal(first, second)
  assert.equal(closes, 0)
  releaseImports()
  await Promise.all([first, second])
  assert.equal(closes, 1)
  await assert.rejects(access(options.cacheDir), { code: 'ENOENT' })
})

test('launcher uses an argument array and IPC shutdown for its own child', async () => {
  const signals = new EventEmitter()
  const child = new EventEmitter()
  child.connected = true
  const sent = []
  child.send = message => sent.push(message)
  child.kill = () => assert.fail('Graceful shutdown must not kill a process')
  let received
  const done = runMockWorker({ port: 5181 }, { signalSource: signals, environment: { VITE_FIREBASE_PROJECT_ID: 'synthetic', PATH: '/safe' }, output: { log() {} }, spawnWorker: (...args) => { received = args; return child } })
  assert.equal(received[0], launcher)
  assert.deepEqual(received[1], ['--serve', '--port', '5181'])
  assert.deepEqual(mockWorkerArguments({ port: 0 }), ['--serve', '--port', '0'])
  assert.equal(received[2].env.VITE_FIREBASE_PROJECT_ID, undefined)
  assert.equal(received[2].shell, undefined)
  assert.deepEqual(received[2].execArgv, [])
  signals.emit('SIGINT')
  signals.emit('SIGTERM')
  assert.deepEqual(sent, [{ type: 'shutdown' }])
  child.emit('exit', 0, null)
  assert.equal(await done, 0)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('parent forwards walkthrough to only its own child without inheriting a client mode flag', async () => {
  const signals = new EventEmitter()
  const child = new EventEmitter()
  const environment = { PATH: '/safe', VITE_WEBAPPX_WALKTHROUGH: 'false', VITE_FIREBASE_API_KEY: 'synthetic-not-forwarded' }
  const before = { ...environment }
  let received
  const done = runMockWorker({ port: 0, walkthrough: true }, { signalSource: signals, environment, spawnWorker: (...args) => { received = args; return child } })
  assert.deepEqual(received[1], ['--serve', '--port', '0', '--walkthrough'])
  assert.equal(received[2].env.VITE_WEBAPPX_WALKTHROUGH, undefined)
  assert.equal(received[2].env.VITE_FIREBASE_API_KEY, undefined)
  assert.deepEqual(environment, before)
  child.emit('exit', 0, null)
  assert.equal(await done, 0)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('child startup error rejects and removes parent signal handlers', async () => {
  const child = new EventEmitter()
  const signals = new EventEmitter()
  const done = runMockWorker({ port: 0 }, { signalSource: signals, spawnWorker: () => child })
  child.emit('error', new Error('spawn unavailable'))
  await assert.rejects(done, /spawn unavailable/)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('requested shutdown terminated by a signal is a failure', async () => {
  const signals = new EventEmitter()
  const child = new EventEmitter()
  child.connected = true
  child.send = () => {}
  const done = runMockWorker({ port: 0 }, { signalSource: signals, spawnWorker: () => child })
  signals.emit('SIGINT')
  child.emit('exit', null, 'SIGKILL')
  assert.equal(await done, 1)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
})

test('requested shutdown preserves a nonzero cleanup exit code', async () => {
  const signals = new EventEmitter()
  const child = new EventEmitter()
  child.connected = true
  child.send = () => {}
  const done = runMockWorker({ port: 0 }, { signalSource: signals, spawnWorker: () => child })
  signals.emit('SIGTERM')
  child.emit('exit', 2, null)
  assert.equal(await done, 2)
})

test('an unknown child exit status is a failure', async () => {
  const child = new EventEmitter()
  const done = runMockWorker({ port: 0 }, { signalSource: new EventEmitter(), spawnWorker: () => child })
  child.emit('exit', null, null)
  assert.equal(await done, 1)
})

test('explicit busy port fails without closing the existing listener', { timeout: 15_000 }, async () => {
  const existing = createServer(socket => socket.end())
  await new Promise(resolve => existing.listen({ host: '127.0.0.1', port: 0 }, resolve))
  const port = existing.address().port
  const child = fork(launcher, ['--serve', '--port', String(port)], { env: createMockEnvironment(process.env), stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000)
  try {
    assert.deepEqual(await once(child, 'exit'), [1, null])
    assert.match(output, /port.*already in use/i)
    assert.equal(existing.listening, true)
    assert.equal(existing.address().port, port)
  } finally {
    clearTimeout(timeout)
    await new Promise(resolve => existing.close(resolve))
  }
})

test('real owned Vite worker serves native portals with inherited provider config disabled', { timeout: 30_000 }, async () => {
  const child = fork(launcher, ['--serve', '--port', '0'], {
    env: createMockEnvironment({ ...process.env, VITE_FIREBASE_API_KEY: 'synthetic-never-forward', VITE_FIREBASE_PROJECT_ID: 'synthetic-never-forward', VITE_FIREBASE_USE_EMULATORS: 'true', VITE_SYSTEMX_LOCAL_SESSION: 'true', VITE_WEBAPPX_WALKTHROUGH: 'true' }),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const exited = once(child, 'exit')
  let readyUrl
  try {
    const ready = await Promise.race([
      once(child, 'message').then(([message]) => message),
      exited.then(([code]) => { throw new Error(`Mock worker exited ${code}: ${output}`) }),
    ])
    assert.equal(ready.type, 'ready')
    assert.equal(ready.walkthrough, false)
    readyUrl = ready.url
    const origin = new URL(readyUrl).origin
    assert.equal(new URL(readyUrl).hostname, '127.0.0.1')
    assert.equal(new URL(readyUrl).pathname, '/portals')
    const portalResponse = await fetch(readyUrl, { headers: { Connection: 'close' } })
    assert.equal(portalResponse.status, 200)
    await portalResponse.text()
    const firebaseModule = await (await fetch(`${origin}/src/config/firebase.ts`, { headers: { Connection: 'close' } })).text()
    assert.match(firebaseModule, /"VITE_FIREBASE_USE_EMULATORS":\s*"false"/)
    assert.match(firebaseModule, /"VITE_SYSTEMX_LOCAL_SESSION":\s*"false"/)
    assert.doesNotMatch(firebaseModule, /synthetic-never-forward/)
    // Reproduce a cold shutdown with eager React/Firebase imports still warming.
    // Vite.close() alone can strand optimizer waiters at precisely this point.
    const entryResponse = await fetch(`${origin}/src/main.tsx`, { headers: { Connection: 'close' } })
    assert.equal(entryResponse.status, 200)
    await entryResponse.text()
    const mockResponse = await fetch(`${origin}/__gusto_mock__/__session`, { method: 'POST', headers: { Connection: 'close' } })
    assert.notEqual(mockResponse.status, 201, 'Provider-shaped SDK mock middleware must not run in the native launcher')
    await mockResponse.text()
    assert.match(output, /Account-free HR, CMS and CRM:/)
    assert.match(output, /Persistence mode: browser saves\./)
    assert.match(output, /Browser-save mode — refresh can restore saved fictional records in this browser profile\./)
  } finally {
    if (child.connected) child.send({ type: 'shutdown' })
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    try { assert.deepEqual(await exited, [0, null], `The owned mock worker must close gracefully. Worker output:\n${output}`) } finally { clearTimeout(timer) }
    if (readyUrl) await assert.rejects(fetch(readyUrl))
  }
})

test('real walkthrough worker prints the refresh boundary and ignores an opposing inherited mode', { timeout: 30_000 }, async () => {
  const child = fork(launcher, ['--serve', '--port', '0', '--walkthrough'], {
    env: createMockEnvironment({ ...process.env, VITE_WEBAPPX_WALKTHROUGH: 'false', VITE_FIREBASE_API_KEY: 'synthetic-never-forward', VITE_FIREBASE_USE_EMULATORS: 'true' }),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const exited = once(child, 'exit')
  let readyUrl
  try {
    const ready = await Promise.race([
      once(child, 'message').then(([message]) => message),
      exited.then(([code]) => { throw new Error(`Walkthrough worker exited ${code}: ${output}`) }),
    ])
    assert.equal(ready.type, 'ready')
    assert.equal(ready.walkthrough, true)
    readyUrl = ready.url
    const url = new URL(readyUrl)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.pathname, '/portals')
    const response = await fetch(readyUrl, { headers: { Connection: 'close' } })
    assert.equal(response.status, 200)
    await response.text()
    const firebaseModule = await (await fetch(`${url.origin}/src/config/firebase.ts`, { headers: { Connection: 'close' } })).text()
    assert.match(firebaseModule, /"VITE_FIREBASE_USE_EMULATORS":\s*"false"/)
    assert.doesNotMatch(firebaseModule, /synthetic-never-forward|VITE_WEBAPPX_WALKTHROUGH/)
    assert.match(output, /Persistence mode: walkthrough \(memory only\)\./)
    assert.ok(output.includes('Walkthrough — mock data stays in memory. Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.'))
  } finally {
    if (child.connected) child.send({ type: 'shutdown' })
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    try { assert.deepEqual(await exited, [0, null], `The owned walkthrough worker must close gracefully. Worker output:\n${output}`) } finally { clearTimeout(timer) }
    if (readyUrl) await assert.rejects(fetch(readyUrl))
  }
})
