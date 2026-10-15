#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const prerequisiteBaseline = Object.freeze({
  node: '24.0.0',
  npm: null,
  git: null,
  python: '3.12.0',
})
export const versionProbeOptions = Object.freeze({ shell: false, timeout: 5_000, maxBuffer: 65_536, encoding: 'utf8', windowsHide: true })

const tools = Object.freeze([
  { id: 'node', label: 'Node.js' },
  { id: 'npm', label: 'npm' },
  { id: 'git', label: 'Git' },
  { id: 'python', label: 'Python' },
])
const scope = 'Version prerequisites only. A passing report does not establish tested runtime or platform support, installed app dependencies, or optional Firebase, Java, GitHub CLI or provider readiness.'
const commands = Object.freeze({
  node: ['running Node.js --version'],
  npm: ['npm --version', 'Node.js npm CLI --version'],
  git: ['git --version'],
  python: ['python3 --version', 'python --version', 'installed Python --version'],
})

function parsedVersion(id, output) {
  const pattern = id === 'git'
    ? /^git version (\d+)\.(\d+)(?:\.(\d+))?(?:[.\s].*)?$/m
    : id === 'python'
      ? /^Python (\d+)\.(\d+)\.(\d+)((?:a|b|rc)\d+)?(?:\s.*)?$/m
      : /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/m
  const match = pattern.exec(output.replace(/\r/g, ''))
  if (!match) return undefined
  const parts = match.slice(1, 4).map(part => Number(part ?? 0))
  if (parts.some(part => !Number.isSafeInteger(part))) return undefined
  const prerelease = id !== 'git' ? match[4] ?? '' : ''
  return { parts, prerelease, version: `${parts.join('.')}${prerelease}` }
}

function meetsMinimum(version, minimum) {
  if (minimum === null) return true
  const expected = minimum.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (version.parts[index] !== expected[index]) return version.parts[index] > expected[index]
  }
  return version.prerelease.length === 0
}

function versionFromResult(id, result) {
  return parsedVersion(id, `${typeof result.stdout === 'string' ? result.stdout : ''}\n${typeof result.stderr === 'string' ? result.stderr : ''}`)
}

/** The Windows launcher's -0p output lists installed runtime paths without
 * launching an interpreter. Accept only a local absolute python.exe path;
 * never evaluate the listing as a command or attempt a network executable.
 */
export function installedWindowsPythonPath(output) {
  const candidates = []
  for (const line of output.split(/\r?\n/)) {
    const match = /(?:^|\s)(?:"([A-Za-z]:[\\/][^"\r\n]*[\\/]python\.exe)"|([A-Za-z]:[\\/][^"\r\n]*[\\/]python\.exe))\s*$/i.exec(line)
    if (match) candidates.push({ path: match[1] ?? match[2], preferred: /\s\*\s/.test(line) })
  }
  return (candidates.find(candidate => candidate.preferred) ?? candidates[0])?.path
}

/** Deterministic evaluation of supplied command observations. Raw command output,
 * errors, environment variables and executable paths never enter the report.
 */
export function evaluatePrerequisites(observations, baseline = prerequisiteBaseline) {
  const checks = tools.map(({ id, label }) => {
    const minimum = baseline[id]
    const requirement = minimum === null ? 'Installed with a parseable version; no minimum specified' : `>=${minimum}`
    const observation = observations[id]
    const result = observation?.result
    const command = commands[id].includes(observation?.command) ? observation.command : commands[id][0]
    const base = { id, label, required: true, minimum, requirement, command }
    const fail = (status, message) => ({ ...base, status, version: null, message })
    if (!result || result.error?.code === 'ENOENT' || result.error?.code === 'ENOTDIR') return fail('missing', `${label} was not found by the selected version command.`)
    if (result.error?.code === 'ETIMEDOUT') return fail('timeout', `${label} did not report its version within the time limit.`)
    if (result.error || result.status !== 0 || result.signal) return fail('failed', result.error?.code === 'ENOBUFS' ? `${label} version output exceeded the size limit.` : `${label} version command did not complete successfully.`)
    const version = versionFromResult(id, result)
    if (!version) return fail('unparseable', `${label} returned no recognizable version.`)
    if (!meetsMinimum(version, minimum)) return { ...base, status: 'outdated', version: version.version, message: `${label} does not meet the required version ${requirement}.` }
    return { ...base, status: 'pass', version: version.version, message: minimum === null ? `${label} is available; no minimum version is specified.` : `${label} meets the required version.` }
  })
  return { schemaVersion: 1, ok: checks.every(check => check.status === 'pass'), scope, checks }
}

function npmCliPath({ execPath, npmExecPath, hasFile }) {
  // npm run supplies its CLI path. Accept only the standard npm/bin/npm-cli.js
  // shape, then use the running Node executable rather than a command shell.
  const candidates = []
  if (typeof npmExecPath === 'string' && /(?:^|[\\/])npm[\\/]bin[\\/]npm-cli\.js$/i.test(npmExecPath)) candidates.push(npmExecPath)
  candidates.push(join(dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'))
  candidates.push(resolve(dirname(execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'))
  return candidates.find(candidate => {
    try { return hasFile(candidate) } catch { return false }
  })
}

/** Probe only local --version commands with bounded output and execution time.
 * The injected runner/filesystem checks make all platform branches testable
 * without installing, invoking a shell, contacting a provider or writing files.
 */
export function collectPrerequisiteObservations({ run = spawnSync, platform = process.platform, execPath = process.execPath, npmExecPath = process.env.npm_execpath, hasFile = existsSync, env = process.env } = {}) {
  const childEnv = { ...env }
  for (const key of Object.keys(childEnv)) {
    if (['PYLAUNCHER_ALLOW_INSTALL', 'PYLAUNCHER_ALWAYS_INSTALL', 'PYTHON_MANAGER_AUTOMATIC_INSTALL'].includes(key.toUpperCase())) delete childEnv[key]
  }
  // Python aliases can resolve to the new Windows install manager. Prevent
  // automatic installation; legacy py install-on-demand flags are removed too.
  // https://docs.python.org/3/using/windows.html#install-on-demand
  const options = { ...versionProbeOptions, env: { ...childEnv, npm_config_update_notifier: 'false', npm_config_audit: 'false', PYTHONDONTWRITEBYTECODE: '1', PYTHON_MANAGER_AUTOMATIC_INSTALL: 'false', GIT_OPTIONAL_LOCKS: '0' } }
  function probe(executable, args, command) {
    try { return { command, result: run(executable, args, options) } }
    catch (error) { return { command, result: { error: { code: error?.code ?? 'PROBE_FAILED' } } } }
  }
  const observations = {}
  observations.node = probe(execPath, ['--version'], 'running Node.js --version')
  const npmCli = npmCliPath({ execPath, npmExecPath, hasFile })
  observations.npm = npmCli
    ? probe(execPath, [npmCli, '--version'], 'Node.js npm CLI --version')
    : platform === 'win32'
      ? { command: 'Node.js npm CLI --version', result: { error: { code: 'ENOENT' } } }
      : probe('npm', ['--version'], 'npm --version')
  observations.git = probe('git', ['--version'], 'git --version')
  observations.python = probe('python3', ['--version'], 'python3 --version')
  if (platform === 'win32') {
    const parseable = observation => !observation.result?.error && observation.result?.status === 0 && !observation.result?.signal && versionFromResult('python', observation.result)
    if (!parseable(observations.python)) {
      const python = probe('python', ['--version'], 'python --version')
      if (parseable(python)) observations.python = python
      else {
        const listing = probe('py', ['-0p'], 'installed Python --version').result
        const path = !listing?.error && listing?.status === 0 && !listing?.signal
          ? installedWindowsPythonPath(`${typeof listing.stdout === 'string' ? listing.stdout : ''}\n${typeof listing.stderr === 'string' ? listing.stderr : ''}`)
          : undefined
        if (path) observations.python = probe(path, ['--version'], 'installed Python --version')
      }
    }
  } else if (['ENOENT', 'ENOTDIR'].includes(observations.python.result?.error?.code)) observations.python = probe('python', ['--version'], 'python --version')
  return observations
}

export function createPrerequisiteReport(options) {
  return evaluatePrerequisites(collectPrerequisiteObservations(options))
}

export function formatPrerequisiteReport(report) {
  const lines = ['WebAppX developer prerequisites', '']
  for (const check of report.checks) {
    lines.push(`${check.status === 'pass' ? 'PASS' : 'FAIL'} ${check.label}: ${check.version ?? check.status}; required ${check.requirement}`)
    lines.push(`     ${check.command}. ${check.message}`)
  }
  lines.push('', report.ok ? 'All required version checks passed.' : 'Required version checks failed. Correct the reported local tools, then run this command again.', '', report.scope)
  return `${lines.join('\n')}\n`
}

export function runPrerequisiteCli(args, { stdout = process.stdout, stderr = process.stderr, ...probeOptions } = {}) {
  if (args.length > 1 || (args.length === 1 && !['--json', '--help', '-h'].includes(args[0]))) {
    stderr.write('Usage: node scripts/developer-prerequisites.mjs [--json|--help]\n')
    return 2
  }
  if (args[0] === '--help' || args[0] === '-h') {
    stdout.write('Usage: node scripts/developer-prerequisites.mjs [--json|--help]\nReports required Node.js, npm, Git and Python versions using local read-only commands.\n')
    return 0
  }
  const report = createPrerequisiteReport(probeOptions)
  stdout.write(args[0] === '--json' ? `${JSON.stringify(report, null, 2)}\n` : formatPrerequisiteReport(report))
  return report.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = runPrerequisiteCli(process.argv.slice(2))
