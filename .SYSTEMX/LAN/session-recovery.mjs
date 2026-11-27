import { realpathSync } from 'node:fs'
import { clearExitedSession } from './Builder/runtime/port-utils.mjs'
import { inspectSessionArtifacts, removeSessionArtifacts, sessionWorkspaceId } from './Builder/runtime/session-artifacts.mjs'
import { createSessionStopPlan, inspectSessionListeners, inspectSessionProcess } from './session-restart-preview.mjs'

const validPid = pid => Number.isSafeInteger(pid) && pid > 0
const validGeneration = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)

function workspaceMatches(root, record) {
  if (record.workspaceId !== undefined) return record.workspaceId === sessionWorkspaceId(root)
  const role = record.mode === 'lan-only' ? 'lan' : 'session'
  const birth = record.processIdentities?.[role]
  try { return birth?.pid === record.ownerPid && realpathSync(birth.workingDirectory) === realpathSync(root) }
  catch { return false }
}

function sessionPorts(session) {
  if (session.mode === 'lan-only') return new Map([['lan', session.ports?.lan]])
  return new Map([['app', session.ports?.app], ['lan', session.ports?.lan], ['auth', session.ports?.firebase?.auth],
    ['firestore', session.ports?.firebase?.firestore], ['storage', session.ports?.firebase?.storage]])
}

export function createSessionRecoveryPlan({ repoRoot, session, platform = process.platform, inspectProcess = inspectSessionProcess, inspectListeners = inspectSessionListeners }) {
  const report = { action: 'recover-preview', readOnly: true, canRecover: false, generation: null,
    processes: [], listeners: [], artifacts: [], reasons: [],
    guidance: 'Inspect the recorded generation, remaining listeners and runtime artifacts before clearing an exited supervisor record.' }
  if (!session) return { ...report, reasons: ['no-owned-session-record'] }
  if (!validGeneration(session.sessionId) || !['combined','lan-only'].includes(session.mode) ||
      !validPid(session.ownerPid) || !workspaceMatches(repoRoot, session)) {
    report.reasons.push('workspace-generation-unverified')
    return report
  }
  report.generation = session.sessionId
  const state = createSessionStopPlan({ repoRoot, session, inspectProcess, platform })
  report.processes = state.processes
  if (!state.cleanup) report.reasons.push(...(state.reasons.length ? state.reasons : ['supervisor-or-components-still-running']))
  const ports = sessionPorts(session)
  const values = [...ports.values()]
  if (!values.every(port => Number.isInteger(port) && port >= 1024 && port <= 65535) || new Set(values).size !== values.length) {
    report.reasons.push('recorded-listener-ports-unverified')
  }
  let snapshot
  try { snapshot = inspectListeners({ platform }) } catch { /* Keep failure distinct from an empty inventory. */ }
  if (snapshot?.complete !== true || !Array.isArray(snapshot.listeners) || snapshot.listeners.length > 8192 ||
      !snapshot.listeners.every(row => validPid(row?.pid) && Number.isInteger(row.port) && row.port > 0 && row.port <= 65535)) {
    report.reasons.push('listener-snapshot-unavailable')
  } else {
    for (const [component,port] of ports) {
      const pids = [...new Set(snapshot.listeners.filter(row => row.port === port).map(row => row.pid))].sort((a,b) => a-b)
      for (const pid of pids.slice(0,16)) {
        const entry = state.processes.find(row => row.pid === pid)
        const ownership = entry?.state === 'orphaned' ? 'recorded-orphan' : entry?.state === 'owned' ? 'recorded-owned' : 'unverified'
        report.listeners.push({ component, port, pid, ownership })
      }
      if (pids.length > 16) report.reasons.push('additional-listeners-omitted')
      if (pids.length) report.reasons.push('recorded-port-still-occupied')
    }
  }
  report.artifacts = inspectSessionArtifacts(repoRoot, session)
  if (report.artifacts.some(artifact => artifact.state === 'unverified')) report.reasons.push('runtime-artifact-unverified')
  report.reasons = [...new Set(report.reasons)]
  report.canRecover = state.cleanup && !report.reasons.length
  if (report.canRecover) report.guidance = 'Clear this exited generation with recover --generation followed by the displayed generation ID.'
  else if (state.processes.some(row => row.state === 'orphaned')) report.guidance = 'The supervisor exited. Inspect the recorded surviving components in their own controls, then preview again after they exit. Recovery does not signal these processes.'
  else if (state.guidance && state.termination === 'owning-terminal') report.guidance = state.guidance
  else if (report.reasons.includes('runtime-artifact-unverified')) report.guidance = 'Keep the record and inspect the unverified runtime artifact. Recovery requires its recorded identity and original bytes.'
  return report
}

export function recoverExitedSession(input, generation) {
  const preview = createSessionRecoveryPlan(input)
  const refused = reasons => ({ ...preview, action: 'recover', canRecover: false, recovered: false, reasons })
  if (!validGeneration(generation) || generation !== preview.generation) return refused(['session-generation-changed'])
  if (!preview.canRecover) return refused(preview.reasons)
  try {
    const cleared = clearExitedSession(input.repoRoot, input.session, current => {
      const checked = createSessionRecoveryPlan(input)
      if (!checked.canRecover || !current()) throw new Error('recovery-preconditions-changed')
      removeSessionArtifacts(input.repoRoot, input.session, { current })
    })
    if (!cleared) return refused(['session-record-changed'])
  } catch { return refused(['recovery-preconditions-changed']) }
  return { ...preview, action: 'recover', readOnly: false, recovered: true, guidance: 'The exited generation was cleared. Preview a fresh session before starting.' }
}
