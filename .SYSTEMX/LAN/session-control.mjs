import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { readSession, clearSession } from './Builder/runtime/port-utils.mjs'
import { fileURLToPath } from 'node:url'
import { basename, resolve, sep } from 'node:path'

const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(lanRoot, '..', '..')
const action = process.argv[2] ?? 'status'

function processCommand(pid) {
  try {
    return process.platform === 'win32'
      ? execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`], { encoding: 'utf8' }).trim()
      : execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function belongsToRepository(pid, name, session) {
  const command = processCommand(pid)

  if (command.includes(repoRoot)) {
    return true
  }

  // macOS may expose the supervisor's relative npm command without its
  // working directory. The recorded owner PID plus the canonical launcher
  // name is sufficient for status reporting; stop still skips this process.
  return name === 'session' &&
    pid === session.ownerPid &&
    command.includes('dev-session.mjs')
}

const session = readSession(repoRoot)
if (!session) {
  console.log(JSON.stringify({ status: 'offline', reason: 'no-owned-session-record' }, null, 2))
  process.exit(0)
}

if (action === 'status') {
  const processes = Object.fromEntries(
    Object.entries(session.processes ?? {}).map(([name, pid]) => [name, {
      pid,
      alive: alive(pid),
      belongsToRepo: belongsToRepository(pid, name, session),
    }]),
  )
  console.log(JSON.stringify({ ...session, status: 'recorded', processes }, null, 2))
  process.exit(0)
}

if (action !== 'stop') {
  console.error('Usage: node .SYSTEMX/LAN/session-control.mjs [status|stop]')
  process.exit(2)
}

for (const [name, pid] of Object.entries(session.processes ?? {})) {
  if (name === 'session' || !alive(pid)) continue
  if (!processCommand(pid).includes(repoRoot)) {
    console.warn(`[SYSTEMX] Refusing to stop unverified process ${pid} (${name})`)
    continue
  }
  process.kill(pid, 'SIGTERM')
  console.log(`[SYSTEMX] Stopped owned ${name} process ${pid}`)
}

const runtimeConfig = session.runtime?.firebaseConfig
const runtimeRoot = resolve(repoRoot, '.SYSTEMX', 'state')
if (typeof runtimeConfig === 'string') {
  const runtimePath = resolve(runtimeConfig)
  if (
    runtimePath.startsWith(`${runtimeRoot}${sep}`) &&
    basename(runtimePath).startsWith('firebase-') &&
    existsSync(runtimePath)
  ) unlinkSync(runtimePath)
}

clearSession(repoRoot, session.sessionId)
console.log('[SYSTEMX] Local session record cleared; unrelated projects were not touched.')
