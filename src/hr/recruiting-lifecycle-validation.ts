import type { HrEmployee, HrFixture, HrRole } from './model'
import type { HrDemoState } from './persistence'
import type { HrEmploymentInstance } from './lifecycle-types'
import type { MockOnboarding } from './mock-workflows'
import type { RecruitingLifecycleV1 } from './recruiting-lifecycle-types'
import { hrOnboardingTemplate } from './recruiting'
import { replayRecruitingLifecycle } from './recruiting-lifecycle-replay'
import { recruitingRequisitions } from './recruiting-requisitions'
import { recruitingInterviewHandler } from './recruiting-interviews'
import { recruitingBaselineIsComplete, recruitingEmploymentBaseline } from './recruiting-employment-baseline'
import { supportsRecruitingTimeZone } from './recruiting-time-zone'
import { assert, canonicalRecruitingJson, exactKeys, recruitingId, recruitingInteger, sameRecruitingValue } from './recruiting-lifecycle-value'

const roles: HrRole[] = ['employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor']
function legacyText(value: unknown): asserts value is string { assert(typeof value === 'string' && value.length <= 10000) }
function legacyActivity(value: unknown) {
  assert(Array.isArray(value) && value.length <= 10000)
  for (const item of value) {
    exactKeys(item, ['receipt', 'action', 'actorRole'])
    legacyText(item.receipt); legacyText(item.action)
    assert(roles.includes(item.actorRole as HrRole))
  }
}
function strictRawEmployee(employee: HrEmployee) {
  exactKeys(employee, ['id', 'firstName', 'lastName', 'workEmail', 'department', 'jobTitle', 'employmentStatus', 'managerId', 'payCents', 'onboarding'], ['compensationConfigured', 'compensationStatus', 'onboardingTemplateVersion'])
  recruitingId(employee.id, 200)
  for (const key of ['firstName', 'lastName', 'workEmail', 'department', 'jobTitle', 'employmentStatus'] as const) legacyText(employee[key])
  if (employee.managerId !== null) recruitingId(employee.managerId, 200)
  assert(typeof employee.payCents === 'number' && Number.isFinite(employee.payCents) && employee.payCents >= 0)
  assert(Array.isArray(employee.onboarding) && employee.onboarding.length <= 10000)
  for (const task of employee.onboarding) { exactKeys(task, ['id', 'title', 'status']); recruitingId(task.id, 200); legacyText(task.title); legacyText(task.status) }
  if (Object.hasOwn(employee, 'compensationConfigured')) assert(typeof employee.compensationConfigured === 'boolean')
  for (const key of ['compensationStatus', 'onboardingTemplateVersion'] as const) if (Object.hasOwn(employee, key)) legacyText(employee[key])
}
function strictLegacyRecruiting(state: HrDemoState) {
  const recruiting = state.recruiting
  exactKeys(recruiting, ['jobs', 'candidates', 'hiredEmployees', 'sequence', 'lifecycle'])
  recruitingInteger(recruiting.sequence, 0, Number.MAX_SAFE_INTEGER)
  for (const job of recruiting.jobs) {
    exactKeys(job, ['id', 'title', 'department', 'managerId', 'status', 'activity'])
    recruitingId(job.id, 200); recruitingId(job.managerId, 200); legacyText(job.title); legacyText(job.department)
    assert(['draft', 'published', 'closed'].includes(job.status)); legacyActivity(job.activity)
  }
  for (const candidate of recruiting.candidates) {
    exactKeys(candidate, ['id', 'jobId', 'firstName', 'lastName', 'workEmail', 'stage', 'activity'], ['employeeId'])
    recruitingId(candidate.id, 200); recruitingId(candidate.jobId, 200)
    for (const key of ['firstName', 'lastName', 'workEmail'] as const) legacyText(candidate[key])
    assert(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'].includes(candidate.stage)); legacyActivity(candidate.activity)
    if (Object.hasOwn(candidate, 'employeeId')) recruitingId(candidate.employeeId, 200)
  }
  for (const employee of recruiting.hiredEmployees) strictRawEmployee(employee)
}
function onboardingCapture(value: MockOnboarding, tasks: readonly { id: string }[]) {
  exactKeys(value, ['profileReviewed', 'jobReviewed', 'tasks', 'stage'], ['receipt'])
  assert(typeof value.profileReviewed === 'boolean' && typeof value.jobReviewed === 'boolean' && ['draft', 'reviewed', 'complete'].includes(value.stage))
  exactKeys(value.tasks, tasks.map(task => task.id))
  assert(Object.values(value.tasks).every(flag => typeof flag === 'boolean'))
  if (Object.hasOwn(value, 'receipt')) legacyText(value.receipt)
}

/** Historical first-instance provenance, including a baseline archived by rehire.
 * Reconstruct only the detached pre-materialization observation; today's overlay
 * and actor eligibility never supply its captured assignment or completion.
 */
export function assertRecruitingBaselineInstance(state: HrDemoState, employee: HrEmployee, instance: HrEmploymentInstance) {
  assert(instance.recruitingBaseline !== undefined)
  const baseline = instance.recruitingBaseline
  exactKeys(baseline, ['kind', 'hireBindingId', 'capturedOnboarding', 'completion'])
  assert(baseline.kind === 'recruiting-baseline' && instance.id === `employment-${employee.id}-1` && instance.previousInstanceId === undefined && instance.startDate === null)
  recruitingId(baseline.hireBindingId)
  onboardingCapture(baseline.capturedOnboarding, instance.tasks)
  if (baseline.completion !== null) { exactKeys(baseline.completion, ['actor', 'effectiveDate']); assert(baseline.completion.actor === 'unknown' && baseline.completion.effectiveDate === null) }
  const { lifecycle: _lifecycle, ...workflow } = state.workflow
  void _lifecycle
  const complete = recruitingBaselineIsComplete(baseline.capturedOnboarding, instance.tasks, workflow.sequence)
  assert(baseline.capturedOnboarding.stage !== 'complete' || complete)
  assert(baseline.capturedOnboarding.receipt === undefined || complete)
  const detached = {
    ...workflow,
    onboarding: { ...workflow.onboarding, [employee.id]: baseline.capturedOnboarding },
    employeeStatuses: { ...workflow.employeeStatuses, [employee.id]: complete ? 'active' : 'onboarding' },
  }
  const expected = recruitingEmploymentBaseline(detached, employee, state.recruiting)
  assert(expected && sameRecruitingValue(expected, { initial: instance.initial, templateVersion: instance.templateVersion, tasks: instance.tasks, recruitingBaseline: baseline }))
}

/** Present recruiting is one strict branch. Replay imports handlers directly;
 * neither the command controller nor persistence is a runtime dependency.
 */
export function assertValidRecruitingLifecycle(state: HrDemoState, raw: HrFixture): RecruitingLifecycleV1 {
  canonicalRecruitingJson({ schemaVersion: 1, module: 'hr', data: state })
  strictLegacyRecruiting(state)
  const life = replayRecruitingLifecycle(state.recruiting, raw, {
    requisitions: recruitingRequisitions,
    interviews: recruitingInterviewHandler,
    isTimeZoneSupported: supportsRecruitingTimeZone,
  })
  const employment = state.workflow.lifecycle
  const allEmployees = [...raw.employees, ...state.recruiting.hiredEmployees]
  const known = new Set(allEmployees.map(employee => employee.id))
  assert(life.hireBindings.length === state.recruiting.hiredEmployees.length)
  for (const employee of state.recruiting.hiredEmployees) {
    const matches = life.hireBindings.filter(binding => binding.employeeId === employee.id)
    assert(matches.length === 1)
    const binding = matches[0]
    assert(sameRecruitingValue(binding.employeeSnapshot, employee))
    assert(employee.managerId === null || known.has(employee.managerId))
    const application = life.applications.find(item => item.id === binding.applicationId)
    assert(application && application.personId === binding.personId && application.stage === 'hired' && application.hireBindingId === binding.id)
    if (binding.provenance.kind === 'legacy') {
      const links = binding.legacyEmploymentLinks
      assert(links && binding.employmentAtHire === null)
      if (links.instanceId !== null) {
        const instance = employment?.instances.find(item => item.id === links.instanceId)
        assert(instance && instance.employeeId === employee.id && instance.previousInstanceId === undefined && instance.id === `employment-${employee.id}-1` && !Object.hasOwn(instance, 'recruitingBaseline'))
        if (links.hireEventId !== null) assert(employment?.events.some(event => event.id === links.hireEventId && event.kind === 'hire' && event.employeeId === employee.id && event.instanceId === instance.id))
      } else assert(links.hireEventId === null)
      continue
    }
    const template = hrOnboardingTemplate(String(binding.checklist.version))
    assert(employee.onboardingTemplateVersion === template.version && sameRecruitingValue(binding.checklist.tasks, template.tasks))
    assert(sameRecruitingValue(employee.onboarding, template.tasks.map(task => ({ ...task, status: 'pending' }))))
    const recruitingHireEventId = binding.provenance.eventId
    const hireEvent = life.events.find(event => event.id === recruitingHireEventId)
    assert(hireEvent?.kind === 'hired' && hireEvent.actor.mode === 'native' && sameRecruitingValue(hireEvent.hire, binding))
    assert(binding.employmentAtHire && binding.legacyEmploymentLinks === null)
    // Every observed completion in the new hire's current/archived chains must
    // be an actual native-shaped receipt with its exact captured task set.
    if (employment) {
      for (const instance of employment.instances.filter(item => item.employeeId === employee.id)) {
        const captured = employment.activeInstances[employee.id] === instance.id ? state.workflow.onboarding[employee.id] : instance.archivedOnboarding
        assert(captured)
        onboardingCapture(captured, instance.tasks)
        if (captured.stage === 'complete' || captured.receipt !== undefined) assert(recruitingBaselineIsComplete(captured, instance.tasks, state.workflow.sequence))
      }
    }
    const history = employment?.directoryHistory.filter(row => row.employeeId === employee.id) ?? []
    assert(history.length ? history[0].oldValue === employee.workEmail : state.workflow.profileEmails[employee.id] === employee.workEmail)
    if (binding.employmentAtHire.kind === 'created') {
      const employmentAtHire = binding.employmentAtHire
      const instance = employment?.instances.find(item => item.id === employmentAtHire.instanceId)
      const event = employment?.events.find(item => item.id === employmentAtHire.hireEventId)
      const initial = { status: 'onboarding', department: employee.department, jobTitle: employee.jobTitle, managerId: employee.managerId }
      assert(instance && event && instance.employeeId === employee.id && instance.previousInstanceId === undefined && !Object.hasOwn(instance, 'recruitingBaseline') && instance.id === `employment-${employee.id}-1`)
      assert(instance.templateVersion === template.version && sameRecruitingValue(instance.tasks, template.tasks) && sameRecruitingValue(instance.initial, initial))
      assert(event.kind === 'hire' && event.employeeId === employee.id && event.instanceId === instance.id && event.effectiveDate === instance.startDate && event.previous === null && event.reason === '' && sameRecruitingValue(event.proposed, initial) && sameRecruitingValue(event.actor, hireEvent.actor.actor))
    } else {
      assert(binding.employmentAtHire.kind === 'absent')
      if (employment) {
        const original = employment.instances.find(item => item.employeeId === employee.id && item.previousInstanceId === undefined)
        assert(original)
        assertRecruitingBaselineInstance(state, employee, original)
      } else {
        const onboarding = state.workflow.onboarding[employee.id]
        onboardingCapture(onboarding, template.tasks)
        const complete = recruitingBaselineIsComplete(onboarding, template.tasks, state.workflow.sequence)
        assert(state.workflow.employeeStatuses[employee.id] === (complete ? 'active' : 'onboarding'))
        if (onboarding.receipt !== undefined) assert(complete && !Object.entries(state.workflow.onboarding).some(([id, other]) => id !== employee.id && other.receipt === onboarding.receipt))
        assert(onboarding.stage !== 'complete' || complete)
      }
    }
  }
  return life
}
