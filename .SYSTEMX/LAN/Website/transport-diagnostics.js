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

const snapshotKeys = ['schemaVersion', 'limit', 'entries']
const completedKeys = ['transportId', 'method', 'category', 'status', 'durationMs']
const cancelledKeys = [...completedKeys, 'outcome']

function hasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function validEntry(entry) {
  const cancelled = entry?.outcome === 'cancelled'
  return hasExactKeys(entry, cancelled ? cancelledKeys : completedKeys)
    && validTransportId(entry.transportId) && transportMethods.has(entry.method) && routeCategories.has(entry.category)
    && (cancelled ? entry.status === null : Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599)
    && Number.isSafeInteger(entry.durationMs) && entry.durationMs >= 0
}

function policySummary(limits, policy) {
  const fits = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum
  const positive = value => value > 0 && fits(value, 1_000_000)
  const contains = (list, value) => Array.isArray(list) && list.length <= 64 && list.includes(value)
  const keyed = policy?.retry?.['idempotent-keyed']
  const reads = policy?.retry?.['read-only']
  const proposal = policy?.retry?.['fresh-proposal']
  const manual = policy?.retry?.['reconcile-before-retry']
  if (limits?.schemaVersion !== 1 || limits.scope !== 'local-session' || !positive(limits.maxInFlight)
    || !positive(limits.burst) || !positive(limits.refillPerSecond) || !fits(limits.inFlight, limits.maxInFlight)
    || !fits(limits.availableTokens, limits.burst) || policy?.schemaVersion !== 1
    || !contains(reads?.methods, 'Admitted GET or HEAD') || !contains(reads?.postRoutes, '/api/contracts/query')
    || keyed?.method !== 'POST' || keyed.route !== '/api/builder/record' || keyed.keyHeader !== 'Idempotency-Key'
    || keyed.keyFormat !== 'UUIDv4' || !positive(keyed.retentionHours) || !positive(keyed.maximumLiveKeys)
    || !contains(proposal?.routes, '/api/builder/source') || !contains(manual?.routes, '/api/builder/record')) return null
  return [
    ['Session budget', `${limits.inFlight} of ${limits.maxInFlight} slots in use. ${limits.availableTokens} of ${limits.burst} burst requests available, refilling at ${limits.refillPerSecond} per second.`],
    ['Exempt reads', 'Health, transport inspection and static files.'],
    ['Read again', 'Repeat a supported GET, HEAD or read-only query. After HTTP 429, wait for the Retry-After interval.'],
    ['Keyed record', `Resubmit the same record with the same UUIDv4 Idempotency-Key within ${keyed.retentionHours} hours. The workspace holds ${keyed.maximumLiveKeys} active keys. A changed payload conflicts.`],
    ['Other changes', 'Check current state before resubmitting an unkeyed change. For source or proposal commands, review a fresh revision or proposal first.'],
  ]
}

function attachPolicyRead(panel, request) {
  const button = panel.querySelector('#transport-policy-read')
  if (!button) return
  const status = panel.querySelector('#transport-policy-status')
  const summary = panel.querySelector('#transport-policy-summary')
  const doc = panel.ownerDocument
  let current

  function finish(read, state, message) {
    if (current !== read) return
    current = undefined
    clearTimeout(read.timer)
    if (state !== 'completed') read.controller.abort()
    status.dataset.state = state
    const kept = state !== 'completed' && summary.childElementCount ? ' Showing the last verified limits and rules.' : ''
    status.textContent = message + kept
    button.textContent = summary.childElementCount ? 'Refresh limits and retry rules' : 'Read limits and retry rules'
  }

  function cancel() {
    if (current) finish(current, 'cancelled', 'Policy read cancelled.')
  }

  async function load() {
    if (!panel.open) return
    if (current) return cancel()
    const read = { controller: new AbortController() }
    current = read
    status.dataset.state = 'pending'
    status.textContent = 'Reading limits and retry rules…'
    button.textContent = 'Cancel policy read'
    read.timer = setTimeout(() => finish(read, 'unavailable', 'Policy read timed out.'), readTimeoutMs)
    const options = { method: 'GET', mode: 'same-origin', redirect: 'error', signal: read.controller.signal }
    try {
      const [limits, policy] = await Promise.all([
        request('/api/transport/limits', options), request('/api/transport/policy', options),
      ])
      if (read !== current) return
      if (!panel.open) return cancel()
      const rows = policySummary(limits, policy)
      if (!rows) return finish(read, 'unavailable', 'Could not verify the service limits and retry rules.')
      summary.replaceChildren(...rows.flatMap(([label, text]) => {
        const term = doc.createElement('dt'), description = doc.createElement('dd')
        term.textContent = label
        description.textContent = text
        return [term, description]
      }))
      finish(read, 'completed', 'Limits and retry rules refreshed.')
    } catch (error) {
      if (read !== current) return
      if (!panel.open) return cancel()
      const message = [401, 403].includes(error?.status) ? 'Access refused. Reopen the local dashboard to renew your session.' : 'Limits and retry rules unavailable.'
      finish(read, 'unavailable', message + (validTransportId(error?.transportId) ? ` Request ${error.transportId}.` : ''))
    }
  }
  button.addEventListener('click', () => void load())
  panel.addEventListener('toggle', () => { if (!panel.open) cancel() })
  doc.defaultView?.addEventListener('pagehide', cancel)
}

export function attachTransportDiagnostics(panel, request) {
  if (!panel) return
  attachPolicyRead(panel, request)
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
      if (!hasExactKeys(snapshot, snapshotKeys) || snapshot.schemaVersion !== 1 || snapshot.limit !== diagnosticsLimit || !Array.isArray(snapshot.entries)
        || snapshot.entries.length > diagnosticsLimit || !snapshot.entries.every(validEntry)) {
        finish(read, 'unavailable', 'Invalid diagnostics response. Retry to read a fresh result.')
        return
      }
      const rows = snapshot.entries.map(({ method, category, status: httpStatus, outcome, durationMs, transportId }) => {
        const row = doc.createElement('li')
        const id = doc.createElement('code')
        id.textContent = transportId
        const result = outcome === 'cancelled' ? 'Cancelled' : `HTTP ${httpStatus}`
        row.append(`${method} · ${category} · ${result} · ${durationMs} ms`, id)
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
