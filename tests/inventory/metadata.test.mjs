import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { inspectInventoryMetadata, validInventoryMetadata, exportInventoryMetadata, revalidateInventoryProposal, isInventoryMetadataPath, inventoryResourceStatsMatch } from '../../.SYSTEMX/LAN/Builder/importer/inventory-metadata.mjs'
import { runInventoryMetadataAction } from '../../.SYSTEMX/LAN/Builder/importer/inventory-metadata-actions.mjs'

const sha = text => createHash('sha256').update(text).digest('hex')
const asset = 'public/images/featured.webp'
const host = '.SYSTEMX/LAN/Builder/contracts/capability-manifest.json'
const managed = '.SYSTEMX/.systemx/releases/1.9.0-alpha.6/STANDARD.md'
const page = 'src/pages/Home.tsx'
const router = 'src/router.tsx'
const stat = () => ({ size: 1024n, mtimeNs: 123n, ctimeNs: 456n, nlink: 1n, isFile: () => true })
const routes = [{ state: 'explicit', source: page, declaredIn: router, line: 12, pattern: '/' }]
const component = { source: page, name: 'Home', declarationLine: 1, exportLine: 1, kind: 'function', sourceRevision: sha(page) }
function seal(snapshot) {
  const { revision: ignored, ...data } = snapshot
  return { ...data, revision: sha(JSON.stringify(data)) }
}

function fixture({ edits = {}, extraIndex = [], statFor = stat, routeDeclarations = routes, exportRows = [component] } = {}) {
  const files = ['src/main.tsx', router, page, 'src/Sidebar.tsx']
  const evidence = files.map(path => ({ path, sha256: sha(edits[path] ?? path), indexOid: 'a'.repeat(40), matchesIndex: !edits[path] }))
  const index = new Map([...files, asset, host, managed, ...extraIndex].map(p => [p, 'a'.repeat(40)]))
  const entryPoints = [{ state: 'inferred', source: 'src/main.tsx', basis: 'vite-entry-convention' }]
  const components = { scope: 'tracked-src-jsx-tsx-and-route-modules', exports: exportRows.map(row => ({ ...row, sourceRevision: evidence.find(e => e.path === row.source)?.sha256 })), shellSources: [] }
  const findings = []
  const metadata = inspectInventoryMetadata({ index, evidence, entryPoints, routes, routeDeclarations, components, findings, statFor,
    issue: (code, path, line) => findings.push({ state: 'unresolved', code, ...(path ? {path} : {}), ...(line ? {line} : {}) }) })
  const snapshot = seal({ schemaVersion: 4, checkoutId: sha('checkout'), commit: 'b'.repeat(40), indexRevision: sha('index'),
    supportedStack: 'vite', complete: findings.length === 0, entryPoints, routes, components,
    configuration: { dependencies: [], runtimePins: [], buildTargets: [], bridges: [], firebase: [] },
    exclusions: { privateOrNoncanonical: 2, outsideSourceScope: 1, nonregularIndex: 0 }, findings, omittedFindings: 0, evidence, metadata })
  return { index, snapshot }
}

test('ownership and asset observations use tracked, reviewed stat metadata only', () => {
  const observed = []
  const unsafe = ['public/uploads/avatar.png', 'public/private/a.svg', 'public/credentials.json', 'public/.cache/a.svg',
    'public/data.json', 'public/vendor/icon.png', '../public/logo.png', '.SYSTEMX/AGENTS/agent.0/MEMORY.md',
    '.SYSTEMX/.systemx/releases/1.0.0/WORK/TASKS.json', 'src/pages/Home.tsx']
  for (const path of unsafe) assert.equal(isInventoryMetadataPath(path), false, path)
  const { index, snapshot } = fixture({ extraIndex: unsafe, statFor: path => { observed.push(path); return stat() } })
  assert.deepEqual(observed.sort(), [asset, host, managed].sort())
  assert.equal(validInventoryMetadata(snapshot.metadata, snapshot), true)
  const resources = new Map(snapshot.metadata.resources.map(row => [row.path, row]))
  assert.equal(resources.get(page).revision, sha(page))
  assert.equal(resources.get(host).owner, 'host-extension')
  assert.equal(resources.get(managed).owner, 'managed-release')
  assert.equal(resources.get(asset).bytes, 1024)
  assert.equal(resources.get(asset).mediaType, 'image/webp')
  assert.equal(resources.get(asset).rendering, 'not-observed')
  assert.equal(inventoryResourceStatsMatch(snapshot.metadata, index, stat), true)
  assert.equal(inventoryResourceStatsMatch(snapshot.metadata, index, () => ({ ...stat(), ctimeNs: 457n })), false)
  const linked = fixture({ statFor: path => path === asset ? { ...stat(), nlink: 2n } : stat() }).snapshot
  assert.equal(linked.complete, false)
  assert.equal(linked.metadata.omittedResources, 1)
  assert.ok(!linked.metadata.resources.some(row => row.path === asset))
})

test('every declaration collection has an adapter, a version and an interpretation basis', () => {
  const { snapshot } = fixture()
  const p = snapshot.metadata.provenance
  assert.deepEqual(p.rules[p.entryPoints[0]], { adapter: 'vite-entry', basis: 'inferred' })
  assert.deepEqual(p.rules[p.routes], { adapter: 'react-route-declaration', basis: 'literal' })
  assert.equal(p.ruleVersion, 1)
  assert.equal(p.rules[p.configurationFields.buildTargets.inferred].basis, 'inferred')
  assert.equal(p.rules[p.configurationFields.buildTargets.declared].basis, 'literal')
  for (const field of ['componentExports','sharedShells','configuration','sourceResources','publicAssets','ownership','conflicts']) {
    assert.ok(p.rules[p[field]].adapter, field)
  }
})

test('route, page and module-local component conflicts retain source references on both sides', () => {
  const extra = { ...routes[0], declaredIn: 'src/main.tsx', source: 'src/Sidebar.tsx', line: 17 }
  const { snapshot } = fixture({ routeDeclarations: [...routes, extra], exportRows: [component, { ...component, exportLine: 22 }] })
  assert.equal(snapshot.complete, false)
  assert.deepEqual(snapshot.metadata.conflicts.map(row => row.kind), ['route','page','component'])
  assert.deepEqual(snapshot.metadata.conflicts[0].references.map(ref => [ref.path, ref.line]), [[router,12],['src/main.tsx',17]])
  assert.deepEqual(snapshot.metadata.conflicts[2].references.map(ref => ref.line), [1,22])
  assert.equal(validInventoryMetadata(snapshot.metadata, snapshot), true)
  assert.equal(exportInventoryMetadata(snapshot).status, 'refused')
  const otherModule = fixture({ exportRows: [component, { ...component, source: 'src/Sidebar.tsx' }] }).snapshot
  assert.equal(otherModule.complete, true, 'Equal export names in distinct modules are independently qualified')
})

test('portable export projects verified metadata only and never includes unknown or private fields', () => {
  const { snapshot } = fixture()
  const publicResult = exportInventoryMetadata(seal({ ...snapshot, localNotes: 'private scratch body' }))
  assert.equal(publicResult.status, 'exported')
  const artifact = publicResult.artifact
  assert.equal(artifact.resources.length, snapshot.metadata.resources.length)
  assert.equal(artifact.exclusions.privateOrNoncanonical, 2)
  assert.equal(artifact.routes[0].pattern, '/')
  assert.doesNotMatch(JSON.stringify(artifact), /private scratch body|localNotes|matchesIndex/)
  const injected = structuredClone(snapshot.metadata)
  injected.resources[0].body = 'unexpected private source'
  assert.equal(exportInventoryMetadata(seal({ ...snapshot, metadata: injected })).status, 'refused')
  assert.equal(exportInventoryMetadata({ ...snapshot, revision: sha('different') }).status, 'refused')
  assert.equal(exportInventoryMetadata({ ...snapshot, schemaVersion: 3 }).status, 'refused')
})

test('proposal checks current selected and declaring sources; unrelated changes do not invalidate it', () => {
  const { snapshot } = fixture()
  const check = (changes, selection = [page]) => revalidateInventoryProposal(snapshot, fixture({ edits: changes }).snapshot, { paths: selection })
  assert.equal(check({}).status, 'revalidated')
  assert.equal(check({ [router]: 'updated route declaration' }).code, 'resource-changed-rescan-required')
  assert.equal(check({ [page]: 'updated page' }).code, 'resource-changed-rescan-required')
  assert.equal(check({ 'src/Sidebar.tsx': 'unrelated' }).status, 'revalidated')
  assert.equal(check({}, [host]).code, 'ownership-review-required')
  assert.equal(check({}, [managed]).code, 'ownership-review-required')
  assert.equal(check({}, ['public/other.png']).code, 'resource-outside-proposal-inventory')
  assert.equal(revalidateInventoryProposal(snapshot, seal({ ...snapshot, checkoutId: sha('another') }), { paths: [page] }).code, 'checkout-mismatch')
})

test('CLI export uses retained state, while a proposal forces a fresh read-only comparison against the supplied revision', () => {
  const { snapshot } = fixture()
  const calls = []
  const load = (root, action) => { calls.push([root, action]); return action === 'last-good'
    ? { status: 'retained', lastGood: snapshot } : { status: 'compared', inventory: snapshot } }
  assert.equal(runInventoryMetadataAction(['export','--root','fixture'], load).status, 'exported')
  assert.deepEqual(calls, [['fixture','last-good']])
  const args = ['revalidate','--root','fixture','--revision',snapshot.revision,'--path',page]
  assert.equal(runInventoryMetadataAction(args, load).authority, 'metadata-review-only')
  assert.deepEqual(calls.slice(1), [['fixture','last-good'], ['fixture','compare']])
  assert.equal(runInventoryMetadataAction([...args,'--path',page], load).code, 'invalid-metadata-arguments')
  assert.equal(runInventoryMetadataAction(['revalidate','--path',page], load).code, 'expected-revision-and-resource-path')
  assert.equal(runInventoryMetadataAction(args, (root, action) => action === 'last-good' ? load(root, action) : { status: 'incomplete' }).code, 'fresh-complete-comparison-required')
})

test('asset work and conflicting-reference output stop at declared limits and block promotion', () => {
  const observed = []
  const extraIndex = Array.from({ length: 202 }, (_, i) => 'public/images/item-' + i + '.png')
  const { snapshot } = fixture({ extraIndex, statFor: path => { observed.push(path); return stat() } })
  assert.equal(observed.length, 200)
  assert.equal(snapshot.metadata.omittedResources, 5)
  assert.equal(exportInventoryMetadata(snapshot).status, 'refused')
  const many = fixture({ routeDeclarations: Array.from({ length: 70 }, (_, i) => ({ ...routes[0], line: i + 1 })) }).snapshot
  assert.equal(many.metadata.conflicts[0].references.length, 64)
  assert.equal(many.metadata.conflicts[0].omittedReferences, 6)
  assert.equal(many.complete, false)
})
