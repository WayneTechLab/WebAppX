import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { loadEnv } from 'vite'
import { PILOT_REVISION, releaseForRevision, servePilotAsset } from './functions/contracts.mjs'

const project = 'demo-systemx'
const loopbackAddresses = new Set(['127.0.0.1', '::ffff:127.0.0.1', '::1'])

function validClaims(token) {
  try {
    const [header, payload, signature, extra] = token.split('.')
    if (extra !== undefined || signature !== '' || !payload) return null
    if (JSON.parse(Buffer.from(header, 'base64url')).alg !== 'none') return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url'))
    const now = Math.floor(Date.now() / 1000)
    if (claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` ||
        typeof claims.sub !== 'string' || !claims.sub || !Number.isSafeInteger(claims.exp) ||
        claims.exp <= now || !Number.isSafeInteger(claims.auth_time) || claims.auth_time > now + 60 ||
        !claims.firebase?.sign_in_provider || claims.firebase.sign_in_provider === 'anonymous' ||
        claims.firebase.tenant) return null
    return claims
  } catch {
    return null
  }
}

export function createLocalAuthorizer(env) {
  const port = Number(env.VITE_FIREBASE_AUTH_EMULATOR_PORT)
  const enabled = env.VITE_SYSTEMX_LOCAL_SESSION === 'true' && env.VITE_FIREBASE_USE_EMULATORS === 'true' &&
    env.VITE_FIREBASE_EMULATOR_HOST === '127.0.0.1' && Number.isInteger(port) && port > 0 && port <= 65535 &&
    (!env.VITE_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID === project)
  return async token => {
    if (!enabled) throw new Error('Start the supervised local session')
    const claims = validClaims(token)
    if (!claims) return false
    const url = `http://127.0.0.1:${port}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=systemx-local-api-key`
    const result = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
      redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    if (result.status >= 500) throw new Error('Local Auth is unavailable')
    if (!result.ok) return false
    const { users } = await result.json()
    const user = users?.[0]
    return users?.length === 1 && user.localId === claims.sub && !user.disabled &&
      (!user.validSince || claims.auth_time >= Number(user.validSince))
  }
}

function within(root, child) {
  const rel = relative(root, child)
  return !rel || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}

export function createLocalReader(activeDirectory, servedDirectories, previousDirectory) {
  return async (name, revision = PILOT_REVISION) => {
    const { assets } = releaseForRevision(revision)
    const directory = revision === PILOT_REVISION ? activeDirectory : previousDirectory
    if (!Object.hasOwn(assets, name) || !directory || !isAbsolute(directory)) {
      throw new Error('Missing private release')
    }
    const location = await realpath(directory)
    for (const root of servedDirectories) {
      if (within(await realpath(root), location)) throw new Error('Use an external private directory')
    }
    const file = join(location, name)
    if (await realpath(file) !== file) throw new Error('Private release must use regular files')
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try {
      const size = assets[name].bytes
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size !== size) throw new Error('Wrong release size')
      const bytes = Buffer.alloc(size)
      let offset = 0
      while (offset < size) {
        const { bytesRead } = await handle.read(bytes, offset, size - offset, offset)
        if (!bytesRead) throw new Error('Incomplete release')
        offset += bytesRead
      }
      if ((await handle.stat()).size !== size) throw new Error('Release changed')
      return bytes
    } finally {
      await handle.close()
    }
  }
}

export function webappxaiModelPlugin() {
  return {
    name: 'webappxai-private-pilot',
    apply: 'serve',
    configureServer(server) {
      const config = server.config
      const settings = loadEnv(config.mode, config.envDir || config.root, 'WEBAPPXAI_')
      const authorize = createLocalAuthorizer(config.env)
      const served = [config.root, ...config.server.fs.allow]
      if (config.publicDir) served.push(config.publicDir)
      const read = createLocalReader(settings.WEBAPPXAI_MODEL_DIR, served, settings.WEBAPPXAI_PREVIOUS_MODEL_DIR)
      server.middlewares.use((request, response, next) => {
        if (!/^\/api\/webappxai(?:[/?]|$)/.test(request.url ?? '')) return next()
        return servePilotAsset(request, response, {
          authorize: token => loopbackAddresses.has(request.socket.remoteAddress) && authorize(token),
          read,
        })
      })
    },
  }
}
