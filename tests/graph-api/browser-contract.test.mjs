import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bindCatalogRequirements, capabilityKeys, graphFixture, legacyGraphFixture, outputDirectory, requirementsFromSpec, stopOwned } from '../../scripts/lan-graph-contract-browser.mjs'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const foundation = JSON.parse(readFileSync(join(root, '.SYSTEMX/LAN/Backlog/specs/01-foundation.json'), 'utf8'))

test('all 40 original F005/F006 capability names have contiguous five-lane requirement IDs', () => {
  const records = requirementsFromSpec(foundation)
  assert.equal(records.length, 40)
  assert.deepEqual(records.map((record) => record.key), [...capabilityKeys.F005, ...capabilityKeys.F006])
  assert.deepEqual(records[0].requirementIds, ['LAN-00401', 'LAN-00402', 'LAN-00403', 'LAN-00404', 'LAN-00405'])
  assert.deepEqual(records.at(-1).requirementIds, ['LAN-00596', 'LAN-00597', 'LAN-00598', 'LAN-00599', 'LAN-00600'])
  assert.ok(records.every((record) => record.lanes.join(',') === 'behavior,boundaries,recovery,feedback,evidence'))
  const altered = structuredClone(foundation)
  altered.families.find((family) => family.id === 'F005').capabilities[0].key = 'renamed-capability'
  assert.throws(() => requirementsFromSpec(altered), /exact capability list drifted/)
})

test('synthetic graph fixture has qualified references, ordered siblings and no mutation on legacy copy', () => {
  const workspaceId = 'a'.repeat(64), sourceRevision = 'b'.repeat(64)
  const graph = graphFixture(workspaceId, sourceRevision)
  assert.equal(graph.workspaceId, workspaceId)
  assert.equal(graph.sourceRevision, sourceRevision)
  assert.deepEqual(graph.nodes.find((node) => node.id === 'root').childIds, ['alpha', 'opaque', 'instance'])
  assert.ok(graph.nodes.find((node) => node.id === 'opaque').source.path.startsWith('src/'))
  assert.ok(graph.references.every((reference) => reference.documentId === graph.documentId))
  const original = JSON.stringify(graph)
  const legacy = legacyGraphFixture(graph)
  assert.equal(legacy.schemaVersion, 0)
  assert.deepEqual(legacy.page, graph.pages[0])
  assert.ok(legacy.nodes.every((node) => !('childIds' in node)))
  assert.equal(JSON.stringify(graph), original, 'Migration input must remain an isolated copy')
  assert.notDeepEqual(graphFixture(workspaceId, sourceRevision, { order: ['opaque', 'alpha', 'instance'] }).nodes[0].childIds, graph.nodes[0].childIds)
  assert.throws(() => graphFixture('not-a-workspace', sourceRevision), /64/)
})

test('evidence output option is explicit and rejects ambiguous arguments', () => {
  assert.equal(outputDirectory([], '/tmp/default-evidence'), '/tmp/default-evidence')
  assert.equal(outputDirectory(['--output-dir', '/tmp/graph-evidence'], '/tmp/default-evidence'), '/tmp/graph-evidence')
  assert.throws(() => outputDirectory(['--output-dir'], '/tmp/default-evidence'))
  assert.throws(() => outputDirectory(['--output-dir', '/tmp/a', '--output-dir', '/tmp/b'], '/tmp/default-evidence'))
  assert.throws(() => outputDirectory(['--unknown', '/tmp/a'], '/tmp/default-evidence'))
})

test('browser evidence binds every original requirement ID, lane and definition digest', () => {
  const catalog = JSON.parse(readFileSync(join(root, 'docs/backlog/lan-10000.json'), 'utf8'))
  const records = bindCatalogRequirements(requirementsFromSpec(foundation), catalog)
  assert.equal(records.flatMap((item) => item.definitions).length, 200)
  assert.equal(new Set(records.flatMap((item) => item.definitions.map((definition) => definition.id))).size, 200)
  const changed = structuredClone(catalog)
  changed.items.find((item) => item.id === 'LAN-00401').capabilityKey = 'another-capability'
  assert.throws(() => bindCatalogRequirements(requirementsFromSpec(foundation), changed), /binding changed/)
  const absent = structuredClone(catalog)
  absent.items = absent.items.filter((item) => item.id !== 'LAN-00600')
  assert.throws(() => bindCatalogRequirements(requirementsFromSpec(foundation), absent), /binding changed/)
})

test('owned process cleanup treats signal termination as terminal and is safe to repeat', { timeout: 8000 }, async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject) })
  try {
    await stopOwned(child)
    assert.equal(child.signalCode, 'SIGTERM')
    assert.equal(child.exitCode, null, 'Signal exits must not be confused with a still-running child')
    await stopOwned(child)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
})
