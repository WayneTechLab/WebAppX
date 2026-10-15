import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { createUnsavedWorkController, unsavedRouteTransition, isUnsavedPortalShell } = await loadMockModel(new URL('../../src/portals/unsaved-work-core.ts', import.meta.url))
const { createNavigationDriver, installNavigationGuard, NAVIGATION_STATE_KEY } = await loadMockModel(new URL('../../src/lib/navigation.ts', import.meta.url))

function participant(controller, { id = 'cms-editor', portal = 'cms', label = 'CMS draft', dirty = true } = {}) {
  const current = { dirty, discards: 0, focuses: 0 }
  const read = () => ({ id, portal, label, isDirty: () => current.dirty, discard() { current.discards++; current.dirty = false }, focus() { current.focuses++ } })
  const unregister = controller.register(read)
  return { current, read, unregister }
}

function browserFixture({ start = '/cms/demo', native = false, history, initialPosition } = {}) {
  const controller = createUnsavedWorkController()
  const entries = history ? structuredClone(history) : [{ url: start, state: { unrelated: { value: 'preserve' } } }]
  let position = initialPosition ?? entries.length - 1
  const queued = [], committed = [], moves = [], scrolls = [], requests = []
  const host = {
    location: () => entries[position].url,
    state: () => entries[position].state,
    replace(state, url) { entries[position] = { state: structuredClone(state), url } },
    push(state, url) { entries.splice(position + 1, Infinity, { state: structuredClone(state), url }); position++ },
    go(delta) { moves.push(delta); queued.push(delta) },
    committed: url => committed.push(url),
    scroll: url => scrolls.push(url),
    ...(native ? { position: () => position } : {}),
  }
  const driver = createNavigationDriver(host, (request, commit) => { requests.push(request); return controller.request(unsavedRouteTransition(request.from, request.to), commit) }, 'fixture-session')
  function step() {
    if (!queued.length) return
    const next = position + queued.shift()
    if (next < 0 || next >= entries.length) return
    position = next
    driver.onPopState()
  }
  function flush() {
    let count = 0
    while (queued.length) {
      assert.ok(++count < 30, 'A guarded traversal must not loop')
      step()
    }
  }
  return { controller, driver, entries, committed, moves, scrolls, requests, host, flush, step, location: host.location,
    traverse(delta) { queued.push(delta); flush() },
  }
}

test('fresh form callbacks and individual accepted baselines drive the decision, without a state-effect delay', () => {
  const controller = createUnsavedWorkController()
  const company = participant(controller, { id: 'crm-company', portal: 'crm', label: 'Company form' })
  const contact = participant(controller, { id: 'crm-contact', portal: 'crm', label: 'Contact form' })
  company.current.dirty = false // Accepted form action rebases its own current ref synchronously.
  let commits = 0
  assert.equal(controller.request({ portal: 'crm', label: 'Change CRM tab' }, () => commits++), false)
  assert.deepEqual(controller.getSnapshot().participants, [{ id: 'crm-contact', portal: 'crm', label: 'Contact form' }])
  assert.equal(controller.resolve(controller.getSnapshot().id, 'discard'), true)
  assert.equal(commits, 1)
  assert.equal(company.current.discards, 0)
  assert.equal(contact.current.discards, 1)
  assert.equal(controller.hasDirty(), false)
})

test('Keep editing preserves every field and focuses its owner after dialog close; retain is explicit and bounded', () => {
  const controller = createUnsavedWorkController()
  const editor = participant(controller)
  let commits = 0
  controller.request({ portal: 'cms', label: 'Change CMS entry' }, () => commits++)
  const first = controller.getSnapshot()
  assert.equal(first.canRetain, false)
  assert.equal(controller.resolve(first.id, 'retain'), false)
  assert.equal(controller.resolve(first.id, 'keep-editing'), true)
  assert.equal(commits, 0)
  assert.equal(editor.current.dirty, true)
  assert.equal(editor.current.discards, 0)
  controller.takeFocus()()
  assert.equal(editor.current.focuses, 1)
  assert.equal(controller.takeFocus(), undefined)
  controller.request({ portal: 'cms', label: 'Open recovery', retain: true }, () => commits++)
  assert.equal(controller.resolve(controller.getSnapshot().id, 'retain'), true)
  assert.equal(commits, 1)
  assert.equal(editor.current.dirty, true)
  assert.equal(editor.current.discards, 0)
})

test('a stale dialog cannot replay a newer intent, and pending requests never replace the original destination', () => {
  const controller = createUnsavedWorkController()
  participant(controller)
  const commits = []
  controller.request({ label: 'First destination' }, () => commits.push('first'))
  const first = controller.getSnapshot().id
  assert.equal(controller.request({ label: 'Second destination' }, () => commits.push('second')), false)
  assert.equal(controller.getSnapshot().label, 'First destination')
  controller.resolve(first, 'keep-editing')
  controller.request({ label: 'Third destination' }, () => commits.push('third'))
  assert.equal(controller.resolve(first, 'discard'), false)
  controller.resolve(controller.getSnapshot().id, 'discard')
  assert.deepEqual(commits, ['third'])
})

test('registration cleanup is token owned; ID filters, failed inspection and refused discard preserve the action boundary', () => {
  const controller = createUnsavedWorkController()
  const old = participant(controller)
  const current = participant(controller)
  old.unregister()
  participant(controller, { id: 'other-form', portal: 'hr' })
  let commits = 0
  controller.request({ ids: ['cms-editor'], label: 'Leave editor' }, () => commits++)
  assert.deepEqual(controller.getSnapshot().participants.map(item => item.id), ['cms-editor'])
  controller.resolve(controller.getSnapshot().id, 'discard')
  assert.equal(current.current.discards, 1)
  assert.equal(old.current.discards, 0)
  const release = controller.register(() => ({ id: 'refused', portal: 'cms', label: 'Unavailable form', isDirty() { throw new Error('fixture') }, discard() { throw new Error('fixture') } }))
  controller.request({ ids: ['refused'], label: 'Leave unavailable form' }, () => commits++)
  assert.equal(controller.resolve(controller.getSnapshot().id, 'discard'), false)
  assert.match(controller.getSnapshot().error, /could not discard/)
  assert.equal(commits, 1)
  release()
})

test('volatile slots survive remounts while old mounted subscribers cannot repopulate a cleared session', () => {
  const controller = createUnsavedWorkController()
  const initial = () => ({ text: 'temporary', revision: 1 })
  const firstBinding = controller.bindSlot('cms-editor', initial)
  const first = firstBinding.read()
  firstBinding.write(previous => ({ ...previous, text: 'still temporary' }))
  const secondBinding = controller.bindSlot('cms-editor', () => { throw new Error('A remount must reuse the slot') })
  assert.deepEqual(first, { text: 'temporary', revision: 1 })
  assert.deepEqual(secondBinding.read(), { text: 'still temporary', revision: 1 })
  assert.equal(controller.hasDirty(), false)
  const snapshots = []
  const unsubscribe = controller.subscribe(() => snapshots.push(firstBinding.read()))
  controller.clearSlots()
  assert.deepEqual(snapshots, [{ text: 'still temporary', revision: 1 }])
  firstBinding.write({ text: 'old subscriber must not write into the next session', revision: 9 })
  unsubscribe()
  const nextBinding = controller.bindSlot('cms-editor', () => ({ text: 'new session', revision: 2 }))
  assert.deepEqual(nextBinding.read(), { text: 'new session', revision: 2 })
  const otherSession = createUnsavedWorkController()
  assert.deepEqual(otherSession.bindSlot('cms-editor', initial).read(), first)
})

test('route scopes distinguish retained portal switching, destructive subpages, harmless suffixes and all hidden forms on exit', () => {
  assert.deepEqual(unsavedRouteTransition('/cms/demo?old=1#title', '/cms/demo?new=1#body'), { label: 'Open this location', ids: [] })
  assert.deepEqual(unsavedRouteTransition('/cms/demo', '/portals'), { portal: 'cms', label: 'Leave this portal view', retain: true })
  assert.deepEqual(unsavedRouteTransition('/hr/demo/employee/time', '/hr/demo/employee/onboarding'), { portal: 'hr', label: 'Leave this portal view', retain: false })
  assert.deepEqual(unsavedRouteTransition('/portals', '/crm/demo'), { label: 'Open this workspace', ids: [] })
  assert.deepEqual(unsavedRouteTransition('/crm/demo', '/about'), { label: 'Leave the portal workspaces' })
  assert.equal(isUnsavedPortalShell('/hr/demo/sdk'), true)
  assert.equal(isUnsavedPortalShell('/hr/demo-other'), false)
  const fixture = browserFixture()
  const cms = participant(fixture.controller)
  const hr = participant(fixture.controller, { id: 'hr-form', portal: 'hr' })
  fixture.driver.navigate('/portals')
  assert.deepEqual(fixture.controller.getSnapshot().participants.map(item => item.id), ['cms-editor'])
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'retain')
  fixture.driver.navigate('/about')
  assert.deepEqual(fixture.controller.getSnapshot().participants.map(item => item.id), ['cms-editor', 'hr-form'])
  assert.equal(fixture.controller.getSnapshot().canRetain, false)
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
  assert.equal(fixture.location(), '/about')
  assert.equal(cms.current.discards, 1)
  assert.equal(hr.current.discards, 1)
})

test('ordinary navigation commits once only after approval and hash replacement preserves existing history data', () => {
  const fixture = browserFixture({ start: '/cms/demo?collection=articles#editor' })
  assert.deepEqual(fixture.entries[0].state.unrelated, { value: 'preserve' })
  const cms = participant(fixture.controller)
  assert.equal(fixture.driver.navigate('/crm/demo'), false)
  assert.equal(fixture.entries.length, 1)
  assert.equal(fixture.location(), '/cms/demo?collection=articles#editor')
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'keep-editing')
  assert.deepEqual(fixture.committed, [])
  fixture.driver.navigate('/crm/demo')
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
  assert.deepEqual(fixture.entries.map(entry => entry.url), ['/cms/demo?collection=articles#editor', '/crm/demo'])
  assert.deepEqual(fixture.committed, ['/crm/demo'])
  assert.equal(cms.current.discards, 1)
  assert.equal(fixture.driver.replaceHash('/crm/demo#pipeline'), true)
  assert.equal(fixture.entries.length, 2)
  assert.equal(fixture.entries[1].state[NAVIGATION_STATE_KEY].index, 1)
  assert.equal(fixture.driver.current().url, '/crm/demo#pipeline')
  assert.equal(fixture.driver.replaceHash('/about#other'), false)
})

test('dirty Back uses the disclosed current-slot fallback for native and History-only browsers; clean Forward remains native', () => {
  for (const native of [false, true]) {
    const fixture = browserFixture({ native })
    fixture.driver.navigate('/crm/demo')
    fixture.driver.navigate('/hr/demo/employee/time?view=own#entries')
    const hr = participant(fixture.controller, { portal: 'hr' })
    fixture.traverse(-1)
    assert.equal(fixture.location(), '/hr/demo/employee/time?view=own#entries')
    assert.equal(fixture.driver.current().url, fixture.location())
    assert.equal(fixture.requests.at(-1).historyFallback, true)
    fixture.controller.resolve(fixture.controller.getSnapshot().id, 'keep-editing')
    assert.equal(hr.current.dirty, true)
    assert.deepEqual(fixture.moves, [])
    assert.equal(fixture.entries.length, 3)
    assert.equal(fixture.entries[0].url, '/cms/demo')
    assert.equal(fixture.entries[2].url, '/hr/demo/employee/time?view=own#entries')
    // The same slot can be left for its original requested destination.
    fixture.driver.navigate('/crm/demo')
    fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
    fixture.traverse(-1)
    assert.equal(fixture.location(), '/hr/demo/employee/time?view=own#entries')
    fixture.traverse(1)
    assert.equal(fixture.location(), '/crm/demo')
    assert.equal(fixture.driver.current().url, '/crm/demo')
    assert.deepEqual(fixture.moves, [])
  }
})


test('an early accepted dirty Back opens its original destination in the current slot with no repair or replay queued', () => {
  const fixture = browserFixture({ native: true })
  fixture.driver.navigate('/crm/demo')
  participant(fixture.controller, { portal: 'crm' })
  fixture.traverse(-1)
  const pending = fixture.controller.getSnapshot()
  assert.ok(pending)
  fixture.controller.resolve(pending.id, 'retain')
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo')
  assert.equal(fixture.driver.current().url, '/cms/demo')
  assert.deepEqual(fixture.moves, [])
  assert.deepEqual(fixture.entries.map(entry => entry.url), ['/cms/demo', '/crm/demo'])
})


test('repeated physical Back while a decision is open keeps the first requested URL without any competing driver movement', () => {
  const fixture = browserFixture({ native: true })
  fixture.driver.navigate('/crm/demo')
  fixture.driver.navigate('/hr/demo/employee/time')
  participant(fixture.controller, { portal: 'hr' })
  fixture.traverse(-1)
  const first = fixture.controller.getSnapshot().id
  fixture.traverse(-1)
  assert.equal(fixture.controller.getSnapshot().id, first)
  assert.equal(fixture.location(), '/hr/demo/employee/time')
  fixture.controller.resolve(first, 'retain')
  fixture.flush()
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.driver.current().url, '/crm/demo')
  assert.equal(fixture.entries.length, 3)
  assert.deepEqual(fixture.moves, [])
})


test('native history positions cover unmarked same-document traversal while retaining its original state', () => {
  const fixture = browserFixture({ native: true })
  fixture.driver.navigate('/crm/demo')
  fixture.entries[0].state = { thirdParty: 'kept' }
  participant(fixture.controller, { portal: 'crm' })
  fixture.traverse(-1)
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.entries[0].state.thirdParty, 'kept')
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo')
  assert.equal(fixture.entries.length, 2)
})


test('legacy multi-step Back opens the exact requested URL through the explicit one-slot fallback', () => {
  const fixture = browserFixture({ history: [
    { url: '/old-unmarked', state: null },
    { url: '/intermediate', state: null },
    { url: '/crm/demo', state: null },
  ] })
  participant(fixture.controller, { portal: 'crm' })
  fixture.traverse(-2)
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.driver.current().url, '/crm/demo')
  assert.equal(fixture.requests[0].to, '/old-unmarked')
  assert.equal(fixture.requests[0].historyFallback, true)
  assert.deepEqual(fixture.moves, [])
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
  fixture.flush()
  assert.equal(fixture.location(), '/old-unmarked')
  assert.equal(fixture.driver.current().url, '/old-unmarked')
  assert.deepEqual(fixture.committed, ['/old-unmarked'])
  assert.deepEqual(fixture.entries.map(entry => entry.url), ['/old-unmarked', '/intermediate', '/crm/demo'])
  fixture.traverse(2)
  assert.equal(fixture.location(), '/crm/demo')
  fixture.traverse(-1)
  assert.equal(fixture.location(), '/intermediate')
})

test('legacy slot fallback accepts the original destination without scheduling repair or replay', () => {
  const fixture = browserFixture({ history: [
    { url: '/cms/demo', state: { foreign: 'original' } },
    { url: '/portals', state: null },
    { url: '/crm/demo', state: null },
  ] })
  participant(fixture.controller, { portal: 'crm' })
  fixture.host.go(-2)
  fixture.step()
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'retain')
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo')
  assert.equal(fixture.entries[0].state.foreign, 'original')
  assert.deepEqual(fixture.committed, ['/cms/demo'])
})

test('a native position overrides copied markers while Keep and Discard use the same explicit no-go slot fallback', () => {
  for (const decision of ['keep-editing', 'discard']) {
    const fixture = browserFixture({ native: true })
    fixture.driver.navigate('/crm/demo')
    fixture.entries[0].state = structuredClone(fixture.entries[1].state)
    participant(fixture.controller, { portal: 'crm' })
    fixture.traverse(-1)
    assert.equal(fixture.location(), '/crm/demo')
    assert.equal(fixture.driver.current().url, '/crm/demo')
    assert.equal(fixture.entries[0].state[NAVIGATION_STATE_KEY].index, 0)
    fixture.controller.resolve(fixture.controller.getSnapshot().id, decision)
    fixture.flush()
    const expected = decision === 'discard' ? '/cms/demo' : '/crm/demo'
    assert.equal(fixture.location(), expected)
    assert.equal(fixture.driver.current().url, expected)
    assert.equal(fixture.entries.length, 2)
    assert.equal(fixture.entries[1].url, '/crm/demo')
    assert.deepEqual(fixture.moves, [])
  }
})


test('Keep editing activates the exact validated hidden owner without a second guard or discarding any portal', () => {
  const fixture = browserFixture({ start: '/crm/demo' })
  const cms = participant(fixture.controller)
  const crm = participant(fixture.controller, { id: 'crm-form', portal: 'crm' })
  const hr = participant(fixture.controller, { id: 'hr-form', portal: 'hr' })
  const focused = []
  fixture.controller.setOwnerActivation((location, focus) => fixture.driver.activateRetainedOwner(location, focus))
  fixture.controller.rememberOwnerLocation('cms', '/cms/demo?collection=articles#editor')
  fixture.controller.rememberOwnerLocation('cms', '/cms/demo', true)
  fixture.controller.register(() => ({ ...cms.read(), focus: () => fixture.controller.focusOwner('cms', () => focused.push(fixture.location())) }))
  fixture.controller.rememberOwnerLocation('hr', '/hr/demo/employee/time?view=own#timer')
  fixture.controller.rememberOwnerLocation('hr', '/hr/demo/employee/time', true)
  fixture.controller.rememberOwnerLocation('hr', '/hr/demo/unsupported-child')
  fixture.controller.register(() => ({ ...hr.read(), focus: () => fixture.controller.focusOwner('hr', () => focused.push(fixture.location())) }))
  fixture.driver.navigate('/about')
  const requests = fixture.requests.length
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'keep-editing')
  fixture.controller.takeFocus()()
  assert.equal(fixture.location(), '/cms/demo?collection=articles#editor')
  assert.deepEqual(focused, ['/cms/demo?collection=articles#editor'])
  fixture.controller.request({ ids: ['hr-form'], label: 'Leave hidden timer' }, () => assert.fail('Keep must not commit'))
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'keep-editing')
  fixture.controller.takeFocus()()
  assert.equal(fixture.location(), '/hr/demo/employee/time?view=own#timer')
  assert.deepEqual(focused, ['/cms/demo?collection=articles#editor', '/hr/demo/employee/time?view=own#timer'])
  assert.equal(fixture.requests.length, requests)
  assert.deepEqual([cms.current.discards, crm.current.discards, hr.current.discards], [0, 0, 0])
  assert.deepEqual([cms.current.dirty, crm.current.dirty, hr.current.dirty], [true, true, true])
  assert.equal(fixture.driver.activateRetainedOwner('/about', () => assert.fail('Outside-shell activation')), false)
  assert.equal(fixture.driver.activateRetainedOwner('/hr/demo/employee/onboarding', () => assert.fail('Destructive same-portal subpage activation')), false)
})

test('owner activation after Keep runs without queued traversal and retains another mounted portal', () => {
  const fixture = browserFixture({ start: '/cms/demo', native: true })
  fixture.driver.navigate('/crm/demo')
  const crm = participant(fixture.controller, { portal: 'crm' })
  fixture.traverse(-1)
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'keep-editing')
  const focused = []
  assert.equal(fixture.driver.activateRetainedOwner('/cms/demo#editor', () => focused.push(fixture.location())), true)
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo#editor')
  assert.deepEqual(focused, ['/cms/demo#editor'])
  assert.equal(crm.current.discards, 0)
  assert.equal(crm.current.dirty, true)
  assert.deepEqual(fixture.moves, [])
})


test('browser adapter indexes foreign history writes, preserves state and restores the original methods on cleanup', () => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document
  const entries = [{ url: '/cms/demo', state: { foreign: 'initial' } }]
  let position = 0
  const events = new Map()
  const location = () => new URL(entries[position].url, 'https://fixture.invalid')
  const history = {
    get state() { return entries[position].state },
    pushState(state, _unused, url) { entries.splice(position + 1, Infinity, { state: structuredClone(state), url }); position++ },
    replaceState(state, _unused, url) { entries[position] = { state: structuredClone(state), url } },
    go(delta) { position += delta; for (const listener of events.get('popstate') ?? []) listener() },
  }
  const originalPush = history.pushState, originalReplace = history.replaceState
  const requests = []
  globalThis.window = {
    history,
    get location() { return location() },
    addEventListener(name, listener) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(listener) },
    removeEventListener(name, listener) { events.get(name)?.delete(listener) },
    dispatchEvent(event) { for (const listener of events.get(event.type) ?? []) listener() },
    matchMedia: () => ({ matches: false }), scrollTo() {},
  }
  globalThis.document = { getElementById: () => null, documentElement: { dataset: {} } }
  let uninstall
  try {
    uninstall = installNavigationGuard((request, commit) => { requests.push(request); commit(); return true })
    const firstState = structuredClone(history.state)
    history.pushState({ ...firstState, foreign: 'copied' }, '', '/crm/demo')
    history.pushState(null, '', '/hr/demo/employee/time')
    assert.deepEqual(entries.map(entry => entry.state[NAVIGATION_STATE_KEY].index), [0, 1, 2])
    assert.equal(new Set(entries.map(entry => entry.state[NAVIGATION_STATE_KEY].entry)).size, 3)
    assert.equal(entries[1].state.foreign, 'copied')
    history.replaceState({ foreign: 'replacement' }, '', '/hr/demo/employee/time?view=own')
    assert.equal(history.state.foreign, 'replacement')
    assert.equal(history.state[NAVIGATION_STATE_KEY].index, 2)
    history.go(-2)
    assert.equal(location().pathname, '/cms/demo')
    assert.equal(requests.at(-1).to, '/cms/demo')
    assert.equal(entries.length, 3)
    assert.throws(() => history.pushState({}, '', 'https://elsewhere.invalid'), { name: 'SecurityError' })
    uninstall()
    assert.equal(history.pushState, originalPush)
    assert.equal(history.replaceState, originalReplace)
  } finally {
    uninstall?.()
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument
  }
})


test('successful navigation closes the dialog before destination focus; Keep and refused discard leave commit phase untouched', () => {
  const controller = createUnsavedWorkController()
  const editor = participant(controller)
  let focused = 'dialog choice'
  let closures = 0
  const close = () => { closures++; focused = 'restored opener' }
  const commit = () => { focused = 'destination heading' }
  controller.request({ label: 'Open explanation', retain: true }, commit)
  controller.resolve(controller.getSnapshot().id, 'retain', close)
  assert.equal(focused, 'destination heading')
  assert.equal(closures, 1)
  assert.equal(editor.current.dirty, true)
  controller.request({ label: 'Leave editor' }, commit)
  controller.resolve(controller.getSnapshot().id, 'keep-editing', close)
  assert.equal(closures, 1)
  controller.register(() => ({ id: 'refused', portal: 'cms', label: 'Refused draft', isDirty: () => true, discard() { throw new Error('fixture') } }))
  controller.request({ ids: ['refused'], label: 'Leave refused draft' }, commit)
  assert.equal(controller.resolve(controller.getSnapshot().id, 'discard', close), false)
  assert.equal(closures, 1)
  assert.ok(controller.getSnapshot())
})


test('unmarked Forward uses one explicitly identified legacy slot for Keep or exact requested Discard, without any go or timeout', () => {
  const history = [
    { url: '/cms/demo', state: null },
    { url: '/crm/demo', state: null },
    { url: '/hr/demo/employee/time', state: null },
  ]
  const keep = browserFixture({ history, initialPosition: 1 })
  const crm = participant(keep.controller, { portal: 'crm' })
  keep.traverse(1)
  assert.equal(keep.location(), '/crm/demo')
  assert.equal(keep.driver.current().url, '/crm/demo')
  assert.equal(keep.requests[0].historyFallback, true)
  assert.deepEqual(keep.moves, [])
  keep.controller.resolve(keep.controller.getSnapshot().id, 'keep-editing')
  assert.equal(crm.current.dirty, true)
  assert.deepEqual(keep.entries.map(entry => entry.url), ['/cms/demo', '/crm/demo', '/crm/demo'])
  const discard = browserFixture({ history, initialPosition: 1 })
  const accepted = participant(discard.controller, { portal: 'crm' })
  discard.traverse(1)
  discard.controller.resolve(discard.controller.getSnapshot().id, 'discard')
  discard.flush()
  assert.equal(discard.location(), '/hr/demo/employee/time')
  assert.equal(discard.driver.current().url, '/hr/demo/employee/time')
  assert.equal(accepted.current.discards, 1)
  assert.deepEqual(discard.moves, [])
  assert.deepEqual(discard.committed, ['/hr/demo/employee/time'])
  assert.deepEqual(discard.entries.map(entry => entry.url), history.map(entry => entry.url))
})

test('a new native fragment entry delivered as popstate then hashchange remains harmless and does not freeze navigation', () => {
  const fixture = browserFixture()
  participant(fixture.controller)
  fixture.host.push(null, '/cms/demo#editor')
  fixture.driver.onPopState()
  fixture.driver.onHashChange()
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo#editor')
  assert.equal(fixture.driver.current().url, '/cms/demo#editor')
  assert.equal(fixture.controller.getSnapshot(), null)
  assert.equal(fixture.driver.navigate('/crm/demo'), false)
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'retain')
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.driver.current().url, '/crm/demo')
  assert.deepEqual(fixture.entries.map(entry => entry.url), ['/cms/demo', '/cms/demo#editor', '/crm/demo'])
})


test('early Discard has no asynchronous traversal that can overwrite its accepted URL', () => {
  const fixture = browserFixture({ native: true })
  fixture.driver.navigate('/crm/demo')
  participant(fixture.controller, { portal: 'crm' })
  fixture.traverse(-1)
  fixture.controller.resolve(fixture.controller.getSnapshot().id, 'discard')
  fixture.flush()
  assert.equal(fixture.location(), '/cms/demo')
  assert.equal(fixture.driver.current().url, '/cms/demo')
  assert.deepEqual(fixture.committed, ['/crm/demo', '/cms/demo'])
  assert.deepEqual(fixture.moves, [])
})


test('a second native physical Forward before early Discard cannot create competing repair/replay operations', () => {
  const fixture = browserFixture({ history: [
    { url: '/cms/demo', state: null },
    { url: '/crm/demo', state: null },
    { url: '/hr/demo/employee/time', state: null },
    { url: '/docs', state: null },
  ], initialPosition: 2, native: true })
  const hr = participant(fixture.controller, { portal: 'hr' })
  fixture.traverse(-1)
  const first = fixture.controller.getSnapshot().id
  fixture.traverse(1)
  assert.equal(fixture.controller.getSnapshot().id, first)
  assert.deepEqual(fixture.moves, [])
  fixture.controller.resolve(first, 'discard')
  fixture.flush()
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.driver.current().url, '/crm/demo')
  assert.equal(hr.current.discards, 1)
  assert.equal(fixture.entries.length, 4)
  assert.equal(fixture.entries[3].url, '/docs')
  assert.deepEqual(fixture.committed, ['/crm/demo'])
  assert.deepEqual(fixture.moves, [])
})


test('History-only owned markers use the disclosed fallback and cannot leave a repair go outstanding across raw traversal', () => {
  const fixture = browserFixture({ history: [
    { url: '/raw-a', state: null },
    { url: '/raw-b', state: null },
    { url: '/cms/demo', state: null },
  ] })
  fixture.driver.navigate('/crm/demo')
  fixture.driver.navigate('/hr/demo/employee/time')
  const hr = participant(fixture.controller, { portal: 'hr' })
  fixture.traverse(-1) // Physically at the owned CRM slot, showing HR until decided.
  const first = fixture.controller.getSnapshot().id
  assert.equal(fixture.requests.at(-1).historyFallback, true)
  assert.deepEqual(fixture.moves, [])
  fixture.traverse(-3) // Another raw native traversal reaches raw-a.
  assert.equal(fixture.location(), '/hr/demo/employee/time')
  assert.equal(fixture.driver.current().url, '/hr/demo/employee/time')
  assert.equal(fixture.controller.getSnapshot().id, first)
  assert.deepEqual(fixture.moves, [])
  fixture.controller.resolve(first, 'discard')
  fixture.flush()
  assert.equal(fixture.location(), '/crm/demo')
  assert.equal(fixture.driver.current().url, '/crm/demo')
  assert.equal(hr.current.discards, 1)
  assert.deepEqual(fixture.committed, ['/crm/demo', '/hr/demo/employee/time', '/crm/demo'])
  assert.deepEqual(fixture.moves, [])
  assert.equal(fixture.entries.length, 5)
  assert.equal(fixture.entries[1].url, '/raw-b')
  assert.equal(fixture.entries[2].url, '/cms/demo')
})


test('a physical-history notice updates an existing local decision without replacing its first intent', () => {
  const controller = createUnsavedWorkController()
  participant(controller)
  const commits = []
  controller.request({ label: 'Change selected entry', ids: ['cms-editor'] }, () => commits.push('original local action'))
  const first = controller.getSnapshot().id
  const historyNotice = 'This page is kept at the current browser history position.'
  controller.request({ label: 'Physical Back', historyNotice, retain: true }, () => commits.push('later navigation'))
  assert.equal(controller.getSnapshot().id, first)
  assert.equal(controller.getSnapshot().label, 'Change selected entry')
  assert.equal(controller.getSnapshot().canRetain, false)
  assert.equal(controller.getSnapshot().historyNotice, historyNotice)
  controller.resolve(first, 'discard')
  assert.deepEqual(commits, ['original local action'])
})
