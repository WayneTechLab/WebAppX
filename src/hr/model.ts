export type HrRole = 'employer-owner' | 'payroll-admin' | 'hr-admin' | 'manager' | 'employee' | 'contractor' | 'auditor'
export type HrPortal = 'admin' | 'employee' | 'manager' | 'contractor'
export type HrRecord = { id: string; title?: string; name?: string; status?: string; employeeId?: string; [key: string]: unknown }
export type HrAction = { id: string; label: string; mode: 'mock' | 'live-gated'; description: string }
export type HrRoute = { id: string; path: string; portal: string; title: string; capabilityId: string; backing: string; roles: string[]; description: string; sections: string[]; actions: HrAction[]; emptyState: string; errorState: string }
export type HrEmployee = HrRecord & {
  firstName: string; lastName: string; workEmail: string; department: string; jobTitle: string;
  employmentStatus: string; managerId: string | null; payCents: number;
  onboarding: { id: string; title: string; status: string }[]
}
export type HrActor = { role: HrRole; employeeId?: string; contractorId?: string }
export type HrFixture = {
  schemaVersion: number; mode: string; company: HrRecord;
  employees: HrEmployee[]; contractors: HrRecord[]; contractorPayments?: HrRecord[]; payrolls: HrRecord[]; paystubs?: HrRecord[];
  locations?: HrRecord[]; paySchedules?: HrRecord[];
  timeEntries: HrRecord[]; timeOffRequests: HrRecord[]; benefits: HrRecord[];
  documents: HrRecord[]; reports: HrRecord[]; native: Record<string, HrRecord[]>;
  [key: string]: unknown
}

export const portalRoots: Record<HrPortal, string> = { admin: '/admin/hr', employee: '/employee', manager: '/manager/hr', contractor: '/contractor' }
export const portalRoles: Record<HrPortal, HrRole> = { admin: 'employer-owner', employee: 'employee', manager: 'manager', contractor: 'contractor' }

export function demoPath(path: string, portal: HrPortal) {
  const root = portalRoots[portal]
  return `/hr/demo/${portal}${path === root ? '' : path.slice(root.length)}`
}

export function resolveHrPath(path: string): { demo: boolean; portal: HrPortal; canonical: string } | null {
  for (const [portal, root] of Object.entries(portalRoots) as [HrPortal, string][]) {
    const demoRoot = `/hr/demo/${portal}`
    if (path === demoRoot || path.startsWith(`${demoRoot}/`)) {
      return { demo: true, portal, canonical: `${root}${path.slice(demoRoot.length)}` }
    }
    if (path === root || path.startsWith(`${root}/`)) return { demo: false, portal, canonical: path }
  }
  return null
}

export function matchHrRoute(path: string, routes: HrRoute[]) {
  const segments = path.split('/').filter(Boolean)
  const ordered = [...routes].sort((a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')))
  for (const route of ordered) {
    const pattern = route.path.split('/').filter(Boolean)
    if (pattern.length !== segments.length) continue
    const parameters: Record<string, string> = {}
    let matches = true
    pattern.forEach((part, index) => {
      if (part.startsWith(':')) {
        try {
          const value = decodeURIComponent(segments[index])
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) matches = false
          parameters[part.slice(1)] = value
        } catch { matches = false }
      } else if (part !== segments[index]) matches = false
    })
    if (matches) return { route, parameters }
  }
  return null
}

export function canViewRoute(actor: HrActor, route: HrRoute) {
  return route.roles.includes(actor.role)
}

export function scopedEmployees(actor: HrActor, employees: HrEmployee[]) {
  if (actor.role === 'employee') return actor.employeeId ? employees.filter(employee => employee.id === actor.employeeId) : []
  if (actor.role === 'manager') return actor.employeeId ? employees.filter(employee => employee.managerId === actor.employeeId || employee.id === actor.employeeId) : []
  return ['employer-owner', 'payroll-admin', 'hr-admin', 'auditor'].includes(actor.role) ? employees : []
}

export function scopedRecords(actor: HrActor, records: HrRecord[], employees: HrEmployee[]) {
  if (actor.role === 'employee') return actor.employeeId ? records.filter(record => record.employeeId === actor.employeeId) : []
  if (actor.role === 'manager') {
    const permitted = new Set(scopedEmployees(actor, employees).map(employee => employee.id))
    return records.filter(record => typeof record.employeeId === 'string' && permitted.has(record.employeeId))
  }
  if (actor.role === 'contractor') return actor.contractorId ? records.filter(record => record.contractorId === actor.contractorId) : []
  return ['employer-owner', 'payroll-admin', 'hr-admin', 'auditor'].includes(actor.role) ? records : []
}

export function canViewCompensation(actor: HrActor, employeeId?: string) {
  return ['employer-owner', 'payroll-admin'].includes(actor.role) || (actor.role === 'employee' && Boolean(actor.employeeId) && employeeId === actor.employeeId)
}

export function canEditEmployeeProfile(actor: HrActor, employeeId: string) {
  if (!employeeId) return false
  return ['employer-owner', 'hr-admin'].includes(actor.role) ||
    (actor.role === 'employee' && Boolean(actor.employeeId) && employeeId === actor.employeeId)
}

function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export function validateTimeOff(startDate: string, endDate: string) {
  const start = isoDate(startDate)
  const end = isoDate(endDate)
  if (!start || !end) return { valid: false, error: 'Enter valid start and end dates.' }
  const days = (end.valueOf() - start.valueOf()) / 86400000 + 1
  if (days < 1) return { valid: false, error: 'The end date must be on or after the start date.' }
  if (days > 30) return { valid: false, error: 'This demo supports requests of up to 30 calendar days.' }
  return { valid: true, days }
}

export function validateTimeEntry(date: string, hours: number) {
  if (!isoDate(date)) return { valid: false, error: 'Enter a valid work date.' }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { valid: false, error: 'Enter hours greater than zero and no more than 24.' }
  return { valid: true }
}

export function canApproveTimeOff(actor: HrActor, request: HrRecord, employees: HrEmployee[]) {
  if (request.status !== 'pending' && request.status !== 'requested') return false
  if (!employees.some(employee => employee.id === request.employeeId)) return false
  if (['employer-owner', 'hr-admin'].includes(actor.role)) return true
  if (actor.role !== 'manager' || !actor.employeeId || request.employeeId === actor.employeeId) return false
  return employees.some(employee => employee.id === request.employeeId && employee.managerId === actor.employeeId)
}

export function canApproveTimeEntry(actor: HrActor, entry: HrRecord, employees: HrEmployee[]) {
  return entry.status === 'submitted' && canApproveTimeOff(actor, { ...entry, status: 'pending' }, employees)
}

export function searchEmployees(employees: HrEmployee[], query: string, status: string) {
  const term = query.trim().toLowerCase()
  return employees.filter(employee => {
    const matchesStatus = status === 'all' || employee.employmentStatus === status
    return matchesStatus && `${employee.firstName} ${employee.lastName} ${employee.workEmail} ${employee.department} ${employee.jobTitle}`.toLowerCase().includes(term)
  })
}

export function formatMoney(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Not included'
  const cents = Number(value)
  return Number.isFinite(cents) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : 'Not included'
}
