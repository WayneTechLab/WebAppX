import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { assertVisibleFocus } from './keyboard-driver.mjs'
import { expectedKeyboardOnboarding } from './keyboard-onboarding.mjs'
import { loadValidatedSeed } from './seed-contract.mjs'

const visible = {
  tag: 'BUTTON', hidden: false, disabled: false, focusVisible: true,
  outlineWidth: '2px', outlineStyle: 'solid', outlineColor: 'rgb(5, 150, 105)', boxShadow: 'none',
  rect: { x: 10, y: 10, width: 80, height: 30 }, viewport: { width: 1440, height: 1080 },
}

test('focus evidence accepts a visible outline or ring on an enabled target', () => {
  assert.doesNotThrow(() => assertVisibleFocus(visible, 'Outline'))
  assert.doesNotThrow(() => assertVisibleFocus({ ...visible, outlineWidth: '0px', outlineStyle: 'none', boxShadow: 'rgb(5, 150, 105) 0px 0px 0px 2px' }, 'Ring'))
})

for (const [name, patch] of [
  ['lost body focus', { tag: 'BODY' }],
  ['hidden target', { hidden: true }],
  ['disabled control', { disabled: true }],
  ['missing focus-visible', { focusVisible: false }],
  ['missing indicator', { outlineWidth: '0px' }],
  ['transparent outline', { outlineColor: 'rgba(0, 0, 0, 0)' }],
  ['offscreen target', { rect: { x: 1600, y: 10, width: 80, height: 30 } }],
  ['zero-size target', { rect: { x: 10, y: 10, width: 0, height: 0 } }],
]) test(`focus evidence rejects ${name}`, () => assert.throws(() => assertVisibleFocus({ ...visible, ...patch }, name)))

test('onboarding expected records are independent, complete and leave all other records unchanged', async () => {
  const seed = await loadValidatedSeed()
  const baseline = structuredClone(seed.workspaces)
  const expected = expectedKeyboardOnboarding(seed.workspaces)
  assert.deepEqual(seed.workspaces, baseline)
  assert.deepEqual(expected.cms, baseline.cms)
  assert.deepEqual(expected.crm, baseline.crm)
  assert.equal(expected.hr.workflow.onboarding['employee-002'].receipt, 'MOCK-ONBOARDING-0001')
  assert.equal(expected.hr.workflow.sequence, 2)
})

test('keyboard journey source cannot silently introduce pointer, direct focus or browser-state injection helpers', async () => {
  for (const file of ['keyboard-driver.mjs', 'keyboard-onboarding.mjs', 'keyboard-restore.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\.(?:click|dblclick|tap|fill|check|uncheck|selectOption|setInputFiles|dispatchEvent|addInitScript)\s*\(/, file)
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|clear|removeItem)\s*\(/, file)
    assert.doesNotMatch(source, /\b(?:element|document\.activeElement)\.focus\s*\(/, file)
  }
})
