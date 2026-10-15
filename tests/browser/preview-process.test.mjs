import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import test from 'node:test'
import { ownedPreviewProcess } from '../../scripts/browser-preview-process.mjs'
import { allocateSmokePort, withOwnedSmokeResources } from '../../scripts/browser-smoke.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const options = { root, cacheDir: '/fictional-owned-cache', port: 45123 }
function fake({ mismatch = false, fail = false, hang = false, noPid = false } = {}) {
  const calls = []
  const child = new EventEmitter()
  child.pid = noPid ? undefined : 654321
  child.connected = true
  child.send = (message, callback) => {
    calls.push(['send', message])
    callback?.(null)
    if (message.type === 'shutdown' && !hang) queueMicrotask(() => child.emit('close', 0, null))
  }
  child.kill = signal => { calls.push(['kill', signal]); queueMicrotask(() => child.emit('close', null, signal)); return true }
  const spawnWorker = (file, args, config) => {
    calls.push(['spawn', file, args, config])
    queueMicrotask(() => {
      if (noPid) { child.emit('error', new Error('Could not spawn owned child')); child.emit('close', null, null) }
      else if (fail) { child.emit('message', { type: 'failed', message: 'Fictional startup rejection' }) }
      else child.emit('message', { type: 'ready', pid: mismatch ? child.pid + 1 : child.pid, runnerPid: process.pid, address: '127.0.0.1', port: options.port })
    })
    return child
  }
  return { calls, child, spawnWorker }
}

test('preview forks exactly one explicit worker with argument arrays and records its exact owned process', async () => {
  const f = fake()
  const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker, environment: { VITE_FIREBASE_API_KEY: 'fictional-key', GUSTO_CLIENT_SECRET: 'fictional-secret', PATH: process.env.PATH } })
  await preview.listen()
  const spawn = f.calls[0]
  assert.equal(f.calls.filter(x => x[0] === 'spawn').length, 1)
  assert.ok(spawn[1].replaceAll('\\', '/').endsWith('/scripts/browser-preview-worker.mjs'))
  assert.deepEqual(spawn[2], [root, options.cacheDir, String(options.port), '/__webappx_smoke_hmr'])
  assert.deepEqual(spawn[3].execArgv, [])
  assert.equal(spawn[3].shell, undefined)
  assert.equal(spawn[3].env.VITE_FIREBASE_API_KEY, undefined)
  assert.equal(spawn[3].env.GUSTO_CLIENT_SECRET, undefined)
  assert.equal(spawn[3].env.VITE_SYSTEMX_LOCAL_SESSION, 'false')
  assert.deepEqual(preview.processHandle, { mode: 'child-process', pid: f.child.pid, runnerPid: process.pid, host: '127.0.0.1', port: options.port, exited: false, exitCode: null, signal: null })
  await preview.close()
  assert.equal(preview.processHandle.exited, true)
  assert.equal(preview.processHandle.exitCode, 0)
  assert.deepEqual(f.calls.slice(1), [['send', { type: 'shutdown' }]])
  await preview.close()
  assert.equal(f.calls.filter(x => x[0] === 'send').length, 1)
})

test('readiness cannot impersonate another PID and startup refusal still closes only the spawned handle', async () => {
  for (const flags of [{ mismatch: true }, { fail: true }]) {
    const f = fake(flags)
    const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker })
    await assert.rejects(preview.listen(), /process handle|startup failed/)
    await preview.close()
    assert.deepEqual(f.calls.filter(x => x[0] === 'send'), [['send', { type: 'shutdown' }]])
    assert.equal(preview.processHandle.exited, true)
  }
})

test('a spawn failure without a PID is observed without sending signals to an unowned process', async () => {
  const f = fake({ noPid: true })
  const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker })
  await assert.rejects(preview.listen(), /process handle/)
  await preview.close()
  assert.deepEqual(f.calls.filter(x => ['kill', 'send'].includes(x[0])), [])
  assert.equal(preview.processHandle, undefined)
})

test('shutdown deadline escalates only the exact owned handle and reports forced termination as failure', async () => {
  const f = fake({ hang: true })
  const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker, shutdownTimeoutMs: 10 })
  await preview.listen()
  await assert.rejects(preview.close(), /forced or abnormal/)
  assert.deepEqual(f.calls.filter(x => x[0] === 'kill'), [['kill', 'SIGKILL']])
  assert.equal(preview.processHandle.exited, true)
  assert.equal(preview.processHandle.signal, 'SIGKILL')
})

test('suite cleanup records the same process identity on assertion failure after closing browser then worker', async () => {
  const f = fake()
  const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker })
  const error = new Error('Fictional browser assertion')
  await assert.rejects(withOwnedSmokeResources({ startServer: async () => preview, launchBrowser: async () => ({ close: async () => {} }), runChecks: async () => { throw error } }), value => value === error)
  assert.deepEqual(error.smokeCleanup, { browserClosed: true, serverClosed: true })
  assert.equal(error.smokePreviewProcess, preview.processHandle)
  assert.equal(error.smokePreviewProcess.exited, true)
})

test('an unexpected worker exit cannot be reported as successful cleanup', async () => {
  const f = fake()
  const preview = ownedPreviewProcess(options, { spawnWorker: f.spawnWorker })
  await preview.listen()
  f.child.emit('close', 1, null)
  await assert.rejects(preview.close(), /exited abnormally/)
  assert.equal(preview.processHandle.exited, true)
  assert.equal(preview.processHandle.exitCode, 1)
  assert.deepEqual(f.calls.filter(x => ['send', 'kill'].includes(x[0])), [])
})

for (const phase of ['browser', 'server']) test('an interruption during ' + phase + ' cleanup fails after closing every owned resource', async () => {
  const controller = new AbortController()
  const reason = new Error('Interrupted during ' + phase + ' cleanup')
  const calls = []
  const identity = { mode: 'child-process', pid: 654321 }
  const server = { processHandle: identity, httpServer: { address: () => ({ address: '127.0.0.1', port: 45123 }) }, listen: async () => {}, close: async () => { calls.push('server'); if (phase === 'server') controller.abort(reason) } }
  const browser = { close: async () => { calls.push('browser'); if (phase === 'browser') controller.abort(reason) } }
  await assert.rejects(withOwnedSmokeResources({ startServer: async () => server, launchBrowser: async () => browser, runChecks: async () => ({ checks: ['completed'] }), signal: controller.signal }), error => error === reason)
  assert.deepEqual(calls, ['browser', 'server'])
  assert.deepEqual(reason.smokeCleanup, { browserClosed: true, serverClosed: true })
  assert.equal(reason.smokeOrigin, 'http://127.0.0.1:45123')
  assert.equal(reason.smokePreviewProcess, identity)
})

test('actual preview worker has a distinct recorded PID and closes its loopback listener without touching a sentinel', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'webappx-preview-process-test-'))
  const sentinel = createServer()
  let preview
  try {
    await new Promise((resolve, reject) => { sentinel.once('error', reject); sentinel.listen({ host: '127.0.0.1', port: 0 }, resolve) })
    const port = await allocateSmokePort()
    preview = ownedPreviewProcess({ root, cacheDir, port })
    await preview.listen()
    assert.notEqual(preview.processHandle.pid, process.pid)
    assert.equal(preview.processHandle.runnerPid, process.pid)
    assert.equal((await fetch('http://127.0.0.1:' + port + '/')).status, 200)
    assert.equal(sentinel.listening, true)
    await preview.close()
    assert.equal(preview.processHandle.exited, true)
    assert.equal(preview.processHandle.exitCode, 0)
    assert.equal(sentinel.listening, true)
    await assert.rejects(fetch('http://127.0.0.1:' + port + '/'))
  } finally {
    await preview?.close()
    if (sentinel.listening) await new Promise((resolve, reject) => sentinel.close(error => error ? reject(error) : resolve()))
    await rm(cacheDir, { recursive: true, force: true })
  }
})
