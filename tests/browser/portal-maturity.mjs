import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'

const nav = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, name) => nav(page).getByRole('link', { name, exact: true }).click()
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const backupRegion = (page, module) => page.getByRole('region', { name: `${module} workspace backup`, exact: true })
const upload = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })

const lastDownloadClick = new WeakMap()
async function download(page, control, artifactDir, name) {
  // Keep repeated real exports below the browser's burst download limit.
  const remaining = 150 - (Date.now() - (lastDownloadClick.get(page) ?? 0))
  if (remaining > 0) await delay(remaining)
  lastDownloadClick.set(page, Date.now())
  const waiting = page.waitForEvent('download')
  await control.click()
  const result = await waiting
  const path = join(artifactDir, `${name}.json`)
  await result.saveAs(path)
  assert.equal(await result.failure(), null, 'The real JSON download must finish')
  return JSON.parse(await readFile(path, 'utf8'))
}
async function snapshot(page, artifactDir, name) {
  await open(page, 'Portal directory')
  const envelope = await download(page, button(page.getByRole('region', { name: 'Combined workspace backup', exact: true }), 'Export all workspaces'), artifactDir, name)
  assert.deepEqual(Object.keys(envelope).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(envelope.format, 'webappx-mock-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  assert.deepEqual(Object.keys(envelope.workspaces).sort(), ['cms', 'crm', 'hr'])
  return envelope.workspaces
}
async function slots(context, origin) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [])
  assert.ok(storage.origins.every(item => item.origin === origin))
  return Object.fromEntries((storage.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]).sort(([a], [b]) => a.localeCompare(b)))
}
function updateCmsExpected(states, values) {
  const expected = structuredClone(states)
  Object.assign(expected.cms.entries.find(entry => entry.id === 'cms-article-001'), values, { revision: 2, status: 'draft', approval: null, feedback: '' })
  expected.cms.sequence = 1
  expected.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  return expected
}

const hrPortal = (page, name) => page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name, exact: true }).click()
const timeEntry = (page, id) => page.getByRole('article', { name: `Time entry ${id}`, exact: true })
async function employeeTime(page, id) {
  await open(page, 'People & HR'); await hrPortal(page, 'Employee')
  await page.getByRole('combobox', { name: /^Synthetic employee identity/ }).selectOption(id)
  await page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My time', exact: true }).click()
}
async function managerTime(page) {
  await open(page, 'People & HR'); await hrPortal(page, 'Manager')
  await page.getByRole('navigation', { name: 'Manager HR pages', exact: true }).getByRole('link', { name: 'Team time', exact: true }).click()
}
async function adminPage(page, name) {
  await open(page, 'People & HR'); await hrPortal(page, 'Management')
  await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name, exact: true }).click()
}
async function period(page) {
  await page.getByLabel('Sample period start', { exact: true }).fill('2026-10-01')
  await page.getByLabel('Sample period end', { exact: true }).fill('2026-10-15')
}
async function addTime(page, date, hours) {
  await page.getByLabel('Work date', { exact: true }).fill(date)
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill(String(hours))
  await button(page, 'Add sample time').click()
}
async function setRate(page, employee, amount, date) {
  await page.getByRole('combobox', { name: /^Rate employee/ }).selectOption(employee)
  await page.getByLabel('Fictional hourly rate (dollars)', { exact: true }).fill(String(amount))
  await page.getByLabel('Rate effective date', { exact: true }).fill(date)
  await button(page, 'Add sample rate').click()
}
const numberValue = (page, label) => page.getByText(label, { exact: true }).locator('..').locator('dd')
const eligibilityRow = (page, id) => page.getByRole('table', { name: 'Time-entry eligibility', exact: true }).getByRole('row').filter({ has: page.getByRole('cell', { name: new RegExp(`^${id} ·`) }) })

// Literal arithmetic: Avery (7.5 + 1.25) × $25 = $218.75, withholding
// $43.75, net $175; Morgan 2 × $40 = $80, withholding $16, net $64.
const maturePayroll = {
  stage: 'submitted', period: { start: '2026-10-01', end: '2026-10-15' },
  inputs: [
    { entryId: 'time-001', employeeId: 'employee-002', date: '2026-10-09', hours: 7.5, rateCents: 2500, rateEffectiveFrom: '2026-10-01' },
    { entryId: 'MOCK-TIME-0001', employeeId: 'employee-001', date: '2026-10-10', hours: 2, rateCents: 4000, rateEffectiveFrom: '2026-10-01' },
    { entryId: 'MOCK-TIME-0003', employeeId: 'employee-002', date: '2026-10-14', hours: 1.25, rateCents: 2500, rateEffectiveFrom: '2026-10-01' },
  ],
  benefitInputs: [], employeeTotals: [
    { employeeId: 'employee-002', hours: 8.75, grossCents: 21875, illustrativeWithholdingCents: 4375, benefitDeductionCents: 0, netCents: 17500 },
    { employeeId: 'employee-001', hours: 2, grossCents: 8000, illustrativeWithholdingCents: 1600, benefitDeductionCents: 0, netCents: 6400 },
  ],
  hours: 10.75, grossCents: 29875, illustrativeWithholdingCents: 5975, benefitDeductionCents: 0, netCents: 23900, receipt: 'MOCK-PAYROLL-0004',
}

async function hrJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-00-old-named-seed'), seed.workspaces)
  const expected = structuredClone(seed.workspaces)
  const workflow = expected.hr.workflow
  await managerTime(page)
  await timeEntry(page, 'time-001').getByLabel('Return reason for time-001', { exact: true }).fill('Correct the fictional hours before approval.')
  await button(timeEntry(page, 'time-001'), 'Return sample time').click()
  Object.assign(workflow.timeEntries[0], { status: 'draft', returnReason: 'Correct the fictional hours before approval.', returnedBy: 'employee-001' })
  await expect(timeEntry(page, 'time-001')).toContainText('Returned by Morgan Example: Correct the fictional hours before approval.')
  await adminPage(page, 'Payroll workspace')
  await expect(button(page, 'Prepare sample payroll')).toBeDisabled()
  await page.getByLabel('Sample period start', { exact: true }).fill('2026-10-16')
  await page.getByLabel('Sample period end', { exact: true }).fill('2026-10-01')
  await expect(button(page, 'Prepare sample payroll')).toBeDisabled()
  await period(page)
  await expect(eligibilityRow(page, 'time-001')).toContainText('Excluded: Returned draft: Correct the fictional hours before approval.')
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-01-returned-time-excluded'), expected)
  checks.push('WX-0156: a scoped manager returns submitted seed time with a visible reason; the returned draft is excluded from payroll')
  await employeeTime(page, 'employee-002')
  await button(timeEntry(page, 'time-001'), 'Edit draft').click()
  await timeEntry(page, 'time-001').getByLabel('Hours for time-001', { exact: true }).fill('7.5')
  await button(timeEntry(page, 'time-001'), 'Save draft changes').click()
  workflow.timeEntries[0].hours = 7.5
  await button(page, 'Submit own sample timesheet').click(); workflow.timeEntries[0].status = 'submitted'
  await expect(button(timeEntry(page, 'time-001'), 'Edit draft')).toHaveCount(0)
  await managerTime(page); await button(timeEntry(page, 'time-001'), 'Approve sample time').click(); workflow.timeEntries[0].status = 'approved'
  await employeeTime(page, 'employee-001'); expected.hr.selectedEmployee = 'employee-001'
  await addTime(page, '2026-10-10', 2); await addTime(page, '2026-10-20', 3)
  workflow.timeEntries.push(
    { id: 'MOCK-TIME-0001', employeeId: 'employee-001', date: '2026-10-10', hours: 2, source: 'manual', status: 'submitted' },
    { id: 'MOCK-TIME-0002', employeeId: 'employee-001', date: '2026-10-20', hours: 3, source: 'manual', status: 'submitted' },
  ); workflow.sequence = 3
  await button(page, 'Submit own sample timesheet').click()
  await adminPage(page, 'Time tracking')
  for (const id of ['MOCK-TIME-0001', 'MOCK-TIME-0002']) { await button(timeEntry(page, id), 'Approve sample time').click(); workflow.timeEntries.find(entry => entry.id === id).status = 'approved' }
  await adminPage(page, 'Payroll workspace'); await period(page)
  await expect(eligibilityRow(page, 'time-001')).toContainText('No explicit fictional hourly rate is configured')
  await button(page, 'Prepare sample payroll').click()
  await expect(page.getByRole('alert')).toContainText('Configure an explicit fictional hourly rate')
  await setRate(page, 'employee-002', 25, '2026-10-01'); await setRate(page, 'employee-001', 40, '2026-10-01')
  workflow.sampleRates = { 'employee-002': [{ effectiveFrom: '2026-10-01', hourlyRateCents: 2500 }], 'employee-001': [{ effectiveFrom: '2026-10-01', hourlyRateCents: 4000 }] }
  await expect(eligibilityRow(page, 'time-001')).toContainText('Included: approved, unpaid and active with an explicit rate.')
  await expect(eligibilityRow(page, 'time-002')).toContainText('Time is draft, not approved.')
  await expect(eligibilityRow(page, 'MOCK-TIME-0002')).toContainText('Work date is outside the selected period.')
  await button(page, 'Prepare sample payroll').click()
  workflow.payroll = { stage: 'prepared', period: { start: '2026-10-01', end: '2026-10-15' }, inputs: structuredClone(maturePayroll.inputs.slice(0, 2)), benefitInputs: [], employeeTotals: [], hours: 9.5, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 }
  await expect(page.getByRole('listitem').filter({ hasText: /^time-001 ·/ })).toHaveText('time-001 · Avery Sample · 2026-10-09 · 7.5 hours × $25.00/hour (fictional) · effective 2026-10-01')
  await expect(page.getByRole('listitem').filter({ hasText: /^MOCK-TIME-0001 ·/ })).toHaveText('MOCK-TIME-0001 · Morgan Example · 2026-10-10 · 2 hours × $40.00/hour (fictional) · effective 2026-10-01')
  await button(page, 'Calculate fictional totals').click()
  Object.assign(workflow.payroll, { stage: 'calculated', grossCents: 26750, illustrativeWithholdingCents: 5350, netCents: 21400, employeeTotals: [
    { employeeId: 'employee-002', hours: 7.5, grossCents: 18750, illustrativeWithholdingCents: 3750, benefitDeductionCents: 0, netCents: 15000 }, maturePayroll.employeeTotals[1],
  ] })
  await expect(numberValue(page, 'Fictional gross')).toHaveText('$267.50')
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-02-explicit-period-rate-snapshot'), expected)
  checks.push('WX-0151/WX-0152/WX-0155: invalid periods disable preparation, absent rates refuse, and selected-period approved unpaid entries freeze explicit employee rates beside hours while the eligibility table explains excluded draft and out-of-period time')
  await employeeTime(page, 'employee-002'); expected.hr.selectedEmployee = 'employee-002'
  await addTime(page, '2026-10-14', 1.25)
  await button(page, 'Submit own sample timesheet').click()
  workflow.timeEntries.push({ id: 'MOCK-TIME-0003', employeeId: 'employee-002', date: '2026-10-14', hours: 1.25, source: 'manual', status: 'submitted' }); workflow.sequence = 4
  await managerTime(page); await button(timeEntry(page, 'MOCK-TIME-0003'), 'Approve sample time').click(); workflow.timeEntries.at(-1).status = 'approved'
  await adminPage(page, 'Payroll workspace')
  await expect(page.getByRole('alert')).toContainText('Payroll preparation is stale.')
  for (const label of ['Calculate fictional totals', 'Review simulated payroll', 'Simulate payroll submission']) await expect(button(page, label)).toBeDisabled()
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-03-stale-approved-input'), expected, 'A changed approved input must preserve the frozen old preparation until explicit reprepare')
  await adminPage(page, 'Payroll workspace')
  await button(page, 'Reprepare sample payroll').click(); await button(page, 'Calculate fictional totals').click()
  await expect(numberValue(page, 'Fictional gross')).toHaveText('$298.75')
  await expect(numberValue(page, 'Illustrative withholding')).toHaveText('$59.75')
  await expect(numberValue(page, 'Simulated net')).toHaveText('$239.00')
  await button(page, 'Review simulated payroll').click(); await button(page, 'Simulate payroll submission').click()
  workflow.payroll = structuredClone(maturePayroll); workflow.payrollHistory = [structuredClone(maturePayroll)]; workflow.sequence = 5
  for (const id of ['time-001', 'MOCK-TIME-0001', 'MOCK-TIME-0003']) workflow.timeEntries.find(entry => entry.id === id).payrollReceipt = maturePayroll.receipt
  await expect(eligibilityRow(page, 'time-001')).toContainText('Already consumed by MOCK-PAYROLL-0004.')
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-04-reprepared-submitted'), expected)
  checks.push('WX-0154: newly approved time marks the existing snapshot stale and disables calculate/review/submit until intentional reprepare; the final frozen receipt independently totals 10.75 hours, $298.75 gross and $239 net')
  await adminPage(page, 'Payroll workspace'); await setRate(page, 'employee-002', 35, '2026-11-01')
  workflow.sampleRates['employee-002'].push({ effectiveFrom: '2026-11-01', hourlyRateCents: 3500 })
  await expect(page.getByRole('region', { name: 'Fictional rate timeline', exact: true })).toContainText('2026-11-01 · $35.00/hour (fictional)')
  const frozenReceipt = page.getByRole('listitem').filter({ hasText: /^MOCK-PAYROLL-0004 ·/ })
  await expect(frozenReceipt).toContainText('Avery Sample · 7.5 hours × $25.00/hour (fictional)')
  await expect(frozenReceipt).toContainText('Morgan Example · 2 hours × $40.00/hour (fictional)')
  await expect(frozenReceipt).not.toContainText('$35.00/hour')
  const future = await snapshot(page, artifactDir, 'hr-05-future-rate-frozen-receipt')
  assert.deepEqual(future, expected)
  assert.deepEqual(future.hr.workflow.payrollHistory, [maturePayroll])
  checks.push('WX-0153: an explicit future $35 rate enters the timeline without changing any field in the submitted October receipt or its frozen historical inputs')
  await employeeTime(page, 'employee-002')
  await expect(button(timeEntry(page, 'time-001'), 'Edit draft')).toHaveCount(0)
  await expect(button(timeEntry(page, 'time-001'), 'Delete draft')).toHaveCount(0)
  await addTime(page, '2026-10-12', 1)
  workflow.timeEntries.push({ id: 'MOCK-TIME-0005', employeeId: 'employee-002', date: '2026-10-12', hours: 1, source: 'manual', status: 'draft' }); workflow.sequence = 6
  const withDraft = await slots(context, origin)
  await button(timeEntry(page, 'MOCK-TIME-0005'), 'Delete draft').click()
  await button(timeEntry(page, 'MOCK-TIME-0005'), 'Keep draft').click()
  assert.deepEqual(await slots(context, origin), withDraft, 'Opening/canceling deletion must preserve the entire saved envelope')
  await button(timeEntry(page, 'MOCK-TIME-0005'), 'Delete draft').click()
  await button(timeEntry(page, 'MOCK-TIME-0005'), 'Confirm delete draft').click()
  workflow.timeEntries = workflow.timeEntries.filter(entry => entry.id !== 'MOCK-TIME-0005')
  await expect(timeEntry(page, 'MOCK-TIME-0005')).toHaveCount(0)
  await page.reload()
  assert.deepEqual(await snapshot(page, artifactDir, 'hr-06-confirmed-deletion-refreshed'), expected)
  const saved = await slots(context, origin)
  assert.deepEqual(JSON.parse(saved['webappx.demo.hr']), { schemaVersion: 1, module: 'hr', data: expected.hr })
  assert.deepEqual(Object.keys(saved).sort(), ['sfwa-wtl:accessibility-preferences', 'webappx.demo.hr'])
  checks.push('WX-0157/WX-0158: an owner edits only an unpaid draft; submitted/paid rows expose no edit/delete controls, and confirmed draft deletion preserves every approved/consumed entry and frozen receipt after reload')
  return { expectedPayroll: maturePayroll, finalWorkflow: workflow, literalPeriod: maturePayroll.period, ratesCents: { avery: 2500, morgan: 4000, futureAvery: 3500 } }
}

async function cmsJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  assert.deepEqual(await snapshot(page, artifactDir, 'cms-00-old-named-seed'), seed.workspaces)
  const originalSlots = await slots(context, origin)
  await open(page, 'Content management')
  for (const prefix of ['edit', 'create']) {
    await page.locator(`#${prefix}-title`).fill('x')
    await page.locator(`#${prefix}-slug`).fill('BAD SLUG!')
    await page.locator(`#${prefix}-body`).fill('short')
    await button(page, prefix === 'edit' ? 'Save draft revision' : 'Create draft').click()
    const summary = page.getByRole('alert', { name: prefix === 'edit' ? 'Edit draft validation' : 'Create draft validation', exact: true })
    for (const message of ['The title must contain 3–100 characters.', 'Use a slug of up to 80 lowercase letters, numbers and single hyphens.', 'The plain-text body must contain 10–8000 characters.']) await expect(summary).toContainText(message)
    await expect(summary.getByRole('listitem')).toHaveCount(3)
    await expect(page.locator(`#${prefix}-title`)).toBeFocused()
  }
  assert.deepEqual(await slots(context, origin), originalSlots, 'Invalid edit/create submissions must not write any workspace save')
  checks.push('WX-0280: both rendered CMS forms list all three independent field failures and focus their first invalid title control without a save')
  const content = { title: 'Maturity editorial draft', slug: 'maturity-editorial-draft', body: 'This fictional saved draft is the clean baseline for the entry-switch acceptance journey.' }
  for (const [key, value] of Object.entries(content)) await page.locator(`#edit-${key}`).fill(value)
  await button(page, 'Save draft revision').click()
  const expected = updateCmsExpected(seed.workspaces, content)
  const choose = title => page.getByRole('button', { name: new RegExp(`^${title}`) }).click()
  await choose('Welcome to the sample studio')
  await expect(page.getByRole('region', { name: 'Unsaved CMS draft', exact: true })).toHaveCount(0)
  await expect(page.locator('#edit-title')).toHaveValue('Welcome to the sample studio')
  await choose(content.title)
  await page.locator('#edit-title').fill('Unsaved maturity buffer')
  const saved = await slots(context, origin)
  await choose('Welcome to the sample studio')
  const prompt = page.getByRole('region', { name: 'Unsaved CMS draft', exact: true })
  await expect(prompt.getByRole('heading', { name: 'Discard unsaved changes?', exact: true })).toBeVisible()
  await button(prompt, 'Keep editing').click()
  await expect(page.locator('#edit-title')).toHaveValue('Unsaved maturity buffer')
  assert.deepEqual(await slots(context, origin), saved)
  await choose('Welcome to the sample studio')
  await button(prompt, 'Discard changes and switch').click()
  await expect(page.locator('#edit-title')).toHaveValue('Welcome to the sample studio')
  await choose(content.title)
  await expect(page.locator('#edit-title')).toHaveValue(content.title)
  assert.deepEqual(await slots(context, origin), saved, 'Keep/discard may change only the ephemeral editor, never saved records')
  assert.deepEqual(await snapshot(page, artifactDir, 'cms-01-clean-baseline-dirty-decisions'), expected)
  checks.push('WX-0282: a successful save is a clean baseline; keep-editing retains the unsaved buffer and discard switches without changing complete saved records')
  return { invalidFields: 3, forms: 2, savedReceipt: 'MOCK-CMS-0001', expectedCms: expected.cms }
}

async function crmJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/portals`)
  assert.deepEqual(await snapshot(page, artifactDir, 'crm-00-old-named-seed'), seed.workspaces)
  await open(page, 'Customer relationships')
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByLabel('Lead name', { exact: true }).fill('Maturity Sentinel')
  await page.getByLabel('Lead email', { exact: true }).fill('maturity-sentinel@fixture.invalid')
  await page.getByLabel('Lead company', { exact: true }).fill('Maturity Fictional Studio')
  await button(page, 'Create sample lead').click()
  const expected = structuredClone(seed.workspaces)
  expected.crm.leads.push({ id: 'lead-0001', name: 'Maturity Sentinel', email: 'maturity-sentinel@fixture.invalid', companyName: 'Maturity Fictional Studio', ownerId: 'crm-owner', status: 'new' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: 'Created sample lead Maturity Sentinel.' })
  expected.crm.sequence = 2
  const saved = await slots(context, origin)
  assert.deepEqual(JSON.parse(saved['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm })
  const region = backupRegion(page, 'CRM')
  const variants = [
    ['lead-enum-array', state => { state.leads.find(row => row.id === 'lead-robin').status = ['qualified'] }],
    ['opportunity-enum-array', state => { state.opportunities.find(row => row.id === 'opportunity-harbor').stage = ['discovery'] }],
    ['task-enum-array', state => { state.tasks.find(row => row.id === 'task-harbor').status = ['open'] }],
    ['unknown-enum', state => { state.leads[0].status = 'unknown' }],
    ['unknown-notes', state => { state.contacts[0].notes = 'Unsupported fictional profile note' }],
    ['oversized-notes', state => { state.contacts[0].notes = 'x'.repeat(10001) }],
    ['missing-company-edge', state => { state.contacts[0].companyId = 'missing-company' }],
    ['cross-company-contact-edge', state => { state.opportunities.find(row => row.id === 'opportunity-harbor').contactId = 'contact-jordan' }],
    ['missing-opportunity-edge', state => { state.tasks[0].opportunityId = 'missing-opportunity' }],
  ]
  for (const [name, mutate] of variants) {
    // A fresh real download both proves the complete sentinel and replaces the
    // prior error feedback, so the next refusal must be a new upload result.
    const original = await download(page, button(region, 'Export workspace'), artifactDir, `crm-before-${name}`)
    assert.deepEqual(original.data, expected.crm)
    const negative = structuredClone(original)
    mutate(negative.data)
    await writeFile(join(artifactDir, `negative-crm-${name}.json`), JSON.stringify(negative, null, 2) + '\n')
    await region.getByLabel('CRM backup JSON file', { exact: true }).setInputFiles(upload(`negative-crm-${name}.json`, negative))
    await expect(region.getByRole('alert')).toContainText('incomplete or incompatible')
    await expect(button(region, 'Replace CRM workspace')).toHaveCount(0)
    assert.deepEqual(await slots(context, origin), saved, `${name}: every saved slot must remain byte-identical`)
  }
  assert.deepEqual((await download(page, button(region, 'Export workspace'), artifactDir, 'crm-after-negative-imports')).data, expected.crm)
  assert.deepEqual(await snapshot(page, artifactDir, 'crm-01-all-negative-imports-preserved'), expected)
  checks.push('WX-0397: nine clearly labeled negative CRM uploads reject malformed string enums, unsupported/oversized notes and invalid graph edges before replacing complete current records or any saved bytes')
  return { rejectedFixtures: variants.map(([name]) => name), preservedReceipt: 'MOCK-CRM-0001', expectedCrm: expected.crm }
}

// Literal counts reviewed against the named seed, not calculated by the app's
// inspection/difference functions. Zero collections are part of the contract.
const capturedCounts = {
  HR: {
    'workflow.onboarding': 3, 'workflow.onboarding.tasks': 4, 'workflow.profileEmails': 3, 'workflow.employeeStatuses': 3,
    'workflow.timeEntries': 2, 'workflow.benefitElections': 0, 'workflow.payroll': 1, 'workflow.payrollHistory': 0,
    'workflow.payroll.inputs': 0, 'workflow.payroll.benefitInputs': 0, 'workflow.payroll.employeeTotals': 0,
    'workflow.payrollHistory.inputs': 0, 'workflow.payrollHistory.benefitInputs': 0, 'workflow.payrollHistory.employeeTotals': 0,
    'workflow.sampleRateTimelines': 0, 'workflow.sampleRates': 0, 'operations.ptoRequests': 1, 'operations.balances': 3,
    'operations.records.tasks': 3, 'operations.records.policies': 1, 'operations.records.training': 2,
    'operations.records.assets': 2, 'operations.records.documents': 3, 'operations.activity': 0,
    'serviceDesk.requests': 1, 'serviceDesk.requests.activity': 0, 'recruiting.jobs': 1, 'recruiting.jobs.activity': 0,
    'recruiting.candidates': 2, 'recruiting.candidates.activity': 0, 'recruiting.hiredEmployees': 0,
    'recruiting.hiredEmployees.onboarding': 0, 'performance.goals': 1, 'performance.goals.activity': 0,
    'performance.reviews': 2, 'performance.reviews.activity': 0, 'surveys.surveys': 1,
    'surveys.surveys.audienceIds': 3, 'surveys.surveys.questions': 1, 'surveys.surveys.responses': 0,
    'surveys.surveys.activity': 0, 'preview.completed': 0, 'preview.acknowledgements': 0, 'preview.selections': 2, 'metadata.sequences': 6,
  },
  CMS: { entries: 2, activity: 0, 'entries.approval': 1, 'entries.published': 1, 'metadata.sequences': 1 },
  CRM: { companies: 2, contacts: 2, leads: 11, opportunities: 2, tasks: 1, activity: 9, 'metadata.sequences': 1 },
}
async function assertDifferences(page, title, expected) {
  const region = page.getByRole('region', { name: title, exact: true })
  await expect(region).toBeVisible()
  await expect(region.getByRole('alert')).toHaveCount(0)
  for (const [module, counts] of Object.entries(expected)) for (const [kind, value] of Object.entries(counts)) {
    await expect(region.locator(`output[aria-label="${module} ${kind} primary records"]`)).toHaveText(String(value))
  }
  return region
}
const historyRegion = page => page.getByRole('region', { name: 'Restore points', exact: true })
const historyKey = 'webappx.demo.restore-points'
async function historyValue(context, origin) { return JSON.parse((await slots(context, origin))[historyKey]) }
function pointRow(page, point) {
  return historyRegion(page).getByRole('listitem').filter({ has: page.getByRole('form', { name: `Rename restore point ${point.id}`, exact: true }) })
}
function withoutHistory(values) { return Object.fromEntries(Object.entries(values).filter(([key]) => key !== historyKey)) }
async function manualPoint(page, context, origin, name, modules) {
  const form = page.getByRole('form', { name: 'Create named restore point', exact: true })
  await form.getByLabel('Restore point name', { exact: true }).fill(name)
  for (const module of modules) await form.getByRole('checkbox', { name: `Capture ${module}`, exact: true }).check()
  await expect(page.getByRole('region', { name: 'Named restore point storage preview', exact: true })).toBeVisible()
  await button(form, 'Create named restore point').click()
  const point = (await historyValue(context, origin)).points.find(row => row.label === name)
  assert.ok(point); assert.equal(point.kind, 'manual')
  assert.match(point.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  return point
}
async function createInspectLead(page, expected, number) {
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByLabel('Lead name', { exact: true }).fill(`Inspect Lead ${number}`)
  await page.getByLabel('Lead email', { exact: true }).fill(`inspect-${number}@fixture.invalid`)
  await page.getByLabel('Lead company', { exact: true }).fill(`Inspect Fiction ${number}`)
  await button(page, 'Create sample lead').click()
  const suffix = String(number).padStart(4, '0')
  expected.crm.leads.push({ id: `lead-${suffix}`, name: `Inspect Lead ${number}`, email: `inspect-${number}@fixture.invalid`, companyName: `Inspect Fiction ${number}`, ownerId: 'crm-owner', status: 'new' })
  expected.crm.activity.unshift({ receipt: `MOCK-CRM-${suffix}`, ownerId: 'crm-owner', action: 'create-lead', description: `Created sample lead Inspect Lead ${number}.` })
  expected.crm.sequence = number + 1
}

async function historyJourney({ page, context, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/hr/demo/employee/time`)
  await expect(page.getByRole('heading', { name: 'Sample timesheet journey', exact: true })).toBeVisible()
  await open(page, 'Portal directory')
  await expect(nav(page).getByRole('link', { name: 'People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/time')
  await expect(page.getByRole('link', { name: 'Open People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/time')
  await page.getByRole('link', { name: 'Open People & HR', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/hr/demo/employee/time`)
  // Approved negative navigation probe: the History API drives the actual
  // mounted router, without altering model state or any browser save.
  await page.evaluate(() => { history.pushState({}, '', '/hr/demo/employee/not-real'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'This HR demo page is unavailable.', exact: true })).toBeVisible()
  await open(page, 'Portal directory')
  await expect(nav(page).getByRole('link', { name: 'People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/time')
  await open(page, 'People & HR')
  await expect(page).toHaveURL(`${origin}/hr/demo/employee/time`)
  await expect(page.getByRole('heading', { name: 'Sample timesheet journey', exact: true })).toBeVisible()
  checks.push('WX-0056: real directory/card/nav links restore the last supported HR subsection; a labeled History.pushState/popstate unsupported-route probe renders the unavailable state and cannot replace that remembered destination')
  assert.deepEqual(await snapshot(page, artifactDir, 'history-00-old-named-seed'), seed.workspaces)
  const baselineFile = JSON.parse(await readFile(join(artifactDir, 'history-00-old-named-seed.json'), 'utf8'))
  const combined = page.getByRole('region', { name: 'Combined workspace backup', exact: true })
  // The actual unchanged v1 download produces an unlabeled automatic point,
  // exercising existing history shape before adding optional label metadata.
  await combined.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('actual-old-named-seed.json', baselineFile))
  await page.getByRole('region', { name: 'Selective restore preview', exact: true }).getByRole('checkbox', { name: /^Restore CMS/ }).check()
  await button(page.getByRole('region', { name: 'Selective restore preview', exact: true }), 'Restore selected workspaces').click()
  const unlabeled = (await historyValue(context, origin)).points[0]
  assert.equal(unlabeled.kind, 'restore'); assert.equal(Object.hasOwn(unlabeled, 'label'), false)
  assert.deepEqual(unlabeled.modules, ['cms']); assert.deepEqual(unlabeled.states, { cms: seed.workspaces.cms })
  const beforeRename = await slots(context, origin)
  const initialHistory = await historyValue(context, origin)
  const row = pointRow(page, unlabeled)
  await row.getByLabel('Point label', { exact: true }).fill('Reviewed CMS checkpoint')
  await button(row, 'Save point label').click()
  const renamed = { ...unlabeled, label: 'Reviewed CMS checkpoint' }
  assert.deepEqual((await historyValue(context, origin)).points, initialHistory.points.map(point => point.id === unlabeled.id ? renamed : point))
  assert.deepEqual(withoutHistory(await slots(context, origin)), withoutHistory(beforeRename))
  checks.push('WX-0453: labeling an unlabeled automatic v1 point changes only its optional label, preserving ID, timestamp, kind, scope, complete captured payload and history order with no workspace-save write')
  const beforeManual = await slots(context, origin)
  const selectedPoint = await manualPoint(page, context, origin, 'Selected HR and CMS checkpoint', ['HR', 'CMS'])
  assert.deepEqual(selectedPoint.modules, ['hr', 'cms'])
  assert.deepEqual(selectedPoint.states, { hr: seed.workspaces.hr, cms: seed.workspaces.cms })
  assert.deepEqual(withoutHistory(await slots(context, origin)), withoutHistory(beforeManual))
  assert.deepEqual(await snapshot(page, artifactDir, 'history-01-manual-selected-no-domain-writes'), seed.workspaces)
  checks.push('WX-0454: a named selected HR+CMS point captures exactly those complete live states while every existing workspace-save byte stays unchanged')

  const captured = structuredClone(seed.workspaces)
  await open(page, 'Customer relationships')
  for (let number = 1; number <= 9; number += 1) await createInspectLead(page, captured, number)
  assert.deepEqual(await snapshot(page, artifactDir, 'history-02-captured-all-collections'), captured)
  const beforeAllCapture = await slots(context, origin)
  const allPoint = await manualPoint(page, context, origin, 'All collection checkpoint', ['HR', 'CMS', 'CRM'])
  assert.deepEqual(allPoint.modules, ['hr', 'cms', 'crm']); assert.deepEqual(allPoint.states, captured)
  assert.deepEqual(withoutHistory(await slots(context, origin)), withoutHistory(beforeAllCapture))
  const beforeInspection = await slots(context, origin)
  await button(pointRow(page, allPoint), 'Inspect captured records').click()
  const inspection = page.getByRole('region', { name: 'Captured restore-point records', exact: true })
  await expect(inspection.getByRole('alert')).toHaveCount(0)
  for (const [module, values] of Object.entries(capturedCounts)) {
    const group = inspection.getByRole('group', { name: `${module} captured collection counts`, exact: true })
    const observed = {}
    for (const item of await group.locator('tr[data-collection]').all()) {
      const key = await item.getAttribute('data-collection')
      observed[key] = Number(await item.locator(`output[aria-label="${module} ${key} count"]`).innerText())
      assert.ok(await item.locator('code').count() <= 8, 'Each displayed identifier list must remain bounded')
    }
    assert.deepEqual(observed, values, `${module}: every primary, nested and metadata collection including zeros must have its literal captured count`)
    await expect(group.locator(`output[aria-label="${module} primary record count"]`)).toHaveText(String({ HR: 35, CMS: 2, CRM: 27 }[module]))
  }
  const leadRow = inspection.getByRole('group', { name: 'CRM captured collection counts', exact: true }).locator('tr[data-collection="leads"]')
  assert.deepEqual(await leadRow.locator('code').allInnerTexts(), ['lead-0001', 'lead-0002', 'lead-0003', 'lead-0004', 'lead-0005', 'lead-0006', 'lead-0007', 'lead-0008'])
  await expect(leadRow).toContainText('3 more identifiers omitted')
  for (const hidden of ['morgan@example.invalid', 'Inspect Lead 1', 'inspect-1@fixture.invalid', seed.workspaces.cms.entries[0].body]) await expect(inspection).not.toContainText(hidden)
  assert.deepEqual(await slots(context, origin), beforeInspection, 'Opening complete captured inspection must not write saves or history')
  await page.screenshot({ path: join(artifactDir, 'history-03-complete-bounded-inspection.png'), fullPage: true })
  checks.push('WX-0457: a pure detail panel renders every literal HR/CMS/CRM collection count, including zero and metadata rows; 11 CRM leads show only eight IDs plus an exact omission count, with free-text values hidden')

  let changed = structuredClone(captured)
  await employeeTime(page, 'employee-003'); changed.hr.selectedEmployee = 'employee-003'
  await button(timeEntry(page, 'time-002'), 'Delete draft').click(); await button(timeEntry(page, 'time-002'), 'Confirm delete draft').click()
  changed.hr.workflow.timeEntries = changed.hr.workflow.timeEntries.filter(entry => entry.id !== 'time-002')
  await open(page, 'Content management')
  const content = { title: 'Inspection changed draft', slug: 'inspection-changed-draft', body: 'This hidden fictional CMS draft differs from the captured baseline without entering the detail panel.' }
  for (const [key, value] of Object.entries(content)) await page.locator(`#edit-${key}`).fill(value)
  await button(page, 'Save draft revision').click(); changed = updateCmsExpected(changed, content)
  await open(page, 'Customer relationships'); await createInspectLead(page, changed, 10)
  assert.deepEqual(await snapshot(page, artifactDir, 'history-04-independent-added-removed-changed-current'), changed)
  const beforeDiff = await slots(context, origin)
  const targetEnvelope = JSON.parse(await readFile(join(artifactDir, 'history-02-captured-all-collections.json'), 'utf8'))
  await combined.getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload('actual-ui-export-before-mutations.json', targetEnvelope))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  for (const module of ['HR', 'CMS', 'CRM']) await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}`) }).check()
  const forward = { HR: { added: 1, removed: 0, changed: 0, unchanged: 34 }, CMS: { added: 0, removed: 1, changed: 1, unchanged: 1 }, CRM: { added: 0, removed: 2, changed: 0, unchanged: 27 } }
  const combinedDiff = await assertDifferences(page, 'Selected restore differences', forward)
  await expect(combinedDiff).toContainText('time-002'); await expect(combinedDiff).toContainText('cms-article-001'); await expect(combinedDiff).toContainText('lead-0010')
  await expect(combinedDiff).not.toContainText(content.body)
  assert.deepEqual(await slots(context, origin), beforeDiff)
  await button(preview, 'Cancel combined restore').click()
  await button(pointRow(page, allPoint), `Undo restore point ${allPoint.createdAt} HR, CMS, CRM`).click()
  await assertDifferences(page, 'Undo workspace differences', forward)
  assert.deepEqual(await slots(context, origin), beforeDiff)
  await button(page.getByRole('region', { name: 'Undo preview', exact: true }), 'Confirm undo').click()
  assert.deepEqual(await snapshot(page, artifactDir, 'history-05-undo-restores-inspected-target'), captured)
  const undoPoint = (await historyValue(context, origin)).points[0]
  assert.equal(undoPoint.kind, 'undo'); assert.equal(undoPoint.sourcePointId, allPoint.id); assert.deepEqual(undoPoint.states, changed)
  await button(pointRow(page, undoPoint), `Undo restore point ${undoPoint.createdAt} HR, CMS, CRM`).click()
  await assertDifferences(page, 'Undo workspace differences', { HR: { added: 0, removed: 1, changed: 0, unchanged: 34 }, CMS: { added: 1, removed: 0, changed: 1, unchanged: 1 }, CRM: { added: 2, removed: 0, changed: 0, unchanged: 27 } })
  await button(page.getByRole('region', { name: 'Undo preview', exact: true }), 'Confirm undo').click()
  await page.reload()
  assert.deepEqual(await snapshot(page, artifactDir, 'history-06-undo-reversal-refreshed'), changed)
  const finalHistory = await historyValue(context, origin)
  assert.deepEqual(finalHistory.points.find(point => point.id === unlabeled.id), renamed)
  assert.deepEqual(finalHistory.points.find(point => point.id === allPoint.id), allPoint)
  const saved = await slots(context, origin)
  for (const module of ['hr', 'cms', 'crm']) assert.deepEqual(JSON.parse(saved[`webappx.demo.${module}`]), { schemaVersion: 1, module, data: changed[module] })
  checks.push('WX-0458: combined restore and Undo show literal directional added/removed/changed counts and IDs before any write; Undo and its reversal recover the complete target/current graphs while existing point labels, times and payloads remain intact')
  return { capturedCounts, primaryTotals: { hr: 35, cms: 2, crm: 27 }, forwardDifferences: forward, renamedPointId: unlabeled.id, allCollectionPointId: allPoint.id, negativeNavigationMethod: 'History.pushState plus popstate, then real rendered links' }
}

/** Four fresh owned contexts use real controls and full downloads. Expected
 * arithmetic/record changes are stated literally; no app model generates them.
 */
export async function runPortalMaturity({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], evidence = {}
  async function journey(name, run) {
    let context, page, failure, tracing = false
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
      evidence[name] = await run({ page, context, origin, artifactDir, seed, checks })
      await page.screenshot({ path: join(artifactDir, `${name}-final.png`), fullPage: true })
    } catch (error) {
      failure = error
      if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDir, `${name}-failure.png`), fullPage: true, timeout: 5000 }).catch(() => {})
      throw error
    } finally {
      const errors = []
      if (tracing) try { await context.tracing.stop({ path: join(artifactDir, `${name}-trace.zip`) }) } catch (error) { errors.push(error.message) }
      if (context) try { await context.close() } catch (error) { errors.push(error.message) }
      if (errors.length && failure) failure.artifactErrors = errors
      else if (errors.length) throw new Error(`Maturity ${name} cleanup failed: ${errors.join('; ')}`)
    }
  }
  try {
    await journey('hr', hrJourney)
    await journey('cms', cmsJourney)
    await journey('crm', crmJourney)
    await journey('history-navigation', historyJourney)
    assert.deepEqual(problems, [])
    return { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, coveredItems: ['WX-0056', 'WX-0151', 'WX-0152', 'WX-0153', 'WX-0154', 'WX-0155', 'WX-0156', 'WX-0157', 'WX-0158', 'WX-0280', 'WX-0282', 'WX-0397', 'WX-0453', 'WX-0454', 'WX-0457', 'WX-0458'], maturityEvidence: evidence }
  } catch (error) {
    error.smokeEvidence = { checks, problems, warnings: [...new Set(warnings)], maturityEvidence: evidence }
    throw error
  }
}
