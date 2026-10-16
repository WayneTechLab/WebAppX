import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AppLink } from '@/components/navigation/AppLink'
import { portalDirectoryHref, portalRegistry } from '@/portals/registry'
import { usePortalWorkspace } from '@/portals/PortalWorkspaceProvider'
import { DemoStorageNotice } from '@/portals/DemoStorageNotice'
import { DemoWorkspaceBackup } from '@/portals/DemoWorkspaceBackup'
import { DemoWorkspaceReset } from '@/portals/DemoWorkspaceReset'
import { useUnsavedTransition, useUnsavedWork } from '@/portals/unsaved-work'
import { canManageCrmOwnership, canWriteCrm, crmActors, crmDashboard, scopedCrmState, transitionCrm, type CrmActor, type CrmEvent, type CrmLead, type CrmOpportunity, type CrmState } from './model'
import { isCrmState } from './persistence'
import { CrmMergeHost } from './CrmMergeHost'
import { CrmDraftTabContext, crmDraftTab, useCrmDraftFocus } from './draft-tabs'
import { applyCrmOwnership, previewCrmOwnership, type CrmOwnershipPreview, type CrmOwnershipSelection } from './ownership'

const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-sky-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const ownerName = (id: string) => crmActors.find(actor => actor.id === id)?.label.split(' · ')[0] ?? 'Sample owner'
const tabs = [{ id: 'overview', label: 'Dashboard' }, { id: 'leads', label: 'Leads' }, { id: 'pipeline', label: 'Pipeline' }, { id: 'contacts', label: 'Companies & contacts' }, { id: 'tasks', label: 'Follow-up tasks' }, { id: 'ownership', label: 'Ownership' }, { id: 'merges', label: 'Duplicates & merges' }, { id: 'activity', label: 'Activity' }] as const
type Tab = typeof tabs[number]['id']
type Run = (event: CrmEvent) => boolean
type ScopedCrmState = ReturnType<typeof scopedCrmState>

function Panel({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-neutral-950">{title}</h2>{note && <p className="mt-2 text-sm leading-6 text-neutral-600">{note}</p>}<div className="mt-5">{children}</div></section>
}
function Empty({ children }: { children: ReactNode }) { return <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">{children}</p> }
function Status({ children }: { children: ReactNode }) { return <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold capitalize text-sky-900">{children}</span> }
function UnavailableOption({ value, available, kind }: { value: string; available: boolean; kind: string }) {
  return value && !available ? <option value={value}>Unavailable selected {kind} · {value}</option> : null
}

/** CRM inputs are temporary buffers. Accepted domain actions rebase only the
 * submitted form, including when persistence is unavailable for this browser.
 */
function useCrmDraft<T extends Record<string, string>>(id: string, label: string, initial: T, normalize: (value: T) => T = value => value, onDiscard?: () => void) {
  const [draft, setRenderedDraft] = useState(initial)
  const current = useRef(initial)
  const baseline = useRef(initial)
  const formRef = useRef<HTMLFormElement>(null)
  const focusDraft = useCrmDraftFocus(crmDraftTab(id), () => formRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus())
  function setDraft(update: T | ((previous: T) => T)) {
    const next = typeof update === 'function' ? update(current.current) : update
    current.current = next
    setRenderedDraft(next)
  }
  function reset(next: T = baseline.current) { baseline.current = next; setDraft({ ...next }) }
  useUnsavedWork({
    id: `crm:${id}`,
    portal: 'crm',
    label,
    isDirty: () => {
      const values = normalize(current.current), accepted = normalize(baseline.current)
      return Object.keys(accepted).some(key => values[key] !== accepted[key])
    },
    discard: () => { reset(); onDiscard?.() },
    focus: focusDraft,
  })
  return { draft, setDraft, reset, formRef }
}

function CreateLead({ run }: { run: Run }) {
  const { draft, setDraft, reset, formRef } = useCrmDraft('lead', 'New CRM lead', { name: '', email: '', companyName: '' })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (run({ type: 'create-lead', ...draft })) reset() }
  return <Panel title="Create a fictional lead" note="Use a .invalid email address. Qualify the lead before converting it; conversion creates one linked opportunity."><form ref={formRef} className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><label className="text-sm font-medium">Lead name<input className={field} name="name" required minLength={2} maxLength={120} placeholder="Jules Sample" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="text-sm font-medium">Lead email<input className={field} name="email" type="email" required maxLength={160} placeholder="jules@example.invalid" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><label className="text-sm font-medium">Lead company<input className={field} name="companyName" required minLength={2} maxLength={120} placeholder="Sample Meadow Lab" value={draft.companyName} onChange={event => setDraft({ ...draft, companyName: event.target.value })} /></label><button className={button + ' self-end'} type="submit">Create sample lead</button></form></Panel>
}

function LeadCard({ lead, writable, run }: { lead: CrmLead; writable: boolean; run: Run }) {
  const { draft, setDraft, reset, formRef } = useCrmDraft(`convert:${lead.id}`, `Conversion amount for ${lead.name}`, { amount: '1500' })
  function convert(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (run({ type: 'convert-lead', leadId: lead.id, amountCents: Math.round(Number(draft.amount) * 100) })) reset() }
  return <article className="rounded-lg border border-neutral-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{lead.name}</h3><p className="mt-1 text-sm text-neutral-600">{lead.companyName}</p></div><Status>{lead.status}</Status></div><p className="mt-3 break-all text-sm text-neutral-600">{lead.email}</p><p className="mt-2 text-xs text-neutral-500">Owner: {ownerName(lead.ownerId)} · {lead.id}</p>
    {writable && lead.status === 'new' && <button className={button + ' mt-4'} type="button" onClick={() => run({ type: 'qualify-lead', leadId: lead.id })}>Qualify sample lead</button>}
    {writable && lead.status === 'qualified' && <form ref={formRef} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]" onSubmit={convert}><label className="text-sm font-medium">Sample opportunity amount (USD)<input className={field} name="amount" type="number" min="0.01" max="1000000" step="0.01" required value={draft.amount} onChange={event => setDraft({ amount: event.target.value })} /></label><button className={button} type="submit">Convert sample lead</button></form>}
    {lead.status === 'converted' && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">Converted once. Company {lead.companyId}, contact {lead.contactId} and opportunity {lead.opportunityId} are linked in the pipeline and directory.</p>}
  </article>
}

function OpportunityCard({ opportunity, state, writable, run }: { opportunity: CrmOpportunity; state: ScopedCrmState; writable: boolean; run: Run }) {
  const next = opportunity.stage === 'discovery' ? 'proposal' : opportunity.stage === 'proposal' ? 'negotiation' : opportunity.stage === 'negotiation' ? 'won' : null
  const company = state.companies.find(record => record.id === opportunity.companyId)
  const contact = state.contacts.find(record => record.id === opportunity.contactId)
  return <article className="rounded-lg border border-neutral-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{opportunity.title}</h3><p className="mt-1 text-sm text-neutral-600">{company?.name} · {contact?.name}</p></div><Status>{opportunity.stage}</Status></div><p className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950">{money(opportunity.amountCents)}</p><p className="mt-2 text-xs text-neutral-500">Illustrative USD · Owner: {ownerName(opportunity.ownerId)} · {opportunity.id}</p>{writable && next && <div className="mt-4 flex flex-wrap gap-2"><button className={button} type="button" onClick={() => run({ type: 'advance-opportunity', opportunityId: opportunity.id, stage: next })}>{next === 'won' ? 'Mark sample won' : `Move to ${next}`}</button><button className={secondary} type="button" onClick={() => run({ type: 'advance-opportunity', opportunityId: opportunity.id, stage: 'lost' })}>Mark sample lost</button></div>}{!next && <p className="mt-4 text-xs text-neutral-500">Closed sample record. No invoice, payment or contract is created.</p>}</article>
}

function CreateOpportunity({ state, run }: { state: ScopedCrmState; run: Run }) {
  const initialCompany = state.companies[0]?.id ?? ''
  const defaults = { title: '', companyId: initialCompany, contactId: state.contacts.find(contact => contact.companyId === initialCompany)?.id ?? '', amount: '2500' }
  const { draft, setDraft, reset, formRef } = useCrmDraft('opportunity', 'New CRM opportunity', defaults)
  const contacts = state.contacts.filter(contact => contact.companyId === draft.companyId)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (run({ type: 'create-opportunity', title: draft.title, companyId: draft.companyId, contactId: draft.contactId, amountCents: Math.round(Number(draft.amount) * 100) })) reset(defaults)
  }
  return <Panel title="Create a sample opportunity" note="Choose an existing company and one of its contacts. The company owner owns the opportunity."><form ref={formRef} className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><label className="text-sm font-medium sm:col-span-2">Opportunity title<input className={field} name="title" required minLength={2} maxLength={120} placeholder="Fictional portal workshop" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><div className="text-sm font-medium"><label htmlFor="crm-opportunity-company">Opportunity company</label><select id="crm-opportunity-company" aria-describedby={draft.companyId && !state.companies.some(company => company.id === draft.companyId) ? 'crm-opportunity-company-unavailable' : undefined} className={field} name="companyId" required value={draft.companyId} onChange={event => { const companyId = event.target.value; setDraft({ ...draft, companyId, contactId: state.contacts.find(contact => contact.companyId === companyId)?.id ?? '' }) }}>{state.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}<UnavailableOption value={draft.companyId} available={state.companies.some(company => company.id === draft.companyId)} kind="company" /></select>{draft.companyId && !state.companies.some(company => company.id === draft.companyId) && <span id="crm-opportunity-company-unavailable" className="mt-2 block text-sm text-amber-900">Your selected company is unavailable. Your title, amount and selections are kept; choose a current company explicitly.</span>}</div><div className="text-sm font-medium"><label htmlFor="crm-opportunity-contact">Opportunity contact</label><select id="crm-opportunity-contact" aria-describedby={draft.contactId && !contacts.some(contact => contact.id === draft.contactId) ? 'crm-opportunity-contact-unavailable' : undefined} className={field} name="contactId" required value={draft.contactId} onChange={event => setDraft({ ...draft, contactId: event.target.value })}>{!contacts.length && <option value="">Create a company contact first</option>}{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}<UnavailableOption value={draft.contactId} available={contacts.some(contact => contact.id === draft.contactId)} kind="contact" /></select>{draft.contactId && !contacts.some(contact => contact.id === draft.contactId) && <span id="crm-opportunity-contact-unavailable" className="mt-2 block text-sm text-amber-900">Your selected contact is unavailable for this company. Choose a current contact; no merge alias changes this draft.</span>}</div><label className="text-sm font-medium">Opportunity amount (USD)<input className={field} name="amount" type="number" required min="0.01" max="1000000" step="0.01" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></label><button className={button + ' self-end'} disabled={!contacts.length} type="submit">Create sample opportunity</button></form></Panel>
}

function CreateCompany({ run }: { run: Run }) {
  const { draft, setDraft, reset, formRef } = useCrmDraft('company', 'New CRM company', { name: '' })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (run({ type: 'create-company', name: draft.name })) reset() }
  return <Panel title="Create a fictional company"><form ref={formRef} className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Company name<input className={field} name="name" required minLength={2} maxLength={120} placeholder="Example Meadow Studio" value={draft.name} onChange={event => setDraft({ name: event.target.value })} /></label><button className={button} type="submit">Create sample company</button></form></Panel>
}

function CreateContact({ state, run }: { state: ScopedCrmState; run: Run }) {
  const defaults = { name: '', email: '', companyId: state.companies[0]?.id ?? '' }
  // The first company can be created beside this still-mounted form. An empty
  // selection then becomes its automatic default without erasing typed text or
  // making the new default itself an unsaved edit.
  const normalize = (value: typeof defaults) => ({ ...value, companyId: value.companyId || defaults.companyId })
  const { draft, setDraft, reset, formRef } = useCrmDraft('contact', 'New CRM contact', defaults, normalize)
  const companyId = normalize(draft).companyId
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (run({ type: 'create-contact', ...draft, companyId })) reset(defaults) }
  return <Panel title="Create a fictional contact"><form ref={formRef} className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Contact name<input className={field} name="name" required minLength={2} maxLength={120} placeholder="Robin Fiction" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="block text-sm font-medium">Contact email<input className={field} name="email" required type="email" maxLength={160} placeholder="robin@example.invalid" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><div className="block text-sm font-medium"><label htmlFor="crm-contact-company">Contact company</label><select id="crm-contact-company" aria-describedby={companyId && !state.companies.some(company => company.id === companyId) ? 'crm-contact-company-unavailable' : undefined} className={field} name="companyId" required value={companyId} onChange={event => setDraft({ ...draft, companyId: event.target.value })}>{!state.companies.length && <option value="">Create a company first</option>}{state.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}<UnavailableOption value={companyId} available={state.companies.some(company => company.id === companyId)} kind="company" /></select>{companyId && !state.companies.some(company => company.id === companyId) && <span id="crm-contact-company-unavailable" className="mt-2 block text-sm text-amber-900">Your selected company is unavailable. Your name, email and company choice are kept; choose a current company explicitly.</span>}</div><button className={button} disabled={!state.companies.length} type="submit">Create sample contact</button></form></Panel>
}

function Directory({ state, writable, run }: { state: ScopedCrmState; writable: boolean; run: Run }) {
  return <div className="space-y-5">{writable && <div className="grid items-start gap-5 xl:grid-cols-2"><CreateCompany run={run} /><CreateContact state={state} run={run} /></div>}<Panel title="Companies and their contacts" note="Only records within this preview identity’s scope are included."><div className="space-y-4">{state.companies.map(company => <article key={company.id} className="rounded-lg border border-neutral-200 p-4"><h3 className="font-semibold text-neutral-950">{company.name}</h3><p className="mt-1 text-xs text-neutral-500">{company.id} · Owner: {ownerName(company.ownerId)}</p><ul className="mt-4 space-y-2">{state.contacts.filter(contact => contact.companyId === company.id).map(contact => <li key={contact.id} className="rounded-md bg-neutral-50 p-3 text-sm"><span className="font-medium text-neutral-950">{contact.name}</span><span className="mt-1 block break-all text-neutral-600">{contact.email}</span></li>)}</ul>{!state.contacts.some(contact => contact.companyId === company.id) && <p className="mt-3 text-sm text-neutral-500">No sample contacts yet.</p>}</article>)}{!state.companies.length && <Empty>No companies are visible to this identity.</Empty>}</div></Panel></div>
}

type CommitOwnership = (selection: CrmOwnershipSelection, confirmation: string) => { ok: boolean; message: string }

function OwnershipForm({ kind, state, actor, commit }: { kind: CrmOwnershipSelection['kind']; state: CrmState; actor: CrmActor; commit: CommitOwnership }) {
  const leadAssignment = kind === 'lead-assignment'
  const records = leadAssignment ? state.leads.filter(lead => lead.status !== 'converted').map(lead => ({ id: lead.id, label: lead.name, ownerId: lead.ownerId })) : state.companies.map(company => ({ id: company.id, label: company.name, ownerId: company.ownerId }))
  const [preview, setPreview] = useState<CrmOwnershipPreview | null>(null)
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null)
  const { draft, setDraft, reset, formRef } = useCrmDraft(`ownership:${kind}`, leadAssignment ? 'CRM lead assignment selection' : 'CRM account ownership transfer selection', { recordId: '', newOwnerId: '' }, value => value, () => { setPreview(null); setNotice(null) })
  const selection: CrmOwnershipSelection = leadAssignment ? { kind: 'lead-assignment', leadId: draft.recordId, newOwnerId: draft.newOwnerId } : { kind: 'account-transfer', companyId: draft.recordId, newOwnerId: draft.newOwnerId }
  const title = leadAssignment ? 'Reassign an unconverted lead' : 'Transfer a sample account'
  const previewLabel = leadAssignment ? 'Lead assignment preview' : 'Account ownership transfer preview'
  function select(fieldName: 'recordId' | 'newOwnerId', value: string) { setDraft({ ...draft, [fieldName]: value }); setPreview(null); setNotice(null) }
  function review(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice(null); setPreview(previewCrmOwnership(state, actor, selection)) }
  function confirm() {
    if (!preview?.ok) return
    const result = commit(selection, preview.confirmation)
    setNotice(null); setPreview(null)
    if (result.ok) reset(draft)
  }
  return <Panel title={title} note={leadAssignment ? 'Owner and sales manager previews can assign one new or qualified lead to another fictional assignee.' : 'Review every linked record before moving an account. A confirmation accepts the complete graph together.'}>
    <form ref={formRef} aria-label={title} className="grid gap-4 sm:grid-cols-2" onSubmit={review}>
      <div className="text-sm font-medium"><label htmlFor={`crm-ownership-${kind}-record`}>{leadAssignment ? 'Lead to reassign' : 'Account to transfer'}</label><select id={`crm-ownership-${kind}-record`} aria-describedby={draft.recordId && !records.some(record => record.id === draft.recordId) ? `crm-ownership-${kind}-record-unavailable` : undefined} className={field} required value={draft.recordId} onChange={event => select('recordId', event.target.value)}><option value="">Choose a sample {leadAssignment ? 'lead' : 'account'}</option>{records.map(record => <option key={record.id} value={record.id}>{record.label} · {record.id} · {ownerName(record.ownerId)}</option>)}<UnavailableOption value={draft.recordId} available={records.some(record => record.id === draft.recordId)} kind={leadAssignment ? 'lead' : 'account'} /></select>{draft.recordId && !records.some(record => record.id === draft.recordId) && <span id={`crm-ownership-${kind}-record-unavailable`} className="mt-2 block text-sm text-amber-900">This selected record is unavailable. Your ownership choices are kept; choose a current record explicitly.</span>}</div>
      <label className="text-sm font-medium">{leadAssignment ? 'New lead assignee' : 'New account owner'}<select className={field} required value={draft.newOwnerId} onChange={event => select('newOwnerId', event.target.value)}><option value="">Choose a fictional assignee</option>{crmActors.filter(candidate => candidate.role !== 'auditor').map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>
      <button className={button + ' justify-self-start sm:col-span-2'} disabled={!records.length} type="submit">{leadAssignment ? 'Preview lead assignment' : 'Preview account transfer'}</button>
    </form>
    {preview && !preview.ok && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">{preview.message}</p>}
    {preview?.ok && <section role="region" aria-label={previewLabel} className="mt-5 space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-semibold text-neutral-950">Ownership preview ready</h3>
      <p role="status" className="text-sm font-semibold text-neutral-900">{leadAssignment ? 'Ready to assign this unconverted lead.' : 'Ready to transfer this complete linked account.'} Current assignee: {ownerName(preview.fromOwnerId)}. New assignee: {ownerName(preview.toOwnerId)}.</p>
      <p className="text-sm text-neutral-700">Affected records: {preview.affected.companies.length} companies · {preview.affected.contacts.length} contacts · {preview.affected.leads.length} leads · {preview.affected.opportunities.length} opportunities · {preview.affected.tasks.length} follow-ups. Every affected record is listed below.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left font-semibold">Complete affected record list</caption><thead><tr>{['Record type', 'Identifier', 'Record', 'Current assignee', 'New assignee'].map(label => <th className="border-b border-amber-300 p-2" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{preview.rows.map(row => <tr key={`${row.kind}:${row.id}`}><td className="p-2">{row.kind}</td><td className="break-all p-2">{row.id}</td><td className="p-2">{row.label}</td><td className="p-2">{ownerName(row.fromOwnerId)}</td><td className="p-2">{ownerName(row.toOwnerId)}</td></tr>)}</tbody></table></div>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      <div className="flex flex-wrap gap-3"><button className={button} type="button" onClick={confirm}>{leadAssignment ? 'Confirm lead assignment' : 'Confirm account transfer'}</button><button className={secondary} type="button" onClick={() => { setPreview(null); setNotice({ error: false, message: 'Preview canceled. CRM records are unchanged. Your selection is still temporary.' }) }}>{leadAssignment ? 'Cancel lead assignment preview' : 'Cancel account transfer preview'}</button></div>
    </section>}
    {notice && <p role={notice.error ? 'alert' : 'status'} className={`mt-4 rounded-md border p-4 text-sm ${notice.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{notice.message}</p>}
  </Panel>
}

function CreateTask({ state, run }: { state: ScopedCrmState; run: Run }) {
  const open = state.opportunities.filter(opportunity => !['won', 'lost'].includes(opportunity.stage))
  const defaults = { title: '', opportunityId: open[0]?.id ?? '' }
  const { draft, setDraft, reset, formRef } = useCrmDraft('follow-up', 'New CRM follow-up', defaults)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (run({ type: 'create-task', ...draft })) reset(defaults) }
  return <Panel title="Assign a sample follow-up" note="The task belongs to the selected opportunity’s owner. No calendar event or message is sent."><form ref={formRef} className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><label className="text-sm font-medium">Follow-up title<input className={field} name="title" minLength={2} maxLength={120} required placeholder="Prepare fictional proposal notes" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><div className="text-sm font-medium"><label htmlFor="crm-task-opportunity">Follow-up opportunity</label><select id="crm-task-opportunity" aria-describedby={draft.opportunityId && !open.some(opportunity => opportunity.id === draft.opportunityId) ? 'crm-task-opportunity-unavailable' : undefined} className={field} name="opportunityId" required value={draft.opportunityId} onChange={event => setDraft({ ...draft, opportunityId: event.target.value })}>{!open.length && <option value="">No open sample opportunities</option>}{open.map(opportunity => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}<UnavailableOption value={draft.opportunityId} available={open.some(opportunity => opportunity.id === draft.opportunityId)} kind="opportunity" /></select>{draft.opportunityId && !open.some(opportunity => opportunity.id === draft.opportunityId) && <span id="crm-task-opportunity-unavailable" className="mt-2 block text-sm text-amber-900">This selected opportunity is unavailable for a new follow-up. Your title and selection are kept; choose an open opportunity explicitly.</span>}</div><button className={button + ' justify-self-start'} type="submit" disabled={!open.length}>Create sample follow-up</button></form></Panel>
}

function Tasks({ state, writable, run }: { state: ScopedCrmState; writable: boolean; run: Run }) {
  return <div className="space-y-5">{writable && <CreateTask state={state} run={run} />}<Panel title="Follow-up task queue"><div className="space-y-3">{state.tasks.map(task => <article key={task.id} className="rounded-lg border border-neutral-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">{task.title}</h3><p className="mt-1 text-sm text-neutral-600">{state.opportunities.find(opportunity => opportunity.id === task.opportunityId)?.title}</p><p className="mt-2 text-xs text-neutral-500">Assigned to {ownerName(task.ownerId)}</p></div><Status>{task.status}</Status></div>{writable && task.status === 'open' && <button className={button + ' mt-4'} type="button" onClick={() => run({ type: 'complete-task', taskId: task.id })}>Complete sample follow-up</button>}</article>)}{!state.tasks.length && <Empty>No sample follow-up tasks in this scope.</Empty>}</div></Panel></div>
}

export function CrmDemo() {
  const workspace = usePortalWorkspace('crm')
  const { state, setState, reset: resetSavedState, status: storageStatus, importState } = workspace
  const requestTransition = useUnsavedTransition()
  const [actorId, setActorId] = useState('crm-owner')
  const [tab, setTab] = useState<Tab>('overview')
  const [openedTabs, setOpenedTabs] = useState<Set<Tab>>(() => new Set(['overview']))
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const [generation, setGeneration] = useState(0)
  const actor = crmActors.find(candidate => candidate.id === actorId) as CrmActor
  const latestActor = useRef(actor)
  useLayoutEffect(() => { latestActor.current = actor }, [actor])
  const latestTab = useRef(tab)
  const modeGeneration = useRef(0)
  const visible = scopedCrmState(state, actor)
  const dashboard = crmDashboard(state, actor)
  const writable = canWriteCrm(actor)
  function activeActor() {
    const candidate = latestActor.current
    if (window.location.pathname.replace(/\/+$/, '') !== portalRegistry.find(portal => portal.id === 'crm')?.href || !candidate || !crmActors.some(known => known.id === candidate.id && known.role === candidate.role)) throw new Error('This CRM action is unavailable in the current preview. No records changed.')
    return candidate
  }
  function run(event: CrmEvent) {
    try {
      activeActor()
      let accepted: CrmState | undefined
      setState(current => { accepted = transitionCrm(current, activeActor(), event); return accepted })
      if (!accepted) throw new Error('The current CRM update was unavailable. No records changed.')
      setFeedback({ message: `${accepted.activity[0].receipt} · ${accepted.activity[0].description}`, error: false })
      return true
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Sample action failed.', error: true }); return false }
  }
  const commitOwnership: CommitOwnership = (selection, confirmation) => {
    let message = ''
    try {
      activeActor()
      setState(current => {
        const result = applyCrmOwnership(current, activeActor(), selection, confirmation)
        if (!result.ok) throw new Error(result.message)
        message = `${result.receipt} · ${result.state.activity[0].description}`
        return result.state
      })
      setFeedback({ message, error: false })
      return { ok: true, message }
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'The entire ownership change was refused. No records changed.'
      setFeedback({ message, error: true })
      return { ok: false, message }
    }
  }
  function revealTab(next: Tab) {
    if (next === latestTab.current) return
    latestTab.current = next; modeGeneration.current++
    setOpenedTabs(previous => new Set([...previous, next])); setTab(next)
  }
  function changeTab(next: Tab) { if (next !== latestTab.current) requestTransition({ portal: 'crm', retain: true, label: `Open CRM ${tabs.find(item => item.id === next)?.label ?? 'page'}` }, () => revealTab(next)) }
  function reset(confirmation?: string) {
    const result = resetSavedState(confirmation)
    if (result && !result.ok) return result
    modeGeneration.current++; latestTab.current = 'overview'; setOpenedTabs(new Set(['overview'])); setGeneration(value => value + 1); setFeedback({ message: 'Original CRM records are restored in this view; HR and CMS samples are unchanged.', error: false }); setTab('overview')
    return result
  }
  return <CrmDraftTabContext.Provider value={revealTab}><section aria-label="CRM mock workspace" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950"><strong>Account-free CRM demo.</strong> Use fictional information only. Saved actions stay in this browser across refresh and navigation when local storage is available. Unsaved form edits are temporary. Reset CRM demo clears only CRM samples. No emails, payments, provider calls or real customer records are created.</div><div className="mt-4"><DemoStorageNotice status={storageStatus} /></div><DemoWorkspaceBackup key={generation} module="crm" recovery={workspace.recovery} state={state} validate={isCrmState} summarize={value => `${value.companies.length} companies · ${value.leads.length} leads · ${value.opportunities.length} opportunities · ${value.activity.length} actions`} onImport={(value, confirmation) => {
    const result = importState(value, confirmation)
    if (result.ok) { modeGeneration.current++; latestActor.current = crmActors[0]; latestTab.current = 'overview'; setOpenedTabs(new Set(['overview'])); setActorId('crm-owner'); setTab('overview'); setGeneration(previous => previous + 1); setFeedback({ message: result.status.message, error: false }) }
    return result
  }} /><header className="mt-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-800">WebAppX · Customer workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">CRM portal</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">Take fictional leads from qualification to a linked opportunity, manage a sample pipeline and complete owner-assigned follow-ups.</p></div><DemoWorkspaceReset className={secondary} module="crm" recovery={workspace.recovery} onReset={reset}>Reset CRM demo</DemoWorkspaceReset></header><nav aria-label="Template portals" className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-sky-900"><AppLink className="inline-flex min-h-11 items-center underline underline-offset-4" to={portalDirectoryHref}>All portals</AppLink>{portalRegistry.filter(portal => portal.id !== 'crm').map(portal => <AppLink key={portal.id} className="inline-flex min-h-11 items-center underline underline-offset-4" to={portal.href}>{portal.workspaceLabel}</AppLink>)}</nav><section className="mt-5 rounded-xl border border-neutral-200 bg-white p-4"><label className="block max-w-lg text-sm font-semibold text-neutral-950">CRM preview identity<select className={field} value={actorId} onChange={event => { const next = event.target.value; const selected = crmActors.find(candidate => candidate.id === next); if (!selected) return; requestTransition({ portal: 'crm', label: 'Change CRM preview identity' }, () => { modeGeneration.current++; latestActor.current = selected; setActorId(next); setFeedback(null) }) }}>{crmActors.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label><p className="mt-3 text-xs leading-5 text-neutral-600">{actor.role === 'sales-rep' ? 'You can see and change your own companies, contacts, leads, opportunities and follow-ups.' : actor.role === 'auditor' ? 'Read-only access to synthetic CRM records. Write actions are unavailable.' : 'Owner and sales manager previews can manage all synthetic CRM records.'} This role switch demonstrates access rules; production authentication and server enforcement remain adoption work.</p></section><nav aria-label="CRM pages" className="mt-5 flex flex-wrap gap-2">{tabs.map(item => <button className={tab === item.id ? button : secondary} type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => changeTab(item.id)}>{item.label}</button>)}</nav>{feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-5 rounded-lg border p-4 text-sm ${feedback.error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{feedback.message}</p>}<div key={`${actorId}:${generation}:${workspace.replacementEpoch}`} className="mt-6 space-y-5">
    {openedTabs.has('overview') && <div hidden={tab !== 'overview'} className="min-w-0 space-y-5">{(<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Active sample leads', value: dashboard.leads }, { label: 'Open sample pipeline', value: money(dashboard.pipelineCents) }, { label: 'Sample won value', value: money(dashboard.wonCents) }, { label: 'Open follow-ups', value: dashboard.openTasks }].map(stat => <section key={stat.label} className="rounded-xl border border-neutral-200 bg-white p-5"><h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">{stat.label}</h2><p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">{stat.value}</p></section>)}</div><Panel title="Your CRM action inbox" note="Counts and actions follow the selected identity and update as you work."><div className="grid gap-3 sm:grid-cols-3">{[{ target: 'leads' as Tab, title: 'Qualify and convert', count: dashboard.leads, detail: 'active sample leads' }, { target: 'pipeline' as Tab, title: 'Move opportunities forward', count: dashboard.openOpportunities, detail: 'open sample opportunities' }, { target: 'tasks' as Tab, title: 'Complete follow-ups', count: dashboard.openTasks, detail: 'open owner-assigned tasks' }].map(item => <button key={item.target} type="button" className="rounded-lg border border-neutral-200 p-4 text-left hover:bg-sky-50" onClick={() => changeTab(item.target)}><span className="block font-semibold text-neutral-950">{item.title}</span><span className="mt-2 block text-sm text-neutral-600">{item.count} {item.detail}</span></button>)}</div></Panel><Panel title="Linked account directory"><p className="text-sm text-neutral-600">{dashboard.companies} fictional companies · {dashboard.contacts} contacts · {dashboard.activities} successful sample actions</p><button className={secondary + ' mt-4'} type="button" onClick={() => changeTab('contacts')}>Browse companies and contacts</button></Panel></>)}</div>}
    {openedTabs.has('leads') && <div hidden={tab !== 'leads'} className="min-w-0 space-y-5">{(<>{writable && <CreateLead run={run} />}<Panel title="Sample lead queue"><div className="grid items-start gap-4 xl:grid-cols-2">{visible.leads.map(lead => <LeadCard key={lead.id} lead={lead} writable={writable} run={run} />)}{!visible.leads.length && <Empty>No sample leads in this scope.</Empty>}</div></Panel></>)}</div>}
    {openedTabs.has('pipeline') && <div hidden={tab !== 'pipeline'} className="min-w-0 space-y-5">{(<>{writable && <CreateOpportunity state={visible} run={run} />}<Panel title="Sample opportunity pipeline" note="Stages: discovery → proposal → negotiation → won. An open opportunity can also be marked lost. All amounts are fictional USD."><div className="grid items-start gap-4 xl:grid-cols-2">{visible.opportunities.map(opportunity => <OpportunityCard key={opportunity.id} opportunity={opportunity} state={visible} writable={writable} run={run} />)}{!visible.opportunities.length && <Empty>No sample opportunities in this scope.</Empty>}</div></Panel></>)}</div>}
    {openedTabs.has('contacts') && <div hidden={tab !== 'contacts'} className="min-w-0 space-y-5">{(<Directory state={visible} writable={writable} run={run} />)}</div>}
    {openedTabs.has('tasks') && <div hidden={tab !== 'tasks'} className="min-w-0 space-y-5">{(<Tasks state={visible} writable={writable} run={run} />)}</div>}
    {openedTabs.has('ownership') && <div hidden={tab !== 'ownership'} className="min-w-0 space-y-5">{((canManageCrmOwnership(actor) ? <><OwnershipForm kind="lead-assignment" state={state} actor={actor} commit={commitOwnership} /><OwnershipForm kind="account-transfer" state={state} actor={actor} commit={commitOwnership} /></> : <p role="status" className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">Ownership changes are available only to owner and sales manager previews. No account graph is exposed in this identity.</p>))}</div>}
    {openedTabs.has('merges') && <div hidden={tab !== 'merges'} className="min-w-0 space-y-5">{(<CrmMergeHost
      readCurrent={workspace.readCurrentState}
      readActor={() => ({ id: latestActor.current.id, role: latestActor.current.role })}
      readEpoch={workspace.getReplacementEpoch}
      readModeGeneration={() => modeGeneration.current}
      readActive={() => latestTab.current === 'merges' && window.location.pathname.replace(/\/+$/, '') === '/crm/demo'}
      replaceCurrent={build => {
        activeActor()
        let ran = false
        setState(current => {
          if (ran) throw new Error('The trusted CRM update callback ran more than once.')
          ran = true
          activeActor()
          const next = build(current)
          return next
        })
        return ran
      }}
    />)}</div>}
    {openedTabs.has('activity') && <div hidden={tab !== 'activity'} className="min-w-0 space-y-5">{(<Panel title="Sample CRM activity" note="Successful state changes create receipts. Rejected actions do not create activity. These receipts never contact a provider."><ol className="space-y-3">{visible.activity.map(activity => <li className="rounded-lg border border-neutral-200 p-4" key={activity.receipt}><p className="text-xs font-semibold text-sky-900">{activity.receipt}</p><p className="mt-2 text-sm text-neutral-700">{activity.description}</p><p className="mt-2 text-xs text-neutral-500">Record owner: {ownerName(activity.ownerId)}</p></li>)}</ol>{!visible.activity.length && <Empty>No sample actions yet. Qualify a lead or complete a follow-up to begin.</Empty>}</Panel>)}</div>}
  </div></section></CrmDraftTabContext.Provider>
}
