import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUnsavedTransition, useUnsavedWork } from '@/portals/unsaved-work'
import { createHrFormDraft, focusHrForm, normalizeHrFormValue } from './useHrFormDraft'
import type { PayrollControlCommand, PayrollControlHandle, PayrollControlPort, PayrollControlPreview, PayrollControlView, PayrollMoney, PayrollReceiptChoice } from '../payroll-control-types'

export type HrPayrollControlProps = {
  view: Extract<PayrollControlView, { mode: 'writer' }>
  port: Pick<PayrollControlPort, 'preview' | 'confirm' | 'cancel'>
  guardClosure: (commit: () => void) => boolean
}
type Pending = { handle: PayrollControlHandle; preview: PayrollControlPreview; kind: PayrollControlCommand['kind'] }

type ClosureFields = { receipt: string; recordedOn: string; reason: string }
type CorrectionFields = { receipt: string; employeeId: string; recordedOn: string; reason: string; gross: string; withholding: string; benefits: string }
type FieldIssue = { field: string; message: string }
const closureId = 'hr:payroll-control:closure'
const correctionId = 'hr:payroll-control:correction'
const fieldOrder = ['payroll-closure-period', 'payroll-closure-date', 'payroll-closure-reason', 'payroll-correction-receipt', 'payroll-correction-employee', 'payroll-correction-date', 'payroll-correction-reason', 'payroll-correction-gross', 'payroll-correction-withholding', 'payroll-correction-benefits']
const panel = 'min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'
const fieldClass = 'mt-2 block min-h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'

/** Exact decimal parsing belongs at the UI boundary. A correction never uses
 * the native rate form's rounding or accepts exponent/coerced input. */
function parseMoney(value: string): number | null {
  const raw = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  const magnitude = whole.replace(/^0+(?=\d)/, '')
  if (magnitude.length > 11) return null
  const cents = Number(magnitude) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 1_000_000_000_000 ? cents : null
}
function money(cents: number): string { return `${cents < 0 ? '-' : ''}$${Math.floor(Math.abs(cents) / 100).toLocaleString('en-US')}.${String(Math.abs(cents) % 100).padStart(2, '0')}` }
function dollars(cents: number): string { return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}` }
function signedMoney(cents: number): string { return `${cents > 0 ? '+' : ''}${money(cents)}` }
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}
function commonIssues(values: { recordedOn: string; reason: string }, prefix: string): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!validDate(values.recordedOn)) issues.push({ field: `${prefix}-date`, message: 'Enter a valid recorded date in YYYY-MM-DD form.' })
  const reason = values.reason.trim()
  if (reason.length < 2 || reason.length > 500 || /\p{Cc}/u.test(values.reason)) issues.push({ field: `${prefix}-reason`, message: 'Enter a reason of 2–500 printable characters without control characters.' })
  return issues
}
function correctionNormalization(values: CorrectionFields): string {
  return normalizeHrFormValue({ ...values, gross: parseMoney(values.gross) ?? values.gross.trim(), withholding: parseMoney(values.withholding) ?? values.withholding.trim(), benefits: parseMoney(values.benefits) ?? values.benefits.trim() })
}
function focusControl(id: string) { document.getElementById(id)?.focus() }
function errorAttributes(issues: FieldIssue[], id: string) {
  return issues.some(issue => issue.field === id) ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {}
}
function ErrorSummary({ issues, label }: { issues: FieldIssue[]; label: string }) {
  if (!issues.length) return null
  return <section role="alert" aria-label={label} className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950">
    <h4 className="font-semibold">Review all fields before previewing</h4>
    <ul className="mt-2 list-inside list-disc space-y-2">{issues.map(issue => <li id={`${issue.field}-error`} key={issue.field}><a className="underline" href={`#${issue.field}`} onClick={event => { event.preventDefault(); focusControl(issue.field) }}>{issue.message}</a></li>)}</ul>
  </section>
}

function MoneyDetails({ title, value, signed = false }: { title: string; value: PayrollMoney; signed?: boolean }) {
  const format = signed ? signedMoney : money
  return <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-3"><h5 className="font-semibold">{title}</h5><dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm"><dt>Fictional gross</dt><dd>{format(value.grossCents)}</dd><dt>Illustrative withholding</dt><dd>{format(value.illustrativeWithholdingCents)}</dd><dt>Sample benefits</dt><dd>{format(value.benefitDeductionCents)}</dd><dt>Fictional net</dt><dd>{format(value.netCents)}</dd></dl></div>
}

function PayrollPreview({ preview, onConfirm, onCancel }: { preview: PayrollControlPreview; onConfirm: () => void; onCancel: () => void }) {
  const closing = preview.kind === 'close-period'
  return <section role="region" aria-label={closing ? 'Period closure preview' : 'Payroll correction preview'} className="mt-5 min-w-0 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <h4 className="font-semibold">{closing ? 'Review company-wide sample period closure' : 'Review separate fictional payroll adjustment'}</h4>
    <dl className="mt-3 grid gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
      <dt>Original recorded period</dt><dd>{preview.period ? `${preview.period.start} to ${preview.period.end}` : 'Unknown — periodless legacy receipt; no period is inferred'}</dd>
      {preview.kind === 'close-period' ? <><dt>All submitted receipts in this window</dt><dd>{preview.receiptIds.join(', ')}</dd><dt>Consumed time entries</dt><dd>{preview.entryCount}</dd><dt>Pending ordinary preparation</dt><dd>{preview.pendingPayrollBecomesStale ? 'Preserved unchanged; becomes stale because its window overlaps this closure' : 'No overlapping pending preparation'}</dd></> : <><dt>Original receipt</dt><dd><a className="underline" href={`#payroll-original-${preview.originalReceipt}`}>{preview.originalReceipt}</a></dd><dt>Employee ID captured by original</dt><dd>{preview.employeeId}</dd><dt>Previous adjustment link</dt><dd>{preview.previousAdjustmentId ?? 'None — first adjustment for this original and employee'}</dd></>}
      <dt>Recorded date</dt><dd>{preview.recordedOn}</dd><dt>Reason</dt><dd className="whitespace-pre-wrap">{preview.reason}</dd><dt>Effect</dt><dd>{preview.effect}</dd>
    </dl>
    {preview.kind === 'adjust-receipt' && <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2"><MoneyDetails title="Immutable original statement" value={preview.original} /><MoneyDetails title="Previous cumulative balance" value={preview.previous} /><MoneyDetails title="Separate signed adjustment" value={preview.delta} signed /><MoneyDetails title="Proposed cumulative balance" value={preview.proposed} /></div>}
    <p className="mt-3 text-xs leading-5 text-neutral-700">Preview has changed no record. Confirmation rechecks current source and preview authority. {closing ? 'This closes the entire company date window; it does not rewrite submitted totals. No normal action reopens it. A deliberate complete workspace replacement can restore an earlier snapshot.' : 'Original hours, rates, benefit snapshots, paid time and submitted history stay unchanged. These are manual fictional monetary targets, with no tax calculation, funding, debit or provider reversal.'}</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} onClick={onConfirm}>{closing ? 'Confirm period closure' : 'Confirm fictional payroll correction'}</button><button type="button" className={secondary} onClick={onCancel}>{closing ? 'Cancel closure preview' : 'Cancel correction preview'}</button></div>
  </section>
}

/** Only volatile text and a private handle live in this form. The host owns
 * authorization, latest complete state, replacement epochs and persistence. */
function useControlDraft<T>({ id, label, initial, port, normalize = normalizeHrFormValue }: {
  id: string; label: string; initial: T; port: HrPayrollControlProps['port']; normalize?: (value: T) => string
}) {
  const [draft] = useState(() => createHrFormDraft(initial, normalize))
  const [values, render] = useState(initial)
  const [pending, renderPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  function invalidate() { const old = pendingRef.current; pendingRef.current = null; renderPending(null); if (old) port.cancel(old.handle) }
  function clearMessages() { setIssues([]); setError(''); setFeedback('') }
  function change(update: T | ((previous: T) => T)) { invalidate(); render(draft.change(update)); clearMessages() }
  function replace(next: T) { invalidate(); render(draft.accept(next)); clearMessages() }
  function discard() { invalidate(); render(draft.discard()); clearMessages() }
  useUnsavedWork({ id, portal: 'hr', label, isDirty: draft.isDirty, discard, focus: () => focusHrForm(id) })
  useEffect(() => () => { const old = pendingRef.current; pendingRef.current = null; if (old) port.cancel(old.handle) }, [port])
  function validate(found: FieldIssue[]) {
    found.sort((left, right) => fieldOrder.indexOf(left.field) - fieldOrder.indexOf(right.field))
    invalidate(); clearMessages(); setIssues(found)
    if (found.length) { focusControl(found[0].field); return false }
    return true
  }
  function preview(command: PayrollControlCommand) {
    try {
      const result = port.preview(command)
      if (!result.ok) { setError(result.message); return }
      if (result.preview.kind !== command.kind) { port.cancel(result.handle); setError('The preview did not match this action. Your inputs are kept; preview again.'); return }
      const next = { handle: result.handle, preview: result.preview, kind: command.kind }
      pendingRef.current = next; renderPending(next)
    } catch { setError('The payroll preview was refused. Your inputs are kept; review current facts and preview again.') }
  }
  function confirm(handle: PayrollControlHandle) {
    const current = pendingRef.current
    if (!current || current.handle !== handle) return
    pendingRef.current = null; renderPending(null)
    try {
      const result = port.confirm({ kind: current.kind, handle })
      if (!result.ok) { setError(result.message); setFeedback(''); return }
      render(draft.accept(draft.value())); clearMessages(); setFeedback(result.feedback); focusHrForm(id)
    } catch { setError('Confirmation was refused. Your inputs are kept; create a new preview.'); setFeedback('') }
  }
  function cancel() { invalidate() }
  return { id, values, read: draft.value, change, replace, discard, pending, issues, error, feedback, validate, preview, confirm, cancel }
}

function ClosureForm({ receipts, port, guardClosure }: { receipts: PayrollReceiptChoice[]; port: HrPayrollControlProps['port']; guardClosure: HrPayrollControlProps['guardClosure'] }) {
  const draft = useControlDraft<ClosureFields>({ id: closureId, label: 'Sample period closure', initial: { receipt: '', recordedOn: '', reason: '' }, port })
  const opener = useRef<HTMLButtonElement>(null)
  const request = useUnsavedTransition()
  const choices = receipts.filter(receipt => receipt.period !== null)
  const selected = choices.find(receipt => receipt.receipt === draft.values.receipt)
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = draft.read(), receipt = choices.find(item => item.receipt === values.receipt)
    const issues: FieldIssue[] = []
    if (!receipt?.period) issues.push({ field: 'payroll-closure-period', message: 'Choose an available submitted period with explicit recorded dates.' })
    issues.push(...commonIssues(values, 'payroll-closure'))
    if (receipt?.period && validDate(values.recordedOn) && values.recordedOn < receipt.period.end) issues.push({ field: 'payroll-closure-date', message: 'The closure recorded date must be on or after the submitted period end.' })
    if (!draft.validate(issues) || !receipt?.period) return
    draft.preview({ kind: 'close-period', period: receipt.period, recordedOn: values.recordedOn, reason: values.reason.trim() })
  }
  return <form id={closureId} aria-label="Close submitted sample period" className="min-w-0 space-y-4" noValidate onSubmit={preview}>
    <ErrorSummary issues={draft.issues} label="Period closure field errors" />
    <label className="block text-sm font-medium" htmlFor="payroll-closure-period">Submitted period<select id="payroll-closure-period" {...errorAttributes(draft.issues, "payroll-closure-period")} className={fieldClass} value={draft.values.receipt} required onChange={event => { const receipt = event.target.value; request({ portal: 'hr', ids: [closureId], label: 'Change submitted period for closure' }, () => draft.replace({ receipt, recordedOn: '', reason: '' })) }}><option value="">Choose a submitted period</option>{choices.map(receipt => <option key={receipt.receipt} value={receipt.receipt}>{receipt.period!.start} to {receipt.period!.end} · {receipt.receipt}</option>)}{draft.values.receipt && !selected && <option value={draft.values.receipt}>Unavailable selected period · {draft.values.receipt}</option>}</select></label>
    {draft.values.receipt && !selected && <p className="break-words text-sm text-amber-900">The selected submitted period is unavailable in the current workspace. Your text is kept; select another period through the dirty-work decision.</p>}
    <p className="text-sm leading-6 text-neutral-600">Closure covers every submitted receipt and all employees in the exact company date window. Periodless legacy receipts cannot establish a closure window. No new time or overlapping ordinary preparation may bypass a closed window.</p>
    <label className="block text-sm font-medium" htmlFor="payroll-closure-date">Closure recorded date<input id="payroll-closure-date" {...errorAttributes(draft.issues, "payroll-closure-date")} className={fieldClass} type="date" required value={draft.values.recordedOn} onChange={event => draft.change(previous => ({ ...previous, recordedOn: event.target.value }))} /></label>
    <label className="block text-sm font-medium" htmlFor="payroll-closure-reason">Closure reason<textarea id="payroll-closure-reason" {...errorAttributes(draft.issues, "payroll-closure-reason")} className={fieldClass} required minLength={2} maxLength={500} rows={3} value={draft.values.reason} onChange={event => draft.change(previous => ({ ...previous, reason: event.target.value }))} /></label>
    <p className="text-xs leading-5 text-neutral-600">Final confirmation reviews temporary time, timers and payroll setup changes. Keep editing cancels that close attempt. Explicit Discard clears those listed drafts even if the later current-source confirmation refuses; this closure form's text stays intact. Saved pending payroll is preserved and may become stale.</p>
    <button type="submit" ref={opener} className={button}>Preview period closure</button>
    {draft.pending && <PayrollPreview preview={draft.pending.preview} onConfirm={() => { const handle = draft.pending!.handle; guardClosure(() => draft.confirm(handle)) }} onCancel={() => { draft.cancel(); opener.current?.focus() }} />}
    {draft.error && <p role="alert" className="break-words text-sm text-red-900">{draft.error}</p>}
    {draft.feedback && <p role="status" className="break-words text-sm text-emerald-900">{draft.feedback}</p>}
  </form>
}

function CorrectionForm({ receipts, port }: { receipts: PayrollReceiptChoice[]; port: HrPayrollControlProps['port'] }) {
  const draft = useControlDraft<CorrectionFields>({ id: correctionId, label: 'Fictional payroll correction', initial: { receipt: '', employeeId: '', recordedOn: '', reason: '', gross: '', withholding: '', benefits: '' }, port, normalize: correctionNormalization })
  const opener = useRef<HTMLButtonElement>(null)
  const request = useUnsavedTransition()
  const selected = receipts.find(receipt => receipt.receipt === draft.values.receipt)
  const employee = selected?.employees.find(item => item.employeeId === draft.values.employeeId)
  function select(receiptId: string, employeeId: string) {
    request({ portal: 'hr', ids: [correctionId], label: 'Change payroll correction target' }, () => {
      const target = receipts.find(receipt => receipt.receipt === receiptId)?.employees.find(person => person.employeeId === employeeId)
      draft.replace({ receipt: receiptId, employeeId, recordedOn: '', reason: '', gross: target ? dollars(target.cumulative.grossCents) : '', withholding: target ? dollars(target.cumulative.illustrativeWithholdingCents) : '', benefits: target ? dollars(target.cumulative.benefitDeductionCents) : '' })
    })
  }
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = draft.read(), receipt = receipts.find(item => item.receipt === values.receipt), subject = receipt?.employees.find(item => item.employeeId === values.employeeId)
    const issues: FieldIssue[] = []
    if (!receipt) issues.push({ field: 'payroll-correction-receipt', message: 'Choose an available original submitted receipt.' })
    if (!subject) issues.push({ field: 'payroll-correction-employee', message: 'Choose an employee captured in that original receipt.' })
    issues.push(...commonIssues(values, 'payroll-correction'))
    if (receipt?.period && validDate(values.recordedOn) && values.recordedOn < receipt.period.end) issues.push({ field: 'payroll-correction-date', message: 'The correction recorded date must be on or after the original period end.' })
    const gross = parseMoney(values.gross), withholding = parseMoney(values.withholding), benefits = parseMoney(values.benefits)
    for (const [name, amount, label] of [['gross', gross, 'gross'], ['withholding', withholding, 'withholding'], ['benefits', benefits, 'benefits']] as const) if (amount === null) issues.push({ field: `payroll-correction-${name}`, message: `Enter corrected ${label} as exact dollars with at most two decimals, from $0.00 to $10,000,000,000.00.` })
    if (gross !== null && withholding !== null && benefits !== null && gross - withholding - benefits < 0) issues.push({ field: 'payroll-correction-withholding', message: 'Corrected withholding plus benefits must not exceed corrected gross.' })
    if (!draft.validate(issues) || !subject || gross === null || withholding === null || benefits === null) return
    draft.preview({ kind: 'adjust-receipt', originalReceipt: values.receipt, employeeId: values.employeeId, recordedOn: values.recordedOn, reason: values.reason.trim(), proposed: { grossCents: gross, illustrativeWithholdingCents: withholding, benefitDeductionCents: benefits } })
  }
  return <form id={correctionId} aria-label="Create fictional payroll correction" className="min-w-0 space-y-4" noValidate onSubmit={preview}>
    <ErrorSummary issues={draft.issues} label="Payroll correction field errors" />
    <label className="block text-sm font-medium" htmlFor="payroll-correction-receipt">Original receipt<select id="payroll-correction-receipt" {...errorAttributes(draft.issues, "payroll-correction-receipt")} className={fieldClass} required value={draft.values.receipt} onChange={event => select(event.target.value, '')}><option value="">Choose an original submitted receipt</option>{receipts.map(receipt => <option key={receipt.receipt} value={receipt.receipt}>{receipt.receipt} · {receipt.period ? `${receipt.period.start} to ${receipt.period.end}` : 'Unknown legacy period'}</option>)}{draft.values.receipt && !selected && <option value={draft.values.receipt}>Unavailable original · {draft.values.receipt}</option>}</select></label>
    <label className="block text-sm font-medium" htmlFor="payroll-correction-employee">Correction employee<select id="payroll-correction-employee" {...errorAttributes(draft.issues, "payroll-correction-employee")} className={fieldClass} required value={draft.values.employeeId} onChange={event => select(draft.read().receipt, event.target.value)}><option value="">Choose a captured employee ID</option>{selected?.employees.map(person => <option key={person.employeeId} value={person.employeeId}>{person.employeeId}</option>)}{draft.values.employeeId && !employee && <option value={draft.values.employeeId}>Unavailable captured employee · {draft.values.employeeId}</option>}</select></label>
    {draft.values.receipt && (!selected || draft.values.employeeId && !employee) && <p className="break-words text-sm text-amber-900">This selected original or employee is unavailable in the current workspace. Your text is kept; no other target is selected automatically.</p>}
    {selected && <p className="break-words text-sm text-neutral-600">Original recorded period: {selected.period ? `${selected.period.start} to ${selected.period.end}` : 'Unknown — periodless legacy receipt; no dates are inferred'}. Employee IDs come from the original captured inputs, without an inferred historical name or rehire instance.</p>}
    {employee && <div className="grid min-w-0 gap-3 lg:grid-cols-2"><MoneyDetails title="Immutable original statement" value={employee.original} /><MoneyDetails title="Current cumulative balance" value={employee.cumulative} /></div>}
    <label className="block text-sm font-medium" htmlFor="payroll-correction-date">Correction recorded date<input id="payroll-correction-date" {...errorAttributes(draft.issues, "payroll-correction-date")} className={fieldClass} type="date" required value={draft.values.recordedOn} onChange={event => draft.change(previous => ({ ...previous, recordedOn: event.target.value }))} /></label>
    <label className="block text-sm font-medium" htmlFor="payroll-correction-reason">Correction reason<textarea id="payroll-correction-reason" {...errorAttributes(draft.issues, "payroll-correction-reason")} className={fieldClass} required minLength={2} maxLength={500} rows={3} value={draft.values.reason} onChange={event => draft.change(previous => ({ ...previous, reason: event.target.value }))} /></label>
    {(['gross', 'withholding', 'benefits'] as const).map(name => <label key={name} className="block text-sm font-medium" htmlFor={`payroll-correction-${name}`}>{name === 'gross' ? 'Corrected cumulative fictional gross (dollars)' : name === 'withholding' ? 'Corrected cumulative illustrative withholding (dollars)' : 'Corrected cumulative sample benefits (dollars)'}<input id={`payroll-correction-${name}`} {...errorAttributes(draft.issues, `payroll-correction-${name}`)} className={fieldClass} inputMode="decimal" type="text" required value={draft.values[name]} onChange={event => draft.change(previous => ({ ...previous, [name]: event.target.value }))} /></label>)}
    <p className="text-xs leading-5 text-neutral-600">Enter cumulative targets manually, not an extra payment. Net is gross minus both deductions. A separate signed delta is derived from the previous balance. No extra hours, automatic 20% tax, money transfer, debit, reversal or provider action occurs.</p>
    <button type="submit" ref={opener} className={button}>Preview payroll correction</button>
    {draft.pending && <PayrollPreview preview={draft.pending.preview} onConfirm={() => draft.confirm(draft.pending!.handle)} onCancel={() => { draft.cancel(); opener.current?.focus() }} />}
    {draft.error && <p role="alert" className="break-words text-sm text-red-900">{draft.error}</p>}
    {draft.feedback && <p role="status" className="break-words text-sm text-emerald-900">{draft.feedback}</p>}
  </form>
}

/** A writer-only permitted DTO is the entire read surface. Self-service and
 * auditor projection are mounted separately by the trusted HR root. */
export function HrPayrollControl({ view, port, guardClosure }: HrPayrollControlProps) {
  if (view.mode !== 'writer') return <p role="status">Payroll controls are unavailable in this preview scope.</p>
  return <section role="region" aria-label="Sample payroll closures and corrections" className="min-w-0 max-w-full space-y-6">
    <header className={panel}><h2 className="text-xl font-semibold">Sample payroll closures and corrections</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Explicitly close a submitted company date window or record a separate manual fictional monetary adjustment linked to an immutable original receipt. Local preview roles do not establish authentication. No payroll provider, tax engine or bank is contacted.</p></header>
    <section className={panel}><h3 className="mb-4 text-lg font-semibold">Close a submitted sample period</h3><ClosureForm receipts={view.receipts} port={port} guardClosure={guardClosure} /></section>
    <section className={panel}><h3 className="mb-4 text-lg font-semibold">Create a separate fictional payroll correction</h3><CorrectionForm receipts={view.receipts} port={port} /></section>
    <section className={panel} aria-label="Closed sample periods"><h3 className="text-lg font-semibold">Closed sample periods</h3>{view.closures.length ? <ul className="mt-3 space-y-3 text-sm">{view.closures.map(closure => <li key={closure.id} className="break-words rounded-lg border border-neutral-200 p-3">{closure.id} · {closure.period.start} to {closure.period.end} · recorded {closure.recordedOn}<span className="mt-1 block">Immutable original receipts: {closure.receiptIds.join(', ')}</span></li>)}</ul> : <p className="mt-3 text-sm text-neutral-600">No sample period has been explicitly closed.</p>}</section>
    <section className={panel} aria-label="Separate payroll adjustment receipts"><h3 className="text-lg font-semibold">Separate payroll adjustment receipts</h3><p className="mt-2 text-sm leading-6 text-neutral-600">Each signed adjustment references its original receipt. Proposed cumulative balances are displayed separately and are not added again to ordinary payroll totals.</p>{view.adjustments.map(adjustment => <article id={`payroll-adjustment-${adjustment.id}`} key={adjustment.id} aria-label={`Adjustment ${adjustment.adjustmentReceipt}`} className="mt-4 min-w-0 rounded-lg border border-neutral-200 p-4"><h4 className="break-words font-semibold">{adjustment.adjustmentReceipt}</h4><dl className="mt-2 grid gap-x-4 gap-y-1 break-words text-sm sm:grid-cols-[auto_minmax(0,1fr)]"><dt>Immutable original receipt</dt><dd><a className="underline" href={`#payroll-original-${adjustment.originalReceipt}`}>{adjustment.originalReceipt}</a></dd><dt>Captured employee ID</dt><dd>{adjustment.employeeId}</dd><dt>Recorded date</dt><dd>{adjustment.recordedOn}</dd><dt>Previous adjustment link</dt><dd>{adjustment.previousAdjustmentId ?? 'None — first adjustment'}</dd><dt>Reason</dt><dd className="whitespace-pre-wrap">{adjustment.reason}</dd></dl><div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2"><MoneyDetails title="Immutable original statement" value={adjustment.original} /><MoneyDetails title="Previous cumulative balance" value={adjustment.previous} /><MoneyDetails title="Separate signed adjustment" value={adjustment.delta} signed /><MoneyDetails title="Proposed cumulative balance" value={adjustment.proposed} /></div></article>)}{!view.adjustments.length && <p className="mt-3 text-sm text-neutral-600">No separate fictional payroll adjustments are recorded.</p>}</section>
  </section>
}
