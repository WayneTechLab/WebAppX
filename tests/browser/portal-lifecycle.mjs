import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { assertRetainedControl, auditStatusCoverage, auditVisibleControls } from './portal-quality.mjs'

// This is a new, literal ledger for this wave. The legacy 151-state suite is
// separate. These meanings are witnessed only through actual native journeys;
// no domain/React fixtures or source-derived expectation generators are used.
export const lifecycleStatusInventory = Object.freeze({
  employmentPreview: { date: 'Simulation date preview', transfer: 'Confirm sample transfer', leave: 'Confirm sample leave', return: 'Confirm sample return', termination: 'Confirm fictional termination', rehire: 'Retained directory identity and history', template: 'Onboarding template selection preview' },
  employmentOutcome: { date: 'Explicit simulation date accepted.', transfer: 'Sample employment change accepted', leave: 'on-leave', return: 'active', termination: 'terminated', rehire: 'onboarding', onboarding: 'MOCK-ONBOARDING-0003', hire: 'Captured checklist: sample-v2 · Onboarding: draft' },
  employmentRefusal: { unfinishedReview: 'Finish and acknowledge the existing performance review', reportingCycle: 'Affected employee IDs: employee-001, employee-002', changedDate: 'The temporary fields or simulation date changed. Preview this action again before confirming.' },
  instanceHistory: { prior: 'employment-employee-002-1 · prior instance', current: 'employment-employee-002-2 · current instance', legacy: 'Captured checklist: legacy-employee-002 · Onboarding: complete', selected: 'Captured checklist: sample-v2 · Onboarding: draft', templateSaved: 'Template selection accepted. Existing captured checklists and receipts are unchanged.', originalReceipt: 'Original onboarding receipt: MOCK-ONBOARDING-0002', reason: 'Sample reason: Fictional employment ended.', offboarding: 'assigned · lifecycle-5-access' },
  correction: { preview: 'Correction request preview', pending: 'pending', accepted: 'accepted', rejected: 'rejected', stale: 'The current HR action was refused. Preview again; your inputs are kept.', history: 'avery.intervening@fixture.invalid' },
  cmsRelease: { draft: 'Release status: Draft', stale: 'Validation failed', ready: 'Ready to activate', outOfDate: 'Preview out of date', activated: 'Release status: Activated', invalidImport: 'incomplete or incompatible' },
  ownership: { leadPreview: 'Ready to assign this unconverted lead.', accountPreview: 'Ready to transfer this complete linked account.', canceled: 'Preview canceled. CRM records are unchanged.', assignment: 'Reassigned unconverted lead Jules Sample from Riley Sample to Sam Fixture.', transfer: 'Transferred sample account Fictional Harbor Studio from Riley Sample to Sam Fixture; 7 linked records moved together.', stale: 'workspace, identity or selection changed', noOp: 'No-op ownership changes are refused', readOnly: 'Ownership changes are available only to owner and sales manager previews.' },
})
const lifecycleStatusSources = {
  employmentPreview: 'src/hr/components/HrEmploymentLifecycle.tsx:33', employmentOutcome: 'src/hr/components/HrEmploymentLifecycle.tsx:93', employmentRefusal: 'src/hr/lifecycle.ts', instanceHistory: 'src/hr/components/HrEmploymentLifecycle.tsx:208', correction: 'src/hr/components/HrDirectoryCorrections.tsx:159', cmsRelease: 'src/cms/CmsDemo.tsx:100', ownership: 'src/crm/CrmDemo.tsx:120',
}
const qualityRecords = new WeakMap()
function recordFor(page) { if (!qualityRecords.has(page)) qualityRecords.set(page, { statuses: [], controls: [], measurements: [] }); return qualityRecords.get(page) }
async function extraLarge(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await button(page, 'Open accessibility controls').click()
  await button(page.getByRole('group', { name: 'Text size', exact: true }), 'Extra large').click()
  await button(page.getByRole('region', { name: 'Accessibility and page controls', exact: true }), 'Close accessibility controls').click()
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px')
}
async function quality(page, artifactDir, name, scope, keyboardTarget, literalInputs = []) {
  await expect(page.locator('html')).toHaveAttribute('data-wtl-text-scale', 'x-large')
  assert.deepEqual(page.viewportSize(), { width: 390, height: 844 })
  const audit = await auditVisibleControls(page, name, artifactDir)
  const measurements = []
  const controls = scope.locator('input:not([type="file"]):not([type="hidden"]), textarea, select, button')
  for (const locator of await controls.all()) if (await locator.isVisible()) {
    measurements.push(await assertRetainedControl(page, locator))
  }
  const expectedValues = []
  for (const [control, literal] of literalInputs) { await assertRetainedControl(page, control, { value: literal }); expectedValues.push({ name: await control.getAttribute('aria-label') || await control.evaluate(element => [...element.labels].map(label => label.textContent).join(' ')), literal }) }
  if (keyboardTarget) await assertRetainedControl(page, keyboardTarget, { keyboard: true })
  recordFor(page).controls.push(audit); recordFor(page).measurements.push({ name, measurements, literalInputs: expectedValues, keyboard: Boolean(keyboardTarget) })
}
async function observe(page, artifactDir, family, state, locator) {
  const literal = lifecycleStatusInventory[family]?.[state]
  assert.ok(literal, `Unknown lifecycle meaning ${family}/${state}`)
  await expect(locator).toHaveCount(1); await expect(locator).toBeVisible(); await expect(locator).toContainText(literal)
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const before = await locator.innerText()
  const bounds = await locator.boundingBox()
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0 && bounds.height <= 800, `${family}/${state}: readable real DOM witness required`)
  const samples = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return [0.2, 0.5, 0.8].map(fraction => {
      const x = rect.left + rect.width * fraction, y = rect.top + rect.height / 2
      const hit = document.elementFromPoint(x, y)
      return { x, y, uncovered: Boolean(hit && (hit === element || element.contains(hit))), hit: hit?.outerHTML.slice(0, 350) }
    })
  })
  const basename = `status-${family}-${state}`
  await writeFile(join(artifactDir, `${basename}-measurement.json`), JSON.stringify({ bounds, samples, text: before }, null, 2) + '\n')
  if (!samples.every(sample => sample.uncovered)) await capture(page, artifactDir, `${basename}-OCCLUDED`, locator)
  assert.ok(samples.every(sample => sample.uncovered), `${family}/${state}: the real text witness must be uncovered`)
  await capture(page, artifactDir, basename, locator)
  assert.equal(await locator.innerText(), before, `${family}/${state}: capture must preserve the actual text`)
  recordFor(page).statuses.push({ family, state, literal, text: before, capture: `${basename}-monochrome.png`, source: lifecycleStatusSources[family], bounds, samples, mode: 'actual native journey; style-only grayscale capture' })
}

const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const backup = (page, module) => page.getByRole('region', { name: `${module} workspace backup`, exact: true })
const combined = page => page.getByRole('region', { name: 'Combined workspace backup', exact: true })
const upload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
const envelope = (module, data) => ({ format: 'webappx-mock-workspace', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', module, data })
async function slots(page) {
  const state = await page.context().storageState()
  assert.deepEqual(state.cookies, [])
  const origin = new URL(page.url()).origin
  assert.ok(state.origins.every(item => item.origin === origin))
  return Object.fromEntries((state.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}
async function noDialog(page) { await expect(page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true }), 'An unexpectedly dirty completed action must fail this journey').not.toBeVisible() }
async function open(page, name, drafts) {
  await page.getByRole('navigation', { name: 'Template workspaces', exact: true }).getByRole('link', { name, exact: true }).click()
  if (drafts) {
    const dialog = page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole('listitem')).toHaveText(drafts)
    const before = await slots(page)
    await button(dialog, 'Discard and leave').click()
    assert.deepEqual(await slots(page), before, 'Explicitly discarded temporary selection must not write saved records')
  }
  await noDialog(page)
}
const previousDownload = new WeakMap()
async function download(page, control, artifactDir, name) {
  const remaining = 160 - (Date.now() - (previousDownload.get(page) ?? 0)); if (remaining > 0) await delay(remaining)
  previousDownload.set(page, Date.now())
  const [result] = await Promise.all([page.waitForEvent('download'), control.click()])
  const path = join(artifactDir, `${name}.json`); await result.saveAs(path); assert.equal(await result.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
}
async function snapshot(page, artifactDir, name, drafts) {
  await open(page, 'Portal directory', drafts)
  const data = await download(page, button(combined(page), 'Export all workspaces'), artifactDir, name)
  assert.deepEqual(Object.keys(data).sort(), ['exportedAt', 'format', 'schemaVersion', 'workspaces'])
  assert.equal(data.format, 'webappx-mock-workspaces'); assert.equal(data.schemaVersion, 1)
  return data.workspaces
}
async function capture(page, artifactDir, name, scope) {
  const style = await page.addStyleTag({ content: 'html,dialog:modal,dialog::backdrop{filter:grayscale(1)!important}' })
  try {
    if (scope) await scope.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    await (scope ?? page).screenshot({ path: join(artifactDir, `${name}-monochrome.png`), ...(scope ? {} : { fullPage: true }) })
  } finally { await style.evaluate(element => element.remove()) }
}
async function exact(page, artifactDir, name, expected, drafts) {
  assert.deepEqual(await snapshot(page, artifactDir, name, drafts), expected, `${name}: complete three-portal export must equal independent expected payloads`)
  const saved = await slots(page)
  for (const module of ['hr', 'cms', 'crm']) if (saved[`webappx.demo.${module}`] !== undefined) assert.deepEqual(JSON.parse(saved[`webappx.demo.${module}`]), { schemaVersion: 1, module, data: expected[module] })
  return saved
}
async function roundTrip({ page, artifactDir, seed, expected, module }) {
  const label = module.toUpperCase(), title = { hr: 'People & HR', cms: 'Content management', crm: 'Customer relationships' }[module]
  await page.reload()
  const before = await exact(page, artifactDir, `${module}-roundtrip-refreshed`, expected)
  await open(page, title)
  let region = backup(page, label)
  const exported = await download(page, button(region, 'Export workspace'), artifactDir, `${module}-roundtrip-current-individual`)
  assert.deepEqual(exported.data, expected[module])
  await region.getByLabel(`${label} backup JSON file`, { exact: true }).setInputFiles(upload(`${module}-legacy-native-export.json`, envelope(module, seed.workspaces[module])))
  await button(region, `Replace ${label} workspace`).click(); await noDialog(page)
  await exact(page, artifactDir, `${module}-roundtrip-legacy-import`, { ...expected, [module]: seed.workspaces[module] })
  await open(page, title); region = backup(page, label)
  await region.getByLabel(`${label} backup JSON file`, { exact: true }).setInputFiles(upload(`${module}-actual-new-export.json`, exported))
  await quality(page, artifactDir, `${module}-new-extension-import`, region, button(region, `Replace ${label} workspace`))
  await button(region, `Replace ${label} workspace`).click(); await noDialog(page)
  await exact(page, artifactDir, `${module}-roundtrip-new-import`, expected)
  const beforeRestore = await slots(page)
  for (const key of Object.keys(before)) if (key !== `webappx.demo.${module}`) assert.equal(beforeRestore[key], before[key], 'Individual legacy/new imports preserve every unrelated save byte')
  const original = { format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: '2026-10-15T12:00:00.000Z', workspaces: seed.workspaces }
  await combined(page).getByLabel('Combined backup JSON file', { exact: true }).setInputFiles(upload(`${module}-selective-original.json`, original))
  const preview = page.getByRole('region', { name: 'Selective restore preview', exact: true })
  await preview.getByRole('checkbox', { name: new RegExp(`^Restore ${label}`) }).check()
  for (const other of ['HR', 'CMS', 'CRM'].filter(value => value !== label)) await expect(preview.getByRole('checkbox', { name: new RegExp(`^Restore ${other}`) })).not.toBeChecked()
  await quality(page, artifactDir, `${module}-new-extension-selective-restore`, preview, button(preview, 'Restore selected workspaces'))
  await button(preview, 'Restore selected workspaces').click()
  await exact(page, artifactDir, `${module}-roundtrip-selective-original`, { ...expected, [module]: seed.workspaces[module] })
  const history = page.getByRole('region', { name: 'Restore points', exact: true })
  await history.getByRole('button', { name: /^Undo restore point / }).click()
  const undo = page.getByRole('region', { name: 'Undo preview', exact: true })
  await expect(undo).toContainText(`Undo ${label}`)
  await quality(page, artifactDir, `${module}-new-extension-undo`, undo, button(undo, 'Confirm undo'))
  await button(undo, 'Confirm undo').click()
  const afterUndo = await exact(page, artifactDir, `${module}-roundtrip-undo`, expected)
  for (const [key, value] of Object.entries(beforeRestore)) assert.equal(afterUndo[key], value, 'Undo restores complete selected save bytes and preserves every unchecked save/preference')
}

const cmsSelected = page => page.getByRole('region', { name: 'Selected content', exact: true })
const cmsReleases = page => page.getByRole('region', { name: 'Local release bundles', exact: true })
async function cmsActor(page, id) { await page.getByRole('combobox', { name: 'CMS preview identity', exact: true }).selectOption(id); await noDialog(page) }
async function cmsChoose(page, title) { await button(page, new RegExp(`^${title}`)).click() }
function cmsReceipt(cms, entry, actorId, action) { cms.sequence += 1; const receipt = `MOCK-CMS-${String(cms.sequence).padStart(4, '0')}`; cms.activity.push({ receipt, entryId: entry.id, revision: entry.revision, actorId, action }); return receipt }
function capturedReleaseMember(entry) { const { id, collectionId, authorId, revision, title, slug, body, approval, published } = entry; return { entryId: id, collectionId, authorId, revision, title, slug, body, approval: structuredClone(approval), previousPublication: structuredClone(published) } }

export async function cmsLifecycleJourney({ page, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/cms/demo`)
  await extraLarge(page)
  const expected = structuredClone(seed.workspaces), cms = expected.cms, first = cms.entries[0]
  await exact(page, artifactDir, 'cms-00-complete-native-seed', expected)
  await open(page, 'Content management'); await cmsChoose(page, first.title)
  const content = { title: 'Lifecycle release first page', slug: 'lifecycle-first-page', body: 'Fictional first publication captured by the account-free release journey.' }
  for (const [field, value] of Object.entries(content)) await cmsSelected(page).locator(`#edit-${field}`).fill(value)
  await button(cmsSelected(page), 'Save draft revision').click()
  Object.assign(first, content, { revision: 2, status: 'draft', approval: null, feedback: '' }); cmsReceipt(cms, first, 'cms-author', 'Saved draft revision; previous approval invalidated')
  await button(cmsSelected(page), 'Request review').click(); first.status = 'in-review'; cmsReceipt(cms, first, 'cms-author', 'Requested review')
  await cmsActor(page, 'cms-reviewer'); await button(cmsSelected(page), 'Approve revision 2').click()
  first.status = 'approved'; first.approval = { revision: 2, reviewerId: 'cms-reviewer', receipt: cmsReceipt(cms, first, 'cms-reviewer', 'Approved exact draft revision') }
  await cmsActor(page, 'cms-author')
  const create = page.getByRole('heading', { name: 'Create sample content', exact: true }).locator('..')
  const secondContent = { title: 'Lifecycle release second page', slug: 'lifecycle-second-page', body: 'Fictional second publication activated atomically with the first page.' }
  await create.getByLabel('New content collection', { exact: true }).selectOption('pages')
  for (const [field, value] of Object.entries(secondContent)) await create.locator(`#create-${field}`).fill(value)
  await button(create, 'Create draft').click()
  const second = { id: 'cms-entry-0004', collectionId: 'pages', authorId: 'cms-author', revision: 1, status: 'draft', approval: null, published: null, feedback: '', ...secondContent }
  cms.entries.push(second); cmsReceipt(cms, second, 'cms-author', 'Created draft')
  await button(cmsSelected(page), 'Request review').click(); second.status = 'in-review'; cmsReceipt(cms, second, 'cms-author', 'Requested review')
  await cmsActor(page, 'cms-reviewer'); await button(cmsSelected(page), 'Approve revision 1').click()
  second.status = 'approved'; second.approval = { revision: 1, reviewerId: 'cms-reviewer', receipt: cmsReceipt(cms, second, 'cms-reviewer', 'Approved exact draft revision') }
  await cmsActor(page, 'cms-publisher')
  const publicationsBefore = structuredClone(cms.entries.map(entry => entry.published)), activityBefore = structuredClone(cms.activity)
  async function prepare(name) {
    await cmsReleases(page).getByLabel('Release name', { exact: true }).fill(name)
    for (const title of [first.title, second.title]) await cmsReleases(page).getByRole('checkbox', { name: new RegExp(`^${title}`) }).check()
    if (name === 'Fictional stale release') await quality(page, artifactDir, 'cms-release-preparation', cmsReleases(page), button(cmsReleases(page), 'Prepare release draft'), [[cmsReleases(page).getByLabel('Release name', { exact: true }), 'Fictional stale release']])
    await button(cmsReleases(page), 'Prepare release draft').click()
    const bundle = { id: `cms-release-${String((cms.releaseBundles?.length ?? 0) + 1).padStart(4, '0')}`, name, status: 'draft', createdBy: 'cms-publisher', preparedAtSequence: cms.sequence, members: [capturedReleaseMember(first), capturedReleaseMember(second)], activatedAtSequence: null, activatedPublications: null }
    ;(cms.releaseBundles ??= []).push(bundle)
    return bundle
  }
  await prepare('Fictional stale release')
  await observe(page, artifactDir, 'cmsRelease', 'draft', cmsReleases(page).getByText('Release status: Draft', { exact: true }))
  assert.deepEqual(cms.entries.map(entry => entry.published), publicationsBefore); assert.deepEqual(cms.activity, activityBefore)
  await exact(page, artifactDir, 'cms-01-preparation-not-publication', expected)
  checks.push('WX-0314: real author/reviewer approvals feed a named two-entry publisher release; complete exports prove preparation changes only captured release metadata, with all publications/receipts unchanged')
  await open(page, 'Content management'); await cmsActor(page, 'cms-author'); await cmsChoose(page, first.title)
  await cmsSelected(page).getByLabel('Content title', { exact: true }).fill('Lifecycle first page reviewed again')
  await button(cmsSelected(page), 'Save draft revision').click()
  first.title = 'Lifecycle first page reviewed again'; first.revision = 3; first.status = 'draft'; first.approval = null; cmsReceipt(cms, first, 'cms-author', 'Saved draft revision; previous approval invalidated')
  await cmsActor(page, 'cms-publisher'); await button(cmsReleases(page), 'Preview release Fictional stale release').click()
  const activation = page.getByRole('region', { name: 'CMS release activation preview', exact: true })
  await expect(activation).toContainText('captured approval is stale'); await expect(button(activation, 'Confirm activate release')).toBeDisabled()
  await observe(page, artifactDir, 'cmsRelease', 'stale', activation.getByRole('status'))
  const staleBytes = await slots(page); await capture(page, artifactDir, 'cms-02-stale-release-refused', activation)
  await button(activation, 'Cancel release activation').click(); assert.deepEqual(await slots(page), staleBytes)
  await exact(page, artifactDir, 'cms-02-stale-complete-preservation', expected)
  await open(page, 'Content management'); await cmsActor(page, 'cms-author'); await cmsChoose(page, first.title)
  await button(cmsSelected(page), 'Request review').click(); first.status = 'in-review'; cmsReceipt(cms, first, 'cms-author', 'Requested review')
  await cmsActor(page, 'cms-reviewer'); await button(cmsSelected(page), 'Approve revision 3').click(); first.status = 'approved'; first.approval = { revision: 3, reviewerId: 'cms-reviewer', receipt: cmsReceipt(cms, first, 'cms-reviewer', 'Approved exact draft revision') }
  await cmsActor(page, 'cms-publisher'); const fresh = await prepare('Fictional atomic release')
  await button(cmsReleases(page), 'Preview release Fictional atomic release').click(); await expect(activation).toContainText('Ready to activate')
  await observe(page, artifactDir, 'cmsRelease', 'ready', activation.getByRole('status'))
  await quality(page, artifactDir, 'cms-release-confirmation', activation, button(activation, 'Confirm activate release'))
  const beforeIdentityChange = await slots(page)
  await cmsActor(page, 'cms-reviewer')
  await observe(page, artifactDir, 'cmsRelease', 'outOfDate', activation.getByRole('status'))
  await expect(button(activation, 'Confirm activate release')).toBeDisabled()
  assert.deepEqual(await slots(page), beforeIdentityChange, 'A changed preview identity disables activation without touching any save')
  await cmsActor(page, 'cms-publisher'); await expect(activation.getByRole('status')).toHaveText('Ready to activate')
  const readyBytes = await slots(page); await button(activation, 'Cancel release activation').click(); assert.deepEqual(await slots(page), readyBytes)
  await button(cmsReleases(page), 'Preview release Fictional atomic release').click()
  await capture(page, artifactDir, 'cms-03-two-member-ready', activation)
  await button(activation, 'Confirm activate release').click()
  fresh.activatedPublications = [first, second].map(entry => { entry.status = 'published'; entry.published = { title: entry.title, slug: entry.slug, body: entry.body, revision: entry.revision, receipt: cmsReceipt(cms, entry, 'cms-publisher', 'Simulated publication') }; return { entryId: entry.id, publication: structuredClone(entry.published) } })
  fresh.status = 'activated'; fresh.activatedAtSequence = cms.sequence
  await observe(page, artifactDir, 'cmsRelease', 'activated', cmsReleases(page).getByText('Release status: Activated', { exact: true }))
  await expect(button(cmsReleases(page), 'Preview release Fictional atomic release')).toHaveCount(0); await expect(button(page, 'Confirm activate release')).toHaveCount(0)
  await exact(page, artifactDir, 'cms-04-atomic-complete-publications', expected)
  checks.push('WX-0316: real valid release activation changes both exact frozen publications and ordinary receipts in one accepted CMS graph; cancel preserves exact bytes and the activated release exposes no replay action')
  await open(page, 'Content management')
  const invalid = structuredClone(cms); invalid.entries.find(entry => entry.id === second.id).slug = first.slug
  const beforeInvalid = await slots(page)
  await backup(page, 'CMS').getByLabel('CMS backup JSON file', { exact: true }).setInputFiles(upload('NEGATIVE-duplicate-route.json', envelope('cms', invalid)))
  await expect(backup(page, 'CMS').getByRole('alert')).toContainText('incomplete or incompatible'); await expect(button(backup(page, 'CMS'), 'Replace CMS workspace')).toHaveCount(0)
  await observe(page, artifactDir, 'cmsRelease', 'invalidImport', backup(page, 'CMS').getByRole('alert'))
  assert.deepEqual(await slots(page), beforeInvalid); await exact(page, artifactDir, 'cms-05-negative-route-import-preserved', expected)
  checks.push('WX-0315 browser boundary: stale captured approval is identified before activation; a labeled malformed duplicate-route upload is rejected by the strict importer with exact full-record/save preservation. Pure duplicate-preview regression supplies the unreachable invalid-source branch; no invalid React state was injected')
  await roundTrip({ page, artifactDir, seed, expected, module: 'cms' })
  checks.push('CMS lifecycle persistence: real legacy/new individual imports, refresh, CMS-only combined restore and Undo preserve complete release metadata, both publications and every unchecked save byte')
  return { expected, duplicateRouteBoundary: 'Actual strict import refusal; complementary pure preview test, not an injected normal-app preview' }
}

const crmTab = (page, name) => button(page.getByRole('navigation', { name: 'CRM pages', exact: true }), name).click()
const crmCard = (page, title) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
async function crmActor(page, id, drafts) {
  await page.getByRole('combobox', { name: 'CRM preview identity', exact: true }).selectOption(id)
  if (drafts) {
    const dialog = page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
    await expect(dialog.getByRole('listitem')).toHaveText(drafts)
    const before = await slots(page); await button(dialog, 'Discard and leave').click(); assert.deepEqual(await slots(page), before)
  }
  await noDialog(page)
}
function crmReceipt(crm, action, ownerId, description, ownershipChange) {
  const receipt = `MOCK-CRM-${String(crm.sequence).padStart(4, '0')}`
  crm.sequence += 1; crm.activity.unshift({ receipt, ownerId, action, description, ...(ownershipChange ? { ownershipChange } : {}) })
}
export async function crmLifecycleJourney({ page, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/crm/demo`)
  await extraLarge(page)
  const expected = structuredClone(seed.workspaces), crm = expected.crm
  await exact(page, artifactDir, 'crm-00-complete-native-seed', expected); await open(page, 'Customer relationships')
  const assignment = page.getByRole('form', { name: 'Reassign an unconverted lead', exact: true })
  const transfer = page.getByRole('form', { name: 'Transfer a sample account', exact: true })
  const leadPreview = page.getByRole('region', { name: 'Lead assignment preview', exact: true })
  const accountPreview = page.getByRole('region', { name: 'Account ownership transfer preview', exact: true })
  async function assign(actorId, destination, from, fromLabel, toLabel) {
    await crmActor(page, actorId); await crmTab(page, 'Ownership')
    await assignment.getByRole('combobox', { name: 'Lead to reassign', exact: true }).selectOption('lead-jules')
    await assignment.getByRole('combobox', { name: 'New lead assignee', exact: true }).selectOption(destination)
    if (actorId === 'crm-owner') await quality(page, artifactDir, 'crm-assignment-form', assignment, button(assignment, 'Preview lead assignment'), [[assignment.getByRole('combobox', { name: 'Lead to reassign', exact: true }), 'lead-jules'], [assignment.getByRole('combobox', { name: 'New lead assignee', exact: true }), 'sales-sam']])
    await button(assignment, 'Preview lead assignment').click()
    if (actorId === 'crm-owner') await observe(page, artifactDir, 'ownership', 'leadPreview', leadPreview.getByRole('status'))
    const before = await slots(page); await button(leadPreview, 'Cancel lead assignment preview').click(); assert.deepEqual(await slots(page), before)
    if (actorId === 'crm-owner') await observe(page, artifactDir, 'ownership', 'canceled', assignment.locator('..').getByRole('status'))
    await button(assignment, 'Preview lead assignment').click(); await button(leadPreview, 'Confirm lead assignment').click()
    crm.leads.find(lead => lead.id === 'lead-jules').ownerId = destination
    crmReceipt(crm, 'assign-lead', destination, `Reassigned unconverted lead Jules Sample from ${fromLabel} to ${toLabel}.`, { actorId, fromOwnerId: from, toOwnerId: destination, recordId: 'lead-jules', affected: { companies: [], contacts: [], leads: ['lead-jules'], opportunities: [], tasks: [] } })
  }
  await assign('crm-owner', 'sales-sam', 'sales-riley', 'Riley Sample', 'Sam Fixture')
  await assign('crm-manager', 'sales-riley', 'sales-sam', 'Sam Fixture', 'Riley Sample')
  await crmTab(page, 'Activity')
  await observe(page, artifactDir, 'ownership', 'assignment', page.getByText('Reassigned unconverted lead Jules Sample from Riley Sample to Sam Fixture.', { exact: true }))
  await exact(page, artifactDir, 'crm-01-owner-manager-assignment', expected)
  checks.push('WX-0379: owner and sales-manager real previews reassign the unconverted seed lead; complete records contain both fictional assignees and the actual actor, while cancel writes nothing')
  await open(page, 'Customer relationships'); await crmActor(page, 'sales-riley'); await crmTab(page, 'Leads')
  async function createLead(name, address) {
    for (const [label, value] of [['Lead name', name], ['Lead email', address], ['Lead company', 'Fictional Harbor Studio']]) await page.getByLabel(label, { exact: true }).fill(value)
    await button(page, 'Create sample lead').click()
    const lead = { id: `lead-${String(crm.sequence).padStart(4, '0')}`, name, email: address, companyName: 'Fictional Harbor Studio', ownerId: 'sales-riley', status: 'new' }
    crm.leads.push(lead); crmReceipt(crm, 'create-lead', 'sales-riley', `Created sample lead ${name}.`); return lead
  }
  const linked = await createLead('Harbor Linked Sample', 'harbor-linked@fixture.invalid')
  await button(crmCard(page, linked.name), 'Qualify sample lead').click(); linked.status = 'qualified'; crmReceipt(crm, 'qualify-lead', 'sales-riley', `Qualified ${linked.name}; conversion is now available.`)
  await button(crmCard(page, linked.name), 'Convert sample lead').click()
  Object.assign(linked, { status: 'converted', companyId: 'company-harbor', contactId: 'contact-0005', opportunityId: 'opportunity-0005' })
  crm.contacts.push({ id: 'contact-0005', name: linked.name, email: linked.email, companyId: 'company-harbor', ownerId: 'sales-riley' })
  crm.opportunities.push({ id: 'opportunity-0005', title: 'Fictional Harbor Studio · sample opportunity', companyId: 'company-harbor', contactId: 'contact-0005', ownerId: 'sales-riley', amountCents: 150000, stage: 'discovery', leadId: linked.id })
  crmReceipt(crm, 'convert-lead', 'sales-riley', `Converted ${linked.name} into linked company, contact and opportunity records.`)
  const nameOnly = await createLead('Harbor Name Only Sample', 'harbor-name-only@fixture.invalid')
  await crmTab(page, 'Pipeline'); await button(crmCard(page, 'Sample portal discovery'), 'Mark sample lost').click()
  crm.opportunities.find(opportunity => opportunity.id === 'opportunity-harbor').stage = 'lost'; crmReceipt(crm, 'advance-opportunity', 'sales-riley', 'Moved Sample portal discovery to lost.')
  await crmTab(page, 'Follow-up tasks'); await button(crmCard(page, 'Prepare fictional discovery notes'), 'Complete sample follow-up').click()
  crm.tasks[0].status = 'done'; crmReceipt(crm, 'complete-task', 'sales-riley', 'Completed sample task Prepare fictional discovery notes.')
  await crmActor(page, 'crm-owner'); await crmTab(page, 'Ownership')
  await assignment.getByRole('combobox', { name: 'Lead to reassign', exact: true }).selectOption('lead-jules')
  await assignment.getByRole('combobox', { name: 'New lead assignee', exact: true }).selectOption('sales-sam')
  await button(assignment, 'Preview lead assignment').click()
  await transfer.getByRole('combobox', { name: 'Account to transfer', exact: true }).selectOption('company-harbor')
  await transfer.getByRole('combobox', { name: 'New account owner', exact: true }).selectOption('sales-sam')
  await button(transfer, 'Preview account transfer').click()
  const affected = { companies: ['company-harbor'], contacts: ['contact-avery', 'contact-0005'], leads: ['lead-0003'], opportunities: ['opportunity-harbor', 'opportunity-0005'], tasks: ['task-harbor'] }
  const actualRows = await accountPreview.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent)))
  assert.deepEqual(actualRows.map(row => row.slice(0, 2)), [['company', 'company-harbor'], ['contact', 'contact-avery'], ['contact', 'contact-0005'], ['lead', 'lead-0003'], ['opportunity', 'opportunity-harbor'], ['opportunity', 'opportunity-0005'], ['task', 'task-harbor']])
  assert.ok(actualRows.every(row => row[3] === 'Riley Sample' && row[4] === 'Sam Fixture'))
  await expect(accountPreview).toContainText('including closed opportunities and completed tasks')
  await expect(accountPreview.locator('tbody')).not.toContainText(nameOnly.id)
  await observe(page, artifactDir, 'ownership', 'accountPreview', accountPreview.getByRole('status'))
  await quality(page, artifactDir, 'crm-transfer-confirmation', transfer.locator('..'), button(accountPreview, 'Confirm account transfer'), [[transfer.getByRole('combobox', { name: 'Account to transfer', exact: true }), 'company-harbor'], [transfer.getByRole('combobox', { name: 'New account owner', exact: true }), 'sales-sam']])
  const beforeTransfer = await slots(page); await capture(page, artifactDir, 'crm-02-complete-seven-record-graph', accountPreview)
  await button(accountPreview, 'Cancel account transfer preview').click(); assert.deepEqual(await slots(page), beforeTransfer)
  await button(transfer, 'Preview account transfer').click(); await button(accountPreview, 'Confirm account transfer').click()
  for (const group of Object.keys(affected)) for (const id of affected[group]) crm[group].find(record => record.id === id).ownerId = 'sales-sam'
  crmReceipt(crm, 'transfer-account', 'sales-sam', 'Transferred sample account Fictional Harbor Studio from Riley Sample to Sam Fixture; 7 linked records moved together.', { actorId: 'crm-owner', fromOwnerId: 'sales-riley', toOwnerId: 'sales-sam', recordId: 'company-harbor', affected })
  const afterTransfer = await slots(page)
  await button(leadPreview, 'Confirm lead assignment').click()
  await expect(page.getByRole('alert')).toContainText('workspace, identity or selection changed'); assert.deepEqual(await slots(page), afterTransfer)
  await observe(page, artifactDir, 'ownership', 'stale', page.getByRole('alert'))
  await button(transfer, 'Preview account transfer').click()
  await expect(transfer.locator('..').getByRole('alert')).toContainText('No-op ownership changes are refused'); await expect(button(page, 'Confirm account transfer')).toHaveCount(0)
  await observe(page, artifactDir, 'ownership', 'noOp', transfer.locator('..').getByRole('alert'))
  assert.deepEqual(await slots(page), afterTransfer)
  await crmActor(page, 'sales-riley', ['CRM lead assignment selection'])
  await crmTab(page, 'Companies & contacts'); await expect(crmCard(page, 'Fictional Harbor Studio')).toHaveCount(0)
  await crmTab(page, 'Ownership'); await expect(page.getByRole('status').filter({ hasText: /^Ownership changes are available/ })).toContainText('only to owner and sales manager previews')
  await observe(page, artifactDir, 'ownership', 'readOnly', page.getByRole('status').filter({ hasText: /^Ownership changes are available/ }))
  await expect(page.getByRole('combobox', { name: 'Account to transfer', exact: true })).toHaveCount(0)
  await crmActor(page, 'sales-sam'); await crmTab(page, 'Companies & contacts')
  await expect(crmCard(page, 'Fictional Harbor Studio')).toContainText('Harbor Linked Sample')
  await crmTab(page, 'Leads'); await expect(crmCard(page, linked.name)).toContainText('Converted once'); await expect(crmCard(page, nameOnly.name)).toHaveCount(0)
  assert.equal(nameOnly.ownerId, 'sales-riley')
  await crmActor(page, 'crm-owner'); await crmTab(page, 'Activity')
  await observe(page, artifactDir, 'ownership', 'transfer', page.getByText('Transferred sample account Fictional Harbor Studio from Riley Sample to Sam Fixture; 7 linked records moved together.', { exact: true }))
  await exact(page, artifactDir, 'crm-03-complete-atomic-transfer-and-stale-refusal', expected)
  checks.push('WX-0380: actual transfer lists exactly seven linked records, including a converted lead, closed opportunity and completed task; a matching-name unconverted lead is explicitly excluded')
  checks.push('WX-0381: one actual confirmation moves every supported graph owner together while preserving historical activity; a stale second confirmation/no-op are refused byte-for-byte and old/new representative views reflect current graph ownership')
  await roundTrip({ page, artifactDir, seed, expected, module: 'crm' })
  checks.push('CRM ownership persistence: refresh, actual legacy/new individual imports, CRM-only selected restore and Undo retain complete graph ownership/change receipts and all unchecked browser-save bytes')
  return { expected, affected }
}

const people = [
  { id: 'employee-001', name: 'Morgan Example', department: 'Operations', jobTitle: 'Operations Manager', managerId: null, tasks: [{ id: 'intro', title: 'Welcome checklist' }] },
  { id: 'employee-002', name: 'Avery Sample', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001', tasks: [{ id: 'profile', title: 'Profile review' }, { id: 'policy', title: 'Read welcome policy' }] },
  { id: 'employee-003', name: 'Jordan Demo', department: 'Engineering', jobTitle: 'Software Developer', managerId: 'employee-001', tasks: [{ id: 'profile', title: 'Complete own profile' }] },
]
const v2Tasks = [{ id: 'profile', title: 'Complete own profile' }, { id: 'policy', title: 'Review sample welcome checklist' }, { id: 'security', title: 'Review fictional access and security guidance' }]
function initialLifecycle(expected, simulationDate) {
  const instances = people.map(person => {
    const initial = { status: expected.hr.workflow.employeeStatuses[person.id], department: person.department, jobTitle: person.jobTitle, managerId: person.managerId }
    return { id: `employment-${person.id}-1`, employeeId: person.id, startDate: null, endDate: null, initial, current: { ...initial }, templateVersion: `legacy-${person.id}`, tasks: structuredClone(person.tasks) }
  })
  return { schemaVersion: 1, simulationDate, sequence: 1, selectedTemplateVersion: 'sample-v1', instances, activeInstances: Object.fromEntries(people.map(person => [person.id, `employment-${person.id}-1`])), events: [], directoryHistory: [], corrections: [], offboardingAssignments: [] }
}
function lifeEvent(life, kind, date, previous, proposed, employeeId, instanceId, actor = { role: 'employer-owner' }, reason = '') {
  const sequence = life.sequence++; const id = `lifecycle-${sequence}`
  life.events.push({ id, sequence, kind, effectiveDate: date, previous: structuredClone(previous), proposed: structuredClone(proposed), actor, reason, ...(employeeId ? { employeeId, instanceId } : {}) }); return id
}
async function hrPortal(page, name) { await open(page, 'People & HR'); await page.getByRole('navigation', { name: 'Demo portals', exact: true }).getByRole('link', { name, exact: true }).click(); await noDialog(page) }
async function hrPage(page, portal, name) {
  const mobile = page.getByRole('navigation', { name: `${portal} mobile HR pages`, exact: true })
  if (!await mobile.isVisible()) await page.getByText(`Browse ${portal.toLowerCase()} pages`, { exact: true }).click()
  await mobile.getByRole('link', { name, exact: true }).click(); await noDialog(page)
}
async function hrAdmin(page, name) { await hrPortal(page, 'Management'); await hrPage(page, 'Management', name) }
async function hrEmployee(page, expected, id, name) {
  await hrPortal(page, 'Employee')
  const identity = page.getByRole('combobox', { name: /^Synthetic employee identity/ })
  if (await identity.inputValue() !== id) { await identity.selectOption(id); expected.hr.selectedEmployee = id; await noDialog(page) }
  await hrPage(page, 'Employee', name)
}
async function hrManager(page, expected, id, name) {
  await hrPortal(page, 'Manager')
  const identity = page.getByRole('combobox', { name: /^Synthetic manager identity/ })
  if (await identity.inputValue() !== id) { await identity.selectOption(id); expected.hr.selectedManager = id; await noDialog(page) }
  await hrPage(page, 'Manager', name)
}
async function onboard(page, expected, id) {
  await hrEmployee(page, expected, id, 'My onboarding')
  const firstName = people.find(person => person.id === id).name.split(' ')[0]
  const panel = page.getByRole('heading', { name: `Complete sample onboarding · ${firstName}`, exact: true }).locator('..')
  await button(panel, 'Review sample profile').click(); await button(panel, 'Review sample job').click()
  const existing = expected.hr.workflow.onboarding[id]
  const life = expected.hr.workflow.lifecycle
  const tasks = life ? life.instances.find(instance => instance.id === life.activeInstances[id]).tasks : people.find(person => person.id === id).tasks
  for (const task of tasks.filter(task => !existing.tasks[task.id])) await button(panel, `${task.title} Mark complete`).click()
  await button(panel, 'Review onboarding summary').click(); await button(panel, 'Confirm simulated onboarding').click()
  const receipt = `MOCK-ONBOARDING-${String(expected.hr.workflow.sequence).padStart(4, '0')}`; expected.hr.workflow.sequence += 1
  const onboarding = expected.hr.workflow.onboarding[id]
  Object.assign(onboarding, { profileReviewed: true, jobReviewed: true, stage: 'complete', receipt, tasks: Object.fromEntries(Object.keys(onboarding.tasks).map(key => [key, true])) })
  expected.hr.workflow.employeeStatuses[id] = 'active'
  if (expected.hr.workflow.lifecycle) {
    const life = expected.hr.workflow.lifecycle, instance = life.instances.find(item => item.id === life.activeInstances[id]), previous = { ...instance.current }
    instance.current.status = 'active'; lifeEvent(life, 'onboarding-complete', life.simulationDate, previous, instance.current, id, instance.id, { role: 'employee', employeeId: id }, 'Sample onboarding confirmed')
  }
  await expect(panel.getByRole('status', { name: 'Onboarding completion status', exact: true })).toContainText(receipt)
  return receipt
}
function perfReceipt(performance, review, action, actorRole) { performance.sequence += 1; review.activity.push({ receipt: `MOCK-PERF-${String(performance.sequence).padStart(4, '0')}`, action, actorRole }) }
const lifecycleRegion = page => page.getByRole('region', { name: 'Employment lifecycle', exact: true })
export async function hrLifecycleJourney({ page, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/hr/demo/employee/onboarding`)
  await extraLarge(page)
  const expected = structuredClone(seed.workspaces)
  await exact(page, artifactDir, 'hr-life-00-complete-native-seed', expected)
  await onboard(page, expected, 'employee-003'); const originalReceipt = await onboard(page, expected, 'employee-002')
  assert.equal(Object.hasOwn(expected.hr.workflow, 'lifecycle'), false)
  await exact(page, artifactDir, 'hr-life-01-original-onboarding-no-required-date', expected)
  checks.push('Original onboarding compatibility: real legacy Jordan/Avery onboarding completes with no mandatory simulation date or lifecycle materialization; old receipts are independently expected')
  await hrAdmin(page, 'Employees')
  const region = lifecycleRegion(page)
  await region.getByRole('region', { name: 'Employment simulation date', exact: true }).locator('input[type="date"]').fill('2026-10-31')
  await button(region, 'Use simulation date').click()
  await observe(page, artifactDir, 'employmentPreview', 'date', region.getByRole('heading', { name: 'Simulation date preview', exact: true }))
  await button(region, 'Confirm simulation date').click()
  await observe(page, artifactDir, 'employmentOutcome', 'date', region.getByRole('region', { name: 'Employment simulation date', exact: true }).getByRole('status'))
  const life = expected.hr.workflow.lifecycle = initialLifecycle(expected, '2026-10-31')
  lifeEvent(life, 'set-simulation-date', '2026-10-31', null, '2026-10-31')
  const subject = life.instances[1]
  await region.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption('employee-002')
  const selfManager = region.getByRole('combobox', { name: 'Transfer manager', exact: true }).getByRole('option', { name: /Avery Sample.*cannot manage self/ })
  await expect(selfManager).toHaveAttribute('disabled', '')
  assert.equal(await selfManager.evaluate(option => option.disabled), true, 'The native self-manager option must be disabled')
  await region.getByLabel('Transfer department', { exact: true }).fill('Research')
  await region.getByRole('combobox', { name: 'Transfer manager', exact: true }).selectOption('employee-003')
  await region.getByLabel('Transfer effective date', { exact: true }).fill('2026-10-03')
  const beforeGuard = await slots(page); await button(region, 'Preview sample transfer').click()
  await expect(region.getByRole('alert')).toContainText('Finish and acknowledge the existing performance review'); assert.deepEqual(await slots(page), beforeGuard)
  await observe(page, artifactDir, 'employmentRefusal', 'unfinishedReview', region.getByRole('alert'))
  await button(region, 'Discard transfer draft').click()
  await region.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption('employee-001')
  await region.getByRole('combobox', { name: 'Transfer manager', exact: true }).selectOption('employee-002')
  await region.getByLabel('Transfer effective date', { exact: true }).fill('2026-10-03'); await button(region, 'Preview sample transfer').click()
  await expect(region.getByRole('alert')).toContainText('Affected employee IDs: employee-001, employee-002'); assert.deepEqual(await slots(page), beforeGuard)
  await observe(page, artifactDir, 'employmentRefusal', 'reportingCycle', region.getByRole('alert'))
  await capture(page, artifactDir, 'hr-life-02-cycle-refusal', region.getByRole('alert')); await button(region, 'Discard transfer draft').click()
  checks.push('WX-0106/WX-0107 safeguards: actual self-manager option is disabled, a reporting cycle is refused with exactly employee-001/employee-002, and an unfinished manager review blocks transfer with all saved bytes unchanged')
  await hrEmployee(page, expected, 'employee-002', 'My goals and reviews')
  let reviewCard = page.getByRole('article').filter({ hasText: 'review-seed-employee-002' })
  // Scope the actual review by its employee-specific editable label; record IDs
  // need not be duplicated into the product's visible title.
  reviewCard = page.getByRole('textbox', { name: 'Self-review draft for Avery Sample', exact: true }).locator('xpath=ancestor::article[1]')
  await reviewCard.getByRole('textbox').fill('Fictional work complete; ready for a reporting change.')
  await button(reviewCard, 'Save self-review draft').click(); await button(reviewCard, 'Submit sample self-review').click()
  const review = expected.hr.performance.reviews[0]
  review.selfComments = 'Fictional work complete; ready for a reporting change.'; perfReceipt(expected.hr.performance, review, 'self-review draft saved', 'employee'); review.stage = 'self-submitted'; perfReceipt(expected.hr.performance, review, 'self-review submitted', 'employee')
  await hrManager(page, expected, 'employee-001', 'Team performance')
  reviewCard = page.getByRole('textbox', { name: 'Manager review draft for Avery Sample', exact: true }).locator('xpath=ancestor::article[1]')
  await reviewCard.getByRole('textbox').fill('Fictional manager feedback approved before transfer.'); await button(reviewCard, 'Save manager review draft').click(); await button(reviewCard, 'Publish sample review').click()
  review.managerComments = 'Fictional manager feedback approved before transfer.'; review.stage = 'manager-review'; perfReceipt(expected.hr.performance, review, 'manager review draft saved', 'manager'); review.stage = 'published'; perfReceipt(expected.hr.performance, review, 'review published to employee', 'manager')
  await hrEmployee(page, expected, 'employee-002', 'My goals and reviews'); await button(page, 'Acknowledge sample review').click(); review.stage = 'acknowledged'; perfReceipt(expected.hr.performance, review, 'published review acknowledged', 'employee')
  await hrAdmin(page, 'Employees'); await region.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption('employee-002')
  await region.getByLabel('Transfer department', { exact: true }).fill('Research'); await region.getByRole('combobox', { name: 'Transfer manager', exact: true }).selectOption('employee-003'); await region.getByLabel('Transfer effective date', { exact: true }).fill('2026-10-03')
  await button(region, 'Preview sample transfer').click()
  const transfer = page.getByRole('region', { name: 'Sample transfer preview', exact: true })
  await observe(page, artifactDir, 'employmentPreview', 'transfer', button(transfer, 'Confirm sample transfer'))
  await quality(page, artifactDir, 'hr-transfer-fields-and-confirmation', region, button(transfer, 'Confirm sample transfer'), [[region.getByLabel('Transfer department', { exact: true }), 'Research'], [region.getByRole('combobox', { name: 'Transfer manager', exact: true }), 'employee-003'], [region.getByLabel('Transfer effective date', { exact: true }), '2026-10-03']])
  const beforeDateChange = await slots(page)
  const simulation = region.getByRole('region', { name: 'Employment simulation date', exact: true }).locator('input[type="date"]')
  await simulation.fill('2026-10-30')
  await observe(page, artifactDir, 'employmentRefusal', 'changedDate', region.getByRole('status').filter({ hasText: /^The temporary fields or simulation date changed/ }))
  await expect(button(transfer, 'Confirm sample transfer')).toBeDisabled()
  assert.deepEqual(await slots(page), beforeDateChange, 'An unconfirmed simulation date edit invalidates the action without saving anything')
  await simulation.fill('2026-10-31'); await expect(button(transfer, 'Confirm sample transfer')).toBeEnabled()
  for (const text of ['Design', 'Research', 'Morgan Example', 'Jordan Demo', '2026-10-03', 'Affected direct-report scopes', 'employee-002']) await expect(transfer).toContainText(text)
  const beforeCancel = await slots(page); await button(transfer, 'Cancel transfer preview').click(); assert.deepEqual(await slots(page), beforeCancel)
  await button(region, 'Preview sample transfer').click(); await capture(page, artifactDir, 'hr-life-03-transfer-scope-preview', transfer); await button(transfer, 'Confirm sample transfer').click()
  await observe(page, artifactDir, 'employmentOutcome', 'transfer', region.getByRole('status'))
  const previous = { ...subject.current }; subject.current = { ...subject.current, department: 'Research', managerId: 'employee-003' }; lifeEvent(life, 'transfer', '2026-10-03', previous, subject.current, 'employee-002', subject.id)
  await hrManager(page, expected, 'employee-001', 'My team')
  let team = page.getByRole('heading', { name: 'Your demo team', exact: true }).locator('..')
  await expect(team.getByRole('heading', { name: 'Avery Sample', exact: true })).toHaveCount(0)
  await hrManager(page, expected, 'employee-003', 'My team'); team = page.getByRole('heading', { name: 'Your demo team', exact: true }).locator('..')
  await expect(team.getByRole('heading', { name: 'Avery Sample', exact: true })).toBeVisible()
  await exact(page, artifactDir, 'hr-life-04-accepted-transfer-and-role-scope', expected)
  checks.push('WX-0102/WX-0106: actual previous/proposed transfer preview includes both managers, department, explicit effective date and affected report IDs; after acknowledged review the accepted full graph changes both old/new manager scopes')
  await hrAdmin(page, 'Employees'); await region.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption('employee-002')
  await region.getByRole('combobox', { name: 'Employment transition', exact: true }).selectOption('leave')
  await region.getByLabel('Transition effective date', { exact: true }).fill('2026-10-04')
  const reasonField = region.getByRole('textbox', { name: 'Sample transition reason', exact: true })
  await reasonField.fill('')
  const beforeMissingReason = await slots(page)
  await button(region, 'Preview employment transition').click()
  assert.equal(await reasonField.evaluate(field => field.validity.valueMissing), true, 'A transition must require a sample reason')
  await expect(page.getByRole('region', { name: 'Employment transition preview', exact: true })).toHaveCount(0)
  assert.deepEqual(await slots(page), beforeMissingReason, 'A missing reason must not change any saved record')
  for (const [type, date, reason, status] of [['leave', '2026-10-04', 'Fictional scheduled leave.', 'on-leave'], ['return', '2026-10-05', 'Fictional return from leave.', 'active'], ['terminate', '2026-10-06', 'Fictional employment ended.', 'terminated']]) {
    await region.getByRole('combobox', { name: 'Employment transition', exact: true }).selectOption(type)
    await region.getByLabel('Transition effective date', { exact: true }).fill(date)
    await region.getByRole('textbox', { name: 'Sample transition reason', exact: true }).fill(reason)
    await button(region, 'Preview employment transition').click()
    const transition = page.getByRole('region', { name: 'Employment transition preview', exact: true })
    await expect(transition).toContainText(reason); await expect(transition).toContainText(subject.current.status)
    const state = type === 'terminate' ? 'termination' : type
    const confirmation = button(transition, type === 'terminate' ? 'Confirm fictional termination' : type === 'return' ? 'Confirm sample return' : 'Confirm sample leave')
    await observe(page, artifactDir, 'employmentPreview', state, confirmation)
    if (type === 'leave') await quality(page, artifactDir, 'hr-reason-transition', region.getByRole('region', { name: 'Employment state transition', exact: true }), confirmation, [[reasonField, 'Fictional scheduled leave.'], [region.getByLabel('Transition effective date', { exact: true }), '2026-10-04'], [region.getByRole('combobox', { name: 'Employment transition', exact: true }), 'leave']])
    await confirmation.click()
    await observe(page, artifactDir, 'employmentOutcome', state, region.locator('p').filter({ hasText: /^Current instance: employment-employee-002-1 · / }))
    const old = { ...subject.current }; subject.current.status = status; expected.hr.workflow.employeeStatuses['employee-002'] = status
    const id = lifeEvent(life, type, date, old, subject.current, 'employee-002', subject.id, { role: 'employer-owner' }, reason)
    if (type === 'terminate') {
      subject.endDate = date
      for (const [kind, title] of [['asset', 'Return fictional assigned assets'], ['access', 'Review fictional access removal'], ['handover', 'Complete fictional handover']]) {
        const assignment = { id: `${id}-${kind}`, employeeId: 'employee-002', instanceId: subject.id, transitionId: id, kind, title, status: 'assigned' }
        life.offboardingAssignments.push(assignment)
        expected.hr.operations.records.tasks.push({ id: assignment.id, employeeId: 'employee-002', employmentInstanceId: subject.id, sourceId: assignment.id, lifecycleTransitionId: id, offboardingKind: kind, title, status: 'pending' })
      }
    }
  }
  await capture(page, artifactDir, 'hr-life-05-three-offboarding-assignments', page.getByRole('region', { name: 'Fictional offboarding assignments', exact: true }))
  await observe(page, artifactDir, 'instanceHistory', 'offboarding', region.getByRole('region', { name: 'Fictional offboarding assignments', exact: true }).locator('p').filter({ hasText: /^assigned · lifecycle-5-access/ }))
  await observe(page, artifactDir, 'instanceHistory', 'reason', region.getByRole('region', { name: 'Employment lifecycle history', exact: true }).getByText('Sample reason: Fictional employment ended.', { exact: true }))
  await region.getByRole('combobox', { name: 'Onboarding template version', exact: true }).selectOption('sample-v2')
  await button(region, 'Preview template selection').click()
  await observe(page, artifactDir, 'employmentPreview', 'template', region.getByRole('heading', { name: 'Onboarding template selection preview', exact: true }))
  await button(region, 'Confirm template selection').click()
  await observe(page, artifactDir, 'instanceHistory', 'templateSaved', region.getByRole('region', { name: 'Captured onboarding template versions', exact: true }).getByRole('status'))
  lifeEvent(life, 'select-template', '2026-10-31', 'sample-v1', 'sample-v2'); life.selectedTemplateVersion = 'sample-v2'
  for (const [label, value] of [['Rehire department', 'Research'], ['Rehire job title', 'Fictional research specialist'], ['Rehire start date', '2026-10-07']]) await region.getByLabel(label, { exact: true }).fill(value)
  await region.getByRole('combobox', { name: 'Rehire manager', exact: true }).selectOption('employee-003')
  await button(region, 'Compare fictional rehire').click()
  const rehire = page.getByRole('region', { name: 'Fictional rehire preview', exact: true })
  await observe(page, artifactDir, 'employmentPreview', 'rehire', rehire.getByRole('heading', { name: 'Retained directory identity and history', exact: true }))
  await quality(page, artifactDir, 'hr-rehire-fields-and-comparison', region.getByRole('region', { name: 'Fictional rehire comparison', exact: true }), button(rehire, 'Confirm fictional rehire'), [[region.getByLabel('Rehire department', { exact: true }), 'Research'], [region.getByLabel('Rehire job title', { exact: true }), 'Fictional research specialist'], [region.getByLabel('Rehire start date', { exact: true }), '2026-10-07'], [region.getByRole('combobox', { name: 'Rehire manager', exact: true }), 'employee-003']])
  for (const text of ['employee-002', subject.id, 'employment-employee-002-2', 'sample-v2', 'security', 'Retain directory identity', 'prior onboarding receipts']) await expect(rehire).toContainText(text)
  await capture(page, artifactDir, 'hr-life-06-retained-person-new-employment', rehire)
  await button(rehire, 'Confirm fictional rehire').click()
  await observe(page, artifactDir, 'employmentOutcome', 'rehire', region.locator('p').filter({ hasText: /^Current instance: employment-employee-002-2 · / }))
  const instances = region.getByRole('region', { name: 'Employment instances and captured onboarding', exact: true })
  await observe(page, artifactDir, 'instanceHistory', 'prior', instances.getByText('employment-employee-002-1 · prior instance', { exact: true }))
  await observe(page, artifactDir, 'instanceHistory', 'current', instances.getByText('employment-employee-002-2 · current instance', { exact: true }))
  await observe(page, artifactDir, 'instanceHistory', 'legacy', instances.getByText('Captured checklist: legacy-employee-002 · Onboarding: complete', { exact: true }))
  await observe(page, artifactDir, 'instanceHistory', 'selected', instances.getByText('Captured checklist: sample-v2 · Onboarding: draft', { exact: true }))
  await observe(page, artifactDir, 'instanceHistory', 'originalReceipt', instances.getByText('Original onboarding receipt: MOCK-ONBOARDING-0002', { exact: true }))
  subject.archivedOnboarding = structuredClone(expected.hr.workflow.onboarding['employee-002'])
  const initial = { status: 'onboarding', department: 'Research', jobTitle: 'Fictional research specialist', managerId: 'employee-003' }
  const newInstance = { id: 'employment-employee-002-2', employeeId: 'employee-002', startDate: '2026-10-07', endDate: null, previousInstanceId: subject.id, initial, current: { ...initial }, templateVersion: 'sample-v2', tasks: structuredClone(v2Tasks) }
  life.instances.push(newInstance); life.activeInstances['employee-002'] = newInstance.id
  expected.hr.workflow.onboarding['employee-002'] = { profileReviewed: false, jobReviewed: false, tasks: { profile: false, policy: false, security: false }, stage: 'draft' }; expected.hr.workflow.employeeStatuses['employee-002'] = 'onboarding'
  lifeEvent(life, 'rehire', '2026-10-07', null, initial, 'employee-002', newInstance.id)
  assert.equal(subject.archivedOnboarding.receipt, originalReceipt)
  await exact(page, artifactDir, 'hr-life-07-complete-rehire-and-archived-receipt', expected)
  checks.push('WX-0101/WX-0103/WX-0104/WX-0105/WX-0110: dated leave/return/termination retain prior states and sample reasons, create exactly three linked offboarding tasks, and actual rehire retains identity/original receipt while creating a new instance with a captured incomplete v2 checklist')
  await hrEmployee(page, expected, 'employee-002', 'My onboarding')
  for (const task of v2Tasks) await expect(button(page, `${task.title} Mark complete`)).toBeVisible()
  const rehireReceipt = await onboard(page, expected, 'employee-002')
  await observe(page, artifactDir, 'employmentOutcome', 'onboarding', page.getByRole('status', { name: 'Onboarding completion status', exact: true }))
  assert.equal(rehireReceipt, 'MOCK-ONBOARDING-0003')
  assert.equal(subject.archivedOnboarding.receipt, originalReceipt)
  assert.equal(subject.templateVersion, 'legacy-employee-002')
  assert.equal(newInstance.templateVersion, 'sample-v2')
  await exact(page, artifactDir, 'hr-life-08-completed-v2-original-receipt-retained', expected)
  checks.push('Rehire onboarding compatibility: actual captured v2 profile/policy/security tasks complete under a new receipt, while the original instance retains its legacy checklist and original completed receipt')
  await hrAdmin(page, 'Recruiting')
  const recruiting = expected.hr.recruiting, job = recruiting.jobs[0], candidate = recruiting.candidates[0]
  function recruitActivity(record, action) { recruiting.sequence += 1; record.activity.push({ receipt: `MOCK-RECRUIT-${String(recruiting.sequence).padStart(4, '0')}`, action, actorRole: 'employer-owner' }) }
  await button(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Demo support specialist', exact: true }) }), 'Publish sample job').click()
  job.status = 'published'; recruitActivity(job, 'Job published in this browser only')
  for (const [label, stage] of [['Begin screening', 'screening'], ['Move to interview', 'interview'], ['Prepare sample offer', 'offer'], ['Hire into mock onboarding', 'hired']]) {
    await button(page, label).click(); candidate.stage = stage
    recruitActivity(candidate, stage === 'hired' ? 'Mock hire created an onboarding employee; compensation unconfigured' : `Candidate moved to ${stage}`)
  }
  candidate.employeeId = 'employee-recruit-seed-001'
  const hireId = candidate.employeeId
  recruiting.hiredEmployees.push({ id: hireId, firstName: 'Casey', lastName: 'Fiction', workEmail: 'casey.fiction@example.invalid', department: 'Operations', jobTitle: 'Demo support specialist', employmentStatus: 'onboarding', managerId: 'employee-001', payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false, onboarding: v2Tasks.map(task => ({ ...task, status: 'pending' })), onboardingTemplateVersion: 'sample-v2' })
  expected.hr.workflow.onboarding[hireId] = { profileReviewed: false, jobReviewed: false, tasks: { profile: false, policy: false, security: false }, stage: 'draft' }
  expected.hr.workflow.profileEmails[hireId] = 'casey.fiction@example.invalid'; expected.hr.workflow.employeeStatuses[hireId] = 'onboarding'; expected.hr.operations.balances[hireId] = { vacation: 40, sick: 24 }
  const hiredInitial = { status: 'onboarding', department: 'Operations', jobTitle: 'Demo support specialist', managerId: 'employee-001' }
  const hireInstance = { id: 'employment-employee-recruit-seed-001-1', employeeId: hireId, startDate: '2026-10-31', endDate: null, initial: hiredInitial, current: { ...hiredInitial }, templateVersion: 'sample-v2', tasks: structuredClone(v2Tasks) }
  life.instances.push(hireInstance); life.activeInstances[hireId] = hireInstance.id
  lifeEvent(life, 'hire', '2026-10-31', null, hiredInitial, hireId, hireInstance.id)
  await hrAdmin(page, 'Employees'); await region.getByRole('combobox', { name: 'Lifecycle employee', exact: true }).selectOption(hireId)
  await observe(page, artifactDir, 'employmentOutcome', 'hire', region.getByRole('region', { name: 'Employment instances and captured onboarding', exact: true }).getByText('Captured checklist: sample-v2 · Onboarding: draft', { exact: true }))
  assert.equal(subject.archivedOnboarding.receipt, originalReceipt)
  await exact(page, artifactDir, 'hr-life-09-recruiting-new-hire-selected-v2', expected)
  checks.push('WX-0110 new-hire wiring: actual publish/screen/interview/offer/hire controls capture sample-v2 and three pending tasks in a new hire instance; complete independent records retain both Avery onboarding receipts and all existing HR/CMS/CRM state')
  await roundTrip({ page, artifactDir, seed, expected, module: 'hr' })
  checks.push('HR lifecycle persistence: complete instances, original receipt, template definitions, event reasons and offboarding tasks survive refresh, real old/new imports, selected HR restore and exact-byte Undo')
  return { expected, originalReceipt, oldInstanceId: subject.id, newInstanceId: newInstance.id }
}

async function hrAdminProfile(page) {
  await hrAdmin(page, 'Employees')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Avery Sample', exact: true }) })
  await card.getByRole('link', { name: 'View record', exact: true }).click(); await noDialog(page)
}

async function filePaths(directory) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await filePaths(path))
    else if (entry.isFile()) paths.push(path)
  }
  return paths.sort()
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
async function bindings(paths, base) { return Object.fromEntries(await Promise.all(paths.map(async path => [relative(base, path), sha256(await readFile(path))]))) }

export async function hrCorrectionsJourney({ page, origin, artifactDir, seed, checks }) {
  await page.goto(`${origin}/hr/demo/employee/profile`)
  await extraLarge(page)
  const expected = structuredClone(seed.workspaces)
  await exact(page, artifactDir, 'hr-corrections-00-complete-native-seed', expected)
  const self = { role: 'employee', employeeId: 'employee-002' }, owner = { role: 'employer-owner' }
  async function propose(value) {
    await hrEmployee(page, expected, 'employee-002', 'My profile')
    const form = page.getByRole('form', { name: 'Propose work email correction', exact: true })
    await form.getByRole('textbox', { name: /^Proposed work email/ }).fill(value)
    await form.getByLabel(/^Simulation date/).fill('2026-10-15')
    const before = await slots(page); await button(form, 'Preview correction request').click(); assert.deepEqual(await slots(page), before)
    const preview = page.getByRole('region', { name: 'Correction request preview', exact: true })
    await expect(preview).toContainText(expected.hr.workflow.profileEmails['employee-002']); await expect(preview).toContainText(value)
    if (value === 'avery.accepted@fixture.invalid') {
      await observe(page, artifactDir, 'correction', 'preview', preview.getByRole('heading', { name: 'Correction request preview', exact: true }))
      await quality(page, artifactDir, 'hr-correction-request-inputs', form, button(preview, 'Confirm correction request preview'), [[form.getByRole('textbox', { name: /^Proposed work email/ }), 'avery.accepted@fixture.invalid'], [form.getByLabel(/^Simulation date/), '2026-10-15']])
    }
    await button(preview, 'Confirm correction request preview').click()
    const life = expected.hr.workflow.lifecycle ??= initialLifecycle(expected, '2026-10-15')
    life.simulationDate = '2026-10-15'; const sequence = life.sequence++
    const correction = { id: `correction-${sequence}`, sequence, employeeId: 'employee-002', instanceId: 'employment-employee-002-1', field: 'workEmail', oldValue: expected.hr.workflow.profileEmails['employee-002'], proposedValue: value, actor: self, status: 'pending' }
    life.corrections.push(correction); return correction
  }
  const accepted = await propose('avery.accepted@fixture.invalid')
  await observe(page, artifactDir, 'correction', 'pending', page.getByRole('article', { name: 'Directory correction correction-1', exact: true }).locator('span').filter({ hasText: /^pending$/ }))
  assert.equal(expected.hr.workflow.profileEmails['employee-002'], 'avery@example.invalid')
  await exact(page, artifactDir, 'hr-corrections-01-pending-does-not-edit-directory', expected)
  async function reviewCorrection(correction, outcome, reason) {
    await hrAdminProfile(page)
    const form = page.getByRole('form', { name: `Review directory correction ${correction.id}`, exact: true })
    await form.getByRole('combobox', { name: 'Correction outcome', exact: true }).selectOption(outcome)
    await form.getByRole('textbox', { name: 'Correction outcome reason', exact: true }).fill(reason)
    await button(form, 'Preview correction outcome').click()
    const preview = page.getByRole('region', { name: 'Correction outcome preview', exact: true })
    await expect(preview).toContainText(outcome); await expect(preview).toContainText(reason)
    if (outcome === 'accepted') await quality(page, artifactDir, 'hr-correction-outcome-inputs', form, button(preview, 'Confirm correction outcome preview'), [[form.getByRole('combobox', { name: 'Correction outcome', exact: true }), 'accepted'], [form.getByRole('textbox', { name: 'Correction outcome reason', exact: true }), 'Fictional correction accepted after review.']])
    await button(preview, 'Confirm correction outcome preview').click()
    const life = expected.hr.workflow.lifecycle
    if (outcome === 'accepted') {
      const sequence = life.sequence++
      life.directoryHistory.push({ id: `directory-${sequence}`, sequence, employeeId: 'employee-002', field: 'workEmail', oldValue: correction.oldValue, newValue: correction.proposedValue, actor: owner, origin: 'correction', correctionId: correction.id })
      expected.hr.workflow.profileEmails['employee-002'] = correction.proposedValue
    }
    correction.status = outcome; correction.outcome = { sequence: life.sequence++, actor: owner, reason }
    await observe(page, artifactDir, 'correction', outcome, page.getByRole('article', { name: `Directory correction ${correction.id}`, exact: true }).locator('span').filter({ hasText: new RegExp(`^${outcome}$`) }))
  }
  await reviewCorrection(accepted, 'accepted', 'Fictional correction accepted after review.')
  const rejected = await propose('avery.rejected@fixture.invalid')
  await reviewCorrection(rejected, 'rejected', 'Fictional correction rejected after review.')
  assert.equal(expected.hr.workflow.profileEmails['employee-002'], 'avery.accepted@fixture.invalid')
  const directory = page.getByRole('region', { name: 'Directory corrections and history', exact: true })
  await capture(page, artifactDir, 'hr-corrections-02-accepted-and-rejected', directory)
  await exact(page, artifactDir, 'hr-corrections-02-complete-recorded-outcomes', expected)
  checks.push('WX-0109: an own-employee real correction proposal leaves directory values unchanged; HR acceptance records the change atomically and rejection records a reason/outcome while preserving the accepted email')
  await hrAdminProfile(page)
  const form = page.getByRole('form', { name: 'Edit directory work email', exact: true })
  const life = expected.hr.workflow.lifecycle
  function directoryChange(value) {
    const oldValue = expected.hr.workflow.profileEmails['employee-002'], sequence = life.sequence++
    expected.hr.workflow.profileEmails['employee-002'] = value
    life.directoryHistory.push({ id: `directory-${sequence}`, sequence, employeeId: 'employee-002', field: 'workEmail', oldValue, newValue: value, actor: owner, origin: 'direct' })
  }
  await form.getByRole('textbox', { name: /^New directory work email/ }).fill('avery.direct@fixture.invalid')
  await button(form, 'Preview directory edit').click(); await button(page.getByRole('region', { name: 'Directory edit preview', exact: true }), 'Confirm directory edit preview').click()
  directoryChange('avery.direct@fixture.invalid')
  await form.getByRole('textbox', { name: /^New directory work email/ }).fill('avery.stale@fixture.invalid'); await button(form, 'Preview directory edit').click()
  await page.getByRole('textbox', { name: 'Synthetic work email', exact: true }).fill('avery.intervening@fixture.invalid'); await button(page, 'Save sample profile').click()
  directoryChange('avery.intervening@fixture.invalid')
  const beforeStale = await slots(page)
  await button(page.getByRole('region', { name: 'Directory edit preview', exact: true }), 'Confirm directory edit preview').click()
  await expect(form.getByRole('alert')).toHaveText('The current HR action was refused. Preview again; your inputs are kept.'); assert.deepEqual(await slots(page), beforeStale)
  await observe(page, artifactDir, 'correction', 'stale', form.getByRole('alert'))
  await quality(page, artifactDir, 'hr-directory-edit-retained-input', form, button(form, 'Preview directory edit'), [[form.getByRole('textbox', { name: /^New directory work email/ }), 'avery.stale@fixture.invalid']])
  await expect(form.getByRole('textbox', { name: /^New directory work email/ })).toHaveValue('avery.stale@fixture.invalid')
  const history = directory.getByRole('table', { name: 'Saved directory email changes', exact: true })
  await expect(history).toContainText('avery@example.invalid'); await expect(history).toContainText('avery.intervening@fixture.invalid'); await expect(history).toContainText('employer-owner')
  const historyRows = await history.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td,th')].map(cell => cell.textContent)))
  assert.deepEqual(historyRows, [
    ['2', 'Avery Sample · employee-002', 'Work email', 'avery@example.invalid', 'avery.accepted@fixture.invalid', 'employer-owner', 'correction · correction-1'],
    ['6', 'Avery Sample · employee-002', 'Work email', 'avery.accepted@fixture.invalid', 'avery.direct@fixture.invalid', 'employer-owner', 'direct'],
    ['7', 'Avery Sample · employee-002', 'Work email', 'avery.direct@fixture.invalid', 'avery.intervening@fixture.invalid', 'employer-owner', 'direct'],
  ], 'The actual saved history table must display literal sequence/old/new/actor/origin columns')
  await expect(history.getByRole('columnheader')).toHaveText(['Change sequence', 'Employee', 'Field', 'Old value', 'New value', 'Actor preview', 'Origin'])
  const scroll = history.locator('..')
  await scroll.scrollIntoViewIfNeeded()
  const scrollBefore = await scroll.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflow: getComputedStyle(element).overflowX } })
  assert.ok(scrollBefore.scrollWidth > scrollBefore.clientWidth, 'All seven retained history columns require a contained horizontal scroll at x-large/narrow width')
  assert.ok(scrollBefore.left >= -1 && scrollBefore.right <= 391, 'The history scroll container must stay inside the narrow page')
  assert.equal(scrollBefore.overflow, 'auto')
  const originHeader = history.getByRole('columnheader', { name: 'Origin', exact: true })
  await originHeader.scrollIntoViewIfNeeded()
  assert.ok(await scroll.evaluate(element => element.scrollLeft) > 0, 'The actual browser must scroll the retained history table to its final column')
  const originBounds = await originHeader.boundingBox()
  assert.ok(originBounds && originBounds.x >= scrollBefore.left - 1 && originBounds.x + originBounds.width <= scrollBefore.right + 1, 'The last Origin column remains reachable inside the contained history scroll')
  await capture(page, artifactDir, 'hr-corrections-03-contained-final-history-column', originHeader)
  await writeFile(join(artifactDir, 'hr-corrections-history-scroll.json'), JSON.stringify({ ...scrollBefore, originBounds, columns: ['Change sequence', 'Employee', 'Field', 'Old value', 'New value', 'Actor preview', 'Origin'], rows: historyRows }, null, 2) + '\n')
  await observe(page, artifactDir, 'correction', 'history', history.getByRole('cell', { name: 'avery.intervening@fixture.invalid', exact: true }))
  await capture(page, artifactDir, 'hr-corrections-03-old-new-actor-sequences', history)
  await exact(page, artifactDir, 'hr-corrections-03-complete-stale-refusal', expected, ['Edit directory work email'])
  checks.push('WX-0108: real direct edits show each old/new email, owner preview and local sequence; an intervening accepted profile save invalidates an open confirmation without changing any later record/save byte or discarding the refused input')
  await roundTrip({ page, artifactDir, seed, expected, module: 'hr' })
  checks.push('HR correction persistence: all request outcomes and old/new/actor/sequence history survive actual exports/imports, refresh and HR-only restore/Undo, with unchecked portal bytes preserved')
  return { expected }
}

/** Four isolated profiles use actual product controls and strict native network
 * guards. Expected records use literal input/receipt changes, never app models. */
export async function runPortalLifecycle({ browser, origin, artifactDir, seed }) {
  const checks = [], problems = [], warnings = [], evidence = {}, qualityEvidence = {}
  const repository = process.cwd(), runtimeFiles = await filePaths(join(repository, 'src'))
  const runtimeBefore = await bindings(runtimeFiles, repository)
  async function run(name, journey) {
    let context, page, failure
    const laneArtifacts = join(artifactDir, name)
    await mkdir(laneArtifacts)
    try {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
      evidence[name] = await journey({ page, context, origin, artifactDir: laneArtifacts, seed, checks })
      qualityEvidence[name] = recordFor(page)
      await page.screenshot({ path: join(artifactDir, `${name}-final.png`), fullPage: true })
    } catch (error) {
      failure = error
      if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDir, `${name}-failure.png`), fullPage: true, timeout: 5000 }).catch(() => {})
      throw error
    } finally {
      if (page) qualityEvidence[name] = recordFor(page)
      const cleanup = []
      if (context) {
        try { await context.tracing.stop({ path: join(artifactDir, `${name}-trace.zip`) }) } catch (error) { cleanup.push(error.message) }
        try { await context.close() } catch (error) { cleanup.push(error.message) }
      }
      if (cleanup.length && failure) failure.artifactErrors = cleanup
      else if (cleanup.length) throw new Error(`${name} cleanup failed: ${cleanup.join('; ')}`)
    }
  }
  const results = await Promise.allSettled([['hr-employment', hrLifecycleJourney], ['hr-corrections', hrCorrectionsJourney], ['cms', cmsLifecycleJourney], ['crm', crmLifecycleJourney]].map(([name, journey]) => run(name, journey)))
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
  const statusFamilies = Object.fromEntries(Object.entries(lifecycleStatusInventory).map(([family, states]) => [family, Object.keys(states)]))
  const observations = Object.entries(qualityEvidence).flatMap(([lane, value]) => value.statuses.map(item => ({ ...item, capture: `${lane}/${item.capture}` })))
  const statusCoverage = auditStatusCoverage(statusFamilies, observations)
  await writeFile(join(artifactDir, 'portal-lifecycle-status-coverage.json'), JSON.stringify({ inventory: lifecycleStatusInventory, sourceReferences: lifecycleStatusSources, coverage: statusCoverage, observations, scope: 'Only newly implemented native lifecycle/release/ownership meanings; legacy native151 and selected SDK44 remain separate ledgers. All observations are real UI journeys, no render fixtures.' }, null, 2) + '\n')
  await writeFile(join(artifactDir, 'portal-lifecycle-quality.json'), JSON.stringify({ viewport: { width: 390, height: 844 }, textScale: 'x-large', qualityEvidence }, null, 2) + '\n')
  if (!failures.length) { try { assert.deepEqual(statusCoverage.missing, [], 'Every literal new lifecycle status/outcome requires its own real monochrome witness') } catch (error) { failures.push(error) } }
  if (!failures.length) checks.push(`New native status inventory: ${statusCoverage.expected} literal meanings have individually scoped, uncovered grayscale witnesses from real actions`, 'New-control quality: actual x-large at 390px retains entered values, labels and actions; semantic accessible names are unambiguous and Tab reaches new confirmations/import/selected-restore/Undo controls')
  await writeFile(join(artifactDir, 'portal-lifecycle-evidence.json'), JSON.stringify({ checks, problems, warnings: [...new Set(warnings)], evidence, failures: failures.map(error => error.message) }, null, 2) + '\n')
  if (failures.length || problems.length) {
    const error = failures[0] ?? new Error(problems.join('\n')); error.smokeEvidence = { checks, problems, warnings: [...new Set(warnings)], lifecycleEvidence: evidence, laneFailures: failures.map(failure => failure.message) }; throw error
  }
  assert.deepEqual(await bindings(await filePaths(join(repository, 'src')), repository), runtimeBefore, 'All runtime source bytes must remain frozen throughout browser verification')
  const harnessFiles = ['scripts/browser-portal-lifecycle.mjs', 'tests/browser/portal-lifecycle.mjs', 'tests/browser/portal-quality.mjs', 'tests/browser/portals-smoke.mjs', 'tests/browser/seed-contract.mjs', 'tests/browser/model-loader.mjs', 'scripts/browser-smoke.mjs', 'scripts/browser-preview-process.mjs', 'scripts/browser-preview-worker.mjs', 'package-lock.json']
  const artifactBindings = await bindings((await filePaths(artifactDir)).filter(path => !relative(artifactDir, path).startsWith('vite-cache/') && !['report.json', 'portal-lifecycle-manifest.json'].includes(path.split('/').at(-1))), artifactDir)
  const manifest = { algorithm: 'sha256', hashMode: 'exact file bytes; source before/after equality; generated Vite dependency cache and self-referential report/manifest excluded', runtime: runtimeBefore, harness: await bindings(harnessFiles.map(path => join(repository, path)), repository), artifacts: artifactBindings }
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n'
  await writeFile(join(artifactDir, 'portal-lifecycle-manifest.json'), manifestBytes)
  const manifestReceipt = { file: 'portal-lifecycle-manifest.json', sha256: sha256(manifestBytes), runtimeFiles: runtimeFiles.length, harnessFiles: harnessFiles.length, artifacts: Object.keys(artifactBindings).length }
  return { checks, warnings: [...new Set(warnings)], seedHash: seed.sha256, manifest: manifestReceipt, coveredItems: ['WX-0101', 'WX-0102', 'WX-0103', 'WX-0104', 'WX-0105', 'WX-0106', 'WX-0107', 'WX-0108', 'WX-0109', 'WX-0110', 'WX-0314', 'WX-0315', 'WX-0316', 'WX-0379', 'WX-0380', 'WX-0381'], statusCoverage, qualityEvidence, lifecycleEvidence: evidence }
}
