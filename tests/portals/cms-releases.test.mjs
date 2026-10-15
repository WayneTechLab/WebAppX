import test from 'node:test'
import assert from 'node:assert/strict'
import { loadMockModel } from '../browser/model-loader.mjs'

const cms = await loadMockModel(new URL('../../src/cms/model.ts', import.meta.url))
const releases = await loadMockModel(new URL('../../src/cms/release-bundles.ts', import.meta.url))
const { isCmsState } = await loadMockModel(new URL('../../src/cms/persistence.ts', import.meta.url))
const [author, reviewer, publisher, viewer] = cms.cmsActors
const article = 'cms-article-001'
const page = 'cms-page-001'
const ids = [page, article]
function action(state, type, entryId, extra = {}) { return { type, entryId, expectedRevision: state.entries.find(entry => entry.id === entryId).revision, ...extra } }
function change(state, type, entryId, actor = author, extra = {}) { return cms.transitionCms(state, action(state, type, entryId, extra), actor) }
function approvedPair() {
  let state = cms.createCmsState()
  state = change(state, 'edit-entry', page, author, { title: 'Autumn welcome page', slug: 'autumn-welcome', body: 'A fictional autumn welcome page for a local release.' })
  state = change(state, 'submit-review', page)
  state = change(state, 'approve-entry', page, reviewer)
  state = change(state, 'submit-review', article)
  return change(state, 'approve-entry', article, reviewer)
}
function prepared() { return releases.prepareCmsReleaseBundle(approvedPair(), { name: 'Autumn sample release', entryIds: ids }, publisher) }
function preview(state, id = 'cms-release-0001', actor = publisher) { return releases.previewCmsReleaseBundle(state, id, actor) }
function activate(state, id = 'cms-release-0001') { return releases.activateCmsReleaseBundle(state, id, publisher, preview(state, id).confirmation) }
function unchangedOnRefusal(state, operation, pattern) {
  const before = JSON.stringify(state)
  assert.throws(operation, pattern)
  assert.equal(JSON.stringify(state), before, 'a refusal must preserve every workspace byte')
}

test('legacy absence remains byte-compatible and the publisher captures approved snapshots without publication or receipt changes', () => {
  const seed = cms.createCmsState()
  assert.equal(Object.hasOwn(seed, 'releaseBundles'), false)
  assert.equal(isCmsState(seed), true)
  const before = approvedPair()
  const state = releases.prepareCmsReleaseBundle(before, { name: '  Autumn sample release  ', entryIds: ids }, publisher)
  assert.deepEqual(state.entries, before.entries)
  assert.deepEqual(state.activity, before.activity)
  assert.equal(state.sequence, 5)
  assert.equal(Object.hasOwn(before, 'releaseBundles'), false)
  assert.deepEqual(state.releaseBundles, [{
    id: 'cms-release-0001', name: 'Autumn sample release', status: 'draft', createdBy: 'cms-publisher', preparedAtSequence: 5,
    members: [
      { entryId: page, collectionId: 'pages', authorId: 'cms-author', revision: 2, title: 'Autumn welcome page', slug: 'autumn-welcome', body: 'A fictional autumn welcome page for a local release.', approval: { revision: 2, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0003' }, previousPublication: seed.entries[0].published },
      { entryId: article, collectionId: 'articles', authorId: 'cms-author', revision: 1, title: 'A fictional team update', slug: 'team-update', body: 'Share a fictional company update here. This draft is visible in the editorial workspace and is excluded from the published sample.', approval: { revision: 1, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0005' }, previousPublication: null },
    ], activatedAtSequence: null, activatedPublications: null,
  }])
  assert.equal(isCmsState(state), true)
  assert.equal(isCmsState(JSON.parse(JSON.stringify(state))), true)
})

test('preparation refuses wrong identity, non-approved, duplicate, missing and undersized members without partial state', () => {
  const state = approvedPair()
  for (const actor of [author, reviewer, viewer, { ...publisher, id: 'cms-viewer' }]) unchangedOnRefusal(state, () => releases.prepareCmsReleaseBundle(state, { name: 'Release', entryIds: ids }, actor), /publisher/)
  for (const entryIds of [[], [page], [page, page], [page, 'missing']]) unchangedOnRefusal(state, () => releases.prepareCmsReleaseBundle(state, { name: 'Release', entryIds }, publisher), /at least two|needs separate/)
  unchangedOnRefusal(cms.createCmsState(), () => releases.prepareCmsReleaseBundle(cms.createCmsState(), { name: 'Release', entryIds: ids }, publisher), /approval/)
  for (const name of ['', '  ', 'x'.repeat(101), 'Release\nnext line', 'Release\u0000']) unchangedOnRefusal(state, () => releases.prepareCmsReleaseBundle(state, { name, entryIds: ids }, publisher), /name/)
})

test('read-only preview exposes exact members and does not alter any complete workspace field', () => {
  const state = prepared()
  const before = JSON.stringify(state)
  assert.deepEqual(preview(state).issues, [])
  assert.equal(preview(state).bundle.id, 'cms-release-0001')
  assert.equal(typeof preview(state).confirmation, 'string')
  assert.equal(JSON.stringify(state), before)
  assert.equal(preview(state, 'missing').issues[0].code, 'missing-release')
  assert.equal(preview(state, 'cms-release-0001', viewer).confirmation, null)
  assert.equal(preview(state, 'cms-release-0001', { ...publisher, id: author.id }).issues[0].code, 'permission')
})

test('activation changes all frozen members and records all receipts in one returned replacement while preserving input and history', () => {
  const state = prepared()
  const before = structuredClone(state)
  const next = activate(state)
  const pagePublication = { title: 'Autumn welcome page', slug: 'autumn-welcome', body: 'A fictional autumn welcome page for a local release.', revision: 2, receipt: 'MOCK-CMS-0006' }
  const articlePublication = { title: 'A fictional team update', slug: 'team-update', body: 'Share a fictional company update here. This draft is visible in the editorial workspace and is excluded from the published sample.', revision: 1, receipt: 'MOCK-CMS-0007' }
  assert.deepEqual(next.entries, [
    { ...before.entries[0], status: 'published', published: pagePublication },
    { ...before.entries[1], status: 'published', published: articlePublication },
  ])
  assert.deepEqual(next.activity, [...before.activity,
    { receipt: 'MOCK-CMS-0006', entryId: page, revision: 2, actorId: 'cms-publisher', action: 'Simulated publication' },
    { receipt: 'MOCK-CMS-0007', entryId: article, revision: 1, actorId: 'cms-publisher', action: 'Simulated publication' },
  ])
  assert.equal(next.sequence, 7)
  assert.deepEqual(next.releaseBundles, [{ ...before.releaseBundles[0], status: 'activated', activatedAtSequence: 7, activatedPublications: [{ entryId: page, publication: pagePublication }, { entryId: article, publication: articlePublication }] }])
  assert.deepEqual(state, before)
  assert.deepEqual(next.releaseBundles[0].members[0].previousPublication, cms.createCmsState().entries[0].published)
  assert.equal(isCmsState(next), true)
  unchangedOnRefusal(next, () => activate(next), /already activated/)
})

test('a single stale approval blocks every member and the stale saved draft still imports', () => {
  const state = prepared()
  const token = preview(state).confirmation
  const edited = change(state, 'edit-entry', article, author, { title: 'Changed team update', slug: 'team-update', body: 'A changed fictional team update awaiting another review.' })
  assert.equal(isCmsState(edited), true)
  assert.equal(isCmsState(JSON.parse(JSON.stringify(edited))), true)
  assert.deepEqual(edited.releaseBundles, state.releaseBundles)
  assert.deepEqual(preview(edited).issues.map(issue => issue.code), ['stale-approval', 'stale-content'])
  unchangedOnRefusal(edited, () => releases.activateCmsReleaseBundle(edited, 'cms-release-0001', publisher, token), /approval is stale/)
  assert.deepEqual(edited.entries[0].published, state.entries[0].published)
  assert.equal(edited.entries[1].published, null)
})

test('ordinary review, return, publication and retire after a captured draft preserve valid historical captures', () => {
  let state = prepared()
  const capture = structuredClone(state.releaseBundles)
  state = change(state, 'edit-entry', article, author, { title: 'Later fictional article', slug: 'later-article', body: 'A later fictional article requiring independent approval.' })
  assert.equal(isCmsState(state), true)
  state = change(state, 'submit-review', article)
  assert.equal(isCmsState(state), true)
  state = change(state, 'return-draft', article, reviewer, { feedback: 'Clarify this fictional update.' })
  assert.equal(isCmsState(state), true)
  state = change(state, 'submit-review', article)
  state = change(state, 'approve-entry', article, reviewer)
  assert.equal(isCmsState(state), true)
  state = change(state, 'publish-entry', article, publisher)
  assert.equal(isCmsState(state), true)
  assert.ok(preview(state).issues.some(issue => issue.code === 'stale-publication'))
  state = change(state, 'retire-entry', article, publisher)
  assert.equal(isCmsState(state), true)
  assert.deepEqual(state.releaseBundles, capture)
})

test('a new publication after preparation invalidates activation and preserves every old receipt', () => {
  const state = prepared()
  const published = change(state, 'publish-entry', page, publisher)
  assert.equal(isCmsState(published), true)
  assert.deepEqual(preview(published).issues.map(issue => issue.code), ['stale-approval', 'stale-publication'])
  unchangedOnRefusal(published, () => activate(published), /approval is stale/)
  assert.deepEqual(published.activity.slice(0, 5), state.activity)
})

test('full snapshot binding rejects unrelated writes, another release token and empty confirmation', () => {
  const state = prepared()
  const token = preview(state).confirmation
  const second = releases.prepareCmsReleaseBundle(state, { name: 'A second release', entryIds: [...ids].reverse() }, publisher)
  assert.equal(second.sequence, 5)
  assert.equal(isCmsState(second), true)
  assert.equal(second.releaseBundles[1].id, 'cms-release-0002')
  unchangedOnRefusal(second, () => releases.activateCmsReleaseBundle(second, 'cms-release-0001', publisher, token), /preview is stale/)
  unchangedOnRefusal(second, () => releases.activateCmsReleaseBundle(second, 'cms-release-0002', publisher, preview(second).confirmation), /preview is stale/)
  unchangedOnRefusal(state, () => releases.activateCmsReleaseBundle(state, 'cms-release-0001', publisher, ''), /preview is stale/)
  const created = cms.transitionCms(state, { type: 'create-entry', collectionId: 'pages', title: 'Unrelated page', slug: 'unrelated-page', body: 'An unrelated fictional editorial draft.' }, author)
  assert.equal(preview(created).issues.length, 0)
  unchangedOnRefusal(created, () => releases.activateCmsReleaseBundle(created, 'cms-release-0001', publisher, token), /preview is stale/)
  const fresh = activate(created)
  assert.deepEqual(fresh.entries[2], created.entries[2])
  assert.equal(isCmsState(fresh), true)
})

test('wrong roles and forged identities cannot activate using a genuine publisher preview', () => {
  const state = prepared()
  for (const actor of [author, reviewer, viewer, { ...publisher, id: reviewer.id }]) unchangedOnRefusal(state, () => releases.activateCmsReleaseBundle(state, 'cms-release-0001', actor, preview(state).confirmation), /publisher/)
})

test('duplicate current or frozen routes are explicitly identified and activate none', () => {
  for (const frozen of [false, true]) {
    const state = prepared()
    state.entries[1].collectionId = 'pages'
    state.entries[1].slug = frozen ? 'welcome' : 'autumn-welcome'
    const report = preview(state)
    assert.ok(report.issues.some(issue => issue.code === 'duplicate-route' && issue.message.includes(`pages/${state.entries[1].slug}`)))
    assert.equal(report.confirmation, null)
    unchangedOnRefusal(state, () => activate(state), /Duplicate route/)
    assert.equal(isCmsState(state), false)
  }
})

test('strict import rejects malformed release extensions and captured receipts independently of stale eligibility', () => {
  const edits = [
    state => { state.releaseBundles = null },
    state => { state.releaseBundles = undefined },
    state => { state.releaseBundles[0].unknown = true },
    state => { state.releaseBundles[0].id = 'cms-release-0002' },
    state => { state.releaseBundles[0].createdBy = 'cms-author' },
    state => { state.releaseBundles[0].name = ' Release ' },
    state => { state.releaseBundles[0].name = 'Release\nnext' },
    state => { state.releaseBundles[0].preparedAtSequence = 6 },
    state => { state.releaseBundles[0].members.pop() },
    state => { state.releaseBundles[0].members[1] = structuredClone(state.releaseBundles[0].members[0]) },
    state => { state.releaseBundles[0].members[0].unknown = true },
    state => { state.releaseBundles[0].members[0].collectionId = 'articles' },
    state => { state.releaseBundles[0].members[1].collectionId = 'pages' },
    state => { state.releaseBundles[0].members[0].approval.reviewerId = 'cms-author' },
    state => { state.releaseBundles[0].members[0].approval.revision = 1 },
    state => { state.releaseBundles[0].members[0].approval.receipt = 'MOCK-CMS-0004' },
    state => { state.releaseBundles[0].members[0].previousPublication.receipt = 'SEED-CMS-REVIEW' },
    state => { state.releaseBundles[0].members[1].previousPublication = structuredClone(state.releaseBundles[0].members[0].previousPublication) },
    state => { state.releaseBundles[0].activatedAtSequence = 5 },
    state => { state.releaseBundles[0].activatedPublications = [] },
    state => { state.releaseBundles[0].status = 'activated' },
  ]
  for (const [index, edit] of edits.entries()) {
    const state = prepared()
    edit(state)
    assert.equal(isCmsState(state), false, `malformed capture ${index}`)
    unchangedOnRefusal(state, () => activate(state), /invalid/)
  }
})

test('strict import rejects altered activation evidence and later actions preserve the original activation capture', () => {
  const activated = activate(prepared())
  for (const edit of [
    state => { state.releaseBundles[0].activatedAtSequence = 6 },
    state => { state.releaseBundles[0].activatedPublications.reverse() },
    state => { state.releaseBundles[0].activatedPublications[0].publication.title = 'Altered archived title' },
    state => { state.releaseBundles[0].activatedPublications[1].publication.receipt = 'MOCK-CMS-0006' },
    state => { state.releaseBundles[0].activatedPublications.push(structuredClone(state.releaseBundles[0].activatedPublications[0])) },
  ]) {
    const state = structuredClone(activated)
    edit(state)
    assert.equal(isCmsState(state), false)
  }
  const changed = change(activated, 'edit-entry', page, author, { title: 'A future welcome page', slug: 'future-welcome', body: 'This future fictional draft does not overwrite captured publications.' })
  assert.equal(isCmsState(changed), true)
  assert.deepEqual(changed.releaseBundles, activated.releaseBundles)
  assert.deepEqual(changed.entries[0].published, activated.entries[0].published)
  assert.deepEqual(changed.activity.slice(0, 7), activated.activity)
})
