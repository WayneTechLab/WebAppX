import type {
  EventBase, InterviewCommand, InterviewEvent, RecruitingDomainHandler,
  RecruitingLifecycleV1, RecruitingPlanContext, RecruitingReplayContext, ScorecardContent,
} from './recruiting-lifecycle-types'
import {
  assert, assertRecruitingActor, copyRecruiting, exactKeys, isRecruitingManager,
  nextRecruitingId, recruitingId, recruitingInstant, recruitingInteger, refuse,
  RECRUITING_LIMITS, sameRecruitingValue,
} from './recruiting-lifecycle-value'

function unavailable(): never { return refuse('This recruiting action is unavailable.', 'unavailable') }
type Rules = Pick<RecruitingReplayContext, 'knownEmployeeIds' | 'isTimeZoneSupported'>

function rubric(value: unknown): ScorecardContent {
  exactKeys(value, ['rubricVersion', 'ratings', 'comments'])
  assert(value.rubricVersion === 'sample-interview-v1')
  exactKeys(value.ratings, ['roleUnderstanding', 'collaboration', 'problemSolving'])
  for (const rating of Object.values(value.ratings)) recruitingInteger(rating, 1, 5)
  assert(typeof value.comments === 'string')
  const comments = value.comments.trim()
  assert(comments.length >= 3 && comments.length <= 2000 && !Array.from(comments).some(character => { const code = character.charCodeAt(0); return code < 32 && ![9, 10, 13].includes(code) || code === 127 }), 'Use 3–2000 characters for fictional scorecard comments.')
  return { rubricVersion: 'sample-interview-v1', ratings: {
    roleUnderstanding: value.ratings.roleUnderstanding as number,
    collaboration: value.ratings.collaboration as number,
    problemSolving: value.ratings.problemSolving as number,
  }, comments }
}

function zone(value: unknown, supported: Rules['isTimeZoneSupported']) {
  assert(typeof value === 'string' && value.length <= 100 && (value === 'UTC' || /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) && !/^Etc\/GMT[+-]/.test(value), 'Choose UTC or a supported named time zone, not a numeric offset.')
  let valid = false
  try { valid = supported(value) } catch { /* A failed zone adapter never accepts a schedule. */ }
  assert(valid, 'Choose a supported named time zone.')
  return value
}

function envelope(event: EventBase, rules: Rules) {
  recruitingId(event.id)
  recruitingInteger(event.sequence, 1, Number.MAX_SAFE_INTEGER)
  recruitingInstant(event.recordedAt)
  assertRecruitingActor(event.actor, rules.knownEmployeeIds)
}

function author(event: EventBase, rules: Rules) {
  assertRecruitingActor(event.actor, rules.knownEmployeeIds)
  if (event.actor.mode !== 'interviewer') unavailable()
  return event.actor.employeeId
}

function assigned(lifecycle: RecruitingLifecycleV1, interviewId: string, employeeId: string) {
  // Lookup only in the author's authorized index. Unknown and foreign IDs agree.
  const interview = lifecycle.interviews.filter(item => item.participantEmployeeIds.includes(employeeId)).find(item => item.id === interviewId)
  if (!interview) unavailable()
  return interview
}

function ownCard(lifecycle: RecruitingLifecycleV1, interviewId: string, employeeId: string) {
  const cards = lifecycle.scorecards.filter(item => item.interviewId === interviewId && item.authorEmployeeId === employeeId)
  assert(cards.length <= 1)
  return cards[0]
}

function ownTime(previous: string | undefined, recordedAt: string) {
  recruitingInstant(recordedAt)
  if (previous !== undefined) {
    recruitingInstant(previous)
    assert(recordedAt >= previous, 'Choose a recorded time at or after your previous scorecard action for this interview.')
  }
}

/** The ID depends only on the assigned interview/author pair, never draft counts.
 * This is an ordinary deterministic identifier, not a credential, secrecy hash
 * or preview token. UTF-8 encoding also keeps long legacy identities bounded. */
function scorecardId(interviewId: string, employeeId: string) {
  let value = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(JSON.stringify([interviewId, employeeId]))) value = BigInt.asUintN(64, (value ^ BigInt(byte)) * 0x100000001b3n)
  return `rscorecard-${value.toString(16).padStart(16, '0')}`
}

function schedule(command: Extract<InterviewCommand, { kind: 'schedule-interview' }>, base: EventBase, lifecycle: RecruitingLifecycleV1, rules: Rules): InterviewEvent {
  if (!isRecruitingManager(base.actor)) unavailable()
  exactKeys(command, ['kind', 'applicationId', 'participantEmployeeIds', 'startAt', 'timeZone', 'durationMinutes', 'recordedAt'])
  recruitingId(command.applicationId, 200)
  const application = lifecycle.applications.find(item => item.id === command.applicationId)
  assert(application && !['hired', 'rejected', 'withdrawn'].includes(application.stage), 'Choose a current nonterminal application before scheduling an interview.')
  assert(lifecycle.jobs.some(item => item.id === application.jobId))
  assert(Array.isArray(command.participantEmployeeIds) && command.participantEmployeeIds.length >= 1 && command.participantEmployeeIds.length <= 5, 'Choose 1–5 fictional interview participants.')
  assert(new Set(command.participantEmployeeIds).size === command.participantEmployeeIds.length)
  for (const id of command.participantEmployeeIds) { recruitingId(id, 200); assert(rules.knownEmployeeIds.has(id), 'Choose known fictional interview participants.') }
  recruitingInstant(command.startAt)
  recruitingInteger(command.durationMinutes, 15, 240)
  const timeZone = zone(command.timeZone, rules.isTimeZoneSupported)
  if (lifecycle.interviews.length >= RECRUITING_LIMITS.interviews || lifecycle.interviews.filter(item => item.applicationId === application.id).length >= RECRUITING_LIMITS.interviewsPerApplication) refuse('This local workspace has reached its capacity. No records were changed.', 'limit')
  return { ...base, kind: 'interview-scheduled', applicationId: application.id, interview: {
    id: nextRecruitingId('rinterview', lifecycle.interviews), applicationId: application.id,
    participantEmployeeIds: [...command.participantEmployeeIds], startAt: command.startAt,
    timeZone, durationMinutes: command.durationMinutes, createdEventId: base.id,
  } }
}

function save(command: Extract<InterviewCommand, { kind: 'save-scorecard' }>, base: EventBase, lifecycle: RecruitingLifecycleV1, rules: Rules): InterviewEvent {
  const employeeId = author(base, rules)
  exactKeys(command, ['kind', 'interviewId', 'expectedRevision', 'content', 'recordedAt'])
  const interview = assigned(lifecycle, command.interviewId, employeeId)
  const previous = ownCard(lifecycle, interview.id, employeeId)
  assert(command.expectedRevision === (previous?.revision ?? null), 'Your saved scorecard changed. Review it and preview again.')
  assert(!previous || previous.state === 'draft', 'Submitted scorecards are immutable in this local preview.')
  ownTime(previous?.lastOwnRecordedAt, command.recordedAt)
  const content = rubric(command.content)
  assert(!previous || !sameRecruitingValue(previous.content, content), 'Change the fictional scorecard before saving another draft revision.')
  const revision = (previous?.revision ?? 0) + 1
  recruitingInteger(revision, 1, 1000)
  if (!previous && lifecycle.scorecards.length >= RECRUITING_LIMITS.scorecards) refuse('This local workspace has reached its capacity. No records were changed.', 'limit')
  const id = previous?.id ?? scorecardId(interview.id, employeeId)
  assert(previous || !lifecycle.scorecards.some(item => item.id === id), 'This local scorecard identity is unavailable.')
  return { ...base, kind: 'scorecard-saved', applicationId: interview.applicationId, previousRevision: previous?.revision ?? null, scorecard: {
    id, interviewId: interview.id, applicationId: interview.applicationId, authorEmployeeId: employeeId,
    revision, content, state: 'draft', latestDraftEventId: base.id, lastOwnRecordedAt: base.recordedAt, submittedEventId: null,
  } }
}

function submit(command: Extract<InterviewCommand, { kind: 'submit-scorecard' }>, base: EventBase, lifecycle: RecruitingLifecycleV1, rules: Rules): InterviewEvent {
  const employeeId = author(base, rules)
  exactKeys(command, ['kind', 'scorecardId', 'expectedRevision', 'recordedAt'])
  const card = lifecycle.scorecards.filter(item => item.authorEmployeeId === employeeId && lifecycle.interviews.some(interview => interview.id === item.interviewId && interview.participantEmployeeIds.includes(employeeId))).find(item => item.id === command.scorecardId)
  if (!card) unavailable()
  assigned(lifecycle, card.interviewId, employeeId)
  assert(card.state === 'draft', 'Submitted scorecards are immutable in this local preview.')
  assert(command.expectedRevision === card.revision, 'Your saved scorecard changed. Review it and preview again.')
  ownTime(card.lastOwnRecordedAt, command.recordedAt)
  const draft = lifecycle.events.find(event => event.id === card.latestDraftEventId)
  assert(draft?.kind === 'scorecard-saved' && draft.actor.mode === 'interviewer' && draft.actor.employeeId === employeeId && sameRecruitingValue(draft.scorecard, card) && draft.sequence < base.sequence, 'Review a valid current own saved draft before submitting.')
  assert(sameRecruitingValue(rubric(card.content), card.content))
  return { ...base, kind: 'scorecard-submitted', applicationId: card.applicationId, interviewId: card.interviewId,
    scorecardId: card.id, authorEmployeeId: employeeId, draftEventId: draft.id, revision: card.revision }
}

function planned(command: InterviewCommand, base: EventBase, lifecycle: RecruitingLifecycleV1, rules: Rules) {
  envelope(base, rules)
  recruitingInstant(command.recordedAt)
  assert(base.recordedAt === command.recordedAt)
  if (command.kind === 'schedule-interview') return schedule(command, base, lifecycle, rules)
  if (command.kind === 'save-scorecard') return save(command, base, lifecycle, rules)
  if (command.kind === 'submit-scorecard') return submit(command, base, lifecycle, rules)
  return refuse()
}

export const recruitingInterviewHandler: RecruitingDomainHandler<InterviewCommand, InterviewEvent> = {
  plan(command: InterviewCommand, context: RecruitingPlanContext) {
    // Authorize the family before target lookup or entity-specific validation.
    const rules = { knownEmployeeIds: new Set(context.employees.map(item => item.id)), isTimeZoneSupported: context.isTimeZoneSupported }
    assertRecruitingActor(context.actor, rules.knownEmployeeIds)
    if (command.kind === 'schedule-interview' ? !isRecruitingManager(context.actor) : context.actor.mode !== 'interviewer') unavailable()
    const base = context.event()
    assert(sameRecruitingValue(base.actor, context.actor))
    return [planned(command, base, context.lifecycle, rules)]
  },
  replay(lifecycle, event, rules) {
    const base = { id: event.id, sequence: event.sequence, actor: event.actor, recordedAt: event.recordedAt }
    let command: InterviewCommand
    if (event.kind === 'interview-scheduled') {
      exactKeys(event, ['id', 'sequence', 'actor', 'recordedAt', 'kind', 'applicationId', 'interview'])
      exactKeys(event.interview, ['id', 'applicationId', 'participantEmployeeIds', 'startAt', 'timeZone', 'durationMinutes', 'createdEventId'])
      command = { kind: 'schedule-interview', applicationId: event.applicationId, participantEmployeeIds: event.interview.participantEmployeeIds, startAt: event.interview.startAt, timeZone: event.interview.timeZone, durationMinutes: event.interview.durationMinutes, recordedAt: event.recordedAt }
    } else if (event.kind === 'scorecard-saved') {
      exactKeys(event, ['id', 'sequence', 'actor', 'recordedAt', 'kind', 'applicationId', 'previousRevision', 'scorecard'])
      command = { kind: 'save-scorecard', interviewId: event.scorecard.interviewId, expectedRevision: event.previousRevision, content: event.scorecard.content, recordedAt: event.recordedAt }
    } else {
      exactKeys(event, ['id', 'sequence', 'actor', 'recordedAt', 'kind', 'applicationId', 'interviewId', 'scorecardId', 'authorEmployeeId', 'draftEventId', 'revision'])
      assert(event.kind === 'scorecard-submitted')
      command = { kind: 'submit-scorecard', scorecardId: event.scorecardId, expectedRevision: event.revision, recordedAt: event.recordedAt }
    }
    const expected = planned(command, base, lifecycle, rules)
    assert(sameRecruitingValue(event, expected))
    const next = copyRecruiting(lifecycle)
    if (event.kind === 'interview-scheduled') next.interviews.push(copyRecruiting(event.interview))
    else if (event.kind === 'scorecard-saved') {
      const index = next.scorecards.findIndex(item => item.id === event.scorecard.id)
      if (index < 0) next.scorecards.push(copyRecruiting(event.scorecard))
      else next.scorecards[index] = copyRecruiting(event.scorecard)
    } else {
      const card = next.scorecards.find(item => item.id === event.scorecardId)!
      card.state = 'submitted'; card.submittedEventId = event.id; card.lastOwnRecordedAt = event.recordedAt
    }
    return next
  },
}
