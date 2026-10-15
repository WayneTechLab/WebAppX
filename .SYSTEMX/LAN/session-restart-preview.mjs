import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path'

const roles = ['session', 'firebase', 'lan', 'vite']
const pidIsValid = (pid) => Number.isSafeInteger(pid) && pid > 0
const portIsValid = (port) => Number.isInteger(port) && port >= 1024 && port <= 65535
const hashCommand = (command) => createHash('sha256').update(command).digest('hex')

function runReadOnly(executable, args) {
  return execFileSync(executable, args, {
    encoding: 'utf8', timeout: 3000, maxBuffer: 2 * 1024 * 1024,
    windowsHide: true, env: { ...process.env, LC_ALL: 'C' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

// These queries inspect OS metadata only. Never use a recorded PID as a signal
// target, open a probe listener, or return a raw command line in the preview.
export function inspectSessionProcess(pid, { platform = process.platform, run = runReadOnly } = {}) {
  if (!pidIsValid(pid)) return { pid: null, exists: null, issue: 'invalid-pid' }
  try {
    if (platform === 'win32') {
      const script = `$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction Stop; if ($null -eq $p) { 'null' } else { [pscustomobject]@{ pid=$p.ProcessId; parentPid=$p.ParentProcessId; startedAt=$p.CreationDate.ToUniversalTime().ToString('o'); command=$p.CommandLine } | ConvertTo-Json -Compress }`
      const processInfo = JSON.parse(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]))
      return processInfo ? { ...processInfo, exists: true, cwd: null } : { pid, exists: false }
    }
    const line = run('ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'lstart=', '-o', 'command='])
    const match = line.match(/^\s*(\d+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+([\s\S]+)$/)
    if (!match) return { pid, exists: line ? null : false, issue: 'process-metadata-unavailable' }
    let cwd = null
    try {
      cwd = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).split('\n').find((value) => value.startsWith('n'))?.slice(1) ?? null
    } catch { /* A missing CWD is reported as unverified, never guessed. */ }
    return { pid, exists: true, parentPid: Number(match[1]), startedAt: match[2], command: match[3], cwd }
  } catch (error) {
    if (platform !== 'win32' && error.status === 1 && !String(error.stdout ?? '').trim() && !String(error.stderr ?? '').trim()) return { pid, exists: false }
    return { pid, exists: null, issue: 'process-query-failed' }
  }
}

export function captureSessionProcessIdentity(pid, options = {}) {
  const observed = inspectSessionProcess(pid, options)
  if (!observed.exists || !observed.startedAt || !observed.command) return null
  const identity = { pid, parentPid: observed.parentPid, startedAt: observed.startedAt, commandHash: hashCommand(observed.command) }
  // Windows CIM has no CWD field. The launcher can record the CWD it supplied
  // to spawn (or its own actual CWD); a later preview also requires the exact
  // recorded process birth and command fingerprint before using this evidence.
  if (typeof options.workingDirectory === 'string' && options.workingDirectory) identity.workingDirectory = options.workingDirectory
  return identity
}

export function inspectSessionListeners({ platform = process.platform, run = runReadOnly } = {}) {
  try {
    if (platform === 'win32') {
      const script = '@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object LocalAddress, LocalPort, OwningProcess) | ConvertTo-Json -Compress'
      const result = JSON.parse(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]) || '[]')
      const items = Array.isArray(result) ? result : [result]
      return { complete: true, listeners: items.filter(Boolean).map((item) => ({ host: item.LocalAddress, port: item.LocalPort, pid: item.OwningProcess })) }
    }
    const result = run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'])
    let pid = null
    const listeners = []
    for (const line of result.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1))
      if (!line.startsWith('n')) continue
      const endpoint = line.slice(1).match(/^(.*):(\d+)$/)
      if (endpoint && pidIsValid(pid)) listeners.push({ host: endpoint[1], port: Number(endpoint[2]), pid })
    }
    return { complete: true, listeners }
  } catch (error) {
    if (platform !== 'win32' && error.status === 1 && !String(error.stdout ?? '').trim() && !String(error.stderr ?? '').trim()) {
      return { complete: true, listeners: [] }
    }
    return { complete: false, listeners: [], issue: 'listener-query-failed' }
  }
}

function canonicalPath(value, platform) {
  if (typeof value !== 'string' || !value) return null
  if (platform === 'win32') return win32.resolve(value).replaceAll('\\', '/').toLowerCase()
  try { return realpathSync(value) } catch { return resolve(value) }
}

function argumentPresent(command, value, platform) {
  if (typeof command !== 'string' || typeof value !== 'string' || !value) return false
  const normalize = (text) => platform === 'win32' ? text.replaceAll('\\', '/').toLowerCase() : text
  const escaped = normalize(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s"'])${escaped}(?=$|[\\s"'])`).test(normalize(command))
}

function nodeScriptArguments(command, platform) {
  if (typeof command !== 'string') return null
  const normalize = (value) => platform === 'win32' ? value.replaceAll('\\', '/').toLowerCase() : value
  const text = normalize(command)
  const executable = normalize(process.execPath)
  if (text.startsWith(`${executable} `)) return command.slice(process.execPath.length).trimStart()
  const launcher = command.match(/^(?:"[^"]*[\\/]node(?:\.exe)?"|'[^']*[\\/]node(?:\.exe)?'|(?:[^\s]*[\\/])?node(?:\.exe)?)\s+/i)
  return launcher ? command.slice(launcher[0].length) : null
}

function firstArgumentIs(command, value, platform) {
  if (typeof command !== 'string') return false
  const text = command.replace(/^["']/, '')
  const normalize = (entry) => platform === 'win32' ? entry.replaceAll('\\', '/').toLowerCase() : entry
  return normalize(text).startsWith(normalize(value)) && (text.length === value.length || /[\s"']/.test(text[value.length]))
}

function expectedCommand(role, observed, root, session, platform, startupCwdVerified = false) {
  const scripts = { session: '.SYSTEMX/LAN/dev-session.mjs', lan: '.SYSTEMX/LAN/server.mjs', vite: 'node_modules/vite/bin/vite.js' }
  if (scripts[role]) {
    const scriptArguments = nodeScriptArguments(observed.command, platform)
    if (!scriptArguments) return false
    if (firstArgumentIs(scriptArguments, `${root}/${scripts[role]}`, platform) ||
      ((canonicalPath(observed.cwd, platform) === root || startupCwdVerified) && firstArgumentIs(scriptArguments, scripts[role], platform))) return true
    // ps can preserve a symlink spelling (/var versus /private/var) while lsof
    // reports the canonical CWD. Resolve candidate script paths, including
    // paths containing spaces, before treating that difference as a mismatch.
    if (platform !== 'win32' && typeof observed.command === 'string') {
      const command = scriptArguments.replace(/^["']/, '')
      const suffix = `/${scripts[role]}`
      let end = command.indexOf(suffix)
      while (end !== -1) {
        end += suffix.length
        if (end === command.length || /[\s"']/.test(command[end])) {
          if (command.startsWith('/') && canonicalPath(command.slice(0, end), platform) === `${root}/${scripts[role]}`) return true
        }
        end = command.indexOf(suffix, end)
      }
    }
    return false
  }
  const config = session.runtime?.firebaseConfig
  const paths = platform === 'win32' ? win32 : { basename, isAbsolute, relative, resolve }
  if (typeof config !== 'string' || !paths.isAbsolute(config)) return false
  const runtimeRoot = paths.resolve(root, '.SYSTEMX', 'state')
  const configRelative = paths.relative(runtimeRoot, paths.resolve(config))
  if (configRelative.startsWith('..') || paths.isAbsolute(configRelative) || !paths.basename(config).startsWith('firebase-')) return false
  return argumentPresent(observed.command, 'emulators:start', platform) && argumentPresent(observed.command, config, platform)
}

function inspectSessionOwnership({ repoRoot, session, inspectProcess, platform, complete = false, allowLanOnly = false }) {
  const result = { processes: [], reasons: [] }
  const root = canonicalPath(repoRoot, platform)
  const cache = new Map()
  const inspect = (pid) => {
    if (!cache.has(pid)) {
      try { cache.set(pid, inspectProcess(pid) ?? { pid, exists: null }) } catch { cache.set(pid, { pid, exists: null, issue: 'process-query-failed' }) }
    }
    return cache.get(pid)
  }
  const ownerPid = session.ownerPid
  const recorded = session.processes ?? {}
  const standalone = allowLanOnly && session.mode === 'lan-only'
  const ownerRole = standalone ? 'lan' : 'session'
  const seenPids = new Set()
  for (const role of complete ? roles : roles.filter((role) => Object.hasOwn(recorded, role))) {
    const pid = recorded[role]
    const entry = { role, pid: pidIsValid(pid) ? pid : null, state: 'unverified', reasons: [] }
    result.processes.push(entry)
    if (!pidIsValid(pid) || seenPids.has(pid)) { entry.reasons.push('invalid-or-duplicate-recorded-pid'); continue }
    seenPids.add(pid)
    const observed = inspect(pid)
    if (observed.exists === false) { entry.state = 'exited'; continue }
    if (observed.exists !== true) { entry.reasons.push('process-query-unavailable'); continue }
    entry.parentPid = pidIsValid(observed.parentPid) ? observed.parentPid : null
    const identity = session.processIdentities?.[role]
    const fingerprintMatches = Boolean(identity && identity.pid === pid && identity.parentPid === observed.parentPid && identity.startedAt === observed.startedAt && identity.commandHash === hashCommand(observed.command ?? ''))
    entry.identity = identity ? (fingerprintMatches ? 'recorded-start-parent-and-command-match' : 'recorded-identity-mismatch') : 'legacy-no-start-fingerprint'
    if (identity && !fingerprintMatches) entry.reasons.push('recorded-identity-mismatch')
    const cwdMatches = canonicalPath(observed.cwd, platform) === root
    const startupCwdVerified = platform === 'win32' && !observed.cwd && fingerprintMatches && canonicalPath(identity?.workingDirectory, platform) === root
    entry.workingDirectory = cwdMatches ? 'repository' : startupCwdVerified ? 'recorded-startup-repository' : observed.cwd ? 'different' : 'unavailable'
    if (!cwdMatches && !(platform === 'win32' && fingerprintMatches)) entry.reasons.push('repository-working-directory-unverified')
    if (!expectedCommand(role, observed, root, session, platform, startupCwdVerified)) entry.reasons.push('expected-launcher-unverified')
    if (role === ownerRole ? pid !== ownerPid : standalone || observed.parentPid !== ownerPid) entry.reasons.push('supervisor-relationship-unverified')
    if (!entry.reasons.length) entry.state = 'owned'
  }
  const owner = result.processes.find((entry) => entry.role === ownerRole)
  if (owner?.state !== 'owned') result.reasons.push('supervisor-ownership-unverified')
  for (const entry of result.processes) {
    if (entry.state === 'unverified') result.reasons.push(`${entry.role}-ownership-unverified`)
    if (entry.role !== ownerRole && owner?.state !== 'owned' && entry.state === 'owned') {
      entry.state = 'unverified'
      entry.reasons.push('supervisor-ownership-unverified')
    }
  }
  if (Object.keys(recorded).some((role) => !roles.includes(role))) result.reasons.push('unrecognized-recorded-process-role')
  if (standalone && Object.keys(recorded).some((role) => role !== 'lan')) result.reasons.push('unexpected-standalone-process-role')
  return { ...result, inspect }
}

export function createSessionStopPlan({ repoRoot, session, inspectProcess = inspectSessionProcess, platform = process.platform }) {
  const plan = { action: 'stop', canStop: false, processes: [], targets: [], cleanup: false, reasons: [] }
  if (!session || typeof session !== 'object' || Array.isArray(session)) return { ...plan, reasons: ['no-owned-session-record'] }
  const ownership = inspectSessionOwnership({ repoRoot, session, inspectProcess, platform, allowLanOnly: true })
  plan.processes = ownership.processes
  if (platform === 'win32' && session.mode !== 'lan-only') {
    return {
      ...plan, reasons: ['windows-combined-stop-requires-owning-terminal'],
      guidance: 'Press Ctrl+C in the terminal that owns this supervised session so its supervisor can close the child processes. Inspect child processes and listeners after shutdown. This command preserves the record and configuration because Windows forced termination cannot establish descendant cleanup; inspect any remaining state before operator recovery.',
    }
  }
  const ownerRole = session.mode === 'lan-only' ? 'lan' : 'session'
  const owner = ownership.processes.find(({ role }) => role === ownerRole)
  const unverified = ownership.processes.some(({ state }) => state === 'unverified')
  const allExited = ownership.processes.length > 0 && ownership.processes.every(({ state }) => state === 'exited')
  const invalidShape = !owner || owner.pid !== session.ownerPid || ownership.reasons.some((reason) => ['unrecognized-recorded-process-role', 'unexpected-standalone-process-role'].includes(reason))
  if (unverified || invalidShape || !ownership.processes.length) {
    plan.reasons = ownership.reasons.length ? [...new Set(ownership.reasons)] : ['session-processes-unverified']
    return plan
  }
  if (allExited) return { ...plan, canStop: true, cleanup: true }
  if (owner?.state !== 'owned') return { ...plan, reasons: ['supervisor-ownership-unverified'] }
  return {
    ...plan, canStop: true, targets: [{ role: ownerRole, pid: owner.pid }],
    ...(platform === 'win32' ? { guidance: 'Windows termination may bypass the standalone LAN cleanup handler. Wait for its process to exit, then rerun stop to clear the verified exited record.' } : {}),
  }
}

export function executeSessionStopPlan({ repoRoot, session, inspectProcess = inspectSessionProcess, platform = process.platform, signalProcess, cleanupSession }) {
  const plan = createSessionStopPlan({ repoRoot, session, inspectProcess, platform })
  if (!plan.canStop) return plan
  // Signal the verified supervisor once so its own lifecycle closes children.
  // Existing state is retained until the owner cleans up or a later read proves
  // that every recorded process has exited. A failed signal never clears state.
  try {
    for (const target of plan.targets) signalProcess(target.pid, 'SIGTERM')
    if (plan.cleanup) cleanupSession()
    return { ...plan, status: plan.cleanup ? 'cleared-exited-session' : 'stop-requested' }
  } catch {
    return { ...plan, canStop: false, status: 'refused', reasons: ['stop-request-or-cleanup-failed'] }
  }
}

export function sessionRuntimeCleanupTarget(repoRoot, session) {
  const config = session.runtime?.firebaseConfig
  if (config == null) return { allowed: true, path: null }
  if (typeof config !== 'string' || !isAbsolute(config)) return { allowed: false, reason: 'runtime-config-path-invalid' }
  try {
    const root = realpathSync(repoRoot)
    const runtimeRoot = resolve(root, '.SYSTEMX', 'state')
    // Resolve both the state directory and the config's parent before deleting
    // anything. A lexical path inside state can traverse a symlink elsewhere.
    if (realpathSync(runtimeRoot) !== runtimeRoot) return { allowed: false, reason: 'runtime-state-directory-escaped' }
    const configParent = realpathSync(dirname(config))
    const withinRuntime = (path) => path === runtimeRoot || path.startsWith(`${runtimeRoot}${sep}`)
    if (!withinRuntime(configParent) || !basename(config).startsWith('firebase-')) return { allowed: false, reason: 'runtime-config-path-escaped' }
    if (!existsSync(config)) return { allowed: true, path: null }
    if (!withinRuntime(realpathSync(config))) return { allowed: false, reason: 'runtime-config-target-escaped' }
    return { allowed: true, path: resolve(config) }
  } catch {
    return { allowed: false, reason: 'runtime-config-path-unverified' }
  }
}

export function createSessionRestartPreview({ repoRoot, session, inspectProcess = inspectSessionProcess, inspectListeners = inspectSessionListeners, platform = process.platform }) {
  const result = {
    action: 'restart-preview', readOnly: true, status: 'refused', canRestart: false,
    processes: [], replacementListeners: [], reasons: [],
    note: 'Snapshot only. No processes, listeners, session records, tokens, or runtime configuration were changed. Recheck ownership and listener availability immediately before a restart.',
  }
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    result.reasons.push('no-owned-session-record')
    return result
  }
  const ownership = inspectSessionOwnership({ repoRoot, session, inspectProcess, platform, complete: true })
  result.processes = ownership.processes
  result.reasons = ownership.reasons
  const inspect = ownership.inspect

  const originHost = session.origin?.host ?? session.host ?? (() => { try { return new URL(session.urls?.app).hostname } catch { return null } })()
  const host = ['127.0.0.1', 'localhost'].includes(originHost) ? originHost : null
  const portEntries = [
    ['app', host, session.ports?.app], ['lan', '127.0.0.1', session.ports?.lan],
    ['auth', '127.0.0.1', session.ports?.firebase?.auth], ['firestore', '127.0.0.1', session.ports?.firebase?.firestore], ['storage', '127.0.0.1', session.ports?.firebase?.storage],
  ]
  if (!host) result.reasons.push('recorded-loopback-host-invalid')
  const ports = portEntries.map(([, , port]) => port)
  if (ports.some((port) => !portIsValid(port)) || new Set(ports).size !== ports.length) result.reasons.push('recorded-ports-invalid-or-overlapping')
  let snapshot
  try { snapshot = inspectListeners() } catch { snapshot = { complete: false, listeners: [] } }
  if (!snapshot?.complete || !Array.isArray(snapshot.listeners)) result.reasons.push('listener-snapshot-unavailable')
  if (!snapshot || !Array.isArray(snapshot.listeners)) snapshot = { complete: false, listeners: [] }

  function listenerOwner(pid) {
    let current = pid
    const visited = new Set()
    for (let depth = 0; depth < 16 && pidIsValid(current) && !visited.has(current); depth += 1) {
      const owned = result.processes.find((entry) => entry.pid === current && entry.state === 'owned')
      if (owned) return { role: owned.role, relationship: current === pid ? 'recorded-process' : 'descendant', recordedPid: owned.pid }
      visited.add(current)
      const observed = inspect(current)
      if (observed.exists !== true) break
      current = observed.parentPid
    }
    return null
  }
  for (const [component, bindHost, port] of portEntries) {
    const current = (snapshot?.listeners ?? []).filter((entry) => entry.port === port).map((entry) => {
      const ownership = listenerOwner(entry.pid)
      // Listener addresses are OS metadata; restrict them to address syntax so
      // an injected record or command output cannot become a secret echo.
      const address = typeof entry.host === 'string' && /^[\da-fA-F:.\[\]*%a-zA-Z-]+$/.test(entry.host) ? entry.host : 'unavailable'
      return { pid: pidIsValid(entry.pid) ? entry.pid : null, address, ownership: ownership ?? { role: 'unverified' } }
    })
    const valid = bindHost && portIsValid(port)
    const state = !valid || !snapshot?.complete ? 'unverified' : current.some((entry) => entry.ownership.role === 'unverified') ? 'blocked' : current.length ? 'release-required' : 'available'
    result.replacementListeners.push({ component, host: bindHost, port: portIsValid(port) ? port : null, state, current })
    if (state === 'blocked') result.reasons.push(`${component}-listener-owned-by-unverified-process`)
  }
  if (host && portIsValid(session.ports?.app)) {
    result.proposedLaunch = {
      executable: process.execPath,
      args: ['.SYSTEMX/LAN/dev-session.mjs', '--fixed-origin', '--host', host, '--port', String(session.ports.app)],
      environment: Object.fromEntries([
        ['SYSTEMX_LAN_PORT', session.ports?.lan], ['SYSTEMX_FIREBASE_AUTH_PORT', session.ports?.firebase?.auth],
        ['SYSTEMX_FIREBASE_FIRESTORE_PORT', session.ports?.firebase?.firestore], ['SYSTEMX_FIREBASE_STORAGE_PORT', session.ports?.firebase?.storage],
      ].filter(([, port]) => portIsValid(port)).map(([key, port]) => [key, String(port)])),
    }
  }
  result.reasons = [...new Set(result.reasons)]
  result.canRestart = !result.reasons.length
  result.status = result.canRestart ? 'ready-for-review' : 'refused'
  return result
}
