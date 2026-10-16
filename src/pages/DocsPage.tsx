import { AppLink } from '@/components/navigation/AppLink'
import { portalRegistry } from '@/portals/registry'
import { MockStoragePreview } from '@/portals/MockStoragePreview'
import { usePortalRuntime } from '@/portals/portal-runtime-context'

const link = 'inline-flex min-h-11 items-center rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800'
const docs = [
  { label: 'Setup playbook', href: 'https://github.com/WayneTechLab/WebAppX/wiki/Setup-Playbook' },
  { label: 'Developer prerequisites and commands', href: 'https://github.com/WayneTechLab/WebAppX/wiki/Developer-Setup-Contracts' },
  { label: 'Dependency installation', href: 'https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEPENDENCY-INSTALLATION.md' },
]

export function DocsPage() {
  const { mode } = usePortalRuntime()
  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Docs
      </p>
      <h1 id="docs-heading" tabIndex={-1} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
        Setup documentation lives with the template.
      </h1>
      <p className="mt-5 text-lg leading-8 text-neutral-600">
        Follow the .SYSTEMX setup process to configure tooling, Firebase,
        security, CI, deployment, and human/AI handoff.
      </p>
      <section aria-label="First-run destinations" className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
        <h2 className="text-2xl font-semibold text-neutral-950">Your first local session</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-700">Install the pinned dependencies with <code>npm ci</code>, then run <code>npm run dev:mock</code> for the public app and all three native mock portals. They need no Firebase project, Gusto account or API key. Use <code>npm run doctor</code> for a read-only prerequisite report.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="rounded-lg border border-neutral-200 bg-white p-4"><AppLink to="/" className={link}>Public app</AppLink><p className="text-sm leading-6 text-neutral-600">The template’s public pages. Local mock startup is enough; Firebase remains unconfigured.</p></li>
          {portalRegistry.map(portal => <li key={portal.id} className="rounded-lg border border-neutral-200 bg-white p-4"><AppLink to={portal.href} className={link}>{portal.title}</AppLink><p className="text-sm leading-6 text-neutral-600">{portal.description} Native account-free workspace, with fictional data and preview roles.</p></li>)}
        </ul>
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          <h3 className="font-semibold">Try a memory-only walkthrough</h3>
          <p className="mt-2">Launch <code>npm run dev:mock -- --walkthrough</code>. Mock records, restore points and checkpoint settings stay in memory. Navigation keeps them; refresh starts fresh fictional records while keeping walkthrough mode on. Existing browser saves are untouched. Return to browser saves by launching the normal command.</p>
          <p className="mt-2 font-semibold">Current session: {mode === 'walkthrough' ? 'Walkthrough — fresh records after refresh.' : 'Browser saves — saved actions can survive refresh at this address.'}</p>
        </div>
        <div className="mt-4 text-sm leading-6 text-neutral-700">
          <h3 className="font-semibold text-neutral-950">Optional local control plane</h3>
          <p className="mt-2"><code>npm run dev:systemx</code> starts the integrated local session. It additionally needs the Firebase CLI, Java and the emulator prerequisites reported by <code>npm run doctor</code>. Native <code>dev:mock</code> does not start this service.</p>
          {import.meta.env.DEV ? <a href="/__systemx/" target="_blank" rel="noreferrer" className={link}>Open optional local control plane</a> : <p className="mt-2">The control plane is available only in an explicitly started local development session.</p>}
          <p className="text-xs text-neutral-500">The link opens a new tab; it does not check readiness or start services.</p>
        </div>
      </section>
      <MockStoragePreview />
      <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
        {docs.map((doc) => (
          <li key={doc.href} className="py-2 text-sm text-neutral-700">
            <a href={doc.href} className={link}>{doc.label}</a>
          </li>
        ))}
      </ul>
    </section>
  )
}
