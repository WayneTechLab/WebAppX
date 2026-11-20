import assert from 'node:assert/strict'
import { checkNavigatorTargets } from './navigator-targets-browser.mjs'
import { inspectOwnership } from '../Builder/source-ownership.mjs'

// Parsed alongside the fixture Home source by the project's TSX adapter.
// Qualifying two instances requires distinct explicit accepted node IDs.
export const inspectionSource = `
function ProofCard(){return <><article data-systemx-component="ProofCard" data-systemx-id="nav-card-one">One</article><article data-systemx-component="ProofCard" data-systemx-id="nav-card-two">Two</article></>}
function ProofBranch(){return <section data-systemx-id="nav-durable"><span>Branch</span></section>}
`

async function openPanel(panel) {
  if (!await panel.evaluate(element => element.open)) await panel.locator(':scope > summary').click()
}

export async function checkNavigatorInspection(page, frame, expect, map, draft) {
  const tree = page.locator('#preview-layer-tree')
  const row = id => tree.getByRole('treeitem').filter({ hasText: new RegExp('#' + id + '(?=[^A-Za-z0-9_-]|$)') })
  const components = page.locator('#preview-navigator-components')
  const coverage = page.locator('[data-nav-coverage="preview"]')
  const coverageRows = coverage.locator('[data-nav-coverage-rows]')
  const compare = page.locator('[data-nav-compare="preview"]')
  const diffSummary = compare.locator('[data-nav-diff-summary]')
  const changes = compare.locator('[data-nav-diff-results]')
  const editor = page.locator('#source-editor')
  const confirmed = anchor => map.nodes.find(node => node.anchor === anchor && node.confidence === 'explicit').id
  const one = confirmed('nav-card-one'), two = confirmed('nav-card-two')
  assert.notEqual(one, two)
  const inspections = []
  const inspectUrl = new URL('/__systemx/api/identity/inspect', page.url()).href
  const metadataFixture = async route => {
    // Normal selection reads node details via POST. Supply only an exact
    // metadata reference in Chromium; the request never reaches a server.
    const ref = route.request().postDataJSON()
    assert.equal(route.request().method(), 'POST')
    assert.deepEqual(Object.keys(ref).sort(), ['documentId', 'nodeId', 'workspaceId'])
    assert.equal(ref.workspaceId, map.workspaceId)
    assert.equal(ref.documentId, map.documentId)
    assert.ok([one, two].includes(ref.nodeId))
    inspections.push(ref.nodeId)
    await route.fulfill({ json: inspectOwnership(map, ref, { currentRevision: map.sourceRevision }) })
  }
  await page.route(inspectUrl, metadataFixture)
  await frame.evaluate(() => {
    const el = (tag, id, parent, attrs = {}) => {
      const node = document.createElement(tag)
      if (id) node.id = id
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
      parent.append(node)
      return node
    }
    const box = document.createElement('div')
    box.id = 'sx-inspection'; box.setAttribute('data-systemx-source', 'src/pages/HomePage.tsx')
    document.body.prepend(box)
    const durable = el('section', 'sx-durable', box, { 'data-systemx-id': 'nav-durable' })
    el('span', 'sx-expanded-leaf', durable)
    // Mounted order deliberately differs from TSX source order.
    for (const [id, anchor] of [['sx-card-two', 'nav-card-two'], ['sx-card-one', 'nav-card-one'], ['sx-card-unknown', 'nav-missing']]) {
      el('article', id, box, { 'data-systemx-id': anchor, 'data-systemx-component': 'ProofCard', 'data-systemx-name': 'Repeated label' })
    }
    const list = el('ul', 'sx-virtual-window', box, { 'data-systemx-virtualized': '' })
    for (const position of [51, 52]) el('li', 'sx-position-' + position, list, { 'aria-setsize': '200', 'aria-posinset': String(position) })
    const unknown = el('div', 'sx-unknown-total', box, { role: 'list', 'data-systemx-virtualized': '' })
    el('span', 'sx-unknown-position', unknown, { role: 'listitem' })
    const before = el('div', 'sx-diff-left', box), after = el('div', 'sx-diff-right', box)
    el('p', 'sx-removed-node', before)
    el('section', 'sx-moved-node', before)
    el('span', 'sx-stable-node', after)
  })
  try {
    const inspectSummary = page.locator('#preview-layer-summary')
    const expand = async id => {
      const item = row(id)
      if (await item.getAttribute('aria-expanded') !== 'true') await item.press('ArrowRight')
      await expect(item).toHaveAttribute('aria-expanded', 'true')
    }
    await expand('sx-inspection')
    await expand('sx-durable')
    await expect(row('sx-expanded-leaf')).toBeVisible()
    await frame.evaluate(() => {
      const durable = document.getElementById('sx-durable')
      const replacement = durable.cloneNode(true)
      replacement.id = 'sx-remounted'
      durable.replaceWith(replacement)
    })
    await expect(row('sx-remounted')).toHaveAttribute('aria-expanded', 'true')
    await expect(row('sx-expanded-leaf')).toBeVisible()
    await frame.evaluate(() => {
      const mounted = document.getElementById('sx-remounted')
      const a = mounted.cloneNode(true), b = mounted.cloneNode(true)
      a.id = 'sx-ambiguous-a'; b.id = 'sx-ambiguous-b'
      mounted.replaceWith(a, b)
    })
    await expect(row('sx-ambiguous-a')).toHaveAttribute('aria-expanded', 'false')
    await expect(row('sx-ambiguous-b')).toHaveAttribute('aria-expanded', 'false')
    await expect(row('sx-expanded-leaf')).toHaveCount(0)
    await expect(inspectSummary).toContainText(/unresolved|ambiguous/i)
    await frame.evaluate(() => {
      document.getElementById('sx-ambiguous-b').remove()
      const first = document.getElementById('sx-ambiguous-a')
      const replacement = first.cloneNode(true)
      replacement.id = 'sx-replaced-node'
      replacement.setAttribute('data-systemx-id', 'nav-never-accepted')
      first.replaceWith(replacement)
    })
    await expect(row('sx-replaced-node')).toHaveAttribute('aria-expanded', 'false')

    await openPanel(components)
    const group = components.locator('details[data-nav-definition]').filter({ has: page.locator('summary').filter({ hasText: 'ProofCard' }) })
    await openPanel(group)
    const instances = group.locator('[data-nav-instance]')
    await expect(instances).toHaveCount(2)
    await expect(instances.nth(0)).toContainText('sx-card-two')
    await expect(instances.nth(1)).toContainText('sx-card-one')
    const domOrder = () => frame.locator('#sx-inspection > article').evaluateAll(nodes => nodes.map(node => node.id))
    const originalOrder = ['sx-card-two', 'sx-card-one', 'sx-card-unknown']
    assert.deepEqual(await domOrder(), originalOrder)
    await instances.nth(0).locator('[data-nav-instance-select]').click()
    await expect(frame.locator('#sx-card-two')).toHaveAttribute('data-systemx-inspector-selected', '')
    await expect(components).toContainText(two)
    await expect.poll(() => inspections.includes(two)).toBe(true)
    await instances.nth(1).locator('[data-nav-instance-reveal]').click()
    await expect(row('sx-card-one')).toBeVisible()
    await expect(components).toContainText(one)
    assert.deepEqual(await domOrder(), originalOrder)
    await expect(editor).toHaveValue(draft)
    const targets = await checkNavigatorTargets(page, frame, expect, map, draft)

    await openPanel(coverage)
    const virtual = coverageRows.locator(':scope > *').filter({ hasText: 'sx-virtual-window' })
    const unknown = coverageRows.locator(':scope > *').filter({ hasText: 'sx-unknown-total' })
    await expect(virtual).toContainText(/2 mounted/i)
    await expect(virtual).toContainText(/200 logical/i)
    await expect(unknown).toContainText(/1 mounted/i)
    await expect(unknown).toContainText(/unknown|unreported|undeclared/i)
    await frame.evaluate(() => {
      const list = document.getElementById('sx-virtual-window')
      const next = document.createElement('li')
      next.id = 'sx-position-78'
      next.setAttribute('aria-setsize', '200'); next.setAttribute('aria-posinset', '78')
      list.replaceChildren(next)
    })
    await expect(virtual).toContainText(/1 mounted/i)
    await expect(virtual).toContainText(/200 logical/i)
    await expect(frame.locator('#sx-position-51')).toHaveCount(0)

    await openPanel(compare)
    const capture = compare.locator('[data-nav-capture]'), compareNow = compare.locator('[data-nav-compare-now]')
    await capture.click()
    await frame.evaluate(() => {
      const old = document.getElementById('sx-removed-node')
      const added = document.createElement('aside'); added.id = 'sx-added-node'; old.replaceWith(added)
      document.getElementById('sx-diff-right').append(document.getElementById('sx-moved-node'))
    })
    await compareNow.click()
    for (const [change, label] of [['added', 'sx-added-node'], ['removed', 'sx-removed-node'], ['reparented', 'sx-moved-node']]) {
      await expect(changes.locator('[data-nav-change="' + change + '"]').filter({ hasText: label })).toBeVisible()
    }
    const moved = changes.locator('[data-nav-change="reparented"]').filter({ hasText: 'sx-moved-node' })
    await expect(moved).toContainText('sx-diff-left')
    await expect(moved).toContainText('sx-diff-right')
    await expect(changes).not.toContainText('sx-stable-node')
    await expect(diffSummary).toContainText(/1 reparented/i)
    await expect(editor).toHaveValue(draft)

    await capture.click()
    await frame.evaluate(() => {
      const cap = document.createElement('div')
      cap.id = 'sx-nav-cap'
      const nodes = document.createDocumentFragment()
      for (let i = 0; i < 1510; i++) nodes.append(document.createElement('i'))
      cap.append(nodes)
      document.body.prepend(cap)
    })
    await compareNow.click()
    await expect(diffSummary).toContainText(/limited|partial|incomplete/i)
    await expect(changes.locator('[data-nav-change="removed"]')).toHaveCount(0)
    await expect(diffSummary).toContainText(/[1-9][0-9]* last seen/i)
    await expect(frame.locator('#sx-moved-node')).toHaveCount(1)
    await compare.locator('[data-nav-clear-comparison]').click()
    await expect(compareNow).toBeDisabled()
    await expect(editor).toHaveValue(draft)
    await expect(compare).not.toContainText('PRIVATE_NAVIGATOR_UNSAVED_DRAFT')
    return { targets, durableExpansionRestored: true, duplicateAndReplacedBranchesCollapsed: true,
      declaredInstances: 2, selectedSecondSourceInstance: true, distinctQualifiedReveal: true, runtimeOrderPreserved: true,
      mountedWindowSizes: [2, 1], logicalSize: 200, unknownTotalDisclosed: true,
      comparison: ['added', 'removed', 'reparented'], boundedComparisonAvoidedFalseRemovals: true,
      inspectRequest: 'Qualified node metadata response fulfilled inside Chromium; no request sent to LAN.', editorDraftPreserved: true }
  } finally {
    await frame.evaluate(() => {
      document.getElementById('sx-nav-cap')?.remove()
      document.getElementById('sx-inspection')?.remove()
    })
    for (const panel of [compare, coverage, components]) {
      if (await panel.count() && await panel.evaluate(element => element.open)) await panel.locator(':scope > summary').click()
    }
    await frame.getByRole('heading', { name: 'WebAppX', level: 1, exact: true }).click()
    await page.unroute(inspectUrl, metadataFixture)
  }
}
