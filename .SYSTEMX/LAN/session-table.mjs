import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { sessionPath } from './Builder/runtime/port-utils.mjs'
import { createSessionStopPlan, inspectSessionListeners, inspectSessionProcess } from './session-restart-preview.mjs'
import { validSessionGeneration } from './session-supervisor.mjs'

const maxWorkspaces = 12
const maxRecordBytes = 1_000_000
const maxListeners = 8192
const usage = 'Usage: node .SYSTEMX/LAN/session-control.mjs sessions [--workspace DIRECTORY ...] (up to 12 distinct workspaces including the current workspace).'
const validSelector = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !value.startsWith('--') && !value.includes('\0')
const validPid = value => Number.isSafeInteger(value) && value > 0
const isFingerprintVerified = entry => entry?.state === 'owned' && entry.identity === 'recorded-start-parent-and-command-match'

export function parseSessionTableArgs(args) {
  if (!Array.isArray(args) || args.length % 2 || args.length > (maxWorkspaces - 1) * 2) throw new Error(usage)
  const workspaces = []
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] !== '--workspace' || !validSelector(args[i + 1])) throw new Error(usage)
    workspaces.push(args[i + 1])
  }
  return workspaces
}

function selectedRoot(path) {
  try {
    const root = realpathSync(path)
    if (statSync(root).isDirectory() && lstatSync(join(root, '.SYSTEMX')).isDirectory()) return root
  } catch { /* Keep requested filesystem paths out of diagnostics. */ }
  throw new Error('Choose an existing workspace directory containing a local .SYSTEMX directory.')
}

function emptyRow(root) {
  return { workspaceId: createHash('sha256').update('systemx-workspace\0' + root).digest('hex'),
    generation: null, ownership: 'unverified', ownerPid: null, recordedOrigin: null, activeOrigin: null,
    listener: { state: 'unverified', pid: null }, reasons: [] }
}

function sameFile(left, right) {
  return right?.isFile() && left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs
}

// Read a single bounded record in the selected workspace. An atomic replacement
// during process/listener inspection invalidates this observation.
function snapshotRecord(root) {
  const target = sessionPath(root)
  const dir = dirname(target)
  const state = lstatSync(dir, { throwIfNoEntry: false })
  if (!state) return { absent: true }
  if (!state.isDirectory() || realpathSync(dir) !== dir) throw new Error()
  if (lstatSync(target + '.lock', { throwIfNoEntry: false })) throw new Error()
  const identity = lstatSync(target, { bigint: true, throwIfNoEntry: false })
  if (!identity) return { absent: true }
  if (!identity.isFile() || identity.size < 1n || identity.size > BigInt(maxRecordBytes)) throw new Error()
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

function loopbackOrigin(record, portRole) {
  const value = record.origin?.url ?? record.urls?.[portRole]
  if (typeof value !== 'string') return null
  const match = /^http:\/\/(127\.0\.0\.1|localhost):([1-9]\d{3,4})\/?$/.exec(value)
  if (!match) return null
  const [, host, digits] = match
  const port = Number(digits)
  if (port < 1024 || port > 65535 || record.ports?.[portRole] !== port ||
      (record.origin?.port !== undefined && record.origin.port !== port) ||
      (record.origin?.scheme !== undefined && record.origin.scheme !== 'http') ||
      (record.origin?.host !== undefined && record.origin.host !== host) ||
      (record.host !== undefined && record.host !== host)) return null
  const url = 'http://' + host + ':' + port
  if (record.urls?.[portRole] !== undefined && ![url, url + '/'].includes(record.urls[portRole])) return null
  return { url, host, port }
}

function listenerAt(snapshot, origin, processEntry) {
  if (snapshot?.complete !== true || !Array.isArray(snapshot.listeners) || snapshot.listeners.length > maxListeners ||
      !snapshot.listeners.every(item => Number.isInteger(item?.port) && item.port > 0 && item.port <= 65535)) {
    return { state: 'unverified', pid: null }
  }
  const matches = snapshot.listeners.filter(item => item.port === origin.port)
  if (!matches.length) return { state: 'absent', pid: null }
  const pids = new Set(matches.map(item => item.pid))
  const hosts = origin.host === 'localhost' ? ['127.0.0.1', '::1', '[::1]'] : ['127.0.0.1']
  if (pids.size !== 1 || !matches.every(item => validPid(item.pid) && hosts.includes(item.host)) ||
      !isFingerprintVerified(processEntry)) return { state: 'unverified', pid: null }
  if (matches[0].pid !== processEntry.pid) return { state: 'unrelated', pid: null }
  return { state: 'owned', pid: processEntry.pid }
}

function observe(root, { platform, inspectProcess, inspectListeners, summarizeRecord }) {
  const row = emptyRow(root)
  try {
    const snapshot = snapshotRecord(root)
    if (snapshot.absent) return { ...row, ownership: 'absent', reasons: ['no-session-record'] }
    const record = snapshot.record
    if (!record || !['combined', 'lan-only'].includes(record.mode)) return { ...row, reasons: ['session-identity-unverified'] }
    const standalone = record.mode === 'lan-only'
    const ownerRole = standalone ? 'lan' : 'session'
    const origin = loopbackOrigin(record, standalone ? 'lan' : 'app')
    row.recordedOrigin = origin?.url ?? null
    const roles = Object.keys(record.processes ?? {})
    const pids = Object.values(record.processes ?? {})
    const allowedRoles = standalone ? ['lan'] : ['session', 'vite', 'firebase', 'lan']
    if (!validSessionGeneration(record.sessionId) || !validPid(record.ownerPid) ||
        record.workspaceId !== undefined && record.workspaceId !== row.workspaceId ||
        record.processes?.[ownerRole] !== record.ownerPid || !roles.every(role => allowedRoles.includes(role)) ||
        !pids.every(validPid) || new Set(pids).size !== pids.length) return { ...row, reasons: ['session-identity-unverified'] }
    row.generation = record.sessionId
    const inspect = pid => {
      const observation = inspectProcess(pid, { platform })
      if (observation?.pid !== pid || observation.exists === true &&
          (!validPid(observation.parentPid) || !observation.startedAt || typeof observation.command !== 'string' || !observation.command)) return { pid, exists: null }
      if (pid === record.ownerPid && !standalone && observation.exists === true) {
        const flags = [...String(observation.command).matchAll(/(?:^|\s)--generation\s+(\S+)/g)]
        if (flags.length && (flags.length !== 1 || flags[0][1] !== row.generation)) return { pid, exists: null }
      }
      return observation
    }
    const plan = createSessionStopPlan({ repoRoot: root, session: record, inspectProcess: inspect, platform })
    const owner = plan.processes.find(item => item.role === ownerRole)
    const entry = plan.processes.find(item => item.role === (standalone ? 'lan' : 'vite'))
    if (isFingerprintVerified(owner) && owner.pid === record.ownerPid) {
      row.ownership = 'owned'
      row.ownerPid = owner.pid
    } else if (plan.cleanup) row.ownership = 'exited'
    else row.reasons.push('recorded-owner-unverified')
    if (!origin) row.reasons.push('recorded-loopback-origin-unverified')
    else if (row.ownership === 'owned') {
      let listeners
      try { listeners = inspectListeners() } catch { /* Ownership of the process remains independently reportable. */ }
      row.listener = listenerAt(listeners, origin, entry)
      if (row.listener.state === 'owned') row.activeOrigin = origin.url
      else row.reasons.push('origin-listener-' + row.listener.state)
    }
    if (!snapshot.current()) return { ...emptyRow(root), reasons: ['session-record-changed'] }
    // A local exporter can project fixed diagnostic fields from this same verified
    // observation. Ordinary table rows retain their original public shape.
    if (summarizeRecord) row.details = summarizeRecord(record, plan)
    return row
  } catch { return { ...emptyRow(root), reasons: ['session-observation-unavailable'] } }
}

export function inspectWorkspaceSession(repoRoot, {
  inspectProcess = inspectSessionProcess, inspectListeners = inspectSessionListeners, platform = process.platform, summarizeRecord,
} = {}) {
  return observe(selectedRoot(repoRoot), { platform, inspectProcess, summarizeRecord, inspectListeners: () => inspectListeners({ platform }) })
}

/** Inspect only the selected roots. A listener observation is shared for
 * consistency; process identity and ownership are verified against each record. */
export function createSessionTable({ repoRoot, workspaces = [], inspectProcess = inspectSessionProcess,
  inspectListeners = inspectSessionListeners, platform = process.platform }) {
  if (!Array.isArray(workspaces) || workspaces.length >= maxWorkspaces || !workspaces.every(validSelector)) throw new Error(usage)
  const roots = [repoRoot, ...workspaces].map(selectedRoot)
  const identities = roots.map(root => {
    try {
      const entry = statSync(root, { bigint: true })
      if (entry.ino) return entry.dev + ':' + entry.ino
      return process.platform === 'win32' ? root.toLowerCase() : root
    } catch { throw new Error('A selected workspace changed. Check its directory and inspect again.') }
  })
  if (new Set(identities).size !== roots.length) throw new Error('Select each workspace once. The current workspace is included automatically.')
  let observed = false
  let listeners
  function sharedListeners() {
    if (!observed) {
      observed = true
      try { listeners = inspectListeners({ platform }) } catch { listeners = null }
    }
    return listeners
  }
  return { action: 'sessions', readOnly: true, sessions: roots.map((root, index) => ({
    selection: index === 0 ? 'current' : 'selected', position: index + 1,
    ...observe(root, { platform, inspectProcess, inspectListeners: sharedListeners }),
  })) }
}
