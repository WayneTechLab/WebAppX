import { matchHrRoute, resolveHrPath, type HrRoute } from '../hr/model'
import { portalDirectoryHref, portalRegistry, type RegisteredPortal } from './registry'

export type PortalRoute =
  | { kind: 'directory'; pathname: string }
  | { kind: 'outside'; pathname: string }
  | { kind: 'workspace'; pathname: string; portal: RegisteredPortal; hrRoute?: HrRoute; hrPortal?: string }
  | { kind: 'unsupported'; pathname: string; portal: RegisteredPortal }

/** The query/hash belongs to the browser location and is never rewritten here.
 * Matching only normalizes the pathname, so deep links retain their location.
 */
export function normalizePortalPath(location: string): string {
  if (!location.startsWith('/') || location.startsWith('//')) return location
  return location.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
}

/** Unlike supported-entry matching, the route family also owns unsupported
 * descendants so a typo gets a useful workspace-specific recovery state.
 */
export function resolvePortalRoute(location: string, hrRoutes: HrRoute[]): PortalRoute {
  const pathname = normalizePortalPath(location)
  if (pathname === portalDirectoryHref) return { kind: 'directory', pathname }
  const portal = portalRegistry.find(item => pathname === item.pathRoot || pathname.startsWith(`${item.pathRoot}/`))
  if (!portal) return { kind: 'outside', pathname }
  if (portal.id !== 'hr') return pathname === portal.pathRoot
    ? { kind: 'workspace', pathname, portal }
    : { kind: 'unsupported', pathname, portal }
  if (pathname === '/hr/demo/sdk') return { kind: 'workspace', pathname, portal }
  const resolution = resolveHrPath(pathname === '/hr/demo' ? portal.href : pathname)
  const match = resolution && matchHrRoute(resolution.canonical, hrRoutes)
  return match && resolution
    ? { kind: 'workspace', pathname, portal, hrRoute: match.route, hrPortal: resolution.portal }
    : { kind: 'unsupported', pathname, portal }
}

export type PortalBreadcrumb = { label: string; href?: string }
const hrPortalLabels: Record<string, string> = { admin: 'Management', employee: 'Employee', manager: 'Manager', contractor: 'Contractor' }

export function portalBreadcrumbs(route: PortalRoute): PortalBreadcrumb[] {
  if (route.kind === 'outside') return []
  if (route.kind === 'directory') return [{ label: 'Portal directory' }]
  const crumbs: PortalBreadcrumb[] = [{ label: 'Portal directory', href: portalDirectoryHref }]
  if (route.kind === 'unsupported') return [...crumbs, { label: route.portal.title, href: route.portal.href }, { label: 'Unavailable page' }]
  if (route.portal.id !== 'hr') return [...crumbs, { label: route.portal.title }]
  crumbs.push({ label: route.portal.title, href: route.portal.href })
  if (route.pathname === '/hr/demo/sdk') return [...crumbs, { label: 'Gusto SDK preview' }]
  const root = `/hr/demo/${route.hrPortal}`
  if (route.hrPortal) crumbs.push({ label: hrPortalLabels[route.hrPortal], ...(route.pathname !== root && route.pathname !== '/hr/demo' ? { href: root } : {}) })
  if (route.hrRoute && route.pathname !== root && route.pathname !== '/hr/demo') crumbs.push({ label: route.hrRoute.title })
  return crumbs
}
