import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export const sessionWorkspaceId = root => digest('systemx-workspace\0' + realpathSync(root))
const fail = reason => { throw Object.assign(new Error(reason), { code: reason }) }
const maxBytes = 1_000_000
const kinds = ['firebaseConfig', 'lanPid', 'vitePid']
const generation = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)

function identity(stat, bytes) {
  if (!stat.isFile() || stat.nlink !== 1n || stat.size !== BigInt(bytes.length) || stat.size > BigInt(maxBytes)) fail('runtime-artifact-unverified')
  return { dev: String(stat.dev), ino: String(stat.ino), birthNs: String(stat.birthtimeNs), size: bytes.length, sha256: digest(bytes) }
}

export function createSessionArtifact(path, content) {
  const bytes = Buffer.from(content)
  if (bytes.length > maxBytes) fail('runtime-artifact-size-limit')
  const fd = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(fd, bytes)
    return identity(fstatSync(fd, { bigint: true }), bytes)
  } finally { closeSync(fd) }
}

function inspectFile(path, expected, pid) {
  const before = lstatSync(path, { bigint: true, throwIfNoEntry: false })
  if (!before) return 'absent'
  if (!expected || !before.isFile() || before.nlink !== 1n || before.size > BigInt(maxBytes)) return 'unverified'
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const opened = fstatSync(fd, { bigint: true })
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) return 'unverified'
    const bytes = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < bytes.length) {
      const n = readSync(fd, bytes, offset, bytes.length - offset, offset)
      if (!n) return 'unverified'
      offset += n
    }
    const after = lstatSync(path, { bigint: true })
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.ctimeNs !== opened.ctimeNs ||
        (pid !== null && !bytes.equals(Buffer.from(String(pid) + '\n')))) return 'unverified'
    return isDeepStrictEqual(identity(after, bytes), expected) ? 'verified' : 'unverified'
  } finally { closeSync(fd) }
}

function fileFor(root, session, kind) {
  const state = join(realpathSync(root), '.SYSTEMX', 'state')
  if (realpathSync(state) !== state || !generation(session.sessionId)) fail('runtime-state-or-generation-unverified')
  if (kind === 'firebaseConfig') {
    const supplied = session.runtime?.firebaseConfig
    if (supplied === undefined && session.artifactReceipts?.firebaseConfig === undefined) return null
    const path = join(state, 'firebase-' + session.sessionId + '.json')
    if (typeof supplied !== 'string' || !isAbsolute(supplied) || resolve(supplied) !== supplied || join(realpathSync(dirname(supplied)), basename(supplied)) !== path) fail('runtime-config-generation-mismatch')
    return { path, pid: null }
  }
  const role = kind === 'lanPid' ? 'lan' : 'vite'
  if (session.mode === 'lan-only' || !Object.hasOwn(session.processes ?? {}, role)) return null
  const port = session.ports?.[role === 'vite' ? 'app' : 'lan']
  const pid = session.processes[role]
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isSafeInteger(pid) || pid < 1) fail('runtime-marker-record-unverified')
  return { path: join(state, 'local-' + role + '-' + port + '.pid'), pid }
}

function inspect(root, session, selection = kinds) {
  if (session.artifactReceipts && Object.keys(session.artifactReceipts).some(kind => !kinds.includes(kind))) fail('runtime-artifact-kind-unverified')
  return selection.map(kind => {
    if (kind !== 'firebaseConfig' && session.preservedPidMarkers?.includes(kind) && !session.artifactReceipts?.[kind]) return { kind, state: 'preserved' }
    const file = fileFor(root, session, kind)
    if (!file && session.artifactReceipts?.[kind] !== undefined) fail('runtime-artifact-target-unverified')
    return { kind, path: file?.path, state: file ? inspectFile(file.path, session.artifactReceipts?.[kind], file.pid) : 'absent' }
  })
}

export function inspectSessionArtifacts(root, session) {
  try { return inspect(root, session).map(({ kind, state }) => ({ kind, state })) }
  catch { return [{ kind: 'runtime', state: 'unverified' }] }
}

// Run under the caller's generation guard on recovery. Recheck all files
// before the first unlink, then verify each receipt again immediately at use.
// Missing already-removed artifacts make an interrupted cleanup retryable.
export function removeSessionArtifacts(root, session, { createdOnly = false, current = () => true } = {}) {
  const selection = createdOnly ? kinds.filter(kind => session.artifactReceipts?.[kind]) : kinds
  const all = inspect(root, session, selection)
  if (all.some(item => item.state === 'unverified')) fail('runtime-artifact-unverified')
  for (const { kind, state } of all) {
    if (state !== 'verified') continue
    const [fresh] = inspect(root, session, [kind])
    if (fresh.state === 'unverified') fail('runtime-artifact-changed')
    if (!current()) fail('session-record-changed')
    if (fresh.state === 'verified') unlinkSync(fresh.path)
  }
}
