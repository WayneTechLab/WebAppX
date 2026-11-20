import assert from 'node:assert/strict'
import { fork, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { captureSessionProcessIdentity, inspectSessionListeners } from '../session-restart-preview.mjs'
import { createSessionTable, inspectWorkspaceSession, parseSessionTableArgs } from '../session-table.mjs'

const generation = () => 'systemx-' + randomUUID()
const sha256 = text => createHash('sha256').update(text).digest('hex')
const sourceLan = fileURLToPath(new URL('../', import.meta.url))
const recordPath = root => join(root, '.SYSTEMX', 'state', 'local-session.json')
const snapshot = listeners => () => ({ complete: true, listeners })

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-table-')))
  mkdirSync(join(root, '.SYSTEMX', 'state'), { recursive: true })
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function seed(root, pid, port) {
  const sessionId = generation()
  const commands = { session: ['.SYSTEMX/LAN/dev-session.mjs', '--generation', sessionId], vite: ['node_modules/vite/bin/vite.js', '--port', port] }
  const processes = { session: pid, vite: pid + 1 }
  const observations = new Map()
  const processIdentities = {}
  for (const [role, [script, ...flags]] of Object.entries(commands)) {
    const processId = processes[role], parentPid = role === 'session' ? 7 : pid
    const command = 'node ' + join(root, script) + ' ' + flags.join(' ')
    const startedAt = 'birth-' + processId
    processIdentities[role] = { pid: processId, startedAt, parentPid, commandHash: sha256(command), workingDirectory: root }
    observations.set(processId, { pid: processId, exists: true, command, startedAt, parentPid, cwd: root })
  }
  const origin = 'http://127.0.0.1:' + port
  const record = { mode: 'combined', sessionId, ownerPid: pid, processes, processIdentities, ports: { app: port },
    origin: { url: origin, host: '127.0.0.1', scheme: 'http', port }, urls: { app: origin + '/' },
    token: 'example-unpublished-value', readiness: { app: 'ready' } }
  const save = () => writeFileSync(recordPath(root), JSON.stringify(record))
  save()
  return { record, save, observations, origin, listener: { pid: pid + 1, host: '127.0.0.1', port } }
}

test('each selected workspace qualifies its own generation, exact origin and live role even when labels or ports coincide', t => {
  const a = workspace(t), b = workspace(t), empty = workspace(t)
  const first = seed(a, 2010, 47100), second = seed(b, 3010, 47100)
  const table = new Map([...first.observations, ...second.observations])
  let listenerReads = 0
  const options = { repoRoot: a, workspaces: [b, empty], inspectProcess: pid => table.get(pid),
    inspectListeners() { listenerReads++; return { complete: true, listeners: [second.listener] } } }
  const before = [a, b].map(root => readFileSync(recordPath(root)))
  const result = createSessionTable(options)
  assert.equal(result.readOnly, true)
  assert.deepEqual(result.sessions.map(row => row.position), [1, 2, 3])
  assert.deepEqual(result.sessions.map(row => row.selection), ['current', 'selected', 'selected'])
  assert.deepEqual(result.sessions.map(row => row.workspaceId), [a, b, empty].map(root => sha256('systemx-workspace\0' + root)))
  assert.deepEqual(result.sessions.map(row => row.ownership), ['owned', 'owned', 'absent'])
  assert.deepEqual(result.sessions.map(row => row.generation), [first.record.sessionId, second.record.sessionId, null])
  assert.deepEqual(result.sessions.map(row => row.activeOrigin), [null, second.origin, null])
  assert.deepEqual(result.sessions.map(row => row.listener.state), ['unrelated', 'owned', 'unverified'])
  assert.deepEqual(result.sessions.map(row => row.listener.pid), [null, second.listener.pid, null])
  assert.equal(listenerReads, 1)
  for (const value of [a, b, 'example-unpublished-value', 'vite.js', 'workingDirectory', 'ready']) assert.ok(!JSON.stringify(result).includes(value))
  assert.deepEqual([a, b].map(root => readFileSync(recordPath(root))), before)
  assert.equal(existsSync(recordPath(empty)), false)
  assert.deepEqual(createSessionTable({ ...options, workspaces: [] }).sessions.map(row => row.workspaceId), [result.sessions[0].workspaceId])
})

test('uncertain endpoint observations keep the declared origin separate from an active origin', t => {
  const root = workspace(t)
  const data = seed(root, 4010, 47101)
  const inspectProcess = pid => data.observations.get(pid)
  for (const live of [
    { complete: false, listeners: [data.listener] },
    { complete: 'partial', listeners: [data.listener] },
    { complete: true, listeners: [data.listener, { ...data.listener, pid: 117 }] },
    { complete: true, listeners: [{ ...data.listener, host: '*' }] },
    { complete: true, listeners: [{ ...data.listener, host: '::1' }] },
    { complete: true, listeners: [{ ...data.listener, pid: null }] },
    { complete: true, listeners: [data.listener, {}] },
  ]) {
    const row = inspectWorkspaceSession(root, { inspectProcess, inspectListeners: () => live })
    assert.equal(row.ownership, 'owned')
    assert.equal(row.recordedOrigin, data.origin)
    assert.equal(row.activeOrigin, null)
    assert.deepEqual(row.listener, { state: 'unverified', pid: null })
  }
  const noListener = inspectWorkspaceSession(root, { inspectProcess, inspectListeners: snapshot([]) })
  assert.deepEqual(noListener.listener, { state: 'absent', pid: null })
  data.record.origin.host = 'localhost'
  data.record.origin.url = 'http://localhost:47101'
  data.record.urls.app = data.record.origin.url + '/'
  data.save()
  const ipv6 = inspectWorkspaceSession(root, { inspectProcess, inspectListeners: snapshot([{ ...data.listener, host: '[::1]' }]) })
  assert.equal(ipv6.activeOrigin, data.record.origin.url)
  data.record.ports.app++
  data.save()
  assert.equal(inspectWorkspaceSession(root, { inspectProcess, inspectListeners: snapshot([data.listener]) }).recordedOrigin, null)
})

test('reused PIDs, foreign records, old generations, and changed workspace evidence cannot declare an active origin', t => {
  const a = workspace(t), b = workspace(t)
  const data = seed(a, 5010, 47102)
  const inspect = (root = a) => inspectWorkspaceSession(root, { inspectProcess: pid => data.observations.get(pid), inspectListeners: snapshot([data.listener]) })
  cpSync(recordPath(a), recordPath(b))
  assert.equal(inspect(b).ownership, 'unverified')
  const stopped = inspectWorkspaceSession(a, { inspectProcess: pid => ({ pid, exists: false }), inspectListeners: snapshot([data.listener]) })
  assert.equal(stopped.ownership, 'exited')
  assert.equal(stopped.activeOrigin, null)
  const child = data.observations.get(data.listener.pid)
  child.startedAt = 'reused'
  assert.equal(inspect().activeOrigin, null)
  child.startedAt = data.record.processIdentities.vite.startedAt
  const original = data.record.sessionId
  data.record.sessionId = generation()
  data.save()
  assert.equal(inspect().ownership, 'unverified')
  data.record.sessionId = 'legacy-record'
  data.save()
  assert.equal(inspect().generation, null)
  data.record.sessionId = original
  data.save()
  const raced = inspectWorkspaceSession(a, { inspectProcess: pid => data.observations.get(pid), inspectListeners: () => {
    data.record.sessionId = generation(); data.save()
    return { complete: true, listeners: [data.listener] }
  } })
  assert.equal(raced.activeOrigin, null)
  assert.deepEqual(raced.reasons, ['session-record-changed'])
})

test('bounded explicit selectors, linked state, invalid and missing records have fixed outcomes', t => {
  const a = workspace(t), b = workspace(t)
  assert.deepEqual(parseSessionTableArgs(['--workspace', b]), [b])
  for (const args of [['--workspace'], ['--all', b], ['--workspace', '--workspace'], Array.from({ length: 24 }, (_, i) => i % 2 ? b : '--workspace')]) {
    assert.throws(() => parseSessionTableArgs(args), /Usage/)
  }
  assert.throws(() => createSessionTable({ repoRoot: a, workspaces: [a] }), /each workspace once/)
  assert.throws(() => createSessionTable({ repoRoot: a, workspaces: [join(b, 'missing')] }), error => !error.message.includes(b))
  const untouched = seed(b, 6010, 47103)
  const bytes = readFileSync(recordPath(b))
  const state = join(a, '.SYSTEMX', 'state')
  rmSync(state, { recursive: true })
  symlinkSync(join(b, '.SYSTEMX', 'state'), state, process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal(inspectWorkspaceSession(a).ownership, 'unverified')
  assert.deepEqual(readFileSync(recordPath(b)), bytes)
  assert.ok(!JSON.stringify(inspectWorkspaceSession(a)).includes(untouched.record.sessionId))
})

test('operator sees a disposable standalone LAN listener only in its owning workspace', {
  skip: !['darwin', 'linux'].includes(process.platform) ? 'Real local ps/lsof fixture' : false, timeout: 20_000,
}, async t => {
  if (process.platform === 'linux' && !inspectSessionListeners().complete) { t.skip('Requires lsof listener inventory'); return }
  const owner = workspace(t), other = workspace(t), lan = join(owner, '.SYSTEMX', 'LAN')
  mkdirSync(lan)
  for (const name of readdirSync(sourceLan)) if (name.endsWith('.mjs')) cpSync(join(sourceLan, name), join(lan, name))
  cpSync(join(sourceLan, 'Builder', 'runtime'), join(lan, 'Builder', 'runtime'), { recursive: true })
  const entry = join(lan, 'server.mjs')
  writeFileSync(entry, `import { createServer } from 'node:net'
const server = createServer(socket => socket.end())
server.listen(0, '127.0.0.1', () => process.send(server.address().port))
process.on('message', () => server.close(() => process.disconnect()))
`)
  const child = fork(entry, [], { cwd: owner, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
  const exited = once(child, 'exit')
  t.after(async () => { if (child.connected) child.send('close'); await exited })
  const [port] = await once(child, 'message', { signal: AbortSignal.timeout(5_000) })
  const origin = 'http://127.0.0.1:' + port
  const identity = captureSessionProcessIdentity(child.pid, { workingDirectory: owner })
  assert.ok(identity)
  const record = { mode: 'lan-only', sessionId: generation(), ownerPid: child.pid, host: '127.0.0.1',
    origin: { url: origin, port, host: '127.0.0.1', scheme: 'http' }, urls: { lan: origin + '/' },
    ports: { lan: port }, processes: { lan: child.pid }, processIdentities: { lan: identity } }
  for (const root of [owner, other]) writeFileSync(recordPath(root), JSON.stringify(record))
  const cli = spawnSync(process.execPath, [join(lan, 'session-control.mjs'), 'sessions', '--workspace', other], { encoding: 'utf8', timeout: 12_000, cwd: owner })
  assert.equal(cli.status, 0, cli.stderr)
  const [self, foreign] = JSON.parse(cli.stdout).sessions
  assert.equal(self.activeOrigin, origin)
  assert.equal(self.listener.pid, child.pid)
  assert.equal(foreign.activeOrigin, null)
  assert.equal(foreign.ownership, 'unverified')
  for (const root of [owner, other]) assert.equal(readFileSync(recordPath(root), 'utf8'), JSON.stringify(record))
  assert.equal(child.exitCode, null)
})
