import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { confinedFile } from './runtime/file-boundary.mjs'

export const sourceHistoryLimits = Object.freeze({ logBytes: 262144, logLines: 1000, lineBytes: 16384, entries: 100, observedPaths: 32, observationsPerPath: 20 })
const hash = (value) => createHash('sha256').update(value).digest('hex')
const revision = (value) => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value

function emptyWindow(status) {
  return {
    entries: [],
    log: { status, available: status === 'available', totalBytes: 0, bytesInspected: 0, bytesOmitted: 0, linesInspected: 0, linesOmitted: 0, oversizedLines: 0, invalidLines: 0, incompleteLines: 0, legacyEntries: 0, foreignWorkspaceLines: 0, truncated: false },
    warnings: status === 'available' ? [] : [status === 'missing' ? 'No local operation log is available. Only session observations can be shown.' : 'The local operation log could not be read safely. Only session observations can be shown.'],
  }
}

function missingLog(root, file) {
  const suffix = relative(resolve(root), resolve(file))
  if (!suffix || isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) return false
  let current = resolve(root)
  const parts = suffix.split(sep)
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index])
    let entry
    try { entry = lstatSync(current) } catch (error) { return error.code === 'ENOENT' }
    if (entry.isSymbolicLink() || (index < parts.length - 1 && !entry.isDirectory())) return false
  }
  return false
}

/** Read only a bounded tail. Parsed records never escape this whitelist. */
export function readSourceOperationHistory({ root, file, path, workspaceId }) {
  if (!confinedFile(root, file)) return emptyWindow(missingLog(root, file) ? 'missing' : 'unavailable')
  let descriptor
  try {
    const expected = lstatSync(file)
    if (!expected.isFile() || expected.isSymbolicLink()) return emptyWindow('unavailable')
    descriptor = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const opened = fstatSync(descriptor)
    if (!opened.isFile() || opened.dev !== expected.dev || opened.ino !== expected.ino || !Number.isSafeInteger(opened.size)) return emptyWindow('unavailable')
    const window = emptyWindow('available')
    const start = Math.max(0, opened.size - sourceHistoryLimits.logBytes)
    const buffer = Buffer.alloc(Math.min(opened.size, sourceHistoryLimits.logBytes))
    let filled = 0
    while (filled < buffer.length) {
      const read = readSync(descriptor, buffer, filled, buffer.length - filled, start + filled)
      if (!read) break
      filled += read
    }
    let bytes = buffer.subarray(0, filled)
    window.log.totalBytes = opened.size
    window.log.bytesInspected = filled
    window.log.bytesOmitted = start
    window.log.truncated = start > 0 || filled !== buffer.length
    if (start) {
      // Seeking can split UTF-8 or JSON. Never decode/parse the leading fragment.
      const newline = bytes.indexOf(10)
      bytes = newline < 0 ? bytes.subarray(0, 0) : bytes.subarray(newline + 1)
    }
    if (bytes.length && bytes.at(-1) !== 10) {
      window.log.incompleteLines = 1
      const newline = bytes.lastIndexOf(10)
      bytes = newline < 0 ? bytes.subarray(0, 0) : bytes.subarray(0, newline + 1)
    }
    let end = bytes.length - 1
    while (end >= 0 && window.log.linesInspected < sourceHistoryLimits.logLines) {
      const previous = end === 0 ? -1 : bytes.lastIndexOf(10, end - 1)
      const line = bytes.subarray(previous + 1, end)
      end = previous
      window.log.linesInspected += 1
      if (!line.length) continue
      if (line.length > sourceHistoryLimits.lineBytes) { window.log.oversizedLines += 1; continue }
      let record
      try { record = JSON.parse(line.toString('utf8')) } catch { window.log.invalidLines += 1; continue }
      if (!record || typeof record !== 'object' || Array.isArray(record)) { window.log.invalidLines += 1; continue }
      if (!['source_saved', 'font_saved'].includes(record.event) || record.path !== path) continue
      if (record.event === 'font_saved' && path !== 'src/index.css') { window.log.invalidLines += 1; continue }
      if (record.workspaceId !== undefined && record.workspaceId !== workspaceId) { window.log.foreignWorkspaceLines += 1; continue }
      if (!timestamp(record.timestamp)) { window.log.invalidLines += 1; continue }
      const previousRevision = revision(record.previousRevision), resultRevision = revision(record.revision)
      const complete = Boolean(previousRevision && resultRevision && (record.currentRevision === undefined || revision(record.currentRevision) === resultRevision))
      const workspaceBound = record.workspaceId === workspaceId
      const operation = record.event === 'font_saved' ? 'font' : record.sourceKind === 'leaf-text' ? 'leaf-text' : 'source'
      const entry = {
        kind: complete && workspaceBound ? 'builder-save' : 'legacy-builder-operation', operation, timestamp: record.timestamp,
        previousRevision: complete ? previousRevision : null, revision: complete ? resultRevision : null,
        attribution: workspaceBound ? 'recorded-builder-operation' : 'unattributed', provenance: 'operation-log', workspaceBound, revisionAvailable: complete,
      }
      entry.id = `operation-${hash(JSON.stringify(entry))}`
      if (entry.kind === 'legacy-builder-operation') window.log.legacyEntries += 1
      window.entries.push(entry)
    }
    if (end >= 0) {
      for (let index = 0; index <= end; index += 1) if (bytes[index] === 10) window.log.linesOmitted += 1
    }
    window.log.truncated ||= Boolean(window.log.linesOmitted || window.log.oversizedLines || window.log.invalidLines || window.log.incompleteLines || window.log.foreignWorkspaceLines)
    if (window.log.truncated) window.warnings.push('The operation log window is incomplete. Earlier, oversized, partial or unreadable records may be omitted.')
    if (window.log.legacyEntries) window.warnings.push('Legacy records may lack revisions or workspace binding. Their metadata is not proof of a save in this workspace.')
    if (window.entries.some((entry) => !entry.workspaceBound)) window.warnings.push('Some local records predate workspace binding. Their origin is not independently verified.')
    if (window.log.foreignWorkspaceLines) window.warnings.push('Records bound to a different workspace were omitted.')
    return window
  } catch {
    return emptyWindow('unavailable')
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

/** Observations live only in this server process; they are never an author claim. */
export function createSourceHistory() {
  const paths = new Map()
  let evictedPaths = 0
  return {
    snapshot({ path, workspaceId, currentRevision, operationWindow, limit = 50, now = new Date().toISOString() }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > sourceHistoryLimits.entries || !timestamp(now) || !revision(currentRevision) || !revision(workspaceId)) throw new TypeError('Invalid source history snapshot arguments')
      let state = paths.get(path)
      if (!state) {
        if (paths.size >= sourceHistoryLimits.observedPaths) { paths.delete(paths.keys().next().value); evictedPaths += 1 }
        state = { entries: [], omitted: 0 }
      }
      paths.delete(path)
      paths.set(path, state)
      const previous = state.entries.at(-1)
      if (previous?.revision !== currentRevision) {
        const entry = { kind: previous ? 'observed-change' : 'observed-current', operation: null, timestamp: now, previousRevision: previous?.revision ?? null, revision: currentRevision, attribution: 'unattributed', provenance: 'session-observation' }
        entry.id = `observation-${hash(JSON.stringify({ path, workspaceId, ...entry }))}`
        state.entries.push(entry)
        if (state.entries.length > sourceHistoryLimits.observationsPerPath) { state.entries.shift(); state.omitted += 1 }
      }
      const all = [...operationWindow.entries, ...state.entries].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      const omittedEntries = Math.max(0, all.length - limit)
      const observationsTruncated = Boolean(state.omitted || evictedPaths)
      const warnings = [...operationWindow.warnings]
      if (observationsTruncated) warnings.push('Older session observations were evicted by the memory limit.')
      if (omittedEntries) warnings.push('Only the requested number of recent entries is shown.')
      warnings.push('Observations show hashes seen by this server, not proof of who changed the file. No rollback is provided.')
      return {
        schemaVersion: 1, workspaceId, path, currentRevision, observedAt: now, entries: all.slice(0, limit),
        truncated: operationWindow.log.truncated || observationsTruncated || omittedEntries > 0,
        omittedEntries, limits: { ...sourceHistoryLimits }, log: { ...operationWindow.log },
        observations: { retained: state.entries.length, omitted: state.omitted, evictedPaths, persistence: 'server-memory-only' }, warnings,
      }
    },
  }
}
