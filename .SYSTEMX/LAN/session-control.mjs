import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { readSession, clearSession } from './Builder/runtime/port-utils.mjs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createSessionRestartPreview, executeSessionStopPlan, sessionRuntimeCleanupTarget } from './session-restart-preview.mjs'

const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(lanRoot, '..', '..')
const action = process.argv[2] ?? 'status'

function processCommand(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return ''
  try {
    return process.platform === 'win32'
      ? execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`], { encoding: 'utf8' }).trim()
      : execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
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
if (action === 'restart' || action === 'restart-preview') {
  const argumentsAfterAction = process.argv.slice(3)
  if ((action === 'restart' && (argumentsAfterAction.length !== 1 || argumentsAfterAction[0] !== '--preview')) ||
      (action === 'restart-preview' && argumentsAfterAction.length)) {
    console.error('Usage: node .SYSTEMX/LAN/session-control.mjs restart --preview')
    process.exit(2)
  }
  const preview = createSessionRestartPreview({ repoRoot, session })
  console.log(JSON.stringify(preview, null, 2))
  process.exit(preview.canRestart ? 0 : 1)
}

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
  console.error('Usage: node .SYSTEMX/LAN/session-control.mjs [status|stop|restart --preview|restart-preview]')
  process.exit(2)
}

const stop = executeSessionStopPlan({
  repoRoot, session,
  signalProcess: (pid, signal) => process.kill(pid, signal),
  cleanupSession() {
    if (JSON.stringify(readSession(repoRoot)) !== JSON.stringify(session)) throw new Error('Session changed during stop')
    const runtime = sessionRuntimeCleanupTarget(repoRoot, session)
    if (!runtime.allowed) throw new Error(runtime.reason)
    if (runtime.path && existsSync(runtime.path)) unlinkSync(runtime.path)
    if (!clearSession(repoRoot, session.sessionId)) throw new Error('Session was not cleared')
  },
})
if (!stop.canStop) {
  console.error(JSON.stringify({ ...stop, status: 'refused' }, null, 2))
  process.exit(1)
}
if (stop.cleanup) console.log('[SYSTEMX] Local exited session record cleared; unrelated projects were not touched.')
else {
  console.log(`[SYSTEMX] Requested owned ${stop.targets[0].role} process ${stop.targets[0].pid} to stop.`)
  console.log(stop.guidance ?? '[SYSTEMX] Its supervisor will clear the session state during shutdown.')
}
