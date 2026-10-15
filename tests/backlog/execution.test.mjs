import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { dependencyAnalysis, executionReport, parseExecutionArguments, renderExecutionPlan, renderGraph } from '../../scripts/backlog-execution.mjs'

const catalog = JSON.parse(await readFile(new URL('../../docs/backlog/webappx-1000-todo.json', import.meta.url), 'utf8'))
const item = (id, dependsOn = [], status = 'todo', gate = 'local') => ({ id, dependsOn, status, gate, area: 'setup', priority: 'P1', phase: 'foundation', title: `Example ${id}`, acceptance: 'A specific independently observed acceptance result.' })
const fixture = () => ({ items: [item('WX-0001', [], 'done'), item('WX-0002', ['WX-0001']), item('WX-0003', ['WX-0002']), item('WX-0004', [], 'todo', 'provider')] })

test('ready selection respects completed dependencies and keeps external readiness distinct', () => {
  const report = executionReport(fixture())
  assert.deepEqual(report.next.map(item => item.id), ['WX-0002'])
  assert.deepEqual(report.dependencyWaiting, [{ id: 'WX-0003', needs: ['WX-0002'] }])
  assert.deepEqual(report.remainingGates, { local: 2, provider: 1, operator: 0 })
  assert.deepEqual(executionReport(fixture(), { gate: 'all' }).next.map(item => item.id), ['WX-0002', 'WX-0004'])
  assert.match(report.readinessBoundary, /Review source/)
})

test('selection sorts by priority, phase and ID without mutating canonical records', () => {
  const value = fixture()
  value.items[3].priority = 'P2'
  value.items[1].phase = 'extensions'
  const baseline = structuredClone(value)
  assert.deepEqual(executionReport(value, { gate: 'all', limit: 1 }).next.map(item => item.id), ['WX-0002'])
  assert.deepEqual(value, baseline)
})

test('graph includes the selected dependency closure, edges, longest chain and original external criteria', () => {
  const value = fixture()
  value.items[1].gate = 'operator'
  const graph = dependencyAnalysis(value.items, ['WX-0003', 'WX-0004'])
  assert.deepEqual(graph.nodes.map(item => item.id), ['WX-0001', 'WX-0002', 'WX-0003', 'WX-0004'])
  assert.deepEqual(graph.longestChain, ['WX-0001', 'WX-0002', 'WX-0003'])
  assert.deepEqual(graph.edges, [{ from: 'WX-0001', to: 'WX-0002' }, { from: 'WX-0002', to: 'WX-0003' }])
  assert.deepEqual(graph.externalGates.map(item => [item.id, item.gate]), [['WX-0002', 'operator'], ['WX-0004', 'provider']])
  assert.match(renderGraph(graph), /WX_0001 --> WX_0002/)
  assert.match(renderGraph(graph), /Longest selected chain \(3 items\)/)
})

test('graph rejects unknown dependencies, duplicate IDs and prints the exact cycle path', () => {
  assert.throws(() => dependencyAnalysis(fixture().items, ['WX-1001']), /Unknown proposal/)
  assert.throws(() => dependencyAnalysis([item('WX-0001', ['WX-0002'])]), /Unknown proposal/)
  assert.throws(() => dependencyAnalysis([item('WX-0001'), item('WX-0001')]), /Duplicate/)
  assert.throws(() => dependencyAnalysis([item('WX-0001', ['WX-0002']), item('WX-0002', ['WX-0003']), item('WX-0003', ['WX-0001'])]), /WX-0001 -> WX-0002 -> WX-0003 -> WX-0001/)
})

test('graph preserves equal longest predecessor paths and bounds display without losing exact counts', () => {
  const graph = dependencyAnalysis([item('WX-0001'), item('WX-0002'), item('WX-0003', ['WX-0001', 'WX-0002'])], ['WX-0003'])
  assert.deepEqual(graph.longestChains, [['WX-0001', 'WX-0003'], ['WX-0002', 'WX-0003']])
  assert.equal(graph.longestChainCount, '2')
  const nodes = [item('WX-0001'), item('WX-0002')]
  for (let layer = 1; layer <= 60; layer += 1) {
    const prior = nodes.slice(-2).map(item => item.id)
    nodes.push(item(`WX-${String(layer * 2 + 1).padStart(4, '0')}`, prior), item(`WX-${String(layer * 2 + 2).padStart(4, '0')}`, prior))
  }
  const many = dependencyAnalysis(nodes, [nodes.at(-1).id])
  assert.equal(many.longestChain.length, 61)
  assert.equal(many.longestChainCount, (2n ** 60n).toString())
  assert.equal(many.longestChains.length, 10)
})

test('CLI rejects ambiguous modes, unbounded selections and malformed filters', () => {
  for (const args of [['--write', '--ready'], ['--id', 'WX-0001'], ['--graph', '--id', 'WX-1'], ['--graph', '--id', 'WX-0001', '--id', 'WX-0001'], ['--write', '--gate', 'all'], ['--limit'], ['--unknown'], ['--limit', '1.5'], ['--limit', '2', '--limit', '3']]) assert.throws(() => parseExecutionArguments(args))
  assert.throws(() => parseExecutionArguments(['--graph', ...Array.from({ length: 41 }, (_, i) => ['--id', `WX-${String(i + 1).padStart(4, '0')}`]).flat()]), /at most 40/)
  for (const options of [{ limit: 0 }, { limit: 51 }, { gate: 'connected' }, { priority: 'urgent' }]) assert.throws(() => executionReport(fixture(), options))
})

test('full plan partitions every live catalog ID into exactly twenty complete area ranges', () => {
  const rendered = renderExecutionPlan(catalog)
  const ranges = [...rendered.matchAll(/\| (WX-\d{4})–(WX-\d{4}) \|/g)]
  const covered = ranges.flatMap(([, start, end]) => Array.from({ length: Number(end.slice(3)) - Number(start.slice(3)) + 1 }, (_, index) => `WX-${String(Number(start.slice(3)) + index).padStart(4, '0')}`))
  assert.equal(ranges.length, 20)
  assert.deepEqual(covered, catalog.items.map(item => item.id))
  const done = catalog.items.filter(item => item.status === 'done').length
  assert.match(rendered, new RegExp(`${done} done / ${1000 - done} remaining`))
})

test('read-only CLI graph/report preserve catalog, plan and blank adoption seeds byte for byte', async () => {
  const files = ['docs/backlog/webappx-1000-todo.json', 'docs/WEBAPPX-EXECUTION-PLAN.md', '.SYSTEMX/WORK/TASKS.json', '.SYSTEMX/PLAN/MASTER-PLAN.md']
  const snapshot = await Promise.all(files.map(file => readFile(new URL(`../../${file}`, import.meta.url))))
  for (const args of [['--ready', '--limit', '2'], ['--graph', '--id', 'WX-0654', '--id', 'WX-0551']]) {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/backlog-execution.mjs', import.meta.url)), ...args], { encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    assert.doesNotMatch(child.stdout, /\/Users\/|\/Volumes\//)
  }
  const after = await Promise.all(files.map(file => readFile(new URL(`../../${file}`, import.meta.url))))
  assert.deepEqual(after, snapshot)
})
