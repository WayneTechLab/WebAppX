import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type SetStateAction } from 'react'
import { AppLink } from '@/components/navigation/AppLink'
import { portalDirectoryHref, portalRegistry } from '@/portals/registry'
import { usePortalWorkspace } from '@/portals/PortalWorkspaceProvider'
import { DemoStorageNotice } from '@/portals/DemoStorageNotice'
import { DemoWorkspaceBackup } from '@/portals/DemoWorkspaceBackup'
import { DemoWorkspaceReset } from '@/portals/DemoWorkspaceReset'
import { useUnsavedWork, useVolatileSlot } from '@/portals/unsaved-work'
import { cmsActors, cmsCollections, cmsDraftIsDirty, cmsPublishedEntries, transitionCms, validateCmsDraft, type CmsActor, type CmsContent, type CmsDraftField, type CmsDraftIssue, type CmsEvent } from './model'
import { compareCmsEditor, createCmsEditorBuffer, resolveCmsEditor, type CmsEditorBuffer } from './editor-recovery'
import { isCmsState } from './persistence'

const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'
const panel = 'rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'

const draftLabels: Record<CmsDraftField, string> = { collectionId: 'New content collection', title: 'Content title', slug: 'Content slug', body: 'Plain-text content' }
const emptyCreateDraft = () => ({ collectionId: 'pages', title: '', slug: '', body: '' })

/** Form decisions can run in the same event turn as a successful action. */
function useImmediateState<T>(initial: () => T) {
  const [value, commit] = useState(initial)
  const current = useRef(value)
  function setValue(update: SetStateAction<T>) {
    const next = typeof update === 'function' ? (update as (previous: T) => T)(current.current) : update
    current.current = next
    commit(next)
  }
  return [value, setValue, current] as const
}

function ValidationSummary({ errors, prefix }: { errors: CmsDraftIssue[]; prefix: 'edit' | 'create' }) {
  if (!errors.length) return null
  return <div role="alert" aria-label={prefix === 'edit' ? 'Edit draft validation' : 'Create draft validation'} className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Check these fields before saving:</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map(issue => <li key={issue.field}><a className="underline" href={`#${prefix}-${issue.field}`} onClick={event => { event.preventDefault(); document.getElementById(`${prefix}-${issue.field}`)?.focus() }}>{draftLabels[issue.field]}: {issue.message}</a></li>)}</ul></div>
}

function ContentFields({ value, onChange, errors, prefix }: { value: CmsContent; onChange: (name: keyof CmsContent, value: string) => void; errors: CmsDraftIssue[]; prefix: string }) {
  const issue = (name: keyof CmsContent) => errors.find(error => error.field === name)
  return <>
    <div><label className="block text-sm font-medium" htmlFor={`${prefix}-title`}>Content title</label><input id={`${prefix}-title`} name="title" className={field} required minLength={3} maxLength={100} value={value.title} onChange={event => onChange('title', event.target.value)} aria-invalid={!!issue('title')} aria-describedby={issue('title') ? `${prefix}-title-error` : undefined} placeholder="A fictional studio update" />{issue('title') && <p id={`${prefix}-title-error`} className="mt-1 text-sm text-red-800">{issue('title')!.message}</p>}</div>
    <div><label className="block text-sm font-medium" htmlFor={`${prefix}-slug`}>Content slug</label><input id={`${prefix}-slug`} name="slug" className={field} required maxLength={80} value={value.slug} onChange={event => onChange('slug', event.target.value)} aria-invalid={!!issue('slug')} aria-describedby={`${prefix}-slug-help${issue('slug') ? ` ${prefix}-slug-error` : ''}`} placeholder="fictional-studio-update" /><p id={`${prefix}-slug-help`} className="mt-1 text-xs text-neutral-500">Letters, numbers and single hyphens. Unique within this collection.</p>{issue('slug') && <p id={`${prefix}-slug-error`} className="mt-1 text-sm text-red-800">{issue('slug')!.message}</p>}</div>
    <div><label className="block text-sm font-medium" htmlFor={`${prefix}-body`}>Plain-text content</label><textarea id={`${prefix}-body`} name="body" className={field} required minLength={10} maxLength={8000} rows={5} value={value.body} onChange={event => onChange('body', event.target.value)} aria-invalid={!!issue('body')} aria-describedby={issue('body') ? `${prefix}-body-error` : undefined} placeholder="Write a fictional article or page. Do not enter real personal information." />{issue('body') && <p id={`${prefix}-body-error`} className="mt-1 text-sm text-red-800">{issue('body')!.message}</p>}</div>
  </>
}

function FeedbackRegistration({ entryId, read, discard, focus }: { entryId: string; read: () => string; discard: () => void; focus: () => void }) {
  useUnsavedWork({ id: `cms:feedback:${entryId}`, portal: 'cms', label: `CMS review feedback for ${entryId}`, isDirty: () => !!read().trim(), discard, focus })
  return null
}

export function CmsDemo() {
  const { state, setState, reset: resetSavedState, status: storageStatus, importState, replacementEpoch, recovery } = usePortalWorkspace('cms')
  const [editDraft, commitEditDraft] = useVolatileSlot<CmsEditorBuffer | null>('cms:editor-buffer', () => null)
  const editDraftRef = useRef(editDraft)
  useLayoutEffect(() => { editDraftRef.current = editDraft }, [editDraft])
  function setEditDraft(update: SetStateAction<CmsEditorBuffer | null>) {
    const next = typeof update === 'function' ? update(editDraftRef.current) : update
    editDraftRef.current = next
    commitEditDraft(next)
  }
  const [actor, setActor] = useState<CmsActor>(cmsActors[0])
  const [selectedId, setSelectedId] = useState(() => state.entries.find(entry => entry.id === editDraft?.entryId)?.id ?? state.entries.find(entry => entry.id === 'cms-article-001')?.id ?? state.entries[0]?.id ?? '')
  const [collection, setCollection] = useState('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0)
  const [createDraft, setCreateDraft, createDraftRef] = useImmediateState(emptyCreateDraft)
  const [editErrors, setEditErrors] = useState<CmsDraftIssue[]>([])
  const [createErrors, setCreateErrors] = useState<CmsDraftIssue[]>([])
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null)
  const [reviewFeedback, setReviewFeedback, reviewFeedbackRef] = useImmediateState<Record<string, string>>(() => ({}))
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null)
  const editorComparison = editDraft && compareCmsEditor(editDraft, state, replacementEpoch)
  const needsEditorRecovery = !!(editorComparison?.dirty && editorComparison.outdated)
  const selected = state.entries.find(entry => entry.id === selectedId)
  const editorContent = selected && editDraft?.entryId === selected.id && !editorComparison?.outdated ? editDraft.content : selected
  const editorDirty = !!editorComparison?.dirty
  const visible = state.entries.filter(entry => (collection === 'all' || entry.collectionId === collection) && `${entry.title} ${entry.slug}`.toLowerCase().includes(query.trim().toLowerCase()))
  const published = cmsPublishedEntries(state)
  useEffect(() => {
    if (!focusRequest) return
    for (const id of [focusRequest.id, 'cms-selected-heading', 'cms-workspace-heading']) {
      const target = document.getElementById(id)
      if (!target || target.closest('[hidden]') || !target.getClientRects().length || target.matches(':disabled')) continue
      target.focus()
      if (document.activeElement === target) break
    }
  }, [focusRequest])
  useUnsavedWork({ id: 'cms:editor', portal: 'cms', label: 'CMS entry editor', isDirty: () => !!editDraftRef.current && cmsDraftIsDirty(editDraftRef.current.content, editDraftRef.current.baseline), discard: () => { setEditDraft(null); setEditErrors([]); setPendingEntryId(null) }, focus: () => {
    setActor(cmsActors[0])
    if (editDraft && state.entries.some(entry => entry.id === editDraft.entryId)) setSelectedId(editDraft.entryId)
    setFocusRequest({ id: needsEditorRecovery ? 'cms-editor-recovery-heading' : 'edit-title' })
  } })
  useUnsavedWork({ id: 'cms:create', portal: 'cms', label: 'CMS new content form', isDirty: () => createDraftRef.current.collectionId !== 'pages' || cmsDraftIsDirty(createDraftRef.current, emptyCreateDraft()), discard: () => { setCreateDraft(emptyCreateDraft()); setCreateErrors([]) }, focus: () => { setActor(cmsActors[0]); setFocusRequest({ id: 'create-title' }) } })

  function switchEntry(entryId: string) {
    setSelectedId(entryId)
    setEditDraft(null)
    setEditErrors([])
    setPendingEntryId(null)
  }
  function selectEntry(entryId: string) {
    if (entryId === selectedId) return
    if (entryId === editDraft?.entryId) { setSelectedId(entryId); setPendingEntryId(null); return }
    if (editorDirty) setPendingEntryId(entryId)
    else switchEntry(entryId)
  }
  function updateEdit(name: keyof CmsContent, value: string) {
    if (!selected || needsEditorRecovery) return
    if (editorDirty && editDraft?.entryId !== selected.id) { setPendingEntryId(selected.id); return }
    setEditDraft(previous => {
      const draft = previous?.entryId === selected.id && !compareCmsEditor(previous, state, replacementEpoch).outdated ? previous : createCmsEditorBuffer(selected, replacementEpoch)
      return { ...draft, content: { ...draft.content, [name]: value } }
    })
    setEditErrors(previous => previous.filter(issue => issue.field !== name))
  }
  function showValidation(form: HTMLFormElement, errors: CmsDraftIssue[], kind: 'edit' | 'create') {
    if (kind === 'edit') setEditErrors(errors)
    else setCreateErrors(errors)
    if (!errors.length) return false
    setMessage('')
    setError('')
    const first = form.elements.namedItem(errors[0].field)
    if (first instanceof HTMLElement) first.focus()
    return true
  }
  function clearForms(preserveEditor = false) {
    if (!preserveEditor) setEditDraft(null)
    setCreateDraft(emptyCreateDraft())
    setEditErrors([])
    setCreateErrors([])
    setPendingEntryId(null)
    setReviewFeedback({})
  }
  function discardFeedback(entryId: string) {
    setReviewFeedback(previous => {
      const next = { ...previous }
      delete next[entryId]
      return next
    })
  }
  function focusFeedback(entryId: string) {
    if (!state.entries.some(entry => entry.id === entryId)) { setFocusRequest({ id: 'cms-workspace-heading' }); return }
    setActor(cmsActors[1])
    setSelectedId(entryId)
    setFocusRequest({ id: `cms-feedback-${entryId}` })
  }

  function act(event: CmsEvent) {
    try {
      const next = transitionCms(state, event, actor)
      setState(next)
      setMessage(`${next.activity.at(-1)?.receipt} · ${next.activity.at(-1)?.action}. No website or provider was changed.`)
      setError('')
      if (event.type === 'create-entry') selectEntry(next.entries.at(-1)!.id)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The sample CMS action failed.')
      setMessage('')
      return false
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateCmsDraft(state, createDraft)
    if (showValidation(event.currentTarget, validation.errors, 'create')) return
    if (act({ type: 'create-entry', ...createDraft })) setCreateDraft(emptyCreateDraft())
  }
  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (needsEditorRecovery) { setError('Review the restored draft comparison and choose reload or reapply before saving.'); return }
    if (!selected || !editorContent) return
    const validation = validateCmsDraft(state, { ...editorContent, collectionId: selected.collectionId }, { entryId: selected.id })
    if (showValidation(event.currentTarget, validation.errors, 'edit')) return
    if (act({ type: 'edit-entry', entryId: selected.id, expectedRevision: editDraft?.entryId === selected.id && !editorComparison?.outdated ? editDraft.revision : selected.revision, title: editorContent.title, slug: editorContent.slug, body: editorContent.body })) {
      setEditDraft(null)
      setPendingEntryId(null)
    }
  }
  function reset(confirmation?: string) {
    const result = resetSavedState(confirmation)
    if (result && !result.ok) return result
    setActor(cmsActors[0])
    setSelectedId('cms-article-001')
    setCollection('all')
    setQuery('')
    setMessage('The original CMS draft and published page are restored in this view. HR and CRM samples are unchanged.')
    setError('')
    clearForms()
    setGeneration(value => value + 1)
    return result
  }
  function resolveEditor(choice: 'reload' | 'reapply') {
    if (!editDraft || !editorComparison) return
    const result = resolveCmsEditor(editDraft, state, replacementEpoch, editorComparison.token, choice, actor)
    if (!result.ok) { setError(result.message); return }
    setEditDraft(result.buffer)
    setSelectedId(result.entryId ?? state.entries.find(entry => entry.id === 'cms-article-001')?.id ?? state.entries[0]?.id ?? '')
    setEditErrors(result.issues)
    setPendingEntryId(null)
    setError('')
    setMessage(choice === 'reload' ? 'Restored draft reloaded. The preserved unsaved editor text was discarded; no saved action was created.' : 'Unsaved text reapplied to the restored editor. Review the fields and save explicitly; no saved action was created.')
    setFocusRequest({ id: actor.role === 'author' && result.entryId ? choice === 'reapply' && result.issues.length ? `edit-${result.issues[0].field}` : 'edit-title' : 'cms-selected-heading' })
  }

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:py-12">
    {[...new Set([...state.entries.map(entry => entry.id), ...Object.keys(reviewFeedback)])].map(entryId => <FeedbackRegistration key={entryId} entryId={entryId} read={() => reviewFeedbackRef.current[entryId] ?? ''} discard={() => discardFeedback(entryId)} focus={() => focusFeedback(entryId)} />)}
    <header className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">Account-free CMS · fictional content only</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><h1 id="cms-workspace-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight text-neutral-950">Content publishing workspace</h1><p className="mt-3 text-sm leading-6 text-neutral-700">Create a draft, request a separate review, then simulate publication. The published sample freezes the approved revision. Saved actions stay in this browser across refresh and portal navigation when local storage is available. Unsaved form edits are temporary. Reset CMS samples clears only this module. Use fictional content only; no public website is published.</p></div><DemoWorkspaceReset module="cms" recovery={recovery} className={secondary} onReset={reset}>Reset CMS samples</DemoWorkspaceReset></div>
      <nav aria-label="Business portals" className="mt-5 flex flex-wrap gap-3 text-sm font-semibold"><AppLink to={portalDirectoryHref} className={secondary}>All portals</AppLink>{portalRegistry.filter(portal => portal.id !== 'cms').map(portal => <AppLink key={portal.id} to={portal.href} className={secondary}>{portal.workspaceLabel}</AppLink>)}</nav>
      <label className="mt-5 block max-w-sm text-sm font-medium">CMS preview identity<select className={field} value={actor.id} onChange={event => { setActor(cmsActors.find(person => person.id === event.target.value)!); setMessage(''); setError('') }}>{cmsActors.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><p className="mt-2 text-xs text-neutral-600">The author writes, a separate reviewer approves, the publisher publishes or retires, and the viewer reads. These fictional identities do not grant real account permissions.</p>
    </header>
    <DemoStorageNotice status={storageStatus} />
    <DemoWorkspaceBackup key={generation} module="cms" recovery={recovery} state={state} validate={isCmsState} summarize={value => `${value.entries.length} content records · ${value.entries.filter(entry => entry.published).length} published snapshots · ${value.activity.length} actions`} onImport={(value, confirmation) => {
      const result = importState(value, confirmation)
      if (result.ok) { setActor(cmsActors[0]); setSelectedId(value.entries.find(entry => entry.id === editDraft?.entryId)?.id ?? value.entries.find(entry => entry.id === 'cms-article-001')?.id ?? value.entries[0]?.id ?? ''); setCollection('all'); setQuery(''); setGeneration(previous => previous + 1); setMessage(result.status.message); setError(''); clearForms(true) }
      return result
    }} />
    {(message || error) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || message}</div>}
    {needsEditorRecovery && editDraft && editorComparison && <section role="region" aria-label="CMS editor recovery" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <h2 id="cms-editor-recovery-heading" tabIndex={-1} className="text-lg font-semibold">CMS editor changed after replacement</h2>
      <p className="mt-2 text-sm leading-6">The workspace was replaced after this editor started. Your exact unsaved text for {editDraft.entryId} is preserved temporarily. Compare it with the restored draft, then reload or reapply before saving.</p>
      {!editorComparison.entry && <p className="mt-2 text-sm font-semibold">This entry is missing from the restored workspace. Reapply is unavailable. Reload discards this preserved buffer; it does not recreate the entry.</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[42rem] table-fixed text-left text-sm"><caption className="sr-only">CMS editor baseline, restored draft and unsaved text</caption><thead><tr>{['Field', 'Editor baseline', 'Restored draft', 'Unsaved text'].map(label => <th key={label} scope="col" className="border-b border-amber-300 p-3">{label}</th>)}</tr></thead><tbody>{editorComparison.fields.map(item => <tr key={item.field}><th scope="row" className="border-b border-amber-200 p-3 align-top">{draftLabels[item.field]}{item.edited && <span className="mt-1 block text-xs font-normal">Edited field</span>}</th>{[item.baseline, item.restored, item.unsaved].map((value, index) => <td key={index} className="border-b border-amber-200 p-3 align-top">{value === null ? <span>Entry missing</span> : <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans">{value}</pre>}</td>)}</tr>)}</tbody></table></div>
      <p className="mt-3 text-xs leading-5">Reapply copies only meaningfully edited fields onto the restored draft. Untouched fields keep their restored values. Both choices change temporary editor state only; an ordinary Save draft revision is required to record changes.</p>
      {editorComparison.entry && (actor.role !== 'author' || actor.id !== editorComparison.entry.authorId) && <p className="mt-2 text-sm">Select the restored entry’s assigned author to reapply. Other preview roles can reload and discard the buffer.</p>}
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} onClick={() => resolveEditor('reload')}>Reload restored draft</button><button type="button" className={button} disabled={!editorComparison.entry || actor.role !== 'author' || actor.id !== editorComparison.entry.authorId} onClick={() => resolveEditor('reapply')}>Reapply unsaved text</button></div>
    </section>}
    {pendingEntryId && <section role="region" aria-label="Unsaved CMS draft" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950"><h2 className="text-lg font-semibold">Discard unsaved changes?</h2><p className="mt-2 text-sm">Your changes to {editDraft?.baseline.title ?? selected?.title} have not been saved. Keep editing this draft or discard its changes and open {state.entries.find(entry => entry.id === pendingEntryId)?.title}.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} onClick={() => { setPendingEntryId(null); if (editDraft && state.entries.some(entry => entry.id === editDraft.entryId)) setSelectedId(editDraft.entryId); setActor(cmsActors[0]); setFocusRequest({ id: needsEditorRecovery ? 'cms-editor-recovery-heading' : 'edit-title' }) }}>Keep editing</button><button type="button" className={button} onClick={() => switchEntry(pendingEntryId)}>Discard changes and switch</button></div></section>}
    <section aria-label="CMS metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Drafts', state.entries.filter(entry => entry.status === 'draft').length], ['Awaiting review', state.entries.filter(entry => entry.status === 'in-review').length], ['Approved revisions', state.entries.filter(entry => entry.status === 'approved').length], ['Published samples', published.length]].map(([title, value]) => <div key={title} className={panel}><p className="text-xs font-medium text-neutral-500">{title}</p><p className="mt-2 text-3xl font-semibold text-neutral-950">{value}</p></div>)}</section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className={panel}><h2 className="text-xl font-semibold text-neutral-950">Editorial collection</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Collection<select className={field} value={collection} onChange={event => setCollection(event.target.value)}><option value="all">All collections</option>{cmsCollections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium">Search content<input className={field} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or slug" /></label></div><div className="mt-5 space-y-3">{visible.map(entry => <button key={entry.id} type="button" onClick={() => selectEntry(entry.id)} aria-pressed={entry.id === selectedId} className={`block min-h-11 w-full rounded-lg border p-4 text-left ${entry.id === selectedId ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:bg-neutral-50'}`}><span className="block font-semibold text-neutral-950">{entry.title}</span><span className="mt-1 block text-xs text-neutral-600">{entry.collectionId} / {entry.slug} · revision {entry.revision} · {entry.status.replace('-', ' ')}{entry.published ? ` · public sample v${entry.published.revision}` : ''}</span></button>)}{!visible.length && <p className="text-sm text-neutral-600">No sample content matches this collection and search.</p>}</div></section>
        {selected && <section className={panel} aria-label="Selected content"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="cms-selected-heading" tabIndex={-1} className="text-xl font-semibold text-neutral-950">{selected.title}</h2><p className="mt-2 text-xs text-neutral-500">{selected.id} · {selected.collectionId} · current draft revision {selected.revision}</p></div><span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-semibold capitalize text-indigo-900">{selected.status.replace('-', ' ')}</span></div>
          {selected.feedback && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>Reviewer feedback:</strong> {selected.feedback}</p>}
          {selected.approval && <p className="mt-4 text-sm text-emerald-800">Revision {selected.approval.revision} approved by the separate reviewer · {selected.approval.receipt}</p>}
          {selected.published && selected.published.revision !== selected.revision && <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">The published sample is still revision {selected.published.revision}. This draft has not replaced it.</p>}
          {actor.role === 'author' && editorContent && !needsEditorRecovery ? <form noValidate className="mt-5 space-y-4" onSubmit={saveEdit}><ValidationSummary errors={editErrors} prefix="edit" /><ContentFields value={editorContent} onChange={updateEdit} errors={editErrors} prefix="edit" /><div className="flex flex-wrap gap-3"><button type="submit" className={button}>Save draft revision</button>{selected.status === 'draft' && <button type="button" className={secondary + ' disabled:opacity-40'} disabled={editorDirty} onClick={() => act({ type: 'submit-review', entryId: selected.id, expectedRevision: selected.revision })}>Request review</button>}</div><p className="text-xs leading-5 text-neutral-500">Save changes before requesting review. Any saved edit returns the content to draft and invalidates the previous approval.</p>{editorDirty && <p className="text-sm text-amber-900">This draft has unsaved changes.</p>}</form> : <div className="mt-5 rounded-lg bg-neutral-50 p-4"><p className="text-xs font-medium text-neutral-500">Draft slug: {selected.slug}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">{selected.body}</p>{editorDirty && <p className="mt-3 text-sm text-amber-900">Unsaved author changes are kept temporarily. {needsEditorRecovery ? 'Choose reload or reapply in the comparison above before editing.' : 'Switch back to the author to continue editing.'}</p>}</div>}
          {actor.role === 'reviewer' && selected.status === 'in-review' && <div className="mt-5 space-y-4"><button type="button" className={button} onClick={() => act({ type: 'approve-entry', entryId: selected.id, expectedRevision: selected.revision })}>Approve revision {selected.revision}</button><form onSubmit={event => { event.preventDefault(); if (act({ type: 'return-draft', entryId: selected.id, expectedRevision: selected.revision, feedback: reviewFeedback[selected.id] ?? '' })) discardFeedback(selected.id) }}><label className="block text-sm font-medium">Review feedback<textarea id={`cms-feedback-${selected.id}`} name="feedback" className={field} rows={2} required minLength={3} maxLength={500} value={reviewFeedback[selected.id] ?? ''} onChange={event => setReviewFeedback(previous => ({ ...previous, [selected.id]: event.target.value }))} placeholder="Describe the fictional changes needed" /></label><button type="submit" className={secondary + ' mt-3'}>Return draft for changes</button></form></div>}
          {actor.role === 'reviewer' && selected.status !== 'in-review' && Object.hasOwn(reviewFeedback, selected.id) && <section role="region" aria-label="Retained CMS review feedback" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="text-base font-semibold">Retained CMS review feedback</h3><p className="mt-2 text-sm leading-6">This temporary feedback has not been saved. The entry is {selected.status.replace('-', ' ')}. You can edit or discard this text here; returning a draft for changes is available only when the entry is in review.</p><label className="mt-3 block text-sm font-medium">Retained review feedback<textarea id={`cms-feedback-${selected.id}`} className={field} rows={3} maxLength={500} value={reviewFeedback[selected.id]} onChange={event => setReviewFeedback(previous => ({ ...previous, [selected.id]: event.target.value }))} /></label><button type="button" className={secondary + ' mt-3'} onClick={() => { discardFeedback(selected.id); setFocusRequest({ id: 'cms-selected-heading' }) }}>Discard retained feedback</button></section>}
          {actor.role === 'publisher' && <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} disabled={selected.status !== 'approved'} onClick={() => act({ type: 'publish-entry', entryId: selected.id, expectedRevision: selected.revision })}>Simulate publication</button><button type="button" className={secondary + ' disabled:opacity-40'} disabled={!selected.published} onClick={() => act({ type: 'retire-entry', entryId: selected.id, expectedRevision: selected.revision })}>Retire published sample</button></div>}
          {actor.role === 'viewer' && <p className="mt-4 text-sm text-neutral-500">Read-only editorial preview. No mutation controls are available.</p>}
        </section>}
        {actor.role === 'author' && <section className={panel}><h2 className="text-xl font-semibold text-neutral-950">Create sample content</h2><form noValidate className="mt-5 space-y-4" onSubmit={create}><ValidationSummary errors={createErrors} prefix="create" /><div><label className="block text-sm font-medium" htmlFor="create-collectionId">New content collection</label><select id="create-collectionId" name="collectionId" className={field} value={createDraft.collectionId} onChange={event => { setCreateDraft(previous => ({ ...previous, collectionId: event.target.value })); setCreateErrors(previous => previous.filter(issue => issue.field !== 'collectionId' && issue.field !== 'slug')) }} aria-invalid={createErrors.some(issue => issue.field === 'collectionId')} aria-describedby={createErrors.some(issue => issue.field === 'collectionId') ? 'create-collectionId-error' : undefined}>{cmsCollections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{createErrors.some(issue => issue.field === 'collectionId') && <p id="create-collectionId-error" className="mt-1 text-sm text-red-800">{createErrors.find(issue => issue.field === 'collectionId')!.message}</p>}</div><ContentFields value={createDraft} onChange={(name, value) => { setCreateDraft(previous => ({ ...previous, [name]: value })); setCreateErrors(previous => previous.filter(issue => issue.field !== name)) }} errors={createErrors} prefix="create" /><button type="submit" className={button}>Create draft</button></form></section>}
      </div>
      <aside className="space-y-6">
        <section className={panel} aria-label="Published sample preview"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Local published projection</p><h2 className="mt-2 text-xl font-semibold text-neutral-950">Published sample preview</h2><p className="mt-3 text-sm leading-6 text-neutral-600">Only frozen published snapshots appear below. Draft text, review feedback and author details are excluded. This is an in-app preview, with no network publication.</p><div className="mt-5 space-y-4">{published.map(item => <article key={item.entryId} className="rounded-lg border border-neutral-200 p-4"><p className="text-xs text-neutral-500">{item.collectionId} / {item.slug} · published revision {item.revision}</p><h3 className="mt-2 text-lg font-semibold text-neutral-950">{item.title}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">{item.body}</p><p className="mt-4 break-words text-xs text-neutral-500">{item.receipt}</p></article>)}{!published.length && <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">No content is currently published in the local sample.</p>}</div></section>
        <section className={panel}><h2 className="text-lg font-semibold text-neutral-950">CMS session activity</h2><ol className="mt-4 max-h-96 space-y-3 overflow-y-auto text-xs leading-5 text-neutral-600">{[...state.activity].reverse().map(item => <li key={item.receipt} className="border-b border-neutral-100 pb-3"><strong className="text-neutral-800">{item.receipt}</strong><br />{item.action} · revision {item.revision}<br />{item.entryId} · {item.actorId}</li>)}{!state.activity.length && <li>No session actions yet. Seeded content is labeled separately.</li>}</ol></section>
      </aside>
    </div>
  </div>
}
