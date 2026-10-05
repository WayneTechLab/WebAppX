import {
  getSystemxBridgeUrl,
  type SystemxLocalStatusState,
} from '@/systemx/localStatus'

type LocalStackStatusProps = SystemxLocalStatusState & {
  compact?: boolean
}

function statusTone(ready: boolean | undefined) {
  return ready
    ? 'bg-emerald-100 text-emerald-900'
    : 'bg-neutral-100 text-neutral-600'
}

export function LocalStackStatus({ status, loading, error, refresh, compact = false }: LocalStackStatusProps) {
  const runtimeReady = Boolean(status?.vite?.listening && status?.auth?.emulatorOnline)
  const firebasePorts = status?.session?.firebase ?? status?.auth?.ports
  const bridgeUrl = getSystemxBridgeUrl(status)
  const toolingReady = status?.tooling?.filter((tool) => tool.installed).length ?? 0
  const toolingTotal = status?.tooling?.length ?? 0

  return (
    <section className={`border border-neutral-200 bg-neutral-50 ${compact ? 'p-4' : 'p-5'}`} aria-labelledby="local-stack-status-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">SYSTEMX local bridge</p>
          <h2 id="local-stack-status-title" className="mt-1 text-lg font-semibold text-neutral-950">
            {runtimeReady ? 'WebApp and LAN are connected.' : 'Local control plane status'}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
        >
          Refresh status
        </button>
      </div>

      {!import.meta.env.DEV && (
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          The LAN is loopback-only and is intentionally excluded from production builds. This deployed page can show the contract, not a live local control session.
        </p>
      )}

      {import.meta.env.DEV && loading && !status && (
        <p className="mt-3 text-sm text-neutral-600">Reading the owned local session…</p>
      )}

      {import.meta.env.DEV && error && (
        <p className="mt-3 border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="status">
          {error} Run <code>npm run dev:systemx</code> from the repository root.
        </p>
      )}

      {status && (
        <>
          <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            <div className="border border-neutral-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Vite app</p>
              <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(status.vite?.listening)}`}>
                {status.vite?.listening ? 'online' : 'offline'}
              </p>
            </div>
            <div className="border border-neutral-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Firebase local</p>
              <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(status.auth?.emulatorOnline)}`}>
                {status.auth?.emulatorOnline ? 'emulators online' : 'offline'}
              </p>
            </div>
            <div className="border border-neutral-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Builder</p>
              <p className="mt-2 text-sm font-semibold text-neutral-950">
                {status.builder?.currentTemplate ? 'current template' : 'project workspace'}
              </p>
            </div>
            <div className="border border-neutral-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Tooling</p>
              <p className="mt-2 text-sm font-semibold text-neutral-950">{toolingReady}/{toolingTotal} detected</p>
            </div>
          </div>

          {!compact && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="font-medium text-neutral-500">App</dt><dd className="mt-1 break-all text-neutral-950">{status.session?.appUrl ?? status.vite?.url ?? 'not reported'}</dd></div>
              <div><dt className="font-medium text-neutral-500">LAN</dt><dd className="mt-1 break-all text-neutral-950">{status.session?.lanUrl ?? 'not reported'}</dd></div>
              <div><dt className="font-medium text-neutral-500">Auth</dt><dd className="mt-1 text-neutral-950">{firebasePorts?.auth ? `127.0.0.1:${firebasePorts.auth}` : 'not reported'}</dd></div>
              <div><dt className="font-medium text-neutral-500">Firestore / Storage</dt><dd className="mt-1 text-neutral-950">{firebasePorts?.firestore ?? '—'} / {firebasePorts?.storage ?? '—'}</dd></div>
            </dl>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-600">
            <span>Project: <strong className="text-neutral-950">{status.auth?.projectId ?? 'not configured'}</strong></span>
            <span>Branch: <strong className="text-neutral-950">{status.repository?.branch ?? 'unknown'}</strong></span>
            <span>Changes: <strong className="text-neutral-950">{status.repository?.changedFiles ?? 0}</strong></span>
            <span>Policy: <strong className="text-neutral-950">{status.builder?.writePolicy ?? 'not reported'}</strong></span>
          </div>

          <a href={bridgeUrl} className="mt-4 inline-flex text-sm font-semibold text-neutral-950 underline underline-offset-4">
            Open SYSTEMX LAN builder
          </a>
        </>
      )}
    </section>
  )
}
