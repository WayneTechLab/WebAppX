const workspaceFormat = /^[a-f0-9]{64}$/
const documentFormat = /^doc_[a-f0-9]{64}$/
const nodeFormat = /^node_[a-f0-9]{64}$/
const scopeFormat = /^scope_[a-f0-9]{64}$/
const prefix = 'systemx.lan.navigator-bookmarks.v1.'
export const navigatorBookmarkLimit = 12

const sameTarget = (a, b) => a?.documentId === b?.documentId && a?.nodeId === b?.nodeId && a?.scopeId === b?.scopeId
const refusal = message => ({ ok: false, message })
const success = message => ({ ok: true, message })
const changed = () => refusal('The workspace or target changed. Inspect the current hierarchy and try again.')
const unavailable = () => refusal('Bookmark storage is unavailable. Check this browser’s site storage permissions.')
const missing = () => refusal('Bookmark unresolved. The target is missing, ambiguous, stale, or outside the current accepted document.')

function validBookmark(entry) {
  return entry && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length === 3 &&
    typeof entry.documentId === 'string' && documentFormat.test(entry.documentId) &&
    typeof entry.nodeId === 'string' && nodeFormat.test(entry.nodeId) && typeof entry.scopeId === 'string' && scopeFormat.test(entry.scopeId)
}

async function routeScope(workspaceId, documentId, route) {
  if (typeof route !== 'string' || route.length > 512 || !route.startsWith('/') || /[?#\\\p{Cc}]/u.test(route)) return null
  const bytes = new TextEncoder().encode(JSON.stringify(['navigator-bookmark-v1', workspaceId, documentId, route]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return 'scope_' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function defaultWriteLock(name, operation) {
  // localStorage has no compare-and-swap across tabs. Serialize explicit edits
  // and re-read under the browser's origin-scoped lock before changing a slot.
  if (!globalThis.navigator?.locks) return refusal('This browser cannot coordinate bookmark writes across tabs. Saved bookmarks can still be resolved.')
  return globalThis.navigator.locks.request(name, { ifAvailable: true }, lock =>
    lock ? operation() : refusal('Another tab is changing these bookmarks. Try again when it finishes.'))
}

export function createNavigatorBookmarks({ getWorkspace, inspect, reveal, storage = () => window.localStorage, withWriteLock = defaultWriteLock }) {
  function read() {
    const workspaceId = getWorkspace()
    const result = { workspaceId, status: 'unavailable', bookmarks: [], raw: null }
    if (typeof workspaceId !== 'string' || !workspaceFormat.test(workspaceId)) return { ...result, status: 'no-workspace' }
    try { result.raw = storage().getItem(prefix + workspaceId) } catch { return result }
    if (result.raw === null) return { ...result, status: 'ready' }
    try {
      if (result.raw.length > 4096) return { ...result, status: 'invalid' }
      const value = JSON.parse(result.raw)
      if (value?.version === 1 && Object.keys(value).length === 2 && Array.isArray(value.bookmarks) &&
          value.bookmarks.length <= navigatorBookmarkLimit && value.bookmarks.every(validBookmark) &&
          !value.bookmarks.some((entry, index, all) => all.slice(0, index).some(other => sameTarget(entry, other)))) {
        return { ...result, status: 'ready', bookmarks: value.bookmarks }
      }
    } catch { /* Malformed local data stays untouched until explicitly removed. */ }
    return { ...result, status: 'invalid' }
  }

  function inspectCurrent(workspaceId) {
    const context = inspect()
    if (!context || !context.snapshot?.root || context.workspaceId !== workspaceId || getWorkspace() !== workspaceId) return changed()
    if (context.snapshot.rangeLimited) return refusal('Inspection is incomplete. A truncated range cannot establish a unique bookmark target.')
    return { ok: true, context }
  }

  function findTarget(context, bookmark) {
    let match = null
    for (const [element, identity] of context.identities) {
      if (identity.workspaceId !== context.workspaceId || identity.route !== context.route ||
          identity.documentId !== bookmark.documentId || identity.nodeId !== bookmark.nodeId) continue
      if (match) return null
      match = { element, identity }
    }
    return match
  }

  async function act(workspaceId, bookmark, live = inspectCurrent(workspaceId)) {
    if (!live.ok) return live
    const first = live.context
    const selected = first.identities.get(first.selected)
    const reference = bookmark ?? selected
    if (!reference || typeof reference.documentId !== 'string' || !documentFormat.test(reference.documentId) ||
        typeof reference.nodeId !== 'string' || !nodeFormat.test(reference.nodeId)) return refusal('Select a unique, current source-mapped hierarchy target before saving.')
    const target = findTarget(first, reference)
    if (!target || (!bookmark && target.element !== first.selected)) return missing()
    let scopeId
    try { scopeId = await routeScope(workspaceId, reference.documentId, first.route) }
    catch { return refusal('A route-qualified bookmark requires browser cryptography on this local origin.') }
    if (!scopeId || (bookmark && bookmark.scopeId !== scopeId)) return refusal('This bookmark belongs to another route. Open its original preview scope to resolve it.')

    const liveAgain = inspectCurrent(workspaceId)
    if (!liveAgain.ok) return liveAgain
    const next = liveAgain.context
    const candidate = findTarget(next, reference)
    if (next.snapshot.root !== first.snapshot.root || next.route !== first.route || candidate?.element !== target.element ||
        candidate.identity.key !== target.identity.key || next.selected !== first.selected) return changed()
    const data = read()
    if (data.workspaceId !== workspaceId) return changed()
    if (data.status === 'invalid') return refusal('Saved bookmark data is invalid. Delete the invalid workspace bookmark data explicitly to recover.')
    if (data.status !== 'ready') return unavailable()
    if (bookmark) {
      if (!data.bookmarks.some(item => sameTarget(item, bookmark))) return refusal('This bookmark was removed. Refresh the list.')
      return reveal(candidate.element, next.snapshot) ? success('Bookmark resolved. See the Navigator for reveal progress.') : changed()
    }
    const nextBookmark = { documentId: reference.documentId, nodeId: reference.nodeId, scopeId }
    if (data.bookmarks.some(item => sameTarget(item, nextBookmark))) return { ...success('This target is already bookmarked.'), bookmark: nextBookmark }
    if (data.bookmarks.length >= navigatorBookmarkLimit) return refusal(`All ${navigatorBookmarkLimit} bookmark slots are in use. Delete a bookmark before saving another.`)
    storage().setItem(prefix + workspaceId, JSON.stringify({ version: 1, bookmarks: [...data.bookmarks, nextBookmark] }))
    return { ...success('Bookmarked the selected hierarchy target.'), bookmark: nextBookmark }
  }

  async function edit(workspaceId, operation) {
    if (typeof workspaceId !== 'string' || !workspaceFormat.test(workspaceId) || workspaceId !== getWorkspace()) return changed()
    try { return await withWriteLock(prefix + workspaceId, () => workspaceId === getWorkspace() ? operation() : changed()) }
    catch { return refusal('Bookmark write failed. Check this browser’s storage permissions and quota.') }
  }

  return { read,
    async save(workspaceId) {
      if (typeof workspaceId !== 'string' || !workspaceFormat.test(workspaceId) || workspaceId !== getWorkspace()) return changed()
      try {
        // Capture the operator's selection before another tab can delay admission.
        const live = inspectCurrent(workspaceId)
        if (!live.ok) return live
        return await edit(workspaceId, () => act(workspaceId, null, live))
      } catch { return changed() }
    },
    async resolve(workspaceId, bookmark) {
      if (!validBookmark(bookmark) || typeof workspaceId !== 'string' || !workspaceFormat.test(workspaceId) || workspaceId !== getWorkspace()) return changed()
      try { return await act(workspaceId, bookmark) } catch { return missing() }
    },
    remove(workspaceId, bookmark, invalidRaw) {
      return edit(workspaceId, () => {
        const data = read()
        const key = prefix + workspaceId
        if (data.status === 'invalid' && typeof invalidRaw === 'string' && data.raw === invalidRaw) {
          storage().removeItem(key)
          return success('Deleted the invalid bookmark data for this workspace.')
        }
        if (data.status !== 'ready' || !validBookmark(bookmark)) return changed()
        const remaining = data.bookmarks.filter(item => !sameTarget(item, bookmark))
        if (remaining.length === data.bookmarks.length) return refusal('This bookmark was already removed.')
        if (remaining.length) storage().setItem(key, JSON.stringify({ version: 1, bookmarks: remaining }))
        else storage().removeItem(key)
        return success('Deleted the bookmark.')
      })
    },
  }
}

export function mountNavigatorBookmarks(before, options) {
  const doc = before.ownerDocument
  const create = (tag, text = '') => { const node = doc.createElement(tag); node.textContent = text; return node }
  const panel = create('details'), heading = create('summary', 'Bookmarks')
  panel.id = 'preview-navigator-bookmarks'; panel.className = 'panel-guidance'
  const actions = create('div'); actions.className = 'navigator-actions'
  const slots = create('select'); slots.dataset.navBookmarkList = ''; slots.setAttribute('aria-label', 'Saved hierarchy bookmarks')
  slots.style.maxWidth = '100%'
  const status = create('output'); status.dataset.navBookmarkStatus = ''; status.className = 'command-output'; status.setAttribute('aria-live', 'polite')
  function button(label, flag) {
    const node = create('button', label); node.type = 'button'; node.className = 'button'; node.dataset[flag] = ''
    return node
  }
  const save = button('Bookmark selection', 'navBookmarkSave'), resolve = button('Resolve and reveal', 'navBookmarkResolve')
  const remove = button('Delete bookmark', 'navBookmarkDelete')
  actions.append(save, resolve, remove)
  panel.append(heading, slots, actions, status)
  before.before(panel)
  const bookmarks = createNavigatorBookmarks({ ...options, inspect: () => panel.open ? options.inspect() : null })
  let shown, busy = false
  const selected = () => shown?.bookmarks[slots.selectedIndex]
  function update() {
    if (!panel.open) return
    const data = bookmarks.read()
    const previous = selected()
    if (data.workspaceId !== shown?.workspaceId || data.raw !== shown?.raw || data.status !== shown?.status) {
      const choices = data.bookmarks.map((entry, index) => {
        return create('option', `${index + 1}. Node ${entry.nodeId.slice(5, 17)} · document ${entry.documentId.slice(4, 12)}`)
      })
      slots.replaceChildren(...choices)
      const keep = choices.length ? data.bookmarks.findIndex(item => sameTarget(item, previous)) : -1
      slots.selectedIndex = keep >= 0 ? keep : choices.length ? 0 : -1
      status.textContent = data.status === 'invalid' ? 'Saved bookmark data is invalid. You can explicitly delete this workspace’s invalid bookmark data.'
        : data.status === 'no-workspace' ? 'A verified workspace is needed to use bookmarks.'
        : data.status === 'unavailable' ? unavailable().message : `${choices.length} of ${navigatorBookmarkLimit} bookmark slots used.`
    }
    shown = data
    save.disabled = busy || data.status !== 'ready'
    resolve.disabled = busy || !selected()
    remove.disabled = busy || (!selected() && data.status !== 'invalid')
    remove.textContent = data.status === 'invalid' ? 'Delete invalid bookmark data' : 'Delete bookmark'
    slots.disabled = busy || !data.bookmarks.length
  }
  async function perform(action) {
    if (busy || !shown) return
    const workspace = shown.workspaceId, target = selected(), invalid = shown.status === 'invalid' ? shown.raw : undefined
    busy = true; update()
    try {
      const result = action === 'save' ? await bookmarks.save(workspace) : action === 'resolve'
        ? await bookmarks.resolve(workspace, target) : await bookmarks.remove(workspace, target, invalid)
      update()
      if (shown.workspaceId !== workspace) return
      if (result.bookmark) slots.selectedIndex = shown.bookmarks.findIndex(item => sameTarget(item, result.bookmark))
      status.textContent = result.message
    } finally { busy = false; update() }
  }
  panel.addEventListener('toggle', update)
  save.addEventListener('click', () => void perform('save'))
  resolve.addEventListener('click', () => void perform('resolve'))
  remove.addEventListener('click', () => void perform('remove'))
  doc.defaultView?.addEventListener('storage', event => {
    if (panel.open && (event.key === null || event.key === prefix + shown?.workspaceId)) update()
  })
  return { update }
}
