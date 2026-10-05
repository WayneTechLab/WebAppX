import { AppLink } from '@/components/navigation/AppLink'
import { LocalStackStatus } from '@/components/systemx/LocalStackStatus'
import { AUTH_PROVIDER_REGISTRY } from '@/auth/authProviders'
import { useFirebaseAuth } from '@/auth/useFirebaseAuth'
import {
  findSystemxProvider,
  findSystemxTool,
  getSystemxBridgeUrl,
  useSystemxLocalStatus,
  type SystemxStatus,
} from '@/systemx/localStatus'

const adminSurfaces = [
  {
    id: 'auth',
    title: 'Unified Auth',
    detail: 'Firebase Auth provider readiness, claims, MFA handoff, and local sessions.',
    anchor: 'providers',
  },
  {
    id: 'cms',
    title: 'CMS / Firestore',
    detail: 'Local collections, content records, page metadata, and guarded write evidence.',
    anchor: 'content',
  },
  {
    id: 'crm',
    title: 'CRM / relational data',
    detail: 'A provider-neutral contract for relational data adapters such as Cloud SQL or Firebase-connected services.',
    anchor: 'content',
  },
  {
    id: 'cloud',
    title: 'Cloud / GCloud',
    detail: 'Project identity, CLI, ADC, Storage, SQL, and deployment preflight without browser secrets.',
    anchor: 'providers',
  },
  {
    id: 'commerce',
    title: 'Commerce / Stripe',
    detail: 'Readiness and webhook planning only; live payment actions require an explicit provider gate.',
    anchor: 'providers',
  },
  {
    id: 'seo',
    title: 'SEO / page metadata',
    detail: 'Route titles, descriptions, canonical metadata, social previews, and favicon ownership.',
    anchor: 'pages',
  },
] as const

type SurfaceReadiness = {
  label: string
  tone: 'ready' | 'partial' | 'blocked' | 'docs'
  note: string
}

function getSurfaceReadiness(id: (typeof adminSurfaces)[number]['id'], status: SystemxStatus | null): SurfaceReadiness {
  if (!status) {
    return import.meta.env.DEV
      ? { label: 'waiting for LAN', tone: 'blocked', note: 'The local read model has not connected yet.' }
      : { label: 'docs only', tone: 'docs', note: 'The loopback-only LAN is not part of a production build.' }
  }

  if (id === 'auth') {
    return status.auth?.emulatorOnline
      ? { label: 'local ready', tone: 'ready', note: 'Firebase Auth emulator is online; local provider policy is active.' }
      : { label: 'offline', tone: 'blocked', note: 'The Auth emulator is not responding.' }
  }

  if (id === 'cms') {
    const provider = findSystemxProvider(status, 'Cloud Firestore')
    return provider?.state === 'ok'
      ? { label: 'local ready', tone: 'ready', note: `${status.data?.pages ?? 0} pages and ${status.data?.collections ?? 0} collections in the local read model.` }
      : { label: 'guarded', tone: 'partial', note: 'Firestore writes stay local and require backup, diff, confirmation, and evidence.' }
  }

  if (id === 'crm') {
    const provider = findSystemxProvider(status, 'Firebase SQL Connect / Cloud SQL PostgreSQL')
    return provider?.state === 'ok'
      ? { label: 'local ready', tone: 'ready', note: 'Relational adapter is available in the current session.' }
      : { label: 'planned', tone: 'partial', note: 'Relational storage is a selected adapter contract; no cloud mutation is implied.' }
  }

  if (id === 'cloud') {
    const firebase = findSystemxTool(status, 'firebase')
    const gcloud = findSystemxTool(status, 'gcloud')
    return firebase?.installed && gcloud?.installed
      ? { label: 'CLI ready', tone: 'partial', note: 'Firebase and gcloud CLIs are detected; deployment remains preflight- and confirmation-gated.' }
      : { label: 'tooling gap', tone: 'blocked', note: 'Both Firebase CLI and gcloud CLI must be detected before cloud preflight.' }
  }

  if (id === 'commerce') {
    const stripe = findSystemxTool(status, 'stripe')
    return stripe?.installed
      ? { label: 'CLI detected', tone: 'partial', note: 'Stripe CLI is present; live payment and webhook mutation remain disabled by default.' }
      : { label: 'planned', tone: 'partial', note: 'Install or configure the approved Stripe adapter before provider work.' }
  }

  const routeCount = status.routes?.length ?? 0
  return routeCount > 0
    ? { label: 'inventory ready', tone: 'ready', note: `${routeCount} routes are mapped to source files for metadata review.` }
    : { label: 'needs inventory', tone: 'blocked', note: 'The LAN must map routes before SEO metadata can be edited safely.' }
}

function readinessClass(tone: SurfaceReadiness['tone']) {
  if (tone === 'ready') return 'bg-emerald-100 text-emerald-900'
  if (tone === 'partial') return 'bg-amber-100 text-amber-950'
  if (tone === 'blocked') return 'bg-red-100 text-red-900'
  return 'bg-neutral-100 text-neutral-600'
}

export function AdminDashboardPage() {
  const { user, loading, level, definition, capabilities, firebaseRuntime } = useFirebaseAuth()
  const localStatus = useSystemxLocalStatus(Boolean(user && capabilities.canAccessAdmin))
  const lanConnected = Boolean(localStatus.status?.session?.bridgeUrl)
  const lanUrl = getSystemxBridgeUrl(localStatus.status)

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Admin dashboard · local first</p>
          <h1 className="mt-4 text-3xl font-bold text-neutral-950 sm:text-5xl">Operate the WebApp and SYSTEMX as one stack.</h1>
          <p className="mt-5 text-base leading-7 text-neutral-600">
            This is the authenticated staff shell for the public WebApp. The LAN
            remains the local control plane for source, page, CMS, provider, CLI,
            SDK, MCP, and evidence operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">
            {firebaseRuntime.environment}
          </span>
          {user && <span className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">Level {level}</span>}
        </div>
      </div>

      {loading && <p className="mt-10 text-sm text-neutral-600">Checking Firebase session…</p>}

      {!loading && !user && (
        <div className="mt-10 border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-xl font-semibold">Sign in is required.</h2>
          <p className="mt-2 text-sm leading-6">Use the unified Firebase Auth email/password path before opening the management surfaces.</p>
          <AppLink to="/login" className="mt-5 inline-flex rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800">Open unified login</AppLink>
        </div>
      )}

      {!loading && user && !capabilities.canAccessAdmin && (
        <div className="mt-10 border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-xl font-semibold">Admin claim required.</h2>
          <p className="mt-2 text-sm leading-6">
            {user.email} is signed in at Level {level} ({definition.label}). The
            template does not elevate a browser user. A Level 4 Employee or Level 5
            Owner claim must be issued by the trusted project setup path.
          </p>
          <AppLink to="/docs" className="mt-5 inline-flex rounded-md border border-neutral-400 px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-white">Read setup docs</AppLink>
        </div>
      )}

      {!loading && user && capabilities.canAccessAdmin && (
        <>
          <div className="mt-10">
            <LocalStackStatus {...localStatus} />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-neutral-200 bg-white p-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Staff control boundary</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                {lanConnected ? 'The front-end shell is reading live local session evidence from the LAN.' : 'The front-end shell is waiting for the LAN read model; no cloud mutation is exposed here.'}
              </p>
            </div>
            <a href={lanUrl} className="inline-flex rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
              {lanConnected ? 'Open LAN builder' : 'Reconnect LAN'}
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminSurfaces.map((surface) => {
              const readiness = getSurfaceReadiness(surface.id, localStatus.status)
              const href = localStatus.status
                ? `${lanUrl}#${surface.anchor}`
                : import.meta.env.DEV
                  ? `/__systemx/#${surface.anchor}`
                  : `/docs#${surface.anchor}`
              const actionLabel = import.meta.env.DEV
                ? lanConnected ? 'Open LAN surface' : 'Check LAN connection'
                : 'Read operating contract'

              return (
                <article key={surface.title} className="border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-neutral-950">{surface.title}</h2>
                    <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide ${readinessClass(readiness.tone)}`}>
                      {readiness.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{surface.detail}</p>
                  <p className="mt-3 text-xs leading-5 text-neutral-500">{readiness.note}</p>
                  <a href={href} className="mt-5 inline-flex text-sm font-semibold text-neutral-950 underline underline-offset-4">{actionLabel}</a>
                </article>
              )
            })}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <section className="border border-neutral-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Operator session</p>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-950">{user.email}</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                <div><dt className="font-medium text-neutral-500">Role</dt><dd className="mt-1 text-neutral-950">Level {level} · {definition.label}</dd></div>
                <div><dt className="font-medium text-neutral-500">Auth project</dt><dd className="mt-1 break-all text-neutral-950">{firebaseRuntime.projectId ?? 'not configured'}</dd></div>
                <div><dt className="font-medium text-neutral-500">Write policy</dt><dd className="mt-1 text-neutral-950">{localStatus.status?.builder?.writePolicy ?? 'backup · diff · confirm'}</dd></div>
              </dl>
              <p className="mt-5 text-sm leading-6 text-neutral-600">
                Level 4 staff can use guarded management workflows. Level 5 owners
                may receive additional trusted-project controls. Neither browser
                state nor this dashboard replaces Firebase rules, claims, MFA, or
                server-side authorization.
              </p>
            </section>
            <aside className="border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="text-lg font-semibold text-neutral-950">Provider contract</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">The public login and LAN provider panel read the same registry.</p>
              <ul className="mt-4 grid gap-3 text-sm">
                {AUTH_PROVIDER_REGISTRY.providers.map((provider) => {
                  const liveProvider = localStatus.status?.auth?.localAllowedProviders?.includes(provider.id)
                  const label = localStatus.status
                    ? liveProvider ? 'local ready' : provider.localState
                    : firebaseRuntime.useEmulators ? provider.localState : provider.productionState

                  return (
                    <li key={provider.id} className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3 last:border-0 last:pb-0">
                      <span className="text-neutral-700">{provider.label}</span>
                      <span className={`text-right text-xs font-semibold uppercase tracking-wide ${liveProvider ? 'text-emerald-700' : 'text-neutral-500'}`}>{label}</span>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
