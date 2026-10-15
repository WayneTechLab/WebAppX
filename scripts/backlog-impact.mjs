#!/usr/bin/env node
/** Compare committed source trees and request review without changing records. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from './webappx-backlog.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
export const defaultCatalogPath = 'docs/backlog/webappx-1000-todo.json'
export const impactLimits = Object.freeze({ timeout: 10_000, gitBytes: 8_388_608, catalogBytes: 2_097_152, changes: 20_000, proposals: 1_000, metadataEntries: 100_000, pathLength: 4_096, matchedPaths: 20, displayedProposals: 100, displayedChanges: 200 })
const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const safePath = value => typeof value === 'string' && value.length > 0 && value.length <= impactLimits.pathLength
  && !value.startsWith('/') && !/[\\\0]/.test(value) && !/^[A-Za-z]:/.test(value)
  && !value.split('/').some(part => !part || part === '.' || part === '..')
const safeScope = value => safePath(value) && value.length <= 240 && !/[\u0000-\u001f\u007f?#:]/.test(value) && value === value.trim()
const safeRevision = value => typeof value === 'string' && value.length > 0 && value.length <= 256
  && !value.startsWith('-') && !/[\s\u0000-\u001f\u007f:]/.test(value)
const bounded = (value, maximum, label) => {
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${label} must be an integer between 1 and ${maximum}.`)
  return value
}

/** Git's NUL protocol preserves spaces and both rename/copy endpoints. */
export function parseNameStatus(output) {
  const value = Buffer.isBuffer(output) ? decode(output) : output
  if (typeof value !== 'string' || (value && !value.endsWith('\0'))) throw new Error('Incomplete NUL name/status output.')
  const fields = value ? value.slice(0, -1).split('\0') : []
  const changes = []
  for (let index = 0; index < fields.length;) {
    const status = fields[index++]
    if (!/^(?:[ADMTUXB]|[RC](?:100|[1-9]?\d))$/.test(status)) throw new Error('Invalid Git name/status record.')
    const paths = fields.slice(index, index + (/^[RC]/.test(status) ? 2 : 1))
    index += paths.length
    if (paths.length !== (/^[RC]/.test(status) ? 2 : 1) || paths.some(path => !safePath(path))) throw new Error('Invalid or oversized changed path.')
    changes.push({ status, paths })
    if (changes.length > impactLimits.changes) throw new Error('Changed-record input limit exceeded; narrow the revision comparison.')
  }
  return changes
}

// These checks run before Git. Do not follow external gitdirs, object alternates,
// config includes or metadata symlinks while looking up committed source blobs.
async function localGitDirectory(repositoryRoot) {
  const actualRoot = await realpath(repositoryRoot)
  const gitDir = resolve(actualRoot, '.git')
  const metadata = await lstat(gitDir).catch(() => null)
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) throw new Error('Use a checkout root with its own local .git directory; linked worktrees and external gitdirs are unsupported.')
  let entries = 0
  async function inspect(path, recursive = false) {
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error })
    if (!info) return
    if (info.isSymbolicLink()) throw new Error('Git metadata symlinks are unsupported; no external metadata is read.')
    if (++entries > impactLimits.metadataEntries) throw new Error('Git metadata entry limit exceeded.')
    if (recursive && info.isDirectory()) for (const name of await readdir(path)) await inspect(resolve(path, name), true)
  }
  // Reflog expressions and pseudo-refs can reach logs/, ORIG_HEAD and other
  // administrative files. Inspect the complete local metadata tree so those
  // operands cannot bypass the symlink fence through an omitted directory.
  await inspect(gitDir, true)
  // Reject include sections before starting Git, whose repository discovery
  // can itself consult config. Git's own no-includes query below also checks
  // normalized key names. Worktree-specific config is refused conservatively.
  if (await lstat(resolve(gitDir, 'config.worktree')).catch(() => null)) throw new Error('Git worktree-specific configuration is unsupported.')
  const config = await lstat(resolve(gitDir, 'config')).catch(() => null)
  if (!config?.isFile() || config.size > 65_536) throw new Error('Git configuration is missing or exceeds its inspection limit.')
  if (/^\s*\[\s*include(?:if)?(?=[\s.\]])/mi.test(decode(await readFile(resolve(gitDir, 'config'))))) throw new Error('Git config includes are unsupported; no external configuration is read.')
  if (await lstat(resolve(gitDir, 'commondir')).catch(() => null)) throw new Error('Shared Git common directories are unsupported.')
  for (const name of ['alternates', 'http-alternates']) {
    if (await lstat(resolve(gitDir, 'objects/info', name)).catch(() => null)) throw new Error('Git object alternates are unsupported; objects must be available inside this checkout.')
  }
  return actualRoot
}

function isolatedEnvironment(env) {
  const child = { ...env }
  for (const key of Object.keys(child)) if (key.toUpperCase().startsWith('GIT_') || key.toUpperCase() === 'SSH_ASKPASS') delete child[key]
  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null'
  return { ...child, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: nullDevice, GIT_CONFIG_SYSTEM: nullDevice, GIT_GRAFT_FILE: nullDevice, GIT_NO_LAZY_FETCH: '1', GIT_ATTR_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '', GCM_INTERACTIVE: 'never', LC_ALL: 'C' }
}

function readCatalog(bytes) {
  let catalog
  try { catalog = JSON.parse(decode(bytes)) } catch { throw new Error('Committed catalog must be UTF-8 JSON.') }
  if (catalog?.schemaVersion !== 1 || catalog.project !== 'WebAppX' || catalog.intent !== 'proposed-backlog'
    || !Array.isArray(catalog.items) || !catalog.items.length || catalog.items.length > impactLimits.proposals) throw new Error('Expected a schema 1 WebAppX proposed-backlog catalog with 1 to 1,000 proposals.')
  const ids = new Set()
  for (const item of catalog.items) {
    if (typeof item?.id !== 'string' || !/^WX-\d{4}$/.test(item.id) || ids.has(item.id) || !['todo', 'done'].includes(item.status)
      || !safeScope(item.source)) throw new Error('Committed catalog requires unique proposal IDs, todo/done statuses and safe repository-relative source scopes.')
    ids.add(item.id)
  }
  return catalog
}

const stable = value => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  return value
}
const equivalent = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right))
const definition = item => Object.fromEntries(Object.entries(item).filter(([key]) => !['status', 'completion'].includes(key)))

function catalogDifference(before, after, limit) {
  const oldItems = new Map((before?.items ?? []).map(item => [item.id, item]))
  const newItems = new Map((after?.items ?? []).map(item => [item.id, item]))
  const metadata = []; const definitions = []
  for (const id of [...new Set([...oldItems.keys(), ...newItems.keys()])].sort()) {
    const old = oldItems.get(id); const current = newItems.get(id)
    if (!old || !current || !equivalent(definition(old), definition(current))) definitions.push(id)
    else if (!equivalent(old, current)) metadata.push(id)
  }
  const topLevelChanged = before && after && !equivalent(Object.fromEntries(Object.entries(before).filter(([key]) => key !== 'items')), Object.fromEntries(Object.entries(after).filter(([key]) => key !== 'items')))
  return {
    state: !before ? 'added' : !after ? 'deleted' : definitions.length ? 'proposal-definitions-changed' : metadata.length || topLevelChanged ? 'metadata-only' : 'unchanged',
    metadataChangedProposalCount: metadata.length, metadataChangedProposalIds: metadata.slice(0, limit), omittedMetadataProposalIds: Math.max(0, metadata.length - limit),
    definitionReviewRequired: definitions.length, definitionChangedProposalIds: definitions.slice(0, limit), omittedDefinitionProposalIds: Math.max(0, definitions.length - limit),
    topLevelMetadataChanged: Boolean(topLevelChanged), reviewRequired: definitions.length > 0,
    definitionIds: definitions,
  }
}

/** No workingtree/index source reads, fetches, record writes or task acceptance. */
export async function createImpactReport({ repositoryRoot = root, from, to, catalogRevision, catalogPath = defaultCatalogPath, limit = 50, changeLimit = 100, run = spawnSync, env = process.env } = {}) {
  if (!safeRevision(from) || !safeRevision(to) || (catalogRevision !== undefined && !safeRevision(catalogRevision))) throw new Error('Provide explicit --from and --to locally available commit revisions (and an optional explicit catalog revision).')
  if (!safeScope(catalogPath)) throw new Error('Catalog path must be a safe repository-relative committed file.')
  bounded(limit, impactLimits.displayedProposals, 'Proposal limit'); bounded(changeLimit, impactLimits.displayedChanges, 'Change limit')
  const cwd = await localGitDirectory(repositoryRoot)
  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null'
  const base = ['--no-optional-locks', '--no-replace-objects', '--git-dir=.git', `--work-tree=${cwd}`, '-c', 'protocol.allow=never', '-c', 'core.fsmonitor=false', '-c', `core.attributesFile=${nullDevice}`, '-c', `diff.orderFile=${nullDevice}`]
  const options = { cwd, env: isolatedEnvironment(env), shell: false, timeout: impactLimits.timeout, maxBuffer: impactLimits.gitBytes, windowsHide: true, encoding: 'buffer' }
  function git(label, args, { maximum = impactLimits.gitBytes, absent = false } = {}) {
    let result
    try { result = run('git', [...base, ...args], { ...options, maxBuffer: maximum }) } catch { throw new Error(`${label}: Git query failed.`) }
    if (result?.error?.code === 'ETIMEDOUT') throw new Error(`${label}: Git query timed out; no complete report is available.`)
    if (result?.error?.code === 'ENOBUFS' || (result?.stdout && Buffer.byteLength(result.stdout) > maximum)) throw new Error(`${label}: Git output limit exceeded; no complete report is available.`)
    if (absent && result?.status === 1 && !result.error && !result.signal) return null
    if (result?.error || result?.signal || result?.status !== 0 || !Buffer.isBuffer(result.stdout)) throw new Error(`${label}: Git query failed; require locally available objects and a supported checkout.`)
    return result.stdout
  }
  const unsafeConfig = git('Repository configuration policy', ['config', '--no-includes', '--local', '--name-only', '--get-regexp', '^(include|includeif)\\.|^extensions\\.(partialclone|worktreeconfig)$|^remote\\..*\\.promisor$'], { absent: true, maximum: 65_536 })
  if (unsafeConfig?.length) throw new Error('Git config includes, worktree-specific configuration and partial-clone promisor repositories are unsupported; this comparison is local only.')
  function revision(value, label) {
    const sha = decode(git(label, ['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`], { maximum: 1_024 })).trim()
    if (!shaPattern.test(sha)) throw new Error(`${label}: Git did not resolve a full commit SHA.`)
    return sha
  }
  const fromRevision = revision(from, 'From revision')
  const toRevision = revision(to, 'To revision')
  const catalogSha = catalogRevision === undefined ? toRevision : revision(catalogRevision, 'Catalog revision')
  const blobs = new Map()
  function blob(sha, path, { optional = false, maximum = impactLimits.catalogBytes } = {}) {
    const key = `${sha}:${path}`
    if (blobs.has(key)) return blobs.get(key)
    const entry = decode(git('Committed file lookup', ['ls-tree', '-z', sha, '--', path], { maximum: 8_192 }))
    if (!entry && optional) { blobs.set(key, null); return null }
    const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t([\s\S]+)\0$/.exec(entry)
    if (!match || match[3] !== path) throw new Error('Committed catalog or generated view must be a regular blob at the requested path; symlinks and directories are unsupported.')
    const bytes = git('Committed file read', ['cat-file', 'blob', match[2]], { maximum })
    blobs.set(key, bytes)
    return bytes
  }
  const catalogBytes = blob(catalogSha, catalogPath)
  const catalog = readCatalog(catalogBytes)
  const changes = parseNameStatus(git('Source tree comparison', ['diff', '--name-status', '-z', '--no-relative', '--find-renames=50%', '-l2000', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', fromRevision, toRevision, '--']))
  const allPaths = [...new Set(changes.flatMap(change => change.paths))].sort()
  const catalogChanged = allPaths.includes(catalogPath)
  let catalogChanges = { state: 'unchanged', metadataChangedProposalCount: 0, metadataChangedProposalIds: [], omittedMetadataProposalIds: 0, definitionReviewRequired: 0, definitionChangedProposalIds: [], omittedDefinitionProposalIds: 0, topLevelMetadataChanged: false, reviewRequired: false, definitionIds: [] }
  const excluded = new Map([[catalogPath, 'catalog']])
  if (catalogChanged) {
    const beforeBytes = blob(fromRevision, catalogPath, { optional: true })
    const afterBytes = blob(toRevision, catalogPath, { optional: true })
    const before = beforeBytes && readCatalog(beforeBytes); const after = afterBytes && readCatalog(afterBytes)
    catalogChanges = catalogDifference(before, after, limit)
    // Only verified exact generated companions of metadata-only edits are
    // suppressed. A hand-edited view remains an ordinary document scope change.
    if (catalogPath === defaultCatalogPath && catalogChanges.state === 'metadata-only') {
      let oldViews; let newViews
      try { oldViews = render(before); newViews = render(after) } catch { /* A minimal historical catalog need not support today's renderer. */ }
      if (oldViews && newViews) for (const [path, key] of [['docs/backlog/WEBAPPX-1000-TODO.md', 'markdown'], ['docs/backlog/webappx-1000-todo.csv', 'csv']]) {
        if (allPaths.includes(path)) {
          const oldView = blob(fromRevision, path, { optional: true }); const newView = blob(toRevision, path, { optional: true })
          if (oldView && newView && oldView.equals(Buffer.from(oldViews[key])) && newView.equals(Buffer.from(newViews[key]))) excluded.set(path, 'generated-catalog-metadata')
        }
      }
    }
  }
  const productPaths = allPaths.filter(path => !excluded.has(path))
  const affected = catalog.items.map(item => ({ item, matches: productPaths.filter(path => path === item.source || path.startsWith(`${item.source}/`)) })).filter(entry => entry.matches.length)
  const definitionIds = catalogChanges.definitionIds
  delete catalogChanges.definitionIds
  const reviewIds = new Set([...affected.map(entry => entry.item.id), ...definitionIds])
  const report = {
    schemaVersion: 1, intent: 'proposal-source-rebaseline-impact', fromRevision, toRevision,
    catalog: { path: catalogPath, revision: catalogSha, sha256: createHash('sha256').update(catalogBytes).digest('hex'), selection: catalogRevision === undefined ? 'to-revision' : 'explicit-revision' },
    counts: { proposals: catalog.items.length, changedRecords: changes.length, changedPaths: allPaths.length, productScopePaths: productPaths.length, scopeReviewRequired: affected.length, acceptedScopeReviewRequired: affected.filter(entry => entry.item.status === 'done').length, definitionReviewRequired: definitionIds.length, reviewRequired: reviewIds.size },
    changes: changes.slice(0, changeLimit).map(change => ({ ...change, paths: change.paths.map(path => ({ path, classification: excluded.get(path) ?? 'product-scope' })) })),
    proposals: affected.slice(0, limit).map(({ item, matches }) => ({ id: item.id, catalogStatus: item.status, referencedScopes: [item.source], matchedPaths: matches.slice(0, impactLimits.matchedPaths), omittedMatchedPaths: Math.max(0, matches.length - impactLimits.matchedPaths), reviewRequired: true })),
    catalogChanges,
    truncation: { omittedChangeRecords: Math.max(0, changes.length - changeLimit), omittedProposals: Math.max(0, affected.length - limit), omittedMatchedPaths: affected.slice(0, limit).reduce((sum, entry) => sum + Math.max(0, entry.matches.length - impactLimits.matchedPaths), 0), outputTruncated: changes.length > changeLimit || affected.length > limit || affected.slice(0, limit).some(entry => entry.matches.length > impactLimits.matchedPaths) || catalogChanges.omittedMetadataProposalIds > 0 || catalogChanges.omittedDefinitionProposalIds > 0 },
    limitations: [
      'Review requests are advisory. Canonical proposal status, completion dates, task ledgers and reusable seeds are never changed; accepted proposals can require review without reopening them.',
      'This compares the two resolved commit trees directly, not their merge base. The chosen committed catalog determines proposal membership and source scopes; another catalog revision can produce different matches.',
      'A source scope matches its exact path or descendants separated by /. Matching is lexical and case-sensitive, without following symlinks, opening scope files, inspecting submodule contents, or inferring semantic dependencies.',
      'Catalog definition edits request separate advisory review by ID. Status/completion edits and verified exact generated companion views are metadata; the raw changed-path records remain visible.',
      'Only local objects are used. No fetch, provider/network request, index/worktree substitution, build, acceptance check or deployment is performed. Input overflow, missing objects and unsupported metadata fail without a partial report.',
    ],
  }
  return report
}

export function formatImpactReport(report) {
  const lines = ['WebAppX proposal source rebaseline impact (schema 1)', `From: ${report.fromRevision}`, `To: ${report.toRevision}`, `Catalog: ${JSON.stringify(report.catalog.path)} at ${report.catalog.revision}`, `Catalog SHA-256: ${report.catalog.sha256}`, `Review required: ${report.counts.reviewRequired} proposals; ${report.counts.scopeReviewRequired} source-scope matches (${report.counts.acceptedScopeReviewRequired} accepted), ${report.counts.definitionReviewRequired} definition advisories.`, `Changed: ${report.counts.changedRecords} records / ${report.counts.changedPaths} paths / ${report.counts.productScopePaths} product scope paths.`, '']
  for (const change of report.changes) lines.push(`${change.status} ${change.paths.map(entry => `${JSON.stringify(entry.path)} [${entry.classification}]`).join(' -> ')}`)
  lines.push('', 'Source scopes requiring review:')
  for (const item of report.proposals) lines.push(`${item.id} (${item.catalogStatus}; review required) ${item.referencedScopes.map(value => JSON.stringify(value)).join(', ')}: ${item.matchedPaths.map(value => JSON.stringify(value)).join(', ')}${item.omittedMatchedPaths ? `; ${item.omittedMatchedPaths} more matches` : ''}`)
  lines.push('', `Catalog changes: ${report.catalogChanges.state}; definition review IDs: ${report.catalogChanges.definitionChangedProposalIds.join(', ') || 'none'}; metadata IDs: ${report.catalogChanges.metadataChangedProposalIds.join(', ') || 'none'}.`, `Truncation: ${JSON.stringify(report.truncation)}`, ...report.limitations.map(value => `- ${value}`))
  return `${lines.join('\n')}\n`
}

export function parseImpactArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const names = { '--from': 'from', '--to': 'to', '--catalog-revision': 'catalogRevision', '--catalog-path': 'catalogPath', '--limit': 'limit', '--change-limit': 'changeLimit' }
  const options = {}; const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (seen.has(flag)) throw new Error(`Repeated option: ${flag}`)
    seen.add(flag)
    if (flag === '--json') options.json = true
    else if (Object.hasOwn(names, flag) && args[index + 1] && !args[index + 1].startsWith('--')) {
      const value = args[++index]
      if (flag === '--limit' || flag === '--change-limit') {
        if (!/^\d+$/.test(value)) throw new Error('Display limits must be positive integers.')
        options[names[flag]] = bounded(Number(value), flag === '--limit' ? impactLimits.displayedProposals : impactLimits.displayedChanges, flag)
      } else options[names[flag]] = value
    } else throw new Error(`Unknown option or missing value: ${flag}`)
  }
  if (!safeRevision(options.from) || !safeRevision(options.to)) throw new Error('Both --from and --to explicit commit revisions are required.')
  return options
}

async function main() {
  const options = parseImpactArguments(process.argv.slice(2))
  if (options.help) { console.log('Usage: node scripts/backlog-impact.mjs --from REV --to REV [--catalog-revision REV] [--catalog-path PATH] [--limit 1..100] [--change-limit 1..200] [--json]\nRead-only local committed-tree comparison. Exit 0: complete advisory report, including review requests; exit 1: refused or incomplete comparison.'); return }
  const report = await createImpactReport(options)
  console.log(options.json ? JSON.stringify(report, null, 2) : formatImpactReport(report).trimEnd())
}
if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`Backlog rebaseline impact failed: ${error.message}`); process.exitCode = 1 })
