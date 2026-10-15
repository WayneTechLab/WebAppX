/** Shared metadata for the account-free portals. Keep this module independent
 * of rendering, browser storage and provider SDKs so routing and codecs can use
 * the same identities without importing a workspace implementation.
 */
type PortalDescriptor = {
  id: string
  label: string
  title: string
  workspaceLabel: string
  href: string
  pathRoot: string
  match: 'exact' | 'subtree'
  icon: 'users' | 'file-text' | 'handshake'
  tone: string
  description: string
  workflows: string
  roles: string
}

export const portalDirectoryHref = '/portals'

export const portalRegistry = [
  {
    id: 'hr', label: 'HR', title: 'People & HR', workspaceLabel: 'HR workspace',
    href: '/hr/demo/admin', pathRoot: '/hr/demo', match: 'subtree', icon: 'users',
    tone: 'border-emerald-200 bg-emerald-50',
    description: 'Recruit, onboard and support your fictional team.',
    workflows: 'Recruiting · reviews · surveys · time · benefits · payroll',
    roles: 'Employee, manager, HR, payroll, owner and auditor previews',
  },
  {
    id: 'cms', label: 'CMS', title: 'Content management', workspaceLabel: 'CMS workspace',
    href: '/cms/demo', pathRoot: '/cms/demo', match: 'exact', icon: 'file-text',
    tone: 'border-sky-200 bg-sky-50',
    description: 'Take sample content from draft to a published preview.',
    workflows: 'Collections · revisions · review · approval · publication',
    roles: 'Author, reviewer, publisher and read-only editorial viewer previews',
  },
  {
    id: 'crm', label: 'CRM', title: 'Customer relationships', workspaceLabel: 'CRM workspace',
    href: '/crm/demo', pathRoot: '/crm/demo', match: 'exact', icon: 'handshake',
    tone: 'border-violet-200 bg-violet-50',
    description: 'Follow fictional customers, leads and opportunities.',
    workflows: 'Companies · contacts · leads · opportunities · tasks',
    roles: 'Sales representative, sales manager, owner and auditor previews',
  },
] as const satisfies readonly PortalDescriptor[]

export type PortalId = typeof portalRegistry[number]['id']
export type RegisteredPortal = typeof portalRegistry[number]
export const portalIds: readonly PortalId[] = Object.freeze(portalRegistry.map(portal => portal.id))
export const portalById = Object.freeze(Object.fromEntries(portalRegistry.map(portal => [portal.id, portal]))) as {
  readonly [Id in PortalId]: Extract<RegisteredPortal, { id: Id }>
}

/** Match a pathname, including only slash-delimited descendants of a subtree.
 * The separate HR SDK session is part of the HR route family; the HR view
 * dispatches the separate SDK session before rendering native HR workflows.
 */
export function portalForPath(pathname: string): RegisteredPortal | undefined {
  return portalRegistry.find(portal => pathname === portal.pathRoot
    || (portal.match === 'subtree' && pathname.startsWith(`${portal.pathRoot}/`)))
}

export function isDemoPortalPath(pathname: string): boolean {
  return portalForPath(pathname) !== undefined
}
