import { lazy, Suspense } from 'react'
import { AppLink } from '@/components/navigation/AppLink'
import { useFirebaseAuth } from '@/auth/useFirebaseAuth'
import { HrWorkspace } from '@/hr/components/HrWorkspace'
import { resolveHrPath } from '@/hr/model'
import { hrRoutes } from '@/hr/catalog'
import { matchHrRoute } from '@/hr/model'
import { NotFoundPage } from './NotFoundPage'

const GustoSdkPreview = lazy(() => import('@/hr/gusto/GustoSdkPreview').then(module => ({ default: module.GustoSdkPreview })))

function HrEntry() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">People operations · .SYSTEMX / GUSTO</p>
      <h1 className="mt-4 text-4xl font-bold text-neutral-950">One standard for your people pages.</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-600">Explore employee, management, manager and contractor portals with fictional records. The template works without a Gusto account; connect approved backend services when adopting it for your app.</p>
      <div className="mt-9 grid gap-5 md:grid-cols-2">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Account-free preview</p>
          <h2 className="mt-3 text-2xl font-semibold">Try the HR demo</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-700">Complete fictional employee onboarding, approve timesheets, confirm benefit elections and run a simulated payroll from preparation through receipt. Changes stay in memory and disappear on refresh.</p>
          <AppLink to="/hr/demo" className="mt-6 inline-flex rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white">Open synthetic demo</AppLink>
        </article>
        <article className="rounded-xl border border-neutral-200 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Adopted app</p>
          <h2 className="mt-3 text-2xl font-semibold">Protected live portals</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600">Firebase sign-in, trusted HR memberships, resource permissions and an approved server proxy are required before real HR records or Gusto workflows become available.</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
            <AppLink to="/admin/hr" className="underline underline-offset-4">Management</AppLink>
            <AppLink to="/employee" className="underline underline-offset-4">Employee</AppLink>
            <AppLink to="/manager/hr" className="underline underline-offset-4">Manager</AppLink>
            <AppLink to="/contractor" className="underline underline-offset-4">Contractor</AppLink>
          </div>
        </article>
      </div>
      <p className="mt-8 text-sm leading-6 text-neutral-500">No shared Gusto test key is embedded in the template. Gusto Demo and production connections require their own authorized credentials. The portable architecture and page specifications live in .SYSTEMX/GUSTO.</p>
    </section>
  )
}

function ProtectedHr({ pathname }: { pathname: string }) {
  const session = useFirebaseAuth()
  const resolution = resolveHrPath(pathname)
  const selected = resolution && matchHrRoute(resolution.canonical, hrRoutes)
  if (!selected) return <NotFoundPage />
  const management = resolution?.portal === 'admin'
  const hasBaseAccess = Boolean(session.user && (!management || session.capabilities.canAccessAdmin))

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Protected HR portal · {session.firebaseRuntime.environment}</p>
      <h1 className="mt-4 text-3xl font-bold">{selected.route.title}</h1>
      <p className="mt-4 text-base leading-7 text-neutral-600">{selected.route.description}</p>
      <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-xl font-semibold">{session.loading ? 'Checking your Firebase session…' : !session.user ? 'Sign in is required.' : !hasBaseAccess ? 'A trusted staff claim is required.' : 'Live HR connection is not configured.'}</h2>
        <p className="mt-3 text-sm leading-6">{session.loading ? 'The portal is waiting for the authenticated session.' : !session.user ? 'Use the unified login. Public demo roles grant access only to fictional preview data.' : !hasBaseAccess ? 'Management requires the existing Level 4 / 5 Firebase staff boundary. This page does not issue or change account claims.' : 'This reusable template has no trusted HR membership, employer connection or server proxy. Account level alone does not authorize payroll, employee records or provider endpoints. Real data and actions remain unavailable.'}</p>
        <div className="mt-5 flex flex-wrap gap-4">
          {!session.loading && !session.user && <AppLink to="/login" className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white">Open unified login</AppLink>}
          <AppLink to="/hr/demo" className="rounded-md border border-amber-700 px-4 py-3 text-sm font-semibold">Explore synthetic demo</AppLink>
        </div>
      </div>
      <p className="mt-6 text-sm leading-6 text-neutral-500">Adoption requires server-verified tenant membership, endpoint and record authorization, secret storage, webhook verification and reconciliation. No provider call or cloud write is made by this HR shell.</p>
    </section>
  )
}

export function HrPage({ pathname }: { pathname: string }) {
  if (pathname === '/hr') return <HrEntry />
  if (pathname === '/hr/demo/sdk') return <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-12 text-sm">Loading the Gusto SDK preview…</p>}><GustoSdkPreview /></Suspense>
  if (pathname === '/hr/demo' || pathname.startsWith('/hr/demo/')) return <HrWorkspace pathname={pathname} />
  return <ProtectedHr pathname={pathname} />
}
