import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createRepositoryIdentityReport, defaultRepository, formatRepositoryIdentityReport, identityProbeOptions, identityReportLimits, normalizeRepository, parseRepositoryStatus, repositoryFromOrigin, runRepositoryIdentityCli } from '../../scripts/repository-identity.mjs'

const head = 'a'.repeat(40)
const old = 'b'.repeat(40)
const other = 'c'.repeat(40)
const success = stdout => ({ status: 0, signal: null, stdout, stderr: '' })
const failure = (status = 128) => ({ status, signal: null, stdout: '', stderr: 'https://private-token@github.com/private/repo /private/machine/path' })
const now = () => '2026-10-15T12:00:00.000Z'

function fakeRunner(overrides = {}) {
  const calls = []
  let comparisons = 0
  function run(executable, args, options) {
    const command = args.findIndex(arg => ['rev-parse', 'remote', 'symbolic-ref', 'for-each-ref', 'rev-list', 'status', 'ls-remote', 'config', 'ls-files'].includes(arg))
    const argv = args.slice(command)
    calls.push({ executable, args, options, argv })
    const key = argv[0] === 'remote' ? argv.includes('--push') ? 'push-origin' : 'origin'
      : argv[0] === 'symbolic-ref' ? 'branch'
        : argv[0] === 'for-each-ref' ? 'upstream'
          : argv[0] === 'status' ? 'worktree'
            : argv[0] === 'ls-remote' ? 'direct-main'
              : argv[0] === 'config' ? 'filter-policy' : argv[0] === 'ls-files' ? 'submodule-policy'
                : argv[0] === 'rev-list' ? comparisons++ === 0 ? 'upstream-comparison' : 'direct-comparison'
                : argv.at(-1) === '--show-prefix' ? 'repository-root'
                  : argv.at(-1) === 'HEAD' ? 'head'
                    : argv.at(-1) === 'refs/heads/main' ? 'local-main' : 'local-origin-main'
    if (Object.hasOwn(overrides, key)) {
      const value = overrides[key]
      if (value instanceof Error) throw value
      return typeof value === 'function' ? value({ args, options, argv }) : value
    }
    if (key === 'filter-policy') return failure(1)
    return success(['repository-root', 'worktree', 'submodule-policy'].includes(key) ? ''
      : ['origin', 'push-origin'].includes(key) ? 'https://github.com/WayneTechLab/WebAppX.git\n'
        : key === 'branch' ? 'main\n'
          : key === 'upstream' ? 'refs/remotes/origin/main\n'
            : key.endsWith('comparison') ? '0\t0\n'
              : key === 'direct-main' ? `${head}\trefs/heads/main\n` : `${head}\n`)
  }
  return { calls, run }
}

function reportWith(overrides = {}, options = {}) {
  const runner = fakeRunner(overrides)
  return { runner, report: createRepositoryIdentityReport({ run: runner.run, cwd: '/private/fixture', env: {}, platform: 'darwin', now, ...options }) }
}

function cli(args, overrides = {}, options = {}) {
  let stdout = ''; let stderr = ''
  const runner = fakeRunner(overrides)
  const code = runRepositoryIdentityCli(args, { run: runner.run, env: {}, now, stdout: { write: value => { stdout += value } }, stderr: { write: value => { stderr += value } }, ...options })
  return { code, stdout, stderr, calls: runner.calls }
}

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'webappx-identity-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_SYSTEM: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_OPTIONAL_LOCKS: '0' }
  for (const key of Object.keys(env)) if (['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS'].includes(key)) delete env[key]
  function git(...args) {
    const result = spawnSync('git', args, { cwd, env, shell: false, timeout: 10_000, maxBuffer: 1_048_576, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, `Temporary fixture Git command failed: ${args[0]}`)
    return result.stdout.trim()
  }
  git('init', '--initial-branch=main')
  git('config', '--local', 'user.name', 'Identity Fixture')
  git('config', '--local', 'user.email', 'fixture@example.invalid')
  for (const path of ['.SYSTEMX/GLOBAL', '.SYSTEMX/WORK', '.SYSTEMX/.systemx/releases/fixture']) mkdirSync(join(cwd, path), { recursive: true })
  writeFileSync(join(cwd, '.SYSTEMX/GLOBAL/CONTEXT.md'), readFileSync(new URL('../../.SYSTEMX/GLOBAL/CONTEXT.md', import.meta.url)))
  writeFileSync(join(cwd, '.SYSTEMX/WORK/TASKS.json'), '{"schemaVersion":1,"tasks":[]}\n')
  writeFileSync(join(cwd, '.SYSTEMX/.systemx/releases/fixture/STANDARD.md'), 'Immutable fixture bytes\r\n')
  writeFileSync(join(cwd, 'tracked file.txt'), 'first\n')
  git('add', '--', '.')
  git('commit', '-m', 'Initialize disposable identity fixture')
  git('remote', 'add', 'origin', 'https://github.com/WayneTechLab/WebAppX.git')
  let directSha = git('rev-parse', 'HEAD')
  git('update-ref', 'refs/remotes/origin/main', directSha)
  git('branch', '--set-upstream-to=origin/main', 'main')
  const calls = []
  const run = (executable, args, options) => {
    calls.push({ executable, args, options })
    return args.includes('ls-remote') ? success(`${directSha}\trefs/heads/main\n`) : spawnSync(executable, args, options)
  }
  return { cwd, git, calls, run, setDirectSha: value => { directSha = value }, report: options => createRepositoryIdentityReport({ cwd, run, now, ...options }) }
}

function fileSnapshot(cwd) {
  const files = new Map()
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) files.set(relative(cwd, path), readFileSync(path).toString('base64'))
    }
  }
  walk(cwd); return files
}

test('a complete clean parity receipt keeps direct remote truth separate from local refs', () => {
  const { report } = reportWith()
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.observedAt, now())
  assert.equal(report.ok, true)
  assert.equal(report.complete, true)
  assert.equal(report.assessment, 'clean-parity')
  assert.equal(report.repository.identityVerified, true)
  assert.equal(report.expectedRepository, defaultRepository)
  assert.equal(report.directRemote.sha, head)
  assert.equal(report.directRemote.state, 'verified')
  assert.deepEqual(report.upstream.comparison, { ahead: 0, behind: 0 })
  assert.equal(report.upstream.evidence, 'local-tracking-ref')
  assert.deepEqual(report.reasons, [])
  assert.deepEqual(report.errors, [])
  assert.match(report.scope, /grants no publication or deployment authority/)
})

test('clean local commits ahead of direct main are a complete positive receipt for publish review', () => {
  const { report } = reportWith({ 'local-origin-main': success(`${old}\n`), 'direct-main': success(`${old}\trefs/heads/main\n`), 'upstream-comparison': success('1\t0\n'), 'direct-comparison': success('1\t0\n') })
  assert.equal(report.ok, true)
  assert.equal(report.assessment, 'clean-ahead')
  assert.equal(report.directRemote.ahead, 1)
  assert.equal(report.directRemote.behind, 0)
  assert.equal(report.directRemote.localTrackingMatches, true)
  assert.equal(cli([], { 'local-origin-main': success(`${old}\n`), 'direct-main': success(`${old}\trefs/heads/main\n`), 'direct-comparison': success('1\t0\n') }).code, 0)
})

test('diverged and behind histories require review even if a local tracking comparison is zero', () => {
  for (const [counts, reason] of [['2\t1\n', 'history-diverged'], ['0\t2\n', 'head-behind-direct-main']]) {
    const { report } = reportWith({ 'local-origin-main': success(`${old}\n`), 'direct-main': success(`${old}\trefs/heads/main\n`), 'direct-comparison': success(counts) })
    assert.equal(report.complete, true)
    assert.equal(report.assessment, 'needs-review')
    assert.equal(report.ok, false)
    assert.equal(report.reasons.includes(reason), true)
    assert.deepEqual(report.upstream.comparison, { ahead: 0, behind: 0 })
  }
})

test('a stale local origin/main never substitutes for direct remote evidence', () => {
  const { report } = reportWith({ 'local-origin-main': success(`${old}\n`) })
  assert.equal(report.directRemote.sha, head)
  assert.equal(report.directRemote.headComparison, 'equal')
  assert.equal(report.directRemote.localTrackingMatches, false)
  assert.equal(report.assessment, 'needs-review')
  assert.equal(report.reasons.includes('local-tracking-needs-review'), true)
})

test('dirty tracked/index/untracked and rename source paths retain independent counts', () => {
  const output = `1 .M N... 100644 100644 100644 ${head} ${head} tracked file.txt\0` + `2 R. N... 100644 100644 100644 ${head} ${head} R100 new name.txt\0old name.txt\0` + '? untracked file.txt\0'
  const { report } = reportWith({ worktree: success(output) })
  assert.equal(report.assessment, 'needs-review')
  assert.equal(report.complete, true)
  assert.deepEqual([report.worktree.tracked, report.worktree.staged, report.worktree.unstaged, report.worktree.untracked], [2, 1, 1, 1])
  assert.equal(report.worktree.changes[1].path, 'new name.txt')
  assert.equal(report.worktree.changes[1].originalPath, 'old name.txt')
  assert.equal(report.reasons.includes('local-changes'), true)
})

test('unmerged conflicts remain visible and status parsing rejects incomplete or unknown records', () => {
  const status = parseRepositoryStatus(`u UU N... 100644 100644 100644 100644 ${head} ${head} ${head} conflict.txt\0`)
  assert.equal(status.conflicts, 1)
  assert.equal(status.staged, 1)
  assert.equal(status.unstaged, 1)
  for (const value of ['? truncated', 'x unknown\0', `2 R. N... 100644 100644 100644 ${head} ${head} R100 new\0`, `1 ZX N... 100644 100644 100644 ${head} ${head} file\0`]) assert.equal(parseRepositoryStatus(value), null)
  const { report } = reportWith({ worktree: success('not status') })
  assert.equal(report.worktree.state, 'unknown')
  assert.equal(report.assessment, 'unverified')
})

test('path records and path lengths are bounded while total change counts remain exact', () => {
  const output = Array.from({ length: 80 }, (_, index) => `? dir/${'x'.repeat(260)}/${index}\0`).join('')
  const status = parseRepositoryStatus(output)
  assert.equal(status.untracked, 80)
  assert.equal(status.changes.length, identityReportLimits.changes)
  assert.equal(status.omittedChanges, 30)
  assert.equal(status.pathsTruncated, true)
  assert.equal(status.changes[0].path.length, identityReportLimits.pathLength + 1)
  for (const name of ['/private/machine', '../private/machine', 'C:/private/machine', 'C:\\private\\machine']) {
    const status = parseRepositoryStatus(`? ${name}\0`)
    assert.equal(status.changes[0].path, '[unsafe path omitted]')
    assert.doesNotMatch(JSON.stringify(status), /private|machine/)
  }
})

test('standard credential-free GitHub origins normalize and hostile URLs are never queried or echoed', () => {
  for (const origin of ['https://github.com/WayneTechLab/WebAppX.git', 'git@github.com:WayneTechLab/WebAppX.git', 'ssh://git@github.com/WayneTechLab/WebAppX.git']) assert.equal(repositoryFromOrigin(origin), defaultRepository)
  for (const origin of ['https://private-token@github.com/WayneTechLab/WebAppX.git', 'https://github.com/WayneTechLab/WebAppX.git?private-token', 'https://github.com/WayneTechLab/WebAppX.git#private-token', 'https://github.com.evil.invalid/WayneTechLab/WebAppX', 'ext::private-token', '/private/machine/path', 'ssh://private-token@github.com/WayneTechLab/WebAppX', 'https://github.com/WayneTechLab/WebAppX.git\nhttps://private-token@example.invalid']) {
    assert.equal(repositoryFromOrigin(origin), null)
    const { report, runner } = reportWith({ origin: success(`${origin}\n`) })
    assert.equal(report.assessment, 'unverified')
    assert.equal(report.repository.origin, null)
    assert.equal(report.directRemote.state, 'not-queried')
    assert.equal(runner.calls.some(call => call.args.includes('ls-remote')), false)
    assert.doesNotMatch(JSON.stringify(report), /private-token|machine\/path|evil\.invalid/)
  }
})

test('unexpected or multiple fetch/push destinations fail closed before network access', () => {
  for (const override of [{ origin: success('https://github.com/Other/Repo.git\n') }, { 'push-origin': success('git@github.com:Other/Repo.git\n') }, { origin: success('https://github.com/WayneTechLab/WebAppX.git\nhttps://github.com/Other/Repo.git\n') }]) {
    const { report, runner } = reportWith(override)
    assert.equal(report.ok, false)
    assert.equal(report.repository.identityVerified, false)
    assert.equal(runner.calls.some(call => call.args.includes('ls-remote')), false)
  }
})

test('adoption uses an explicit expected repository and a fixed canonical direct HTTPS query', () => {
  const result = cli(['--json', '--expected-repository', 'Example/adopted-app'], { origin: success('git@github.com:Example/adopted-app.git\n'), 'push-origin': success('https://github.com/Example/adopted-app.git\n') })
  assert.equal(result.code, 0)
  assert.equal(JSON.parse(result.stdout).expectedRepository, 'Example/adopted-app')
  assert.deepEqual(result.calls.find(call => call.argv[0] === 'ls-remote').argv, ['ls-remote', '--exit-code', '--refs', 'https://github.com/Example/adopted-app.git', 'refs/heads/main'])
  assert.equal(normalizeRepository('Example/adopted-app'), 'Example/adopted-app')
})

test('missing upstream, missing tracking refs, detached HEAD and a non-main branch need review', () => {
  for (const override of [{ upstream: success('\n') }, { 'local-origin-main': failure(1) }, { branch: failure(1) }, { branch: success('codex/review\n') }]) {
    const { report } = reportWith(override)
    assert.equal(report.ok, false)
    assert.equal(report.assessment, 'needs-review')
    assert.equal(report.directRemote.state, 'verified')
  }
})

test('network/access unavailability, timeouts and missing remote main never report parity', () => {
  for (const result of [failure(), failure(2), { error: { code: 'ETIMEDOUT', message: 'private-token' } }, { error: { code: 'ENOENT' } }]) {
    const { report } = reportWith({ 'direct-main': result })
    assert.equal(report.assessment, 'unverified')
    assert.equal(report.complete, false)
    assert.equal(report.directRemote.state, 'unavailable')
    assert.equal(report.directRemote.sha, null)
    assert.equal(report.directRemote.headComparison, 'unknown')
    assert.equal(report.directRemote.ahead, null)
    assert.doesNotMatch(JSON.stringify(report), /private-token|machine\/path/)
    assert.match(formatRepositoryIdentityReport(report), /do not infer parity/)
  }
})

test('invalid direct responses and absent local direct objects remain unverified', () => {
  for (const output of ['', `${head}\trefs/heads/other\n`, `${head}\trefs/heads/main\n${other}\trefs/heads/main\n`, 'private-token']) {
    const { report } = reportWith({ 'direct-main': success(output) })
    assert.equal(report.assessment, 'unverified')
    assert.equal(report.directRemote.state, 'invalid-response')
    assert.doesNotMatch(JSON.stringify(report), /private-token/)
  }
  const { report } = reportWith({ 'direct-main': success(`${other}\trefs/heads/main\n`), 'direct-comparison': failure() })
  assert.equal(report.directRemote.state, 'verified')
  assert.equal(report.directRemote.sha, other)
  assert.equal(report.directRemote.ahead, null)
  assert.equal(report.assessment, 'unverified')
})

test('all command failures, malformed refs and output overflow are bounded sanitized failures', () => {
  for (const result of [{ error: { code: 'ENOBUFS' } }, { status: 0, signal: 'SIGTERM', stdout: head }, new Error('private-token /private/machine/path'), success('x'.repeat(identityProbeOptions.maxBuffer + 1))]) {
    const { report } = reportWith({ head: result })
    assert.equal(report.complete, false)
    assert.equal(report.head, null)
    assert.doesNotMatch(JSON.stringify(report), /private-token|machine\/path/)
  }
  for (const override of [{ branch: success('main\nprivate-token') }, { upstream: success('/private/machine/path') }, { head: success('not-a-sha') }, { 'upstream-comparison': success('unknown') }]) assert.equal(reportWith(override).report.complete, false)
})

test('Git commands are bounded read-only arrays with disabled locks and inherited Git overrides removed', () => {
  const env = { PATH: '/private/toolchain', GIT_DIR: '/private/other-repo', GIT_INDEX_FILE: '/private/index', GIT_SSH_COMMAND: 'private-token', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'url.ext::private-token.insteadOf', GIT_CONFIG_VALUE_0: 'https://github.com/', GIT_TRACE: '/private/trace', SSH_ASKPASS: '/private/askpass' }
  const { runner, report } = reportWith({}, { env })
  for (const call of runner.calls) {
    assert.equal(call.executable, 'git')
    assert.equal(Array.isArray(call.args), true)
    assert.equal(call.options.shell, false)
    assert.equal(call.options.timeout, identityProbeOptions.timeout)
    assert.equal(call.options.maxBuffer, identityProbeOptions.maxBuffer)
    assert.equal(call.options.env.GIT_OPTIONAL_LOCKS, '0')
    assert.equal(call.options.env.GIT_TERMINAL_PROMPT, '0')
    assert.equal(call.options.env.GIT_CONFIG_GLOBAL, '/dev/null')
    assert.equal(call.options.env.GIT_CONFIG_COUNT, undefined)
    assert.equal(call.options.env.GIT_DIR, undefined)
    assert.equal(call.options.env.GIT_TRACE, undefined)
    assert.equal(call.options.env.GIT_SSH_COMMAND, undefined)
    assert.equal(call.args.includes('core.fsmonitor=false'), true)
    assert.equal(call.args.includes('--no-replace-objects'), true)
    assert.equal(call.options.env.GIT_GRAFT_FILE, '/dev/null')
    assert.equal(call.args.some(arg => ['fetch', 'pull', 'push', 'add', 'commit', 'reset', 'clean', 'checkout', 'update-index', 'update-ref'].includes(arg)), false)
  }
  const network = runner.calls.find(call => call.argv[0] === 'ls-remote')
  for (const arg of ['--git-dir=/dev/null', 'credential.helper=', 'protocol.allow=never', 'protocol.https.allow=always', 'http.followRedirects=false']) assert.equal(network.args.includes(arg), true)
  assert.equal(env.GIT_SSH_COMMAND, 'private-token')
  assert.doesNotMatch(JSON.stringify(report), /private-token|private\/toolchain|private\/other-repo/)
  assert.equal(reportWith({}, { platform: 'win32' }).runner.calls.find(call => call.argv[0] === 'ls-remote').args.includes('--git-dir=NUL'), true)
})

test('CLI help, strict argument errors and JSON/text modes have documented exit codes', () => {
  for (const args of [['--help'], ['-h']]) {
    const result = cli(args)
    assert.equal(result.code, 0)
    assert.equal(result.calls.length, 0)
    assert.match(result.stdout, /Exit 0:/)
  }
  for (const args of [['--json', '--json'], ['--help', '--json'], ['--expected-repository'], ['--expected-repository', 'https://github.com/Other/Repo'], ['--expected-repository', 'A/B', '--expected-repository', 'C/D'], ['--apply'], ['--json=true'], ['--expected-repository=A/B']]) {
    const result = cli(args)
    assert.equal(result.code, 2)
    assert.equal(result.calls.length, 0)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /^Usage:/)
  }
  assert.equal(cli(['--json']).code, 0)
  assert.equal(JSON.parse(cli(['--json']).stdout).ok, true)
  assert.match(cli([]).stdout, /Assessment: clean-parity/)
  assert.equal(cli(['--json'], { worktree: success('? pending.txt\0') }).code, 1)
})

test('spawned CLI help through an owned symlink prints usage without probing Git', t => {
  const directory = mkdtempSync(join(tmpdir(), 'webappx-identity-entry-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const alias = join(directory, 'identity-alias.mjs')
  try { symlinkSync(fileURLToPath(new URL('../../scripts/repository-identity.mjs', import.meta.url)), alias, 'file') }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Creating file symlinks requires Windows developer mode or equivalent permission.'); return }
    throw error
  }
  const marker = join(directory, 'unexpected-probe')
  const bootstrap = join(directory, 'probe-guard.mjs')
  writeFileSync(bootstrap, `import childProcess from 'node:child_process'\nimport { syncBuiltinESMExports } from 'node:module'\nimport { writeFileSync } from 'node:fs'\nchildProcess.spawnSync = () => { writeFileSync(${JSON.stringify(marker)}, 'unexpected'); throw new Error('Git probe is forbidden during help') }\nsyncBuiltinESMExports()\n`)
  const result = spawnSync(process.execPath, ['--import', bootstrap, alias, '--help'], { cwd: directory, env: { ...process.env, PATH: '' }, shell: false, timeout: 10_000, maxBuffer: 65_536, encoding: 'utf8', windowsHide: true })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^Usage: node scripts\/repository-identity\.mjs/)
  assert.match(result.stdout, /Exit 0:/)
  assert.equal(result.stderr, '')
  assert.equal(existsSync(marker), false)
})

test('real temporary repo status preserves index, local files, blank seeds and immutable fixture bytes', t => {
  const repo = fixture(t)
  renameSync(join(repo.cwd, 'tracked file.txt'), join(repo.cwd, 'renamed file.txt'))
  repo.git('add', '--', 'tracked file.txt', 'renamed file.txt')
  writeFileSync(join(repo.cwd, 'renamed file.txt'), 'changed after staging\n')
  writeFileSync(join(repo.cwd, 'untracked file.txt'), 'private file contents never read by receipt\n')
  const before = fileSnapshot(repo.cwd)
  const report = repo.report()
  assert.equal(report.assessment, 'needs-review')
  assert.equal(report.worktree.staged, 1)
  assert.equal(report.worktree.unstaged, 1)
  assert.equal(report.worktree.untracked, 1)
  assert.equal(report.worktree.changes[0].path, 'renamed file.txt')
  assert.equal(report.worktree.changes[0].originalPath, 'tracked file.txt')
  assert.deepEqual(fileSnapshot(repo.cwd), before)
  assert.doesNotMatch(JSON.stringify(report), /private file contents|webappx-identity-|\.git\/index/)
  assert.equal(repo.calls.filter(call => call.args.includes('ls-remote')).length, 1)
})

test('real local commit ahead of a verified remote ancestor remains publish-review ready without writes', t => {
  const repo = fixture(t)
  writeFileSync(join(repo.cwd, 'tracked file.txt'), 'second\n')
  repo.git('add', '--', 'tracked file.txt')
  repo.git('commit', '-m', 'Local authorized publication candidate')
  const before = fileSnapshot(repo.cwd)
  const report = repo.report()
  assert.equal(report.assessment, 'clean-ahead')
  assert.equal(report.ok, true)
  assert.deepEqual(report.upstream.comparison, { ahead: 1, behind: 0 })
  assert.equal(report.directRemote.ahead, 1)
  assert.equal(report.directRemote.behind, 0)
  assert.deepEqual(fileSnapshot(repo.cwd), before)
})

test('effective local URL rewrites and alternate push URLs are detected before direct network querying', t => {
  const repo = fixture(t)
  repo.git('config', '--local', 'url.ext::private-token.insteadOf', 'https://github.com/')
  const report = repo.report()
  assert.equal(report.repository.identityVerified, false)
  assert.equal(report.directRemote.state, 'not-queried')
  assert.equal(repo.calls.some(call => call.args.includes('ls-remote')), false)
  assert.doesNotMatch(JSON.stringify(report), /private-token/)
})

test('repository root is required and terminal control characters in paths are escaped in text', () => {
  const { report, runner } = reportWith({ 'repository-root': success('nested/\n'), worktree: success('? name\u001b[31m\nnext.txt\0') })
  assert.equal(report.assessment, 'unverified')
  assert.equal(report.repository.workingDirectory, null)
  assert.equal(runner.calls.some(call => call.args.includes('ls-remote')), false)
  const text = formatRepositoryIdentityReport(report)
  assert.equal(text.includes('\u001b'), false)
  assert.match(text, /\\u001b/)
})

test('configured executable filters and indexed submodules fail closed before status can execute them', () => {
  for (const override of [{ 'filter-policy': success('filter.private-token.clean\n') }, { 'filter-policy': failure() }, { 'submodule-policy': success(`160000 ${head} 0\tnested\0`) }, { 'submodule-policy': success('malformed index entry\0') }]) {
    const { report, runner } = reportWith(override)
    assert.equal(report.assessment, 'unverified')
    assert.equal(report.worktree.state, 'unknown')
    assert.equal(runner.calls.some(call => call.argv[0] === 'status'), false)
    assert.doesNotMatch(JSON.stringify(report), /private-token/)
  }
})

test('a real configured content filter is refused without running its command or changing files', t => {
  const repo = fixture(t)
  writeFileSync(join(repo.cwd, '.gitattributes'), '*.txt filter=receiptguard\n')
  repo.git('add', '--', '.gitattributes')
  repo.git('commit', '-m', 'Declare fixture filter before executable configuration')
  const marker = join(repo.cwd, 'filter-executed')
  const filterScript = join(repo.cwd, 'fixture-filter.cjs')
  writeFileSync(filterScript, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected')\nprocess.stdin.pipe(process.stdout)\n`)
  // Git stores the value but the receipt must never invoke this filter. Paths
  // are fixture-generated, and the command is not executed by this test.
  repo.git('config', '--local', 'extensions.worktreeConfig', 'true')
  repo.git('config', '--worktree', 'filter.receiptguard.clean', `"${process.execPath}" "${filterScript}"`)
  writeFileSync(join(repo.cwd, 'tracked file.txt'), 'other\n')
  const before = fileSnapshot(repo.cwd)
  const report = repo.report()
  assert.equal(report.assessment, 'unverified')
  assert.equal(report.errors.some(error => error.reason === 'external-filters-configured'), true)
  assert.equal(repo.calls.some(call => call.args.includes('status')), false)
  assert.deepEqual(fileSnapshot(repo.cwd), before)
})

test('a real indexed gitlink is refused without traversing its nested repository', t => {
  const repo = fixture(t)
  const revision = repo.git('rev-parse', 'HEAD')
  repo.git('update-index', '--add', '--cacheinfo', `160000,${revision},nested`)
  const before = fileSnapshot(repo.cwd)
  const report = repo.report()
  assert.equal(report.assessment, 'unverified')
  assert.equal(report.errors.some(error => error.reason === 'submodule-status-unsupported'), true)
  assert.equal(repo.calls.some(call => call.args.includes('status')), false)
  assert.deepEqual(fileSnapshot(repo.cwd), before)
})

test('replacement refs and legacy grafts cannot forge a clean ancestor comparison', t => {
  const repo = fixture(t)
  const directSha = repo.git('rev-parse', 'HEAD')
  repo.git('checkout', '--orphan', 'unrelated')
  repo.git('rm', '-rf', '--', '.')
  writeFileSync(join(repo.cwd, 'unrelated.txt'), 'unrelated root\n')
  repo.git('add', '--', 'unrelated.txt')
  repo.git('commit', '-m', 'Unrelated fixture history')
  repo.git('branch', '-f', 'main', 'HEAD')
  repo.git('checkout', 'main')
  const unrelated = repo.git('rev-parse', 'HEAD')
  repo.git('replace', '--graft', unrelated, directSha)
  const replacements = repo.report()
  assert.equal(replacements.assessment, 'needs-review')
  assert.equal(replacements.directRemote.ahead, 1)
  assert.equal(replacements.directRemote.behind, 1)
  assert.equal(replacements.reasons.includes('history-diverged'), true)
  mkdirSync(join(repo.cwd, '.git/info'), { recursive: true })
  writeFileSync(join(repo.cwd, '.git/info/grafts'), `${unrelated} ${directSha}\n`)
  const before = fileSnapshot(repo.cwd)
  const grafted = repo.report()
  assert.equal(grafted.assessment, 'needs-review')
  assert.equal(grafted.directRemote.behind, 1)
  assert.deepEqual(fileSnapshot(repo.cwd), before)
})

test('comparisons use captured revision operands and a ref or worktree change invalidates the receipt', () => {
  let headReads = 0
  const { report, runner } = reportWith({ head: () => success(`${headReads++ ? other : head}\n`) })
  assert.equal(report.complete, false)
  assert.equal(report.repository.stable, false)
  assert.equal(report.errors.some(error => error.reason === 'repository-changed-during-report'), true)
  assert.equal(runner.calls.filter(call => call.argv[0] === 'rev-list').every(call => call.argv.at(-1).startsWith(`${head}...`)), true)
  let statusReads = 0
  const changingStatus = reportWith({ worktree: () => success(statusReads++ ? '? new.txt\0' : '') }).report
  assert.equal(changingStatus.assessment, 'unverified')
  assert.equal(changingStatus.repository.stable, false)
})
