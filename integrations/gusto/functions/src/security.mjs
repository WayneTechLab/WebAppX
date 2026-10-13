export class HrError extends Error {
  constructor(code, message) { super(message); this.name = 'HrError'; this.code = code }
}

export const HR_ROLES = Object.freeze(['employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor'])
const ADMIN_DIRECTORY = ['employer-owner', 'hr-admin', 'payroll-admin', 'auditor']
const COMPENSATION = ['employer-owner', 'payroll-admin', 'hr-admin', 'auditor']
const validIdentifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value)

export function identifier(value, label = 'identifier') {
  if (!validIdentifier(value)) throw new HrError('invalid-argument', `Invalid ${label}`)
  return value
}

export function requireMember(uid, orgId, membership, connection = {}) {
  if (!uid) throw new HrError('unauthenticated', 'A verified Firebase identity is required')
  identifier(uid, 'user ID'); identifier(orgId, 'organization ID')
  if (!membership || membership.uid !== uid || membership.orgId !== orgId || membership.status !== 'active') {
    throw new HrError('permission-denied', 'An active server managed HR membership is required')
  }
  if (!Array.isArray(membership.roles) || !membership.roles.length || membership.roles.some(role => !HR_ROLES.includes(role))) {
    throw new HrError('permission-denied', 'The HR membership has no valid role assignment')
  }
  // Account levels and caller supplied role/person/company IDs never grant HR access.
  const actor = { uid, orgId, roles: [...new Set(membership.roles)] }
  for (const field of ['personId', 'gustoEmployeeUuid', 'gustoContractorUuid']) {
    if (membership[field] != null) actor[field] = identifier(membership[field], field)
  }
  if (connection.orgId !== orgId || !connection.gustoCompanyUuid) return actor
  actor.gustoCompanyUuid = identifier(connection.gustoCompanyUuid, 'company ID')
  return actor
}

export function hasRole(actor, roles) { return actor.roles.some(role => roles.includes(role)) }

export function requireOrganization(actor, orgId) {
  identifier(orgId, 'organization ID')
  if (actor.orgId !== orgId) throw new HrError('permission-denied', 'Organization access denied')
}

export function canReadPerson(actor, person, classification = 'directory') {
  if (!actor || !person || !validIdentifier(actor.orgId) || !validIdentifier(person.orgId) || !validIdentifier(person.personId)
    || !Array.isArray(actor.roles) || !actor.roles.length || actor.roles.some(role => !HR_ROLES.includes(role)) || person.orgId !== actor.orgId) return false
  const mappedActor = validIdentifier(actor.personId)
  const own = mappedActor && person.personId === actor.personId
  if (classification === 'payroll-secret') return false
  if (classification === 'restricted-hr' || classification === 'compensation') return own || hasRole(actor, COMPENSATION)
  if (classification !== 'directory') return false
  return own || hasRole(actor, ADMIN_DIRECTORY)
    || (mappedActor && hasRole(actor, ['manager']) && validIdentifier(person.managerPersonId) && person.managerPersonId === actor.personId)
}

// Deliberately small read-only policy. SDK inventory supplies candidates, never authority.
export const PROVIDER_READ_POLICY = Object.freeze([
  { method: 'GET', pattern: '/v1/companies/:companyId/employees', scope: 'company', roles: ['employer-owner', 'hr-admin', 'payroll-admin'], bindings: { companyId: 'company' } },
  { method: 'GET', pattern: '/v1/employees/:employeeId', scope: 'employee', roles: ['employer-owner', 'hr-admin', 'payroll-admin', 'employee'], bindings: { employeeId: 'employee' } },
  { method: 'GET', pattern: '/v1/contractors/:contractorId', scope: 'contractor', roles: ['employer-owner', 'hr-admin', 'payroll-admin', 'contractor'], bindings: { contractorId: 'contractor' } },
  { method: 'GET', pattern: '/v1/companies/:companyId/payrolls/:payrollId', scope: 'payroll', roles: ['employer-owner', 'payroll-admin'], bindings: { companyId: 'company', payrollId: 'payroll' } },
])

export function canonicalProviderPath(path) {
  if (typeof path !== 'string' || path.length > 512 || !/^\/v1\//.test(path) || /[%?#\\\s]/.test(path)) {
    throw new HrError('permission-denied', 'Only canonical provider resource paths are accepted')
  }
  const segments = path.split('/').slice(1)
  if (segments.some(segment => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(segment))) throw new HrError('permission-denied', 'Invalid provider resource path')
  return path
}

export function resolveInventoryEndpoints(inventory, selectedBlocks) {
  const result = new Map(), visited = new Set()
  const walk = name => {
    if (visited.has(name)) return
    visited.add(name)
    const block = inventory?.blocks?.[name] ?? inventory?.flows?.[name] ?? inventory?.hooks?.[name]
    if (!block) throw new HrError('invalid-argument', 'Unknown SDK inventory block')
    for (const endpoint of block.endpoints ?? []) result.set(`${endpoint.method} ${endpoint.path}`, { method: endpoint.method, path: endpoint.path })
    for (const dependency of [...(block.blocks ?? []), ...(block.dependencies ?? [])]) walk(dependency)
  }
  for (const block of selectedBlocks) walk(block)
  return [...result.values()]
}

export function authorizeProviderRequest(actor, request, resources = []) {
  if (!request || Object.keys(request).some(key => !['method', 'path'].includes(key))) throw new HrError('permission-denied', 'Provider request fields are not allowed')
  const path = canonicalProviderPath(request.path)
  if (request.method !== 'GET') throw new HrError('permission-denied', 'Provider writes and payroll execution are disabled')
  if (!actor.gustoCompanyUuid) throw new HrError('failed-precondition', 'Provider company mapping is not configured')
  for (const policy of PROVIDER_READ_POLICY) {
    if (!hasRole(actor, policy.roles)) continue
    const pattern = policy.pattern.split('/'), actual = path.split('/')
    if (pattern.length !== actual.length) continue
    const parameters = {}
    if (!pattern.every((segment, index) => {
      if (segment.startsWith(':')) { parameters[segment.slice(1)] = identifier(actual[index]); return true }
      return segment === actual[index]
    })) continue
    for (const [parameter, binding] of Object.entries(policy.bindings)) {
      const externalId = parameters[parameter]
      if (binding === 'company') {
        if (externalId !== actor.gustoCompanyUuid) throw new HrError('permission-denied', 'Provider company access denied')
        continue
      }
      // Every employee/contractor/payroll ID must be independently server mapped to this tenant.
      const resource = resources.find(item => item.kind === binding && item.externalId === externalId && item.orgId === actor.orgId && item.companyUuid === actor.gustoCompanyUuid)
      if (!resource) throw new HrError('permission-denied', 'Provider resource ownership is not established')
      if (!hasRole(actor, ['employer-owner', 'hr-admin', 'payroll-admin'])) {
        const ownExternalId = binding === 'employee' ? actor.gustoEmployeeUuid : actor.gustoContractorUuid
        if (!ownExternalId || externalId !== ownExternalId || !validIdentifier(actor.personId) || !validIdentifier(resource.personId) || resource.personId !== actor.personId) throw new HrError('permission-denied', 'Employee self-service resource access denied')
      }
    }
    return { method: 'GET', path, orgId: actor.orgId, policy: policy.pattern }
  }
  throw new HrError('permission-denied', 'The provider endpoint is not approved for this HR role')
}
