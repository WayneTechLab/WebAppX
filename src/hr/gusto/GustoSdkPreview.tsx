import { useState } from 'react'
import { EmployeeManagement, GustoProvider, type EventType } from '@gusto/embedded-react-sdk'
import '@gusto/embedded-react-sdk/style.css'
import { AppLink } from '@/components/navigation/AppLink'

export function GustoSdkPreview() {
  const [message, setMessage] = useState('The SDK reads fictional employees from the local development server.')
  function onEvent(type: EventType) {
    if (type === 'employee/create' || type === 'employee/update' || type === 'employee/dismiss') {
      setMessage('This preview verifies directory reads. Use the HR mock workspace for sample onboarding and profile tasks; Gusto writes require a reviewed sandbox integration.')
    }
  }
  return (
    <section className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Synthetic SDK preview</p>
          <h1 className="mt-2 text-3xl font-bold">Gusto employee directory</h1>
        </div>
        <AppLink to="/hr/demo" className="rounded-lg border px-4 py-2 text-sm font-medium">Return to HR workspace</AppLink>
      </div>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Genuine @gusto/embedded-react-sdk 0.56.6 with fictional data. No Gusto account or key is used.
        This contract covers Active, Onboarding and Dismissed directory reads; it does not simulate payroll or the full SDK.
      </p>
      <p role="status" className="text-sm text-gray-600">{message}</p>
      {import.meta.env.DEV ? (
        <div className="rounded-xl border bg-white p-4 text-gray-900">
          <GustoProvider config={{ baseUrl: new URL('/__gusto_mock__/', window.location.origin).href }}>
            <EmployeeManagement.EmployeeList companyId="00000000-0000-4000-8000-000000000001" onEvent={onEvent} />
          </GustoProvider>
        </div>
      ) : (
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Run the SDK contract locally</h2>
          <p className="mt-2">Start this app with <code>npm run dev</code> and open <code>/hr/demo/sdk</code>.
            The synthetic API is available only in the development server. The HR workspace remains available for account-free page previews.</p>
        </div>
      )}
    </section>
  )
}
