import type { DemoStorageStatus } from './persistence'
import { usePortalRuntime } from './portal-runtime-context'
import { storageNoticePresentation } from './storage-presentation'

export function DemoStorageNotice({ status }: { status: DemoStorageStatus }) {
  const { mode } = usePortalRuntime()
  const { warning, heading, message } = storageNoticePresentation(status, mode)
  return <p role="status" aria-live="polite" className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${warning ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
    <strong>{heading}</strong>{message}
  </p>
}
