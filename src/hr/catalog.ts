import routeCatalog from '../../.SYSTEMX/GUSTO/ROUTES.json'
import demoCompany from '../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'
import type { HrFixture, HrRoute } from './model'

// Portable capability records are documentation/data; live authorization belongs
// in the authenticated server adapter. This host consumes only synthetic data.
// Host extensions leave the imported portable contracts and fingerprints intact.
const hostRoutes: HrRoute[] = [
  { id: 'host-employee-requests', path: '/employee/requests', portal: 'employee', title: 'HR help desk', capabilityId: 'host-service-desk', backing: 'app-native', roles: ['employee'], description: 'Create and follow your fictional equipment, access and general HR requests.', sections: ['Employee-owned requests', 'Scoped management decisions', 'Session-only receipts'], actions: [], emptyState: 'No requests yet.', errorState: 'The sample request could not be saved.' },
  { id: 'host-manager-requests', path: '/manager/hr/requests', portal: 'manager', title: 'Team requests', capabilityId: 'host-service-desk', backing: 'app-native', roles: ['manager'], description: 'Triage fictional requests from your direct reports.', sections: ['Direct-report scope', 'Assignment and resolution', 'Session-only receipts'], actions: [], emptyState: 'No team requests yet.', errorState: 'The sample request could not be saved.' },
  ...(['admin', 'employee', 'manager'] as const).map(portal => ({ id: `host-${portal}-activity`, path: `${portal === 'admin' ? '/admin/hr' : portal === 'manager' ? '/manager/hr' : '/employee'}/activity`, portal, title: 'People activity', capabilityId: 'host-people-activity', backing: 'app-native', roles: portal === 'admin' ? ['employer-owner', 'hr-admin', 'auditor'] : [portal], description: 'Follow fictional time-off and people operations receipts in your scope.', sections: ['Scoped employee activity', 'Deterministic sample receipts', 'Cleared on reset or refresh'], actions: [], emptyState: 'No activity yet.', errorState: 'Activity is unavailable.' })),
]
export const hrRoutes = [...routeCatalog.routes as HrRoute[], ...hostRoutes]
export const hrFixture = demoCompany as unknown as HrFixture
