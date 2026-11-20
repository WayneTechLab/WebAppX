import { existsSync, unlinkSync } from 'node:fs'
import { readSession, clearExitedSession } from './Builder/runtime/port-utils.mjs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createSessionRestartPreview, createSessionStopPlan, executeSessionStopPlan, sessionRuntimeCleanupTarget } from './session-restart-preview.mjs'

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

if (action === 'start') {
  const [preview, ...args] = process.argv.slice(3)
  if (preview !== '--preview') {
    await writeAndExit(process.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs start --preview [session options]\n', 2)
  }
  const { parseSessionOptions } = await import('./session-supervisor.mjs')
  const { createSessionStartPreview } = await import('./session-start-preview.mjs')
  let options
  try { options = parseSessionOptions(args, process.env) } catch (error) {
    await writeAndExit(process.stderr, error.message + '\n', 2)
  }
  if (options.help) await writeAndExit(process.stdout, 'Usage: node .SYSTEMX/LAN/session-control.mjs start --preview [--port PORT] [--host HOST] [--fixed-origin] [--generation ID] [--emulator-import DIRECTORY]\n', 0)
  const result = await createSessionStartPreview({ repoRoot, options })
  await writeJsonAndExit(result, result.canStart ? 0 : 1)
}

if (action === '--help' || action === '-h' || action === 'sessions' && process.argv.length === 4 && ['--help', '-h'].includes(process.argv[3])) {
  await writeAndExit(process.stdout, 'Usage: node .SYSTEMX/LAN/session-control.mjs [status|stop|start --preview|restart --preview|sessions [--workspace DIRECTORY ...]]\nThe sessions table includes the current workspace and up to 11 selected project directories. Recorded and verified active origins are shown separately.\n', 0)
}

if (action === 'sessions') {
  const { createSessionTable, parseSessionTableArgs } = await import('./session-table.mjs')
  let table
  try { table = createSessionTable({ repoRoot, workspaces: parseSessionTableArgs(process.argv.slice(3)) }) }
  catch { await writeAndExit(process.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs sessions [--workspace DIRECTORY ...] (up to 12 workspaces). Choose existing project directories.\n', 2) }
  await writeJsonAndExit(table, 0)
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
  const plan = createSessionStopPlan({ repoRoot, session })
  const inspected = new Map(plan.processes.map(entry => [entry.role, entry]))
  const processes = Object.fromEntries(Object.entries(session.processes ?? {}).map(([role, pid]) => {
    const entry = inspected.get(role)
    return [role, { pid, alive: entry?.alive ?? null, belongsToRepo: entry?.state === 'owned',
      ownership: entry?.state ?? 'unverified', identity: entry?.identity ?? null,
      reasons: entry?.reasons ?? ['unrecognized-recorded-process-role'] }]
  }))
  await writeJsonAndExit({ ...session, status: 'recorded', processes,
    ...(plan.termination === 'owning-terminal' ? { termination: plan.termination, guidance: plan.guidance } : {}) }, 0)
}

if (action !== 'stop') {
  await writeAndExit(process.stderr, 'Usage: node .SYSTEMX/LAN/session-control.mjs [status|sessions [--workspace DIRECTORY ...]|stop|start --preview|restart --preview|restart-preview]\n', 2)
}

const stop = executeSessionStopPlan({
  repoRoot, session,
  signalProcess: (pid, signal) => process.kill(pid, signal),
  cleanupSession() {
    const cleared = clearExitedSession(repoRoot, session, () => {
      if (!createSessionStopPlan({ repoRoot, session }).cleanup) throw new Error('Session processes changed during cleanup')
      const runtime = sessionRuntimeCleanupTarget(repoRoot, session)
      if (!runtime.allowed) throw new Error(runtime.reason)
      if (runtime.path && existsSync(runtime.path)) unlinkSync(runtime.path)
    })
    if (!cleared) throw new Error('Session changed during cleanup')
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
