import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptFile = fileURLToPath(import.meta.url)
const repository = fileURLToPath(new URL('../', import.meta.url))
const requireFromApp = createRequire(new URL('../package.json', import.meta.url))

export function parseMockArguments(args) {
  const options = { port: 0, help: false }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--port') {
      const value = args[++index]
      if (!value || !/^\d+$/.test(value) || Number(value) > 65535) throw new Error('Use --port followed by an integer from 0 to 65535. Zero selects a free loopback port.')
      options.port = Number(value)
    } else throw new Error(`Unknown mock option: ${argument}. Supported options: --port <0-65535>, --help.`)
  }
  return options
}

/** Return a child-only environment; never change the invoking shell or .env files. */
export function createMockEnvironment(environment) {
  const clean = Object.fromEntries(Object.entries(environment).filter(([key]) => !/^(VITE_|FIREBASE_|GUSTO_|SYSTEMX_)/i.test(key) && key.toUpperCase() !== 'GOOGLE_APPLICATION_CREDENTIALS'))
  clean.VITE_FIREBASE_USE_EMULATORS = 'false'
  clean.VITE_SYSTEMX_LOCAL_SESSION = 'false'
  return clean
}

export function mockWorkerArguments(options) {
  return ['--serve', '--port', String(options.port)]
}

export function allocateMockPort() {
  return new Promise((resolvePort, reject) => {
    const allocator = createTcpServer()
    allocator.once('error', reject)
    allocator.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = allocator.address()
      if (!address || typeof address === 'string') {
        allocator.close(() => reject(new Error('Could not allocate a free mock portal port.')))
        return
      }
      allocator.close(error => error ? reject(error) : resolvePort(address.port))
    })
  })
}

export function mockViteOptions({ port, cacheDir, plugins, root = repository }) {
  return {
    root,
    configFile: false,
    envDir: false,
    cacheDir,
    clearScreen: false,
    logLevel: 'warn',
    plugins,
    resolve: { alias: { '@': join(root, 'src') } },
    server: { host: '127.0.0.1', port, strictPort: true, open: false, proxy: {} },
  }
}

async function loadAppRuntime() {
  try {
    // Application dependencies come from npm ci. The launcher itself needs only
    // Node builtins and never invokes npx, downloads a package, or runs a CLI.
    const [vite, react, tailwind] = await Promise.all(['vite', '@vitejs/plugin-react', '@tailwindcss/vite'].map(name => import(pathToFileURL(requireFromApp.resolve(name)).href)))
    return { createServer: vite.createServer, plugins: [react.default(), tailwind.default()] }
  } catch (error) {
    throw new Error('Mock portals need the checked-in app dependencies. Run npm ci, then npm run dev:mock. No Firebase, Gusto, Java or provider account is required.', { cause: error })
  }
}

export async function startMockServer(options, { runtime = loadAppRuntime } = {}) {
  const { createServer, plugins } = await runtime()
  const cacheDir = await mkdtemp(join(tmpdir(), 'webappx-native-mock-'))
  let server
  let listening = false
  let closing
  const close = () => closing ??= (async () => {
    try {
      try {
        // A cold module response can finish while Vite is still warming its
        // static imports. Cancelling that crawl immediately can strand imports
        // waiting for the optimizer. Let its idle boundary release those
        // waiters before Vite.close() cancels the optimizer and closes sockets.
        if (listening) await Promise.all(Object.values(server?.environments ?? {}).map(environment => environment.waitForRequestsIdle?.()))
      } finally { await server?.close() }
    } finally { await rm(cacheDir, { recursive: true, force: true }) }
  })()
  try {
    const port = options.port || await allocateMockPort()
    server = await createServer(mockViteOptions({ port, cacheDir, plugins }))
    await server.listen()
    listening = true
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') throw new Error('The mock portal server did not bind its owned loopback listener.')
    return { server, close, url: `http://127.0.0.1:${address.port}/portals` }
  } catch (error) {
    await close()
    throw error
  }
}

async function serve(options) {
  let owned
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    try { await owned?.close() } catch (error) { console.error(`Mock cleanup failed: ${error.message}`); process.exitCode = 1 }
    if (process.connected) process.disconnect()
  }
  const onMessage = message => { if (message?.type === 'shutdown') void stop() }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  process.once('disconnect', stop)
  process.on('message', onMessage)
  try {
    owned = await startMockServer(options)
    if (stopping) { await owned.close(); return }
    console.log(`Account-free HR, CMS and CRM: ${owned.url}`)
    console.log('Firebase, emulators, provider connections and LAN integrations are disabled. Use fictional data only. Press Ctrl+C to stop this server.')
    process.send?.({ type: 'ready', url: owned.url })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    await stop()
  }
}

export function runMockWorker(options, { spawnWorker = fork, environment = process.env, signalSource = process, output = console } = {}) {
  return new Promise((resolveExit, reject) => {
    // fork uses an argument array, no shell and no platform-specific executable.
    const child = spawnWorker(scriptFile, mockWorkerArguments(options), { cwd: repository, env: createMockEnvironment(environment), stdio: ['inherit', 'inherit', 'inherit', 'ipc'], execArgv: [] })
    let shutdownTimer
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      if (child.connected) child.send({ type: 'shutdown' })
      // Escalation is restricted to the one child created by this invocation.
      shutdownTimer = setTimeout(() => child.kill('SIGKILL'), 10_000)
      shutdownTimer.unref?.()
    }
    const onMessage = message => { if (message?.type === 'ready') output.log(`Mock workspace ready: ${message.url}`) }
    const cleanup = () => {
      clearTimeout(shutdownTimer)
      signalSource.removeListener('SIGINT', stop)
      signalSource.removeListener('SIGTERM', stop)
      child.removeListener('message', onMessage)
    }
    signalSource.once('SIGINT', stop)
    signalSource.once('SIGTERM', stop)
    child.on('message', onMessage)
    child.once('error', error => { cleanup(); reject(error) })
    child.once('exit', (code, signal) => {
      cleanup()
      // A requested shutdown succeeds only when the worker confirms a normal
      // exit. A null code after SIGKILL (including our deadline) is a failure.
      resolveExit(signal ? 1 : code === 0 ? 0 : code ?? 1)
    })
  })
}

export async function main(args = process.argv.slice(2)) {
  const worker = args[0] === '--serve'
  const options = parseMockArguments(worker ? args.slice(1) : args)
  if (options.help) {
    console.log('Usage: npm run dev:mock -- [--port <0-65535>]\nStarts native account-free HR/CMS/CRM portals on 127.0.0.1. The default port 0 selects a free port. An explicit busy port fails without stopping another listener. Run npm ci once for app dependencies; no Firebase/Gusto account or emulator setup is needed.')
    return 0
  }
  if (worker) { await serve(options); return process.exitCode ?? 0 }
  return runMockWorker(options)
}

if (process.argv[1] && resolve(process.argv[1]) === scriptFile) {
  try { process.exitCode = await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
