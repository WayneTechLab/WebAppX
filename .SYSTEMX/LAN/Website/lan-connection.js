import { validTransportId } from './transport-diagnostics.js'

const readOnlyPosts = new Set(['/api/contracts/query', '/api/identity/lookup', '/api/identity/inspect', '/api/identity/export'])

function transportError(code, message, transportId) {
  const id = validTransportId(transportId) ? transportId : null
  return Object.assign(new Error(message + (id ? ` Request ${id}.` : '')), { kind: 'transport', code, transportId: id })
}

function binding(status) {
  const workspace = status?.repository?.workspaceId
  const session = status?.session?.id
  return typeof workspace === 'string' && /^[a-f0-9]{64}$/.test(workspace) && typeof session === 'string'
    && session.length > 0 && session.length <= 256 ? { workspace, session } : null
}

export function createLanConnection(notify) {
  let context
  let state = 'ready'
  let generation = 0
  let check

  function change(next, message) {
    state = next
    notify(next, message)
  }

  async function readResponse(path, options, send) {
    const method = options.method ?? 'GET'
    if (state !== 'ready' && !['GET', 'HEAD'].includes(method) && !(method === 'POST' && readOnlyPosts.has(path))) {
      throw transportError('LAN_STATUS_REQUIRED', 'Changes are paused. Check the LAN connection before submitting.')
    }
    const started = generation
    let response, result, id
    try {
      response = await send()
      id = response.headers.get('x-systemx-request-id')
      options.onResponseHeaders?.(response.headers)
      try {
        result = await response.json()
      } catch (error) {
        // Retain an ordinary HTTP refusal even when the route has a text error.
        // A proxy error page or a broken successful body cannot confirm an operation.
        if (!(error instanceof SyntaxError) || response.ok || response.status >= 500) throw error
        result = {}
      }
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason ?? error
      const failure = transportError('LAN_CONNECTION_LOST', 'LAN response unavailable. Check the connection before submitting changes.', id)
      if (started === generation) {
        generation++
        check = undefined
        change('offline', failure.message)
      }
      throw failure
    }
    options.signal?.throwIfAborted()
    if (generation !== started) throw transportError('LAN_RESPONSE_SUPERSEDED', 'An earlier LAN response arrived after the connection changed.', id)
    return { response, result, transportId: validTransportId(id) ? id : null }
  }

  function reconnect(request) {
    if (check) return check
    if (state === 'ready') return Promise.resolve()
    const started = generation
    const signal = AbortSignal.timeout(10_000)
    change('checking', 'Checking the LAN connection…')
    const attempt = (async () => {
      try {
        const fresh = binding(await request('/api/status', { signal }))
        if (started !== generation) return
        if (!fresh || !context || fresh.workspace !== context.workspace || fresh.session !== context.session) {
          change('offline', 'Checkout or session could not be verified. Reopen the original LAN dashboard to continue.')
          return
        }
        // Status is publicly readable. An authenticated read also verifies the
        // original tab's credential after a process restart under the same session ID.
        const proof = await request('/api/transport/diagnostics', { signal })
        if (started !== generation) return
        if (proof?.schemaVersion !== 1 || proof.limit !== 64 || !Array.isArray(proof.entries)) {
          change('offline', 'The LAN session could not be verified. Check the connection again.')
          return
        }
        generation++
        change('ready', 'LAN connection restored. Review the last operation before submitting again.')
      } catch (error) {
        if (started === generation) {
          const message = error?.status === 403 || error?.status === 401
            ? 'LAN session expired. Reopen the original dashboard to continue.'
            : 'Connection check failed. Check the local service and try again.'
          change('offline', transportError('LAN_CHECK_FAILED', message, error?.transportId).message)
        }
      }
    })().finally(() => { if (check === attempt) check = undefined })
    check = attempt
    return check
  }

  return {
    get blocked() { return state !== 'ready' },
    get generation() { return generation },
    observeStatus(status) { if (state === 'ready') context = binding(status) },
    readResponse,
    reconnect,
  }
}
