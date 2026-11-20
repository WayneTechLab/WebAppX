import { validTransportId } from './transport-diagnostics.js'

const operations = new Map([
  ['GET /api/builder/source', 'Source read'], ['POST /api/builder/source', 'Source save'],
  ['GET /api/contracts/discovery', 'Contract discovery'], ['POST /api/contracts/query', 'Graph query'],
  ['POST /api/contracts/command', 'Graph command'],
])
const readOperations = new Set(['Source read', 'Contract discovery', 'Graph query'])
const dispositions = new Set(['read-only', 'fresh-proposal', 'reconcile-before-retry', 'not-applicable'])
const states = {
  pending: 'pending', completed: 'completed', refused: 'refused', cancelled: 'cancelled', unavailable: 'unconfirmed',
}

function retryGuidance(operation, disposition) {
  if (disposition === 'not-applicable') return 'Check session access and the request before retrying.'
  if (!readOperations.has(operation)) {
    return disposition === 'fresh-proposal' ? 'Review a fresh revision or proposal before resubmitting.' : 'Verify current state before resubmitting.'
  }
  return disposition === 'read-only' ? 'Safe to repeat this read.' : 'Check the connection before reading again.'
}

// Observe the real request and return its original response or error. Only
// reviewed operation labels, response headers, and the newest read own the UI.
export function createRequestFeedback(publish) {
  let newest
  return async function observe(path, options, send) {
    const query = path.indexOf('?')
    const route = query < 0 ? path : path.slice(0, query)
    const operation = operations.get((options.method ?? 'GET') + ' ' + route)
    if (!operation) return send(options)
    const owner = {}
    newest = owner
    let transportId, disposition, retryAfter, settled = false
    function render(state, status) {
      if (settled || owner !== newest) return
      settled = state !== 'pending'
      const http = Number.isInteger(status) && status >= 100 && status <= 599 ? ` (HTTP ${status})` : ''
      const wait = status === 429 && retryAfter ? ` Wait ${retryAfter} s before another attempt.` : ''
      const advice = settled ? ' ' + retryGuidance(operation, disposition) + wait : ''
      publish(state, `Last request · ${operation} ${states[state]}${http}.${advice}${transportId ? ' Request ' + transportId + '.' : ''}`)
    }
    const cancel = () => render('cancelled')
    render('pending')
    if (options.signal?.aborted) cancel()
    else options.signal?.addEventListener('abort', cancel, { once: true })
    try {
      const result = await send({ ...options, onResponseHeaders(headers) {
        if (!settled && owner === newest) {
          const id = headers.get('x-systemx-request-id')
          transportId = validTransportId(id) ? id : undefined
          const retry = headers.get('x-systemx-retry')
          disposition = dispositions.has(retry) ? retry : undefined
          const seconds = headers.get('retry-after')
          retryAfter = typeof seconds === 'string' && /^[1-9]\d{0,4}$/.test(seconds) ? Number(seconds) : undefined
          render('pending')
        }
        options.onResponseHeaders?.(headers)
      } })
      if (options.signal?.aborted) cancel()
      else if (result.response.status >= 500) render('unavailable', result.response.status)
      else render(result.response.ok && result.result?.ok !== false ? 'completed' : 'refused', result.response.status)
      return result
    } catch (error) {
      if (options.signal?.aborted || error?.code === 'LAN_RESPONSE_SUPERSEDED') cancel()
      else render('unavailable')
      throw error
    } finally {
      options.signal?.removeEventListener('abort', cancel)
    }
  }
}
