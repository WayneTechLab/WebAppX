/** Handwritten expected records for the four recruiting browser journeys.
 * These helpers patch only known fictional inputs. They neither import nor call
 * application reducers, validators, projections, controllers or ID generators. */
export const owner = Object.freeze({ mode: 'native', actor: { role: 'employer-owner' } })
export const times = Object.freeze({ adoption: '2026-10-15T08:00:00.000Z', applied: '2026-10-15T09:00:00.000Z', separate: '2026-10-15T09:30:00.000Z', screening: '2026-10-15T11:00:00.000Z', interview: '2026-10-15T12:00:00.000Z', offer: '2026-10-15T13:00:00.000Z', final: '2026-10-15T14:00:00.000Z', observation: '2026-10-15T15:00:00.000Z', future: '2030-01-01T12:00:00.000Z' })
export const sampleTasks = Object.freeze([{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }])
export const v2Tasks = Object.freeze([...sampleTasks, { id: 'security', title: 'Review fictional access and security guidance' }])
const copy = value => structuredClone(value)
const eventId = sequence => `recruit-event-${String(sequence).padStart(4, '0')}`
function accepted(life, recordedAt, facts, actor = owner) {
  const event = { id: eventId(life.sequence), sequence: life.sequence, actor: copy(actor), recordedAt, ...copy(facts) }
  life.events.push(event); life.sequence++
  return event
}

export function legacyPublished(hr) {
  hr.recruiting.jobs[0].status = 'published'
  hr.recruiting.jobs[0].activity.push({ receipt: 'MOCK-RECRUIT-0001', action: 'Job published in this browser only', actorRole: 'employer-owner' })
  hr.recruiting.sequence = 1
}
export function legacyCaseyHired(hr) {
  const candidate = hr.recruiting.candidates[0]
  candidate.stage = 'hired'; candidate.employeeId = 'employee-recruit-seed-001'
  candidate.activity = [
    { receipt: 'MOCK-RECRUIT-0002', action: 'Candidate moved to screening', actorRole: 'employer-owner' },
    { receipt: 'MOCK-RECRUIT-0003', action: 'Candidate moved to interview', actorRole: 'employer-owner' },
    { receipt: 'MOCK-RECRUIT-0004', action: 'Candidate moved to offer', actorRole: 'employer-owner' },
    { receipt: 'MOCK-RECRUIT-0005', action: 'Mock hire created an onboarding employee; compensation unconfigured', actorRole: 'employer-owner' },
  ]
  const id = candidate.employeeId
  hr.recruiting.hiredEmployees.push({ id, firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey.fiction@example.invalid', department: 'Operations', jobTitle: 'Demo support specialist', employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false, onboarding: sampleTasks.map(task => ({ ...task, status: 'pending' })) })
  hr.recruiting.sequence = 5
  hr.workflow.onboarding[id] = { profileReviewed: false, jobReviewed: false, tasks: { profile: false, policy: false }, stage: 'draft' }
  hr.workflow.profileEmails[id] = 'casey.fiction@example.invalid'; hr.workflow.employeeStatuses[id] = 'onboarding'; hr.operations.balances[id] = { vacation: 40, sick: 24 }
}
export function completedOriginalOnboarding(hr, employeeId) {
  hr.selectedEmployee = employeeId
  hr.workflow.onboarding[employeeId] = { profileReviewed: true, jobReviewed: true, tasks: { profile: true, policy: true }, stage: 'complete', receipt: 'MOCK-ONBOARDING-0001' }
  hr.workflow.employeeStatuses[employeeId] = 'active'; hr.workflow.sequence = 2
}

export function adopted(hr, at = times.adoption) {
  const raw = hr.recruiting, legacyHire = raw.hiredEmployees[0]
  const legacyHireLinks = legacyHire ? [{ employeeId: legacyHire.id, instanceId: hr.workflow.lifecycle?.activeInstances[legacyHire.id] ?? null, hireEventId: null }] : []
  const adoption = { eventId: 'recruit-event-0001', actor: copy(owner), recordedAt: at, legacyJobs: copy(raw.jobs), legacyCandidates: copy(raw.candidates), legacyHiredEmployees: copy(raw.hiredEmployees), legacyHireLinks, legacySequence: raw.sequence }
  const life = { schemaVersion: 1, sequence: 2, adoption,
    people: [
      { id: 'rperson-0001', firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey.fiction@example.invalid', provenance: { kind: 'legacy', candidateId: 'candidate-seed-001' } },
      { id: 'rperson-0002', firstName: 'Riley', lastName: 'Sample', workEmail: 'riley.sample@example.invalid', provenance: { kind: 'legacy', candidateId: 'candidate-seed-002' } },
    ],
    applications: [
      { id: 'rapplication-0001', personId: 'rperson-0001', jobId: 'job-001', stage: legacyHire ? 'hired' : 'applied', stageEnteredAt: null, lastStageRecordedAt: null, provenance: { kind: 'legacy', candidateId: 'candidate-seed-001', initialStage: legacyHire ? 'hired' : 'applied' }, hireBindingId: legacyHire ? 'rhire-0001' : null },
      { id: 'rapplication-0002', personId: 'rperson-0002', jobId: 'job-001', stage: 'applied', stageEnteredAt: null, lastStageRecordedAt: null, provenance: { kind: 'legacy', candidateId: 'candidate-seed-002', initialStage: 'applied' }, hireBindingId: null },
    ], requisitions: [], approvals: [], jobs: [{ id: 'job-001', revision: 1, title: 'Demo support specialist', department: 'Operations', managerEmployeeId: 'employee-001', state: raw.jobs[0].status, requisitionId: null, currentPublicationId: null, provenance: { kind: 'legacy', jobId: 'job-001', initialState: raw.jobs[0].status } }], publications: [], interviews: [], scorecards: [], hireBindings: [], events: [],
  }
  if (legacyHire) life.hireBindings.push({ id: 'rhire-0001', personId: 'rperson-0001', applicationId: 'rapplication-0001', employeeId: legacyHire.id, provenance: { kind: 'legacy', candidateId: 'candidate-seed-001' }, employeeSnapshot: copy(legacyHire), checklist: { version: null, tasks: copy(sampleTasks) }, initialBalances: null, employmentAtHire: null, legacyEmploymentLinks: { instanceId: legacyHireLinks[0].instanceId, hireEventId: null } })
  life.events.push({ id: 'recruit-event-0001', sequence: 1, actor: copy(owner), recordedAt: at, kind: 'adopt', adoption: copy(adoption) })
  raw.lifecycle = life
}

export function requisitionDraft(hr) {
  const life = hr.recruiting.lifecycle
  const record = { id: 'rrequisition-0001', revision: 1, content: { department: 'Research', ownerEmployeeId: 'employee-002', headcount: 1 }, state: 'draft', currentApprovalId: null }
  life.requisitions.push(record); accepted(life, times.adoption, { kind: 'requisition-changed', requisitionId: record.id, previousRevision: null, requisition: record })
}
export function requisitionRequested(hr) {
  const life = hr.recruiting.lifecycle, record = life.requisitions[0]
  record.state = 'in-review'; accepted(life, times.adoption, { kind: 'requisition-changed', requisitionId: record.id, previousRevision: 1, requisition: record })
}
export function requisitionReviewed(hr, outcome) {
  const life = hr.recruiting.lifecycle, record = life.requisitions[0]
  const approval = outcome === 'approved' ? { id: 'rapproval-0001', requisitionId: record.id, revision: 1, content: copy(record.content), eventId: eventId(life.sequence), actor: copy(owner), recordedAt: times.adoption } : null
  if (approval) life.approvals.push(approval)
  record.state = outcome; record.currentApprovalId = approval?.id ?? null
  accepted(life, times.adoption, { kind: 'requisition-reviewed', requisitionId: record.id, revision: 1, outcome, reason: outcome === 'approved' ? 'Fictional plan approved.' : 'Fictional plan needs review.', approval })
}
export function researchJobCreated(hr) {
  const life = hr.recruiting.lifecycle
  const job = { id: 'rjob-0002', revision: 1, title: 'Fictional research specialist', department: 'Research', managerEmployeeId: 'employee-001', state: 'draft', requisitionId: 'rrequisition-0001', currentPublicationId: null, provenance: { kind: 'created', eventId: eventId(life.sequence) } }
  life.jobs.push(job); accepted(life, times.adoption, { kind: 'job-changed', jobId: job.id, previousRevision: null, job })
}
export function researchJobPublished(hr) {
  const life = hr.recruiting.lifecycle, job = life.jobs[1]
  const publication = { id: 'rpublication-0001', jobId: job.id, jobRevision: 1, job: { title: job.title, department: 'Research', managerEmployeeId: 'employee-001' }, requisitionApprovalId: 'rapproval-0001', eventId: eventId(life.sequence), actor: copy(owner), recordedAt: times.adoption }
  life.publications.push(publication); job.state = 'published'; job.currentPublicationId = publication.id
  accepted(life, times.adoption, { kind: 'job-published', jobId: job.id, publication })
}
export function devonCreated(hr) {
  const life = hr.recruiting.lifecycle
  const person = { id: 'rperson-0003', firstName: 'Devon', lastName: 'Browser', workEmail: 'devon.browser@example.invalid', provenance: { kind: 'created', eventId: eventId(life.sequence) } }
  life.people.push(person); accepted(life, times.applied, { kind: 'person-created', person })
  const application = { id: 'rapplication-0003', personId: person.id, jobId: 'rjob-0002', stage: 'applied', stageEnteredAt: times.applied, lastStageRecordedAt: times.applied, provenance: { kind: 'created', eventId: eventId(life.sequence) }, hireBindingId: null }
  life.applications.push(application); accepted(life, times.applied, { kind: 'application-created', applicationId: application.id, application })
}
export function devonSeparate(hr) {
  const life = hr.recruiting.lifecycle
  const application = { id: 'rapplication-0004', personId: 'rperson-0003', jobId: 'job-001', stage: 'applied', stageEnteredAt: times.separate, lastStageRecordedAt: times.separate, provenance: { kind: 'created', eventId: eventId(life.sequence) }, hireBindingId: null }
  life.applications.push(application); accepted(life, times.separate, { kind: 'application-created', applicationId: application.id, application })
}
export function expectedStage(hr, applicationId, previousStage, stage, at, reason = null) {
  const life = hr.recruiting.lifecycle, app = life.applications.find(item => item.id === applicationId)
  Object.assign(app, { stage, stageEnteredAt: at, lastStageRecordedAt: at })
  accepted(life, at, { kind: 'application-stage', applicationId, previousStage, stage, reason })
}
export function researchJobClosed(hr) {
  const life = hr.recruiting.lifecycle, job = life.jobs[1]
  Object.assign(job, { state: 'closed', revision: 2 }); accepted(life, times.final, { kind: 'job-changed', jobId: job.id, previousRevision: 1, job })
}

export function interviewScheduled(hr, number) {
  const life = hr.recruiting.lifecycle, id = `rinterview-000${number}`
  const interview = { id, applicationId: 'rapplication-0001', participantEmployeeIds: number === 1 ? ['employee-001', 'employee-002'] : ['employee-001'], startAt: '2035-01-01T12:00:00.000Z', timeZone: 'America/Los_Angeles', durationMinutes: 60, createdEventId: eventId(life.sequence) }
  life.interviews.push(interview); accepted(life, times.applied, { kind: 'interview-scheduled', applicationId: 'rapplication-0001', interview })
}
// Independent UTF-8/FNV reference calculation; these are fixed known pairs.
export const ownIds = Object.freeze({ a1: 'rscorecard-e0387eda02bea9a6', b1: 'rscorecard-e808a3da06ee256f', a2: 'rscorecard-932d3022a583d5c5' })
export function scorecardSaved(hr, { author, interview = 1, id, revision, comments, at }) {
  const life = hr.recruiting.lifecycle, prior = life.scorecards.findIndex(card => card.id === id)
  const card = { id, interviewId: `rinterview-000${interview}`, applicationId: 'rapplication-0001', authorEmployeeId: author, revision, content: { rubricVersion: 'sample-interview-v1', ratings: { roleUnderstanding: 4, collaboration: 3, problemSolving: 5 }, comments }, state: 'draft', latestDraftEventId: eventId(life.sequence), lastOwnRecordedAt: at, submittedEventId: null }
  if (prior < 0) life.scorecards.push(card); else life.scorecards[prior] = card
  accepted(life, at, { kind: 'scorecard-saved', applicationId: card.applicationId, previousRevision: revision === 1 ? null : revision - 1, scorecard: card }, { mode: 'interviewer', employeeId: author })
}
export function scorecardSubmitted(hr, id, at) {
  const life = hr.recruiting.lifecycle, card = life.scorecards.find(card => card.id === id)
  accepted(life, at, { kind: 'scorecard-submitted', applicationId: card.applicationId, interviewId: card.interviewId, scorecardId: id, authorEmployeeId: card.authorEmployeeId, draftEventId: card.latestDraftEventId, revision: card.revision }, { mode: 'interviewer', employeeId: card.authorEmployeeId })
  Object.assign(card, { state: 'submitted', submittedEventId: eventId(life.sequence - 1), lastOwnRecordedAt: at })
}

export function caseyHired(hr, version = 'sample-v1') {
  const life = hr.recruiting.lifecycle, tasks = copy(version === 'sample-v2' ? v2Tasks : sampleTasks), id = 'employee-rperson-0001'
  const employee = { id, firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey.fiction@example.invalid', department: 'Operations', jobTitle: 'Demo support specialist', employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false, onboarding: tasks.map(task => ({ ...task, status: 'pending' })), onboardingTemplateVersion: version }
  hr.recruiting.hiredEmployees.push(employee); hr.workflow.onboarding[id] = { profileReviewed: false, jobReviewed: false, tasks: version === 'sample-v2' ? { profile: false, policy: false, security: false } : { profile: false, policy: false }, stage: 'draft' }; hr.workflow.profileEmails[id] = employee.workEmail; hr.workflow.employeeStatuses[id] = 'onboarding'; hr.operations.balances[id] = { vacation: 40, sick: 24 }
  let employmentAtHire = { kind: 'absent' }
  if (hr.workflow.lifecycle) {
    const history = hr.workflow.lifecycle, initial = { status: 'onboarding', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }, instanceId = `employment-${id}-1`
    history.instances.push({ id: instanceId, employeeId: id, startDate: '2026-10-15', endDate: null, initial, current: copy(initial), templateVersion: version, tasks }); history.activeInstances[id] = instanceId
    const sequence = history.sequence++
    history.events.push({ id: `lifecycle-${sequence}`, sequence, kind: 'hire', employeeId: id, instanceId, effectiveDate: '2026-10-15', actor: { role: 'employer-owner' }, reason: '', previous: null, proposed: copy(initial) })
    employmentAtHire = { kind: 'created', instanceId, hireEventId: `lifecycle-${sequence}` }
  }
  const binding = { id: 'rhire-0001', personId: 'rperson-0001', applicationId: 'rapplication-0001', employeeId: id, provenance: { kind: 'created', eventId: eventId(life.sequence) }, employeeSnapshot: copy(employee), checklist: { version, tasks }, initialBalances: { vacation: 40, sick: 24 }, employmentAtHire, legacyEmploymentLinks: null }
  life.hireBindings.push(binding); Object.assign(life.applications[0], { stage: 'hired', stageEnteredAt: times.final, lastStageRecordedAt: times.final, hireBindingId: binding.id }); accepted(life, times.final, { kind: 'hired', applicationId: 'rapplication-0001', hire: binding })
}
export function seedEmployment(hr) {
  const facts = [
    ['employee-001', 'active', 'Operations', 'Operations Manager', null, [{ id: 'intro', title: 'Welcome checklist' }]],
    ['employee-002', 'active', 'Design', 'Product Designer', 'employee-001', [{ id: 'profile', title: 'Profile review' }, { id: 'policy', title: 'Read welcome policy' }]],
    ['employee-003', 'onboarding', 'Engineering', 'Software Developer', 'employee-001', [{ id: 'profile', title: 'Complete own profile' }]],
  ]
  const instances = facts.map(([employeeId, status, department, jobTitle, managerId, tasks]) => { const initial = { status, department, jobTitle, managerId }; return { id: `employment-${employeeId}-1`, employeeId, startDate: null, endDate: null, initial, current: copy(initial), templateVersion: `legacy-${employeeId}`, tasks } })
  hr.workflow.lifecycle = { schemaVersion: 1, simulationDate: null, sequence: 1, selectedTemplateVersion: 'sample-v1', instances, activeInstances: Object.fromEntries(instances.map(instance => [instance.employeeId, instance.id])), events: [], directoryHistory: [], corrections: [], offboardingAssignments: [] }
}
export function selectedV2(hr) {
  seedEmployment(hr); const history = hr.workflow.lifecycle
  history.simulationDate = '2026-10-15'; history.selectedTemplateVersion = 'sample-v2'; history.sequence = 3
  history.events = [
    { id: 'lifecycle-1', sequence: 1, kind: 'set-simulation-date', effectiveDate: '2026-10-15', previous: null, proposed: '2026-10-15', actor: { role: 'employer-owner' }, reason: '' },
    { id: 'lifecycle-2', sequence: 2, kind: 'select-template', effectiveDate: '2026-10-15', previous: 'sample-v1', proposed: 'sample-v2', actor: { role: 'employer-owner' }, reason: '' },
  ]
}
export function completedRecruitingBaseline(hr) {
  seedEmployment(hr)
  const id = 'employee-rperson-0001', history = hr.workflow.lifecycle, initial = { status: 'active', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }
  history.instances.push({ id: `employment-${id}-1`, employeeId: id, startDate: null, endDate: null, initial, current: copy(initial), templateVersion: 'sample-v1', tasks: copy(sampleTasks), recruitingBaseline: { kind: 'recruiting-baseline', hireBindingId: 'rhire-0001', capturedOnboarding: copy(hr.workflow.onboarding[id]), completion: { actor: 'unknown', effectiveDate: null } } }); history.activeInstances[id] = `employment-${id}-1`
  history.directoryHistory.push({ id: 'directory-1', sequence: 1, employeeId: id, field: 'workEmail', oldValue: 'casey.fiction@example.invalid', newValue: 'casey.lifecycle@example.invalid', actor: { role: 'employee', employeeId: id }, origin: 'direct' }); history.sequence = 2
  hr.workflow.profileEmails[id] = 'casey.lifecycle@example.invalid'
}

/** Known accepted CMS setup, separate from the two retained temporary forms. */
export function foreignReleasePrepared(cms) {
  const [page, article] = cms.entries
  page.body = 'Fictional edited content for retained release.'; page.revision = 2; page.status = 'approved'; page.feedback = ''
  article.status = 'approved'
  cms.activity = [
    { receipt: 'MOCK-CMS-0001', entryId: 'cms-page-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' },
    { receipt: 'MOCK-CMS-0002', entryId: 'cms-page-001', revision: 2, actorId: 'cms-author', action: 'Requested review' },
    { receipt: 'MOCK-CMS-0003', entryId: 'cms-article-001', revision: 1, actorId: 'cms-author', action: 'Requested review' },
    { receipt: 'MOCK-CMS-0004', entryId: 'cms-article-001', revision: 1, actorId: 'cms-reviewer', action: 'Approved exact draft revision' },
    { receipt: 'MOCK-CMS-0005', entryId: 'cms-page-001', revision: 2, actorId: 'cms-reviewer', action: 'Approved exact draft revision' },
  ]
  cms.sequence = 5
  page.approval = { revision: 2, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0005' }; article.approval = { revision: 1, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0004' }
  cms.releaseBundles = [{ id: 'cms-release-0001', name: 'Foreign preserved release preview', status: 'draft', createdBy: 'cms-publisher', preparedAtSequence: 5, members: [page, article].map(entry => ({ entryId: entry.id, collectionId: entry.collectionId, authorId: entry.authorId, revision: entry.revision, title: entry.title, slug: entry.slug, body: entry.body, approval: copy(entry.approval), previousPublication: copy(entry.published) })), activatedAtSequence: null, activatedPublications: null }]
}
