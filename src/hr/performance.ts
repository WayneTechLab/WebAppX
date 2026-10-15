import type { HrActor, HrFixture } from './model'

export type PerformanceActivity = { receipt: string; action: string; actorRole: HrActor['role'] }
export type PerformanceGoal = {
  id: string; employeeId: string; title: string; progress: number;
  status: 'draft' | 'active' | 'completed'; activity: PerformanceActivity[];
}
export type PerformanceReview = {
  id: string; employeeId: string; managerId: string; title: string;
  stage: 'draft' | 'self-submitted' | 'manager-review' | 'published' | 'acknowledged';
  selfComments?: string; managerComments?: string; activity: PerformanceActivity[];
}
export type PerformanceState = { goals: PerformanceGoal[]; reviews: PerformanceReview[]; sequence: number }
export type PerformanceEvent =
  | { type: 'create-goal'; employeeId: string; title: string }
  | { type: 'update-goal-progress'; goalId: string; progress: number }
  | { type: 'create-review'; employeeId: string; title: string }
  | { type: 'save-self-review'; reviewId: string; comments: string }
  | { type: 'submit-self-review'; reviewId: string }
  | { type: 'save-manager-review'; reviewId: string; comments: string }
  | { type: 'publish-review'; reviewId: string }
  | { type: 'acknowledge-review'; reviewId: string }

function employeeExists(id: string | undefined, fixture: HrFixture) {
  return Boolean(id && fixture.employees.some(employee => employee.id === id))
}

export function isPerformanceSelf(actor: HrActor, employeeId: string, fixture: HrFixture) {
  return ['employee', 'manager'].includes(actor.role) && actor.employeeId === employeeId && employeeExists(employeeId, fixture)
}

function directManager(actor: HrActor, employeeId: string, fixture: HrFixture) {
  return actor.role === 'manager' && actor.employeeId !== employeeId && employeeExists(actor.employeeId, fixture) &&
    fixture.employees.some(employee => employee.id === employeeId && employee.managerId === actor.employeeId)
}

export function canAssignPerformance(actor: HrActor, employeeId: string, fixture: HrFixture) {
  return employeeExists(employeeId, fixture) && (['employer-owner', 'hr-admin'].includes(actor.role) || directManager(actor, employeeId, fixture))
}

export function canReviewPerformance(actor: HrActor, review: PerformanceReview, fixture: HrFixture) {
  return actor.employeeId === review.managerId && directManager(actor, review.employeeId, fixture)
}

export function createPerformanceState(fixture: HrFixture): PerformanceState {
  const goals = (fixture.native.performance ?? []).filter(record => typeof record.employeeId === 'string' && employeeExists(record.employeeId, fixture)).map((record): PerformanceGoal => ({
    id: record.id, employeeId: String(record.employeeId), title: String(record.title ?? 'Demo quarterly goal'), progress: 0, status: 'draft', activity: [],
  }))
  const reviews = fixture.employees.filter(employee => ['employee-002', 'employee-003'].includes(employee.id) && employee.managerId && employeeExists(employee.managerId, fixture) && employee.managerId !== employee.id).map((employee): PerformanceReview => ({
    id: `review-seed-${employee.id}`, employeeId: employee.id, managerId: String(employee.managerId), title: 'Demo Q4 review', stage: 'draft', activity: [],
  }))
  return { goals, reviews, sequence: 0 }
}

/** Role-scoped projection. Draft comments are removed before rendering or reporting. */
export function scopedPerformance(state: PerformanceState, actor: HrActor, fixture: HrFixture) {
  const allowed = (employeeId: string) => employeeExists(employeeId, fixture) &&
    (['employer-owner', 'hr-admin', 'auditor'].includes(actor.role) || isPerformanceSelf(actor, employeeId, fixture) || directManager(actor, employeeId, fixture))
  const goals = state.goals.filter(goal => allowed(goal.employeeId)).map(goal => structuredClone(goal))
  const reviews = state.reviews.filter(review => allowed(review.employeeId)).map(review => {
    const projected = structuredClone(review)
    const own = isPerformanceSelf(actor, review.employeeId, fixture)
    if (actor.role === 'auditor' || (review.stage === 'draft' && !own)) delete projected.selfComments
    if (actor.role === 'auditor' || (!canReviewPerformance(actor, review, fixture) && !['published', 'acknowledged'].includes(review.stage))) delete projected.managerComments
    return projected
  })
  return { goals, reviews }
}

export function performanceSummary(state: PerformanceState, actor: HrActor, fixture: HrFixture) {
  const scoped = scopedPerformance(state, actor, fixture)
  return {
    goals: scoped.goals.length,
    completedGoals: scoped.goals.filter(goal => goal.status === 'completed').length,
    openReviews: scoped.reviews.filter(review => review.stage !== 'acknowledged').length,
    selfReviewsDue: scoped.reviews.filter(review => review.stage === 'draft' && isPerformanceSelf(actor, review.employeeId, fixture)).length,
    managerReviewsDue: scoped.reviews.filter(review => ['self-submitted', 'manager-review'].includes(review.stage) && canReviewPerformance(actor, review, fixture)).length,
    acknowledgmentsDue: scoped.reviews.filter(review => review.stage === 'published' && isPerformanceSelf(actor, review.employeeId, fixture)).length,
  }
}

function sampleText(value: string, label: string, maximum: number) {
  if (typeof value !== 'string') throw new Error(`Enter a fictional ${label}.`)
  const trimmed = value.trim()
  if (trimmed.length < 3 || trimmed.length > maximum || Array.from(trimmed).some(character => {
    const code = character.charCodeAt(0)
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
  })) throw new Error(`Use 3–${maximum} characters for the fictional ${label}.`)
  return trimmed
}

export function transitionPerformance(state: PerformanceState, actor: HrActor, event: PerformanceEvent, fixture: HrFixture): PerformanceState {
  const next = structuredClone(state)
  const activity = (record: PerformanceGoal | PerformanceReview, action: string) => {
    next.sequence += 1
    record.activity.push({ receipt: `MOCK-PERF-${String(next.sequence).padStart(4, '0')}`, action, actorRole: actor.role })
  }
  if (event.type === 'create-goal') {
    if (!isPerformanceSelf(actor, event.employeeId, fixture) && !canAssignPerformance(actor, event.employeeId, fixture)) throw new Error('This role cannot create a goal for that employee.')
    if (next.goals.filter(goal => goal.employeeId === event.employeeId).length >= 50) throw new Error('This sample supports up to 50 goals per employee.')
    const goal: PerformanceGoal = { id: `goal-${next.sequence + 1}`, employeeId: event.employeeId, title: sampleText(event.title, 'goal title', 100), progress: 0, status: 'active', activity: [] }
    activity(goal, 'goal created')
    next.goals.push(goal)
    return next
  }
  if (event.type === 'update-goal-progress') {
    const goal = next.goals.find(record => record.id === event.goalId)
    if (!goal) throw new Error('The sample goal was not found.')
    if (!isPerformanceSelf(actor, goal.employeeId, fixture)) throw new Error('Only the employee can update their own sample goal progress.')
    if (goal.status === 'completed') throw new Error('That sample goal is already complete.')
    if (!Number.isInteger(event.progress) || event.progress < 0 || event.progress > 100) throw new Error('Enter a whole progress percentage from 0 to 100.')
    if (goal.progress === event.progress && goal.status !== 'draft') throw new Error('The sample goal already has that progress.')
    goal.progress = event.progress
    goal.status = event.progress === 100 ? 'completed' : 'active'
    activity(goal, event.progress === 100 ? 'goal completed' : 'goal progress updated')
    return next
  }
  if (event.type === 'create-review') {
    if (!canAssignPerformance(actor, event.employeeId, fixture)) throw new Error('Choose HR, owner or the employee’s direct manager to create a sample review cycle.')
    const employee = fixture.employees.find(person => person.id === event.employeeId)
    if (!employee?.managerId || employee.managerId === employee.id || !employeeExists(employee.managerId, fixture)) throw new Error('Assign a valid, separate manager before creating a sample review cycle.')
    if (next.reviews.some(review => review.employeeId === employee.id && review.stage !== 'acknowledged')) throw new Error('Finish the employee’s existing sample review before opening another cycle.')
    if (next.reviews.filter(review => review.employeeId === employee.id).length >= 20) throw new Error('This sample supports up to 20 review cycles per employee.')
    const review: PerformanceReview = { id: `review-${next.sequence + 1}`, employeeId: employee.id, managerId: employee.managerId, title: sampleText(event.title, 'review title', 100), stage: 'draft', activity: [] }
    activity(review, 'review cycle created')
    next.reviews.push(review)
    return next
  }
  const review = next.reviews.find(record => record.id === event.reviewId)
  if (!review) throw new Error('The sample review was not found.')
  if (event.type === 'save-self-review' || event.type === 'submit-self-review') {
    if (!isPerformanceSelf(actor, review.employeeId, fixture)) throw new Error('Only the employee can write or submit their own sample self-review.')
    if (review.stage !== 'draft') throw new Error('The sample self-review has already been submitted.')
    if (event.type === 'save-self-review') {
      const comments = sampleText(event.comments, 'self-review', 2000)
      if (comments === review.selfComments) throw new Error('That sample self-review draft is already saved.')
      review.selfComments = comments
      activity(review, 'self-review draft saved')
    } else {
      sampleText(review.selfComments ?? '', 'self-review', 2000)
      review.stage = 'self-submitted'
      activity(review, 'self-review submitted')
    }
    return next
  }
  if (event.type === 'save-manager-review' || event.type === 'publish-review') {
    if (!canReviewPerformance(actor, review, fixture)) throw new Error('Only the assigned direct manager can review or publish this sample cycle.')
    if (!['self-submitted', 'manager-review'].includes(review.stage)) throw new Error('The employee must submit the self-review before manager review. Published reviews are locked.')
    if (event.type === 'save-manager-review') {
      const comments = sampleText(event.comments, 'manager review', 2000)
      if (comments === review.managerComments) throw new Error('That sample manager review draft is already saved.')
      review.managerComments = comments
      review.stage = 'manager-review'
      activity(review, 'manager review draft saved')
    } else {
      sampleText(review.managerComments ?? '', 'manager review', 2000)
      review.stage = 'published'
      activity(review, 'review published to employee')
    }
    return next
  }
  if (event.type === 'acknowledge-review') {
    if (!isPerformanceSelf(actor, review.employeeId, fixture)) throw new Error('Only the employee can acknowledge their own published sample review.')
    if (review.stage !== 'published') throw new Error('Publish the sample review before acknowledging it. Acknowledged reviews are locked.')
    review.stage = 'acknowledged'
    activity(review, 'published review acknowledged')
    return next
  }
  throw new Error('Unsupported sample performance action.')
}
