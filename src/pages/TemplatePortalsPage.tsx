import { useEffect, useState } from 'react'
import { ArrowUpRight, FileText, Handshake, Users } from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import { CmsDemo } from '@/cms/CmsDemo'
import { CrmDemo } from '@/crm/CrmDemo'
import { HrPage } from './HrPage'
import { PortalWorkspaceProvider, usePortalWorkspaceBundle } from '@/portals/PortalWorkspaceProvider'
import { CombinedWorkspaceBackup } from '@/portals/CombinedWorkspaceBackup'
import { RestorePointHistory } from '@/portals/RestorePointHistory'
import { portalDirectoryHref, portalRegistry } from '@/portals/registry'
import { rememberPortalLocation, resolvePortalRoute } from '@/portals/routes'
import { PortalBreadcrumbs, PortalMockBanner, UnsupportedPortalRoute, WorkspaceSaveSummary } from '@/portals/PortalChrome'
import { hrRoutes } from '@/hr/catalog'
import { useUnsavedOwnerLocations } from '@/portals/unsaved-work'

const portalIcons = { users: Users, 'file-text': FileText, handshake: Handshake } as const

export function TemplatePortalsPage({ pathname }: { pathname: string }) {
  return <PortalWorkspaceProvider><TemplatePortalsContent pathname={pathname} /></PortalWorkspaceProvider>
}

function TemplatePortalsContent({ pathname }: { pathname: string }) {
  const { revisions, statuses } = usePortalWorkspaceBundle()
  const route = resolvePortalRoute(pathname, hrRoutes)
  const active = route.kind === 'workspace' || route.kind === 'unsupported' ? route.portal.id : 'directory'
  const hasWorkspace = route.kind === 'workspace'
  const [navigation, setNavigation] = useState(() => ({ pathname, locations: rememberPortalLocation(undefined, pathname, hrRoutes) }))
  let returnLocations = navigation.locations
  if (navigation.pathname !== pathname) {
    // Adjust only this component's session navigation when its location prop
    // changes. React retries this render before committing children, so hidden
    // HR never receives the registry root while leaving a supported subsection.
    returnLocations = rememberPortalLocation(navigation.locations, pathname, hrRoutes)
    setNavigation({ pathname, locations: returnLocations })
  }
  useUnsavedOwnerLocations(returnLocations)
  useEffect(() => {
    if (route.kind !== 'directory' || window.location.hash !== '#mock-data-handling') return
    const explanation = document.getElementById('mock-data-handling')
    explanation?.focus({ preventScroll: true })
    explanation?.scrollIntoView({ block: 'start' })
  }, [pathname, route.kind])
  return <>
    <nav aria-label="Template workspaces" className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-6">
      <AppLink to={portalDirectoryHref} aria-current={active === 'directory' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${active === 'directory' ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-700'}`}>Portal directory</AppLink>
      {portalRegistry.map(portal => <AppLink key={portal.id} to={returnLocations[portal.id]} aria-current={active === portal.id ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${active === portal.id ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-700'}`}>{portal.title}</AppLink>)}
    </nav>
    <PortalBreadcrumbs route={route} />
    {hasWorkspace && <PortalMockBanner />}
    {route.kind === 'unsupported' && <UnsupportedPortalRoute route={route} />}
    {active === 'directory' && <section className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">WebAppX · account-free workspaces</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-950">Choose a portal.</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">Test people operations, content publishing and customer relationships with fictional records. Every workspace has its own preview roles, actions and receipts.</p>
      <div className="mt-9 grid gap-5 lg:grid-cols-3">{portalRegistry.map(portal => { const Icon = portalIcons[portal.icon]; return <article key={portal.id} className={`flex flex-col rounded-xl border p-6 ${portal.tone}`}><Icon className="h-7 w-7 text-neutral-800" aria-hidden="true" /><h2 className="mt-5 text-2xl font-semibold text-neutral-950">{portal.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-700">{portal.description}</p><p className="mt-4 text-sm font-medium leading-6 text-neutral-900">{portal.workflows}</p><p className="mt-3 text-xs leading-5 text-neutral-600">{portal.roles}</p><WorkspaceSaveSummary label={portal.label} status={statuses[portal.id]} /><AppLink to={returnLocations[portal.id]} className="mt-6 inline-flex min-h-11 items-center justify-between gap-4 rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white">Open {portal.title}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></AppLink></article> })}</div>
      <CombinedWorkspaceBackup />
      <RestorePointHistory />
      <div id="mock-data-handling" tabIndex={-1} className="mt-7 scroll-mt-24 rounded-xl border border-amber-200 bg-amber-50 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"><h2 className="text-base font-semibold text-amber-950">Saved in this browser, with separate records</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-amber-950">Saved actions in HR, CMS and CRM survive refresh and return visits in this browser. Each Reset removes only its own saved sample. Use Export workspace and Import workspace inside each portal to move its mock records between browsers. HR people, CMS content and CRM contacts stay separate. Browser saves belong to this address and are accessible to anyone using this browser profile. Preview roles do not authenticate a user or authorize a provider. Use fictional information only.</p></div>
    </section>}
    {/* Keep each account-free module mounted so portal navigation preserves its
        session while each module also saves its fictional records separately. */}
    <div hidden={!hasWorkspace || active !== 'hr'}><HrPage key={revisions.hr} pathname={returnLocations.hr} /></div>
    <div hidden={!hasWorkspace || active !== 'cms'}><CmsDemo key={revisions.cms} /></div>
    <div hidden={!hasWorkspace || active !== 'crm'}><CrmDemo key={revisions.crm} /></div>
  </>
}
