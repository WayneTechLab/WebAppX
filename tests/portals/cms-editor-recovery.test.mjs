import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const recovery = await loadMockModel(new URL('../../src/cms/editor-recovery.ts', import.meta.url))
const cms = await loadMockModel(new URL('../../src/cms/model.ts', import.meta.url))
const author = { id: 'cms-author', role: 'author', name: 'Author fixture' }
const viewer = { id: 'cms-viewer', role: 'viewer', name: 'Viewer fixture' }
const content = { title: 'Original fictional title', slug: 'original-slug', body: 'Original fictional plain-text body.' }
const entry = () => ({ id: 'cms-article-001', collectionId: 'articles', authorId: 'cms-author', revision: 2, status: 'draft', approval: null, published: null, feedback: '', ...content })
const state = () => ({ entries: [entry()], activity: [], sequence: 0 })
const buffer = () => ({ ...recovery.createCmsEditorBuffer(entry(), 4), content: { ...content, title: '  Exact unsaved title <script>fiction</script>  ' } })
const restored = () => ({ entries: [{ ...entry(), title: 'Restored title', slug: 'restored-slug', body: 'Restored body from a different saved workspace.' }], activity: [], sequence: 0 })

test('capturing an editor makes independent exact baseline and raw-text copies without domain fields', () => {
  const original = entry()
  const value = recovery.createCmsEditorBuffer(original, 4)
  assert.deepEqual(value, { entryId: 'cms-article-001', authorId: 'cms-author', collectionId: 'articles', revision: 2, replacementEpoch: 4, baseline: content, content })
  value.content.title = 'Temporary text'
  assert.equal(original.title, 'Original fictional title')
  assert.equal(value.baseline.title, 'Original fictional title')
  assert.equal(Object.hasOwn(original, 'replacementEpoch'), false)
})

test('field edits follow save normalization while retaining every raw value for comparison', () => {
  const value = recovery.createCmsEditorBuffer(entry(), 4)
  value.content = { title: ' Original fictional title ', slug: ' ORIGINAL-SLUG ', body: '\nOriginal fictional plain-text body. ' }
  assert.deepEqual(recovery.cmsEditorEditedFields(value), [])
  assert.equal(recovery.compareCmsEditor(value, restored(), 5).kind, 'clean')
  value.content.body = ' Changed body <b>as text</b>. '
  assert.deepEqual(recovery.cmsEditorEditedFields(value), ['body'])
  assert.equal(recovery.compareCmsEditor(value, restored(), 5).fields[1].unsaved, ' ORIGINAL-SLUG ')
})

test('same-revision replacement shows literal baseline, restored and exact unsaved field values', () => {
  const value = buffer()
  const comparison = recovery.compareCmsEditor(value, restored(), 5)
  assert.equal(comparison.kind, 'stale')
  assert.equal(comparison.outdated, true)
  assert.deepEqual(comparison.editedFields, ['title'])
  assert.deepEqual(comparison.fields, [
    { field: 'title', baseline: 'Original fictional title', restored: 'Restored title', unsaved: '  Exact unsaved title <script>fiction</script>  ', edited: true },
    { field: 'slug', baseline: 'original-slug', restored: 'restored-slug', unsaved: 'original-slug', edited: false },
    { field: 'body', baseline: 'Original fictional plain-text body.', restored: 'Restored body from a different saved workspace.', unsaved: 'Original fictional plain-text body.', edited: false },
  ])
})

test('ordinary dirty typing is current until content, identity, revision or replacement epoch changes', () => {
  const value = buffer()
  assert.equal(recovery.compareCmsEditor(value, state(), 4).kind, 'current')
  for (const alter of [
    next => { next.entries[0].title = 'Different same-revision title' },
    next => { next.entries[0].revision = 3 },
    next => { next.entries[0].authorId = 'foreign-author' },
    next => { next.entries[0].collectionId = 'pages' },
  ]) {
    const next = state(); alter(next)
    assert.equal(recovery.compareCmsEditor(value, next, 4).kind, 'stale')
  }
  assert.equal(recovery.compareCmsEditor(value, state(), 5).kind, 'stale', 'An identical replacement still has an explicit epoch')
})

test('reapply keeps only meaningfully edited raw fields and rebases untouched fields onto restored content', () => {
  const value = buffer()
  value.content.slug = ' ORIGINAL-SLUG '
  value.content.body = ' Original fictional plain-text body. '
  const next = restored(), before = structuredClone(next), original = structuredClone(value)
  const comparison = recovery.compareCmsEditor(value, next, 5)
  const result = recovery.resolveCmsEditor(value, next, 5, comparison.token, 'reapply', author)
  assert.equal(result.ok, true)
  assert.deepEqual(result.buffer, {
    entryId: 'cms-article-001', authorId: 'cms-author', collectionId: 'articles', revision: 2, replacementEpoch: 5,
    baseline: { title: 'Restored title', slug: 'restored-slug', body: 'Restored body from a different saved workspace.' },
    content: { title: '  Exact unsaved title <script>fiction</script>  ', slug: 'restored-slug', body: 'Restored body from a different saved workspace.' },
  })
  assert.deepEqual(result.issues, [])
  assert.deepEqual(next, before)
  assert.deepEqual(value, original)
  assert.equal(recovery.compareCmsEditor(result.buffer, next, 5).kind, 'current')
})

test('reload explicitly drops the volatile buffer without changing any restored record or receipt', () => {
  const value = buffer(), next = restored(), before = structuredClone(next)
  const comparison = recovery.compareCmsEditor(value, next, 5)
  assert.deepEqual(recovery.resolveCmsEditor(value, next, 5, comparison.token, 'reload', viewer), { ok: true, buffer: null, entryId: 'cms-article-001', issues: [] })
  assert.deepEqual(next, before)
})

test('a second restore or changed compared text invalidates both old recovery choices', () => {
  const value = buffer(), next = restored()
  const token = recovery.compareCmsEditor(value, next, 5).token
  const changedState = structuredClone(next); changedState.entries[0].body = 'A second restored body.'
  const changedBuffer = structuredClone(value); changedBuffer.content.title = 'A different raw unsaved title'
  for (const [draft, current, epoch] of [[value, next, 6], [value, changedState, 5], [changedBuffer, next, 5]]) {
    for (const choice of ['reload', 'reapply']) assert.deepEqual(recovery.resolveCmsEditor(draft, current, epoch, token, choice, author), { ok: false, message: 'The restored draft or unsaved text changed. Review the current comparison before choosing.' })
  }
})

test('reapply requires the recognized assigned author and does not treat a previous author as authority', () => {
  const value = buffer(), next = restored()
  const token = recovery.compareCmsEditor(value, next, 5).token
  for (const actor of [viewer, { ...author, id: 'foreign-author' }, { ...author, role: 'publisher' }]) {
    assert.deepEqual(recovery.resolveCmsEditor(value, next, 5, token, 'reapply', actor), { ok: false, message: 'Only the restored entry’s assigned author can reapply unsaved text.' })
  }
  next.entries[0].authorId = 'foreign-author'
  assert.equal(recovery.resolveCmsEditor(value, next, 5, recovery.compareCmsEditor(value, next, 5).token, 'reapply', author).ok, false)
})

test('a missing restored entry preserves comparison text, refuses reapply and permits explicit reload', () => {
  const value = buffer(), next = { entries: [], activity: [], sequence: 0 }
  const comparison = recovery.compareCmsEditor(value, next, 5)
  assert.equal(comparison.kind, 'missing')
  assert.deepEqual(comparison.fields.map(field => field.restored), [null, null, null])
  const before = structuredClone(value)
  assert.equal(recovery.resolveCmsEditor(value, next, 5, comparison.token, 'reapply', author).ok, false)
  assert.deepEqual(value, before)
  assert.deepEqual(recovery.resolveCmsEditor(value, next, 5, comparison.token, 'reload', author), { ok: true, buffer: null, entryId: null, issues: [] })
})

test('invalid reapplied text remains editable with all issues while ordinary Save refuses without mutation', () => {
  const value = buffer(), next = restored()
  value.content = { title: 'x', slug: 'two--hyphens', body: 'short' }
  const result = recovery.resolveCmsEditor(value, next, 5, recovery.compareCmsEditor(value, next, 5).token, 'reapply', author)
  assert.equal(result.ok, true)
  assert.deepEqual(result.buffer.content, { title: 'x', slug: 'two--hyphens', body: 'short' })
  assert.deepEqual(result.issues.map(issue => issue.field), ['title', 'slug', 'body'])
  const before = structuredClone(next)
  assert.throws(() => cms.transitionCms(next, { type: 'edit-entry', entryId: result.buffer.entryId, expectedRevision: result.buffer.revision, ...result.buffer.content }, author), /title must contain/)
  assert.deepEqual(next, before)
})

test('a restored collection slug conflict stays visible and cannot be saved by reapplying', () => {
  const value = buffer(), next = restored()
  value.content.slug = 'reserved-slug'
  next.entries.push({ ...entry(), id: 'cms-entry-0001', slug: 'reserved-slug', title: 'Another restored article' })
  const result = recovery.resolveCmsEditor(value, next, 5, recovery.compareCmsEditor(value, next, 5).token, 'reapply', author)
  assert.equal(result.ok, true)
  assert.deepEqual(result.issues, [{ field: 'slug', message: 'This collection already has that draft or published slug. Choose another slug.' }])
  const before = structuredClone(next)
  assert.throws(() => cms.transitionCms(next, { type: 'edit-entry', entryId: result.buffer.entryId, expectedRevision: result.buffer.revision, ...result.buffer.content }, author), /already has/)
  assert.deepEqual(next, before)
})

test('only explicit ordinary Save produces a new revision after buffer recovery', () => {
  const value = buffer(), next = restored()
  next.entries[0].published = { title: 'Frozen publication', slug: 'frozen-slug', body: 'Previously published fictional content.', revision: 1, receipt: 'SEED-PUBLICATION' }
  const before = structuredClone(next)
  const result = recovery.resolveCmsEditor(value, next, 5, recovery.compareCmsEditor(value, next, 5).token, 'reapply', author)
  assert.equal(next.sequence, 0)
  assert.deepEqual(next, before)
  const saved = cms.transitionCms(next, { type: 'edit-entry', entryId: result.buffer.entryId, expectedRevision: result.buffer.revision, ...result.buffer.content }, author)
  assert.equal(saved.entries[0].revision, 3)
  assert.equal(saved.entries[0].title, 'Exact unsaved title <script>fiction</script>')
  assert.equal(saved.entries[0].slug, 'restored-slug')
  assert.equal(saved.entries[0].body, 'Restored body from a different saved workspace.')
  assert.deepEqual(saved.entries[0].published, before.entries[0].published)
  assert.deepEqual(saved.activity, [{ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 3, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' }])
})
