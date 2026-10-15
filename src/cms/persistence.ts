import type { CmsState } from './model'

type RecordValue = Record<string, unknown>
const entryStatuses = ['draft', 'in-review', 'approved', 'published', 'retired']
const actionActors: Record<string, string> = {
  'Created draft': 'cms-author',
  'Saved draft revision; previous approval invalidated': 'cms-author',
  'Requested review': 'cms-author',
  'Returned draft for changes': 'cms-reviewer',
  'Approved exact draft revision': 'cms-reviewer',
  'Simulated publication': 'cms-publisher',
  'Retired sample publication': 'cms-publisher',
}
function record(value: unknown, keys: string[], optional: string[] = []): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key) || optional.includes(key)) && keys.every(key => Object.hasOwn(value, key))
}
function text(value: unknown, minimum: number, maximum: number): value is string { return typeof value === 'string' && value.length >= minimum && value.length <= maximum && value.trim() === value }
function integer(value: unknown, minimum = 1): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum }
function hasControlCharacter(value: string) { return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) }
function content(value: RecordValue) {
  return text(value.title, 3, 100) && text(value.slug, 1, 80) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) && text(value.body, 10, 8000)
}
function receipt(value: unknown) { return typeof value === 'string' && /^(?:MOCK-CMS-\d{4,}|SEED-CMS-REVIEW|SEED-CMS-PUBLICATION)$/.test(value) }

/** Restore only a complete native CMS workspace, never form fields or arbitrary storage data. */
export function isCmsState(value: unknown): value is CmsState {
  if (!record(value, ['entries', 'activity', 'sequence'], ['releaseBundles']) || !integer(value.sequence, 0) || !Array.isArray(value.entries) || !Array.isArray(value.activity) || value.activity.length !== value.sequence) return false
  const entries = new Map<string, RecordValue>()
  for (const entry of value.entries) {
    if (!record(entry, ['id', 'collectionId', 'authorId', 'revision', 'status', 'approval', 'published', 'feedback', 'title', 'slug', 'body']) || !text(entry.id, 1, 100) || entries.has(entry.id) || !['pages', 'articles'].includes(String(entry.collectionId)) || entry.authorId !== 'cms-author' || !integer(entry.revision) || !entryStatuses.includes(String(entry.status)) || !text(entry.feedback, 0, 500) || !content(entry)) return false
    if (entry.id !== 'cms-page-001' && entry.id !== 'cms-article-001' && (!/^cms-entry-\d{4,}$/.test(entry.id) || Number(entry.id.slice(10)) > value.sequence || Number(entry.id.slice(10)) < 1)) return false
    if (entry.approval !== null && (!record(entry.approval, ['revision', 'reviewerId', 'receipt']) || entry.approval.revision !== entry.revision || entry.approval.reviewerId !== 'cms-reviewer' || !receipt(entry.approval.receipt))) return false
    if (entry.published !== null && (!record(entry.published, ['title', 'slug', 'body', 'revision', 'receipt']) || !content(entry.published) || !integer(entry.published.revision) || entry.published.revision > entry.revision || !receipt(entry.published.receipt))) return false
    if (['approved', 'published'].includes(String(entry.status)) !== (entry.approval !== null)) return false
    if (entry.status === 'retired' && entry.published !== null) return false
    const published = entry.published as RecordValue | null
    if (entry.status === 'published' && (published === null || published.revision !== entry.revision || ['title', 'slug', 'body'].some(key => published[key] !== entry[key]))) return false
    entries.set(entry.id, entry)
  }
  if (entries.get('cms-page-001')?.collectionId !== 'pages' || entries.get('cms-article-001')?.collectionId !== 'articles') return false
  const slugs = new Map<string, string>()
  for (const [id, entry] of entries) {
    const publication = entry.published as RecordValue | null
    for (const slug of [entry.slug, publication?.slug].filter((item): item is string => typeof item === 'string')) {
      const key = `${entry.collectionId}:${slug}`
      if (slugs.has(key) && slugs.get(key) !== id) return false
      slugs.set(key, id)
    }
  }
  for (const [index, activity] of value.activity.entries()) {
    if (!record(activity, ['receipt', 'entryId', 'revision', 'actorId', 'action']) || activity.receipt !== `MOCK-CMS-${String(index + 1).padStart(4, '0')}` || !text(activity.entryId, 1, 100) || !integer(activity.revision) || !text(activity.action, 1, 100) || !Object.hasOwn(actionActors, activity.action) || activity.actorId !== actionActors[activity.action]) return false
    const entry = entries.get(activity.entryId)
    if (!entry || activity.revision > Number(entry.revision)) return false
  }
  for (const entry of entries.values()) {
    if (String(entry.id).startsWith('cms-entry-') && !value.activity.some(activity => activity.entryId === entry.id && activity.action === 'Created draft' && activity.receipt === `MOCK-CMS-${String(Number(String(entry.id).slice(10))).padStart(4, '0')}`)) return false
    for (const [key, expectedAction] of [['approval', 'Approved exact draft revision'], ['published', 'Simulated publication']]) {
      const nested = entry[key] as RecordValue | null
      if (nested === null) continue
      if (String(nested.receipt).startsWith('MOCK-CMS-')) {
        if (!value.activity.some(activity => activity.receipt === nested.receipt && activity.entryId === entry.id && activity.revision === nested.revision && activity.action === expectedAction)) return false
      } else if (entry.id !== 'cms-page-001' || nested.revision !== 1 || nested.receipt !== (key === 'approval' ? 'SEED-CMS-REVIEW' : 'SEED-CMS-PUBLICATION')) return false
    }
  }
  if (Object.hasOwn(value, 'releaseBundles')) {
    if (!Array.isArray(value.releaseBundles)) return false
    const activityRecords = value.activity as RecordValue[]
    // Historical captures are checked against immutable receipt evidence, not current
    // eligibility. Editing/reviewing/publishing later must not invalidate a saved draft.
    const historicalReceipt = (nested: RecordValue, entryId: string, action: string, maximum: number, seed: string) => {
      if (String(nested.receipt).startsWith('MOCK-CMS-')) return activityRecords.some((item, index) => index < maximum && item.receipt === nested.receipt && item.entryId === entryId && item.revision === nested.revision && item.action === action)
      return entryId === 'cms-page-001' && nested.revision === 1 && nested.receipt === seed
    }
    const publication = (nested: unknown, entryId: string, maximumRevision: number, maximumSequence: number): nested is RecordValue => record(nested, ['title', 'slug', 'body', 'revision', 'receipt']) && content(nested) && integer(nested.revision) && nested.revision <= maximumRevision && receipt(nested.receipt) && historicalReceipt(nested, entryId, 'Simulated publication', maximumSequence, 'SEED-CMS-PUBLICATION')
    let previousPreparedSequence = 0
    for (const [index, bundle] of value.releaseBundles.entries()) {
      if (!record(bundle, ['id', 'name', 'status', 'createdBy', 'preparedAtSequence', 'members', 'activatedAtSequence', 'activatedPublications']) || bundle.id !== `cms-release-${String(index + 1).padStart(4, '0')}` || !text(bundle.name, 1, 100) || hasControlCharacter(bundle.name) || !['draft', 'activated'].includes(String(bundle.status)) || bundle.createdBy !== 'cms-publisher' || !integer(bundle.preparedAtSequence, 0) || bundle.preparedAtSequence < previousPreparedSequence || bundle.preparedAtSequence > value.sequence || !Array.isArray(bundle.members) || bundle.members.length < 2) return false
      previousPreparedSequence = bundle.preparedAtSequence
      const ids = new Set<string>()
      const routes = new Set<string>()
      for (const member of bundle.members) {
        if (!record(member, ['entryId', 'collectionId', 'authorId', 'revision', 'title', 'slug', 'body', 'approval', 'previousPublication']) || !text(member.entryId, 1, 100) || ids.has(member.entryId) || !['pages', 'articles'].includes(String(member.collectionId)) || member.authorId !== 'cms-author' || !integer(member.revision) || !content(member) || !record(member.approval, ['revision', 'reviewerId', 'receipt']) || member.approval.revision !== member.revision || member.approval.reviewerId !== 'cms-reviewer' || !receipt(member.approval.receipt) || !historicalReceipt(member.approval, member.entryId, 'Approved exact draft revision', bundle.preparedAtSequence, 'SEED-CMS-REVIEW')) return false
        const capturedEntry = entries.get(member.entryId)
        if (!capturedEntry || capturedEntry.collectionId !== member.collectionId || capturedEntry.authorId !== member.authorId) return false
        if (member.previousPublication !== null && !publication(member.previousPublication, member.entryId, member.revision, bundle.preparedAtSequence)) return false
        const route = `${member.collectionId}:${member.slug}`
        if (routes.has(route)) return false
        routes.add(route)
        ids.add(member.entryId)
      }
      if (bundle.status === 'draft') {
        if (bundle.activatedAtSequence !== null || bundle.activatedPublications !== null) return false
      } else {
        if (!integer(bundle.activatedAtSequence) || bundle.activatedAtSequence > value.sequence || !Array.isArray(bundle.activatedPublications) || bundle.activatedPublications.length !== bundle.members.length || bundle.activatedAtSequence - bundle.members.length < bundle.preparedAtSequence) return false
        for (const [memberIndex, activated] of bundle.activatedPublications.entries()) {
          const member = bundle.members[memberIndex]
          if (!record(activated, ['entryId', 'publication']) || activated.entryId !== member.entryId || !publication(activated.publication, member.entryId, member.revision, bundle.activatedAtSequence)) return false
          const capturedPublication = activated.publication
          if (capturedPublication.revision !== member.revision || ['title', 'slug', 'body'].some(key => capturedPublication[key] !== member[key]) || capturedPublication.receipt !== `MOCK-CMS-${String(bundle.activatedAtSequence - bundle.members.length + memberIndex + 1).padStart(4, '0')}`) return false
        }
      }
    }
  }
  return true
}
