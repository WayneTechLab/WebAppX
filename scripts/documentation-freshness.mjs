#!/usr/bin/env node
/** Identify documentation review candidates; preserve original dated receipts. */
import { constants } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImpactReport, impactLimits } from './backlog-impact.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
export const defaultFreshnessMapping = 'docs/evidence/documentation-freshness-map.json'
export const defaultFreshnessDecisions = 'docs/evidence/documentation-freshness-decisions.json'
export const freshnessLimits = Object.freeze({ guides: 20, scopes: 12, proposals: 20, receipts: 4, fileBytes: 1_048_576, decisions: 200, displayedPaths: 20 })
const sha = value => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value)
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const clean = (value, min, max) => typeof value === 'string' && value === value.trim() && value.length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const pathSafe = value => clean(value, 1, 240) && !/^[A-Za-z]:|^[\/\\]|[\\?#:%]/.test(value) && !value.split('/').some(part => ['', '.', '..'].includes(part))
const guidePath = value => pathSafe(value) && value.startsWith('docs/') && value.endsWith('.md')
const dataPath = value => pathSafe(value) && /^docs\/evidence\/[a-z0-9][a-z0-9-]*\.json$/.test(value)
const guideId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(value)
const proposalId = value => typeof value === 'string' && /^WX-\d{4}$/.test(value)
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const hashValue = value => hash(JSON.stringify(stable(value)))
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const unique = values => new Set(values).size === values.length
// Avoid host-locale ordering in a digest. ASCII folding is presentation only;
// actual source scope matching and path identity remain case-sensitive.
const pathOrder = (left, right) => {
  const a = left.path.replace(/[A-Z]/g, value => value.toLowerCase())
  const b = right.path.replace(/[A-Z]/g, value => value.toLowerCase())
  return a < b ? -1 : a > b ? 1 : left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

export function validateFreshnessMapping(value, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!exact(value, ['schemaVersion', 'intent', 'catalog', 'guides']) || value.schemaVersion !== 1 || value.intent !== 'documentation-evidence-freshness'
    || !exact(value.catalog, ['path', 'revision', 'sha256']) || !pathSafe(value.catalog.path) || !sha(value.catalog.revision) || !digest(value.catalog.sha256)
    || !Array.isArray(value.guides) || !value.guides.length || value.guides.length > freshnessLimits.guides) throw new Error('Expected schema 1 documentation freshness mapping, a bound committed catalog, and 1 to 20 guides.')
  const seen = new Set(); const paths = new Set()
  for (const guide of value.guides) {
    if (!exact(guide, ['id', 'guide', 'examinedRevision', 'sourceReview', 'proposalIds', 'sourceScopes', 'receipts']) || !guideId(guide.id) || seen.has(guide.id)
      || !exact(guide.guide, ['path', 'sha256']) || !guidePath(guide.guide.path) || paths.has(guide.guide.path) || !digest(guide.guide.sha256) || !sha(guide.examinedRevision)
      || !exact(guide.sourceReview, ['reviewedOn', 'scope']) || !day(guide.sourceReview.reviewedOn) || guide.sourceReview.reviewedOn > today || !clean(guide.sourceReview.scope, 20, 700)
      || !Array.isArray(guide.proposalIds) || !guide.proposalIds.length || guide.proposalIds.length > freshnessLimits.proposals || !unique(guide.proposalIds) || !guide.proposalIds.every(proposalId)
      || !Array.isArray(guide.sourceScopes) || !guide.sourceScopes.length || guide.sourceScopes.length > freshnessLimits.scopes || !unique(guide.sourceScopes) || !guide.sourceScopes.every(pathSafe)
      || !Array.isArray(guide.receipts) || !guide.receipts.length || guide.receipts.length > freshnessLimits.receipts) throw new Error('Guide mappings require unique IDs/paths, full examined revisions, bounded reviewed scopes/proposal IDs and receipts.')
    seen.add(guide.id); paths.add(guide.guide.path)
    const receipts = new Set()
    for (const receipt of guide.receipts) {
      if (!exact(receipt, ['path', 'sha256', 'category', 'observedOn', 'observationRevision', 'revisionBasis', 'scope']) || !guidePath(receipt.path) || !digest(receipt.sha256)
        || receipts.has(receipt.path) || !['local', 'browser', 'provider', 'operator'].includes(receipt.category) || !day(receipt.observedOn) || receipt.observedOn > guide.sourceReview.reviewedOn
        || !sha(receipt.observationRevision) || !['examined-source', 'receipt-source-base'].includes(receipt.revisionBasis) || !clean(receipt.scope, 20, 700)) throw new Error('Receipts require original dates, qualified full observation revisions, safe Markdown paths and byte digests.')
      receipts.add(receipt.path)
    }
  }
  return value
}

export function validateFreshnessDecisions(value, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!exact(value, ['schemaVersion', 'intent', 'decisions']) || value.schemaVersion !== 1 || value.intent !== 'documentation-review-decisions' || !Array.isArray(value.decisions) || value.decisions.length > freshnessLimits.decisions) throw new Error('Expected schema 1 documentation review decisions with at most 200 records.')
  const keys = new Set(); const ids = new Set()
  for (const record of value.decisions) {
    if (!exact(record, ['id', 'guideId', 'reviewedBy', 'reviewedOn', 'targetRevision', 'reportDigest', 'mappingSha256', 'inputsSha256', 'scopeSha256', 'decision', 'rationale'])
      || typeof record.id !== 'string' || !/^DFR-[0-9a-f]{16}$/.test(record.id) || ids.has(record.id) || !guideId(record.guideId)
      || !clean(record.reviewedBy, 2, 80) || !day(record.reviewedOn) || record.reviewedOn > today || !sha(record.targetRevision)
      || ![record.reportDigest, record.mappingSha256, record.inputsSha256, record.scopeSha256].every(digest) || !['retain', 'refresh-needed'].includes(record.decision) || !clean(record.rationale, 30, 1000)) throw new Error('Review decisions require exact dated target/digest/scope bindings, a reviewer and bounded rationale; status/completion fields are prohibited.')
    const key = `${record.guideId}:${record.targetRevision}:${record.reportDigest}`
    if (keys.has(key)) throw new Error('Duplicate documentation review decision; existing records cannot be overwritten.')
    if (record.id !== `DFR-${hashValue({ guideId: record.guideId, targetRevision: record.targetRevision, reportDigest: record.reportDigest }).slice(0, 16)}`) throw new Error('Decision ID does not match its immutable review binding.')
    keys.add(key); ids.add(record.id)
  }
  return value
}

/** Only declared local public Markdown/data inputs are opened; no symlink traversal. */
async function readLocal(repositoryRoot, path, { optional = false } = {}) {
  if (!pathSafe(path)) throw new Error('Local input must be a safe repository-relative path.')
  let current = repositoryRoot
  for (const [index, part] of path.split('/').entries()) {
    current = resolve(current, part)
    const info = await lstat(current).catch(error => { if (optional && error.code === 'ENOENT' && index === path.split('/').length - 1) return null; throw new Error('A required contained local input is missing or unreadable.') })
    if (!info) return null
    if (info.isSymbolicLink() || (index < path.split('/').length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error('Local inputs must be regular files under real repository directories; symlinks are refused.')
    if (index === path.split('/').length - 1 && info.size > freshnessLimits.fileBytes) throw new Error('Local input exceeds its 1 MiB inspection limit.')
  }
  // O_NOFOLLOW is available on supported Unix hosts; component checks apply
  // everywhere. A second bounded read catches growth after the stat check.
  const handle = await open(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)).catch(() => { throw new Error('A contained local input changed or became unreadable.') })
  try {
    const bytes = Buffer.alloc(freshnessLimits.fileBytes + 1)
    let length = 0
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length)
      if (!result.bytesRead) break
      length += result.bytesRead
    }
    if (length > freshnessLimits.fileBytes) throw new Error('Local input exceeds its 1 MiB inspection limit.')
    return bytes.subarray(0, length)
  } finally { await handle.close() }
}

function json(bytes, label) {
  try { return JSON.parse(decode(bytes)) } catch { throw new Error(`${label} must contain UTF-8 JSON.`) }
}
const emptyDecisions = () => ({ schemaVersion: 1, intent: 'documentation-review-decisions', decisions: [] })

/** The existing impact engine owns all Git revision resolution and tree diffing. */
export async function createFreshnessReport({ repositoryRoot = root, mappingPath = defaultFreshnessMapping, decisionsPath = defaultFreshnessDecisions, to, today, impact = createImpactReport } = {}) {
  if (typeof to !== 'string' || !to || to.startsWith('-') || to.length > 256 || /[\s\u0000-\u001f\u007f:]/.test(to)) throw new Error('An explicit locally available review target --to is required.')
  if (!dataPath(mappingPath) || !dataPath(decisionsPath) || mappingPath === decisionsPath) throw new Error('Mapping and decision paths must be distinct JSON files directly under docs/evidence/.')
  const repository = await realpath(repositoryRoot)
  const mappingBytes = await readLocal(repository, mappingPath)
  const mapping = validateFreshnessMapping(json(mappingBytes, 'Mapping'), { today })
  const decisionBytes = await readLocal(repository, decisionsPath, { optional: true })
  const decisions = validateFreshnessDecisions(decisionBytes ? json(decisionBytes, 'Decision history') : emptyDecisions(), { today })
  const inputs = new Map([[mappingPath, mappingBytes]])
  async function checkedInput(path, expected, label) {
    const bytes = inputs.get(path) ?? await readLocal(repository, path)
    if (hash(bytes) !== expected) throw new Error(`${label} digest drift; review the local input and update its explicit mapping before comparison.`)
    inputs.set(path, bytes)
    return bytes
  }
  for (const guide of mapping.guides) {
    await checkedInput(guide.guide.path, guide.guide.sha256, 'Guide')
    for (const receipt of guide.receipts) {
      const bytes = await checkedInput(receipt.path, receipt.sha256, 'Receipt')
      const text = decode(bytes)
      if (!text.includes(receipt.observedOn) || !text.includes(receipt.observationRevision)) throw new Error('Receipt does not contain the mapped original date and observation revision; retain its literal provenance.')
    }
  }
  const comparisons = new Map(); const guides = []
  let committedCatalogBytes; let catalogIds
  // Observe the catalog read already owned by the impact engine. Its displayed
  // proposal page is incomplete for membership checks; do not introduce another
  // Git command or trust a workingtree catalog as a substitute for that blob.
  function observeCatalogRead(command, args, options) {
    const result = spawnSync(command, args, options)
    const index = args.indexOf('cat-file')
    if (index !== -1 && args[index + 1] === 'blob' && result.status === 0 && !result.error && !result.signal
      && Buffer.isBuffer(result.stdout) && result.stdout.length <= impactLimits.catalogBytes && hash(result.stdout) === mapping.catalog.sha256) committedCatalogBytes = result.stdout
    return result
  }
  let targetRevision; let catalog
  for (const guide of mapping.guides) {
    let comparison = comparisons.get(guide.examinedRevision)
    if (!comparison) {
      comparison = await impact({ repositoryRoot: repository, from: guide.examinedRevision, to: targetRevision ?? to, catalogRevision: mapping.catalog.revision, catalogPath: mapping.catalog.path, limit: impactLimits.displayedProposals, changeLimit: impactLimits.displayedChanges, run: observeCatalogRead })
      if (comparison.fromRevision !== guide.examinedRevision || !sha(comparison.toRevision) || comparison.catalog?.revision !== mapping.catalog.revision || comparison.catalog?.path !== mapping.catalog.path || comparison.catalog?.sha256 !== mapping.catalog.sha256) throw new Error('Committed comparison or catalog binding differs from the reviewed mapping.')
      if (!catalogIds) {
        if (!committedCatalogBytes) throw new Error('Bound committed catalog identities are unavailable; cannot validate mapped proposal IDs.')
        // The impact engine has validated this exact blob and its unique IDs.
        catalogIds = new Set(json(committedCatalogBytes, 'Bound committed catalog').items.map(item => item.id))
      }
      if (comparison.truncation?.omittedChangeRecords !== 0 || comparison.catalogChanges?.omittedDefinitionProposalIds !== 0) throw new Error('Incomplete changed-path or definition-advisory set; narrow the source comparison before a freshness review.')
      if (targetRevision && targetRevision !== comparison.toRevision) throw new Error('Review target changed during comparison.')
      targetRevision = comparison.toRevision; catalog = comparison.catalog
      comparisons.set(guide.examinedRevision, comparison)
    }
    if (guide.proposalIds.some(id => !catalogIds.has(id))) throw new Error('Unknown mapped proposal ID in the bound committed catalog; review the guide mapping.')
    const changed = [...new Set(comparison.changes.flatMap(change => change.paths.filter(entry => entry.classification === 'product-scope').map(entry => entry.path)))].sort()
    const matches = changed.filter(path => guide.sourceScopes.some(scope => path === scope || path.startsWith(`${scope}/`)))
    const definitions = comparison.catalogChanges.definitionChangedProposalIds.filter(id => guide.proposalIds.includes(id))
    guides.push({
      id: guide.id, path: guide.guide.path, guideSha256: guide.guide.sha256, examinedRevision: guide.examinedRevision, sourceReview: guide.sourceReview,
      sourceScopes: guide.sourceScopes, proposalIds: guide.proposalIds, scopeSha256: hashValue({ examinedRevision: guide.examinedRevision, sourceScopes: guide.sourceScopes, proposalIds: guide.proposalIds, receipts: guide.receipts }),
      sourceChangeCount: matches.length, changedPaths: matches.slice(0, freshnessLimits.displayedPaths), omittedChangedPaths: Math.max(0, matches.length - freshnessLimits.displayedPaths), definitionAdvisoryIds: definitions,
      reviewRequired: matches.length > 0 || definitions.length > 0, assessment: matches.length ? 'source-changes-require-review' : definitions.length ? 'definition-review-advisory' : 'no-mapped-source-change',
      receipts: guide.receipts.map(receipt => ({ ...receipt, qualification: receipt.revisionBasis === 'receipt-source-base' ? 'Historical receipt starting source base; this does not identify an exact observed final build.' : 'Original receipt examined-source observation; no new execution is performed by this review.' })),
      currentBrowserVerified: false,
    })
  }
  // Recheck every local input after Git work; a preview is an observation, not a lease.
  for (const [path, bytes] of inputs) if (!bytes.equals(await readLocal(repository, path))) throw new Error('Local input changed during the freshness preview; repeat the review.')
  const localInputs = [...inputs].map(([path, bytes]) => ({ path, sha256: hash(bytes) })).sort(pathOrder)
  const body = {
    schemaVersion: 1, intent: 'documentation-evidence-freshness-report', targetRevision,
    boundary: 'Commit-bound source comparison with explicitly reviewed contained local mapping, guide and receipt inputs; document bytes are not claimed to be committed blobs.',
    mapping: { path: mappingPath, sha256: hash(mappingBytes) }, catalog, inputsSha256: hashValue(localInputs), localInputs,
    counts: { guides: guides.length, sourceReviewRequired: guides.filter(guide => guide.sourceChangeCount > 0).length, definitionReviewRequired: guides.filter(guide => guide.definitionAdvisoryIds.length > 0).length, reviewRequired: guides.filter(guide => guide.reviewRequired).length, historicalSourceBaseReceipts: guides.reduce((total, guide) => total + guide.receipts.filter(receipt => receipt.revisionBasis === 'receipt-source-base').length, 0) },
    guides,
    limitations: [
      'Source scope matches are exact paths or slash-delimited descendants. Unrelated source changes and catalog status/completion metadata do not request guide review; related proposal-definition changes are separate advisories.',
      'No mapped source change is a comparison result, not current browser, provider, deployment or operational verification. Original dates, receipt digests and starting-source-base qualifications remain visible.',
      'Source scope/proposal relationships and receipt interpretation are explicit maintainer-reviewed mapping inputs. A bound catalog digest identifies the referenced proposal edition; this workflow does not infer every guide dependency or validate receipt claims.',
      'Report display may omit changed paths after 20 per guide while preserving exact counts. Truncated underlying Git change/advisory sets fail closed. All Git policy, local-object and input bounds of the impact engine apply.',
    ],
  }
  const reportDigest = hashValue(body)
  return { ...body, reportDigest, decisions: { path: decisionsPath, sha256: decisionBytes ? hash(decisionBytes) : 'absent', total: decisions.decisions.length, matching: decisions.decisions.filter(record => record.targetRevision === targetRevision && record.reportDigest === reportDigest) } }
}

/** Append one deliberately reviewed local record; never edit a receipt or catalog. */
export async function recordFreshnessDecision({ guide: id, decision, reviewedBy, reviewedOn, rationale, expectedReportDigest, expectedDecisionsDigest, today = new Date().toISOString().slice(0, 10), ...options } = {}) {
  if (!guideId(id) || !['retain', 'refresh-needed'].includes(decision) || !clean(reviewedBy, 2, 80) || !day(reviewedOn) || reviewedOn > today || !clean(rationale, 30, 1000) || !digest(expectedReportDigest) || !(digest(expectedDecisionsDigest) || expectedDecisionsDigest === 'absent')) throw new Error('Recording requires a guide, retain/refresh-needed decision, reviewer, actual date, rationale and both preview digests.')
  const report = await createFreshnessReport({ ...options, today })
  if (report.reportDigest !== expectedReportDigest || report.decisions.sha256 !== expectedDecisionsDigest) throw new Error('Stale preview/report or decision-history digest; inspect a new preview before recording.')
  const guide = report.guides.find(value => value.id === id)
  if (!guide || reviewedOn < guide.sourceReview.reviewedOn) throw new Error('Choose a mapped guide and a review date no earlier than its source review.')
  const repository = await realpath(options.repositoryRoot ?? root)
  const path = report.decisions.path
  if (report.localInputs.some(input => input.path === path)) throw new Error('Decision history cannot overwrite a guide, receipt or mapping input.')
  const absolute = resolve(repository, path)
  const lockPath = `${absolute}.lock`
  const lock = await open(lockPath, 'wx', 0o600).catch(() => { throw new Error('Decision history is locked or its directory is unavailable; no record was written.') })
  let temporary
  try {
    const oldBytes = await readLocal(repository, path, { optional: true })
    if ((oldBytes ? hash(oldBytes) : 'absent') !== expectedDecisionsDigest) throw new Error('Decision history changed after preview; no record was written.')
    for (const input of report.localInputs) {
      if (hash(await readLocal(repository, input.path)) !== input.sha256) throw new Error('Review inputs changed before recording; no record was written.')
    }
    const history = validateFreshnessDecisions(oldBytes ? json(oldBytes, 'Decision history') : emptyDecisions(), { today })
    if (history.decisions.length >= freshnessLimits.decisions) throw new Error('Decision history reached its 200-record limit.')
    if (history.decisions.some(record => record.guideId === id && record.targetRevision === report.targetRevision && record.reportDigest === report.reportDigest)) throw new Error('Duplicate review decision; existing records cannot be overwritten.')
    const record = { id: `DFR-${hashValue({ guideId: id, targetRevision: report.targetRevision, reportDigest: report.reportDigest }).slice(0, 16)}`, guideId: id, reviewedBy, reviewedOn, targetRevision: report.targetRevision, reportDigest: report.reportDigest, mappingSha256: report.mapping.sha256, inputsSha256: report.inputsSha256, scopeSha256: guide.scopeSha256, decision, rationale }
    const next = validateFreshnessDecisions({ ...history, decisions: [...history.decisions, record] }, { today })
    temporary = `${absolute}.${record.id}.tmp`
    const handle = await open(temporary, 'wx', 0o600).catch(() => { throw new Error('Review temporary file already exists or cannot be created; no record was written.') })
    try { await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`); await handle.sync() } finally { await handle.close() }
    // The exclusive lock serializes this tool's writers; recheck external changes.
    const finalBytes = await readLocal(repository, path, { optional: true })
    if ((finalBytes ? hash(finalBytes) : 'absent') !== expectedDecisionsDigest) throw new Error('Decision history changed during recording; no record was written.')
    for (const input of report.localInputs) if (hash(await readLocal(repository, input.path)) !== input.sha256) throw new Error('Review inputs changed during recording; no record was written.')
    await rename(temporary, absolute); temporary = undefined
    return { schemaVersion: 1, intent: 'documentation-review-recorded', path, record }
  } finally {
    if (temporary) await unlink(temporary).catch(() => {})
    await lock.close(); await unlink(lockPath)
  }
}

export function formatFreshnessReport(report) {
  const lines = ['Documentation evidence freshness (schema 1)', `Review target: ${report.targetRevision}`, `Mapping digest: ${report.mapping.sha256}`, `Report digest: ${report.reportDigest}`, `Decision-history digest: ${report.decisions.sha256}`, `Review candidates: ${report.counts.reviewRequired} / ${report.counts.guides} guides`, report.boundary, '']
  for (const guide of report.guides) {
    lines.push(`${guide.id}: ${guide.assessment}; examined ${guide.examinedRevision}`, `  Guide: ${guide.path}; ${guide.sourceChangeCount} relevant changed paths; definitions: ${guide.definitionAdvisoryIds.join(', ') || 'none'}`, ...guide.changedPaths.map(path => `  Changed: ${JSON.stringify(path)}`))
    if (guide.omittedChangedPaths) lines.push(`  ${guide.omittedChangedPaths} additional relevant paths omitted.`)
    for (const receipt of guide.receipts) lines.push(`  Receipt ${receipt.path}: ${receipt.observedOn}, ${receipt.observationRevision}, ${receipt.revisionBasis}. ${receipt.qualification}`)
  }
  lines.push('', ...report.limitations.map(value => `- ${value}`))
  return `${lines.join('\n')}\n`
}

export function parseFreshnessArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const names = { '--to': 'to', '--mapping': 'mappingPath', '--decisions': 'decisionsPath', '--guide': 'guide', '--decision': 'decision', '--reviewed-by': 'reviewedBy', '--reviewed-on': 'reviewedOn', '--rationale': 'rationale', '--expected-report-digest': 'expectedReportDigest', '--expected-decisions-digest': 'expectedDecisionsDigest' }
  const result = {}; const seen = new Set()
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (seen.has(flag)) throw new Error('Repeated freshness option.')
    seen.add(flag)
    if (['--json', '--record-decision'].includes(flag)) result[flag === '--json' ? 'json' : 'record'] = true
    else if (Object.hasOwn(names, flag) && args[index + 1] && !args[index + 1].startsWith('--')) result[names[flag]] = args[++index]
    else throw new Error('Unknown freshness option or missing value.')
  }
  if (!result.to) throw new Error('An explicit --to review target is required.')
  const decisionOptions = ['guide', 'decision', 'reviewedBy', 'reviewedOn', 'rationale', 'expectedReportDigest', 'expectedDecisionsDigest']
  if (result.record ? decisionOptions.some(key => !result[key]) : decisionOptions.some(key => result[key] !== undefined)) throw new Error('Decision fields require --record-decision and all explicit review/digest fields.')
  return result
}

async function main() {
  const options = parseFreshnessArguments(process.argv.slice(2))
  if (options.help) { console.log('Usage: node scripts/documentation-freshness.mjs --to REV [--mapping docs/evidence/NAME.json] [--decisions docs/evidence/NAME.json] [--json]\nRecord: add --record-decision --guide ID --decision retain|refresh-needed --reviewed-by NAME --reviewed-on YYYY-MM-DD --rationale TEXT --expected-report-digest SHA256 --expected-decisions-digest SHA256|absent\nPreview is read-only. Recording appends one local review decision; no source/receipt/catalog status is changed.'); return }
  const result = options.record ? await recordFreshnessDecision(options) : await createFreshnessReport(options)
  console.log(options.json || options.record ? JSON.stringify(result, null, 2) : formatFreshnessReport(result).trimEnd())
}
if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`Documentation freshness failed: ${error.message}`); process.exitCode = 1 })
