import { lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

// A lexical allowlist is insufficient when a checkout contains symbolic links.
// Reject links in every descendant component before reading or replacing files.
export function confinedFile(root, candidate) {
  try {
    const base = resolve(root)
    const target = resolve(candidate)
    const suffix = relative(base, target)
    if (!suffix || isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) return null
    const parts = suffix.split(sep)
    let current = base
    for (let index = 0; index < parts.length; index += 1) {
      current = join(current, parts[index])
      const entry = lstatSync(current)
      if (entry.isSymbolicLink()) return null
      if (index < parts.length - 1 && !entry.isDirectory()) return null
      if (index === parts.length - 1 && !entry.isFile()) return null
    }
    const canonicalSuffix = relative(realpathSync(base), realpathSync(target))
    if (isAbsolute(canonicalSuffix) || canonicalSuffix === '..' || canonicalSuffix.startsWith(`..${sep}`)) return null
    return target
  } catch {
    return null
  }
}

export function confinedDirectory(root, candidate) {
  const base = resolve(root)
  const suffix = relative(base, resolve(candidate))
  if (isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) throw new Error('Directory outside LAN root')
  let current = base
  for (const part of suffix.split(sep).filter(Boolean)) {
    current = join(current, part)
    try { mkdirSync(current, { mode: 0o700 }) } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    const entry = lstatSync(current)
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('Linked or invalid LAN directory')
  }
  return current
}
