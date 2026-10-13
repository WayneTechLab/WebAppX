import { HrError, identifier, requireMember, canReadPerson, requireOrganization } from './security.mjs'
import { directoryProjection, timeOffRequest } from './projections.mjs'

export const SYNTHETIC_ORG = 'demo-systemx-hr'
export const SYNTHETIC_PEOPLE = Object.freeze([
  { orgId: SYNTHETIC_ORG, personId: 'person-alex', displayName: 'Alex Example', workEmail: 'alex@example.test', type: 'employee', employmentStatus: 'active', departmentId: 'engineering', jobTitle: 'Engineer', managerPersonId: 'person-jordan' },
  { orgId: SYNTHETIC_ORG, personId: 'person-jordan', displayName: 'Jordan Example', workEmail: 'jordan@example.test', type: 'employee', employmentStatus: 'active', departmentId: 'engineering', jobTitle: 'Team manager', managerPersonId: null },
  { orgId: SYNTHETIC_ORG, personId: 'person-riley', displayName: 'Riley Example', workEmail: 'riley@example.test', type: 'contractor', employmentStatus: 'active', departmentId: 'design', jobTitle: 'Designer', managerPersonId: null },
])

export function integrationState(config = {}) {
  const mode = config.mode ?? 'disabled'
  if (!['disabled', 'mock', 'demo', 'production'].includes(mode)) throw new HrError('failed-precondition', 'Unknown Gusto mode')
  return {
    mode, providerConnected: false, payrollExecutionEnabled: false,
    status: mode === 'mock' ? 'synthetic-only' : mode === 'disabled' ? 'disabled' : 'not-configured',
    reason: ['demo', 'production'].includes(mode) ? 'A reviewed token broker, provider scopes, trusted mappings and connection acceptance are required. This reference does not forward real Gusto requests.' : null,
  }
}

export function createHrBackend(services, config = {}) {
  const state = integrationState(config)
  const actorFor = async (uid, orgId) => {
    identifier(orgId, 'organization ID')
    const membership = uid ? await services.getMembership(orgId, uid) : null
    return requireMember(uid, orgId, membership)
  }
  const requireMock = orgId => {
    if (state.mode !== 'mock' || orgId !== SYNTHETIC_ORG) throw new HrError('failed-precondition', 'Only the configured synthetic organization is enabled')
  }
  return {
    async status(uid, orgId) { await actorFor(uid, orgId); return { ...state } },
    async directory(uid, orgId) {
      const actor = await actorFor(uid, orgId); requireMock(orgId)
      return SYNTHETIC_PEOPLE.filter(person => canReadPerson(actor, person)).map(person => directoryProjection(orgId, person.personId, person))
    },
    async requestTimeOff(uid, orgId, input, requestId) {
      const actor = await actorFor(uid, orgId); requireMock(orgId); requireOrganization(actor, orgId)
      if (!SYNTHETIC_PEOPLE.some(person => person.personId === actor.personId && person.type === 'employee')) throw new HrError('permission-denied', 'The employee mapping is not configured')
      const record = timeOffRequest(actor, input, requestId, services.now?.() ?? new Date())
      const policy = await services.getTimeOffPolicy(orgId, record.policyId)
      if (!policy || policy.orgId !== orgId || policy.status !== 'active') throw new HrError('invalid-argument', 'The time off policy is not active in this organization')
      await services.createTimeOff(orgId, requestId, record)
      return record
    },
    async proxy(uid, orgId) {
      await actorFor(uid, orgId)
      throw new HrError('failed-precondition', 'Real Gusto proxy is not configured; payroll submission and payment endpoints remain disabled')
    },
  }
}
