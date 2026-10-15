#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repository = fileURLToPath(new URL('../', import.meta.url))
const ROOT = 'webappx'
const SYSTEMX = 'systemx-managed'
const GUSTO = 'gusto-functions'
const reviewed = new Map()
const behavior = (mutation, workspaces, note) => ({ mutation, workspaces: [ROOT, ...workspaces], note })
const source = (note, workspaces = []) => behavior('source-read-only', workspaces, note)
const temporary = (note, workspaces = []) => behavior('temporary-files-or-processes', workspaces, note)
const register = (command, description) => reviewed.set(command, description)

// These are reviewed command signatures, not a second gate list. Gate order
// comes exclusively from check-template.sh. A changed command is unknown until
// its behavior is reviewed; a familiar script name never grants classification.
register('node scripts/developer-prerequisites.mjs', behavior('local-version-probes', [], 'Runs bounded local version probes; does not install prerequisites.'))
register('node --test tests/setup/developer-prerequisites.test.mjs', temporary('Tests injected version probes and filesystem observations.'))
register('node --test tests/setup/ci-plan.test.mjs', source('Tests the CI report using supplied source fixtures; runs no child commands.'))
register('node scripts/ci-plan.mjs', source('Reads CI/package/installation sources and prints this report.'))
register('node scripts/check-development-contracts.mjs', source('Reads public runtime pins, package metadata, environment example names and source/documentation declarations; does not read local env files.', [SYSTEMX]))
register('node --test tests/setup/development-contracts.test.mjs', temporary('Tests runtime/environment contracts with temporary fictional source trees.', [SYSTEMX]))
register('node --test tests/setup/dev-mock.test.mjs', temporary('Tests owned loopback listeners, native Vite child workers and temporary caches; preserves unrelated listeners.'))
register('node scripts/backlog-execution.mjs --check', source('Reads canonical backlog/evidence and compares the generated execution plan without rewriting it.'))
register('node --test tests/backlog/execution.test.mjs', behavior('local-read-only-child-processes', [], 'Tests supplied graphs and spawns read-only local report children; compares catalog, plan and blank seeds byte for byte.'))
register('node --test tests/browser/seed-pack.test.mjs', temporary('Tests fixtures and owned-resource cleanup with synthetic resources.'))
register('node --test tests/browser/keyboard-driver.test.mjs', temporary('Tests keyboard/focus guards using supplied browser observations.'))
register('node scripts/webappx-backlog.mjs --check', source('Validates the catalog and compares generated checklist/CSV without rewriting them.'))
register('node --test tests/backlog/catalog.test.mjs', temporary('Exercises catalog validation against temporary evidence fixtures.'))
register('python3 -B scripts/validate-template.py', source('Reads reusable template records, release fingerprints, research inventory and version metadata.', [SYSTEMX]))
register('python3 -B .SYSTEMX/manager.py status --target .', source('Reads selected installation and managed-release status.', [SYSTEMX]))
register('bash .SYSTEMX/SYSTEMX.sh validate', source('Validates selected managed release and outer project records.', [SYSTEMX]))
register('bash .SYSTEMX/wsg-agi.sh --check', temporary('Checks host drift; may allocate a temporary README comparison file; check mode does not rewrite host records.', [SYSTEMX]))
register('python3 .SYSTEMX/LAN/Research/LAN-Builder/tools/validate_package.py', behavior('possible-python-bytecode-cache', [SYSTEMX], 'Validates the research package; Python is invoked without -B and may create interpreter caches.'))
register('python3 -B scripts/test-systemx-tools.py', temporary('Copies the selected immutable release into a temporary test workspace and runs its tests there.', [SYSTEMX]))
register('python3 -B -m unittest discover -s tests/systemx -v', temporary('Runs integration tests with temporary managed installations and Git fixtures.', [SYSTEMX]))
register('python3 -B -m unittest discover -s tests/security -v', temporary('Runs security-control fixtures in temporary workspaces.', [SYSTEMX]))
register('eslint . --max-warnings=0', source('Checks lint without --fix or --cache.'))
register('tsc --noEmit -p tsconfig.json', source('Checks application types without emitting build output.'))
register('node --test .SYSTEMX/LAN/tests/characterization.test.mjs tests/security/controls.test.mjs', temporary('Runs app/LAN tests with temporary filesystem fixtures and owned local processes.', [SYSTEMX]))
register('node scripts/browser-smoke.mjs', temporary('Starts an owned loopback Vite server and Chromium contexts; writes temporary reports, downloads, screenshots and Vite cache.'))
register('node scripts/browser-keyboard.mjs', temporary('Starts an owned loopback Vite server and Chromium contexts; writes temporary keyboard evidence and Vite cache.'))
register('node scripts/browser-foundation.mjs', temporary('Reuses the owned loopback Vite/Chromium runner; writes temporary portal foundation, save-state, route and focus evidence.'))
register('node .SYSTEMX/scripts/validate-markdown-links.mjs', source('Reads tracked documentation and link targets.', [SYSTEMX]))
register('node .SYSTEMX/scripts/security-check.mjs', behavior('registry-network-and-npm-cache', [SYSTEMX], 'Reads security controls and runs a nested npm audit; contacts the configured registry and npm may write cache/log files. The separate ci:audit stage enforces strict audit failure.'))
register('node .SYSTEMX/scripts/account-level-check.mjs', source('Reads account-level configuration and permission checks.', [SYSTEMX]))
register('node .SYSTEMX/scripts/auth-mfa-readiness-check.mjs', source('Reads auth/MFA readiness configuration.', [SYSTEMX]))
register('node .SYSTEMX/scripts/agent-standard-check.mjs', source('Reads agent standards and coordination records.', [SYSTEMX]))
register('node .SYSTEMX/scripts/assert-lan-isolation.mjs', source('Reads production output to reject local LAN tooling.', [SYSTEMX]))
register('npm audit --audit-level=high', behavior('registry-network-and-npm-cache', [], 'Contacts the configured package registry for an audit; npm may write cache/log files. Does not install or fix packages.'))
register('npm --prefix integrations/gusto/functions audit --audit-level=high', behavior('registry-network-and-npm-cache', [GUSTO], 'Audits the Gusto Functions package through the configured registry; npm may write cache/log files. Does not install or fix packages.'))
register('tsc -b --noCheck', behavior('local-build-output', [], 'May emit TypeScript build output and incremental build metadata.'))
register('vite build', behavior('local-build-output', [], 'Writes production dist output and may write local Vite cache.'))
register('node --test tests/hr/gusto-sdk-mock.test.mjs tests/hr/mock-workflows.test.mjs tests/hr/gusto-backend.test.mjs tests/hr/people-operations.test.mjs tests/hr/insights.test.mjs tests/hr/service-desk.test.mjs tests/hr/linked-operations.test.mjs tests/hr/recruiting.test.mjs tests/hr/recruiting-link.test.mjs tests/hr/performance.test.mjs tests/hr/surveys.test.mjs tests/hr/persistence.test.mjs', temporary('Runs account-free HR models, Gusto adapter and Functions-source tests.', [GUSTO]))
register('node --test tests/portals/cms.test.mjs tests/portals/crm.test.mjs tests/portals/storage.test.mjs tests/portals/persistence.test.mjs tests/portals/backup.test.mjs tests/portals/import-state.test.mjs tests/portals/combined-backup.test.mjs tests/portals/restore-workspaces.test.mjs tests/portals/restore-points.test.mjs tests/portals/registry.test.mjs tests/portals/restore-budget.test.mjs', temporary('Runs CMS/CRM, persistence, backup and restore model tests.'))

const unknown = () => ({ mutation: 'unknown', workspaces: [ROOT], note: 'Unreviewed command or shell syntax; side effects and additional dependent workspaces are unknown.' })

/** Parse only the maintained literal gate loop. Never evaluate shell text. A
 * changed runner shape fails instead of silently omitting extra commands. */
export function parseGateOrder(shellSource) {
  if (typeof shellSource !== 'string') throw new Error('CI runner source must be text.')
  const normalized = shellSource.replace(/\r\n/g, '\n').replace(/^\s*#.*$/gm, '').trim()
  const match = /^set -euo pipefail\s+cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\."\s+for check in ([\s\S]+?); do\s+printf '\\nChecking %s\\n' "\$check"\s+npm run "\$check"\s+done$/.exec(normalized)
  if (!match) throw new Error('Unsupported ci:all runner shape; review the runner before relying on this plan.')
  const list = match[1].replace(/\\\n/g, ' ').trim().split(/\s+/)
  if (!list.length || list.some(name => !/^[a-z0-9][a-z0-9:_-]*$/i.test(name))) throw new Error('CI stages must be literal npm script names.')
  return list
}

function describeScript(name, scripts, stack = []) {
  if (stack.includes(name)) return [{ script: name, ...unknown(), note: 'Cyclic npm script dependency; execution behavior is unknown.' }]
  if (typeof scripts[name] !== 'string') return [{ script: name, ...unknown(), note: 'Referenced npm script is missing; the required gate would fail.' }]
  const result = []
  const nextStack = [...stack, name]
  if (typeof scripts[`pre${name}`] === 'string') result.push(...describeScript(`pre${name}`, scripts, nextStack))
  const command = scripts[name].trim()
  // A direct npm run delegation is expanded from the supplied package. Only
  // the existing --if-present form is accepted. No shell token is executed.
  const delegation = /^npm run ([a-z0-9][a-z0-9:_-]*)(?: (--if-present))?$/.exec(command)
  if (delegation) {
    if (delegation[2] && typeof scripts[delegation[1]] !== 'string') result.push({ script: name, mutation: 'source-read-only', workspaces: [ROOT], note: `Optional npm script ${delegation[1]} is absent; npm would skip it.` })
    else result.push(...describeScript(delegation[1], scripts, nextStack))
  } else {
    const parts = command.split(' && ')
    for (const part of parts) result.push({ script: name, ...(reviewed.get(part) ?? unknown()) })
  }
  if (typeof scripts[`post${name}`] === 'string') result.push(...describeScript(`post${name}`, scripts, nextStack))
  return result
}

/** Pure report construction: caller supplies source data. No command execution,
 * network calls, environment reads, filesystem writes or provider probes. */
export function buildCiPlan({ shellSource, packageJson, gustoPackageJson = {}, installation = {} }) {
  if (packageJson?.scripts?.['ci:all'] !== 'bash scripts/check-template.sh') throw new Error('Unsupported ci:all entry point; expected the maintained gate runner.')
  const scripts = packageJson.scripts
  const gateNames = parseGateOrder(shellSource)
  const stages = gateNames.map((name, index) => {
    const commands = describeScript(name, scripts)
    return { number: index + 1, name, workspaces: [...new Set(commands.flatMap(command => command.workspaces))], mutations: [...new Set(commands.map(command => command.mutation))], commands }
  })
  const safeVersion = value => typeof value === 'string' && /^[0-9A-Za-z.+-]{1,80}$/.test(value) ? value : 'unknown'
  const safeEngine = value => typeof value === 'string' && /^[0-9A-Za-z.<>=~^|*+ -]{1,80}$/.test(value) ? value : 'unknown'
  const version = safeVersion(installation.activeVersion)
  return {
    schemaVersion: 1,
    purpose: 'Informational source-derived plan. No CI gate was executed, skipped, reordered, parallelized or accepted by this report.',
    source: { runner: 'scripts/check-template.sh', scripts: 'package.json', entryPoint: 'ci:all' },
    workspaces: [
      { id: ROOT, path: '.', description: 'Root React/Vite/Firebase application and host tooling', node: safeEngine(packageJson.engines?.node) },
      { id: GUSTO, path: 'integrations/gusto/functions', description: 'Gusto Functions dependency audit and account-free backend source tests', node: safeEngine(gustoPackageJson.engines?.node) },
      { id: SYSTEMX, path: `.SYSTEMX/.systemx/releases/${version}`, description: 'Selected immutable shared release; outer .SYSTEMX records remain the host project scope', version },
    ],
    lifecycle: {
      before: typeof scripts['preci:all'] === 'string' ? describeScript('preci:all', scripts) : [],
      after: typeof scripts['postci:all'] === 'string' ? describeScript('postci:all', scripts) : [],
    },
    stages,
    unknown: stages.some(stage => stage.mutations.includes('unknown')) || ['preci:all', 'postci:all'].some(name => typeof scripts[name] === 'string' && describeScript(name, scripts).some(command => command.mutation === 'unknown')),
    limits: 'Behavior descriptions apply to reviewed command signatures, not arbitrary future script changes. They are not a sandbox or a proof that source is unchanged. Test fixtures may create temporary files/processes. This report does not establish gate success, installed prerequisites, live deployment, provider access or production readiness.',
  }
}

export function renderCiPlan(report) {
  const lines = ['WebAppX CI execution plan', report.purpose, '', 'Dependent workspaces:']
  for (const workspace of report.workspaces) lines.push(`- ${workspace.id}: ${workspace.path}; ${workspace.description}; Node ${workspace.node ?? 'not separately specified'}`)
  const lifecycle = (name, commands) => {
    if (commands.length) {
      lines.push('', `${name}:`)
      for (const command of commands) lines.push(`- ${command.script}: ${command.mutation}; ${command.note}`)
    }
  }
  lifecycle('npm lifecycle before ci:all', report.lifecycle.before)
  lines.push('', `Required stages (${report.stages.length}, existing sequential order):`)
  for (const stage of report.stages) {
    lines.push(`${String(stage.number).padStart(2, '0')}. npm run ${stage.name}`, `    Workspaces: ${stage.workspaces.join(', ')}; mutation: ${stage.mutations.join(', ')}`)
    for (const command of stage.commands) lines.push(`    ${command.script}: ${command.note}`)
  }
  lifecycle('npm lifecycle after ci:all', report.lifecycle.after)
  lines.push('', `Unreviewed behavior present: ${report.unknown ? 'yes; inspect unknown entries before scheduling work' : 'no'}`, report.limits)
  return `${lines.join('\n')}\n`
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--json') || args.length > 1) throw new Error('Usage: npm run ci:plan -- [--json]')
  const [shellSource, packageText, gustoText, installationText] = await Promise.all([
    readFile(resolve(repository, 'scripts/check-template.sh'), 'utf8'),
    readFile(resolve(repository, 'package.json'), 'utf8'),
    readFile(resolve(repository, 'integrations/gusto/functions/package.json'), 'utf8'),
    readFile(resolve(repository, '.SYSTEMX/INSTALLATION.json'), 'utf8'),
  ])
  const report = buildCiPlan({ shellSource, packageJson: JSON.parse(packageText), gustoPackageJson: JSON.parse(gustoText), installation: JSON.parse(installationText) })
  process.stdout.write(args.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : renderCiPlan(report))
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`CI plan failed: ${error.message}`); process.exitCode = 1 })
}
