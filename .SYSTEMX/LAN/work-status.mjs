import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_RECORDS = 10000
const MAX_PROJECTS = 200
const STATUSES = ['todo', 'in_progress', 'blocked', 'needs_review', 'done', 'cancelled']
const RECORDS = ['WORK/TASKS.json', 'WORK/FOCUS.json', 'AGENTS/REGISTRY.json']
const ROADMAP = 'docs/backlog/webappx-1000-todo.json'
const AREAS = ['setup', 'portal-shell', 'hr-onboarding', 'hr-payroll', 'hr-talent', 'cms-authoring', 'cms-publishing', 'crm-contacts', 'crm-sales', 'mock-recovery', 'identity', 'firebase', 'security', 'quality', 'design', 'operations', 'delivery', 'systemx', 'adoption', 'integrations']
const TASK_FIELDS = 'id title owner status milestone scope acceptance dependsOn nextAction blocker evidence reviewedBy createdAt updatedAt history'.split(' ')
const TRANSITIONS = {
  todo: ['in_progress', 'blocked', 'cancelled'], in_progress: ['todo', 'blocked', 'needs_review', 'cancelled'],
  blocked: ['todo', 'in_progress', 'cancelled'], needs_review: ['in_progress', 'blocked', 'done', 'cancelled'],
  done: ['todo'], cancelled: ['todo'],
}

function requireValue(value) { if (!value) throw new Error('invalid-record') }
function fields(value, keys) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)))
}
function string(value, nonempty = true) {
  requireValue(typeof value === 'string' && !value.includes('\0') && (!nonempty || value.trim()))
}
function strings(value, nonempty = false) {
  requireValue(Array.isArray(value) && value.length <= MAX_RECORDS && (!nonempty || value.length))
  value.forEach((item) => string(item))
}
function timestamp(value) {
  string(value)
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/)
  requireValue(match && Number(match[1].slice(0, 4)) > 0 && Number(match[2]) < 24 && Number(match[3]) < 60
    && Number(match[4]) < 60 && (!match[7] || Number(match[7]) < 24 && Number(match[8]) < 60)
    && Number.isFinite(Date.parse(value)))
  const day = value.slice(0, 10)
  requireValue(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day)
  return BigInt(Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}${match[6]}`)) * 1000n
    + BigInt((match[5] ?? '').padEnd(6, '0'))
}

// JSON.parse accepts duplicate keys. Reject ambiguous records before interpreting them.
function parseJson(text) {
  let index = 0
  const whitespace = () => { while (/\s/.test(text[index] ?? '') && index < text.length) index += 1 }
  const tokenString = () => {
    const start = index++
    while (index < text.length) {
      if (text[index] === '\\') { index += 2; continue }
      if (text[index++] === '"') return JSON.parse(text.slice(start, index))
    }
    throw new Error('invalid-json')
  }
  const value = (depth = 0) => {
    if (depth > 64) throw new Error('invalid-json')
    whitespace()
    if (text[index] === '"') { tokenString(); return }
    const opener = text[index]
    if (opener === '{' || opener === '[') {
      index += 1
      whitespace()
      const closer = opener === '{' ? '}' : ']'
      if (text[index] === closer) { index += 1; return }
      const keys = new Set()
      while (index < text.length) {
        whitespace()
        if (opener === '{') {
          if (text[index] !== '"') throw new Error('invalid-json')
          const key = tokenString()
          if (keys.has(key)) throw new Error('duplicate-json-key')
          keys.add(key)
          whitespace()
          if (text[index++] !== ':') throw new Error('invalid-json')
        }
        value(depth + 1)
        whitespace()
        if (text[index] === closer) { index += 1; return }
        if (text[index++] !== ',') throw new Error('invalid-json')
      }
      throw new Error('invalid-json')
    }
    const token = text.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0]
    if (!token) throw new Error('invalid-json')
    index += token.length
  }
  value()
  whitespace()
  if (index !== text.length) throw new Error('invalid-json')
  return JSON.parse(text)
}

function safeFile(root, relative, directory = false) {
  const parts = relative.split('/')
  requireValue(parts.length && parts.every((part) => part && part !== '.' && part !== '..' && !/[\\:\0]/.test(part)))
  let current = resolve(root)
  const rootInfo = lstatSync(current)
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error('linked-or-invalid-path')
  for (const [index, part] of parts.entries()) {
    const matches = readdirSync(current).filter((name) => name.toLowerCase() === part.toLowerCase())
    if (matches.length !== 1 || matches[0] !== part) throw new Error(matches.length ? 'case-conflicting-path' : 'missing-record')
    current = join(current, part)
    const info = lstatSync(current)
    if (info.isSymbolicLink() || (index < parts.length - 1 || directory ? !info.isDirectory() : !info.isFile() || info.nlink > 1)) {
      throw new Error('linked-or-invalid-path')
    }
  }
  return current
}

function readSource(root, path, json = true) {
  let fd
  try {
    const file = safeFile(root, path)
    const before = lstatSync(file)
    if (before.size > MAX_BYTES) throw new Error('record-too-large')
    fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const info = fstatSync(fd)
    if (!info.isFile() || info.nlink > 1 || info.ino !== before.ino || info.dev !== before.dev) throw new Error('record-changed')
    const buffer = Buffer.alloc(MAX_BYTES + 1)
    let bytes = 0
    while (bytes < buffer.length) {
      const count = readSync(fd, buffer, bytes, buffer.length - bytes, null)
      if (!count) break
      bytes += count
    }
    if (bytes > MAX_BYTES) throw new Error('record-too-large')
    const content = buffer.subarray(0, bytes)
    const sha256 = createHash('sha256').update(content).digest('hex')
    let data
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(content)
      data = json ? parseJson(text) : text
    } catch { return { path, state: 'unavailable', sha256, diagnostic: 'invalid-json-or-text' } }
    return { path, state: 'available', sha256, data }
  } catch (error) {
    const known = ['invalid-record', 'linked-or-invalid-path', 'case-conflicting-path', 'missing-record', 'record-too-large', 'record-changed']
    return { path, state: 'unavailable', sha256: null, diagnostic: known.includes(error.message) ? error.message : 'unreadable-record' }
  } finally { if (fd !== undefined) closeSync(fd) }
}

function validated(source, check) {
  if (source.state !== 'available') return source
  try { check(source.data); return source } catch { return { ...source, state: 'unavailable', data: undefined, diagnostic: 'invalid-record' } }
}
function publicSource({ path, state, sha256, diagnostic }) { return { path, state, sha256, ...(diagnostic ? { diagnostic } : {}) } }
function schema(value, key) { fields(value, ['schemaVersion', key]); requireValue(value.schemaVersion === 1 && Array.isArray(value[key]) && value[key].length <= MAX_RECORDS) }
function count(items, statuses = STATUSES) { return Object.fromEntries(statuses.map((state) => [state, items.filter((item) => item.status === state).length])) }

function validateAgents(registry) {
  schema(registry, 'agents')
  const ids = new Set()
  for (const agent of registry.agents) {
    fields(agent, ['id', 'role', 'memory'])
    requireValue(typeof agent.id === 'string' && /^agent\.(?:0|[1-9]\d*|x|y|z)$/.test(agent.id) && !ids.has(agent.id))
    string(agent.role)
    requireValue(agent.memory === `AGENTS/${agent.id}/MEMORY.md`)
    const reserved = { 'agent.0': 'coordinator', 'agent.x': 'event-time', 'agent.y': 'cli-worker', 'agent.z': 'review' }
    requireValue(!reserved[agent.id] || reserved[agent.id] === agent.role)
    ids.add(agent.id)
  }
  requireValue(ids.has('agent.0'))
}

function validateTasks(ledger, registry) {
  schema(ledger, 'tasks')
  const ids = new Map()
  const owners = new Set(registry.agents.map((agent) => agent.id))
  for (const task of ledger.tasks) {
    fields(task, TASK_FIELDS)
    requireValue(typeof task.id === 'string' && /^TASK-\d{3,}$/.test(task.id) && Number(task.id.slice(5)) > 0 && !ids.has(task.id))
    for (const key of ['title', 'owner', 'status']) string(task[key])
    for (const key of ['milestone', 'nextAction', 'blocker', 'reviewedBy']) string(task[key], false)
    for (const key of ['scope', 'acceptance', 'dependsOn', 'evidence']) strings(task[key], key === 'acceptance')
    requireValue(owners.has(task.owner) && STATUSES.includes(task.status) && (!task.milestone || /^M-\d{3,}$/.test(task.milestone)))
    requireValue(task.status !== 'in_progress' || task.nextAction.trim())
    requireValue(task.status === 'blocked' ? task.blocker.trim() : task.blocker === '')
    requireValue(task.status === 'done' ? task.evidence.length && ['agent.0', 'user'].includes(task.reviewedBy) : task.reviewedBy === '')
    requireValue(!['done', 'cancelled'].includes(task.status) || task.nextAction === '')
    let previousAt = timestamp(task.createdAt)
    timestamp(task.updatedAt)
    requireValue(Array.isArray(task.history) && task.history.length > 0 && task.history.length <= MAX_RECORDS)
    let previous = null
    for (const event of task.history) {
      fields(event, ['at', 'status', 'owner', 'note', 'evidence', 'reviewedBy'])
      const at = timestamp(event.at)
      requireValue(at >= previousAt && (previous !== null || at === previousAt))
      string(event.note, false); strings(event.evidence)
      requireValue(STATUSES.includes(event.status) && owners.has(event.owner))
      requireValue(previous === null ? event.status === 'todo' : event.status === previous || TRANSITIONS[previous].includes(event.status))
      requireValue(event.status === 'done' ? event.evidence.length && ['agent.0', 'user'].includes(event.reviewedBy) : event.reviewedBy === '')
      previous = event.status; previousAt = at
    }
    const latest = task.history.at(-1)
    requireValue(['status', 'owner', 'reviewedBy'].every((key) => latest[key] === task[key])
      && JSON.stringify(latest.evidence) === JSON.stringify(task.evidence) && latest.at === task.updatedAt)
    requireValue(task.status !== 'cancelled' || latest.note.trim())
    requireValue(new Set(task.dependsOn).size === task.dependsOn.length)
    ids.set(task.id, task)
  }
  const remaining = new Map()
  const dependents = new Map([...ids.keys()].map((id) => [id, []]))
  for (const task of ids.values()) {
    remaining.set(task.id, task.dependsOn.length)
    for (const id of task.dependsOn) {
      requireValue(ids.has(id))
      requireValue(!['in_progress', 'needs_review', 'done'].includes(task.status) || ids.get(id).status === 'done')
      dependents.get(id).push(task.id)
    }
  }
  const ready = [...remaining].filter(([, n]) => n === 0).map(([id]) => id)
  let visited = 0
  while (ready.length) {
    const id = ready.pop(); visited += 1
    for (const next of dependents.get(id)) {
      remaining.set(next, remaining.get(next) - 1)
      if (remaining.get(next) === 0) ready.push(next)
    }
  }
  requireValue(visited === ids.size)
}

function validateFocus(focus, ledger) {
  fields(focus, ['schemaVersion', 'objective', 'taskIds', 'checkpoint', 'updatedAt'])
  requireValue(focus.schemaVersion === 1)
  for (const key of ['objective', 'checkpoint', 'updatedAt']) string(focus[key], false)
  strings(focus.taskIds)
  requireValue(focus.objective.length <= 600 && focus.taskIds.length <= 10 && new Set(focus.taskIds).size === focus.taskIds.length)
  requireValue(focus.taskIds.every((id) => ledger.tasks.some((task) => task.id === id)))
  if (focus.objective.trim()) timestamp(focus.updatedAt)
  else requireValue(focus.objective === '' && focus.taskIds.length === 0 && focus.checkpoint === '' && focus.updatedAt === '')
  requireValue(!focus.checkpoint || /^MEMORY\/sessions\/[^\\:\0]+\.md$/.test(focus.checkpoint)
    && focus.checkpoint.split('/').every((part) => part && part !== '.' && part !== '..')
    && focus.checkpoint.split('/').at(-1) !== 'README.md')
}

function readRecords(repoRoot, recordRoot) {
  const sources = RECORDS.map((name) => readSource(repoRoot, `${recordRoot}/${name}`))
  const supportingSources = []
  sources[2] = validated(sources[2], (data) => {
    validateAgents(data)
    for (const agent of data.agents) safeFile(repoRoot, `${recordRoot}/AGENTS/${agent.id}/MEMORY.md`)
  })
  sources[0] = validated(sources[0], (data) => {
    requireValue(sources[2].state === 'available')
    validateTasks(data, sources[2].data)
    if (data.tasks.some((task) => task.milestone)) {
      const plan = readSource(repoRoot, `${recordRoot}/PLAN/MASTER-PLAN.md`, false)
      supportingSources.push(publicSource(plan))
      requireValue(plan.state === 'available')
      const milestones = new Set([...plan.data.matchAll(/^\|\s*(M-\d{3,})\s*\|/gm)].map((match) => match[1]))
      requireValue(data.tasks.every((task) => !task.milestone || milestones.has(task.milestone)))
    }
  })
  sources[1] = validated(sources[1], (data) => {
    requireValue(sources[0].state === 'available')
    validateFocus(data, sources[0].data)
    if (data.checkpoint) safeFile(repoRoot, `${recordRoot}/${data.checkpoint}`)
  })
  const available = sources.every((source) => source.state === 'available')
  return {
    state: available ? 'available' : 'unavailable', recordRoot, sources: sources.map(publicSource), supportingSources,
    taskCount: sources[0].state === 'available' ? sources[0].data.tasks.length : null,
    tasksByStatus: sources[0].state === 'available' ? count(sources[0].data.tasks) : null,
    focus: sources[1].state === 'available' ? { objective: sources[1].data.objective, taskIds: sources[1].data.taskIds, updatedAt: sources[1].data.updatedAt, checkpointRecorded: Boolean(sources[1].data.checkpoint) } : null,
    agentRoles: sources[2].state === 'available' ? sources[2].data.agents.map(({ id, role }) => ({ id, role })) : null,
  }
}

function validateProjects(registry) {
  schema(registry, 'projects')
  requireValue(registry.projects.length <= MAX_PROJECTS)
  const names = new Set()
  for (const entry of registry.projects) {
    fields(entry, ['name', 'path', 'records', 'kind'])
    requireValue(typeof entry.name === 'string' && /^[A-Za-z](?:[A-Za-z0-9 _-]{0,78}[A-Za-z0-9])?$/.test(entry.name))
    const lower = entry.name.toLowerCase()
    requireValue(!/^(?:root|con|prn|aux|nul|(?:com|lpt)[1-9])$/.test(lower) && !names.has(lower))
    requireValue(entry.path === `Projects/${entry.name}` && entry.records === `${entry.path}/.SYSTEMXP`
      && ['general', 'software', 'research', 'operations', 'channel'].includes(entry.kind))
    names.add(lower)
  }
}

function readRoadmap(repoRoot) {
  const source = validated(readSource(repoRoot, ROADMAP), (data) => {
    fields(data, ['schemaVersion', 'project', 'intent', 'createdOn', 'sourceCommit', 'items'])
    requireValue(data.schemaVersion === 1 && data.project === 'WebAppX' && data.intent === 'proposed-backlog')
    requireValue(typeof data.sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(data.sourceCommit))
    requireValue(typeof data.createdOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.createdOn)
      && new Date(`${data.createdOn}T00:00:00Z`).toISOString().slice(0, 10) === data.createdOn)
    requireValue(Array.isArray(data.items) && data.items.length === 1000)
    const ids = new Set()
    for (const item of data.items) {
      const keys = ['id', 'area', 'priority', 'phase', 'status', 'title', 'acceptance', 'source', 'gate', 'dependsOn']
      fields(item, item.status === 'done' ? [...keys, 'completion'] : keys)
      requireValue(typeof item.id === 'string' && /^WX-\d{4}$/.test(item.id) && !ids.has(item.id))
      requireValue(['todo', 'done'].includes(item.status))
      for (const key of ['area', 'priority', 'phase', 'title', 'acceptance', 'source', 'gate']) string(item[key])
      requireValue(AREAS.includes(item.area) && ['P1', 'P2', 'P3'].includes(item.priority)
        && ['foundation', 'portal-maturity', 'production-readiness', 'extensions'].includes(item.phase)
        && ['local', 'provider', 'operator'].includes(item.gate))
      requireValue(item.title.length >= 18 && item.title.length <= 180 && item.acceptance.length >= 30 && item.acceptance.length <= 700
        && item.source.length >= 2 && item.source.length <= 240)
      strings(item.dependsOn)
      if (item.status === 'done') {
        fields(item.completion, ['verifiedOn', 'sourceBase', 'evidence', 'reviewedBy'])
        requireValue(typeof item.completion.verifiedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.completion.verifiedOn)
          && new Date(`${item.completion.verifiedOn}T00:00:00Z`).toISOString().slice(0, 10) === item.completion.verifiedOn
          && typeof item.completion.sourceBase === 'string' && /^[a-f0-9]{40}$/.test(item.completion.sourceBase)
          && ['agent.0', 'user'].includes(item.completion.reviewedBy))
        string(item.completion.evidence)
      }
      ids.add(item.id)
    }
    requireValue(data.items.every((item) => new Set(item.dependsOn).size === item.dependsOn.length
      && item.dependsOn.every((id) => ids.has(id) && id < item.id)))
  })
  return { ...publicSource(source), ...(source.state === 'available' ? {
    schemaVersion: source.data.schemaVersion, project: source.data.project, intent: source.data.intent,
    sourceCommit: source.data.sourceCommit, itemCount: source.data.items.length, itemsByStatus: count(source.data.items, ['todo', 'done']),
  } : { itemCount: null, itemsByStatus: null }) }
}

/** Offline, read-only host facts. Selection never comes from a stored last-project setting. */
export function readOperatingStatus(repoRoot, selection = null) {
  const installation = validated(readSource(repoRoot, '.SYSTEMX/INSTALLATION.json'), (data) => {
    requireValue(data && data.schemaVersion === 2 && typeof data.activeVersion === 'string'
      && /^[0-9][A-Za-z0-9.-]{0,79}$/.test(data.activeVersion) && !data.activeVersion.includes('..'))
    requireValue((data.pinnedVersion === null || typeof data.pinnedVersion === 'string') && ['manual', 'on-start'].includes(data.autoUpdate))
  })
  const version = installation.state === 'available' ? installation.data.activeVersion : null
  const root = readRecords(repoRoot, '.SYSTEMX')
  const registry = validated(readSource(repoRoot, '.SYSTEMX/Projects/REGISTRY.json'), validateProjects)
  const children = registry.state === 'available' ? registry.data.projects.map((project) => project.name) : null
  const reusableSeed = {
    ...root, selectedVersion: version,
    sources: root.sources.map((source, index) => {
      const stock = version ? readSource(repoRoot, `.SYSTEMX/.systemx/releases/${version}/${RECORDS[index]}`) : null
      return { ...source, stockSha256: stock?.state === 'available' ? stock.sha256 : null,
        ...(stock?.state === 'unavailable' ? { stockDiagnostic: stock.diagnostic } : {}),
        exactStockMatch: source.state === 'available' && stock?.state === 'available' ? source.sha256 === stock.sha256 : null }
    }),
  }
  reusableSeed.stockMatch = reusableSeed.sources.some((source) => source.exactStockMatch === null) ? 'unavailable'
    : reusableSeed.sources.every((source) => source.exactStockMatch) ? 'exact' : 'modified'
  let adoptedProject = { state: 'not-selected', selection: null }
  if (selection !== null) {
    adoptedProject = { state: 'unavailable', selection: null, diagnostic: 'invalid-scope-selection' }
    if (selection?.kind === 'root' && Object.keys(selection).length === 1) adoptedProject = { ...root, selection: { kind: 'root' } }
    else if (selection?.kind === 'child' && Object.keys(selection).length === 2 && typeof selection.name === 'string') {
      adoptedProject = { state: 'unavailable', selection: { kind: 'child', name: selection.name.slice(0, 80) }, diagnostic: registry.state === 'available' ? 'unknown-project-selection' : 'project-registry-unavailable' }
      if (children?.includes(selection.name)) {
        const recordRoot = `.SYSTEMX/Projects/${selection.name}/.SYSTEMXP`
        const identity = validated(readSource(repoRoot, `${recordRoot}/project.json`), (data) => {
          fields(data, ['schemaVersion', 'project', 'checks', 'commands'])
          fields(data.project, ['name', 'description']); fields(data.commands, ['dev', 'build', 'deploy'])
          requireValue(data.schemaVersion === 1 && data.project.name === selection.name)
          string(data.project.description, false)
          for (const name of ['dev', 'build', 'deploy']) strings(data.commands[name])
          requireValue(Array.isArray(data.checks) && data.checks.length <= MAX_RECORDS)
          const names = new Set()
          for (const check of data.checks) {
            fields(check, ['name', 'command']); string(check.name); strings(check.command, true)
            requireValue(!names.has(check.name)); names.add(check.name)
          }
          for (const relative of [`.SYSTEMX/Projects/${selection.name}`, recordRoot]) {
            const directory = safeFile(repoRoot, relative, true)
            requireValue(readdirSync(directory).every((name) => name.toLowerCase() !== '.systemx'
              && (relative !== recordRoot || name.toLowerCase() !== 'projects')))
          }
        })
        adoptedProject = { ...readRecords(repoRoot, recordRoot), selection: { kind: 'child', name: selection.name }, identitySource: publicSource(identity) }
        if (identity.state !== 'available') adoptedProject.state = 'unavailable'
      }
    }
  }
  return {
    installed: installation.state === 'available' ? true : null,
    selectedVersion: version, pinnedVersion: installation.data?.pinnedVersion ?? null, updatePolicy: installation.data?.autoUpdate ?? null,
    taskCount: root.taskCount, tasksByStatus: root.tasksByStatus, agentRoles: root.agentRoles ?? [],
    childProjectCount: children?.length ?? null, authority: 'records-only',
    recordDiagnostics: [publicSource(installation), ...root.sources, publicSource(registry)].filter((source) => source.state !== 'available'),
    workStatus: {
      schemaVersion: 1, authority: 'records-only', reusableSeed, roadmap: readRoadmap(repoRoot), adoptedProject,
      scopeOptions: { ...publicSource(registry), root: true, children },
    },
  }
}
