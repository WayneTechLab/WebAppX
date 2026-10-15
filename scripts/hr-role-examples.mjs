#!/usr/bin/env node
/** Generate reviewed synthetic HR examples. Domain behavior is tested separately. */
import { createHash } from 'node:crypto'
import { readFile, writeFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixturePath = resolve(root, 'tests/fixtures/hr-capability-examples.json')
const outputPath = resolve(root, 'docs/HR-ROLE-EXAMPLES.md')
const roles = ['employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor']
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function fields(value, expected, label) {
  if (!object(value) || Object.keys(value).length !== expected.length || !expected.every(key => Object.hasOwn(value, key))) throw new Error(`${label}: missing or unknown fields`)
}
function text(value, label, maximum = 1200) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > maximum || /[\x00-\x1f\x7f\u2028\u2029]/.test(value)) throw new Error(`${label}: use bounded single-line text`)
}
function list(value, label, { empty = false, maximum = 40 } = {}) {
  if (!Array.isArray(value) || value.length > maximum || (!empty && value.length === 0)) throw new Error(`${label}: use a bounded list`)
}
function strings(value, label, options) {
  list(value, label, options)
  value.forEach(item => text(item, label))
  if (new Set(value).size !== value.length) throw new Error(`${label}: duplicate entries`)
}
function actor(value) {
  if (!object(value) || !roles.includes(value.role) || Object.keys(value).some(key => !['role', 'employeeId', 'contractorId'].includes(key))) throw new Error('Use a synthetic HR actor and optional subject binding')
  for (const key of ['employeeId', 'contractorId']) if (Object.hasOwn(value, key) && (typeof value[key] !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(value[key]))) throw new Error('Invalid synthetic subject binding')
}
function event(value) {
  if (!object(value) || typeof value.type !== 'string' || !/^[a-z]+(?:-[a-z]+)+$/.test(value.type) || JSON.stringify(value).length > 3000) throw new Error('Use a bounded literal domain event')
  const pending = [value]
  while (pending.length) {
    const item = pending.pop()
    if (typeof item === 'string' && /[\x00-\x1f\x7f\u2028\u2029]/.test(item)) throw new Error('Domain event strings must be single-line text')
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Domain event numbers must be finite')
    if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'prototype', 'constructor', 'token', 'secret', 'password'].includes(key)) throw new Error('Unsupported domain event field')
      pending.push(child)
    }
  }
}

/** Validate reviewed data only; this function performs no I/O or domain transitions. */
export function validateHrRoleExamples(fixture) {
  fields(fixture, ['schemaVersion', 'intent', 'review', 'roles', 'cases', 'exportBoundary'], 'Role example fixture')
  if (fixture.schemaVersion !== 1 || fixture.intent !== 'reviewed-mock-role-examples') throw new Error('Use the reviewed mock role fixture format')
  const review = fixture.review
  fields(review, ['proposalId', 'criterion', 'sourceRevision', 'canonicalDocument', 'hashMode', 'reviewedSources'], 'Review basis')
  if (review.proposalId !== 'WX-0908' || review.canonicalDocument !== 'docs/PORTAL-CAPABILITIES.md' || review.hashMode !== 'utf8-lf-sha256' || typeof review.sourceRevision !== 'string' || !/^[0-9a-f]{40}$/.test(review.sourceRevision)) throw new Error('Use the reviewed WX-0908 source and canonical capability document')
  text(review.criterion, 'Acceptance criterion')
  list(review.reviewedSources, 'Reviewed sources')
  const sources = new Set()
  for (const source of review.reviewedSources) {
    fields(source, ['path', 'sha256'], 'Reviewed source')
    text(source.path, 'Reviewed source path', 240)
    if (isAbsolute(source.path) || /[\\?#:]/.test(source.path) || !/\.(?:ts|tsx|json|md)$/.test(source.path) || source.path.split('/').some(part => ['', '.', '..'].includes(part)) || typeof source.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(source.sha256) || sources.has(source.path)) throw new Error('Reviewed sources require unique contained text paths and SHA256 digests')
    sources.add(source.path)
  }
  if (!sources.has(review.canonicalDocument) || !sources.has('src/hr/model.ts') || !sources.has('src/hr/mock-workflows.ts') || !sources.has('src/portals/backup.ts')) throw new Error('Review the canonical matrix, HR model/transitions and complete backup boundary')
  list(fixture.roles, 'Roles', { maximum: 7 })
  if (fixture.roles.length !== 7 || fixture.roles.some((row, index) => row?.role !== roles[index])) throw new Error('Cover the seven exact HR roles once in canonical order')
  for (const row of fixture.roles) {
    fields(row, ['role', 'actor', 'context', 'projection'], 'Role example')
    actor(row.actor)
    if (row.actor.role !== row.role) throw new Error('Role and actor must agree')
    text(row.context, 'Role context')
    fields(row.projection, ['employeeIds', 'documentIds', 'compensationEmployeeId', 'compensationVisible', 'selfDraftVisible'], 'Visible projection')
    strings(row.projection.employeeIds, 'Employee projection', { empty: true })
    strings(row.projection.documentIds, 'Document projection', { empty: true })
    text(row.projection.compensationEmployeeId, 'Compensation subject', 80)
    if (typeof row.projection.compensationVisible !== 'boolean' || typeof row.projection.selfDraftVisible !== 'boolean') throw new Error('Projection visibility must be literal booleans')
  }
  list(fixture.cases, 'Domain cases', { maximum: 80 })
  const seen = new Set()
  for (const row of fixture.cases) {
    fields(row, ['id', 'actor', 'domain', 'actionDescription', 'resource', 'statePrerequisites', 'setup', 'event', 'expected'], 'Domain case')
    if (typeof row.id !== 'string' || !/^[a-z]+(?:-[a-z]+)+$/.test(row.id) || seen.has(row.id)) throw new Error('Use unique case identifiers')
    seen.add(row.id)
    actor(row.actor)
    if (!['workflow', 'performance'].includes(row.domain)) throw new Error('Use a reviewed HR domain transition')
    text(row.actionDescription, 'Complete action description')
    text(row.resource, 'Resource', 120)
    strings(row.statePrerequisites, 'Resource and state prerequisites')
    list(row.setup, 'Setup steps', { empty: true, maximum: 12 })
    for (const step of row.setup) { fields(step, ['actor', 'event'], 'Setup step'); actor(step.actor); event(step.event) }
    event(row.event)
    if (row.expected?.outcome === 'allow') {
      fields(row.expected, ['outcome', 'path', 'value', 'description'], 'Allowed case result')
      strings(row.expected.path, 'Observable result path')
      if (!['string', 'boolean', 'number'].includes(typeof row.expected.value) || (typeof row.expected.value === 'number' && !Number.isFinite(row.expected.value))) throw new Error('Use a literal observable expected value')
    } else {
      fields(row.expected, ['outcome', 'error', 'description'], 'Denied case result')
      if (row.expected.outcome !== 'deny') throw new Error('Expected outcome must be allow or deny')
      text(row.expected.error, 'Expected permission or state refusal')
    }
    text(row.expected.description, 'Expected result description')
  }
  for (const role of roles) if (!fixture.cases.some(row => row.actor.role === role && row.expected.outcome === 'deny')) throw new Error(`Include an explicit refused transition for ${role}`)
  for (const role of roles.filter(value => !['contractor', 'auditor'].includes(value))) if (!fixture.cases.some(row => row.actor.role === role && row.expected.outcome === 'allow')) throw new Error(`Include an allowed transition for ${role}`)
  const boundary = fixture.exportBoundary
  fields(boundary, ['modules', 'access', 'contents', 'description', 'included', 'excluded', 'authority'], 'Export boundary')
  if (JSON.stringify(boundary.modules) !== JSON.stringify(['hr', 'cms', 'crm']) || boundary.access !== 'all-preview-roles' || boundary.contents !== 'complete-saved-domain-state') throw new Error('All mock module exports contain complete saved state for every preview role')
  for (const key of ['description', 'authority']) text(boundary[key], 'Export boundary')
  strings(boundary.included, 'Included state')
  strings(boundary.excluded, 'Excluded transient state')
  return fixture
}

const escaped = value => String(value).replace(/([\\`*_\[\]<>#|])/g, '\\$1')
const code = value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const fence = '`'.repeat(Math.max(0, ...[...text.matchAll(/`+/g)].map(match => match[0].length)) + 1)
  return `${fence} ${text} ${fence}`
}
const links = path => `../${path.split('/').map(encodeURIComponent).join('/')}`

export function renderHrRoleExamples(input) {
  const fixture = validateHrRoleExamples(input)
  const lines = ['# Reviewed HR role examples', '',
    'These are concrete synthetic examples from the reviewed fixture. Use the',
    '[canonical cross-portal capability matrix](PORTAL-CAPABILITIES.md) for the complete vocabulary, role scopes and provider boundary.',
    'A role example is an actor, resource, action and current state; opening a route does not establish permission for its domain transitions.', '',
    `Review basis: ${code(fixture.review.sourceRevision)} and proposal ${code(fixture.review.proposalId)}.`,
    `Original criterion: ${escaped(fixture.review.criterion)}`, '',
    'The [reviewed fixture](../tests/fixtures/hr-capability-examples.json) supplies each action, prerequisite and literal expected result.',
    'The independent [domain tests](../tests/hr/role-examples.test.mjs) exercise the actual HR transitions, ownership checks, projections and complete backup codecs.',
    'Synthetic preview choices and local MOCK receipts do not authenticate people, assign account grants, establish tenant membership or enable provider operations.', '',
    '## Regenerate and check', '', '```bash',
    'node scripts/hr-role-examples.mjs --check', 'node --test tests/hr/role-examples.test.mjs',
    'node scripts/hr-role-examples.mjs --write', '```', '',
    'Check mode is the default and writes no files. Explicit write mode regenerates this page.',
    'The consistency check compares the complete generated page with the fixture and verifies the reviewed source digests. UTF-8 text uses LF-normalized SHA-256; CRLF and LF checkout line endings are equivalent. Source drift requires reviewing the behavior and refreshing the fixture, then rendering.',
    'Importing the generator performs no I/O. It does not import application models, inspect credentials or contact providers.', '',
    '## Actor and resource examples', '']
  for (const role of fixture.roles) {
    const projection = role.projection
    lines.push(`### ${code(role.role)}`, '', `Synthetic actor: ${code(role.actor)}.`, '', escaped(role.context), '',
      `Visible employee IDs: ${code(projection.employeeIds)}. Visible document IDs: ${code(projection.documentIds)}.`,
      `Compensation visibility for ${code(projection.compensationEmployeeId)}: **${projection.compensationVisible ? 'visible' : 'excluded'}**. A saved draft self-review for employee-002 is **${projection.selfDraftVisible ? 'visible' : 'excluded'}** in this actor’s performance helper projection.`,
      'These helper projections do not add routes; the current auditor performance page remains unavailable.', '')
    for (const row of fixture.cases.filter(item => item.actor.role === role.role)) {
      lines.push(`#### ${escaped(row.id)} — ${row.expected.outcome.toUpperCase()}`, '',
        `Action: ${escaped(row.actionDescription)}`, `Actor: ${code(row.actor)}; resource: ${code(row.resource)}; domain: ${code(row.domain)}.`, '',
        ...row.statePrerequisites.map(value => `- Prerequisite: ${escaped(value)}`), '',
        ...(row.setup.length ? [`Setup transitions, in order: ${row.setup.map(value => code(value)).join('; ')}.`, ''] : []),
        `Attempted event: ${code(row.event)}.`, '', `Expected: ${escaped(row.expected.description)}`,
        row.expected.outcome === 'allow' ? `Observable result: ${code(row.expected.path.join('.'))} equals ${code(row.expected.value)}.` : `Exact refusal: ${code(row.expected.error)}.`, '')
    }
  }
  lines.push('## Complete mock exports and narrower visible projections', '', escaped(fixture.exportBoundary.description), '',
    ...fixture.exportBoundary.included.map(value => `- Included: ${escaped(value)}`),
    ...fixture.exportBoundary.excluded.map(value => `- Excluded: ${escaped(value)}`), '',
    'An HR contractor or auditor can therefore export saved private draft content that is absent from their visible pages. A CMS viewer export contains unpublished content, and a CRM representative export contains other representatives’ saved records.',
    'The module and combined codecs validate complete fictional graphs and file compatibility; they receive no actor and apply no role or field filtering. A portal selection during restore does not narrow the export.', '',
    escaped(fixture.exportBoundary.authority), '',
    '## Reviewed source fingerprints', '',
    'These fingerprints bind the examples to reviewed local source bytes. They are review evidence, without a current deployment or provider acceptance claim.', '',
    '| Source | SHA-256 |', '| --- | --- |',
    ...fixture.review.reviewedSources.map(source => `| [${escaped(source.path)}](${links(source.path)}) | ${code(source.sha256)} |`), '')
  return lines.join('\n')
}

export function checkHrRoleExamples(fixture, markdown) {
  if (typeof markdown !== 'string' || markdown.replace(/\r\n/g, '\n') !== renderHrRoleExamples(fixture)) throw new Error('HR role documentation drift: review the fixture and regenerate with --write')
  return true
}

export async function runHrRoleExamples({ fixtures = fixturePath, output = outputPath, sourceRoot = root, write = false } = {}) {
  const fixture = validateHrRoleExamples(JSON.parse(await readFile(fixtures, 'utf8')))
  const actualRoot = await realpath(sourceRoot)
  for (const source of fixture.review.reviewedSources) {
    const file = await realpath(resolve(sourceRoot, source.path))
    const contained = relative(actualRoot, file)
    if (contained === '..' || contained.startsWith('../') || contained.startsWith('..\\') || isAbsolute(contained) || !(await stat(file)).isFile()) throw new Error(`Reviewed source escapes the repository: ${source.path}`)
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(file)).replace(/\r\n/g, '\n')
    if (createHash('sha256').update(text).digest('hex') !== source.sha256) throw new Error(`Reviewed source drift: ${source.path}; review its capability behavior before updating the fixture`)
  }
  const markdown = renderHrRoleExamples(fixture)
  if (write) await writeFile(output, markdown)
  else checkHrRoleExamples(fixture, await readFile(output, 'utf8'))
  return { roles: fixture.roles.length, cases: fixture.cases.length, written: write }
}

async function main(args) {
  const options = {}
  const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (seen.has(flag)) throw new Error(`Repeated option: ${flag}`)
    seen.add(flag)
    if (flag === '--check' || flag === '--write') options.write = flag === '--write'
    else if (['--fixtures', '--output'].includes(flag) && args[index + 1] && !args[index + 1].startsWith('--')) options[flag.slice(2)] = args[++index]
    else throw new Error(`Unknown option or missing value: ${flag}`)
  }
  if (seen.has('--check') && seen.has('--write')) throw new Error('Choose --check or --write')
  const result = await runHrRoleExamples(options)
  console.log(`HR role examples ${result.written ? 'rendered' : 'verified'}: ${result.roles} roles and ${result.cases} reviewed domain cases.`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch(error => {
  console.error(`HR role examples failed: ${error.message}`)
  process.exitCode = 1
})
