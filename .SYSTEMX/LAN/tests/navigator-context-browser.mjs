import assert from 'node:assert/strict'
import { checkMappingFilters, checkScopedFilters } from './navigator-filter-browser.mjs'

export async function checkNavigatorContexts(page, frame, expect) {
  const panel = page.locator('#preview-navigator-contexts')
  const path = panel.locator('[aria-label="Hierarchy scope"]'), info = panel.locator('output')
  const filter = panel.getByRole('searchbox'), back = panel.getByRole('button', { name: 'Back to parent' })
  const rows = panel.getByRole('list', { name: 'Scoped element hierarchy' })
  const enter = pattern => panel.getByRole('button', { name: pattern }).click()
  const parentSelection = await page.locator('#canvas-breadcrumb-element').innerText()

  await checkMappingFilters(page, frame, expect)
  const separateOrigin = new URL('/sx-frame-boundary-fixture', frame.url())
  separateOrigin.hostname = separateOrigin.hostname === 'localhost' ? '127.0.0.1' : 'localhost'
  const serveLocalFrame = route => route.fulfill({ contentType: 'text/html', body: '<main id="sx-cross-origin-private">PRIVATE_ORIGIN</main>' })
  await page.route(separateOrigin.href, serveLocalFrame)
  await frame.evaluate(separateOriginUrl => {
    const box = document.createElement('div')
    box.id = 'sx-context-fixture'
    const host = document.createElement('x-sx-card')
    host.id = 'sx-context-host'
    const shadow = host.attachShadow({ mode: 'open' })
    const group = document.createElement('section'); group.id = 'sx-shadow-group'
    const field = document.createElement('input'); field.value = 'PRIVATE_SCOPED_INPUT'
    const text = document.createElement('span'); text.id = 'sx-shadow-leaf'; text.textContent = 'PRIVATE_SCOPED_TEXT'
    group.append(field, text); shadow.append(group); box.append(host)
    Object.defineProperty(group, 'textContent', { get() { throw new Error('Navigator read private shadow text') } })
    const nested = document.createElement('iframe')
    nested.id = 'sx-context-child'
    nested.srcdoc = '<section id="sx-document-one"><span id="sx-frame-leaf">PRIVATE_FRAME_TEXT</span><iframe id="sx-context-grandchild" srcdoc="<p id=sx-grandchild-leaf>private frame text</p>"></iframe></section>'
    group.append(nested)
    for (const id of ['sx-anonymous-a', 'sx-anonymous-b']) {
      const sameLabel = document.createElement('iframe')
      sameLabel.srcdoc = '<p id="' + id + '"></p>'
      group.append(sameLabel)
    }
    const virtual = document.createElement('div')
    virtual.id = 'sx-virtual'; virtual.setAttribute('role', 'list')
    const mounted = document.createElement('span'); mounted.id = 'sx-mounted-1'
    virtual.append(mounted); group.append(virtual)
    const closedHost = document.createElement('x-sx-closed')
    closedHost.id = 'sx-context-closed'
    const privateNode = document.createElement('div'); privateNode.id = 'sx-closed-private'
    closedHost.attachShadow({ mode: 'closed' }).append(privateNode)
    const opaque = document.createElement('iframe')
    opaque.id = 'sx-context-opaque'; opaque.setAttribute('sandbox', ''); opaque.srcdoc = '<div id="sx-cross-private"></div>'
    const cross = document.createElement('iframe')
    cross.id = 'sx-context-cross'; cross.src = separateOriginUrl
    const unsupported = document.createElement('iframe')
    unsupported.id = 'sx-context-data'; unsupported.src = 'data:text/html,<p>PRIVATE_DATA</p>'
    // These declared frame boundaries are outside the inspected tree.
    // Looking through them, even if the access would throw, violates the boundary.
    window.__sxExcludedDocumentReads = 0
    for (const frame of [opaque, cross, unsupported]) for (const property of ['contentDocument', 'contentWindow']) {
      Object.defineProperty(frame, property, { configurable: true, get() {
        window.__sxExcludedDocumentReads++
        throw new Error('Navigator attempted an excluded frame document')
      } })
    }
    box.append(closedHost, opaque, cross, unsupported); document.body.prepend(box)
  }, separateOrigin.href)
  try {
    await panel.locator(':scope > summary').click()
    await expect(panel.getByRole('button', { name: /Open shadow root.*#sx-context-host/ })).toBeVisible()
    await expect(panel.getByRole('button', { name: /sx-context-closed/ })).toHaveCount(0)
    await expect.poll(() => page.frames().some(child => child.url() === separateOrigin.href)).toBe(true)
    for (const [name, reason] of [['sx-context-opaque', /opaque sandbox/i], ['sx-context-cross', /cross-origin frame/i], ['sx-context-data', /unsupported frame URL/i]]) {
      const boundary = panel.locator('[data-nav-boundary="excluded"]').filter({ hasText: name })
      await expect(boundary).toBeVisible()
      await expect(boundary).toContainText(reason)
      await expect(boundary).toContainText(/contents excluded/i)
      await expect(panel.getByRole('button', { name: new RegExp(name) })).toHaveCount(0)
      assert.equal(await boundary.getAttribute('aria-expanded'), null)
    }
    assert.equal(await frame.evaluate(() => window.__sxExcludedDocumentReads), 0)
    await expect(path).toHaveText('Preview')
    await frame.evaluate(() => {
      const cross = document.getElementById('sx-context-cross')
      delete cross.contentWindow; delete cross.contentDocument
      cross.removeAttribute('src')
      cross.srcdoc = '<section id="sx-recovered-frame">PRIVATE_RETURNED_FRAME</section>'
    })
    await enter(/Frame.*#sx-context-cross/)
    await expect(rows).toContainText('section#sx-recovered-frame')
    await frame.evaluate(separateOriginUrl => {
      const cross = document.getElementById('sx-context-cross')
      cross.removeAttribute('srcdoc')
      cross.src = separateOriginUrl
      for (const property of ['contentWindow', 'contentDocument']) Object.defineProperty(cross, property, { get() {
        window.__sxExcludedDocumentReads++
        throw new Error('Navigator read a frame after its origin changed')
      } })
    }, separateOrigin.href)
    await expect(path).toHaveText('Preview')
    await expect(panel.locator('[data-nav-boundary="excluded"]').filter({ hasText: 'sx-context-cross' })).toContainText(/Cross-origin frame/i)
    await expect(info).toContainText('replaced or became unavailable')
    await expect(rows).not.toContainText('sx-recovered-frame')
    await filter.fill('sx-context-host')
    await enter(/Open shadow root.*#sx-context-host/)
    await expect(path).toContainText('Preview › Open shadow root')
    await rows.getByRole('button', { name: 'section#sx-shadow-group' }).click()
    await expect(rows).toContainText('span#sx-shadow-leaf')
    await checkScopedFilters(page, frame, expect, rows, info, filter)
    await filter.fill('PRIVATE_SCOPED')
    await expect(info).toContainText('0 metadata matches')
    await filter.fill('sx-mounted-250')
    await expect(info).toContainText('0 metadata matches')
    await frame.evaluate(() => {
      const shadow = document.querySelector('#sx-context-host').shadowRoot
      const nextWindow = document.createElement('span'); nextWindow.id = 'sx-mounted-250'
      shadow.getElementById('sx-virtual').replaceChildren(nextWindow)
    })
    await expect(rows).toContainText('span#sx-mounted-250')
    await filter.fill('sx-mounted-1'); await expect(info).toContainText('0 metadata matches')
    await filter.fill('')
    await enter(/^Frame · iframe \(2\)$/)
    await expect(path).toContainText('Frame · iframe (2)')
    await expect(rows).toContainText('p#sx-anonymous-b')
    await back.click()
    await enter(/Frame.*#sx-context-child/)
    await expect(path).toContainText('sx-context-child')
    await enter(/Frame.*#sx-context-grandchild/)
    await expect(rows).toContainText('p#sx-grandchild-leaf')
    await back.click()
    await expect(path).toContainText('sx-context-child')
    await expect(path).not.toContainText('grandchild')
    await back.click()
    await expect(rows.getByRole('button', { name: 'section#sx-shadow-group' })).toHaveAttribute('aria-expanded', 'true')
    await expect(rows).toContainText('span#sx-shadow-leaf')
    await enter(/Frame.*#sx-context-child/)
    await frame.evaluate(() => {
      const child = document.querySelector('#sx-context-host').shadowRoot.querySelector('iframe')
      child.srcdoc = '<main id="sx-replaced-frame">PRIVATE_REPLACEMENT_TEXT</main>'
    })
    await expect(info).toContainText('replaced or became unavailable')
    await expect(path).not.toContainText('sx-context-child')
    await enter(/Frame.*#sx-context-child/)
    await expect(rows).toContainText('main#sx-replaced-frame')
    await expect(rows).not.toContainText('sx-frame-leaf')
    await back.click()
    await frame.evaluate(() => {
      const shadow = document.querySelector('#sx-context-host').shadowRoot
      const group = shadow.getElementById('sx-shadow-group')
      const container = document.createElement('div'); container.id = 'sx-big-scope'
      for (let i = 0; i < 1600; i++) {
        const item = document.createElement('div'); item.className = 'sx-repeated-label'; container.append(item)
      }
      group.append(container)
      let target = shadow
      for (let i = 1; i <= 4; i++) {
        const n = document.createElement('x-nested'); n.id = 'sx-level-' + i
        target.prepend(n); target = n.attachShadow({ mode: 'open' })
      }
    })
    await filter.fill('sx-repeated-label')
    await expect(info).toContainText('1500 nodes')
    await expect(info).toContainText('100 rows')
    await expect(info).toContainText('first 120')
    await filter.fill('')
    for (let i = 1; i <= 3; i++) await enter(new RegExp('Open shadow root.*#sx-level-' + i))
    await enter(/Open shadow root.*#sx-level-4/)
    await expect(info).toContainText('limited to 4 nested contexts')
    for (let i = 0; i < 4; i++) await back.click()
    await expect(path).toHaveText('Preview')
    await expect(filter).toHaveValue('sx-context-host')
    await frame.evaluate(() => {
      const box = document.getElementById('sx-context-fixture')
      for (let i = 0; i < 35; i++) {
        const host = document.createElement('x-sx-budget')
        host.attachShadow({ mode: 'open' }); box.append(host)
      }
    })
    await filter.fill('x-sx-budget')
    await expect(info).toContainText('32 of 35 matching context boundaries')
    await filter.fill('sx-context-host'); await enter(/Open shadow root.*#sx-context-host/)
    await frame.evaluate(() => {
      const old = document.querySelector('#sx-context-host'), replacement = old.cloneNode(false)
      const fresh = document.createElement('em'); fresh.id = 'sx-remounted-shadow'
      replacement.attachShadow({ mode: 'open' }).append(fresh); old.replaceWith(replacement)
    })
    await expect(path).toHaveText('Preview')
    await expect(info).toContainText('replaced or became unavailable')
    await expect(filter).toHaveValue('sx-context-host')
    await enter(/Open shadow root.*#sx-context-host/)
    await expect(rows).toContainText('em#sx-remounted-shadow')
    await expect(rows).not.toContainText('sx-shadow-leaf')
    assert.equal(await page.locator('#canvas-breadcrumb-element').innerText(), parentSelection)
    assert.doesNotMatch(await panel.innerText(), /PRIVATE_|sx-closed-private|sx-cross-private/)
    assert.equal(await frame.evaluate(() => window.__sxExcludedDocumentReads), 0)
    return { inaccessibleFrameKinds: ['opaque sandbox', 'second loopback HTTP origin', 'unsupported data URL'], excludedFrameDocumentReads: 0, changedFrameOriginRecovered: true,
      kindFilters: ['heading', 'control'], visibilityFilters: ['rendered', 'hidden', 'inert', 'unavailable-box'],
      mappingFixture: 'Read-only GET fixture envelopes built by the source identity and ownership adapters.',
      mappingFilters: ['mapped', 'unmapped', 'read-only', 'stale'], duplicateRuntimeAnchorsUnmapped: true,
      privateEditorDraftPreserved: true, nestedSameOriginFrames: 2, openShadowRootInspected: true, closedShadowContentsOmitted: true,
      opaqueSandboxRefused: true, remountedShadowHostRecovered: true, replacedFrameDocumentRecovered: true,
      repeatedFrameLabelsDistinguished: true, virtualizedWindowReplaced: true, parentExpansionAndFilterRestored: true,
      canvasSelectionPreserved: true, exercisedLimits: { nodes: 1500, matches: 120, scopedRows: 100, boundaries: 32, nestedContexts: 4 } }
  } finally {
    await frame.evaluate(() => { document.getElementById('sx-context-fixture')?.remove(); delete window.__sxExcludedDocumentReads })
    await page.unroute(separateOrigin.href, serveLocalFrame)
    if (await panel.evaluate(node => node.open)) await panel.locator(':scope > summary').click()
  }
}
