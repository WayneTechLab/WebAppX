import type { HrActor, HrFixture } from './model'

export type SurveyStatus = 'draft' | 'published' | 'closed'
export type SurveyQuestions = { ratingPrompt: string; textPrompt: string }
export type SurveyResponse = { employeeId: string; rating: number; text: string; status: 'draft' | 'submitted'; receipt?: string }
export type SurveyActivity = { receipt: string; action: 'created' | 'edited' | 'published' | 'saved' | 'submitted' | 'closed'; actorRole: HrActor['role']; employeeId?: string }
export type HrSurvey = {
  id: string; title: string; status: SurveyStatus; audienceIds: string[]; questions: SurveyQuestions;
  responses: SurveyResponse[]; activity: SurveyActivity[]; receipt?: string;
}
export type SurveysState = { surveys: HrSurvey[]; sequence: number }
type DraftFields = { title: string; audienceIds: string[]; ratingPrompt: string; textPrompt: string }
export type SurveysEvent =
  | ({ type: 'create-survey' } & DraftFields)
  | ({ type: 'edit-survey'; surveyId: string } & DraftFields)
  | { type: 'publish-survey' | 'close-survey' | 'submit-survey-response'; surveyId: string }
  | { type: 'save-survey-response'; surveyId: string; rating: number; text: string }

const defaultQuestions: SurveyQuestions = {
  ratingPrompt: 'How clear are the sample onboarding next steps?',
  textPrompt: 'What would improve this fictional onboarding experience?',
}

export function createSurveysState(fixture: HrFixture): SurveysState {
  return {
    surveys: (fixture.native.surveys ?? []).map(record => ({
      id: record.id, title: String(record.title ?? 'Demo onboarding feedback'), status: 'draft',
      audienceIds: fixture.employees.map(employee => employee.id), questions: { ...defaultQuestions }, responses: [], activity: [],
    })), sequence: 0,
  }
}

export function canManageSurveys(actor: HrActor) { return ['employer-owner', 'hr-admin'].includes(actor.role) }
function knownEmployee(employeeId: string | undefined, fixture: HrFixture) { return Boolean(employeeId && fixture.employees.some(employee => employee.id === employeeId)) }

/** Every returned employee view contains only that employee's audience assignment and answers. */
export function scopedSurveys(state: SurveysState, actor: HrActor, fixture: HrFixture): HrSurvey[] {
  if (canManageSurveys(actor) || actor.role === 'auditor') return state.surveys.map(survey => ({
    ...structuredClone(survey), responses: structuredClone(survey.responses.filter(response => response.status === 'submitted')),
    activity: structuredClone(survey.activity.filter(activity => activity.action !== 'saved')),
  }))
  if (actor.role !== 'employee' || !knownEmployee(actor.employeeId, fixture)) return []
  return state.surveys.filter(survey => survey.status !== 'draft' && survey.audienceIds.includes(actor.employeeId!)).map(survey => ({
    ...structuredClone(survey), audienceIds: [actor.employeeId!],
    responses: structuredClone(survey.responses.filter(response => response.employeeId === actor.employeeId)),
    activity: structuredClone(survey.activity.filter(activity => !activity.employeeId || activity.employeeId === actor.employeeId)),
  }))
}

export function surveyAggregate(survey: HrSurvey) {
  const responses = survey.responses.filter(response => response.status === 'submitted')
  return {
    submitted: responses.length, invited: survey.audienceIds.length,
    meanRating: responses.length ? responses.reduce((sum, response) => sum + response.rating, 0) / responses.length : null,
    ratings: [1, 2, 3, 4, 5].map(rating => ({ rating, count: responses.filter(response => response.rating === rating).length })),
  }
}

export function surveySummary(state: SurveysState, actor: HrActor, fixture: HrFixture) {
  const surveys = scopedSurveys(state, actor, fixture)
  return {
    total: surveys.length, draft: surveys.filter(survey => survey.status === 'draft').length,
    published: surveys.filter(survey => survey.status === 'published').length, closed: surveys.filter(survey => survey.status === 'closed').length,
    assigned: surveys.filter(survey => survey.status !== 'draft').reduce((sum, survey) => sum + survey.audienceIds.length, 0),
    unsubmitted: surveys.filter(survey => survey.status === 'published').reduce((sum, survey) => sum + survey.audienceIds.length - surveyAggregate(survey).submitted, 0),
    submittedResponses: surveys.reduce((sum, survey) => sum + surveyAggregate(survey).submitted, 0),
  }
}

function sampleText(value: string, name: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`Enter a sample ${name}.`)
  const text = value.trim()
  if (text.length < min || text.length > max || Array.from(text).some(character => {
    const code = character.charCodeAt(0)
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
  })) throw new Error(`Use ${min}–${max} characters for the sample ${name}.`)
  return text
}

function draftFields(event: DraftFields, fixture: HrFixture) {
  if (!Array.isArray(event.audienceIds) || !event.audienceIds.length || event.audienceIds.length > 100 || event.audienceIds.some(id => typeof id !== 'string' || !knownEmployee(id, fixture)) || new Set(event.audienceIds).size !== event.audienceIds.length) throw new Error('Choose 1–100 distinct known employees for the sample survey audience.')
  return {
    title: sampleText(event.title, 'survey title', 3, 100), audienceIds: [...event.audienceIds],
    questions: { ratingPrompt: sampleText(event.ratingPrompt, 'rating question', 3, 180), textPrompt: sampleText(event.textPrompt, 'text question', 3, 180) },
  }
}

export function transitionSurveys(state: SurveysState, actor: HrActor, event: SurveysEvent, fixture: HrFixture): SurveysState {
  const next = structuredClone(state)
  const activity = (survey: HrSurvey, action: SurveyActivity['action'], employeeId?: string) => {
    next.sequence += 1
    const receipt = `MOCK-SURVEY-${String(next.sequence).padStart(4, '0')}`
    survey.activity.push({ receipt, action, actorRole: actor.role, ...(employeeId ? { employeeId } : {}) })
    return receipt
  }
  if (event.type === 'create-survey') {
    if (!canManageSurveys(actor)) throw new Error('Only an owner or HR administrator may create a sample survey.')
    if (next.surveys.length >= 20) throw new Error('This preview supports up to 20 sample surveys. Reset to start a fresh session.')
    const survey: HrSurvey = { id: `survey-local-${next.sequence + 1}`, ...draftFields(event, fixture), status: 'draft', responses: [], activity: [] }
    activity(survey, 'created')
    next.surveys.push(survey)
    return next
  }
  const survey = next.surveys.find(record => record.id === event.surveyId)
  if (!survey) throw new Error('The sample survey was not found.')
  if (['edit-survey', 'publish-survey', 'close-survey'].includes(event.type)) {
    if (!canManageSurveys(actor)) throw new Error('Only an owner or HR administrator may manage a sample survey.')
    if (event.type === 'edit-survey') {
      if (survey.status !== 'draft') throw new Error('Published survey questions and audience are fixed. Create a new sample survey for changes.')
      Object.assign(survey, draftFields(event, fixture))
      activity(survey, 'edited')
    } else if (event.type === 'publish-survey') {
      if (survey.status !== 'draft') throw new Error('Only a draft sample survey can be published.')
      draftFields({ title: survey.title, audienceIds: survey.audienceIds, ...survey.questions }, fixture)
      survey.status = 'published'
      survey.receipt = activity(survey, 'published')
    } else {
      if (survey.status !== 'published') throw new Error('Only a published sample survey can be closed.')
      survey.status = 'closed'
      survey.receipt = activity(survey, 'closed')
    }
    return next
  }
  if (event.type !== 'save-survey-response' && event.type !== 'submit-survey-response') throw new Error('Unsupported sample survey action.')
  if (actor.role !== 'employee' || !knownEmployee(actor.employeeId, fixture) || !survey.audienceIds.includes(actor.employeeId!)) throw new Error('Only an assigned employee can answer their own sample survey.')
  if ('employeeId' in event && event.employeeId !== actor.employeeId) throw new Error('The sample response must belong to the bound employee.')
  if (survey.status !== 'published') throw new Error('Only a published, open sample survey accepts answers.')
  const previous = survey.responses.find(response => response.employeeId === actor.employeeId)
  if (previous?.status === 'submitted') throw new Error('This sample response is already submitted and cannot be changed or submitted again.')
  if (event.type === 'save-survey-response') {
    if (!Number.isInteger(event.rating) || event.rating < 1 || event.rating > 5) throw new Error('Choose a whole-number sample rating from 1 to 5.')
    const text = sampleText(event.text, 'response', 3, 500)
    const response: SurveyResponse = { employeeId: actor.employeeId!, rating: event.rating, text, status: 'draft' }
    if (previous) Object.assign(previous, response)
    else survey.responses.push(response)
    activity(survey, 'saved', actor.employeeId)
  } else {
    if (!previous) throw new Error('Save your sample answers before submitting the survey.')
    previous.status = 'submitted'
    previous.receipt = activity(survey, 'submitted', actor.employeeId)
  }
  return next
}
