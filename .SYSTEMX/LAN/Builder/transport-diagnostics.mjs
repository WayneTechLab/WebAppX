import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const limit = 64
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const routes = new Map([
  ['/', 'dashboard'], ['/Website_Dashboard.html', 'dashboard'],
  ['/api/health', 'health'], ['/api/status', 'status'], ['/api/tools', 'tools'],
  ['/api/transport/diagnostics', 'diagnostics'],
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
      response.once('finish', () => {
        const durationMs = Math.round(performance.now() - started)
        entries.push(Object.freeze({ transportId, method, category, status: response.statusCode, durationMs }))
        if (entries.length > limit) entries.shift()
      })
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
