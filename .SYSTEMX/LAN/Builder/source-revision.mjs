import { createHash } from 'node:crypto'

// Revisions identify exact bytes. Do not normalize source or line endings.
export function hashSourceRevision(content) {
  return createHash('sha256').update(content).digest('hex')
}

// Failure objects contain fixed guidance and hashes only; never echo a draft,
// source contents, or a supplied malformed precondition into a response/log.
export function checkSourceRevision(baseRevision, currentContent) {
  if (baseRevision === undefined) {
    return {
      statusCode: 428,
      code: 'SOURCE_REVISION_REQUIRED',
      error: 'Reload source before saving; baseRevision is required.',
    }
  }
  if (typeof baseRevision !== 'string' || baseRevision.length !== 64 || !/^[a-f0-9]{64}$/i.test(baseRevision)) {
    return {
      statusCode: 400,
      code: 'SOURCE_REVISION_INVALID',
      error: 'baseRevision must be a 64-character SHA-256 revision.',
    }
  }
  const revision = hashSourceRevision(currentContent)
  if (baseRevision.toLowerCase() !== revision) {
    return {
      statusCode: 409,
      code: 'SOURCE_REVISION_CONFLICT',
      error: 'Source changed since it was loaded. Reload source before saving.',
      currentRevision: revision,
    }
  }
  return { statusCode: 200, revision }
}
