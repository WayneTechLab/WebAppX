import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePortfolio } from './validate.mjs';

const roles = ['Support', 'Contact', 'Billing', 'Social', 'Partner', 'Party', 'Location-1001'];
function plan() {
  return {
    schemaVersion: 1,
    inc: { id: 'inc', legalName: 'Example INC', owner: 'Owner', operationsProject: 'INC-Operations' },
    sharedDomain: 'example.com',
    businesses: [{ id: 'one', name: 'One', kind: 'business', project: 'One' }, { id: 'two', name: 'Two', kind: 'client', project: 'Two' }],
    mailboxes: ['one', 'two'].flatMap(businessId => ['Info', 'Chef'].map(role => ({ address: role + '-' + businessId + '@example.com', businessId, role, owner: 'Owner', provider: 'Provider' }))),
    aliases: ['one', 'two'].flatMap(businessId => roles.map(role => ({ address: role + '-' + businessId + '@example.com', businessId, role, forwardsTo: 'Chef-' + businessId + '@example.com' }))),
    senders: ['one', 'two'].map(businessId => ({ address: 'NoReply-' + businessId + '@example.com', businessId, role: 'NoReply', owner: 'Owner', provider: 'Provider', replyTo: 'Chef-' + businessId + '@example.com', inboundHandling: 'reject' })),
    websites: [],
    migration: { owner: 'Owner', sourceProvider: 'Source', temporaryAdminHost: 'admin.example.com', window: '2026-10-07 10:00 America/Los_Angeles', rollbackRef: 'Private rollback record', approvalRef: 'Private approval' }
  };
}
const registry = () => ({ schemaVersion: 1, projects: ['INC-Operations', 'One', 'Two'].map(name => ({ name, path: 'Projects/' + name, records: 'Projects/' + name + '/.SYSTEMXP', kind: 'operations' })) });

test('supplied five-business example has internally consistent routing', () => {
  const example = JSON.parse(readFileSync(new URL('../03_CONFIG/portfolio.example.json', import.meta.url), 'utf8'));
  assert.equal(example.businesses.length, 5);
  assert.deepEqual(validatePortfolio(example), []);
});

test('blank source passes only blank validation', () => {
  const blank = JSON.parse(readFileSync(new URL('../03_CONFIG/portfolio.blank.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePortfolio(blank, { blank: true }), []);
  assert.ok(validatePortfolio(blank).length);
  assert.ok(validatePortfolio(plan(), { blank: true }).length);
});
test('two-business email-only plan and registered scopes pass', () => {
  assert.deepEqual(validatePortfolio(plan(), { registry: registry() }), []);
});
for (const [label, mutate] of [
  ['cross-client forwarding', p => { p.aliases[0].forwardsTo = 'Chef-two@example.com'; }],
  ['cross-client Reply-To', p => { p.senders[0].replyTo = 'Chef-two@example.com'; }],
  ['case-insensitive address collision', p => { p.aliases[0].address = 'INFO-ONE@example.com'; }],
  ['missing public role', p => { p.aliases.pop(); }],
  ['unknown business', p => { p.senders[0].businessId = 'missing'; }],
  ['unknown fields', p => { p.inc.password = 'forbidden'; }],
  ['missing migration acceptance', p => { p.migration.approvalRef = ''; }],
  ['invalid inbound policy', p => { p.senders[0].inboundHandling = 'ignore'; }],
  ['wrong shared domain', p => { p.mailboxes[0].address = 'Info@other.example'; }],
  ['unscoped project collision', p => { p.businesses[1].project = 'one'; }],
  ['orphan website', p => { p.websites.push({ businessId: 'missing', hostname: 'web.example.com', hostingProjectId: 'project', hostingSiteId: 'site', hostingTarget: 'web', owner: 'Owner' }); }],
  ['malformed record', p => { p.businesses[0] = null; }]
]) test('rejects ' + label, () => {
  const p = plan(); mutate(p); assert.ok(validatePortfolio(p).length);
});
test('requires exact registered identities and canonical paths', () => {
  const r = registry(); r.projects.pop();
  assert.ok(validatePortfolio(plan(), { registry: r }).length);
  const other = registry(); other.projects[0].records = 'Projects/.SYSTEMXP';
  assert.ok(validatePortfolio(plan(), { registry: other }).length);
  assert.ok(validatePortfolio(plan(), { registry: { schemaVersion: 1, projects: [null] } }).length);
});
