import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { diagnosticFields } from './session-diagnostic-fields.mjs'
import { parsePreferenceFields, sessionPreferences } from './session-preferences.mjs'
import { createSessionStartPreview } from './session-start-preview.mjs'
import { parseSessionOptions } from './session-supervisor.mjs'
import { inspectWorkspaceSession } from './session-table.mjs'

const usage = [
  'node .SYSTEMX/LAN/session-portable.mjs preferences get|clear|preview',
  'node .SYSTEMX/LAN/session-portable.mjs preferences set [--port 1024-65535] [--layout PRESET]',
  'node .SYSTEMX/LAN/session-portable.mjs diagnostics export',
]
const nextAction = {
  owned: 'inspect-component-readiness',
  absent: 'request-fresh-start-preview',
  exited: 'review-exited-session-before-fresh-start-preview',
  unverified: 'inspect-record-and-request-fresh-start-preview',
}

export function exportSessionDiagnostics(repoRoot, inspection = {}) {
  const row = inspectWorkspaceSession(repoRoot, { ...inspection, summarizeRecord: diagnosticFields })
  return {
    schemaVersion: 1, kind: 'systemx-session-diagnostics', readOnly: true,
    session: { generation: row.generation, ownership: row.ownership, recordedOrigin: row.recordedOrigin,
      activeOrigin: row.activeOrigin, listenerOwnership: row.listener.state },
    ...(row.details ?? diagnosticFields()), readinessBasis: 'last-recorded-probe',
    nextAction: nextAction[row.ownership] ?? nextAction.unverified,
  }
}

const refusalMessages = {
  'invalid-preference-fields': 'Choose an app port from 1024 to 65535 or a named LAN preview preset.',
  'preferences-unreadable': 'Inspect the local preference file. Use preferences clear to discard a damaged regular file.',
  'preferences-changed': 'The preference file changed during the request. Read it again before retrying.',
  'preferences-busy': 'Another preference update has a lock. Retry after it finishes or inspect its interrupted writer.',
  'state-directory-unverified': 'Select a workspace with a direct local state directory.',
  'workspace-unverified': 'Select a workspace containing a direct .SYSTEMX directory.',
}
export async function runSessionPortable(repoRoot, args, inspection = {}) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { status: 'help', usage }
  const [group, action, ...fields] = args
  if (group === 'diagnostics' && action === 'export' && fields.length === 0) return exportSessionDiagnostics(repoRoot, inspection)
  if (group !== 'preferences' || !['get', 'set', 'clear', 'preview'].includes(action) || action !== 'set' && fields.length) {
    return { status: 'refused', reason: 'invalid-command', usage }
  }
  if (action === 'set') return sessionPreferences(repoRoot, action, parsePreferenceFields(fields))
  if (action !== 'preview') return sessionPreferences(repoRoot, action)

  // The optional hint feeds the ordinary current ownership and collision checks.
  // Every preview mints a fresh generation. Reading preferences cannot launch it.
  const { preferences } = sessionPreferences(repoRoot, 'get')
  const port = preferences?.port
  const options = parseSessionOptions(port ? ['--port', String(port)] : [], {})
  const preview = await createSessionStartPreview({ ...inspection, repoRoot, options })
  const url = preview.canStart ? new URL('/__systemx/', preview.origin) : null
  if (url && preferences?.layout) url.searchParams.set('previewPreset', preferences.layout)
  return { status: preview.canStart ? 'previewed' : 'refused', preferences, startPreview: preview, proposedDashboard: url?.href ?? null }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result
  try { result = await runSessionPortable(process.cwd(), process.argv.slice(2)) }
  catch (error) {
    const known = Object.hasOwn(refusalMessages, error.code)
    result = { status: 'refused', reason: known ? error.code : 'observation-unavailable',
      nextAction: known ? refusalMessages[error.code] : 'Check the selected local workspace and try again.' }
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (result.status === 'refused') process.exitCode = 1
}
