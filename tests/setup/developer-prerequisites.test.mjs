import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPrerequisiteObservations, createPrerequisiteReport, evaluatePrerequisites, formatPrerequisiteReport, installedWindowsPythonPath, prerequisiteBaseline, runPrerequisiteCli, versionProbeOptions } from '../../scripts/developer-prerequisites.mjs'

const success = stdout => ({ status: 0, signal: null, stdout, stderr: '' })
const missing = () => ({ error: { code: 'ENOENT' }, status: null, stdout: '', stderr: '' })
const observations = () => ({
  node: { result: success('v24.0.0\n') },
  npm: { result: success('11.0.0\n') },
  git: { result: success('git version 2.54.0\n') },
  python: { result: success('Python 3.12.0\n') },
})
const check = (report, id) => report.checks.find(item => item.id === id)
function fakeRunner(overrides = {}) {
  const calls = []
  const run = (executable, args, options) => {
    calls.push({ executable, args, options })
    if (Object.hasOwn(overrides, executable)) {
      if (overrides[executable] instanceof Error) throw overrides[executable]
      return overrides[executable]
    }
    if (args.includes('--version') && args.some(arg => arg.endsWith('npm-cli.js'))) return success('11.11.0\n')
    return executable.endsWith('node') || executable.endsWith('node.exe') ? success('v25.8.1\n')
      : executable === 'npm' ? success('11.11.0\n')
        : executable === 'git' ? success('git version 2.54.0\n')
          : success('Python 3.14.5\n')
  }
  return { calls, run }
}
const probeOptions = runner => ({ run: runner.run, platform: 'darwin', execPath: '/private/toolchain/node', hasFile: () => false, npmExecPath: undefined, env: {} })

test('the documented baseline requires Node 24 and Python 3.12 without inventing npm or Git minima', () => {
  assert.deepEqual(prerequisiteBaseline, { node: '24.0.0', npm: null, git: null, python: '3.12.0' })
  const report = evaluatePrerequisites(observations())
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.ok, true)
  assert.deepEqual(report.checks.map(item => item.id), ['node', 'npm', 'git', 'python'])
  assert.equal(report.checks.every(item => item.required), true)
  assert.match(check(report, 'npm').requirement, /no minimum specified/)
  assert.match(check(report, 'git').requirement, /no minimum specified/)
  assert.match(report.scope, /does not establish tested runtime or platform support/)
})

test('missing required tools fail independently, including an absent observation', () => {
  for (const id of ['node', 'npm', 'git', 'python']) {
    const source = observations()
    source[id].result = missing()
    const report = evaluatePrerequisites(source)
    assert.equal(report.ok, false)
    assert.equal(check(report, id).status, 'missing')
    assert.equal(report.checks.filter(item => item.status === 'pass').length, 3)
    delete source[id]
    assert.equal(check(evaluatePrerequisites(source), id).status, 'missing')
  }
})

test('minimum comparison handles older major/minor releases, exact boundaries and newer versions', () => {
  for (const [id, output] of [['node', 'v23.99.99'], ['python', 'Python 3.11.99'], ['python', 'Python 2.99.99']]) {
    const source = observations(); source[id].result = success(output)
    assert.equal(check(evaluatePrerequisites(source), id).status, 'outdated')
  }
  const source = observations()
  source.node.result = success('v25.8.1')
  source.python.result = success('Python 3.14.5')
  source.npm.result = success('1.0.0')
  source.git.result = success('git version 1.0.0')
  assert.equal(evaluatePrerequisites(source).ok, true)
})

test('malformed and overflowing version output fails without echoing raw output', () => {
  for (const [id, output] of [['node', 'v24'], ['npm', 'npm unknown'], ['git', 'Git: latest'], ['python', 'Python three'], ['node', 'v99999999999999999999.0.0']]) {
    const source = observations(); source[id].result = success(output)
    const report = evaluatePrerequisites(source)
    assert.equal(check(report, id).status, 'unparseable')
    assert.equal(check(report, id).version, null)
    assert.equal(report.ok, false)
  }
})

test('timeouts, process failures, signals and output limits remain explicit sanitized failures', () => {
  for (const [result, status] of [
    [{ error: { code: 'ETIMEDOUT', message: '/private/secret-path TOKEN=private' } }, 'timeout'],
    [{ error: { code: 'ENOBUFS' } }, 'failed'],
    [{ status: 7, stdout: 'v24.0.0', stderr: '/private/secret-path' }, 'failed'],
    [{ status: 0, signal: 'SIGTERM', stdout: 'v24.0.0' }, 'failed'],
  ]) {
    const source = observations(); source.node = { result, command: '/private/secret-path/node --version' }
    const report = evaluatePrerequisites(source)
    assert.equal(check(report, 'node').status, status)
    assert.doesNotMatch(JSON.stringify(report), /secret-path|TOKEN/)
  }
})

test('native version formats include Windows and Apple Git suffixes and Python stderr', () => {
  for (const output of ['git version 2.54.0.windows.1\r\n', 'git version 2.39.5 (Apple Git-154)\n', 'git version 2.54\n']) {
    const source = observations(); source.git.result = success(output)
    assert.equal(check(evaluatePrerequisites(source), 'git').status, 'pass')
  }
  const source = observations(); source.python.result = { status: 0, stdout: '', stderr: 'Python 3.12.4\r\n' }
  assert.equal(check(evaluatePrerequisites(source), 'python').version, '3.12.4')
})

test('a prerelease of the exact minimum is below the stable baseline', () => {
  const source = observations()
  source.node.result = success('v24.0.0-rc.1')
  source.python.result = success('Python 3.12.0rc2')
  assert.equal(check(evaluatePrerequisites(source), 'node').status, 'outdated')
  assert.equal(check(evaluatePrerequisites(source), 'python').status, 'outdated')
})

test('local probes use only fixed version argument arrays and bounded shell-free execution', () => {
  const runner = fakeRunner()
  const env = { SENTINEL_SECRET: 'not-for-the-report', PATH: '/private/bin' }
  const report = createPrerequisiteReport({ ...probeOptions(runner), env })
  assert.equal(report.ok, true)
  assert.equal(runner.calls.length, 4)
  assert.deepEqual(runner.calls.map(item => item.args), Array.from({ length: 4 }, () => ['--version']))
  assert.deepEqual(runner.calls.map(item => item.executable), ['/private/toolchain/node', 'npm', 'git', 'python3'])
  for (const { options } of runner.calls) {
    assert.equal(options.shell, false)
    assert.equal(options.timeout, versionProbeOptions.timeout)
    assert.equal(options.maxBuffer, versionProbeOptions.maxBuffer)
    assert.equal(options.windowsHide, true)
    assert.equal(options.env.npm_config_update_notifier, 'false')
    assert.equal(options.env.PYTHONDONTWRITEBYTECODE, '1')
    assert.equal(options.env.GIT_OPTIONAL_LOCKS, '0')
  }
  assert.deepEqual(env, { SENTINEL_SECRET: 'not-for-the-report', PATH: '/private/bin' })
  assert.doesNotMatch(JSON.stringify(report), /private|SENTINEL_SECRET|not-for-the-report/)
})

test('Windows npm runs the standard npm CLI with Node and never npm.cmd or a shell', () => {
  const runner = fakeRunner()
  const npmExecPath = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'
  const observations = collectPrerequisiteObservations({ ...probeOptions(runner), platform: 'win32', execPath: 'C:\\Program Files\\nodejs\\node.exe', npmExecPath, hasFile: path => path === npmExecPath })
  assert.equal(evaluatePrerequisites(observations).ok, true)
  assert.deepEqual(runner.calls[1].args, [npmExecPath, '--version'])
  assert.equal(runner.calls[1].executable, 'C:\\Program Files\\nodejs\\node.exe')
  assert.equal(runner.calls.some(call => /(?:cmd|powershell|pwsh)(?:\.exe)?$/i.test(call.executable)), false)
  assert.doesNotMatch(JSON.stringify(evaluatePrerequisites(observations)), /Program Files|node_modules/)
})

test('an unknown npm script path is never executed and unavailable Windows npm is required', () => {
  const runner = fakeRunner()
  const report = createPrerequisiteReport({ ...probeOptions(runner), platform: 'win32', npmExecPath: '/private/arbitrary-script.js', hasFile: () => false })
  assert.equal(check(report, 'npm').status, 'missing')
  assert.equal(runner.calls.length, 3)
  assert.equal(runner.calls.some(call => call.args.some(arg => arg.includes('arbitrary'))), false)
})

test('a missing python3 falls back to python without invoking an installer-capable launcher', () => {
  const runner = fakeRunner({ python3: missing() })
  const report = createPrerequisiteReport(probeOptions(runner))
  assert.equal(report.ok, true)
  assert.equal(check(report, 'python').command, 'python --version')
  assert.deepEqual(runner.calls.slice(-2).map(call => call.executable), ['python3', 'python'])
  assert.equal(runner.calls.some(call => call.executable === 'py'), false)
})

test('Windows failed Store aliases use installed launcher paths with no interpreter-launch command', () => {
  const pythonPath = 'C:\\Program Files\\Python314\\python.exe'
  for (const aliasResult of [missing(), { status: 9009, stdout: '', stderr: 'Python was not found' }, success('The Python alias has no runtime')]) {
    const runner = fakeRunner({
      python3: aliasResult,
      python: { status: 9009, stdout: '', stderr: 'Python was not found' },
      py: success(` -V:3.12 C:\\Python312\\python.exe\r\n -V:3.14 * ${pythonPath}\r\n`),
      [pythonPath]: success('Python 3.14.5\n'),
    })
    const report = createPrerequisiteReport({ ...probeOptions(runner), platform: 'win32' })
    assert.equal(check(report, 'python').status, 'pass')
    assert.equal(check(report, 'python').command, 'installed Python --version')
    assert.deepEqual(runner.calls.find(call => call.executable === 'py').args, ['-0p'])
    assert.deepEqual(runner.calls.at(-1).args, ['--version'])
    assert.equal(runner.calls.at(-1).executable, pythonPath)
    assert.equal(runner.calls.every(call => call.options.shell === false), true)
    assert.doesNotMatch(JSON.stringify(report), /Program Files|Python314|Python312/)
  }
})

test('Windows retains a parseable older Python for an actionable version failure', () => {
  const runner = fakeRunner({ python3: success('Python 3.11.9\n') })
  const report = createPrerequisiteReport({ ...probeOptions(runner), platform: 'win32' })
  assert.equal(check(report, 'python').status, 'outdated')
  assert.equal(check(report, 'python').version, '3.11.9')
  assert.equal(check(report, 'python').command, 'python3 --version')
  assert.equal(runner.calls.some(call => call.executable === 'python' || call.executable === 'py'), false)
})

test('launcher paths accept quoted local installs but refuse relative paths, network paths and commands', () => {
  assert.equal(installedWindowsPythonPath(' -V:PythonCore/3.14 * "C:\\Program Files\\Python314\\python.exe"\r\n'), 'C:\\Program Files\\Python314\\python.exe')
  for (const output of ['python.exe', ' .\\runtime\\python.exe', ' \\\\network\\share\\python.exe', ' C:\\Python314\\python.exe --install', ' C:\\Python314\\install.cmd', ' https://example.invalid/python.exe']) {
    assert.equal(installedWindowsPythonPath(output), undefined)
  }
})

test('Python version probes remove legacy installation flags and disable manager automatic installs', () => {
  const runner = fakeRunner({ python3: missing(), python: missing(), py: success('No installed Pythons found') })
  const env = { PYLAUNCHER_ALLOW_INSTALL: '1', PyLauncher_Always_Install: '1', python_manager_automatic_install: 'true' }
  const report = createPrerequisiteReport({ ...probeOptions(runner), platform: 'win32', env })
  assert.equal(check(report, 'python').status, 'missing')
  for (const { options } of runner.calls) {
    assert.equal(options.env.PYTHON_MANAGER_AUTOMATIC_INSTALL, 'false')
    assert.equal(Object.keys(options.env).some(key => ['PYLAUNCHER_ALLOW_INSTALL', 'PYLAUNCHER_ALWAYS_INSTALL'].includes(key.toUpperCase())), false)
  }
  assert.deepEqual(env, { PYLAUNCHER_ALLOW_INSTALL: '1', PyLauncher_Always_Install: '1', python_manager_automatic_install: 'true' })
  assert.equal(runner.calls.some(call => call.args.some(arg => ['install', '-3', 'exec'].includes(arg))), false)
})

test('injected throwing runners produce failed or missing checks without leaking error messages', () => {
  const runner = fakeRunner({ git: new Error('/private/runtime-secret'), python3: Object.assign(new Error('/private/missing-secret'), { code: 'ENOENT' }), python: missing() })
  const report = createPrerequisiteReport(probeOptions(runner))
  assert.equal(check(report, 'git').status, 'failed')
  assert.equal(check(report, 'python').status, 'missing')
  assert.doesNotMatch(JSON.stringify(report), /runtime-secret|missing-secret/)
})

test('text and JSON CLI modes return failing status for unmet requirements and emit no extra JSON text', () => {
  const runner = fakeRunner({ git: missing() })
  let stdout = ''; let stderr = ''
  const options = { ...probeOptions(runner), stdout: { write: text => { stdout += text } }, stderr: { write: text => { stderr += text } } }
  assert.equal(runPrerequisiteCli(['--json'], options), 1)
  const json = JSON.parse(stdout)
  assert.equal(json.ok, false)
  assert.equal(check(json, 'git').status, 'missing')
  assert.equal(stderr, '')
  assert.match(formatPrerequisiteReport(json), /FAIL Git: missing/)
  stdout = ''
  assert.equal(runPrerequisiteCli([], options), 1)
  assert.match(stdout, /WebAppX developer prerequisites/)
  assert.match(stdout, /Required version checks failed/)
})

test('successful CLI, help and usage errors have explicit exit codes; help never probes', () => {
  const runner = fakeRunner()
  let stdout = ''; let stderr = ''
  const options = { ...probeOptions(runner), stdout: { write: text => { stdout += text } }, stderr: { write: text => { stderr += text } } }
  assert.equal(runPrerequisiteCli(['--help'], options), 0)
  assert.match(stdout, /Usage:/)
  assert.equal(runner.calls.length, 0)
  assert.equal(runPrerequisiteCli(['--install'], options), 2)
  assert.equal(runPrerequisiteCli(['--json', '--json'], options), 2)
  assert.match(stderr, /Usage:/)
  assert.equal(runner.calls.length, 0)
  stdout = ''
  assert.equal(runPrerequisiteCli(['--json'], options), 0)
  assert.equal(JSON.parse(stdout).ok, true)
})
