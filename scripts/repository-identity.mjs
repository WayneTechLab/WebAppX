#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultRepository = 'WayneTechLab/WebAppX'
export const identityProbeOptions = Object.freeze({ shell: false, timeout: 10_000, maxBuffer: 1_048_576, encoding: 'utf8', windowsHide: true })
export const identityReportLimits = Object.freeze({ changes: 50, pathLength: 240, refLength: 256 })
const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const scope = 'Read-only repository observations for an already authorized publish review. Local tracking refs are cached evidence; direct main is queried separately. This receipt grants no publication or deployment authority and does not run release gates.'

export function normalizeRepository(value) {
  if (typeof value !== 'string' || value.length > 140) return null
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]{1,100})$/.exec(value)
  if (!match || ['.', '..'].includes(match[2])) return null
  return `${match[1]}/${match[2]}`
}

/** Accept only credential-free GitHub HTTPS or the standard Git SSH identity.
 * No URL, credential, protocol argument or raw Git error enters the report.
 */
export function repositoryFromOrigin(value) {
  if (typeof value !== 'string' || value.length > 230 || /[\s\u0000-\u001f\u007f]/.test(value)) return null
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/?#]+\/[^/?#]+)$/i.exec(value)
  if (!match) return null
  return normalizeRepository(match[1].replace(/\.git$/i, ''))
}

function validRef(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= identityReportLimits.refLength
    && /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(value)
    && !value.includes('..') && !value.includes('//') && !value.endsWith('/') && !value.endsWith('.')
    && !value.split('/').some(part => part.endsWith('.lock'))
}

function displayPath(value) {
  // Git -z emits repository-relative paths. Refuse unexpected absolute or
  // traversing names, including Windows forms, rather than exposing them.
  if (!value || value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)
    || value.split('/').some(part => part === '..' || part === '.' || part === '')) return { path: '[unsafe path omitted]', pathTruncated: true }
  return value.length > identityReportLimits.pathLength
    ? { path: `${value.slice(0, identityReportLimits.pathLength)}…`, pathTruncated: true }
    : { path: value, pathTruncated: false }
}

/** Porcelain v2 -z retains spaces and rename source paths without shell quoting. */
export function parseRepositoryStatus(output) {
  const empty = { state: 'known', tracked: 0, staged: 0, unstaged: 0, untracked: 0, conflicts: 0, changes: [], omittedChanges: 0, pathsTruncated: false }
  if (typeof output !== 'string' || (output && !output.endsWith('\0'))) return null
  const records = output ? output.slice(0, -1).split('\0') : []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    let kind; let status; let path; let originalPath
    if (record.startsWith('? ')) {
      kind = 'untracked'; status = '??'; path = record.slice(2); empty.untracked += 1
    } else {
      const type = record[0]
      const fieldCount = type === '1' ? 8 : type === '2' ? 9 : type === 'u' ? 10 : 0
      if (!fieldCount) return null
      const fields = []; let offset = 0
      for (let field = 0; field < fieldCount; field += 1) {
        const next = record.indexOf(' ', offset)
        if (next <= offset) return null
        fields.push(record.slice(offset, next)); offset = next + 1
      }
      status = fields[1]; path = record.slice(offset)
      if (!/^[.MADRCUT]{2}$/.test(status)) return null
      kind = type === 'u' ? 'conflict' : type === '2' ? 'rename-or-copy' : 'tracked'
      if (type === '2') {
        if (!/^[RC][0-9]{1,3}$/.test(fields[8]) || index + 1 >= records.length) return null
        originalPath = records[++index]
        if (!originalPath) return null
      }
      empty.tracked += 1
      if (status[0] !== '.') empty.staged += 1
      if (status[1] !== '.') empty.unstaged += 1
      if (type === 'u') empty.conflicts += 1
    }
    if (!path) return null
    const displayed = displayPath(path)
    const original = originalPath === undefined ? undefined : displayPath(originalPath)
    empty.pathsTruncated ||= displayed.pathTruncated || Boolean(original?.pathTruncated)
    if (empty.changes.length < identityReportLimits.changes) {
      empty.changes.push({ kind, status, ...displayed, ...(original ? { originalPath: original.path, originalPathTruncated: original.pathTruncated } : {}) })
    } else empty.omittedChanges += 1
  }
  return empty
}

function countPair(output) {
  const match = /^(\d+)\s+(\d+)\s*$/.exec(output)
  if (!match) return null
  const [ahead, behind] = match.slice(1).map(Number)
  return Number.isSafeInteger(ahead) && Number.isSafeInteger(behind) ? { ahead, behind } : null
}

function safeFailure(result) {
  if (result?.error?.code === 'ETIMEDOUT') return 'timeout'
  if (result?.error?.code === 'ENOBUFS') return 'output-limit'
  if (['ENOENT', 'ENOTDIR'].includes(result?.error?.code)) return 'git-unavailable'
  return 'query-failed'
}

function isolatedEnvironment(env, nullDevice) {
  const childEnv = { ...env }
  for (const key of Object.keys(childEnv)) if (key.toUpperCase().startsWith('GIT_') || key.toUpperCase() === 'SSH_ASKPASS') delete childEnv[key]
  return { ...childEnv, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: nullDevice, GIT_CONFIG_GLOBAL: nullDevice, GIT_GRAFT_FILE: nullDevice, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '', GCM_INTERACTIVE: 'never', LC_ALL: 'C' }
}

/** Every command is a bounded argument array. All inherited Git overrides are
 * removed; status cannot refresh the index or invoke configured fsmonitor.
 * The direct HTTPS query has no repository config, URL rewrite or credential
 * helper. It contacts only the canonical approved GitHub repository.
 */
export function createRepositoryIdentityReport({ expectedRepository = defaultRepository, run = spawnSync, cwd = process.cwd(), env = process.env, platform = process.platform, now = () => new Date().toISOString() } = {}) {
  const expected = normalizeRepository(expectedRepository)
  if (!expected) throw new TypeError('Expected repository must be OWNER/REPO.')
  const nullDevice = platform === 'win32' ? 'NUL' : '/dev/null'
  const options = { ...identityProbeOptions, cwd, env: isolatedEnvironment(env, nullDevice) }
  const baseArgs = ['--no-optional-locks', '--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false']
  const errors = []; const reasons = []
  function probe(id, args, { absent = false, isolated = false } = {}) {
    let result
    try { result = run('git', [...baseArgs, ...(isolated ? [`--git-dir=${nullDevice}`, '-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'http.followRedirects=false'] : []), ...args], options) }
    catch (error) { result = { error: { code: error?.code } } }
    if (!result?.error && !result?.signal && result?.status === 1 && absent) return { absent: true }
    if (!result?.error && !result?.signal && result?.status === 0 && typeof result.stdout === 'string' && Buffer.byteLength(result.stdout) <= identityProbeOptions.maxBuffer) return { value: result.stdout }
    const reason = typeof result?.stdout === 'string' && Buffer.byteLength(result.stdout) > identityProbeOptions.maxBuffer ? 'output-limit' : safeFailure(result)
    errors.push({ query: id, reason }); return { error: reason }
  }
  function invalid(id) { errors.push({ query: id, reason: 'invalid-response' }) }
  function revision(id, ref) {
    const result = probe(id, ['rev-parse', '--verify', '--quiet', ref], { absent: true })
    if (result.value === undefined) return null
    const value = result.value.trim()
    if (!shaPattern.test(value)) { invalid(id); return null }
    return value
  }
  function originIdentity(id, push = false) {
    const result = probe(id, ['remote', 'get-url', ...(push ? ['--push'] : []), '--all', 'origin'])
    if (result.value === undefined) return null
    const values = result.value.replace(/\r\n/g, '\n').split('\n').filter(Boolean)
    if (values.length !== 1) { reasons.push(`${id}-ambiguous`); return null }
    const repository = repositoryFromOrigin(values[0])
    if (!repository) reasons.push(`${id}-unrecognized`)
    return repository
  }
  const root = probe('repository-root', ['rev-parse', '--show-prefix'])
  const atRoot = root.value === '' || root.value === '\n' || root.value === '\r\n'
  if (root.value !== undefined && !atRoot) reasons.push('repository-root-required')
  const origin = originIdentity('origin')
  const pushOrigin = originIdentity('push-origin', true)
  const matchesExpected = value => value?.toLowerCase() === expected.toLowerCase()
  const identityVerified = atRoot && matchesExpected(origin) && matchesExpected(pushOrigin)
  if (origin && !matchesExpected(origin)) reasons.push('origin-mismatch')
  if (pushOrigin && !matchesExpected(pushOrigin)) reasons.push('push-origin-mismatch')
  const branchResult = probe('branch', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { absent: true })
  let branch = branchResult.value?.trim() ?? null
  if (branch !== null && !validRef(branch)) { invalid('branch'); branch = null }
  if (branchResult.absent) reasons.push('detached-head')
  const head = revision('head', 'HEAD')
  if (!head && !errors.some(error => error.query === 'head')) reasons.push('head-missing')
  const localMain = revision('local-main', 'refs/heads/main')
  const localOriginMain = revision('local-origin-main', 'refs/remotes/origin/main')
  let upstreamRef = null; let upstreamHead = null; let upstreamComparison = null
  if (branch) {
    const result = probe('upstream', ['for-each-ref', '--format=%(upstream)', `refs/heads/${branch}`])
    if (result.value !== undefined) {
      upstreamRef = result.value.trim() || null
      if (upstreamRef !== null && (!validRef(upstreamRef) || !upstreamRef.startsWith('refs/'))) { invalid('upstream'); upstreamRef = null }
      if (upstreamRef) {
        upstreamHead = revision('upstream-head', upstreamRef)
        if (head && upstreamHead) {
          const counts = probe('upstream-comparison', ['rev-list', '--left-right', '--count', `${head}...${upstreamHead}`])
          if (counts.value !== undefined) { upstreamComparison = countPair(counts.value); if (!upstreamComparison) invalid('upstream-comparison') }
        }
      }
    }
  }
  function readStatus() {
    // Status may run an attributes-selected clean/process filter while hashing
    // a changed file. Inspect only configuration key names, and refuse status
    // if any executable filter is configured; never inspect or run its value.
    const filters = probe('filter-policy', ['config', '--includes', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|process)$'], { absent: true })
    if (!filters.absent) {
      if (!filters.error) errors.push({ query: 'worktree', reason: 'external-filters-configured' })
      return { error: 'filter-policy' }
    }
    // Recursive submodule status can execute filters from a nested repository
    // whose config is outside the root policy. Refuse gitlinks before status.
    const index = probe('submodule-policy', ['ls-files', '--stage', '-z'])
    if (index.value === undefined) return { error: 'submodule-policy' }
    if (index.value && (!index.value.endsWith('\0') || index.value.slice(0, -1).split('\0').some(record => !/^[0-7]{6} (?:[0-9a-f]{40}|[0-9a-f]{64}) [0-3]\t[\s\S]+$/.test(record)))) {
      invalid('submodule-policy'); return { error: 'submodule-policy' }
    }
    if (index.value.split('\0').some(record => record.startsWith('160000 '))) {
      errors.push({ query: 'worktree', reason: 'submodule-status-unsupported' }); return { error: 'submodule-policy' }
    }
    return probe('worktree', ['status', '--porcelain=v2', '-z', '--untracked-files=all', '--ignore-submodules=none'])
  }
  const statusResult = readStatus()
  let worktree = statusResult.value === undefined ? null : parseRepositoryStatus(statusResult.value)
  if (statusResult.value !== undefined && !worktree) invalid('worktree')
  worktree ??= { state: 'unknown', tracked: null, staged: null, unstaged: null, untracked: null, conflicts: null, changes: [], omittedChanges: 0, pathsTruncated: false }
  const directRemote = { state: 'not-queried', repository: identityVerified ? expected : null, ref: 'refs/heads/main', sha: null, headComparison: 'unknown', ahead: null, behind: null, localTrackingMatches: null }
  if (identityVerified) {
    const result = probe('direct-main', ['ls-remote', '--exit-code', '--refs', `https://github.com/${expected}.git`, 'refs/heads/main'], { isolated: true })
    if (result.error) directRemote.state = 'unavailable'
    else {
      const match = /^([0-9a-f]{40}|[0-9a-f]{64})\trefs\/heads\/main\r?\n?$/.exec(result.value)
      if (!match) { directRemote.state = 'invalid-response'; invalid('direct-main') }
      else {
        directRemote.state = 'verified'; directRemote.sha = match[1]
        directRemote.localTrackingMatches = localOriginMain === null ? null : localOriginMain === directRemote.sha
        if (head === directRemote.sha) { directRemote.headComparison = 'equal'; directRemote.ahead = 0; directRemote.behind = 0 }
        else if (head) {
          directRemote.headComparison = 'different'
          const counts = probe('direct-comparison', ['rev-list', '--left-right', '--count', `${head}...${directRemote.sha}`])
          if (counts.value !== undefined) {
            const pair = countPair(counts.value)
            if (pair) { directRemote.ahead = pair.ahead; directRemote.behind = pair.behind } else invalid('direct-comparison')
          }
        }
      }
    }
  }
  // The network observation can outlast local edits. Compare the captured
  // revision operands, then verify refs and status still describe this receipt.
  // No locks are acquired; a receipt is a bounded observation, not a lease.
  const finalHead = revision('head-recheck', 'HEAD')
  const finalMain = revision('main-recheck', 'refs/heads/main')
  const finalTracking = revision('tracking-recheck', 'refs/remotes/origin/main')
  const finalBranch = probe('branch-recheck', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { absent: true })
  const finalOrigin = originIdentity('origin-recheck')
  const finalPushOrigin = originIdentity('push-origin-recheck', true)
  const finalUpstream = branch ? probe('upstream-recheck', ['for-each-ref', '--format=%(upstream)', `refs/heads/${branch}`]) : null
  const finalStatus = statusResult.value === undefined ? null : readStatus()
  const stable = finalHead === head && finalMain === localMain && finalTracking === localOriginMain
    && (finalBranch.value?.trim() ?? null) === branch && (finalStatus === null || finalStatus.value === statusResult.value)
    && finalOrigin === origin && finalPushOrigin === pushOrigin && (finalUpstream?.value?.trim() || null) === upstreamRef
  if (!stable) errors.push({ query: 'snapshot-stability', reason: 'repository-changed-during-report' })
  if (branch !== 'main') reasons.push('branch-is-not-main')
  if (upstreamRef !== 'refs/remotes/origin/main' || !upstreamHead) reasons.push('upstream-needs-review')
  if (worktree.state === 'known' && (worktree.tracked || worktree.untracked)) reasons.push('local-changes')
  if (directRemote.state === 'verified') {
    if (directRemote.localTrackingMatches !== true) reasons.push('local-tracking-needs-review')
    if (directRemote.behind > 0) reasons.push(directRemote.ahead > 0 ? 'history-diverged' : 'head-behind-direct-main')
  }
  const complete = identityVerified && errors.length === 0 && Boolean(head) && worktree.state === 'known' && directRemote.state === 'verified'
  const assessment = !identityVerified || !complete ? 'unverified' : reasons.length ? 'needs-review' : directRemote.ahead > 0 ? 'clean-ahead' : 'clean-parity'
  return {
    schemaVersion: 1, observedAt: now(), ok: ['clean-parity', 'clean-ahead'].includes(assessment), complete, assessment,
    expectedRepository: expected, repository: { origin, pushOrigin, identityVerified, stable, workingDirectory: atRoot ? '.' : null },
    branch, head, localMain, upstream: { ref: upstreamRef, sha: upstreamHead, comparison: upstreamComparison, evidence: 'local-tracking-ref' },
    localOriginMain, directRemote, worktree, reasons: [...new Set(reasons)], errors, scope,
  }
}

export function formatRepositoryIdentityReport(report) {
  const lines = ['WebAppX repository identity receipt', '', `Assessment: ${report.assessment}; observations ${report.complete ? 'complete' : 'incomplete'}`, `Expected GitHub repository: ${report.expectedRepository}`, `Origin: ${report.repository.origin ?? 'unrecognized or unavailable'}`, `Push origin: ${report.repository.pushOrigin ?? 'unrecognized or unavailable'}`, `Branch: ${report.branch ?? 'unknown or detached'}`, `HEAD: ${report.head ?? 'unknown'}`, `Local main: ${report.localMain ?? 'missing or unknown'}`, `Upstream (local): ${report.upstream.ref ?? 'missing or unknown'} at ${report.upstream.sha ?? 'unknown'}`]
  if (report.upstream.comparison) lines.push(`HEAD vs local upstream: ${report.upstream.comparison.ahead} ahead / ${report.upstream.comparison.behind} behind`)
  lines.push(`Local origin/main: ${report.localOriginMain ?? 'missing or unknown'}`, `Direct GitHub main: ${report.directRemote.sha ?? report.directRemote.state}`, `HEAD vs direct main: ${report.directRemote.ahead ?? 'unknown'} ahead / ${report.directRemote.behind ?? 'unknown'} behind`, `Local origin/main matches direct main: ${report.directRemote.localTrackingMatches ?? 'unknown'}`)
  const state = report.worktree
  lines.push(`Worktree (${state.state}): tracked ${state.tracked ?? 'unknown'}; staged ${state.staged ?? 'unknown'}; unstaged ${state.unstaged ?? 'unknown'}; untracked ${state.untracked ?? 'unknown'}; conflicts ${state.conflicts ?? 'unknown'}`)
  for (const change of state.changes) lines.push(`  ${change.status} ${JSON.stringify(change.path)}${change.originalPath === undefined ? '' : ` from ${JSON.stringify(change.originalPath)}`}`)
  if (state.omittedChanges || state.pathsTruncated) lines.push(`Path display bounded: ${state.omittedChanges} additional change records omitted; long or unsafe paths may be abbreviated.`)
  if (report.reasons.length) lines.push(`Review: ${report.reasons.join(', ')}`)
  for (const error of report.errors) lines.push(`Query unavailable: ${error.query} (${error.reason}); do not infer parity.`)
  lines.push('', report.scope)
  return `${lines.join('\n')}\n`
}

const usage = 'Usage: node scripts/repository-identity.mjs [--json] [--expected-repository OWNER/REPO]\n       node scripts/repository-identity.mjs --help\n'
export function runRepositoryIdentityCli(args, { stdout = process.stdout, stderr = process.stderr, ...options } = {}) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    stdout.write(`${usage}Reports origin, branch, HEAD, direct GitHub main, local tracking refs and tracked/staged/untracked paths without writes.\nExit 0: complete clean parity or clean local commits ahead of verified main; 1: review needed or incomplete/unverified observations; 2: invalid arguments.\n`); return 0
  }
  let json = false; let expectedRepository = defaultRepository; let expectedSeen = false
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--json' && !json) json = true
    else if (args[index] === '--expected-repository' && !expectedSeen && normalizeRepository(args[index + 1])) { expectedRepository = args[++index]; expectedSeen = true }
    else { stderr.write(usage); return 2 }
  }
  const report = createRepositoryIdentityReport({ ...options, expectedRepository })
  stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : formatRepositoryIdentityReport(report))
  return report.ok ? 0 : 1
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) process.exitCode = runRepositoryIdentityCli(process.argv.slice(2))
