import { randomUUID } from 'node:crypto'
import { readSessionClaim } from './session-claim.mjs'
import { inspectSessionListeners } from './session-restart-preview.mjs'
import { resolveSessionPorts } from './session-supervisor.mjs'

// The launcher must still acquire its claim and recheck ports. A read-only
// preview observes the listener table without binding even a probe socket.
export async function createSessionStartPreview({
  repoRoot, options, inspectOwnership = readSessionClaim, inspectListeners = inspectSessionListeners, inspectProcess, inspectWorkspace, platform = process.platform,
}) {
  const owner = inspectOwnership(repoRoot)
  const preview = {
    action: 'start-preview', readOnly: true, canStart: false,
    generation: options.generation ?? `systemx-${randomUUID()}`,
    selection: options.fixedOrigin ? 'fixed' : 'automatic',
    origin: null, ports: null, previousSession: owner,
    readiness: 'not-started', reasons: [], proposedLaunch: null,
    nextAction: 'Review the proposed ports. The launcher will check the origin and select available component ports again before startup.',
  }
  if (options.fixedOrigin) preview.origin = `http://${options.host}:${options.ports.app}`
  if (owner.status !== 'absent') {
    const reasons = {
      owned: ['session-already-owned', 'Use the current session or stop it through its verified owner before starting another.'],
      exited: ['exited-session-needs-cleanup', 'Run node .SYSTEMX/LAN/session-control.mjs stop to verify and clear the exited record, then preview the new start again.'],
      unverified: ['session-ownership-unverified', 'Inspect the recorded owner and its processes before starting another session.'],
    }
    const [reason, nextAction] = reasons[owner.status] ?? reasons.unverified
    preview.reasons.push(reason)
    preview.nextAction = nextAction
  }
  let snapshot
  try { snapshot = inspectListeners() } catch { /* Absence of an inventory cannot establish availability. */ }
  if (!snapshot?.complete || !Array.isArray(snapshot.listeners)
    || !snapshot.listeners.every(entry => Number.isInteger(entry?.port) && entry.port > 0 && entry.port <= 65535)) {
    preview.reasons.push('listener-snapshot-unavailable')
    if (owner.status === 'absent') preview.nextAction = 'Inspect the local listener inventory and preview again.'
    return preview
  }
  const occupied = new Set(snapshot.listeners.map(listener => listener.port))
  try {
    preview.ports = await resolveSessionPorts(options, { available: port => !occupied.has(port) })
    preview.origin = `http://${options.host}:${preview.ports.app}`
  } catch (error) {
    preview.reasons.push(error.code === 'EADDRINUSE' ? 'fixed-app-port-unavailable' : 'component-ports-unavailable')
    if (error.code === 'EADDRINUSE') {
      const { fixedOriginRecovery } = await import('./session-origin-recovery.mjs')
      preview.recovery = await fixedOriginRecovery({ repoRoot, options, snapshot, inspectWorkspace, inspectProcess, platform, bindFailed: true })
      preview.nextAction = preview.recovery.choices.map(choice => choice.guidance).join(' ')
    }
  }
  preview.canStart = preview.reasons.length === 0
  if (preview.canStart) {
    // Pin the origin selected by this preview so a later collision cannot
    // silently send the operator to a different browser storage origin.
    preview.proposedLaunch = {
      executable: process.execPath,
      args: ['.SYSTEMX/LAN/dev-session.mjs', '--generation', preview.generation, '--fixed-origin',
        '--host', options.host, '--port', String(preview.ports.app),
        ...(options.emulatorImport ? ['--emulator-import', options.emulatorImport] : [])],
      environment: {
        SYSTEMX_LAN_PORT: String(preview.ports.lan),
        SYSTEMX_FIREBASE_AUTH_PORT: String(preview.ports.firebase.auth),
        SYSTEMX_FIREBASE_FIRESTORE_PORT: String(preview.ports.firebase.firestore),
        SYSTEMX_FIREBASE_STORAGE_PORT: String(preview.ports.firebase.storage),
      },
    }
  }
  return preview
}
