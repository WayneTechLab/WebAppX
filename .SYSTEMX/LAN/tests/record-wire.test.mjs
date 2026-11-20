import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomInt, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../Builder/runtime/port-utils.mjs'

test('real authenticated LAN record, page, and component operations share one private replay-protected store', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'webappx-record-http-'))
  const lan = join(fixture, '.SYSTEMX', 'LAN')
  const repositoryLan = fileURLToPath(new URL('../', import.meta.url))
  let child, stopped
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill()
    if (stopped) await stopped
    await rm(fixture, { recursive: true, force: true })
  })
  await mkdir(join(lan, 'Files'), { recursive: true })
  for (const name of ['Builder', 'Website_Dashboard.html', 'server.mjs', 'session-restart-preview.mjs', 'work-status.mjs']) {
    await cp(join(repositoryLan, name), join(lan, name), { recursive: true })
  }
  const port = String(await findAvailablePort(randomInt(20000, 60000)))
  const origin = 'http://127.0.0.1:' + port
  child = spawn(process.execPath, [join(lan, 'server.mjs')], {
    cwd: fixture, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, PATH: dirname(process.execPath), SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_STRICT_PORT: 'true',
      SYSTEMX_LAN_PORT: port, SYSTEMX_APP_PORT: port, SYSTEMX_FIREBASE_AUTH_PORT: port,
      SYSTEMX_FIREBASE_FIRESTORE_PORT: port, SYSTEMX_FIREBASE_STORAGE_PORT: port },
  })
  stopped = once(child, 'close')
  const lines = createInterface({ input: child.stdout })
  const [line] = await Promise.race([once(lines, 'line', { signal: AbortSignal.timeout(8000) }),
    stopped.then(() => { throw new Error('Owned record fixture stopped before listening') })])
  lines.close()
  assert.equal(line, '[SYSTEMX LAN] ' + origin + '/')
  const dataFile = join(lan, 'Files', 'local-data.json')
  const registryFile = join(lan, 'Files', 'component-registry.json')
  const lock = dataFile + '.writer.lock'
  let token
  const api = async (path, body, key) => {
    const result = await fetch(origin + '/api/builder/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token && { 'x-systemx-session': token }), 'content-type': 'application/json', ...(key && { 'idempotency-key': key }) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    })
    return { status: result.status, result: await result.json() }
  }
  await writeFile(lock, 'offline test owner')
  assert.equal((await api('data')).result.code, 'LOCAL_DATA_WRITER_BUSY')
  await assert.rejects(readFile(dataFile), { code: 'ENOENT' })
  await rm(lock)
  const dashboard = await fetch(origin, { signal: AbortSignal.timeout(8000) })
  token = (await dashboard.text()).match(/<meta name="systemx-session" content="([0-9a-f]{48})"/)?.[1]
  assert.ok(token)
  const key = randomUUID()
  const record = { resource: 'collections', collectionId: 'crm-contacts', record: { name: '東京', detail: { b: 2, a: 1 } } }
  const page = { operation: 'create-page', route: '/new', name: 'New' }
  const component = { confirmation: 'SAVE MODULE', name: 'Example', pageId: 'new', nodeId: 'new-root' }
  const saved = await Promise.all(Array.from({ length: 4 }, () => api('record', record, key)))
  assert.equal(saved[0].status, 200)
  assert.deepEqual(Object.keys(saved[0].result).sort(), ['recordId', 'status'])
  for (const copy of saved) assert.deepEqual(copy, saved[0])
  assert.deepEqual(await api('record', { ...record, record: { detail: { a: 1, b: 2 }, name: '東京' } }, key), saved[0])
  assert.equal((await api('record', { ...record, record: { name: 'Different' } }, key)).status, 409)
  const visible = await api('data')
  assert.equal(visible.result.collections.find(row => row.id === 'crm-contacts').rows.length, 1)
  assert.ok(!Object.hasOwn(visible.result, '_recordCreateReceipts'))
  const older = await api('record', { resource: 'users', record: { name: 'Older client' } })
  assert.equal(older.status, 200)
  assert.equal(older.result.status, 'saved-local-record')
  assert.ok(!Object.hasOwn(older.result.data, '_recordCreateReceipts'))
  const stored = JSON.parse(await readFile(dataFile, 'utf8'))
  const witnesses = stored._recordCreateReceipts
  assert.equal(witnesses.length, 1)
  assert.ok(!JSON.stringify(stored).includes(key))

  await writeFile(lock, 'offline test owner')
  const protectedFiles = await Promise.all([readFile(dataFile), readFile(registryFile)])
  for (const [path, body] of [['record', record], ['page', page], ['component', component]]) {
    assert.equal((await api(path, body)).result.code, 'LOCAL_DATA_WRITER_BUSY')
  }
  assert.deepEqual(await Promise.all([readFile(dataFile), readFile(registryFile)]), protectedFiles)
  await rm(lock)
  assert.equal((await api('page', page)).status, 200)
  const linked = await api('component', component)
  assert.equal(linked.status, 200)
  assert.equal(linked.result.linkedNode.nodeId, 'new-root')
  const updated = JSON.parse(await readFile(dataFile, 'utf8'))
  assert.deepEqual(updated._recordCreateReceipts, witnesses)
  assert.equal(updated.pages.find(item => item.id === 'new').nodeTree.nodes['new-root'].props.moduleId, 'example')
  assert.deepEqual(await api('record', record, key), saved[0])
  assert.equal((await api('page', page)).result.error, 'That route already exists')

  await rename(join(lan, 'Backup'), join(lan, 'previous-backups'))
  await writeFile(join(lan, 'Backup'), 'private local fixture')
  assert.deepEqual(await api('page', { ...page, route: '/other' }), { status: 500, result: { error: 'The local LAN request could not be completed.' } })
  await writeFile(dataFile, '{broken')
  const previousRegistry = await readFile(registryFile)
  for (const [path, body] of [['data'], ['record', record], ['page', page], ['component', component]]) {
    assert.equal((await api(path, body)).status, 503)
  }
  assert.equal(await readFile(dataFile, 'utf8'), '{broken')
  assert.deepEqual(await readFile(registryFile), previousRegistry)
})
