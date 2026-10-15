import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMockModel } from '../browser/model-loader.mjs'

const { compareWorkspaces, inspectWorkspaces } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const clone = value => structuredClone(value)
const marker = 'PRIVATE-DOMAIN-PAYLOAD-DO-NOT-RETURN'
const collection = (report, module, key) => report.modules.find(item => item.module === module).collections.find(item => item.key === key)
const cmsMetadata = {
  collectionId: 'pages', draftRevision: 1, workflowStatus: 'published',
  approvalRevision: 1, approvalReviewerId: 'cms-reviewer', approvalReceiptId: 'SEED-CMS-REVIEW',
  publicationRevision: 1, publicationReceiptId: 'SEED-CMS-PUBLICATION',
}
const emptyApproval = { approvalRevision: null, approvalReviewerId: null, approvalReceiptId: null }

function laterDraft() {
  const target = clone(seed)
  Object.assign(target.cms.entries[0], { title: marker, body: marker, revision: 2, status: 'draft', approval: null })
  return target
}
function changedCrm() {
  const target = clone(seed)
  target.crm.companies[0].name = marker
  target.crm.contacts[0].email = marker
  target.crm.leads[0].status = 'qualified'
  Object.assign(target.crm.opportunities[0], { stage: 'proposal', amountCents: 98765432, title: marker })
  return target
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('CMS entry details separate changed draft revision and removed approval from the unchanged frozen publication', () => {
  const target = laterDraft()
  const result = compareWorkspaces(seed, target, ['cms'])
  const entries = collection(result, 'cms', 'entries')
  assert.equal(result.modules[0].changed, 1)
  assert.deepEqual(entries.recordDetails, { added: [], removed: [], changed: [{
    identifier: 'cms-page-001', before: cmsMetadata,
    after: { ...cmsMetadata, draftRevision: 2, workflowStatus: 'draft', ...emptyApproval },
    projections: { draft: 'changed', approval: 'removed', publication: 'unchanged' },
  }] })
  assert.equal(collection(result, 'cms', 'entries.published').changed, 0)
  assert.doesNotMatch(JSON.stringify(result), new RegExp(marker))
})

test('CMS publication replacement identifies exact target revisions and receipt IDs independently from its draft', () => {
  const current = laterDraft(); const target = clone(current)
  Object.assign(target.cms.entries[0], {
    status: 'published', approval: { revision: 2, reviewerId: 'cms-reviewer', receipt: 'REVIEW-002' },
    published: { title: marker, slug: 'changed-publication', body: marker, revision: 2, receipt: 'PUBLICATION-002' },
  })
  const entries = collection(compareWorkspaces(current, target, ['cms']), 'cms', 'entries')
  assert.deepEqual(entries.recordDetails.changed[0], {
    identifier: 'cms-page-001', before: { ...cmsMetadata, draftRevision: 2, workflowStatus: 'draft', ...emptyApproval },
    after: { ...cmsMetadata, draftRevision: 2, approvalRevision: 2, approvalReceiptId: 'REVIEW-002', publicationRevision: 2, publicationReceiptId: 'PUBLICATION-002' },
    projections: { draft: 'changed', approval: 'added', publication: 'changed' },
  })
})

test('same-revision publication content edits still identify the changed hidden projection', () => {
  const target = clone(seed); target.cms.entries[0].published.body = marker
  const result = compareWorkspaces(seed, target, ['cms'])
  assert.deepEqual(collection(result, 'cms', 'entries').recordDetails.changed[0], {
    identifier: 'cms-page-001', before: cmsMetadata, after: cmsMetadata,
    projections: { draft: 'unchanged', approval: 'unchanged', publication: 'changed' },
  })
  assert.equal(collection(result, 'cms', 'entries.published').changed, 1)
  assert.doesNotMatch(JSON.stringify(result), new RegExp(marker))
})

test('added and removed content records distinguish absent records from absent approval/publication projections', () => {
  const target = clone(seed)
  target.cms.entries = [{ ...target.cms.entries[1], id: 'cms-new-001', title: marker, body: marker }]
  const entries = collection(compareWorkspaces(seed, target, ['cms']), 'cms', 'entries')
  assert.equal(entries.added, 1); assert.equal(entries.removed, 2)
  assert.deepEqual(entries.recordDetails.added[0], {
    identifier: 'cms-new-001', before: null,
    after: { collectionId: 'articles', draftRevision: 1, workflowStatus: 'draft', ...emptyApproval, publicationRevision: null, publicationReceiptId: null },
    projections: { draft: 'added', approval: 'absent', publication: 'absent' },
  })
  assert.deepEqual(entries.recordDetails.removed.find(item => item.identifier === 'cms-page-001'), {
    identifier: 'cms-page-001', before: cmsMetadata, after: null,
    projections: { draft: 'removed', approval: 'removed', publication: 'removed' },
  })
})

test('same-count CRM company/contact/lead/opportunity edits retain IDs and show strict structured state metadata', () => {
  const result = compareWorkspaces(seed, changedCrm(), ['crm'])
  assert.equal(result.modules[0].added, 0); assert.equal(result.modules[0].removed, 0); assert.equal(result.modules[0].changed, 4)
  const literal = {
    companies: { identifier: 'company-harbor', before: { ownerId: 'sales-riley' }, after: { ownerId: 'sales-riley' } },
    contacts: { identifier: 'contact-avery', before: { ownerId: 'sales-riley', companyId: 'company-harbor' }, after: { ownerId: 'sales-riley', companyId: 'company-harbor' } },
    leads: { identifier: 'lead-jules', before: { ownerId: 'sales-riley', leadState: 'new', companyId: null, contactId: null, opportunityId: null }, after: { ownerId: 'sales-riley', leadState: 'qualified', companyId: null, contactId: null, opportunityId: null } },
    opportunities: { identifier: 'opportunity-harbor', before: { ownerId: 'sales-riley', opportunityStage: 'discovery', companyId: 'company-harbor', contactId: 'contact-avery', leadId: null }, after: { ownerId: 'sales-riley', opportunityStage: 'proposal', companyId: 'company-harbor', contactId: 'contact-avery', leadId: null } },
  }
  for (const [key, value] of Object.entries(literal)) assert.deepEqual(collection(result, 'crm', key).recordDetails, { added: [], removed: [], changed: [value] })
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-DOMAIN|98765432|fingerprint/)
})

test('CRM relationship IDs and converted lead state are visible without names, email values or amounts', () => {
  const target = clone(seed)
  Object.assign(target.crm.leads[0], { status: 'converted', companyId: 'company-added', contactId: 'contact-added', opportunityId: 'opportunity-added', name: marker, email: marker, companyName: marker })
  Object.assign(target.crm.contacts[0], { companyId: 'company-added', ownerId: 'crm-owner', name: marker, email: marker })
  const result = compareWorkspaces(seed, target, ['crm'])
  assert.deepEqual(collection(result, 'crm', 'leads').recordDetails.changed[0].after, { ownerId: 'sales-riley', leadState: 'converted', companyId: 'company-added', contactId: 'contact-added', opportunityId: 'opportunity-added' })
  assert.deepEqual(collection(result, 'crm', 'contacts').recordDetails.changed[0].after, { ownerId: 'crm-owner', companyId: 'company-added' })
  assert.doesNotMatch(JSON.stringify(result), new RegExp(marker))
})

test('record detail bounds share the existing stable identifier ordering and exact omission counts', () => {
  const current = clone(seed); const target = clone(seed)
  current.crm.companies = Array.from({ length: 12 }, (_, index) => ({ ...current.crm.companies[0], id: `company-${String(index).padStart(2, '0')}` }))
  target.crm.companies = current.crm.companies.map(item => ({ ...item, name: marker })).reverse()
  const defaults = collection(compareWorkspaces(current, target, ['crm']), 'crm', 'companies')
  assert.equal(defaults.changed, 12); assert.equal(defaults.recordDetails.changed.length, 8); assert.equal(defaults.omittedIdentifiers.changed, 4)
  assert.deepEqual(defaults.recordDetails.changed.map(item => item.identifier), ['company-00', 'company-01', 'company-02', 'company-03', 'company-04', 'company-05', 'company-06', 'company-07'])
  const limited = collection(compareWorkspaces(current, target, ['crm'], { identifierLimit: 3 }), 'crm', 'companies')
  assert.equal(limited.recordDetails.changed.length, 3); assert.equal(limited.omittedIdentifiers.changed, 9)
  assert.deepEqual(limited.recordDetails.changed.map(item => item.identifier), limited.identifiers.changed)
})

test('added/removed CRM records reverse direction and structured snapshots exactly for Undo', () => {
  const target = clone(seed)
  target.crm.companies = [{ id: 'company-new', name: marker, ownerId: 'crm-owner' }]
  const forward = collection(compareWorkspaces(seed, target, ['crm']), 'crm', 'companies')
  const reverse = collection(compareWorkspaces(target, seed, ['crm']), 'crm', 'companies')
  assert.deepEqual(forward.recordDetails.added, [{ identifier: 'company-new', before: null, after: { ownerId: 'crm-owner' } }])
  assert.deepEqual(reverse.recordDetails.removed, [{ identifier: 'company-new', before: { ownerId: 'crm-owner' }, after: null }])
  assert.deepEqual(reverse.recordDetails.added.map(item => item.identifier), forward.recordDetails.removed.map(item => item.identifier))
})

test('metadata rejects malformed revisions, states and linked IDs without exposing their values', () => {
  const cases = [
    target => { target.cms.entries[0].revision = 0 }, target => { target.cms.entries[0].approval.revision = '1' },
    target => { target.cms.entries[0].published.revision = -1 }, target => { target.cms.entries[0].status = marker },
    target => { target.crm.leads[0].status = ['new'] }, target => { target.crm.opportunities[0].stage = marker },
    target => { target.crm.contacts[0].companyId = `${marker} unsafe` },
  ]
  for (const change of cases) {
    const target = clone(seed); change(target)
    assert.throws(() => compareWorkspaces(seed, target, ['cms', 'crm']), error => /Workspace inspection unavailable/.test(error.message) && !error.message.includes(marker))
  }
  const duplicate = clone(seed); duplicate.cms.entries.push(clone(duplicate.cms.entries[0]))
  assert.throws(() => compareWorkspaces(seed, duplicate, ['cms']), /duplicate identity/)
})

test('details remain selected-scope, detached and pure with no runtime storage, clock or randomness access', () => {
  const current = freeze(clone(seed)); const target = freeze(changedCrm())
  const original = JSON.stringify({ current, target })
  const descriptors = ['window', 'crypto', 'Date'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const random = Math.random
  for (const key of ['window', 'crypto', 'Date']) Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(`Runtime ${key} access forbidden`) } })
  Math.random = () => { throw new Error('Runtime randomness forbidden') }
  let result
  try { result = compareWorkspaces(current, target, ['crm']) }
  finally {
    Math.random = random
    for (const [key, descriptor] of descriptors) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
  collection(result, 'crm', 'leads').recordDetails.changed[0].after.leadState = 'caller-only'
  assert.equal(JSON.stringify({ current, target }), original)
  assert.equal(JSON.stringify(compareWorkspaces(current, target, ['crm'])).includes('caller-only'), false)
  const partial = { cms: seed.cms }
  Object.defineProperty(partial, 'crm', { get() { throw new Error('Unselected CRM access forbidden') } })
  assert.deepEqual(compareWorkspaces(partial, partial, ['cms']).modules.map(item => item.module), ['cms'])
  assert.equal(Object.hasOwn(inspectWorkspaces(seed, ['cms']).modules[0].collections[0], 'recordDetails'), false)
})

async function component() {
  const helper = await readFile(new URL('../../src/portals/workspace-inspection.ts', import.meta.url), 'utf8')
  const helperJs = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`
  const source = await readFile(new URL('../../src/portals/WorkspaceInspection.tsx', import.meta.url), 'utf8')
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
  compiled = compiled.replaceAll("'./workspace-inspection'", `'${helperUrl}'`).replaceAll('"./workspace-inspection"', `"${helperUrl}"`)
  compiled = compiled.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).WorkspaceDifferencePreview
}

test('actual preview component renders CMS draft/approval/publication comparisons and CRM record states with redacted payloads', async () => {
  const Preview = await component()
  const target = changedCrm(); target.cms = laterDraft().cms
  const output = renderToStaticMarkup(createElement(Preview, { current: seed, target, modules: ['cms', 'crm'] }))
  assert.match(output, /data-record-id="cms-page-001" data-record-difference="changed"/)
  assert.match(output, /CMS cms-page-001 projection changes/)
  assert.match(output, /Published projection<\/dt><dd[^>]*>unchanged/)
  assert.match(output, /Current cms-page-001 metadata/); assert.match(output, /Target cms-page-001 metadata/)
  assert.match(output, /Draft revision<\/dt><dd[^>]*>2/)
  assert.match(output, /Published revision<\/dt><dd[^>]*>1/)
  for (const id of ['company-harbor', 'contact-avery', 'lead-jules', 'opportunity-harbor']) assert.ok(output.includes(`data-record-id="${id}"`), id)
  assert.match(output, /Lead state<\/dt><dd[^>]*>qualified/)
  assert.match(output, /Opportunity stage<\/dt><dd[^>]*>proposal/)
  assert.doesNotMatch(output, /PRIVATE-DOMAIN|98765432|morgan@example|Welcome to the sample studio|onClick|textarea/)
})

test('preview component reports exact omitted detail rows and no-selection without applying records', async () => {
  const Preview = await component()
  const current = clone(seed); const target = clone(seed)
  current.crm.companies = Array.from({ length: 12 }, (_, index) => ({ ...current.crm.companies[0], id: `company-${String(index).padStart(2, '0')}` }))
  target.crm.companies = current.crm.companies.map(item => ({ ...item, name: marker }))
  const output = renderToStaticMarkup(createElement(Preview, { current, target, modules: ['crm'] }))
  assert.equal((output.match(/data-record-difference="changed"/g) ?? []).length, 8)
  assert.match(output, /4 more record details omitted/)
  assert.doesNotMatch(output, new RegExp(marker))
  assert.match(renderToStaticMarkup(createElement(Preview, { current: {}, target: {}, modules: [] })), /Select at least one workspace/)
})
