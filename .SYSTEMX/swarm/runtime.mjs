/** Host-owned delivery orchestration. It does not alter the selected SYSTEMX release or task ledger. */
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { constants, chmodSync, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { absolutePathSegments, isCanonicalRepositoryRoot } from './path-boundary.mjs'

export const swarmLimits = Object.freeze({ workers: 10, tasks: 500, packetBytes: 128_000, outputBytes: 1_000_000, timeoutMs: 900_000, bundleBytes: 128 * 1024 * 1024 })
const phases = ['ready', 'running', 'verifying', 'review', 'checks', 'merge-eligible', 'publication-pending', 'merge-pending', 'merged', 'accepted', 'closed', 'failed']
const clean = (value, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max && value === value.trim() && !/[\x00-\x1f\x7f]/.test(value)
const hex = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const ident = value => clean(value, 64) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)
const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every(key => keys.includes(key))
const fail = (code, message) => { const error = new Error(message); error.code = code; throw error }
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
const sensitive = value => /-----BEGIN .*PRIVATE KEY-----|\b(?:sk_(?:live|test)_[a-z\d]+|sk-proj-[a-z\d_-]+|gh[pousr]_[a-z\d]+|AIza[a-z\d_-]{20,})|(?:password|secret|token|api[-_]?key)\s*[=:]\s*\S+/i.test(value)
function text(value, max, code = 'MANIFEST_INVALID') { if (!clean(value, max) || sensitive(value)) fail(code, 'Use bounded nonsecret text.'); return value }
function sourcePath(value) {
  if (!clean(value, 512) || /[\\%:*?"<>|]/.test(value) || isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..' || part === '.git' || part.startsWith('.env')) || /^\.SYSTEMX\/(?:state|local|\.systemx\/releases)(?:\/|$)/.test(value)) fail('SCOPE_INVALID', 'Use explicit public repository-relative paths outside private state and managed releases.');
  return value
}
const pathMatches = (path, allowed) => allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed
const scopesOverlap = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); return a === b || pathMatches(a, b) || pathMatches(b, a) }
const protectedPath = path => /^(?:\.git(?:\/|$)|\.env(?:[./]|$)|\.systemx\/(?:state|local|\.systemx|plan|global|work|memory|projects)(?:\/|$)|\.systemx\/(?:current\.md|project\.json|installation\.json)$|\.systemx\/agents\/(?!readme\.md$)|\.systemx\/lan\/(?:temp|backup|files)(?:\/|$))/i.test(path)
function validateScope(value) { if (typeof value !== 'string') fail('SCOPE_INVALID', 'Scope entries must be repository-relative path text.'); const suffix = value.endsWith('/') ? '/' : ''; return sourcePath(suffix ? value.slice(0, -1) : value) + suffix }
function command(value) {
  if (!exact(value, ['executable', 'args']) || !clean(value.executable, 4096) || !Array.isArray(value.args) || value.args.length > 64 || value.args.some(arg => typeof arg !== 'string' || arg.length > 4096 || /[\x00\r\n]/.test(arg) || sensitive(arg) || /^--?(?:api[-_]?key|token|password|secret|private[-_]?key)(?:=|$)/i.test(arg))) fail('COMMAND_INVALID', 'Use a reviewed executable and a bounded nonsecret argument array.');
  if (sensitive(value.executable)) fail('COMMAND_INVALID', 'Provider arguments cannot contain credentials.');
  return { executable: value.executable, args: [...value.args] }
}

export function validateManifest(value) {
  if (!exact(value, ['schemaVersion', 'runId', 'repository', 'baseBranch', 'baseRevision', 'maxWorkers', 'externalWorkers', 'reservedPaths', 'requiredChecks', 'autoMerge', 'tasks']) || value.schemaVersion !== 1 || !ident(value.runId) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository ?? '') || !clean(value.baseBranch, 120) || !/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(value.baseBranch) || !hex(value.baseRevision) || !Number.isInteger(value.maxWorkers) || value.maxWorkers < 1 || value.maxWorkers > swarmLimits.workers || !Number.isInteger(value.externalWorkers ?? 0) || (value.externalWorkers ?? 0) < 0 || (value.externalWorkers ?? 0) > value.maxWorkers || !Array.isArray(value.tasks) || !value.tasks.length || value.tasks.length > swarmLimits.tasks || (value.autoMerge !== undefined && typeof value.autoMerge !== 'boolean')) fail('MANIFEST_INVALID', 'Provide a schema-1 bounded swarm manifest with a pinned repository and base revision.');
  if (!Array.isArray(value.reservedPaths ?? []) || (value.reservedPaths ?? []).length > 200 || !Array.isArray(value.requiredChecks ?? []) || (value.requiredChecks ?? []).length > 100) fail('MANIFEST_INVALID', 'Use bounded reservation and required-check arrays.');
  const reservedPaths = (value.reservedPaths ?? []).map(validateScope)
  const requiredChecks = (value.requiredChecks ?? []).map(item => text(item, 160))
  if (new Set(requiredChecks).size !== requiredChecks.length || (value.autoMerge && !requiredChecks.length)) fail('MANIFEST_INVALID', 'Auto merge requires named, distinct required checks.');
  const ids = new Set()
  const tasks = value.tasks.map(task => {
    if (!exact(task, ['id', 'title', 'acceptance', 'allowedPaths', 'checks', 'dependsOn']) || !ident(task.id) || ids.has(task.id) || !Array.isArray(task.acceptance) || !task.acceptance.length || task.acceptance.length > 30 || !Array.isArray(task.allowedPaths) || !task.allowedPaths.length || task.allowedPaths.length > 40 || !Array.isArray(task.checks) || !task.checks.length || task.checks.length > 20 || !Array.isArray(task.dependsOn ?? [])) fail('TASK_INVALID', 'Each task needs a unique ID, acceptance, isolated paths and executable checks.');
    ids.add(task.id)
    const allowedPaths = task.allowedPaths.map(validateScope)
    if (allowedPaths.some(path => reservedPaths.some(reserved => scopesOverlap(path, reserved)))) fail('SCOPE_RESERVED', 'A task overlaps an IDE, app or coordinator reservation.');
    return { id: task.id, title: text(task.title, 240), acceptance: task.acceptance.map(item => text(item, 1400)), allowedPaths, checks: task.checks.map(command), dependsOn: [...(task.dependsOn ?? [])] }
  })
  const map = new Map(tasks.map(task => [task.id, task]))
  const visit = (id, active, done) => {
    if (!map.has(id)) fail('DEPENDENCY_INVALID', 'A task dependency is unknown.');
    if (active.has(id)) fail('DEPENDENCY_CYCLE', 'Task dependencies contain a cycle.');
    if (done.has(id)) return
    active.add(id); for (const dependency of map.get(id).dependsOn) visit(dependency, active, done); active.delete(id); done.add(id)
  }
  const done = new Set(); for (const id of map.keys()) visit(id, new Set(), done)
  return { schemaVersion: 1, runId: value.runId, repository: value.repository, baseBranch: value.baseBranch, baseRevision: value.baseRevision, maxWorkers: value.maxWorkers, externalWorkers: value.externalWorkers ?? 0, reservedPaths, requiredChecks, autoMerge: value.autoMerge === true, tasks }
}

function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false, maxBuffer: 4_000_000, timeout: 20_000, windowsHide: true })
  if (result.error || result.status !== 0) { if (allowFailure) return null; fail('GIT_FAILED', 'A bounded Git observation failed. Inspect the repository separately.'); }
  return result.stdout.trimEnd()
}
export function inspectRepository(input) {
  const root = realpathSync(resolve(input))
  if (!isCanonicalRepositoryRoot(root, git(root, ['rev-parse', '--show-toplevel']))) fail('REPOSITORY_ROOT_REQUIRED', 'Select the exact Git worktree root.');
  const common = realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir']))), entry = statSync(common)
  return { root, workspaceId: digest(`systemx-swarm\0${root}\0${common}\0${entry.dev}\0${entry.ino}`), head: git(root, ['rev-parse', 'HEAD']), branch: git(root, ['branch', '--show-current']), clean: git(root, ['status', '--porcelain=v1', '--untracked-files=all']) === '' }
}
function remoteRepository(root) {
  const remote = git(root, ['remote', 'get-url', 'origin']) ?? ''
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote)
  return match?.[1] ?? null
}
function safeDirectory(path, create = true) {
  const { absolute, root, parts } = absolutePathSegments(resolve(path))
  let current = root
  for (const part of parts) {
    current = join(current, part)
    if (!existsSync(current)) { if (!create) return absolute; mkdirSync(current, { mode: 0o700 }) }
    const entry = lstatSync(current)
    if (entry.isSymbolicLink() || !entry.isDirectory()) fail('STATE_PATH_REFUSED', 'Private state cannot traverse links or non-directories.');
  }
  return absolute
}
function readJsonFile(path, privateFile = false) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try { const entry = fstatSync(fd); if (!entry.isFile() || entry.size > 2_000_000 || (privateFile && process.platform !== 'win32' && (entry.mode & 0o077))) fail('STATE_INVALID', 'State must be a bounded private regular file.'); return JSON.parse(readFileSync(fd, 'utf8')) } finally { closeSync(fd) }
}
function atomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temporary, 'wx', 0o600)
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`) } finally { closeSync(fd) }
  renameSync(temporary, path)
}
export function createController({ repo, manifest, stateDir }) {
  const identity = inspectRepository(repo), validated = validateManifest(manifest)
  const location = resolve(stateDir ?? join(identity.root, '.SYSTEMX', 'state', 'swarm', validated.runId))
  const suffix = relative(identity.root, location)
  if (!suffix.startsWith(`..${sep}`) && suffix !== '..' && !isAbsolute(suffix) && git(identity.root, ['check-ignore', '--no-index', '--', location], { allowFailure: true }) === null) fail('STATE_NOT_PRIVATE', 'State inside a repository must be ignored by Git.');
  const file = join(location, 'state.json'), lock = join(location, 'controller.lock'), manifestDigest = digest(validated)
  const load = () => {
    safeDirectory(location, false)
    if (!existsSync(file)) return { schemaVersion: 1, workspaceId: identity.workspaceId, manifestDigest, baseRevision: validated.baseRevision, revision: 0, slots: {}, acceptedTaskIds: [], events: [] }
    const state = readJsonFile(file, true)
    if (state.schemaVersion !== 1 || state.workspaceId !== identity.workspaceId || state.manifestDigest !== manifestDigest || !hex(state.baseRevision) || !Array.isArray(state.acceptedTaskIds) || new Set(state.acceptedTaskIds).size !== state.acceptedTaskIds.length || state.acceptedTaskIds.some(id => !validated.tasks.some(task => task.id === id)) || !Number.isInteger(state.revision) || !state.slots || !Array.isArray(state.events) || state.events.length > 2000 || Object.keys(state.slots).length > swarmLimits.workers) fail('STATE_INVALID', 'Private state does not match this checkout, manifest or record budget.');
    for (const [number, slot] of Object.entries(state.slots)) {
      if (!/^([1-9]|10)$/.test(number) || !slot || slot.number !== Number(number) || !Number.isInteger(slot.generation) || slot.generation < 1 || !validated.tasks.some(task => task.id === slot.taskId) || !phases.includes(slot.phase) || !hex(slot.baseRevision) || !hex(slot.headRevision) || (slot.lease !== undefined && !/^[a-f0-9-]{36}$/.test(slot.lease)) || slot.worktree !== join(location, 'worktrees', `y${number}-g${slot.generation}`) || slot.branch !== `codex/swarm/${validated.runId}/y${number.padStart(2, '0')}-g${String(slot.generation).padStart(3, '0')}-${slot.taskId.toLowerCase()}` || slot.assignmentDigest !== digest({ manifestDigest, task: validated.tasks.find(task => task.id === slot.taskId) })) fail('STATE_INVALID', 'A private worker record has an invalid identity or scope.');
    }
    return state
  }
  const taskById = id => validated.tasks.find(task => task.id === id) ?? fail('TASK_UNKNOWN', 'Select an exact manifest task.');
  const observe = (state, event, slot, detail = {}) => {
    if (state.events.length >= 2000) fail('STATE_EVENT_LIMIT', 'Archive this completed run before adding more events.');
    state.events.push({ event, slot, at: new Date().toISOString(), ...detail })
  }
  async function change(apply, operation) {
    if (!apply) fail('APPLY_REQUIRED', 'This action requires explicit --apply after reviewing its plan.');
    safeDirectory(location)
    let owner
    const deadline = Date.now() + 5000
    while (owner === undefined) {
      try { owner = openSync(lock, 'wx', 0o600) } catch (error) {
        if (error.code !== 'EEXIST' || Date.now() >= deadline) fail('CONTROLLER_BUSY', 'Another controller owns the sync point. Do not remove its lock without verifying ownership.');
        await delay(25)
      }
    }
    writeFileSync(owner, JSON.stringify({ pid: process.pid, workspaceId: identity.workspaceId, at: new Date().toISOString() }))
    try {
      const state = load(), result = await operation(state)
      state.revision += 1; atomicJson(file, state); return result
    } finally { closeSync(owner); rmSync(lock) }
  }
  const slotFor = (state, number) => {
    if (!Number.isInteger(number) || number < 1 || number > validated.maxWorkers) fail('SLOT_INVALID', 'Choose a worker slot within the configured 1–10 limit.');
    return state.slots[String(number)] ?? fail('SLOT_UNASSIGNED', 'Prepare this worker slot first.');
  }
  const currentWorker = slot => {
    const found = inspectRepository(slot.worktree)
    if (found.workspaceId !== slot.workerWorkspaceId || found.branch !== slot.branch) fail('WORKER_IDENTITY_CHANGED', 'Worker worktree identity or branch changed.');
    return found
  }
  const makeSync = (state, slot) => {
    const worker = currentWorker(slot)
    return { schemaVersion: 1, runId: validated.runId, coordinatorWorkspaceId: identity.workspaceId, workerWorkspaceId: worker.workspaceId, slot: slot.number, generation: slot.generation, taskId: slot.taskId, assignmentDigest: slot.assignmentDigest, baseRevision: slot.baseRevision, headRevision: worker.head, branch: worker.branch, clean: worker.clean, phase: slot.phase, stateRevision: state.revision, observedAt: new Date().toISOString() }
  }
  function ensureHead(slot, cleanRequired = true) {
    const worker = currentWorker(slot)
    if (worker.head !== slot.headRevision || (cleanRequired && !worker.clean)) fail('SYNC_STALE', 'Worker HEAD or cleanliness changed; obtain a new reviewed sync point.');
    return worker
  }
  function changedPaths(slot) {
    const committed = git(slot.worktree, ['diff', '--name-only', '-z', `${slot.baseRevision}...HEAD`]).split('\0').filter(Boolean)
    const dirty = git(slot.worktree, ['diff', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean)
    const untracked = git(slot.worktree, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
    return [...new Set([...committed, ...dirty, ...untracked])].sort()
  }
  function scopeCheck(slot) {
    const task = taskById(slot.taskId), paths = changedPaths(slot)
    if (paths.length > 2000 || paths.some(path => protectedPath(path) || !task.allowedPaths.some(allowed => pathMatches(path, allowed)))) fail('SCOPE_VIOLATION', 'Worker changed protected paths or paths outside its assignment; preserve the worktree for Agent 0 review.');
    return paths
  }
  function cleanupCheck(slot) {
    if (slot.providerResult?.ownedGroupStopped === false || slot.checks?.results?.some(result => result.ownedGroupStopped === false)) fail('PROCESS_CLEANUP_UNVERIFIED', 'An earlier owned process group has unverified termination. Preserve this generation and inspect ownership before continuing.');
  }
  function integrationBarrier(state) {
    if (Object.values(state.slots).some(slot => ['running', 'verifying'].includes(slot.phase))) fail('INTEGRATION_BARRIER', 'Let owned provider/check processes finish before serialized remote integration.');
  }
  function verifyTarget(mergeCommit) {
    if (remoteRepository(identity.root) !== validated.repository) fail('REMOTE_MISMATCH', 'Origin changed after the reviewed delivery policy.');
    const target = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
    if (!hex(target) || !hex(mergeCommit)) fail('TARGET_UNVERIFIED', 'The current target branch or merge revision is unavailable.');
    if (target !== mergeCommit) {
      // Fetch the exact observed SHA, not a moving branch label, before proving
      // ancestry. This writes Git object metadata, never the working files.
      git(identity.root, ['fetch', '--no-tags', 'origin', target])
      if (git(identity.root, ['rev-parse', 'FETCH_HEAD']) !== target || git(identity.root, ['merge-base', '--is-ancestor', mergeCommit, target], { allowFailure: true }) === null) fail('TARGET_UNVERIFIED', 'The observed merge is not verified in the current target history. Preserve this generation for integration review.');
    }
    return { baseBranch: validated.baseBranch, targetRevision: target, mergeCommit, relation: target === mergeCommit ? 'identical' : 'ancestor', observedAt: new Date().toISOString() }
  }
  return {
    manifest: validated,
    status() { const state = load(), executions = Object.values(state.slots).filter(slot => slot.lease && existsSync(join(location, `execution-${slot.lease}.json`))).map(slot => readJsonFile(join(location, `execution-${slot.lease}.json`), true)); return { ...state, executions, stateDir: location, repository: validated.repository, hostExtension: true, canonicalTaskAcceptance: false } },
    plan() {
      const state = load(), live = Object.values(state.slots).filter(slot => slot.phase !== 'closed'), accepted = new Set(state.acceptedTaskIds)
      return { schemaVersion: 1, runId: validated.runId, manifestDigest, workspaceId: identity.workspaceId, baseline: state.baseRevision, activeWorkers: live.length, externalWorkers: validated.externalWorkers, availableSlots: Math.max(0, validated.maxWorkers - live.length - validated.externalWorkers), readyTasks: validated.tasks.filter(task => task.dependsOn.every(id => accepted.has(id)) && !accepted.has(task.id) && !Object.values(state.slots).some(slot => slot.taskId === task.id)).map(task => ({ id: task.id, title: task.title, allowedPaths: task.allowedPaths })), autoMerge: validated.autoMerge, applied: false }
    },
    next(number) {
      const state = load(), plan = this.plan(), previous = number === undefined ? null : state.slots[String(number)]
      if (previous && previous.phase !== 'closed') fail('SLOT_BUSY', 'Keep the current generation open while feedback or acceptance remains.');
      const live = Object.values(state.slots).filter(slot => slot.phase !== 'closed')
      const task = plan.readyTasks.find(candidate => !live.some(slot => candidate.allowedPaths.some(path => taskById(slot.taskId).allowedPaths.some(other => scopesOverlap(path, other))))) ?? null
      return { ...plan, nextTask: task, slot: number ?? null, freshGenerationRequired: true, previousProviderMayBeReused: Boolean(previous), providerChoiceRequired: !previous, executionAuthority: false, applied: false }
    },
    async prepare({ taskId, slot: number, executable, args = [], apply = false }) {
      return change(apply, state => {
        if (!Number.isInteger(number) || number < 1 || number > validated.maxWorkers) fail('SLOT_INVALID', 'Choose a configured worker slot from 1 through 10.');
        const old = state.slots[String(number)]
        if (old && old.phase !== 'closed') fail('SLOT_BUSY', 'Keep this branch open until feedback, merge, acceptance and closure are verified.');
        const task = taskById(taskId), slots = Object.values(state.slots), live = slots.filter(slot => slot.phase !== 'closed')
        if (live.length + validated.externalWorkers >= validated.maxWorkers) fail('CAPACITY_EXCEEDED', 'The shared CLI/app/IDE worker budget is full.');
        if (state.acceptedTaskIds.includes(taskId) || slots.some(slot => slot.taskId === taskId) || !task.dependsOn.every(id => state.acceptedTaskIds.includes(id))) fail('TASK_NOT_READY', 'Task is already assigned or its dependencies are not accepted.');
        if (live.some(slot => task.allowedPaths.some(path => taskById(slot.taskId).allowedPaths.some(other => scopesOverlap(path, other))))) fail('SCOPE_LEASE_CONFLICT', 'Another active slot owns an overlapping write scope.');
        const coordinator = inspectRepository(identity.root)
        if (!coordinator.clean || coordinator.head !== state.baseRevision || git(identity.root, ['rev-parse', validated.baseBranch]) !== state.baseRevision) fail('BASE_STALE', 'Coordinator and named base branch must be clean at the reviewed baseline.');
        if (state.acceptedTaskIds.length) {
          if (remoteRepository(identity.root) !== validated.repository) fail('REMOTE_MISMATCH', 'Origin changed before the next dispatch.');
          const currentTarget = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
          if (currentTarget !== state.baseRevision) fail('SYNC_BARRIER_REQUIRED', 'Complete and close the current wave, synchronize the coordinator and advance before dispatching a fresh generation.');
        }
        const provider = pinExecutable(executable, args)
        const generation = (old?.generation ?? 0) + 1, branch = `codex/swarm/${validated.runId}/y${String(number).padStart(2, '0')}-g${String(generation).padStart(3, '0')}-${task.id.toLowerCase()}`
        const worktree = join(location, 'worktrees', `y${number}-g${generation}`)
        safeDirectory(dirname(worktree))
        if (existsSync(worktree) || git(identity.root, ['show-ref', '--verify', `refs/heads/${branch}`], { allowFailure: true })) fail('WORKER_COLLISION', 'A branch or worktree already exists for this generation. Preserve it for review.');
        git(identity.root, ['worktree', 'add', '-b', branch, worktree, state.baseRevision])
        const worker = inspectRepository(worktree)
        const slot = { number, generation, taskId, phase: 'ready', branch, worktree, workerWorkspaceId: worker.workspaceId, baseRevision: state.baseRevision, headRevision: worker.head, assignmentDigest: digest({ manifestDigest, task }), provider, checks: null, review: null, pr: null, acceptance: null }
        state.slots[String(number)] = slot; observe(state, 'worker-prepared', number, { taskId, generation, headRevision: worker.head }); return makeSync(state, slot)
      })
    },
    sync(number, expectedDigest) {
      const state = load(), slot = slotFor(state, number), point = makeSync(state, slot)
      // A sync point is an observation, not a lock or permission to execute.
      const syncDigest = digest({ ...point, observedAt: undefined, stateRevision: undefined })
      if (expectedDigest && expectedDigest !== syncDigest) fail('SYNC_STALE', 'IDE/Codex handoff does not match the current branch, task generation and state revision.');
      return { ...point, syncDigest, executionAuthority: false }
    },
    async run({ slot: number, syncDigest, apply = false }) {
      const prepared = await change(apply, state => {
        const slot = slotFor(state, number)
        cleanupCheck(slot)
        if (!['ready', 'review', 'failed'].includes(slot.phase)) fail('PHASE_INVALID', 'Only ready, review or explicitly retried failed work may run.');
        const point = makeSync(state, slot), currentDigest = digest({ ...point, observedAt: undefined, stateRevision: undefined })
        if (!syncDigest || syncDigest !== currentDigest) fail('SYNC_STALE', 'Supply the fresh IDE/Codex sync digest for this exact generation.');
        ensureHead(slot); verifyExecutable(slot.provider)
        const task = taskById(slot.taskId), packet = { schemaVersion: 1, role: 'agent.y', coordinator: 'agent.0', alpha: 'integration-assurance', task, feedback: slot.feedback ?? null, syncPoint: point, instructions: 'Work only in this worktree and assigned paths. Commit completed changes. Do not merge, accept tasks, change remote settings, deploy or message other chats. Return original verification evidence to Agent 0.' }
        const input = `${JSON.stringify(packet)}\n`
        if (Buffer.byteLength(input) > swarmLimits.packetBytes) fail('PACKET_LIMIT', 'The bounded handoff packet is too large.');
        slot.phase = 'running'; slot.lease = randomUUID(); observe(state, 'provider-launch-requested', number, { headRevision: slot.headRevision, lease: slot.lease })
        return { lease: slot.lease, generation: slot.generation, assignmentDigest: slot.assignmentDigest, provider: slot.provider, worktree: slot.worktree, input }
      })
      const result = await runChild(prepared.provider.executable, prepared.provider.args, { cwd: prepared.worktree, input: prepared.input, onSpawn: owner => atomicJson(join(location, `execution-${prepared.lease}.json`), { ...owner, lease: prepared.lease, generation: prepared.generation, assignmentDigest: prepared.assignmentDigest, providerSha256: prepared.provider.sha256 }) })
      atomicJson(join(location, `completion-${prepared.lease}.json`), { lease: prepared.lease, generation: prepared.generation, assignmentDigest: prepared.assignmentDigest, result })
      return change(apply, state => {
        const slot = slotFor(state, number)
        if (slot.phase !== 'running' || slot.lease !== prepared.lease || slot.generation !== prepared.generation || slot.assignmentDigest !== prepared.assignmentDigest) fail('LEASE_STALE', 'Provider completion does not own the current worker generation.');
        slot.headRevision = currentWorker(slot).head; slot.checks = null; slot.review = null; slot.alpha = null
        slot.providerResult = result; slot.phase = result.exitCode === 0 && !result.timedOut && !result.outputLimit && !result.pipeDeadline && result.ownedGroupStopped ? 'review' : 'failed'; delete slot.lease
        try { scopeCheck(slot) } catch (error) { slot.phase = 'failed'; slot.failureCode = error.code; observe(state, 'scope-refused', number, { code: error.code }); atomicJson(file, state); throw error }
        observe(state, 'provider-exited', number, { headRevision: slot.headRevision, exitCode: result.exitCode, phase: slot.phase }); return { phase: slot.phase, headRevision: slot.headRevision, result, acceptanceGranted: false }
      })
    },
    async verify({ slot: number, apply = false }) {
      const prepared = await change(apply, state => {
        const slot = slotFor(state, number)
        cleanupCheck(slot)
        if (!['review', 'checks', 'failed'].includes(slot.phase)) fail('PHASE_INVALID', 'Provider work must reach review before verification.');
        ensureHead(slot); const paths = scopeCheck(slot), task = taskById(slot.taskId)
        slot.phase = 'verifying'; slot.review = null; slot.alpha = null; slot.lease = randomUUID(); observe(state, 'checks-started', number, { headRevision: slot.headRevision, lease: slot.lease })
        return { lease: slot.lease, generation: slot.generation, assignmentDigest: slot.assignmentDigest, headRevision: slot.headRevision, worktree: slot.worktree, checks: task.checks, paths }
      })
      const results = []
      for (const [index, check] of prepared.checks.entries()) results.push(await runChild(check.executable, check.args, { cwd: prepared.worktree, onSpawn: owner => atomicJson(join(location, `execution-${prepared.lease}.json`), { ...owner, lease: prepared.lease, generation: prepared.generation, assignmentDigest: prepared.assignmentDigest, checkIndex: index }) }))
      atomicJson(join(location, `completion-${prepared.lease}.json`), { lease: prepared.lease, generation: prepared.generation, assignmentDigest: prepared.assignmentDigest, results })
      return change(apply, state => {
        const slot = slotFor(state, number)
        if (slot.phase !== 'verifying' || slot.lease !== prepared.lease || slot.generation !== prepared.generation || slot.assignmentDigest !== prepared.assignmentDigest) fail('LEASE_STALE', 'Check completion does not own the current worker generation.');
        ensureHead(slot); scopeCheck(slot)
        const passed = results.every(result => result.exitCode === 0 && !result.timedOut && !result.outputLimit && !result.pipeDeadline && result.ownedGroupStopped)
        slot.checks = { headRevision: slot.headRevision, assignmentDigest: slot.assignmentDigest, passed, results, observedAt: new Date().toISOString() }; slot.phase = passed ? 'checks' : 'failed'; delete slot.lease
        observe(state, 'checks-observed', number, { headRevision: slot.headRevision, passed }); return { phase: slot.phase, paths: prepared.paths, ...slot.checks, acceptanceGranted: false }
      })
    },
    async review({ slot: number, reviewer, evidenceDigest, apply = false }) {
      return change(apply, state => {
        const slot = slotFor(state, number); ensureHead(slot); scopeCheck(slot)
        if (reviewer !== 'agent.z' || !/^[a-f0-9]{64}$/.test(evidenceDigest ?? '') || !slot.checks?.passed || slot.checks.headRevision !== slot.headRevision) fail('REVIEW_REQUIRED', 'An independent Agent Z review must bind passing checks and the exact worker HEAD.');
        slot.review = { reviewer, headRevision: slot.headRevision, evidenceDigest, at: new Date().toISOString() }; slot.phase = 'merge-eligible'; observe(state, 'review-recorded', number, slot.review); return { ...slot.review, recordedOperatorAssertion: true, remoteApprovalGranted: false }
      })
    },
    async alpha({ slot: number, evidenceDigest, expiresMinutes = 10, apply = false }) {
      return change(apply, state => {
        const slot = slotFor(state, number); ensureHead(slot); scopeCheck(slot)
        if (slot.phase !== 'merge-eligible' || slot.review?.reviewer !== 'agent.z' || slot.review.headRevision !== slot.headRevision || !slot.checks?.passed || slot.checks.headRevision !== slot.headRevision || !/^[a-f0-9]{64}$/.test(evidenceDigest ?? '') || !Number.isInteger(expiresMinutes) || expiresMinutes < 1 || expiresMinutes > 15) fail('ALPHA_REQUIRED', 'Alpha requires the exact-head Z review, passing checks, integration evidence and a 1–15 minute lease.');
        slot.alpha = { role: 'agent.alpha', workspaceId: identity.workspaceId, taskId: slot.taskId, generation: slot.generation, assignmentDigest: slot.assignmentDigest, headRevision: slot.headRevision, baseRevision: slot.baseRevision, reviewDigest: digest(slot.review), checksDigest: digest(slot.checks), evidenceDigest, expiresAt: new Date(Date.now() + expiresMinutes * 60_000).toISOString() }
        observe(state, 'alpha-lease-recorded', number, slot.alpha); return { ...slot.alpha, recordedOperatorAssertion: true, independentIdentityAuthenticated: false }
      })
    },
    async feedback({ slot: number, reason, apply = false }) {
      return change(apply, state => {
        const slot = slotFor(state, number)
        cleanupCheck(slot)
        if (['running', 'verifying', 'merge-pending', 'merged', 'accepted', 'closed'].includes(slot.phase)) fail('PHASE_INVALID', 'Feedback can reopen only an unmerged worker generation.');
        const worker = currentWorker(slot)
        if (!worker.clean || git(slot.worktree, ['merge-base', '--is-ancestor', slot.baseRevision, worker.head], { allowFailure: true }) === null) fail('SYNC_STALE', 'Keep the reviewed base ancestry and commit the worker draft before feedback.');
        scopeCheck(slot); slot.headRevision = worker.head; slot.phase = 'review'; slot.checks = null; slot.review = null; slot.alpha = null; slot.feedback = text(reason, 1400)
        observe(state, 'feedback-assigned', number, { headRevision: slot.headRevision }); return { phase: slot.phase, branch: slot.branch, checksInvalidated: true, nextRunNeedsFreshSync: true }
      })
    },
    async integrate({ slot: number, baseRevision, apply = false }) {
      return change(apply, state => {
        integrationBarrier(state)
        const slot = slotFor(state, number); cleanupCheck(slot); ensureHead(slot); scopeCheck(slot)
        if (!['ready', 'review', 'checks', 'merge-eligible', 'failed'].includes(slot.phase) || !hex(baseRevision)) fail('PHASE_INVALID', 'Select an unmerged worker and a reviewed full target revision.');
        verifyTarget(baseRevision)
        git(identity.root, ['fetch', '--no-tags', 'origin', `refs/heads/${validated.baseBranch}`])
        if (git(identity.root, ['rev-parse', 'FETCH_HEAD']) !== baseRevision) fail('BASE_STALE', 'Target advanced while obtaining its reviewed commit.');
        slot.baseRevision = baseRevision; slot.checks = null; slot.review = null; slot.alpha = null
        try {
          git(slot.worktree, ['merge', '--no-edit', baseRevision]); slot.headRevision = currentWorker(slot).head; scopeCheck(slot); slot.phase = 'review'
          observe(state, 'worker-base-integrated', number, { baseRevision, headRevision: slot.headRevision }); return { phase: slot.phase, baseRevision, headRevision: slot.headRevision, checksInvalidated: true, branch: slot.branch }
        } catch (error) {
          slot.headRevision = currentWorker(slot).head; slot.phase = 'failed'; slot.failureCode = error.code ?? 'INTEGRATION_CONFLICT'; observe(state, 'worker-integration-refused', number, { baseRevision, headRevision: slot.headRevision, code: slot.failureCode }); return { phase: slot.phase, warningCode: slot.failureCode, worktreePreserved: true, automaticConflictResolution: false }
        }
      })
    },
    publishPlan({ slot: number }) {
      const state = load(), slot = slotFor(state, number); integrationBarrier(state); ensureHead(slot); scopeCheck(slot)
      if (!slot.checks?.passed || slot.checks.headRevision !== slot.headRevision || slot.review?.headRevision !== slot.headRevision || slot.headRevision === slot.baseRevision || !['merge-eligible', 'publication-pending'].includes(slot.phase)) fail('PUBLICATION_NOT_READY', 'A committed change, passing checks and independent review are required before PR publication.');
      if (remoteRepository(identity.root) !== validated.repository) fail('REMOTE_MISMATCH', 'Origin no longer identifies the authorized GitHub repository.');
      const base = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
      if (base !== slot.baseRevision) fail('BASE_STALE', 'Remote base changed before publication.');
      return { repository: validated.repository, branch: slot.branch, headRevision: slot.headRevision, baseRevision: slot.baseRevision, taskId: slot.taskId, draft: true, applied: false }
    },
    async publish({ slot: number, ghExecutable = 'gh', apply = false }) {
      return change(apply, state => {
        const plan = this.publishPlan({ slot: number }), slot = slotFor(state, number)
        // Read before any retry: a previous uncertain create may already exist.
        const existing = github(ghExecutable, ['pr', 'list', '--repo', validated.repository, '--head', slot.branch, '--state', 'all', '--json', 'number,state,isDraft,headRefName,headRefOid,baseRefName,url'], identity.root)
        if (!Array.isArray(existing) || existing.length > 1 || (existing.length === 1 && (existing[0].state !== 'OPEN' || existing[0].headRefName !== slot.branch || existing[0].baseRefName !== validated.baseBranch || (existing[0].headRefOid !== slot.headRevision && (existing[0].number !== slot.pr?.number || existing[0].headRefOid !== slot.pr.headRevision || git(slot.worktree, ['merge-base', '--is-ancestor', existing[0].headRefOid, slot.headRevision], { allowFailure: true }) === null))))) fail('PUBLICATION_UNVERIFIED', 'Existing pull request state does not match this owned worker generation.');
        if (existing.length === 1 && existing[0].headRefOid === slot.headRevision) { slot.pr = { number: existing[0].number, url: existing[0].url, headRevision: slot.headRevision }; slot.phase = 'merge-eligible'; observe(state, 'draft-pr-recovered', number, slot.pr); return { ...plan, applied: true, pr: slot.pr, recovered: true, acceptanceGranted: false } }
        try {
        git(slot.worktree, ['push', '--set-upstream', 'origin', `${slot.headRevision}:refs/heads/${slot.branch}`])
        const remote = git(slot.worktree, ['ls-remote', '--exit-code', 'origin', `refs/heads/${slot.branch}`])?.split(/\s+/)[0]
        if (remote !== slot.headRevision) fail('PUBLICATION_UNVERIFIED', 'Published branch HEAD does not match the worker.');
        const task = taskById(slot.taskId), body = join(location, `pr-${number}-${slot.generation}.md`)
        const content = `${task.title}\n\nAcceptance:\n${task.acceptance.map(item => `- ${item}`).join('\n')}\n\nVerification: local checks passed at ${slot.headRevision}; independent ${slot.review.reviewer} evidence ${slot.review.evidenceDigest}. Merge and Agent 0 acceptance remain separate.\n`
        const fd = openSync(body, 'wx', 0o600); try { writeFileSync(fd, content) } finally { closeSync(fd) }
        try { if (!existing.length) {
          github(ghExecutable, ['pr', 'create', '--repo', validated.repository, '--head', slot.branch, '--base', validated.baseBranch, '--draft', '--title', task.title, '--body-file', body], identity.root, false)
        } } finally { rmSync(body) }
        const pr = github(ghExecutable, ['pr', 'view', slot.branch, '--repo', validated.repository, '--json', 'number,state,isDraft,headRefName,headRefOid,baseRefName,url'], identity.root)
        if (pr.state !== 'OPEN' || pr.headRefOid !== slot.headRevision || pr.headRefName !== slot.branch || pr.baseRefName !== validated.baseBranch || !Number.isInteger(pr.number)) fail('PUBLICATION_UNVERIFIED', 'Pull request outcome is unverified; inspect before retrying creation.');
        slot.pr = { number: pr.number, url: pr.url, headRevision: slot.headRevision }; observe(state, 'draft-pr-verified', number, slot.pr)
        slot.phase = 'merge-eligible'
        return { ...plan, applied: true, pr: slot.pr, acceptanceGranted: false }
        } catch (error) {
          slot.phase = 'publication-pending'; observe(state, 'publication-outcome-unverified', number, { headRevision: slot.headRevision, code: error.code ?? 'PUBLICATION_UNVERIFIED' })
          return { phase: slot.phase, applied: true, headRevision: slot.headRevision, warningCode: error.code ?? 'PUBLICATION_UNVERIFIED', retryRequiresFreshReadback: true, acceptanceGranted: false }
        }
      })
    },
    async ready({ slot: number, ghExecutable = 'gh', apply = false }) {
      return change(apply, state => {
        integrationBarrier(state)
        const slot = slotFor(state, number); ensureHead(slot); scopeCheck(slot)
        if (!slot.pr || slot.review?.headRevision !== slot.headRevision || !slot.checks?.passed || slot.checks.headRevision !== slot.headRevision) fail('REVIEW_REQUIRED', 'The exact published worker HEAD needs checks and independent review before readiness.');
        const pr = github(ghExecutable, ['pr', 'view', String(slot.pr.number), '--repo', validated.repository, '--json', 'state,headRefName,headRefOid,baseRefName'], identity.root)
        if (pr.state !== 'OPEN' || pr.headRefOid !== slot.headRevision || pr.headRefName !== slot.branch || pr.baseRefName !== validated.baseBranch) fail('PR_NOT_READY', 'Pull request identity changed before readiness.');
        github(ghExecutable, ['pr', 'ready', String(slot.pr.number), '--repo', validated.repository], identity.root, false); observe(state, 'pr-ready-requested', number, { headRevision: slot.headRevision }); return { phase: slot.phase, readinessRequested: true, remoteReviewStillRequired: true }
      })
    },
    async mergePlan({ slot: number, prNumber, ghExecutable = 'gh' }) {
      const state = load(), slot = slotFor(state, number); integrationBarrier(state); ensureHead(slot); scopeCheck(slot)
      if (!validated.autoMerge || !slot.checks?.passed || slot.checks.headRevision !== slot.headRevision || slot.review?.headRevision !== slot.headRevision || slot.phase !== 'merge-eligible') fail('MERGE_NOT_READY', 'Auto merge requires the explicit policy, exact-head checks and independent review.');
      qualifyAlpha(slot, identity.workspaceId)
      if (remoteRepository(identity.root) !== validated.repository) fail('REMOTE_MISMATCH', 'Origin no longer identifies the authorized GitHub repository.');
      const remoteHead = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
      if (remoteHead !== slot.baseRevision) fail('BASE_STALE', 'Remote base advanced. Reconcile the branch and repeat checks/review before merging.');
      if (!Number.isInteger(prNumber) || prNumber < 1) fail('PR_INVALID', 'Select an exact pull request number.');
      const pr = github(ghExecutable, ['pr', 'view', String(prNumber), '--repo', validated.repository, '--json', 'number,state,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,url'], identity.root)
      const protection = github(ghExecutable, ['api', `repos/${validated.repository}/branches/${encodeURIComponent(validated.baseBranch)}/protection`], identity.root)
      qualifyProtection(protection, validated.requiredChecks)
      const result = qualifyPullRequest({ pr, slot, manifest: validated })
      return { schemaVersion: 1, applied: false, repository: validated.repository, prNumber, headRevision: slot.headRevision, baseRevision: slot.baseRevision, planDigest: digest(result), ...result }
    },
    async merge({ slot: number, prNumber, planDigest, ghExecutable = 'gh', apply = false }) {
      return change(apply, async state => {
        // Re-query immediately inside the controller lock; stale previews grant no authority.
        const plan = await this.mergePlan({ slot: number, prNumber, ghExecutable })
        if (!planDigest || plan.planDigest !== planDigest) fail('MERGE_PLAN_STALE', 'The observed pull request or merge plan changed.');
        const slot = slotFor(state, number)
        qualifyAlpha(slot, identity.workspaceId)
        const currentBase = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
        if (currentBase !== slot.baseRevision) fail('BASE_STALE', 'Remote base changed after the merge preview; repeat integration checks and review.');
        qualifyAlpha(slot, identity.workspaceId)
        // REST's immediate merge endpoint binds the expected HEAD and refuses
        // queue-only branches; `gh pr merge` can implicitly enqueue even without --auto.
        try {
        const merged = github(ghExecutable, ['api', '--method', 'PUT', `repos/${validated.repository}/pulls/${prNumber}/merge`, '--raw-field', `sha=${slot.headRevision}`, '--raw-field', 'merge_method=squash'], identity.root)
        atomicJson(join(location, `merge-attempt-${number}-${slot.generation}-${slot.headRevision}.json`), { repository: validated.repository, prNumber, headRevision: slot.headRevision, merged: merged.merged === true, mergeCommit: hex(merged.sha) ? merged.sha : null })
        const pr = github(ghExecutable, ['pr', 'view', String(prNumber), '--repo', validated.repository, '--json', 'number,state,headRefOid,baseRefName,mergeCommit,url'], identity.root)
        if (pr.headRefOid !== slot.headRevision || pr.baseRefName !== validated.baseBranch || !['OPEN', 'MERGED'].includes(pr.state) || (pr.state === 'MERGED' && !hex(pr.mergeCommit?.oid))) fail('MERGE_UNVERIFIED', 'GitHub merge outcome is unverified; inspect before retrying.');
        if (pr.state === 'OPEN') { slot.phase = 'merge-pending'; slot.pr = { number: prNumber, url: pr.url, headRevision: slot.headRevision }; observe(state, 'merge-outcome-unverified', number, slot.pr); return { phase: slot.phase, ...slot.pr, acceptanceGranted: false, deferredAutoMergeRequested: false } }
        if (merged.merged !== true || merged.sha !== pr.mergeCommit.oid) fail('MERGE_UNVERIFIED', 'Immediate merge receipt and pull request readback disagree.');
        slot.targetObservation = verifyTarget(pr.mergeCommit.oid)
        slot.pr = { number: prNumber, url: pr.url, headRevision: slot.headRevision, mergeCommit: pr.mergeCommit.oid }; slot.phase = 'merged'; observe(state, 'merge-verified', number, slot.pr)
        return { phase: slot.phase, ...slot.pr, acceptanceGranted: false }
        } catch (error) {
          slot.phase = 'merge-pending'; slot.pr = { number: prNumber, headRevision: slot.headRevision, url: plan.url }; observe(state, 'merge-outcome-unverified', number, { ...slot.pr, code: error.code ?? 'MERGE_UNVERIFIED' })
          return { phase: slot.phase, ...slot.pr, warningCode: error.code ?? 'MERGE_UNVERIFIED', retryAllowed: false, acceptanceGranted: false }
        }
      })
    },
    async observeMerge({ slot: number, ghExecutable = 'gh', apply = false }) {
      return change(apply, state => {
        integrationBarrier(state)
        const slot = slotFor(state, number); ensureHead(slot)
        if (slot.phase !== 'merge-pending' || !slot.pr) fail('PHASE_INVALID', 'Only an uncertain requested merge can be observed.');
        const pr = github(ghExecutable, ['pr', 'view', String(slot.pr.number), '--repo', validated.repository, '--json', 'number,state,headRefOid,baseRefName,mergeCommit,url'], identity.root)
        if (pr.headRefOid !== slot.headRevision || pr.baseRefName !== validated.baseBranch || !['OPEN', 'MERGED'].includes(pr.state)) fail('MERGE_UNVERIFIED', 'Requested pull request identity or state changed.');
        if (pr.state === 'OPEN') return { phase: slot.phase, merged: false, acceptanceGranted: false }
        if (!hex(pr.mergeCommit?.oid)) fail('MERGE_UNVERIFIED', 'GitHub did not return a verified merge commit.');
        slot.targetObservation = verifyTarget(pr.mergeCommit.oid)
        slot.pr.mergeCommit = pr.mergeCommit.oid; slot.phase = 'merged'; observe(state, 'merge-verified', number, slot.pr); return { phase: slot.phase, ...slot.pr, acceptanceGranted: false }
      })
    },
    async accept({ slot: number, reviewer, evidenceDigest, ghExecutable = 'gh', apply = false }) {
      return change(apply, state => {
        integrationBarrier(state)
        const slot = slotFor(state, number); ensureHead(slot)
        if (slot.phase !== 'merged' || reviewer !== 'agent.0' || !/^[a-f0-9]{64}$/.test(evidenceDigest ?? '')) fail('ACCEPTANCE_REQUIRED', 'Agent 0 must review original task acceptance and integration evidence after the merge.');
        const pr = github(ghExecutable, ['pr', 'view', String(slot.pr.number), '--repo', validated.repository, '--json', 'state,headRefOid,baseRefName,mergeCommit'], identity.root)
        if (pr.state !== 'MERGED' || pr.headRefOid !== slot.headRevision || pr.baseRefName !== validated.baseBranch || pr.mergeCommit?.oid !== slot.pr.mergeCommit) fail('MERGE_UNVERIFIED', 'Fresh pull request target and merge evidence do not match the accepted candidate.');
        slot.targetObservation = verifyTarget(slot.pr.mergeCommit)
        slot.acceptance = { reviewer, evidenceDigest, mergeCommit: slot.pr.mergeCommit, at: new Date().toISOString() }; slot.phase = 'accepted'; state.acceptedTaskIds.push(slot.taskId); observe(state, 'delivery-accepted', number, slot.acceptance)
        return { phase: slot.phase, ...slot.acceptance, canonicalTaskLedgerUpdated: false, recordedOperatorAssertion: true }
      })
    },
    async close({ slot: number, ghExecutable = 'gh', deleteBranch = false, apply = false }) {
      return change(apply, state => {
        integrationBarrier(state)
        const slot = slotFor(state, number); ensureHead(slot); scopeCheck(slot)
        cleanupCheck(slot)
        if (slot.phase !== 'accepted' || !slot.acceptance) fail('CLOSURE_NOT_READY', 'Merge and Agent 0 acceptance are required before closing a worker generation.');
        const pr = github(ghExecutable, ['pr', 'view', String(slot.pr.number), '--repo', validated.repository, '--json', 'state,headRefOid,baseRefName,mergeCommit'], identity.root)
        if (pr.state !== 'MERGED' || pr.headRefOid !== slot.headRevision || pr.baseRefName !== validated.baseBranch || pr.mergeCommit?.oid !== slot.pr.mergeCommit) fail('CLOSURE_UNVERIFIED', 'Pull request closure does not match the accepted merge.');
        slot.targetObservation = verifyTarget(slot.pr.mergeCommit)
        if (deleteBranch) {
          if (remoteRepository(identity.root) !== validated.repository) fail('REMOTE_MISMATCH', 'Origin changed before branch retirement.');
          const ignored = git(slot.worktree, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'])
          if (ignored) fail('CLOSURE_LOCAL_DATA', 'Ignored worktree data must be preserved separately before branch retirement.');
          const archiveDir = safeDirectory(join(location, 'archive')), archive = join(archiveDir, `y${number}-g${slot.generation}-${slot.headRevision}.bundle`)
          if (!existsSync(archive)) git(identity.root, ['bundle', 'create', archive, `refs/heads/${slot.branch}`])
          const archiveEntry = lstatSync(archive)
          if (!archiveEntry.isFile() || archiveEntry.isSymbolicLink() || archiveEntry.size > swarmLimits.bundleBytes) fail('CLOSURE_BACKUP_INVALID', 'Recovery bundle must be an unlinked regular file within the declared 128 MiB budget.');
          chmodSync(archive, 0o600); git(identity.root, ['bundle', 'verify', archive])
          const heads = git(identity.root, ['bundle', 'list-heads', archive]).split(/\r?\n/)
          if (!heads.includes(`${slot.headRevision} refs/heads/${slot.branch}`)) fail('CLOSURE_BACKUP_INVALID', 'Recovery bundle does not contain the exact worker branch HEAD.');
          const archiveFd = openSync(archive, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
          try { const entry = fstatSync(archiveFd); if (!entry.isFile() || entry.size > swarmLimits.bundleBytes) fail('CLOSURE_BACKUP_INVALID', 'Recovery bundle changed after verification.'); slot.archive = { sha256: digest(readFileSync(archiveFd)), headRevision: slot.headRevision, file: archive } } finally { closeSync(archiveFd) }
          atomicJson(file, state)
          const remoteHead = git(identity.root, ['ls-remote', 'origin', `refs/heads/${slot.branch}`])?.split(/\s+/)[0]
          if (remoteHead && remoteHead !== slot.headRevision) fail('CLOSURE_UNVERIFIED', 'Remote branch advanced; preserve it instead of deleting another revision.');
          if (remoteHead) git(identity.root, ['push', `--force-with-lease=refs/heads/${slot.branch}:${slot.headRevision}`, 'origin', `:refs/heads/${slot.branch}`])
          if (git(identity.root, ['ls-remote', 'origin', `refs/heads/${slot.branch}`])) fail('CLOSURE_UNVERIFIED', 'Remote branch deletion is unverified.');
          git(identity.root, ['worktree', 'remove', slot.worktree])
          git(identity.root, ['update-ref', '-d', `refs/heads/${slot.branch}`, slot.headRevision])
        }
        slot.phase = 'closed'; slot.branchRetired = deleteBranch; observe(state, 'generation-closed', number, { taskId: slot.taskId, branch: slot.branch, headRevision: slot.headRevision, branchRetired: deleteBranch }); return { phase: 'closed', slot: number, branchRetained: !deleteBranch, worktreeRetained: !deleteBranch, nextTaskNeedsFreshGeneration: true }
      })
    },
    async advance({ baseRevision, apply = false }) {
      return change(apply, state => {
        if (!hex(baseRevision) || Object.values(state.slots).some(slot => slot.phase !== 'closed')) fail('SYNC_BARRIER_REQUIRED', 'Close and verify every current generation before advancing the shared IDE/Codex base.');
        const coordinator = inspectRepository(identity.root)
        const remote = git(identity.root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${validated.baseBranch}`])?.split(/\s+/)[0]
        if (!coordinator.clean || coordinator.head !== baseRevision || git(identity.root, ['rev-parse', validated.baseBranch]) !== baseRevision || remote !== baseRevision) fail('BASE_STALE', 'The clean coordinator, named base branch and remote must agree at the new sync point.');
        if (git(identity.root, ['merge-base', '--is-ancestor', state.baseRevision, baseRevision], { allowFailure: true }) === null) fail('BASE_DIVERGED', 'The next sync point must descend from the previously reviewed base.');
        const previousBaseRevision = state.baseRevision; state.baseRevision = baseRevision; observe(state, 'sync-barrier-advanced', null, { previousBaseRevision, baseRevision }); return { baseRevision, nextTasksRequireFreshPreparation: true, applied: true }
      })
    },
  }
}

export function pinExecutable(executable, args = []) {
  command({ executable, args })
  if (!isAbsolute(executable)) fail('PROVIDER_PATH_INVALID', 'Select an absolute installed provider executable.');
  const target = resolve(executable)
  if (realpathSync(target) !== target || lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) fail('PROVIDER_PATH_INVALID', 'Provider executable must be a canonical regular file without links.');
  const info = statSync(target)
  return { executable: target, args: [...args], sha256: digest(readFileSync(target)), device: String(info.dev), inode: String(info.ino), size: info.size }
}
function verifyExecutable(provider) {
  const next = pinExecutable(provider.executable, provider.args)
  if (JSON.stringify(next) !== JSON.stringify(provider)) fail('PROVIDER_CHANGED', 'Provider executable changed after preparation. Review and prepare another generation.');
}
export function runChild(executable, args, { cwd, input = '', timeoutMs = swarmLimits.timeoutMs, outputBytes = swarmLimits.outputBytes, onSpawn = () => {} } = {}) {
  command({ executable, args })
  if (process.platform === 'win32') fail('PROVIDER_HOST_UNVERIFIED', 'Native Windows execution is unavailable until descendant termination is qualified. Planning and record inspection remain supported.');
  return new Promise(resolveChild => {
    const child = spawn(executable, args, { cwd, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const hashes = { stdout: createHash('sha256'), stderr: createHash('sha256') }, sizes = { stdout: 0, stderr: 0 }
    let timedOut = false, outputLimit = false, spawnFailed = false, stopped = false, settled = false, finalizer
    const stop = () => { if (stopped) return; stopped = true; try { process.kill(-child.pid, 'SIGKILL') } catch { /* Owned group may already have exited. */ } }
    const finish = async (code = null, signal = null, pipeDeadline = false) => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(finalizer); stop()
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy()
      let ownedGroupStopped = true
      if (child.pid) {
        const deadline = Date.now() + 500
        while (true) { try { process.kill(-child.pid, 0); ownedGroupStopped = false } catch { ownedGroupStopped = true; break } if (Date.now() >= deadline) break; await delay(20) }
      }
      resolveChild({ exitCode: spawnFailed ? null : code, signal, timedOut, outputLimit, spawnFailed, pipeDeadline, ownedGroupStopped, ownedProcessGroup: child.pid ?? null, terminationBoundary: 'owned-process-group; detached descendants unqualified', stdoutBytes: sizes.stdout, stderrBytes: sizes.stderr, stdoutSha256: hashes.stdout.digest('hex'), stderrSha256: hashes.stderr.digest('hex') })
    }
    const stopBounded = () => { stop(); finalizer ??= setTimeout(() => finish(null, 'SIGKILL', true), 250) }
    const timer = setTimeout(() => { timedOut = true; stopBounded() }, timeoutMs)
    for (const name of ['stdout', 'stderr']) child[name].on('data', bytes => { if (settled) return; sizes[name] += bytes.length; hashes[name].update(bytes); if (sizes.stdout + sizes.stderr > outputBytes) { outputLimit = true; stopBounded() } })
    child.on('error', () => { spawnFailed = true })
    if (child.pid) { try { onSpawn({ pid: child.pid, processGroup: child.pid, controllerPid: process.pid, spawnedAt: new Date().toISOString(), workspaceId: digest(cwd) }) } catch { spawnFailed = true; stopBounded() } }
    child.stdin.on('error', () => {}); child.stdin.end(input)
    child.on('close', (code, signal) => finish(code, signal ?? null))
  })
}
function github(executable, args, cwd, parse = true) {
  command({ executable, args })
  const result = spawnSync(executable, args, { cwd, shell: false, encoding: 'utf8', maxBuffer: 1_000_000, timeout: 30_000, windowsHide: true })
  if (result.error || result.status !== 0) fail('GITHUB_QUERY_FAILED', 'GitHub action failed; inspect remote state before retrying.');
  if (!parse) return null
  try { return JSON.parse(result.stdout) } catch { fail('GITHUB_RESPONSE_INVALID', 'GitHub returned an unsupported response.'); }
}
export function qualifyPullRequest({ pr, slot, manifest }) {
  if (!pr || pr.state !== 'OPEN' || pr.isDraft !== false || pr.headRefOid !== slot.headRevision || pr.headRefName !== slot.branch || pr.baseRefName !== manifest.baseBranch || pr.baseRefOid !== slot.baseRevision || pr.mergeable !== 'MERGEABLE' || pr.mergeStateStatus !== 'CLEAN' || pr.reviewDecision !== 'APPROVED' || !Array.isArray(pr.statusCheckRollup)) fail('PR_NOT_READY', 'Pull request identity, base, review or mergeability is not ready.');
  const checks = pr.statusCheckRollup.map(check => ({ name: check.name ?? check.context, state: check.conclusion ?? check.state, status: check.status }))
  if (!manifest.requiredChecks.length || manifest.requiredChecks.some(name => { const matching = checks.filter(check => check.name === name); return matching.length !== 1 || !['SUCCESS', 'SUCCESSFUL'].includes(matching[0].state) || (matching[0].status && matching[0].status !== 'COMPLETED') }) || checks.some(check => !['SUCCESS', 'SUCCESSFUL', 'SKIPPED', 'NEUTRAL'].includes(check.state))) fail('CHECKS_NOT_READY', 'Every named required check must have one unambiguous terminal success at the exact pull request HEAD.');
  return { prNumber: pr.number, headRevision: slot.headRevision, baseRevision: slot.baseRevision, requiredChecks: [...manifest.requiredChecks], reviewDecision: pr.reviewDecision, mergeable: pr.mergeable, url: pr.url, policy: 'squash-exact-head-no-admin-bypass', acceptanceGranted: false }
}

export function qualifyProtection(protection, requiredChecks) {
  const checks = protection?.required_status_checks, reviews = protection?.required_pull_request_reviews
  const names = new Set([...(checks?.contexts ?? []), ...(checks?.checks ?? []).map(check => check.context)])
  if (checks?.strict !== true || requiredChecks.some(name => !names.has(name)) || !reviews || !Number.isInteger(reviews.required_approving_review_count) || reviews.required_approving_review_count < 1 || reviews.dismiss_stale_reviews !== true || protection.enforce_admins?.enabled !== true) fail('PROTECTION_UNVERIFIED', 'Auto merge requires observed strict required checks, stale-review dismissal, required approval and enforced protection for administrators.');
  return true
}
function qualifyAlpha(slot, workspaceId) {
  const lease = slot.alpha
  if (!lease || lease.role !== 'agent.alpha' || lease.workspaceId !== workspaceId || lease.taskId !== slot.taskId || lease.generation !== slot.generation || lease.assignmentDigest !== slot.assignmentDigest || lease.headRevision !== slot.headRevision || lease.baseRevision !== slot.baseRevision || lease.reviewDigest !== digest(slot.review) || lease.checksDigest !== digest(slot.checks) || !Number.isFinite(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= Date.now()) fail('ALPHA_LEASE_STALE', 'A current Alpha integration lease must bind the task, generation, base, HEAD, review and check evidence.');
}

export function loadManifest(path) { return validateManifest(readJsonFile(path)) }
export const supportedPhases = Object.freeze(phases)
