import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, rmSync, symlinkSync, linkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { readOperatingStatus } from '../work-status.mjs'

const version = '1.0.0-test'
const tasks = { schemaVersion: 1, tasks: [] }
const focus = { schemaVersion: 1, objective: '', taskIds: [], checkpoint: '', updatedAt: '' }
const roles = { schemaVersion: 1, agents: [{ id: 'agent.0', role: 'coordinator', memory: 'AGENTS/agent.0/MEMORY.md' }] }
const stamp = '2026-10-15T12:00:00.000001Z'

function write(root, path, data) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`)
}
function recordSet(root, prefix) {
  write(root, `${prefix}/WORK/TASKS.json`, tasks)
  write(root, `${prefix}/WORK/FOCUS.json`, focus)
  write(root, `${prefix}/AGENTS/REGISTRY.json`, roles)
  write(root, `${prefix}/AGENTS/agent.0/MEMORY.md`, 'Private memory must not appear in status.')
}
function catalog() {
  return {
    schemaVersion: 1, project: 'WebAppX', intent: 'proposed-backlog', createdOn: '2026-10-15', sourceCommit: 'a'.repeat(40),
    items: Array.from({ length: 1000 }, (_, index) => ({
      id: `WX-${String(index + 1).padStart(4, '0')}`, area: 'systemx', priority: 'P1', phase: 'foundation', status: 'todo',
      title: `Independent fixture proposal ${index + 1}`, acceptance: `Independent observable acceptance criterion for fixture ${index + 1}.`,
      source: 'docs/fixture.md', gate: 'local', dependsOn: [],
    })),
  }
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-work-status-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.SYSTEMX/INSTALLATION.json', { schemaVersion: 2, activeVersion: version, pinnedVersion: version, autoUpdate: 'manual' })
  recordSet(root, '.SYSTEMX')
  recordSet(root, `.SYSTEMX/.systemx/releases/${version}`)
  write(root, '.SYSTEMX/Projects/REGISTRY.json', { schemaVersion: 1, projects: [] })
  write(root, 'docs/backlog/webappx-1000-todo.json', catalog())
  return root
}
function task(id = 'TASK-001') {
  return {
    id, title: 'An explicitly adopted fixture task', owner: 'agent.0', status: 'todo', milestone: '', scope: ['src/'],
    acceptance: ['A reproducible fixture verifies the selected scope.'], dependsOn: [], nextAction: 'Review fixture', blocker: '', evidence: [], reviewedBy: '',
    createdAt: stamp, updatedAt: stamp,
    history: [{ at: stamp, status: 'todo', owner: 'agent.0', note: '', evidence: [], reviewedBy: '' }],
  }
}
function child(root, name = 'Example App') {
  const path = `Projects/${name}`
  write(root, '.SYSTEMX/Projects/REGISTRY.json', { schemaVersion: 1, projects: [{ name, path, records: `${path}/.SYSTEMXP`, kind: 'software' }] })
  const prefix = `.SYSTEMX/${path}/.SYSTEMXP`
  recordSet(root, prefix)
  write(root, `${prefix}/project.json`, { schemaVersion: 1, project: { name, description: 'Temporary fixture' }, checks: [], commands: { dev: [], build: [], deploy: [] } })
  return prefix
}
function snapshot(root) {
  const result = {}
  const visit = (path = '') => {
    for (const entry of readdirSync(join(root, path))) {
      const name = path ? `${path}/${entry}` : entry
      const info = lstatSync(join(root, name))
      if (info.isDirectory()) visit(name)
      else result[name] = createHash('sha256').update(readFileSync(join(root, name))).digest('hex')
    }
  }
  visit()
  return result
}

test('blank reusable seeds, proposals and unselected work remain independent and read-only', (t) => {
  const root = fixture(t)
  const before = snapshot(root)
  const status = readOperatingStatus(root)
  assert.equal(status.workStatus.schemaVersion, 1)
  assert.equal(status.authority, 'records-only')
  assert.equal(status.workStatus.reusableSeed.stockMatch, 'exact')
  assert.equal(status.taskCount, 0)
  assert.deepEqual(status.workStatus.roadmap.itemsByStatus, { todo: 1000, done: 0 })
  assert.equal(status.workStatus.adoptedProject.state, 'not-selected')
  assert.deepEqual(status.workStatus.scopeOptions.children, [])
  assert.doesNotMatch(JSON.stringify(status), /Private memory|webappx-work-status-/)
  assert.deepEqual(snapshot(root), before)
})

test('explicit root selection reports blank records without inferring adoption identity', (t) => {
  const root = fixture(t)
  write(root, '.SYSTEMX/GLOBAL/CONTEXT.md', 'An independently adopted project context.')
  const { workStatus } = readOperatingStatus(root, { kind: 'root' })
  assert.equal(workStatus.reusableSeed.stockMatch, 'exact')
  assert.equal(workStatus.adoptedProject.state, 'available')
  assert.deepEqual(workStatus.adoptedProject.selection, { kind: 'root' })
  assert.equal(workStatus.adoptedProject.taskCount, 0)
  assert.equal(Object.hasOwn(workStatus.adoptedProject, 'projectComplete'), false)
})

test('adopted task/focus facts differ from exact stock and roadmap source completions', (t) => {
  const root = fixture(t)
  write(root, '.SYSTEMX/WORK/TASKS.json', { schemaVersion: 1, tasks: [task()] })
  write(root, '.SYSTEMX/WORK/FOCUS.json', { ...focus, objective: 'Review adopted work', taskIds: ['TASK-001'], updatedAt: stamp })
  const roadmap = catalog()
  roadmap.items[0] = { ...roadmap.items[0], status: 'done', completion: { verifiedOn: '2026-10-15', sourceBase: 'b'.repeat(40), evidence: 'docs/source-qa.md', reviewedBy: 'agent.0' } }
  write(root, 'docs/backlog/webappx-1000-todo.json', roadmap)
  const { workStatus } = readOperatingStatus(root, { kind: 'root' })
  assert.equal(workStatus.reusableSeed.stockMatch, 'modified')
  assert.equal(workStatus.adoptedProject.taskCount, 1)
  assert.equal(workStatus.adoptedProject.tasksByStatus.todo, 1)
  assert.equal(workStatus.adoptedProject.focus.objective, 'Review adopted work')
  assert.deepEqual(workStatus.roadmap.itemsByStatus, { todo: 999, done: 1 })
})

test('unreadable and malformed ledgers never masquerade as zero tasks', async (t) => {
  for (const [name, content] of [
    ['syntax', '{'], ['duplicate', '{"schemaVersion":1,"tasks":[],"tasks":[]}'],
    ['escaped duplicate', '{"schemaVersion":1,"tasks":[],"ta\\u0073ks":[]}'],
    ['unknown key', { ...tasks, extra: true }], ['boolean version', { schemaVersion: true, tasks: [] }],
    ['not an array', { schemaVersion: 1, tasks: {} }], ['bad task', { schemaVersion: 1, tasks: [{ status: 'todo' }] }],
  ]) await t.test(name, () => {
    const root = fixture(t)
    write(root, '.SYSTEMX/WORK/TASKS.json', content)
    const status = readOperatingStatus(root, { kind: 'root' })
    assert.equal(status.taskCount, null)
    assert.equal(status.tasksByStatus, null)
    assert.equal(status.workStatus.reusableSeed.state, 'unavailable')
    assert.equal(status.workStatus.adoptedProject.state, 'unavailable')
  })
})

test('missing records, missing stock and oversized records expose separate unavailable facts', (t) => {
  const root = fixture(t)
  rmSync(join(root, '.SYSTEMX/WORK/TASKS.json'))
  let status = readOperatingStatus(root)
  assert.equal(status.taskCount, null)
  assert.equal(status.recordDiagnostics[0].diagnostic, 'missing-record')
  recordSet(root, '.SYSTEMX')
  rmSync(join(root, `.SYSTEMX/.systemx/releases/${version}/WORK/TASKS.json`))
  status = readOperatingStatus(root)
  assert.equal(status.taskCount, 0)
  assert.equal(status.workStatus.reusableSeed.stockMatch, 'unavailable')
  write(root, '.SYSTEMX/WORK/TASKS.json', ' '.repeat(2 * 1024 * 1024 + 1))
  assert.equal(readOperatingStatus(root).recordDiagnostics[0].diagnostic, 'record-too-large')
})

test('task owners, statuses, evidence, dependency graph and history must be consistent', async (t) => {
  const mutations = {
    owner: (row) => { row.owner = 'agent.9' }, status: (row) => { row.status = 'running' },
    acceptance: (row) => { row.acceptance = [] }, identifier: (row) => { row.id = 'WX-0856' },
    done: (row) => { row.status = 'done' }, history: (row) => { row.history[0].owner = 'agent.9' },
    dependency: (row) => { row.dependsOn = ['TASK-999'] }, cycle: (row) => { row.dependsOn = [row.id] },
    timestamp: (row) => { row.createdAt = '2026-02-30T12:00:00Z' },
    midnight: (row) => { row.createdAt = '2026-10-15T24:00:00Z' },
    offset: (row) => { row.createdAt = '2026-10-15T12:00:00+24:00' },
    microseconds: (row) => { row.history[0].at = '2026-10-15T12:00:00.000002Z' },
  }
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, () => {
    const root = fixture(t); const row = task(); mutate(row)
    write(root, '.SYSTEMX/WORK/TASKS.json', { schemaVersion: 1, tasks: [row] })
    assert.equal(readOperatingStatus(root).taskCount, null)
  })
})

test('invalid focus does not hide independently readable task counts', (t) => {
  const root = fixture(t)
  write(root, '.SYSTEMX/WORK/FOCUS.json', { ...focus, objective: ' ', taskIds: ['TASK-999'] })
  const status = readOperatingStatus(root, { kind: 'root' })
  assert.equal(status.taskCount, 0)
  assert.equal(status.workStatus.reusableSeed.state, 'unavailable')
  assert.equal(status.workStatus.adoptedProject.focus, null)
})

test('valid recorded completion retains its own reviewed history and count', (t) => {
  const root = fixture(t); const row = task()
  row.status = 'done'; row.nextAction = ''; row.evidence = ['docs/recorded-qa.md']; row.reviewedBy = 'agent.0'
  for (const status of ['in_progress', 'needs_review', 'done']) {
    row.history.push({ at: stamp, status, owner: 'agent.0', note: '', evidence: status === 'done' ? row.evidence : [], reviewedBy: status === 'done' ? row.reviewedBy : '' })
  }
  write(root, '.SYSTEMX/WORK/TASKS.json', { schemaVersion: 1, tasks: [row] })
  const status = readOperatingStatus(root, { kind: 'root' })
  assert.equal(status.workStatus.adoptedProject.state, 'available')
  assert.equal(status.workStatus.adoptedProject.tasksByStatus.done, 1)
  assert.equal(status.workStatus.roadmap.itemsByStatus.done, 0)
})

test('history chronology preserves microsecond precision within one millisecond', (t) => {
  const root = fixture(t); const row = task()
  row.createdAt = '2026-10-15T12:00:00.000002Z'
  row.history[0].at = row.createdAt
  row.history.push({ ...row.history[0], at: '2026-10-15T12:00:00.000001Z' })
  row.updatedAt = row.history[1].at
  write(root, '.SYSTEMX/WORK/TASKS.json', { schemaVersion: 1, tasks: [row] })
  assert.equal(readOperatingStatus(root).taskCount, null)
})

test('byte comparison distinguishes CRLF from exact stock without rejecting readable records', (t) => {
  const root = fixture(t)
  const record = readFileSync(join(root, '.SYSTEMX/WORK/TASKS.json'), 'utf8')
  write(root, '.SYSTEMX/WORK/TASKS.json', record.replaceAll('\n', '\r\n'))
  const { reusableSeed } = readOperatingStatus(root).workStatus
  assert.equal(reusableSeed.state, 'available')
  assert.equal(reusableSeed.stockMatch, 'modified')
  assert.equal(reusableSeed.sources[0].exactStockMatch, false)
})

test('milestone tables and checkpoint metadata are checked only when referenced', (t) => {
  const root = fixture(t); const row = task()
  row.milestone = 'M-001'
  write(root, '.SYSTEMX/WORK/TASKS.json', { schemaVersion: 1, tasks: [row] })
  assert.equal(readOperatingStatus(root).taskCount, null)
  write(root, '.SYSTEMX/PLAN/MASTER-PLAN.md', '| M-001 | Temporary milestone |')
  let status = readOperatingStatus(root)
  assert.equal(status.taskCount, 1)
  assert.equal(status.workStatus.reusableSeed.supportingSources[0].state, 'available')
  write(root, '.SYSTEMX/WORK/FOCUS.json', { ...focus, objective: 'Review', checkpoint: 'MEMORY/sessions/subdir/README.md', updatedAt: stamp })
  write(root, '.SYSTEMX/MEMORY/sessions/subdir/README.md', 'Must not be selected as checkpoint.')
  assert.equal(readOperatingStatus(root).workStatus.reusableSeed.focus, null)
  write(root, '.SYSTEMX/WORK/FOCUS.json', { ...focus, objective: 'Review', checkpoint: 'MEMORY/sessions/checkpoint.md', updatedAt: stamp })
  write(root, '.SYSTEMX/MEMORY/sessions/checkpoint.md', 'Private checkpoint text must not appear.')
  status = readOperatingStatus(root)
  assert.equal(status.workStatus.reusableSeed.focus.checkpointRecorded, true)
  assert.doesNotMatch(JSON.stringify(status), /Private checkpoint/)
})

test('registered child records require exact explicit selection and valid matching identity', (t) => {
  const root = fixture(t); const prefix = child(root)
  write(root, `${prefix}/WORK/TASKS.json`, { schemaVersion: 1, tasks: [task()] })
  const before = snapshot(root)
  assert.equal(readOperatingStatus(root).workStatus.adoptedProject.state, 'not-selected')
  const selected = readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject
  assert.equal(selected.state, 'available')
  assert.equal(selected.taskCount, 1)
  assert.equal(selected.recordRoot, prefix)
  for (const name of ['example app', 'Example App ', '../Example App', '/tmp/Example App', 'Unknown']) {
    assert.equal(readOperatingStatus(root, { kind: 'child', name }).workStatus.adoptedProject.state, 'unavailable')
  }
  assert.deepEqual(snapshot(root), before)
  write(root, `${prefix}/project.json`, { schemaVersion: 1, project: { name: 'Wrong' } })
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.state, 'unavailable')
})

test('corrupt unselected children cannot contaminate root or selected child records', (t) => {
  const root = fixture(t); const prefix = child(root)
  const registryFile = join(root, '.SYSTEMX/Projects/REGISTRY.json')
  const registry = JSON.parse(readFileSync(registryFile, 'utf8'))
  registry.projects.push({ name: 'Broken', path: 'Projects/Broken', records: 'Projects/Broken/.SYSTEMXP', kind: 'general' })
  write(root, '.SYSTEMX/Projects/REGISTRY.json', registry)
  write(root, '.SYSTEMX/Projects/Broken/.SYSTEMXP/WORK/TASKS.json', '{')
  assert.equal(readOperatingStatus(root).workStatus.adoptedProject.state, 'not-selected')
  assert.equal(readOperatingStatus(root, { kind: 'root' }).workStatus.adoptedProject.state, 'available')
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.recordRoot, prefix)
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Broken' }).workStatus.adoptedProject.state, 'unavailable')
})

test('invalid registries expose unavailable child counts and options', (t) => {
  const root = fixture(t)
  write(root, '.SYSTEMX/Projects/REGISTRY.json', { schemaVersion: 1, projects: [{ name: 'Escape', path: '/tmp', records: '/tmp/.SYSTEMXP', kind: 'general' }] })
  const status = readOperatingStatus(root, { kind: 'child', name: 'Escape' })
  assert.equal(status.childProjectCount, null)
  assert.equal(status.workStatus.scopeOptions.state, 'unavailable')
  assert.equal(status.workStatus.scopeOptions.children, null)
  assert.equal(status.workStatus.adoptedProject.diagnostic, 'project-registry-unavailable')
  assert.equal(readOperatingStatus(root, { kind: 'root' }).workStatus.adoptedProject.state, 'available')
})

test('case conflicts, reserved names and excessive project options are unavailable', (t) => {
  const root = fixture(t)
  const entry = (name) => ({ name, path: `Projects/${name}`, records: `Projects/${name}/.SYSTEMXP`, kind: 'general' })
  for (const projects of [[entry('Same'), entry('same')], [entry('CON')], [entry('root')], Array.from({ length: 201 }, (_, index) => entry(`App${index}`))]) {
    write(root, '.SYSTEMX/Projects/REGISTRY.json', { schemaVersion: 1, projects })
    assert.equal(readOperatingStatus(root).workStatus.scopeOptions.state, 'unavailable')
  }
})

test('a linked child directory is not loaded and root remains independently readable', (t) => {
  const root = fixture(t)
  child(root)
  rmSync(join(root, '.SYSTEMX/Projects/Example App/.SYSTEMXP'), { recursive: true })
  symlinkSync(join(root, '.SYSTEMX'), join(root, '.SYSTEMX/Projects/Example App/.SYSTEMXP'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.state, 'unavailable')
  assert.equal(readOperatingStatus(root, { kind: 'root' }).workStatus.adoptedProject.state, 'available')
})

test('linked records, parents, memory, hardlinks and nested child installations are rejected', (t) => {
  const root = fixture(t); const prefix = child(root)
  rmSync(join(root, `${prefix}/WORK/TASKS.json`))
  symlinkSync(join(root, '.SYSTEMX/WORK/TASKS.json'), join(root, `${prefix}/WORK/TASKS.json`))
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.state, 'unavailable')
  rmSync(join(root, `${prefix}/WORK/TASKS.json`)); recordSet(root, prefix)
  const memory = join(root, `${prefix}/AGENTS/agent.0/MEMORY.md`)
  rmSync(memory); linkSync(join(root, '.SYSTEMX/AGENTS/agent.0/MEMORY.md'), memory)
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.state, 'unavailable')
  rmSync(memory); recordSet(root, prefix)
  mkdirSync(join(root, `${prefix}/.SYSTEMX`))
  assert.equal(readOperatingStatus(root, { kind: 'child', name: 'Example App' }).workStatus.adoptedProject.state, 'unavailable')
})

test('malformed or missing roadmap data reports unavailable without changing ledger facts', (t) => {
  const root = fixture(t)
  write(root, 'docs/backlog/webappx-1000-todo.json', { ...catalog(), items: [{ id: 'WX-0001' }] })
  const status = readOperatingStatus(root)
  assert.equal(status.workStatus.roadmap.state, 'unavailable')
  assert.equal(status.workStatus.roadmap.itemCount, null)
  assert.equal(status.taskCount, 0)
  rmSync(join(root, 'docs/backlog/webappx-1000-todo.json'))
  assert.equal(readOperatingStatus(root).workStatus.roadmap.diagnostic, 'missing-record')
})
