import type { HrEmployee } from './model'
import type { MockHrState, MockOnboarding } from './mock-workflows'
import type { HrChecklistTask, HrEmploymentSnapshot, HrRecruitingBaseline } from './lifecycle-types'
import type { RecruitingState } from './recruiting'

export type HrRecruitingBaselineCapture = {
  initial: HrEmploymentSnapshot
  templateVersion: string
  tasks: HrChecklistTask[]
  recruitingBaseline: HrRecruitingBaseline
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
  return value
}
function same(left: unknown, right: unknown) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)) }
function require(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }

/** Completion is an observed native receipt, never an inferred historical actor
 * or date. Exact task keys prevent a smaller substituted checklist qualifying.
 */
export function recruitingBaselineIsComplete(onboarding: MockOnboarding, tasks: readonly HrChecklistTask[], workflowSequence: number): boolean {
  if (!onboarding || onboarding.stage !== 'complete' || onboarding.profileReviewed !== true || onboarding.jobReviewed !== true || !onboarding.tasks || typeof onboarding.tasks !== 'object' || Array.isArray(onboarding.tasks) || !tasks.length || new Set(tasks.map(task => task.id)).size !== tasks.length) return false
  const keys = Object.keys(onboarding.tasks)
  if (keys.length !== tasks.length || tasks.some(task => !Object.hasOwn(onboarding.tasks, task.id) || onboarding.tasks[task.id] !== true)) return false
  if (!Number.isSafeInteger(workflowSequence) || workflowSequence < 2 || typeof onboarding.receipt !== 'string' || !/^MOCK-ONBOARDING-\d{4,}$/.test(onboarding.receipt)) return false
  const sequence = Number(onboarding.receipt.slice('MOCK-ONBOARDING-'.length))
  return Number.isSafeInteger(sequence) && sequence >= 1 && sequence < workflowSequence && onboarding.receipt === `MOCK-ONBOARDING-${String(sequence).padStart(4, '0')}`
}

/** Call only with explicit validated recruiting provenance and before first
 * employment materialization. Reads return detached captures and change nothing.
 * Legacy hires, employment-present hires and existing instance chains never gain
 * this arm. Historical replay can reconstruct this pre-materialization input.
 */
export function recruitingEmploymentBaseline(state: MockHrState, employee: HrEmployee, recruiting?: RecruitingState): HrRecruitingBaselineCapture | null {
  if (state.lifecycle !== undefined || !recruiting?.lifecycle) return null
  const bindings = recruiting.lifecycle.hireBindings.filter(binding => binding.employeeId === employee.id)
  require(bindings.length <= 1, 'The recruiting hire binding is ambiguous. No employment baseline was captured.')
  const binding = bindings[0]
  if (!binding || binding.provenance.kind !== 'created' || binding.employmentAtHire?.kind !== 'absent') return null
  const failure = 'The immutable recruiting hire provenance is inconsistent. No employment baseline was captured.'
  require(binding.legacyEmploymentLinks === null && same(binding.employmentAtHire, { kind: 'absent' }), failure)
  const rawHires = recruiting.hiredEmployees.filter(hire => hire.id === employee.id)
  require(rawHires.length === 1 && binding.employeeSnapshot.id === employee.id && same(rawHires[0], binding.employeeSnapshot), failure)
  const raw = rawHires[0]
  const hireEventId = binding.provenance.eventId
  const event = recruiting.lifecycle.events.filter(item => item.id === hireEventId)
  require(event.length === 1 && event[0].kind === 'hired' && event[0].applicationId === binding.applicationId && same(event[0].hire, binding), failure)
  const application = recruiting.lifecycle.applications.filter(item => item.id === binding.applicationId)
  require(application.length === 1 && application[0].personId === binding.personId && application[0].stage === 'hired' && application[0].hireBindingId === binding.id, failure)
  require(['sample-v1', 'sample-v2'].includes(String(binding.checklist.version)) && (raw.onboardingTemplateVersion === undefined || raw.onboardingTemplateVersion === binding.checklist.version), failure)
  const tasks = raw.onboarding.map(task => ({ id: task.id, title: task.title }))
  require(tasks.length > 0 && tasks.every(task => typeof task.id === 'string' && !!task.id && typeof task.title === 'string' && !!task.title) && new Set(tasks.map(task => task.id)).size === tasks.length && same(tasks, binding.checklist.tasks), failure)
  const onboarding = state.onboarding[employee.id]
  require(onboarding && Object.keys(onboarding.tasks).length === tasks.length && tasks.every(task => Object.hasOwn(onboarding.tasks, task.id)), 'The recruiting onboarding checklist does not match its immutable capture.')
  const complete = recruitingBaselineIsComplete(onboarding, tasks, state.sequence) && !Object.entries(state.onboarding).some(([id, other]) => id !== employee.id && other.receipt === onboarding.receipt)
  const status = complete ? 'active' : 'onboarding'
  require(state.employeeStatuses[employee.id] === status, 'The recruiting employee status does not match its observed onboarding completion.')
  return {
    initial: { status, department: raw.department, jobTitle: raw.jobTitle, managerId: raw.managerId },
    templateVersion: binding.checklist.version!, tasks: structuredClone(tasks),
    recruitingBaseline: { kind: 'recruiting-baseline', hireBindingId: binding.id, capturedOnboarding: structuredClone(onboarding), completion: complete ? { actor: 'unknown', effectiveDate: null } : null },
  }
}
