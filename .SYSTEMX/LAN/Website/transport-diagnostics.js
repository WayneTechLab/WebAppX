const diagnosticsLimit = 64
const readTimeoutMs = 10_000
const transportMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'OTHER'])
const routeCategories = new Set([
  'health', 'status', 'contracts', 'identity', 'builder', 'fonts', 'auth',
  'tools', 'diagnostics', 'dashboard', 'assets', 'other',
])
const transportIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function validTransportId(id) {
  return typeof id === 'string' && id.length === 36 && transportIdPattern.test(id)
}

function validEntry(entry) {
  return entry && validTransportId(entry.transportId) && transportMethods.has(entry.method)
    && routeCategories.has(entry.category) && Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599
    && Number.isSafeInteger(entry.durationMs) && entry.durationMs >= 0
}

export function attachTransportDiagnostics(panel, request) {
  if (!panel) return
  const status = panel.querySelector('#transport-status')
  const readButton = panel.querySelector('#transport-read')
  const cancelButton = panel.querySelector('#transport-cancel')
  const entries = panel.querySelector('#transport-entries')
  const doc = panel.ownerDocument
  let pending

  function finish(read, state, message) {
    if (pending !== read) return
    pending = undefined
    clearTimeout(read.timer)
    if (state !== 'completed') read.controller.abort()
    const previous = state !== 'completed' && entries.childElementCount ? ' Showing the previous result.' : ''
    status.dataset.state = state
    status.textContent = message + previous + (read.transportId ? ` Request ${read.transportId}.` : '')
    readButton.textContent = state === 'completed' ? 'Refresh' : 'Retry'
    readButton.removeAttribute('aria-disabled')
    if (doc.activeElement === cancelButton) readButton.focus()
    cancelButton.hidden = true
  }

  function cancel() {
    if (pending) finish(pending, 'cancelled', 'Read cancelled.')
  }

  async function load() {
    if (!panel.open || pending) return
    const read = { controller: new AbortController() }
    pending = read
    status.dataset.state = 'pending'
    status.textContent = 'Reading recent local requests…'
    readButton.setAttribute('aria-disabled', 'true')
    cancelButton.hidden = false
    read.timer = setTimeout(() => finish(read, 'unavailable', 'Read timed out. Retry when the local service is ready.'), readTimeoutMs)
    try {
      const snapshot = await request('/api/transport/diagnostics', {
        method: 'GET', signal: read.controller.signal, mode: 'same-origin', redirect: 'error',
        onResponseHeaders(headers) {
          const id = headers.get('x-systemx-request-id')
          if (validTransportId(id)) read.transportId = id
        },
      })
      if (read !== pending) return
      if (!panel.open) return cancel()
      if (snapshot?.schemaVersion !== 1 || snapshot.limit !== diagnosticsLimit || !Array.isArray(snapshot.entries)
        || snapshot.entries.length > diagnosticsLimit || !snapshot.entries.every(validEntry)) {
        finish(read, 'unavailable', 'Invalid diagnostics response. Retry to read a fresh result.')
        return
      }
      const rows = snapshot.entries.map(({ method, category, status: httpStatus, durationMs, transportId }) => {
        const row = doc.createElement('li')
        const id = doc.createElement('code')
        id.textContent = transportId
        row.append(`${method} · ${category} · HTTP ${httpStatus} · ${durationMs} ms`, id)
        return row
      })
      entries.replaceChildren(...rows)
      entries.tabIndex = rows.length ? 0 : -1
      const count = rows.length === 1 ? '1 recent request.' : `${rows.length} recent requests.`
      finish(read, 'completed', rows.length ? `Read complete. ${count}` : 'Read complete. No recent requests.')
    } catch (error) {
      if (read !== pending) return
      if (!panel.open) return cancel()
      const message = [401, 403].includes(error?.status)
        ? 'Access refused. Reopen the local dashboard to renew your session, then retry.'
        : 'Diagnostics unavailable. Check the local service, then retry.'
      finish(read, 'unavailable', message)
    }
  }

  panel.addEventListener('toggle', () => { if (panel.open) void load(); else cancel() })
  readButton.addEventListener('click', () => void load())
  cancelButton.addEventListener('click', cancel)
  doc.defaultView?.addEventListener('pagehide', cancel)
}
