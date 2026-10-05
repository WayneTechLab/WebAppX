#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanStalePidFiles,
  clearSession,
  findAvailablePort,
  removePidFile,
  writePidFile,
  writeSession,
} from './Builder/runtime/port-utils.mjs'

const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(lanRoot, '..', '..')
const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const lanServer = join(lanRoot, 'server.mjs')
const host = process.env.SYSTEMX_DEV_HOST ?? '127.0.0.1'
const preferredAppPort = Number.parseInt(process.env.SYSTEMX_APP_PORT ?? '5173', 10)
const preferredLanPort = Number.parseInt(process.env.SYSTEMX_LAN_PORT ?? '7331', 10)
const preferredFirebaseAuthPort = Number.parseInt(process.env.SYSTEMX_FIREBASE_AUTH_PORT ?? '9099', 10)
const preferredFirebaseFirestorePort = Number.parseInt(process.env.SYSTEMX_FIREBASE_FIRESTORE_PORT ?? '8080', 10)
const preferredFirebaseStoragePort = Number.parseInt(process.env.SYSTEMX_FIREBASE_STORAGE_PORT ?? '9199', 10)
const sessionId = `systemx-${Date.now()}-${process.pid}`
const firebaseCli = process.platform === 'win32' ? 'npx.cmd' : 'npx'

if (!existsSync(viteBin)) {
  throw new Error('Missing local Vite dependency. Run npm install first.')
}

const children = []

cleanStalePidFiles(repoRoot)
const appPort = await findAvailablePort(preferredAppPort)
const lanPort = await findAvailablePort(preferredLanPort)
const firebaseAuthPort = await findAvailablePort(preferredFirebaseAuthPort)
const firebaseFirestorePort = await findAvailablePort(preferredFirebaseFirestorePort)
const firebaseStoragePort = await findAvailablePort(preferredFirebaseStoragePort)
const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
const firebaseConfigFile = join(stateRoot, `firebase-${sessionId}.json`)

mkdirSync(stateRoot, { recursive: true, mode: 0o700 })
const firebaseConfig = JSON.parse(readFileSync(join(repoRoot, 'firebase.json'), 'utf8'))
firebaseConfig.firestore = {
  ...firebaseConfig.firestore,
  rules: resolve(repoRoot, firebaseConfig.firestore?.rules ?? 'firestore.rules'),
  indexes: resolve(repoRoot, firebaseConfig.firestore?.indexes ?? 'firestore.indexes.json'),
}
firebaseConfig.storage = {
  ...firebaseConfig.storage,
  rules: resolve(repoRoot, firebaseConfig.storage?.rules ?? 'storage.rules'),
}
firebaseConfig.emulators = {
  auth: { port: firebaseAuthPort },
  firestore: { port: firebaseFirestorePort },
  storage: { port: firebaseStoragePort },
  singleProjectMode: true,
}
writeFileSync(firebaseConfigFile, `${JSON.stringify(firebaseConfig, null, 2)}\n`, { mode: 0o600 })

const firebaseEnv = {
  SYSTEMX_FIREBASE_AUTH_PORT: String(firebaseAuthPort),
  SYSTEMX_FIREBASE_FIRESTORE_PORT: String(firebaseFirestorePort),
  SYSTEMX_FIREBASE_STORAGE_PORT: String(firebaseStoragePort),
  VITE_SYSTEMX_LOCAL_SESSION: 'true',
  VITE_FIREBASE_USE_EMULATORS: 'true',
  VITE_FIREBASE_EMULATOR_HOST: host,
  VITE_FIREBASE_AUTH_EMULATOR_PORT: String(firebaseAuthPort),
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: String(firebaseFirestorePort),
  VITE_FIREBASE_STORAGE_EMULATOR_PORT: String(firebaseStoragePort),
}

function start(label, executable, args, env = {}) {
  const child = spawn(executable, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      SYSTEMX_APP_PORT: String(appPort),
      SYSTEMX_LAN_PORT: String(lanPort),
      SYSTEMX_STRICT_PORT: 'true',
      SYSTEMX_SESSION_ID: sessionId,
      SYSTEMX_SESSION_OWNER_PID: String(process.pid),
      ...firebaseEnv,
      ...env,
    },
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`))
  child.on('exit', (code, signal) => {
    if (signal) {
      process.stderr.write(`[${label}] stopped by ${signal}\n`)
      return
    }
    process.stderr.write(`[${label}] exited with ${code ?? 0}\n`)
  })

  children.push(child)
  return child
}

const firebaseChild = start('FIREBASE', firebaseCli, [
  '--no-install',
  'firebase-tools',
  'emulators:start',
  '--config',
  firebaseConfigFile,
  '--project',
  'demo-systemx',
  '--only',
  'auth,firestore,storage',
])
const lanChild = start('LAN', process.execPath, [lanServer])
const viteChild = start('VITE', process.execPath, [viteBin, '--host', host, '--port', String(appPort)])

writePidFile(repoRoot, `local-lan-${lanPort}.pid`, lanChild.pid)
writePidFile(repoRoot, `local-vite-${appPort}.pid`, viteChild.pid)
writeSession(repoRoot, {
  schemaVersion: 1,
  sessionId,
  ownerPid: process.pid,
  processes: { session: process.pid, firebase: firebaseChild.pid, lan: lanChild.pid, vite: viteChild.pid },
  ports: {
    lan: lanPort,
    app: appPort,
    firebase: {
      auth: firebaseAuthPort,
      firestore: firebaseFirestorePort,
      storage: firebaseStoragePort,
    },
  },
  urls: {
    lan: `http://${host}:${lanPort}/`,
    app: `http://${host}:${appPort}/`,
    bridge: `http://${host}:${appPort}/__systemx/`,
  },
  runtime: { firebaseConfig: firebaseConfigFile },
  mode: 'combined',
  startedAt: new Date().toISOString(),
})

process.stdout.write('\nSYSTEMX local session starting:\n')
process.stdout.write(`  Public app:      http://${host}:${appPort}/\n`)
process.stdout.write(`  LAN direct:      http://${host}:${lanPort}/\n`)
process.stdout.write(`  LAN via Vite:    http://${host}:${appPort}/__systemx/\n\n`)
process.stdout.write(`  Firebase Auth:   http://${host}:${firebaseAuthPort}/\n`)
process.stdout.write(`  Firestore:       ${host}:${firebaseFirestorePort}\n`)
process.stdout.write(`  Storage:         ${host}:${firebaseStoragePort}\n\n`)

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  removePidFile(repoRoot, `local-lan-${lanPort}.pid`, lanChild.pid)
  removePidFile(repoRoot, `local-vite-${appPort}.pid`, viteChild.pid)
  if (existsSync(firebaseConfigFile)) unlinkSync(firebaseConfigFile)
  clearSession(repoRoot, sessionId)
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(143)
})
process.on('SIGHUP', () => {
  shutdown()
  process.exit(129)
})
