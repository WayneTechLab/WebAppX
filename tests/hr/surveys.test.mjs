import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hr/surveys.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const surveys = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const hr = { role: 'hr-admin' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const jordan = { role: 'employee', employeeId: 'employee-003' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const auditor = { role: 'auditor' }
const draft = { title: 'Demo team feedback', audienceIds: [avery.employeeId, jordan.employeeId], ratingPrompt: 'Rate the sample experience', textPrompt: 'Describe a fictional improvement' }
const change = (state, event, actor = owner, data = fixture) => surveys.transitionSurveys(state, actor, event, data)
const seed = () => surveys.createSurveysState(fixture)
const id = state => state.surveys[0].id
const open = () => { const state = seed(); return change(state, { type: 'publish-survey', surveyId: id(state) }) }
const save = (state, actor = avery, rating = 4, text = 'A fictional welcome checklist would help.') => change(state, { type: 'save-survey-response', surveyId: id(state), rating, text }, actor)
const submit = (state, actor = avery) => change(state, { type: 'submit-survey-response', surveyId: id(state) }, actor)

test('survey seeds stay draft and expose no draft title, question or audience to employee previews', () => {
  const state = seed()
  assert.equal(state.surveys[0].status, 'draft')
  assert.equal(state.surveys[0].responses.length, 0)
  for (const actor of [avery, jordan, manager, { role: 'payroll-admin' }, { role: 'contractor' }, { role: 'employee', employeeId: 'unknown' }]) assert.deepEqual(surveys.scopedSurveys(state, actor, fixture), [])
  assert.equal(surveys.scopedSurveys(state, auditor, fixture).length, 1)
  assert.equal(surveys.surveySummary(state, avery, fixture).total, 0)
})

test('only owner and HR may create, edit, publish and close surveys; auditors are read-only', () => {
  const state = seed()
  for (const actor of [avery, manager, auditor, { role: 'payroll-admin' }, { role: 'contractor' }]) {
    assert.throws(() => change(state, { type: 'create-survey', ...draft }, actor), /Only an owner or HR/)
    assert.throws(() => change(state, { type: 'edit-survey', surveyId: id(state), ...draft }, actor), /Only an owner or HR/)
    assert.throws(() => change(state, { type: 'publish-survey', surveyId: id(state) }, actor), /Only an owner or HR/)
    assert.throws(() => change(open(), { type: 'close-survey', surveyId: id(state) }, actor), /Only an owner or HR/)
  }
  assert.equal(change(state, { type: 'create-survey', ...draft }, hr).surveys.length, 2)
})

test('draft editing validates bounded questions, titles and distinct known audiences', () => {
  let state = seed()
  for (const values of [
    { ...draft, title: '' }, { ...draft, title: 'x'.repeat(101) }, { ...draft, ratingPrompt: 'x' }, { ...draft, textPrompt: 'x'.repeat(181) },
    { ...draft, audienceIds: [] }, { ...draft, audienceIds: ['unknown'] }, { ...draft, audienceIds: [avery.employeeId, avery.employeeId] },
    { ...draft, title: 'Bad\u0000title' },
  ]) assert.throws(() => change(state, { type: 'create-survey', ...values }))
  state = change(state, { type: 'edit-survey', surveyId: id(state), ...draft, title: '  Edited demo feedback  ' })
  assert.equal(state.surveys[0].title, 'Edited demo feedback')
  assert.deepEqual(state.surveys[0].audienceIds, draft.audienceIds)
  assert.equal(state.surveys[0].activity.at(-1).action, 'edited')
})

test('publication freezes saved questions and audience and does not silently enroll a later hire', () => {
  let state = change(seed(), { type: 'edit-survey', surveyId: id(seed()), ...draft, audienceIds: [avery.employeeId] })
  state = change(state, { type: 'publish-survey', surveyId: id(state) })
  assert.equal(state.surveys[0].receipt, 'MOCK-SURVEY-0002')
  assert.throws(() => change(state, { type: 'edit-survey', surveyId: id(state), ...draft }), /fixed/)
  assert.throws(() => change(state, { type: 'publish-survey', surveyId: id(state) }), /Only a draft/)
  const expanded = structuredClone(fixture)
  expanded.employees.push({ ...expanded.employees[1], id: 'employee-new', firstName: 'New' })
  assert.deepEqual(surveys.scopedSurveys(state, { role: 'employee', employeeId: 'employee-new' }, expanded), [])
  assert.deepEqual(surveys.scopedSurveys(state, jordan, fixture), [])
})

test('employee saved drafts are private, excluded from results and cannot be overwritten by another identity', () => {
  let state = save(open())
  const own = surveys.scopedSurveys(state, avery, fixture)[0]
  assert.equal(own.responses[0].text, 'A fictional welcome checklist would help.')
  assert.deepEqual(own.audienceIds, [avery.employeeId])
  assert.deepEqual(surveys.scopedSurveys(state, jordan, fixture)[0].responses, [])
  for (const actor of [owner, hr, auditor]) {
    const view = surveys.scopedSurveys(state, actor, fixture)[0]
    assert.deepEqual(view.responses, [])
    assert.equal(view.activity.some(activity => activity.action === 'saved'), false)
    assert.equal(surveys.surveyAggregate(view).submitted, 0)
  }
  assert.throws(() => change(state, { type: 'save-survey-response', surveyId: id(state), employeeId: jordan.employeeId, rating: 3, text: 'Other employee answer' }, avery), /bound employee/)
  state = save(state, jordan, 2, 'A different fictional response.')
  assert.equal(state.surveys[0].responses.length, 2)
  assert.equal(surveys.scopedSurveys(state, avery, fixture)[0].responses.length, 1)
})

test('only assigned, known employee actors may answer; managerial and administrative roles cannot impersonate a respondent', () => {
  const state = open()
  for (const actor of [owner, hr, auditor, manager, { role: 'employee' }, { role: 'employee', employeeId: 'unknown' }]) assert.throws(() => save(state, actor), /Only an assigned employee/)
  assert.throws(() => save(seed()), /published, open/)
  let limited = change(seed(), { type: 'edit-survey', surveyId: id(seed()), ...draft, audienceIds: [avery.employeeId] })
  limited = change(limited, { type: 'publish-survey', surveyId: id(limited) })
  assert.throws(() => save(limited, jordan), /Only an assigned employee/)
})

test('response saving rejects invalid, empty or oversized ratings and text while leaving the previous state intact', () => {
  const state = open()
  for (const rating of [0, 6, 2.5, Number.NaN, '', undefined, '4']) assert.throws(() => change(state, { type: 'save-survey-response', surveyId: id(state), rating, text: 'Fictional answer.' }, avery), /whole-number/)
  for (const text of ['', '  ', 'x', 'x'.repeat(501), 'Bad\u0001answer']) assert.throws(() => save(state, avery, 4, text), /characters/)
  assert.equal(state.sequence, 1)
  assert.deepEqual(state.surveys[0].responses, [])
})

test('submission requires saved answers, records one identified receipt and locks the submitted response against replay or editing', () => {
  let state = open()
  assert.throws(() => submit(state), /Save your sample answers/)
  state = save(state)
  state = save(state, avery, 5, 'Revised fictional answer before submission.')
  state = submit(state)
  const response = state.surveys[0].responses[0]
  assert.equal(response.status, 'submitted')
  assert.equal(response.receipt, 'MOCK-SURVEY-0004')
  assert.throws(() => submit(state), /already submitted/)
  assert.throws(() => save(state), /already submitted/)
  assert.equal(surveys.scopedSurveys(state, owner, fixture)[0].responses[0].employeeId, avery.employeeId)
  assert.deepEqual(surveys.scopedSurveys(state, jordan, fixture)[0].responses, [])
})

test('closing preserves submitted results and excludes pending drafts while preventing further response or close replay', () => {
  let state = submit(save(open(), avery, 5, 'A clear fictional example.'))
  state = save(state, jordan, 1, 'A saved but unsubmitted answer.')
  state = change(state, { type: 'close-survey', surveyId: id(state) })
  assert.equal(state.surveys[0].status, 'closed')
  assert.equal(surveys.surveyAggregate(state.surveys[0]).submitted, 1)
  assert.equal(surveys.surveyAggregate(state.surveys[0]).meanRating, 5)
  assert.throws(() => submit(state, jordan), /published, open/)
  assert.throws(() => save(state, jordan), /published, open/)
  assert.throws(() => change(state, { type: 'close-survey', surveyId: id(state) }), /Only a published/)
  assert.equal(surveys.scopedSurveys(state, jordan, fixture)[0].responses[0].status, 'draft')
  assert.equal(surveys.scopedSurveys(state, owner, fixture)[0].responses.length, 1)
})

test('dashboard summaries scope pending assignments and identified aggregates to each role', () => {
  let state = open()
  assert.equal(surveys.surveySummary(state, owner, fixture).unsubmitted, 3)
  assert.equal(surveys.surveySummary(state, avery, fixture).unsubmitted, 1)
  state = submit(save(state, avery, 5, 'A helpful fictional experience.'))
  state = submit(save(state, jordan, 3, 'A neutral fictional experience.'), jordan)
  assert.equal(surveys.surveySummary(state, owner, fixture).submittedResponses, 2)
  assert.equal(surveys.surveySummary(state, owner, fixture).unsubmitted, 1)
  assert.equal(surveys.surveySummary(state, avery, fixture).unsubmitted, 0)
  assert.equal(surveys.surveySummary(state, avery, fixture).submittedResponses, 1)
  assert.equal(surveys.surveySummary(state, manager, fixture).total, 0)
  const aggregate = surveys.surveyAggregate(surveys.scopedSurveys(state, owner, fixture)[0])
  assert.equal(aggregate.meanRating, 4)
  assert.deepEqual(aggregate.ratings.map(row => row.count), [0, 0, 1, 0, 1])
  state = change(state, { type: 'close-survey', surveyId: id(state) })
  assert.equal(surveys.surveySummary(state, owner, fixture).unsubmitted, 0)
})

test('transitions and scoped views preserve the original state and cannot mutate other identities by reference', () => {
  const previous = seed()
  const state = change(previous, { type: 'publish-survey', surveyId: id(previous) })
  assert.equal(previous.surveys[0].status, 'draft')
  const own = surveys.scopedSurveys(state, avery, fixture)[0]
  own.questions.ratingPrompt = 'Changed externally'
  own.audienceIds.push(jordan.employeeId)
  assert.notEqual(state.surveys[0].questions.ratingPrompt, own.questions.ratingPrompt)
  assert.equal(state.surveys[0].audienceIds.length, 3)
  assert.throws(() => change(state, { type: 'delete-survey', surveyId: id(state) }, owner), /Unsupported/)
  assert.throws(() => change(state, { type: 'publish-survey', surveyId: 'unknown' }), /not found/)
})
