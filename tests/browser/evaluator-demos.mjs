import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { runPayrollLifecycle } from './payroll-lifecycle.mjs'
import { runCmsCrmLifecycles } from './cms-crm-lifecycles.mjs'

const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, title) => navigation(page).getByRole('link', { name: title, exact: true }).click()
const tab = (page, name) => page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name, exact: true }).click()
const article = (page, name) => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const crmLead = { name: 'Elliot Fixture', email: 'elliot@evaluator.invalid', companyName: 'Fictional Evaluator Studio' }
const opportunity = `${crmLead.companyName} · sample opportunity`
const followUp = 'Prepare fictional evaluator proposal'
const recovery = {
  goal: 'Fictional browser smoke handoff', title: 'Fictional browser smoke editorial update',
  lead: 'Browser Smoke Fiction', email: 'browser-smoke@fixture.invalid', company: 'Fictional Browser Smoke Studio',
}
const modules = ['hr', 'cms', 'crm']
const auxiliaryKey = 'sfwa-wtl:accessibility-preferences'
const historyKey = 'webappx.demo.restore-points'

async function exportAll(page, artifactDir, label) {
  await open(page, 'Portal directory')
  const section = page.getByRole('region', { name: 'Combined workspace backup', exact: true })
  const waiting = page.waitForEvent('download')
  await section.getByRole('button', { name: 'Export all workspaces', exact: true }).click()
  const download = await waiting
  assert.match(download.suggestedFilename(), /^webappx-all-mock-workspaces-.*\.json$/)
  const path = join(artifactDir, `${label}.json`)
  await download.saveAs(path)
  assert.equal(await download.failure(), null)
  const envelope = JSON.parse(await readFile(path, 'utf8'))
  assert.deepEqual(Object.keys(envelope).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(envelope.format, 'webappx-mock-workspaces')
  assert.equal(envelope.schemaVersion, 1)
  assert.equal(new Date(envelope.exportedAt).toISOString(), envelope.exportedAt)
  assert.deepEqual(Object.keys(envelope.workspaces).sort(), ['cms', 'crm', 'hr'])
  return { path, workspaces: envelope.workspaces }
}

async function saves(context, origin) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'Evaluator demos create no account/session cookies')
  assert.ok(storage.origins.every(item => item.origin === origin), 'Saves belong only to the owned fixture origin')
  return [...(storage.origins.find(item => item.origin === origin)?.localStorage ?? [])].sort((a, b) => a.name.localeCompare(b.name))
}
const saved = (records, module) => records.find(item => item.name === `webappx.demo.${module}`)?.value
const auxiliary = records => records.filter(item => !item.name.startsWith('webappx.demo.'))

async function initial(page, context, origin, artifactDir, seed, label) {
  await page.goto(`${origin}/portals`)
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  const exported = await exportAll(page, artifactDir, label)
  assert.deepEqual(exported.workspaces, seed.workspaces, 'The entire fresh native state equals the validated named seed')
  const records = await saves(context, origin)
  assert.deepEqual(records.map(item => item.name), [auxiliaryKey], 'A fresh owned context has no domain saves or restore history')
  return { ...exported, auxiliary: records }
}

async function crmMetrics(page, active, pipeline, followUps) {
  await tab(page, 'Dashboard')
  for (const [label, value] of [['Active sample leads', String(active)], ['Open sample pipeline', pipeline], ['Sample won value', '$0.00'], ['Open follow-ups', String(followUps)]]) {
    await expect(page.getByText(label, { exact: true }).locator('..').getByText(value, { exact: true })).toBeVisible()
  }
}

function addCrmReceipt(expected, receipt, action, description) {
  expected.crm.activity.unshift({ receipt, ownerId: 'crm-owner', action, description })
}

async function runCrmMovement({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = []
  let context, page, tracing = false
  try {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
    const baseline = await initial(page, context, origin, artifactDir, seed, 'evaluator-crm-00-seed')
    const expected = structuredClone(seed.workspaces)
    const snapshot = async label => {
      assert.deepEqual((await exportAll(page, artifactDir, label)).workspaces, expected, 'Every CRM record and unchanged HR/CMS record matches handwritten expectations')
      const records = await saves(context, origin)
      assert.deepEqual(auxiliary(records), baseline.auxiliary)
      assert.deepEqual(records.filter(item => item.name.startsWith('webappx.demo.')).map(item => item.name), ['webappx.demo.crm'])
      assert.deepEqual(JSON.parse(saved(records, 'crm')), { schemaVersion: 1, module: 'crm', data: expected.crm })
    }
    await open(page, 'Customer relationships')
    await expect(page.getByRole('combobox', { name: 'CRM preview identity', exact: true })).toHaveValue('crm-owner')
    await crmMetrics(page, 2, '$6,500.00', 1)
    await tab(page, 'Leads')
    await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill(crmLead.name)
    await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill(crmLead.email)
    await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill(crmLead.companyName)
    await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
    expected.crm.leads.push({ id: 'lead-0001', ...crmLead, ownerId: 'crm-owner', status: 'new' })
    expected.crm.sequence = 2
    addCrmReceipt(expected, 'MOCK-CRM-0001', 'create-lead', `Created sample lead ${crmLead.name}.`)
    await expect(article(page, crmLead.name)).toContainText('lead-0001')
    await crmMetrics(page, 3, '$6,500.00', 1)
    await snapshot('evaluator-crm-01-created')
    await open(page, 'Customer relationships'); await tab(page, 'Leads')
    await article(page, crmLead.name).getByRole('button', { name: 'Qualify sample lead', exact: true }).click()
    const lead = expected.crm.leads.at(-1)
    lead.status = 'qualified'; expected.crm.sequence = 3
    addCrmReceipt(expected, 'MOCK-CRM-0002', 'qualify-lead', `Qualified ${crmLead.name}; conversion is now available.`)
    await article(page, crmLead.name).getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true }).fill('1750.25')
    await article(page, crmLead.name).getByRole('button', { name: 'Convert sample lead', exact: true }).click()
    Object.assign(lead, { status: 'converted', companyId: 'company-0003', contactId: 'contact-0003', opportunityId: 'opportunity-0003' })
    expected.crm.companies.push({ id: 'company-0003', name: crmLead.companyName, ownerId: 'crm-owner' })
    expected.crm.contacts.push({ id: 'contact-0003', name: crmLead.name, email: crmLead.email, companyId: 'company-0003', ownerId: 'crm-owner' })
    expected.crm.opportunities.push({ id: 'opportunity-0003', title: opportunity, companyId: 'company-0003', contactId: 'contact-0003', ownerId: 'crm-owner', amountCents: 175025, stage: 'discovery', leadId: 'lead-0001' })
    expected.crm.sequence = 4
    addCrmReceipt(expected, 'MOCK-CRM-0003', 'convert-lead', `Converted ${crmLead.name} into linked company, contact and opportunity records.`)
    await expect(article(page, crmLead.name)).toContainText('Converted once. Company company-0003, contact contact-0003 and opportunity opportunity-0003 are linked in the pipeline and directory.')
    await tab(page, 'Companies & contacts')
    await expect(article(page, crmLead.companyName)).toContainText('company-0003')
    await expect(article(page, crmLead.companyName)).toContainText(crmLead.email)
    await crmMetrics(page, 2, '$8,250.25', 1)
    await snapshot('evaluator-crm-02-converted')
    checks.push('WX-0906: actual controls create, qualify and convert $1,750.25 into the exact linked company/contact/opportunity-0003 graph with receipts 0001–0003 and $8,250.25 open pipeline')

    await open(page, 'Customer relationships'); await tab(page, 'Follow-up tasks')
    await page.getByRole('textbox', { name: 'Follow-up title', exact: true }).fill(followUp)
    await page.getByRole('combobox', { name: 'Follow-up opportunity', exact: true }).selectOption('opportunity-0003')
    await page.getByRole('button', { name: 'Create sample follow-up', exact: true }).click()
    expected.crm.tasks.push({ id: 'task-0004', title: followUp, opportunityId: 'opportunity-0003', ownerId: 'crm-owner', status: 'open' })
    expected.crm.sequence = 5
    addCrmReceipt(expected, 'MOCK-CRM-0004', 'create-task', `Assigned ${followUp} to the opportunity owner.`)
    await expect(article(page, followUp)).toContainText('Assigned to Casey Example')
    await expect(article(page, followUp)).toContainText(opportunity)
    await tab(page, 'Pipeline')
    const card = article(page, opportunity)
    await expect(card.getByText('discovery', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: 'Move to proposal', exact: true }).click()
    expected.crm.opportunities.at(-1).stage = 'proposal'; expected.crm.sequence = 6
    addCrmReceipt(expected, 'MOCK-CRM-0005', 'advance-opportunity', `Moved ${opportunity} to proposal.`)
    await expect(card.getByText('proposal', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Move to negotiation', exact: true })).toBeVisible()
    await snapshot('evaluator-crm-03-proposal')
    await open(page, 'Customer relationships'); await tab(page, 'Pipeline')
    await article(page, opportunity).getByRole('button', { name: 'Move to negotiation', exact: true }).click()
    expected.crm.opportunities.at(-1).stage = 'negotiation'; expected.crm.sequence = 7
    addCrmReceipt(expected, 'MOCK-CRM-0006', 'advance-opportunity', `Moved ${opportunity} to negotiation.`)
    await expect(article(page, opportunity).getByText('negotiation', { exact: true })).toBeVisible()
    await expect(article(page, opportunity)).toContainText('$1,750.25')
    await page.screenshot({ path: join(artifactDir, 'evaluator-crm-negotiation.png'), fullPage: true })
    await tab(page, 'Activity')
    for (const line of ['MOCK-CRM-0004', 'MOCK-CRM-0005', 'MOCK-CRM-0006', `Moved ${opportunity} to proposal.`, `Moved ${opportunity} to negotiation.`]) await expect(page.getByText(line, { exact: true })).toBeVisible()
    await crmMetrics(page, 2, '$8,250.25', 2)
    await expect(page.getByText('3 fictional companies · 3 contacts · 6 successful sample actions', { exact: true })).toBeVisible()
    await snapshot('evaluator-crm-04-negotiation')
    await open(page, 'Customer relationships'); await page.reload()
    await crmMetrics(page, 2, '$8,250.25', 2)
    await tab(page, 'Pipeline')
    await expect(article(page, opportunity).getByText('negotiation', { exact: true })).toBeVisible()
    await snapshot('evaluator-crm-05-reloaded')
    checks.push('WX-0906: exact follow-up task-0004 remains linked and open; real Move to proposal/Move to negotiation controls add receipts 0005–0006, preserve links/amount and survive reload with full payload equality')
    assert.deepEqual(problems, [])
    await writeFile(join(artifactDir, 'evaluator-crm-evidence.json'), JSON.stringify({ seedName: seed.name, seedSha256: seed.sha256, expectedFinalWorkspaces: expected, totals: { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 2 }, problems }, null, 2) + '\n')
    return { checks, warnings, linkedOpportunity: 'opportunity-0003', finalStage: 'negotiation', openPipelineCents: 825025, openFollowUps: 2 }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'evaluator-crm-failure.png'), fullPage: true }) } catch { /* Keep the original assertion failure. */ }
    error.smokeEvidence = { checks, problems, warnings }; throw error
  } finally {
    if (context && tracing) try { await context.tracing.stop({ path: join(artifactDir, 'evaluator-crm-movement-trace.zip') }) } catch { /* Keep primary evidence. */ }
    if (context) await context.close()
  }
}

async function runOneModuleRecovery({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = []
  let context, page, tracing = false
  try {
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true
    const baseline = await initial(page, context, origin, artifactDir, seed, 'evaluator-recovery-00-baseline')
    const changed = structuredClone(seed.workspaces)
    // These literal expected records follow the human steps. No application
    // transition, projection or import helper computes their expected values.
    changed.hr.performance.sequence = 1
    changed.hr.performance.goals.push({ id: 'goal-1', employeeId: 'employee-002', title: recovery.goal, progress: 0, status: 'active', activity: [{ receipt: 'MOCK-PERF-0001', action: 'goal created', actorRole: 'employer-owner' }] })
    const entry = changed.cms.entries.find(item => item.id === 'cms-article-001')
    Object.assign(entry, { title: recovery.title, revision: 2, status: 'draft', approval: null, feedback: '' })
    changed.cms.sequence = 1
    changed.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
    changed.crm.leads.push({ id: 'lead-0001', name: recovery.lead, email: recovery.email, companyName: recovery.company, ownerId: 'crm-owner', status: 'new' })
    changed.crm.sequence = 2
    addCrmReceipt(changed, 'MOCK-CRM-0001', 'create-lead', `Created sample lead ${recovery.lead}.`)

    await open(page, 'People & HR')
    await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Performance', exact: true }).click()
    await page.getByRole('combobox', { name: 'Goal employee', exact: true }).selectOption('employee-002')
    await page.getByRole('textbox', { name: 'Goal title', exact: true }).fill(recovery.goal)
    await page.getByRole('button', { name: 'Create sample goal', exact: true }).click()
    await expect(page.getByText(recovery.goal, { exact: true })).toBeVisible()
    await open(page, 'Content management')
    await page.locator('#edit-title').fill(recovery.title)
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await expect(page.locator('#edit-title')).toHaveValue(recovery.title)
    await open(page, 'Customer relationships'); await tab(page, 'Leads')
    await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill(recovery.lead)
    await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill(recovery.email)
    await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill(recovery.company)
    await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
    await expect(article(page, recovery.lead)).toContainText('lead-0001')
    assert.deepEqual((await exportAll(page, artifactDir, 'evaluator-recovery-01-all-changed')).workspaces, changed)
    const before = await saves(context, origin)
    assert.deepEqual(auxiliary(before), baseline.auxiliary)
    for (const module of modules) assert.deepEqual(JSON.parse(saved(before, module)), { schemaVersion: 1, module, data: changed[module] })
    assert.equal(before.some(item => item.name === historyKey), false)
    checks.push('WX-0907: actual combined baseline download and visible HR/CMS/CRM changes export exactly the independent complete expected records')

    const backup = page.getByRole('region', { name: 'Combined workspace backup', exact: true })
    const chooser = page.waitForEvent('filechooser')
    await backup.getByRole('button', { name: 'Import combined backup', exact: true }).click()
    await (await chooser).setFiles(baseline.path)
    const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
    await expect(preview.getByRole('heading', { name: 'Choose workspaces to restore', exact: true })).toBeVisible()
    for (const module of ['HR', 'CMS', 'CRM']) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${module}\\b`) })).not.toBeChecked()
    await expect(preview.getByRole('button', { name: 'Restore selected workspaces', exact: true })).toBeDisabled()
    await preview.getByRole('checkbox', { name: /^Restore CMS\b/ }).check()
    await expect(preview.getByRole('checkbox', { name: /^Restore HR\b/ })).not.toBeChecked()
    await expect(preview.getByRole('checkbox', { name: /^Restore CRM\b/ })).not.toBeChecked()
    await expect(preview).toContainText('CMS will be replaced and saved')
    assert.deepEqual(await saves(context, origin), before, 'Import preview/selection has changed no saved byte')
    await page.screenshot({ path: join(artifactDir, 'evaluator-recovery-cms-only-preview.png'), fullPage: true })
    await preview.getByRole('button', { name: 'Restore selected workspaces', exact: true }).click()
    await expect(preview).toBeHidden()
    const restored = { hr: changed.hr, cms: seed.workspaces.cms, crm: changed.crm }
    assert.deepEqual((await exportAll(page, artifactDir, 'evaluator-recovery-02-cms-restored')).workspaces, restored)
    const afterRestore = await saves(context, origin)
    assert.deepEqual(JSON.parse(saved(afterRestore, 'cms')), { schemaVersion: 1, module: 'cms', data: seed.workspaces.cms }, 'Restored CMS is persisted, not only visible in memory')
    for (const module of ['hr', 'crm']) assert.equal(saved(afterRestore, module), saved(before, module), `Unchecked ${module} raw save bytes are unchanged`)
    assert.deepEqual(auxiliary(afterRestore), baseline.auxiliary)
    const points = JSON.parse(afterRestore.find(item => item.name === historyKey).value)
    assert.deepEqual(Object.keys(points).sort(), ['points', 'schemaVersion']); assert.equal(points.schemaVersion, 1)
    assert.equal(points.points.length, 1)
    const firstPoint = points.points[0]
    assert.deepEqual(Object.keys(firstPoint).sort(), ['createdAt', 'id', 'kind', 'modules', 'states'])
    assert.equal(firstPoint.kind, 'restore'); assert.deepEqual(firstPoint.modules, ['cms']); assert.deepEqual(firstPoint.states, { cms: changed.cms })
    assert.match(firstPoint.id, /^[a-f0-9-]{36}$/); assert.equal(new Date(firstPoint.createdAt).toISOString(), firstPoint.createdAt)
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue(seed.workspaces.cms.entries.find(item => item.id === 'cms-article-001').title)
    await open(page, 'People & HR')
    await page.getByRole('navigation', { name: 'Management HR pages', exact: true }).getByRole('link', { name: 'Performance', exact: true }).click()
    await expect(page.getByText(recovery.goal, { exact: true })).toBeVisible()
    await open(page, 'Customer relationships'); await tab(page, 'Leads')
    await expect(article(page, recovery.lead)).toContainText('lead-0001')
    await open(page, 'Portal directory')
    checks.push('WX-0907: only CMS is selected and restored from the actual baseline download; full HR/CRM records, their exact raw save bytes and visible changes survive; automatic point captures CMS only')

    const history = page.getByRole('region', { name: 'Restore points', exact: true })
    await expect(history.getByText('Before selective restore · CMS', { exact: true })).toBeVisible()
    await history.getByRole('button', { name: /^Undo restore point .* CMS$/ }).click()
    const undo = history.getByRole('region', { name: 'Undo preview', exact: true })
    await expect(undo.getByRole('heading', { name: 'Undo CMS', exact: true })).toBeVisible()
    await expect(undo).toContainText('entire CMS workspace')
    await undo.getByRole('button', { name: 'Confirm undo', exact: true }).click()
    await expect(undo).toBeHidden()
    assert.deepEqual((await exportAll(page, artifactDir, 'evaluator-recovery-03-undo')).workspaces, changed)
    const afterUndo = await saves(context, origin)
    for (const module of modules) assert.equal(saved(afterUndo, module), saved(before, module), `${module} returns to its exact pre-restore raw save bytes`)
    assert.deepEqual(auxiliary(afterUndo), baseline.auxiliary)
    const finalHistory = JSON.parse(afterUndo.find(item => item.name === historyKey).value)
    assert.equal(finalHistory.points.length, 2)
    assert.deepEqual(finalHistory.points[1], firstPoint)
    const undoPoint = finalHistory.points[0]
    assert.deepEqual(Object.keys(undoPoint).sort(), ['createdAt', 'id', 'kind', 'modules', 'sourcePointId', 'states'])
    assert.equal(undoPoint.kind, 'undo'); assert.equal(undoPoint.sourcePointId, firstPoint.id)
    assert.deepEqual(undoPoint.modules, ['cms']); assert.deepEqual(undoPoint.states, { cms: seed.workspaces.cms })
    assert.match(undoPoint.id, /^[a-f0-9-]{36}$/); assert.notEqual(undoPoint.id, firstPoint.id)
    assert.equal(new Date(undoPoint.createdAt).toISOString(), undoPoint.createdAt)
    await page.reload()
    assert.deepEqual(await saves(context, origin), afterUndo, 'Reload preserves complete saves and both history records byte for byte')
    assert.deepEqual((await exportAll(page, artifactDir, 'evaluator-recovery-04-reloaded')).workspaces, changed)
    await expect(history.getByText('Before Undo · CMS', { exact: true })).toBeVisible()
    await page.screenshot({ path: join(artifactDir, 'evaluator-recovery-undo-history.png'), fullPage: true })
    assert.deepEqual(problems, [])
    checks.push('WX-0907: visible Undo CMS reverses the single-module restore, all three complete exports and raw save bytes match pre-restore state, and exact two-point CMS-only history survives reload')
    await writeFile(join(artifactDir, 'evaluator-recovery-evidence.json'), JSON.stringify({ seedName: seed.name, seedSha256: seed.sha256, selectedModules: ['cms'], expectedBeforeRestore: changed, expectedAfterRestore: restored, expectedAfterUndo: changed, history: finalHistory, untouchedRawSaveBytesPreserved: ['hr', 'crm'], problems }, null, 2) + '\n')
    return { checks, warnings, selectedModules: ['cms'], untouchedModules: ['hr', 'crm'], historyPoints: 2, restoredAndReversed: true }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'evaluator-recovery-failure.png'), fullPage: true }) } catch { /* Keep primary failure. */ }
    error.smokeEvidence = { checks, problems, warnings }; throw error
  } finally {
    if (context && tracing) try { await context.tracing.stop({ path: join(artifactDir, 'evaluator-recovery-trace.zip') }) } catch { /* Keep primary evidence. */ }
    if (context) await context.close()
  }
}

/** Reuse the existing independently expected HR/CMS journeys, then exercise
 * the added movement and exactly-one-module recovery acceptance boundaries.
 * Five/ten minutes are human pacing designs, never automation timing claims.
 */
export async function runEvaluatorDemos(resources) {
  const hr = await runPayrollLifecycle(resources)
  const cmsAndConversion = await runCmsCrmLifecycles(resources)
  const crm = await runCrmMovement(resources)
  const recoveryResult = await runOneModuleRecovery(resources)
  const result = {
    checks: [...hr.checks.map(line => `WX-0904 HR evaluator: ${line}`), ...cmsAndConversion.checks.map(line => `WX-0905 CMS/existing CRM baseline: ${line}`), ...crm.checks, ...recoveryResult.checks],
    warnings: [...new Set([...hr.warnings, ...cmsAndConversion.warnings, ...crm.warnings, ...recoveryResult.warnings])],
    baselineHash: resources.seed.sha256,
    demos: { hr: { ...hr, designedHumanMinutes: 5 }, cms: { ...cmsAndConversion, designedHumanMinutes: 5 }, crm: { ...crm, designedHumanMinutes: 5 }, recovery: { ...recoveryResult, designedHumanMinutes: 10 } },
    timingScope: 'Automated browser verification. Designed human pacing has not been measured with a stopwatch.',
  }
  await writeFile(join(resources.artifactDir, 'evaluator-demos-evidence.json'), JSON.stringify(result, null, 2) + '\n')
  return result
}
