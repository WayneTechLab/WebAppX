/** Reviewed adoption boundary: this app has exactly two account-free modules. */
export const portalDirectoryHref = '/portals'
export const portalRegistry = [
  { id: 'cms', label: 'CMS', title: 'Content management', workspaceLabel: 'CMS workspace', href: '/cms/demo', pathRoot: '/cms/demo', match: 'exact', icon: 'file-text', tone: 'border-sky-200 bg-sky-50', description: 'Publish fictional content.', workflows: 'Drafts, review and publication', roles: 'Editorial preview identities' },
  { id: 'crm', label: 'CRM', title: 'Customer relationships', workspaceLabel: 'CRM workspace', href: '/crm/demo', pathRoot: '/crm/demo', match: 'exact', icon: 'handshake', tone: 'border-violet-200 bg-violet-50', description: 'Manage fictional customers.', workflows: 'Leads, contacts and opportunities', roles: 'Sales preview identities' },
] as const
export type PortalId = typeof portalRegistry[number]['id']
export type RegisteredPortal = typeof portalRegistry[number]
export const portalIds: readonly PortalId[] = Object.freeze(portalRegistry.map(portal => portal.id))
export const portalById = Object.freeze(Object.fromEntries(portalRegistry.map(portal => [portal.id, portal]))) as {
  readonly [Id in PortalId]: Extract<RegisteredPortal, { id: Id }>
}
export const portalForPath = (pathname: string) => portalRegistry.find(portal => portal.href === pathname)
export const isDemoPortalPath = (pathname: string) => portalForPath(pathname) !== undefined
