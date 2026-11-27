import assert from 'node:assert/strict'

const query = 'tag:button class:Primary name:"Save draft"'

async function openDetails(panel) {
  if (!await panel.evaluate(element => element.open)) await panel.locator(':scope > summary').click()
}

async function checkBookmarks(page, frame, expect, map, draft) {
  const panel = page.locator('#preview-navigator-bookmarks')
  const save = panel.locator('[data-nav-bookmark-save]'), resolve = panel.locator('[data-nav-bookmark-resolve]')
  const remove = panel.locator('[data-nav-bookmark-delete]'), slots = panel.locator('[data-nav-bookmark-list]')
  const status = panel.locator('[data-nav-bookmark-status]')
  const key = 'systemx.lan.navigator-bookmarks.v1.' + map.workspaceId
  const read = () => page.evaluate(key => localStorage.getItem(key), key)
  const nodeId = map.nodes.find(node => node.anchor === 'nav-card-two').id
  await expect(frame.locator('#sx-card-two')).toHaveAttribute('data-systemx-inspector-selected', '')
  await openDetails(panel)
  assert.equal(await read(), null)
  await save.press('Enter')
  await expect(status).toContainText('Bookmarked')
  await expect(slots.locator('option')).toHaveCount(1)
  const raw = await read(), saved = JSON.parse(raw)
  assert.deepEqual(Object.keys(saved).sort(), ['bookmarks', 'version'])
  assert.equal(saved.version, 1)
  assert.equal(saved.bookmarks.length, 1)
  assert.deepEqual(Object.keys(saved.bookmarks[0]).sort(), ['documentId', 'nodeId', 'scopeId'])
  assert.equal(saved.bookmarks[0].documentId, map.documentId)
  assert.equal(saved.bookmarks[0].nodeId, nodeId)
  assert.match(saved.bookmarks[0].scopeId, /^scope_[a-f0-9]{64}$/)
  await save.click()
  await expect(status).toContainText('already bookmarked')
  assert.equal(await read(), raw)
  // A second dashboard loads the same origin from scratch in this browser
  // context. Listing and reloading the slot do not resolve it or read identity
  // fixtures; only the owner tab has the matching local source projection.
  const other = await page.context().newPage()
  try {
    await other.goto(new URL('/__systemx/#navigator', page.url()).href, { waitUntil: 'domcontentloaded' })
    for (let load = 0; load < 2; load++) {
      if (load) await other.reload({ waitUntil: 'domcontentloaded' })
      const peer = other.locator('#preview-navigator-bookmarks')
      await openDetails(peer)
      await expect(peer.locator('[data-nav-bookmark-list] option')).toHaveCount(1)
      await expect(peer.locator('[data-nav-bookmark-status]')).toContainText(/1 of 12/)
      assert.equal(await other.evaluate(key => localStorage.getItem(key), key), raw)
    }
  } finally { await other.close() }
  await frame.getByRole('heading', { name: 'WebAppX', level: 1, exact: true }).click()
  const tree = page.locator('#preview-layer-tree')
  const baseSelected = await page.locator('#canvas-breadcrumb-element').innerText()
  await frame.evaluate(() => {
    const old = document.getElementById('sx-card-two')
    const stub = document.createElement('aside')
    stub.id = 'sx-old-position'
    old.replaceWith(stub)
  })
  await resolve.press('Enter')
  await expect(status).toContainText(/unresolved/i)
  assert.equal(await page.locator('#canvas-breadcrumb-element').innerText(), baseSelected)
  await frame.evaluate(() => {
    const marker = document.getElementById('sx-old-position')
    for (const id of ['sx-card-recreated', 'sx-card-copy']) {
      const item = document.createElement('article')
      item.id = id; item.setAttribute('data-systemx-id', 'nav-card-two')
      item.setAttribute('data-systemx-component', 'ProofCard')
      document.getElementById('sx-inspection').append(item)
    }
    marker.remove()
  })
  await resolve.click()
  await expect(status).toContainText(/unresolved/i)
  assert.equal(await page.locator('#canvas-breadcrumb-element').innerText(), baseSelected)
  await frame.evaluate(() => document.getElementById('sx-card-copy').remove())
  await resolve.click()
  await expect(status).toContainText('Bookmark resolved')
  await expect(tree.getByRole('treeitem').filter({ hasText: 'sx-card-recreated' })).toBeFocused()
  await expect(page.locator('#source-editor')).toHaveValue(draft)
  assert.equal(await read(), raw)
  await remove.press('Enter')
  await expect(status).toContainText('Deleted')
  await expect(slots.locator('option')).toHaveCount(0)
  assert.equal(await read(), null)
  await panel.locator(':scope > summary').click()
}

async function checkPredicates(page, frame, expect) {
  const tree = page.locator('#preview-layer-tree'), search = page.locator('#preview-navigator-search')
  const summary = page.locator('#preview-layer-summary')
  const matches = tree.getByRole('treeitem').filter({ has: page.locator('[data-nav-duplicate]') })
  await search.fill(query)
  await expect(summary).toContainText(/2 matches/)
  await expect(matches).toHaveCount(2)
  for (const [index, parent] of ['sx-search-west', 'sx-search-east'].entries()) {
    const context = matches.nth(index).locator('[data-nav-duplicate]')
    await expect(context).toContainText(parent)
    await expect(context).toContainText('inspected match ' + (index + 1) + ' of 2')
    await expect(context).not.toContainText('PRIVATE')
  }
  await matches.nth(1).press('Enter')
  await expect(frame.locator('#sx-search-east > button.Primary')).toHaveAttribute('data-systemx-inspector-selected', '')
  await search.fill('tag:button class:primary name:"Save draft"')
  await expect(summary).toContainText(/1 match in/)
  await search.fill('id:sx-target-deep')
  await expect(tree.getByRole('treeitem').filter({ hasText: '#sx-target-deep' })).toHaveCount(1)
  for (const expression of ['value:PRIVATE_FIELD', 'tag:button,script', '.Primary > button', 'name:"unterminated', 'tag:' + 'x'.repeat(158)]) {
    // insertText drives a real beforeinput event, including paste-length refusal.
    await search.fill('')
    await search.focus()
    await page.keyboard.insertText(expression)
    await expect(summary).toContainText('Search refused')
    await expect(tree.getByRole('treeitem')).toHaveCount(0)
  }
  await search.fill('')
  assert.deepEqual(await frame.locator('#sx-search-west > button, #sx-search-east > button').evaluateAll(nodes =>
    nodes.map(node => [node.getAttribute('data-systemx-name'), node.textContent])), [['Save draft', 'PRIVATE_WEST'], ['Save draft', 'PRIVATE_EAST']])
}

async function checkTopReveal(page, frame, expect) {
  const tree = page.locator('#preview-layer-tree'), summary = page.locator('#preview-layer-summary')
  const reveal = page.locator('#preview-navigator-reveal'), next = page.locator('#preview-navigator-continue-reveal')
  const target = tree.getByRole('treeitem').filter({ hasText: '#sx-target-deep' })
  const opened = () => tree.locator('[role="treeitem"][aria-expanded="true"]').filter({ hasText: /#sx-reveal-level-\d+/ }).count()
  await frame.locator('#sx-target-deep').click()
  await expect(frame.locator('#sx-target-deep')).toHaveAttribute('data-systemx-inspector-selected', '')
  let previous = await opened()
  assert.ok(previous <= 5, 'Initial selection opened too many deep ancestors')
  await expect(target).toHaveCount(0)
  const steps = []
  for (let index = 0; index < 6; index++) {
    await (index ? next : reveal).press('Enter')
    const current = await opened()
    const step = current - previous
    assert.ok(step > 0 && step <= 5, 'Expected one to five additional ancestors per keyboard action; got ' + step)
    steps.push(step); previous = current
    if (!await next.isVisible()) break
    await expect(summary).toContainText(/collapsed ancestors remain/)
    await expect(target).toHaveCount(0)
  }
  await expect(next).toBeHidden()
  await expect(target).toBeVisible()
  await expect(summary).toContainText(/Target visible/)
  assert.equal(previous, 18)

  // Start a second, independent reveal, then move its selected DOM node
  // while that chain is only partly open. A lookalike takes its old position.
  await frame.evaluate(() => {
    let parent = document.getElementById('sx-target-tests')
    for (let index = 0; index < 14; index++) {
      const branch = document.createElement('div')
      parent.append(branch); parent = branch
    }
    const original = document.createElement('button')
    original.id = 'sx-moving-target'; original.textContent = 'Moving fixture'
    parent.append(original)
  })
  await frame.locator('#sx-moving-target').click()
  await expect(next).toBeVisible()
  await expect(summary).toContainText(/collapsed ancestors remain/)
  await frame.evaluate(() => {
    const target = document.getElementById('sx-moving-target'), lookalike = target.cloneNode(true)
    lookalike.id = 'sx-former-position'
    lookalike.removeAttribute('data-systemx-inspector-selected')
    lookalike.scrollIntoView = () => { lookalike.dataset.unexpectedScroll = 'true' }
    target.before(lookalike)
    document.getElementById('sx-target-tests').append(target)
  })
  await expect(next).toBeHidden()
  await expect(summary).toContainText(/reveal path changed|reveal path.*replaced/i)
  await expect(frame.locator('#sx-moving-target')).toHaveAttribute('data-systemx-inspector-selected', '')
  await expect(frame.locator('#sx-former-position')).not.toHaveAttribute('data-systemx-inspector-selected', '')
  assert.equal(await frame.locator('#sx-former-position').getAttribute('data-unexpected-scroll'), null)
  return steps
}

export async function checkNavigatorTargets(page, frame, expect, map, draft) {
  await checkBookmarks(page, frame, expect, map, draft)
  await frame.evaluate(() => {
    const root = document.createElement('section')
    root.id = 'sx-target-tests'
    for (const place of ['west', 'east', 'decoy']) {
      const group = document.createElement('div'); group.id = 'sx-search-' + place
      const action = document.createElement('button')
      action.setAttribute('data-systemx-name', 'Save draft')
      action.className = place === 'decoy' ? 'primary' : 'Primary'
      action.textContent = 'PRIVATE_' + place.toUpperCase()
      group.append(action); root.append(group)
    }
    let parent = root
    for (let n = 1; n <= 18; n++) {
      const branch = document.createElement('section')
      branch.id = 'sx-reveal-level-' + n
      parent.append(branch); parent = branch
    }
    const target = document.createElement('button')
    target.id = 'sx-target-deep'; target.textContent = 'Deep fixture'
    parent.append(target)
    document.body.prepend(root)
  })
  try {
    await checkPredicates(page, frame, expect)
    const steps = await checkTopReveal(page, frame, expect)
    await expect(page.locator('#source-editor')).toHaveValue(draft)
    return { composedSearchTerms: 3, refusedExpressions: 5, duplicateRowsDistinguished: 2, deepTargetLevels: 18,
      revealStepSizes: steps, pendingRevealRefusedAfterReparent: true, bookmarkReadInReloadedTab: true, bookmarkQualifiedFields: ['documentId', 'nodeId', 'scopeId'],
      missingAndDuplicateBookmarkRefused: true, remountedBookmarkResolved: true, bookmarkDeleted: true, retainedEditorDraft: true }
  } finally {
    await page.locator('#preview-navigator-search').fill('')
    await frame.evaluate(() => document.getElementById('sx-target-tests')?.remove())
  }
}

export async function checkScopedTargetReveal(page, frame, expect, panel, filter, rows, info) {
  await frame.evaluate(() => {
    const shadow = document.getElementById('sx-context-host').shadowRoot
    const branches = document.createElement('div'); branches.id = 'sx-scoped-reveal'
    let parent = branches
    for (let index = 1; index <= 13; index++) {
      const next = document.createElement('section'); next.id = 'sx-sub-level-' + index
      parent.append(next); parent = next
    }
    const target = document.createElement('button')
    target.className = 'Primary'; target.setAttribute('data-systemx-name', 'Save draft')
    target.textContent = 'PRIVATE_SHADOW_TARGET'
    parent.append(target); shadow.querySelector('#sx-shadow-group').append(branches)
  })
  const before = await page.locator('#canvas-breadcrumb-element').innerText()
  await filter.fill(query)
  await expect(info).toContainText(/1 metadata matches/)
  await expect(rows.locator('[data-nav-reveal-match]')).toHaveCount(1)
  await rows.locator('[data-nav-reveal-match]').press('Enter')
  const next = panel.locator('[data-nav-reveal-next="context"]')
  await expect(next).toBeVisible()
  await expect(info).toContainText(/Opened 5 ancestors/)
  await expect(filter).toHaveValue('')
  const leaf = rows.getByRole('listitem').filter({ hasText: 'Save draft · button.Primary' })
  await expect(leaf).toHaveCount(0)
  await next.press('Enter')
  await expect(info).toContainText(/Opened 5 ancestors/)
  await next.press('Enter')
  await expect(next).toBeHidden()
  await expect(leaf).toBeVisible()
  assert.equal(await page.locator('#canvas-breadcrumb-element').innerText(), before)
  await frame.evaluate(() => document.getElementById('sx-context-host').shadowRoot.getElementById('sx-scoped-reveal').remove())
}
