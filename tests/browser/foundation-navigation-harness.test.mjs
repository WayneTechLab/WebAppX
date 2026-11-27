import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { assertFoundationSlots, expectedFoundationAction, foundationMockKeys, foundationPersistentFixture, installFoundationStorageAudit } from './foundation-navigation.mjs'

const seed = JSON.parse(await readFile(new URL('./fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces

test('foundation storage ledger delegates actual methods once, keeps exceptions and records no values', () => {
  const realm = { protectedKeys: [...foundationMockKeys] }
  runInNewContext(`
    const values = new Map(), calls = [];
    class Storage {
      getItem(key) { calls.push(['getItem', key]); if (key === 'webappx.demo.hr') throw new Error('literal read refusal'); return values.get(key) ?? null; }
      setItem(key, value) { calls.push(['setItem', key]); values.set(key, value); }
      removeItem(key) { calls.push(['removeItem', key]); values.delete(key); }
    }
    const window = {};
    (${installFoundationStorageAudit.toString()})({protectedKeys});
    const store = new Storage();
    store.setItem('webappx.demo.cms', 'PRIVATE_LITERAL_VALUE');
    if (store.getItem('webappx.demo.cms') !== 'PRIVATE_LITERAL_VALUE') throw Error('delegation lost value');
    store.removeItem('webappx.demo.cms');
    store.setItem('unrelated', 'unrelated-preserved');
    let failure; try { store.getItem('webappx.demo.hr'); } catch (error) { failure = error.message; }
    if (failure !== 'literal read refusal') throw Error('original failure lost');
    result = JSON.stringify({ ledger: window.__webappxFoundationStorageAudit, calls, remaining: [...values] });
  `, realm)
  const result = JSON.parse(realm.result)
  assert.deepEqual(result.ledger, [
    { method: 'setItem', key: 'webappx.demo.cms' },
    { method: 'getItem', key: 'webappx.demo.cms' },
    { method: 'removeItem', key: 'webappx.demo.cms' },
    { method: 'getItem', key: 'webappx.demo.hr' },
  ])
  assert.deepEqual(result.calls, [['setItem', 'webappx.demo.cms'], ['getItem', 'webappx.demo.cms'], ['removeItem', 'webappx.demo.cms'], ['setItem', 'unrelated'], ['getItem', 'webappx.demo.hr']])
  assert.deepEqual(result.remaining, [['unrelated', 'unrelated-preserved']])
  assert.equal(JSON.stringify(result.ledger).includes('PRIVATE_LITERAL_VALUE'), false)
})

test('five literal protected keys and exact-byte verifier detect whitespace, missing slots and unrelated changes', () => {
  assert.deepEqual(foundationMockKeys, ['webappx.demo.hr', 'webappx.demo.cms', 'webappx.demo.crm', 'webappx.demo.restore-points', 'webappx.demo.recovery-preferences'])
  const initial = foundationPersistentFixture(seed)
  assertFoundationSlots({ ...initial, accessibility: 'independent normal app preference' }, initial, 'preserved')
  assert.throws(() => assertFoundationSlots({ ...initial, 'webappx.demo.cms': initial['webappx.demo.cms'].trim() }, initial, 'modified'), /exact bytes for webappx.demo.cms/)
  assert.throws(() => assertFoundationSlots({ ...initial, 'webappx.demo.restore-points': undefined }, initial, 'removed'), /exact bytes for webappx.demo.restore-points/)
  assert.throws(() => assertFoundationSlots({ ...initial, 'foundation.unrelated': 'changed' }, initial, 'unrelated'), /exact bytes for foundation.unrelated/)
})

test('independent full expected records preserve the source and every unselected portal', () => {
  const before = JSON.stringify(seed)
  const hr = expectedFoundationAction(seed, 'hr', 'Literal HR expectation')
  assert.equal(JSON.stringify(seed), before)
  assert.deepEqual(hr.cms, seed.cms)
  assert.deepEqual(hr.crm, seed.crm)
  assert.deepEqual(hr.hr.performance.goals.at(-1), { id: 'goal-1', employeeId: 'employee-002', title: 'Literal HR expectation', progress: 0, status: 'active', activity: [{ receipt: 'MOCK-PERF-0001', action: 'goal created', actorRole: 'employer-owner' }] })
  const cms = expectedFoundationAction(seed, 'cms', 'Literal CMS expectation')
  assert.deepEqual(cms.hr, seed.hr)
  assert.deepEqual(cms.crm, seed.crm)
  assert.equal(cms.cms.entries.find(entry => entry.id === 'cms-article-001').title, 'Literal CMS expectation')
  assert.deepEqual(cms.cms.activity, [{ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' }])
  const crm = expectedFoundationAction(seed, 'crm', 'Literal CRM expectation')
  assert.deepEqual(crm.hr, seed.hr)
  assert.deepEqual(crm.cms, seed.cms)
  assert.deepEqual(crm.crm.companies.at(-1), { id: 'company-0001', name: 'Literal CRM expectation', ownerId: 'crm-owner' })
  assert.equal(crm.crm.sequence, 2)
  assert.throws(() => expectedFoundationAction(seed, 'unknown', 'refuse'), /Unknown foundation/)
  assert.equal(JSON.stringify(seed), before)
})

test('persistent browser fixtures deliberately differ from walkthrough defaults in all five owned slots', () => {
  const saved = foundationPersistentFixture(seed)
  for (const module of ['hr', 'cms', 'crm']) {
    const envelope = JSON.parse(saved[`webappx.demo.${module}`])
    assert.equal(envelope.module, module)
    assert.equal(envelope.schemaVersion, 1)
    assert.notDeepEqual(envelope.data, seed[module])
    assert.ok(saved[`webappx.demo.${module}`].endsWith('\n'))
  }
  assert.deepEqual(JSON.parse(saved['webappx.demo.recovery-preferences']), { schemaVersion: 1, beforeImport: true, beforeReset: true })
  const point = JSON.parse(saved['webappx.demo.restore-points']).points[0]
  assert.equal(point.id, 'browser-only-foundation-point')
  assert.equal(point.label, 'Browser-only preserved history')
  assert.deepEqual(point.modules, ['hr', 'cms', 'crm'])
  assert.equal(saved['webappx.demo.unowned-sentinel'], '{"outside":"the exact five-key inventory"}\n')
})
