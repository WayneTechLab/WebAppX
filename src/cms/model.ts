export type CmsRole = 'author' | 'reviewer' | 'publisher' | 'viewer'
export type CmsActor = { id: string; role: CmsRole; name: string }
export type CmsContent = { title: string; slug: string; body: string }
export type CmsPublication = CmsContent & { revision: number; receipt: string }
export type CmsEntry = CmsContent & {
  id: string; collectionId: string; authorId: string; revision: number;
  status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired';
  approval: { revision: number; reviewerId: string; receipt: string } | null;
  published: CmsPublication | null; feedback: string;
}
export type CmsActivity = { receipt: string; entryId: string; revision: number; actorId: string; action: string }
export type CmsState = { entries: CmsEntry[]; activity: CmsActivity[]; sequence: number }
type EntryEvent = { entryId: string; expectedRevision: number }
export type CmsEvent =
  | ({ type: 'create-entry'; collectionId: string } & CmsContent)
  | ({ type: 'edit-entry' } & EntryEvent & CmsContent)
  | ({ type: 'submit-review' | 'approve-entry' | 'publish-entry' | 'retire-entry' } & EntryEvent)
  | ({ type: 'return-draft'; feedback: string } & EntryEvent)

export const cmsCollections = [{ id: 'pages', name: 'Pages' }, { id: 'articles', name: 'Articles' }]
export const cmsActors: CmsActor[] = [
  { id: 'cms-author', role: 'author', name: 'Alex · author' },
  { id: 'cms-reviewer', role: 'reviewer', name: 'Riley · reviewer' },
  { id: 'cms-publisher', role: 'publisher', name: 'Pat · publisher' },
  { id: 'cms-viewer', role: 'viewer', name: 'Sam · read-only viewer' },
]

export function createCmsState(): CmsState {
  const welcome = { title: 'Welcome to the sample studio', slug: 'welcome', body: 'This fictional public page is a published sample. Create a draft, ask another preview role to review it, then simulate publication.' }
  return {
    sequence: 0, activity: [],
    entries: [
      { id: 'cms-page-001', collectionId: 'pages', authorId: 'cms-author', revision: 1, status: 'published', approval: { revision: 1, reviewerId: 'cms-reviewer', receipt: 'SEED-CMS-REVIEW' }, published: { ...welcome, revision: 1, receipt: 'SEED-CMS-PUBLICATION' }, feedback: '', ...welcome },
      { id: 'cms-article-001', collectionId: 'articles', authorId: 'cms-author', revision: 1, status: 'draft', approval: null, published: null, feedback: '', title: 'A fictional team update', slug: 'team-update', body: 'Share a fictional company update here. This draft is visible in the editorial workspace and is excluded from the published sample.' },
    ],
  }
}

function cleanContent(event: CmsContent): CmsContent {
  if (typeof event.title !== 'string' || typeof event.slug !== 'string' || typeof event.body !== 'string') throw new Error('Enter a title, slug and plain-text body.')
  const title = event.title.trim()
  const slug = event.slug.trim().toLowerCase()
  const body = event.body.trim()
  if (title.length < 3 || title.length > 100) throw new Error('The title must contain 3–100 characters.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new Error('Use a slug of up to 80 lowercase letters, numbers and single hyphens.')
  if (body.length < 10 || body.length > 8000) throw new Error('The plain-text body must contain 10–8000 characters.')
  return { title, slug, body }
}

function requireUniqueSlug(state: CmsState, collectionId: string, slug: string, entryId?: string) {
  if (state.entries.some(entry => entry.id !== entryId && entry.collectionId === collectionId && (entry.slug.toLowerCase() === slug || entry.published?.slug.toLowerCase() === slug))) throw new Error('This collection already has that draft or published slug. Choose another slug.')
}

export function cmsPublishedEntries(state: CmsState) {
  return state.entries.flatMap(entry => entry.published ? [{ entryId: entry.id, collectionId: entry.collectionId, ...entry.published }] : [])
}

export function transitionCms(previous: CmsState, event: CmsEvent, actor: CmsActor): CmsState {
  if (!cmsActors.some(person => person.id === actor.id && person.role === actor.role)) throw new Error('Select a recognized CMS preview identity.')
  if (actor.role === 'viewer') throw new Error('The CMS viewer is read-only.')
  const state = structuredClone(previous)
  function receipt(entry: CmsEntry, action: string) {
    state.sequence += 1
    const value = `MOCK-CMS-${String(state.sequence).padStart(4, '0')}`
    state.activity.push({ receipt: value, entryId: entry.id, revision: entry.revision, actorId: actor.id, action })
    return value
  }
  if (event.type === 'create-entry') {
    if (actor.role !== 'author') throw new Error('Only the author preview creates drafts.')
    if (!cmsCollections.some(collection => collection.id === event.collectionId)) throw new Error('Choose a supported CMS collection.')
    const content = cleanContent(event)
    requireUniqueSlug(state, event.collectionId, content.slug)
    const entry: CmsEntry = { id: `cms-entry-${String(state.sequence + 1).padStart(4, '0')}`, collectionId: event.collectionId, authorId: actor.id, revision: 1, status: 'draft', approval: null, published: null, feedback: '', ...content }
    state.entries.push(entry)
    receipt(entry, 'Created draft')
    return state
  }
  const entry = state.entries.find(item => item.id === event.entryId)
  if (!entry) throw new Error('The CMS entry was not found in this sample workspace.')
  if (entry.revision !== event.expectedRevision) throw new Error('This revision has changed. Review the current draft before continuing.')
  if (event.type === 'edit-entry') {
    if (actor.role !== 'author' || actor.id !== entry.authorId) throw new Error('Only the assigned author can edit this draft.')
    const content = cleanContent(event)
    requireUniqueSlug(state, entry.collectionId, content.slug, entry.id)
    if (content.title === entry.title && content.slug === entry.slug && content.body === entry.body) throw new Error('Change the draft content before saving another revision.')
    Object.assign(entry, content, { revision: entry.revision + 1, status: 'draft', approval: null, feedback: '' })
    receipt(entry, 'Saved draft revision; previous approval invalidated')
  } else if (event.type === 'submit-review') {
    if (actor.role !== 'author' || actor.id !== entry.authorId) throw new Error('Only the assigned author can submit this draft.')
    if (entry.status !== 'draft') throw new Error('Only a draft can be submitted for review.')
    entry.status = 'in-review'
    receipt(entry, 'Requested review')
  } else if (event.type === 'approve-entry' || event.type === 'return-draft') {
    if (actor.role !== 'reviewer' || actor.id === entry.authorId) throw new Error('A separate reviewer identity must review the draft.')
    if (entry.status !== 'in-review') throw new Error('Only a submitted draft can receive a review decision.')
    if (event.type === 'return-draft') {
      if (typeof event.feedback !== 'string' || event.feedback.trim().length < 3 || event.feedback.trim().length > 500) throw new Error('Give 3–500 characters of sample review feedback.')
      entry.feedback = event.feedback.trim()
      entry.status = 'draft'
      entry.approval = null
      receipt(entry, 'Returned draft for changes')
    } else {
      entry.status = 'approved'
      entry.approval = { revision: entry.revision, reviewerId: actor.id, receipt: receipt(entry, 'Approved exact draft revision') }
    }
  } else if (event.type === 'publish-entry') {
    if (actor.role !== 'publisher') throw new Error('Only the publisher preview can simulate publication.')
    if (entry.status !== 'approved' || !entry.approval || entry.approval.revision !== entry.revision || entry.approval.reviewerId === entry.authorId) throw new Error('The current revision needs separate reviewer approval before publication.')
    requireUniqueSlug(state, entry.collectionId, entry.slug, entry.id)
    entry.status = 'published'
    entry.published = { title: entry.title, slug: entry.slug, body: entry.body, revision: entry.revision, receipt: receipt(entry, 'Simulated publication') }
  } else if (event.type === 'retire-entry') {
    if (actor.role !== 'publisher') throw new Error('Only the publisher preview can retire a publication.')
    if (!entry.published) throw new Error('This entry has no current publication to retire.')
    entry.published = null
    entry.approval = null
    entry.status = 'retired'
    receipt(entry, 'Retired sample publication')
  } else {
    throw new Error('This CMS action is not supported.')
  }
  return state
}
