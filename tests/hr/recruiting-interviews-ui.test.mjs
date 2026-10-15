import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
const helperSource = readFileSync(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const helperAst = ts.createSourceFile('helpers.ts', helperSource, ts.ScriptTarget.Latest, true)
const helpers = new Function(helperAst.statements.filter(node => ts.isFunctionDeclaration(node) && ['createHrFormDraft', 'normalizeHrFormValue'].includes(node.name?.text)).map(node => compile(node.getText()).replace(/^export /gm, '')).join('\n') + '\nreturn {createHrFormDraft,normalizeHrFormValue}')()
const sources = Object.fromEntries(['HrRecruitingInterviews', 'HrRecruitingOwnScorecards'].map(name => [name, readFileSync(new URL(`../../src/hr/components/${name}.tsx`, import.meta.url), 'utf8')]))

/** Exercise actual JSX callback closures and synchronous draft refs with narrow
 * test ports. This is component logic evidence, not browser/focus evidence. */
function harness(file, component) {
  const slots = [], groups = new Map(), requests = [], focused = []
  let cursor = 0, tree, currentProps
  const dependencies = {
    ...helpers,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useUnsavedWork(group) { groups.set(group.id, group) },
    useUnsavedTransition: () => (options, commit) => { requests.push({ options, commit }); return false },
    focusHrForm: id => focused.push(id),
    React: { createElement(type, props, ...children) { return { type, props: { ...props, children } } } },
  }
  const compiled = compile(sources[file]).replace(/^import .*;\n/gm, '').replace(/^export /gm, '')
  const run = new Function(...Object.keys(dependencies), `${compiled}\nreturn ${component}`)(...Object.values(dependencies))
  const ui = {
    groups, requests, focused,
    render(props = currentProps) { currentProps = props; cursor = 0; groups.clear(); tree = run(props); return tree },
    nodes(predicate) { const result = []; const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(node.props?.children) }; visit(tree); return result },
    change(label, value) { input(ui, label).props.onChange({ target: { value } }); ui.render() },
    click(label) { const node = ui.nodes(node => node.type === 'button' && text(node) === label)[0]; assert.ok(node, label); node.props.onClick(); ui.render() },
    submit() { const form = ui.nodes(node => node.type === 'form')[0]; assert.ok(form); form.props.onSubmit({ preventDefault() {} }); ui.render() },
    text: () => text(tree),
  }
  return ui
}
function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node) }
function input(ui, label) {
  const parent = ui.nodes(node => node.type === 'label' && text(node).startsWith(label))[0]
  assert.ok(parent, label)
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value && typeof value === 'object' ? ['input', 'select', 'textarea'].includes(value.type) ? [value] : visit(value.props?.children) : []
  return visit(parent.props.children)[0]
}
const instant = '2026-10-15T09:00:00.000Z'
const initialInterview = () => ({ id: 'rinterview-0001', startAt: '2026-10-20T15:00:00.000Z', timeZone: 'UTC', durationMinutes: 60, candidate: { displayName: 'Devon Sample' }, application: { id: 'rapplication-0001', stage: 'interview' }, job: { id: 'job-sample', title: 'Fictional researcher' }, ownScorecard: null, lastOwnRecordedAt: null, ownHistory: [] })
const draftId = 'hr:recruiting:scorecard:employee-001:rinterview-0001'
const content = { rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 4, collaboration: 3, problemSolving: 5 }, comments: 'Saved fictional comments' }
function ownWork(interview = initialInterview()) {
  let revision = 1, pending = null, accepted = 0, counter = 0
  const commands = [], confirmations = [], cancelled = []
  const port = {
    view: () => ({ mode: 'interviewer', employeeId: 'employee-001', assignedInterviews: [interview] }),
    preview(command) {
      commands.push(structuredClone(command))
      const preview = { kind: command.kind, interviewId: interview.id, applicationId: interview.application.id, authorEmployeeId: 'employee-001', content: command.kind === 'save-scorecard' ? { ...command.content, comments: command.content.comments.trim() } : structuredClone(interview.ownScorecard.content), recordedAt: command.recordedAt, ownChronologyFloor: interview.lastOwnRecordedAt, previousRevision: interview.ownScorecard?.revision ?? null, proposedRevision: command.kind === 'save-scorecard' ? (interview.ownScorecard?.revision ?? 0) + 1 : interview.ownScorecard.revision, proposedState: command.kind === 'save-scorecard' ? 'draft' : 'submitted', ...(command.kind === 'submit-scorecard' ? { scorecardId: command.scorecardId, draftRevision: command.expectedRevision } : {}) }
      pending = { revision, handle: `opaque-own-${++counter}`, preview }
      return { ok: true, handle: pending.handle, preview }
    },
    confirm(request) {
      confirmations.push(structuredClone(request))
      if (!pending || pending.handle !== request.handle || pending.revision !== revision) return { ok: false, code: 'stale', message: 'This recruiting preview expired or changed. Preview again; your inputs are kept.' }
      accepted++
      interview.ownScorecard = { id: 'rscorecard-e0387eda02bea9a6', revision: pending.preview.proposedRevision, state: pending.preview.proposedState, content: structuredClone(pending.preview.content) }
      interview.lastOwnRecordedAt = pending.preview.recordedAt
      return { ok: true, feedback: 'Accepted in memory. Browser save is unavailable; export this workspace.', view: port.view() }
    },
    cancel(handle) { cancelled.push(handle); if (pending?.handle === handle) pending = null },
  }
  return { port, commands, confirmations, cancelled, interview, props: () => ({ interview, employeeId: 'employee-001', port }), changeSource() { revision++ }, get accepted() { return accepted } }
}
function fillOwn(ui, comments = '  Own fictional comments  ') {
  ui.change('Role understanding', '4'); ui.change('Collaboration', '3'); ui.change('Problem solving', '5')
  ui.change('Fictional scorecard comments', comments); ui.change('Scorecard recorded time in UTC', instant)
}

test('own stale confirmation retains exact raw fields; accepted memory rebase is synchronously clean despite storage warning', () => {
  const work = ownWork(), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm')
  ui.render(work.props()); fillOwn(ui); ui.submit()
  assert.equal(work.accepted, 0)
  assert.equal(ui.text().includes('opaque-own-1'), false)
  work.changeSource(); ui.click('Confirm own draft save')
  assert.equal(work.accepted, 0); assert.equal(input(ui, 'Fictional scorecard comments').props.value, '  Own fictional comments  ')
  assert.equal(ui.groups.get(draftId).isDirty(), true)
  assert.match(ui.text(), /expired or changed/)
  ui.submit()
  const confirm = ui.nodes(node => node.type === 'button' && text(node) === 'Confirm own draft save')[0]
  confirm.props.onClick()
  assert.equal(ui.groups.get(draftId).isDirty(), false, 'no render/effect needed before a following navigation')
  ui.render(work.props())
  assert.equal(work.accepted, 1); assert.equal(input(ui, 'Fictional scorecard comments').props.value, 'Own fictional comments')
  assert.match(ui.text(), /Browser save is unavailable/)
  assert.deepEqual(work.confirmations[1], { kind: 'save-scorecard', handle: 'opaque-own-2' })
})

test('own input edits, cancel and discard invalidate pending handles without accepting an action', () => {
  const work = ownWork(), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm')
  ui.render(work.props()); fillOwn(ui); ui.submit()
  const oldConfirm = ui.nodes(node => node.type === 'button' && text(node) === 'Confirm own draft save')[0].props.onClick
  ui.change('Fictional scorecard comments', 'Changed after preview')
  assert.deepEqual(work.cancelled, ['opaque-own-1']); oldConfirm(); assert.equal(work.confirmations.length, 0)
  ui.submit(); ui.click('Cancel scorecard preview')
  assert.equal(input(ui, 'Fictional scorecard comments').props.value, 'Changed after preview')
  ui.submit(); ui.groups.get(draftId).discard(); oldConfirm(); ui.render()
  assert.equal(work.accepted, 0); assert.equal(ui.groups.get(draftId).isDirty(), false)
  assert.equal(input(ui, 'Fictional scorecard comments').props.value, '')
})

test('actual own participant refuses retention across shell exits while Keep and discard remain scoped', () => {
  const work = ownWork(), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm')
  ui.render(work.props()); fillOwn(ui, 'Unsaved private comments')
  const participant = ui.groups.get(draftId)
  assert.equal(participant.canRetain, false, 'The shell unmounts after an approved exit, so its own private buffer cannot promise retention')
  assert.equal(participant.isDirty(), true)
  assert.equal(input(ui, 'Fictional scorecard comments').props.value, 'Unsaved private comments', 'Leaving undecided/Keep does not call discard')
  ui.submit(); const preview = work.commands.length
  assert.equal(ui.groups.get(draftId).canRetain, false, 'A pending confirmation also forbids a retention offer')
  ui.groups.get(draftId).discard(); ui.render()
  assert.equal(work.accepted, 0); assert.equal(work.commands.length, preview)
  assert.equal(ui.groups.get(draftId).isDirty(), false); assert.equal(input(ui, 'Fictional scorecard comments').props.value, '')
  assert.deepEqual(work.cancelled, ['opaque-own-1'])
})

test('two actual own interview cards for one candidate expose distinct semantic article labels', () => {
  const labels = []
  for (const id of ['rinterview-0001', 'rinterview-0002']) {
    const interview = initialInterview(); interview.id = id; interview.candidate.displayName = 'Casey Fiction'
    const work = ownWork(interview), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm')
    ui.render(work.props())
    const article = ui.nodes(node => node.type === 'article')[0]
    assert.ok(ui.text().includes(`Interview ${id}`), 'The scoping identifier must also remain visible text')
    labels.push(article.props['aria-label'])
  }
  assert.deepEqual(labels, ['Own scorecard for Casey Fiction · interview rinterview-0001', 'Own scorecard for Casey Fiction · interview rinterview-0002'])
  assert.equal(new Set(labels).size, 2)
})

test('submission targets the exact saved own revision and cannot silently replace dirty rubric/comments', () => {
  const interview = initialInterview(); interview.ownScorecard = { id: 'own-saved-card', revision: 2, state: 'draft', content: structuredClone(content) }; interview.lastOwnRecordedAt = instant
  const work = ownWork(interview), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm'); ui.render(work.props())
  ui.change('Fictional scorecard comments', 'Unsaved new text'); ui.click('Preview scorecard submission')
  assert.equal(work.commands.length, 0); assert.match(ui.text(), /Save your scorecard changes or discard/)
  ui.click('Discard scorecard changes'); ui.change('Scorecard recorded time in UTC', instant); ui.click('Preview scorecard submission')
  assert.deepEqual(work.commands, [{ kind: 'submit-scorecard', scorecardId: 'own-saved-card', expectedRevision: 2, recordedAt: instant }])
  ui.click('Confirm scorecard submission'); ui.render(work.props())
  assert.equal(work.accepted, 1); assert.equal(interview.ownScorecard.revision, 2); assert.equal(interview.ownScorecard.state, 'submitted')
  assert.equal(ui.nodes(node => node.type === 'textarea').length, 0)
  assert.equal(ui.groups.get(draftId).isDirty(), false)
})

test('own unexpected exceptions never render private exception messages and retain fields', () => {
  const work = ownWork(); work.port.preview = () => { throw new Error('SECRET other author draft') }
  const ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm'); ui.render(work.props()); fillOwn(ui); ui.submit()
  assert.equal(ui.text().includes('SECRET'), false); assert.match(ui.text(), /preview is unavailable/)
  assert.equal(input(ui, 'Fictional scorecard comments').props.value, '  Own fictional comments  ')
})

test('normalized reversion is clean and the own component accepts only a narrow DTO/port boundary', () => {
  const interview = initialInterview(); interview.ownScorecard = { id: 'own-saved-card', revision: 1, state: 'draft', content: structuredClone(content) }
  const work = ownWork(interview), ui = harness('HrRecruitingOwnScorecards', 'OwnScorecardForm'); ui.render(work.props())
  ui.change('Fictional scorecard comments', 'Changed'); assert.equal(ui.groups.get(draftId).isDirty(), true)
  ui.change('Fictional scorecard comments', '  Saved fictional comments  '); assert.equal(ui.groups.get(draftId).isDirty(), false)
  const ast = ts.createSourceFile('own.tsx', sources.HrRecruitingOwnScorecards, ts.ScriptTarget.Latest, true)
  const props = ast.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'Props').getText()
  assert.match(props, /view: Extract<ScopedRecruitingView/); assert.match(props, /port: RecruitingInterviewerPort/)
  assert.equal(/HrDemoState|HrFixture|replaceCurrent|readCurrent|JSON\.stringify|error\.message/.test(sources.HrRecruitingOwnScorecards), false)
})

test('schedule callbacks retain failed inputs, cancel stale previews on edits and clear only accepted memory work', () => {
  const commands = [], cancelled = []; let refuse = true, accepted = 0
  const port = {
    preview(command) { commands.push(structuredClone(command)); return { ok: true, handle: 'opaque-schedule', preview: { kind: 'schedule-interview', recordedAt: command.recordedAt, interview: { id: 'rinterview-0001', startAt: command.startAt, timeZone: command.timeZone, durationMinutes: command.durationMinutes, participants: [{ employeeId: 'employee-001', displayName: 'Alex Sample' }] } } } },
    confirm() { if (refuse) return { ok: false, code: 'stale', message: 'Preview source changed.' }; accepted++; return { ok: true, feedback: 'Sample interview accepted in memory.' } },
    cancel(handle) { cancelled.push(handle) },
  }
  const ui = harness('HrRecruitingInterviews', 'InterviewScheduleForm')
  ui.render({ applicationId: 'rapplication-0001', port, participantChoices: [{ employeeId: 'employee-001', displayName: 'Alex Sample' }] })
  ui.change('Interview start in UTC', '2026-10-20T15:00:00.000Z'); ui.change('Schedule recorded time in UTC', instant)
  input(ui, 'Alex Sample').props.onChange({ target: { checked: true } }); ui.render(); ui.submit()
  assert.deepEqual(commands[0], { kind: 'schedule-interview', applicationId: 'rapplication-0001', participantEmployeeIds: ['employee-001'], startAt: '2026-10-20T15:00:00.000Z', timeZone: 'UTC', durationMinutes: 60, recordedAt: instant })
  assert.equal(ui.text().includes('opaque-schedule'), false)
  ui.click('Confirm sample interview'); assert.equal(accepted, 0); assert.equal(input(ui, 'Interview start in UTC').props.value, '2026-10-20T15:00:00.000Z')
  ui.submit(); ui.change('Interview duration in minutes', '45'); assert.equal(cancelled.length, 2)
  ui.submit(); refuse = false; ui.click('Confirm sample interview')
  assert.equal(accepted, 1); assert.equal(ui.groups.get('hr:recruiting:interview:rapplication-0001').isDirty(), false)
  assert.equal(input(ui, 'Interview start in UTC').props.value, '')
})

test('changing schedule application uses the scoped dirty decision; terminal changes retain the mounted target', () => {
  const ui = harness('HrRecruitingInterviews', 'HrRecruitingInterviews')
  const view = { mode: 'management', applications: [{ id: 'app-a', personId: 'person-a', jobId: 'job-a', stage: 'interview' }, { id: 'app-b', personId: 'person-a', jobId: 'job-a', stage: 'offer' }], people: [{ id: 'person-a', firstName: 'Devon', lastName: 'Sample' }], jobs: [{ id: 'job-a', title: 'Fictional role' }], interviews: [], submittedScorecards: [] }
  const props = { view, port: {}, participantChoices: [] }; ui.render(props)
  input(ui, 'Interview application').props.onChange({ target: { value: 'app-b' } }); ui.render()
  assert.deepEqual(ui.requests[0].options, { portal: 'hr', ids: ['hr:recruiting:interview:app-a'], label: 'Change interview application' })
  const mounted = () => ui.nodes(node => typeof node.type === 'function' && node.type.name === 'InterviewScheduleForm')[0]
  assert.equal(mounted().props.applicationId, 'app-a', 'queued/Keep does not rebind a form')
  view.applications[0].stage = 'withdrawn'; ui.render(props)
  assert.equal(mounted().props.applicationId, 'app-a'); assert.match(ui.text(), /temporary schedule is kept/)
  ui.requests[0].commit(); ui.render()
  assert.equal(mounted().props.applicationId, 'app-b')
})
