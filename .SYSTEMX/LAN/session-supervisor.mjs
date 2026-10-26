import { request } from 'node:http'
import { createConnection } from 'node:net'
import { isPortAvailable } from './Builder/runtime/port-utils.mjs'

const defaults = { app: 5173, lan: 7331, auth: 9099, firestore: 8080, storage: 9199 }
const portVariables = { app: 'SYSTEMX_APP_PORT', lan: 'SYSTEMX_LAN_PORT', auth: 'SYSTEMX_FIREBASE_AUTH_PORT', firestore: 'SYSTEMX_FIREBASE_FIRESTORE_PORT', storage: 'SYSTEMX_FIREBASE_STORAGE_PORT' }

function parsePort(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error(`${label} must be an integer from 1024 to 65535.`)
  }
  return Number(value)
}

export function parseSessionOptions(args = [], environment = {}) {
  const options = {
    host: environment.SYSTEMX_DEV_HOST ?? '127.0.0.1',
    fixedOrigin: environment.SYSTEMX_FIXED_ORIGIN === 'true' || environment.SYSTEMX_DEV_HOST !== undefined || environment.SYSTEMX_APP_PORT !== undefined,
    ports: Object.fromEntries(Object.entries(defaults).map(([name, port]) => [name, parsePort(environment[portVariables[name]] ?? port, portVariables[name])])),
    help: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--fixed-origin') options.fixedOrigin = true
    else if (argument === '--host') {
      options.host = args[++index]
      options.fixedOrigin = true
    } else if (argument === '--port') {
      options.ports.app = parsePort(args[++index], '--port')
      options.fixedOrigin = true
    } else if (argument === '--emulator-import') {
      const directory = args[++index]
      if (typeof directory !== 'string' || !directory.trim() || directory.startsWith('--') || directory.includes('\0')) throw new Error('--emulator-import requires one existing Firebase export directory argument.')
      if (options.emulatorImport !== undefined) throw new Error('--emulator-import may be supplied only once.')
      options.emulatorImport = directory
    } else throw new Error(`Unknown session option: ${argument}. Use --host <127.0.0.1|localhost>, --port <1024-65535>, --fixed-origin, --emulator-import <exportdir> or --help.`)
  }
  // These names match the LAN origin allowlist and Firebase client contract.
  // Accepting a wildcard or another address would expose local write controls.
  if (!['127.0.0.1', 'localhost'].includes(options.host)) throw new Error('The local session host must be 127.0.0.1 or localhost. Use --host 127.0.0.1 for a loopback origin.')
  if (environment.SYSTEMX_FIXED_ORIGIN !== undefined && !['true', 'false'].includes(environment.SYSTEMX_FIXED_ORIGIN)) throw new Error('SYSTEMX_FIXED_ORIGIN must be true or false.')
  return options
}

export async function resolveSessionPorts(options, { available = isPortAvailable, range = 30 } = {}) {
  const reserved = new Set()
  const choose = async (name) => {
    const preferred = options.ports[name]
    if (name === 'app' && options.fixedOrigin) {
      if (!await available(preferred)) {
        const error = new Error(`Fixed app origin http://${options.host}:${preferred} is unavailable: loopback port ${preferred} is occupied or cannot be bound. The session has not started. Inspect the listener with npm run systemx:session:status; choose another --port, or stop the listener through its own controls. To allow automatic selection, omit --host/--port and unset SYSTEMX_DEV_HOST, SYSTEMX_APP_PORT and SYSTEMX_FIXED_ORIGIN.`)
        error.code = 'EADDRINUSE'
        throw error
      }
      reserved.add(preferred)
      return preferred
    }
    for (let port = preferred; port <= Math.min(preferred + range, 65535); port += 1) {
      if (!reserved.has(port) && await available(port)) {
        reserved.add(port)
        return port
      }
    }
    throw new Error(`No free loopback port for ${name} from ${preferred} to ${Math.min(preferred + range, 65535)}. Choose a different ${portVariables[name]}; no listener was stopped.`)
  }
  const app = await choose('app')
  const lan = await choose('lan')
  const auth = await choose('auth')
  const firestore = await choose('firestore')
  const storage = await choose('storage')
  return { app, lan, firebase: { auth, firestore, storage } }
}

export function sessionUrls(host, ports) {
  const origin = `http://${host}:${ports.app}`
  return { app: `${origin}/`, portals: `${origin}/portals`, bridge: `${origin}/__systemx/`, lan: `http://127.0.0.1:${ports.lan}/` }
}

export function formatSessionSummary(session) {
  return [
    '\nSYSTEMX local session starting:',
    `  Mock save origin: ${session.origin.url} (scheme ${session.origin.scheme}, host ${session.origin.host}, port ${session.origin.port})`,
    '  Browser mock saves belong to this exact origin and browser profile. Keep the same address to reopen them.',
    `  Origin selection: ${session.origin.fixed ? 'fixed; an occupied app port fails' : 'automatic; use --host 127.0.0.1 --port <port> to keep a stable origin'}`,
    `  Public app:       ${session.urls.app}`,
    `  Portal directory: ${session.urls.portals}`,
    `  LAN direct:       ${session.urls.lan}`,
    `  LAN via Vite:     ${session.urls.bridge}`,
    ...Object.values(session.readiness).map(component => `  [${component.status}] ${component.label}: ${component.message}`),
    '',
  ].join('\n')
}

export function readinessComponents(host, ports) {
  const urls = sessionUrls(host, ports)
  return {
    app: { label: 'Vite app', process: 'vite', kind: 'vite', url: urls.portals },
    lan: { label: 'LAN service', process: 'lan', kind: 'lan', url: `${urls.lan}api/health` },
    auth: { label: 'Firebase Auth emulator', process: 'firebase', kind: 'auth', url: `http://127.0.0.1:${ports.firebase.auth}/` },
    firestore: { label: 'Firestore emulator', process: 'firebase', kind: 'firestore', url: `http://127.0.0.1:${ports.firebase.firestore}/` },
    storage: { label: 'Storage emulator', process: 'firebase', kind: 'tcp', url: `http://127.0.0.1:${ports.firebase.storage}/` },
  }
}

function probeHttp(component, timeoutMs) {
  return new Promise(resolveProbe => {
    let complete = false
    let deadline
    const finish = (result) => { if (!complete) { complete = true; clearTimeout(deadline); resolveProbe(result) } }
    const outgoing = request(component.url, { method: 'GET', agent: false, headers: { Connection: 'close' } }, response => {
      let body = ''
      response.on('data', chunk => {
        body += chunk.toString()
        if (body.length > 262144) outgoing.destroy(new Error('readiness response exceeded the local probe limit'))
      })
      response.once('end', () => {
        if (response.statusCode !== 200) return finish({ ok: false, reason: `HTTP ${response.statusCode}` })
        if (component.kind === 'vite') return finish({ ok: body.includes('/@vite/client'), reason: 'the app response did not contain the Vite client' })
        if (component.kind === 'firestore') return finish({ ok: body === 'Ok\n', reason: 'the Firestore health response was unexpected' })
        try {
          const json = JSON.parse(body)
          const ok = component.kind === 'lan' ? json.status === 'online' && json.mode === 'local-only' : json.authEmulator?.ready === true
          finish({ ok, reason: 'the component has not reported ready' })
        } catch { finish({ ok: false, reason: 'the component returned an unexpected readiness response' }) }
      })
      response.once('error', () => finish({ ok: false, reason: 'the readiness response was interrupted' }))
    })
    deadline = setTimeout(() => outgoing.destroy(new Error('probe timed out')), timeoutMs)
    outgoing.once('error', error => finish({ ok: false, reason: error.code ?? error.message }))
    outgoing.end()
  })
}

export function probeReadiness(component, { timeoutMs = 750 } = {}) {
  if (component.kind !== 'tcp') return probeHttp(component, timeoutMs)
  return new Promise(resolveProbe => {
    const url = new URL(component.url)
    const socket = createConnection({ host: url.hostname, port: Number(url.port) })
    let complete = false
    const finish = result => {
      if (complete) return
      complete = true
      socket.destroy()
      resolveProbe(result)
    }
    socket.setTimeout(timeoutMs, () => finish({ ok: false, reason: 'connection timed out' }))
    socket.once('connect', () => finish({ ok: true }))
    socket.once('error', error => finish({ ok: false, reason: error.code ?? 'connection failed' }))
  })
}

export function createReadinessTracker(components, { now = Date.now, timeoutMs = 60_000, probe = probeReadiness, onChange = () => {} } = {}) {
  const startedAt = now()
  const readiness = Object.fromEntries(Object.entries(components).map(([name, component]) => [name, { label: component.label, status: 'starting', url: component.url, message: `Waiting at ${component.url}`, checkedAt: null }]))
  let stopped = false
  let checking
  function update(name, status, message) {
    if (stopped) return
    readiness[name] = { ...readiness[name], status, message, checkedAt: new Date(now()).toISOString() }
    onChange(name, readiness[name])
  }
  function processFailed(processName, reason) {
    for (const [name, component] of Object.entries(components)) {
      if (component.process === processName) update(name, 'failed', `${reason}. ${component.label} is unavailable at ${component.url}; inspect [${processName.toUpperCase()}] output and restart the owned session.`)
    }
  }
  function check() {
    if (checking) return checking
    checking = (async () => {
      await Promise.all(Object.entries(components).map(async ([name, component]) => {
        if (stopped || readiness[name].status !== 'starting') return
        let result
        try { result = await probe(component) } catch (error) { result = { ok: false, reason: error.code ?? error.message } }
        // An exit or shutdown can happen while a readiness request is in flight.
        if (stopped || readiness[name].status !== 'starting') return
        if (result.ok) {
          const message = component.kind === 'vite'
            ? `Usable app at ${component.url}; emulator readiness is reported separately.`
            : component.kind === 'tcp'
              ? `Loopback listener reachable at ${component.url}; emulator workflows have not been tested.`
              : `Readiness response received at ${component.url}.`
          update(name, 'ready', message)
        } else if (now() - startedAt >= timeoutMs) {
          update(name, 'failed', `Not ready after ${timeoutMs}ms at ${component.url} (${result.reason ?? 'probe failed'}). Inspect [${component.process.toUpperCase()}] output, dependencies and port availability; restart the owned session after correcting this component.`)
        }
      }))
    })().finally(() => { checking = undefined })
    return checking
  }
  return { readiness, check, processFailed, stop: () => { stopped = true }, settled: () => Object.values(readiness).every(component => component.status !== 'starting') }
}
