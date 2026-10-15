import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export const keyboardOnboardingEmail = 'avery.keyboard@fixture.invalid'

/** Handwritten expected records. No application reducer calculates the result. */
export function expectedKeyboardOnboarding(states) {
  const expected = structuredClone(states)
  assert.equal(expected.hr.workflow.sequence, 1)
  assert.equal(expected.hr.selectedEmployee, 'employee-002')
  expected.hr.workflow.profileEmails['employee-002'] = keyboardOnboardingEmail
  expected.hr.workflow.onboarding['employee-002'] = {
    profileReviewed: true,
    jobReviewed: true,
    stage: 'complete',
    tasks: { profile: true, policy: true },
    receipt: 'MOCK-ONBOARDING-0001',
  }
  expected.hr.workflow.employeeStatuses['employee-002'] = 'active'
  expected.hr.workflow.sequence = 2
  const morgan = { status: 'active', department: 'Operations', jobTitle: 'Operations Manager', managerId: null }
  const avery = { status: 'active', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001' }
  const jordan = { status: 'onboarding', department: 'Engineering', jobTitle: 'Software Developer', managerId: 'employee-001' }
  const employee = { role: 'employee', employeeId: 'employee-002' }
  expected.hr.workflow.lifecycle = {
    schemaVersion: 1, simulationDate: null, sequence: 3, selectedTemplateVersion: 'sample-v1',
    instances: [
      { id: 'employment-employee-001-1', employeeId: 'employee-001', startDate: null, endDate: null, initial: morgan, current: { ...morgan }, templateVersion: 'legacy-employee-001', tasks: [{ id: 'intro', title: 'Welcome checklist' }] },
      { id: 'employment-employee-002-1', employeeId: 'employee-002', startDate: null, endDate: null, initial: avery, current: { ...avery }, templateVersion: 'legacy-employee-002', tasks: [{ id: 'profile', title: 'Profile review' }, { id: 'policy', title: 'Read welcome policy' }] },
      { id: 'employment-employee-003-1', employeeId: 'employee-003', startDate: null, endDate: null, initial: jordan, current: { ...jordan }, templateVersion: 'legacy-employee-003', tasks: [{ id: 'profile', title: 'Complete own profile' }] },
    ],
    activeInstances: { 'employee-001': 'employment-employee-001-1', 'employee-002': 'employment-employee-002-1', 'employee-003': 'employment-employee-003-1' },
    events: [{ id: 'lifecycle-2', sequence: 2, kind: 'onboarding-complete', employeeId: 'employee-002', instanceId: 'employment-employee-002-1', effectiveDate: null, actor: employee, reason: 'Sample onboarding confirmed', previous: { ...avery }, proposed: { ...avery } }],
    directoryHistory: [{ id: 'directory-1', sequence: 1, employeeId: 'employee-002', field: 'workEmail', oldValue: 'avery@example.invalid', newValue: keyboardOnboardingEmail, actor: employee, origin: 'direct' }],
    corrections: [], offboardingAssignments: [],
  }
  return expected
}

async function exportedWorkspaces(page, artifactDir, keyboard) {
  const navigation = page.getByRole('navigation', { name: 'Template workspaces', exact: true })
  const directory = navigation.getByRole('link', { name: 'Portal directory', exact: true })
  await keyboard.focus(directory, 'Return to the portal directory')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  const exportButton = page.getByRole('region', { name: 'Combined workspace backup', exact: true }).getByRole('button', { name: 'Export all workspaces', exact: true })
  await keyboard.focus(exportButton, 'Export the completed keyboard onboarding workspace')
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
  const destination = join(artifactDir, 'onboarding-complete-workspaces.json')
  await download.saveAs(destination)
  assert.equal(await download.failure(), null)
  const envelope = JSON.parse(await readFile(destination, 'utf8'))
  assert.equal(envelope.format, 'webappx-mock-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  return envelope.workspaces
}

/** All user interaction is keyboard input. DOM and storage observations below
 * are read-only, and reload is a lifecycle step after the completed journey.
 */
export async function runKeyboardOnboarding({ page, context, origin, artifactDir, seed, keyboard }) {
  const checks = []
  await page.goto(`${origin}/portals`)
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  const auxiliarySaves = (await context.storageState()).origins.find(item => item.origin === origin)?.localStorage ?? []
  assert.equal(auxiliarySaves.some(item => item.name.startsWith('webappx.demo.')), false, 'A fresh keyboard onboarding flow must start without saved mock records')
  const navigation = page.getByRole('navigation', { name: 'Template workspaces', exact: true })
  await keyboard.focus(navigation.getByRole('link', { name: 'People & HR', exact: true }), 'Open HR from the portal directory')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'People workspace', exact: true })).toBeVisible()
  const employeePortal = page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name: 'Employee', exact: true })
  await keyboard.focus(employeePortal, 'Open the synthetic employee portal')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: /^Synthetic employee identity/ })).toHaveValue('employee-002')
  const employeePages = page.getByRole('navigation', { name: 'Employee HR pages', exact: true })
  await keyboard.focus(employeePages.getByRole('link', { name: 'My profile', exact: true }), 'Open Avery’s own profile')
  await page.keyboard.press('Enter')
  const email = page.getByRole('textbox', { name: 'Synthetic work email', exact: true })
  await expect(email).toHaveValue('avery@example.invalid')
  await expect(email).toHaveJSProperty('required', true)
  await keyboard.focus(email, 'Required synthetic work email')
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await expect(email).toBeFocused()
  assert.equal(await email.evaluate(element => element.validity.valueMissing), true, 'The required empty email is rejected by native form validation')
  const invalidStorage = (await context.storageState()).origins.find(item => item.origin === origin)?.localStorage ?? []
  assert.deepEqual(invalidStorage, auxiliarySaves, 'A rejected empty profile must not create a domain save')
  await keyboard.assertFocus(email, 'Required field remains visibly focused after rejected submission')
  await page.keyboard.type(keyboardOnboardingEmail)
  const saveProfile = page.getByRole('button', { name: 'Save sample profile', exact: true })
  await keyboard.focus(saveProfile, 'Save the fictional work email')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Sample profile saved in this session.' })).toBeVisible()
  checks.push('Keyboard navigation opens Avery’s profile, required-field validation preserves state, and a fictional email saves')

  await keyboard.focus(employeePages.getByRole('link', { name: 'My onboarding', exact: true }), 'Open Avery’s onboarding')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Complete sample onboarding · Avery', exact: true })).toBeVisible()
  const profileReview = page.getByRole('button', { name: 'Review sample profile', exact: true })
  const jobReview = page.getByRole('button', { name: 'Review sample job', exact: true })
  const policy = page.getByRole('button', { name: 'Read welcome policy Mark complete', exact: true })
  const summary = page.getByRole('button', { name: 'Review onboarding summary', exact: true })
  const confirm = page.getByRole('button', { name: 'Confirm simulated onboarding', exact: true })
  await expect(summary).toBeDisabled()
  await expect(confirm).toBeDisabled()
  await keyboard.focus(profileReview, 'Review the saved sample profile')
  await page.keyboard.press('Enter')
  await keyboard.assertFocus(jobReview, 'Focus advances from the disabled profile review to the job review')
  await page.keyboard.press('Space')
  await keyboard.assertFocus(policy, 'Focus advances from the disabled job review to the incomplete policy task')
  await page.screenshot({ path: join(artifactDir, 'onboarding-policy-keyboard-focus.png'), fullPage: true })
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Read welcome policy Complete', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await keyboard.assertFocus(summary, 'The final required task advances focus to summary review')
  await page.keyboard.press('Enter')
  await keyboard.assertFocus(confirm, 'Summary review advances focus to confirmation')
  await page.screenshot({ path: join(artifactDir, 'onboarding-confirm-keyboard-focus.png'), fullPage: true })
  await page.keyboard.press('Enter')
  const completion = page.getByRole('status', { name: 'Onboarding completion status', exact: true })
  await expect(completion).toHaveText('Simulated onboarding completed · MOCK-ONBOARDING-0001. Demo directory status is now active.')
  await keyboard.assertFocus(completion, 'Completion keeps visible focus on the receipt status')
  await expect(summary).toBeDisabled()
  await expect(confirm).toBeDisabled()
  await page.screenshot({ path: join(artifactDir, 'onboarding-complete-keyboard-focus.png'), fullPage: true })
  checks.push('Profile, job, required checklist, summary and confirmation complete using Enter/Space with visible focus through disabled-control transitions')

  await page.reload()
  await expect(completion).toHaveText('Simulated onboarding completed · MOCK-ONBOARDING-0001. Demo directory status is now active.')
  const expected = expectedKeyboardOnboarding(seed.workspaces)
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'Keyboard onboarding requires no account cookies')
  const originState = storage.origins.find(item => item.origin === origin)
  assert.ok(originState)
  const domainSaves = originState.localStorage.filter(item => item.name.startsWith('webappx.demo.'))
  assert.deepEqual(domainSaves.map(item => item.name), ['webappx.demo.hr'], 'Onboarding may save only HR')
  assert.deepEqual(JSON.parse(domainSaves[0].value), { schemaVersion: 1, module: 'hr', data: expected.hr })
  assert.deepEqual(originState.localStorage.filter(item => !item.name.startsWith('webappx.demo.')), auxiliarySaves, 'App accessibility preferences remain unchanged')
  assert.deepEqual(await exportedWorkspaces(page, artifactDir, keyboard), expected, 'A real combined download must match all handwritten onboarding changes and unchanged CMS/CRM records')
  checks.push('Completed onboarding survives refresh; full HR save and actual combined export match independent records while CMS/CRM and browser preferences remain unchanged')
  return { checks, expectedReceipt: 'MOCK-ONBOARDING-0001', employeeId: 'employee-002', baselineHash: seed.sha256 }
}
