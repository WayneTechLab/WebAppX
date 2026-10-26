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
register('node scripts/package-script-discovery.mjs --check', source('Validates the exact current package-script membership against six reviewed purpose categories without executing script values.'))
register('node scripts/check-doc-commands.mjs', source('Checks npm names in bounded maintained Markdown examples against reviewed public manifests and exact occurrence contexts without executing examples.'))
register('node scripts/fixture-inventory.mjs --check', source('Validates the finite public fictional source/reset inventory and actual source/control bindings without importing models or resetting data.', [SYSTEMX]))
register('node scripts/check-child-processes.mjs', behavior('local-read-only-child-processes', [], 'Statically parses maintained JavaScript/TypeScript and Python child-process call sites; a bounded argument-array Python AST helper reads public source without executing scanned code.'))
register('node --test tests/setup/package-script-discovery.test.mjs tests/setup/doc-commands.test.mjs tests/setup/fixture-inventory.test.mjs tests/setup/child-processes.test.mjs', temporary('Tests inert script discovery, bounded documentation parsing/contexts, fictional source inventory and static child-process diagnostics using owned fixtures and read-only children.'))
register('node scripts/developer-prerequisites.mjs', behavior('local-version-probes', [], 'Runs bounded local version probes; does not install prerequisites.'))
register('node --test tests/setup/developer-prerequisites.test.mjs', temporary('Tests injected version probes and filesystem observations.'))
register('node --test tests/setup/ci-plan.test.mjs', source('Tests the CI report using supplied source fixtures; runs no child commands.'))
register('node scripts/ci-plan.mjs', source('Reads CI/package/installation sources and prints this report.'))
register('node scripts/check-development-contracts.mjs', source('Reads public runtime pins, package metadata, environment example names and source/documentation declarations; does not read local env files.', [SYSTEMX]))
register('node --test tests/setup/development-contracts.test.mjs', temporary('Tests runtime/environment contracts with temporary fictional source trees.', [SYSTEMX]))
register('node scripts/check-environment-examples.mjs', source('Validates the proposal schema, tracked root/starter examples, browser declarations and reviewed server guide through a fixed six-file allowlist; never reads private environment files or shell values.', [SYSTEMX]))
register('node --test tests/setup/environment-examples.test.mjs', temporary('Tests configuration classifications, example placeholders, path boundaries and read-only CLI behavior with temporary fictional files and poisoned private inputs.', [SYSTEMX]))
register('node --test tests/setup/repository-identity.test.mjs', temporary('Tests bounded repository receipts with injected remote responses and disposable Git repositories; preserves index, local work, blank seeds and immutable fixtures without real network calls.'))
register('node --test tests/setup/dev-mock.test.mjs', temporary('Tests owned loopback listeners, native Vite child workers and temporary caches; preserves unrelated listeners.'))
register('node --test .SYSTEMX/LAN/tests/session-supervisor.test.mjs .SYSTEMX/LAN/tests/session-restart-preview.test.mjs', temporary('Tests fixed loopback ports, injected session children, readiness probes and read-only OS process/listener inspection with temporary session fixtures; does not launch Firebase.', [SYSTEMX]))
register('node scripts/backlog-execution.mjs --check', source('Reads canonical backlog/evidence and compares the generated execution plan without rewriting it.'))
register('node --test tests/backlog/execution.test.mjs', behavior('local-read-only-child-processes', [], 'Tests supplied graphs and spawns read-only local report children; compares catalog, plan and blank seeds byte for byte.'))
register('node scripts/backlog-evidence.mjs --check', source('Validates scoped revision/category references and contained evidence files; does not change proposal completion.'))
register('node --test tests/backlog/evidence.test.mjs', temporary('Tests evidence validation with fictional files, symlinks and read-only report children; compares catalog and blank seeds byte for byte.'))
register('node --test tests/backlog/impact.test.mjs', temporary('Tests committed-tree proposal impact, catalog provenance, metadata advisories and isolated Git refusal boundaries in disposable local repositories without network calls.'))
register('node --test .SYSTEMX/LAN/tests/work-status.test.mjs', temporary('Tests separate reusable work-record matches, roadmap proposals and explicitly selected root/child records using temporary public fixtures.', [SYSTEMX]))
register('node --test tests/browser/seed-pack.test.mjs tests/browser/preview-process.test.mjs tests/browser/recruiting-harness.test.mjs tests/browser/payroll-control-harness.test.mjs tests/browser/crm-merge-harness.test.mjs', temporary('Tests literal seeds, independent complete recruiting/payroll-control/CRM-merge oracles and finite status inventories, injected cleanup failures and an actual owned loopback preview child through argument arrays, PID-bound readiness and exact-process shutdown; preserves an unrelated sentinel listener.'))
register('node --test tests/browser/keyboard-driver.test.mjs', temporary('Tests keyboard/focus guards using supplied browser observations.'))
register('node scripts/webappx-backlog.mjs --check', source('Validates the catalog and compares generated checklist/CSV without rewriting them.'))
register('node --test tests/backlog/catalog.test.mjs', temporary('Exercises catalog validation against temporary evidence fixtures.'))
register('python3 -B scripts/validate-template.py', source('Reads reusable records, release/research/version integrity and finite grouped starter app/dependency/asset/configuration parity, without rewriting either distribution.', [SYSTEMX]))
register('python3 -B .SYSTEMX/manager.py status --target .', source('Reads selected installation and managed-release status.', [SYSTEMX]))
register('bash .SYSTEMX/SYSTEMX.sh validate', source('Validates selected managed release and outer project records.', [SYSTEMX]))
register('bash .SYSTEMX/wsg-agi.sh --check', temporary('Checks host drift; may allocate a temporary README comparison file; check mode does not rewrite host records.', [SYSTEMX]))
register('python3 .SYSTEMX/LAN/Research/LAN-Builder/tools/validate_package.py', behavior('possible-python-bytecode-cache', [SYSTEMX], 'Validates the research package; Python is invoked without -B and may create interpreter caches.'))
register('python3 -B scripts/test-systemx-tools.py', temporary('Copies the selected immutable release into a temporary test workspace and runs its tests there.', [SYSTEMX]))
register('python3 -B -m unittest discover -s tests/systemx -v', temporary('Runs imports, provenance, adopted TODO intake/gate and grouped starter tests in temporary installations/Git fixtures, plus bounded spaces/Unicode-path setup reads and configured offline doctor copies; starts no services and injects public-main responses.', [SYSTEMX]))
register('python3 -B -m unittest discover -s tests/security -v', temporary('Runs security-control fixtures in temporary workspaces.', [SYSTEMX]))
register('eslint . --max-warnings=0', source('Checks lint without --fix or --cache.'))
register('tsc --noEmit -p tsconfig.json', source('Checks application types without emitting build output.'))
register('node --test .SYSTEMX/LAN/tests/characterization.test.mjs tests/security/controls.test.mjs .SYSTEMX/LAN/tests/preview-navigator.test.mjs', temporary('Runs app/LAN tests with temporary filesystem fixtures and owned local processes, plus bounded metadata-only Navigator hierarchy/search/scope fixtures.', [SYSTEMX]))
register('node scripts/browser-smoke.mjs', temporary('Forks its own loopback Vite child, binds readiness to its process handle/PID and allocated port, and closes that exact process after Chromium; writes temporary reports, downloads, screenshots and Vite cache.'))
register('node scripts/browser-keyboard.mjs', temporary('Starts an owned loopback Vite server and Chromium contexts; writes temporary keyboard evidence and Vite cache.'))
register('node scripts/browser-foundation.mjs', temporary('Reuses the owned loopback Vite/Chromium runner; writes temporary portal foundation, save-state, route and focus evidence.'))
register('node scripts/browser-state-contract.mjs', temporary('Uses isolated loopback Chromium contexts for saved/transient portal state, selected restores and denied-storage export; writes temporary evidence and closes owned resources.'))
register('node scripts/browser-lifecycles.mjs', temporary('Exercises rendered CMS/CRM lifecycles, real downloads and a detached CRM browser-module refusal probe in owned loopback Chromium contexts; writes temporary evidence.'))
register('node scripts/browser-portal-lifecycle.mjs', temporary('Exercises native employment/correction, atomic CMS releases, CRM ownership and recovery inspection through real controls in four fresh owned Chromium contexts; writes temporary downloads, visible-control/status measurements and narrow extra-large grayscale evidence, then closes owned resources.'))
register('node scripts/browser-recruiting.mjs', temporary('Exercises account-free recruiting lifecycle controls, scoped interview privacy, preview confirmation and saved-workspace recovery in owned loopback Chromium contexts; writes temporary reports, downloads and visual evidence, then closes owned resources.'))
register('node scripts/browser-payroll.mjs', temporary('Exercises existing onboarding/benefits/time/payroll/statement flows plus hard period closure, separate cumulative monetary corrections, scoped statements and backup/restore/Undo through literal independent oracles in owned loopback Chromium contexts; writes temporary evidence and closes owned resources.'))
register('node .SYSTEMX/LAN/tests/work-status-browser.mjs', temporary('Exercises actual LAN work-status cards and explicit scope selection against an owned temporary server/Chromium fixture, preserving real project record bytes.', [SYSTEMX]))
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
register('node --test tests/hr/gusto-sdk-mock.test.mjs tests/hr/mock-workflows.test.mjs tests/hr/gusto-backend.test.mjs tests/hr/people-operations.test.mjs tests/hr/insights.test.mjs tests/hr/service-desk.test.mjs tests/hr/linked-operations.test.mjs tests/hr/recruiting.test.mjs tests/hr/recruiting-link.test.mjs tests/hr/performance.test.mjs tests/hr/surveys.test.mjs tests/hr/persistence.test.mjs tests/hr/lifecycle.test.mjs tests/hr/employment-lifecycle-ui.test.mjs tests/hr/directory-corrections-ui.test.mjs tests/hr/recruiting-core.test.mjs tests/hr/recruiting-requisitions.test.mjs tests/hr/recruiting-requisitions-ui.test.mjs tests/hr/recruiting-interviews.test.mjs tests/hr/recruiting-interviews-ui.test.mjs tests/hr/recruiting-scorecard-controller.test.mjs tests/hr/recruiting-applications-ui.test.mjs tests/hr/provider-adapter.test.mjs tests/hr/recruiting-preview-shell.test.mjs tests/hr/recruiting-employment-baseline.test.mjs tests/hr/recruiting-persistence.test.mjs tests/hr/recruiting-lifecycle-host.test.mjs tests/hr/recruiting-integration.test.mjs tests/hr/payroll-control.test.mjs tests/hr/payroll-control-ui.test.mjs tests/hr/payroll-control-integration.test.mjs tests/hr/payroll-control-host.test.mjs', temporary('Runs account-free HR models, Gusto adapter and Functions-source tests, complete employment and recruiting lifecycle/import invariants, scoped provider/preview adapters and actual employment/directory/recruiting/payroll-control UI and latest-root host callback fixtures, with immutable closure/correction replay and private preview bindings.', [GUSTO]))
register('node --test tests/portals/cms.test.mjs tests/portals/crm.test.mjs tests/portals/storage.test.mjs tests/portals/persistence.test.mjs tests/portals/backup.test.mjs tests/portals/import-state.test.mjs tests/portals/combined-backup.test.mjs tests/portals/restore-workspaces.test.mjs tests/portals/restore-points.test.mjs tests/portals/registry.test.mjs tests/portals/restore-budget.test.mjs tests/portals/cms-releases.test.mjs tests/portals/cms-release-callbacks.test.mjs tests/portals/crm-ownership.test.mjs tests/portals/lifecycle-inspection.test.mjs tests/portals/recruiting-inspection.test.mjs tests/portals/retained-surface.test.mjs tests/portals/payroll-control-inspection.test.mjs tests/crm/merge-core.test.mjs tests/crm/merge-history.test.mjs tests/crm/merge-report.test.mjs tests/crm/merge-projection.test.mjs tests/crm/merge-controller.test.mjs tests/crm/merge-host.test.mjs tests/portals/crm-merge-inspection.test.mjs', temporary('Runs CMS/CRM, persistence, backup and restore model tests, atomic release/ownership transactions, actual release UI callbacks and complete optional employment/recruiting lifecycle collection inspections and retained portal surfaces with actual DOM removal, plus safe complete payroll-control event/anchor inspection.'))

register('node --test tests/backlog/documentation-freshness.test.mjs', temporary('Tests bound committed-catalog comparisons, original receipt qualifications, read-only previews and deliberate atomic decision appends in disposable repositories.'))
register('node scripts/hr-role-examples.mjs --check', source('Checks reviewed HR capability examples, source bindings and generated guide without changing them.'))
register('node --test tests/hr/role-examples.test.mjs', temporary('Exercises independent HR role/relationship expectations, source drift, portable text hashes and owned guide regeneration fixtures.'))
register('node scripts/check-gusto-capability-gaps.mjs --check', source('Checks all 33 authored native, selected SDK, backend and provider mappings against reviewed source bindings and the exact pinned vendor inventory.'))
register('node --test tests/hr/capability-gaps.test.mjs', temporary('Tests complete capability coverage, actual selected JSX exports, source drift, byte and text hash rules, and contained guide-only regeneration.'))
register('node --test tests/adoption/hr-disabled.test.mjs', temporary('Tests the CMS/CRM-only adopted backup codec, refused legacy data, rollback and owned rehearsal interruption behavior; never targets an existing app.'))
register('node scripts/rehearse-hr-disabled.mjs', temporary('Captures allowlisted committed app blobs into an owned temporary app, applies six reviewed HR-disabled overrides, builds and runs real CMS/CRM browser journeys, then closes owned resources.'))
register('node scripts/browser-evaluators.mjs', temporary('Runs the authored HR/CMS/CRM and selective restore/Undo evaluator demonstrations in fresh owned Chromium contexts, with actual downloads and complete saved-payload comparisons.'))

register("node --test tests/hr/payroll-periods-rates.test.mjs tests/hr/time-editing.test.mjs tests/hr/selected-payroll-insights.test.mjs tests/portals/crm-import-validation.test.mjs tests/portals/manual-restore-points.test.mjs tests/portals/return-location.test.mjs tests/portals/undo-preview-binding.test.mjs tests/portals/workspace-inspection.test.mjs", temporary('Runs independent payroll periods/rates, draft time editing, frozen statements, strict CRM imports, named history, pure inspections/differences, session navigation and Undo preview binding fixtures.'))
register('node scripts/browser-maturity.mjs', temporary('Exercises the 16 portal maturity criteria through real rendered controls and downloads in four owned isolated browser contexts; explicitly labels a navigation-only unsupported-route probe and preserves failed evidence.'))

register('node --test tests/portals/unsaved-navigation.test.mjs tests/portals/cms-editor-recovery.test.mjs tests/portals/domain-differences.test.mjs tests/portals/recovery-preferences.test.mjs tests/portals/replacement-recovery.test.mjs tests/portals/replacement-epochs.test.mjs tests/portals/restore-point-kinds.test.mjs tests/hr/unsaved-forms.test.mjs tests/browser/portal-quality-auditor.test.mjs tests/browser/sdk-quality.test.mjs', temporary('Runs independent dirty-navigation/history/volatile-slot, CMS editor recovery, domain differences, opt-in replacement checkpoint, exact preview binding, restore-kind, HR draft controller and rendered-name/status auditor fixtures.'))
register('node scripts/browser-safety.mjs', temporary('Exercises dirty navigation, retained CMS editors, structured differences, preview-bound opt-in checkpoints and storage refusal through real controls in six isolated owned browser contexts; records full exports, exact saved bytes and grayscale evidence.'))
register('node scripts/browser-quality.mjs', temporary('Audits actual accessible action names including hidden mounted portals, finite workflow status text, monochrome views and native extra-large form/restore geometry in owned isolated browser contexts.'))
register('node scripts/browser-sdk-quality.mjs', temporary('Exercises the separate implemented pinned SDK session through a strictly same-origin local mock API, genuine SDK controls and labeled rare API-error rendering fixtures; captures monochrome state meaning while comparing complete native browser storage. No provider credentials or requests are permitted.'))
register('node scripts/browser-recovery-drill.mjs', temporary('Runs malformed import, denied storage, uncertain selective restore rollback and portable rescue drills in owned isolated browser contexts with explicitly controlled storage faults; writes temporary evidence.'))

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
