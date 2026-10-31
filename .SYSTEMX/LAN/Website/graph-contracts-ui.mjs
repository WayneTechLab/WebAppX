// Native, metadata-only inspector. The dashboard supplies the guarded LAN API
// adapter; this module never reads source bytes or changes preview geometry.
const MAX_JSON = 400000
const MAX_DISPLAY = 24000
const VERSION = '1.1'
const CONFIRM = Object.freeze({
  'graph.accept': 'ACCEPT GRAPH',
  'graph.reopen': 'REOPEN GRAPH',
  'graph.migrationApply': 'MIGRATE GRAPH COPY',
})
const instances = new WeakMap()

function node(tag, parent, { id, text, className, type } = {}) {
  const value = document.createElement(tag)
  if (id) value.id = id
  if (text !== undefined) value.textContent = text
  if (className) value.className = className
  if (type) value.type = type
  parent.append(value)
  return value
}

function field(parent, id, label, tag = 'input', { value, maxLength, options } = {}) {
  const wrapper = node('label', parent, { className: 'graph-contract-field' })
  const heading = node('span', wrapper, { id: `${id}-label`, text: label })
  const input = node(tag, wrapper, { id })
  input.setAttribute('aria-labelledby', heading.id)
  if (value !== undefined) input.value = value
  if (maxLength && tag !== 'select') input.maxLength = maxLength
  if (tag === 'input' || tag === 'textarea') input.autocomplete = 'off'
  for (const [optionValue, optionLabel] of options ?? []) {
    const option = node('option', input, { text: optionLabel })
    option.value = optionValue
  }
  return input
}

function button(parent, id, text) {
  return node('button', parent, { id, text, type: 'button' })
}

function section(parent, id, title, help) {
  const details = node('details', parent, { id, className: 'graph-contract-card' })
  node('summary', details, { text: title })
  const body = node('div', details, { className: 'graph-contract-card-body' })
  if (help) node('p', body, { className: 'graph-contract-help', text: help })
  return { details, body }
}

function view(parent, id, text) {
  const pre = node('pre', parent, { id, text })
  pre.tabIndex = 0
  return pre
}

function display(value) {
  const output = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return output.length > MAX_DISPLAY ? `${output.slice(0, MAX_DISPLAY)}\n… display limited; use the explicit export for complete public metadata.` : output
}

function parseJson(input, name) {
  if (input.value.length > MAX_JSON) throw new Error(`${name} exceeds the 400000-character review limit.`)
  try { return JSON.parse(input.value) }
  catch { throw new Error(`${name} must be valid JSON.`) }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function revision(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function publicId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,95}$/.test(value)
}

function response(value, requestId, apiVersion) {
  assert(object(value) && typeof value.apiVersion === 'string' && typeof value.ok === 'boolean', 'The API returned an invalid response envelope; the accepted view was kept.')
  if (requestId !== undefined) assert(value.requestId === requestId, 'The API response request identity did not match; the accepted view was kept.')
  if (value.ok) {
    assert(value.apiVersion === apiVersion && Object.hasOwn(value, 'result') && !Object.hasOwn(value, 'error'), 'The API success envelope did not match its request; the accepted view was kept.')
  } else {
    assert(object(value.error) && typeof value.error.category === 'string' && typeof value.error.code === 'string' && typeof value.error.message === 'string' && Array.isArray(value.error.findings) && value.error.findings.length <= 50 && Number.isSafeInteger(value.error.omittedCount) && value.error.omittedCount >= 0, 'The API error envelope was malformed; the accepted view was kept.')
  }
  return value
}

function refusal(value) {
  const error = new Error(`${value.error.category}/${value.error.code}: ${value.error.message.slice(0, 400)}`)
  error.contract = value
  return error
}

function styles() {
  if (document.querySelector('#graph-contracts-stylesheet')) return
  const link = node('link', document.head, { id: 'graph-contracts-stylesheet' })
  link.rel = 'stylesheet'
  link.href = new URL('./graph-contracts.css', import.meta.url).href
}

function download(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function attachGraphContractInspector({ container, api, getIdentityDocumentId, getWorkspaceId, onStatus } = {}) {
  if (!container || typeof container.append !== 'function' || typeof api !== 'function') {
    throw new TypeError('Graph inspector needs a container and a guarded API adapter.')
  }
  instances.get(container)?.destroy()
  styles()

  const root = node('details', container, { id: 'graph-contract-inspector', className: 'graph-contract-inspector' })
  root.open = true
  node('summary', root, { text: 'Graph and API contracts' })
  const body = node('div', root, { className: 'graph-contract-body' })
  node('p', body, { className: 'graph-contract-help', text: 'Canonical graph inspection is local metadata. Source references describe provenance and do not authorize a source edit. Preview, acceptance, migration and downloads are separate actions.' })
  const status = node('output', body, { id: 'graph-contract-status', text: 'No contract request sent.' })
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const errorView = view(body, 'graph-contract-error', 'No refusal or transport error.')
  errorView.setAttribute('aria-label', 'Last graph or contract refusal and bounded findings')

  const contractSection = section(body, 'contract-discovery-card', 'API discovery and request contracts', 'Select a version to inspect it. Version 2.0 is an intentional unsupported-version probe. Descriptors and examples are displayed locally; only Send request transmits the editable envelope.')
  contractSection.details.open = true
  const versionInput = field(contractSection.body, 'contract-version', 'Client API version', 'select', { options: [['1.1', '1.1 current'], ['1.0', '1.0 supported older'], ['2.0', '2.0 future refusal']] })
  const discoverButton = button(contractSection.body, 'contract-discover', 'Discover selected API version')
  const contractInfo = view(contractSection.body, 'contract-discovery', 'No discovery response yet.')
  const operationInput = field(contractSection.body, 'contract-operation', 'Contract operation', 'select', { options: [
    ['', 'Choose an operation'],
    ...['graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export', 'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply', 'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export'].map(id => [id, `${id} · ask server for availability`]),
  ] })
  const descriptorButton = button(contractSection.body, 'contract-describe', 'Inspect descriptor and synthetic examples')
  const descriptorView = view(contractSection.body, 'contract-descriptor', 'No descriptor selected. Examples are never sent by inspection.')
  const runner = field(contractSection.body, 'contract-runner-json', 'Editable query or command envelope JSON', 'textarea', { value: '{\n  "apiVersion": "1.1",\n  "requestId": "graph-ui-example",\n  "kind": "query",\n  "operation": "graph.status",\n  "payload": { "type": "graph.status" }\n}', maxLength: MAX_JSON })
  const sendRunner = button(contractSection.body, 'contract-send', 'Send editable envelope explicitly')
  const runnerView = view(contractSection.body, 'contract-runner-result', 'No editable request sent. Inspecting an example never sends it.')
  const beforeVersion = field(contractSection.body, 'contract-before-version', 'Compare from API version', 'select', { options: [['1.0', '1.0'], ['1.1', '1.1']] })
  const afterVersion = field(contractSection.body, 'contract-after-version', 'Compare to API version', 'select', { options: [['1.1', '1.1'], ['1.0', '1.0']] })
  const compareContracts = button(contractSection.body, 'contract-compare', 'Compare reviewed contract versions')
  const compatibilityView = view(contractSection.body, 'contract-compatibility', 'No compatibility comparison yet.')
  const exportContracts = button(contractSection.body, 'contract-export', 'Download public contract metadata')
  const evidence = view(contractSection.body, 'contract-evidence', 'Last API version, schema revision, effect and status appear here.')

  const graphSection = section(body, 'graph-import-card', 'Graph import, preview and acceptance', 'Paste a schema 1 graph JSON document or use the current accepted identity document ID. A preview has no accept side effect. Acceptance requires the exact digest, observed accepted revision and typed confirmation.')
  graphSection.details.open = true
  const importJson = field(graphSection.body, 'graph-import-json', 'Graph document JSON', 'textarea', { maxLength: MAX_JSON })
  const identityId = field(graphSection.body, 'graph-identity-id', 'Accepted identity document ID', 'input', { maxLength: 96 })
  const useIdentity = button(graphSection.body, 'graph-use-identity', 'Use current identity document ID')
  const previewButton = button(graphSection.body, 'graph-preview', 'Preview graph import')
  const previewView = view(graphSection.body, 'graph-preview-result', 'No graph proposal previewed.')
  const acceptConfirmation = field(graphSection.body, 'graph-accept-confirmation', 'Type ACCEPT GRAPH to accept preview', 'input', { maxLength: 64 })
  const acceptButton = button(graphSection.body, 'graph-accept', 'Accept exact graph proposal')

  const acceptedSection = section(body, 'graph-accepted-card', 'Accepted graph, findings and qualified lookup', 'The accepted graph stays visible after a failed request. Findings are filtered by server pagination and qualified lookups require workspace and document identity.')
  acceptedSection.details.open = true
  const refreshButton = button(acceptedSection.body, 'graph-refresh', 'Refresh accepted graph status')
  const documentInput = field(acceptedSection.body, 'graph-document-select', 'Accepted graph document', 'select', { options: [['', 'Choose an accepted document']] })
  const acceptedView = view(acceptedSection.body, 'graph-accepted-result', 'No accepted graph selected.')
  const severity = field(acceptedSection.body, 'graph-finding-severity', 'Finding severity', 'select', { options: [['', 'All severities'], ['error', 'Error'], ['warning', 'Warning'], ['info', 'Info']] })
  const findingObject = field(acceptedSection.body, 'graph-finding-object', 'Finding object ID (optional)', 'input', { maxLength: 96 })
  const referenceType = field(acceptedSection.body, 'graph-finding-reference-type', 'Finding reference type', 'select', { options: [['', 'All types'], ['node', 'Node'], ['page', 'Page'], ['component', 'Component'], ['collection', 'Collection']] })
  const findingOffset = field(acceptedSection.body, 'graph-finding-offset', 'Finding offset (0–10000)', 'input', { value: '0', maxLength: 5 })
  const findingLimit = field(acceptedSection.body, 'graph-finding-limit', 'Finding page size (1–50)', 'input', { value: '20', maxLength: 2 })
  const findingsButton = button(acceptedSection.body, 'graph-findings', 'Filter accepted findings')
  const findingsView = view(acceptedSection.body, 'graph-findings-result', 'No finding filter sent.')
  const lookupKind = field(acceptedSection.body, 'graph-lookup-kind', 'Lookup object kind', 'select', { options: [['node', 'Node'], ['page', 'Page'], ['component', 'Component'], ['collection', 'Collection'], ['reference', 'Reference']] })
  const lookupId = field(acceptedSection.body, 'graph-lookup-id', 'Lookup object ID', 'input', { maxLength: 96 })
  const lookupButton = button(acceptedSection.body, 'graph-lookup', 'Resolve qualified graph reference')
  const lookupView = view(acceptedSection.body, 'graph-lookup-result', 'No qualified lookup sent.')

  const historySection = section(body, 'graph-history-card', 'Accepted history, export and reopen', 'Compare only accepted revisions. Export is explicit and contains graph metadata. Reopen requires the exact current accepted revision and typed confirmation.')
  const beforeRevision = field(historySection.body, 'graph-before-revision', 'Before accepted graph revision', 'input', { maxLength: 64 })
  const afterRevision = field(historySection.body, 'graph-after-revision', 'After accepted graph revision', 'input', { maxLength: 64 })
  const compareButton = button(historySection.body, 'graph-compare', 'Compare accepted graph revisions')
  const compareView = view(historySection.body, 'graph-compare-result', 'No accepted revision comparison sent.')
  const graphExport = button(historySection.body, 'graph-export', 'Download selected graph export')
  const reopenJson = field(historySection.body, 'graph-reopen-json', 'Exported graph JSON to reopen', 'textarea', { maxLength: MAX_JSON })
  const reopenConfirmation = field(historySection.body, 'graph-reopen-confirmation', 'Type REOPEN GRAPH to reopen', 'input', { maxLength: 64 })
  const reopenButton = button(historySection.body, 'graph-reopen', 'Reopen exact exported graph')
  const historyView = view(historySection.body, 'graph-history-result', 'No export or reopen request sent.')

  const migrationSection = section(body, 'graph-migration-card', 'Isolated schema migration', 'Preview legacy schema 0 JSON and review ordered steps. Applying with typed confirmation creates an isolated copy; the copy must still be previewed and accepted as a normal graph proposal.')
  const migrationJson = field(migrationSection.body, 'graph-migration-json', 'Legacy schema 0 graph JSON', 'textarea', { maxLength: MAX_JSON })
  const migrationPreview = button(migrationSection.body, 'graph-migration-preview', 'Preview supported migration')
  const migrationView = view(migrationSection.body, 'graph-migration-result', 'No migration previewed.')
  const migrationConfirmation = field(migrationSection.body, 'graph-migration-confirmation', 'Type MIGRATE GRAPH COPY to apply isolated copy', 'input', { maxLength: 64 })
  const migrationApply = button(migrationSection.body, 'graph-migration-apply', 'Apply reviewed migration to isolated copy')

  const state = { destroyed: false, busy: false, serial: 0, importEdit: 0, migrationEdit: 0, version: VERSION, descriptors: new Map(), schemaRevision: null, workspaceId: null, documents: new Map(), selected: '', accepted: null, proposal: null, migration: null, lastStatus: 'idle', lastEffect: null, lastError: null, lastRequestId: null }
  const actions = [...root.querySelectorAll('button')]
  const selects = [...root.querySelectorAll('select')]
  const say = (message, details = null) => {
    if (state.destroyed) return
    status.textContent = message
    if (details !== null) errorView.textContent = display(details)
    if (typeof onStatus === 'function') {
      try { onStatus(message) } catch { /* A dashboard notification cannot change inspector state. */ }
    }
  }
  const fail = error => {
    if (state.destroyed) return
    const contract = error?.contract
    const message = contract ? `${contract.error.category}/${contract.error.code}: ${contract.error.message.slice(0, 400)}` : String(error?.message ?? 'Request failed.').slice(0, 400)
    say(`Refused: ${message}`, contract ? { requestId: contract.requestId, apiVersion: contract.apiVersion, ...contract.error } : { message })
    state.lastStatus = contract ? `${contract.error.category}/${contract.error.code}` : 'transport or local validation error'
    state.lastError = contract ? { requestId: contract.requestId, category: contract.error.category, code: contract.error.code } : { message }
    renderEvidence()
  }
  async function run(label, work) {
    if (state.destroyed || state.busy) return
    state.busy = true
    for (const action of actions) action.disabled = true
    for (const select of selects) select.disabled = true
    try {
      const result = await work()
      if (!state.destroyed) { state.lastStatus = 'success'; state.lastError = null; say(`${label} complete.`, { message: 'No refusal.' }); renderEvidence() }
      return result
    } catch (error) { fail(error); return undefined }
    finally {
      state.busy = false
      if (!state.destroyed) for (const action of actions) action.disabled = false
      if (!state.destroyed) for (const select of selects) select.disabled = false
    }
  }
  function renderEvidence(effect) {
    if (effect !== undefined) state.lastEffect = effect
    evidence.textContent = display({ apiVersion: state.version, schemaRevision: state.schemaRevision, effect: state.lastEffect, requestId: state.lastRequestId, status: state.lastStatus, error: state.lastError, selectedDocumentId: state.selected || null, acceptedRevision: state.accepted?.revision ?? null })
  }
  async function call(path, bodyValue, { requestId, apiVersion = state.version, allowError = false } = {}) {
    state.lastRequestId = requestId ?? null
    const result = response(await api(path, bodyValue), requestId, apiVersion)
    if (!result.ok && !allowError) throw refusal(result)
    return result
  }
  function nextId() { return `graph-ui-${++state.serial}` }
  async function query(operation, fields = {}) {
    const requestId = nextId()
    const envelope = { apiVersion: state.version, requestId, kind: 'query', operation, payload: { type: operation, ...fields } }
    return (await call('/api/contracts/query', envelope, { requestId })).result
  }
  function descriptorsFrom(result) {
    const values = result?.operations ?? result?.registry?.operations ?? result?.contracts?.operations
    return Array.isArray(values) ? values.filter(item => object(item) && typeof item.id === 'string' && ['query', 'command'].includes(item.kind)) : []
  }
  function loadDescriptors(result) {
    const descriptors = descriptorsFrom(result)
    if (!descriptors.length) return
    assert(descriptors.length <= 100 && descriptors.every(item => item.id.length <= 96), 'Discovery returned an unbounded operation list; the previous contract view was kept.')
    const map = new Map(descriptors.map(item => [item.id, item]))
    assert(map.size === descriptors.length, 'Discovery returned duplicate operation IDs; the previous contract view was kept.')
    state.descriptors.set(state.version, map)
    operationInput.replaceChildren()
    const blank = node('option', operationInput, { text: 'Choose an operation' }); blank.value = ''
    for (const descriptor of descriptors) {
      const option = node('option', operationInput, { text: `${descriptor.id} · ${descriptor.kind}${descriptor.implemented === false ? ' · unavailable' : ''}` })
      option.value = descriptor.id
    }
  }
  async function discover() {
    const result = (await call(`/api/contracts/discovery?clientVersion=${encodeURIComponent(state.version)}`, undefined, { apiVersion: state.version })).result
    assert(object(result), 'Discovery did not return public contract metadata.')
    state.schemaRevision = result.schemaRevision ?? result.registry?.schemaRevision ?? null
    loadDescriptors(result)
    if (!state.descriptors.get(state.version)?.size) {
      const listing = await query('contracts.list')
      loadDescriptors(listing)
      state.schemaRevision ??= listing?.schemaRevision ?? listing?.registry?.schemaRevision ?? null
    }
    contractInfo.textContent = display(result)
    renderEvidence('read-only discovery')
    return result
  }
  async function descriptor(operation) {
    let found = state.descriptors.get(state.version)?.get(operation)
    if (found) return found
    await discover()
    found = state.descriptors.get(state.version)?.get(operation)
    if (found) return found
    const result = await query('contracts.describe', { operation, version: state.version })
    found = result?.descriptor ?? result
    assert(object(found) && found.id === operation && found.kind === 'command', 'The selected version did not provide a usable command descriptor.')
    if (!state.descriptors.has(state.version)) state.descriptors.set(state.version, new Map())
    state.descriptors.get(state.version).set(operation, found)
    return found
  }
  async function command(operation, fields, confirmation = '', expectedRevision = null) {
    const selected = await descriptor(operation)
    assert(selected.implemented !== false && selected.kind === 'command' && typeof selected.capabilityId === 'string', `Command ${operation} is unavailable in API ${state.version}.`)
    const requestId = nextId()
    const envelope = { apiVersion: state.version, requestId, kind: 'command', operation, capabilityId: selected.capabilityId, payload: { type: operation, ...fields }, confirmation, expectedRevision }
    const result = (await call('/api/contracts/command', envelope, { requestId })).result
    renderEvidence(selected.effect ?? null)
    return result
  }
  async function readStatus() {
    const result = await query('graph.status')
    assert(object(result) && Array.isArray(result.documents) && result.documents.length <= 50 && revision(result.workspaceId), 'Graph status did not contain a bounded qualified document list.')
    const liveWorkspace = typeof getWorkspaceId === 'function' ? getWorkspaceId() : null
    assert(!liveWorkspace || liveWorkspace === result.workspaceId, 'Graph status belongs to another workspace; the previous accepted view was kept.')
    assert(!state.workspaceId || state.workspaceId === result.workspaceId, 'Graph status switched workspaces; the previous accepted view was kept. Remount the inspector for the new workspace.')
    assert(result.documents.every(item => object(item) && publicId(item.documentId) && revision(item.revision) && (item.sourceRevision === null || revision(item.sourceRevision)) && object(item.stats)), 'Graph status included an invalid accepted document; the previous accepted view was kept.')
    const nextDocuments = new Map(result.documents.map(item => [item.documentId, item]))
    assert(nextDocuments.size === result.documents.length, 'Graph status contained duplicate document IDs; the previous accepted view was kept.')
    state.workspaceId = result.workspaceId
    const oldSelected = state.selected
    state.documents = nextDocuments
    documentInput.replaceChildren()
    const empty = node('option', documentInput, { text: 'Choose an accepted document' }); empty.value = ''
    for (const item of state.documents.values()) {
      const option = node('option', documentInput, { text: `${item.documentId} · ${item.revision.slice(0, 12)}` })
      option.value = item.documentId
    }
    state.selected = state.documents.has(oldSelected) ? oldSelected : ''
    documentInput.value = state.selected
    if (state.accepted && (!state.selected || state.accepted.document?.documentId !== state.selected || state.accepted.revision !== state.documents.get(state.selected)?.revision)) {
      state.accepted = null
      acceptedView.textContent = 'Selected accepted graph changed or has a newer revision. Read the selected document to inspect it.'
    }
    return result
  }
  function selectedId() {
    assert(publicId(state.selected) && state.documents.has(state.selected), 'Select an accepted graph document first.')
    return state.selected
  }
  async function readSelected(documentId = selectedId()) {
    assert(publicId(documentId) && state.documents.has(documentId), 'Choose an accepted graph document first.')
    const result = await query('graph.document', { documentId })
    assert(object(result) && object(result.document) && result.document.documentId === documentId && result.document.workspaceId === state.workspaceId && revision(result.revision), 'The selected accepted graph response was invalid; the previous view was kept.')
    state.selected = documentId
    documentInput.value = documentId
    state.accepted = result
    acceptedView.textContent = display({ schemaVersion: result.document.schemaVersion, documentId, revision: result.revision, sourceRevision: result.document.sourceRevision, stats: result.stats, findings: result.findings, omittedCount: result.omittedCount })
    if (!afterRevision.value) afterRevision.value = result.revision
    renderEvidence('read-only graph document')
    return result
  }

  versionInput.addEventListener('change', () => {
    state.version = versionInput.value
    state.proposal = null
    state.migration = null
    state.schemaRevision = null
    previewView.textContent = 'Version changed. Preview again under the selected contract.'
    migrationView.textContent = 'Version changed. Preview migration again.'
    contractInfo.textContent = 'Discover this version to inspect its supported operations.'
    renderEvidence()
  })
  discoverButton.onclick = () => { void run('API discovery', discover) }
  descriptorButton.onclick = () => { void run('Contract descriptor inspection', async () => {
    const operation = operationInput.value
    assert(operation, 'Choose a contract operation first.')
    const result = await query('contracts.describe', { operation, version: state.version })
    const examples = await query('contracts.examples', { operation, version: state.version })
    descriptorView.textContent = display({ descriptor: result, syntheticExamplesNotSent: examples })
    renderEvidence('read-only contract inspection')
  }) }
  sendRunner.onclick = () => { void run('Editable contract request', async () => {
    const envelope = parseJson(runner, 'Editable envelope')
    assert(object(envelope), 'Editable envelope must be a JSON object. No request was sent.')
    const path = envelope.kind === 'command' ? '/api/contracts/command' : '/api/contracts/query'
    const result = await call(path, envelope, { requestId: typeof envelope.requestId === 'string' ? envelope.requestId : undefined, apiVersion: envelope.apiVersion, allowError: true })
    runnerView.textContent = display(result)
    if (!result.ok) throw refusal(result)
    renderEvidence('explicit contract request')
  }) }
  compareContracts.onclick = () => { void run('Contract compatibility comparison', async () => {
    const result = await query('contracts.compatibility', { beforeVersion: beforeVersion.value, afterVersion: afterVersion.value })
    compatibilityView.textContent = display(result)
    renderEvidence('read-only contract comparison')
  }) }
  exportContracts.onclick = () => { void run('Public contract export', async () => {
    const result = await query('contracts.export')
    assert(object(result), 'Public contract export response was invalid; no file was downloaded.')
    download(result, `webappx-contracts-${state.version.replace(/[^0-9.]/g, '')}.json`)
    renderEvidence('explicit public metadata download')
  }) }
  useIdentity.onclick = () => {
    if (typeof getIdentityDocumentId === 'function') identityId.value = String(getIdentityDocumentId() ?? '').slice(0, 96)
    state.importEdit += 1
    state.proposal = null
    previewView.textContent = 'Identity selection changed. Preview the import again.'
  }
  for (const input of [importJson, identityId]) input.addEventListener('input', () => {
    state.importEdit += 1
    state.proposal = null
    previewView.textContent = 'Input changed. Preview again before acceptance.'
  })
  previewButton.onclick = () => { void run('Graph import preview', async () => {
    state.proposal = null
    const edit = state.importEdit
    await readStatus()
    const hasJson = Boolean(importJson.value.trim())
    const hasIdentity = Boolean(identityId.value.trim())
    assert(hasJson !== hasIdentity, 'Provide exactly one graph JSON document or identity document ID.')
    const fields = hasJson ? { document: parseJson(importJson, 'Graph document') } : { identityDocumentId: identityId.value.trim() }
    const result = await command('graph.preview', fields)
    assert(object(result) && typeof result.digest === 'string' && publicId(result.documentId) && revision(result.revision) && object(result.document) && result.document.workspaceId === state.workspaceId && result.document.documentId === result.documentId, 'Graph preview did not return a qualified proposal; acceptance is unavailable.')
    assert(edit === state.importEdit, 'Graph input changed while preview was running. Preview again before acceptance.')
    state.proposal = { ...result, expectedRevision: state.documents.get(result.documentId)?.revision ?? null }
    previewView.textContent = display({ digest: result.digest, documentId: result.documentId, revision: result.revision, sourceRevision: result.sourceRevision, expectedRevision: state.proposal.expectedRevision, stats: result.stats, findings: result.findings, omittedCount: result.omittedCount })
  }) }
  acceptButton.onclick = () => { void run('Graph acceptance', async () => {
    const proposal = state.proposal
    assert(proposal && acceptConfirmation.value === CONFIRM['graph.accept'], 'Preview a graph and type ACCEPT GRAPH exactly before acceptance.')
    const result = await command('graph.accept', { digest: proposal.digest }, acceptConfirmation.value, proposal.expectedRevision)
    assert(object(result) && object(result.document) && result.document.documentId === proposal.documentId && result.document.workspaceId === state.workspaceId && revision(result.revision), 'Graph acceptance response was invalid; refresh status before relying on it.')
    if (proposal.expectedRevision) beforeRevision.value = proposal.expectedRevision
    afterRevision.value = result.revision
    state.proposal = null
    acceptConfirmation.value = ''
    state.selected = proposal.documentId
    state.accepted = result
    acceptedView.textContent = display({ schemaVersion: result.document.schemaVersion, documentId: state.selected, revision: result.revision, sourceRevision: result.document.sourceRevision, stats: result.stats, findings: result.findings, omittedCount: result.omittedCount })
    await readStatus()
    await readSelected()
  }) }
  refreshButton.onclick = () => { void run('Accepted graph refresh', async () => {
    await readStatus()
    if (state.selected) await readSelected()
  }) }
  documentInput.addEventListener('change', () => {
    const selected = documentInput.value
    if (!selected) { documentInput.value = state.selected; fail(new Error('Choose an accepted document to inspect.')); return }
    void run('Accepted graph read', () => readSelected(selected)).then(result => {
      if (!result && !state.destroyed) documentInput.value = state.selected
    })
  })
  findingsButton.onclick = () => { void run('Accepted finding filter', async () => {
    const offset = Number(findingOffset.value)
    const limit = Number(findingLimit.value)
    assert(/^\d+$/.test(findingOffset.value) && Number.isSafeInteger(offset) && offset <= 10000, 'Offset must be an integer from 0 to 10000.')
    assert(/^\d+$/.test(findingLimit.value) && Number.isSafeInteger(limit) && limit >= 1 && limit <= 50, 'Page size must be an integer from 1 to 50.')
    const fields = { documentId: selectedId(), offset, limit }
    if (severity.value) fields.severity = severity.value
    if (findingObject.value.trim()) fields.objectId = findingObject.value.trim()
    if (referenceType.value) fields.referenceType = referenceType.value
    findingsView.textContent = display(await query('graph.findings', fields))
  }) }
  lookupButton.onclick = () => { void run('Qualified graph lookup', async () => {
    const workspaceId = (typeof getWorkspaceId === 'function' ? getWorkspaceId() : null) || state.workspaceId
    assert(revision(workspaceId), 'A current workspace ID is required for qualified lookup.')
    assert(publicId(lookupId.value.trim()), 'Enter a valid graph object ID to look up.')
    lookupView.textContent = display(await query('graph.lookup', { workspaceId, documentId: selectedId(), id: lookupId.value.trim(), kind: lookupKind.value }))
  }) }
  compareButton.onclick = () => { void run('Accepted graph comparison', async () => {
    assert(revision(beforeRevision.value) && revision(afterRevision.value), 'Enter two complete accepted graph revisions.')
    compareView.textContent = display(await query('graph.compare', { documentId: selectedId(), beforeRevision: beforeRevision.value, afterRevision: afterRevision.value }))
  }) }
  graphExport.onclick = () => { void run('Graph export', async () => {
    const result = await query('graph.export', { documentId: selectedId() })
    assert(object(result) && result.format === 'webappx-graph' && object(result.document) && revision(result.revision), 'Graph export response was invalid; no file was downloaded.')
    download(result, `webappx-graph-${state.selected}.json`)
    historyView.textContent = display({ format: result.format, formatVersion: result.formatVersion, documentId: result.document.documentId, revision: result.revision, downloaded: true })
  }) }
  reopenButton.onclick = () => { void run('Graph reopen', async () => {
    assert(reopenConfirmation.value === CONFIRM['graph.reopen'], 'Type REOPEN GRAPH exactly before reopening.')
    const exported = parseJson(reopenJson, 'Exported graph document')
    assert(object(exported) && object(exported.document) && publicId(exported.document.documentId), 'Provide a graph export containing a document ID.')
    const expectedRevision = state.documents.get(exported.document.documentId)?.revision ?? null
    const result = await command('graph.reopen', { document: exported }, reopenConfirmation.value, expectedRevision)
    assert(object(result) && object(result.document) && result.document.documentId === exported.document.documentId && result.document.workspaceId === state.workspaceId && revision(result.revision), 'Reopen response was invalid; refresh status before relying on it.')
    if (expectedRevision) beforeRevision.value = expectedRevision
    afterRevision.value = result.revision
    reopenConfirmation.value = ''
    state.selected = result.document.documentId
    state.accepted = result
    acceptedView.textContent = display({ schemaVersion: result.document.schemaVersion, documentId: state.selected, revision: result.revision, sourceRevision: result.document.sourceRevision, stats: result.stats, findings: result.findings, omittedCount: result.omittedCount })
    await readStatus()
    await readSelected()
    historyView.textContent = display({ documentId: state.selected, revision: result.revision, reopened: true })
  }) }
  migrationJson.addEventListener('input', () => { state.migrationEdit += 1; state.migration = null; migrationView.textContent = 'Input changed. Preview migration again.' })
  migrationPreview.onclick = () => { void run('Schema migration preview', async () => {
    state.migration = null
    const edit = state.migrationEdit
    const result = await command('graph.migrationPreview', { document: parseJson(migrationJson, 'Legacy graph'), targetVersion: 1 })
    assert(object(result) && typeof result.digest === 'string' && result.fromVersion === 0 && result.toVersion === 1, 'Migration preview did not return a reviewed 0 to 1 transition.')
    assert(edit === state.migrationEdit, 'Legacy graph input changed while preview was running. Preview migration again.')
    state.migration = result
    migrationView.textContent = display({ digest: result.digest, fromVersion: result.fromVersion, toVersion: result.toVersion, steps: result.steps, unsupportedFields: result.unsupportedFields })
  }) }
  migrationApply.onclick = () => { void run('Isolated schema migration', async () => {
    assert(state.migration && migrationConfirmation.value === CONFIRM['graph.migrationApply'], 'Preview migration and type MIGRATE GRAPH COPY exactly.')
    const result = await command('graph.migrationApply', { digest: state.migration.digest }, migrationConfirmation.value)
    assert(object(result) && object(result.document) && result.isolatedCopy === true && revision(result.revision), 'Migration apply did not return an isolated graph copy.')
    importJson.value = JSON.stringify(result.document, null, 2)
    identityId.value = ''
    state.proposal = null
    state.migration = null
    migrationConfirmation.value = ''
    migrationView.textContent = display({ isolatedCopy: true, revision: result.revision, nextAction: 'Review the graph JSON field, then click Preview graph import and accept its new proposal explicitly.' })
  }) }

  const controller = {
    refresh: () => run('Graph and API refresh', async () => { await discover(); await readStatus(); if (state.selected) await readSelected() }),
    destroy: () => { if (state.destroyed) return; state.destroyed = true; root.remove(); if (instances.get(container) === controller) instances.delete(container) },
  }
  instances.set(container, controller)
  renderEvidence()
  return controller
}
