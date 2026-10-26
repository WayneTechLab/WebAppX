import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { buildCatalog, validateDependencyGraph, validateProgress, applyProgress, readyItems, summary, renderArtifacts, canonicalJson, sha256, parseArgs, runCli, specificationFiles, artifactFiles, progressFile, sourceBase } from '../../scripts/lan-backlog.mjs'

const family = (number, { gate = 'local', dependsOnFamilies = [], capabilities = 2 } = {}) => ({
  id: `F${String(number).padStart(3, '0')}`, name: `Synthetic hierarchy family ${number}`, area: 'structure', phase: 'foundation', priority: 'P1', gate, dependsOnFamilies,
  scope: `Inspect synthetic route ${number} and explicitly selected DOM objects within the test workspace.`,
  refusal: `Reject a stale selection in synthetic route ${number} without changing its source or another route.`,
  recovery: `Restore the accepted synthetic route ${number} selection after a rejected operation and report remaining limitations.`,
  feedback: `Show the synthetic route ${number} target, operation result and a specific next action in the local inspector.`,
  evidence: `Retain bounded synthetic route ${number} observations and source diffs for Agent 0 review with the exact tested revision.`,
  capabilities: Array.from({ length: capabilities }, (_, index) => ({ key: `action-${index + 1}`, title: `Synthetic route ${number} action ${index + 1}`, outcome: `The operator can inspect synthetic route ${number} action ${index + 1} and observe its exact selected object without unrelated changes.` })),
})
const options = { expectedFamilyCount: 2, capabilitiesPerFamily: 2, expectedDocuments: 1, familiesPerDocument: 2 }
const documents = () => [{ schemaVersion: 1, families: [family(1), family(2)] }]
const catalog = value => buildCatalog(value ?? documents(), options)
const emptyProgress = () => ({ schemaVersion: 1, completions: [] })
const completion = item => ({ id: item.id, definitionSha256: item.definitionSha256, verifiedOn: '2026-10-26', sourceRevision: 'a'.repeat(40), evidence: 'docs/receipt.md', reviewedBy: 'agent.0' })
const receipt = completions => '# Synthetic verification receipt\n\nObservable evidence and its limitations belong here.\n\n```lan-completion-evidence\n' + JSON.stringify({ schemaVersion: 1, requirements: completions.map(({ id, definitionSha256, sourceRevision }) => ({ id, definitionSha256, sourceRevision })) }, null, 2) + '\n```\n'
async function temporaryRoot(action) {
  const root = await mkdtemp(join(tmpdir(), 'lan-catalog-'))
  try { await mkdir(join(root, 'docs/backlog'), { recursive: true }); await action(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test('authored capabilities expand to exactly five ordered acceptance lanes with honest initial status', () => {
  const source = documents()
  const before = structuredClone(source)
  const value = catalog(source)
  assert.equal(value.familyCount, 2)
  assert.equal(value.capabilityCount, 4)
  assert.equal(value.items.length, 20)
  assert.deepEqual(value.items.slice(0, 5).map(item => [item.id, item.lane]), [['LAN-00001', 'behavior'], ['LAN-00002', 'boundaries'], ['LAN-00003', 'recovery'], ['LAN-00004', 'feedback'], ['LAN-00005', 'evidence']])
  assert.ok(value.items.every(item => item.status === 'todo' && /^[a-f0-9]{64}$/.test(item.definitionSha256)))
  assert.match(value.items[1].acceptance, /action 1.*Context:.*Refusal:/)
  assert.match(value.items[2].acceptance, /Recovery:/)
  assert.match(value.items[3].acceptance, /Feedback:/)
  assert.match(value.items[4].acceptance, /Evidence:/)
  assert.deepEqual(source, before)
  assert.throws(() => buildCatalog(source), /exactly 5 authored/)
})

test('duplicate family IDs, capability keys and malformed definitions fail before generation', () => {
  const duplicateFamily = documents(); duplicateFamily[0].families[1].id = 'F001'
  assert.throws(() => catalog(duplicateFamily), /Duplicate family ID/)
  const duplicateKey = documents(); duplicateKey[0].families[0].capabilities[1].key = 'action-1'
  assert.throws(() => catalog(duplicateKey), /Duplicate capability key/)
  const missingFamily = documents(); missingFamily[0].families.pop()
  assert.throws(() => catalog(missingFamily), /exactly 2 families/)
  const nonSequence = documents(); nonSequence[0].families[1].id = 'F004'
  assert.throws(() => catalog(nonSequence), /complete ordered/)
  for (const [field, value] of [['area', 'Local Area'], ['phase', '../phase'], ['gate', 'production'], ['scope', 'TBD'], ['capabilities', []]]) {
    const source = documents(); source[0].families[0][field] = value
    assert.throws(() => catalog(source))
  }
})

test('capability and family prerequisites expand to all required delivery lanes', () => {
  const source = documents()
  source[0].families[0].capabilities[1].dependsOnCapabilities = ['action-1']
  source[0].families[1].dependsOnFamilies = ['F001']
  source[0].families[1].capabilities[0].dependsOnCapabilities = ['F001/action-2']
  const value = catalog(source)
  assert.deepEqual(value.items[5].dependsOn, ['LAN-00005'])
  assert.deepEqual(value.items[10].dependsOn, ['LAN-00005', 'LAN-00010'])
  assert.deepEqual(value.items[1].dependsOn, ['LAN-00001'])
  assert.deepEqual(value.items[4].dependsOn, ['LAN-00001', 'LAN-00002', 'LAN-00003', 'LAN-00004'])
  assert.equal(new Set(value.items[10].dependsOn).size, 2)
})

test('unknown, duplicate and cyclic dependencies fail closed', () => {
  for (const dependency of ['missing-action', 'F099/action-1']) {
    const source = documents(); source[0].families[0].capabilities[0].dependsOnCapabilities = [dependency]
    assert.throws(() => catalog(source), /unknown capability dependency/)
  }
  const unknownFamily = documents(); unknownFamily[0].families[0].dependsOnFamilies = ['F099']
  assert.throws(() => catalog(unknownFamily), /unknown family dependency/)
  const duplicate = documents(); duplicate[0].families[0].capabilities[1].dependsOnCapabilities = ['action-1', 'F001/action-1']
  assert.throws(() => catalog(duplicate), /duplicate capability dependencies/)
  const cycle = documents(); cycle[0].families[0].capabilities[0].dependsOnCapabilities = ['action-2']; cycle[0].families[0].capabilities[1].dependsOnCapabilities = ['action-1']
  assert.throws(() => catalog(cycle), /Dependency cycle/)
  const familyCycle = documents(); familyCycle[0].families[0].dependsOnFamilies = ['F002']; familyCycle[0].families[1].dependsOnFamilies = ['F001']
  assert.throws(() => catalog(familyCycle), /Dependency cycle/)
  assert.throws(() => validateDependencyGraph([{ id: 'one', dependsOn: ['unknown'] }]), /unknown dependency/)
  assert.throws(() => validateDependencyGraph([{ id: 'one', dependsOn: [] }, { id: 'one', dependsOn: [] }]), /Duplicate requirement/)
})

test('semantic definitions and digests are deterministic without a generated self-hash', () => {
  const source = documents()
  const first = catalog(source)
  const reorderedKeys = JSON.parse(canonicalJson(source))
  assert.deepEqual(catalog(reorderedKeys), first)
  assert.deepEqual(renderArtifacts(catalog(source)), renderArtifacts(first))
  assert.equal(sha256({ z: 1, a: 2 }), sha256({ a: 2, z: 1 }))
  source[0].families[0].refusal += ' Reject invalid synthetic scopes too.'
  const changed = catalog(source)
  assert.notEqual(changed.items[0].definitionSha256, first.items[0].definitionSha256)
  assert.notEqual(changed.sourceSha256, first.sourceSha256)
  assert.equal(changed.items[10].definitionSha256, first.items[10].definitionSha256)
  assert.match(renderArtifacts(first).markdown, /delivery requirements.*\n.*count does not mean 10,000 shipped/)
})

test('CSV neutralizes formula-leading authored cells without changing canonical definitions', () => {
  const source = documents()
  source[0].families[0].name = '=SUM(1,1)'
  source[0].families[0].capabilities[0].title = '+SUM(2,2)'
  source[0].families[0].capabilities[0].outcome = '@SUM(3,3) is synthetic formula-leading acceptance text for export testing.'
  source[0].families[0].capabilities[1].title = '-SUM(4,4)'
  const value = catalog(source)
  const artifacts = renderArtifacts(value)
  assert.ok(artifacts.csv.includes('"\'=SUM(1,1)"'))
  assert.ok(artifacts.csv.includes('"\'+SUM(2,2)"'))
  assert.ok(artifacts.csv.includes('"\'-SUM(4,4)"'))
  assert.ok(artifacts.csv.includes('"\'@SUM(3,3) is synthetic'))
  assert.equal(JSON.parse(artifacts.json).items[0].familyName, '=SUM(1,1)')
  assert.equal(value.items[0].capabilityTitle, '+SUM(2,2)')
  assert.ok(value.items[0].acceptance.startsWith('@SUM(3,3)'))
})

test('large checklists split deterministically without losing requirement acceptance text', () => {
  const value = catalog()
  const artifacts = renderArtifacts(value, { maximumCombinedMarkdownBytes: 1 })
  assert.equal(Object.keys(artifacts.familyViews).length, 2)
  assert.match(artifacts.markdown, /lan-10000\/F001\.md/)
  assert.match(artifacts.plan, /terminal evidence.*transitive closure/)
  const combinedViews = Object.values(artifacts.familyViews).join('\n')
  assert.ok(Object.values(artifacts.familyViews).every(contents => contents.endsWith('\n') && !contents.endsWith('\n\n')))
  for (const item of value.items) assert.ok(combinedViews.includes(item.id) && combinedViews.includes(item.acceptance))
  assert.equal((combinedViews.match(/- \[ \] \*\*LAN-/g) ?? []).length, value.items.length)
  assert.deepEqual(renderArtifacts(value, { maximumCombinedMarkdownBytes: 1 }), artifacts)
})

test('empty progress accepts no requirements; all five lanes are necessary for capability completion', async () => {
  await temporaryRoot(async root => {
    const value = catalog()
    await validateProgress(value, emptyProgress(), { publicRoot: root })
    const one = [completion(value.items[0])]
    await writeFile(join(root, 'docs/receipt.md'), receipt(one))
    await validateProgress(value, { schemaVersion: 1, completions: one }, { publicRoot: root })
    const partial = applyProgress(value, { schemaVersion: 1, completions: one })
    assert.deepEqual(summary(partial).capabilities, { total: 4, todo: 3, partial: 1, done: 0 })
    const five = value.items.slice(0, 5).map(completion)
    await writeFile(join(root, 'docs/receipt.md'), receipt(five))
    await validateProgress(value, { schemaVersion: 1, completions: five }, { publicRoot: root })
    assert.equal(summary(applyProgress(value, { schemaVersion: 1, completions: five })).capabilities.done, 1)
    assert.ok(value.items.every(item => item.status === 'todo'))
  })
})

test('acceptance requires prerequisite closure, exact definition and tuple-bound public evidence', async () => {
  await temporaryRoot(async root => {
    const value = catalog()
    const entry = completion(value.items[1])
    await writeFile(join(root, 'docs/receipt.md'), receipt([entry]))
    await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [entry] }, { publicRoot: root }), /prerequisite LAN-00001/)
    for (const patch of [{ id: 'LAN-99999' }, { definitionSha256: 'b'.repeat(64) }, { verifiedOn: '2026-02-30' }, { verifiedOn: '2026-10-25' }, { sourceRevision: 'short' }, { reviewedBy: 'user' }, { extra: true }]) {
      const attempt = { ...completion(value.items[0]), ...patch }
      await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [attempt] }, { publicRoot: root }))
    }
    const valid = completion(value.items[0])
    await writeFile(join(root, 'docs/receipt.md'), '# Existing prose alone is not a completion receipt.\n')
    await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [valid] }, { publicRoot: root }), /missing fenced/)
    for (const patch of [{ id: 'LAN-00006' }, { definitionSha256: 'b'.repeat(64) }, { sourceRevision: 'b'.repeat(40) }]) {
      await writeFile(join(root, 'docs/receipt.md'), receipt([{ ...valid, ...patch }]))
      await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [valid] }, { publicRoot: root }), /exact ID/)
    }
    await writeFile(join(root, 'docs/receipt.md'), receipt([valid]))
    await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [valid, valid] }, { publicRoot: root }), /duplicate ID/)
    const changed = documents(); changed[0].families[0].capabilities[0].outcome += ' The changed definition requires a new review.'
    await assert.rejects(validateProgress(catalog(changed), { schemaVersion: 1, completions: [valid] }, { publicRoot: root }), /definitionSha256/)
  })
})

test('receipt paths reject traversal, URLs, private paths, directories and external symlinks', async context => {
  await temporaryRoot(async root => {
    const value = catalog()
    for (const evidence of ['../receipt.md', '/tmp/receipt.md', 'docs/../receipt.md', 'docs/receipt.md#claim', 'docs\\receipt.md', '.SYSTEMX/state/private.md', 'docs/.private/receipt.md', 'docs/missing.md', 'docs/backlog']) {
      await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [{ ...completion(value.items[0]), evidence }] }, { publicRoot: root }), /evidence/)
    }
    await temporaryRoot(async outside => {
      await writeFile(join(outside, 'docs/receipt.md'), receipt([completion(value.items[0])]))
      try { await symlink(join(outside, 'docs/receipt.md'), join(root, 'docs/receipt.md')) }
      catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { context.skip('Windows symlink privilege unavailable.'); return } throw error }
      await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: [completion(value.items[0])] }, { publicRoot: root }), /inside the public repository/)
    })
  })
})

test('ready queue defaults to local and honors complete cross-family prerequisite closure', async () => {
  await temporaryRoot(async root => {
    const source = documents(); source[0].families[1].gate = 'operator'; source[0].families[1].dependsOnFamilies = ['F001']; source[0].families[0].capabilities[1].dependsOnCapabilities = ['action-1']
    const value = catalog(source)
    assert.deepEqual(readyItems(value).items.map(item => item.id), ['LAN-00001'])
    assert.equal(readyItems(value, { gate: 'operator' }).matches, 0)
    const firstCapability = value.items.slice(0, 5).map(completion)
    await writeFile(join(root, 'docs/receipt.md'), receipt(firstCapability))
    await validateProgress(value, { schemaVersion: 1, completions: firstCapability }, { publicRoot: root })
    assert.deepEqual(readyItems(applyProgress(value, { schemaVersion: 1, completions: firstCapability })).items.map(item => item.id), ['LAN-00006'])
    const firstFamily = value.items.slice(0, 10).map(completion)
    await writeFile(join(root, 'docs/receipt.md'), receipt(firstFamily))
    await validateProgress(value, { schemaVersion: 1, completions: firstFamily }, { publicRoot: root })
    const accepted = applyProgress(value, { schemaVersion: 1, completions: firstFamily })
    assert.equal(readyItems(accepted).matches, 0)
    const operator = readyItems(accepted, { gate: 'operator', limit: 1 })
    assert.equal(operator.matches, 2)
    assert.equal(operator.items.length, 1)
    assert.equal(operator.executionAuthorized, false)
  })
})

test('compressed evidence edges cannot accept a dependent through incomplete transitive prerequisites', async () => {
  await temporaryRoot(async root => {
    const source = documents(); source[0].families[0].capabilities[1].dependsOnCapabilities = ['action-1']; source[0].families[1].dependsOnFamilies = ['F001']
    const value = catalog(source)
    const incomplete = [value.items[4], value.items[5], value.items[9], value.items[10]].map(completion)
    await writeFile(join(root, 'docs/receipt.md'), receipt(incomplete))
    await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: incomplete }, { publicRoot: root }), /prerequisite LAN-00001 is not completed/)
    const missingLane = value.items.slice(0, 11).filter(item => item.id !== 'LAN-00003').map(completion)
    await writeFile(join(root, 'docs/receipt.md'), receipt(missingLane))
    await assert.rejects(validateProgress(value, { schemaVersion: 1, completions: missingLane }, { publicRoot: root }), /prerequisite LAN-00003 is not completed/)
  })
})

test('CLI parsing rejects ambiguous modes, invalid bounds and unknown input paths', () => {
  assert.deepEqual(parseArgs([]), { mode: 'summary', json: false, limit: 20, gate: 'local' })
  assert.equal(parseArgs(['--ready', '--gate', 'provider', '--limit', '100', '--json']).limit, 100)
  for (const args of [['--write', '--check'], ['--summary', '--summary'], ['--item'], ['--item', 'LAN-1'], ['--limit', '0', '--ready'], ['--limit', '101', '--ready'], ['--limit', '2.5', '--ready'], ['--limit', '1'], ['--ready', '--gate', 'production'], ['--source', '/tmp/file'], ['--json', '--json']]) assert.throws(() => parseArgs(args))
})

test('CLI writes/checks exactly four deterministic artifacts; query modes leave inputs and outputs unchanged', async () => {
  await temporaryRoot(async root => {
    const small = { expectedFamilyCount: 5, capabilitiesPerFamily: 2, expectedDocuments: 5, familiesPerDocument: 1 }
    for (const [index, path] of specificationFiles.entries()) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), JSON.stringify({ schemaVersion: 1, families: [family(index + 1)] }))
    }
    await writeFile(join(root, progressFile), JSON.stringify(emptyProgress()))
    const cliOptions = { publicRoot: root, buildOptions: small, output: () => {} }
    const written = await runCli(['--write', '--json'], cliOptions)
    assert.equal(written.requirements.total, 50)
    const before = Object.fromEntries(await Promise.all([...specificationFiles, progressFile, ...Object.values(artifactFiles)].map(async path => [path, await readFile(join(root, path), 'utf8')])))
    await runCli(['--check'], cliOptions)
    const ready = await runCli(['--ready', '--limit', '2', '--json'], cliOptions)
    assert.equal(ready.items.length, 2)
    assert.equal((await runCli(['--item', 'LAN-00001', '--json'], cliOptions)).id, 'LAN-00001')
    assert.equal((await runCli([], cliOptions)).requirements.total, 50)
    await assert.rejects(runCli(['--item', 'LAN-99999'], cliOptions), /Unknown item/)
    for (const [path, contents] of Object.entries(before)) assert.equal(await readFile(join(root, path), 'utf8'), contents)
    await writeFile(join(root, artifactFiles.plan), before[artifactFiles.plan] + 'Unreviewed drift.\n')
    await assert.rejects(runCli(['--check'], cliOptions), /Generated artifact differs/)
    await runCli(['--write'], cliOptions)
    assert.equal(await readFile(join(root, artifactFiles.plan), 'utf8'), before[artifactFiles.plan])
    assert.match(before[artifactFiles.csv], /definitionSha256/)
    assert.equal(JSON.parse(before[artifactFiles.json]).sourceBase, sourceBase)
  })
})

test('fixed public inputs and generated outputs refuse symbolic-link redirection', async context => {
  await temporaryRoot(async root => {
    const small = { expectedFamilyCount: 5, capabilitiesPerFamily: 2, expectedDocuments: 5, familiesPerDocument: 1 }
    for (const [index, path] of specificationFiles.entries()) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), JSON.stringify({ schemaVersion: 1, families: [family(index + 1)] }))
    }
    await writeFile(join(root, progressFile), JSON.stringify(emptyProgress()))
    const cliOptions = { publicRoot: root, buildOptions: small, output: () => {} }
    await writeFile(join(root, 'docs/private-input.json'), JSON.stringify(emptyProgress()))
    await rm(join(root, progressFile))
    try { await symlink(join(root, 'docs/private-input.json'), join(root, progressFile)) }
    catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { context.skip('Windows symlink privilege unavailable.'); return } throw error }
    await assert.rejects(runCli(['--summary'], cliOptions), /fixed repository path/)
    await rm(join(root, progressFile))
    await writeFile(join(root, progressFile), JSON.stringify(emptyProgress()))
    await writeFile(join(root, 'docs/redirected.md'), 'Must remain unchanged.\n')
    await symlink(join(root, 'docs/redirected.md'), join(root, artifactFiles.json))
    await assert.rejects(runCli(['--write'], cliOptions), /must not be a symbolic link/)
    assert.equal(await readFile(join(root, 'docs/redirected.md'), 'utf8'), 'Must remain unchanged.\n')
    const privatePath = join(root, '.SYSTEMX/state/private.md')
    await mkdir(dirname(privatePath), { recursive: true })
    await writeFile(privatePath, receipt([completion(catalog().items[0])]))
    await symlink(privatePath, join(root, 'docs/receipt.md'))
    await assert.rejects(validateProgress(catalog(), { schemaVersion: 1, completions: [completion(catalog().items[0])] }, { publicRoot: root }), /inside the public repository/)
  })
})
