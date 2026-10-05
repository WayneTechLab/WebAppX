import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'

export const LOOPBACK_HOST = '127.0.0.1'
export const IPV6_LOOPBACK_HOST = '::1'

function canBind(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    const finish = (available) => {
      probe.removeAllListeners()
      if (probe.listening) probe.close(() => resolve(available))
      else resolve(available)
    }

    probe.once('error', (error) => {
      // Some Windows/Linux environments disable IPv6 entirely. In that case
      // ::1 cannot reserve a port, so the IPv4 loopback result remains useful.
      if (host === IPV6_LOOPBACK_HOST && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) {
        finish(true)
        return
      }
      finish(false)
    })
    probe.once('listening', () => finish(true))
    probe.listen({ host, port })
  })
}

export async function isPortAvailable(port) {
  const ipv4 = await canBind(port, LOOPBACK_HOST)
  if (!ipv4) return false
  return canBind(port, IPV6_LOOPBACK_HOST)
}

export async function findAvailablePort(preferredPort, range = 30) {
  for (let port = preferredPort; port <= preferredPort + range; port += 1) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No loopback port available from ${preferredPort} to ${preferredPort + range}`)
}

export function validPort(value, label) {
  const port = Number.parseInt(String(value), 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid ${label}`)
  }
  return port
}

export function sessionPath(repoRoot) {
  return join(repoRoot, '.SYSTEMX', 'state', 'local-session.json')
}

export function writeSession(repoRoot, session) {
  const target = sessionPath(repoRoot)
  const temporary = `${target}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, target)
}

export function readSession(repoRoot) {
  const target = sessionPath(repoRoot)
  if (!existsSync(target)) return null
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch {
    return null
  }
}

export function clearSession(repoRoot, sessionId) {
  const current = readSession(repoRoot)
  if (!current || (sessionId && current.sessionId !== sessionId)) return false
  unlinkSync(sessionPath(repoRoot))
  return true
}

export function cleanStalePidFiles(repoRoot) {
  const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
  if (!existsSync(stateRoot)) return []
  const removed = []
  for (const name of readdirSync(stateRoot)) {
    if (!name.endsWith('.pid')) continue
    const target = join(stateRoot, name)
    let pid = 0
    try {
      pid = Number.parseInt(readFileSync(target, 'utf8').trim(), 10)
    } catch {
      pid = 0
    }
    if (!pid || pid === process.pid) continue
    try {
      process.kill(pid, 0)
    } catch {
      unlinkSync(target)
      removed.push(name)
    }
  }
  return removed
}

export function writePidFile(repoRoot, name, pid) {
  const stateRoot = join(repoRoot, '.SYSTEMX', 'state')
  const target = join(stateRoot, name)
  writeFileSync(target, `${pid}\n`, { mode: 0o600 })
  return target
}

export function removePidFile(repoRoot, name, pid) {
  const target = join(repoRoot, '.SYSTEMX', 'state', name)
  if (!existsSync(target)) return
  try {
    const recorded = Number.parseInt(readFileSync(target, 'utf8').trim(), 10)
    if (!pid || recorded === pid) unlinkSync(target)
  } catch {
    // Runtime cleanup must not hide the original process result.
  }
}
