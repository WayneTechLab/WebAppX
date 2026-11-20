import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { parseSourceIdentity } from '../Builder/source-identity-adapter.mjs'
import { buildOwnership } from '../Builder/source-ownership.mjs'

const sourcePath = 'src/pages/HomePage.tsx'
const revision = value => createHash('sha256').update(value).digest('hex')
const scopedFilters = (page, name) => page.locator('[data-nav-scope="' + name + '"]')
const menu = (group, name) => group.locator('[data-nav-filter="' + name + '"]')

export async function checkScopedFilters(page, frame, expect, rows, info, search) {
  const group = scopedFilters(page, 'context')
  const kind = menu(group, 'kind'), visibility = menu(group, 'visibility'), mapping = menu(group, 'mapping')
  const clear = group.locator('[data-nav-clear-filters]')
  await frame.evaluate(() => {
    const shadow = document.querySelector('#sx-context-host').shadowRoot
    const wrapper = document.createElement('div')
    wrapper.id = 'sx-criteria-parent'
    for (const [name, tag] of [['heading', 'h3'], ['control', 'button'], ['hidden', 'button'], ['inert', 'button'], ['boxless', 'span']]) {
      const el = document.createElement(tag)
      el.id = 'sx-criteria-' + name
      if (name === 'hidden') el.hidden = true
      if (name === 'inert') el.inert = true
      if (name === 'boxless') el.style.display = 'contents'
      el.textContent = 'PRIVATE_FILTERED_FIXTURE'
      wrapper.append(el)
    }
    shadow.getElementById('sx-shadow-group').append(wrapper)
  })
  await expect(group).toBeVisible()
  if (!await group.evaluate(node => node.open)) await group.locator('summary').click()
  const fieldSnapshot = () => frame.evaluate(() => {
    const shadow = document.querySelector('#sx-context-host').shadowRoot
    const wrapper = shadow.getElementById('sx-criteria-parent')
    return { markup: wrapper.outerHTML, active: shadow.activeElement?.id ?? '', value: shadow.querySelector('input').value }
  })
  const before = await fieldSnapshot()
  await search.fill('sx-criteria-')
  await kind.selectOption(['heading', 'control'])
  await expect(rows).toContainText('sx-criteria-heading')
  await expect(rows).toContainText('sx-criteria-control')
  await expect(rows).toContainText('sx-criteria-parent')
  await expect(rows).not.toContainText('sx-criteria-boxless')
  await expect(info).toContainText(/4 (?:filtered |metadata )?matches/i)
  await visibility.selectOption('rendered')
  await expect(rows).toContainText('sx-criteria-heading')
  await expect(rows).toContainText('sx-criteria-control')
  await expect(rows).not.toContainText('sx-criteria-hidden')
  await expect(rows).not.toContainText('sx-criteria-inert')
  await visibility.selectOption('hidden')
  await expect(rows).toContainText('sx-criteria-hidden')
  await expect(rows).not.toContainText('sx-criteria-control')
  await visibility.selectOption('inert')
  await expect(rows).toContainText('sx-criteria-inert')
  await expect(rows).not.toContainText('sx-criteria-hidden')
  await clear.click()
  await expect(search).toHaveValue('sx-criteria-')
  await visibility.selectOption('unavailable-box')
  await expect(rows).toContainText('sx-criteria-boxless')
  await expect(rows).not.toContainText('sx-criteria-hidden')
  await mapping.selectOption('mapped')
  await expect(info).toContainText(/0 (?:filtered |metadata )?matches/i)
  await mapping.selectOption('unmapped')
  await expect(rows).toContainText('sx-criteria-boxless')
  await clear.click()
  await search.fill('')
  await expect(rows.getByRole('button', { name: 'section#sx-shadow-group' })).toHaveAttribute('aria-expanded', 'true')
  assert.deepEqual(await fieldSnapshot(), before)
}

export async function checkMappingFilters(page, frame, expect) {
  const base = new URL(page.url()).origin + '/__systemx'
  const statusUrl = base + '/api/identity/status'
  const liveStatus = await page.request.get(base + '/api/status')
  assert.equal(liveStatus.status(), 200)
  const { workspaceId } = (await liveStatus.json()).repository
  assert.match(workspaceId, /^[0-9a-f]{64}$/)
  // Only these two GETs receive fixture responses, in this isolated page. Build
  // real adapter/ownership envelopes without installing a map or writing a file.
  const content = 'export default function HomePage(){return <section><h2 data-systemx-id="nav-proof-heading">Heading</h2><div data-systemx-id="nav-proof-readonly"><span>Child</span></div></section>}'
  const sourceRevision = revision(content)
  const { map } = parseSourceIdentity({ path: sourcePath, content, sourceRevision, workspaceId, route: '/' })
  const docUrl = base + '/api/identity/document?documentId=' + map.documentId
  const current = buildOwnership(map, { currentRevision: sourceRevision })
  const older = buildOwnership(map, { currentRevision: revision(content + ' changed') })
  const owner = anchor => current.objects.find(row => row.nodeId === map.nodes.find(node => node.anchor === anchor).id)
  assert.deepEqual(owner('nav-proof-heading').supportedOperations, ['literal'])
  assert.equal(owner('nav-proof-readonly').status, 'mapped')
  assert.deepEqual(owner('nav-proof-readonly').supportedOperations, [])
  let stale = false
  const handler = async route => {
    assert.equal(route.request().method(), 'GET')
    const isStatus = route.request().url() === statusUrl
    await route.fulfill({ json: isStatus ? { workspaceId, documents: [{ sourcePath, documentId: map.documentId }] }
      : { workspaceId, map, stale, currentRevision: stale ? revision(content + ' changed') : sourceRevision,
        ownership: stale ? older : current, retiredOwnershipClaims: [] } })
  }
  const matchesDoc = url => url.href === docUrl
  await page.route(statusUrl, handler)
  await page.route(matchesDoc, handler)
  const group = scopedFilters(page, 'preview'), mapping = menu(group, 'mapping')
  const search = page.locator('#preview-navigator-search'), tree = page.locator('#preview-layer-tree')
  const editor = page.locator('#source-editor')
  const picker = page.locator('#source-file-select')
  const identityStatus = page.locator('#identity-status')
  const refresh = page.locator('#identity-refresh-status')
  await frame.evaluate(() => {
    const box = document.createElement('section')
    box.id = 'sx-map-fixture-parent'
    for (const [name, tag, anchor] of [['mapped', 'h2', 'nav-proof-heading'], ['readonly', 'div', 'nav-proof-readonly'], ['unmapped', 'h2', null]]) {
      const node = document.createElement(tag)
      node.id = 'sx-map-fixture-' + name
      node.className = 'nav-proof-heading'
      node.textContent = 'nav-proof-heading'
      if (anchor) node.setAttribute('data-systemx-id', anchor)
      node.setAttribute('data-systemx-source', 'src/pages/HomePage.tsx')
      box.append(node)
    }
    document.body.prepend(box)
  })
  let baseline, draft
  try {
    await page.locator('[data-inspector-group-tab="build"]').click()
    await page.locator('[data-inspector-tab="source"]').click()
    await picker.selectOption(sourcePath)
    await page.locator('#load-source').click()
    await expect(editor).toHaveValue(/HomePage/)
    baseline = await editor.inputValue()
    draft = baseline + '\n// PRIVATE_NAVIGATOR_UNSAVED_DRAFT\n'
    await editor.fill(draft)
    await refresh.click()
    await expect(identityStatus).toContainText('current source read')
    if (!await group.evaluate(node => node.open)) await group.locator('summary').click()
    await search.fill('sx-map-fixture-')
    await mapping.selectOption('mapped')
    await expect(tree).toContainText('sx-map-fixture-mapped')
    await expect(tree).toContainText('sx-map-fixture-parent')
    await expect(tree).not.toContainText('sx-map-fixture-unmapped')
    await expect(tree).not.toContainText('sx-map-fixture-readonly')
    await mapping.selectOption('read-only')
    await expect(tree).toContainText('sx-map-fixture-readonly')
    await expect(tree).not.toContainText('sx-map-fixture-mapped')
    await mapping.selectOption('unmapped')
    await expect(tree).toContainText('sx-map-fixture-unmapped')
    await expect(tree).not.toContainText('sx-map-fixture-mapped')
    await frame.evaluate(() => {
      const original = document.getElementById('sx-map-fixture-mapped')
      const clone = original.cloneNode(false)
      clone.id = 'sx-map-fixture-duplicate'
      original.after(clone)
    })
    await expect(tree).toContainText('sx-map-fixture-duplicate')
    await expect(tree).toContainText('sx-map-fixture-mapped')
    await frame.evaluate(() => document.getElementById('sx-map-fixture-duplicate').remove())
    await expect(tree).not.toContainText('sx-map-fixture-mapped')
    stale = true
    await refresh.click()
    await expect(identityStatus).toContainText('stale')
    await mapping.selectOption('stale')
    await expect(tree).toContainText('sx-map-fixture-mapped')
    await expect(tree).toContainText('sx-map-fixture-readonly')
    await expect(tree).not.toContainText('sx-map-fixture-unmapped')
    await expect(editor).toHaveValue(draft)
    await expect(tree).not.toContainText('PRIVATE_NAVIGATOR_UNSAVED_DRAFT')
  } finally {
    await page.unroute(statusUrl, handler)
    await page.unroute(matchesDoc, handler)
    const clear = group.locator('[data-nav-clear-filters]')
    if (await clear.isVisible() && await clear.isEnabled()) await clear.click()
    await search.fill('')
    await frame.evaluate(() => document.getElementById('sx-map-fixture-parent')?.remove())
    if (draft && await editor.inputValue() === draft) await editor.fill(baseline)
    await refresh.click()
    await page.locator('[data-inspector-group-tab="design"]').click()
    await page.locator('[data-inspector-tab="style"]').click()
  }
}
