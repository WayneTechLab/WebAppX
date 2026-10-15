import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../../src/cms/model.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const cms = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const [author, reviewer, publisher, viewer] = cms.cmsActors
const draftId = 'cms-article-001'
const change = (state, event, actor = author) => cms.transitionCms(state, event, actor)
const current = (state, id = draftId) => state.entries.find(entry => entry.id === id)
const action = (state, type, entryId = draftId) => ({ type, entryId, expectedRevision: current(state, entryId).revision })
const content = { title: 'A fictional new article', slug: 'sample-article', body: 'A fictional article body with no real personal information.' }

function approved(state = cms.createCmsState()) {
  state = change(state, action(state, 'submit-review'))
  return change(state, action(state, 'approve-entry'), reviewer)
}

test('CMS fixtures are independent and public projection excludes unpublished drafts and private metadata', () => {
  const state = cms.createCmsState()
  const projection = cms.cmsPublishedEntries(state)
  assert.equal(projection.length, 1)
  assert.equal(projection[0].slug, 'welcome')
  for (const key of ['authorId', 'approval', 'feedback', 'status']) assert.equal(key in projection[0], false)
  state.entries[0].title = 'Changed only in this session'
  assert.notEqual(cms.createCmsState().entries[0].title, state.entries[0].title)
})

test('author creates normalized unique content without changing previous state', () => {
  const before = cms.createCmsState()
  const state = change(before, { type: 'create-entry', collectionId: 'articles', ...content, slug: '  SAMPLE-ARTICLE  ' })
  assert.equal(before.entries.length, 2)
  assert.equal(state.entries.length, 3)
  assert.equal(state.entries.at(-1).slug, 'sample-article')
  assert.equal(state.entries.at(-1).authorId, author.id)
  assert.equal(state.activity.at(-1).receipt, 'MOCK-CMS-0001')
  assert.throws(() => change(state, { type: 'create-entry', collectionId: 'articles', ...content, slug: 'SAMPLE-ARTICLE' }), /already has/)
  const otherCollection = change(state, { type: 'create-entry', collectionId: 'pages', ...content })
  assert.equal(otherCollection.entries.length, 4)
})

test('invalid collections and content fields are refused before a receipt is produced', () => {
  const state = cms.createCmsState()
  for (const invalid of [{ collectionId: 'unknown' }, { title: 'x' }, { slug: '../private' }, { slug: 'two--hyphens' }, { body: 'short' }, { body: 'x'.repeat(8001) }]) {
    assert.throws(() => change(state, { type: 'create-entry', collectionId: 'articles', ...content, ...invalid }))
  }
  assert.equal(state.sequence, 0)
  assert.equal(state.activity.length, 0)
})

test('review and publishing roles enforce direct-call permissions and separate reviewer identity', () => {
  const state = cms.createCmsState()
  for (const actor of [reviewer, publisher, viewer]) assert.throws(() => change(state, { type: 'create-entry', collectionId: 'articles', ...content }, actor))
  assert.throws(() => change(state, action(state, 'submit-review'), reviewer), /assigned author/)
  assert.throws(() => change(state, action(state, 'approve-entry'), author), /separate reviewer/)
  assert.throws(() => change(state, action(state, 'publish-entry'), author), /publisher/)
  assert.throws(() => change(state, action(state, 'submit-review'), { ...author, id: 'foreign-author' }), /recognized/)
  const pending = change(state, action(state, 'submit-review'))
  pending.entries.find(entry => entry.id === draftId).authorId = reviewer.id
  assert.throws(() => change(pending, action(pending, 'approve-entry'), reviewer), /separate reviewer/)
})

test('draft review and publication require the correct stage and reject replay', () => {
  let state = cms.createCmsState()
  assert.throws(() => change(state, action(state, 'approve-entry'), reviewer), /submitted draft/)
  assert.throws(() => change(state, action(state, 'publish-entry'), publisher), /approval/)
  state = change(state, action(state, 'submit-review'))
  assert.throws(() => change(state, action(state, 'submit-review')), /Only a draft/)
  state = change(state, action(state, 'approve-entry'), reviewer)
  assert.throws(() => change(state, action(state, 'approve-entry'), reviewer), /submitted draft/)
  state = change(state, action(state, 'publish-entry'), publisher)
  assert.equal(current(state).published.revision, 1)
  assert.throws(() => change(state, action(state, 'publish-entry'), publisher), /approval/)
  assert.equal(new Set(state.activity.map(entry => entry.receipt)).size, state.activity.length)
})

test('returned review feedback persists until saved edits and requires a fresh review', () => {
  let state = change(cms.createCmsState(), { type: 'submit-review', entryId: draftId, expectedRevision: 1 })
  assert.throws(() => change(state, { ...action(state, 'return-draft'), feedback: '' }, reviewer), /feedback/)
  state = change(state, { ...action(state, 'return-draft'), feedback: 'Clarify the fictional headline.' }, reviewer)
  assert.equal(current(state).status, 'draft')
  assert.equal(current(state).feedback, 'Clarify the fictional headline.')
  state = change(state, { ...action(state, 'edit-entry'), ...content })
  assert.equal(current(state).feedback, '')
  assert.equal(current(state).revision, 2)
  assert.equal(current(state).approval, null)
  assert.throws(() => change(state, action(state, 'publish-entry'), publisher), /approval/)
})

test('editing approved content invalidates approval and stale revision actions are refused', () => {
  let state = approved()
  const stale = action(state, 'publish-entry')
  state = change(state, { ...action(state, 'edit-entry'), ...content })
  assert.equal(current(state).status, 'draft')
  assert.equal(current(state).approval, null)
  assert.throws(() => change(state, stale, publisher), /revision has changed/)
  assert.throws(() => change(state, action(state, 'publish-entry'), publisher), /approval/)
  const malformed = approved()
  current(malformed).approval.revision = 0
  assert.throws(() => change(malformed, action(malformed, 'publish-entry'), publisher), /current revision/)
})

test('published snapshot stays frozen while a later draft changes until separately approved and republished', () => {
  let state = approved()
  state = change(state, action(state, 'publish-entry'), publisher)
  const first = structuredClone(current(state).published)
  state = change(state, { ...action(state, 'edit-entry'), ...content })
  assert.deepEqual(current(state).published, first)
  assert.equal(cms.cmsPublishedEntries(state).find(entry => entry.entryId === draftId).title, first.title)
  state = approved(state)
  state = change(state, action(state, 'publish-entry'), publisher)
  assert.equal(current(state).published.title, content.title)
  assert.equal(current(state).published.revision, 2)
  assert.notEqual(current(state).published.receipt, first.receipt)
})

test('published slugs remain reserved while the author prepares a different draft slug', () => {
  let state = cms.createCmsState()
  state = change(state, { type: 'edit-entry', entryId: 'cms-page-001', expectedRevision: 1, ...content })
  assert.throws(() => change(state, { type: 'create-entry', collectionId: 'pages', ...content, slug: 'WELCOME' }), /already has/)
  assert.throws(() => change(state, { type: 'edit-entry', entryId: 'missing', expectedRevision: 1, ...content }), /not found/)
  assert.throws(() => change(state, { ...action(state, 'edit-entry'), title: current(state).title, slug: current(state).slug, body: current(state).body }), /Change the draft/)
})

test('only publisher retires a frozen publication and republication requires an edited fresh reviewed draft', () => {
  let state = cms.createCmsState()
  const event = action(state, 'retire-entry', 'cms-page-001')
  assert.throws(() => change(state, event, author), /publisher/)
  assert.throws(() => change(state, event, viewer), /read-only/)
  state = change(state, event, publisher)
  assert.equal(cms.cmsPublishedEntries(state).length, 0)
  assert.equal(current(state, 'cms-page-001').status, 'retired')
  assert.throws(() => change(state, event, publisher), /no current publication/)
  assert.throws(() => change(state, action(state, 'publish-entry', 'cms-page-001'), publisher), /approval/)
  state = change(state, { ...action(state, 'edit-entry', 'cms-page-001'), ...content })
  state = change(state, action(state, 'submit-review', 'cms-page-001'))
  state = change(state, action(state, 'approve-entry', 'cms-page-001'), reviewer)
  state = change(state, action(state, 'publish-entry', 'cms-page-001'), publisher)
  assert.equal(cms.cmsPublishedEntries(state)[0].title, content.title)
})
