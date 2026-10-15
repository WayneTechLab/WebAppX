import { useState, type FormEvent } from 'react'
import { AppLink } from '@/components/navigation/AppLink'
import { useDemoPersistence } from '@/portals/useDemoPersistence'
import { DemoStorageNotice } from '@/portals/DemoStorageNotice'
import { cmsActors, cmsCollections, cmsPublishedEntries, createCmsState, transitionCms, type CmsActor, type CmsEntry, type CmsEvent } from './model'
import { isCmsState } from './persistence'

const field = 'mt-2 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-700'
const button = 'inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500'
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50'
const panel = 'rounded-xl border border-neutral-200 bg-white p-5 sm:p-6'

function contentFromForm(form: HTMLFormElement) {
  const data = new FormData(form)
  return { title: String(data.get('title') ?? ''), slug: String(data.get('slug') ?? ''), body: String(data.get('body') ?? '') }
}

function ContentFields({ entry, prefix }: { entry?: CmsEntry; prefix: string }) {
  return <>
    <label className="block text-sm font-medium" htmlFor={`${prefix}-title`}>Content title<input id={`${prefix}-title`} name="title" className={field} required minLength={3} maxLength={100} defaultValue={entry?.title} placeholder="A fictional studio update" /></label>
    <label className="block text-sm font-medium" htmlFor={`${prefix}-slug`}>Content slug<input id={`${prefix}-slug`} name="slug" className={field} required maxLength={80} defaultValue={entry?.slug} placeholder="fictional-studio-update" /><span className="mt-1 block text-xs text-neutral-500">Letters, numbers and single hyphens. Unique within this collection.</span></label>
    <label className="block text-sm font-medium" htmlFor={`${prefix}-body`}>Plain-text content<textarea id={`${prefix}-body`} name="body" className={field} required minLength={10} maxLength={8000} rows={5} defaultValue={entry?.body} placeholder="Write a fictional article or page. Do not enter real personal information." /></label>
  </>
}

export function CmsDemo() {
  const { state, setState, reset: resetSavedState, status: storageStatus } = useDemoPersistence('cms', createCmsState, isCmsState)
  const [actor, setActor] = useState<CmsActor>(cmsActors[0])
  const [selectedId, setSelectedId] = useState('cms-article-001')
  const [collection, setCollection] = useState('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0)
  const selected = state.entries.find(entry => entry.id === selectedId)
  const visible = state.entries.filter(entry => (collection === 'all' || entry.collectionId === collection) && `${entry.title} ${entry.slug}`.toLowerCase().includes(query.trim().toLowerCase()))
  const published = cmsPublishedEntries(state)

  function act(event: CmsEvent) {
    try {
      const next = transitionCms(state, event, actor)
      setState(next)
      setMessage(`${next.activity.at(-1)?.receipt} · ${next.activity.at(-1)?.action}. No website or provider was changed.`)
      setError('')
      if (event.type === 'create-entry') setSelectedId(next.entries.at(-1)!.id)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The sample CMS action failed.')
      setMessage('')
      return false
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (act({ type: 'create-entry', collectionId: String(data.get('collectionId')), ...contentFromForm(form) })) form.reset()
  }
  function reset() {
    resetSavedState()
    setActor(cmsActors[0])
    setSelectedId('cms-article-001')
    setCollection('all')
    setQuery('')
    setMessage('The original CMS draft and published page are restored in this view. HR and CRM samples are unchanged.')
    setError('')
    setGeneration(value => value + 1)
  }

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:py-12">
    <header className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">Account-free CMS · fictional content only</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><h1 className="text-3xl font-bold tracking-tight text-neutral-950">Content publishing workspace</h1><p className="mt-3 text-sm leading-6 text-neutral-700">Create a draft, request a separate review, then simulate publication. The published sample freezes the approved revision. Saved actions stay in this browser across refresh and portal navigation when local storage is available. Unsaved form edits are temporary. Reset CMS samples clears only this module. Use fictional content only; no public website is published.</p></div><button className={secondary} type="button" onClick={reset}>Reset CMS samples</button></div>
      <nav aria-label="Business portals" className="mt-5 flex flex-wrap gap-3 text-sm font-semibold"><AppLink to="/portals" className={secondary}>All portals</AppLink><AppLink to="/hr/demo" className={secondary}>HR workspace</AppLink><AppLink to="/crm/demo" className={secondary}>CRM workspace</AppLink></nav>
      <label className="mt-5 block max-w-sm text-sm font-medium">CMS preview identity<select className={field} value={actor.id} onChange={event => { setActor(cmsActors.find(person => person.id === event.target.value)!); setMessage(''); setError('') }}>{cmsActors.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><p className="mt-2 text-xs text-neutral-600">The author writes, a separate reviewer approves, the publisher publishes or retires, and the viewer reads. These fictional identities do not grant real account permissions.</p>
    </header>
    <DemoStorageNotice status={storageStatus} />
    {(message || error) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || message}</div>}
    <section aria-label="CMS metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Drafts', state.entries.filter(entry => entry.status === 'draft').length], ['Awaiting review', state.entries.filter(entry => entry.status === 'in-review').length], ['Approved revisions', state.entries.filter(entry => entry.status === 'approved').length], ['Published samples', published.length]].map(([title, value]) => <div key={title} className={panel}><p className="text-xs font-medium text-neutral-500">{title}</p><p className="mt-2 text-3xl font-semibold text-neutral-950">{value}</p></div>)}</section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className={panel}><h2 className="text-xl font-semibold text-neutral-950">Editorial collection</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Collection<select className={field} value={collection} onChange={event => setCollection(event.target.value)}><option value="all">All collections</option>{cmsCollections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium">Search content<input className={field} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or slug" /></label></div><div className="mt-5 space-y-3">{visible.map(entry => <button key={entry.id} type="button" onClick={() => setSelectedId(entry.id)} aria-pressed={entry.id === selectedId} className={`block min-h-11 w-full rounded-lg border p-4 text-left ${entry.id === selectedId ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:bg-neutral-50'}`}><span className="block font-semibold text-neutral-950">{entry.title}</span><span className="mt-1 block text-xs text-neutral-600">{entry.collectionId} / {entry.slug} · revision {entry.revision} · {entry.status.replace('-', ' ')}{entry.published ? ` · public sample v${entry.published.revision}` : ''}</span></button>)}{!visible.length && <p className="text-sm text-neutral-600">No sample content matches this collection and search.</p>}</div></section>
        {selected && <section className={panel} aria-label="Selected content"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-neutral-950">{selected.title}</h2><p className="mt-2 text-xs text-neutral-500">{selected.id} · {selected.collectionId} · current draft revision {selected.revision}</p></div><span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-semibold capitalize text-indigo-900">{selected.status.replace('-', ' ')}</span></div>
          {selected.feedback && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>Reviewer feedback:</strong> {selected.feedback}</p>}
          {selected.approval && <p className="mt-4 text-sm text-emerald-800">Revision {selected.approval.revision} approved by the separate reviewer · {selected.approval.receipt}</p>}
          {selected.published && selected.published.revision !== selected.revision && <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">The published sample is still revision {selected.published.revision}. This draft has not replaced it.</p>}
          {actor.role === 'author' ? <form key={`${selected.id}:${selected.revision}:${actor.id}:${generation}`} className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); act({ type: 'edit-entry', entryId: selected.id, expectedRevision: selected.revision, ...contentFromForm(event.currentTarget) }) }}><ContentFields entry={selected} prefix="edit" /><div className="flex flex-wrap gap-3"><button type="submit" className={button}>Save draft revision</button>{selected.status === 'draft' && <button type="button" className={secondary} onClick={() => act({ type: 'submit-review', entryId: selected.id, expectedRevision: selected.revision })}>Request review</button>}</div><p className="text-xs leading-5 text-neutral-500">Save changes before requesting review. Any saved edit returns the content to draft and invalidates the previous approval.</p></form> : <div className="mt-5 rounded-lg bg-neutral-50 p-4"><p className="text-xs font-medium text-neutral-500">Draft slug: {selected.slug}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">{selected.body}</p></div>}
          {actor.role === 'reviewer' && selected.status === 'in-review' && <div className="mt-5 space-y-4"><button type="button" className={button} onClick={() => act({ type: 'approve-entry', entryId: selected.id, expectedRevision: selected.revision })}>Approve revision {selected.revision}</button><form key={`${selected.id}:${selected.revision}:feedback:${generation}`} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); act({ type: 'return-draft', entryId: selected.id, expectedRevision: selected.revision, feedback: String(data.get('feedback') ?? '') }) }}><label className="block text-sm font-medium">Review feedback<textarea name="feedback" className={field} rows={2} required minLength={3} maxLength={500} placeholder="Describe the fictional changes needed" /></label><button type="submit" className={secondary + ' mt-3'}>Return draft for changes</button></form></div>}
          {actor.role === 'publisher' && <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} disabled={selected.status !== 'approved'} onClick={() => act({ type: 'publish-entry', entryId: selected.id, expectedRevision: selected.revision })}>Simulate publication</button><button type="button" className={secondary + ' disabled:opacity-40'} disabled={!selected.published} onClick={() => act({ type: 'retire-entry', entryId: selected.id, expectedRevision: selected.revision })}>Retire published sample</button></div>}
          {actor.role === 'viewer' && <p className="mt-4 text-sm text-neutral-500">Read-only editorial preview. No mutation controls are available.</p>}
        </section>}
        {actor.role === 'author' && <section className={panel}><h2 className="text-xl font-semibold text-neutral-950">Create sample content</h2><form key={`create:${generation}`} className="mt-5 space-y-4" onSubmit={create}><label className="block text-sm font-medium">New content collection<select name="collectionId" className={field}>{cmsCollections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><ContentFields prefix="create" /><button type="submit" className={button}>Create draft</button></form></section>}
      </div>
      <aside className="space-y-6">
        <section className={panel} aria-label="Published sample preview"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Local published projection</p><h2 className="mt-2 text-xl font-semibold text-neutral-950">Published sample preview</h2><p className="mt-3 text-sm leading-6 text-neutral-600">Only frozen published snapshots appear below. Draft text, review feedback and author details are excluded. This is an in-app preview, with no network publication.</p><div className="mt-5 space-y-4">{published.map(item => <article key={item.entryId} className="rounded-lg border border-neutral-200 p-4"><p className="text-xs text-neutral-500">{item.collectionId} / {item.slug} · published revision {item.revision}</p><h3 className="mt-2 text-lg font-semibold text-neutral-950">{item.title}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">{item.body}</p><p className="mt-4 break-words text-xs text-neutral-500">{item.receipt}</p></article>)}{!published.length && <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">No content is currently published in the local sample.</p>}</div></section>
        <section className={panel}><h2 className="text-lg font-semibold text-neutral-950">CMS session activity</h2><ol className="mt-4 max-h-96 space-y-3 overflow-y-auto text-xs leading-5 text-neutral-600">{[...state.activity].reverse().map(item => <li key={item.receipt} className="border-b border-neutral-100 pb-3"><strong className="text-neutral-800">{item.receipt}</strong><br />{item.action} · revision {item.revision}<br />{item.entryId} · {item.actorId}</li>)}{!state.activity.length && <li>No session actions yet. Seeded content is labeled separately.</li>}</ol></section>
      </aside>
    </div>
  </div>
}
