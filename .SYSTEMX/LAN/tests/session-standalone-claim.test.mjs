import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { inspectSessionProcess } from '../session-restart-preview.mjs'

const host = '127.0.0.1'
const portKeys = ['SYSTEMX_APP_PORT', 'SYSTEMX_LAN_PORT', 'SYSTEMX_FIREBASE_AUTH_PORT', 'SYSTEMX_FIREBASE_FIRESTORE_PORT', 'SYSTEMX_FIREBASE_STORAGE_PORT']

async function isolatedPorts() {
  const servers = portKeys.map(() => createServer())
  try {
    await Promise.all(servers.map(server => new Promise((resolve, reject) => server.once('error', reject).listen(0, host, resolve))))
    return Object.fromEntries(portKeys.map((key, index) => [key, String(servers[index].address().port)]))
  } finally {
    await Promise.all(servers.filter(server => server.listening).map(server => new Promise(resolve => server.close(resolve))))
  }
}

async function until(check, describe) {
  const deadline = Date.now() + 60_000
  do {
    const result = await check()
    if (result) return result
    await delay(30)
  } while (Date.now() < deadline)
  throw new Error(describe())
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'webappx-lan-admission-')))
  const lan = join(root, '.SYSTEMX', 'LAN')
  const vite = join(root, 'node_modules', 'vite', 'bin')
  const bin = join(root, 'bin')
  await Promise.all([lan, vite, bin].map(path => mkdir(path, { recursive: true })))
  const files = ['Builder', 'server.mjs', 'session-supervisor.mjs', 'session-claim.mjs', 'session-restart-preview.mjs', 'dev-session.mjs', 'work-status.mjs']
  await Promise.all(files.map(name => cp(new URL('../' + name, import.meta.url), join(lan, name), { recursive: true })))
  // Local HTTP fixtures satisfy the real supervisor's readiness checks. The LAN
  // process and both launcher entry points are unmodified copies of the project.
  const serve = "const http=require('node:http'); const serve=(port, body)=>http.createServer((req,res)=>res.end(body)).listen(Number(port),'127.0.0.1');\n"
  await Promise.all([
    writeFile(join(root, 'firebase.json'), '{}'),
    writeFile(join(vite, 'vite.js'), serve + "serve(process.env.SYSTEMX_APP_PORT, '/@vite/client');\n"),
    writeFile(join(bin, 'npx'), '#!' + process.execPath + '\n' + serve +
      "serve(process.env.SYSTEMX_FIREBASE_AUTH_PORT, JSON.stringify({authEmulator:{ready:true}}));\n" +
      "serve(process.env.SYSTEMX_FIREBASE_FIRESTORE_PORT, 'Ok\\n');\nserve(process.env.SYSTEMX_FIREBASE_STORAGE_PORT, '');\n", { mode: 0o700 }),
  ])
  const ports = await isolatedPorts()
  const environment = { ...process.env, ...ports, PATH: bin + delimiter + process.env.PATH, SYSTEMX_DEV_HOST: host, SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'false' }
  delete environment.SYSTEMX_SESSION_ID
  delete environment.SYSTEMX_SESSION_OWNER_PID
  const processes = []
  function start(file, override = {}) {
    const child = spawn(process.execPath, ['.SYSTEMX/LAN/' + file], { cwd: root, env: { ...environment, ...override }, stdio: ['ignore', 'pipe', 'pipe'] })
    const run = { child, output: '', closed: once(child, 'close') }
    for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { run.output += bytes.toString() })
    processes.push(run)
    return run
  }
  async function stop(run) {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill('SIGTERM')
    return run.closed
  }
  const state = join(root, '.SYSTEMX', 'state')
  async function snapshot() {
    const files = await readdir(state)
    return Object.fromEntries(await Promise.all(files.map(async name => [name, await readFile(join(state, name), 'utf8')])))
  }
  async function cleanup() {
    await Promise.all(processes.map(stop))
    await rm(root, { recursive: true, force: true })
  }
  return { ports, start, stop, snapshot, cleanup }
}

function assertRefusal(run, session) {
  assert.equal(run.child.exitCode, 1, run.output)
  const status = inspectSessionProcess(process.pid).cwd ? 'owned' : 'unverified'
  assert.ok(run.output.includes('(' + status + ', generation ' + session.sessionId + ', PID ' + session.ownerPid + ', recorded origin ' + session.origin.url + ')'), run.output)
  assert.doesNotMatch(run.output, /Loopback-only local builder shell/)
}

async function verifyLan(port) {
  const response = await fetch('http://' + host + ':' + port + '/api/health', { headers: { Connection: 'close' }, signal: AbortSignal.timeout(3000) })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'online')
}

test('normal standalone and combined launchers report the owning generation and preserve live services and receipts', { timeout: 120_000, skip: process.platform === 'win32' && 'uses POSIX child signals and a fixture npx executable' }, async t => {
  const f = await fixture()
  t.after(f.cleanup)
  const lanPort = f.ports.SYSTEMX_LAN_PORT
  const contenders = [f.start('server.mjs'), f.start('server.mjs')]
  const winner = await until(() => contenders.find(run => run.output.includes('Loopback-only local builder shell')), () => JSON.stringify(contenders.map(run => run.output)))
  const loser = contenders.find(run => run !== winner)
  await loser.closed
  const original = await f.snapshot()
  const standalone = JSON.parse(original['local-session.json'])
  assert.equal(standalone.mode, 'lan-only')
  assert.equal(standalone.ownerPid, winner.child.pid)
  assert.equal(standalone.origin.url, 'http://' + host + ':' + lanPort)
  assertRefusal(loser, standalone)
  const combinedLoser = f.start('dev-session.mjs')
  await combinedLoser.closed
  assertRefusal(combinedLoser, standalone)
  assert.deepEqual(await f.snapshot(), original)
  await verifyLan(lanPort)
  assert.deepEqual(await f.stop(winner), [0, null])
  assert.deepEqual(await f.snapshot(), {})

  const supervisor = f.start('dev-session.mjs')
  await until(async () => {
    try {
      const session = JSON.parse((await f.snapshot())['local-session.json'])
      return session?.readiness?.lan && Object.values(session.readiness).every(component => component.status === 'ready')
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error }
  }, () => 'Combined local fixture failed to become ready: ' + supervisor.output)
  const combinedFiles = await f.snapshot()
  const combined = JSON.parse(combinedFiles['local-session.json'])
  assert.equal(combined.mode, 'combined')
  assert.equal(combined.ownerPid, supervisor.child.pid)
  assert.notEqual(combined.processes.lan, supervisor.child.pid)
  assert.equal(combined.origin.url, 'http://' + host + ':' + f.ports.SYSTEMX_APP_PORT)
  const standaloneLoser = f.start('server.mjs', { SYSTEMX_SESSION_ID: combined.sessionId })
  await standaloneLoser.closed
  assertRefusal(standaloneLoser, combined)
  assert.deepEqual(await f.snapshot(), combinedFiles)
  await verifyLan(lanPort)
  assert.deepEqual(await f.stop(supervisor), [143, null])
  assert.deepEqual(await f.snapshot(), {})

  // A failed bind releases only this attempt's new record.
  const other = createServer()
  await new Promise((resolve, reject) => other.once('error', reject).listen(Number(lanPort), host, resolve))
  try {
    const unavailable = f.start('server.mjs')
    await unavailable.closed
    assert.equal(unavailable.child.exitCode, 1)
    assert.match(unavailable.output, /EADDRINUSE/)
    assert.deepEqual(await f.snapshot(), {})
    assert.equal(other.listening, true)
  } finally { await new Promise(resolve => other.close(resolve)) }
})
