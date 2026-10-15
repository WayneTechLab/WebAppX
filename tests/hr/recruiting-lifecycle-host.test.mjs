import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = await readFile(new URL('../../src/hr/components/HrRecruitingLifecycleHost.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText
const model = name => loadMockModel(new URL(`../../src/hr/${name}.ts`, import.meta.url))
const persistence = await model('persistence'), controllers = await model('recruiting-controller'), services = await model('recruiting-services')
const lifecycle = await model('lifecycle'), recruiting = await model('recruiting'), values = await model('recruiting-lifecycle-value'), core = await model('recruiting-lifecycle')
const fixture = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }, ownerActor = { mode: 'native', actor: owner }
const at = hour => `2026-10-15T${String(hour).padStart(2, '0')}:00:00.000Z`
const adopt = { kind: 'adopt', recordedAt: at(0) }
function seed() { return persistence.createHrDemoState(fixture) }
function adopted({ assigned = false, knownStage = false } = {}) {
  let state = seed()
  state.recruiting = recruiting.transitionRecruiting(state.recruiting, owner, { type: 'set-job-status', jobId: 'job-001', status: 'published' }, fixture)
  state = core.buildRecruitingCandidate(state, ownerActor, adopt, fixture, services.recruitingCoreServices).next
  if (knownStage) state = core.buildRecruitingCandidate(state, ownerActor, { kind: 'move-application', applicationId: 'rapplication-0001', expectedStage: 'applied', nextStage: 'screening', recordedAt: at(9) }, fixture, services.recruitingCoreServices).next
  if (assigned) state = core.buildRecruitingCandidate(state, ownerActor, { kind: 'schedule-interview', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001', 'employee-002'], startAt: '2035-01-01T12:00:00.000Z', timeZone: 'UTC', durationMinutes: 60, recordedAt: at(10) }, fixture, services.recruitingCoreServices).next
  return state
}
function nodes(root, predicate) { if (Array.isArray(root)) return root.flatMap(item => nodes(item, predicate)); if (!root || typeof root !== 'object') return []; return [...(predicate(root) ? [root] : []), ...nodes(root.children, predicate)] }
function text(root) { if (Array.isArray(root)) return root.map(text).join(''); return root && typeof root === 'object' ? text(root.children) : root == null || typeof root === 'boolean' ? '' : String(root) }

/** The actual host and actual controller/services run here. Only React effect
 * scheduling, the provider guard result and root persistence are fixtures.
 * Private adapter probes test the root callback protocol, not domain acceptance. */
function harness(options = {}) {
  const slots = [], effectSlots = [], adapters = [], stats = { clears: 0, disposals: 0, updates: 0, enters: [], leaves: 0 }
  let cursor = 0, tree, rerender = false, latest = options.state ?? seed(), accepted = true, invoke = true, updateCalls = 1, enterAllowed = true, leaveAllowed = true
  let provider = { interviewerEmployeeId: options.employeeId ?? null, generation: 0 }
  function scheduleEffect(effect, dependencies) {
    const index = cursor++, previous = slots[index]
    const changed = !previous || !dependencies || !previous.dependencies || dependencies.some((value, position) => !Object.is(value, previous.dependencies[position]))
    if (!previous) effectSlots.push(index)
    slots[index] = { ...previous, effect, dependencies, pending: changed }
  }
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children } }, Fragment: 'fragment',
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; rerender = true }] },
    useSyncExternalStore(subscribe, getSnapshot) { const index = cursor++; if (!(index in slots)) slots[index] = { unsubscribe: subscribe(() => { rerender = true }) }; return getSnapshot() },
    useEffect: scheduleEffect, useLayoutEffect: scheduleEffect,
  }
  const providerPort = () => ({ ...provider, enter(id) { stats.enters.push(id); if (!enterAllowed) return false; if (provider.interviewerEmployeeId !== id) provider = { interviewerEmployeeId: id, generation: provider.generation + 1 }; return true }, leave() { stats.leaves++; if (!leaveAllowed) return false; if (provider.interviewerEmployeeId !== null) provider = { interviewerEmployeeId: null, generation: provider.generation + 1 }; return true } })
  const exports = {}
  new Function('require', 'exports', 'React', compiled)(dependency => {
    if (dependency === 'react') return React
    if (dependency === '../RecruitingPreviewProvider') return { useRecruitingPreview: providerPort }
    if (dependency === '../recruiting-controller') return { ...controllers, createRecruitingController(adapter) { adapters.push(adapter); const real = controllers.createRecruitingController(adapter); return { ...real, clear() { stats.clears++; real.clear() }, dispose() { stats.disposals++; real.dispose() } } } }
    if (dependency === '../recruiting-services') return services
    if (dependency === '../recruiting-lifecycle-value') return values
    if (dependency === '../lifecycle') return lifecycle
    if (dependency === '../recruiting') return recruiting
    if (dependency.startsWith('./HrRecruiting')) { const name = dependency.slice(2); return { [name]: name } }
    throw new Error(`Unexpected host dependency ${dependency}`)
  }, exports, React)
  let props = {
    state: latest, actor: options.actor ?? owner, rawFixture: fixture, replacementEpoch: 0,
    storageStatus: options.storageStatus ?? { kind: 'ready', message: 'PRIVATE ordinary storage details' },
    onUpdate(build) {
      stats.updates++
      if (!invoke) return accepted
      try { let candidate; for (let index = 0; index < updateCalls; index++) candidate = build(latest); if (accepted) latest = candidate; return accepted } catch { return false }
    },
  }
  function render(next) {
    if (next) props = { ...props, ...next }
    let passes = 0
    do {
      assert.ok(++passes < 12, 'host must settle its layout/store synchronization')
      rerender = false; cursor = 0; tree = exports.HrRecruitingLifecycleHost(props)
      for (const index of effectSlots) if (slots[index].pending) { slots[index].pending = false; slots[index].cleanup?.(); slots[index].cleanup = slots[index].effect() }
    } while (rerender)
    return tree
  }
  function unique(type) { const found = nodes(tree, node => node.type === type); assert.equal(found.length, 1, type); return found[0] }
  return {
    stats, adapters, render, unique, nodes: predicate => nodes(tree, predicate), text: () => text(tree),
    get latest() { return latest }, get props() { return props }, get tree() { return tree },
    controlUpdate(value) { ({ accepted = true, invoke = true, updateCalls = 1 } = value) },
    replaceLatest(value) { latest = value },
    setProvider(value) { provider = { ...provider, ...value } },
    guard({ enter = true, leave = true }) { enterAllowed = enter; leaveAllowed = leave },
    select(id) { unique('select').props.onChange({ target: { value: id } }); render() },
    enter() { unique('form').props.onSubmit({ preventDefault() {} }); render() },
    leave() { const button = nodes(tree, node => node.type === 'button' && text(node) === 'Leave interviewer preview'); assert.equal(button.length, 1); button[0].props.onClick(); render() },
    replayEffects() { for (const index of effectSlots) { slots[index].cleanup?.(); slots[index].cleanup = slots[index].effect() }; render() },
    cleanup() { for (const index of effectSlots) slots[index].cleanup?.(); for (const slot of slots) slot?.unsubscribe?.() },
  }
}
function withHost(options, check) { const ui = harness(options); try { ui.render(); check(ui) } finally { ui.cleanup() } }
function management(ui) { return ui.unique('HrRecruitingApplications').props }

test('default reads project legacy records without adopting, saving or exposing a raw source to children', () => withHost({}, ui => {
  const before = JSON.stringify(ui.latest), applications = management(ui)
  assert.equal(applications.adopted, false); assert.equal(ui.stats.updates, 0); assert.equal(JSON.stringify(ui.latest), before)
  assert.deepEqual(Object.keys(applications).sort(), ['adopted', 'onView', 'port', 'view'])
  assert.equal(ui.nodes(node => ['HrRecruitingRequisitions', 'HrRecruitingInterviews', 'HrRecruitingOwnScorecards'].includes(node.type)).length, 0)
  assert.equal(Object.hasOwn(applications.view, 'workflow'), false); assert.equal(Object.hasOwn(applications.port, 'readCurrent'), false)
}))

test('the actual HrWorkspace actor shape compacts optional undefined fields without changing its role', () => withHost({ actor: { role: 'employer-owner', employeeId: undefined, contractorId: undefined } }, ui => {
  assert.equal(management(ui).view.mode, 'management')
  assert.deepEqual(ui.adapters[0].readActor(), ownerActor)
}))

test('the root callback commits against its actual latest state and accepted memory survives an older prop rerender', () => withHost({}, ui => {
  const adapter = ui.adapters[0], latest = { ...ui.latest, selectedEmployee: 'employee-003' }
  ui.replaceLatest(latest)
  let received
  assert.equal(adapter.replaceCurrent(value => { received = value; return { ...value, selectedEmployee: 'employee-002' } }), true)
  assert.equal(received, latest); assert.equal(adapter.readCurrent(), ui.latest)
  const accepted = ui.latest; ui.render()
  assert.equal(adapter.readCurrent(), accepted, 'local render must not restore an older unchanged state prop')
}))

for (const [name, behavior] of [['callback not run', { accepted: true, invoke: false }], ['root refusal after build', { accepted: false, invoke: true }], ['builder invoked twice', { accepted: true, invoke: true, updateCalls: 2 }]]) test(`private update protocol rejects ${name} without refreshing its accepted-memory ref`, () => withHost({}, ui => {
  const adapter = ui.adapters[0], before = adapter.readCurrent(); let builds = 0
  ui.controlUpdate(behavior)
  assert.equal(adapter.replaceCurrent(value => { builds++; return { ...value, selectedEmployee: 'employee-003' } }), false)
  assert.equal(adapter.readCurrent(), before); assert.equal(ui.latest, before)
  assert.equal(builds, behavior.invoke === false ? 0 : 1)
}))

test('an actual controller refuses a changed root latest source without overwriting it', () => withHost({}, ui => {
  const port = management(ui).port, reviewed = port.preview(adopt); assert.equal(reviewed.ok, true)
  const later = { ...ui.latest, selectedEmployee: 'employee-003' }; ui.replaceLatest(later)
  assert.equal(port.confirm({ kind: 'adopt', handle: reviewed.handle }).ok, false)
  assert.equal(ui.latest, later); assert.equal(Object.hasOwn(ui.latest.recruiting, 'lifecycle'), false)
}))

test('actual adoption renders all three management modules with DTO-only props and minimal eligibility choices', () => withHost({}, ui => {
  const port = management(ui).port, reviewed = port.preview(adopt); assert.equal(reviewed.ok, true)
  assert.equal(port.confirm({ kind: 'adopt', handle: reviewed.handle }).ok, true); ui.render()
  assert.equal(management(ui).adopted, true)
  const requisitions = ui.unique('HrRecruitingRequisitions').props, interviews = ui.unique('HrRecruitingInterviews').props
  assert.deepEqual(Object.keys(requisitions.view).sort(), ['jobs', 'requisitions'])
  assert.deepEqual(requisitions.managerChoices, [{ id: 'employee-001', label: 'Morgan Example' }])
  assert.ok(requisitions.ownerChoices.every(choice => Object.keys(choice).sort().join() === 'id,label'))
  assert.ok(interviews.participantChoices.every(choice => Object.keys(choice).sort().join() === 'displayName,employeeId'))
  for (const props of [management(ui), requisitions, interviews]) for (const key of ['state', 'actor', 'rawFixture', 'onUpdate', 'replacementEpoch', 'storageStatus']) assert.equal(Object.hasOwn(props, key), false, key)
}))

test('secure preview randomness is exactly 256 bits with no fallback and monotonic time is ephemeral', () => withHost({}, ui => {
  const adapter = ui.adapters[0], descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'), real = globalThis.crypto, requests = []
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues(array) { requests.push(array.length); return real.getRandomValues(array) } } })
    const preview = management(ui).port.preview(adopt); assert.equal(preview.ok, true); assert.match(preview.handle, /^[0-9a-f]{64}$/)
    assert.deepEqual(requests, [32]); assert.throws(() => adapter.randomBytes(16)); assert.deepEqual(requests, [32])
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
    assert.equal(management(ui).port.preview(adopt).ok, false); assert.equal(ui.stats.updates, 0)
    const first = adapter.monotonicNow(); assert.ok(adapter.monotonicNow() >= first)
  } finally { if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); else delete globalThis.crypto }
}))

test('actor, mode and replacement-epoch changes invalidate retained handles', () => withHost({}, ui => {
  const port = management(ui).port, first = port.preview(adopt); assert.equal(first.ok, true)
  ui.render({ actor: { role: 'hr-admin' } }); assert.equal(port.confirm({ kind: 'adopt', handle: first.handle }).ok, false)
  const second = port.preview(adopt); assert.equal(second.ok, true)
  ui.render({ replacementEpoch: 1 }); assert.equal(port.confirm({ kind: 'adopt', handle: second.handle }).ok, false)
  const third = port.preview(adopt); assert.equal(third.ok, true)
  ui.setProvider({ generation: 2 }); ui.render(); assert.equal(port.confirm({ kind: 'adopt', handle: third.handle }).ok, false)
  assert.equal(ui.stats.updates, 0)
}))

test('StrictMode effect replay replaces a disposed controller and old opaque handles stay invalid', () => withHost({}, ui => {
  const port = management(ui).port, preview = port.preview(adopt); assert.equal(preview.ok, true)
  ui.replayEffects()
  assert.equal(ui.adapters.length, 2); assert.equal(ui.stats.disposals, 1)
  assert.equal(management(ui).view.mode, 'management')
  assert.equal(port.confirm({ kind: 'adopt', handle: preview.handle }).ok, false)
  assert.equal(port.preview(adopt).ok, true)
}))

test('unmount disposes the actual controller so retained child ports cannot write', () => {
  const ui = harness(); ui.render(); const port = management(ui).port, preview = port.preview(adopt); assert.equal(preview.ok, true)
  ui.cleanup()
  assert.equal(port.confirm({ kind: 'adopt', handle: preview.handle }).ok, false); assert.equal(port.preview(adopt).ok, false); assert.equal(ui.stats.updates, 0)
})

test('explicit observation cache is source-bound, clears after saved changes and preserves module identity', () => withHost({ state: adopted({ knownStage: true }) }, ui => {
  const first = management(ui), result = first.port.view({ observedAt: at(11) }); assert.equal(result.mode, 'management')
  first.onView(result); ui.render()
  assert.equal(management(ui).view.applications[0].intervals.at(-1).durationMs, 7200000)
  const port = management(ui).port, childKey = ui.unique('HrRecruitingApplications').props.key
  const later = { ...ui.latest, selectedEmployee: 'employee-003' }; ui.replaceLatest(later); ui.render({ state: later })
  assert.equal(management(ui).view.applications[0].intervals.at(-1).durationMs, null)
  assert.equal(management(ui).port, port); assert.equal(ui.unique('HrRecruitingApplications').props.key, childKey)
  assert.match(ui.text(), /Reapply the explicit duration observation/)
  first.onView(result); ui.render()
  assert.equal(management(ui).view.applications[0].intervals.at(-1).durationMs, null, 'a retained stale onView callback cannot restore prior metrics')
}))

test('a refused observation view keeps the existing source-bound DTO and mounted management forms', () => withHost({ state: adopted({ knownStage: true }) }, ui => {
  const props = management(ui), valid = props.port.view({ observedAt: at(11) }); assert.equal(valid.mode, 'management'); props.onView(valid); ui.render()
  const current = management(ui).view, refusal = props.port.view({ observedAt: at(8) }); assert.equal(refusal.ok, false)
  ui.render(); assert.equal(management(ui).view, current); assert.equal(management(ui).view.applications[0].intervals.at(-1).durationMs, 7200000)
}))

test('only known assigned employees are offered, and entry requires explicit select plus the provider guard', () => withHost({ state: adopted({ assigned: true }) }, ui => {
  assert.deepEqual(ui.nodes(node => node.type === 'option').map(node => node.props.value), ['', 'employee-001', 'employee-002'])
  ui.select('employee-003'); ui.enter(); assert.deepEqual(ui.stats.enters, []); assert.match(ui.text(), /Choose an assigned fictional interviewer/)
  ui.select('employee-001'); assert.deepEqual(ui.stats.enters, [])
  ui.guard({ enter: false }); ui.enter(); assert.deepEqual(ui.stats.enters, ['employee-001']); assert.ok(management(ui))
  ui.guard({ enter: true }); ui.enter(); assert.equal(ui.unique('HrRecruitingOwnScorecards').props.view.employeeId, 'employee-001')
}))

test('own mode receives only its DTO and four-method port with generic storage status', () => withHost({ state: adopted({ assigned: true }), employeeId: 'employee-001', storageStatus: { kind: 'unavailable', message: 'PRIVATE global HR feedback / payroll / source bytes' } }, ui => {
  const own = ui.unique('HrRecruitingOwnScorecards').props
  assert.deepEqual(Object.keys(own).sort(), ['port', 'view']); assert.deepEqual(Object.keys(own.port).sort(), ['cancel', 'confirm', 'preview', 'view'])
  assert.equal(own.view.employeeId, 'employee-001'); assert.equal(own.view.assignedInterviews.length, 1)
  assert.equal(ui.nodes(node => node.type === 'select').length, 0)
  assert.equal(ui.nodes(node => ['HrRecruitingApplications', 'HrRecruitingRequisitions', 'HrRecruitingInterviews'].includes(node.type)).length, 0)
  assert.match(ui.text(), /only in memory/); assert.doesNotMatch(ui.text(), /PRIVATE|payroll|backup|Synthetic manager/)
  const preview = own.port.preview(adopt); assert.equal(preview.ok, false); assert.equal(preview.code, 'unavailable')
  assert.equal(ui.stats.updates, 0)
}))

test('every own-mode outcome renders a named region without adding a nested main landmark', () => {
  for (const employeeId of ['employee-001', 'employee-003', 'unknown-employee']) withHost({ state: adopted({ assigned: true }), employeeId }, ui => {
    assert.equal(ui.tree.type, 'section')
    assert.equal(ui.tree.props['aria-label'], 'Isolated interviewer preview')
    assert.equal(ui.nodes(node => node.type === 'section' && node.props['aria-label'] === 'Isolated interviewer preview').length, 1)
    assert.equal(ui.nodes(node => node.type === 'main' || node.props.role === 'main').length, 0, 'the shell owns the sole main and content skip target')
    assert.match(ui.text(), /Fictional interviewer preview/)
    assert.match(ui.text(), /Leave interviewer preview/)
  })
})

for (const id of ['employee-003', 'unknown-employee']) test(`unassigned or unknown own selection ${id} yields the same safe shell`, () => withHost({ state: adopted({ assigned: true }), employeeId: id }, ui => {
  assert.equal(ui.nodes(node => node.type === 'HrRecruitingOwnScorecards').length, 0); assert.equal(ui.nodes(node => node.type === 'select').length, 0)
  assert.match(ui.text(), /This recruiting preview is unavailable/); assert.doesNotMatch(ui.text(), new RegExp(id))
}))

test('guarded Leave preserves own mode on Keep and disposes its scope only after accepted leave', () => withHost({ state: adopted({ assigned: true }), employeeId: 'employee-001' }, ui => {
  const own = ui.unique('HrRecruitingOwnScorecards').props
  ui.guard({ leave: false }); ui.leave(); assert.equal(ui.unique('HrRecruitingOwnScorecards').props.view.employeeId, 'employee-001')
  ui.guard({ leave: true }); ui.leave(); assert.equal(management(ui).view.mode, 'management')
  assert.equal(own.port.view().ok, false); assert.equal(ui.stats.leaves, 2)
}))

test('the trusted host source has no wall-clock or weak-random fallback and never forwards private props', () => {
  assert.doesNotMatch(source, /\b(?:Date\.now|Math\.random|localStorage|sessionStorage)\b/)
  const syntax = ts.createSourceFile('host.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function inspect(node) {
    if (ts.isJsxSelfClosingElement(node) && /^HrRecruiting/.test(node.tagName.getText(syntax))) {
      for (const attribute of node.attributes.properties) if (ts.isJsxAttribute(attribute)) assert.ok(!['state', 'actor', 'rawFixture', 'replacementEpoch', 'storageStatus', 'onUpdate'].includes(attribute.name.getText(syntax)))
      assert.equal(node.attributes.properties.some(ts.isJsxSpreadAttribute), false)
    }
    ts.forEachChild(node, inspect)
  }
  inspect(syntax)
})
