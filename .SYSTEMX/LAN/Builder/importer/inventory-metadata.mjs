import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import { isCanonicalSourcePath } from '../source-policy.mjs'
import { publicPattern } from './declared-routes.mjs'
import { validComponentInventory } from './component-inventory.mjs'
import { configurationInputPaths, validInventoryConfig } from './inventory-config.mjs'

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const exact = (o, keys) => o !== null && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k))
const list = (v, max) => Array.isArray(v) && v.length <= max
const privateName = /private|secret|credential|password|api[._-]?key|access[._-]?token|(?:^|[^a-z])(?:tokens?|keys?)(?:[^a-z]|$)|gh[pousr]_|github_pat_|sk_live_|AKIA[0-9A-Z]/i
const config = new Set([...configurationInputPaths, 'tsconfig.json'])
const hostMarkers = new Set(['.SYSTEMX/INSTALLATION.json', '.SYSTEMX/LAN/Builder/contracts/capability-manifest.json', '.SYSTEMX/LAN/Website_Dashboard.html'])
const managedMarker = /^\.SYSTEMX\/\.systemx\/releases\/\d{1,3}\.\d{1,3}\.\d{1,3}(?:-(?:alpha|beta|rc)\.\d{1,3})?\/(?:STANDARD|START-HERE)\.md$/
const mime = new Map(Object.entries({
  '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
}))
const limits = Object.freeze({ extraResources: 200, sourceResources: 160, conflicts: 100, references: 64, selected: 32 })
const sourcePath = path => typeof path === 'string' && !privateName.test(path) && (config.has(path) || isCanonicalSourcePath(path)
  && (/^src\/.*\.(?:[jt]sx?|mjs|html)$/.test(path) || /^[^/]+\.html$/.test(path)))
const lineNumber = n => Number.isSafeInteger(n) && n > 0 && n <= 256000
const componentName = name => typeof name === 'string' && /^[A-Za-z_$][A-Za-z_$0-9]{0,79}$/.test(name) && !privateName.test(name)

function assetType(path) {
  if (!isCanonicalSourcePath(path) || !path.startsWith('public/') || privateName.test(path)
    || /(?:^|\/)(?:vendor|node_modules|runtime|state|uploads?|backups?|temp|drafts?)(?:\/|$)/i.test(path)) return null
  return path === 'public/robots.txt' ? 'text/plain' : mime.get(posix.extname(path).toLowerCase()) ?? null
}

function owner(path) {
  if (hostMarkers.has(path)) return 'host-extension'
  if (typeof path === 'string' && managedMarker.test(path)) return 'managed-release'
  return 'repository'
}

export const isInventoryMetadataPath = path => owner(path) !== 'repository' || Boolean(assetType(path))

// Rule IDs are part of the portable format. Lists with mixed rules carry an
// aligned rule ID per row. Uniform lists share one rule ID for all members.
const rules = Object.freeze({
  'vite-input': ['vite-entry', 'literal'], 'vite-convention': ['vite-entry', 'inferred'],
  route: ['react-route-declaration', 'literal'], component: ['typescript-component-export', 'literal'],
  shell: ['jsx-role-and-route-usage', 'inferred'], configuration: ['static-project-configuration', 'field-specific'],
  package: ['package-declaration', 'literal'], pin: ['runtime-pin', 'literal'], vite: ['vite-static-config', 'literal'],
  'vite-default': ['vite-static-config', 'inferred'], 'vite-unresolved': ['vite-static-config', 'unresolved'],
  firebase: ['firebase-manifest', 'literal'],
  file: ['git-index-and-worktree', 'observed'], asset: ['public-file-stat', 'observed'],
  ownership: ['systemx-directory-ownership', 'inferred'], conflict: ['declaration-conflicts', 'unresolved'],
  scan: ['tracked-repository-inventory', 'unresolved'],
})
function findingRule(code) {
  if (/^inventory-(?:route|page|component)-conflict$/.test(code)) return 'conflict'
  if (/component|shell/.test(code)) return 'component'
  if (/route/.test(code)) return 'route'
  if (/entry|html/.test(code)) return 'vite-input'
  if (/firebase/.test(code)) return 'firebase'
  if (/package|dependency/.test(code)) return 'package'
  if (/runtime/.test(code)) return 'pin'
  if (/vite|build|bridge|target|proxy/.test(code)) return 'vite-unresolved'
  if (/config/.test(code)) return 'configuration'
  return 'scan'
}
function provenance(entries, findings) {
  return { ruleVersion: 1, rules: Object.fromEntries(Object.entries(rules).map(([key, [adapter, basis]]) => [key, { adapter, basis }])),
    entryPoints: entries.map(row => row.state === 'inferred' ? 'vite-convention' : 'vite-input'),
    routes: 'route', componentExports: 'component', sharedShells: 'shell', configuration: 'configuration',
    configurationFields: { dependencies: 'package', runtimePins: 'pin', firebase: 'firebase',
      buildTargets: { declared: 'vite', disabled: 'vite', inferred: 'vite-default', unresolved: 'vite-unresolved' },
      bridges: 'vite' },
    sourceResources: 'file', publicAssets: 'asset', publicAssetScope: 'reviewed tracked public/ filenames; serving and rendering unobserved',
    ownership: 'ownership', conflicts: 'conflict',
    revisionBasis: { source: 'sha256-working-source-bytes', metadataOnly: 'git-index-oid-and-working-size-and-file-times' },
    ownershipBoundaries: { repository: 'review-before-effect', 'host-extension': 'host-owner-review', 'managed-release': 'immutable-upstream-snapshot' },
    findings: findings.map(row => findingRule(row.code)) }
}

function sourceResource(row) {
  return { path: row.path, owner: 'repository', kind: 'source', revision: row.sha256, indexOid: row.indexOid }
}

function inspectResource(path, indexOid, statFor) {
  const stat = statFor(path)
  if (!stat || typeof stat.isFile === 'function' && (!stat.isFile() || Number(stat.nlink) !== 1)) return null
  const size = Number(stat.size)
  const clock = value => typeof value === 'bigint' || Number.isSafeInteger(value)
  if (!Number.isSafeInteger(size) || size < 0 || !clock(stat.mtimeNs) || !clock(stat.ctimeNs)) return null
  // This fingerprint covers index identity and observed metadata. It is not a
  // content hash of the working asset; the scanner never opens asset bodies.
  const revision = hash([indexOid, size, String(stat.mtimeNs), String(stat.ctimeNs)])
  const ownership = owner(path)
  return ownership === 'repository'
    ? { path, owner: ownership, kind: 'public-asset', revision, indexOid, bytes: size, mediaType: assetType(path), rendering: 'not-observed' }
    : { path, owner: ownership, kind: 'ownership-marker', revision, indexOid }
}

function conflictsFor(routes, exports, issue) {
  const groups = new Map()
  function record(kind, key, ref) {
    const id = kind + '\0' + key
    if (!groups.has(id)) groups.set(id, { kind, key, refs: [] })
    groups.get(id).refs.push(ref)
  }
  for (const row of routes) {
    if (!publicPattern(row.pattern) || !sourcePath(row.source) || !sourcePath(row.declaredIn) || !lineNumber(row.line)) continue
    record('route', row.pattern, { path: row.declaredIn, line: row.line, target: row.source })
  }
  for (const row of exports) {
    if (!sourcePath(row.source) || !componentName(row.name) || !lineNumber(row.exportLine)) continue
    record('component', row.source + '#' + row.name, { path: row.source, line: row.exportLine })
  }
  const conflicts = []
  for (const { kind, key, refs } of groups.values()) {
    if (refs.length < 2) continue
    function add(type) {
      issue('inventory-' + type + '-conflict', refs[0].path, refs[0].line)
      if (conflicts.length >= limits.conflicts) return
      conflicts.push({ kind: type, key, references: refs.slice(0, limits.references), omittedReferences: Math.max(0, refs.length - limits.references) })
    }
    add(kind)
    if (kind === 'route' && new Set(refs.map(row => row.target)).size > 1) add('page')
  }
  return conflicts
}

export function inspectInventoryMetadata({ index, statFor, evidence, entryPoints, routes, components, findings, routeDeclarations = routes, componentDeclarations = components.exports, issue }) {
  const evidenceCount = evidence instanceof Map ? evidence.size : evidence?.length
  if (!(index instanceof Map) || index.size > 16000 || !Number.isInteger(evidenceCount) || evidenceCount > limits.sourceResources
    || !list(entryPoints, 32) || !list(routes, 300) || !list(routeDeclarations, 300) || !list(components?.exports, 600) || !list(componentDeclarations, 1200) || !list(findings, 100)) {
    throw Object.assign(new Error('Inventory metadata input exceeded its bounded scan scope.'), { inventoryCode: 'inventory-metadata-input-limit' })
  }
  const resources = [...evidence.values()].map(sourceResource)
  let selected = 0, omittedResources = 0
  for (const [path, indexOid] of index) {
    if (!isInventoryMetadataPath(path)) continue
    if (++selected > limits.extraResources) { omittedResources++; continue }
    const resource = oid(indexOid) ? inspectResource(path, indexOid, statFor) : null
    if (resource) resources.push(resource)
    else { omittedResources++; issue('inventory-resource-unavailable', path) }
  }
  if (selected > limits.extraResources) issue('inventory-resource-limit')
  const conflicts = conflictsFor(routeDeclarations, componentDeclarations, issue)
  resources.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { resources, omittedResources, conflicts, provenance: provenance(entryPoints, findings) }
}

// Recheck index-qualified stat observations without rereading public asset data
// or rerunning the conflict reporter. Source bytes have their own scanner check.
export function inventoryResourceStatsMatch(metadata, index, statFor) {
  return list(metadata?.resources, limits.sourceResources + limits.extraResources) && metadata.resources.every(row => {
    if (row.kind === 'source') return true
    if (!isInventoryMetadataPath(row.path) || !oid(index.get(row.path))) return false
    return same(row, inspectResource(row.path, index.get(row.path), statFor))
  })
}

export function validInventoryMetadata(metadata, snapshot) {
  if (!exact(metadata, ['resources', 'omittedResources', 'conflicts', 'provenance']) || !list(metadata.resources, limits.sourceResources + limits.extraResources)
    || !Number.isInteger(metadata.omittedResources) || metadata.omittedResources < 0 || metadata.omittedResources > 16000
    || !list(metadata.conflicts, limits.conflicts) || !list(snapshot?.evidence, limits.sourceResources)
    || snapshot.evidence.some(row => !row || !sourcePath(row.path) || !digest(row.sha256) || !oid(row.indexOid))
    || !list(snapshot.entryPoints, 32) || !list(snapshot.findings, 100)
    || snapshot.entryPoints.some(row => !row || !['explicit','inferred'].includes(row.state))
    || snapshot.findings.some(row => !row || typeof row.code !== 'string' || row.code.length > 96)) return false
  if (snapshot.complete && (metadata.conflicts.length || metadata.omittedResources)) return false
  if (!same(metadata.provenance, provenance(snapshot.entryPoints, snapshot.findings))) return false
  const proof = new Map(snapshot.evidence.map(row => [row.path, row])), seen = new Set()
  for (const row of metadata.resources) {
    if (!row || seen.has(row.path) || !digest(row.revision) || !oid(row.indexOid) || row.owner !== owner(row.path)) return false
    seen.add(row.path)
    if (row.kind === 'source') {
      if (!sourcePath(row.path) || !proof.has(row.path) || !same(row, sourceResource(proof.get(row.path)))) return false
      proof.delete(row.path)
    } else if (row.kind === 'public-asset') {
      if (!exact(row, ['path','owner','kind','revision','indexOid','bytes','mediaType','rendering']) || !assetType(row.path)
        || row.mediaType !== assetType(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.rendering !== 'not-observed') return false
    } else if (row.kind !== 'ownership-marker' || row.owner === 'repository' || !exact(row, ['path','owner','kind','revision','indexOid'])) return false
  }
  return proof.size === 0 && metadata.conflicts.every(row => {
    if (!exact(row, ['kind','key','references','omittedReferences']) || !Number.isInteger(row.omittedReferences) || row.omittedReferences < 0 || row.omittedReferences > 1200
      || !list(row.references, limits.references) || row.references.length < 2) return false
    if (row.kind === 'component') {
      const [path, name, ...rest] = typeof row.key === 'string' ? row.key.split('#') : []
      return !rest.length && sourcePath(path) && componentName(name) && row.references.every(ref => exact(ref, ['path','line']) && ref.path === path && lineNumber(ref.line))
    }
    return ['route','page'].includes(row.kind) && publicPattern(row.key) && row.references.every(ref => exact(ref, ['path','line','target'])
      && sourcePath(ref.path) && sourcePath(ref.target) && lineNumber(ref.line))
  })
}

const refuse = code => ({ status: 'refused', code })
const exclusions = ['outsideSourceScope', 'privateOrNoncanonical', 'nonregularIndex']
function verified(snapshot) {
  if (snapshot?.schemaVersion !== 4 || snapshot.complete !== true || !digest(snapshot.checkoutId) || !oid(snapshot.commit)
    || !digest(snapshot.indexRevision) || !digest(snapshot.revision) || !validInventoryMetadata(snapshot.metadata, snapshot)
    || snapshot.findings.length || snapshot.omittedFindings !== 0 || !list(snapshot.routes, 300) || !snapshot.exclusions || !exclusions.every(key => Number.isInteger(snapshot.exclusions[key])
      && snapshot.exclusions[key] >= 0 && snapshot.exclusions[key] <= 16000)) return false
  const { revision, ...contents } = snapshot
  if (revision !== hash(contents) || !validComponentInventory(snapshot.components, snapshot.evidence, snapshot.routes)
    || !validInventoryConfig(snapshot.configuration, snapshot.evidence)) return false
  const sources = new Set(snapshot.evidence.map(ref => ref.path))
  return snapshot.routes.every(row => exact(row, ['state','pattern','source','declaredIn','line']) && row.state === 'explicit'
    && publicPattern(row.pattern) && sources.has(row.source) && sources.has(row.declaredIn) && lineNumber(row.line))
    && snapshot.entryPoints.every(row => {
      if (row?.state === 'inferred') return exact(row, ['state','source','basis']) && row.basis === 'vite-entry-convention'
        && /^src\/(?:main|index)\.(?:tsx?|jsx?|mjs)$/.test(row.source) && sources.has(row.source)
      const keys = ['state','source','declaredIn','line']
      if (row?.configuration !== undefined) keys.push('configuration')
      return exact(row, keys) && row.state === 'explicit' && sources.has(row.source) && sources.has(row.declaredIn) && lineNumber(row.line)
        && (!row.configuration || exact(row.configuration, ['path','line']) && sources.has(row.configuration.path) && lineNumber(row.configuration.line))
    })
}

export function exportInventoryMetadata(snapshot) {
  if (!verified(snapshot)) return refuse('current-complete-inventory-required')
  const { checkoutId, commit, indexRevision, revision, entryPoints, routes, components, configuration, metadata } = snapshot
  // Retained snapshots can acquire private/UI fields in later versions. Select
  // public top-level fields and strictly validate nested domain contracts.
  const artifact = {
    format: 'webappx-repository-inventory', formatVersion: 1, checkoutId, commit, indexRevision, inventoryRevision: revision,
    entryPoints, routes, components, configuration, resources: metadata.resources, provenance: metadata.provenance,
    exclusions: Object.fromEntries(exclusions.map(key => [key, snapshot.exclusions[key]])),
  }
  return { status: 'exported', artifact: structuredClone(artifact) }
}

function proposalFacts(snapshot, paths) {
  const depends = new Set(paths)
  const entries = snapshot.entryPoints.filter(row => paths.has(row.source) || paths.has(row.declaredIn) || paths.has(row.configuration?.path))
  const routes = snapshot.routes.filter(row => paths.has(row.source) || paths.has(row.declaredIn))
  for (const row of [...entries, ...routes]) {
    depends.add(row.source)
    if (row.declaredIn) depends.add(row.declaredIn)
    if (row.configuration) depends.add(row.configuration.path)
  }
  const components = snapshot.components.exports.filter(row => paths.has(row.source))
  const shells = snapshot.components.shellSources.filter(row => paths.has(row.source) || row.usedBy.some(use => paths.has(use.pageSource) || use.trace.some(step => paths.has(step.source))))
  for (const shell of shells) {
    depends.add(shell.source)
    for (const use of shell.usedBy) {
      depends.add(use.pageSource)
      for (const step of use.trace) depends.add(step.source)
    }
  }
  return hash({ entries, routes, components, shells, resources: snapshot.metadata.resources.filter(row => depends.has(row.path)) })
}

export function revalidateInventoryProposal(previous, fresh, { paths } = {}) {
  if (!verified(previous) || !verified(fresh)) return refuse('current-complete-inventory-required')
  if (previous.checkoutId !== fresh.checkoutId) return refuse('checkout-mismatch')
  if (!list(paths, limits.selected) || !paths.length || new Set(paths).size !== paths.length) return refuse('choose-distinct-inventory-resources')
  const before = new Map(previous.metadata.resources.map(row => [row.path, row]))
  const after = new Set(fresh.metadata.resources.map(row => row.path))
  for (const path of paths) {
    const row = before.get(path)
    if (!row) return refuse('resource-outside-proposal-inventory')
    if (row.owner !== 'repository') return refuse('ownership-review-required')
    if (!after.has(path)) return refuse('resource-changed-rescan-required')
  }
  const selected = new Set(paths)
  if (proposalFacts(previous, selected) !== proposalFacts(fresh, selected)) return refuse('resource-changed-rescan-required')
  return { status: 'revalidated', checkoutId: fresh.checkoutId, previousRevision: previous.revision, observedRevision: fresh.revision,
    paths: [...selected].sort(), authority: 'metadata-review-only' }
}
