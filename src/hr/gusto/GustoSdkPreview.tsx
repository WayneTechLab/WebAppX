import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmployeeManagement, EmployeeOnboarding, GustoProvider, Payroll, type APIConfig, type EventType, type GlobalResourceDictionary } from '@gusto/embedded-react-sdk'
import '@gusto/embedded-react-sdk/style.css'
import { AppLink } from '@/components/navigation/AppLink'

const companyId = '00000000-0000-4000-8000-000000000001'
const employeeId = '00000000-0000-4000-8000-000000000102'
const payrollId = '00000000-0000-4000-8000-000000000301'
const sessionHeader = 'X-Systemx-Gusto-Mock-Session'
type PreviewFlow = 'directory' | 'onboarding' | 'payroll'
const onboardingDefaults = { profile: { homeAddress: { street1: '100 Fictional Lane', city: 'Austin', state: 'TX', zip: '78701' } } }
// Supported SDK translation overrides keep its receipt inside this local mock's
// authority. The vendor receipt otherwise displays real processor partnership copy.
const mockReceiptDictionary = { en: { 'Payroll.PayrollReceipts': { receipt: {
  totalLabel: 'Fictional local payroll total',
  companyInfo: 'Local fictional SDK receipt. No payroll provider partnership, licensed processing or funds movement is represented.',
}, sections: { debitedLabel: 'Fictional debit breakdown (no transfer)', taxLabel: 'Illustrative zero-tax breakdown' } } } } satisfies GlobalResourceDictionary

export function GustoSdkPreview() {
  const [flow, setFlow] = useState<PreviewFlow>('directory')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Starting an isolated synthetic SDK session…')
  const [error, setError] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [onboardingReady, setOnboardingReady] = useState(false)
  const [formsReviewed, setFormsReviewed] = useState(false)
  const [reportReviewed, setReportReviewed] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const controller = new AbortController()
    fetch('/__gusto_mock__/__session', { method: 'POST', credentials: 'omit', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('The local mock session could not start.')
        const result: { sessionId?: string } = await response.json()
        if (!result.sessionId || !/^[a-f0-9]{32}$/.test(result.sessionId)) throw new Error('The mock returned an invalid session.')
        if (!controller.signal.aborted) {
          setSessionId(result.sessionId)
          setError('')
          setMessage('Isolated fictional records are ready. Changes disappear on reset or refresh.')
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The local mock is unavailable.')
      })
    return () => controller.abort()
  }, [attempt])

  const requestHeaders = useCallback(() => {
    return { 'Content-Type': 'application/json', 'X-Gusto-API-Version': '2026-06-15', [sessionHeader]: sessionId ?? '' }
  }, [sessionId])
  const sdkConfig = useMemo<APIConfig>(() => ({
    baseUrl: new URL('/__gusto_mock__/', window.location.origin).href,
    headers: { [sessionHeader]: sessionId ?? '' },
    hooks: { beforeRequest: [{ beforeRequest: (_context, request) => new Request(request, { credentials: 'omit' }) }] },
  }), [sessionId])

  async function reset() {
    if (!sessionId || busy) return
    setBusy(true)
    try {
      const response = await fetch('/__gusto_mock__/__reset', { method: 'POST', credentials: 'omit', headers: requestHeaders() })
      if (!response.ok) throw new Error('The mock reset failed. Refresh to start a new session.')
      setEpoch(value => value + 1)
      setEvents([])
      setOnboardingReady(false)
      setFormsReviewed(false)
      setReportReviewed(false)
      setOnboardingComplete(false)
      setError('')
      setMessage('All SDK sample changes reset. No provider records were changed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The mock reset failed.')
    } finally {
      setBusy(false)
    }
  }

  async function finishOnboarding() {
    if (!sessionId || busy || !onboardingReady || !formsReviewed || !reportReviewed) return
    setBusy(true)
      try {
        const review = await fetch('/__gusto_mock__/__onboarding_review', {
          method: 'POST', credentials: 'omit', headers: requestHeaders(),
          body: JSON.stringify({ employeeId, formsReviewed, newHireReportReviewed: reportReviewed }),
        })
        if (!review.ok) throw new Error('Save every required synthetic onboarding step before the mock review.')
        const response = await fetch(`/__gusto_mock__/v1/employees/${employeeId}/onboarding_status`, {
          method: 'PUT', credentials: 'omit', headers: requestHeaders(), body: JSON.stringify({ onboarding_status: 'onboarding_completed' }),
        })
        if (!response.ok) throw new Error('Complete every required synthetic onboarding step before finishing.')
        const readback = await fetch(`/__gusto_mock__/v1/employees/${employeeId}/onboarding_status`, { credentials: 'omit', headers: requestHeaders() })
        const status: { onboarding_status?: string } = await readback.json()
        if (!readback.ok || status.onboarding_status !== 'onboarding_completed') throw new Error('The fictional completion status could not be verified.')
        setOnboardingComplete(true)
        setError('')
        setMessage('Fictional employee onboarding completed. The directory now shows this employee as active. No real tax form, bank setup or signature was submitted.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Synthetic onboarding could not complete.')
      } finally {
        setBusy(false)
      }
  }

  const onEvent = useCallback(async (type: EventType) => {
    setEvents(previous => [...previous.slice(-7), type])
    if ((type === 'company/employees' || type === 'employee/onboarding/done') && flow === 'onboarding') {
      try {
        const response = await fetch(`/__gusto_mock__/__onboarding_review?employeeId=${employeeId}`, { credentials: 'omit', headers: requestHeaders() })
        const result: { dataStepsComplete?: boolean } = await response.json()
        const ready = response.ok && result.dataStepsComplete === true
        setOnboardingReady(ready)
        setMessage(ready ? 'SDK data steps verified. Review the explicit simulated form and new-hire report confirmations below to complete the fictional record.' : 'Some SDK data steps remain incomplete. Save each required step before the synthetic final review.')
      } catch {
        setError('The mock onboarding readiness could not be verified.')
      }
    } else if (type === 'runPayroll/processed') {
      setMessage('Simulated payroll processed. The SDK receipt uses fictional values; no payroll, tax filing or funds movement occurred.')
    } else if (flow === 'directory' && (type === 'employee/create' || type === 'employee/update' || type === 'employee/dismiss')) {
      setMessage('Choose Employee onboarding for the supported synthetic workflow. Directory management actions outside these selected flows remain unavailable.')
    }
  }, [flow, requestHeaders])

  function chooseFlow(value: PreviewFlow) {
    setFlow(value)
    setError('')
    setEvents([])
    setMessage('Selected SDK flow uses this session’s fictional records. Reset samples to repeat a completed journey.')
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Synthetic SDK workflows</p>
          <h1 className="mt-2 text-3xl font-bold">Gusto account-free testing</h1>
        </div>
        <AppLink to="/hr/demo" className="rounded-lg border px-4 py-2 text-sm font-medium">Return to HR workspace</AppLink>
      </div>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Genuine @gusto/embedded-react-sdk 0.56.6 with fictional data and a local mock API. No Gusto account or key is used.
        Onboarding and payroll writes change synthetic memory only. Calculations, approvals and receipts have no legal or financial effect.
        Use the prefilled fictional values; do not enter real employee, tax or banking information.
      </p>
      {import.meta.env.DEV ? <>
        <nav aria-label="SDK mock workflows" className="flex flex-wrap gap-2">
          {(['directory', 'onboarding', 'payroll'] as PreviewFlow[]).map(value => <button key={value} type="button" onClick={() => chooseFlow(value)} aria-pressed={flow === value} className={`min-h-11 rounded-md border px-4 py-2 text-sm font-semibold ${flow === value ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-800'}`}>{value === 'directory' ? 'Employee directory' : value === 'onboarding' ? 'Employee onboarding' : 'Payroll workflow'}</button>)}
          <AppLink to="/hr/demo/employee/benefits" className="min-h-11 rounded-md border px-4 py-2 text-sm font-semibold">Benefits enrollment</AppLink>
          <AppLink to="/hr/demo/employee/time" className="min-h-11 rounded-md border px-4 py-2 text-sm font-semibold">Time tracking</AppLink>
          <button type="button" disabled={!sessionId || busy} onClick={() => void reset()} className="min-h-11 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50">Reset SDK samples</button>
        </nav>
        <p className="text-sm text-neutral-600">Benefits and timesheets use WebAppX mock interfaces because this SDK version has no corresponding UI flows. Their state is separate from the SDK sample session.</p>
        <p role="status" className="text-sm text-neutral-600">{message}</p>
        {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}{!sessionId && <button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-4 min-h-11 underline">Retry mock session</button>}</div>}
        {sessionId && <div className="rounded-xl border bg-white p-4 text-neutral-900">
          <GustoProvider key={`${sessionId}:${epoch}:${flow}`} config={sdkConfig} dictionary={mockReceiptDictionary}>
            {flow === 'directory' ? <EmployeeManagement.EmployeeList companyId={companyId} onEvent={onEvent} /> : flow === 'onboarding' ? onboardingComplete ? <p className="text-sm">The fictional employee is active. Choose Employee directory to read back the record, or reset SDK samples to repeat onboarding.</p> : <EmployeeOnboarding.OnboardingExecutionFlow companyId={companyId} initialEmployeeId={employeeId} defaultValues={onboardingDefaults} isAdmin isSelfOnboardingEnabled={false} withEmployeeI9={false} onEvent={onEvent} /> : <Payroll.PayrollExecutionFlow companyId={companyId} payrollId={payrollId} withReimbursements={false} onEvent={onEvent} />}
          </GustoProvider>
        </div>}
        {flow === 'onboarding' && sessionId && <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold">Finish the synthetic onboarding review</h2>
          <p className="text-sm leading-6">The SDK summary completes the data wizard. This separate mock review simulates provider forms and the new-hire report. It does not sign a legal document, file a report or verify eligibility. I-9 verification is outside this sample.</p>
          {!onboardingReady && <p className="text-sm font-medium">Save each SDK data step and finish its summary to unlock this review.</p>}
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={formsReviewed} disabled={!onboardingReady || onboardingComplete} onChange={event => setFormsReviewed(event.target.checked)} />Simulate employee form review · no legal signature</label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={reportReviewed} disabled={!onboardingReady || onboardingComplete} onChange={event => setReportReviewed(event.target.checked)} />Simulate new-hire report review · no filing</label>
          <button type="button" disabled={!onboardingReady || !formsReviewed || !reportReviewed || onboardingComplete || busy} onClick={() => void finishOnboarding()} className="min-h-11 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Complete simulated onboarding</button>
          {onboardingComplete && <p role="status" className="text-sm font-semibold text-emerald-900">Synthetic onboarding receipt: completed. All changes stay in this isolated mock session.</p>}
        </section>}
        {events.length > 0 && <details className="rounded-lg border p-4 text-sm"><summary className="cursor-pointer font-semibold">Recent mock SDK events</summary><ol className="mt-3 list-inside list-decimal space-y-1">{events.map((event, index) => <li key={`${index}:${event}`}>{event}</li>)}</ol></details>}
      </> : <div className="rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Run the SDK mock locally</h2>
        <p className="mt-2">Start this app with <code>npm run dev</code> and open <code>/hr/demo/sdk</code>.
          The synthetic API runs only in the development server. The HR workspace includes account-free onboarding, payroll, benefits and time-tracking workflows in production builds too.</p>
      </div>}
    </section>
  )
}
