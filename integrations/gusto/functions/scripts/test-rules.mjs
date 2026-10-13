import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'

const source = fileURLToPath(new URL('../', import.meta.url))
const rules = fileURLToPath(new URL('../../firestore.rules', import.meta.url))
const directory = await mkdtemp(join(tmpdir(), 'webappx-gusto-rules-'))
const servers = []
try {
  const ports = []
  for (let index = 0; index < 5; index++) {
    const server = createServer()
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    servers.push(server); ports.push(server.address().port)
  }
  const [auth, firestore, hub, logging, websocket] = ports
  const configPath = join(directory, 'firebase.json')
  await writeFile(configPath, JSON.stringify({
    firestore: { rules },
    emulators: {
      auth: { host: '127.0.0.1', port: auth }, firestore: { host: '127.0.0.1', port: firestore, websocketPort: websocket },
      hub: { host: '127.0.0.1', port: hub }, logging: { host: '127.0.0.1', port: logging }, ui: { enabled: false }, singleProjectMode: true,
    },
  }, null, 2))
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))))
  const exitCode = await new Promise((resolve, reject) => {
    // Windows .cmd wrappers need a shell. Select the installed JS entry point
    // explicitly instead, keeping subprocess calls as argument arrays.
    const entry = process.env.FIREBASE_CLI_JS
    if (process.platform === 'win32' && !entry) { reject(new Error('Set FIREBASE_CLI_JS to the installed firebase-tools/lib/bin/firebase.js entry point on Windows')); return }
    const command = entry ? process.execPath : 'firebase'
    const args = [...(entry ? [entry] : []), 'emulators:exec', '--only', 'auth,firestore', '--project', 'demo-systemx-gusto-rules', '--config', configPath, 'node --test test/firestore-rules.test.mjs']
    const child = spawn(command, args, { cwd: source, stdio: 'inherit', shell: false })
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1))
  })
  process.exitCode = exitCode
} finally {
  for (const server of servers) if (server.listening) await new Promise(resolve => server.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
