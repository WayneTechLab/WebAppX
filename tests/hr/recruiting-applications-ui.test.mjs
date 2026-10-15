import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const files = ['HrRecruitingApplications', 'HrRecruitingHireSummary']
const sources = Object.fromEntries(await Promise.all(files.map(async name => [name, await readFile(new URL(`../../src/hr/components/${name}.tsx`, import.meta.url), 'utf8')])))
const draftSource = await readFile(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const syntax = ts.createSourceFile('useHrFormDraft.ts', draftSource, ts.ScriptTarget.Latest, true)
const declarations = ['normalizeHrFormValue', 'createHrFormDraft'].map(name => syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(syntax).replace(/^export /, '')).join('\n')
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText
const draftModule = new Function(`${compile(declarations)};return {createHrFormDraft,normalizeHrFormValue}`)()
const instant = '2026-10-15T12:00:00.000Z'
const unknown = { stage: 'applied', enteredAt: null, exitedAt: null, durationMs: null, boundary: 'unknown-legacy' }
const application = (id, jobId, stage) => ({ id, personId: 'person-casey', jobId, stage, stageEnteredAt: null, intervals: [structuredClone(unknown)], outcomeReason: null, hiredEmployeeId: null, legacyActivity: [] })
function viewFixture() {
  return { mode: 'management', people: [{ id: 'person-casey', firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey@fixture.invalid', hiredEmployeeId: null }], jobs: [
    { id: 'job-one', title: 'Fictional support', department: 'Operations', managerEmployeeId: 'employee-001', state: 'published', revision: 1, requisitionId: null, publication: { kind: 'legacy-unrecorded' } },
    { id: 'job-two', title: 'Fictional research', department: 'Research', managerEmployeeId: 'employee-001', state: 'published', revision: 1, requisitionId: 'req-two', publication: { kind: 'captured', publicationId: 'pub-two' } },
  ], applications: [application('application-one', 'job-one', 'applied'), application('application-two', 'job-two', 'interview')], requisitions: [], interviews: [], submittedScorecards: [], publicActivity: [] }
}
function previewFor(command, changes = {}) { return { kind: command.kind, recordedAt: command.recordedAt, changedPeople: [], changedApplications: [], requisition: null, job: null, conflict: null, interview: null, hire: null, warnings: [], ...changes } }
function creationFixture(employment = null) {
  return {
    employee: { id: 'employee-new', firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey@fixture.invalid', department: 'Research', jobTitle: 'Fictional research', employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false, onboardingTemplateVersion: 'sample-v2', onboarding: [{ id: 'profile', title: 'Complete profile', status: 'pending' }, { id: 'security', title: 'Read security guidance', status: 'pending' }] },
    onboarding: { profileReviewed: false, jobReviewed: false, tasks: { profile: false, security: false }, stage: 'draft' },
    profile: { employeeId: 'employee-new', workEmail: 'casey@fixture.invalid' }, status: { employeeId: 'employee-new', value: 'onboarding' }, balance: { employeeId: 'employee-new', vacation: 40, sick: 24 }, employment,
  }
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function text(node) { if (Array.isArray(node)) return node.map(text).join(''); if (node && typeof node === 'object') return text(node.children); return node == null || typeof node === 'boolean' ? '' : String(node) }
function nodes(root, predicate) { if (Array.isArray(root)) return root.flatMap(item => nodes(item, predicate)); if (!root || typeof root !== 'object') return []; return [...(predicate(root) ? [root] : []), ...nodes(root.children, predicate)] }

/** Actual exported components/hooks/callbacks execute here. React scheduling,
 * DOM focus and the narrow command port are deterministic boundary fixtures.
 * No application reducer produces either the DTO or the expected commands. */
function harness({ view = viewFixture(), adopted = true, preview, confirm, observe } = {}) {
  const fibers = new Map(), groups = new Map(), calls = { preview: [], confirm: [], cancel: [], view: [], onView: [], focus: [] }
  let active, cursor, tree, props, serial = 0, visited
  const effects = []
  const React = {
    Fragment: 'fragment', createElement: (type, properties, ...children) => ({ type, props: properties ?? {}, children }),
    useState(initial) { const slot = cursor++, fiber = active; if (!Object.hasOwn(fiber, slot)) fiber[slot] = typeof initial === 'function' ? initial() : initial; return [fiber[slot], update => { fiber[slot] = typeof update === 'function' ? update(fiber[slot]) : update }] },
    useRef(initial) { const slot = cursor++; return active[slot] ??= { current: initial } },
    useEffect(effect, dependencies) { const slot = cursor++, fiber = active, prior = fiber[slot]; if (!prior || dependencies.some((value, index) => value !== prior.dependencies[index])) { prior?.cleanup?.(); effects.push(() => { fiber[slot] = { dependencies, cleanup: effect() } }) } },
  }
  const modules = {}
  function load(name) {
    if (modules[name]) return modules[name]
    const exports = {}
    new Function('require', 'exports', 'React', compile(sources[name]))(dependency => {
      if (dependency === 'react') return React
      if (dependency === '@/portals/unsaved-work') return { useUnsavedWork(config) { groups.set(config.id, config) } }
      if (dependency === './useHrFormDraft') return { ...draftModule, focusHrForm(id) { calls.focus.push(id) } }
      if (dependency === './HrRecruitingHireSummary') return load('HrRecruitingHireSummary')
      throw new Error(`Unexpected component dependency ${dependency}`)
    }, exports, React)
    return modules[name] = exports
  }
  const Component = load('HrRecruitingApplications').HrRecruitingApplications
  const port = {
    preview(command) { calls.preview.push(structuredClone(command)); return preview ? preview(command) : { ok: true, handle: `opaque-${++serial}`, preview: previewFor(command) } },
    confirm(request) { calls.confirm.push({ ...request }); return confirm ? confirm(request) : { ok: true, feedback: 'Fictional recruiting action accepted.', view: structuredClone(props.view) } },
    cancel(handle) { calls.cancel.push(handle) },
    view(options) { calls.view.push(options && { ...options }); return observe ? observe(options) : structuredClone(props.view) },
    clear() {}, dispose() {},
  }
  props = { view: freeze(structuredClone(view)), adopted, port, onView(next) { calls.onView.push(structuredClone(next)); props = { ...props, view: freeze(structuredClone(next)) } } }
  function resolve(node, path) {
    if (Array.isArray(node)) return node.map((item, index) => resolve(item, `${path}/${item?.props?.key ?? index}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const key = `${path}/${node.type.name}:${node.props.key ?? ''}`
      visited.add(key); active = fibers.get(key) ?? []; fibers.set(key, active); cursor = 0
      return resolve(node.type({ ...node.props, children: node.children }), key)
    }
    return { ...node, children: resolve(node.children, `${path}/${node.type}`) }
  }
  function render(next) {
    if (next) props = { ...props, ...next }
    visited = new Set(); groups.clear(); effects.length = 0
    tree = resolve({ type: Component, props, children: [] }, 'root')
    for (const [key, fiber] of fibers) if (!visited.has(key)) { fiber.forEach(slot => slot?.cleanup?.()); fibers.delete(key) }
    effects.splice(0).forEach(effect => effect())
    return tree
  }
  function find(predicate, scope = tree) { return nodes(scope, predicate) }
  function unique(predicate, label, scope) { const matches = find(predicate, scope); assert.equal(matches.length, 1, label); return matches[0] }
  function form(label) { return unique(node => node.type === 'form' && node.props['aria-label'] === label, label) }
  function field(formLabel, label) { const wrapper = unique(node => node.type === 'label' && text(node).startsWith(label), label, form(formLabel)); return unique(node => ['input', 'textarea', 'select'].includes(node.type), label, wrapper) }
  const oldWindow = globalThis.window
  globalThis.window = { requestAnimationFrame(callback) { callback() } }
  return {
    calls, groups, port, render, find, form, field, text: () => text(tree),
    change(formLabel, label, value) { field(formLabel, label).props.onChange({ target: { value } }); render() },
    submit(label) { form(label).props.onSubmit({ preventDefault() {} }); render() },
    button(label, scope) { return unique(node => node.type === 'button' && text(node) === label, label, scope) },
    press(label, scope) { this.button(label, scope).props.onClick(); render() },
    cleanup() { for (const fiber of fibers.values()) fiber.forEach(slot => slot?.cleanup?.()); if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow },
  }
}
const adoptionForm = 'Recruiting adoption', newForm = 'Create recruiting person and application', existingForm = 'Create separate recruiting application'
const stageForm = id => `Stage change for application ${id}`
const outcomeForm = id => `Terminal outcome for application ${id}`
const hireForm = id => `Hire confirmation for application ${id}`
function withUi(options, check) { const ui = harness(options); try { ui.render(); check(ui) } finally { ui.cleanup() } }
function fillPerson(ui) { for (const [name, value] of [['Fictional first name', 'Casey'], ['Fictional last name', 'Fiction'], ['Fictional work email', 'casey@fixture.invalid'], ['Application job', 'job-two'], ['Recorded UTC time', instant]]) ui.change(newForm, name, value) }

test('adoption requires explicit valid UTC, previews before confirmation and cancel keeps its entered date', () => withUi({ adopted: false }, ui => {
  assert.equal(ui.calls.preview.length, 0)
  ui.change(adoptionForm, 'Recorded UTC time', '2026-02-30T12:00:00.000Z'); ui.submit(adoptionForm)
  assert.equal(ui.calls.preview.length, 0); assert.match(ui.text(), /valid UTC instant/)
  ui.change(adoptionForm, 'Recorded UTC time', instant); ui.submit(adoptionForm)
  assert.deepEqual(ui.calls.preview, [{ kind: 'adopt', recordedAt: instant }]); assert.equal(ui.calls.confirm.length, 0)
  ui.press('Cancel recruiting adoption preview')
  assert.equal(ui.field(adoptionForm, 'Recorded UTC time').props.value, instant); assert.deepEqual(ui.calls.cancel, ['opaque-1'])
  ui.submit(adoptionForm); ui.press('Confirm recruiting adoption')
  assert.deepEqual(ui.calls.confirm, [{ kind: 'adopt', handle: 'opaque-2' }]); assert.equal(ui.calls.onView.length, 1)
}))

test('duplicate person conflict requires a deliberate separate-application choice and retains the original conflicting draft', () => withUi({ preview(command) { return command.kind === 'create-person-application' ? { ok: false, code: 'conflict', conflict: { kind: 'person', id: 'person-casey', displayName: 'Casey Fiction' }, message: 'An existing fictional person uses this address.' } : { ok: true, handle: 'separate-reviewed', preview: previewFor(command, { changedApplications: [application('new-application', 'job-two', 'applied')] }) } } }, ui => {
  fillPerson(ui); ui.submit(newForm)
  assert.equal(ui.calls.confirm.length, 0); assert.match(ui.text(), /No person or application was created/)
  ui.press('Choose existing person for a separate application')
  assert.equal(ui.field(existingForm, 'Existing recruiting person').props.value, 'person-casey')
  assert.equal(ui.field(existingForm, 'Separate application job').props.value, 'job-two')
  assert.equal(ui.field(newForm, 'Fictional work email').props.value, 'casey@fixture.invalid')
  ui.submit(existingForm); ui.press('Confirm separate application')
  assert.deepEqual(ui.calls.preview[1], { kind: 'add-person-application', personId: 'person-casey', jobId: 'job-two', recordedAt: instant })
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:new-person').isDirty(), true)
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:existing-person').isDirty(), false)
  assert.equal(ui.field(newForm, 'Fictional first name').props.value, 'Casey')
}))

for (const kind of ['employee', 'application']) test(`${kind} conflicts never offer an implicit person reuse or merge`, () => withUi({ preview() { return { ok: false, code: 'conflict', conflict: { kind, id: 'unavailable-identity', displayName: 'Fictional conflict' }, message: 'Choose an explicit supported action.' } } }, ui => {
  fillPerson(ui); ui.submit(newForm)
  assert.equal(ui.find(node => node.type === 'button' && text(node) === 'Choose existing person for a separate application').length, 0)
  assert.equal(ui.calls.confirm.length, 0); assert.equal(ui.field(newForm, 'Fictional first name').props.value, 'Casey')
}))

test('different applications retain independent drafts and only the accepted stage form is rebased', () => withUi({}, ui => {
  ui.change(stageForm('application-one'), 'Recorded UTC time', instant)
  ui.change(outcomeForm('application-two'), 'Sample outcome reason', 'Separate application reason kept.')
  ui.change(outcomeForm('application-two'), 'Recorded UTC time', '2026-10-15T13:00:00.000Z')
  ui.submit(stageForm('application-one')); ui.press('Confirm move to screening')
  assert.deepEqual(ui.calls.preview[0], { kind: 'move-application', applicationId: 'application-one', expectedStage: 'applied', nextStage: 'screening', recordedAt: instant })
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:application-one:stage').isDirty(), false)
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:application-two:outcome').isDirty(), true)
  assert.equal(ui.field(outcomeForm('application-two'), 'Sample outcome reason').props.value, 'Separate application reason kept.')
}))

for (const [current, next] of [['applied', 'screening'], ['screening', 'interview'], ['interview', 'offer']]) test(`${current} exposes only its legal next stage ${next}`, () => {
  const view = viewFixture(); view.applications[0].stage = current
  withUi({ view }, ui => {
    const card = ui.find(node => node.type === 'article' && node.props['aria-label'] === 'Recruiting application application-one')[0]
    const advanceLabels = ui.find(node => node.type === 'button' && /^Preview move to /.test(text(node)), card).map(text)
    assert.deepEqual(advanceLabels, [`Preview move to ${next}`])
    assert.equal(ui.find(node => node.type === 'button' && text(node) === 'Preview exact fictional hire', card).length, 0)
    ui.change(stageForm('application-one'), 'Recorded UTC time', instant); ui.submit(stageForm('application-one'))
    assert.deepEqual(ui.calls.preview[0], { kind: 'move-application', applicationId: 'application-one', expectedStage: current, nextStage: next, recordedAt: instant })
  })
})

test('reject and withdraw use distinct explicit terminal commands with a required sample reason', () => withUi({}, ui => {
  const label = outcomeForm('application-one')
  ui.change(label, 'Recorded UTC time', instant); ui.submit(label)
  assert.equal(ui.calls.preview.length, 0); assert.match(ui.text(), /sample reason/)
  assert.equal(ui.field(label, 'Sample outcome reason').props.required, true)
  ui.change(label, 'Terminal application outcome', 'withdrawn'); ui.change(label, 'Sample outcome reason', '  Fictional candidate withdrew.  '); ui.submit(label)
  assert.deepEqual(ui.calls.preview[0], { kind: 'end-application', applicationId: 'application-one', expectedStage: 'applied', outcome: 'withdrawn', reason: 'Fictional candidate withdrew.', recordedAt: instant })
  assert.ok(ui.button('Confirm withdrawal')); assert.equal(ui.find(node => node.type === 'button' && text(node) === 'Confirm rejection').length, 0)
}))

test('changed local fields cancel the old handle and a retained old confirmation cannot accept newer fields', () => withUi({}, ui => {
  const label = stageForm('application-one')
  ui.change(label, 'Recorded UTC time', instant); ui.submit(label)
  const oldConfirm = ui.button('Confirm move to screening').props.onClick
  ui.change(label, 'Recorded UTC time', '2026-10-15T13:00:00.000Z'); ui.submit(label)
  oldConfirm(); ui.render()
  assert.equal(ui.calls.confirm.length, 0); assert.deepEqual(ui.calls.cancel, ['opaque-1'])
  assert.equal(ui.field(label, 'Recorded UTC time').props.value, '2026-10-15T13:00:00.000Z')
  assert.match(ui.text(), /reviewed fields changed/)
}))

test('external dirty-form Discard cancels synchronously before any rerender or retained callback', () => withUi({}, ui => {
  const label = stageForm('application-one')
  ui.change(label, 'Recorded UTC time', instant); ui.submit(label)
  const confirm = ui.button('Confirm move to screening').props.onClick
  ui.groups.get('hr:recruiting-lifecycle:application-one:stage').discard()
  confirm(); ui.render()
  assert.equal(ui.calls.confirm.length, 0); assert.deepEqual(ui.calls.cancel, ['opaque-1'])
  assert.equal(ui.field(label, 'Recorded UTC time').props.value, '')
}))

test('latest-state stale or no-op refusal keeps every typed field and its dirty baseline', () => withUi({ confirm() { return { ok: false, code: 'stale', message: 'The current application changed. Preview again.' } } }, ui => {
  const label = outcomeForm('application-two')
  ui.change(label, 'Sample outcome reason', 'Retain this fictional reason.'); ui.change(label, 'Recorded UTC time', instant)
  ui.submit(label); ui.press('Confirm rejection')
  assert.equal(ui.calls.onView.length, 0)
  assert.equal(ui.field(label, 'Sample outcome reason').props.value, 'Retain this fictional reason.')
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:application-two:outcome').isDirty(), true)
  assert.match(ui.text(), /current application changed/)
}))

test('terminal applications expose separate retained outcomes and no mutation forms', () => {
  const view = viewFixture(); Object.assign(view.applications[0], { stage: 'withdrawn', outcomeReason: 'Fictional withdrawal.' }); Object.assign(view.applications[1], { stage: 'rejected', outcomeReason: 'Fictional rejection.' })
  withUi({ view }, ui => { assert.match(ui.text(), /application is withdrawn/); assert.match(ui.text(), /application is rejected/); assert.match(ui.text(), /Fictional withdrawal/); assert.match(ui.text(), /Fictional rejection/); assert.equal(ui.find(node => node.type === 'form' && /^(Stage change|Terminal outcome|Hire confirmation)/.test(node.props['aria-label'] ?? '')).length, 0) })
})

test('offer preview renders every authorized hire capture before confirmation and cancel preserves the entered time', () => {
  const view = viewFixture(); view.applications[1].stage = 'offer'; const creation = freeze(creationFixture())
  withUi({ view, preview(command) { return { ok: true, handle: 'exact-hire', preview: previewFor(command, { hire: creation }) } } }, ui => {
    const label = hireForm('application-two')
    ui.change(label, 'Recorded UTC time', instant); ui.submit(label)
    assert.deepEqual(ui.calls.preview[0], { kind: 'hire', applicationId: 'application-two', recordedAt: instant }); assert.equal(ui.calls.confirm.length, 0)
    for (const value of ['employee-new', 'casey@fixture.invalid', 'sample-v2', 'Read security guidance', 'profileReviewed', 'false', 'compensationConfigured', 'unconfigured-synthetic', 'vacation', '40', 'sick', '24', 'No employment instance or employment event will be created']) assert.ok(ui.text().includes(value), value)
    ui.press('Cancel application application-two hire preview')
    assert.equal(ui.field(label, 'Recorded UTC time').props.value, instant)
    ui.submit(label); ui.press('Confirm exact fictional hire')
    assert.deepEqual(ui.calls.confirm, [{ kind: 'hire', handle: 'exact-hire' }]); assert.equal(ui.calls.onView.length, 1)
  })
})

test('employment-present hire summary retains exact instance/event links rather than claiming absent history', () => {
  const view = viewFixture(); view.applications[1].stage = 'offer'
  const creation = creationFixture({ instance: { id: 'employment-employee-new-1', employeeId: 'employee-new', templateVersion: 'sample-v2', startDate: '2026-10-15', endDate: null, tasks: [{ id: 'security', title: 'Read security guidance' }] }, event: { id: 'lifecycle-8', sequence: 8, kind: 'hire', effectiveDate: '2026-10-15', actor: { role: 'employer-owner' } } })
  withUi({ view, preview(command) { return { ok: true, handle: 'hire-with-employment', preview: previewFor(command, { hire: creation }) } } }, ui => {
    ui.change(hireForm('application-two'), 'Recorded UTC time', instant); ui.submit(hireForm('application-two'))
    assert.match(ui.text(), /employment-employee-new-1/); assert.match(ui.text(), /lifecycle-8/); assert.doesNotMatch(ui.text(), /No employment instance or employment event will be created/)
  })
})

test('optional duration observation sends only the supplied instant and preserves known/unknown interval semantics', () => {
  const view = viewFixture()
  view.applications[1].intervals = [{ stage: 'screening', enteredAt: '2026-10-15T10:00:00.000Z', exitedAt: '2026-10-15T11:00:00.000Z', durationMs: 3600000, boundary: 'known' }, { stage: 'interview', enteredAt: '2026-10-15T11:00:00.000Z', exitedAt: null, durationMs: null, boundary: 'open' }]
  withUi({ view }, ui => {
    assert.match(ui.text(), /3600000 ms/); assert.match(ui.text(), /Not observed/); assert.match(ui.text(), /Unknown legacy duration/)
    ui.submit('Application duration observation'); assert.deepEqual(ui.calls.view, [undefined])
    ui.change('Application duration observation', 'Optional observation UTC time', instant); ui.submit('Application duration observation')
    assert.deepEqual(ui.calls.view[1], { observedAt: instant }); assert.equal(ui.calls.preview.length, 0); assert.equal(ui.calls.confirm.length, 0)
    assert.match(ui.text(), /Duration view requested with observation UTC time 2026-10-15T12:00:00.000Z/)
  })
})

test('legacy receipt/action/actor remains management-only with unknown recorded UTC time', () => {
  const view = viewFixture(); view.applications[0].legacyActivity = [{ receipt: 'MOCK-RECRUIT-0002', action: 'Candidate moved to screening', actorRole: 'employer-owner' }]
  withUi({ view }, ui => { for (const value of ['MOCK-RECRUIT-0002', 'Candidate moved to screening', 'Actor preview: employer-owner', 'Recorded UTC time: unknown legacy time']) assert.ok(ui.text().includes(value), value); assert.equal(ui.calls.preview.length, 0) })
})

test('component boundaries cannot acquire full workspace state, raw adapters, reducers or an implicit observation clock', () => {
  for (const source of Object.values(sources)) {
    assert.doesNotMatch(source, /\b(?:HrDemoState|RecruitingControllerAdapter|readCurrent|replaceCurrent|readRawFixture|transitionRecruiting|transitionMockHr|Date\.now|setInterval)\b/)
    assert.doesNotMatch(source, /JSON\.stringify\s*\(\s*(?:view|state|workspace)/)
  }
})

test('conflict resolution cannot overwrite an already dirty separate-application draft', () => withUi({ preview() { return { ok: false, code: 'conflict', conflict: { kind: 'person', id: 'person-casey', displayName: 'Casey Fiction' }, message: 'Existing person.' } } }, ui => {
  ui.change(existingForm, 'Separate application job', 'job-one'); ui.change(existingForm, 'Recorded UTC time', '2026-10-15T13:00:00.000Z')
  fillPerson(ui); ui.submit(newForm); ui.press('Choose existing person for a separate application')
  assert.equal(ui.field(existingForm, 'Separate application job').props.value, 'job-one')
  assert.equal(ui.field(existingForm, 'Recorded UTC time').props.value, '2026-10-15T13:00:00.000Z')
  assert.match(ui.text(), /explicitly discard the separate-application draft/)
  ui.press('Discard separate application draft'); ui.press('Choose existing person for a separate application')
  assert.equal(ui.field(existingForm, 'Separate application job').props.value, 'job-two')
}))

test('terminal confirmation cannot hide another dirty form for the same application', () => withUi({}, ui => {
  ui.change(stageForm('application-one'), 'Recorded UTC time', '2026-10-15T11:00:00.000Z')
  ui.change(outcomeForm('application-one'), 'Sample outcome reason', 'Fictional terminal reason.'); ui.change(outcomeForm('application-one'), 'Recorded UTC time', instant)
  ui.submit(outcomeForm('application-one')); ui.press('Confirm rejection')
  assert.equal(ui.calls.confirm.length, 0); assert.match(ui.text(), /explicitly discard the other temporary drafts/)
  assert.equal(ui.field(stageForm('application-one'), 'Recorded UTC time').props.value, '2026-10-15T11:00:00.000Z')
  const scope = ui.find(node => node.type === 'section' && node.props['aria-label'] === 'Advance application application-one')[0]
  ui.press('Discard stage draft', scope); ui.press('Confirm rejection')
  assert.equal(ui.calls.confirm.length, 1)
}))

test('hire confirmation cannot hide an independent terminal draft for the same application', () => {
  const view = viewFixture(); view.applications[1].stage = 'offer'
  withUi({ view, preview(command) { return { ok: true, handle: 'hire-reviewed', preview: previewFor(command, { hire: creationFixture() }) } } }, ui => {
    ui.change(outcomeForm('application-two'), 'Sample outcome reason', 'Keep this separate decision.')
    ui.change(hireForm('application-two'), 'Recorded UTC time', instant); ui.submit(hireForm('application-two')); ui.press('Confirm exact fictional hire')
    assert.equal(ui.calls.confirm.length, 0); assert.equal(ui.field(outcomeForm('application-two'), 'Sample outcome reason').props.value, 'Keep this separate decision.')
    const scope = ui.find(node => node.type === 'section' && node.props['aria-label'] === 'End application application-two')[0]
    ui.press('Discard outcome draft', scope); ui.press('Confirm exact fictional hire')
    assert.equal(ui.calls.confirm.length, 1)
  })
})

test('an incomplete hire preview never exposes a confirmation and keeps the entered time', () => {
  const view = viewFixture(); view.applications[1].stage = 'offer'
  withUi({ view }, ui => {
    ui.change(hireForm('application-two'), 'Recorded UTC time', instant); ui.submit(hireForm('application-two'))
    assert.equal(ui.find(node => node.type === 'button' && text(node) === 'Confirm exact fictional hire').length, 0)
    assert.equal(ui.calls.confirm.length, 0); assert.deepEqual(ui.calls.cancel, ['opaque-1'])
    assert.equal(ui.field(hireForm('application-two'), 'Recorded UTC time').props.value, instant)
    assert.match(ui.text(), /Exact hire records were not supplied/)
  })
})

test('a no-op preview refusal preserves all local fields without accepting their baseline', () => withUi({ preview() { return { ok: false, code: 'invalid', message: 'No-op application change refused.' } } }, ui => {
  fillPerson(ui); ui.submit(newForm)
  assert.equal(ui.calls.confirm.length, 0); assert.equal(ui.calls.onView.length, 0)
  for (const [field, value] of [['Fictional first name', 'Casey'], ['Fictional last name', 'Fiction'], ['Fictional work email', 'casey@fixture.invalid'], ['Application job', 'job-two'], ['Recorded UTC time', instant]]) assert.equal(ui.field(newForm, field).props.value, value)
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:new-person').isDirty(), true)
}))

test('unmounting the management application forms cancels retained opaque handles', () => withUi({}, ui => {
  ui.change(stageForm('application-one'), 'Recorded UTC time', instant); ui.submit(stageForm('application-one'))
  ui.render({ adopted: false })
  assert.deepEqual(ui.calls.cancel, ['opaque-1']); assert.equal(ui.calls.confirm.length, 0)
}))

test('unexpected port exceptions retain fields and never render internal exception contents', () => withUi({ preview() { throw new Error('PRIVATE fixture sentinel must remain hidden') } }, ui => {
  fillPerson(ui); ui.submit(newForm)
  assert.match(ui.text(), /could not be previewed/); assert.doesNotMatch(ui.text(), /PRIVATE fixture sentinel/)
  assert.equal(ui.field(newForm, 'Fictional work email').props.value, 'casey@fixture.invalid')
  assert.equal(ui.groups.get('hr:recruiting-lifecycle:new-person').isDirty(), true)
}))
