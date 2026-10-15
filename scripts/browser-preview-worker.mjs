import { createServer } from 'vite'

const [root, cacheDir, portText, hmrPath] = process.argv.slice(2)
const port = Number(portText)
if (!root || !cacheDir || !Number.isInteger(port) || port < 1 || port > 65535 || hmrPath !== '/__webappx_smoke_hmr' || !process.send) {
  throw new Error('The owned preview worker requires its parent IPC and explicit loopback configuration.')
}
let server
let starting
let stopping
async function stop() {
  if (stopping) return stopping
  stopping = (async () => {
    try {
      await starting?.catch(() => {})
      if (server) {
        try { await Promise.all(Object.values(server.environments ?? {}).map(environment => environment.waitForRequestsIdle?.())) }
        finally { await server.close() }
      }
    } catch (error) {
      console.error('Owned preview cleanup failed: ' + error.message)
      process.exitCode = 1
    } finally { if (process.connected) process.disconnect() }
  })()
  return stopping
}
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
process.once('disconnect', () => void stop())
process.on('message', message => { if (message?.type === 'shutdown') void stop() })
starting = (async () => {
  // Verification runs observe a declared frozen source. Unrelated generated
  // documentation and new test files must not reload a measured DOM midway.
  // Tailwind can request reloads independently of the normal FS watcher, so
  // this frozen verification process also disables HMR updates. Vite's client
  // still needs its owned socket for connection/error messages. The ordinary
  // dev server retains normal watching and hot updates.
  server = await createServer({ root, cacheDir, envDir: false, mode: 'test', clearScreen: false, logLevel: 'warn', server: { host: '127.0.0.1', port, strictPort: true, open: false, watch: null, hmr: false, ws: { path: hmrPath } } })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || address.port !== port) throw new Error('Owned preview did not bind its requested loopback listener.')
  if (!stopping && process.connected) process.send({ type: 'ready', pid: process.pid, runnerPid: process.ppid, address: '127.0.0.1', port })
})()
try { await starting }
catch (error) {
  process.exitCode = 1
  if (process.connected) process.send({ type: 'failed', message: error.message })
  await stop()
}
