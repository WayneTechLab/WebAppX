import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'

const avery = 'employee-002'
const jordan = 'employee-003'
const receipt = 'MOCK-PAYROLL-0006'
const panel = (page, title) => page.getByRole('heading', { name: title, exact: true }).locator('..')
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const employeeIdentity = page => page.getByRole('combobox', { name: /^Synthetic employee identity/ })
const employeePage = (page, name) => page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name, exact: true })
const portal = (page, name) => page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name, exact: true })

// Independent arithmetic, fixed to the reviewed named seed and explicit UI
// additions below. These values do not call a reducer, projection or tax helper.
// Avery: (8 + 1.25) * $30 = $277.50; 20% = $55.50; health = $25; net = $197.
// Jordan: (6 + 2.5) * $30 = $255; 20% = $51; confirmed waiver = $0; net = $204.
export const payrollExpectation = Object.freeze({
  receipt,
  hours: 17.75,
  grossCents: 53250,
  illustrativeWithholdingCents: 10650,
  benefitDeductionCents: 2500,
  netCents: 40100,
  inputs: [
    { entryId: 'time-001', employeeId: avery, hours: 8, rateCents: 3000, date: '2026-10-09', rateEffectiveFrom: '2026-10-01' },
    { entryId: 'time-002', employeeId: jordan, hours: 6, rateCents: 3000, date: '2026-10-09', rateEffectiveFrom: '2026-10-01' },
    { entryId: 'MOCK-TIME-0003', employeeId: avery, hours: 1.25, rateCents: 3000, date: '2026-10-14', rateEffectiveFrom: '2026-10-01' },
    { entryId: 'MOCK-TIME-0005', employeeId: jordan, hours: 2.5, rateCents: 3000, date: '2026-10-14', rateEffectiveFrom: '2026-10-01' },
  ],
  benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }],
  employeeTotals: [
    { employeeId: avery, hours: 9.25, grossCents: 27750, illustrativeWithholdingCents: 5550, benefitDeductionCents: 2500, netCents: 19700 },
    { employeeId: jordan, hours: 8.5, grossCents: 25500, illustrativeWithholdingCents: 5100, benefitDeductionCents: 0, netCents: 20400 },
  ],
})

/** Entire expected workspace records, handwritten independently of app state
 * transitions. Each stage describes the same ordinary UI journey. */
export function expectedPayrollWorkspaces(states, stage = 'submitted') {
  const expected = structuredClone(states)
  assert.equal(expected.hr.workflow.sequence, 1)
  assert.deepEqual(expected.hr.workflow.benefitElections, [])
  assert.deepEqual(expected.hr.workflow.payrollHistory, [])
  assert.deepEqual(expected.hr.workflow.timeEntries, [
    { id: 'time-001', employeeId: avery, date: '2026-10-09', hours: 8, status: 'submitted', source: 'fixture' },
    { id: 'time-002', employeeId: jordan, date: '2026-10-09', hours: 6, status: 'draft', source: 'fixture' },
  ])
  expected.hr.selectedEmployee = jordan
  const workflow = expected.hr.workflow
  workflow.onboarding[jordan] = { profileReviewed: true, jobReviewed: true, stage: 'complete', tasks: { profile: true }, receipt: 'MOCK-ONBOARDING-0001' }
  workflow.employeeStatuses[jordan] = 'active'
  workflow.benefitElections = [
    { employeeId: avery, planId: 'benefit-001', election: 'enroll', stage: 'confirmed', receipt: 'MOCK-BENEFIT-0002' },
    { employeeId: jordan, planId: 'benefit-002', election: 'waive', stage: 'confirmed', receipt: 'MOCK-BENEFIT-0004' },
  ]
  workflow.timeEntries[0].status = 'approved'
  workflow.timeEntries[1].status = 'approved'
  workflow.timeEntries.push(
    { id: 'MOCK-TIME-0003', employeeId: avery, date: '2026-10-14', hours: 1.25, source: 'manual', status: 'approved' },
    { id: 'MOCK-TIME-0005', employeeId: jordan, date: '2026-10-14', hours: 2.5, source: 'manual', status: 'approved' },
  )
  workflow.sequence = 6
  if (stage === 'approved') return expected
  assert.ok(['prepared', 'calculated', 'reviewed', 'submitted'].includes(stage))
  workflow.sampleRates = {
    [avery]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }],
    [jordan]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }],
  }
  workflow.payroll = {
    period: { start: '2026-10-01', end: '2026-10-15' },
    stage, inputs: structuredClone(payrollExpectation.inputs), benefitInputs: structuredClone(payrollExpectation.benefitInputs),
    employeeTotals: [], hours: 17.75, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0,
  }
  if (stage !== 'prepared') {
    for (const key of ['grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents', 'netCents', 'employeeTotals']) workflow.payroll[key] = structuredClone(payrollExpectation[key])
  }
  if (stage === 'submitted') {
    workflow.payroll.receipt = receipt
    workflow.payrollHistory = [structuredClone(workflow.payroll)]
    workflow.timeEntries.forEach(entry => { entry.payrollReceipt = receipt })
    workflow.sequence = 7
  }
  return expected
}

async function exportWorkspaces(page, artifactDir, label) {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: 'Portal directory', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await button(page.getByRole('region', { name: 'Combined workspace backup', exact: true }), 'Export all workspaces').click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /^webappx-all-mock-workspaces-.*\.json$/)
  const destination = join(artifactDir, `${label}.json`)
  await download.saveAs(destination)
  assert.equal(await download.failure(), null, 'The actual combined JSON download must complete')
  const envelope = JSON.parse(await readFile(destination, 'utf8'))
  assert.deepEqual(Object.keys(envelope).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(envelope.format, 'webappx-mock-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  assert.ok(Number.isFinite(Date.parse(envelope.exportedAt)))
  assert.deepEqual(Object.keys(envelope.workspaces).sort(), ['cms', 'crm', 'hr'])
  return envelope.workspaces
}

async function openHr(page) {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name: 'People & HR', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Demo portals', exact: true })).toBeVisible()
}

async function openPayroll(page) {
  await openHr(page)
  await portal(page, 'Management').click()
  await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Payroll workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Run a simulated payroll', exact: true })).toBeVisible()
}

async function confirmElection(page, name, election, expectedReceipt) {
  const plan = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(button(plan, 'Review sample election')).toBeDisabled()
  await expect(button(plan, 'Confirm sample election')).toBeDisabled()
  await button(plan, election === 'enroll' ? 'Elect sample enrollment' : 'Elect sample waiver').click()
  await expect(plan.getByRole('status')).toHaveText(`${election} · draft`)
  await expect(button(plan, 'Confirm sample election')).toBeDisabled()
  await button(plan, 'Review sample election').click()
  await expect(plan.getByRole('status')).toHaveText(`${election} · reviewed`)
  await button(plan, 'Confirm sample election').click()
  await expect(plan.getByRole('status')).toHaveText(`${election} · confirmed · ${expectedReceipt}`)
  for (const action of ['Elect sample enrollment', 'Elect sample waiver', 'Review sample election', 'Confirm sample election']) await expect(button(plan, action)).toBeDisabled()
}

async function addAndSubmitTime(page, hours) {
  await employeePage(page, 'My time').click()
  await page.getByLabel('Work date', { exact: true }).fill('2026-10-14')
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill(String(hours))
  await button(page, 'Add sample time').click()
  await expect(page.getByRole('status').filter({ hasText: 'Sample draft added.' })).toBeVisible()
  await button(page, 'Submit own sample timesheet').click()
  await expect(button(page, 'Submit own sample timesheet')).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Own sample timesheet submitted.' })).toBeVisible()
}

async function numberListValue(scope, title) {
  return scope.getByText(title, { exact: true }).locator('..').locator('dd').innerText()
}
const moneyCents = text => {
  assert.match(text, /^\$[\d,]+\.\d{2}$/)
  return Number(text.replace(/[$,.]/g, ''))
}

async function assertStatement(page, artifactDir, employeeId) {
  const expected = payrollExpectation.employeeTotals.find(total => total.employeeId === employeeId)
  const own = employeeId === avery
  await employeeIdentity(page).selectOption(employeeId)
  await employeePage(page, 'My pay').click()
  const statements = panel(page, 'Your simulated pay receipts')
  await expect(statements.getByRole('article')).toHaveCount(1)
  const statement = statements.getByRole('article')
  await expect(statement.getByText(receipt, { exact: true })).toBeVisible()
  await expect(statement.getByText(`${own ? 'Avery Sample' : 'Jordan Demo'} · 2026-10-01 to 2026-10-15`, { exact: true })).toBeVisible()
  const observed = {
    employeeId,
    receipt: await statement.getByText(receipt, { exact: true }).innerText(),
    hours: Number(await numberListValue(statement, 'Approved hours included')),
    grossCents: moneyCents(await numberListValue(statement, 'Gross')),
    illustrativeWithholdingCents: moneyCents(await numberListValue(statement, 'Illustrative withholding')),
    benefitDeductionCents: moneyCents(await numberListValue(statement, 'Sample benefit deductions')),
    netCents: moneyCents(await statement.locator('header').getByText('Simulated net', { exact: true }).locator('..').locator('p').last().innerText()),
  }
  assert.deepEqual(observed, { ...expected, receipt })
  await statement.getByText('View frozen time and benefit inputs', { exact: true }).click()
  const frozen = statement.locator('details')
  await expect(frozen).toHaveAttribute('open', '')
  const entries = own ? ['2026-10-09 · 8.0000 hours × $30.00/hour (fictional) · time-001', '2026-10-14 · 1.2500 hours × $30.00/hour (fictional) · MOCK-TIME-0003'] : ['2026-10-09 · 6.0000 hours × $30.00/hour (fictional) · time-002', '2026-10-14 · 2.5000 hours × $30.00/hour (fictional) · MOCK-TIME-0005']
  assert.deepEqual(await frozen.getByRole('listitem').allInnerTexts(), entries)
  await expect(frozen.getByText(`Benefit plans in this snapshot: ${own ? 'Demo health plan' : 'None'}. Deductions are capped to this employee's sample pay after illustrative withholding.`, { exact: true })).toBeVisible()
  await expect(statements).not.toContainText(own ? 'Jordan Demo' : 'Avery Sample')
  await page.screenshot({ path: join(artifactDir, `statement-${employeeId}.png`), fullPage: true })
  return { ...observed, frozenTime: entries, benefitPlans: own ? ['Demo health plan'] : [] }
}

async function assertPersisted(context, origin, expected, auxiliarySaves) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'The simulated payroll must create no account cookies')
  assert.equal(storage.origins.length, 1)
  const saved = storage.origins.find(item => item.origin === origin)
  assert.ok(saved)
  assert.deepEqual(saved.localStorage.filter(item => item.name !== 'webappx.demo.hr'), auxiliarySaves, 'Payroll must preserve the accessibility preference and create no CMS/CRM or other domain saves')
  assert.deepEqual(JSON.parse(saved.localStorage.find(item => item.name === 'webappx.demo.hr').value), { schemaVersion: 1, module: 'hr', data: expected.hr }, 'The entire persisted HR envelope must equal the handwritten expected records')
}

/** Every record change uses rendered UI controls in a fresh account-free
 * context. Downloads and storageState are read-only observations. */
export async function runPayrollLifecycle({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = []
  let context, page, traceStarted = false, primaryFailure
  try {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    traceStarted = true
    await page.goto(`${origin}/portals`)
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '00-baseline-workspaces'), seed.workspaces)
    const auxiliarySaves = (await context.storageState()).origins.find(item => item.origin === origin)?.localStorage ?? []
    assert.deepEqual(auxiliarySaves.map(item => item.name), ['sfwa-wtl:accessibility-preferences'])
    checks.push('A fresh account-free context exports the exact named seed without saved domain records')

    await openHr(page)
    await portal(page, 'Employee').click()
    await employeeIdentity(page).selectOption(jordan)
    await employeePage(page, 'My onboarding').click()
    await expect(button(page, 'Review onboarding summary')).toBeDisabled()
    await expect(button(page, 'Confirm simulated onboarding')).toBeDisabled()
    await button(page, 'Review sample profile').click()
    await button(page, 'Review sample job').click()
    await page.getByRole('button', { name: 'Complete own profile Mark complete', exact: true }).click()
    await button(page, 'Review onboarding summary').click()
    await button(page, 'Confirm simulated onboarding').click()
    await expect(page.getByRole('status', { name: 'Onboarding completion status', exact: true })).toHaveText('Simulated onboarding completed · MOCK-ONBOARDING-0001. Demo directory status is now active.')
    checks.push('Jordan completes the required profile, job and checklist onboarding through the UI and receives MOCK-ONBOARDING-0001')

    await employeeIdentity(page).selectOption(avery)
    await employeePage(page, 'My benefits').click()
    await confirmElection(page, 'Demo health plan', 'enroll', 'MOCK-BENEFIT-0002')
    await addAndSubmitTime(page, 1.25)
    await employeeIdentity(page).selectOption(jordan)
    await employeePage(page, 'My benefits').click()
    await confirmElection(page, 'Demo retirement plan', 'waive', 'MOCK-BENEFIT-0004')
    await addAndSubmitTime(page, 2.5)
    checks.push('Two distinct employee identities confirm different benefit choices and submit known additional hours through ordinary UI controls')

    await portal(page, 'Manager').click()
    await page.getByRole('navigation', { name: 'Manager HR pages', exact: true }).getByRole('link', { name: 'Team time', exact: true }).click()
    const timesheet = panel(page, 'Sample timesheet journey')
    await expect(button(timesheet, 'Approve sample time')).toHaveCount(4)
    for (const [name, date, hours] of [['Avery Sample', '2026 10 09', 8], ['Jordan Demo', '2026 10 09', 6], ['Avery Sample', '2026 10 14', 1.25], ['Jordan Demo', '2026 10 14', 2.5]]) {
      const row = timesheet.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) }).filter({ hasText: `${date} · ${hours} hours` })
      await button(row, 'Approve sample time').click()
      await expect(row.getByText('approved', { exact: true })).toBeVisible()
    }
    await expect(button(timesheet, 'Approve sample time')).toHaveCount(0)
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '01-approved-workspaces'), expectedPayrollWorkspaces(seed.workspaces, 'approved'))
    checks.push('The separate manager identity approves exactly four known entries; full exported records match while CMS and CRM remain unchanged')

    await openPayroll(page)
    for (const action of ['Calculate fictional totals', 'Review simulated payroll', 'Simulate payroll submission']) await expect(button(page, action)).toBeDisabled()
    await page.getByLabel('Sample period start', { exact: true }).fill('2026-10-01')
    await page.getByLabel('Sample period end', { exact: true }).fill('2026-10-15')
    const rates = page.getByRole('form', { name: 'Configure fictional hourly rates', exact: true })
    for (const employeeId of [avery, jordan]) {
      await rates.getByRole('combobox', { name: /^Rate employee/ }).selectOption(employeeId)
      await rates.getByLabel('Fictional hourly rate (dollars)', { exact: true }).fill('30')
      await rates.getByLabel('Rate effective date', { exact: true }).fill('2026-10-01')
      await rates.getByRole('button', { name: 'Add sample rate', exact: true }).click()
    }
    await button(page, 'Prepare sample payroll').click()
    await expect(panel(page, 'Run a simulated payroll')).toContainText('4 approved entries · 17.75 hours')
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '02-prepared-workspaces'), expectedPayrollWorkspaces(seed.workspaces, 'prepared'))
    await openPayroll(page)
    await button(page, 'Calculate fictional totals').click()
    const payroll = panel(page, 'Run a simulated payroll')
    assert.equal(await numberListValue(payroll, 'Fictional gross'), '$532.50')
    assert.equal(await numberListValue(payroll, 'Illustrative withholding'), '$106.50')
    assert.equal(await numberListValue(payroll, 'Sample benefit deductions'), '$25.00')
    assert.equal(await numberListValue(payroll, 'Simulated net'), '$401.00')
    await expect(button(page, 'Simulate payroll submission')).toBeDisabled()
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '03-calculated-workspaces'), expectedPayrollWorkspaces(seed.workspaces, 'calculated'))
    await openPayroll(page)
    await button(page, 'Review simulated payroll').click()
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '04-reviewed-workspaces'), expectedPayrollWorkspaces(seed.workspaces, 'reviewed'))
    await openPayroll(page)
    await button(page, 'Simulate payroll submission').click()
    await expect(payroll.getByRole('status')).toHaveText(`Simulated submission complete · ${receipt}. No money moved and no provider was contacted.`)
    const submittedReceipt = payroll.getByRole('listitem').filter({ hasText: receipt })
    await expect(submittedReceipt).toContainText(`${receipt} · 2026-10-01 to 2026-10-15 · 17.75 hours · fictional net $401.00`)
    assert.deepEqual(await submittedReceipt.getByRole('listitem').allInnerTexts(), [
      'Avery Sample · 8 hours × $30.00/hour (fictional)',
      'Jordan Demo · 6 hours × $30.00/hour (fictional)',
      'Avery Sample · 1.25 hours × $30.00/hour (fictional)',
      'Jordan Demo · 2.5 hours × $30.00/hour (fictional)',
    ])
    await page.screenshot({ path: join(artifactDir, '05-submitted-payroll.png'), fullPage: true })
    await page.reload()
    const expected = expectedPayrollWorkspaces(seed.workspaces)
    const submitted = await exportWorkspaces(page, artifactDir, '06-submitted-refreshed-workspaces')
    assert.deepEqual(submitted, expected)
    await assertPersisted(context, origin, expected, auxiliarySaves)
    checks.push('Prepare, calculate, review and submission persist one frozen MOCK-PAYROLL-0006 receipt with exact inputs, employee totals and aggregate amounts after reload')

    await openHr(page)
    await portal(page, 'Employee').click()
    const statements = []
    for (const employeeId of [avery, jordan]) {
      await employeeIdentity(page).selectOption(employeeId)
      await page.reload()
      statements.push(await assertStatement(page, artifactDir, employeeId))
    }
    const combined = submitted.hr.workflow.payrollHistory[0]
    for (const key of ['hours', 'grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents', 'netCents']) assert.equal(statements.reduce((sum, statement) => sum + statement[key], 0), combined[key], `The two rendered individual statements must sum to the actual combined receipt ${key}`)
    await writeFile(join(artifactDir, '07-observed-employee-statements.json'), JSON.stringify({ statements, combinedReceipt: combined }, null, 2) + '\n')
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '08-statements-refreshed-workspaces'), expected)
    await assertPersisted(context, origin, expected, auxiliarySaves)
    checks.push('After reload each employee sees exactly their own frozen statement and inputs; the two rendered statements sum to every amount and hour in the actual combined receipt')

    await openPayroll(page)
    for (const action of ['Calculate fictional totals', 'Review simulated payroll', 'Simulate payroll submission']) await expect(button(page, action)).toBeDisabled()
    await button(page, 'Prepare sample payroll').click()
    await expect(page.getByRole('alert')).toHaveText('Approve at least one unpaid time entry for an active sample employee in 2026-10-01 to 2026-10-15 before preparing payroll.')
    await expect(payroll.getByRole('status')).toHaveText(`Simulated submission complete · ${receipt}. No money moved and no provider was contacted.`)
    await page.reload()
    assert.deepEqual(await exportWorkspaces(page, artifactDir, '09-consumed-time-rejected-workspaces'), expected)
    await assertPersisted(context, origin, expected, auxiliarySaves)
    checks.push('A second preparation rejects all four consumed entries and preserves the complete receipt, history, totals and saved workspaces after reload')
    assert.deepEqual(problems, [], 'Payroll requires zero unexpected external/provider/backend traffic, failed HTTP requests, console errors or uncaught exceptions')
    checks.push('The isolated payroll journey finishes without account cookies, provider/backend requests, browser console errors or uncaught exceptions')
    return { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, employees: 2, confirmedElections: 2, approvedEntries: 4, statements: 2, submittedReceipts: 1, expectedPayroll: payrollExpectation }
  } catch (error) {
    primaryFailure = error
    if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true, timeout: 5_000 }).catch(() => {})
    error.smokeEvidence = { checks, problems, warnings: [...new Set(warnings)] }
    throw error
  } finally {
    const cleanupErrors = []
    if (traceStarted && context) try { await context.tracing.stop({ path: join(artifactDir, 'trace.zip') }) } catch (error) { cleanupErrors.push(error) }
    if (context) try { await context.close() } catch (error) { cleanupErrors.push(error) }
    if (cleanupErrors.length && primaryFailure) primaryFailure.smokeEvidence.artifactErrors = cleanupErrors.map(error => error.message)
    else if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Payroll trace/context cleanup failed')
  }
}
