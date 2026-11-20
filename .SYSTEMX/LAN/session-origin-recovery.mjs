import { inspectSessionListeners } from './session-restart-preview.mjs'

// A failed bind alone cannot identify the process. Confirm the exact origin and
// listener against the selected workspace's live table before suggesting reuse.
export async function fixedOriginRecovery({ repoRoot, options, inspectListeners = inspectSessionListeners,
  inspectProcess, platform = process.platform, snapshot, inspectWorkspace, bindFailed = false }) {
  if (!options.fixedOrigin) return null
  if (snapshot === undefined) {
    try { snapshot = inspectListeners({ platform }) } catch { snapshot = null }
  }
  const complete = snapshot?.complete === true && Array.isArray(snapshot.listeners) && snapshot.listeners.length <= 8192 &&
    snapshot.listeners.every(entry => Number.isInteger(entry?.port) && entry.port > 0 && entry.port <= 65535)
  const matching = complete ? snapshot.listeners.filter(entry => entry?.port === options.ports.app) : []
  if (!bindFailed && !matching.length) return null
  const origin = `http://${options.host}:${options.ports.app}`
  const pids = [...new Set(matching.map(entry => entry.pid).filter(pid => Number.isSafeInteger(pid) && pid > 0))].sort((a, b) => a - b)
  let ownership = matching.length ? 'unverified-listener' : 'unobserved-listener'
  if (matching.length && pids.length === 1 && matching.every(entry => entry.pid === pids[0])) {
    try {
      const inspect = inspectWorkspace ?? (await import('./session-table.mjs')).inspectWorkspaceSession
      const row = inspect(repoRoot, { inspectListeners: () => snapshot, inspectProcess, platform })
      if (row.ownership === 'owned' && row.activeOrigin === origin && row.listener.state === 'owned' && row.listener.pid === pids[0]) {
        ownership = 'verified-workspace-listener'
      } else if (row.ownership === 'absent' || row.ownership === 'exited' || row.listener.state === 'unrelated') {
        ownership = 'outside-verified-workspace-session'
      }
    } catch { /* Keep uncertainty visible when the record cannot be inspected. */ }
  }
  const choices = [
    ownership === 'verified-workspace-listener'
      ? { action: 'inspect-current-session', guidance: 'Inspect the existing workspace session and its readiness before using this origin.' }
      : { action: 'inspect-listener', guidance: 'Inspect the listener through its owning application before taking action.' },
    { action: 'retry-same-origin', guidance: 'Release this port through its verified owner, then preview the same fixed origin again.' },
    { action: 'choose-different-origin', guidance: 'Explicitly choose another --port and preview it. Browser mock data belongs to the original origin.' },
  ]
  return { origin, ownership, listenerPids: pids.slice(0, 16), omittedPids: Math.max(0, pids.length - 16), choices }
}
