import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const load = path => loadMockModel(new URL(path, import.meta.url))

const [cms, crm, cmsValidation, crmValidation, storage] = await Promise.all([
  load('../../src/cms/model.ts'), load('../../src/crm/model.ts'),
  load('../../src/cms/persistence.ts'), load('../../src/crm/persistence.ts'), load('../../src/portals/persistence.ts'),
])
const { isCmsState } = cmsValidation
const { isCrmState } = crmValidation
const [author, reviewer, publisher] = cms.cmsActors
const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
const owner = crm.crmActors.find(actor => actor.role === 'owner')
const changeCms = (state, event, actor = author) => cms.transitionCms(state, event, actor)
const cmsAction = (state, type, entryId = 'cms-article-001') => ({ type, entryId, expectedRevision: state.entries.find(entry => entry.id === entryId).revision })
const changeCrm = (state, event, actor = riley) => crm.transitionCrm(state, actor, event)
const clone = value => JSON.parse(JSON.stringify(value))
function memoryStorage() {
  const records = new Map()
  return { records, getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) }
}
function restore(module, state, create, validate) {
  const browser = memoryStorage()
  assert.equal(storage.saveDemoState(module, state, browser).kind, 'saved')
  const loaded = storage.loadDemoState(module, create, validate, browser)
  assert.equal(loaded.status.kind, 'restored')
  assert.deepEqual(loaded.state, state)
  return loaded.state
}

test('CMS saved review and frozen publication restore with activity and permit subsequent workflow actions', () => {
  let state = cms.createCmsState()
  assert.equal(isCmsState(state), true)
  state = changeCms(state, cmsAction(state, 'submit-review'))
  state = changeCms(state, cmsAction(state, 'approve-entry'), reviewer)
  state = changeCms(state, cmsAction(state, 'publish-entry'), publisher)
  const published = clone(state.entries[1].published)
  state = changeCms(state, { ...cmsAction(state, 'edit-entry'), title: 'A refreshed fictional article', slug: 'refreshed-article', body: 'A fresh draft that must not overwrite the published revision.' })
  assert.equal(isCmsState(state), true)
  state = restore('cms', state, cms.createCmsState, isCmsState)
  assert.deepEqual(state.entries[1].published, published)
  state = changeCms(state, cmsAction(state, 'submit-review'))
  state = changeCms(state, cmsAction(state, 'approve-entry'), reviewer)
  state = changeCms(state, cmsAction(state, 'publish-entry'), publisher)
  assert.equal(isCmsState(state), true)
  assert.equal(state.entries[1].published.revision, 2)
})

test('CMS new draft, feedback and retired publication snapshots remain valid after serialization', () => {
  let state = changeCms(cms.createCmsState(), { type: 'create-entry', collectionId: 'pages', title: 'New fictional page', slug: 'new-fictional-page', body: 'This page contains fictional sample content only.' })
  const id = state.entries.at(-1).id
  state = changeCms(state, cmsAction(state, 'submit-review', id))
  state = changeCms(state, { ...cmsAction(state, 'return-draft', id), feedback: 'Please clarify this fictional page.' }, reviewer)
  state = changeCms(state, cmsAction(state, 'retire-entry', 'cms-page-001'), publisher)
  assert.equal(isCmsState(clone(state)), true)
  const restored = restore('cms', state, cms.createCmsState, isCmsState)
  assert.equal(restored.entries.at(-1).feedback, 'Please clarify this fictional page.')
  assert.equal(cms.cmsPublishedEntries(restored).length, 0)
})

test('CMS malformed nested fields, duplicate identities and receipts, unknown properties and slug collisions are refused', () => {
  const mutations = [
    state => { state.entries = null },
    state => { state.entries[0] = null },
    state => { state.entries.push(clone(state.entries[0])) },
    state => { state.entries[0].published.body = 123 },
    state => { state.entries[0].approval = {} },
    state => { state.entries[0].approval.reviewerId = 'cms-author' },
    state => { state.entries[0].published.revision = 2 },
    state => { state.entries[0].status = 'unexpected' },
    state => { state.entries[0].apiKey = 'not-a-domain-field' },
    state => { state.entries[1].collectionId = 'pages'; state.entries[1].slug = 'welcome' },
    state => { state.sequence = 1 },
    state => { state.entries[0].published.receipt = 'MOCK-CMS-0001' },
  ]
  for (const mutate of mutations) { const state = cms.createCmsState(); mutate(state); assert.equal(isCmsState(state), false) }
  const state = changeCms(cms.createCmsState(), cmsAction(cms.createCmsState(), 'submit-review'))
  for (const mutation of [item => { item.activity[0].entryId = 'missing' }, item => { item.activity[0].actorId = 'cms-publisher' }, item => { item.activity[0].receipt = 'MOCK-CMS-0099' }, item => { item.activity[0].revision = 99 }]) {
    const bad = clone(state); mutation(bad); assert.equal(isCmsState(bad), false)
  }
})

test('CRM qualification, conversion, won opportunity and completed follow-up survive restore without replay', () => {
  let state = crm.createCrmState()
  assert.equal(isCrmState(state), true)
  state = changeCrm(state, { type: 'qualify-lead', leadId: 'lead-jules' })
  state = changeCrm(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 })
  const opportunityId = state.leads[0].opportunityId
  state = changeCrm(state, { type: 'create-task', title: 'Follow up with a fictional lead', opportunityId })
  const taskId = state.tasks.at(-1).id
  for (const stage of ['proposal', 'negotiation', 'won']) state = changeCrm(state, { type: 'advance-opportunity', opportunityId, stage })
  state = changeCrm(state, { type: 'complete-task', taskId })
  assert.equal(isCrmState(state), true)
  state = restore('crm', state, crm.createCrmState, isCrmState)
  assert.equal(crm.crmDashboard(state, riley).wonCents, 150000)
  assert.equal(state.tasks.at(-1).status, 'done')
  assert.throws(() => changeCrm(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 }), /cannot be converted again/)
  const next = changeCrm(state, { type: 'create-company', name: 'New fictional company after refresh' })
  assert.equal(isCrmState(next), true)
  assert.equal(new Set(next.companies.map(company => company.id)).size, next.companies.length)
})

test('CRM recognizes created companies, contacts and maximum-length converted titles', () => {
  let state = changeCrm(crm.createCrmState(), { type: 'create-company', name: 'A'.repeat(120) }, owner)
  const companyId = state.companies.at(-1).id
  state = changeCrm(state, { type: 'create-contact', name: 'Demo Contact', email: 'demo@long.invalid', companyId }, owner)
  state = changeCrm(state, { type: 'create-lead', name: 'Long Fiction', email: 'long@long.invalid', companyName: 'A'.repeat(120) }, owner)
  const leadId = state.leads.at(-1).id
  state = changeCrm(state, { type: 'qualify-lead', leadId }, owner)
  state = changeCrm(state, { type: 'convert-lead', leadId, amountCents: 1 }, owner)
  assert.equal(isCrmState(clone(state)), true)
  const loaded = restore('crm', state, crm.createCrmState, isCrmState)
  assert.equal(loaded.opportunities.at(-1).companyId, companyId)
})

test('CRM rejects malformed fields, nonfictional emails, duplicate IDs and broken cross-owner links', () => {
  const mutations = [
    state => { state.contacts = {} },
    state => { state.companies.push(clone(state.companies[0])) },
    state => { state.contacts[0] = null },
    state => { state.contacts[0].email = 'person@example.com' },
    state => { state.contacts[0].companyId = 'missing' },
    state => { state.contacts[0].ownerId = 'sales-sam' },
    state => { state.companies[0].ownerId = 'crm-auditor' },
    state => { state.opportunities[0].contactId = 'contact-jordan' },
    state => { state.opportunities[0].amountCents = -1 },
    state => { state.opportunities[0].stage = 'unknown' },
    state => { state.tasks[0].opportunityId = 'opportunity-orbit' },
    state => { state.leads[0].status = 'converted' },
    state => { state.leads[0].contactId = 'contact-avery' },
    state => { state.sequence = 0 },
    state => { state.companies[0].accessToken = 'not-a-domain-field' },
  ]
  for (const mutate of mutations) { const state = crm.createCrmState(); mutate(state); assert.equal(isCrmState(state), false) }
})

test('CRM rejects conversion graph tampering and future generated identifiers before they can collide', () => {
  let state = changeCrm(crm.createCrmState(), { type: 'qualify-lead', leadId: 'lead-jules' })
  state = changeCrm(state, { type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 })
  for (const mutate of [
    item => { item.leads[0].opportunityId = 'opportunity-harbor' },
    item => { item.opportunities.at(-1).leadId = 'lead-robin' },
    item => { item.contacts.at(-1).email = 'different@demo.invalid' },
    item => { item.companies.at(-1).id = `company-${String(item.sequence).padStart(4, '0')}` },
    item => { item.activity[0].receipt = item.activity[1].receipt },
    item => { item.activity[0].ownerId = 'unknown' },
  ]) { const bad = clone(state); mutate(bad); assert.equal(isCrmState(bad), false) }
})

test('malformed CMS or CRM save recovers only that module and retains its bad snapshot until explicit action', () => {
  for (const [module, create, validate] of [['cms', cms.createCmsState, isCmsState], ['crm', crm.createCrmState, isCrmState]]) {
    const browser = memoryStorage()
    const bad = JSON.stringify({ schemaVersion: storage.DEMO_STORAGE_VERSION, module, data: { broken: true } })
    browser.setItem(storage.demoStorageKey(module), bad)
    const other = module === 'cms' ? 'crm' : 'cms'
    browser.setItem(storage.demoStorageKey(other), 'other-portal-sentinel')
    const restored = storage.loadDemoState(module, create, validate, browser)
    assert.equal(restored.status.kind, 'recovered')
    assert.deepEqual(restored.state, create())
    assert.equal(browser.getItem(storage.demoStorageKey(module)), bad)
    assert.equal(browser.getItem(storage.demoStorageKey(other)), 'other-portal-sentinel')
  }
})

test('per-portal Reset removes saved CMS or CRM data without touching HR, its neighbor or unrelated storage', () => {
  const browser = memoryStorage()
  for (const module of ['hr', 'cms', 'crm']) browser.setItem(storage.demoStorageKey(module), `saved-${module}`)
  browser.setItem('unrelated', 'preserved')
  assert.equal(storage.clearDemoState('cms', browser).kind, 'reset')
  assert.equal(browser.getItem(storage.demoStorageKey('cms')), null)
  assert.equal(browser.getItem(storage.demoStorageKey('hr')), 'saved-hr')
  assert.equal(browser.getItem(storage.demoStorageKey('crm')), 'saved-crm')
  assert.equal(browser.getItem('unrelated'), 'preserved')
  const restored = storage.loadDemoState('cms', cms.createCmsState, isCmsState, browser)
  assert.equal(restored.status.kind, 'ready')
  assert.deepEqual(restored.state, cms.createCmsState())
  assert.equal(browser.getItem(storage.demoStorageKey('cms')), null)
  assert.equal(storage.clearDemoState('crm', browser).kind, 'reset')
  assert.equal(browser.getItem(storage.demoStorageKey('crm')), null)
  assert.equal(browser.getItem(storage.demoStorageKey('hr')), 'saved-hr')
})
