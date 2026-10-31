import { previewNavigatorLimits, collectPreviewHierarchy, projectPreviewRows, ancestorPreviewEntries, isCurrentPreviewElement } from './preview-navigator.js'
import { sourceComparisonLimits, compareSourceText } from './source-comparison.js'
import { sourceRecordLimits, createRecoveryRecord, parseRecoveryRecord, normalizeSourceDisplay, createComparisonExport } from './source-draft-records.js'
import { canonicalSourcePath, sourceNavigationKey, createSourceNavigation, parseSourceNavigation, parseSourceInventory, filterSourceMetadata, sourcePickerSelection } from './source-navigation.js'
import { attachSourceIdentityInspector } from './source-identities.js'

const apiBase = window.location.pathname.startsWith('/__systemx') ? '/__systemx' : ''
const sessionToken = document.querySelector('meta[name="systemx-session"]')?.content ?? ''
let identityInspector
const layoutStorageKey = 'systemx.lan.builder.layout.v4'
const inspectorGroups = {
  design: ['style', 'settings'],
  data: ['content', 'users'],
  build: ['source', 'providers'],
  ops: ['agi', 'mcp', 'sync'],
}
const rightPanelToGroup = Object.fromEntries(
  Object.entries(inspectorGroups).flatMap(([group, panels]) => panels.map((panel) => [panel, group])),
)
const defaultLayout = {
  layoutUiVersion: 3,
  activeLeft: 'canvas',
  activeRight: 'style',
  activeInspectorGroup: 'design',
  leftCollapsed: false,
  rightCollapsed: false,
  leftPinned: false,
  rightPinned: false,
  leftWidth: 280,
  rightWidth: 336,
  previewPreset: 'fit',
  previewWidth: 1440,
  previewFit: true,
  previewInspect: true,
  evidenceOpen: false,
}

const previewPresets = Object.freeze({
  'desktop-1920': { label: 'Large desktop', platform: 'Desktop', width: 1920 },
  'desktop-1440': { label: 'Desktop', platform: 'Desktop', width: 1440 },
  'laptop-1280': { label: 'Laptop', platform: 'Desktop', width: 1280 },
  'desktop-1024': { label: 'Small desktop', platform: 'Desktop', width: 1024 },
  'ipad-landscape-1180': { label: 'iPad landscape', platform: 'iPadOS', width: 1180 },
  'tablet-820': { label: 'iPad portrait', platform: 'iPadOS', width: 820 },
  'ios-landscape-667': { label: 'iPhone landscape', platform: 'iOS', width: 667 },
  'mobile-landscape-667': { label: 'Mobile landscape', platform: 'Responsive', width: 667 },
  'ios-440': { label: 'iPhone large portrait', platform: 'iOS', width: 440 },
  'ios-393': { label: 'iPhone portrait', platform: 'iOS', width: 393 },
  'android-tablet-landscape-1280': { label: 'Android tablet landscape', platform: 'Android', width: 1280 },
  'android-tablet-834': { label: 'Android tablet portrait', platform: 'Android', width: 834 },
  'android-landscape-780': { label: 'Android landscape', platform: 'Android', width: 780 },
  'android-412': { label: 'Android phone portrait', platform: 'Android', width: 412 },
  'android-360': { label: 'Android compact portrait', platform: 'Android', width: 360 },
})

function loadLayout() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(layoutStorageKey) ?? '{}')
    const next = { ...defaultLayout, ...stored, layoutUiVersion: defaultLayout.layoutUiVersion }
    next.leftPinned = Boolean(next.leftPinned)
    next.rightPinned = Boolean(next.rightPinned)
    if (next.leftPinned) next.leftCollapsed = false
    if (next.rightPinned) next.rightCollapsed = false
    return next
  } catch {
    return { ...defaultLayout }
  }
}

const state = {
  status: null,
  workSelection: null,
  statusRequestGeneration: 0,
  data: null,
  selectedPageId: null,
  selectedNodeId: null,
  selectedCollectionId: null,
  sourcePath: null,
  sourceWritable: true,
  sourceInventory: null,
  sourceInventoryWorkspaceId: null,
  sourceInventoryGeneration: 0,
  sourceInventoryController: null,
  sourceInventoryLoading: false,
  sourcePolicyGeneration: 0,
  sourceNavigationEnabled: false,
  sourceNavigationPending: null,
  sourceRevision: null,
  sourceLoadedContent: null,
  sourceDisplayBaseline: null,
  sourceConflictRevision: null,
  sourceLoadGeneration: 0,
  sourceTargetGeneration: 0,
  sourceLoading: false,
  sourceSaving: false,
  sourceUnavailable: false,
  sourceComparison: null,
  sourceComparisonGeneration: 0,
  sourceComparisonController: null,
  sourceComparing: false,
  sourceReviewMessage: '',
  sourceDraftPreview: null,
  sourceDraftPreviewGeneration: 0,
  sourceDraftPreviewController: null,
  sourceLoadedWorkspaceId: null,
  sourceRecoveryWorkspaceId: null,
  sourceRecoveryEnabled: false,
  sourceRecoveryRecord: null,
  sourceRecoveryHasStored: false,
  sourceRecoveryReview: null,
  sourceRecoveryGeneration: 0,
  sourceRecoveryController: null,
  sourceRecoveryBusy: false,
  sourceRecoveryState: 'empty',
  sourceRecoveryMessage: 'Local draft recovery is off. Nothing is stored automatically.',
  sourceExport: null,
  sourceExportGeneration: 0,
  sourceHistory: null,
  sourceHistoryGeneration: 0,
  sourceHistoryController: null,
  sourceHistoryLoading: false,
  components: [],
  previewSelectedElement: null,
  previewWorkspaceBinding: null,
  previewHoveredElement: null,
  previewSelection: null,
  previewSelectionAnchor: null,
  previewContextTarget: null,
  previewParentElements: [],
  previewLayerElements: [],
  previewBreadcrumbElements: [],
  previewNavigatorSnapshot: null,
  previewNavigatorRows: [],
  previewNavigatorExpanded: new Set(),
  previewNavigatorFocus: null,
  previewNavigatorQuery: '',
  previewNavigatorObserver: null,
  previewNavigatorTimer: null,
  previewNavigatorRoute: null,
  previewTextOriginals: new WeakMap(),
  previewTextSource: null,
  previewTextSourcePending: null,
  previewTextSaving: null,
  previewTextSourceGeneration: 0,
  previewInspectorRetry: null,
  fontCatalog: [],
  fontCatalogMeta: null,
  selectedFont: null,
  projectFont: null,
  fontSourceGeneration: 0,
  fontSourceLoading: false,
  fontSaving: false,
  fontSourceUnavailable: false,
  fontSourceNeedsRefresh: true,
  fontConflictRevision: null,
  fontIntentGeneration: 0,
  layout: loadLayout(),
}

const sourceDraftPreviewLimits = Object.freeze({ characters: 500000, displayedCharacters: 20000 })
const sourceObservationVersions = new Map()
const sourceObservedRevisions = new Map()
const runtimeStyleRules = new Map()

function setRuntimeStyleRule(name, css) {
  const style = document.querySelector('#systemx-runtime-style')
  if (!style) return
  runtimeStyleRules.set(name, css)
  style.textContent = [...runtimeStyleRules.values()].join('\n')
}

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

function setWorkspaceMenu(open, { restoreFocus = false } = {}) {
  const panel = document.querySelector('#workspace-menu')
  const toggle = document.querySelector('#workspace-menu-toggle')
  if (!panel || !toggle) return
  panel.hidden = !open
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close SYSTEMX workspace menu' : 'Open SYSTEMX workspace menu')
  if (!open && restoreFocus) toggle.focus({ preventScroll: true })
}

function focusQuickFind() {
  const input = document.querySelector('#builder-command-input')
  if (!input) return
  setWorkspaceMenu(false)
  if (!input.getBoundingClientRect().height) document.querySelector('.builder-app')?.classList.add('command-search-open')
  input.focus()
}

function updatePanelVisibilityControls() {
  const controls = [
    { side: 'left', button: '#left-panel-visibility', status: '#left-panel-visibility-status' },
    { side: 'right', button: '#right-panel-visibility', status: '#right-panel-visibility-status' },
  ]
  for (const { side, button: buttonSelector, status: statusSelector } of controls) {
    const button = document.querySelector(buttonSelector)
    const status = document.querySelector(statusSelector)
    const pinned = Boolean(state.layout[`${side}Pinned`])
    if (button) {
      button.textContent = pinned ? 'Unpin' : 'Keep open'
      button.setAttribute('aria-pressed', String(pinned))
      button.setAttribute('data-state', pinned ? 'always-shown' : 'auto')
      button.setAttribute('title', pinned
        ? `Allow the ${side} menu to auto-close after saves`
        : `Keep the ${side} menu open after saves`)
    }
    if (status) {
      status.textContent = pinned ? 'Always shown' : 'Auto'
      status.setAttribute('data-state', pinned ? 'always-shown' : 'auto')
    }
  }
}

function reconcilePanelVisibilityState() {
  const shell = document.querySelector('.builder-shell')
  if (shell) {
    const leftCollapsed = shell.classList.contains('left-panel-collapsed')
    const rightCollapsed = shell.classList.contains('right-panel-collapsed')

    // A pinned menu wins over an accidental auto-close from a refresh, resize,
    // or save cycle. Manual close actions clear the pin before reaching here.
    if (state.layout.leftPinned && leftCollapsed) {
      shell.classList.remove('left-panel-collapsed')
      state.layout.leftCollapsed = false
    } else {
      state.layout.leftCollapsed = leftCollapsed
    }
    if (state.layout.rightPinned && rightCollapsed) {
      shell.classList.remove('right-panel-collapsed')
      state.layout.rightCollapsed = false
    } else {
      state.layout.rightCollapsed = rightCollapsed
    }
  }
  updatePanelVisibilityControls()
}

function saveLayout() {
  reconcilePanelVisibilityState()
  syncCompactPanel()
  try {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(state.layout))
  } catch {
    // Layout persistence is optional; the builder remains usable without storage.
  }
}

// A compact workspace presents one focused pane without changing either
// Keep open preference. Hidden panes must also leave the keyboard focus order.
function syncCompactPanel(preferredSide) {
  const shell = document.querySelector('.builder-shell')
  if (!shell) return
  if (preferredSide) shell.dataset.compactPanel = preferredSide
  let focused = shell.dataset.compactPanel || 'left'
  if (state.layout[`${focused}Collapsed`]) focused = focused === 'left' ? 'right' : 'left'
  shell.dataset.compactPanel = focused
  const compact = window.innerWidth <= 700
  for (const side of ['left', 'right']) {
    const visible = !state.layout[`${side}Collapsed`] && (!compact || side === focused)
    const panel = shell.querySelector(`.${side}-panel`)
    if (panel) panel.inert = !visible
    const toggle = document.querySelector(`#${side}-panel-toggle`)
    toggle?.setAttribute('aria-expanded', String(visible))
    toggle?.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${side} panel`)
  }
}

function clampPanelWidth(side, value) {
  const limits = side === 'left' ? { min: 220, max: 420 } : { min: 260, max: 480 }
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)))
}

function applyPanelWidths() {
  const shell = document.querySelector('.builder-shell')
  if (!shell) return
  state.layout.leftWidth = clampPanelWidth('left', state.layout.leftWidth)
  state.layout.rightWidth = clampPanelWidth('right', state.layout.rightWidth)
  setRuntimeStyleRule(
    'panel-widths',
    `.builder-shell { --left-panel-width: ${state.layout.leftWidth}px !important; --right-panel-width: ${state.layout.rightWidth}px !important; }`,
  )
  document.querySelector('#left-panel-resizer')?.setAttribute('aria-valuenow', String(state.layout.leftWidth))
  document.querySelector('#right-panel-resizer')?.setAttribute('aria-valuenow', String(state.layout.rightWidth))
}

function clampPreviewWidth(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(2560, Math.max(320, parsed)) : 1440
}

function applyPreviewPreset(presetId = state.layout.previewPreset, options = {}) {
  const viewport = document.querySelector('#canvas-preview-viewport')
  const select = document.querySelector('#canvas-device-select')
  const widthInput = document.querySelector('#canvas-width-input')
  const fitToggle = document.querySelector('#canvas-fit-toggle')
  const status = document.querySelector('#canvas-device-status')
  if (!viewport || !select || !widthInput || !fitToggle || !status) return

  const fit = presetId === 'fit' || options.fit === true
  const custom = presetId === 'custom'
  const preset = previewPresets[presetId]
  // Measure after entering Fit: the former fixed width is not the available
  // workspace width. Fixed/custom presets keep their explicit bounded width.
  viewport.dataset.previewMode = fit ? 'fit' : 'fixed'
  const availableWidth = viewport.clientWidth || viewport.parentElement?.clientWidth || state.layout.previewWidth
  const width = fit ? Math.max(1, Math.round(availableWidth))
    : clampPreviewWidth(options.width ?? preset?.width ?? state.layout.previewWidth)
  const label = fit ? 'Fit workspace' : custom ? 'Custom canvas' : preset?.label ?? 'Custom canvas'
  const platform = fit ? 'Responsive' : custom ? 'Custom' : preset?.platform ?? 'Custom'

  state.layout.previewPreset = fit ? 'fit' : custom ? 'custom' : presetId
  state.layout.previewWidth = width
  state.layout.previewFit = fit

  setRuntimeStyleRule(
    'preview-width',
    `#canvas-preview-viewport { --canvas-preview-width: ${width}px; }`,
  )
  select.value = state.layout.previewPreset
  widthInput.value = String(width)
  widthInput.disabled = fit
  fitToggle.classList.toggle('active', fit)
  fitToggle.setAttribute('aria-pressed', String(fit))
  status.textContent = fit ? `${label} · available width` : `${label} · ${width}px · ${platform}`

  document.querySelectorAll('[data-preview-preset]').forEach((button) => {
    const active = !fit && button.dataset.previewPreset === presetId
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })

  if (options.persist !== false) saveLayout()
}

function setLeftPanelCollapsed(collapsed, persist = true, reason = 'manual') {
  const shell = document.querySelector('.builder-shell')
  const toggle = document.querySelector('#left-panel-toggle')
  if (!shell || !toggle) return
  if (collapsed && reason === 'auto' && state.layout.leftPinned) return
  if (collapsed && reason === 'manual') state.layout.leftPinned = false
  state.layout.leftCollapsed = collapsed
  shell.classList.toggle('left-panel-collapsed', collapsed)
  toggle.setAttribute('aria-expanded', String(!collapsed))
  toggle.setAttribute('aria-label', collapsed ? 'Show left panel' : 'Hide left panel')
  toggle.textContent = collapsed ? '›' : '‹'
  updatePanelVisibilityControls()
  if (persist) saveLayout()
}

function setRightPanelCollapsed(collapsed, persist = true, reason = 'manual') {
  const shell = document.querySelector('.builder-shell')
  const toggle = document.querySelector('#right-panel-toggle')
  const headerToggle = document.querySelector('#right-panel-collapse')
  if (!shell || !toggle) return
  if (collapsed && reason === 'auto' && state.layout.rightPinned) return
  if (collapsed && reason === 'manual') state.layout.rightPinned = false
  state.layout.rightCollapsed = collapsed
  shell.classList.toggle('right-panel-collapsed', collapsed)
  toggle.setAttribute('aria-expanded', String(!collapsed))
  toggle.setAttribute('aria-label', collapsed ? 'Show right panel' : 'Hide right panel')
  toggle.textContent = collapsed ? '‹' : '›'
  if (headerToggle) {
    headerToggle.setAttribute('aria-label', collapsed ? 'Show right panel' : 'Collapse right panel')
    headerToggle.textContent = collapsed ? '‹' : '›'
  }
  updatePanelVisibilityControls()
  if (persist) saveLayout()
}

function setPanelPinned(side, pinned) {
  const key = `${side}Pinned`
  state.layout[key] = Boolean(pinned)
  if (state.layout[key]) {
    if (side === 'left') setLeftPanelCollapsed(false, false, 'pin')
    if (side === 'right') setRightPanelCollapsed(false, false, 'pin')
  }
  updatePanelVisibilityControls()
  saveLayout()
  output(
    '#command-output',
    `${side === 'left' ? 'Left' : 'Right'} editor menu visibility: ${state.layout[key] ? 'always shown' : 'automatic after save/resize'}.`,
  )
}

function autoCollapsePanel(side) {
  if (state.layout[`${side}Pinned`]) return false
  if (side === 'left') setLeftPanelCollapsed(true, true, 'auto')
  if (side === 'right') setRightPanelCollapsed(true, true, 'auto')
  return true
}

function protectCanvasWidth(preferredSide = 'canvas') {
  const shell = document.querySelector('.builder-shell')
  if (!shell) return
  const width = shell.getBoundingClientRect().width
  const minimumCanvas = width >= 1360 ? 600 : width >= 1180 ? 520 : width >= 900 ? 430 : 300
  const fixedChrome = width < 700 ? 84 : 104
  const required = fixedChrome
    + (state.layout.leftCollapsed ? 0 : state.layout.leftWidth)
    + (state.layout.rightCollapsed ? 0 : state.layout.rightWidth)
    + minimumCanvas
  shell.classList.toggle(
    'panel-width-constrained',
    required > width && state.layout.leftPinned && state.layout.rightPinned,
  )
  if (required <= width) {
    updatePanelVisibilityControls()
    return
  }
  if (preferredSide === 'right' && !state.layout.leftCollapsed && autoCollapsePanel('left')) return
  if (preferredSide === 'left' && !state.layout.rightCollapsed && autoCollapsePanel('right')) return
  if (!state.layout.rightCollapsed && autoCollapsePanel('right')) return
  if (!state.layout.leftCollapsed) autoCollapsePanel('left')
  updatePanelVisibilityControls()
}

function restoreLayout() {
  applyPanelWidths()
  applyPreviewPreset(
    state.layout.previewFit ? 'fit' : state.layout.previewPreset,
    { width: state.layout.previewWidth, fit: state.layout.previewFit, persist: false },
  )
  setLeftPanelCollapsed(Boolean(state.layout.leftCollapsed), false)
  setRightPanelCollapsed(Boolean(state.layout.rightCollapsed), false)
  setEvidenceDrawer(Boolean(state.layout.evidenceOpen), false)
  setPreviewInspectMode(state.layout.previewInspect !== false, false)
  protectCanvasWidth('canvas')
  saveLayout()
}

function setCanvasDockOpen(open) {
  const workspace = document.querySelector('.canvas-workspace')
  const toggle = document.querySelector('#canvas-dock-toggle')
  if (!workspace || !toggle) return
  workspace.classList.toggle('model-dock-collapsed', !open)
  toggle.setAttribute('aria-expanded', String(open))
}

function collapseInspectorToCanvas() {
  setRightPanelCollapsed(true)
  if (rightPanelIds.has(window.location.hash.replace(/^#/, ''))) window.history.replaceState(null, '', '#canvas')
}

const leftPanelTitles = {
  command: 'SYSTEMX control tower',
  canvas: 'Add elements',
  pages: 'Pages and routes',
  navigator: 'Navigator',
  components: 'Components',
  assets: 'Assets',
}

const leftPanelIds = new Set(Object.keys(leftPanelTitles))
const rightPanelIds = new Set(Object.keys(rightPanelToGroup))

function applyInspectorTabs(panelId) {
  const group = rightPanelToGroup[panelId] ?? 'design'
  state.layout.activeRight = panelId
  state.layout.activeInspectorGroup = group
  document.querySelectorAll('[data-inspector-group-button]').forEach((button) => {
    button.classList.toggle('active', button.dataset.inspectorGroupButton === group)
    button.setAttribute('aria-pressed', String(button.dataset.inspectorGroupButton === group))
  })
  document.querySelectorAll('[data-inspector-group-tab]').forEach((button) => {
    const active = button.dataset.inspectorGroupTab === group
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
  })
  document.querySelectorAll('[data-inspector-tab]').forEach((link) => {
    const inGroup = link.dataset.inspectorGroup === group
    link.hidden = !inGroup
    link.classList.toggle('active', link.dataset.inspectorTab === panelId)
    link.setAttribute('aria-current', link.dataset.inspectorTab === panelId ? 'page' : 'false')
  })
}

function activateLeftPanel(panelId, updateHash = true) {
  if (!leftPanelIds.has(panelId)) return
  state.layout.activeLeft = panelId
  setLeftPanelCollapsed(false)
  if (window.innerWidth < 1180) autoCollapsePanel('right')
  else protectCanvasWidth('left')
  syncCompactPanel('left')
  setCanvasDockOpen(panelId === 'navigator')
  document.querySelectorAll('[data-left-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.leftPanel === panelId))
  document.querySelectorAll('[data-panel-target]').forEach((link) => link.classList.toggle('active', link.dataset.panelTarget === panelId))
  text('#left-panel-title', leftPanelTitles[panelId])
  saveLayout()
  if (updateHash && window.location.hash !== `#${panelId}`) window.history.replaceState(null, '', `#${panelId}`)
}

function activateRightPanel(panelId, updateHash = true) {
  if (!rightPanelIds.has(panelId)) return
  setRightPanelCollapsed(false)
  if (window.innerWidth < 1180) autoCollapsePanel('left')
  else protectCanvasWidth('right')
  syncCompactPanel('right')
  setCanvasDockOpen(false)
  document.querySelectorAll('[data-right-panel]').forEach((panel) => {
    if (panel.closest('.right-panel')) panel.classList.toggle('is-active', panel.dataset.rightPanel === panelId)
  })
  applyInspectorTabs(panelId)
  saveLayout()
  if (updateHash && window.location.hash !== `#${panelId}`) window.history.replaceState(null, '', `#${panelId}`)
}

function activateWorkspaceFromHash() {
  const panelId = window.location.hash.replace(/^#/, '') || state.layout.activeLeft || 'canvas'
  const isPanelHash = leftPanelIds.has(panelId) || rightPanelIds.has(panelId)
  if (leftPanelIds.has(panelId)) activateLeftPanel(panelId, false)
  if (rightPanelIds.has(panelId)) activateRightPanel(panelId, false)
  if (isPanelHash) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

const text = (selector, value) => {
  const node = document.querySelector(selector)
  if (node) node.textContent = value
}

const create = (tag, className, textContent) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (textContent !== undefined) node.textContent = textContent
  return node
}

function getEmbeddedStatus() {
  const node = document.querySelector('#systemx-status-data')
  if (!node?.textContent) return null
  try {
    const value = JSON.parse(node.textContent)
    return value?.repository ? value : null
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  if (typeof fetch !== 'function') throw new Error('This browser does not expose fetch; use a standard local browser for editing actions.')
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionToken ? { 'x-systemx-session': sessionToken } : {}),
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error ?? `HTTP ${response.status}`)
    error.status = response.status
    error.code = result.code
    if (Array.isArray(result.diagnostics) && result.diagnostics.length <= 1000) error.diagnostics = result.diagnostics
    if (validSourceRevision(result.currentRevision)) error.currentRevision = result.currentRevision.toLowerCase()
    throw error
  }
  return result
}

async function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) })
}

function stageIdentityLiteral({ path, sourceRevision, patch }) {
  const editor = document.querySelector('#source-editor')
  if (!editor || !sourceLoadedForWorkspace() || state.sourceLoading || state.sourceSaving || state.sourceWritable === false
    || path !== state.sourcePath || document.querySelector('#source-file-select')?.value !== path
    || sourceRevision !== state.sourceRevision || editor.value !== state.sourceDisplayBaseline
    || typeof state.sourceLoadedContent !== 'string') {
    throw new Error('Load the same source revision with a clean editor before staging this reviewed literal proposal. The current draft is kept.')
  }
  if (!patch || !Number.isInteger(patch.start) || !Number.isInteger(patch.end) || patch.start < 0
    || patch.end < patch.start || patch.end > state.sourceLoadedContent.length || typeof patch.replacement !== 'string'
    || patch.replacement.length > 10_000) throw new Error('Literal proposal is outside its bounded source span.')
  const content = state.sourceLoadedContent.slice(0, patch.start) + patch.replacement + state.sourceLoadedContent.slice(patch.end)
  if (content.length > sourceComparisonLimits.characters) throw new Error('Staged source exceeds the existing editor limit.')
  invalidateSourceComparison('A reviewed literal proposal was staged; compare and confirm the source change separately.', true)
  editor.value = normalizeSourceDisplay(content)
  const confirmation = document.querySelector('#source-confirmation')
  if (confirmation) confirmation.value = ''
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  output('#source-output', 'Literal proposal staged in the controlled editor. Review the diff and use the existing confirmation to save. No source was written.')
}

function fontStack(family) {
  const escaped = family.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `"${escaped}", system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
}

function renderFontList() {
  const list = document.querySelector('#font-list')
  if (!list) return
  const query = document.querySelector('#font-search')?.value.trim().toLocaleLowerCase() ?? ''
  const category = document.querySelector('#font-category')?.value ?? ''
  const items = state.fontCatalog
    .filter((font) => !query || font.family.toLocaleLowerCase().includes(query))
    .filter((font) => !category || font.category === category)
  list.replaceChildren()
  if (!items.length) {
    list.append(create('p', 'empty-state', 'No catalog families match this filter.'))
    return
  }
  for (const font of items) {
    const button = create('button', `font-card${state.selectedFont?.family === font.family ? ' selected' : ''}`)
    button.type = 'button'
    button.dataset.fontFamily = font.family
    button.title = `Preview ${font.family}`
    button.append(
      create('strong', '', font.family),
      create('small', '', `${font.category} · ${font.variants.slice(0, 5).join(', ') || 'default'} · ${font.source === 'google-developer-api' ? 'live metadata' : 'offline catalog'}`),
    )
    button.style.fontFamily = fontStack(font.family)
    list.append(button)
  }
}

function renderProjectFont(fontState) {
  state.projectFont = fontState
  renderFontSourceRevision()
  text('#project-font-family', fontState?.configured ? fontState.family : 'System fallback')
  text('#project-font-source', fontState?.configured
    ? `${fontState.path} · Google CSS2 import`
    : `${fontState?.path ?? 'src/index.css'} · no Google font import configured`)
}

function renderLoadedFonts() {
  const frameDocument = previewDocument()
  if (!frameDocument?.fonts) {
    text('#font-loaded-state', 'Live font inventory is available through the Vite bridge.')
    return
  }
  const loaded = [...frameDocument.fonts]
    .filter((font) => font.status === 'loaded' || font.status === 'loading')
    .map((font) => `${font.family} ${font.weight}`)
  const unique = [...new Set(loaded)]
  text('#font-loaded-state', unique.length
    ? `Canvas loaded: ${unique.slice(0, 4).join(' · ')}${unique.length > 4 ? ` · +${unique.length - 4} more` : ''}`
    : 'Canvas loaded no declared web-font faces; system fallback is active.')
}

async function loadFontInPreview(font, announce = true) {
  const frameDocument = previewDocument()
  if (!frameDocument || !font) {
    if (announce) output('#font-status', 'Open the Vite bridge canvas before previewing a font.')
    return
  }
  let link = frameDocument.querySelector('#systemx-font-preview-link')
  if (!link) {
    link = frameDocument.createElement('link')
    link.id = 'systemx-font-preview-link'
    link.rel = 'stylesheet'
    frameDocument.head.append(link)
  }
  link.href = font.cssUrl
  let style = frameDocument.querySelector('#systemx-font-preview-style')
  if (!style) {
    style = frameDocument.createElement('style')
    style.id = 'systemx-font-preview-style'
    frameDocument.head.append(style)
  }
  style.textContent = `body, body * { font-family: ${fontStack(font.family)} !important; }`
  const sample = document.querySelector('#font-preview-sample')
  if (sample) sample.style.fontFamily = fontStack(font.family)
  if (announce) output('#font-status', `${font.family} loaded in the local Vite canvas for preview only. Nothing has been written to the project.`)
  window.setTimeout(renderLoadedFonts, 350)
}

function selectFont(fontFamily, options = {}) {
  const font = state.fontCatalog.find((item) => item.family === fontFamily)
  if (!font) return
  if (state.selectedFont?.family !== font.family) {
    state.fontIntentGeneration += 1
    setControlValue('#font-confirmation', '')
  }
  state.selectedFont = font
  document.querySelector('#font-preview-selected')?.removeAttribute('disabled')
  document.querySelector('#font-load-selected')?.removeAttribute('disabled')
  updateFontSaveAvailability()
  renderFontList()
  const sample = document.querySelector('#font-preview-sample')
  if (sample) sample.style.fontFamily = fontStack(font.family)
  output('#font-status', `${font.family} selected · ${font.category} · ${font.variants.slice(0, 6).join(', ') || 'default'} · Google CSS2 preview is ready.`)
  if (options.load !== false) void loadFontInPreview(font)
}

function updateFontSaveAvailability() {
  setControlDisabled('#font-save-project', !state.selectedFont || state.projectFont?.workspaceId !== state.sourceRecoveryWorkspaceId || !validSourceRevision(state.projectFont?.revision) || state.fontSourceLoading || state.fontSaving || state.fontSourceUnavailable || state.fontSourceNeedsRefresh || Boolean(state.fontConflictRevision))
  setControlDisabled('#font-refresh-source', state.fontSourceLoading || state.fontSaving)
}

function renderFontSourceRevision() {
  const label = document.querySelector('#font-source-revision')
  if (!label) return
  const revision = state.projectFont?.revision
  if (validSourceRevision(revision)) label.dataset.revision = revision
  else label.removeAttribute('data-revision')
  if (state.fontConflictRevision) label.dataset.currentRevision = state.fontConflictRevision
  else label.removeAttribute('data-current-revision')
  label.textContent = state.fontSourceUnavailable
    ? `Font source unavailable. Loaded revision ${revision || 'not available'}; refresh after restoring the source.`
    : state.fontSourceLoading ? `Reading font source. Loaded revision ${revision || 'not available'}.`
    : state.fontConflictRevision ? `Font source changed. Loaded ${revision}; current ${state.fontConflictRevision}. Refresh font source before saving.`
    : state.fontSourceNeedsRefresh ? `Font source needs refresh · loaded ${revision || 'not available'}.`
    : validSourceRevision(revision) ? `Font source baseline · ${revision}` : 'No font source revision loaded. Refresh font source before saving.'
  updateFontSaveAvailability()
}

async function refreshFontSource({ selectCurrent = false } = {}) {
  if (state.fontSaving) return
  const generation = ++state.fontSourceGeneration
  const selectedFamily = state.selectedFont?.family
  const workspaceId = state.sourceRecoveryWorkspaceId
  const intentGeneration = state.fontIntentGeneration
  const observation = sourceObservationVersions.get('src/index.css') || 0
  state.fontSourceLoading = true
  renderFontSourceRevision()
  try {
    const project = await request('/api/fonts/project')
    if (generation !== state.fontSourceGeneration) return
    if (sourceObservationSuperseded('src/index.css', observation, project.revision)) throw new Error('A newer stylesheet observation arrived while reading. Refresh font source again.')
    if (!sourceSnapshotForWorkspace(project, workspaceId) || project.path !== 'src/index.css' || !validSourceRevision(project.revision)) throw new Error('Font source revision is unavailable.')
    state.fontSourceUnavailable = false
    state.fontSourceNeedsRefresh = false
    state.fontConflictRevision = null
    renderProjectFont(project)
    observeSourceRevision(project.path, project.revision, 'Font source refresh')
    if (selectCurrent && state.selectedFont?.family === selectedFamily && state.fontCatalog.some((font) => font.family === project.family)) selectFont(project.family, { load: false })
    if (state.fontIntentGeneration === intentGeneration) setControlValue('#font-confirmation', '')
    output('#font-status', `Font source refreshed · ${project.revision}. The raw source draft and loaded base are kept.`)
  } catch (error) {
    if (generation !== state.fontSourceGeneration) return
    state.fontSourceNeedsRefresh = true
    if (sourceUnavailable(error) && workspaceId === state.sourceRecoveryWorkspaceId && observation === (sourceObservationVersions.get('src/index.css') || 0)) {
      state.fontSourceUnavailable = true
      observeSourceUnavailable('src/index.css')
    }
    output('#font-status', `${error.message} The selected font, raw draft and loaded source revision are kept. Check the local connection or restore the source, then Refresh font source before retrying.`)
  } finally {
    if (generation === state.fontSourceGeneration) {
      state.fontSourceLoading = false
      renderFontSourceRevision()
    }
  }
}

async function loadFontWorkspace() {
  const catalog = await request('/api/fonts/catalog')
  state.fontCatalog = catalog.items ?? []
  state.fontCatalogMeta = catalog
  text('#font-catalog-state', `${state.fontCatalog.length} families · ${catalog.source === 'google-developer-api' ? 'live metadata' : 'offline fallback'}`)
  renderFontList()
  if (catalog.warning) output('#font-status', catalog.warning)
  await refreshFontSource({ selectCurrent: true })
  renderLoadedFonts()
}

async function saveProjectFont() {
  if (!state.selectedFont || state.projectFont?.workspaceId !== state.sourceRecoveryWorkspaceId || !validSourceRevision(state.projectFont?.revision) || state.fontSourceLoading || state.fontSaving || state.fontSourceUnavailable || state.fontSourceNeedsRefresh || state.fontConflictRevision) {
    output('#font-status', 'Select a font and Refresh font source before saving a project change.')
    return
  }
  const family = state.selectedFont.family, baseRevision = state.projectFont.revision
  const workspaceId = state.sourceRecoveryWorkspaceId
  const intentGeneration = state.fontIntentGeneration
  const observation = sourceObservationVersions.get('src/index.css') || 0
  const confirmation = document.querySelector('#font-confirmation')
  state.fontSaving = true
  state.fontSourceGeneration += 1
  updateFontSaveAvailability()
  renderFontList()
  try {
    const result = await post('/api/builder/font', { family, baseRevision, confirmation: confirmation?.value })
    if (result.path !== 'src/index.css' || !validSourceRevision(result.revision) || result.currentRevision !== result.revision || result.previousRevision !== baseRevision) throw new Error('Font save revision could not be verified. Refresh font source before another save.')
    const superseded = workspaceId !== state.sourceRecoveryWorkspaceId || sourceObservationSuperseded(result.path, observation, result.revision)
    if (superseded) {
      state.fontSourceNeedsRefresh = true
      state.fontConflictRevision = sourceObservedRevisions.get(result.path) || null
    } else {
      state.fontSourceUnavailable = false
      state.fontSourceNeedsRefresh = false
      state.fontConflictRevision = null
      renderProjectFont({ ...state.projectFont, ...result, configured: true })
      observeSourceRevision(result.path, result.revision, 'Font save accepted')
    }
    if (confirmation && state.fontIntentGeneration === intentGeneration) confirmation.value = ''
    output('#font-status', result.status === 'unchanged'
      ? `${family} is already the active project font. No source change · revision ${result.revision}.`
      : `${family} saved to ${result.path}. Previous revision ${result.previousRevision}; current revision ${result.revision}. Backup: ${result.backup}. The raw draft and loaded base are kept.`)
    if (superseded) output('#font-status', `${family} save accepted at revision ${result.revision}; a newer source observation superseded this response. The raw draft and loaded base are kept. Refresh font source before another save.`)
    if (!superseded && state.selectedFont?.family === family) void loadFontInPreview(state.selectedFont, false)
  } catch (error) {
    state.fontSourceNeedsRefresh = true
    if (sourceRevisionConflict(error)) {
      const superseded = workspaceId !== state.sourceRecoveryWorkspaceId || sourceObservationSuperseded('src/index.css', observation, error.currentRevision)
      state.fontConflictRevision = superseded ? sourceObservedRevisions.get('src/index.css') || null : error.currentRevision
      if (!superseded && error.currentRevision) observeSourceRevision('src/index.css', error.currentRevision, 'Font save conflict')
      output('#font-status', 'Font source changed since it was loaded. The selected font, confirmation, raw draft and loaded base are kept. Refresh font source, review the current font, then confirm again before saving.')
    } else if (sourceUnavailable(error)) {
      if (workspaceId === state.sourceRecoveryWorkspaceId && observation === (sourceObservationVersions.get('src/index.css') || 0)) {
        state.fontSourceUnavailable = true
        observeSourceUnavailable('src/index.css')
      }
      output('#font-status', 'Font source was unavailable at the save attempt. The selected font, raw draft and loaded base are kept; no file will be recreated. Restore it externally if needed, then Refresh font source.')
    } else {
      output('#font-status', `${error.message} Font save was not confirmed. The selected font, raw draft and loaded base are kept. Check the local connection and Refresh font source before retrying.`)
    }
  } finally {
    state.fontSaving = false
    renderFontSourceRevision()
    renderFontList()
  }
}

function output(selector, value) {
  const node = document.querySelector(selector)
  if (node) node.textContent = value
}

function setEvidenceDrawer(open, persist = true) {
  const drawer = document.querySelector('#evidence-drawer')
  const toggle = document.querySelector('#evidence-toggle')
  if (!drawer || !toggle) return
  state.layout.evidenceOpen = Boolean(open)
  drawer.hidden = !state.layout.evidenceOpen
  toggle.classList.toggle('active', state.layout.evidenceOpen)
  toggle.setAttribute('aria-expanded', String(state.layout.evidenceOpen))
  if (persist) saveLayout()
}

function hidePreviewContextMenu() {
  const menu = document.querySelector('#preview-context-menu')
  if (menu) menu.hidden = true
  state.previewContextTarget = null
  state.previewParentElements = []
}

function previewDocument() {
  const frame = document.querySelector('#app-preview-frame')
  if (!frame) return null
  try {
    return frame.contentDocument?.documentElement ? frame.contentDocument : null
  } catch {
    return null
  }
}

function setPreviewInspectMode(active, persist = true) {
  const toggle = document.querySelector('#preview-inspect-toggle')
  const frame = document.querySelector('#app-preview-frame')
  state.layout.previewInspect = Boolean(active)
  toggle?.classList.toggle('active', state.layout.previewInspect)
  toggle?.setAttribute('aria-pressed', String(state.layout.previewInspect))
  document.querySelector('#canvas-preview')?.setAttribute('aria-pressed', String(!state.layout.previewInspect))
  toggle?.setAttribute('title', state.layout.previewInspect
    ? 'Inspect mode is active. Click or right-click elements in the preview.'
    : 'Interaction mode is active. The preview app receives normal clicks.')
  frame?.classList.toggle('inspect-mode', state.layout.previewInspect)
  const frameDocument = previewDocument()
  if (frameDocument) frameDocument.documentElement.toggleAttribute('data-systemx-inspect-mode', state.layout.previewInspect)
  if (!state.layout.previewInspect) {
    state.previewHoveredElement?.removeAttribute('data-systemx-inspector-hover')
    state.previewHoveredElement = null
    hidePreviewContextMenu()
  }
  if (persist) saveLayout()
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && typeof value.tagName === 'string')
}

function elementLabel(element) {
  if (!isElement(element)) return 'Element'
  const explicit = element.getAttribute('data-systemx-component')
    || element.getAttribute('data-systemx-name')
    || element.getAttribute('aria-label')
  if (explicit) return explicit.trim().slice(0, 80)
  const semanticLabels = {
    HEADER: 'Header',
    FOOTER: 'Footer',
    NAV: 'Navigation',
    MAIN: 'Main content',
    SECTION: 'Section',
    ARTICLE: 'Article',
    FORM: 'Form',
    BUTTON: 'Button',
    A: 'Link',
    H1: 'Heading 1',
    H2: 'Heading 2',
    H3: 'Heading 3',
    IMG: 'Image',
  }
  const prefix = semanticLabels[element.tagName] ?? element.tagName.toLowerCase()
  // Selection labels may summarize a leaf, but never aggregate a container's
  // private subtree or use form control contents as a name.
  const textValue = element.children.length === 0 && !['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(element.tagName)
    ? element.textContent?.slice(0, 160).replace(/\s+/g, ' ').trim()
    : ''
  return textValue ? `${prefix}: ${textValue.slice(0, 54)}` : prefix
}

function domSegment(element) {
  if (!isElement(element)) return ''
  let value = element.tagName.toLowerCase()
  if (element.id) return `${value}#${element.id}`
  const stableClass = [...element.classList].find((name) => (
    !name.includes(':') && !name.includes('[') && !name.includes('/') && name.length < 42
  ))
  if (stableClass) value += `.${stableClass}`
  const siblings = element.parentElement
    ? [...element.parentElement.children].filter((item) => item.tagName === element.tagName)
    : []
  if (siblings.length > 1) value += `:nth-of-type(${siblings.indexOf(element) + 1})`
  return value
}

function domPath(element) {
  const segments = []
  let current = element
  while (isElement(current) && current.tagName !== 'HTML') {
    segments.unshift(domSegment(current))
    if (current.tagName === 'BODY') break
    current = current.parentElement
  }
  return segments.join(' > ')
}

function mappedPageForRoute(route) {
  const normalized = route === '/' ? '/' : route.replace(/\/+$/, '')
  return state.data?.pages?.find((page) => {
    const pageRoute = page.route === '/' ? '/' : String(page.route ?? '').replace(/\/+$/, '')
    return pageRoute === normalized
  }) ?? selectedPage()
}

function currentPreviewRoute() {
  const frame = document.querySelector('#app-preview-frame')
  try {
    return `${frame?.contentWindow?.location.pathname ?? '/'}${frame?.contentWindow?.location.hash ?? ''}`
  } catch {
    return '/'
  }
}

function previewUrlForPage(page) {
  if (!page?.route) return null
  try {
    const baseUrl = state.status?.vite?.url || `${window.location.origin}/`
    return new URL(page.route, baseUrl).toString()
  } catch {
    return null
  }
}

function navigatePreviewToPage(page) {
  const frame = document.querySelector('#app-preview-frame')
  const targetUrl = previewUrlForPage(page)
  if (!frame || frame.hidden || !targetUrl) return
  let currentUrl = frame.src
  try { currentUrl = frame.contentWindow?.location.href ?? currentUrl } catch { /* Origin changes are handled by the next explicit navigation. */ }
  if (currentUrl !== targetUrl) frame.src = targetUrl
}

function editableTextInfo(element) {
  if (!isElement(element)) return { editable: false, reason: 'No element selected', text: '' }
  const blockedTags = new Set(['BODY', 'HTML', 'IFRAME', 'SCRIPT', 'STYLE', 'SVG', 'PATH'])
  if (blockedTags.has(element.tagName)) {
    return { editable: false, reason: `${element.tagName.toLowerCase()} is not a text-edit target`, text: '' }
  }
  if (element.children.length > 0) {
    return { editable: false, reason: 'Select a leaf-text child so nested structure is preserved', text: '' }
  }
  const value = element.textContent?.trim() ?? ''
  if (!value) return { editable: false, reason: 'The selected element has no editable text', text: '' }
  if (value.length > 2000) {
    return { editable: false, reason: 'Selected text exceeds the 2,000-character inline-edit limit', text: value }
  }
  if (!state.previewTextOriginals.has(element)) state.previewTextOriginals.set(element, value)
  return {
    editable: true,
    reason: 'Preview locally or save through the backup and confirmation gate',
    text: value,
    originalText: state.previewTextOriginals.get(element),
  }
}

function previewLocation(element) {
  const route = currentPreviewRoute()
  const componentRoot = element.closest('[data-systemx-source]')
  const page = mappedPageForRoute(route.split('#')[0])
  const sourcePath = componentRoot?.getAttribute('data-systemx-source') || page?.source || ''
  const textInfo = editableTextInfo(element)
  return {
    label: elementLabel(element),
    route,
    sourcePath,
    pageSource: page?.source || '',
    domPath: domPath(element),
    tag: element.tagName.toLowerCase(),
    componentName: componentRoot?.getAttribute('data-systemx-component') || '',
    componentTag: componentRoot?.tagName?.toLowerCase() || '',
    textEditable: textInfo.editable,
    textReason: textInfo.reason,
    textValue: textInfo.text,
    originalText: textInfo.originalText || '',
  }
}

function locationSummary(location) {
  const source = location.sourcePath || 'source unmapped'
  return `${location.route} · ${source} · ${location.domPath}`
}

function makePreviewSelectionAnchor(location) {
  return {
    route: location.route.split('#')[0] || '/',
    domPath: location.domPath,
    sourcePath: location.sourcePath,
    tag: location.tag,
    text: location.originalText || location.textValue || '',
  }
}

function findPreviewElement(anchor) {
  const frameDocument = previewDocument()
  if (!frameDocument || !anchor) return null

  if (anchor.domPath) {
    try {
      const direct = frameDocument.querySelector(anchor.domPath)
      if (direct && (!anchor.tag || direct.tagName.toLowerCase() === anchor.tag)) return direct
    } catch {
      // Fall through to the bounded structural search below.
    }
  }

  const selector = /^[a-z][a-z0-9-]*$/i.test(anchor.tag ?? '') ? anchor.tag : '*'
  return [...frameDocument.querySelectorAll(selector)].slice(0, 500).find((candidate) => (
    domPath(candidate) === anchor.domPath
    && (!anchor.text || candidate.textContent?.trim() === anchor.text)
  )) ?? null
}

function schedulePreviewInspector(attempt = 0) {
  const frame = document.querySelector('#app-preview-frame')
  if (!frame || frame.hidden) return
  if (state.previewInspectorRetry) window.clearTimeout(state.previewInspectorRetry)
  if (previewDocument()) {
    installPreviewInspector()
    return
  }
  if (attempt >= 40) {
    text('#preview-selection-location', 'Inspection requires the same-origin Vite bridge')
    return
  }
  state.previewInspectorRetry = window.setTimeout(() => {
    state.previewInspectorRetry = null
    schedulePreviewInspector(attempt + 1)
  }, 100)
}

function clearPreviewSelection() {
  identityInspector?.observePreviewSelection({})
  state.previewSelectedElement?.removeAttribute('data-systemx-inspector-selected')
  state.previewSelectedElement = null
  state.previewHoveredElement = null
  state.previewSelection = null
  state.previewSelectionAnchor = null
  state.previewTextSource = null
  state.previewTextSourcePending = null
  state.previewTextSourceGeneration += 1
  state.previewLayerElements = []
  hidePreviewContextMenu()
  renderPreviewBreadcrumbs()
  renderPreviewNavigator()
  text('#selected-element-state', 'Page canvas')
  text('#settings-element-state', 'Page canvas')
  text('#settings-element-location', 'Select an element in the live preview to inspect its stack location.')
  text('#style-text-target', 'No text target selected')
  text('#style-text-state', 'Select a heading, paragraph, label, button, or other leaf-text element.')
  text('#style-element-location', 'Click a text element in the live canvas to edit it here.')
  setControlValue('#settings-text-editor', '')
  setControlDisabled('#settings-text-editor', true)
  setControlDisabled('#settings-text-preview', true)
  setControlDisabled('#settings-text-revert', true)
  setControlDisabled('#settings-text-source', true)
  setControlDisabled('#settings-text-confirmation', true)
  setControlDisabled('#settings-text-save', true)
  setControlDisabled('#settings-text-reload', true)
  text('#settings-source-revision', 'No source revision loaded.')
  setControlDisabled('#style-edit-text', true)
  text('#settings-text-state', 'select leaf text')
  output('#preview-selection-location', 'Select an element · right-click for actions')
}

function restorePreviewSelection() {
  const anchor = state.previewSelectionAnchor
  if (!anchor) return
  const route = currentPreviewRoute().split('#')[0] || '/'
  if (anchor.route && anchor.route !== route) {
    clearPreviewSelection()
    return
  }
  const element = findPreviewElement(anchor)
  if (!element) {
    output('#preview-selection-location', `Selection target is not available after reload: ${anchor.domPath}`)
    return
  }
  selectPreviewElement(element, { restoring: true })
}

function renderPreviewParentList(element) {
  const list = document.querySelector('#preview-parent-list')
  if (!list) return
  list.replaceChildren()
  state.previewParentElements = []
  let parent = element.parentElement
  while (parent && parent.tagName !== 'HTML' && state.previewParentElements.length < 8) {
    const index = state.previewParentElements.push(parent) - 1
    const button = create('button', '', elementLabel(parent))
    button.type = 'button'
    button.dataset.previewParentIndex = String(index)
    button.setAttribute('role', 'menuitem')
    list.append(button)
    parent = parent.parentElement
  }
}

function resetPreviewNavigator() {
  state.previewNavigatorObserver?.disconnect()
  state.previewNavigatorObserver = null
  if (state.previewNavigatorTimer) window.clearTimeout(state.previewNavigatorTimer)
  state.previewNavigatorTimer = null
  state.previewNavigatorSnapshot = null
  state.previewNavigatorRows = []
  state.previewNavigatorExpanded.clear()
  state.previewNavigatorFocus = null
  state.previewNavigatorRoute = null
  state.previewLayerElements = []
  renderPreviewNavigator()
}

function renderPreviewBreadcrumbs() {
  const container = document.querySelector('#canvas-element-breadcrumbs')
  if (!container) return
  container.replaceChildren()
  state.previewBreadcrumbElements = []
  const selected = state.previewSelectedElement
  const root = previewDocument()?.body
  if (!isCurrentPreviewElement(selected, root)) {
    const label = create('strong', '', 'Body')
    label.id = 'canvas-breadcrumb-element'
    container.append(label)
    return
  }
  const elements = []
  let current = selected
  while (current && elements.length <= previewNavigatorLimits.depth) {
    elements.unshift(current)
    if (current === root) break
    current = current.parentElement
  }
  if (elements[0] !== root) container.append(create('span', 'breadcrumb-limited', '… path limited'))
  for (const element of elements) {
    if (container.children.length) container.append(create('span', '', '›'))
    const entry = state.previewNavigatorSnapshot?.byElement.get(element)
    // Labels use authored metadata only; never aggregate a subtree's text or input values.
    const label = entry?.label || element.tagName.toLowerCase()
    const button = create('button', 'breadcrumb-element', label)
    button.type = 'button'
    button.dataset.previewBreadcrumbIndex = String(state.previewBreadcrumbElements.push(element) - 1)
    if (element === selected) {
      button.id = 'canvas-breadcrumb-element'
      button.setAttribute('aria-current', 'true')
    }
    container.append(button)
  }
}

function renderPreviewNavigator({ focus = false, reveal = false } = {}) {
  const tree = document.querySelector('#preview-layer-tree')
  if (!tree) return
  const hadFocus = tree.contains(document.activeElement)
  tree.replaceChildren()
  state.previewLayerElements = []
  const snapshot = state.previewNavigatorSnapshot
  if (!snapshot) {
    state.previewNavigatorRows = []
    output('#preview-layer-summary', 'Live hierarchy unavailable. Open the same-origin Vite preview to inspect elements.')
    return
  }
  const projection = projectPreviewRows(snapshot, { expanded: state.previewNavigatorExpanded, query: state.previewNavigatorQuery })
  const rows = projection.rows
  state.previewNavigatorRows = rows
  if (!rows.some((entry) => entry.element === state.previewNavigatorFocus)) {
    state.previewNavigatorFocus = rows.find((entry) => entry.element === state.previewSelectedElement)?.element || rows[0]?.element || null
  }
  let focusedRow
  rows.forEach((entry) => {
    const index = state.previewLayerElements.push(entry.element) - 1
    const selected = entry.element === state.previewSelectedElement
    const button = create('button', `preview-layer-row${selected ? ' selected' : ''}${entry.matched ? ' search-match' : ''}`)
    button.type = 'button'
    button.dataset.previewLayerIndex = String(index)
    button.dataset.previewDepth = String(Math.min(entry.depth, 8))
    button.setAttribute('role', 'treeitem')
    button.setAttribute('aria-level', String(entry.depth + 1))
    button.setAttribute('aria-selected', String(selected))
    const siblings = entry.parent?.children || [entry]
    button.setAttribute('aria-posinset', String(siblings.findIndex((sibling) => sibling.element === entry.element) + 1))
    button.setAttribute('aria-setsize', String(siblings.length))
    button.tabIndex = entry.element === state.previewNavigatorFocus ? 0 : -1
    if (entry.children.length) button.setAttribute('aria-expanded', String(entry.expanded))
    const toggle = create('span', '', entry.children.length ? entry.expanded ? '▾' : '▸' : selected ? '◎' : '·')
    if (entry.children.length) toggle.dataset.previewToggle = 'true'
    toggle.setAttribute('aria-hidden', 'true')
    const flags = [entry.hidden && 'hidden', entry.inert && 'inert', entry.ariaHidden && 'ARIA hidden'].filter(Boolean)
    button.append(
      toggle,
      create('small', '', `${entry.label}${flags.length ? ` (${flags.join(', ')})` : ''}`),
    )
    tree.append(button)
    if (button.tabIndex === 0) focusedRow = button
  })
  const result = projection.query
    ? `${projection.matchCount} match${projection.matchCount === 1 ? '' : 'es'} in ${snapshot.entries.length} inspected nodes`
    : `${snapshot.entries.length} inspected nodes · ${rows.length} visible rows`
  const selectedOutside = state.previewSelectedElement && !snapshot.byElement.has(state.previewSelectedElement)
    ? ' Selected element is outside the inspected range.' : ''
  const empty = projection.query && !projection.matchCount
    ? projection.truncated ? ' No matches in the inspected range; the search is incomplete.' : ' No matching element metadata.' : ''
  output('#preview-layer-summary', `${result}.${empty}${selectedOutside} ${projection.reasons.join(' ')}`.trim())
  if (focus || hadFocus) focusedRow?.focus({ preventScroll: true })
  if (reveal) tree.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function expandPreviewAncestors(element) {
  for (const entry of ancestorPreviewEntries(state.previewNavigatorSnapshot, element)) {
    if (entry.parent) state.previewNavigatorExpanded.add(entry.parent.element)
  }
}

function rebuildPreviewNavigator() {
  state.previewNavigatorTimer = null
  const root = previewDocument()?.body
  if (!root) { resetPreviewNavigator(); return }
  const previous = state.previewNavigatorSnapshot
  const newDocument = previous?.root !== root
  const route = currentPreviewRoute().split('#')[0] || '/'
  if (newDocument) state.previewNavigatorExpanded.clear()
  state.previewNavigatorSnapshot = collectPreviewHierarchy(root)
  const currentElements = state.previewNavigatorSnapshot.byElement
  state.previewNavigatorExpanded = new Set([...state.previewNavigatorExpanded].filter((element) => currentElements.has(element)))
  if (newDocument) state.previewNavigatorExpanded.add(root)
  if (state.previewSelectedElement && (!isCurrentPreviewElement(state.previewSelectedElement, root)
    || state.previewNavigatorRoute && state.previewNavigatorRoute !== route)) clearPreviewSelection()
  state.previewNavigatorRoute = route
  const page = state.data?.pages?.find((item) => (item.route === '/' ? '/' : String(item.route ?? '').replace(/\/+$/, '')) === route)
  if (page && page.id !== state.selectedPageId) {
    observePreviewPage(page)
  }
  renderPreviewNavigator()
  renderPreviewBreadcrumbs()
}

function schedulePreviewNavigatorRefresh() {
  if (state.previewNavigatorTimer) return
  state.previewNavigatorTimer = window.setTimeout(rebuildPreviewNavigator, 100)
}

function installPreviewNavigator(frameDocument) {
  if (state.previewNavigatorSnapshot?.root !== frameDocument.body) {
    resetPreviewNavigator()
    rebuildPreviewNavigator()
    const observer = new MutationObserver(schedulePreviewNavigatorRefresh)
    observer.observe(frameDocument.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['id', 'class', 'hidden', 'inert', 'aria-hidden', 'data-systemx-name', 'data-systemx-component'],
    })
    state.previewNavigatorObserver = observer
    frameDocument.defaultView?.addEventListener('popstate', schedulePreviewNavigatorRefresh)
    frameDocument.defaultView?.addEventListener('hashchange', schedulePreviewNavigatorRefresh)
  }
}

function revealPreviewElement(element) {
  const root = previewDocument()?.body
  if (!isCurrentPreviewElement(element, root)) {
    rebuildPreviewNavigator()
    output('#preview-layer-summary', 'That element is no longer in the current preview. The hierarchy was refreshed.')
    return false
  }
  const style = element.ownerDocument.defaultView.getComputedStyle(element)
  const unavailable = element.closest('[hidden], [inert]') || style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length
  if (unavailable) {
    output('#preview-layer-summary', 'Element selected for inspection. It is hidden, inert, or has no rendered box; reveal cannot make it visible.')
    return true
  }
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  return true
}

function selectNavigatorElement(element, { focus = false } = {}) {
  if (!isCurrentPreviewElement(element, previewDocument()?.body)) {
    rebuildPreviewNavigator()
    output('#preview-layer-summary', 'That element is no longer in the current preview. The hierarchy was refreshed.')
    return
  }
  state.previewNavigatorFocus = element
  selectPreviewElement(element)
  renderPreviewNavigator({ focus, reveal: true })
  revealPreviewElement(element)
}

function setControlValue(selector, value) {
  const control = document.querySelector(selector)
  if (control) control.value = value
}

function setControlDisabled(selector, disabled) {
  const control = document.querySelector(selector)
  if (control) control.disabled = disabled
}

function renderSelectedElementEditors(element, location) {
  setControlValue('#settings-element-label', location.label)
  setControlValue('#settings-semantic-role', location.tag)
  setControlValue('#settings-element-route', location.route)
  setControlValue('#settings-element-source', location.sourcePath || 'unmapped')
  text('#settings-element-location', `${location.domPath} · ${location.sourcePath || 'source unmapped'}`)
  text('#component-selection-name', location.componentName || location.label)
  text('#component-selection-location', locationSummary(location))

  const editable = Boolean(location.textEditable && location.sourcePath)
  text('#style-element-location', locationSummary(location))
  text('#style-text-target', editable ? location.label : 'No text target selected')
  text('#style-text-state', editable ? `${location.textValue.length} characters · source mapped` : location.textReason)
  setControlDisabled('#style-edit-text', !editable)
  setControlValue('#settings-text-editor', location.textValue || '')
  setControlDisabled('#settings-text-editor', !editable)
  setControlDisabled('#settings-text-preview', !editable)
  setControlDisabled('#settings-text-revert', !editable)
  setControlDisabled('#settings-text-source', !location.sourcePath)
  setControlDisabled('#settings-text-confirmation', !editable)
  const loadedSource = state.previewTextSource
  const sourceReady = loadedSource?.element === element && loadedSource.writable !== false && loadedSource.path === location.sourcePath
  setControlDisabled('#settings-text-save', !editable || !sourceReady || state.previewTextSourcePending === element || state.previewTextSaving === element)
  setControlDisabled('#settings-text-reload', !editable)
  renderSelectedTextRevision()
  text('#settings-text-state', editable ? `${location.textValue.length} characters` : 'not editable')
  output(
    '#settings-text-output',
    editable
      ? `Original: "${location.originalText}". Preview changes stay in this local iframe until explicitly saved.`
      : location.textReason,
  )
  if (!state.previewNavigatorSnapshot?.byElement.has(element)) rebuildPreviewNavigator()
  expandPreviewAncestors(element)
  renderPreviewNavigator({ reveal: true })
  renderPreviewBreadcrumbs()
  if (editable && !sourceReady && state.previewTextSourcePending !== element) {
    void loadSelectedTextSource(element, location.sourcePath).catch((error) => {
      if (state.previewSelectedElement === element) output('#settings-source-revision', error.message)
    })
  }
}

function selectPreviewElement(element, options = {}) {
  if (!isCurrentPreviewElement(element, previewDocument()?.body)) return
  if (state.previewSelectedElement !== element) {
    state.previewTextSource = null
    state.previewTextSourcePending = null
    state.previewTextSourceGeneration += 1
  }
  state.previewSelectedElement?.removeAttribute('data-systemx-inspector-selected')
  element.setAttribute('data-systemx-inspector-selected', '')
  state.previewSelectedElement = element
  state.previewSelection = previewLocation(element)
  state.previewSelectionAnchor = makePreviewSelectionAnchor(state.previewSelection)
  state.previewContextTarget = element
  const location = state.previewSelection
  identityInspector?.observePreviewSelection({
    tag: element.tagName.toLowerCase(), id: element.id?.slice(0, 120) ?? '',
    route: location.route.split('#')[0], sourcePath: location.sourcePath ?? '',
    workspaceId: state.sourceRecoveryWorkspaceId,
    anchor: element.getAttribute('data-systemx-id') ?? '',
  })
  const page = mappedPageForRoute(location.route.split('#')[0])
  text('#canvas-breadcrumb-page', page?.name ?? location.route)
  text('#selected-element-state', location.label)
  text('#settings-element-state', location.label)
  text('#preview-selection-location', locationSummary(location))
  text('#preview-context-label', location.label)
  text('#preview-context-location', locationSummary(location))
  renderPreviewParentList(element)
  renderSelectedElementEditors(element, location)
  output('#canvas-output', `Selected ${location.label} · ${locationSummary(location)}`)
  if (options.openEditor && location.textEditable) {
    activateRightPanel('settings')
    window.requestAnimationFrame(() => document.querySelector('#settings-text-editor')?.focus({ preventScroll: true }))
  }
}

function positionPreviewContextMenu(frameEvent) {
  const menu = document.querySelector('#preview-context-menu')
  const frame = document.querySelector('#app-preview-frame')
  if (!menu || !frame) return
  const frameRect = frame.getBoundingClientRect()
  menu.hidden = false
  setRuntimeStyleRule(
    'context-menu-position',
    `#preview-context-menu { left: ${Math.max(8, frameRect.left + frameEvent.clientX)}px; top: ${Math.max(8, frameRect.top + frameEvent.clientY)}px; }`,
  )
  window.requestAnimationFrame(() => {
    const bounds = menu.getBoundingClientRect()
    const left = Math.min(bounds.left, window.innerWidth - bounds.width - 8)
    const top = Math.min(bounds.top, window.innerHeight - bounds.height - 8)
    setRuntimeStyleRule(
      'context-menu-position',
      `#preview-context-menu { left: ${Math.max(8, left)}px; top: ${Math.max(8, top)}px; }`,
    )
    menu.querySelector('[role="menuitem"]')?.focus()
  })
}

function installPreviewInspector() {
  const frame = document.querySelector('#app-preview-frame')
  const frameDocument = previewDocument()
  if (!frame || !frameDocument) {
    text('#preview-selection-location', 'Inspection requires the same-origin Vite bridge')
    setPreviewInspectMode(false, false)
    resetPreviewNavigator()
    return
  }

  installPreviewNavigator(frameDocument)

  if (!frameDocument.querySelector('#systemx-preview-inspector-style')) {
    const style = frameDocument.createElement('link')
    style.id = 'systemx-preview-inspector-style'
    style.rel = 'stylesheet'
    style.href = new URL('./preview-inspector.css', import.meta.url).href
    frameDocument.head.append(style)
  }

  if (!frameDocument.documentElement.hasAttribute('data-systemx-inspector-bound')) {
    frameDocument.documentElement.setAttribute('data-systemx-inspector-bound', '')
    frameDocument.addEventListener('mouseover', (event) => {
      if (!state.layout.previewInspect || !isElement(event.target)) return
      if (state.previewHoveredElement && state.previewHoveredElement !== event.target) {
        state.previewHoveredElement.removeAttribute('data-systemx-inspector-hover')
      }
      state.previewHoveredElement = event.target
      event.target.setAttribute('data-systemx-inspector-hover', '')
    }, true)
    frameDocument.addEventListener('mouseout', (event) => {
      if (!isElement(event.target) || event.target === state.previewSelectedElement) return
      event.target.removeAttribute('data-systemx-inspector-hover')
    }, true)
    frameDocument.addEventListener('click', (event) => {
      if (!state.layout.previewInspect || !isElement(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      hidePreviewContextMenu()
      selectPreviewElement(event.target)
    }, true)
    frameDocument.addEventListener('dblclick', (event) => {
      if (!state.layout.previewInspect || !isElement(event.target)) return
      const location = previewLocation(event.target)
      if (!location.textEditable) return
      event.preventDefault()
      event.stopImmediatePropagation()
      selectPreviewElement(event.target, { openEditor: true })
    }, true)
    frameDocument.addEventListener('contextmenu', (event) => {
      if (!state.layout.previewInspect || !isElement(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      selectPreviewElement(event.target)
      positionPreviewContextMenu(event)
    }, true)
  }

  frameDocument.documentElement.toggleAttribute('data-systemx-inspect-mode', state.layout.previewInspect)
  frame.classList.toggle('inspect-mode', state.layout.previewInspect)
  text('#preview-selection-location', state.previewSelection
    ? locationSummary(state.previewSelection)
    : 'Select an element · right-click for actions')
  if (state.previewSelectionAnchor) window.setTimeout(restorePreviewSelection, 0)
}

function ensureSourceOption(sourcePath) {
  const select = document.querySelector('#component-source')
  if (!select || !sourcePath) return
  let option = [...select.options].find((item) => item.value === sourcePath)
  if (!option) {
    option = create('option', '', sourcePath)
    option.value = sourcePath
    select.append(option)
  }
  select.value = sourcePath
}

function stagedComponentName(location) {
  const semanticNames = {
    header: 'Site Header',
    footer: 'Site Footer',
    nav: 'Site Navigation',
    main: 'Main Content',
    form: 'Form',
    section: 'Content Section',
  }
  const concise = location.label.replace(/^(Heading [1-6]|Button|Link|Section|Article):\s*/i, '').trim()
  return location.componentName
    || semanticNames[location.componentTag]
    || semanticNames[location.tag]
    || concise.slice(0, 72)
    || 'Reusable Component'
}

function stagePreviewSelection(kind) {
  const location = state.previewSelection
  if (!location) return
  const slotsByTag = {
    header: 'brand, navigation, actions',
    footer: 'legal, navigation',
    nav: 'items, actions',
    form: 'fields, actions',
    section: 'content',
    main: 'content',
  }
  const name = document.querySelector('#component-name')
  const tags = document.querySelector('#component-tags')
  const slots = document.querySelector('#component-slots')
  if (name) name.value = stagedComponentName(location)
  const semanticTag = location.componentTag || location.tag
  if (tags) tags.value = [kind, semanticTag, location.route.replace(/^\//, '') || 'home'].join(', ')
  if (slots) slots.value = slotsByTag[semanticTag] ?? 'content'
  ensureSourceOption(location.sourcePath)
  state.selectedNodeId = null
  activateLeftPanel('components')
  output(
    '#component-output',
    `${kind === 'module' ? 'Module' : 'Component'} staged from ${location.domPath}. Review metadata, type SAVE MODULE, and save when ready.`,
  )
  hidePreviewContextMenu()
}

function openPreviewSource() {
  const sourcePath = state.previewSelection?.sourcePath
  if (!sourcePath) {
    output('#source-output', 'No source file is mapped to the selected preview element.')
    hidePreviewContextMenu()
    return
  }
  const select = document.querySelector('#source-file-select')
  if (select && ![...select.options].some((option) => option.value === sourcePath)) {
    const option = create('option', '', sourcePath)
    option.value = sourcePath
    select.append(option)
  }
  if (select) select.value = sourcePath
  activateRightPanel('source')
  void loadSource().catch((error) => output('#source-output', error.message))
  hidePreviewContextMenu()
}

function selectedTextContext() {
  const element = state.previewSelectedElement
  const location = state.previewSelection
  if (!isElement(element) || !location) throw new Error('Select a text element in the live preview first.')
  const textInfo = editableTextInfo(element)
  if (!textInfo.editable) throw new Error(textInfo.reason)
  if (!location.sourcePath) throw new Error('The selected text does not have a mapped editable source file.')
  return { element, location, textInfo }
}

function validatedTextDraft() {
  const editor = document.querySelector('#settings-text-editor')
  const value = editor?.value?.trim() ?? ''
  if (!value) throw new Error('Text cannot be empty. Use the source editor for structural removal.')
  if (value.length > 2000) throw new Error('Text exceeds the 2,000-character inline-edit limit.')
  return value
}

function escapeJsxText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;')
}

function previewSelectedText() {
  try {
    const { element, textInfo } = selectedTextContext()
    const nextText = validatedTextDraft()
    element.textContent = nextText
    selectPreviewElement(element)
    output(
      '#settings-text-output',
      `Local preview updated. Original: "${textInfo.originalText}". New: "${nextText}". Source is unchanged.`,
    )
  } catch (error) {
    output('#settings-text-output', error.message)
  }
}

function revertSelectedText() {
  try {
    const { element, textInfo } = selectedTextContext()
    element.textContent = textInfo.originalText
    selectPreviewElement(element)
    output('#settings-text-output', `Local preview reverted to: "${textInfo.originalText}".`)
  } catch (error) {
    output('#settings-text-output', error.message)
  }
}

async function saveSelectedText() {
  const confirmation = document.querySelector('#settings-text-confirmation')
  if (confirmation?.value !== 'SAVE TEXT CHANGE') {
    output('#settings-text-output', 'Type SAVE TEXT CHANGE to approve this backed-up source edit.')
    return
  }
  const { element, location, textInfo } = selectedTextContext()
  if (state.previewTextSaving === element) return
  const nextText = validatedTextDraft()
  if (nextText === textInfo.originalText) {
    output('#settings-text-output', 'The text matches the source value; nothing needs to be saved.')
    return
  }
  const source = state.previewTextSource
  if (source?.element !== element || source.writable === false || source.path !== location.sourcePath || source.workspaceId !== state.sourceRecoveryWorkspaceId || !validSourceRevision(source.revision)) {
    output('#settings-text-output', 'Load the latest source revision before saving this text draft.')
    return
  }
  const occurrenceCount = source.content.split(textInfo.originalText).length - 1
  if (occurrenceCount !== 1) {
    output(
      '#settings-text-output',
      occurrenceCount === 0
        ? `The exact original text was not found in ${location.sourcePath}. Open source and review the JSX expression manually.`
        : `The original text occurs ${occurrenceCount} times in ${location.sourcePath}. Open source so the correct occurrence can be reviewed.`,
    )
    return
  }
  const nextContent = source.content.replace(textInfo.originalText, escapeJsxText(nextText))
  let result
  const observation = sourceObservationVersions.get(location.sourcePath) || 0
  state.previewTextSaving = element
  setControlDisabled('#settings-text-save', true)
  try {
    result = await post('/api/builder/source', {
      path: location.sourcePath,
      content: nextContent,
      baseRevision: source.revision,
      sourceKind: 'leaf-text',
      confirmation: 'SAVE LOCAL CHANGE',
    })
    if (!validSourceRevision(result.revision)) throw new Error('Saved source revision is unavailable. Reload latest source before another save.')
  } catch (error) {
    if (sourceRevisionConflict(error)) {
      if (error.currentRevision && source.workspaceId === state.sourceRecoveryWorkspaceId) observeSourceRevision(location.sourcePath, error.currentRevision, 'Selected-text save conflict', true, null, observation)
      if (state.previewSelectedElement === element) {
        if (state.previewTextSource === source) source.currentRevision = observation !== (sourceObservationVersions.get(location.sourcePath) || 0) ? sourceObservedRevisions.get(location.sourcePath) : error.currentRevision
        renderSelectedTextRevision()
        output('#settings-text-output', 'Source changed since this text draft was loaded. The draft and selected source revision are kept. Choose Reload latest source before reviewing and saving again.')
      }
      return
    }
    if (state.previewSelectedElement === element) output('#settings-text-output', `${error.message} Save was not confirmed; the text draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
    return
  } finally {
    if (state.previewTextSaving === element) state.previewTextSaving = null
    if (state.previewSelectedElement === element) setControlDisabled('#settings-text-save', state.previewTextSourcePending === element || source.writable === false || source.workspaceId !== state.sourceRecoveryWorkspaceId)
  }
  const superseded = sourceObservationSuperseded(location.sourcePath, observation, result.revision)
  if (state.previewTextSource === source) state.previewTextSource = { ...source, content: nextContent, revision: result.revision, currentRevision: superseded ? sourceObservedRevisions.get(location.sourcePath) : null }
  if (source.workspaceId === state.sourceRecoveryWorkspaceId) observeSourceRevision(location.sourcePath, result.revision, 'Selected-text save accepted', true, null, observation)
  if (confirmation && state.previewSelectedElement === element) confirmation.value = ''
  state.previewTextOriginals.set(element, nextText)
  element.textContent = nextText
  if (state.previewSelectedElement === element && state.previewSelection) {
    state.previewSelection.textValue = nextText
    state.previewSelection.originalText = nextText
    state.previewSelectionAnchor = makePreviewSelectionAnchor(state.previewSelection)
    renderSelectedTextRevision()
  }
  output(
    '#settings-text-output',
    result.status === 'saved'
      ? `Saved "${nextText}" to ${result.path}. Backup: ${result.backup}. Vite will hot reload; run typecheck, lint, and build next.`
      : `Text source result: ${result.status}.`,
  )
  await refresh()
}

function recordedCounts(source) {
  if (source.taskCount === null || !source.tasksByStatus) return 'Task records unavailable.'
  return source.taskCount === 0 ? 'No work recorded.'
    : `${source.taskCount} recorded ${source.taskCount === 1 ? 'task' : 'tasks'} · ${Object.entries(source.tasksByStatus).map(([name, count]) => `${name}: ${count}`).join(' · ')}`
}

function renderWorkStatus(work) {
  const view = document.querySelector('#work-status-view')
  const select = document.querySelector('#work-scope-select')
  if (!view || !select) return
  view.replaceChildren()
  if (!work || work.schemaVersion !== 1) {
    view.append(create('p', 'panel-help', 'Work source status unavailable.'))
    select.disabled = true
    return
  }
  const card = (title, state, lines, sources = []) => {
    const article = create('article', `work-status-card${state === 'unavailable' ? ' unavailable' : ''}`)
    article.append(create('h4', '', title), create('span', 'badge', state))
    for (const line of lines) article.append(create('p', '', line))
    if (sources.length) {
      const detail = create('details', 'work-status-sources')
      detail.append(create('summary', '', 'Source digests and diagnostics'))
      for (const source of sources) {
        detail.append(create('code', '', source.path), create('small', '', source.diagnostic ?? source.state))
        if (source.sha256) detail.append(create('code', '', `SHA-256 ${source.sha256}`))
        if (Object.hasOwn(source, 'exactStockMatch')) detail.append(create('small', '', `Exact selected stock bytes: ${source.exactStockMatch === null ? 'unavailable' : source.exactStockMatch ? 'match' : 'different'}`))
        if (source.stockDiagnostic) detail.append(create('small', '', `Stock source: ${source.stockDiagnostic}`))
      }
      article.append(detail)
    }
    view.append(article)
  }
  const seed = work.reusableSeed
  card('Reusable work seeds', seed.state, [
    `Selected stock comparison: ${seed.stockMatch}.`, recordedCounts(seed),
    seed.focus ? seed.focus.objective ? `Recorded focus: ${seed.focus.objective}` : 'No focus recorded.' : 'Focus records unavailable.',
    'Exact seed bytes describe task, focus and role records. They do not establish project identity or completion.',
  ], [...seed.sources, ...(seed.supportingSources ?? [])])
  const roadmap = work.roadmap
  card('WebAppX roadmap proposals', roadmap.state, roadmap.state === 'available' ? [
    `${roadmap.project} · ${roadmap.intent} · schema ${roadmap.schemaVersion}`,
    `${roadmap.itemCount} catalog items · ${roadmap.itemsByStatus.todo} proposed TODO · ${roadmap.itemsByStatus.done} recorded source completions`,
    'Catalog completion records do not transfer acceptance to an adopted project.',
  ] : ['Roadmap counts unavailable.'], [roadmap])
  const adopted = work.adoptedProject
  const scope = adopted.selection?.kind === 'child' ? adopted.selection.name : 'root records'
  const lines = adopted.state === 'not-selected' ? ['No adopted scope selected. Choose a scope below to inspect its recorded work.']
    : [`Explicit scope: ${scope}.`, adopted.diagnostic ?? recordedCounts(adopted),
      adopted.focus ? adopted.focus.objective ? `Recorded focus: ${adopted.focus.objective}` : 'No focus recorded.' : 'Focus unavailable.',
      `${adopted.agentRoles?.length ?? 'Unavailable'} registered roles. Role records do not establish running workers.`]
  card('Selected project work', adopted.state, lines, [...(adopted.sources ?? []), ...(adopted.supportingSources ?? []), ...(adopted.identitySource ? [adopted.identitySource] : [])])
  select.replaceChildren(create('option', '', 'No adopted scope selected'))
  select.options[0].value = ''
  const rootOption = create('option', '', 'Root records (explicit selection)')
  rootOption.value = 'root'
  select.append(rootOption)
  for (const name of work.scopeOptions.children ?? []) {
    const option = create('option', '', name)
    option.value = `child:${name}`
    select.append(option)
  }
  const selectionValue = state.workSelection?.kind === 'root' ? 'root' : state.workSelection?.kind === 'child' ? `child:${state.workSelection.name}` : ''
  if (selectionValue && !Array.from(select.options).some((option) => option.value === selectionValue)) {
    const unavailable = create('option', '', `${state.workSelection.name ?? 'Selected scope'} (unavailable)`)
    unavailable.value = selectionValue; select.append(unavailable)
  }
  select.value = selectionValue
  select.disabled = false
  text('#work-scope-help', work.scopeOptions.state === 'available'
    ? `${work.scopeOptions.children.length} registered ${work.scopeOptions.children.length === 1 ? 'child' : 'children'}. Select an exact scope; this reads status only.`
    : `Child scope registry unavailable (${work.scopeOptions.diagnostic ?? 'unreadable'}). Root records can be explicitly inspected.`)
}

function renderStatus(status) {
  state.status = status
  initializeSourceRecovery(status.repository?.workspaceId)
  initializeSourceNavigation(status.repository?.workspaceId)
  const operating = status.operating
  text('#systemx-version-state', operating?.installed
    ? `SYSTEMX ${operating.selectedVersion} · ${operating.updatePolicy} updates · pinned ${operating.pinnedVersion}`
    : 'Managed SYSTEMX installation status unavailable')
  text('#systemx-record-state', operating
    ? `${operating.taskCount ?? 'Unavailable'} root tasks · ${operating.recordDiagnostics?.some((source) => source.path === '.SYSTEMX/AGENTS/REGISTRY.json') ? 'Unavailable' : operating.agentRoles.length} registered roles · ${operating.childProjectCount ?? 'Unavailable'} registered child projects`
    : 'Project records unavailable')
  renderWorkStatus(operating?.workStatus)
  text('#controller-state', 'online')
  text('#controller-detail', `${status.session?.lanUrl ?? '127.0.0.1'} · loopback only`)
  text('#vite-state', status.vite.listening ? 'Online' : 'Offline')
  text('#vite-detail', status.vite.listening ? `Preview app at ${status.vite.url}` : 'Start Vite before editing previews')
  text('#repo-state', status.repository.branch)
  text('#repo-detail', status.repository.clean ? 'Working tree clean' : `${status.repository.changedFiles} changed paths`)
  text('#builder-state', status.builder.writable ? 'Writable' : 'Template edit')
  text('#builder-detail', status.builder.writePolicy ?? 'backup-diff-confirm')
  text('#active-target-state', status.builder.writable ? 'WebApp' : 'Template')
  text('#endpoint-vite', status.vite.url)
  text('#endpoint-lan', status.session?.lanUrl ?? 'unavailable')
  const openApp = document.querySelector('#open-app-link')
  if (openApp) openApp.href = status.vite.url
  const openBridge = document.querySelector('#open-bridge-link')
  const bridgeUrl = status.vite.url ? `${status.vite.url.replace(/\/$/, '')}/__systemx/#command` : ''
  if (openBridge && bridgeUrl) openBridge.href = bridgeUrl
  const openLogin = document.querySelector('#open-login-link')
  if (openLogin && status.vite.url) openLogin.href = `${status.vite.url.replace(/\/$/, '')}/login`
  const appPreview = document.querySelector('#app-preview-frame')
  const previewNotice = document.querySelector('#preview-bridge-notice')
  if (appPreview && previewNotice && status.vite.url) {
    const viteOrigin = new URL(status.vite.url).origin
    const sameOriginPreview = window.location.origin === viteOrigin
    appPreview.hidden = !sameOriginPreview
    previewNotice.hidden = sameOriginPreview
    const binding = `${status.repository?.workspaceId ?? ''}\0${viteOrigin}`
    if (sameOriginPreview && state.previewWorkspaceBinding !== binding) {
      if (state.previewWorkspaceBinding) clearPreviewSelection()
      state.previewWorkspaceBinding = binding
      appPreview.src = status.vite.url
    }
  }
  renderProviders(status.providers ?? [])
  renderAuth(status.auth)
  renderTools(status.tooling ?? [])
  renderComponents(status.workspace?.componentRegistry ?? status.workspace?.components ?? [])
  renderRoutes(status.routes ?? [])
  renderFiles(status.files ?? [])
  renderPageFiles(status.workspace?.sourceFiles ?? [])
  const evidenceSummary = `${status.data?.pages ?? 0} page models · ${status.data?.collections ?? 0} collections · ${status.data?.users ?? 0} local users · ${status.repository.changedFiles} changed paths`
  output('#sync-summary', evidenceSummary)
  output('#inspector-sync-summary', evidenceSummary)
  output('#evidence-count', `${status.repository.changedFiles} changed`)
  if (appPreview && !appPreview.hidden) schedulePreviewInspector()
}

function renderRoutes(routes) {
  const list = document.querySelector('#route-list')
  if (!list) return
  list.replaceChildren()
  text('#route-count', `${routes.length} routes`)
  for (const route of routes) {
    const chip = create('a', 'chip', route.path)
    chip.href = route.url
    chip.rel = 'noreferrer'
    list.append(chip)
  }
}

function renderFiles(files) {
  const list = document.querySelector('#file-list')
  if (!list) return
  list.replaceChildren()
  text('#file-count', `${files.length} files`)
  for (const file of files.slice(0, 220)) list.append(create('span', 'file-chip', file))
}

function sourceNavigationStorageKey() {
  try { return sourceNavigationKey(state.sourceRecoveryWorkspaceId) } catch { return null }
}

function initializeSourceNavigation(workspaceId) {
  const nextId = validSourceRevision(workspaceId) ? workspaceId.toLowerCase() : null
  if (state.sourceInventoryWorkspaceId === nextId) return
  state.sourceInventoryWorkspaceId = nextId
  state.sourceInventoryGeneration += 1
  state.sourceInventoryController?.abort()
  state.sourceInventoryController = null
  state.sourceInventoryLoading = false
  state.sourceInventory = null
  state.sourcePolicyGeneration += 1
  state.sourceNavigationEnabled = false
  state.sourceNavigationPending = null
  setControlValue('#source-extension-filter', '')
  setControlValue('#source-metadata-search', '')
  setControlValue('#source-canonical-path', '')
  const checkbox = document.querySelector('#source-navigation-opt-in')
  if (checkbox) { checkbox.checked = false; checkbox.disabled = !nextId }
  text('#source-workspace-boundary', nextId ? `Current repository checkout · ${nextId}. Files from another checkout are never combined into this picker.` : 'Checkout identity unavailable. Source inventory and remembered navigation are disabled.')
  text('#source-policy-review', 'No policy proposal reviewed.')
  setControlDisabled('#export-source-inventory', true)
  if (!nextId) return
  try {
    const serialized = window.localStorage.getItem(sourceNavigationStorageKey())
    if (serialized !== null) {
      state.sourceNavigationPending = parseSourceNavigation(serialized, nextId)
      state.sourceNavigationEnabled = true
      if (checkbox) checkbox.checked = true
      text('#source-navigation-status', 'Saved navigation metadata found. Current eligible inventory will be checked before restoring only its path and filters; source content will not open automatically.')
    } else text('#source-navigation-status', 'Navigation storage is off. No source text, revision or save authority is stored here.')
  } catch {
    text('#source-navigation-status', 'Saved navigation is invalid or storage is unavailable. No preferences or source were restored; the editor is kept.')
  }
  void refreshSourceInventory()
}

function sourceFileMetadata(path = document.querySelector('#source-file-select')?.value) {
  return state.sourceInventory?.files.find(file => file.path === path) ?? null
}

function sourceCurrentlyWritable() {
  const metadata = state.sourceLoadedWorkspaceId === state.sourceInventoryWorkspaceId ? sourceFileMetadata(state.sourcePath) : null
  return state.sourceWritable && metadata?.writable !== false && metadata?.readable !== false
}

function renderSourceFileMetadata() {
  const selected = document.querySelector('#source-file-select')?.value
  const metadata = sourceFileMetadata(selected)
  const editor = document.querySelector('#source-editor')
  if (editor && state.sourcePath) editor.readOnly = !sourceCurrentlyWritable()
  text('#source-file-metadata', metadata
    ? `${metadata.path}\n${metadata.sizeBytes.toLocaleString('en-US')} bytes · ${metadata.origin} · ${metadata.readable ? 'read eligible' : `read refused (${metadata.reasonCode ?? 'SOURCE_TOO_LARGE'})`}\nRule: ${metadata.ruleId} · policy ${state.sourceInventory.policyRevision}\nWrite kinds: ${metadata.writeKinds.length ? metadata.writeKinds.join(', ') : 'none (read-only)'}. Structural editing unavailable. Generated-origin classification checks recognized filenames and comment markers in the first 4096 bytes only.`
    : selected ? `${selected} · metadata not in this bounded inventory. The loaded draft is kept; refresh eligible files or explicitly reload source to recheck its current eligibility.` : 'No source selected. Select an eligible path explicitly; no neighboring row is activated.')
  updateSourceSaveAvailability()
}

function sourceNavigationFilters() {
  return { extension: document.querySelector('#source-extension-filter')?.value ?? '', search: document.querySelector('#source-metadata-search')?.value ?? '' }
}

function persistSourceNavigation() {
  if (!state.sourceNavigationEnabled || !sourceNavigationStorageKey()) return
  const path = document.querySelector('#source-file-select')?.value ?? ''
  if (path && !sourceFileMetadata(path)) {
    text('#source-navigation-status', 'Navigation was not stored: the selected path has not been revalidated in the eligible inventory. The previous saved metadata and editor are kept.')
    return
  }
  try {
    const value = createSourceNavigation({ workspaceId: state.sourceInventoryWorkspaceId, path, ...sourceNavigationFilters() })
    window.localStorage.setItem(sourceNavigationStorageKey(), JSON.stringify(value))
    text('#source-navigation-status', 'Remembering only an eligible path, extension and metadata search for this checkout. Reopening revalidates the inventory; Load is still explicit. No source text, revision or operation authority is stored.')
  } catch {
    text('#source-navigation-status', 'Navigation metadata could not be stored. Invalid or sensitive filter text and browser storage refusal leave the previous saved metadata and open editor unchanged.')
  }
}

function renderSourceInventory() {
  const inventory = state.sourceInventory
  const select = document.querySelector('#source-file-select')
  if (!inventory || !select) return
  let visible
  try { visible = filterSourceMetadata(inventory.files, sourceNavigationFilters()) } catch {
    text('#source-inventory-status', 'SOURCE_QUERY_INVALID: choose a supported extension and bounded metadata search. The previous selection and draft are kept.')
    return
  }
  const previous = select.value
  const selection = sourcePickerSelection(previous, state.sourcePath, inventory, visible)
  select.replaceChildren()
  const placeholder = create('option', '', 'Select an eligible source file')
  placeholder.value = ''
  select.append(placeholder)
  for (const file of visible) {
    const option = create('option', '', file.path)
    option.value = file.path
    select.append(option)
  }
  if (selection.retained) {
    const retained = create('option', '', `${selection.path} (${sourceFileMetadata(selection.path) ? 'selected, outside filter' : 'loaded, not in bounded inventory'})`)
    retained.value = selection.path
    retained.dataset.sourceInventory = 'not-listed'
    select.append(retained)
  }
  select.value = selection.path
  if (selection.absent) {
    state.sourceTargetGeneration += 1
    invalidateSourceRecoveryReview('Complete inventory no longer includes the selected path. The picker is cleared; the loaded draft and baseline are kept.')
    invalidateSourceHistory()
    stopSourceDraftPreviewRead('The selected path is no longer eligible. The captured preview and draft are kept.')
    invalidateSourceComparison('Complete inventory no longer includes the selected path. No replacement or neighboring selection was activated.')
  }
  const omissions = Object.entries(inventory.omissions).map(([name, count]) => `${name}: ${count}`).join(', ') || 'none'
  text('#source-inventory-status', `${visible.length} shown of ${inventory.files.length} eligible metadata rows in this response. ${inventory.complete ? 'Complete inventory within declared scope.' : inventory.truncated ? 'Inventory truncated; absence does not establish deletion.' : 'Inventory incomplete because some metadata was unavailable; absence does not establish deletion.'}\nLimits: ${inventory.limits.maxBytes} bytes / ${inventory.limits.maxTextUnits} text units per read; depth ${inventory.limits.maxDepth}, ${inventory.limits.maxEntries} directory entries, ${inventory.limits.maxResults} results. Omissions: ${omissions}.${selection.absent ? '\nThe previous selection is no longer eligible; the picker was cleared and loaded draft retained.' : ''}`)
  setControlDisabled('#export-source-inventory', false)
  renderSourceFileMetadata()
}

async function refreshSourceInventory() {
  const workspaceId = state.sourceInventoryWorkspaceId
  if (!workspaceId) return
  const generation = ++state.sourceInventoryGeneration
  const targetGeneration = state.sourceTargetGeneration
  const loadGeneration = state.sourceLoadGeneration
  const loadedPath = state.sourcePath
  const observation = loadedPath ? sourceObservationVersions.get(loadedPath) || 0 : null
  state.sourceInventoryController?.abort()
  const controller = new AbortController()
  state.sourceInventoryController = controller
  state.sourceInventoryLoading = true
  setControlDisabled('#refresh-source-inventory', true)
  text('#source-inventory-status', 'Reading bounded eligible file metadata. Source content and the open draft are unchanged.')
  try {
    const result = await request('/api/builder/source/inventory?limit=500', { signal: controller.signal })
    if (generation !== state.sourceInventoryGeneration || workspaceId !== state.sourceRecoveryWorkspaceId) return
    if (targetGeneration !== state.sourceTargetGeneration || loadGeneration !== state.sourceLoadGeneration || loadedPath !== state.sourcePath || (loadedPath && observation !== (sourceObservationVersions.get(loadedPath) || 0))) {
      text('#source-inventory-status', 'SOURCE_INVENTORY_SUPERSEDED: the selected target, source load or loaded-source observation changed during this inventory read. The previous inventory, selection, draft and baseline are kept. Refresh eligible files for a new observation.')
      return
    }
    const inventory = parseSourceInventory(result, workspaceId)
    state.sourceInventory = inventory
    const saved = state.sourceNavigationPending
    state.sourceNavigationPending = null
    if (saved && targetGeneration === state.sourceTargetGeneration && !state.sourcePath) {
      setControlValue('#source-file-select', '')
      setControlValue('#source-extension-filter', saved.extension)
      setControlValue('#source-metadata-search', saved.search)
      const eligible = inventory.files.some(file => file.path === saved.path)
      if (eligible && saved.path) {
        const option = create('option', '', saved.path)
        option.value = saved.path
        document.querySelector('#source-file-select')?.append(option)
        setControlValue('#source-file-select', saved.path)
      }
      text('#source-navigation-status', eligible || !saved.path ? 'Remembered navigation was revalidated against this checkout. Only selection and filters were restored; source content remains unopened until Load.' : 'Remembered path was not in the current eligible inventory. Filters were restored, no source opened, and no replacement row was selected.')
    }
    renderSourceInventory()
  } catch (error) {
    if (generation !== state.sourceInventoryGeneration) return
    text('#source-inventory-status', `${error.code ? `${error.code}: ` : ''}Inventory read failed or returned invalid workspace metadata. The previous picker, loaded draft and baseline are kept. Refresh eligible files to retry.`)
  } finally {
    if (generation === state.sourceInventoryGeneration) {
      state.sourceInventoryLoading = false
      state.sourceInventoryController = null
      setControlDisabled('#refresh-source-inventory', false)
    }
  }
}

function selectCanonicalSourcePath() {
  const path = document.querySelector('#source-canonical-path')?.value ?? ''
  if (!canonicalSourcePath(path)) {
    output('#source-output', 'SOURCE_PATH_INVALID: use one canonical allowlisted repository-relative path. Absolute paths, traversal, backslashes and encoded aliases are refused before a file request. The previous selection and draft are kept.')
    return
  }
  const file = sourceFileMetadata(path)
  if (!file) {
    const aliases = state.sourceInventory?.files.filter(item => item.path.toLowerCase() === path.toLowerCase()) ?? []
    output('#source-output', `${aliases.length > 1 ? 'SOURCE_CASE_AMBIGUOUS' : aliases.length ? 'SOURCE_CASE_MISMATCH' : 'SOURCE_POLICY_REFUSED'}: that exact path is not in the current eligible inventory. Choose the exact listed spelling or refresh the bounded inventory. The previous selection and draft are kept.`)
    return
  }
  const select = document.querySelector('#source-file-select')
  if (![...select.options].some(option => option.value === path)) {
    const option = create('option', '', `${path} (selected, outside filter)`)
    option.value = path
    select.append(option)
  }
  select.value = path
  select.dispatchEvent(new Event('change'))
  output('#source-output', `${path} selected from current eligible metadata. Choose Load to read its contents explicitly.`)
}

async function reviewSourcePolicy() {
  const workspaceId = state.sourceInventoryWorkspaceId
  if (!workspaceId) return
  const generation = ++state.sourcePolicyGeneration
  const selected = document.querySelector('#source-file-select')?.value
  const selection = canonicalSourcePath(selected) ? `&selection=${encodeURIComponent(selected)}` : ''
  setControlDisabled('#review-source-policy', true)
  text('#source-policy-review', 'Reading reviewed policy comparison; no policy is applied and no source contents are read.')
  try {
    const result = await request(`/api/builder/source/policy?compare=source-pages-only-v1${selection}`)
    if (generation !== state.sourcePolicyGeneration || workspaceId !== state.sourceRecoveryWorkspaceId) return
    if (result.workspaceId !== workspaceId) throw new Error('Policy response belongs to another checkout.')
    const view = { activeRevision: result.activeRevision ?? result.policyRevision, rules: result.rules ?? result.policies,
      reviewedPolicies: result.reviewedPolicies, generatedDetection: result.generatedDetection, structuralEdits: result.structuralEdits,
      comparison: result.comparison ?? { comparedRevision: result.comparedRevision, addedRules: result.addedRules, removedRules: result.removedRules,
        affectedPaths: result.affectedPaths, selectionLosesEligibility: result.selectionLosesEligibility },
      selectedPath: selected || null, mode: 'read-only proposal; active policy remains unchanged' }
    text('#source-policy-review', JSON.stringify(view, null, 2))
  } catch (error) {
    if (generation === state.sourcePolicyGeneration) text('#source-policy-review', `${error.code ?? 'SOURCE_POLICY_UNAVAILABLE'}: policy review did not complete. Active policy, source contents and the open draft are unchanged.`)
  } finally {
    if (generation === state.sourcePolicyGeneration) setControlDisabled('#review-source-policy', false)
  }
}

function exportSourceInventory() {
  if (!state.sourceInventory || state.sourceInventory.workspaceId !== state.sourceRecoveryWorkspaceId) return
  let anchor, url
  try {
    // Revalidate and choose finite public metadata; never dump state/status.
    const payload = parseSourceInventory(state.sourceInventory, state.sourceRecoveryWorkspaceId)
    const json = `${JSON.stringify(payload, null, 2)}\n`
    url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
    anchor = create('a')
    anchor.href = url
    anchor.download = 'systemx-eligible-source-inventory.json'
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
    text('#source-inventory-status', 'Eligible inventory JSON download requested. It contains only bounded eligible path metadata, policy decisions and omission counts; no file bodies, runtime values or credentials. The source and open draft are unchanged.')
  } catch {
    text('#source-inventory-status', 'Inventory download was refused or metadata was invalid. No source or browser record was changed; refresh inventory before retrying.')
  } finally {
    anchor?.remove()
    if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function renderPageFiles(files) {
  if (state.sourceInventory) { renderSourceInventory(); return }
  const select = document.querySelector('#source-file-select')
  if (!select) return
  const previousValue = select.value
  const editable = files.filter((file) => /^(src\/pages\/[^/]+\.tsx|src\/components\/(layout|navigation|shell)\/[^/]+\.tsx|src\/config\/siteControls\.ts|src\/index\.css|src\/router\.tsx)$/.test(file))
  const loadedNotListed = Boolean(state.sourcePath && !editable.includes(state.sourcePath))
  select.replaceChildren()
  const placeholder = create('option', '', 'Select an eligible source file')
  placeholder.value = ''
  select.append(placeholder)
  for (const file of editable) {
    const option = create('option', '', file)
    option.value = file
    select.append(option)
  }
  if (loadedNotListed) {
    const retained = create('option', '', `${state.sourcePath} (loaded, not in current inventory)`)
    retained.value = state.sourcePath
    retained.dataset.sourceInventory = 'not-listed'
    select.append(retained)
  }
  const available = new Set([...editable, ...(loadedNotListed ? [state.sourcePath] : [])])
  const preferredValue = previousValue && available.has(previousValue)
    ? previousValue
    : state.sourcePath && available.has(state.sourcePath) ? state.sourcePath : ''
  if (preferredValue) select.value = preferredValue
  if (loadedNotListed && state.sourceComparison) invalidateSourceComparison('The loaded source is not in the current inventory. The draft and loaded base are kept; compare latest to check its current state before reviewing replacement.')
  else if (previousValue !== select.value && state.sourceComparison) invalidateSourceComparison('Selected source changed. Compare latest and review again.')
  updateSourceSaveAvailability()
}

function renderPages(pages) {
  const list = document.querySelector('#page-list')
  const select = document.querySelector('#canvas-page-select')
  if (!list && !select) return
  const previousSelectValue = select?.value
  list?.replaceChildren()
  select?.replaceChildren()
  text('#page-count', `${pages.length} pages`)
  for (const page of pages) {
    if (list) {
      const button = create('button', `page-card${page.id === state.selectedPageId ? ' selected' : ''}`)
      button.type = 'button'
      button.dataset.pageId = page.id
      button.title = `${page.name} · ${page.route ?? 'unmapped'}`
      button.append(create('strong', '', page.name), create('small', '', `${page.route ?? 'unmapped'} · ${page.source}`))
      list.append(button)
    }
    if (select) {
      const option = create('option', '', `${page.name} · ${page.route ?? 'unmapped'}`)
      option.value = page.id
      option.selected = page.id === state.selectedPageId
      select.append(option)
    }
  }
  if (select && !select.value && previousSelectValue) select.value = previousSelectValue
}

function selectedPage() {
  return state.data?.pages?.find((page) => page.id === state.selectedPageId) ?? null
}

function observePreviewPage(page) {
  state.selectedPageId = page.id
  selectPage(page.id)
  const label = state.previewSelection?.label ?? 'Page canvas'
  text('#selected-element-state', label)
  text('#settings-element-state', label)
}

function selectPage(pageId) {
  const previousPageId = state.selectedPageId
  state.selectedPageId = pageId
  const page = selectedPage()
  renderPages(state.data?.pages ?? [])
  if (!page) return
  if (previousPageId && previousPageId !== pageId) {
    clearPreviewSelection()
    navigatePreviewToPage(page)
  }
  const name = document.querySelector('#page-name')
  const route = document.querySelector('#page-route')
  const source = document.querySelector('#page-source')
  if (name) name.value = page.name ?? ''
  if (route) route.value = page.route ?? ''
  if (source) source.value = page.source ?? ''
  text('#selected-page-state', page.status ?? 'draft')
  text('#selected-element-state', `${page.name} · ${page.route}`)
  text('#settings-element-state', `${page.name} · ${page.route}`)
  text('#canvas-breadcrumb-page', page.name ?? 'Page')
  renderPreviewBreadcrumbs()
  text('#canvas-page-label', `${page.name} · ${page.route}`)
  renderCanvas(page)
}

function renderCanvas(page) {
  const canvas = document.querySelector('#canvas-tree')
  if (!canvas) return
  canvas.replaceChildren()
  const root = page.nodeTree?.nodes?.[page.nodeTree.rootNodeId]
  if (!root) {
    canvas.append(create('p', 'empty-state', 'No node tree exists for this page.'))
    return
  }
  const renderNode = (node, depth = 0) => {
    const row = create('div', 'canvas-node')
    row.classList.toggle('selected', node.id === state.selectedNodeId)
    row.dataset.nodeDepth = String(Math.min(depth, 8))
    const label = create('button', 'node-select', `${node.type} · ${node.label}`)
    label.type = 'button'
    label.dataset.selectNode = node.id
    label.title = 'Select this node for module tagging'
    const remove = create('button', 'node-remove', 'Remove')
    remove.type = 'button'
    remove.dataset.removeNode = node.id
    if (node.id === page.nodeTree.rootNodeId) remove.disabled = true
    row.append(label, remove)
    canvas.append(row)
    for (const childId of node.children ?? []) {
      const child = page.nodeTree.nodes[childId]
      if (child) renderNode(child, depth + 1)
    }
  }
  renderNode(root)
}

function renderComponents(components) {
  state.components = components
  const list = document.querySelector('#component-list')
  const sourceSelect = document.querySelector('#component-source')
  if (!list) return
  list.replaceChildren()
  text('#component-count', `${components.length} components`)
  if (sourceSelect) {
    const current = sourceSelect.value
    sourceSelect.replaceChildren()
    const localOption = create('option', '', 'Local canvas model')
    localOption.value = ''
    sourceSelect.append(localOption)
    for (const component of components.filter((item) => item.source && !item.source.startsWith('local-model:'))) {
      const option = create('option', '', `${component.name ?? component.source} · ${component.source}`)
      option.value = component.source
      sourceSelect.append(option)
    }
    if ([...sourceSelect.options].some((option) => option.value === current)) sourceSelect.value = current
  }
  if (!components.length) {
    list.append(create('p', 'empty-state', 'No reusable components detected yet.'))
    return
  }
  for (const component of components) {
    const card = create('article', 'component-card')
    const header = create('header')
    const symbol = create('span', 'module-symbol', { header: '▰', footer: '▱', section: '▣', overlay: '▧' }[component.role] ?? '◇')
    symbol.setAttribute('aria-hidden', 'true')
    header.append(symbol)
    header.append(create('strong', '', component.name ?? component.id), create('span', 'badge ok', component.status ?? 'detected'))
    card.append(header)
    card.append(create('small', '', `${component.role ?? 'component'} · ${component.responsive?.width ?? 'fluid'} · ${(component.tags ?? []).join(', ')}`))
    card.append(create('code', '', component.source ?? 'local model'))
    list.append(card)
  }
}

function renderCollections(collections) {
  const list = document.querySelector('#collection-list')
  if (!list) return
  list.replaceChildren()
  text('#collection-count', `${collections.length} collections`)
  for (const collection of collections) {
    const button = create('button', `collection-card${collection.id === state.selectedCollectionId ? ' selected' : ''}`)
    button.type = 'button'
    button.dataset.collectionId = collection.id
    button.append(create('strong', '', collection.name), create('small', '', `${collection.provider} · ${collection.status}`), create('span', '', `${collection.rows.length} records`))
    list.append(button)
  }
}

function renderRecords(collection) {
  const list = document.querySelector('#record-list')
  if (!list) return
  list.replaceChildren()
  if (!collection) {
    list.append(create('p', 'empty-state', 'Select a collection.'))
    text('#record-count', '0 records')
    return
  }
  text('#record-count', `${collection.rows.length} records`)
  for (const record of collection.rows) {
    const card = create('article', 'record-card')
    card.append(create('strong', '', record.name ?? record.email ?? 'Untitled record'), create('small', '', `${record.email ?? ''} · ${record.stage ?? record.notes ?? 'local fixture'}`))
    list.append(card)
  }
}

function renderUsers(users) {
  const list = document.querySelector('#user-list')
  if (!list) return
  list.replaceChildren()
  text('#user-count', `${users.length} users`)
  for (const user of users) {
    const card = create('article', 'user-card')
    card.append(create('strong', '', user.email), create('small', '', `${user.role} · ${user.status}`))
    list.append(card)
  }
}

function renderProviders(providers) {
  const list = document.querySelector('#provider-list')
  if (!list) return
  list.replaceChildren()
  for (const provider of providers) {
    const card = create('article', 'provider-card')
    const header = create('header')
    header.append(create('h3', '', provider.name), create('span', `badge ${provider.state}`, provider.label))
    card.append(header, create('p', '', provider.detail))
    list.append(card)
  }
}

function renderAuth(auth) {
  const stateElement = document.querySelector('#auth-runtime-state')
  const detailElement = document.querySelector('#auth-runtime-detail')
  const list = document.querySelector('#auth-provider-list')
  if (!stateElement || !detailElement || !list || !auth) return

  const stateClass = auth.emulatorOnline ? 'ok' : 'warn'
  stateElement.className = `badge ${stateClass}`
  text('#auth-runtime-state', auth.emulatorOnline ? 'local ready' : 'offline')
  text(
    '#auth-runtime-detail',
    `${auth.projectId ?? 'no project'} · ${auth.emulatorUrl} · local policy: ${auth.localAllowedProviders.join(', ')}`,
  )
  list.replaceChildren()
  for (const provider of auth.providers ?? []) {
    const card = create('article', 'provider-card')
    const header = create('header')
    const providerState = provider.state === 'ok' ? 'ok' : provider.state === 'warn' ? 'warn' : ''
    header.append(create('h3', '', provider.label), create('span', `badge ${providerState}`, provider.localLabel))
    card.append(header, create('p', '', provider.localNote))
    card.append(create('small', '', `Production: ${provider.productionState} · ${provider.productionNote}`))
    list.append(card)
  }
}

function renderTools(tools) {
  const list = document.querySelector('#tool-list')
  if (!list) return
  list.replaceChildren()
  text('#tool-count', `${tools.length} tools`)
  for (const tool of tools) {
    const row = create('div', 'tool-row')
    row.append(create('strong', '', tool.command), create('small', '', tool.installed ? tool.version : 'not installed'), create('span', `badge ${tool.installed ? 'ok' : 'warn'}`, tool.installed ? 'ready' : 'missing'))
    list.append(row)
  }
}

async function refresh() {
  const generation = ++state.statusRequestGeneration
  const selection = state.workSelection
  const query = selection?.kind === 'root' ? '?workScope=root'
    : selection?.kind === 'child' ? `?workScope=child&project=${encodeURIComponent(selection.name)}` : ''
  let status, data
  try {
    ;[status, data] = await Promise.all([request(`/api/status${query}`), request('/api/builder/data')])
  } catch (error) {
    if (generation !== state.statusRequestGeneration) return
    throw error
  }
  if (generation !== state.statusRequestGeneration) return
  state.data = data
  renderStatus(status)
  renderPages(data.pages)
  renderUsers(data.users)
  renderCollections(data.collections)
  const currentCollection = data.collections.find((item) => item.id === state.selectedCollectionId) ?? data.collections[0]
  state.selectedCollectionId = currentCollection?.id ?? null
  renderCollections(data.collections)
  renderRecords(currentCollection)
  const previewRoute = currentPreviewRoute().split('#')[0] || '/'
  const previewPage = data.pages.find((item) => {
    const pageRoute = item.route === '/' ? '/' : String(item.route ?? '').replace(/\/+$/, '')
    return pageRoute === previewRoute
  })
  const currentPage = previewPage ?? data.pages.find((item) => item.id === state.selectedPageId) ?? data.pages[0]
  if (currentPage) {
    // A status refresh observes the route. Only the explicit page picker
    // navigates; synchronization must not reload the iframe or move its scroll.
    observePreviewPage(currentPage)
  }
  output('#command-output', 'Workspace refreshed. Local changes remain under SYSTEMX control.')
}

function validSourceRevision(revision) {
  return typeof revision === 'string' && revision.length === 64 && /^[a-f0-9]{64}$/i.test(revision)
}

function sourceDraftPreviewBound(preview = state.sourceDraftPreview) {
  return Boolean(preview && sourceLoadedForWorkspace() && preview.workspaceId === state.sourceRecoveryWorkspaceId && preview.path === state.sourcePath && document.querySelector('#source-file-select')?.value === preview.path)
}

function stopSourceDraftPreviewRead(message) {
  state.sourceDraftPreviewGeneration += 1
  state.sourceDraftPreviewController?.abort()
  state.sourceDraftPreviewController = null
  const preview = state.sourceDraftPreview
  if (preview) {
    if (preview.pending) { preview.currentRevision = null; preview.freshness = 'Unknown' }
    preview.pending = false
    preview.digestPending = false
    if (message) preview.message = message
  }
  renderSourceDraftPreview()
}

function renderSourceDraftPreview() {
  const panel = document.querySelector('#source-draft-preview')
  if (!panel) return
  const preview = state.sourceDraftPreview
  panel.hidden = !preview
  setControlDisabled('#preview-source-draft', state.sourceLoading || state.sourceSaving || !sourceLoadedForWorkspace() || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== state.sourcePath)
  if (!preview) return
  const bound = sourceDraftPreviewBound(preview)
  const edited = !bound || document.querySelector('#source-editor')?.value !== preview.draftDisplay
  const baselineChanged = bound && state.sourceRevision !== preview.loadedRevision
  panel.dataset.freshness = preview.freshness.toLowerCase()
  panel.dataset.edited = String(edited)
  text('#source-draft-preview-path', preview.path)
  text('#source-draft-preview-loaded-revision', preview.loadedRevision)
  text('#source-draft-preview-draft-revision', preview.draftRevision || (preview.digestPending ? 'Calculating displayed draft digest…' : 'Not calculated; choose Preview draft again'))
  text('#source-draft-preview-current-revision', preview.currentRevision || (preview.pending ? 'Checking source…' : preview.freshness === 'Unavailable' ? 'Unavailable' : 'Unknown'))
  text('#source-draft-preview-text', preview.excerpt)
  text('#source-draft-preview-summary', `${preview.draftDisplay.length} UTF-16 units captured · ${preview.excerpt.length} displayed · ${preview.draftDisplay.length - preview.excerpt.length} omitted${preview.excerpt.length < preview.draftDisplay.length ? ' (display truncated)' : ''}. Digest covers the complete displayed editor draft encoded as UTF-8; the loaded baseline hashes raw source bytes.`)
  text('#source-draft-preview-status', `${preview.freshness} source observation${preview.pending ? ' · check pending' : ''}. ${!bound ? 'Selected source changed; this snapshot belongs to its captured path. ' : baselineChanged ? 'Loaded baseline changed; this snapshot retains its original baseline. ' : ''}${edited ? 'Draft edited or target changed since preview; captured text and digest are kept. ' : 'Draft matches the captured snapshot. '}${preview.message || ''}`)
  setControlDisabled('#check-source-draft-preview', !bound || preview.pending || state.sourceLoading || state.sourceSaving || !preview.draftRevision)
}

function sourceObservationSuperseded(path, observation, revision) {
  return observation !== (sourceObservationVersions.get(path) || 0) && sourceObservedRevisions.get(path) !== revision
}

function observeSourceRevision(path, revision, reason, invalidateReview = true, ownPreviewRead = null, observation = null, invalidateRecovery = true) {
  if (!validSourceRevision(revision)) return
  if (observation !== null && sourceObservationSuperseded(path, observation, revision)) {
    if (path === state.sourcePath) {
      if (sourceObservedRevisions.get(path) === null) setSourceUnavailable(path)
      else { state.sourceConflictRevision = sourceObservedRevisions.get(path); renderSourceRevision() }
    }
    return
  }
  if (invalidateRecovery && state.sourceRecoveryRecord?.path === path) invalidateSourceRecoveryReview('A source observation changed. Review saved draft again before restoring.')
  if (state.sourceExport?.review.path === path) invalidateSourceExport('A newer source observation requires a fresh export scope and inclusion confirmation.')
  if (state.sourceHistory?.path === path) { state.sourceHistory.stale = true; renderSourceHistory() }
  sourceObservationVersions.set(path, (sourceObservationVersions.get(path) || 0) + 1)
  sourceObservedRevisions.set(path, revision)
  if (path === state.sourcePath) {
    state.sourceConflictRevision = revision === state.sourceRevision ? null : revision
    renderSourceRevision()
  }
  if (path === 'src/index.css') {
    state.fontSourceUnavailable = false
    if (validSourceRevision(state.projectFont?.revision) && state.projectFont.revision !== revision) {
      state.fontConflictRevision = revision
      state.fontSourceNeedsRefresh = true
    }
    renderFontSourceRevision()
  }
  if (invalidateReview && state.sourceComparison?.path === path && (state.sourceComparison.currentRevision || state.sourceComparison.loadedRevision) !== revision) invalidateSourceComparison(`${reason}: source revision changed. Compare latest and review again.`)
  const preview = state.sourceDraftPreview
  if (preview?.path === path) {
    if (preview.pending && preview !== ownPreviewRead) stopSourceDraftPreviewRead('A newer source observation superseded the pending check.')
    preview.currentRevision = revision
    preview.freshness = revision === preview.loadedRevision ? 'Current' : 'Changed'
    preview.message = `${reason} observed this revision. A read is a snapshot, not an exclusive lock; Check source again for a fresh observation.`
    renderSourceDraftPreview()
  }
}

function observeSourceUnavailable(path) {
  sourceObservationVersions.set(path, (sourceObservationVersions.get(path) || 0) + 1)
  sourceObservedRevisions.set(path, null)
  if (path === state.sourcePath) setSourceUnavailable(path)
  const preview = state.sourceDraftPreview
  if (preview?.path === path) {
    preview.currentRevision = null
    preview.freshness = 'Unavailable'
    preview.message = 'Source is unavailable. The captured text, draft and loaded baseline are kept; no file will be recreated.'
    renderSourceDraftPreview()
  }
}

async function checkSourceDraftPreview() {
  const preview = state.sourceDraftPreview
  if (!sourceDraftPreviewBound(preview) || !preview.draftRevision || preview.pending || state.sourceLoading || state.sourceSaving) return
  stopSourceDraftPreviewRead()
  const generation = state.sourceDraftPreviewGeneration
  const observation = sourceObservationVersions.get(preview.path) || 0
  const workspaceId = state.sourceRecoveryWorkspaceId
  const controller = new AbortController()
  state.sourceDraftPreviewController = controller
  preview.pending = true
  preview.currentRevision = null
  preview.freshness = 'Unknown'
  preview.message = 'Reading source revision only; the captured text and raw draft are kept.'
  renderSourceDraftPreview()
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(preview.path)}`, { signal: controller.signal })
    if (generation !== state.sourceDraftPreviewGeneration || state.sourceDraftPreview !== preview || !sourceDraftPreviewBound(preview)) return
    if (observation !== (sourceObservationVersions.get(preview.path) || 0)) throw new Error('A newer source observation arrived while checking. Check source again.')
    if (!sourceSnapshotForWorkspace(result, workspaceId) || result.path !== preview.path || !validSourceRevision(result.revision)) throw new Error('Source revision is unavailable.')
    observeSourceRevision(preview.path, result.revision, 'Explicit preview check', true, preview)
  } catch (error) {
    if (generation !== state.sourceDraftPreviewGeneration || state.sourceDraftPreview !== preview || !sourceDraftPreviewBound(preview)) return
    if (sourceUnavailable(error)) observeSourceUnavailable(preview.path)
    else {
      preview.currentRevision = null
      preview.freshness = 'Unknown'
      preview.message = `${error.message} Source freshness is unknown. The snapshot, raw draft and loaded baseline are kept; check the local connection and Check source again.`
    }
  } finally {
    if (generation === state.sourceDraftPreviewGeneration && state.sourceDraftPreview === preview) {
      preview.pending = false
      state.sourceDraftPreviewController = null
      renderSourceDraftPreview()
    }
  }
}

async function previewSourceDraft() {
  const editor = document.querySelector('#source-editor')
  if (!editor || !state.sourcePath || !sourceLoadedForWorkspace() || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || document.querySelector('#source-file-select')?.value !== state.sourcePath) return
  if (editor.value.length > sourceDraftPreviewLimits.characters) {
    output('#source-output', `Draft exceeds the ${sourceDraftPreviewLimits.characters}-unit preview limit. The previous snapshot, draft and loaded base are kept.`)
    return
  }
  stopSourceDraftPreviewRead()
  const generation = state.sourceDraftPreviewGeneration
  const draftDisplay = editor.value
  let excerpt = draftDisplay.slice(0, sourceDraftPreviewLimits.displayedCharacters)
  if (/[\uD800-\uDBFF]$/.test(excerpt) && excerpt.length < draftDisplay.length) excerpt = excerpt.slice(0, -1)
  const preview = { path: state.sourcePath, workspaceId: state.sourceRecoveryWorkspaceId, loadedRevision: state.sourceRevision, draftDisplay, excerpt, draftRevision: null, currentRevision: null, freshness: 'Unknown', pending: false, digestPending: true, message: 'Capturing a literal text snapshot; no source is saved or executed.' }
  state.sourceDraftPreview = preview
  renderSourceDraftPreview()
  try {
    const digest = await sourceTextDigest(draftDisplay)
    if (generation !== state.sourceDraftPreviewGeneration || state.sourceDraftPreview !== preview || !sourceDraftPreviewBound(preview) || state.sourceRevision !== preview.loadedRevision) return
    preview.draftRevision = digest
    preview.digestPending = false
    await checkSourceDraftPreview()
  } catch (error) {
    if (generation !== state.sourceDraftPreviewGeneration || state.sourceDraftPreview !== preview) return
    preview.digestPending = false
    preview.message = `Displayed draft digest is unavailable: ${error.message}. The draft and baseline are kept.`
    renderSourceDraftPreview()
  }
}

function sourceRevisionConflict(error) {
  return error.status === 409 && error.code === 'SOURCE_REVISION_CONFLICT'
}

function sourceUnavailable(error) {
  return error.status === 404 && error.code === 'SOURCE_UNAVAILABLE'
}

function setSourceUnavailable(path) {
  if (state.sourceRecoveryRecord?.path === path) invalidateSourceRecoveryReview('Source is unavailable. The saved recovery slot and open editor are kept; review again after restoring it externally.')
  invalidateSourceExport('Source is unavailable. Export requires a new completed comparison.')
  if (state.sourceHistory?.path === path) { state.sourceHistory.stale = true; renderSourceHistory() }
  sourceObservationVersions.set(path, (sourceObservationVersions.get(path) || 0) + 1)
  sourceObservedRevisions.set(path, null)
  if (state.sourceDraftPreview?.path === path) stopSourceDraftPreviewRead('Source is unavailable; pending checks are discarded.')
  const preview = state.sourceDraftPreview
  if (preview?.path === path) { preview.currentRevision = null; preview.freshness = 'Unavailable'; preview.message = 'Source is unavailable; captured text and baseline are kept.'; renderSourceDraftPreview() }
  if (path === state.sourcePath) { state.sourceUnavailable = true; state.sourceConflictRevision = null }
  invalidateSourceComparison('Source is unavailable. The retained draft and loaded base are kept; no file will be recreated.', path !== state.sourcePath)
  const availability = document.querySelector('#source-availability')
  if (availability) {
    availability.hidden = false
    availability.textContent = 'Source is unavailable. The draft and loaded revision are kept. Restore the file externally or select an existing allowlisted file and reload. No file will be recreated.'
  }
  renderSourceRevision()
  output('#source-output', 'Source is unavailable. The draft and loaded revision are kept; no file will be recreated. Select an existing file or restore it externally, then reload.')
  updateSourceSaveAvailability()
}

function clearSourceUnavailable() {
  state.sourceUnavailable = false
  const availability = document.querySelector('#source-availability')
  if (availability) { availability.hidden = true; availability.textContent = '' }
}

function sourceLoadedForWorkspace() {
  return validSourceRevision(state.sourceRecoveryWorkspaceId) && state.sourceLoadedWorkspaceId === state.sourceRecoveryWorkspaceId
}

function sourceSnapshotForWorkspace(result, workspaceId) {
  return validSourceRevision(workspaceId) && state.sourceRecoveryWorkspaceId === workspaceId && result.workspaceId === workspaceId
}

function sourceRecoveryKey() {
  return validSourceRevision(state.sourceRecoveryWorkspaceId) ? `systemx.lan.source-recovery.v1.${state.sourceRecoveryWorkspaceId}` : null
}

function renderSourceRecovery() {
  const panel = document.querySelector('#source-recovery')
  if (!panel) return
  panel.dataset.state = state.sourceRecoveryState
  const record = state.sourceRecoveryRecord, review = state.sourceRecoveryReview
  const busy = state.sourceRecoveryBusy || state.sourceLoading || state.sourceSaving
  const checkbox = document.querySelector('#source-recovery-opt-in')
  if (checkbox) { checkbox.checked = state.sourceRecoveryEnabled; checkbox.disabled = !sourceRecoveryKey() }
  text('#source-recovery-path', record?.path || 'No saved draft')
  text('#source-recovery-base-revision', record?.baseRevision || 'Not available')
  text('#source-recovery-current-revision', review?.currentRevision || (state.sourceRecoveryState === 'unavailable' ? 'Unavailable' : 'Not checked'))
  text('#source-recovery-draft-digest', record?.draftDigest || 'Not available')
  let excerpt = record ? record.draftDisplay.slice(0, 20000) : ''
  if (record && /[\uD800-\uDBFF]$/.test(excerpt) && excerpt.length < record.draftDisplay.length) excerpt = excerpt.slice(0, -1)
  text('#source-recovery-draft', excerpt)
  text('#source-recovery-summary', record ? `${record.draftDisplay.length} displayed draft units stored; ${excerpt.length} displayed; ${record.draftDisplay.length - excerpt.length} omitted from this literal excerpt. The saved raw baseline is retained, including line endings. Nothing is restored automatically.` : 'One recovery slot per checkout in this browser origin. Turning recovery off or Discard saved draft removes only that slot.')
  text('#source-recovery-status', state.sourceRecoveryMessage)
  setControlDisabled('#store-source-recovery', busy || !state.sourceRecoveryEnabled || !sourceRecoveryKey() || state.sourceLoadedWorkspaceId !== state.sourceRecoveryWorkspaceId || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== state.sourcePath)
  setControlDisabled('#review-source-recovery', busy || !state.sourceRecoveryEnabled || !sourceRecoveryKey())
  setControlDisabled('#restore-source-recovery', busy || !review || review.generation !== state.sourceRecoveryGeneration || !['matching', 'stale'].includes(state.sourceRecoveryState))
  setControlDisabled('#discard-source-recovery', !sourceRecoveryKey() || (!state.sourceRecoveryHasStored && !record))
}

function invalidateSourceRecoveryReview(message) {
  state.sourceRecoveryGeneration += 1
  state.sourceRecoveryController?.abort()
  state.sourceRecoveryController = null
  state.sourceRecoveryBusy = false
  state.sourceRecoveryReview = null
  state.sourceRecoveryState = state.sourceRecoveryRecord ? 'stored' : state.sourceRecoveryHasStored ? 'invalid' : 'empty'
  if (message) state.sourceRecoveryMessage = message
  renderSourceRecovery()
}

function readSourceRecoveryRecord() {
  const key = sourceRecoveryKey()
  if (!key) throw new Error('Checkout identity is unavailable; recovery storage remains off.')
  const serialized = window.localStorage.getItem(key)
  state.sourceRecoveryHasStored = serialized !== null
  if (serialized === null) { state.sourceRecoveryRecord = null; return null }
  const record = parseRecoveryRecord(serialized, state.sourceRecoveryWorkspaceId)
  state.sourceRecoveryRecord = record
  return { record, serialized }
}

function initializeSourceRecovery(workspaceId) {
  const nextId = validSourceRevision(workspaceId) ? workspaceId : null
  if (state.sourceRecoveryWorkspaceId === nextId) return
  const previousId = state.sourceRecoveryWorkspaceId
  invalidateSourceRecoveryReview()
  state.sourceRecoveryWorkspaceId = nextId
  state.sourceRecoveryRecord = null
  state.sourceRecoveryHasStored = false
  state.sourceRecoveryEnabled = false
  if (previousId) {
    stopSourceDraftPreviewRead('Checkout changed. The literal preview retains its previous checkout snapshot; load source explicitly before making a new preview.')
    if (state.sourceDraftPreview) { state.sourceDraftPreview.currentRevision = null; state.sourceDraftPreview.freshness = 'Unknown' }
    invalidateSourceComparison('Checkout changed. The raw draft and old loaded baseline are kept; load the current checkout source explicitly before reviewing replacement.', true)
    setControlValue('#source-confirmation', '')
    invalidateSourceHistory()
    state.sourceHistory = null
    sourceObservationVersions.clear()
    sourceObservedRevisions.clear()
    state.fontSourceGeneration += 1
    state.fontIntentGeneration += 1
    state.fontSourceLoading = false
    state.fontSourceNeedsRefresh = true
    state.fontSourceUnavailable = false
    state.fontConflictRevision = null
    setControlValue('#font-confirmation', '')
    setControlDisabled('#settings-text-save', true)
    renderFontSourceRevision()
    renderSelectedTextRevision()
    renderSourceRevision()
    updateSourceSaveAvailability()
  }
  if (!nextId) {
    state.sourceRecoveryMessage = 'Checkout identity is unavailable. Recovery remains disabled; the open editor and saved browser slots are kept.'
    renderSourceRecovery()
    return
  }
  try {
    const saved = readSourceRecoveryRecord()
    state.sourceRecoveryEnabled = Boolean(saved)
    state.sourceRecoveryState = saved ? 'stored' : 'empty'
    state.sourceRecoveryMessage = saved ? 'A local saved draft is available. Review saved draft reads current source before offering Restore; the editor is unchanged.' : 'Local draft recovery is off. Opt in and Store recovery draft to keep an explicit snapshot; typing never stores it.'
  } catch {
    state.sourceRecoveryState = 'invalid'
    state.sourceRecoveryMessage = 'Local recovery storage is unavailable or the stored record is invalid. Nothing was restored. Discard the saved slot or check browser storage access.'
  }
  renderSourceRecovery()
}

async function storeSourceRecovery() {
  const editor = document.querySelector('#source-editor')
  if (!editor || !state.sourceRecoveryEnabled || !sourceRecoveryKey() || state.sourceLoadedWorkspaceId !== state.sourceRecoveryWorkspaceId || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || state.sourceRecoveryBusy || document.querySelector('#source-file-select')?.value !== state.sourcePath) return
  invalidateSourceRecoveryReview('Validating the explicit recovery snapshot; no source is saved.')
  const generation = state.sourceRecoveryGeneration
  const input = { schemaVersion: 1, workspaceId: state.sourceRecoveryWorkspaceId, path: state.sourcePath, baseRevision: state.sourceRevision, baselineContent: state.sourceLoadedContent, draftDisplay: editor.value, draftDigest: '0'.repeat(64), storedAt: new Date().toISOString() }
  state.sourceRecoveryBusy = true
  state.sourceRecoveryState = 'checking'
  renderSourceRecovery()
  try {
    createRecoveryRecord(input)
    const [baselineDigest, draftDigest] = await Promise.all([sourceTextDigest(input.baselineContent), sourceTextDigest(input.draftDisplay)])
    if (generation !== state.sourceRecoveryGeneration || !state.sourceRecoveryEnabled) return
    if (baselineDigest !== input.baseRevision.toLowerCase()) throw new Error('The raw baseline cannot be reproduced as UTF-8; recovery is unavailable for this source snapshot.')
    const record = createRecoveryRecord({ ...input, draftDigest })
    const prior = readSourceRecoveryRecord()
    if (prior && (prior.record.path !== record.path || prior.record.baseRevision !== record.baseRevision || prior.record.draftDisplay !== record.draftDisplay) && !window.confirm('Replace the one saved recovery draft for this checkout? The open editor and repository are unchanged.')) {
      state.sourceRecoveryState = 'stored'
      state.sourceRecoveryMessage = 'Recovery storage replacement cancelled. The saved record and open draft are kept.'
      return
    }
    if (generation !== state.sourceRecoveryGeneration || !state.sourceRecoveryEnabled || state.sourceRecoveryWorkspaceId !== input.workspaceId || window.localStorage.getItem(sourceRecoveryKey()) !== (prior?.serialized ?? null)) throw new Error('The reviewed recovery slot changed.')
    const serialized = JSON.stringify(record)
    if (serialized.length > sourceRecordLimits.serializedRecovery) throw new Error('The recovery snapshot exceeds its storage limit.')
    window.localStorage.setItem(sourceRecoveryKey(), serialized)
    state.sourceRecoveryRecord = record
    state.sourceRecoveryHasStored = true
    state.sourceRecoveryState = 'stored'
    state.sourceRecoveryMessage = 'Recovery draft stored explicitly in this browser for this checkout. Typing does not update it. Review saved draft before restoring; no source was saved.'
  } catch {
    if (generation !== state.sourceRecoveryGeneration) return
    state.sourceRecoveryState = 'invalid'
    state.sourceRecoveryMessage = 'Recovery snapshot was not stored: unsupported record, sensitive content, size, UTF-8 baseline or browser storage refusal. The open draft and previous stored slot are kept.'
  } finally {
    if (generation === state.sourceRecoveryGeneration) { state.sourceRecoveryBusy = false; renderSourceRecovery() }
  }
}

async function reviewSourceRecovery() {
  if (!state.sourceRecoveryEnabled || !sourceRecoveryKey() || state.sourceLoading || state.sourceSaving || state.sourceRecoveryBusy) return
  invalidateSourceRecoveryReview('Checking the saved baseline against current source. The open draft and loaded base are kept.')
  const generation = state.sourceRecoveryGeneration
  const controller = new AbortController()
  state.sourceRecoveryController = controller
  state.sourceRecoveryBusy = true
  state.sourceRecoveryState = 'checking'
  renderSourceRecovery()
  let saved, observation
  let phase = 'validating'
  try {
    saved = readSourceRecoveryRecord()
    if (!saved) throw new Error('No saved recovery draft is available.')
    const { record } = saved
    const [baselineDigest, draftDigest] = await Promise.all([sourceTextDigest(record.baselineContent), sourceTextDigest(record.draftDisplay)])
    if (generation !== state.sourceRecoveryGeneration) return
    if (baselineDigest !== record.baseRevision.toLowerCase() || draftDigest !== record.draftDigest.toLowerCase()) throw new Error('The saved recovery digests do not match.')
    observation = sourceObservationVersions.get(record.path) || 0
    phase = 'reading'
    const current = await request(`/api/builder/source?path=${encodeURIComponent(record.path)}`, { signal: controller.signal })
    if (generation !== state.sourceRecoveryGeneration) return
    if (!sourceSnapshotForWorkspace(current, record.workspaceId) || sourceObservationSuperseded(record.path, observation, current.revision) || current.path !== record.path || !validSourceRevision(current.revision)) throw new Error('A current source revision was not confirmed.')
    observeSourceRevision(record.path, current.revision, 'Recovery source check', true, null, null, false)
    state.sourceRecoveryReview = { ...saved, generation, writable: current.writable !== false, currentRevision: current.revision, observation: sourceObservationVersions.get(record.path) || 0 }
    state.sourceRecoveryState = current.revision === record.baseRevision.toLowerCase() ? 'matching' : 'stale'
    state.sourceRecoveryMessage = state.sourceRecoveryState === 'matching'
      ? 'Saved baseline matches the observed current revision. Restore saved draft explicitly replaces the open editor and keeps the saved baseline; no source is saved.'
      : 'Saved baseline is stale. Restore saved draft keeps its older baseline and replaces only the open editor. A later normal save will conflict until you compare or explicitly reload.'
  } catch (error) {
    if (generation !== state.sourceRecoveryGeneration) return
    state.sourceRecoveryReview = null
    const superseded = saved && observation !== undefined && observation !== (sourceObservationVersions.get(saved.record.path) || 0)
    state.sourceRecoveryState = sourceUnavailable(error) && !superseded ? 'unavailable' : phase === 'reading' ? 'unknown' : 'invalid'
    state.sourceRecoveryMessage = state.sourceRecoveryState === 'unavailable' ? 'Saved source is unavailable. The saved record and open draft are kept; Restore is disabled and no file will be recreated.' : 'Recovery review was not completed: invalid record, changed observation or local connection failure. The saved slot and open draft are kept; review again before restoring.'
  } finally {
    if (generation === state.sourceRecoveryGeneration) { state.sourceRecoveryBusy = false; state.sourceRecoveryController = null; renderSourceRecovery() }
  }
}

function restoreSourceRecovery() {
  const review = state.sourceRecoveryReview
  if (!review || review.generation !== state.sourceRecoveryGeneration || state.sourceRecoveryBusy || state.sourceLoading || state.sourceSaving || !state.sourceRecoveryEnabled) return
  try {
    if (window.localStorage.getItem(sourceRecoveryKey()) !== review.serialized || review.observation !== (sourceObservationVersions.get(review.record.path) || 0)) throw new Error('Recovery review changed.')
  } catch {
    invalidateSourceRecoveryReview('The saved record or current source observation changed. Review saved draft again before restoring.')
    return
  }
  if (!window.confirm(`Restore the saved draft for ${review.record.path} and replace the open editor draft? Its original baseline is retained; no source file is saved.`)) return
  try {
    if (review !== state.sourceRecoveryReview || review.generation !== state.sourceRecoveryGeneration || !state.sourceRecoveryEnabled || review.record.workspaceId !== state.sourceRecoveryWorkspaceId || window.localStorage.getItem(sourceRecoveryKey()) !== review.serialized || review.observation !== (sourceObservationVersions.get(review.record.path) || 0)) throw new Error('The reviewed recovery slot changed.')
  } catch {
    invalidateSourceRecoveryReview('The saved slot or source observation changed during confirmation. Review saved draft again; the open editor is kept.')
    return
  }
  const record = review.record, editor = document.querySelector('#source-editor'), select = document.querySelector('#source-file-select')
  stopSourceDraftPreviewRead('A recovery draft replaced the open editor. The literal preview keeps its captured snapshot.')
  invalidateSourceComparison('A saved draft was restored. Compare latest again before reviewing replacement.', true)
  state.sourceTargetGeneration += 1
  state.sourceLoadGeneration += 1
  state.sourcePath = record.path
  state.sourceWritable = review.writable !== false
  editor.readOnly = !state.sourceWritable
  state.sourceRevision = record.baseRevision.toLowerCase()
  state.sourceLoadedContent = record.baselineContent
  state.sourceDisplayBaseline = normalizeSourceDisplay(record.baselineContent)
  state.sourceLoadedWorkspaceId = state.sourceRecoveryWorkspaceId
  if (![...select.options].some((option) => option.value === record.path)) { const option = create('option', '', `${record.path} (recovered source)`); option.value = record.path; select.append(option) }
  select.value = record.path
  editor.value = record.draftDisplay
  clearSourceUnavailable()
  state.sourceConflictRevision = review.currentRevision === state.sourceRevision ? null : review.currentRevision
  setControlValue('#source-confirmation', '')
  renderSourceRevision()
  invalidateSourceRecoveryReview('Saved draft restored into the editor with its original baseline. The repository is unchanged. The saved slot remains until you discard or replace it.')
  updateSourceSaveAvailability()
}

function discardSourceRecovery(disable = false) {
  invalidateSourceRecoveryReview()
  if (disable) state.sourceRecoveryEnabled = false
  try {
    const key = sourceRecoveryKey()
    if (!key) throw new Error('Checkout identity unavailable.')
    window.localStorage.removeItem(key)
    state.sourceRecoveryRecord = null
    state.sourceRecoveryHasStored = false
    state.sourceRecoveryState = 'empty'
    state.sourceRecoveryMessage = disable ? 'Local recovery is off and its saved slot was removed. The open draft is kept.' : 'Saved recovery draft discarded. The open editor, loaded base and repository are unchanged.'
  } catch {
    state.sourceRecoveryState = 'unknown'
    state.sourceRecoveryMessage = 'Browser storage refused removal. The saved slot may still exist; the open draft is kept. Recovery will not save automatically.'
  }
  renderSourceRecovery()
}

function comparisonExportMatches(review = state.sourceComparison) {
  return Boolean(review && sourceLoadedForWorkspace() && !review.pending && !review.stale && !state.sourceLoading && !state.sourceSaving && !state.sourceComparing && !state.sourceUnavailable && review.comparison && review.currentTextMatchesRevision
    && review.generation === state.sourceComparisonGeneration && review.path === state.sourcePath && document.querySelector('#source-file-select')?.value === review.path
    && review.loadedRevision === state.sourceRevision && validSourceRevision(review.currentRevision) && validSourceRevision(review.draftRevision)
    && document.querySelector('#source-editor')?.value === review.draftDisplay && sourceContentForDraft(review.draftDisplay) === review.draftContent)
}

function invalidateSourceExport(message) {
  state.sourceExportGeneration += 1
  if (state.sourceExport) { state.sourceExport.stale = true; state.sourceExport.message = message; state.sourceExport.pending = false }
  setControlValue('#source-export-confirmation', '')
  renderSourceExport()
}

function renderSourceExport() {
  const snapshot = state.sourceExport, panel = document.querySelector('#source-export')
  if (!panel) return
  panel.hidden = !snapshot
  setControlDisabled('#review-source-export', !comparisonExportMatches())
  if (!snapshot) return
  panel.dataset.state = snapshot.stale ? 'stale' : snapshot.pending ? 'reviewing' : 'ready'
  text('#source-export-scope', snapshot.scope ? JSON.stringify(snapshot.scope, null, 2) : 'Calculating the bounded export scope…')
  text('#source-export-status', snapshot.message || 'This download includes the full proposed draft and latest source text plus bounded line comparison metadata. Review the exact scope, then type EXPORT COMPARISON. It does not authorize a source write.')
  setControlDisabled('#source-export-confirmation', snapshot.pending || snapshot.stale)
  setControlDisabled('#download-source-export', snapshot.pending || snapshot.stale || !comparisonExportMatches(snapshot.review) || snapshot.generation !== state.sourceExportGeneration)
}

async function reviewSourceExport() {
  const review = state.sourceComparison
  if (!comparisonExportMatches(review)) return
  invalidateSourceExport()
  const generation = state.sourceExportGeneration
  const snapshot = { generation, review, pending: true, stale: false, scope: null, json: null, message: '' }
  state.sourceExport = snapshot
  renderSourceExport()
  try {
    const { payload, json } = createComparisonExport({ schemaVersion: 1, path: review.path, loadedRevision: review.loadedRevision, currentRevision: review.currentRevision, draftRevision: review.draftRevision, draftContent: review.draftContent, currentContent: review.currentContent, comparison: review.comparison })
    const jsonDigest = await sourceTextDigest(json)
    if (generation !== state.sourceExportGeneration || state.sourceExport !== snapshot || !comparisonExportMatches(review)) return
    Object.assign(snapshot, { pending: false, json, scope: { path: payload.path, loadedRevision: payload.loadedRevision, currentRevision: payload.currentRevision, draftRevision: payload.draftRevision, draftCharacters: payload.draftContent.length, currentCharacters: payload.currentContent.length, jsonCharacters: json.length, jsonBytes: new Blob([json]).size, jsonDigest, comparison: { complete: payload.comparison.complete, truncated: payload.comparison.truncated, counts: payload.comparison.counts, reasons: payload.comparison.reasons }, includedFields: Object.keys(payload) } })
    renderSourceExport()
  } catch {
    if (generation !== state.sourceExportGeneration || state.sourceExport !== snapshot) return
    snapshot.pending = false
    snapshot.stale = true
    snapshot.message = 'Export is unavailable: unsupported comparison, sensitive content or export size limit. The draft, loaded baseline and source are unchanged.'
    renderSourceExport()
  }
}

function downloadSourceExport() {
  const snapshot = state.sourceExport
  if (!snapshot || snapshot.pending || snapshot.stale || snapshot.generation !== state.sourceExportGeneration || !comparisonExportMatches(snapshot.review)) return
  if (document.querySelector('#source-export-confirmation')?.value !== 'EXPORT COMPARISON') { text('#source-export-status', 'Type EXPORT COMPARISON after reviewing the included source text scope before downloading.'); return }
  let url, anchor
  try {
    url = URL.createObjectURL(new Blob([snapshot.json], { type: 'application/json;charset=utf-8' }))
    anchor = create('a')
    anchor.href = url
    anchor.download = 'systemx-source-comparison.json'
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
    setControlValue('#source-export-confirmation', '')
    text('#source-export-status', 'Confirmed comparison JSON download requested. The included source text is explicit; the repository and save authority are unchanged.')
  } catch {
    text('#source-export-status', 'The browser refused the comparison download. The draft, loaded base and source are kept. Check browser download access, then confirm inclusion again.')
  } finally {
    anchor?.remove()
    if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function invalidateSourceHistory() {
  state.sourceHistoryGeneration += 1
  state.sourceHistoryController?.abort()
  state.sourceHistoryController = null
  state.sourceHistoryLoading = false
  if (state.sourceHistory) state.sourceHistory.stale = true
  renderSourceHistory()
}

function renderSourceHistory() {
  const history = state.sourceHistory
  const panel = document.querySelector('#source-history')
  if (panel) panel.dataset.state = state.sourceHistoryLoading ? 'checking' : !history ? 'empty' : history.unavailable ? 'unavailable' : history.message ? 'unknown' : history.stale ? 'stale' : 'current'
  setControlDisabled('#refresh-source-history', !sourceLoadedForWorkspace() || state.sourceHistoryLoading || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== state.sourcePath)
  text('#source-history-path', history?.path || 'No history read')
  text('#source-history-current-revision', history?.currentRevision || 'Not observed')
  if (!history) return
  text('#source-history-status', state.sourceHistoryLoading ? 'Reading bounded source history; no source or recovery data is written.' : history.message || `${history.stale ? 'History snapshot is outdated; refresh to observe current source. ' : ''}${history.entries.length} rows shown · ${history.omittedEntries} omitted · truncated: ${history.truncated}. Observations do not identify an external author. ${history.warnings.join(' ')}`)
  const list = document.querySelector('#source-history-list')
  list?.replaceChildren()
  const labels = { 'builder-save': 'Recorded builder save', 'legacy-builder-operation': 'Legacy/unverified builder operation', 'observed-current': 'Observed source snapshot · author unverified', 'observed-change': 'Observed source change · author unverified' }
  for (const entry of history.entries) {
    const row = create('article', 'source-history-entry')
    row.dataset.historyKind = entry.kind
    if (entry.revision) row.dataset.revision = entry.revision
    row.dataset.workspaceBound = String(entry.workspaceBound === true)
    row.dataset.revisionAvailable = String(entry.revisionAvailable === true)
    const label = entry.kind === 'legacy-builder-operation' ? `${labels[entry.kind]} · ${entry.workspaceBound ? 'checkout-bound record' : 'checkout unverified'} · ${entry.revisionAvailable ? 'recorded hashes retained' : 'revision unavailable'}` : labels[entry.kind]
    row.append(create('strong', '', label), create('small', '', `${entry.timestamp} · ${entry.operation || 'source observation'} · ${entry.provenance}`), create('code', '', `Previous: ${entry.previousRevision || 'Not recorded'}`), create('code', '', `Revision: ${entry.revision || 'Not recorded'}`))
    list?.append(row)
  }
}

async function refreshSourceHistory() {
  const path = state.sourcePath
  if (!path || !sourceLoadedForWorkspace() || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== path || state.sourceHistoryLoading) return
  invalidateSourceHistory()
  const generation = state.sourceHistoryGeneration, targetGeneration = state.sourceTargetGeneration
  const observation = sourceObservationVersions.get(path) || 0
  const controller = new AbortController()
  state.sourceHistoryController = controller
  state.sourceHistoryLoading = true
  text('#source-history-status', 'Reading bounded source history; no source or recovery data is written.')
  renderSourceHistory()
  try {
    const result = await request(`/api/builder/source/history?path=${encodeURIComponent(path)}&limit=30`, { signal: controller.signal })
    if (generation !== state.sourceHistoryGeneration || targetGeneration !== state.sourceTargetGeneration || state.sourcePath !== path) return
    if (result.schemaVersion !== 1 || result.workspaceId !== state.sourceRecoveryWorkspaceId || result.path !== path || !validSourceRevision(result.currentRevision) || !Array.isArray(result.entries) || sourceObservationSuperseded(path, observation, result.currentRevision)) throw new Error('History response could not be bound to the current checkout.')
    const kinds = ['builder-save', 'legacy-builder-operation', 'observed-current', 'observed-change']
    const entries = result.entries.slice(0, sourceRecordLimits.historyEntries).filter((entry) => {
      if (!entry || !kinds.includes(entry.kind) || ![null, 'source', 'leaf-text', 'font'].includes(entry.operation) || typeof entry.timestamp !== 'string' || entry.timestamp.length > 40 || (entry.previousRevision !== null && !validSourceRevision(entry.previousRevision)) || (entry.revision !== null && !validSourceRevision(entry.revision))) return false
      if (entry.kind === 'builder-save') return entry.provenance === 'operation-log' && entry.attribution === 'recorded-builder-operation' && entry.workspaceBound === true && entry.revisionAvailable === true && validSourceRevision(entry.previousRevision) && validSourceRevision(entry.revision)
      if (entry.kind === 'legacy-builder-operation') return entry.provenance === 'operation-log' && ['recorded-builder-operation', 'unattributed'].includes(entry.attribution) && typeof entry.workspaceBound === 'boolean' && typeof entry.revisionAvailable === 'boolean' && (entry.revisionAvailable ? validSourceRevision(entry.previousRevision) && validSourceRevision(entry.revision) : entry.previousRevision === null && entry.revision === null)
      return entry.provenance === 'session-observation' && entry.attribution === 'unattributed' && entry.operation === null && validSourceRevision(entry.revision)
    })
    observeSourceRevision(path, result.currentRevision, 'Source history read')
    state.sourceHistory = { path, currentRevision: result.currentRevision, entries, omittedEntries: (Number.isSafeInteger(result.omittedEntries) && result.omittedEntries >= 0 ? result.omittedEntries : 0) + result.entries.length - entries.length, truncated: Boolean(result.truncated) || result.entries.length > entries.length, warnings: Array.isArray(result.warnings) ? result.warnings.filter((value) => typeof value === 'string').slice(0, 6).map((value) => value.slice(0, 250)) : [], stale: false }
    renderSourceHistory()
  } catch (error) {
    if (generation !== state.sourceHistoryGeneration || targetGeneration !== state.sourceTargetGeneration || state.sourcePath !== path) return
    const superseded = observation !== (sourceObservationVersions.get(path) || 0)
    if (sourceUnavailable(error) && !superseded) setSourceUnavailable(path)
    state.sourceHistory = { path, currentRevision: null, entries: [], omittedEntries: 0, truncated: false, warnings: [], stale: true, unavailable: sourceUnavailable(error) && !superseded, message: sourceUnavailable(error) && !superseded ? 'Source is unavailable. The open draft and loaded baseline are kept; history cannot recreate the file.' : 'History read was not confirmed or was superseded. The draft, loaded baseline and existing source are kept; check the local connection and refresh history.' }
    renderSourceHistory()
  } finally {
    if (generation === state.sourceHistoryGeneration) { state.sourceHistoryLoading = false; state.sourceHistoryController = null; renderSourceHistory() }
  }
}

function sourceReviewMatches(review = state.sourceComparison) {
  const editor = document.querySelector('#source-editor')
  return Boolean(review && sourceLoadedForWorkspace() && !review.pending && !review.stale && !state.sourceUnavailable
    && sourceCurrentlyWritable() && review.writable !== false && review.comparison?.complete && !review.comparison.truncated && review.currentTextMatchesRevision
    && review.generation === state.sourceComparisonGeneration
    && review.path === state.sourcePath && document.querySelector('#source-file-select')?.value === review.path
    && review.loadedRevision === state.sourceRevision && validSourceRevision(review.currentRevision)
    && editor?.value === review.draftDisplay && sourceContentForDraft(editor.value) === review.draftContent)
}

function renderSourceComparison() {
  const panel = document.querySelector('#source-review')
  if (!panel) return
  const review = state.sourceComparison
  panel.hidden = !review
  if (!review) return
  text('#source-review-path', review.path)
  text('#source-review-loaded-revision', review.loadedRevision)
  text('#source-review-draft-revision', review.draftRevision || 'Not calculated yet')
  text('#source-review-current-revision', state.sourceUnavailable ? 'Unavailable' : review.currentRevision || (review.pending ? 'Reading latest source…' : 'Not available'))
  text('#source-review-draft', review.draftContent)
  text('#source-review-current', state.sourceUnavailable ? '' : review.currentContent)
  const status = state.sourceReviewMessage || (review.prepared
    ? 'Reviewed replacement prepared against the displayed latest revision. Type SAVE LOCAL CHANGE again, then Save reviewed replacement.'
    : 'Comparison is read-only. The retained draft and loaded base are unchanged. Review the snapshots before preparing a replacement.')
  text('#source-review-status', status)
  const result = review.comparison
  text('#source-review-summary', result
    ? `${result.counts.changedRows} inspected changed line rows · ${result.counts.shownRows} shown · ${result.counts.omittedRows} omitted. Lines are compared by position; inserted lines can shift this view. ${result.reasons.join(' ')}${!review.currentTextMatchesRevision ? ' Latest file bytes cannot be reproduced by this text snapshot; replacement is unavailable.' : ''}`
    : review.pending ? 'Reading a bounded comparison; no source write is requested.' : 'No completed comparison. Compare latest again before reviewing replacement.')
  const lines = document.querySelector('#source-review-lines')
  lines?.replaceChildren()
  for (const entry of result?.rows ?? []) {
    const row = create('div', 'source-comparison-line')
    row.dataset.changeKind = entry.kind
    row.dataset.draftLine = entry.draftLine ?? ''
    row.dataset.currentLine = entry.currentLine ?? ''
    for (const [name, number, ending, value, cropped] of [
      ['Draft', entry.draftLine, entry.draftEnding, entry.draftText, entry.draftTextTruncated],
      ['Latest', entry.currentLine, entry.currentEnding, entry.currentText, entry.currentTextTruncated],
    ]) {
      const cell = create('div')
      cell.append(create('small', '', `${name} line ${number ?? '—'} · ${ending ?? 'absent'}${cropped ? ' · excerpt truncated' : ''}`), create('pre', '', value))
      row.append(cell)
    }
    lines?.append(row)
  }
  setControlDisabled('#prepare-source-replacement', state.sourceLoading || state.sourceSaving || state.sourceComparing || !sourceReviewMatches())
}

function invalidateSourceComparison(reason, clear = false) {
  invalidateSourceExport(reason)
  state.sourceComparisonGeneration += 1
  state.sourceComparisonController?.abort()
  state.sourceComparisonController = null
  state.sourceComparing = false
  const review = state.sourceComparison
  const firstInvalidation = review && !review.stale
  if (review?.prepared) setControlValue('#source-confirmation', '')
  if (review) { review.stale = true; review.prepared = false; review.pending = false }
  state.sourceReviewMessage = reason
  if (clear) state.sourceComparison = null
  if (firstInvalidation || clear) renderSourceComparison()
  else if (review) {
    text('#source-review-status', reason)
    setControlDisabled('#prepare-source-replacement', true)
  }
  updateSourceSaveAvailability()
}

async function sourceTextDigest(content) {
  const bytes = new TextEncoder().encode(content)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function compareLatestSource() {
  const editor = document.querySelector('#source-editor')
  const path = state.sourcePath
  if (!editor || !path || !sourceLoadedForWorkspace() || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || state.sourceComparing) return
  if (document.querySelector('#source-file-select')?.value !== path) {
    output('#source-output', 'Load the selected file before comparing; the retained draft still belongs to its loaded file.')
    return
  }
  if (editor.value.length > sourceComparisonLimits.characters) {
    output('#source-output', `Draft exceeds the ${sourceComparisonLimits.characters}-character comparison limit. The draft and base are kept.`)
    return
  }
  const draftDisplay = editor.value, draftContent = sourceContentForDraft(draftDisplay)
  if (draftContent.length > sourceComparisonLimits.characters) {
    output('#source-output', `Proposed source exceeds the ${sourceComparisonLimits.characters}-character comparison limit. The draft and base are kept.`)
    return
  }
  invalidateSourceComparison('Reading latest source; the draft and loaded base are kept.', true)
  const generation = state.sourceComparisonGeneration
  const workspaceId = state.sourceRecoveryWorkspaceId
  const observation = sourceObservationVersions.get(path) || 0
  const controller = new AbortController()
  state.sourceComparisonController = controller
  state.sourceComparing = true
  const review = { generation, path, loadedRevision: state.sourceRevision, draftDisplay, draftContent, currentContent: '', currentRevision: null, draftRevision: null, currentTextMatchesRevision: false, comparison: null, pending: true, stale: false, prepared: false }
  state.sourceComparison = review
  renderSourceComparison()
  updateSourceSaveAvailability()
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(path)}`, { signal: controller.signal })
    if (generation !== state.sourceComparisonGeneration) return
    if (sourceObservationSuperseded(path, observation, result.revision)) throw new Error('A newer source observation arrived while comparing. Compare latest again.')
    if (!sourceSnapshotForWorkspace(result, workspaceId) || result.path !== path || !validSourceRevision(result.revision) || typeof result.content !== 'string') throw new Error('Latest source revision is unavailable.')
    if (result.content.length > sourceComparisonLimits.characters) throw new Error(`Latest source exceeds the ${sourceComparisonLimits.characters}-character comparison limit.`)
    const [draftRevision, currentTextRevision] = await Promise.all([sourceTextDigest(draftContent), sourceTextDigest(result.content)])
    if (generation !== state.sourceComparisonGeneration) return
    if (sourceObservationSuperseded(path, observation, result.revision)) throw new Error('A newer source observation arrived while comparing. Compare latest again.')
    clearSourceUnavailable()
    Object.assign(review, { writable: result.writable !== false, currentContent: result.content, currentRevision: result.revision, draftRevision, currentTextMatchesRevision: currentTextRevision === result.revision, comparison: compareSourceText(draftContent, result.content), pending: false })
    state.sourceReviewMessage = ''
    observeSourceRevision(path, result.revision, 'Source comparison', false)
    renderSourceRevision()
    renderSourceComparison()
  } catch (error) {
    if (generation !== state.sourceComparisonGeneration) return
    if (observation !== (sourceObservationVersions.get(path) || 0)) {
      review.pending = false
      review.stale = true
      state.sourceReviewMessage = 'Comparison response was superseded by a newer source observation. The draft, loaded base and newer source observation are kept; compare latest again.'
      output('#source-output', state.sourceReviewMessage)
      renderSourceComparison()
      return
    }
    if (sourceUnavailable(error)) setSourceUnavailable(path)
    else {
      review.pending = false
      review.stale = true
      state.sourceReviewMessage = `${error.message} Comparison was not completed. The draft and loaded base are kept; check the local connection and compare again.`
      output('#source-output', state.sourceReviewMessage)
      renderSourceComparison()
    }
  } finally {
    if (generation === state.sourceComparisonGeneration) {
      state.sourceComparing = false
      state.sourceComparisonController = null
      renderSourceComparison()
      updateSourceSaveAvailability()
    }
  }
}

function prepareSourceReplacement() {
  if (state.sourceLoading || state.sourceSaving || state.sourceComparing || !sourceReviewMatches()) {
    output('#source-output', 'Replacement review is incomplete or outdated. Compare latest again; the draft and loaded base are kept.')
    return
  }
  state.sourceComparison.prepared = true
  state.sourceReviewMessage = ''
  setControlValue('#source-confirmation', '')
  renderSourceComparison()
  updateSourceSaveAvailability()
  document.querySelector('#source-confirmation')?.focus()
}

function renderSelectedTextRevision() {
  const source = state.previewTextSource
  const label = document.querySelector('#settings-source-revision')
  if (!label) return
  if (source?.element !== state.previewSelectedElement || !validSourceRevision(source.revision)) {
    label.textContent = 'No source revision loaded.'
    label.removeAttribute('data-revision')
    label.removeAttribute('data-current-revision')
    return
  }
  label.dataset.revision = source.revision
  const dirty = document.querySelector('#settings-text-editor')?.value.trim() !== state.previewSelection?.originalText
  label.textContent = source.workspaceId !== state.sourceRecoveryWorkspaceId ? `Previous checkout · text draft kept · loaded ${source.revision}. Reload source before saving.` : source.currentRevision
    ? `Conflict · unsaved text draft · loaded ${source.revision} · current ${source.currentRevision}`
    : `${dirty ? 'Unsaved text draft' : 'Loaded source'} · revision ${source.revision.slice(0, 12)}.`
  if (source.currentRevision) label.dataset.currentRevision = source.currentRevision
  else label.removeAttribute('data-current-revision')
}

function renderSourceRevision() {
  const label = document.querySelector('#source-revision')
  if (!label || !validSourceRevision(state.sourceRevision)) return
  const dirty = document.querySelector('#source-editor')?.value !== state.sourceDisplayBaseline
  label.dataset.revision = state.sourceRevision
  label.textContent = !sourceLoadedForWorkspace() ? `Previous checkout · retained ${dirty ? 'draft' : 'source'} · loaded ${state.sourceRevision}. Load current checkout source explicitly before saving.` : state.sourceUnavailable
    ? `Source unavailable · ${dirty ? 'unsaved draft' : 'loaded source'} · loaded ${state.sourceRevision}`
    : state.sourceConflictRevision
    ? `Conflict · ${dirty ? 'unsaved draft' : 'loaded source'} · loaded ${state.sourceRevision} · current ${state.sourceConflictRevision}`
    : `${dirty ? 'Unsaved draft' : 'Loaded source'} · revision ${state.sourceRevision.slice(0, 12)}.`
  if (state.sourceConflictRevision) label.dataset.currentRevision = state.sourceConflictRevision
  else label.removeAttribute('data-current-revision')
}

async function loadSelectedTextSource(element = state.previewSelectedElement, path = state.previewSelection?.sourcePath) {
  if (!element || !path) return
  const generation = ++state.previewTextSourceGeneration
  const workspaceId = state.sourceRecoveryWorkspaceId
  const observation = sourceObservationVersions.get(path) || 0
  state.previewTextSourcePending = element
  setControlDisabled('#settings-text-save', true)
  output('#settings-source-revision', 'Reading latest source revision; the text draft is kept.')
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(path)}`)
    if (generation !== state.previewTextSourceGeneration || state.previewSelectedElement !== element || state.previewSelection?.sourcePath !== path) return
    if (sourceObservationSuperseded(path, observation, result.revision)) throw new Error('A newer source observation arrived while reading. Reload latest source before saving.')
    if (!sourceSnapshotForWorkspace(result, workspaceId) || result.path !== path || !validSourceRevision(result.revision)) throw new Error('Source revision unavailable. Choose Reload latest source before saving.')
    observeSourceRevision(path, result.revision, 'Selected-text source read')
    state.previewTextSource = { element, path, content: result.content, revision: result.revision, writable: result.writable !== false, workspaceId }
    renderSelectedTextRevision()
  } catch (error) {
    if (generation === state.previewTextSourceGeneration) output('#settings-source-revision', `${error.message} The text draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
  } finally {
    if (generation === state.previewTextSourceGeneration) {
      state.previewTextSourcePending = null
      const loaded = state.previewTextSource
      setControlDisabled('#settings-text-save', loaded?.element !== element || loaded.writable === false || loaded.path !== path || loaded.workspaceId !== state.sourceRecoveryWorkspaceId || state.previewTextSaving === element)
    }
  }
}

function updateSourceSaveAvailability() {
  setControlDisabled('#save-source', !sourceCurrentlyWritable() || document.querySelector('#source-file-select')?.value !== state.sourcePath || !sourceLoadedForWorkspace() || state.sourceLoading || state.sourceSaving || state.sourceComparing || state.sourceUnavailable || !validSourceRevision(state.sourceRevision))
  setControlDisabled('#load-source', state.sourceSaving || sourceFileMetadata()?.readable === false)
  setControlDisabled('#reload-source', state.sourceSaving)
  setControlDisabled('#compare-source', !sourceLoadedForWorkspace() || state.sourceLoading || state.sourceSaving || state.sourceComparing || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== state.sourcePath)
  setControlDisabled('#prepare-source-replacement', state.sourceLoading || state.sourceSaving || state.sourceComparing || !sourceReviewMatches())
  text('#save-source', state.sourceComparison?.prepared && sourceReviewMatches() ? 'Save reviewed replacement' : 'Save')
  renderSourceDraftPreview()
  renderSourceRecovery()
  renderSourceExport()
  renderSourceHistory()
}

function sourceContentForDraft(displayDraft) {
  if (displayDraft === state.sourceDisplayBaseline) return state.sourceLoadedContent
  const loaded = state.sourceLoadedContent
  const uniformCrLf = loaded.includes('\r\n') && !/[\r\n]/.test(loaded.replaceAll('\r\n', ''))
  return uniformCrLf ? displayDraft.replaceAll('\n', '\r\n') : displayDraft
}

async function loadSource({ path } = {}) {
  const select = document.querySelector('#source-file-select')
  const editor = document.querySelector('#source-editor')
  const wantedPath = path || select?.value
  if (!select || !editor || !wantedPath || state.sourceSaving) return
  if (!canonicalSourcePath(wantedPath)) { output('#source-output', 'SOURCE_PATH_INVALID: choose a canonical repository-relative source path. The draft and loaded revision are kept; no file request was made.'); return }
  invalidateSourceRecoveryReview('Source load requested. Review saved draft again before restoring.')
  invalidateSourceHistory()
  stopSourceDraftPreviewRead('Source load requested. The preview keeps its captured text and baseline.')
  invalidateSourceComparison('Source load requested. Compare latest again before reviewing replacement.')
  if (state.sourcePath && editor.value !== state.sourceDisplayBaseline && !window.confirm('Reload source and discard the unsaved source draft? Cancel keeps the draft and its loaded revision.')) {
    select.value = state.sourcePath
    output('#source-output', 'Reload cancelled. The source draft and loaded revision are kept.')
    return
  }
  const generation = ++state.sourceLoadGeneration
  const targetGeneration = state.sourceTargetGeneration
  const workspaceId = state.sourceRecoveryWorkspaceId
  const observation = sourceObservationVersions.get(wantedPath) || 0
  state.sourceLoading = true
  editor.disabled = true
  updateSourceSaveAvailability()
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(wantedPath)}`)
    if (generation !== state.sourceLoadGeneration) return
    if (targetGeneration !== state.sourceTargetGeneration) throw new Error('Selected source changed while reading. Load the selected file explicitly.')
    if (sourceObservationSuperseded(wantedPath, observation, result.revision)) throw new Error('A newer source observation arrived while reading. Reload source again.')
    if (!sourceSnapshotForWorkspace(result, workspaceId) || result.path !== wantedPath || !validSourceRevision(result.revision) || typeof result.content !== 'string') throw new Error('Source revision unavailable. Reload source before saving.')
    state.sourcePath = result.path
    state.sourceWritable = result.writable !== false
    state.sourceRevision = result.revision
    state.sourceLoadedContent = result.content
    state.sourceLoadedWorkspaceId = workspaceId
    state.sourceConflictRevision = null
    select.value = result.path
    editor.value = result.content
    state.sourceDisplayBaseline = editor.value
    clearSourceUnavailable()
    observeSourceRevision(result.path, result.revision, 'Explicit source load')
    text('#source-policy', result.writable === false ? 'read-only generated source' : result.policy)
    renderSourceFileMetadata()
    persistSourceNavigation()
    renderSourceRevision()
    setControlValue('#source-confirmation', '')
    output('#source-output', `${result.path} loaded · ${result.content.split(/\r?\n/).length} lines`)
  } catch (error) {
    if (generation === state.sourceLoadGeneration) {
      const superseded = targetGeneration !== state.sourceTargetGeneration || observation !== (sourceObservationVersions.get(wantedPath) || 0)
      if (sourceUnavailable(error) && !superseded) setSourceUnavailable(wantedPath)
      if (!superseded && sourceLoadedForWorkspace() && state.sourcePath && state.sourcePath !== wantedPath) {
        if (![...select.options].some(option => option.value === state.sourcePath)) {
          const retained = create('option', '', `${state.sourcePath} (loaded source retained)`)
          retained.value = state.sourcePath
          select.append(retained)
        }
        select.value = state.sourcePath
        renderSourceFileMetadata()
      }
      output('#source-output', superseded ? 'Source read was superseded by a selected target or newer source observation. The draft and loaded base are kept. Load the intended source explicitly.' : sourceUnavailable(error)
        ? 'Source is unavailable. The source draft and loaded revision are kept; no file will be recreated. Select an existing file or restore it externally, then reload.'
        : `${error.code ? `${error.code}: ` : ''}${error.message} The source draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
    }
  } finally {
    if (generation === state.sourceLoadGeneration) {
      state.sourceLoading = false
      editor.disabled = false
      updateSourceSaveAvailability()
    }
  }
}

async function saveSource() {
  const select = document.querySelector('#source-file-select')
  const editor = document.querySelector('#source-editor')
  const confirmation = document.querySelector('#source-confirmation')
  if (!select || !editor || !confirmation) return
  if (!state.sourcePath || !sourceCurrentlyWritable() || !sourceLoadedForWorkspace() || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || state.sourceComparing || state.sourceUnavailable) {
    output('#source-output', 'Load a source file before saving.')
    return
  }
  if (select.value !== state.sourcePath) {
    output('#source-output', `Selected file changed to ${select.value}. Load it before saving.`)
    return
  }
  const review = state.sourceComparison?.prepared ? state.sourceComparison : null
  invalidateSourceRecoveryReview('Source save requested. Review saved draft again before restoring.')
  if (review && !sourceReviewMatches(review)) {
    invalidateSourceComparison('Replacement review is outdated. Compare latest and review again.')
    return
  }
  if (review && confirmation.value !== 'SAVE LOCAL CHANGE') {
    output('#source-output', 'Reviewed replacement requires a new SAVE LOCAL CHANGE confirmation before saving.')
    return
  }
  const path = state.sourcePath, baseRevision = review ? review.currentRevision : state.sourceRevision, displayDraft = editor.value
  const workspaceId = state.sourceRecoveryWorkspaceId
  const content = review ? review.draftContent : sourceContentForDraft(displayDraft)
  const observation = sourceObservationVersions.get(path) || 0
  if (!review) invalidateSourceComparison('A source save was requested. Compare latest again before reviewing replacement.')
  state.sourceSaving = true
  updateSourceSaveAvailability()
  try {
    const result = await post('/api/builder/source', { path, content, baseRevision, confirmation: confirmation.value })
    if (!validSourceRevision(result.revision)) throw new Error('Saved source revision is unavailable. Reload latest source before another save.')
    state.sourceRevision = result.revision
    state.sourceLoadedContent = content
    state.sourceDisplayBaseline = displayDraft
    state.sourceConflictRevision = null
    clearSourceUnavailable()
    if (state.sourceDraftPreview?.path === path) stopSourceDraftPreviewRead('Source save accepted. The preview retains its captured text and original baseline.')
    if (workspaceId === state.sourceRecoveryWorkspaceId) observeSourceRevision(path, result.revision, 'Source save accepted', false, null, observation)
    invalidateSourceComparison('Source save accepted. Compare latest again before another replacement.', true)
    renderSourceRevision()
    output('#source-output', result.status === 'saved' ? `Saved ${result.path}; backup: ${result.backup}. Vite preview can hot reload.` : result.status)
    confirmation.value = ''
    await refresh()
  } catch (error) {
    if (sourceUnavailable(error)) {
      if (workspaceId !== state.sourceRecoveryWorkspaceId || observation !== (sourceObservationVersions.get(path) || 0)) {
        output('#source-output', 'Source was unavailable at the save attempt; a newer source observation superseded that response. The draft and loaded base are kept. Compare latest or reload explicitly.')
        return
      }
      setSourceUnavailable(path)
      output('#source-output', 'Source is unavailable. The draft and loaded revision are kept; no file will be recreated. Select an existing file or restore it externally, then reload.')
      return
    }
    if (!sourceRevisionConflict(error)) {
      if (review) invalidateSourceComparison('Save was not confirmed. Compare latest and review again before another replacement.')
      output('#source-output', `${error.message} Save was not confirmed; the draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
      return
    }
    state.sourceConflictRevision = observation !== (sourceObservationVersions.get(path) || 0) ? sourceObservedRevisions.get(path) : error.currentRevision
    if (error.currentRevision && workspaceId === state.sourceRecoveryWorkspaceId) observeSourceRevision(path, error.currentRevision, 'Source save conflict', false, null, observation)
    invalidateSourceComparison(`Source changed again${error.currentRevision ? ` · current ${error.currentRevision}` : ''}. Compare latest and review again.`)
    renderSourceRevision()
    output('#source-output', 'Source changed since it was loaded. The draft and loaded revision are kept. Choose Compare latest for a non-destructive review, or Reload latest source to explicitly replace the retained draft after confirmation.')
  } finally {
    state.sourceSaving = false
    updateSourceSaveAvailability()
  }
}

async function savePageModel(event) {
  event.preventDefault()
  const page = selectedPage()
  if (!page) return
  await post('/api/builder/page', { operation: 'update-meta', pageId: page.id, name: document.querySelector('#page-name')?.value, route: document.querySelector('#page-route')?.value })
  await refresh()
  output('#command-output', `Saved local page model for ${page.id}. Source is unchanged until you use the source editor.`)
}

async function createPageModel(event) {
  event.preventDefault()
  const result = await post('/api/builder/page', {
    operation: 'create-page',
    name: document.querySelector('#new-page-name')?.value,
    route: document.querySelector('#new-page-route')?.value,
  })
  event.target.reset()
  await refresh()
  if (result.page?.id) selectPage(result.page.id)
  output('#command-output', `Added local page model: ${result.page?.name ?? 'page'}. Source and router changes remain gated.`)
}

async function addNode(type) {
  const page = selectedPage()
  if (!page) {
    output('#canvas-output', 'Select a page first.')
    return
  }
  await post('/api/builder/page', { operation: 'add-node', pageId: page.id, type })
  await refresh()
  output('#canvas-output', `Added ${type} module to ${page.name}.`)
}

async function removeNode(nodeId) {
  const page = selectedPage()
  if (!page) return
  await post('/api/builder/page', { operation: 'remove-node', pageId: page.id, nodeId })
  await refresh()
  output('#canvas-output', 'Removed local module from the page tree.')
}

async function addRecord(event) {
  event.preventDefault()
  if (!state.selectedCollectionId) return
  await post('/api/builder/record', { resource: 'collections', collectionId: state.selectedCollectionId, record: { name: document.querySelector('#record-name')?.value, email: document.querySelector('#record-email')?.value, notes: document.querySelector('#record-notes')?.value } })
  event.target.reset()
  await refresh()
  output('#command-output', 'Added a local CMS/CRM fixture record. Cloud sync remains explicit.')
}

async function addUser(event) {
  event.preventDefault()
  await post('/api/builder/record', { resource: 'users', record: { email: document.querySelector('#user-email')?.value, role: document.querySelector('#user-role')?.value } })
  event.target.reset()
  await refresh()
  output('#command-output', 'Added a local user fixture. No Firebase Auth account was created.')
}

function bindPanelResizer(selector, side) {
  const handle = document.querySelector(selector)
  if (!handle) return
  const resizeBy = (delta) => {
    const key = side === 'left' ? 'leftWidth' : 'rightWidth'
    state.layout[key] = clampPanelWidth(side, state.layout[key] + delta)
    applyPanelWidths()
    protectCanvasWidth(side)
    saveLayout()
  }
  handle.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const physicalDelta = event.key === 'ArrowRight' ? 12 : -12
    resizeBy(side === 'left' ? physicalDelta : -physicalDelta)
  })
  handle.addEventListener('pointerdown', (event) => {
    const shell = document.querySelector('.builder-shell')
    if (!shell || shell.classList.contains(`${side}-panel-collapsed`)) return
    event.preventDefault()
    const key = side === 'left' ? 'leftWidth' : 'rightWidth'
    const startX = event.clientX
    const startWidth = state.layout[key]
    document.body.classList.add('is-resizing-panel')
    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      state.layout[key] = clampPanelWidth(side, startWidth + (side === 'left' ? delta : -delta))
      applyPanelWidths()
      protectCanvasWidth(side)
    }
    const stop = () => {
      document.body.classList.remove('is-resizing-panel')
      window.removeEventListener('pointermove', move)
      saveLayout()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  })
}

function bind() {
  document.querySelectorAll('[data-panel-target]').forEach((link) => link.addEventListener('click', (event) => {
    const panelId = link.dataset.panelTarget
    if (!leftPanelIds.has(panelId) && !rightPanelIds.has(panelId)) return
    event.preventDefault()
    if (leftPanelIds.has(panelId)) activateLeftPanel(panelId)
    if (rightPanelIds.has(panelId)) activateRightPanel(panelId)
  }))
  document.querySelectorAll('[data-inspector-tab]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault()
    activateRightPanel(link.dataset.inspectorTab)
  }))
  document.querySelectorAll('[data-inspector-group-button], [data-inspector-group-tab]').forEach((button) => button.addEventListener('click', () => {
    const group = button.dataset.inspectorGroupButton ?? button.dataset.inspectorGroupTab
    const currentPanel = rightPanelToGroup[state.layout.activeRight] === group
      ? state.layout.activeRight
      : inspectorGroups[group]?.[0]
    if (!currentPanel) return
    if (button.dataset.inspectorGroupButton && document.querySelector('#right-panel-toggle')?.getAttribute('aria-expanded') === 'true' && state.layout.activeInspectorGroup === group) {
      setRightPanelCollapsed(true)
      return
    }
    activateRightPanel(currentPanel)
  }))
  window.addEventListener('hashchange', activateWorkspaceFromHash)
  document.querySelector('#left-panel-quick-find')?.addEventListener('click', () => {
    focusQuickFind()
    output('#command-output', 'Quick find ready. Search a panel, route, tool, or SYSTEMX action.')
  })
  document.querySelector('#left-panel-toggle')?.addEventListener('click', () => {
    if (document.querySelector('#left-panel-toggle')?.getAttribute('aria-expanded') !== 'true') activateLeftPanel(state.layout.activeLeft || 'canvas', false)
    else setLeftPanelCollapsed(true)
  })
  document.querySelector('.left-panel .panel-collapse')?.addEventListener('click', () => setLeftPanelCollapsed(true))
  document.querySelector('#left-panel-visibility')?.addEventListener('click', () => {
    setPanelPinned('left', !state.layout.leftPinned)
  })
  document.querySelector('#right-panel-toggle')?.addEventListener('click', () => {
    if (document.querySelector('#right-panel-toggle')?.getAttribute('aria-expanded') !== 'true') activateRightPanel(state.layout.activeRight || 'style', false)
    else setRightPanelCollapsed(true)
  })
  document.querySelector('#right-panel-visibility')?.addEventListener('click', () => {
    setPanelPinned('right', !state.layout.rightPinned)
  })
  document.querySelector('#right-panel-collapse')?.addEventListener('click', collapseInspectorToCanvas)
  document.querySelector('#right-panel-back')?.addEventListener('click', collapseInspectorToCanvas)
  document.querySelector('#canvas-dock-toggle')?.addEventListener('click', () => {
    const workspace = document.querySelector('.canvas-workspace')
    setCanvasDockOpen(workspace?.classList.contains('model-dock-collapsed'))
  })
  document.querySelector('.canvas-workspace')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea, label, details, summary, .canvas-layers, .canvas-preview-stage')) return
    collapseInspectorToCanvas()
  })
  document.querySelector('#workspace-menu-toggle')?.addEventListener('click', () => {
    const panel = document.querySelector('#workspace-menu')
    setWorkspaceMenu(Boolean(panel?.hidden))
  })
  document.querySelector('#workspace-menu-close')?.addEventListener('click', () => setWorkspaceMenu(false, { restoreFocus: true }))
  document.querySelector('#workspace-menu')?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setWorkspaceMenu(false, { restoreFocus: true })
  })
  document.addEventListener('mousedown', (event) => {
    const panel = document.querySelector('#workspace-menu')
    const toggle = document.querySelector('#workspace-menu-toggle')
    if (!panel || panel.hidden) return
    if (panel.contains(event.target) || toggle?.contains(event.target)) return
    setWorkspaceMenu(false)
  })
  document.querySelector('#evidence-toggle')?.addEventListener('click', () => {
    setEvidenceDrawer(!state.layout.evidenceOpen)
  })
  document.querySelector('#evidence-close')?.addEventListener('click', () => setEvidenceDrawer(false))
  document.querySelector('#preview-inspect-toggle')?.addEventListener('click', () => {
    schedulePreviewInspector()
    setPreviewInspectMode(!state.layout.previewInspect)
    output(
      '#command-output',
      state.layout.previewInspect
        ? 'Preview inspect mode active. Click to select; right-click for hierarchy, source, module, and component actions.'
        : 'Preview interaction mode active. Links and controls now receive normal app clicks.',
    )
  })
  document.querySelector('#app-preview-frame')?.addEventListener('load', () => {
    resetPreviewNavigator()
    if (state.previewSelectedElement || state.previewSelectionAnchor || state.previewSelection) clearPreviewSelection()
    state.previewHoveredElement = null
    state.previewLayerElements = []
    state.previewTextOriginals = new WeakMap()
    state.previewContextTarget = null
    hidePreviewContextMenu()
    renderPreviewBreadcrumbs()
    schedulePreviewInspector()
    renderLoadedFonts()
    if (state.selectedFont) window.setTimeout(() => void loadFontInPreview(state.selectedFont, false), 150)
  })
  document.querySelector('#preview-layer-tree')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-layer-index]')
    if (!button || !event.currentTarget.contains(button)) return
    const element = state.previewLayerElements[Number.parseInt(button.dataset.previewLayerIndex, 10)]
    if (!isCurrentPreviewElement(element, previewDocument()?.body)) {
      rebuildPreviewNavigator()
      output('#preview-layer-summary', 'That element is no longer in the current preview. The hierarchy was refreshed.')
      return
    }
    if (event.target.closest('[data-preview-toggle]')) {
      if (state.previewNavigatorQuery.trim()) {
        output('#preview-layer-summary', 'Search shows matching ancestor paths. Clear search to collapse branches.')
        return
      }
      if (state.previewNavigatorExpanded.has(element)) state.previewNavigatorExpanded.delete(element)
      else state.previewNavigatorExpanded.add(element)
      state.previewNavigatorFocus = element
      renderPreviewNavigator({ focus: true })
      return
    }
    selectNavigatorElement(element, { focus: true })
  })
  document.querySelector('#preview-layer-tree')?.addEventListener('focusin', (event) => {
    const button = event.target.closest('[data-preview-layer-index]')
    if (!button) return
    const element = state.previewLayerElements[Number.parseInt(button.dataset.previewLayerIndex, 10)]
    if (!isCurrentPreviewElement(element, previewDocument()?.body)) return
    state.previewNavigatorFocus = element
    event.currentTarget.querySelectorAll('[role="treeitem"]').forEach((row) => { row.tabIndex = row === button ? 0 : -1 })
  })
  document.querySelector('#preview-layer-tree')?.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
    const button = event.target.closest('[data-preview-layer-index]')
    if (!button) return
    event.preventDefault()
    event.stopPropagation()
    const index = Number.parseInt(button.dataset.previewLayerIndex, 10)
    const entry = state.previewNavigatorRows[index]
    if (!entry || !isCurrentPreviewElement(entry.element, previewDocument()?.body)) { rebuildPreviewNavigator(); return }
    if (event.key === 'Enter' || event.key === ' ') { selectNavigatorElement(entry.element, { focus: true }); return }
    const rows = state.previewNavigatorRows
    let next = entry
    if (event.key === 'ArrowUp') next = rows[Math.max(0, index - 1)]
    if (event.key === 'ArrowDown') next = rows[Math.min(rows.length - 1, index + 1)]
    if (event.key === 'Home') next = rows[0]
    if (event.key === 'End') next = rows[rows.length - 1]
    if (event.key === 'ArrowRight' && entry.children.length) {
      if (!entry.expanded && !state.previewNavigatorQuery.trim()) state.previewNavigatorExpanded.add(entry.element)
      else next = rows[index + 1]?.parent?.element === entry.element ? rows[index + 1] : entry
    }
    if (event.key === 'ArrowLeft') {
      if (entry.expanded && entry.children.length && !state.previewNavigatorQuery.trim()) state.previewNavigatorExpanded.delete(entry.element)
      else next = rows.find((row) => row.element === entry.parent?.element) || entry
    }
    state.previewNavigatorFocus = next.element
    renderPreviewNavigator({ focus: true })
    document.querySelector('#preview-layer-tree [tabindex="0"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
  document.querySelector('#preview-navigator-search')?.addEventListener('input', (event) => {
    state.previewNavigatorQuery = event.target.value
    renderPreviewNavigator()
  })
  document.querySelector('#preview-navigator-clear')?.addEventListener('click', () => {
    state.previewNavigatorQuery = ''
    setControlValue('#preview-navigator-search', '')
    renderPreviewNavigator()
    document.querySelector('#preview-navigator-search')?.focus({ preventScroll: true })
  })
  document.querySelector('#preview-navigator-reveal')?.addEventListener('click', () => {
    if (!state.previewSelectedElement) { output('#preview-layer-summary', 'Select an element in the preview or hierarchy first.'); return }
    state.previewNavigatorQuery = ''
    setControlValue('#preview-navigator-search', '')
    selectNavigatorElement(state.previewSelectedElement, { focus: true })
  })
  document.querySelector('#canvas-element-breadcrumbs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-breadcrumb-index]')
    if (!button || !event.currentTarget.contains(button)) return
    const element = state.previewBreadcrumbElements[Number.parseInt(button.dataset.previewBreadcrumbIndex, 10)]
    selectNavigatorElement(element)
    document.querySelector('#canvas-breadcrumb-element')?.focus({ preventScroll: true })
  })
  document.querySelector('#settings-text-preview')?.addEventListener('click', previewSelectedText)
  document.querySelector('#settings-text-revert')?.addEventListener('click', revertSelectedText)
  document.querySelector('#settings-text-source')?.addEventListener('click', openPreviewSource)
  document.querySelector('#settings-text-editor')?.addEventListener('input', renderSelectedTextRevision)
  document.querySelector('#settings-text-reload')?.addEventListener('click', () => {
    void loadSelectedTextSource().catch((error) => output('#settings-source-revision', error.message))
  })
  document.querySelector('#settings-text-save')?.addEventListener('click', () => {
    void saveSelectedText().catch((error) => output('#settings-text-output', error.message))
  })
  document.querySelector('#style-edit-text')?.addEventListener('click', () => {
    if (!state.previewSelection?.textEditable) {
      output('#style-status', 'Select a leaf-text element in the live canvas before opening the text editor.')
      return
    }
    activateRightPanel('settings')
    window.requestAnimationFrame(() => document.querySelector('#settings-text-editor')?.focus({ preventScroll: true }))
  })
  document.querySelector('#font-confirmation')?.addEventListener('input', () => { state.fontIntentGeneration += 1 })
  document.querySelector('#font-search')?.addEventListener('input', renderFontList)
  document.querySelector('#font-category')?.addEventListener('change', renderFontList)
  document.querySelector('#font-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-font-family]')
    if (button) selectFont(button.dataset.fontFamily)
  })
  document.querySelector('#font-preview-selected')?.addEventListener('click', () => {
    if (state.selectedFont) selectFont(state.selectedFont.family, { load: false })
  })
  document.querySelector('#font-load-selected')?.addEventListener('click', () => {
    if (state.selectedFont) void loadFontInPreview(state.selectedFont)
  })
  document.querySelector('#font-refresh-source')?.addEventListener('click', () => void refreshFontSource())
  document.querySelector('#font-save-project')?.addEventListener('click', () => void saveProjectFont())
  document.querySelector('#preview-context-menu')?.addEventListener('click', (event) => {
    const parentButton = event.target.closest('[data-preview-parent-index]')
    if (parentButton) {
      const parent = state.previewParentElements[Number.parseInt(parentButton.dataset.previewParentIndex, 10)]
      if (parent) selectPreviewElement(parent)
      hidePreviewContextMenu()
      return
    }
    const actionButton = event.target.closest('[data-preview-context-action]')
    if (!actionButton) return
    const action = actionButton.dataset.previewContextAction
    if (action === 'select' || action === 'close') hidePreviewContextMenu()
    if (action === 'module' || action === 'component') stagePreviewSelection(action)
    if (action === 'source') openPreviewSource()
    if (action === 'navigator') {
      activateLeftPanel('navigator')
      setCanvasDockOpen(true)
      hidePreviewContextMenu()
    }
  })
  document.addEventListener('pointerdown', (event) => {
    const menu = document.querySelector('#preview-context-menu')
    if (!menu || menu.hidden || menu.contains(event.target)) return
    hidePreviewContextMenu()
  })
  document.addEventListener('keydown', (event) => {
    const targetTag = event.target?.tagName?.toLowerCase()
    const isTyping = ['input', 'textarea', 'select'].includes(targetTag) || event.target?.isContentEditable
    const key = event.key.toLowerCase()
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault()
      focusQuickFind()
      return
    }
    if (event.key === 'Escape') {
      const app = document.querySelector('.builder-app')
      if (app?.classList.contains('command-search-open')) {
        app.classList.remove('command-search-open')
        const quickFind = document.querySelector('#left-panel-quick-find')
        if (quickFind?.getBoundingClientRect().height && !quickFind.closest('[inert]')) quickFind.focus()
        else document.querySelector('#workspace-menu-toggle')?.focus()
        return
      }
      if (document.querySelector('#workspace-menu')?.hidden === false) {
        setWorkspaceMenu(false, { restoreFocus: true })
        return
      }
      setWorkspaceMenu(false)
      if (!state.layout.rightCollapsed) collapseInspectorToCanvas()
      if (state.layout.evidenceOpen) setEvidenceDrawer(false)
      hidePreviewContextMenu()
      return
    }
    if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const shortcutPanels = { a: 'canvas', p: 'pages', z: 'navigator', j: 'assets' }
      const panelId = event.shiftKey && key === 'a' ? 'components' : shortcutPanels[key]
      if (panelId) {
        event.preventDefault()
        activateLeftPanel(panelId)
        return
      }
    }
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      && state.layout.previewInspect
      && state.previewSelectedElement
      && !isTyping
    ) {
      const current = state.previewSelectedElement
      if (event.key === 'ArrowUp' && current.parentElement) {
        event.preventDefault()
        selectPreviewElement(current.parentElement)
        return
      }
      if (event.key === 'ArrowDown') {
        const child = [...current.children].find((element) => isElement(element))
        if (child) {
          event.preventDefault()
          selectPreviewElement(child)
          return
        }
      }
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && current.parentElement) {
        const siblings = [...current.parentElement.children].filter((element) => isElement(element))
        const index = siblings.indexOf(current)
        const offset = event.key === 'ArrowLeft' ? -1 : 1
        const sibling = siblings[index + offset]
        if (sibling) {
          event.preventDefault()
          selectPreviewElement(sibling)
        }
      }
    }
  })
  bindPanelResizer('#left-panel-resizer', 'left')
  bindPanelResizer('#right-panel-resizer', 'right')
  window.addEventListener('resize', () => {
    applyPanelWidths()
    protectCanvasWidth('canvas')
    syncCompactPanel()
    if (state.layout.previewFit) applyPreviewPreset('fit', { fit: true })
  })
  // Footer controls wrap at narrow widths. Keep the evidence drawer above the
  // measured dock rather than assuming a fixed one-line height.
  const footer = document.querySelector('.canvas-application-bar')
  if (footer && typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(footer.getBoundingClientRect().height)
      setRuntimeStyleRule('application-bar-height', `:root { --lan-application-bar-height: ${height}px; }`)
    })
    observer.observe(footer)
  }
  if (typeof ResizeObserver === 'function') {
    const viewport = document.querySelector('#canvas-preview-viewport')
    if (viewport) {
      const observer = new ResizeObserver(() => {
        if (state.layout.previewFit && viewport.clientWidth > 0) applyPreviewPreset('fit', { fit: true, persist: false })
      })
      observer.observe(viewport)
    }
    const rules = new Map()
    for (const side of ['left', 'right']) {
      const navigation = document.querySelector(`.${side}-panel .panel-navigation`)
      if (!navigation) continue
      const observer = new ResizeObserver(() => {
        rules.set(side, `.${side}-panel { --lan-panel-navigation-height: ${Math.ceil(navigation.getBoundingClientRect().height)}px; }`)
        setRuntimeStyleRule('panel-navigation-heights', [...rules.values()].join('\n'))
      })
      observer.observe(navigation)
    }
  }
  document.querySelector('#builder-command-input')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const value = event.target?.value?.trim()
    output(
      '#command-output',
      value
        ? `Command router staged: "${value}". Use SYSTEMX menu, an allowlisted action, or the CLI for execution. No raw browser shell was run.`
        : 'Command router ready. Try: setup check, open Firebase lane, run sync gate, or inspect Agent 0 mission.',
    )
  })
  document.querySelector('#builder-command-input')?.addEventListener('blur', () => {
    document.querySelector('.builder-app')?.classList.remove('command-search-open')
  })
  document.querySelector('#refresh-status')?.addEventListener('click', () => void refresh().catch((error) => output('#command-output', error.message)))
  document.querySelector('#refresh-sync')?.addEventListener('click', () => void refresh().catch((error) => output('#command-output', error.message)))
  document.querySelector('#inspector-refresh-sync')?.addEventListener('click', () => void refresh().catch((error) => output('#inspector-sync-summary', error.message)))
  document.querySelector('#preview-app')?.addEventListener('click', () => { collapseInspectorToCanvas(); if (state.status?.vite?.url) window.open(state.status.vite.url, '_blank', 'noopener,noreferrer') })
  document.querySelector('#canvas-preview')?.addEventListener('click', () => setPreviewInspectMode(false))
  document.querySelector('#canvas-save')?.addEventListener('click', () => activateRightPanel('source'))
  document.querySelectorAll('[data-preview-preset]').forEach((button) => button.addEventListener('click', () => {
    const presetId = button.dataset.previewPreset
    applyPreviewPreset(presetId)
    output('#command-output', `Canvas preview selected: ${previewPresets[presetId]?.label ?? presetId} at ${state.layout.previewWidth}px. Preview remains local.`)
  }))
  document.querySelector('#canvas-device-select')?.addEventListener('change', (event) => {
    applyPreviewPreset(event.target.value)
    output('#command-output', `Canvas device selected: ${document.querySelector('#canvas-device-status')?.textContent}. Preview remains local.`)
  })
  document.querySelector('#canvas-width-input')?.addEventListener('change', (event) => {
    applyPreviewPreset('custom', { width: event.target.value })
    output('#command-output', `Custom canvas width selected: ${state.layout.previewWidth}px. Preview remains local.`)
  })
  document.querySelector('#canvas-width-input')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    applyPreviewPreset('custom', { width: event.target.value })
    output('#command-output', `Custom canvas width selected: ${state.layout.previewWidth}px. Preview remains local.`)
  })
  document.querySelector('#canvas-fit-toggle')?.addEventListener('click', () => {
    const nextFit = !state.layout.previewFit
    applyPreviewPreset(nextFit ? 'fit' : 'custom', { width: state.layout.previewWidth, fit: nextFit })
    output('#command-output', nextFit ? 'Canvas now fits the available editor width.' : `Canvas restored to ${state.layout.previewWidth}px.`)
  })
  document.querySelector('#run-sync')?.addEventListener('click', () => void refresh().then(() => output('#command-output', 'Local sync check complete. Review provider cards and next gates.')).catch((error) => output('#command-output', error.message)))
  document.querySelector('#page-list')?.addEventListener('click', (event) => { const button = event.target.closest('[data-page-id]'); if (button) selectPage(button.dataset.pageId) })
  document.querySelector('#canvas-page-select')?.addEventListener('change', (event) => {
    if (event.target.value) selectPage(event.target.value)
  })
  document.querySelector('#page-meta-form')?.addEventListener('submit', (event) => void savePageModel(event).catch((error) => output('#command-output', error.message)))
  document.querySelector('#page-create-form')?.addEventListener('submit', (event) => void createPageModel(event).catch((error) => output('#command-output', `Page model blocked: ${error.message}`)))
  document.querySelector('#open-page-source')?.addEventListener('click', () => { const page = selectedPage(); if (!page) return; const select = document.querySelector('#source-file-select'); if (select) select.value = page.source; activateRightPanel('source'); void loadSource().catch((error) => output('#source-output', error.message)) })
  document.querySelector('#canvas-tree')?.addEventListener('click', (event) => { const button = event.target.closest('[data-remove-node]'); if (button) void removeNode(button.dataset.removeNode).catch((error) => output('#canvas-output', error.message)) })
  document.querySelector('#canvas-tree')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-node]')
    if (!button) return
    state.selectedNodeId = button.dataset.selectNode
    renderCanvas(selectedPage())
    const node = selectedPage()?.nodeTree?.nodes?.[state.selectedNodeId]
    const name = document.querySelector('#component-name')
    if (name && !name.value) name.value = node?.label?.replace(/\s+module$/i, '') ?? ''
    output('#component-output', `Selected ${node?.label ?? 'node'} · ready to tag as a reusable module.`)
  })
  document.querySelectorAll('[data-node-type]').forEach((button) => button.addEventListener('click', () => void addNode(button.dataset.nodeType).catch((error) => output('#canvas-output', error.message))))
  document.querySelector('#collection-list')?.addEventListener('click', (event) => { const button = event.target.closest('[data-collection-id]'); if (!button) return; state.selectedCollectionId = button.dataset.collectionId; renderCollections(state.data.collections); renderRecords(state.data.collections.find((item) => item.id === state.selectedCollectionId)) })
  document.querySelector('#record-form')?.addEventListener('submit', (event) => void addRecord(event).catch((error) => output('#command-output', error.message)))
  document.querySelector('#user-form')?.addEventListener('submit', (event) => void addUser(event).catch((error) => output('#command-output', error.message)))
  document.querySelector('#refresh-source-inventory')?.addEventListener('click', () => void refreshSourceInventory())
  document.querySelector('#source-extension-filter')?.addEventListener('change', () => { renderSourceInventory(); persistSourceNavigation() })
  document.querySelector('#source-metadata-search')?.addEventListener('input', () => { renderSourceInventory(); persistSourceNavigation() })
  document.querySelector('#select-source-path')?.addEventListener('click', selectCanonicalSourcePath)
  document.querySelector('#source-canonical-path')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); selectCanonicalSourcePath() } })
  document.querySelector('#review-source-policy')?.addEventListener('click', () => void reviewSourcePolicy())
  document.querySelector('#export-source-inventory')?.addEventListener('click', exportSourceInventory)
  document.querySelector('#source-navigation-opt-in')?.addEventListener('change', event => {
    state.sourceNavigationEnabled = event.target.checked
    state.sourceNavigationPending = null
    if (state.sourceNavigationEnabled) persistSourceNavigation()
    else {
      try { const key = sourceNavigationStorageKey(); if (key) window.localStorage.removeItem(key); text('#source-navigation-status', 'Remembered navigation removed for this checkout. The source editor, recovery slot and other checkout preferences are unchanged.') }
      catch { text('#source-navigation-status', 'Browser storage refused removal. Navigation is off for this page; the saved metadata may remain. The editor and recovery slot are kept.') }
    }
  })
  document.querySelector('#load-source')?.addEventListener('click', () => void loadSource().catch((error) => output('#source-output', error.message)))
  document.querySelector('#source-editor')?.addEventListener('input', () => {
    renderSourceRevision()
    invalidateSourceRecoveryReview('The open draft changed. Review saved draft again before restoring over it.')
    stopSourceDraftPreviewRead('Draft edited since preview. Captured text, digest and baseline are kept; Preview draft captures the newer text.')
    invalidateSourceComparison('Draft changed. Comparison is outdated; compare latest and review again.')
  })
  document.querySelector('#source-file-select')?.addEventListener('change', () => {
    state.sourceTargetGeneration += 1
    state.sourceNavigationPending = null
    renderSourceFileMetadata()
    persistSourceNavigation()
    invalidateSourceRecoveryReview('Selected source changed. Review saved draft again before restoring.')
    invalidateSourceHistory()
    stopSourceDraftPreviewRead('Selected source changed. The preview retains its captured path, text and baseline.')
    invalidateSourceComparison('Selected source changed. Comparison is outdated; compare latest and review again.')
  })
  document.querySelector('#source-recovery-opt-in')?.addEventListener('change', (event) => {
    if (!event.target.checked) discardSourceRecovery(true)
    else { state.sourceRecoveryEnabled = true; invalidateSourceRecoveryReview('Recovery enabled for explicit snapshots only. Store recovery draft records one snapshot; typing never stores it.') }
  })
  document.querySelector('#store-source-recovery')?.addEventListener('click', () => void storeSourceRecovery())
  document.querySelector('#review-source-recovery')?.addEventListener('click', () => void reviewSourceRecovery())
  document.querySelector('#restore-source-recovery')?.addEventListener('click', restoreSourceRecovery)
  document.querySelector('#discard-source-recovery')?.addEventListener('click', () => discardSourceRecovery())
  document.querySelector('#review-source-export')?.addEventListener('click', () => void reviewSourceExport())
  document.querySelector('#download-source-export')?.addEventListener('click', downloadSourceExport)
  document.querySelector('#cancel-source-export')?.addEventListener('click', () => { invalidateSourceExport(); state.sourceExport = null; renderSourceExport() })
  document.querySelector('#refresh-source-history')?.addEventListener('click', () => void refreshSourceHistory())
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== sourceRecoveryKey()) return
    invalidateSourceRecoveryReview('The saved recovery slot changed in another tab. Review it again before restoring.')
    try { readSourceRecoveryRecord() } catch { state.sourceRecoveryRecord = null; state.sourceRecoveryState = 'invalid' }
    renderSourceRecovery()
  })
  document.querySelector('#preview-source-draft')?.addEventListener('click', () => void previewSourceDraft())
  document.querySelector('#check-source-draft-preview')?.addEventListener('click', () => void checkSourceDraftPreview())
  document.querySelector('#close-source-draft-preview')?.addEventListener('click', () => {
    stopSourceDraftPreviewRead()
    state.sourceDraftPreview = null
    renderSourceDraftPreview()
  })
  document.querySelector('#reload-source')?.addEventListener('click', () => void loadSource({ path: state.sourcePath }).catch((error) => output('#source-output', error.message)))
  document.querySelector('#save-source')?.addEventListener('click', () => void saveSource().catch((error) => output('#source-output', error.message)))
  document.querySelector('#compare-source')?.addEventListener('click', () => void compareLatestSource().catch((error) => output('#source-output', error.message)))
  document.querySelector('#cancel-source-review')?.addEventListener('click', () => {
    invalidateSourceComparison('Comparison cancelled. The draft and loaded base are kept.', true)
    output('#source-output', 'Comparison cancelled. The draft and loaded base are kept; no source was saved.')
  })
  document.querySelector('#prepare-source-replacement')?.addEventListener('click', prepareSourceReplacement)
  document.querySelector('#component-save-form')?.addEventListener('submit', (event) => void saveComponent(event).catch((error) => output('#component-output', `Module blocked: ${error.message}`)))
  document.querySelector('#ingest-form')?.addEventListener('submit', (event) => void ingestProject(event).catch((error) => output('#ingest-output', `Inventory blocked: ${error.message}`)))
}

async function saveComponent(event) {
  event.preventDefault()
  const page = selectedPage()
  const result = await post('/api/builder/component', {
    confirmation: document.querySelector('#component-confirmation')?.value,
    name: document.querySelector('#component-name')?.value,
    source: document.querySelector('#component-source')?.value,
    tags: document.querySelector('#component-tags')?.value,
    slots: document.querySelector('#component-slots')?.value,
    width: document.querySelector('#component-width')?.value,
    pageId: page?.id,
    nodeId: state.selectedNodeId,
  })
  document.querySelector('#component-confirmation').value = ''
  output('#component-output', `${result.component.name} saved locally${result.linkedNode ? ' and linked to the selected page node' : ''} · export format ${result.component.export.format} v${result.component.export.version}`)
  await refresh()
}

async function ingestProject(event) {
  event.preventDefault()
  const result = await post('/api/builder/ingest', {
    confirmation: document.querySelector('#ingest-confirmation')?.value,
    projectRoot: document.querySelector('#ingest-root')?.value,
  })
  document.querySelector('#ingest-confirmation').value = ''
  const manifest = result.manifest
  output('#ingest-output', `Inventory complete · ${manifest.project.framework} · ${manifest.pages.length} pages · ${manifest.components.length} components · review ${result.manifestPath}`)
}

async function boot() {
  state.status = getEmbeddedStatus()
  if (state.status) renderStatus(state.status)
  setCanvasDockOpen(false)
  restoreLayout()
  applyInspectorTabs(state.layout.activeRight || 'style')
  bind()
  identityInspector = attachSourceIdentityInspector({
    container: document.querySelector('#panel-source'),
    api: (path, options = {}) => {
      if (path === '/api/identity/preview' && typeof options.body === 'string') {
        const body = JSON.parse(options.body)
        if (/^src\/components\/(?:layout|navigation|shell)\//.test(body.path)) {
          const route = currentPreviewRoute().split('#')[0]
          if (mappedPageForRoute(route)) options = { ...options, body: JSON.stringify({ ...body, route }) }
        }
      }
      return request(path, options)
    },
    selectedPath: () => document.querySelector('#source-file-select')?.value ?? '',
    onStageLiteral: stageIdentityLiteral,
  })
  document.querySelector('#work-scope-select')?.addEventListener('change', (event) => {
    const value = event.target.value
    state.workSelection = value === 'root' ? { kind: 'root' } : value.startsWith('child:') ? { kind: 'child', name: value.slice(6) } : null
    document.querySelector('#work-status-view')?.replaceChildren(create('p', 'panel-help', 'Reading selected work sources…'))
    void refresh().catch((error) => {
      text('#work-scope-help', `Selected status unavailable: ${error.message}`)
      document.querySelector('#work-status-view')?.replaceChildren(create('p', 'panel-help', 'Work source status unavailable. Refresh to retry.'))
    })
  })
  activateWorkspaceFromHash()
  try {
    await refresh()
    await loadFontWorkspace()
    if (state.layout.previewFit) {
      window.requestAnimationFrame(() => applyPreviewPreset('fit', { fit: true }))
    }
    const bootPanelId = window.location.hash.replace(/^#/, '')
    if (leftPanelIds.has(bootPanelId) || rightPanelIds.has(bootPanelId)) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0)
    }
  } catch (error) {
    output('#command-output', error.message)
    if (!state.status) {
      text('#controller-state', 'Offline')
      text('#controller-detail', error.message)
    }
  }
}

void boot()
