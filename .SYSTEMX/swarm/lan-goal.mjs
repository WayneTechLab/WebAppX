import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import {
  applyProgress, buildCatalog, progressFile, readyItems, specificationFiles, summary, validateProgress,
} from '../../scripts/lan-backlog.mjs'

async function readFixedJson(root, name, maxBytes) {
  const path = await realpath(resolve(root, name))
  if (relative(root, path).split(sep).join('/') !== name) throw new Error('Invalid public catalog input path.')
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > maxBytes) throw new Error('Invalid public catalog input size or type.')
    const bytes = Buffer.alloc(info.size + 1)
    let used = 0
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length - used, used)
      if (bytesRead === 0) break
      used += bytesRead
    }
    if (used !== info.size) throw new Error('Catalog input changed during validation.')
    return JSON.parse(bytes.toString('utf8', 0, used))
  } finally { await file.close() }
}

function inspectFamily(catalog, familyId, readyFamilies) {
  const rows = catalog.items.filter(item => item.familyId === familyId)
  if (!rows.length) {
    throw Object.assign(new Error('Choose an original LAN family from F001 through F100.'), { code: 'GOAL_FAMILY_INVALID' })
  }
  const { familyName, gate } = rows[0]
  const accepted = rows.filter(item => item.status === 'done').length
  const firstReadyId = readyFamilies[gate].find(item => item.familyId === familyId)?.firstReadyId
  const next = firstReadyId ? rows.find(item => item.id === firstReadyId) : rows.find(item => item.status === 'todo')
  const family = { familyId, familyName, gate, accepted, total: rows.length, status: 'complete', capability: null }
  if (!next) return family
  const done = new Set(catalog.items.filter(item => item.status === 'done').map(item => item.id))
  family.status = firstReadyId ? 'ready' : 'blocked'
  family.capability = {
    key: next.capabilityKey, title: next.capabilityTitle, firstReadyId: firstReadyId ?? null,
    requirements: rows.filter(item => item.capabilityKey === next.capabilityKey).map(item => ({
      id: item.id, lane: item.lane, status: item.status, acceptance: item.acceptance,
      definitionSha256: item.definitionSha256, pendingPrerequisites: item.dependsOn.filter(id => !done.has(id)),
    })),
  }
  return family
}

export async function readLanGoal({ publicRoot, limit = 5, familyId, controller }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw Object.assign(new Error('Choose a goal sample limit from 1 through 100 per gate.'), { code: 'GOAL_LIMIT_INVALID' })
  }
  let catalog
  try {
    // Use the installed host's original backlog validator once for every gate.
    // The selected project's generated views and executable files are never loaded.
    const root = await realpath(resolve(publicRoot))
    const [definitions, progress] = await Promise.all([
      Promise.all(specificationFiles.map(path => readFixedJson(root, path, 4 * 1024 * 1024))),
      readFixedJson(root, progressFile, 12 * 1024 * 1024),
    ])
    const original = buildCatalog(definitions)
    await validateProgress(original, progress, { publicRoot: root })
    catalog = applyProgress(original, progress)
  } catch (cause) {
    throw Object.assign(new Error('The LAN definitions, completion records or public evidence failed validation. Check the selected repository with the backlog validator.'), { code: 'GOAL_CATALOG_INVALID', cause })
  }

  const { requirements, capabilities } = summary(catalog)
  const ready = {}, readyFamilies = {}
  for (const gate of ['local', 'operator', 'provider']) {
    const queue = readyItems(catalog, { limit, gate, includeFamilies: true })
    readyFamilies[gate] = queue.families
    ready[gate] = { count: queue.matches, items: queue.items.map(({ id, familyId }) => ({ id, familyId })) }
  }
  const result = {
    schemaVersion: 1,
    requirements: { accepted: requirements.done, total: requirements.total, remaining: requirements.todo,
      percentage: 100 * requirements.done / requirements.total, complete: requirements.done === requirements.total },
    capabilities: { accepted: capabilities.done, total: capabilities.total, partial: capabilities.partial },
    ready, readyFamilies, applied: false, executionAuthority: false,
  }
  if (familyId !== undefined) result.family = inspectFamily(catalog, familyId, readyFamilies)
  if (controller) {
    const { runId, stateRevision, progress, assignments, blockedBy } = controller.wave()
    result.manifestWave = { runId, stateRevision, progress, blockedBy, assignments: assignments.map(({ slot, generation, taskId }) => ({ slot, generation, taskId })) }
  }
  return result
}
