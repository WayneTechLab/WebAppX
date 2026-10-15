import { cmsActors, cmsDraftIsDirty, validateCmsDraft, type CmsActor, type CmsContent, type CmsDraftIssue, type CmsEntry, type CmsState } from './model'

export type CmsEditorBuffer = {
  entryId: string
  authorId: string
  collectionId: string
  revision: number
  replacementEpoch: number
  baseline: CmsContent
  content: CmsContent
}
export type CmsEditorField = keyof CmsContent
export type CmsEditorComparison = {
  kind: 'clean' | 'current' | 'stale' | 'missing'
  dirty: boolean
  outdated: boolean
  token: string
  entry: CmsEntry | null
  editedFields: CmsEditorField[]
  fields: { field: CmsEditorField; baseline: string; restored: string | null; unsaved: string; edited: boolean }[]
}
export type CmsEditorResolution =
  | { ok: true; buffer: CmsEditorBuffer | null; entryId: string | null; issues: CmsDraftIssue[] }
  | { ok: false; message: string }

const fields: CmsEditorField[] = ['title', 'slug', 'body']
const contentOf = (content: CmsContent): CmsContent => ({ title: content.title, slug: content.slug, body: content.body })
const normalizedField = (field: CmsEditorField, value: string) => field === 'slug' ? value.trim().toLowerCase() : value.trim()
const contentSignature = (content: CmsContent) => fields.map(field => content[field])
const entrySignature = (entry: CmsEntry | null) => entry && [
  entry.id, entry.authorId, entry.collectionId, entry.revision, entry.status,
  ...contentSignature(entry), entry.feedback,
  entry.approval && [entry.approval.revision, entry.approval.reviewerId, entry.approval.receipt],
  entry.published && [entry.published.revision, entry.published.receipt, ...contentSignature(entry.published)],
]

/** Volatile editor data only: never include it in domain state or a backup. */
export function createCmsEditorBuffer(entry: CmsEntry, replacementEpoch: number): CmsEditorBuffer {
  return { entryId: entry.id, authorId: entry.authorId, collectionId: entry.collectionId, revision: entry.revision, replacementEpoch, baseline: contentOf(entry), content: contentOf(entry) }
}

/** A normalization-only edit stays clean, while its raw text remains available
 * for comparison if another field has a meaningful unsaved change.
 */
export function cmsEditorEditedFields(buffer: CmsEditorBuffer): CmsEditorField[] {
  return fields.filter(field => normalizedField(field, buffer.content[field]) !== normalizedField(field, buffer.baseline[field]))
}

/** Revision equality alone is insufficient after importing a different save.
 * The token binds the exact comparison, including a second replacement epoch,
 * the restored record and raw unsaved text. It is a local freshness check.
 */
export function compareCmsEditor(buffer: CmsEditorBuffer, state: CmsState, replacementEpoch: number): CmsEditorComparison {
  const entry = state.entries.find(value => value.id === buffer.entryId) ?? null
  const dirty = cmsDraftIsDirty(buffer.content, buffer.baseline)
  const outdated = replacementEpoch !== buffer.replacementEpoch || !entry || entry.revision !== buffer.revision
    || entry.authorId !== buffer.authorId || entry.collectionId !== buffer.collectionId
    || fields.some(field => entry[field] !== buffer.baseline[field])
  const editedFields = cmsEditorEditedFields(buffer)
  return {
    kind: !dirty ? 'clean' : !entry ? 'missing' : outdated ? 'stale' : 'current', dirty, outdated,
    token: JSON.stringify([replacementEpoch, entrySignature(entry), buffer.entryId, buffer.authorId, buffer.collectionId, buffer.revision, buffer.replacementEpoch, contentSignature(buffer.baseline), contentSignature(buffer.content)]),
    entry, editedFields,
    fields: fields.map(field => ({ field, baseline: buffer.baseline[field], restored: entry?.[field] ?? null, unsaved: buffer.content[field], edited: editedFields.includes(field) })),
  }
}

/** Recovery changes the buffer only. Invalid reapplication remains editable;
 * ordinary validation and transitionCms must still accept an explicit Save.
 */
export function resolveCmsEditor(buffer: CmsEditorBuffer, state: CmsState, replacementEpoch: number, token: string, choice: 'reload' | 'reapply', actor: CmsActor): CmsEditorResolution {
  const comparison = compareCmsEditor(buffer, state, replacementEpoch)
  if (comparison.token !== token) return { ok: false, message: 'The restored draft or unsaved text changed. Review the current comparison before choosing.' }
  if (!comparison.dirty || !comparison.outdated) return { ok: false, message: 'This editor no longer needs recovery. Review the current draft before continuing.' }
  if (choice === 'reload') return { ok: true, buffer: null, entryId: comparison.entry?.id ?? null, issues: [] }
  if (choice !== 'reapply') return { ok: false, message: 'Choose reload or reapply for this editor.' }
  if (!comparison.entry) return { ok: false, message: 'The edited entry is missing from the restored workspace. Its unsaved text is preserved; reload to discard it or restore a workspace containing that entry.' }
  if (!cmsActors.some(person => person.id === actor.id && person.role === actor.role) || actor.role !== 'author' || actor.id !== comparison.entry.authorId) return { ok: false, message: 'Only the restored entry’s assigned author can reapply unsaved text.' }
  const next = createCmsEditorBuffer(comparison.entry, replacementEpoch)
  for (const field of comparison.editedFields) next.content[field] = buffer.content[field]
  const validation = validateCmsDraft(state, { ...next.content, collectionId: next.collectionId }, { entryId: next.entryId })
  return { ok: true, buffer: next, entryId: next.entryId, issues: validation.errors }
}
