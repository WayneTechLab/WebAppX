import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { seedName } from './seed-contract.mjs'

const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, title) => navigation(page).getByRole('link', { name: title, exact: true }).click()
const crmTab = (page, label) => page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: label, exact: true }).click()
const article = (page, title) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const content = Object.freeze({ title: 'Fictional editorial lifecycle release', slug: 'fictional-editorial-release', body: 'This approved fictional article is the exact public sample retained while its later draft changes.' })
const laterContent = Object.freeze({ title: 'Fictional editorial lifecycle next draft', slug: 'fictional-editorial-next-draft', body: 'This later fictional draft is private to the editorial workspace and must never replace the approved public sample.' })
const lead = Object.freeze({ name: 'Lifecycle Fiction', email: 'lifecycle@editorial-fixture.invalid', companyName: 'Fictional Lifecycle Studio' })
const opportunityTitle = `${lead.companyName} · sample opportunity`
const followUpTitle = 'Prepare fictional lifecycle discovery notes'

async function exportWorkspaces(page, artifactDir, label) {
  await open(page, 'Portal directory')
  const waiting = page.waitForEvent('download')
  await page.getByRole('region', { name: 'Combined workspace backup', exact: true }).getByRole('button', { name: 'Export all workspaces', exact: true }).click()
  const download = await waiting
  assert.match(download.suggestedFilename(), /^webappx-all-mock-workspaces-.*\.json$/)
  const path = join(artifactDir, `${label}.json`)
  await download.saveAs(path)
  assert.equal(await download.failure(), null, 'The real combined backup download must complete')
  const payload = JSON.parse(await readFile(path, 'utf8'))
  assert.deepEqual(Object.keys(payload).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(payload.format, 'webappx-mock-workspaces')
  assert.equal(payload.schemaVersion, 1)
  assert.equal(new Date(payload.exportedAt).toISOString(), payload.exportedAt)
  return payload.workspaces
}

async function savedState(context, origin) {
  const storage = await context.storageState()
  assert.deepEqual(storage.cookies, [], 'Fictional lifecycle controls must not create account/session cookies')
  assert.ok(storage.origins.every(item => item.origin === origin), 'Browser saves must remain on the owned isolated origin')
  return storage.origins.find(item => item.origin === origin)?.localStorage ?? []
}

async function assertSnapshot({ page, context, origin, artifactDir, expected, auxiliary, module, label }) {
  assert.deepEqual(await exportWorkspaces(page, artifactDir, label), expected, `${label}: every module record must match its independently stated expected payload`)
  const saves = await savedState(context, origin)
  assert.deepEqual(saves.filter(item => !item.name.startsWith('webappx.demo.')), auxiliary, 'Domain changes must preserve the exact baseline accessibility preference')
  const domain = saves.filter(item => item.name.startsWith('webappx.demo.'))
  assert.deepEqual(domain.map(item => item.name), [`webappx.demo.${module}`], 'Only the exercised module may acquire a save; no recovery history or other portal save is created')
  assert.deepEqual(JSON.parse(domain[0].value), { schemaVersion: 1, module, data: expected[module] }, 'The complete saved envelope must contain exactly the expected records and receipts')
  return saves
}

async function baseline(page, context, origin, artifactDir, seed, label) {
  await page.goto(`${origin}/portals`)
  await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
  assert.deepEqual(await exportWorkspaces(page, artifactDir, label), seed.workspaces, 'Fresh native defaults must equal the complete reviewed named synthetic seed')
  const saves = await savedState(context, origin)
  assert.deepEqual(saves.map(item => item.name), ['sfwa-wtl:accessibility-preferences'], 'A fresh context must have no native workspace saves or restore history')
  return saves
}

async function metric(page, label, value) {
  await expect(page.getByText(label, { exact: true }).locator('..').getByText(String(value), { exact: true })).toBeVisible()
}

async function cmsMetrics(page, totals) {
  const metrics = page.getByRole('region', { name: 'CMS metrics', exact: true })
  for (const [label, value] of Object.entries(totals)) await metric(metrics, label, value)
}

async function crmMetrics(page, totals) {
  await crmTab(page, 'Dashboard')
  await metric(page, 'Active sample leads', totals.activeLeads)
  await metric(page, 'Open sample pipeline', money(totals.openPipelineCents))
  await metric(page, 'Sample won value', money(totals.wonCents))
  await metric(page, 'Open follow-ups', totals.openFollowUps)
}

async function publicProjection(page, expected) {
  const preview = page.getByRole('region', { name: 'Published sample preview', exact: true })
  const items = preview.getByRole('article')
  await expect(items).toHaveCount(expected.length)
  const observed = []
  for (let index = 0; index < expected.length; index += 1) {
    const item = items.nth(index)
    await expect(item.getByRole('heading', { level: 3 })).toHaveText(expected[index].title)
    await expect(item.locator('p')).toHaveCount(3)
    observed.push({ reference: await item.locator('p').nth(0).innerText(), title: await item.getByRole('heading', { level: 3 }).innerText(), body: await item.locator('p').nth(1).innerText(), receipt: await item.locator('p').nth(2).innerText() })
  }
  assert.deepEqual(observed, expected, 'Rendered public articles must contain exactly the frozen title, path, revision, body and publication receipt')
  // Compare every descendant's text, including anything outside the known
  // article fields, so an extra draft or private metadata node cannot leak.
  await expect(preview).toHaveText([
    'Local published projection', 'Published sample preview',
    'Only frozen published snapshots appear below. Draft text, review feedback and author details are excluded. This is an in-app preview, with no network publication.',
    ...expected.flatMap(item => [item.reference, item.title, item.body, item.receipt]),
  ].join(''))
  return observed
}

function cmsReceipt(expected, actorId, revision, receipt, action) {
  expected.cms.activity.push({ receipt, entryId: 'cms-article-001', revision, actorId, action })
}

function crmReceipt(expected, receipt, action, description) {
  expected.crm.activity.unshift({ receipt, ownerId: 'crm-owner', action, description })
}

/** The owned suite starts two fresh browser contexts from the reviewed native
 * seed. Domain mutations use rendered controls only. Complete downloads, saved
 * envelopes, receipts and public text are read as evidence, with explicit test
 * expectations; no application transitions, browser storage writes or injected
 * application state are used to construct the expected results. A separate
 * browser-domain negative probe invokes the actual served model only on a
 * detached clone of a real UI download to exercise its replay guard.
 */
export async function runCmsCrmLifecycles({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], evidence = { seedName: seed.name, seedSha256: seed.sha256, cms: {}, crm: {} }
  let context, page, traceName
  try {
    assert.equal(seed.name, seedName)
    assert.match(seed.sha256, /^[a-f0-9]{64}$/, 'The harness must validate and retain the named fixture digest before browser setup')
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    traceName = 'cms-editorial-trace.zip'
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    const auxiliary = await baseline(page, context, origin, artifactDir, seed, 'cms-00-named-seed')
    const expected = structuredClone(seed.workspaces)
    const entry = expected.cms.entries.find(item => item.id === 'cms-article-001')
    const snapshot = label => assertSnapshot({ page, context, origin, artifactDir, expected, auxiliary, module: 'cms', label })
    await open(page, 'Content management')
    await cmsMetrics(page, { Drafts: 1, 'Awaiting review': 0, 'Approved revisions': 0, 'Published samples': 1 })
    checks.push('WX-0677: fresh isolated CMS context exports the entire named synthetic seed with no prior domain saves')

    await page.locator('#edit-title').fill(content.title)
    await page.locator('#edit-slug').fill(content.slug)
    await page.locator('#edit-body').fill(content.body)
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    Object.assign(entry, content, { revision: 2, status: 'draft', approval: null, feedback: '' })
    expected.cms.sequence = 1
    cmsReceipt(expected, 'cms-author', 2, 'MOCK-CMS-0001', 'Saved draft revision; previous approval invalidated')
    await snapshot('cms-01-saved-draft')
    await open(page, 'Content management')
    await expect(page.locator('#edit-title')).toHaveValue(content.title)
    await expect(page.getByRole('button', { name: 'Approve revision 2', exact: true })).toHaveCount(0)
    checks.push('WX-0677: author saves exact revision 2 and receipt 0001; complete HR, CRM and other CMS records remain unchanged')

    await page.getByRole('button', { name: 'Request review', exact: true }).click()
    entry.status = 'in-review'; expected.cms.sequence = 2
    cmsReceipt(expected, 'cms-author', 2, 'MOCK-CMS-0002', 'Requested review')
    await cmsMetrics(page, { Drafts: 0, 'Awaiting review': 1, 'Approved revisions': 0, 'Published samples': 1 })
    const beforeApproval = await snapshot('cms-02-requested-review')
    await open(page, 'Content management')
    await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-publisher')
    await expect(page.getByRole('button', { name: 'Simulate publication', exact: true })).toBeDisabled()
    assert.deepEqual(await savedState(context, origin), beforeApproval, 'Switching to publisher before review must not change saved state')
    await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-reviewer')
    await page.getByRole('button', { name: 'Approve revision 2', exact: true }).click()
    Object.assign(entry, { status: 'approved', approval: { revision: 2, reviewerId: 'cms-reviewer', receipt: 'MOCK-CMS-0003' } })
    expected.cms.sequence = 3
    cmsReceipt(expected, 'cms-reviewer', 2, 'MOCK-CMS-0003', 'Approved exact draft revision')
    await cmsMetrics(page, { Drafts: 0, 'Awaiting review': 0, 'Approved revisions': 1, 'Published samples': 1 })
    await snapshot('cms-03-separate-reviewer-approved')
    await open(page, 'Content management')
    checks.push('WX-0677: publisher is disabled before approval; a separate reviewer approves exact revision 2 with receipt 0003')

    await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-publisher')
    await page.getByRole('button', { name: 'Simulate publication', exact: true }).click()
    entry.status = 'published'
    entry.published = { ...content, revision: 2, receipt: 'MOCK-CMS-0004' }
    expected.cms.sequence = 4
    cmsReceipt(expected, 'cms-publisher', 2, 'MOCK-CMS-0004', 'Simulated publication')
    const projection = [
      { reference: 'pages / welcome · published revision 1', title: 'Welcome to the sample studio', body: 'This fictional public page is a published sample. Create a draft, ask another preview role to review it, then simulate publication.', receipt: 'SEED-CMS-PUBLICATION' },
      { reference: `articles / ${content.slug} · published revision 2`, title: content.title, body: content.body, receipt: 'MOCK-CMS-0004' },
    ]
    evidence.cms.publishedProjection = await publicProjection(page, projection)
    await cmsMetrics(page, { Drafts: 0, 'Awaiting review': 0, 'Approved revisions': 0, 'Published samples': 2 })
    await page.screenshot({ path: join(artifactDir, 'cms-04-published-projection.png'), fullPage: true })
    await snapshot('cms-04-published')
    await open(page, 'Content management')
    checks.push('WX-0677: publisher freezes the exact approved content and receipt 0004; rendered public projection has only its frozen public fields')

    await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-author')
    await page.locator('#edit-title').fill(laterContent.title)
    await page.locator('#edit-slug').fill(laterContent.slug)
    await page.locator('#edit-body').fill(laterContent.body)
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    Object.assign(entry, laterContent, { revision: 3, status: 'draft', approval: null, feedback: '' })
    expected.cms.sequence = 5
    cmsReceipt(expected, 'cms-author', 3, 'MOCK-CMS-0005', 'Saved draft revision; previous approval invalidated')
    await expect(page.getByRole('region', { name: 'Selected content', exact: true })).toContainText('The published sample is still revision 2. This draft has not replaced it.')
    await publicProjection(page, projection)
    await page.reload()
    await expect(page.locator('#edit-title')).toHaveValue(laterContent.title)
    await expect(page.locator('#edit-slug')).toHaveValue(laterContent.slug)
    await expect(page.locator('#edit-body')).toHaveValue(laterContent.body)
    evidence.cms.reloadedProjection = await publicProjection(page, projection)
    await cmsMetrics(page, { Drafts: 1, 'Awaiting review': 0, 'Approved revisions': 0, 'Published samples': 2 })
    const afterEdit = await snapshot('cms-05-later-draft-reloaded')
    await open(page, 'Content management')
    await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption('cms-publisher')
    await expect(page.getByRole('button', { name: 'Simulate publication', exact: true })).toBeDisabled()
    assert.deepEqual(await savedState(context, origin), afterEdit, 'The invalidated approval cannot produce another publication or receipt')
    await page.screenshot({ path: join(artifactDir, 'cms-05-frozen-publication-later-draft.png'), fullPage: true })
    evidence.cms.finalState = expected.cms
    evidence.cms.finalTotals = { drafts: 1, awaitingReview: 0, approvedRevisions: 0, publishedSamples: 2 }
    checks.push('WX-0677: later revision 3 invalidates approval while exact revision 2 public projection survives reload; disabled publisher preserves every saved record')
    await context.tracing.stop({ path: join(artifactDir, traceName) }); traceName = undefined
    await context.close(); context = undefined

    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    traceName = 'crm-conversion-trace.zip'
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
    const crmAuxiliary = await baseline(page, context, origin, artifactDir, seed, 'crm-00-named-seed')
    const crmExpected = structuredClone(seed.workspaces)
    const crmSnapshot = label => assertSnapshot({ page, context, origin, artifactDir, expected: crmExpected, auxiliary: crmAuxiliary, module: 'crm', label })
    await open(page, 'Customer relationships')
    await crmMetrics(page, { activeLeads: 2, openPipelineCents: 650000, wonCents: 0, openFollowUps: 1 })
    checks.push('WX-0678: a second fresh context exports the same entire named seed, proving no CMS lifecycle data leaks into CRM setup')

    await crmTab(page, 'Leads')
    await page.getByRole('textbox', { name: 'Lead name', exact: true }).fill(lead.name)
    await page.getByRole('textbox', { name: 'Lead email', exact: true }).fill(lead.email)
    await page.getByRole('textbox', { name: 'Lead company', exact: true }).fill(lead.companyName)
    await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
    crmExpected.crm.leads.push({ id: 'lead-0001', ...lead, ownerId: 'crm-owner', status: 'new' })
    crmExpected.crm.sequence = 2
    crmReceipt(crmExpected, 'MOCK-CRM-0001', 'create-lead', `Created sample lead ${lead.name}.`)
    await expect(article(page, lead.name)).toContainText('lead-0001')
    await crmMetrics(page, { activeLeads: 3, openPipelineCents: 650000, wonCents: 0, openFollowUps: 1 })
    await crmSnapshot('crm-01-created-lead')
    await open(page, 'Customer relationships')
    await crmTab(page, 'Leads')
    await article(page, lead.name).getByRole('button', { name: 'Qualify sample lead', exact: true }).click()
    const createdLead = crmExpected.crm.leads.at(-1)
    createdLead.status = 'qualified'; crmExpected.crm.sequence = 3
    crmReceipt(crmExpected, 'MOCK-CRM-0002', 'qualify-lead', `Qualified ${lead.name}; conversion is now available.`)
    await expect(article(page, lead.name).getByRole('button', { name: 'Convert sample lead', exact: true })).toBeVisible()
    await crmSnapshot('crm-02-qualified-lead')
    await open(page, 'Customer relationships')
    await crmTab(page, 'Leads')
    checks.push('WX-0678: rendered controls create lead-0001 and qualify it with exact receipts 0001–0002; full HR/CMS and existing CRM payloads are preserved')

    const conversionAmount = article(page, lead.name).getByRole('spinbutton', { name: 'Sample opportunity amount (USD)', exact: true })
    await conversionAmount.fill('1750.25')
    // Two native Enter inputs are sent without a wait between them. The first
    // accepted submit removes the form; the second Enter has no remaining
    // conversion control. This observes UI prevention, not reducer denial.
    await conversionAmount.press('Enter')
    await page.keyboard.press('Enter')
    Object.assign(createdLead, { status: 'converted', companyId: 'company-0003', contactId: 'contact-0003', opportunityId: 'opportunity-0003' })
    crmExpected.crm.companies.push({ id: 'company-0003', name: lead.companyName, ownerId: 'crm-owner' })
    crmExpected.crm.contacts.push({ id: 'contact-0003', name: lead.name, email: lead.email, companyId: 'company-0003', ownerId: 'crm-owner' })
    crmExpected.crm.opportunities.push({ id: 'opportunity-0003', title: opportunityTitle, companyId: 'company-0003', contactId: 'contact-0003', ownerId: 'crm-owner', amountCents: 175025, stage: 'discovery', leadId: 'lead-0001' })
    crmExpected.crm.sequence = 4
    crmReceipt(crmExpected, 'MOCK-CRM-0003', 'convert-lead', `Converted ${lead.name} into linked company, contact and opportunity records.`)
    await expect(article(page, lead.name)).toContainText('Converted once. Company company-0003, contact contact-0003 and opportunity opportunity-0003 are linked in the pipeline and directory.')
    await expect(article(page, lead.name).getByRole('button', { name: 'Convert sample lead', exact: true })).toHaveCount(0)
    const convertedSave = await savedState(context, origin)
    await page.keyboard.press('Enter')
    assert.deepEqual(await savedState(context, origin), convertedSave, 'Another native Enter after conversion cannot create a duplicate linked graph or receipt when its form is gone')
    evidence.crm.conversionReplay = { nativeEnterInputs: 3, controlRemoved: true, savedPayloadUnchangedAfterAdditionalEnter: true, renderedRefusalExercised: false }
    await crmMetrics(page, { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 1 })
    await page.getByRole('heading', { name: 'Linked account directory', exact: true }).locator('..').getByText('3 fictional companies · 3 contacts · 3 successful sample actions', { exact: true }).waitFor({ state: 'visible' })
    await crmTab(page, 'Pipeline')
    await expect(article(page, opportunityTitle)).toContainText('opportunity-0003')
    await expect(article(page, opportunityTitle)).toContainText('$1,750.25')
    await crmTab(page, 'Companies & contacts')
    await expect(article(page, lead.companyName)).toContainText('company-0003')
    await expect(article(page, lead.companyName)).toContainText(lead.name)
    await expect(article(page, lead.companyName)).toContainText(lead.email)
    await crmSnapshot('crm-03-converted-linked-records')
    // The UI intentionally has no second conversion form. Exercise the real
    // browser-served guard explicitly, without installing the detached input or
    // a returned value into application state. This is a negative SUT call, not
    // an expected-record oracle or a second rendered form submission.
    const convertedDownload = JSON.parse(await readFile(join(artifactDir, 'crm-03-converted-linked-records.json'), 'utf8')).workspaces.crm
    const beforeReplayProbe = await savedState(context, origin)
    const replayProbe = await page.evaluate(async downloadedState => {
      const { transitionCrm } = await import('/src/crm/model.ts')
      const detachedInput = structuredClone(downloadedState)
      const initialBytes = JSON.stringify(detachedInput)
      try {
        const unexpectedState = transitionCrm(detachedInput, { id: 'crm-owner', role: 'owner', label: 'Casey Example · Owner' }, { type: 'convert-lead', leadId: 'lead-0001', amountCents: 175025 })
        return { refused: false, unexpectedState, inputUnchanged: JSON.stringify(detachedInput) === initialBytes, input: detachedInput }
      } catch (error) {
        return { refused: true, message: error instanceof Error ? error.message : String(error), inputUnchanged: JSON.stringify(detachedInput) === initialBytes, input: detachedInput }
      }
    }, convertedDownload)
    assert.deepEqual(replayProbe, { refused: true, message: 'Qualify the sample lead before conversion; a converted lead cannot be converted again.', inputUnchanged: true, input: convertedDownload }, 'The actual browser-served model must refuse replay on the exact downloaded converted graph without mutating the detached input')
    assert.deepEqual(await savedState(context, origin), beforeReplayProbe, 'The detached negative probe must leave every actual application save byte unchanged')
    Object.assign(evidence.crm.conversionReplay, { browserDomainRefusalExercised: true, source: '/src/crm/model.ts', inputSource: 'crm-03-converted-linked-records.json', message: replayProbe.message, detachedInputUnchanged: true, applicationSaveBytesUnchanged: true, scope: 'Explicit browser-domain negative probe on a detached UI download; ordinary domain changes use rendered controls.' })
    await open(page, 'Customer relationships')
    checks.push('WX-0678: conversion creates exactly linked company/contact/opportunity-0003 and receipt 0003; rendered directory, pipeline and exact dashboard deltas agree')
    checks.push('WX-0678: rapid native Enter inputs create one conversion only; an explicit browser-domain replay probe refuses the actual downloaded graph with the literal guard error, unchanged detached input and unchanged application-save bytes')

    await crmTab(page, 'Follow-up tasks')
    await page.getByRole('textbox', { name: 'Follow-up title', exact: true }).fill(followUpTitle)
    await page.getByRole('combobox', { name: 'Follow-up opportunity', exact: true }).selectOption('opportunity-0003')
    await page.getByRole('button', { name: 'Create sample follow-up', exact: true }).click()
    crmExpected.crm.tasks.push({ id: 'task-0004', title: followUpTitle, opportunityId: 'opportunity-0003', ownerId: 'crm-owner', status: 'open' })
    crmExpected.crm.sequence = 5
    crmReceipt(crmExpected, 'MOCK-CRM-0004', 'create-task', `Assigned ${followUpTitle} to the opportunity owner.`)
    await expect(article(page, followUpTitle)).toContainText('Assigned to Casey Example')
    await crmMetrics(page, { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 2 })
    await crmSnapshot('crm-04-created-follow-up')
    await open(page, 'Customer relationships')
    await crmTab(page, 'Follow-up tasks')
    await article(page, followUpTitle).getByRole('button', { name: 'Complete sample follow-up', exact: true }).click()
    crmExpected.crm.tasks.at(-1).status = 'done'; crmExpected.crm.sequence = 6
    crmReceipt(crmExpected, 'MOCK-CRM-0005', 'complete-task', `Completed sample task ${followUpTitle}.`)
    await expect(article(page, followUpTitle).getByRole('button', { name: 'Complete sample follow-up', exact: true })).toHaveCount(0)
    await expect(article(page, followUpTitle).getByText('done', { exact: true })).toBeVisible()
    await crmMetrics(page, { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 1 })
    await crmSnapshot('crm-05-completed-follow-up')
    await open(page, 'Customer relationships')
    checks.push('WX-0678: task-0004 is linked to opportunity-0003 and its owner; completing it creates receipt 0005 and returns open follow-ups from 2 to 1')

    await page.reload()
    await crmMetrics(page, { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 1 })
    await crmTab(page, 'Leads')
    await expect(article(page, lead.name)).toContainText('Converted once. Company company-0003, contact contact-0003 and opportunity opportunity-0003 are linked in the pipeline and directory.')
    await expect(article(page, lead.name).getByRole('button', { name: 'Convert sample lead', exact: true })).toHaveCount(0)
    await crmTab(page, 'Follow-up tasks')
    await expect(article(page, followUpTitle).getByText('done', { exact: true })).toBeVisible()
    await page.screenshot({ path: join(artifactDir, 'crm-06-reloaded-completed-follow-up.png'), fullPage: true })
    await crmSnapshot('crm-06-reloaded-linked-records')
    evidence.crm.finalState = crmExpected.crm
    evidence.crm.finalTotals = { activeLeads: 2, openPipelineCents: 825025, wonCents: 0, openFollowUps: 1 }
    checks.push('WX-0678: reload preserves the exact linked graph, five successful receipts, sequence 6 and completed follow-up; full HR/CMS records remain the named seed')
    await context.tracing.stop({ path: join(artifactDir, traceName) }); traceName = undefined
    await context.close(); context = undefined
    assert.deepEqual(problems, [], 'CMS/CRM lifecycles require zero external/provider/backend traffic, failed HTTP requests, console errors or uncaught exceptions')
    checks.push('Both owned isolated contexts complete with zero unexpected browser errors, failed HTTP requests or external/provider/backend traffic')
    await writeFile(join(artifactDir, 'cms-crm-lifecycle-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
    return { checks, warnings, baselineHash: seed.sha256, baselineTotals: seed.dashboardTotals, finalTotals: { cms: evidence.cms.finalTotals, crm: evidence.crm.finalTotals }, conversionReplay: evidence.crm.conversionReplay }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'cms-crm-failure.png'), fullPage: true }) } catch { /* Preserve the primary failure. */ }
    error.smokeEvidence = { checks, problems, warnings, lifecycleEvidence: evidence }
    throw error
  } finally {
    if (context && traceName) {
      try { await context.tracing.stop({ path: join(artifactDir, traceName) }) } catch { /* Preserve the primary failure. */ }
    }
    if (context) await context.close()
  }
}
