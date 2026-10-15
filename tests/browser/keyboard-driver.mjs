import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

/** Read computed browser focus only. This never focuses an element or changes
 * application/storage state; every traversal is a real Tab key event. */
async function focusObservation(page) {
  const observation = await page.evaluate(() => {
    const element = document.activeElement
    const style = element && getComputedStyle(element)
    const rect = element?.getBoundingClientRect()
    return {
      tag: element?.tagName, id: element?.id,
      type: element?.getAttribute('type'), route: location.pathname,
      labels: [...(element?.labels ?? [])].map(label => label.textContent.trim()),
      label: element?.getAttribute('aria-label') || element?.textContent?.trim().slice(0, 120),
      focusVisible: element?.matches(':focus-visible') ?? false,
      hidden: !element || !!element.closest('[hidden], [inert]') || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0,
      disabled: element?.matches(':disabled') ?? false,
      outlineWidth: style?.outlineWidth, outlineStyle: style?.outlineStyle,
      outlineColor: style?.outlineColor, boxShadow: style?.boxShadow,
      rect: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  if (observation.tag === 'INPUT' && observation.type === 'date' && !observation.focusVisible) observation.nativeFocus = await nativeDateFocus(page)
  return observation
}

/** Chromium's native calendar indicator lives inside a closed user-agent
 * shadow root. CDP reads its actual AX focus, provenance, CSS and geometry;
 * it never focuses it, changes styles or forces a pseudo class. */
async function nativeDateFocus(page) {
  const session = await page.context().newCDPSession(page)
  let objectId
  try {
    const tree = await session.send('Accessibility.getFullAXTree')
    const focused = tree.nodes.filter(node => node.role?.value !== 'RootWebArea' && node.properties?.some(property => property.name === 'focused' && property.value?.value === true))
    if (focused.length !== 1 || !focused[0].backendDOMNodeId) return { axFocusedCount: focused.length }
    const ax = focused[0]
    const active = await session.send('Runtime.evaluate', { expression: 'document.activeElement' })
    const host = await session.send('DOM.describeNode', { objectId: active.result.objectId })
    await session.send('Runtime.releaseObject', { objectId: active.result.objectId })
    const document = await session.send('DOM.getDocument', { depth: -1, pierce: true })
    let provenance
    function visit(node, shadowHost, shadowType) {
      if (node.backendNodeId === ax.backendDOMNodeId) provenance = { shadowHost, shadowType, attributes: node.attributes ?? [] }
      for (const child of node.children ?? []) visit(child, shadowHost, shadowType)
      for (const shadow of node.shadowRoots ?? []) visit(shadow, node.backendNodeId, shadow.shadowRootType)
    }
    visit(document.root)
    const resolved = await session.send('DOM.resolveNode', { backendNodeId: ax.backendDOMNodeId })
    objectId = resolved.object.objectId
    const result = await session.send('Runtime.callFunctionOn', { objectId, returnByValue: true, functionDeclaration: `function () {
      const style = getComputedStyle(this), rect = this.getBoundingClientRect(), host = this.getRootNode().host;
      return { tag: this.tagName, id: this.id, pseudo: this.getAttribute('pseudo'), focused: this.matches(':focus'), focusVisible: this.matches(':focus-visible'), hidden: style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0, disabled: this.matches(':disabled'), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, outlineColor: style.outlineColor, boxShadow: style.boxShadow, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight }, activeDateHost: host === document.activeElement && host?.tagName === 'INPUT' && host.type === 'date' };
    }` })
    return { ...result.result.value, axFocusedCount: focused.length, axFocused: true, axRole: ax.role?.value, axName: ax.name?.value, userAgentShadow: provenance?.shadowType === 'user-agent' && provenance.shadowHost === host.node.backendNodeId }
  } finally {
    if (objectId) await session.send('Runtime.releaseObject', { objectId }).catch(() => {})
    await session.detach()
  }
}

export function assertVisibleFocus(observation, label) {
  assert.ok(observation && !['BODY', 'HTML'].includes(observation.tag), `${label}: focus must remain on a meaningful element`)
  assert.equal(observation.hidden, false, `${label}: focused element must be visible`)
  assert.equal(observation.disabled, false, `${label}: focused element must be enabled`)
  const { rect, viewport } = observation
  assert.ok(rect?.width > 0 && rect?.height > 0 && rect.x < viewport.width && rect.y < viewport.height && rect.x + rect.width > 0 && rect.y + rect.height > 0, `${label}: focused element must intersect the viewport`)
  if (observation.nativeFocus) {
    const part = observation.nativeFocus
    assert.equal(observation.tag, 'INPUT', `${label}: native picker evidence requires an input host`)
    assert.equal(observation.type, 'date', `${label}: only a native date host is supported`)
    assert.equal(part.userAgentShadow, true, `${label}: picker must belong to this host's user-agent shadow root`)
    assert.equal(part.activeDateHost, true, `${label}: picker host must be the actual active date input`)
    assert.equal(part.axFocusedCount, 1, `${label}: exactly one actual AX control must be focused`)
    assert.equal(part.axFocused, true, `${label}: AX must report the actual picker focused`)
    assert.equal(part.axRole, 'button', `${label}: the native focused part must expose its button role`)
    assert.match(part.axName ?? '', /^Show date picker(?: Show date picker)?$/, `${label}: unknown native focused controls must fail`)
    assert.equal(part.tag, 'DIV', `${label}: expected the native picker indicator`)
    assert.equal(part.id, 'picker', `${label}: expected the native picker identifier`)
    assert.equal(part.pseudo, '-webkit-calendar-picker-indicator', `${label}: only the observed native calendar part is supported`)
    assert.equal(part.focused, true, `${label}: the native part must actually match :focus`)
    assert.deepEqual(part.viewport, viewport, `${label}: native evidence must use this document's viewport`)
    assert.ok(part.rect?.x >= rect.x && part.rect.y >= rect.y && part.rect.x + part.rect.width <= rect.x + rect.width && part.rect.y + part.rect.height <= rect.y + rect.height, `${label}: the native focus rectangle must belong inside its active date host`)
    assertVisibleFocus(part, `${label} / actual native date-picker button`)
    return
  }
  assert.equal(observation.focusVisible, true, `${label}: browser must expose :focus-visible`)
  const transparent = color => !color || color === 'transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color)
  const outline = parseFloat(observation.outlineWidth) > 0 && !['none', 'hidden'].includes(observation.outlineStyle) && !transparent(observation.outlineColor)
  const shadow = observation.boxShadow && observation.boxShadow !== 'none' && !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(observation.boxShadow)
  assert.ok(outline || shadow, `${label}: focused element must draw a visible outline or ring`)
}

export function createKeyboardDriver(page, observations = []) {
  async function assertFocus(locator, label = 'Keyboard focus') {
    await expect(locator, label).toBeFocused()
    const observation = await focusObservation(page)
    assertVisibleFocus(observation, label)
    observations.push({ step: observations.length + 1, label, ...observation })
  }
  return {
    observations,
    assertFocus,
    async focus(locator, label = 'Keyboard target') {
      await expect(locator, label).toBeVisible()
      for (let tabs = 0; tabs < 180; tabs += 1) {
        if (await locator.evaluate(element => element === document.activeElement)) {
          await assertFocus(locator, label)
          return
        }
        await page.keyboard.press('Tab')
        const observation = await focusObservation(page)
        // Browser chrome is one natural boundary in the sequential tab order.
        // Continue through it, but require every actual DOM target to show focus.
        if (!['BODY', 'HTML'].includes(observation.tag)) {
          observations.push({ step: observations.length + 1, label: `${label} / Tab ${tabs + 1}`, ...observation })
          assertVisibleFocus(observation, `${label} / Tab ${tabs + 1}`)
        }
      }
      throw new Error(`${label}: target was not reachable within 180 Tab presses`)
    },
  }
}
