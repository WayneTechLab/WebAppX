import { randomUUID } from 'node:crypto'
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { dirname, join } from 'node:path'
import net from 'node:net'
import { isDeepStrictEqual } from 'node:util'

export const LOOPBACK_HOST = '127.0.0.1'
export const IPV6_LOOPBACK_HOST = '::1'

function canBind(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    const finish = (available) => {
      probe.removeAllListeners()
      if (probe.listening) probe.close(() => resolve(available))
      else resolve(available)
    }

    probe.once('error', (error) => {
      // Some Windows/Linux environments disable IPv6 entirely. In that case
      // ::1 cannot reserve a port, so the IPv4 loopback result remains useful.
      if (host === IPV6_LOOPBACK_HOST && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) {
        finish(true)
        return
      }
      finish(false)
    })
    probe.once('listening', () => finish(true))
    probe.listen({ host, port })
  })
}

export async function isPortAvailable(port) {
  const ipv4 = await canBind(port, LOOPBACK_HOST)
  if (!ipv4) return false
  return canBind(port, IPV6_LOOPBACK_HOST)
}

export async function findAvailablePort(preferredPort, range = 30) {
  for (let port = preferredPort; port <= preferredPort + range; port += 1) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No loopback port available from ${preferredPort} to ${preferredPort + range}`)
}

export function validPort(value, label) {
  const port = Number.parseInt(String(value), 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid ${label}`)
  }
  return port
}

export function sessionPath(repoRoot) {
  return join(repoRoot, '.SYSTEMX', 'state', 'local-session.json')
}

// All cooperating launch, update and recovery paths serialize their
// read-check-replace/remove steps. A crashed writer's guard is preserved.
const sessionOwners = new Map()
const guardSleep = new Int32Array(new SharedArrayBuffer(4))

function withRecordGuard(repoRoot, operation) {
  const target = join(realpathSync(repoRoot), '.SYSTEMX', 'state', 'local-session.json')
  if (realpathSync(dirname(target)) !== dirname(target)) throw new Error('Unverified session state directory')
  const lock = target + '.lock'
  const deadline = performance.now() + 1500
  let fd
  while (fd === undefined) {
    try { fd = openSync(lock, 'wx', 0o600) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (performance.now() >= deadline) {
        throw Object.assign(new Error('Session record update is busy or interrupted. Preserve local-session.json.lock and inspect its writer before recovery.'), { code: 'SESSION_RECORD_BUSY' })
      }
      Atomics.wait(guardSleep, 0, 0, 10)
    }
  }
  const identity = fstatSync(fd)
  try {
    writeFileSync(fd, `${process.pid}\n`)
    return operation(target)
  } finally {
    closeSync(fd)
    const current = lstatSync(lock, { throwIfNoEntry: false })
    if (current?.dev === identity.dev && current.ino === identity.ino) unlinkSync(lock)
  }
}

function replaceRecord(target, session) {
  const temporary = `${target}.${randomUUID()}.tmp`
  let created = false
  try {
    const fd = openSync(temporary, 'wx', 0o600)
    created = true
    try { writeFileSync(fd, `${JSON.stringify(session, null, 2)}\n`) } finally { closeSync(fd) }
    renameSync(temporary, target)
    created = false
  } finally {
    if (created) unlinkSync(temporary)
  }
}

function requireWriter(session) {
  if (session.ownerPid !== process.pid || typeof session.sessionId !== 'string' || !session.sessionId) {
    throw new Error('The workspace session belongs to another generation or writer. Inspect session status before starting.')
  }
}

function newClaim(target, session) {
  requireWriter(session)
  if (lstatSync(target, { throwIfNoEntry: false })) {
    throw Object.assign(new Error('The workspace session record is already claimed.'), { code: 'EEXIST' })
  }
  replaceRecord(target, session)
  sessionOwners.set(target, session.sessionId)
}

export function claimSession(repoRoot, session) {
  return withRecordGuard(repoRoot, target => newClaim(target, session))
}

export function writeSession(repoRoot, session) {
  requireWriter(session)
  return withRecordGuard(repoRoot, target => {
    const entry = lstatSync(target, { throwIfNoEntry: false })
    if (!entry && !sessionOwners.has(target)) return newClaim(target, session)
    const previous = entry?.isFile() ? readSession(repoRoot) : null
    if (sessionOwners.get(target) !== session.sessionId || previous?.sessionId !== session.sessionId || previous.ownerPid !== process.pid) {
      throw new Error('The workspace session is claimed by another generation. Inspect session status before starting.')
    }
    replaceRecord(target, session)
  })
}

function sameFile(left, right) {
  return right?.isFile() && left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs
}

// Read a single bounded record in the selected workspace. An atomic replacement
// during process/listener inspection invalidates this observation.
export function readSessionRecordSnapshot(repoRoot) {
  const target = sessionPath(realpathSync(repoRoot))
  const dir = dirname(target)
  const state = lstatSync(dir, { throwIfNoEntry: false })
  if (!state) return { absent: true }
  if (!state.isDirectory() || realpathSync(dir) !== dir) throw new Error()
  if (lstatSync(target + '.lock', { throwIfNoEntry: false })) throw new Error()
  const identity = lstatSync(target, { bigint: true, throwIfNoEntry: false })
  if (!identity) return { absent: true }
  if (!identity.isFile() || identity.nlink !== 1n || identity.size < 1n || identity.size > BigInt(1_000_000)) throw new Error()
  const fd = openSync(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    if (!sameFile(identity, fstatSync(fd, { bigint: true }))) throw new Error()
    const bytes = Buffer.alloc(Number(identity.size))
    let offset = 0
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset)
      if (!count) throw new Error()
      offset += count
    }
    if (!sameFile(identity, fstatSync(fd, { bigint: true }))) throw new Error()
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    return { record, current: () => realpathSync(dir) === dir && !lstatSync(target + '.lock', { throwIfNoEntry: false }) &&
      sameFile(identity, lstatSync(target, { bigint: true, throwIfNoEntry: false })) }
  } finally { closeSync(fd) }
}

export function readSession(repoRoot) {
  const target = sessionPath(repoRoot)
  if (!existsSync(target)) return null
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch {
    return null
  }
}

export function clearSession(repoRoot, sessionId) {
  if (!sessionId || !existsSync(sessionPath(repoRoot))) return false
  return withRecordGuard(repoRoot, target => {
    const current = lstatSync(target, { throwIfNoEntry: false })?.isFile() ? readSession(repoRoot) : null
    if (sessionOwners.get(target) !== sessionId || current?.sessionId !== sessionId || current.ownerPid !== process.pid) return false
    unlinkSync(target)
    sessionOwners.delete(target)
    return true
  })
}

// Keep a cooperating launcher from publishing another generation while a stop
// request verifies and signals its target. Readiness and output may change
// between checks without granting a different process authority.
export function withMatchingSessionOwner(repoRoot, expected, act) {
  if (!expected?.sessionId || !existsSync(sessionPath(repoRoot))) return false
  return withRecordGuard(repoRoot, target => {
    const entry = lstatSync(target, { throwIfNoEntry: false })
    if (!entry?.isFile() || entry.size > 1_000_000) return false
    const current = readSession(repoRoot)
    const fields = ['sessionId', 'ownerPid', 'mode', 'processes', 'processIdentities', 'startingRole', 'runtime', 'artifactReceipts', 'preservedPidMarkers']
    if (!current || !fields.every(field => isDeepStrictEqual(current[field], expected[field]))) return false
    return act(current)
  })
}

// The caller verifies every recorded process has exited. Recheck the exact
// snapshot under the writer guard before touching its config or record.
export function clearExitedSession(repoRoot, expectedRecord, beforeClear = () => {}) {
  if (!expectedRecord?.sessionId || !existsSync(sessionPath(repoRoot))) return false
  if (beforeClear.constructor.name === 'AsyncFunction') throw new TypeError('Session cleanup must finish synchronously.')
  return withRecordGuard(repoRoot, target => {
    const file = lstatSync(target, { bigint: true, throwIfNoEntry: false })
    if (!file?.isFile() || file.nlink !== 1n || file.size > 1_000_000n) return false
    const current = readSession(repoRoot)
    if (!current || JSON.stringify(current) !== JSON.stringify(expectedRecord)) return false
    const stillCurrent = () => sameFile(file, lstatSync(target, { bigint: true, throwIfNoEntry: false }))
    if (!stillCurrent()) return false
    if (beforeClear(stillCurrent)?.then) throw new TypeError('Session cleanup must finish synchronously.')
    if (!stillCurrent()) return false
    unlinkSync(target)
    sessionOwners.delete(target)
    return true
  })
}

export function cleanStalePidFiles(repoRoot, probe = pid => process.kill(pid, 0)) {
  const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
  if (!existsSync(stateRoot)) return []
  const removed = []
  for (const name of readdirSync(stateRoot)) {
    const matched = /^local-(?:lan|vite)-([1-9]\d{3,4})\.pid$/.exec(name)
    if (!matched || Number(matched[1]) < 1024 || Number(matched[1]) > 65535) continue
    const target = join(stateRoot, name)
    const entry = lstatSync(target, { throwIfNoEntry: false })
    if (!entry?.isFile() || entry.size > 16) continue
    const bytes = readFileSync(target, 'utf8')
    if (!/^[1-9]\d{0,9}(?:\r?\n)?$/.test(bytes)) continue
    const pid = Number(bytes)
    if (pid === process.pid || pid > 0x7fffffff) continue
    try { probe(pid) } catch (error) {
      if (error.code !== 'ESRCH') continue
      const current = lstatSync(target, { throwIfNoEntry: false })
      if (!current?.isFile() || current.dev !== entry.dev || current.ino !== entry.ino || readFileSync(target, 'utf8') !== bytes) continue
      unlinkSync(target)
      removed.push(name)
    }
  }
  return removed
}

export function writePidFile(repoRoot, name, pid) {
  const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
  const target = join(stateRoot, name)
  writeFileSync(target, `${pid}\n`, { mode: 0o600 })
  return target
}

export function removePidFile(repoRoot, name, pid) {
  const target = join(repoRoot, '.SYSTEMX', 'state', name)
  if (!existsSync(target)) return
  try {
    const recorded = Number.parseInt(readFileSync(target, 'utf8').trim(), 10)
    if (!pid || recorded === pid) unlinkSync(target)
  } catch {
    // Runtime cleanup must not hide the original process result.
  }
}
