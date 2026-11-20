import { lstatSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readSession, sessionPath } from './Builder/runtime/port-utils.mjs'
import { createSessionStopPlan } from './session-restart-preview.mjs'

function loopbackOrigin(session) {
  const value = session.origin?.url ?? session.urls?.app
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) &&
        Number(url.port) >= 1024 && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin
  } catch { /* A legacy session can lack a verified origin. */ }
  return null
}

// Read-only: report the supervisor's identity separately from service readiness.
export function readSessionClaim(repoRoot, { inspectProcess, platform = process.platform } = {}) {
  const observation = { status: 'unverified', sessionId: null, ownerPid: null, origin: null, reasons: [] }
  const target = sessionPath(repoRoot)
  try {
    const system = join(repoRoot, '.SYSTEMX')
    for (const path of [system, dirname(target)]) {
      const entry = lstatSync(path, { throwIfNoEntry: false })
      if (!entry) return { ...observation, status: 'absent' }
      if (!entry.isDirectory()) return { ...observation, reasons: ['session-record-unverified'] }
    }
    const entry = lstatSync(target, { throwIfNoEntry: false })
    if (!entry) {
      if (lstatSync(target + '.lock', { throwIfNoEntry: false })) return { ...observation, reasons: ['session-update-in-progress-or-interrupted'] }
      return { ...observation, status: 'absent' }
    }
    if (!entry.isFile() || entry.size > 1_000_000 ||
        realpathSync(dirname(target)) !== join(realpathSync(repoRoot), '.SYSTEMX', 'state')) {
      return { ...observation, reasons: ['session-record-unverified'] }
    }
    const session = readSession(repoRoot)
    if (!session || typeof session.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(session.sessionId) ||
        !Number.isSafeInteger(session.ownerPid) || session.ownerPid <= 0) return { ...observation, reasons: ['session-record-unverified'] }
    observation.sessionId = session.sessionId
    observation.ownerPid = session.ownerPid
    observation.origin = loopbackOrigin(session)
    const plan = createSessionStopPlan({ repoRoot, session, platform, inspectProcess })
    const owner = plan.processes.find(item => item.role === (session.mode === 'lan-only' ? 'lan' : 'session'))
    if (owner?.state === 'owned' && owner.pid === session.ownerPid &&
        owner.identity === 'recorded-start-parent-and-command-match') return { ...observation, status: 'owned' }
    if (plan.cleanup) return { ...observation, status: 'exited' }
    return { ...observation, reasons: plan.reasons.length ? plan.reasons : ['supervisor-identity-unverified'] }
  } catch { return { ...observation, reasons: ['session-record-unavailable'] } }
}

export function sessionClaimError(claim) {
  const details = [claim.sessionId && `generation ${claim.sessionId}`, claim.ownerPid && `PID ${claim.ownerPid}`, claim.origin && `recorded origin ${claim.origin}`].filter(Boolean).join(', ')
  const guidance = claim.status === 'exited'
    ? 'Use session-control.mjs stop to clear the verified exited session, then request a fresh start preview.'
    : 'Inspect session status and obtain a fresh start preview before another launch.'
  const message = `An existing local session record may have live recorded processes (${claim.status}${details ? ', ' + details : ''}). ${guidance}`
  return Object.assign(new Error(message), { code: 'SESSION_CLAIM_UNAVAILABLE', claim })
}
