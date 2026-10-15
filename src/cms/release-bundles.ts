import { cmsActors, type CmsActor, type CmsPublication, type CmsState } from './model'
import { isCmsState } from './persistence'
import type { CmsReleaseBundle } from './release-types'

export type CmsReleaseIssue = { code: string; entryId?: string; message: string }
export type CmsReleasePreview = {
  bundle: CmsReleaseBundle | null
  issues: CmsReleaseIssue[]
  confirmation: string | null
}

function isPublisher(actor: CmsActor) {
  return actor.role === 'publisher' && cmsActors.some(person => person.id === actor.id && person.role === actor.role)
}
function samePublication(left: CmsPublication | null, right: CmsPublication | null) {
  return left === null || right === null ? left === right : left.revision === right.revision && left.receipt === right.receipt && left.title === right.title && left.slug === right.slug && left.body === right.body
}
function confirmation(state: CmsState, bundleId: string, actor: CmsActor) {
  // A volatile comparison value, never persisted or treated as account authority.
  // The complete accepted workspace binds unrelated editorial changes as well.
  return JSON.stringify({ state, bundleId, actorId: actor.id, role: actor.role })
}
function duplicateRoutes(state: CmsState): CmsReleaseIssue[] {
  const owners = new Map<string, string>()
  const issues: CmsReleaseIssue[] = []
  if (!Array.isArray(state.entries)) return issues
  for (const entry of state.entries) {
    if (!entry || typeof entry.id !== 'string') continue
    for (const slug of new Set([entry.slug, entry.published?.slug].filter((item): item is string => typeof item === 'string'))) {
      const route = `${entry.collectionId}/${slug}`
      const owner = owners.get(route)
      if (owner && owner !== entry.id) issues.push({ code: 'duplicate-route', entryId: entry.id, message: `Duplicate route ${route} is reserved by ${owner} and ${entry.id}.` })
      owners.set(route, entry.id)
    }
  }
  return issues
}

/** Capture approved snapshots without changing entries, publications or receipts. */
export function prepareCmsReleaseBundle(previous: CmsState, draft: { name: string; entryIds: readonly string[] }, actor: CmsActor): CmsState {
  if (!isPublisher(actor)) throw new Error('Only the publisher preview can prepare a local release.')
  if (!isCmsState(previous)) throw new Error('The CMS workspace is invalid. No release was prepared.')
  if (typeof draft.name !== 'string' || !draft.name.trim() || draft.name.trim().length > 100 || [...draft.name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Give the release a name of 1–100 characters on one line.')
  if (!Array.isArray(draft.entryIds) || draft.entryIds.length < 2 || new Set(draft.entryIds).size !== draft.entryIds.length) throw new Error('Choose at least two different approved entries for the release.')
  const members = draft.entryIds.map(entryId => {
    const entry = previous.entries.find(item => item.id === entryId)
    if (!entry || entry.status !== 'approved' || !entry.approval || entry.approval.revision !== entry.revision || entry.approval.reviewerId === entry.authorId) throw new Error(`${entryId}: the current revision needs separate reviewer approval before it can join a release.`)
    return { entryId: entry.id, collectionId: entry.collectionId, authorId: entry.authorId, revision: entry.revision, title: entry.title, slug: entry.slug, body: entry.body, approval: structuredClone(entry.approval), previousPublication: structuredClone(entry.published) }
  })
  const state = structuredClone(previous)
  const bundles = state.releaseBundles ?? []
  bundles.push({ id: `cms-release-${String(bundles.length + 1).padStart(4, '0')}`, name: draft.name.trim(), status: 'draft', createdBy: actor.id, preparedAtSequence: state.sequence, members, activatedAtSequence: null, activatedPublications: null })
  state.releaseBundles = bundles
  if (!isCmsState(state)) throw new Error('The release snapshots are invalid. No release was prepared.')
  return state
}

/** Read-only readiness report. A previously captured release can validly be stale. */
export function previewCmsReleaseBundle(state: CmsState, bundleId: string, actor: CmsActor): CmsReleasePreview {
  const issues: CmsReleaseIssue[] = duplicateRoutes(state)
  if (!isPublisher(actor)) issues.push({ code: 'permission', message: 'Select the publisher preview to activate a local release.' })
  if (!isCmsState(state)) return { bundle: null, issues: [...issues, { code: 'invalid-workspace', message: 'The CMS workspace or captured release snapshots are invalid. No entries can be activated.' }], confirmation: null }
  const bundle = state.releaseBundles?.find(item => item.id === bundleId) ?? null
  if (!bundle) return { bundle, issues: [...issues, { code: 'missing-release', message: 'This local release was not found.' }], confirmation: null }
  if (bundle.status !== 'draft') issues.push({ code: 'already-activated', message: 'This release is already activated. It cannot be replayed.' })
  for (const member of bundle.members) {
    const entry = state.entries.find(item => item.id === member.entryId)
    if (!entry) { issues.push({ code: 'missing-entry', entryId: member.entryId, message: `${member.entryId}: the captured entry is missing.` }); continue }
    if (entry.status !== 'approved' || !entry.approval || entry.approval.revision !== member.revision || entry.approval.reviewerId !== member.approval.reviewerId || entry.approval.receipt !== member.approval.receipt) issues.push({ code: 'stale-approval', entryId: entry.id, message: `${entry.id}: the captured approval is stale. Prepare a new release after review.` })
    if (entry.revision !== member.revision || entry.collectionId !== member.collectionId || entry.authorId !== member.authorId || entry.title !== member.title || entry.slug !== member.slug || entry.body !== member.body) issues.push({ code: 'stale-content', entryId: entry.id, message: `${entry.id}: the current draft differs from the captured revision.` })
    if (!samePublication(entry.published, member.previousPublication)) issues.push({ code: 'stale-publication', entryId: entry.id, message: `${entry.id}: the previous frozen publication has changed since preparation.` })
  }
  return { bundle, issues, confirmation: issues.length ? null : confirmation(state, bundleId, actor) }
}

/** Validate everything before building one replacement; callers accept it once. */
export function activateCmsReleaseBundle(previous: CmsState, bundleId: string, actor: CmsActor, expected: string): CmsState {
  const preview = previewCmsReleaseBundle(previous, bundleId, actor)
  if (preview.issues.length || !preview.bundle || !preview.confirmation) throw new Error(preview.issues.map(issue => issue.message).join(' ') || 'This release cannot be activated.')
  if (typeof expected !== 'string' || expected !== preview.confirmation) throw new Error('The release preview is stale. Preview the current workspace and confirm again.')
  const state = structuredClone(previous)
  const bundle = state.releaseBundles!.find(item => item.id === bundleId)!
  bundle.activatedPublications = bundle.members.map(member => {
    const entry = state.entries.find(item => item.id === member.entryId)!
    state.sequence += 1
    const receipt = `MOCK-CMS-${String(state.sequence).padStart(4, '0')}`
    const publication = { title: member.title, slug: member.slug, body: member.body, revision: member.revision, receipt }
    entry.status = 'published'
    entry.published = publication
    state.activity.push({ receipt, entryId: entry.id, revision: entry.revision, actorId: actor.id, action: 'Simulated publication' })
    return { entryId: entry.id, publication: structuredClone(publication) }
  })
  bundle.status = 'activated'
  bundle.activatedAtSequence = state.sequence
  if (!isCmsState(state)) throw new Error('The complete release could not be validated. No entries were activated.')
  return state
}
