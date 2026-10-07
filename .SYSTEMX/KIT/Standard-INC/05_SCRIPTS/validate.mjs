import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const errors = [];
const fail = message => errors.push(message);
const object = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(label + ': expected object');
    return false;
  }
  if (Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(label + ': unexpected or missing fields');
  return true;
};
const nonempty = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(label + ': required string');
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(label + ': duplicates');
};
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const roles = ['Support', 'Contact', 'Billing', 'Social', 'Partner', 'Party', 'Location-1001'];

export function validatePortfolio(p, { blank = false, registry } = {}) {
  errors.length = 0;
  const keys = ['schemaVersion', 'inc', 'sharedDomain', 'businesses', 'mailboxes', 'aliases', 'senders', 'websites', 'migration'];
  if (!object(p, keys, 'portfolio')) return [...errors];
  if (p.schemaVersion !== 1) fail('schemaVersion: expected 1');
  const incKeys = ['id', 'legalName', 'owner', 'operationsProject'];
  const migrationKeys = ['owner', 'sourceProvider', 'temporaryAdminHost', 'window', 'rollbackRef', 'approvalRef'];
  const incOK = object(p.inc, incKeys, 'inc');
  const migrationOK = object(p.migration, migrationKeys, 'migration');
  const arrays = ['businesses', 'mailboxes', 'aliases', 'senders', 'websites'];
  for (const key of arrays) if (!Array.isArray(p[key])) fail(key + ': expected array');
  if (errors.length) return [...errors];
  if (blank) {
    for (const key of incKeys) if (p.inc[key] !== '') fail('blank inc.' + key + ': expected empty');
    for (const key of migrationKeys) if (p.migration[key] !== '') fail('blank migration.' + key + ': expected empty');
    if (p.sharedDomain !== '') fail('blank sharedDomain: expected empty');
    for (const key of arrays) if (p[key].length) fail('blank ' + key + ': expected empty');
    return [...errors];
  }
  if (incOK) for (const key of incKeys) nonempty(p.inc[key], 'inc.' + key);
  if (migrationOK) for (const key of migrationKeys) nonempty(p.migration[key], 'migration.' + key);
  if (typeof p.sharedDomain !== 'string' || !domainPattern.test(p.sharedDomain)) fail('sharedDomain: expected lowercase DNS domain');
  if (!p.businesses.length) fail('businesses: at least one required');
  const contracts = {
    businesses: ['id', 'name', 'kind', 'project'],
    mailboxes: ['address', 'businessId', 'role', 'owner', 'provider'],
    aliases: ['address', 'businessId', 'role', 'forwardsTo'],
    senders: ['address', 'businessId', 'role', 'owner', 'provider', 'replyTo', 'inboundHandling'],
    websites: ['businessId', 'hostname', 'hostingProjectId', 'hostingSiteId', 'hostingTarget', 'owner']
  };
  for (const key of arrays) for (const [i, row] of p[key].entries()) {
    if (!object(row, contracts[key], key + '[' + i + ']')) continue;
    for (const field of contracts[key]) nonempty(row[field], key + '[' + i + '].' + field);
  }
  if (errors.length) return [...errors];
  unique(p.businesses.map(b => b.id.toLowerCase()), 'business IDs');
  unique(p.businesses.map(b => b.project.toLowerCase()), 'business project scopes');
  const businessIds = new Set(p.businesses.map(b => b.id));
  for (const b of p.businesses) if (!['business', 'brand', 'client', 'project'].includes(b.kind)) fail('business kind: ' + b.kind);
  const mail = [...p.mailboxes, ...p.aliases, ...p.senders];
  const email = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[^@]+$/.test(value)) return false;
    const [local, domain] = value.split('@');
    return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && domain === p.sharedDomain;
  };
  unique(mail.map(row => row.address.toLowerCase()), 'email addresses');
  for (const row of mail) {
    if (!businessIds.has(row.businessId)) fail('unknown business: ' + row.businessId);
    if (!email(row.address)) fail('invalid/shared-domain address: ' + row.address);
  }
  for (const b of p.businesses) {
    const boxes = p.mailboxes.filter(row => row.businessId === b.id);
    const aliases = p.aliases.filter(row => row.businessId === b.id);
    const senders = p.senders.filter(row => row.businessId === b.id);
    if (boxes.length !== 2 || ['Info', 'Chef'].some(role => boxes.filter(row => row.role === role).length !== 1)) fail(b.id + ': exactly one Info and Chef required');
    if (aliases.length !== roles.length || roles.some(role => aliases.filter(row => row.role === role).length !== 1)) fail(b.id + ': seven public alias roles required');
    if (senders.length !== 1 || senders[0]?.role !== 'NoReply') fail(b.id + ': exactly one NoReply required');
    const chef = boxes.find(row => row.role === 'Chef')?.address.toLowerCase();
    for (const row of aliases) if (!email(row.forwardsTo) || row.forwardsTo.toLowerCase() !== chef) fail(row.address + ': forwarding must target same-business Chef');
    for (const row of senders) {
      if (!email(row.replyTo) || row.replyTo.toLowerCase() !== chef) fail(row.address + ': Reply-To must target same-business Chef');
      if (!['monitored', 'forward-to-chef', 'reject'].includes(row.inboundHandling)) fail(row.address + ': choose inboundHandling');
    }
  }
  unique(p.websites.map(row => row.hostname.toLowerCase()), 'website hostnames');
  for (const row of p.websites) {
    if (!businessIds.has(row.businessId)) fail('website unknown business: ' + row.businessId);
    if (!domainPattern.test(row.hostname)) fail('website hostname: expected lowercase DNS hostname');
  }
  const projects = [p.inc.operationsProject, ...p.businesses.map(b => b.project)];
  for (const name of projects) {
    if (!/^[A-Za-z](?:[A-Za-z0-9 _-]{0,78}[A-Za-z0-9])?$/.test(name) || /^(root|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) fail('invalid project name: ' + name);
  }
  if (registry !== undefined) {
    if (!object(registry, ['schemaVersion', 'projects'], 'SYSTEMX registry') || registry.schemaVersion !== 1 || !Array.isArray(registry.projects)) {
      fail('SYSTEMX registry: invalid schema');
      return [...errors];
    }
    const entries = registry.projects;
    unique(entries.map(r => r?.name?.toLowerCase()), 'registry project names');
    for (const entry of entries) {
      if (!object(entry, ['name', 'path', 'records', 'kind'], 'registry entry')) continue;
      if (typeof entry.name !== 'string' || entry.path !== 'Projects/' + entry.name || entry.records !== 'Projects/' + entry.name + '/.SYSTEMXP' || !['general', 'software', 'research', 'operations', 'channel'].includes(entry.kind)) fail('registry entry: invalid canonical mapping');
    }
    for (const name of projects) if (!entries.some(entry => entry?.name === name)) fail('unregistered project: ' + name);
  }
  return [...errors];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const file = args.shift();
    let blank = false, registry;
    while (args.length) {
      const arg = args.shift();
      if (arg === '--blank' && !blank) blank = true;
      else if (arg === '--registry' && args.length && registry === undefined) registry = JSON.parse(fs.readFileSync(args.shift(), 'utf8'));
      else throw new Error('Unknown or incomplete option: ' + arg);
    }
    if (!file || (blank && registry !== undefined)) throw new Error('Usage: node validate.mjs FILE [--blank | --registry REGISTRY]');
    const result = validatePortfolio(JSON.parse(fs.readFileSync(file, 'utf8')), { blank, registry });
    if (result.length) {
      process.stderr.write(result.join('\n') + '\n');
      process.exitCode = 1;
    } else {
      process.stdout.write(blank ? 'Blank seed valid; no adopted plan configured.\n' : 'Written plan valid; project registration ' + (registry ? 'checked' : 'unverified') + '; operational evidence still required.\n');
    }
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
