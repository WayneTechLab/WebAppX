// Source navigation contains public picker metadata only. It grants no read or
// write authority: the server rechecks every operation against its active policy.
export const sourceNavigationLimits = Object.freeze({ path: 512, search: 120, serialized: 1200, files: 500, tags: 12 })
export const sourceExtensions = Object.freeze(['.tsx', '.ts', '.css'])
const sourceRules = [
  /^src\/pages\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/components\/(?:layout|navigation|shell)\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/config\/siteControls\.ts$/,
  /^src\/index\.css$/,
  /^src\/router\.tsx$/,
]
const revision = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value)
const safeTag = value => typeof value === 'string' && value.length <= 64 && !/[\p{Cc}\p{Cs}]/u.test(value) && /^[a-z][a-z0-9-]{0,63}$/.test(value)
const text = value => typeof value === 'string' && value.length <= sourceNavigationLimits.search && !/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(value)
const privateMarker = /-----BEGIN|AIza[0-9A-Za-z_-]{20,}|sk_(?:live|test)_|(?:password|secret|token|privateKey)\s*[:=]/i
const fail = () => { throw new TypeError('SOURCE_NAVIGATION_INVALID: public source navigation metadata is invalid.') }

export function canonicalSourcePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= sourceNavigationLimits.path
    && !/[\p{Cc}\p{Cs}\\%?#\u2028\u2029]/u.test(value)
    && value.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))
    && sourceRules.some(rule => rule.exec(value)?.[0] === value)
}

export function sourceNavigationKey(workspaceId) {
  if (!revision(workspaceId)) fail()
  return `systemx.lan.source-navigation.v1.${workspaceId}`
}

export function createSourceNavigation({ workspaceId, path = '', extension = '', search = '' }) {
  if (!revision(workspaceId) || (path !== '' && !canonicalSourcePath(path)) || (extension !== '' && !sourceExtensions.includes(extension)) || !text(search) || privateMarker.test(search)) fail()
  return { schemaVersion: 1, workspaceId, path, extension, search }
}

export function parseSourceNavigation(serialized, workspaceId) {
  if (typeof serialized !== 'string' || serialized.length > sourceNavigationLimits.serialized) fail()
  let value
  try { value = JSON.parse(serialized) } catch { fail() }
  const keys = ['schemaVersion', 'workspaceId', 'path', 'extension', 'search']
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)) || value.schemaVersion !== 1 || value.workspaceId !== workspaceId) fail()
  return createSourceNavigation(value)
}

export function publicSourceMetadata(file) {
  if (!file || !canonicalSourcePath(file.path) || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0
    || !sourceExtensions.includes(file.extension) || !file.path.endsWith(file.extension)
    || !['authored', 'generated'].includes(file.origin) || typeof file.writable !== 'boolean' || typeof file.readable !== 'boolean' || (file.origin === 'generated' && file.writable)
    || !safeTag(file.ruleId) || !Array.isArray(file.tags) || file.tags.length > sourceNavigationLimits.tags || !file.tags.every(safeTag)
    || !Array.isArray(file.writeKinds) || file.writeKinds.length > 5 || !file.writeKinds.every(safeTag)
    || (file.reasonCode !== null && file.reasonCode !== undefined && (typeof file.reasonCode !== 'string' || file.reasonCode.length > 67 || /[\p{Cc}\p{Cs}]/u.test(file.reasonCode) || !/^SOURCE_[A-Z_]{1,60}$/.test(file.reasonCode)))) fail()
  return { path: file.path, sizeBytes: file.sizeBytes, extension: file.extension, origin: file.origin,
    writable: file.writable, readable: file.readable, writeKinds: [...file.writeKinds], ruleId: file.ruleId,
    tags: [...file.tags], reasonCode: file.reasonCode ?? null }
}

export function parseSourceInventory(value, workspaceId) {
  if (!value || value.schemaVersion !== 1 || value.workspaceId !== workspaceId || !revision(workspaceId)
    || !safeTag(value.policyRevision) || !Array.isArray(value.files) || value.files.length > sourceNavigationLimits.files
    || typeof value.complete !== 'boolean' || typeof value.truncated !== 'boolean' || (value.complete && value.truncated)) fail()
  const files = value.files.map(publicSourceMetadata)
  if (new Set(files.map(file => file.path)).size !== files.length) fail()
  // Deliberately pick finite public fields; an unexpected server field such as a
  // root, token, body or environment value never enters a download or storage.
  const limits = {}
  for (const key of ['maxBytes', 'maxTextUnits', 'maxDepth', 'maxEntries', 'maxResults', 'maxHeaderBytes']) {
    if (!Number.isSafeInteger(value.limits?.[key]) || value.limits[key] < 1 || value.limits[key] > 10000000) fail()
    limits[key] = value.limits[key]
  }
  const numbers = (record, fields) => {
    const result = {}
    for (const key of fields) {
      if (!Number.isSafeInteger(record?.[key]) || record[key] < 0 || record[key] > 10000000) fail()
      result[key] = record[key]
    }
    return result
  }
  const omissions = numbers(value.omissions, ['resultLimit', 'entryBudget', 'depthBudget', 'linked', 'unavailable', 'nonRegular', 'policyRefused'])
  if (value.complete && omissions.unavailable > 0) fail()
  return { schemaVersion: 1, workspaceId, policyRevision: value.policyRevision, extensions: [...sourceExtensions],
    files, limits, counts: numbers(value.counts, ['examinedEntries', 'eligibleFiles', 'matchingFiles', 'returnedFiles']), omissions,
    complete: value.complete, truncated: value.truncated }
}

export function filterSourceMetadata(files, { extension = '', search = '' } = {}) {
  if ((extension && !sourceExtensions.includes(extension)) || !text(search)) fail()
  const query = search.trim().toLocaleLowerCase('en-US')
  return files.filter(file => (!extension || file.extension === extension)
    && (!query || `${file.path} ${file.tags.join(' ')}`.toLocaleLowerCase('en-US').includes(query)))
}

export function sourcePickerSelection(previous, loaded, inventory, visibleFiles) {
  const known = new Set(inventory.files.map(file => file.path))
  const visible = new Set(visibleFiles.map(file => file.path))
  // Complete inventory is required to establish absence. A filter is never an
  // invalidation, and an omitted loaded source is retained in the editor.
  if (previous && (known.has(previous) || !inventory.complete || inventory.omissions.unavailable > 0)) return { path: previous, retained: !visible.has(previous), absent: false }
  if (previous) return { path: '', retained: false, absent: true }
  if (loaded && known.has(loaded)) return { path: '', retained: false, absent: false }
  return { path: '', retained: false, absent: false }
}
