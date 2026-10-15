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

const datePicker = {
  ...visible, tag: 'DIV', id: 'picker', pseudo: '-webkit-calendar-picker-indicator', focused: true,
  userAgentShadow: true, activeDateHost: true, axFocused: true, axFocusedCount: 1,
  axRole: 'button', axName: 'Show date picker Show date picker',
  rect: { x: 180, y: 18, width: 18, height: 18 },
}
const dateHost = { ...visible, tag: 'INPUT', type: 'date', focusVisible: false, outlineStyle: 'none', rect: { x: 10, y: 10, width: 200, height: 40 }, nativeFocus: datePicker }
test('native date focus uses the actually focused, visibly outlined AX picker inside its active user-agent host', () => {
  assert.doesNotThrow(() => assertVisibleFocus(dateHost, 'Native picker'))
})
for (const [name, patch] of [
  ['unverified user-agent provenance', { userAgentShadow: false }],
  ['different active host', { activeDateHost: false }],
  ['ambiguous AX focus', { axFocusedCount: 2 }],
  ['unfocused AX control', { axFocused: false }],
  ['wrong AX role', { axRole: 'textbox' }],
  ['unknown native control', { axName: 'Other native control' }],
  ['wrong native pseudo', { pseudo: '-webkit-datetime-edit-month-field' }],
  ['unfocused native part', { focused: false }],
  ['hidden native part', { hidden: true }],
  ['disabled native part', { disabled: true }],
  ['native part without focus-visible', { focusVisible: false }],
  ['native part without a ring', { outlineStyle: 'none', boxShadow: 'none' }],
  ['native part with transparent outline', { outlineColor: 'rgba(0, 0, 0, 0)' }],
  ['native part outside its host', { rect: { x: 220, y: 18, width: 18, height: 18 } }],
]) test(`native date focus rejects ${name}`, () => assert.throws(() => assertVisibleFocus({ ...dateHost, nativeFocus: { ...datePicker, ...patch } }, name)))
test('native picker evidence cannot rescue a different host type', () => {
  assert.throws(() => assertVisibleFocus({ ...dateHost, type: 'text' }, 'Wrong host'))
})

test('onboarding expected records are independent, complete and leave all other records unchanged', async () => {
  const seed = await loadValidatedSeed()
  const baseline = structuredClone(seed.workspaces)
  const expected = expectedKeyboardOnboarding(seed.workspaces)
  assert.deepEqual(seed.workspaces, baseline)
  assert.deepEqual(expected.cms, baseline.cms)
  assert.deepEqual(expected.crm, baseline.crm)
  assert.equal(expected.hr.workflow.onboarding['employee-002'].receipt, 'MOCK-ONBOARDING-0001')
  assert.equal(expected.hr.workflow.sequence, 2)
  assert.equal(expected.hr.workflow.lifecycle.simulationDate, null)
  assert.equal(expected.hr.workflow.lifecycle.sequence, 3)
  assert.deepEqual(expected.hr.workflow.lifecycle.directoryHistory, [{ id: 'directory-1', sequence: 1, employeeId: 'employee-002', field: 'workEmail', oldValue: 'avery@example.invalid', newValue: 'avery.keyboard@fixture.invalid', actor: { role: 'employee', employeeId: 'employee-002' }, origin: 'direct' }])
  assert.equal(expected.hr.workflow.lifecycle.events.length, 1)
  assert.deepEqual(Object.fromEntries(['id', 'sequence', 'kind', 'employeeId', 'instanceId', 'effectiveDate', 'reason'].map(key => [key, expected.hr.workflow.lifecycle.events[0][key]])), { id: 'lifecycle-2', sequence: 2, kind: 'onboarding-complete', employeeId: 'employee-002', instanceId: 'employment-employee-002-1', effectiveDate: null, reason: 'Sample onboarding confirmed' })
  assert.deepEqual(expected.hr.workflow.lifecycle.instances.map(instance => [instance.id, instance.startDate, instance.endDate, instance.templateVersion]), [['employment-employee-001-1', null, null, 'legacy-employee-001'], ['employment-employee-002-1', null, null, 'legacy-employee-002'], ['employment-employee-003-1', null, null, 'legacy-employee-003']])
})

test('keyboard journey source cannot silently introduce pointer, direct focus or browser-state injection helpers', async () => {
  for (const file of ['keyboard-driver.mjs', 'keyboard-onboarding.mjs', 'keyboard-restore.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\.(?:click|dblclick|tap|fill|check|uncheck|selectOption|setInputFiles|dispatchEvent|addInitScript)\s*\(/, file)
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|clear|removeItem)\s*\(/, file)
    assert.doesNotMatch(source, /\b(?:element|document\.activeElement)\.focus\s*\(/, file)
  }
})
