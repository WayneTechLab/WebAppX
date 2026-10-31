import path from 'node:path'
import { realpathSync } from 'node:fs'

/** Resolve both observations through the same native filesystem representation. */
export function isCanonicalRepositoryRoot(selected, observed, { pathApi = path, canonicalize = realpathSync } = {}) {
  if (typeof selected !== 'string' || typeof observed !== 'string' || !pathApi.isAbsolute(selected) || !pathApi.isAbsolute(observed)) return false
  return canonicalize(pathApi.resolve(selected)) === canonicalize(pathApi.resolve(observed))
}

/** Keep drive and UNC share roots intact before walking descendant components. */
export function absolutePathSegments(value, pathApi = path) {
  if (typeof value !== 'string' || !pathApi.isAbsolute(value)) {
    const error = new Error('Directory traversal requires an absolute native path.')
    error.code = 'STATE_PATH_REFUSED'
    throw error
  }
  const absolute = pathApi.normalize(value), root = pathApi.parse(absolute).root
  return { absolute, root, parts: absolute.slice(root.length).split(pathApi.sep).filter(Boolean) }
}
