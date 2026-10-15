import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCiPlan, main, parseGateOrder, renderCiPlan } from '../../scripts/ci-plan.mjs'

function runner(names) {
  return `#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "\${BASH_SOURCE[0]}")/.."\nfor check in ${names.join(' \\\n  ')}; do\n  printf '\\nChecking %s\\n' "$check"\n  npm run "$check"\ndone\n`
}

function plan(scripts, names = Object.keys(scripts).filter(name => name !== 'ci:all')) {
  return buildCiPlan({ shellSource: runner(names), packageJson: { scripts: { 'ci:all': 'bash scripts/check-template.sh', ...scripts }, engines: { node: '>=24.0.0' } }, gustoPackageJson: { engines: { node: '22' } }, installation: { activeVersion: '1.9.0-alpha.6' } })
}

test('reads all current required gates in the existing shell order', async () => {
  const [shellSource, packageText, gustoText, installationText] = await Promise.all([
    readFile(new URL('../../scripts/check-template.sh', import.meta.url), 'utf8'),
    readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../../integrations/gusto/functions/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../../.SYSTEMX/INSTALLATION.json', import.meta.url), 'utf8'),
  ])
  const report = buildCiPlan({ shellSource, packageJson: JSON.parse(packageText), gustoPackageJson: JSON.parse(gustoText), installation: JSON.parse(installationText) })
  assert.deepEqual(report.stages.map(stage => stage.name), parseGateOrder(shellSource))
  assert.deepEqual(report.stages.map(stage => stage.number), Array.from({ length: report.stages.length }, (_, index) => index + 1))
  assert.ok(report.stages.find(stage => stage.name === 'hr:backend:audit').workspaces.includes('gusto-functions'))
  assert.ok(report.stages.find(stage => stage.name === 'systemx:tools:test').workspaces.includes('systemx-managed'))
  assert.ok(report.stages.find(stage => stage.name === 'build').mutations.includes('local-build-output'))
  assert.ok(report.stages.find(stage => stage.name === 'ci:security').mutations.includes('registry-network-and-npm-cache'), 'security-check contains a nested npm audit')
  assert.equal(report.workspaces.find(workspace => workspace.id === 'gusto-functions').node, '22')
  assert.ok(renderCiPlan(report).includes(`Required stages (${report.stages.length}, existing sequential order)`))
})

test('changed gate ordering and repeated gates are reflected without a duplicated inventory', () => {
  const report = plan({ alpha: 'eslint . --max-warnings=0', beta: 'vite build' }, ['beta', 'alpha', 'beta'])
  assert.deepEqual(report.stages.map(stage => stage.name), ['beta', 'alpha', 'beta'])
  assert.deepEqual(report.stages[0].mutations, ['local-build-output'])
  assert.deepEqual(report.stages[1].mutations, ['source-read-only'])
})

test('rejects added shell execution outside the supported loop instead of omitting it', () => {
  assert.throws(() => parseGateOrder(`${runner(['lint'])}\nnode extra-check.mjs\n`), /Unsupported ci:all runner shape/)
  assert.throws(() => parseGateOrder(runner(['lint']).replace('npm run "$check"', 'npm run "$check" || true')), /Unsupported ci:all runner shape/)
  assert.throws(() => parseGateOrder(runner(['lint']).replace('npm run "$check"', 'echo "$check"')), /Unsupported ci:all runner shape/)
})

test('rejects shell expansions and substitutions in stage names without evaluating them', () => {
  assert.throws(() => parseGateOrder(runner(['$(touch /tmp/ci-plan-must-not-execute)'])), /literal npm script names/)
  assert.throws(() => parseGateOrder(runner(['lint;malicious'])), /literal npm script names/)
  assert.throws(() => parseGateOrder(runner(['$GATE'])), /literal npm script names/)
})

test('a familiar gate with a changed command remains unknown', () => {
  const report = plan({ 'ci:lint': 'eslint . --fix', custom: 'node scripts/unreviewed.mjs', combined: 'eslint . --max-warnings=0 && arbitrary-tool' })
  assert.deepEqual(report.stages[0].mutations, ['unknown'])
  assert.deepEqual(report.stages[1].mutations, ['unknown'])
  assert.deepEqual(report.stages[2].mutations, ['source-read-only', 'unknown'])
  assert.equal(report.unknown, true)
})

test('expands actual npm script delegation and implicit pre/post hooks', () => {
  const report = plan({ 'ci:test': 'npm run test --if-present', pretest: 'vite build', test: 'eslint . --max-warnings=0', posttest: 'node scripts/unreviewed.mjs' }, ['ci:test'])
  assert.deepEqual(report.stages[0].commands.map(command => command.script), ['pretest', 'test', 'posttest'])
  assert.deepEqual(report.stages[0].mutations, ['local-build-output', 'source-read-only', 'unknown'])
})

test('reports optional missing scripts and required missing scripts distinctly', () => {
  const report = plan({ optional: 'npm run absent --if-present', required: 'npm run absent' }, ['optional', 'required', 'absent'])
  assert.match(report.stages[0].commands[0].note, /would skip/)
  assert.deepEqual(report.stages[0].mutations, ['source-read-only'])
  assert.deepEqual(report.stages[1].mutations, ['unknown'])
  assert.match(report.stages[2].commands[0].note, /required gate would fail/)
})

test('contains script dependency cycles without recursion or false read-only claims', () => {
  const report = plan({ alpha: 'npm run beta', beta: 'npm run alpha' }, ['alpha'])
  assert.equal(report.unknown, true)
  assert.match(report.stages[0].commands[0].note, /Cyclic/)
})

test('includes implicit ci:all lifecycle hooks that surround the shell runner', () => {
  const report = plan({ lint: 'eslint . --max-warnings=0', 'preci:all': 'vite build', 'postci:all': 'unknown-tool' }, ['lint'])
  assert.deepEqual(report.lifecycle.before.map(command => command.mutation), ['local-build-output'])
  assert.deepEqual(report.lifecycle.after.map(command => command.mutation), ['unknown'])
  assert.equal(report.unknown, true)
  assert.match(renderCiPlan(report), /npm lifecycle before ci:all/)
})

test('recognizes registry audits, build writes and temporary browser resources', () => {
  const report = plan({ audit: 'npm audit --audit-level=high', build: 'tsc -b --noCheck && vite build && node .SYSTEMX/scripts/assert-lan-isolation.mjs', browser: 'node scripts/browser-keyboard.mjs' })
  assert.deepEqual(report.stages[0].mutations, ['registry-network-and-npm-cache'])
  assert.deepEqual(report.stages[1].mutations, ['local-build-output', 'source-read-only'])
  assert.deepEqual(report.stages[2].mutations, ['temporary-files-or-processes'])
  assert.equal(report.unknown, false)
})

test('does not echo unreviewed command bodies or machine paths into the report', () => {
  const marker = '/Users/private-home/secret-command-token'
  const report = buildCiPlan({ shellSource: runner(['custom']), packageJson: { scripts: { 'ci:all': 'bash scripts/check-template.sh', custom: `node ${marker}` }, engines: { node: marker } }, installation: { activeVersion: marker }, gustoPackageJson: { engines: { node: marker } } })
  assert.equal(JSON.stringify(report).includes(marker), false)
  assert.equal(renderCiPlan(report).includes(marker), false)
  assert.equal(report.workspaces[2].version, 'unknown')
})

test('report source exposes no process execution, environment probing or filesystem writes', async () => {
  const source = await readFile(new URL('../../scripts/ci-plan.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /node:child_process|(?<!\.)\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(/)
  assert.doesNotMatch(source, /process\.env|\b(?:writeFile|writeFileSync|mkdir|mkdirSync|fetch)\s*\(/)
  assert.doesNotMatch(source, /\beval\s*\(|\bnew Function\s*\(/)
})

test('rejects unknown options and unsupported ci:all entry points', async () => {
  await assert.rejects(main(['--run']), /Usage/)
  await assert.rejects(main(['--json', '--json']), /Usage/)
  assert.throws(() => plan({ 'ci:all': 'bash scripts/other-gates.sh', lint: 'eslint . --max-warnings=0' }, ['lint']), /Unsupported ci:all entry point/)
})
