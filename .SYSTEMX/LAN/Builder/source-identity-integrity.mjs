import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { constants, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { identityDigest } from './identity-core.mjs'

const unsafe = /\/(?:Users|Volumes|private|home|tmp|var)\/|[A-Za-z]:[\\/]|(?:sk_(?:live|test)_|rk_live_|sk-proj-|gh[pousr]_|github_pat_|xox[baprs]-)|AIza[0-9A-Za-z_-]{20,}|-----BEGIN|(?:password|secret|token|privateKey)\s*[:=]\s*['"]?[^\s'"]{8,}/i
function refuse(code = 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID') {
  throw Object.assign(new Error('Identity document integrity is unavailable or invalid. Export a new document from this workspace.'), { code })
}

export function assertSafeIdentityExport(value) {
  identityDigest(value) // Reject cycles, accessors, sparse or non-JSON metadata first.
  const visit = item => {
    if (typeof item === 'string') {
      if (unsafe.test(item) || /(?:^|\/)(?:node_modules|\.git|\.env)(?:\/|$)|(?:^|\/)\.SYSTEMX\/(?:state|local|LAN\/(?:Temp|Backup))(?:\/|$)/i.test(item)) refuse('SOURCE_IDENTITY_EXPORT_UNSAFE_METADATA')
    } else if (Array.isArray(item)) item.forEach(visit)
    else if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        if (/^(?:password|secret|token|api[_-]?key|private[_-]?key|credential|sessionToken|authorization|cookie)$/i.test(key)) refuse('SOURCE_IDENTITY_EXPORT_UNSAFE_METADATA')
        visit(child)
      }
    }
  }
  visit(value)
  return value
}

/** Host-local integrity only; it grants no source operation or provider permission. */
export function createIdentityExportIntegrity(root, workspaceId) {
  const canonicalRoot = realpathSync(root)
  function key(create) {
    let directory = canonicalRoot
    for (const part of ['.SYSTEMX', 'state', 'source-identity']) {
      directory = join(directory, part)
      if (!existsSync(directory)) {
        if (!create) refuse()
        try { mkdirSync(directory, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') refuse() }
      }
      const entry = lstatSync(directory)
      if (!entry.isDirectory() || entry.isSymbolicLink()) refuse()
      if (part === 'source-identity' && process.platform !== 'win32'
        && ((entry.mode & 0o077) !== 0 || entry.uid !== process.getuid())) refuse()
    }
    const file = join(directory, 'export-integrity.key')
    if (!existsSync(file) && create) {
      let fd
      try {
        fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
        writeFileSync(fd, randomBytes(32))
      } catch (error) { if (error.code !== 'EEXIST') refuse() }
      finally { if (fd !== undefined) closeSync(fd) }
    }
    let fd
    try {
      fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
      const entry = fstatSync(fd)
      if (!entry.isFile() || entry.size !== 32 || process.platform !== 'win32'
        && ((entry.mode & 0o077) !== 0 || entry.uid !== process.getuid())) refuse()
      return readFileSync(fd)
    } catch { refuse() }
    finally { if (fd !== undefined) closeSync(fd) }
  }
  const signature = (payload, material) => createHmac('sha256', material).update(identityDigest(payload)).digest('hex')
  return {
    seal(payload) {
      identityDigest(payload)
      if (payload?.workspaceId !== workspaceId || Object.hasOwn(payload, 'integrity')) refuse()
      assertSafeIdentityExport(payload)
      return { ...payload, integrity: { algorithm: 'hmac-sha256', value: signature(payload, key(true)) } }
    },
    verify(document) {
      identityDigest(document)
      if (!document || typeof document !== 'object' || Array.isArray(document) || document.workspaceId !== workspaceId) refuse()
      const { integrity, ...payload } = document
      if (!integrity || typeof integrity !== 'object' || Array.isArray(integrity)
        || Object.keys(integrity).some(name => !['algorithm', 'value'].includes(name))
        || integrity.algorithm !== 'hmac-sha256' || !/^[a-f0-9]{64}$/.test(integrity.value)) refuse()
      assertSafeIdentityExport(payload)
      const expected = signature(payload, key(false))
      if (!timingSafeEqual(Buffer.from(integrity.value, 'hex'), Buffer.from(expected, 'hex'))) refuse()
      return payload
    },
  }
}
