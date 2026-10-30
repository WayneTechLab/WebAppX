import { compareSourceText, sourceComparisonLimits } from './source-comparison.js'

// UTF-16 code-unit budgets, including the serialized JSON budgets. These DTOs
// carry text only; callers own hashing, workspace identity, storage and download.
export const sourceRecordLimits = Object.freeze({
  characters: 500000,
  pathCharacters: 512,
  serializedRecovery: 2100000,
  serializedExport: 2500000,
  historyEntries: 30,
})

const recoveryFields = ['schemaVersion', 'workspaceId', 'path', 'baseRevision', 'baselineContent', 'draftDisplay', 'draftDigest', 'storedAt']
const exportFields = ['schemaVersion', 'path', 'loadedRevision', 'currentRevision', 'draftRevision', 'draftContent', 'currentContent', 'comparison']
const comparisonFields = ['algorithm', 'algorithmLabel', 'equal', 'complete', 'changedBlockCount', 'rows', 'counts', 'reasons', 'truncated']
const countFields = ['changedRows', 'shownRows', 'omittedRows', 'inspectedDraftCharacters', 'inspectedCurrentCharacters', 'inspectedDraftLines', 'inspectedCurrentLines', 'uninspectedDraftCharacters', 'uninspectedCurrentCharacters', 'textTruncatedRows']
const rowFields = ['draftLine', 'currentLine', 'draftText', 'currentText', 'draftEnding', 'currentEnding', 'kind', 'draftTextTruncated', 'currentTextTruncated', 'draftLinePartial', 'currentLinePartial']
const algorithm = 'common-prefix-suffix-positional'
const algorithmLabel = 'Positional lines after common prefix/suffix trimming; not a minimal edit diff.'
const endingNames = new Set(['LF', 'CRLF', 'CR', 'none', 'unknown'])
const maximumReasons = 6
const maximumReasonCharacters = 400
const sourcePaths = [
  /^src\/pages\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/components\/(?:layout|navigation|shell)\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/config\/siteControls\.ts$/,
  /^src\/index\.css$/,
  /^src\/router\.tsx$/,
]
const secretMarkers = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /AIza[0-9A-Za-z_-]{20,}/,
  /sk_(?:live|test)_[0-9A-Za-z]+/i,
  /(?:password|secret|token|privateKey)\s*[:=]\s*['"][^'"]{8,}/i,
  /['"](?:password|secret|token|privateKey)['"]\s*:\s*['"][^'"]{8,}/i,
]

function refuse(code = 'SOURCE_RECORD_INVALID') {
  const messages = {
    SOURCE_RECORD_INVALID: 'Source record is malformed or contains unsupported fields.',
    SOURCE_RECORD_TOO_LARGE: 'Source record exceeds a local size limit.',
    SOURCE_RECORD_PRIVATE: 'Source record contains a screened private marker.',
    SOURCE_RECORD_WORKSPACE: 'Source record belongs to a different workspace.',
  }
  const error = new TypeError(messages[code])
  error.code = code
  throw error
}

// Read data descriptors rather than invoking accessors or custom toJSON hooks.
// Proxy traps remain the caller's responsibility; serialized records are JSON.
function dataFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse()
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) refuse()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) refuse()
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const result = Object.create(null)
  for (const field of fields) {
    const descriptor = descriptors[field]
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) refuse()
    result[field] = descriptor.value
  }
  return result
}

function dataArray(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum) refuse()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1) refuse()
  const result = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) refuse()
    result.push(descriptor.value)
  }
  return result
}

export function validRecordRevision(value) {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/i.test(value)
}

export function isRecoverySourcePath(value) {
  return typeof value === 'string'
    && value.length <= sourceRecordLimits.pathCharacters
    && !/[\p{Cc}\\]/u.test(value)
    && !value.split('/').some(part => part === '.' || part === '..')
    && sourcePaths.some(rule => rule.exec(value)?.[0] === value)
}

export function containsSourceSecrets(value) {
  return typeof value === 'string' && secretMarkers.some(marker => marker.test(value))
}

export function normalizeSourceDisplay(value) {
  if (typeof value !== 'string') refuse()
  return value.replace(/\r\n?/g, '\n')
}

function boundedText(value, maximum) {
  if (typeof value !== 'string') refuse()
  if (value.length > maximum) refuse('SOURCE_RECORD_TOO_LARGE')
  if (containsSourceSecrets(value)) refuse('SOURCE_RECORD_PRIVATE')
  return value
}

function revision(value) {
  if (!validRecordRevision(value)) refuse()
  return value
}

function sourcePath(value) {
  if (typeof value !== 'string') refuse()
  if (value.length > sourceRecordLimits.pathCharacters) refuse('SOURCE_RECORD_TOO_LARGE')
  if (!isRecoverySourcePath(value)) refuse()
  return value
}

function integer(value, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) refuse()
  return value
}

function boolean(value) {
  if (typeof value !== 'boolean') refuse()
  return value
}

// Exact JSON.stringify length without allocating escaped copies first. A lone
// surrogate is escaped by well-formed JSON.stringify; a valid pair is retained.
function jsonStringLength(value) {
  let length = 2
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) length += 2
    else if (code < 32) length += 6
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) { length += 2; index += 1 }
      else length += 6
    } else length += code >= 0xdc00 && code <= 0xdfff ? 6 : 1
  }
  return length
}

function serializedLength(value) {
  if (typeof value === 'string') return jsonStringLength(value)
  if (value === null) return 4
  if (typeof value === 'boolean') return value ? 4 : 5
  if (typeof value === 'number') return String(value).length
  if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1) + value.reduce((total, item) => total + serializedLength(item), 0)
  const keys = Object.keys(value)
  return 2 + Math.max(0, keys.length - 1) + keys.reduce((total, key) => total + jsonStringLength(key) + 1 + serializedLength(value[key]), 0)
}

function serialize(payload, maximum) {
  if (serializedLength(payload) > maximum) refuse('SOURCE_RECORD_TOO_LARGE')
  return JSON.stringify(payload)
}

function sameData(left, right) {
  if (left === right) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]))
}

export function createRecoveryRecord(input) {
  const value = dataFields(input, recoveryFields)
  if (value.schemaVersion !== 1) refuse()
  const workspaceId = revision(value.workspaceId)
  const path = sourcePath(value.path)
  const baseRevision = revision(value.baseRevision)
  const baselineContent = boundedText(value.baselineContent, sourceRecordLimits.characters)
  const draftDisplay = boundedText(value.draftDisplay, sourceRecordLimits.characters)
  if (draftDisplay.includes('\r')) refuse()
  const draftDigest = revision(value.draftDigest)
  if (typeof value.storedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.storedAt)
    || !Number.isFinite(Date.parse(value.storedAt)) || new Date(value.storedAt).toISOString() !== value.storedAt) refuse()
  const record = { schemaVersion: 1, workspaceId, path, baseRevision, baselineContent, draftDisplay, draftDigest, storedAt: value.storedAt }
  if (serializedLength(record) > sourceRecordLimits.serializedRecovery) refuse('SOURCE_RECORD_TOO_LARGE')
  return record
}

export function parseRecoveryRecord(serialized, expectedWorkspaceId) {
  revision(expectedWorkspaceId)
  if (typeof serialized !== 'string') refuse()
  if (serialized.length > sourceRecordLimits.serializedRecovery) refuse('SOURCE_RECORD_TOO_LARGE')
  let value
  try { value = JSON.parse(serialized) } catch { refuse() }
  const record = createRecoveryRecord(value)
  if (record.workspaceId !== expectedWorkspaceId) refuse('SOURCE_RECORD_WORKSPACE')
  return record
}

function comparisonRow(input, counts) {
  const row = dataFields(input, rowFields)
  const result = {
    draftLine: row.draftLine === null ? null : integer(row.draftLine, counts.inspectedDraftLines),
    currentLine: row.currentLine === null ? null : integer(row.currentLine, counts.inspectedCurrentLines),
    draftText: boundedText(row.draftText, sourceComparisonLimits.text),
    currentText: boundedText(row.currentText, sourceComparisonLimits.text),
    draftEnding: row.draftEnding,
    currentEnding: row.currentEnding,
    kind: row.kind,
    draftTextTruncated: boolean(row.draftTextTruncated),
    currentTextTruncated: boolean(row.currentTextTruncated),
    draftLinePartial: boolean(row.draftLinePartial),
    currentLinePartial: boolean(row.currentLinePartial),
  }
  for (const side of ['draft', 'current']) {
    const line = result[side + 'Line']
    const ending = result[side + 'Ending']
    if (line === null) {
      if (ending !== null || result[side + 'Text'] !== '' || result[side + 'TextTruncated'] || result[side + 'LinePartial']) refuse()
    } else if (line === 0 || !endingNames.has(ending) || /[\r\n]/.test(result[side + 'Text'])
      || result[side + 'LinePartial'] !== (ending === 'unknown')) refuse()
  }
  if (result.kind === 'replace') { if (result.draftLine === null || result.currentLine === null) refuse() }
  else if (result.kind === 'draft-only') { if (result.draftLine === null || result.currentLine !== null) refuse() }
  else if (result.kind === 'current-only') { if (result.currentLine === null || result.draftLine !== null) refuse() }
  else refuse()
  return result
}

function comparisonRecord(input, draftLength, currentLength) {
  const value = dataFields(input, comparisonFields)
  if (value.algorithm !== algorithm || value.algorithmLabel !== algorithmLabel) refuse()
  const rawCounts = dataFields(value.counts, countFields)
  const counts = {}
  for (const field of countFields) {
    const maximum = /Characters$/.test(field) ? sourceRecordLimits.characters
      : ['shownRows', 'textTruncatedRows'].includes(field) ? sourceComparisonLimits.changedRows : sourceComparisonLimits.lines
    counts[field] = integer(rawCounts[field], maximum)
  }
  const rows = dataArray(value.rows, sourceComparisonLimits.changedRows).map(row => comparisonRow(row, counts))
  const reasons = dataArray(value.reasons, maximumReasons).map(reason => boundedText(reason, maximumReasonCharacters))
  const complete = boolean(value.complete)
  const truncated = boolean(value.truncated)
  const changedBlockCount = integer(value.changedBlockCount, counts.changedRows)
  if (counts.inspectedDraftCharacters + counts.uninspectedDraftCharacters !== draftLength
    || counts.inspectedCurrentCharacters + counts.uninspectedCurrentCharacters !== currentLength
    || complete !== (counts.uninspectedDraftCharacters === 0 && counts.uninspectedCurrentCharacters === 0)
    || counts.inspectedDraftLines > counts.inspectedDraftCharacters || counts.inspectedCurrentLines > counts.inspectedCurrentCharacters
    || counts.changedRows > Math.max(counts.inspectedDraftLines, counts.inspectedCurrentLines)
    || counts.shownRows !== rows.length || counts.shownRows !== Math.min(counts.changedRows, sourceComparisonLimits.changedRows)
    || counts.omittedRows !== counts.changedRows - counts.shownRows
    || counts.textTruncatedRows !== rows.filter(row => row.draftTextTruncated || row.currentTextTruncated).length
    || (counts.changedRows > 0) !== (changedBlockCount > 0)
    || value.equal !== (complete ? counts.changedRows === 0 : null)
    || truncated !== (!complete || counts.omittedRows > 0 || counts.textTruncatedRows > 0)) refuse()
  for (const side of ['draft', 'current']) {
    let previous = 0
    for (const row of rows) {
      if (row[side + 'Line'] === null) continue
      if (row[side + 'Line'] <= previous || (row[side + 'LinePartial'] && counts['uninspected' + (side === 'draft' ? 'Draft' : 'Current') + 'Characters'] === 0)) refuse()
      previous = row[side + 'Line']
    }
  }
  return { algorithm, algorithmLabel, equal: value.equal, complete, changedBlockCount, rows, counts, reasons, truncated }
}

export function createComparisonExport(input) {
  const value = dataFields(input, exportFields)
  if (value.schemaVersion !== 1) refuse()
  const path = sourcePath(value.path)
  const loadedRevision = revision(value.loadedRevision)
  const currentRevision = revision(value.currentRevision)
  const draftRevision = revision(value.draftRevision)
  const draftContent = boundedText(value.draftContent, sourceRecordLimits.characters)
  const currentContent = boundedText(value.currentContent, sourceRecordLimits.characters)
  const comparison = comparisonRecord(value.comparison, draftContent.length, currentContent.length)
  // A bounded but fabricated comparison must not mislabel the downloaded text.
  if (!sameData(comparison, compareSourceText(draftContent, currentContent))) refuse()
  const payload = { schemaVersion: 1, path, loadedRevision, currentRevision, draftRevision, draftContent, currentContent, comparison }
  return { payload, json: serialize(payload, sourceRecordLimits.serializedExport) }
}
