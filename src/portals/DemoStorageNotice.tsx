import type { DemoStorageStatus } from './persistence'

export function DemoStorageNotice({ status }: { status: DemoStorageStatus }) {
  const warning = status.kind === 'unavailable' || status.kind === 'recovered'
  return <p role="status" aria-live="polite" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${warning ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
    <strong>{warning ? 'Browser save needs attention. ' : 'Browser save. '}</strong>{status.message}
  </p>
}
