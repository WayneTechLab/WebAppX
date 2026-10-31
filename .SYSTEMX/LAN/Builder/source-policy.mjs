import { constants, closeSync, fstatSync, lstatSync, openSync, opendirSync, readSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

export const sourcePolicyLimits = Object.freeze({ maxBytes: 1_000_000, maxTextUnits: 500_000, maxDepth: 4, maxEntries: 4_000, maxResults: 500, maxHeaderBytes: 4_096 })
const activeRevision = 'source-access-v1'
const subsetRevision = 'source-pages-only-v1'
const extensions = Object.freeze(['.tsx', '.ts', '.css'])
const rules = Object.freeze([
  Object.freeze({ id: 'source-pages', pattern: 'src/pages/*.tsx', description: 'Direct app page source files.', expression: /^src\/pages\/[^/]+\.tsx$/ }),
  Object.freeze({ id: 'source-layout', pattern: 'src/components/layout/*.tsx', description: 'Direct layout component source files.', expression: /^src\/components\/layout\/[^/]+\.tsx$/ }),
  Object.freeze({ id: 'source-navigation', pattern: 'src/components/navigation/*.tsx', description: 'Direct navigation component source files.', expression: /^src\/components\/navigation\/[^/]+\.tsx$/ }),
  Object.freeze({ id: 'source-shell', pattern: 'src/components/shell/*.tsx', description: 'Direct shell component source files.', expression: /^src\/components\/shell\/[^/]+\.tsx$/ }),
  Object.freeze({ id: 'source-site-controls', pattern: 'src/config/siteControls.ts', description: 'Reviewed site controls source.', expression: /^src\/config\/siteControls\.ts$/ }),
  Object.freeze({ id: 'source-styles', pattern: 'src/index.css', description: 'App stylesheet and reviewed font import target.', expression: /^src\/index\.css$/ }),
  Object.freeze({ id: 'source-router', pattern: 'src/router.tsx', description: 'Reviewed app router source.', expression: /^src\/router\.tsx$/ }),
])
const policyRoots = ['src/pages', 'src/components/layout', 'src/components/navigation', 'src/components/shell', 'src/config', 'src']
const failure = (code, error, statusCode = 400) => ({ statusCode, code, error })
const failures = {
  invalid: () => failure('SOURCE_PATH_INVALID', 'Use an exact repository-relative path without traversal, links, encoded separators or absolute paths.'),
  policy: () => failure('SOURCE_POLICY_REFUSED', 'Source path is outside the active source policy allowlist.'),
  mismatch: () => failure('SOURCE_CASE_MISMATCH', 'Source path casing does not match the repository. Select the exact eligible path.'),
  ambiguous: () => failure('SOURCE_CASE_AMBIGUOUS', 'Source path has ambiguous case aliases and cannot be selected safely.'),
  linked: () => failure('SOURCE_LINK_REFUSED', 'Linked source files or linked parent directories are refused.'),
  regular: () => failure('SOURCE_NOT_REGULAR', 'Source selection must name a regular file inside the repository.'),
  unavailable: () => failure('SOURCE_UNAVAILABLE', 'Source is unavailable. Select an existing allowlisted source file, then reload before saving.', 404),
  size: () => failure('SOURCE_TOO_LARGE', 'Source exceeds the 1000000-byte or 500000-text-unit read limit; no partial content is available.', 413),
  encoding: () => failure('SOURCE_ENCODING_UNSUPPORTED', 'Source requires valid UTF-8 text without NUL bytes; the existing draft is preserved.', 415),
  generated: () => failure('SOURCE_GENERATED_READ_ONLY', 'Generated source is read-only under the active source policy.', 403),
  unavailablePolicy: () => failure('SOURCE_POLICY_UNKNOWN', 'Select an available reviewed source policy revision.'),
  directoryLimit: () => failure('SOURCE_DIRECTORY_LIMIT', 'Source directory exceeds the 4000-entry inspection budget; narrow the repository inventory before retrying.'),
}

export function isCanonicalSourcePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !/[%\\:\x00-\x20\x7f]/.test(value) && !value.startsWith('/')
    && value.split('/').every(part => part !== '.' && part !== '..' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))
}
function publicRule(rule) { return { id: rule.id, pattern: rule.pattern, description: rule.description } }
function rulesFor(revision) { return revision === activeRevision ? rules : revision === subsetRevision ? rules.slice(0, 1) : null }
export function sourcePolicyCatalog() {
  return {
    schemaVersion: 1, activeRevision, extensions: [...extensions], limits: { ...sourcePolicyLimits },
    rules: rules.map(publicRule),
    reviewedPolicies: [
      { revision: activeRevision, label: 'Current reviewed source policy', active: true, ruleIds: rules.map(rule => rule.id) },
      { revision: subsetRevision, label: 'Pages-only review proposal', active: false, ruleIds: ['source-pages'] },
    ],
    boundary: 'One selected repository; review and comparison never apply policy changes or authorize additional access.',
    generatedDetection: 'Recognized generated filenames or comment markers in the first 4096 bytes; headers are classified, never indexed or exported.',
    structuralEdits: false,
  }
}
function matchingRule(value, revision = activeRevision) { return rulesFor(revision)?.find(rule => rule.expression.test(value)) ?? null }

const sameEntry = (left, right) => left.ino === right.ino && left.dev === right.dev && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs
function directorySnapshot(target, cache) {
  let handle
  try {
    const before = lstatSync(target)
    if (before.isSymbolicLink()) return failures.linked()
    if (!before.isDirectory()) return failures.regular()
    const cached = cache?.get(target)
    if (cached && sameEntry(cached.entry, before)) return cached
    handle = opendirSync(target)
    const names = new Set(), aliases = new Map()
    while (true) {
      const child = handle.readSync()
      if (!child) break
      if (names.size >= sourcePolicyLimits.maxEntries) return failures.directoryLimit()
      names.add(child.name)
      const lower = child.name.toLowerCase()
      aliases.set(lower, (aliases.get(lower) ?? 0) + 1)
    }
    const after = lstatSync(target)
    if (!sameEntry(before, after)) return failures.unavailable()
    const result = { names, aliases, entry: after }
    cache?.set(target, result)
    return result
  } catch (error) { return error.code === 'ENOENT' ? failures.unavailable() : failures.regular() }
  finally { handle?.closeSync() }
}

// Resolve every component with exact casing before lstat/open. An inventory uses
// request-local directory-name snapshots, revalidated by directory identity and
// timestamps for every use. It never shares names or access across workspaces.
function checkPath(root, value, { directory = false, cache } = {}) {
  const parts = value.split('/')
  let target = resolve(root), lastEntry
  for (let index = 0; index < parts.length; index += 1) {
    const listing = directorySnapshot(target, cache)
    if (listing.error) return listing
    const aliasCount = listing.aliases.get(parts[index].toLowerCase()) ?? 0
    if (aliasCount > 1) return failures.ambiguous()
    if (!listing.names.has(parts[index])) return aliasCount ? failures.mismatch() : failures.unavailable()
    target = join(target, parts[index])
    let entry
    try { entry = lstatSync(target) } catch (error) { return error.code === 'ENOENT' ? failures.unavailable() : failures.regular() }
    if (entry.isSymbolicLink()) return failures.linked()
    if (index < parts.length - 1 || directory) {
      if (!entry.isDirectory()) return failures.regular()
    } else if (!entry.isFile()) return failures.regular()
    lastEntry = entry
  }
  return { target, entry: lastEntry }
}
function readBounded(fd, size) {
  const buffer = Buffer.alloc(size)
  let position = 0
  while (position < size) {
    const read = readSync(fd, buffer, position, size - position, position)
    if (!read) break
    position += read
  }
  return buffer.subarray(0, position)
}
function generatedSource(value, header) {
  return /(?:^|[._-])(?:generated|g|gen)\.[^.]+$/i.test(value.split('/').at(-1))
    || /(?:^|\r?\n)\s*(?:\/\/|\/\*|\*|<!--)\s*(?:@generated\b|auto[- ]generated\b|generated\s+(?:file|by|from)\b|do\s+not\s+edit\b)/i.test(header.toString('utf8'))
}
function metadataFor(value, entry, rule, generated) {
  const extension = extname(value)
  const readable = entry.size <= sourcePolicyLimits.maxBytes
  const writable = !generated && readable
  return {
    path: value, sizeBytes: entry.size, extension, origin: generated ? 'generated' : 'authored', readable, writable,
    writeKinds: writable ? ['source-text', ...(extension === '.tsx' ? ['literal-text'] : []), ...(value === 'src/index.css' ? ['font-imports'] : [])] : [],
    ruleId: rule.id, tags: [rule.id, generated ? 'generated' : 'authored', extension.slice(1)],
    reasonCode: !readable ? 'SOURCE_TOO_LARGE' : generated ? 'SOURCE_GENERATED_READ_ONLY' : null,
  }
}

/** Internal target/bytes are for server use; only metadata belongs in public DTOs. */
export function inspectSourcePath(root, value, options = {}) {
  return inspectSource(root, value, options)
}
function inspectSource(root, value, { read = false, forWrite = false, decodeText = true } = {}, cache) {
  if (!isCanonicalSourcePath(value)) return failures.invalid()
  const rule = matchingRule(value)
  if (!rule) return failures.policy()
  const checked = checkPath(root, value, { cache })
  if (checked.error) return checked
  const needsRead = read || forWrite
  // Metadata-only history may hash bounded raw bytes without decoding them.
  // This never grants content read or write authority; every write still decodes.
  const needsDecode = needsRead && (forWrite || decodeText !== false)
  let fd
  try {
    fd = openSync(checked.target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const entry = fstatSync(fd)
    if (!entry.isFile() || entry.ino !== checked.entry.ino || entry.dev !== checked.entry.dev) return failures.regular()
    if (needsRead && entry.size > sourcePolicyLimits.maxBytes) return failures.size()
    const bytes = needsRead ? readBounded(fd, Math.min(entry.size + 1, sourcePolicyLimits.maxBytes + 1)) : null
    if (bytes && bytes.length > sourcePolicyLimits.maxBytes) return failures.size()
    const header = bytes ? bytes.subarray(0, sourcePolicyLimits.maxHeaderBytes) : readBounded(fd, Math.min(entry.size, sourcePolicyLimits.maxHeaderBytes))
    const generated = generatedSource(value, header)
    const metadata = metadataFor(value, entry, rule, generated)
    if (forWrite && generated) return failures.generated()
    let content
    if (needsDecode) {
      try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { return failures.encoding() }
      if (content.includes('\0')) return failures.encoding()
      if (content.length > sourcePolicyLimits.maxTextUnits) return failures.size()
    }
    const fresh = checkPath(root, value, { cache })
    const after = fstatSync(fd)
    if (fresh.error) return fresh
    if (fresh.entry.ino !== entry.ino || fresh.entry.dev !== entry.dev || fresh.entry.size !== entry.size
      || after.size !== entry.size || after.mtimeMs !== entry.mtimeMs || after.ctimeMs !== entry.ctimeMs) return failures.unavailable()
    return { sourcePath: { normalized: value, target: checked.target }, metadata, ...(needsRead ? { bytes } : {}), ...(needsDecode ? { content } : {}) }
  } catch (error) {
    if (error.code === 'ENOENT') return failures.unavailable()
    if (error.code === 'ELOOP') return failures.linked()
    return failures.regular()
  } finally { if (fd !== undefined) closeSync(fd) }
}

function validQuery({ extension, search, limit }) {
  return (extension === '' || extensions.includes(extension)) && typeof search === 'string' && search.length <= 120 && !/[\x00-\x1f\x7f]/.test(search)
    && Number.isInteger(limit) && limit >= 1 && limit <= sourcePolicyLimits.maxResults
}

export function enumerateSourceInventory(root, options = {}) {
  return enumerateInventory(root, options, true)
}
function enumerateInventory(root, { workspaceId, extension = '', search = '', limit = 200 } = {}, inspectHeaders) {
  if (!validQuery({ extension, search, limit })) return failure('SOURCE_QUERY_INVALID', 'Choose a supported extension, a bounded metadata search, and a result limit from 1 through 500.')
  const counts = { examinedEntries: 0, eligibleFiles: 0, matchingFiles: 0, returnedFiles: 0 }
  const omissions = { resultLimit: 0, entryBudget: 0, depthBudget: 0, linked: 0, unavailable: 0, nonRegular: 0, policyRefused: 0 }
  const files = []
  const cache = new Map()
  let stopped = false
  for (const directory of policyRoots) {
    if (stopped) break
    if (directory.split('/').length + 1 > sourcePolicyLimits.maxDepth) { omissions.depthBudget += 1; continue }
    const checked = checkPath(root, directory, { directory: true, cache })
    if (checked.error) {
      if (checked.code === 'SOURCE_DIRECTORY_LIMIT') { omissions.entryBudget = 1; stopped = true }
      else if (checked.code === 'SOURCE_LINK_REFUSED') omissions.linked += 1
      else if (checked.code !== 'SOURCE_UNAVAILABLE') omissions.unavailable += 1
      continue
    }
    let handle
    try {
      handle = opendirSync(checked.target)
      const candidates = []
      while (true) {
        const entry = handle.readSync()
        if (!entry) break
        if (counts.examinedEntries >= sourcePolicyLimits.maxEntries) { omissions.entryBudget = 1; stopped = true; break }
        counts.examinedEntries += 1
        candidates.push(entry)
      }
      // With an incomplete directory scan, exact case aliases cannot be ruled
      // out. Report the budget boundary rather than treating any row as safe.
      if (stopped) continue
      for (const entry of candidates) {
        const path = `${directory}/${entry.name}`
        if (!isCanonicalSourcePath(path) || !matchingRule(path)) { omissions.policyRefused += 1; continue }
        if (entry.isSymbolicLink()) { omissions.linked += 1; continue }
        if (!entry.isFile()) { omissions.nonRegular += 1; continue }
        const checkedFile = inspectHeaders ? null : checkPath(root, path, { cache })
        const inspection = inspectHeaders ? inspectSource(root, path, {}, cache) : checkedFile.error ? checkedFile : { metadata: metadataFor(path, checkedFile.entry, matchingRule(path), generatedSource(path, Buffer.alloc(0))) }
        if (inspection.error) { omissions.unavailable += 1; continue }
        counts.eligibleFiles += 1
        const file = inspection.metadata
        if (extension && file.extension !== extension) continue
        if (search && !`${file.path} ${file.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())) continue
        counts.matchingFiles += 1
        files.push(file)
      }
    } catch { omissions.unavailable += 1 } finally { handle?.closeSync() }
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  omissions.resultLimit = Math.max(0, files.length - limit)
  const selectedFiles = files.slice(0, limit)
  counts.returnedFiles = selectedFiles.length
  const truncated = Boolean(omissions.resultLimit || omissions.entryBudget || omissions.depthBudget)
  const complete = !truncated && omissions.unavailable === 0
  return {
    schemaVersion: 1, workspaceId, policyRevision: activeRevision, extensions: [...extensions], files: selectedFiles,
    limits: { ...sourcePolicyLimits, requestedResults: limit }, counts, omissions,
    omitted: omissions.resultLimit + omissions.entryBudget + omissions.depthBudget + omissions.unavailable, truncated, complete,
    notice: omissions.entryBudget ? 'Entry budget reached; additional eligible files may be omitted.' : omissions.resultLimit ? `${omissions.resultLimit} matching files omitted by the result limit.` : omissions.unavailable ? 'Some source locations could not be inspected; a missing inventory row does not establish source deletion.' : 'Eligible inventory complete within declared directory scope.',
  }
}

export function compareSourcePolicies(root, { workspaceId, fromRevision = activeRevision, toRevision = subsetRevision, selection = '' } = {}) {
  const from = rulesFor(fromRevision), to = rulesFor(toRevision)
  if (!from || !to) return failures.unavailablePolicy()
  if (selection && !isCanonicalSourcePath(selection)) return failures.invalid()
  const inventory = enumerateInventory(root, { workspaceId, limit: sourcePolicyLimits.maxResults }, false)
  const before = new Set(from.map(rule => rule.id)), after = new Set(to.map(rule => rule.id))
  const addedRules = to.filter(rule => !before.has(rule.id)).map(publicRule)
  const removedRules = from.filter(rule => !after.has(rule.id)).map(publicRule)
  const affectedPaths = { added: [], removed: [] }
  for (const file of inventory.files) {
    const was = Boolean(matchingRule(file.path, fromRevision)), becomes = Boolean(matchingRule(file.path, toRevision))
    if (!was && becomes) affectedPaths.added.push(file.path)
    if (was && !becomes) affectedPaths.removed.push(file.path)
  }
  return {
    schemaVersion: 1, workspaceId, activeRevision, fromRevision, toRevision, mode: 'review-only', applied: false,
    addedRules, removedRules, affectedPaths,
    selectionLosesEligibility: Boolean(selection && matchingRule(selection, fromRevision) && !matchingRule(selection, toRevision)),
    complete: inventory.complete, truncated: inventory.truncated, limits: inventory.limits,
    notice: inventory.complete ? 'Exact affected paths in the current eligible inventory; this review changes no policy or source.' : 'Inventory is incomplete; affected paths are partial. No policy change can be applied from this review.',
  }
}
