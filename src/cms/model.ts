import type { CmsReleaseBundle } from './release-types'

export type CmsRole = 'author' | 'reviewer' | 'publisher' | 'viewer'
export type CmsActor = { id: string; role: CmsRole; name: string }
export type CmsContent = { title: string; slug: string; body: string }
export type CmsDraftField = 'collectionId' | keyof CmsContent
export type CmsDraftIssue = { field: CmsDraftField; message: string }
export type CmsDraftValidation = { errors: CmsDraftIssue[]; content: CmsContent | null }
export type CmsPublication = CmsContent & { revision: number; receipt: string }
export type CmsEntry = CmsContent & {
  id: string; collectionId: string; authorId: string; revision: number;
  status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired';
  approval: { revision: number; reviewerId: string; receipt: string } | null;
  published: CmsPublication | null; feedback: string;
}
export type CmsActivity = { receipt: string; entryId: string; revision: number; actorId: string; action: string }
export type CmsState = { entries: CmsEntry[]; activity: CmsActivity[]; sequence: number; releaseBundles?: CmsReleaseBundle[] }
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

function normalizedContent(content: CmsContent): CmsContent {
  return { title: content.title.trim(), slug: content.slug.trim().toLowerCase(), body: content.body.trim() }
}

/** Compare the values that saving would record, so harmless surrounding space
 * and slug case do not create a false unsaved-change warning.
 */
export function cmsDraftIsDirty(content: CmsContent, baseline: CmsContent): boolean {
  const draft = normalizedContent(content)
  const saved = normalizedContent(baseline)
  return draft.title !== saved.title || draft.slug !== saved.slug || draft.body !== saved.body
}

function hasSlugConflict(state: CmsState, collectionId: string, slug: string, entryId?: string) {
  return state.entries.some(entry => entry.id !== entryId && entry.collectionId === collectionId && (entry.slug.toLowerCase() === slug || entry.published?.slug.toLowerCase() === slug))
}

const slugConflictMessage = 'This collection already has that draft or published slug. Choose another slug.'

/** One ordered field check for both the editor and domain transitions. Invalid
 * drafts return every affected field and never supply content for saving.
 */
export function validateCmsDraft(state: CmsState, draft: CmsContent & { collectionId: string }, options: { entryId?: string } = {}): CmsDraftValidation {
  const errors: CmsDraftIssue[] = []
  const collectionValid = cmsCollections.some(collection => collection.id === draft.collectionId)
  if (!collectionValid) errors.push({ field: 'collectionId', message: 'Choose a supported CMS collection.' })
  const title = typeof draft.title === 'string' ? draft.title.trim() : ''
  const slug = typeof draft.slug === 'string' ? draft.slug.trim().toLowerCase() : ''
  const body = typeof draft.body === 'string' ? draft.body.trim() : ''
  if (typeof draft.title !== 'string' || title.length < 3 || title.length > 100) errors.push({ field: 'title', message: 'The title must contain 3–100 characters.' })
  const slugValid = typeof draft.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80
  if (!slugValid) errors.push({ field: 'slug', message: 'Use a slug of up to 80 lowercase letters, numbers and single hyphens.' })
  else if (collectionValid && hasSlugConflict(state, draft.collectionId, slug, options.entryId)) errors.push({ field: 'slug', message: slugConflictMessage })
  if (typeof draft.body !== 'string' || body.length < 10 || body.length > 8000) errors.push({ field: 'body', message: 'The plain-text body must contain 10–8000 characters.' })
  return { errors, content: errors.length ? null : { title, slug, body } }
}

function requireValidDraft(state: CmsState, draft: CmsContent & { collectionId: string }, entryId?: string): CmsContent {
  const result = validateCmsDraft(state, draft, { entryId })
  if (!result.content) throw new Error(result.errors[0].message)
  return result.content
}

function requireUniqueSlug(state: CmsState, collectionId: string, slug: string, entryId?: string) {
  if (hasSlugConflict(state, collectionId, slug, entryId)) throw new Error(slugConflictMessage)
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
    const content = requireValidDraft(state, event)
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
    const content = requireValidDraft(state, { ...event, collectionId: entry.collectionId }, entry.id)
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
