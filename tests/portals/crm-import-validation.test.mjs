import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const urls = new Map()
async function moduleUrl(url) {
  if (urls.has(url.href)) return urls.get(url.href)
  const pending = (async () => {
    const source = readFileSync(url, 'utf8')
    if (url.pathname.endsWith('.json')) return `data:text/javascript;base64,${Buffer.from(`export default ${source}`).toString('base64')}`
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    const dependencies = new Map()
    for (const [, specifier] of compiled.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) {
      const dependency = new URL(specifier, url)
      if (!/\.(?:json|ts)$/.test(dependency.pathname)) dependency.pathname += '.ts'
      dependencies.set(specifier, await moduleUrl(dependency))
    }
    const resolved = compiled.replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (_, specifier) => `from '${dependencies.get(specifier)}'`)
    return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  })()
  urls.set(url.href, pending)
  return pending
}
async function load(path) { return import(await moduleUrl(new URL(`../../src/${path}.ts`, import.meta.url))) }
const [crm, validation, persistence, backup, combined, imports, workspaces, restore] = await Promise.all([
  load('crm/model'), load('crm/persistence'), load('portals/persistence'), load('portals/backup'),
  load('portals/combined-backup'), load('portals/import-state'), load('portals/workspaces'), load('portals/restore-workspaces'),
])
const { isCrmState } = validation
const exportedAt = '2026-10-15T12:00:00.000Z'
const clone = value => JSON.parse(JSON.stringify(value))
const riley = crm.crmActors.find(actor => actor.id === 'sales-riley')
const owner = crm.crmActors.find(actor => actor.role === 'owner')
const envelope = data => ({ format: 'webappx-mock-workspace', schemaVersion: 1, module: 'crm', exportedAt, data })
const combinedEnvelope = states => ({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt, workspaces: states })

function lifecycle() {
  let state = crm.createCrmState()
  const apply = (event, actor = riley) => {
    state = crm.transitionCrm(state, actor, event)
    assert.equal(isCrmState(state), true, event.type)
  }
  apply({ type: 'create-company', name: 'Fictional validation studio' }, owner)
  apply({ type: 'create-contact', name: 'Validation Example', email: 'validation@studio.invalid', companyId: state.companies.at(-1).id }, owner)
  apply({ type: 'create-lead', name: 'Import Example', email: 'import@example.invalid', companyName: 'Fictional import studio' })
  apply({ type: 'qualify-lead', leadId: 'lead-jules' })
  apply({ type: 'convert-lead', leadId: 'lead-jules', amountCents: 150000 })
  const opportunityId = state.leads[0].opportunityId
  apply({ type: 'create-task', title: 'Review fictional import graph', opportunityId })
  apply({ type: 'complete-task', taskId: state.tasks.at(-1).id })
  for (const stage of ['proposal', 'negotiation', 'won']) apply({ type: 'advance-opportunity', opportunityId, stage })
  apply({ type: 'create-opportunity', title: 'Fictional owner opportunity', companyId: state.companies.at(-2).id, contactId: state.contacts.at(-2).id, amountCents: 10000 }, owner)
  apply({ type: 'advance-opportunity', opportunityId: state.opportunities.at(-1).id, stage: 'lost' }, owner)
  return state
}

const corruptions = [
  ['array lead status', state => { state.leads[1].status = ['qualified'] }],
  ['unknown lead status', state => { state.leads[1].status = 'unknown' }],
  ['array opportunity stage', state => { state.opportunities[0].stage = ['discovery'] }],
  ['unknown opportunity stage', state => { state.opportunities[0].stage = 'unknown' }],
  ['array task status', state => { state.tasks[0].status = ['open'] }],
  ['unknown task status', state => { state.tasks[0].status = 'unknown' }],
  ['array activity action', state => { state.activity[0].action = [state.activity[0].action] }],
  ['array activity owner', state => { state.activity[0].ownerId = [state.activity[0].ownerId] }],
  ['unsupported oversized contact notes', state => { state.contacts[0].notes = 'x'.repeat(10001) }],
  ['unsupported oversized lead notes', state => { state.leads[0].notes = 'x'.repeat(10001) }],
  ['missing contact company', state => { state.contacts[0].companyId = 'missing-company' }],
  ['cross-owner contact', state => { state.contacts[0].ownerId = 'sales-sam' }],
  ['mismatched opportunity contact', state => { state.opportunities[0].contactId = 'contact-jordan' }],
  ['missing task opportunity', state => { state.tasks[0].opportunityId = 'missing-opportunity' }],
  ['broken converted lead company', state => { state.leads[0].companyId = 'company-orbit' }],
  ['broken converted lead contact', state => { state.leads[0].contactId = 'contact-jordan' }],
  ['broken converted lead opportunity', state => { state.leads[0].opportunityId = 'opportunity-orbit' }],
  ['broken opportunity lead backlink', state => { state.opportunities.find(item => item.leadId).leadId = 'lead-robin' }],
]

function destination() {
  const current = workspaces.createDemoWorkspaces()
  current.crm = crm.transitionCrm(current.crm, owner, { type: 'create-company', name: 'Preserved destination sentinel' })
  const values = new Map()
  const writes = []
  const storage = {
    values, writes,
    getItem: key => values.get(key) ?? null,
    setItem: (key, raw) => { writes.push(key); values.set(key, raw) },
    removeItem: key => { writes.push(key); values.delete(key) },
  }
  for (const module of ['hr', 'cms', 'crm']) persistence.saveDemoState(module, current[module], storage)
  storage.setItem('webappx.demo.restore-points', 'unchanged history byte sentinel')
  storage.setItem('unrelated', 'unchanged unrelated byte sentinel')
  writes.length = 0
  return { current, storage, before: clone(current), savedBefore: [...values] }
}
function preserved(destination, label) {
  assert.deepEqual(destination.current, destination.before, `${label}: current complete graph`)
  assert.deepEqual([...destination.storage.values], destination.savedBefore, `${label}: every saved byte`)
  assert.deepEqual(destination.storage.writes, [], `${label}: no storage writes`)
}

test('existing schema-1 seed saves remain valid without changing named seed data or bytes', () => {
  const seed = crm.createCrmState()
  const raw = JSON.stringify({ schemaVersion: 1, module: 'crm', data: seed })
  const storage = { getItem: key => key === persistence.demoStorageKey('crm') ? raw : null, setItem() { assert.fail('Load must not rewrite valid seed bytes') }, removeItem() { assert.fail('Load must not remove valid seed bytes') } }
  assert.equal(isCrmState(seed), true)
  assert.deepEqual(persistence.loadDemoState('crm', crm.createCrmState, isCrmState, storage).state, seed)
  assert.equal(storage.getItem(persistence.demoStorageKey('crm')), raw)
  assert.deepEqual(seed.companies.map(item => item.id), ['company-harbor', 'company-orbit'])
  assert.deepEqual(seed.contacts.map(item => item.id), ['contact-avery', 'contact-jordan'])
  assert.deepEqual(Object.keys(seed), ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity', 'sequence'])
})

test('all valid CRM lifecycle events retain complete graph compatibility in saves and both backup formats', () => {
  const state = lifecycle()
  const before = clone(state)
  const single = backup.createDemoBackup('crm', state, isCrmState, exportedAt)
  assert.deepEqual(backup.parseDemoBackup(single, 'crm', isCrmState).state, state)
  const states = { ...workspaces.createDemoWorkspaces(), crm: state }
  assert.deepEqual(combined.parseCombinedBackup(combined.createCombinedBackup(states, exportedAt)).states, states)
  const storage = destination().storage
  assert.equal(persistence.saveDemoState('crm', state, storage).kind, 'saved')
  assert.deepEqual(persistence.loadDemoState('crm', crm.createCrmState, isCrmState, storage).state, state)
  assert.deepEqual(state, before)
})

test('workflow enums reject wrong JSON types and unknown values rather than coercing them', () => {
  for (const [collection, field, valid] of [['leads', 'status', 'new'], ['opportunities', 'stage', 'discovery'], ['tasks', 'status', 'open']]) {
    for (const value of [[valid], [], null, true, 0, {}, { toString: valid }, 'unknown', '', ` ${valid} `]) {
      const state = crm.createCrmState(); state[collection][0][field] = clone(value)
      const before = clone(state)
      assert.equal(isCrmState(state), false, `${collection}.${field}: ${JSON.stringify(value)}`)
      assert.deepEqual(state, before)
    }
  }
})

test('record and activity owner/action enums reject wrong JSON types and unrecognized identities', () => {
  for (const collection of ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity']) {
    for (const ownerId of [['sales-riley'], [], null, true, 0, {}, { toString: 'sales-riley' }, 'crm-auditor', 'unknown']) {
      const state = lifecycle(); state[collection][0].ownerId = clone(ownerId)
      assert.equal(isCrmState(state), false, `${collection}.ownerId: ${JSON.stringify(ownerId)}`)
    }
  }
  for (const action of [['create-company'], [], null, true, 0, {}, { toString: 'create-company' }, 'unknown']) {
    const state = lifecycle(); state.activity[0].action = clone(action)
    assert.equal(isCrmState(state), false, `activity.action: ${JSON.stringify(action)}`)
  }
})

test('unsupported profile notes remain rejected, including oversized notes, without inventing fields', () => {
  for (const collection of ['companies', 'contacts', 'leads', 'opportunities', 'tasks', 'activity']) {
    for (const notes of ['Unsupported fictional note', 'x'.repeat(10001), { text: 'x'.repeat(10001) }]) {
      const state = lifecycle(); state[collection][0].notes = notes
      assert.equal(isCrmState(state), false, collection)
    }
  }
})

test('malformed relationship edges and enum variants are refused without mutating the candidate', () => {
  for (const [label, corrupt] of corruptions) {
    const state = lifecycle(); corrupt(state)
    const before = clone(state)
    assert.equal(isCrmState(state), false, label)
    assert.deepEqual(state, before, label)
  }
})

test('individual import decoding rejects malformed CRM before complete current graph or saved bytes can change', () => {
  for (const [label, corrupt] of corruptions) {
    const target = destination()
    const candidate = lifecycle(); corrupt(candidate)
    assert.throws(() => {
      const parsed = backup.parseDemoBackup(JSON.stringify(envelope(candidate)), 'crm', isCrmState)
      const applied = imports.replaceDemoState('crm', parsed.state, isCrmState, target.storage)
      if (applied.ok) target.current.crm = applied.state
    }, /incomplete or incompatible/, label)
    preserved(target, label)
  }
})

test('combined import decoding rejects malformed CRM before any selective restore or destination write', () => {
  for (const [label, corrupt] of corruptions) {
    const target = destination()
    const candidate = { ...workspaces.createDemoWorkspaces(), crm: lifecycle() }; corrupt(candidate.crm)
    assert.throws(() => {
      const parsed = combined.parseCombinedBackup(JSON.stringify(combinedEnvelope(candidate)))
      const applied = restore.restoreDemoWorkspaces(parsed.states, ['cms'], target.storage)
      if (applied.ok) target.current.cms = parsed.states.cms
    }, /incomplete or incompatible/, label)
    preserved(target, label)
  }
})

test('apply-time validation refuses malformed CRM even after a previously valid preview', () => {
  for (const [label, corrupt] of corruptions) {
    const target = destination()
    const preview = backup.parseDemoBackup(backup.createDemoBackup('crm', lifecycle(), isCrmState, exportedAt), 'crm', isCrmState)
    corrupt(preview.state)
    const applied = imports.replaceDemoState('crm', preview.state, isCrmState, target.storage)
    assert.equal(applied.ok, false, label)
    assert.equal(Object.hasOwn(applied, 'state'), false, label)
    assert.match(applied.status.message, /previous workspace and browser save are preserved/, label)
    preserved(target, label)
  }
})

test('direct combined apply rejects invalid CRM even when it is outside the selected portal scope', () => {
  for (const selected of [['crm'], ['cms'], ['hr', 'cms', 'crm']]) {
    const target = destination()
    const candidate = { ...workspaces.createDemoWorkspaces(), crm: lifecycle() }
    candidate.crm.leads[1].status = ['qualified']
    assert.equal(restore.restoreDemoWorkspaces(candidate, selected, target.storage).ok, false)
    preserved(target, selected.join(','))
  }
})
