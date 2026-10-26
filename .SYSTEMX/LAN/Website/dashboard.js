import { previewNavigatorLimits, collectPreviewHierarchy, projectPreviewRows, ancestorPreviewEntries, isCurrentPreviewElement } from './preview-navigator.js'
import { sourceComparisonLimits, compareSourceText } from './source-comparison.js'

const apiBase = window.location.pathname.startsWith('/__systemx') ? '/__systemx' : ''
const sessionToken = document.querySelector('meta[name="systemx-session"]')?.content ?? ''
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
  sourceRevision: null,
  sourceLoadedContent: null,
  sourceDisplayBaseline: null,
  sourceConflictRevision: null,
  sourceLoadGeneration: 0,
  sourceLoading: false,
  sourceSaving: false,
  sourceUnavailable: false,
  sourceComparison: null,
  sourceComparisonGeneration: 0,
  sourceComparisonController: null,
  sourceComparing: false,
  sourceReviewMessage: '',
  components: [],
  previewSelectedElement: null,
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
  layout: loadLayout(),
}

const runtimeStyleRules = new Map()

function setRuntimeStyleRule(name, css) {
  const style = document.querySelector('#systemx-runtime-style')
  if (!style) return
  runtimeStyleRules.set(name, css)
  style.textContent = [...runtimeStyleRules.values()].join('\n')
}

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

function setWorkspaceMenu(open) {
  const panel = document.querySelector('#workspace-menu')
  const toggle = document.querySelector('#workspace-menu-toggle')
  if (!panel || !toggle) return
  panel.hidden = !open
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close SYSTEMX workspace menu' : 'Open SYSTEMX workspace menu')
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
  try {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(state.layout))
  } catch {
    // Layout persistence is optional; the builder remains usable without storage.
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
  const availableWidth = viewport.clientWidth || viewport.parentElement?.clientWidth || state.layout.previewWidth
  const width = clampPreviewWidth(fit
    ? availableWidth
    : options.width ?? preset?.width ?? state.layout.previewWidth)
  const label = fit ? 'Fit workspace' : custom ? 'Custom canvas' : preset?.label ?? 'Custom canvas'
  const platform = fit ? 'Responsive' : custom ? 'Custom' : preset?.platform ?? 'Custom'

  state.layout.previewPreset = fit ? 'fit' : custom ? 'custom' : presetId
  state.layout.previewWidth = width
  state.layout.previewFit = fit

  viewport.dataset.previewMode = fit ? 'fit' : 'fixed'
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
    if (validSourceRevision(result.currentRevision)) error.currentRevision = result.currentRevision.toLowerCase()
    throw error
  }
  return result
}

async function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) })
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
  state.selectedFont = font
  document.querySelector('#font-preview-selected')?.removeAttribute('disabled')
  document.querySelector('#font-load-selected')?.removeAttribute('disabled')
  document.querySelector('#font-save-project')?.removeAttribute('disabled')
  renderFontList()
  const sample = document.querySelector('#font-preview-sample')
  if (sample) sample.style.fontFamily = fontStack(font.family)
  output('#font-status', `${font.family} selected · ${font.category} · ${font.variants.slice(0, 6).join(', ') || 'default'} · Google CSS2 preview is ready.`)
  if (options.load !== false) void loadFontInPreview(font)
}

async function loadFontWorkspace() {
  const [catalog, project] = await Promise.all([
    request('/api/fonts/catalog'),
    request('/api/fonts/project'),
  ])
  state.fontCatalog = catalog.items ?? []
  state.fontCatalogMeta = catalog
  renderProjectFont(project)
  text('#font-catalog-state', `${state.fontCatalog.length} families · ${catalog.source === 'google-developer-api' ? 'live metadata' : 'offline fallback'}`)
  renderFontList()
  if (catalog.warning) output('#font-status', catalog.warning)
  const projectFont = state.fontCatalog.find((font) => font.family === project.family)
  if (projectFont) selectFont(projectFont.family, { load: false })
  renderLoadedFonts()
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
  if (frame.src !== targetUrl) frame.src = targetUrl
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
  selectPreviewElement(element, { openEditor: true, restoring: true })
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
  const sourceReady = loadedSource?.element === element && loadedSource.path === location.sourcePath
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
      selectPreviewElement(event.target, { openEditor: true })
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
  if (source?.element !== element || source.path !== location.sourcePath || !validSourceRevision(source.revision)) {
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
  state.previewTextSaving = element
  setControlDisabled('#settings-text-save', true)
  try {
    result = await post('/api/builder/source', {
      path: location.sourcePath,
      content: nextContent,
      baseRevision: source.revision,
      confirmation: 'SAVE LOCAL CHANGE',
    })
    if (!validSourceRevision(result.revision)) throw new Error('Saved source revision is unavailable. Reload latest source before another save.')
  } catch (error) {
    if (sourceRevisionConflict(error)) {
      if (state.previewSelectedElement === element) {
        if (state.previewTextSource === source) source.currentRevision = error.currentRevision
        renderSelectedTextRevision()
        output('#settings-text-output', 'Source changed since this text draft was loaded. The draft and selected source revision are kept. Choose Reload latest source before reviewing and saving again.')
      }
      return
    }
    if (state.previewSelectedElement === element) output('#settings-text-output', `${error.message} Save was not confirmed; the text draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
    return
  } finally {
    if (state.previewTextSaving === element) state.previewTextSaving = null
    if (state.previewSelectedElement === element) setControlDisabled('#settings-text-save', state.previewTextSourcePending === element)
  }
  if (state.previewTextSource === source) state.previewTextSource = { ...source, content: nextContent, revision: result.revision, currentRevision: null }
  if (location.sourcePath === state.sourcePath) invalidateSourceComparison('Source changed through a selected-text save. Compare latest and review again.')
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
    if (sameOriginPreview && appPreview.src !== status.vite.url) appPreview.src = status.vite.url
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

function renderPageFiles(files) {
  const select = document.querySelector('#source-file-select')
  if (!select) return
  const previousValue = select.value
  const editable = files.filter((file) => /^(src\/pages\/[^/]+\.tsx|src\/components\/(layout|navigation|shell)\/[^/]+\.tsx|src\/config\/siteControls\.ts|src\/index\.css|src\/router\.tsx)$/.test(file))
  const loadedNotListed = Boolean(state.sourcePath && !editable.includes(state.sourcePath))
  select.replaceChildren()
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
  const currentPage = data.pages.find((item) => item.id === state.selectedPageId) ?? previewPage ?? data.pages[0]
  if (currentPage) selectPage(currentPage.id)
  output('#command-output', 'Workspace refreshed. Local changes remain under SYSTEMX control.')
}

function validSourceRevision(revision) {
  return typeof revision === 'string' && revision.length === 64 && /^[a-f0-9]{64}$/i.test(revision)
}

function sourceRevisionConflict(error) {
  return error.status === 409 && error.code === 'SOURCE_REVISION_CONFLICT'
}

function sourceUnavailable(error) {
  return error.status === 404 && error.code === 'SOURCE_UNAVAILABLE'
}

function setSourceUnavailable(path) {
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

function sourceReviewMatches(review = state.sourceComparison) {
  const editor = document.querySelector('#source-editor')
  return Boolean(review && !review.pending && !review.stale && !state.sourceUnavailable
    && review.comparison?.complete && !review.comparison.truncated && review.currentTextMatchesRevision
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
  if (!editor || !path || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || state.sourceComparing) return
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
    if (result.path !== path || !validSourceRevision(result.revision) || typeof result.content !== 'string') throw new Error('Latest source revision is unavailable.')
    if (result.content.length > sourceComparisonLimits.characters) throw new Error(`Latest source exceeds the ${sourceComparisonLimits.characters}-character comparison limit.`)
    const [draftRevision, currentTextRevision] = await Promise.all([sourceTextDigest(draftContent), sourceTextDigest(result.content)])
    if (generation !== state.sourceComparisonGeneration) return
    clearSourceUnavailable()
    Object.assign(review, { currentContent: result.content, currentRevision: result.revision, draftRevision, currentTextMatchesRevision: currentTextRevision === result.revision, comparison: compareSourceText(draftContent, result.content), pending: false })
    state.sourceReviewMessage = ''
    state.sourceConflictRevision = result.revision !== state.sourceRevision ? result.revision : null
    renderSourceRevision()
    renderSourceComparison()
  } catch (error) {
    if (generation !== state.sourceComparisonGeneration) return
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
  label.textContent = source.currentRevision
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
  label.textContent = state.sourceUnavailable
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
  state.previewTextSourcePending = element
  setControlDisabled('#settings-text-save', true)
  output('#settings-source-revision', 'Reading latest source revision; the text draft is kept.')
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(path)}`)
    if (generation !== state.previewTextSourceGeneration || state.previewSelectedElement !== element || state.previewSelection?.sourcePath !== path) return
    if (result.path !== path || !validSourceRevision(result.revision)) throw new Error('Source revision unavailable. Choose Reload latest source before saving.')
    if (state.sourceComparison?.path === path && state.sourceComparison.currentRevision && state.sourceComparison.currentRevision !== result.revision) invalidateSourceComparison('A newer source revision was observed. Compare latest and review again.')
    state.previewTextSource = { element, path, content: result.content, revision: result.revision }
    renderSelectedTextRevision()
  } catch (error) {
    if (generation === state.previewTextSourceGeneration) output('#settings-source-revision', `${error.message} The text draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
  } finally {
    if (generation === state.previewTextSourceGeneration) {
      state.previewTextSourcePending = null
      const loaded = state.previewTextSource
      setControlDisabled('#settings-text-save', loaded?.element !== element || loaded.path !== path || state.previewTextSaving === element)
    }
  }
}

function updateSourceSaveAvailability() {
  setControlDisabled('#save-source', state.sourceLoading || state.sourceSaving || state.sourceComparing || state.sourceUnavailable || !validSourceRevision(state.sourceRevision))
  setControlDisabled('#load-source', state.sourceSaving)
  setControlDisabled('#reload-source', state.sourceSaving)
  setControlDisabled('#compare-source', state.sourceLoading || state.sourceSaving || state.sourceComparing || !validSourceRevision(state.sourceRevision) || document.querySelector('#source-file-select')?.value !== state.sourcePath)
  setControlDisabled('#prepare-source-replacement', state.sourceLoading || state.sourceSaving || state.sourceComparing || !sourceReviewMatches())
  text('#save-source', state.sourceComparison?.prepared && sourceReviewMatches() ? 'Save reviewed replacement' : 'Save')
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
  invalidateSourceComparison('Source load requested. Compare latest again before reviewing replacement.')
  if (state.sourcePath && editor.value !== state.sourceDisplayBaseline && !window.confirm('Reload source and discard the unsaved source draft? Cancel keeps the draft and its loaded revision.')) {
    select.value = state.sourcePath
    output('#source-output', 'Reload cancelled. The source draft and loaded revision are kept.')
    return
  }
  const generation = ++state.sourceLoadGeneration
  state.sourceLoading = true
  editor.disabled = true
  updateSourceSaveAvailability()
  try {
    const result = await request(`/api/builder/source?path=${encodeURIComponent(wantedPath)}`)
    if (generation !== state.sourceLoadGeneration) return
    if (result.path !== wantedPath || !validSourceRevision(result.revision)) throw new Error('Source revision unavailable. Reload source before saving.')
    state.sourcePath = result.path
    state.sourceRevision = result.revision
    state.sourceLoadedContent = result.content
    state.sourceConflictRevision = null
    select.value = result.path
    editor.value = result.content
    state.sourceDisplayBaseline = editor.value
    clearSourceUnavailable()
    text('#source-policy', result.policy)
    renderSourceRevision()
    setControlValue('#source-confirmation', '')
    output('#source-output', `${result.path} loaded · ${result.content.split(/\r?\n/).length} lines`)
  } catch (error) {
    if (generation === state.sourceLoadGeneration) {
      if (sourceUnavailable(error)) setSourceUnavailable(wantedPath)
      output('#source-output', sourceUnavailable(error)
        ? 'Source is unavailable. The source draft and loaded revision are kept; no file will be recreated. Select an existing file or restore it externally, then reload.'
        : `${error.message} The source draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
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
  if (!state.sourcePath || !validSourceRevision(state.sourceRevision) || state.sourceLoading || state.sourceSaving || state.sourceComparing || state.sourceUnavailable) {
    output('#source-output', 'Load a source file before saving.')
    return
  }
  if (select.value !== state.sourcePath) {
    output('#source-output', `Selected file changed to ${select.value}. Load it before saving.`)
    return
  }
  const review = state.sourceComparison?.prepared ? state.sourceComparison : null
  if (review && !sourceReviewMatches(review)) {
    invalidateSourceComparison('Replacement review is outdated. Compare latest and review again.')
    return
  }
  if (review && confirmation.value !== 'SAVE LOCAL CHANGE') {
    output('#source-output', 'Reviewed replacement requires a new SAVE LOCAL CHANGE confirmation before saving.')
    return
  }
  const path = state.sourcePath, baseRevision = review ? review.currentRevision : state.sourceRevision, displayDraft = editor.value
  const content = review ? review.draftContent : sourceContentForDraft(displayDraft)
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
    invalidateSourceComparison('Source save accepted. Compare latest again before another replacement.', true)
    renderSourceRevision()
    output('#source-output', result.status === 'saved' ? `Saved ${result.path}; backup: ${result.backup}. Vite preview can hot reload.` : result.status)
    confirmation.value = ''
    await refresh()
  } catch (error) {
    if (sourceUnavailable(error)) {
      setSourceUnavailable(path)
      output('#source-output', 'Source is unavailable. The draft and loaded revision are kept; no file will be recreated. Select an existing file or restore it externally, then reload.')
      return
    }
    if (!sourceRevisionConflict(error)) {
      if (review) invalidateSourceComparison('Save was not confirmed. Compare latest and review again before another replacement.')
      output('#source-output', `${error.message} Save was not confirmed; the draft and loaded revision are kept. Check the local connection and reload source before retrying.`)
      return
    }
    state.sourceConflictRevision = error.currentRevision
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
    const shell = document.querySelector('.builder-shell')
    if (button.dataset.inspectorGroupButton && !shell?.classList.contains('right-panel-collapsed') && state.layout.activeInspectorGroup === group) {
      setRightPanelCollapsed(true)
      return
    }
    activateRightPanel(currentPanel)
  }))
  window.addEventListener('hashchange', activateWorkspaceFromHash)
  document.querySelector('#left-panel-quick-find')?.addEventListener('click', () => {
    const input = document.querySelector('#builder-command-input')
    input?.focus()
    output('#command-output', 'Quick find ready. Search a panel, route, tool, or SYSTEMX action.')
  })
  document.querySelector('#left-panel-toggle')?.addEventListener('click', () => {
    const shell = document.querySelector('.builder-shell')
    if (shell?.classList.contains('left-panel-collapsed')) activateLeftPanel(state.layout.activeLeft || 'canvas', false)
    else setLeftPanelCollapsed(true)
  })
  document.querySelector('.left-panel .panel-collapse')?.addEventListener('click', () => setLeftPanelCollapsed(true))
  document.querySelector('#left-panel-visibility')?.addEventListener('click', () => {
    setPanelPinned('left', !state.layout.leftPinned)
  })
  document.querySelector('#right-panel-toggle')?.addEventListener('click', () => {
    const shell = document.querySelector('.builder-shell')
    if (shell?.classList.contains('right-panel-collapsed')) activateRightPanel(state.layout.activeRight || 'style', false)
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
    if (event.target.closest('button, a, input, select, textarea, label, .canvas-layers, .canvas-preview-stage')) return
    collapseInspectorToCanvas()
  })
  document.querySelector('#workspace-menu-toggle')?.addEventListener('click', () => {
    const panel = document.querySelector('#workspace-menu')
    setWorkspaceMenu(Boolean(panel?.hidden))
  })
  document.querySelector('#workspace-menu-close')?.addEventListener('click', () => setWorkspaceMenu(false))
  document.querySelector('#workspace-menu')?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setWorkspaceMenu(false)
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
    state.previewSelectedElement = null
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
  document.querySelector('#font-save-project')?.addEventListener('click', async () => {
    if (!state.selectedFont) {
      output('#font-status', 'Select a font before saving a project change.')
      return
    }
    try {
      const result = await post('/api/builder/font', {
        family: state.selectedFont.family,
        confirmation: document.querySelector('#font-confirmation')?.value,
      })
      document.querySelector('#font-confirmation').value = ''
      output('#font-status', result.status === 'unchanged'
        ? `${result.family} is already the active project font.`
        : `${result.family} saved to ${result.path}. Backup: ${result.backup}. Run the quality gates before publishing.`)
      await loadFontWorkspace()
      void loadFontInPreview(state.selectedFont, false)
    } catch (error) {
      output('#font-status', error.message)
    }
  })
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
      document.querySelector('#builder-command-input')?.focus()
      return
    }
    if (event.key === 'Escape') {
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
    if (state.layout.previewFit) applyPreviewPreset('fit', { fit: true })
  })
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
  document.querySelector('#refresh-status')?.addEventListener('click', () => void refresh().catch((error) => output('#command-output', error.message)))
  document.querySelector('#refresh-sync')?.addEventListener('click', () => void refresh().catch((error) => output('#command-output', error.message)))
  document.querySelector('#inspector-refresh-sync')?.addEventListener('click', () => void refresh().catch((error) => output('#inspector-sync-summary', error.message)))
  document.querySelector('#preview-app')?.addEventListener('click', () => { collapseInspectorToCanvas(); if (state.status?.vite?.url) window.open(state.status.vite.url, '_blank', 'noopener,noreferrer') })
  document.querySelector('#canvas-preview')?.addEventListener('click', () => { collapseInspectorToCanvas(); if (state.status?.vite?.url) window.open(state.status.vite.url, '_blank', 'noopener,noreferrer') })
  document.querySelector('#canvas-save')?.addEventListener('click', () => output('#command-output', 'Canvas save staged. Use an explicit source or page-model save to write through the SYSTEMX backup/diff gate.'))
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
  document.querySelector('#load-source')?.addEventListener('click', () => void loadSource().catch((error) => output('#source-output', error.message)))
  document.querySelector('#source-editor')?.addEventListener('input', () => {
    renderSourceRevision()
    invalidateSourceComparison('Draft changed. Comparison is outdated; compare latest and review again.')
  })
  document.querySelector('#source-file-select')?.addEventListener('change', () => invalidateSourceComparison('Selected source changed. Comparison is outdated; compare latest and review again.'))
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
