// The inspector only handles reviewed metadata. Source bytes and saves remain in
// the controlled editor owned by the dashboard.
const IDENTITY_CONFIRMATION = 'ACCEPT IDENTITY MAP'
const OWNERSHIP_CONFIRMATION = 'ACCEPT OWNERSHIP CHANGE'
const REOPEN_CONFIRMATION = 'REOPEN IDENTITY DOCUMENT'
const instances = new WeakMap()

function make(tag, parent, { id, text, className, type } = {}) {
  const node = document.createElement(tag)
  if (id) node.id = id
  if (text !== undefined) node.textContent = text
  if (className) node.className = className
  if (type) node.type = type
  parent.append(node)
  return node
}

function control(parent, id, label, tag = 'input', options = {}) {
  const wrapper = make('label', parent, { className: 'identity-field' })
  const title = make('span', wrapper, { text: label })
  title.id = `${id}-label`
  const node = make(tag, wrapper, { id })
  node.setAttribute('aria-labelledby', title.id)
  if (options.placeholder) node.placeholder = options.placeholder
  if (options.maxLength) node.maxLength = options.maxLength
  if (options.value !== undefined) node.value = options.value
  if (tag !== 'select') node.autocomplete = 'off'
  return node
}

function button(parent, id, label) {
  return make('button', parent, { id, text: label, type: 'button' })
}

function view(parent, id, initial) {
  const node = make('pre', parent, { id, text: initial })
  node.tabIndex = 0
  return node
}

function section(parent, title, help) {
  const block = make('section', parent, { className: 'identity-section' })
  make('h3', block, { text: title })
  if (help) make('p', block, { text: help, className: 'identity-help' })
  return block
}

function json(value) {
  return JSON.stringify(value, null, 2)
}

function requestBody(value) {
  return { method: 'POST', body: JSON.stringify(value) }
}

function workspaceOf(value) {
  return value?.workspaceId ?? value?.map?.workspaceId ?? value?.proposal?.map?.workspaceId
    ?? value?.report?.workspaceId ?? value?.document?.workspaceId ?? null
}

function documentOf(value) {
  return { map: value?.map ?? value?.document?.map ?? null, ownership: value?.ownership ?? value?.document?.ownership ?? null }
}

function errorText(error) {
  const code = typeof error?.code === 'string' ? `${error.code}: ` : ''
  const message = typeof error?.message === 'string' ? error.message : 'The request was refused.'
  return `${code}${message.slice(0, 400)}`
}

function parseArray(controlNode, label) {
  if (controlNode.value.length > 400000) throw new Error(`${label} exceeds the bounded review input limit.`)
  let value
  try { value = JSON.parse(controlNode.value.trim() || '[]') }
  catch { throw new Error(`${label} must be valid JSON.`) }
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`)
  return value
}

function validPatch(patch) {
  return patch && Number.isSafeInteger(patch.start) && patch.start >= 0
    && Number.isSafeInteger(patch.end) && patch.end >= patch.start
    && typeof patch.replacement === 'string'
}

function safePath(selectedPath) {
  try {
    const value = selectedPath()
    return typeof value === 'string' ? value.trim() : ''
  }
  catch { return '' }
}

function cssOnce() {
  if (document.querySelector('#source-identity-stylesheet')) return
  const link = document.createElement('link')
  link.id = 'source-identity-stylesheet'
  link.rel = 'stylesheet'
  link.href = new URL('./identity-inspector.css', import.meta.url).href
  document.head.append(link)
}

export function attachSourceIdentityInspector({ container, api, selectedPath, onStageLiteral } = {}) {
  if (!container || typeof container.append !== 'function' || typeof api !== 'function' || typeof selectedPath !== 'function') {
    throw new TypeError('Identity inspector needs a container, API request function and selectedPath callback.')
  }
  instances.get(container)?.destroy()
  cssOnce()

  const root = make('details', container, { id: 'source-identity-panel', className: 'source-identity-inspector' })
  root.open = true
  make('summary', root, { text: 'Source identity and ownership' })
  const body = make('div', root, { className: 'identity-body' })
  make('p', body, { className: 'identity-help', text: 'Local imported source stays authoritative. Preview and accept metadata explicitly; literal changes use the controlled source editor.' })
  const status = make('output', body, { id: 'identity-status', text: 'No identity status read yet.' })
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('role', 'status')
  const refreshStatus = button(body, 'identity-refresh-status', 'Refresh accepted identity status')

  const importSection = section(body, 'Import and reconcile', 'The selected eligible source is read only when you choose Preview. Rename and alias proposals require review before acceptance.')
  const renameFrom = control(importSection, 'identity-rename-from', 'Previous canonical path for a reviewed rename', 'input', { placeholder: 'src/pages/OldPage.tsx', maxLength: 512 })
  const aliases = control(importSection, 'identity-aliases-json', 'Retired node aliases JSON array', 'textarea', { value: '[]', maxLength: 400000 })
  const importActions = make('div', importSection, { className: 'identity-actions' })
  const importPreview = button(importActions, 'identity-import-preview', 'Preview identity import')
  const identityConfirmation = control(importSection, 'identity-confirmation', `Type ${IDENTITY_CONFIRMATION} to accept`, 'input', { maxLength: 64 })
  const identityAccept = button(importSection, 'identity-accept', 'Accept identity map')
  const summary = view(importSection, 'identity-summary', 'No import preview or accepted document.')
  summary.setAttribute('aria-label', 'Identity map and reconciliation summary')

  const inspectSection = section(body, 'Inspect an accepted node', 'References include workspace, document and node IDs. Preview DOM elements without a declared mapping remain unmapped.')
  const nodeSelect = control(inspectSection, 'identity-node-select', 'Durable node', 'select')
  const nodeDetail = view(inspectSection, 'identity-node-detail', 'Accept or reopen a document, then select a node.')
  nodeDetail.setAttribute('aria-label', 'Qualified node identity and source ownership')

  const exportSection = section(body, 'Export and reopen', 'Export downloads bounded metadata. Reopen checks the selected workspace and current source revision.')
  const exportButton = button(exportSection, 'identity-export', 'Download identity document JSON')
  const reopenJson = control(exportSection, 'identity-reopen-json', 'Identity document JSON to reopen', 'textarea', { placeholder: '{ "schemaVersion": 1, "kind": "systemx-source-document", ... }', maxLength: 400000 })
  const reopenConfirmation = control(exportSection, 'identity-reopen-confirmation', `Type ${REOPEN_CONFIRMATION} to reopen`, 'input', { maxLength: 64 })
  const reopenButton = button(exportSection, 'identity-reopen', 'Reopen identity document')

  const ownerSection = section(body, 'Ownership proposal', 'Claims are reviewed metadata. They cannot enable an unsupported source operation.')
  const ownershipJson = control(ownerSection, 'identity-ownership-json', 'Ownership changes JSON array', 'textarea', { value: '[]', maxLength: 400000 })
  const ownerActions = make('div', ownerSection, { className: 'identity-actions' })
  const ownershipPreview = button(ownerActions, 'identity-ownership-preview', 'Preview ownership change')
  const ownershipConfirmation = control(ownerSection, 'identity-ownership-confirmation', `Type ${OWNERSHIP_CONFIRMATION} to accept`, 'input', { maxLength: 64 })
  const ownershipAccept = button(ownerSection, 'identity-ownership-accept', 'Accept ownership change')
  const ownerDetail = view(ownerSection, 'identity-ownership-detail', 'No ownership report or proposal.')
  ownerDetail.setAttribute('aria-label', 'Ownership modes, provenance and coverage')

  const operationSection = section(body, 'Literal operation proposal', 'Preview verifies the mapped span and current source revision. Staging sends the patch to the dashboard editor for its own review and confirmation.')
  const operationText = control(operationSection, 'identity-operation-text', 'Replacement literal text', 'textarea', { maxLength: 400000 })
  const operationActions = make('div', operationSection, { className: 'identity-actions' })
  const operationPreview = button(operationActions, 'identity-operation-preview', 'Preview literal operation')
  const stageOperation = button(operationActions, 'identity-stage-operation', 'Stage in controlled editor')
  stageOperation.hidden = typeof onStageLiteral !== 'function'
  const operationDetail = view(operationSection, 'identity-operation-detail', 'Select an accepted node and enter literal text to preview an operation.')
  operationDetail.setAttribute('aria-label', 'Literal operation refusal or impact and exact patch')

  const state = {
    destroyed: false,
    path: safePath(selectedPath),
    workspaceId: null,
    map: null,
    ownership: null,
    readState: 'not checked',
    statusDocuments: [],
    message: 'No identity status read yet.',
    preview: null,
    previewOwnership: null,
    ownershipProposal: null,
    operation: null,
    inspection: null,
    nodeId: '',
    epoch: 0,
    workspaceVersion: 0,
    sequence: Object.create(null),
    busy: new Map(),
    previewEdit: 0,
    ownerEdit: 0,
    operationEdit: 0,
    nodeEdit: 0,
    authorityVersion: 0,
  }

  function clearAuthority() {
    state.map = null
    state.ownership = null
    state.readState = 'not checked'
    state.preview = null
    state.previewOwnership = null
    state.ownershipProposal = null
    state.operation = null
    state.inspection = null
    state.nodeId = ''
    state.busy.clear()
  }

  function syncPath() {
    const path = safePath(selectedPath)
    if (path === state.path) return
    state.path = path
    state.epoch += 1
    clearAuthority()
    state.message = path ? 'Selected path changed. Read status or preview this path explicitly; input drafts were retained.' : 'Select an eligible source path to preview an identity import.'
    render()
  }

  function setWorkspace(workspaceId) {
    if (typeof workspaceId !== 'string' || !/^[0-9a-f]{64}$/.test(workspaceId)) return false
    if (state.workspaceId && state.workspaceId !== workspaceId) {
      state.epoch += 1
      state.workspaceVersion += 1
      clearAuthority()
      state.statusDocuments = []
      state.workspaceId = workspaceId
      state.message = 'Workspace changed. Previous references and proposals were cleared; input drafts were retained.'
      render()
      return true
    }
    if (!state.workspaceId) state.workspaceVersion += 1
    state.workspaceId = workspaceId
    return false
  }

  function selectedReference() {
    if (!state.map || !state.nodeId) return null
    return { workspaceId: state.map.workspaceId, documentId: state.map.documentId, nodeId: state.nodeId }
  }

  function acceptedForPath() {
    return Boolean(state.map && state.map.sourcePath === state.path && state.map.workspaceId === state.workspaceId)
  }

  function renderNodes() {
    const wanted = state.nodeId
    const first = document.createElement('option')
    first.value = ''
    first.textContent = 'Select an accepted node'
    const options = [first]
    if (acceptedForPath() && Array.isArray(state.map.nodes)) {
      for (const node of state.map.nodes) {
        if (typeof node?.id !== 'string') continue
        const option = document.createElement('option')
        option.value = node.id
        option.textContent = `${node.label || node.tag || 'Node'} · ${node.id}`
        options.push(option)
      }
    }
    nodeSelect.replaceChildren(...options)
    nodeSelect.value = options.some(option => option.value === wanted) ? wanted : ''
    if (nodeSelect.value !== wanted) state.nodeId = ''
  }

  function render() {
    if (state.destroyed) return
    status.textContent = `Workspace: ${state.workspaceId ?? 'not read'}\nSelected path: ${state.path || 'none'}\n${state.message}`
    const map = acceptedForPath() ? state.map : null
    const coverage = state.ownership?.coverage ?? null
    const preview = state.preview
    summary.textContent = json({
      accepted: map ? {
        workspaceId: map.workspaceId, documentId: map.documentId, pageId: map.pageId,
        sourcePath: map.sourcePath, sourceRevision: map.sourceRevision, ruleVersion: map.ruleVersion,
        nodeCount: Array.isArray(map.nodes) ? map.nodes.length : 0,
        orphaned: map.orphaned ?? [], warnings: map.warnings ?? [],
      } : null,
      readState: state.readState,
      coverage,
      proposalCoverage: state.previewOwnership?.coverage ?? null,
      preview: preview ? {
        workspaceId: workspaceOf(preview), digest: preview.digest, sourcePath: preview.map?.sourcePath,
        documentId: preview.map?.documentId, pageId: preview.map?.pageId,
        sourceRevision: preview.map?.sourceRevision, ruleVersion: preview.map?.ruleVersion,
        counts: preview.counts, preserved: preview.preserved, added: preview.added,
        retired: preview.retired, ambiguous: preview.ambiguous, orphans: preview.orphans,
        rename: preview.rename, migration: preview.migration,
        warnings: preview.map?.warnings, requiresReview: preview.requiresReview,
      } : null,
    })
    renderNodes()
    const ref = selectedReference()
    const node = map?.nodes?.find(item => item.id === state.nodeId)
    const owner = state.ownership?.objects?.find(item => item.nodeId === state.nodeId)
    nodeDetail.textContent = ref ? json({
      reference: ref,
      identity: node ? { confidence: node.confidence, anchor: node.anchor, signature: node.signature, parentId: node.parentId, tag: node.tag, label: node.label, source: node.source, fields: node.fields, opaque: node.opaque, external: node.external, definition: node.definition } : null,
      ownership: owner ?? { mode: 'unmapped', status: 'unmapped', reasons: ['No accepted owner mapping for this node.'] },
      inspection: state.inspection,
      stale: state.readState === 'stale' || owner?.status === 'stale',
    }) : 'Accept or reopen a document, then select a node. Unmapped preview elements have no source-write authority.'
    ownerDetail.textContent = json({
      documentId: map?.documentId ?? null,
      sourceRevision: map?.sourceRevision ?? null,
      readState: state.readState,
      coverage,
      claims: state.ownership?.claims ?? [],
      selectedObject: owner ?? null,
      proposal: state.ownershipProposal,
    })
    operationDetail.textContent = state.operation ? json({
      reference: ref, sourcePath: map?.sourcePath, expectedRevision: map?.sourceRevision,
      sharedDefinition: node?.definition ?? null, proposal: state.operation,
    }) : 'Select an accepted node and enter literal text to preview an operation. No source is changed by preview.'

    const pending = state.busy.size > 0
    refreshStatus.disabled = pending
    importPreview.disabled = !state.path || pending
    identityAccept.disabled = !preview || identityConfirmation.value !== IDENTITY_CONFIRMATION || pending
    nodeSelect.disabled = !map || pending
    exportButton.disabled = !map || pending
    reopenButton.disabled = !reopenJson.value.trim() || reopenConfirmation.value !== REOPEN_CONFIRMATION || pending
    ownershipPreview.disabled = !map || pending
    ownershipAccept.disabled = !state.ownershipProposal || ownershipConfirmation.value !== OWNERSHIP_CONFIRMATION || pending
    operationPreview.disabled = !map || !state.nodeId || !operationText.value || pending
    stageOperation.disabled = typeof onStageLiteral !== 'function' || !state.operation?.allowed || !validPatch(state.operation?.patch)
      || !map || !['current source read', 'accepted at checked source revision', 'reopened at checked source revision'].includes(state.readState) || pending
  }

  function begin(kind) {
    syncPath()
    const serial = (state.sequence[kind] ?? 0) + 1
    state.sequence[kind] = serial
    state.busy.set(kind, serial)
    const capture = { kind, serial, epoch: state.epoch, path: state.path, workspaceId: state.workspaceId, workspaceVersion: state.workspaceVersion }
    state.message = `${kind} request pending. Input drafts remain editable.`
    render()
    return capture
  }

  function current(capture) {
    syncPath()
    return !state.destroyed && state.sequence[capture.kind] === capture.serial
      && state.epoch === capture.epoch && state.path === capture.path && state.workspaceVersion === capture.workspaceVersion
      && (!capture.workspaceId || state.workspaceId === capture.workspaceId)
  }

  async function run(kind, request, receive, versionIsCurrent = () => true) {
    const capture = begin(kind)
    try {
      const result = await request()
      if (!current(capture) || !versionIsCurrent()) return
      const workspaceId = workspaceOf(result)
      if (setWorkspace(workspaceId)) return
      // The first valid response may establish the workspace for this action.
      // Keep its own validation/error path current without reviving older calls.
      capture.workspaceVersion = state.workspaceVersion
      capture.workspaceId = state.workspaceId
      receive(result)
    } catch (error) {
      if (current(capture) && versionIsCurrent()) state.message = errorText(error)
    } finally {
      if (state.busy.get(kind) === capture.serial) state.busy.delete(kind)
      render()
    }
  }

  async function refresh() {
    const capture = begin('refresh')
    let observedEpoch = capture.epoch
    let observedWorkspaceVersion = capture.workspaceVersion
    const authorityVersion = state.authorityVersion
    try {
      const result = await api('/api/identity/status')
      if (!current(capture) || state.authorityVersion !== authorityVersion) return
      setWorkspace(result?.workspaceId)
      // A workspace switch invalidates the original capture. Continue only with
      // this new, explicit status result and the same selected path.
      const epoch = state.epoch
      observedEpoch = epoch
      observedWorkspaceVersion = state.workspaceVersion
      const path = state.path
      state.statusDocuments = Array.isArray(result?.documents) ? result.documents : []
      const selected = state.statusDocuments.find(item => item?.sourcePath === path)
      if (!selected) {
        state.map = null
        state.ownership = null
        state.inspection = null
        state.nodeId = ''
        state.readState = 'no accepted document for selected path'
        state.message = `${state.statusDocuments.length} accepted document(s) in this workspace. No selected document was imported.`
        return
      }
      const read = await api(`/api/identity/document?documentId=${encodeURIComponent(selected.documentId)}`)
      syncPath()
      if (state.destroyed || state.epoch !== epoch || state.workspaceVersion !== observedWorkspaceVersion || state.path !== path || state.sequence.refresh !== capture.serial || state.authorityVersion !== authorityVersion) return
      const readWorkspace = workspaceOf(read)
      if (readWorkspace && readWorkspace !== state.workspaceId) {
        setWorkspace(readWorkspace)
        return
      }
      const { map, ownership } = documentOf(read)
      if (!map || map.sourcePath !== path || map.workspaceId !== state.workspaceId) throw new Error('Selected identity document did not match the current workspace and path.')
      state.map = map
      state.ownership = ownership
      const staleCount = Number(ownership?.coverage?.stale ?? 0)
      state.readState = read?.stale || staleCount > 0 ? 'stale' : 'current source read'
      state.message = `Accepted document ${map.documentId} read. ${state.readState}.`
    } catch (error) {
      syncPath()
      if (!state.destroyed && state.epoch === observedEpoch && state.workspaceVersion === observedWorkspaceVersion && state.path === capture.path && state.sequence.refresh === capture.serial) {
        state.readState = 'read failed; current mapping unverified'
        state.message = errorText(error)
      }
    } finally {
      if (state.busy.get('refresh') === capture.serial) state.busy.delete('refresh')
      render()
    }
  }

  function previewImport() {
    syncPath()
    if (!state.path) { state.message = 'Select an eligible canonical source path first.'; render(); return }
    let aliasChanges
    try { aliasChanges = parseArray(aliases, 'Aliases') }
    catch (error) { state.message = errorText(error); render(); return }
    const version = state.previewEdit
    const path = state.path
    const rename = renameFrom.value.trim() || null
    void run('preview', () => api('/api/identity/preview', requestBody({ path, renameFrom: rename, aliases: aliasChanges })), result => {
      const proposal = result?.proposal ?? result
      if (!proposal?.digest || !proposal?.map || proposal.map.sourcePath !== state.path) throw new Error('Identity preview response lacks the selected document proposal.')
      state.preview = proposal
      state.previewOwnership = result?.ownership ?? proposal?.ownership ?? null
      state.ownershipProposal = null
      state.operation = null
      state.message = `Identity preview ${proposal.digest} is ready. Review counts and unresolved candidates before acceptance.`
    }, () => version === state.previewEdit)
  }

  function acceptImport() {
    const proposal = state.preview
    if (!proposal || identityConfirmation.value !== IDENTITY_CONFIRMATION) return
    const version = state.previewEdit
    void run('accept', () => api('/api/identity/accept', requestBody({ digest: proposal.digest, confirmation: IDENTITY_CONFIRMATION })), result => {
      const { map, ownership } = documentOf(result)
      if (!map || map.sourcePath !== state.path || map.workspaceId !== state.workspaceId) throw new Error('Accepted identity map did not match the selected workspace and path.')
      state.map = map
      state.ownership = ownership
      state.authorityVersion += 1
      state.preview = null
      state.previewOwnership = null
      state.ownershipProposal = null
      state.operation = null
      state.inspection = null
      state.nodeId = ''
      state.readState = 'accepted at checked source revision'
      state.message = `Identity map ${map.documentId} accepted. Source content was not changed.`
    }, () => version === state.previewEdit)
  }

  function inspectNode() {
    syncPath()
    const reference = selectedReference()
    if (!reference) return
    const version = state.nodeEdit
    state.inspection = null
    render()
    void run('inspect', () => api('/api/identity/inspect', requestBody(reference)), result => {
      state.inspection = result
      state.message = `Inspected qualified node ${reference.nodeId}.`
    }, () => version === state.nodeEdit)
  }

  function exportDocument() {
    syncPath()
    if (!acceptedForPath()) return
    const documentId = state.map.documentId
    void run('export', () => api('/api/identity/export', requestBody({ documentId })), result => {
      if (workspaceOf(result) !== state.workspaceId) throw new Error('Export belongs to a different workspace.')
      const filenameId = documentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100)
      const blob = new Blob([json(result)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `systemx-source-identity-${filenameId}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      state.message = `Downloaded reviewed identity metadata for ${documentId}.`
    })
  }

  function reopenDocument() {
    if (reopenConfirmation.value !== REOPEN_CONFIRMATION) return
    let documentData
    try {
      if (reopenJson.value.length > 400000) throw new Error('Reopen JSON exceeds the bounded input limit.')
      documentData = JSON.parse(reopenJson.value)
    } catch (error) { state.message = errorText(error); render(); return }
    void run('reopen', () => api('/api/identity/reopen', requestBody({ document: documentData, confirmation: REOPEN_CONFIRMATION })), result => {
      const { map, ownership } = documentOf(result)
      if (!map) throw new Error('Reopen response lacks an accepted identity map.')
      if (map.sourcePath !== state.path) {
        state.message = `Reopened ${map.documentId}; select ${map.sourcePath} in the source picker to inspect it.`
        return
      }
      if (map.workspaceId !== state.workspaceId) throw new Error('Reopened identity map belongs to a different workspace.')
      state.map = map
      state.ownership = ownership
      state.authorityVersion += 1
      state.preview = null
      state.previewOwnership = null
      state.ownershipProposal = null
      state.operation = null
      state.inspection = null
      state.nodeId = ''
      state.readState = 'reopened at checked source revision'
      state.message = `Reopened identity document ${map.documentId}.`
    })
  }

  function previewOwnership() {
    syncPath()
    if (!acceptedForPath()) return
    let changes
    try { changes = parseArray(ownershipJson, 'Ownership changes') }
    catch (error) { state.message = errorText(error); render(); return }
    const version = state.ownerEdit
    const documentId = state.map.documentId
    void run('ownershipPreview', () => api('/api/identity/ownership/preview', requestBody({ documentId, changes })), result => {
      const proposal = result?.proposal ?? result
      if (!proposal?.digest || !proposal?.report) throw new Error('Ownership preview response lacks a reviewable report.')
      state.ownershipProposal = proposal
      state.operation = null
      state.message = `Ownership proposal ${proposal.digest} is ready. Review affected objects and coverage before acceptance.`
    }, () => version === state.ownerEdit)
  }

  function acceptOwnership() {
    const proposal = state.ownershipProposal
    if (!proposal || ownershipConfirmation.value !== OWNERSHIP_CONFIRMATION) return
    const version = state.ownerEdit
    void run('ownershipAccept', () => api('/api/identity/ownership/accept', requestBody({ digest: proposal.digest, confirmation: OWNERSHIP_CONFIRMATION })), result => {
      const report = result?.report ?? result
      if (!report || report.workspaceId !== state.workspaceId || report.documentId !== state.map?.documentId) throw new Error('Accepted ownership report did not match the current document.')
      state.ownership = report
      state.authorityVersion += 1
      state.ownershipProposal = null
      state.operation = null
      state.inspection = null
      state.message = `Ownership change accepted for ${report.documentId}. Unsupported source operations remain unavailable.`
    }, () => version === state.ownerEdit)
  }

  function previewOperation() {
    syncPath()
    const reference = selectedReference()
    if (!acceptedForPath() || !reference || !operationText.value) return
    const version = state.operationEdit
    const text = operationText.value
    const documentId = state.map.documentId
    const expectedRevision = state.map.sourceRevision
    void run('operation', () => api('/api/identity/operation', requestBody({ documentId, reference, expectedRevision, text })), result => {
      if (typeof result?.allowed !== 'boolean') throw new Error('Literal operation response lacks an allowed or refusal decision.')
      state.operation = result
      if (!result.allowed && /STALE|REVISION/i.test(String(result.code ?? ''))) state.readState = 'stale'
      state.message = result.allowed ? 'Literal patch preview is ready. Review impact before staging in the controlled editor.' : `Literal operation refused: ${result.code ?? 'UNAVAILABLE'}. Your text draft is retained.`
    }, () => version === state.operationEdit)
  }

  function stageLiteral() {
    syncPath()
    const proposal = state.operation
    if (typeof onStageLiteral !== 'function' || !acceptedForPath() || !proposal?.allowed || !validPatch(proposal.patch)
      || !['current source read', 'accepted at checked source revision', 'reopened at checked source revision'].includes(state.readState)) return
    const path = state.map.sourcePath
    const sourceRevision = state.map.sourceRevision
    void run('stage', () => Promise.resolve(onStageLiteral({ path, sourceRevision, patch: proposal.patch })), () => {
      state.message = 'Literal patch sent to the controlled editor for its separate review and confirmation.'
      state.operation = null
    })
  }

  const picker = container.querySelector('#source-file-select')
  const onPickerChange = () => syncPath()
  picker?.addEventListener('change', onPickerChange)
  importPreview.addEventListener('click', previewImport)
  refreshStatus.addEventListener('click', () => { void refresh() })
  identityAccept.addEventListener('click', acceptImport)
  nodeSelect.addEventListener('change', () => {
    state.nodeId = nodeSelect.value
    state.nodeEdit += 1
    state.operation = null
    state.inspection = null
    render()
    inspectNode()
  })
  exportButton.addEventListener('click', exportDocument)
  reopenButton.addEventListener('click', reopenDocument)
  ownershipPreview.addEventListener('click', previewOwnership)
  ownershipAccept.addEventListener('click', acceptOwnership)
  operationPreview.addEventListener('click', previewOperation)
  stageOperation.addEventListener('click', stageLiteral)
  for (const node of [renameFrom, aliases]) node.addEventListener('input', () => {
    state.previewEdit += 1
    state.preview = null
    state.previewOwnership = null
    state.message = 'Identity inputs changed. Preview again before acceptance.'
    render()
  })
  ownershipJson.addEventListener('input', () => {
    state.ownerEdit += 1
    state.ownershipProposal = null
    state.message = 'Ownership changes edited. Preview again before acceptance.'
    render()
  })
  operationText.addEventListener('input', () => {
    state.operationEdit += 1
    state.operation = null
    render()
  })
  for (const node of [identityConfirmation, reopenJson, reopenConfirmation, ownershipConfirmation]) node.addEventListener('input', render)
  render()

  const handle = {
    refresh,
    destroy() {
      state.destroyed = true
      state.epoch += 1
      state.busy.clear()
      picker?.removeEventListener('change', onPickerChange)
      root.remove()
      if (instances.get(container) === handle) instances.delete(container)
    },
  }
  instances.set(container, handle)
  return handle
}
