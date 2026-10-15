import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createMockEnvironment } from './dev-mock.mjs'

const workerFile = fileURLToPath(new URL('./browser-preview-worker.mjs', import.meta.url))

/** One exact spawned handle owns this preview. Never search by port, name or PID.
 * Closing waits for that child; escalation is restricted to the same handle.
 */
export function ownedPreviewProcess({ root, cacheDir, port, hmrPath = '/__webappx_smoke_hmr' }, { spawnWorker = fork, environment = process.env, startupTimeoutMs = 30000, shutdownTimeoutMs = 10000 } = {}) {
  if (typeof root !== 'string' || !root || typeof cacheDir !== 'string' || !cacheDir || !Number.isInteger(port) || port < 1 || port > 65535 || hmrPath !== '/__webappx_smoke_hmr') throw new Error('Use an explicit owned preview root, cache and positive loopback port.')
  let child
  let ready
  let closing
  let closed = false
  let closedPromise
  let settleClose
  let address = null
  let startupTimer
  let handle
  const adapter = {
    httpServer: { address: () => address },
    get processHandle() { return handle },
    listen() {
      if (ready) return ready
      ready = new Promise((resolve, reject) => {
        let settled = false
        const fail = error => { if (!settled) { settled = true; clearTimeout(startupTimer); reject(error) } }
        child = spawnWorker(workerFile, [root, cacheDir, String(port), hmrPath], { cwd: root, env: createMockEnvironment(environment), stdio: ['ignore', 'inherit', 'inherit', 'ipc'], execArgv: [] })
        if (Number.isInteger(child.pid) && child.pid > 0) handle = { mode: 'child-process', pid: child.pid, runnerPid: process.pid, host: '127.0.0.1', port, exited: false, exitCode: null, signal: null }
        closedPromise = new Promise(done => { settleClose = done })
        child.once('error', fail)
        child.once('close', (code, signal) => {
          closed = true
          if (handle) { handle.exited = true; handle.exitCode = code; handle.signal = signal }
          settleClose()
          if (!settled) fail(new Error('Owned preview worker exited before readiness.'))
        })
        if (!handle) { fail(new Error('Owned preview worker did not supply a process handle.')); return }
        child.on('message', message => {
          if (settled) return
          if (message?.type === 'failed') { fail(new Error('Owned preview startup failed: ' + String(message.message))); return }
          if (message?.type !== 'ready') return
          if (message.pid !== child.pid || message.runnerPid !== process.pid || message.address !== '127.0.0.1' || message.port !== port) { fail(new Error('Owned preview worker readiness did not match its process handle and listener.')); return }
          settled = true; clearTimeout(startupTimer)
          address = { address: '127.0.0.1', port }
          resolve()
        })
        startupTimer = setTimeout(() => fail(new Error('Owned preview worker startup exceeded its limit.')), startupTimeoutMs)
      })
      return ready
    },
    close() {
      if (closing) return closing
      closing = (async () => {
        clearTimeout(startupTimer)
        if (!child) return
        if (closed) {
          if (handle && (handle.exitCode !== 0 || handle.signal)) throw new Error('Owned preview exited abnormally before cleanup.')
          return
        }
        if (!handle) { await closedPromise; return }
        let timer
        let escalated = false
        try {
          timer = setTimeout(() => {
            if (!closed) { escalated = true; child.kill('SIGKILL') }
          }, shutdownTimeoutMs)
          if (child.connected) {
            try { child.send({ type: 'shutdown' }, error => { if (error && !closed) child.kill('SIGTERM') }) }
            catch { if (!closed) child.kill('SIGTERM') }
          } else if (!closed) child.kill('SIGTERM')
          await closedPromise
          if (escalated || handle.exitCode !== 0 || handle.signal) throw new Error('Owned preview required forced or abnormal termination.')
        } finally { clearTimeout(timer) }
      })()
      return closing
    },
  }
  return adapter
}
