import { ArrowUpRight, FileText, Handshake, Users } from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import { CmsDemo } from '@/cms/CmsDemo'
import { CrmDemo } from '@/crm/CrmDemo'
import { HrPage } from './HrPage'

const portals = [
  { id: 'hr', title: 'People & HR', to: '/hr/demo/admin', icon: Users, tone: 'border-emerald-200 bg-emerald-50', description: 'Recruit, onboard and support your fictional team.', workflows: 'Recruiting · reviews · surveys · time · benefits · payroll', roles: 'Employee, manager, HR, payroll, owner and auditor previews' },
  { id: 'cms', title: 'Content management', to: '/cms/demo', icon: FileText, tone: 'border-sky-200 bg-sky-50', description: 'Take sample content from draft to a published preview.', workflows: 'Collections · revisions · review · approval · publication', roles: 'Author, reviewer, publisher and read-only editorial viewer previews' },
  { id: 'crm', title: 'Customer relationships', to: '/crm/demo', icon: Handshake, tone: 'border-violet-200 bg-violet-50', description: 'Follow fictional customers, leads and opportunities.', workflows: 'Companies · contacts · leads · opportunities · tasks', roles: 'Sales representative, sales manager, owner and auditor previews' },
] as const

export function TemplatePortalsPage({ pathname }: { pathname: string }) {
  const active = pathname.startsWith('/hr/demo') ? 'hr' : pathname === '/cms/demo' ? 'cms' : pathname === '/crm/demo' ? 'crm' : 'directory'
  return <>
    <nav aria-label="Template workspaces" className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-6">
      <AppLink to="/portals" aria-current={active === 'directory' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${active === 'directory' ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-700'}`}>Portal directory</AppLink>
      {portals.map(portal => <AppLink key={portal.id} to={portal.to} aria-current={active === portal.id ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold ${active === portal.id ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-700'}`}>{portal.title}</AppLink>)}
    </nav>
    {active === 'directory' && <section className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">WebAppX · account-free workspaces</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-950">Choose a portal.</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">Test people operations, content publishing and customer relationships with fictional records. Every workspace has its own preview roles, actions and receipts.</p>
      <div className="mt-9 grid gap-5 lg:grid-cols-3">{portals.map(portal => <article key={portal.id} className={`flex flex-col rounded-xl border p-6 ${portal.tone}`}><portal.icon className="h-7 w-7 text-neutral-800" aria-hidden="true" /><h2 className="mt-5 text-2xl font-semibold text-neutral-950">{portal.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-700">{portal.description}</p><p className="mt-4 text-sm font-medium leading-6 text-neutral-900">{portal.workflows}</p><p className="mt-3 text-xs leading-5 text-neutral-600">{portal.roles}</p><AppLink to={portal.to} className="mt-6 inline-flex min-h-11 items-center justify-between gap-4 rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white">Open {portal.title}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></AppLink></article>)}</div>
      <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-base font-semibold text-amber-950">Saved in this browser, with separate records</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-amber-950">Saved actions in HR, CMS and CRM survive refresh and return visits in this browser. Each Reset removes only its own saved sample. HR people, CMS content and CRM contacts stay separate. Browser saves belong to this address and are accessible to anyone using this browser profile. Preview roles do not authenticate a user or authorize a provider. Use fictional information only.</p></div>
    </section>}
    {/* Keep each account-free module mounted so portal navigation preserves its
        session while each module also saves its fictional records separately. */}
    <div hidden={active !== 'hr'}><HrPage pathname={active === 'hr' ? pathname : '/hr/demo/admin'} /></div>
    <div hidden={active !== 'cms'}><CmsDemo /></div>
    <div hidden={active !== 'crm'}><CrmDemo /></div>
  </>
}
