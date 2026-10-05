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
  data: null,
  selectedPageId: null,
  selectedNodeId: null,
  selectedCollectionId: null,
  sourcePath: null,
  components: [],
  previewSelectedElement: null,
  previewHoveredElement: null,
  previewSelection: null,
  previewSelectionAnchor: null,
  previewContextTarget: null,
  previewParentElements: [],
  previewLayerElements: [],
  previewTextOriginals: new WeakMap(),
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
  if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
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
  const textValue = element.textContent?.replace(/\s+/g, ' ').trim()
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
  state.previewLayerElements = []
  hidePreviewContextMenu()
  document.querySelector('#preview-layer-tree')?.replaceChildren()
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
  setControlDisabled('#style-edit-text', true)
  text('#settings-text-state', 'select leaf text')
  output('#preview-layer-summary', 'Select an element in the preview.')
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

function renderPreviewLayerTree(element, location) {
  const tree = document.querySelector('#preview-layer-tree')
  if (!tree) return
  tree.replaceChildren()
  state.previewLayerElements = []
  const ancestors = []
  let current = element
  while (current && current.tagName !== 'HTML') {
    ancestors.unshift(current)
    if (current.tagName === 'BODY') break
    current = current.parentElement
  }
  const rows = ancestors.map((item, index) => ({ element: item, depth: index, selected: item === element }))
  const childDepth = rows.length
  for (const child of [...element.children].slice(0, 10)) {
    rows.push({ element: child, depth: childDepth, selected: false })
  }
  rows.forEach((entry) => {
    const index = state.previewLayerElements.push(entry.element) - 1
    const button = create('button', `preview-layer-row${entry.selected ? ' selected' : ''}`)
    button.type = 'button'
    button.dataset.previewLayerIndex = String(index)
    button.dataset.previewDepth = String(Math.min(entry.depth, 8))
    button.setAttribute('aria-pressed', String(entry.selected))
    button.append(
      create('span', '', entry.selected ? '◎' : entry.element.children.length ? '▾' : '↳'),
      create('small', '', elementLabel(entry.element)),
    )
    tree.append(button)
  })
  output('#preview-layer-summary', `${location.route} · ${rows.length} live hierarchy rows · ${location.sourcePath || 'source unmapped'}`)
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
  setControlDisabled('#settings-text-save', !editable)
  text('#settings-text-state', editable ? `${location.textValue.length} characters` : 'not editable')
  output(
    '#settings-text-output',
    editable
      ? `Original: "${location.originalText}". Preview changes stay in this local iframe until explicitly saved.`
      : location.textReason,
  )
  renderPreviewLayerTree(element, location)
}

function selectPreviewElement(element, options = {}) {
  if (!isElement(element)) return
  state.previewSelectedElement?.removeAttribute('data-systemx-inspector-selected')
  element.setAttribute('data-systemx-inspector-selected', '')
  state.previewSelectedElement = element
  state.previewSelection = previewLocation(element)
  state.previewSelectionAnchor = makePreviewSelectionAnchor(state.previewSelection)
  state.previewContextTarget = element
  const location = state.previewSelection
  const page = mappedPageForRoute(location.route.split('#')[0])
  text('#canvas-breadcrumb-page', page?.name ?? location.route)
  text('#canvas-breadcrumb-element', location.label)
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
    return
  }

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
  state.sourcePath = sourcePath
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
  const nextText = validatedTextDraft()
  if (nextText === textInfo.originalText) {
    output('#settings-text-output', 'The text matches the source value; nothing needs to be saved.')
    return
  }
  const source = await request(`/api/builder/source?path=${encodeURIComponent(location.sourcePath)}`)
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
  const result = await post('/api/builder/source', {
    path: location.sourcePath,
    content: nextContent,
    confirmation: 'SAVE LOCAL CHANGE',
  })
  if (confirmation) confirmation.value = ''
  state.previewTextOriginals.set(element, nextText)
  element.textContent = nextText
  if (state.previewSelection) {
    state.previewSelection.textValue = nextText
    state.previewSelection.originalText = nextText
    state.previewSelectionAnchor = makePreviewSelectionAnchor(state.previewSelection)
  }
  output(
    '#settings-text-output',
    result.status === 'saved'
      ? `Saved "${nextText}" to ${result.path}. Backup: ${result.backup}. Vite will hot reload; run typecheck, lint, and build next.`
      : `Text source result: ${result.status}.`,
  )
  await refresh()
}

function renderStatus(status) {
  state.status = status
  const operating = status.operating
  text('#systemx-version-state', operating?.installed
    ? `SYSTEMX ${operating.selectedVersion} · ${operating.updatePolicy} updates · pinned ${operating.pinnedVersion}`
    : 'Managed SYSTEMX is not installed')
  text('#systemx-record-state', operating
    ? `${operating.taskCount} recorded tasks · ${operating.agentRoles.length} registered roles · ${operating.childProjectCount} child projects`
    : 'Project records unavailable')
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
  select.replaceChildren()
  for (const file of editable) {
    const option = create('option', '', file)
    option.value = file
    select.append(option)
  }
  const preferredValue = state.sourcePath && editable.includes(state.sourcePath)
    ? state.sourcePath
    : previousValue && editable.includes(previousValue)
      ? previousValue
      : ''
  if (preferredValue) select.value = preferredValue
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
  text('#canvas-breadcrumb-element', 'Body')
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
  const [status, data] = await Promise.all([request('/api/status'), request('/api/builder/data')])
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

async function loadSource() {
  const select = document.querySelector('#source-file-select')
  const editor = document.querySelector('#source-editor')
  if (!select || !editor || !select.value) return
  const result = await request(`/api/builder/source?path=${encodeURIComponent(select.value)}`)
  state.sourcePath = result.path
  select.value = result.path
  editor.value = result.content
  text('#source-policy', result.policy)
  output('#source-output', `${result.path} loaded · ${result.content.split(/\r?\n/).length} lines`)
}

async function saveSource() {
  const select = document.querySelector('#source-file-select')
  const editor = document.querySelector('#source-editor')
  const confirmation = document.querySelector('#source-confirmation')
  if (!select || !editor || !confirmation) return
  if (!state.sourcePath) {
    output('#source-output', 'Load a source file before saving.')
    return
  }
  if (select.value !== state.sourcePath) {
    output('#source-output', `Selected file changed to ${select.value}. Load it before saving.`)
    return
  }
  const result = await post('/api/builder/source', { path: state.sourcePath, content: editor.value, confirmation: confirmation.value })
  output('#source-output', result.status === 'saved' ? `Saved ${result.path}; backup: ${result.backup}. Vite preview can hot reload.` : result.status)
  confirmation.value = ''
  await refresh()
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
    state.previewSelectedElement = null
    state.previewHoveredElement = null
    state.previewLayerElements = []
    state.previewTextOriginals = new WeakMap()
    state.previewContextTarget = null
    hidePreviewContextMenu()
    document.querySelector('#preview-layer-tree')?.replaceChildren()
    output('#preview-layer-summary', 'Select an element in the preview.')
    schedulePreviewInspector()
    renderLoadedFonts()
    if (state.selectedFont) window.setTimeout(() => void loadFontInPreview(state.selectedFont, false), 150)
  })
  document.querySelector('#preview-layer-tree')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-layer-index]')
    if (!button) return
    const element = state.previewLayerElements[Number.parseInt(button.dataset.previewLayerIndex, 10)]
    if (element) selectPreviewElement(element, { openEditor: true })
  })
  document.querySelector('#settings-text-preview')?.addEventListener('click', previewSelectedText)
  document.querySelector('#settings-text-revert')?.addEventListener('click', revertSelectedText)
  document.querySelector('#settings-text-source')?.addEventListener('click', openPreviewSource)
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
  document.querySelector('#open-page-source')?.addEventListener('click', () => { const page = selectedPage(); if (!page) return; state.sourcePath = page.source; const select = document.querySelector('#source-file-select'); if (select) select.value = page.source; activateRightPanel('source'); void loadSource().catch((error) => output('#source-output', error.message)) })
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
  document.querySelector('#save-source')?.addEventListener('click', () => void saveSource().catch((error) => output('#source-output', error.message)))
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
