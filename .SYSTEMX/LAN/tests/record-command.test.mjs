import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { executeRecordCommand, publicRecordData, recordReplayLimits, withLocalDataWriter } from '../Builder/record-command.mjs'

const moduleUrl = new URL('../Builder/record-command.mjs', import.meta.url).href
const original = { schemaVersion: 1, environment: 'local-fixture', collections: [{ id: 'crm-contacts', rows: [] }], users: [], pages: [] }
const body = { resource: 'collections', collectionId: 'crm-contacts', record: { name: 'Zoë', detail: { city: '東京', values: ['é', 2] } } }
const now = Date.UTC(2026, 0, 1)
const key = 'c5e844ae-c435-42c8-9c82-fb98e2ca69da'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-local-record-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const directory = join(root, 'Files')
  mkdirSync(directory)
  const file = join(directory, 'local-data.json')
  const ops = []
  const readData = () => JSON.parse(readFileSync(file, 'utf8'))
  const writeData = data => {
    const temp = file + '.' + process.pid + '.tmp'
    writeFileSync(temp, JSON.stringify(data), { flag: 'wx', mode: 0o600 })
    renameSync(temp, file)
  }
  writeData(structuredClone(original))
  const execute = (options = {}) => withLocalDataWriter(file, () => executeRecordCommand({
    body, idempotencyKey: key, readData, writeData, recordOperation: (...args) => ops.push(args), now,
    ...options,
  }))
  return { directory, file, readData, writeData, execute, ops }
}

test('row and private witness survive a reopen, equivalent nested Unicode input replays the exact receipt', t => {
  const f = fixture(t)
  const first = f.execute()
  assert.equal(first.statusCode, 200)
  assert.match(first.result.recordId, uuid)
  assert.deepEqual(Object.keys(first.result).sort(), ['recordId', 'status'])
  const stored = readFileSync(f.file, 'utf8')
  assert.ok(!stored.includes(key))
  const alternate = { collectionId: 'crm-contacts', record: { detail: { values: ['é', 2], city: '東京' }, name: 'Zoë' } }
  assert.deepEqual(f.execute({ body: alternate, idempotencyKey: key.toUpperCase() }), first)
  for (const change of [{ ...body, record: { ...body.record, detail: { city: '東京', values: [2, 'é'] } } },
    { resource: 'users', record: { name: 'Zoë' } }, { ...body, collectionId: 'different' }]) {
    const conflict = f.execute({ body: change })
    assert.equal(conflict.statusCode, 409)
    assert.equal(conflict.result.code, 'RECORD_KEY_CONFLICT')
  }
  const restarted = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs'
    import { executeRecordCommand, withLocalDataWriter } from ${JSON.stringify(moduleUrl)}
    const [file, idempotencyKey, text, now] = process.argv.slice(1)
    console.log(JSON.stringify(withLocalDataWriter(file, () => executeRecordCommand({
      body: JSON.parse(text), idempotencyKey, now: Number(now), readData: () => JSON.parse(readFileSync(file)),
      writeData: () => { throw new Error('unexpected write') }, recordOperation: () => { throw new Error('unexpected log') },
    }))))
  `, f.file, key, JSON.stringify(alternate), String(now)], { encoding: 'utf8', timeout: 5000 })
  assert.equal(restarted.status, 0, restarted.stderr)
  assert.deepEqual(JSON.parse(restarted.stdout), first)
  assert.equal(readFileSync(f.file, 'utf8'), stored)
  assert.deepEqual(f.ops, [['local_record_created', { resource: 'collections', collectionId: 'crm-contacts' }]])
  const local = publicRecordData(f.readData())
  assert.deepEqual(Object.keys(local), Object.keys(original))
  assert.deepEqual(local.collections[0].rows, [{ id: first.result.recordId, ...body.record, createdAt: new Date(now).toISOString() }])
})

test('legacy requests keep public fixture data and existing record overrides, opt-in users have server-owned fields', t => {
  const f = fixture(t)
  const user = { resource: 'users', record: { email: 'fixture@example.test', role: 'editor' } }
  const first = f.execute({ body: user })
  assert.deepEqual(f.execute({ body: user }), first)
  const legacy = f.execute({ idempotencyKey: undefined, body: { resource: 'users', record: { id: 'old-client-id', status: 'input' } } })
  assert.equal(legacy.statusCode, 200)
  assert.deepEqual(Object.keys(legacy.result).sort(), ['data', 'status'])
  assert.deepEqual(Object.keys(legacy.result.data), Object.keys(original))
  assert.deepEqual(legacy.result.data.users, [
    { id: first.result.recordId, ...user.record, provider: 'firebase-auth', status: 'local fixture' },
    { id: 'old-client-id', provider: 'firebase-auth', status: 'local fixture' },
  ])
  const prior = readFileSync(f.file, 'utf8')
  for (const options of [
    { idempotencyKey: 'caller-choice' }, { idempotencyKey: [key] }, { idempotencyKey: null },
    { body: { ...body, record: [] } }, { body: { ...body, record: { id: 'supplied' } } },
    { body: { ...body, resource: 'unknown' } }, { body: { ...user, collectionId: 'ignored' } },
    { body: { ...user, record: { provider: 'override' } } }, { body: { ...body, extra: 'ignored' } },
  ]) assert.equal(f.execute(options).statusCode, 400)
  assert.equal(readFileSync(f.file, 'utf8'), prior)
})

test('capacity refuses new keys and retains active ones; at 24 hours a key is outside its replay window', t => {
  const f = fixture(t)
  const first = f.execute()
  for (let i = 1; i < recordReplayLimits.keys; i++) assert.equal(f.execute({ idempotencyKey: randomUUID() }).statusCode, 200)
  const full = readFileSync(f.file, 'utf8')
  assert.equal(f.execute({ idempotencyKey: randomUUID() }).result.code, 'RECORD_KEY_CAPACITY')
  assert.deepEqual(f.execute({ now: now + recordReplayLimits.windowMs - 1 }), first)
  assert.equal(readFileSync(f.file, 'utf8'), full)
  const later = f.execute({ now: now + recordReplayLimits.windowMs })
  assert.equal(later.statusCode, 200)
  assert.notEqual(later.result.recordId, first.result.recordId)
  assert.equal(f.readData().collections[0].rows.length, recordReplayLimits.keys + 1)
})

test('uncertain writes recover from the actual snapshot, and a missing row or damaged witness fails closed', t => {
  const f = fixture(t)
  const failed = () => { throw new Error('private simulated I/O error') }
  assert.equal(f.execute({ writeData: failed }).result.code, 'RECORD_SAVE_UNCONFIRMED')
  assert.deepEqual(f.readData(), original)
  const uncertain = f.execute({ writeData: data => { f.writeData(data); failed() } })
  assert.equal(uncertain.statusCode, 503)
  assert.ok(!JSON.stringify(uncertain).includes('private simulated'))
  const expected = f.readData().collections[0].rows[0].id
  assert.equal(f.execute().result.recordId, expected)
  assert.equal(f.readData().collections[0].rows.length, 1)
  const key2 = randomUUID()
  assert.equal(f.execute({ idempotencyKey: key2, recordOperation: failed }).statusCode, 503)
  assert.equal(f.execute({ idempotencyKey: key2 }).statusCode, 200)
  const data = f.readData()
  data.collections[0].rows = []
  f.writeData(data)
  assert.equal(f.execute().result.code, 'RECORD_RECEIPT_UNVERIFIED')
  data._recordCreateReceipts = null
  f.writeData(data)
  const before = readFileSync(f.file, 'utf8')
  assert.equal(f.execute().result.code, 'RECORD_RECEIPTS_INVALID')
  assert.equal(readFileSync(f.file, 'utf8'), before)
  writeFileSync(f.file, '{broken')
  assert.equal(f.execute().result.code, 'RECORD_SAVE_UNCONFIRMED')
  assert.equal(readFileSync(f.file, 'utf8'), '{broken')
})

test('a second process cannot enter an active writer, nested same-process seed is safe, and thrown operations release ownership', t => {
  const f = fixture(t)
  const lock = f.file + '.writer.lock'
  withLocalDataWriter(f.file, () => {
    assert.equal(withLocalDataWriter(f.file, () => 'nested'), 'nested')
    const contender = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { withLocalDataWriter } from ${JSON.stringify(moduleUrl)}
      try { withLocalDataWriter(process.argv[1], () => { process.exitCode = 1 }) }
      catch (error) { console.log(error.code) }
    `, f.file], { encoding: 'utf8', timeout: 5000 })
    assert.equal(contender.status, 0, contender.stderr)
    assert.equal(contender.stdout.trim(), 'LOCAL_DATA_WRITER_BUSY')
    assert.ok(existsSync(lock))
  })
  assert.throws(() => withLocalDataWriter(f.file, () => { throw new Error('operation failed') }), /operation failed/)
  assert.ok(!existsSync(lock))
  const interrupted = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { withLocalDataWriter } from ${JSON.stringify(moduleUrl)}
    withLocalDataWriter(process.argv[1], () => process.exit(11))
  `, f.file], { timeout: 5000 })
  assert.equal(interrupted.status, 11)
  assert.throws(() => withLocalDataWriter(f.file, () => assert.fail()), { code: 'LOCAL_DATA_WRITER_BUSY' })
  assert.ok(existsSync(lock))
})

test('a lock replaced during a writer transaction is retained for manual inspection', t => {
  const f = fixture(t)
  const lock = f.file + '.writer.lock'
  assert.throws(() => withLocalDataWriter(f.file, () => {
    renameSync(lock, lock + '.original')
    writeFileSync(lock, 'replacement')
  }), { code: 'LOCAL_DATA_UNAVAILABLE' })
  assert.equal(readFileSync(lock, 'utf8'), 'replacement')
  assert.ok(existsSync(lock + '.original'))
})

test('the writer refuses linked data, directories, temporary names and foreign locks', t => {
  const f = fixture(t)
  const sentinel = join(f.directory, 'sentinel')
  writeFileSync(sentinel, 'private fixture')
  const makeLink = (target, path, kind) => symlinkSync(target, path, kind)
  const temporary = f.file + '.' + process.pid + '.tmp'
  try { makeLink(sentinel, temporary, 'file') } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Fixture requires local file symlink permission')
    throw error
  }
  assert.throws(() => withLocalDataWriter(f.file, () => assert.fail()), { code: 'LOCAL_DATA_UNAVAILABLE' })
  rmSync(temporary)
  const lock = f.file + '.writer.lock'
  makeLink(sentinel, lock, 'file')
  assert.throws(() => withLocalDataWriter(f.file, () => assert.fail()), { code: 'LOCAL_DATA_WRITER_BUSY' })
  rmSync(lock)
  rmSync(f.file)
  makeLink(sentinel, f.file, 'file')
  assert.throws(() => withLocalDataWriter(f.file, () => assert.fail()), { code: 'LOCAL_DATA_UNAVAILABLE' })
  assert.equal(readFileSync(sentinel, 'utf8'), 'private fixture')
  const alias = join(f.directory, 'alias')
  mkdirSync(alias)
  makeLink(f.directory, join(alias, 'Files'), 'dir')
  assert.throws(() => withLocalDataWriter(join(alias, 'Files', 'local-data.json'), () => assert.fail()), { code: 'LOCAL_DATA_UNAVAILABLE' })
})
