import { HrError, identifier } from './security.mjs'

const DIRECTORY_FIELDS = ['displayName', 'workEmail', 'departmentId', 'jobTitle', 'managerPersonId', 'employmentStatus', 'type']

export function directoryProjection(orgId, personId, source) {
  identifier(orgId); identifier(personId)
  const projection = { orgId, personId }
  for (const field of DIRECTORY_FIELDS) {
    const value = source[field]
    if (typeof value === 'string' && value.length <= 320) projection[field] = value
    else if (field === 'managerPersonId' && value === null) projection[field] = null
  }
  // No spread of vendor objects: DOB, compensation, tax, bank, SSN and nested secrets are excluded.
  return projection
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HrError('invalid-argument', 'Use a valid calendar date')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new HrError('invalid-argument', 'Use a valid calendar date')
  return parsed.valueOf()
}

export function timeOffRequest(actor, input, requestId, now = new Date()) {
  identifier(requestId, 'request ID')
  if (!actor.personId || !actor.roles.some(role => ['employee', 'manager', 'hr-admin', 'payroll-admin', 'employer-owner'].includes(role))) throw new HrError('permission-denied', 'An employee identity is required')
  const keys = ['policyId', 'startDate', 'endDate', 'hours', 'note']
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) throw new HrError('invalid-argument', 'Unexpected time off request fields')
  const policyId = identifier(input.policyId, 'policy ID')
  const start = dateOnly(input.startDate), end = dateOnly(input.endDate)
  if (end < start || end - start > 29 * 86400000) throw new HrError('invalid-argument', 'Time off requests must span 1 to 30 calendar days')
  if (!Number.isFinite(input.hours) || input.hours <= 0 || input.hours > 240) throw new HrError('invalid-argument', 'Time off hours must be greater than zero and at most 240')
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 500)) throw new HrError('invalid-argument', 'Time off note is too long')
  return {
    orgId: actor.orgId, requestId, personId: actor.personId, firebaseUid: actor.uid,
    policyId, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), hours: input.hours,
    note: input.note ?? '', status: 'requested', source: 'systemx', createdAt: now.toISOString(),
  }
}

export function payrollStatusProjection(orgId, payrollId, source) {
  identifier(orgId); identifier(payrollId)
  const result = { orgId, payrollId, source: 'gusto' }
  for (const field of ['status', 'payPeriodStart', 'payPeriodEnd', 'checkDate']) if (typeof source[field] === 'string' && source[field].length <= 64) result[field] = source[field]
  // No employee earnings, bank routing, tax answers, full paystubs, or payroll submission payloads.
  return result
}
