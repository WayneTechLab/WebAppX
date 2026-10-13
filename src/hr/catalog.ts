import routeCatalog from '../../.SYSTEMX/GUSTO/ROUTES.json'
import demoCompany from '../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'
import type { HrFixture, HrRoute } from './model'

// Portable capability records are documentation/data; live authorization belongs
// in the authenticated server adapter. This host consumes only synthetic data.
export const hrRoutes = routeCatalog.routes as HrRoute[]
export const hrFixture = demoCompany as unknown as HrFixture
