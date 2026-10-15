import type { HrActor, HrEmployee, HrFixture } from './model'
import type { RecruitingLifecycleV1 } from './recruiting-lifecycle-types'

const onboardingTemplates = [
  { version: 'sample-v1', title: 'Sample welcome checklist v1', tasks: [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }] },
  { version: 'sample-v2', title: 'Sample welcome checklist v2', tasks: [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }, { id: 'security', title: 'Review fictional access and security guidance' }] },
] as const
export const HR_ONBOARDING_TEMPLATES = Object.freeze(onboardingTemplates.map(template => Object.freeze({ ...template, tasks: Object.freeze(template.tasks.map(task => Object.freeze({ ...task }))) })))

export function hrOnboardingTemplate(version: string) {
  const template = HR_ONBOARDING_TEMPLATES.find(item => item.version === version)
  if (!template) throw new Error('Choose a supported sample onboarding template version.')
  return { version: template.version, title: template.title, tasks: template.tasks.map(task => ({ ...task })) }
}

export type RecruitingJobStatus = 'draft' | 'published' | 'closed'
export type RecruitingStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type RecruitingActivity = { receipt: string; action: string; actorRole: HrActor['role'] }
export type RecruitingJob = { id: string; title: string; department: string; managerId: string; status: RecruitingJobStatus; activity: RecruitingActivity[] }
export type RecruitingCandidate = {
  id: string; jobId: string; firstName: string; lastName: string; workEmail: string; stage: RecruitingStage;
  employeeId?: string; activity: RecruitingActivity[];
}
export type RecruitingState = { jobs: RecruitingJob[]; candidates: RecruitingCandidate[]; hiredEmployees: HrEmployee[]; sequence: number; lifecycle?: RecruitingLifecycleV1 }
export type RecruitingEvent =
  | { type: 'create-job'; title: string; department: string; managerId: string }
  | { type: 'set-job-status'; jobId: string; status: 'published' | 'closed' }
  | { type: 'create-candidate'; jobId: string; firstName: string; lastName: string; workEmail: string }
  | { type: 'advance-candidate'; candidateId: string; stage: Exclude<RecruitingStage, 'applied'> }

export function canManageRecruiting(actor: HrActor) {
  return actor.role === 'employer-owner' || actor.role === 'hr-admin'
}

export function recruitingManagers(fixture: HrFixture) {
  return fixture.employees.filter(employee => employee.employmentStatus === 'active' && fixture.employees.some(report => report.managerId === employee.id))
}

export function createRecruitingState(fixture: HrFixture): RecruitingState {
  const manager = recruitingManagers(fixture)[0]
  const jobs = (fixture.native.jobs ?? []).map((job, index): RecruitingJob => ({
    id: String(job.id ?? `job-seed-${index + 1}`), title: String(job.title ?? 'Demo specialist'),
    department: String(job.department ?? 'Operations'), managerId: manager?.id ?? '', status: 'draft', activity: [],
  }))
  const candidates: RecruitingCandidate[] = jobs.length ? [
    { id: 'candidate-seed-001', jobId: jobs[0].id, firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey.fiction@example.invalid', stage: 'applied', activity: [] },
    { id: 'candidate-seed-002', jobId: jobs[0].id, firstName: 'Riley', lastName: 'Sample', workEmail: 'riley.sample@example.invalid', stage: 'applied', activity: [] },
  ] : []
  return { jobs, candidates, hiredEmployees: [], sequence: 0 }
}

export function scopedRecruiting(state: RecruitingState, actor: HrActor) {
  if (canManageRecruiting(actor) && Object.hasOwn(state, 'lifecycle')) throw new Error('Use the adopted recruiting view for these applications and jobs.')
  return canManageRecruiting(actor) ? { jobs: state.jobs, candidates: state.candidates, hiredEmployees: state.hiredEmployees } : { jobs: [], candidates: [], hiredEmployees: [] }
}

export function recruitingSummary(state: RecruitingState, actor: HrActor) {
  if (canManageRecruiting(actor) && Object.hasOwn(state, 'lifecycle')) {
    const lifecycle = state.lifecycle
    if (!lifecycle || lifecycle.schemaVersion !== 1) throw new Error('The adopted recruiting workspace is unavailable.')
    return {
      jobs: lifecycle.jobs.length, openJobs: lifecycle.jobs.filter(job => job.state === 'published').length,
      draftJobs: lifecycle.jobs.filter(job => job.state === 'draft').length,
      activeCandidates: lifecycle.applications.filter(application => !['hired', 'rejected', 'withdrawn'].includes(application.stage)).length,
      offers: lifecycle.applications.filter(application => application.stage === 'offer').length, hires: lifecycle.hireBindings.length,
    }
  }
  const { jobs, candidates, hiredEmployees } = scopedRecruiting(state, actor)
  return {
    jobs: jobs.length, openJobs: jobs.filter(job => job.status === 'published').length,
    draftJobs: jobs.filter(job => job.status === 'draft').length,
    activeCandidates: candidates.filter(candidate => !['hired', 'rejected'].includes(candidate.stage)).length,
    offers: candidates.filter(candidate => candidate.stage === 'offer').length, hires: hiredEmployees.length,
  }
}

function text(value: string, label: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`Enter a fictional ${label}.`)
  const result = value.trim()
  const containsControlCharacter = Array.from(result).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  if (result.length < min || result.length > max || containsControlCharacter) throw new Error(`Use ${min}–${max} printable characters for the fictional ${label}.`)
  return result
}

export function transitionRecruiting(state: RecruitingState, actor: HrActor, event: RecruitingEvent, fixture: HrFixture, templateVersion?: string): RecruitingState {
  if (!canManageRecruiting(actor)) throw new Error('Only the owner or HR administrator preview can manage recruiting.')
  if (Object.hasOwn(state, 'lifecycle')) throw new Error('Use the adopted recruiting workflow. Legacy recruiting records remain captured history.')
  const next = structuredClone(state)
  const activity = (record: RecruitingJob | RecruitingCandidate, action: string) => {
    next.sequence += 1
    record.activity.push({ receipt: `MOCK-RECRUIT-${String(next.sequence).padStart(4, '0')}`, action, actorRole: actor.role })
  }
  const knownManager = (id: string) => recruitingManagers(fixture).some(manager => manager.id === id)
  if (event.type === 'create-job') {
    if (!knownManager(event.managerId)) throw new Error('Choose an active sample manager with an existing team.')
    if (next.jobs.length >= 50) throw new Error('This browser session supports up to 50 sample jobs.')
    const title = text(event.title, 'job title', 3, 100)
    const department = text(event.department, 'department', 2, 80)
    if (next.jobs.some(job => job.status !== 'closed' && job.title.toLowerCase() === title.toLowerCase() && job.department.toLowerCase() === department.toLowerCase())) throw new Error('An open sample job already uses that title and department.')
    const job: RecruitingJob = { id: `job-recruit-${String(next.sequence + 1).padStart(4, '0')}`, title, department, managerId: event.managerId, status: 'draft', activity: [] }
    activity(job, 'Draft job created')
    next.jobs.push(job)
    return next
  }
  if (event.type === 'set-job-status') {
    const job = next.jobs.find(record => record.id === event.jobId)
    if (!job) throw new Error('The sample job was not found.')
    if (event.status === 'published') {
      if (job.status !== 'draft') throw new Error('Only a draft sample job can be published.')
      if (!knownManager(job.managerId)) throw new Error('The sample job needs an active manager with an existing team.')
      job.status = 'published'
      activity(job, 'Job published in this browser only')
    } else if (event.status === 'closed') {
      if (job.status !== 'published') throw new Error('Only a published sample job can be closed.')
      if (next.candidates.some(candidate => candidate.jobId === job.id && !['hired', 'rejected'].includes(candidate.stage))) throw new Error('Hire or reject every active sample candidate before closing the job.')
      job.status = 'closed'
      activity(job, 'Job closed')
    } else throw new Error('Choose a supported sample job status.')
    return next
  }
  if (event.type === 'create-candidate') {
    const job = next.jobs.find(record => record.id === event.jobId)
    if (!job || job.status !== 'published') throw new Error('Publish a sample job before adding a candidate.')
    if (next.candidates.length >= 200) throw new Error('This browser session supports up to 200 fictional candidates.')
    const firstName = text(event.firstName, 'first name', 2, 60)
    const lastName = text(event.lastName, 'last name', 2, 60)
    const workEmail = text(event.workEmail, 'email', 5, 160).toLowerCase()
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.invalid$/.test(workEmail) || workEmail.includes('..')) throw new Error('Use a fictional email ending in .invalid, such as alex.sample@example.invalid.')
    const usedEmails = [...fixture.employees, ...next.hiredEmployees, ...next.candidates].map(record => record.workEmail.toLowerCase())
    if (usedEmails.includes(workEmail)) throw new Error('That fictional email already belongs to a sample candidate or employee.')
    const candidate: RecruitingCandidate = { id: `candidate-recruit-${String(next.sequence + 1).padStart(4, '0')}`, jobId: job.id, firstName, lastName, workEmail, stage: 'applied', activity: [] }
    activity(candidate, 'Fictional application created')
    next.candidates.push(candidate)
    return next
  }
  if (event.type !== 'advance-candidate') throw new Error('Unsupported sample recruiting action.')
  const candidate = next.candidates.find(record => record.id === event.candidateId)
  if (!candidate) throw new Error('The fictional candidate was not found.')
  if (candidate.stage === 'hired' || candidate.stage === 'rejected') throw new Error('This fictional application has already reached its final stage.')
  const job = next.jobs.find(record => record.id === candidate.jobId)
  if (!job || job.status !== 'published') throw new Error('Publish the sample job before moving its candidates.')
  const stages: RecruitingStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']
  if (event.stage !== 'rejected' && stages[stages.indexOf(candidate.stage) + 1] !== event.stage) throw new Error('Complete each recruiting stage in order before moving to the next stage.')
  if (event.stage === 'hired') {
    if (!knownManager(job.managerId)) throw new Error('The sample job needs an active manager before hiring.')
    const employeeId = `employee-recruit-${candidate.id.replace(/^candidate-/, '')}`
    if (next.hiredEmployees.some(employee => employee.id === employeeId) || fixture.employees.some(employee => employee.id === employeeId || employee.workEmail.toLowerCase() === candidate.workEmail.toLowerCase())) throw new Error('This fictional candidate has already been added to the employee directory.')
    next.hiredEmployees.push({
      id: employeeId, firstName: candidate.firstName, lastName: candidate.lastName, workEmail: candidate.workEmail,
      department: job.department, jobTitle: job.title, employmentStatus: 'onboarding', managerId: job.managerId,
      payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false,
      onboarding: (templateVersion ? hrOnboardingTemplate(templateVersion).tasks : [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }]).map(task => ({ ...task, status: 'pending' })),
      ...(templateVersion ? { onboardingTemplateVersion: templateVersion } : {}),
    })
    candidate.employeeId = employeeId
  }
  candidate.stage = event.stage
  activity(candidate, event.stage === 'hired' ? 'Mock hire created an onboarding employee; compensation unconfigured' : `Candidate moved to ${event.stage}`)
  return next
}
