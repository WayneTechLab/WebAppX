import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { readLanGoal } from '../../.SYSTEMX/swarm/lan-goal.mjs'
import { buildCatalog, progressFile, runCli, specificationFiles } from '../../scripts/lan-backlog.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = resolve(root, '.SYSTEMX/swarm/cli.mjs')
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const jsonFile = (path, data) => writeFileSync(path, JSON.stringify(data))
const git = (repo, ...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
const goal = (repo, ...args) => spawnSync(process.execPath, [cli, 'goal', '--repo', repo, ...args], { encoding: 'utf8' })
const gates = ['local', 'operator', 'provider']

function fixture(t) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'lan-swarm-goal-'))), repo = join(temp, 'project')
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  for (const name of specificationFiles) {
    mkdirSync(dirname(join(repo, name)), { recursive: true })
    copyFileSync(join(root, name), join(repo, name))
  }
  mkdirSync(dirname(join(repo, progressFile)), { recursive: true })
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: [] })
  return { temp, repo }
}

test('CLI goal matches authoritative summary and all gate counts from the selected checkout', async () => {
  const result = goal(root, '--limit', '2')
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  const options = { publicRoot: root, output() {} }
  const checked = await runCli(['--summary', '--json'], options)
  assert.deepEqual(report.requirements, { accepted: checked.requirements.done, total: checked.requirements.total,
    remaining: checked.requirements.todo, percentage: 100 * checked.requirements.done / checked.requirements.total,
    complete: checked.requirements.todo === 0 })
  assert.deepEqual(report.capabilities, { accepted: checked.capabilities.done, total: checked.capabilities.total, partial: checked.capabilities.partial })
  for (const gate of gates) {
    const ready = await runCli(['--ready', '--json', '--gate', gate, '--limit', '2'], options)
    assert.deepEqual(report.ready[gate], { count: ready.matches, items: ready.items.map(({ id, familyId }) => ({ id, familyId })) })
    assert.equal(Object.hasOwn(ready, 'families'), false, 'The existing backlog --ready response retains its schema.')
    assert.equal(report.readyFamilies[gate].reduce((sum, family) => sum + family.count, 0), ready.matches)
  }
  assert.equal(report.manifestWave, undefined)
  assert.equal(report.applied, false); assert.equal(report.executionAuthority, false)
})

test('goal reads target inputs without executing target scripts or trusting generated views', t => {
  const { repo, temp } = fixture(t)
  mkdirSync(join(repo, 'scripts'))
  writeFileSync(join(repo, 'scripts/lan-backlog.mjs'), "throw new Error('The target copy must never execute.');\n")
  writeFileSync(join(repo, 'docs/backlog/LAN-10000-TODO.md'), 'All accepted')
  jsonFile(join(repo, 'docs/backlog/lan-10000.json'), { items: [{ status: 'done' }] })
  git(repo, 'init', '-b', 'main'); git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Goal Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic catalog')
  const first = goal(repo)
  assert.equal(first.status, 0, first.stderr)
  const report = JSON.parse(first.stdout)
  assert.equal(report.requirements.accepted, 0)
  assert.equal(report.requirements.complete, false)
  assert.ok(report.ready.local.count > 0)
  assert.equal(report.ready.local.items.length, Math.min(5, report.ready.local.count))
  const manifest = readJson(resolve(root, '.SYSTEMX/swarm/examples/manifest.example.json'))
  manifest.baseRevision = git(repo, 'rev-parse', 'HEAD')
  const manifestFile = join(temp, 'manifest.json'), stateDir = join(temp, 'private-state')
  jsonFile(manifestFile, manifest)
  const joined = goal(repo, '--manifest', manifestFile, '--state-dir', stateDir)
  assert.equal(joined.status, 0, joined.stderr)
  const combined = JSON.parse(joined.stdout)
  assert.deepEqual(combined.requirements, report.requirements)
  assert.equal(combined.manifestWave.progress.totalTasks, manifest.tasks.length)
  assert.equal(combined.manifestWave.assignments[0].taskId, manifest.tasks[0].id)
  assert.equal(existsSync(stateDir), false)
  assert.equal(git(repo, 'status', '--porcelain'), '')
})

test('invalid limits, mutation flags, corrupted definitions and unbound receipts refuse', t => {
  const { repo } = fixture(t)
  for (const value of ['0', '101', 'NaN']) assert.equal(JSON.parse(goal(repo, '--limit', value).stderr).code, 'GOAL_LIMIT_INVALID')
  for (const args of [['--apply'], ['--state-dir', 'unused']]) assert.equal(JSON.parse(goal(repo, ...args).stderr).code, 'OPTION_INVALID')
  const document = readJson(join(repo, specificationFiles[0]))
  const original = buildCatalog(specificationFiles.map(name => readJson(join(repo, name))))
  const item = original.items[0]
  const completion = { id: item.id, definitionSha256: item.definitionSha256, sourceRevision: original.sourceBase,
    verifiedOn: original.createdOn, reviewedBy: 'agent.0', evidence: 'docs/unbound.md' }
  writeFileSync(join(repo, 'docs/unbound.md'), 'Unchecked assertion only.')
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: [completion] })
  const refused = goal(repo)
  assert.equal(refused.status, 1); assert.equal(refused.stdout, '')
  assert.equal(JSON.parse(refused.stderr).code, 'GOAL_CATALOG_INVALID')
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: [] })
  document.families[0].capabilities = []
  jsonFile(join(repo, specificationFiles[0]), document)
  assert.equal(JSON.parse(goal(repo).stderr).code, 'GOAL_CATALOG_INVALID')
})

test('fixed definition paths refuse a symlink to an external spec', { skip: process.platform === 'win32' }, t => {
  const { repo, temp } = fixture(t), outside = join(temp, 'outside.json'), spec = join(repo, specificationFiles[0])
  copyFileSync(spec, outside); rmSync(spec); symlinkSync(outside, spec)
  assert.equal(JSON.parse(goal(repo).stderr).code, 'GOAL_CATALOG_INVALID')
})

test('an exact receipt outside the selected repository cannot accept a requirement', { skip: process.platform === 'win32' }, t => {
  const { repo, temp } = fixture(t)
  const original = buildCatalog(specificationFiles.map(name => readJson(join(repo, name))))
  const first = original.items[0]
  const binding = { id: first.id, definitionSha256: first.definitionSha256, sourceRevision: original.sourceBase }
  const evidence = 'docs/receipt.md', outside = join(temp, 'receipt.md')
  const completion = { ...binding, reviewedBy: 'agent.0', verifiedOn: original.createdOn, evidence }
  writeFileSync(outside, '```lan-completion-evidence\n' + JSON.stringify({ schemaVersion: 1, requirements: [binding] }) + '\n```\n')
  symlinkSync(outside, join(repo, evidence))
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: [completion] })
  assert.equal(JSON.parse(goal(repo).stderr).code, 'GOAL_CATALOG_INVALID')
})

function bindFixtureDefinitions(repo) {
  const source = buildCatalog(specificationFiles.map(name => readJson(join(repo, name))))
  const receipts = new Map(), entries = []
  for (const item of source.items) {
    const evidence = `docs/fixture-${item.familyId}.md`
    const binding = { id: item.id, definitionSha256: item.definitionSha256, sourceRevision: source.sourceBase }
    if (!receipts.has(evidence)) receipts.set(evidence, [])
    receipts.get(evidence).push(binding)
    entries.push({ ...binding, reviewedBy: 'agent.0', verifiedOn: source.createdOn, evidence })
  }
  for (const [evidence, requirements] of receipts) {
    writeFileSync(join(repo, evidence), '```lan-completion-evidence\n' + JSON.stringify({ schemaVersion: 1, requirements }) + '\n```\n')
  }
  return { source, entries }
}

test('a one-row sample still reports all eligible families and tracks progress within each gate', async t => {
  const { repo } = fixture(t)
  const { source, entries } = bindFixtureDefinitions(repo)
  const dependencies = new Set(source.items.flatMap(item => item.dependsOn))
  // Leaving only terminal requirements unfinished makes every remaining row
  // ready while preserving the closure required by the real receipt validator.
  const leaves = source.items.filter(item => !dependencies.has(item.id))
  const pending = new Set(leaves.map(item => item.id))
  const save = () => jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: entries.filter(entry => !pending.has(entry.id)) })
  save()
  const command = goal(repo, '--limit', '1')
  assert.equal(command.status, 0, command.stderr)
  const initial = JSON.parse(command.stdout)
  assert.ok(initial.ready.local.count > 100, 'Exercise families beyond the maximum raw requirement sample.')
  assert.ok(initial.readyFamilies.local.length > 1)
  for (const gate of gates) {
    const gated = leaves.filter(item => item.gate === gate)
    assert.ok(gated.length > 0, `Exercise the ${gate} gate.`)
    assert.equal(initial.ready[gate].count, gated.length)
    assert.deepEqual(initial.ready[gate].items, [{ id: gated[0].id, familyId: gated[0].familyId }])
    const familyIds = [...new Set(gated.map(item => item.familyId))]
    const expected = familyIds.map(familyId => {
      const family = gated.filter(item => item.familyId === familyId)
      return { familyId, familyName: family[0].familyName, count: family.length, firstReadyId: family[0].id }
    })
    assert.deepEqual(initial.readyFamilies[gate], expected)
  }
  const family = initial.readyFamilies.local.find(item => item.count > 1)
  pending.delete(family.firstReadyId); save()
  const advanced = await readLanGoal({ publicRoot: repo, limit: 1 })
  const next = advanced.readyFamilies.local.find(item => item.familyId === family.familyId)
  assert.equal(next.count, family.count - 1)
  assert.equal(next.firstReadyId, leaves.find(item => item.familyId === family.familyId && pending.has(item.id)).id)
  assert.deepEqual(advanced.readyFamilies.operator, initial.readyFamilies.operator)
  assert.deepEqual(advanced.readyFamilies.provider, initial.readyFamilies.provider)
})

test('only acceptance of every original definition completes the catalog goal', async t => {
  const { repo } = fixture(t)
  const { source, entries } = bindFixtureDefinitions(repo)
  const prerequisites = new Set(source.items.flatMap(item => item.dependsOn))
  const leaf = source.items.find(item => !prerequisites.has(item.id))
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: entries.filter(entry => entry.id !== leaf.id) })
  const finishedManifest = { wave: () => ({ runId: 'fixture', stateRevision: 3, progress: { complete: true }, assignments: [], blockedBy: 'COMPLETE' }) }
  const partial = await readLanGoal({ publicRoot: repo, controller: finishedManifest })
  assert.equal(partial.manifestWave.progress.complete, true)
  assert.equal(partial.requirements.remaining, 1); assert.equal(partial.requirements.complete, false)
  assert.deepEqual(partial.ready[leaf.gate].items, [{ id: leaf.id, familyId: leaf.familyId }])
  jsonFile(join(repo, progressFile), { schemaVersion: 1, completions: entries })
  const complete = await readLanGoal({ publicRoot: repo })
  assert.deepEqual(complete.requirements, { accepted: entries.length, total: entries.length, remaining: 0, percentage: 100, complete: true })
  for (const gate of gates) {
    assert.deepEqual(complete.ready[gate], { count: 0, items: [] })
    assert.deepEqual(complete.readyFamilies[gate], [])
  }
})
