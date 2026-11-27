// The app's mock stores use the browser origin, including its exact host spelling.
const loopbackHosts = ['127.0.0.1', 'localhost']
const validPort = port => Number.isInteger(port) && port >= 1024 && port <= 65535
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const storageGuidance = 'Changing the scheme, host or port opens a separate browser storage scope. To move saved mock workspaces, export them from the original origin and restore them at the new origin.'

export function reviewRestartOrigin(session) {
  const refuse = reason => ({ valid: false, scheme: null, host: null, port: null, origin: null, reason, guidance: storageGuidance })
  if (!record(session) || session.mode === 'lan-only') return refuse('combined-browser-origin-unavailable')
  const port = session.ports?.app
  if (!validPort(port)) return refuse('recorded-app-port-invalid')
  if (Object.hasOwn(session, 'origin') && !record(session.origin) || Object.hasOwn(session, 'urls') && !record(session.urls)) {
    return refuse('recorded-browser-origin-invalid')
  }
  const declaration = session.origin ?? {}
  if (Object.hasOwn(declaration, 'scheme') && declaration.scheme !== 'http') return refuse('recorded-browser-origin-invalid')
  if (Object.hasOwn(declaration, 'port') && declaration.port !== port) return refuse('recorded-browser-origin-mismatch')

  const hosts = []
  if (Object.hasOwn(session, 'host')) hosts.push(session.host)
  if (Object.hasOwn(declaration, 'host')) hosts.push(declaration.host)
  if (hosts.some(host => !loopbackHosts.includes(host))) return refuse('recorded-loopback-host-invalid')

  const urls = []
  if (Object.hasOwn(declaration, 'url')) urls.push([declaration.url, '/'])
  for (const [field, path] of [['app', '/'], ['portals', '/portals'], ['bridge', '/__systemx']]) {
    if (Object.hasOwn(session.urls ?? {}, field)) urls.push([session.urls[field], path])
  }
  for (const [url, path] of urls) {
    // Avoid URL normalizations such as implicit ports, address aliases or an
    // external URL with a loopback name in its credentials, path or query.
    const match = typeof url === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):([1-9]\d{3,4})(\/[^?#\s]*)?$/.exec(url)
    if (!match || !validPort(Number(match[2]))) return refuse('recorded-browser-origin-invalid')
    const pathname = match[3] || '/'
    if (pathname !== path && (path === '/' || pathname !== path + '/')) return refuse('recorded-browser-origin-invalid')
    if (Number(match[2]) !== port) return refuse('recorded-browser-origin-mismatch')
    hosts.push(match[1])
  }
  if (!hosts.length) return refuse('recorded-loopback-host-invalid')
  const [host] = hosts
  if (hosts.some(other => other !== host)) return refuse('recorded-browser-origin-mismatch')
  return { valid: true, scheme: 'http', host, port, origin: 'http://' + host + ':' + port, reason: null, guidance: storageGuidance }
}

const componentsFor = Object.freeze({
  session: [], firebase: ['auth', 'firestore', 'storage'], lan: ['lan'], vite: ['app'],
})
const statuses = ['starting', 'ready', 'failed']

/** Describe the supervisor protocol using only public roles, flags and statuses.
 * Previewing owns no process handles and supplies no executable child targets. */
export function describeShutdownPlan(session, plan) {
  const standalone = session?.mode === 'lan-only'
  const ownerRole = standalone ? 'lan' : 'session'
  const components = []
  for (const role of standalone ? ['lan'] : ['session', 'firebase', 'lan', 'vite']) {
    const entry = plan?.processes?.find(item => item?.role === role && item.state === 'owned')
    if (!entry || !Number.isSafeInteger(entry.pid) || entry.pid <= 0) continue
    const readiness = componentsFor[role].map(component => {
      const status = session?.readiness?.[component]?.status
      return { component, recordedStatus: statuses.includes(status) ? status : 'unverified' }
    })
    components.push({ role, pid: entry.pid, readiness })
  }

  const steps = []
  const owner = components.find(component => component.role === ownerRole)
  let strategy = 'blocked'
  if (plan?.termination === 'owning-terminal') {
    strategy = 'manual'
    steps.push({ action: 'use-owning-terminal', detail: 'Use the verified owning terminal to request Ctrl+C. Inspect remaining processes and listeners through their owners. Preserve the record and runtime configuration for that inspection.' })
  } else if (plan?.canStop && plan.cleanup === true) {
    strategy = 'exited-record-cleanup'
    steps.push({ action: 'recheck-before-cleanup', detail: 'Recheck the current generation, recorded process exits and runtime artifacts before removing verified state.' })
  } else if (plan?.canStop && owner && plan.targets?.length === 1 &&
      plan.targets[0].role === ownerRole && plan.targets[0].pid === owner.pid) {
    strategy = standalone ? 'standalone-owner-request' : 'supervisor-request'
    steps.push({ action: 'request-owner-stop', role: ownerRole, detail: 'Recheck the owning process identity and generation immediately before requesting SIGTERM.' })
    if (!standalone) {
      steps.push({ action: 'stop-readiness-checks', detail: 'The supervisor stops checking readiness. Recorded readiness describes the last observation.' })
      // startDevSession spawns its direct child handles in this order and
      // iterates those same handles during close(). Exit completion may overlap.
      for (const child of components.filter(component => component.role !== ownerRole)) {
        steps.push({ action: 'supervisor-requests-child-exit', role: child.role,
          readinessMayBecomeUnavailable: child.readiness.map(item => item.component) })
      }
    } else {
      steps.push({ action: 'lan-may-become-unavailable', role: 'lan', readinessMayBecomeUnavailable: ['lan'] })
    }
    steps.push({ action: 'verify-shutdown', detail: 'Inspect process exits, listeners and the matching session record after the stop request. Child exits can complete in a different order.' })
  } else {
    steps.push({ action: 'inspect-ownership', detail: 'Inspect the refusal reasons and remaining processes through their verified owners. Preserve the session evidence.' })
  }
  const cleanupGate = strategy === 'manual' || strategy === 'blocked'
    ? 'Preserve session records and configuration for operator inspection.'
    : 'Verify process exits and listener state before reporting shutdown complete. Any recovery cleanup must verify the same generation and its runtime artifacts.'
  return { strategy, components, steps, cleanupGate }
}
