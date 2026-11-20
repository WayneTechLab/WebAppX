import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fstatSync, lstatSync, openSync, unlinkSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { types } from 'node:util'
import { canonicalJson } from './graph-core.mjs'
import { confinedDirectory } from './runtime/file-boundary.mjs'

export const recordReplayLimits = Object.freeze({ keys: 128, windowMs: 24 * 60 * 60 * 1000 })
const ledgerField = '_recordCreateReceipts'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hexDigest = /^[0-9a-f]{64}$/
const digest = value => createHash('sha256').update(value).digest('hex')
const refused = (statusCode, code, error) => ({ statusCode, result: { code, error } })
const receipt = recordId => ({ statusCode: 200, result: { status: 'saved-local-record', recordId } })
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const held = new Set()

export class LocalDataWriterError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.statusCode = 503
  }
}

const storageUnavailable = () => new LocalDataWriterError('LOCAL_DATA_UNAVAILABLE', 'The local data store could not be verified. Inspect its state before writing.')
const entry = path => lstatSync(path, { bigint: true, throwIfNoEntry: false })

function releaseWriter(lock, descriptor) {
  try {
    let original
    try {
      original = fstatSync(descriptor, { bigint: true })
    } finally {
      closeSync(descriptor)
    }
    const current = entry(lock)
    if (!current?.isFile() || current.dev !== original.dev || current.ino !== original.ino || current.nlink !== 1n) throw storageUnavailable()
    unlinkSync(lock)
  } catch {
    throw storageUnavailable()
  }
}

// All fixture writers take this lock before reading a snapshot. Synchronous
// nested calls (including first-use seeding) stay inside the outer transaction.
export function withLocalDataWriter(file, operation) {
  const target = resolve(file)
  const directory = dirname(target)
  if (basename(target) !== 'local-data.json' || basename(directory) !== 'Files' || typeof operation !== 'function' || types.isAsyncFunction(operation)) throw storageUnavailable()
  if (held.has(target)) return operation()

  const lock = target + '.writer.lock'
  let descriptor
  try {
    const lan = dirname(directory)
    if (!entry(lan)?.isDirectory()) throw storageUnavailable()
    confinedDirectory(lan, directory)
    const data = entry(target)
    if ((data && (!data.isFile() || data.nlink !== 1n)) || entry(target + '.' + process.pid + '.tmp')) throw storageUnavailable()
    descriptor = openSync(lock, 'wx', 0o600)
  } catch (error) {
    if (error.code === 'EEXIST') throw new LocalDataWriterError('LOCAL_DATA_WRITER_BUSY', 'A local data writer lock exists. Verify the owning session and local store before manual recovery.')
    throw storageUnavailable()
  }

  held.add(target)
  try {
    return operation()
  } finally {
    held.delete(target)
    releaseWriter(lock, descriptor)
  }
}

// Both public full-data responses use this projection. Other local writers keep
// the original object so an unrelated page or component edit preserves receipts.
export function publicRecordData(data) {
  const { [ledgerField]: _privateReceipts, ...publicData } = data
  return publicData
}

function activeReceipts(data, now) {
  if (!Object.hasOwn(data, ledgerField)) return []
  const entries = data[ledgerField]
  if (!Array.isArray(entries) || entries.length > recordReplayLimits.keys) return null
  const seen = new Set()
  for (const entry of entries) {
    if (!object(entry) || Object.keys(entry).length !== 4 ||
        typeof entry.keyHash !== 'string' || !hexDigest.test(entry.keyHash) || seen.has(entry.keyHash) ||
        typeof entry.payloadHash !== 'string' || !hexDigest.test(entry.payloadHash) ||
        typeof entry.recordId !== 'string' || !uuid.test(entry.recordId) ||
        !Number.isSafeInteger(entry.expiresAt) || entry.expiresAt < 0) return null
    seen.add(entry.keyHash)
  }
  return entries.filter(entry => entry.expiresAt > now)
}

// readData returns a fresh private fixture snapshot. writeData synchronously
// renames one complete replacement; never split the witness from the row.
// The caller holds withLocalDataWriter around this whole operation.
export function executeRecordCommand({ body, idempotencyKey, readData, writeData, recordOperation, now = Date.now() }) {
  const keyed = idempotencyKey !== undefined
  if (keyed && (typeof idempotencyKey !== 'string' || !uuid.test(idempotencyKey))) {
    return refused(400, 'RECORD_KEY_INVALID', 'Use a UUID v4 Idempotency-Key for this local record.')
  }
  if (!body?.record || typeof body.record !== 'object') return refused(400, 'RECORD_REQUIRED', 'Record is required')
  const resource = body.resource === 'users' ? 'users' : 'collections'
  const collectionId = resource === 'collections' ? body.collectionId : null
  let keyHash, payloadHash
  if (keyed) {
    const reserved = resource === 'users' ? ['id', 'status', 'provider'] : ['id', 'createdAt']
    const allowed = resource === 'users' ? ['resource', 'record'] : ['resource', 'collectionId', 'record']
    if (!object(body.record) || ![undefined, 'users', 'collections'].includes(body.resource) ||
        (resource === 'collections' && (typeof collectionId !== 'string' || !collectionId || collectionId.length > 128)) ||
        Object.keys(body).some(field => !allowed.includes(field)) || reserved.some(field => Object.hasOwn(body.record, field))) {
      return refused(400, 'RECORD_PAYLOAD_INVALID', 'Submit record fields for one local collection or user. Leave server-owned fields out.')
    }
    try {
      payloadHash = digest(canonicalJson({ resource, collectionId, record: body.record }))
    } catch {
      return refused(400, 'RECORD_PAYLOAD_INVALID', 'The keyed record must contain bounded JSON fields.')
    }
    keyHash = digest('systemx-local-record-v1:' + idempotencyKey.toLowerCase())
  }

  try {
    const data = readData({ strict: keyed })
    const rows = resource === 'users' ? data.users : data.collections.find(item => item.id === collectionId)?.rows
    const entries = keyed ? activeReceipts(data, now) : []
    if (!entries) return refused(503, 'RECORD_RECEIPTS_INVALID', 'Stored record receipts could not be verified. Inspect the local data before creating another record.')
    const existing = keyed && entries.find(entry => entry.keyHash === keyHash)
    if (existing) {
      if (existing.payloadHash !== payloadHash) return refused(409, 'RECORD_KEY_CONFLICT', 'This key already belongs to different local record content.')
      if (!rows?.some(row => row.id === existing.recordId)) return refused(409, 'RECORD_RECEIPT_UNVERIFIED', 'The stored receipt has no matching local record. Inspect the collection or user list.')
      return receipt(existing.recordId)
    }
    if (!rows && resource === 'collections') return refused(400, 'COLLECTION_UNKNOWN', 'Unknown collection')
    if (keyed && entries.length >= recordReplayLimits.keys) {
      return refused(429, 'RECORD_KEY_CAPACITY', 'The local record replay window is full. Existing keys remain available.')
    }
    const recordId = randomUUID()
    const row = resource === 'users'
      ? { id: recordId, ...body.record, status: 'local fixture', provider: 'firebase-auth' }
      : { id: recordId, ...body.record, createdAt: new Date(now).toISOString() }
    rows.push(row)
    if (keyed) data[ledgerField] = [...entries, { keyHash, payloadHash, recordId, expiresAt: now + recordReplayLimits.windowMs }]
    writeData(data)
    recordOperation('local_record_created', { resource, collectionId: body.collectionId ?? null })
    return keyed ? receipt(recordId) : { statusCode: 200, result: { status: 'saved-local-record', data: publicRecordData(data) } }
  } catch {
    return refused(503, 'RECORD_SAVE_UNCONFIRMED', 'Record save was not confirmed. Inspect the local data before creating another record.')
  }
}
