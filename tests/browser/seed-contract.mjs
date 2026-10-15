import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { loadMockModel } from './model-loader.mjs'

export const seedFile = new URL('./fixtures/portal-smoke-v1.json', import.meta.url)
export const seedDigestFile = new URL('./fixtures/portal-smoke-v1.sha256', import.meta.url)
export const seedName = 'webappx-portal-smoke-v1'
export const seedTimestamp = '2026-10-15T12:00:00.000Z'
export const smokeChanges = Object.freeze({
  goalTitle: 'Fictional browser smoke handoff',
  goalEmployee: 'employee-002',
  contentTitle: 'Fictional browser smoke editorial update',
  leadName: 'Browser Smoke Fiction',
  leadEmail: 'browser-smoke@fixture.invalid',
  leadCompany: 'Fictional Browser Smoke Studio',
})

export const sha256 = text => createHash('sha256').update(text).digest('hex')

/** The recorded digest is read, never regenerated, by a test invocation. */
export function validateSeedIntegrity(text, expectedHash) {
  assert.match(expectedHash, /^[a-f0-9]{64}$/, 'The named seed requires a recorded SHA-256 digest')
  assert.equal(sha256(text), expectedHash, 'The named seed SHA-256 digest changed; review fixture data and update its recorded digest intentionally')
  const seed = JSON.parse(text)
  assert.equal(seed.schemaVersion, 1, 'Unsupported named seed schema')
  assert.equal(seed.name, seedName, 'Unexpected named seed')
  assert.equal(seed.createdAt, seedTimestamp, 'The named seed uses a fixed UTC timestamp')
  assert.deepEqual(Object.keys(seed.workspaces).sort(), ['cms', 'crm', 'hr'])
  return seed
}

export function dashboardTotals(states) {
  const { hr, cms, crm } = states
  const confirmed = hr.workflow.benefitElections.filter(election => election.stage === 'confirmed')
  return {
    hr: {
      people: Object.keys(hr.workflow.onboarding).length,
      timeAwaitingApproval: hr.workflow.timeEntries.filter(entry => entry.status === 'submitted').length,
      confirmedBenefitElections: confirmed.length,
      submittedPayrollReceipts: hr.workflow.payrollHistory.length,
      goals: hr.performance.goals.length,
      openReviews: hr.performance.reviews.filter(review => review.stage !== 'acknowledged').length,
    },
    cms: {
      drafts: cms.entries.filter(entry => entry.status === 'draft').length,
      awaitingReview: cms.entries.filter(entry => entry.status === 'in-review').length,
      approvedRevisions: cms.entries.filter(entry => entry.status === 'approved').length,
      publishedSamples: cms.entries.filter(entry => entry.published).length,
    },
    crm: {
      activeLeads: crm.leads.filter(lead => lead.status !== 'converted').length,
      openPipelineCents: crm.opportunities.filter(opportunity => !['won', 'lost'].includes(opportunity.stage)).reduce((sum, opportunity) => sum + opportunity.amountCents, 0),
      wonCents: crm.opportunities.filter(opportunity => opportunity.stage === 'won').reduce((sum, opportunity) => sum + opportunity.amountCents, 0),
      openFollowUps: crm.tasks.filter(task => task.status === 'open').length,
    },
  }
}

/** A fixture update must agree with both full domain validators and defaults.
 * No model transition is used to calculate the expected mutation assertions.
 */
export async function loadValidatedSeed() {
  const text = await readFile(seedFile, 'utf8')
  const hash = (await readFile(seedDigestFile, 'utf8')).trim()
  const seed = validateSeedIntegrity(text, hash)
  await validateSeedContent(seed)
  return { ...seed, sha256: hash }
}

export async function validateSeedContent(seed) {
  const { createDemoWorkspaces, isDemoWorkspaces } = await loadMockModel(new URL('../../src/portals/workspaces.ts', import.meta.url))
  assert.equal(isDemoWorkspaces(seed.workspaces), true, 'The named seed must pass all three complete domain validators')
  assert.deepEqual(seed.workspaces, createDemoWorkspaces(), 'Canonical mock defaults drifted from the reviewed named seed')
  assert.deepEqual(seed.dashboardTotals, dashboardTotals(seed.workspaces), 'Named seed dashboard totals do not match its complete records')
  return seed
}

/** Explicit expected record changes, independent of application reducers. */
export function expectedAfter(states, portal) {
  const next = structuredClone(states)
  if (portal === 'hr') {
    assert.equal(next.hr.performance.sequence, 0)
    next.hr.performance.sequence = 1
    next.hr.performance.goals.push({
      id: 'goal-1', employeeId: smokeChanges.goalEmployee, title: smokeChanges.goalTitle,
      progress: 0, status: 'active',
      activity: [{ receipt: 'MOCK-PERF-0001', action: 'goal created', actorRole: 'employer-owner' }],
    })
  } else if (portal === 'cms') {
    const article = next.cms.entries.find(entry => entry.id === 'cms-article-001')
    assert.equal(article.revision, 1)
    assert.equal(next.cms.sequence, 0)
    Object.assign(article, { title: smokeChanges.contentTitle, revision: 2, status: 'draft', approval: null, feedback: '' })
    next.cms.sequence = 1
    next.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: article.id, revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  } else if (portal === 'crm') {
    assert.equal(next.crm.sequence, 1)
    next.crm.leads.push({ id: 'lead-0001', name: smokeChanges.leadName, email: smokeChanges.leadEmail, companyName: smokeChanges.leadCompany, ownerId: 'crm-owner', status: 'new' })
    next.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: `Created sample lead ${smokeChanges.leadName}.` })
    next.crm.sequence = 2
  } else throw new Error(`Unknown expected portal mutation: ${portal}`)
  return next
}
