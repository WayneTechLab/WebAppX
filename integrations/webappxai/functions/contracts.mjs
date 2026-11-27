import { createHash } from 'node:crypto'
import release from './release.json' with { type: 'json' }
import previousRelease from './previous-release.json' with { type: 'json' }

export const PILOT_REVISION = release.model.revision
export const PILOT_ASSETS = release.assets
export const PREVIOUS_REVISION = previousRelease.model.revision
export const legacyReleaseName = previousRelease.revision

export function releaseForRevision(revision) {
  if (revision === PILOT_REVISION) return release
  if (revision === PREVIOUS_REVISION) return previousRelease
  throw new Error('Unknown release')
}

const assetsByPath = new Map()
for (const [segment, descriptor] of [
  [PILOT_REVISION, release],
  [PREVIOUS_REVISION, previousRelease],
  [legacyReleaseName, previousRelease],
]) {
  for (const name of Object.keys(descriptor.assets)) {
    assetsByPath.set(`/api/webappxai/${segment}/${name}`, { name, descriptor })
  }
}

function fail(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

// Both gateways share the same routes and verify the entire pinned object before delivery.
export async function servePilotAsset(request, response, { authorize, read }) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Vary', 'Authorization')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  const route = assetsByPath.get(request.originalUrl ?? request.url)
  if (!route) return fail(response, 404, 'Unknown research pilot asset.')
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return fail(response, 405, 'Use GET to load the research pilot.')
  }
  const token = /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.authorization ?? '')?.[1]
  if (!token) return fail(response, 401, 'Sign in to load the research pilot.')
  try {
    if (!(await authorize(token))) return fail(response, 401, 'Sign in to load the research pilot.')
    if (response.destroyed) return
    const { name, descriptor } = route
    const asset = descriptor.assets[name]
    const bytes = await read(name, descriptor.model.revision)
    if (!Buffer.isBuffer(bytes) || bytes.length !== asset.bytes ||
        createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
      throw new Error('Unverified release')
    }
    if (response.destroyed) return
    response.writeHead(200, { 'Content-Type': asset.contentType, 'Content-Length': asset.bytes })
    response.end(bytes)
  } catch {
    if (!response.destroyed) fail(response, 503, 'The research pilot files are unavailable.')
  }
}
