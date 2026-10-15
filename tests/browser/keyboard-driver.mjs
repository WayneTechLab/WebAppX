import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

/** Read computed browser focus only. This never focuses an element or changes
 * application/storage state; every traversal is a real Tab key event. */
async function focusObservation(page) {
  return page.evaluate(() => {
    const element = document.activeElement
    const style = element && getComputedStyle(element)
    const rect = element?.getBoundingClientRect()
    return {
      tag: element?.tagName, id: element?.id,
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
}

export function assertVisibleFocus(observation, label) {
  assert.ok(observation && !['BODY', 'HTML'].includes(observation.tag), `${label}: focus must remain on a meaningful element`)
  assert.equal(observation.hidden, false, `${label}: focused element must be visible`)
  assert.equal(observation.disabled, false, `${label}: focused element must be enabled`)
  assert.equal(observation.focusVisible, true, `${label}: browser must expose :focus-visible`)
  const { rect, viewport } = observation
  assert.ok(rect?.width > 0 && rect?.height > 0 && rect.x < viewport.width && rect.y < viewport.height && rect.x + rect.width > 0 && rect.y + rect.height > 0, `${label}: focused element must intersect the viewport`)
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
          assertVisibleFocus(observation, `${label} / Tab ${tabs + 1}`)
          observations.push({ step: observations.length + 1, label: `${label} / Tab ${tabs + 1}`, ...observation })
        }
      }
      throw new Error(`${label}: target was not reachable within 180 Tab presses`)
    },
  }
}
