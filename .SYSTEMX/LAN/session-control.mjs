import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { readSession, clearSession } from './Builder/runtime/port-utils.mjs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createSessionRestartPreview, executeSessionStopPlan, sessionRuntimeCleanupTarget } from './session-restart-preview.mjs'

const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(lanRoot, '..', '..')
const action = process.argv[2] ?? 'status'

async function writeAndExit(stream, text, exitCode) {
  // Pipe writes can be asynchronous, including when write() signals pressure.
  // Its callback runs after the complete chunk has been handled; exiting before
  // then can truncate even a successful JSON response.
  await new Promise((resolveWrite, rejectWrite) => {
    const onError = (error) => rejectWrite(error)
    stream.once('error', onError)
    stream.write(text, (error) => {
      if (error) rejectWrite(error)
      else {
        stream.removeListener('error', onError)
        resolveWrite()
      }
    })
  })
  process.exit(exitCode)
}

async function writeJsonAndExit(value, exitCode, stream = process.stdout) {
  await writeAndExit(stream, `${JSON.stringify(value, null, 2)}\n`, exitCode)
}

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
    await writeAndExit(process.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs restart --preview\n', 2)
  }
  const preview = createSessionRestartPreview({ repoRoot, session })
  await writeJsonAndExit(preview, preview.canRestart ? 0 : 1)
}

if (!session) {
  await writeJsonAndExit({ status: 'offline', reason: 'no-owned-session-record' }, 0)
}

if (action === 'status') {
  const processes = Object.fromEntries(
    Object.entries(session.processes ?? {}).map(([name, pid]) => [name, {
      pid,
      alive: alive(pid),
      belongsToRepo: belongsToRepository(pid, name, session),
    }]),
  )
  await writeJsonAndExit({ ...session, status: 'recorded', processes }, 0)
}

if (action !== 'stop') {
  await writeAndExit(process.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs [status|stop|restart --preview|restart-preview]\n', 2)
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
  await writeJsonAndExit({ ...stop, status: 'refused' }, 1, process.stderr)
}
if (stop.cleanup) console.log('[SYSTEMX] Local exited session record cleared; unrelated projects were not touched.')
else {
  console.log(`[SYSTEMX] Requested owned ${stop.targets[0].role} process ${stop.targets[0].pid} to stop.`)
  console.log(stop.guidance ?? '[SYSTEMX] Its supervisor will clear the session state during shutdown.')
}
