import { randomUUID } from 'node:crypto'
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync,
  realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { previewPresets } from './Website/preview-presets.js'

const maxBytes = 512
const absent = { port: null, layout: null }
const validLayout = value => typeof value === 'string' && (value === 'fit' || Object.hasOwn(previewPresets, value))
const validPort = value => Number.isInteger(value) && value >= 1024 && value <= 65535
const failure = code => Object.assign(new Error(code), { code })
const info = path => lstatSync(path, { bigint: true, throwIfNoEntry: false })
function sameFile(a, b) {
  return a && b && a.isFile() && b.isFile() && a.nlink === 1n && b.nlink === 1n &&
    a.dev === b.dev && a.ino === b.ino && a.ctimeNs === b.ctimeNs && a.size === b.size
}

function stateDirectory(repoRoot, create) {
  const system = join(realpathSync(repoRoot), '.SYSTEMX')
  if (!info(system)?.isDirectory() || realpathSync(system) !== system) throw failure('workspace-unverified')
  const directory = join(system, 'state')
  if (!info(directory)) {
    if (!create) return null
    try { mkdirSync(directory, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
  }
  if (!info(directory)?.isDirectory() || realpathSync(directory) !== directory) throw failure('state-directory-unverified')
  return directory
}

function readSaved(target) {
  const original = info(target)
  if (!original) return null
  if (!original.isFile() || original.nlink !== 1n || original.size < 1n || original.size > BigInt(maxBytes)) {
    throw failure('preferences-unreadable')
  }
  const fd = openSync(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    if (!sameFile(original, fstatSync(fd, { bigint: true }))) throw failure('preferences-changed')
    const bytes = Buffer.alloc(Number(original.size))
    let offset = 0
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset)
      if (!count) throw failure('preferences-changed')
      offset += count
    }
    if (!sameFile(original, info(target))) throw failure('preferences-changed')
    let record
    try { record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw failure('preferences-unreadable') }
    if (!record || record.schemaVersion !== 1 || Object.keys(record).length !== 3 ||
        !(record.port === null || validPort(record.port)) || !(record.layout === null || validLayout(record.layout)) ||
        record.port === null && record.layout === null) throw failure('preferences-unreadable')
    return { port: record.port, layout: record.layout }
  } finally { closeSync(fd) }
}

function validateChanges(changes) {
  if (!changes || !Object.keys(changes).length || !Object.entries(changes).every(([key, value]) =>
    key === 'port' ? validPort(value) : key === 'layout' && validLayout(value))) throw failure('invalid-preference-fields')
}

export function sessionPreferences(repoRoot, action, changes = {}) {
  if (!['get', 'set', 'clear'].includes(action)) throw failure('invalid-preference-fields')
  if (action === 'set') validateChanges(changes)
  else if (Object.keys(changes).length) throw failure('invalid-preference-fields')
  const directory = stateDirectory(repoRoot, action === 'set')
  if (!directory) return { status: action === 'clear' ? 'cleared' : 'absent', preferences: null }
  const target = join(directory, 'local-session-preferences.json')
  if (action === 'get') {
    const preferences = readSaved(target)
    return { status: preferences ? 'available' : 'absent', preferences }
  }

  // All cooperating writers serialize partial updates. A single rename publishes
  // the complete record even if a process exits while writing its temporary file.
  const lock = join(directory, 'local-session-preferences-lock.json')
  let guard
  try { guard = openSync(lock, 'wx', 0o600) }
  catch (error) { if (error.code === 'EEXIST') throw failure('preferences-busy'); throw error }
  const identity = fstatSync(guard, { bigint: true })
  const temp = join(directory, 'local-session-preferences-' + randomUUID() + '.json')
  let temporary
  try {
    if (stateDirectory(repoRoot, false) !== directory) throw failure('state-directory-unverified')
    const previous = info(target)
    if (previous && (!previous.isFile() || previous.nlink !== 1n)) throw failure('preferences-unreadable')
    if (action === 'clear') {
      if (previous && sameFile(previous, info(target))) unlinkSync(target)
      else if (previous) throw failure('preferences-changed')
      return { status: 'cleared', preferences: null }
    }
    const preferences = { ...(readSaved(target) ?? absent), ...changes }
    const fd = openSync(temp, 'wx', 0o600)
    try {
      writeFileSync(fd, JSON.stringify({ schemaVersion: 1, port: preferences.port, layout: preferences.layout }) + '\n')
    } finally { temporary = fstatSync(fd, { bigint: true }); closeSync(fd) }
    const current = info(target)
    if (stateDirectory(repoRoot, false) !== directory || !sameFile(identity, info(lock)) ||
        (previous ? !sameFile(previous, current) : current)) throw failure('preferences-changed')
    renameSync(temp, target)
    temporary = null
    return { status: 'saved', preferences }
  } finally {
    closeSync(guard)
    if (stateDirectory(repoRoot, false) === directory) {
      if (temporary && sameFile(temporary, info(temp))) unlinkSync(temp)
      if (sameFile(identity, info(lock))) unlinkSync(lock)
    }
  }
}

export function parsePreferenceFields(args) {
  if (args.length < 2 || args.length > 4 || args.length % 2) throw failure('invalid-preference-fields')
  const changes = {}
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1]
    if (flag === '--port' && !Object.hasOwn(changes, 'port') && /^[1-9]\d{3,4}$/.test(value)) changes.port = Number(value)
    else if (flag === '--layout' && !Object.hasOwn(changes, 'layout')) changes.layout = value
    else throw failure('invalid-preference-fields')
  }
  validateChanges(changes)
  return changes
}
