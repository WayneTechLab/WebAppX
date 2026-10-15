import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const root = new URL('../../src/hr/components/', import.meta.url)
const files = ['HrWorkspace.tsx', 'PeopleOperations.tsx', 'HrServiceDesk.tsx', 'HrRecruiting.tsx', 'HrPerformance.tsx', 'HrSurveys.tsx', 'useHrFormDraft.ts']
const sources = new Map(await Promise.all(files.map(async file => [file, await readFile(new URL(file, root), 'utf8')])))
const syntax = new Map([...sources].map(([file, source]) => [file, ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]))
function declaration(file, name) {
  const node = syntax.get(file).statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name)
  assert.ok(node, `Actual source must retain ${file}:${name}`)
  return node
}
function javascript(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export /gm, '')
}
const pure = new Function(`${javascript(declaration('useHrFormDraft.ts', 'normalizeHrFormValue').getText())}\n${javascript(declaration('useHrFormDraft.ts', 'createHrFormDraft').getText())}\nreturn {normalizeHrFormValue,createHrFormDraft}`)()
const { createHrFormDraft, normalizeHrFormValue } = pure
const fixture = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const model = await loadMockModel(new URL('../../src/hr/model.ts', import.meta.url))
const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const people = await loadMockModel(new URL('../../src/hr/people-operations.ts', import.meta.url))
const desk = await loadMockModel(new URL('../../src/hr/service-desk.ts', import.meta.url))
const recruiting = await loadMockModel(new URL('../../src/hr/recruiting.ts', import.meta.url))
const performance = await loadMockModel(new URL('../../src/hr/performance.ts', import.meta.url))
const { createUnsavedWorkController } = await loadMockModel(new URL('../../src/portals/unsaved-work-core.ts', import.meta.url))
const employee = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const owner = { role: 'employer-owner' }

/** Run actual component event callbacks with deterministic hook slots and JSX
 * data nodes. These unit contracts do not render a DOM or claim browser proof. */
function component(file, name, extra = {}) {
  const slots = []
  const groups = new Map()
  const requests = []
  let cursor = 0
  let tree
  const dependencies = {
    ...model, ...workflow, ...people, ...desk, ...recruiting, ...performance,
    ...pure, hrFixture: fixture, fieldClass: '', buttonClass: '', field: '', button: '', panelClass: '',
    Panel: 'Panel', Status: 'Status', TimeEntryActions: 'TimeEntryActions', CandidateDetail: 'CandidateDetail',
    Activity: 'Activity', nextLabels: {}, stages: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'],
    personName: id => id,
    person: record => record.employeeId,
    FormData: class { constructor(form) { this.fields = form.fields } get(key) { return this.fields[key] ?? null } },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useHrFormDraft(options) {
      const index = cursor++
      const controller = slots[index] ??= createHrFormDraft(options.initial, options.normalize)
      const participant = { id: options.id, portal: 'hr', label: options.label, isDirty: () => options.enabled !== false && controller.isDirty(), discard: () => controller.discard(), controller }
      groups.set(options.id, participant)
      extra.unsavedController?.register(() => participant)
      return { id: options.id, value: controller.value(), setValue: next => controller.change(next), accept: (...args) => controller.accept(...args), discard: () => controller.discard(), dirty: options.enabled !== false && controller.isDirty() }
    },
    useUnsavedTransition: () => (options, commit) => { requests.push({ options, commit }); return extra.unsavedController ? extra.unsavedController.request(options, commit) : false },
    React: { createElement(type, props, ...children) { return { type, props: { ...props, children } } } },
    ...extra,
  }
  const run = new Function(...Object.keys(dependencies), `${javascript(declaration(file, name).getText())}\nreturn ${name}`)(...Object.values(dependencies))
  return {
    groups, requests,
    render(props) { cursor = 0; groups.clear(); tree = run(props); return tree },
    nodes(predicate) {
      const found = []
      function visit(node) {
        if (Array.isArray(node)) { node.forEach(visit); return }
        if (!node || typeof node !== 'object') return
        if (predicate(node)) found.push(node)
        visit(node.props?.children)
      }
      visit(tree)
      return found
    },
  }
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (node && typeof node === 'object') return text(node.props?.children)
  return node == null || typeof node === 'boolean' ? '' : String(node)
}
function field(harness, label) {
  const [wrapper] = harness.nodes(node => node.type === 'label' && text(node).startsWith(label))
  assert.ok(wrapper, `Missing actual label ${label}`)
  const visit = nodes => nodes.flatMap(node => Array.isArray(node) ? visit(node) : node && typeof node === 'object' ? ['input', 'textarea', 'select'].includes(node.type) ? [node] : visit(node.props?.children ?? []) : [])
  return visit(wrapper.props.children)[0]
}
function change(harness, label, value) { field(harness, label).props.onChange({ target: { value }, currentTarget: { value } }) }
function submit(harness, index = 0, fields = {}) { harness.nodes(node => node.type === 'form')[index].props.onSubmit({ preventDefault() {}, currentTarget: { fields } }) }
function click(harness, label) {
  const [button] = harness.nodes(node => node.type === 'button' && text(node) === label)
  assert.ok(button, `Missing actual button ${label}`)
  button.props.onClick()
}
const dirty = harness => [...harness.groups.values()].filter(group => group.isDirty()).map(group => group.label)

test('normalization distinguishes meaningful edits and cleans exact semantic reversion', () => {
  const draft = createHrFormDraft({ title: 'Saved title', details: 'Two words', audience: ['employee-002'] })
  draft.change({ details: ' Two words ', audience: ['employee-002'], title: ' Saved title ' })
  assert.equal(draft.isDirty(), false)
  draft.change(previous => ({ ...previous, details: 'Two  words' }))
  assert.equal(draft.isDirty(), true, 'Internal text changes remain meaningful')
  draft.discard()
  assert.deepEqual(draft.value(), { title: 'Saved title', details: 'Two words', audience: ['employee-002'] })
})

test('accepted clear/rebase is synchronous and affects only its own group', () => {
  const title = createHrFormDraft('')
  const resolution = createHrFormDraft('')
  title.change('Accepted fictional request')
  resolution.change('Unsaved independent resolution')
  title.accept('')
  assert.equal(title.value(), '')
  assert.equal(title.isDirty(), false, 'No render/effect/storage callback is needed')
  assert.equal(resolution.isDirty(), true)
  resolution.accept('Accepted resolution')
  resolution.change(' Accepted resolution ')
  assert.equal(resolution.isDirty(), false)
})

test('actual registration callbacks observe edits, acceptance and discard before another render', () => {
  const slots = []
  let index = 0
  let participant
  const useState = initial => {
    const slot = index++
    slots[slot] = typeof initial === 'function' ? initial() : initial
    return [slots[slot], value => { slots[slot] = value }]
  }
  const focusEvents = []
  const hook = new Function('useState', 'createHrFormDraft', 'useUnsavedWork', 'focusHrForm', 'window', `${javascript(declaration('useHrFormDraft.ts', 'useHrFormDraft').getText())}\nreturn useHrFormDraft`)(useState, createHrFormDraft, value => { participant = value }, id => focusEvents.push(['focus', id]), { requestAnimationFrame(callback) { focusEvents.push(['frame']); callback() } })
  const draft = hook({ id: 'literal-form', label: 'Literal fictional form', initial: '', reveal: () => focusEvents.push(['reveal']) })
  assert.equal(participant.portal, 'hr')
  assert.equal(participant.id, 'literal-form')
  assert.equal(draft.id, 'literal-form')
  assert.equal(typeof participant.focus, 'function', 'Every actual HR registration must support retained-owner activation')
  participant.focus()
  assert.deepEqual(focusEvents, [['reveal'], ['frame'], ['focus', 'literal-form']])
  draft.setValue('Unsaved literal')
  assert.equal(participant.isDirty(), true)
  draft.accept('')
  assert.equal(participant.isDirty(), false)
  draft.setValue('Another unsaved literal')
  participant.discard()
  assert.equal(participant.isDirty(), false)
  assert.equal(slots[1], '')
})

test('actual HR focus helper opens enclosing disclosures before focusing its own enabled control', () => {
  const events = []
  const control = { focus() { events.push('focused own control') } }
  const details = { tagName: 'DETAILS', parentElement: null, setAttribute(name, value) { events.push([name, value]) } }
  const group = { tagName: 'FORM', parentElement: details, querySelector(selector) { assert.match(selector, /input:not\(\[disabled\]\)/); assert.match(selector, /textarea/); assert.match(selector, /select/); assert.match(selector, /button/); return control } }
  const focus = new Function('document', `${javascript(declaration('useHrFormDraft.ts', 'focusHrForm').getText())}\nreturn focusHrForm`)({ getElementById(id) { events.push(['group', id]); return id === 'hr:literal:form' ? group : null } })
  focus('hr:literal:form')
  assert.deepEqual(events, [['group', 'hr:literal:form'], ['open', ''], 'focused own control'])
  focus('missing-group')
  assert.deepEqual(events.at(-1), ['group', 'missing-group'])
})

test('profile failure retains the current email; accepted memory action rebases even without storage', () => {
  let accepted = false
  const h = component('HrWorkspace.tsx', 'EmployeeProfile')
  const props = { employee: fixture.employees.find(item => item.id === employee.employeeId), actor: employee, onEmail: () => accepted }
  h.render(props)
  change(h, 'Synthetic work email', ' new.fictional@example.invalid ')
  h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Synthetic work email'])
  accepted = true
  submit(h)
  assert.deepEqual(dirty(h), [])
  h.render(props)
  assert.equal(field(h, 'Synthetic work email').props.value, 'new.fictional@example.invalid')
})

test('manual time compares numeric hours and accepted add clears only the manual group', () => {
  let accepted = false
  const h = component('HrWorkspace.tsx', 'TimeEntries')
  const props = { actor: employee, records: [], employees: fixture.employees, onAction: () => accepted }
  h.render(props)
  change(h, 'Hours', '8.0000')
  assert.deepEqual(dirty(h), [])
  change(h, 'Hours', '7.5')
  h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Manual time entry'])
  accepted = true
  submit(h)
  assert.deepEqual(dirty(h), [])
})

test('discarding a running timer creates no entry; a rejected stop retains it', () => {
  const actions = []
  const h = component('HrWorkspace.tsx', 'TimeEntries', { stopMockTimer: () => ({ type: 'add-time', date: '2026-10-15', hours: 1, source: 'timer' }) })
  const props = { actor: employee, records: [], employees: fixture.employees, onAction: action => { actions.push(action); return false } }
  h.render(props); click(h, 'Start sample timer'); h.render(props)
  assert.deepEqual(dirty(h), ['Running sample timer'])
  click(h, 'Stop and add sample time')
  assert.equal(actions.length, 1)
  assert.deepEqual(dirty(h), ['Running sample timer'])
  h.groups.get('hr:time:employee-002:timer').discard()
  assert.equal(actions.length, 1, 'Discard is cancellation, not a stop/add action')
  assert.deepEqual(dirty(h), [])
})

test('correction cancellation is queued with only its own group and does not commit early', () => {
  const entry = { id: 'draft-literal', employeeId: employee.employeeId, date: '2026-10-09', hours: 8, status: 'draft', source: 'manual' }
  const h = component('HrWorkspace.tsx', 'TimeEntryActions')
  const props = { actor: employee, entry, employees: fixture.employees, onAction: () => false }
  h.render(props); click(h, 'Edit draft'); h.render(props)
  change(h, 'Hours for draft-literal', '7.5'); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Time correction draft-literal'])
  click(h, 'Cancel draft editing')
  assert.equal(h.requests.length, 1)
  assert.deepEqual(h.requests[0].options, { portal: 'hr', ids: ['hr:time:draft-literal:correction'], label: 'Cancel draft editing' })
  assert.deepEqual(dirty(h), ['Time correction draft-literal'], 'Queued cancellation preserves inputs until a choice')
  h.groups.get('hr:time:draft-literal:correction').discard(); h.requests[0].commit()
  assert.deepEqual(dirty(h), [])
})

test('return reason survives rejection and accepted return clears its own group', () => {
  let accepted = false
  const h = component('HrWorkspace.tsx', 'TimeEntryActions')
  const props = { actor: manager, entry: { id: 'submitted-literal', employeeId: employee.employeeId, date: '2026-10-09', hours: 8, status: 'submitted', source: 'manual' }, employees: fixture.employees, onAction: () => accepted }
  h.render(props); change(h, 'Return reason for submitted-literal', ' Correct fictional hours '); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Return reason submitted-literal'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), [])
})

test('approval waits for the scoped return-reason decision and Keep preserves submitted time', () => {
  const unsavedController = createUnsavedWorkController()
  const h = component('HrWorkspace.tsx', 'TimeEntryActions', { unsavedController })
  let state = workflow.createMockHrState(fixture)
  const actions = []
  const props = { actor: manager, entry: state.timeEntries.find(entry => entry.id === 'time-001'), employees: fixture.employees, onAction(action) { actions.push(action); state = workflow.transitionMockHr(state, manager, action, fixture); props.entry = state.timeEntries.find(entry => entry.id === 'time-001'); return true } }
  h.render(props); change(h, 'Return reason for time-001', 'Correct the fictional hours before approval.'); h.render(props)
  click(h, 'Approve sample time')
  const pending = unsavedController.getSnapshot()
  assert.deepEqual(pending.participants.map(item => item.id), ['hr:time:time-001:return'])
  assert.equal(actions.length, 0)
  unsavedController.resolve(pending.id, 'keep-editing'); h.render(props)
  assert.equal(props.entry.status, 'submitted')
  assert.equal(field(h, 'Return reason for time-001').props.value, 'Correct the fictional hours before approval.')
  click(h, 'Approve sample time'); unsavedController.resolve(unsavedController.getSnapshot().id, 'discard'); h.render(props)
  assert.deepEqual(actions, [{ type: 'approve-time', entryId: 'time-001' }])
  assert.equal(props.entry.status, 'approved')
  assert.deepEqual(dirty(h), [])
})

test('a refused approval restores its return reason after the explicit discard decision', () => {
  const unsavedController = createUnsavedWorkController()
  const h = component('HrWorkspace.tsx', 'TimeEntryActions', { unsavedController })
  const state = workflow.createMockHrState(fixture)
  const actions = []
  const props = { actor: manager, entry: state.timeEntries.find(entry => entry.id === 'time-001'), employees: fixture.employees, onAction(action) { actions.push(action); return false } }
  h.render(props); change(h, 'Return reason for time-001', 'Preserve this fictional reason if approval fails.'); h.render(props)
  click(h, 'Approve sample time'); unsavedController.resolve(unsavedController.getSnapshot().id, 'discard'); h.render(props)
  assert.deepEqual(actions, [{ type: 'approve-time', entryId: 'time-001' }])
  assert.equal(props.entry.status, 'submitted')
  assert.equal(field(h, 'Return reason for time-001').props.value, 'Preserve this fictional reason if approval fails.')
  assert.deepEqual(dirty(h), ['Return reason time-001'])
})

test('period and rate are independent groups and failed setup retains both drafts', () => {
  let accepted = false
  const h = component('HrWorkspace.tsx', 'PayrollJourney')
  const props = { workflow: workflow.createMockHrState(fixture), fixture, actor: owner, onAction: () => accepted }
  h.render(props)
  change(h, 'Sample period start', '2026-10-01'); change(h, 'Sample period end', '2026-10-15')
  change(h, 'Fictional hourly rate (dollars)', '30.00'); change(h, 'Rate effective date', '2026-10-01')
  h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Chosen payroll period', 'Fictional hourly rate'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), ['Chosen payroll period'], 'Saving a rate must not silently accept the chosen period')
  h.render(props); click(h, 'Prepare sample payroll')
  assert.deepEqual(dirty(h), [])
})

test('changing a rate target queues only its rate fields without clearing the chosen period', () => {
  const h = component('HrWorkspace.tsx', 'PayrollJourney')
  const props = { workflow: workflow.createMockHrState(fixture), fixture, actor: owner, onAction: () => true }
  h.render(props)
  change(h, 'Sample period start', '2026-10-01'); change(h, 'Fictional hourly rate (dollars)', '30')
  h.render(props); change(h, 'Rate employee', employee.employeeId)
  assert.deepEqual(h.requests[0].options, { portal: 'hr', ids: ['hr:payroll:rate'], label: 'Change rate employee' })
  assert.deepEqual(dirty(h), ['Chosen payroll period', 'Fictional hourly rate'])
  h.groups.get('hr:payroll:rate').discard(); h.requests[0].commit()
  assert.deepEqual(dirty(h), ['Chosen payroll period'])
  h.render(props)
  assert.equal(field(h, 'Rate employee').props.value, employee.employeeId)
  assert.equal(field(h, 'Fictional hourly rate (dollars)').props.value, '')
})

test('leave submission rebases the actual dates only on acceptance', () => {
  let accepted = false
  const h = component('PeopleOperations.tsx', 'PtoContent')
  const props = { state: people.createPeopleOperations(fixture), actor: employee, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Start date', '2026-10-19'); change(h, 'End date', '2026-10-20'); h.render(props)
  submit(h, 0, { startDate: '2026-10-19', endDate: '2026-10-20', leaveType: 'vacation' })
  assert.deepEqual(dirty(h), ['Sample leave request'])
  accepted = true; submit(h, 0, { startDate: '2026-10-19', endDate: '2026-10-20', leaveType: 'vacation' })
  assert.deepEqual(dirty(h), [])
})

test('request filter is not dirty and successful request creation clears its fields', () => {
  let accepted = false
  const h = component('HrServiceDesk.tsx', 'HrServiceDesk', { RequestCard: 'RequestCard' })
  const props = { state: desk.createHrServiceDesk(fixture), actor: employee, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Request status', 'resolved')
  assert.deepEqual(dirty(h), [])
  change(h, 'Request title', ' Fictional accessory '); change(h, 'Request details', 'Fictional request details'); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['New HR request'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), [])
  h.render(props)
  assert.equal(field(h, 'Request title').props.value, '')
})

test('assignment acceptance leaves resolution dirty; rejected resolution retains its text', () => {
  let accepted = false
  const h = component('HrServiceDesk.tsx', 'RequestCard')
  const props = { request: { id: 'request-literal', employeeId: employee.employeeId, title: 'Fictional accessory', details: 'Fictional details', category: 'equipment', status: 'in-progress', assigneeId: 'hr-team', activity: [] }, actor: owner, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Request owner', manager.employeeId); change(h, 'Sample resolution', 'Fictional resolution'); h.render(props)
  click(h, 'Assign sample owner')
  assert.deepEqual(dirty(h), ['Request assignment request-literal', 'Request resolution request-literal'])
  accepted = true; click(h, 'Assign sample owner')
  assert.deepEqual(dirty(h), ['Request resolution request-literal'])
  accepted = false; click(h, 'Resolve sample request'); h.requests.at(-1).commit()
  assert.deepEqual(dirty(h), ['Request resolution request-literal'])
  accepted = true; click(h, 'Resolve sample request'); h.requests.at(-1).commit()
  assert.deepEqual(dirty(h), [])
})

test('recruiting job acceptance leaves an unrelated candidate draft dirty', () => {
  let accepted = false
  const h = component('HrRecruiting.tsx', 'HrRecruiting')
  const initial = recruiting.createRecruitingState(fixture)
  const state = recruiting.transitionRecruiting(initial, owner, { type: 'set-job-status', jobId: initial.jobs[0].id, status: 'published' }, fixture)
  const props = { state, actor: owner, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Sample job title', 'Fictional new role'); change(h, 'Fictional first name', 'Alex'); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['New recruiting job', 'New fictional candidate'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), ['New fictional candidate'])
})

function closableJobs(count = 2) {
  return { jobs: Array.from({ length: count }, (_, index) => ({ id: `job-close-${index + 1}`, title: `Fictional close example ${index + 1}`, department: 'Operations', managerId: manager.employeeId, status: 'published', activity: [] })), candidates: [], hiredEmployees: [], sequence: 0 }
}

test('closing the candidate target waits for keep/discard before rebinding or hiding applicant fields', () => {
  for (const count of [1, 2]) {
    const unsavedController = createUnsavedWorkController()
    const h = component('HrRecruiting.tsx', 'HrRecruiting', { unsavedController })
    const actions = []
    const props = { state: closableJobs(count), actor: owner, fixture, onAction(action) { actions.push(action); props.state = recruiting.transitionRecruiting(props.state, owner, action, fixture); return true } }
    h.render(props)
    change(h, 'Sample job title', 'Independent unsaved job')
    change(h, 'Fictional first name', 'Alex')
    change(h, 'Fictional candidate email', 'alex.close@example.invalid')
    h.nodes(node => node.type === 'button' && text(node) === 'Close sample job')[0].props.onClick()
    const pending = unsavedController.getSnapshot()
    assert.deepEqual(pending.participants.map(item => item.id), ['hr:recruiting:candidate'])
    assert.equal(actions.length, 0, 'No close action may run before the decision')
    assert.equal(props.state.jobs[0].status, 'published')
    unsavedController.resolve(pending.id, 'keep-editing'); h.render(props)
    assert.equal(field(h, 'Fictional first name').props.value, 'Alex')
    assert.equal(field(h, 'Published sample job').props.value, 'job-close-1')
    h.nodes(node => node.type === 'button' && text(node) === 'Close sample job')[0].props.onClick()
    unsavedController.resolve(unsavedController.getSnapshot().id, 'discard'); h.render(props)
    assert.deepEqual(actions, [{ type: 'set-job-status', jobId: 'job-close-1', status: 'closed' }])
    assert.deepEqual(dirty(h), ['New recruiting job'], 'Discard must preserve the independent job form')
    if (count === 2) {
      assert.equal(field(h, 'Published sample job').props.value, 'job-close-2')
      assert.equal(field(h, 'Fictional first name').props.value, '')
      assert.equal(field(h, 'Fictional candidate email').props.value, '')
    } else assert.equal(h.nodes(node => node.type === 'label' && text(node).startsWith('Fictional first name')).length, 0)
  }
})

test('closing another job keeps a dirty applicant on its existing target without requesting a prompt', () => {
  const unsavedController = createUnsavedWorkController()
  const h = component('HrRecruiting.tsx', 'HrRecruiting', { unsavedController })
  const props = { state: closableJobs(), actor: owner, fixture, onAction(action) { props.state = recruiting.transitionRecruiting(props.state, owner, action, fixture); return true } }
  h.render(props); change(h, 'Fictional first name', 'Alex')
  h.nodes(node => node.type === 'button' && text(node) === 'Close sample job')[1].props.onClick()
  assert.equal(h.requests.length, 0)
  assert.equal(unsavedController.getSnapshot(), null)
  assert.equal(props.state.jobs[1].status, 'closed')
  h.render(props)
  assert.equal(field(h, 'Published sample job').props.value, 'job-close-1')
  assert.equal(field(h, 'Fictional first name').props.value, 'Alex')
  assert.deepEqual(dirty(h), ['New fictional candidate'])
})

test('a clean candidate form does not block target closure when another form is dirty', () => {
  const unsavedController = createUnsavedWorkController()
  const h = component('HrRecruiting.tsx', 'HrRecruiting', { unsavedController })
  const props = { state: closableJobs(), actor: owner, fixture, onAction(action) { props.state = recruiting.transitionRecruiting(props.state, owner, action, fixture); return true } }
  h.render(props); change(h, 'Sample job title', 'Independent unsaved job')
  h.nodes(node => node.type === 'button' && text(node) === 'Close sample job')[0].props.onClick()
  assert.equal(unsavedController.getSnapshot(), null)
  assert.equal(props.state.jobs[0].status, 'closed')
  assert.deepEqual(dirty(h), ['New recruiting job'])
})

test('review save rejection retains text and accepted save establishes a trimmed baseline', () => {
  let accepted = false
  const h = component('HrPerformance.tsx', 'ReviewCard')
  const props = { review: { id: 'review-literal', employeeId: employee.employeeId, managerId: manager.employeeId, title: 'Fictional review', stage: 'draft', selfComments: '', activity: [] }, actor: employee, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Self-review draft for employee-002', ' Fictional accomplishment '); h.render(props); submit(h, 0, { comments: ' Fictional accomplishment ' })
  assert.deepEqual(dirty(h), ['Self-review draft review-literal'])
  accepted = true; submit(h, 0, { comments: ' Fictional accomplishment ' })
  assert.deepEqual(dirty(h), [])
})

test('goal numeric reversion is clean and a rejected progress save retains the draft', () => {
  let accepted = false
  const h = component('HrPerformance.tsx', 'GoalCard')
  const props = { goal: { id: 'goal-literal', employeeId: employee.employeeId, title: 'Fictional goal', progress: 20, status: 'active', activity: [] }, actor: employee, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Progress for Fictional goal', '20.0')
  assert.deepEqual(dirty(h), [])
  change(h, 'Progress for Fictional goal', '40'); h.render(props); submit(h, 0, { progress: '40' })
  assert.deepEqual(dirty(h), ['Goal progress goal-literal'])
  accepted = true; submit(h, 0, { progress: '40' })
  assert.deepEqual(dirty(h), [])
})

test('survey question/audience reversion is clean and rejected save retains changes', () => {
  let accepted = false
  const h = component('HrSurveys.tsx', 'DraftForm')
  const props = { survey: { id: 'survey-literal', title: 'Saved survey', questions: { ratingPrompt: 'Saved rating question', textPrompt: 'Saved text question' }, audienceIds: [], activity: [] }, fixture, onAction: () => accepted }
  h.render(props); change(h, 'Survey title', 'Changed title'); change(h, 'Survey title', ' Saved survey ')
  assert.deepEqual(dirty(h), [])
  const [checkbox] = h.nodes(node => node.type === 'input' && node.props.type === 'checkbox')
  checkbox.props.onChange({ target: { checked: true } }); h.render(props)
  h.nodes(node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: false } })
  assert.deepEqual(dirty(h), [])
  change(h, 'Short-text question', 'Changed fictional question'); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Survey draft survey-literal'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), [])
})

test('survey response save rejects without losing values and rebases on acceptance', () => {
  let accepted = false
  const h = component('HrSurveys.tsx', 'SurveyAnswers')
  const props = { survey: { id: 'response-literal', status: 'published', responses: [], questions: { ratingPrompt: 'Rate the fictional flow', textPrompt: 'Describe the fictional flow' } }, actor: employee, onAction: () => accepted }
  h.render(props); change(h, 'Rate the fictional flow', '4'); change(h, 'Describe the fictional flow', ' Clear fictional steps '); h.render(props); submit(h)
  assert.deepEqual(dirty(h), ['Survey response response-literal'])
  accepted = true; submit(h)
  assert.deepEqual(dirty(h), [])
})

test('source contract registers every editable HR family and keeps filter/message state outside baselines', () => {
  const expected = {
    'HrWorkspace.tsx': { TimeEntryActions: 2, TimeEntries: 2, PayrollJourney: 2, EmployeeProfile: 1 },
    'PeopleOperations.tsx': { PtoContent: 1 },
    'HrServiceDesk.tsx': { RequestCard: 2, HrServiceDesk: 1 },
    'HrRecruiting.tsx': { HrRecruiting: 2 },
    'HrPerformance.tsx': { GoalCard: 1, ReviewCard: 2, CreatePerformanceForm: 1 },
    'HrSurveys.tsx': { DraftForm: 1, SurveyAnswers: 1 },
  }
  for (const [file, functions] of Object.entries(expected)) for (const [name, count] of Object.entries(functions)) {
    const calls = []
    function visit(node) { if (ts.isCallExpression(node) && node.expression.getText().replace(/<.*>/, '') === 'useHrFormDraft') calls.push(node); ts.forEachChild(node, visit) }
    visit(declaration(file, name))
    assert.equal(calls.length, count, `${file}:${name} participant coverage`)
    for (const call of calls) {
      const options = call.arguments[0]
      assert.ok(options && ts.isObjectLiteralExpression(options))
      for (const key of ['id', 'label', 'initial']) assert.ok(options.properties.some(property => property.name?.getText() === key), `${file}:${name} missing ${key}`)
      const initial = options.properties.find(property => property.name?.getText() === 'initial')?.getText() ?? ''
      assert.doesNotMatch(initial, /\b(?:filter|query|message|selectedCandidate|jobFilter|stageFilter)\b/)
      assert.ok(ts.isVariableDeclaration(call.parent), `${file}:${name} must bind its form controller`)
      const controller = call.parent.name.getText()
      assert.ok(declaration(file, name).getText().includes(`id={${controller}.id}`), `${file}:${name} must attach the stable ${controller} group to a rendered form/control wrapper`)
    }
  }
})

test('source contract guards local identity changes and uses accepted replacement epochs for form keys', () => {
  const source = declaration('HrWorkspace.tsx', 'HrWorkspace').getText()
  assert.match(source, /label: 'Change management role'[^\n]+\(\) => setPart\('managementRole', role\)/)
  assert.match(source, /label: 'Change employee identity'[^\n]+\(\) => setPart\('selectedEmployee', employeeId\)/)
  assert.match(source, /const resetGeneration = replacementEpoch/)
  assert.match(source, /if \(result && !result\.ok\) return result/)
  assert.match(source, /resetStoredState\(confirmation\)/)
  assert.match(source, /importState\(value, confirmation\)/)
  assert.match(source, /<DemoWorkspaceReset module="hr" recovery=\{recovery\} onReset=\{reset\}/)
  assert.doesNotMatch(source, /setResetGeneration/)
  assert.match(sources.get('HrServiceDesk.tsx'), /onReveal=\{\(\) => setFilter\('all'\)\}/)
})
