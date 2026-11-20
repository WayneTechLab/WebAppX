import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const limit = 64
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const routes = new Map([
  ['/', 'dashboard'], ['/Website_Dashboard.html', 'dashboard'],
  ['/api/health', 'health'], ['/api/status', 'status'], ['/api/tools', 'tools'],
  ['/api/transport/diagnostics', 'diagnostics'], ['/api/transport/limits', 'diagnostics'],
  ['/api/transport/policy', 'diagnostics'],
])
const namespaces = [
  ['/Website/', 'assets'], ['/api/contracts/', 'contracts'], ['/api/identity/', 'identity'],
  ['/api/builder/', 'builder'], ['/api/fonts/', 'fonts'], ['/api/auth/', 'auth'],
]

export function createTransportDiagnostics() {
  const entries = []
  return {
    begin(requestMethod, response) {
      const transportId = randomUUID()
      const method = methods.has(requestMethod) ? requestMethod : 'OTHER'
      const started = performance.now()
      let category = 'other'
      response.setHeader('x-systemx-request-id', transportId)
      function record(cancelled) {
        response.off('finish', onFinish)
        response.off('close', onClose)
        const durationMs = Math.round(performance.now() - started)
        const entry = { transportId, method, category, status: cancelled ? null : response.statusCode, durationMs }
        if (cancelled) entry.outcome = 'cancelled'
        entries.push(Object.freeze(entry))
        if (entries.length > limit) entries.shift()
      }
      function onFinish() { record(false) }
      function onClose() { record(!response.writableFinished) }
      response.once('finish', onFinish)
      response.once('close', onClose)
      // Only the allowlisted category survives routing; no request object, URL,
      // header values or caller-supplied correlation IDs enter the history.
      return pathname => {
        category = routes.get(pathname) ?? namespaces.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'other'
      }
    },
    snapshot() {
      return { schemaVersion: 1, limit, entries: entries.slice().reverse() }
    },
  }
}
