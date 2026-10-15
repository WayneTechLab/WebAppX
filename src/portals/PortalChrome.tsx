import { AppLink } from '@/components/navigation/AppLink'
import { portalBreadcrumbs, type PortalRoute } from './routes'
import type { DemoStorageStatus } from './persistence'
import { workspaceSaveSummary } from './save-summary'

const linkClass = 'inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800'

export function PortalBreadcrumbs({ route }: { route: PortalRoute }) {
  const crumbs = portalBreadcrumbs(route)
  if (crumbs.length < 2) return null
  return <nav aria-label="Portal breadcrumbs" className="mx-auto max-w-7xl px-4 pt-4 text-sm text-neutral-600"><ol className="flex flex-wrap items-center gap-x-2">{crumbs.map((crumb, index) => <li key={`${crumb.label}:${index}`} className="inline-flex items-center gap-2">{index > 0 && <span aria-hidden="true">/</span>}{crumb.href ? <AppLink to={crumb.href} className={linkClass}>{crumb.label}</AppLink> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}</li>)}</ol></nav>
}

export function PortalMockBanner() {
  return <aside aria-label="Account-free mock mode" className="mx-auto mt-4 max-w-7xl px-4"><div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm leading-6 text-amber-950"><strong>Account-free mock workspace.</strong> Every record and action here is fictional. Browser saves are local to this address and browser profile; preview roles grant no account or provider access. <AppLink to="/portals#mock-data-handling" className={linkClass}>How mock data is handled</AppLink></div></aside>
}

export function WorkspaceSaveSummary({ label, status }: { label: string; status: DemoStorageStatus }) {
  const summary = workspaceSaveSummary(status)
  const warning = summary.kind === 'recovered' || summary.kind === 'unavailable'
  return <div role="status" aria-label={`${label} save status`} className={`mt-4 rounded-lg border px-3 py-2 text-xs leading-5 ${warning ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-neutral-200 bg-white/70 text-neutral-700'}`}><p className="font-semibold">Browser save: {summary.label}</p><p className="mt-1">{summary.message}</p></div>
}

export function UnsupportedPortalRoute({ route }: { route: Extract<PortalRoute, { kind: 'unsupported' }> }) {
  return <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{route.portal.workspaceLabel} · unavailable page</p><h1 className="mt-4 text-3xl font-bold text-neutral-950">This {route.portal.label} demo page is unavailable.</h1><p className="mt-4 text-base leading-7 text-neutral-600">The requested route does not match a supported page in this workspace. Your saved fictional records are unchanged.</p><code className="mt-5 block break-all rounded-lg bg-neutral-100 p-4 text-sm">{route.pathname}</code><div className="mt-6 flex flex-wrap gap-5"><AppLink className={linkClass} to={route.portal.href}>Open {route.portal.workspaceLabel}</AppLink><AppLink className={linkClass} to="/portals">Return to portal directory</AppLink></div></section>
}
