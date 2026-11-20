import { randomUUID } from 'node:crypto'
import { request } from 'node:http'
import { API_VERSION, getOperationDescriptor } from '../.SYSTEMX/LAN/Builder/api-contracts.mjs'
import { validateApiResponse } from '../.SYSTEMX/LAN/Builder/api-validation.mjs'
import { parsePublicJson } from './package-script-discovery.mjs'

export const isGraphOrigin = value => typeof value === 'string' && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(value)
  && Number(value.split(':').at(-1)) <= 65535

export class GraphConnectionError extends Error {}
const invalid = message => { throw new GraphConnectionError(message) }

// Use a direct IP socket. Redirects, DNS, proxy configuration and client input
// never determine where the dashboard session credential will be sent.
async function exchange(origin, path, session, payload) {
  const response = await new Promise((resolve, reject) => {
    const headers = session
      ? { Accept: 'application/json', 'Content-Type': 'application/json', 'x-systemx-session': session }
      : { Accept: 'text/html' }
    const req = request(origin + path, { method: session ? 'POST' : 'GET', headers, agent: false,
      signal: AbortSignal.timeout(5000) }, resolve)
    req.on('error', reject)
    req.end(session ? JSON.stringify(payload) : undefined)
  })
  try {
    const status = response.statusCode
    const mime = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    const editRefusal = path === '/api/graph/commands' && status >= 400 && status <= 499
    if ((status !== 200 && !editRefusal) || mime !== (session ? 'application/json' : 'text/html')) {
      invalid('The local LAN service refused the request or returned an unexpected response.')
    }
    const chunks = []
    let size = 0
    for await (const part of response) {
      size += part.length
      if (size > 2_000_000) invalid('The local LAN response exceeded 2 MB.')
      chunks.push(part)
    }
    const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    return { status, data: session ? parsePublicJson(body) : body }
  } finally { response.destroy() }
}

export async function openGraphConnection(origin) {
  if (!isGraphOrigin(origin)) invalid('Choose the direct loopback LAN origin with an explicit port.')
  const { data: html } = await exchange(origin, '/')
  const sessions = [...html.matchAll(/<meta name="systemx-session" content="([0-9a-f]{48})"\s*\/>/g)]
  const statuses = [...html.matchAll(/<script type="application\/json" id="systemx-status-data">([^<]*)<\/script>/g)]
  if (sessions.length !== 1 || statuses.length !== 1) invalid('Expected one valid session and workspace in the local LAN dashboard.')
  const workspace = parsePublicJson(statuses[0][1])?.repository?.workspaceId
  if (!/^[a-f0-9]{64}$/.test(workspace ?? '')) invalid('The local dashboard did not identify its workspace.')
  const session = sessions[0][1]
  async function query(operation, fields = {}) {
    const requestId = randomUUID()
    const { data } = await exchange(origin, '/api/contracts/query', session, {
      apiVersion: API_VERSION, requestId, kind: 'query', operation, payload: { type: operation, ...fields },
    })
    if (data?.apiVersion !== API_VERSION || data.requestId !== requestId || data.ok !== true) invalid('The local graph response did not match the requested read.')
    try { return validateApiResponse(getOperationDescriptor(operation), data.result, { endpoint: '/api/contracts/query' }) }
    catch { invalid('The local graph result failed its public response contract.') }
  }
  return { workspace, query, command: body => exchange(origin, '/api/graph/commands', session, body) }
}
